import { clamp, defineSim, draw, formatBR, num, rk4, rng, texNum, type Draw, type Params, type State } from "@fisilab/core";
import {
  BODIES,
  C_ICE,
  C_STEAM,
  C_WATER,
  L_F,
  L_V,
  bodySub,
  enthalpy,
  enthalpyFromT,
  equilibrium,
  heatingSub,
  phaseOf,
  waterSub,
  type Sub,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: modo 0 → [H, t_físico, 0]; modo 1 → [H_corpo, t_físico, H_água+calorímetro]
const H = 0, TF = 1, HW = 2;
const at = (s: State, i: number) => s[i] ?? 0;
const modeOf = (p: Params) => Math.round(num(p, "modo", 0));
const ritmo = (p: Params) => num(p, "ritmo", 20);
/** Temperatura em que a curva de aquecimento termina. */
export const T_STOP = 130;

export const waterInitH = (p: Params) => {
  const s = waterSub(p);
  const Ta = num(p, "Ta", 20);
  return enthalpy(s, Ta, Ta <= 0 ? "hi" : "lo");
};
export const bodyInitH = (p: Params) => enthalpyFromT(bodySub(p), num(p, "Tb", -10));

/** Equilíbrio previsto da mistura no calorímetro (sem perdas). */
export function mixEquilibrium(p: Params) {
  return equilibrium([bodySub(p), waterSub(p)], bodyInitH(p) + waterInitH(p));
}

function temps(s: State, p: Params) {
  if (modeOf(p) === 0) {
    const ph = phaseOf(heatingSub(p), at(s, H));
    return { T: ph.T, ph, Tb: ph.T, phB: ph };
  }
  const w = phaseOf(waterSub(p), at(s, HW));
  const b = phaseOf(bodySub(p), at(s, H));
  return { T: w.T, ph: w, Tb: b.T, phB: b };
}

const bodyName = (p: Params) => {
  const k = Math.round(num(p, "corpo", 0));
  if (k !== 0) return BODIES.find((b) => b.value === k)?.label ?? "corpo";
  const T = num(p, "Tb", -10);
  return T <= 0 ? "Gelo" : T >= 100 ? "Vapor d'água" : "Água";
};

/** Bolhas e cubos de gelo em posições fixas. */
const BUBBLES = (() => {
  const r = rng(9);
  return Array.from({ length: 24 }, () => ({ x: r(), ph: r(), s: 0.6 + r() * 0.8 }));
})();

export const calorimetria = defineSim({
  id: "calorimetria",
  title: "Calorimetria e mudanças de fase",
  course: "FG II",
  topic: "Calor e temperatura",
  priority: "P1",
  summary:
    "Aqueça gelo com potência constante e veja os patamares de fusão e ebulição na curva de aquecimento. Misture corpos num calorímetro com capacidade térmica própria e encontre a temperatura de equilíbrio, inclusive quando sobra gelo.",
  equations: [
    String.raw`Q = m c\,\Delta T \qquad Q = m L \qquad C_{\text{cal}}\ \text{(equivalente do calorímetro)}`,
    String.raw`\sum_i Q_i = 0 \;\Rightarrow\; T_{\text{eq}} = \frac{\sum_i m_i c_i T_i}{\sum_i m_i c_i}\ \text{(sem mudança de fase)}`,
    String.raw`\frac{dQ_{\text{corpo}}}{dt} = k\,(T_{\text{água}} - T_{\text{corpo}}) \qquad L_F = 334\ \text{kJ/kg} \quad L_V = 2256\ \text{kJ/kg}`,
  ],
  liveEquations(s, p) {
    if (modeOf(p) === 0) {
      const sub = heatingSub(p);
      const { ph } = temps(s, p);
      const Q = at(s, H) - enthalpyFromT(sub, num(p, "T0", -20));
      const stage = ph.T < 0 ? "aquecendo o gelo" : ph.T === 0 ? "fundindo" : ph.T < 100 ? "aquecendo a água" : ph.T === 100 ? "fervendo" : "aquecendo o vapor";
      return [
        String.raw`Q = P\,t = ${texNum(num(p, "P", 1500))}\ \text{W} \times ${texNum(at(s, TF))}\ \text{s} = ${texNum(Q / 1000)}\ \text{kJ} \qquad T = ${texNum(ph.T)}\ ^\circ\text{C}\ \text{(${stage})}`,
        String.raw`m L_F = ${texNum((sub.m * L_F) / 1000)}\ \text{kJ} \qquad m L_V = ${texNum((sub.m * L_V) / 1000)}\ \text{kJ}`,
      ];
    }
    const eq = mixEquilibrium(p);
    const w = waterSub(p), b = bodySub(p);
    const { T, Tb } = temps(s, p);
    const parts = [String.raw`T_{\text{água}} = ${texNum(T)}\ ^\circ\text{C}`, String.raw`T_{\text{corpo}} = ${texNum(Tb)}\ ^\circ\text{C}`, String.raw`T_{\text{eq}} = ${texNum(eq.T)}\ ^\circ\text{C}`];
    const lines = [parts.join(String.raw`\qquad `)];
    if (b.c > 0) {
      const Ta = num(p, "Ta", 20), Tb0 = num(p, "Tb", 100);
      lines.push(
        String.raw`T_{\text{eq}} = \frac{(${texNum(w.m)}\cdot${C_WATER} + ${texNum(w.C)})\cdot${texNum(Ta)} + ${texNum(b.m)}\cdot${b.c}\cdot${texNum(Tb0)}}{${texNum(w.m)}\cdot${C_WATER} + ${texNum(w.C)} + ${texNum(b.m)}\cdot${b.c}}`,
      );
    } else if (eq.iceLeft > 0 && eq.T === 0) lines.push(String.raw`\text{Sobra gelo: } ${texNum(eq.iceLeft * 1000)}\ \text{g a } 0\ ^\circ\text{C}`);
    return lines;
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
        { value: 0, label: "Curva de aquecimento (potência constante)" },
        { value: 1, label: "Mistura no calorímetro" },
      ],
    },
    {
      key: "ritmo",
      label: "Tempo simulado por segundo",
      unit: "×",
      min: 1,
      max: 200,
      step: 1,
      default: 20,
      live: true,
      options: [
        { value: 1, label: "1× (tempo real)" },
        { value: 5, label: "5×" },
        { value: 20, label: "20×" },
        { value: 50, label: "50×" },
        { value: 200, label: "200×" },
      ],
    },
    { key: "m", label: "Aquecimento: massa de gelo", unit: "kg", min: 0.05, max: 2, step: 0.05, default: 0.5 },
    { key: "T0", label: "Aquecimento: temperatura inicial do gelo", unit: "°C", min: -40, max: 0, step: 1, default: -20 },
    { key: "P", label: "Aquecimento: potência do aquecedor", unit: "W", min: 100, max: 5000, step: 50, default: 1500, live: true },
    { key: "ma", label: "Calorímetro: massa de água", unit: "kg", min: 0.05, max: 1, step: 0.01, default: 0.2 },
    { key: "Ta", label: "Calorímetro: temperatura da água", unit: "°C", min: 0, max: 95, step: 1, default: 30 },
    { key: "Ccal", label: "Calorímetro: capacidade térmica do recipiente", unit: "J/K", min: 0, max: 500, step: 5, default: 80 },
    { key: "corpo", label: "Corpo adicionado", unit: "", min: 0, max: 4, step: 1, default: 0, options: BODIES.map((b) => ({ value: b.value, label: b.label })) },
    { key: "mb", label: "Massa do corpo", unit: "kg", min: 0.005, max: 1, step: 0.005, default: 0.05 },
    { key: "Tb", label: "Temperatura inicial do corpo", unit: "°C", min: -40, max: 300, step: 1, default: -10 },
    { key: "k", label: "Condutância corpo–água", unit: "W/K", min: 1, max: 50, step: 1, default: 10 },
    { key: "kamb", label: "Perdas para o ambiente (25 °C)", unit: "W/K", min: 0, max: 2, step: 0.05, default: 0, live: true },
  ],

  observables: [
    { key: "T", label: "Temperatura (água / substância)", unit: "°C", value: (s, p) => temps(s, p).T },
    { key: "Tb", label: "Temperatura do corpo", unit: "°C", value: (s, p) => temps(s, p).Tb },
    {
      key: "Q",
      label: "Calor recebido (substância / corpo)",
      unit: "kJ",
      value: (s, p) => (at(s, H) - (modeOf(p) === 0 ? enthalpyFromT(heatingSub(p), num(p, "T0", -20)) : bodyInitH(p))) / 1000,
    },
    { key: "fl", label: "Fração líquida", unit: "", value: (s, p) => temps(s, p).phB.liquid },
    { key: "fv", label: "Fração vaporizada", unit: "", value: (s, p) => temps(s, p).phB.vapor },
    { key: "tf", label: "Tempo físico", unit: "s", value: (s) => at(s, TF) },
    { key: "Htot", label: "Energia total no calorímetro", unit: "kJ", value: (s, p) => (modeOf(p) === 1 ? (at(s, H) + at(s, HW)) / 1000 : 0) },
  ],
  conserved: "Htot",
  chart: { x: "tf", y: "T" },

  scenarios: [
    {
      id: "aquecimento",
      label: "Gelo até vapor",
      params: { modo: 0, m: 0.5, T0: -20, P: 1500, ritmo: 50 },
      guide: `### Patamares de mudança de fase
1. Rode e acompanhe o gráfico $T \\times t$ (com potência constante, o eixo do tempo é proporcional ao calor fornecido).
2. Nos **patamares** a temperatura não muda: todo o calor vai para a mudança de fase. Meça a duração do patamar de fusão e confira $m L_F / P$.
3. Compare as inclinações das rampas do gelo, da água e do vapor: $dT/dt = P/(mc)$. Qual fase esquenta mais devagar?
4. Por que o patamar de ebulição é quase 7 vezes mais longo que o de fusão?`,
      predict: [
        {
          question: "Enquanto o gelo derrete, com o aquecedor ligado, a temperatura da mistura gelo–água:",
          options: ["sobe devagar", "fica em 0 °C", "cai"],
          answer: 1,
          explanation: "O calor recebido rompe a estrutura do gelo (calor latente $L_F$) sem aumentar a energia cinética média: $T$ fica em 0 °C até o último pedaço derreter.",
        },
      ],
    },
    {
      id: "metal",
      label: "Cobre quente na água",
      params: { modo: 1, ma: 0.2, Ta: 20, Ccal: 80, corpo: 1, mb: 0.3, Tb: 100, k: 10, kamb: 0, ritmo: 20 },
      guide: `### Equilíbrio térmico com calorímetro
1. Antes de rodar, calcule $T_{eq}$ com o balanço $\\sum Q = 0$, incluindo o calorímetro ($C = 80$ J/K).
2. Rode: as duas temperaturas convergem para $T_{eq}$ e a energia total fica constante.
3. Zere $C_{\\text{cal}}$ e veja quanto $T_{eq}$ muda: desprezar o recipiente é um erro sistemático.
4. Ligue as perdas para o ambiente: a energia total deixa de se conservar.`,
      predict: [
        {
          question: "300 g de cobre a 100 °C em 200 g de água a 20 °C. A temperatura final fica:",
          options: ["perto de 60 °C (a média)", "bem mais perto de 20 °C", "bem mais perto de 100 °C"],
          answer: 1,
          explanation: "A capacidade térmica do cobre ($0{,}3 \\times 385 \\approx 116$ J/K) é bem menor que a da água ($0{,}2 \\times 4186 \\approx 837$ J/K): quem tem mais capacidade térmica \"puxa\" o equilíbrio.",
        },
      ],
    },
    {
      id: "gelo",
      label: "Gelo que não derrete todo",
      params: { modo: 1, ma: 0.2, Ta: 30, Ccal: 80, corpo: 0, mb: 0.15, Tb: -10, k: 10, kamb: 0, ritmo: 20 },
      guide: `### Quando sobra gelo
1. Calcule o calor que a água e o calorímetro liberam esfriando até 0 °C e compare com o necessário para aquecer o gelo até 0 °C e derretê-lo todo.
2. Se não for suficiente, o equilíbrio é **0 °C com gelo e água**. Quanto gelo sobra?
3. Rode e confira a fração líquida do corpo no fim. Depois diminua a massa de gelo até derreter tudo.`,
    },
    {
      id: "vapor",
      label: "Vapor condensando",
      params: { modo: 1, ma: 0.3, Ta: 20, Ccal: 50, corpo: 0, mb: 0.02, Tb: 100, k: 10, kamb: 0, ritmo: 20 },
      guide: `### Queimadura de vapor
Só 20 g de vapor a 100 °C aquecem bastante 300 g de água: ao condensar, cada quilograma libera $L_V = 2256$ kJ, além do calor sensível. Compare com 20 g de água líquida a 100 °C (troque $T_b$ para 99 °C).`,
    },
  ],

  exercises: [
    {
      id: "metal",
      prompt:
        "Um bloco de cobre (c = 385 J/kg·K) de {mb} kg a {Tb} °C é colocado em {ma} kg de água a {Ta} °C dentro de um calorímetro de capacidade térmica {Ccal} J/K. Qual é a temperatura de equilíbrio? (c_água = 4186 J/kg·K)",
      vary: { mb: [0.1, 0.5, 2], Tb: [80, 200, 0], ma: [0.1, 0.4, 2], Ta: [15, 25, 0], Ccal: [20, 150, 0] },
      fixed: { modo: 1, corpo: 1 },
      answer: {
        label: "T_eq",
        unit: "°C",
        compute: (p) => {
          const cw = num(p, "ma") * C_WATER + num(p, "Ccal");
          const cb = num(p, "mb") * 385;
          return (cw * num(p, "Ta") + cb * num(p, "Tb")) / (cw + cb);
        },
      },
      tolerance: 0.01,
    },
    {
      id: "gelo",
      prompt:
        "Coloca-se {mb} kg de gelo a 0 °C em {ma} kg de água a {Ta} °C, num recipiente isolado de capacidade térmica desprezível. Quantos gramas de gelo derretem? (c_água = 4186 J/kg·K, L_F = 334 kJ/kg)",
      vary: { mb: [0.15, 0.3, 2], ma: [0.1, 0.3, 2], Ta: [10, 30, 0] },
      fixed: { modo: 1, corpo: 0, Tb: 0, Ccal: 0 },
      answer: { label: "m_derretida", unit: "g", compute: (p) => (1000 * num(p, "ma") * C_WATER * num(p, "Ta")) / L_F },
      hint: "Verifique primeiro se o calor da água esfriando até 0 °C basta para derreter todo o gelo.",
    },
    {
      id: "curva",
      prompt: "Quanto calor é preciso para transformar {m} kg de gelo a {T0} °C em vapor a 100 °C? (c_gelo = 2100 J/kg·K, c_água = 4186 J/kg·K, L_F = 334 kJ/kg, L_V = 2256 kJ/kg)",
      vary: { m: [0.1, 2, 2], T0: [-30, -5, 0] },
      fixed: { modo: 0 },
      answer: { label: "Q", unit: "kJ", compute: (p) => (num(p, "m") * (C_ICE * -num(p, "T0") + L_F + C_WATER * 100 + L_V)) / 1000 },
    },
  ],

  init(p) {
    if (modeOf(p) === 0) return [enthalpyFromT(heatingSub(p), num(p, "T0", -20)), 0, 0];
    return [bodyInitH(p), 0, waterInitH(p)];
  },
  step(s, p, t, dt) {
    const r = ritmo(p);
    if (modeOf(p) === 0) return [at(s, H) + num(p, "P", 1500) * r * dt, at(s, TF) + r * dt, 0];
    const b = bodySub(p), w = waterSub(p);
    const k = num(p, "k", 10), ka = num(p, "kamb", 0);
    const f = (y: State) => {
      const Tb = phaseOf(b, at(y, 0)).T;
      const Tw = phaseOf(w, at(y, 2)).T;
      const q = k * (Tw - Tb);
      return [q * r, r, (-q - ka * (Tw - 25)) * r];
    };
    // Subpassos: o passo físico (dt × ritmo) fica bem abaixo da menor constante de tempo C/k.
    const capMin = (x: Sub) => (x.c > 0 ? x.m * x.c : x.m * C_STEAM) + x.C;
    const tau = Math.min(capMin(b), capMin(w)) / (k + ka);
    const n = Math.max(1, Math.ceil((dt * r) / (0.2 * tau)));
    let y = s;
    for (let i = 0; i < n; i++) y = rk4(f, y, p, t + (i * dt) / n, dt / n);
    return y;
  },
  dt: 0.01,
  sampleEvery: 5,
  stopWhen: (s, p) => (modeOf(p) === 0 ? T_STOP - phaseOf(heatingSub(p), at(s, H)).T : 1),

  narrowSplit: () => 0.419,
  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (modeOf(frame.params) === 0) renderHeating(d, frame.state, frame.params, frame.t);
    else renderMix(d, frame.state, frame.params, frame.t);
  },
});

/** Cor da temperatura: azul (frio) → vermelho (quente). */
function tempColor(T: number) {
  const u = clamp((T + 20) / 140, 0, 1);
  return `rgb(${Math.round(60 + 190 * u)}, ${Math.round(120 - 50 * u)}, ${Math.round(230 - 180 * u)})`;
}

function thermometer(d: Draw, x: number, y0: number, y1: number, T: number, label: string, Tmin = -40, Tmax = 140) {
  const { theme } = d;
  d.rect(x - 0.12, y0, 0.24, y1 - y0, { stroke: theme.text, width: 1.5 });
  const u = clamp((T - Tmin) / (Tmax - Tmin), 0, 1);
  d.rect(x - 0.07, y0, 0.14, u * (y1 - y0), { fill: theme.positive });
  d.circle(x, y0 - 0.12, 0.2, { fill: theme.positive });
  for (const tt of [0, 100]) {
    const yy = y0 + ((tt - Tmin) / (Tmax - Tmin)) * (y1 - y0);
    d.line(x + 0.12, yy, x + 0.3, yy, { color: theme.muted });
    d.text(`${tt}`, x + 0.35, yy, { align: "left", size: 10, color: theme.muted });
  }
  d.text(`${label} ${formatBR(T, 3)} °C`, x, y1 + 0.3, { size: 12, weight: "600" });
}

function renderHeating(d: Draw, s: State, p: Params, t: number) {
  const { theme } = d;
  const sub = heatingSub(p);
  const T0 = num(p, "T0", -20);
  const H0 = enthalpyFromT(sub, T0);
  const ph = phaseOf(sub, at(s, H));
  // Béquer
  const bx0 = 1.2, bx1 = 4.8, by0 = 1.6, by1 = 6.4;
  const ice = Math.max(0, 1 - ph.liquid - ph.vapor) < 1e-9 ? 0 : Math.max(0, 1 - ph.liquid - ph.vapor);
  const liquid = ph.liquid;
  const level = by0 + 0.1 + 2.4 * (liquid + ice * 1.09) ;
  if (liquid > 0) d.rect(bx0, by0, bx1 - bx0, (level - by0) * (liquid / Math.max(1e-9, liquid + ice * 1.09)), { fill: theme.series[0], alpha: 0.35 });
  // Cubos de gelo
  const nIce = Math.round(9 * ice);
  for (let i = 0; i < nIce; i++) {
    const cx = bx0 + 0.6 + (i % 3) * 1.1;
    const cy = by0 + 0.45 + Math.floor(i / 3) * 0.75;
    d.box(cx, cy, 0.62, 0.62, 0.15 * ((i % 3) - 1), { fill: theme.dark ? "#cfe7ff" : "#e4f3ff", stroke: theme.accent, width: 1.5, alpha: 0.95 });
  }
  // Bolhas e vapor
  if (ph.T === 100 && ph.vapor < 1) {
    for (const b of BUBBLES) {
      const y = by0 + ((b.ph + t * 0.8 * b.s) % 1) * (level - by0);
      d.circle(bx0 + 0.2 + b.x * (bx1 - bx0 - 0.4), y, 0.07 * b.s, { stroke: theme.text, width: 1, alpha: 0.6 });
    }
  }
  if (ph.vapor > 0) {
    for (let i = 0; i < 6; i++) {
      const x = bx0 + 0.5 + i * 0.55;
      const y = by1 + 0.2 + ((t * 0.7 + i * 0.37) % 1) * 0.9;
      d.circle(x, y, 0.18 + 0.1 * Math.sin(i + t), { fill: theme.muted, alpha: 0.25 * Math.min(1, ph.vapor * 3 + 0.3) });
    }
  }
  d.polyline([[bx0, by1], [bx0, by0], [bx1, by0], [bx1, by1]], { color: theme.text, width: 2.5 });
  // Aquecedor
  d.rect(bx0 - 0.2, 0.9, bx1 - bx0 + 0.4, 0.5, { fill: theme.positive, alpha: 0.85 });
  d.text(`${formatBR(num(p, "P", 1500), 4)} W`, (bx0 + bx1) / 2, 1.15, { size: 11, weight: "600", color: "#ffffff" });
  for (const x of [1.8, 3, 4.2]) d.arrowPx(x, 1.42, 0, 1, 14, { color: theme.positive });
  thermometer(d, 5.6, 1.8, 6.6, ph.T, "T =");
  const stage = ph.T < 0 ? "Aquecendo o gelo" : ph.T === 0 ? "Fusão (patamar)" : ph.T < 100 ? "Aquecendo a água" : ph.T === 100 ? "Ebulição (patamar)" : "Aquecendo o vapor";
  d.text(stage, 3, 8.6, { size: 13, weight: "600", color: theme.accent });
  d.text(`gelo ${formatBR(ice * 100, 3)} %   líquida ${formatBR(liquid * 100, 3)} %   vapor ${formatBR(ph.vapor * 100, 3)} %`, 3, 8.05, { size: 11, color: theme.muted });

  // Curva T × Q
  const gx0 = 7.6, gx1 = 15.4, gy0 = 1.2, gy1 = 7.8;
  const Hend = enthalpy(sub, T_STOP, "hi");
  const Tmin = Math.min(-40, T0), Tmax = T_STOP + 10;
  const X = (HH: number) => gx0 + ((HH - H0) / (Hend - H0)) * (gx1 - gx0);
  const Y = (T: number) => gy0 + ((T - Tmin) / (Tmax - Tmin)) * (gy1 - gy0);
  d.line(gx0, gy0, gx1, gy0, { color: theme.muted });
  d.line(gx0, gy0, gx0, gy1, { color: theme.muted });
  d.text("Q fornecido (kJ) →", gx1, gy0 - 0.4, { align: "right", size: 11, color: theme.muted });
  d.text("T (°C)", gx0, gy1 + 0.3, { align: "left", size: 11, color: theme.muted });
  for (const T of [0, 100]) {
    d.line(gx0, Y(T), gx1, Y(T), { color: theme.grid });
    d.text(`${T}`, gx0 - 0.1, Y(T), { align: "right", size: 10, color: theme.muted });
  }
  d.text(`${formatBR((Hend - H0) / 1000, 4)}`, gx1, gy0 - 0.15, { align: "right", size: 10, color: theme.muted, baseline: "top" });
  const pts = (H1: number, H2: number, n = 120) => Array.from({ length: n + 1 }, (_, i) => { const HH = H1 + ((H2 - H1) * i) / n; return [X(HH), Y(phaseOf(sub, HH).T)] as [number, number]; });
  d.polyline(pts(H0, Hend), { color: theme.muted, dash: [4, 4] });
  d.polyline(pts(H0, Math.min(at(s, H), Hend)), { color: theme.accent, width: 2.5 });
  d.dot(X(Math.min(at(s, H), Hend)), Y(ph.T), 5, theme.positive);
  // Rótulos dos patamares
  const Hf0 = enthalpy(sub, 0, "lo"), Hf1 = enthalpy(sub, 0, "hi"), Hv0 = enthalpy(sub, 100, "lo"), Hv1 = enthalpy(sub, 100, "hi");
  d.text(`m L_F = ${formatBR((Hf1 - Hf0) / 1000, 3)} kJ`, (X(Hf0) + X(Hf1)) / 2, Y(0) + 0.35, { size: 10, color: theme.series[0] });
  d.text(`m L_V = ${formatBR((Hv1 - Hv0) / 1000, 4)} kJ`, (X(Hv0) + X(Hv1)) / 2, Y(100) + 0.35, { size: 10, color: theme.positive });
  d.text(`c_gelo = ${C_ICE}`, X(H0) + 0.1, Y(T0 / 2) , { align: "left", size: 9, color: theme.muted });
  d.text(`c_vapor = ${C_STEAM} J/kg·K`, gx1, Y(T_STOP) + 0.35, { align: "right", size: 9, color: theme.muted });
}

function renderMix(d: Draw, s: State, p: Params, t: number) {
  const { theme } = d;
  const w = waterSub(p), b: Sub = bodySub(p);
  const { T, Tb, phB } = temps(s, p);
  // Calorímetro (parede dupla)
  const cx0 = 1.2, cx1 = 6.2, cy0 = 1.0, cy1 = 6.6;
  d.rect(cx0 - 0.35, cy0 - 0.35, cx1 - cx0 + 0.7, cy1 - cy0 + 0.35, { fill: theme.muted, alpha: 0.18, stroke: theme.text, width: 2 });
  d.rect(cx0, cy0, cx1 - cx0, cy1 - cy0, { fill: theme.dark ? "#141a22" : "#ffffff", stroke: theme.text, width: 1.5 });
  d.text(`calorímetro: C = ${formatBR(w.C, 3)} J/K`, (cx0 + cx1) / 2, cy0 - 0.65, { size: 11, color: theme.muted });
  const level = cy0 + 0.3 + 4 * Math.min(1, (w.m + (b.c === 0 ? b.m * phB.liquid : 0)) / 1.1);
  d.rect(cx0, cy0, cx1 - cx0, level - cy0, { fill: tempColor(T), alpha: 0.3 });
  d.line(cx0, level, cx1, level, { color: theme.series[0], width: 1.5 });
  // Corpo
  const bxc = (cx0 + cx1) / 2 + 0.6;
  if (b.c > 0) {
    const side = 0.9 + 0.8 * Math.cbrt(b.m);
    d.rect(bxc - side / 2, cy0 + 0.1, side, side, { fill: tempColor(Tb), alpha: 0.9, stroke: theme.text, width: 1.5 });
  } else {
    const ice = 1 - phB.liquid - phB.vapor;
    const n = Math.max(0, Math.round(6 * ice * Math.min(1, b.m / 0.1 + 0.3)));
    for (let i = 0; i < n; i++) {
      const x = cx0 + 0.9 + (i % 3) * 1.2 + 0.2 * Math.sin(t * 0.5 + i);
      d.box(x, level - 0.25 - Math.floor(i / 3) * 0.6, 0.6, 0.55, 0.2 * Math.sin(i), { fill: theme.dark ? "#cfe7ff" : "#e4f3ff", stroke: theme.accent, width: 1.5 });
    }
    if (phB.vapor > 0) for (let i = 0; i < 8; i++) d.circle(bxc - 1 + (i % 4) * 0.6, cy0 + 0.4 + ((t * 0.6 + i * 0.29) % 1) * (level - cy0 - 0.5), 0.1, { stroke: theme.text, alpha: 0.6, width: 1 });
  }
  // Fluxo de calor
  const q = num(p, "k", 10) * (T - Tb);
  if (Math.abs(q) > 0.05) {
    const dir = Math.sign(q);
    d.arrowPx(bxc - dir * 1.2, cy0 + 1.6, dir, 0, 20 + Math.min(60, Math.abs(q) / 5), { color: theme.positive, width: 3 });
    d.text(`${formatBR(Math.abs(q), 3)} W ${dir > 0 ? "água → corpo" : "corpo → água"}`, bxc, cy0 + 2.15, { size: 11, color: theme.positive, weight: "600" });
  }
  thermometer(d, 7.2, 1.6, 6.4, T, "água", -40, 300);
  thermometer(d, 8.9, 1.6, 6.4, Tb, "corpo", -40, 300);
  // Painel
  const eq = mixEquilibrium(p);
  const lines = [
    `${bodyName(p)}: ${formatBR(b.m * 1000, 4)} g a ${formatBR(num(p, "Tb", -10), 4)} °C`,
    `Água: ${formatBR(w.m * 1000, 4)} g a ${formatBR(num(p, "Ta", 20), 3)} °C`,
    `T_eq prevista (sem perdas): ${formatBR(eq.T, 4)} °C`,
    eq.iceLeft > 0 && eq.T === 0 ? `Sobra gelo: ${formatBR(eq.iceLeft * 1000, 3)} g` : eq.steamLeft > 0 ? `Sobra vapor: ${formatBR(eq.steamLeft * 1000, 3)} g` : "Sem mudança de fase pendente",
    b.c === 0 ? `Corpo: ${formatBR(phB.liquid * 100, 3)} % líquido, ${formatBR(phB.vapor * 100, 3)} % vapor` : `c = ${b.c} J/kg·K`,
    `Tempo físico: ${formatBR(at(s, TF), 4)} s`,
  ];
  lines.forEach((tx, i) => d.text(tx, 10.4, 7.6 - i * 0.6, { align: "left", size: 11, color: i === 2 ? theme.accent : theme.text }));
}

export default calorimetria;
