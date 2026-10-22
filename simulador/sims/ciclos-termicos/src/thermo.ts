/**
 * Termodinâmica de gás ideal para processos quase-estáticos e ciclos.
 * Unidades SI internas: P em Pa, V em m³, T em K, energia em J.
 */

export const R = 8.314462618;

export interface GasState {
  P: number;
  V: number;
  T: number;
}

export type ProcessKind = "isotermico" | "adiabatico" | "isocorico" | "isobarico";

export interface Segment {
  kind: ProcessKind;
  from: GasState;
  to: GasState;
}

export interface Gas {
  n: number;
  gamma: number;
}

export const cv = (g: Gas) => R / (g.gamma - 1);
export const cp = (g: Gas) => (g.gamma * R) / (g.gamma - 1);

export function state(g: Gas, V: number, T: number): GasState {
  return { P: (g.n * R * T) / V, V, T };
}

export function stateFromPV(g: Gas, P: number, V: number): GasState {
  return { P, V, T: (P * V) / (g.n * R) };
}

/** Estado ao longo do segmento para λ ∈ [0, 1]. Volume varia geometricamente (curvas suaves no PV). */
export function along(g: Gas, s: Segment, lam: number): GasState {
  const { from: A, to: B } = s;
  switch (s.kind) {
    case "isotermico": {
      const V = A.V * (B.V / A.V) ** lam;
      return state(g, V, A.T);
    }
    case "adiabatico": {
      const V = A.V * (B.V / A.V) ** lam;
      // T V^(γ−1) = const
      return state(g, V, A.T * (A.V / V) ** (g.gamma - 1));
    }
    case "isocorico": {
      const T = A.T + (B.T - A.T) * lam;
      return state(g, A.V, T);
    }
    case "isobarico": {
      const V = A.V + (B.V - A.V) * lam;
      return stateFromPV(g, A.P, V);
    }
  }
}

export interface Energy {
  Q: number;
  W: number;
  dU: number;
}

/** Calor recebido, trabalho realizado pelo gás e variação de energia interna de A até o estado X no segmento. */
export function energy(g: Gas, s: Segment, X: GasState): Energy {
  const A = s.from;
  const dU = g.n * cv(g) * (X.T - A.T);
  let W = 0;
  switch (s.kind) {
    case "isotermico":
      W = g.n * R * A.T * Math.log(X.V / A.V);
      break;
    case "adiabatico":
      W = -dU;
      break;
    case "isocorico":
      W = 0;
      break;
    case "isobarico":
      W = A.P * (X.V - A.V);
      break;
  }
  return { Q: dU + W, W, dU };
}

export interface CycleSpec {
  id: string;
  name: string;
  segments: Segment[];
  /** Eficiência teórica para comparação (fórmula fechada do ciclo). */
  theory: { label: string; value: number; tex: string };
}

export interface CycleParams {
  n: number;
  gamma: number;
  TH: number;
  TC: number;
  /** Volume máximo, em m³. */
  Vmax: number;
  /** Razão de compressão (Otto, Diesel) ou de volumes (Carnot, Stirling). */
  r: number;
  /** Razão de corte (Diesel). */
  rc: number;
  /** Razão de pressões (Brayton). */
  rp: number;
}

/** Monta os quatro segmentos do ciclo escolhido a partir dos parâmetros. */
export function buildCycle(kind: number, p: CycleParams): CycleSpec {
  const g: Gas = { n: p.n, gamma: p.gamma };
  const k = p.gamma - 1;
  switch (kind) {
    case 0: {
      // Carnot: expansão isotérmica a TH, adiabática até TC, compressão isotérmica, adiabática.
      const ratio = (p.TH / p.TC) ** (1 / k);
      const V3 = p.Vmax;
      const V2 = V3 / ratio;
      const V1 = V2 / p.r;
      const V4 = V1 * ratio;
      const s1 = state(g, V1, p.TH), s2 = state(g, V2, p.TH), s3 = state(g, V3, p.TC), s4 = state(g, V4, p.TC);
      return {
        id: "carnot",
        name: "Carnot",
        segments: [
          { kind: "isotermico", from: s1, to: s2 },
          { kind: "adiabatico", from: s2, to: s3 },
          { kind: "isotermico", from: s3, to: s4 },
          { kind: "adiabatico", from: s4, to: s1 },
        ],
        theory: { label: "1 − T_C/T_H", value: 1 - p.TC / p.TH, tex: String.raw`\eta_{Carnot} = 1 - \frac{T_C}{T_H}` },
      };
    }
    case 1: {
      // Otto: compressão adiabática, aquecimento isocórico até TH, expansão adiabática, resfriamento isocórico.
      const V1 = p.Vmax, V2 = V1 / p.r;
      const s1 = state(g, V1, p.TC);
      const s2 = state(g, V2, p.TC * p.r ** k);
      const s3 = state(g, V2, Math.max(p.TH, s2.T * 1.01));
      const s4 = state(g, V1, s3.T / p.r ** k);
      return {
        id: "otto",
        name: "Otto (motor a gasolina)",
        segments: [
          { kind: "adiabatico", from: s1, to: s2 },
          { kind: "isocorico", from: s2, to: s3 },
          { kind: "adiabatico", from: s3, to: s4 },
          { kind: "isocorico", from: s4, to: s1 },
        ],
        theory: { label: "1 − r^(1−γ)", value: 1 - p.r ** -k, tex: String.raw`\eta_{Otto} = 1 - r^{1-\gamma}` },
      };
    }
    case 2: {
      // Diesel: compressão adiabática, aquecimento isobárico (razão de corte), expansão adiabática, resfriamento isocórico.
      const V1 = p.Vmax, V2 = V1 / p.r, V3 = Math.min(V1 * 0.95, V2 * p.rc);
      const s1 = state(g, V1, p.TC);
      const s2 = state(g, V2, p.TC * p.r ** k);
      const s3 = stateFromPV(g, s2.P, V3);
      const s4 = state(g, V1, s3.T * (V3 / V1) ** k);
      const rc = V3 / V2;
      return {
        id: "diesel",
        name: "Diesel",
        segments: [
          { kind: "adiabatico", from: s1, to: s2 },
          { kind: "isobarico", from: s2, to: s3 },
          { kind: "adiabatico", from: s3, to: s4 },
          { kind: "isocorico", from: s4, to: s1 },
        ],
        theory: {
          label: "Diesel",
          value: 1 - (rc ** p.gamma - 1) / (p.gamma * p.r ** k * (rc - 1)),
          tex: String.raw`\eta_{Diesel} = 1 - \frac{r_c^{\gamma}-1}{\gamma\, r^{\gamma-1}(r_c-1)}`,
        },
      };
    }
    case 3: {
      // Stirling (sem regenerador): isotérmica a TH, isocórica, isotérmica a TC, isocórica.
      const V2 = p.Vmax, V1 = V2 / p.r;
      const s1 = state(g, V1, p.TH), s2 = state(g, V2, p.TH), s3 = state(g, V2, p.TC), s4 = state(g, V1, p.TC);
      return {
        id: "stirling",
        name: "Stirling (sem regenerador)",
        segments: [
          { kind: "isotermico", from: s1, to: s2 },
          { kind: "isocorico", from: s2, to: s3 },
          { kind: "isotermico", from: s3, to: s4 },
          { kind: "isocorico", from: s4, to: s1 },
        ],
        theory: { label: "Carnot (com regenerador ideal)", value: 1 - p.TC / p.TH, tex: String.raw`\eta \le 1 - \frac{T_C}{T_H}` },
      };
    }
    default: {
      // Brayton (turbina a gás): compressão adiabática, aquecimento isobárico, expansão adiabática, resfriamento isobárico.
      const s1 = state(g, p.Vmax, p.TC);
      const P2 = s1.P * p.rp;
      const T2 = p.TC * p.rp ** (k / p.gamma);
      const s2 = state(g, (g.n * R * T2) / P2, T2);
      const T3 = Math.max(p.TH, T2 * 1.01);
      const s3 = state(g, (g.n * R * T3) / P2, T3);
      const T4 = T3 / p.rp ** (k / p.gamma);
      const s4 = state(g, (g.n * R * T4) / s1.P, T4);
      return {
        id: "brayton",
        name: "Brayton (turbina a gás)",
        segments: [
          { kind: "adiabatico", from: s1, to: s2 },
          { kind: "isobarico", from: s2, to: s3 },
          { kind: "adiabatico", from: s3, to: s4 },
          { kind: "isobarico", from: s4, to: s1 },
        ],
        theory: { label: "1 − r_p^((1−γ)/γ)", value: 1 - p.rp ** (-k / p.gamma), tex: String.raw`\eta_{Brayton} = 1 - r_p^{(1-\gamma)/\gamma}` },
      };
    }
  }
}

export interface CycleTotals {
  Qin: number;
  Qout: number;
  W: number;
}

/** Totais de um ciclo completo. */
export function cycleTotals(g: Gas, c: CycleSpec): CycleTotals {
  let Qin = 0, Qout = 0, W = 0;
  for (const s of c.segments) {
    const e = energy(g, s, s.to);
    if (e.Q > 0) Qin += e.Q;
    else Qout -= e.Q;
    W += e.W;
  }
  return { Qin, Qout, W };
}

/**
 * Totais acumulados até a posição u ∈ [0, nSeg] do ciclo. Dentro de um
 * segmento o calor pode trocar de sinal (não nos processos usados aqui).
 */
export function progressTotals(g: Gas, c: CycleSpec, u: number): CycleTotals & { X: GasState; seg: number } {
  let Qin = 0, Qout = 0, W = 0;
  const n = c.segments.length;
  const uu = Math.max(0, Math.min(n, u));
  const seg = Math.min(n - 1, Math.floor(uu));
  for (let k = 0; k < seg; k++) {
    const e = energy(g, c.segments[k]!, c.segments[k]!.to);
    if (e.Q > 0) Qin += e.Q;
    else Qout -= e.Q;
    W += e.W;
  }
  const s = c.segments[seg]!;
  const X = along(g, s, uu - seg);
  const e = energy(g, s, X);
  if (e.Q > 0) Qin += e.Q;
  else Qout -= e.Q;
  W += e.W;
  return { Qin, Qout, W, X, seg };
}
