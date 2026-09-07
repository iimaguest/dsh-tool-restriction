import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import AgentRegistry from '@deepseek-ai/dsh-agent'
import type { Agent } from '@deepseek-ai/dsh-agent'
import { assembleContextFor } from '@deepseek-ai/dsh-agent'
import SessionStore, { Session, SessionId } from '@deepseek-ai/dsh-session'
import SystemPrompt from '@deepseek-ai/dsh-system-prompt'
import ToolRuntime from '@deepseek-ai/dsh-tools'
import type { ToolDefinition } from '@deepseek-ai/dsh-tools'
import { createScope, type Scope } from '@deepseek-ai/dsh-scope'
import { SettingsProvider, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { ToolCallId } from '@deepseek-ai/dsh-llm'
import ToolRestrictionService, {
  resolveSessionToolRestriction, TOOL_RESTRICTION_SETTINGS_NAMESPACE, type Config,
} from '@deepseek-ai/dsh-tool-restriction'

const testToolSignal = new AbortController().signal

/** Writable memory provider for the settings-lifecycle specs. */
class MemorySettings extends SettingsProvider {
  readonly doc: Record<string, unknown> = {}
  readonly writable = true

  protected load(): Promise<Record<string, unknown>> {
    return Promise.resolve(structuredClone(this.doc))
  }

  protected persist(ns: SettingsNamespace, section: Record<string, unknown>): Promise<void> {
    this.doc[ns] = structuredClone(section)
    return Promise.resolve()
  }
}

let callSeq = 0

function tool(name: string): ToolDefinition {
  return {
    name,
    description: `tool ${name}`,
    parameters: { type: 'object', properties: {} },
    output: {
      schema: { type: 'string' },
      render: (_args, value) => [{ type: 'text', text: value as string }],
    },
    execute: (): Promise<string> => Promise.resolve(`ran:${name}`),
  }
}

/** Mount the domain spine and the tool-restriction service. */
async function harness(options: { config?: Config; settings?: boolean } = {}): Promise<{
  ctx: Context
}> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(SystemPrompt)
  await ctx.plugin(ToolRuntime)
  await ctx.plugin(AgentRegistry)
  if (options.settings === true) await ctx.plugin(MemorySettings)
  await ctx.plugin(ToolRestrictionService, options.config ?? {})
  return { ctx }
}

/** Publish a real session-backed agent whose scoped ctx carries the spine. */
async function mintAgent(ctx: Context, id: string, meta?: { agentPreset?: string }): Promise<Agent> {
  const session = ctx.sessions.create(SessionId(id), meta === undefined ? {} : { meta })
  const agent = { id: session.id, session, status: 'idle' } as unknown as Agent
  const scope = await mintScope(ctx, agent)
  ;(agent as { ctx?: Context }).ctx = scope.ctx
  ctx.agents.register(agent)
  return agent
}

/** Mint a scope whose key is the (possibly not yet published) agent. */
async function mintScope(ctx: Context, agent: Agent): Promise<Scope> {
  let scope!: Scope
  await ctx.plugin(Object.assign((inner: Context) => { scope = createScope(inner, agent) },
    { inject: ['tools', 'systemPrompt'] }))
  return scope
}

async function run(ctx: Context, agent: Agent, name: string): Promise<string> {
  const result = await ctx.tools.execute({
    signal: testToolSignal,
    callId: ToolCallId(`c${callSeq++}`),
    name,
    arguments: {},
    agent,
  })
  const first = result.content[0]
  return first?.type === 'text' ? first.text : JSON.stringify(result.content)
}

/** Drain the async seeding path until `assert` passes (stub resolves in microtasks). */
async function waitForSeed(assert: () => void): Promise<void> {
  for (let i = 0; i < 20; i += 1) {
    try { assert(); return } catch { /* keep draining */ }
    await Promise.resolve()
  }
  assert()
}

describe('resolveSessionToolRestriction', () => {
  it('folds to the last selection, or undefined without one', () => {
    const session = Session.create(SessionId('fold'))
    expect(resolveSessionToolRestriction(session.snapshotEvents())).toBeUndefined()
    session.append('tool-restriction/selected', { mask: { allow: ['read'] } })
    session.append('tool-restriction/selected', {})
    expect(resolveSessionToolRestriction(session.snapshotEvents())).toBeUndefined()
    session.append('tool-restriction/selected', { mask: { allow: [] } })
    expect(resolveSessionToolRestriction(session.snapshotEvents())).toEqual({ allow: [] })
  })
})

describe('ToolRestrictionService', () => {
  it('applies a blank-window selection: schemas masked, guard denies, prose follows', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('write'))
    ctx.tools.register(tool('bash'))
    ctx.systemPrompt.section({ name: 'tool:read', order: 100, text: 'Use read.' })
    ctx.systemPrompt.section({ name: 'tool:bash', order: 101, text: 'Use bash.' })
    const agent = await mintAgent(ctx, 's1')

    await ctx.toolRestriction.set(agent, { allow: ['read'] })

    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
    expect(await run(ctx, agent, 'read')).toBe('ran:read')
    expect(await run(ctx, agent, 'bash'))
      .toBe('Error: tool "bash" is excluded by this session\'s tool mask')
    const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent))
    const names = assembly.sections.map(section => section.name)
    expect(names).toContain('tool:read')
    expect(names).not.toContain('tool:bash')
    // The durable event is the session's self-contained record.
    expect(resolveSessionToolRestriction(agent.session.snapshotEvents())).toEqual({ allow: ['read'] })
  })

  it('{ allow: [] } is the talk-only spelling: no schemas and no tool guidance', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.systemPrompt.section({ name: 'tool:read', order: 100, text: 'Use read.' })
    const agent = await mintAgent(ctx, 's2')

    await ctx.toolRestriction.set(agent, { allow: [] })

    expect(ctx.tools.schemas(agent)).toEqual([])
    const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent))
    expect(assembly.sections.some(section => section.name === 'tool:read')).toBe(false)
    expect(await run(ctx, agent, 'read'))
      .toBe('Error: tool "read" is excluded by this session\'s tool mask')
  })

  it('re-selection during the blank window updates schemas and denial without re-registration', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('write'))
    const agent = await mintAgent(ctx, 's3')

    await ctx.toolRestriction.set(agent, { allow: ['read'] })
    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
    await ctx.toolRestriction.set(agent, { allow: ['write'] })
    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['write'])
    expect(await run(ctx, agent, 'read'))
      .toBe('Error: tool "read" is excluded by this session\'s tool mask')
    expect(await run(ctx, agent, 'write')).toBe('ran:write')
  })

  it('clearing to unrestricted restores the whole inherited set', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    const agent = await mintAgent(ctx, 's4')

    await ctx.toolRestriction.set(agent, { allow: ['read'] })
    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
    await ctx.toolRestriction.set(agent, undefined)
    expect(ctx.tools.schemas(agent).map(t => t.name).sort()).toEqual(['bash', 'read'])
    expect(await run(ctx, agent, 'bash')).toBe('ran:bash')
  })

  it('a recorded mask is re-applied on agent publication (resume path)', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    const session = ctx.sessions.create(SessionId('s5'))
    session.append('tool-restriction/selected', { mask: { allow: ['read'] } })
    const agent = { id: session.id, session, status: 'idle' } as unknown as Agent
    const scope = await mintScope(ctx, agent)
    ;(agent as { ctx?: Context }).ctx = scope.ctx
    ctx.agents.register(agent)

    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
    expect(await run(ctx, agent, 'bash')).toContain('excluded by this session\'s tool mask')
  })

  it('an HMR mount sweeps already-live agents and masks them', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    await ctx.plugin(SystemPrompt)
    await ctx.plugin(ToolRuntime)
    await ctx.plugin(AgentRegistry)
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    const agent = await mintAgent(ctx, 's6')
    // Service arrives after the agent; the sweep re-installs and applies.
    await ctx.plugin(ToolRestrictionService, {})
    await ctx.toolRestriction.set(agent, { allow: ['read'] })
    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
  })

  it('keeps own-layer guidance for a tool the mask excludes (the ancestor exemption)', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.systemPrompt.section({ name: 'tool:local', order: 100, text: 'Declared by the scope itself.' })
    const agent = await mintAgent(ctx, 's7')
    // A scope-local registration is visible regardless of the inherited mask.
    ;(agent as { ctx: Context }).ctx.tools.register(tool('local'))
    await ctx.toolRestriction.set(agent, { allow: ['read'] })

    expect(ctx.tools.schemas(agent).map(t => t.name).sort()).toEqual(['local', 'read'])
    expect(await run(ctx, agent, 'local')).toBe('ran:local')
    const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent))
    expect(assembly.sections.some(section => section.name === 'tool:local')).toBe(true)
  })
})

describe('per-preset settings seeding and persistence', () => {
  it('seeds a fresh session from settings.byPreset[preset]', async () => {
    const { ctx } = await harness({ settings: true })
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    await ctx.settings.update(TOOL_RESTRICTION_SETTINGS_NAMESPACE, {
      byPreset: { standard: { allow: ['read'] } },
    })
    const agent = await mintAgent(ctx, 'pps-1', { agentPreset: 'standard' })

    // The seed was materialized into the log and applied at publication.
    expect(resolveSessionToolRestriction(agent.session.snapshotEvents())).toEqual({ allow: ['read'] })
    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
    expect(ctx.settings.get(TOOL_RESTRICTION_SETTINGS_NAMESPACE)).toMatchObject({
      byPreset: { standard: { allow: ['read'] } },
    })
  })

  it('seeds a fresh session from the preset tools.yml default', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    ctx.provide('agentPresets', {
      resolve: (id: string) => Promise.resolve({
        id, trust: 'system', path: `/presets/${id}/agent.cordis.yml`,
        tools: { default: { allow: ['read'] } },
      }),
    } as never)
    const agent = await mintAgent(ctx, 'pps-2', { agentPreset: 'mine' })
    await waitForSeed(() => {
      expect(resolveSessionToolRestriction(agent.session.snapshotEvents())).toEqual({ allow: ['read'] })
    })
    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
  })

  it('a preset tools.yml default yields to a saved override', async () => {
    const { ctx } = await harness({ settings: true })
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    ctx.provide('agentPresets', {
      resolve: () => Promise.resolve({
        id: 'mine', trust: 'system', path: '/p/agent.cordis.yml',
        tools: { default: { allow: ['read'] } },
      }),
    } as never)
    await ctx.settings.update(TOOL_RESTRICTION_SETTINGS_NAMESPACE, {
      byPreset: { mine: { allow: ['bash'] } },
    })
    const agent = await mintAgent(ctx, 'pps-3', { agentPreset: 'mine' })

    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['bash'])
  })

  it('set persists byPreset and a clear removes it', async () => {
    const { ctx } = await harness({ settings: true })
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    await ctx.settings.update(TOOL_RESTRICTION_SETTINGS_NAMESPACE, {
      byPreset: { standard: { allow: ['read'] } },
    })
    const agent = await mintAgent(ctx, 'pps-4', { agentPreset: 'standard' })

    await ctx.toolRestriction.set(agent, { allow: ['read', 'bash'] })
    const section = ctx.settings.get(TOOL_RESTRICTION_SETTINGS_NAMESPACE) as {
      byPreset?: Record<string, { allow?: unknown }>
    }
    expect(section.byPreset).toMatchObject({ standard: { allow: ['read', 'bash'] } })

    await ctx.toolRestriction.set(agent, undefined)
    expect((ctx.settings.get(TOOL_RESTRICTION_SETTINGS_NAMESPACE) as { byPreset?: object }).byPreset)
      .toEqual({})
  })

  it('deployed default config seeds a session that composes no preset', async () => {
    const { ctx } = await harness({ config: { default: { allow: ['read'] } } })
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('bash'))
    const agent = await mintAgent(ctx, 'pps-5')

    expect(resolveSessionToolRestriction(agent.session.snapshotEvents())).toEqual({ allow: ['read'] })
  })
})

describe('headless composition: a config-seeded session masks a real turn', () => {
  it('a tools.yml default restricts the composed tool set and the live execution', async () => {
    const { ctx } = await harness()
    ctx.tools.register(tool('read'))
    ctx.tools.register(tool('write'))
    ctx.tools.register(tool('bash'))
    ctx.systemPrompt.section({ name: 'tool:read', order: 100, text: 'Use read.' })
    ctx.systemPrompt.section({ name: 'tool:bash', order: 100, text: 'Use bash.' })
    // A headless surface composes the session straight from the host (no picker,
    // no RPC): the preset's tools.yml default is the whole lever.
    ctx.provide('agentPresets', {
      resolve: (id: string) => Promise.resolve({
        id, trust: 'system', path: `/presets/${id}/agent.cordis.yml`,
        tools: { default: { allow: ['read'] } },
      }),
    } as never)
    const agent = await mintAgent(ctx, 'headless-1', { agentPreset: 'mine' })
    await waitForSeed(() => {
      expect(resolveSessionToolRestriction(agent.session.snapshotEvents())).toEqual({ allow: ['read'] })
    })

    // The model sees only the allowed tool, and guidance for the masked tool
    // is filtered out of the assembly.
    expect(ctx.tools.schemas(agent).map(t => t.name)).toEqual(['read'])
    const assembly = await ctx.systemPrompt.assemble(assembleContextFor(agent))
    const toolSections = assembly.sections
      .filter(section => section.name.startsWith('tool:'))
      .map(section => section.name)
    expect(toolSections).toEqual(['tool:read'])

    // A real turn: the allowed tool runs, the masked one is denied by the guard.
    expect(await run(ctx, agent, 'read')).toBe('ran:read')
    expect(await run(ctx, agent, 'bash')).toContain('excluded by this session\'s tool mask')
  })
})
