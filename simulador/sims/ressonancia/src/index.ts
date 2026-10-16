import { defineSim, draw, num, texNum, type Draw, type Params, type State } from "@fisilab/core";

// Estado: [x, v, trabalho da força externa, energia dissipada, fase da força ψ (dψ/dt = ω)]
const X = 0, V = 1, WIN = 2, WD = 3, PSI = 4;
const DEG = Math.PI / 180;

export const omega0 = (p: Params) => Math.sqrt(num(p, "k", 25) / num(p, "m", 1));
export const gammaOf = (p: Params) => num(p, "b", 0.5) / (2 * num(p, "m", 1));
export const qualityFactor = (p: Params) => omega0(p) / (2 * gammaOf(p));

/** Amplitude em regime permanente A(ω) = (F₀/m) / √((ω₀² − ω²)² + (2γω)²). */
export function steadyAmplitude(p: Params, w = num(p, "w", 4)): number {
  const w0 = omega0(p), g = gammaOf(p);
  return num(p, "F0", 1) / num(p, "m", 1) / Math.hypot(w0 * w0 - w * w, 2 * g * w);
}
/** Atraso de fase δ(ω) ∈ [0, π] do deslocamento em relação à força. */
export function phaseLag(p: Params, w = num(p, "w", 4)): number {
  const w0 = omega0(p), g = gammaOf(p);
  return Math.atan2(2 * g * w, w0 * w0 - w * w);
}
/** Frequência de ressonância de amplitude ω_r = √(ω₀² − 2γ²) (0 se não houver pico). */
export function resonanceOmega(p: Params): number {
  return Math.sqrt(Math.max(0, omega0(p) ** 2 - 2 * gammaOf(p) ** 2));
}
const peakAmplitude = (p: Params) => steadyAmplitude(p, resonanceOmega(p));

const forceOf = (s: State, p: Params) => num(p, "F0", 1) * Math.cos(s[PSI]!);
const steadyX = (s: State, p: Params) => steadyAmplitude(p) * Math.cos(s[PSI]! - phaseLag(p));

function derivatives(s: State, p: Params): State {
  const m = num(p, "m", 1), k = num(p, "k", 25), b = num(p, "b", 0.5);
  const F = forceOf(s, p);
  const v = s[V]!;
  return [v, (F - k * s[X]! - b * v) / m, F * v, b * v * v, num(p, "w", 4)];
}

// ---- Layout (coordenadas abstratas, sem unidade) ----
const GR = { x0: -1.1, x1: 0.55, yc: -0.5, h: 0.42 };
const RC = { x0: 0.82, x1: 2.38, y0: 0.12, y1: 0.86 }; // curva de ressonância
const PH = { x0: 0.82, x1: 2.38, y0: -0.92, y1: -0.3 }; // fase

const fmt = (v: number, d = 3) => (Number.isFinite(v) ? Number(v.toPrecision(d)).toString().replace(".", ",") : "∞");

function drawSpringMass(d: Draw, s: State, p: Params, xd: number) {
  const { theme } = d;
  const y = 0.55, h = 0.2, bw = 0.2, wall = -1.1, eq = -0.3;
  const xb = eq + xd;
  d.line(wall, y - h / 2 - 0.02, 0.6, y - h / 2 - 0.02, { color: theme.muted, width: 1, alpha: 0.6 });
  d.support(wall, y - h / 2, wall, y + h / 2 + 0.05, { color: theme.muted });
  d.spring(wall, y, xb - bw / 2, y, { color: theme.muted, coils: 10, width: 1.8 });
  d.line(eq, y - h / 2 - 0.06, eq, y + h / 2 + 0.03, { color: theme.grid, dash: [3, 3] });
  d.rect(xb - bw / 2, y - h / 2, bw, h, { fill: theme.series[1], stroke: theme.text, width: 1 });
  const F = forceOf(s, p), F0 = Math.max(1e-9, num(p, "F0", 1));
  d.arrowPx(xb, y + h / 2 + 0.07, F, 0, (Math.abs(F) / F0) * 60, { color: theme.accent });
  d.text("F(t) = F₀ cos ωt", xb, y + h / 2 + 0.16, { color: theme.accent, size: 11 });
}

function drawBridge(d: Draw, s: State, p: Params, xd: number) {
  const { theme } = d;
  const xa = -1.0, xb = 0.5, deckY = 0.45, top = 0.92;
  const span = xb - xa;
  const defl = (u: number) => xd * 0.6 * Math.sin(Math.PI * u);
  // Torres e água
  d.rect(-1.15, 0.12, 1.75, 0.08, { fill: theme.series[0]!, alpha: 0.18 });
  for (const xt of [xa, xb]) d.rect(xt - 0.025, 0.2, 0.05, top - 0.2, { fill: theme.muted });
  // Tabuleiro deformado no primeiro modo de flexão
  const deck: [number, number][] = [];
  const n = 40;
  for (let i = 0; i <= n; i++) deck.push([xa + (span * i) / n, deckY + defl(i / n)]);
  d.polyline(deck, { color: theme.series[1]!, width: 6 });
  d.polyline([[-1.15, deckY], [xa, deckY]], { color: theme.series[1]!, width: 6 });
  d.polyline([[xb, deckY], [0.6, deckY]], { color: theme.series[1]!, width: 6 });
  // Cabo principal e pendurais
  const cable = (u: number) => top - 0.36 * 4 * u * (1 - u);
  const cpts: [number, number][] = [];
  for (let i = 0; i <= n; i++) cpts.push([xa + (span * i) / n, cable(i / n)]);
  d.polyline(cpts, { color: theme.text, width: 1.5 });
  for (let i = 1; i < 10; i++) {
    const u = i / 10;
    d.line(xa + span * u, cable(u), xa + span * u, deckY + defl(u) + 0.01, { color: theme.muted, width: 1 });
  }
  // Excitação periódica (vórtices/rajadas) no meio do vão
  const F = forceOf(s, p), F0 = Math.max(1e-9, num(p, "F0", 1));
  d.arrowPx(xa + span / 2, deckY + defl(0.5) - 0.05, 0, F, (Math.abs(F) / F0) * 40, { color: theme.accent });
  d.text("excitação periódica", xa + span / 2 + 0.06, deckY - 0.2, { color: theme.accent, size: 10, align: "left" });
  d.text("modelo de 1 modo (ilustrativo)", -1.12, 0.98, { color: theme.muted, size: 10, align: "left" });
}

export const ressonancia = defineSim({
  id: "ressonancia",
  title: "Oscilador forçado e ressonância",
  course: "FG II",
  topic: "Oscilações",
  priority: "P1",
  summary:
    "Um oscilador amortecido empurrado por uma força senoidal. Varra a frequência e veja a curva de ressonância, o atraso de fase, o fator Q, o transiente com batimentos e uma ponte de amortecimento baixo.",
  equations: [
    String.raw`m\ddot x + b\dot x + kx = F_0\cos\omega t`,
    String.raw`x_p = A(\omega)\cos(\omega t - \delta) \qquad A(\omega) = \frac{F_0/m}{\sqrt{(\omega_0^2-\omega^2)^2 + (2\gamma\omega)^2}} \qquad \tan\delta = \frac{2\gamma\omega}{\omega_0^2-\omega^2}`,
    String.raw`Q = \frac{\omega_0}{2\gamma} = \frac{\omega_0}{\Delta\omega} \qquad \omega_r = \sqrt{\omega_0^2 - 2\gamma^2} \qquad \bar P = \tfrac12 F_0\,\omega A\sin\delta`,
    String.raw`x = x_p + x_h,\quad x_h \propto e^{-\gamma t}\cos(\omega_d t + \varphi) \;\Rightarrow\; \text{batimento com } |\omega - \omega_d|`,
  ],
  liveEquations(_s, p) {
    const w = num(p, "w", 4);
    return [
      String.raw`\omega/\omega_0 = ${texNum(w / omega0(p))} \qquad A = ${texNum(steadyAmplitude(p))}\ \text{m} \qquad \delta = ${texNum(phaseLag(p) / DEG)}^\circ \qquad Q = ${texNum(qualityFactor(p))}`,
      String.raw`\bar P = ${texNum(0.5 * num(p, "F0", 1) * w * steadyAmplitude(p) * Math.sin(phaseLag(p)))}\ \text{W} \qquad A_{\text{máx}} = ${texNum(peakAmplitude(p))}\ \text{m em } \omega_r = ${texNum(resonanceOmega(p))}\ \text{rad/s}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Massa-mola com força externa" },
        { value: 1, label: "Ponte (modelo ilustrativo)" },
      ],
    },
    { key: "m", label: "Massa", unit: "kg", min: 0.2, max: 5, step: 0.1, default: 1 },
    { key: "k", label: "Constante da mola k", unit: "N/m", min: 5, max: 200, step: 1, default: 25 },
    { key: "b", label: "Amortecimento b", unit: "N·s/m", min: 0.02, max: 20, step: 0.01, default: 0.5, live: true, log: true },
    { key: "F0", label: "Amplitude da força F₀", unit: "N", min: 0, max: 10, step: 0.1, default: 1, live: true },
    { key: "w", label: "Frequência da força ω", unit: "rad/s", min: 0.5, max: 15, step: 0.05, default: 4, live: true },
  ],

  observables: [
    { key: "x", label: "Posição x", unit: "m", value: (s) => s[X]! },
    { key: "v", label: "Velocidade v", unit: "m/s", value: (s) => s[V]! },
    { key: "F", label: "Força externa F", unit: "N", value: (s, p) => forceOf(s, p) },
    { key: "xp", label: "Solução de regime permanente x_p", unit: "m", value: (s, p) => steadyX(s, p) },
    { key: "xh", label: "Transiente x − x_p", unit: "m", value: (s, p) => s[X]! - steadyX(s, p) },
    { key: "A", label: "Amplitude de regime A(ω)", unit: "m", value: (_s, p) => steadyAmplitude(p) },
    { key: "delta", label: "Atraso de fase δ", unit: "°", value: (_s, p) => phaseLag(p) / DEG },
    { key: "Q", label: "Fator de qualidade Q", unit: "", value: (_s, p) => qualityFactor(p) },
    {
      key: "Pmed",
      label: "Potência média em regime",
      unit: "W",
      value: (_s, p) => 0.5 * num(p, "F0", 1) * num(p, "w", 4) * steadyAmplitude(p) * Math.sin(phaseLag(p)),
    },
    { key: "P", label: "Potência instantânea da força", unit: "W", value: (s, p) => forceOf(s, p) * s[V]! },
    { key: "Win", label: "Trabalho da força externa", unit: "J", value: (s) => s[WIN]! },
    { key: "Wd", label: "Energia dissipada", unit: "J", value: (s) => s[WD]! },
    {
      key: "bal",
      label: "E + E_dissipada − W_força",
      unit: "J",
      value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 + 0.5 * num(p, "k", 25) * s[X]! ** 2 + s[WD]! - s[WIN]!,
    },
  ],
  conserved: "bal",
  chart: { x: "t", y: "x" },

  scenarios: [
    {
      id: "varredura",
      label: "Varredura de frequência",
      params: { modo: 0, m: 1, k: 25, b: 0.5, F0: 1, w: 3 },
      guide: `### Curva de ressonância
1. Espere o transiente morrer e compare a amplitude do bloco com a marca na curva $A(\\omega)$.
2. Aumente $\\omega$ aos poucos até $\\omega_0 = 5$ rad/s. A amplitude cresce e o atraso de fase passa por $90^\\circ$.
3. Acima de $\\omega_0$ o bloco se move **contra** a força ($\\delta \\to 180^\\circ$).
4. A faixa marcada na curva tem largura $\\Delta\\omega = b/m$ (meia potência): confira que $Q = \\omega_0/\\Delta\\omega$.`,
      predict: [
        {
          question: "Exatamente em ω = ω₀, o deslocamento em relação à força está:",
          options: ["em fase (δ = 0)", "atrasado 90°", "em oposição (δ = 180°)"],
          answer: 1,
          explanation: "Em $\\omega = \\omega_0$, $\\tan\\delta \\to \\infty$: $\\delta = 90^\\circ$. A **velocidade** fica em fase com a força e a potência entregue é máxima.",
        },
      ],
    },
    {
      id: "batimento",
      label: "Batimentos perto da ressonância",
      params: { modo: 0, m: 1, k: 25, b: 0.05, F0: 1, w: 4.5 },
      guide: `### Transiente + regime
1. Partindo do repouso, $x = x_p + x_h$: a resposta forçada (frequência $\\omega$) soma-se à oscilação natural (frequência $\\omega_d \\approx \\omega_0$).
2. Com amortecimento pequeno o transiente demora a sumir e as duas frequências **batem**: a envoltória pulsa com período $2\\pi/|\\omega - \\omega_d| \\approx 12{,}6$ s.
3. Plote **Transiente x − x_p** e veja ele decair como $e^{-\\gamma t}$.
4. Aproxime $\\omega$ de 5 rad/s: o batimento fica mais lento e a amplitude cresce quase linearmente no começo.`,
      predict: [
        {
          question: "Com ω = 4,5 rad/s e ω₀ = 5 rad/s, de quanto em quanto tempo a amplitude volta a ser máxima no começo?",
          options: ["cerca de 1,3 s", "cerca de 12,6 s", "não há batimento"],
          answer: 1,
          explanation: "O batimento tem frequência angular $|\\omega - \\omega_d| \\approx 0{,}5$ rad/s, período $2\\pi/0{,}5 \\approx 12{,}6$ s.",
        },
      ],
    },
    {
      id: "ponte",
      label: "Ponte com amortecimento baixo",
      params: { modo: 1, m: 2, k: 50, b: 0.2, F0: 0.5, w: 5 },
      guide: `### Estruturas e ressonância
1. Uma estrutura esbelta tem modos de vibração com amortecimento muito baixo ($Q$ da ordem de 50 a 100). Aqui $Q = 50$.
2. Uma excitação periódica fraca, na frequência do modo, acumula energia ciclo a ciclo: a amplitude cresce até que a potência dissipada $b\\langle v^2\\rangle$ iguale a fornecida.
3. Mude $\\omega$ em 5%: a amplitude final despenca. Dobre $b$: o pico cai à metade.
4. **Cuidado com o mito:** a ponte de Tacoma Narrows (1940) não caiu por ressonância com rajadas periódicas. O colapso foi **flutter aeroelástico**, uma auto-excitação em que o próprio movimento torsional realimenta a força do vento (amortecimento efetivo negativo). Este modelo só ilustra por que o amortecimento baixo é perigoso.`,
    },
  ],

  exercises: [
    {
      id: "amplitude",
      prompt:
        "Um bloco de {m} kg preso a uma mola de {k} N/m, com b = {b} N·s/m, é forçado por F₀ = {F0} N com frequência angular {w} rad/s. Qual é a amplitude em regime permanente?",
      vary: { m: [0.5, 3, 1], k: [10, 100, 0], b: [0.2, 3, 1], F0: [0.5, 5, 1], w: [1, 12, 1] },
      answer: { label: "A", unit: "m", compute: (p) => steadyAmplitude(p) },
      hint: "A = (F₀/m)/√((ω₀² − ω²)² + (bω/m)²).",
    },
    {
      id: "largura",
      prompt:
        "Um oscilador de {m} kg com mola de {k} N/m tem b = {b} N·s/m. Qual é o fator de qualidade Q?",
      vary: { m: [0.5, 5, 1], k: [10, 200, 0], b: [0.05, 2, 2] },
      answer: { label: "Q", unit: "", compute: (p) => qualityFactor(p) },
      hint: "Q = ω₀/(2γ) = √(mk)/b.",
    },
  ],

  init: () => [0, 0, 0, 0, 0],
  derivatives,
  dt: 1e-3,
  sampleEvery: 10,
  tEnd: 120,

  viewport: () => ({ xMin: -1.15, xMax: 2.45, yMin: -1.05, yMax: 1.05, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t, trail } = frame;
    const Apk = Math.max(peakAmplitude(p), 1e-9);
    const A = steadyAmplitude(p);
    const w0 = omega0(p), w = num(p, "w", 4);
    const Tw = Math.max(8 * ((2 * Math.PI) / w0), 25);
    const tStart = Math.max(0, t - Tw);
    const dts = 1e-2;
    // Escala adaptativa: cabe o regime permanente (com folga para o batimento) e o que já aconteceu na janela
    let xmax = Math.max(1.6 * A, Math.abs(s[X]!), 1e-6);
    for (let i = Math.max(0, Math.floor(tStart / dts)); i < trail.length; i++) xmax = Math.max(xmax, Math.abs(trail[i]![X]!));
    const sx = 0.42 / xmax;
    const xd = Math.max(-0.6, Math.min(0.6, s[X]! * sx));
    if (Math.round(num(p, "modo")) === 1) drawBridge(d, s, p, xd);
    else drawSpringMass(d, s, p, xd);

    // ---- x(t) com ±A de regime ----
    const gx = (tt: number) => GR.x0 + ((tt - tStart) / Tw) * (GR.x1 - GR.x0);
    const gy = (x: number) => GR.yc + Math.max(-1.2, Math.min(1.2, x / xmax)) * GR.h;
    d.rect(GR.x0, GR.yc - GR.h * 1.25, GR.x1 - GR.x0, GR.h * 2.5, { stroke: theme.grid, width: 1 });
    d.line(GR.x0, GR.yc, GR.x1, GR.yc, { color: theme.muted, width: 1 });
    for (const sg of [1, -1]) d.line(GR.x0, gy(sg * A), GR.x1, gy(sg * A), { color: theme.series[2]!, dash: [5, 4], width: 1.2 });
    const pts: [number, number][] = [];
    for (let i = Math.max(0, Math.floor(tStart / dts)); i < trail.length; i++) pts.push([gx(i * dts), gy(trail[i]![X]!)]);
    pts.push([gx(t), gy(s[X]!)]);
    d.polyline(pts, { color: theme.series[1]!, width: 1.8 });
    d.text("x(t)", GR.x0 + 0.02, GR.yc + GR.h * 1.25 - 0.02, { color: theme.muted, size: 11, align: "left", baseline: "top" });
    d.text("±A(ω) de regime", GR.x1 - 0.02, GR.yc + GR.h * 1.25 - 0.02, { color: theme.series[2]!, size: 10, align: "right", baseline: "top" });
    d.text(`escala: ±${fmt(xmax)} m (pico possível: ${fmt(Apk)} m)`, GR.x0 + 0.02, GR.yc - GR.h * 1.25 + 0.02, { color: theme.muted, size: 10, align: "left", baseline: "bottom" });

    // ---- Curva de ressonância A(ω) ----
    const wMax = Math.max(2 * w0, 1.1 * w, 1);
    const rx = (ww: number) => RC.x0 + (ww / wMax) * (RC.x1 - RC.x0);
    const ry = (a: number) => RC.y0 + Math.min(1.05, a / (1.05 * Apk)) * (RC.y1 - RC.y0);
    d.arrow(RC.x0, RC.y0, RC.x1 - RC.x0 + 0.04, 0, { color: theme.muted, width: 1.2, head: 7 });
    d.arrow(RC.x0, RC.y0, 0, RC.y1 - RC.y0 + 0.06, { color: theme.muted, width: 1.2, head: 7 });
    d.text("A(ω)", RC.x0 + 0.03, RC.y1 + 0.06, { color: theme.text, size: 11, align: "left", weight: "600" });
    d.text("ω", RC.x1 + 0.05, RC.y0 - 0.04, { color: theme.muted, size: 11 });
    // Faixa de meia potência (A ≥ A_pico/√2)
    const g = gammaOf(p);
    if (g < 0.5 * w0) {
      const half = Apk / Math.SQRT2;
      // ω± da meia potência: (ω₀²−ω²)² = (2γω)²  ⇒  ω± = √(ω₀² + γ²) ± γ
      const wm = Math.sqrt(w0 * w0 + g * g) - g, wp = Math.sqrt(w0 * w0 + g * g) + g;
      d.rect(rx(wm), RC.y0, rx(wp) - rx(wm), ry(half) - RC.y0, { fill: theme.series[2]!, alpha: 0.15 });
      d.line(rx(wm), ry(half), rx(wp), ry(half), { color: theme.series[2]!, width: 1.5 });
      d.text("Δω", rx(wp) + 0.03, ry(half), { color: theme.series[2]!, size: 10, align: "left" });
    }
    d.line(rx(w0), RC.y0, rx(w0), RC.y1, { color: theme.grid, dash: [3, 4] });
    d.text("ω₀", rx(w0), RC.y0 - 0.05, { color: theme.muted, size: 10 });
    const aPts: [number, number][] = [];
    for (let i = 0; i <= 400; i++) {
      const ww = (wMax * i) / 400;
      aPts.push([rx(ww), ry(steadyAmplitude(p, ww))]);
    }
    d.polyline(aPts, { color: theme.series[1]!, width: 2 });
    d.dot(rx(w), ry(A), 6, theme.accent);
    d.line(rx(w), RC.y0, rx(w), ry(A), { color: theme.accent, width: 1, dash: [2, 3] });
    d.text(`Q = ${fmt(qualityFactor(p))}`, RC.x1, RC.y1, { color: theme.text, size: 11, align: "right" });

    // ---- Fase δ(ω) ----
    const fy = (dl: number) => PH.y0 + (dl / Math.PI) * (PH.y1 - PH.y0);
    d.arrow(PH.x0, PH.y0, PH.x1 - PH.x0 + 0.04, 0, { color: theme.muted, width: 1.2, head: 7 });
    d.arrow(PH.x0, PH.y0, 0, PH.y1 - PH.y0 + 0.06, { color: theme.muted, width: 1.2, head: 7 });
    d.text("δ(ω)", PH.x0 + 0.03, PH.y1 + 0.06, { color: theme.text, size: 11, align: "left", weight: "600" });
    for (const [dl, lab] of [[Math.PI / 2, "90°"], [Math.PI, "180°"]] as const) {
      d.line(PH.x0, fy(dl), PH.x1, fy(dl), { color: theme.grid, dash: [3, 4] });
      d.text(lab, PH.x0 - 0.02, fy(dl), { color: theme.muted, size: 10, align: "right" });
    }
    d.line(rx(w0), PH.y0, rx(w0), PH.y1, { color: theme.grid, dash: [3, 4] });
    d.text("ω₀", rx(w0), PH.y0 - 0.05, { color: theme.muted, size: 10 });
    const phPts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const ww = (wMax * i) / 300;
      phPts.push([rx(ww), fy(phaseLag(p, ww))]);
    }
    d.polyline(phPts, { color: theme.series[4]!, width: 2 });
    d.dot(rx(w), fy(phaseLag(p)), 6, theme.accent);
    d.text("• frequência atual", PH.x1, PH.y0 + 0.08, { color: theme.accent, size: 10, align: "right" });
  },
});

export default ressonancia;
