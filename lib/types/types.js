/**
 * Pure types of the tool-restriction domain: the per-session mask, its wire
 * projection, and the per-preset settings document. Free of this package's
 * host-side value imports (cordis, schemastery) so it can be consumed by the
 * wire contract and the browser surface without pulling the runtime. The
 * appended `Events` merge is type-only and is what makes the committed
 * selection a forwardable Host event (`ctx.remote.$on` key face).
 *
 * @module @deepseek-ai/dsh-tool-restriction/types
 */
export {};
//# sourceMappingURL=types.js.map