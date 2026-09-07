/**
 * Tool-defaults settings section: one row per preset showing the default tool
 * set new sessions start with. Each row renders the shared deployment tool
 * board (grouped, with descriptions) as a checkbox picker — the same surface
 * the blank-session composer shows — and editing toggles the default allow
 * list directly. Reads the host `tool-restriction` settings namespace through
 * the shared mirror and writes per-preset overrides through `remote.settings`.
 */

import { useEffect, useState } from 'react'
import type { SnapshotStore } from '@deepseek-ai/dsh-client-store'
import type { InjectFace, PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { Button } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ToolDefaultsSettingsState, PresetToolDefaultRow } from './settings-store.ts'
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

/** One preset row's in-progress edit: the draft allow-list being toggled. */
interface EditingRow {
  presetId: string
  allow: string[]
}

/** One preset row's per-tool expanded descriptions. */
const EMPTY_EXPANDED: ReadonlySet<string> = new Set()

/**
 * Render the per-preset tool-defaults section as a grouped checkbox board.
 * @param props - composed slot props.
 * @returns the section, or null when the host does not expose the namespace.
 */
export function ToolDefaultsSection({
  load, clearOverride, setDefault, useToolDefaultsSection, t,
}: ToolDefaultsSectionProps) {
  const state = useToolDefaultsSection(snapshot => snapshot)
  const [editing, setEditing] = useState<EditingRow | null>(null)
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(EMPTY_EXPANDED)
  const [savedId, setSavedId] = useState<string | null>(null)

  useEffect(() => {
    void load()
  }, [load])

  if (state.status === 'unavailable') return null

  const busy = state.status === 'loading' || state.status === 'saving'
  const error = state.status === 'error' ? state.error : null

  const toggleExpanded = (name: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  const toggleTool = (presetId: string, name: string, checked: boolean): void => {
    setEditing(current => {
      if (current === null || current.presetId !== presetId) return current
      const next = checked
        ? Array.from(new Set([...current.allow, name]))
        : current.allow.filter(entry => entry !== name)
      return { ...current, allow: next }
    })
  }

  const commitEdit = async (): Promise<void> => {
    if (editing === null) return
    await setDefault(editing.presetId, editing.allow)
    setSavedId(editing.presetId)
    setEditing(null)
  }

  const resetRow = async (presetId: string): Promise<void> => {
    await clearOverride(presetId)
    setSavedId(presetId)
    setEditing(null)
  }

  const renderBoard = (
    row: PresetToolDefaultRow,
    checked: ReadonlySet<string>,
    applyDraft: (allow: string[]) => void,
    onToggle: (name: string, checked: boolean) => void,
  ): JSX.Element => (
    <div className={css.board}>
      <div className={css.boardHeader}>
        <div className={css.boardActions}>
          <button
            type="button"
            className={css.action}
            disabled={busy}
            onClick={() => {
              const all = row.board.flatMap(group => group.tools).map(tool => tool.name)
              applyDraft(all)
            }}
          >
            {t('selectAll')}
          </button>
          <button
            type="button"
            className={css.action}
            disabled={busy}
            onClick={() => { applyDraft([]) }}
          >
            {t('selectNone')}
          </button>
        </div>
      </div>
      {row.board.map(group => (
        <div key={group.group} className={css.group}>
          <div className={css.groupName}>{group.group}</div>
          {group.tools.map((tool) => {
            const isExpanded = expanded.has(tool.name)
            return (
              <label key={tool.name} className={css.toolRow}>
                <input
                  type="checkbox"
                  className={css.checkbox}
                  checked={checked.has(tool.name)}
                  disabled={busy}
                  aria-label={`${t('toolAria')}: ${tool.name}`}
                  onChange={(event) => { onToggle(tool.name, event.target.checked) }}
                />
                <span className={css.rowText}>
                  <span className={css.toolName}>{tool.name}</span>
                  {tool.description !== '' && (
                    <span
                      className={isExpanded ? `${css.toolDesc} ${css.toolDescExpanded}` : css.toolDesc}
                      onClick={(event) => { event.preventDefault(); toggleExpanded(tool.name) }}
                      title={isExpanded ? undefined : tool.description}
                    >
                      {tool.description}
                    </span>
                  )}
                  {tool.description !== '' && (
                    <button
                      type="button"
                      className={css.descToggle}
                      onClick={(event) => { event.preventDefault(); toggleExpanded(tool.name) }}
                    >
                      {isExpanded ? t('showLess') : t('showMore')}
                    </button>
                  )}
                </span>
              </label>
            )
          })}
        </div>
      ))}
      {row.board.length === 0 && (
        <div className={css.hint}>{t('noDefault')}</div>
      )}
    </div>
  )

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
              const isEditing = editing?.presetId === row.id
              const checked = new Set(isEditing ? editing.allow : row.allow)
              const applyDraft = (allow: string[]): void => {
                setEditing({ presetId: row.id, allow })
              }
              const onToggle = (name: string, value: boolean): void => {
                if (isEditing) {
                  toggleTool(row.id, name, value)
                } else {
                  // First toggle enters edit mode with the resulting allow list.
                  const next = value
                    ? Array.from(new Set([...row.allow, name]))
                    : row.allow.filter(entry => entry !== name)
                  setEditing({ presetId: row.id, allow: next })
                }
              }
              return (
                <div key={row.id} className={css.row}>
                  <div className={css.rowHeader}>
                    <div className={css.rowTitle}>
                      {text.name}
                      <span className={css.overridden}>
                        {row.overridden ? '· ' + t('saved') : ''}
                      </span>
                    </div>
                    {text.description !== undefined && (
                      <div className={css.rowDesc}>{text.description}</div>
                    )}
                    <div className={css.rowActions}>
                      {isEditing ? (
                        <>
                          <Button size="small" onClick={() => { void commitEdit() }}>
                            {t('done')}
                          </Button>
                          <Button size="small" variant="secondary" onClick={() => setEditing(null)}>
                            {t('close')}
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button
                            size="small"
                            disabled={busy}
                            onClick={() => setEditing({ presetId: row.id, allow: [...row.allow] })}
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
                  {renderBoard(row, checked, applyDraft, onToggle)}
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
