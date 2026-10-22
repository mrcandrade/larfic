// Física da polarização com vetores de Stokes e matrizes de Mueller.
// Convenção: ângulos medidos a partir da vertical (o eixo do laser), crescendo no
// sentido horário para quem olha de frente para o feixe (do detector para a fonte).
// S1 = I(0°) − I(90°), S2 = I(45°) − I(135°), S3 = circular.

export type Stokes = [number, number, number, number];
export type Mueller = number[][];

const D = Math.PI / 180;

/** Polarizador linear ideal com eixo de transmissão no ângulo a (graus). */
export function polarizerM(aDeg: number): Mueller {
  const C = Math.cos(2 * aDeg * D);
  const S = Math.sin(2 * aDeg * D);
  return [
    [0.5, 0.5 * C, 0.5 * S, 0],
    [0.5 * C, 0.5 * C * C, 0.5 * C * S, 0],
    [0.5 * S, 0.5 * C * S, 0.5 * S * S, 0],
    [0, 0, 0, 0],
  ];
}

/** Lâmina retardadora com eixo rápido no ângulo a (graus) e retardo δ (rad). */
export function retarderM(aDeg: number, delta: number): Mueller {
  const C = Math.cos(2 * aDeg * D);
  const S = Math.sin(2 * aDeg * D);
  const c = Math.cos(delta);
  const s = Math.sin(delta);
  return [
    [1, 0, 0, 0],
    [0, C * C + S * S * c, C * S * (1 - c), -S * s],
    [0, C * S * (1 - c), S * S + C * C * c, C * s],
    [0, S * s, -C * s, c],
  ];
}

/** Reflexão numa interface com coeficientes de amplitude rs, rp (s = vertical, plano de incidência horizontal). */
export function reflectionM(rs: number, rp: number): Mueller {
  const Rs = rs * rs;
  const Rp = rp * rp;
  const A = (Rs + Rp) / 2;
  const B = (Rs - Rp) / 2;
  const X = rs * rp;
  return [
    [A, B, 0, 0],
    [B, A, 0, 0],
    [0, 0, X, 0],
    [0, 0, 0, X],
  ];
}

export function apply(m: Mueller, s: Stokes): Stokes {
  const out = [0, 0, 0, 0] as Stokes;
  for (let i = 0; i < 4; i++) {
    const row = m[i]!;
    out[i] = row[0]! * s[0] + row[1]! * s[1] + row[2]! * s[2] + row[3]! * s[3];
  }
  return out;
}

/** Coeficientes de Fresnel do ar (n = 1) para um vidro de índice n, ângulo de incidência em graus. */
export function fresnel(iDeg: number, n: number): { rs: number; rp: number; Rs: number; Rp: number; tDeg: number } {
  const i = iDeg * D;
  const ci = Math.cos(i);
  const st = Math.sin(i) / n;
  const ct = Math.sqrt(Math.max(0, 1 - st * st));
  const rs = (ci - n * ct) / (ci + n * ct);
  const rp = (n * ci - ct) / (n * ci + ct);
  return { rs, rp, Rs: rs * rs, Rp: rp * rp, tDeg: Math.asin(st) / D };
}

export const brewsterDeg = (n: number) => Math.atan(n) / D;

/** Parâmetros da elipse de polarização a partir do vetor de Stokes. */
export function ellipseOf(s: Stokes): { I: number; Ip: number; psi: number; chi: number; dop: number } {
  const I = Math.max(0, s[0]);
  const Ip = Math.min(I, Math.hypot(s[1], s[2], s[3]));
  const psi = (0.5 * Math.atan2(s[2], s[1])) / D;
  const chi = Ip > 1e-12 ? (0.5 * Math.asin(Math.max(-1, Math.min(1, s[3] / Ip)))) / D : 0;
  return { I, Ip, psi, chi, dop: I > 1e-12 ? Ip / I : 0 };
}

export const MODO_MALUS = 0;
export const MODO_TRES = 1;
export const MODO_BREWSTER = 2;

export interface Setup {
  modo: number;
  /** 0 = laser polarizado na vertical; 1 = lâmpada (luz natural). */
  fonte: number;
  /** 0 = nenhuma, 1 = λ/4, 2 = λ/2 (só no modo 0). */
  lamina: number;
  /** Analisador presente no banco. */
  an: boolean;
  p1: number;
  mid: number;
  th: number;
  inc: number;
  n: number;
}

export interface Stage {
  key: "fonte" | "p1" | "meio" | "vidro" | "an";
  label: string;
  S: Stokes;
}

/** Elemento central presente? (lâmina no modo 0 ou polarizador do meio no modo 1). */
export const hasMiddle = (s: Pick<Setup, "modo" | "lamina">) => s.modo === MODO_TRES || (s.modo === MODO_MALUS && s.lamina > 0);

/** Propaga a luz pela montagem; a fonte tem S0 = 1. */
export function propagate(su: Setup): { stages: Stage[]; out: Stokes } {
  let S: Stokes = su.fonte === 0 ? [1, 1, 0, 0] : [1, 0, 0, 0];
  const stages: Stage[] = [{ key: "fonte", label: "fonte", S }];
  S = apply(polarizerM(su.p1), S);
  stages.push({ key: "p1", label: "após P₁", S });
  if (su.modo === MODO_TRES) {
    S = apply(polarizerM(su.mid), S);
    stages.push({ key: "meio", label: "após P₂", S });
  } else if (su.modo === MODO_MALUS && su.lamina > 0) {
    S = apply(retarderM(su.mid, su.lamina === 1 ? Math.PI / 2 : Math.PI), S);
    stages.push({ key: "meio", label: su.lamina === 1 ? "após λ/4" : "após λ/2", S });
  } else if (su.modo === MODO_BREWSTER) {
    const f = fresnel(su.inc, su.n);
    S = apply(reflectionM(f.rs, f.rp), S);
    stages.push({ key: "vidro", label: "refletida", S });
  }
  if (su.an) {
    S = apply(polarizerM(su.th), S);
    stages.push({ key: "an", label: "após analisador", S });
  }
  return { stages, out: S };
}

/** Fração da intensidade da fonte que chega ao detector. */
export const transmittance = (su: Setup) => Math.max(0, propagate(su).out[0]);
