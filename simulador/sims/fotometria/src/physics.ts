/** Fotometria: fontes, lei do inverso do quadrado e do cosseno, V(λ) e fotômetro de Bunsen. */

/** Eficácia luminosa máxima (lm/W) da visão fotópica (555 nm) e escotópica (507 nm). */
export const KM = 683;
export const KM_ESC = 1700;
export const H = 6.62607015e-34;
export const C = 299792458;
export const KB = 1.380649e-23;
export const SIGMA = 5.670374419e-8;

export interface Source {
  name: string;
  /** Fluxo luminoso total (lm). */
  phi: number;
  /** Expoente do diagrama de emissão I(α) = I₀ cosⁿ α em torno do eixo (para baixo); -1 = isotrópica. */
  n: number;
  /** Diâmetro aparente da parte que brilha (m), para a luminância. */
  d: number;
  /** Potência elétrica típica (W). */
  P: number;
}

export const SOURCES: Source[] = [
  { name: "Lâmpada incandescente 60 W", phi: 710, n: -1, d: 0.06, P: 60 },
  { name: "Lâmpada LED 9 W (bulbo)", phi: 806, n: 1, d: 0.06, P: 9 },
  { name: "Refletor LED 7 W (facho estreito)", phi: 500, n: 20, d: 0.05, P: 7 },
  { name: "Vela", phi: 4 * Math.PI, n: -1, d: 0.012, P: 80 },
  { name: "Sol (raios paralelos)", phi: 0, n: -1, d: 0, P: 0 },
];
export const SUN_E = 100_000;

/** Intensidade no eixo I₀ (cd) a partir do fluxo: isotrópica Φ/4π; cosⁿ em um hemisfério: Φ(n+1)/2π. */
export function I0(src: Source): number {
  return src.n < 0 ? src.phi / (4 * Math.PI) : (src.phi * (src.n + 1)) / (2 * Math.PI);
}

/** Intensidade luminosa (cd) na direção que faz ângulo α com o eixo da fonte (apontado para baixo). */
export function intensity(src: Source, alpha: number): number {
  if (src.n < 0) return I0(src);
  const c = Math.cos(alpha);
  return c <= 0 ? 0 : I0(src) * c ** src.n;
}

/** Fluxo dentro de um cone de semiabertura β em torno do eixo: Φ = 2π ∫ I(α) sen α dα. */
export function coneFlux(src: Source, beta: number, n = 400): number {
  let s = 0;
  const h = beta / n;
  for (let i = 0; i <= n; i++) {
    const a = i * h;
    s += intensity(src, a) * Math.sin(a) * (i === 0 || i === n ? 1 : i % 2 ? 4 : 2);
  }
  return ((2 * Math.PI * s * h) / 3);
}

/** Ângulo sólido de um cone de semiabertura β (sr). */
export const solidAngle = (beta: number) => 2 * Math.PI * (1 - Math.cos(beta));

/**
 * Iluminância (lx) num sensor em (mx, my) com normal de ângulo `tilt` (rad, medido a partir de +y,
 * positivo no sentido anti-horário), iluminado por uma fonte pontual em (lx, ly) com eixo para baixo.
 */
export function illuminance(src: Source, lx: number, ly: number, mx: number, my: number, tilt: number, sunElev = Math.PI / 3) {
  const nx = -Math.sin(tilt), ny = Math.cos(tilt);
  if (src.phi === 0) {
    // Sol: direção fixa (de onde vem a luz), E⊥ constante.
    const ux = -Math.cos(sunElev), uy = Math.sin(sunElev);
    const cosT = nx * ux + ny * uy;
    return { E: Math.max(0, SUN_E * cosT), r: Infinity, theta: Math.acos(Math.max(-1, Math.min(1, cosT))), I: NaN, alpha: 0 };
  }
  const dx = lx - mx, dy = ly - my;
  const r = Math.max(Math.hypot(dx, dy), 1e-3);
  const ux = dx / r, uy = dy / r; // do sensor para a fonte
  const cosT = nx * ux + ny * uy;
  const alpha = Math.acos(Math.max(-1, Math.min(1, uy))); // ângulo entre a direção fonte→sensor e o eixo (para baixo)
  const I = intensity(src, alpha);
  return { E: cosT > 0 ? (I * cosT) / (r * r) : 0, r, theta: Math.acos(Math.max(-1, Math.min(1, cosT))), I, alpha };
}

// ---------- Sensibilidade do olho ----------

/** Eficiência luminosa fotópica V(λ) (ajuste gaussiano, λ em nm; pico 1 em ≈ 555 nm). */
export const Vphot = (nm: number) => 1.019 * Math.exp(-285.4 * (nm / 1000 - 0.559) ** 2);
/** Eficiência luminosa escotópica V'(λ) (ajuste gaussiano, pico em ≈ 507 nm). */
export const Vscot = (nm: number) => 0.992 * Math.exp(-321.9 * (nm / 1000 - 0.507) ** 2);

/** Exitância espectral de Planck (W/m² por m). */
export function planck(lam: number, T: number): number {
  const x = (H * C) / (lam * KB * T);
  if (x > 700) return 0;
  return (2 * Math.PI * H * C * C) / (lam ** 5 * Math.expm1(x));
}

export const SPECTRA = ["Monocromática (laser/LED colorido)", "Corpo negro (incandescente, Sol)", "LED branco (azul + fósforo)", "Sódio de baixa pressão"];

/**
 * Densidade espectral relativa S(λ) (por nm) do espectro escolhido e fração da potência radiante
 * que cai no intervalo 380–780 nm (o resto é infravermelho/ultravioleta).
 */
export function spectrum(kind: number, lamMono: number, T: number): { S: (nm: number) => number; norm: number } {
  switch (kind) {
    case 1: {
      // normaliza pela potência total σT⁴ (inclui o infravermelho)
      const tot = SIGMA * T ** 4; // S(λ) por nm integra para 1 em todo o espectro
      return { S: (nm) => (planck(nm * 1e-9, T) * 1e-9) / tot, norm: 1 };
    }
    case 2: {
      const g = (nm: number, mu: number, s: number) => Math.exp(-0.5 * ((nm - mu) / s) ** 2) / (s * Math.sqrt(2 * Math.PI));
      return { S: (nm) => 0.3 * g(nm, 450, 11) + 0.7 * g(nm, 565, 55), norm: 1 };
    }
    case 3: {
      const s = 0.6; // linha D (589,0 e 589,6 nm) alargada para desenhar
      return { S: (nm) => (0.5 * Math.exp(-0.5 * ((nm - 589.0) / s) ** 2) + 0.5 * Math.exp(-0.5 * ((nm - 589.6) / s) ** 2)) / (s * Math.sqrt(2 * Math.PI)), norm: 1 };
    }
    default: {
      const s = 0.5;
      return { S: (nm) => Math.exp(-0.5 * ((nm - lamMono) / s) ** 2) / (s * Math.sqrt(2 * Math.PI)), norm: 1 };
    }
  }
}

/** Eficácia luminosa da radiação K = Φ/P (lm/W) para o espectro dado e o tipo de visão. */
export function efficacy(kind: number, lamMono: number, T: number, scotopic = false): number {
  if (kind === 0) return scotopic ? KM_ESC * Vscot(lamMono) : KM * Vphot(lamMono);
  if (kind === 3) return scotopic ? KM_ESC * (Vscot(589) + Vscot(589.6)) / 2 : (KM * (Vphot(589) + Vphot(589.6))) / 2;
  const { S } = spectrum(kind, lamMono, T);
  let s = 0;
  const V = scotopic ? Vscot : Vphot;
  for (let nm = 360; nm <= 830; nm += 1) s += S(nm) * V(nm);
  return (scotopic ? KM_ESC : KM) * s;
}

// ---------- Cor (CIE 1931, ajuste de Wyman, Sloan e Shirley) ----------
const lobe = (x: number, mu: number, s1: number, s2: number) => {
  const t = (x - mu) / (x < mu ? s1 : s2);
  return Math.exp(-0.5 * t * t);
};
export function cieXYZ(nm: number): [number, number, number] {
  return [
    1.056 * lobe(nm, 599.8, 37.9, 31.0) + 0.362 * lobe(nm, 442.0, 16.0, 26.7) - 0.065 * lobe(nm, 501.1, 20.4, 26.2),
    0.821 * lobe(nm, 568.8, 46.9, 40.5) + 0.286 * lobe(nm, 530.9, 16.3, 31.1),
    1.217 * lobe(nm, 437.0, 11.8, 36.0) + 0.681 * lobe(nm, 459.0, 26.0, 13.8),
  ];
}
const gam = (u: number) => (u <= 0.0031308 ? 12.92 * u : 1.055 * u ** (1 / 2.4) - 0.055);
/** Cor sRGB normalizada de um espectro S(λ). */
export function spectrumColor(S: (nm: number) => number): string {
  let X = 0, Y = 0, Z = 0;
  for (let nm = 380; nm <= 780; nm += 1) {
    const [x, y, z] = cieXYZ(nm);
    const s = S(nm);
    X += s * x; Y += s * y; Z += s * z;
  }
  let r = 3.2406 * X - 1.5372 * Y - 0.4986 * Z;
  let g = -0.9689 * X + 1.8758 * Y + 0.0415 * Z;
  let b = 0.0557 * X - 0.204 * Y + 1.057 * Z;
  const lo = Math.min(r, g, b, 0);
  r -= lo; g -= lo; b -= lo;
  const hi = Math.max(r, g, b, 1e-300);
  const c = (v: number) => Math.round(255 * Math.max(0, Math.min(1, gam(v / hi))));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

// ---------- Fotômetro de Bunsen ----------
/** Refletância e transmitância do papel e da mancha de óleo. */
export const PAPER = { R: 0.8, T: 0.1 };
export const SPOT = { R: 0.45, T: 0.45 };

/** Iluminâncias nas duas faces do anteparo a x da fonte 1 (banco de comprimento D) e contraste visto de cada lado. */
export function bunsen(I1: number, I2: number, D: number, x: number) {
  const EL = I1 / (x * x), ER = I2 / ((D - x) * (D - x));
  const paperL = PAPER.R * EL + PAPER.T * ER, spotL = SPOT.R * EL + SPOT.T * ER;
  const paperR = PAPER.R * ER + PAPER.T * EL, spotR = SPOT.R * ER + SPOT.T * EL;
  return { EL, ER, paperL, spotL, paperR, spotR, contrast: (spotL - paperL) / paperL };
}

/** Posição de equilíbrio (mancha some): I1/x² = I2/(D−x)². */
export const bunsenBalance = (I1: number, I2: number, D: number) => (D * Math.sqrt(I1)) / (Math.sqrt(I1) + Math.sqrt(I2));

/** Intensidades das fontes "desconhecidas" do fotômetro (cd). */
export const UNKNOWN = [18, 43, 95, 7.5];
