/** Locale bundles for the per-session tool-mask hero panel and header label. */

/** Locale keys these surfaces render. */
export type ToolRestrictionKey =
  | 'title'
  | 'selectAll'
  | 'selectNone'
  | 'presetDefault'
  | 'presetDefaultHint'
  | 'talkOnly'
  | 'allTools'
  | 'labelPrefix'
  | 'loading'
  | 'error'
  | 'toolAria'
  | 'toolStateAria'
  | 'showMore'
  | 'showLess'
  | 'readOnlyHint'

/** English copy. */
export const en: Record<ToolRestrictionKey, string> = {
  title: 'Tools',
  selectAll: 'Select all',
  selectNone: 'Select none',
  presetDefault: 'Preset default',
  presetDefaultHint: 'Restore the preset\'s authored default tool set',
  talkOnly: 'Talk only',
  allTools: 'All tools',
  labelPrefix: 'Tools',
  loading: 'Loading…',
  error: 'Could not load the tool list.',
  toolAria: 'Toggle tool',
  toolStateAria: 'Tool',
  readOnlyHint: 'Read-only — the mask is fixed once the first turn runs',
  showMore: 'Show more',
  showLess: 'Show less',
}

/** Simplified Chinese copy. */
export const zh: Record<ToolRestrictionKey, string> = {
  title: '工具',
  selectAll: '全选',
  selectNone: '全不选',
  presetDefault: '预设默认',
  presetDefaultHint: '恢复预设自带的默认工具集',
  talkOnly: '仅对话',
  allTools: '全部工具',
  labelPrefix: '工具',
  loading: '正在加载…',
  error: '无法加载工具列表。',
  toolAria: '切换工具',
  toolStateAria: '工具',
  readOnlyHint: '只读——首个回合开始后已固定',
  showMore: '展开',
  showLess: '收起',
}
