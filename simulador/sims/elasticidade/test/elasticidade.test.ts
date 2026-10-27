import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  MATERIAIS,
  MESA_A,
  MESA_B,
  elasticidade as sim,
  epsPermanente,
  epsY,
  medir,
  mesaDe,
  moduloG,
  moduloK,
  resolveMesa,
  sigmaCurva,
  sigmaHist,
  type Mesa,
} from "../src/index.ts";

const aco = MATERIAIS[0]!;
const borracha = MATERIAIS[7]!;
const pernas: [number, number][] = [
  [-MESA_A / 2, -MESA_B / 2],
  [MESA_A / 2, -MESA_B / 2],
  [MESA_A / 2, MESA_B / 2],
  [-MESA_A / 2, MESA_B / 2],
];

describe("Elasticidade", () => {
  it("módulos isotrópicos: G = E/2(1+ν), K = E/3(1−2ν), valores de catálogo", () => {
    expect(moduloG(aco) / 1e9).toBeCloseTo(77.52, 1);
    expect(moduloK(aco) / 1e9).toBeCloseTo(158.7, 0);
    // borracha: G ≈ 1 MPa, K ≈ 2,5 GPa (quase incompressível)
    expect(moduloG(borracha) / 1e6).toBeCloseTo(1, 9);
    expect(moduloK(borracha) / 1e9).toBeGreaterThan(2);
    expect(moduloK(aco) / moduloK(borracha)).toBeGreaterThan(40);
    expect(moduloK(aco) / moduloK(borracha)).toBeLessThan(100);
  });

  it("curva σ×ε: Hooke até σ_y, contínua, máximo σ_u em ε_u, borracha ≈ 3Gε para ε pequeno", () => {
    for (const m of MATERIAIS) {
      if (m.tipo === "borracha") continue;
      expect(sigmaCurva(m, epsY(m) / 2)).toBeCloseTo((m.E * epsY(m)) / 2, 0);
      expect(sigmaCurva(m, epsY(m) * (1 + 1e-9)) / m.sy).toBeCloseTo(1, 6);
      expect(sigmaCurva(m, m.eu) / m.su).toBeCloseTo(1, 9);
    }
    expect(sigmaCurva(borracha, 1e-4) / (3e6 * 1e-4)).toBeCloseTo(1, 3);
  });

  it("descarga elástica deixa deformação permanente ε_p = ε_max − σ(ε_max)/E", () => {
    const emax = 0.05;
    const ep = epsPermanente(aco, emax);
    expect(ep).toBeCloseTo(emax - sigmaCurva(aco, emax) / aco.E, 15);
    expect(sigmaHist(aco, ep, emax)).toBeCloseTo(0, 6);
    expect(sigmaHist(aco, emax - 0.001, emax)).toBeCloseTo(sigmaCurva(aco, emax) - aco.E * 0.001, 0);
    expect(epsPermanente(aco, epsY(aco) * 0.9)).toBe(0);
  });

  it("ensaio de tração rompe em ε_r; energia ≈ ∫σ dε (tenacidade)", () => {
    const p = withOverrides(sim, { modo: 0, mat: 0, T: 12 });
    const r = new Runner(sim, p).runToEnd(300);
    expect(r.finished).toBe(true);
    expect(r.state[0]).toBeCloseTo(aco.er, 9);
    let w = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) {
      const a = (aco.er * i) / n, b = (aco.er * (i + 1)) / n;
      w += 0.5 * (sigmaCurva(aco, a) + sigmaCurva(aco, b)) * (b - a);
    }
    expect(r.state[4]! / w).toBeCloseTo(1, 2);
  });

  it("cisalhamento e compressão: Δx = Fh/(GA), |ΔV|/V = p/K ao fim da rampa", () => {
    const p1 = withOverrides(sim, { modo: 1, mat: 7, A: 400, h: 50, Fmax: 20 });
    const r1 = new Runner(sim, p1).runToEnd(100);
    const m1 = medir(r1.state, p1);
    expect(m1.desl).toBeCloseTo((20e3 * 0.05) / (1e6 * 0.04), 9);
    const p2 = withOverrides(sim, { modo: 2, mat: 0, Fp: 35, dp: 20 });
    const r2 = new Runner(sim, p2).runToEnd(100);
    const m2 = medir(r2.state, p2);
    const pr = 35e3 / (Math.PI * 0.02 ** 2 / 4);
    expect(m2.y).toBeCloseTo(pr, 3);
    expect(m2.x).toBeCloseTo(pr / moduloK(aco), 12);
  });

  it("mesa sem folga: F_i = W(1/4 + x_w x_i/a² + y_w y_i/b²) e equilíbrio", () => {
    const mesa: Mesa = { pernas, folga: [0, 0, 0, 0], k: [1e7, 1e7, 1e7, 1e7] };
    const W = 1000, xw = 0.2, yw = -0.1;
    const s = resolveMesa(mesa, W, xw, yw);
    pernas.forEach(([x, y], i) => expect(s.F[i]).toBeCloseTo(W * (0.25 + (xw * x) / MESA_A ** 2 + (yw * y) / MESA_B ** 2), 6));
    expect(s.F.reduce((a, b) => a + b, 0)).toBeCloseTo(W, 8);
    expect(s.F.reduce((a, F, i) => a + F * pernas[i]![0], 0)).toBeCloseTo(W * xw, 8);
  });

  it("mesa manca: com a perna 4 curta, F1 = F3 = W/2 e F2 = 0 até W* = kδ", () => {
    const p = withOverrides(sim, { modo: 3, mat: 0, L0: 0.75, d: 10, delta: 0.05 });
    const mesa = mesaDe(p);
    const k = mesa.k[0]!;
    expect(k).toBeCloseTo((200e9 * Math.PI * 0.01 ** 2) / 4 / 0.75, 3);
    const Wst = k * 0.05e-3;
    const leve = resolveMesa(mesa, 0.5 * Wst, 0, 0);
    expect(leve.F[0]).toBeCloseTo(0.25 * Wst, 6);
    expect(leve.F[2]).toBeCloseTo(0.25 * Wst, 6);
    expect(leve.F[1]).toBeCloseTo(0, 6);
    expect(leve.F[3]).toBe(0);
    const limite = resolveMesa(mesa, Wst * (1 + 1e-9), 0, 0);
    expect(limite.F[3]).toBeLessThan(1e-3);
    const pesado = resolveMesa(mesa, 2 * Wst, 0, 0);
    expect(pesado.F[3]).toBeGreaterThan(0);
    expect(pesado.F.reduce((a, b) => a + b, 0)).toBeCloseTo(2 * Wst, 6);
    // com W ≫ kδ as forças tendem a W/4
    const muito = resolveMesa(mesa, 1e4 * Wst, 0, 0);
    expect(muito.F[3]! / (2.5e3 * Wst)).toBeCloseTo(1, 3);
  });
});
