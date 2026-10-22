import { describe, expect, it } from "vitest";
import { Runner, rad, withOverrides } from "@fisilab/core";
import { C, G, checkDCL, expected, forcasDcl as sim, forceScale, sum, type DCLState } from "../src/index.ts";

const P = (o: Record<string, number>) => withOverrides(sim, o);

describe("Forças e DCL", () => {
  it("em todas as situações, a soma das forças corretas é m·a", () => {
    const cases: (Record<string, number> & { m: number })[] = [
      { situacao: 0, m: 2, F: 12, ang: 30, mu: 0.3 },
      { situacao: 0, m: 3, F: 5, ang: 20, mu: 0.6 }, // parado: atrito estático
      { situacao: 1, m: 3, ang: 25, ang2: 65 },
      { situacao: 2, m: 5, ae: -3 },
      { situacao: 3, m: 2, ang: 35, mu: 0.3 },
      { situacao: 3, m: 2, ang: 15, mu: 0.5 },
    ];
    for (const c of cases) {
      const p = P(c);
      const e = expected(p);
      const [sx, sy] = sum(e.forces);
      expect(sx).toBeCloseTo(c.m * e.a[0], 9);
      expect(sy).toBeCloseTo(c.m * e.a[1], 9);
    }
  });

  it("valores analíticos: normal na mesa, trações nos fios, normal no elevador, aceleração na rampa", () => {
    const mesa = expected(P({ situacao: 0, m: 2, F: 12, ang: 30, mu: 0.3 }));
    const N = 2 * G - 12 * Math.sin(rad(30));
    expect(mesa.forces.find((f) => f.kind === "N")!.fy).toBeCloseTo(N, 10);
    expect(mesa.a[0]).toBeCloseTo((12 * Math.cos(rad(30)) - 0.3 * N) / 2, 10);

    const fios = expected(P({ situacao: 1, m: 3, ang: 30, ang2: 60 }));
    const T = fios.forces.filter((f) => f.kind === "T").map((f) => Math.hypot(f.fx, f.fy));
    expect(T[0]).toBeCloseTo(0.5 * 3 * G, 10);
    expect(T[1]).toBeCloseTo((Math.sqrt(3) / 2) * 3 * G, 10);

    const elev = expected(P({ situacao: 2, m: 5, ae: 2 }));
    expect(elev.forces.find((f) => f.kind === "N")!.fy).toBeCloseTo(5 * (G + 2), 10);

    const rampa = expected(P({ situacao: 3, m: 2, ang: 35, mu: 0.3 }));
    expect(Math.hypot(...rampa.a)).toBeCloseTo(G * (Math.sin(rad(35)) - 0.3 * Math.cos(rad(35))), 10);
  });

  it("verificação aceita o DCL correto (com pequenos desvios) e aponta erros", () => {
    const p = P({ situacao: 3, m: 2, ang: 35, mu: 0.3 });
    const exp = expected(p).forces;
    // desvio de 5° e 5% em cada força, ordem trocada
    const noisy = exp
      .map((f) => {
        const a = Math.atan2(f.fy, f.fx) + rad(5);
        const m = Math.hypot(f.fx, f.fy) * 1.05;
        return { kind: f.kind, fx: m * Math.cos(a), fy: m * Math.sin(a) };
      })
      .reverse();
    const ok = checkDCL(noisy, exp);
    expect(ok.ok).toBe(true);
    expect(ok.matched).toBe(3);

    // normal vertical (erro clássico), atrito faltando, força aplicada a mais
    const wrong = [
      { kind: "P" as const, fx: 0, fy: -2 * G },
      { kind: "N" as const, fx: 0, fy: 2 * G },
      { kind: "F" as const, fx: 5, fy: 0 },
    ];
    const r = checkDCL(wrong, exp);
    expect(r.ok).toBe(false);
    expect(r.matched).toBe(1);
    expect(r.status).toEqual(["ok", "dir", "extra"]);
    expect(r.lines.some((l) => l.text.startsWith("Falta"))).toBe(true);
  });

  it("arrastar a ponta da seta define módulo e direção da força", () => {
    const p = P({ situacao: 2, m: 5, ae: 0 });
    let st = sim.actions!.find((a) => a.id === "add-P")!.run(sim.init(p), p);
    const s = forceScale(p);
    const f0 = st.forces[0]!;
    st = sim.pointer!.down!(st, p, { x: C.x + f0.fx / s, y: C.y + f0.fy / s })!;
    expect(st.sel).toBe(0);
    st = sim.pointer!.move!(st, p, { x: C.x, y: C.y - (5 * G) / s }, true)!;
    st = sim.pointer!.up!(st, p, { x: 0, y: 0 })!;
    expect(st.forces[0]!.fx).toBeCloseTo(0, 9);
    expect(st.forces[0]!.fy).toBeCloseTo(-49, 9); // arredondado a 0,5 N
  });

  it("simulação: com o DCL correto o corpo do aluno acompanha o real; x = a t²/2", () => {
    const params = { situacao: 3, m: 2, ang: 35, mu: 0.3 };
    const r = new Runner(sim, withOverrides(sim, params));
    const exp = expected(r.params);
    r.setState({ ...(r.state as DCLState), forces: exp.forces.map((f) => ({ ...f })) });
    while (r.t < 1 - 1e-9) r.stepOnce();
    const st = r.state as DCLState;
    expect(Math.hypot(st.real.x, st.real.y)).toBeCloseTo(0.5 * Math.hypot(...exp.a) * r.t ** 2, 6);
    expect(r.value("desvio")).toBeCloseTo(0, 9);

    // sem a normal, o corpo do aluno cai e se separa do real
    const r2 = new Runner(sim, withOverrides(sim, params));
    r2.setState({ ...(r2.state as DCLState), forces: exp.forces.filter((f) => f.kind !== "N") });
    while (r2.t < 0.5 - 1e-9) r2.stepOnce();
    expect(r2.value("desvio")).toBeGreaterThan(0.3);
  });
});
