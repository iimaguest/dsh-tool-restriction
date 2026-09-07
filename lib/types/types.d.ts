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
declare module '@deepseek-ai/dsh-session-projection/types' {
    interface SessionProjectionStateMap {
        /** The folded tool-mask picker state (current, lock, grouped board). */
        'tool-restriction': ToolRestrictionDescribe;
    }
    interface SessionProjectionMap {
        /** The picker's read side, derived from the folded state. */
        'tool-restriction': ToolRestrictionDescribe;
    }
}
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
 * `mask` absent = unrestricted. The `groups` field is display-only seed
 * material (the blank-session picker board) that rides the same known event
 * so a fresh session shows its tool set before the first request folds a
 * `request/header`.
 */
export interface ToolRestrictionSelect {
    /** The selected mask, absent when the session runs unrestricted. */
    mask?: ToolMask;
    /** The blank-session picker board, folded into the projection when present. */
    groups?: readonly ToolRestrictionGroup[];
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
 *
 * `boards` is a derived, read-only view: the per-preset grouped tool board
 * (from each preset's authored `tools.yml`), which the settings section
 * renders as the checkbox picker. It is populated by the host and never a
 * user-writable field — writes target only `byPreset`.
 */
export interface ToolRestrictionSettings {
    /** Default mask for sessions (as a preset seeds none); absent = unrestricted. */
    default?: ToolMask;
    /** Saved override per preset id (`{ allow }`); absent names restore the preset default. */
    byPreset: Record<string, ToolMask>;
    /** Derived per-preset tool board, in the settings section's display order. */
    boards?: Record<string, readonly ToolRestrictionGroup[]>;
}
//# sourceMappingURL=types.d.ts.map