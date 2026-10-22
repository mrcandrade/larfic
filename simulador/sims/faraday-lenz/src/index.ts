import { defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { MU0, dipoleB2, fluxNumeric } from "./physics.ts";
import { derivation } from "./derivation.ts";

export * from "./physics.ts";

export interface FaradayState {
  t: number;
  /** Centro do ímã no eixo da espira (cm); a espira está em x = 0. */
  x: number;
  /** Velocidade do ímã (cm/s). */
  v: number;
  /** Posição pedida pelo arraste (cm). */
  target: number;
  dragging: boolean;
  /** Ângulo da espira no gerador (rad). */
  th: number;
  /** Fluxo por espira (Wb) e fem (V), guardados para o gráfico do palco. */
  phi: number;
  emf: number;
}

export const MODES = ["Ímã oscilando", "Ímã passando com velocidade constante", "Arrastar o ímã", "Gerador (espira girando)"] as const;
const OSC = 0, PASS = 1, DRAG = 2, GEN = 3;
const X_LIM = 18;
const AXIS_Y = 2;
const TAU_DRAG = 0.06;
const MAG_HALF = 2.5;

const mode = (p: Params) => Math.round(num(p, "modo"));
const moment = (p: Params) => num(p, "m", 1) * (num(p, "polo", 1) >= 0 ? 1 : -1);
const omega = (p: Params) => 2 * Math.PI * num(p, "f", 0.5);
const area = (p: Params) => Math.PI * (num(p, "a", 3) / 100) ** 2;

/** Fluxo por espira (Wb) com o ímã em x (cm). */
export function fluxAt(p: Params, x: number): number {
  return fluxNumeric(moment(p), num(p, "a", 3) / 100, x / 100);
}

/** dΦ/dx (Wb/m) por diferença central sobre o fluxo integrado numericamente. */
export function dFluxDx(p: Params, x: number): number {
  const h = 1e-4;
  return (fluxAt(p, x + h * 100) - fluxAt(p, x - h * 100)) / (2 * h);
}

/** Completa Φ e fem a partir da cinemática. */
function withFields(s: FaradayState, p: Params): FaradayState {
  const N = num(p, "N", 100);
  if (mode(p) === GEN) {
    const B = num(p, "B", 0.2);
    return { ...s, phi: B * area(p) * Math.cos(s.th), emf: N * B * area(p) * omega(p) * Math.sin(s.th) };
  }
  return { ...s, phi: fluxAt(p, s.x), emf: -N * dFluxDx(p, s.x) * (s.v / 100) };
}

function kinematics(p: Params, t: number): { x: number; v: number; th: number } {
  const w = omega(p);
  const A = num(p, "A", 10);
  switch (mode(p)) {
    case OSC:
      return { x: -A * Math.cos(w * t), v: A * w * Math.sin(w * t), th: 0 };
    case PASS: {
      const v = num(p, "v", 20);
      return { x: -X_LIM + v * t, v, th: 0 };
    }
    case GEN:
      return { x: -14, v: 0, th: w * t };
    default:
      return { x: -10, v: 0, th: 0 };
  }
}

const current = (s: FaradayState, p: Params) => s.emf / num(p, "R", 10);

export const faradayLenz = defineSim<FaradayState>({
  id: "faraday-lenz",
  title: "Lei de Faraday e Lenz: ímã, espira e gerador",
  course: "FG III",
  topic: "Indução",
  priority: "P1",
  summary:
    "Um ímã passa por uma espira (oscilando, com velocidade constante ou arrastado com o mouse) e o fluxo Φ(t) e a fem ε(t) aparecem juntos. No modo gerador, a espira gira num campo uniforme.",
  derivation,
  equations: [
    String.raw`\varepsilon = -N\,\frac{d\Phi_B}{dt} \qquad \Phi_B = \int_A \vec B\cdot d\vec A`,
    String.raw`\text{dipolo no eixo: } \Phi = \frac{\mu_0 m a^2}{2\,(a^2 + d^2)^{3/2}} \qquad \varepsilon = -N\,\frac{d\Phi}{dd}\,v`,
    String.raw`\text{gerador: } \Phi = BA\cos\omega t \qquad \varepsilon = NBA\omega\,\sin\omega t`,
  ],
  liveEquations(s, p) {
    const N = num(p, "N", 100);
    const out = [String.raw`N\Phi = ${texNum(N * s.phi)}\ \text{Wb} \qquad \varepsilon = ${texNum(s.emf)}\ \text{V} \qquad I = \frac{\varepsilon}{R} = ${texNum(current(s, p))}\ \text{A}`];
    if (mode(p) === GEN) {
      const B = num(p, "B", 0.2);
      out.push(String.raw`\varepsilon_{\max} = NBA\omega = ${texNum(N)} \cdot ${texNum(B)}\ \text{T} \cdot ${texNum(area(p))}\ \text{m}^2 \cdot ${texNum(omega(p))}\ \text{rad/s} = ${texNum(N * B * area(p) * omega(p))}\ \text{V}`);
    } else {
      out.push(String.raw`d = ${texNum(s.x / 100)}\ \text{m} \qquad v = ${texNum(s.v / 100)}\ \text{m/s} \qquad \frac{d\Phi}{dd} = ${texNum(dFluxDx(p, s.x))}\ \text{Wb/m}`);
    }
    return out;
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 3, step: 1, default: 0, options: MODES.map((label, value) => ({ value, label })) },
    { key: "m", label: "Momento magnético do ímã", unit: "A·m²", min: 0.1, max: 5, step: 0.1, default: 1 },
    {
      key: "polo",
      label: "Orientação do ímã",
      unit: "",
      min: -1,
      max: 1,
      step: 2,
      default: 1,
      options: [
        { value: 1, label: "Norte à direita (m em +x)" },
        { value: -1, label: "Norte à esquerda (m em −x)" },
      ],
    },
    { key: "a", label: "Raio da espira", unit: "cm", min: 1, max: 8, step: 0.1, default: 3 },
    { key: "N", label: "Número de espiras", unit: "", min: 1, max: 500, step: 1, default: 100 },
    { key: "R", label: "Resistência da bobina", unit: "Ω", min: 0.1, max: 100, step: 0.1, default: 10, log: true, live: true },
    { key: "A", label: "Amplitude da oscilação", unit: "cm", min: 2, max: 16, step: 0.5, default: 10 },
    { key: "f", label: "Frequência (oscilação ou rotação)", unit: "Hz", min: 0.1, max: 5, step: 0.05, default: 0.5 },
    { key: "v", label: "Velocidade do ímã (passagem)", unit: "cm/s", min: 5, max: 100, step: 1, default: 20 },
    { key: "B", label: "Campo uniforme do gerador", unit: "T", min: 0.01, max: 1, step: 0.01, default: 0.2 },
  ],

  observables: [
    { key: "x", label: "Posição do ímã", unit: "m", value: (s) => s.x / 100 },
    { key: "phi", label: "Fluxo por espira Φ", unit: "Wb", value: (s) => s.phi },
    { key: "NPhi", label: "Fluxo concatenado NΦ", unit: "Wb", value: (s, p) => num(p, "N", 100) * s.phi },
    { key: "emf", label: "Fem induzida ε", unit: "V", value: (s) => s.emf },
    { key: "I", label: "Corrente induzida I", unit: "A", value: (s, p) => current(s, p) },
    { key: "P", label: "Potência dissipada", unit: "W", value: (s, p) => s.emf ** 2 / num(p, "R", 10) },
  ],
  chart: { x: "t", y: "emf" },

  scenarios: [
    {
      id: "oscilando",
      label: "Ímã oscilando",
      params: { modo: OSC, A: 10, f: 0.5 },
      guide: `### Fluxo e fem juntos
1. Rode e acompanhe o gráfico do palco: $N\\Phi$ (azul) e $\\varepsilon$ (laranja).
2. Onde $\\Phi$ é máximo (ímã no centro da espira), quanto vale $\\varepsilon$? E onde $\\Phi$ varia mais depressa?
3. Observe a seta **B induzido** no centro da espira: quando o ímã se aproxima, ela aponta contra o campo do ímã; quando se afasta, a favor (lei de Lenz).
4. Dobre a frequência: o pico de $\\varepsilon$ dobra, mas o de $\\Phi$ não muda.`,
      predict: [
        {
          question: "No instante em que o ímã está exatamente no centro da espira, a fem induzida é:",
          options: ["máxima", "zero", "igual à metade da máxima", "infinita"],
          answer: 1,
          explanation: "Ali o fluxo passa por um máximo: $d\\Phi/dt = 0$ e, pela lei de Faraday, $\\varepsilon = -N\\,d\\Phi/dt = 0$.",
        },
      ],
    },
    {
      id: "passagem",
      label: "Passagem com velocidade constante",
      params: { modo: PASS, v: 20 },
      guide: `### Um pulso para cada lado
1. O ímã atravessa a espira com velocidade constante. A fem forma dois pulsos de sinais opostos.
2. A área sob $\\varepsilon(t)$ é $-N\\,\\Delta\\Phi$. Como o fluxo começa e termina quase nulo, as duas áreas se cancelam.
3. Refaça com o dobro da velocidade e compare a altura e a largura dos pulsos.`,
      predict: [
        {
          question: "Se o ímã passar com o dobro da velocidade, o pico da fem:",
          options: ["dobra e o pulso fica mais estreito", "fica igual e o pulso fica mais estreito", "cai à metade", "quadruplica"],
          answer: 0,
          explanation: "$\\varepsilon = -N\\,(d\\Phi/dx)\\,v$: com a mesma geometria, $\\varepsilon$ é proporcional a $v$, e o tempo de passagem cai à metade.",
        },
      ],
    },
    {
      id: "arrastar",
      label: "Arraste o ímã (Lenz)",
      params: { modo: DRAG },
      guide: `### Você é o gerador
1. Clique em **Iniciar** e arraste o ímã ao longo do eixo.
2. Aproxime o polo norte da espira: em que sentido circula a corrente (setas na frente da espira)? O **B induzido** aponta contra o ímã: a espira "empurra" de volta.
3. Pare o ímã: a fem cai a zero, mesmo com o ímã dentro da espira.
4. Inverta o ímã (Orientação) e repita.`,
    },
    {
      id: "gerador",
      label: "Gerador",
      params: { modo: GEN, f: 1, B: 0.2, N: 100, a: 3 },
      guide: `### Espira girando em campo uniforme
1. O fluxo é $\\Phi = BA\\cos\\omega t$ e a fem é $NBA\\omega\\sin\\omega t$: as curvas ficam defasadas de um quarto de período.
2. A fem é máxima quando o plano da espira está **paralelo** a $\\vec B$ (fluxo nulo).
3. Compare o pico medido com $NBA\\omega$ nas equações ao vivo. Dobre a frequência.`,
      predict: [
        {
          question: "Dobrando a frequência de rotação do gerador, a fem máxima:",
          options: ["não muda", "dobra", "quadruplica", "cai à metade"],
          answer: 1,
          explanation: "$\\varepsilon_{\\max} = NBA\\omega$ é proporcional a $\\omega$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "gerador",
      prompt: "Uma bobina de {N} espiras circulares de raio {a} cm gira a {f} Hz num campo uniforme de {B} T. Qual é a fem máxima?",
      vary: { N: [10, 500, 0], a: [1, 8, 1], f: [0.5, 5, 1], B: [0.05, 1, 2] },
      fixed: { modo: GEN },
      answer: { label: "ε_max", unit: "V", compute: (p) => num(p, "N") * num(p, "B") * area(p) * omega(p) },
      hint: "ε_max = N B A ω, com A = πa² e ω = 2πf.",
    },
    {
      id: "fluxo-dipolo",
      prompt: "Um ímã pequeno de momento {m} A·m² está no eixo de uma espira de raio {a} cm, a {d} cm do seu centro. Qual é o fluxo magnético pela espira?",
      vary: { m: [0.2, 5, 1], a: [1, 8, 1], d: [1, 15, 1] },
      answer: {
        label: "Φ",
        unit: "μWb",
        compute: (p) => ((MU0 * num(p, "m") * (num(p, "a") / 100) ** 2) / (2 * ((num(p, "a") / 100) ** 2 + (num(p, "d") / 100) ** 2) ** 1.5)) * 1e6,
      },
      hint: "Φ = μ₀ m a² / [2 (a² + d²)^{3/2}] (é a indutância mútua espira–dipolo vezes m).",
    },
  ],

  init(p) {
    const k = kinematics(p, 0);
    return withFields({ t: 0, x: k.x, v: k.v, target: k.x, dragging: false, th: k.th, phi: 0, emf: 0 }, p);
  },
  step(s, p, t, dt) {
    const tn = t + dt;
    if (mode(p) === DRAG) {
      const x = s.x + (s.target - s.x) * (1 - Math.exp(-dt / TAU_DRAG));
      return withFields({ ...s, t: tn, x, v: (x - s.x) / dt }, p);
    }
    const k = kinematics(p, tn);
    return withFields({ ...s, t: tn, ...k }, p);
  },
  dt: 1e-3,
  sampleEvery: 10,
  stopWhen: (s, p) => (mode(p) === PASS ? X_LIM - s.x : 1),

  pointer: {
    down(s, p, pt) {
      if (mode(p) !== DRAG) return undefined;
      if (Math.abs(pt.x - s.x) < MAG_HALF + 0.5 && Math.abs(pt.y - AXIS_Y) < 2) return { ...s, dragging: true };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.dragging || mode(p) !== DRAG) return undefined;
      return { ...s, target: Math.max(-X_LIM, Math.min(X_LIM, pt.x)) };
    },
    up: (s) => (s.dragging ? { ...s, dragging: false } : undefined),
    cursor: (s, p, pt) => (mode(p) === DRAG && Math.abs(pt.x - s.x) < MAG_HALF + 0.5 && Math.abs(pt.y - AXIS_Y) < 2 ? "grab" : undefined),
  },

  viewport: () => ({ xMin: -20, xMax: 20, yMin: -15, yMax: 11.2, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const I = current(s, p);

    if (mode(p) === GEN) drawGenerator(d, theme, p, s, I);
    else drawMagnetScene(d, theme, p, s, I);

    drawInset(d, theme, frame.trail, s, p);
  },
});

/** Espira vista em perspectiva: normal n̂ = (cos θ, 0, sen θ); a frente fica em z > 0. */
function drawLoop(d: Draw, theme: Theme, cx: number, cy: number, a: number, th: number, I: number, Imax: number) {
  const col = theme.series[4] ?? theme.text;
  const pts = (front: boolean) => {
    const out: [number, number][][] = [[]];
    for (let k = 0; k <= 96; k++) {
      const ph = (2 * Math.PI * k) / 96;
      const z = Math.cos(th) * Math.sin(ph);
      const seg = out[out.length - 1]!;
      if (z >= 0 === front) seg.push([cx - a * Math.sin(th) * Math.sin(ph), cy + a * Math.cos(ph)]);
      else if (seg.length) out.push([]);
    }
    return out;
  };
  for (const seg of pts(false)) d.polyline(seg, { color: col, width: 2, dash: [4, 4], alpha: 0.6 });
  for (const seg of pts(true)) d.polyline(seg, { color: col, width: 4 });
  // Corrente: no ponto da frente, φ = π/2 desce e φ = 3π/2 sobe (para I > 0, circulação em torno de n̂).
  if (Math.abs(I) > 1e-6 * Math.max(Imax, 1e-12)) {
    const front = Math.cos(th) >= 0 ? Math.PI / 2 : (3 * Math.PI) / 2;
    const fx = cx - a * Math.sin(th) * Math.sin(front);
    const dir = (front === Math.PI / 2 ? -1 : 1) * Math.sign(I);
    const l = Imax > 0 ? Math.max(0.15, Math.min(1, Math.abs(I) / Imax)) : 1;
    const L = 14 + 26 * l;
    d.arrowPx(fx, cy - (dir * L * d.px) / 2, 0, dir, L, { color: theme.series[1]!, width: 3, head: 10 });
    d.text(`I = ${fmtA(I)}`, fx + 1.2, cy - a - 0.9, { color: theme.series[1]!, weight: "600", size: 12, align: "left" });
  }
}

function fmtA(I: number): string {
  const a = Math.abs(I);
  const [k, u] = a >= 1 ? [1, "A"] : a >= 1e-3 ? [1e3, "mA"] : [1e6, "μA"];
  return `${Number((I * k).toPrecision(3)).toString().replace(".", ",")} ${u}`;
}

function drawMagnetScene(d: Draw, theme: Theme, p: Params, s: FaradayState, I: number) {
  const a = num(p, "a", 3);
  const m = moment(p);
  // Campo do dipolo (direção) em grade
  for (let x = -19; x <= 19; x += 2)
    for (let y = AXIS_Y - 8; y <= AXIS_Y + 8; y += 2) {
      const rx = x - s.x, ry = y - AXIS_Y;
      if (Math.abs(rx) < MAG_HALF + 0.8 && Math.abs(ry) < 1.6) continue;
      const B = dipoleB2(m, rx / 100, ry / 100);
      const mag = Math.hypot(B[0], B[1]);
      if (mag <= 0) continue;
      const r = Math.hypot(rx, ry);
      const alpha = Math.max(0.12, Math.min(0.7, 3 / r));
      d.arrowPx(x - (B[0] / mag) * 0.6, y - (B[1] / mag) * 0.6, B[0], B[1], 18, { color: theme.accent, width: 1.2, head: 5, alpha });
    }
  d.line(-19.5, AXIS_Y, 19.5, AXIS_Y, { color: theme.muted, dash: [6, 5], width: 1 });

  // Espira (atrás do ímã) e ímã
  const Imax = (num(p, "N", 100) * Math.abs(dFluxDx(p, -a / 2)) * Math.max(0.3, num(p, "v", 20) / 100, (num(p, "A", 10) / 100) * omega(p))) / num(p, "R", 10);
  drawLoop(d, theme, 0, AXIS_Y, a, -Math.asin(0.3), I, Imax);
  const nRight = m >= 0;
  d.rect(s.x - MAG_HALF, AXIS_Y - 0.8, MAG_HALF, 1.6, { fill: nRight ? theme.negative : theme.positive });
  d.rect(s.x, AXIS_Y - 0.8, MAG_HALF, 1.6, { fill: nRight ? theme.positive : theme.negative });
  d.text(nRight ? "S" : "N", s.x - MAG_HALF / 2, AXIS_Y, { color: "#ffffff", weight: "700", size: 13 });
  d.text(nRight ? "N" : "S", s.x + MAG_HALF / 2, AXIS_Y, { color: "#ffffff", weight: "700", size: 13 });
  if (Math.abs(s.v) > 0.05) d.arrowPx(s.x, AXIS_Y + 1.5, s.v, 0, Math.min(60, 10 + Math.abs(s.v)), { color: theme.text, width: 2 });
  if (mode(p) === DRAG) d.text("arraste o ímã", s.x, AXIS_Y - 1.6, { color: theme.muted, size: 11 });

  // B do ímã e B induzido no centro da espira
  const Bm = fluxAt(p, s.x);
  if (Math.abs(Bm) > 0) d.arrowPx(-0.1, AXIS_Y + 0.35, Math.sign(Bm), 0, 30, { color: theme.accent, width: 2.5 });
  d.text("B do ímã", 0, AXIS_Y + a + 1.6, { color: theme.accent, size: 11 });
  if (Math.abs(I) > 1e-9) {
    d.arrowPx(-0.1, AXIS_Y - 0.35, Math.sign(I), 0, 30, { color: theme.series[1]!, width: 2.5 });
    d.text("B induzido", 0, AXIS_Y - a - 1.0, { color: theme.series[1]!, size: 11 });
  }
  const msg = Math.abs(I) < 1e-9 ? "Φ constante: nenhuma corrente induzida" : Math.sign(I) === Math.sign(Bm) ? "Φ diminuindo: B induzido reforça o do ímã" : "Φ aumentando: B induzido se opõe ao do ímã";
  d.text(msg, -19.5, 10.4, { color: theme.text, size: 12, weight: "600", align: "left" });
}

function drawGenerator(d: Draw, theme: Theme, p: Params, s: FaradayState, I: number) {
  const a = num(p, "a", 3) * 1.2;
  for (let y = AXIS_Y - 8; y <= AXIS_Y + 8; y += 2) d.arrow(-19, y, 38, 0, { color: theme.accent, width: 1.2, alpha: 0.35 });
  d.text(`B = ${String(num(p, "B", 0.2)).replace(".", ",")} T (uniforme)`, 19.5, 10.4, { color: theme.accent, size: 12, align: "right" });
  d.line(0, AXIS_Y - a - 2, 0, AXIS_Y + a + 2, { color: theme.muted, dash: [5, 4], width: 1 });
  const Imax = (num(p, "N", 100) * num(p, "B", 0.2) * area(p) * omega(p)) / num(p, "R", 10);
  drawLoop(d, theme, 0, AXIS_Y, a, s.th, I, Imax);
  d.arrowPx(0, AXIS_Y, Math.cos(s.th), 0, Math.abs(Math.cos(s.th)) * 50, { color: theme.text, width: 2 });
  d.text("n̂", 0 + Math.cos(s.th) * 60 * d.px, AXIS_Y + 0.6, { color: theme.text, size: 12 });
  const deg = (((s.th * 180) / Math.PI) % 360).toFixed(0);
  d.text(`θ = ωt = ${deg}°   Φ = BA cos θ`, -19.5, 10.4, { color: theme.text, size: 12, weight: "600", align: "left" });
}

/** Gráfico do palco: NΦ(t) e ε(t) juntos, cada um normalizado pelo próprio máximo na janela. */
function drawInset(d: Draw, theme: Theme, trail: FaradayState[], s: FaradayState, p: Params) {
  const X0 = -19, X1 = 19, Y0 = -14.2, Y1 = -5.6, YM = (Y0 + Y1) / 2;
  const WIN = 6;
  const N = num(p, "N", 100);
  d.rect(X0, Y0, X1 - X0, Y1 - Y0, { stroke: theme.grid, width: 1 });
  d.line(X0, YM, X1, YM, { color: theme.muted, width: 1, alpha: 0.6 });
  const pts = trail.filter((q) => q.t >= s.t - WIN && q.t <= s.t);
  if (!pts.length || pts[pts.length - 1] !== s) pts.push(s);
  let mPhi = 0, mE = 0;
  for (const q of pts) {
    mPhi = Math.max(mPhi, Math.abs(N * q.phi));
    mE = Math.max(mE, Math.abs(q.emf));
  }
  const t0 = Math.max(0, s.t - WIN);
  const X = (t: number) => X0 + ((t - t0) / WIN) * (X1 - X0);
  const H = (Y1 - Y0) / 2 - 0.5;
  if (mPhi > 0) d.polyline(pts.map((q) => [X(q.t), YM + ((N * q.phi) / mPhi) * H]), { color: theme.series[0]!, width: 2 });
  if (mE > 0) d.polyline(pts.map((q) => [X(q.t), YM + (q.emf / mE) * H]), { color: theme.series[1]!, width: 2 });
  const f = (v: number) => (v === 0 ? "0" : Number(v.toPrecision(3)).toString().replace(".", ","));
  d.text(`NΦ (máx ${f(mPhi)} Wb)`, X0 + 0.3, Y1 - 0.5, { color: theme.series[0]!, size: 11, align: "left" });
  d.text(`ε (máx ${f(mE)} V)`, X0 + 12, Y1 - 0.5, { color: theme.series[1]!, size: 11, align: "left" });
  d.text(`últimos ${WIN} s`, X1 - 0.3, Y1 - 0.5, { color: theme.muted, size: 10, align: "right" });
}

export default faradayLenz;
