/**
 * A preset's tool-board metadata: the default tool mask and the displayed
 * group assignments for the session tool-restriction picker. Like `preset.yml`,
 * it is display/seed data beside the composition, never part of what the
 * Loader mounts.
 *
 * An absent or malformed file yields no tool metadata — the preset then
 * composes unrestricted (the mask is absent and group columns fall back to the
 * host `group` field / an `Other` bucket). A broken `tools.yml` must never
 * fail discovery or a mount: the tool board is a picker preference, not a
 * capability, and the composition file alone decides whether a preset mounts.
 * @module @deepseek-ai/dsh-agent-presets/tools
 */
/** The optional tool-board metadata file beside a preset's composition. */
export declare const TOOLS_FILE = "tools.yml";
/** A preset's authored default tool mask. */
export interface PresetToolDefault {
    /** Tool names the session may inherit; absent means unrestricted. */
    readonly allow: readonly string[];
}
/** Group → tool-name assignments in declaration order, plus a display order. */
export interface PresetTools {
    /**
     * The mask seeded into a new session on this preset, before the user's
     * saved per-preset override. Absent (or a missing `default` key) means the
     * session inherits the preset's whole tool board un-masked.
     */
    readonly default?: PresetToolDefault;
    /**
     * Group assignments: group display name → tool names. The reserved `order`
     * key (when present) lists the group display order; groups absent from it
     * sort after ordered ones by name. An ungrouped or host-declared `group`
     * column is a presentation concern resolved by the surface, not here.
     */
    readonly groups?: Record<string, readonly string[]>;
    /** Display order of named groups; groups absent here sort after ordered ones by name. */
    readonly order?: readonly string[];
}
/**
 * Read one preset directory's tool-board metadata.
 *
 * Absent and unreadable files and wrongly-shaped documents are all the same
 * answer — no tool metadata — because tool grouping is presentation and a
 * broken file must not fail a session start. Healing the file restores the
 * board on the next read.
 * @param directory - the preset directory.
 * @returns the declared tool board, or undefined when none is published.
 */
export declare function readPresetTools(directory: string): Promise<PresetTools | undefined>;
/**
 * Render tool-board metadata as the file's contents.
 *
 * Absent fields are omitted rather than written empty, so a preset publishing
 * a default but no groups does not ship a file full of empty keys. A
 * {@link PresetTools} with nothing to publish renders undefined; the writer
 * treats that as "remove the file" so the preset reads as publishing no tool
 * metadata at all. `groups` and `order` ride along verbatim, so a writer that
 * only changes `default` never drops a hand-authored board layout.
 * @param tools - the tool board to store.
 * @returns the YAML document, or undefined when there is nothing to store.
 */
export declare function renderPresetTools(tools: PresetTools): string | undefined;
/**
 * Write tool-board metadata to a preset directory.
 *
 * The reverse of {@link readPresetTools}: an absent `default` means the preset
 * publishes no default mask (unrestricted), and a `PresetTools` with nothing
 * to publish removes the file entirely so the next read reports no tool
 * metadata. Written atomically with owner-only modes, matching the metadata
 * file beside it.
 * @param directory - the preset directory.
 * @param tools - the tool board to store.
 */
export declare function writePresetTools(directory: string, tools: PresetTools): Promise<void>;
//# sourceMappingURL=tools.d.ts.map