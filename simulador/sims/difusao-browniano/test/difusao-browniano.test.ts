import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  difusaoBrowniano as sim,
  dStokes,
  dTheory,
  enskog,
  fRightTheory,
  fitBrownD,
  fitGasD,
  lambda0,
  lambdaMeasured,
  massA,
  nGas,
  packing,
  profileTheory,
  temperatureOf,
  type DBState,
} from "../src/index.ts";

const make = (o: Record<string, number>) => new Runner<DBState>(sim, withOverrides(sim, o));
const run = (r: Runner<DBState>, n: number) => {
  for (let i = 0; i < n; i++) r.stepOnce();
  return r;
};

describe("difusão, livre caminho médio e movimento browniano", () => {
  it("soluções analíticas da difusão numa caixa: condição inicial, conservação e equilíbrio", () => {
    expect(fRightTheory(1, 0)).toBe(0);
    // As duas formas (meio infinito e série) se emendam continuamente.
    expect(fRightTheory(1, 0.00399 * 3600) / fRightTheory(1, 0.00401 * 3600)).toBeCloseTo(1, 2);
    expect(fRightTheory(1, 1e6)).toBeCloseTo(0.5, 9);
    expect(profileTheory(1, 1e-6, 10)).toBeCloseTo(1, 3);
    expect(profileTheory(1, 1e-6, 50)).toBeCloseTo(0, 3);
    // Integral do perfil sobre a caixa = metade (quantidade de A conservada).
    let integral = 0;
    for (let x = 0.05; x < 60; x += 0.1) integral += profileTheory(2, 200, x) * 0.1;
    expect(integral / 60).toBeCloseTo(0.5, 3);
    // Fração à direita = integral do perfil na metade direita.
    let right = 0;
    for (let x = 30.05; x < 60; x += 0.1) right += profileTheory(2, 200, x) * 0.1;
    expect(right / 30).toBeCloseTo(fRightTheory(2, 200), 3);
  });

  it("livre caminho médio medido concorda com 1/(√2 nσ) (rarefeito) e com Enskog (denso)", () => {
    const thin = run(make({ modo: 0, N: 200, d: 0.3 }), 2000);
    const n = nGas(thin.state);
    expect(lambdaMeasured(thin.state) / lambda0(n, 0.3)).toBeGreaterThan(0.92);
    expect(lambdaMeasured(thin.state) / lambda0(n, 0.3)).toBeLessThan(1.06);
    const dense = run(make({ modo: 0, N: 400, d: 1.0 }), 1500);
    const nd = nGas(dense.state);
    const lE = lambda0(nd, 1) / enskog(packing(nd, 1));
    expect(lambdaMeasured(dense.state) / lE).toBeGreaterThan(0.93);
    expect(lambdaMeasured(dense.state) / lE).toBeLessThan(1.07);
    expect(lambdaMeasured(dense.state)).toBeLessThan(0.85 * lambda0(nd, 1));
    // Colisões elásticas conservam a energia: T fica igual.
    expect(temperatureOf(dense.state, dense.params)).toBeCloseTo(300, 6);
  });

  it("interdifusão: D ajustado concorda com Chapman–Enskog (média de sementes)", () => {
    let sum = 0;
    for (const seed of [1, 2, 3]) {
      const r = run(make({ modo: 1, N: 300, d: 0.6, seed }), 2500);
      const D = fitGasD(r.state);
      sum += D / dTheory(nGas(r.state), 0.6, 300, massA(r.params), massA(r.params));
      expect(r.value("fR")).toBeGreaterThan(0.3);
    }
    expect(sum / 3).toBeGreaterThan(0.8);
    expect(sum / 3).toBeLessThan(1.25);
    // Espécie B mais leve difunde mais rápido (massa reduzida menor).
    expect(dTheory(0.1, 0.6, 300, 40 * 1.66e-27, 4 * 1.66e-27)).toBeGreaterThan(dTheory(0.1, 0.6, 300, 40 * 1.66e-27, 40 * 1.66e-27));
  }, 60000);

  it("browniano: ⟨r²⟩ = 4Dt com D de Einstein–Stokes e N_A da ordem de 6 × 10²³", () => {
    // D = kT/(6πηa): esfera de 0,5 µm em água a 300 K → 0,439 µm²/s
    const p = withOverrides(sim, { modo: 2 });
    expect(dStokes(p)).toBeCloseTo(0.4395, 3);
    expect(dStokes({ ...p, a: 1 })).toBeCloseTo(dStokes(p) / 2, 10);
    let ratio = 0;
    for (const seed of [1, 2, 3, 4]) {
      const r = run(make({ modo: 2, seed }), 1500);
      ratio += fitBrownD(r.state) / dStokes(r.params);
      expect(r.value("NA")).toBeGreaterThan(3);
      expect(r.value("NA")).toBeLessThan(12);
    }
    expect(ratio / 4).toBeGreaterThan(0.85);
    expect(ratio / 4).toBeLessThan(1.15);
  });
});
