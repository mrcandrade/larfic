import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  ME,
  OCTET,
  DECUPLET,
  REACTIONS,
  anti,
  annihilation,
  build,
  checkReaction,
  decayLength,
  gmoOctet,
  pairProduction,
  pairThreshold,
  particle,
  particulasElementares as sim,
  plainSym,
  predictOmega,
  texSym,
  thresholdK,
  width,
} from "../src/index.ts";

const rx = (l: string[], r: string[], K = 0) => checkReaction(l.map(particle), r.map(particle), K);

describe("partículas: dados e antipartículas", () => {
  it("antipartícula troca os números quânticos e o símbolo", () => {
    const pb = anti(particle("p"));
    expect(pb.q).toBe(-1);
    expect(pb.B).toBe(-1);
    expect(pb.sym).toBe("~p");
    expect(anti(particle("e-")).sym).toBe("e^+");
    expect(anti(particle("Sigma+")).sym).toBe("~Σ^-");
    expect(anti(particle("pi+")).sym).toBe("π^-");
    expect(anti(particle("pi0"))).toBe(particle("pi0"));
    expect(plainSym("~ν_e")).toBe("ν̄ₑ");
    expect(texSym("~Σ^-")).toBe("\\bar{\\Sigma}^{-}");
  });

  it("Γ = ħ/τ: a Δ(1232) com Γ = 117 MeV vive ~5,6 × 10⁻²⁴ s; voo de múon de 1 GeV ≈ 6,9 km", () => {
    expect(particle("Delta++").tau).toBeCloseTo(5.626e-24, 26);
    expect(width(particle("Delta++").tau)).toBeCloseTo(117, 6);
    const f = decayLength(105.6583755, 2.1969811e-6, 1000);
    expect(f.gamma).toBeCloseTo(1 + 1000 / 105.6583755, 10);
    expect(f.L / (f.gamma * f.beta * 2.99792458e8 * 2.1969811e-6)).toBeCloseTo(1, 12);
    expect(f.L).toBeGreaterThan(6.8e3);
    expect(f.L).toBeLessThan(7.0e3);
  });
});

describe("partículas: leis de conservação", () => {
  it("todas as reações prontas sem '?' são permitidas e as com '?' são proibidas (na energia sugerida)", () => {
    for (const r of REACTIONS) {
      const c = rx(r.left, r.right, r.K ?? 0);
      expect(c.allowed, r.label).toBe(!r.label.includes("?"));
    }
  });

  it("classifica a interação", () => {
    expect(rx(["n"], ["p", "e-", "anti-nue"]).interaction).toBe("fraca");
    expect(rx(["Lambda"], ["p", "anti-pi+"]).interaction).toBe("fraca");
    expect(rx(["pi0"], ["gamma", "gamma"]).interaction).toBe("eletromagnética");
    expect(rx(["Sigma0"], ["Lambda", "gamma"]).interaction).toBe("eletromagnética");
    expect(rx(["Delta++"], ["p", "pi+"]).interaction).toBe("forte");
    expect(rx(["anti-pi+", "p"], ["K0", "Lambda"], 1000).interaction).toBe("forte");
  });

  it("aponta a lei violada", () => {
    const pd = rx(["p"], ["anti-e-", "pi0"]);
    expect(pd.conserved.B).toBe(false);
    expect(pd.conserved.Le).toBe(false);
    const meg = rx(["mu-"], ["e-", "gamma"]);
    expect(meg.conserved.Lm).toBe(false);
    expect(rx(["n"], ["p", "e-"]).spinOk).toBe(false);
    expect(rx(["p"], ["n", "anti-e-", "nue"]).energyOk).toBe(false);
    expect(rx(["anti-pi+", "p"], ["anti-K+", "Sigma+"], 5000).dS).toBe(-2);
  });

  it("Q do decaimento β do nêutron = 0,782 MeV e limiar de p + p → p + p + π⁰ = 279,7 MeV", () => {
    expect(rx(["n"], ["p", "e-", "anti-nue"]).Q).toBeCloseTo(0.78233, 4);
    const mp = particle("p").m;
    const Kth = thresholdK(mp, mp, 2 * mp + particle("pi0").m);
    expect(Kth).toBeCloseTo(279.66, 1);
    expect(rx(["p", "p"], ["p", "p", "pi0"], Kth - 1).energyOk).toBe(false);
    expect(rx(["p", "p"], ["p", "p", "pi0"], Kth + 1).energyOk).toBe(true);
    // no limiar, √s = Σm
    expect(rx(["p", "p"], ["p", "p", "pi0"], Kth).available).toBeCloseTo(2 * mp + particle("pi0").m, 6);
  });
});

describe("partículas: caminho óctuplo e quarks", () => {
  it("Q = I₃ + (B + S)/2 posiciona os multipletos", () => {
    const pos = Object.fromEntries([...OCTET, ...DECUPLET].map((m) => [m.id, m]));
    expect(pos.p!.I3).toBeCloseTo(0.5, 12);
    expect(pos.Lambda!.I3).toBeCloseTo(0, 12);
    expect(pos["Xi-"]!.I3).toBeCloseTo(-0.5, 12);
    expect(pos["Delta++"]!.I3).toBeCloseTo(1.5, 12);
    expect(pos["Omega-"]!.S).toBe(-3);
  });

  it("previsão do Ω⁻ por espaçamento igual fica a ~1% do valor medido; Gell-Mann–Okubo a < 1%", () => {
    const pred = predictOmega();
    expect(Math.abs(pred - 1672.45) / 1672.45).toBeLessThan(0.01);
    const g = gmoOctet();
    expect(Math.abs(g.lhs - g.rhs) / g.rhs).toBeLessThan(0.01);
  });

  it("monta hádrons: uud = próton, sss só com spin 3/2, ud não existe livre", () => {
    const q = (s: string) => [...s.matchAll(/(~?)([udsc])/g)].map((m) => ({ f: m[2] as "u", bar: m[1] === "~" }));
    const p = build(q("uud"), false);
    expect(p.hadron?.name).toBe("próton");
    expect(p.q).toBeCloseTo(1, 12);
    expect(p.B).toBeCloseTo(1, 12);
    expect(p.quarkMass / p.hadron!.m).toBeLessThan(0.011);
    expect(build(q("uud"), true).hadron?.sym).toBe("Δ^+");
    expect(build(q("sss"), false).hadron).toBeNull();
    expect(build(q("sss"), true).hadron?.sym).toBe("Ω^-");
    expect(build(q("sss"), true).S).toBe(-3);
    expect(build(q("ud"), false).colorless).toBe(false);
    expect(build(q("u~d"), false).hadron?.sym).toBe("π^+");
    expect(build(q("s~u"), false).hadron?.sym).toBe("K^-");
    const pbar = build(q("~u~u~d"), false);
    expect(pbar.hadron?.name).toBe("antipróton");
    expect(pbar.q).toBeCloseTo(-1, 12);
  });
});

describe("partículas: aniquilação e produção de pares", () => {
  it("em repouso: dois fótons de 511 keV opostos; com K > 0 energia e momento se conservam", () => {
    const a0 = annihilation(0, 1);
    expect(a0.g1.E).toBeCloseTo(ME, 10);
    expect(a0.g2.E).toBeCloseTo(ME, 10);
    for (const [K, th] of [[2, 0.3], [7, 2.1], [0.5, Math.PI / 2]] as const) {
      const a = annihilation(K, th);
      expect(a.g1.E + a.g2.E).toBeCloseTo(K + 2 * ME, 10);
      expect(a.g1.E * Math.cos(a.g1.th) + a.g2.E * Math.cos(a.g2.th)).toBeCloseTo(a.pBeam, 10);
      expect(a.g1.E * Math.sin(a.g1.th) + a.g2.E * Math.sin(a.g2.th)).toBeCloseTo(0, 10);
    }
    // fóton para a frente: E = (E_total + p)/2
    const f = annihilation(3, 0);
    expect(f.g1.E).toBeCloseTo((3 + 2 * ME + Math.sqrt((3 + ME) ** 2 - ME * ME)) / 2, 10);
  });

  it("limiar 2mc²(1 + m/M): 4mc² com alvo elétron; produção conserva energia e momento", () => {
    expect(pairThreshold(ME)).toBeCloseTo(4 * ME, 12);
    expect(pairThreshold(1e9)).toBeCloseTo(2 * ME, 6);
    const M = 193729;
    expect(pairProduction(1.0, M, 0.2, 0.5).ok).toBe(false);
    const r = pairProduction(6, M, 0.25, 0.3);
    expect(r.ok).toBe(true);
    expect(r.Em + r.Ep + r.TN).toBeCloseTo(6, 8);
    const pe = (E: number) => Math.sqrt(E * E - ME * ME);
    expect(pe(r.Em) * Math.cos(0.25) + pe(r.Ep) * Math.cos(0.25) + r.q[0]).toBeCloseTo(6, 8);
    expect(pe(r.Em) * Math.sin(0.25) - pe(r.Ep) * Math.sin(0.25) + r.q[1]).toBeCloseTo(0, 8);
    expect(r.TN).toBeLessThan(1e-3);
  });
});

describe("partículas: simulação", () => {
  it("cada cenário roda; interação por ponteiro monta reação e sacola", () => {
    for (const sc of sim.scenarios) {
      const r = new Runner(sim, withOverrides(sim, sc.params));
      for (let i = 0; i < 30; i++) r.stepOnce();
      expect(r.observe().every(Number.isFinite)).toBe(true);
    }
    const p = withOverrides(sim, { tema: 1 });
    let s = sim.init(p);
    s = sim.actions!.find((a) => a.id === "limpar")!.run(s, p);
    expect(s.left).toEqual([]);
    const p3 = withOverrides(sim, { tema: 3, combo: 4 });
    const s3 = sim.init(p3);
    expect(s3.bag).toEqual([]);
    const s4 = sim.pointer!.down!(s3, p3, { x: -15.6, y: 6.6 })!;
    expect(s4.bag).toEqual([{ f: "u", bar: false }]);
  });
});
