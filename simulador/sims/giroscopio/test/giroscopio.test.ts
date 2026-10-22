import { describe, expect, it } from "vitest";
import { Runner, generateExercise, withOverrides } from "@fisilab/core";
import { giroscopio as sim, inertia, omegaFast, omegaSteady, w3Min } from "../src/index.ts";

const run = (p: Record<string, number>) => new Runner(sim, withOverrides(sim, p));
const steps = (r: Runner<unknown>, n: number) => {
  for (let i = 0; i < n; i++) r.stepOnce();
};

describe("Giroscópio, pião e precessão", () => {
  it("disco: I₃ = MR²/2, I₁ = MR²/4 + Ml² e Ω = 2gl/(R²ω₃)", () => {
    const p = withOverrides(sim, { M: 0.8, R: 0.06, l: 0.1, w3: 300 });
    const k = inertia(p);
    expect(k.I3).toBeCloseTo(0.5 * 0.8 * 0.0036, 14);
    expect(k.I1).toBeCloseTo(0.25 * 0.8 * 0.0036 + 0.8 * 0.01, 14);
    expect(omegaFast(p)).toBeCloseTo((2 * 9.81 * 0.1) / (0.0036 * 300), 12);
  });

  it("lançado na precessão estacionária: θ fica constante e φ̇ = raiz lenta", () => {
    const r = run({ lanc: 1, w3: 250, theta0: 60 });
    const st = omegaSteady(r.params);
    let thMin = 90, thMax = 0;
    for (let i = 0; i < 10000; i++) {
      r.stepOnce();
      const th = r.value("theta");
      thMin = Math.min(thMin, th);
      thMax = Math.max(thMax, th);
    }
    expect(thMax - thMin).toBeLessThan(0.01);
    expect(r.value("phiMed")).toBeCloseTo(st, 4);
    // a raiz lenta é um pouco maior que Mgl/(I₃ω₃) para θ < 90°
    expect(st).toBeGreaterThan(omegaFast(r.params));
  });

  it("giroscópio rápido solto do repouso: precessão média ≈ Mgl/(I₃ω₃) e nutação ≈ I₃ω₃/I₁", () => {
    const r = run({ lanc: 0, w3: 700, theta0: 70 });
    const W = omegaFast(r.params);
    const { I1, I3 } = inertia(r.params);
    const wn = (I3 * 700) / I1;
    // mede o período de nutação pelos mínimos de θ
    const mins: number[] = [];
    let a = r.value("theta"), b = a;
    for (let i = 0; i < 15000; i++) {
      r.stepOnce();
      const c = r.value("theta");
      if (b < a && b < c) mins.push(r.t - r.dt);
      a = b;
      b = c;
    }
    expect(r.value("phiMed") / W).toBeGreaterThan(0.97);
    expect(r.value("phiMed") / W).toBeLessThan(1.03);
    const Tn = (mins[mins.length - 1]! - mins[1]!) / (mins.length - 2);
    expect((2 * Math.PI) / Tn / wn).toBeCloseTo(1, 1);
  });

  it("conserva energia, L_z e ω₃ (pião lento com grande nutação)", () => {
    const r = run({ lanc: 3, w3: 60, theta0: 40 });
    const E0 = r.value("E"), Lz0 = r.value("Lz"), w0 = r.value("w3");
    steps(r, 20000);
    expect(Math.abs(r.value("E") - E0) / Math.abs(E0)).toBeLessThan(1e-7);
    expect(r.value("Lz")).toBeCloseTo(Lz0, 9);
    expect(r.value("w3")).toBeCloseTo(w0, 6);
  });

  it("corpo livre: o eixo gira em torno de L com Ω = |L|/I₁ e θ constante", () => {
    const r = run({ modo: 1, w3: 60, theta0: 15 });
    const { I1, I3 } = inertia(r.params);
    const Lmag = (I3 * 60) / Math.cos((15 * Math.PI) / 180);
    steps(r, 10000);
    expect(r.value("theta")).toBeCloseTo(15, 6);
    expect(r.value("phiMed")).toBeCloseTo(Lmag / I1, 5);
    expect(I3 / I1).toBeCloseTo(2, 12);
  });

  it("velocidade mínima para precessão estacionária", () => {
    const p = withOverrides(sim, { w3: 10, theta0: 30 });
    expect(Number.isNaN(omegaSteady(p))).toBe(true);
    const wm = w3Min(p);
    expect(Number.isFinite(omegaSteady({ ...p, w3: wm * 1.001 }))).toBe(true);
  });

  it("câmera gira ao arrastar", () => {
    const r = run({});
    const s1 = sim.pointer!.down!(r.state, r.params, { x: 0, y: 0 })!;
    const s2 = sim.pointer!.move!(s1, r.params, { x: 0.5, y: 0 }, true)!;
    expect(s2.cam.yaw).not.toBeCloseTo(r.state.cam.yaw, 3);
  });

  it("exercícios coerentes", () => {
    const inst = generateExercise(sim, sim.exercises![1]!, 3);
    expect(inst.answer).toBeGreaterThan(0);
  });
});
