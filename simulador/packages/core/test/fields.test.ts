import { describe, expect, it } from "vitest";
import {
  K_COULOMB,
  contourLines,
  fieldAt,
  fieldLines,
  forceOn,
  gridGradientAt,
  gridValueAt,
  makeGrid,
  potentialAt,
  sampleGrid,
  solveLaplace,
  systemEnergy,
  traceFieldLine,
  type PointCharge,
} from "../src/index.ts";

const B = { xMin: -2, xMax: 2, yMin: -2, yMax: 2 };

describe("campo e potencial de cargas pontuais", () => {
  it("Coulomb: |E| = kq/r² e V = kq/r", () => {
    const c: PointCharge[] = [{ x: 0, y: 0, q: 1e-9 }];
    const [ex, ey] = fieldAt(c, 0.3, 0.4);
    expect(Math.hypot(ex, ey)).toBeCloseTo((K_COULOMB * 1e-9) / 0.25, 9);
    expect(ex / ey).toBeCloseTo(0.75, 12);
    expect(potentialAt(c, 0.3, 0.4)).toBeCloseTo((K_COULOMB * 1e-9) / 0.5, 9);
  });

  it("E = −∇V por diferenças finitas", () => {
    const cs: PointCharge[] = [{ x: -0.5, y: 0.1, q: 2 }, { x: 0.7, y: -0.3, q: -1 }];
    const h = 1e-6;
    const [ex, ey] = fieldAt(cs, 0.2, 0.6, { k: 1 });
    const gx = (potentialAt(cs, 0.2 + h, 0.6, { k: 1 }) - potentialAt(cs, 0.2 - h, 0.6, { k: 1 })) / (2 * h);
    const gy = (potentialAt(cs, 0.2, 0.6 + h, { k: 1 }) - potentialAt(cs, 0.2, 0.6 - h, { k: 1 })) / (2 * h);
    expect(ex).toBeCloseTo(-gx, 5);
    expect(ey).toBeCloseTo(-gy, 5);
  });

  it("terceira lei de Newton e energia do par", () => {
    const cs: PointCharge[] = [{ x: 0, y: 0, q: 1e-6 }, { x: 0.5, y: 0, q: -2e-6 }];
    const f0 = forceOn(cs, 0);
    const f1 = forceOn(cs, 1);
    expect(f0[0]).toBeCloseTo((K_COULOMB * 2e-12) / 0.25, 9);
    expect(f0[0] + f1[0]).toBeCloseTo(0, 12);
    expect(systemEnergy(cs)).toBeCloseTo((K_COULOMB * -2e-12) / 0.5, 9);
  });
});

describe("linhas de campo", () => {
  it("carga isolada: linhas radiais até a borda", () => {
    const cs: PointCharge[] = [{ x: 0, y: 0, q: 1 }];
    const lines = fieldLines(cs, { bounds: B, coulomb: { k: 1 } });
    expect(lines).toHaveLength(12);
    for (const l of lines) {
      expect(l.end).toBe("bounds");
      // Cada ponto fica na mesma reta pela origem.
      const a0 = Math.atan2(l.points[2]![1], l.points[2]![0]);
      for (const p of l.points.slice(1)) expect(Math.abs(Math.sin(Math.atan2(p[1], p[0]) - a0))).toBeLessThan(1e-6);
    }
  });

  it("dipolo: as linhas saem da + e chegam à −, em número proporcional a |q|", () => {
    const cs: PointCharge[] = [{ x: -0.5, y: 0, q: 2 }, { x: 0.5, y: 0, q: -1 }];
    const lines = fieldLines(cs, { bounds: B, coulomb: { k: 1 }, linesPerUnitCharge: 8 });
    const fromPos = lines.filter((l) => l.from === 0);
    expect(fromPos).toHaveLength(16);
    const intoNeg = lines.filter((l) => l.to === 1);
    expect(intoNeg.length).toBeGreaterThanOrEqual(6);
    expect(intoNeg.length).toBeLessThanOrEqual(9);
    // A linha do eixo (ângulo ~0) vai direto para a carga negativa.
    expect(lines.some((l) => l.from === 0 && l.to === 1 && l.end === "charge")).toBe(true);
  });

  it("dipolo simétrico: a linha que sai a 90° volta à − pela mediatriz e o campo é tangente", () => {
    const cs: PointCharge[] = [{ x: -0.5, y: 0, q: 1 }, { x: 0.5, y: 0, q: -1 }];
    const field = (x: number, y: number) => fieldAt(cs, x, y, { k: 1 });
    const tr = traceFieldLine(field, [-0.5, 0.05], { bounds: B, sinks: [cs[1]!], stopRadius: 0.02, tol: 1e-7 });
    expect(tr.end).toBe("charge");
    // Simetria: a linha cruza x = 0 na horizontal.
    const pts = tr.points;
    const k = pts.findIndex((p) => p[0] > 0);
    const [a, b] = [pts[k - 1]!, pts[k]!];
    expect(Math.abs((b[1] - a[1]) / (b[0] - a[0]))).toBeLessThan(0.05);
  });
});

describe("marching squares", () => {
  it("círculo: x² + y² = 1 vira um laço fechado de raio 1", () => {
    const g = sampleGrid(B, 81, 81, (x, y) => x * x + y * y);
    const lines = contourLines(g, 1);
    expect(lines).toHaveLength(1);
    const l = lines[0]!;
    expect(l[0]![0]).toBeCloseTo(l[l.length - 1]![0], 12);
    for (const p of l) expect(Math.hypot(p[0], p[1])).toBeCloseTo(1, 2);
  });

  it("plano inclinado: curva de nível reta e aberta", () => {
    const g = sampleGrid(B, 21, 21, (x, y) => x + 2 * y);
    const lines = contourLines(g, 0.5);
    expect(lines).toHaveLength(1);
    for (const p of lines[0]!) expect(p[0] + 2 * p[1]).toBeCloseTo(0.5, 10);
  });
});

describe("Laplace por SOR", () => {
  it("função harmônica na borda: o interior reproduz x² − y² (exato no estêncil de 5 pontos)", () => {
    const exact = (x: number, y: number) => x * x - y * y;
    const g = makeGrid(B, 41, 41);
    for (let j = 0; j < 41; j++)
      for (let i = 0; i < 41; i++) if (i === 0 || j === 0 || i === 40 || j === 40) g.v[i + j * 41] = exact(-2 + i * 0.1, -2 + j * 0.1);
    const r = solveLaplace(g, new Uint8Array(41 * 41), { tol: 1e-10 });
    expect(r.converged).toBe(true);
    expect(r.iterations).toBeLessThan(400);
    expect(gridValueAt(g, 0.5, 0.3)).toBeCloseTo(exact(0.5, 0.3), 6);
  });

  it("capacitor de placas com borda isolada: V linear e E = ΔV/d", () => {
    const g = makeGrid({ xMin: 0, xMax: 1, yMin: 0, yMax: 1 }, 21, 21);
    const fixed = new Uint8Array(21 * 21);
    for (let j = 0; j < 21; j++) {
      fixed[j * 21] = 1;
      fixed[20 + j * 21] = 1;
      g.v[j * 21] = 10;
      g.v[20 + j * 21] = 0;
    }
    solveLaplace(g, fixed, { boundary: "neumann", tol: 1e-10 });
    expect(gridValueAt(g, 0.25, 0.9)).toBeCloseTo(7.5, 6);
    const [gx, gy] = gridGradientAt(g, 0.4, 0.5);
    expect(-gx).toBeCloseTo(10, 6);
    expect(gy).toBeCloseTo(0, 6);
  });
});
