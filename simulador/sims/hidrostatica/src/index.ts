import { clamp, defineSim, draw, formatBR, num, rk4, texNum, type Draw, type Params, type State, type Theme } from "@fisilab/core";
import {
  LIQUIDS,
  MAN,
  layersOf,
  manDeriv,
  manEquilibrium,
  manLimits,
  manParams,
  manReading,
  pressF1eq,
  pressMax,
  pressParams,
  pressStep,
  pressureAtDepth,
  surfacePressure,
  totalDepth,
  type Layer,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: [x do manômetro, v do manômetro, d2 da prensa, v2 da prensa, sonda x, sonda y]
const X = 0, V = 1, D2 = 2, V2 = 3, PX = 4, PY = 5;
const at = (s: State, i: number) => s[i] ?? 0;
const modeOf = (p: Params) => Math.round(num(p, "modo", 0));
const gOf = (p: Params) => num(p, "g", 9.81);

/** Geometria do tanque de camadas, proporcional à profundidade total. */
export function tankGeom(p: Params) {
  const { layers, reordered } = layersOf(p);
  const H = totalDepth(layers);
  const TW = 0.7 * H;
  const gx0 = TW + 0.42 * H;
  const GW = 1.05 * H;
  return { layers, reordered, H, TW, gx0, GW };
}

/** Profundidade da sonda (m) a partir do estado. */
export function probeDepth(s: State, p: Params) {
  const { H } = tankGeom(p);
  return clamp(H - at(s, PY), 0, H);
}

export function probePressure(s: State, p: Params) {
  const { layers } = tankGeom(p);
  return pressureAtDepth(layers, probeDepth(s, p), surfacePressure(p), gOf(p));
}

function layerColor(theme: Theme, rho: number) {
  const i = LIQUIDS.findIndex((l) => Math.abs(l.rho - rho) < 1);
  return [theme.series[5], theme.series[1], theme.series[0], theme.series[4], theme.muted][i] ?? theme.series[2]!;
}

const kPa = (v: number, d = 4) => `${formatBR(v / 1000, d)} kPa`;

function measuredPressure(s: State, p: Params) {
  const m = modeOf(p);
  if (m === 0) return probePressure(s, p);
  if (m === 1) return manReading(at(s, X), manParams(p));
  const q = pressParams(p);
  return q.F1 / q.A1;
}

export const hidrostatica = defineSim({
  id: "hidrostatica",
  title: "Pressão hidrostática, manômetro e prensa hidráulica",
  course: "FG II",
  topic: "Hidrostática",
  priority: "P1",
  summary:
    "Empilhe até três líquidos imiscíveis e arraste a sonda para ver p(y) mudar de inclinação em cada interface; meça a pressão de um gás com um manômetro em U de dois líquidos e levante uma carga com a prensa hidráulica.",
  equations: [
    String.raw`p = p_0 + \sum_i \rho_i\, g\, \Delta h_i \qquad \frac{dp}{dy} = -\rho g`,
    String.raw`\text{manômetro: } p_g + \rho_A g h_A = \rho_B g\, \Delta z`,
    String.raw`\text{Pascal: } \frac{F_1}{A_1} = \frac{F_2}{A_2} \qquad A_1 d_1 = A_2 d_2 \;\Rightarrow\; F_1 d_1 = F_2 d_2`,
  ],
  liveEquations(s, p) {
    const m = modeOf(p);
    if (m === 0) {
      const { layers } = tankGeom(p);
      const depth = probeDepth(s, p);
      const g = gOf(p);
      const terms: string[] = [];
      let top = 0;
      for (const l of layers) {
        const dz = Math.max(0, Math.min(depth, top + l.h) - top);
        if (dz > 0) terms.push(String.raw`${texNum(l.rho, 4)}\cdot${texNum(g)}\cdot${texNum(dz)}`);
        top += l.h;
      }
      const p0 = surfacePressure(p);
      return [
        String.raw`p = ${texNum(p0 / 1000, 4)}\ \text{kPa} + (${terms.join(" + ") || "0"})\ \text{Pa} = ${texNum(probePressure(s, p) / 1000, 4)}\ \text{kPa}`,
      ];
    }
    if (m === 1) {
      const q = manParams(p);
      const x = at(s, X);
      return [
        String.raw`p_g = \rho_B g\,\Delta z - \rho_A g h_A = ${texNum(q.rhoB, 4)}\cdot${texNum(q.g)}\cdot${texNum(2 * x)} - ${texNum(q.rhoA)}\cdot${texNum(q.g)}\cdot${texNum(q.hA)} = ${texNum(manReading(x, q) / 1000)}\ \text{kPa}`,
        String.raw`\Delta z_{\text{eq}} = \frac{p_g + \rho_A g h_A}{\rho_B g} = ${texNum(2 * manEquilibrium(q))}\ \text{m}`,
      ];
    }
    const q = pressParams(p);
    const d2 = at(s, D2);
    const r = q.A2 / q.A1;
    return [
      String.raw`p = \frac{F_1}{A_1} = ${texNum(q.F1 / q.A1 / 1000)}\ \text{kPa} \qquad F_2 = F_1\frac{A_2}{A_1} = ${texNum(q.F1 * r)}\ \text{N} \qquad Mg = ${texNum(q.M * q.g)}\ \text{N}`,
      String.raw`F_1 d_1 = ${texNum(q.F1)}\cdot${texNum(d2 * r)} = ${texNum(q.F1 * d2 * r)}\ \text{J} \qquad F_2 d_2 = ${texNum(q.F1 * r)}\cdot${texNum(d2)} = ${texNum(q.F1 * r * d2)}\ \text{J}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Camadas de líquidos e sonda" },
        { value: 1, label: "Manômetro em U (dois líquidos)" },
        { value: 2, label: "Prensa hidráulica" },
      ],
    },
    {
      key: "g",
      label: "Gravidade",
      unit: "m/s²",
      min: 1,
      max: 25,
      step: 0.01,
      default: 9.81,
      live: true,
      options: [
        { value: 9.81, label: "Terra (9,81 m/s²)" },
        { value: 3.71, label: "Marte (3,71 m/s²)" },
        { value: 1.62, label: "Lua (1,62 m/s²)" },
      ],
    },
    {
      key: "ref",
      label: "Camadas: pressão medida",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Absoluta (p₀ = 1 atm)" },
        { value: 1, label: "Manométrica (p₀ = 0)" },
      ],
    },
    { key: "n", label: "Camadas: número de líquidos", unit: "", min: 1, max: 3, step: 1, default: 3 },
    { key: "rho1", label: "Camadas: líquido 1", unit: "kg/m³", min: 700, max: 13600, step: 10, default: 900, options: LIQUIDS.map((l) => ({ value: l.rho, label: l.name })) },
    { key: "h1", label: "Camadas: espessura 1", unit: "m", min: 0.05, max: 1, step: 0.01, default: 0.3 },
    { key: "rho2", label: "Camadas: líquido 2", unit: "kg/m³", min: 700, max: 13600, step: 10, default: 1000, options: LIQUIDS.map((l) => ({ value: l.rho, label: l.name })) },
    { key: "h2", label: "Camadas: espessura 2", unit: "m", min: 0.05, max: 1, step: 0.01, default: 0.4 },
    { key: "rho3", label: "Camadas: líquido 3", unit: "kg/m³", min: 700, max: 13600, step: 10, default: 13600, options: LIQUIDS.map((l) => ({ value: l.rho, label: l.name })) },
    { key: "h3", label: "Camadas: espessura 3", unit: "m", min: 0.05, max: 1, step: 0.01, default: 0.1 },
    { key: "pg", label: "Manômetro: pressão manométrica do gás", unit: "kPa", min: -4, max: 10, step: 0.1, default: 2, live: true },
    {
      key: "rhoB",
      label: "Manômetro: líquido manométrico",
      unit: "kg/m³",
      min: 1000,
      max: 13600,
      step: 10,
      default: 1000,
      options: [
        { value: 1000, label: "Água" },
        { value: 1260, label: "Glicerina" },
        { value: 13600, label: "Mercúrio" },
      ],
    },
    {
      key: "rhoA",
      label: "Manômetro: líquido sobre o braço do gás",
      unit: "kg/m³",
      min: 700,
      max: 1000,
      step: 10,
      default: 900,
      options: [
        { value: 720, label: "Gasolina" },
        { value: 900, label: "Óleo" },
      ],
    },
    { key: "hA", label: "Manômetro: coluna do líquido leve h_A", unit: "m", min: 0, max: 0.4, step: 0.01, default: 0.2 },
    { key: "zeta", label: "Manômetro: amortecimento", unit: "", min: 0, max: 1.5, step: 0.01, default: 0.12, live: true },
    { key: "F1", label: "Prensa: força no pistão pequeno F₁", unit: "N", min: 0, max: 600, step: 1, default: 250, live: true },
    { key: "d1", label: "Prensa: diâmetro do pistão pequeno", unit: "cm", min: 1, max: 10, step: 0.5, default: 4 },
    { key: "d2", label: "Prensa: diâmetro do pistão grande", unit: "cm", min: 5, max: 30, step: 0.5, default: 16 },
    { key: "M", label: "Prensa: massa da carga", unit: "kg", min: 10, max: 1000, step: 10, default: 200 },
  ],

  observables: [
    { key: "p", label: "Pressão medida (sonda, gás ou fluido da prensa)", unit: "kPa", value: (s, p) => measuredPressure(s, p) / 1000 },
    { key: "prof", label: "Profundidade da sonda", unit: "m", value: (s, p) => (modeOf(p) === 0 ? probeDepth(s, p) : 0) },
    { key: "dz", label: "Desnível do líquido manométrico Δz", unit: "m", value: (s) => 2 * at(s, X) },
    { key: "d1", label: "Descida do pistão pequeno d₁", unit: "m", value: (s, p) => { const q = pressParams(p); return (at(s, D2) * q.A2) / q.A1; } },
    { key: "d2", label: "Subida do pistão grande d₂", unit: "m", value: (s) => at(s, D2) },
    { key: "W1", label: "Trabalho de F₁", unit: "J", value: (s, p) => { const q = pressParams(p); return (q.F1 * at(s, D2) * q.A2) / q.A1; } },
    { key: "Ep", label: "Energia potencial ganha pela carga", unit: "J", value: (s, p) => { const q = pressParams(p); return q.M * q.g * at(s, D2); } },
  ],
  chart: { x: "prof", y: "p" },

  scenarios: [
    {
      id: "camadas",
      label: "Óleo, água e mercúrio",
      params: { modo: 0, n: 3, rho1: 900, h1: 0.3, rho2: 1000, h2: 0.4, rho3: 13600, h3: 0.1, ref: 1 },
      guide: `### Inclinação muda em cada interface
1. Arraste a **sonda** de cima até o fundo. O gráfico ao lado mostra $p$ contra a profundidade, na mesma escala vertical do tanque.
2. Em cada camada a reta tem inclinação $dp/dh = \\rho g$. Onde a reta fica mais "deitada"? Por quê?
3. Mova a sonda na horizontal dentro de uma camada: a pressão muda?
4. Troque para pressão **absoluta**: todo o gráfico é deslocado de $p_0 = 101{,}3$ kPa, mas as inclinações não mudam.`,
      predict: [
        {
          question: "Ao passar da água ($\\rho = 1000$ kg/m³) para o mercúrio ($\\rho = 13\\,600$ kg/m³), a curva p × profundidade:",
          options: ["continua com a mesma inclinação", "fica cerca de 13,6 vezes mais inclinada (p cresce mais rápido)", "dá um salto (descontinuidade)"],
          answer: 1,
          explanation: "A pressão é contínua na interface (não há salto), mas a taxa $dp/dh = \\rho g$ passa a ser 13,6 vezes maior no mercúrio.",
        },
      ],
    },
    {
      id: "marte",
      label: "Mesmo tanque em Marte",
      params: { modo: 0, n: 2, rho1: 900, h1: 0.5, rho2: 1000, h2: 0.5, ref: 1, g: 3.71 },
      guide: `### A gravidade entra em todas as inclinações
1. Anote a pressão no fundo com $g = 3{,}71$ m/s².
2. Troque para a Terra durante a simulação e compare: a razão entre as pressões é $9{,}81/3{,}71$?`,
    },
    {
      id: "manometro",
      label: "Manômetro em U com óleo",
      params: { modo: 1, pg: 2, rhoB: 1000, rhoA: 900, hA: 0.2, zeta: 0.12 },
      guide: `### Lendo a pressão do gás
1. Rode: a coluna oscila e se acomoda. O braço esquerdo está ligado ao gás e tem uma coluna de óleo $h_A$ sobre a água.
2. No equilíbrio, iguale as pressões no nível da interface óleo–água: $p_g + \\rho_A g h_A = \\rho_B g\\,\\Delta z$.
3. Mude $p_g$ ao vivo e veja o novo equilíbrio. Com $p_g < 0$ (sucção) o desnível diminui.
4. Troque a água por **mercúrio**: o desnível fica 13,6 vezes menor. Por que o mercúrio é usado para pressões grandes?`,
      predict: [
        {
          question: "Com o gás à pressão atmosférica ($p_g = 0$) e óleo no braço esquerdo, o nível da água:",
          options: ["fica igual nos dois braços", "fica mais alto no braço direito (aberto)", "fica mais alto no braço do óleo"],
          answer: 1,
          explanation: "O peso da coluna de óleo empurra a água para baixo no braço esquerdo: $\\Delta z = \\rho_A h_A/\\rho_B$.",
        },
      ],
    },
    {
      id: "prensa",
      label: "Prensa hidráulica",
      params: { modo: 2, F1: 250, d1: 4, d2: 16, M: 200 },
      guide: `### Multiplicar força não multiplica energia
1. Com $d_2/d_1 = 4$, a vantagem mecânica é $A_2/A_1 = 16$. Calcule a força mínima $F_1$ que levanta 200 kg.
2. Rode e compare as descidas: o pistão pequeno anda 16 vezes mais que o grande.
3. Confira que $F_1 d_1 = F_2 d_2$ nas equações ao vivo.
4. Reduza $F_1$ abaixo do valor de equilíbrio durante a subida: o que acontece com a carga?`,
      predict: [
        {
          question: "Dobrando o diâmetro do pistão grande (mantendo o pequeno), a força necessária para levantar a mesma carga:",
          options: ["cai pela metade", "cai para um quarto", "não muda"],
          answer: 1,
          explanation: "A área cresce com o quadrado do diâmetro: $A_2$ fica 4 vezes maior e $F_1 = Mg\\,A_1/A_2$ cai para um quarto.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "camadas",
      prompt:
        "Um tanque aberto contém {h1} m de óleo (ρ = 900 kg/m³) sobre {h2} m de água (ρ = 1000 kg/m³). Qual é a pressão manométrica no fundo, em kPa? (g = 9,81 m/s²)",
      vary: { h1: [0.1, 1, 2], h2: [0.1, 1, 2] },
      fixed: { modo: 0, n: 2, rho1: 900, rho2: 1000, ref: 1, g: 9.81 },
      answer: { label: "p", unit: "kPa", compute: (p) => (900 * 9.81 * num(p, "h1") + 1000 * 9.81 * num(p, "h2")) / 1000 },
      hint: "Some ρ g h de cada camada; a pressão manométrica na superfície é zero.",
    },
    {
      id: "prensa",
      prompt:
        "Numa prensa hidráulica, o pistão pequeno tem {d1} cm de diâmetro e o grande, {d2} cm. Qual é a menor força no pistão pequeno capaz de sustentar uma carga de {M} kg? (g = 9,81 m/s²)",
      vary: { d1: [2, 6, 1], d2: [12, 30, 0], M: [100, 900, 0] },
      fixed: { modo: 2, g: 9.81 },
      answer: { label: "F₁", unit: "N", compute: (p) => pressF1eq(pressParams(p)) },
      hint: "F₁/A₁ = F₂/A₂ e a razão entre as áreas é o quadrado da razão entre os diâmetros.",
    },
    {
      id: "manometro",
      prompt:
        "Num tubo em U aberto contendo água (1000 kg/m³), despeja-se uma coluna de {hA} m de um líquido de densidade {rhoA} kg/m³, imiscível com a água, num dos braços. Quanto o nível da água no outro braço fica acima da interface entre os líquidos, em cm?",
      vary: { hA: [0.1, 0.4, 2], rhoA: [700, 950, 0] },
      fixed: { modo: 1, pg: 0, rhoB: 1000 },
      answer: { label: "Δz", unit: "cm", compute: (p) => (100 * num(p, "rhoA") * num(p, "hA")) / 1000 },
      hint: "Iguale as pressões no nível da interface: ρ_A g h_A = ρ_água g Δz.",
    },
  ],

  init: (p) => {
    const { TW, H } = tankGeom(p);
    return [0, 0, 0, 0, TW / 2, H * 0.45];
  },
  step(s, p, t, dt) {
    const m = modeOf(p);
    const out = s.slice();
    if (m === 1) {
      const q = manParams(p);
      const f = (y: State) => manDeriv(at(y, 0), at(y, 1), q);
      let [x, v] = rk4(f, [at(s, X), at(s, V)], p, t, dt) as [number, number];
      const [lo, hi] = manLimits(q);
      if (x > hi || x < lo) {
        x = clamp(x, lo, hi);
        v = 0;
      }
      out[X] = x;
      out[V] = v;
    } else if (m === 2) {
      const [d, v] = pressStep(at(s, D2), at(s, V2), pressParams(p), dt);
      out[D2] = d;
      out[V2] = v;
    }
    return out;
  },
  dt: 1e-3,
  sampleEvery: 10,

  pointer: {
    down(s, p, pt) {
      if (modeOf(p) !== 0) return undefined;
      const { TW, H } = tankGeom(p);
      if (pt.x < -0.05 * H || pt.x > TW + 0.05 * H || pt.y < -0.05 * H || pt.y > H * 1.05) return undefined;
      const out = s.slice();
      out[PX] = clamp(pt.x, 0.03 * TW, 0.97 * TW);
      out[PY] = clamp(pt.y, 0, H);
      return out;
    },
    move(s, p, pt, dragging) {
      if (!dragging || modeOf(p) !== 0) return undefined;
      const { TW, H } = tankGeom(p);
      const out = s.slice();
      out[PX] = clamp(pt.x, 0.03 * TW, 0.97 * TW);
      out[PY] = clamp(pt.y, 0, H);
      return out;
    },
    cursor(_s, p, pt) {
      if (modeOf(p) !== 0) return undefined;
      const { TW, H } = tankGeom(p);
      return pt.x > 0 && pt.x < TW && pt.y > 0 && pt.y < H ? "grab" : undefined;
    },
  },

  viewport(p) {
    const m = modeOf(p);
    if (m === 0) {
      const { H, gx0, GW } = tankGeom(p);
      return { xMin: -0.32 * H, xMax: gx0 + GW + 0.2 * H, yMin: -0.2 * H, yMax: 1.32 * H };
    }
    if (m === 1) return { xMin: -0.25, xMax: 2.1, yMin: -0.2, yMax: 1.85 };
    return { xMin: -0.1, xMax: 2.3, yMin: -0.15, yMax: 2.05 };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = modeOf(frame.params);
    if (m === 0) renderLayers(d, frame.state, frame.params);
    else if (m === 1) renderManometer(d, frame.state, frame.params);
    else renderPress(d, frame.state, frame.params);
  },
});

function renderLayers(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const { layers, reordered, H, TW, gx0, GW } = tankGeom(p);
  const g = gOf(p);
  const p0 = surfacePressure(p);
  const pBottom = pressureAtDepth(layers, H, p0, g);
  const yOf = (depth: number) => H - depth;
  const PXf = (pp: number) => gx0 + 0.06 * GW + ((pp - p0) / Math.max(1e-9, pBottom - p0)) * 0.86 * GW;

  // Camadas
  let top = 0;
  const bounds: { l: Layer; top: number }[] = [];
  for (const l of layers) {
    d.rect(0, yOf(top + l.h), TW, l.h, { fill: layerColor(theme, l.rho), alpha: 0.32 });
    d.text(`${l.name} (${formatBR(l.rho, 5)} kg/m³)`, 0.04 * TW, l.h > 0.1 * H ? yOf(top) - 0.045 * H : yOf(top + l.h / 2), { align: "left", size: 11, color: theme.text });
    bounds.push({ l, top });
    top += l.h;
  }
  // Paredes
  d.line(0, 0, 0, 1.12 * H, { color: theme.text, width: 2.5 });
  d.line(TW, 0, TW, 1.12 * H, { color: theme.text, width: 2.5 });
  d.line(0, 0, TW, 0, { color: theme.text, width: 2.5 });
  d.rect(-0.05 * H, -0.06 * H, TW + 0.1 * H, 0.06 * H, { fill: theme.ground });
  // Superfície e p0
  d.line(0, H, TW, H, { color: theme.accent, width: 1.5 });
  d.text(Math.round(num(p, "ref")) === 1 ? "p₀ = 0 (manométrica)" : "p₀ = 101,3 kPa (atmosfera)", TW / 2, 1.2 * H, { size: 11, color: theme.muted });
  for (const fx of [0.25, 0.5, 0.75]) d.arrowPx(TW * fx, 1.13 * H, 0, -1, 16, { color: theme.muted, width: 1.5 });

  // Régua de profundidade
  const rx = -0.12 * H;
  d.line(rx, 0, rx, H, { color: theme.muted });
  const stepR = H > 1.5 ? 0.5 : H > 0.6 ? 0.2 : 0.1;
  for (let z = 0; z <= H + 1e-9; z += stepR) {
    d.line(rx - 0.02 * H, yOf(z), rx, yOf(z), { color: theme.muted });
    d.text(formatBR(z, 3), rx - 0.03 * H, yOf(z), { align: "right", size: 10, color: theme.muted });
  }
  d.text("h (m)", rx, 1.08 * H, { size: 10, color: theme.muted });

  // Gráfico p × profundidade (mesma escala vertical do tanque)
  d.line(gx0, 0, gx0, H, { color: theme.muted });
  d.line(gx0, H, gx0 + GW, H, { color: theme.muted });
  d.text("p (kPa) →", gx0 + GW, 1.07 * H, { align: "right", size: 11, color: theme.muted });
  d.text("profundidade ↓", gx0 - 0.02 * H, -0.08 * H, { align: "left", size: 10, color: theme.muted });
  d.text(formatBR(p0 / 1000, 4), PXf(p0), 1.07 * H, { size: 10, color: theme.muted });
  const pts: [number, number][] = [[PXf(p0), H]];
  for (const { l, top: t0 } of bounds) {
    const pTop = pressureAtDepth(layers, t0, p0, g);
    const pBot = pressureAtDepth(layers, t0 + l.h, p0, g);
    pts.push([PXf(pBot), yOf(t0 + l.h)]);
    // Interface tracejada do tanque até o gráfico
    if (t0 + l.h < H - 1e-9) d.line(0, yOf(t0 + l.h), PXf(pBot), yOf(t0 + l.h), { color: theme.muted, dash: [4, 4], alpha: 0.7 });
    const midx = (PXf(pTop) + PXf(pBot)) / 2;
    d.text(`ρg = ${formatBR((l.rho * g) / 1000, 3)} kPa/m`, midx + 0.03 * H, yOf(t0 + l.h / 2), { align: "left", size: 10, color: layerColor(theme, l.rho) });
  }
  d.polyline(pts, { color: theme.accent, width: 2.5 });
  d.text(formatBR(pBottom / 1000, 4), PXf(pBottom), -0.08 * H, { size: 10, color: theme.muted });
  d.line(PXf(pBottom), 0, PXf(pBottom), -0.03 * H, { color: theme.muted });

  // Sonda
  const sx = at(s, PX), sy = clamp(at(s, PY), 0, H);
  const depth = H - sy;
  const pp = pressureAtDepth(layers, depth, p0, g);
  d.line(sx, sy, PXf(pp), sy, { color: theme.positive, dash: [2, 3], alpha: 0.8 });
  d.dot(PXf(pp), sy, 5, theme.positive);
  for (const [ux, uy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) d.arrowPx(sx + ux * 0.1 * H, sy + uy * 0.1 * H, -ux, -uy, Math.max(4, 0.065 * H / d.px), { color: theme.positive, width: 1.8 });
  d.circle(sx, sy, 0.035 * H, { fill: theme.dark ? "#1c2430" : "#ffffff", stroke: theme.positive, width: 2 });
  const side = sx < TW / 2 ? 1 : -1;
  const lx = sx + side * 0.13 * H;
  const al = side > 0 ? "left" : "right";
  d.text(`p = ${kPa(pp)}`, lx, sy + 0.025 * H, { size: 12, weight: "600", color: theme.positive, align: al });
  d.text(`h = ${formatBR(depth, 3)} m`, lx, sy - 0.035 * H, { size: 11, color: theme.positive, align: al });
  d.text(reordered ? "Os líquidos se reorganizaram: o mais denso fica no fundo." : "Arraste a sonda dentro do tanque.", (TW + gx0 + GW) / 2, -0.16 * H, {
    size: 11,
    color: reordered ? theme.positive : theme.muted,
  });
}

function renderManometer(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const q = manParams(p);
  const x = at(s, X);
  const w = 0.08;
  const { XL, XR, TOP, Z0 } = MAN;
  const zL = Z0 - x, zR = Z0 + x;
  const colB = q.rhoB > 5000 ? theme.muted : theme.series[0]!;
  const colA = theme.series[q.rhoA < 800 ? 5 : 1]!;
  // Líquidos
  d.rect(XL - w / 2, -w / 2, w, zL + w / 2, { fill: colB, alpha: 0.55 });
  d.rect(XL + w / 2, -w / 2, XR - XL - w, w, { fill: colB, alpha: 0.55 });
  d.rect(XR - w / 2, -w / 2, w, zR + w / 2, { fill: colB, alpha: 0.55 });
  if (q.hA > 0) d.rect(XL - w / 2, zL, w, q.hA, { fill: colA, alpha: 0.6 });
  // Tubo
  const tube = { color: theme.text, width: 2 };
  d.polyline([[XL - w / 2, TOP], [XL - w / 2, -w / 2], [XR + w / 2, -w / 2], [XR + w / 2, TOP]], tube);
  d.polyline([[XL + w / 2, TOP], [XL + w / 2, w / 2], [XR - w / 2, w / 2], [XR - w / 2, TOP]], tube);
  // Reservatório de gás no braço esquerdo
  d.rect(XL - 0.22, TOP, 0.44, 0.28, { fill: theme.accent, alpha: 0.12, stroke: theme.text, width: 2 });
  d.text("gás", XL, TOP + 0.19, { size: 12, weight: "600" });
  d.text(`p_g = ${formatBR(q.pg / 1000, 3)} kPa`, XL, TOP + 0.08, { size: 11, color: theme.accent });
  d.text("aberto: p_atm", XR, TOP + 0.1, { size: 11, color: theme.muted });
  d.arrowPx(XR, TOP + 0.04, 0, -1, 16, { color: theme.muted, width: 1.5 });
  // Cotas
  d.line(XL + w / 2, zL, XR + 0.18, zL, { color: theme.muted, dash: [4, 3] });
  d.line(XR + w / 2, zR, XR + 0.18, zR, { color: theme.muted, dash: [4, 3] });
  if (Math.abs(zR - zL) > 0.01) d.arrow(XR + 0.14, zL, 0, zR - zL, { color: theme.positive, width: 1.5, head: 7 });
  d.text(`Δz = ${formatBR(zR - zL, 3)} m`, XR + 0.2, (zL + zR) / 2, { align: "left", size: 12, color: theme.positive, weight: "600" });
  if (q.hA > 0) {
    d.arrow(XL - 0.1, zL, 0, q.hA, { color: colA, width: 1.5, head: 7 });
    d.text(`h_A = ${formatBR(q.hA, 3)} m`, XL - 0.12, zL + q.hA / 2, { align: "right", size: 11, color: colA });
  }
  // Painel
  const px0 = 1.35;
  const [lo, hi] = manLimits(q);
  const eq = manEquilibrium(q);
  const lines = [
    `Líquido B: ${q.rhoB > 5000 ? "mercúrio" : q.rhoB > 1100 ? "glicerina" : "água"} (${formatBR(q.rhoB, 5)} kg/m³)`,
    `Líquido A: ${q.rhoA < 800 ? "gasolina" : "óleo"} (${formatBR(q.rhoA, 4)} kg/m³)`,
    `p_g lida = ρB g Δz − ρA g hA`,
    `         = ${formatBR(manReading(x, q) / 1000, 3)} kPa`,
  ];
  lines.forEach((t, i) => d.text(t, px0 - 0.1, 1.35 - i * 0.13, { align: "left", size: 11, color: i === 3 ? theme.positive : theme.text }));
  if (eq > hi || eq < lo) d.text("O líquido sairia do tubo: reduza p_g.", px0 - 0.1, 0.7, { align: "left", size: 11, color: theme.positive, weight: "600" });
}

function renderPress(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const q = pressParams(p);
  const VIS = 3; // diâmetros ampliados no desenho
  const d1m = num(p, "d1", 4) / 100, d2m = num(p, "d2", 16) / 100;
  const w1 = d1m * VIS, w2 = d2m * VIS;
  const x1 = 0.45, x2 = 1.45;
  const yB = 0.08, yC = 0.25; // fundo e teto do canal
  const r = q.A2 / q.A1;
  const d2 = at(s, D2);
  const d1 = d2 * r;
  const y1 = 0.35 + 1.0 - d1; // topo do fluido no cilindro pequeno
  const y2 = 0.45 + d2;
  const fluid = theme.series[0]!;
  // Fluido
  d.rect(x1 - w1 / 2, yB, w1, y1 - yB, { fill: fluid, alpha: 0.35 });
  d.rect(x1 + w1 / 2, yB, x2 - x1 - w1 / 2 - w2 / 2, yC - yB, { fill: fluid, alpha: 0.35 });
  d.rect(x2 - w2 / 2, yB, w2, y2 - yB, { fill: fluid, alpha: 0.35 });
  // Paredes
  const wall = { color: theme.text, width: 2.5 };
  d.polyline([[x1 - w1 / 2, 1.5], [x1 - w1 / 2, yB], [x2 + w2 / 2, yB], [x2 + w2 / 2, 1.0]], wall);
  d.polyline([[x1 + w1 / 2, 1.5], [x1 + w1 / 2, yC], [x2 - w2 / 2, yC], [x2 - w2 / 2, 1.0]], wall);
  // Pistões
  d.rect(x1 - w1 / 2, y1, w1, 0.05, { fill: theme.muted });
  d.line(x1, y1 + 0.05, x1, Math.min(1.7, y1 + 0.35), { color: theme.muted, width: 4 });
  d.rect(x2 - w2 / 2, y2, w2, 0.06, { fill: theme.muted });
  // Carga
  const bw = Math.max(0.2, 0.7 * w2), bh = 0.22;
  d.rect(x2 - bw / 2, y2 + 0.06, bw, bh, { fill: theme.series[1], alpha: 0.85 });
  d.text(`${formatBR(q.M, 4)} kg`, x2, y2 + 0.06 + bh / 2, { size: 11, weight: "600", color: "#ffffff" });
  // Forças
  const F2 = q.F1 * r, W = q.M * q.g;
  const big = Math.max(F2, W, 1);
  const len = (F: number) => 20 + 70 * (F / big);
  d.arrowPx(x1, Math.min(1.7, y1 + 0.35) + len(q.F1) * d.px, 0, -1, len(q.F1), { color: theme.accent });
  d.text(`F₁ = ${formatBR(q.F1, 4)} N`, x1 + 0.08, Math.min(1.7, y1 + 0.35) + 0.12, { align: "left", size: 12, color: theme.accent, weight: "600" });
  d.arrowPx(x2 - w2 / 2 - 0.08, y2 - len(F2) * d.px * 0.5, 0, 1, len(F2), { color: theme.positive });
  d.text(`F₂ = ${formatBR(F2, 4)} N`, x2 - w2 / 2 - 0.12, y2 - 0.1, { align: "right", size: 12, color: theme.positive, weight: "600" });
  d.arrowPx(x2 + bw / 2 + 0.06, y2 + 0.06 + bh, 0, -1, len(W), { color: theme.series[4] });
  d.text(`Mg = ${formatBR(W, 4)} N`, x2 + bw / 2 + 0.1, y2 + 0.06 + bh + 0.05, { align: "left", size: 12, color: theme.series[4], weight: "600" });
  // Deslocamentos
  d.line(x1 - w1 / 2 - 0.12, 1.35, x1 - w1 / 2 - 0.02, 1.35, { color: theme.muted });
  if (d1 > 0.01) d.arrow(x1 - w1 / 2 - 0.07, 1.35, 0, -d1, { color: theme.muted, width: 1.5, head: 7 });
  d.text(`d₁ = ${formatBR(d1, 3)} m`, x1 - w1 / 2 - 0.09, 1.42, { align: "left", size: 11, color: theme.muted });
  d.text(`d₂ = ${formatBR(d2 * 100, 3)} cm`, x2 + w2 / 2 + 0.06, 0.55, { align: "left", size: 11, color: theme.muted });
  // Painel
  const W1 = q.F1 * d1;
  const lines = [
    `p = F₁/A₁ = ${kPa(q.F1 / q.A1)}`,
    `Vantagem mecânica A₂/A₁ = ${formatBR(r, 4)}`,
    `F₁ mínima = ${formatBR(pressF1eq(q), 4)} N`,
    `W₁ = F₁d₁ = ${formatBR(W1, 4)} J   ΔEp = ${formatBR(W * d2, 4)} J`,
  ];
  lines.forEach((t, i) => d.text(t, 0.75, 1.95 - i * 0.12, { align: "left", size: 11, color: i === 3 ? theme.accent : theme.text }));
  if (d2 >= pressMax(q) - 1e-6) d.text("Fim de curso do pistão pequeno", x2, 1.12, { size: 11, color: theme.muted });
  else if (q.F1 < pressF1eq(q) && d2 <= 1e-9) d.text("F₁ insuficiente: a carga não sobe", x2, 1.12, { size: 11, color: theme.positive });
  d.text("diâmetros ampliados 3× no desenho", 1.2, -0.08, { size: 10, color: theme.muted });
}

export default hidrostatica;
