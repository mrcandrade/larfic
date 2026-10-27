import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { massaMola as sim, massaMola, profileForce, profileWork } from "../src/index.ts";

describe("massa-mola", () => {
  it("sem atrito: x(t) = x0 cos(ωt)", () => {
    const r = new Runner(sim, withOverrides(sim, { k: 40, m: 1, x0: 0.3, v0: 0, mu: 0 }));
    while (r.t < 2 - 1e-9) r.stepOnce();
    expect(r.value("x")).toBeCloseTo(0.3 * Math.cos(Math.sqrt(40) * 2), 4);
  });

  it("atrito seco: amplitude cai 2μmg/k a cada meio ciclo", () => {
    const p = { k: 40, m: 1, x0: 0.4, v0: 0, mu: 0.05 };
    const r = new Runner(sim, withOverrides(sim, p));
    // Primeiro ponto de retorno: v troca de sinal de − para +
    let prevV = 0;
    let turn = NaN;
    while (r.t < 2) {
      r.stepOnce();
      const v = r.value("v");
      if (prevV < 0 && v >= 0) {
        turn = r.value("x");
        break;
      }
      prevV = v;
    }
    expect(turn).toBeCloseTo(-(0.4 - (2 * 0.05 * 9.81) / 40), 3);
  });

  it("balanço de energia fecha com atrito e força externa", () => {
    const r = new Runner(sim, withOverrides(sim, { mu: 0.1, F: 5, x0: 0.2 }));
    const E0 = r.value("bal");
    for (let i = 0; i < 20000; i++) r.stepOnce();
    expect(Math.abs(r.value("bal") - E0)).toBeLessThan(1e-3);
  });
});

describe("Massa-mola: força variável F(x) definida pelo aluno", () => {
  const P = { modo: 1, m: 1, mu: 0, x0: 0, v0: 0, F0: 2, F1: 6, F2: 10, F3: 4, F4: -4 };
  it("área por trapézios e interpolação linear", () => {
    const p = withOverrides(massaMola, P);
    expect(profileWork(0, 0.6, p)).toBeCloseTo(2.85, 12);
    expect(profileForce(0.525, p)).toBeCloseTo(0, 12);
    expect(profileForce(0.7, p)).toBe(0);
    expect(profileWork(0.6, 0, p)).toBeCloseTo(-2.85, 12);
  });

  it("teorema trabalho–energia: K − K₀ = área sob F(x); v máxima onde F troca de sinal", () => {
    const r = new Runner(massaMola, withOverrides(massaMola, P));
    let vmax = 0, xAtVmax = 0;
    while (!r.finished && r.t < 10) {
      r.stepOnce();
      const v = r.value("v");
      if (v > vmax) {
        vmax = v;
        xAtVmax = r.value("x");
      }
      // tolerância: a força salta de −4 N para 0 em x = 0,6 m (um passo de RK4 atravessa o salto)
      expect(r.value("K")).toBeCloseTo(profileWork(0, r.value("x"), r.params), 2);
    }
    expect(r.finished).toBe(true);
    expect(xAtVmax).toBeCloseTo(0.525, 2);
    expect(r.value("WF")).toBeCloseTo(2.85, 2);
    expect(r.value("v")).toBeCloseTo(Math.sqrt(2 * 2.85), 2);
  });
});
