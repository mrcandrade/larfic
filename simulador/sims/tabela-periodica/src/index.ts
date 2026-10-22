import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type WorldPoint } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { derivation } from "./derivation.ts";
import { GAPS_1914, KALPHA_KEV, MASS_INVERSIONS, NAMES, SYMBOLS } from "./data.ts";
import {
  C,
  H,
  L_LETTERS,
  MADELUNG,
  NOBLE,
  QE,
  RYDBERG_EV,
  ZDATA,
  ZMAX,
  block,
  capacity,
  configString,
  configuration,
  e1eV,
  electronQN,
  fillWell,
  hundBoxes,
  hundTerm,
  ionization,
  kTheory,
  label,
  moseleyE,
  moseleyFit,
  position,
  radius,
  slaterZeff,
  sqrtF,
  unpaired,
  wellDensity,
  wellSummary,
  zeffFromIE,
} from "./physics.ts";

export * from "./physics.ts";
export * from "./data.ts";

export interface AtomState {
  /** Elemento escolhido (pode mudar clicando na tabela ou nos gráficos). */
  Z: number;
  /** Elétrons já colocados na animação de preenchimento (= Z quando pronta). */
  fill: number;
  acc: number;
}

export const mode = (p: Params) => Math.round(num(p, "modo"));
const realCfg = (p: Params) => num(p, "real", 1) > 0.5;
const dimOf = (p: Params) => (num(p, "dim", 1) > 1.5 ? 2 : 1);
const pauliOn = (p: Params) => num(p, "pauli", 1) > 0.5;
const nOf = (p: Params) => clamp(Math.round(num(p, "N", 7)), 1, 40);
const STEP_S = 0.35;
const MOS_RANGE: [number, number] = [10, 84];

/** Energia Kα (keV): dado tabelado, ou a previsão de Bohr–Moseley se não houver dado. */
export const kalpha = (Z: number) => KALPHA_KEV[Z] ?? moseleyE(Z);
const elName = (Z: number) => `${NAMES[Z - 1] ?? "?"} (${SYMBOLS[Z - 1] ?? "?"})`;
const LUM = ["s", "p", "d", "f"];

export const tabelaPeriodica = defineSim<AtomState>({
  id: "tabela-periodica",
  title: "Átomos com muitos elétrons e a tabela periódica",
  course: "FG IV",
  topic: "Átomos",
  priority: "P1",
  summary:
    "Monte a configuração eletrônica de cada elemento pelo princípio de exclusão e pela regra de Hund, ponha N elétrons num poço quântico, veja a periodicidade da energia de ionização e do raio (dados reais) e confira a lei de Moseley nas linhas Kα.",
  derivation,
  equations: [
    String.raw`(n,\ l,\ m_l,\ m_s): \quad l = 0, \dots, n-1, \quad m_l = -l, \dots, l, \quad m_s = \pm\tfrac12 \quad\Rightarrow\quad 2(2l+1)\ \text{elétrons por subcamada}`,
    String.raw`\text{Madelung: } n + l \text{ crescente; empate: } n \text{ crescente} \qquad \text{Hund: máximo de spins paralelos}`,
    String.raw`\text{poço: } E = \frac{h^2}{8mL^2}\,n^2\ \ (\text{1D}), \quad \frac{h^2}{8mL^2}\,(n_x^2 + n_y^2)\ \ (\text{2D}) \qquad \text{no máximo 2 elétrons por estado espacial}`,
    String.raw`\text{Moseley: } \sqrt{f_{K\alpha}} = \sqrt{\tfrac34 c R_\infty}\,(Z - 1) \qquad E_{K\alpha} \approx 10{,}2\ \text{eV}\,(Z-1)^2`,
  ],
  liveEquations(s, p) {
    const Z = s.Z;
    switch (mode(p)) {
      case 0: {
        const t = hundTerm(Z, realCfg(p));
        return [
          String.raw`Z = ${Z}:\ \ \text{${configString(Z, realCfg(p)).replace(/[⁰¹²³⁴⁵⁶⁷⁸⁹]+/g, (m) => `}^{${toDigits(m)}}\\text{`)}}`,
          String.raw`\text{desemparelhados} = ${unpaired(Z, realCfg(p))} \Rightarrow S = ${texNum(t.S)},\ \ L = ${t.L},\ \ J = ${texNum(t.J)} \quad (^{${2 * t.S + 1}}${"SPDFGHIKLMNOQ"[t.L] ?? "?"}_{${Number.isInteger(t.J) ? t.J : `${Math.round(2 * t.J)}/2`}})`,
        ];
      }
      case 1: {
        const N = nOf(p), dim = dimOf(p), L = num(p, "L", 1);
        const w = wellSummary(N, dim, pauliOn(p));
        const E1 = e1eV(L);
        return [
          String.raw`E_1 = \frac{h^2}{8mL^2} = ${texNum(E1, 4)}\ \text{eV} \quad (L = ${texNum(L)}\ \text{nm})`,
          String.raw`E_{tot} = ${texNum(w.Etot, 4)}\,E_1 = ${texNum(w.Etot * E1, 4)}\ \text{eV} \qquad E_{máx} = ${texNum(w.EF, 4)}\,E_1 \qquad \Delta E_{mín} = ${texNum(w.dE, 4)}\,E_1 = ${texNum(w.dE * E1, 4)}\ \text{eV}`,
          String.raw`\text{sem Pauli: } E_{tot} = N E_1 ${dim === 2 ? "\\cdot 2" : ""} = ${texNum(N * (dim === 2 ? 2 : 1), 4)}\,E_1`,
        ];
      }
      case 2: {
        const z = Math.min(Z, ZDATA);
        const sl = slaterZeff(z);
        const I = ionization(z);
        return [
          String.raw`\text{${SYMBOLS[z - 1]}}\ (Z = ${z}):\ \ I = ${texNum(I, 4)}\ \text{eV}, \quad r = ${radius(z)}\ \text{pm}`,
          String.raw`Z_{ef}^{Slater} = Z - \sigma = ${z} - ${texNum(sl.sigma, 4)} = ${texNum(sl.zeff, 3)} \ \ (${label(sl.q)}) \qquad Z_{ef}^{(I)} = n\sqrt{I/13{,}6\ \text{eV}} = ${texNum(zeffFromIE(I, sl.q.n), 3)}`,
        ];
      }
      default: {
        const z = clamp(Z, MOS_RANGE[0], MOS_RANGE[1]);
        const E = kalpha(z);
        const fit = moseleyFit();
        return [
          String.raw`E_{K\alpha} = ${texNum(E, 4)}\ \text{keV}\ ${KALPHA_KEV[z] ? "(\\text{medida})" : "(\\text{previsão})"} \qquad f = E/h = ${texNum(E * 1000 * QE / H, 4)}\ \text{Hz} \qquad \lambda = ${texNum((C * H) / (E * 1000 * QE) * 1e12, 4)}\ \text{pm}`,
          String.raw`\text{Bohr: } \tfrac34 \cdot 13{,}6\ \text{eV}\,(Z-1)^2 = ${texNum(moseleyE(z), 4)}\ \text{keV} \qquad \text{ajuste: } \sqrt f = ${texNum(fit.k, 4)}\times10^{8}\,(Z - ${texNum(fit.sigma, 3)})\ \text{Hz}^{1/2}`,
        ];
      }
    }
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Preenchimento (Pauli e Hund)" },
        { value: 1, label: "N elétrons num poço" },
        { value: 2, label: "Periodicidade: ionização e raio" },
        { value: 3, label: "Lei de Moseley (Kα)" },
      ],
    },
    { key: "Z", label: "Número atômico Z", unit: "", min: 1, max: ZMAX, step: 1, default: 26 },
    {
      key: "real",
      label: "Configuração",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Real (com exceções medidas)" },
        { value: 0, label: "Só a regra de Madelung" },
      ],
    },
    { key: "N", label: "Poço: número de elétrons N", unit: "", min: 1, max: 40, step: 1, default: 7, live: true },
    {
      key: "dim",
      label: "Poço: dimensão",
      unit: "",
      min: 1,
      max: 2,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "1D (fio)" },
        { value: 2, label: "2D (quadrado L × L)" },
      ],
    },
    { key: "L", label: "Poço: largura L", unit: "nm", min: 0.1, max: 3, step: 0.01, default: 1, live: true },
    {
      key: "pauli",
      label: "Poço: princípio de exclusão",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Elétrons (com Pauli)" },
        { value: 0, label: "Sem exclusão (todos no nível 1)" },
      ],
    },
  ],

  observables: [
    { key: "Z", label: "Número atômico Z", unit: "", value: (s) => s.Z },
    { key: "unp", label: "Elétrons desemparelhados (Hund)", unit: "", value: (s, p) => unpaired(s.Z, realCfg(p)) },
    { key: "IE", label: "Energia de ionização (NIST; 0 se Z > 86)", unit: "eV", value: (s) => (s.Z <= ZDATA ? ionization(s.Z) : 0) },
    { key: "r", label: "Raio covalente (0 se Z > 86)", unit: "pm", value: (s) => (s.Z <= ZDATA ? radius(s.Z) : 0) },
    { key: "zs", label: "Z efetivo do elétron externo (Slater)", unit: "", value: (s) => slaterZeff(s.Z).zeff },
    { key: "Etot", label: "Poço: energia total do estado fundamental", unit: "eV", value: (_s, p) => wellSummary(nOf(p), dimOf(p), pauliOn(p)).Etot * e1eV(num(p, "L", 1)) },
    { key: "EF", label: "Poço: nível ocupado mais alto", unit: "eV", value: (_s, p) => wellSummary(nOf(p), dimOf(p), pauliOn(p)).EF * e1eV(num(p, "L", 1)) },
    { key: "dE", label: "Poço: menor energia de excitação", unit: "eV", value: (_s, p) => wellSummary(nOf(p), dimOf(p), pauliOn(p)).dE * e1eV(num(p, "L", 1)) },
    { key: "EK", label: "Energia Kα", unit: "keV", value: (s) => kalpha(clamp(s.Z, 2, 118)) },
    { key: "sf", label: "√f da linha Kα", unit: "10⁸ Hz^½", value: (s) => sqrtF(kalpha(clamp(s.Z, 2, 118))) },
  ],
  chart: { x: "Z", y: "IE" },

  scenarios: [
    {
      id: "aufbau",
      label: "Preenchendo os níveis: Pauli e Hund",
      params: { modo: 0, Z: 8, real: 1 },
      guide: `### Construindo os átomos
1. Cada caixa é um orbital $(n, l, m_l)$ e comporta **dois** elétrons com spins opostos (princípio de exclusão de Pauli). Uma subcamada $l$ tem $2l + 1$ caixas: $2, 6, 10, 14$ elétrons para $s, p, d, f$.
2. Clique em **Construir passo a passo** e rode: os elétrons entram na ordem de $n + l$ (linhas diagonais, o diagrama de Linus Pauling).
3. Repare no oxigênio ($2p^4$): pela **regra de Hund**, os elétrons ocupam caixas diferentes com spins paralelos antes de formar pares. Ele tem 2 elétrons desemparelhados (é paramagnético).
4. Clique na tabela à direita (ou use **Z + 1**) e veja que a coluna de um elemento é decidida pela camada mais externa. Experimente o cromo (24) e o cobre (29) e compare com **Só a regra de Madelung**.`,
      predict: [
        {
          question: "Quantos elétrons desemparelhados tem o átomo de nitrogênio (Z = 7, configuração 1s² 2s² 2p³) no estado fundamental?",
          options: ["1", "2", "3", "nenhum"],
          answer: 2,
          explanation: "Os três elétrons 2p ficam em três orbitais diferentes, com spins paralelos (regra de Hund): $m_l = +1, 0, -1$, todos com $m_s = +\\tfrac12$.",
        },
      ],
    },
    {
      id: "poco-muitos-eletrons",
      label: "N elétrons num poço infinito (1D e 2D)",
      params: { modo: 1, N: 7, dim: 1, L: 1, pauli: 1 },
      guide: `### Muitos elétrons, um poço
1. Num poço infinito 1D, os estados têm $E_n = n^2 E_1$, com $E_1 = h^2/(8mL^2)$. Cada estado espacial aceita **2** elétrons (spin para cima e para baixo).
2. Com $N = 7$: $E_{tot} = 2(1 + 4 + 9) + 16 = 44\\,E_1$. Confira nas equações vivas.
3. A menor excitação não é necessariamente levar o elétron do topo para cima: com o nível $n = 4$ pela metade, um elétron de $n = 3$ pode subir para a vaga ($\\Delta E = 7E_1$).
4. Desligue o princípio de exclusão: todos caem para $n = 1$ e a energia total cai muito. É a exclusão que "empilha" os elétrons e dá tamanho e estrutura aos átomos.
5. Passe para **2D**: estados como $(1,2)$ e $(2,1)$ têm a mesma energia (degenerescência), como as caixas de uma subcamada atômica.`,
      predict: [
        {
          question: "Cinco elétrons estão num poço infinito 1D. No estado fundamental, qual é a energia total, em unidades de E₁ = h²/(8mL²)?",
          options: ["5 E₁", "19 E₁", "55 E₁", "15 E₁"],
          answer: 1,
          explanation: "Dois elétrons em $n = 1$, dois em $n = 2$ e um em $n = 3$: $2\\cdot1 + 2\\cdot4 + 1\\cdot9 = 19\\,E_1$.",
        },
      ],
    },
    {
      id: "propriedades",
      label: "Periodicidade: ionização e raio atômico",
      params: { modo: 2, Z: 11 },
      guide: `### Por que a tabela é periódica
1. Os picos de energia de ionização são os **gases nobres**: camadas completas, elétrons fortemente ligados. Logo depois vem um **metal alcalino**, com um elétron sozinho numa camada nova, fácil de arrancar.
2. Ao longo de um período, a carga efetiva $Z_{ef}$ aumenta (os elétrons da mesma camada blindam mal uns aos outros), a ionização cresce e o raio diminui. Clique num ponto para ver $Z_{ef}$ pelas regras de Slater.
3. Repare nas pequenas quedas: do Be ao B (o elétron $2p$ é mais blindado que o $2s$) e do N ao O (o primeiro par num orbital $2p$ sofre repulsão extra).
4. Os lantanídeos (57–71) quase não mudam: os elétrons entram na camada $4f$, interna.`,
      predict: [
        {
          question: "Qual destes elementos tem a menor energia de ionização?",
          options: ["Neônio (Ne)", "Sódio (Na)", "Cloro (Cl)", "Magnésio (Mg)"],
          answer: 1,
          explanation: "O sódio tem um único elétron $3s$ fora de uma camada completa ($[\\text{Ne}]\\,3s^1$), blindado por 10 elétrons: $I = 5{,}14$ eV, contra 21,6 eV do neônio.",
        },
      ],
    },
    {
      id: "moseley",
      label: "Lei de Moseley: Kα e o número atômico",
      params: { modo: 3, Z: 29 },
      guide: `### Raios X que contam prótons
1. Uma linha $K\\alpha$ é emitida quando um elétron da camada $L$ ($n = 2$) cai numa vaga da camada $K$ ($n = 1$). O elétron $K$ que restou blinda uma unidade de carga, e o modelo de Bohr com $Z - 1$ dá $E = \\tfrac34 \\cdot 13{,}6\\ \\text{eV}\\,(Z-1)^2$.
2. No gráfico, $\\sqrt f$ cresce **linearmente** com $Z$: é a lei de Moseley (1913). Compare a reta de Bohr com o ajuste aos dados.
3. Os círculos vazados (Z = 43, 61, 72, 75) eram **lacunas** em 1914: a lei mostrou que faltavam elementos ali, descobertos depois.
4. Veja Co (27) e Ni (28): o cobalto tem massa **maior**, mas vem antes. A ordem da tabela é a do número atômico, não da massa.`,
      predict: [
        {
          question: "Se Z dobra (por exemplo, de 20 para 40), a frequência da linha Kα fica multiplicada por aproximadamente:",
          options: ["2", "4", "√2", "8"],
          answer: 1,
          explanation: "$f \\propto (Z-1)^2$: de $19^2 = 361$ para $39^2 = 1521$, um fator de cerca de 4,2. Confira: Ca tem 3,69 keV e Zr, 15,8 keV.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "aufbau",
      prompt: "Quantos elétrons desemparelhados tem o átomo de número atômico Z = {Z} no estado fundamental, segundo a regra de Hund e a regra de Madelung?",
      vary: { Z: [5, 36, 0] },
      fixed: { modo: 0, real: 0 },
      answer: { label: "desemparelhados", unit: "", compute: (p) => unpaired(Math.round(num(p, "Z")), false) },
      tolerance: 0.01,
      hint: "Escreva a configuração e olhe só a subcamada incompleta: até a metade, um elétron por orbital; depois começam os pares.",
    },
    {
      id: "poco",
      prompt: "{N} elétrons estão num poço de potencial infinito 1D de largura {L} nm. Qual é a energia total do estado fundamental do sistema, em eV? (Ignore a interação entre os elétrons.)",
      vary: { N: [2, 12, 0], L: [0.2, 1.5, 2] },
      fixed: { modo: 1, dim: 1, pauli: 1 },
      answer: { label: "E_tot", unit: "eV", compute: (p) => wellSummary(Math.round(num(p, "N")), 1, true).Etot * e1eV(num(p, "L")) },
      hint: "Cada nível n (energia n²h²/8mL²) recebe no máximo 2 elétrons.",
    },
    {
      id: "excitacao",
      prompt: "{N} elétrons estão num poço infinito 1D de largura {L} nm, no estado fundamental. Qual é a menor energia de fóton que o sistema pode absorver, em eV?",
      vary: { N: [3, 11, 0], L: [0.3, 1.5, 2] },
      fixed: { modo: 1, dim: 1, pauli: 1 },
      answer: { label: "ΔE", unit: "eV", compute: (p) => wellSummary(Math.round(num(p, "N")), 1, true).dE * e1eV(num(p, "L")) },
      hint: "Se o nível mais alto estiver pela metade, um elétron do nível de baixo pode subir para a vaga.",
    },
    {
      id: "zef",
      prompt: "A primeira energia de ionização do elemento Z = {Z} é a medida pelo NIST (veja a sim). Tratando o elétron externo como hidrogenoide com o n da camada de valência, qual é a carga efetiva Z_ef = n √(I / 13,6057 eV)?",
      vary: { Z: [3, 54, 0] },
      fixed: { modo: 2 },
      answer: { label: "Z_ef", unit: "", compute: (p) => { const z = Math.round(num(p, "Z")); return zeffFromIE(ionization(z), slaterZeff(z).q.n); } },
      hint: "Leia I no gráfico (ou nas medidas) e use o n da camada mais externa.",
    },
    {
      id: "moseley",
      prompt: "Uma amostra desconhecida emite raios X Kα de {E} keV. Pela lei de Bohr–Moseley, E = (3/4)(13,6 eV)(Z − 1)², qual é o número atômico (arredonde para o inteiro mais próximo)?",
      vary: { E: [3, 70, 2] },
      fixed: { modo: 3 },
      answer: { label: "Z", unit: "", compute: (p) => Math.round(1 + Math.sqrt(num(p, "E") / (0.75 * RYDBERG_EV * 1e-3))) },
      tolerance: 0.01,
      hint: "Z − 1 = √(E / 10,2 eV).",
    },
  ],

  init(p) {
    const Z = clamp(Math.round(num(p, "Z", 26)), 1, ZMAX);
    return { Z, fill: Z, acc: 0 };
  },
  step(s, _p, _t, dt) {
    if (s.fill >= s.Z) return s;
    let acc = s.acc + dt;
    let fill = s.fill;
    while (acc >= STEP_S && fill < s.Z) {
      acc -= STEP_S;
      fill++;
    }
    return { ...s, acc, fill };
  },
  dt: 0.05,
  sampleEvery: 1,
  maxSamples: 4000,

  actions: [
    { id: "menos", label: "Z − 1", run: (s) => setZ(s, s.Z - 1) },
    { id: "mais", label: "Z + 1", run: (s) => setZ(s, s.Z + 1) },
    { id: "construir", label: "Construir passo a passo (rode a sim)", run: (s) => ({ ...s, fill: 0, acc: 0 }) },
  ],
  pointer: {
    down(s, p, pt) {
      const z = pickZ(p, pt);
      return z ? setZ(s, z) : undefined;
    },
    cursor: (_s, p, pt) => (pickZ(p, pt) ? "pointer" : undefined),
  },

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const k = clamp((frame.scale * 20) / 760, 0.72, 1);
    const fs = (n: number) => Math.round(n * k * 10) / 10;
    const m = mode(frame.params);
    if (m === 0) renderAufbau(d, frame.state, frame.params, fs);
    else if (m === 1) renderWell(d, frame.params, fs);
    else if (m === 2) renderProperties(d, frame.state, fs);
    else renderMoseley(d, frame.state, fs);
  },
});

function toDigits(s: string) {
  return s.split("").map((c) => "⁰¹²³⁴⁵⁶⁷⁸⁹".indexOf(c)).join("");
}

function setZ(s: AtomState, z: number): AtomState {
  const Z = clamp(Math.round(z), 1, ZMAX);
  return { Z, fill: Z, acc: 0 };
}

// ---------- Geometria ----------

const TABLE = { x0: 10.4, yTop: 11.6, w: 0.52, h: 0.5 };
function cellOf(Z: number) {
  const pos = position(Z);
  if (pos.f) {
    const row = pos.period === 6 ? 8.4 : 9.4;
    return { x: TABLE.x0 + (2 + pos.fIndex + 0.5) * TABLE.w, y: TABLE.yTop - (row - 1) * TABLE.h };
  }
  return { x: TABLE.x0 + (pos.group - 1) * TABLE.w, y: TABLE.yTop - (pos.period - 1) * TABLE.h };
}

const PROP_X: [number, number] = [0, 87];
const BOX_IE = { x0: 1.5, y0: 6.75, x1: 19.6, y1: 11.3 };
const BOX_R = { x0: 1.5, y0: 1.0, x1: 19.6, y1: 5.45 };
const BOX_MOS = { x0: 1.6, y0: 1.1, x1: 11.8, y1: 11.0 };

function pickZ(p: Params, pt: WorldPoint): number | undefined {
  const m = mode(p);
  if (m === 0) {
    for (let Z = 1; Z <= ZMAX; Z++) {
      const c = cellOf(Z);
      if (pt.x >= c.x && pt.x <= c.x + TABLE.w && pt.y <= c.y && pt.y >= c.y - TABLE.h) return Z;
    }
    return undefined;
  }
  if (m === 2) {
    const inside = (b: typeof BOX_IE) => pt.x >= b.x0 && pt.x <= b.x1 && pt.y >= b.y0 && pt.y <= b.y1;
    if (!inside(BOX_IE) && !inside(BOX_R)) return undefined;
    const z = Math.round(PROP_X[0] + ((pt.x - BOX_IE.x0) / (BOX_IE.x1 - BOX_IE.x0)) * (PROP_X[1] - PROP_X[0]));
    return clamp(z, 1, ZDATA);
  }
  if (m === 3) {
    if (pt.x < BOX_MOS.x0 || pt.x > BOX_MOS.x1 || pt.y < BOX_MOS.y0 || pt.y > BOX_MOS.y1) return undefined;
    const z = Math.round(MOS_RANGE[0] + ((pt.x - BOX_MOS.x0) / (BOX_MOS.x1 - BOX_MOS.x0)) * (MOS_RANGE[1] - MOS_RANGE[0]));
    return clamp(z, MOS_RANGE[0], MOS_RANGE[1]);
  }
  return undefined;
}

type Fs = (n: number) => number;

const blockColor = (d: Draw, l: number) => d.theme.series[[0, 1, 2, 4][l] ?? 0]!;

function legend(d: Draw, x: number, y: number, fs: Fs) {
  let yy = y;
  return (str: string, color = d.theme.text, weight = "400", size = 11) => {
    d.text(str, x, yy, { align: "left", size: fs(size), color, weight });
    yy -= fs(size + 6) * d.px;
  };
}

// ---------- Modo 0: preenchimento ----------

const BOXW = 0.44, BOXH = 0.56;
const GROUP_X = [0.9, 1.95, 3.85, 6.65];
const rowY = (n: number) => 10.75 - (n - 1) * 1.38;

function renderAufbau(d: Draw, s: AtomState, p: Params, fs: Fs) {
  const { theme } = d;
  const real = realCfg(p);
  const animating = s.fill < s.Z;
  const occ = animating ? configuration(s.fill, false) : configuration(s.Z, real);
  const madel = configuration(s.Z, false);
  const differs = !animating && real && occ.some((k, i) => k !== madel[i]);

  // Último elétron colocado (ordem de preenchimento)
  let lastIdx = -1, lastJ = -1;
  {
    let left = animating ? s.fill : s.Z;
    for (let i = 0; i < MADELUNG.length && left > 0; i++) {
      const c = capacity(MADELUNG[i]!.l);
      if (left <= c) {
        lastIdx = i;
        lastJ = left - 1;
      }
      left -= c;
    }
  }

  // Diagonais de Linus Pauling (mesmo n + l)
  const center = (i: number) => {
    const q = MADELUNG[i]!;
    return { x: GROUP_X[q.l]! + ((2 * q.l + 1) * BOXW) / 2, y: rowY(q.n) - BOXH / 2 };
  };
  for (let i = 0; i + 1 < MADELUNG.length; i++) {
    const a = MADELUNG[i]!, b = MADELUNG[i + 1]!;
    if (a.n + a.l !== b.n + b.l) continue;
    const ca = center(i), cb = center(i + 1);
    d.line(ca.x, ca.y, cb.x, cb.y, { color: theme.muted, width: 1, alpha: 0.35, dash: [3, 4] });
  }
  d.text("ordem de preenchimento: n + l crescente (diagonais)", 0.4, 11.65, { size: fs(10), color: theme.muted, align: "left" });

  MADELUNG.forEach((q, i) => {
    const k = occ[i]!;
    const x0 = GROUP_X[q.l]!;
    const y1 = rowY(q.n);
    const boxes = hundBoxes(q.l, k);
    const col = blockColor(d, q.l);
    const full = k === capacity(q.l);
    d.text(`${label(q)}${k ? ` ${k}/${capacity(q.l)}` : ""}`, x0, y1, { size: fs(10), color: k ? col : theme.muted, align: "left", dy: -8, weight: full ? "400" : "600" });
    d.text(String(i + 1), x0 + (2 * q.l + 1) * BOXW, y1, { size: fs(8), color: theme.muted, align: "right", dy: -8 });
    boxes.forEach(([u, dn], b) => {
      const bx = x0 + b * BOXW;
      d.rect(bx, y1 - BOXH - 0.08, BOXW, BOXH, { fill: k ? col : "transparent", alpha: k ? 0.12 : 0, stroke: k ? col : theme.grid, width: 1 });
      const isLast = (j: number) => i === lastIdx && j === lastJ;
      const jUp = b, jDn = b + 2 * q.l + 1;
      if (u) d.arrow(bx + BOXW * 0.32, y1 - BOXH + 0.02, 0, BOXH * 0.8, { color: isLast(jUp) ? theme.positive : theme.text, width: 1.6, head: 5 });
      if (dn) d.arrow(bx + BOXW * 0.68, y1 - 0.18, 0, -BOXH * 0.8, { color: isLast(jDn) ? theme.positive : theme.text, width: 1.6, head: 5 });
    });
  });

  // Tabela periódica
  const cs = TABLE.w / d.px;
  for (let Z = 1; Z <= ZMAX; Z++) {
    const c = cellOf(Z);
    const col = blockColor(d, block(Z));
    d.rect(c.x + 0.02, c.y - TABLE.h + 0.02, TABLE.w - 0.04, TABLE.h - 0.04, { fill: col, alpha: Z <= s.Z ? 0.55 : 0.12 });
    if (cs >= 20) d.text(SYMBOLS[Z - 1]!, c.x + TABLE.w / 2, c.y - TABLE.h / 2, { size: fs(Math.min(10, cs * 0.36)), color: theme.text });
  }
  const cz = cellOf(s.Z);
  d.rect(cz.x, cz.y - TABLE.h, TABLE.w, TABLE.h, { stroke: theme.positive, width: 2.5 });
  const lc = cellOf(57), ac = cellOf(89);
  d.text("*", TABLE.x0 + 2.5 * TABLE.w, TABLE.yTop - 5.5 * TABLE.h, { size: fs(10), color: theme.muted });
  d.text("*", lc.x - 0.2, lc.y - TABLE.h / 2, { size: fs(10), color: theme.muted });
  d.text("**", TABLE.x0 + 2.5 * TABLE.w, TABLE.yTop - 6.5 * TABLE.h, { size: fs(10), color: theme.muted });
  d.text("**", ac.x - 0.2, ac.y - TABLE.h / 2, { size: fs(10), color: theme.muted });
  LUM.forEach((b, l) => {
    d.rect(10.45 + l * 1.35, 6.35, 0.3, 0.25, { fill: blockColor(d, l), alpha: 0.6 });
    d.text(`bloco ${b}`, 10.85 + l * 1.35, 6.47, { size: fs(9), color: theme.muted, align: "left" });
  });

  // Informações
  const Z = animating ? Math.max(s.fill, 1) : s.Z;
  const line = legend(d, 10.4, 5.75, fs);
  line(`Z = ${s.Z}   ${elName(s.Z)}`, theme.text, "700", 13);
  if (animating) line(`construindo: ${s.fill} de ${s.Z} elétrons`, theme.positive, "600");
  else {
    line(configString(s.Z, real, true), theme.accent, "600", 12);
    if (differs) line(`Madelung daria ${configString(s.Z, false, true)}`, theme.muted, "400", 10);
  }
  const u = animating ? occ.reduce((a, k, i) => a + (k <= 2 * MADELUNG[i]!.l + 1 ? k : capacity(MADELUNG[i]!.l) - k), 0) : unpaired(s.Z, real);
  const term = hundTerm(Z, animating ? false : real);
  line(`desemparelhados: ${u}  →  S = ${fmt(u / 2, 2)}${animating ? "" : `,  termo ${term.text}`}`);
  if (lastIdx >= 0) {
    const qn = electronQN(MADELUNG[lastIdx]!, lastJ);
    line(`último elétron: n = ${qn.n}, l = ${qn.l} (${L_LETTERS[qn.l]}), mₗ = ${qn.ml > 0 ? "+" : ""}${qn.ml}, mₛ = ${qn.ms > 0 ? "+½" : "−½"}`, theme.positive);
  }
  const pos = position(s.Z);
  line(`bloco ${LUM[block(s.Z)]}, período ${pos.period}${pos.f ? ", série f" : `, grupo ${pos.group}`}`, theme.muted);
  if (NOBLE.includes(s.Z)) line("camadas completas: gás nobre", theme.muted);
  line("clique na tabela para escolher o elemento", theme.muted, "400", 10);
}

// ---------- Modo 1: poço com N elétrons ----------

function renderWell(d: Draw, p: Params, fs: Fs) {
  const { theme } = d;
  const N = nOf(p), dim = dimOf(p), pauli = pauliOn(p), Lnm = num(p, "L", 1);
  const w = wellSummary(N, dim, pauli);
  const E1 = e1eV(Lnm);
  const occd = w.orbs.filter((o) => o.occ > 0);
  const nextE = w.orbs.find((o) => o.e > w.EF)?.e ?? w.EF + 1;
  const eMax = Math.max(nextE, w.EF) * 1.12 + 0.5;
  // Níveis (agrupados por energia)
  const B = { x0: 1.2, y0: 1.0, x1: 7.6, y1: 11.0 };
  const P = panel(d, B, { min: 0, max: 1 }, { min: 0, max: eMax });
  P.frame({ ylabel: "E / E₁", xticks: [], fy: (v) => fmt(v, 3) });
  const levels = new Map<number, typeof w.orbs>();
  for (const o of w.orbs) if (o.e <= eMax) levels.set(o.e, [...(levels.get(o.e) ?? []), o]);
  const segW = 1.15, gap = 0.25;
  for (const [e, orbs] of levels) {
    const y = P.Y(e);
    const total = orbs.length * segW + (orbs.length - 1) * gap;
    let x = (B.x0 + B.x1) / 2 - total / 2;
    for (const o of orbs) {
      d.line(x, y, x + segW, y, { color: o.occ ? theme.text : theme.muted, width: o.occ ? 2 : 1, alpha: o.occ ? 1 : 0.6 });
      const tag = dim === 1 ? `n=${o.nx}` : `(${o.nx},${o.ny})`;
      d.text(tag, x + segW / 2, y, { size: fs(9), color: theme.muted, dy: 9 });
      const shown = Math.min(o.occ, pauli ? 2 : 8);
      for (let k = 0; k < shown; k++) {
        const ax = x + segW * (pauli ? (k === 0 ? 0.33 : 0.67) : (k + 0.5) / shown);
        const upArrow = pauli ? k === 0 : true;
        if (upArrow) d.arrow(ax, y - 0.02, 0, 0.42, { color: theme.accent, width: 1.6, head: 5 });
        else d.arrow(ax, y + 0.42, 0, -0.42, { color: theme.positive, width: 1.6, head: 5 });
      }
      if (!pauli && o.occ > 8) d.text(`×${o.occ}`, x + segW, y, { size: fs(10), color: theme.accent, align: "left", dx: 4, dy: -8 });
      x += segW + gap;
    }
    if (orbs.length > 1) d.text(`g = ${orbs.length}`, B.x1, y, { size: fs(9), color: theme.muted, align: "right", dx: -2, dy: -7 });
  }
  if (w.dE > 0 && pauli) {
    // Menor excitação: seta do nível de origem ao de destino
    let from = 0, to = 0;
    for (const a of occd) for (const b of w.orbs) if (b.occ < 2 && b.e > a.e && Math.abs(b.e - a.e - w.dE) < 1e-9 && !from) { from = a.e; to = b.e; }
    if (to > 0 && to <= eMax) {
      d.arrow(B.x0 + 0.35, P.Y(from), 0, P.Y(to) - P.Y(from), { color: theme.series[2], width: 1.6, head: 6 });
      d.text(`ΔE = ${fmt(w.dE, 3)} E₁`, B.x0 + 0.5, (P.Y(from) + P.Y(to)) / 2, { size: fs(9), color: theme.series[2], align: "left" });
    }
  }

  // Densidade eletrônica
  const D = { x0: 8.9, y0: 6.6, x1: 13.5, y1: 11.0 };
  if (dim === 1) {
    const Q = panel(d, D, { min: 0, max: 1 }, { min: 0, max: Math.max(2, ...Array.from({ length: 101 }, (_, i) => wellDensity(w.orbs, 1, i / 100))) * 1.1 });
    Q.frame({ xlabel: "x / L", ylabel: "densidade n(x)·L", fx: (v) => fmt(v, 2), fy: (v) => fmt(v, 2) });
    Q.plot((x) => wellDensity(w.orbs, 1, x), 0, 1, { color: theme.accent, width: 2, n: 300 });
  } else {
    const n = 36;
    let mx = 0;
    const vals: number[] = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = wellDensity(w.orbs, 2, (i + 0.5) / n, (j + 0.5) / n);
      vals.push(v);
      mx = Math.max(mx, v);
    }
    const cw = (D.x1 - D.x0) / n, ch = (D.y1 - D.y0) / n;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      const v = vals[i * n + j]! / (mx || 1);
      if (v > 0.02) d.rect(D.x0 + i * cw, D.y0 + j * ch, cw * 1.02, ch * 1.02, { fill: theme.accent, alpha: v * 0.9 });
    }
    d.rect(D.x0, D.y0, D.x1 - D.x0, D.y1 - D.y0, { stroke: theme.muted, width: 1 });
    d.text("densidade eletrônica no quadrado", D.x0, D.y1, { size: fs(10), color: theme.muted, align: "left", dy: -9 });
  }

  // Legenda
  const line = legend(d, 14.1, 10.9, fs);
  line(`${N} elétron${N > 1 ? "s" : ""}, poço ${dim}D, L = ${fmt(Lnm, 3)} nm`, theme.text, "700");
  line(`E₁ = h²/8mL² = ${fmt(E1, 3)} eV`);
  line(`E_tot = ${fmt(w.Etot, 4)} E₁ = ${fmt(w.Etot * E1, 4)} eV`, theme.accent, "600");
  line(`nível mais alto: ${fmt(w.EF, 3)} E₁`);
  if (w.dE > 0) line(`fóton mín.: λ = ${fmt((H * C) / (w.dE * E1 * QE) * 1e9, 4)} nm`, theme.series[2]);
  line(pauli ? "máx. 2 elétrons por estado (↑↓)" : "sem exclusão: todos no nível 1", pauli ? theme.muted : theme.positive, "400", 10);

  // E_tot × N
  const NN = 40;
  const curve = (dd: number, pl: boolean) => Array.from({ length: NN }, (_, i) => [i + 1, wellSummary(i + 1, dd, pl).Etot] as [number, number]);
  const c1 = curve(dim, true);
  const yMax = c1[NN - 1]![1] * 1.05;
  const R = panel(d, { x0: 8.9, y0: 1.0, x1: 19.6, y1: 5.2 }, { min: 0, max: NN }, { min: 0, max: yMax });
  R.frame({ xlabel: "N", ylabel: "E_tot / E₁ no estado fundamental", fy: (v) => fmt(v, 4), fx: (v) => fmt(v, 2) });
  R.line(c1, { color: theme.accent, width: 2 });
  R.line(curve(dim, false), { color: theme.positive, width: 1.5, dash: [5, 3] });
  d.dot(R.X(N), R.Y(w.Etot), 5, pauli ? theme.accent : theme.positive);
  d.text("— com Pauli   - - sem exclusão", R.box.x1, R.box.y1, { size: fs(9), color: theme.muted, align: "right", dy: -9 });
}

// ---------- Modo 2: periodicidade ----------

function renderProperties(d: Draw, s: AtomState, fs: Fs) {
  const { theme } = d;
  const Z = Math.min(s.Z, ZDATA);
  const A = panel(d, BOX_IE, { min: PROP_X[0], max: PROP_X[1] }, { min: 0, max: 26 });
  A.frame({ ylabel: "1ª energia de ionização (eV)", fx: (v) => fmt(v, 2) });
  const B = panel(d, BOX_R, { min: PROP_X[0], max: PROP_X[1] }, { min: 0, max: 260 });
  B.frame({ xlabel: "Z", ylabel: "raio covalente (pm)", fx: (v) => fmt(v, 2) });
  // Faixas dos períodos
  for (const ng of NOBLE.slice(0, 6)) {
    A.line([[ng, 0], [ng, 26]], { color: theme.grid, width: 1 });
    B.line([[ng, 0], [ng, 260]], { color: theme.grid, width: 1 });
  }
  const ie: [number, number][] = [], rr: [number, number][] = [];
  for (let z = 1; z <= ZDATA; z++) {
    ie.push([z, ionization(z)]);
    rr.push([z, radius(z)]);
  }
  A.line(ie, { color: theme.muted, width: 1 });
  B.line(rr, { color: theme.muted, width: 1 });
  for (let z = 1; z <= ZDATA; z++) {
    const c = blockColor(d, block(z));
    d.dot(A.X(z), A.Y(ionization(z)), 3, c);
    d.dot(B.X(z), B.Y(radius(z)), 3, c);
  }
  for (const ng of NOBLE.slice(0, 6)) d.text(SYMBOLS[ng - 1]!, A.X(ng), A.Y(ionization(ng)), { size: fs(10), color: theme.series[1], weight: "600", dy: -9 });
  for (const al of [3, 11, 19, 37, 55]) {
    d.text(SYMBOLS[al - 1]!, A.X(al), A.Y(ionization(al)), { size: fs(10), color: theme.series[0], weight: "600", dy: 10 });
    d.text(SYMBOLS[al - 1]!, B.X(al), B.Y(radius(al)), { size: fs(10), color: theme.series[0], weight: "600", dy: -9 });
  }
  // Elemento escolhido
  A.line([[Z, 0], [Z, 26]], { color: theme.positive, width: 1.2, dash: [4, 3] });
  B.line([[Z, 0], [Z, 260]], { color: theme.positive, width: 1.2, dash: [4, 3] });
  d.circle(A.X(Z), A.Y(ionization(Z)), 0, { stroke: theme.positive, width: 2, minPx: 6 });
  d.circle(B.X(Z), B.Y(radius(Z)), 0, { stroke: theme.positive, width: 2, minPx: 6 });
  const sl = slaterZeff(Z);
  const line = legend(d, A.X(44), BOX_IE.y1 - 0.35, fs);
  line(`${elName(Z)}, Z = ${Z}${s.Z > ZDATA ? " (dados até Z = 86)" : ""}`, theme.positive, "700", 12);
  line(`${configString(Z, true, true)}`, theme.text, "400", 11);
  line(`I = ${fmt(ionization(Z), 4)} eV    r = ${radius(Z)} pm`, theme.text, "600", 11);
  line(`Z_ef (Slater, ${label(sl.q)}) = ${fmt(sl.zeff, 3)}    Z_ef (de I) = ${fmt(zeffFromIE(ionization(Z), sl.q.n), 3)}`, theme.muted, "400", 10);
  LUM.forEach((b, l) => {
    d.dot(BOX_R.x1 - 4.4 + l * 1.1, BOX_R.y1 - 0.3, 3.5, blockColor(d, l));
    d.text(b, BOX_R.x1 - 4.25 + l * 1.1, BOX_R.y1 - 0.3, { size: fs(10), color: theme.muted, align: "left" });
  });
  d.text("clique para escolher", BOX_R.x1 - 4.6, BOX_R.y1 - 0.3, { size: fs(9), color: theme.muted, align: "right" });
}

// ---------- Modo 3: Moseley ----------

function renderMoseley(d: Draw, s: AtomState, fs: Fs) {
  const { theme } = d;
  const Z = clamp(s.Z, MOS_RANGE[0], MOS_RANGE[1]);
  const yMax = 45;
  const A = panel(d, BOX_MOS, { min: MOS_RANGE[0], max: MOS_RANGE[1] }, { min: 0, max: yMax });
  A.frame({ xlabel: "Z", ylabel: "√f  (10⁸ Hz^½)", fx: (v) => fmt(v, 2), fy: (v) => fmt(v, 2) });
  const fit = moseleyFit();
  A.plot((z) => kTheory * (z - 1), MOS_RANGE[0], MOS_RANGE[1], { color: theme.muted, width: 1.5 });
  A.plot((z) => fit.k * (z - fit.sigma), MOS_RANGE[0], MOS_RANGE[1], { color: theme.series[2], width: 1.5, dash: [6, 4] });
  for (const [zs, E] of Object.entries(KALPHA_KEV)) {
    const z = Number(zs);
    if (z < MOS_RANGE[0] || z > MOS_RANGE[1]) continue;
    const gap = GAPS_1914.includes(z);
    if (gap) {
      d.circle(A.X(z), A.Y(sqrtF(E)), 0, { stroke: theme.positive, width: 1.5, minPx: 4.5 });
      d.text("?", A.X(z), A.Y(sqrtF(E)), { size: fs(9), color: theme.positive, dx: 9 });
    } else d.dot(A.X(z), A.Y(sqrtF(E)), 3.2, theme.accent);
  }
  const E = kalpha(Z);
  d.circle(A.X(Z), A.Y(sqrtF(E)), 0, { stroke: theme.text, width: 2, minPx: 7 });
  d.text(SYMBOLS[Z - 1]!, A.X(Z), A.Y(sqrtF(E)), { size: fs(11), weight: "700", dx: -12, dy: -10 });
  const lg = legend(d, A.X(MOS_RANGE[0]) + 0.25, BOX_MOS.y1 - 0.4, fs);
  lg("● Kα₁ medida   ○ lacunas de 1914", theme.accent, "400", 10);
  lg("— Bohr: √(3cR/4) (Z − 1)", theme.muted, "400", 10);
  lg(`- - ajuste: σ = ${fmt(fit.sigma, 3)}`, theme.series[2], "400", 10);

  // Diagrama do átomo e níveis
  const cx = 15.8, cy = 7.9;
  d.circle(cx, cy, 0.42, { fill: theme.positive, alpha: 0.85 });
  d.text(`+${Z}e`, cx, cy, { size: fs(10), color: "#fff", weight: "700" });
  const rK = 1.15, rL = 2.4;
  d.circle(cx, cy, rK, { stroke: theme.muted, width: 1 });
  d.circle(cx, cy, rL, { stroke: theme.muted, width: 1 });
  d.text("K", cx + rK, cy, { size: fs(10), color: theme.muted, dx: 8 });
  d.text("L", cx + rL, cy, { size: fs(10), color: theme.muted, dx: 8 });
  d.dot(cx, cy + rK, 4, theme.text);
  d.circle(cx, cy - rK, 0, { stroke: theme.text, width: 1.5, minPx: 4, dash: [2, 2] });
  d.text("vaga", cx, cy - rK, { size: fs(9), color: theme.muted, dy: 11, dx: 18 });
  for (let i = 0; i < 8; i++) {
    const a = (i * Math.PI) / 4 + 0.3;
    if (i === 5) continue;
    d.dot(cx + rL * Math.cos(a), cy + rL * Math.sin(a), 3.5, theme.text);
  }
  const a5 = (5 * Math.PI) / 4 + 0.3;
  const from = { x: cx + rL * Math.cos(a5), y: cy + rL * Math.sin(a5) };
  d.arrow(from.x, from.y, cx - from.x - 0.05, cy - rK - from.y + 0.1, { color: theme.accent, width: 2 });
  // Fóton
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const x = cx - 0.4 - i * 0.045;
    pts.push([x - 1.4, cy - rK - 0.9 - 0.12 * Math.sin(i * 0.8)]);
  }
  d.polyline(pts, { color: theme.series[1], width: 1.5 });
  d.text("Kα", pts[pts.length - 1]![0], pts[pts.length - 1]![1], { size: fs(11), color: theme.series[1], weight: "600", dx: -12 });

  const line = legend(d, 12.4, 4.1, fs);
  line(`${elName(Z)}, Z = ${Z}`, theme.text, "700", 12);
  line(`E_Kα = ${fmt(E, 4)} keV ${KALPHA_KEV[Z] ? "(medida)" : "(sem dado: previsão)"}`, theme.accent, "600");
  line(`Bohr com Z − 1: ${fmt(moseleyE(Z), 4)} keV`, theme.muted);
  line(`λ = ${fmt(((H * C) / (E * 1000 * QE)) * 1e12, 4)} pm,  √f = ${fmt(sqrtF(E), 4)}`, theme.text);
  const inv = MASS_INVERSIONS.find(([a, , b]) => a === Z || b === Z);
  if (inv) line(`massas: ${SYMBOLS[inv[0] - 1]} ${fmt(inv[1], 5)} u > ${SYMBOLS[inv[2] - 1]} ${fmt(inv[3], 5)} u`, theme.positive, "400", 10);
  line("clique no gráfico para escolher Z", theme.muted, "400", 10);
}

export default tabelaPeriodica;
