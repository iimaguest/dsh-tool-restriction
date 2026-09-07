/**
 * Tool-defaults settings section: one row per preset showing the default tool
 * set new sessions start with, editable as a comma-separated allow-list with a
 * reset to the preset's authored `tools.yml` default. Reads the host
 * `tool-restriction` settings namespace through the shared mirror and writes
 * per-preset overrides through `remote.settings`.
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolDefaultsSettingsState } from './settings-store.ts'
import { presetDisplayText, type ToolDefaultsSettingsKey } from './settings-locales.ts'
import css from './ToolDefaultsSection.module.css'

/** Registration-side business face for the tool-defaults section. */
export interface ToolDefaultsSectionInjected {
  hooks: {
    /** Section snapshot bound by the renderer as useToolDefaultsSection. */
    toolDefaultsSection: SnapshotStore<ToolDefaultsSettingsState>
  }
  /** Read the mirror + roster when the section first renders. */
  load: () => Promise<void>
  /** Clear one preset's saved override (restore the authored default). */
  clearOverride: (presetId: string) => Promise<void>
  /** Set one preset's default allow-list for new sessions. */
  setDefault: (presetId: string, allow: readonly string[]) => Promise<void>
}

/** Full component props. */
export type ToolDefaultsSectionProps =
  PropsRuntime<'settings.section'>
  & PropsLocale<'settings.toolDefaults'>
  & InjectFace<ToolDefaultsSectionInjected>

/** One preset row's editable state. */
interface EditingRow {
  presetId: string
  draft: string
}

/**
 * Render the per-preset tool-defaults section.
 * @param props - composed slot props.
 * @returns the section, or null when the host does not expose the namespace.
 */
export function ToolDefaultsSection({
  load, clearOverride, setDefault, useToolDefaultsSection, t, close,
}: ToolDefaultsSectionProps) {
  const state = useToolDefaultsSection(snapshot => snapshot)
  const [editing, setEditing] = useState<EditingRow | null>(null)
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'unavailable') return null

  const busy = state.status === 'loading' || state.status === 'saving'
  const error = state.status === 'error' ? state.error : null
  const startEdit = (presetId: string, allow: readonly string[]): void => {
    setEditing({ presetId, draft: allow.join(', ') })
  }

  const commitEdit = async (): Promise<void> => {
    if (editing === null) return
    const names = editing.draft.split(',')
      .map(name => name.trim())
      .filter(name => name.length > 0)
    await setDefault(editing.presetId, names)
    setSavedId(editing.presetId)
    setEditing(null)
  }

  const resetRow = async (presetId: string): Promise<void> => {
    await clearOverride(presetId)
    setSavedId(presetId)
  }

  return (
    <div className={css.section}>
      <div className={css.intro}>
        <div className={css.title}>{t('title')}</div>
        <div className={css.desc}>{t('description')}</div>
        {error !== null && <div className={css.error} role="alert">{error}</div>}
      </div>
      {busy && state.rows.length === 0
        ? <div className={css.loading}>{t('loading')}</div>
        : (
          <div className={css.rows}>
            {state.rows.map(row => {
              const text = presetDisplayText(row, t)
              return (
              <div key={row.id} className={css.row}>
                <div className={css.rowText}>
                  <div className={css.rowTitle}>
                    {text.name}
                    <span className={css.overridden}>
                      {row.overridden ? '· ' + t('saved') : ''}
                    </span>
                  </div>
                  {text.description !== undefined && (
                    <div className={css.rowDesc}>{text.description}</div>
                  )}
                  <div className={css.tools}>
                    {editing?.presetId === row.id
                      ? (
                        <input
                          className={css.editInput}
                          value={editing.draft}
                          aria-label={t('toolsAria')}
                          onChange={(event) => {
                            setEditing(current => current === null
                              ? current
                              : { ...current, draft: event.target.value })
                          }}
                          onKeyDown={(event) => {
                            if (event.key === 'Enter') void commitEdit()
                            if (event.key === 'Escape') setEditing(null)
                          }}
                        />
                      )
                      : row.allow.length > 0
                        ? row.allow.join(' · ')
                        : <span className={css.muted}>{t('noDefault')}</span>}
                  </div>
                  {!row.overridden && row.allow.length === 0 && (
                    <div className={css.hint}>{t('presetDefaultHint')}</div>
                  )}
                </div>
                <div className={css.actions}>
                  {editing?.presetId === row.id
                    ? (
                      <>
                        <Button size="small" onClick={() => { void commitEdit() }}>
                          {t('done')}
                        </Button>
                        <Button size="small" variant="secondary" onClick={() => setEditing(null)}>
                          {t('close')}
                        </Button>
                      </>
                    )
                    : (
                      <>
                        <Button
                          size="small"
                          disabled={busy}
                          onClick={() => startEdit(row.id, row.allow)}
                        >
                          {t('edit')}
                        </Button>
                        {row.overridden && (
                          <Button
                            size="small"
                            variant="secondary"
                            disabled={busy}
                            onClick={() => { void resetRow(row.id) }}
                          >
                            {t('clear')}
                          </Button>
                        )}
                      </>
                    )}
                </div>
              </div>
              )
            })}
          </div>
        )}
      {savedId !== null && (
        <div className={css.saved} role="status">{t('saved')}: {savedId}</div>
      )}
    </div>
  )
}

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tool-defaults settings section copy. */
    'settings.toolDefaults': ToolDefaultsSettingsKey
  }
}
