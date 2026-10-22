import { clamp, defineSim, deg, draw, num, pointAlong, texNum, type Draw, type Params, type V2 } from "@fisilab/core";
import {
  contactShare,
  inducedSeparation,
  knobCharge,
  leafAngle,
  leavesCharge,
  pointField,
  Q_TOKEN,
  R_ELETROSCOPIO,
  R_KNOB,
  rubTransfer,
  SERIES,
  tribEquilibrium,
  chargeForAngle,
} from "./model.ts";

export * from "./model.ts";

// ---------------------------------------------------------------------------
// Estado e geometria (cm)
// ---------------------------------------------------------------------------

export interface Flow {
  path: V2[];
  /** Fração do caminho percorrida (negativa = ainda não saiu). */
  s: number;
}

export interface Paper {
  x0: number;
  y0: number;
  x: number;
  y: number;
  /** Deslocamento em relação ao bastão quando grudado. */
  stuck: null | { dx: number; dy: number };
}

export interface EState {
  rod: { x: number; y: number; q: number };
  cloth: { x: number; y: number; q: number };
  /** Carga líquida do eletroscópio (nC). */
  qE: number;
  /** Carga que entrou no eletroscópio vinda da terra (nC). */
  qGround: number;
  grounded: boolean;
  touching: boolean;
  /** Separação induzida já representada por elétrons em trânsito (para a animação). */
  sShown: number;
  /** Comprimento total esfregado (cm). */
  rubbed: number;
  drag: null | { what: "rod" | "cloth"; ox: number; oy: number; lx: number; ly: number };
  papers: Paper[];
  flows: Flow[];
}

export const KNOB: V2 = [15, 8];
const HINGE: V2 = [15, -3];
const ROD_W = 14;
const ROD_H = 1.4;
const CLOTH_W = 7;
const CLOTH_H = 4.5;
const TABLE_Y = -15;
const GROUND_PATH: V2[] = [[24, -14], [24, 8], [KNOB[0] + R_KNOB, KNOB[1]]];
const VP = { xMin: -30, xMax: 30, yMin: -18, yMax: 18 };
/** Campo (N/C) a partir do qual os papeizinhos saltam para o bastão. */
export const E_LIFT = 8e4;

export const mode = (p: Params) => Math.round(num(p, "processo"));
const isSphere = (p: Params) => mode(p) === 1;
const rs = (p: Params) => num(p, "Rs", 2);
const matRod = (p: Params) => Math.round(num(p, "matBastao", 1));
const matCloth = (p: Params) => Math.round(num(p, "matPano", 4));

/** Onde fica (efetivamente) a carga do bastão: a metade esfregada, ou o centro da esfera. */
export const rodSource = (s: EState, p: Params): V2 => (isSphere(p) ? [s.rod.x, s.rod.y] : [s.rod.x + ROD_W / 2 - 2.5, s.rod.y]);

const dist = (a: V2, b: V2) => Math.hypot(a[0] - b[0], a[1] - b[1]);

export function isTouching(s: EState, p: Params): boolean {
  if (isSphere(p)) return dist([s.rod.x, s.rod.y], KNOB) <= rs(p) + R_KNOB + 0.25;
  return dist([s.rod.x + ROD_W / 2, s.rod.y], KNOB) <= R_KNOB + ROD_H / 2 + 0.2;
}

/** Separação induzida s no eletroscópio pelas cargas próximas (bastão e pano). */
export function separation(s: EState, p: Params): number {
  let sep = 0;
  if (!(isSphere(p) && s.touching)) sep += inducedSeparation(s.rod.q, dist(rodSource(s, p), KNOB));
  if (mode(p) === 0) sep += inducedSeparation(s.cloth.q, dist([s.cloth.x, s.cloth.y], KNOB));
  return sep;
}

export const qLeaves = (s: EState, p: Params) => (isSphere(p) && s.touching ? 0 : leavesCharge(s.qE, separation(s, p)));
export const qKnob = (s: EState, p: Params) => (isSphere(p) && s.touching ? s.qE : knobCharge(s.qE, separation(s, p)));
export const theta = (s: EState, p: Params) => leafAngle(qLeaves(s, p), num(p, "L", 5), num(p, "m", 30));

function spawn(flows: Flow[], path: V2[], dq: number): Flow[] {
  const n = Math.min(8, Math.round(Math.abs(dq) / Q_TOKEN));
  const out = flows.slice();
  for (let i = 0; i < n; i++) out.push({ path, s: -0.15 * i });
  return out;
}

/**
 * Aplica as regras de equilíbrio depois de qualquer mudança: contato (partilha),
 * aterramento (folhas neutras) e redistribuição por indução (para a animação).
 */
export function settle(s0: EState, p: Params): EState {
  let s: EState = { ...s0, rod: { ...s0.rod } };
  const touch = isTouching(s, p);
  const sph: V2 = [s.rod.x, s.rod.y];
  if (touch && !s.touching) {
    // Contato: condutor partilha até igualar potenciais; isolante cede só um pouco (cargas presas).
    const rA = isSphere(p) ? rs(p) : 1;
    const [qa, qb] = contactShare(s.rod.q, rA, s.qE, R_ELETROSCOPIO);
    const frac = isSphere(p) ? 1 : 0.3;
    const dq = (qb - s.qE) * frac;
    s.qE += dq;
    s.rod.q -= dq;
    if (isSphere(p)) s.rod.q = qa;
    const from: V2 = isSphere(p) ? sph : [s.rod.x + ROD_W / 2, s.rod.y];
    // Elétrons vão no sentido oposto ao da carga positiva.
    s.flows = spawn(s.flows, dq > 0 ? [KNOB, from] : [from, KNOB], dq);
  }
  s.touching = touch;
  if (s.grounded) {
    let target = -2 * separation(s, p);
    if (isSphere(p) && touch) {
      target = 0;
      if (s.rod.q !== 0) {
        s.qGround -= s.rod.q;
        s.rod.q = 0;
      }
    }
    const dq = target - s.qE;
    if (Math.abs(dq) > 1e-12) {
      s.qGround += dq;
      s.qE = target;
      const path = [...GROUND_PATH, HINGE];
      s.flows = spawn(s.flows, dq < 0 ? path : path.slice().reverse(), dq);
    }
  }
  // Animação da indução: elétrons livres migram entre a esfera e as folhas.
  const sep = separation(s, p);
  const d = sep - s.sShown;
  if (Math.abs(d) >= Q_TOKEN) {
    const path: V2[] = [HINGE, [KNOB[0], KNOB[1] - R_KNOB]];
    s = { ...s, flows: spawn(s.flows, d > 0 ? path : path.slice().reverse(), d), sShown: s.sShown + Math.trunc(d / Q_TOKEN) * Q_TOKEN };
  }
  return s;
}

/** Esfrega o pano no bastão por `ds` cm (troca de elétrons pela série triboelétrica). */
export function rub(s: EState, p: Params, ds: number): EState {
  const dq = rubTransfer(s.rod.q, matRod(p), matCloth(p), ds);
  const flows = Math.abs(dq) >= 0.5 ? spawn(s.flows, dq > 0 ? [[s.rod.x, s.rod.y], [s.cloth.x, s.cloth.y]] : [[s.cloth.x, s.cloth.y], [s.rod.x, s.rod.y]], Math.max(1, Math.abs(dq))) : s.flows;
  return { ...s, rod: { ...s.rod, q: s.rod.q + dq }, cloth: { ...s.cloth, q: s.cloth.q - dq }, rubbed: s.rubbed + Math.abs(ds), flows: flows.slice(-24) };
}

const overlapRodCloth = (s: EState) =>
  Math.abs(s.rod.x - s.cloth.x) < (ROD_W + CLOTH_W) / 2 && Math.abs(s.rod.y - s.cloth.y) < (ROD_H + CLOTH_H) / 2;

function rodStart(p: Params): { x: number; y: number } {
  return isSphere(p) ? { x: -10, y: 8 } : { x: -14, y: 8 };
}

function placeRodAt(s: EState, p: Params, gap: number): EState {
  // Coloca a fonte de carga do bastão a `gap` cm da superfície da esfera do eletroscópio.
  if (isSphere(p)) return { ...s, rod: { ...s.rod, x: KNOB[0] - R_KNOB - rs(p) - gap, y: KNOB[1] } };
  return { ...s, rod: { ...s.rod, x: KNOB[0] - R_KNOB - ROD_W / 2 - gap, y: KNOB[1] } };
}

/** Campo das cargas do bastão e do pano num ponto (N/C). */
export function fieldAtPoint(s: EState, p: Params, x: number, y: number): V2 {
  const [sx, sy] = rodSource(s, p);
  const a = pointField(s.rod.q, sx, sy, x, y);
  if (mode(p) !== 0) return a;
  const b = pointField(s.cloth.q, s.cloth.x, s.cloth.y, x, y);
  return [a[0] + b[0], a[1] + b[1]];
}

// ---------------------------------------------------------------------------
// Desenho
// ---------------------------------------------------------------------------

function sign(d: Draw, x: number, y: number, q: number, size = 13, alpha = 1) {
  const pos = q > 0;
  d.ctx.globalAlpha = alpha;
  d.text(pos ? "+" : "−", x, y, { color: pos ? d.theme.positive : d.theme.negative, size, weight: "700" });
  d.ctx.globalAlpha = 1;
}

/** n símbolos da carga q ao longo de um segmento. */
function signsAlong(d: Draw, q: number, a: V2, b: V2, max = 24) {
  const n = Math.min(max, Math.round(Math.abs(q) / Q_TOKEN));
  for (let i = 0; i < n; i++) {
    const f = (i + 0.5) / n;
    sign(d, a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f, q, 12);
  }
}

/** Símbolos na superfície de uma esfera, concentrados no lado indicado por `towards` (rad). */
function signsOnCircle(d: Draw, q: number, c: V2, r: number, towards: number, spread = Math.PI) {
  const n = Math.min(20, Math.round(Math.abs(q) / Q_TOKEN));
  for (let i = 0; i < n; i++) {
    const a = towards + (n === 1 ? 0 : spread * ((i / (n - 1)) - 0.5));
    sign(d, c[0] + (r + 0.55) * Math.cos(a), c[1] + (r + 0.55) * Math.sin(a), q, 12);
  }
}

function drawPaper(d: Draw, s: EState, p: Params, pp: Paper) {
  const w = 3.2;
  const h = 1.4;
  d.rect(pp.x - w / 2, pp.y - h / 2, w, h, { fill: d.theme.dark ? "#e8e4d8" : "#fbf8ee", stroke: d.theme.muted, width: 1 });
  const [Ex, Ey] = fieldAtPoint(s, p, pp.x, pp.y);
  const E = Math.hypot(Ex, Ey);
  const delta = E > 0 ? 0.32 * Math.tanh(E / 3e4) : 0;
  const ux = E > 0 ? Ex / E : 0;
  const uy = E > 0 ? Ey / E : 0;
  for (let i = 0; i < 3; i++)
    for (let j = 0; j < 2; j++) {
      const cx = pp.x - w / 2 + 0.55 + i * 1.05;
      const cy = pp.y - h / 2 + 0.38 + j * 0.64;
      // Molécula: nuvem eletrônica (−) desloca-se contra E, núcleo (+) a favor.
      d.dot(cx - ux * delta, cy - uy * delta, 2.6, d.theme.negative, 0.85);
      d.dot(cx + ux * delta, cy + uy * delta, 1.8, d.theme.positive, 0.95);
    }
}

function drawGroundSymbol(d: Draw, x: number, y: number, color: string) {
  d.line(x - 1.4, y, x + 1.4, y, { color, width: 2 });
  d.line(x - 0.9, y - 0.5, x + 0.9, y - 0.5, { color, width: 2 });
  d.line(x - 0.4, y - 1, x + 0.4, y - 1, { color, width: 2 });
}

// ---------------------------------------------------------------------------
// Simulação
// ---------------------------------------------------------------------------

const seriesOptions = SERIES.map((name, i) => ({ value: i, label: `${i + 1}. ${name}` }));

export const eletrizacao = defineSim<EState>({
  id: "eletrizacao",
  title: "Eletrização e eletroscópio",
  course: "FG III",
  topic: "Eletrostática",
  priority: "P2",
  summary:
    "Esfregue materiais da série triboelétrica, toque e aproxime corpos carregados de um eletroscópio de folhas e aterre-o. Veja os elétrons migrarem, as moléculas do papel se polarizarem e a abertura das folhas calculada pelo equilíbrio de forças.",
  equations: [
    String.raw`Q_{\text{bastão}} + Q_{\text{pano}} = 0 \quad \text{(atrito: a carga se conserva)}`,
    String.raw`\text{contato entre esferas: } \frac{kQ_1'}{R_1} = \frac{kQ_2'}{R_2} \;\Rightarrow\; Q_1' = (Q_1 + Q_2)\,\frac{R_1}{R_1 + R_2}`,
    String.raw`\text{indução: } q_{\text{folhas}} = \tfrac12 q_E + s,\quad q_{\text{esfera}} = \tfrac12 q_E - s,\quad s \approx \frac{QR}{2d}`,
    String.raw`\text{folhas: } \frac{k\,(q/2)^2}{(2L\,\text{sen}\,\theta)^2} = m g\,\text{tg}\,\theta`,
  ],
  liveEquations(s, p) {
    const sep = separation(s, p);
    const ql = qLeaves(s, p);
    const th = theta(s, p);
    const out = [
      String.raw`s = ${texNum(sep)}\ \text{nC} \qquad q_{\text{folhas}} = \tfrac12(${texNum(s.qE)}) + ${texNum(sep)} = ${texNum(ql)}\ \text{nC}`,
      String.raw`\theta = ${texNum(deg(th))}^\circ \quad (L = ${texNum(num(p, "L", 5))}\ \text{cm},\ m = ${texNum(num(p, "m", 30))}\ \text{mg})`,
    ];
    if (mode(p) === 0)
      out.unshift(
        String.raw`Q_{\text{bastão}} = ${texNum(s.rod.q)}\ \text{nC} \to Q_{\text{sat}} = ${texNum(tribEquilibrium(matRod(p), matCloth(p)))}\ \text{nC} \qquad Q_{\text{pano}} = ${texNum(s.cloth.q)}\ \text{nC}`,
      );
    if (mode(p) === 1)
      out.unshift(String.raw`Q_{\text{esfera}}' = (Q + q_E)\frac{R_s}{R_s + R_E} \quad R_s = ${texNum(rs(p))}\ \text{cm},\ R_E = ${R_ELETROSCOPIO}\ \text{cm}`);
    return out;
  },

  params: [
    {
      key: "processo",
      label: "Processo",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Atrito (série triboelétrica)" },
        { value: 1, label: "Contato (esfera metálica)" },
        { value: 2, label: "Indução com aterramento" },
      ],
    },
    { key: "matBastao", label: "Material do bastão", unit: "", min: 0, max: 9, step: 1, default: 1, options: seriesOptions },
    { key: "matPano", label: "Material do pano", unit: "", min: 0, max: 9, step: 1, default: 4, options: seriesOptions },
    { key: "Q0", label: "Carga inicial do bastão/esfera", unit: "nC", min: -20, max: 20, step: 1, default: 12 },
    { key: "Rs", label: "Raio da esfera metálica", unit: "cm", min: 1, max: 4, step: 0.1, default: 2 },
    { key: "L", label: "Comprimento das folhas", unit: "cm", min: 3, max: 8, step: 0.1, default: 5, live: true },
    { key: "m", label: "Massa de cada folha", unit: "mg", min: 5, max: 100, step: 1, default: 30, live: true },
  ],

  observables: [
    { key: "qBastao", label: "Carga do bastão/esfera", unit: "nC", value: (s) => s.rod.q },
    { key: "qPano", label: "Carga do pano", unit: "nC", value: (s) => s.cloth.q },
    { key: "qE", label: "Carga líquida do eletroscópio", unit: "nC", value: (s) => s.qE },
    { key: "qFolhas", label: "Carga nas folhas", unit: "nC", value: (s, p) => qLeaves(s, p) },
    { key: "qEsfera", label: "Carga na esfera do eletroscópio", unit: "nC", value: (s, p) => qKnob(s, p) },
    { key: "theta", label: "Abertura de cada folha θ", unit: "°", value: (s, p) => deg(theta(s, p)) },
    { key: "d", label: "Distância bastão–eletroscópio", unit: "cm", value: (s, p) => dist(rodSource(s, p), KNOB) },
    { key: "qTerra", label: "Carga vinda da terra", unit: "nC", value: (s) => s.qGround },
    { key: "qTotal", label: "Carga total (sem a terra)", unit: "nC", value: (s) => s.rod.q + s.cloth.q + s.qE - s.qGround },
  ],
  conserved: "qTotal",
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "atrito",
      label: "Vidro esfregado na seda",
      params: { processo: 0, matBastao: 1, matPano: 4 },
      guide: `### Atrito e a série triboelétrica
1. Arraste o **pano** para cima do bastão e esfregue (vai e vem), ou use **Esfregar 10 vezes**.
2. Observe os elétrons (−) passando de um material para o outro. Quem fica positivo? Compare com a posição na série.
3. Confira que $Q_{\\text{bastão}} + Q_{\\text{pano}} = 0$ o tempo todo: nenhuma carga é criada.
4. Aproxime o bastão dos **papeizinhos** (embaixo, à esquerda): as moléculas se polarizam e o papel salta quando $E > 8\\times10^4$ N/C.
5. Leve o bastão até perto do eletroscópio sem encostar: as folhas abrem por **indução**. Afaste e elas fecham.
6. Troque para PVC e lã e repita.`,
      predict: [
        {
          question: "Um bastão de vidro é esfregado num pano de seda. Com que carga cada um fica?",
          options: ["Vidro +, seda −", "Vidro −, seda +", "Os dois ficam positivos", "Nenhum fica carregado"],
          answer: 0,
          explanation:
            "O vidro está acima da seda na série triboelétrica: perde elétrons para ela. O vidro fica positivo e a seda fica com a mesma carga, negativa.",
        },
      ],
    },
    {
      id: "contato",
      label: "Contato com esfera metálica",
      params: { processo: 1, Q0: 12, Rs: 2 },
      guide: `### Partilha de carga por contato
1. Arraste a esfera metálica carregada até encostar na esfera do eletroscópio (ou use **Encostar**).
2. Os elétrons fluem até os potenciais $kQ/R$ ficarem iguais: $Q_s' = (Q_s + q_E)\\,R_s/(R_s + R_E)$, com $R_E = 2$ cm.
3. Afaste a esfera: o eletroscópio continua aberto, agora com carga **do mesmo sinal** da esfera.
4. Encoste de novo: nada muda, porque os potenciais já estão iguais.
5. Mude o raio $R_s$ e preveja quanto fica em cada corpo.`,
      predict: [
        {
          question: "Uma esfera de raio 2 cm com 12 nC toca o eletroscópio neutro (equivalente a uma esfera de 2 cm). Quanto fica no eletroscópio?",
          options: ["12 nC", "6 nC", "0", "24 nC"],
          answer: 1,
          explanation: "Com raios iguais os potenciais se igualam quando as cargas são iguais: 12 nC se dividem em 6 nC para cada um.",
        },
      ],
    },
    {
      id: "inducao",
      label: "Carregar por indução",
      params: { processo: 2, Q0: 12 },
      guide: `### Carga por indução com aterramento
1. Use **Aproximar** (sem encostar): a esfera fica com $-s$ e as folhas com $+s$; o eletroscópio continua neutro.
2. **Aterre**: os elétrons sobem da terra e neutralizam as folhas, que fecham.
3. **Desligue a terra** com o bastão ainda perto.
4. Agora **afaste** o bastão: a carga $-QR/d$ que ficou se espalha e as folhas abrem de novo.
5. Que sinal tem o eletroscópio no fim? Compare com o do bastão.`,
      predict: [
        {
          question: "Depois de aproximar um bastão positivo, aterrar, desligar a terra e afastar o bastão, o eletroscópio fica…",
          options: ["Positivo", "Negativo", "Neutro"],
          answer: 1,
          explanation:
            "Durante o aterramento, elétrons subiram da terra atraídos pelo bastão positivo. Desligada a terra, eles ficam presos: o eletroscópio termina negativo, o sinal oposto ao do indutor.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "contato-esferas",
      prompt:
        "Uma esfera metálica de raio {Rs} cm, com carga {Q0} nC, toca um eletroscópio neutro que equivale a uma esfera condutora de raio 2 cm. Que carga fica no eletroscópio depois do contato?",
      vary: { Rs: [1, 4, 1], Q0: [5, 20, 0] },
      fixed: { processo: 1 },
      answer: { label: "Carga do eletroscópio", unit: "nC", compute: (p) => contactShare(num(p, "Q0"), num(p, "Rs"), 0, R_ELETROSCOPIO)[1] },
      hint: "No equilíbrio os potenciais kQ/R se igualam; a carga total se conserva.",
    },
    {
      id: "folhas",
      prompt:
        "As folhas de um eletroscópio têm {L} cm de comprimento e {m} mg cada. Elas abrem {ang}° em relação à vertical. Qual a carga total nas duas folhas (em módulo)? Use g = 9,81 m/s² e k = 8,99 × 10⁹ N·m²/C².",
      vary: { L: [3, 7, 1], m: [10, 60, 0], ang: [10, 35, 0] },
      answer: { label: "Carga nas folhas", unit: "nC", compute: (p) => chargeForAngle((num(p, "ang") * Math.PI) / 180, num(p, "L"), num(p, "m")) },
      hint: "Cada folha tem q/2 e as pontas ficam a 2L sen θ. Equilíbrio: k(q/2)²/(2L sen θ)² = mg tg θ.",
    },
  ],

  init(p) {
    const m = mode(p);
    const start = rodStart(p);
    return {
      rod: { ...start, q: m === 0 ? 0 : num(p, "Q0", 12) },
      cloth: { x: -14, y: 1.5, q: 0 },
      qE: 0,
      qGround: 0,
      grounded: false,
      touching: false,
      sShown: 0,
      rubbed: 0,
      drag: null,
      papers: [-24, -19.5, -15].map((x) => ({ x0: x, y0: TABLE_Y + 0.7, x, y: TABLE_Y + 0.7, stuck: null })),
      flows: [],
    };
  },

  step(s0, p, _t, dt) {
    let s = settle(s0, p);
    const flows = s.flows.map((f) => ({ ...f, s: f.s + dt / 0.7 })).filter((f) => f.s < 1);
    const papers = s.papers.map((pp) => {
      if (pp.stuck) {
        if (Math.abs(s.rod.q) < 2) return { ...pp, stuck: null };
        return { ...pp, x: s.rod.x + pp.stuck.dx, y: s.rod.y + pp.stuck.dy };
      }
      const [Ex, Ey] = fieldAtPoint(s, p, pp.x, pp.y);
      const below = !isSphere(p) && pp.x > s.rod.x - ROD_W / 2 && pp.x < s.rod.x + ROD_W / 2 && s.rod.y > pp.y;
      if (Math.hypot(Ex, Ey) > E_LIFT && below) {
        const ny = pp.y + 25 * dt;
        const top = s.rod.y - ROD_H / 2 - 0.7;
        if (ny >= top) return { ...pp, y: top, stuck: { dx: pp.x - s.rod.x, dy: top - s.rod.y } };
        return { ...pp, y: ny };
      }
      // Cai de volta para a mesa.
      const ny = Math.max(pp.y0, pp.y - 25 * dt);
      return { ...pp, y: ny };
    });
    s = { ...s, flows, papers };
    return s;
  },
  dt: 0.02,
  sampleEvery: 5,
  maxSamples: 4000,

  pointer: {
    down(s, p, pt) {
      const rodHit = isSphere(p)
        ? Math.hypot(pt.x - s.rod.x, pt.y - s.rod.y) <= rs(p) + 0.6 || (Math.abs(pt.x - s.rod.x) < 0.8 && pt.y < s.rod.y && pt.y > s.rod.y - 9)
        : Math.abs(pt.x - s.rod.x) <= ROD_W / 2 + 0.4 && Math.abs(pt.y - s.rod.y) <= ROD_H / 2 + 0.6;
      const clothHit = mode(p) === 0 && Math.abs(pt.x - s.cloth.x) <= CLOTH_W / 2 && Math.abs(pt.y - s.cloth.y) <= CLOTH_H / 2;
      if (clothHit) return { ...s, drag: { what: "cloth", ox: pt.x - s.cloth.x, oy: pt.y - s.cloth.y, lx: pt.x, ly: pt.y } };
      if (rodHit) return { ...s, drag: { what: "rod", ox: pt.x - s.rod.x, oy: pt.y - s.rod.y, lx: pt.x, ly: pt.y } };
      return undefined;
    },
    move(s, p, pt, dragging) {
      const g = s.drag;
      if (!dragging || !g) return undefined;
      const x = clamp(pt.x - g.ox, VP.xMin + 2, VP.xMax - 2);
      const y = clamp(pt.y - g.oy, TABLE_Y + 2, VP.yMax - 1.5);
      let n: EState = g.what === "rod" ? { ...s, rod: { ...s.rod, x, y } } : { ...s, cloth: { ...s.cloth, x, y } };
      const ds = Math.hypot(pt.x - g.lx, pt.y - g.ly);
      n = { ...n, drag: { ...g, lx: pt.x, ly: pt.y } };
      if (mode(p) === 0 && overlapRodCloth(n)) n = rub(n, p, ds);
      return settle(n, p);
    },
    up: (s, p) => (s.drag ? settle({ ...s, drag: null }, p) : undefined),
    cursor(s, p, pt) {
      if (mode(p) === 0 && Math.abs(pt.x - s.cloth.x) <= CLOTH_W / 2 && Math.abs(pt.y - s.cloth.y) <= CLOTH_H / 2) return "grab";
      if (isSphere(p) ? Math.hypot(pt.x - s.rod.x, pt.y - s.rod.y) <= rs(p) + 0.6 : Math.abs(pt.x - s.rod.x) <= ROD_W / 2 && Math.abs(pt.y - s.rod.y) <= ROD_H) return "grab";
      return undefined;
    },
  },

  actions: [
    {
      id: "esfregar",
      label: "Esfregar 10 vezes (atrito)",
      run(s, p) {
        if (mode(p) !== 0) return s;
        let n: EState = { ...s, cloth: { ...s.cloth, x: s.rod.x, y: s.rod.y } };
        for (let i = 0; i < 10; i++) n = rub(n, p, 2 * ROD_W);
        n = { ...n, cloth: { ...n.cloth, x: s.rod.x, y: s.rod.y - 6.5 } };
        return settle(n, p);
      },
    },
    { id: "aproximar", label: "Aproximar (sem encostar)", run: (s, p) => settle(placeRodAt(s, p, 2.5), p) },
    { id: "encostar", label: "Encostar no eletroscópio", run: (s, p) => settle(placeRodAt(s, p, 0), p) },
    { id: "afastar", label: "Afastar", run: (s, p) => settle({ ...s, rod: { ...s.rod, ...rodStart(p) } }, p) },
    { id: "terra", label: "Ligar / desligar a terra", run: (s, p) => settle({ ...s, grounded: !s.grounded }, p), active: (s) => s.grounded },
  ],

  viewport: () => ({ ...VP, unit: "cm" }),

  render(ctx, frame) {
    const { state: s, params: p, theme } = frame;
    const d = draw(ctx, frame);
    const metal = theme.dark ? "#8d99a8" : "#b9c3cf";
    const gold = theme.series[5] ?? theme.accent;

    // Mesa
    d.support(VP.xMin + 1, TABLE_Y, VP.xMax - 1, TABLE_Y, { color: theme.muted });

    // Terra (fio com chave)
    const gc = s.grounded ? theme.series[2] ?? theme.accent : theme.muted;
    d.line(KNOB[0] + R_KNOB, KNOB[1], 21.5, KNOB[1], { color: gc, width: 1.5 });
    if (s.grounded) d.line(21.5, KNOB[1], 24, KNOB[1], { color: gc, width: 1.5 });
    else d.line(21.5, KNOB[1], 23.6, KNOB[1] + 1.4, { color: gc, width: 1.5 });
    d.dot(21.5, KNOB[1], 3, gc);
    d.line(24, KNOB[1], 24, -14, { color: gc, width: 1.5 });
    drawGroundSymbol(d, 24, -14, gc);
    d.text(s.grounded ? "terra ligada" : "terra desligada", 24, KNOB[1] + 2.4, { color: gc, size: 12 });

    // Eletroscópio: frasco, haste, esfera e folhas
    d.rect(8, -12.5, 14, 14, { stroke: theme.muted, width: 1.2, fill: theme.dark ? "rgba(140,170,200,0.06)" : "rgba(120,160,200,0.08)" });
    d.rect(13.6, 0.6, 2.8, 1.6, { fill: theme.dark ? "#6b5844" : "#a8835b" });
    d.line(KNOB[0], KNOB[1] - R_KNOB, HINGE[0], HINGE[1], { color: metal, width: 3 });
    d.circle(KNOB[0], KNOB[1], R_KNOB, { fill: metal, stroke: theme.muted, width: 1 });
    const th = theta(s, p);
    const L = num(p, "L", 5);
    const tipL: V2 = [HINGE[0] - L * Math.sin(th), HINGE[1] - L * Math.cos(th)];
    const tipR: V2 = [HINGE[0] + L * Math.sin(th), HINGE[1] - L * Math.cos(th)];
    d.line(HINGE[0], HINGE[1], tipL[0], tipL[1], { color: gold, width: 4 });
    d.line(HINGE[0], HINGE[1], tipR[0], tipR[1], { color: gold, width: 4 });
    const ql = qLeaves(s, p);
    signsAlong(d, ql / 2, [HINGE[0] - 0.9 * Math.sin(th) - 0.7, HINGE[1] - 1], [tipL[0] - 0.7, tipL[1]], 10);
    signsAlong(d, ql / 2, [HINGE[0] + 0.9 * Math.sin(th) + 0.7, HINGE[1] - 1], [tipR[0] + 0.7, tipR[1]], 10);
    if (th > 0.02) {
      // Forças elétricas de repulsão nas pontas das folhas.
      d.arrowPx(tipL[0], tipL[1], -1, 0, 26, { color: theme.accent, width: 1.5 });
      d.arrowPx(tipR[0], tipR[1], 1, 0, 26, { color: theme.accent, width: 1.5 });
      d.text(`θ = ${deg(th).toFixed(1).replace(".", ",")}°`, HINGE[0], -11.3, { color: theme.text, size: 13, weight: "600" });
    }
    // Carga da esfera do eletroscópio: do lado de onde vem o indutor.
    const src = rodSource(s, p);
    const dir = Math.atan2(src[1] - KNOB[1], src[0] - KNOB[0]);
    signsOnCircle(d, qKnob(s, p), KNOB, R_KNOB, dir, Math.PI * 0.9);
    d.text("eletroscópio", KNOB[0], 14.5, { color: theme.muted, size: 12 });

    // Papeizinhos (polarização microscópica)
    for (const pp of s.papers) drawPaper(d, s, p, pp);
    d.text("papel picado: moléculas polarizadas", -19.5, TABLE_Y - 1.6, { color: theme.muted, size: 11 });

    // Pano
    if (mode(p) === 0) {
      const c = s.cloth;
      d.rect(c.x - CLOTH_W / 2, c.y - CLOTH_H / 2, CLOTH_W, CLOTH_H, { fill: theme.dark ? "#4b4f6e" : "#dfe0f3", stroke: theme.muted, width: 1 });
      for (let k = -2; k <= 2; k++) d.line(c.x + k * 1.3 - 0.6, c.y - CLOTH_H / 2 + 0.2, c.x + k * 1.3 + 0.6, c.y + CLOTH_H / 2 - 0.2, { color: theme.muted, width: 0.6, alpha: 0.5 });
      signsAlong(d, c.q, [c.x - CLOTH_W / 2 + 0.6, c.y + 0.9], [c.x + CLOTH_W / 2 - 0.6, c.y + 0.9], 8);
      if (Math.abs(c.q) > 8 * Q_TOKEN) signsAlong(d, c.q - Math.sign(c.q) * 8 * Q_TOKEN, [c.x - CLOTH_W / 2 + 0.6, c.y - 0.9], [c.x + CLOTH_W / 2 - 0.6, c.y - 0.9], 8);
      d.text(`pano: ${SERIES[matCloth(p)]}`, c.x, c.y - CLOTH_H / 2 - 1, { color: theme.muted, size: 11 });
    }

    // Bastão ou esfera metálica
    const r = s.rod;
    if (isSphere(p)) {
      d.line(r.x, r.y - rs(p), r.x, r.y - rs(p) - 8, { color: theme.dark ? "#b49a6a" : "#8b6b3e", width: 5 });
      d.circle(r.x, r.y, rs(p), { fill: metal, stroke: theme.muted, width: 1 });
      signsOnCircle(d, r.q, [r.x, r.y], rs(p), 0, 2 * Math.PI * (1 - 1 / Math.max(2, Math.round(Math.abs(r.q)))));
      d.text("esfera metálica (cabo isolante)", r.x, r.y - rs(p) - 9.4, { color: theme.muted, size: 11 });
    } else {
      d.rect(r.x - ROD_W / 2, r.y - ROD_H / 2, ROD_W, ROD_H, {
        fill: matRod(p) === 1 ? (theme.dark ? "rgba(170,210,230,0.35)" : "rgba(150,200,225,0.55)") : theme.dark ? "#5a5f66" : "#3d4148",
        stroke: theme.muted,
        width: 1,
      });
      signsAlong(d, r.q, [r.x + 0.4, r.y + ROD_H / 2 + 0.6], [r.x + ROD_W / 2 - 0.4, r.y + ROD_H / 2 + 0.6], 14);
      if (Math.abs(r.q) > 14 * Q_TOKEN) signsAlong(d, r.q - Math.sign(r.q) * 14 * Q_TOKEN, [r.x + 0.4, r.y - ROD_H / 2 - 0.6], [r.x + ROD_W / 2 - 0.4, r.y - ROD_H / 2 - 0.6], 14);
      d.text(`bastão: ${mode(p) === 0 ? SERIES[matRod(p)] : "isolante carregado"}`, r.x, r.y + ROD_H / 2 + 1.8, { color: theme.muted, size: 11 });
    }

    // Elétrons em trânsito
    for (const f of s.flows) {
      if (f.s < 0) continue;
      const at = pointAlong(f.path, f.s);
      if (at) {
        d.dot(at.p[0], at.p[1], 6, theme.negative, 0.25);
        d.text("−", at.p[0], at.p[1], { color: theme.negative, size: 14, weight: "700" });
      }
    }

    // Legenda
    d.text("+ / − : excesso de carga (1 símbolo ≈ 1 nC)   •  − em movimento: elétrons", VP.xMin + 1, VP.yMax - 1.2, {
      color: theme.muted,
      size: 11,
      align: "left",
    });
    const tips = ["arraste o pano sobre o bastão para esfregar", "arraste a esfera até tocar o eletroscópio", "aproxime, aterre, desligue a terra e afaste"];
    d.text(tips[mode(p)] ?? "", VP.xMin + 1, VP.yMax - 3, { color: theme.text, size: 12, align: "left" });
  },
});

export default eletrizacao;
