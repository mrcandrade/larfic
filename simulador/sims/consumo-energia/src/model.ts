/** Modelos de consumo residencial de energia elétrica (unidades SI, energia em Wh/kWh). */

export interface Appliance {
  name: string;
  /** Potência em funcionamento (W). */
  P: number;
  /** Potência em espera (W). */
  standby: number;
  /** Horas de uso por dia (padrão). */
  hours: number;
  /** Hora do dia em que começa o uso. */
  start: number;
  /** Uso distribuído ao longo do dia (ciclo do compressor da geladeira). */
  spread?: boolean;
}

export const APPLIANCES: Appliance[] = [
  { name: "Geladeira", P: 150, standby: 0, hours: 8, start: 0, spread: true },
  { name: "Chuveiro elétrico", P: 5500, standby: 0, hours: 0.75, start: 19 },
  { name: "Lâmpadas (8)", P: 72, standby: 0, hours: 5, start: 18 },
  { name: "TV", P: 100, standby: 1.5, hours: 5, start: 18.5 },
  { name: "Computador", P: 200, standby: 3, hours: 4, start: 14 },
  { name: "Ar-condicionado", P: 1400, standby: 2, hours: 0, start: 22 },
  { name: "Micro-ondas", P: 1200, standby: 3, hours: 0.25, start: 12 },
  { name: "Máquina de lavar", P: 500, standby: 1, hours: 1, start: 9 },
  { name: "Ferro de passar", P: 1000, standby: 0, hours: 0.3, start: 10 },
  { name: "Roteador e carregadores", P: 12, standby: 0, hours: 24, start: 0 },
];

/** Potência de cada lâmpada por tipo, mesma luz (~800 lm). */
export const LAMPS = [
  { name: "Incandescente", P: 60, life: 1000, price: 5 },
  { name: "Fluorescente compacta", P: 15, life: 8000, price: 14 },
  { name: "LED", P: 9, life: 25000, price: 10 },
];

/** Acréscimo das bandeiras tarifárias (R$/kWh). */
export const FLAGS = [
  { name: "Verde", add: 0 },
  { name: "Amarela", add: 0.01885 },
  { name: "Vermelha patamar 1", add: 0.04463 },
  { name: "Vermelha patamar 2", add: 0.07877 },
];

/** O aparelho i está ligado na hora h (0–24)? */
export function isOn(a: Appliance, hours: number, h: number): boolean {
  if (hours <= 0) return false;
  if (hours >= 24) return true;
  const x = (((h - a.start) % 24) + 24) % 24;
  return x < hours;
}

/** Potência média do aparelho na hora h (geladeira: média do ciclo). */
export function powerAt(a: Appliance, hours: number, h: number, plugged: boolean): number {
  if (a.spread) return (a.P * hours) / 24 + (plugged ? (a.standby * (24 - hours)) / 24 : 0);
  if (isOn(a, hours, h)) return a.P;
  return plugged ? a.standby : 0;
}

/** Energia diária de um aparelho (Wh). */
export const dailyWh = (a: Appliance, hours: number, plugged = true) => a.P * hours + (plugged ? a.standby * (24 - hours) : 0);

/** Valor da conta: energia × (tarifa + bandeira), com tributos calculados "por dentro". */
export function bill(kWh: number, tariff: number, flagAdd: number, taxPct: number): number {
  return (kWh * (tariff + flagAdd)) / (1 - taxPct / 100);
}

// ---------------------------------------------------------------------------
// Chuveiro
// ---------------------------------------------------------------------------

export const C_WATER = 4186;
/** Temperatura de saída: P = ṁ c ΔT, com vazão em L/min. */
export const showerOut = (P: number, flowLmin: number, Tin: number) => Tin + P / ((flowLmin / 60) * C_WATER);
/** Resistência do resistor para potência P na tensão V. */
export const resistance = (V: number, P: number) => (V * V) / P;

// ---------------------------------------------------------------------------
// Fios e disjuntores (NBR 5410, método B1, 2 condutores carregados, PVC 70 °C)
// ---------------------------------------------------------------------------

export const GAUGES = [1.5, 2.5, 4, 6, 10];
export const AMPACITY = [17.5, 24, 32, 41, 57];
export const BREAKERS = [10, 16, 20, 25, 32, 40, 50];
export const RHO_CU = 1.72e-8;
export const T_AMB = 30;
export const T_MAX = 70;
/** Constante de tempo térmica do fio (s), maior para fios grossos. */
export const wireTau = (Amm2: number) => 60 * Amm2;
/** Elevação de temperatura em regime: 40 °C na corrente admissível. */
export const wireRise = (I: number, Iz: number) => (T_MAX - T_AMB) * (I / Iz) ** 2;
/** Resistência de ida e volta de um circuito de L metros. */
export const loopR = (L: number, Amm2: number) => (2 * RHO_CU * L) / (Amm2 * 1e-6);

/** Disparo térmico: θ' = ((I/In)² − θ)/τ_b; desarma em θ = θ_t. */
export const BIMETAL_TAU = 60;
export const THETA_TRIP = 1.3 ** 2;
/** Múltiplo de In do disparo magnético instantâneo, curvas B e C. */
export const MAGNETIC = [5, 10];

/** Tempo de disparo térmico partindo do frio: t = τ ln(x²/(x² − θ_t)). */
export function tripTime(I: number, In: number): number {
  const x2 = (I / In) ** 2;
  if (x2 <= THETA_TRIP) return Infinity;
  return BIMETAL_TAU * Math.log(x2 / (x2 - THETA_TRIP));
}

// ---------------------------------------------------------------------------
// Medidor de disco
// ---------------------------------------------------------------------------

/** Potência medida contando n voltas do disco em Δt segundos: P = 3600·Kd·n/Δt (Kd em Wh/volta). */
export const meterPower = (Kd: number, n: number, dt: number) => (3600 * Kd * n) / dt;

/** Custo acumulado de uma lâmpada em `days` dias, incluindo as trocas. */
export function lampCost(l: (typeof LAMPS)[number], hoursPerDay: number, days: number, tariff: number, n = 1): number {
  const hrs = hoursPerDay * days;
  const bulbs = Math.floor(hrs / l.life) + 1;
  return n * (bulbs * l.price + (l.P * hrs * tariff) / 1000);
}
