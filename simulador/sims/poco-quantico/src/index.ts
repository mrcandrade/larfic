import { defineSim, draw, num, texNum, type Params, type WorldPoint } from "@fisilab/core";
import { fmt, panel, type Panel } from "./panel.ts";
import { X_MAX, grid, infiniteWellE, meanX, oscillatorE, solvePotential, type PotentialParams, type Solution } from "./physics.ts";
import { derivation } from "./derivation.ts";
import { CDSE, boxDensity2D, boxLevels, dotEnergy, nmToCss, photonNm, type BoxLevel } from "./caixas.ts";

export * from "./physics.ts";
export * from "./caixas.ts";

export const NDRAW = 64;
export const VDRAW = 30;
const MAX_LEVELS = 10;

export interface WellState {
  /** Potencial desenhado (modo 4), NDRAW faixas em [−X, X]. */
  drawn: number[];
  /** Última faixa pintada (para ligar pontos ao arrastar). */
  lastBin: number | null;
}

const kind = (p: Params) => Math.round(num(p, "modo"));
/** Modos 5 (caixa 2D/3D) e 6 (pontos quânticos) não usam o solver 1D. */
const BOX_MODE = 5;
const DOT_MODE = 6;
const isNew = (p: Params) => kind(p) >= BOX_MODE;
const H_GRID = grid().h;

/** Potencial "de fábrica" para o modo desenhável: poço assimétrico com degrau. */
export function defaultDrawn(): number[] {
  return Array.from({ length: NDRAW }, (_, i) => {
    const x = -X_MAX + ((i + 0.5) * 2 * X_MAX) / NDRAW;
    return Math.abs(x) > 4 ? 25 : x > 1 ? 6 : 0;
  });
}

export function potParams(p: Params, s: WellState): PotentialParams {
  let L = num(p, "L", 2);
  const k = isNew(p) ? 0 : kind(p);
  if (k === 0) L = Math.max(4 * H_GRID, Math.round(L / (2 * H_GRID)) * 2 * H_GRID);
  return { kind: k, L, V0: num(p, "V0", 10), omega: num(p, "omega", 1), drawn: s.drawn };
}

const cache = new Map<string, Solution>();
/** Autoestados (com cache: o desenho e os gráficos pedem a mesma solução muitas vezes). */
export function solutionFor(p: Params, s: WellState): Solution {
  const pp = potParams(p, s);
  const key = JSON.stringify([pp.kind, pp.L, pp.V0, pp.omega, pp.kind === 4 ? pp.drawn : 0]);
  let sol = cache.get(key);
  if (!sol) {
    sol = solvePotential(pp, MAX_LEVELS);
    if (cache.size > 16) cache.delete(cache.keys().next().value!);
    cache.set(key, sol);
  }
  return sol;
}

/** Níveis a mostrar: no poço finito só os ligados (E < V0). */
function shownLevels(p: Params, sol: Solution): number {
  let n = Math.min(Math.round(num(p, "niveis", 5)), sol.E.length);
  if (kind(p) === 1) n = Math.min(n, sol.E.filter((e) => e < num(p, "V0", 10)).length);
  if (kind(p) === 4) n = Math.min(n, sol.E.filter((e) => e < VDRAW).length);
  return n;
}

const supIdx = (p: Params) => {
  const a = Math.max(1, Math.round(num(p, "n1", 1))) - 1;
  const b = Math.max(1, Math.round(num(p, "n2", 2))) - 1;
  return [a, b] as const;
};

function ranges(p: Params, sol: Solution): { xr: [number, number]; er: [number, number] } {
  const k = kind(p);
  const n = Math.max(1, shownLevels(p, sol));
  const Etop = sol.E[n - 1] ?? 1;
  const L = potParams(p, { drawn: [], lastBin: null }).L;
  switch (k) {
    case 0:
      return { xr: [-L / 2 - 0.25 * L, L / 2 + 0.25 * L], er: [-0.08 * Etop, Etop * 1.2] };
    case 1: {
      const V0 = num(p, "V0", 10);
      const w = Math.min(X_MAX, L / 2 + Math.max(1.5, 3 / Math.sqrt(2 * Math.max(0.2, V0 - (sol.E[0] ?? 0)))));
      return { xr: [-w, w], er: [-0.08 * V0, V0 * 1.2] };
    }
    case 2: {
      const om = num(p, "omega", 1);
      const w = Math.min(X_MAX, Math.sqrt((2 * Etop) / (om * om)) + 2 / Math.sqrt(om));
      return { xr: [-w, w], er: [-0.08 * Etop, Etop * 1.2] };
    }
    case 3: {
      const w = Math.min(X_MAX, L / 2 + 2.5);
      return { xr: [-w, w], er: [-0.08 * Etop, Math.max(Etop, num(p, "V0", 10)) * 1.2] };
    }
    default:
      return { xr: [-X_MAX, X_MAX], er: [-1, VDRAW + 2] };
  }
}

const BOX = { x0: 1.4, y0: 0.9, x1: 19.6, y1: 11.4 };

/** Lados da caixa retangular (modo 5): 2 ou 3 conforme a dimensão. */
export function boxSides(p: Params): number[] {
  const Ls = [num(p, "L", 2), num(p, "Ly", 2)];
  if (Math.round(num(p, "dim", 2)) === 3) Ls.push(num(p, "Lz", 2));
  return Ls;
}
export const boxLevelsFor = (p: Params): BoxLevel[] => boxLevels(boxSides(p), MAX_LEVELS);
/** Energias mostradas como E₁, E₂, E₃: níveis 1D, níveis distintos da caixa, ou nada (ponto quântico). */
function energies(p: Params, s: WellState): number[] {
  if (kind(p) === BOX_MODE) return boxLevelsFor(p).map((l) => l.E);
  if (kind(p) === DOT_MODE) return [];
  return solutionFor(p, s).E;
}
const rdot = (p: Params) => num(p, "Rdot", 2.5);
const nsLabel = (n: number[]) => `(${n.join(",")})`;

function mkPanel(d: ReturnType<typeof draw>, p: Params, sol: Solution): Panel {
  const { xr, er } = ranges(p, sol);
  return panel(d, BOX, { min: xr[0], max: xr[1] }, { min: er[0], max: er[1] });
}

/** Pinta o potencial desenhado no ponto do palco (modo 4). */
function paint(s: WellState, p: Params, pt: WorldPoint): WellState | undefined {
  if (kind(p) !== 4) return undefined;
  if (pt.x < BOX.x0 || pt.x > BOX.x1 || pt.y < BOX.y0 - 0.5 || pt.y > BOX.y1 + 0.5) return undefined;
  const sol = solutionFor(p, s);
  const { xr, er } = ranges(p, sol);
  const x = xr[0] + ((pt.x - BOX.x0) / (BOX.x1 - BOX.x0)) * (xr[1] - xr[0]);
  const v = Math.max(0, Math.min(VDRAW, er[0] + ((pt.y - BOX.y0) / (BOX.y1 - BOX.y0)) * (er[1] - er[0])));
  const bin = Math.max(0, Math.min(NDRAW - 1, Math.floor(((x + X_MAX) / (2 * X_MAX)) * NDRAW)));
  const drawn = s.drawn.slice();
  const from = s.lastBin ?? bin;
  const [a, b] = from < bin ? [from, bin] : [bin, from];
  for (let i = a; i <= b; i++) drawn[i] = Math.round(v * 2) / 2;
  return { drawn, lastBin: bin };
}

export const pocoQuantico = defineSim<WellState>({
  id: "poco-quantico",
  title: "Poços quânticos e oscilador harmônico",
  course: "FG IV",
  topic: "Quântica",
  priority: "P1",
  summary:
    "Resolva a equação de Schrödinger 1D numericamente para o poço infinito, o poço finito, o oscilador harmônico, o poço duplo ou um potencial desenhado com o mouse, e veja níveis e autofunções sobre V(x).",
  derivation,
  equations: [
    String.raw`-\frac{\hbar^2}{2m}\psi'' + V(x)\,\psi = E\,\psi \qquad (\hbar = m = 1)`,
    String.raw`\text{poço infinito: } E_n = \frac{n^2\pi^2}{2L^2} \qquad \text{oscilador: } E_n = \left(n + \tfrac12\right)\omega`,
    String.raw`\text{poço finito: } k\tan\frac{kL}{2} = \kappa,\ \ -k\cot\frac{kL}{2} = \kappa \qquad k = \sqrt{2E},\ \kappa = \sqrt{2(V_0 - E)}`,
    String.raw`\Psi(x,t) = \tfrac{1}{\sqrt2}\left(\psi_a e^{-iE_at} + \psi_b e^{-iE_bt}\right) \qquad T = \frac{2\pi}{E_b - E_a}`,
  ],
  liveEquations(s, p, t) {
    if (kind(p) === BOX_MODE) {
      const Ls = boxSides(p);
      const ax = ["x", "y", "z"];
      const sum = Ls.map((L, i) => String.raw`\frac{n_${ax[i]}^2}{${texNum(L, 3)}^2}`).join(" + ");
      const lv = boxLevelsFor(p).slice(0, 5);
      return [
        String.raw`E = \frac{\pi^2}{2}\left(${sum}\right)`,
        lv.map((l, i) => String.raw`E_{${i + 1}} = ${texNum(l.E, 4)}\ (g = ${l.states.length})`).join(",\\ "),
      ];
    }
    if (kind(p) === DOT_MODE) {
      const R = rdot(p);
      const E = dotEnergy(R);
      return [
        String.raw`E = E_g + \frac{h^2}{8R^2}\left(\frac{1}{m_e^*} + \frac{1}{m_h^*}\right) - \frac{1{,}786\,e^2}{4\pi\varepsilon_0\varepsilon_r R}`,
        String.raw`R = ${texNum(R, 3)}\ \text{nm}:\ E = ${texNum(E, 3)}\ \text{eV} \qquad \lambda = \frac{hc}{E} = ${texNum(photonNm(E), 3)}\ \text{nm}`,
      ];
    }
    const sol = solutionFor(p, s);
    const n = shownLevels(p, sol);
    const Es = sol.E.slice(0, Math.min(n, 5)).map((e, i) => `E_{${i + 1}} = ${texNum(e, 4)}`);
    const out = [Es.join(",\\ ")];
    const k = kind(p);
    const L = potParams(p, s).L;
    if (k === 0) out.push(String.raw`\frac{n^2\pi^2}{2L^2}:\ ${[1, 2, 3].map((m) => texNum(infiniteWellE(m, L), 4)).join(",\\ ")} \qquad \frac{E_2}{E_1} = ${texNum((sol.E[1] ?? 0) / (sol.E[0] ?? 1), 4)}`);
    if (k === 2) out.push(String.raw`\left(n+\tfrac12\right)\omega:\ ${[0, 1, 2].map((m) => texNum(oscillatorE(m, num(p, "omega", 1)), 4)).join(",\\ ")}`);
    if (Math.round(num(p, "mostrar")) === 2) {
      const [a, b] = supIdx(p);
      if (sol.E[a] !== undefined && sol.E[b] !== undefined && a !== b)
        out.push(String.raw`\langle x\rangle(t) = ${texNum(meanX(sol, a, b, t))} \qquad T = \frac{2\pi}{E_${b + 1} - E_${a + 1}} = ${texNum((2 * Math.PI) / Math.abs(sol.E[b]! - sol.E[a]!))}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Potencial",
      unit: "",
      min: 0,
      max: 6,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Poço infinito" },
        { value: 1, label: "Poço finito" },
        { value: 2, label: "Oscilador harmônico" },
        { value: 3, label: "Poço duplo (quártico)" },
        { value: 4, label: "Desenhado com o mouse" },
        { value: 5, label: "Caixa retangular 2D/3D (níveis e degenerescência)" },
        { value: 6, label: "Ponto quântico de CdSe (cor × tamanho)" },
      ],
    },
    { key: "L", label: "Largura L (lado Lx da caixa)", unit: "", min: 0.4, max: 8, step: 0.04, default: 2, live: true },
    {
      key: "dim",
      label: "Caixa: dimensão",
      unit: "",
      min: 2,
      max: 3,
      step: 1,
      default: 2,
      live: true,
      options: [
        { value: 2, label: "2D (poço quadrado/retangular)" },
        { value: 3, label: "3D (caixa)" },
      ],
    },
    { key: "Ly", label: "Caixa: lado Ly", unit: "", min: 0.4, max: 8, step: 0.04, default: 2, live: true },
    { key: "Lz", label: "Caixa: lado Lz (3D)", unit: "", min: 0.4, max: 8, step: 0.04, default: 2, live: true },
    { key: "Rdot", label: "Raio do ponto quântico", unit: "nm", min: 1.5, max: 6, step: 0.1, default: 2.5, live: true },
    { key: "V0", label: "Profundidade / barreira V₀", unit: "", min: 1, max: 60, step: 0.5, default: 10, live: true },
    { key: "omega", label: "Frequência ω do oscilador", unit: "", min: 0.2, max: 4, step: 0.05, default: 1, live: true },
    { key: "niveis", label: "Níveis mostrados", unit: "", min: 1, max: MAX_LEVELS, step: 1, default: 5, live: true },
    {
      key: "mostrar",
      label: "Mostrar",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Autofunções ψₙ(x)" },
        { value: 1, label: "Densidades |ψₙ(x)|²" },
        { value: 2, label: "Superposição de dois níveis (anima)" },
      ],
    },
    { key: "n1", label: "Superposição: nível a", unit: "", min: 1, max: MAX_LEVELS, step: 1, default: 1, live: true },
    { key: "n2", label: "Superposição: nível b", unit: "", min: 1, max: MAX_LEVELS, step: 1, default: 2, live: true },
  ],

  observables: [
    { key: "E1", label: "E₁", unit: "", value: (s, p) => energies(p, s)[0] ?? 0 },
    { key: "E2", label: "E₂", unit: "", value: (s, p) => energies(p, s)[1] ?? 0 },
    { key: "E3", label: "E₃", unit: "", value: (s, p) => energies(p, s)[2] ?? 0 },
    {
      key: "r21",
      label: "E₂/E₁",
      unit: "",
      value: (s, p) => {
        const E = energies(p, s);
        return E[0] && E[1] !== undefined ? E[1] / E[0] : 0;
      },
    },
    {
      key: "xm",
      label: "⟨x⟩ da superposição",
      unit: "",
      value: (s, p, t) => {
        if (isNew(p)) return 0;
        const [a, b] = supIdx(p);
        return meanX(solutionFor(p, s), a, b, t);
      },
    },
    {
      key: "g2",
      label: "Degenerescência do 2º nível da caixa",
      unit: "",
      value: (_s, p) => (kind(p) === BOX_MODE ? (boxLevelsFor(p)[1]?.states.length ?? 0) : 0),
    },
    { key: "Edot", label: "Energia do fóton do ponto quântico", unit: "eV", value: (_s, p) => (kind(p) === DOT_MODE ? dotEnergy(rdot(p)) : 0) },
    { key: "lamDot", label: "λ emitido pelo ponto quântico", unit: "nm", value: (_s, p) => (kind(p) === DOT_MODE ? photonNm(dotEnergy(rdot(p))) : 0) },
  ],
  chart: { x: "t", y: "xm" },

  scenarios: [
    {
      id: "infinito",
      label: "Poço infinito: Eₙ ∝ n²",
      params: { modo: 0, L: 2, niveis: 5, mostrar: 0 },
      guide: `### Partícula numa caixa
1. As energias seguem $E_n = n^2\\pi^2/(2L^2)$: confira $E_2/E_1 = 4$ e $E_3/E_1 = 9$ nas equações vivas.
2. O nível $n$ tem $n-1$ nós. Mude para **Densidades** e veja onde a partícula nunca é encontrada.
3. Dobre $L$: todas as energias caem a um quarto.`,
      predict: [
        {
          question: "Se a largura do poço infinito dobrar, a energia do estado fundamental:",
          options: ["dobra", "cai pela metade", "cai a um quarto", "não muda"],
          answer: 2,
          explanation: "$E_1 = \\pi^2\\hbar^2/(2mL^2) \\propto 1/L^2$: com $2L$, a energia fica 4 vezes menor.",
        },
      ],
    },
    {
      id: "finito",
      label: "Poço finito: penetração na barreira",
      params: { modo: 1, L: 2, V0: 10, niveis: 6, mostrar: 0 },
      guide: `### Paredes que vazam
1. Compare com o poço infinito de mesma largura: as energias ficam **menores**, porque a função de onda penetra nas paredes (efetivamente o poço fica mais largo).
2. Fora do poço $\\psi \\propto e^{-\\kappa |x|}$, com $\\kappa = \\sqrt{2(V_0 - E)}$: o nível mais alto penetra mais.
3. Diminua $V_0$: o número de estados ligados cai, mas sempre resta pelo menos um.`,
    },
    {
      id: "oscilador",
      label: "Oscilador: níveis igualmente espaçados",
      params: { modo: 2, omega: 1, niveis: 8, mostrar: 0 },
      guide: `### Oscilador harmônico
1. Os níveis são $E_n = (n + \\tfrac12)\\omega$: espaçamento constante $\\omega$ e energia de ponto zero $\\omega/2$.
2. Para $n$ grande, $|\\psi|^2$ se concentra perto dos pontos de retorno clássicos, onde a partícula clássica anda devagar.
3. Escolha **Superposição** com níveis 1 e 2: $\\langle x\\rangle$ oscila com período $2\\pi/\\omega$, como o oscilador clássico (veja o gráfico).`,
      predict: [
        {
          question: "Qual é a menor energia possível de um oscilador quântico de frequência ω (ħ = 1)?",
          options: ["0", "ω/2", "ω", "2ω"],
          answer: 1,
          explanation: "O estado fundamental tem $E_0 = \\hbar\\omega/2$: a partícula não pode ficar parada no fundo do poço (princípio da incerteza).",
        },
      ],
    },
    {
      id: "desenhar",
      label: "Desenhe o seu potencial",
      params: { modo: 4, niveis: 6, mostrar: 0 },
      guide: `### Potencial livre
1. Clique e arraste no palco para desenhar $V(x)$ (0 a 30). Os níveis e as autofunções são recalculados a cada traço.
2. Faça dois poços iguais separados por uma barreira: os níveis aparecem em pares quase degenerados (estados simétrico e antissimétrico).
3. Faça um degrau dentro do poço: onde $E < V$, a função de onda decai; onde $E > V$, oscila com comprimento de onda $2\\pi/\\sqrt{2(E - V)}$.`,
    },
    {
      id: "caixa-2d",
      label: "Poço 2D e caixa 3D: degenerescência",
      params: { modo: 5, dim: 2, L: 2, Ly: 2, Lz: 2, niveis: 5, n1: 2 },
      guide: `### Caixas em duas e três dimensões
1. Num poço quadrado 2D de lado $L$, $E = \\frac{\\pi^2}{2L^2}(n_x^2 + n_y^2)$. O 2º nível tem **dois** estados, $(1,2)$ e $(2,1)$: veja os dois traços na escada e o rótulo $g = 2$.
2. Escolha o nível com **Superposição: nível a** (n1) e compare o mapa de $|\\psi|^2$: os estados degenerados são o mesmo padrão girado de 90°.
3. Torne a caixa retangular ($L_y \\neq L_x$): a simetria some e a degenerescência se desfaz.
4. Passe para **3D** com $L_x = L_y = L_z$: o 2º nível passa a ter $g = 3$, e o nível $(1,2,3)$ tem $g = 6$.`,
      predict: [
        {
          question: "Numa caixa cúbica, quantos estados diferentes têm a energia do primeiro nível excitado?",
          options: ["1", "2", "3", "6"],
          answer: 2,
          explanation: "O nível vem de $n_x^2 + n_y^2 + n_z^2 = 6$: $(2,1,1)$, $(1,2,1)$ e $(1,1,2)$, três estados com a mesma energia.",
        },
      ],
    },
    {
      id: "pontos-quanticos",
      label: "Pontos quânticos: a cor depende do tamanho",
      params: { modo: 6, Rdot: 2.5 },
      guide: `### Nanocristais de CdSe
1. O elétron e o buraco ficam confinados num cristal de poucos nanômetros: a energia de confinamento ($\\propto 1/R^2$) soma-se ao gap $E_g$ do material.
2. Diminua $R$: a energia do fóton sobe e a cor vai do vermelho ao azul. Mesma substância, cores diferentes só pelo tamanho.
3. Aumente $R$: a curva se aproxima de $E_g$ (linha tracejada), o limite do cristal grande.
4. Os currais quânticos (átomos dispostos em anel numa superfície) usam a mesma ideia: as paredes definem as ondas estacionárias permitidas.`,
      predict: [
        {
          question: "Se um ponto quântico de CdSe for fabricado menor, a luz que ele emite fica:",
          options: ["mais avermelhada", "mais azulada", "igual: depende só do material", "invisível"],
          answer: 1,
          explanation: "A energia de confinamento cresce como $1/R^2$; fótons mais energéticos têm comprimento de onda menor (mais azul).",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "infinito",
      prompt: "Um elétron está num poço infinito de largura {Lnm} nm. Qual é a energia do primeiro estado excitado (n = 2)?",
      vary: { Lnm: [0.2, 2, 2] },
      fixed: { modo: 0 },
      answer: {
        label: "E₂",
        unit: "eV",
        compute: (p) => (4 * Math.PI ** 2 * 1.054571817e-34 ** 2) / (2 * 9.1093837015e-31 * (num(p, "Lnm") * 1e-9) ** 2) / 1.602176634e-19,
      },
      hint: "Eₙ = n²π²ħ²/(2mL²); converta joules em eV.",
    },
    {
      id: "oscilador",
      prompt: "Um oscilador quântico tem frequência angular ω = {w} × 10¹⁴ rad/s. Qual é a energia do fóton emitido na transição n = 3 → n = 1?",
      vary: { w: [1, 9, 1] },
      fixed: { modo: 2 },
      answer: { label: "E", unit: "eV", compute: (p) => (2 * 1.054571817e-34 * num(p, "w") * 1e14) / 1.602176634e-19 },
      hint: "Os níveis são igualmente espaçados de ħω.",
    },
  ],

  init: () => ({ drawn: defaultDrawn(), lastBin: null }),
  step: (s) => s,
  dt: 0.02,
  sampleEvery: 5,
  maxSamples: 4000,

  pointer: {
    down: (s, p, pt) => paint({ ...s, lastBin: null }, p, pt),
    move: (s, p, pt, dragging) => (dragging ? paint(s, p, pt) : undefined),
    up: (s) => (s.lastBin !== null ? { ...s, lastBin: null } : undefined),
    cursor: (_s, p, pt) => (kind(p) === 4 && pt.x > BOX.x0 && pt.x < BOX.x1 && pt.y > BOX.y0 && pt.y < BOX.y1 ? "crosshair" : undefined),
  },
  actions: [
    {
      id: "copiar",
      label: "Copiar V(x) atual para o desenho",
      run(s, p) {
        const pp = potParams(p, s);
        const drawn = Array.from({ length: NDRAW }, (_, i) => {
          const x = -X_MAX + ((i + 0.5) * 2 * X_MAX) / NDRAW;
          const v = pp.kind === 4 ? (s.drawn[i] ?? 0) : solvePotentialValue(pp, x);
          return Math.round(Math.min(VDRAW, v) * 2) / 2;
        });
        return { drawn, lastBin: null };
      },
    },
    { id: "plano", label: "Desenho: fundo plano", run: () => ({ drawn: new Array<number>(NDRAW).fill(0), lastBin: null }) },
    { id: "padrao", label: "Desenho: poço com degrau", run: () => ({ drawn: defaultDrawn(), lastBin: null }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    if (kind(p) === BOX_MODE) return renderBox(d, p);
    if (kind(p) === DOT_MODE) return renderDots(d, p);
    const sol = solutionFor(p, s);
    const P = mkPanel(d, p, sol);
    const { xr, er } = ranges(p, sol);
    P.frame({ xlabel: "x", ylabel: "E, V(x)  (ħ = m = 1)" });
    const pp = potParams(p, s);
    const Vf = (x: number) => Math.min(er[1] * 10, solvePotentialValue(pp, x));
    // Potencial, preenchido
    const pts: [number, number][] = [];
    const nS = 400;
    for (let i = 0; i <= nS; i++) {
      const x = xr[0] + ((xr[1] - xr[0]) * i) / nS;
      pts.push([x, Math.min(er[1], Vf(x))]);
    }
    P.clip(() => {
      d.polyline(
        [[P.X(xr[0]), P.Y(er[1])], ...pts.map(([x, v]) => [P.X(x), P.Y(v)] as [number, number]), [P.X(xr[1]), P.Y(er[1])]],
        { close: true, fill: theme.ground, color: "none" },
      );
    });
    P.line(pts, { color: theme.text, width: 2 });
    if (kind(p) === 4) d.text("arraste para desenhar V(x)", BOX.x1, BOX.y1, { align: "right", size: 11, color: theme.accent, dy: -9 });

    const nShow = shownLevels(p, sol);
    const mode = Math.round(num(p, "mostrar"));
    const Erange = er[1] - er[0];
    const spacing = nShow > 1 ? Math.min(...sol.E.slice(1, nShow).map((e, i) => e - sol.E[i]!)) : Erange * 0.3;
    const amp = Math.min(0.42 * Math.max(spacing, Erange * 0.04), Erange * 0.12);
    const xs = sol.x;
    const inView = (x: number) => x >= xr[0] && x <= xr[1];

    if (mode === 2) {
      const [a, b] = supIdx(p);
      const pa = sol.psi[a];
      const pb = sol.psi[b];
      if (pa && pb && a !== b) {
        const Ea = sol.E[a]!;
        const Eb = sol.E[b]!;
        let mx = 0;
        const dens: number[] = [];
        for (let i = 0; i < xs.length; i++) {
          const re = (pa[i]! * Math.cos(Ea * t) + pb[i]! * Math.cos(Eb * t)) / Math.SQRT2;
          const im = -(pa[i]! * Math.sin(Ea * t) + pb[i]! * Math.sin(Eb * t)) / Math.SQRT2;
          dens.push(re * re + im * im);
          mx = Math.max(mx, Math.max(pa[i]! ** 2, pb[i]! ** 2) * 2);
        }
        const base = 0.5 * (Ea + Eb);
        const scale = (Erange * 0.35) / (mx || 1);
        const curve: [number, number][] = [];
        for (let i = 0; i < xs.length; i += 2) if (inView(xs[i]!)) curve.push([xs[i]!, base + dens[i]! * scale]);
        P.line([[curve[0]?.[0] ?? 0, base], ...curve, [curve[curve.length - 1]?.[0] ?? 0, base]], { color: theme.accent, width: 2, fill: theme.accent, alpha: 0.35 });
        P.line(curve, { color: theme.accent, width: 2 });
        for (const e of [Ea, Eb]) P.line([[xr[0], e], [xr[1], e]], { color: theme.muted, dash: [4, 3], width: 1 });
        const xm = meanX(sol, a, b, t);
        d.arrow(P.X(xm), P.Y(base) - 0.9, 0, 0.8, { color: theme.positive });
        d.text("⟨x⟩", P.X(xm), P.Y(base) - 1.1, { color: theme.positive, size: 11 });
        d.text(`|Ψ(x,t)|² de (ψ${a + 1} + ψ${b + 1})/√2`, BOX.x0 + 0.2, BOX.y1 - 0.4, { align: "left", size: 12, weight: "600", color: theme.accent });
      } else {
        d.text("Escolha dois níveis diferentes (e existentes) para a superposição.", BOX.x0 + 0.2, BOX.y1 - 0.4, { align: "left", size: 12, color: theme.negative });
      }
    } else {
      for (let n = 0; n < nShow; n++) {
        const E = sol.E[n]!;
        const psi = sol.psi[n]!;
        let mx = 0;
        for (let i = 0; i < xs.length; i++) mx = Math.max(mx, mode === 1 ? psi[i]! ** 2 : Math.abs(psi[i]!));
        const sc = amp / (mx || 1);
        const color = theme.series[n % theme.series.length]!;
        P.line([[xr[0], E], [xr[1], E]], { color, width: 1, dash: [5, 4], alpha: 0.7 });
        const curve: [number, number][] = [];
        for (let i = 0; i < xs.length; i += 2) if (inView(xs[i]!)) curve.push([xs[i]!, E + (mode === 1 ? psi[i]! ** 2 : psi[i]!) * sc]);
        P.line(curve, { color, width: 2 });
        if (P.inside(xr[1], E)) d.text(`n=${n + 1}  E=${fmt(E, 4)}`, BOX.x1, P.Y(E), { align: "right", size: 10, color, dx: -4, dy: -8 });
      }
      if (kind(p) === 1) {
        const total = sol.E.filter((e) => e < num(p, "V0", 10)).length;
        d.text(`${total} estado(s) ligado(s) com V₀ = ${fmt(num(p, "V0", 10))}`, BOX.x0 + 0.2, BOX.y1 - 0.4, { align: "left", size: 11, color: theme.muted });
      }
    }
  },
});

type D = ReturnType<typeof draw>;

/** Modo 5: escada de níveis com degenerescência (esquerda) e |ψ|² do estado escolhido (direita). */
function renderBox(d: D, p: Params) {
  const { theme } = d;
  const Ls = boxSides(p);
  const lv = boxLevelsFor(p);
  const nShow = Math.max(1, Math.min(lv.length, Math.round(num(p, "niveis", 5)) + 2));
  const shown = lv.slice(0, nShow);
  const sel = Math.max(0, Math.min(shown.length - 1, Math.round(num(p, "n1", 1)) - 1));
  const Emax = shown[shown.length - 1]!.E * 1.12;
  const LB = { x0: 1.4, y0: 0.9, x1: 9.6, y1: 11.0 };
  const P = panel(d, LB, { min: 0, max: 1 }, { min: 0, max: Emax });
  P.frame({ ylabel: "E  (ħ = m = 1)", xticks: [] });
  const dim = Ls.length;
  shown.forEach((l, i) => {
    const g = l.states.length;
    const color = i === sel ? theme.accent : theme.series[i % theme.series.length]!;
    const w = 0.8 / Math.max(g, 1);
    for (let k = 0; k < g; k++) {
      const a = 0.05 + k * w;
      P.line([[a + 0.08 * w, l.E], [a + 0.92 * w, l.E]], { color, width: i === sel ? 3.5 : 2.5 });
    }
    const lab = l.states.length <= 3 ? l.states.map(nsLabel).join(" ") : `${nsLabel(l.states[0]!)} …`;
    d.text(`g=${g}  ${lab}`, LB.x1, P.Y(l.E), { align: "right", size: 10, color, dx: -3, dy: -8 });
  });
  d.text(dim === 3 ? "níveis da caixa 3D" : "níveis do poço 2D", LB.x0 + 0.2, LB.y1 - 0.4, { align: "left", size: 12, weight: "600", color: theme.text });

  // Mapa de |ψ|² do primeiro estado do nível escolhido
  const st = shown[sel]!.states[0]!;
  const [Lx, Ly] = [Ls[0]!, Ls[1]!];
  const R = { x0: 10.6, y0: 1.4, x1: 19.4, y1: 10.4 };
  const sc = Math.min((R.x1 - R.x0) / Lx, (R.y1 - R.y0) / Ly);
  const W = Lx * sc;
  const Hh = Ly * sc;
  const ox = R.x0 + (R.x1 - R.x0 - W) / 2;
  const oy = R.y0 + (R.y1 - R.y0 - Hh) / 2;
  const N = 36;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const v = boxDensity2D(st[0]!, st[1]!, Lx, Ly, ((i + 0.5) * Lx) / N, ((j + 0.5) * Ly) / N);
      if (v > 0.01) d.rect(ox + (i * W) / N, oy + (j * Hh) / N, W / N + 0.01, Hh / N + 0.01, { fill: theme.accent, alpha: v });
    }
  d.rect(ox, oy, W, Hh, { stroke: theme.text, width: 2 });
  const sub = dim === 3 ? `, projeção em xy (n_z = ${st[2]})` : "";
  d.text(`|ψ|² do estado ${nsLabel(st)}${sub}`, (R.x0 + R.x1) / 2, R.y1 + 0.6, { size: 12, weight: "600", color: theme.accent });
  if (shown[sel]!.states.length > 1)
    d.text(`mesma energia: ${shown[sel]!.states.slice(1, 4).map(nsLabel).join(" ")}${shown[sel]!.states.length > 4 ? " …" : ""}`, (R.x0 + R.x1) / 2, R.y0 - 0.3, { size: 11, color: theme.muted });
}

/** Modo 6: fileira de nanocristais coloridos pela emissão e gráfico E(R). */
function renderDots(d: D, p: Params) {
  const { theme } = d;
  const R = rdot(p);
  const radii = [1.5, 2, 2.5, 3, 3.5, 4.5, 6];
  const y = 9.6;
  radii.forEach((r, i) => {
    const x = 2.2 + i * 2.55;
    const nm = photonNm(dotEnergy(r));
    d.circle(x, y, 0.16 * r, { fill: nmToCss(nm), stroke: theme.muted, width: 1 });
    d.text(`${fmt(r, 2)} nm`, x, y - 1.25, { size: 10, color: theme.muted });
    d.text(`${fmt(nm, 3)} nm`, x, y - 1.6, { size: 10, color: theme.muted, dy: 4 });
  });
  const P = panel(d, { x0: 1.4, y0: 0.9, x1: 19.6, y1: 6.6 }, { min: 1.5, max: 6 }, { min: 1.5, max: 3.5 });
  P.frame({ xlabel: "raio R (nm)", ylabel: "energia do fóton (eV)" });
  P.line([[1.5, CDSE.Eg], [6, CDSE.Eg]], { color: theme.muted, dash: [5, 4], width: 1 });
  d.text("E_g do CdSe maciço (1,74 eV)", P.X(6), P.Y(CDSE.Eg), { align: "right", size: 10, color: theme.muted, dx: -4, dy: 8 });
  P.plot(dotEnergy, 1.5, 6, { color: theme.accent, width: 2 });
  const E = dotEnergy(R);
  const col = nmToCss(photonNm(E));
  d.circle(P.X(R), P.Y(E), 0.22, { fill: col, stroke: theme.text, width: 1.5 });
  d.text(`R = ${fmt(R, 2)} nm → E = ${fmt(E, 3)} eV, λ = ${fmt(photonNm(E), 3)} nm`, P.X(R), P.Y(E), { align: R > 4 ? "right" : "left", size: 12, weight: "600", color: theme.text, dx: R > 4 ? -10 : 10, dy: -10 });
}

/** V(x) contínuo (para desenho), com parede infinita truncada. */
function solvePotentialValue(pp: PotentialParams, x: number): number {
  if (pp.kind === 0) return Math.abs(x) < pp.L / 2 ? 0 : 1e9;
  if (pp.kind === 1) return Math.abs(x) < pp.L / 2 ? 0 : pp.V0;
  if (pp.kind === 2) return 0.5 * pp.omega * pp.omega * x * x;
  if (pp.kind === 3) return pp.V0 * ((x * x) / ((pp.L / 2) * (pp.L / 2)) - 1) ** 2;
  const i = Math.max(0, Math.min(NDRAW - 1, Math.floor(((x + X_MAX) / (2 * X_MAX)) * NDRAW)));
  return pp.drawn[i] ?? 0;
}

export default pocoQuantico;
