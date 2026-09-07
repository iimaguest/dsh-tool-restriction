/**
 * Authoring a preset's `tools.yml` default mask: `setToolsDefault` is the
 * service write a settings surface calls to publish (or clear) the authored
 * default tool set, preserving any hand-authored group assignments and refusing
 * the shipped install. `renderPresetTools`/`writePresetTools` are the
 * under-file primitives.
 */

import { mkdtemp, mkdir, readFile, writeFile } from 'node:fs/promises'
import { existsSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join, dirname } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'
import { Context } from '@deepseek-ai/cordis'
import Loader from '@deepseek-ai/cordis-plugin-loader'
import Include from '@deepseek-ai/cordis-plugin-include'
import { beforeEach, describe, expect, it } from 'vitest'
import AgentPresets, {
  COMPOSITION_FILE, renderPresetTools, TOOLS_FILE, writePresetTools,
} from '@deepseek-ai/dsh-agent-presets'

const FIXTURES = join(dirname(fileURLToPath(import.meta.url)), 'fixtures')
const VALID = '- id: tool-alpha\n  name: ../../plugins/contribute.js\n  config:\n    tool: alpha\n'

let ctx: Context
let userRoot: string

/** Hand-craft a preset directory (tests cannot author text through the service). */
async function seedPreset(
  root: string, id: string, options: { composition?: string; extras?: Record<string, string> } = {},
): Promise<void> {
  await mkdir(join(root, id), { recursive: true })
  await writeFile(join(root, id, COMPOSITION_FILE), options.composition ?? VALID)
  for (const [name, content] of Object.entries(options.extras ?? {})) {
    await writeFile(join(root, id, name), content)
  }
}

beforeEach(async () => {
  userRoot = await mkdtemp(join(tmpdir(), 'dsh-preset-tools-'))
  ctx = new Context()
  ctx.baseUrl = pathToFileURL(FIXTURES).href + '/'
  await ctx.plugin(Loader)
  ctx.loader.builtins.include = Include
  await ctx.plugin(AgentPresets, {
    default: 'standard',
    roots: [
      { path: join(FIXTURES, 'system'), trust: 'system' as const },
      { path: userRoot, trust: 'user' as const },
    ],
    // Every roster in this file pins its own roots: the derived harness-home
    // root would add the developer's real presets to what these assertions
    // count, and `setToolsDefault` would write into it.
    includeShippedRoot: false,
    includeUserRoot: false,
  })
})

describe('renderPresetTools', () => {
  it('renders the default mask and preserves every authored field', () => {
    const yaml = renderPresetTools({
      default: { allow: ['read', 'bash'] },
      groups: { Files: ['read'], Terminal: ['bash'] },
      order: ['Terminal', 'Files'],
    })

    expect(yaml).toMatch(/default:/)
    expect(yaml).toContain('read')
    expect(yaml).toContain('bash')
    expect(yaml).toMatch(/groups:/)
    expect(yaml).toMatch(/order:/)
  })

  it('renders a bare default without empty group or order keys', () => {
    const yaml = renderPresetTools({ default: { allow: [] } })

    expect(yaml).toBe('default:\n  allow: []\n')
    expect(yaml).not.toContain('groups')
  })

  it('renders nothing when there is nothing to publish', () => {
    expect(renderPresetTools({})).toBeUndefined()
    expect(renderPresetTools({ groups: {} })).toBeUndefined()
    expect(renderPresetTools({ order: [] })).toBeUndefined()
  })
})

describe('writePresetTools', () => {
  it('writes a tools.yml readable back by discovery', async () => {
    await seedPreset(userRoot, 'mine')
    const directory = join(userRoot, 'mine')

    await writePresetTools(directory, {
      default: { allow: ['read'] },
      groups: { Files: ['read'] },
    })

    const listed = (await ctx.agentPresets.list()).find(preset => preset.id === 'mine')
    expect(listed?.tools).toEqual({
      default: { allow: ['read'] },
      groups: { Files: ['read'] },
    })
  })

  it('removes the file for a PresetTools with nothing to publish', async () => {
    await seedPreset(userRoot, 'mine', {
      extras: { [TOOLS_FILE]: 'default:\n  allow: [read]\n' },
    })
    const directory = join(userRoot, 'mine')

    await writePresetTools(directory, {})

    expect(existsSync(join(directory, TOOLS_FILE))).toBe(false)
    expect((await ctx.agentPresets.list()).find(preset => preset.id === 'mine')?.tools).toBeUndefined()
  })
})

describe('setToolsDefault', () => {
  it('authors a default mask on a copied preset, preserving groups and order', async () => {
    await ctx.agentPresets.copy('standard', 'mine')
    const directory = join(userRoot, 'mine')
    await writePresetTools(directory, {
      groups: { Files: ['read'] },
      order: ['Files'],
    })

    await ctx.agentPresets.setToolsDefault('mine', { allow: ['read', 'bash'] })

    expect(await readFile(join(directory, TOOLS_FILE), 'utf8'))
      .toMatch(/default:/)
    expect(await readFile(join(directory, TOOLS_FILE), 'utf8'))
      .toContain('read')
    expect(await readFile(join(directory, TOOLS_FILE), 'utf8'))
      .toContain('bash')
    expect((await ctx.agentPresets.list()).find(preset => preset.id === 'mine')?.tools)
      .toEqual({
        default: { allow: ['read', 'bash'] },
        groups: { Files: ['read'] },
        order: ['Files'],
      })
  })

  it('clearing the default removes the file when nothing else is authored', async () => {
    await ctx.agentPresets.copy('standard', 'mine')
    const directory = join(userRoot, 'mine')

    await ctx.agentPresets.setToolsDefault('mine', { allow: ['read'] })
    expect(existsSync(join(directory, TOOLS_FILE))).toBe(true)

    await ctx.agentPresets.setToolsDefault('mine', undefined)

    expect(existsSync(join(directory, TOOLS_FILE))).toBe(false)
    expect((await ctx.agentPresets.list()).find(preset => preset.id === 'mine')?.tools).toBeUndefined()
  })

  it('refuses a shipped preset', async () => {
    await expect(ctx.agentPresets.setToolsDefault('standard', { allow: ['read'] }))
      .rejects.toThrow(/ships with the deployment/)
  })

  it('refuses a user preset outside the writable root', async () => {
    const second = await mkdtemp(join(tmpdir(), 'dsh-preset-tools-second-'))
    await seedPreset(second, 'elsewhere')
    const layered = new Context()
    layered.baseUrl = pathToFileURL(FIXTURES).href + '/'
    await layered.plugin(Loader)
    layered.loader.builtins.include = Include
    await layered.plugin(AgentPresets, {
      default: 'standard',
      roots: [
        { path: userRoot, trust: 'user' as const },
        { path: second, trust: 'user' as const },
      ],
      includeShippedRoot: false,
      includeUserRoot: false,
    })

    // Writes go to the first user root, so a preset discovered from a later
    // one is `user` trust yet outside what authoring is allowed to touch.
    await expect(layered.agentPresets.setToolsDefault('elsewhere', { allow: ['read'] }))
      .rejects.toThrow(/does not live under the writable preset root/)
    expect(existsSync(join(second, 'elsewhere', TOOLS_FILE))).toBe(false)
  })

  it('reports an unknown id rather than silently succeeding', async () => {
    await expect(ctx.agentPresets.setToolsDefault('never-existed', { allow: ['read'] }))
      .rejects.toThrow(/not found/)
  })
})
