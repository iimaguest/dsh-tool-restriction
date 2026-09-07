/**
 * Pure types of the tool-restriction domain: the per-session mask, its wire
 * projection, and the per-preset settings document. Free of this package's
 * host-side value imports (cordis, schemastery) so it can be consumed by the
 * wire contract and the browser surface without pulling the runtime. The
 * appended `Events` merge is type-only and is what makes the committed
 * selection a forwardable Host event (`ctx.remote.$on` key face).
 *
 * @module @deepseek-ai/dsh-tool-restriction/types
 */
import type { SessionId } from '@deepseek-ai/dsh-session/types';
declare module '@deepseek-ai/cordis' {
    interface Events {
        /**
         * One session committed a tool mask to its durable log. Consumers
         * invalidate only state derived from that session's mask.
         * @mode emit
         * @param sessionId - the session whose mask changed.
         * @param mask - the committed mask, or undefined for unrestricted.
         */
        'tool-restriction/selected'(sessionId: SessionId, mask: ToolMask | undefined): void;
    }
}
/**
 * One tool mask: an allow-list over the session's inherited tool set. An
 * absent mask means unrestricted; a present-but-empty `allow` is the
 * deliberate talk-only spelling (the loop then omits the `tools` field).
 */
export interface ToolMask {
    /** Tool names the session may use; everything inherited beyond them is masked. */
    readonly allow: readonly string[];
}
/**
 * The wire shape of the durable selection and the projection unit: the
 * event payload (`{ mask }`) and the `toolRestriction.describe` answer.
 * `mask` absent = unrestricted.
 */
export interface ToolRestrictionSelect {
    /** The selected mask, absent when the session runs unrestricted. */
    mask?: ToolMask;
}
/** One tool listed under a group in the picker projection. */
export interface ToolRestrictionTool {
    /** The tool name as registered. */
    name: string;
    /** The model-facing description. */
    description: string;
}
/** One named column of the picker projection, in display order. */
export interface ToolRestrictionGroup {
    /** The group's display name; ungrouped tools land under `Other`. */
    group: string;
    /** The visible tools in this group, in registry order. */
    tools: readonly ToolRestrictionTool[];
}
/** The wire projection a picker renders: current mask, lock state, groups. */
export interface ToolRestrictionDescribe {
    /** The effective inherited set restriction, absent when unrestricted. */
    current?: ToolMask;
    /** True once the session's first turn has run — the mask is fixed forever. */
    locked: boolean;
    /** The visible step-0 tool set as grouped rows. */
    groups: readonly ToolRestrictionGroup[];
}
/**
 * The file-backed `tool-restriction` settings section: a deployment default
 * plus one saved mask per preset id. `byPreset` is what survives a server
 * restart when the blank session that made the choice was discarded.
 */
export interface ToolRestrictionSettings {
    /** Default mask for sessions (as a preset seeds none); absent = unrestricted. */
    default?: ToolMask;
    /** Saved override per preset id (`{ allow }`); absent names restore the preset default. */
    byPreset: Record<string, ToolMask>;
}
//# sourceMappingURL=types.d.ts.map