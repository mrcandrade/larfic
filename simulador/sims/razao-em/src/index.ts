import { defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  EM,
  FINE_COILS,
  TELTRON,
  TELTRON_COILS,
  THOMSON,
  axialB,
  emFromBalance,
  emFromRadius,
  helmholtzB,
  orbitRadius,
  speed,
  thomsonDeflectionE,
  trajectory,
  type Beam,
} from "./physics.ts";

export * from "./physics.ts";

type P2 = [number, number];

export interface EMState {
  /** Relógio da animação dos elétrons (s). */
  tau: number;
  /** Extremos da régua (cm), no modo feixe fino. */
  A: P2;
  B: P2;
  /** Cursor em cruz (cm), no modo Teltron. */
  C: P2;
  drag: "A" | "B" | "R" | "C" | null;
  grab: P2;
}

/** Centro do bulbo e posição do canhão no tubo de feixe fino (cm). */
const BULB_R = 8.5;
const GUN: P2 = [0, -6.5];

const modo = (p: Params) => Math.round(num(p, "modo"));
const V = (p: Params) => num(p, "V", 250);
const I = (p: Params) => num(p, "I", 1.5);
const Vp = (p: Params) => (modo(p) === 0 ? 0 : num(p, "Vp", 0));
export const coilsOf = (p: Params) => (modo(p) === 0 ? FINE_COILS : TELTRON_COILS);
export const fieldOf = (p: Params) => helmholtzB(coilsOf(p), I(p));
const tubeOf = (p: Params) => (modo(p) === 1 ? THOMSON : TELTRON);
const Efield = (p: Params) => Vp(p) / tubeOf(p).d;

let cacheKey = "";
let cacheBeam: Beam | null = null;
/** Feixe dos tubos de deflexão (Thomson/Teltron), com cache por parâmetros. */
export function beamOf(p: Params): Beam {
  const key = `${modo(p)}|${V(p)}|${Vp(p)}|${I(p)}`;
  if (key !== cacheKey || !cacheBeam) {
    cacheBeam = trajectory(tubeOf(p), V(p), Vp(p), fieldOf(p));
    cacheKey = key;
  }
  return cacheBeam;
}

/** Raio do círculo do feixe fino (cm); infinito sem campo. */
export const radiusCm = (p: Params) => orbitRadius(V(p), fieldOf(p)) * 100;

/** Pontos do feixe fino (cm): arco de círculo a partir do canhão, cortado no vidro do bulbo. */
export function fineBeam(p: Params): P2[] {
  const r = radiusCm(p);
  const pts: P2[] = [];
  const inside = (x: number, y: number) => Math.hypot(x, y) < BULB_R - 0.25;
  if (!Number.isFinite(r) || r > 400) {
    for (let x = 0; x <= 20; x += 0.2) {
      if (!inside(GUN[0] + x, GUN[1])) break;
      pts.push([GUN[0] + x, GUN[1]]);
    }
    return pts;
  }
  const n = 360;
  for (let i = 0; i <= n; i++) {
    const a = (2 * Math.PI * i) / n;
    const x = GUN[0] + r * Math.sin(a);
    const y = GUN[1] + r * (1 - Math.cos(a));
    if (!inside(x, y)) break;
    pts.push([x, y]);
  }
  return pts;
}

const rulerLen = (s: EMState) => Math.hypot(s.B[0] - s.A[0], s.B[1] - s.A[1]);

/** Ordenada do feixe do Teltron (cm) em x (cm), por interpolação na trajetória. */
export function beamYAt(p: Params, xCm: number): number {
  const pts = beamOf(p).pts;
  const x = xCm / 100;
  for (let i = 1; i < pts.length; i++) {
    const [x0, y0] = pts[i - 1]!;
    const [x1, y1] = pts[i]!;
    if (x1 >= x && x1 > x0) return (y0 + ((x - x0) / (x1 - x0)) * (y1 - y0)) * 100;
  }
  return NaN;
}

const init = (): EMState => ({ tau: 0, A: [-11, -6.5], B: [-11, 3], C: [8, 0], drag: null, grab: [0, 0] });

export const razaoEm = defineSim<EMState>({
  id: "razao-em",
  title: "Razão carga/massa do elétron",
  course: "FG IV",
  topic: "Física moderna",
  priority: "P2",
  summary:
    "Três aparatos de bancada para medir e/m: o tubo de feixe fino em bobinas de Helmholtz (círculo luminoso medido com régua), o tubo de Thomson (campos E e B cruzados como seletor de velocidades) e o tubo de Teltron (trajetória sobre tela graduada).",
  equations: [
    String.raw`eV = \tfrac12 m v^2 \qquad evB = \frac{mv^2}{r} \;\Rightarrow\; \frac{e}{m} = \frac{2V}{B^2r^2}`,
    String.raw`B = \left(\tfrac45\right)^{3/2}\frac{\mu_0 N I}{R}`,
    String.raw`\text{seletor: } eE = evB \;\Rightarrow\; v = \frac{E}{B},\quad \frac{e}{m} = \frac{E^2}{2VB^2}`,
    String.raw`\text{só } E:\ Y = \frac{E\,l}{2V}\left(\frac l2 + D\right)`,
  ],
  liveEquations(s, p) {
    const B = fieldOf(p);
    const c = coilsOf(p);
    const head = String.raw`B = \left(\tfrac45\right)^{3/2}\frac{\mu_0 \cdot ${c.N} \cdot ${texNum(I(p))}}{${texNum(c.R)}} = ${texNum(B * 1e3)}\ \text{mT} \qquad v = ${texNum(speed(V(p)))}\ \text{m/s}`;
    if (modo(p) === 0) {
      const rm = (rulerLen(s) / 2) / 100;
      return [
        head,
        String.raw`r = \frac{1}{B}\sqrt{\frac{2mV}{e}} = ${texNum(radiusCm(p))}\ \text{cm}`,
        String.raw`\text{régua: } r = ${texNum(rm * 100)}\ \text{cm} \Rightarrow \frac{e}{m} = \frac{2 \cdot ${texNum(V(p))}}{(${texNum(B)})^2(${texNum(rm)})^2} = ${texNum(emFromRadius(V(p), B, rm))}\ \text{C/kg}`,
      ];
    }
    const E = Efield(p);
    return [
      head,
      String.raw`E = \frac{V_p}{d} = ${texNum(E)}\ \text{V/m} \qquad \frac{E}{B} = ${texNum(B > 0 ? E / B : Infinity)}\ \text{m/s}`,
      String.raw`\frac{E^2}{2VB^2} = ${texNum(emFromBalance(V(p), E, B))}\ \text{C/kg}\ (\text{vale quando o feixe não desvia})`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Aparato",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Tubo de feixe fino (Helmholtz)" },
        { value: 1, label: "Tubo de Thomson (E × B)" },
        { value: 2, label: "Tubo de Teltron (tela graduada)" },
      ],
    },
    { key: "V", label: "Tensão de aceleração V", unit: "V", min: 100, max: 5000, step: 5, default: 250, live: true },
    { key: "I", label: "Corrente nas bobinas I", unit: "A", min: 0, max: 3, step: 0.005, default: 1.5, live: true },
    { key: "Vp", label: "Tensão entre as placas Vp", unit: "V", min: 0, max: 5000, step: 5, default: 0, live: true },
  ],

  observables: [
    { key: "I", label: "Corrente nas bobinas", unit: "A", value: (_s, p) => I(p) },
    { key: "B", label: "Campo no centro B", unit: "mT", value: (_s, p) => fieldOf(p) * 1e3 },
    { key: "v", label: "Velocidade do feixe", unit: "m/s", value: (_s, p) => speed(V(p)) },
    { key: "r", label: "Raio da órbita (círculo)", unit: "cm", value: (_s, p) => (Number.isFinite(radiusCm(p)) ? radiusCm(p) : 0) },
    { key: "D", label: "Diâmetro do círculo luminoso", unit: "cm", value: (_s, p) => (modo(p) === 0 && Number.isFinite(radiusCm(p)) ? 2 * radiusCm(p) : 0) },
    { key: "Dregua", label: "Leitura da régua", unit: "cm", value: (s) => rulerLen(s) },
    { key: "emRegua", label: "e/m pela régua", unit: "C/kg", value: (s, p) => emFromRadius(V(p), fieldOf(p), rulerLen(s) / 200) },
    { key: "Y", label: "Deflexão na tela (Thomson)", unit: "cm", value: (_s, p) => (modo(p) === 1 ? beamOf(p).yEnd * 100 : 0) },
    {
      key: "y10",
      label: "Altura do feixe em x = 10 cm (Teltron)",
      unit: "cm",
      value: (_s, p) => {
        if (modo(p) !== 2) return 0;
        const y = beamYAt(p, 10);
        return Number.isFinite(y) ? y : beamOf(p).yEnd * 100;
      },
    },
    { key: "xc", label: "Cursor x", unit: "cm", value: (s) => s.C[0] },
    { key: "yc", label: "Cursor y", unit: "cm", value: (s) => s.C[1] },
    { key: "Ibal", label: "Corrente de equilíbrio (E/B = v)", unit: "A", value: (_s, p) => (modo(p) === 0 ? 0 : Efield(p) / speed(V(p)) / helmholtzB(coilsOf(p), 1)) },
    { key: "emBal", label: "e/m = E²/(2VB²)", unit: "C/kg", value: (_s, p) => (modo(p) === 0 ? 0 : emFromBalance(V(p), Efield(p), fieldOf(p))) },
  ],
  chart: { x: "I", y: "r" },

  scenarios: [
    {
      id: "feixe-fino",
      label: "Feixe fino: medir o diâmetro",
      params: { modo: 0, V: 250, I: 1.5, Vp: 0 },
      guide: `### Círculo luminoso nas bobinas de Helmholtz
1. O gás rarefeito no bulbo brilha onde o feixe passa. Com $V = 250\\ \\text{V}$ e $I = 1{,}5\\ \\text{A}$ o feixe fecha um círculo.
2. Arraste as pontas da **régua** até os dois extremos do diâmetro vertical (do canhão ao topo do círculo). Arrastar o meio move a régua inteira.
3. Calcule $B = (4/5)^{3/2}\\mu_0 N I/R$ com $N = 130$ e $R = 15\\ \\text{cm}$ e depois $e/m = 2V/(B^2 r^2)$. Compare com $1{,}759 \\times 10^{11}\\ \\text{C/kg}$.
4. Varie $I$ ao vivo: o gráfico de $r$ contra $I$ é uma hipérbole ($r \\propto 1/I$).
5. No inserto, veja $B$ ao longo do eixo: a separação $R$ entre as bobinas deixa o campo quase uniforme no centro.`,
      predict: [
        {
          question: "Dobrando a corrente nas bobinas (com V fixo), o diâmetro do círculo:",
          options: ["dobra", "cai pela metade", "cai a um quarto", "não muda"],
          answer: 1,
          explanation: "$B \\propto I$ e $r = \\sqrt{2mV/e}/B$, então $r \\propto 1/I$: o diâmetro cai pela metade.",
        },
        {
          question: "Quadruplicando a tensão de aceleração (com I fixo), o raio:",
          options: ["dobra", "quadruplica", "cai pela metade", "não muda"],
          answer: 0,
          explanation: "$v \\propto \\sqrt V$ e $r = mv/(eB)$, então o raio dobra.",
        },
      ],
    },
    {
      id: "thomson",
      label: "Thomson: seletor de velocidades",
      params: { modo: 1, V: 2000, I: 0, Vp: 300 },
      guide: `### Campos cruzados: o feixe que não desvia
1. Só com as placas ($I = 0$), o feixe desvia para cima. Meça $Y$ na tela e compare com $Y = \\frac{El}{2V}\\left(\\frac l2 + D\\right)$ ($l = 5\\ \\text{cm}$, $D = 30\\ \\text{cm}$, $d = 2\\ \\text{cm}$).
2. Aumente $I$ devagar até o ponto voltar ao centro da tela. Nessa condição $eE = evB$ e $v = E/B$.
3. Calcule $e/m = E^2/(2VB^2)$. O observável **corrente de equilíbrio** diz qual $I$ procurar.
4. Mude $V$: o feixe volta a desviar, porque só uma velocidade passa reta pelo seletor.`,
      predict: [
        {
          question: "Com E e B ajustados para o feixe passar reto, aumentamos V. O feixe desvia para:",
          options: ["o lado da força elétrica (para cima)", "o lado da força magnética (para baixo)", "continua reto"],
          answer: 1,
          explanation: "Elétrons mais rápidos sentem força magnética $evB$ maior, enquanto $eE$ não muda: vence a força magnética.",
        },
      ],
    },
    {
      id: "teltron",
      label: "Teltron: trajetória na tela graduada",
      params: { modo: 2, V: 3000, I: 0.25, Vp: 0 },
      guide: `### Raio a partir de um ponto da trajetória
1. Só com campo magnético, o feixe faz um arco de círculo tangente ao eixo $x$ na entrada.
2. Arraste o **cursor em cruz** até um ponto do feixe, por exemplo a borda da tela em $x = 10\\ \\text{cm}$.
3. O raio sai da geometria: $r = (x^2 + y^2)/(2|y|)$. Então $e/m = 2V/(B^2r^2)$, com $N = 320$ e $R = 6{,}8\\ \\text{cm}$.
4. Ligue $V_p$: com $V_p = 3000\\ \\text{V}$ ache a corrente que deixa o feixe reto e compare os dois métodos.`,
    },
  ],

  exercises: [
    {
      id: "em-raio",
      prompt:
        "Num tubo de feixe fino, elétrons acelerados por {V} V descrevem um círculo de {r} cm de raio no campo de bobinas de Helmholtz de {B} mT. Qual é a razão e/m obtida?",
      vary: { V: [150, 300, 0], r: [3, 6, 1], B: [0.6, 1.4, 2] },
      answer: { label: "e/m", unit: "C/kg", compute: (p) => emFromRadius(num(p, "V"), num(p, "B") * 1e-3, num(p, "r") / 100) },
      hint: "e/m = 2V/(B²r²), tudo em SI.",
    },
    {
      id: "helmholtz",
      prompt: "Bobinas de Helmholtz com {N} espiras cada e raio {R} cm conduzem {I} A. Qual é o campo no centro?",
      vary: { N: [100, 400, 0], R: [5, 20, 1], I: [0.5, 3, 2] },
      answer: { label: "B", unit: "mT", compute: (p) => helmholtzB({ N: num(p, "N"), R: num(p, "R") / 100 }, num(p, "I")) * 1e3 },
      hint: "B = (4/5)^{3/2} μ₀NI/R.",
    },
  ],

  init,
  step: (s, _p, _t, dt) => ({ ...s, tau: s.tau + dt }),
  dt: 0.02,
  sampleEvery: 5,
  maxSamples: 4000,

  pointer: {
    down(s, p, pt) {
      const near = (q: P2, tol: number) => Math.hypot(pt.x - q[0], pt.y - q[1]) < tol;
      if (modo(p) === 2) return near(s.C, 0.8) ? { ...s, drag: "C" } : undefined;
      if (modo(p) !== 0) return undefined;
      if (near(s.A, 1)) return { ...s, drag: "A" };
      if (near(s.B, 1)) return { ...s, drag: "B" };
      // meio da régua: distância ao segmento
      const [ax, ay] = s.A;
      const [bx, by] = s.B;
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1;
      const u = Math.max(0, Math.min(1, ((pt.x - ax) * (bx - ax) + (pt.y - ay) * (by - ay)) / L2));
      if (Math.hypot(pt.x - ax - u * (bx - ax), pt.y - ay - u * (by - ay)) < 0.9) return { ...s, drag: "R", grab: [pt.x, pt.y] };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const q: P2 = [pt.x, pt.y];
      if (s.drag === "A") return { ...s, A: q };
      if (s.drag === "B") return { ...s, B: q };
      if (s.drag === "C") return { ...s, C: [Math.max(0, Math.min(10, pt.x)), Math.max(-4, Math.min(4, pt.y))] };
      const dx = pt.x - s.grab[0];
      const dy = pt.y - s.grab[1];
      void p;
      return { ...s, A: [s.A[0] + dx, s.A[1] + dy], B: [s.B[0] + dx, s.B[1] + dy], grab: q };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      const near = (q: P2, tol: number) => Math.hypot(pt.x - q[0], pt.y - q[1]) < tol;
      if (modo(p) === 2) return near(s.C, 0.8) ? "move" : undefined;
      if (modo(p) === 0 && (near(s.A, 1) || near(s.B, 1))) return "crosshair";
      return undefined;
    },
  },
  actions: [
    {
      id: "regua-auto",
      label: "Encostar a régua no diâmetro",
      run(s, p) {
        const r = radiusCm(p);
        if (!Number.isFinite(r)) return s;
        const top = Math.min(GUN[1] + 2 * r, BULB_R);
        return { ...s, A: [GUN[0] - 0.3, GUN[1]], B: [GUN[0] - 0.3, top] };
      },
    },
    { id: "regua-reset", label: "Recolher a régua", run: (s) => ({ ...s, A: [-11, -6.5], B: [-11, 3] }) },
  ],

  viewport(p) {
    const m = modo(p);
    if (m === 0) return { xMin: -18, xMax: 36, yMin: -17, yMax: 17 };
    if (m === 1) return { xMin: -6, xMax: 58, yMin: -16, yMax: 16 };
    return { xMin: -4, xMax: 26, yMin: -7.5, yMax: 7.5 };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = modo(frame.params);
    if (m === 0) renderFine(d, frame.theme, frame.state, frame.params);
    else if (m === 1) renderThomson(d, frame.theme, frame.state, frame.params);
    else renderTeltron(d, frame.theme, frame.state, frame.params);
  },
});

const beamColor = (t: Theme) => (t.dark ? "#5ff0c8" : "#0f9d79");

/** Desenha elétrons correndo ao longo de uma polilinha. */
function runners(d: Draw, pts: P2[], tau: number, color: string, spacing: number, speedVis: number) {
  const seg: number[] = [0];
  for (let i = 1; i < pts.length; i++) seg.push(seg[i - 1]! + Math.hypot(pts[i]![0] - pts[i - 1]![0], pts[i]![1] - pts[i - 1]![1]));
  const total = seg[seg.length - 1] ?? 0;
  if (total <= 0) return;
  for (let s0 = (tau * speedVis) % spacing; s0 < total; s0 += spacing) {
    let i = 1;
    while (i < seg.length - 1 && seg[i]! < s0) i++;
    const f = (s0 - seg[i - 1]!) / Math.max(1e-9, seg[i]! - seg[i - 1]!);
    const a = pts[i - 1]!;
    const b = pts[i]!;
    d.dot(a[0] + f * (b[0] - a[0]), a[1] + f * (b[1] - a[1]), 2.4, color);
  }
}

function glow(d: Draw, pts: P2[], color: string) {
  d.polyline(pts, { color, width: 9, alpha: 0.15 });
  d.polyline(pts, { color, width: 3.5, alpha: 0.5 });
  d.polyline(pts, { color, width: 1.4 });
}

function readout(d: Draw, rows: string[], x: number, y: number, step: number) {
  rows.forEach((r, i) => d.text(r, x, y - i * step, { align: "left", size: 12, weight: i === 0 ? "600" : "400" }));
}

function renderFine(d: Draw, th: Theme, s: EMState, p: Params) {
  // Bobinas (vistas de frente: anéis de raio R = 15 cm)
  d.circle(0, 0, 15, { stroke: th.series[1]!, width: 7, alpha: 0.55 });
  d.circle(0, 0, 15, { stroke: th.muted, width: 1 });
  d.text(`bobinas de Helmholtz: N = 130, R = 15 cm, I = ${fmt(I(p))} A`, 0, -16.2, { size: 11, color: th.muted });
  // Campo B saindo da tela
  const B = fieldOf(p);
  if (B > 0)
    for (let x = -12; x <= 12; x += 4)
      for (let y = -12; y <= 12; y += 4) {
        if (Math.hypot(x, y) < BULB_R + 0.6 || Math.hypot(x, y) > 14) continue;
        d.circle(x, y, 0.35, { stroke: th.muted, width: 1 });
        d.dot(x, y, 1.6, th.muted);
      }
  d.text("B ⊙ (saindo da tela)", 10.5, 12.8, { size: 11, color: th.muted });
  // Bulbo
  d.circle(0, 0, BULB_R, { fill: th.dark ? "rgba(90,120,170,0.12)" : "rgba(60,90,140,0.06)", stroke: th.muted, width: 1.5 });
  // Escala luminosa de diâmetros (2 a 10 cm)
  for (let k = 2; k <= 12; k += 2) {
    const y = GUN[1] + k;
    if (y > BULB_R - 0.5) break;
    d.line(0.4, y, 1.2, y, { color: th.muted, width: 1.2 });
    d.text(`${k}`, 1.5, y, { size: 9, color: th.muted, align: "left" });
  }
  // Canhão
  d.rect(GUN[0] - 2.2, GUN[1] - 0.5, 2.2, 1, { fill: th.grid, stroke: th.text, width: 1.2 });
  d.text(`canhão ${fmt(V(p))} V`, GUN[0] - 1.1, GUN[1] - 1.3, { size: 10, color: th.muted });
  // Feixe
  const pts = fineBeam(p);
  const col = beamColor(th);
  if (pts.length > 1) {
    glow(d, pts, col);
    runners(d, pts, s.tau, th.text, 2.2, 6);
    // Vetores num elétron do topo do círculo (ou no fim do feixe)
    const r = radiusCm(p);
    const k = Math.min(pts.length - 1, Math.floor(pts.length * 0.35));
    const [ex, ey] = pts[k]!;
    const [nx, ny] = pts[Math.min(pts.length - 1, k + 1)]!;
    d.dot(ex, ey, 4, th.accent);
    d.arrowPx(ex, ey, nx - ex, ny - ey, 34, { color: th.series[0]! });
    d.text("v", ex + (nx - ex) * 9, ey + (ny - ey) * 9, { color: th.series[0]!, dx: 12, dy: -12, weight: "600" });
    if (Number.isFinite(r)) {
      const cx = GUN[0];
      const cy = GUN[1] + r;
      d.arrowPx(ex, ey, cx - ex, cy - ey, 30, { color: th.positive });
      d.text("F = −e v×B", ex, ey, { color: th.positive, size: 10, dx: -42, dy: 14 });
      d.dot(cx, cy, 2, th.muted);
    }
  }
  // Régua arrastável
  ruler(d, th, s.A, s.B);
  // Painel de leitura
  const rm = rulerLen(s) / 200;
  const r = radiusCm(p);
  readout(
    d,
    [
      "Leituras",
      `B = ${fmt(B * 1e3)} mT`,
      `v = ${fmt(speed(V(p)))} m/s`,
      `régua: D = ${fmt(rulerLen(s))} cm`,
      `e/m (régua) = ${fmt(emFromRadius(V(p), B, rm))} C/kg`,
      Number.isFinite(r) && 2 * r < 15 ? `diâmetro real: ${fmt(2 * r)} cm` : "feixe toca o vidro",
      `aceito: ${fmt(EM)} C/kg`,
    ],
    17,
    15.5,
    1.35,
  );
  // Inserto: B no eixo das bobinas
  const c = coilsOf(p);
  const P = panel(d, { x0: 19, y0: -14, x1: 34.5, y1: -4 }, { min: -1.5, max: 1.5 }, { min: 0, max: 1.15 });
  P.frame({ xlabel: "z/R", ylabel: "B(z)/B(0) no eixo", xticks: [-1, -0.5, 0, 0.5, 1] });
  const B0 = axialB(c, 1, 0);
  P.plot((z) => axialB(c, 1, z * c.R) / B0, -1.5, 1.5, { color: th.accent, width: 1.8 });
  P.line([[-0.5, 0], [-0.5, 1.15]], { color: th.series[1]!, dash: [4, 3], width: 1 });
  P.line([[0.5, 0], [0.5, 1.15]], { color: th.series[1]!, dash: [4, 3], width: 1 });
}

function ruler(d: Draw, th: Theme, A: P2, B: P2) {
  const L = Math.hypot(B[0] - A[0], B[1] - A[1]);
  if (L < 1e-6) return;
  const ux = (B[0] - A[0]) / L;
  const uy = (B[1] - A[1]) / L;
  const nx = -uy;
  const ny = ux;
  const w = 0.9;
  d.polyline(
    [
      [A[0], A[1]],
      [B[0], B[1]],
      [B[0] + nx * w, B[1] + ny * w],
      [A[0] + nx * w, A[1] + ny * w],
    ],
    { close: true, fill: th.dark ? "rgba(230,200,120,0.18)" : "rgba(220,180,80,0.25)", color: th.series[5]!, width: 1 },
  );
  for (let k = 0; k <= L * 10 + 1e-9; k++) {
    const t = k / 10;
    const len = k % 10 === 0 ? 0.55 : k % 5 === 0 ? 0.4 : 0.22;
    d.line(A[0] + ux * t, A[1] + uy * t, A[0] + ux * t + nx * len, A[1] + uy * t + ny * len, { color: th.text, width: k % 10 === 0 ? 1 : 0.6 });
  }
  for (const q of [A, B]) d.circle(q[0], q[1], 0.35, { fill: th.accent, stroke: th.text, width: 1 });
  d.text(`${fmt(L)} cm`, (A[0] + B[0]) / 2 + nx * 1.8, (A[1] + B[1]) / 2 + ny * 1.8, { size: 12, weight: "600", color: th.series[5]! });
}

function renderThomson(d: Draw, th: Theme, s: EMState, p: Params) {
  const k = 100;
  const t = THOMSON;
  const beam = beamOf(p);
  const xs = (t.l + t.drift) * k;
  // Tubo
  d.polyline(
    [
      [-4, -2.5],
      [t.l * k + 2, -2.5],
      [xs, -t.screen * k - 1],
      [xs, t.screen * k + 1],
      [t.l * k + 2, 2.5],
      [-4, 2.5],
    ],
    { close: true, color: th.muted, width: 1.2, fill: th.dark ? "rgba(90,120,170,0.08)" : "rgba(60,90,140,0.04)" },
  );
  d.rect(-4, -0.4, 3.6, 0.8, { fill: th.grid, stroke: th.text, width: 1 });
  d.text(`canhão ${fmt(V(p))} V`, -2.2, -3.4, { size: 10, color: th.muted });
  // Placas
  d.rect(0, (t.d / 2) * k, t.l * k, 0.35, { fill: th.positive });
  d.rect(0, (-t.d / 2) * k - 0.35, t.l * k, 0.35, { fill: th.negative });
  d.text(`+${fmt(Vp(p))} V`, (t.l * k) / 2, (t.d / 2) * k + 1.1, { size: 10, color: th.positive });
  d.text("0 V", (t.l * k) / 2, (-t.d / 2) * k - 1.1, { size: 10, color: th.negative });
  // Campos na região das placas
  if (Vp(p) > 0) d.arrowPx(t.l * k + 0.6, 0.6, 0, -1, 16, { color: th.series[0]!, width: 1.5 });
  if (fieldOf(p) > 0) {
    d.circle(t.l * k + 0.6, -0.8, 0.3, { stroke: th.muted, width: 1 });
    d.text("×", t.l * k + 0.6, -0.8, { size: 10, color: th.muted });
  }
  d.text("E ↓, B ⊗", t.l * k + 2.2, 0, { size: 10, color: th.muted, align: "left" });
  // Bobinas (contorno tracejado da região de campo)
  d.circle((t.l * k) / 2, 0, 6.8, { stroke: th.series[1]!, width: 1, dash: [5, 4], alpha: 0.6 });
  d.text("bobinas (N = 320, R = 6,8 cm)", (t.l * k) / 2, 7.6, { size: 10, color: th.series[1]! });
  // Feixe
  const pts = beam.pts.map(([x, y]) => [x * k, y * k] as P2);
  glow(d, pts, beamColor(th));
  runners(d, pts, s.tau, th.text, 3, 14);
  // Tela de frente
  const cx = 46;
  d.rect(cx - 6.5, -t.screen * k, 13, 2 * t.screen * k, { fill: th.dark ? "rgba(0,0,0,0.35)" : "rgba(20,40,40,0.08)", stroke: th.muted, width: 1 });
  for (let y = -6; y <= 6; y += 1) d.line(cx - (y % 2 === 0 ? 0.8 : 0.4), y, cx + (y % 2 === 0 ? 0.8 : 0.4), y, { color: th.muted, width: 0.8 });
  d.line(cx - 6.5, 0, cx + 6.5, 0, { color: th.grid, width: 1 });
  if (beam.reached) {
    d.dot(cx, beam.yEnd * k, 9, beamColor(th), 0.3);
    d.dot(cx, beam.yEnd * k, 4, beamColor(th));
  }
  d.text("tela (de frente), marcas a cada 1 cm", cx, -t.screen * k - 0.9, { size: 10, color: th.muted });
  const B = fieldOf(p);
  const E = Efield(p);
  readout(
    d,
    [
      beam.reached ? `deflexão Y = ${fmt(beam.yEnd * k)} cm` : "feixe bate na placa ou sai da tela",
      `E = ${fmt(E)} V/m,  B = ${fmt(B * 1e3)} mT`,
      `v = ${fmt(speed(V(p)))} m/s,  E/B = ${B > 0 ? fmt(E / B) : "∞"} m/s`,
      `Y só com E (teoria): ${fmt(thomsonDeflectionE(t, V(p), Vp(p)) * k)} cm`,
      `e/m = E²/(2VB²) = ${fmt(emFromBalance(V(p), E, B))} C/kg`,
    ],
    -4,
    14.5,
    1.3,
  );
  d.text(`l = 5 cm, d = 2 cm, D = 30 cm`, -4, -14.5, { align: "left", size: 10, color: th.muted });
}

function renderTeltron(d: Draw, th: Theme, s: EMState, p: Params) {
  const k = 100;
  const t = TELTRON;
  // Tela graduada (0 a 10 cm × ±4 cm)
  d.rect(0, -4, 10, 8, { fill: th.dark ? "rgba(60,200,170,0.07)" : "rgba(20,140,110,0.06)", stroke: th.muted, width: 1 });
  for (let x = 0; x <= 10; x += 1) d.line(x, -4, x, 4, { color: th.grid, width: x % 2 === 0 ? 1.2 : 0.6 });
  for (let y = -4; y <= 4; y += 1) d.line(0, y, 10, y, { color: th.grid, width: y % 2 === 0 ? 1.2 : 0.6 });
  for (let x = 2; x <= 10; x += 2) d.text(`${x}`, x, -4, { size: 9, color: th.muted, dy: 9 });
  for (let y = -4; y <= 4; y += 2) d.text(`${y}`, 0, y, { size: 9, color: th.muted, align: "right", dx: -4 });
  // Placas
  d.rect(0, 4, 10, 0.3, { fill: th.positive });
  d.rect(0, -4.3, 10, 0.3, { fill: th.negative });
  d.text(`+${fmt(Vp(p))} V`, 5, 4.9, { size: 10, color: th.positive });
  d.text("0 V", 5, -5.4, { size: 10, color: th.negative });
  d.rect(-3.5, -0.3, 3.2, 0.6, { fill: th.grid, stroke: th.text, width: 1 });
  d.text(`${fmt(V(p))} V`, -1.9, -1, { size: 10, color: th.muted });
  // Feixe
  const pts = beamOf(p).pts.map(([x, y]) => [x * k, y * k] as P2);
  glow(d, pts, beamColor(th));
  runners(d, pts, s.tau, th.text, 1, 5);
  // Cursor
  const [cx, cy] = s.C;
  d.line(cx - 0.7, cy, cx + 0.7, cy, { color: th.accent, width: 1.5 });
  d.line(cx, cy - 0.7, cx, cy + 0.7, { color: th.accent, width: 1.5 });
  d.circle(cx, cy, 0.25, { stroke: th.accent, width: 1.5 });
  const B = fieldOf(p);
  const rc = (cx * cx + cy * cy) / (2 * Math.abs(cy) || 1e-9);
  readout(
    d,
    [
      `cursor: (${fmt(cx)} ; ${fmt(cy)}) cm`,
      `r = (x² + y²)/(2|y|) = ${Math.abs(cy) > 0.01 ? fmt(rc) : "∞"} cm`,
      `B = ${fmt(B * 1e3)} mT   (N = 320, R = 6,8 cm)`,
      `e/m pelo cursor = ${fmt(emFromRadius(V(p), B, rc / 100))} C/kg`,
      `E = ${fmt(Efield(p))} V/m   E/B = ${B > 0 ? fmt(Efield(p) / B) : "∞"} m/s`,
      `v = ${fmt(speed(V(p)))} m/s`,
    ],
    12,
    5.5,
    0.85,
  );
  d.text("arraste a cruz até um ponto do feixe", 12, -6.5, { size: 10, color: th.muted, align: "left" });
}

export default razaoEm;
