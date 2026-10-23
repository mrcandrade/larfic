import { defineSim, draw, formatBR, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  DET_X,
  HC_EV_NM,
  LAMP_X,
  MOL_X,
  MOL_Y,
  absorbP,
  expectedAbsorption,
  fire,
  fmtLam,
  greenhouseIndex,
  initState,
  laserLam,
  molOf,
  photonEV,
  planckLn,
  regionOf,
  sourceOf,
  step,
  toNu,
  type MlState,
} from "./engine.ts";
import { MASS, MOLECULES, RADIUS, com, modeDisp, type Molecule } from "./molecules.ts";

export * from "./engine.ts";
export * from "./molecules.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const SOURCES = [
  { value: 0, label: "Micro-ondas (0,5 mm – 5 cm)" },
  { value: 1, label: "Infravermelho térmico da Terra (corpo negro a 288 K)" },
  { value: 2, label: "Luz visível branca (400–700 nm)" },
  { value: 3, label: "Ultravioleta (100–400 nm)" },
  { value: 4, label: "Laser sintonizável (λ escolhido)" },
];
const SP = { x0: 0.9, x1: 10.2, y0: 0.75, y1: 3.2, l0: 2, l1: 8 }; // log10 λ (nm)
const BAR = { x0: 11.3, x1: 15.7, y0: 0.75, y1: 3.2 };
const SC = 0.8; // mundo por Å

const fAbs = (s: MlState) => (s.nAbs + s.nTrans > 0 ? s.nAbs / (s.nAbs + s.nTrans) : 0);
const GH = MOLECULES.map(greenhouseIndex);

/** Cor aproximada de um comprimento de onda visível; fora do visível, cor convencional. */
function lamColor(nm: number, d: Draw): string {
  if (nm < 380) return "#8a4fd8";
  if (nm > 750) return nm > 1e6 ? d.theme.muted : "#b8322c";
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  const c = (v: number) => Math.round(255 * Math.min(1, v) ** 0.8);
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export const moleculasLuz = defineSim<MlState>({
  id: "moleculas-luz",
  title: "Moléculas e luz: rotação, vibração e efeito estufa",
  course: "FG IV",
  topic: "Física moderna",
  priority: "P2",
  summary:
    "Fótons de micro-ondas, infravermelho, visível e ultravioleta atingem CO, N₂, O₂, H₂O, CO₂, CH₄, NO₂ ou O₃. A molécula só absorve se o fóton tiver a energia de uma transição permitida: gira (se for polar), vibra (se o modo mudar o dipolo), excita-se ou se dissocia — e reemite o infravermelho em qualquer direção, que é o mecanismo do efeito estufa.",
  equations: [
    String.raw`E_{\text{fóton}} = h\nu = \frac{hc}{\lambda} \qquad \tilde\nu = \frac{1}{\lambda} \qquad E\,[\text{eV}] = \frac{1239{,}8}{\lambda\,[\text{nm}]}`,
    String.raw`\text{rotação: } E_J = hcB\,J(J+1),\ \Delta J = \pm 1 \text{ só se } \vec\mu_0 \neq 0`,
    String.raw`\text{vibração: } E_v = h\nu_0\left(v + \tfrac12\right),\ \Delta v = \pm 1 \text{ só se } \frac{\partial \vec\mu}{\partial Q} \neq 0`,
    String.raw`\text{dissociação: } \frac{hc}{\lambda} \ge D_0 \quad (\text{O}_2:\ \lambda < 242\ \text{nm};\ \text{NO}_2:\ \lambda < 398\ \text{nm})`,
  ],
  liveEquations(s, p) {
    const m = molOf(p);
    const out = [String.raw`\text{${m.name}: } \mu_0 = ${texNum(m.mu)}\ \text{D} \qquad \text{absorvidos: } ${s.nAbs}/${s.nAbs + s.nTrans} = ${texNum(fAbs(s))}\ \ (\text{previsto } ${texNum(expectedAbsorption(m, p))})`];
    if (sourceOf(p) === 4) {
      const l = laserLam(p);
      out.push(String.raw`\lambda = \text{${fmtLam(l)}} \Rightarrow E = ${texNum(photonEV(l))}\ \text{eV},\ \tilde\nu = ${texNum(toNu(l), 4)}\ \text{cm}^{-1},\ P_{\text{abs}} = ${texNum(absorbP(m, l))}`);
    }
    out.push(String.raw`\text{potencial estufa (fração do IV a 288 K absorvida): } ${texNum(100 * greenhouseIndex(m))}\%`);
    return out;
  },

  params: [
    { key: "mol", label: "Molécula", unit: "", min: 0, max: 7, step: 1, default: 4, options: MOLECULES.map((m, i) => ({ value: i, label: `${m.formula} — ${m.name}` })) },
    { key: "fonte", label: "Fonte de luz", unit: "", min: 0, max: 4, step: 1, default: 1, options: SOURCES, live: true },
    { key: "lambda", label: "λ do laser", unit: "nm", min: 100, max: 1e8, step: 1, default: 15000, log: true, live: true },
    { key: "taxa", label: "Fótons por segundo", unit: "1/s", min: 0.5, max: 10, step: 0.5, default: 2, live: true },
    { key: "seed", label: "Semente", unit: "", min: 1, max: 999, step: 1, default: 1 },
  ],

  observables: [
    { key: "t", label: "Tempo de animação", unit: "s", value: (s) => s.t },
    { key: "nEmit", label: "Fótons emitidos pela fonte", unit: "", value: (s) => s.nEmit },
    { key: "nAbs", label: "Fótons absorvidos", unit: "", value: (s) => s.nAbs },
    { key: "nTrans", label: "Fótons que chegam ao detector", unit: "", value: (s) => s.nTrans },
    { key: "nReem", label: "Fótons reemitidos", unit: "", value: (s) => s.nReem },
    { key: "nDis", label: "Dissociações", unit: "", value: (s) => s.nDis },
    { key: "fAbs", label: "Fração absorvida (medida)", unit: "", value: (s) => fAbs(s) },
    { key: "fPrev", label: "Fração absorvida (prevista)", unit: "", value: (_s, p) => expectedAbsorption(molOf(p), p) },
    { key: "E", label: "Energia do fóton do laser", unit: "eV", value: (_s, p) => photonEV(laserLam(p)) },
    { key: "nu", label: "Número de onda do laser", unit: "1/cm", value: (_s, p) => toNu(laserLam(p)) },
    { key: "G", label: "Potencial estufa da molécula", unit: "", value: (_s, p) => greenhouseIndex(molOf(p)) },
  ],
  chart: { x: "t", y: "fAbs" },

  scenarios: [
    {
      id: "micro-ondas",
      label: "Micro-ondas: só as polares giram",
      params: { mol: 3, fonte: 0, taxa: 3 },
      guide: `### Rotação precisa de dipolo
1. Água ($\\mu_0 = 1{,}85$ D) sob micro-ondas: os fótons têm energia de ~$10^{-4}$ eV, pouca demais para vibrar, mas suficiente para mudar o estado de **rotação**. A molécula absorve e passa a girar.
2. Veja a seta do dipolo: o campo elétrico da onda faz torque sobre ele. É o princípio do forno de micro-ondas.
3. Troque para CO₂, CH₄ e N₂: sem dipolo permanente, nada acontece. CO gira, mas pouco ($\\mu_0 = 0{,}11$ D). O₂ absorve muito fracamente por seu dipolo **magnético** (60 GHz).
4. Depois de um tempo a molécula reemite o fóton em direção aleatória e volta a girar mais devagar.`,
      predict: [
        {
          question: "Quais destas moléculas absorvem micro-ondas (transições de rotação)?",
          options: ["Todas", "Só H₂O, CO, NO₂ e O₃, que têm dipolo elétrico permanente", "Só CO₂ e CH₄, que têm mais átomos"],
          answer: 1,
          explanation: "A rotação só acopla ao campo elétrico se houver dipolo permanente. N₂, O₂, CO₂ e CH₄ são simétricos (μ₀ = 0) e não têm espectro rotacional elétrico.",
        },
      ],
    },
    {
      id: "co2",
      label: "CO₂ no infravermelho: modos ativos e inativos",
      params: { mol: 4, fonte: 4, lambda: 15000, taxa: 3 },
      guide: `### A regra de seleção vibracional
1. Laser em $\\lambda = 15\\ \\mu$m ($667$ cm⁻¹): CO₂ absorve e entra no modo de **flexão**. A seta do dipolo passa a oscilar, embora a molécula não tenha dipolo permanente.
2. Mude para $\\lambda = 4{,}26\\ \\mu$m ($2349$ cm⁻¹): estiramento **assimétrico**, também ativo.
3. Agora $\\lambda = 7{,}5\\ \\mu$m ($1333$ cm⁻¹), o estiramento **simétrico**: o fóton passa direto! Os dois O se afastam igualmente, o dipolo continua zero (o modo só aparece no espectro Raman).
4. Compare com N₂ e O₂: o único modo (estiramento) não muda o dipolo, então são transparentes no IV.
5. Use a fonte **IV térmico da Terra**: CO₂ absorve parte e reemite em todas as direções — metade volta para baixo.`,
      predict: [
        {
          question: "CO₂ não tem dipolo permanente. Ele absorve infravermelho de 15 μm?",
          options: ["Não, sem dipolo não há absorção", "Sim: na flexão o dipolo oscila, e é isso que conta", "Só se estiver girando"],
          answer: 1,
          explanation: "A regra de seleção vibracional exige ∂μ/∂Q ≠ 0, não μ₀ ≠ 0. Na flexão, o C sobe enquanto os O descem, criando um dipolo que oscila a 2 × 10¹³ Hz, em ressonância com o fóton de 667 cm⁻¹.",
        },
      ],
    },
    {
      id: "uv",
      label: "Ultravioleta: dissociação e a camada de ozônio",
      params: { mol: 7, fonte: 3, taxa: 3 },
      guide: `### Fótons que quebram ligações
1. Ozônio sob UV (100–400 nm): fótons de 3–12 eV. Na banda de Hartley (200–310 nm) quase todo fóton quebra a molécula: O₃ → O₂ + O.
2. É assim que a camada de ozônio filtra o UV-B e o UV-C do Sol antes de chegarem ao solo.
3. Use o laser: O₂ só se dissocia abaixo de **242 nm** ($D_0 = 5{,}1$ eV), e fortemente abaixo de 175 nm. Os átomos de O livres formam O₃ na estratosfera.
4. NO₂ absorve no **visível** (é castanho) e se dissocia abaixo de 398 nm — origem do ozônio da poluição urbana.`,
      predict: [
        {
          question: "Um fóton de 300 nm (4,1 eV) atinge uma molécula de O₂, cuja energia de ligação é 5,1 eV. O que acontece?",
          options: ["Ela se dissocia", "Nada: a energia do fóton é insuficiente e não há transição nessa energia", "Ela se dissocia parcialmente"],
          answer: 1,
          explanation: "Absorção é tudo ou nada: o fóton precisa ter a energia de uma transição. 4,1 eV < 5,1 eV, e O₂ não tem estado eletrônico acessível nessa energia, então é transparente a 300 nm. Já O₃ (ligação de 1,1 eV) se dissocia.",
        },
      ],
    },
    {
      id: "estufa",
      label: "Quais gases são de efeito estufa?",
      params: { mol: 1, fonte: 1, taxa: 4 },
      guide: `### O efeito estufa, molécula a molécula
1. A superfície da Terra, a 288 K, emite IV entre 5 e 50 μm (curva vermelha do espectro). Com N₂, quase nada é absorvido.
2. Troque por O₂, CO₂, CH₄, H₂O, O₃: as barras à direita mostram a fração dessa radiação que cai em bandas de absorção de cada molécula.
3. N₂ e O₂ (99% do ar) são transparentes: são diatômicas homonucleares, sem dipolo e sem modo ativo no IV.
4. H₂O absorve em toda parte (rotação e vibração); CO₂ pega o pico da emissão terrestre (15 μm); O₃ e CH₄ fecham parte da "janela" de 8–13 μm.
5. A molécula **reemite** em direção aleatória: parte da energia volta para a superfície. O balanço de energia do planeta está na sim de transferência de calor.`,
      predict: [
        {
          question: "Por que o N₂ e o O₂, que formam 99% do ar, não são gases de efeito estufa?",
          options: ["Porque estão em concentração baixa", "Porque suas vibrações não mudam o dipolo elétrico, então não absorvem IV", "Porque absorvem só luz visível"],
          answer: 1,
          explanation: "Em moléculas diatômicas homonucleares o dipolo é zero em qualquer separação: ∂μ/∂Q = 0. Sem dipolo oscilante não há acoplamento com o campo elétrico do infravermelho.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "numero-onda",
      prompt: "Uma banda de absorção no infravermelho está em {nu} cm⁻¹. Qual é o comprimento de onda correspondente, em μm?",
      vary: { nu: [600, 3800, 0] },
      answer: { label: "λ", unit: "μm", compute: (p) => 1e4 / num(p, "nu") },
      hint: "λ = 1/ν̃; 1 cm = 10⁴ μm.",
    },
    {
      id: "dissociacao",
      prompt: "A energia de dissociação de uma ligação é {D} eV. Qual o maior comprimento de onda de um fóton capaz de rompê-la, em nm?",
      vary: { D: [1, 10, 2] },
      answer: { label: "λ_max", unit: "nm", compute: (p) => HC_EV_NM / num(p, "D") },
      hint: "hc = 1239,8 eV·nm.",
    },
  ],

  init: initState,
  step: (s, p, _t, dt) => step(s, p, dt),
  dt: 0.02,
  sampleEvery: 10,
  maxSamples: 1500,

  actions: [
    { id: "disparar", label: "Disparar 1 fóton", run: (s0, p) => { const s = structuredClone(s0); fire(s, p); return s; } },
    { id: "zerar", label: "Zerar contadores", run: (s) => ({ ...s, nEmit: 0, nAbs: 0, nTrans: 0, nReem: 0, nDis: 0 }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = molOf(p);
    const src = sourceOf(p);

    // fonte e detector
    d.rect(0.3, MOL_Y - 0.45, LAMP_X - 0.3, 0.9, { fill: theme.muted, alpha: 0.25, stroke: theme.text, width: 1.5 });
    d.text(src === 4 ? `laser ${fmtLam(laserLam(p))}` : ["micro-ondas", "IV 288 K", "visível", "UV"][src]!, 0.8, MOL_Y - 0.75, { size: 10 });
    d.rect(DET_X, MOL_Y - 0.6, 0.35, 1.2, { fill: theme.muted, alpha: 0.25, stroke: theme.text, width: 1.5 });
    d.text("detector", DET_X + 0.17, MOL_Y - 0.9, { size: 10 });
    d.line(LAMP_X, MOL_Y, DET_X, MOL_Y, { color: theme.grid, dash: [3, 5], width: 1 });

    // fótons: pacotes de onda com comprimento visual crescente com λ
    for (const q of s.ph) {
      const sp = Math.hypot(q.vx, q.vy) || 1;
      const ux = q.vx / sp, uy = q.vy / sp;
      const wl = Math.min(0.5, Math.max(0.08, 0.06 * (Math.log10(q.lam) - 1)));
      const pts: [number, number][] = [];
      for (let k = -12; k <= 12; k++) {
        const a = (k / 12) * 0.35;
        const amp = 0.09 * Math.exp(-((k / 8) ** 2)) * Math.sin((2 * Math.PI * a) / wl);
        pts.push([q.x + ux * a - uy * amp, q.y + uy * a + ux * amp]);
      }
      d.polyline(pts, { color: lamColor(q.lam, d), width: 2, alpha: q.re ? 0.7 : 1 });
    }

    drawMolecule(d, m, s);

    // contadores
    const lines = [
      `${m.formula} — ${m.name}   ·   μ₀ = ${fmt(m.mu)} D`,
      `emitidos ${s.nEmit}   absorvidos ${s.nAbs}   detectados ${s.nTrans}   reemitidos ${s.nReem}${s.nDis ? `   dissociações ${s.nDis}` : ""}`,
      `fração absorvida: ${fmt(fAbs(s))}   (prevista ${fmt(expectedAbsorption(m, p))})`,
    ];
    lines.forEach((l, i) => d.text(l, 0.3, 8.75 - i * 0.42, { size: i === 0 ? 12 : 10.5, weight: i === 0 ? "600" : "400", align: "left" }));
    if (s.last) d.text(s.last, 0.3, 4.05, { size: 10.5, color: theme.accent, align: "left" });
    // tabela de modos
    m.modes.forEach((md, k) => {
      const y = 5.25 - k * 0.4;
      const col = s.amp[k]! > 0 ? theme.positive : md.ir ? theme.text : theme.muted;
      d.text(`${md.name}: ${md.nu} cm⁻¹ (${fmtLam(1e7 / md.nu)}) ${md.ir ? "ativo no IV" : "inativo no IV"}${md.deg ? ` ×${md.deg}` : ""}`, 15.7, y, { size: 9.5, align: "right", color: col });
    });

    drawSpectrum(d, m, p);
    drawBars(d, m);
  },
});

function drawMolecule(d: Draw, m: Molecule, s: MlState) {
  const { theme } = d;
  const [cx, cy] = com(m);
  const disp = m.modes.map((_, k) => modeDisp(m, k));
  const c = Math.cos(s.theta), sn = Math.sin(s.theta);
  const dis = s.disT >= 0 ? s.t - s.disT : -1;
  const Mtot = m.atoms.reduce((a, at) => a + MASS[at.el], 0);
  const mLeave = MASS[m.atoms[m.leaves]!.el];
  const lv = m.atoms[m.leaves]!;
  const dl = Math.hypot(lv.x - cx, lv.y - cy);
  const dir = dl > 1e-6 ? [(lv.x - cx) / dl, (lv.y - cy) / dl] : [1, 0];
  const pos = m.atoms.map((a, i): [number, number] => {
    let x = a.x - cx, y = a.y - cy;
    m.modes.forEach((md, k) => {
      const A = s.amp[k]!;
      if (A > 0) {
        const f = 0.8 + md.nu / 1000;
        const w = 0.22 * A * Math.sin(2 * Math.PI * f * s.t);
        x += w * disp[k]![i]![0];
        y += w * disp[k]![i]![1];
      }
    });
    if (dis >= 0) {
      const v = 1.2 * dis;
      const k = i === m.leaves ? v * (1 - mLeave / Mtot) : -v * (mLeave / Mtot);
      x += k * dir[0]!;
      y += k * dir[1]!;
    }
    return [MOL_X + SC * (c * x - sn * y), MOL_Y + SC * (sn * x + c * y)];
  });
  if (s.glow > 0) d.circle(MOL_X, MOL_Y, 1.4, { fill: theme.series[5]!, alpha: 0.35 * s.glow });
  for (const [i, j, order] of m.bonds) {
    if (dis >= 0 && (i === m.leaves || j === m.leaves)) continue;
    const [x1, y1] = pos[i]!, [x2, y2] = pos[j]!;
    const L = Math.hypot(x2 - x1, y2 - y1) || 1;
    const nx = -(y2 - y1) / L, ny = (x2 - x1) / L;
    for (let o = 0; o < order; o++) {
      const off = (o - (order - 1) / 2) * 0.09;
      d.line(x1 + nx * off, y1 + ny * off, x2 + nx * off, y2 + ny * off, { color: theme.muted, width: 2.5 });
    }
  }
  const fill: Record<string, string> = { C: theme.dark ? "#6b7280" : "#3a3f47", O: "#d9453b", N: "#2f6fd9", H: theme.dark ? "#e6ebf2" : "#ffffff" };
  m.atoms.forEach((a, i) => {
    const [x, y] = pos[i]!;
    d.circle(x, y, RADIUS[a.el] * SC, { fill: fill[a.el]!, stroke: theme.text, width: 1 });
    d.text(a.el, x, y, { size: 10, weight: "600", color: a.el === "H" || (a.el === "C" && theme.dark) ? "#1c2430" : "#ffffff" });
  });
  // dipolo elétrico instantâneo (das cargas parciais)
  if (dis < 0) {
    let mx = 0, my = 0;
    m.atoms.forEach((_, i) => {
      mx += m.q[i]! * (pos[i]![0] - MOL_X);
      my += m.q[i]! * (pos[i]![1] - MOL_Y);
    });
    const k = 4 / SC;
    if (Math.hypot(mx, my) * k > 0.04) {
      d.arrow(MOL_X, MOL_Y, mx * k, my * k, { color: theme.accent, width: 2.5 });
      d.text("μ", MOL_X + mx * k, MOL_Y + my * k, { size: 11, color: theme.accent, dx: 9, dy: -6 });
    }
  } else d.text(`dissociou: ${s.disLabel}`, MOL_X, MOL_Y + 1.6, { size: 11, color: theme.positive, weight: "600" });
  if (s.omega > 0.1) d.text(`girando (${fmt(s.omega / (2 * Math.PI), 2)} voltas/s)`, MOL_X, MOL_Y - 1.65, { size: 10, color: theme.muted });
}

function drawSpectrum(d: Draw, m: Molecule, p: Params) {
  const { theme } = d;
  const X = (lam: number) => SP.x0 + ((Math.log10(lam) - SP.l0) / (SP.l1 - SP.l0)) * (SP.x1 - SP.x0);
  const Y = (v: number) => SP.y0 + v * (SP.y1 - SP.y0);
  const regions: [number, number, string, string][] = [
    [100, 400, "UV", "#8a4fd8"],
    [400, 700, "vis", "#c9a227"],
    [700, 1e6, "infravermelho", "#b8322c"],
    [1e6, 1e8, "micro-ondas", theme.muted],
  ];
  for (const [a, b, lab, col] of regions) {
    d.rect(X(a), SP.y0, X(b) - X(a), SP.y1 - SP.y0, { fill: col, alpha: 0.08 });
    d.text(lab, (X(a) + X(b)) / 2, SP.y1 + 0.2, { size: 9, color: theme.muted });
  }
  for (let k = SP.l0; k <= SP.l1; k++) d.text(fmtLam(10 ** k), X(10 ** k), SP.y0 - 0.22, { size: 8, color: theme.muted });
  d.line(SP.x0, SP.y0, SP.x1, SP.y0, { color: theme.muted });
  // emissão da Terra (288 K) e do Sol (5772 K), por ln λ, normalizadas
  const curve = (T: number, col: string) => {
    let mx = 0;
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) mx = Math.max(mx, planckLn(10 ** (SP.l0 + ((SP.l1 - SP.l0) * i) / 300), T));
    for (let i = 0; i <= 300; i++) {
      const l = 10 ** (SP.l0 + ((SP.l1 - SP.l0) * i) / 300);
      pts.push([X(l), Y(planckLn(l, T) / mx)]);
    }
    d.polyline(pts, { color: col, dash: [5, 4], width: 1.5 });
  };
  curve(288, theme.positive);
  curve(5772, theme.series[5]!);
  // absorção da molécula
  const pts: [number, number][] = [[X(100), SP.y0]];
  for (let i = 0; i <= 900; i++) {
    const l = 10 ** (SP.l0 + ((SP.l1 - SP.l0) * i) / 900);
    pts.push([X(l), Y(absorbP(m, l))]);
  }
  pts.push([X(1e8), SP.y0]);
  d.polyline(pts, { color: theme.accent, width: 1.8, fill: theme.accent, alpha: 0.5, close: true });
  // fonte atual
  const src = sourceOf(p);
  if (src === 4) {
    const l = laserLam(p);
    d.line(X(l), SP.y0, X(l), SP.y1, { color: theme.text, width: 2 });
    d.text(`laser: ${fmtLam(l)}, ${fmt(photonEV(l))} eV, ${regionOf(l)}`, X(l), SP.y1 + 0.45, { size: 9, align: X(l) > 7 ? "right" : "left" });
  } else {
    const [a, b] = ([[5e5, 5e7], [2.5e3, 2e5], [400, 700], [100, 400]] as const)[src]!;
    d.rect(X(a), SP.y0 - 0.06, X(b) - X(a), 0.06, { fill: theme.text });
  }
  d.text(`absorção de ${m.formula} por fóton`, SP.x0, SP.y1 + 0.5, { size: 10, color: theme.accent, align: "left", weight: "600" });
  d.text("--- Terra 288 K   --- Sol", SP.x1, SP.y1 + 0.5, { size: 9, color: theme.muted, align: "right" });
}

function drawBars(d: Draw, m: Molecule) {
  const { theme } = d;
  const n = MOLECULES.length;
  const w = (BAR.x1 - BAR.x0) / n;
  const mx = Math.max(...GH, 1e-6);
  d.line(BAR.x0, BAR.y0, BAR.x1, BAR.y0, { color: theme.muted });
  MOLECULES.forEach((mm, i) => {
    const h = (GH[i]! / mx) * (BAR.y1 - BAR.y0 - 0.2);
    const sel = mm.id === m.id;
    d.rect(BAR.x0 + i * w + 0.06, BAR.y0, w - 0.12, Math.max(h, 0.02), { fill: sel ? theme.positive : theme.accent, alpha: sel ? 0.9 : 0.5 });
    d.text(mm.formula, BAR.x0 + (i + 0.5) * w, BAR.y0 - 0.22, { size: 9, weight: sel ? "700" : "400" });
    d.text(`${Math.round(100 * GH[i]!)}%`, BAR.x0 + (i + 0.5) * w, BAR.y0 + Math.max(h, 0.02) + 0.15, { size: 8, color: theme.muted });
  });
  d.text("IV da Terra absorvível (por molécula)", BAR.x0, BAR.y1 + 0.5, { size: 10, align: "left", weight: "600" });
}

export default moleculasLuz;
