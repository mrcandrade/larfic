/** Partícula em caixas 2D e 3D (ħ = m = 1) e pontos quânticos esféricos (modelo de Brus). */

export interface BoxLevel {
  E: number;
  /** Números quânticos (nx, ny[, nz]) de todos os estados com essa energia. */
  states: number[][];
}

/**
 * Níveis de uma caixa retangular de paredes infinitas com lados `Ls` (2 ou 3 lados):
 * E = (π²/2) Σ nᵢ²/Lᵢ², nᵢ = 1, 2, …; estados de mesma energia são agrupados (degenerescência).
 */
export function boxLevels(Ls: number[], count = 10, nMax = 8): BoxLevel[] {
  const all: { E: number; n: number[] }[] = [];
  const rec = (i: number, n: number[]) => {
    if (i === Ls.length) {
      const E = (Math.PI ** 2 / 2) * n.reduce((a, k, j) => a + (k * k) / Ls[j]! ** 2, 0);
      all.push({ E, n: n.slice() });
      return;
    }
    for (let k = 1; k <= nMax; k++) rec(i + 1, [...n, k]);
  };
  rec(0, []);
  all.sort((a, b) => a.E - b.E);
  const out: BoxLevel[] = [];
  for (const s of all) {
    const last = out[out.length - 1];
    if (last && Math.abs(s.E - last.E) <= 1e-9 * last.E) last.states.push(s.n);
    else {
      if (out.length === count) break;
      out.push({ E: s.E, states: [s.n] });
    }
  }
  return out;
}

/** |ψ|² normalizado a 1 no máximo, de um estado da caixa 2D em (x, y) ∈ [0, Lx] × [0, Ly]. */
export const boxDensity2D = (nx: number, ny: number, Lx: number, Ly: number, x: number, y: number) =>
  (Math.sin((nx * Math.PI * x) / Lx) * Math.sin((ny * Math.PI * y) / Ly)) ** 2;

// ---------- Pontos quânticos de CdSe ----------
const H = 6.62607015e-34;
const ME = 9.1093837015e-31;
const EV = 1.602176634e-19;
/** e²/(4πε₀) em eV·nm. */
const KE2 = 1.439964;
export const CDSE = { Eg: 1.74, me: 0.13, mh: 0.45, er: 10.6 };

/**
 * Energia do fóton emitido (eV) por um nanocristal esférico de raio R (nm), modelo de Brus:
 * E = E_g + h²/(8R²)(1/mₑ* + 1/mₕ*) − 1,786 e²/(4πε₀ εᵣ R).
 */
export function dotEnergy(Rnm: number, m = CDSE): number {
  const R = Rnm * 1e-9;
  const conf = ((H * H) / (8 * ME * R * R)) * (1 / m.me + 1 / m.mh) / EV;
  return m.Eg + conf - (1.786 * KE2) / (m.er * Rnm);
}

export const photonNm = (E_eV: number) => 1239.84 / E_eV;

/** Cor aproximada (r, g, b de 0 a 255) de um comprimento de onda; fora do visível, cinza escuro. */
export function nmToCss(nm: number): string {
  let r = 0;
  let g = 0;
  let b = 0;
  if (nm >= 380 && nm < 440) [r, g, b] = [-(nm - 440) / 60, 0, 1];
  else if (nm < 490 && nm >= 440) [r, g, b] = [0, (nm - 440) / 50, 1];
  else if (nm < 510 && nm >= 490) [r, g, b] = [0, 1, -(nm - 510) / 20];
  else if (nm < 580 && nm >= 510) [r, g, b] = [(nm - 510) / 70, 1, 0];
  else if (nm < 645 && nm >= 580) [r, g, b] = [1, -(nm - 645) / 65, 0];
  else if (nm <= 780 && nm >= 645) [r, g, b] = [1, 0, 0];
  else return "rgb(60,60,60)";
  const f = nm < 420 ? 0.3 + (0.7 * (nm - 380)) / 40 : nm > 700 ? 0.3 + (0.7 * (780 - nm)) / 80 : 1;
  const c = (v: number) => Math.round(255 * (v * f) ** 0.8);
  return `rgb(${c(r)},${c(g)},${c(b)})`;
}
