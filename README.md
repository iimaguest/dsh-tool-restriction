---
description: "The per-session tool mask for users and maintainers choosing, composing, or debugging fixed-after-first-turn tool allow-lists over the inherited tool set."
kind: "package-reference"
---

# dsh-tool-restriction

Standalone DeepSeek Harness plugin: the per-session tool mask
(`ctx.toolRestriction`). Install it into a profile with:

```sh
dsh plugin --profile web add github:iimaguest/dsh-tool-restriction
```

It mounts as the `tool-restriction` row. The repo also ships the preset
tool-defaults reader (`tools.ts`) that seeds each preset's saved default mask
from a `tools.yml` beside the preset composition.

English | [中文](README.zh.md)

## Summary

`dsh-tool-restriction` owns `ctx.toolRestriction` ([`ToolRestrictionService`](src/index.ts)), the per-session tool mask: an optional allow-list over the session's inherited tool set, chosen during the session's blank window, fixed for the rest of the session once the first `turn/start` lands, and saved per preset. The mask is the sibling of the permission/sandbox/approval knobs — a log-only session event folded last-wins, not a `SessionHeader` field — so it rides the existing `tools.restrict`/`guard` and settings seams without touching the session-format or persistence backends. Mount it when a session's tool set should be restricted per preset or per session without changing the permission boundary.

## Table of Contents

- [Use this package](#use-this-package)
- [Understand the implementation](#understand-the-implementation)
- [Further Exploration](#further-exploration)
- [Model Experience](#model-experience)
- [Known Limitations and Deferred Work](#known-limitations-and-deferred-work)
- [Dev Note](#dev-note)

-----

<a id="use-this-package"></a>
## Use this package

Mount `dsh-tool-restriction` when a deployment needs a per-session tool mask chosen before the first turn and fixed for the session. The web GUI offers the picker and the `toolRestriction.select` RPC; a headless surface (the `dsh` CLI, the ACP server, the JSON-RPC/SDK surfaces) has no picker and composes sessions straight from the host (`agents.create`), so a per-session mask is set through config.

### Set the mask

`set(agent, mask)` is the one commit each blank-window path uses: it applies the visible-set restriction (validating every name against the session's inherited set, so a rejected mask never records) before appending the durable event, then writes `settings.byPreset[presetId]` (or clears it for an unrestricted selection). The caller owns the blank-window check — the feature's lock is enforced at the operation that makes it, so a selection after the first `turn/start` is refused before any write.

### Headless and web are one mechanism

The mask is a per-session fact — the durable `tool-restriction/selected` log event — and every surface drives the same host service. Web and headless differ only in the lever that writes the event, never in how the event is folded, applied, or trailed.

Three config levers choose a session's mask before its first turn, in precedence order:

1. **The preset's `tools.yml` `default`** — per-preset per-session, and the primary headless lever. A preset directory that publishes a `tools.yml` seeds every new session on that preset with the mask unless one was saved:

   ```yaml
   # <preset-dir>/tools.yml
   default:
     allow: [read, write]
   groups:
     Files: [read, write]
   ```

2. **The `tool-restriction` settings namespace** — the saved per-preset override (`byPreset.<id>`) and the settings `default`, written by the picker and editable by an operator (e.g. through the settings provider); materialized into the session log at creation. A saved override wins over the `tools.yml` default.

3. **The deployment default** — the plugin's `Config.default`, applied to sessions that compose no preset and derive nothing else.

A headless session with a mask then behaves exactly like a masked web session: `tools.schemas()` serves only the allowed tools, `guard()` denies the rest, `tool:<name>` guidance prose is filtered, and the session summary folds the mask — the same products, surfaced identically to every client.

The generated [configuration catalog](../../../docs/config-catalog.md#deepseek-aidsh-tool-restriction) is the exhaustive source for every accepted field.

-----

<a id="understand-the-implementation"></a>
## Understand the implementation

<details>
<summary>Implementation internals — click to expand</summary>

This section explains how the mask is folded and applied; the observable behavior is covered in [Use this package](#use-this-package).

### The selection event

The selection is the log-only `tool-restriction/selected: { mask?: { allow } }` event. [`resolveSessionToolRestriction`](src/index.ts) folds it last-wins; an absent `mask` restores the unrestricted default, and a present-but-empty `allow` (`{ allow: [] }`) is the deliberate talk-only spelling — the loop then omits the `tools` field.

### Application lifecycle

Application is a lifecycle duty: the service folds the events at `agent/created` and re-applies whenever a selection appends (the session/event dispatch is synchronous), so a resumed blank session re-masks and a session with history resumes under the exact tool set its history was produced under. A monotonic `guard()` denies any call whose name the live fold excludes, without re-registration on re-selection.

### The per-preset seed

Each preset remembers its own saved mask. A fresh blank session on preset P seeds from the per-preset chain — the saved override `settings.byPreset[P]`, else P's `tools.yml` default, else the deployment default — and the seed is materialized into the log so the session is self-contained (model-visible ⟺ logged). The service crosses no `SessionHeader` boundary; `resolveSessionPreset` provides the preset id from the log exactly like the knob family.

### Source map

| File | Role |
|---|---|
| [`src/index.ts`](src/index.ts) | Service, selection fold, guard, blank-window commit |
| [`src/types.ts`](src/types.ts) | Mask, wire projection, and per-preset settings types |
| [`src/invariant.ts`](src/invariant.ts) | Invariant companion: blank-window lock enforced durably |

</details>

-----

<a id="further-exploration"></a>
## Further Exploration

The mask rides the tool and settings seams; read these pages for the surrounding tool and permission contract.

- [tools](../../core/tools/README.md) — the tool registry, `tools.restrict`/`guard`, and guidance sections the mask rides.
- [settings](../../settings/README.md) — the durable user-settings seam the saved per-preset override lives in.
- [preset](../../preset/README.md) — the per-preset composition whose `tools.yml` seeds the mask.
- [sandbox Agent Note](../../../.agents/notes/implemented/feature/2026-07-06-sandbox.md) — the permission/approval knob family this mask sits beside.

-----

<a id="model-experience"></a>
## Model Experience

### Per-session tool mask

#### What the model sees

The mask is decided before the first request and then fixed, so both model-visible products follow it: the tool schemas (the registry's `schemas()` already honors `tools.restrict`) and the per-tool guidance sections. A `system-prompt/assemble` waterfall listener drops `tool:<name>` sections whose tool the mask excludes, so the model is never lectured about a tool it cannot call. Transport names (`tools:sdk`, the code-mode collapse) do not match the `tool:` convention and stay; a `complete` persona suppresses the whole band, making the filter a no-op there.

##### The durable record the model's tool set is reconstructed from

```markdown
tool-restriction/selected: { mask: { allow: ["read", "write"] } }
```

#### Token effect

Conditional and prefix-only. The mask does not add prompt tokens; it removes them (fewer tool schemas, fewer guidance sections) and its own record is a log-only event outside the model transcript.

#### KV Cache effect

Prefix-stable for the run. The blank-only selection precedes the first request, so neither the tool block nor the guidance prose changes after the first turn — the assembled prefix (identity, persona, guidance, tool block) is stable and history grows append-only. Resume re-applies the fold from the log before any request, preserving the same prefix. No package-owned change can invalidate an in-run prefix once the first `turn/start` has landed; provider cache availability and eviction remain outside the package contract.

## Known Limitations and Deferred Work

<a id="known-limitations-and-deferred-work"></a>

These limits define when the mask is a poor fit or needs special care. They are current package constraints, not a task backlog.

- **A mask is per-session policy, not a security boundary** — a masked tool is hidden from and denied to the model, but the process still hosts it, and the composition and its escalation knobs remain the trust boundary.
- **The `tool:<name>` section convention is the filter's key** — a tool whose guidance section does not follow it keeps its prose visible until an explicit section-owner field lands as hardening.
- **Awkward mid-session correction** — a user who under-selects during the blank window cannot fix the session in place; the lever is a new session or a fork, exactly like a preset. That trade buys the KV guarantee.
- **The per-preset settings map grows with roster ids** — a deleted preset leaves a stale `byPreset` entry that is inert until the id returns, under the roster's live-directory semantics.

<a id="dev-note"></a>
### Dev Note

<details>
<summary>Working context for maintainers — click to expand</summary>

This Dev Note is working context for maintainers; it is explicitly non-authoritative. The mask stays a per-session policy rather than a security boundary by design; a section-owner field for non-conforming tools remains deferred.

</details>
