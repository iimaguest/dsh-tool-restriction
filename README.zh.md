---
description: "逐会话工具掩码，面向选择、组合或排查在首个回合后固定、作用于所继承工具集的工具允许清单的使用者与维护者。"
kind: "package-reference"
---

# @deepseek-ai/dsh-tool-restriction

[English](README.md) | 中文

## 概述

`dsh-tool-restriction` 拥有 `ctx.toolRestriction`（[`ToolRestrictionService`](src/index.ts)），即逐会话工具掩码：对会话所继承工具集的可选允许清单，在会话的空白窗口期间选择，一旦首个 `turn/start` 落地即为会话余下生命周期固定，并按 preset 保存。该掩码是 permission/sandbox/approval 旋钮的同类物——仅日志的会话事件、后写者胜出折叠，而不是 `SessionHeader` 字段——因此它搭在既有的 `tools.restrict`/`guard` 与 settings 接缝上，无需触碰会话格式或持久化后端。当会话的工具集应按 preset 或按会话限制、而无需改变权限边界时，挂载它。

## 目录

- [使用本包](#use-this-package)
- [理解实现](#understand-the-implementation)
- [进一步探索](#further-exploration)
- [模型体验](#model-experience)
- [已知限制与延期工作](#known-limitations-and-deferred-work)
- [开发备注](#dev-note)

-----

<a id="use-this-package"></a>
## 使用本包

当部署需要在首个回合前选择逐会话工具掩码并为之固定时，挂载 `dsh-tool-restriction`。网页 GUI 提供选择器与 `toolRestriction.select` RPC；无头界面（`dsh` CLI、ACP 服务器、JSON-RPC/SDK 界面）没有选择器，直接在宿主上编排会话（`agents.create`），因此逐会话掩码通过「配置」设置。

### 设置掩码

`set(agent, mask)` 是每条空白窗口路径共用的唯一提交：它会先应用可见集合限制（逐名校验该会话所继承的工具集，因此一个被拒绝的掩码绝不会被记录），再追加持久事件，并把 `settings.byPreset[presetId]` 写出（「不限」选择则清除）。调用方拥有空白检查——该功能的锁在做出决定的那个操作上强制，因此首个 `turn/start` 之后的选择会在任何写入之前被拒绝。

### 无头与网页共用同一机制

掩码是一个逐会话事实——持久化的 `tool-restriction/selected` 日志事件——而每个界面都驱动同一个宿主服务。网页与无头只在一个写事件的杠杆上不同，从不在于该事件如何被折叠、应用或跟随。

有三个配置杠杆在首次回合之前决定一个会话的掩码，按优先级从高到低：

1. **preset 的 `tools.yml` `default`**——逐 preset 逐会话，也是无头模式的主要杠杆。发布 `tools.yml` 的 preset 目录会为该 preset 上的每个新会话播种该掩码，除非已有保存值：

   ```yaml
   # <preset-dir>/tools.yml
   default:
     allow: [read, write]
   groups:
     Files: [read, write]
   ```

2. **`tool-restriction` 设置命名空间**——已保存的逐 preset 覆盖（`byPreset.<id>`）与设置 `default`，由选择器写入、也便于运维通过设置 provider 编辑；在创建时物化进会话日志。已保存覆盖优先于 `tools.yml` 默认。

3. **部署默认**——插件的 `Config.default`，应用于没有组合任何 preset 且别无所出的会话。

带掩码的无头会话随后与带掩码的网页会话行为完全相同：`tools.schemas()` 只提供被允许的工具，`guard()` 拒绝其余，`tool:<name>` 指引散文被过滤，会话摘要折叠出掩码——同样一套产品，向每个客户端以相同方式呈现。

生成的[配置目录](../../../docs/config-catalog.zh.md#deepseek-aidsh-tool-restriction)是每个已接受字段的详尽来源。

-----

<a id="understand-the-implementation"></a>
## 理解实现

<details>
<summary>实现内部细节 — 点击展开</summary>

本节说明掩码如何被折叠与应用；可观察行为见[使用本包](#use-this-package)。

### 选择事件

选择本身是仅日志的 `tool-restriction/selected: { mask?: { allow } }` 事件。[`resolveSessionToolRestriction`](src/index.ts) 按后写者胜出折叠它；`mask` 缺失即恢复「不限」默认，而「存在但为空」的 `allow`（`{ allow: [] }`）是刻意的仅聊天写法——循环此时省略 `tools` 字段。

### 应用生命周期

应用是生命周期职责：服务在 `agent/created` 时折叠事件，并在每次选择追加时重新应用（session/event 分派是同步的），因此恢复的空白会话会重新掩码，带历史的会话则在其历史所产出时的确切工具集下恢复。单调 `guard()` 拒绝任何其名字被实时折叠排除在外的调用，重选时无需重新注册。

### 逐 preset 播种

每个 preset 记住自己最近保存的掩码。preset P 上的全新空白会话按逐 preset 链条播种——已保存覆盖 `settings.byPreset[P]`，否则取 P 的 `tools.yml` 默认，否则取部署默认——且种子会物化进日志，使会话自成一体（模型可见 ⟺ 已记录）。该服务不跨越任何 `SessionHeader` 边界；`resolveSessionPreset` 与旋钮家族一样从日志提供 preset id。

### 源码地图

| 文件 | 职责 |
|---|---|
| [`src/index.ts`](src/index.ts) | 服务、选择折叠、guard、空白窗口提交 |
| [`src/types.ts`](src/types.ts) | 掩码、wire 投影与逐 preset 设置类型 |
| [`src/invariant.ts`](src/invariant.ts) | 不变式伴随插件：以耐久方式强制空白窗口锁 |

</details>

-----

<a id="further-exploration"></a>
## 进一步探索

该掩码搭在工具与设置接缝上；阅读以下页面了解周边工具与权限契约。

- [tools](../../core/tools/README.zh.md) — 掩码所搭的工具注册表、`tools.restrict`/`guard` 与指引段。
- [settings](../../settings/README.zh.md) — 已保存逐 preset 覆盖所在的持久用户设置接缝。
- [preset](../../preset/README.zh.md) — 其 `tools.yml` 播种掩码的逐 preset 组合。
- [sandbox Agent Note](../../../.agents/notes/implemented/feature/2026-07-06-sandbox.zh.md) — 该掩码并列的 permission/approval 旋钮家族。

-----

<a id="model-experience"></a>
## 模型体验

### 逐会话工具掩码

#### 模型看到什么

掩码在首次请求前决定、此后固定，因此两种面向模型的产品都跟随它：工具 schema（注册表的 `schemas()` 已尊重 `tools.restrict`）与按工具分的指引段。一个 `system-prompt/assemble` 瀑布监听器丢弃其工具被掩码排除的 `tool:<name>` 段，因此模型永远不会被说教一个它无法调用的工具。传输名（`tools:sdk`、Code Mode 折叠）不匹配 `tool:` 约定而保留；`complete` persona 抑制整条带，过滤器在那里是无操作。

##### 模型工具集所重建出的耐久记录

```markdown
tool-restriction/selected: { mask: { allow: ["read", "write"] } }
```

#### Token 影响

条件性且仅前缀。掩码不增加提示 token；它移除提示 token（更少的工具 schema、更少的指引段），而它自己的记录是模型转录之外仅日志的事件。

#### KV Cache 影响

运行期间前缀稳定。仅在空白期做出的选择先于首次请求，因此首个轮次之后工具块与指引文本都不再变化——组装出的前缀（身份、persona、指引、工具块）保持稳定、历史仅追加增长。恢复时在任何请求前从日志重新应用折叠，保持相同前缀。一旦首个 `turn/start` 落地，包内改动无法使运行中的前缀失效；provider 的缓存可用性与驱逐仍在该包契约之外。

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

以下限制定义该掩码何时不适合或需要特别小心。它们是当前的包约束，而非任务积压。

- **掩码是逐会话策略，不是安全边界**——被掩码的工具对模型隐藏并被拒绝，但进程仍承载着它，组装及其升级旋钮仍是信任边界。
- **`tool:<name>` 段约定是过滤器的关键**——指引段不遵循该约定的工具会一直保留其文本，直到显式段属主字段作为加固落地。
- **会话中途修正不便**——空白窗口内选择不足的用户无法就地修复会话；途径是新会话或 fork，与 preset 完全一致。这一取舍买来 KV 保证。
- **按 preset 的设置映射随 roster id 增长**——被删除的 preset 会留下一条惰性 `byPreset` 条目，在该 id 回归前不产生任何效果，符合 roster 的活目录语义。

<a id="dev-note"></a>
### 开发备注

<details>
<summary>维护者工作上下文 — 点击展开</summary>

本开发备注是维护者的工作上下文，明确不具备权威性。该掩码按设计保持为逐会话策略而非安全边界；针对不符合约定工具的部分属主字段仍属后续工作。

</details>
