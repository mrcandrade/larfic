import { defineSim, draw, gaussian, num, rng, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  D_NI,
  GRAPHITE,
  L_SCREEN,
  SCREEN_R,
  dFromRadius,
  dSmallAngle,
  dgAngle,
  dgIntensity,
  ringRadius,
  ringSigma,
  wavelength,
} from "./physics.ts";

export * from "./physics.ts";

type P2 = [number, number];

export interface DEState {
  n: number;
  acc: number;
  /** Chegadas na tela (m, coordenadas na tela). */
  hits: P2[];
  /** Régua sobre a tela (m). */
  A: P2;
  B: P2;
  drag: "A" | "B" | "R" | "det" | null;
  grab: P2;
  /** Ângulo do coletor no Davisson–Germer (graus) e sentido da varredura. */
  phi: number;
  dir: number;
  /** Pontos (φ, I) medidos no Davisson–Germer. */
  trace: P2[];
}

const MAX_HITS = 4000;
const modo = (p: Params) => Math.round(num(p, "modo"));
const mono = (p: Params) => Math.round(num(p, "amostra")) === 1;
const Vv = (p: Params) => num(p, "V", 4) * 1e3;
const Ee = (p: Params) => num(p, "E", 54);
export const lambdaOf = (p: Params) => (modo(p) === 0 ? wavelength(Vv(p)) : wavelength(Ee(p)));
const rulerLen = (s: DEState) => Math.hypot(s.B[0] - s.A[0], s.B[1] - s.A[1]);

/** Sorteia a chegada de um elétron na tela (Debye–Scherrer). */
export function sampleHit(rand: () => number, p: Params): P2 {
  const lam = wavelength(Vv(p));
  const sig = ringSigma(lam);
  for (let k = 0; k < 50; k++) {
    const u = rand();
    let r: number;
    let ang = 2 * Math.PI * rand();
    if (u < 0.22) r = Math.abs(gaussian(rand)) * 1.2e-3;
    else if (u < 0.32) r = SCREEN_R * Math.sqrt(rand());
    else {
      const tot = GRAPHITE.reduce((a, f) => a + f.I, 0);
      let w = rand() * tot;
      let f = GRAPHITE[0]!;
      for (const g of GRAPHITE) {
        f = g;
        w -= g.I;
        if (w <= 0) break;
      }
      r = ringRadius(lam, f.d) + sig * gaussian(rand);
      if (mono(p)) {
        const spot = f.spots[Math.floor(rand() * f.spots.length)]!;
        ang = (spot * Math.PI) / 180 + (sig / Math.max(r, 1e-4)) * gaussian(rand);
      }
    }
    if (r < SCREEN_R) return [r * Math.cos(ang), r * Math.sin(ang)];
  }
  return [0, 0];
}

function fire(s: DEState, p: Params, count: number): DEState {
  const rand = rng(77_777 + s.n * 7919);
  const hits = s.hits.slice();
  for (let i = 0; i < count; i++) hits.push(sampleHit(rand, p));
  return { ...s, n: s.n + count, hits: hits.length > MAX_HITS ? hits.slice(hits.length - MAX_HITS) : hits };
}

const init = (p: Params): DEState => ({
  n: 0,
  acc: 0,
  hits: [],
  A: [-0.03, -0.038],
  B: [0.03, -0.038],
  drag: null,
  grab: [0, 0],
  phi: num(p, "phi0", 50),
  dir: 1,
  trace: [],
});

export const difracaoEletrons = defineSim<DEState>({
  id: "difracao-eletrons",
  title: "Difração de elétrons em cristais",
  course: "FG IV",
  topic: "Ondas de matéria",
  priority: "P2",
  summary:
    "Elétrons atravessam uma folha de grafite e formam anéis de Debye–Scherrer cujo raio cai com 1/√V; medindo o raio com a régua obtém-se a distância interplanar. No experimento de Davisson–Germer, elétrons de 54 eV refletidos por níquel mostram um pico a 50°.",
  equations: [
    String.raw`\lambda = \frac{h}{\sqrt{2m_eeV\left(1 + \frac{eV}{2m_ec^2}\right)}} \approx \frac{1{,}226\ \text{nm}}{\sqrt{V/\text{V}}}`,
    String.raw`2d\,\operatorname{sen}\theta = \lambda \qquad r = L\tan 2\theta \approx \frac{L\lambda}{d}`,
    String.raw`\text{Davisson–Germer: } D\operatorname{sen}\varphi = \lambda,\quad D = 0{,}215\ \text{nm}`,
  ],
  liveEquations(s, p) {
    const lam = lambdaOf(p);
    if (modo(p) === 0) {
      const r = rulerLen(s) / 2;
      return [
        String.raw`\lambda = ${texNum(lam * 1e12)}\ \text{pm} \quad r_{10} = ${texNum(ringRadius(lam, GRAPHITE[0]!.d) * 1e3)}\ \text{mm} \quad r_{11} = ${texNum(ringRadius(lam, GRAPHITE[1]!.d) * 1e3)}\ \text{mm}`,
        String.raw`\text{régua: } r = ${texNum(r * 1e3)}\ \text{mm} \Rightarrow d = \frac{\lambda}{2\operatorname{sen}\left(\frac12\arctan\frac rL\right)} = ${texNum(dFromRadius(lam, r) * 1e9)}\ \text{nm}\ \ (\approx L\lambda/r = ${texNum(dSmallAngle(lam, r) * 1e9)})`,
      ];
    }
    return [
      String.raw`\lambda = \frac{h}{\sqrt{2m_e e\,${texNum(Ee(p))}\ \text{V}}} = ${texNum(lam * 1e9)}\ \text{nm}`,
      String.raw`\varphi_{\text{Bragg}} = \arcsin\frac{\lambda}{D} = ${texNum(dgAngle(Ee(p)))}^\circ \qquad I(${texNum(s.phi)}^\circ) = ${texNum(dgIntensity(Ee(p), s.phi))}`,
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
        { value: 0, label: "Debye–Scherrer (grafite)" },
        { value: 1, label: "Davisson–Germer (níquel)" },
      ],
    },
    { key: "V", label: "Tensão de aceleração (grafite)", unit: "kV", min: 2, max: 10, step: 0.1, default: 4, live: true },
    {
      key: "amostra",
      label: "Amostra de grafite",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Policristalina (anéis)" },
        { value: 1, label: "Monocristal (manchas)" },
      ],
    },
    { key: "taxa", label: "Elétrons por segundo", unit: "1/s", min: 10, max: 3000, step: 10, default: 400, log: true, live: true },
    { key: "E", label: "Energia dos elétrons (níquel)", unit: "eV", min: 20, max: 200, step: 1, default: 54, live: true },
    {
      key: "varredura",
      label: "Coletor (Davisson–Germer)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Parado (arraste o coletor)" },
        { value: 1, label: "Varredura de 10° a 90°" },
      ],
      live: true,
    },
    { key: "phi0", label: "Ângulo inicial do coletor", unit: "°", min: 10, max: 90, step: 1, default: 50 },
  ],

  observables: [
    { key: "lambda", label: "Comprimento de onda λ", unit: "pm", value: (_s, p) => lambdaOf(p) * 1e12 },
    { key: "invV", label: "1/√V", unit: "kV^-1/2", value: (_s, p) => 1 / Math.sqrt(num(p, "V", 4)) },
    { key: "r10", label: "Raio do anel interno (10)", unit: "mm", value: (_s, p) => (modo(p) === 0 ? ringRadius(lambdaOf(p), GRAPHITE[0]!.d) * 1e3 : 0) },
    { key: "r11", label: "Raio do anel externo (11)", unit: "mm", value: (_s, p) => (modo(p) === 0 ? ringRadius(lambdaOf(p), GRAPHITE[1]!.d) * 1e3 : 0) },
    { key: "D10", label: "Diâmetro do anel interno (10)", unit: "mm", value: (_s, p) => (modo(p) === 0 ? 2 * ringRadius(lambdaOf(p), GRAPHITE[0]!.d) * 1e3 : 0) },
    { key: "Dregua", label: "Leitura da régua (diâmetro)", unit: "mm", value: (s) => rulerLen(s) * 1e3 },
    { key: "dregua", label: "d pela régua", unit: "nm", value: (s, p) => (modo(p) === 0 ? dFromRadius(lambdaOf(p), rulerLen(s) / 2) * 1e9 : 0) },
    { key: "N", label: "Elétrons na tela", unit: "", value: (s) => s.n },
    { key: "phi", label: "Ângulo do coletor φ", unit: "°", value: (s) => s.phi },
    { key: "Idet", label: "Corrente no coletor", unit: "u.a.", value: (s, p) => (modo(p) === 1 ? dgIntensity(Ee(p), s.phi) : 0) },
    { key: "phiB", label: "φ previsto (D sen φ = λ)", unit: "°", value: (_s, p) => (modo(p) === 1 && Number.isFinite(dgAngle(Ee(p))) ? dgAngle(Ee(p)) : 0) },
  ],
  chart: { x: "invV", y: "r10" },

  scenarios: [
    {
      id: "aneis",
      label: "Anéis do grafite",
      params: { modo: 0, V: 4, amostra: 0, taxa: 400 },
      guide: `### Medindo d com a régua
1. Os elétrons de 4 kV chegam um a um na tela e desenham **dois anéis** principais: as reflexões (10) e (11) do grafite.
2. Arraste as pontas da **régua** sobre um diâmetro do anel interno (arrastar o meio move a régua). Use $r = D/2$.
3. Com $\\lambda = h/p$ (equações vivas) e $L = 13{,}5\\ \\text{cm}$: $d = L\\lambda/r$. Compare com $d_{10} = 0{,}213\\ \\text{nm}$ e $d_{11} = 0{,}123\\ \\text{nm}$.
4. A razão $r_{11}/r_{10} \\approx \\sqrt3$ é a assinatura da rede hexagonal.`,
      predict: [
        {
          question: "Aumentando a tensão de aceleração de 4 kV para 9 kV, os anéis:",
          options: ["crescem", "diminuem para cerca de 2/3 do raio", "diminuem para 4/9 do raio", "não mudam"],
          answer: 1,
          explanation: "$\\lambda \\propto 1/\\sqrt V$ e $r \\approx L\\lambda/d$, então $r$ cai por $\\sqrt{4/9} = 2/3$.",
        },
      ],
    },
    {
      id: "raio-tensao",
      label: "Raio contra 1/√V",
      params: { modo: 0, V: 2.5, amostra: 0, taxa: 2000 },
      guide: `### Uma reta pela origem
1. Varie $V$ de 2,5 kV a 10 kV durante a simulação. O gráfico do painel mostra $r$ contra $1/\\sqrt V$.
2. As duas famílias dão retas pela origem; a inclinação de cada uma vale $L \\cdot 1{,}226\\ \\text{nm·V}^{1/2}/d$.
3. Troque para **monocristal**: os anéis viram manchas hexagonais, nas mesmas distâncias do centro.`,
    },
    {
      id: "davisson-germer",
      label: "Davisson–Germer: 54 eV a 50°",
      params: { modo: 1, E: 54, varredura: 1, phi0: 10 },
      guide: `### O pico que confirmou de Broglie
1. O coletor gira de 10° a 90° em torno do cristal de níquel, e o diagrama polar mostra a corrente em cada ângulo.
2. A 54 eV aparece uma "orelha" em torno de 50°: $D\\,\\operatorname{sen}\\varphi = \\lambda$ com $D = 0{,}215\\ \\text{nm}$ e $\\lambda = 0{,}167\\ \\text{nm}$.
3. Mude $E$ para 40 eV e 68 eV: o pico enfraquece, porque a condição entre as camadas atômicas, $c(1 + \\cos\\varphi) = m\\lambda$, deixa de ser satisfeita.
4. O gráfico pequeno mostra a corrente contra a energia no ângulo atual do coletor.`,
      predict: [
        {
          question: "Se a energia dos elétrons passar de 54 eV para 100 eV, o ângulo previsto por D sen φ = λ:",
          options: ["aumenta", "diminui", "não muda"],
          answer: 1,
          explanation: "Mais energia, $\\lambda$ menor, então $\\operatorname{sen}\\varphi = \\lambda/D$ diminui (cerca de 35° a 100 eV).",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "d-grafite",
      prompt: "Elétrons acelerados por {V} kV atravessam grafite e formam um anel de {r} mm de raio numa tela a 13,5 cm. Qual é a distância interplanar (aproximação de ângulos pequenos, λ não relativístico)?",
      vary: { V: [3, 9, 1], r: [10, 25, 1] },
      answer: {
        label: "d",
        unit: "nm",
        compute: (p) => ((L_SCREEN * (6.62607015e-34 / Math.sqrt(2 * 9.1093837015e-31 * 1.602176634e-19 * num(p, "V") * 1e3))) / (num(p, "r") * 1e-3)) * 1e9,
      },
      hint: "λ = h/√(2meV) e d = Lλ/r.",
    },
    {
      id: "dg-angulo",
      prompt: "No experimento de Davisson–Germer (D = 0,215 nm), em que ângulo aparece o pico de primeira ordem para elétrons de {E} eV?",
      vary: { E: [40, 150, 0] },
      answer: { label: "φ", unit: "°", compute: (p) => dgAngle(num(p, "E")) },
      hint: "λ = h/√(2meE) e D sen φ = λ.",
    },
  ],

  init,
  step(s, p, _t, dt) {
    if (modo(p) === 0) {
      const acc = s.acc + num(p, "taxa", 400) * dt;
      const k = Math.min(400, Math.floor(acc));
      const out = k > 0 ? fire(s, p, k) : s;
      return { ...out, acc: acc - Math.floor(acc) };
    }
    if (Math.round(num(p, "varredura")) !== 1) return s;
    let phi = s.phi + s.dir * 10 * dt;
    let dir = s.dir;
    if (phi >= 90) {
      phi = 90;
      dir = -1;
    } else if (phi <= 10) {
      phi = 10;
      dir = 1;
    }
    const trace: P2[] = [...(s.trace.length > 2000 ? s.trace.slice(1) : s.trace), [phi, dgIntensity(Ee(p), phi)]];
    return { ...s, phi, dir, trace };
  },
  dt: 0.02,
  sampleEvery: 5,
  maxSamples: 3000,

  actions: [
    { id: "mil", label: "Disparar 2000 elétrons", run: (s, p) => (modo(p) === 0 ? fire(s, p, 2000) : s) },
    { id: "limpar", label: "Limpar tela e curva", run: (s) => ({ ...s, n: 0, hits: [], trace: [] }) },
    {
      id: "regua-anel",
      label: "Régua no diâmetro do anel interno",
      run(s, p) {
        const r = ringRadius(lambdaOf(p), GRAPHITE[0]!.d);
        return { ...s, A: [-r, 0], B: [r, 0] };
      },
    },
  ],

  pointer: {
    down(s, p, pt) {
      if (modo(p) === 1) {
        const [dx, dy] = detXY(s.phi);
        return Math.hypot(pt.x - dx, pt.y - dy) < 0.7 ? { ...s, drag: "det" } : undefined;
      }
      const q = toScreen(pt.x, pt.y);
      const tol = 0.6 / SK;
      if (Math.hypot(q[0] - s.A[0], q[1] - s.A[1]) < tol) return { ...s, drag: "A" };
      if (Math.hypot(q[0] - s.B[0], q[1] - s.B[1]) < tol) return { ...s, drag: "B" };
      const [ax, ay] = s.A;
      const [bx, by] = s.B;
      const L2 = (bx - ax) ** 2 + (by - ay) ** 2 || 1e-12;
      const u = Math.max(0, Math.min(1, ((q[0] - ax) * (bx - ax) + (q[1] - ay) * (by - ay)) / L2));
      if (Math.hypot(q[0] - ax - u * (bx - ax), q[1] - ay - u * (by - ay)) < tol) return { ...s, drag: "R", grab: q };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (s.drag === "det") {
        const ang = (Math.atan2(pt.x - CRYSTAL[0], pt.y - CRYSTAL[1]) * 180) / Math.PI;
        const phi = Math.max(10, Math.min(90, ang));
        return { ...s, phi, trace: [...s.trace, [phi, dgIntensity(Ee(p), phi)]] };
      }
      const q = toScreen(pt.x, pt.y);
      if (s.drag === "A") return { ...s, A: q };
      if (s.drag === "B") return { ...s, B: q };
      const dx = q[0] - s.grab[0];
      const dy = q[1] - s.grab[1];
      return { ...s, A: [s.A[0] + dx, s.A[1] + dy], B: [s.B[0] + dx, s.B[1] + dy], grab: q };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      if (modo(p) === 1) {
        const [dx, dy] = detXY(s.phi);
        return Math.hypot(pt.x - dx, pt.y - dy) < 0.7 ? "grab" : undefined;
      }
      const q = toScreen(pt.x, pt.y);
      const tol = 0.6 / SK;
      return Math.hypot(q[0] - s.A[0], q[1] - s.A[1]) < tol || Math.hypot(q[0] - s.B[0], q[1] - s.B[1]) < tol ? "crosshair" : undefined;
    },
  },

  narrowSplit: () => 0.403,
  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (modo(frame.params) === 0) renderDS(d, frame.theme, frame.state, frame.params);
    else renderDG(d, frame.theme, frame.state, frame.params);
  },
});

/** Tela de frente: centro no palco e escala (palco por metro). */
const SC: P2 = [13.9, 6.1];
const SK = 5.4 / SCREEN_R;
const toScreen = (x: number, y: number): P2 => [(x - SC[0]) / SK, (y - SC[1]) / SK];
const W = (q: P2): P2 => [SC[0] + q[0] * SK, SC[1] + q[1] * SK];

function renderDS(d: Draw, th: Theme, s: DEState, p: Params) {
  const lam = lambdaOf(p);
  // Esquema do tubo
  d.circle(5.0, 9.4, 1.9, { stroke: th.muted, width: 1.2, fill: th.dark ? "rgba(90,120,170,0.08)" : "rgba(60,90,140,0.04)" });
  d.rect(0.4, 9.15, 2.2, 0.5, { fill: th.grid, stroke: th.text, width: 1 });
  d.text(`canhão ${fmt(num(p, "V", 4))} kV`, 1.5, 8.6, { size: 10, color: th.muted });
  d.line(3.1, 9.0, 3.1, 9.8, { color: th.series[5]!, width: 3 });
  d.text("grafite", 3.1, 10.2, { size: 10, color: th.series[5]! });
  d.line(2.6, 9.4, 3.1, 9.4, { color: th.accent, width: 2 });
  for (const f of GRAPHITE.slice(0, 2)) {
    const a = 2 * Math.asin(lam / (2 * f.d));
    const ang = Math.min(a * 6, 0.9);
    for (const sgn of [1, -1]) d.line(3.1, 9.4, 3.1 + 3.7 * Math.cos(ang), 9.4 + sgn * 3.7 * Math.sin(ang) * 0.5, { color: th.accent, width: 1, alpha: 0.6, dash: [3, 3] });
  }
  d.text("2θ (exagerado)", 4.6, 11.5, { size: 10, color: th.muted });
  d.text(`L = ${fmt(L_SCREEN * 100)} cm até a tela`, 0.4, 7.6, { align: "left", size: 10, color: th.muted });
  // Tela de frente
  d.circle(SC[0], SC[1], SCREEN_R * SK, { fill: "#071009", stroke: th.muted, width: 2 });
  const phosphor = "#7dff9a";
  for (const h of s.hits) {
    const [x, y] = W(h);
    d.dot(x, y, 1.1, phosphor, 0.55);
  }
  d.dot(SC[0], SC[1], 10, phosphor, 0.25);
  d.dot(SC[0], SC[1], 4, "#eaffef");
  // Régua
  const A = W(s.A);
  const B = W(s.B);
  const len = rulerLen(s);
  if (len > 1e-6) {
    const ux = (B[0] - A[0]) / (len * SK);
    const uy = (B[1] - A[1]) / (len * SK);
    const nx = -uy;
    const ny = ux;
    d.polyline([A, B, [B[0] + nx * 0.35, B[1] + ny * 0.35], [A[0] + nx * 0.35, A[1] + ny * 0.35]], { close: true, fill: "rgba(230,200,120,0.3)", color: th.series[5]!, width: 1 });
    for (let k = 0; k <= len * 1e3 + 1e-9; k++) {
      const t = (k * 1e-3) * SK;
      const h = k % 10 === 0 ? 0.3 : k % 5 === 0 ? 0.22 : 0.12;
      d.line(A[0] + ux * t, A[1] + uy * t, A[0] + ux * t + nx * h, A[1] + uy * t + ny * h, { color: "#f4e7c0", width: 0.6 });
    }
    for (const q of [A, B]) d.circle(q[0], q[1], 0.17, { fill: th.accent, stroke: "#ffffff", width: 1 });
    d.text(`${fmt(len * 1e3)} mm`, (A[0] + B[0]) / 2 + nx * 0.8, (A[1] + B[1]) / 2 + ny * 0.8, { size: 12, weight: "600", color: th.series[5]! });
  }
  d.text(`tela de frente (raio ${SCREEN_R * 100} cm) · N = ${s.n}`, SC[0], SC[1] + SCREEN_R * SK + 0.35, { size: 10, color: th.muted });
  // Leituras
  const r = len / 2;
  const rows = [
    `λ = ${fmt(lam * 1e12)} pm`,
    `r₁₀ = ${fmt(ringRadius(lam, GRAPHITE[0]!.d) * 1e3)} mm   r₁₁ = ${fmt(ringRadius(lam, GRAPHITE[1]!.d) * 1e3)} mm`,
    `régua: r = ${fmt(r * 1e3)} mm → d = ${fmt(dFromRadius(lam, r) * 1e9)} nm`,
    `${mono(p) ? "monocristal: manchas hexagonais" : "policristal: anéis"}`,
  ];
  rows.forEach((t, i) => d.text(t, 0.4, 7.0 - i * 0.5, { align: "left", size: 11, weight: i === 0 ? "600" : "400" }));
  // Gráfico r × 1/√V
  const P = panel(d, { x0: 1.2, y0: 0.8, x1: 7.4, y1: 4.6 }, { min: 0, max: 0.75 }, { min: 0, max: 40 });
  P.frame({ xlabel: "1/√V (kV^-½)", ylabel: "r (mm)", xticks: [0, 0.25, 0.5, 0.75] });
  GRAPHITE.slice(0, 2).forEach((f, i) => {
    P.plot((x) => ringRadius(wavelength(1e3 / (x * x)), f.d) * 1e3, 0.3, 0.72, { color: th.series[i + 1]!, width: 1.5 });
    const x0 = 1 / Math.sqrt(num(p, "V", 4));
    d.dot(P.X(x0), P.Y(ringRadius(lam, f.d) * 1e3), 3.5, th.series[i + 1]!);
    d.text(f.hk, P.X(0.72), P.Y(ringRadius(wavelength(1e3 / 0.72 ** 2), f.d) * 1e3), { size: 10, color: th.series[i + 1]!, dx: 9 });
  });
}

const CRYSTAL: P2 = [5.5, 2.4];
const RDET = 4.3;
const detXY = (phi: number): P2 => [CRYSTAL[0] + RDET * Math.sin((phi * Math.PI) / 180), CRYSTAL[1] + RDET * Math.cos((phi * Math.PI) / 180)];

function renderDG(d: Draw, th: Theme, s: DEState, p: Params) {
  const E = Ee(p);
  // Cristal e canhão
  d.rect(CRYSTAL[0] - 1.3, CRYSTAL[1] - 0.7, 2.6, 0.7, { fill: th.muted, stroke: th.text, width: 1 });
  for (let i = -5; i <= 5; i++) d.dot(CRYSTAL[0] + i * 0.22, CRYSTAL[1] - 0.12, 1.8, th.text);
  d.text("Ni (111)", CRYSTAL[0], CRYSTAL[1] - 1.05, { size: 10, color: th.muted });
  d.rect(CRYSTAL[0] - 0.25, 8.4, 0.5, 1.4, { fill: th.grid, stroke: th.text, width: 1 });
  d.text(`canhão ${fmt(E)} eV`, CRYSTAL[0], 10.15, { size: 10, color: th.muted });
  d.arrow(CRYSTAL[0], 8.4, 0, -(8.4 - CRYSTAL[1] - 0.1), { color: th.accent, width: 2 });
  // Arco de 0 a 90°
  const arc: P2[] = [];
  for (let a = 0; a <= 90; a += 3) arc.push(detXY(a));
  d.polyline(arc, { color: th.grid, width: 1, dash: [4, 4] });
  for (const a of [30, 50, 70, 90]) {
    const [x, y] = detXY(a);
    d.text(`${a}°`, x, y, { size: 9, color: th.muted, dx: 14, dy: -4 });
  }
  // Coletor
  const [dx, dy] = detXY(s.phi);
  const I = dgIntensity(E, s.phi);
  d.line(CRYSTAL[0], CRYSTAL[1], dx, dy, { color: th.positive, width: 1 + 3 * Math.min(1, I), alpha: 0.6 });
  d.box(dx, dy, 0.9, 0.5, -((s.phi * Math.PI) / 180), { fill: th.positive, stroke: th.text, width: 1 });
  d.text(`φ = ${fmt(s.phi, 3)}°`, dx, dy, { size: 11, weight: "600", dx: 18, dy: -14, align: "left" });
  // Leituras
  const pB = dgAngle(E);
  const rows = [
    `I no coletor = ${fmt(I, 3)} u.a.`,
    `λ = ${fmt(wavelength(E) * 1e9)} nm`,
    `D sen φ = λ → φ = ${Number.isFinite(pB) ? fmt(pB, 3) + "°" : "—"}`,
    `D = ${fmt(D_NI * 1e9)} nm`,
  ];
  rows.forEach((t, i) => d.text(t, 0.4, 11.5 - i * 0.55, { align: "left", size: 11, weight: i === 0 ? "600" : "400" }));
  // Diagrama polar I(φ)
  const O: P2 = [13.2, 1.0];
  const Rp = 5.6;
  const Imax = 1.6;
  for (const f of [0.25, 0.5, 0.75, 1]) {
    const pts: P2[] = [];
    for (let a = 0; a <= 90; a += 3) pts.push([O[0] + f * Rp * Math.sin((a * Math.PI) / 180), O[1] + f * Rp * Math.cos((a * Math.PI) / 180)]);
    d.polyline(pts, { color: th.grid, width: 1 });
  }
  for (const a of [0, 30, 60, 90]) d.line(O[0], O[1], O[0] + Rp * Math.sin((a * Math.PI) / 180), O[1] + Rp * Math.cos((a * Math.PI) / 180), { color: th.grid, width: 1 });
  const polar = (a: number, v: number): P2 => [O[0] + (Math.min(v, Imax) / Imax) * Rp * Math.sin((a * Math.PI) / 180), O[1] + (Math.min(v, Imax) / Imax) * Rp * Math.cos((a * Math.PI) / 180)];
  const model: P2[] = [];
  for (let a = 0; a <= 90; a += 0.5) model.push(polar(a, dgIntensity(E, a)));
  d.polyline(model, { color: th.muted, width: 1, dash: [3, 3] });
  for (const [a, v] of s.trace) {
    const [x, y] = polar(a, v);
    d.dot(x, y, 1.6, th.accent);
  }
  d.line(O[0], O[1], ...polar(s.phi, Imax), { color: th.positive, width: 1, alpha: 0.5 });
  d.text("diagrama polar I(φ)", O[0], O[1] + Rp + 0.35, { size: 10, color: th.muted, align: "left" });
  // I × E no ângulo atual
  const P = panel(d, { x0: 14.8, y0: 8.2, x1: 19.6, y1: 11.3 }, { min: 20, max: 200 }, { min: 0, max: 1.6 });
  P.frame({ xlabel: "E (eV)", ylabel: `I a φ = ${fmt(s.phi, 3)}°`, xticks: [20, 60, 100, 140, 180] });
  P.plot((e) => dgIntensity(e, s.phi), 20, 200, { color: th.series[1]!, width: 1.5, n: 360 });
  d.dot(P.X(E), P.Y(Math.min(1.6, I)), 3.5, th.positive);
}

export default difracaoEletrons;
