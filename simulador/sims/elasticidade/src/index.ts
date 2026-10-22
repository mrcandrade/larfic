import { clamp, defineSim, draw, formatBR, num, texNum, type Draw, type Params, type RenderFrame, type State } from "@fisilab/core";
import { derivation } from "./derivation.ts";
import {
  MATERIAIS,
  epsLateral,
  epsPermanente,
  epsY,
  material,
  moduloG,
  moduloK,
  resolveMesa,
  sigmaCurva,
  sigmaHist,
  taxas,
  type Material,
  type Mesa,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: [ε, ε_max, sentido (1 carrega, −1 descarrega, 0 parado), rompeu, w (J/m³), λ (fração da carga), x_w, y_w (m)]
const EPS = 0, EMAX = 1, DIR = 2, BROKEN = 3, WORK = 4, LAM = 5, XW = 6, YW = 7;

const modo = (p: Params) => Math.round(num(p, "modo"));
const mat = (p: Params) => material(num(p, "mat"));
const duracao = (p: Params) => Math.max(0.5, num(p, "T", 12));
/** Área da seção circular de diâmetro d (mm), em m². */
const areaD = (dmm: number) => (Math.PI * (dmm / 1000) ** 2) / 4;
export const areaBarra = (p: Params) => areaD(num(p, "d", 10));

/** Mesa: retângulo das pernas (m) e massa de água de referência. */
export const MESA_A = 1.1, MESA_B = 0.7;
export const TAMPO_A = 1.2, TAMPO_B = 0.8;
const PERNAS: [number, number][] = [
  [-MESA_A / 2, -MESA_B / 2],
  [MESA_A / 2, -MESA_B / 2],
  [MESA_A / 2, MESA_B / 2],
  [-MESA_A / 2, MESA_B / 2],
];

export function mesaDe(p: Params): Mesa {
  const k = (mat(p).E * areaBarra(p)) / Math.max(num(p, "L0", 0.75), 1e-3);
  return { pernas: PERNAS, folga: [0, 0, 0, num(p, "delta", 0.05) / 1000], k: [k, k, k, k] };
}

/** Pressão da prensa hidráulica (Pa). */
export const pressaoMax = (p: Params) => (num(p, "Fp", 35) * 1000) / areaD(num(p, "dp", 20));
/** Tensão de cisalhamento máxima da rampa (Pa). */
export const tauMax = (p: Params) => (num(p, "Fmax", 20) * 1000) / (num(p, "A", 400) * 1e-4);

export interface Medida {
  /** Deformação generalizada (adimensional) e tensão generalizada (Pa). */
  x: number;
  y: number;
  /** Força aplicada (N). */
  F: number;
  /** Deslocamento característico (m). */
  desl: number;
  /** Módulo secante (Pa). */
  mod: number;
  /** Energia por volume (J/m³). */
  w: number;
  epsP: number;
  /** Variação do diâmetro (m). */
  dlat: number;
  Fp: number[];
  contato: number;
}

/** Tudo o que a sim mede no estado atual. */
export function medir(s: State, p: Params): Medida {
  const m = mat(p);
  const md = modo(p);
  const lam = s[LAM]!;
  const vazio = { epsP: 0, dlat: 0, Fp: [0, 0, 0, 0], contato: 0 };
  if (md === 0) {
    const e = s[EPS]!, emax = s[EMAX]!;
    const sig = s[BROKEN]! > 0.5 ? 0 : sigmaHist(m, e, emax);
    return {
      ...vazio,
      x: e,
      y: sig,
      F: sig * areaBarra(p),
      desl: e * num(p, "L0", 0.2),
      mod: e > 1e-12 ? sig / e : m.E,
      w: s[WORK]!,
      epsP: s[BROKEN]! > 0.5 ? epsPermanente(m, emax) : emax > e ? epsPermanente(m, emax) : 0,
      dlat: epsLateral(m, e, emax) * (num(p, "d", 10) / 1000),
    };
  }
  if (md === 1) {
    const G = moduloG(m);
    const tau = lam * tauMax(p);
    const g = tau / G;
    return { ...vazio, x: g, y: tau, F: lam * num(p, "Fmax", 20) * 1000, desl: g * (num(p, "h", 50) / 1000), mod: G, w: (tau * g) / 2 };
  }
  if (md === 2) {
    const K = moduloK(m);
    const pr = lam * pressaoMax(p);
    const dv = pr / K;
    return { ...vazio, x: dv, y: pr, F: lam * num(p, "Fp", 35) * 1000, desl: (dv / 3) * (num(p, "aCubo", 5) / 100), mod: K, w: (pr * dv) / 2 };
  }
  const sol = resolveMesa(mesaDe(p), lam * num(p, "W", 1500), s[XW]!, s[YW]!);
  const A = areaBarra(p);
  const L = num(p, "L0", 0.75);
  const e4 = sol.u[3]! / L;
  const s4 = sol.F[3]! / A;
  return {
    ...vazio,
    x: e4,
    y: s4,
    F: lam * num(p, "W", 1500),
    desl: sol.u[3]!,
    mod: m.E,
    w: (s4 * e4) / 2,
    Fp: sol.F,
    contato: sol.contato.filter(Boolean).length,
  };
}

function passoTracao(s: State, p: Params, dt: number): State {
  const n = s.slice();
  if (n[BROKEN]! > 0.5 || n[DIR] === 0) return n;
  const m = mat(p);
  const { elastica, plastica } = taxas(m, duracao(p));
  const e = n[EPS]!, emax = n[EMAX]!, dir = n[DIR]!;
  const plastico = m.tipo === "ductil" && dir > 0 && e >= emax - 1e-15 && e >= epsY(m);
  let e1 = e + dir * (plastico ? plastica : elastica) * dt;
  // ao cruzar ε_y (ou ε_max) carregando, o resto do passo segue com a taxa plástica
  if (m.tipo === "ductil" && dir > 0 && !plastico) {
    const lim = Math.max(emax, epsY(m));
    if (e1 > lim) e1 = lim + ((e1 - lim) / elastica) * plastica;
  }
  if (dir < 0) {
    const ep = epsPermanente(m, emax);
    if (e1 <= ep) {
      e1 = ep;
      n[DIR] = 0;
    }
  }
  const s0 = sigmaHist(m, e, emax);
  if (dir > 0 && e1 >= m.er) {
    e1 = m.er;
    n[BROKEN] = 1;
  }
  const emax1 = Math.max(emax, e1);
  const s1 = sigmaHist(m, e1, emax1);
  n[WORK] = n[WORK]! + 0.5 * (s0 + s1) * (e1 - e);
  n[EPS] = e1;
  n[EMAX] = emax1;
  return n;
}

const fmt = (v: number, d = 4) => formatBR(v, d);
const MODOS = ["Tração", "Cisalhamento", "Compressão volumétrica", "Mesa de quatro pernas"];

export const elasticidade = defineSim({
  id: "elasticidade",
  title: "Elasticidade: tração, cisalhamento e compressão",
  course: "FG I",
  topic: "Equilíbrio e elasticidade",
  priority: "P1",
  summary:
    "Ensaio de tração com materiais reais (Hooke, limite elástico, encruamento, estricção e ruptura), cisalhamento e compressão hidráulica com os módulos E, G e K, e a mesa de quatro pernas, em que a força em cada perna só se determina pela elasticidade.",
  equations: [
    String.raw`\sigma = \frac{F}{A} = E\,\frac{\Delta L}{L_0} \qquad \tau = \frac{F}{A} = G\,\frac{\Delta x}{h} \qquad p = K\,\frac{|\Delta V|}{V}`,
    String.raw`G = \frac{E}{2(1+\nu)} \qquad K = \frac{E}{3(1-2\nu)} \qquad \varepsilon_{lat} = -\nu\,\varepsilon`,
    String.raw`\text{Mesa: } \sum F_i = W,\ \ \sum F_i x_i = W x_w,\ \ \sum F_i y_i = W y_w,\ \ F_i = \frac{EA}{L}\,(w_i - \delta_i)`,
  ],
  liveEquations(s, p) {
    const m = mat(p);
    const r = medir(s, p);
    switch (modo(p)) {
      case 0:
        return [
          String.raw`\sigma = \frac{F}{A} = \frac{${texNum(r.F / 1000, 4)}\ \text{kN}}{${texNum(areaBarra(p) * 1e6, 4)}\ \text{mm}^2} = ${texNum(r.y / 1e6, 4)}\ \text{MPa} \qquad \varepsilon = ${texNum(r.x * 100, 4)}\ \%`,
          String.raw`\frac{\sigma}{\varepsilon} = ${texNum(r.mod / 1e9, 4)}\ \text{GPa}\ \ (E = ${texNum(m.E / 1e9, 4)}\ \text{GPa}) \qquad \sigma_y = ${texNum(m.sy / 1e6, 4)}\ \text{MPa} \qquad \Delta L = ${texNum(r.desl * 1000, 4)}\ \text{mm}`,
        ];
      case 1:
        return [
          String.raw`\tau = \frac{F}{A} = ${texNum(r.y / 1e6, 4)}\ \text{MPa} \qquad G = \frac{E}{2(1+\nu)} = ${texNum(moduloG(m) / 1e9, 4)}\ \text{GPa}`,
          String.raw`\gamma = \frac{\tau}{G} = ${texNum(r.x, 4)}\ \text{rad} \qquad \Delta x = \gamma h = ${texNum(r.desl * 1000, 4)}\ \text{mm}`,
        ];
      case 2:
        return [
          String.raw`p = \frac{F}{\pi d_p^2/4} = ${texNum(r.y / 1e6, 4)}\ \text{MPa} \qquad K = \frac{E}{3(1-2\nu)} = ${texNum(moduloK(m) / 1e9, 4)}\ \text{GPa}`,
          String.raw`\frac{|\Delta V|}{V} = \frac{p}{K} = ${texNum(r.x * 100, 4)}\ \% \qquad \Delta a = ${texNum(r.desl * 1e6, 4)}\ \mu\text{m}`,
        ];
      default: {
        const k = mesaDe(p).k[0]!;
        return [
          String.raw`k = \frac{EA}{L} = ${texNum(k, 4)}\ \text{N/m} \qquad W = ${texNum(r.F, 4)}\ \text{N} \qquad W^* = k\,\delta = ${texNum(k * (num(p, "delta", 0.05) / 1000), 4)}\ \text{N}`,
          String.raw`F_1 = ${texNum(r.Fp[0]!, 4)},\ F_2 = ${texNum(r.Fp[1]!, 4)},\ F_3 = ${texNum(r.Fp[2]!, 4)},\ F_4 = ${texNum(r.Fp[3]!, 4)}\ \text{N} \quad \textstyle\sum = ${texNum(r.Fp.reduce((a, b) => a + b, 0), 5)}\ \text{N}`,
        ];
      }
    }
  },
  derivation,

  params: [
    { key: "modo", label: "Ensaio", unit: "", min: 0, max: 3, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "mat", label: "Material", unit: "", min: 0, max: MATERIAIS.length - 1, step: 1, default: 0, options: MATERIAIS.map((m, value) => ({ value, label: m.nome })) },
    { key: "T", label: "Duração do ensaio (rampa de carga)", unit: "s", min: 2, max: 40, step: 1, default: 12 },
    { key: "L0", label: "Tração/mesa: comprimento da barra ou da perna", unit: "m", min: 0.05, max: 3, step: 0.01, default: 0.2 },
    { key: "d", label: "Tração/mesa: diâmetro da barra ou da perna", unit: "mm", min: 1, max: 60, step: 0.5, default: 10 },
    { key: "A", label: "Cisalhamento: área da face", unit: "cm²", min: 1, max: 1000, step: 1, default: 400, log: true },
    { key: "h", label: "Cisalhamento: altura do bloco", unit: "mm", min: 5, max: 200, step: 1, default: 50 },
    { key: "Fmax", label: "Cisalhamento: força máxima", unit: "kN", min: 0.1, max: 2000, step: 0.1, default: 20, log: true },
    { key: "Fp", label: "Compressão: força no pistão", unit: "kN", min: 1, max: 500, step: 1, default: 35 },
    { key: "dp", label: "Compressão: diâmetro do pistão", unit: "mm", min: 5, max: 100, step: 1, default: 20 },
    { key: "aCubo", label: "Compressão: aresta do cubo de amostra", unit: "cm", min: 1, max: 20, step: 0.5, default: 5 },
    { key: "W", label: "Mesa: peso máximo sobre o tampo", unit: "N", min: 0, max: 5000, step: 10, default: 1500 },
    { key: "delta", label: "Mesa: folga da perna 4 (mais curta)", unit: "mm", min: 0, max: 0.5, step: 0.001, default: 0.05, live: true },
    { key: "xw", label: "Mesa: posição x do peso", unit: "m", min: -MESA_A / 2, max: MESA_A / 2, step: 0.01, default: 0 },
    { key: "yw", label: "Mesa: posição y do peso", unit: "m", min: -MESA_B / 2, max: MESA_B / 2, step: 0.01, default: 0 },
  ],

  observables: [
    { key: "x", label: "Deformação (ε, γ, |ΔV|/V ou da perna 4)", unit: "%", value: (s, p) => 100 * medir(s, p).x },
    { key: "y", label: "Tensão (σ, τ, p ou na perna 4)", unit: "MPa", value: (s, p) => medir(s, p).y / 1e6 },
    { key: "F", label: "Força aplicada (tração, cisalhamento, pistão, peso)", unit: "kN", value: (s, p) => medir(s, p).F / 1000 },
    { key: "desl", label: "Deslocamento (ΔL, Δx, Δa ou da perna 4)", unit: "mm", value: (s, p) => medir(s, p).desl * 1000 },
    { key: "mod", label: "Módulo medido (σ/ε, τ/γ, p/(|ΔV|/V))", unit: "GPa", value: (s, p) => medir(s, p).mod / 1e9 },
    { key: "epsP", label: "Tração: deformação permanente", unit: "%", value: (s, p) => 100 * medir(s, p).epsP },
    { key: "w", label: "Energia absorvida por volume", unit: "kJ/m³", value: (s, p) => medir(s, p).w / 1000 },
    { key: "dlat", label: "Tração: variação do diâmetro (Poisson)", unit: "μm", value: (s, p) => medir(s, p).dlat * 1e6 },
    { key: "F1", label: "Mesa: força na perna 1", unit: "N", value: (s, p) => medir(s, p).Fp[0]! },
    { key: "F2", label: "Mesa: força na perna 2", unit: "N", value: (s, p) => medir(s, p).Fp[1]! },
    { key: "F3", label: "Mesa: força na perna 3", unit: "N", value: (s, p) => medir(s, p).Fp[2]! },
    { key: "F4", label: "Mesa: força na perna 4 (a mais curta)", unit: "N", value: (s, p) => medir(s, p).Fp[3]! },
    { key: "contato", label: "Mesa: pernas tocando o chão", unit: "", value: (s, p) => medir(s, p).contato },
  ],
  chart: { x: "x", y: "y" },

  scenarios: [
    {
      id: "tracao",
      label: "Tração: Hooke, limite elástico e ruptura",
      params: { modo: 0, mat: 0, L0: 0.2, d: 10, T: 12 },
      guide: `### Ensaio de tração
A máquina estica o corpo de prova com deformação crescente e mede a força. O gráfico de baixo é a curva **tensão × deformação** $\\sigma = F/A$ contra $\\varepsilon = \\Delta L/L_0$; o quadro menor amplia o trecho elástico.
1. Rode com o aço. No trecho reto, confira $\\sigma/\\varepsilon = E \\approx 200$ GPa. Que alongamento $\\Delta L$ corresponde ao limite elástico de uma barra de 20 cm?
2. Depois do **limite elástico** $\\sigma_y$ a curva se encurva (escoamento e encruamento) até a **resistência** $\\sigma_u$; aí começa a estricção (o "pescoço" no meio da barra) e a ruptura.
3. Pare no meio do trecho plástico e use **Descarregar**: a volta é uma reta de inclinação $E$ e sobra uma **deformação permanente**. Recarregue e veja onde o material volta a escoar.
4. Compare vidro (frágil: reta até romper), cobre (muito dúctil) e borracha ($E$ minúsculo, grandes deformações, curva não linear).
5. Mude o diâmetro: a força de ruptura muda, a tensão de ruptura não. Por quê?`,
      predict: [
        {
          question: "Uma barra de aço é esticada além do limite elástico e depois descarregada. Ela:",
          options: [
            "volta exatamente ao comprimento original",
            "fica mais comprida do que era (deformação permanente)",
            "fica mais curta do que era",
          ],
          answer: 1,
          explanation:
            "A descarga segue uma reta de inclinação $E$, paralela ao trecho elástico, e não a curva de subida. Só a parte elástica $\\sigma/E$ é recuperada; sobra $\\varepsilon_p = \\varepsilon_{max} - \\sigma_{max}/E$.",
        },
      ],
    },
    {
      id: "cisalhamento",
      label: "Cisalhamento: apoio de borracha × aço",
      params: { modo: 1, mat: 7, A: 400, h: 50, Fmax: 20, T: 10 },
      guide: `### Módulo de cisalhamento
Uma força $F$ paralela à face superior de um bloco de área $A$ e altura $h$ o deforma num paralelogramo: $\\tau = F/A$, $\\gamma = \\Delta x/h$ e $\\tau = G\\gamma$.
1. O cenário começa com um **apoio de borracha** de ponte (20 cm × 20 cm × 5 cm). Rode e leia $\\Delta x$ para 20 kN.
2. Troque para aço com a mesma força: compare $\\Delta x$. Quantas vezes menor ele ficou? Compare com a razão $G_{aço}/G_{borracha}$.
3. Dobre a altura $h$ do bloco: $\\gamma$ não muda, mas $\\Delta x$ dobra.
4. Confira $G = E/[2(1+\\nu)]$ nas equações vivas para cada material. Por que a borracha tem $E \\approx 3G$?`,
      predict: [
        {
          question: "A mesma força horizontal age num bloco de borracha e num de aço de mesmas dimensões. O deslocamento do topo na borracha é, aproximadamente:",
          options: ["o dobro do aço", "100 vezes o do aço", "dezenas de milhares de vezes o do aço", "igual ao do aço"],
          answer: 2,
          explanation: "$\\Delta x = F h/(G A)$. Com $G_{aço} \\approx 78$ GPa e $G_{borracha} \\approx 1$ MPa, a razão é $\\approx 78\\,000$.",
        },
      ],
    },
    {
      id: "compressao",
      label: "Compressão: pressão hidráulica e módulo volumétrico",
      params: { modo: 2, mat: 7, Fp: 35, dp: 20, aCubo: 5, T: 10 },
      guide: `### Módulo volumétrico
Uma prensa hidráulica empurra um pistão e o fluido transmite a pressão $p = F/(\\pi d_p^2/4)$ a toda a superfície de um cubo de amostra. O volume diminui de $|\\Delta V|/V = p/K$.
1. Com 35 kN num pistão de 20 mm a pressão chega a $\\approx 110$ MPa, a pressão no fundo da Fossa das Marianas. Leia $|\\Delta V|/V$ da borracha.
2. Troque por aço, vidro e osso. Compare $K$: a ordem dos materiais é a mesma da ordem de $E$?
3. A borracha estica com facilidade ($E$ de poucos MPa), mas tem $K$ de alguns GPa, comparável ao da água (linha de referência no gráfico). Use $\\nu \\approx 0{,}5$ para explicar.
4. Quanto a aresta de um cubo de aço de 5 cm encolhe a 110 MPa? ($\\Delta a/a = p/3K$.)`,
      predict: [
        {
          question: "Sob a mesma pressão por todos os lados, comparada a um cubo de aço igual, a borracha perde volume:",
          options: ["dezenas de milhares de vezes mais (ela é muito mole)", "algumas dezenas de vezes mais", "o mesmo que o aço", "menos que o aço"],
          answer: 1,
          explanation:
            "Esticar a borracha é fácil porque $G$ é pequeno, mas mudar seu volume exige vencer $K = E/[3(1-2\\nu)]$, com $\\nu \\approx 0{,}5$: $K \\approx 2{,}5$ GPa contra 159 GPa do aço, uma razão de cerca de 60.",
        },
      ],
    },
    {
      id: "mesa-quatro-pernas",
      label: "Mesa de quatro pernas: estrutura indeterminada",
      params: { modo: 3, mat: 0, L0: 0.75, d: 10, W: 1500, delta: 0.05, xw: 0, yw: 0, T: 12 },
      guide: `### Quem sustenta a mesa?
Quatro forças desconhecidas e só três equações de equilíbrio: com pernas rígidas, o problema é **indeterminado**. A resposta vem da elasticidade das pernas: o tampo rígido desce como um plano, e cada perna é uma mola $k = EA/L$.
1. A perna 4 é $\\delta = 0{,}05$ mm mais curta. Rode: com pouco peso a mesa **manca** e o peso no centro fica todo nas pernas 1 e 3 (metade em cada; $F_2 = 0$).
2. A perna 4 encosta quando o peso chega a $W^* = k\\,\\delta$. Confira no gráfico (forças contra o peso) e nas equações vivas.
3. Arraste o peso pelo tampo (vista de cima) e veja as forças se redistribuírem. Com $\\delta = 0$, confira $F_i = W\\,(1/4 + x_w x_i/a^2 + y_w y_i/b^2)$.
4. Troque o aço por borracha (pés macios) ou aumente o comprimento: $k$ cai e a folga deixa de importar. Por que pés de borracha acabam com a mesa bamba?`,
      predict: [
        {
          question: "A perna 4 de uma mesa é um pouco mais curta e um peso leve está no centro. Quanto do peso a perna 2 (vizinha da perna 4, na outra diagonal) sustenta?",
          options: ["um quarto", "um terço", "metade", "nada"],
          answer: 3,
          explanation:
            "Com a perna 4 no ar, a mesa se apoia em três pernas e o centro fica sobre a diagonal 1–3. O torque em torno dessa diagonal só se anula com $F_2 = 0$: as pernas 1 e 3 levam metade cada.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "alongamento",
      prompt:
        "Uma barra de aço (E = 200 GPa) com {L0} m de comprimento e {d} mm de diâmetro é tracionada por uma força de {Fx} kN, abaixo do limite elástico. Qual o alongamento, em mm?",
      vary: { L0: [0.5, 3, 2], d: [10, 20, 0], Fx: [2, 15, 1] },
      fixed: { modo: 0, mat: 0 },
      answer: { label: "ΔL", unit: "mm", compute: (p) => ((num(p, "Fx") * 1000 * num(p, "L0")) / (areaBarra(p) * 200e9)) * 1000 },
      hint: "ΔL = F L₀/(E A), com A = π d²/4.",
    },
    {
      id: "ruptura",
      prompt: "Um fio de alumínio 6061-T6 (limite de resistência 310 MPa) tem {d} mm de diâmetro. Qual a maior força de tração que ele suporta, em kN?",
      vary: { d: [1, 12, 1] },
      fixed: { modo: 0, mat: 1 },
      answer: { label: "F", unit: "kN", compute: (p) => (310e6 * areaBarra(p)) / 1000 },
    },
    {
      id: "cisalhamento",
      prompt:
        "Um apoio de borracha (G = 1,0 MPa) tem face de {A} cm² e altura de {h} mm. Uma força horizontal de {Fmax} kN age no topo. Qual o deslocamento do topo em relação à base, em mm?",
      vary: { A: [100, 900, 0], h: [20, 100, 0], Fmax: [1, 20, 1] },
      fixed: { modo: 1, mat: 7 },
      answer: { label: "Δx", unit: "mm", compute: (p) => ((num(p, "Fmax") * 1000 * (num(p, "h") / 1000)) / (1e6 * num(p, "A") * 1e-4)) * 1000 },
      hint: "Δx = F h/(G A); cuidado com cm² e mm.",
    },
    {
      id: "compressao",
      prompt:
        "Uma prensa hidráulica empurra com {Fp} kN um pistão de {dp} mm de diâmetro, e o fluido comprime um cubo de cobre (E = 117 GPa, ν = 0,34). Qual a variação relativa de volume do cubo, em %?",
      vary: { Fp: [5, 200, 0], dp: [15, 60, 0] },
      fixed: { modo: 2, mat: 2 },
      answer: { label: "|ΔV|/V", unit: "%", compute: (p) => (100 * pressaoMax(p)) / moduloK(material(2)) },
      hint: "p = F/(π d²/4) e K = E/[3(1 − 2ν)].",
    },
    {
      id: "mesa",
      prompt:
        "Uma mesa tem pernas de aço (E = 200 GPa) maciças, com {L0} m de comprimento e {d} mm de diâmetro; a perna 4 é {delta} mm mais curta que as outras. Com o peso no centro do tampo, a partir de que peso, em N, a perna 4 toca o chão?",
      vary: { L0: [0.6, 0.9, 2], d: [6, 20, 0], delta: [0.01, 0.2, 3] },
      fixed: { modo: 3, mat: 0, xw: 0, yw: 0 },
      answer: { label: "W*", unit: "N", compute: (p) => mesaDe(p).k[0]! * (num(p, "delta") / 1000) },
      hint: "Com três pernas, o centro fica na diagonal 1–3 e o tampo desce W/k na posição da perna 4.",
    },
  ],

  init: (p) => [0, 0, 1, 0, 0, 0, clamp(num(p, "xw"), -MESA_A / 2, MESA_A / 2), clamp(num(p, "yw"), -MESA_B / 2, MESA_B / 2)],
  step(s, p, _t, dt) {
    if (modo(p) === 0) return passoTracao(s, p, dt);
    const n = s.slice();
    n[LAM] = Math.min(1, n[LAM]! + dt / duracao(p));
    return n;
  },
  dt: 0.01,
  sampleEvery: 2,
  tEnd: 300,
  stopWhen(s, p) {
    const md = modo(p);
    if (md === 0) return s[BROKEN]! > 0.5 ? -1 : 1;
    const r = 1 - s[LAM]!;
    if (md === 1) return Math.min(r, 1 - (s[LAM]! * tauMax(p)) / mat(p).tauLim);
    return r;
  },

  actions: [
    {
      id: "descarregar",
      label: "Tração: descarregar",
      run: (s, p) => (modo(p) === 0 && s[BROKEN]! < 0.5 && s[EPS]! > 0 ? Object.assign(s.slice(), { [DIR]: -1 }) : s),
      active: (s) => s[DIR] === -1,
    },
    {
      id: "carregar",
      label: "Tração: carregar",
      run: (s, p) => (modo(p) === 0 && s[BROKEN]! < 0.5 ? Object.assign(s.slice(), { [DIR]: 1 }) : s),
      active: (s) => s[DIR] === 1,
    },
    {
      id: "centro",
      label: "Mesa: peso no centro",
      run: (s, p) => (modo(p) === 3 ? Object.assign(s.slice(), { [XW]: 0, [YW]: 0 }) : s),
    },
  ],

  pointer: {
    down(s, p, pt) {
      if (modo(p) !== 3) return undefined;
      const q = mundoParaMesa(pt.x, pt.y);
      if (Math.abs(q[0]) > TAMPO_A / 2 + 0.05 || Math.abs(q[1]) > TAMPO_B / 2 + 0.05) return undefined;
      return moverPeso(s, q);
    },
    move(s, p, pt, dragging) {
      if (!dragging || modo(p) !== 3) return undefined;
      return moverPeso(s, mundoParaMesa(pt.x, pt.y));
    },
    cursor(_s, p, pt) {
      if (modo(p) !== 3) return undefined;
      const q = mundoParaMesa(pt.x, pt.y);
      return Math.abs(q[0]) <= TAMPO_A / 2 && Math.abs(q[1]) <= TAMPO_B / 2 ? "grab" : undefined;
    },
  },

  viewport: () => ({ xMin: 0, xMax: 12, yMin: 0, yMax: 10 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    switch (modo(frame.params)) {
      case 0:
        return renderTracao(d, frame);
      case 1:
        return renderCisalhamento(d, frame);
      case 2:
        return renderCompressao(d, frame);
      default:
        return renderMesa(d, frame);
    }
  },
});

// ------------------------------------------------------------------ desenho: utilidades

/** Caixa do gráfico inferior (mundo). */
const G0 = { x0: 1.35, x1: 11.6, y0: 0.75, y1: 4.55 };

function passoBonito(max: number): number {
  const raw = max / 4;
  const p10 = 10 ** Math.floor(Math.log10(raw));
  const m = raw / p10;
  return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p10;
}

interface Eixos {
  X: (v: number) => number;
  Y: (v: number) => number;
}

function eixos(d: Draw, box: typeof G0, xmax: number, ymax: number, xl: string, yl: string, pequeno = false): Eixos {
  const th = d.theme;
  const X = (v: number) => box.x0 + ((box.x1 - box.x0) * v) / xmax;
  const Y = (v: number) => box.y0 + ((box.y1 - box.y0) * v) / ymax;
  d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { fill: th.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", stroke: th.muted, width: 1 });
  const sz = pequeno ? 9 : 10;
  const px = passoBonito(xmax), py = passoBonito(ymax);
  for (let v = px; v <= xmax * 1.0001; v += px) {
    d.line(X(v), box.y0, X(v), box.y1, { color: th.grid, width: 1 });
    if (!pequeno || v + px > xmax * 1.0001) d.text(fmt(v, 3), X(v), box.y0 - 0.22, { size: sz, color: th.muted });
  }
  for (let v = py; v <= ymax * 1.0001; v += py) {
    d.line(box.x0, Y(v), box.x1, Y(v), { color: th.grid, width: 1 });
    if (!pequeno || v + py > ymax * 1.0001) d.text(fmt(v, 3), box.x0 - 0.08, Y(v), { size: sz, color: th.muted, align: "right" });
  }
  d.text(xl, box.x1, box.y0 - (pequeno ? 0.22 : 0.55), { size: sz + 1, align: "right", color: th.text, dx: pequeno ? -26 : 0 });
  d.text(yl, box.x0 + 0.1, box.y1 - 0.2, { size: sz + 1, align: "left", color: th.text, weight: "600" });
  return { X, Y };
}

function titulo(d: Draw, t: string, sub: string) {
  d.text(t, 0.25, 9.7, { size: 14, align: "left", weight: "700" });
  d.text(sub, 0.25, 9.25, { size: 11, align: "left", color: d.theme.muted });
}

/** Ampliação (potência de 10) para tornar visível uma deformação pequena. */
export function ampliacao(def: number, alvo = 0.25): number {
  if (!(def > 0) || def >= alvo) return 1;
  return 10 ** Math.floor(Math.log10(alvo / def));
}
const ampTxt = (a: number) => (a > 1 ? `deformação ampliada ${fmt(a, 2)}×` : "deformação em escala real");

// ------------------------------------------------------------------ tração

function renderTracao(d: Draw, frame: RenderFrame) {
  const { state: s, params: p, theme: th, trail } = frame;
  const m = mat(p);
  const e = s[EPS]!, emax = s[EMAX]!;
  const roto = s[BROKEN]! > 0.5;
  const r = medir(s, p);
  titulo(d, `Tração: ${m.nome}`, `L₀ = ${fmt(num(p, "L0", 0.2), 3)} m · d = ${fmt(num(p, "d", 10), 3)} mm · E = ${fmt(m.E / 1e9, 3)} GPa`);

  // corpo de prova (comprimento em escala real até 50%; a borracha é reescalada para caber)
  const yc = 7.0;
  const base = 6.2 / Math.max(1, (1 + Math.min(e, m.er)) / 1.5);
  const Lc = base * (1 + e);
  const x0 = 1.6;
  const meia0 = 0.32;
  const lat = 1 + epsLateral(m, e, emax);
  const f = m.tipo === "ductil" && emax > m.eu ? Math.min(1, (emax - m.eu) / (m.er - m.eu)) : 0;
  const perfil = (u: number) => meia0 * lat * (1 - 0.45 * f * Math.exp(-(((u - 0.5) / 0.08) ** 2)));
  // garras
  d.rect(0.5, yc - 0.75, 1.1, 1.5, { fill: th.muted, stroke: th.text, width: 1 });
  d.rect(x0 + Lc, yc - 0.75, 1.1, 1.5, { fill: th.muted, stroke: th.text, width: 1 });
  const peca = (u0: number, u1: number, dx: number) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const u = u0 + ((u1 - u0) * i) / 40;
      pts.push([x0 + u * Lc + dx, yc + perfil(u)]);
    }
    for (let i = 40; i >= 0; i--) {
      const u = u0 + ((u1 - u0) * i) / 40;
      pts.push([x0 + u * Lc + dx, yc - perfil(u)]);
    }
    d.polyline(pts, { close: true, fill: th.series[0]!, color: th.text, width: 1, alpha: 0.9 });
  };
  if (roto) {
    peca(0, 0.495, -0.08);
    peca(0.505, 1, 0.08);
    d.text("ROMPEU", x0 + Lc / 2, yc + 1.05, { size: 13, color: th.positive, weight: "700" });
  } else peca(0, 1, 0);
  // força
  if (r.F > 0) {
    d.arrowPx(x0 + Lc + 1.1, yc, 1, 0, 34, { color: th.accent, width: 2.5 });
    d.arrowPx(0.5, yc, -1, 0, 0, { color: th.accent });
  }
  d.text(`F = ${fmt(r.F / 1000, 4)} kN`, x0 + Lc / 2, yc - 1.05, { size: 12, weight: "600", color: th.accent });
  d.text(`ΔL = ${fmt(r.desl * 1000, 4)} mm · Δd = ${fmt(r.dlat * 1e6, 3)} μm`, x0 + Lc / 2, yc - 1.5, { size: 11, color: th.muted });
  const estado = roto
    ? "ruptura"
    : s[DIR] === 0
      ? "descarregado"
      : m.tipo === "ductil" && emax > m.eu
        ? "estricção"
        : m.tipo === "ductil" && emax > epsY(m)
          ? e < emax ? "regime elástico (recarga/descarga)" : "escoamento e encruamento"
          : "regime elástico";
  d.text(estado, 11.8, 9.7, { size: 12, align: "right", weight: "700", color: roto ? th.positive : th.series[2]! });

  // curva σ × ε
  const xmax = 100 * m.er * 1.08;
  const ymax = (m.tipo === "ductil" ? m.su : sigmaCurva(m, m.er)) / 1e6 * 1.15;
  const { X, Y } = eixos(d, G0, xmax, ymax, "ε (%)", "σ (MPa)");
  d.plot((x) => sigmaCurva(m, x / 100) / 1e6, 0, 100 * m.er, { color: th.muted, dash: [5, 4], width: 1.2, n: 300 } as never);
  const curva = (xs: number) => Y(sigmaCurva(m, xs / 100) / 1e6);
  // a função plot recebe x do mundo; redesenha em coordenadas do gráfico
  const pts: [number, number][] = [];
  for (let i = 0; i <= 300; i++) {
    const xv = (100 * m.er * i) / 300;
    pts.push([X(xv), curva(xv)]);
  }
  d.polyline(pts, { color: th.muted, dash: [5, 4], width: 1.2 });
  // caminho percorrido (com descargas)
  const cam: [number, number][] = trail.map((q) => [X(100 * q[EPS]!), Y((q[BROKEN]! > 0.5 ? 0 : sigmaHist(m, q[EPS]!, q[EMAX]!)) / 1e6)]);
  cam.push([X(100 * e), Y(r.y / 1e6)]);
  d.polyline(cam, { color: th.accent, width: 2.5 });
  d.dot(X(100 * e), Y(r.y / 1e6), 5, th.accent);
  if (m.tipo !== "borracha") {
    d.line(G0.x0, Y(m.sy / 1e6), G0.x1, Y(m.sy / 1e6), { color: th.series[2]!, dash: [3, 3], width: 1 });
    d.text(m.tipo === "fragil" ? "resistência (ruptura frágil)" : "limite elástico σ_y", G0.x1 - 0.1, Y(m.sy / 1e6) + (m.tipo === "fragil" ? 0.2 : -0.2), { size: 10, align: "right", color: th.series[2]! });
  }
  if (m.tipo === "ductil") {
    d.line(G0.x0, Y(m.su / 1e6), G0.x1, Y(m.su / 1e6), { color: th.positive, dash: [3, 3], width: 1 });
    d.text("limite de resistência σ_u", G0.x1 - 0.1, Y(m.su / 1e6) + 0.2, { size: 10, align: "right", color: th.positive });
    // ampliação do trecho elástico
    const box = { x0: 6.2, x1: 9.0, y0: 1.25, y1: 2.95 };
    const ex = 100 * epsY(m) * 3;
    const ey = (m.sy / 1e6) * 1.25;
    d.rect(box.x0 - 0.05, box.y0 - 0.05, box.x1 - box.x0 + 0.1, box.y1 - box.y0 + 0.1, { fill: th.dark ? "#141b26" : "#ffffff" });
    const z = eixos(d, box, ex, ey, "ε (%)", "", true);
    const zp: [number, number][] = [];
    for (let i = 0; i <= 120; i++) {
      const xv = (ex * i) / 120;
      zp.push([z.X(xv), z.Y(Math.min(ey, sigmaCurva(m, xv / 100) / 1e6))]);
    }
    d.polyline(zp, { color: th.muted, dash: [4, 3], width: 1 });
    const zc = trail
      .filter((q) => 100 * q[EPS]! <= ex)
      .map((q): [number, number] => [z.X(100 * q[EPS]!), z.Y(Math.min(ey, sigmaHist(m, q[EPS]!, q[EMAX]!) / 1e6))]);
    if (100 * e <= ex) zc.push([z.X(100 * e), z.Y(Math.min(ey, r.y / 1e6))]);
    d.polyline(zc, { color: th.accent, width: 2 });
    d.text(`trecho elástico: inclinação E`, (box.x0 + box.x1) / 2, box.y1 + 0.2, { size: 9, color: th.muted });
  }
}

// ------------------------------------------------------------------ cisalhamento

function renderCisalhamento(d: Draw, frame: RenderFrame) {
  const { state: s, params: p, theme: th } = frame;
  const m = mat(p);
  const r = medir(s, p);
  const G = moduloG(m);
  const gFinal = Math.min(tauMax(p), m.tauLim) / G;
  const amp = ampliacao(Math.tan(gFinal) || gFinal, 0.35);
  titulo(d, `Cisalhamento: ${m.nome}`, `G = ${fmt(G / 1e9, 4)} GPa · A = ${fmt(num(p, "A", 400), 4)} cm² · h = ${fmt(num(p, "h", 50), 3)} mm`);
  const yb = 5.6, H = 2.4, W0 = 3.6, xb = 3.0;
  d.support(xb - 0.6, yb, xb + W0 + 0.6, yb, { color: th.muted });
  const dx = H * Math.min(0.9, r.x * amp);
  d.polyline([[xb, yb], [xb + W0, yb], [xb + W0 + dx, yb + H], [xb + dx, yb + H]], { close: true, fill: th.series[m.tipo === "borracha" ? 4 : 0]!, color: th.text, width: 1.2, alpha: 0.85 });
  d.polyline([[xb, yb], [xb, yb + H], [xb + W0, yb + H], [xb + W0, yb]], { color: th.muted, dash: [4, 4], width: 1 });
  d.rect(xb + dx - 0.1, yb + H, W0 + 0.2, 0.2, { fill: th.muted });
  if (r.F > 0) d.arrowPx(xb + dx + W0 + 0.15, yb + H + 0.1, 1, 0, 40, { color: th.accent, width: 2.5 });
  d.text("F", xb + dx + W0 + 0.35, yb + H + 0.45, { size: 12, color: th.accent, weight: "700" });
  // ângulo γ
  if (dx > 0.05) {
    d.line(xb, yb, xb + dx, yb + H, { color: th.positive, width: 1.5 });
    d.text("γ", xb + 0.25, yb + 0.85, { size: 12, color: th.positive, weight: "700" });
  }
  const tx = 8.0;
  [
    [`F = ${fmt(r.F / 1000, 4)} kN`, th.accent],
    [`τ = F/A = ${fmt(r.y / 1e6, 4)} MPa`, th.text],
    [`γ = τ/G = ${fmt(r.x, 4)} rad`, th.text],
    [`Δx = γh = ${fmt(r.desl * 1000, 4)} mm`, th.text],
    [ampTxt(amp), th.muted],
  ].forEach(([t, c], i) => d.text(t!, tx, 8.4 - 0.55 * i, { size: 12, align: "left", color: c }));
  if (s[LAM]! * tauMax(p) >= m.tauLim * 0.999) d.text("limite de cisalhamento atingido", tx, 5.6, { size: 12, align: "left", color: th.positive, weight: "700" });

  const tmax = Math.max(tauMax(p), 1) / 1e6;
  const ymax = Math.min(tmax, m.tauLim / 1e6) * 1.15;
  const xmax = (ymax * 1e6) / G;
  const unid = xmax < 0.01 ? 1e3 : 1;
  const { X, Y } = eixos(d, G0, xmax * unid, ymax, unid > 1 ? "γ (mrad)" : "γ (rad)", "τ (MPa)");
  d.line(X(0), Y(0), X(xmax * unid), Y(ymax), { color: th.muted, dash: [5, 4], width: 1.2 });
  d.line(X(0), Y(0), X(r.x * unid), Y(r.y / 1e6), { color: th.accent, width: 2.5 });
  d.dot(X(r.x * unid), Y(r.y / 1e6), 5, th.accent);
  if (m.tauLim / 1e6 < ymax) {
    d.line(G0.x0, Y(m.tauLim / 1e6), G0.x1, Y(m.tauLim / 1e6), { color: th.positive, dash: [3, 3], width: 1 });
    d.text("limite de cisalhamento", G0.x1 - 0.1, Y(m.tauLim / 1e6) - 0.2, { size: 10, align: "right", color: th.positive });
  }
  d.text(`inclinação G = ${fmt(G / 1e9, 4)} GPa`, X(xmax * unid * 0.45), Y(ymax * 0.45) + 0.35, { size: 10, align: "right", color: th.muted });
}

// ------------------------------------------------------------------ compressão

const K_AGUA = 2.2e9;

function renderCompressao(d: Draw, frame: RenderFrame) {
  const { state: s, params: p, theme: th } = frame;
  const m = mat(p);
  const r = medir(s, p);
  const K = moduloK(m);
  const pf = pressaoMax(p);
  const amp = ampliacao(pf / K / 3, 0.12);
  titulo(d, `Compressão hidráulica: ${m.nome}`, `K = ${fmt(K / 1e9, 4)} GPa · pistão de ${fmt(num(p, "dp", 20), 3)} mm · cubo de ${fmt(num(p, "aCubo", 5), 3)} cm`);
  // câmara
  const cx = 3.6, y0 = 5.2, wC = 4.4, hC = 2.9;
  d.rect(cx - wC / 2 - 0.2, y0 - 0.2, wC + 0.4, hC + 0.2, { fill: th.muted });
  d.rect(cx - wC / 2, y0, wC, hC, { fill: th.negative, alpha: 0.18 });
  // pistão
  const yp = y0 + hC - 0.15 * s[LAM]!;
  d.rect(cx - 0.45, yp, 0.9, 1.1, { fill: th.muted, stroke: th.text, width: 1 });
  d.rect(cx - wC / 2 - 0.2, y0 + hC, wC / 2 - 0.25, 0.2, { fill: th.muted });
  d.rect(cx + 0.45, y0 + hC, wC / 2 - 0.25, 0.2, { fill: th.muted });
  if (r.F > 0) d.arrowPx(cx, yp + 1.1 + 40 / frame.scale, 0, -1, 36, { color: th.accent, width: 2.5 });
  d.text("F", cx + 0.3, yp + 1.5, { size: 12, color: th.accent, weight: "700", align: "left" });
  // cubo (encolhimento ampliado)
  const a0 = 1.5;
  const a = a0 * (1 - Math.min(0.5, (r.x / 3) * amp));
  d.rect(cx - a0 / 2, y0 + 0.5, a0, a0, { stroke: th.muted, dash: [4, 4], width: 1 });
  d.rect(cx - a / 2, y0 + 0.5 + (a0 - a) / 2, a, a, { fill: th.series[m.tipo === "borracha" ? 4 : 0]!, stroke: th.text, width: 1.2 });
  // setas de pressão em todas as faces
  if (r.y > 0)
    for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const ccx = cx, ccy = y0 + 0.5 + a0 / 2;
      d.arrowPx(ccx - ux * (a / 2) - ux * (22 / frame.scale), ccy - uy * (a / 2) - uy * (22 / frame.scale), ux, uy, 18, { color: th.accent, width: 1.8 });
    }
  const tx = 6.6;
  const prof = r.y / (1025 * 9.81) / 1000;
  [
    [`F = ${fmt(r.F / 1000, 4)} kN  →  p = ${fmt(r.y / 1e6, 4)} MPa`, th.accent],
    [`|ΔV|/V = p/K = ${fmt(r.x * 100, 4)} %`, th.text],
    [`Δa = ${fmt(r.desl * 1e6, 4)} μm na aresta`, th.text],
    [`profundidade no mar com essa pressão: ${fmt(prof, 3)} km`, th.muted],
    [ampTxt(amp), th.muted],
  ].forEach(([t, c], i) => d.text(t!, tx, 8.4 - 0.55 * i, { size: 12, align: "left", color: c }));

  const ymax = Math.max(pf, 1) / 1e6 * 1.1;
  const xmax = 100 * Math.max((pf * 1.1) / K, (pf * 1.1) / K_AGUA * (K < K_AGUA * 3 ? 1 : 0), 1e-9);
  const { X, Y } = eixos(d, G0, xmax, ymax, "|ΔV|/V (%)", "p (MPa)");
  const reta = (Km: number) => {
    const xe = Math.min(xmax, (100 * ymax * 1e6) / Km);
    return [X(0), Y(0), X(xe), Y((xe / 100) * Km / 1e6)] as const;
  };
  const ra = reta(K_AGUA);
  d.line(ra[0], ra[1], ra[2], ra[3], { color: th.series[0]!, dash: [3, 4], width: 1.2 });
  d.text("água (K = 2,2 GPa)", ra[2] - 0.1, ra[3] - 0.25, { size: 10, align: "right", color: th.series[0]! });
  const rm = reta(K);
  d.line(rm[0], rm[1], rm[2], rm[3], { color: th.muted, dash: [5, 4], width: 1.2 });
  d.line(X(0), Y(0), X(100 * r.x), Y(r.y / 1e6), { color: th.accent, width: 2.5 });
  d.dot(X(100 * r.x), Y(r.y / 1e6), 5, th.accent);
}

// ------------------------------------------------------------------ mesa

/** Vista de cima: centro e escala (unidades do palco por metro). */
const MC = { x: 6, y: 7.05, k: 4.0 };
export const mundoParaMesa = (x: number, y: number): [number, number] => [(x - MC.x) / MC.k, (y - MC.y) / MC.k];
const mesaParaMundo = (x: number, y: number): [number, number] => [MC.x + x * MC.k, MC.y + y * MC.k];

function moverPeso(s: State, q: [number, number]): State {
  const n = s.slice();
  n[XW] = clamp(q[0], -MESA_A / 2, MESA_A / 2);
  n[YW] = clamp(q[1], -MESA_B / 2, MESA_B / 2);
  return n;
}

function renderMesa(d: Draw, frame: RenderFrame) {
  const { state: s, params: p, theme: th } = frame;
  const m: Material = mat(p);
  const r = medir(s, p);
  const mesa = mesaDe(p);
  const k = mesa.k[0]!;
  const Wmax = num(p, "W", 1500);
  d.text("Mesa de quatro pernas (vista de cima)", 0.25, 9.7, { size: 14, align: "left", weight: "700" });
  d.text(`pernas de ${m.nome.toLowerCase()} · k = EA/L = ${fmt(k, 3)} N/m`, 0.25, 9.25, { size: 11, align: "left", color: th.muted });
  const [tx0, ty0] = mesaParaMundo(-TAMPO_A / 2, -TAMPO_B / 2);
  d.rect(tx0, ty0, TAMPO_A * MC.k, TAMPO_B * MC.k, { fill: th.series[5]!, alpha: 0.25, stroke: th.text, width: 1.2 });
  const Fm = Math.max(Wmax / 2, 1);
  PERNAS.forEach(([x, y], i) => {
    const [X, Y] = mesaParaMundo(x, y);
    const F = r.Fp[i]!;
    const toca = F > 1e-9 * Math.max(Wmax, 1) || (r.contato > 0 && i < 3 && r.F === 0);
    const cor = F > 0 ? th.positive : th.muted;
    d.circle(X, Y, 0.12 + 0.3 * Math.sqrt(F / Fm), { fill: cor, alpha: 0.35 });
    d.circle(X, Y, 0.1, { fill: toca ? th.text : th.dark ? "#10151c" : "#ffffff", stroke: th.text, width: 1.2 });
    const acima = y > 0;
    const tx = X + (x > 0 ? 0.25 : -0.25);
    const al = x > 0 ? "left" : "right";
    d.text(`perna ${i + 1}${i === 3 ? ` (−${fmt(num(p, "delta", 0.05), 3)} mm)` : ""}`, tx, Y + (acima ? 0.38 : -0.38), { size: 10, align: al, color: th.muted });
    d.text(`${fmt(F, 4)} N`, tx, Y + (acima ? 0.0 : 0.0), { size: 12, align: al, weight: "700", color: F > 0 ? th.text : th.muted });
    d.text(F > 0 ? `u = ${fmt(r.Fp[i]! / k * 1e6, 3)} μm` : "no ar", tx, Y + (acima ? -0.38 : 0.38), { size: 10, align: al, color: th.muted });
  });
  // diagonal 1–3 (eixo de báscula quando a perna 4 está no ar)
  if (r.contato === 3) {
    const a = mesaParaMundo(...PERNAS[0]!), b = mesaParaMundo(...PERNAS[2]!);
    d.line(a[0], a[1], b[0], b[1], { color: th.muted, dash: [5, 4], width: 1 });
  }
  const [wx, wy] = mesaParaMundo(s[XW]!, s[YW]!);
  d.circle(wx, wy, 0.32, { fill: th.accent, alpha: 0.85, stroke: th.text, width: 1 });
  d.text("W", wx, wy, { size: 11, weight: "700", color: "#ffffff" });
  d.text(`W = ${fmt(r.F, 4)} N (arraste)`, wx, wy - 0.55, { size: 10, color: th.accent });
  d.text(r.contato === 4 ? "4 pernas no chão" : `${r.contato} pernas no chão: a mesa manca`, 11.8, 9.7, { size: 12, align: "right", weight: "700", color: r.contato === 4 ? th.series[2]! : th.positive });

  // forças nas pernas em função do peso, na posição atual
  const ymax = Math.max(Wmax * 0.6, 1);
  const { X, Y } = eixos(d, G0, Math.max(Wmax, 1), ymax, "peso W (N)", "F nas pernas (N)");
  const N = 80;
  const curvas: [number, number][][] = [[], [], [], []];
  for (let i = 0; i <= N; i++) {
    const W = (Wmax * i) / N;
    const sol = resolveMesa(mesa, W, s[XW]!, s[YW]!);
    sol.F.forEach((F, j) => curvas[j]!.push([X(W), Y(Math.min(F, ymax))]));
  }
  curvas.forEach((c, j) => {
    d.polyline(c, { color: th.series[j]!, width: j === 3 ? 2.6 : 1.8, dash: j === 1 ? [6, 4] : undefined });
    const ult = c[c.length - 1]!;
    d.text(`F${j + 1}`, ult[0] + 0.1, ult[1], { size: 10, align: "left", color: th.series[j]!, weight: "700" });
  });
  const Wst = k * (num(p, "delta", 0.05) / 1000);
  if (Wst > 0 && Wst < Wmax && Math.abs(s[XW]!) < 1e-9 && Math.abs(s[YW]!) < 1e-9) {
    d.line(X(Wst), G0.y0, X(Wst), G0.y1, { color: th.series[3]!, dash: [3, 3], width: 1 });
    d.text("W* = kδ", X(Wst) + 0.08, G0.y1 - 0.55, { size: 10, align: "left", color: th.series[3]! });
  }
  d.line(X(r.F), G0.y0, X(r.F), G0.y1, { color: th.accent, width: 1.2, alpha: 0.6 });
}

export default elasticidade;
