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
import type { ToolMask, ToolRestrictionGroup, ToolRestrictionSelect } from './types.ts';
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
export type * from './types.ts';
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
 * Group assembled tool schemas into board rows by their `tool:`-prefix, the
 * same convention the guidance-prose filter uses. Names sharing a prefix fold
 * into one group named after the prefix; the rest land in `Other`. A tool-less
 * header yields an empty board.
 * @param tools - assembled tool schemas from a `request/header`.
 * @returns the grouped board rows, preserving declaration order within rows.
 */
export declare function buildGroups(tools: readonly {
    name: string;
    description: string;
}[]): readonly ToolRestrictionGroup[];
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
     * Apply one mask and append its durable selection. The apply runs BEFORE
     * the append so a rejected name surfaces at the commit and never records a
     * mask that could not apply; the synchronous `session/event` re-application
     * that follows is idempotent. No persistence happens here — the caller
     * decides whether the commit is a user preference or a transient restore.
     * @param agent - the session's live agent.
     * @param safe - the sanitized mask; `undefined` clears to unrestricted.
     */
    private commitCore;
    /**
     * Install the agent-scoped guard and apply the fold. Idempotent: an HMR
     * sweep that also sees `agent/created` installs exactly once.
     * @param agent - the agent to mask.
     */
    private installForAgent;
    /**
     * Fold the blank-session picker board into the projection once the agent
     * exists (the session seed cannot, because `session/created` precedes
     * `agent/created` and the tool registry needs the agent scope). The board
     * derives from the preset's authored `tools.yml` — the authoritative
     * per-preset default tool list — falling back to the agent's assembled
     * schemas when the preset publishes no tool metadata. If the seeded
     * selection already carries a board, or a `request/header` has already
     * run, nothing is appended — the board is display-only and the first
     * turn's assembled tools are the authoritative source.
     * @param agent - the freshly composed agent.
     */
    private seedBoard;
    /**
     * Build the blank-session picker board for one agent. Prefers the preset's
     * authored `tools.yml` `groups` (group → tool names, the display/seed data
     * that outlives a re-compose); without declared groups, the preset's
     * authored `default.allow` is the per-preset default tool list and seeds
     * the board rows. Falls back to the agent's assembled schemas grouped by
     * `tool:`-prefix when the preset publishes no tool metadata at all. The
     * reserved PTC transport never appears.
     * @param agent - the agent whose board is being built.
     * @param presetId - the session's agent preset id, if any.
     * @returns the grouped board rows in display order.
     */
    private boardFor;
    /** Dispose one agent's applied visible-set restriction and guard. */
    private uninstallForAgent;
    /**
     * Queue a full settings-board pass. A recomposition event can fire while
     * Loader settlement is still in flight (a sibling plugin registering a tool
     * during its `apply()`), and the full pass mounts every roster preset — a
     * preset's own tool registrations fire more `tools/change`, re-entering the
     * handler and holding settlement hostage to the cascade. The runner skips
     * until the Loader settles, so boot composes nothing; the pass still runs
     * once afterward, and every later recomposition event coalesces into the
     * one pending pass.
     */
    private scheduleBoardsRefresh;
    /** Whether a full boards pass is already queued; one pass at a time. */
    private refreshPending;
    /**
     * Seed the settings section's checkbox boards: one board per roster preset
     * plus a shared `default` board. Each preset's board is its composed tool
     * set grouped exactly like the blank-session picker. A preset composes its
     * real plugin tree ONCE under a standing scope (`standingKeyFor`), so every
     * roster preset yields its true tool set here — standard's full coding set,
     * minimal's two tools, creator's specials — whether or not any session has
     * composed on it yet. The standard tools live on the agent plane each preset
     * composes and are invisible in the global view, so the standing scope (not
     * `ctx.tools.schemas()`) is the authoritative source. The boards ride the
     * settings namespace's `boards` field (derived, read-only for the section;
     * re-seeded on startup, on `agent/created`, and on `tools/change` so a
     * preset recomposition updates the offered set).
     *
     * This full pass composes every roster preset's standing tree, which mounts
     * the preset's whole plugin composition — expensive, so it runs only AFTER
     * Loader settlement (see {@link scheduleBoardsRefresh} and
     * {@link seedBoardsFast} for the boot-time path).
     * @returns settlement once the namespace reflects the current tool sets.
     */
    private refreshBoards;
    /**
     * Seed the settings section's checkbox boards from the fast sources only,
     * for the boot-time path where composing preset trees would hold Loader
     * settlement hostage. Reads each already-composed standing mount's tools
     * (free — the composition already exists), each preset's authored
     * `tools.yml`, and the global tool view as a shared fallback. Presets with
     * no standing mount and no authored tools.yml keep the global view board
     * until the post-settlement full pass composes them.
     * @returns settlement once the namespace reflects the fast sources.
     */
    private seedBoardsFast;
    /**
     * Persist a computed board map into the settings namespace, filling in the
     * shared `default` board (the widest board seen, or the global view) and
     * keeping previously-seeded boards for presets this pass could not recompute
     * (deleted presets, broken compositions).
     * @param boards - the boards computed by this pass, keyed by preset id.
     * @returns settlement once the namespace reflects the combined board set.
     */
    private commitBoards;
    /**
     * One preset's authored `tools.yml` board, when it publishes one. Built-in
     * presets (standard, minimal, ptc, cordis) publish no `tools.yml` — only the
     * composition — so they yield undefined here and await the standing pass.
     * @param preset - the roster preset whose authored tools to read.
     * @returns the grouped board from `groups` or `default.allow`, or undefined
     * when the preset publishes no tool metadata or the file is unreadable.
     */
    private authoredBoard;
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
    /**
     * Append the seed mask as the session's own durable selection, optionally
     * carrying the blank-session picker board. The board is display seed data
     * that rides the same known event so a fresh session shows its tool set
     * before the first request folds a `request/header`; the projection folds
     * it into the picker state and `request/header` supersedes it once a turn
     * runs.
     * @param session - the session being seeded.
     * @param mask - the mask to commit.
     * @param groups - the blank-session picker board, when computable now.
     */
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
    /**
     * Restore one session's mask to the preset's authored `tools.yml` default
     * (falling back to the deployment default when the preset publishes none),
     * and clear the user's saved per-preset override so future sessions on this
     * preset derive the same authored default. Unlike a normal selection, this
     * deliberately ignores a saved override — "preset default" names the
     * authored choice, the same value the settings section's "Preset default"
     * hint describes.
     * @param agent - the session's live agent.
     * @param presetId - the session's agent preset id, if any.
     * @returns settlement once the mask is committed.
     */
    private restoreDefault;
}
export default ToolRestrictionService;
//# sourceMappingURL=index.d.ts.map