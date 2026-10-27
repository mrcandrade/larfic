import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  gpsClock,
  lightDeflectionArcsec,
  tallBody,
  gravitacaoTerra as sim,
  G,
  GM,
  ME,
  RE,
  apparentG,
  ballRel,
  elevatorCase,
  gAt,
  gEffective,
  gInside,
  geoRadius,
  lightRel,
  mantleDensity,
  massInside,
  netForce,
  periodTunnel,
  potential,
  somigliana,
  weightlessDayH,
} from "../src/index.ts";

const runner = (over: Record<string, number>) => new Runner(sim, withOverrides(sim, over));

describe("Gravitação: superposição, interior da Terra e equivalência", () => {
  it("superposição: forças perpendiculares somam como vetores; ponto médio entre massas iguais tem F = 0", () => {
    const r = runner({ modo: 0, n: 2, mA: 1000, dA: 2, mB: 500, dB: 1, m0: 3 });
    const F1 = (G * 3 * 1000) / 4, F2 = (G * 3 * 500) / 1;
    expect(r.value("F")).toBeCloseTo(Math.hypot(F1, F2), 20);
    expect(r.value("Fdir")).toBeCloseTo((Math.atan2(F2, F1) * 180) / Math.PI, 8);
    const f = netForce([{ x: -2, y: 0, m: 700 }, { x: 2, y: 0, m: 700 }], 0, 0, 1);
    expect(f.F).toBeLessThan(1e-25);
    // Linearidade: dobrar uma das massas dobra só a sua parcela
    const f2 = netForce([{ x: 3, y: 0, m: 200 }], 0, 0, 1);
    expect(f2.fx).toBeCloseTo((G * 200) / 9, 22);
  });

  it("arrastar a partícula de teste muda a força (ponteiro)", () => {
    const r = runner({ modo: 0, n: 1, mA: 1000, dA: 2 });
    const p = r.params;
    const s1 = sim.pointer!.down!(r.state, p, { x: 0, y: 0 })!;
    expect(s1.drag).toBe(3);
    const s2 = sim.pointer!.move!(s1, p, { x: 1, y: 0 }, true)!;
    r.setState(s2);
    expect(r.value("F")).toBeCloseTo(G * 1000, 18);
  });

  it("g com a altitude: ISS ≈ 89%; GEO onde g = ω²r; equador perde ω²R", () => {
    expect(gAt(400e3) / gAt(0)).toBeCloseTo((6371 / 6771) ** 2, 10);
    expect(gAt(400e3) / gAt(0)).toBeGreaterThan(0.88);
    const rg = geoRadius();
    expect(rg / 1000).toBeCloseTo(42164, -1);
    const e = gEffective(rg - RE, 0);
    expect(Math.abs(e.up)).toBeLessThan(1e-9);
    const eq = gEffective(0, 0);
    expect(eq.g - eq.mag).toBeCloseTo(eq.w ** 2 * RE, 10);
    expect(eq.g - eq.mag).toBeCloseTo(0.0339, 3);
    const pole = gEffective(0, 90);
    expect(pole.mag).toBeCloseTo(GM / RE ** 2, 10);
    // Desvio do prumo é máximo perto de 45° e vale cerca de 0,1°
    expect(gEffective(0, 45).dev).toBeCloseTo(0.099, 2);
    // Dia em que o equador fica sem peso
    expect(weightlessDayH()).toBeCloseTo(1.41, 2);
    expect(gEffective(0, 0, weightlessDayH()).mag).toBeLessThan(1e-9);
    // Fórmula internacional: 9,780 no equador e 9,832 nos polos
    expect(somigliana(0)).toBeCloseTo(9.7803, 4);
    expect(somigliana(90)).toBeCloseTo(9.8322, 4);
  });

  it("interior: g linear na Terra uniforme, contínuo na superfície; núcleo denso mantém a massa e dá g máx ≈ 10,6 no limite do núcleo", () => {
    const uni = { kind: 0, rc: 3.48e6, rhoc: 10900 };
    expect(gInside(RE / 2, uni)).toBeCloseTo(gAt(0) / 2, 10);
    expect(gInside(RE * (1 - 1e-9), uni)).toBeCloseTo(gInside(RE * (1 + 1e-9), uni), 6);
    expect(gInside(0, uni)).toBe(0);
    const core = { kind: 1, rc: 3.48e6, rhoc: 10900 };
    expect(massInside(RE, core)).toBeCloseTo(ME, -18);
    expect(massInside(RE * 0.99999, core) / ME).toBeCloseTo(1, 4);
    expect(mantleDensity(core)).toBeCloseTo(4464, -1);
    expect(gInside(core.rc, core)).toBeCloseTo(10.6, 1);
    expect(gInside(core.rc, core)).toBeGreaterThan(gAt(0));
    expect(gInside(RE / 2, { kind: 2, rc: 0, rhoc: 0 })).toBe(0);
    // Potencial contínuo e −dU/dr = g
    for (const m of [uni, core]) {
      for (const r of [1e6, 3e6, 5e6]) {
        const h = 10;
        expect(-(potential(r + h, m) - potential(r - h, m)) / (2 * h)).toBeCloseTo(-gInside(r, m), 5);
      }
      expect(potential(RE * (1 - 1e-12), m)).toBeCloseTo(-GM / RE, 0);
    }
  });

  it("túnel uniforme: travessia em T/2 ≈ 42,2 min para qualquer corda, com v máx = ωA e energia conservada", () => {
    expect(periodTunnel() / 60).toBeCloseTo(84.35, 1);
    for (const b of [0, 3000]) {
      const r = runner({ modo: 3, modelo: 0, b });
      const E0 = r.value("E");
      let vmax = 0;
      while (r.state.tArr === 0 && !r.finished) {
        r.stepOnce();
        vmax = Math.max(vmax, Math.abs(r.state.v));
      }
      expect(r.state.tArr).toBeCloseTo(periodTunnel() / 2, -0.5);
      expect(Math.abs(r.state.tArr - periodTunnel() / 2)).toBeLessThan(0.5);
      const A = Math.sqrt(RE ** 2 - (b * 1000) ** 2);
      expect(vmax).toBeCloseTo(Math.sqrt(GM / RE ** 3) * A, -1);
      expect(Math.abs(r.value("E") / E0 - 1)).toBeLessThan(1e-9);
    }
  });

  it("túnel com núcleo denso: travessia mais curta (≈ 39 min) e ainda conservativa", () => {
    const r = runner({ modo: 3, modelo: 1, b: 0, rhoc: 10.9 });
    const E0 = r.value("E");
    while (r.state.tArr === 0 && !r.finished) r.stepOnce();
    const tmin = r.state.tArr / 60;
    expect(tmin).toBeLessThan(42);
    expect(tmin).toBeGreaterThan(37);
    expect(Math.abs(r.value("E") / E0 - 1)).toBeLessThan(1e-7);
  });

  it("elevador: parado na Terra e foguete com a = g são indistinguíveis por dentro; queda livre e deriva também", () => {
    const earth = elevatorCase(0, 9.8), rocket = elevatorCase(1, 9.8), fall = elevatorCase(2, 9.8), drift = elevatorCase(3, 9.8);
    expect(apparentG(earth)).toBe(apparentG(rocket));
    expect(apparentG(fall)).toBe(0);
    expect(apparentG(drift)).toBe(0);
    for (const t of [0.1, 0.3, 0.5]) {
      expect(ballRel(earth, 2.5, t).y).toBeCloseTo(ballRel(rocket, 2.5, t).y, 12);
      expect(lightRel(earth, 2.4, 10, t).y).toBeCloseTo(lightRel(rocket, 2.4, 10, t).y, 12);
      expect(ballRel(fall, 2.5, t).y).toBe(2.5);
      expect(lightRel(drift, 2.4, 10, t).y).toBe(2.4);
    }
    // Tempo de queda medido pela sim no foguete com a = 4,9: √(2·2,35/4,9)
    const r = runner({ modo: 4, situacao: 1, a: 4.9 });
    expect(ballRel(elevatorCase(1, 4.9), 2.5, 0).tHit).toBeCloseTo(Math.sqrt((2 * 2.35) / 4.9), 12);
    r.runToEnd();
    expect(r.value("yb")).toBeCloseTo(0, 12);
  });

  it("exercícios coincidem com a física da sim", () => {
    const ex = sim.exercises!.find((e) => e.id === "superposicao")!;
    const p = withOverrides(sim, { ...ex.fixed, m0: 2, mA: 900, dA: 3, mB: 400, dB: 2 });
    const r = new Runner(sim, p);
    expect(ex.answer.compute(p) * 1e-9).toBeCloseTo(r.value("F"), 18);
    const eq = sim.exercises!.find((e) => e.id === "equador")!;
    const pe = withOverrides(sim, { ...eq.fixed, m0: 70, dia: 24 });
    expect(eq.answer.compute(pe)).toBeCloseTo(new Runner(sim, pe).value("Pap"), 10);
  });
});

describe("Gravitação: corpo alto, desvio da luz e GPS", () => {
  it("corpo alto: CG abaixo do CM por ≈ L²/(6R); peso relativo R/(R + L)", () => {
    const q1 = tallBody(1000);
    expect(q1.diff).toBeCloseTo(1e6 / (6 * RE), 4);
    const q = tallBody(2e6);
    expect(q.hcg).toBeLessThan(q.hcm);
    expect(q.hcg).toBeCloseTo((RE * (RE + 2e6) * Math.log(1 + 2e6 / RE)) / 2e6 - RE, 3);
    expect(q.Frel).toBeCloseTo(RE / (RE + 2e6), 12);
    const r = new Runner(sim, withOverrides(sim, { modo: 5, Lh: 1 }));
    expect(r.value("dcg")).toBeCloseTo(0.0262, 3);
  });

  it("luz rente ao Sol: 1,75″; GPS: +45,7 µs/dia gravitacional, −7,2 cinemático, saldo ≈ 38,5", () => {
    expect(lightDeflectionArcsec(1)).toBeCloseTo(1.75, 2);
    expect(lightDeflectionArcsec(2)).toBeCloseTo(lightDeflectionArcsec(1) / 2, 12);
    const g = gpsClock(20200e3);
    expect(g.grav).toBeCloseTo(45.7, 0);
    expect(g.vel).toBeCloseTo(-7.2, 0);
    expect(g.net).toBeCloseTo(38.5, 0);
    expect(g.erroKm).toBeGreaterThan(10);
    // em órbita baixa o efeito cinemático vence
    expect(gpsClock(400e3).net).toBeLessThan(0);
    const r = new Runner(sim, withOverrides(sim, { modo: 6, h: 20200 }));
    for (let i = 0; i < 200; i++) r.stepOnce(); // 1 s de relógio = 1 h
    expect(r.value("gpsAcc")).toBeCloseTo((g.net * r.state.tau) / 86400, 9);
    expect(r.state.tau).toBeCloseTo(3600, 6);
  });
});
