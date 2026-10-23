/**
 * Física do transistor bipolar (Ebers–Moll com efeito Early), dos retificadores
 * com diodo de Shockley e filtro capacitivo, e dos sensores NTC e LDR.
 */

export const VT = 0.025852; // kT/q a 300 K

// ------------------------------------------------------------ bisseção genérica
/** Raiz de f crescente em [lo, hi] (f(lo) < 0 < f(hi)); se não houver troca de sinal, devolve o extremo mais próximo. */
export function bisect(f: (x: number) => number, lo: number, hi: number, iters = 60): number {
  let flo = f(lo);
  if (flo >= 0) return lo;
  if (f(hi) <= 0) return hi;
  for (let i = 0; i < iters; i++) {
    const m = (lo + hi) / 2;
    const fm = f(m);
    if (fm < 0) {
      lo = m;
      flo = fm;
    } else hi = m;
  }
  return (lo + hi) / 2;
}

// ------------------------------------------------------------ transistor NPN
export interface BJT {
  /** Corrente de saturação (A). */
  Is: number;
  betaF: number;
  betaR: number;
  /** Tensão de Early (V). */
  VA: number;
}

export const defaultBJT = (betaF = 100): BJT => ({ Is: 1e-14, betaF, betaR: 1, VA: 100 });

const ex = (v: number) => Math.exp(Math.min(v / VT, 80)) - 1;

/** Correntes de coletor e de base pelo modelo de transporte de Ebers–Moll (com Early). */
export function ebersMoll(q: BJT, vbe: number, vce: number): { ic: number; ib: number } {
  const icc = q.Is * ex(vbe);
  const iec = q.Is * ex(vbe - vce);
  const ic = (icc - iec) * (1 + Math.max(vce, 0) / q.VA) - iec / q.betaR;
  const ib = icc / q.betaF + iec / q.betaR;
  return { ic, ib };
}

/** V_BE que produz a corrente de base I_B com V_CE dado. */
export function vbeForIb(q: BJT, ib: number, vce: number): number {
  return bisect((v) => ebersMoll(q, v, vce).ib - ib, -0.5, 1.2, 70);
}

/** Curva característica: I_C para I_B e V_CE dados. */
export function icCurve(q: BJT, ib: number, vce: number): number {
  if (ib <= 0) return 0;
  return ebersMoll(q, vbeForIb(q, ib, vce), vce).ic;
}

/** Ponto quieto com base polarizada por corrente I_B e reta de carga (V_CC, R_C). */
export function qPoint(q: BJT, ib: number, vcc: number, rc: number): { vce: number; ic: number } {
  const vce = bisect((v) => v - vcc + rc * icCurve(q, ib, v), 0, vcc, 60);
  return { vce, ic: (vcc - vce) / rc };
}

export type Region = "corte" | "ativa" | "saturação";
export function region(q: BJT, ic: number, ib: number, vce: number): Region {
  if (ib < 1e-9) return "corte";
  if (vce < 0.3 || ic < 0.9 * q.betaF * ib) return "saturação";
  return "ativa";
}

/**
 * Transistor como chave: fonte V_in → R_B → base; V_CC → R_C (carga) → coletor; emissor no terra.
 */
export function switchCircuit(q: BJT, vin: number, rb: number, vcc: number, rc: number) {
  const vceOf = (vbe: number) => bisect((v) => v - vcc + rc * ebersMoll(q, vbe, v).ic, -0.2, vcc, 50);
  if (vin <= 0) {
    const vce = vceOf(0);
    return { vbe: 0, vce, ic: Math.max(0, (vcc - vce) / rc), ib: 0 };
  }
  const vbe = bisect((vb) => ebersMoll(q, vb, vceOf(vb)).ib - (vin - vb) / rb, 0, Math.min(vin, 1.1), 50);
  const vce = vceOf(vbe);
  const ib = (vin - vbe) / rb;
  return { vbe, vce, ic: (vcc - vce) / rc, ib };
}

// ------------------------------------------------------------ amplificador emissor-comum
export interface CEParams {
  vcc: number;
  r1: number;
  r2: number;
  rc: number;
  re: number;
  /** Capacitor de desvio no emissor (true: emissor aterrado para o sinal). */
  bypass: boolean;
}

/** Polarização DC por divisor de tensão. */
export function ceBias(q: BJT, c: CEParams) {
  const vth = (c.vcc * c.r2) / (c.r1 + c.r2);
  const rth = (c.r1 * c.r2) / (c.r1 + c.r2);
  // região ativa: I_B = I_s e^{V_BE/V_T}/β, I_E = (β + 1) I_B
  const vbe = bisect((v) => {
    const ib = (q.Is * ex(v)) / q.betaF;
    return v + ib * rth + (q.betaF + 1) * ib * c.re - vth;
  }, 0, 1.2, 70);
  const ib = (q.Is * ex(vbe)) / q.betaF;
  const vb = vth - ib * rth;
  const ve = (q.betaF + 1) * ib * c.re;
  const vc = ceCollector(q, c, vbe, ve);
  const ic = (c.vcc - vc) / c.rc;
  return { vb, ve, vc, ic, ib, vbe, vce: vc - ve };
}

/** Tensão de coletor para V_BE e V_E dados (resolve a malha do coletor). */
function ceCollector(q: BJT, c: CEParams, vbe: number, ve: number): number {
  return bisect((vc) => vc - c.vcc + c.rc * ebersMoll(q, vbe, vc - ve).ic, ve - 0.2, c.vcc, 45);
}

/** Tensão de coletor instantânea com a base em V_B + v_in (fonte de sinal ideal acoplada por capacitor). */
export function ceInstant(q: BJT, c: CEParams, bias: ReturnType<typeof ceBias>, vin: number): number {
  const vb = bias.vb + vin;
  if (c.bypass) return ceCollector(q, c, vb - bias.ve, bias.ve);
  // sem desvio: o emissor acompanha a base; resolve V_E = R_E (I_C + I_B)
  const ve = bisect((v) => {
    const vc = ceCollector(q, c, vb - v, v);
    const { ic, ib } = ebersMoll(q, vb - v, vc - v);
    return v - c.re * (ic + ib);
  }, -0.5, Math.max(vb, 0.1), 40);
  return ceCollector(q, c, vb - ve, ve);
}

/** Ganho de pequenos sinais previsto (com r_o = V_A/I_C). */
export function ceGainTheory(q: BJT, c: CEParams, ic: number): number {
  const gm = ic / VT;
  const ro = q.VA / Math.max(ic, 1e-12);
  const rcEff = (c.rc * ro) / (c.rc + ro);
  if (c.bypass) return -gm * rcEff;
  const re0 = 1 / gm;
  return -(c.rc / (c.re * (1 + 1 / q.betaF) + re0));
}

/** Forma de onda de saída em N pontos de um período (v_out = V_C(t) − V_C,DC). */
export function ceWaveform(q: BJT, c: CEParams, amp: number, n = 128) {
  const bias = ceBias(q, c);
  const vin: number[] = [];
  const vout: number[] = [];
  for (let k = 0; k < n; k++) {
    const v = amp * Math.sin((2 * Math.PI * k) / n);
    vin.push(v);
    vout.push(ceInstant(q, c, bias, v) - bias.vc);
  }
  return { bias, vin, vout, ...harmonics(vout) };
}

/** Amplitudes harmônicas de um período amostrado e distorção harmônica total. */
export function harmonics(y: number[], kMax = 8) {
  const n = y.length;
  const A: number[] = [];
  let dc = 0;
  for (const v of y) dc += v / n;
  for (let k = 1; k <= kMax; k++) {
    let re = 0;
    let im = 0;
    for (let j = 0; j < n; j++) {
      re += y[j]! * Math.cos((2 * Math.PI * k * j) / n);
      im += y[j]! * Math.sin((2 * Math.PI * k * j) / n);
    }
    A.push((2 / n) * Math.hypot(re, im));
  }
  const a1 = A[0] ?? 0;
  const rest = Math.sqrt(A.slice(1).reduce((s, a) => s + a * a, 0));
  return { dc, A, thd: a1 > 0 ? rest / a1 : 0 };
}

// ------------------------------------------------------------ retificadores
/** Diodo retificador de silício (tipo 1N4007). */
export const DIODE = { Is: 7e-9, n: 1.8 };
const nVt = DIODE.n * VT;
export const diodeI = (vd: number) => DIODE.Is * (Math.exp(Math.min(vd / nVt, 80)) - 1);

export interface RectParams {
  /** Ponte (onda completa) ou meia onda. */
  bridge: boolean;
  /** Pico da tensão do secundário (V). */
  Vp: number;
  f: number;
  R: number;
  /** Capacitância do filtro (F); 0 = sem filtro. */
  C: number;
  /** Resistência do enrolamento do transformador (Ω). */
  Rs: number;
}

/**
 * Um passo de Euler implícito da tensão de saída. Incógnita: queda num diodo v_d
 * (na ponte conduzem dois diodos em série). Devolve a nova tensão e a corrente nos diodos.
 */
export function rectStep(rp: RectParams, vs: number, vo0: number, h: number): { vo: number; i: number } {
  const nd = rp.bridge ? 2 : 1;
  const vin = rp.bridge ? Math.abs(vs) : vs;
  const G = rp.C / h;
  const g = (vd: number) => {
    const i = diodeI(vd);
    const vo = vin - nd * vd - i * rp.Rs;
    return i - vo / rp.R - G * (vo - vo0);
  };
  const vd = bisect(g, -(Math.abs(vin) + Math.abs(vo0) + 1) / nd, 1.6, 64);
  const i = diodeI(vd);
  return { vo: vin - nd * vd - i * rp.Rs, i };
}

/** Ondulação aproximada (pico a pico) com filtro: ΔV ≈ I/(f_r C), f_r = f (meia onda) ou 2f (ponte). */
export function rippleApprox(rp: RectParams, vdc: number): number {
  return vdc / (rp.R * (rp.bridge ? 2 : 1) * rp.f * rp.C);
}

// ------------------------------------------------------------ sensores
export const NTC = { R25: 10_000, B: 3950 };
/** Resistência do termistor NTC (Ω) em função da temperatura (°C). */
export const ntcR = (Tc: number) => NTC.R25 * Math.exp(NTC.B * (1 / (Tc + 273.15) - 1 / 298.15));

export const LDR = { R10: 20_000, gamma: 0.7, Rdark: 1e6 };
/** Resistência do LDR (Ω) em função da iluminância (lux). */
export function ldrR(E: number): number {
  const Rl = LDR.R10 * Math.pow(Math.max(E, 1e-6) / 10, -LDR.gamma);
  return 1 / (1 / LDR.Rdark + 1 / Rl);
}

/** Divisor: sensor em cima, resistor fixo embaixo; mede-se a tensão no resistor fixo. */
export const divider = (vcc: number, rSensor: number, rFix: number) => (vcc * rFix) / (rSensor + rFix);
