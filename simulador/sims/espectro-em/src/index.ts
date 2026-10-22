import {
  defaultCamera,
  EPS0,
  defineSim,
  draw,
  drawAxes3d,
  num,
  orbit,
  polyline3d,
  projector,
  renderFaces,
  surface,
  texNum,
  type Camera,
  type Draw,
  type Params,
  type Projector,
  type V3,
} from "@fisilab/core";
import {
  B0Of,
  BANDS,
  bandOf,
  C,
  capB,
  capDEdt,
  capEnergy,
  capField,
  capPowerIn,
  capSEdge,
  capVoltage,
  colorName,
  dipoleIntensity,
  dipolePower,
  E0Of,
  energyDensity,
  EXAMPLES,
  frequency,
  photonEnergyEV,
  photonFlux,
  poyntingInst,
  radiationPressure,
  tauRC,
  wavelengthRGB,
  type Cap,
} from "./model.ts";

export * from "./model.ts";

export interface EmState {
  cam: Camera;
  drag: null | { x0: number; y0: number; cam0: Camera };
}

export const ONDA = 0;
export const DIPOLO = 1;
export const CAPACITOR = 2;

/** Período visual da animação da onda (s de tela): a frequência real é altíssima. */
export const T_VIS = 1.6;

export const modo = (p: Params) => Math.round(num(p, "modo"));
export const lambdaOf = (p: Params) => 10 ** num(p, "logL", Math.log10(550e-9));
const I = (p: Params) => num(p, "I", 1000);
const reflect = (p: Params) => Math.round(num(p, "superficie")) === 1;
export const capOf = (p: Params): Cap => ({ a: num(p, "a", 10) / 100, d: num(p, "dd", 1) / 1000, V0: num(p, "V0", 500), R: num(p, "R", 10) * 1e9 });
const p0 = (p: Params) => 10 ** num(p, "logp", -29);
const phaseAt = (t: number) => (2 * Math.PI * t) / T_VIS;

/** Vetor de Poynting mostrado no gráfico, conforme o modo (W/m²). */
export function poyntingNow(p: Params, t: number): number {
  const m = modo(p);
  if (m === CAPACITOR) return capSEdge(capOf(p), t);
  if (m === DIPOLO) return 2 * dipoleIntensity(p0(p), lambdaOf(p), 1, Math.PI / 2) * Math.cos(phaseAt(t)) ** 2;
  return poyntingInst(I(p), -phaseAt(t));
}

// Régua do espectro (log λ)
const RULER = { x0: -9.5, x1: 9.5, y0: -7.3, y1: -6.3, lmin: -13, lmax: 3.5 };
const rx = (lambda: number) => RULER.x0 + ((Math.log10(lambda) - RULER.lmin) / (RULER.lmax - RULER.lmin)) * (RULER.x1 - RULER.x0);
const CENTER: [number, number] = [-2.2, 1.4];

const sup = (n: number) => String(n).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]!);
export function fmt(v: number, unit = ""): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return `0 ${unit}`.trim();
  const e = Math.floor(Math.log10(Math.abs(v)));
  const s = e >= -2 && e < 4 ? v.toPrecision(3).replace(".", ",") : `${(v / 10 ** e).toFixed(2).replace(".", ",")}×10${sup(e)}`;
  return `${s} ${unit}`.trim();
}

/** Comprimento de onda com prefixo adequado. */
export function fmtLambda(l: number): string {
  const units: [number, string][] = [[1e3, "km"], [1, "m"], [1e-2, "cm"], [1e-3, "mm"], [1e-6, "µm"], [1e-9, "nm"], [1e-12, "pm"]];
  for (const [f, u] of units) if (l >= f) return `${(l / f).toPrecision(3).replace(".", ",")} ${u}`;
  return fmt(l, "m");
}

function shifted(cam: Camera, ox: number, oy: number): Projector {
  const pr = projector(cam);
  return {
    basis: pr.basis,
    toViewer: pr.toViewer,
    project(p) {
      const q = pr.project(p);
      return [q[0] + ox, q[1] + oy, q[2]];
    },
  };
}

function arrow3(d: Draw, pr: Projector, from: V3, vec: V3, color: string, width = 2, head = 8) {
  const a = pr.project(from);
  const b = pr.project([from[0] + vec[0], from[1] + vec[1], from[2] + vec[2]]);
  d.arrow(a[0], a[1], b[0] - a[0], b[1] - a[1], { color, width, head });
}

function drawRuler(d: Draw, p: Params) {
  const th = d.theme;
  for (const b of BANDS) {
    const x0 = Math.max(RULER.x0, rx(b.lo)), x1 = Math.min(RULER.x1, rx(b.hi));
    if (x1 <= x0) continue;
    if (b.name === "Luz visível") {
      const n = 24;
      for (let i = 0; i < n; i++) {
        const nm = 380 + ((750 - 380) * (i + 0.5)) / n;
        const [r, g, bl] = wavelengthRGB(nm);
        const xa = rx(380e-9 * (750 / 380) ** (i / n)), xb = rx(380e-9 * (750 / 380) ** ((i + 1) / n));
        d.rect(xa, RULER.y0, xb - xa + 0.01, RULER.y1 - RULER.y0, { fill: `rgb(${r},${g},${bl})` });
      }
    } else d.rect(x0, RULER.y0, x1 - x0, RULER.y1 - RULER.y0, { fill: b.color, alpha: 0.35 });
    const label = b.name === "Luz visível" ? "visível" : b.name === "Ondas de rádio" ? "rádio" : b.name.replace("Raios ", "").replace("Ultravioleta", "UV").replace("Infravermelho", "IV");
    d.text(label, (x0 + x1) / 2, (RULER.y0 + RULER.y1) / 2, { color: th.text, size: 10, weight: "600" });
  }
  d.rect(RULER.x0, RULER.y0, RULER.x1 - RULER.x0, RULER.y1 - RULER.y0, { stroke: th.muted, width: 1 });
  for (let e = -12; e <= 3; e += 3) {
    const x = rx(10 ** e);
    d.line(x, RULER.y0, x, RULER.y0 - 0.15, { color: th.muted, width: 1 });
    d.text(`10${sup(e)} m`, x, RULER.y0 - 0.4, { color: th.muted, size: 9 });
  }
  EXAMPLES.forEach(([l, txt], i) => {
    const x = rx(l);
    const y = RULER.y1 + 0.3 + (i % 2) * 0.45;
    d.line(x, RULER.y1, x, y - 0.12, { color: th.muted, width: 0.8 });
    d.text(txt, x, y + 0.05, { color: th.muted, size: 9 });
  });
  const x = rx(lambdaOf(p));
  d.polyline([[x, RULER.y0 - 0.05], [x - 0.18, RULER.y0 - 0.35], [x + 0.18, RULER.y0 - 0.35]], { color: th.text, close: true, fill: th.text });
  d.line(x, RULER.y0, x, RULER.y1, { color: th.text, width: 2.5 });
}

function drawWave(d: Draw, pr: Projector, p: Params, t: number) {
  const th = d.theme;
  const L = 6;
  const k = (2 * Math.PI) / 6;
  const ph = phaseAt(t);
  const nm = lambdaOf(p) * 1e9;
  const vis = nm >= 380 && nm <= 750;
  const [r, g, b] = wavelengthRGB(nm);
  const eCol = vis ? `rgb(${r},${g},${b})` : th.series[0]!;
  const bCol = th.series[1]!;
  const sCol = th.series[2]!;
  drawAxes3d(d, pr, 2.9, th.muted, ["x (propagação)", "y", "z"]);
  polyline3d(d, pr, [[-L, 0, 0], [L, 0, 0]], { color: th.muted, width: 1 });
  const ePts: V3[] = [], bPts: V3[] = [];
  for (let i = 0; i <= 120; i++) {
    const x = -L + (2 * L * i) / 120;
    const c = Math.cos(k * x - ph);
    ePts.push([x, 0, 2.2 * c]);
    bPts.push([x, 2.2 * c, 0]);
  }
  polyline3d(d, pr, bPts, { color: bCol, width: 2 });
  polyline3d(d, pr, ePts, { color: eCol, width: 2.4 });
  for (let i = 0; i <= 24; i++) {
    const x = -L + (2 * L * i) / 24;
    const c = Math.cos(k * x - ph);
    if (Math.abs(c) > 0.08) {
      arrow3(d, pr, [x, 0, 0], [0, 0, 2.2 * c], eCol, 1.6, 6);
      arrow3(d, pr, [x, 0, 0], [0, 2.2 * c, 0], bCol, 1.3, 6);
    }
  }
  // S = E × B / μ₀ sempre ao longo de +x, pulsando com cos².
  for (let i = 0; i < 6; i++) {
    const x = -L + 1 + i * 2;
    const c = Math.cos(k * x - ph);
    arrow3(d, pr, [x, -3.2, -2.6], [0.4 + 1.3 * c * c, 0, 0], sCol, 2.2, 8);
  }
  const lab = (pt: V3, txt: string, col: string) => {
    const q = pr.project(pt);
    d.text(txt, q[0], q[1], { color: col, size: 14, weight: "700" });
  };
  lab([L + 0.3, 0, 2.5], "E", eCol);
  lab([L + 0.3, 2.6, 0], "B", bCol);
  lab([-L + 1, -3.2, -3.1], "S = E × B / μ₀", sCol);
  // Marca de um comprimento de onda
  const a = pr.project([-3, 0, -2.9]), bb = pr.project([3, 0, -2.9]);
  d.line(a[0], a[1], bb[0], bb[1], { color: th.muted, width: 1 });
  d.text(`λ = ${fmtLambda(lambdaOf(p))}`, (a[0] + bb[0]) / 2, (a[1] + bb[1]) / 2 - 0.35, { color: th.muted, size: 11 });
}

function drawDipole(d: Draw, p: Params, t: number) {
  const th = d.theme;
  const [cx, cy] = CENTER;
  const W = 7.2, Hh = 5.3;
  const k = (2 * Math.PI) / 2.4;
  const ph = phaseAt(t);
  const n = 64, m = 46;
  const dx = (2 * W) / n, dy = (2 * Hh) / m;
  for (let i = 0; i < n; i++)
    for (let j = 0; j < m; j++) {
      const x = -W + (i + 0.5) * dx, y = -Hh + (j + 0.5) * dy;
      const r = Math.hypot(x, y);
      if (r < 0.5) continue;
      const sinT = Math.abs(x) / r;
      const v = (sinT * Math.cos(k * r - ph)) / Math.sqrt(r);
      if (Math.abs(v) < 0.04) continue;
      d.rect(cx + x - dx / 2, cy + y - dy / 2, dx, dy, { fill: v > 0 ? th.positive : th.negative, alpha: Math.min(0.55, Math.abs(v) * 0.6) });
    }
  // Diagrama de radiação sen²θ
  const pts: [number, number][] = [];
  for (let i = 0; i <= 160; i++) {
    const a = (2 * Math.PI * i) / 160;
    const R = 2.6 * Math.sin(a) ** 2;
    pts.push([cx + R * Math.sin(a), cy + R * Math.cos(a)]);
  }
  d.polyline(pts, { color: th.text, width: 1.8 });
  // Antena com cargas oscilantes
  const q = Math.cos(ph);
  d.line(cx, cy - 0.6, cx, cy + 0.6, { color: th.text, width: 3 });
  d.text(q > 0 ? "+" : "−", cx + 0.3, cy + 0.6, { color: q > 0 ? th.positive : th.negative, size: 14, weight: "700" });
  d.text(q > 0 ? "−" : "+", cx + 0.3, cy - 0.6, { color: q > 0 ? th.negative : th.positive, size: 14, weight: "700" });
  d.text("dipolo p(t) = p₀ cos ωt (vertical)", cx, cy + Hh + 0.35, { color: th.text, size: 12, weight: "600" });
  d.text("cores: E_θ ∝ sen θ cos(kr − ωt)/r   •   contorno: intensidade ∝ sen²θ", cx, cy - Hh - 0.25, { color: th.muted, size: 11 });
}

function drawCapacitor(d: Draw, pr: Projector, p: Params, t: number) {
  const th = d.theme;
  const cap = capOf(p);
  const A = 3, Z = 1;
  const tau = tauRC(cap);
  const Efrac = capVoltage(cap, t) / cap.V0;
  const rate = Math.exp(-t / tau); // ∝ dE/dt
  drawAxes3d(d, pr, 4.4, th.grid, ["x", "y", "z"]);
  // Fios e corrente
  polyline3d(d, pr, [[0, 0, Z], [0, 0, 3.8]], { color: th.muted, width: 3 });
  polyline3d(d, pr, [[0, 0, -Z], [0, 0, -3.8]], { color: th.muted, width: 3 });
  if (rate > 0.02) {
    arrow3(d, pr, [0, 0, 3.4], [0, 0, -0.9], th.series[4]!, 2.5, 9);
    arrow3(d, pr, [0, 0, -2.5], [0, 0, -0.9], th.series[4]!, 2.5, 9);
    const q = pr.project([0.3, 0, 3.2]);
    d.text("I", q[0] + 0.25, q[1], { color: th.series[4], size: 13, weight: "700" });
  }
  // Placas
  const plate = (z: number, col: string) => surface((r, a) => [r * Math.cos(a), r * Math.sin(a), z], [0, A], [0, 2 * Math.PI], 2, 28, () => col, 0.55);
  renderFaces(d, pr, [...plate(Z, th.dark ? "#d9453b" : "#e06a60"), ...plate(-Z, th.dark ? "#2f6fd9" : "#5b8ee6")]);
  // Campo E entre as placas
  for (const r of [0, 1.2, 2.4])
    for (let i = 0; i < (r === 0 ? 1 : 6); i++) {
      const a = (2 * Math.PI * i) / 6 + r;
      const base: V3 = [r * Math.cos(a), r * Math.sin(a), Z - 0.1];
      if (Efrac > 0.02) arrow3(d, pr, base, [0, 0, -1.8 * Efrac], th.series[0]!, 1.6, 7);
    }
  // Campo B (circular, ∝ r dE/dt) e S (radial para dentro na borda)
  if (rate > 0.01) {
    for (const r of [1.5, A]) {
      const loop: V3[] = [];
      for (let i = 0; i <= 48; i++) loop.push([r * Math.cos((2 * Math.PI * i) / 48), r * Math.sin((2 * Math.PI * i) / 48), 0]);
      polyline3d(d, pr, loop, { color: th.series[1]!, width: 1 + 2 * rate * (r / A) });
      for (let i = 0; i < 4; i++) {
        const a = (2 * Math.PI * i) / 4 + 0.4;
        // dE/dt aponta em −z (placa + em cima): B gira no sentido horário visto de cima.
        arrow3(d, pr, [r * Math.cos(a), r * Math.sin(a), 0], [0.55 * Math.sin(a) * rate, -0.55 * Math.cos(a) * rate, 0], th.series[1]!, 1.6, 7);
      }
    }
    const sLen = 1.6 * Efrac * rate * 4;
    for (let i = 0; i < 8; i++) {
      const a = (2 * Math.PI * i) / 8;
      const R0 = A + 0.2 + sLen;
      if (sLen > 0.05) arrow3(d, pr, [R0 * Math.cos(a), R0 * Math.sin(a), 0.5], [-sLen * Math.cos(a), -sLen * Math.sin(a), 0], th.series[2]!, 2.6, 9);
    }
  }
  const lab = (pt: V3, txt: string, col: string) => {
    const q = pr.project(pt);
    d.text(txt, q[0], q[1], { color: col, size: 13, weight: "700" });
  };
  lab([0, A + 1.2, Z + 0.4], "S (entra pela borda)", th.series[2]!);
  lab([A + 0.4, 0, -0.4], "B", th.series[1]!);
  lab([0.4, 0.4, 0.2], "E", th.series[0]!);
}

export const espectroEm = defineSim<EmState>({
  id: "espectro-em",
  title: "Espectro eletromagnético e vetor de Poynting",
  course: "FG III",
  topic: "Ondas EM",
  priority: "P2",
  summary:
    "Uma onda plana em 3D com E ⊥ B ⊥ propagação, o vetor de Poynting, a intensidade e a pressão de radiação; uma régua do espectro de raios gama a ondas de rádio com frequência, energia do fóton e exemplos; o dipolo que irradia e a energia entrando pela borda de um capacitor que carrega.",
  equations: [
    String.raw`c = \lambda f,\qquad E_{\text{fóton}} = hf = \frac{hc}{\lambda},\qquad \frac{E}{B} = c`,
    String.raw`\vec S = \frac{1}{\mu_0}\vec E\times\vec B,\qquad I = \langle S\rangle = \tfrac12 c\,\varepsilon_0 E_0^2,\qquad u = \frac{I}{c}`,
    String.raw`p_{\text{rad}} = \frac{I}{c}\ \text{(absorve)} \qquad p_{\text{rad}} = \frac{2I}{c}\ \text{(reflete)}`,
    String.raw`\text{dipolo: } \langle P\rangle = \frac{p_0^2\,\omega^4}{12\pi\varepsilon_0 c^3},\quad I(\theta) \propto \frac{\operatorname{sen}^2\theta}{r^2}`,
    String.raw`\text{capacitor: } \oint \vec S\cdot d\vec A = \frac{E B}{\mu_0}\,2\pi a d = \frac{d}{dt}\Big(\tfrac12\varepsilon_0 E^2\,\pi a^2 d\Big)`,
  ],
  liveEquations(_s, p, t) {
    const m = modo(p);
    const l = lambdaOf(p);
    if (m === CAPACITOR) {
      const c = capOf(p);
      return [
        String.raw`V = ${texNum(capVoltage(c, t))}\ \text{V},\quad E = ${texNum(capField(c, t))}\ \text{V/m},\quad B(a) = ${texNum(capB(c, t, c.a))}\ \text{T}`,
        String.raw`S(a)\cdot 2\pi a d = ${texNum(capPowerIn(c, t))}\ \text{W} \qquad \frac{dU}{dt} = \varepsilon_0 E\frac{dE}{dt}\pi a^2 d = ${texNum(EPS0 * capField(c, t) * capDEdt(c, t) * Math.PI * c.a * c.a * c.d)}\ \text{W}`,
      ];
    }
    const out = [
      String.raw`\lambda = ${texNum(l)}\ \text{m},\quad f = ${texNum(frequency(l))}\ \text{Hz},\quad E_{\text{fóton}} = ${texNum(photonEnergyEV(l))}\ \text{eV}`,
    ];
    if (m === DIPOLO) out.push(String.raw`\langle P\rangle = \frac{(${texNum(p0(p))})^2 (${texNum((2 * Math.PI * C) / l)})^4}{12\pi\varepsilon_0 c^3} = ${texNum(dipolePower(p0(p), l))}\ \text{W}`);
    else
      out.push(
        String.raw`E_0 = \sqrt{\frac{2I}{c\varepsilon_0}} = ${texNum(E0Of(I(p)))}\ \text{V/m},\quad B_0 = ${texNum(B0Of(I(p)))}\ \text{T},\quad p_{\text{rad}} = ${texNum(radiationPressure(I(p), reflect(p)))}\ \text{Pa}`,
      );
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Cena",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: ONDA,
      options: [
        { value: ONDA, label: "Onda plana em 3D" },
        { value: DIPOLO, label: "Dipolo oscilante (irradiação)" },
        { value: CAPACITOR, label: "Capacitor carregando (fluxo de energia)" },
      ],
    },
    { key: "logL", label: "log₁₀ do comprimento de onda (m)", unit: "", min: -13, max: 3, step: 0.01, default: -6.26, live: true },
    { key: "I", label: "Intensidade I", unit: "W/m²", min: 0.001, max: 1e10, step: 0.001, default: 1000, log: true, live: true },
    {
      key: "superficie",
      label: "Superfície iluminada",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Absorve tudo (preta)" },
        { value: 1, label: "Reflete tudo (espelho)" },
      ],
    },
    { key: "logp", label: "log₁₀ do momento de dipolo p₀ (C·m)", unit: "", min: -32, max: -20, step: 0.1, default: -29, live: true },
    { key: "a", label: "Raio das placas", unit: "cm", min: 2, max: 20, step: 0.5, default: 10 },
    { key: "dd", label: "Separação das placas", unit: "mm", min: 0.5, max: 5, step: 0.1, default: 1 },
    { key: "V0", label: "Tensão da fonte", unit: "V", min: 10, max: 1000, step: 10, default: 500 },
    { key: "R", label: "Resistência em série", unit: "GΩ", min: 1, max: 30, step: 0.5, default: 10 },
  ],

  observables: [
    { key: "S", label: "Vetor de Poynting |S| (instantâneo)", unit: "W/m²", value: (_s, p, t) => poyntingNow(p, t) },
    { key: "lambda", label: "Comprimento de onda λ", unit: "m", value: (_s, p) => lambdaOf(p) },
    { key: "f", label: "Frequência f", unit: "Hz", value: (_s, p) => frequency(lambdaOf(p)) },
    { key: "Ef", label: "Energia do fóton", unit: "eV", value: (_s, p) => photonEnergyEV(lambdaOf(p)) },
    { key: "E0", label: "Amplitude E₀", unit: "V/m", value: (_s, p) => E0Of(I(p)) },
    { key: "B0", label: "Amplitude B₀", unit: "T", value: (_s, p) => B0Of(I(p)) },
    { key: "u", label: "Densidade média de energia", unit: "J/m³", value: (_s, p) => energyDensity(I(p)) },
    { key: "prad", label: "Pressão de radiação", unit: "Pa", value: (_s, p) => radiationPressure(I(p), reflect(p)) },
    { key: "fotons", label: "Fluxo de fótons", unit: "1/(m²·s)", value: (_s, p) => photonFlux(I(p), lambdaOf(p)) },
    { key: "Pdip", label: "Potência do dipolo", unit: "W", value: (_s, p) => dipolePower(p0(p), lambdaOf(p)) },
    { key: "Vc", label: "Tensão no capacitor", unit: "V", value: (_s, p, t) => capVoltage(capOf(p), t) },
    { key: "Pin", label: "Potência entrando pela borda", unit: "W", value: (_s, p, t) => capPowerIn(capOf(p), t) },
    { key: "U", label: "Energia no capacitor", unit: "J", value: (_s, p, t) => capEnergy(capOf(p), t) },
  ],
  chart: { x: "t", y: "S" },

  scenarios: [
    {
      id: "onda",
      label: "Luz do Sol",
      params: { modo: ONDA, logL: -6.26, I: 1361, superficie: 0 },
      guide: `### Uma onda que carrega energia
1. Arraste o fundo para girar a cena: $\\vec E$, $\\vec B$ e a direção de propagação são perpendiculares entre si.
2. $\\vec S = \\vec E\\times\\vec B/\\mu_0$ aponta sempre no sentido de propagação e pulsa como $\\cos^2$; sua média é $I$.
3. Com a intensidade da luz solar no espaço ($I = 1361$ W/m²), leia $E_0$, $B_0$ e a pressão de radiação.
4. Troque para **espelho**: a pressão dobra. É assim que funcionam as velas solares.`,
      predict: [
        {
          question: "Para a luz solar (I ≈ 1,4 kW/m²) num espelho, a pressão de radiação é da ordem de…",
          options: ["10⁻⁵ Pa", "1 Pa", "10³ Pa", "10⁵ Pa (1 atm)"],
          answer: 0,
          explanation: "p = 2I/c = 2 × 1361/(3 × 10⁸) ≈ 9 × 10⁻⁶ Pa: minúscula, mas age continuamente sobre velas solares de centenas de m².",
        },
      ],
    },
    {
      id: "espectro",
      label: "Passeio pelo espectro",
      params: { modo: ONDA, logL: 0.48, I: 1 },
      guide: `### Do rádio aos raios gama
1. Comece em $\\lambda = 3$ m (rádio FM, $f = 100$ MHz) e diminua $\\log_{10}\\lambda$ aos poucos.
2. Acompanhe a energia do fóton: em que faixa ela passa de 1 eV? E de 10 eV (energia que ioniza átomos)?
3. Compare o número de fótons por segundo para a mesma intensidade no rádio e no raio X.
4. Por que o ultravioleta queima a pele e o rádio FM não, mesmo com a mesma intensidade?`,
      predict: [
        {
          question: "Para a mesma intensidade I, qual feixe tem mais fótons por segundo?",
          options: ["Raios X", "Luz visível", "Ondas de rádio", "Todos têm o mesmo número"],
          answer: 2,
          explanation: "N = I/(hf): com f pequena, cada fóton carrega pouca energia, então são necessários muitos mais fótons para a mesma potência.",
        },
      ],
    },
    {
      id: "dipolo",
      label: "Antena dipolo",
      params: { modo: DIPOLO, logL: 0, logp: -9 },
      guide: `### Quem produz a onda?
1. Cargas que oscilam numa antena produzem campos que se propagam para fora com velocidade $c$.
2. O contorno mostra $I \\propto \\operatorname{sen}^2\\theta$: nada é irradiado ao longo do eixo da antena.
3. Diminua $\\lambda$ pela metade: a potência $\\propto \\omega^4$ aumenta 16 vezes. (É por isso que o céu é azul!)`,
    },
    {
      id: "capacitor",
      label: "Energia entra pela borda",
      params: { modo: CAPACITOR, a: 10, dd: 1, V0: 500, R: 10 },
      guide: `### Por onde a energia entra no capacitor?
1. Rode: a corrente carrega as placas e $E$ cresce entre elas.
2. A corrente de deslocamento $\\varepsilon_0\\, d\\Phi_E/dt$ cria um $\\vec B$ circular ($\\propto r$).
3. $\\vec S = \\vec E\\times\\vec B/\\mu_0$ aponta **para dentro**, pela borda lateral, e não pelos fios!
4. Ponha no gráfico "Potência entrando pela borda" e compare com $dU/dt$ nas equações: são iguais em todo instante.`,
      predict: [
        {
          question: "Enquanto o capacitor carrega, a energia do campo entre as placas entra…",
          options: ["Pelos fios, junto com os elétrons", "Pela borda lateral, vinda do espaço em volta", "Através das placas metálicas", "Não entra: ela é criada ali"],
          answer: 1,
          explanation: "O vetor de Poynting E × B/μ₀ na borda aponta radialmente para dentro, e seu fluxo pela superfície lateral é exatamente dU/dt.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "foton",
      prompt: "Qual a energia, em eV, de um fóton de comprimento de onda {nm} nm? Use h = 6,626 × 10⁻³⁴ J·s, c = 3,00 × 10⁸ m/s e 1 eV = 1,602 × 10⁻¹⁹ J.",
      vary: { nm: [100, 1200, 0] },
      answer: { label: "E", unit: "eV", compute: (p) => photonEnergyEV(num(p, "nm") * 1e-9) },
      hint: "E = hc/λ ≈ 1240 eV·nm / λ.",
    },
    {
      id: "pressao",
      prompt: "Um laser de {P} W é focalizado num espelho perfeito, numa área de {A} mm². Qual a pressão de radiação, em Pa?",
      vary: { P: [1, 50, 1], A: [0.5, 10, 1] },
      answer: { label: "p_rad", unit: "Pa", compute: (p) => radiationPressure(num(p, "P") / (num(p, "A") * 1e-6), true) },
      hint: "I = P/A; num espelho p = 2I/c.",
    },
  ],

  init: () => ({ cam: { ...defaultCamera(), yaw: (-58 * Math.PI) / 180, pitch: (18 * Math.PI) / 180 }, drag: null }),
  step: (s) => s,
  dt: 0.02,
  sampleEvery: 3,

  pointer: {
    down(s, _p, pt) {
      if (pt.y < RULER.y1 + 1.2) return undefined;
      return { ...s, drag: { x0: pt.x, y0: pt.y, cam0: s.cam } };
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag || modo(p) === DIPOLO) return undefined;
      // ~40 px por unidade do mundo: converte o arrasto para pixels aproximados.
      return { ...s, cam: orbit(s.drag.cam0, (pt.x - s.drag.x0) * 40, -(pt.y - s.drag.y0) * 40) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p, pt) => (modo(p) !== DIPOLO && pt.y > RULER.y1 + 1.2 ? "move" : undefined),
  },

  actions: [{ id: "vista", label: "Restaurar a vista", run: (s) => ({ ...s, cam: { ...defaultCamera(), yaw: (-58 * Math.PI) / 180, pitch: (18 * Math.PI) / 180 } }) }],

  viewport: () => ({ xMin: -10, xMax: 10, yMin: -8, yMax: 7.5 }),

  render(ctx, frame) {
    const { state: s, params: p, t, theme } = frame;
    const d = draw(ctx, frame);
    const m = modo(p);
    if (m === DIPOLO) drawDipole(d, p, t);
    else {
      const pr = shifted({ ...s.cam, zoom: m === CAPACITOR ? 0.95 : 0.78 }, CENTER[0], CENTER[1]);
      if (m === ONDA) drawWave(d, pr, p, t);
      else drawCapacitor(d, pr, p, t);
    }

    // Painel de valores
    const px = 5.3;
    let py = 6.8;
    const line = (txt: string, col = theme.text, w = "400") => {
      d.text(txt, px, py, { color: col, size: 12, align: "left", weight: w });
      py -= 0.62;
    };
    const l = lambdaOf(p);
    if (m === CAPACITOR) {
      const c = capOf(p);
      line("Capacitor carregando", theme.text, "700");
      line(`τ = RC = ${fmt(tauRC(c), "s")}`);
      line(`V = ${fmt(capVoltage(c, t), "V")}`);
      line(`E = ${fmt(capField(c, t), "V/m")}`);
      line(`B(a) = ${fmt(capB(c, t, c.a), "T")}`);
      line(`S(a) = ${fmt(capSEdge(c, t), "W/m²")}`);
      line(`P entrando = ${fmt(capPowerIn(c, t), "W")}`, theme.series[2]);
      line(`U = ${fmt(capEnergy(c, t), "J")}`);
    } else {
      const band = bandOf(l);
      const nm = l * 1e9;
      line(band.name + (band.name === "Luz visível" ? ` (${colorName(nm)})` : ""), theme.text, "700");
      line(`λ = ${fmtLambda(l)}`);
      line(`f = ${fmt(frequency(l), "Hz")}`);
      line(`E fóton = ${fmt(photonEnergyEV(l), "eV")}`);
      if (m === ONDA) {
        line(`I = ${fmt(I(p), "W/m²")}`);
        line(`E₀ = ${fmt(E0Of(I(p)), "V/m")}`);
        line(`B₀ = ${fmt(B0Of(I(p)), "T")}`);
        line(`u = ${fmt(energyDensity(I(p)), "J/m³")}`);
        line(`p_rad = ${fmt(radiationPressure(I(p), reflect(p)), "Pa")}`);
        line(`fótons: ${fmt(photonFlux(I(p), l), "/(m²·s)")}`);
        line(`S(x = 0) = ${fmt(poyntingNow(p, t), "W/m²")}`, theme.series[2]);
      } else {
        line(`p₀ = ${fmt(p0(p), "C·m")}`);
        line(`P irradiada = ${fmt(dipolePower(p0(p), l), "W")}`);
      }
    }
    if (m !== DIPOLO) d.text("arraste o fundo para girar", px, -4.6, { color: theme.muted, size: 11, align: "left" });
    drawRuler(d, p);
  },
});

export default espectroEm;
