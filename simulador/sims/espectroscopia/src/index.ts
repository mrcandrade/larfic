import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import { cssRGB, monoColor, wavelengthRGB } from "./cores.ts";
import {
  APEX,
  cauchy,
  GLASSES,
  gratingDeg,
  indexFromMinDev,
  LAMPS,
  lineFwhmDeg,
  minDevIncidence,
  orderEnvelope,
  prismDeviation,
  type Line,
} from "./fisica.ts";

export * from "./fisica.ts";

export interface SpecState {
  /** Ângulo da luneta em relação ao feixe direto (graus, anti-horário positivo). */
  phi: number;
  /** Ângulo de incidência na primeira face do prisma (graus). */
  inc: number;
  drag: null | "luneta" | "mesa";
}

/** Uma imagem da fenda vista pela luneta: linha λ na ordem m, no ângulo ang. */
export interface Feature {
  nm: number;
  m: number;
  ang: number;
  /** Intensidade de pico relativa (linha mais forte em 1ª ordem com fenda de 50 µm = 1). */
  I: number;
  n?: number;
}

const D = Math.PI / 180;
const ORDERS = [-2, -1, 0, 1, 2];
const isPrism = (p: Params) => Math.round(num(p, "modo")) === 1;
export const lampOf = (p: Params) => LAMPS[Math.max(0, Math.min(LAMPS.length - 1, Math.round(num(p, "lampada", 2))))]!;
const glassOf = (p: Params) => GLASSES[Math.max(0, Math.min(1, Math.round(num(p, "vidro"))))]!;
/** Espaçamento da rede (nm). */
export const spacingNm = (p: Params) => 1e6 / num(p, "N", 600);

/** Todas as imagens da fenda que a luneta pode encontrar. */
export function features(s: SpecState, p: Params): Feature[] {
  const lamp = lampOf(p);
  const bright = num(p, "fenda", 50) / 50;
  const out: Feature[] = [];
  if (isPrism(p)) {
    const g = glassOf(p);
    for (const l of lamp.lines) {
      const ang = prismDeviation(cauchy(l.nm, g.A, g.B), s.inc);
      if (Number.isFinite(ang)) out.push({ nm: l.nm, m: 0, ang, I: l.I * bright, n: l.n });
    }
    return out;
  }
  const N = num(p, "N", 600);
  const norm = orderEnvelope(1);
  for (const m of ORDERS) {
    if (m === 0) {
      // feixe direto: todas as linhas sobrepostas
      const tot = lamp.lines.reduce((a, l) => a + l.I, 0);
      out.push({ nm: 0, m: 0, ang: 0, I: (tot * bright) / norm });
      continue;
    }
    for (const l of lamp.lines) {
      const ang = gratingDeg(l.nm, m, N);
      if (Number.isFinite(ang)) out.push({ nm: l.nm, m, ang, I: (l.I * orderEnvelope(m) * bright) / norm, n: l.n });
    }
  }
  return out;
}

/** Intensidade vista no cruzamento do retículo (perfil gaussiano de cada imagem da fenda). */
export function reticleIntensity(s: SpecState, p: Params): number {
  const w = lineFwhmDeg(num(p, "fenda", 50));
  let I = 0;
  for (const f of features(s, p)) I += f.I * Math.exp(-4 * Math.LN2 * ((s.phi - f.ang) / w) ** 2);
  return I;
}

/** Imagem da fenda mais próxima do retículo. */
export function nearest(s: SpecState, p: Params): Feature {
  let best: Feature = { nm: 0, m: 0, ang: 0, I: 0 };
  let dist = Infinity;
  for (const f of features(s, p)) {
    const dd = Math.abs(f.ang - s.phi);
    if (dd < dist) [best, dist] = [f, dd];
  }
  return best;
}

/** λ que o aluno calcula com a rede: d sen φ / m (nm), usando a ordem da linha mais próxima. */
export function lambdaMeasured(s: SpecState, p: Params): number {
  const f = nearest(s, p);
  if (isPrism(p) || f.m === 0) return 0;
  return (spacingNm(p) * Math.sin(s.phi * D)) / f.m;
}

const wrap360 = (a: number) => ((a % 360) + 360) % 360;
const clampPhi = (a: number) => Math.max(-110, Math.min(110, a));
const fmt = (v: number, k = 1) => v.toFixed(k).replace(".", ",").replace("-", "−");
/** Leitura em graus e minutos (arredondada ao minuto, como no nônio). */
export function dms(a: number): string {
  const tot = Math.round(wrap360(a) * 60) % (360 * 60);
  return `${Math.floor(tot / 60)}° ${String(tot % 60).padStart(2, "0")}′`;
}

// ------------------------------------------------------------------ layout
const C = { x: 5.8, y: 0.6 };
const RING = 4.4;
const TABLE = 1.5;
const EYE = { x: 15.7, y: 3.7, r: 2.5 };
const FOV = 0.5; // meia largura do campo da ocular (graus)
const VERN = { x0: 11.4, x1: 19.7, y0: -3.6, y1: -0.2 };
const MAP = { x0: 0.8, x1: 19.4, y0: -8.3, y1: -5.6 };

const lineCss = (nm: number) => (nm === 0 ? "#ffffff" : cssRGB(wavelengthRGB(nm), 0.8));
const lampGlow = (lines: Line[]) => {
  // cor aproximada da lâmpada: soma das cores das linhas
  const acc = [0, 0, 0];
  for (const l of lines) {
    const c = monoColor(l.nm, l.I);
    acc[0]! += c[0];
    acc[1]! += c[1];
    acc[2]! += c[2];
  }
  const m = Math.max(acc[0]!, acc[1]!, acc[2]!, 1e-6);
  return cssRGB([acc[0]! / m, acc[1]! / m, acc[2]! / m], 0.7);
};

function tube(d: Draw, ang: number, r0: number, r1: number, w: number, fill: string) {
  const u: [number, number] = [Math.cos(ang * D), Math.sin(ang * D)];
  const r = (r0 + r1) / 2;
  d.box(C.x + r * u[0], C.y + r * u[1], r1 - r0, w, ang * D, { fill, stroke: d.theme.text, width: 1 });
}

function drawGoniometer(d: Draw, s: SpecState, p: Params, feats: Feature[]) {
  const th = d.theme;
  const showMap = Math.round(num(p, "mapa", 1)) === 1;
  // círculo graduado fixo (leitura 0° no feixe direto)
  d.circle(C.x, C.y, RING, { fill: th.dark ? "#1b2028" : "#f1f3f6", stroke: th.text, width: 1.5 });
  d.circle(C.x, C.y, RING - 0.45, { stroke: th.muted, width: 1 });
  for (let a = 0; a < 360; a += 5) {
    const t = a * D;
    const big = a % 30 === 0;
    const r1 = RING - (big ? 0.4 : a % 10 === 0 ? 0.28 : 0.18);
    d.line(C.x + r1 * Math.cos(t), C.y + r1 * Math.sin(t), C.x + RING * Math.cos(t), C.y + RING * Math.sin(t), { color: th.text, width: big ? 1.4 : 0.8 });
    if (big) d.text(`${a}°`, C.x + (RING - 0.75) * Math.cos(t), C.y + (RING - 0.75) * Math.sin(t), { color: th.muted, size: 9 });
  }
  // lâmpada e colimador
  const lamp = lampOf(p);
  d.rect(0.15, C.y - 0.55, 0.85, 1.1, { fill: th.dark ? "#3a3530" : "#5a5248", stroke: th.text, width: 1 });
  d.circle(0.58, C.y, 0.28, { fill: lampGlow(lamp.lines) });
  d.text(lamp.id, 0.58, C.y + 0.85, { color: th.text, size: 11, weight: "600" });
  tube(d, 180, 1.7, RING + 0.6, 0.5, th.dark ? "#4a5566" : "#9aa6b6");
  d.rect(C.x - RING - 0.75, C.y - 0.3, 0.12, 0.6, { fill: th.text });
  d.text("colimador", C.x - 3.0, C.y - 0.55, { color: th.muted, size: 10 });
  // feixe colimado
  d.line(C.x - 1.7, C.y, C.x, C.y, { color: lampGlow(lamp.lines), width: 4, alpha: 0.6 });
  // mesa
  d.circle(C.x, C.y, TABLE, { fill: th.dark ? "#262c35" : "#e2e6ec", stroke: th.muted, width: 1 });
  if (isPrism(p)) {
    const g = glassOf(p);
    // normais externas das faces: n1 a 180° + i, n2 a i − A
    const n1 = 180 + s.inc;
    const n2 = s.inc - APEX;
    const vx = Math.cos(n1 * D) + Math.cos(n2 * D);
    const vy = Math.sin(n1 * D) + Math.sin(n2 * D);
    const apex = Math.atan2(vy, vx);
    const rin = 0.55;
    const verts: [number, number][] = [0, 1, 2].map((k) => [C.x + 2 * rin * Math.cos(apex + (k * 2 * Math.PI) / 3), C.y + 2 * rin * Math.sin(apex + (k * 2 * Math.PI) / 3)]);
    d.polyline(verts, { close: true, fill: th.dark ? "rgba(150,200,240,0.3)" : "rgba(110,170,220,0.35)", color: th.text, width: 1.3 });
    const entry: [number, number] = [C.x + rin * Math.cos(n1 * D), C.y + rin * Math.sin(n1 * D)];
    const exit: [number, number] = [C.x + rin * Math.cos(n2 * D), C.y + rin * Math.sin(n2 * D)];
    d.line(C.x - 1.7, C.y, entry[0], entry[1], { color: lampGlow(lamp.lines), width: 3, alpha: 0.7 });
    d.line(entry[0], entry[1], exit[0], exit[1], { color: lampGlow(lamp.lines), width: 2, alpha: 0.6 });
    if (showMap)
      for (const f of feats) {
        const a = f.ang * D;
        d.line(exit[0], exit[1], exit[0] + 3.2 * Math.cos(a), exit[1] + 3.2 * Math.sin(a), { color: lineCss(f.nm), width: 1.5, alpha: Math.min(1, 0.25 + f.I) });
      }
    // alça para girar a mesa (na normal da 1ª face)
    d.circle(C.x + 1.25 * Math.cos(n1 * D), C.y + 1.25 * Math.sin(n1 * D), 0, { minPx: 6, fill: th.accent, stroke: th.text, width: 1 });
    d.text(`prisma ${g.label} · i = ${fmt(s.inc)}°`, C.x, C.y - TABLE - 0.35, { color: th.muted, size: 10 });
  } else {
    d.rect(C.x - 0.06, C.y - 0.8, 0.12, 1.6, { fill: th.dark ? "rgba(180,200,230,0.8)" : "rgba(70,90,120,0.8)" });
    if (showMap)
      for (const f of feats) {
        if (Math.abs(f.ang) > 100) continue;
        const a = f.ang * D;
        d.line(C.x, C.y, C.x + 3.6 * Math.cos(a), C.y + 3.6 * Math.sin(a), { color: lineCss(f.nm), width: 1.5, alpha: Math.min(1, 0.2 + 0.8 * Math.sqrt(f.I)) });
      }
    d.text(`rede ${Math.round(num(p, "N", 600))} linhas/mm`, C.x, C.y - TABLE - 0.35, { color: th.muted, size: 10 });
  }
  // luneta (arrastável)
  tube(d, s.phi, 1.7, RING + 0.9, 0.55, th.dark ? "#56657a" : "#7f8ea3");
  const u: [number, number] = [Math.cos(s.phi * D), Math.sin(s.phi * D)];
  d.circle(C.x + (RING + 1.05) * u[0], C.y + (RING + 1.05) * u[1], 0.22, { fill: th.text });
  d.line(C.x + (RING - 0.5) * u[0], C.y + (RING - 0.5) * u[1], C.x + RING * u[0], C.y + RING * u[1], { color: th.positive, width: 3 });
  d.text("luneta (arraste)", C.x + (RING + 1.0) * u[0], C.y + (RING + 1.0) * u[1] + (u[1] >= 0 ? 0.55 : -0.55), { color: th.text, size: 10, weight: "600" });
}

function drawEyepiece(d: Draw, s: SpecState, p: Params, feats: Feature[]) {
  const th = d.theme;
  const { x: cx, y: cy, r } = EYE;
  const k = r / FOV;
  const w = lineFwhmDeg(num(p, "fenda", 50)) * k;
  d.circle(cx, cy, r + 0.12, { fill: th.dark ? "#444b55" : "#555c66" });
  const ctx = d.ctx;
  ctx.save();
  ctx.beginPath();
  ctx.arc(cx, cy, r, 0, 2 * Math.PI);
  ctx.clip();
  d.rect(cx - r, cy - r, 2 * r, 2 * r, { fill: "#050608" });
  for (const f of feats) {
    const dx = (f.ang - s.phi) * k;
    if (Math.abs(dx) > r + 3 * w) continue;
    const a = Math.min(1, 0.15 + Math.sqrt(f.I));
    const col = lineCss(f.nm);
    d.rect(cx + dx - 1.5 * w, cy - r, 3 * w, 2 * r, { fill: col, alpha: 0.18 * a });
    d.rect(cx + dx - Math.max(w, 2 * d.px) / 2, cy - r, Math.max(w, 2 * d.px), 2 * r, { fill: col, alpha: a });
  }
  // retículo
  const rc = "rgba(230,230,230,0.85)";
  d.line(cx, cy - r, cx, cy + r, { color: rc, width: 1 });
  d.line(cx - r * 0.7, cy - r * 0.7, cx + r * 0.7, cy + r * 0.7, { color: rc, width: 1 });
  d.line(cx - r * 0.7, cy + r * 0.7, cx + r * 0.7, cy - r * 0.7, { color: rc, width: 1 });
  ctx.restore();
  d.text(`Ocular (campo ±${Math.round(FOV * 60)}′)`, cx, cy + r + 0.35, { color: th.muted, size: 10 });
  const I = reticleIntensity(s, p);
  d.text(`brilho no retículo: ${fmt(I, 3)}`, cx, cy - r - 0.35, { color: th.text, size: 11 });
}

function drawVernier(d: Draw, s: SpecState) {
  const th = d.theme;
  const { x0, x1, y0, y1 } = VERN;
  const R = wrap360(s.phi);
  d.rect(x0, y0, x1 - x0, y1 - y0, { fill: th.dark ? "#1b2028" : "#f6f4ee", stroke: th.text, width: 1 });
  const span = 16.5;
  const kx = (x1 - x0 - 0.4) / span;
  const X = (a: number) => x0 + 0.2 + (a - (R - 1)) * kx;
  const ym = (y0 + y1) / 2 + 0.15;
  // escala principal (meio grau)
  const a0 = Math.ceil((R - 1) * 2) / 2;
  for (let a = a0; a <= R - 1 + span + 1e-9; a += 0.5) {
    const whole = Math.abs(a - Math.round(a)) < 1e-9;
    d.line(X(a), ym, X(a), ym + (whole ? 0.55 : 0.35), { color: th.text, width: 1 });
    if (whole && Math.round(a) % 2 === 0) d.text(`${wrap360(Math.round(a))}`, X(a), ym + 0.85, { color: th.text, size: 9 });
  }
  // nônio: 30 divisões em 29 meios-graus → 1′
  const jStar = Math.round(((((R % 0.5) + 0.5) % 0.5) * 60)) % 30;
  for (let j = 0; j <= 30; j++) {
    const a = R + (j * 29) / 60;
    const hit = j === jStar || (jStar === 0 && j === 30);
    d.line(X(a), ym, X(a), ym - (j % 5 === 0 ? 0.55 : 0.35), { color: hit ? th.positive : th.accent, width: hit ? 2 : 1 });
    if (j % 10 === 0) d.text(`${j}`, X(a), ym - 0.85, { color: th.accent, size: 9 });
  }
  d.text("escala (0,5°)", x0 + 0.1, y1 - 0.25, { color: th.muted, size: 9, align: "left" });
  d.text("nônio (1′)", x0 + 0.1, y0 + 0.25, { color: th.accent, size: 9, align: "left" });
  d.text(`leitura ≈ ${dms(s.phi)}`, x1 - 0.1, y0 + 0.25, { color: th.text, size: 11, weight: "600", align: "right" });
}

function drawMap(d: Draw, s: SpecState, p: Params, feats: Feature[]) {
  const th = d.theme;
  const { x0, x1, y0, y1 } = MAP;
  const xm = (x0 + x1) / 2;
  const k = (x1 - x0) / 2 / 95;
  const X = (a: number) => xm + a * k;
  d.line(x0, y0, x1, y0, { color: th.muted, width: 1 });
  for (let a = -90; a <= 90; a += 10) {
    d.line(X(a), y0, X(a), y0 - (a % 30 === 0 ? 0.2 : 0.1), { color: th.muted, width: 1 });
    if (a % 30 === 0) d.text(`${a}°`.replace("-", "−"), X(a), y0 - 0.4, { color: th.muted, size: 9 });
  }
  if (Math.round(num(p, "mapa", 1)) === 1) {
    for (const f of feats) {
      if (Math.abs(f.ang) > 95) continue;
      d.line(X(f.ang), y0, X(f.ang), y0 + (y1 - y0) * Math.min(1, Math.sqrt(f.I)), { color: lineCss(f.nm), width: 2 });
    }
    if (!isPrism(p))
      for (const m of [-2, -1, 1, 2]) {
        const a = gratingDeg(550, m, num(p, "N", 600));
        if (Number.isFinite(a)) d.text(`m = ${m}`.replace("-", "−"), X(a), y1 + 0.3, { color: th.muted, size: 9 });
      }
  } else d.text("mapa angular escondido: procure as linhas com a luneta", xm, (y0 + y1) / 2, { color: th.muted, size: 11 });
  d.line(X(clampPhi(s.phi)), y0, X(clampPhi(s.phi)), y1, { color: th.accent, width: 1.5, dash: [4, 3] });
  d.text("ângulo φ em relação ao feixe direto", x0, y1 + 0.3, { color: th.muted, size: 9, align: "left" });
}

// ------------------------------------------------------------------ interação
const phiFrom = (pt: { x: number; y: number }) => clampPhi(Math.round((Math.atan2(pt.y - C.y, pt.x - C.x) / D) * 600) / 600);
const incFrom = (pt: { x: number; y: number }) => {
  const psi = Math.atan2(pt.y - C.y, pt.x - C.x) / D;
  const i = wrap360(psi + 360) - 180;
  return Math.max(10, Math.min(89, Math.round(i * 60) / 60));
};
const rOf = (pt: { x: number; y: number }) => Math.hypot(pt.x - C.x, pt.y - C.y);
const onTelescope = (pt: { x: number; y: number }, p: Params) => {
  const r = rOf(pt);
  return r > (isPrism(p) ? TABLE : 1.0) && r < RING + 1.4 && pt.x < VERN.x0;
};
const step = (s: SpecState, dPhi: number): SpecState => ({ ...s, phi: clampPhi(Math.round((s.phi + dPhi) * 600) / 600) });

export const espectroscopia = defineSim<SpecState>({
  id: "espectroscopia",
  title: "Espectroscópio de rede e prisma",
  course: "Exp III",
  topic: "Ótica",
  priority: "P1",
  summary:
    "Goniômetro com colimador, rede de difração ou prisma e luneta com retículo e nônio de 1′. Meça os ângulos das linhas de H, He, Hg, Na e Ne, calcule λ = d sen θ/m e verifique a série de Balmer.",
  static: true,
  equations: [
    String.raw`d\,\text{sen}\,\theta = m\lambda \qquad d = \frac{1}{N} \qquad m = 0, \pm 1, \pm 2`,
    String.raw`\frac{1}{\lambda} = R_H\left(\frac{1}{2^2} - \frac{1}{n^2}\right),\quad n = 3, 4, 5, \dots \qquad R_H = 1{,}0968\times 10^{7}\ \text{m}^{-1}`,
    String.raw`n(\lambda) = A + \frac{B}{\lambda^2} \qquad \delta = i + e - \alpha \qquad n = \frac{\text{sen}\frac{\alpha + \delta_{\min}}{2}}{\text{sen}\frac{\alpha}{2}}`,
    String.raw`\Delta\theta_{\text{dubleto}} = \frac{m\,\Delta\lambda}{d\cos\theta}`,
  ],
  liveEquations(s, p) {
    const f = nearest(s, p);
    const out: string[] = [String.raw`\varphi = ${texNum(s.phi, 5)}^\circ \quad (${dms(s.phi).replace("°", "^\\circ").replace("′", "'")})`];
    if (isPrism(p)) {
      const g = glassOf(p);
      const n = cauchy(f.nm, g.A, g.B);
      out.push(String.raw`\lambda = ${texNum(f.nm, 5)}\ \text{nm}:\ n = ${texNum(n, 5)},\ \delta = ${texNum(f.ang, 4)}^\circ,\ i_{\min} = ${texNum(minDevIncidence(n), 4)}^\circ`);
      out.push(String.raw`\text{supondo } \delta_{\min} = \varphi:\ n = ${texNum(indexFromMinDev(s.phi), 5)}`);
    } else if (f.m !== 0) {
      out.push(String.raw`\lambda = \frac{d\,\text{sen}\,\varphi}{m} = \frac{${texNum(spacingNm(p), 4)}\,\text{nm}\times ${texNum(Math.sin(s.phi * D), 4)}}{${f.m}} = ${texNum(lambdaMeasured(s, p), 5)}\ \text{nm}`);
      if (f.n) out.push(String.raw`\text{Balmer } n = ${f.n}:\ \frac{1}{\lambda} = ${texNum(1e9 / lambdaMeasured(s, p), 4)}\ \text{m}^{-1},\ \tfrac14 - \tfrac{1}{n^2} = ${texNum(0.25 - 1 / f.n ** 2, 4)}`);
    } else out.push(String.raw`m = 0:\ \text{feixe direto, todas as cores juntas}`);
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Elemento dispersor",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Rede de difração" },
        { value: 1, label: "Prisma de 60°" },
      ],
    },
    {
      key: "lampada",
      label: "Lâmpada espectral",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 2,
      live: true,
      options: LAMPS.map((l, i) => ({ value: i, label: l.label })),
    },
    { key: "N", label: "Linhas por milímetro da rede", unit: "linhas/mm", min: 100, max: 1200, step: 10, default: 600, live: true },
    {
      key: "vidro",
      label: "Vidro do prisma",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: GLASSES.map((g, i) => ({ value: i, label: `${g.label} (A = ${String(g.A).replace(".", ",")}, B = ${g.B} nm²)` })),
    },
    { key: "fenda", label: "Largura da fenda do colimador", unit: "µm", min: 10, max: 300, step: 5, default: 50, live: true },
    { key: "phi", label: "Ângulo inicial da luneta", unit: "°", min: -100, max: 100, step: 0.5, default: 0 },
    { key: "inc", label: "Ângulo inicial de incidência no prisma", unit: "°", min: 20, max: 89, step: 0.5, default: 50 },
    {
      key: "mapa",
      label: "Mapa angular das linhas",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Mostrar" },
        { value: 0, label: "Esconder (como no laboratório)" },
      ],
    },
  ],

  observables: [
    { key: "phi", label: "Ângulo da luneta φ", unit: "°", value: (s) => s.phi },
    { key: "Iret", label: "Brilho no retículo (relativo)", unit: "", value: (s, p) => reticleIntensity(s, p) },
    { key: "lam", label: "λ da linha mais próxima do retículo (tabela)", unit: "nm", value: (s, p) => nearest(s, p).nm },
    { key: "ordem", label: "Ordem m da linha mais próxima", unit: "", value: (s, p) => nearest(s, p).m },
    { key: "lamMed", label: "λ calculado d sen φ / m", unit: "nm", value: (s, p) => lambdaMeasured(s, p) },
    { key: "desvio", label: "Distância da linha ao retículo", unit: "′", value: (s, p) => (nearest(s, p).ang - s.phi) * 60 },
    { key: "nsup", label: "Nível superior n (Balmer)", unit: "", value: (s, p) => nearest(s, p).n ?? 0 },
    { key: "inc", label: "Incidência no prisma i", unit: "°", value: (s) => s.inc },
    { key: "nPrisma", label: "n supondo desvio mínimo em φ", unit: "", value: (s) => indexFromMinDev(s.phi) },
    { key: "d", label: "Espaçamento da rede d", unit: "µm", value: (_s, p) => spacingNm(p) / 1000 },
  ],
  chart: { x: "phi", y: "Iret" },

  scenarios: [
    {
      id: "rede-hg",
      label: "Calibrando a rede com mercúrio",
      params: { modo: 0, lampada: 2, N: 600, fenda: 50, phi: 0, mapa: 1 },
      guide: `### Medindo ângulos com o nônio
1. Com a luneta em 0° você vê o feixe direto (todas as cores juntas, $m = 0$).
2. Arraste a luneta até ver as linhas do mercúrio na ocular. Use os botões de 1′ e 10′ (parafuso fino) para pôr cada linha exatamente no cruzamento do retículo.
3. Leia o ângulo: escala principal (meio grau) + traço do nônio que coincide (minutos).
4. Meça a linha verde (546,07 nm) nas ordens $m = \\pm1$ e $\\pm2$. Use a média de $|\\varphi_{+m}|$ e $|\\varphi_{-m}|$ para cancelar um desalinhamento.
5. Com $d = m\\lambda/\\text{sen}\\,\\varphi$ obtenha $N = 1/d$ e compare com o valor nominal.`,
      predict: [
        {
          question: "Na rede, qual linha do mercúrio aparece mais longe do feixe direto em cada ordem?",
          options: ["a violeta (405 nm)", "a verde (546 nm)", "a amarela (579 nm)", "todas no mesmo ângulo"],
          answer: 2,
          explanation: "Como $\\text{sen}\\,\\theta = m\\lambda/d$, o ângulo cresce com λ: o vermelho e o amarelo se desviam mais que o violeta. No prisma é o contrário.",
        },
      ],
    },
    {
      id: "balmer",
      label: "Série de Balmer do hidrogênio",
      params: { modo: 0, lampada: 0, N: 600, fenda: 50, phi: 20, mapa: 1 },
      guide: `### Verificando a fórmula de Rydberg
1. A lâmpada de hidrogênio mostra Hα (vermelha), Hβ (azul-esverdeada), Hγ e Hδ (violetas, fracas).
2. Meça o ângulo de cada linha na 1ª ordem e calcule $\\lambda = d\\,\\text{sen}\\,\\varphi$.
3. Faça o gráfico de $1/\\lambda$ contra $\\tfrac14 - \\tfrac1{n^2}$ com $n = 3, 4, 5, 6$. Deve ser uma reta pela origem.
4. A inclinação é a constante de Rydberg; compare com $R_H = 1{,}0968 \\times 10^7\\ \\text{m}^{-1}$.`,
      predict: [
        {
          question: "Qual linha de Balmer aparece mais perto do feixe direto?",
          options: ["Hα (n = 3)", "Hβ (n = 4)", "Hδ (n = 6)", "todas juntas"],
          answer: 2,
          explanation: "Quanto maior $n$, maior a energia do fóton e menor λ; com $\\text{sen}\\,\\theta = \\lambda/d$, Hδ (410 nm) tem o menor ângulo.",
        },
      ],
    },
    {
      id: "sodio",
      label: "Dubleto do sódio e ordens",
      params: { modo: 0, lampada: 3, N: 600, fenda: 20, phi: 20.7, mapa: 1 },
      guide: `### Resolvendo o dubleto D
1. As linhas D do sódio (589,00 e 589,59 nm) estão separadas por apenas 0,6 nm.
2. Na 1ª ordem, com a fenda estreita, elas aparecem quase juntas no retículo. Vá para a 2ª ordem (perto de 45°): ficam bem separadas.
3. Calcule $\\Delta\\theta = m\\,\\Delta\\lambda/(d\\cos\\theta)$ nas duas ordens e compare com o que você mede.
4. Abra a fenda para 200 µm: as imagens ficam largas e o dubleto some. Mais luz, menos resolução.`,
      predict: [
        {
          question: "Em qual ordem é mais fácil separar as duas linhas D do sódio?",
          options: ["m = 0", "m = 1", "m = 2", "é igual em todas"],
          answer: 2,
          explanation: "A separação angular é $m\\Delta\\lambda/(d\\cos\\theta)$: cresce com $m$ e ainda mais porque $\\cos\\theta$ diminui. Na ordem 0 as cores nem se separam.",
        },
      ],
    },
    {
      id: "prisma",
      label: "Prisma e desvio mínimo",
      params: { modo: 1, lampada: 2, vidro: 0, fenda: 50, inc: 50, phi: 38, mapa: 1 },
      guide: `### Dispersão no prisma
1. Ponha a linha verde do mercúrio no retículo.
2. Gire a mesa do prisma (arraste a alça azul) e acompanhe a linha com a luneta: ela anda, para e volta. O ponto de retorno é o **desvio mínimo** $\\delta_{\\min}$.
3. Em $\\delta_{\\min}$, $n = \\dfrac{\\text{sen}\\frac{\\alpha + \\delta_{\\min}}{2}}{\\text{sen}\\frac{\\alpha}{2}}$ com $\\alpha = 60°$.
4. Repita para cada linha e faça o gráfico de $n$ contra $1/\\lambda^2$: a reta dá os coeficientes de Cauchy $A$ (intercepto) e $B$ (inclinação).`,
      predict: [
        {
          question: "No prisma, qual cor é mais desviada?",
          options: ["vermelha", "verde", "violeta", "todas igualmente"],
          answer: 2,
          explanation: "O índice do vidro é maior para λ menor ($n = A + B/\\lambda^2$): o violeta refrata mais e é o mais desviado, ao contrário da rede.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "angulo-rede",
      prompt: "Uma rede de {N} linhas/mm é iluminada perpendicularmente por luz de {lam} nm. Em que ângulo aparece a ordem m = {m}?",
      vary: { N: [200, 600, 0], lam: [400, 700, 0], m: [1, 2, 0] },
      fixed: { modo: 0 },
      answer: { label: "θ", unit: "°", compute: (p) => gratingDeg(num(p, "lam"), num(p, "m"), num(p, "N")) },
      hint: "d sen θ = mλ, com d = 1/N.",
    },
    {
      id: "balmer",
      prompt:
        "Num espectroscópio com rede de {N} linhas/mm, a linha de Balmer do hidrogênio com nível superior n = {nb} aparece em φ na 1ª ordem. Calcule φ usando R_H = 1,0968 × 10⁷ m⁻¹.",
      vary: { N: [300, 800, 0], nb: [3, 6, 0] },
      fixed: { modo: 0, lampada: 0 },
      answer: { label: "φ", unit: "°", compute: (p) => Math.asin(num(p, "N") * 1e3 / (1.0968e7 * (0.25 - 1 / num(p, "nb") ** 2))) / D },
      hint: "Primeiro 1/λ = R_H(1/4 − 1/n²); depois sen φ = λ/d.",
    },
    {
      id: "desvio-minimo",
      prompt: "Um prisma de 60° tem índice {n} para certa linha. Qual é o desvio mínimo dessa linha?",
      vary: { n: [1.45, 1.75, 3] },
      fixed: { modo: 1 },
      answer: { label: "δ_min", unit: "°", compute: (p) => 2 * minDevIncidence(num(p, "n")) - APEX },
      hint: "No desvio mínimo, n = sen((α + δ)/2)/sen(α/2).",
    },
  ],

  init: (p) => ({ phi: clampPhi(num(p, "phi")), inc: Math.max(10, Math.min(89, num(p, "inc", 50))), drag: null }),
  step: (s) => s,
  dt: 0.05,

  pointer: {
    down(s, p, pt) {
      if (isPrism(p) && rOf(pt) <= TABLE) return { ...s, drag: "mesa", inc: incFrom(pt) };
      if (onTelescope(pt, p)) return { ...s, drag: "luneta", phi: phiFrom(pt) };
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      return s.drag === "mesa" ? { ...s, inc: incFrom(pt) } : { ...s, phi: phiFrom(pt) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p, pt) => ((isPrism(p) && rOf(pt) <= TABLE) || onTelescope(pt, p) ? "grab" : undefined),
  },

  actions: [
    { id: "m10", label: "◀ 10′", run: (s) => step(s, -10 / 60) },
    { id: "m1", label: "◀ 1′", run: (s) => step(s, -1 / 60) },
    { id: "p1", label: "1′ ▶", run: (s) => step(s, 1 / 60) },
    { id: "p10", label: "10′ ▶", run: (s) => step(s, 10 / 60) },
    { id: "mesa-", label: "Mesa −0,5°", run: (s) => ({ ...s, inc: Math.max(10, s.inc - 0.5) }) },
    { id: "mesa+", label: "Mesa +0,5°", run: (s) => ({ ...s, inc: Math.min(89, s.inc + 0.5) }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: -9, yMax: 7 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    const feats = features(s, p);
    drawGoniometer(d, s, p, feats);
    drawEyepiece(d, s, p, feats);
    drawVernier(d, s);
    drawMap(d, s, p, feats);
    const f = nearest(s, p);
    const info =
      f.m === 0 && !isPrism(p)
        ? "feixe direto (m = 0)"
        : `linha mais próxima: ${fmt(f.nm, 2)} nm${isPrism(p) ? "" : `, m = ${f.m}`.replace("-", "−")}, a ${fmt((f.ang - s.phi) * 60, 1)}′`;
    d.text(info, VERN.x0, 0.35, { color: d.theme.muted, size: 10, align: "left" });
  },
});

export default espectroscopia;
