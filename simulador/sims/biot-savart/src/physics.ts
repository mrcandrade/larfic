/**
 * Biot-Savart por soma de segmentos retos em 3D (unidades SI).
 *
 * Cada segmento usa a expressão fechada do fio finito,
 *   B = μ₀I/(4π d) (cos θ₁ − cos θ₂) · (û × ρ̂),
 * então um caminho poligonal dá o campo exato daquele polígono.
 */
export const MU0 = 4 * Math.PI * 1e-7;

export type V3 = [number, number, number];

/** Segmentos empacotados: [ax, ay, az, bx, by, bz] por segmento, corrente de a para b. */
export type Segs = Float64Array;

/** Raio do fio (m): regulariza o campo muito perto do condutor. */
const WIRE_R = 1e-4;

export function segsFromLoops(loops: V3[][], closed = true): Segs {
  let n = 0;
  for (const l of loops) n += closed ? l.length : Math.max(0, l.length - 1);
  const out = new Float64Array(6 * n);
  let k = 0;
  for (const l of loops) {
    const m = closed ? l.length : l.length - 1;
    for (let i = 0; i < m; i++) {
      const a = l[i]!;
      const b = l[(i + 1) % l.length]!;
      out[k++] = a[0];
      out[k++] = a[1];
      out[k++] = a[2];
      out[k++] = b[0];
      out[k++] = b[1];
      out[k++] = b[2];
    }
  }
  return out;
}

/** Campo B (T) no ponto P (m) devido a todos os segmentos com corrente I (A). */
export function fieldAt(segs: Segs, I: number, P: V3): V3 {
  let bx = 0;
  let by = 0;
  let bz = 0;
  const [px, py, pz] = P;
  for (let k = 0; k < segs.length; k += 6) {
    const ax = segs[k]!, ay = segs[k + 1]!, az = segs[k + 2]!;
    const dx = segs[k + 3]! - ax, dy = segs[k + 4]! - ay, dz = segs[k + 5]! - az;
    const len = Math.hypot(dx, dy, dz);
    if (len < 1e-15) continue;
    const ux = dx / len, uy = dy / len, uz = dz / len;
    // r1 = P − a; r2 = P − b
    const r1x = px - ax, r1y = py - ay, r1z = pz - az;
    const r2x = r1x - dx, r2y = r1y - dy, r2z = r1z - dz;
    const s1 = r1x * ux + r1y * uy + r1z * uz;
    const s2 = s1 - len;
    // ρ = componente de r1 perpendicular ao segmento
    const rhx = r1x - s1 * ux, rhy = r1y - s1 * uy, rhz = r1z - s1 * uz;
    const d2 = rhx * rhx + rhy * rhy + rhz * rhz;
    const n1 = Math.hypot(r1x, r1y, r1z);
    const n2 = Math.hypot(r2x, r2y, r2z);
    if (n1 < 1e-15 || n2 < 1e-15) continue;
    const f = (s1 / n1 - s2 / n2) / (d2 + WIRE_R * WIRE_R);
    // û × ρ
    bx += f * (uy * rhz - uz * rhy);
    by += f * (uz * rhx - ux * rhz);
    bz += f * (ux * rhy - uy * rhx);
  }
  const k = (MU0 * I) / (4 * Math.PI);
  return [k * bx, k * by, k * bz];
}

export const norm = (v: V3) => Math.hypot(v[0], v[1], v[2]);

// ---------- Geometrias (todas em metros) ----------

export function circleLoop(R: number, z: number, n: number, cx = 0, cy = 0): V3[] {
  const pts: V3[] = [];
  for (let i = 0; i < n; i++) {
    const a = (2 * Math.PI * i) / n;
    pts.push([cx + R * Math.cos(a), cy + R * Math.sin(a), z]);
  }
  return pts;
}

/** Fio retilíneo "infinito" ao longo de x, em y = 0, z = 0 (corrente no sentido +x). */
export function longWire(half = 100): Segs {
  return segsFromLoops([[[-half, 0, 0], [half, 0, 0]]], false);
}

/** Espira circular no plano z = 0, sentido anti-horário visto de +z. */
export function loopSegs(R: number, n = 96): Segs {
  return segsFromLoops([circleLoop(R, 0, n)]);
}

/** Solenoide de eixo z, N espiras igualmente espaçadas no comprimento L, centrado na origem. */
export function solenoidSegs(R: number, L: number, N: number, n = 0): Segs {
  const nn = n || (N > 40 ? 32 : 48);
  const loops: V3[][] = [];
  for (let k = 0; k < N; k++) {
    const z = N === 1 ? 0 : -L / 2 + ((k + 0.5) * L) / N;
    loops.push(circleLoop(R, z, nn));
  }
  return segsFromLoops(loops);
}

/**
 * Toroide de eixo z: N espiras circulares de raio a, centradas a uma distância Rt
 * do eixo, nos ângulos φ_k = 2πk/N. Com I > 0 o campo interno aponta em +φ̂.
 */
export function toroidSegs(Rt: number, a: number, N: number, n = 24): Segs {
  const loops: V3[][] = [];
  for (let k = 0; k < N; k++) {
    const ph = (2 * Math.PI * k) / N;
    const c = Math.cos(ph), s = Math.sin(ph);
    const pts: V3[] = [];
    for (let i = 0; i < n; i++) {
      const psi = (2 * Math.PI * i) / n;
      const r = Rt + a * Math.cos(psi);
      // u1 = ρ̂, u2 = −ẑ ⇒ normal u1 × u2 = φ̂
      pts.push([r * c, r * s, -a * Math.sin(psi)]);
    }
    loops.push(pts);
  }
  return segsFromLoops(loops);
}

// ---------- Fórmulas fechadas ----------

export const bLongWire = (I: number, d: number) => (MU0 * I) / (2 * Math.PI * d);
export const bLoopCenter = (I: number, R: number) => (MU0 * I) / (2 * R);
export const bLoopAxis = (I: number, R: number, z: number) => (MU0 * I * R * R) / (2 * (R * R + z * z) ** 1.5);
export const bSolenoidIdeal = (I: number, N: number, L: number) => (MU0 * N * I) / L;
/** Solenoide finito, no eixo, a uma distância z do centro. */
export function bSolenoidAxis(I: number, N: number, L: number, R: number, z: number): number {
  const a = z + L / 2;
  const b = z - L / 2;
  return ((MU0 * N * I) / (2 * L)) * (a / Math.hypot(a, R) - b / Math.hypot(b, R));
}
export const bToroid = (I: number, N: number, r: number) => (MU0 * N * I) / (2 * Math.PI * r);

/** Formata um campo magnético com prefixo SI (vírgula decimal). */
export function fmtB(T: number): string {
  const a = Math.abs(T);
  const [k, u] = a >= 1 ? [1, "T"] : a >= 1e-3 ? [1e3, "mT"] : a >= 1e-6 ? [1e6, "μT"] : [1e9, "nT"];
  return `${Number((T * k).toPrecision(3)).toString().replace(".", ",")} ${u}`;
}
