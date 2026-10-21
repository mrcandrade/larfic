import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import { DISCO, achar, bateu, derivModulo, distFrenagem, forcaEletrica, jogosFisica as sim, type JF } from "../src/index.ts";

const runner = (over: Record<string, number>) => new Runner(sim, withOverrides(sim, over));
const acao = (r: Runner<JF>, id: string) => r.setState(sim.actions!.find((a) => a.id === id)!.run(r.state, r.params));

describe("Jogos de física", () => {
  it("Coulomb: força de uma carga a distância r (com amolecimento desprezível longe)", () => {
    const [fx, fy] = forcaEletrica([{ x: 0, y: 0, q: 50 }], 20, 0.5, 0);
    const F = (8.9875e9 * 50e-9 * 20e-9) / (0.5 ** 2 + 0.03 ** 2);
    expect(fx).toBeCloseTo(F * (0.5 / Math.hypot(0.5, 0.03)), 12);
    expect(fy).toBe(0);
  });

  it("hóquei: uma carga + atrás do disco faz o gol na fase 1 e a energia se conserva", () => {
    const r = runner({ jogo: 0, nivel: 0, exemplo: 1, qPeca: 50, Qdisco: 20 });
    const E0 = r.value("E");
    while (r.state.status === 0 && r.t < 30) r.stepOnce();
    expect(r.state.status).toBe(1);
    expect(r.state.pontos).toBeGreaterThan(500);
    expect(Math.abs(r.value("E") - E0) / E0).toBeLessThan(1e-6);
  });

  it("hóquei: arrastar uma carga da caixa e devolvê-la", () => {
    const p = withOverrides(sim, { jogo: 0 });
    let s = sim.init(p);
    s = sim.pointer!.down!(s, p, { x: 0.25, y: -0.18 })!;
    s = sim.pointer!.move!(s, p, { x: 0.05, y: 0.5 }, true)!;
    s = sim.pointer!.up!(s, p, { x: 0.05, y: 0.5 })!;
    expect(s.cargas).toEqual([{ x: 0.05, y: 0.5, q: 50 }]);
    s = sim.pointer!.down!(s, p, { x: 0.05, y: 0.5 })!;
    s = sim.pointer!.move!(s, p, { x: 0.3, y: -0.2 }, true)!;
    s = sim.pointer!.up!(s, p, { x: 0.3, y: -0.2 })!;
    expect(s.cargas).toHaveLength(0);
  });

  it("módulo: queda livre exata e foguete com massa variável", () => {
    const r = runner({ jogo: 1, g: 1.62, vx0: 0 });
    const y0 = r.state.L.y;
    while (r.t < 4 - 1e-9) r.stepOnce();
    expect(r.state.L.y).toBeCloseTo(y0 - 0.5 * 1.62 * 16, 6);
    expect(r.state.L.vy).toBeCloseTo(-1.62 * 4, 9);
    const a = derivModulo({ x: 0, y: 0, vx: 0, vy: 0, ang: 0, comb: 400 }, 5000, 1.62);
    expect(a.ay).toBeCloseTo(5000 / 1400 - 1.62, 12);
    expect(a.dm).toBeCloseTo(-5000 / 3000, 12);
    expect(distFrenagem(10, 3.62, 1.62)).toBeCloseTo(25, 12);
  });

  it("módulo: sem motor ele cai e se acidenta; o piloto automático pousa na Lua", () => {
    const r = runner({ jogo: 1, g: 1.62, piloto: 0, x0: 200, vx0: 0 });
    while (r.state.status === 0 && r.t < 120) r.stepOnce();
    expect(r.state.status).toBe(2);
    const r2 = runner({ jogo: 1, g: 1.62, piloto: 1, x0: 120, vx0: 0, Tmax: 5 });
    while (r2.state.status === 0 && r2.t < 300) r2.stepOnce();
    expect(r2.state.msg).toMatch(/Pouso perfeito/);
    expect(r2.state.status).toBe(1);
  });

  it("labirinto: controlando a aceleração, x = x0 + a t²/2; bater volta ao início", () => {
    const r = runner({ jogo: 2, nivel: 0, controle: 2 });
    const [sx, sy] = achar(0, "S");
    r.setState({ ...r.state, ctrl: [1, 0] });
    while (r.t < 1 - 1e-9) r.stepOnce();
    expect(r.state.pos[0]).toBeCloseTo(sx + 0.5 * 3 * 1, 6);
    expect(r.state.vel[0]).toBeCloseTo(3, 9);
    expect(r.state.pos[1]).toBeCloseTo(sy, 12);
    r.setState({ ...r.state, ctrl: [0, 1] }); // para cima: parede
    while (r.state.colisoes === 0 && r.t < 5) r.stepOnce();
    expect(r.state.colisoes).toBe(1);
    expect(r.state.pos).toEqual([sx, sy]);
    expect(bateu(0, 0.5, 0.5)).toBe(true);
    expect(bateu(0, sx, sy)).toBe(false);
  });

  it("labirinto: controlando a velocidade chega ao gol pelo caminho", () => {
    const r = runner({ jogo: 2, nivel: 0, controle: 1 });
    // S (1,5; 8,5) → desce até a linha 8 (y = 1,5) → direita até x = 5,5 → sobe até o G (4,5; 4,5)
    const ir = (c: [number, number], cond: () => boolean) => {
      r.setState({ ...r.state, ctrl: c });
      while (cond() && r.t < 60 && r.state.status === 0) r.stepOnce();
    };
    ir([0, -1], () => r.state.pos[1] > 1.5);
    ir([1, 0], () => r.state.pos[0] < 5.5);
    ir([0, 1], () => r.state.pos[1] < 4.5);
    ir([-1, 0], () => true);
    expect(r.state.status).toBe(1);
    expect(r.state.colisoes).toBe(0);
    expect(DISCO.m).toBe(1e-3);
  });
});
