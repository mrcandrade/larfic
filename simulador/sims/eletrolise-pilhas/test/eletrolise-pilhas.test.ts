import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  F,
  METALS,
  SOLUTES,
  alpha,
  association,
  batteryOcv,
  cellEmf,
  conductivity,
  eletrolisePilhas as sim,
  faradayMass,
  gasVolume,
  type EState,
} from "../src/index.ts";

const act = (s: EState, p: Record<string, number>, id: string) => sim.actions!.find((a) => a.id === id)!.run(s, p);

describe("Eletrólise, pilhas e baterias", () => {
  it("Ostwald: α do ácido acético satisfaz Ka = α²c/(1−α) e fortes conduzem mais", () => {
    const ac = SOLUTES[1]!;
    for (const c of [1e-3, 0.1, 1]) {
      const a = alpha(ac, c);
      expect((a * a * c) / (1 - a)).toBeCloseTo(1.8e-5, 10);
    }
    expect(alpha(ac, 1e-3)).toBeGreaterThan(alpha(ac, 0.1));
    expect(conductivity(SOLUTES[0]!, 0.1)).toBe(0);
    expect(conductivity(SOLUTES[3]!, 0.1) / conductivity(ac, 0.1)).toBeGreaterThan(50);
  });

  it("Faraday: massa e volumes de gás batem com Q = It (H₂ = 2·O₂)", () => {
    const p = withOverrides(sim, { modo: 1, eletrolise: 2, Vf: 6, Rcuba: 2 });
    const r = new Runner(sim, p);
    while (r.t < 10 - 1e-9) r.stepOnce(); // 10 s × 60 = 600 s
    const I = (6 - 1.7) / 2;
    expect(r.state.Q).toBeCloseTo(I * 600, 6);
    expect(r.value("Vgc") / r.value("Vga")).toBeCloseTo(2, 9);
    expect(r.value("Vgc")).toBeCloseTo(gasVolume(2, I * 600) * 1e6, 6);
    expect(faradayMass(63.546, 2, 600)).toBeCloseTo((63.546 * 600) / (2 * F), 12);
    // Abaixo da tensão de decomposição não há corrente.
    const q = withOverrides(sim, { modo: 1, eletrolise: 2, Vf: 1.5 });
    expect(new Runner(sim, q).value("I")).toBe(0);
  });

  it("Daniell: 1,10 V padrão, Nernst e conservação de carga entre as meias-células", () => {
    expect(cellEmf(METALS[2]!, 1, METALS[6]!, 1)).toBeCloseTo(1.1, 12);
    expect(cellEmf(METALS[2]!, 1, METALS[6]!, 0.01)).toBeCloseTo(1.1 - ((8.314462618 * 298.15) / (2 * F)) * Math.log(100), 9);
    const p = withOverrides(sim, { modo: 2, ca: 1, cc: 1, Rext: 10 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 200; i++) r.stepOnce();
    expect(r.state.ca - 1).toBeCloseTo(1 - r.state.cc, 9);
    expect(r.state.ca - 1).toBeCloseTo(r.state.Q / (2 * F * 0.1), 9);
    expect(r.value("E")).toBeLessThan(1.1);
    // Sem ponte salina, corrente nula.
    const s = act(r.state, p, "ponte");
    expect(sim.observables.find((o) => o.key === "I")!.value(s, p, 0)).toBe(0);
  });

  it("chumbo-ácido: FEM 6(ρ + 0,84), descarga até o corte e carga aumenta a densidade", () => {
    expect(batteryOcv(1)).toBeCloseTo(6 * (1.28 + 0.84), 12);
    const p = withOverrides(sim, { modo: 3, operacao: 0, Cah: 60, soc0: 100, Rl: 1.2 });
    const r = new Runner(sim, p);
    while (!r.state.cut && r.t < 200) r.stepOnce();
    expect(r.state.cut).toBe(true);
    expect(r.state.Ah).toBeGreaterThan(20);
    expect(r.state.Ah).toBeLessThan(60);
    const q = withOverrides(sim, { modo: 3, operacao: 1, soc0: 20 });
    const r2 = new Runner(sim, q);
    const rho0 = r2.value("rho");
    for (let i = 0; i < 500; i++) r2.stepOnce();
    expect(r2.value("rho")).toBeGreaterThan(rho0);
  });

  it("associação: série soma FEM e r; paralelo divide r; pilha invertida subtrai 2E", () => {
    expect(association(3, 1, 1.5, 0.5)).toEqual({ E: 4.5, r: 1.5 });
    expect(association(3, 1, 1.5, 0.5, 1).E).toBeCloseTo(1.5, 12);
    expect(association(2, 4, 1.5, 0.4).r).toBeCloseTo(0.2, 12);
    const p = withOverrides(sim, { modo: 4, Ns: 2, Np: 1, r: 0.5, Ra: 5 });
    const r = new Runner(sim, p);
    expect(r.value("I")).toBeCloseTo(3 / 6, 12);
  });
});
