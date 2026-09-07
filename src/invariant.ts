/** Package-owned tool-mask invariant: the blank-window lock, enforced durably. @module @deepseek-ai/dsh-tool-restriction/invariant */

import type { Context } from '@deepseek-ai/cordis'
import type { Session, SessionEvent } from '@deepseek-ai/dsh-session'
import type { InvariantFailure, InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-tool-restriction'

/** Cordis companion plugin name. */
export const name = 'tool-restriction-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/** Whether a value is an array of strings (the only legal `allow` shape). */
function isStringArray(value: unknown): value is string[] {
  return Array.isArray(value) && value.every(entry => typeof entry === 'string')
}

/** Validate one freshly appended selection against the other event stream. */
function validateEvent(session: Session, event: SessionEvent, fail: InvariantFailure): void {
  if (event.type !== 'tool-restriction/selected') return
  const mask = event.data.mask
  if (mask !== undefined && !isStringArray(mask.allow)) {
    fail(`session "${String(session.id)}" tool-restriction/selected mask.allow must be an array of strings`)
  }
  const events = session.snapshotEvents()
  // The blank-window lock: a selection may only land before the first
  // turn/start, because the mask is the KV-stable prefix guarantee.
  for (const prior of events) {
    if (prior.seq >= event.seq) break
    if (prior.type === 'turn/start') {
      fail(`session "${String(session.id)}" records tool-restriction/selected after turn/start; the mask is fixed once the first request is under way`)
    }
  }
}

/** Install validation that loaded sessions obey the mask lock. */
const install: InvariantInstaller = Object.assign((ctx: Context, fail: InvariantFailure) => {
  for (const session of ctx.sessions.list()) {
    let turnStarted = false
    for (const event of session.snapshotEvents()) {
      if (event.type === 'turn/start') {
        turnStarted = true
        continue
      }
      if (event.type !== 'tool-restriction/selected') continue
      if (turnStarted) {
        fail(`session "${session.id}" records tool-restriction/selected after turn/start; the mask is fixed once the first request is under way`)
      }
      const mask = event.data.mask
      if (mask !== undefined && !isStringArray(mask.allow)) {
        fail(`session "${session.id}" tool-restriction/selected mask.allow must be an array of strings`)
      }
    }
  }
  ctx.on('internal/dispatch', (_mode, eventName, args) => {
    if (eventName !== 'session/event') return
    const session = (args as [Session, SessionEvent])[0]
    const event = (args as [Session, SessionEvent])[1]
    validateEvent(session, event, fail)
  }, { global: true })
}, { inject: ['sessions'] })

/**
 * Register the tool-restriction invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
