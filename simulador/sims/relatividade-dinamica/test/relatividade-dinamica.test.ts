import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  PARTICLES,
  T_LAB,
  dopplerLambda,
  earthNowForTraveler,
  energy,
  kinetic,
  observedLambda,
  pcFromK,
  properTime,
  signalCounts,
  simultaneityJump,
  totalProperTime,
  tripOf,
  relatividadeDinamica as sim,
} from "../src/index.ts";

describe("Gêmeos, Doppler e E = mc²", () => {
  it("gêmeos clássicos: β = 0,8, D = 4 al → Terra 10 anos, viajante 6 anos", () => {
    const tr = tripOf(withOverrides(sim, { beta: 0.8, D: 4 }));
    expect(tr.T).toBeCloseTo(10, 12);
    expect(totalProperTime(tr)).toBeCloseTo(6, 12);
    expect(properTime(tr, 5)).toBeCloseTo(3, 12);
  });

  it("contagem de pulsos: o pulso do ano 1 chega na virada; 10 ao todo; Terra recebe 3 em 9 anos e 6 no total", () => {
    const tr = tripOf(withOverrides(sim, { beta: 0.8, D: 4 }));
    expect(signalCounts(tr, 5 - 1e-6).travelerReceived).toBe(0);
    expect(signalCounts(tr, 5 + 1e-6).travelerReceived).toBe(1);
    const end = signalCounts(tr, 10);
    expect(end.travelerReceived).toBe(10);
    expect(end.earthReceived).toBe(6);
    expect(end.travelerSent).toBe(6);
    expect(signalCounts(tr, 9 - 1e-6).earthReceived).toBe(2);
    expect(signalCounts(tr, 9 + 1e-6).earthReceived).toBe(3);
  });

  it("simultaneidade salta na virada: t_P(1 − β²) → t_P(1 + β²)", () => {
    const tr = tripOf(withOverrides(sim, { beta: 0.8, D: 4 }));
    const j = simultaneityJump(tr);
    expect(j.before).toBeCloseTo(5 * 0.36, 12);
    expect(j.after).toBeCloseTo(5 * 1.64, 12);
    expect(earthNowForTraveler(tr, 2.5)).toBeCloseTo(2.5 * 0.36, 12);
  });

  it("runner para no reencontro e o τ observado bate", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 0, beta: 0.6, D: 3 }));
    r.runToEnd(100);
    expect(r.finished).toBe(true);
    expect(r.value("T")).toBeCloseTo(10, 6);
    expect(r.value("tau")).toBeCloseTo(8, 6);
  });

  it("Doppler: fatores relativísticos e observadores com atraso", () => {
    expect(dopplerLambda(500, 0.6)).toBeCloseTo(1000, 10);
    expect(dopplerLambda(500, -0.6)).toBeCloseTo(250, 10);
    // no início a nave vai para a direita: o observador da direita vê azul, o da esquerda, vermelho
    const lr = observedLambda(0.5, 600, 9.3, 3);
    const ll = observedLambda(0.5, 600, -9.3, 3);
    expect(lr).toBeCloseTo(dopplerLambda(600, -0.5), 6);
    expect(ll).toBeCloseTo(dopplerLambda(600, 0.5), 6);
  });

  it("força constante: passo exato, v < c, K = F·x e massa invariante conservada", () => {
    const p = withOverrides(sim, { modo: 2, particula: 0, F: 0.1 });
    const r = new Runner(sim, p);
    r.runToEnd(100);
    const mc2 = PARTICLES[0]!.mc2;
    expect(r.value("tlab")).toBeCloseTo(T_LAB, 6);
    expect(r.value("pc")).toBeCloseTo(0.1 * T_LAB, 9);
    expect(r.value("v")).toBeLessThan(1);
    expect(r.value("vc")).toBeGreaterThan(1);
    expect(0.1 * r.state.xr).toBeCloseTo(kinetic(r.state.pc, mc2), 9);
    // tempo próprio analítico (mc²/F) asinh(pc/mc²)
    expect(r.value("taup")).toBeCloseTo((mc2 / 0.1) * Math.asinh(2 / mc2), 9);
    expect(r.value("minv")).toBeCloseTo(mc2, 9);
  });

  it("E² = (pc)² + (mc²)² e pc a partir de K", () => {
    const mc2 = 938.272;
    const pc = pcFromK(1000, mc2);
    expect(energy(pc, mc2)).toBeCloseTo(1000 + mc2, 9);
  });
});
