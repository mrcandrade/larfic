import { clamp, defineSim, draw, formatBR, num, texNum, type Draw, type Params, type RenderFrame, type State } from "@fisilab/core";
import { derivation } from "./derivation.ts";
import {
  C,
  CADEIAS,
  DNU_CS,
  E_MAX,
  E_MIN,
  H,
  K_J,
  MASSAS,
  OBJETOS,
  TEMPOS,
  atrasoQuartzo,
  ciclosCesio,
  fatoresDa,
  freqMassa,
  kibble,
  massaCubo,
  objetoMaisProximo,
  ondasHeNe,
  tempoLuz,
  textoAtomos,
  textoUnidades,
  unidadesApos,
  unidadesConferem,
  valorApos,
  valorFator,
  type Atom,
  type Ref,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: [e = expoente do quadro, k = fatores aplicados (contínuo), τ = tempo físico do padrão (s)]
const E = 0, K = 1, TAU = 2;

const modo = (p: Params) => Math.round(num(p, "modo"));
const cadeia = (p: Params) => CADEIAS[clamp(Math.round(num(p, "grandeza")), 0, CADEIAS.length - 1)]!;
const comErro = (p: Params) => Math.round(num(p, "erro")) === 1;
const padrao = (p: Params) => Math.round(num(p, "padrao"));
/** Curso da bobina da balança de Kibble (m). */
export const CURSO = 0.02;

/** Tempo físico por segundo de animação, por padrão (câmera lenta). */
export function rapidezPadrao(p: Params): number {
  const k = padrao(p);
  return k === 0 ? 1e-9 : k === 1 ? 2e-10 : 1;
}

/** Fatores aplicados (inteiro) para k contínuo. */
export const aplicados = (k: number, p: Params) => clamp(Math.floor(k + 1e-9), 0, cadeia(p).fatores.length);

const fmt = (v: number, d = 4) => sci(v, d);
const SUP = "⁰¹²³⁴⁵⁶⁷⁸⁹";
const sup = (n: number) => String(n).replace(/-/g, "⁻").replace(/\d/g, (c) => SUP[Number(c)]!);
/** Notação científica com expoente sobrescrito: "3,34 × 10⁻⁹". */
export function sci(v: number, digits = 3): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e-2 && a < 1e5) return formatBR(v, digits);
  const [m, e] = v.toExponential(digits - 1).split("e");
  const mm = Number(m);
  return `${mm === 1 ? "" : `${String(mm).replace(".", ",")} × `}10${sup(Number(e))}`;
}

function observarLg(s: State, p: Params): number {
  const m = modo(p);
  if (m === 0) return s[E]!;
  if (m === 1) return Math.log10(Math.abs(valorApos(cadeia(p), num(p, "valor", 100), aplicados(s[K]!, p), comErro(p))) || 1e-300);
  const k = padrao(p);
  if (k === 0) return Math.log10(Math.max(C * s[TAU]!, 1e-30));
  if (k === 1) return Math.log10(Math.max(ciclosCesio(s[TAU]!), 1e-30));
  return Math.log10(num(p, "mK", 1));
}

export const escalasUnidades = defineSim({
  id: "escalas-unidades",
  title: "Medição: ordens de grandeza, unidades e padrões SI",
  course: "FG I",
  topic: "Medição",
  priority: "P1",
  summary:
    "Um zoom contínuo de 10⁻¹⁵ m a 10²⁶ m com objetos, tempos e massas de referência; conversões de unidades em cadeia com os fatores se cancelando; e como o SI define o metro, o segundo e o quilograma a partir de c, do césio e de h.",
  equations: [
    String.raw`L = 10^{e}\ \text{m} \qquad t_{luz} = \frac{L}{c} \qquad m_{\text{cubo}} = \rho_{\text{água}}\,L^3`,
    String.raw`100\ \tfrac{\text{km}}{\text{h}}\times\frac{1000\ \text{m}}{1\ \text{km}}\times\frac{1\ \text{h}}{3600\ \text{s}} = 27{,}8\ \tfrac{\text{m}}{\text{s}}`,
    String.raw`1\ \text{m} = c\cdot\frac{1}{299\,792\,458}\ \text{s} \qquad 1\ \text{s} = \frac{9\,192\,631\,770}{\Delta\nu_{Cs}} \qquad m = \frac{U I}{g v}\ \ (\text{Kibble})`,
  ],
  liveEquations(s, p) {
    const m = modo(p);
    if (m === 0) {
      const L = 10 ** s[E]!;
      const o = OBJETOS[objetoMaisProximo(s[E]!)]!;
      return [
        String.raw`L = 10^{${texNum(s[E]!, 3)}}\ \text{m} = ${texNum(L, 3)}\ \text{m} \qquad \frac{L}{c} = ${texNum(tempoLuz(L), 3)}\ \text{s}`,
        String.raw`\rho L^3 = ${texNum(massaCubo(L), 3)}\ \text{kg} \qquad \frac{L}{L_{\text{obj}}} = ${texNum(L / o.v, 3)}`,
      ];
    }
    if (m === 1) {
      const c = cadeia(p);
      const v0 = num(p, "valor", 100);
      const fs = fatoresDa(c, comErro(p));
      const termo = (q: { nv: number; nu: Atom[]; dv: number; du: Atom[]; pow?: number }) => {
        const fr = String.raw`\frac{${texNum(q.nv, 10)}\ \text{${textoAtomos(q.nu)}}}{${texNum(q.dv, 10)}\ \text{${textoAtomos(q.du)}}}`;
        return q.pow && q.pow !== 1 ? String.raw`\left(${fr}\right)^{${q.pow}}` : fr;
      };
      const v1 = valorApos(c, v0, fs.length, comErro(p));
      return [
        String.raw`${texNum(v0, 4)}\ \text{${textoUnidades(unidadesApos(c, 0))}}\times ${fs.map(termo).join(String.raw`\times `)}`,
        String.raw`= ${texNum(v1, 5)}\ \text{${textoUnidades(unidadesApos(c, fs.length, comErro(p)))}}\qquad \text{fator} = ${texNum(v1 / v0, 6)}`,
      ];
    }
    const k = padrao(p);
    const tau = s[TAU]!;
    if (k === 0) {
      return [
        String.raw`\tau = ${texNum(tau * 1e9, 6)}\ \text{ns} \qquad c\tau = ${texNum(C * tau, 6)}\ \text{m}`,
        String.raw`\tau_{\text{alvo}} = \frac{${texNum(num(p, "Lalvo", 1), 4)}\ \text{m}}{299\,792\,458\ \text{m/s}} = ${texNum(num(p, "Lalvo", 1) / C * 1e9, 7)}\ \text{ns} \qquad N_{\lambda} = ${texNum(ondasHeNe(C * tau), 7)}`,
      ];
    }
    if (k === 1) {
      const ppm = num(p, "ppm", 20);
      return [
        String.raw`N = \Delta\nu_{Cs}\,\tau = 9\,192\,631\,770\ \text{Hz}\times ${texNum(tau, 4)}\ \text{s} = ${texNum(ciclosCesio(tau), 5)}`,
        String.raw`\text{quartzo com } ${texNum(ppm, 3)}\ \text{ppm}:\ \Delta t_{\text{dia}} = ${texNum(atrasoQuartzo(ppm, 1), 4)}\ \text{s}`,
      ];
    }
    const kb = kibble(num(p, "mK", 1), num(p, "g", 9.787), num(p, "BL", 400), num(p, "vK", 2) / 1000);
    return [
      String.raw`U = BLv = ${texNum(kb.U, 4)}\ \text{V} \qquad I = \frac{mg}{BL} = ${texNum(kb.I, 4)}\ \text{A}`,
      String.raw`m = \frac{UI}{gv} = ${texNum(kb.m, 6)}\ \text{kg} \qquad f = \frac{mc^2}{h} = ${texNum(freqMassa(kb.m), 4)}\ \text{Hz}`,
    ];
  },
  derivation,

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Potências de dez (zoom)" },
        { value: 1, label: "Conversão de unidades em cadeia" },
        { value: 2, label: "Padrões do SI" },
      ],
    },
    { key: "e0", label: "Zoom: expoente inicial (largura 10^e m)", unit: "", min: E_MIN, max: E_MAX, step: 1, default: E_MIN },
    { key: "vel", label: "Zoom: rapidez (décadas por segundo)", unit: "1/s", min: -4, max: 4, step: 0.1, default: 1.5, live: true },
    {
      key: "grandeza",
      label: "Conversão",
      unit: "",
      min: 0,
      max: CADEIAS.length - 1,
      step: 1,
      default: 0,
      options: CADEIAS.map((c, value) => ({ value, label: c.nome })),
    },
    { key: "valor", label: "Valor a converter", unit: "", min: 0.001, max: 1e6, step: 0.001, default: 100, log: true },
    {
      key: "erro",
      label: "Montagem dos fatores",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Correta" },
        { value: 1, label: "Erro comum: 1º fator de cabeça para baixo" },
      ],
    },
    { key: "tPasso", label: "Tempo por fator na animação", unit: "s", min: 0.3, max: 4, step: 0.1, default: 1.5, live: true },
    {
      key: "padrao",
      label: "Padrão do SI",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Metro (velocidade da luz)" },
        { value: 1, label: "Segundo (relógio de césio)" },
        { value: 2, label: "Quilograma (balança de Kibble, h)" },
      ],
    },
    { key: "Lalvo", label: "Metro: comprimento percorrido pela luz", unit: "m", min: 0.1, max: 3, step: 0.01, default: 1 },
    { key: "ppm", label: "Segundo: erro do relógio de quartzo", unit: "ppm", min: 0, max: 100, step: 0.5, default: 20, live: true },
    { key: "mK", label: "Kibble: massa no prato", unit: "kg", min: 0.01, max: 2, step: 0.01, default: 1 },
    { key: "BL", label: "Kibble: fator geométrico B·L", unit: "T·m", min: 100, max: 1000, step: 10, default: 400 },
    { key: "vK", label: "Kibble: velocidade da bobina", unit: "mm/s", min: 0.5, max: 5, step: 0.1, default: 2 },
    { key: "g", label: "Kibble: gravidade local", unit: "m/s²", min: 9.78, max: 9.83, step: 0.001, default: 9.787 },
  ],

  observables: [
    { key: "e", label: "Zoom: expoente da largura (log₁₀ L/m)", unit: "", value: (s) => s[E]! },
    { key: "L", label: "Zoom: largura do quadro", unit: "m", value: (s) => 10 ** s[E]! },
    { key: "tluz", label: "Zoom: tempo da luz para cruzar o quadro", unit: "s", value: (s) => tempoLuz(10 ** s[E]!) },
    { key: "mcubo", label: "Zoom: massa de água num cubo do tamanho do quadro", unit: "kg", value: (s) => massaCubo(10 ** s[E]!) },
    { key: "obj", label: "Zoom: tamanho do objeto de referência mais próximo", unit: "m", value: (s) => OBJETOS[objetoMaisProximo(s[E]!)]!.v },
    { key: "mobj", label: "Zoom: massa desse objeto", unit: "kg", value: (s) => OBJETOS[objetoMaisProximo(s[E]!)]!.m },
    { key: "passo", label: "Conversão: fatores já aplicados", unit: "", value: (s, p) => aplicados(s[K]!, p) },
    {
      key: "parcial",
      label: "Conversão: valor parcial (unidade intermediária)",
      unit: "",
      value: (s, p) => valorApos(cadeia(p), num(p, "valor", 100), aplicados(s[K]!, p), comErro(p)),
    },
    {
      key: "fator",
      label: "Conversão: fator total (unidade final por inicial)",
      unit: "",
      value: (_s, p) => valorApos(cadeia(p), 1, cadeia(p).fatores.length, comErro(p)),
    },
    { key: "ok", label: "Conversão: unidades conferem (1 = sim)", unit: "", value: (_s, p) => (unidadesConferem(cadeia(p), comErro(p)) ? 1 : 0) },
    { key: "tau", label: "Padrão: tempo físico decorrido τ", unit: "s", value: (s) => s[TAU]! },
    { key: "dluz", label: "Padrão: distância da luz cτ", unit: "m", value: (s) => C * s[TAU]! },
    { key: "Ncs", label: "Padrão: ciclos do césio em τ", unit: "", value: (s) => ciclosCesio(s[TAU]!) },
    {
      key: "mKibble",
      label: "Padrão: massa medida (UI/gv)",
      unit: "kg",
      value: (_s, p) => kibble(num(p, "mK", 1), num(p, "g", 9.787), num(p, "BL", 400), num(p, "vK", 2) / 1000).m,
    },
    { key: "lg", label: "Ordem de grandeza em destaque (log₁₀)", unit: "", value: (s, p) => observarLg(s, p) },
  ],
  chart: { x: "t", y: "lg" },

  scenarios: [
    {
      id: "potencias-de-dez",
      label: "Potências de dez: do próton ao Universo",
      params: { modo: 0, e0: -15, vel: 1.5 },
      guide: `### Um zoom de 41 ordens de grandeza
O quadro começa com $10^{-15}$ m de largura (um próton) e cresce **uma potência de dez a cada** $1/r$ segundos. Cada círculo é um objeto real desenhado em escala; embaixo, três réguas logarítmicas mostram o comprimento do quadro, o tempo que a luz leva para atravessá-lo e a massa do objeto em destaque.
1. Rode e pause quando aparecer a **pessoa** ($\\sim 10^{0}$ m). Quantas ordens de grandeza a separam de um átomo? E da Terra?
2. Leia o tempo de luz $L/c$ na largura do Sol. Compare com os 8 minutos que a luz do Sol leva para chegar até nós (órbita da Terra).
3. No fim do zoom, o tempo de luz chega a $\\sim 10^{17}$ s, a idade do Universo. Por que isso não é coincidência?
4. Arraste o marcador na régua de comprimento (ou use os botões) para ir direto a uma escala. Use a massa do cubo de água ($\\rho L^3$) para estimar ordens de grandeza: o cubo do tamanho de uma pessoa tem $\\sim 10^{3}$ kg, mas a pessoa tem $\\sim 10^{2}$ kg. Por quê?`,
      predict: [
        {
          question: "Em ordens de grandeza (escala logarítmica), o diâmetro da Terra está mais perto do tamanho de:",
          options: ["uma pessoa", "da Via Láctea", "está no meio do caminho entre os dois"],
          answer: 0,
          explanation:
            "Terra: $\\sim 10^{7}$ m; pessoa: $\\sim 10^{0}$ m; Via Láctea: $\\sim 10^{21}$ m. A Terra está 7 ordens de grandeza acima da pessoa e 14 abaixo da galáxia: numa régua logarítmica, ela fica bem mais perto de nós.",
        },
      ],
    },
    {
      id: "conversao",
      label: "Conversão em cadeia: fatores que se cancelam",
      params: { modo: 1, grandeza: 0, valor: 100, erro: 0, tPasso: 1.5 },
      guide: `### Multiplicar por 1 até sobrar a unidade certa
Cada fator de conversão é uma fração que **vale 1** (o mesmo comprimento, tempo ou força escrito de dois jeitos). Escolha a fração que deixa a unidade indesejada no denominador e ela se cancela.
1. Rode e acompanhe: as unidades riscadas são as que se cancelaram; a tabela mostra o valor parcial depois de cada fator.
2. Troque a grandeza para **massa específica** e **volume**: quando a unidade está ao cubo, o fator inteiro vai ao cubo, $(100\\ \\text{cm}/1\\ \\text{m})^3 = 10^6$.
3. Em **pressão**, siga a cadeia psi → lbf/in² → N/in² → N/m² → Pa. Quanto vale a pressão de um pneu de 32 psi em kPa?
4. Ligue o **erro comum** (primeiro fator de cabeça para baixo): o número final pode até parecer plausível, mas as unidades não conferem. A análise das unidades é o seu detector de erros.`,
      predict: [
        {
          question: "Um carro anda a 72 km/h. Em metros por segundo, isso é:",
          options: ["259 200 m/s", "72 000 m/s", "20 m/s", "1,2 m/s"],
          answer: 2,
          explanation:
            "$72\\ \\tfrac{\\text{km}}{\\text{h}}\\times\\frac{1000\\ \\text{m}}{1\\ \\text{km}}\\times\\frac{1\\ \\text{h}}{3600\\ \\text{s}} = 20$ m/s. Multiplicar por 3600 colocaria horas² no denominador ($259\\,200$ não tem as unidades certas).",
        },
      ],
    },
    {
      id: "padroes-si",
      label: "Padrões do SI: luz, césio e constante de Planck",
      params: { modo: 2, padrao: 0, Lalvo: 1, ppm: 20, mK: 1 },
      guide: `### O metro, o segundo e o quilograma definidos por constantes
Desde 2019 o SI fixa valores **exatos** para constantes da natureza e define as unidades a partir delas.
1. **Metro**: rode com $L = 1$ m e veja o pulso de luz percorrer a régua em câmera lenta (1 ns de tempo físico por segundo). Ele chega em $1/299\\,792\\,458$ s $= 3{,}3356$ ns. Conte também quantos comprimentos de onda do laser de He-Ne cabem no metro (é assim que o metro é realizado na prática).
2. **Segundo**: escolha o relógio de césio. A sim conta os ciclos da radiação da transição hiperfina; $9\\,192\\,631\\,770$ ciclos definem 1 s. Compare com um relógio de quartzo com erro de alguns ppm: quanto ele atrasa por dia e por mês?
3. **Quilograma**: na balança de Kibble, a força magnética $BLI$ equilibra o peso $mg$ e, no modo de velocidade, a bobina gera $U = BLv$. Confira que $m = UI/(gv)$ devolve a massa, seja qual for $BL$.
4. Por que fixar $h$ (em J·s = kg·m²/s) define o quilograma, uma vez que o metro e o segundo já estão definidos?`,
      predict: [
        {
          question: "Em 1 nanossegundo, a luz percorre no vácuo aproximadamente:",
          options: ["3 cm", "30 cm", "3 m", "300 m"],
          answer: 1,
          explanation: "$c\\,\\Delta t = 3\\times10^{8}\\ \\text{m/s}\\times10^{-9}\\ \\text{s} = 0{,}3$ m. É por isso que 1 m corresponde a cerca de 3,3 ns de viagem da luz.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "tempo-luz",
      prompt: "Quanto tempo a luz leva, no vácuo, para atravessar um quadro de largura 10^{e0} m?",
      vary: { e0: [-15, 26, 0] },
      fixed: { modo: 0 },
      answer: { label: "t", unit: "s", compute: (p) => tempoLuz(10 ** num(p, "e0")) },
      hint: "t = L/c, com c = 299 792 458 m/s.",
    },
    {
      id: "ordens",
      prompt:
        "Um quadro de largura 10^{e0} m é preenchido por um cubo de água (1000 kg/m³). Qual a massa da água, em kg?",
      vary: { e0: [-3, 4, 0] },
      fixed: { modo: 0 },
      answer: { label: "m", unit: "kg", compute: (p) => massaCubo(10 ** num(p, "e0")) },
      hint: "m = ρ L³: o expoente de 10 triplica.",
    },
    {
      id: "km-h",
      prompt: "Converta {valor} km/h para m/s.",
      vary: { valor: [5, 300, 0] },
      fixed: { modo: 1, grandeza: 0, erro: 0 },
      answer: { label: "v", unit: "m/s", compute: (p) => valorApos(CADEIAS[0]!, num(p, "valor"), CADEIAS[0]!.fatores.length) },
    },
    {
      id: "psi",
      prompt: "Um pneu está calibrado com {valor} psi (1 lbf = 4,448 N; 1 in = 2,54 cm). Quanto é essa pressão em kPa?",
      vary: { valor: [20, 120, 0] },
      fixed: { modo: 1, grandeza: 2, erro: 0 },
      answer: { label: "p", unit: "kPa", compute: (p) => valorApos(CADEIAS[2]!, num(p, "valor"), CADEIAS[2]!.fatores.length) / 1000 },
      hint: "1 psi = 1 lbf/in²; o fator de polegadas para metros entra ao quadrado.",
    },
    {
      id: "densidade",
      prompt: "Um material tem massa específica de {valor} g/cm³. Quanto é isso em kg/m³?",
      vary: { valor: [0.5, 20, 2] },
      fixed: { modo: 1, grandeza: 1, erro: 0 },
      answer: { label: "ρ", unit: "kg/m³", compute: (p) => valorApos(CADEIAS[1]!, num(p, "valor"), CADEIAS[1]!.fatores.length) },
      hint: "1 m³ = (100 cm)³ = 10⁶ cm³.",
    },
    {
      id: "luz-ns",
      prompt: "Pela definição do metro, quanto tempo (em ns) a luz leva para percorrer {Lalvo} m no vácuo?",
      vary: { Lalvo: [0.1, 3, 2] },
      fixed: { modo: 2, padrao: 0 },
      answer: { label: "τ", unit: "ns", compute: (p) => (num(p, "Lalvo") / C) * 1e9 },
    },
    {
      id: "quartzo",
      prompt: "Um relógio de quartzo adianta {ppm} ppm (partes por milhão) em relação ao padrão de césio. Quantos segundos ele adianta em 30 dias?",
      vary: { ppm: [1, 60, 1] },
      fixed: { modo: 2, padrao: 1 },
      answer: { label: "Δt", unit: "s", compute: (p) => atrasoQuartzo(num(p, "ppm"), 30) },
    },
    {
      id: "kibble",
      prompt:
        "Numa balança de Kibble com B·L = {BL} T·m, a bobina se move a {vK} mm/s e uma massa de {mK} kg está no prato (g = {g} m/s²). Qual é a corrente que equilibra o peso, em mA?",
      vary: { BL: [200, 800, 0], vK: [1, 4, 1], mK: [0.1, 1.5, 2], g: [9.78, 9.82, 3] },
      fixed: { modo: 2, padrao: 2 },
      answer: { label: "I", unit: "mA", compute: (p) => ((num(p, "mK") * num(p, "g")) / num(p, "BL")) * 1000 },
      hint: "No modo de pesagem, B L I = m g.",
    },
  ],

  init: (p) => [clamp(num(p, "e0", E_MIN), E_MIN, E_MAX), 0, 0],
  derivatives: (s: State, p: Params): State => {
    const m = modo(p);
    return [m === 0 ? num(p, "vel", 1.5) : 0, m === 1 ? 1 / Math.max(num(p, "tPasso", 1.5), 0.05) : 0, m === 2 ? rapidezPadrao(p) : 0];
  },
  dt: 0.01,
  sampleEvery: 3,
  tEnd: 120,
  stopWhen(s, p) {
    const m = modo(p);
    if (m === 0) {
      const v = num(p, "vel", 1.5);
      return v > 0 ? E_MAX - s[E]! : v < 0 ? s[E]! - E_MIN : 1;
    }
    if (m === 1) return cadeia(p).fatores.length + 0.6 - s[K]!;
    const k = padrao(p);
    if (k === 0) return num(p, "Lalvo", 1) - C * s[TAU]!;
    if (k === 2) return CURSO - (num(p, "vK", 2) / 1000) * s[TAU]!;
    return 1;
  },

  viewport: (p) => ({ xMin: 0, xMax: 12, yMin: modo(p) === 2 ? 2 : 0, yMax: 12 }),

  pointer: {
    down(s, p, pt) {
      if (modo(p) !== 0 || Math.abs(pt.y - REGUA_Y[0]) > 0.6 || pt.x < LX0 - 0.3 || pt.x > LX1 + 0.3) return undefined;
      return [eDoX(pt.x), s[K]!, s[TAU]!];
    },
    move(s, p, pt, dragging) {
      if (!dragging || modo(p) !== 0) return undefined;
      return [eDoX(pt.x), s[K]!, s[TAU]!];
    },
    cursor: (_s, p, pt) => (modo(p) === 0 && Math.abs(pt.y - REGUA_Y[0]) < 0.6 && pt.x > LX0 - 0.3 && pt.x < LX1 + 0.3 ? "ew-resize" : undefined),
  },
  actions: [
    { id: "menos", label: "Zoom: ÷ 10", run: (s, p) => (modo(p) === 0 ? [Math.max(E_MIN, Math.round(s[E]!) - 1), s[K]!, s[TAU]!] : s) },
    { id: "mais", label: "Zoom: × 10", run: (s, p) => (modo(p) === 0 ? [Math.min(E_MAX, Math.round(s[E]!) + 1), s[K]!, s[TAU]!] : s) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = modo(frame.params);
    if (m === 0) renderZoom(d, frame);
    else if (m === 1) renderConversao(d, frame);
    else renderPadroes(d, frame);
  },
});

// ------------------------------------------------------------------ desenho: zoom

/** Faixa horizontal das réguas logarítmicas. */
const LX0 = 1.0, LX1 = 11.4;
/** Alturas das réguas: comprimento, tempo, massa. */
const REGUA_Y = [4.55, 2.8, 1.05] as const;
const FAIXAS: readonly [[number, number], [number, number], [number, number]] = [[E_MIN, E_MAX + 1], [-24, 18], [-31, 54]];
const xDoLog = (lg: number, f: [number, number]) => LX0 + ((lg - f[0]) / (f[1] - f[0])) * (LX1 - LX0);
const eDoX = (x: number) => clamp(FAIXAS[0][0] + ((x - LX0) / (LX1 - LX0)) * (FAIXAS[0][1] - FAIXAS[0][0]), E_MIN, E_MAX);

function regua(d: Draw, y: number, f: [number, number], titulo: string, valor: number, refs: Ref[], cor: string) {
  const th = d.theme;
  const lv = Math.log10(valor);
  let ref = refs[0]!;
  for (const r of refs) if (Math.abs(Math.log10(r.v) - lv) < Math.abs(Math.log10(ref.v) - lv)) ref = r;
  const perto = Math.abs(Math.log10(ref.v) - lv) < 1.5 ? `  ≈ ${ref.nome}` : "";
  d.text(`${titulo}: ${sci(valor)}${perto}`, LX0 - 0.8, y + 0.6, { size: 11, align: "left", color: cor, weight: "600" });
  d.line(LX0, y, LX1, y, { color: th.muted, width: 1.5 });
  const passo = f[1] - f[0] > 60 ? 20 : 10;
  for (let k = Math.ceil(f[0] / 5) * 5; k <= f[1]; k += 5) {
    const x = xDoLog(k, f);
    const grande = k % passo === 0;
    d.line(x, y - (grande ? 0.16 : 0.09), x, y + (grande ? 0.16 : 0.09), { color: th.muted, width: 1 });
    if (grande) d.text(`10${sup(k)}`, x, y - 0.42, { size: 10, color: th.muted });
  }
  for (const r of refs) d.dot(xDoLog(Math.log10(r.v), f), y, 2.2, th.muted, 0.7);
  const xv = xDoLog(clamp(lv, f[0], f[1]), f);
  d.polyline([[xv, y + 0.04], [xv - 0.15, y + 0.32], [xv + 0.15, y + 0.32]], { close: true, fill: cor, color: cor });
}

function renderZoom(d: Draw, frame: RenderFrame) {
  const { state: s, theme: th } = frame;
  const e = s[E]!;
  const L = 10 ** e;
  const W = { x0: 0.15, x1: 11.85, y0: 5.65, y1: 11.85 };
  const w = W.x1 - W.x0, h = W.y1 - W.y0;
  const cx = (W.x0 + W.x1) / 2, cy = (W.y0 + W.y1) / 2 - 0.2;
  d.rect(W.x0, W.y0, w, h, { fill: th.dark ? "#0b1220" : "#f3f6fb", stroke: th.muted, width: 1 });
  const iMais = objetoMaisProximo(e);
  const ctx = d.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.rect(W.x0, W.y0, w, h);
  ctx.clip();
  // Objetos em escala, concêntricos, do maior para o menor
  const vis = OBJETOS.map((o, i) => ({ o, i, D: (o.v / L) * w })).filter((q) => q.D > 0.02 && q.D < 3 * Math.hypot(w, h));
  vis.sort((a, b) => b.D - a.D);
  for (const q of vis) {
    const cor = q.i === iMais ? th.accent : th.series[(q.i % 5) + 1]!;
    d.circle(cx, cy, q.D / 2, { fill: cor, alpha: q.i === iMais ? 0.22 : 0.1 });
    d.circle(cx, cy, q.D / 2, { stroke: cor, width: q.i === iMais ? 2.4 : 1.2 });
  }
  for (const q of vis) {
    const topo = cy + q.D / 2;
    if (q.D < 1.1 && q.i !== iMais) continue;
    if (topo > W.y1 - 0.3) continue;
    const cor = q.i === iMais ? th.accent : th.text;
    d.text(q.o.nome, cx, Math.max(topo + 0.22, cy + 0.35), { size: q.i === iMais ? 12 : 10, color: cor, weight: q.i === iMais ? "700" : "400" });
  }
  ctx.restore();
  // barra de escala: um décimo do quadro
  const bx = W.x0 + 0.35, by = W.y0 + 0.4;
  d.line(bx, by, bx + w / 10, by, { color: th.text, width: 2.5 });
  d.line(bx, by - 0.1, bx, by + 0.1, { color: th.text, width: 1.5 });
  d.line(bx + w / 10, by - 0.1, bx + w / 10, by + 0.1, { color: th.text, width: 1.5 });
  d.text(`${sci(L / 10)} m`, bx + w / 10 + 0.15, by, { size: 11, align: "left", color: th.text });
  d.text(`largura do quadro: ${sci(L)} m`, W.x0 + 0.25, W.y1 - 0.35, { size: 12, align: "left", weight: "700", color: th.text });
  const o = OBJETOS[iMais]!;
  d.text(`${o.nome}: ${sci(o.v)} m · ${sci(o.m)} kg`, W.x0 + 0.25, W.y1 - 0.85, { size: 11, align: "left", color: th.accent });

  regua(d, REGUA_Y[0], FAIXAS[0], "L (m, arraste)", L, OBJETOS, th.accent);
  regua(d, REGUA_Y[1], FAIXAS[1], "L/c (s)", tempoLuz(L), TEMPOS, th.series[1]!);
  regua(d, REGUA_Y[2], FAIXAS[2], "massa do objeto (kg)", o.m, MASSAS, th.series[2]!);
}

// ------------------------------------------------------------------ desenho: conversão

interface Peca {
  txt: string;
  /** Índice do átomo de unidade (para riscar) ou -1 para o número. */
  atom: number;
}

/** Átomos riscados: para cada bloco (0 = partida, i = fator i), quais átomos do numerador e do denominador se cancelaram. */
export function cancelados(p: Params, n: number): { num: Set<number>; den: Set<number> }[] {
  const c = cadeia(p);
  const fs = fatoresDa(c, comErro(p));
  const blocos: { nu: Atom[]; du: Atom[]; pow: number }[] = [{ nu: c.nu, du: c.du, pow: 1 }, ...fs.map((f) => ({ nu: f.nu, du: f.du, pow: f.pow ?? 1 }))];
  const out = blocos.map(() => ({ num: new Set<number>(), den: new Set<number>() }));
  const abertos: { b: number; lado: 1 | -1; i: number; u: string; p: number }[] = [];
  blocos.slice(0, n + 1).forEach((bl, b) => {
    const atoms: { lado: 1 | -1; i: number; u: string; p: number }[] = [
      ...bl.nu.map((x, i) => ({ lado: 1 as const, i, u: x.u, p: x.p * bl.pow })),
      ...bl.du.map((x, i) => ({ lado: -1 as const, i, u: x.u, p: x.p * bl.pow })),
    ];
    for (const at of atoms) {
      const j = abertos.findIndex((q) => q.u === at.u && q.lado === -at.lado && q.p === at.p);
      if (j >= 0) {
        const q = abertos[j]!;
        (q.lado === 1 ? out[q.b]!.num : out[q.b]!.den).add(q.i);
        (at.lado === 1 ? out[b]!.num : out[b]!.den).add(at.i);
        abertos.splice(j, 1);
      } else abertos.push({ b, ...at });
    }
  });
  return out;
}

function renderConversao(d: Draw, frame: RenderFrame) {
  const { state: s, params: p, theme: th, scale } = frame;
  const ctx = d.ctx;
  const c = cadeia(p);
  const erro = comErro(p);
  const fs = fatoresDa(c, erro);
  const nAp = aplicados(s[K]!, p);
  const risc = cancelados(p, nAp);
  const v0 = num(p, "valor", 100);
  const px = 1 / scale;
  const larguraPx = 11.6 * scale;
  const FS = 13;
  const fonte = (peso = "400") => (ctx.font = `${peso} ${FS}px system-ui, -apple-system, "Segoe UI", sans-serif`);
  const mede = (t: string) => {
    fonte();
    return ctx.measureText(t).width;
  };
  const pecas = (v: number | null, at: Atom[]): Peca[] => [
    ...(v === null ? [] : [{ txt: fmt(v, 10), atom: -1 }]),
    ...at.map((x, i) => ({ txt: textoAtomos([x]), atom: i })),
  ];
  const largura = (ps: Peca[]) => ps.reduce((a, q) => a + mede(q.txt), 0) + 4 * Math.max(0, ps.length - 1);

  interface Bloco {
    num: Peca[];
    den: Peca[];
    w: number;
    pow: number;
    i: number;
  }
  const blocos: Bloco[] = [];
  const add = (num: Peca[], den: Peca[], pow: number, i: number) => {
    const w = Math.max(largura(num), largura(den)) + (pow !== 1 ? 26 : 8);
    blocos.push({ num, den, w, pow, i });
  };
  add(pecas(v0, c.nu), c.du.length ? pecas(null, c.du) : [], 1, 0);
  fs.forEach((f, i) => add(pecas(f.nv, f.nu), pecas(f.dv, f.du), f.pow ?? 1, i + 1));

  // disposição em linhas, quebrando conforme a largura do palco
  const xMundo = (xp: number) => 0.2 + xp * px;
  const yMundo = (yp: number) => 11.8 - yp * px;
  const sinal = 22;
  const alt = 2 * FS + 22;
  let xp = 0, yp = 18;
  d.text(c.nome, 0.2, yMundo(4), { size: 13, align: "left", weight: "700" });
  blocos.forEach((b, k) => {
    const total = b.w + (k ? sinal : 0);
    if (xp > 0 && xp + total > larguraPx) {
      xp = 0;
      yp += alt;
    }
    if (k) {
      d.text("×", xMundo(xp + sinal / 2), yMundo(yp + alt / 2), { size: 14, color: th.muted });
      xp += sinal;
    }
    const estado = b.i === 0 || b.i <= nAp ? "ok" : b.i === nAp + 1 && s[K]! > nAp ? "agora" : "falta";
    const cor = estado === "falta" ? th.muted : erro && b.i === 1 ? th.positive : th.text;
    if (estado === "agora" || (b.i > 0 && b.i <= nAp)) {
      d.rect(xMundo(xp), yMundo(yp + alt - 2), b.w * px, (alt - 4) * px, {
        fill: estado === "agora" ? th.accent : th.grid,
        alpha: estado === "agora" ? 0.14 : 0.5,
      });
    }
    const linha = (ps: Peca[], ypLinha: number, riscados: Set<number>) => {
      const wl = largura(ps);
      let x = xp + (b.w - wl) / 2 - (b.pow !== 1 ? 9 : 0);
      for (const q of ps) {
        const wq = mede(q.txt);
        d.text(q.txt, xMundo(x), yMundo(ypLinha), { size: FS, align: "left", color: cor });
        if (q.atom >= 0 && riscados.has(q.atom)) {
          d.line(xMundo(x - 1), yMundo(ypLinha + 5), xMundo(x + wq + 1), yMundo(ypLinha - 5), { color: th.series[1]!, width: 2 });
        }
        x += wq + 4;
      }
    };
    const r = risc[b.i] ?? { num: new Set<number>(), den: new Set<number>() };
    if (b.den.length) {
      linha(b.num, yp + FS / 2 + 3, r.num);
      const xa = xp + 3, xb = xp + b.w - (b.pow !== 1 ? 21 : 3);
      d.line(xMundo(xa), yMundo(yp + alt / 2), xMundo(xb), yMundo(yp + alt / 2), { color: cor, width: 1.2 });
      linha(b.den, yp + alt - FS / 2 - 5, r.den);
      if (b.pow !== 1) {
        d.text("(", xMundo(xp + 1), yMundo(yp + alt / 2), { size: 2 * FS + 6, color: cor, align: "left", weight: "300" });
        d.text(")", xMundo(xb + 1), yMundo(yp + alt / 2), { size: 2 * FS + 6, color: cor, align: "left", weight: "300" });
        d.text(String(b.pow), xMundo(xb + 10), yMundo(yp + 6), { size: 11, color: cor, align: "left", weight: "700" });
      }
    } else linha(b.num, yp + alt / 2, r.num);
    xp += b.w;
  });

  // tabela de valores parciais
  yp += alt + 22;
  const linhaTxt = (t: string, cor = th.text, peso = "400") => {
    d.text(t, 0.2, yMundo(yp), { size: 12, align: "left", color: cor, weight: peso });
    yp += 19;
  };
  linhaTxt("Valor depois de cada fator:", th.muted, "600");
  for (let i = 0; i <= fs.length; i++) {
    const v = valorApos(c, v0, i, erro);
    const u = textoUnidades(unidadesApos(c, i, erro));
    const fe = i ? ` (× ${fmt(valorFator(fs[i - 1]!), 6)})` : "";
    linhaTxt(`${i === 0 ? "início" : `fator ${i}`}: ${fmt(v, 6)} ${u}${fe}`, i <= nAp ? th.text : th.muted);
  }
  yp += 6;
  if (nAp >= fs.length) {
    const ok = unidadesConferem(c, erro);
    linhaTxt(
      ok ? `✓ unidades conferem: ${textoUnidades(c.alvo)}` : `✗ sobrou ${textoUnidades(unidadesApos(c, fs.length, erro))}, e o pedido era ${textoUnidades(c.alvo)}`,
      ok ? th.series[2]! : th.positive,
      "700",
    );
  } else linhaTxt("Rode a animação para aplicar os fatores um a um.", th.muted);
}

// ------------------------------------------------------------------ desenho: padrões do SI

function renderPadroes(d: Draw, frame: RenderFrame) {
  const { state: s, params: p, theme: th } = frame;
  const k = padrao(p);
  const tau = s[TAU]!;
  const linhas = (y0: number, ls: [string, string?, string?][]) =>
    ls
      .filter(([, cor]) => !(d.px > 1 / 34 && cor === th.muted))
      .forEach(([txt, cor, peso], i) => d.text(txt, 0.2, y0 - 0.62 * i, { size: d.px > 1 / 34 ? 9 : 12, align: "left", color: cor ?? th.text, weight: peso ?? "400" }));

  if (k === 0) {
    const L = num(p, "Lalvo", 1);
    const x0 = 1.4, x1 = 11.2;
    const xl = (dist: number) => x0 + ((x1 - x0) * dist) / L;
    d.text("O metro: a luz percorre a régua", 0.4, 11.5, { size: 14, align: "left", weight: "700" });
    // laser
    d.rect(0.2, 8.6, 1.1, 0.8, { fill: th.muted, stroke: th.text, width: 1 });
    d.text("laser", 0.75, 9.0, { size: 10, color: th.dark ? "#10151c" : "#ffffff", weight: "700" });
    d.line(x0, 9, x1, 9, { color: th.series[0]!, alpha: 0.25, width: 1 });
    d.rect(x1, 8.4, 0.18, 1.2, { fill: th.text });
    const dist = Math.min(C * tau, L);
    d.line(x0, 9, xl(dist), 9, { color: th.positive, width: 3, alpha: 0.6 });
    d.dot(xl(dist), 9, 7, th.positive);
    d.dot(xl(dist), 9, 13, th.positive, 0.25);
    // régua
    d.rect(x0, 7.2, x1 - x0, 0.7, { fill: th.dark ? "#3a3420" : "#f6e9b8", stroke: th.muted, width: 1 });
    const nCm = Math.round(L * 100);
    const passo = nCm <= 40 ? 1 : nCm <= 150 ? 5 : 10;
    for (let cm = 0; cm <= nCm; cm += passo) {
      const x = xl(cm / 100);
      const g = cm % (passo * (passo === 1 ? 5 : 2)) === 0;
      d.line(x, 7.9, x, 7.9 - (g ? 0.35 : 0.2), { color: th.text, width: 1 });
      if (g) d.text(`${cm}`, x, 7.4, { size: 9, color: th.muted });
    }
    d.text("cm", x1 + 0.25, 7.2, { size: 9, align: "left", color: th.muted });
    linhas(6.3, [
      [`τ = ${fmt(tau * 1e9, 7)} ns   (câmera lenta: 1 ns por segundo)`, th.text, "700"],
      [`distância cτ = ${fmt(C * tau, 7)} m`],
      [`comprimentos de onda do He-Ne em cτ: ${sci(ondasHeNe(C * tau), 8)}`],
      [`chegada prevista: ${fmt(L, 4)} m ÷ 299 792 458 m/s = ${fmt((L / C) * 1e9, 8)} ns`, th.accent],
      ["c é exata por definição: medir tempo é medir comprimento.", th.muted],
    ]);
  } else if (k === 1) {
    d.text("O segundo: contando ciclos do césio-133", 0.4, 11.5, { size: 14, align: "left", weight: "700" });
    // níveis hiperfinos
    d.line(0.6, 10.3, 3.0, 10.3, { color: th.text, width: 2 });
    d.line(0.6, 8.6, 3.0, 8.6, { color: th.text, width: 2 });
    d.text("F = 4", 3.15, 10.3, { size: 10, align: "left", color: th.muted });
    d.text("F = 3", 3.15, 8.6, { size: 10, align: "left", color: th.muted });
    d.arrow(1.8, 8.65, 0, 1.6, { color: th.series[4]! });
    d.text("Δν_Cs", 1.95, 9.45, { size: 10, align: "left", color: th.series[4]! });
    // onda da radiação de micro-ondas: 3 ciclos na janela, correndo com τ
    const wx0 = 4.4, wx1 = 11.6, wy = 9.45, amp = 0.75;
    d.line(wx0, wy, wx1, wy, { color: th.grid, width: 1 });
    d.plot((x) => wy + amp * Math.cos(2 * Math.PI * (3 * (x - wx0) / (wx1 - wx0) - DNU_CS * tau)), wx0, wx1, { color: th.series[4]!, width: 2, n: 240 });
    d.text("radiação da transição (9,19 GHz), em câmera lenta", (wx0 + wx1) / 2, wy - amp - 0.35, { size: 10, color: th.muted });
    const N = ciclosCesio(tau);
    const ppm = num(p, "ppm", 20);
    linhas(7.0, [
      [`ciclos contados N = ${Math.floor(N + 1e-9).toLocaleString("pt-BR")}`, th.text, "700"],
      [`tempo τ = N/Δν_Cs = ${fmt(tau * 1e9, 6)} ns`],
      ["1 s ≡ 9 192 631 770 ciclos (exato)", th.accent],
      [`quartzo de 32 768 Hz com erro de ${fmt(ppm, 3)} ppm:`, th.text, "600"],
      [`  ${fmt(atrasoQuartzo(ppm, 1), 4)} s por dia · ${fmt(atrasoQuartzo(ppm, 30), 4)} s por mês · ${fmt(atrasoQuartzo(ppm, 365.25) / 60, 4)} min por ano`],
      ["Um relógio de césio erra ~1 s em dezenas de milhões de anos.", th.muted],
    ]);
  } else {
    const mK = num(p, "mK", 1), g = num(p, "g", 9.787), BL = num(p, "BL", 400), v = num(p, "vK", 2) / 1000;
    const kb = kibble(mK, g, BL, v);
    const z = Math.min(v * tau, CURSO);
    d.text("O quilograma: balança de Kibble", 0.4, 11.5, { size: 14, align: "left", weight: "700" });
    // travessão e fios
    const yb = 10.4;
    d.polyline([[5.6, 7.4], [6.4, 7.4], [6.0, yb]], { close: true, fill: th.muted, color: th.text });
    d.line(2.4, yb, 9.6, yb, { color: th.text, width: 4 });
    d.line(3.0, yb, 3.0, 8.6, { color: th.text, width: 1 });
    d.line(2.2, 8.6, 3.8, 8.6, { color: th.text, width: 3 });
    const lado = 0.35 + 0.35 * Math.cbrt(mK);
    d.rect(3.0 - lado / 2, 8.6, lado, lado, { fill: th.series[5]!, stroke: th.text, width: 1 });
    d.text(`${fmt(mK, 3)} kg`, 3.0, 8.6 + lado + 0.3, { size: 11 });
    // ímã e bobina (deslocamento ampliado 100×)
    const zc = 8.1 + z * 100;
    d.line(9.0, yb, 9.0, zc + 0.3, { color: th.text, width: 1 });
    d.rect(8.0, 6.8, 0.45, 2.6, { fill: th.negative, alpha: 0.7 });
    d.rect(9.55, 6.8, 0.45, 2.6, { fill: th.negative, alpha: 0.7 });
    d.rect(8.55, zc - 0.25, 0.9, 0.5, { fill: th.series[1]!, stroke: th.text, width: 1 });
    d.text("ímã", 10.15, 7.0, { size: 10, align: "left", color: th.muted });
    d.text("bobina", 10.15, zc, { size: 10, align: "left", color: th.series[1]! });
    d.arrowPx(9.0, zc + 0.3, 0, 1, 26, { color: th.accent });
    d.text(`z = ${fmt(z * 1000, 4)} mm (ampliado)`, 7.6, 6.45, { size: 10, color: th.muted });
    linhas(5.5, [
      [`pesagem: B·L·I = m·g → I = ${fmt(kb.I * 1000, 5)} mA`, th.text],
      [`velocidade: U = B·L·v = ${fmt(kb.U, 5)} V (v = ${fmt(v * 1000, 3)} mm/s)`],
      [`potência elétrica U·I = ${fmt(kb.P, 5)} W = potência mecânica m·g·v`],
      [`massa medida m = U·I/(g·v) = ${fmt(kb.m, 7)} kg`, th.accent, "700"],
      [`U e I vêm de K_J = 2e/h = ${fmt(K_J / 1e9, 9)} GHz/V e de R_K = h/e²: m ∝ h`, th.muted],
      [`equivalência: f = mc²/h = ${sci(freqMassa(mK), 4)} Hz (h = ${sci(H, 9)} J·s)`, th.muted],
    ]);
  }
}

export default escalasUnidades;
