import { describe, expect, it } from "vitest";
import { Runner, cross3, dot3, generateExercise, norm3, sub3, withOverrides, type V3 } from "@fisilab/core";
import { cameraBasis, finiteRotations, lookAlong, primedComponents, project, vetores3d as sim, type Vec3State } from "../src/index.ts";

const run = (p: Record<string, number>) => new Runner(sim, withOverrides(sim, p));

describe("Vetores em 3D", () => {
  it("produto vetorial pelo determinante e perpendicular a A e B", () => {
    const r = run({ modo: 3, Ax: 2, Ay: -1, Az: 3, Bx: 1, By: 4, Bz: -2 });
    // (−1·−2 − 3·4, 3·1 − 2·−2, 2·4 − (−1)·1) = (−10, 7, 9)
    expect(r.value("Cx")).toBeCloseTo(-10, 12);
    expect(r.value("Cy")).toBeCloseTo(7, 12);
    expect(r.value("Cz")).toBeCloseTo(9, 12);
    const C: V3 = [-10, 7, 9];
    expect(dot3(C, r.state.A)).toBeCloseTo(0, 12);
    expect(dot3(C, r.state.B)).toBeCloseTo(0, 12);
    // |A×B| = |A||B| sen θ
    const th = (r.value("theta") * Math.PI) / 180;
    expect(r.value("vetorial")).toBeCloseTo(r.value("modA") * r.value("modB") * Math.sin(th), 10);
  });

  it("produto escalar = |A||B| cos θ e projeção de A sobre B", () => {
    const r = run({ Ax: 3, Ay: 0, Az: 0, Bx: 2, By: 2, Bz: 0 });
    expect(r.value("theta")).toBeCloseTo(45, 10);
    expect(r.value("escalar")).toBeCloseTo(6, 12);
    expect(r.value("projAB")).toBeCloseTo(3 / Math.SQRT2, 12);
    expect(r.value("soma")).toBeCloseTo(Math.hypot(5, 2), 12);
  });

  it("base da câmera é ortonormal e dextrógira (r × u = f)", () => {
    for (const [yaw, pitch] of [[0.3, 0.4], [2, -0.7], [-1.2, 1.3]] as const) {
      const b = cameraBasis(yaw, pitch);
      expect(norm3(b.r)).toBeCloseTo(1, 12);
      expect(dot3(b.r, b.u)).toBeCloseTo(0, 12);
      const c = cross3(b.r, b.u);
      for (let i = 0; i < 3; i++) expect(c[i]).toBeCloseTo(b.f[i]!, 12);
    }
  });

  it("olhando ao longo de A×B, a rotação de A para B é anti-horária na tela", () => {
    const A: V3 = [1, 2, -1], B: V3 = [-2, 1, 3];
    const cam = lookAlong(cross3(A, B));
    const b = cameraBasis(cam.yaw, cam.pitch);
    const a2 = project(A, b), b2 = project(B, b);
    expect(a2[0] * b2[1] - a2[1] * b2[0]).toBeGreaterThan(0);
    // e com B×A fica horária
    const cam2 = lookAlong(cross3(B, A));
    const c = cameraBasis(cam2.yaw, cam2.pitch);
    const a3 = project(A, c), b3 = project(B, c);
    expect(a3[0] * b3[1] - a3[1] * b3[0]).toBeLessThan(0);
  });

  it("arrastar a ponta de A move o vetor no plano da tela; trocar A e B inverte A×B", () => {
    const p = withOverrides(sim, { modo: 0, Ax: 2, Ay: 1, Az: 1, Bx: -1, By: 2, Bz: 0 });
    const s0 = sim.init(p);
    const b = cameraBasis(s0.yaw, s0.pitch);
    const [ax, ay] = project(s0.A, b); // escala 1 com vetores pequenos
    const s1 = sim.pointer!.down!(s0, p, { x: ax, y: ay }) as Vec3State;
    expect(s1.drag?.kind).toBe("A");
    const s2 = sim.pointer!.move!(s1, p, { x: ax + 1, y: ay }, true) as Vec3State;
    const [nx, ny] = project(s2.A, b);
    expect(nx - ax).toBeCloseTo(1, 1);
    expect(ny - ay).toBeCloseTo(0, 1);
    const sw = sim.actions!.find((a) => a.id === "trocar")!.run(s0, p);
    const c0 = cross3(s0.A, s0.B), c1 = cross3(sw.A, sw.B);
    for (let i = 0; i < 3; i++) expect(c1[i]).toBeCloseTo(-c0[i]!, 12);
  });

  it("exercícios: ângulo e área conferem com a fórmula", () => {
    const ex = sim.exercises!.find((e) => e.id === "area")!;
    const inst = generateExercise(sim, ex, 3);
    const P = inst.params;
    const C = cross3([P.Ax!, P.Ay!, P.Az!], [P.Bx!, P.By!, P.Bz!]);
    expect(inst.answer).toBeCloseTo(Math.hypot(...C), 10);
  });
});

describe("Vetores em 3D: rotação dos eixos e rotações finitas", () => {
  it("girar os eixos muda as componentes, mas não o módulo nem o produto escalar", () => {
    const A: V3 = [4, 3, 0], B: V3 = [-1, 2, 0];
    const q90 = primedComponents(A, Math.PI / 2);
    expect(q90[0]).toBeCloseTo(3, 12);
    expect(q90[1]).toBeCloseTo(-4, 12);
    for (const phi of [0.3, 1.1, -2.4]) {
      const qa = primedComponents(A, phi), qb = primedComponents(B, phi);
      expect(norm3(qa)).toBeCloseTo(5, 12);
      expect(dot3(qa, qb)).toBeCloseTo(dot3(A, B), 12);
    }
    // φ = atan2(Ay, Ax) alinha x' com A
    const qa = primedComponents(A, Math.atan2(3, 4));
    expect(qa[0]).toBeCloseTo(5, 12);
    expect(qa[1]).toBeCloseTo(0, 12);
    const r = run({ modo: 4, Ax: 4, Ay: 3, Az: 0, phi: 90 });
    expect(r.value("Axl")).toBeCloseTo(3, 10);
    expect(r.value("Ayl")).toBeCloseTo(-4, 10);
    expect(r.value("modA")).toBeCloseTo(5, 12);
  });

  it("rotações de 90° em x e em y não comutam; as pequenas quase comutam (diferença ~ αβ)", () => {
    const { xy, yx } = finiteRotations([4, 0, 0], Math.PI / 2, Math.PI / 2);
    expect(xy[0]).toBeCloseTo(0, 12);
    expect(xy[2]).toBeCloseTo(-4, 12);
    expect(yx[1]).toBeCloseTo(4, 12);
    const r90 = run({ modo: 5, Ax: 4, Ay: 0, Az: 0, alfa: 90, beta: 90 });
    expect(r90.value("difRot")).toBeCloseTo(Math.SQRT2, 10);
    const small = (g: number) => run({ modo: 5, Ax: 4, Ay: 1, Az: 2, alfa: g, beta: g }).value("difRot");
    const d2 = small(2), d1 = small(1);
    expect(d2).toBeLessThan(0.002);
    expect(d2 / d1).toBeCloseTo(4, 1); // segunda ordem: dobrar os ângulos quadruplica
    // rotações em torno do mesmo eixo comutam sempre
    const same = finiteRotations([1, 2, 3], 0, 1.3);
    expect(norm3(sub3(same.xy, same.yx))).toBeCloseTo(0, 12);
  });
});
