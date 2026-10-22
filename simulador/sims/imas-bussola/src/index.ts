import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  B0_EARTH,
  MAG_L,
  MAG_W,
  POA,
  POA_MEDIDO,
  POLE_D,
  benchField,
  dipInclination,
  dipoleDeclination,
  earthComponents,
  geomagneticLatitude,
  needleStep,
  traceLine,
  wrapPi,
  type Magnet,
  type V2,
} from "./physics.ts";

export * from "./physics.ts";

export interface Compass {
  x: number;
  y: number;
  /** Direção da ponta norte da agulha (rad, a partir de +x). */
  th: number;
  w: number;
}

export interface Drag {
  kind: "mag" | "rot" | "comp" | "lat";
  i: number;
  dx: number;
  dy: number;
}

export interface ImasState {
  mags: Magnet[];
  comps: Compass[];
  /** Agulha de inclinação: ângulo abaixo da horizontal (rad) e velocidade angular. */
  dip: { th: number; w: number };
  /** Latitude magnética do ponto no globo (graus). */
  lat: number;
  drag: Drag | null;
}

/** Bancada: retângulo do mundo em metros. */
export const BENCH = { xMin: -0.32, xMax: 0.32, yMin: -0.2, yMax: 0.2 };
/** Raio da bússola (m). */
export const COMP_R = 0.013;
const HANDLE = MAG_L / 2 + 0.016;
const MAX_MAGS = 3;
const MAX_COMPS = 60;

/** Vista do globo: centro e raio do painel da agulha de inclinação (raios terrestres). */
const DIP = { x: 4.45, y: 0.95, r: 0.95 };

const vista = (p: Params) => Math.round(num(p, "vista"));
const modelo = (p: Params) => Math.round(num(p, "modelo"));
const bTerra = (p: Params) => num(p, "BT", 18) * 1e-6;
const moment = (p: Params) => num(p, "m", 1);

export function fieldAt(s: ImasState, p: Params, x: number, y: number): V2 {
  return benchField(s.mags, moment(p), modelo(p), bTerra(p), x, y);
}

function arrangement(k: number): Magnet[] {
  switch (k) {
    case 1:
      return [
        { x: -0.08, y: 0, ang: 0 },
        { x: 0.08, y: 0, ang: 0 },
      ];
    case 2:
      return [
        { x: -0.09, y: 0, ang: 0 },
        { x: 0.09, y: 0, ang: Math.PI },
      ];
    case 3:
      return [];
    default:
      return [{ x: 0, y: 0, ang: 0 }];
  }
}

/** Distância de um ponto ao retângulo de um ímã (0 dentro). */
function distToMagnet(g: Magnet, x: number, y: number): number {
  const c = Math.cos(-g.ang);
  const s = Math.sin(-g.ang);
  const lx = (x - g.x) * c - (y - g.y) * s;
  const ly = (x - g.x) * s + (y - g.y) * c;
  const ex = Math.max(Math.abs(lx) - MAG_L / 2, 0);
  const ey = Math.max(Math.abs(ly) - MAG_W / 2, 0);
  return Math.hypot(ex, ey);
}

export function compassGrid(mags: Magnet[]): Compass[] {
  const out: Compass[] = [];
  for (let x = -0.28; x <= 0.281; x += 0.07)
    for (let y = -0.16; y <= 0.161; y += 0.08) {
      if (mags.some((g) => distToMagnet(g, x, y) < COMP_R + 0.006)) continue;
      out.push({ x, y, th: Math.PI / 2, w: 0 });
    }
  return out;
}

function initialCompasses(k: number, mags: Magnet[]): Compass[] {
  if (k === 1) return compassGrid(mags);
  if (k === 2) return [];
  return [{ x: 0, y: 0.1, th: Math.PI / 2, w: 0 }];
}

function initLat(p: Params): number {
  return Math.round(num(p, "local")) === 1 ? geomagneticLatitude(POA.lat, POA.lon) : clamp(num(p, "lat", 45), -89, 89);
}

const deg = (r: number) => (r * 180) / Math.PI;

const firstCompassField = (s: ImasState, p: Params): V2 | null => {
  const c = s.comps[0];
  return c ? fieldAt(s, p, c.x, c.y) : null;
};

const ARRANJOS = ["Um ímã", "Dois ímãs em fila (N diante de S)", "Dois ímãs frente a frente (N com N)", "Sem ímãs (só a Terra)"];

export const imasBussola = defineSim<ImasState>({
  id: "imas-bussola",
  title: "Ímãs, bússola e campo da Terra",
  course: "FG III",
  topic: "Magnetismo",
  priority: "P1",
  summary:
    "Arraste e gire ímãs em barra e veja bússolas de agulha amortecida se alinharem ao campo local. No globo, a agulha de inclinação mostra tan I = 2 tan λ, com Porto Alegre comparada aos valores medidos.",
  equations: [
    String.raw`\vec B_{\text{dipolo}} = \frac{\mu_0}{4\pi}\,\frac{3(\vec m\cdot\hat r)\hat r - \vec m}{r^3} \qquad \vec B_{\text{2 polos}} = \frac{\mu_0 q_m}{4\pi}\left(\frac{\vec r_N}{r_N^3} - \frac{\vec r_S}{r_S^3}\right),\ q_m = \frac{m}{d}`,
    String.raw`\vec\tau = \vec\mu\times\vec B \quad\Rightarrow\quad I\ddot\theta = \mu B\,\mathrm{sen}(\varphi_B - \theta) - I\gamma\,\dot\theta`,
    String.raw`\tan I = 2\tan\lambda_m \qquad B = B_0\sqrt{1 + 3\,\mathrm{sen}^2\lambda_m},\ B_0 \approx 30\ \mu\text{T}`,
  ],
  liveEquations(s, p) {
    const out: string[] = [];
    const B = firstCompassField(s, p);
    const c = s.comps[0];
    if (vista(p) === 0 && B && c) {
      out.push(
        String.raw`|\vec B| = ${texNum(Math.hypot(B[0], B[1]) * 1e6)}\ \mu\text{T} \quad \varphi_B = ${texNum(deg(Math.atan2(B[1], B[0])))}^\circ \quad \theta_{\text{agulha}} = ${texNum(deg(c.th))}^\circ`,
      );
    }
    const I = dipInclination(s.lat);
    const e = earthComponents(s.lat);
    out.push(
      String.raw`\tan I = 2\tan(${texNum(s.lat)}^\circ) \Rightarrow I = ${texNum(I)}^\circ \qquad B = ${texNum(e.F * 1e6)}\ \mu\text{T}`,
    );
    return out;
  },

  params: [
    {
      key: "vista",
      label: "Vista",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Bancada: ímãs e bússolas" },
        { value: 1, label: "Globo: agulha de inclinação" },
      ],
    },
    { key: "arranjo", label: "Arranjo de ímãs", unit: "", min: 0, max: 3, step: 1, default: 0, options: ARRANJOS.map((label, value) => ({ value, label })) },
    {
      key: "bussolas",
      label: "Bússolas",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Uma bússola" },
        { value: 1, label: "Grade de bússolas" },
        { value: 2, label: "Nenhuma" },
      ],
    },
    {
      key: "modelo",
      label: "Modelo do ímã",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Dois polos (cargas magnéticas)" },
        { value: 1, label: "Dipolo pontual" },
      ],
    },
    { key: "m", label: "Momento magnético do ímã", unit: "A·m²", min: 0.1, max: 5, step: 0.1, default: 1, live: true },
    { key: "BT", label: "Componente horizontal da Terra", unit: "μT", min: 0, max: 60, step: 1, default: 18, live: true },
    { key: "gamma", label: "Amortecimento da agulha γ", unit: "1/s", min: 0, max: 10, step: 0.1, default: 2, live: true },
    {
      key: "linhas",
      label: "Mostrar campo",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Linhas de campo" },
        { value: 1, label: "Vetores em grade" },
        { value: 2, label: "Nada" },
      ],
    },
    {
      key: "local",
      label: "Local no globo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Latitude escolhida" },
        { value: 1, label: "Porto Alegre (RS)" },
      ],
    },
    { key: "lat", label: "Latitude magnética λ", unit: "°", min: -89, max: 89, step: 1, default: 45 },
  ],

  observables: [
    { key: "theta", label: "Ângulo da agulha (bússola 1)", unit: "°", value: (s) => (s.comps[0] ? deg(s.comps[0].th) : 0) },
    {
      key: "phiB",
      label: "Direção do campo na bússola 1",
      unit: "°",
      value: (s, p) => {
        const B = firstCompassField(s, p);
        return B ? deg(Math.atan2(B[1], B[0])) : 0;
      },
    },
    {
      key: "desvio",
      label: "Agulha − campo (bússola 1)",
      unit: "°",
      value: (s, p) => {
        const B = firstCompassField(s, p);
        const c = s.comps[0];
        return B && c ? deg(wrapPi(c.th - Math.atan2(B[1], B[0]))) : 0;
      },
    },
    {
      key: "B1",
      label: "|B| na bússola 1",
      unit: "μT",
      value: (s, p) => {
        const B = firstCompassField(s, p);
        return B ? Math.hypot(B[0], B[1]) * 1e6 : 0;
      },
    },
    { key: "incl", label: "Agulha de inclinação", unit: "°", value: (s) => deg(s.dip.th) },
    { key: "Idip", label: "Inclinação do dipolo I", unit: "°", value: (s) => dipInclination(s.lat) },
    { key: "BTerra", label: "Campo da Terra (dipolo)", unit: "μT", value: (s) => earthComponents(s.lat).F * 1e6 },
    { key: "latm", label: "Latitude magnética", unit: "°", value: (s) => s.lat },
  ],
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "um-ima",
      label: "Mapeando um ímã",
      params: { vista: 0, arranjo: 0, bussolas: 1, BT: 18, linhas: 0, modelo: 0 },
      guide: `### Mapeando o campo de um ímã
1. Rode a simulação: cada bússola gira, oscila e para alinhada ao campo **local** $\\vec B = \\vec B_{\\text{ímã}} + \\vec B_{\\text{Terra}}$.
2. Observe para onde aponta a ponta **vermelha** (norte) das agulhas perto de cada polo do ímã.
3. Longe do ímã as agulhas voltam a apontar para o norte geográfico ($+y$): ali o campo da Terra domina. Onde $|\\vec B_{\\text{ímã}}| \\approx 18\\ \\mu$T?
4. Arraste o ímã e gire-o pela alça redonda. Troque o modelo para **dipolo pontual**: perto do ímã os dois modelos diferem; longe, coincidem.`,
      predict: [
        {
          question: "A ponta norte da agulha de uma bússola colocada logo à direita do polo N de um ímã aponta:",
          options: ["para o polo N do ímã", "para longe do polo N do ímã", "para o norte geográfico, sem mudar"],
          answer: 1,
          explanation:
            "As linhas de campo saem do polo N do ímã e a agulha se alinha a $\\vec B$. Polos iguais se repelem: o polo norte da agulha é empurrado para longe do N do ímã. Por isso o norte geográfico da Terra é, magneticamente, um polo **sul**.",
        },
      ],
    },
    {
      id: "dois-imas",
      label: "Dois ímãs: ponto neutro",
      params: { vista: 0, arranjo: 2, bussolas: 0, BT: 0, linhas: 0, modelo: 0 },
      guide: `### Polos iguais frente a frente
1. Com o campo da Terra desligado, a bússola entre os dois polos N fica sem direção preferida no ponto médio: ali $\\vec B = 0$ (**ponto neutro**).
2. Arraste a bússola ao longo do eixo e pela mediatriz e veja como a direção muda.
3. Ligue o campo da Terra ($B_T \\neq 0$): o ponto neutro se desloca para onde $\\vec B_{\\text{ímãs}} = -\\vec B_{\\text{Terra}}$.
4. Troque para o arranjo **em fila** e compare as linhas: agora elas passam de um ímã para o outro (atração).`,
      predict: [
        {
          question: "No ponto médio entre dois polos N idênticos frente a frente (sem campo da Terra), o campo é:",
          options: ["o dobro do campo de um só ímã", "nulo", "perpendicular ao eixo"],
          answer: 1,
          explanation: "Por simetria, os campos dos dois ímãs têm o mesmo módulo e sentidos opostos no ponto médio: a soma é zero.",
        },
      ],
    },
    {
      id: "globo",
      label: "Inclinação e latitude",
      params: { vista: 1, local: 0, lat: 45, gamma: 2 },
      guide: `### A agulha de inclinação
Uma agulha livre para girar num plano **vertical** norte–sul se alinha ao campo total da Terra, que tem uma componente horizontal $H$ e uma vertical $Z$.
1. No dipolo geocêntrico, $H = B_0\\cos\\lambda_m$ e $Z = 2B_0\\,\\mathrm{sen}\\,\\lambda_m$, logo $\\tan I = Z/H = 2\\tan\\lambda_m$.
2. Arraste o ponto sobre o globo e anote $I$ para $\\lambda_m = 0°, 30°, 60°, 90°$. Confira com a fórmula.
3. No hemisfério sul $I < 0$: a ponta norte da agulha aponta **para cima**.
4. Note que $I$ cresce mais rápido que $\\lambda_m$ em latitudes baixas: em $\\lambda_m = 30°$ já temos $I \\approx 49°$.`,
      predict: [
        {
          question: "No equador magnético ($\\lambda_m = 0$), a agulha de inclinação fica:",
          options: ["vertical", "horizontal", "inclinada 45°"],
          answer: 1,
          explanation: "Com $\\lambda_m = 0$, $Z = 0$ e $\\tan I = 0$: o campo é horizontal e a agulha também.",
        },
      ],
    },
    {
      id: "porto-alegre",
      label: "Porto Alegre",
      params: { vista: 1, local: 1, gamma: 2 },
      guide: `### O campo em Porto Alegre
Porto Alegre fica em latitude geográfica $\\approx -30°$, mas o eixo do dipolo da Terra é inclinado cerca de $9°$: a latitude **magnética** é $\\lambda_m \\approx -21°$.
1. O dipolo inclinado prevê $I = \\arctan(2\\tan\\lambda_m) \\approx -38°$. O **valor medido aproximado** é $I \\approx -36°$: o dipolo explica bem a inclinação.
2. A declinação prevista pelo dipolo é só $\\approx -4°$, mas a medida é $D \\approx -15°$ (a agulha aponta 15° a oeste do norte geográfico). A diferença vem das partes **não dipolares** do campo.
3. O campo total medido ($\\approx 23\\ \\mu$T) é bem menor que o do dipolo ($\\approx 35\\ \\mu$T): Porto Alegre está na borda da **Anomalia Magnética do Atlântico Sul**.`,
    },
  ],

  exercises: [
    {
      id: "inclinacao",
      prompt: "No modelo de dipolo geocêntrico, qual é a inclinação magnética (em módulo) num ponto de latitude magnética {lat}°?",
      vary: { lat: [5, 80, 0] },
      fixed: { vista: 1, local: 0 },
      answer: { label: "|I|", unit: "°", compute: (p) => Math.abs(dipInclination(num(p, "lat"))) },
      hint: "tan I = 2 tan λ.",
    },
    {
      id: "gauss-a",
      prompt:
        "Um ímã de momento magnético {m} A·m² está a {r} cm a leste de uma bússola, com seu eixo na direção leste–oeste. A componente horizontal do campo da Terra vale {BT} μT. Tratando o ímã como dipolo pontual, de quantos graus a agulha se desvia do norte?",
      vary: { m: [0.1, 1, 2], r: [15, 30, 0], BT: [15, 30, 0] },
      fixed: { modelo: 1 },
      answer: {
        label: "desvio",
        unit: "°",
        compute: (p) => {
          const Bm = (2e-7 * num(p, "m")) / (num(p, "r") / 100) ** 3;
          return deg(Math.atan(Bm / (num(p, "BT") * 1e-6)));
        },
      },
      hint: "No eixo do dipolo, B = (μ₀/4π)·2m/r³, perpendicular ao campo da Terra: tan δ = B_ímã/B_Terra.",
    },
  ],

  init(p) {
    const mags = arrangement(Math.round(num(p, "arranjo")));
    return { mags, comps: initialCompasses(Math.round(num(p, "bussolas")), mags), dip: { th: 0, w: 0 }, lat: initLat(p), drag: null };
  },

  step(s, p, _t, dt) {
    const gamma = num(p, "gamma", 2);
    const comps = s.comps.map((c) => {
      // Enquanto é arrastada, a agulha continua livre: o campo muda e ela segue.
      const B = fieldAt(s, p, c.x, c.y);
      const [th, w] = needleStep(c.th, c.w, Math.hypot(B[0], B[1]), Math.atan2(B[1], B[0]), gamma, dt);
      return { ...c, th, w };
    });
    const e = earthComponents(s.lat);
    const [dth, dw] = needleStep(s.dip.th, s.dip.w, e.F, Math.atan2(e.Z, e.H), gamma, dt);
    return { ...s, comps, dip: { th: dth, w: dw } };
  },
  dt: 2e-3,
  sampleEvery: 10,
  maxSamples: 4000,
  tEnd: 120,

  pointer: {
    down(s, p, pt) {
      if (vista(p) === 1) {
        if (Math.round(num(p, "local")) === 1) return undefined;
        const l = (s.lat * Math.PI) / 180;
        if (Math.hypot(pt.x - Math.cos(l), pt.y - Math.sin(l)) < 0.3) return { ...s, drag: { kind: "lat", i: 0, dx: 0, dy: 0 } };
        return undefined;
      }
      for (let i = s.mags.length - 1; i >= 0; i--) {
        const g = s.mags[i]!;
        const hx = g.x + HANDLE * Math.cos(g.ang);
        const hy = g.y + HANDLE * Math.sin(g.ang);
        if (Math.hypot(pt.x - hx, pt.y - hy) < 0.012) return { ...s, drag: { kind: "rot", i, dx: 0, dy: 0 } };
      }
      for (let i = s.comps.length - 1; i >= 0; i--) {
        const c = s.comps[i]!;
        if (Math.hypot(pt.x - c.x, pt.y - c.y) < COMP_R * 1.2) return { ...s, drag: { kind: "comp", i, dx: c.x - pt.x, dy: c.y - pt.y } };
      }
      for (let i = s.mags.length - 1; i >= 0; i--) {
        const g = s.mags[i]!;
        if (distToMagnet(g, pt.x, pt.y) < 0.004) return { ...s, drag: { kind: "mag", i, dx: g.x - pt.x, dy: g.y - pt.y } };
      }
      return undefined;
    },
    move(s, _p, pt, dragging) {
      const d = s.drag;
      if (!dragging || !d) return undefined;
      const cx = (x: number) => clamp(x, BENCH.xMin + 0.01, BENCH.xMax - 0.01);
      const cy = (y: number) => clamp(y, BENCH.yMin + 0.01, BENCH.yMax - 0.01);
      if (d.kind === "lat") {
        const lat = clamp((Math.atan2(pt.y, Math.max(Math.abs(pt.x), 1e-6)) * 180) / Math.PI, -89, 89);
        return { ...s, lat };
      }
      if (d.kind === "comp") {
        return { ...s, comps: s.comps.map((c, i) => (i === d.i ? { ...c, x: cx(pt.x + d.dx), y: cy(pt.y + d.dy) } : c)) };
      }
      return {
        ...s,
        mags: s.mags.map((g, i) => {
          if (i !== d.i) return g;
          if (d.kind === "rot") return { ...g, ang: Math.atan2(pt.y - g.y, pt.x - g.x) };
          return { ...g, x: cx(pt.x + d.dx), y: cy(pt.y + d.dy) };
        }),
      };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      if (vista(p) === 1) {
        const l = (s.lat * Math.PI) / 180;
        return Math.round(num(p, "local")) !== 1 && Math.hypot(pt.x - Math.cos(l), pt.y - Math.sin(l)) < 0.3 ? "grab" : undefined;
      }
      for (const g of s.mags) {
        if (Math.hypot(pt.x - g.x - HANDLE * Math.cos(g.ang), pt.y - g.y - HANDLE * Math.sin(g.ang)) < 0.012) return "alias";
        if (distToMagnet(g, pt.x, pt.y) < 0.004) return "grab";
      }
      return s.comps.some((c) => Math.hypot(pt.x - c.x, pt.y - c.y) < COMP_R * 1.2) ? "grab" : undefined;
    },
  },

  actions: [
    {
      id: "add-ima",
      label: "Adicionar ímã",
      run: (s) => (s.mags.length >= MAX_MAGS ? s : { ...s, mags: [...s.mags, { x: 0, y: -0.12 + 0.06 * s.mags.length, ang: Math.PI / 2 }] }),
    },
    { id: "rem-ima", label: "Remover ímã", run: (s) => ({ ...s, mags: s.mags.slice(0, -1) }) },
    {
      id: "add-bussola",
      label: "Adicionar bússola",
      run: (s) => (s.comps.length >= MAX_COMPS ? s : { ...s, comps: [...s.comps, { x: 0.24, y: 0.15, th: Math.PI / 2, w: 0 }] }),
    },
    { id: "grade", label: "Espalhar bússolas", run: (s) => ({ ...s, comps: compassGrid(s.mags) }) },
    { id: "limpar", label: "Limpar bússolas", run: (s) => ({ ...s, comps: [] }) },
  ],

  viewport: (p) => (vista(p) === 1 ? { xMin: -2.7, xMax: 6.5, yMin: -2.5, yMax: 2.5, unit: "" } : { ...BENCH, unit: "m" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (vista(frame.params) === 1) renderGlobe(d, frame.state, frame.params);
    else renderBench(d, frame.state, frame.params);
  },
});

export default imasBussola;

// ---------------------------------------------------------------- desenho

function fieldLines(s: ImasState, p: Params): V2[][] {
  const mod = modelo(p);
  const field = (x: number, y: number) => fieldAt(s, p, x, y);
  const m = 0.03;
  const out = (x: number, y: number) => x < BENCH.xMin - m || x > BENCH.xMax + m || y < BENCH.yMin - m || y > BENCH.yMax + m;
  const sPoles = s.mags.map((g) => (mod === 1 ? [g.x, g.y] : [g.x - (Math.cos(g.ang) * POLE_D) / 2, g.y - (Math.sin(g.ang) * POLE_D) / 2]) as V2);
  const sink = mod === 1 ? 0.009 : 0.006;
  const stop = (x: number, y: number) => out(x, y) || sPoles.some(([sx, sy]) => Math.hypot(x - sx, y - sy) < sink);
  const lines: V2[][] = [];
  for (const g of s.mags) {
    const n = mod === 1 ? 20 : 14;
    const r0 = mod === 1 ? 0.012 : 0.007;
    const cx = mod === 1 ? g.x : g.x + (Math.cos(g.ang) * POLE_D) / 2;
    const cy = mod === 1 ? g.y : g.y + (Math.sin(g.ang) * POLE_D) / 2;
    for (let k = 0; k < n; k++) {
      const a = (2 * Math.PI * (k + 0.5)) / n;
      const x0 = cx + r0 * Math.cos(a);
      const y0 = cy + r0 * Math.sin(a);
      const B = field(x0, y0);
      if (B[0] * Math.cos(a) + B[1] * Math.sin(a) <= 0) continue; // só sementes onde o campo sai
      lines.push(traceLine(field, x0, y0, 0.003, 600, stop));
    }
  }
  if (bTerra(p) > 0) {
    for (let x = BENCH.xMin + 0.03; x < BENCH.xMax; x += 0.06) lines.push(traceLine(field, x, BENCH.yMin, 0.003, 400, stop));
  }
  return lines;
}

function drawLines(d: Draw, lines: V2[][], color: string) {
  for (const pts of lines) {
    if (pts.length < 4) continue;
    d.polyline(pts, { color, width: 1.2, alpha: 0.55 });
    const i = Math.floor(pts.length / 2);
    const a = pts[i]!;
    const b = pts[i + 1]!;
    d.arrowPx(a[0], a[1], b[0] - a[0], b[1] - a[1], 8, { color, head: 7, width: 1.2 });
  }
}

function drawMagnet(d: Draw, g: Magnet) {
  const { ctx, theme } = d;
  ctx.save();
  ctx.translate(g.x, g.y);
  ctx.rotate(g.ang);
  d.rect(0, -MAG_W / 2, MAG_L / 2, MAG_W, { fill: theme.positive });
  d.rect(-MAG_L / 2, -MAG_W / 2, MAG_L / 2, MAG_W, { fill: theme.negative });
  d.rect(-MAG_L / 2, -MAG_W / 2, MAG_L, MAG_W, { stroke: theme.text, width: 1 });
  d.line(MAG_L / 2, 0, HANDLE - 0.006, 0, { color: theme.muted, width: 1, dash: [3, 2] });
  d.circle(HANDLE, 0, 0.006, { stroke: theme.text, width: 1.5, fill: theme.dark ? "#1c2430" : "#ffffff" });
  ctx.restore();
  const ux = Math.cos(g.ang);
  const uy = Math.sin(g.ang);
  d.text("N", g.x + ux * MAG_L * 0.3, g.y + uy * MAG_L * 0.3, { color: "#ffffff", size: 12, weight: "700" });
  d.text("S", g.x - ux * MAG_L * 0.3, g.y - uy * MAG_L * 0.3, { color: "#ffffff", size: 12, weight: "700" });
}

function drawNeedle(d: Draw, x: number, y: number, th: number, len: number, width = 0.18) {
  const ux = Math.cos(th);
  const uy = Math.sin(th);
  const nx = -uy * len * width;
  const ny = ux * len * width;
  d.polyline(
    [
      [x + ux * len, y + uy * len],
      [x + nx, y + ny],
      [x - nx, y - ny],
    ],
    { close: true, fill: d.theme.positive, color: "none" },
  );
  d.polyline(
    [
      [x - ux * len, y - uy * len],
      [x + nx, y + ny],
      [x - nx, y - ny],
    ],
    { close: true, fill: d.theme.muted, color: "none" },
  );
  d.dot(x, y, 2, d.theme.text);
}

function renderBench(d: Draw, s: ImasState, p: Params) {
  const { theme } = d;
  d.grid(BENCH.xMin, BENCH.xMax, BENCH.yMin, BENCH.yMax, 0.05);
  const mode = Math.round(num(p, "linhas"));
  if (mode === 0) drawLines(d, fieldLines(s, p), theme.accent);
  else if (mode === 1) {
    for (let x = BENCH.xMin + 0.02; x < BENCH.xMax; x += 0.04)
      for (let y = BENCH.yMin + 0.02; y < BENCH.yMax; y += 0.04) {
        if (s.mags.some((g) => distToMagnet(g, x, y) < 0.004)) continue;
        const B = fieldAt(s, p, x, y);
        const b = Math.hypot(B[0], B[1]);
        if (b < 1e-9) continue;
        const len = clamp(4 + 5 * Math.log10(b / 1e-6), 4, 18);
        d.arrowPx(x - (B[0] / b) * 0.5 * len * d.px, y - (B[1] / b) * 0.5 * len * d.px, B[0], B[1], len, { color: theme.accent, head: 5, width: 1.2, alpha: 0.8 });
      }
  }
  for (const g of s.mags) drawMagnet(d, g);
  for (const c of s.comps) {
    d.circle(c.x, c.y, COMP_R, { fill: theme.dark ? "rgba(30,36,48,0.85)" : "rgba(255,255,255,0.85)", stroke: theme.muted, width: 1 });
    drawNeedle(d, c.x, c.y, c.th, COMP_R * 0.85);
  }
  const c0 = s.comps[0];
  if (c0) d.text("1", c0.x + COMP_R * 1.1, c0.y + COMP_R * 1.1, { color: theme.muted, size: 10, align: "left" });

  // Rosa dos ventos: norte geográfico e campo da Terra
  const bt = num(p, "BT", 18);
  const rx = BENCH.xMax - 0.025;
  const ry = BENCH.yMax - 0.06;
  d.arrowPx(rx, ry - 0.02, 0, 1, 36, { color: theme.text, width: 1.5 });
  d.text("N", rx, ry + 0.035, { color: theme.text, size: 11, weight: "700" });
  d.text(bt > 0 ? `B_Terra = ${String(bt).replace(".", ",")} μT` : "Terra desligada", rx - 0.012, ry - 0.03, { color: theme.muted, size: 10, align: "right" });
  d.text("Arraste ímãs e bússolas; gire o ímã pela alça redonda", BENCH.xMin + 0.005, BENCH.yMin + 0.01, { color: theme.muted, size: 10, align: "left", baseline: "bottom" });
}

function renderGlobe(d: Draw, s: ImasState, p: Params) {
  const { theme } = d;
  const fmt = (v: number, n = 1) => v.toFixed(n).replace(".", ",").replace("-", "−");
  // Linhas de campo do dipolo: r = L cos²λ (fora da Terra)
  for (const L of [1.5, 2.1, 3.0, 4.4]) {
    for (const side of [1, -1]) {
      const lim = Math.acos(Math.sqrt(1 / L));
      // Partes fora do quadro são cortadas: a linha vira vários trechos.
      let pts: V2[] = [];
      for (let i = 0; i <= 160; i++) {
        const l = -lim + (2 * lim * i) / 160;
        const r = L * Math.cos(l) ** 2;
        const x = side * r * Math.cos(l);
        const y = r * Math.sin(l);
        if (Math.abs(x) <= 2.65 && Math.abs(y) <= 2.45) pts.push([x, y]);
        else {
          d.polyline(pts, { color: theme.accent, width: 1.2, alpha: 0.5 });
          pts = [];
        }
      }
      d.polyline(pts, { color: theme.accent, width: 1.2, alpha: 0.5 });
      // Campo da Terra aponta para o norte no equador magnético
      if (L <= 2.6) d.arrowPx(side * L, -0.01, 0, 1, 10, { color: theme.accent, head: 7, width: 1.2 });
    }
  }
  d.circle(0, 0, 1, { fill: theme.dark ? "#1f3a52" : "#cfe3f2", stroke: theme.muted, width: 1.2 });
  d.line(-1, 0, 1, 0, { color: theme.muted, width: 1, dash: [4, 3] });
  d.text("equador magnético", -0.95, 0.08, { color: theme.muted, size: 10, align: "left" });
  // Ímã fictício: o polo S fica no norte geográfico
  d.rect(-0.07, 0.05, 0.14, 0.4, { fill: theme.negative, alpha: 0.85 });
  d.rect(-0.07, -0.45, 0.14, 0.4, { fill: theme.positive, alpha: 0.85 });
  d.text("S", 0, 0.3, { color: "#ffffff", size: 11, weight: "700" });
  d.text("N", 0, -0.3, { color: "#ffffff", size: 11, weight: "700" });
  d.text("Norte geográfico", 0, 1.12, { color: theme.text, size: 11, baseline: "bottom" });
  d.text("Sul geográfico", 0, -1.12, { color: theme.text, size: 11, baseline: "top" });

  // Ponto de observação e campo local
  const l = (s.lat * Math.PI) / 180;
  const px = Math.cos(l);
  const py = Math.sin(l);
  const e = earthComponents(s.lat);
  const north: V2 = [-Math.sin(l), Math.cos(l)];
  const down: V2 = [-Math.cos(l), -Math.sin(l)];
  d.line(px - north[0] * 0.5, py - north[1] * 0.5, px + north[0] * 0.5, py + north[1] * 0.5, { color: theme.muted, width: 1, dash: [3, 3] });
  const bx = e.H * north[0] + e.Z * down[0];
  const by = e.H * north[1] + e.Z * down[1];
  const lenPx = 34 + 10 * (e.F / B0_EARTH);
  d.arrowPx(px, py, bx, by, lenPx, { color: theme.series[1] ?? theme.accent, width: 2.5 });
  d.dot(px, py, 6, theme.series[2] ?? theme.accent);
  const lab = (lenPx + 10) * d.px;
  d.text("B", px + (bx / e.F) * lab, py + (by / e.F) * lab, { color: theme.series[1] ?? theme.accent, size: 12, weight: "700" });
  const isPoa = Math.round(num(p, "local")) === 1;
  d.text(isPoa ? "Porto Alegre" : "arraste", px + 0.12, py + 0.12, { color: theme.muted, size: 10, align: "left" });

  // Painel da agulha de inclinação
  const { x: cx, y: cy, r } = DIP;
  d.circle(cx, cy, r, { stroke: theme.muted, width: 1.2 });
  d.line(cx - r * 1.15, cy, cx + r * 1.15, cy, { color: theme.muted, width: 1 });
  d.text("Agulha de inclinação (plano vertical norte–sul)", cx, cy + r + 0.3, { color: theme.text, size: 11, weight: "600", baseline: "bottom" });
  d.text("horizontal (norte →)", cx, cy + r + 0.08, { color: theme.muted, size: 10, baseline: "bottom" });
  const I = dipInclination(s.lat);
  const Ir = (I * Math.PI) / 180;
  // Arco teórico de I (desenhado com y para cima: abaixo da horizontal é −)
  const arc: V2[] = [];
  for (let i = 0; i <= 30; i++) {
    const a = (-Ir * i) / 30;
    arc.push([cx + 0.45 * r * Math.cos(a), cy + 0.45 * r * Math.sin(a)]);
  }
  d.polyline(arc, { color: theme.series[1] ?? theme.accent, width: 1.5 });
  d.line(cx, cy, cx + r * Math.cos(-Ir), cy + r * Math.sin(-Ir), { color: theme.series[1] ?? theme.accent, width: 1, dash: [4, 3] });
  drawNeedle(d, cx, cy, -s.dip.th, r * 0.9, 0.07);
  d.text(`I = ${fmt(I)}°`, cx + 0.5 * r * Math.cos(-Ir / 2), cy + 0.5 * r * Math.sin(-Ir / 2), { color: theme.series[1] ?? theme.accent, size: 12, weight: "600", align: "left", dx: 6 });

  const lines: string[] = [`λ magnética = ${fmt(s.lat)}°   |B| (dipolo) = ${fmt(e.F * 1e6)} μT`, `tan I = 2 tan λ  →  I = ${fmt(I)}°`];
  if (isPoa) {
    lines.push(`Latitude geográfica: ${fmt(POA.lat)}°`, `Dipolo inclinado prevê D ≈ ${fmt(dipoleDeclination(POA.lat, POA.lon))}°`);
    lines.push("Valor medido aproximado:", `I ≈ ${fmt(POA_MEDIDO.inclinacao, 0)}°, D ≈ ${fmt(POA_MEDIDO.declinacao, 0)}°, |B| ≈ ${fmt(POA_MEDIDO.F * 1e6, 0)} μT`);
  }
  lines.forEach((t, i) =>
    d.text(t, 2.8, -0.4 - i * 0.3, { color: i >= 4 ? theme.text : theme.muted, size: 11, align: "left", weight: i >= 4 ? "600" : "400" }),
  );
}
