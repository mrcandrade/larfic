import { describe, expect, it } from "vitest";
import { K_COULOMB, Runner, withOverrides } from "@fisilab/core";
import {
  chargeForAngle,
  contactShare,
  eletrizacao as sim,
  leafAngle,
  qLeaves,
  R_KNOB,
  theta,
  tribEquilibrium,
  type EState,
} from "../src/index.ts";

const act = (s: EState, p: Record<string, number>, id: string) => sim.actions!.find((a) => a.id === id)!.run(s, p);

describe("Eletrização e eletroscópio", () => {
  it("atrito: vidro na seda fica positivo, a carga total se conserva e satura no valor da série", () => {
    const p = withOverrides(sim, { processo: 0, matBastao: 1, matPano: 4 });
    let s = sim.init(p);
    for (let i = 0; i < 6; i++) s = act(s, p, "esfregar");
    expect(s.rod.q).toBeGreaterThan(0);
    expect(s.rod.q + s.cloth.q).toBeCloseTo(0, 12);
    expect(s.rod.q).toBeCloseTo(tribEquilibrium(1, 4), 3);
    const pvc = withOverrides(sim, { processo: 0, matBastao: 8, matPano: 3 });
    const s2 = act(sim.init(pvc), pvc, "esfregar");
    expect(s2.rod.q).toBeLessThan(0);
  });

  it("abertura das folhas satisfaz o equilíbrio e o limite de ângulo pequeno", () => {
    const q = 10, L = 5, m = 30;
    const th = leafAngle(q, L, m);
    const F = (K_COULOMB * (q * 1e-9 / 2) ** 2) / (2 * L * 1e-2 * Math.sin(th)) ** 2;
    expect(F / (m * 1e-6 * 9.81 * Math.tan(th))).toBeCloseTo(1, 6);
    expect(chargeForAngle(th, L, m)).toBeCloseTo(q, 6);
    // Ângulo pequeno: θ³ ≈ kq²/(16 L² m g)
    const qs = 0.5;
    const small = Math.cbrt((K_COULOMB * (qs * 1e-9) ** 2) / (16 * (L * 1e-2) ** 2 * m * 1e-6 * 9.81));
    expect(leafAngle(qs, L, m) / small).toBeCloseTo(1, 2);
    expect(leafAngle(0, L, m)).toBe(0);
  });

  it("contato entre esferas iguala kQ/R e conserva a carga", () => {
    const [a, b] = contactShare(12, 2, 0, 2);
    expect(a).toBeCloseTo(6, 12);
    expect(b).toBeCloseTo(6, 12);
    const p = withOverrides(sim, { processo: 1, Q0: 15, Rs: 3 });
    let s = act(sim.init(p), p, "encostar");
    expect(s.qE).toBeCloseTo((15 * 2) / 5, 9);
    expect(s.rod.q / 3).toBeCloseTo(s.qE / 2, 9);
    s = act(s, p, "afastar");
    // Longe, a indução residual da esfera é pequena: folhas ≈ metade da carga.
    expect(Math.abs(qLeaves(s, p) - s.qE / 2)).toBeLessThan(0.1 * s.qE);
    expect(theta(s, p)).toBeGreaterThan(0);
  });

  it("indução com aterramento deixa carga oposta igual à carga imagem −QR/d", () => {
    const p = withOverrides(sim, { processo: 2, Q0: 12 });
    let s = act(sim.init(p), p, "aproximar");
    expect(s.qE).toBe(0);
    expect(qLeaves(s, p)).toBeGreaterThan(0);
    s = act(s, p, "terra");
    expect(qLeaves(s, p)).toBeCloseTo(0, 12);
    const d = Math.hypot(s.rod.x + 7 - 2.5 - 15, 0);
    expect(s.qE).toBeCloseTo((-12 * R_KNOB) / d, 9);
    s = act(s, p, "terra");
    s = act(s, p, "afastar");
    expect(s.qE).toBeLessThan(0);
    expect(qLeaves(s, p)).toBeLessThan(0);
    // Carga conservada contando a que veio da terra.
    expect(s.rod.q + s.qE - s.qGround).toBeCloseTo(12, 9);
  });

  it("papel salta para o bastão carregado próximo", () => {
    const p = withOverrides(sim, { processo: 2, Q0: 20 });
    const r = new Runner(sim, p);
    r.setState({ ...r.state, rod: { ...r.state.rod, x: -19.5, y: -11.6 } });
    for (let i = 0; i < 100; i++) r.stepOnce();
    expect(r.state.papers.some((pp) => pp.stuck)).toBe(true);
  });
});
