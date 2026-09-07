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
import { readFile, rm } from 'node:fs/promises';
import { join } from 'node:path';
import yaml, { load } from 'js-yaml';
import { writeFileAtomic } from '@deepseek-ai/dsh-atomic-write';
/** The optional tool-board metadata file beside a preset's composition. */
export const TOOLS_FILE = 'tools.yml';
/** A non-empty trimmed string, or undefined for anything else. */
function text(value) {
    if (typeof value !== 'string')
        return undefined;
    const trimmed = value.trim();
    return trimmed === '' ? undefined : trimmed;
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
export async function readPresetTools(directory) {
    let raw;
    try {
        raw = await readFile(join(directory, TOOLS_FILE), 'utf8');
    }
    catch {
        // Absent is the common case: tool boards are optional metadata.
        return undefined;
    }
    let parsed;
    try {
        parsed = load(raw);
    }
    catch {
        return undefined;
    }
    if (typeof parsed !== 'object' || parsed === null || Array.isArray(parsed))
        return undefined;
    const record = parsed;
    const toolNames = (value) => {
        if (!Array.isArray(value))
            return undefined;
        const names = [];
        for (const entry of value) {
            const name = text(entry);
            if (name !== undefined)
                names.push(name);
        }
        return names.length === 0 ? undefined : names;
    };
    const declaredDefault = record['default'];
    const defaultAllow = declaredDefault === undefined
        ? undefined
        : typeof declaredDefault === 'object' && declaredDefault !== null
            && !Array.isArray(declaredDefault)
            ? toolNames(declaredDefault['allow'])
            : undefined;
    const result = {
        ...defaultAllow === undefined
            ? {}
            : { default: { allow: defaultAllow } },
    };
    // "Nothing published" is one answer, whether the file mounted no group
    // assignment or no keys at all: discovery then reports no `tools` field at
    // all, and a broken board is indistinguishable from an absent one.
    const finish = (value) => Object.keys(value).length === 0 ? undefined : value;
    const groupsRecord = record['groups'];
    if (typeof groupsRecord === 'object' && groupsRecord !== null && !Array.isArray(groupsRecord)) {
        const groups = {};
        for (const [name, value] of Object.entries(groupsRecord)) {
            if (name === 'order')
                continue;
            const names = toolNames(value);
            if (names !== undefined)
                groups[name] = names;
        }
        // A present `order` is honoured even with no groups: the picker may map it
        // onto host-declared group names.
        const order = groupsRecord['order'];
        const orderNames = toolNames(order);
        return finish({
            ...result,
            ...Object.keys(groups).length === 0 ? {} : { groups },
            ...orderNames === undefined ? {} : { order: orderNames },
        });
    }
    return finish(result);
}
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
export function renderPresetTools(tools) {
    // An empty group map or order list publishes no board, mirroring the
    // reader's "empty group map = no tool metadata" degradation: nothing to show
    // is stored as no file, not as a file full of empty keys.
    const groups = tools.groups !== undefined && Object.keys(tools.groups).length > 0
        ? tools.groups
        : undefined;
    const order = tools.order !== undefined && tools.order.length > 0 ? tools.order : undefined;
    // `order` is authored INSIDE `groups` — the read side looks for
    // `record.groups.order` — so a top-level `order` would be written and then
    // invisible to discovery. A group literally named "order" is therefore
    // unrepresentable by convention, and render follows the reader on that.
    const groupsRecord = groups === undefined && order === undefined
        ? undefined
        : groups === undefined ? { order }
            : order === undefined ? groups
                : { ...groups, order };
    if (tools.default === undefined && groupsRecord === undefined) {
        return undefined;
    }
    return yaml.dump({
        ...tools.default === undefined ? {} : { default: { allow: [...tools.default.allow] } },
        ...groupsRecord === undefined ? {} : { groups: groupsRecord },
    }, { lineWidth: -1 });
}
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
export async function writePresetTools(directory, tools) {
    const rendered = renderPresetTools(tools);
    const path = join(directory, TOOLS_FILE);
    if (rendered === undefined) {
        await rm(path, { force: true });
        return;
    }
    await writeFileAtomic(path, rendered, { mode: 0o600, dirMode: 0o700 });
}
//# sourceMappingURL=tools.js.map