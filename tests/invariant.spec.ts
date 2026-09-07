import { describe, expect, it } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import SessionStore, { type Session, type SessionEvent, SessionSeq } from '@deepseek-ai/dsh-session'
import * as ToolMaskInvariant from '@deepseek-ai/dsh-tool-restriction/invariant'
import InvariantRegistry from '@deepseek-ai/dsh-invariants'

async function setup(): Promise<Context> {
  const ctx = new Context()
  await ctx.plugin(SessionStore)
  await ctx.plugin(InvariantRegistry, { enabled: true })
  await ctx.plugin(ToolMaskInvariant)
  return ctx
}

function selectionEvent(mask?: { allow: readonly string[] }): SessionEvent {
  return {
    type: 'tool-restriction/selected',
    seq: SessionSeq(0),
    time: 0,
    data: mask === undefined ? {} : { mask },
  }
}

describe('tool-restriction invariants', () => {
  it('accepts a blank-window selection and ignores unrelated event kinds', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('session/event', {} as Session, selectionEvent({ allow: ['read'] })) }).not.toThrow()
    expect(() => { ctx.emit('session/event', {} as Session, {
      type: 'turn/end', seq: 0, time: 0, data: {},
    } as SessionEvent) }).not.toThrow()
    expect(() => { ctx.emit('tools/change') }).not.toThrow()
  })

  it('rejects a selection whose mask.allow is not an array of strings', async () => {
    const ctx = await setup()
    expect(() => { ctx.emit('session/event', {} as Session, {
      type: 'tool-restriction/selected',
      seq: 0,
      time: 0,
      data: { mask: { allow: 'read' } },
    } as SessionEvent) }).toThrow(/mask\.allow must be an array of strings/)
  })

  it('rejects a selection logged after the first turn/start', async () => {
    const ctx = await setup()
    const session = ctx.sessions.create()
    session.append('turn/start', { turn: 0 })
    // Emitting the hypothetical post-lock append surfaces the invariant loudly
    // (real appends contain listener errors inside the session package).
    const event = {
      type: 'tool-restriction/selected',
      seq: session.snapshotEvents().length,
      time: 0,
      data: { mask: { allow: ['read'] } },
    } as SessionEvent
    expect(() => { ctx.emit('session/event', session, event) }).toThrow(/after turn\/start/)
  })

  it('rejects an already-locked selection present on late registration', async () => {
    const ctx = new Context()
    await ctx.plugin(SessionStore)
    const session = ctx.sessions.create()
    session.append('turn/start', { turn: 0 })
    session.append('tool-restriction/selected', { mask: { allow: ['read'] } })
    await ctx.plugin(InvariantRegistry, { enabled: true })

    await expect(ctx.plugin(ToolMaskInvariant).then(() => undefined)).rejects.toThrow(/after turn\/start/)
  })
})
