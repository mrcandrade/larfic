import { clamp, type Draw, type TextStyle } from "@fisilab/core";

/** Escala (px por unidade) para a qual os tamanhos de fonte foram escolhidos. */
export const REF_SCALE = 22;
const FONT = `system-ui, -apple-system, "Segoe UI", sans-serif`;

/**
 * Texto com tamanho proporcional à escala do palco: em telas estreitas (celular) as fontes
 * encolhem junto com o desenho, até 60%, para os rótulos não se sobreporem.
 */
export function ui(d: Draw) {
  const k = clamp(1 / d.px / REF_SCALE, 0.6, 1);
  const sz = (s?: number) => (s ?? 12) * k;
  const text = (str: string, x: number, y: number, s: TextStyle = {}) =>
    d.text(str, x, y, { ...s, size: sz(s.size), dx: (s.dx ?? 0) * k, dy: (s.dy ?? 0) * k });
  const measure = (str: string, size: number, weight = "400") => {
    d.ctx.font = `${weight} ${size * k}px ${FONT}`;
    const m = d.ctx.measureText(str) as TextMetrics | undefined;
    return (m?.width ?? str.length * size * 0.55 * k) * d.px;
  };
  /**
   * Símbolo de partícula com barra, subscrito e sobrescrito. Marcação: "~" no início = barra,
   * "_x" = subscrito, "^x" ou "^{xy}" = sobrescrito. Ex.: "~ν_e", "Σ^{*+}", "Λ_c^+".
   */
  const sym = (s: string, x: number, y: number, o: { size?: number; color?: string; weight?: string; align?: "left" | "center" | "right" } = {}) => {
    const p = parseSym(s);
    const size = o.size ?? 14;
    const weight = o.weight ?? "600";
    const color = o.color ?? d.theme.text;
    const wb = measure(p.base, size, weight);
    const small = size * 0.64;
    const wx = Math.max(p.sub ? measure(p.sub, small) : 0, p.sup ? measure(p.sup, small) : 0);
    const W = wb + wx;
    const x0 = o.align === "left" ? x : o.align === "right" ? x - W : x - W / 2;
    const u = size * k * d.px;
    text(p.base, x0, y, { size, weight, color, align: "left" });
    if (p.bar) d.line(x0 + wb * 0.08, y + 0.62 * u, x0 + wb * 0.92, y + 0.62 * u, { color, width: Math.max(1, size / 12) });
    if (p.sup) text(p.sup, x0 + wb, y + 0.36 * u, { size: small, weight, color, align: "left" });
    if (p.sub) text(p.sub, x0 + wb, y - 0.3 * u, { size: small, weight, color, align: "left" });
    return W;
  };
  return { k, text, sym, measure };
}

export interface SymParts {
  bar: boolean;
  base: string;
  sub: string;
  sup: string;
}

export function parseSym(s: string): SymParts {
  let r = s;
  const bar = r.startsWith("~");
  if (bar) r = r.slice(1);
  const strip = (x: string) => x.replace(/^\{|\}$/g, "");
  let sup = "";
  let sub = "";
  const iSup = r.indexOf("^");
  if (iSup >= 0) {
    sup = strip(r.slice(iSup + 1));
    r = r.slice(0, iSup);
  }
  const iSub = r.indexOf("_");
  if (iSub >= 0) {
    sub = strip(r.slice(iSub + 1));
    r = r.slice(0, iSub);
  }
  return { bar, base: r, sub, sup: sup.replace(/-/g, "−") };
}

const SUP: Record<string, string> = { "+": "⁺", "−": "⁻", "0": "⁰", "*": "*" };
/** Símbolo em texto simples com Unicode (barra por macron combinante). */
export function plainSym(s: string): string {
  const p = parseSym(s);
  const base = p.bar ? [...p.base].map((c, i) => (i === 0 ? c + "̄" : c)).join("") : p.base;
  const sub = p.sub === "e" ? "ₑ" : p.sub ? `_${p.sub}` : "";
  return base + sub + [...p.sup].map((c) => SUP[c] ?? c).join("");
}

const GREEK: Record<string, string> = {
  α: "\\alpha", γ: "\\gamma", η: "\\eta", μ: "\\mu", ν: "\\nu", π: "\\pi", ρ: "\\rho", τ: "\\tau", φ: "\\phi", ψ: "\\psi", ω: "\\omega",
  Δ: "\\Delta", Λ: "\\Lambda", Σ: "\\Sigma", Ξ: "\\Xi", Ω: "\\Omega", "′": "'",
};
const tx = (s: string) => [...s].map((c) => (GREEK[c] ? `${GREEK[c]} ` : c)).join("").trim();
/** Símbolo em LaTeX. */
export function texSym(s: string): string {
  const p = parseSym(s);
  let out = p.bar ? `\\bar{${tx(p.base)}}` : `{${tx(p.base)}}`;
  if (p.sub) out += `_{${tx(p.sub)}}`;
  if (p.sup) out += `^{${p.sup.replace(/−/g, "-")}}`;
  return out;
}
