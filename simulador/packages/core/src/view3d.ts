// Visualização 3D leve sobre o canvas 2D: câmera orbital, projeção, eixos e
// superfícies sombreadas desenhadas pelo algoritmo do pintor. O contexto já está
// em coordenadas do mundo (veja draw.ts): a tela projetada usa as mesmas unidades.
import type { Draw } from "./draw.ts";
import { clamp, cross3, dot3, norm3, sub3, type V3 } from "./vec.ts";

export interface Camera {
  /** Azimute em torno de z (rad). */
  yaw: number;
  /** Elevação acima do plano xy (rad). */
  pitch: number;
  /** Distância do observador ao alvo, em unidades da cena; Infinity = ortográfica. */
  dist?: number;
  /** Ponto da cena que fica no centro da tela. */
  target?: V3;
  /** Escala da cena (multiplica as coordenadas antes de projetar). */
  zoom?: number;
}

export interface Basis {
  /** Direção da tela para a direita. */
  r: V3;
  /** Direção da tela para cima. */
  u: V3;
  /** Direção que aponta para o observador. */
  f: V3;
}

/** Base ortonormal da câmera; r × u = f (sistema da tela dextrógiro). */
export function cameraBasis(yaw: number, pitch: number): Basis {
  const cy = Math.cos(yaw), sy = Math.sin(yaw), cp = Math.cos(pitch), sp = Math.sin(pitch);
  return { r: [-sy, cy, 0], u: [-sp * cy, -sp * sy, cp], f: [cp * cy, cp * sy, sp] };
}

export const defaultCamera = (): Camera => ({ yaw: (35 * Math.PI) / 180, pitch: (22 * Math.PI) / 180, dist: Infinity, zoom: 1 });

export interface Projector {
  basis: Basis;
  /** Projeta no plano da tela: [x, y, profundidade] (maior = mais perto do observador). */
  project(p: V3): [number, number, number];
  /** Vetor unitário que aponta para o observador a partir de p. */
  toViewer(p: V3): V3;
}

export function projector(cam: Camera): Projector {
  const b = cameraBasis(cam.yaw, cam.pitch);
  const t = cam.target ?? [0, 0, 0];
  const z = cam.zoom ?? 1;
  const D = cam.dist ?? Infinity;
  return {
    basis: b,
    project(p) {
      const q: V3 = [(p[0] - t[0]) * z, (p[1] - t[1]) * z, (p[2] - t[2]) * z];
      const x = dot3(q, b.r), y = dot3(q, b.u), d = dot3(q, b.f);
      if (!Number.isFinite(D)) return [x, y, d];
      const k = D / Math.max(D - d, 1e-6 * D);
      return [x * k, y * k, d];
    },
    toViewer(p) {
      if (!Number.isFinite(D)) return b.f;
      const eye: V3 = [t[0] + (b.f[0] * D) / z, t[1] + (b.f[1] * D) / z, t[2] + (b.f[2] * D) / z];
      const v = sub3(eye, p);
      const n = norm3(v) || 1;
      return [v[0] / n, v[1] / n, v[2] / n];
    },
  };
}

/** Gira a câmera arrastando: dx, dy em pixels desde o início do arrasto. */
export function orbit(start: Camera, dx: number, dy: number, sensitivity = 0.008): Camera {
  return { ...start, yaw: start.yaw - dx * sensitivity, pitch: clamp(start.pitch + dy * sensitivity, -1.5, 1.5) };
}

/** Desenha os eixos x, y, z com rótulos. */
export function drawAxes3d(d: Draw, pr: Projector, L: number, color: string, labels: [string, string, string] = ["x", "y", "z"]) {
  const axes: V3[] = [[L, 0, 0], [0, L, 0], [0, 0, L]];
  const o = pr.project([0, 0, 0]);
  axes.forEach((a, i) => {
    const e = pr.project(a);
    d.arrow(o[0], o[1], e[0] - o[0], e[1] - o[1], { color, width: 1.5 });
    d.text(labels[i]!, e[0], e[1], { color, dy: -6 });
  });
}

/** Desenha uma polilinha 3D. */
export function polyline3d(d: Draw, pr: Projector, pts: readonly V3[], opts: { color?: string; width?: number; dash?: number[] } = {}) {
  d.polyline(
    pts.map((p) => {
      const q = pr.project(p);
      return [q[0], q[1]] as [number, number];
    }),
    opts,
  );
}

export interface Face {
  pts: V3[];
  color: string;
  /** Opacidade de 0 a 1. */
  alpha?: number;
}

/** Superfície paramétrica (u, v) ∈ [u0, u1] × [v0, v1] dividida em nu × nv quadriláteros. */
export function surface(f: (u: number, v: number) => V3, u: [number, number], v: [number, number], nu: number, nv: number, color: (u: number, v: number) => string, alpha = 1): Face[] {
  const out: Face[] = [];
  for (let i = 0; i < nu; i++)
    for (let j = 0; j < nv; j++) {
      const ua = u[0] + ((u[1] - u[0]) * i) / nu, ub = u[0] + ((u[1] - u[0]) * (i + 1)) / nu;
      const va = v[0] + ((v[1] - v[0]) * j) / nv, vb = v[0] + ((v[1] - v[0]) * (j + 1)) / nv;
      out.push({ pts: [f(ua, va), f(ub, va), f(ub, vb), f(ua, vb)], color: color((ua + ub) / 2, (va + vb) / 2), alpha });
    }
  return out;
}

/** Esfera de raio r centrada em c. */
export const sphere = (c: V3, r: number, color: string, n = 16, alpha = 1): Face[] =>
  surface((th, ph) => [c[0] + r * Math.sin(th) * Math.cos(ph), c[1] + r * Math.sin(th) * Math.sin(ph), c[2] + r * Math.cos(th)], [0, Math.PI], [0, 2 * Math.PI], n, 2 * n, () => color, alpha);

function shade(hex: string, k: number): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1]!, 16);
  const ch = (s: number) => Math.round(clamp(((n >> s) & 255) * k, 0, 255));
  return `rgb(${ch(16)}, ${ch(8)}, ${ch(0)})`;
}

/**
 * Desenha faces ordenadas de trás para a frente (algoritmo do pintor), com sombreamento
 * de Lambert a partir de uma luz vinda de cima e da frente. Cores em #rrggbb são sombreadas.
 */
export function renderFaces(d: Draw, pr: Projector, faces: readonly Face[], opts: { light?: V3; ambient?: number; edge?: string } = {}) {
  const L0 = opts.light ?? [0.3, 0.2, 1];
  const ln = norm3(L0) || 1;
  const L: V3 = [L0[0] / ln, L0[1] / ln, L0[2] / ln];
  const amb = opts.ambient ?? 0.45;
  const items = faces.map((f) => {
    const q = f.pts.map((p) => pr.project(p));
    const depth = q.reduce((s, p) => s + p[2], 0) / q.length;
    const nrm = cross3(sub3(f.pts[1]!, f.pts[0]!), sub3(f.pts[f.pts.length - 1]!, f.pts[0]!));
    const nn = norm3(nrm) || 1;
    const lam = Math.abs(dot3(nrm, L)) / nn;
    return { q, depth, color: shade(f.color, amb + (1 - amb) * lam), alpha: f.alpha ?? 1 };
  });
  items.sort((a, b) => a.depth - b.depth);
  const ctx = d.ctx;
  for (const it of items) {
    ctx.save();
    ctx.globalAlpha = it.alpha;
    ctx.beginPath();
    it.q.forEach((p, i) => {
      if (i === 0) ctx.moveTo(p[0], p[1]);
      else ctx.lineTo(p[0], p[1]);
    });
    ctx.closePath();
    ctx.fillStyle = it.color;
    ctx.fill();
    if (opts.edge) {
      ctx.strokeStyle = opts.edge;
      ctx.lineWidth = 0.5 * d.px;
      ctx.stroke();
    }
    ctx.restore();
  }
}
