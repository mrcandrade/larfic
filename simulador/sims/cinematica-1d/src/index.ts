import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

export const T_MAX = 10;
export const BINS = 40;
const A_MAX = 5;
const ROAD = 30;

export interface Kin1D {
  x: number;
  v: number;
  /** Perfil de aceleração desenhado: BINS valores, cada um vale por T_MAX/BINS segundos. */
  prof: number[];
}

/** Perfis prontos (modo 1 em diante). */
export function presetProfile(kind: number): number[] {
  const out = new Array<number>(BINS).fill(0);
  for (let i = 0; i < BINS; i++) {
    const t = ((i + 0.5) * T_MAX) / BINS;
    if (kind === 2) out[i] = t < 3 ? 2 : t < 7 ? 0 : -1.5; // acelera, cruzeiro, freia
    if (kind === 3) out[i] = 2 * Math.sin((2 * Math.PI * t) / 5); // vaivém
  }
  return out;
}

export const accelAt = (s: Kin1D, p: Params, t: number) =>
  Math.round(num(p, "modo")) === 0 ? num(p, "a") : (s.prof[Math.min(BINS - 1, Math.max(0, Math.floor((t / T_MAX) * BINS)))] ?? 0);

// Área do editor de a(t) no palco (coordenadas do mundo).
const ED = { x0: -14, x1: 14, y0: -12.5, y1: -3.5 };
const edT = (x: number) => ((x - ED.x0) / (ED.x1 - ED.x0)) * T_MAX;
const edA = (y: number) => ((y - (ED.y0 + ED.y1) / 2) / ((ED.y1 - ED.y0) / 2)) * A_MAX;
const edX = (t: number) => ED.x0 + (t / T_MAX) * (ED.x1 - ED.x0);
const edY = (a: number) => (ED.y0 + ED.y1) / 2 + (a / A_MAX) * ((ED.y1 - ED.y0) / 2);

function paint(s: Kin1D, x: number, y: number): Kin1D | undefined {
  if (x < ED.x0 || x > ED.x1 || y < ED.y0 - 1 || y > ED.y1 + 1) return undefined;
  const i = Math.min(BINS - 1, Math.max(0, Math.floor((edT(x) / T_MAX) * BINS)));
  const a = Math.max(-A_MAX, Math.min(A_MAX, Math.round(edA(y) * 4) / 4));
  const prof = s.prof.slice();
  prof[i] = a;
  return { ...s, prof };
}

export const cinematica1d = defineSim<Kin1D>({
  id: "cinematica-1d",
  title: "Cinemática 1D com gráficos ligados",
  course: "FG I",
  topic: "Cinemática 1D",
  priority: "P1",
  summary:
    "Um carro numa estrada reta. Controle a aceleração ao vivo ou desenhe o gráfico a(t) com o mouse e veja v(t) e x(t) saírem por integração.",
  equations: [
    String.raw`v(t) = v_0 + \int_0^t a\,dt' \qquad x(t) = x_0 + \int_0^t v\,dt'`,
    String.raw`a = \frac{dv}{dt} \qquad v = \frac{dx}{dt}`,
    String.raw`\text{a constante: } x = x_0 + v_0 t + \tfrac12 a t^2 \qquad v^2 = v_0^2 + 2a\,\Delta x`,
  ],
  liveEquations(s, p, t) {
    return [String.raw`a(${texNum(t)}\,\text{s}) = ${texNum(accelAt(s, p, t))}\ \text{m/s}^2 \qquad v = ${texNum(s.v)}\ \text{m/s} \qquad x = ${texNum(s.x)}\ \text{m}`];
  },

  params: [
    {
      key: "modo",
      label: "Aceleração",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Controle ao vivo (slider)" },
        { value: 1, label: "Desenhar a(t) no palco" },
        { value: 2, label: "Perfil: acelera, cruzeiro, freia" },
        { value: 3, label: "Perfil: vaivém senoidal" },
      ],
    },
    { key: "a", label: "Aceleração (modo ao vivo)", unit: "m/s²", min: -5, max: 5, step: 0.1, default: 1, live: true },
    { key: "x0", label: "Posição inicial", unit: "m", min: -25, max: 25, step: 0.5, default: -20 },
    { key: "v0", label: "Velocidade inicial", unit: "m/s", min: -10, max: 10, step: 0.1, default: 0 },
  ],

  observables: [
    { key: "x", label: "Posição x", unit: "m", value: (s) => s.x },
    { key: "v", label: "Velocidade v", unit: "m/s", value: (s) => s.v },
    { key: "a", label: "Aceleração a", unit: "m/s²", value: (s, p, t) => accelAt(s, p, t) },
  ],
  chart: { x: "t", y: "x" },

  scenarios: [
    {
      id: "vivo",
      label: "Controle ao vivo",
      params: { modo: 0, a: 1, x0: -20, v0: 0 },
      guide: `### Pisando no acelerador
1. Rode e mude a aceleração durante o movimento.
2. No gráfico, compare **x(t)** com **v(t)** (use "Comparar com"). Onde v = 0, x tem um máximo ou mínimo?
3. Com $a < 0$ e $v > 0$ o carro está freando. Ele chega a andar para trás?`,
      predict: [
        {
          question: "Um carro com velocidade positiva e aceleração negativa constante:",
          options: ["anda sempre para a frente, cada vez mais devagar", "para e depois volta", "para e fica parado"],
          answer: 1,
          explanation: "Com $a$ constante e negativa, $v$ diminui, passa por zero e fica negativa: o carro inverte o sentido. Só um freio de verdade (atrito) faria parar e ficar parado.",
        },
      ],
    },
    {
      id: "desenhar",
      label: "Desenhe a(t)",
      params: { modo: 1, x0: -20, v0: 0 },
      guide: `### Do gráfico de a ao de x
1. Clique e arraste na área de baixo do palco para desenhar a aceleração em cada instante.
2. Antes de rodar, esboce no papel como devem ficar $v(t)$ e $x(t)$.
3. Rode e confira. A área sob $a(t)$ entre 0 e $t$ é a variação de velocidade.`,
    },
    {
      id: "trajeto",
      label: "Acelera, cruzeiro, freia",
      params: { modo: 2, x0: -25, v0: 0 },
      guide: `### Trajeto típico
Leia no perfil as três fases. Calcule a velocidade de cruzeiro e a distância total e confira com as medidas.`,
    },
  ],

  exercises: [
    {
      id: "mruv",
      prompt: "Um carro parte do repouso com aceleração constante de {a} m/s². Que distância percorre em {t} s?",
      vary: { a: [0.5, 5, 1], t: [2, 10, 0] },
      answer: { label: "Δx", unit: "m", compute: (p) => 0.5 * num(p, "a") * num(p, "t") ** 2 },
    },
    {
      id: "frenagem",
      prompt: "Um carro a {v0} m/s freia com desaceleração constante de {a} m/s². Que distância percorre até parar?",
      vary: { v0: [5, 30, 0], a: [2, 8, 1] },
      answer: { label: "d", unit: "m", compute: (p) => num(p, "v0") ** 2 / (2 * num(p, "a")) },
      hint: "Use v² = v₀² + 2aΔx com v = 0.",
    },
  ],

  init: (p) => {
    const modo = Math.round(num(p, "modo"));
    return { x: num(p, "x0"), v: num(p, "v0"), prof: modo >= 2 ? presetProfile(modo) : new Array<number>(BINS).fill(0) };
  },
  step(s, p, t, dt) {
    // a é constante dentro do passo (perfil por degraus): integração exata.
    const a = accelAt(s, p, t);
    return { ...s, x: s.x + s.v * dt + 0.5 * a * dt * dt, v: s.v + a * dt };
  },
  dt: 1e-3,
  sampleEvery: 20,
  tEnd: T_MAX,

  pointer: {
    down: (s, p, pt) => (Math.round(num(p, "modo")) === 1 ? paint(s, pt.x, pt.y) : undefined),
    move: (s, p, pt, dragging) => (dragging && Math.round(num(p, "modo")) === 1 ? paint(s, pt.x, pt.y) : undefined),
    cursor: (_s, p, pt) => (Math.round(num(p, "modo")) === 1 && pt.y < ED.y1 + 1 && pt.y > ED.y0 - 1 ? "crosshair" : undefined),
  },
  actions: [
    { id: "zerar", label: "Zerar perfil a(t)", run: (s) => ({ ...s, prof: new Array<number>(BINS).fill(0) }) },
  ],

  viewport: () => ({ xMin: -ROAD / 2 - 2, xMax: ROAD / 2 + 2, yMin: -14, yMax: 4 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const modo = Math.round(num(p, "modo"));

    // Estrada com marcas de posição
    d.rect(-ROAD / 2 - 2, -0.6, ROAD + 4, 0.6, { fill: theme.ground });
    for (let x = -ROAD / 2; x <= ROAD / 2; x += 5) {
      d.line(x, -0.6, x, -0.2, { color: theme.muted });
      d.text(`${x}`, x, -1.1, { color: theme.muted, size: 10 });
    }
    d.text("x (m)", ROAD / 2 + 1.5, -1.1, { color: theme.muted, size: 10 });

    // Carro (sai da tela → indicador na borda)
    const cx = Math.max(-ROAD / 2 - 1, Math.min(ROAD / 2 + 1, s.x));
    const off = cx !== s.x;
    d.rect(cx - 1.2, 0, 2.4, 0.9, { fill: theme.series[1], alpha: off ? 0.4 : 1 });
    d.rect(cx - 0.6, 0.9, 1.4, 0.6, { fill: theme.series[1], alpha: off ? 0.4 : 1 });
    d.circle(cx - 0.7, 0, 0.32, { fill: theme.text });
    d.circle(cx + 0.7, 0, 0.32, { fill: theme.text });
    if (off) d.text("fora da estrada", cx, 2.6, { color: theme.muted, size: 11 });

    const a = accelAt(s, p, t);
    d.arrowPx(cx, 2.0, s.v, 0, Math.min(140, Math.abs(s.v) * 12), { color: theme.accent });
    if (Math.abs(s.v) > 0.05) d.text("v", cx + Math.sign(s.v) * 0.4, 2.6, { color: theme.accent, size: 12, weight: "600" });
    d.arrowPx(cx, 3.2, a, 0, Math.min(140, Math.abs(a) * 25), { color: theme.positive });
    if (Math.abs(a) > 0.05) d.text("a", cx + Math.sign(a) * 0.4, 3.75, { color: theme.positive, size: 12, weight: "600" });

    // Editor / visualização de a(t)
    d.rect(ED.x0, ED.y0, ED.x1 - ED.x0, ED.y1 - ED.y0, { stroke: theme.grid, width: 1 });
    d.line(ED.x0, edY(0), ED.x1, edY(0), { color: theme.muted });
    for (let tt = 0; tt <= T_MAX; tt += 2) d.text(`${tt}`, edX(tt), ED.y0 - 0.6, { color: theme.muted, size: 10 });
    for (const aa of [-5, 0, 5]) d.text(`${aa}`, ED.x0 - 0.5, edY(aa), { color: theme.muted, size: 10, align: "right" });
    d.text(modo === 1 ? "a(t) em m/s²: arraste aqui para desenhar" : "a(t) em m/s²", ED.x0, ED.y1 + 0.7, {
      color: modo === 1 ? theme.accent : theme.muted,
      size: 11,
      align: "left",
    });
    if (modo === 0) {
      d.line(ED.x0, edY(a), ED.x1, edY(a), { color: theme.positive, dash: [5, 4], alpha: 0.7 });
    } else {
      const w = (ED.x1 - ED.x0) / BINS;
      s.prof.forEach((v, i) => {
        const x = ED.x0 + i * w;
        d.rect(x + w * 0.08, Math.min(edY(0), edY(v)), w * 0.84, Math.abs(edY(v) - edY(0)), { fill: theme.positive, alpha: 0.55 });
      });
    }
    d.line(edX(Math.min(t, T_MAX)), ED.y0, edX(Math.min(t, T_MAX)), ED.y1, { color: theme.accent, width: 2 });
  },
});

export default cinematica1d;
