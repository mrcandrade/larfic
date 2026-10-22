import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { MOLECULES, absorbP, dipoleChange, expectedAbsorption, greenhouseIndex, staticDipole, moleculasLuz as sim } from "../src/index.ts";

const mol = (id: string) => MOLECULES.find((m) => m.id === id)!;
const nm = (cm1: number) => 1e7 / cm1;

describe("Moléculas e luz", () => {
  it("regra de seleção: modo ativo no IV ⇔ o dipolo Σqᵢdᵢ oscila", () => {
    for (const m of MOLECULES)
      m.modes.forEach((md, k) => {
        const [x, y] = dipoleChange(m, k);
        expect(Math.hypot(x, y) > 1e-9, `${m.id} ${md.name}`).toBe(md.ir);
      });
  });

  it("dipolo permanente das cargas é nulo exatamente nas moléculas simétricas", () => {
    for (const m of MOLECULES) {
      const [x, y] = staticDipole(m);
      expect(Math.hypot(x, y) > 1e-9, m.id).toBe(m.mu > 0 && m.id !== "O2");
    }
  });

  it("CO₂: absorve em 667 e 2349 cm⁻¹, é transparente em 1333 cm⁻¹ (estiramento simétrico)", () => {
    const co2 = mol("CO2");
    expect(absorbP(co2, nm(667))).toBeGreaterThan(0.8);
    expect(absorbP(co2, nm(2349))).toBeGreaterThan(0.8);
    expect(absorbP(co2, nm(1333))).toBeLessThan(1e-3);
    expect(absorbP(mol("N2"), nm(2331))).toBe(0);
    expect(absorbP(mol("CO2"), 2e7)).toBe(0); // micro-ondas: apolar
    expect(absorbP(mol("H2O"), 2e7)).toBeGreaterThan(0.5);
  });

  it("limiares de dissociação: O₂ abaixo de 242 nm, NO₂ abaixo de 398 nm", () => {
    expect(absorbP(mol("O2"), 300)).toBe(0);
    expect(absorbP(mol("O2"), 200)).toBeGreaterThan(0);
    expect(absorbP(mol("NO2"), 390)).toBeGreaterThan(0.5);
    expect(absorbP(mol("O3"), 250)).toBeGreaterThan(0.85);
  });

  it("potencial estufa: N₂ e O₂ nulos; H₂O e CO₂ relevantes", () => {
    expect(greenhouseIndex(mol("N2"))).toBe(0);
    expect(greenhouseIndex(mol("O2"))).toBeLessThan(1e-6);
    expect(greenhouseIndex(mol("H2O"))).toBeGreaterThan(0.3);
    expect(greenhouseIndex(mol("CO2"))).toBeGreaterThan(0.05);
    expect(greenhouseIndex(mol("CO2"))).toBeGreaterThan(greenhouseIndex(mol("CO")));
  });

  it("a fração absorvida medida converge para a prevista", () => {
    const p = withOverrides(sim, { mol: 4, fonte: 1, taxa: 10, seed: 3 });
    const r = new Runner(sim, p);
    for (let i = 0; i < 60000; i++) r.stepOnce();
    const s = r.state;
    const n = s.nAbs + s.nTrans;
    const f = expectedAbsorption(mol("CO2"), p);
    expect(n).toBeGreaterThan(5000);
    expect(Math.abs(s.nAbs / n - f)).toBeLessThan(4 * Math.sqrt((f * (1 - f)) / n) + 0.01);
    expect(s.nReem).toBeGreaterThan(0.9 * s.nAbs - 20);
  });
});
