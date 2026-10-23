import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { WHITE_NM, cssRGB, monoColor, spectrumColor, wavelengthRGB, type RGB } from "./cores.ts";
import {
  F,
  G,
  airy,
  dipRatio,
  fraunhofer,
  fresnelIntensity,
  fresnelNumber,
  grating,
  maxOrder,
  phasorChain,
  presetAperture,
  rayleighAngle,
  singleSlit,
  twoSources,
  type Shape,
} from "./fisica.ts";

export * from "./fisica.ts";
export * from "./cores.ts";

export const FENDA = 0;
export const REDE = 1;
export const RAYLEIGH = 2;
export const DESENHO = 3;
export const FRESNEL = 4;
export const T_SCAN = 10;
/** Tamanho real da abertura desenhável (lado da grade), em mm. */
export const APERTURE_MM = 1;
const CELL_M = (APERTURE_MM * 1e-3) / G;
export const SODIUM = [589.0, 589.6];

export interface DifState {
  /** Posição do detector ao longo do padrão, de −1 a 1. */
  u: number;
  /** Abertura desenhada G×G (1 = aberto), por linhas, linha 0 embaixo. */
  grid: number[];
  tool: "pincel" | "borracha";
}

const mode = (p: Params) => Math.round(num(p, "modo"));
const fonte = (p: Params) => Math.round(num(p, "fonte"));
const lam = (p: Params) => num(p, "lambda", 633);
const nSlits = (p: Params) => Math.max(1, Math.round(num(p, "N", 8)));
const dUm = (p: Params) => num(p, "d", 5);
const aF = (p: Params) => num(p, "aF", 1);
const zF = (p: Params) => num(p, "zF", 1);
const disco = (p: Params) => Math.round(num(p, "objF")) === 0;
/** Meio alcance (mm) da tela no modo Fresnel. */
export const fresnelRange = (p: Params) => 2.2 * aF(p);

let fKey = "";
let fProf: Float64Array | null = null;
/** Perfil radial I(r) no modo Fresnel, de r = 0 a fresnelRange, em FN + 1 pontos (com cache). */
export const FN = 220;
export function fresnelProfile(p: Params): Float64Array {
  const key = `${aF(p)}|${zF(p)}|${lam(p)}|${disco(p)}`;
  if (fProf && key === fKey) return fProf;
  const out = new Float64Array(FN + 1);
  for (let i = 0; i <= FN; i++) out[i] = fresnelIntensity((fresnelRange(p) * i) / FN, aF(p), zF(p), lam(p), disco(p));
  fKey = key;
  fProf = out;
  return out;
}
const profileAt = (p: Params, rMm: number) => {
  const pr = fresnelProfile(p);
  const x = Math.min(FN - 1e-9, (Math.abs(rMm) / fresnelRange(p)) * FN);
  const i = Math.floor(x);
  return pr[i]! + (x - i) * (pr[i + 1]! - pr[i]!);
};
/** Largura das fendas da rede: 30% do período. */
export const gratingSlit = (p: Params) => 0.3 * dUm(p);

/** Comprimentos de onda presentes na fonte. */
export function wavelengths(p: Params): number[] {
  if (mode(p) === RAYLEIGH || mode(p) === DESENHO) return [lam(p)];
  if (fonte(p) === 1) return WHITE_NM;
  if (fonte(p) === 2) return SODIUM;
  return [lam(p)];
}

/** Intensidade relativa (fenda ou rede) em sen θ, média sobre os λ da fonte. */
export function intensity1D(sinT: number, p: Params): number {
  const ls = wavelengths(p);
  let sum = 0;
  for (const l of ls) sum += mode(p) === REDE ? grating(sinT, nSlits(p), dUm(p), gratingSlit(p), l) : singleSlit(sinT, num(p, "a", 40), l);
  return sum / ls.length;
}

/** Meio alcance em sen θ mostrado nos modos fenda e rede. */
export function sinRange(p: Params): number {
  const lref = Math.max(...wavelengths(p));
  if (mode(p) === REDE) return Math.min(1, (3.4 * lref * 1e-9) / (dUm(p) * 1e-6));
  return Math.min(1, (3.6 * lref * 1e-9) / (num(p, "a", 40) * 1e-6));
}

/** Meio alcance angular (rad) da imagem de Rayleigh. */
export const rayRange = (p: Params) => (num(p, "alpha", 400) * 1e-6) / 2 + 2.2 * rayleighAngle(num(p, "D", 2), lam(p));
/** Meio alcance angular (rad) do padrão calculado por FFT: λ/(2Δ). */
export const fftRange = (p: Params) => (lam(p) * 1e-9) / (2 * CELL_M);

const cache = new WeakMap<number[], Float64Array>();
export function patternOf(grid: number[]): Float64Array {
  let v = cache.get(grid);
  if (!v) {
    v = fraunhofer(grid);
    cache.set(grid, v);
  }
  return v;
}

/** Ângulo (rad) do detector. */
export function detectorTheta(s: DifState, p: Params): number {
  switch (mode(p)) {
    case RAYLEIGH:
      return s.u * rayRange(p);
    case DESENHO:
      return Math.asin(clamp(s.u * fftRange(p), -1, 1));
    case FRESNEL:
      return (s.u * fresnelRange(p) * 1e-3) / zF(p);
    default:
      return Math.asin(clamp(s.u * sinRange(p), -1, 1));
  }
}

/** Intensidade relativa no detector. */
export function detectorI(s: DifState, p: Params): number {
  switch (mode(p)) {
    case RAYLEIGH: {
      const D = num(p, "D", 2);
      return twoSources(s.u * rayRange(p), num(p, "alpha", 400) * 1e-6, D, lam(p)) / Math.max(1, twoSources(num(p, "alpha", 400) * 5e-7, num(p, "alpha", 400) * 1e-6, D, lam(p)));
    }
    case DESENHO: {
      const img = patternOf(s.grid);
      const x = clamp(F / 2 + s.u * (F / 2), 0, F - 1.001);
      const i = Math.floor(x);
      const f = x - i;
      const row = (F / 2) * F;
      return (img[row + i] ?? 0) * (1 - f) + (img[row + i + 1] ?? 0) * f;
    }
    case FRESNEL:
      return profileAt(p, s.u * fresnelRange(p));
    default:
      return intensity1D(s.u * sinRange(p), p);
  }
}

function initialGrid(p: Params): number[] {
  const shapes: (Shape | "vazia")[] = ["quadrado", "circulo", "fenda", "duas", "rede", "triangulo", "vazia"];
  const sh = shapes[Math.round(num(p, "forma"))] ?? "quadrado";
  return sh === "vazia" ? new Array<number>(G * G).fill(0) : presetAperture(sh);
}

// ---------- layout ----------
const GR = { x0: 1.2, x1: 19.2, y0: 0.3, y1: 5.4 };
const ST = { y0: -2.7, y1: -0.9 };
const ZM = { x0: 1.2, x1: 19.2, y0: -6.1, y1: -3.9 };
const IMG = { x0: 0.6, x1: 9.2, y0: -4.9, y1: 3.7 };
const PAT = { x0: 10.6, x1: 19.2, y0: -4.9, y1: 3.7 };
const PROF = { x0: 11.2, x1: 19.4, y0: -2.6, y1: 2.6 };
const FP = { x0: 10.8, x1: 19.4, y0: -4.2, y1: 3.6 };

const fmt = (v: number, digits = 3) => Number(v.toPrecision(digits)).toString().replace(".", ",").replace("-", "−");

function paint(s: DifState, p: Params, x: number, y: number): DifState | undefined {
  if (x < IMG.x0 || x > IMG.x1 || y < IMG.y0 || y > IMG.y1) return undefined;
  const cw = (IMG.x1 - IMG.x0) / G;
  const ci = (x - IMG.x0) / cw;
  const cj = (y - IMG.y0) / cw;
  const r = Math.max(0.5, num(p, "pincel", 2));
  const grid = s.grid.slice();
  let changed = false;
  const v = s.tool === "pincel" ? 1 : 0;
  for (let j = Math.floor(cj - r); j <= Math.ceil(cj + r); j++)
    for (let i = Math.floor(ci - r); i <= Math.ceil(ci + r); i++) {
      if (i < 0 || j < 0 || i >= G || j >= G) continue;
      if ((i + 0.5 - ci) ** 2 + (j + 0.5 - cj) ** 2 > r * r) continue;
      if (grid[j * G + i] !== v) {
        grid[j * G + i] = v;
        changed = true;
      }
    }
  return changed ? { ...s, grid } : s;
}

function detectorFromPoint(s: DifState, p: Params, x: number, y: number): DifState | undefined {
  const m = mode(p);
  if (m === FENDA || m === REDE) {
    if (y < ST.y0 - 0.2 || y > GR.y1 || x < GR.x0 || x > GR.x1) return undefined;
    return { ...s, u: clamp((x - (GR.x0 + GR.x1) / 2) / ((GR.x1 - GR.x0) / 2), -1, 1) };
  }
  if (m === RAYLEIGH && x >= PROF.x0 && x <= PROF.x1 && y > PROF.y0 - 0.5 && y < PROF.y1 + 1)
    return { ...s, u: clamp((x - (PROF.x0 + PROF.x1) / 2) / ((PROF.x1 - PROF.x0) / 2), -1, 1) };
  if (m === FRESNEL && x >= FP.x0 && x <= FP.x1 && y >= FP.y0 - 0.6 && y <= FP.y1)
    return { ...s, u: clamp((x - (FP.x0 + FP.x1) / 2) / ((FP.x1 - FP.x0) / 2), -1, 1) };
  if (m === DESENHO && x >= PAT.x0 && x <= PAT.x1 && y >= PAT.y0 && y <= PAT.y1)
    return { ...s, u: clamp((x - (PAT.x0 + PAT.x1) / 2) / ((PAT.x1 - PAT.x0) / 2), -1, 1) };
  return undefined;
}

export const difracao = defineSim<DifState>({
  id: "difracao",
  title: "Fenda simples, rede de difração e resolução (Rayleigh)",
  course: "FG IV",
  topic: "Difração",
  priority: "P1",
  summary:
    "Difração de Fraunhofer por uma fenda, por uma rede de N fendas e por uma abertura circular (critério de Rayleigh). Pinte qualquer abertura e veja seu padrão calculado por FFT 2D.",
  equations: [
    String.raw`\text{fenda: } I = I_0\left(\frac{\text{sen}\,\beta}{\beta}\right)^2,\ \beta = \frac{\pi a\,\text{sen}\,\theta}{\lambda};\quad \text{mínimos: } a\,\text{sen}\,\theta = p\lambda`,
    String.raw`\text{rede: } I = I_0\left(\frac{\text{sen}\,\beta}{\beta}\right)^2\left(\frac{\text{sen}\,N\gamma}{N\,\text{sen}\,\gamma}\right)^2,\ \gamma = \frac{\pi d\,\text{sen}\,\theta}{\lambda};\quad d\,\text{sen}\,\theta = m\lambda;\quad R = \frac{\lambda}{\Delta\lambda} = mN`,
    String.raw`\text{abertura circular: } I = I_0\left[\frac{2J_1(x)}{x}\right]^2,\ x = \frac{\pi D\,\text{sen}\,\theta}{\lambda};\quad \theta_R = 1{,}22\,\frac{\lambda}{D}`,
    String.raw`\text{Fraunhofer: } U(\theta_x, \theta_y) \propto \iint A(x,y)\,e^{-ik(x\,\text{sen}\,\theta_x + y\,\text{sen}\,\theta_y)}\,dx\,dy \;\Rightarrow\; I \propto |\text{FFT}\{A\}|^2`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    const th = detectorTheta(s, p);
    const out = [String.raw`\theta = ${texNum(th * 1e3)}\ \text{mrad},\quad I/I_0 = ${texNum(detectorI(s, p), 3)}`];
    if (m === FENDA)
      out.push(String.raw`\text{sen}\,\theta_1 = \frac{\lambda}{a} = \frac{${texNum(lam(p))}\times 10^{-9}}{${texNum(num(p, "a", 40))}\times 10^{-6}} = ${texNum((lam(p) * 1e-3) / num(p, "a", 40))}`);
    if (m === REDE) {
      out.push(String.raw`\text{sen}\,\theta_1 = \frac{\lambda}{d} = ${texNum((lam(p) * 1e-3) / dUm(p))},\quad m_{\max} = ${maxOrder(dUm(p), lam(p))},\quad R_1 = N = ${nSlits(p)}`);
      if (fonte(p) === 2) out.push(String.raw`\text{dubleto do sódio: } \frac{\lambda}{\Delta\lambda} = \frac{589{,}3}{0{,}6} \approx 982 \Rightarrow mN \ge 982`);
    }
    if (m === RAYLEIGH) {
      const thR = rayleighAngle(num(p, "D", 2), lam(p));
      out.push(String.raw`\theta_R = 1{,}22\frac{\lambda}{D} = ${texNum(thR * 1e6)}\ \mu\text{rad},\quad \frac{\alpha}{\theta_R} = ${texNum((num(p, "alpha", 400) * 1e-6) / thR)}`);
    }
    if (m === FRESNEL) {
      const NF = fresnelNumber(aF(p), zF(p), lam(p));
      out.push(
        String.raw`N_F = \frac{a^2}{\lambda z} = \frac{(${texNum(aF(p))}\ \text{mm})^2}{(${texNum(lam(p))}\ \text{nm})(${texNum(zF(p))}\ \text{m})} = ${texNum(NF)}`,
        disco(p)
          ? String.raw`\text{disco: } I(0) = I_{\text{livre}} \ \text{(mancha de Arago)},\quad \text{diâmetro da mancha} \approx 0{,}77\frac{\lambda z}{a} = ${texNum((0.77 * lam(p) * 1e-6 * zF(p) * 1e3) / aF(p))}\ \text{mm}`
          : String.raw`\text{furo: } I(0) = 4\,\text{sen}^2\!\left(\frac{\pi N_F}{2}\right) = ${texNum(4 * Math.sin((Math.PI * NF) / 2) ** 2, 3)}\ \text{(escuro para } N_F \text{ par)}`,
      );
    }
    if (m === FENDA && Math.round(num(p, "fasores")) === 1) {
      const beta = (Math.PI * num(p, "a", 40) * 1e-6 * Math.sin(th)) / (lam(p) * 1e-9);
      out.push(String.raw`\beta = \frac{\pi a\,\text{sen}\,\theta}{\lambda} = ${texNum(beta)}\ \text{rad},\quad \phi_{\text{total}} = 2\beta,\quad \frac{E_\theta}{E_m} = \frac{\text{sen}\,\beta}{\beta} = ${texNum(Math.abs(beta) < 1e-9 ? 1 : Math.sin(beta) / beta, 3)}`);
    }
    if (m === DESENHO) out.push(String.raw`\text{célula} = ${texNum(CELL_M * 1e6)}\ \mu\text{m},\quad \theta_{\text{borda}} = \frac{\lambda}{2\Delta} = ${texNum(fftRange(p) * 1e3)}\ \text{mrad}`);
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: FENDA,
      options: [
        { value: FENDA, label: "Fenda simples" },
        { value: REDE, label: "Rede de difração (N fendas)" },
        { value: RAYLEIGH, label: "Duas fontes e critério de Rayleigh" },
        { value: DESENHO, label: "Abertura desenhada (FFT 2D)" },
        { value: FRESNEL, label: "Disco ou furo circular de perto (Fresnel)" },
      ],
    },
    {
      key: "fonte",
      label: "Fonte (fenda e rede)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Laser (λ)" },
        { value: 1, label: "Luz branca" },
        { value: 2, label: "Lâmpada de sódio (589,0 e 589,6 nm)" },
      ],
    },
    { key: "lambda", label: "Comprimento de onda λ", unit: "nm", min: 400, max: 700, step: 1, default: 633, live: true },
    { key: "a", label: "Largura da fenda a", unit: "µm", min: 2, max: 200, step: 1, default: 40, live: true },
    { key: "N", label: "Número de fendas da rede N", unit: "", min: 2, max: 5000, step: 1, default: 8, log: true, live: true },
    { key: "d", label: "Período da rede d", unit: "µm", min: 1, max: 50, step: 0.1, default: 5, live: true },
    { key: "D", label: "Diâmetro da abertura D", unit: "mm", min: 0.5, max: 20, step: 0.1, default: 2, live: true },
    { key: "alpha", label: "Separação angular das fontes α", unit: "µrad", min: 20, max: 2000, step: 5, default: 400, live: true },
    {
      key: "forma",
      label: "Abertura inicial (desenho)",
      unit: "",
      min: 0,
      max: 6,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Quadrado" },
        { value: 1, label: "Círculo" },
        { value: 2, label: "Fenda" },
        { value: 3, label: "Duas fendas" },
        { value: 4, label: "Rede de fendas" },
        { value: 5, label: "Triângulo" },
        { value: 6, label: "Vazia (desenhe)" },
      ],
    },
    { key: "pincel", label: "Raio do pincel", unit: "células", min: 0.5, max: 6, step: 0.5, default: 1.5, live: true },
    { key: "dec", label: "Faixa da escala log", unit: "décadas", min: 1, max: 8, step: 0.5, default: 4, live: true },
    {
      key: "fasores",
      label: "Cadeia de fasores (fenda)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Ocultar" },
        { value: 1, label: "Mostrar no ângulo do detector" },
      ],
    },
    {
      key: "objF",
      label: "Obstáculo (Fresnel)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Disco opaco" },
        { value: 1, label: "Furo circular num anteparo" },
      ],
    },
    { key: "aF", label: "Raio do disco/furo a (Fresnel)", unit: "mm", min: 0.2, max: 3, step: 0.05, default: 1, live: true },
    { key: "zF", label: "Distância até a tela z (Fresnel)", unit: "m", min: 0.1, max: 5, step: 0.05, default: 1, live: true },
  ],

  observables: [
    { key: "theta", label: "Ângulo do detector θ", unit: "mrad", value: (s, p) => detectorTheta(s, p) * 1e3 },
    { key: "I", label: "Intensidade relativa I/I₀", unit: "", value: (s, p) => detectorI(s, p) },
    { key: "th1", label: "1º mínimo da fenda (λ/a)", unit: "mrad", value: (_s, p) => Math.asin(Math.min(1, (lam(p) * 1e-3) / num(p, "a", 40))) * 1e3 },
    { key: "ord1", label: "Ângulo da 1ª ordem da rede", unit: "°", value: (_s, p) => (Math.asin(Math.min(1, (lam(p) * 1e-3) / dUm(p))) * 180) / Math.PI },
    { key: "thR", label: "Limite de Rayleigh θ_R", unit: "µrad", value: (_s, p) => rayleighAngle(num(p, "D", 2), lam(p)) * 1e6 },
    { key: "ratio", label: "α / θ_R", unit: "", value: (_s, p) => (num(p, "alpha", 400) * 1e-6) / rayleighAngle(num(p, "D", 2), lam(p)) },
    { key: "abertas", label: "Células abertas na abertura", unit: "", value: (s) => s.grid.reduce((a, b) => a + b, 0) },
    { key: "rF", label: "Posição do detector na tela (Fresnel)", unit: "mm", value: (s, p) => (mode(p) === FRESNEL ? s.u * fresnelRange(p) : 0) },
    { key: "NF", label: "Número de Fresnel a²/(λz)", unit: "", value: (_s, p) => fresnelNumber(aF(p), zF(p), lam(p)) },
  ],
  chart: { x: "theta", y: "I" },

  scenarios: [
    {
      id: "fenda",
      label: "Fenda simples",
      params: { modo: FENDA, fonte: 0, lambda: 633, a: 40 },
      guide: `### Quanto mais estreita, mais larga
1. Rode: o detector varre o padrão e o gráfico monta $I(\\theta)$.
2. Leia o ângulo do 1º mínimo e confira $\\text{sen}\\,\\theta_1 = \\lambda/a$.
3. Diminua $a$ ao vivo e veja o máximo central alargar. Depois aumente λ.
4. Troque para luz branca: por que as bordas do máximo central ficam avermelhadas?`,
      predict: [
        {
          question: "Se a largura da fenda cair pela metade, a largura angular do máximo central:",
          options: ["cai pela metade", "dobra", "não muda", "quadruplica"],
          answer: 1,
          explanation: "Os mínimos estão em $\\text{sen}\\,\\theta = \\lambda/a$: com $a$ menor, o primeiro mínimo vai para um ângulo maior (o dobro, para ângulos pequenos).",
        },
      ],
    },
    {
      id: "rede",
      label: "Rede e o dubleto do sódio",
      params: { modo: REDE, fonte: 2, d: 5, N: 200 },
      guide: `### Picos finos e poder de resolução
1. Os máximos principais estão em $d\\,\\text{sen}\\,\\theta = m\\lambda$, não importa $N$. Mude $N$ e veja os picos afinarem (largura ∝ $1/N$).
2. A lâmpada de sódio emite 589,0 e 589,6 nm. O painel de baixo amplia a ordem 1.
3. Com $N$ = 200 as duas linhas se confundem. Qual o menor $N$ que as separa? Compare com $R = mN \\ge \\lambda/\\Delta\\lambda \\approx 982$.
4. Troque para **luz branca**: cada ordem vira um espectro, com o violeta mais perto do centro.`,
      predict: [
        {
          question: "Ao aumentar o número de fendas N (mesmo d), os máximos principais:",
          options: ["mudam de posição", "ficam mais estreitos e no mesmo lugar", "ficam mais largos", "desaparecem"],
          answer: 1,
          explanation: "A posição depende só de $d$ e λ ($d\\,\\text{sen}\\,\\theta = m\\lambda$). A largura de cada pico é $\\sim\\lambda/(Nd)$: mais fendas, picos mais finos e maior poder de resolução.",
        },
      ],
    },
    {
      id: "rayleigh",
      label: "Critério de Rayleigh",
      params: { modo: RAYLEIGH, lambda: 550, D: 2, alpha: 336 },
      guide: `### Duas estrelas
1. Duas fontes pontuais incoerentes vistas por uma abertura circular de diâmetro $D$ formam dois discos de Airy.
2. Aqui $\\alpha \\approx \\theta_R = 1{,}22\\lambda/D$: o máximo de uma imagem cai sobre o 1º mínimo da outra. O vale entre os picos vale ≈ 73% do pico.
3. Diminua α: as imagens se fundem. Aumente $D$ (telescópio maior) e veja voltarem a se separar.
4. Por que telescópios observando no azul resolvem melhor?`,
      predict: [
        {
          question: "Dobrar o diâmetro D do telescópio faz o menor ângulo resolvível:",
          options: ["dobrar", "cair pela metade", "não mudar", "cair para um quarto"],
          answer: 1,
          explanation: "$\\theta_R = 1{,}22\\lambda/D$: com o dobro do diâmetro, o limite cai pela metade.",
        },
      ],
    },
    {
      id: "desenho",
      label: "Desenhe a abertura (FFT 2D)",
      params: { modo: DESENHO, forma: 0, lambda: 633, dec: 4 },
      guide: `### Qualquer abertura
1. O padrão à direita é $|\\text{FFT}|^2$ da abertura (escala logarítmica), que é a difração de Fraunhofer.
2. Quadrado: cruz de franjas nas direções dos lados. Troque a abertura inicial para **Círculo** (anéis de Airy) e **Fenda**.
3. Pinte e apague com o mouse (botões Pincel/Borracha). Estreite a abertura numa direção: o padrão **alarga** nessa direção.
4. Desenhe duas fendas: aparecem franjas de interferência dentro da envoltória de uma fenda.`,
    },
    {
      id: "fasores",
      label: "Fenda simples: a cadeia de fasores",
      params: { modo: FENDA, fonte: 0, lambda: 633, a: 40, fasores: 1 },
      guide: `### Somando as ondas de cada faixa da fenda
1. Divida a fenda em $N$ faixas estreitas. Cada uma manda para a tela uma onda de mesma amplitude, representada por um **fasor** (seta). Entre faixas vizinhas a diferença de caminho dá uma defasagem $\\Delta\\phi$; de uma borda à outra, a defasagem total é
$$\\phi = \\frac{2\\pi}{\\lambda}\\,a\\,\\text{sen}\\,\\theta = 2\\beta$$
2. Rode: o detector varre a tela e, embaixo, a cadeia de fasores vai se curvando. No centro ($\\theta = 0$) as setas ficam em linha reta e a resultante é máxima ($E_m$).
3. Pare o detector (arraste-o) no 1º mínimo: a cadeia fecha um **círculo** ($2\\beta = 2\\pi$) e a resultante é zero. No 1º máximo secundário ela dá cerca de uma volta e meia.
4. A resultante é a corda de um arco de comprimento $E_m$ e ângulo $2\\beta$:
$$E_\\theta = E_m\\frac{\\text{sen}\\,\\beta}{\\beta} \\quad\\Rightarrow\\quad I = I_m\\left(\\frac{\\text{sen}\\,\\beta}{\\beta}\\right)^2$$
5. Compare a razão mostrada com o gráfico $I(\\theta)$: são a mesma coisa.`,
      predict: [
        {
          question: "No primeiro mínimo da fenda simples, a cadeia de fasores:",
          options: ["fica reta", "forma meia volta", "fecha uma volta completa", "fecha duas voltas"],
          answer: 2,
          explanation: "A defasagem entre as bordas é $2\\pi$: o último fasor aponta como o primeiro, a cadeia fecha um círculo e a resultante é nula.",
        },
      ],
    },
    {
      id: "arago",
      label: "Mancha clara de Fresnel (Arago)",
      params: { modo: FRESNEL, lambda: 633, objF: 0, aF: 1, zF: 1 },
      guide: `### Um ponto claro no meio da sombra
1. Um disco opaco de raio $a = 1\\ \\text{mm}$ está a $z = 1\\ \\text{m}$ da tela, iluminado por uma onda plana. A ótica geométrica prevê sombra completa para $r < a$ (tracejado).
2. Aqui a tela está perto: o número de Fresnel $N_F = a^2/(\\lambda z) \\approx 1{,}6$ não é pequeno, e a difração é de **Fresnel** (campo próximo), não de Fraunhofer. O campo é calculado pela integral de Fresnel sobre a parte livre da frente de onda.
3. No centro da sombra aparece uma mancha clara com a **mesma intensidade** da luz sem obstáculo. Por simetria, as ondas que contornam a borda do disco chegam ao eixo todas em fase. Poisson usou esse resultado para tentar refutar a teoria ondulatória de Fresnel; Arago fez o experimento e viu a mancha (1818).
4. Afaste a tela ($z$ maior): a mancha alarga, $\\approx 0{,}77\\lambda z/a$. Aumente $a$: ela fica mais fina, mas não some.
5. Troque para **furo circular**: agora o centro alterna entre claro e escuro conforme $N_F$ (escuro quando $N_F$ é par: o furo deixa passar um número par de zonas de Fresnel).`,
      predict: [
        {
          question: "No centro da sombra de um disco opaco, a intensidade da luz é:",
          options: ["zero, é sombra", "um pouco maior que zero", "igual à da luz sem o disco", "o dobro da luz sem o disco"],
          answer: 2,
          explanation: "A integral de Fresnel sobre a frente de onda fora do disco dá, no eixo, $|U|^2 = 1$: a mancha de Arago tem a intensidade da onda livre, qualquer que seja o raio do disco (na aproximação de Fresnel).",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "central",
      prompt:
        "Luz de {lambda} nm passa por uma fenda de largura {a} µm e incide numa tela a {L} m. Qual é a largura do máximo central (distância entre os dois primeiros mínimos)?",
      vary: { lambda: [420, 680, 0], a: [20, 150, 0], L: [0.5, 3, 1] },
      fixed: { modo: FENDA },
      answer: {
        label: "w",
        unit: "mm",
        compute: (p) => 2 * num(p, "L") * Math.tan(Math.asin((num(p, "lambda") * 1e-3) / num(p, "a"))) * 1e3,
      },
      hint: "Os primeiros mínimos estão em sen θ = ±λ/a; na tela, y = L tg θ.",
    },
    {
      id: "rede",
      prompt: "Uma rede de difração tem {linhas} linhas por milímetro e é iluminada por luz de {lambda} nm. Em que ângulo aparece o máximo de 2ª ordem?",
      vary: { linhas: [200, 600, 0], lambda: [400, 650, 0] },
      fixed: { modo: REDE },
      answer: { label: "θ₂", unit: "°", compute: (p) => (Math.asin(2 * num(p, "lambda") * 1e-9 * num(p, "linhas") * 1e3) * 180) / Math.PI },
      hint: "d = 1/(linhas por metro) e d sen θ = mλ.",
    },
    {
      id: "rayleigh",
      prompt: "Qual é o menor ângulo que um telescópio de {D} cm de diâmetro consegue resolver com luz de {lambda} nm (critério de Rayleigh)?",
      vary: { D: [5, 100, 0], lambda: [400, 700, 0] },
      fixed: { modo: RAYLEIGH },
      answer: { label: "θ_R", unit: "µrad", compute: (p) => ((1.22 * num(p, "lambda") * 1e-9) / (num(p, "D") / 100)) * 1e6 },
    },
  ],

  init: (p) => ({ u: -1, grid: initialGrid(p), tool: "pincel" }),
  step: (s, _p, _t, dt) => ({ ...s, u: Math.min(1, s.u + (2 * dt) / T_SCAN) }),
  dt: 0.02,
  sampleEvery: 1,
  tEnd: T_SCAN,
  maxSamples: 4000,

  pointer: {
    down(s, p, pt) {
      if (mode(p) === DESENHO) {
        const r = paint(s, p, pt.x, pt.y);
        if (r) return r;
      }
      return detectorFromPoint(s, p, pt.x, pt.y);
    },
    move(s, p, pt, dragging) {
      if (!dragging) return undefined;
      if (mode(p) === DESENHO && pt.x <= IMG.x1 + 0.3) return paint(s, p, pt.x, pt.y);
      return detectorFromPoint(s, p, pt.x, pt.y);
    },
    cursor: (_s, p, pt) => {
      if (mode(p) === DESENHO && pt.x >= IMG.x0 && pt.x <= IMG.x1 && pt.y >= IMG.y0 && pt.y <= IMG.y1) return "crosshair";
      return undefined;
    },
  },
  actions: [
    { id: "pincel", label: "Pincel", run: (s) => ({ ...s, tool: "pincel" }), active: (s) => s.tool === "pincel" },
    { id: "borracha", label: "Borracha", run: (s) => ({ ...s, tool: "borracha" }), active: (s) => s.tool === "borracha" },
    { id: "limpar", label: "Limpar abertura", run: (s) => ({ ...s, grid: new Array<number>(G * G).fill(0) }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: -6.8, yMax: 6.2 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    switch (mode(p)) {
      case RAYLEIGH:
        return renderRayleigh(d, theme, s, p);
      case DESENHO:
        return renderDrawing(d, theme, s, p);
      case FRESNEL:
        return renderFresnel(d, theme, s, p);
      default:
        return renderLinear(d, theme, s, p);
    }
  },
});

// ---------- desenho ----------

/** Mapa de cores w×h (linha 0 embaixo) num retângulo do mundo; usa canvas fora da tela no navegador. */
let offscreen: HTMLCanvasElement | null = null;
function heatmap(d: Draw, w: number, h: number, x0: number, y0: number, W: number, H: number, color: (i: number, j: number) => RGB) {
  if (typeof document !== "undefined") {
    offscreen ??= document.createElement("canvas");
    offscreen.width = w;
    offscreen.height = h;
    const octx = offscreen.getContext("2d");
    if (octx) {
      const img = octx.createImageData(w, h);
      for (let j = 0; j < h; j++)
        for (let i = 0; i < w; i++) {
          const c = color(i, j);
          const o = 4 * (i + w * j);
          const g = (v: number) => Math.round(255 * clamp(v, 0, 1) ** 0.6);
          img.data[o] = g(c[0]);
          img.data[o + 1] = g(c[1]);
          img.data[o + 2] = g(c[2]);
          img.data[o + 3] = 255;
        }
      octx.putImageData(img, 0, 0);
      d.ctx.imageSmoothingEnabled = false;
      d.ctx.drawImage(offscreen, x0, y0, W, H);
      return;
    }
  }
  // Sem DOM (testes): blocos grossos
  const step = Math.max(1, Math.round(w / 32));
  for (let j = 0; j < h; j += step)
    for (let i = 0; i < w; i += step) d.rect(x0 + (i * W) / w, y0 + (j * H) / h, (step * W) / w, (step * H) / h, { fill: cssRGB(color(i, j)) });
}

function stripColor(sinT: number, p: Params): RGB {
  const f = fonte(p);
  if (f === 0) return monoColor(lam(p), intensity1D(sinT, p));
  if (f === 2) return monoColor(589.3, intensity1D(sinT, p));
  // Luz branca
  if (mode(p) === FENDA || nSlits(p) <= 60) return spectrumColor((nm) => (mode(p) === REDE ? grating(sinT, nSlits(p), dUm(p), gratingSlit(p), nm) : singleSlit(sinT, num(p, "a", 40), nm)));
  // Rede com muitas fendas: cada ordem m ≠ 0 leva o ângulo a um único λ = d sen θ / m
  const acc: RGB = [0, 0, 0];
  if (Math.abs(sinT) < (550e-9 / (nSlits(p) * dUm(p) * 1e-6))) return [1, 1, 1];
  for (let m = 1; m <= 60; m++) {
    const nm = (dUm(p) * 1e3 * Math.abs(sinT)) / m;
    if (nm < 400) break;
    if (nm > 700) continue;
    const c = wavelengthRGB(nm);
    const e = singleSlit(sinT, gratingSlit(p), nm);
    acc[0] += c[0] * e;
    acc[1] += c[1] * e;
    acc[2] += c[2] * e;
  }
  return acc;
}

function renderLinear(d: Draw, theme: Theme, s: DifState, p: Params) {
  const sMax = sinRange(p);
  const X = (sn: number) => (GR.x0 + GR.x1) / 2 + ((GR.x1 - GR.x0) / 2) * (sn / sMax);
  const Y = (I: number) => GR.y0 + (GR.y1 - GR.y0) * clamp(I, 0, 1.05);
  const isRede = mode(p) === REDE;
  // Eixos e marcas em graus
  d.line(GR.x0, GR.y0, GR.x1, GR.y0, { color: theme.muted, width: 1 });
  d.line(GR.x0, GR.y0, GR.x0, GR.y1, { color: theme.muted, width: 1 });
  for (const f of [-1, -0.5, 0, 0.5, 1]) {
    const sn = f * sMax;
    d.line(X(sn), GR.y0, X(sn), GR.y0 - 0.15, { color: theme.muted, width: 1 });
    d.text(`${fmt((Math.asin(sn) * 180) / Math.PI, 3)}°`, X(sn), GR.y0 - 0.45, { color: theme.muted, size: 10 });
  }
  for (const I of [0.5, 1]) {
    d.line(GR.x0, Y(I), GR.x1, Y(I), { color: theme.grid, width: 1 });
    d.text(`${I}`.replace(".", ","), GR.x0 - 0.15, Y(I), { color: theme.muted, size: 10, align: "right" });
  }
  d.text("I/I₀", GR.x0, GR.y1 + 0.35, { color: theme.muted, size: 10 });
  d.text("θ", GR.x1 + 0.3, GR.y0 + 0.2, { color: theme.muted, size: 11 });

  // Curva
  const n = 1600;
  const pts: [number, number][] = [];
  for (let i = 0; i <= n; i++) {
    const sn = -sMax + (2 * sMax * i) / n;
    pts.push([X(sn), Y(intensity1D(sn, p))]);
  }
  const curveColor = fonte(p) === 1 ? theme.text : theme.series[0]!;
  // Rede: o fator de uma fenda como envoltória tracejada e os máximos principais como hastes (não somem com N grande)
  if (isRede) {
    const l = fonte(p) === 2 ? 589.3 : fonte(p) === 1 ? 550 : lam(p);
    d.plot((x) => Y(singleSlit(((x - (GR.x0 + GR.x1) / 2) / ((GR.x1 - GR.x0) / 2)) * sMax, gratingSlit(p), l)), GR.x0, GR.x1, {
      color: theme.muted,
      width: 1,
      dash: [5, 4],
    });
    if (fonte(p) !== 1) {
      const M = maxOrder(dUm(p), l);
      for (let m = -M; m <= M; m++) {
        const sn = (m * l * 1e-3) / dUm(p);
        if (Math.abs(sn) > sMax) continue;
        d.line(X(sn), GR.y0, X(sn), Y(singleSlit(sn, gratingSlit(p), l)), { color: curveColor, width: 1.5 });
        d.text(`m = ${m}`.replace("-", "−"), X(sn), Y(singleSlit(sn, gratingSlit(p), l)) + 0.3, { color: theme.muted, size: 10 });
      }
    }
  }
  d.polyline(pts, { color: curveColor, width: 1.6 });

  // Tela (faixa colorida)
  d.rect(GR.x0, ST.y0, GR.x1 - GR.x0, ST.y1 - ST.y0, { fill: "#000" });
  const ns = 420;
  const w = (GR.x1 - GR.x0) / ns;
  for (let i = 0; i < ns; i++) {
    const sn = -sMax + (2 * sMax * (i + 0.5)) / ns;
    d.rect(GR.x0 + i * w, ST.y0, w * 1.05, ST.y1 - ST.y0, { fill: cssRGB(stripColor(sn, p)) });
  }
  if (isRede && fonte(p) === 0) {
    const M = maxOrder(dUm(p), lam(p));
    for (let m = -M; m <= M; m++) {
      const sn = (m * lam(p) * 1e-3) / dUm(p);
      if (Math.abs(sn) <= sMax) d.line(X(sn), ST.y0, X(sn), ST.y1, { color: cssRGB(monoColor(lam(p), singleSlit(sn, gratingSlit(p), lam(p)))), width: 2 });
    }
  }
  d.rect(GR.x0, ST.y0, GR.x1 - GR.x0, ST.y1 - ST.y0, { stroke: theme.muted, width: 1 });
  d.text("tela", GR.x0, ST.y1 + 0.3, { color: theme.muted, size: 10, align: "left" });

  // Detector
  const xs = X(s.u * sMax);
  d.line(xs, ST.y0, xs, GR.y1, { color: theme.accent, width: 1.2, dash: [4, 3] });
  d.dot(xs, Y(detectorI(s, p)), 5, theme.accent);
  d.arrowPx(xs, ST.y0 - 0.7, 0, 1, 18, { color: theme.accent });

  // Legenda / painel de zoom
  const info = isRede
    ? `N = ${nSlits(p)} fendas · d = ${fmt(dUm(p))} µm · largura das fendas 0,3d · tracejado: envoltória de uma fenda`
    : `fenda a = ${fmt(num(p, "a", 40))} µm · 1º mínimo em sen θ = λ/a`;
  d.text(info, GR.x0, 5.95, { color: theme.muted, size: 11, align: "left" });

  if (!isRede && Math.round(num(p, "fasores")) === 1) renderPhasors(d, theme, s, p);
  else if (isRede && fonte(p) === 2 && maxOrder(dUm(p), 589.6) >= 1) renderZoom(d, theme, p);
  else if (fonte(p) === 1) d.text("Luz branca: cada ordem m ≠ 0 se abre num espectro (violeta mais perto do centro).", GR.x0, -3.6, { color: theme.muted, size: 11, align: "left" });
}

/** Cadeia de fasores das N faixas da fenda no ângulo do detector. */
function renderPhasors(d: Draw, theme: Theme, s: DifState, p: Params) {
  const l = fonte(p) === 2 ? 589.3 : fonte(p) === 1 ? 550 : lam(p);
  const sinT = s.u * sinRange(p);
  const beta = (Math.PI * num(p, "a", 40) * 1e-6 * sinT) / (l * 1e-9);
  const N = 24;
  const chain = phasorChain(beta, N);
  const L = 7; // comprimento do arco (unidades do palco) = E_m
  const ox = 2;
  const oy = -5.2;
  // centraliza a cadeia verticalmente
  let ymin = 0;
  let ymax = 0;
  for (const [, y] of chain) {
    ymin = Math.min(ymin, y);
    ymax = Math.max(ymax, y);
  }
  const k = Math.min(L, 2.6 / Math.max(ymax - ymin, 1e-9));
  const yc = oy - ((ymin + ymax) / 2) * k;
  d.line(ox, oy - 1.4, ox, oy + 1.4, { color: theme.grid, width: 1 });
  for (let i = 0; i < N; i++) {
    const [x0, y0] = chain[i]!;
    const [x1, y1] = chain[i + 1]!;
    d.arrow(ox + x0 * k, yc + y0 * k, (x1 - x0) * k, (y1 - y0) * k, { color: theme.series[0]!, width: 1.6, head: 5 });
  }
  const [ex, ey] = chain[N]!;
  d.arrow(ox, yc, ex * k, ey * k, { color: theme.accent, width: 3, head: 9 });
  const ratio = Math.hypot(ex, ey);
  d.text(`${N} fasores (faixas da fenda), defasagem total 2β = ${fmt((2 * beta * 180) / Math.PI, 3)}°`, 10.2, -4.2, { color: theme.text, size: 11, align: "left" });
  d.text(`resultante E_θ/E_m = |sen β/β| = ${fmt(ratio, 3)} → I/I₀ = ${fmt(ratio * ratio, 3)}`, 10.2, -4.9, { color: theme.accent, size: 11, align: "left", weight: "600" });
  d.text("no 1º mínimo a cadeia fecha um círculo (2β = 360°)", 10.2, -5.6, { color: theme.muted, size: 10, align: "left" });
  if (k < L) d.text(`(escala ${fmt(k / L, 2)}×)`, 10.2, -6.3, { color: theme.muted, size: 10, align: "left" });
}

/** Difração de Fresnel por disco ou furo: tela vista de frente e perfil radial. */
function renderFresnel(d: Draw, theme: Theme, s: DifState, p: Params) {
  const R = fresnelRange(p);
  const a = aF(p);
  const L = lam(p);
  const prof = fresnelProfile(p);
  let Imax = 0;
  for (const v of prof) Imax = Math.max(Imax, v);
  const Idisp = Math.max(1.6, Imax);
  // Tela de frente
  const C = { x: 5.2, y: -0.5, r: 4.6 };
  d.circle(C.x, C.y, C.r, { fill: "#000" });
  const n = 160;
  for (let i = n; i >= 1; i--) {
    const v = prof[Math.round(((i - 0.5) / n) * FN)]!;
    d.circle(C.x, C.y, (C.r * i) / n, { fill: cssRGB(monoColor(L, Math.min(1, v / Idisp) * 1.6)) });
  }
  d.circle(C.x, C.y, (C.r * a) / R, { stroke: theme.muted, width: 1, dash: [4, 4] });
  d.circle(C.x, C.y, C.r, { stroke: theme.muted, width: 1 });
  d.text(disco(p) ? "tela: tracejado = borda da sombra geométrica" : "tela: tracejado = borda do feixe geométrico", C.x, C.y + C.r + 0.45, { color: theme.muted, size: 11 });
  d.text(`${fmt(2 * R)} mm de lado a lado`, C.x, C.y - C.r - 0.45, { color: theme.muted, size: 10 });
  // Perfil
  const X = (r: number) => (FP.x0 + FP.x1) / 2 + ((FP.x1 - FP.x0) / 2) * (r / R);
  const Y = (I: number) => FP.y0 + (FP.y1 - FP.y0) * clamp(I / Idisp, 0, 1.02);
  d.line(FP.x0, FP.y0, FP.x1, FP.y0, { color: theme.muted, width: 1 });
  d.line(X(0), FP.y0, X(0), FP.y1, { color: theme.grid, width: 1 });
  d.line(FP.x0, Y(1), FP.x1, Y(1), { color: theme.muted, width: 1, dash: [5, 4] });
  d.text("sem obstáculo", FP.x1, Y(1) + 0.3, { color: theme.muted, size: 10, align: "right" });
  for (const sg of [-1, 1]) d.line(X(sg * a), FP.y0, X(sg * a), FP.y1, { color: theme.muted, width: 1, dash: [2, 3] });
  d.plot((x) => Y(profileAt(p, ((x - (FP.x0 + FP.x1) / 2) / ((FP.x1 - FP.x0) / 2)) * R)), FP.x0, FP.x1, { color: theme.series[0]!, width: 1.8, n: 600 });
  for (const f of [-1, -0.5, 0, 0.5, 1]) d.text(fmt(f * R, 2), X(f * R), FP.y0 - 0.45, { color: theme.muted, size: 10 });
  d.text("r (mm)", FP.x1, FP.y0 - 0.95, { color: theme.muted, size: 10, align: "right" });
  d.text("I/I_livre", FP.x0, FP.y1 + 0.35, { color: theme.muted, size: 10, align: "left" });
  const xs = X(s.u * R);
  d.line(xs, FP.y0, xs, FP.y1, { color: theme.accent, width: 1.2, dash: [4, 3] });
  d.dot(xs, Y(detectorI(s, p)), 5, theme.accent);
  d.text(
    `${disco(p) ? "disco opaco" : "furo circular"} de raio a = ${fmt(a)} mm · z = ${fmt(zF(p))} m · λ = ${fmt(L)} nm · N_F = ${fmt(fresnelNumber(a, zF(p), L))} · I no centro = ${fmt(prof[0]!, 3)}`,
    0.4,
    5.95,
    { color: theme.text, size: 11, align: "left" },
  );
}

function renderZoom(d: Draw, theme: Theme, p: Params) {
  const N = nSlits(p);
  const m = 1;
  const dm = dUm(p) * 1e-6;
  const s0 = (m * 589.3e-9) / dm;
  const ds = (m * 0.6e-9) / dm;
  const half = Math.max(2.5 * ds, (3 * 589.3e-9) / (N * dm));
  const X = (sn: number) => ZM.x0 + ((sn - (s0 - half)) / (2 * half)) * (ZM.x1 - ZM.x0);
  const Y = (I: number) => ZM.y0 + (ZM.y1 - ZM.y0) * clamp(I, 0, 1.05);
  d.rect(ZM.x0, ZM.y0, ZM.x1 - ZM.x0, ZM.y1 - ZM.y0, { stroke: theme.grid, width: 1 });
  for (const [k, l] of SODIUM.entries()) {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 500; i++) {
      const sn = s0 - half + (2 * half * i) / 500;
      pts.push([X(sn), Y(grating(sn, N, dUm(p), gratingSlit(p), l) / singleSlit(sn, gratingSlit(p), l))]);
    }
    d.polyline(pts, { color: theme.series[k + 1]!, width: 1, dash: [4, 3] });
  }
  const sum: [number, number][] = [];
  for (let i = 0; i <= 600; i++) {
    const sn = s0 - half + (2 * half * i) / 600;
    let I = 0;
    for (const l of SODIUM) I += grating(sn, N, dUm(p), gratingSlit(p), l) / singleSlit(sn, gratingSlit(p), l);
    sum.push([X(sn), Y(I / 2)]);
  }
  d.polyline(sum, { color: theme.text, width: 2 });
  const resolved = m * N >= 589.3 / 0.6;
  d.text(
    `zoom na ordem m = 1: R = mN = ${N} ${resolved ? "≥" : "<"} λ/Δλ ≈ 982 → ${resolved ? "linhas resolvidas" : "linhas não resolvidas"}`,
    ZM.x0,
    ZM.y1 + 0.3,
    { color: resolved ? theme.positive : theme.muted, size: 11, align: "left", weight: "600" },
  );
  d.text("589,0 nm", X((m * 589.0e-9) / dm), ZM.y0 - 0.3, { color: theme.series[1]!, size: 10 });
  d.text("589,6 nm", X((m * 589.6e-9) / dm), ZM.y0 - 0.55, { color: theme.series[2]!, size: 10 });
}

function renderRayleigh(d: Draw, theme: Theme, s: DifState, p: Params) {
  const D = num(p, "D", 2);
  const L = lam(p);
  const alpha = num(p, "alpha", 400) * 1e-6;
  const R = rayRange(p);
  const thR = rayleighAngle(D, L);
  const peak = Math.max(1, twoSources(alpha / 2, alpha, D, L));
  // Imagem 2D
  const n = 120;
  heatmap(d, n, n, IMG.x0, IMG.y0, IMG.x1 - IMG.x0, IMG.y1 - IMG.y0, (i, j) => {
    const tx = -R + (2 * R * (i + 0.5)) / n;
    const ty = -R + (2 * R * (j + 0.5)) / n;
    const I = (airy(Math.hypot(tx - alpha / 2, ty), D, L) + airy(Math.hypot(tx + alpha / 2, ty), D, L)) / peak;
    return monoColor(L, Math.sqrt(I));
  });
  d.rect(IMG.x0, IMG.y0, IMG.x1 - IMG.x0, IMG.y1 - IMG.y0, { stroke: theme.muted, width: 1 });
  const cx = (IMG.x0 + IMG.x1) / 2;
  const cy = (IMG.y0 + IMG.y1) / 2;
  const sc = (IMG.x1 - IMG.x0) / (2 * R);
  d.circle(cx + (alpha / 2) * sc, cy, thR * sc, { stroke: theme.muted, width: 1, dash: [3, 3] });
  d.text("imagem no foco (brilho ∝ √I) · círculo: raio θ_R", cx, IMG.y1 + 0.35, { color: theme.muted, size: 10 });
  d.line(cx + s.u * R * sc, cy - 0.25, cx + s.u * R * sc, cy + 0.25, { color: theme.accent, width: 2 });

  // Perfil
  const X = (th: number) => (PROF.x0 + PROF.x1) / 2 + (th / R) * ((PROF.x1 - PROF.x0) / 2);
  const Y = (I: number) => PROF.y0 + (PROF.y1 - PROF.y0) * clamp(I, 0, 1.05);
  d.line(PROF.x0, PROF.y0, PROF.x1, PROF.y0, { color: theme.muted, width: 1 });
  for (const sg of [-1, 1]) {
    d.plot((x) => Y(airy(((x - (PROF.x0 + PROF.x1) / 2) / ((PROF.x1 - PROF.x0) / 2)) * R - (sg * alpha) / 2, D, L) / peak), PROF.x0, PROF.x1, {
      color: theme.series[sg > 0 ? 1 : 2]!,
      width: 1.2,
      dash: [5, 4],
    });
  }
  d.plot((x) => Y(twoSources(((x - (PROF.x0 + PROF.x1) / 2) / ((PROF.x1 - PROF.x0) / 2)) * R, alpha, D, L) / peak), PROF.x0, PROF.x1, {
    color: theme.text,
    width: 2,
    n: 400,
  });
  for (const f of [-1, 0, 1]) d.text(`${fmt(f * R * 1e6)}`, X(f * R), PROF.y0 - 0.4, { color: theme.muted, size: 10 });
  d.text("θ (µrad)", PROF.x1, PROF.y0 - 0.85, { color: theme.muted, size: 10, align: "right" });
  d.dot(X(s.u * R), Y(detectorI(s, p)), 5, theme.accent);
  const ratio = alpha / thR;
  const resolved = ratio >= 1 - 1e-9;
  d.text(`θ_R = 1,22 λ/D = ${fmt(thR * 1e6)} µrad · α = ${fmt(alpha * 1e6)} µrad · α/θ_R = ${fmt(ratio)}`, PROF.x0, PROF.y1 + 1.2, {
    color: theme.text,
    size: 11,
    align: "left",
  });
  d.text(
    `${resolved ? "Resolvidas pelo critério de Rayleigh" : "Não resolvidas (α < θ_R)"} · vale/pico = ${fmt(dipRatio(alpha, D, L), 2)}`,
    PROF.x0,
    PROF.y1 + 0.6,
    { color: resolved ? theme.positive : theme.muted, size: 11, align: "left", weight: "600" },
  );
  d.text(`abertura circular D = ${fmt(D)} mm, λ = ${fmt(L)} nm`, IMG.x0, -6.3, { color: theme.muted, size: 11, align: "left" });
}

function renderDrawing(d: Draw, theme: Theme, s: DifState, p: Params) {
  const cw = (IMG.x1 - IMG.x0) / G;
  // Abertura: fundo escuro, células abertas claras (trechos contínuos por linha)
  d.rect(IMG.x0, IMG.y0, IMG.x1 - IMG.x0, IMG.y1 - IMG.y0, { fill: theme.dark ? "#05070a" : "#1c2430" });
  for (let j = 0; j < G; j++) {
    let i = 0;
    while (i < G) {
      if (!s.grid[j * G + i]) {
        i++;
        continue;
      }
      const i0 = i;
      while (i < G && s.grid[j * G + i]) i++;
      d.rect(IMG.x0 + i0 * cw, IMG.y0 + j * cw, (i - i0) * cw, cw * 1.02, { fill: "#f4f1e6" });
    }
  }
  d.rect(IMG.x0, IMG.y0, IMG.x1 - IMG.x0, IMG.y1 - IMG.y0, { stroke: theme.muted, width: 1 });
  d.text(`abertura ${G}×${G} (lado ${fmt(APERTURE_MM)} mm): ${s.tool === "pincel" ? "pinte" : "apague"} com o mouse`, IMG.x0, IMG.y1 + 0.4, {
    color: theme.accent,
    size: 11,
    align: "left",
    weight: "600",
  });

  // Padrão |FFT|² em escala log
  const img = patternOf(s.grid);
  const dec = num(p, "dec", 4);
  const L = lam(p);
  heatmap(d, F, F, PAT.x0, PAT.y0, PAT.x1 - PAT.x0, PAT.y1 - PAT.y0, (i, j) => {
    const v = img[j * F + i] ?? 0;
    return monoColor(L, v > 0 ? clamp(1 + Math.log10(v) / dec, 0, 1) : 0);
  });
  d.rect(PAT.x0, PAT.y0, PAT.x1 - PAT.x0, PAT.y1 - PAT.y0, { stroke: theme.muted, width: 1 });
  d.text(`padrão de Fraunhofer |FFT|², escala log (${fmt(dec)} décadas)`, PAT.x0, PAT.y1 + 0.4, { color: theme.muted, size: 11, align: "left" });
  const th = fftRange(p) * 1e3;
  d.text(`−${fmt(th)}`, PAT.x0, PAT.y0 - 0.35, { color: theme.muted, size: 10 });
  d.text("0", (PAT.x0 + PAT.x1) / 2, PAT.y0 - 0.35, { color: theme.muted, size: 10 });
  d.text(`${fmt(th)} mrad`, PAT.x1, PAT.y0 - 0.35, { color: theme.muted, size: 10, align: "right" });
  // Detector na linha central
  const cy = PAT.y0 + ((F / 2 + 0.5) / F) * (PAT.y1 - PAT.y0);
  const xs = (PAT.x0 + PAT.x1) / 2 + s.u * ((PAT.x1 - PAT.x0) / 2);
  d.line(PAT.x0, cy, PAT.x1, cy, { color: theme.accent, width: 1, dash: [3, 4], alpha: 0.6 });
  d.circle(xs, cy, 0.14, { stroke: theme.accent, width: 2 });
  const open = s.grid.reduce((a, b) => a + b, 0);
  d.text(
    open ? `${open} células abertas · o detector varre a linha central (θ_y = 0)` : "Abertura vazia: pinte algo para ver o padrão.",
    IMG.x0,
    -6.3,
    { color: theme.muted, size: 11, align: "left" },
  );
}

export default difracao;
