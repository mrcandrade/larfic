import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { G, curvaInclinada as sim, faixaSegura, forcasEstrada, hMin, loopProfile, vIdeal } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Curvas inclinadas e loop", () => {
  it("estrada: na velocidade ideal o atrito necessário é zero e a faixa segura a contém", () => {
    const v = vIdeal(80, 15);
    expect(v).toBeCloseTo(Math.sqrt(G * 80 * Math.tan((15 * Math.PI) / 180)), 12);
    expect(forcasEstrada(v, 80, 15).f).toBeCloseTo(0, 12);
    const [lo, hi] = faixaSegura(80, 15, 0.3);
    expect(lo).toBeLessThan(v);
    expect(hi).toBeGreaterThan(v);
    expect(lo).toBe(0); // tan 15° < μ: parado não escorrega
    // nos limites, |f| = μN
    const [lo2, hi2] = faixaSegura(80, 30, 0.2);
    expect(lo2).toBeGreaterThan(0);
    for (const vv of [lo2, hi2]) {
      const fe = forcasEstrada(vv, 80, 30);
      expect(Math.abs(fe.f)).toBeCloseTo(0.2 * fe.N, 10);
    }
    // estrada plana: v_max = √(μgR)
    expect(faixaSegura(50, 0, 0.5)[1]).toBeCloseTo(Math.sqrt(0.5 * G * 50), 10);
  });

  it("estrada: dentro da faixa o carro não escorrega; acima de v_max derrapa para fora", () => {
    const ok = new Runner(sim, P({ modo: 0, R: 80, theta: 15, mu: 0.3, v: 20 }));
    for (let i = 0; i < 3000; i++) ok.stepOnce();
    expect(ok.value("dr")).toBe(0);
    const hi = faixaSegura(80, 15, 0.3)[1];
    const bad = new Runner(sim, P({ modo: 0, R: 80, theta: 15, mu: 0.3, v: hi + 3 }));
    bad.runToEnd(60);
    expect(bad.finished).toBe(true);
    expect(bad.value("dr")).toBeCloseTo(6, 6);
  });

  it("loop sem atrito: h_min = 2,5 R e N/mg = 2h/R − 2 + 3 cos φ", () => {
    expect(hMin(5, 0)).toBeCloseTo(12.5, 4);
    const prof = loopProfile(15, 5, 0, 720);
    expect(prof.ok).toBe(true);
    prof.phi.forEach((ph, i) => expect(prof.N[i]!).toBeCloseTo(6 - 2 + 3 * Math.cos(ph), 8));
    // com atrito precisa de mais altura
    expect(hMin(5, 0.1)).toBeGreaterThan(12.6);
  });

  it("h = 2R: descola onde cos φ = −2/3 e segue em voo livre", () => {
    const p = P({ modo: 1, Rl: 5, h: 10, mul: 0 });
    const r = new Runner(sim, p);
    r.runToEnd(30);
    expect(r.finished).toBe(true);
    expect(Math.cos(r.state.aDet)).toBeCloseTo(-2 / 3, 2);
    // energia conservada no voo
    expect(r.value("E")).toBeCloseTo(1000 * G * 10, -1);
  });

  it("loop completo: a normal no topo vale mg(2h/R − 5) e a energia se conserva", () => {
    const p = P({ modo: 1, Rl: 5, h: 15, mul: 0, m: 500 });
    const r = new Runner(sim, p);
    let Ntop = NaN;
    while (!r.finished && r.t < 30) {
      r.stepOnce();
      if (r.state.ph === 1 && Math.abs(r.state.a - Math.PI) < 0.01) Ntop = r.value("N");
    }
    expect(Ntop).toBeCloseTo(500 * G * (6 - 5), -1);
    expect(r.state.ph).toBe(3);
    expect(r.value("E") / (500 * G * 15)).toBeCloseTo(1, 5);
  });
});
