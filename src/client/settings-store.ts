/**
 * Tool-defaults settings controller (the escalation settings row's pattern,
 * on the `tool-restriction` namespace): the descriptor comes from the shared
 * describe mirror; writes target only one preset's saved override and carry
 * the descriptor revision. The roster comes from the agent-presets remote so
 * the section can show every preset's default tool list.
 */

import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SettingsNamespaceView } from '@deepseek-ai/dsh-api-remotes/client'
import {
  createSnapshotStore, type SnapshotStore,
} from '@deepseek-ai/dsh-client-store'
import type {
  SettingsDescribeFace, SettingsSchemaService,
} from '@deepseek-ai/dsh-client-ui-settings/client'
import type { ToolRestrictionGroup } from '../types.ts'

/** Tool-restriction's settings namespace on the host wire. */
export const TOOL_RESTRICTION_SETTINGS_NS = 'tool-restriction'

/** One preset's default tool mask as the settings section shows it. */
export interface PresetToolDefaultRow {
  /** Preset id. */
  id: string
  /** Whether the deployment ships the preset or the user owns it. */
  trust: 'system' | 'user'
  /** Preset display name (falls back to the id). */
  name: string
  /** One-line description, when the preset published one. */
  description?: string
  /** The effective default allow-list for new sessions on this preset. */
  allow: readonly string[]
  /** True when an explicit saved override is in force (vs the authored default). */
  overridden: boolean
  /** The grouped tool board the settings section renders as checkboxes. */
  board: readonly ToolRestrictionGroup[]
  /** The preset's authored `tools.yml` default, when published. */
  authored?: readonly string[]
}

/** Tool-defaults settings-section snapshot. */
export interface ToolDefaultsSettingsState {
  status: 'idle' | 'loading' | 'ready' | 'saving' | 'unavailable' | 'error'
  error: string | null
  writable: boolean
  rows: readonly PresetToolDefaultRow[]
  revision: number
}

/**
 * Read the `byPreset` saved overrides from the host namespace descriptor.
 * @param view - tool-restriction namespace descriptor.
 * @returns the saved override per preset id, or undefined when absent.
 */
export function savedOverridesOf(view: SettingsNamespaceView): Record<string, { allow: readonly string[] }> {
  const byPreset = (view.value as { byPreset?: Record<string, { allow?: unknown }> } | null)?.byPreset
  if (byPreset === undefined || typeof byPreset !== 'object' || byPreset === null) return {}
  const result: Record<string, { allow: readonly string[] }> = {}
  for (const [id, entry] of Object.entries(byPreset)) {
    const allow = entry?.allow
    if (Array.isArray(allow) && allow.every(name => typeof name === 'string')) {
      result[id] = { allow: allow as string[] }
    }
  }
  return result
}

/**
 * Read one preset's composed board the host seeds into the namespace. Each
 * preset gets its own board (its composed tool set — minimal is two tools,
 * standard is the full set, a user preset carries its own extras), with a
 * shared `default` board as the fallback while the host has not seeded the
 * preset specifically.
 * @param view - tool-restriction namespace descriptor.
 * @param presetId - the preset whose board to read.
 * @returns the grouped board, or empty when the host has not seeded one.
 */
export function boardOf(view: SettingsNamespaceView, presetId: string): readonly ToolRestrictionGroup[] {
  const boards = (view.value as { boards?: Record<string, unknown> } | null)?.boards
  const board = boards?.[presetId] ?? boards?.['default']
  if (!Array.isArray(board)) return []
  return board.filter((group): group is ToolRestrictionGroup =>
    typeof group === 'object' && group !== null
      && typeof (group as { group?: unknown }).group === 'string'
      && Array.isArray((group as { tools?: unknown }).tools))
}

/** Controller deriving the section from the shared mirror and the roster. */
export class ToolDefaultsSettingsController {
  /** Section snapshot consumed through a bound selector hook. */
  readonly store: SnapshotStore<ToolDefaultsSettingsState> = createSnapshotStore({
    status: 'idle',
    error: null,
    writable: false,
    rows: [],
    revision: 0,
  })

  private following: (() => void) | undefined
  private saving = false
  private disposed = false
  /** Preset display metadata (id → trust/name/description) loaded from the roster. */
  private presets = new Map<string, { trust: 'system' | 'user'; name: string; description?: string }>()

  /**
   * @param describeFace - the shared mirror's read/fold face.
   * @param ctx - the section plugin's context, whose `remote.settings`
   * namespace carries the writes and `remote.agentPresets` the roster.
   * @param schema - settings-owned schema operations.
   */
  constructor(
    private readonly describeFace: SettingsDescribeFace,
    private readonly ctx: ClientContext,
    private readonly schema: SettingsSchemaService,
  ) {}

  /**
   * Begin following the mirror (idempotent), load the preset roster, and
   * reflect the combined answer.
   * @returns settlement once the snapshot reflects the mirror.
   */
  async load(): Promise<void> {
    if (this.disposed) return
    this.following ??= this.describeFace.subscribe(() => { this.derive() })
    this.store.update((state) => {
      state.status = 'loading'
      state.error = null
    })
    await Promise.all([this.describeFace.ensure(), this.loadRoster()])
    this.derive()
  }

  /**
   * Clear one preset's saved override so new sessions use the preset's
   * authored `tools.yml` default (or unrestricted when none is published).
   * @param presetId - the preset whose override to clear.
   * @returns nothing; {@link store} carries success or failure.
   */
  async clearOverride(presetId: string): Promise<void> {
    const state = this.store.getSnapshot()
    const view = this.describeFace.getSnapshot().view?.namespaces
      .find(entry => entry.ns === TOOL_RESTRICTION_SETTINGS_NS)
    if (view === undefined || !state.writable || this.saving) return
    this.saving = true
    this.store.update((draft) => {
      draft.status = 'saving'
      draft.error = null
    })
    let response
    try {
      response = await this.ctx.remote.settings.mutate(
        TOOL_RESTRICTION_SETTINGS_NS,
        [{ op: 'unset', path: ['byPreset', presetId] }],
        view.revision,
      )
    } finally {
      this.saving = false
    }
    if (this.disposed) return
    if (!response.ok) {
      this.fail(response.error)
      return
    }
    this.describeFace.acceptView(response.value)
  }

  /**
   * Set one preset's saved default allow-list for new sessions.
   * @param presetId - the preset whose default to set.
   * @param allow - the default tool allow-list.
   * @returns nothing; {@link store} carries success or failure.
   */
  async setDefault(presetId: string, allow: readonly string[]): Promise<void> {
    const state = this.store.getSnapshot()
    const view = this.describeFace.getSnapshot().view?.namespaces
      .find(entry => entry.ns === TOOL_RESTRICTION_SETTINGS_NS)
    if (view === undefined || !state.writable || this.saving) return
    this.saving = true
    this.store.update((draft) => {
      draft.status = 'saving'
      draft.error = null
    })
    let response
    try {
      response = await this.ctx.remote.settings.mutate(
        TOOL_RESTRICTION_SETTINGS_NS,
        [{ op: 'set', path: ['byPreset', presetId], value: { allow: [...allow] } }],
        view.revision,
      )
    } finally {
      this.saving = false
    }
    if (this.disposed) return
    if (!response.ok) {
      this.fail(response.error)
      return
    }
    this.describeFace.acceptView(response.value)
  }

  /** Stop following the mirror; later publishes leave the snapshot alone. */
  dispose(): void {
    this.disposed = true
    this.following?.()
    this.following = undefined
  }

  private async loadRoster(): Promise<void> {
    try {
      const result = await this.ctx.remote.agentPresets.list()
      // Remote calls resolve as `{ ok, value }`; only the value carries the roster.
      const presets = result.ok === true
        ? result.value.presets
        : undefined
      this.presets = new Map((presets ?? []).map(preset => [
        preset.id,
        {
          trust: preset.trust,
          name: preset.name ?? preset.id,
          ...preset.description === undefined ? {} : { description: preset.description },
        },
      ]))
    } catch {
      // Roster failure degrades rows to bare ids; the section still shows the
      // saved overrides it can read from the mirror.
      this.presets = new Map()
    }
  }

  private derive(): void {
    if (this.disposed || this.saving) return
    const mirrored = this.describeFace.getSnapshot()
    if (mirrored.status === 'unavailable') {
      this.store.update((state) => {
        state.status = 'unavailable'
        state.writable = false
        state.rows = []
      })
      return
    }
    if (mirrored.view === undefined) {
      if (mirrored.error !== null) this.fail(new Error(mirrored.error))
      return
    }
    const view = mirrored.view.namespaces.find(entry => entry.ns === TOOL_RESTRICTION_SETTINGS_NS)
    if (view === undefined) {
      this.store.update((state) => {
        state.status = 'unavailable'
        state.writable = false
        state.rows = []
      })
      return
    }
    const overrides = savedOverridesOf(view)
    const rows: PresetToolDefaultRow[] = [...this.presets.entries()].map(([id, meta]) => {
      const override = overrides[id]
      return {
        id,
        trust: meta.trust,
        name: meta.name,
        ...meta.description === undefined ? {} : { description: meta.description },
        allow: override?.allow ?? [],
        overridden: override !== undefined,
        board: boardOf(view, id),
      }
    })
    this.store.update((state) => {
      state.status = 'ready'
      state.error = null
      state.writable = mirrored.view?.writable === true
      state.rows = rows
      state.revision = view.revision
    })
  }

  private fail(error: unknown): void {
    this.store.update((state) => {
      state.status = 'error'
      state.error = error instanceof Error ? error.message : String(error)
    })
  }
}
