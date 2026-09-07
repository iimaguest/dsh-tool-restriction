window.__ModuleLoader__.load({
	id: "dsh-tool-restriction",
	factory: (require) => {
		var module = { exports: {} };
		var exports = module.exports;
		Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
		let react = require("react");
		let _deepseek_ai_dsh_client_ui_primitives = require("@deepseek-ai/dsh-client-ui-primitives");
		let react_jsx_runtime = require("react/jsx-runtime");
		let _deepseek_ai_dsh_client_store = require("@deepseek-ai/dsh-client-store");
		//#region \0dsh-css:C:\Users\00089093\IimaguestProjects\dsh-tool-restriction\src\client\HeroToolRestrictionPanel.module.css.mjs
		const css$2 = ".If1EtG_anchor{position:relative}.If1EtG_trigger{border:1px solid var(--dsw-alias-border-l2);cursor:pointer;background:0 0;border-radius:8px;justify-content:center;align-items:center;width:28px;height:28px;padding:0;display:inline-flex}.If1EtG_trigger:hover{background:var(--dsw-alias-interactive-bg-hover)}.If1EtG_trigger[aria-expanded=true]{border-color:var(--dsw-alias-button-primary-fill);background:var(--dsw-alias-fill-tsp-primary)}.If1EtG_panel{border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-alias-bg-layer-3);border-radius:10px;flex-direction:column;gap:8px;min-width:240px;max-width:340px;max-height:clamp(220px,44vh,460px);margin-top:6px;padding:10px 12px;display:flex;overflow-y:auto}.If1EtG_header{z-index:1;background:var(--dsw-alias-bg-layer-3);align-items:center;gap:6px;display:flex;position:sticky;top:0}.If1EtG_titleIcon{opacity:.7;flex:none}.If1EtG_title{color:var(--dsw-alias-label-primary);flex:1;font-size:13px;font-weight:600;line-height:20px}.If1EtG_actions{gap:4px;display:flex}.If1EtG_action{height:24px;color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;border-radius:6px;padding:2px 8px;font-size:12px;line-height:20px}.If1EtG_action:hover:not(:disabled){background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.If1EtG_action:disabled{color:var(--dsw-alias-label-dimmed);cursor:default}.If1EtG_group{flex-direction:column;gap:2px;display:flex}.If1EtG_groupName{text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-caption);padding:4px 2px 2px;font-size:11px;line-height:16px}.If1EtG_row{cursor:pointer;border-radius:6px;align-items:flex-start;gap:8px;padding:4px 6px;display:flex}.If1EtG_row:hover{background:var(--dsw-alias-interactive-bg-hover)}.If1EtG_checkbox{accent-color:var(--dsw-alias-button-primary-fill);flex:none;margin-top:2px}.If1EtG_rowText{flex-direction:column;gap:1px;min-width:0;display:flex}.If1EtG_toolName{color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px}.If1EtG_toolDesc{color:var(--dsw-alias-label-tertiary);-webkit-line-clamp:2;cursor:pointer;-webkit-box-orient:vertical;font-size:12px;line-height:16px;display:-webkit-box;overflow:hidden}.If1EtG_toolDescExpanded{-webkit-line-clamp:unset;cursor:default;display:block;overflow:visible}.If1EtG_descToggle{color:var(--dsw-alias-label-secondary);cursor:pointer;background:0 0;border:none;align-self:flex-start;padding:0;font-size:12px;line-height:16px}.If1EtG_descToggle:hover{color:var(--dsw-alias-label-primary);text-decoration:underline}";
		const tagId$2 = "dsh-tool-restriction/HeroToolRestrictionPanel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$2) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-tool-restriction";
			tag.dataset.pluginCss = tagId$2;
			tag.textContent = css$2;
			document.head.appendChild(tag);
		}
		var HeroToolRestrictionPanel_module_css_default = {
			"action": "If1EtG_action",
			"actions": "If1EtG_actions",
			"anchor": "If1EtG_anchor",
			"checkbox": "If1EtG_checkbox",
			"descToggle": "If1EtG_descToggle",
			"group": "If1EtG_group",
			"groupName": "If1EtG_groupName",
			"header": "If1EtG_header",
			"panel": "If1EtG_panel",
			"row": "If1EtG_row",
			"rowText": "If1EtG_rowText",
			"title": "If1EtG_title",
			"titleIcon": "If1EtG_titleIcon",
			"toolDesc": "If1EtG_toolDesc",
			"toolDescExpanded": "If1EtG_toolDescExpanded",
			"toolName": "If1EtG_toolName",
			"trigger": "If1EtG_trigger"
		};
		//#endregion
		//#region src/client/HeroToolRestrictionPanel.tsx
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
		/**
		* Render the tool-mask control for the current blank session in the composer
		* tool row: a compact icon trigger that expands to the grouped checkbox board
		* on click. Hidden once a turn starts (the read-only header label takes over).
		* @param props - composed slot props.
		* @returns the trigger, or null while no blank session exists.
		*/
		function HeroToolRestrictionPanel({ useProjection, useSessions, sessionId, command, t }) {
			const state = useProjection("tool-restriction");
			const blank = useSessions((snapshot) => snapshot.current === void 0 ? false : snapshot.byId[snapshot.current]?.blank === true);
			const [open, setOpen] = (0, react.useState)(false);
			const [expanded, setExpanded] = (0, react.useState)(/* @__PURE__ */ new Set());
			const groups = state?.groups ?? [];
			const locked = state?.locked ?? false;
			const current = state?.current;
			if (!blank) return null;
			const submit = (line) => {
				command(line).catch(() => false);
			};
			const checked = (name) => current === void 0 || current.allow.includes(name);
			const disabled = locked;
			const toggleExpanded = (name) => {
				setExpanded((prev) => {
					const next = new Set(prev);
					if (next.has(name)) next.delete(name);
					else next.add(name);
					return next;
				});
			};
			const toggle = (name, checkedNow) => {
				const all = groups.flatMap((group) => group.tools).map((tool) => tool.name);
				const base = current?.allow ?? all;
				const allow = checkedNow ? Array.from(new Set([...base, name])) : base.filter((entry) => entry !== name);
				submit(`/tool-restriction ${JSON.stringify({ allow })}`);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: HeroToolRestrictionPanel_module_css_default.anchor,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
					type: "button",
					className: HeroToolRestrictionPanel_module_css_default.trigger,
					"aria-label": t("title"),
					title: t("title"),
					"aria-expanded": open,
					onClick: () => {
						setOpen((currentValue) => !currentValue);
					},
					children: /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { className: HeroToolRestrictionPanel_module_css_default.titleIcon })
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: HeroToolRestrictionPanel_module_css_default.panel,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: HeroToolRestrictionPanel_module_css_default.header,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
							className: HeroToolRestrictionPanel_module_css_default.title,
							children: t("title")
						}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: HeroToolRestrictionPanel_module_css_default.actions,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: HeroToolRestrictionPanel_module_css_default.action,
								disabled,
								onClick: () => {
									submit("/tool-restriction all");
								},
								children: t("selectAll")
							}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
								type: "button",
								className: HeroToolRestrictionPanel_module_css_default.action,
								disabled,
								onClick: () => {
									submit("/tool-restriction none");
								},
								children: t("selectNone")
							})]
						})]
					}), groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: HeroToolRestrictionPanel_module_css_default.group,
						children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: HeroToolRestrictionPanel_module_css_default.groupName,
							children: group.group
						}), group.tools.map((tool) => {
							const isExpanded = expanded.has(tool.name);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("label", {
								className: HeroToolRestrictionPanel_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
									type: "checkbox",
									className: HeroToolRestrictionPanel_module_css_default.checkbox,
									checked: checked(tool.name),
									disabled,
									"aria-label": `${t("toolAria")}: ${tool.name}`,
									onChange: (event) => {
										toggle(tool.name, event.target.checked);
									}
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
									className: HeroToolRestrictionPanel_module_css_default.rowText,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: HeroToolRestrictionPanel_module_css_default.toolName,
											children: tool.name
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: isExpanded ? `${HeroToolRestrictionPanel_module_css_default.toolDesc} ${HeroToolRestrictionPanel_module_css_default.toolDescExpanded}` : HeroToolRestrictionPanel_module_css_default.toolDesc,
											onClick: (event) => {
												event.preventDefault();
												toggleExpanded(tool.name);
											},
											title: isExpanded ? void 0 : tool.description,
											children: tool.description
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("button", {
											type: "button",
											className: HeroToolRestrictionPanel_module_css_default.descToggle,
											onClick: (event) => {
												event.preventDefault();
												toggleExpanded(tool.name);
											},
											children: isExpanded ? t("showLess") : t("showMore")
										})
									]
								})]
							}, tool.name);
						})]
					}, group.group))]
				})]
			});
		}
		//#endregion
		//#region \0dsh-css:C:\Users\00089093\IimaguestProjects\dsh-tool-restriction\src\client\ToolRestrictionLabel.module.css.mjs
		const css$1 = ".e9gJ9a_anchor{position:relative}.e9gJ9a_label{background:var(--dsw-alias-fill-tsp-secondary);max-width:200px;height:22px;color:var(--dsw-alias-label-secondary);white-space:nowrap;text-overflow:ellipsis;cursor:pointer;border:none;border-radius:6px;align-items:center;gap:4px;padding:0 4px 0 2px;font-size:12px;line-height:22px;display:inline-flex;overflow:hidden}.e9gJ9a_label:hover,.e9gJ9a_label[aria-expanded=true]{background:var(--dsw-alias-interactive-bg-hover);color:var(--dsw-alias-label-primary)}.e9gJ9a_text{text-overflow:ellipsis;overflow:hidden}.e9gJ9a_icon{opacity:.7;flex:none}.e9gJ9a_board{z-index:100;box-sizing:border-box;overscroll-behavior:contain;border:1px solid var(--dsw-alias-border-l2);background:var(--dsw-specific-menu);width:336px;max-width:min(400px,100vw - 32px);max-height:min(420px,100vh - 140px);box-shadow:var(--dsw-shadow-lv3);--dsh-scrollbar-thumb:var(--dsw-alias-scrollbar-bg-l2);--dsh-scrollbar-thumb-hover:var(--dsw-alias-scrollbar-hover-l2);border-radius:12px;flex-direction:column;gap:8px;padding:10px 12px;display:flex;position:absolute;top:calc(100% + 6px);left:0;overflow-y:auto}.e9gJ9a_boardHeader{justify-content:space-between;align-items:baseline;gap:8px;display:flex}.e9gJ9a_boardTitle{color:var(--dsw-alias-label-primary);font-size:13px;font-weight:600;line-height:20px}.e9gJ9a_boardHint{color:var(--dsw-alias-label-caption);font-size:11px;line-height:16px}.e9gJ9a_group{flex-direction:column;gap:2px;display:flex}.e9gJ9a_groupName{text-transform:uppercase;letter-spacing:.04em;color:var(--dsw-alias-label-caption);padding:4px 2px 2px;font-size:11px;line-height:16px}.e9gJ9a_tool{border-radius:6px;align-items:flex-start;gap:8px;padding:4px 6px;display:flex}.e9gJ9a_toolText{flex-direction:column;gap:1px;min-width:0;display:flex}.e9gJ9a_checkbox{accent-color:var(--dsw-alias-button-primary-fill);flex:none;margin-top:2px}.e9gJ9a_toolName{color:var(--dsw-alias-label-primary);font-size:13px;line-height:18px}.e9gJ9a_toolDesc{color:var(--dsw-alias-label-tertiary);font-size:12px;line-height:16px}.e9gJ9a_toolOff .e9gJ9a_toolName{color:var(--dsw-alias-label-tertiary)}.e9gJ9a_toolOff .e9gJ9a_toolDesc{opacity:.65}";
		const tagId$1 = "dsh-tool-restriction/ToolRestrictionLabel.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId$1) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-tool-restriction";
			tag.dataset.pluginCss = tagId$1;
			tag.textContent = css$1;
			document.head.appendChild(tag);
		}
		var ToolRestrictionLabel_module_css_default = {
			"anchor": "e9gJ9a_anchor",
			"board": "e9gJ9a_board",
			"boardHeader": "e9gJ9a_boardHeader",
			"boardHint": "e9gJ9a_boardHint",
			"boardTitle": "e9gJ9a_boardTitle",
			"checkbox": "e9gJ9a_checkbox",
			"group": "e9gJ9a_group",
			"groupName": "e9gJ9a_groupName",
			"icon": "e9gJ9a_icon",
			"label": "e9gJ9a_label",
			"text": "e9gJ9a_text",
			"tool": "e9gJ9a_tool",
			"toolDesc": "e9gJ9a_toolDesc",
			"toolName": "e9gJ9a_toolName",
			"toolOff": "e9gJ9a_toolOff",
			"toolText": "e9gJ9a_toolText"
		};
		//#endregion
		//#region src/client/ToolRestrictionLabel.tsx
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
		/**
		* Render this session's tool mask beside its title; the pill opens a
		* read-only view of the full composed board.
		* @param props - composed slot props.
		* @returns the label, or null while the mask is unresolved.
		*/
		function ToolRestrictionLabel({ useProjection, t }) {
			const state = useProjection("tool-restriction");
			const [open, setOpen] = (0, react.useState)(false);
			(0, react.useEffect)(() => {
				if (!open) return;
				const close = () => setOpen(false);
				const onKeyDown = (event) => {
					if (event.key === "Escape") close();
				};
				const onPointerDown = (event) => {
					if (event.target instanceof Element && event.target.closest("[data-tr-anchor]") === null) close();
				};
				document.addEventListener("keydown", onKeyDown);
				document.addEventListener("pointerdown", onPointerDown);
				return () => {
					document.removeEventListener("keydown", onKeyDown);
					document.removeEventListener("pointerdown", onPointerDown);
				};
			}, [open]);
			const groups = state?.groups ?? [];
			if (groups.length === 0) return null;
			const mask = state?.current;
			const text = mask === void 0 ? t("allTools") : mask.allow.length === 0 ? t("talkOnly") : `${t("labelPrefix")}: ${mask.allow.join(" · ")}`;
			const enabled = (name) => mask === void 0 || mask.allow.includes(name);
			const toggle = () => setOpen((current) => !current);
			const onToggleKeyDown = (event) => {
				if (event.key === "Enter" || event.key === " ") {
					event.preventDefault();
					toggle();
				}
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ToolRestrictionLabel_module_css_default.anchor,
				"data-tr-anchor": true,
				children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("button", {
					type: "button",
					className: ToolRestrictionLabel_module_css_default.label,
					title: text,
					"aria-expanded": open,
					"aria-haspopup": "dialog",
					onClick: toggle,
					onKeyDown: onToggleKeyDown,
					children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.IconChecklistOutline14, { className: ToolRestrictionLabel_module_css_default.icon }), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
						className: ToolRestrictionLabel_module_css_default.text,
						children: text
					})]
				}), open && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
					className: ToolRestrictionLabel_module_css_default.board,
					children: [
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ToolRestrictionLabel_module_css_default.boardTitle,
							children: t("title")
						}),
						/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
							className: ToolRestrictionLabel_module_css_default.boardHint,
							children: t("readOnlyHint")
						}),
						groups.map((group) => /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
							className: ToolRestrictionLabel_module_css_default.group,
							children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ToolRestrictionLabel_module_css_default.groupName,
								children: group.group
							}), group.tools.map((tool) => {
								const isEnabled = enabled(tool.name);
								return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ToolRestrictionLabel_module_css_default.row,
									children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("span", {
										className: ToolRestrictionLabel_module_css_default.rowText,
										children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ToolRestrictionLabel_module_css_default.toolName,
											children: tool.name
										}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
											className: ToolRestrictionLabel_module_css_default.toolDesc,
											title: tool.description,
											children: tool.description
										})]
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
										className: isEnabled ? ToolRestrictionLabel_module_css_default.stateOn : ToolRestrictionLabel_module_css_default.stateOff,
										"aria-label": `${t("toolStateAria")}: ${tool.name}`,
										children: isEnabled ? "✓" : "✕"
									})]
								}, tool.name);
							})]
						}, group.group))
					]
				})]
			});
		}
		//#endregion
		//#region src/client/settings-locales.ts
		/** English copy. */
		const settingsEn = {
			nav: "Tool defaults",
			title: "Tool defaults per preset",
			description: "Choose the default tool set new sessions start with on each preset. An override set here wins over the preset’s authored tools.yml default.",
			loading: "Loading…",
			unavailable: "Tool defaults are not available in this deployment.",
			error: "Could not load or save tool defaults.",
			saved: "Saved",
			default: "Preset default",
			noDefault: "No default (all composed tools)",
			clear: "Reset to preset default",
			clearing: "Resetting…",
			edit: "Edit",
			done: "Done",
			toolsAria: "Default tools",
			presetDefaultHint: "The preset’s authored tools.yml default, unless you set an override below.",
			close: "Close",
			presetStandardName: "Standard mode",
			presetStandardDescription: "Full coding agent with file editing, shell, file and web search, skills, planning, goals, subagents, and workflows.",
			presetPtcName: "PTC mode",
			presetPtcDescription: "Full coding agent without the workflow tool; other tools are exposed through the PTC mode SDK so the model can combine multi-step operations in one TypeScript program.",
			presetMinimalName: "Minimal mode",
			presetMinimalDescription: "Two-tool coding agent with persistent bash and str_replace_editor.",
			presetCordisName: "Creator mode",
			presetCordisDescription: "Built for creating custom agent presets, with all Standard mode capabilities plus runtime inspection, plugin experiments, and preset-authoring guidance."
		};
		/** Simplified Chinese copy. */
		const settingsZh = {
			nav: "工具默认值",
			title: "各预设的工具默认值",
			description: "选择每个预设下新会话默认使用的工具集。此处设置的覆盖项优先于预设自带的 tools.yml 默认值。",
			loading: "正在加载…",
			unavailable: "此部署未提供工具默认值。",
			error: "无法加载或保存工具默认值。",
			saved: "已保存",
			default: "预设默认",
			noDefault: "无默认（使用全部已组合工具）",
			clear: "重置为预设默认",
			clearing: "正在重置…",
			edit: "编辑",
			done: "完成",
			toolsAria: "默认工具",
			presetDefaultHint: "预设自带的 tools.yml 默认值；除非你在下方设置了覆盖项。",
			close: "关闭",
			presetStandardName: "标准模式",
			presetStandardDescription: "功能完整的编码 Agent，支持文件编辑、Shell、文件与网页检索、Skills、计划、目标、子代理和工作流。",
			presetPtcName: "PTC 模式",
			presetPtcDescription: "功能完整的编码 Agent，但默认不提供 workflow 工具；其他工具通过 PTC 模式 SDK 呈现，让模型用一个 TypeScript 程序组合多步操作。",
			presetMinimalName: "极简模式",
			presetMinimalDescription: "仅提供持久 bash 与 str_replace_editor 的双工具编码 Agent。",
			presetCordisName: "创造模式",
			presetCordisDescription: "用于创建自定义 Agent preset：具备标准模式的全部能力，并提供运行时检查、插件实验和 preset 创作指导。"
		};
		const BUILT_IN_PRESET_KEYS = {
			standard: {
				name: "presetStandardName",
				description: "presetStandardDescription"
			},
			ptc: {
				name: "presetPtcName",
				description: "presetPtcDescription"
			},
			minimal: {
				name: "presetMinimalName",
				description: "presetMinimalDescription"
			},
			cordis: {
				name: "presetCordisName",
				description: "presetCordisDescription"
			}
		};
		/**
		* Resolve preset display copy without making user-authored metadata
		* translatable: shipped presets translate through locale keys, user-authored
		* presets show their own file metadata. Mirrors the shared agent-presets
		* display fold so this standalone plugin needs no extra runtime dependency.
		* @param preset - roster row whose copy is being rendered.
		* @param t - active locale lookup covering the built-in preset keys.
		* @returns localized copy for a known shipped preset, otherwise file metadata.
		*/
		function presetDisplayText(preset, t) {
			const keys = preset.trust === "system" ? BUILT_IN_PRESET_KEYS[preset.id] : void 0;
			if (keys !== void 0) return {
				name: t(keys.name),
				description: t(keys.description)
			};
			return {
				name: preset.name ?? preset.id,
				...preset.description === void 0 ? {} : { description: preset.description }
			};
		}
		//#endregion
		//#region \0dsh-css:C:\Users\00089093\IimaguestProjects\dsh-tool-restriction\src\client\ToolDefaultsSection.module.css.mjs
		const css = ".Y2PK_q_section{flex-direction:column;gap:16px;padding:16px 0;display:flex}.Y2PK_q_intro{flex-direction:column;gap:6px;display:flex}.Y2PK_q_title{font-size:16px;font-weight:600}.Y2PK_q_desc{color:var(--vscode-descriptionForeground,#8b8b8b);font-size:13px;line-height:1.5}.Y2PK_q_error{color:var(--vscode-errorForeground,#f14c4c);font-size:13px}.Y2PK_q_loading{color:var(--vscode-descriptionForeground,#8b8b8b);font-size:13px}.Y2PK_q_rows{flex-direction:column;gap:10px;display:flex}.Y2PK_q_row{border:1px solid var(--vscode-panel-border,#3a3a3a);border-radius:6px;justify-content:space-between;align-items:flex-start;gap:16px;padding:12px;display:flex}.Y2PK_q_rowText{flex-direction:column;gap:4px;min-width:0;display:flex}.Y2PK_q_rowTitle{font-size:14px;font-weight:600}.Y2PK_q_overridden{color:var(--vscode-charts-blue,#3794ff);font-size:12px}.Y2PK_q_rowDesc{color:var(--vscode-descriptionForeground,#8b8b8b);font-size:12px}.Y2PK_q_tools{word-break:break-word;font-size:13px;line-height:1.5}.Y2PK_q_muted{color:var(--vscode-descriptionForeground,#8b8b8b);font-style:italic}.Y2PK_q_hint{color:var(--vscode-descriptionForeground,#8b8b8b);font-size:12px}.Y2PK_q_editInput{border:1px solid var(--vscode-input-border,#4a4a4a);background:var(--vscode-input-background,#2a2a2a);width:100%;color:var(--vscode-input-foreground,#ccc);border-radius:4px;padding:4px 8px;font-size:13px}.Y2PK_q_actions{flex-direction:column;flex-shrink:0;gap:6px;display:flex}.Y2PK_q_saved{color:var(--vscode-charts-green,#89d185);font-size:12px}";
		const tagId = "dsh-tool-restriction/ToolDefaultsSection.module.css";
		if (typeof document !== "undefined" && document.querySelector("style[data-plugin-css=" + JSON.stringify(tagId) + "]") === null) {
			const tag = document.createElement("style");
			tag.dataset.plugin = "dsh-tool-restriction";
			tag.dataset.pluginCss = tagId;
			tag.textContent = css;
			document.head.appendChild(tag);
		}
		var ToolDefaultsSection_module_css_default = {
			"actions": "Y2PK_q_actions",
			"desc": "Y2PK_q_desc",
			"editInput": "Y2PK_q_editInput",
			"error": "Y2PK_q_error",
			"hint": "Y2PK_q_hint",
			"intro": "Y2PK_q_intro",
			"loading": "Y2PK_q_loading",
			"muted": "Y2PK_q_muted",
			"overridden": "Y2PK_q_overridden",
			"row": "Y2PK_q_row",
			"rowDesc": "Y2PK_q_rowDesc",
			"rowText": "Y2PK_q_rowText",
			"rowTitle": "Y2PK_q_rowTitle",
			"rows": "Y2PK_q_rows",
			"saved": "Y2PK_q_saved",
			"section": "Y2PK_q_section",
			"title": "Y2PK_q_title",
			"tools": "Y2PK_q_tools"
		};
		//#endregion
		//#region src/client/ToolDefaultsSection.tsx
		/**
		* Tool-defaults settings section: one row per preset showing the default tool
		* set new sessions start with, editable as a comma-separated allow-list with a
		* reset to the preset's authored `tools.yml` default. Reads the host
		* `tool-restriction` settings namespace through the shared mirror and writes
		* per-preset overrides through `remote.settings`.
		*/
		/**
		* Render the per-preset tool-defaults section.
		* @param props - composed slot props.
		* @returns the section, or null when the host does not expose the namespace.
		*/
		function ToolDefaultsSection({ load, clearOverride, setDefault, useToolDefaultsSection, t, close }) {
			const state = useToolDefaultsSection((snapshot) => snapshot);
			const [editing, setEditing] = (0, react.useState)(null);
			const [savedId, setSavedId] = (0, react.useState)(null);
			(0, react.useEffect)(() => {
				load();
			}, [load]);
			if (state.status === "unavailable") return null;
			const busy = state.status === "loading" || state.status === "saving";
			const error = state.status === "error" ? state.error : null;
			const startEdit = (presetId, allow) => {
				setEditing({
					presetId,
					draft: allow.join(", ")
				});
			};
			const commitEdit = async () => {
				if (editing === null) return;
				const names = editing.draft.split(",").map((name) => name.trim()).filter((name) => name.length > 0);
				await setDefault(editing.presetId, names);
				setSavedId(editing.presetId);
				setEditing(null);
			};
			const resetRow = async (presetId) => {
				await clearOverride(presetId);
				setSavedId(presetId);
			};
			return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
				className: ToolDefaultsSection_module_css_default.section,
				children: [
					/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ToolDefaultsSection_module_css_default.intro,
						children: [
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ToolDefaultsSection_module_css_default.title,
								children: t("title")
							}),
							/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ToolDefaultsSection_module_css_default.desc,
								children: t("description")
							}),
							error !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
								className: ToolDefaultsSection_module_css_default.error,
								role: "alert",
								children: error
							})
						]
					}),
					busy && state.rows.length === 0 ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ToolDefaultsSection_module_css_default.loading,
						children: t("loading")
					}) : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
						className: ToolDefaultsSection_module_css_default.rows,
						children: state.rows.map((row) => {
							const text = presetDisplayText(row, t);
							return /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
								className: ToolDefaultsSection_module_css_default.row,
								children: [/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
									className: ToolDefaultsSection_module_css_default.rowText,
									children: [
										/* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
											className: ToolDefaultsSection_module_css_default.rowTitle,
											children: [text.name, /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: ToolDefaultsSection_module_css_default.overridden,
												children: row.overridden ? "· " + t("saved") : ""
											})]
										}),
										text.description !== void 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: ToolDefaultsSection_module_css_default.rowDesc,
											children: text.description
										}),
										/* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: ToolDefaultsSection_module_css_default.tools,
											children: editing?.presetId === row.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsx)("input", {
												className: ToolDefaultsSection_module_css_default.editInput,
												value: editing.draft,
												"aria-label": t("toolsAria"),
												onChange: (event) => {
													setEditing((current) => current === null ? current : {
														...current,
														draft: event.target.value
													});
												},
												onKeyDown: (event) => {
													if (event.key === "Enter") commitEdit();
													if (event.key === "Escape") setEditing(null);
												}
											}) : row.allow.length > 0 ? row.allow.join(" · ") : /* @__PURE__ */ (0, react_jsx_runtime.jsx)("span", {
												className: ToolDefaultsSection_module_css_default.muted,
												children: t("noDefault")
											})
										}),
										!row.overridden && row.allow.length === 0 && /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
											className: ToolDefaultsSection_module_css_default.hint,
											children: t("presetDefaultHint")
										})
									]
								}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)("div", {
									className: ToolDefaultsSection_module_css_default.actions,
									children: editing?.presetId === row.id ? /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "small",
										onClick: () => {
											commitEdit();
										},
										children: t("done")
									}), /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "small",
										variant: "secondary",
										onClick: () => setEditing(null),
										children: t("close")
									})] }) : /* @__PURE__ */ (0, react_jsx_runtime.jsxs)(react_jsx_runtime.Fragment, { children: [/* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "small",
										disabled: busy,
										onClick: () => startEdit(row.id, row.allow),
										children: t("edit")
									}), row.overridden && /* @__PURE__ */ (0, react_jsx_runtime.jsx)(_deepseek_ai_dsh_client_ui_primitives.Button, {
										size: "small",
										variant: "secondary",
										disabled: busy,
										onClick: () => {
											resetRow(row.id);
										},
										children: t("clear")
									})] })
								})]
							}, row.id);
						})
					}),
					savedId !== null && /* @__PURE__ */ (0, react_jsx_runtime.jsxs)("div", {
						className: ToolDefaultsSection_module_css_default.saved,
						role: "status",
						children: [
							t("saved"),
							": ",
							savedId
						]
					})
				]
			});
		}
		//#endregion
		//#region src/client/settings-store.ts
		/** Tool-restriction's settings namespace on the host wire. */
		const TOOL_RESTRICTION_SETTINGS_NS = "tool-restriction";
		/**
		* Read the `byPreset` saved overrides from the host namespace descriptor.
		* @param view - tool-restriction namespace descriptor.
		* @returns the saved override per preset id, or undefined when absent.
		*/
		function savedOverridesOf(view) {
			const byPreset = view.value?.byPreset;
			if (byPreset === void 0 || typeof byPreset !== "object" || byPreset === null) return {};
			const result = {};
			for (const [id, entry] of Object.entries(byPreset)) {
				const allow = entry?.allow;
				if (Array.isArray(allow) && allow.every((name) => typeof name === "string")) result[id] = { allow };
			}
			return result;
		}
		/** Controller deriving the section from the shared mirror and the roster. */
		var ToolDefaultsSettingsController = class {
			describeFace;
			ctx;
			schema;
			/** Section snapshot consumed through a bound selector hook. */
			store = (0, _deepseek_ai_dsh_client_store.createSnapshotStore)({
				status: "idle",
				error: null,
				writable: false,
				rows: [],
				revision: 0
			});
			following;
			saving = false;
			disposed = false;
			/** Preset display metadata (id → trust/name/description) loaded from the roster. */
			presets = /* @__PURE__ */ new Map();
			/**
			* @param describeFace - the shared mirror's read/fold face.
			* @param ctx - the section plugin's context, whose `remote.settings`
			* namespace carries the writes and `remote.agentPresets` the roster.
			* @param schema - settings-owned schema operations.
			*/
			constructor(describeFace, ctx, schema) {
				this.describeFace = describeFace;
				this.ctx = ctx;
				this.schema = schema;
			}
			/**
			* Begin following the mirror (idempotent), load the preset roster, and
			* reflect the combined answer.
			* @returns settlement once the snapshot reflects the mirror.
			*/
			async load() {
				if (this.disposed) return;
				this.following ??= this.describeFace.subscribe(() => {
					this.derive();
				});
				this.store.update((state) => {
					state.status = "loading";
					state.error = null;
				});
				await Promise.all([this.describeFace.ensure(), this.loadRoster()]);
				this.derive();
			}
			/**
			* Clear one preset's saved override so new sessions use the preset's
			* authored `tools.yml` default (or unrestricted when none is published).
			* @param presetId - the preset whose override to clear.
			* @returns nothing; {@link store} carries success or failure.
			*/
			async clearOverride(presetId) {
				const state = this.store.getSnapshot();
				const view = this.describeFace.getSnapshot().view?.namespaces.find((entry) => entry.ns === TOOL_RESTRICTION_SETTINGS_NS);
				if (view === void 0 || !state.writable || this.saving) return;
				this.saving = true;
				this.store.update((draft) => {
					draft.status = "saving";
					draft.error = null;
				});
				let response;
				try {
					response = await this.ctx.remote.settings.mutate(TOOL_RESTRICTION_SETTINGS_NS, [{
						op: "unset",
						path: ["byPreset", presetId]
					}], view.revision);
				} finally {
					this.saving = false;
				}
				if (this.disposed) return;
				if (!response.ok) {
					this.fail(response.error);
					return;
				}
				this.describeFace.acceptView(response.value);
			}
			/**
			* Set one preset's saved default allow-list for new sessions.
			* @param presetId - the preset whose default to set.
			* @param allow - the default tool allow-list.
			* @returns nothing; {@link store} carries success or failure.
			*/
			async setDefault(presetId, allow) {
				const state = this.store.getSnapshot();
				const view = this.describeFace.getSnapshot().view?.namespaces.find((entry) => entry.ns === TOOL_RESTRICTION_SETTINGS_NS);
				if (view === void 0 || !state.writable || this.saving) return;
				this.saving = true;
				this.store.update((draft) => {
					draft.status = "saving";
					draft.error = null;
				});
				let response;
				try {
					response = await this.ctx.remote.settings.mutate(TOOL_RESTRICTION_SETTINGS_NS, [{
						op: "set",
						path: ["byPreset", presetId],
						value: { allow: [...allow] }
					}], view.revision);
				} finally {
					this.saving = false;
				}
				if (this.disposed) return;
				if (!response.ok) {
					this.fail(response.error);
					return;
				}
				this.describeFace.acceptView(response.value);
			}
			/** Stop following the mirror; later publishes leave the snapshot alone. */
			dispose() {
				this.disposed = true;
				this.following?.();
				this.following = void 0;
			}
			async loadRoster() {
				try {
					const result = await this.ctx.remote.agentPresets.list();
					const presets = result.ok === true ? result.value.presets : void 0;
					this.presets = new Map((presets ?? []).map((preset) => [preset.id, {
						trust: preset.trust,
						name: preset.name ?? preset.id,
						...preset.description === void 0 ? {} : { description: preset.description }
					}]));
				} catch {
					this.presets = /* @__PURE__ */ new Map();
				}
			}
			derive() {
				if (this.disposed || this.saving) return;
				const mirrored = this.describeFace.getSnapshot();
				if (mirrored.status === "unavailable") {
					this.store.update((state) => {
						state.status = "unavailable";
						state.writable = false;
						state.rows = [];
					});
					return;
				}
				if (mirrored.view === void 0) {
					if (mirrored.error !== null) this.fail(new Error(mirrored.error));
					return;
				}
				const view = mirrored.view.namespaces.find((entry) => entry.ns === TOOL_RESTRICTION_SETTINGS_NS);
				if (view === void 0) {
					this.store.update((state) => {
						state.status = "unavailable";
						state.writable = false;
						state.rows = [];
					});
					return;
				}
				const overrides = savedOverridesOf(view);
				const rows = [...this.presets.entries()].map(([id, meta]) => {
					const override = overrides[id];
					return {
						id,
						trust: meta.trust,
						name: meta.name,
						...meta.description === void 0 ? {} : { description: meta.description },
						allow: override?.allow ?? [],
						overridden: override !== void 0
					};
				});
				this.store.update((state) => {
					state.status = "ready";
					state.error = null;
					state.writable = mirrored.view?.writable === true;
					state.rows = rows;
					state.revision = view.revision;
				});
			}
			fail(error) {
				this.store.update((state) => {
					state.status = "error";
					state.error = error instanceof Error ? error.message : String(error);
				});
			}
		};
		//#endregion
		//#region src/client/locales.ts
		/** English copy. */
		const en = {
			title: "Tools",
			selectAll: "Select all",
			selectNone: "Select none",
			presetDefault: "Preset default",
			presetDefaultHint: "Restore the preset's authored default tool set",
			talkOnly: "Talk only",
			allTools: "All tools",
			labelPrefix: "Tools",
			loading: "Loading…",
			error: "Could not load the tool list.",
			toolAria: "Toggle tool",
			toolStateAria: "Tool",
			readOnlyHint: "Read-only — the mask is fixed once the first turn runs",
			showMore: "Show more",
			showLess: "Show less"
		};
		/** Simplified Chinese copy. */
		const zh = {
			title: "工具",
			selectAll: "全选",
			selectNone: "全不选",
			presetDefault: "预设默认",
			presetDefaultHint: "恢复预设自带的默认工具集",
			talkOnly: "仅对话",
			allTools: "全部工具",
			labelPrefix: "工具",
			loading: "正在加载…",
			error: "无法加载工具列表。",
			toolAria: "切换工具",
			toolStateAria: "工具",
			readOnlyHint: "只读——首个回合开始后已固定",
			showMore: "展开",
			showLess: "收起"
		};
		//#endregion
		//#region src/client/index.ts
		/** Dictionary namespace owned by this plugin. */
		const NS = "conversation.toolRestriction";
		/** Settings section namespace owned by this plugin. */
		const SETTINGS_NS = "settings.toolDefaults";
		/** Required services (cordis fiber inject). */
		const inject = [
			"slots",
			"sessions",
			"locale",
			"remote",
			"remote.agentPresets",
			"remote.settings",
			"settingsScope",
			"settingsSchema"
		];
		/**
		* Mount the tool-mask hero panel and the session-header label.
		* @param ctx - the browser plugin context.
		*/
		function apply(ctx) {
			ctx.effect(() => ctx.locale.register(NS, {
				zh,
				en
			}), "ui-tool-restriction: dictionaries");
			ctx.effect(() => ctx.locale.register(SETTINGS_NS, {
				zh: settingsZh,
				en: settingsEn
			}), "ui-tool-restriction: settings dictionaries");
			const sessions = ctx.sessions;
			ctx.slots.inject("conversation.input.left", () => ctx.slots.register({
				name: "conversation.input.left",
				id: "tool-restriction",
				order: -1,
				locale: NS,
				inject: (sessionId) => ({ command: async (line) => {
					const face = sessions.binding(sessionId)?.session;
					if (face === void 0) return false;
					const result = await face.command(line);
					return result.ok === true && result.value?.matched === true;
				} })
			}, HeroToolRestrictionPanel));
			ctx.slots.inject("conversation.session.header.actions", () => ctx.slots.register({
				name: "conversation.session.header.actions",
				id: "tool-restriction",
				order: -9,
				locale: NS
			}, ToolRestrictionLabel));
			const controller = new ToolDefaultsSettingsController(ctx.settingsScope.describe(), ctx, ctx.settingsSchema);
			const load = () => controller.load();
			const clearOverride = (presetId) => controller.clearOverride(presetId);
			const setDefault = (presetId, allow) => controller.setDefault(presetId, allow);
			const sectionInjected = () => ({
				hooks: { toolDefaultsSection: controller.store },
				load,
				clearOverride,
				setDefault
			});
			ctx.effect(() => () => {
				controller.dispose();
			}, "ui-tool-restriction: settings section directory");
			ctx.slots.inject("settings.section", () => ctx.slots.register({
				name: "settings.section",
				id: "tool-defaults",
				order: 25,
				label: () => ctx.locale.bind(SETTINGS_NS)("nav"),
				locale: SETTINGS_NS,
				inject: sectionInjected
			}, ToolDefaultsSection));
		}
		//#endregion
		exports.HeroToolRestrictionPanel = HeroToolRestrictionPanel;
		exports.ToolDefaultsSection = ToolDefaultsSection;
		exports.ToolRestrictionLabel = ToolRestrictionLabel;
		exports.apply = apply;
		exports.inject = inject;
		return module.exports;
	}
});

//# sourceMappingURL=client.js.map