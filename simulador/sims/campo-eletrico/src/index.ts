import {
  K_COULOMB,
  contourLines,
  defineSim,
  deg,
  draw,
  fieldAt,
  fieldLines,
  niceLevels,
  num,
  pointAlong,
  potentialAt,
  rad,
  sampleGrid,
  texNum,
  traceFieldLine,
  type Bounds,
  type Draw,
  type FieldLine,
  type Params,
  type PointCharge,
  type V2,
} from "@fisilab/core";

/** Carga no palco; q em nC. */
export interface Charge {
  x: number;
  y: number;
  q: number;
}

export interface Dipole {
  /** Centro (pivô fixo), em m. */
  x: number;
  y: number;
  /** Ângulo do momento de dipolo p (de − para +), em rad. */
  th: number;
  /** Velocidade angular, em rad/s. */
  om: number;
}

type Drag = { kind: "charge"; i: number } | { kind: "probe" } | { kind: "dip" } | { kind: "dipRot" } | null;

export interface CampoState {
  charges: Charge[];
  probe: { x: number; y: number };
  dip: Dipole;
  drag: Drag;
  /** Carga selecionada (−1 nenhuma). */
  sel: number;
}

export const VIEW: Bounds = { xMin: -2, xMax: 2, yMin: -1.25, yMax: 1.25 };
/** Região de traçado um pouco maior que o palco, para as linhas poderem voltar. */
const TRACE: Bounds = { xMin: -2.6, xMax: 2.6, yMin: -1.85, yMax: 1.85 };
const HIT = 0.13;
const MAX_CHARGES = 8;
const nC = 1e-9;

// ---------------------------------------------------------------------------
// Física
// ---------------------------------------------------------------------------

export const pointCharges = (s: CampoState): PointCharge[] => s.charges.map((c) => ({ x: c.x, y: c.y, q: c.q * nC }));

/** Campo uniforme externo (N/C). */
export function uniform(p: Params): V2 {
  const e0 = num(p, "E0");
  const a = rad(num(p, "E0ang"));
  return [e0 * Math.cos(a), e0 * Math.sin(a)];
}

/** Campo total (cargas + externo) em N/C. */
export function totalField(s: CampoState, p: Params, x: number, y: number): V2 {
  const [ex, ey] = fieldAt(pointCharges(s), x, y);
  const [ux, uy] = uniform(p);
  return [ex + ux, ey + uy];
}

/** Potencial total em V (referência: infinito para as cargas, origem para o campo uniforme). */
export function totalPotential(s: CampoState, p: Params, x: number, y: number): number {
  const [ux, uy] = uniform(p);
  return potentialAt(pointCharges(s), x, y) - (ux * x + uy * y);
}

/** Posições das cargas do dipolo: [+q, −q]. */
export function dipoleEnds(dip: Dipole, d: number): [V2, V2] {
  const c = Math.cos(dip.th) * (d / 2);
  const sn = Math.sin(dip.th) * (d / 2);
  return [
    [dip.x + c, dip.y + sn],
    [dip.x - c, dip.y - sn],
  ];
}

/** Momento de inércia do haltere (duas massas m nas pontas de uma haste leve de comprimento d). */
export const inertia = (p: Params) => (num(p, "m", 1) * 1e-6 * num(p, "d", 0.4) ** 2) / 2;

/** Torque exato (N·m) sobre o dipolo, somando r × F nas duas cargas (vale também em campo não uniforme). */
export function dipoleTorque(s: CampoState, p: Params, th = s.dip.th): number {
  const q = num(p, "qd") * nC;
  const d = num(p, "d", 0.4);
  const [pos, neg] = dipoleEnds({ ...s.dip, th }, d);
  const Ep = totalField(s, p, pos[0], pos[1]);
  const En = totalField(s, p, neg[0], neg[1]);
  const rx = pos[0] - s.dip.x;
  const ry = pos[1] - s.dip.y;
  return q * (rx * Ep[1] - ry * Ep[0]) + -q * (-rx * En[1] - -ry * En[0]);
}

/** Energia potencial do dipolo (J): U = q[V(r₊) − V(r₋)]. */
export function dipoleU(s: CampoState, p: Params): number {
  const q = num(p, "qd") * nC;
  const [pos, neg] = dipoleEnds(s.dip, num(p, "d", 0.4));
  return q * (totalPotential(s, p, pos[0], pos[1]) - totalPotential(s, p, neg[0], neg[1]));
}

export const dipoleOn = (p: Params) => Math.round(num(p, "dipolo")) === 1;

/** Período de pequenas oscilações em campo uniforme: T = 2π√(I/(pE)). */
export function smallPeriod(p: Params): number {
  const pe = num(p, "qd") * nC * num(p, "d", 0.4) * num(p, "E0");
  return pe > 0 ? 2 * Math.PI * Math.sqrt(inertia(p) / pe) : Infinity;
}

function presetCharges(config: number, q: number): Charge[] {
  switch (config) {
    case 0:
      return [{ x: 0, y: 0, q }];
    case 1:
      return [
        { x: -0.6, y: 0, q },
        { x: 0.6, y: 0, q: -q },
      ];
    case 2:
      return [
        { x: -0.6, y: 0, q },
        { x: 0.6, y: 0, q },
      ];
    case 3:
      return [
        { x: -0.5, y: 0, q: 2 * q },
        { x: 0.5, y: 0, q: -q },
      ];
    case 4:
      return [
        { x: -0.5, y: 0.5, q },
        { x: 0.5, y: 0.5, q: -q },
        { x: 0.5, y: -0.5, q },
        { x: -0.5, y: -0.5, q: -q },
      ];
    default:
      return [];
  }
}

// ---------------------------------------------------------------------------
// Linhas de campo (com cache: só mudam quando as cargas ou o campo externo mudam)
// ---------------------------------------------------------------------------

let cacheKey = "";
let cacheLines: FieldLine[] = [];

export function computeLines(s: CampoState, p: Params): FieldLine[] {
  const ext = uniform(p);
  const key = JSON.stringify([s.charges, ext]);
  if (key === cacheKey) return cacheLines;
  const pcs = pointCharges(s);
  const external = (): V2 => ext;
  const qMax = Math.max(0, ...s.charges.map((c) => Math.abs(c.q)));
  const lines: FieldLine[] =
    qMax > 0 ? fieldLines(pcs, { bounds: TRACE, linesPerUnitCharge: 16 / (qMax * nC) / Math.max(1, Math.sqrt(s.charges.length / 2)), external, startRadius: 0.03 }) : [];
  // Campo externo: linhas extras entrando pela borda "de cima" do fluxo.
  const e0 = Math.hypot(ext[0], ext[1]);
  if (e0 > 0) {
    const ux = ext[0] / e0;
    const uy = ext[1] / e0;
    const field = (x: number, y: number) => totalField(s, p, x, y);
    const negIdx = pcs.map((c, i) => (c.q < 0 ? i : -1)).filter((i) => i >= 0);
    const sinks = negIdx.map((i) => pcs[i]!);
    // Sementes nas bordas por onde o campo entra, numa rede de retas paralelas a E
    // espaçadas de SP (coordenada perpendicular w = −uy·x + ux·y múltipla de SP).
    const SP = 0.4;
    const eps = 1e-6;
    const starts: V2[] = [];
    const B = TRACE;
    const addEdge = (fixedX: number | null, fixedY: number | null) => {
      for (let w = -4; w <= 4 + 1e-9; w += SP) {
        if (fixedX !== null && Math.abs(ux) > 1e-6) {
          const y = (w + uy * fixedX) / ux;
          if (y > B.yMin && y < B.yMax) starts.push([fixedX, y]);
        }
        if (fixedY !== null && Math.abs(uy) > 1e-6) {
          const x = (ux * fixedY - w) / uy;
          if (x > B.xMin && x < B.xMax) starts.push([x, fixedY]);
        }
      }
    };
    if (ux > 1e-6) addEdge(B.xMin + eps, null);
    if (ux < -1e-6) addEdge(B.xMax - eps, null);
    if (uy > 1e-6) addEdge(null, B.yMin + eps);
    if (uy < -1e-6) addEdge(null, B.yMax - eps);
    for (const st of starts) {
      const tr = traceFieldLine(field, st, { bounds: TRACE, sinks, stopRadius: 0.03 });
      lines.push({ points: tr.points, from: -1, to: tr.sink >= 0 ? negIdx[tr.sink]! : -1, end: tr.end });
    }
  }
  cacheKey = key;
  cacheLines = lines;
  return lines;
}

// ---------------------------------------------------------------------------
// Interação
// ---------------------------------------------------------------------------

const near = (a: { x: number; y: number }, x: number, y: number, r = HIT) => Math.hypot(a.x - x, a.y - y) < r;
const clampView = (x: number, y: number): [number, number] => [
  Math.max(VIEW.xMin + 0.05, Math.min(VIEW.xMax - 0.05, x)),
  Math.max(VIEW.yMin + 0.05, Math.min(VIEW.yMax - 0.05, y)),
];

function hit(s: CampoState, p: Params, x: number, y: number): Drag {
  if (near(s.probe, x, y)) return { kind: "probe" };
  if (dipoleOn(p)) {
    const [pos, neg] = dipoleEnds(s.dip, num(p, "d", 0.4));
    if (Math.hypot(pos[0] - x, pos[1] - y) < HIT * 0.8 || Math.hypot(neg[0] - x, neg[1] - y) < HIT * 0.8) return { kind: "dipRot" };
    if (near(s.dip, x, y, HIT * 0.8)) return { kind: "dip" };
  }
  for (let i = s.charges.length - 1; i >= 0; i--) if (near(s.charges[i]!, x, y)) return { kind: "charge", i };
  return null;
}

function addCharge(s: CampoState, q: number): CampoState {
  if (s.charges.length >= MAX_CHARGES) return s;
  // Procura um lugar livre perto do centro.
  const spots: V2[] = [
    [0, 0.8],
    [0, -0.8],
    [-1.2, 0.6],
    [1.2, 0.6],
    [-1.2, -0.6],
    [1.2, -0.6],
    [0, 0],
    [-1.6, 0],
    [1.6, 0],
  ];
  const free = spots.find(([x, y]) => s.charges.every((c) => Math.hypot(c.x - x, c.y - y) > 0.3)) ?? [0, 0];
  const charges = [...s.charges, { x: free[0], y: free[1], q }];
  return { ...s, charges, sel: charges.length - 1 };
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

const fmt = (v: number, digits = 3) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-2)) {
    const [m, e] = v.toExponential(digits - 1).split("e");
    return `${m!.replace(".", ",").replace("-", "−")}×10^${Number(e)}`;
  }
  return Number(v.toPrecision(digits)).toString().replace(".", ",").replace("-", "−");
};

/** Texto com fundo semitransparente (legível sobre as linhas de campo). */
function tag(d: Draw, str: string, x: number, y: number, o: { color?: string; size?: number; align?: "left" | "right" | "center"; weight?: string } = {}) {
  const size = o.size ?? 11;
  d.ctx.save();
  d.ctx.font = `${o.weight ?? "400"} ${size}px system-ui, -apple-system, "Segoe UI", sans-serif`;
  const w = (d.ctx.measureText(str).width + 8) * d.px;
  d.ctx.restore();
  const h = (size + 6) * d.px;
  const align = o.align ?? "center";
  const x0 = align === "left" ? x - 4 * d.px : align === "right" ? x - w + 4 * d.px : x - w / 2;
  d.rect(x0, y - h / 2, w, h, { fill: d.theme.dark ? "#11161d" : "#ffffff", alpha: 0.82 });
  d.text(str, x, y, { color: o.color ?? d.theme.text, size, align, weight: o.weight });
}

function drawCharge(d: Draw, c: Charge, selected: boolean) {
  const { theme } = d;
  const color = c.q > 0 ? theme.positive : c.q < 0 ? theme.negative : theme.muted;
  const r = 9 + Math.min(6, Math.abs(c.q) * 0.6);
  d.dot(c.x, c.y, r + 2, theme.dark ? "#0b0f14" : "#ffffff");
  d.dot(c.x, c.y, r, color);
  if (selected) d.circle(c.x, c.y, (r + 5) * d.px, { stroke: theme.accent, width: 2, dash: [4, 3] });
  d.text(c.q > 0 ? "+" : c.q < 0 ? "−" : "0", c.x, c.y, { color: "#ffffff", size: 14, weight: "700", dy: 1 });
  d.text(`${fmt(c.q, 2)} nC`, c.x, c.y, { color: theme.text, size: 10, dy: r + 10 });
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

export const campoEletrico = defineSim<CampoState>({
  id: "campo-eletrico",
  title: "Campo elétrico: linhas, vetores e dipolo",
  course: "FG III",
  topic: "Campo elétrico",
  priority: "P1",
  summary:
    "Arraste cargas e veja as linhas de campo e os vetores se refazerem. Meça E com uma sonda móvel e solte um dipolo num campo para ver o torque fazê-lo oscilar.",
  equations: [
    String.raw`\vec E(\vec r) = \sum_i \frac{k\,q_i}{|\vec r-\vec r_i|^2}\,\hat r_i + \vec E_0 \qquad k = \frac{1}{4\pi\varepsilon_0} \approx 8{,}99\times10^{9}\ \text{N·m}^2/\text{C}^2`,
    String.raw`\vec p = q\,\vec d \qquad \vec\tau = \vec p\times\vec E \qquad U = -\vec p\cdot\vec E`,
    String.raw`I\,\ddot\theta = -pE\sin(\theta-\theta_E) - b\,\dot\theta \qquad T_{\text{peq}} = 2\pi\sqrt{\frac{I}{pE}},\quad I = \tfrac12 m d^2`,
  ],
  liveEquations(s, p) {
    const [ex, ey] = totalField(s, p, s.probe.x, s.probe.y);
    const out = [
      String.raw`\text{Sonda: } \vec E = (${texNum(ex)},\ ${texNum(ey)})\ \text{N/C} \qquad |\vec E| = ${texNum(Math.hypot(ex, ey))}\ \text{N/C} \qquad V = ${texNum(totalPotential(s, p, s.probe.x, s.probe.y))}\ \text{V}`,
    ];
    if (dipoleOn(p)) {
      out.push(
        String.raw`\tau = ${texNum(dipoleTorque(s, p))}\ \text{N·m} \qquad \theta = ${texNum(deg(s.dip.th))}^\circ \qquad U = ${texNum(dipoleU(s, p))}\ \text{J}`,
      );
      const T = smallPeriod(p);
      if (Number.isFinite(T)) out.push(String.raw`T_{\text{peq}} = 2\pi\sqrt{I/(pE_0)} = ${texNum(T)}\ \text{s}`);
    }
    return out;
  },

  params: [
    {
      key: "config",
      label: "Configuração inicial",
      unit: "",
      min: 0,
      max: 5,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Carga única" },
        { value: 1, label: "Dipolo (+q e −q)" },
        { value: 2, label: "Duas cargas iguais" },
        { value: 3, label: "Cargas desiguais (+2q e −q)" },
        { value: 4, label: "Quadrupolo" },
        { value: 5, label: "Sem cargas (só campo externo)" },
      ],
    },
    { key: "q", label: "Carga q", unit: "nC", min: 0.5, max: 10, step: 0.5, default: 5 },
    {
      key: "vis",
      label: "Mostrar",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Linhas de campo" },
        { value: 1, label: "Grade de vetores" },
        { value: 2, label: "Linhas e vetores" },
        { value: 3, label: "Linhas e equipotenciais" },
      ],
    },
    { key: "E0", label: "Campo externo uniforme E₀", unit: "N/C", min: 0, max: 300, step: 5, default: 0, live: true },
    { key: "E0ang", label: "Direção de E₀", unit: "°", min: -180, max: 180, step: 5, default: 0, live: true },
    {
      key: "dipolo",
      label: "Dipolo de teste",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Desligado" },
        { value: 1, label: "Ligado (pivô no centro)" },
      ],
    },
    { key: "qd", label: "Carga do dipolo", unit: "nC", min: 0.5, max: 10, step: 0.5, default: 5 },
    { key: "d", label: "Comprimento do dipolo", unit: "m", min: 0.1, max: 0.6, step: 0.05, default: 0.4 },
    { key: "m", label: "Massa de cada ponta", unit: "mg", min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: "th0", label: "Ângulo inicial do dipolo", unit: "°", min: -180, max: 180, step: 5, default: 60 },
    { key: "b", label: "Amortecimento b", unit: "nN·m·s", min: 0, max: 200, step: 1, default: 0, live: true },
  ],

  observables: [
    { key: "E", label: "|E| na sonda", unit: "N/C", value: (s, p) => Math.hypot(...totalField(s, p, s.probe.x, s.probe.y)) },
    { key: "Ex", label: "Ex na sonda", unit: "N/C", value: (s, p) => totalField(s, p, s.probe.x, s.probe.y)[0] },
    { key: "Ey", label: "Ey na sonda", unit: "N/C", value: (s, p) => totalField(s, p, s.probe.x, s.probe.y)[1] },
    { key: "V", label: "Potencial na sonda", unit: "V", value: (s, p) => totalPotential(s, p, s.probe.x, s.probe.y) },
    { key: "r", label: "Distância sonda–carga 1", unit: "m", value: (s) => (s.charges[0] ? Math.hypot(s.probe.x - s.charges[0].x, s.probe.y - s.charges[0].y) : 0) },
    { key: "theta", label: "Ângulo do dipolo θ", unit: "°", value: (s) => deg(s.dip.th) },
    { key: "omega", label: "Velocidade angular ω", unit: "rad/s", value: (s) => s.dip.om },
    { key: "tau", label: "Torque no dipolo", unit: "N·m", value: (s, p) => (dipoleOn(p) ? dipoleTorque(s, p) : 0) },
    {
      key: "Emec",
      label: "Energia do dipolo (K + U)",
      unit: "J",
      value: (s, p) => (dipoleOn(p) ? 0.5 * inertia(p) * s.dip.om ** 2 + dipoleU(s, p) : 0),
    },
  ],
  conserved: "Emec",
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "carga",
      label: "Carga única: lei do inverso do quadrado",
      params: { config: 0, q: 5, vis: 2, E0: 0, dipolo: 0 },
      guide: `### Uma carga, linhas radiais
1. As linhas saem da carga positiva em todas as direções; os vetores da grade apontam para fora e encolhem com a distância.
2. Arraste a **sonda** (cruz) para 0,5 m da carga e anote $|\\vec E|$. Leve-a para 1,0 m.
3. Confira $E = kq/r^2$: o observável **Distância sonda–carga 1** ajuda. Monte o gráfico $|E| \\times r$ arrastando a sonda radialmente.
4. Troque o sinal da carga (botão **Inverter sinal**) e veja as linhas mudarem de sentido.`,
      predict: [
        {
          question: "Ao dobrar a distância entre a sonda e a carga, o módulo do campo:",
          options: ["cai à metade", "cai a um quarto", "não muda", "dobra"],
          answer: 1,
          explanation: "O campo de uma carga pontual é $E = kq/r^2$: com $r$ dobrado, $E$ fica dividido por $2^2 = 4$.",
        },
      ],
    },
    {
      id: "dipolo",
      label: "Dipolo elétrico",
      params: { config: 1, q: 5, vis: 3, E0: 0, dipolo: 0 },
      guide: `### Linhas de + para −
1. Todas as linhas que saem da carga $+q$ terminam na $-q$ (cargas iguais em módulo).
2. As **equipotenciais** cortam as linhas de campo sempre em ângulo reto.
3. Leve a sonda à mediatriz do segmento entre as cargas: $\\vec E$ é paralelo ao eixo, apontando da $+$ para a $-$, e $V = 0$ ali.
4. Escolha **Cargas desiguais**: só metade das linhas da $+2q$ chega à $-q$; as demais escapam para longe.`,
    },
    {
      id: "iguais",
      label: "Cargas iguais: ponto de campo nulo",
      params: { config: 2, q: 5, vis: 2, E0: 0, dipolo: 0 },
      guide: `### Onde o campo se anula?
1. Com duas cargas positivas iguais, as linhas se repelem e não há linhas entre elas no ponto médio.
2. Leve a sonda ao ponto médio e confira $|\\vec E| \\approx 0$ (superposição de dois vetores opostos).
3. Arraste uma das cargas para mudar a razão das distâncias. O ponto nulo se desloca para perto da carga menor... ou da mais distante?`,
      predict: [
        {
          question: "No ponto médio entre duas cargas positivas iguais, o campo elétrico é:",
          options: ["máximo", "nulo", "perpendicular à reta que une as cargas", "igual ao de uma carga só"],
          answer: 1,
          explanation: "Os campos das duas cargas têm o mesmo módulo e sentidos opostos no ponto médio, então se cancelam. O potencial ali, porém, não é zero: $V = 2kq/r$.",
        },
      ],
    },
    {
      id: "torque",
      label: "Dipolo num campo uniforme",
      params: { config: 5, vis: 0, E0: 150, E0ang: 0, dipolo: 1, qd: 5, d: 0.4, m: 1, th0: 60, b: 0 },
      guide: `### Torque e oscilação
1. Um dipolo com pivô no centro está num campo uniforme $E_0$. Inicie: ele oscila em torno da direção de $\\vec E$.
2. O torque é $\\tau = pE\\sin(\\theta - \\theta_E)$: zero alinhado, máximo a 90°.
3. Para ângulos pequenos o movimento é harmônico, com $T = 2\\pi\\sqrt{I/(pE)}$. Meça o período no gráfico de $\\theta(t)$ e compare com a equação viva (use $\\theta_0$ pequeno).
4. Com $b = 0$ a energia $K + U$ se conserva; aumente $b$ e veja o dipolo se alinhar com o campo, a posição de menor $U = -pE$.
5. Ligue cargas (botões **+q**, **−q**) perto do dipolo: num campo não uniforme o torque muda de ponto a ponto.`,
      predict: [
        {
          question: "Solto do repouso a 60° do campo, sem atrito, o dipolo:",
          options: ["gira e para alinhado com o campo", "oscila entre +60° e −60°", "gira sem parar", "fica parado, pois a força resultante é nula"],
          answer: 1,
          explanation: "A força resultante é nula, mas o torque não. Sem dissipação a energia $K + U$ se conserva, então o dipolo passa pelo alinhamento com velocidade máxima e volta a parar em −60°, como um pêndulo.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "superposicao",
      prompt:
        "Uma carga de {q1} nC está em x = 0 e outra de {q2} nC em x = {a} m, ambas positivas. Qual é o módulo do campo elétrico no ponto médio entre elas?",
      vary: { q1: [1, 10, 1], q2: [1, 10, 1], a: [0.2, 1.5, 2] },
      answer: {
        label: "|E|",
        unit: "N/C",
        compute: (p) => Math.abs((K_COULOMB * (num(p, "q1") - num(p, "q2")) * nC) / (num(p, "a") / 2) ** 2),
      },
      hint: "No ponto médio os campos têm a mesma direção e sentidos opostos: subtraia os módulos.",
    },
    {
      id: "periodo",
      prompt:
        "Um dipolo com cargas ±{qd} nC separadas por {d} m, com massa de {m} mg em cada ponta, gira em torno do centro num campo uniforme de {E0} N/C. Qual é o período das pequenas oscilações?",
      vary: { qd: [1, 10, 1], d: [0.1, 0.6, 2], m: [0.2, 5, 1], E0: [50, 300, 0] },
      fixed: { config: 5, dipolo: 1 },
      answer: { label: "T", unit: "s", compute: (p) => smallPeriod(p) },
      hint: "I = 2·m·(d/2)² e p = q·d; para θ pequeno, T = 2π√(I/(pE)).",
    },
  ],

  init(p) {
    return {
      charges: presetCharges(Math.round(num(p, "config")), num(p, "q", 5)),
      probe: { x: 0, y: 0.75 },
      dip: { x: 0, y: -0.55, th: rad(num(p, "th0")), om: 0 },
      drag: null,
      sel: -1,
    };
  },

  step(s, p, _t, dt) {
    if (!dipoleOn(p) || s.drag?.kind === "dip" || s.drag?.kind === "dipRot") return s;
    const I = inertia(p);
    const b = num(p, "b") * 1e-9;
    const acc = (th: number, om: number) => (dipoleTorque(s, p, th) - b * om) / I;
    const { th, om } = s.dip;
    const k1t = om;
    const k1w = acc(th, om);
    const k2t = om + 0.5 * dt * k1w;
    const k2w = acc(th + 0.5 * dt * k1t, k2t);
    const k3t = om + 0.5 * dt * k2w;
    const k3w = acc(th + 0.5 * dt * k2t, k3t);
    const k4t = om + dt * k3w;
    const k4w = acc(th + dt * k3t, k4t);
    return {
      ...s,
      dip: {
        ...s.dip,
        th: th + (dt / 6) * (k1t + 2 * k2t + 2 * k3t + k4t),
        om: om + (dt / 6) * (k1w + 2 * k2w + 2 * k3w + k4w),
      },
    };
  },
  dt: 2e-3,
  sampleEvery: 10,
  tEnd: 60,

  viewport: () => ({ ...VIEW, unit: "m" }),

  pointer: {
    down(s, p, pt) {
      const h = hit(s, p, pt.x, pt.y);
      if (!h) return s.sel >= 0 ? { ...s, sel: -1 } : undefined;
      return { ...s, drag: h, sel: h.kind === "charge" ? h.i : s.sel };
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const [x, y] = clampView(pt.x, pt.y);
      const dr = s.drag;
      if (dr.kind === "probe") return { ...s, probe: { x, y } };
      if (dr.kind === "charge") return { ...s, charges: s.charges.map((c, i) => (i === dr.i ? { ...c, x, y } : c)) };
      if (dr.kind === "dip") return { ...s, dip: { ...s.dip, x, y, om: 0 } };
      // Arrastar uma ponta gira o dipolo (a ponta + fica na direção do ponteiro).
      const [pos] = dipoleEnds(s.dip, num(p, "d", 0.4));
      const grabbedPlus = Math.hypot(pos[0] - pt.x, pos[1] - pt.y) < num(p, "d", 0.4) / 2;
      const ang = Math.atan2(pt.y - s.dip.y, pt.x - s.dip.x);
      return { ...s, dip: { ...s.dip, th: grabbedPlus ? ang : ang + Math.PI, om: 0 } };
    },
    up(s) {
      return s.drag ? { ...s, drag: null } : undefined;
    },
    cursor(s, p, pt) {
      return hit(s, p, pt.x, pt.y) ? "grab" : undefined;
    },
  },

  actions: [
    { id: "mais", label: "Adicionar +q", run: (s, p) => addCharge(s, num(p, "q", 5)) },
    { id: "menos", label: "Adicionar −q", run: (s, p) => addCharge(s, -num(p, "q", 5)) },
    {
      id: "inverter",
      label: "Inverter sinal",
      run: (s) => (s.sel >= 0 ? { ...s, charges: s.charges.map((c, i) => (i === s.sel ? { ...c, q: -c.q } : c)) } : s),
    },
    {
      id: "remover",
      label: "Remover carga",
      run: (s) => {
        const i = s.sel >= 0 ? s.sel : s.charges.length - 1;
        return i >= 0 ? { ...s, charges: s.charges.filter((_, j) => j !== i), sel: -1 } : s;
      },
    },
    { id: "limpar", label: "Limpar cargas", run: (s) => ({ ...s, charges: [], sel: -1 }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const vis = Math.round(num(p, "vis"));

    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.xMin, VIEW.yMin, VIEW.xMax - VIEW.xMin, VIEW.yMax - VIEW.yMin);
    ctx.clip();
    d.grid(VIEW.xMin, VIEW.xMax, VIEW.yMin, VIEW.yMax, 0.25);

    // Equipotenciais (potencial amostrado e limitado perto das cargas)
    if (vis === 3) {
      const g = sampleGrid(VIEW, 121, 76, (x, y) => totalPotential(s, p, x, y));
      const vals = Array.from(g.v).filter(Number.isFinite).map(Math.abs).sort((a, b) => a - b);
      const cap = vals[Math.floor(vals.length * 0.9)] ?? 1;
      for (let k = 0; k < g.v.length; k++) g.v[k] = Math.max(-cap, Math.min(cap, g.v[k]!));
      for (const lv of niceLevels(-cap, cap, 14)) {
        const color = lv > 0 ? theme.positive : lv < 0 ? theme.negative : theme.muted;
        for (const line of contourLines(g, lv)) d.polyline(line, { color, width: 1.2, dash: [5, 4], alpha: 0.75 });
      }
    }

    // Grade de vetores: comprimento cresce com |E| (escala raiz), cor fixa
    if (vis === 1 || vis === 2) {
      const pcs = pointCharges(s);
      const qMax = Math.max(1, ...s.charges.map((c) => Math.abs(c.q)));
      const eRef = Math.max(num(p, "E0"), (K_COULOMB * qMax * nC) / 0.6 ** 2);
      for (let x = VIEW.xMin + 0.125; x < VIEW.xMax; x += 0.25)
        for (let y = VIEW.yMin + 0.125; y < VIEW.yMax; y += 0.25) {
          if (pcs.some((c) => Math.hypot(c.x - x, c.y - y) < 0.12)) continue;
          const [ex, ey] = totalField(s, p, x, y);
          const m = Math.hypot(ex, ey);
          if (m === 0) continue;
          const len = 5 + 17 * Math.min(1, Math.sqrt(m / eRef));
          d.arrowPx(x - ((ex / m) * len * d.px) / 2, y - ((ey / m) * len * d.px) / 2, ex, ey, len, {
            color: theme.series[4],
            width: 1.4,
            head: 5,
            alpha: 0.35 + 0.6 * Math.min(1, Math.sqrt(m / eRef)),
          });
        }
    }

    // Linhas de campo com setas de sentido
    if (vis !== 1) {
      for (const l of computeLines(s, p)) {
        d.polyline(l.points, { color: theme.accent, width: 1.3, alpha: 0.85 });
        for (const f of l.from === -1 && l.to === -1 ? [0.3, 0.7] : [0.5]) {
          const a = pointAlong(l.points, f);
          if (a && a.p[0] > VIEW.xMin && a.p[0] < VIEW.xMax && a.p[1] > VIEW.yMin && a.p[1] < VIEW.yMax)
            d.arrowPx(a.p[0] - a.dir[0] * 4 * d.px, a.p[1] - a.dir[1] * 4 * d.px, a.dir[0], a.dir[1], 8, { color: theme.accent, head: 7, width: 1 });
        }
      }
    }

    // Indicador do campo externo
    const e0 = num(p, "E0");
    if (e0 > 0) {
      const [ux, uy] = uniform(p);
      d.arrowPx(VIEW.xMax - 0.35, VIEW.yMax - 0.22, ux, uy, 34, { color: theme.series[5], width: 2.5 });
      tag(d, `E₀ = ${fmt(e0)} N/C`, VIEW.xMax - 0.35, VIEW.yMax - 0.48, { color: theme.series[5], size: 11, weight: "600" });
    }

    s.charges.forEach((c, i) => drawCharge(d, c, i === s.sel));

    // Dipolo de teste
    if (dipoleOn(p)) {
      const dd = num(p, "d", 0.4);
      const [pos, neg] = dipoleEnds(s.dip, dd);
      d.line(neg[0], neg[1], pos[0], pos[1], { color: theme.text, width: 4 });
      d.dot(pos[0], pos[1], 8, theme.positive);
      d.dot(neg[0], neg[1], 8, theme.negative);
      d.text("+", pos[0], pos[1], { color: "#fff", size: 12, weight: "700", dy: 1 });
      d.text("−", neg[0], neg[1], { color: "#fff", size: 12, weight: "700", dy: 1 });
      d.dot(s.dip.x, s.dip.y, 3.5, theme.text);
      // Forças nas pontas
      const q = num(p, "qd") * nC;
      const Fp = totalField(s, p, pos[0], pos[1]);
      const Fn = totalField(s, p, neg[0], neg[1]);
      const fRef = Math.max(1e-12, q * Math.max(Math.hypot(...Fp), Math.hypot(...Fn)));
      d.arrowPx(pos[0], pos[1], Fp[0], Fp[1], 40 * Math.min(1, (q * Math.hypot(...Fp)) / fRef), { color: theme.positive, width: 2 });
      d.arrowPx(neg[0], neg[1], -Fn[0], -Fn[1], 40 * Math.min(1, (q * Math.hypot(...Fn)) / fRef), { color: theme.negative, width: 2 });
      // Seta curva do torque
      const tau = dipoleTorque(s, p);
      if (Math.abs(tau) > 1e-15) {
        const r = dd / 2 + 0.1;
        const a0 = s.dip.th;
        const span = Math.sign(tau) * 0.9;
        const pts: V2[] = [];
        for (let k = 0; k <= 16; k++) {
          const a = a0 + (span * k) / 16;
          pts.push([s.dip.x + r * Math.cos(a), s.dip.y + r * Math.sin(a)]);
        }
        d.polyline(pts, { color: theme.series[1], width: 2 });
        const last = pts[pts.length - 1]!;
        const prev = pts[pts.length - 2]!;
        d.arrowPx(prev[0], prev[1], last[0] - prev[0], last[1] - prev[1], 10, { color: theme.series[1], head: 9 });
        d.text("τ", s.dip.x + (r + 0.1) * Math.cos(a0 + span / 2), s.dip.y + (r + 0.1) * Math.sin(a0 + span / 2), {
          color: theme.series[1],
          size: 13,
          weight: "700",
        });
      }
      d.text("p", pos[0] + 0.12 * Math.cos(s.dip.th), pos[1] + 0.12 * Math.sin(s.dip.th), { color: theme.text, size: 12, weight: "700" });
    }

    // Sonda: E resultante e componentes
    {
      const { x, y } = s.probe;
      const [ex, ey] = totalField(s, p, x, y);
      const m = Math.hypot(ex, ey);
      const qMax = Math.max(1, ...s.charges.map((c) => Math.abs(c.q)));
      const eRef = Math.max(num(p, "E0"), (K_COULOMB * qMax * nC) / 0.6 ** 2);
      const L = Math.min(110, 60 * Math.sqrt(m / eRef));
      if (m > 0 && L > 3) {
        const lx = (ex / m) * L * d.px;
        const ly = (ey / m) * L * d.px;
        d.arrow(x, y, lx, 0, { color: theme.series[2], width: 1.5, dash: [4, 3], head: 7 });
        d.arrow(x, y, 0, ly, { color: theme.series[2], width: 1.5, dash: [4, 3], head: 7 });
        d.line(x + lx, y, x + lx, y + ly, { color: theme.muted, width: 1, dash: [2, 3] });
        d.line(x, y + ly, x + lx, y + ly, { color: theme.muted, width: 1, dash: [2, 3] });
        d.arrow(x, y, lx, ly, { color: theme.series[1], width: 2.6 });
        d.text("E", x + lx, y + ly, { color: theme.series[1], size: 13, weight: "700", dx: 10 * Math.sign(lx || 1), dy: -8 });
      }
      d.circle(x, y, 9 * d.px, { stroke: theme.text, width: 1.5 });
      d.line(x - 13 * d.px, y, x + 13 * d.px, y, { color: theme.text, width: 1 });
      d.line(x, y - 13 * d.px, x, y + 13 * d.px, { color: theme.text, width: 1 });
      const tx = x > 0.9 ? x - 0.1 : x + 0.1;
      const align = x > 0.9 ? "right" : "left";
      // Rótulo acima da sonda (abaixo dela quando não há espaço em cima).
      const ty = y < VIEW.yMax - 0.42 ? y + 0.33 : y - 0.2;
      tag(d, `|E| = ${fmt(m)} N/C`, tx, ty, { size: 11, align, weight: "600" });
      tag(d, `Ex = ${fmt(ex)}   Ey = ${fmt(ey)}  (N/C)`, tx, ty - 0.14, { color: theme.muted, size: 10, align });
    }
    ctx.restore();

    // Legenda
    tag(d, "Arraste as cargas, a sonda (⊕) e o dipolo; clique numa carga para selecioná-la.", VIEW.xMin + 0.06, VIEW.yMin + 0.1, {
      color: theme.muted,
      size: 10,
      align: "left",
    });
  },
});

export default campoEletrico;
