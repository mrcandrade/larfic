import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { ARRANJO, DX, NX, TOOL, XB, cubaOndas as sim, lambda, type Cuba } from "../src/index.ts";

const runFor = (r: Runner<Cuba>, t: number) => {
  while (r.t < t - 1e-9) r.stepOnce();
  return r;
};
const at = (g: Float32Array, x: number, y: number) => g[Math.round(y / DX) * NX + Math.round(x / DX)]!;

describe("cuba de ondas", () => {
  it("uma fonte: distância entre cristas = λ = v/f", () => {
    const r = runFor(new Runner(sim, withOverrides(sim, { arranjo: ARRANJO.uma, f: 8, c: 20 })), 1.6);
    const [x0, y0] = r.state.src[0]!;
    const zeros: number[] = [];
    for (let i = Math.round(x0 / DX) + 6; i < 132; i++) {
      const a = at(r.state.u, i * DX, y0);
      const b = at(r.state.u, (i + 1) * DX, y0);
      if (a < 0 && b >= 0) zeros.push(i * DX + (DX * -a) / (b - a));
    }
    expect(zeros.length).toBeGreaterThanOrEqual(3);
    const spacing = (zeros[zeros.length - 1]! - zeros[0]!) / (zeros.length - 1);
    expect(spacing / lambda(r.params)).toBeCloseTo(1, 1);
  });

  it("duas fontes em fase: linha nodal (Δr = λ/2) tem intensidade muito menor que a mediatriz", () => {
    const r = runFor(new Runner(sim, withOverrides(sim, { arranjo: ARRANJO.duas, d: 5, f: 8, c: 20 })), 4);
    const [a, b] = r.state.src as [[number, number], [number, number]];
    const lam = lambda(r.params);
    const x = 22;
    // Ponto na hipérbole r₁ − r₂ = λ/2, por bissecção em y
    let lo = 12;
    let hi = 21;
    const f = (y: number) => Math.hypot(x - a[0], y - a[1]) - Math.hypot(x - b[0], y - b[1]) - lam / 2;
    for (let i = 0; i < 60; i++) {
      const mid = (lo + hi) / 2;
      if (f(mid) < 0) lo = mid;
      else hi = mid;
    }
    const Inodal = at(r.state.avg, x, lo);
    const Imax = at(r.state.avg, x, 12);
    expect(Imax).toBeGreaterThan(5e-3);
    expect(Inodal / Imax).toBeLessThan(0.05);
  });

  it("parede pintada com o ponteiro bloqueia a onda plana", () => {
    const p = withOverrides(sim, { arranjo: ARRANJO.plana });
    const r = new Runner(sim, p);
    let s: Cuba = { ...r.state, tool: TOOL.parede };
    s = sim.pointer!.down!(s, p, { x: 16, y: 0.4 })!;
    for (let y = 1; y <= 24; y += 1) s = sim.pointer!.move!(s, p, { x: 16, y: Math.min(y, 23.6) }, true)!;
    s = sim.pointer!.up!(s, p, { x: 16, y: 23.6 }) ?? s;
    r.setState(s);
    runFor(r, 3);
    const antes = at(r.state.avg, 10, 12);
    const depois = at(r.state.avg, 24, 12);
    expect(antes).toBeGreaterThan(0.05);
    expect(depois / antes).toBeLessThan(1e-3);
  });

  it("fenda simples: intensidade no primeiro mínimo (a sen θ = λ) bem menor que no eixo", () => {
    const r = runFor(new Runner(sim, withOverrides(sim, { arranjo: ARRANJO.fenda, a: 5, f: 8, c: 20 })), 4);
    const lam = lambda(r.params);
    const th = Math.asin(lam / 5);
    const R = 12;
    const Imin = at(r.state.avg, XB + R * Math.cos(th), 12 + R * Math.sin(th));
    const Ieixo = at(r.state.avg, XB + R, 12);
    expect(Imin / Ieixo).toBeLessThan(0.35);
  });

  it("estável: sem crescimento numérico depois de muito tempo", () => {
    const r = runFor(new Runner(sim, withOverrides(sim, { arranjo: ARRANJO.duas, c: 30, f: 12 })), 10);
    let max = 0;
    for (const v of r.state.u) max = Math.max(max, Math.abs(v));
    expect(Number.isFinite(max)).toBe(true);
    expect(max).toBeLessThanOrEqual(1.5);
  });
});
