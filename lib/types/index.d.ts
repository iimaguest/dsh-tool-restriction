/**
 * Per-session tool mask, fixed at the first turn and saved per preset.
 *
 * The mask is a log-only session knob over the session's inherited tool set —
 * the sibling of `permission/preset`, `sandbox/mode`, and `approval/policy`,
 * deliberately NOT a `SessionHeader` field: it rides `tool-restriction/selected`
 * events folded last-wins, a file-backed per-preset default, and the existing
 * `tools.restrict`/`guard` seams, so no backend or `SESSION_FORMAT_VERSION`
 * change is needed.
 *
 * Application is a lifecycle duty, not a one-time call. This service folds the
 * events at agent publication and re-applies whenever a selection appends, so a
 * resumed blank session is re-masked and a session with history resumes under
 * the exact tool set its history was produced under. The saved default is
 * seeded at `session/created`; the guidance prose follows the mask through a
 * `system-prompt/assemble` waterfall listener.
 * @module @deepseek-ai/dsh-tool-restriction
 */
import { Context, Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
import type { Agent } from '@deepseek-ai/dsh-agent';
import type { SessionEvent } from '@deepseek-ai/dsh-session';
import type { SettingsNamespace } from '@deepseek-ai/dsh-settings';
import type { ToolMask, ToolRestrictionSelect } from './types.js';
declare module '@deepseek-ai/cordis' {
    interface Context {
        toolRestriction: ToolRestrictionService;
    }
}
declare module '@deepseek-ai/dsh-session/types' {
    interface SessionEventMap {
        /**
         * The session's tool mask was chosen while the session was blank (or
         * materialized from the per-preset default at creation). Log-only: it
         * records what the model's tool set was, so a resumed or forked session
         * rebuilds the same mask. `mask` absent restores the unrestricted
         * default; an empty `allow` is the deliberate talk-only spelling.
         */
        'tool-restriction/selected': ToolRestrictionSelect;
    }
}
export type * from './types.js';
/** Settings namespace carrying the per-preset saved masks and the default. */
export declare const TOOL_RESTRICTION_SETTINGS_NAMESPACE: SettingsNamespace;
/** Plugin config: a deployment default mask for sessions that derive none. */
export interface Config {
    /**
     * Default mask for sessions that derive none from a preset chain (no preset
     * composed, no `tools.yml`, no saved override). Omitted = unrestricted.
     */
    default?: ToolMask;
}
/**
 * Fold the last selected mask from the durable log; replay needs no catch-up
 * state.
 * @param events - session events in log order; other event types are ignored.
 * @returns the last selected mask, or undefined when none was recorded.
 */
export declare function resolveSessionToolRestriction(events: readonly SessionEvent[]): ToolMask | undefined;
/**
 * The session-level tool mask: folds and applies the durable selection,
 * seeds the per-preset default, filters guidance prose, and owns the guard.
 */
export declare class ToolRestrictionService extends Service {
    static inject: string[];
    static Config: z<Config>;
    /** The composition-provided default, applied when a preset seeds none. */
    private readonly deploymentDefault;
    /** Live settings source (composition base while no settings provider mounts). */
    private settingsSource;
    /** Per-agent applied restriction/guard state, keyed by the agent. */
    private readonly applies;
    constructor(ctx: Context, config: Config);
    /**
     * Commit one mask: apply (validating names against the agent's inherited
     * set), append the durable selection, and persist the per-preset
     * preference. The apply runs BEFORE the append so a rejected name surfaces
     * at the commit and never records a mask that could not apply; the
     * synchronous `session/event` re-application that follows is idempotent.
     * The CALLER owns the blank-window check — the lock is enforced at the
     * operation that makes it.
     * @param agent - the session's live agent.
     * @param mask - the selected mask; `undefined` clears to unrestricted.
     */
    set(agent: Agent, mask: ToolMask | undefined): Promise<void>;
    /**
     * Install the agent-scoped guard and apply the fold. Idempotent: an HMR
     * sweep that also sees `agent/created` installs exactly once.
     * @param agent - the agent to mask.
     */
    private installForAgent;
    /** Dispose one agent's applied visible-set restriction and guard. */
    private uninstallForAgent;
    /**
     * Replace the agent's visible-set restriction with the live fold's mask.
     *
     * The new restriction is applied BEFORE the old one is disposed, so a
     * rejected apply (a mask naming a tool the registry no longer inherits)
     * leaves the previous, at-least-as-committed restriction in force rather
     * than an unmasked gap; the guard still denies per the live fold.
     * @param agent - the agent to (re-)mask.
     */
    private applyForAgent;
    /**
     * Set one agent's visible-set restriction, validating names up front. A mask
     * naming a tool the session does not inherit throws here, so the commit path
     * never records a mask that could not apply. Re-application with the same
     * mask (the `session/event` echo) is idempotent.
     * @param agent - the agent to (re-)mask.
     * @param mask - the mask to apply; `undefined` clears to unrestricted.
     */
    private applyMask;
    /**
     * Seed a fresh session's mask from the per-preset chain: saved override →
     * preset `tools.yml` default → deployment default. A log that already
     * records a selection is the truth and is left alone.
     * @param session - the session to seed.
     */
    private seedSession;
    /**
     * Resolve the preset's authored `tools.yml` default (async filesystem read)
     * and materialize it, racing-safe: another writer may land first.
     * @param session - the session being seeded.
     * @param presetId - the preset id the session runs.
     * @param deploymentDefault - the fallback when the preset publishes none.
     */
    private seedPresetDefault;
    /** Append the seed mask as the session's own durable selection. */
    private materialize;
    /**
     * Fold the guidance sections that accompany a masked-out tool out of the
     * authoritative assembly. Fast path: no mask, or no agent scope — then the
     * prose stays exactly as registered.
     * @param assembly - the assembled prompt to filter.
     * @param agent - the assembling agent, or undefined for diagnostics.
     * @returns the filtered assembly (the same reference when nothing is dropped).
     */
    private filterGuidance;
    /** Write (or clear) the per-preset saved mask at the commit point. */
    private persistPresetPreference;
}
export default ToolRestrictionService;
//# sourceMappingURL=index.d.ts.map