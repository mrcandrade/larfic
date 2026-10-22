/**
 * Física da Lei de Gauss: campos de distribuições simples e fluxo numérico
 * por soma de elementos de superfície.
 *
 * Duas geometrias de superfície:
 *  - "3D" (cargas pontuais e esfera carregada): o círculo do palco é o corte
 *    em z = 0 de uma esfera e o retângulo é o corte de uma caixa (profundidade
 *    igual à largura). O fluxo é somado sobre a superfície 3D inteira.
 *  - "extrudada" (fio e plano infinitos, ambos ao longo de z): o círculo é o
 *    corte de um cilindro e o retângulo de uma caixa, de comprimento L = 1 m.
 *    Como E não tem componente z, as tampas não contribuem e Φ = L ∮ E·n̂ dl.
 */

export const EPS0 = 8.8541878128e-12;
export const K = 1 / (4 * Math.PI * EPS0);
/** Comprimento das superfícies extrudadas ao longo de z (m). */
export const L_EXT = 1;
/** Raio mínimo ao quadrado (m²), evita a singularidade sobre a carga. */
const R2_MIN = 1e-8;

export type Vec2 = [number, number];
export type Vec3 = [number, number, number];

/** Superfície: centro (cx, cy); círculo de raio a ou retângulo de meias-larguras a × b. */
export interface Surface {
  cx: number;
  cy: number;
  a: number;
  b: number;
  /** 0 = círculo (esfera/cilindro), 1 = retângulo (caixa). */
  shape: number;
}

export interface PointCharge {
  x: number;
  y: number;
  /** Carga em coulombs. */
  q: number;
}

/** Fonte de campo, já com os valores SI. */
export type Source =
  | { kind: "pontos"; charges: PointCharge[] }
  | { kind: "fio"; x: number; y: number; lambda: number }
  | { kind: "plano"; x: number; sigma: number }
  | { kind: "esfera"; x: number; y: number; R: number; Q: number };

export const is3D = (src: Source) => src.kind === "pontos" || src.kind === "esfera";

/** Campo elétrico (N/C) no ponto (x, y, z). Para fio e plano, z é irrelevante. */
export function field(src: Source, x: number, y: number, z = 0): Vec3 {
  switch (src.kind) {
    case "pontos": {
      let ex = 0;
      let ey = 0;
      let ez = 0;
      for (const c of src.charges) {
        if (c.q === 0) continue;
        const dx = x - c.x;
        const dy = y - c.y;
        const r2 = Math.max(dx * dx + dy * dy + z * z, R2_MIN);
        const f = (K * c.q) / (r2 * Math.sqrt(r2));
        ex += f * dx;
        ey += f * dy;
        ez += f * z;
      }
      return [ex, ey, ez];
    }
    case "fio": {
      const dx = x - src.x;
      const dy = y - src.y;
      const r2 = Math.max(dx * dx + dy * dy, R2_MIN);
      const f = src.lambda / (2 * Math.PI * EPS0 * r2);
      return [f * dx, f * dy, 0];
    }
    case "plano": {
      const s = x > src.x ? 1 : x < src.x ? -1 : 0;
      return [(s * src.sigma) / (2 * EPS0), 0, 0];
    }
    case "esfera": {
      const dx = x - src.x;
      const dy = y - src.y;
      const r2 = Math.max(dx * dx + dy * dy + z * z, R2_MIN);
      const r = Math.sqrt(r2);
      // Dentro: E = kQr/R³ (só a carga interna conta); fora: E = kQ/r².
      const f = r < src.R ? (K * src.Q) / src.R ** 3 : (K * src.Q) / (r2 * r);
      return [f * dx, f * dy, f * z];
    }
  }
}

/** Módulo do campo no plano z = 0. */
export function fieldMag(src: Source, x: number, y: number): number {
  const [ex, ey, ez] = field(src, x, y, 0);
  return Math.hypot(ex, ey, ez);
}

/** Elemento do contorno no plano z = 0: ponto médio, normal externa e comprimento. */
export interface Element {
  x: number;
  y: number;
  nx: number;
  ny: number;
  dl: number;
}

/** Divide a borda da superfície (corte em z = 0) em n elementos. */
export function contourElements(s: Surface, n: number): Element[] {
  const out: Element[] = [];
  if (s.shape === 0) {
    const dl = (2 * Math.PI * s.a) / n;
    for (let i = 0; i < n; i++) {
      const th = ((i + 0.5) * 2 * Math.PI) / n;
      const c = Math.cos(th);
      const sn = Math.sin(th);
      out.push({ x: s.cx + s.a * c, y: s.cy + s.a * sn, nx: c, ny: sn, dl });
    }
    return out;
  }
  // Retângulo: elementos distribuídos pelos lados conforme o comprimento.
  const per = 4 * (s.a + s.b);
  const nh = Math.max(1, Math.round((n * 2 * s.a) / per));
  const nv = Math.max(1, Math.round((n * 2 * s.b) / per));
  const sides: { x0: number; y0: number; dx: number; dy: number; nx: number; ny: number; m: number }[] = [
    { x0: s.cx - s.a, y0: s.cy - s.b, dx: 2 * s.a, dy: 0, nx: 0, ny: -1, m: nh }, // baixo
    { x0: s.cx + s.a, y0: s.cy - s.b, dx: 0, dy: 2 * s.b, nx: 1, ny: 0, m: nv }, // direita
    { x0: s.cx + s.a, y0: s.cy + s.b, dx: -2 * s.a, dy: 0, nx: 0, ny: 1, m: nh }, // cima
    { x0: s.cx - s.a, y0: s.cy + s.b, dx: 0, dy: -2 * s.b, nx: -1, ny: 0, m: nv }, // esquerda
  ];
  for (const sd of sides) {
    const len = Math.hypot(sd.dx, sd.dy) / sd.m;
    for (let i = 0; i < sd.m; i++) {
      const f = (i + 0.5) / sd.m;
      out.push({ x: sd.x0 + sd.dx * f, y: sd.y0 + sd.dy * f, nx: sd.nx, ny: sd.ny, dl: len });
    }
  }
  return out;
}

/** Fluxo numérico através de uma superfície extrudada (comprimento L), em N·m²/C. */
export function flux2D(src: Source, s: Surface, n: number, L = L_EXT): number {
  let sum = 0;
  for (const e of contourElements(s, n)) {
    const [ex, ey] = field(src, e.x, e.y);
    sum += (ex * e.nx + ey * e.ny) * e.dl;
  }
  return sum * L;
}

/** Meia-profundidade da caixa 3D (a caixa tem profundidade igual à largura). */
export const boxDepth = (s: Surface) => s.a;

/** Fluxo numérico através da esfera (Nθ = n, Nφ = 2n) ou da caixa (n × n por face), em N·m²/C. */
export function flux3D(src: Source, s: Surface, n: number): number {
  let sum = 0;
  if (s.shape === 0) {
    const nt = n;
    const np = 2 * n;
    const dt = Math.PI / nt;
    const dp = (2 * Math.PI) / np;
    for (let i = 0; i < nt; i++) {
      const th = (i + 0.5) * dt;
      const st = Math.sin(th);
      const ct = Math.cos(th);
      const dA = s.a * s.a * st * dt * dp;
      for (let j = 0; j < np; j++) {
        const ph = (j + 0.5) * dp;
        const nx = st * Math.cos(ph);
        const ny = st * Math.sin(ph);
        const nz = ct;
        const [ex, ey, ez] = field(src, s.cx + s.a * nx, s.cy + s.a * ny, s.a * nz);
        sum += (ex * nx + ey * ny + ez * nz) * dA;
      }
    }
    return sum;
  }
  const h: Vec3 = [s.a, s.b, boxDepth(s)];
  const c: Vec3 = [s.cx, s.cy, 0];
  // Cada face: eixo normal k, sinal ±, demais eixos u, v.
  for (let k = 0; k < 3; k++) {
    const u = (k + 1) % 3;
    const v = (k + 2) % 3;
    const du = (2 * h[u]!) / n;
    const dv = (2 * h[v]!) / n;
    for (const sg of [-1, 1]) {
      for (let i = 0; i < n; i++) {
        for (let j = 0; j < n; j++) {
          const p: Vec3 = [0, 0, 0];
          p[k] = c[k]! + sg * h[k]!;
          p[u] = c[u]! - h[u]! + (i + 0.5) * du;
          p[v] = c[v]! - h[v]! + (j + 0.5) * dv;
          const E = field(src, p[0], p[1], p[2]);
          sum += sg * E[k]! * du * dv;
        }
      }
    }
  }
  return sum;
}

/** Fluxo numérico com a geometria adequada à fonte. */
export function fluxNumeric(src: Source, s: Surface, n: number): number {
  return is3D(src) ? flux3D(src, s, n) : flux2D(src, s, n);
}

/** O ponto (x, y, 0) está dentro da superfície? */
export function inside(s: Surface, x: number, y: number): boolean {
  if (s.shape === 0) return Math.hypot(x - s.cx, y - s.cy) < s.a;
  return Math.abs(x - s.cx) < s.a && Math.abs(y - s.cy) < s.b;
}

/** Volume da interseção de duas esferas de raios R e r com centros a distância d. */
export function lensVolume(R: number, r: number, d: number): number {
  if (d >= R + r) return 0;
  if (d <= Math.abs(R - r)) return (4 / 3) * Math.PI * Math.min(R, r) ** 3;
  return (Math.PI * (R + r - d) ** 2 * (d * d + 2 * d * r - 3 * r * r + 2 * d * R + 6 * r * R - 3 * R * R)) / (12 * d);
}

/** Volume da interseção de uma bola (centro em z = 0) com a caixa da superfície, por quadratura em x, y. */
export function ballBoxVolume(bx: number, by: number, R: number, s: Surface, m = 160): number {
  const c = boxDepth(s);
  const x0 = Math.max(bx - R, s.cx - s.a);
  const x1 = Math.min(bx + R, s.cx + s.a);
  const y0 = Math.max(by - R, s.cy - s.b);
  const y1 = Math.min(by + R, s.cy + s.b);
  if (x1 <= x0 || y1 <= y0) return 0;
  const hx = (x1 - x0) / m;
  const hy = (y1 - y0) / m;
  let vol = 0;
  for (let i = 0; i < m; i++) {
    const x = x0 + (i + 0.5) * hx;
    for (let j = 0; j < m; j++) {
      const y = y0 + (j + 0.5) * hy;
      const rho2 = (x - bx) ** 2 + (y - by) ** 2;
      if (rho2 >= R * R) continue;
      vol += 2 * Math.min(Math.sqrt(R * R - rho2), c);
    }
  }
  return vol * hx * hy;
}

/** Carga envolvida pela superfície (C). Para fio e plano, no comprimento L. */
export function enclosedCharge(src: Source, s: Surface, L = L_EXT): number {
  switch (src.kind) {
    case "pontos": {
      // Cargas em z = 0: dentro da esfera/caixa se dentro do corte.
      let q = 0;
      for (const c of src.charges) if (inside(s, c.x, c.y)) q += c.q;
      return q;
    }
    case "fio":
      return inside(s, src.x, src.y) ? src.lambda * L : 0;
    case "plano": {
      const dx = Math.abs(src.x - s.cx);
      const chord = s.shape === 0 ? (dx < s.a ? 2 * Math.sqrt(s.a * s.a - dx * dx) : 0) : dx < s.a ? 2 * s.b : 0;
      return src.sigma * chord * L;
    }
    case "esfera": {
      const vBall = (4 / 3) * Math.PI * src.R ** 3;
      const v =
        s.shape === 0 ? lensVolume(s.a, src.R, Math.hypot(src.x - s.cx, src.y - s.cy)) : ballBoxVolume(src.x, src.y, src.R, s);
      return (src.Q * v) / vBall;
    }
  }
}

/** Número com vírgula decimal para o palco. */
export function fmt(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    return `${m!.replace(".", ",").replace("-", "−")}×10^${Number(e)}`;
  }
  return Number(v.toPrecision(digits)).toString().replace(".", ",").replace("-", "−");
}
