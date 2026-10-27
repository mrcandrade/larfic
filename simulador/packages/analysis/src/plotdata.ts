// Dados para gráficos de relatório: faixa de confiança do ajuste, resíduos, CSV de séries e redução de pontos.
import type { FitResult } from "./fit.ts";
import type { FitKind } from "./practice.ts";
import { studentT } from "./stats.ts";

/**
 * Faixa de confiança da curva ajustada: f(x) ± t·σ_f(x), com σ_f² = gᵀ C g e g = ∂f/∂p.
 * Para exponencial e potência a covariância é a da reta linearizada (ln y), como no ajuste.
 * `scale` reescala a covariância (ex.: √(χ²/ν) quando χ²/ν > 1, como faz `analyze`).
 */
export function fitBand(kind: FitKind, fit: FitResult, xs: readonly number[], conf = 0.95, scale = 1): { x: number; y: number; lo: number; hi: number }[] {
  const t = studentT(conf, Math.max(1, fit.dof));
  const C = fit.cov;
  const quad = (g: number[]) => g.reduce((a, gi, i) => a + gi * g.reduce((b, gj, j) => b + C[i]![j]! * gj, 0), 0);
  return xs.map((x) => {
    const y = fit.f(x);
    let s: number;
    switch (kind) {
      case "proporcional": s = Math.sqrt(Math.max(0, quad([x]))); break;
      case "quadratico": s = Math.sqrt(Math.max(0, quad([1, x, x * x]))); break;
      case "exponencial": s = Math.abs(y) * Math.sqrt(Math.max(0, quad([1, x]))); break;
      case "potencia": s = Math.abs(y) * Math.sqrt(Math.max(0, quad([1, Math.log(x)]))); break;
      default: s = Math.sqrt(Math.max(0, quad([1, x])));
    }
    const h = t * s * scale;
    return { x, y, lo: y - h, hi: y + h };
  });
}

/** Malha de n pontos entre lo e hi (logarítmica se `log`). */
export function linspace(lo: number, hi: number, n: number, log = false): number[] {
  if (n < 2) return [lo];
  if (log && lo > 0 && hi > 0) {
    const a = Math.log10(lo), b = Math.log10(hi);
    return Array.from({ length: n }, (_, i) => 10 ** (a + ((b - a) * i) / (n - 1)));
  }
  return Array.from({ length: n }, (_, i) => lo + ((hi - lo) * i) / (n - 1));
}

/** Reduz uma série a no máximo `max` pontos (amostragem uniforme, mantém o último). */
export function decimate<T>(pts: readonly T[], max: number): T[] {
  if (pts.length <= max) return [...pts];
  const step = pts.length / max;
  const out: T[] = [];
  for (let i = 0; i < max - 1; i++) out.push(pts[Math.floor(i * step)]!);
  out.push(pts[pts.length - 1]!);
  return out;
}

/**
 * CSV de colunas numéricas (separador ;, vírgula decimal, como o Excel em português abre).
 * Rótulos com ; ou aspas são citados.
 */
export function columnsToCsv(columns: { label: string; values: readonly number[] }[]): string {
  const q = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);
  const n = Math.max(0, ...columns.map((c) => c.values.length));
  const lines = [columns.map((c) => q(c.label)).join(";")];
  for (let i = 0; i < n; i++) lines.push(columns.map((c) => (Number.isFinite(c.values[i]) ? String(c.values[i]).replace(".", ",") : "")).join(";"));
  return lines.join("\n") + "\n";
}
