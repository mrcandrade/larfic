import { defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  H,
  KB,
  MEV,
  NLEV,
  NVB,
  U_PS2,
  W,
  areas,
  boltzP,
  countOf,
  fitKT,
  gasT,
  idealP,
  initState,
  kTeps,
  levelCounts,
  massA,
  massB,
  maxwell2d,
  step,
  totalEnergy,
  wallKind,
  type BzState,
} from "./engine.ts";

export * from "./engine.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const GASES = [
  { value: 2, label: "H₂ (2 u)" },
  { value: 4, label: "Hélio (4 u)" },
  { value: 20, label: "Neônio (20 u)" },
  { value: 40, label: "Argônio (40 u)" },
  { value: 84, label: "Criptônio (84 u)" },
  { value: 131, label: "Xenônio (131 u)" },
];

const qbarOf = (s: BzState) => (s.q.length ? s.Q / s.q.length : 0);
const epsK = (p: Params) => (num(p, "eps", 10) * MEV) / KB;
const TA = (s: BzState, p: Params) => (s.mode === 1 ? gasT(s, 0, massA(p)) : 0);
const TB = (s: BzState, p: Params) => (s.mode === 1 ? gasT(s, 1, massB(p)) : 0);
const vrms = (T: number, m: number) => Math.sqrt((2 * 0.00831446 * T) / m) * 1000; // m/s (2D)
const timeOf = (s: BzState) => (s.mode === 0 ? s.k : s.tp);

// layout (mundo 16 × 9)
const BOX = { x0: 0.5, y0: 3.9, sc: 0.3 };
const nearWall = (s: BzState, p: Params, pt: { x: number; y: number }) =>
  s.mode === 1 && (wallKind(p) === 0 || wallKind(p) === 1) && Math.abs(pt.x - (BOX.x0 + s.X * BOX.sc)) < 0.35 && pt.y > BOX.y0 && pt.y < BOX.y0 + H * BOX.sc;

export const boltzmannDoisGases = defineSim<BzState>({
  id: "boltzmann-dois-gases",
  title: "Distribuição de Boltzmann e dois gases em contato",
  course: "FG II",
  topic: "Termodinâmica",
  priority: "P2",
  summary:
    "Osciladores quânticos trocando quanta ao acaso mostram a ocupação dos níveis de energia convergir para e^(−E/kT), com a temperatura medida pela inclinação. Dois gases de massas diferentes separados por uma parede móvel chegam ao mesmo T e à mesma pressão, cada um com sua distribuição de Maxwell — e com volumes na razão dos números de moléculas (Avogadro).",
  equations: [
    String.raw`\frac{N_n}{N} = \frac{e^{-E_n/kT}}{Z} \qquad E_n = n\varepsilon \;\Rightarrow\; \frac{N_n}{N} = (1 - x)\,x^n,\ \ x = e^{-\varepsilon/kT}`,
    String.raw`\bar q = \frac{x}{1-x} \;\Rightarrow\; \frac{kT}{\varepsilon} = \frac{1}{\ln(1 + 1/\bar q)} \qquad \ln\frac{N_n}{N_0} = -\frac{\varepsilon}{kT}\,n`,
    String.raw`\text{gás 2D: } \sum \tfrac12 m v^2 = N k T \qquad f(v) = \frac{m v}{kT}\,e^{-m v^2/2kT} \qquad P\,A = N k T`,
    String.raw`\text{equilíbrio: } T_A = T_B,\ P_A = P_B \;\Rightarrow\; \frac{A_A}{A_B} = \frac{N_A}{N_B}\ \ \text{(Avogadro)} \qquad \frac{v_{\text{rms},A}}{v_{\text{rms},B}} = \sqrt{\frac{m_B}{m_A}}`,
  ],
  liveEquations(s, p) {
    if (s.mode === 0) {
      const qb = qbarOf(s);
      const kt = kTeps(qb);
      const fit = fitKT(s.avg, s.q.length);
      const c = levelCounts(s.q);
      return [
        String.raw`\bar q = \frac{${s.Q}}{${s.q.length}} = ${texNum(qb)} \;\Rightarrow\; \frac{kT}{\varepsilon} = ${texNum(kt)},\ \ T = ${texNum(kt * epsK(p))}\ \text{K}`,
        String.raw`\text{ajuste de } \ln N_n:\ \frac{kT}{\varepsilon} = ${texNum(fit)} \qquad \frac{N_1}{N_0} = \frac{${c[1]}}{${c[0]}} = ${texNum(c[0]! > 0 ? c[1]! / c[0]! : 0)}\ \ (e^{-\varepsilon/kT} = ${texNum(qb / (1 + qb))})`,
      ];
    }
    const mA = massA(p), mB = massB(p);
    const [aA, aB] = areas(s, p);
    const tA = TA(s, p), tB = TB(s, p);
    const nA = countOf(s, 0), nB = countOf(s, 1);
    return [
      String.raw`T_A = ${texNum(tA)}\ \text{K} \qquad T_B = ${texNum(tB)}\ \text{K}`,
      String.raw`P_A = ${texNum(s.PA * U_PS2 * 1e3)}\ \text{mN/m}\ \ (N k T/A = ${texNum(idealP(nA, tA, aA) * U_PS2 * 1e3)}) \qquad P_B = ${texNum(s.PB * U_PS2 * 1e3)}\ \text{mN/m}`,
      String.raw`\frac{A_A}{A_B} = ${texNum(aA / aB)} \qquad \frac{N_A}{N_B} = ${texNum(nB ? nA / nB : 0)} \qquad \frac{v_{\text{rms},A}}{v_{\text{rms},B}} = ${texNum(tB > 0 ? vrms(tA, mA) / vrms(tB, mB) : 0)}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Níveis de energia: distribuição de Boltzmann" },
        { value: 1, label: "Dois gases separados por uma parede" },
      ],
    },
    { key: "N", label: "Níveis: número de osciladores", unit: "", min: 50, max: 1500, step: 50, default: 500 },
    { key: "qbar", label: "Níveis: quanta por oscilador q̄", unit: "", min: 0.2, max: 6, step: 0.1, default: 2 },
    { key: "eps", label: "Níveis: quantum ε", unit: "meV", min: 2, max: 50, step: 1, default: 10 },
    {
      key: "ini",
      label: "Níveis: estado inicial",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Todos com a mesma energia" },
        { value: 1, label: "Energia concentrada em 5% dos osciladores" },
      ],
    },
    {
      key: "escala",
      label: "Níveis: eixo da população",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Linear" },
        { value: 1, label: "Logarítmico" },
      ],
    },
    { key: "mA", label: "Gás A (esquerda)", unit: "u", min: 2, max: 131, step: 1, default: 4, options: GASES },
    { key: "mB", label: "Gás B (direita)", unit: "u", min: 2, max: 131, step: 1, default: 40, options: GASES },
    { key: "NA", label: "Moléculas de A", unit: "", min: 10, max: 200, step: 10, default: 80 },
    { key: "NB", label: "Moléculas de B", unit: "", min: 10, max: 200, step: 10, default: 80 },
    { key: "TA", label: "Temperatura inicial de A", unit: "K", min: 50, max: 1200, step: 10, default: 900 },
    { key: "TB", label: "Temperatura inicial de B", unit: "K", min: 50, max: 1200, step: 10, default: 150 },
    {
      key: "parede",
      label: "Parede entre os gases",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Móvel e diatérmica (pistão livre)" },
        { value: 1, label: "Fixa e diatérmica (presa por mola rígida)" },
        { value: 2, label: "Fixa e adiabática" },
        { value: 3, label: "Retirada (os gases se misturam)" },
      ],
    },
    { key: "M", label: "Massa da parede", unit: "u", min: 4, max: 400, step: 1, default: 40, log: true },
    { key: "x0", label: "Posição inicial da parede (fração da caixa)", unit: "", min: 0.2, max: 0.8, step: 0.05, default: 0.5 },
    { key: "seed", label: "Semente", unit: "", min: 1, max: 999, step: 1, default: 1 },
  ],

  observables: [
    { key: "tf", label: "Tempo (níveis: varreduras; gases: ps)", unit: "", value: (s) => timeOf(s) },
    { key: "kTt", label: "kT/ε previsto por q̄", unit: "", value: (s) => (s.mode === 0 ? kTeps(qbarOf(s)) : 0) },
    { key: "kTf", label: "kT/ε medido (ajuste de ln Nₙ)", unit: "", value: (s) => (s.mode === 0 ? fitKT(s.avg, s.q.length) : 0) },
    { key: "Tniv", label: "Temperatura dos osciladores (ajuste)", unit: "K", value: (s, p) => (s.mode === 0 ? fitKT(s.avg, s.q.length) * epsK(p) : 0) },
    { key: "P0", label: "Fração no nível fundamental", unit: "", value: (s) => (s.mode === 0 && s.q.length ? levelCounts(s.q)[0]! / s.q.length : 0) },
    { key: "r10", label: "N₁/N₀", unit: "", value: (s) => (s.mode === 0 ? (c => (c[0]! > 0 ? c[1]! / c[0]! : 0))(levelCounts(s.q)) : 0) },
    { key: "TA", label: "Temperatura do gás A", unit: "K", value: TA },
    { key: "TB", label: "Temperatura do gás B", unit: "K", value: TB },
    { key: "PA", label: "Pressão de A (parede esquerda)", unit: "mN/m", value: (s) => (s.mode === 1 ? s.PA * U_PS2 * 1e3 : 0) },
    { key: "PB", label: "Pressão de B (parede direita)", unit: "mN/m", value: (s) => (s.mode === 1 ? s.PB * U_PS2 * 1e3 : 0) },
    { key: "X", label: "Posição da parede", unit: "nm", value: (s) => (s.mode === 1 ? s.X : 0) },
    { key: "razA", label: "A_A/A_B (razão das áreas)", unit: "", value: (s, p) => (s.mode === 1 ? (([a, b]) => a / b)(areas(s, p)) : 0) },
    { key: "vA", label: "v_rms do gás A", unit: "m/s", value: (s, p) => (s.mode === 1 ? vrms(TA(s, p), massA(p)) : 0) },
    { key: "vB", label: "v_rms do gás B", unit: "m/s", value: (s, p) => (s.mode === 1 ? vrms(TB(s, p), massB(p)) : 0) },
    { key: "E", label: "Energia total", unit: "zJ", value: (s, p) => totalEnergy(s, p) },
  ],
  conserved: "E",
  chart: { x: "tf", y: "TA" },

  scenarios: [
    {
      id: "boltzmann",
      label: "Níveis de energia: nasce a exponencial",
      params: { modo: 0, N: 500, qbar: 2, ini: 0 },
      guide: `### Quem fica com a energia?
1. Os 500 osciladores começam **todos** com 2 quanta: a barra do nível $n = 2$ tem 100% da população.
2. Rode. A cada varredura, 500 quanta trocam de dono ao acaso. Nada favorece nenhum nível — só a contagem de microestados.
3. A população se espalha até $N_n/N = (1-x)x^n$: o nível **fundamental** fica o mais ocupado e cada nível acima tem a fração $x = e^{-\\varepsilon/kT}$ do anterior.
4. Mude o eixo para **logarítmico**: os pontos ficam numa reta de inclinação $-\\varepsilon/kT$. Compare o $kT/\\varepsilon$ medido com $1/\\ln(1+1/\\bar q) \\approx 2{,}47$.
5. Com $\\varepsilon = 10$ meV, isso é $T \\approx 286$ K. Um único oscilador, em contato com os outros 499 (o "reservatório"), tem exatamente essa distribuição de probabilidade.`,
      predict: [
        {
          question: "Todos os osciladores começam com 2 quanta. Depois de muitas trocas aleatórias, qual nível fica mais ocupado?",
          options: ["O nível n = 2, a média", "O nível fundamental n = 0", "Todos os níveis ficam igualmente ocupados"],
          answer: 1,
          explanation: "Há muito mais maneiras de repartir a energia deixando vários osciladores com pouca energia e poucos com muita. A distribuição mais provável é a de Boltzmann, que decai exponencialmente a partir de n = 0.",
        },
      ],
    },
    {
      id: "temperatura",
      label: "Quente e frio: a inclinação é 1/kT",
      params: { modo: 0, N: 800, qbar: 0.4, ini: 1, escala: 1 },
      guide: `### Temperatura como inclinação
1. Agora $\\bar q = 0{,}4$ e a energia começa concentrada em 5% dos osciladores (muito longe do equilíbrio).
2. No eixo log, a reta é bem inclinada: $kT/\\varepsilon = 1/\\ln 3{,}5 \\approx 0{,}80$. Sistema "frio": quase todos no fundamental.
3. Reinicie com $\\bar q = 5$: a reta fica quase horizontal, $kT/\\varepsilon \\approx 5{,}5$ — no limite clássico $kT \\approx \\bar q\\,\\varepsilon$ (equipartição).
4. Meça a razão $N_1/N_0$ (fator de Boltzmann) e compare com $e^{-\\varepsilon/kT}$.`,
    },
    {
      id: "dois-gases",
      label: "Dois gases: hélio quente × argônio frio",
      params: { modo: 1, mA: 4, mB: 40, NA: 80, NB: 80, TA: 900, TB: 150, parede: 0, M: 40 },
      guide: `### Equilíbrio mecânico e térmico
1. Hélio a 900 K à esquerda, argônio a 150 K à direita, separados por uma parede livre de massa 40 u.
2. Logo de início a parede é empurrada para a direita: $P_A > P_B$. Ela oscila e se acomoda onde $P_A \\approx P_B$ (**equilíbrio mecânico**).
3. Cada choque de uma molécula com a parede troca energia. Acompanhe $T_A$ e $T_B$ no gráfico: elas convergem para $T_f = (N_AT_A + N_BT_B)/(N_A+N_B) = 525$ K (**equilíbrio térmico**).
4. No equilíbrio as temperaturas são iguais, mas os histogramas não: o hélio é $\\sqrt{40/4} \\approx 3{,}2$ vezes mais rápido. Compare $v_{\\text{rms}}$ dos dois.
5. Troque para **parede fixa e adiabática**: nada acontece. Para **fixa e diatérmica**: só o equilíbrio térmico.`,
      predict: [
        {
          question: "Depois do equilíbrio, comparando as moléculas de hélio (4 u) com as de argônio (40 u):",
          options: [
            "Têm a mesma velocidade média, pois a temperatura é a mesma",
            "Têm a mesma energia cinética média; o hélio é cerca de 3 vezes mais rápido",
            "O argônio é mais rápido porque é mais pesado",
          ],
          answer: 1,
          explanation: "Temperatura igual significa energia cinética média igual, ⟨½mv²⟩ = kT (em 2D). Então v_rms ∝ 1/√m e v_He/v_Ar = √(40/4) ≈ 3,2.",
        },
      ],
    },
    {
      id: "avogadro",
      label: "Lei de Avogadro",
      params: { modo: 1, mA: 4, mB: 131, NA: 120, NB: 60, TA: 400, TB: 400, parede: 0, M: 40, x0: 0.5 },
      guide: `### Mesmas P e T, mesmo número de moléculas por volume
1. 120 moléculas de hélio contra 60 de xenônio (33 vezes mais pesado), à mesma temperatura, em metades iguais.
2. Previsão: para onde vai a parede? Rode e espere ~200 ps.
3. A pressão de um gás ideal não depende da massa: $P = NkT/A$. Com $P$ e $T$ iguais, $A_A/A_B = N_A/N_B = 2$: a parede vai para 2/3 da caixa ($x \\approx 26{,}7$ nm).
4. Volumes iguais de gases diferentes, à mesma $P$ e $T$, contêm o mesmo número de moléculas. Arraste a parede para outro lugar e solte: ela volta.`,
      predict: [
        {
          question: "120 moléculas de hélio (leves) e 60 de xenônio (pesadas), à mesma temperatura. Onde a parede livre para?",
          options: ["No meio: o xenônio pesado compensa ter menos moléculas", "Com o hélio ocupando 2/3 da caixa", "Com o xenônio ocupando a maior parte"],
          answer: 1,
          explanation: "P = NkT/A não depende da massa: moléculas pesadas são mais lentas mas dão choques com mais momento, e os efeitos se cancelam. Equilíbrio: A_He/A_Xe = 120/60 = 2.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "fator",
      prompt: "Dois níveis de energia de uma molécula estão separados por {dE} meV. Em equilíbrio a {T} K, qual é a razão entre as populações N₂/N₁ (nível superior/inferior)?",
      vary: { dE: [5, 80, 0], T: [100, 900, 0] },
      answer: { label: "N₂/N₁", unit: "", compute: (p) => Math.exp(-(num(p, "dE") * MEV) / (KB * num(p, "T"))) },
      hint: "Fator de Boltzmann: N₂/N₁ = e^(−ΔE/kT), com k = 8,617 × 10⁻⁵ eV/K.",
    },
    {
      id: "equilibrio",
      prompt:
        "{NA} moléculas de hélio a {TA} K e {NB} moléculas de argônio a {TB} K (gases monoatômicos) trocam energia por uma parede diatérmica, isoladas do resto. Qual é a temperatura final?",
      vary: { NA: [20, 200, 0], TA: [400, 1200, 0], NB: [20, 200, 0], TB: [100, 380, 0] },
      fixed: { modo: 1, parede: 1 },
      answer: {
        label: "T_f",
        unit: "K",
        compute: (p) => (num(p, "NA") * num(p, "TA") + num(p, "NB") * num(p, "TB")) / (num(p, "NA") + num(p, "NB")),
      },
      hint: "A energia por molécula de um gás monoatômico é proporcional a kT, independentemente da massa.",
    },
  ],

  init: initState,
  step: (s, p) => step(s, p),
  dt: 0.04,
  sampleEvery: 5,
  maxSamples: 1200,

  pointer: {
    down: (s, p, pt) => (nearWall(s, p, pt) ? { ...s, grab: true, V: 0 } : undefined),
    move: (s, p, pt, dragging) => {
      if (!dragging || !s.grab) return undefined;
      const X = Math.max(4, Math.min(W - 4, (pt.x - BOX.x0) / BOX.sc));
      // não atravessa moléculas: só permite enquanto ninguém fica do lado errado
      for (let i = 0; i < s.sp.length; i++) if ((s.sp[i] === 0 && s.x[i]! > X - 0.3) || (s.sp[i] === 1 && s.x[i]! < X + 0.3)) return undefined;
      return { ...s, X, X0: wallKind(p) === 1 ? X : s.X0 };
    },
    up: (s) => (s.grab ? { ...s, grab: false, V: 0 } : undefined),
    cursor: (s, p, pt) => (nearWall(s, p, pt) ? "ew-resize" : undefined),
  },
  actions: [
    {
      id: "aquecerA",
      label: "Aquecer o gás A (+30% em T)",
      run: (s) => {
        if (s.mode !== 1) return s;
        const f = Math.sqrt(1.3);
        return { ...s, vx: s.vx.map((v, i) => (s.sp[i] === 0 ? v * f : v)), vy: s.vy.map((v, i) => (s.sp[i] === 0 ? v * f : v)) };
      },
    },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (frame.state.mode === 0) renderLevels(d, frame.state, frame.params);
    else renderGases(d, frame.state, frame.params);
  },
});

// ---------- Desenho: níveis ----------
function renderLevels(d: Draw, s: BzState, p: Params) {
  const { theme } = d;
  const N = s.q.length;
  const qb = qbarOf(s);
  // grade de osciladores
  const gx0 = 0.4, gx1 = 5.6, gy0 = 1.0, gy1 = 8.2;
  const cols = Math.ceil(Math.sqrt((N * (gx1 - gx0)) / (gy1 - gy0)));
  const cell = (gx1 - gx0) / cols;
  for (let i = 0; i < N; i++) {
    const n = s.q[i]!;
    const x = gx0 + (i % cols) * cell;
    const y = gy1 - (Math.floor(i / cols) + 1) * cell;
    d.rect(x, y, cell * 0.9, cell * 0.9, { fill: n === 0 ? theme.grid : theme.positive, alpha: n === 0 ? 1 : Math.min(1, 0.2 + n / (3 * Math.max(qb, 0.5))) });
  }
  d.text(`${N} osciladores, ${s.Q} quanta (cor: energia de cada um)`, gx0, 8.6, { size: 11, weight: "600", align: "left" });
  d.text(`varredura ${s.k}: ${s.k * N} trocas tentadas`, gx0, 0.55, { size: 10, color: theme.muted, align: "left" });

  // diagrama de níveis (população horizontal)
  const lx0 = 6.9, lx1 = 11.4, ly0 = 0.8, ly1 = 8.0;
  const nShow = Math.min(NLEV - 1, Math.max(6, Math.ceil(qb * 4 + 4)));
  const Y = (n: number) => ly0 + (n / nShow) * (ly1 - ly0);
  const logScale = Math.round(num(p, "escala")) === 1;
  const cur = levelCounts(s.q);
  const fmax = Math.max(boltzP(0, qb), ...Array.from(s.avg.slice(0, nShow + 1)));
  const L = (f: number) => {
    if (!logScale) return (f / Math.max(fmax, 1e-9)) * (lx1 - lx0);
    const lo = Math.log(1 / Math.max(N, 2));
    return f <= 0 ? 0 : Math.max(0, ((Math.log(f) - lo) / (Math.log(fmax) - lo)) * (lx1 - lx0));
  };
  d.line(lx0, ly0 - 0.2, lx0, ly1 + 0.3, { color: theme.muted });
  d.text("E = nε", lx0, ly1 + 0.55, { size: 10, color: theme.muted });
  const bh = Math.min(0.18, ((ly1 - ly0) / nShow) * 0.6);
  for (let n = 0; n <= nShow; n++) {
    d.line(lx0 - 0.12, Y(n), lx0, Y(n), { color: theme.muted, width: 1 });
    if (n % Math.ceil(nShow / 10) === 0) d.text(String(n), lx0 - 0.2, Y(n), { size: 9, color: theme.muted, align: "right" });
    d.rect(lx0, Y(n) - bh / 2, L(cur[n]! / N), bh, { fill: theme.accent, alpha: 0.25 });
    d.rect(lx0, Y(n) - bh / 2, L(s.avg[n]!), bh, { fill: theme.accent, alpha: 0.75 });
  }
  const pts: [number, number][] = [];
  for (let n = 0; n <= nShow; n += 0.1) pts.push([lx0 + L(boltzP(n, qb)), Y(n)]);
  d.polyline(pts, { color: theme.positive, width: 2 });
  d.text(logScale ? "população (escala log)" : "população Nₙ/N", lx1, ly0 - 0.4, { size: 10, color: theme.muted, align: "right" });
  d.text("— e^(−E/kT)", lx1, ly1 + 0.55, { size: 10, color: theme.positive, align: "right" });

  // painel numérico
  const kt = kTeps(qb), fit = fitKT(s.avg, N);
  const lines = [
    `q̄ = ${fmt(qb)} quanta/oscilador`,
    `kT/ε previsto = ${fmt(kt)}`,
    `kT/ε medido = ${fmt(fit)}`,
    `T = ${fmt(fit * epsK(p))} K (ε = ${fmt(num(p, "eps", 10))} meV)`,
    `N₁/N₀ = ${fmt(cur[0]! > 0 ? cur[1]! / cur[0]! : 0)}`,
    `e^(−ε/kT) = ${fmt(qb / (1 + qb))}`,
  ];
  lines.forEach((l, i) => d.text(l, 12.0, 7.6 - i * 0.6, { size: 11, align: "left", weight: i === 2 ? "600" : "400" }));
  d.text("barra clara: agora", 12.0, 3.6, { size: 10, color: theme.muted, align: "left" });
  d.text("barra escura: média móvel", 12.0, 3.15, { size: 10, color: theme.muted, align: "left" });
}

// ---------- Desenho: dois gases ----------
function renderGases(d: Draw, s: BzState, p: Params) {
  const { theme } = d;
  const kind = wallKind(p);
  const mA = massA(p), mB = massB(p);
  const X = (x: number) => BOX.x0 + x * BOX.sc;
  const Yb = (y: number) => BOX.y0 + y * BOX.sc;
  const cA = theme.series[0]!, cB = theme.series[1]!;
  d.rect(X(0), Yb(0), W * BOX.sc, H * BOX.sc, { stroke: theme.text, width: 2.5 });
  for (let i = 0; i < s.sp.length; i++) d.circle(X(s.x[i]!), Yb(s.y[i]!), 0.25 * BOX.sc * (s.sp[i] ? Math.min(1.6, 1 + mB / 200) : 1), { fill: s.sp[i] ? cB : cA, minPx: 2.5 });
  if (kind !== 3) {
    const col = kind === 2 ? theme.muted : theme.text;
    d.rect(X(s.X) - 0.06, Yb(0), 0.12, H * BOX.sc, { fill: col, alpha: kind === 2 ? 0.8 : 1 });
    if (kind === 1) d.spring(X(s.X0), Yb(H) + 0.05, X(s.X), Yb(H) + 0.05, { color: theme.muted, coils: 3, amplitudePx: 3, width: 1 });
    if (kind !== 2) d.arrowPx(X(s.X), Yb(H / 2), s.V, 0, Math.min(40, Math.abs(s.V) * 60), { color: theme.positive });
    const lbl = ["parede livre (arraste)", "parede fixa diatérmica", "parede adiabática"][kind]!;
    d.text(lbl, X(s.X), Yb(H) + 0.25, { size: 10, color: theme.muted });
  }
  const tA = gasT(s, 0, mA), tB = gasT(s, 1, mB);
  const nA = countOf(s, 0), nB = countOf(s, 1);
  const name = (m: number) => GASES.find((g) => g.value === m)?.label ?? `${m} u`;
  d.text(`A: ${name(mA)}`, X(0), Yb(H) + 0.25, { size: 11, weight: "600", color: cA, align: "left" });
  d.text(`B: ${name(mB)}`, X(W), Yb(H) + 0.25, { size: 11, weight: "600", color: cB, align: "right" });
  const [aA, aB] = areas(s, p);
  const lines: [string, string][] = [
    [`t = ${fmt(s.tp)} ps`, theme.muted],
    [`T_A = ${fmt(tA)} K`, cA],
    [`T_B = ${fmt(tB)} K`, cB],
    [`P_A = ${fmt(s.PA * U_PS2 * 1e3)} mN/m`, cA],
    [`P_B = ${fmt(s.PB * U_PS2 * 1e3)} mN/m`, cB],
    [`NkT/A: ${fmt(idealP(nA, tA, aA) * U_PS2 * 1e3)} | ${fmt(idealP(nB, tB, aB) * U_PS2 * 1e3)}`, theme.muted],
    [`A_A/A_B = ${fmt(aA / aB)}`, theme.text],
    [`N_A/N_B = ${fmt(nB ? nA / nB : 0)}`, theme.text],
  ];
  lines.forEach(([l, c], i) => d.text(l, 12.8, 8.5 - i * 0.55, { size: 10.5, align: "left", color: c }));

  // histogramas de rapidez
  const hist = (h: Float64Array, x0: number, x1: number, col: string, T: number, m: number, lab: string) => {
    const y0 = 0.6, y1 = 3.0;
    const tot = h.reduce((a, b) => a + b, 0);
    const bw = s.vmax / NVB;
    let peak = 1e-9;
    const dens: number[] = [];
    for (let b = 0; b < NVB; b++) {
      const v = tot > 0 ? h[b]! / (tot * bw) : 0;
      dens.push(v);
      peak = Math.max(peak, v, maxwell2d((b + 0.5) * bw, T, m));
    }
    const Xh = (v: number) => x0 + (v / s.vmax) * (x1 - x0);
    const Yh = (f: number) => y0 + (f / (peak * 1.1)) * (y1 - y0);
    d.line(x0, y0, x1, y0, { color: theme.muted });
    d.line(x0, y0, x0, y1, { color: theme.muted });
    dens.forEach((f, b) => d.rect(Xh(b * bw), y0, (x1 - x0) / NVB * 0.9, Yh(f) - y0, { fill: col, alpha: 0.55 }));
    const curve: [number, number][] = [];
    for (let k = 0; k <= 120; k++) {
      const v = (k / 120) * s.vmax;
      curve.push([Xh(v), Yh(maxwell2d(v, T, m))]);
    }
    d.polyline(curve, { color: col, width: 2 });
    d.text(lab, x0, y1 + 0.25, { size: 10, color: col, align: "left" });
    d.text(`v (m/s) até ${fmt(s.vmax * 1000)}`, x1, y0 - 0.3, { size: 9, color: theme.muted, align: "right" });
  };
  hist(s.hA, 0.8, 7.4, cA, tA, mA, `rapidez de A — Maxwell a ${fmt(tA)} K`);
  hist(s.hB, 8.8, 15.4, cB, tB, mB, `rapidez de B — Maxwell a ${fmt(tB)} K`);
}

export default boltzmannDoisGases;
