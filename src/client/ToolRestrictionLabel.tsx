/**
 * The read-only session-header label: a pill beside the session title that
 * reports the mask this session runs and opens a read-only view of the full
 * composed board.
 *
 * Once a turn runs the hero panel unmounts and this label takes its place,
 * reading the fold the host already projected onto the session summary. It
 * covers the locked case the hero can no longer present: unrestricted reads
 * as every composed tool checked, and nothing here ever offers an edit.
 */

import { useEffect, useState } from 'react'
import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { IconChecklistOutline14 } from '@deepseek-ai/dsh-client-ui-primitives'
// Type-only: pulls the ui-conversation SlotMap merge (the header actions seat).
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
import type { ToolRestrictionDescribe } from '../types.ts'
import type { ToolRestrictionKey } from './locales.ts'
import css from './ToolRestrictionLabel.module.css'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tool-mask panel and header-label copy. */
    'conversation.toolRestriction': ToolRestrictionKey
  }
}

/** Full component props. */
export type ToolRestrictionLabelProps =
  PropsRuntime<'conversation.session.header.actions'>
  & PropsLocale<'conversation.toolRestriction'>

/**
 * Render this session's tool mask beside its title; the pill opens a
 * read-only view of the full composed board.
 * @param props - composed slot props.
 * @returns the label, or null while the mask is unresolved.
 */
export function ToolRestrictionLabel({ useProjection, t }: ToolRestrictionLabelProps) {
  const state = useProjection('tool-restriction') as ToolRestrictionDescribe | undefined
  const [open, setOpen] = useState(false)

  // The board persists across in-run updates — a run step scrolls the
  // conversation, and dismissing on any scroll is the blinking-closed bug the
  // sibling # subagents / # background jobs menus do not have. It is
  // absolutely anchored, so it scrolls with the conversation and needs no
  // re-positioning. Only an outside click or Escape dismisses.
  useEffect(() => {
    if (!open) return
    const close = (): void => setOpen(false)
    const onKeyDown = (event: KeyboardEvent): void => { if (event.key === 'Escape') close() }
    const onPointerDown = (event: PointerEvent): void => {
      if (event.target instanceof Element && event.target.closest('[data-tr-anchor]') === null) close()
    }
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('pointerdown', onPointerDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('pointerdown', onPointerDown)
    }
  }, [open])

  // The pill must STAY PUT beside the mode-name and count chips: once the
  // board has resolved, keep rendering through projection updates. Hiding it
  // again would only ever subtract information.
  const groups = state?.groups ?? []
  if (groups.length === 0) return null

  const mask = state?.current
  const text = mask === undefined
    ? t('allTools')
    : mask.allow.length === 0
      ? t('talkOnly')
      : `${t('labelPrefix')}: ${mask.allow.join(' · ')}`

  // The board reports the fold the session already runs: unrestricted reads
  // as every composed tool checked, mirroring the hero panel, so opening the
  // label shows exactly what was enabled and disabled at the start of the
  // session without ever offering an edit.
  const enabled = (name: string): boolean =>
    mask === undefined || mask.allow.includes(name)

  const toggle = (): void => setOpen(current => !current)

  const onToggleKeyDown = (event: ReactKeyboardEvent<HTMLButtonElement>): void => {
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault()
      toggle()
    }
  }

  return (
    <div className={css.anchor} data-tr-anchor>
      <button
        type="button"
        className={css.label}
        title={text}
        aria-expanded={open}
        aria-haspopup="dialog"
        onClick={toggle}
        onKeyDown={onToggleKeyDown}
      >
        <IconChecklistOutline14 className={css.icon} />
        <span className={css.text}>{text}</span>
      </button>
      {open && (
        <div className={css.board}>
          <div className={css.boardTitle}>{t('title')}</div>
          <div className={css.boardHint}>{t('readOnlyHint')}</div>
          {groups.map(group => (
            <div key={group.group} className={css.group}>
              <div className={css.groupName}>{group.group}</div>
              {group.tools.map((tool) => {
                const isEnabled = enabled(tool.name)
                return (
                  <div key={tool.name} className={css.row}>
                    <span className={css.rowText}>
                      <span className={css.toolName}>{tool.name}</span>
                      <span className={css.toolDesc} title={tool.description}>{tool.description}</span>
                    </span>
                    <span className={isEnabled ? css.stateOn : css.stateOff} aria-label={`${t('toolStateAria')}: ${tool.name}`}>
                      {isEnabled ? '✓' : '✕'}
                    </span>
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
