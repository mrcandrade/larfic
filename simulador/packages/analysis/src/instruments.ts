// Instrumentos virtuais: leituras realistas com resolução, exatidão, ruído e erro de zero.
import { gaussian } from "@fisilab/core";

export type InstrumentKind = "analogico" | "nonio" | "digital";

export interface Instrument {
  id: string;
  name: string;
  unit: string;
  kind: InstrumentKind;
  /** Menor divisão (analógico/nônio) ou último dígito (digital). */
  resolution: number;
  range: [number, number];
  /** Exatidão do fabricante em função da leitura: devolve o limite de erro (±). */
  accuracy?: (reading: number) => number;
  /** Desvio padrão do ruído/variação de leitura (ex.: tempo de reação no cronômetro manual). */
  noise?: number;
}

export interface Reading {
  /** Valor exibido (já quantizado). */
  value: number;
  /** Incerteza padrão do tipo B associada a uma leitura única. */
  u: number;
  /** Texto como aparece no instrumento. */
  display: string;
  overRange: boolean;
}

const quantize = (v: number, res: number) => Math.round(v / res) * res;
const decimalsOf = (res: number) => Math.max(0, -Math.floor(Math.log10(res) + 1e-9));

/** Incerteza tipo B de uma leitura única: resolução combinada com a exatidão (retangular). */
export function readingUncertainty(inst: Instrument, reading: number): number {
  const res = inst.kind === "analogico" ? inst.resolution / 2 : inst.resolution / (2 * Math.sqrt(3));
  const acc = inst.accuracy ? inst.accuracy(reading) / Math.sqrt(3) : 0;
  return Math.sqrt(res * res + acc * acc);
}

/**
 * Lê um valor verdadeiro com o instrumento.
 * `rand` é um gerador uniforme (use `rng(semente)` do core para leituras reprodutíveis);
 * `zeroError` simula descalibração (o aluno deve verificar o zero antes de medir).
 */
export function read(inst: Instrument, trueValue: number, rand: () => number, zeroError = 0): Reading {
  let v = trueValue + zeroError;
  if (inst.noise) v += inst.noise * gaussian(rand);
  if (inst.accuracy) v += inst.accuracy(Math.abs(trueValue)) * (2 * rand() - 1) * 0.5;
  const overRange = v < inst.range[0] || v > inst.range[1];
  const value = quantize(Math.min(inst.range[1], Math.max(inst.range[0], v)), inst.resolution);
  const display = overRange ? "OL" : value.toFixed(decimalsOf(inst.resolution)).replace(".", ",");
  return { value, u: readingUncertainty(inst, value), display, overRange };
}

/** Exatidão típica de multímetro digital: ±(pct% da leitura + n dígitos). */
export const dmmAccuracy = (pct: number, digits: number, resolution: number) => (r: number) => (pct / 100) * Math.abs(r) + digits * resolution;

/** Catálogo dos instrumentos das práticas de Física Experimental. */
export const instruments = {
  regua: { id: "regua", name: "Régua milimetrada", unit: "mm", kind: "analogico", resolution: 1, range: [0, 300] },
  trena: { id: "trena", name: "Trena", unit: "m", kind: "analogico", resolution: 0.001, range: [0, 5] },
  paquimetro: { id: "paquimetro", name: "Paquímetro (nônio 0,05 mm)", unit: "mm", kind: "nonio", resolution: 0.05, range: [0, 150] },
  micrometro: { id: "micrometro", name: "Micrômetro", unit: "mm", kind: "nonio", resolution: 0.01, range: [0, 25] },
  balanca: { id: "balanca", name: "Balança digital", unit: "g", kind: "digital", resolution: 0.01, range: [0, 500], accuracy: (r) => 0.02 + 1e-4 * r },
  cronometroManual: { id: "cronometroManual", name: "Cronômetro manual", unit: "s", kind: "digital", resolution: 0.01, range: [0, 3600], noise: 0.08 },
  fotoporta: { id: "fotoporta", name: "Sensor fotoelétrico (fotoporta)", unit: "s", kind: "digital", resolution: 1e-4, range: [0, 100], accuracy: () => 2e-4 },
  termometro: { id: "termometro", name: "Termômetro de bulbo", unit: "°C", kind: "analogico", resolution: 1, range: [-10, 110] },
  termopar: { id: "termopar", name: "Termômetro digital (termopar)", unit: "°C", kind: "digital", resolution: 0.1, range: [-50, 400], accuracy: (r) => 0.5 + 0.005 * Math.abs(r) },
  dinamometro: { id: "dinamometro", name: "Dinamômetro 10 N", unit: "N", kind: "analogico", resolution: 0.1, range: [0, 10] },
  voltimetro: { id: "voltimetro", name: "Multímetro (V DC, 20 V)", unit: "V", kind: "digital", resolution: 0.01, range: [-20, 20], accuracy: dmmAccuracy(0.5, 2, 0.01) },
  amperimetro: { id: "amperimetro", name: "Multímetro (A DC, 200 mA)", unit: "mA", kind: "digital", resolution: 0.1, range: [-200, 200], accuracy: dmmAccuracy(1, 3, 0.1) },
  ohmimetro: { id: "ohmimetro", name: "Multímetro (Ω, 2 kΩ)", unit: "Ω", kind: "digital", resolution: 1, range: [0, 2000], accuracy: dmmAccuracy(0.8, 3, 1) },
  goniometro: { id: "goniometro", name: "Goniômetro / transferidor", unit: "°", kind: "analogico", resolution: 1, range: [0, 360] },
  manometro: { id: "manometro", name: "Manômetro", unit: "kPa", kind: "analogico", resolution: 2, range: [0, 300] },
} satisfies Record<string, Instrument>;

/**
 * Leitura de nônio: decompõe um comprimento na escala principal (mm) e no traço do nônio que coincide.
 * Útil para desenhar o paquímetro e treinar a leitura.
 */
export function vernierReading(length: number, resolution = 0.05): { main: number; vernierLine: number; value: number } {
  const value = quantize(length, resolution);
  const main = Math.floor(value + 1e-9);
  const vernierLine = Math.round((value - main) / resolution);
  return { main, vernierLine, value };
}

/** Micrômetro: escala da bainha (meio milímetro) + tambor de 50 divisões. */
export function micrometerReading(length: number): { sleeve: number; drum: number; value: number } {
  const value = quantize(length, 0.01);
  const sleeve = Math.floor((value + 1e-9) / 0.5) * 0.5;
  return { sleeve, drum: Math.round((value - sleeve) / 0.01), value };
}
