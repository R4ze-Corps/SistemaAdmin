import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import ts from "typescript";
import postcss from "postcss";

const require = createRequire(import.meta.url);
const cache = new Map();
function load(name, extra = "") {
  const key = name + extra;
  if (cache.has(key)) return cache.get(key);
  const source = readFileSync(new URL(`../src/app/${name}.tsx`, import.meta.url), "utf8") + extra;
  const code = ts.transpileModule(source, { compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022, jsx: ts.JsxEmit.ReactJSX, esModuleInterop: true } }).outputText;
  const compiled = { exports: {} };
  new Function("require", "module", "exports", code)(id => {
    if (id === "./auth-gate") return { default: ({ children }) => children, __esModule: true };
    if (id === "@vercel/blob/client") return { upload: () => { throw new Error("No real upload in design tests"); } };
    return id.startsWith("./") ? load(id.slice(2)) : require(id);
  }, compiled, compiled.exports);
  cache.set(key, compiled.exports);
  return compiled.exports;
}
const { WorkspaceContext } = load("workspace-context");
const page = load("page", "\nexport { Dashboard, BookingModal, BookingDetails, Switch };\n");
const finance = load("finance-panel", "\nexport { FinanceModal };\n");
const payables = load("payables-panel", "\nexport { PayableModal };\n");
const render = (component, props, mode) => renderToStaticMarkup(React.createElement(WorkspaceContext.Provider, { value: { mode, documentPrefix: mode === "beta" ? "beta/test/reservas/" : "reservas/" } }, React.createElement(component, props)));
const noop = () => {};
const cabin = { id: "c1", name: "Chalé Jardim", tone: "emerald" };
const booking = { id: "test", guestName: "Hóspede teste", cabinId: "c1", people: 2, start: "2026-10-01", end: "2026-10-03", checkIn: "14:00", checkOut: "11:00", pets: false, breakfast: true, decoration: false, intolerance: "", notes: "", status: "Reservado", documents: [{ id: "doc", name: "teste.pdf", type: "application/pdf", size: 100, pathname: "beta/test/reservas/test.pdf" }] };

test("calendar and save feedback appear only in Beta", () => {
  const production = render(page.Dashboard, {}, "production");
  const beta = render(page.Dashboard, {}, "beta");
  assert.doesNotMatch(production, /beta-save-status|beta-calendar-compact|data-beta-day/);
  assert.match(beta, /beta-save-status/);
  assert.match(beta, /beta-calendar-compact/);
  assert.match(beta, /C1 · Chalé 01/);
  assert.equal((beta.match(/data-beta-day="true"/g) || []).length, 42);
  assert.match(production, /text-\[9px\]/);
});
test("reservation native dialog, plain language and attachment labels are Beta only", () => {
  const props = { draft: booking, cabins: [cabin], setDraft: noop, onClose: noop, onSave: noop, onUpload: noop, onRemoveDocument: noop, uploadProgress: null };
  const beta = render(page.BookingModal, props, "beta");
  const production = render(page.BookingModal, props, "production");
  assert.match(beta, /<dialog/);
  assert.match(beta, /aria-labelledby=/);
  assert.match(beta, /aria-label="Remover teste.pdf"/);
  assert.match(beta, /O envio é privado e aceita arquivos grandes/);
  assert.doesNotMatch(beta, /multipart/);
  assert.doesNotMatch(production, /<dialog|aria-label="Remover/);
  assert.match(production, /multipart/);
});
test("document download and switch states are accessible only in Beta variant", () => {
  const props = { booking, cabin, onClose: noop, onEdit: noop, onDelete: noop, onStatus: noop };
  assert.match(render(page.BookingDetails, props, "beta"), /aria-label="Baixar teste.pdf"/);
  assert.doesNotMatch(render(page.BookingDetails, props, "production"), /aria-label="Baixar/);
  const switchProps = { label: "Leva pets", checked: true, onChange: noop };
  assert.match(render(page.Switch, switchProps, "beta"), /role="switch" aria-checked="true"/);
  assert.doesNotMatch(render(page.Switch, switchProps, "production"), /role="switch"/);
});
test("financial and payable forms keep the original modal in normal mode", () => {
  for (const [component, draft] of [[finance.FinanceModal, { kind: "entrada", description: "Teste", amount: 100, date: "2026-10-01", method: "PIX", category: "Hospedagem", notes: "" }], [payables.PayableModal, { productName: "Teste", description: "", amount: 100, startDate: "2026-10-01", dueDate: "2026-10-10", totalInstallments: 2, paidInstallments: 0 }]]) {
    const props = { draft, setDraft: noop, onSave: noop, onClose: noop };
    assert.match(render(component, props, "beta"), /<dialog/);
    assert.doesNotMatch(render(component, props, "production"), /<dialog/);
  }
});
test("every experimental CSS selector is scoped to the Beta wrapper", () => {
  const css = readFileSync(new URL("../src/app/beta.css", import.meta.url), "utf8");
  postcss.parse(css).walkRules(rule => {
    assert.ok(rule.selectors.every(selector => selector.includes(".beta-design")), rule.selector);
  });
  assert.match(css, /prefers-reduced-motion/);
  assert.match(css, /focus-visible/);
  assert.match(css, /\.beta-dialog \.grid-cols-2/);
  const gate = readFileSync(new URL("../src/app/auth-gate.tsx", import.meta.url), "utf8");
  assert.match(gate, /className=\{user.preferences.betaEnabled \? "beta-design" : undefined\}/);
});
test("Beta secondary text and selected-date colors have sufficient contrast", () => {
  function luminance(hex) { const rgb = hex.match(/../g).map(channel => parseInt(channel, 16) / 255).map(channel => channel <= .04045 ? channel / 12.92 : ((channel + .055) / 1.055) ** 2.4); return rgb[0] * .2126 + rgb[1] * .7152 + rgb[2] * .0722; }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  assert.ok(contrast("536158", "fffefa") >= 4.5);
  assert.ok(contrast("a8b8ae", "16221c") >= 4.5);
  assert.ok(contrast("82c69e", "16221c") >= 3);
});
