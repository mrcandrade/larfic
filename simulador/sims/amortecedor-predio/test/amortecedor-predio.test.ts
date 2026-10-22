import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { amortecedorPredio as sim, buildingModes, groundAcc, model, steadyTop, tmd } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("amortecedor de massa sintonizada", () => {
  it("1 andar: f = √(k/m)/2π", () => {
    const p = P({ n: 1, m: 100, k: 100 });
    expect(buildingModes(p).omega[0]!).toBeCloseTo(Math.sqrt(1e8 / 1e5), 8);
  });

  it("2 andares iguais: ω² = (3 ∓ √5)/2 · k/m", () => {
    const p = P({ n: 2, m: 100, k: 100 });
    const w = buildingModes(p).omega;
    expect(w[0]! ** 2).toBeCloseTo(((3 - Math.sqrt(5)) / 2) * 1000, 6);
    expect(w[1]! ** 2).toBeCloseTo(((3 + Math.sqrt(5)) / 2) * 1000, 6);
  });

  it("n andares: ω₁ = 2√(k/m) sen(π/(2(2n+1)))", () => {
    const p = P({ n: 5, m: 100, k: 100 });
    expect(buildingModes(p).omega[0]!).toBeCloseTo(2 * Math.sqrt(1000) * Math.sin(Math.PI / 22), 8);
  });

  it("regime senoidal simulado = solução harmônica", () => {
    const params = { n: 3, exc: 0, f: 2.0, ag: 0.5, zeta: 5 };
    const p = P(params);
    const r = new Runner(sim, p);
    while (r.t < 25) r.stepOnce();
    let mA = 0, mB = 0;
    while (r.t < 30) {
      r.stepOnce();
      mA = Math.max(mA, Math.abs(r.value("xA")));
      mB = Math.max(mB, Math.abs(r.value("xB")));
    }
    expect(mA / 100).toBeCloseTo(steadyTop(p, 2.0, false), 4);
    expect(mB / 100 / steadyTop(p, 2.0, true)).toBeCloseTo(1, 2);
  });

  it("TMD de Den Hartog reduz o pico de ressonância em mais da metade", () => {
    const p = P({ n: 5, mu: 3, zeta: 2 });
    const c = model(p);
    expect(Math.max(...c.fr.B)).toBeLessThan(0.5 * Math.max(...c.fr.A));
    const d = tmd(p);
    expect(d.fd).toBeCloseTo(c.modes.omega[0]! / (2 * Math.PI) / 1.03, 8);
  });

  it("registro sintético tem pico de aceleração igual ao ajustado", () => {
    const p = P({ exc: 2, ag: 2, seed: 4 });
    let mx = 0;
    for (let t = 0; t < 40; t += 0.005) mx = Math.max(mx, Math.abs(groundAcc(p, t)));
    expect(mx).toBeCloseTo(2, 6);
  });
});
