import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  commutatorNorm,
  diskEmf,
  dynamoMean,
  dynamoOut,
  kTheta,
  motoresGeradores as sim,
  noLoadOmega,
  pendulum,
  stallTorque,
  starPhasors,
  steadyOmega,
  dcMotor,
  homo,
  cabs,
  brakeC,
  pendInertia,
} from "../src/index.ts";

/** Média numérica de f em [0, 2π). */
const mean = (f: (x: number) => number, n = 20000) => {
  let s = 0;
  for (let i = 0; i < n; i++) s += f((2 * Math.PI * i) / n);
  return s / n;
};

describe("Motores e geradores", () => {
  it("comutador: k(θ) tem média k₀ para qualquer número de bobinas", () => {
    for (const m of [1, 2, 3, 6]) expect(mean((th) => kTheta(0.02, m, th))).toBeCloseTo(0.02, 6);
    expect(commutatorNorm(1)).toBeCloseTo(Math.PI / 2, 12);
    // ondulação de torque cai com mais bobinas
    const ripple = (m: number) => {
      let lo = Infinity, hi = 0;
      for (let i = 0; i < 2000; i++) {
        const k = kTheta(1, m, (Math.PI * i) / 2000);
        lo = Math.min(lo, k);
        hi = Math.max(hi, k);
      }
      return (hi - lo) / hi;
    };
    expect(ripple(1)).toBeCloseTo(1, 2);
    expect(ripple(3)).toBeLessThan(0.15);
  });

  it("motor DC atinge a rotação de regime ω = (kV − Rτ)/(k² + Rb), e a partida tem i = V/R", () => {
    const p = withOverrides(sim, { modo: 0, V: 6, R: 2, k: 20, carga: 10, bobinas: 6 });
    const r = new Runner(sim, p);
    r.stepOnce();
    expect(r.value("i")).toBeGreaterThan(0.9 * (6 / 2));
    r.runToEnd(3);
    const mp = dcMotor(p);
    expect(r.value("omega") / steadyOmega(mp)).toBeCloseTo(1, 2);
    // em regime, torque médio ≈ carga + atrito; corrente ≈ τ/k
    expect(r.value("i")).toBeCloseTo((0.01 + mp.b * r.value("omega")) / mp.k, 1);
    expect(stallTorque(mp)).toBeCloseTo((0.02 * 6) / 2, 12);
    expect(noLoadOmega(mp)).toBeCloseTo(300, 9);
  });

  it("disco de Faraday: ε = ½Bωa² e roda de Barlow tende a ω = kV/(k² + Rb)", () => {
    expect(diskEmf(0.5, 100, 0.1)).toBeCloseTo(0.25, 12);
    const r = new Runner(sim, withOverrides(sim, { modo: 1, disp: 0, B: 0.8, a: 15, rpm: 300 }));
    r.runToEnd(0.2);
    expect(r.value("fem")).toBeCloseTo(diskEmf(0.8, (300 * 2 * Math.PI) / 60, 0.15), 9);
    const p = withOverrides(sim, { modo: 1, disp: 2, V: 1.5 });
    const h = homo(p);
    const m = new Runner(sim, p);
    m.runToEnd(1.5);
    expect(m.value("omega") / ((h.k * 1.5) / (h.k * h.k + h.R * h.b))).toBeCloseTo(1, 2);
  });

  it("dínamo × alternador: média 2ε/π (1 bobina), V_ef = ε/√2", () => {
    expect(mean((th) => dynamoOut(10, th, 1))).toBeCloseTo(20 / Math.PI, 4);
    expect(dynamoMean(10, 1)).toBeCloseTo(20 / Math.PI, 12);
    expect(mean((th) => dynamoOut(10, th, 3))).toBeCloseTo(dynamoMean(10, 3), 4);
    expect(Math.sqrt(mean((th) => (10 * Math.sin(th)) ** 2))).toBeCloseTo(10 / Math.SQRT2, 6);
    const r = new Runner(sim, withOverrides(sim, { modo: 2, rpm: 120, N: 200, B: 0.5, a: 10 }));
    r.runToEnd(0.3);
    const e0 = 200 * 0.5 * 0.01 * 4 * Math.PI;
    expect(Math.abs(r.value("vAlt"))).toBeLessThanOrEqual(e0 + 1e-9);
    expect(r.value("vAlt")).toBeCloseTo(e0 * Math.sin(r.state.th), 9);
  });

  it("trifásico: V_L = √3 V_f, neutro sem corrente com carga equilibrada e potência constante", () => {
    const bal = starPhasors({ Vf: 127, seq: 1, R: [50, 50, 50], neutral: true });
    expect(cabs(bal.Vline[0]!)).toBeCloseTo(127 * Math.sqrt(3), 9);
    expect(cabs(bal.IN)).toBeLessThan(1e-9);
    expect(bal.P).toBeCloseTo((3 * 127 * 127) / 50, 6);
    const r = new Runner(sim, withOverrides(sim, { modo: 3, Ra: 50, Rb: 50, Rc: 50 }));
    const ps: number[] = [];
    for (let i = 0; i < 400; i++) {
      r.stepOnce();
      ps.push(r.value("P3"));
    }
    expect(Math.max(...ps) - Math.min(...ps)).toBeLessThan(1e-6 * bal.P);
    // desequilíbrio: com neutro há I_N; sem neutro, I_N = 0 e o centro da estrela se desloca
    const un = starPhasors({ Vf: 127, seq: 1, R: [20, 50, 50], neutral: true });
    expect(cabs(un.IN)).toBeCloseTo(127 / 20 - 127 / 50, 6);
    const nn = starPhasors({ Vf: 127, seq: 1, R: [20, 50, 50], neutral: false });
    expect(cabs(nn.IN)).toBeLessThan(1e-9);
    expect(cabs(nn.shift)).toBeGreaterThan(10);
  });

  it("Waltenhofen: energia + calor se conserva; placa maciça freia muito mais que a com fendas", () => {
    const r = new Runner(sim, withOverrides(sim, { modo: 4, Bw: 0.3, theta0: 45 }));
    const E0 = r.value("EtotA");
    r.runToEnd(4);
    expect(Math.abs(r.value("EtotA") - E0) / E0).toBeLessThan(1e-4);
    expect(r.value("ampA")).toBeLessThan(3);
    expect(r.value("ampB")).toBeGreaterThan(20);
    // sem campo: oscilam igual, período de pêndulo físico
    const z = new Runner(sim, withOverrides(sim, { modo: 4, Bw: 0, theta0: 10 }));
    z.runToEnd(3);
    expect(z.value("thA")).toBeCloseTo(z.value("thB"), 9);
    expect(z.value("ampA")).toBeCloseTo(10, 3);
    // decaimento independe da espessura (c e I ambos ∝ δ)
    const a = pendulum(withOverrides(sim, { esp: 1 }), false);
    const b = pendulum(withOverrides(sim, { esp: 4 }), false);
    const rate = (pp: typeof a) => brakeC(pp, 0) / pendInertia(pp);
    expect(rate(a) / rate(b)).toBeCloseTo(1, 1);
    expect(brakeC(b, 0) / brakeC(a, 0)).toBeCloseTo(4, 9);
  });
});
