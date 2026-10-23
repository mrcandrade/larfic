import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { T_HIT, colisoes as sim, colisoes, contactDuration, contactForce, final1D, peakForce, timeToContact } from "../src/index.ts";

const after = (over: Record<string, number>) => new Runner(sim, withOverrides(sim, over)).runToEnd();

describe("Colisões 1D e 2D", () => {
  it("1D: velocidades finais batem com as fórmulas fechadas para vários e", () => {
    for (const [m1, m2, v1, v2, e] of [
      [1, 1, 2, 0, 1],
      [2, 0.5, 3, -1, 0.7],
      [0.4, 5, 1.5, 0.2, 0.3],
      [3, 1, 2, -2, 0],
    ] as const) {
      const r = after({ modo: 0, m1, m2, v1, v2, e });
      const [a, b] = final1D(m1, m2, v1, v2, e);
      expect(r.state.hits).toBe(1);
      expect(r.value("v1x")).toBeCloseTo(a, 12);
      expect(r.value("v2x")).toBeCloseTo(b, 12);
      // Momento conservado; restituição medida = e.
      expect(r.value("px")).toBeCloseTo(m1 * v1 + m2 * v2, 12);
      expect((b - a) / (v1 - v2)).toBeCloseTo(e, 12);
    }
  });

  it("1D: energia dissipada = ½ μ (1 − e²) (v₁ − v₂)²", () => {
    const m1 = 2, m2 = 3, v1 = 2.5, v2 = -1, e = 0.4;
    const r = after({ modo: 0, m1, m2, v1, v2, e });
    const mu = (m1 * m2) / (m1 + m2);
    expect(r.value("dK")).toBeCloseTo(0.5 * mu * (1 - e * e) * (v1 - v2) ** 2, 12);
    // Perfeitamente inelástica: toda a K do referencial do CM é perdida.
    const r0 = after({ modo: 0, m1, m2, v1, v2, e: 0 });
    expect(r0.value("Kcm")).toBeCloseTo(0, 12);
    expect(r0.value("v1x")).toBeCloseTo(r0.value("v2x"), 12);
  });

  it("colisão resolvida no instante exato do contato (evento, não passo)", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, v1: 1.7, v2: -0.3 }));
    expect(timeToContact(r.state.b)).toBeCloseTo(T_HIT, 12);
    // Passo grosseiro que "pula" o contato: o resultado continua exato.
    const s = sim.step!(r.state, r.params, 0, 3.3);
    const [a, b] = final1D(1, 1, 1.7, -0.3, 1);
    expect(s.b[0].x).toBeCloseTo(-0.5 + a * (3.3 - T_HIT), 12);
    expect(s.b[1].x).toBeCloseTo(0.5 + b * (3.3 - T_HIT), 12);
  });

  it("2D: conserva p vetorial; elástica com massas iguais sai a 90°", () => {
    for (const b of [0.2, 0.5, 0.9]) {
      const r = after({ modo: 1, m1: 1, m2: 1, v1: 2, v2: 0, e: 1, b });
      expect(r.state.hits).toBe(1);
      expect(r.value("px")).toBeCloseTo(2, 12);
      expect(r.value("py")).toBeCloseTo(0, 12);
      expect(r.value("K")).toBeCloseTo(2, 12);
      expect(Math.abs(r.value("th1")) + Math.abs(r.value("th2"))).toBeCloseTo(90, 9);
      // Ângulo do alvo: sen θ₂ = b/D (impulso ao longo da linha dos centros).
      expect(Math.abs(r.value("th2"))).toBeCloseTo((Math.asin(b / 1) * 180) / Math.PI, 9);
    }
  });

  it("2D inelástica com massas diferentes: p conservado, K diminui", () => {
    const r = after({ modo: 1, m1: 3, m2: 1, v1: 1.5, v2: -1, e: 0.5, b: 0.6 });
    expect(r.value("px")).toBeCloseTo(3 * 1.5 - 1, 12);
    expect(r.value("py")).toBeCloseTo(0, 12);
    expect(r.value("dK")).toBeGreaterThan(0);
  });

  it("b maior que a soma dos raios: não há colisão", () => {
    const r = after({ modo: 1, b: 1.1 });
    expect(r.state.hits).toBe(0);
    expect(r.value("v1x")).toBe(2);
  });

  it("referencial do CM: momento total nulo, só a visualização muda", () => {
    const pLab = withOverrides(sim, { modo: 0, ref: 0, m1: 2, m2: 1, v1: 3, v2: -1, e: 0.6 });
    const pCM = { ...pLab, ref: 1 };
    const a = new Runner(sim, pLab).runToEnd();
    const b = new Runner(sim, pCM).runToEnd();
    expect(b.value("v1x")).toBe(a.value("v1x"));
    // u' = −e·u no CM
    const vcm = (2 * 3 + 1 * -1) / 3;
    expect(a.value("v1x") - vcm).toBeCloseTo(-0.6 * (3 - vcm), 12);
  });
});

describe("Colisões: para-choques de mola (força de contato finita)", () => {
  const runEnd = (o: Record<string, number>) => {
    const r = new Runner(colisoes, withOverrides(colisoes, { modo: 2, ref: 0, ...o }));
    r.runToEnd();
    return r;
  };

  it("elástica: velocidades finais da fórmula, impulso = m₂Δv₂ e momento conservado", () => {
    const r = runEnd({ m1: 1, m2: 3, v1: 2, v2: 0, e: 1, k: 200 });
    expect(r.state.b[0].vx).toBeCloseTo(-1, 2);
    expect(r.state.b[1].vx).toBeCloseTo(1, 2);
    expect(r.state.imp!).toBeCloseTo(3, 2);
    expect(r.value("px")).toBeCloseTo(2, 10);
    const hist = r.state.hist!;
    const Fmax = Math.max(...hist.map((h) => h[1]));
    expect(Fmax).toBeCloseTo(peakForce(0.75, 200, 2), 0);
    const dur = hist[hist.length - 1]![0] - hist[0]![0];
    expect(dur).toBeGreaterThan(contactDuration(0.75, 200, 1) - 0.01);
    expect(dur).toBeLessThan(contactDuration(0.75, 200, 1) + 0.01);
  });

  it("restituição e < 1 sai exata pelo modelo de carga e descarga", () => {
    const r = runEnd({ m1: 2, m2: 1, v1: 2, v2: -1, e: 0.5, k: 300 });
    const [a, b] = final1D(2, 1, 2, -1, 0.5);
    expect(r.state.b[0].vx).toBeCloseTo(a, 2);
    expect(r.state.b[1].vx).toBeCloseTo(b, 2);
    expect(r.state.hits).toBe(1);
  });

  it("rigidez 4× maior: mesmo impulso, metade da duração, o dobro do pico", () => {
    const a = runEnd({ m1: 1, m2: 3, v1: 2, v2: 0, e: 1, k: 100 });
    const b = runEnd({ m1: 1, m2: 3, v1: 2, v2: 0, e: 1, k: 400 });
    expect(b.state.imp!).toBeCloseTo(a.state.imp!, 2);
    const pk = (r: typeof a) => Math.max(...r.state.hist!.map((h) => h[1]));
    expect(pk(b) / pk(a)).toBeCloseTo(2, 1);
    expect(contactDuration(0.75, 400, 1) / contactDuration(0.75, 100, 1)).toBeCloseTo(0.5, 12);
  });

  it("par ação–reação: F₁₂ = −F₂₁ a cada instante e Δp₁ = −Δp₂", () => {
    const r = new Runner(colisoes, withOverrides(colisoes, { modo: 2, m1: 4, m2: 1, v1: 1.5, v2: -1.5, e: 1, k: 200 }));
    let seen = false;
    for (let i = 0; i < 1500; i++) {
      r.stepOnce();
      expect(r.value("F12")).toBeCloseTo(-r.value("F21"), 12);
      if (r.value("F12") > 1) seen = true;
    }
    expect(seen).toBe(true);
    const dp1 = 4 * (r.state.b[0].vx - 1.5), dp2 = 1 * (r.state.b[1].vx + 1.5);
    expect(dp1).toBeCloseTo(-dp2, 10);
    expect(r.state.b[1].vx).toBeCloseTo(3.3, 2);
    expect(contactForce(0.1, 0.1, 200, 0.5)).toBeCloseTo(20, 12);
    expect(contactForce(0.075, 0.1, 200, 0.5)).toBeCloseTo(0, 12);
  });
});
