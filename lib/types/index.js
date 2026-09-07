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
import { dirname } from 'node:path';
import z from '@deepseek-ai/schemastery';
import { z as zod } from 'zod';
// Resolves `ctx.tools` (the registry the mask filters) and the reserved PTC
// transport the mask must never name.
import { RUN_CODE_NAME } from '@deepseek-ai/dsh-tools';
import { readPresetTools } from './tools.js';
/** Settings namespace carrying the per-preset saved masks and the default. */
export const TOOL_RESTRICTION_SETTINGS_NAMESPACE = 'tool-restriction';
/** Schemastery shape of one `{ allow }` mask. */
const maskShape = z.object({ allow: z.array(z.string()).required() });
/**
 * Optional mask shape. Schemastery treats an absent object field as an empty
 * `{}`, which would fail `allow`'s required check; `default(undefined)` makes
 * the absent case resolve to `undefined` (unrestricted) instead.
 */
const optionalMaskShape = maskShape.default(undefined);
/**
 * The `tool-restriction` settings document schema. The cast records schemastery's
 * mutable-array widening over the domain's readonly `ToolMask`; on the JSON
 * wire the two serialize identically. `boards` is a derived, read-only field:
 * the schema admits it so the describe view carries the per-preset picker
 * board, and writes never target it (the section writes only `byPreset`).
 */
const groupShape = z.object({
    group: z.string(),
    tools: z.array(z.object({
        name: z.string(),
        description: z.string(),
    })),
});
const settingsShape = z.object({
    default: optionalMaskShape,
    byPreset: z.dict(maskShape).default({}),
    boards: z.dict(z.array(groupShape)).default({}),
});
/** The guidance-section name convention the prose filter recognizes. */
const TOOL_GUIDANCE_SECTION = /^tool:[^:]+$/;
const TOOL_GUIDANCE_PREFIX = 'tool:';
/**
 * Fold the last selected mask from the durable log; replay needs no catch-up
 * state.
 * @param events - session events in log order; other event types are ignored.
 * @returns the last selected mask, or undefined when none was recorded.
 */
export function resolveSessionToolRestriction(events) {
    for (let index = events.length - 1; index >= 0; index -= 1) {
        const event = events[index];
        if (event.type === 'tool-restriction/selected')
            return event.data.mask;
    }
    return undefined;
}
/** The display bucket tool names without a `tool:`-prefix fall into. */
const OTHER_GROUP = 'Other';
/**
 * Group assembled tool schemas into board rows by their `tool:`-prefix, the
 * same convention the guidance-prose filter uses. Names sharing a prefix fold
 * into one group named after the prefix; the rest land in `Other`. A tool-less
 * header yields an empty board.
 * @param tools - assembled tool schemas from a `request/header`.
 * @returns the grouped board rows, preserving declaration order within rows.
 */
export function buildGroups(tools) {
    const byGroup = new Map();
    for (const tool of tools) {
        // The reserved PTC transport is not an end-capability tool the mask can
        // name (`tools.restrict()` rejects it): it always remains callable, so it
        // never appears on the picker board or in a committed mask.
        if (tool.name === RUN_CODE_NAME)
            continue;
        const match = /^tool:([^:]+)$/.exec(tool.name);
        const group = match === null ? OTHER_GROUP : (match[1] ?? OTHER_GROUP);
        const row = byGroup.get(group);
        if (row === undefined)
            byGroup.set(group, [tool]);
        else
            row.push(tool);
    }
    return [...byGroup.entries()].map(([group, row]) => ({ group, tools: row }));
}
/**
 * The session-level tool mask: folds and applies the durable selection,
 * seeds the per-preset default, filters guidance prose, and owns the guard.
 */
export class ToolRestrictionService extends Service {
    static inject = ['agents', 'sessions', 'tools', 'sessionProjections'];
    static Config = z.object({
        // `default` is optional: `optionalMaskShape` resolves the absent case to
        // undefined (unrestricted), and the cast records the readonly/mutable
        // widening over the domain's `ToolMask`.
        default: optionalMaskShape,
    });
    /** The composition-provided default, applied when a preset seeds none. */
    deploymentDefault;
    /** Live settings source (composition base while no settings provider mounts). */
    settingsSource;
    /** Per-agent applied restriction/guard state, keyed by the agent. */
    applies = new Map();
    constructor(ctx, config) {
        super(ctx, 'toolRestriction');
        this.deploymentDefault = config.default;
        const base = {
            ...config.default === undefined ? {} : { default: config.default },
            byPreset: {},
            boards: {},
        };
        this.settingsSource = () => base;
        ctx.inject(['settings'], (settingsCtx) => {
            settingsCtx.settings.installSection(ctx, TOOL_RESTRICTION_SETTINGS_NAMESPACE, settingsShape, base, {
                // The seed chain (`resolveSessionToolRestriction` + seed reads) derives
                // nothing that needs re-judging on a settings change; the source thunk
                // is read at every session creation, and writes go through mutate.
                setSource: (current) => { this.settingsSource = current; },
                onChange: () => { },
            });
        });
        // The settings section's per-preset board is derived from each preset's
        // authored `tools.yml`; refresh it when the roster is available and re-read
        // on a tool-set change (a preset recomposition emits `tools/change`) so a
        // preset edit updates the board.
        void this.refreshBoards();
        ctx.on('tools/change', () => { void this.refreshBoards(); });
        // Seeding: a fresh session materializes its seed mask into the log so the
        // session is self-contained (model-visible ⟺ logged). A session with a
        // recorded selection is already self-contained and stays as it is.
        ctx.on('session/created', (session) => { this.seedSession(session); });
        for (const session of ctx.sessions.list()) {
            this.seedSession(session);
        }
        // Apply is a lifecycle duty. `agent/created` is the scope the mask needs
        // (`tools.restrict` requires an agent-scoped context); a resumed blank
        // session re-masks here, and a session with history resumes under the set
        // its history was produced under.
        ctx.on('agent/created', ({ agent }) => { this.installForAgent(agent); });
        for (const agent of ctx.agents.list()) {
            this.installForAgent(agent);
        }
        ctx.on('agent/disposed', ({ agent }) => { this.uninstallForAgent(agent); });
        // A blank-window selection (or a scripted creation) appends the durable
        // event; session/event dispatches synchronously, so the re-apply lands
        // before the append returns and the fold can never outrun the restriction.
        // The same dispatch is the commit point for the forwarded Host event, so
        // every surface watching `ctx.remote.$on('tool-restriction/selected')`
        // hears the fold as soon as it is durable (model-visible ⟺ logged).
        ctx.on('session/event', (session, event) => {
            if (event.type === 'tool-restriction/selected') {
                ctx.emit('tool-restriction/selected', session.id, event.data.mask);
                const agent = ctx.agents.get(session.id);
                if (agent !== undefined)
                    this.applyForAgent(agent);
                return;
            }
            // A blank-window preset switch recomposes the same agent's tools (no
            // `agent/created` fires), so the picker board must be re-seeded for the
            // new composition. The seed appends a board-carrying selection; the fold
            // above keeps the existing mask, and a `request/header` supersedes it
            // once the first turn runs.
            if (event.type === 'agent-preset/selected') {
                const agent = ctx.agents.get(session.id);
                if (agent !== undefined)
                    void this.seedBoard(agent);
            }
        });
        // Guidance prose follows the mask: drop `tool:<name>` sections whose tool
        // the effective mask excludes, so the model is never lectured about a tool
        // it cannot call. Transport names (`tools:*`) do not match `tool:` and a
        // `complete` persona suppresses the whole band before assembly, so both
        // stay untouched.
        ctx.on('system-prompt/assemble', async (_assembly, context, next) => {
            const assembled = await next();
            return this.filterGuidance(assembled, context.agent);
        });
        // The tool-restriction projection unit: fold the durable selection into
        // the picker's describe view (current mask, lock state, and the grouped
        // visible tool board). The board comes from the assembled `request/header`
        // tools (already logged ⟺ model-visible), so the projection is pure over
        // committed events and needs no session access. The unit child activates
        // only when a projection registry is composed (headless assemblies stay
        // unaffected).
        const describeSchema = zod.object({
            current: zod.object({
                allow: zod.array(zod.string()),
            }).optional(),
            locked: zod.boolean(),
            groups: zod.array(zod.object({
                group: zod.string(),
                tools: zod.array(zod.object({
                    name: zod.string(),
                    description: zod.string(),
                })),
            })),
        });
        ctx.inject(['sessionProjections'], (projectionCtx) => {
            projectionCtx.sessionProjections.register({
                key: 'tool-restriction',
                stateSchema: describeSchema,
                init: () => ({ locked: false, groups: [] }),
                apply: (state, event) => {
                    switch (event.type) {
                        case 'tool-restriction/selected':
                            return {
                                ...state,
                                current: event.data.mask,
                                // A user toggle carries no board; keep the seeded (or first
                                // request's) board so the picker never clears while the
                                // session is blank.
                                groups: event.data.groups ?? state.groups,
                                locked: state.locked,
                            };
                        case 'turn/start':
                            return { ...state, locked: true };
                        case 'request/header':
                            return {
                                ...state,
                                groups: buildGroups(event.data.header.tools ?? []),
                            };
                        default:
                            return state;
                    }
                },
                wire: { viewSchema: describeSchema, view: state => state },
                stateVersion: 1,
            });
        });
        // The /tool-restriction command: the one write path a web client uses
        // (the hero picker submits the chosen mask as this line). Only a blank
        // session may change its mask — the first turn fixes it forever.
        ctx.inject(['commands'], (commandCtx) => {
            commandCtx.commands.register({
                name: 'tool-restriction',
                description: 'Set the per-session tool mask (allow-list); only while the session is blank',
                input: { hint: '<all|none|default|{"allow":["tool:a","tool:b"]}>' },
                handler: ({ agent, rawInput }) => {
                    const text = rawInput.trim();
                    if (text === '') {
                        const mask = resolveSessionToolRestriction(agent.session.snapshotEvents());
                        return {
                            kind: 'success',
                            text: mask === undefined
                                ? 'tool mask unrestricted'
                                : `tool mask allows: ${mask.allow.join(', ') || '(none)'}`,
                        };
                    }
                    if (text === 'all') {
                        void this.set(agent, undefined);
                        return { kind: 'success', text: 'tool mask cleared to unrestricted' };
                    }
                    if (text === 'none') {
                        void this.set(agent, { allow: [] });
                        return { kind: 'success', text: 'tool mask set to none (talk-only)' };
                    }
                    if (text === 'default') {
                        // Restore the preset's authored `tools.yml` default (not the
                        // user's saved per-preset override): "preset default" names the
                        // deployment's authored choice, the same value the settings
                        // section shows. Resolution is async (a filesystem read on the
                        // preset dir), so commit after the fold settles.
                        const presetId = this.ctx.sessionProjections.stateOf(agent.session, 'agentPreset') ?? undefined;
                        void this.restoreDefault(agent, presetId);
                        return { kind: 'success', text: 'tool mask restored to preset default' };
                    }
                    try {
                        const parsed = JSON.parse(text);
                        if (!Array.isArray(parsed.allow) || parsed.allow.some(name => typeof name !== 'string')) {
                            throw new Error('invalid mask');
                        }
                        const mask = sanitizeMask({ allow: parsed.allow });
                        void this.set(agent, mask);
                        return { kind: 'success', text: `tool mask allows: ${mask.allow.join(', ') || '(none)'}` };
                    }
                    catch {
                        return { kind: 'error', text: 'invalid mask (use all|none|default or {"allow":["tool:a"]})' };
                    }
                },
            });
        });
    }
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
    async set(agent, mask) {
        const safe = mask === undefined ? undefined : sanitizeMask(mask);
        this.commitCore(agent, safe);
        await this.persistPresetPreference(agent, safe);
    }
    /**
     * Apply one mask and append its durable selection. The apply runs BEFORE
     * the append so a rejected name surfaces at the commit and never records a
     * mask that could not apply; the synchronous `session/event` re-application
     * that follows is idempotent. No persistence happens here — the caller
     * decides whether the commit is a user preference or a transient restore.
     * @param agent - the session's live agent.
     * @param safe - the sanitized mask; `undefined` clears to unrestricted.
     */
    commitCore(agent, safe) {
        const applied = this.applies.get(agent);
        if (applied !== undefined)
            this.applyMask(agent, safe);
        agent.session.append('tool-restriction/selected', safe === undefined ? {} : { mask: safe });
    }
    /**
     * Install the agent-scoped guard and apply the fold. Idempotent: an HMR
     * sweep that also sees `agent/created` installs exactly once.
     * @param agent - the agent to mask.
     */
    installForAgent(agent) {
        if (this.applies.has(agent))
            return;
        // The guard is registered ONCE and reads the live fold on every call, so
        // a blank-window re-selection updates denial without re-registration.
        const guard = agent.ctx.tools.guard((execution) => {
            const current = resolveSessionToolRestriction(agent.session.snapshotEvents());
            if (current === undefined)
                return undefined;
            if (current.allow.includes(execution.name))
                return undefined;
            // Keep what the scope owns: own-layer registrations stay callable under
            // the mask (the ancestor filter exempts them), exactly like the schemas.
            if (this.ctx.tools.get(execution.name, agent) !== undefined)
                return undefined;
            return `tool "${execution.name}" is excluded by this session's tool mask`;
        });
        this.applies.set(agent, { restrict: undefined, guard });
        this.applyForAgent(agent);
        void this.seedBoard(agent);
    }
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
    async seedBoard(agent) {
        const session = agent.session;
        const events = session.snapshotEvents();
        if (events.some(event => event.type === 'request/header'))
            return;
        const presetId = this.ctx.sessionProjections.stateOf(session, 'agentPreset') ?? undefined;
        const board = await this.boardFor(agent, presetId);
        if (board.length === 0)
            return;
        const last = events.at(-1);
        if (last?.type === 'tool-restriction/selected' && last.data.groups !== undefined)
            return;
        const mask = resolveSessionToolRestriction(events);
        // Append only when the log does not already record a board: the appended
        // selection preserves the folded mask (or unrestricted) and carries the
        // grouped board, so the picker has something to show before the first
        // request assembles tools. The `session/event` echo re-applies the same
        // mask idempotently.
        if (mask === undefined)
            session.append('tool-restriction/selected', { groups: board });
        else
            this.materialize(session, mask, board);
    }
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
    async boardFor(agent, presetId) {
        const presets = this.ctx.get('agentPresets');
        if (presetId !== undefined && presets !== undefined) {
            try {
                const preset = await presets.resolve(presetId);
                const tools = await readPresetTools(dirname(preset.path));
                const groups = tools?.groups;
                if (groups !== undefined && Object.keys(groups).length > 0) {
                    return Object.entries(groups).flatMap(([group, names]) => {
                        const row = names
                            .filter(name => name !== RUN_CODE_NAME)
                            .map(name => ({ name, description: '' }));
                        return row.length === 0 ? [] : [{ group, tools: row }];
                    });
                }
                const allow = tools?.default?.allow;
                if (allow !== undefined && allow.length > 0) {
                    return buildGroups(allow
                        .filter(name => name !== RUN_CODE_NAME)
                        .map(name => ({ name, description: '' })));
                }
            }
            catch {
                // A roster that no longer supplies the id, or a broken tools.yml,
                // degrades the board to the agent's assembled schemas.
            }
        }
        return buildGroups(agent.ctx.tools.schemas(agent));
    }
    /** Dispose one agent's applied visible-set restriction and guard. */
    uninstallForAgent(agent) {
        const applied = this.applies.get(agent);
        if (applied === undefined)
            return;
        applied.restrict?.();
        applied.guard();
        this.applies.delete(agent);
    }
    /**
     * Seed the settings section's checkbox board with the full deployment tool
     * set (grouped exactly like the blank-session picker board). The board is
     * the global `ctx.tools` view — every composed tool with its model-facing
     * description — so the section offers the same checkbox picker the composer
     * does. It rides the settings namespace's `boards` field (a derived value
     * the section reads; it is re-seeded on every startup and on `tools/change`
     * so a preset recomposition updates the offered set).
     * @returns settlement once the namespace reflects the current tool set.
     */
    async refreshBoards() {
        const settings = this.ctx.get('settings');
        if (settings === undefined)
            return;
        const board = buildGroups(this.ctx.tools.schemas());
        if (board.length === 0)
            return;
        try {
            await settings.update(TOOL_RESTRICTION_SETTINGS_NAMESPACE, { boards: { default: board } });
        }
        catch (error) {
            this.ctx.logger.warn(`dsh-tool-restriction: seeding settings board failed: ${String(error)}`);
        }
    }
    /**
     * Replace the agent's visible-set restriction with the live fold's mask.
     *
     * The new restriction is applied BEFORE the old one is disposed, so a
     * rejected apply (a mask naming a tool the registry no longer inherits)
     * leaves the previous, at-least-as-committed restriction in force rather
     * than an unmasked gap; the guard still denies per the live fold.
     * @param agent - the agent to (re-)mask.
     */
    applyForAgent(agent) {
        const applied = this.applies.get(agent);
        if (applied === undefined)
            return;
        this.applyMask(agent, resolveSessionToolRestriction(agent.session.snapshotEvents()));
    }
    /**
     * Set one agent's visible-set restriction, validating names up front. A mask
     * naming a tool the session does not inherit throws here, so the commit path
     * never records a mask that could not apply. Re-application with the same
     * mask (the `session/event` echo) is idempotent.
     * @param agent - the agent to (re-)mask.
     * @param mask - the mask to apply; `undefined` clears to unrestricted.
     */
    applyMask(agent, mask) {
        const applied = this.applies.get(agent);
        if (applied === undefined)
            return;
        if (mask !== undefined) {
            const next = agent.ctx.tools.restrict({ allow: mask.allow });
            applied.restrict?.();
            applied.restrict = next;
            return;
        }
        applied.restrict?.();
        applied.restrict = undefined;
    }
    /**
     * Seed a fresh session's mask from the per-preset chain: saved override →
     * preset `tools.yml` default → deployment default. A log that already
     * records a selection is the truth and is left alone.
     * @param session - the session to seed.
     */
    seedSession(session) {
        if (hasSelection(session.snapshotEvents()))
            return;
        const presetId = this.ctx.sessionProjections.stateOf(session, 'agentPreset') ?? undefined;
        const saved = presetId === undefined ? undefined : this.settingsSource().byPreset[presetId];
        const deploymentDefault = this.settingsSource().default ?? this.deploymentDefault;
        if (saved !== undefined) {
            this.materialize(session, saved);
            return;
        }
        if (presetId === undefined) {
            if (deploymentDefault !== undefined)
                this.materialize(session, deploymentDefault);
            return;
        }
        void this.seedPresetDefault(session, presetId, deploymentDefault);
    }
    /**
     * Resolve the preset's authored `tools.yml` default (async filesystem read)
     * and materialize it, racing-safe: another writer may land first.
     * @param session - the session being seeded.
     * @param presetId - the preset id the session runs.
     * @param deploymentDefault - the fallback when the preset publishes none.
     */
    async seedPresetDefault(session, presetId, deploymentDefault) {
        if (hasSelection(session.snapshotEvents()))
            return;
        const presets = this.ctx.get('agentPresets');
        let preset;
        try {
            preset = presets === undefined ? undefined : await presets.resolve(presetId);
        }
        catch {
            // A roster that no longer supplies the id (deleted preset) degrades the
            // seed to the deployment default; the secret is never failing a session
            // that already exists over a stale seed.
        }
        const mask = preset?.tools?.default ?? deploymentDefault;
        if (mask === undefined)
            return;
        if (hasSelection(session.snapshotEvents()))
            return;
        this.materialize(session, mask);
    }
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
    materialize(session, mask, groups) {
        session.append('tool-restriction/selected', {
            mask,
            ...groups === undefined || groups.length === 0 ? {} : { groups },
        });
    }
    /**
     * Fold the guidance sections that accompany a masked-out tool out of the
     * authoritative assembly. Fast path: no mask, or no agent scope — then the
     * prose stays exactly as registered.
     * @param assembly - the assembled prompt to filter.
     * @param agent - the assembling agent, or undefined for diagnostics.
     * @returns the filtered assembly (the same reference when nothing is dropped).
     */
    filterGuidance(assembly, agent) {
        if (agent === undefined)
            return assembly;
        const mask = resolveSessionToolRestriction(agent.session.snapshotEvents());
        if (mask === undefined)
            return assembly;
        const tools = this.ctx.tools;
        const sections = assembly.sections.filter((section) => {
            if (!TOOL_GUIDANCE_SECTION.test(section.name))
                return true;
            const name = section.name.slice(TOOL_GUIDANCE_PREFIX.length);
            if (mask.allow.includes(name))
                return true;
            // Keep what the scope owns: own-layer registrations stay visible under
            // the mask (the ancestor filter exempts them), so their prose stays.
            return tools.get(name, agent) !== undefined;
        });
        // The model-visible tool block (what becomes `request/header.tools`) must
        // reflect the mask: an own-layer registration (subagent, delegation) is
        // exempt from `tools.restrict`'s visibility filter, so without this the
        // model would still be offered tools the mask excludes — a "talk-only"
        // session would keep seeing delegation tools. Restrict the assembled
        // schemas to the allowed set; an empty mask yields an empty block and the
        // loop omits the `tools` field entirely.
        const allowed = new Set(mask.allow);
        const toolsFiltered = assembly.tools.filter(tool => allowed.has(tool.name));
        if (sections.length === assembly.sections.length
            && toolsFiltered.length === assembly.tools.length)
            return assembly;
        return {
            ...assembly,
            sections,
            tools: toolsFiltered,
        };
    }
    /** Write (or clear) the per-preset saved mask at the commit point. */
    async persistPresetPreference(agent, mask) {
        const settings = this.ctx.get('settings');
        if (settings === undefined)
            return;
        const presetId = this.ctx.sessionProjections.stateOf(agent.session, 'agentPreset') ?? undefined;
        if (presetId === undefined)
            return;
        if (mask === undefined) {
            // Select all clears to unrestricted: remove the saved override so the
            // preset default governs the next session on this preset.
            await settings.mutate(TOOL_RESTRICTION_SETTINGS_NAMESPACE, [
                { op: 'unset', path: ['byPreset', presetId] },
            ]);
            return;
        }
        await settings.mutate(TOOL_RESTRICTION_SETTINGS_NAMESPACE, [
            { op: 'set', path: ['byPreset', presetId], value: { allow: [...mask.allow] } },
        ]);
    }
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
    async restoreDefault(agent, presetId) {
        const deploymentDefault = this.settingsSource().default ?? this.deploymentDefault;
        let authored;
        if (presetId !== undefined) {
            const presets = this.ctx.get('agentPresets');
            try {
                const preset = presets === undefined ? undefined : await presets.resolve(presetId);
                authored = preset?.tools?.default;
            }
            catch {
                // A roster that no longer supplies the id (deleted preset) degrades to
                // the deployment default.
            }
        }
        const mask = authored ?? deploymentDefault;
        this.commitCore(agent, mask === undefined ? undefined : sanitizeMask(mask));
        const settings = this.ctx.get('settings');
        if (settings === undefined || presetId === undefined)
            return;
        // Restoring is not a preference: drop any saved override so the authored
        // default governs the next session on this preset.
        await settings.mutate(TOOL_RESTRICTION_SETTINGS_NAMESPACE, [
            { op: 'unset', path: ['byPreset', presetId] },
        ]);
    }
}
/** Whether the session log already records a mask selection. */
function hasSelection(events) {
    return events.some(event => event.type === 'tool-restriction/selected');
}
/**
 * Remove the reserved PTC presentation transport from a committed mask. The
 * transport is not an end-capability tool: `tools.restrict()` rejects it and
 * it stays callable no matter the mask, so a mask that names it is either a
 * client send error or an inherited default — both resolve to "not masked".
 * @param mask - the mask to sanitize.
 * @returns the mask with `run_code` removed from `allow`.
 */
function sanitizeMask(mask) {
    const allow = mask.allow.filter(name => name !== RUN_CODE_NAME);
    return allow.length === mask.allow.length ? mask : { allow };
}
export default ToolRestrictionService;
//# sourceMappingURL=index.js.map