/**
 * Per-session tool-mask surface plugin, browser half — two surfaces over one
 * projected state: a grouped checkbox panel on the new-session (blank) screen,
 * and a read-only label in the session header.
 *
 * The mask is fixed once a turn starts (the host refuses a change, because the
 * request prefix must stay stable for the KV guarantee). That is what splits
 * the control from the display: the hero panel is before-the-fact and unmounts
 * when the blank session starts, while the header only reports the fold the
 * session already runs.
 *
 * The picker sits in the composer tool row (`conversation.input.left`) and
 * shows only while the session is blank; once a turn runs it hides and the
 * read-only header label (`conversation.session.header.actions`) takes over.
 * Both read the host `tool-restriction` session projection (folded mask, lock
 * flag, and grouped tool board) reactively and submit the `/tool-restriction`
 * command line for writes — the one write path a web client uses.
 *
 * A settings section (`settings.section`) shows the per-preset default tool
 * list for new sessions, read from the host `tool-restriction` settings
 * namespace and editable per preset.
 */
import type { Context as ClientContext } from '@deepseek-ai/cordis'
import type { SessionId } from '@deepseek-ai/dsh-session/types'
// Type-only: pulls the Session Controller service used to submit command lines.
import type {} from '@deepseek-ai/dsh-api-session-controller/client'
// Type-only: pulls the conversation slot types.
import type {} from '@deepseek-ai/dsh-client-ui-conversation/client'
// Type-only: pulls the locale plugin's Context merge (ctx.locale).
import type {} from '@deepseek-ai/dsh-client-locale/client'
// Type-only: pulls the renderer-owned slots service.
import type {} from '@deepseek-ai/dsh-client-ui-renderer/client'
// Type-only: pulls the Session standard useProjection seat.
import type {} from '@deepseek-ai/dsh-client-ui-session/client'
// Type-only: pulls the settings slot types (this package registers a section).
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
import { HeroToolRestrictionPanel } from './HeroToolRestrictionPanel.tsx'
import { ToolRestrictionLabel } from './ToolRestrictionLabel.tsx'
import { ToolDefaultsSection, type ToolDefaultsSectionInjected } from './ToolDefaultsSection.tsx'
import { ToolDefaultsSettingsController } from './settings-store.ts'
import { settingsEn, settingsZh, type ToolDefaultsSettingsKey } from './settings-locales.ts'
import { en, zh, type ToolRestrictionKey } from './locales.ts'

export { HeroToolRestrictionPanel } from './HeroToolRestrictionPanel.tsx'
export type { HeroToolRestrictionPanelProps, HeroToolRestrictionInjected } from './HeroToolRestrictionPanel.tsx'
export { ToolRestrictionLabel } from './ToolRestrictionLabel.tsx'
export type { ToolRestrictionLabelProps } from './ToolRestrictionLabel.tsx'
export { ToolDefaultsSection } from './ToolDefaultsSection.tsx'
export type { ToolDefaultsSectionProps, ToolDefaultsSectionInjected } from './ToolDefaultsSection.tsx'
export type { ToolRestrictionKey } from './locales.ts'
export type { ToolDefaultsSettingsKey } from './settings-locales.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Tool-mask panel and header-label copy. */
    'conversation.toolRestriction': ToolRestrictionKey
    /** Tool-defaults settings section copy. */
    'settings.toolDefaults': ToolDefaultsSettingsKey
  }
}

/** Dictionary namespace owned by this plugin. */
const NS = 'conversation.toolRestriction'
/** Settings section namespace owned by this plugin. */
const SETTINGS_NS = 'settings.toolDefaults'

/** Required services (cordis fiber inject). */
export const inject = [
  'slots', 'sessions', 'locale', 'remote', 'remote.agentPresets', 'remote.settings',
  'settingsScope', 'settingsSchema',
]

/**
 * Mount the tool-mask hero panel and the session-header label.
 * @param ctx - the browser plugin context.
 */
export function apply(ctx: ClientContext): void {
  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-tool-restriction: dictionaries')
  ctx.effect(() => ctx.locale.register(SETTINGS_NS, { zh: settingsZh, en: settingsEn }), 'ui-tool-restriction: settings dictionaries')

  const sessions = ctx.sessions

  ctx.slots.inject('conversation.input.left', () => ctx.slots.register({
    name: 'conversation.input.left',
    id: 'tool-restriction',
    order: -1,
    locale: NS,
    inject: (sessionId: SessionId): { command: (line: string) => Promise<boolean> } => ({
      command: async (line) => {
        const face = sessions.binding(sessionId)?.session
        if (face === undefined) return false
        const result = await face.command(line)
        return result.ok === true && result.value?.matched === true
      },
    }),
  }, HeroToolRestrictionPanel))

  ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
    name: 'conversation.session.header.actions',
    id: 'tool-restriction',
    // Static session context occupies the header's leading negative-order band,
    // beside the agent-preset chip at -10.
    order: -9,
    locale: NS,
  }, ToolRestrictionLabel))

  // The shared SettingsScope mirror for the per-preset default tool lists.
  const controller = new ToolDefaultsSettingsController(
    ctx.settingsScope.describe(), ctx, ctx.settingsSchema)
  const load = (): Promise<void> => controller.load()
  const clearOverride = (presetId: string): Promise<void> => controller.clearOverride(presetId)
  const setDefault = (presetId: string, allow: readonly string[]): Promise<void> =>
    controller.setDefault(presetId, allow)
  const sectionInjected = (): ToolDefaultsSectionInjected => ({
    hooks: { toolDefaultsSection: controller.store },
    load,
    clearOverride,
    setDefault,
  })

  ctx.effect(() => () => { controller.dispose() }, 'ui-tool-restriction: settings section directory')

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'tool-defaults',
    order: 25,
    label: () => ctx.locale.bind(SETTINGS_NS)('nav'),
    locale: SETTINGS_NS,
    inject: sectionInjected,
  }, ToolDefaultsSection))
}
