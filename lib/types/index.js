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
import { Service } from '@deepseek-ai/cordis';
import z from '@deepseek-ai/schemastery';
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
 * wire the two serialize identically.
 */
const settingsShape = z.object({
    default: optionalMaskShape,
    byPreset: z.dict(maskShape).default({}),
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
            if (event.type !== 'tool-restriction/selected')
                return;
            ctx.emit('tool-restriction/selected', session.id, event.data.mask);
            const agent = ctx.agents.get(session.id);
            if (agent !== undefined)
                this.applyForAgent(agent);
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
        const applied = this.applies.get(agent);
        if (applied !== undefined)
            this.applyMask(agent, mask);
        agent.session.append('tool-restriction/selected', mask === undefined ? {} : { mask });
        await this.persistPresetPreference(agent, mask);
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
    /** Append the seed mask as the session's own durable selection. */
    materialize(session, mask) {
        session.append('tool-restriction/selected', { mask });
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
        return sections.length === assembly.sections.length
            ? assembly
            : { ...assembly, sections };
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
}
/** Whether the session log already records a mask selection. */
function hasSelection(events) {
    return events.some(event => event.type === 'tool-restriction/selected');
}
export default ToolRestrictionService;
//# sourceMappingURL=index.js.map