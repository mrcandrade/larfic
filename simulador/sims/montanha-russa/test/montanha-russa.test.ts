import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { at, buildTrack, montanhaRussa as sim, startOn, trackOf, turningPoints, type Coaster, type Pt } from "../src/index.ts";

const run = (r: Runner<Coaster>, T: number) => {
  while (r.t < T - 1e-9) r.stepOnce();
};

describe("Montanha-russa e energia", () => {
  it("pista reta: comprimento, inclinação e curvatura nula", () => {
    const tr = buildTrack([[-8, 6], [0, 0]]);
    expect(tr.L).toBeCloseTo(10, 8);
    const q = at(tr, 5);
    expect(q.sin).toBeCloseTo(-0.6, 8);
    expect(q.cos).toBeCloseTo(0.8, 8);
    expect(q.k).toBeCloseTo(0, 8);
    expect(q.y).toBeCloseTo(3, 8);
  });

  it("sem atrito conserva K + U (meia-pipe, loop e dois vales)", () => {
    for (const pista of [0, 1, 2]) {
      const r = new Runner(sim, withOverrides(sim, { pista, h0: 7, mu: 0 }));
      const E0 = r.value("Em");
      let maxDev = 0;
      for (let i = 0; i < 15000; i++) {
        r.stepOnce();
        maxDev = Math.max(maxDev, Math.abs(r.value("Em") - E0) / E0);
      }
      expect(maxDev).toBeLessThan(1e-5);
    }
  });

  it("v no fundo = √(2g Δh) e sobe até a mesma altura do outro lado", () => {
    const p = withOverrides(sim, { pista: 0, h0: 6, mu: 0 });
    const r = new Runner(sim, p);
    const y0 = r.value("y");
    expect(y0).toBeCloseTo(6, 3);
    let vmax = 0, yAtVmax = 0, ymaxRight = 0;
    for (let i = 0; i < 6000; i++) {
      r.stepOnce();
      if (Math.abs(r.state.v) > vmax) {
        vmax = Math.abs(r.state.v);
        yAtVmax = r.value("y");
      }
      if (at(trackOf(r.state.pts), r.state.s).x > 0) ymaxRight = Math.max(ymaxRight, r.value("y"));
    }
    expect(vmax).toBeCloseTo(Math.sqrt(2 * 9.81 * (y0 - yAtVmax)), 3);
    expect(ymaxRight).toBeCloseTo(y0, 2);
  });

  it("rampa reta com atrito: a = g(sen θ − μ cos θ) e térmica = μ m g cos θ · d", () => {
    const pts: Pt[] = [[-8, 6], [8, -6]].map(([x, y]) => [x, y! + 6.5]) as Pt[];
    const p = withOverrides(sim, { mu: 0.2, m: 50 });
    const r = new Runner(sim, p);
    r.setState({ ...startOn(pts, p), s: 0, v: 0 });
    run(r, 1.5);
    const a = 9.81 * (0.6 - 0.2 * 0.8);
    expect(r.state.s).toBeCloseTo(0.5 * a * 1.5 ** 2, 5);
    expect(r.state.v).toBeCloseTo(a * 1.5, 5);
    expect(r.state.q).toBeCloseTo(0.2 * 50 * 9.81 * 0.8 * r.state.s, 3);
    // Energia total conservada mesmo com atrito.
    expect(r.value("E")).toBeCloseTo(50 * 9.81 * 12.5, 2);
  });

  it("atrito estático segura o carrinho quando tg θ ≤ μ", () => {
    const pts: Pt[] = [[-8, 4], [8, 0.5]];
    const p = withOverrides(sim, { mu: 0.3 });
    const r = new Runner(sim, p);
    r.setState({ ...startOn(pts, p), s: 5, v: 0 });
    run(r, 2);
    expect(r.state.s).toBe(5);
    expect(r.state.v).toBe(0);
  });

  it("normal no fundo da meia-pipe = m(g + v²κ)", () => {
    const p = withOverrides(sim, { pista: 0, h0: 6, mu: 0, m: 60 });
    const r = new Runner(sim, p);
    // Avança até o ponto mais baixo (maior velocidade).
    let prev = Infinity;
    while (r.value("y") < prev || r.t < 0.1) {
      prev = r.value("y");
      r.stepOnce();
    }
    const q = at(trackOf(r.state.pts), r.state.s);
    expect(q.k).toBeGreaterThan(0);
    expect(r.value("N")).toBeCloseTo(60 * (9.81 * q.cos + r.state.v ** 2 * q.k), 6);
    expect(r.value("N")).toBeGreaterThan(60 * 9.81);
  });

  it("pontos de retorno ficam na altura E/mg; com barreira, presos num vale", () => {
    const p = withOverrides(sim, { pista: 2, h0: 3.2, mu: 0 });
    const s0 = sim.init(p);
    const tr = trackOf(s0.pts);
    const [l, rr] = turningPoints(tr, s0.s + 0.5, 3.2);
    expect(l).not.toBeNull();
    expect(rr).not.toBeNull();
    expect(at(tr, l!).y).toBeCloseTo(3.2, 2);
    expect(at(tr, rr!).y).toBeCloseTo(3.2, 2);
    // O retorno direito fica antes do topo da lombada (x = 0).
    expect(at(tr, rr!).x).toBeLessThan(0);
    const r = new Runner(sim, p);
    let xmax = -Infinity;
    for (let i = 0; i < 10000; i++) {
      r.stepOnce();
      xmax = Math.max(xmax, at(trackOf(r.state.pts), r.state.s).x);
    }
    expect(xmax).toBeLessThan(0);
  });

  it("loop: a normal no alto troca de sinal perto de h₀ = y_fundo + 2,5R", () => {
    const nTop = (h0: number) => {
      const r = new Runner(sim, withOverrides(sim, { pista: 1, h0, mu: 0 }));
      let top = -1, N = 0, R = 0;
      for (let i = 0; i < 4000; i++) {
        r.stepOnce();
        const q = at(trackOf(r.state.pts), r.state.s);
        if (q.cos < 0 && q.y > top) {
          top = q.y;
          N = r.value("N");
          R = 1 / q.k;
        }
      }
      return { N, R, top };
    };
    const a = nTop(4.55), b = nTop(4.25);
    expect(a.R).toBeCloseTo(1.6, 1);
    expect(a.N).toBeGreaterThan(0);
    expect(b.N).toBeLessThan(0);
    // No alto: N = m(v²/R − g), com v² = 2g(h₀ − y_topo).
    expect(a.N).toBeCloseTo(60 * ((2 * 9.81 * (4.55 - a.top)) / a.R - 9.81), -1);
  });

  it("arrastar um ponto de controle muda a pista", () => {
    const p = withOverrides(sim, {});
    const s0 = sim.init(p);
    const [x, y] = s0.pts[4]!;
    const s1 = sim.pointer!.down!(s0, p, { x, y })!;
    expect(s1.drag).toBe(4);
    const s2 = sim.pointer!.move!(s1, p, { x, y: y + 2 }, true)!;
    expect(s2.pts[4]![1]).toBeCloseTo(y + 2, 9);
    expect(s2.pts).not.toBe(s0.pts);
    expect(sim.pointer!.up!(s2, p, { x, y: y + 2 })!.drag).toBeNull();
  });
});
