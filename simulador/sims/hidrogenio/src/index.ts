import {
  clamp,
  defineSim,
  draw,
  drawAxes3d,
  num,
  projector,
  rad,
  renderFaces,
  surface,
  texNum,
  type Draw,
  type Params,
  type V3,
} from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  RY,
  angular,
  energyEV,
  meanR,
  mostProbableR,
  nodes,
  orbitalName,
  psi,
  quantum,
  radialP,
  radialR,
  radiusContaining,
  sampleCloud,
  subshell,
  transitionNm,
  type Cloud,
} from "./physics.ts";

export * from "./physics.ts";

export interface HState {
  yaw: number;
  pitch: number;
  /** Semente da amostragem da nuvem (botão "Nova amostra"). */
  seed: number;
  drag: { x0: number; y0: number; yaw0: number; pitch0: number } | null;
}

/** Centro e meia-largura da região 3D no palco. */
const CX = -8;
const CY = -0.4;
const HALF = 7.6;
const VIEW = { xMin: -17, xMax: 17, yMin: -9.5, yMax: 9.5 };

export const qn = (p: Params) => quantum(num(p, "n", 2), num(p, "l", 1), num(p, "m", 0));
const isReal = (p: Params) => num(p, "tipo") >= 0.5;
const viewMode = (p: Params) => Math.round(num(p, "vista"));

const cache = new Map<string, Cloud>();
export function cloudFor(p: Params, seed: number): Cloud {
  const { n, l, m } = qn(p);
  const count = Math.round(clamp(num(p, "pontos", 3000), 200, 10000));
  const key = `${n},${l},${m},${isReal(p)},${count},${seed}`;
  let c = cache.get(key);
  if (!c) {
    c = sampleCloud(n, l, m, isReal(p), count, seed);
    if (cache.size > 8) cache.delete(cache.keys().next().value!);
    cache.set(key, c);
  }
  return c;
}

const metrics = new Map<string, { rmp: number; r95: number; r995: number }>();
export function radii(n: number, l: number) {
  const key = `${n},${l}`;
  let v = metrics.get(key);
  if (!v) {
    v = { rmp: mostProbableR(n, l), r95: radiusContaining(n, l, 0.95), r995: radiusContaining(n, l, 0.995) };
    metrics.set(key, v);
  }
  return v;
}

/** Cor (#rrggbb) de um matiz, para a fase. */
export function hueHex(h: number, light = 0.52): string {
  const s = 0.78;
  const a = s * Math.min(light, 1 - light);
  const f = (k: number) => {
    const kk = (k + h / 30) % 12;
    const c = light - a * Math.max(-1, Math.min(kk - 3, 9 - kk, 1));
    return Math.round(255 * c)
      .toString(16)
      .padStart(2, "0");
  };
  return `#${f(0)}${f(8)}${f(4)}`;
}
const phaseHue = (ph: number) => ((((ph * 180) / Math.PI) % 360) + 360) % 360;

/** Fase global e^{-iEt/ħ}, desacelerada para caber na tela (1 volta a cada ~2 s no estado 1s). */
const phaseShift = (p: Params, t: number) => (num(p, "fase") >= 0.5 ? (-energyEV(qn(p).n) / RY) * Math.PI * t : 0);

function signColors(d: Draw) {
  return { pos: d.theme.positive, neg: d.theme.negative };
}

function drawCloud(d: Draw, s: HState, p: Params, t: number) {
  const { n, l } = qn(p);
  const real = isReal(p);
  const k = HALF / radii(n, l).r95;
  const pr = projector({ yaw: s.yaw, pitch: s.pitch, zoom: k });
  const cl = cloudFor(p, s.seed);
  const ctx = d.ctx;
  const { pos, neg } = signColors(d);
  const shift = phaseShift(p, t);
  const proj = new Float64Array(cl.count * 3);
  let dmin = Infinity;
  let dmax = -Infinity;
  for (let i = 0; i < cl.count; i++) {
    const q = pr.project([cl.pts[4 * i]!, cl.pts[4 * i + 1]!, cl.pts[4 * i + 2]!]);
    proj[3 * i] = q[0];
    proj[3 * i + 1] = q[1];
    proj[3 * i + 2] = q[2];
    dmin = Math.min(dmin, q[2]);
    dmax = Math.max(dmax, q[2]);
  }
  const order = Array.from({ length: cl.count }, (_, i) => i).sort((a, b) => proj[3 * a + 2]! - proj[3 * b + 2]!);
  const size = 2.3 * d.px;
  const span = Math.max(dmax - dmin, 1e-9);
  for (const i of order) {
    const v = cl.pts[4 * i + 3]!;
    ctx.globalAlpha = 0.28 + 0.6 * ((proj[3 * i + 2]! - dmin) / span);
    ctx.fillStyle = real ? (v > 0 ? pos : neg) : hueHex(phaseHue(v + shift));
    ctx.fillRect(proj[3 * i]! - size / 2, proj[3 * i + 1]! - size / 2, size, size);
  }
  ctx.globalAlpha = 1;
  drawAxes3d(d, pr, (HALF * 0.95) / k, d.theme.muted);
}

function drawAngular(d: Draw, s: HState, p: Params, t: number) {
  const { l, m } = qn(p);
  const real = isReal(p);
  let ymax = 0;
  for (let i = 0; i <= 60; i++)
    for (let j = 0; j < 60; j++) {
      const [a, b] = angular(l, m, real, (Math.PI * i) / 60, (2 * Math.PI * j) / 60);
      ymax = Math.max(ymax, Math.hypot(a, b));
    }
  const S = (HALF * 0.85) / ymax;
  const pr = projector({ yaw: s.yaw, pitch: s.pitch, zoom: 1 });
  const { pos, neg } = signColors(d);
  const shift = phaseShift(p, t);
  const faces = surface(
    (th, ph) => {
      const [a, b] = angular(l, m, real, th, ph);
      const r = S * Math.hypot(a, b);
      return [r * Math.sin(th) * Math.cos(ph), r * Math.sin(th) * Math.sin(ph), r * Math.cos(th)] as V3;
    },
    [0, Math.PI],
    [0, 2 * Math.PI],
    30,
    56,
    (th, ph) => {
      const [a, b] = angular(l, m, real, th, ph);
      return real ? (a >= 0 ? pos : neg) : hueHex(phaseHue(Math.atan2(b, a) + shift));
    },
    0.92,
  );
  drawAxes3d(d, pr, HALF, d.theme.muted);
  renderFaces(d, pr, faces.filter((f) => f.pts.some((q) => Math.hypot(...q) > 1e-6)), { ambient: 0.5 });
}

function drawCut(d: Draw, p: Params, t: number) {
  const { n, l, m } = qn(p);
  const real = isReal(p);
  const R = radii(n, l).r95;
  const k = HALF / R;
  const N = 84;
  const h = (2 * R) / N;
  const vals: { re: number; im: number }[] = [];
  let max = 0;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const x = -R + (i + 0.5) * h;
      const z = -R + (j + 0.5) * h;
      const [re, im] = psi(n, l, m, real, x, 0, z);
      vals.push({ re, im });
      max = Math.max(max, re * re + im * im);
    }
  const { pos, neg } = signColors(d);
  const shift = phaseShift(p, t);
  const ctx = d.ctx;
  const w = h * k;
  for (let i = 0; i < N; i++)
    for (let j = 0; j < N; j++) {
      const v = vals[i * N + j]!;
      const dens = (v.re * v.re + v.im * v.im) / Math.max(max, 1e-300);
      if (dens < 2e-4) continue;
      ctx.globalAlpha = Math.min(1, Math.sqrt(dens) * 1.1);
      ctx.fillStyle = real ? (v.re >= 0 ? pos : neg) : hueHex(phaseHue(Math.atan2(v.im, v.re) + shift));
      ctx.fillRect(-HALF + i * w, -HALF + j * w, w * 1.02, w * 1.02);
    }
  ctx.globalAlpha = 1;
  d.line(-HALF, 0, HALF, 0, { color: d.theme.muted, width: 1, alpha: 0.6 });
  d.line(0, -HALF, 0, HALF, { color: d.theme.muted, width: 1, alpha: 0.6 });
  d.text("x", HALF - 0.2, 0, { color: d.theme.muted, dy: -9 });
  d.text("z", 0, HALF - 0.2, { color: d.theme.muted, dx: 9 });
  // nós radiais: zeros de R(r)
  const zeros = radialZeros(n, l);
  for (const r0 of zeros) {
    if (r0 > R) continue;
    d.circle(0, 0, r0 * k, { stroke: d.theme.text, width: 1, dash: [4, 4], alpha: 0.7 });
  }
  if (zeros.length) d.text("nó radial", zeros[0]! * k * 0.71, zeros[0]! * k * 0.71, { color: d.theme.text, size: 11, dx: 30, dy: -4 });
  // escala
  const bar = niceLen(R / 3);
  d.line(-HALF + 0.3, -HALF + 0.4, -HALF + 0.3 + bar * k, -HALF + 0.4, { color: d.theme.text, width: 2 });
  d.text(`${fmt(bar)} a₀`, -HALF + 0.3 + (bar * k) / 2, -HALF + 0.4, { color: d.theme.text, size: 11, dy: -9 });
}

const niceLen = (v: number) => {
  const mag = 10 ** Math.floor(Math.log10(v));
  return [1, 2, 5, 10].map((q) => q * mag).find((q) => q >= v * 0.7) ?? mag;
};

/** Zeros de R_nl(r) (nós radiais), por mudança de sinal e bissecção. */
export function radialZeros(n: number, l: number): number[] {
  const out: number[] = [];
  const Rm = n * (2.2 * n + 12);
  const N = 3000;
  let prev = radialR(n, l, 1e-6);
  for (let i = 1; i <= N; i++) {
    const r = (Rm * i) / N;
    const v = radialR(n, l, r);
    if (prev * v < 0) {
      let a = (Rm * (i - 1)) / N;
      let b = r;
      for (let k = 0; k < 50; k++) {
        const c = (a + b) / 2;
        if (radialR(n, l, a) * radialR(n, l, c) <= 0) b = c;
        else a = c;
      }
      out.push((a + b) / 2);
    }
    if (Math.abs(v) > 1e-14) prev = v;
  }
  return out;
}

function drawRadialPanel(d: Draw, p: Params) {
  const { n, l } = qn(p);
  const { rmp, r995 } = radii(n, l);
  const rm = meanR(n, l);
  const box = { x0: 3.6, y0: 1.4, x1: 16.4, y1: 7.9 };
  let pmax = 0;
  let Rmax = 0;
  for (let i = 1; i <= 300; i++) {
    const r = (r995 * i) / 300;
    pmax = Math.max(pmax, radialP(n, l, r));
    if (r > 0.3) Rmax = Math.max(Rmax, Math.abs(radialR(n, l, r)));
  }
  const pnl = panel(d, box, { min: 0, max: r995 }, { min: -0.55 * pmax, max: 1.15 * pmax });
  const th = d.theme;
  pnl.frame({ xlabel: "r (a₀)", fy: () => "", yticks: [0] });
  const Rs = (0.5 * pmax) / Math.max(Rmax, 1e-12);
  pnl.plot((r) => radialR(n, l, r) * Rs, 0.3 * (l === 0 ? 0 : 1), r995, { color: th.muted, width: 1.4, dash: [5, 4] });
  const pts: [number, number][] = [[0, 0]];
  for (let i = 0; i <= 240; i++) {
    const r = (r995 * i) / 240;
    pts.push([r, radialP(n, l, r)]);
  }
  pts.push([r995, 0]);
  pnl.clip(() => d.polyline(pts.map(([x, y]) => [pnl.X(x), pnl.Y(y)]), { color: th.accent, width: 2, fill: th.accent + "33", close: true }));
  d.line(pnl.X(rmp), pnl.Y(0), pnl.X(rmp), pnl.Y(radialP(n, l, rmp)), { color: th.series[1]!, width: 2 });
  d.text(`r mais provável = ${fmt(rmp)} a₀`, pnl.X(rmp), pnl.Y(radialP(n, l, rmp)), { color: th.series[1]!, size: 11, weight: "600", dy: -9, align: rmp > r995 * 0.6 ? "right" : "left" });
  if (rm < r995) {
    d.line(pnl.X(rm), pnl.Y(-0.5 * pmax), pnl.X(rm), pnl.Y(1.1 * pmax), { color: th.series[2]!, width: 1.3, dash: [4, 3] });
    d.text(`⟨r⟩ = ${fmt(rm)} a₀`, pnl.X(rm), pnl.Y(-0.45 * pmax), { color: th.series[2]!, size: 11, align: "left", dx: 4 });
  }
  for (const z of radialZeros(n, l)) d.dot(pnl.X(z), pnl.Y(0), 3.5, th.text);
  d.text("P(r) = r²R²", box.x0 + 0.2, box.y1 - 0.45, { color: th.accent, size: 12, weight: "600", align: "left" });
  d.text("R(r) (escala arbitrária)", box.x0 + 0.2, box.y1 - 1.05, { color: th.muted, size: 11, align: "left" });
}

function drawLevels(d: Draw, p: Params) {
  const { n, l, m } = qn(p);
  const th = d.theme;
  const box = { x0: 3.6, y0: -8.7, x1: 9.4, y1: -0.6 };
  const Y = (E: number) => box.y0 + ((E + 14.6) / 15.4) * (box.y1 - box.y0);
  d.text("Níveis de energia (eV)", box.x0, box.y1 + 0.45, { color: th.text, size: 12, weight: "600", align: "left" });
  d.line(box.x0, Y(0), box.x1, Y(0), { color: th.muted, width: 1, dash: [4, 3] });
  d.text("0 (ionização)", box.x1, Y(0), { color: th.muted, size: 10, align: "right", dy: -8 });
  for (let k = 1; k <= 7; k++) {
    const E = energyEV(k);
    const sel = k === n;
    d.line(box.x0 + 1.1, Y(E), box.x1 - (k <= 3 ? 1.6 : 0.2), Y(E), { color: sel ? th.accent : th.text, width: sel ? 3 : 1.2, alpha: sel ? 1 : 0.7 });
    if (k <= 4) d.text(`n=${k}`, box.x0, Y(E), { color: sel ? th.accent : th.muted, size: 11, align: "left", weight: sel ? "700" : "400" });
    if (k <= 3) d.text(fmt(E, 3), box.x1, Y(E), { color: sel ? th.accent : th.muted, size: 10, align: "right" });
  }
  // grade de estados do nível selecionado
  const gx0 = 10;
  const gx1 = 16.4;
  d.text(`n = ${n}: n² = ${n * n} estados`, gx0, -0.15, { color: th.text, size: 12, weight: "600", align: "left" });
  d.text(`(${2 * n * n} com o spin)`, gx0, -0.75, { color: th.muted, size: 11, align: "left" });
  const rowH = Math.min(1.4, 7 / n);
  const sq = Math.min(0.62, (gx1 - gx0 - 1.2) / 9);
  for (let ll = 0; ll < n; ll++) {
    const y = -1.9 - ll * rowH;
    d.text(`${n}${subshell(ll)}`, gx0, y, { color: ll === l ? th.accent : th.text, size: 11, align: "left", weight: ll === l ? "700" : "400" });
    for (let mm = -ll; mm <= ll; mm++) {
      const x = gx0 + 1.2 + (mm + 4) * sq;
      const sel = ll === l && mm === m;
      d.rect(x, y - sq / 2, sq * 0.88, sq * 0.88, { fill: sel ? th.accent : th.grid, stroke: sel ? th.accent : th.muted, width: 1 });
      if (ll <= 2 || sel) d.text(String(mm), x + sq * 0.44, y - sq / 2 - 0.02, { color: th.muted, size: 9, dy: 8 });
    }
  }
  d.text("m →", gx0 + 1.2 + 9 * sq, -1.9 - (n - 1) * rowH, { color: th.muted, size: 10, align: "left", dx: 2, dy: 12 });
}

function legend(d: Draw, p: Params) {
  const { n, l, m, adjusted } = qn(p);
  const real = isReal(p);
  const th = d.theme;
  const x = -16.6;
  d.text(orbitalName(n, l, m, real), x, 8.7, { color: th.text, size: 17, weight: "700", align: "left" });
  d.text(`n = ${n}, l = ${l}, m = ${m}   E = ${fmt(energyEV(n), 4)} eV`, x, 7.9, { color: th.text, size: 12, align: "left" });
  const nd = nodes(n, l);
  d.text(`nós: ${nd.radial} radiais + ${nd.angular} angulares = ${nd.total}`, x, 7.25, { color: th.muted, size: 11, align: "left" });
  if (adjusted) d.text("l e m ajustados: 0 ≤ l ≤ n − 1 e |m| ≤ l", x, 6.6, { color: th.series[1]!, size: 11, align: "left", weight: "600" });
  if (real) {
    d.dot(x + 0.2, -8.7, 5, th.positive);
    d.text("ψ > 0", x + 0.5, -8.7, { size: 11, align: "left" });
    d.dot(x + 2.4, -8.7, 5, th.negative);
    d.text("ψ < 0", x + 2.7, -8.7, { size: 11, align: "left" });
  } else {
    for (let i = 0; i < 24; i++) {
      const a0 = (i / 24) * 2 * Math.PI;
      d.ctx.beginPath();
      d.ctx.moveTo(x + 0.6, -8.5);
      d.ctx.arc(x + 0.6, -8.5, 0.5, a0, a0 + (2 * Math.PI) / 24 + 0.02);
      d.ctx.closePath();
      d.ctx.fillStyle = hueHex(phaseHue(a0));
      d.ctx.fill();
    }
    d.text("cor = fase de ψ (arg ψ = mφ)", x + 1.4, -8.5, { size: 11, align: "left" });
  }
  const vm = viewMode(p);
  d.text(vm === 2 ? "Corte no plano xz (y = 0)" : "Arraste para girar a câmera", 0.6, 8.7, { color: th.muted, size: 11, align: "right" });
}

const fmtTex = (v: number) => texNum(v, 4);

export const hidrogenio = defineSim<HState>({
  id: "hidrogenio",
  title: "Átomo de hidrogênio e orbitais 3D",
  course: "FG IV",
  topic: "Átomo",
  priority: "P2",
  summary:
    "Orbitais ψ_nlm do hidrogênio em 3D, como nuvem de pontos amostrada de |ψ|² com a fase em cores, superfície angular ou corte; funções radiais, raio mais provável, níveis de energia e degenerescência, orbitais reais (px, dxy...) e complexos.",
  equations: [
    String.raw`\psi_{nlm}(r,\theta,\varphi) = R_{nl}(r)\,Y_l^m(\theta,\varphi)`,
    String.raw`E_n = -\frac{13{,}6\ \text{eV}}{n^2} \qquad g_n = \sum_{l=0}^{n-1}(2l+1) = n^2`,
    String.raw`P(r) = r^2 R_{nl}^2(r) \qquad \langle r\rangle = \frac{a_0}{2}\left[3n^2 - l(l+1)\right]`,
    String.raw`|\vec L| = \hbar\sqrt{l(l+1)} \qquad L_z = m\hbar`,
    String.raw`p_x = \frac{-\psi_{n11} + \psi_{n1,-1}}{\sqrt 2} \qquad p_y = i\,\frac{\psi_{n11} + \psi_{n1,-1}}{\sqrt 2}`,
  ],
  liveEquations(_s, p) {
    const { n, l, m } = qn(p);
    const { rmp } = radii(n, l);
    const out = [
      String.raw`E_{${n}} = -\frac{13{,}6}{${n * n}}\ \text{eV} = ${fmtTex(energyEV(n))}\ \text{eV} \qquad g = ${n * n}`,
      String.raw`r_{\text{mais provável}} = ${fmtTex(rmp)}\,a_0 = ${fmtTex(rmp * 52.9177)}\ \text{pm} \qquad \langle r\rangle = ${fmtTex(meanR(n, l))}\,a_0`,
      String.raw`|\vec L| = \hbar\sqrt{${l}\cdot${l + 1}} = ${fmtTex(Math.sqrt(l * (l + 1)))}\,\hbar` + (isReal(p) ? String.raw`\qquad L_z \text{ indefinido (orbital real)}` : String.raw`\qquad L_z = ${m}\,\hbar`),
    ];
    return out;
  },
  params: [
    { key: "n", label: "n (principal)", unit: "", min: 1, max: 5, step: 1, default: 2, live: true },
    { key: "l", label: "l (momento angular)", unit: "", min: 0, max: 4, step: 1, default: 1, live: true },
    { key: "m", label: "m (magnético)", unit: "", min: -4, max: 4, step: 1, default: 0, live: true },
    {
      key: "tipo",
      label: "Orbitais",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Complexos (m definido)" },
        { value: 1, label: "Reais (px, py, dxy...)" },
      ],
    },
    {
      key: "vista",
      label: "Visualização",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Nuvem de probabilidade 3D" },
        { value: 1, label: "Superfície angular |Y| 3D" },
        { value: 2, label: "Corte no plano xz" },
      ],
    },
    { key: "pontos", label: "Pontos na nuvem", unit: "", min: 500, max: 8000, step: 500, default: 3000, live: true },
    {
      key: "giro",
      label: "Câmera",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Parada (arraste para girar)" },
        { value: 1, label: "Girando sozinha" },
      ],
    },
    {
      key: "fase",
      label: "Fase no tempo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Parada" },
        { value: 1, label: "Girando como e^(−iEt/ħ) (câmera lenta)" },
      ],
    },
  ],
  observables: [
    { key: "E", label: "Energia Eₙ", unit: "eV", value: (_s, p) => energyEV(qn(p).n) },
    { key: "g", label: "Degenerescência n²", unit: "", value: (_s, p) => qn(p).n ** 2 },
    { key: "rmp", label: "Raio mais provável", unit: "a₀", value: (_s, p) => radii(qn(p).n, qn(p).l).rmp },
    { key: "rmed", label: "Raio médio ⟨r⟩", unit: "a₀", value: (_s, p) => meanR(qn(p).n, qn(p).l) },
    { key: "nr", label: "Nós radiais", unit: "", value: (_s, p) => nodes(qn(p).n, qn(p).l).radial },
    { key: "na", label: "Nós angulares", unit: "", value: (_s, p) => nodes(qn(p).n, qn(p).l).angular },
    { key: "L", label: "|L|", unit: "ħ", value: (_s, p) => Math.sqrt(qn(p).l * (qn(p).l + 1)) },
    { key: "Lz", label: "L_z (orbital complexo)", unit: "ħ", value: (_s, p) => qn(p).m },
  ],
  chart: { x: "t", y: "rmp" },
  scenarios: [
    {
      id: "1s",
      label: "Estado fundamental 1s",
      params: { n: 1, l: 0, m: 0, tipo: 1, vista: 0, pontos: 3000 },
      guide: `### O estado 1s
1. A nuvem é esfericamente simétrica: gire a câmera e confira.
2. A densidade de pontos é maior no centro, porque $|\\psi_{100}|^2 \\propto e^{-2r/a_0}$ é máximo em $r = 0$.
3. No gráfico, porém, $P(r) = r^2R^2$ tem pico em $r = a_0$: a casca esférica fina em $r$ tem volume $4\\pi r^2\\,dr$, que cresce com $r$.
4. Mude para $n = 2$ e $n = 3$ com $l = 0$: o raio mais provável cresce e aparecem nós radiais (cascas vazias).`,
      predict: [
        {
          question: "No estado 1s, a que distância do núcleo é mais provável encontrar o elétron?",
          options: ["Em r = 0 (no núcleo)", "Em r = a₀", "Em r = 2a₀", "Qualquer distância é igualmente provável"],
          answer: 1,
          explanation:
            "A densidade $|\\psi|^2$ é máxima no núcleo, mas a probabilidade de achar o elétron entre $r$ e $r+dr$ é $P(r)\\,dr = 4\\pi r^2|\\psi|^2 dr \\propto r^2 e^{-2r/a_0}$, cujo máximo é em $r = a_0$, o raio de Bohr.",
        },
      ],
    },
    {
      id: "2p",
      label: "2p: complexo × real",
      params: { n: 2, l: 1, m: 1, tipo: 0, vista: 0, fase: 1 },
      guide: `### Orbitais complexos e reais
1. Com orbitais **complexos**, $\\psi_{211} \\propto \\sin\\theta\\,e^{i\\varphi}$: a cor (fase) dá uma volta em torno de $z$ e $L_z = \\hbar$ é bem definido.
2. Gire a câmera: o que você vê não é um halteres.
3. Troque para **Reais**: $m = +1$ vira $2p_x$ e $m = -1$ vira $2p_y$, halteres com lobos de sinais opostos. Eles são combinações de $\\psi_{211}$ e $\\psi_{21,-1}$ (veja as equações) e não têm $L_z$ definido.
4. Ligue **Fase no tempo**: num estado estacionário só a fase global gira; $|\\psi|^2$ (a nuvem) não muda.`,
      predict: [
        {
          question: "Qual é a forma da nuvem |ψ|² do orbital complexo 2p com m = +1?",
          options: ["Um halteres ao longo de x", "Uma rosquinha (anel) em torno do eixo z", "Uma esfera", "Dois halteres cruzados"],
          answer: 1,
          explanation:
            "$|\\psi_{211}|^2 \\propto r^2 e^{-r/a_0}\\sin^2\\theta$ não depende de $\\varphi$: é simétrica em torno de $z$ e nula sobre o eixo, uma rosquinha. Os halteres $p_x$ e $p_y$ aparecem só nas combinações reais.",
        },
      ],
    },
    {
      id: "3d",
      label: "Orbitais 3d reais",
      params: { n: 3, l: 2, m: -2, tipo: 1, vista: 1 },
      guide: `### Os cinco orbitais d
1. A superfície mostra $|Y|$ em cada direção, com a cor dando o sinal.
2. Percorra $m = -2, -1, 0, 1, 2$: aparecem $d_{xy}$, $d_{yz}$, $d_{z^2}$, $d_{xz}$ e $d_{x^2-y^2}$.
3. Conte os planos (ou cones) nodais: são sempre $l = 2$.
4. Volte para a nuvem: os cinco têm a mesma energia $E_3 = -1{,}51$ eV (degenerescência).`,
    },
    {
      id: "nos",
      label: "Nós e degenerescência",
      params: { n: 3, l: 0, m: 0, tipo: 1, vista: 2 },
      guide: `### Contando nós
1. No corte do 3s aparecem duas circunferências escuras: os **nós radiais**, onde $R_{30}(r) = 0$.
2. Confira no gráfico de $P(r)$: três máximos separados por dois zeros.
3. Mude para 3p e 3d: os nós radiais diminuem ($n - l - 1$) e os angulares aumentam ($l$); o total é sempre $n - 1$.
4. A grade de estados ao lado mostra por que $g = n^2$: $1 + 3 + 5 = 9$ para $n = 3$.`,
      predict: [
        {
          question: "Quantos nós radiais tem o orbital 3s?",
          options: ["0", "1", "2", "3"],
          answer: 2,
          explanation: "O número de nós radiais é $n - l - 1 = 3 - 0 - 1 = 2$.",
        },
      ],
    },
  ],
  exercises: [
    {
      id: "transicao",
      prompt: "No átomo de hidrogênio, o elétron passa do nível n = {ni} para n = {nf}. Qual é o comprimento de onda do fóton emitido, em nm? (E₁ = −13,6 eV, hc = 1240 eV·nm)",
      vary: { ni: [3, 7, 0] },
      fixed: { nf: 2, n: 3, l: 1, m: 0 },
      answer: { label: "λ", unit: "nm", compute: (p) => transitionNm(num(p, "ni", 3), num(p, "nf", 2)) },
      hint: "ΔE = 13,6 eV (1/nf² − 1/ni²) e λ = hc/ΔE.",
    },
    {
      id: "raio-medio",
      prompt: "Calcule o raio médio ⟨r⟩ do elétron no estado com n = {n} e l = {l}, em unidades de a₀.",
      vary: { n: [2, 5, 0], l: [0, 1, 0] },
      answer: { label: "⟨r⟩", unit: "a₀", compute: (p) => meanR(qn(p).n, qn(p).l) },
      hint: "⟨r⟩ = (a₀/2)[3n² − l(l + 1)].",
    },
  ],
  init: () => ({ yaw: rad(35), pitch: rad(20), seed: 1, drag: null }),
  step(s, p, _t, dt) {
    if (num(p, "giro") >= 0.5 && !s.drag && viewMode(p) !== 2) return { ...s, yaw: s.yaw + 0.4 * dt };
    return s;
  },
  dt: 1 / 60,
  sampleEvery: 15,
  maxSamples: 2000,
  pointer: {
    down(s, _p, pt) {
      if (pt.x > 1.5) return undefined;
      return { ...s, drag: { x0: pt.x, y0: pt.y, yaw0: s.yaw, pitch0: s.pitch } };
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const g = s.drag;
      return { ...s, yaw: g.yaw0 - (pt.x - g.x0) * 0.2, pitch: clamp(g.pitch0 - (pt.y - g.y0) * 0.2, rad(-88), rad(88)) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, _p, pt) => (pt.x <= 1.5 ? "move" : undefined),
  },
  actions: [
    { id: "amostra", label: "Nova amostra da nuvem", run: (s) => ({ ...s, seed: s.seed + 1 }) },
    { id: "perspectiva", label: "Vista em perspectiva", run: (s) => ({ ...s, yaw: rad(35), pitch: rad(20) }) },
    { id: "cima", label: "Vista de cima (eixo z)", run: (s) => ({ ...s, yaw: 0, pitch: rad(88) }) },
    { id: "lado", label: "Vista de lado (plano xz)", run: (s) => ({ ...s, yaw: rad(-90), pitch: 0 }) },
  ],
  narrowSplit: () => 0.562,
  viewport: () => ({ ...VIEW, unit: "" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, t } = frame;
    ctx.save();
    ctx.beginPath();
    ctx.rect(VIEW.xMin, VIEW.yMin, CX + HALF + 1.4 - VIEW.xMin, VIEW.yMax - VIEW.yMin);
    ctx.clip();
    ctx.translate(CX, CY);
    const vm = viewMode(p);
    if (vm === 0) drawCloud(d, s, p, t);
    else if (vm === 1) drawAngular(d, s, p, t);
    else drawCut(d, p, t);
    ctx.restore();
    legend(d, p);
    drawRadialPanel(d, p);
    drawLevels(d, p);
  },
});

export default hidrogenio;
