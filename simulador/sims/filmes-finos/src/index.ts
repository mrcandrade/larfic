import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { cssRGB, monoColor, spectrumColor, wavelengthRGB, type RGB } from "./cores.ts";
import {
  GASES,
  N_GLASS,
  P_ATM,
  darkRingRadius,
  filmReflectance,
  filmRmax,
  fresnelR,
  fringesBetween,
  gasNm1,
  coherenceLength,
  michelsonIc,
  michelsonOPD,
  minBrightThickness,
  newtonGap,
  visibility,
} from "./fisica.ts";

export * from "./fisica.ts";
export * from "./cores.ts";

export const MICHELSON = 0;
export const CUNHA = 1;
export const BOLHA = 2;
export const NEWTON = 3;
export const AR = 4;

/** Comprimento real da cunha (mm) e tempo de drenagem da película (s). */
export const L_WEDGE = 50;
export const TAU_DRAIN = 20;

type Drag = "" | "espelho" | "cunha" | "sonda" | "lente";

export interface FilmesState {
  /** Deslocamento do espelho móvel (µm). */
  x: number;
  /** Pressão do gás na célula (kPa). */
  p: number;
  /** Referência da contagem de franjas: diferença de caminho (m), x (µm) e p (kPa) quando o contador foi zerado. */
  ref: { opd: number; x: number; p: number };
  /** Altura da lente acima da lâmina nos anéis de Newton (nm). */
  lift: number;
  /** Espessura máxima da cunha, na ponta do calço (µm). */
  wedge: number;
  /** Sonda: fração ao longo da cunha (0 = contato) ou da altura da película (0 = topo). */
  probe: number;
  drag: Drag;
  grab: { at: number; v: number };
}

const mode = (p: Params) => Math.round(num(p, "exp"));
const white = (p: Params) => Math.round(num(p, "luz")) === 1 && mode(p) !== MICHELSON;
const lam = (p: Params) => num(p, "lambda", 633);
const gas = (p: Params) => Math.round(num(p, "gas"));

// ---------- grandezas derivadas ----------

export const opdOf = (s: FilmesState, p: Params) => michelsonOPD(num(p, "d0", 0.5), s.x, gasNm1(gas(p), s.p), num(p, "Lc", 5));
export const fringeCount = (s: FilmesState, p: Params) => fringesBetween(s.ref.opd, opdOf(s, p), lam(p));

/** λ estimado a partir do deslocamento do espelho e das franjas contadas (nm). */
export function lambdaMeasured(s: FilmesState, p: Params): number {
  const N = fringeCount(s, p);
  return N > 0 ? (2 * Math.abs(s.x - s.ref.x) * 1e3) / N : 0;
}

/** (n − 1) do gás a 1 atm estimado pela contagem: N λ / (2 L_c) · p_atm / Δp. */
export function nm1Measured(s: FilmesState, p: Params): number {
  const N = fringeCount(s, p);
  const dp = Math.abs(s.p - s.ref.p);
  return N > 0 && dp > 0.5 ? ((N * lam(p) * 1e-9) / (2 * num(p, "Lc", 5) * 1e-2)) * (P_ATM / dp) : 0;
}

/** Índices (n₁, n₂, n₃) do sistema de camadas em cada experimento. */
export function indices(p: Params): [number, number, number] {
  const nf = num(p, "nf", 1.33);
  if (mode(p) === CUNHA) return [N_GLASS, 1, N_GLASS];
  if (mode(p) === NEWTON) return [N_GLASS, 1, N_GLASS];
  if (mode(p) === AR) return [1, nf, N_GLASS];
  return [1, nf, Math.round(num(p, "ns")) === 1 ? N_GLASS : 1];
}

/** Espessura da película de sabão (nm) na fração s da altura (0 = topo), drenando com o tempo. */
export const bubbleThickness = (sFrac: number, p: Params, t: number) => (num(p, "e0", 1500) * (0.03 + 0.97 * sFrac)) / (1 + t / TAU_DRAIN);

/** Espessura na sonda (nm); nos anéis de Newton, a espessura de ar no centro. */
export function probeThickness(s: FilmesState, p: Params, t: number): number {
  switch (mode(p)) {
    case CUNHA:
      return s.wedge * 1e3 * s.probe;
    case BOLHA:
      return bubbleThickness(s.probe, p, t);
    case NEWTON:
      return s.lift;
    case AR:
      return num(p, "eAR", 100);
    default:
      return 0;
  }
}

/** Intensidade relativa: centro dos anéis (Michelson) ou R/R_máx na sonda, para o λ do laser. */
export function intensity(s: FilmesState, p: Params, t: number): number {
  if (mode(p) === MICHELSON) {
    const opd = opdOf(s, p);
    return michelsonIc(opd, 0, 0, lam(p), num(p, "dlam", 0));
  }
  const [n1, n2, n3] = indices(p);
  return filmReflectance(n1, n2, n3, probeThickness(s, p, t), lam(p)) / filmRmax(n1, n2, n3);
}

/** Espaçamento das franjas ao longo da cunha de ar (mm): Δx = λ L / (2 e_máx). */
export const wedgeSpacing = (s: FilmesState, p: Params) => (lam(p) * 1e-9 * L_WEDGE) / (2 * s.wedge * 1e-6);

function filmColor(eNm: number, p: Params): RGB {
  const [n1, n2, n3] = indices(p);
  const Rm = filmRmax(n1, n2, n3);
  if (white(p)) return spectrumColor((nm) => filmReflectance(n1, n2, n3, eNm, nm) / Rm);
  return monoColor(lam(p), filmReflectance(n1, n2, n3, eNm, lam(p)) / Rm);
}

// ---------- layout (unidades arbitrárias do palco) ----------
const BS = { x: 6, y: 0 };
const M1X = (x: number) => 10.6 + clamp(x / 4, -2, 2.2);
const RING = { x: 16.6, y: -0.5, r: 3.1 };
const LENS = { x0: 1, x1: 9, plate: -2.6, k: 0.04, thick: 1 };
const liftVis = (nm: number) => Math.min(2.4, nm * 0.002);
const NR = { x: 14.8, y: 0, r: 4.6 };
const WEDGE = { x0: 1, x1: 19, base: 3, strip0: -5.2, strip1: 0.6 };
const wedgeH = (um: number) => 0.25 + um * 0.12;
const FILM = { x0: 3.5, x1: 10.5, y0: -5.5, y1: 5.5, g0: 12.8, g1: 19 };

export const filmesFinos = defineSim<FilmesState>({
  id: "filmes-finos",
  title: "Filmes finos, anéis de Newton e interferômetro de Michelson",
  course: "FG IV",
  topic: "Interferência",
  priority: "P1",
  summary:
    "Mova o espelho de um interferômetro de Michelson contando franjas para medir λ e o índice de um gás; veja as cores de películas de espessura variável e os anéis de Newton.",
  equations: [
    String.raw`\text{Michelson: } \Delta = 2(d_0 + x)\cos\theta + 2(n-1)L_c,\qquad \Delta x = N\frac{\lambda}{2},\qquad n - 1 = \frac{N\lambda}{2L_c}`,
    String.raw`\text{Filme: } \delta = \frac{4\pi n_2 e}{\lambda},\quad r = \frac{r_{12} + r_{23}e^{i\delta}}{1 + r_{12}r_{23}e^{i\delta}},\quad r_{ij} = \frac{n_i - n_j}{n_i + n_j}`,
    String.raw`\text{uma inversão de fase: } 2n_2 e = \left(m + \tfrac12\right)\lambda \ \text{(claro)};\quad \text{zero ou duas: } 2n_2e = m\lambda \ \text{(claro)}`,
    String.raw`\text{Newton: } e = \frac{r^2}{2R},\qquad r_m = \sqrt{m\lambda R}\ \text{(anéis escuros)}`,
  ],
  liveEquations(s, p, t) {
    const m = mode(p);
    if (m === MICHELSON) {
      const N = fringeCount(s, p);
      const out = [
        String.raw`N = ${N},\quad x - x_{\text{ref}} = ${texNum(s.x - s.ref.x)}\ \mu\text{m},\quad p = ${texNum(s.p)}\ \text{kPa}`,
      ];
      if (N > 0 && Math.abs(s.x - s.ref.x) > 1e-6)
        out.push(String.raw`\lambda \approx \frac{2\,\Delta x}{N} = ${texNum(lambdaMeasured(s, p))}\ \text{nm}`);
      if (num(p, "dlam", 0) > 0)
        out.push(
          String.raw`\ell_c = \frac{\lambda^2}{\Delta\lambda} = ${texNum(coherenceLength(lam(p), num(p, "dlam", 0)) * 1e3)}\ \text{mm},\quad \Delta = ${texNum(opdOf(s, p) * 1e3)}\ \text{mm} \Rightarrow V = ${texNum(visibility(opdOf(s, p), lam(p), num(p, "dlam", 0)), 3)}`,
        );
      if (N > 0 && Math.abs(s.p - s.ref.p) > 0.5)
        out.push(String.raw`(n-1)_{1\,\text{atm}} \approx \frac{N\lambda}{2L_c}\frac{p_{\text{atm}}}{\Delta p} = ${texNum(nm1Measured(s, p))}`);
      return out;
    }
    const [n1, n2, n3] = indices(p);
    const e = probeThickness(s, p, t);
    const flips = (fresnelR(n1, n2) < 0 ? 1 : 0) + (fresnelR(n2, n3) < 0 ? 1 : 0);
    const out = [
      String.raw`n_1 = ${texNum(n1)},\ n_2 = ${texNum(n2)},\ n_3 = ${texNum(n3)}\ \Rightarrow\ ${flips}\ \text{inversão(ões) de fase}`,
      String.raw`e = ${texNum(e)}\ \text{nm},\quad \frac{2n_2e}{\lambda} = ${texNum((2 * n2 * e) / lam(p))},\quad R/R_{\max} = ${texNum(intensity(s, p, t), 3)}`,
    ];
    if (m === NEWTON) out.push(String.raw`r_1 = \sqrt{\lambda R} = ${texNum(darkRingRadius(1, lam(p), num(p, "R", 2)))}\ \text{mm}`);
    if (m === AR)
      out.push(
        String.raw`R(\lambda) = ${texNum(100 * filmReflectance(n1, n2, n3, e, lam(p)), 3)}\,\% \ \text{(vidro nu: } ${texNum(100 * fresnelR(1, N_GLASS) ** 2, 3)}\,\%) \qquad \lambda_{\min} = 4n_2e = ${texNum(4 * n2 * e)}\ \text{nm}`,
      );
    if (m === CUNHA) out.push(String.raw`\Delta x = \frac{\lambda L}{2 e_{\max}} = ${texNum(wedgeSpacing(s, p))}\ \text{mm}`);
    return out;
  },

  params: [
    {
      key: "exp",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: MICHELSON, label: "Interferômetro de Michelson" },
        { value: CUNHA, label: "Cunha de ar entre lâminas" },
        { value: BOLHA, label: "Película de sabão (drenando)" },
        { value: NEWTON, label: "Anéis de Newton" },
        { value: AR, label: "Camada antirreflexo (espessura fixa)" },
      ],
    },
    {
      key: "luz",
      label: "Luz (filmes e Newton)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Monocromática (λ)" },
        { value: 1, label: "Branca" },
      ],
    },
    { key: "lambda", label: "Comprimento de onda λ", unit: "nm", min: 400, max: 700, step: 1, default: 633 },
    { key: "motor", label: "Motor do espelho/lente", unit: "µm/s", min: -2, max: 2, step: 0.01, default: 0, live: true },
    { key: "bomba", label: "Bomba de gás (dp/dt)", unit: "kPa/s", min: -20, max: 20, step: 0.5, default: 0, live: true },
    {
      key: "gas",
      label: "Gás na célula",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: GASES.map((g, i) => ({ value: i, label: g.label })),
    },
    { key: "Lc", label: "Comprimento da célula L_c", unit: "cm", min: 1, max: 10, step: 0.5, default: 5 },
    { key: "d0", label: "Diferença entre os braços d₀", unit: "mm", min: 0.1, max: 2, step: 0.05, default: 0.5 },
    { key: "nf", label: "Índice da película n₂", unit: "", min: 1, max: 2, step: 0.01, default: 1.33 },
    {
      key: "ns",
      label: "Atrás da película",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Ar (bolha de sabão)" },
        { value: 1, label: "Vidro n = 1,52 (camada sobre lente)" },
      ],
    },
    { key: "e0", label: "Espessura inicial da película (base)", unit: "nm", min: 200, max: 3000, step: 10, default: 1500 },
    { key: "emax", label: "Espessura da cunha no calço", unit: "µm", min: 1, max: 20, step: 0.5, default: 5 },
    { key: "R", label: "Raio de curvatura da lente R", unit: "m", min: 0.5, max: 10, step: 0.1, default: 2 },
    { key: "dlam", label: "Largura espectral da fonte Δλ (Michelson; 0 = laser ideal)", unit: "nm", min: 0, max: 20, step: 0.1, default: 0, live: true },
    { key: "eAR", label: "Espessura da camada antirreflexo", unit: "nm", min: 0, max: 400, step: 1, default: 100, live: true },
  ],

  observables: [
    { key: "I", label: "Intensidade relativa (centro ou sonda)", unit: "", value: (s, p, t) => intensity(s, p, t) },
    { key: "N", label: "Franjas contadas N", unit: "", value: (s, p) => fringeCount(s, p) },
    { key: "x", label: "Deslocamento do espelho x", unit: "µm", value: (s) => s.x },
    { key: "p", label: "Pressão na célula", unit: "kPa", value: (s) => s.p },
    { key: "lamMed", label: "λ medido (2Δx/N)", unit: "nm", value: (s, p) => lambdaMeasured(s, p) },
    { key: "nm1", label: "(n − 1) medido a 1 atm", unit: "", value: (s, p) => nm1Measured(s, p) },
    { key: "e", label: "Espessura na sonda (ar no centro, Newton)", unit: "nm", value: (s, p, t) => probeThickness(s, p, t) },
    { key: "V", label: "Visibilidade das franjas (Michelson)", unit: "", value: (s, p) => (mode(p) === MICHELSON ? visibility(opdOf(s, p), lam(p), num(p, "dlam", 0)) : 0) },
    { key: "Rar", label: "Refletância com a camada (em λ)", unit: "%", value: (_s, p) => 100 * filmReflectance(1, num(p, "nf", 1.33), N_GLASS, num(p, "eAR", 100), lam(p)) },
    { key: "Rvidro", label: "Refletância do vidro sem camada", unit: "%", value: () => 100 * fresnelR(1, N_GLASS) ** 2 },
    {
      key: "r1",
      label: "Raio do 1º anel escuro visível",
      unit: "mm",
      value: (s, p) => {
        for (let m = 0; m < 400; m++) {
          const r = darkRingRadius(m, lam(p), num(p, "R", 2), s.lift);
          if (r > 1e-9) return r;
        }
        return 0;
      },
    },
  ],
  chart: { x: "t", y: "I" },

  scenarios: [
    {
      id: "michelson",
      label: "Michelson: medindo λ",
      params: { exp: MICHELSON, lambda: 633, motor: 0.3, bomba: 0, d0: 0.5 },
      guide: `### Contando franjas
1. Rode: o motor empurra o espelho $M_1$ a 0,3 µm/s. Veja os anéis nascerem no centro do anteparo.
2. Cada franja que passa pelo centro corresponde a $\\Delta x = \\lambda/2$. O contador $N$ registra as passagens.
3. Pare depois de umas 30 franjas e calcule $\\lambda = 2\\Delta x/N$. Compare com as medidas.
4. Você também pode **arrastar o espelho** com o mouse (fique de olho no centro) e usar **Zerar contagem**.`,
      predict: [
        {
          question: "Quanto o espelho precisa andar para uma franja passar pelo centro?",
          options: ["λ", "λ/2", "λ/4", "2λ"],
          answer: 1,
          explanation: "A luz vai e volta no braço: deslocar o espelho de $\\Delta x$ muda o caminho em $2\\Delta x$. Uma franja corresponde a uma mudança de caminho $\\lambda$, logo $\\Delta x = \\lambda/2$.",
        },
      ],
    },
    {
      id: "gas",
      label: "Michelson: índice de um gás",
      params: { exp: MICHELSON, lambda: 633, motor: 0, bomba: 5, gas: 0, Lc: 5 },
      guide: `### Célula de gás
1. A célula de $L_c$ = 5 cm começa em vácuo. Rode: a bomba injeta ar a 5 kPa/s.
2. Conte as franjas até a pressão chegar perto de 101 kPa. Cada franja significa $2(n-1)L_c$ variando de $\\lambda$.
3. Calcule $n - 1 = N\\lambda/(2L_c)$ e compare com o valor tabelado (≈ 2,7 × 10⁻⁴).
4. Troque o gás por CO₂ e por hélio e compare. Inverta a bomba (valor negativo) para esvaziar.`,
      predict: [
        {
          question: "Encher a célula de 5 cm com ar (de vácuo até 1 atm) com λ = 633 nm faz passar aproximadamente:",
          options: ["1 franja", "4 franjas", "43 franjas", "4300 franjas"],
          answer: 2,
          explanation: "$N = 2(n-1)L_c/\\lambda = 2(2{,}7\\times 10^{-4})(0{,}05)/(633\\times 10^{-9}) \\approx 43$.",
        },
      ],
    },
    {
      id: "bolha",
      label: "Película de sabão com luz branca",
      params: { exp: BOLHA, luz: 1, nf: 1.33, ns: 0, e0: 1500 },
      guide: `### Cores que descem
1. A película vertical drena: fica mais fina no topo e afina com o tempo. Rode e observe as faixas coloridas descendo.
2. No topo, quando $e \\ll \\lambda$, a película fica **preta**. Por quê? (Pense nas inversões de fase em ar → água e água → ar.)
3. Arraste a sonda e leia $e$ e $2n_2e/\\lambda$. Troque para luz monocromática e confira: claro em $2n_2e = (m + \\tfrac12)\\lambda$.
4. Mude para **Cunha de ar entre lâminas**: arraste o calço e veja o espaçamento das franjas mudar ($\\Delta x = \\lambda L/2e_{\\max}$).
5. Ponha a película sobre vidro (n = 1,52): agora as duas reflexões invertem a fase e o filme fino fica claro.`,
      predict: [
        {
          question: "Pouco antes de estourar, o topo de uma película de sabão (muito mais fina que λ) aparece:",
          options: ["branco brilhante", "preto", "violeta", "da cor da luz incidente"],
          answer: 1,
          explanation: "A reflexão ar → água inverte a fase e a água → ar não. Com $e \\to 0$ as duas ondas refletidas saem em oposição de fase e se cancelam para todos os λ: a película fica preta.",
        },
      ],
    },
    {
      id: "newton",
      label: "Anéis de Newton",
      params: { exp: NEWTON, luz: 0, lambda: 589, R: 2, motor: 0 },
      guide: `### Medindo o raio da lente
1. A camada de ar entre a lente e a lâmina tem espessura $e = r^2/2R$. Os anéis escuros aparecem em $2e = m\\lambda$.
2. Meça o raio de alguns anéis escuros na vista de cima e verifique $r_m^2 = m\\lambda R$.
3. O centro é escuro. Por quê, se ali a espessura é zero?
4. **Arraste a lente para cima** (ou ligue o motor): os anéis encolhem e somem no centro, um a cada λ/2 de elevação.
5. Troque para luz branca: só os primeiros anéis ficam nítidos.`,
    },
    {
      id: "coerencia",
      label: "Comprimento de coerência",
      params: { exp: MICHELSON, lambda: 633, dlam: 0.5, d0: 0.1, motor: 0.3 },
      guide: `### Até onde a luz interfere consigo mesma?
1. A fonte não é um laser ideal: tem largura espectral $\\Delta\\lambda = 0{,}5\\ \\text{nm}$. Cada trem de onda dura pouco, e seu comprimento é o **comprimento de coerência**
$$\\ell_c \\approx \\frac{\\lambda^2}{\\Delta\\lambda} = \\frac{(633\\ \\text{nm})^2}{0{,}5\\ \\text{nm}} \\approx 0{,}8\\ \\text{mm}$$
2. Com $d_0 = 0{,}1\\ \\text{mm}$ a diferença de caminho é $\\Delta = 2d_0 = 0{,}2\\ \\text{mm} < \\ell_c$: os anéis são nítidos (visibilidade ≈ 0,8).
3. Aumente $d_0$ para 0,3 mm e depois 0,5 mm. Quando $\\Delta$ passa de $\\ell_c$, as duas cópias do trem de onda chegam ao anteparo sem relação de fase fixa: o contraste some e o anteparo fica uniformemente iluminado.
4. Ponha $\\Delta\\lambda = 0$ (laser ideal): os anéis voltam para qualquer $d_0$. Com $\\Delta\\lambda = 20\\ \\text{nm}$ (um LED), $\\ell_c \\approx 20\\ \\mu\\text{m}$ e não se veem franjas.
5. É por isso que bolhas de sabão mostram cores (filme de menos de 1 µm) e uma janela de vidro de 3 mm não: a espessura passa do comprimento de coerência da luz branca.`,
      predict: [
        {
          question: "Uma fonte de λ = 600 nm e Δλ = 6 nm ilumina um Michelson. As franjas desaparecem quando a diferença de caminho passa de cerca de:",
          options: ["600 nm", "6 µm", "60 µm", "6 mm"],
          answer: 2,
          explanation: "$\\ell_c \\approx \\lambda^2/\\Delta\\lambda = (600\\ \\text{nm})^2/(6\\ \\text{nm}) = 60\\ \\mu\\text{m}$.",
        },
      ],
    },
    {
      id: "antirreflexo",
      label: "Camada antirreflexo de espessura fixa",
      params: { exp: AR, luz: 1, nf: 1.38, eAR: 100, lambda: 550 },
      guide: `### Uma lente que reflete menos
1. Uma camada de fluoreto de magnésio ($n_2 = 1{,}38$) de **100 nm** cobre o vidro ($n_3 = 1{,}52$). As duas reflexões (ar–camada e camada–vidro) invertem a fase, então elas se cancelam quando
$$2n_2e = \\frac{\\lambda}{2} \\quad\\Rightarrow\\quad \\lambda_{\\min} = 4n_2e = 552\\ \\text{nm}$$
2. No gráfico, a curva de $R(\\lambda)$ tem o mínimo no verde-amarelo, onde o olho é mais sensível, bem abaixo dos 4,3 % do vidro nu. Não chega a zero porque as duas reflexões não têm a mesma amplitude ($n_2 \\neq \\sqrt{n_3}$).
3. A espessura é fixa, mas a luz é branca: nas pontas do espectro (azul e vermelho) o cancelamento é parcial. Por isso o reflexo residual de lentes tratadas é arroxeado (amostras de cor embaixo).
4. Mude $e$ para 150 nm: o mínimo vai para o vermelho. Com $e = 200\\ \\text{nm}$ ($= \\lambda/2n_2$ para 552 nm) a camada fica "invisível" nesse λ: $R$ volta ao do vidro nu.
5. Ponha $n_2 = 1{,}23 \\approx \\sqrt{1{,}52}$ e $e = 112\\ \\text{nm}$: agora o mínimo chega a zero.`,
      predict: [
        {
          question: "Uma camada de MgF₂ (n = 1,38) de 100 nm sobre vidro reflete menos em qual cor?",
          options: ["violeta (≈ 400 nm)", "verde-amarelo (≈ 550 nm)", "vermelho (≈ 700 nm)", "reflete igual em todas"],
          answer: 1,
          explanation: "As duas reflexões invertem a fase; o cancelamento pede $2n_2e = \\lambda/2$, ou seja $\\lambda = 4 \\times 1{,}38 \\times 100 \\approx 552\\ \\text{nm}$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "michelson-n",
      prompt:
        "Num interferômetro de Michelson iluminado com λ = {lambda} nm, o espelho móvel é deslocado de {x} µm. Quantas franjas passam pelo centro do padrão?",
      vary: { lambda: [450, 680, 0], x: [10, 80, 1] },
      fixed: { exp: MICHELSON },
      answer: { label: "N", unit: "", compute: (p) => (2 * num(p, "x") * 1e3) / num(p, "lambda") },
      tolerance: 0.02,
      hint: "Cada franja corresponde a um deslocamento de λ/2 do espelho.",
    },
    {
      id: "newton-r",
      prompt:
        "Uma lente plano-convexa de raio de curvatura {R} m repousa sobre uma lâmina de vidro e é iluminada por cima com luz de {lambda} nm. Qual é o raio do anel escuro de ordem {m} (o centro escuro é m = 0)?",
      vary: { R: [0.5, 8, 1], lambda: [450, 680, 0], m: [1, 12, 0] },
      fixed: { exp: NEWTON },
      answer: { label: "r", unit: "mm", compute: (p) => darkRingRadius(num(p, "m"), num(p, "lambda"), num(p, "R")) },
      hint: "Anéis escuros: 2e = mλ, com e = r²/2R.",
    },
    {
      id: "antirreflexo",
      prompt:
        "Uma película de índice {nf} sobre vidro (n = 1,52) é usada como camada antirreflexo para luz de {lambda} nm em incidência normal. Qual é a menor espessura que torna mínima a reflexão?",
      vary: { nf: [1.25, 1.45, 2], lambda: [450, 650, 0] },
      fixed: { exp: BOLHA, ns: 1 },
      answer: { label: "e", unit: "nm", compute: (p) => num(p, "lambda") / (4 * num(p, "nf")) },
      hint: "As duas reflexões invertem a fase; o cancelamento exige 2n₂e = λ/2.",
    },
  ],

  init: (p) => {
    const s: FilmesState = {
      x: 0,
      p: 0,
      ref: { opd: 0, x: 0, p: 0 },
      lift: 0,
      wedge: num(p, "emax", 5),
      probe: mode(p) === BOLHA ? 0.35 : 0.5,
      drag: "",
      grab: { at: 0, v: 0 },
    };
    s.ref.opd = opdOf(s, p);
    return s;
  },
  step(s, p, _t, dt) {
    const m = mode(p);
    if (m === MICHELSON) return { ...s, x: s.x + num(p, "motor") * dt, p: clamp(s.p + num(p, "bomba") * dt, 0, 150) };
    if (m === NEWTON) return { ...s, lift: clamp(s.lift + num(p, "motor") * 1e3 * dt, 0, 5000) };
    return s;
  },
  dt: 0.01,
  sampleEvery: 2,

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      if (m === MICHELSON && Math.abs(pt.x - M1X(s.x)) < 0.7 && Math.abs(pt.y) < 1.4)
        return { ...s, drag: "espelho", grab: { at: pt.x, v: s.x } };
      if (m === NEWTON && pt.x > LENS.x0 && pt.x < LENS.x1 && pt.y > LENS.plate && pt.y < LENS.plate + liftVis(s.lift) + 2.2)
        return { ...s, drag: "lente", grab: { at: pt.y, v: s.lift } };
      if (m === CUNHA) {
        const top = WEDGE.base + 0.5 + wedgeH(s.wedge);
        if (Math.abs(pt.x - (WEDGE.x1 - 0.4)) < 0.9 && pt.y > WEDGE.base && pt.y < top + 0.8) return { ...s, drag: "cunha" };
        if (pt.y < WEDGE.strip1 + 0.3 && pt.y > WEDGE.strip0 - 0.3) return probeFromPoint(s, p, pt.x, pt.y);
      }
      if (m === BOLHA && pt.y >= FILM.y0 - 0.2 && pt.y <= FILM.y1 + 0.2) return probeFromPoint(s, p, pt.x, pt.y);
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      switch (s.drag) {
        case "espelho":
          return { ...s, x: s.grab.v + (pt.x - s.grab.at) * 4 };
        case "lente":
          return { ...s, lift: clamp(s.grab.v + (pt.y - s.grab.at) * 500, 0, 5000) };
        case "cunha":
          return { ...s, wedge: clamp((pt.y - WEDGE.base - 0.5 - 0.25) / 0.12, 0.5, 20) };
        case "sonda":
          return probeFromPoint(s, p, pt.x, pt.y);
      }
      return undefined;
    },
    up: (s) => (s.drag ? { ...s, drag: "" } : undefined),
    cursor(s, p, pt) {
      const m = mode(p);
      if (m === MICHELSON && Math.abs(pt.x - M1X(s.x)) < 0.7 && Math.abs(pt.y) < 1.4) return "ew-resize";
      if (m === NEWTON && pt.x > LENS.x0 && pt.x < LENS.x1 && pt.y > LENS.plate && pt.y < LENS.plate + liftVis(s.lift) + 2.2) return "ns-resize";
      if (m === CUNHA && Math.abs(pt.x - (WEDGE.x1 - 0.4)) < 0.9 && pt.y > WEDGE.base) return "ns-resize";
      if ((m === CUNHA && pt.y < WEDGE.strip1) || (m === BOLHA && pt.y <= FILM.y1)) return "crosshair";
      return undefined;
    },
  },
  actions: [
    {
      id: "zerar",
      label: "Zerar contagem",
      run: (s, p) => ({ ...s, ref: { opd: opdOf(s, p), x: s.x, p: s.p } }),
    },
    {
      id: "inicio",
      label: "Espelho/lente na posição inicial",
      run: (s, p) => {
        const n = { ...s, x: 0, lift: 0 };
        return { ...n, ref: { opd: opdOf(n, p), x: 0, p: n.p } };
      },
    },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: -7, yMax: 6.4 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    switch (mode(p)) {
      case MICHELSON:
        return renderMichelson(d, theme, s, p);
      case CUNHA:
        return renderWedge(d, theme, s, p);
      case BOLHA:
        return renderBubble(d, theme, s, p, t);
      case AR:
        return renderAR(d, theme, p);
      default:
        return renderNewton(d, theme, s, p);
    }
  },
});

function probeFromPoint(s: FilmesState, p: Params, x: number, y: number): FilmesState {
  if (mode(p) === CUNHA) return { ...s, drag: "sonda", probe: clamp((x - WEDGE.x0) / (WEDGE.x1 - WEDGE.x0), 0, 1) };
  return { ...s, drag: "sonda", probe: clamp((FILM.y1 - y) / (FILM.y1 - FILM.y0), 0, 1) };
}

const fmt = (v: number, digits = 3) => Number(v.toPrecision(digits)).toString().replace(".", ",").replace("-", "−");

function beam(d: Draw, x1: number, y1: number, x2: number, y2: number, color: string) {
  d.line(x1, y1, x2, y2, { color, width: 2.5, alpha: 0.85 });
}

/** Disco de anéis concêntricos: f(u) dá a cor para u = r/R de 0 a 1. */
function ringDisk(d: Draw, cx: number, cy: number, R: number, f: (u: number) => RGB, n = 150) {
  d.circle(cx, cy, R, { fill: "#000" });
  for (let i = n; i >= 1; i--) {
    const u = (i - 0.5) / n;
    d.circle(cx, cy, (R * i) / n, { fill: cssRGB(f(u)) });
  }
}

function renderMichelson(d: Draw, theme: Theme, s: FilmesState, p: Params) {
  const L = lam(p);
  const beamColor = cssRGB(wavelengthRGB(L), 0.8);
  const mx = M1X(s.x);
  // Laser
  d.rect(0.4, -0.5, 2.2, 1, { fill: theme.text, alpha: 0.85 });
  d.text("laser", 1.5, -0.95, { color: theme.muted, size: 11 });
  beam(d, 2.6, 0, BS.x, 0, beamColor);
  // Braço do espelho fixo M2
  beam(d, BS.x, 0, BS.x, 5, beamColor);
  d.rect(BS.x - 0.9, 5, 1.8, 0.25, { fill: theme.muted });
  d.text("M₂ (fixo)", BS.x + 1.2, 5.15, { color: theme.muted, size: 11, align: "left" });
  // Braço do espelho móvel M1, com a célula de gás
  beam(d, BS.x, 0, mx, 0, beamColor);
  const fill = clamp(s.p / 110, 0, 1);
  d.rect(7.1, -0.7, 2.2, 1.4, { fill: theme.series[2]!, alpha: 0.08 + 0.5 * fill, stroke: theme.text, width: 1.2 });
  d.text(`${GASES[gas(p)]?.label ?? ""}: ${fmt(s.p)} kPa`, 8.2, -1.15, { color: theme.text, size: 11 });
  d.text(`célula L_c = ${fmt(num(p, "Lc", 5))} cm`, 8.2, 1.15, { color: theme.muted, size: 10 });
  d.rect(mx, -1, 0.25, 2, { fill: theme.accent, stroke: theme.text, width: 1 });
  d.line(mx + 0.25, -1.3, mx + 0.25, 1.3, { color: theme.muted, width: 1 });
  d.text("M₁ (arraste)", mx + 0.1, 1.6, { color: theme.accent, size: 11, weight: "600" });
  d.text(`x = ${fmt(s.x, 4)} µm`, mx + 0.1, -1.6, { color: theme.text, size: 11 });
  if (Math.abs(s.x / 4) > 2) d.text(s.x > 0 ? "»" : "«", mx + (s.x > 0 ? 0.7 : -0.5), 0.5, { color: theme.muted, size: 14 });
  // Divisor de feixe
  d.line(BS.x - 0.7, -0.7, BS.x + 0.7, 0.7, { color: theme.text, width: 3 });
  d.text("divisor", BS.x - 1.1, 0.5, { color: theme.muted, size: 10, align: "right" });
  // Saída para o anteparo
  beam(d, BS.x, 0, BS.x, -4.6, beamColor);
  d.rect(BS.x - 1.2, -4.9, 2.4, 0.3, { fill: theme.muted });
  d.text("anteparo", BS.x, -5.3, { color: theme.muted, size: 11 });
  d.line(BS.x + 1.2, -4.75, RING.x - RING.r, RING.y - 1.5, { color: theme.muted, width: 1, dash: [3, 3] });

  // Anéis vistos no anteparo
  const d0 = num(p, "d0", 0.5) * 1e-3 + s.x * 1e-6;
  const thetaMax = 3 * Math.sqrt((L * 1e-9) / Math.max(1e-6, d0));
  const opd = opdOf(s, p);
  const dl = num(p, "dlam", 0);
  ringDisk(d, RING.x, RING.y, RING.r, (u) => monoColor(L, michelsonIc(opd, d0, u * thetaMax, L, dl)));
  if (dl > 0)
    d.text(
      `fonte com Δλ = ${fmt(dl)} nm: ℓc = λ²/Δλ = ${fmt(coherenceLength(L, dl) * 1e3)} mm · Δ = ${fmt(opd * 1e3)} mm · visibilidade ${fmt(visibility(opd, L, dl), 2)}`,
      0.4,
      -6.0,
      { color: theme.accent, size: 11, align: "left" },
    );
  d.circle(RING.x, RING.y, RING.r, { stroke: theme.muted, width: 1 });
  d.text("vista do anteparo", RING.x, RING.y + RING.r + 0.4, { color: theme.muted, size: 11 });
  d.text(`θ até ${fmt(thetaMax * 1e3, 2)} mrad`, RING.x, RING.y - RING.r - 0.4, { color: theme.muted, size: 10 });

  // Contador
  const N = fringeCount(s, p);
  d.text(`Franjas contadas: N = ${N}`, 0.4, 3.9, { color: theme.text, size: 14, weight: "600", align: "left" });
  d.text(`Δx = ${fmt(s.x - s.ref.x, 4)} µm · Δp = ${fmt(s.p - s.ref.p)} kPa`, 0.4, 3.2, { color: theme.muted, size: 11, align: "left" });
  if (N > 0 && Math.abs(s.x - s.ref.x) > 1e-3) d.text(`λ ≈ 2Δx/N = ${fmt(lambdaMeasured(s, p))} nm`, 0.4, 2.6, { color: theme.accent, size: 12, align: "left" });
  if (N > 0 && Math.abs(s.p - s.ref.p) > 0.5) d.text(`(n−1) ≈ ${fmt(nm1Measured(s, p) * 1e4)} × 10⁻⁴ a 1 atm`, 0.4, 2.0, { color: theme.accent, size: 12, align: "left" });
  d.text("Distâncias fora de escala; o deslocamento de M₁ está muito ampliado.", 0.4, -6.6, { color: theme.muted, size: 10, align: "left" });
}

function renderWedge(d: Draw, theme: Theme, s: FilmesState, p: Params) {
  const { x0, x1, base, strip0, strip1 } = WEDGE;
  const h = wedgeH(s.wedge);
  // Vista lateral: lâmina de baixo, calço e lâmina inclinada
  d.rect(x0, base, x1 - x0, 0.5, { fill: theme.accent, alpha: 0.25, stroke: theme.text, width: 1 });
  const y0 = base + 0.5;
  d.polyline(
    [
      [x0, y0],
      [x1, y0 + h],
      [x1, y0 + h + 0.5],
      [x0, y0 + 0.5],
    ],
    { close: true, fill: theme.dark ? "rgba(91,156,240,0.25)" : "rgba(47,125,225,0.25)", color: theme.text, width: 1 },
  );
  d.circle(x1 - 0.4, y0 + h / 2, h / 2, { fill: theme.series[1]!, stroke: theme.text, width: 1 });
  d.text("calço (arraste)", x1 - 0.4, y0 + h + 0.95, { color: theme.series[1]!, size: 11, weight: "600", align: "right" });
  d.text("contato", x0, base - 0.35, { color: theme.muted, size: 10, align: "left" });
  for (const xx of [4, 9, 14]) d.arrowPx(xx, y0 + h + 1.4, 0, -1, 26, { color: theme.muted, width: 1.5 });
  d.text("luz incidente", 9.5, y0 + h + 1.6, { color: theme.muted, size: 10, align: "left" });
  d.text(`vista lateral (ângulo ampliado): e_máx = ${fmt(s.wedge)} µm, L = ${L_WEDGE} mm`, x0, 5.9, { color: theme.muted, size: 11, align: "left" });

  // Vista de cima: franjas
  const N = 360;
  const w = (x1 - x0) / N;
  for (let i = 0; i < N; i++) {
    const f = (i + 0.5) / N;
    d.rect(x0 + i * w, strip0, w * 1.05, strip1 - strip0, { fill: cssRGB(filmColor(s.wedge * 1e3 * f, p)) });
  }
  d.rect(x0, strip0, x1 - x0, strip1 - strip0, { stroke: theme.muted, width: 1 });
  d.text("vista de cima (luz refletida)", x0, strip1 + 0.4, { color: theme.muted, size: 11, align: "left" });
  for (let mm = 0; mm <= L_WEDGE; mm += 10) {
    const xx = x0 + ((x1 - x0) * mm) / L_WEDGE;
    d.line(xx, strip0, xx, strip0 - 0.2, { color: theme.muted, width: 1 });
    d.text(`${mm}`, xx, strip0 - 0.5, { color: theme.muted, size: 10 });
  }
  d.text("mm", x1 + 0.7, strip0 - 0.5, { color: theme.muted, size: 10 });
  probeMarker(d, theme, x0 + s.probe * (x1 - x0), strip0, strip1, true);
  d.text(
    `sonda: e = ${fmt(s.wedge * 1e3 * s.probe)} nm · espaçamento das franjas Δx = ${fmt(wedgeSpacing(s, p))} mm`,
    x0,
    -6.6,
    { color: theme.text, size: 11, align: "left" },
  );
}

function probeMarker(d: Draw, theme: Theme, at: number, a: number, b: number, vertical: boolean) {
  if (vertical) {
    d.line(at, a - 0.1, at, b + 0.1, { color: theme.text, width: 2 });
    d.line(at, a - 0.1, at, b + 0.1, { color: "#fff", width: 1, dash: [3, 3] });
  } else {
    d.line(a - 0.1, at, b + 0.1, at, { color: theme.text, width: 2 });
    d.line(a - 0.1, at, b + 0.1, at, { color: "#fff", width: 1, dash: [3, 3] });
  }
}

function renderBubble(d: Draw, theme: Theme, s: FilmesState, p: Params, t: number) {
  const { x0, x1, y0, y1, g0, g1 } = FILM;
  // Película: faixas horizontais
  d.rect(x0, y0, x1 - x0, y1 - y0, { fill: "#000" });
  const N = 260;
  const h = (y1 - y0) / N;
  for (let i = 0; i < N; i++) {
    const frac = (i + 0.5) / N; // do topo para baixo
    d.rect(x0, y1 - (i + 1) * h, x1 - x0, h * 1.05, { fill: cssRGB(filmColor(bubbleThickness(frac, p, t), p)) });
  }
  d.rect(x0 - 0.12, y0 - 0.12, x1 - x0 + 0.24, y1 - y0 + 0.24, { stroke: theme.text, width: 3 });
  d.line((x0 + x1) / 2, y1 + 0.12, (x0 + x1) / 2, y1 + 0.6, { color: theme.text, width: 2 });
  const back = Math.round(num(p, "ns")) === 1 ? "película sobre vidro" : "película de sabão no ar (armação de arame)";
  d.text(back, (x0 + x1) / 2, y0 - 0.55, { color: theme.muted, size: 11 });
  const yp = y1 - s.probe * (y1 - y0);
  probeMarker(d, theme, yp, x0, x1, false);

  // Gráfico e(altura)
  const e0 = num(p, "e0", 1500);
  const ex = (e: number) => g0 + ((g1 - g0) * e) / e0;
  d.line(g0, y0, g0, y1, { color: theme.muted, width: 1 });
  d.line(g0, y0, g1, y0, { color: theme.muted, width: 1 });
  const pts: [number, number][] = [];
  for (let i = 0; i <= 100; i++) {
    const f = i / 100;
    pts.push([ex(bubbleThickness(f, p, t)), y1 - f * (y1 - y0)]);
  }
  d.polyline(pts, { color: theme.series[0], width: 2 });
  // Espessura λ/4n (primeira faixa clara com uma inversão de fase)
  const [n1, n2, n3] = indices(p);
  const eb = minBrightThickness(n1, n2, n3, lam(p));
  if (eb < e0) {
    d.line(ex(eb), y0, ex(eb), y1, { color: theme.muted, width: 1, dash: [4, 4] });
    d.text(`1º claro p/ λ: ${fmt(eb)} nm`, ex(eb) + 0.1, y1 + 0.3, { color: theme.muted, size: 10, align: "left" });
  }
  d.text("e (nm)", g1, y0 - 0.4, { color: theme.muted, size: 10, align: "right" });
  d.text("0", g0, y0 - 0.4, { color: theme.muted, size: 10 });
  d.text(`${e0}`, g1, y0 - 0.8, { color: theme.muted, size: 10, align: "right" });
  d.dot(ex(probeThickness(s, p, t)), yp, 5, theme.accent);
  d.text("topo", g0 - 0.2, y1, { color: theme.muted, size: 10, align: "right" });
  d.text("base", g0 - 0.2, y0, { color: theme.muted, size: 10, align: "right" });
  d.text(`sonda: e = ${fmt(probeThickness(s, p, t))} nm · R/R_máx(λ) = ${fmt(intensity(s, p, t), 2)}`, 0.3, -6.6, {
    color: theme.text,
    size: 11,
    align: "left",
  });
}

/** Camada antirreflexo: lente com uma camada de espessura fixa e o espectro refletido. */
function renderAR(d: Draw, theme: Theme, p: Params) {
  const nf = num(p, "nf", 1.33);
  const e = num(p, "eAR", 100);
  const L = lam(p);
  const Rg = fresnelR(1, N_GLASS) ** 2;
  const R = (nm: number) => filmReflectance(1, nf, N_GLASS, e, nm);
  // Vista lateral ampliada: ar | camada | vidro
  const yTop = 2.2;
  const hc = 0.4 + Math.min(2.4, e / 120);
  d.rect(0.5, -5.5, 7, yTop - hc + 5.5, { fill: theme.accent, alpha: 0.25, stroke: theme.text, width: 1 });
  d.rect(0.5, yTop - hc, 7, hc, { fill: theme.series[2]!, alpha: 0.35, stroke: theme.text, width: 1 });
  d.text(`camada: n₂ = ${fmt(nf)}, e = ${fmt(e)} nm`, 4, yTop + 0.4, { color: theme.text, size: 11 });
  d.text(`vidro n₃ = ${N_GLASS.toString().replace(".", ",")}`, 4, -4.8, { color: theme.muted, size: 11 });
  d.text("ar n₁ = 1", 4, 5.6, { color: theme.muted, size: 11 });
  const col = cssRGB(wavelengthRGB(L), 0.8);
  d.line(1.5, 5, 3, yTop, { color: col, width: 2.5 });
  d.line(3, yTop, 4.2, 5, { color: col, width: 2, alpha: 0.8 });
  d.line(3, yTop, 3.4, yTop - hc, { color: col, width: 2, alpha: 0.8 });
  d.line(3.4, yTop - hc, 3.8, yTop, { color: col, width: 2, alpha: 0.8, dash: [4, 3] });
  d.line(3.8, yTop, 5, 5, { color: col, width: 2, alpha: 0.8, dash: [4, 3] });
  d.text("1", 4.35, 4.6, { color: theme.text, size: 11 });
  d.text("2", 5.15, 4.6, { color: theme.text, size: 11 });
  d.text("as duas reflexões invertem a fase: cancelam se 2n₂e = λ/2", 4, -6.4, { color: theme.muted, size: 10 });
  // Gráfico R(λ)
  const G = { x0: 9.5, x1: 19.5, y0: -4.5, y1: 4.5 };
  const Rtop = 0.1;
  const gx = (nm: number) => G.x0 + ((nm - 400) / 300) * (G.x1 - G.x0);
  const gy = (r: number) => G.y0 + (Math.min(r, Rtop) / Rtop) * (G.y1 - G.y0);
  d.rect(G.x0, G.y0, G.x1 - G.x0, G.y1 - G.y0, { stroke: theme.grid, width: 1 });
  for (let nm = 400; nm < 700; nm += 5) d.rect(gx(nm), G.y0 - 0.5, gx(nm + 5) - gx(nm) + 0.01, 0.35, { fill: cssRGB(wavelengthRGB(nm + 2.5)) });
  for (const r of [0.02, 0.04, 0.06, 0.08]) {
    d.line(G.x0, gy(r), G.x1, gy(r), { color: theme.grid, width: 1, alpha: 0.6 });
    d.text(`${Math.round(r * 100)} %`, G.x0 - 0.15, gy(r), { color: theme.muted, size: 9, align: "right" });
  }
  d.line(G.x0, gy(Rg), G.x1, gy(Rg), { color: theme.muted, width: 2, dash: [6, 4] });
  d.text("vidro sem camada", G.x1, gy(Rg) + 0.35, { color: theme.muted, size: 10, align: "right" });
  d.plot((x) => gy(R(400 + ((x - G.x0) / (G.x1 - G.x0)) * 300)), G.x0, G.x1, { color: theme.series[0]!, width: 2.5 });
  d.dot(gx(L), gy(R(L)), 5, theme.accent);
  d.text(`R(${fmt(L)} nm) = ${fmt(100 * R(L), 2)} %`, G.x0 + 0.2, G.y1 - 0.4, { color: theme.text, size: 11, align: "left", weight: "600" });
  d.text("refletância × λ (nm)", G.x0 + 0.2, G.y1 + 0.4, { color: theme.text, size: 11, align: "left" });
  // Cor do reflexo (luz branca), com e sem camada, na mesma escala
  const k = 1 / (2 * Rg);
  d.rect(10, -6.6, 1.2, 0.8, { fill: cssRGB(spectrumColor(() => Rg * k)), stroke: theme.text, width: 1 });
  d.text("reflexo sem camada", 11.4, -6.2, { color: theme.muted, size: 10, align: "left" });
  d.rect(15, -6.6, 1.2, 0.8, { fill: cssRGB(spectrumColor((nm) => R(nm) * k)), stroke: theme.text, width: 1 });
  d.text("com camada", 16.4, -6.2, { color: theme.muted, size: 10, align: "left" });
}

function renderNewton(d: Draw, theme: Theme, s: FilmesState, p: Params) {
  const { x0, x1, plate, k, thick } = LENS;
  const L = lam(p);
  const Rm = num(p, "R", 2);
  // Vista lateral
  d.rect(x0 - 0.3, plate - 0.7, x1 - x0 + 0.6, 0.7, { fill: theme.accent, alpha: 0.25, stroke: theme.text, width: 1 });
  const g = liftVis(s.lift);
  const xc = (x0 + x1) / 2;
  const bottom: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const x = x0 + ((x1 - x0) * i) / 60;
    bottom.push([x, plate + g + k * (x - xc) ** 2]);
  }
  const topY = plate + g + k * (x1 - xc) ** 2 + thick * 0.4;
  d.polyline([...bottom, [x1, topY], [x0, topY]], {
    close: true,
    fill: theme.dark ? "rgba(91,156,240,0.25)" : "rgba(47,125,225,0.25)",
    color: theme.text,
    width: 1,
  });
  d.text("lente (arraste para erguer)", xc, topY + 0.45, { color: theme.accent, size: 11, weight: "600" });
  d.text(`R = ${fmt(Rm)} m · e no centro = ${fmt(s.lift)} nm`, xc, plate - 1.2, { color: theme.text, size: 11 });
  d.text("curvatura e folga muito ampliadas", xc, plate - 1.75, { color: theme.muted, size: 10 });
  for (const xx of [3, 5, 7]) d.arrowPx(xx, topY + 2.2, 0, -1, 30, { color: theme.muted, width: 1.5 });

  // Vista de cima
  const rMax = Math.sqrt(12 * L * 1e-9 * Rm) * 1e3; // mm
  ringDisk(d, NR.x, NR.y, NR.r, (u) => filmColor(newtonGap(u * rMax, Rm, s.lift), p), 180);
  d.circle(NR.x, NR.y, NR.r, { stroke: theme.muted, width: 1 });
  d.text("vista de cima (luz refletida)", NR.x, NR.y + NR.r + 0.45, { color: theme.muted, size: 11 });
  // Escala radial
  const yS = NR.y - NR.r - 0.45;
  d.line(NR.x, yS, NR.x + NR.r, yS, { color: theme.muted, width: 1 });
  d.line(NR.x, yS - 0.12, NR.x, yS + 0.12, { color: theme.muted, width: 1 });
  d.line(NR.x + NR.r, yS - 0.12, NR.x + NR.r, yS + 0.12, { color: theme.muted, width: 1 });
  d.text(`${fmt(rMax)} mm`, NR.x + NR.r / 2, yS - 0.4, { color: theme.muted, size: 10 });
  // Marcas dos primeiros anéis escuros previstos por r = √(mλR)
  if (!white(p))
    for (let m = 1; m <= 12; m++) {
      const r = darkRingRadius(m, L, Rm, s.lift);
      if (!(r > 0) || r > rMax) continue;
      const xr = NR.x + (r / rMax) * NR.r;
      d.line(xr, NR.y - 0.18, xr, NR.y + 0.18, { color: theme.text, width: 1, alpha: 0.6 });
      if (m <= 3) d.text(`${m}`, xr, NR.y + 0.4, { color: "#fff", size: 9 });
    }
}

export default filmesFinos;
