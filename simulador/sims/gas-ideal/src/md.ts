import { gaussian, num, rng, type Params } from "@fisilab/core";

/**
 * Dinâmica molecular 2D de discos rígidos.
 * Unidades internas: posição em nm, velocidade em nm/ps (= 1000 m/s), tempo em ps.
 * Grandezas medidas são convertidas para SI ao sair (pressão 2D em N/m).
 */

export const KB = 1.380649e-23;
export const AMU = 1.66053907e-27;
/** Altura fixa da caixa (nm). */
export const H = 20;
export const L_MIN = 4;
export const L_MAX = 30;
/** Câmera lenta: 1 s de animação = 25 ps de tempo físico. */
export const TIME_SCALE = 25;
/** Passo do runner (s de animação) → 0,05 ps físicos. */
export const DT = 1 / 500;
export const NBINS = 28;
/** Tempo de média da pressão (ps). */
export const TAU_P = 20;
/** Histograma: um retrato a cada HIST_EVERY passos, com esquecimento exponencial. */
export const HIST_EVERY = 10;
export const HIST_DECAY = 0.985;

export interface GasState {
  x: Float64Array;
  y: Float64Array;
  vx: Float64Array;
  vy: Float64Array;
  /** Tempo físico (ps). */
  tp: number;
  /** Passos dados (para o sorteio determinístico da parede térmica). */
  k: number;
  /** Posição do pistão (largura da caixa, nm), alvo e velocidade atual (nm/ps). */
  xp: number;
  xt: number;
  up: number;
  grab: boolean;
  /** Pressão em média móvel (N/m) e acumuladores da média desde o último reinício. */
  Pema: number;
  imp: number;
  tacc: number;
  /** Histograma de rapidez (pesos com esquecimento), soma dos pesos e limite superior (nm/ps). */
  hist: number[];
  hw: number;
  vmax: number;
}

export const mass = (p: Params) => num(p, "massa", 40) * AMU;
export const diameter = (p: Params) => num(p, "diam", 0.2);
/** Desvio padrão de cada componente da velocidade, em nm/ps: √(kT/m). */
export const sigmaV = (T: number, m: number) => Math.sqrt((KB * T) / m) / 1000;

export function kineticEnergy(s: GasState, m: number): number {
  let e = 0;
  for (let i = 0; i < s.vx.length; i++) e += s.vx[i]! ** 2 + s.vy[i]! ** 2;
  return 0.5 * m * e * 1e6;
}

/** Temperatura cinética em 2D: ⟨½mv²⟩ = kT (dois graus de liberdade). */
export const temperatureOf = (s: GasState, m: number) => kineticEnergy(s, m) / (s.vx.length * KB);
export const areaOf = (s: GasState) => s.xp * H; // nm²
/** Pressão 2D do gás ideal NkT/A, em N/m. */
export const idealPressure = (s: GasState, m: number) => (s.vx.length * KB * temperatureOf(s, m)) / (areaOf(s) * 1e-18);
/** Pressão média desde o último reinício das médias, em N/m. */
export const meanPressure = (s: GasState) => (s.tacc > 0 ? s.imp / (s.tacc * 1e-12 * 2 * (s.xp + H) * 1e-9) : s.Pema);

function scaleTo(vx: Float64Array, vy: Float64Array, T: number, m: number) {
  const n = vx.length;
  let mx = 0, my = 0;
  for (let i = 0; i < n; i++) {
    mx += vx[i]!;
    my += vy[i]!;
  }
  mx /= n;
  my /= n;
  let e = 0;
  for (let i = 0; i < n; i++) {
    vx[i] = vx[i]! - mx;
    vy[i] = vy[i]! - my;
    e += vx[i]! ** 2 + vy[i]! ** 2;
  }
  // ½ m Σv² = N k T
  const f = Math.sqrt((2 * n * KB * T) / (m * e * 1e6));
  for (let i = 0; i < n; i++) {
    vx[i] = vx[i]! * f;
    vy[i] = vy[i]! * f;
  }
}

export function freshHist(T: number, m: number): Pick<GasState, "hist" | "hw" | "vmax"> {
  return { hist: new Array<number>(NBINS).fill(0), hw: 0, vmax: 4.5 * sigmaV(T, m) };
}

export function initGas(p: Params): GasState {
  const n = Math.max(2, Math.round(num(p, "N", 120)));
  const m = mass(p);
  const T = num(p, "T0", 300);
  const L = Math.min(L_MAX, Math.max(L_MIN, num(p, "L0", 20)));
  const d = diameter(p);
  const r = rng(Math.round(num(p, "seed", 1)) * 2654435761);
  const x = new Float64Array(n), y = new Float64Array(n), vx = new Float64Array(n), vy = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    // Sorteio sem sobreposição (desiste após algumas tentativas em caixas lotadas).
    for (let tries = 0; tries < 200; tries++) {
      x[i] = d / 2 + r() * (L - d);
      y[i] = d / 2 + r() * (H - d);
      let ok = true;
      for (let j = 0; j < i && ok; j++) if ((x[i]! - x[j]!) ** 2 + (y[i]! - y[j]!) ** 2 < d * d * 1.2) ok = false;
      if (ok) break;
    }
    if (Math.round(num(p, "dist")) === 1) {
      const a = 2 * Math.PI * r();
      vx[i] = Math.cos(a);
      vy[i] = Math.sin(a);
    } else {
      vx[i] = gaussian(r);
      vy[i] = gaussian(r);
    }
  }
  if (Math.round(num(p, "dist")) === 1) {
    // Todas com a mesma rapidez √(2kT/m), em direções aleatórias (sem remover o momento médio).
    const v = Math.sqrt(2) * sigmaV(T, m);
    for (let i = 0; i < n; i++) {
      vx[i] = vx[i]! * v;
      vy[i] = vy[i]! * v;
    }
  } else scaleTo(vx, vy, T, m);
  return { x, y, vx, vy, tp: 0, k: 0, xp: L, xt: L, up: 0, grab: false, Pema: 0, imp: 0, tacc: 0, ...freshHist(T, m) };
}

/** Reinicia as médias de pressão e o histograma (após mudar o estado do gás). */
export function resetAverages(s: GasState, m: number): GasState {
  return { ...s, imp: 0, tacc: 0, ...freshHist(temperatureOf(s, m), m) };
}

/** Multiplica a temperatura por f (reescala todas as velocidades). */
export function heat(s: GasState, f: number, m: number): GasState {
  const k = Math.sqrt(f);
  const vx = s.vx.map((v) => v * k);
  const vy = s.vy.map((v) => v * k);
  return resetAverages({ ...s, vx, vy, Pema: s.Pema * f }, m);
}

export function stepGas(s: GasState, p: Params, dtAnim: number): GasState {
  const dt = dtAnim * TIME_SCALE; // ps
  const m = mass(p);
  const d = diameter(p);
  const n = s.x.length;
  const x = s.x.slice(), y = s.y.slice(), vx = s.vx.slice(), vy = s.vy.slice();

  // Pistão: segue o alvo com velocidade limitada.
  const vmaxP = num(p, "vpist", 0.1);
  const gap = s.xt - s.xp;
  const up = Math.abs(gap) < 1e-9 ? 0 : Math.max(-vmaxP, Math.min(vmaxP, gap / dt));
  const xp = s.xp + up * dt;

  const thermal = Math.round(num(p, "parede")) === 1;
  const sw = sigmaV(num(p, "Tw", 300), m);
  const r = thermal ? rng((Math.imul(Math.round(num(p, "seed", 1)), 0x9e3779b1) ^ Math.imul(s.k + 1, 0x85ebca6b)) >>> 0) : undefined;

  let imp = 0; // impulso nas paredes, em unidades m·nm/ps
  for (let i = 0; i < n; i++) {
    let xi = x[i]! + vx[i]! * dt;
    let yi = y[i]! + vy[i]! * dt;
    if (xi < 0) {
      const old = vx[i]!;
      if (r) {
        // Parede térmica: reemite com a distribuição do fluxo a T_w (normal ~ Rayleigh, tangencial ~ normal).
        vx[i] = sw * Math.sqrt(-2 * Math.log(1 - r()));
        vy[i] = sw * gaussian(r);
      } else vx[i] = -old;
      imp += vx[i]! - old;
      xi = Math.min(-xi, xp);
    }
    if (xi > xp) {
      if (vx[i]! > up) {
        const old = vx[i]!;
        vx[i] = 2 * up - old;
        imp += old - vx[i]!;
        xi = Math.max(0, 2 * xp - xi);
      } else xi = xp;
    }
    if (yi < 0) {
      imp += -2 * vy[i]!;
      vy[i] = -vy[i]!;
      yi = -yi;
    } else if (yi > H) {
      imp += 2 * vy[i]!;
      vy[i] = -vy[i]!;
      yi = 2 * H - yi;
    }
    x[i] = xi;
    y[i] = yi;
  }

  collide(x, y, vx, vy, d, xp);

  const impSI = imp * m * 1000; // kg·m/s
  const perim = 2 * (xp + H) * 1e-9;
  const Pinst = impSI / (dt * 1e-12 * perim);
  const tp = s.tp + dt;
  const w = Math.min(dt / TAU_P, dt / tp);
  const Pema = s.Pema + (Pinst - s.Pema) * w;
  const moving = up !== 0;

  let next: GasState = {
    x, y, vx, vy, tp, k: s.k + 1, xp, xt: s.xt, up, grab: s.grab, Pema,
    imp: moving ? 0 : s.imp + impSI, tacc: moving ? 0 : s.tacc + dt,
    hist: s.hist, hw: s.hw, vmax: s.vmax,
  };

  if (next.k % HIST_EVERY === 0) {
    const vp = sigmaV(temperatureOf(next, m), m);
    let { hist, hw, vmax } = next;
    if (vp > 0.4 * vmax || vp < 0.13 * vmax) ({ hist, hw, vmax } = freshHist(temperatureOf(next, m), m));
    hist = hist.map((h) => h * HIST_DECAY);
    hw = hw * HIST_DECAY + n;
    for (let i = 0; i < n; i++) {
      const b = Math.min(NBINS - 1, Math.floor((Math.hypot(vx[i]!, vy[i]!) / vmax) * NBINS));
      hist[b] = hist[b]! + 1;
    }
    next = { ...next, hist, hw, vmax };
  }
  return next;
}

/** Colisões elásticas entre discos iguais, com grade de células para achar vizinhos. */
function collide(x: Float64Array, y: Float64Array, vx: Float64Array, vy: Float64Array, d: number, L: number) {
  const n = x.length;
  const cs = Math.max(d, 1);
  const nx = Math.max(1, Math.ceil(L / cs));
  const ny = Math.max(1, Math.ceil(H / cs));
  const head = new Int32Array(nx * ny).fill(-1);
  const next = new Int32Array(n);
  const cell = (i: number) => Math.min(nx - 1, Math.max(0, Math.floor(x[i]! / cs))) + nx * Math.min(ny - 1, Math.max(0, Math.floor(y[i]! / cs)));
  for (let i = 0; i < n; i++) {
    const c = cell(i);
    next[i] = head[c]!;
    head[c] = i;
  }
  const d2 = d * d;
  for (let cy = 0; cy < ny; cy++) {
    for (let cx = 0; cx < nx; cx++) {
      for (let i = head[cx + nx * cy]!; i >= 0; i = next[i]!) {
        // Vizinhas: a própria célula (j depois de i na lista) e quatro "à frente".
        for (const [ox, oy] of NEIGH) {
          const ax = cx + ox, ay = cy + oy;
          if (ax < 0 || ax >= nx || ay >= ny) continue;
          let j = ox === 0 && oy === 0 ? next[i]! : head[ax + nx * ay]!;
          for (; j >= 0; j = next[j]!) {
            const dx = x[j]! - x[i]!;
            const dy = y[j]! - y[i]!;
            const r2 = dx * dx + dy * dy;
            if (r2 >= d2 || r2 === 0) continue;
            const dvx = vx[j]! - vx[i]!;
            const dvy = vy[j]! - vy[i]!;
            const dot = dvx * dx + dvy * dy;
            if (dot >= 0) continue; // já se afastando
            const f = dot / r2;
            vx[i] = vx[i]! + f * dx;
            vy[i] = vy[i]! + f * dy;
            vx[j] = vx[j]! - f * dx;
            vy[j] = vy[j]! - f * dy;
          }
        }
      }
    }
  }
}

const NEIGH: [number, number][] = [[0, 0], [1, 0], [-1, 1], [0, 1], [1, 1]];

/** Distribuição de Maxwell–Boltzmann 2D da rapidez: f(v) = (mv/kT) e^(−mv²/2kT), v em m/s. */
export function mb2d(v: number, T: number, m: number): number {
  const a = m / (KB * T);
  return a * v * Math.exp(-0.5 * a * v * v);
}
