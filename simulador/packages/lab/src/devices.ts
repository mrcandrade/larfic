// Dispositivos simulados que imitam um Arduino com sensores reais, imprimindo linhas
// no mesmo formato dos sketches de exemplo (e entregues em pedaços, como pela porta serial).

import { rng } from "@fisilab/core";
import { steinhartHart, NTC_COEFFS } from "./sketches.ts";

export type SimDeviceId = "ultrassonico" | "termistor" | "ldr" | "rc";

export interface SimDeviceInfo {
  id: SimDeviceId;
  title: string;
  description: string;
  /** Período de amostragem, em ms. */
  periodMs: number;
}

export const simDevices: SimDeviceInfo[] = [
  {
    id: "ultrassonico",
    title: "Ultrassônico HC-SR04 e carrinho em MRUV",
    description: "Um carrinho parte do repouso a 20 cm do sensor e acelera (≈ 0,25 m/s²) até o batente em 170 cm; o ciclo se repete a cada 6 s. Formato CSV: t_ms,dist_cm.",
    periodMs: 50,
  },
  {
    id: "termistor",
    title: "Termistor NTC esfriando (lei de Newton)",
    description: "Um NTC de 10 kΩ sai da água quente (75 °C) e esfria no ar a 25 °C com τ ≈ 25 s. Formato chave: valor, convertido por Steinhart–Hart.",
    periodMs: 200,
  },
  {
    id: "ldr",
    title: "LDR sob um pêndulo (sombra a cada passagem)",
    description: "O peso de um pêndulo de 60 cm faz sombra sobre o LDR duas vezes por período. Formato TSV: t_ms, adc, R_kohm.",
    periodMs: 20,
  },
  {
    id: "rc",
    title: "Carga e descarga de capacitor (RC = 1 s)",
    description: "R = 100 kΩ, C = 10 µF; 1 s descarregando e 5 s carregando a partir de 5 V. Formato CSV: t_ms,Vc.",
    periodMs: 50,
  },
];

/**
 * Dispositivo simulado. `read(nowMs)` gera todas as amostras até o instante pedido e devolve
 * parte do texto pendente (às vezes cortando uma linha no meio, como a porta serial faz).
 */
export class SimDevice {
  readonly info: SimDeviceInfo;
  private rand: () => number;
  private nextSample = 0;
  private pending = "";
  private started = false;

  constructor(id: SimDeviceId, seed = 1) {
    this.info = simDevices.find((d) => d.id === id)!;
    this.rand = rng(seed);
  }

  private gauss(): number {
    const u = Math.max(1e-12, this.rand()), v = this.rand();
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v);
  }

  private header(): string {
    switch (this.info.id) {
      case "ultrassonico":
        return "# HC-SR04 pronto\nt_ms,dist_cm\n";
      case "termistor":
        return "Termistor NTC 10k - Steinhart-Hart\n";
      case "ldr":
        return "t_ms\tadc\tR_kohm\n";
      case "rc":
        return "# Capacitor RC: R=100k C=10uF\nt_ms,Vc\n";
    }
  }

  /** Uma linha de dados no instante tMs (desde que o "Arduino" ligou). */
  sampleLine(tMs: number): string {
    const t = tMs / 1000;
    switch (this.info.id) {
      case "ultrassonico": {
        const c = t % 6;
        const a = 25; // cm/s²
        const tm = Math.max(0, c - 0.5);
        const d = Math.min(170, 20 + 0.5 * a * tm * tm);
        // pulseIn mede o tempo de ida e volta em µs (≈ 58,3 µs por cm), com jitter de alguns µs
        const us = Math.round(d * 58.31 + 6 * this.gauss());
        return `${Math.round(tMs)},${((us * 0.0343) / 2).toFixed(2)}`;
      }
      case "termistor": {
        const T = 25 + 50 * Math.exp(-t / 25) + 0.05 * this.gauss();
        const R = ntcResistance(T);
        // divisor: 10 kΩ fixo no 5 V, NTC no GND; A0 lê a tensão sobre o NTC
        const adc = Math.round((1023 * R) / (R + 10000));
        const Rm = (10000 * adc) / (1023 - adc);
        const Tm = steinhartHart(Rm) - 273.15;
        return `t: ${t.toFixed(2)} s, R: ${Math.round(Rm)} ohm, T: ${Tm.toFixed(2)} C`;
      }
      case "ldr": {
        const L = 0.6, g = 9.81, A = 0.1;
        const period = 2 * Math.PI * Math.sqrt(L / g);
        const x = A * Math.sin((2 * Math.PI * t) / period);
        const adc = Math.max(0, Math.min(1023, Math.round(820 - 520 * Math.exp(-((x / 0.012) ** 2)) + 3 * this.gauss())));
        // LDR no 5 V, 10 kΩ no GND: R = 10k (1023 − adc)/adc
        const R = adc > 0 ? (10 * (1023 - adc)) / adc : NaN;
        return `${Math.round(tMs)}\t${adc}\t${R.toFixed(2)}`;
      }
      case "rc": {
        const c = t % 6;
        const v = c < 1 ? 5 * (1 - Math.exp(-5)) * Math.exp(-c / 1.0) : 5 * (1 - Math.exp(-(c - 1) / 1.0));
        const adc = Math.max(0, Math.min(1023, Math.round((v / 5) * 1023 + 0.7 * this.gauss())));
        return `${Math.round(tMs)},${((adc * 5) / 1023).toFixed(3)}`;
      }
    }
  }

  /** Avança o relógio até nowMs e devolve o próximo pedaço de texto da "porta serial". */
  read(nowMs: number): string {
    if (!this.started) {
      this.pending += this.header();
      this.started = true;
    }
    while (this.nextSample <= nowMs) {
      this.pending += this.sampleLine(this.nextSample) + "\r\n";
      this.nextSample += this.info.periodMs;
    }
    if (!this.pending) return "";
    // Entrega de 60% a 100% do que está pendente: linhas podem ficar quebradas entre leituras.
    const k = Math.max(1, Math.ceil(this.pending.length * (0.6 + 0.4 * this.rand())));
    const out = this.pending.slice(0, k);
    this.pending = this.pending.slice(k);
    return out;
  }
}

/** Resistência do NTC para a temperatura T (°C), invertendo Steinhart–Hart por Newton em ln R. */
export function ntcResistance(Tc: number): number {
  const { A, B, C } = NTC_COEFFS;
  const target = 1 / (Tc + 273.15);
  let L = Math.log(10000);
  for (let i = 0; i < 30; i++) {
    const f = A + B * L + C * L ** 3 - target;
    L -= f / (B + 3 * C * L * L);
  }
  return Math.exp(L);
}
