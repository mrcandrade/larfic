/** Pequena álgebra de vetores 2D/3D usada pelas sims. */
export type V2 = [number, number];
export type V3 = [number, number, number];

export const add2 = (a: V2, b: V2): V2 => [a[0] + b[0], a[1] + b[1]];
export const sub2 = (a: V2, b: V2): V2 => [a[0] - b[0], a[1] - b[1]];
export const scale2 = (a: V2, k: number): V2 => [a[0] * k, a[1] * k];
export const dot2 = (a: V2, b: V2): number => a[0] * b[0] + a[1] * b[1];
export const cross2 = (a: V2, b: V2): number => a[0] * b[1] - a[1] * b[0];
export const norm2 = (a: V2): number => Math.hypot(a[0], a[1]);
export const rot2 = (a: V2, th: number): V2 => [a[0] * Math.cos(th) - a[1] * Math.sin(th), a[0] * Math.sin(th) + a[1] * Math.cos(th)];

export const add3 = (a: V3, b: V3): V3 => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub3 = (a: V3, b: V3): V3 => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale3 = (a: V3, k: number): V3 => [a[0] * k, a[1] * k, a[2] * k];
export const dot3 = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross3 = (a: V3, b: V3): V3 => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const norm3 = (a: V3): number => Math.hypot(a[0], a[1], a[2]);

export const deg = (rad: number) => (rad * 180) / Math.PI;
export const rad = (degrees: number) => (degrees * Math.PI) / 180;
export const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));
