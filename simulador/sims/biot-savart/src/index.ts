import { defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  bLongWire,
  bLoopCenter,
  bSolenoidAxis,
  bSolenoidIdeal,
  bToroid,
  fieldAt,
  fmtB,
  longWire,
  loopSegs,
  norm,
  segsFromLoops,
  solenoidSegs,
  toroidSegs,
  type Segs,
  type V3,
} from "./physics.ts";

export * from "./physics.ts";

/** Geometrias disponíveis (parâmetro `modo`). */
export const MODES = ["Desenho livre", "Fio retilíneo longo", "Espira circular", "Solenoide", "Toroide"] as const;
const DESENHO = 0, FIO = 1, ESPIRA = 2, SOLENOIDE = 3, TOROIDE = 4;

export interface BiotState {
  /** Caminho desenhado no plano z = 0, em cm (corrente no sentido do desenho). */
  path: [number, number][];
  closed: boolean;
  drawing: boolean;
  dragProbe: boolean;
  /** Ponto de medida (sonda), em cm, coordenadas físicas (x, y, z). */
  probe: V3;
}

const mode = (p: Params) => Math.round(num(p, "modo"));
const is3D = (p: Params) => mode(p) >= ESPIRA;

// Palco: modo plano usa o próprio plano z = 0; modos 3D mostram vista de cima + corte lateral.
const PLANAR = { xMin: -12, xMax: 12, yMin: -9, yMax: 8.6 };
const TOP_CX = -10.5;
const SIDE_CX = 10.5;
const HALF = 9.5;

/** Retângulo anti-horário de exemplo (cm). */
export const DEFAULT_PATH: [number, number][] = [
  [-7, -4],
  [7, -4],
  [7, 4],
  [-7, 4],
];

/** Segmentos (em metros) da geometria atual, para corrente unitária. */
export function geometrySegs(p: Params, s: BiotState): Segs {
  const R = num(p, "R", 3) / 100;
  const N = Math.max(1, Math.round(num(p, "N", 20)));
  switch (mode(p)) {
    case FIO:
      return longWire();
    case ESPIRA:
      return loopSegs(R);
    case SOLENOIDE:
      return solenoidSegs(R, num(p, "L", 12) / 100, N);
    case TOROIDE:
      return toroidSegs(R, num(p, "a", 1.5) / 100, N);
    default:
      return segsFromLoops([s.path.map(([x, y]) => [x / 100, y / 100, 0] as V3)], s.closed && s.path.length > 2);
  }
}

/** Campo (T) num ponto dado em cm. */
export function fieldCm(p: Params, s: BiotState, P: V3): V3 {
  return fieldAt(geometrySegs(p, s), num(p, "I", 5), [P[0] / 100, P[1] / 100, P[2] / 100]);
}

/** Ponto de referência (cm) onde se compara com a fórmula fechada. */
export function refPoint(p: Params, s: BiotState): V3 {
  if (mode(p) === TOROIDE) {
    const N = Math.max(1, Math.round(num(p, "N", 20)));
    const R = num(p, "R", 3);
    return [R * Math.cos(Math.PI / N), R * Math.sin(Math.PI / N), 0];
  }
  if (mode(p) === ESPIRA || mode(p) === SOLENOIDE) return [0, 0, 0];
  return s.probe;
}

/** Fórmula fechada no ponto de referência (0 quando não há fórmula: desenho livre). */
export function closedForm(p: Params, s: BiotState): number {
  const I = Math.abs(num(p, "I", 5));
  const R = num(p, "R", 3) / 100;
  const N = Math.max(1, Math.round(num(p, "N", 20)));
  switch (mode(p)) {
    case FIO:
      return bLongWire(I, Math.max(1e-4, Math.hypot(s.probe[1], s.probe[2]) / 100));
    case ESPIRA:
      return bLoopCenter(I, R);
    case SOLENOIDE:
      return bSolenoidIdeal(I, N, num(p, "L", 12) / 100);
    case TOROIDE:
      return bToroid(I, N, R);
    default:
      return 0;
  }
}

// ---------- Cache das grades de campo (corrente unitária) ----------

interface GridPt {
  x: number;
  y: number;
  /** Componentes no plano da tela e componente saindo da tela. */
  u: number;
  v: number;
  out: number;
}
let cacheKey = "";
let cacheGrids: GridPt[][] = [];

function geomKey(p: Params, s: BiotState): string {
  const m = mode(p);
  const base = `${m}|${num(p, "R")}|${num(p, "N")}|${num(p, "L")}|${num(p, "a")}`;
  return m === DESENHO ? `${base}|${s.closed}|${s.path.map((q) => q.join(",")).join(";")}` : base;
}

function grids(p: Params, s: BiotState): GridPt[][] {
  const key = geomKey(p, s);
  if (key === cacheKey) return cacheGrids;
  const segs = geometrySegs({ ...p, I: 1 }, s);
  const out: GridPt[][] = [];
  if (!is3D(p)) {
    const g: GridPt[] = [];
    for (let i = -7; i <= 7; i++)
      for (let j = -5; j <= 5; j++) {
        const x = i * 1.5, y = j * 1.5;
        const B = fieldAt(segs, 1, [x / 100, y / 100, 0]);
        g.push({ x, y, u: B[0], v: B[1], out: B[2] });
      }
    out.push(g);
  } else {
    const top: GridPt[] = [];
    const side: GridPt[] = [];
    for (let i = -7; i <= 7; i++)
      for (let j = -7; j <= 7; j++) {
        const a = i * 1.2, b = j * 1.2;
        const Bt = fieldAt(segs, 1, [a / 100, b / 100, 0]);
        top.push({ x: a + TOP_CX, y: b, u: Bt[0], v: Bt[1], out: Bt[2] });
        // Corte y = 0 visto com x para a direita e z para cima: "saindo da tela" é −y.
        const Bs = fieldAt(segs, 1, [a / 100, 0, b / 100]);
        side.push({ x: a + SIDE_CX, y: b, u: Bs[0], v: Bs[2], out: -Bs[1] });
      }
    out.push(top, side);
  }
  cacheKey = key;
  cacheGrids = out;
  return out;
}

// ---------- Mapeamento palco ↔ espaço ----------

function worldToPhys(p: Params, x: number, y: number): V3 {
  if (!is3D(p)) return [Math.max(PLANAR.xMin + 0.5, Math.min(PLANAR.xMax - 0.5, x)), Math.max(-8, Math.min(8, y)), 0];
  const c = (v: number) => Math.max(-HALF + 0.3, Math.min(HALF - 0.3, v));
  return x < 0 ? [c(x - TOP_CX), c(y), 0] : [c(x - SIDE_CX), 0, c(y)];
}

/** Posições do palco onde a sonda aparece (uma ou duas, conforme os painéis). */
function probeMarks(p: Params, P: V3): [number, number][] {
  if (!is3D(p)) return [[P[0], P[1]]];
  const out: [number, number][] = [];
  if (Math.abs(P[2]) < 1e-9) out.push([P[0] + TOP_CX, P[1]]);
  if (Math.abs(P[1]) < 1e-9) out.push([P[0] + SIDE_CX, P[2]]);
  return out;
}

const nearProbe = (p: Params, s: BiotState, x: number, y: number) => probeMarks(p, s.probe).some(([a, b]) => Math.hypot(a - x, b - y) < 0.9);

// ---------- Desenho ----------

function symbol(d: Draw, x: number, y: number, rPx: number, sign: number, color: string, alpha = 1) {
  const r = rPx * d.px;
  d.circle(x, y, r, { stroke: color, width: 1.3, alpha });
  if (sign > 0) d.circle(x, y, r * 0.32, { fill: color, alpha });
  else {
    const k = r * 0.68;
    d.line(x - k, y - k, x + k, y + k, { color, width: 1.3, alpha });
    d.line(x - k, y + k, x + k, y - k, { color, width: 1.3, alpha });
  }
}

function drawGrid(d: Draw, theme: Theme, g: GridPt[], I: number, spacing: number) {
  let max = 0;
  for (const q of g) max = Math.max(max, Math.hypot(q.u, q.v, q.out));
  if (max <= 0) return;
  const spPx = spacing / d.px;
  const lvl = (m: number) => Math.max(0, Math.min(1, 1 + Math.log10(m / max) / 2.5));
  for (const q of g) {
    const inPlane = Math.hypot(q.u, q.v);
    const outM = Math.abs(q.out);
    if (outM > 0.25 * inPlane) {
      const l = lvl(outM);
      if (l > 0.02) symbol(d, q.x, q.y, Math.max(2, spPx * (0.12 + 0.22 * l)), Math.sign(q.out * I), q.out * I > 0 ? theme.positive : theme.negative, 0.3 + 0.7 * l);
    }
    if (inPlane > 0.25 * outM) {
      const l = lvl(inPlane);
      if (l > 0.02) d.arrowPx(q.x - (q.u * Math.sign(I) * 0.4 * spacing) / inPlane, q.y - (q.v * Math.sign(I) * 0.4 * spacing) / inPlane, q.u * I, q.v * I, Math.max(5, spPx * 0.85 * l), { color: theme.accent, width: 1.5, head: 6, alpha: 0.35 + 0.65 * l });
    }
  }
}

function currentArrow(d: Draw, color: string, x: number, y: number, dx: number, dy: number) {
  d.arrowPx(x - dx * 0.001, y - dy * 0.001, dx, dy, 12, { color, width: 2.5, head: 9 });
}

function drawWires(d: Draw, theme: Theme, p: Params, s: BiotState) {
  const col = theme.series[1]!;
  const sg = Math.sign(num(p, "I", 5)) || 1;
  const m = mode(p);
  const R = num(p, "R", 3);
  if (m === DESENHO) {
    const pts = s.path;
    d.polyline(pts, { color: col, width: 3.5, close: s.closed && pts.length > 2 });
    let acc = 0;
    const n = pts.length;
    const segN = s.closed ? n : n - 1;
    for (let i = 0; i < segN; i++) {
      const a = pts[i]!, b = pts[(i + 1) % n]!;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      acc += L;
      if (acc > 3 && L > 1e-6) {
        acc = 0;
        currentArrow(d, col, (a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (b[0] - a[0]) * sg, (b[1] - a[1]) * sg);
      }
    }
    if (pts.length > 1 && !s.closed) {
      d.dot(pts[0]![0], pts[0]![1], 4, col);
      d.dot(pts[n - 1]![0], pts[n - 1]![1], 4, col);
    }
    return;
  }
  if (m === FIO) {
    d.line(PLANAR.xMin, 0, PLANAR.xMax, 0, { color: col, width: 4 });
    for (const x of [-8, 0, 8]) currentArrow(d, col, x, 0, sg, 0);
    d.text("I", -10.8, 0.6, { color: col, weight: "700" });
    return;
  }
  // Vista de cima
  if (m === ESPIRA || m === SOLENOIDE) {
    d.circle(TOP_CX, 0, R, { stroke: col, width: m === SOLENOIDE ? 4 : 3 });
    currentArrow(d, col, TOP_CX + R, 0, 0, sg);
    currentArrow(d, col, TOP_CX - R, 0, 0, -sg);
    // Corte lateral: cada espira fura o plano y = 0 em x = ±R.
    const N = m === ESPIRA ? 1 : Math.max(1, Math.round(num(p, "N", 20)));
    const L = num(p, "L", 12);
    for (let k = 0; k < N; k++) {
      const z = N === 1 ? 0 : -L / 2 + ((k + 0.5) * L) / N;
      const r = N === 1 ? 6 : Math.min(6, Math.max(2, (0.42 * L) / N / d.px));
      symbol(d, SIDE_CX + R, z, r, -sg, col);
      symbol(d, SIDE_CX - R, z, r, sg, col);
    }
    if (m === SOLENOIDE) d.text(`${N} espiras sobrepostas`, TOP_CX, -R - 0.9, { color: col, size: 11 });
    return;
  }
  // Toroide
  const a = num(p, "a", 1.5);
  const N = Math.max(1, Math.round(num(p, "N", 20)));
  d.circle(TOP_CX, 0, R - a, { stroke: col, width: 1, alpha: 0.5 });
  d.circle(TOP_CX, 0, R + a, { stroke: col, width: 1, alpha: 0.5 });
  for (let k = 0; k < N; k++) {
    const ph = (2 * Math.PI * k) / N;
    const c = Math.cos(ph), sn = Math.sin(ph);
    d.line(TOP_CX + (R - a) * c, (R - a) * sn, TOP_CX + (R + a) * c, (R + a) * sn, { color: col, width: 2, alpha: 0.55 });
    if (N <= 40) {
      symbol(d, TOP_CX + (R - a) * c, (R - a) * sn, 3.5, sg, col);
      symbol(d, TOP_CX + (R + a) * c, (R + a) * sn, 3.5, -sg, col);
    }
  }
  for (const side of [1, -1]) {
    d.circle(SIDE_CX + side * R, 0, a, { stroke: col, width: 3 });
    // Nos dois lados a corrente desce no ponto externo e sobe no interno.
    currentArrow(d, col, SIDE_CX + side * (R + a), 0, 0, -sg);
    currentArrow(d, col, SIDE_CX + side * (R - a), 0, 0, sg);
  }
}

export const biotSavart = defineSim<BiotState>({
  id: "biot-savart",
  title: "Biot-Savart: fio, espira, solenoide e toroide",
  course: "FG III",
  topic: "Fontes de B",
  priority: "P1",
  summary:
    "Desenhe um caminho de corrente no palco e veja B calculado pela soma de Biot-Savart sobre cada trecho. Compare fio, espira, solenoide e toroide com as fórmulas fechadas, com vista de cima e corte lateral.",
  equations: [
    String.raw`d\vec B = \frac{\mu_0}{4\pi}\,\frac{I\,d\vec\ell \times \hat r}{r^2}`,
    String.raw`\text{trecho reto: } B = \frac{\mu_0 I}{4\pi d}\,(\cos\theta_1 - \cos\theta_2)`,
    String.raw`B_{\text{fio}} = \frac{\mu_0 I}{2\pi d} \qquad B_{\text{espira}} = \frac{\mu_0 I}{2R} \qquad B_{\text{sol}} = \mu_0 n I \qquad B_{\text{tor}} = \frac{\mu_0 N I}{2\pi r}`,
  ],
  liveEquations(s, p) {
    const B = fieldCm(p, s, s.probe);
    const out = [String.raw`|\vec B|_{\text{sonda}} = ${texNum(norm(B))}\ \text{T} \qquad (B_x, B_y, B_z) = (${texNum(B[0])},\ ${texNum(B[1])},\ ${texNum(B[2])})\ \text{T}`];
    const I = Math.abs(num(p, "I", 5));
    const ref = norm(fieldCm(p, s, refPoint(p, s)));
    const teo = closedForm(p, s);
    const N = Math.max(1, Math.round(num(p, "N", 20)));
    switch (mode(p)) {
      case FIO: {
        const d = Math.hypot(s.probe[1], s.probe[2]) / 100;
        out.push(String.raw`\frac{\mu_0 I}{2\pi d} = \frac{\mu_0 \cdot ${texNum(I)}}{2\pi \cdot ${texNum(d)}\ \text{m}} = ${texNum(teo)}\ \text{T} \quad\text{vs. soma: } ${texNum(ref)}\ \text{T}`);
        break;
      }
      case ESPIRA:
        out.push(String.raw`B_{\text{centro}} = \frac{\mu_0 I}{2R} = ${texNum(teo)}\ \text{T} \quad\text{vs. soma: } ${texNum(ref)}\ \text{T}`);
        break;
      case SOLENOIDE: {
        const fin = bSolenoidAxis(I, N, num(p, "L", 12) / 100, num(p, "R", 3) / 100, 0);
        out.push(String.raw`\mu_0 n I = ${texNum(teo)}\ \text{T} \quad \text{finito no eixo: } ${texNum(fin)}\ \text{T} \quad\text{soma: } ${texNum(ref)}\ \text{T}`);
        break;
      }
      case TOROIDE:
        out.push(String.raw`\frac{\mu_0 N I}{2\pi R} = ${texNum(teo)}\ \text{T} \quad\text{vs. soma (entre espiras): } ${texNum(ref)}\ \text{T}`);
        break;
      default:
        out.push(String.raw`\text{caminho com } ${s.path.length} \text{ pontos, } ${s.closed ? "fechado" : "aberto"} \text{: sem fórmula fechada, só a soma}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Geometria",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: MODES.map((label, value) => ({ value, label })),
    },
    { key: "I", label: "Corrente I", unit: "A", min: -20, max: 20, step: 0.1, default: 5, live: true },
    { key: "R", label: "Raio (espira, solenoide; raio médio do toroide)", unit: "cm", min: 1, max: 6, step: 0.1, default: 3 },
    { key: "N", label: "Número de espiras N", unit: "", min: 1, max: 80, step: 1, default: 20 },
    { key: "L", label: "Comprimento do solenoide", unit: "cm", min: 1, max: 16, step: 0.5, default: 14 },
    { key: "a", label: "Raio da seção do toroide", unit: "cm", min: 0.5, max: 2.5, step: 0.1, default: 1.5 },
  ],

  observables: [
    { key: "B", label: "|B| na sonda", unit: "T", value: (s, p) => norm(fieldCm(p, s, s.probe)) },
    { key: "Bz", label: "Bz na sonda (+ saindo do plano z = 0)", unit: "T", value: (s, p) => fieldCm(p, s, s.probe)[2] },
    { key: "Bref", label: "|B| pela soma no ponto de referência", unit: "T", value: (s, p) => norm(fieldCm(p, s, refPoint(p, s))) },
    { key: "Bteo", label: "Fórmula fechada no ponto de referência", unit: "T", value: (s, p) => closedForm(p, s) },
    {
      key: "desvio",
      label: "Desvio soma × fórmula",
      unit: "%",
      value: (s, p) => {
        const teo = closedForm(p, s);
        return teo > 0 ? (100 * (norm(fieldCm(p, s, refPoint(p, s))) - teo)) / teo : 0;
      },
    },
  ],
  chart: { x: "t", y: "B" },

  scenarios: [
    {
      id: "desenho",
      label: "Desenhe a corrente",
      params: { modo: DESENHO, I: 5 },
      guide: `### Seu próprio circuito
1. Arraste no palco para desenhar um caminho de corrente (o sentido do desenho é o da corrente). Se terminar perto do início, o caminho fecha sozinho.
2. Os símbolos mostram $B$ no plano do desenho: **⊙** (vermelho) sai da tela, **⊗** (azul) entra. O tamanho cresce com $|\\vec B|$ em escala logarítmica.
3. Arraste a sonda (ponto com mira) e leia $|\\vec B|$. Perto de um trecho reto, $B$ cai como $1/d$?
4. Desenhe um "U" aberto e depois feche-o. Como muda o campo no meio?
5. Use **Inverter corrente** e confira a regra da mão direita.`,
      predict: [
        {
          question: "Uma espira retangular no plano da tela é percorrida no sentido anti-horário. No interior dela, B aponta:",
          options: ["para fora da tela (⊙)", "para dentro da tela (⊗)", "no plano da tela, ao longo dos lados", "B é zero no interior"],
          answer: 0,
          explanation: "Cada lado contribui com $d\\vec\\ell \\times \\hat r$ apontando para fora da tela no interior (regra da mão direita). As quatro contribuições se somam.",
        },
      ],
    },
    {
      id: "fio",
      label: "Fio retilíneo longo",
      params: { modo: FIO, I: 10 },
      guide: `### Fio longo
1. Arraste a sonda para várias distâncias $d$ do fio e anote $|\\vec B|$.
2. Compare com $\\mu_0 I/(2\\pi d)$ (equações ao vivo). O fio é feito de dois segmentos de 100 m: o resultado bate com o fio infinito?
3. De um lado do fio $B$ sai da tela, do outro entra. Por quê?`,
      predict: [
        {
          question: "Se a sonda passa de 2 cm para 4 cm do fio, o módulo de B:",
          options: ["cai à metade", "cai a um quarto", "não muda", "dobra"],
          answer: 0,
          explanation: "Para o fio longo $B = \\mu_0 I/(2\\pi d)$: dobrar $d$ divide $B$ por 2.",
        },
      ],
    },
    {
      id: "solenoide",
      label: "Da espira ao solenoide",
      params: { modo: SOLENOIDE, N: 1, L: 14, R: 3, I: 5 },
      guide: `### De uma espira a muitas
1. Com $N = 1$ você tem uma espira: compare o campo no centro com $\\mu_0 I/(2R)$.
2. Aumente $N$ até 80. No **corte lateral**, as linhas ⊙ e ⊗ formam as paredes do solenoide e o campo dentro fica quase uniforme.
3. Compare com $\\mu_0 n I$, com $n = N/L$. Diminua $L$ até ficar comparável a $R$: o desvio cresce. A fórmula do solenoide finito explica a diferença.
4. Leve a sonda para fora do solenoide no corte lateral: o campo é bem menor que dentro.`,
      predict: [
        {
          question: "Dobrando o número de espiras e também o comprimento de um solenoide longo, o campo no centro:",
          options: ["dobra", "cai à metade", "praticamente não muda", "quadruplica"],
          answer: 2,
          explanation: "No solenoide longo $B = \\mu_0 n I$ depende só de espiras por metro, $n = N/L$, que não muda.",
        },
      ],
    },
    {
      id: "toroide",
      label: "Toroide",
      params: { modo: TOROIDE, N: 60, R: 5, a: 2, I: 5 },
      guide: `### Toroide
1. Na vista de cima o campo dentro do núcleo é **azimutal** (setas circulando); no corte lateral ele fura o plano: ⊗ de um lado, ⊙ do outro.
2. Arraste a sonda radialmente dentro do núcleo e verifique $B = \\mu_0 N I/(2\\pi r)$: mais forte perto do furo central.
3. Fora do núcleo, e no buraco do meio, $B$ é praticamente zero. Reduza $N$ para ver o campo "vazar" entre espiras.`,
      predict: [
        {
          question: "Fora do núcleo de um toroide ideal (espiras bem juntas), o campo magnético é:",
          options: ["igual ao de dentro", "praticamente zero", "o de um fio com corrente NI", "maior no buraco central"],
          answer: 1,
          explanation: "Um caminho amperiano fora do núcleo envolve corrente líquida nula (as espiras furam a superfície nos dois sentidos), então $\\oint \\vec B\\cdot d\\vec\\ell = 0$ e, por simetria, $B = 0$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "fio",
      prompt: "Um fio retilíneo longo conduz {I} A. Qual é o módulo do campo magnético a {d} cm do fio?",
      vary: { I: [1, 20, 1], d: [1, 10, 1] },
      fixed: { modo: FIO },
      answer: { label: "B", unit: "μT", compute: (p) => bLongWire(num(p, "I"), num(p, "d", 1) / 100) * 1e6 },
      hint: "B = μ₀I/(2πd), com d em metros.",
    },
    {
      id: "solenoide",
      prompt: "Um solenoide longo de {L} cm de comprimento tem {N} espiras e conduz {I} A. Qual é o campo no seu interior?",
      vary: { L: [8, 16, 0], N: [20, 80, 0], I: [1, 10, 1] },
      fixed: { modo: SOLENOIDE },
      answer: { label: "B", unit: "mT", compute: (p) => bSolenoidIdeal(num(p, "I"), num(p, "N", 1), num(p, "L", 1) / 100) * 1e3 },
      hint: "B = μ₀ n I, com n = N/L em espiras por metro.",
    },
    {
      id: "toroide",
      prompt: "Um toroide de {N} espiras conduz {I} A. Qual é o campo no núcleo a {R} cm do eixo de simetria?",
      vary: { N: [20, 80, 0], I: [1, 10, 1], R: [3, 6, 1] },
      fixed: { modo: TOROIDE },
      answer: { label: "B", unit: "mT", compute: (p) => bToroid(num(p, "I"), num(p, "N", 1), num(p, "R", 1) / 100) * 1e3 },
      hint: "Use Ampère num círculo de raio r dentro do núcleo: B·2πr = μ₀NI.",
    },
  ],

  static: true,
  init(p) {
    const m = mode(p);
    const probe: V3 = m === FIO ? [2, 3, 0] : m === DESENHO ? [0, 0, 0] : m === TOROIDE ? [num(p, "R", 3), 0, 0] : [0, 0, 0];
    return { path: DEFAULT_PATH.map((q) => [q[0], q[1]] as [number, number]), closed: true, drawing: false, dragProbe: false, probe };
  },
  step: (s) => s,

  pointer: {
    down(s, p, pt) {
      if (nearProbe(p, s, pt.x, pt.y)) return { ...s, dragProbe: true };
      if (mode(p) === DESENHO) return { ...s, path: [[pt.x, pt.y]], closed: false, drawing: true };
      return { ...s, probe: worldToPhys(p, pt.x, pt.y), dragProbe: true };
    },
    move(s, p, pt, dragging) {
      if (!dragging) return undefined;
      if (s.dragProbe) return { ...s, probe: worldToPhys(p, pt.x, pt.y) };
      if (s.drawing) {
        const last = s.path[s.path.length - 1];
        const x = Math.max(PLANAR.xMin + 0.3, Math.min(PLANAR.xMax - 0.3, pt.x));
        const y = Math.max(-8.3, Math.min(8.3, pt.y));
        if (last && Math.hypot(x - last[0], y - last[1]) < 0.5) return undefined;
        if (s.path.length >= 400) return undefined;
        return { ...s, path: [...s.path, [x, y]] };
      }
      return undefined;
    },
    up(s) {
      if (s.drawing) {
        const pts = s.path;
        const first = pts[0];
        const last = pts[pts.length - 1];
        const close = pts.length > 4 && first && last && Math.hypot(first[0] - last[0], first[1] - last[1]) < 1.2;
        return { ...s, drawing: false, closed: Boolean(close), path: close ? pts.slice(0, -1) : pts };
      }
      if (s.dragProbe) return { ...s, dragProbe: false };
      return undefined;
    },
    cursor(s, p, pt) {
      if (nearProbe(p, s, pt.x, pt.y)) return "grab";
      return mode(p) === DESENHO ? "crosshair" : "pointer";
    },
  },

  actions: [
    { id: "fechar", label: "Fechar/abrir caminho", run: (s) => ({ ...s, closed: !s.closed && s.path.length > 2 }) },
    { id: "inverter", label: "Inverter corrente (desenho)", run: (s) => ({ ...s, path: s.path.slice().reverse() }) },
    { id: "apagar", label: "Apagar desenho", run: (s) => ({ ...s, path: [], closed: false }) },
    { id: "exemplo", label: "Espira retangular", run: (s) => ({ ...s, path: DEFAULT_PATH.map((q) => [q[0], q[1]] as [number, number]), closed: true }) },
    { id: "centro", label: "Sonda na origem", run: (s) => ({ ...s, probe: [0, 0, 0] }) },
  ],

  narrowSplit: () => 0.499,
  viewport: (p) => (is3D(p) ? { xMin: -21, xMax: 21, yMin: -11, yMax: 10.8, unit: "" } : { ...PLANAR, unit: "cm" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const I = num(p, "I", 5);
    const g = grids(p, s);

    if (is3D(p)) {
      for (const [cx, title, ax2] of [
        [TOP_CX, "Vista de cima (plano z = 0)", "y"],
        [SIDE_CX, "Corte lateral (plano y = 0)", "z"],
      ] as const) {
        d.rect(cx - HALF, -HALF, 2 * HALF, 2 * HALF, { stroke: theme.grid, width: 1 });
        d.text(title, cx, HALF + 0.75, { color: theme.text, size: 12, weight: "600" });
        const ox = cx - HALF + 0.7, oy = -HALF + 0.7;
        d.arrowPx(ox, oy, 1, 0, 26, { color: theme.muted, width: 1.2, head: 6 });
        d.arrowPx(ox, oy, 0, 1, 26, { color: theme.muted, width: 1.2, head: 6 });
        d.text("x", ox + 32 * d.px, oy, { color: theme.muted, size: 10 });
        d.text(ax2, ox, oy + 32 * d.px, { color: theme.muted, size: 10 });
      }
      d.line(-HALF / 2 + TOP_CX, 0, HALF / 2 + TOP_CX, 0, { color: theme.muted, dash: [3, 4], width: 1, alpha: 0.6 });
      d.text("linha y = 0 = plano do corte", TOP_CX + HALF - 0.2, -0.6, { color: theme.muted, size: 9, align: "right" });
      drawGrid(d, theme, g[0]!, I, 1.2);
      drawGrid(d, theme, g[1]!, I, 1.2);
    } else {
      drawGrid(d, theme, g[0]!, I, 1.5);
    }

    drawWires(d, theme, p, s);

    // Sonda
    const B = fieldCm(p, s, s.probe);
    for (const [x, y] of probeMarks(p, s.probe)) {
      d.circle(x, y, 7 * d.px, { stroke: theme.text, width: 2 });
      d.line(x - 10 * d.px, y, x + 10 * d.px, y, { color: theme.text, width: 1 });
      d.line(x, y - 10 * d.px, x, y + 10 * d.px, { color: theme.text, width: 1 });
      d.text(`|B| = ${fmtB(norm(B))}`, x, y + 18 * d.px, { color: theme.text, weight: "600", size: 12 });
    }

    // Legenda
    const ly = is3D(p) ? -10.4 : -8.6;
    const lx = is3D(p) ? -20.5 : PLANAR.xMin + 0.3;
    d.text("⊙ B saindo da tela   ⊗ B entrando   → B no plano   (tamanho ∝ log|B|)", lx, ly, { color: theme.muted, size: 11, align: "left" });
    if (mode(p) === DESENHO) {
      d.text(s.path.length < 2 ? "Arraste para desenhar a corrente" : s.closed ? "Caminho fechado" : "Caminho aberto: só os trechos desenhados contam", PLANAR.xMax - 0.3, ly, { color: theme.accent, size: 11, align: "right" });
    }
  },
});

export default biotSavart;
