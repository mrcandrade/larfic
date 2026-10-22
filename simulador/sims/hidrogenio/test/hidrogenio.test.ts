import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  angular,
  energyEV,
  hidrogenio as sim,
  meanR,
  mostProbableR,
  orbitalName,
  psi,
  quantum,
  radialP,
  radialZeros,
  sampleCloud,
  transitionNm,
} from "../src/index.ts";

const integrate = (f: (r: number) => number, R: number, N = 20000) => {
  const h = R / N;
  let acc = 0;
  for (let i = 0; i < N; i++) acc += f((i + 0.5) * h) * h;
  return acc;
};

describe("Átomo de hidrogênio", () => {
  it("funções radiais normalizadas e ⟨r⟩ = (a₀/2)[3n² − l(l+1)]", () => {
    for (const [n, l] of [[1, 0], [2, 0], [2, 1], [3, 1], [3, 2], [4, 3], [5, 2]] as const) {
      const R = n * (2.2 * n + 12);
      expect(integrate((r) => radialP(n, l, r), R)).toBeCloseTo(1, 5);
      expect(integrate((r) => r * radialP(n, l, r), R)).toBeCloseTo(meanR(n, l), 3);
    }
  });

  it("raio mais provável: a₀ (1s), 4a₀ (2p), 9a₀ (3d) e n²a₀ para l = n − 1", () => {
    expect(mostProbableR(1, 0)).toBeCloseTo(1, 4);
    expect(mostProbableR(2, 1)).toBeCloseTo(4, 4);
    expect(mostProbableR(3, 2)).toBeCloseTo(9, 4);
    expect(mostProbableR(5, 4)).toBeCloseTo(25, 3);
    // 2s: máximo externo em (3 + √5) a₀
    expect(mostProbableR(2, 0)).toBeCloseTo(3 + Math.sqrt(5), 4);
  });

  it("nós radiais: n − l − 1, nos zeros analíticos", () => {
    expect(radialZeros(2, 0)).toHaveLength(1);
    expect(radialZeros(2, 0)[0]!).toBeCloseTo(2, 5);
    const z3 = radialZeros(3, 0);
    expect(z3).toHaveLength(2);
    expect(z3[0]!).toBeCloseTo((9 - 3 * Math.sqrt(3)) / 2, 4);
    expect(z3[1]!).toBeCloseTo((9 + 3 * Math.sqrt(3)) / 2, 4);
    expect(radialZeros(4, 1)).toHaveLength(2);
    expect(radialZeros(3, 2)).toHaveLength(0);
  });

  it("harmônicos esféricos normalizados (complexos e reais) e formas px, dxy", () => {
    const Nt = 200;
    const Np = 200;
    for (const real of [false, true])
      for (const [l, m] of [[0, 0], [1, 1], [1, -1], [2, -2], [2, 0], [3, 2]] as const) {
        let acc = 0;
        for (let i = 0; i < Nt; i++) {
          const th = ((i + 0.5) * Math.PI) / Nt;
          for (let j = 0; j < Np; j++) {
            const [a, b] = angular(l, m, real, th, ((j + 0.5) * 2 * Math.PI) / Np);
            acc += (a * a + b * b) * Math.sin(th);
          }
        }
        expect(acc * (Math.PI / Nt) * ((2 * Math.PI) / Np)).toBeCloseTo(1, 3);
      }
    // px ∝ x: positivo em +x, nulo no plano yz
    expect(psi(2, 1, 1, true, 3, 0, 0)[0]).toBeGreaterThan(0);
    expect(psi(2, 1, 1, true, -3, 0, 0)[0]).toBeLessThan(0);
    expect(Math.abs(psi(2, 1, 1, true, 0, 2, 1)[0])).toBeLessThan(1e-12);
    // dxy ∝ xy
    expect(psi(3, 2, -2, true, 2, 2, 0)[0]).toBeGreaterThan(0);
    expect(psi(3, 2, -2, true, 2, -2, 0)[0]).toBeLessThan(0);
    expect(orbitalName(3, 2, -2, true)).toBe("3dxy");
    expect(orbitalName(2, 1, -1, true)).toBe("2py");
    // complexo m = 1: |ψ|² não depende de φ
    const a = psi(2, 1, 1, false, 2, 0, 1);
    const b = psi(2, 1, 1, false, 0, 2, 1);
    expect(a[0] ** 2 + a[1] ** 2).toBeCloseTo(b[0] ** 2 + b[1] ** 2, 12);
  });

  it("energias, degenerescência n² e série de Balmer", () => {
    expect(energyEV(1)).toBeCloseTo(-13.606, 3);
    expect(energyEV(2) / energyEV(1)).toBeCloseTo(0.25, 12);
    for (let n = 1; n <= 5; n++) {
      let g = 0;
      for (let l = 0; l < n; l++) g += 2 * l + 1;
      expect(g).toBe(n * n);
    }
    expect(transitionNm(3, 2)).toBeCloseTo(656.1, 0); // Hα
    expect(transitionNm(4, 2)).toBeCloseTo(486.0, 0); // Hβ
  });

  it("a nuvem amostrada reproduz ⟨r⟩ e a forma do orbital", () => {
    const c = sampleCloud(2, 1, 0, true, 6000, 7);
    let rsum = 0;
    let z2 = 0;
    let x2 = 0;
    for (let i = 0; i < c.count; i++) {
      const [x, y, z] = [c.pts[4 * i]!, c.pts[4 * i + 1]!, c.pts[4 * i + 2]!];
      rsum += Math.hypot(x, y, z);
      z2 += z * z;
      x2 += x * x;
    }
    expect(rsum / c.count).toBeGreaterThan(5 * 0.96);
    expect(rsum / c.count).toBeLessThan(5 * 1.04);
    // 2pz: ⟨z²⟩ = 3⟨x²⟩ (cos²θ contra sen²θ cos²φ)
    expect(z2 / x2).toBeGreaterThan(2.6);
    expect(z2 / x2).toBeLessThan(3.4);
  });

  it("l e m são ajustados às regras e o runner/câmera funcionam", () => {
    expect(quantum(2, 3, 4)).toMatchObject({ n: 2, l: 1, m: 1, adjusted: true });
    const p = withOverrides(sim, { giro: 1 });
    const r = new Runner(sim, p);
    const y0 = r.state.yaw;
    for (let i = 0; i < 30; i++) r.stepOnce();
    expect(r.state.yaw).toBeGreaterThan(y0);
    let s = sim.pointer!.down!(r.state, p, { x: -8, y: 0 })!;
    s = sim.pointer!.move!(s, p, { x: -6, y: 1 }, true)!;
    expect(s.pitch).not.toBe(r.state.pitch);
    expect(sim.pointer!.down!(r.state, p, { x: 10, y: 0 })).toBeUndefined();
  });
});
