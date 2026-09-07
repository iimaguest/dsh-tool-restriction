/**
 * The per-session tool-mask panel on the new-session (blank) screen, beside
 * the workspace picker and the preset chip.
 *
 * The mask is an allow-list over the session's inherited tool set, and it can
 * only be chosen while the session is blank: once a turn runs, the request
 * prefix (tool block + guidance prose) must stay stable for the KV guarantee,
 * so the host refuses a change. A control that spends most of its life gone
 * belongs on the screen where it still works.
 *
 * The hero stays compact: the board is behind an icon trigger and opens on
 * click, never by default. No selection means unrestricted, and the panel
 * reads "unrestricted" as every checkbox checked: toggling builds the fold
 * from the full board. A hidden hosted tool shown here is an affordance, not
 * a security boundary.
 *
 * State arrives through the host `tool-restriction` session projection (the
 * folded mask, lock flag, and grouped board); writes submit the
 * `/tool-restriction` command line against the calling session — the one
 * write path a web client uses.
 */

import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChecklistOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the hero tool-mask seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ToolRestrictionDescribe } from '../types.ts'
import type { ToolRestrictionKey } from './locales.ts'
import css from './HeroToolRestrictionPanel.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tool-mask panel and header-label copy. */
    'conversation.toolRestriction': ToolRestrictionKey
  }
}

/** Injected face of the `conversation.input.left` tool-mask entry. */
export interface HeroToolRestrictionInjected {
  /** Submit one `/tool-restriction` line against the calling session; resolves whether the host matched it. */
  command: (line: string) => Promise<boolean>
}

/** Full component props. */
export type HeroToolRestrictionPanelProps =
  PropsRuntime<'conversation.input.left'>
  & PropsLocale<'conversation.toolRestriction'>
  & HeroToolRestrictionInjected

/**
 * Render the tool-mask control for the current blank session in the composer
 * tool row: a compact icon trigger that expands to the grouped checkbox board
 * on click. Hidden once a turn starts (the read-only header label takes over).
 * @param props - composed slot props.
 * @returns the trigger, or null while no blank session exists.
 */
export function HeroToolRestrictionPanel({
  useProjection, useSessions, sessionId, command, t,
}: HeroToolRestrictionPanelProps) {
  const state = useProjection('tool-restriction') as ToolRestrictionDescribe | undefined
  const blank = useSessions(snapshot =>
    snapshot.current === undefined ? false : (snapshot.byId[snapshot.current]?.blank === true),
  )
  const [open, setOpen] = useState(false)
  // Per-tool expanded descriptions: a closed row clamps its text to two lines.
  const [expanded, setExpanded] = useState<ReadonlySet<string>>(new Set())

  // A blank session never has a `request/header` yet (no request has run), so
  // the projection starts with an empty board; the picker has nothing to show
  // until the first request assembles tools.
  const groups = state?.groups ?? []
  const locked = state?.locked ?? false
  const current = state?.current

  // The hero goes away once a turn starts: nothing here may offer a change the
  // host would refuse, and the read-only label takes over in the header.
  if (!blank) return null

  const submit = (line: string): void => {
    // `command` closes over the calling session, so only the line is passed.
    void command(line).catch(() => false)
  }

  const checked = (name: string): boolean =>
    current === undefined || current.allow.includes(name)
  const disabled = locked
  const toggleExpanded = (name: string): void => {
    setExpanded((prev) => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  // Flip one tool in the mask. Unrestricted reads as "every board tool
  // checked", so unchecking removes only that name; the new mask is the whole
  // allow-list and the host folds it last-wins.
  const toggle = (name: string, checkedNow: boolean): void => {
    const all = groups.flatMap(group => group.tools).map(tool => tool.name)
    const base = current?.allow ?? all
    const allow = checkedNow
      ? Array.from(new Set([...base, name]))
      : base.filter(entry => entry !== name)
    submit(`/tool-restriction ${JSON.stringify({ allow })}`)
  }

  return (
    <div className={css.anchor}>
      <button
        type="button"
        className={css.trigger}
        aria-label={t('title')}
        title={t('title')}
        aria-expanded={open}
        onClick={() => { setOpen(currentValue => !currentValue) }}
      >
        <IconChecklistOutline14 className={css.titleIcon} />
      </button>
      {open && (
        <div className={css.panel}>
          <div className={css.header}>
            <span className={css.title}>{t('title')}</span>
            <div className={css.actions}>
              <button
                type="button"
                className={css.action}
                disabled={disabled}
                onClick={() => { submit('/tool-restriction all') }}
              >
                {t('selectAll')}
              </button>
              <button
                type="button"
                className={css.action}
                disabled={disabled}
                onClick={() => { submit('/tool-restriction none') }}
              >
                {t('selectNone')}
              </button>
            </div>
          </div>
          {groups.map(group => (
            <div key={group.group} className={css.group}>
              <div className={css.groupName}>{group.group}</div>
              {group.tools.map((tool) => {
                const isExpanded = expanded.has(tool.name)
                return (
                  <label key={tool.name} className={css.row}>
                    <input
                      type="checkbox"
                      className={css.checkbox}
                      checked={checked(tool.name)}
                      disabled={disabled}
                      aria-label={`${t('toolAria')}: ${tool.name}`}
                      onChange={(event) => { toggle(tool.name, event.target.checked) }}
                    />
                    <span className={css.rowText}>
                      <span className={css.toolName}>{tool.name}</span>
                      <span
                        className={isExpanded ? `${css.toolDesc} ${css.toolDescExpanded}` : css.toolDesc}
                        onClick={(event) => { event.preventDefault(); toggleExpanded(tool.name) }}
                        title={isExpanded ? undefined : tool.description}
                      >
                        {tool.description}
                      </span>
                      <button
                        type="button"
                        className={css.descToggle}
                        onClick={(event) => { event.preventDefault(); toggleExpanded(tool.name) }}
                      >
                        {isExpanded ? t('showLess') : t('showMore')}
                      </button>
                    </span>
                  </label>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
