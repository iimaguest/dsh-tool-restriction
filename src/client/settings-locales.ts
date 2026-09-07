/** Locale bundles for the tool-defaults settings section. */

/**
 * Built-in preset copy keys, resolved for shipped presets like the shared
 * agent-preset surfaces do (standard/ptc/minimal/cordis translate through the
 * active locale; user-authored presets show their own file metadata).
 */
export type BuiltInPresetCopyKey =
  | 'presetStandardName' | 'presetStandardDescription'
  | 'presetPtcName' | 'presetPtcDescription'
  | 'presetMinimalName' | 'presetMinimalDescription'
  | 'presetCordisName' | 'presetCordisDescription'

/** Locale keys the settings section renders. */
export type ToolDefaultsSettingsKey = BuiltInPresetCopyKey
  | 'nav'
  | 'title'
  | 'description'
  | 'loading'
  | 'unavailable'
  | 'error'
  | 'saved'
  | 'default'
  | 'noDefault'
  | 'clear'
  | 'clearing'
  | 'edit'
  | 'done'
  | 'toolsAria'
  | 'presetDefaultHint'
  | 'close'

/** English copy. */
export const settingsEn: Record<ToolDefaultsSettingsKey, string> = {
  nav: 'Tool defaults',
  title: 'Tool defaults per preset',
  description: 'Choose the default tool set new sessions start with on each preset. An override set here wins over the preset\u2019s authored tools.yml default.',
  loading: 'Loading…',
  unavailable: 'Tool defaults are not available in this deployment.',
  error: 'Could not load or save tool defaults.',
  saved: 'Saved',
  default: 'Preset default',
  noDefault: 'No default (all composed tools)',
  clear: 'Reset to preset default',
  clearing: 'Resetting…',
  edit: 'Edit',
  done: 'Done',
  toolsAria: 'Default tools',
  presetDefaultHint: 'The preset\u2019s authored tools.yml default, unless you set an override below.',
  close: 'Close',
  presetStandardName: 'Standard mode',
  presetStandardDescription:
    'Full coding agent with file editing, shell, file and web search, skills, planning, goals, subagents, and workflows.',
  presetPtcName: 'PTC mode',
  presetPtcDescription:
    'Full coding agent without the workflow tool; other tools are exposed through the PTC mode SDK so the model can combine multi-step operations in one TypeScript program.',
  presetMinimalName: 'Minimal mode',
  presetMinimalDescription:
    'Two-tool coding agent with persistent bash and str_replace_editor.',
  presetCordisName: 'Creator mode',
  presetCordisDescription:
    'Built for creating custom agent presets, with all Standard mode capabilities plus runtime inspection, plugin experiments, and preset-authoring guidance.',
}

/** Simplified Chinese copy. */
export const settingsZh: Record<ToolDefaultsSettingsKey, string> = {
  nav: '工具默认值',
  title: '各预设的工具默认值',
  description: '选择每个预设下新会话默认使用的工具集。此处设置的覆盖项优先于预设自带的 tools.yml 默认值。',
  loading: '正在加载…',
  unavailable: '此部署未提供工具默认值。',
  error: '无法加载或保存工具默认值。',
  saved: '已保存',
  default: '预设默认',
  noDefault: '无默认（使用全部已组合工具）',
  clear: '重置为预设默认',
  clearing: '正在重置…',
  edit: '编辑',
  done: '完成',
  toolsAria: '默认工具',
  presetDefaultHint: '预设自带的 tools.yml 默认值；除非你在下方设置了覆盖项。',
  close: '关闭',
  presetStandardName: '标准模式',
  presetStandardDescription: '功能完整的编码 Agent，支持文件编辑、Shell、文件与网页检索、Skills、计划、目标、子代理和工作流。',
  presetPtcName: 'PTC 模式',
  presetPtcDescription: '功能完整的编码 Agent，但默认不提供 workflow 工具；其他工具通过 PTC 模式 SDK 呈现，让模型用一个 TypeScript 程序组合多步操作。',
  presetMinimalName: '极简模式',
  presetMinimalDescription: '仅提供持久 bash 与 str_replace_editor 的双工具编码 Agent。',
  presetCordisName: '创造模式',
  presetCordisDescription: '用于创建自定义 Agent preset：具备标准模式的全部能力，并提供运行时检查、插件实验和 preset 创作指导。',
}

/** Preset roster fields the section needs to resolve display copy. */
export interface PresetDisplaySource {
  /** Stable preset id. */
  readonly id: string
  /** Whether the deployment ships the preset or the user owns it. */
  readonly trust: 'system' | 'user'
  /** Unlocalized name published by the preset. */
  readonly name?: string
  /** Unlocalized description published by the preset. */
  readonly description?: string
}

/** Display copy resolved for the active locale. */
export interface PresetDisplayText {
  /** Localized built-in name or the preset's own fallback name. */
  readonly name: string
  /** Localized built-in description or the preset's own description. */
  readonly description?: string
}

const BUILT_IN_PRESET_KEYS: Readonly<Partial<Record<string, { name: BuiltInPresetCopyKey; description: BuiltInPresetCopyKey }>>> = {
  standard: { name: 'presetStandardName', description: 'presetStandardDescription' },
  ptc: { name: 'presetPtcName', description: 'presetPtcDescription' },
  minimal: { name: 'presetMinimalName', description: 'presetMinimalDescription' },
  cordis: { name: 'presetCordisName', description: 'presetCordisDescription' },
}

/**
 * Resolve preset display copy without making user-authored metadata
 * translatable: shipped presets translate through locale keys, user-authored
 * presets show their own file metadata. Mirrors the shared agent-presets
 * display fold so this standalone plugin needs no extra runtime dependency.
 * @param preset - roster row whose copy is being rendered.
 * @param t - active locale lookup covering the built-in preset keys.
 * @returns localized copy for a known shipped preset, otherwise file metadata.
 */
export function presetDisplayText(
  preset: PresetDisplaySource,
  t: (key: BuiltInPresetCopyKey) => string,
): PresetDisplayText {
  const keys = preset.trust === 'system' ? BUILT_IN_PRESET_KEYS[preset.id] : undefined
  if (keys !== undefined) return { name: t(keys.name), description: t(keys.description) }
  return {
    name: preset.name ?? preset.id,
    ...preset.description === undefined ? {} : { description: preset.description },
  }
}
