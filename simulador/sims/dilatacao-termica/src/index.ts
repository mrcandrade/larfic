import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

/** Materiais do tubo: α (1/K), densidade (kg/m³), calor específico (J/(kg·K)), condutividade (W/(m·K)), Young (Pa), parede (m). */
export const MATERIAIS = [
  { nome: "latão", alpha: 19e-6, rho: 8530, c: 380, k: 110, E: 100e9, parede: 0.001 },
  { nome: "cobre", alpha: 17e-6, rho: 8960, c: 385, k: 400, E: 120e9, parede: 0.001 },
  { nome: "alumínio", alpha: 23e-6, rho: 2700, c: 900, k: 237, E: 70e9, parede: 0.001 },
  { nome: "aço", alpha: 12e-6, rho: 7850, c: 470, k: 50, E: 200e9, parede: 0.001 },
  { nome: "vidro borossilicato", alpha: 3.3e-6, rho: 2230, c: 830, k: 1.1, E: 64e9, parede: 0.0015 },
];
/** Invar, a lâmina de referência do bimetal. */
export const INVAR = { alpha: 1.2e-6, E: 141e9 };
/** Temperatura do vapor d'água a 1 atm (°C). */
export const T_VAPOR = 100;
/** Coeficientes de troca de calor fluido–parede, W/(m²·K). */
export const H_VAPOR = 10000;
export const H_BANHO = 2000;
/** Constante de tempo do termômetro de bulbo na saída (s). */
export const TAU_TERMO = 2.5;
/** Lâmina bimetálica: comprimento livre e espessura total (m), metades iguais. */
export const LB = 0.12;
export const HB = 0.001;

const mat = (p: Params) => MATERIAIS[Math.min(4, Math.max(0, Math.round(num(p, "material"))))]!;
const vapor = (p: Params) => Math.round(num(p, "aquec")) === 0;
export const alphaOf = (p: Params) => mat(p).alpha;
/** Temperatura do fluido que circula no tubo. */
export const sourceTemp = (p: Params) => (vapor(p) ? T_VAPOR : num(p, "Tb", 60));

/** Constante de tempo da parede: τ = ρ c e (1/h + e/(2k)). */
export function tauTube(p: Params): number {
  const m = mat(p);
  const h = vapor(p) ? H_VAPOR : H_BANHO;
  return m.rho * m.c * m.parede * (1 / h + m.parede / (2 * m.k));
}

/** ΔL = α L₀ ΔT, em mm (o relógio comparador lê em mm). */
export const dilation = (p: Params, T: number) => alphaOf(p) * num(p, "L0", 0.5) * (T - num(p, "T0", 22)) * 1000;

/** Curvatura da lâmina bimetálica (Timoshenko, espessuras iguais), 1/m. */
export function bimetalCurvature(p: Params, T: number): number {
  const m = mat(p);
  const n = m.E / INVAR.E;
  const dT = T - num(p, "T0", 22);
  return (24 * (m.alpha - INVAR.alpha) * dT) / (HB * (12 + (1 + n) * (1 + 1 / n)));
}
/** Flecha da ponta da lâmina (m): δ = (1 − cos κL)/κ. */
export function bimetalDeflection(p: Params, T: number): number {
  const k = bimetalCurvature(p, T);
  return Math.abs(k) < 1e-12 ? (k * LB * LB) / 2 : (1 - Math.cos(k * LB)) / k;
}

const fmt = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
const alphaTxt = (a: number) => `${fmt(a * 1e6, 1)}×10⁻⁶ K⁻¹`;

// Geometria do palco
const TY = 0.06; // eixo do tubo
const TR = 0.018; // meio diâmetro desenhado do tubo
const DIAL = { x: 1.07, y: 0.2, r: 0.12 };
const BIM = { x: 0.93, y: -0.2, s: 2.2 };

export const dilatacaoTermica = defineSim({
  id: "dilatacao-termica",
  title: "Dilatômetro linear e lâmina bimetálica",
  course: "Exp II",
  topic: "Termometria",
  priority: "P1",
  summary:
    "Bancada de dilatação: um tubo metálico (ou de vidro) aquecido por vapor ou por banho termostático empurra um relógio comparador de centésimos de milímetro. Espere o equilíbrio térmico, leia o termômetro e o relógio e obtenha o coeficiente α; compare com a curvatura de uma lâmina bimetálica.",
  equations: [
    String.raw`\Delta L = \alpha\, L_0\, \Delta T \qquad \alpha = \frac{1}{L_0}\frac{\Delta L}{\Delta T}`,
    String.raw`\frac{dT}{dt} = \frac{T_f - T}{\tau}, \qquad \tau = \rho c\, e\left(\frac{1}{h} + \frac{e}{2k}\right)`,
    String.raw`\text{bimetal: } \kappa = \frac{1}{R} = \frac{24\,(\alpha_1 - \alpha_2)\,\Delta T}{h\,[12 + (1+n)(1+1/n)]}, \quad n = \frac{E_1}{E_2}`,
  ],
  liveEquations(s, p) {
    const T = s[0] ?? 22;
    const dT = T - num(p, "T0", 22);
    return [
      String.raw`\Delta L = ${texNum(alphaOf(p) * 1e6, 3)}\times 10^{-6}\ \text{K}^{-1}\cdot ${texNum(num(p, "L0", 0.5))}\ \text{m}\cdot ${texNum(dT, 3)}\ \text{K} = ${texNum(dilation(p, T), 3)}\ \text{mm}`,
      String.raw`T_{\text{tubo}} = ${texNum(T, 4)}\ {}^\circ\text{C} \qquad T_{\text{termômetro}} = ${texNum(s[1] ?? 22, 4)}\ {}^\circ\text{C} \qquad T_f = ${texNum(sourceTemp(p), 3)}\ {}^\circ\text{C} \qquad \tau = ${texNum(tauTube(p), 2)}\ \text{s}`,
      String.raw`\kappa = ${texNum(bimetalCurvature(p, T), 3)}\ \text{m}^{-1} \qquad \delta = ${texNum(bimetalDeflection(p, T) * 1000, 3)}\ \text{mm}`,
    ];
  },

  params: [
    {
      key: "material", label: "Material do tubo", unit: "", min: 0, max: 4, step: 1, default: 0,
      options: MATERIAIS.map((m, i) => ({ value: i, label: m.nome[0]!.toUpperCase() + m.nome.slice(1) })),
    },
    {
      key: "aquec", label: "Aquecimento", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Vapor d'água (100 °C)" },
        { value: 1, label: "Banho termostático" },
      ],
    },
    { key: "Tb", label: "Temperatura do banho", unit: "°C", min: 5, max: 95, step: 0.5, default: 60, live: true },
    { key: "T0", label: "Temperatura ambiente inicial", unit: "°C", min: 15, max: 30, step: 0.5, default: 22 },
    { key: "L0", label: "Comprimento inicial L₀ (apoio até o relógio)", unit: "m", min: 0.3, max: 0.8, step: 0.001, default: 0.5 },
    {
      key: "bimetal", label: "Lâmina bimetálica (material/invar)", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Não mostrar" },
        { value: 1, label: "Mostrar no mesmo banho" },
      ],
    },
  ],

  observables: [
    { key: "T", label: "Temperatura no termômetro", unit: "°C", value: (s) => s[1] ?? 0 },
    { key: "Ttubo", label: "Temperatura do tubo", unit: "°C", value: (s) => s[0] ?? 0 },
    { key: "dT", label: "Variação de temperatura do tubo ΔT", unit: "K", value: (s, p) => (s[0] ?? 0) - num(p, "T0", 22) },
    { key: "dL", label: "Dilatação ΔL (relógio comparador)", unit: "mm", value: (s, p) => dilation(p, s[0] ?? 0) },
    { key: "L0", label: "Comprimento inicial L₀", unit: "m", value: (_s, p) => num(p, "L0", 0.5) },
    { key: "L", label: "Comprimento atual L", unit: "m", value: (s, p) => num(p, "L0", 0.5) + dilation(p, s[0] ?? 0) / 1000 },
    { key: "kappa", label: "Curvatura da lâmina bimetálica", unit: "1/m", value: (s, p) => bimetalCurvature(p, s[0] ?? 0) },
    { key: "flecha", label: "Flecha da ponta da lâmina", unit: "mm", value: (s, p) => bimetalDeflection(p, s[0] ?? 0) * 1000 },
  ],
  chart: { x: "t", y: "dL" },

  scenarios: [
    {
      id: "vapor",
      label: "Tubo de latão no vapor",
      params: { material: 0, aquec: 0, T0: 22, L0: 0.5, bimetal: 0 },
      guide: `### Uma medida com vapor
1. Antes de ligar, o relógio comparador está zerado: o tubo está a $T_0 = 22$ °C.
2. Rode: o vapor entra pela esquerda e aquece o tubo. Acompanhe o ponteiro grande (cada divisão é 0,01 mm; uma volta completa é 1 mm, contada no mostrador pequeno).
3. Espere o termômetro e o relógio pararem. Anote $\\Delta L$ e $\\Delta T = T - T_0$.
4. Calcule $\\alpha = \\Delta L/(L_0\\,\\Delta T)$ e compare com a tabela (latão: cerca de $19\\times10^{-6}$ K⁻¹).
5. Troque o material e repita. Qual dilata mais?`,
      predict: [
        {
          question: "Com o mesmo comprimento e o mesmo aquecimento, qual tubo empurra mais o relógio comparador?",
          options: ["aço", "latão", "alumínio", "vidro"],
          answer: 2,
          explanation: "$\\Delta L = \\alpha L_0 \\Delta T$: vence o maior $\\alpha$. Alumínio ($23\\times10^{-6}$ K⁻¹) > latão (19) > cobre (17) > aço (12) > vidro borossilicato (3,3).",
        },
      ],
    },
    {
      id: "banho",
      label: "Banho termostático: ΔL contra T",
      params: { material: 0, aquec: 1, Tb: 35, T0: 22, L0: 0.5, bimetal: 0 },
      guide: `### Reta de calibração
1. Ajuste o banho para 35 °C e espere o termômetro estabilizar (cerca de 30 s).
2. Anote $T$ e $\\Delta L$. Suba o banho de 10 em 10 °C até 95 °C, sempre esperando o equilíbrio.
3. Faça o gráfico de $\\Delta L$ contra $T$: é uma reta de inclinação $\\alpha L_0$ que corta o eixo em $T_0$.
4. Leia o termômetro **durante** o aquecimento e compare: o termômetro atrasa em relação ao tubo, e o ponto sai da reta.`,
      predict: [
        {
          question: "Se você ler o termômetro e o relógio enquanto o tubo ainda está esquentando, o ponto (T, ΔL) ficará:",
          options: ["sobre a reta", "acima da reta (ΔL grande demais para o T lido)", "abaixo da reta"],
          answer: 1,
          explanation: "O bulbo do termômetro responde mais devagar que a parede fina do tubo: ele mostra uma temperatura menor que a do tubo, enquanto o relógio já registra a dilatação correspondente à temperatura real.",
        },
      ],
    },
    {
      id: "bimetal",
      label: "Lâmina bimetálica",
      params: { material: 0, aquec: 1, Tb: 80, T0: 22, L0: 0.5, bimetal: 1 },
      guide: `### Por que a lâmina curva
1. A lâmina é feita de latão (embaixo) soldado a invar (em cima), uma liga que quase não dilata.
2. Ao aquecer, o latão alonga mais: a lâmina curva com o latão do lado de fora (convexo).
3. A curvatura é proporcional a $\\Delta\\alpha\\,\\Delta T$: compare o latão com o alumínio e com o aço.
4. Esfrie o banho abaixo de $T_0$: a lâmina curva para o outro lado. É assim que funcionam termostatos e disjuntores térmicos.`,
    },
    {
      id: "vidro",
      label: "Vidro borossilicato",
      params: { material: 4, aquec: 0, T0: 22, L0: 0.6, bimetal: 0 },
      guide: `### Por que o vidro de laboratório aguenta choque térmico
1. O borossilicato tem $\\alpha \\approx 3{,}3\\times10^{-6}$ K⁻¹: o ponteiro mal dá um quarto de volta.
2. Repare também que ele demora mais para esquentar: o vidro conduz calor cerca de 100 vezes pior que o latão.
3. Pouca dilatação significa pouca tensão térmica entre a face quente e a fria: menos risco de trincar.`,
    },
  ],

  exercises: [
    {
      id: "dilatacao",
      prompt: "Um tubo de latão (α = 19×10⁻⁶ K⁻¹) tem {L0} m a {T0} °C e é aquecido com vapor a 100 °C. Quanto ele dilata, em milímetros?",
      vary: { L0: [0.3, 0.8, 3], T0: [15, 30, 0] },
      fixed: { material: 0, aquec: 0 },
      answer: { label: "ΔL", unit: "mm", compute: (p) => dilation(p, T_VAPOR) },
      tolerance: 0.01,
    },
    {
      id: "alfa",
      prompt: "No dilatômetro, um tubo de {L0} m a {T0} °C é aquecido até {T1} °C e o relógio comparador avança {dL} mm. Qual o coeficiente de dilatação linear?",
      vary: { L0: [0.4, 0.7, 3], T0: [18, 26, 0], T1: [60, 100, 0], dL: [0.3, 1.2, 2] },
      answer: { label: "α", unit: "1/K", compute: (p) => num(p, "dL") / 1000 / (num(p, "L0") * (num(p, "T1") - num(p, "T0"))) },
      hint: "α = ΔL/(L₀ ΔT); converta ΔL para metros.",
    },
  ],

  init: (p) => {
    const T0 = num(p, "T0", 22);
    return [T0, T0];
  },
  // Solução exata da relaxação exponencial em cada passo (T_f pode mudar ao vivo).
  step(s, p, _t, dt) {
    const Tf = sourceTemp(p);
    const T = s[0] ?? Tf;
    const Th = s[1] ?? Tf;
    // Tubo (τ₁) e termômetro (τ₂) em cascata: solução exata com T_f constante no passo.
    const t1 = tauTube(p);
    const t2 = TAU_TERMO;
    const u0 = T - Tf;
    const w0 = Th - Tf;
    const e1 = Math.exp(-dt / t1);
    const e2 = Math.exp(-dt / t2);
    const Tn = Tf + u0 * e1;
    const cross = Math.abs(t1 - t2) < 1e-9 ? (dt / t2) * e2 : (t1 / (t1 - t2)) * (e1 - e2);
    const Thn = Tf + w0 * e2 + u0 * cross;
    return [Tn, Thn];
  },
  dt: 0.02,
  sampleEvery: 5,
  tEnd: 600,

  viewport: () => ({ xMin: -0.12, xMax: 1.24, yMin: -0.42, yMax: 0.42, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const T = s[0] ?? 22;
    const Th = s[1] ?? 22;
    const L0 = num(p, "L0", 0.5);
    const m = mat(p);
    const dL = dilation(p, T);
    const hot = theme.positive;
    const metal = m.nome === "vidro borossilicato" ? (theme.series[0] ?? theme.accent) : m.nome === "cobre" ? "#c26a3d" : m.nome === "alumínio" ? "#9aa5b1" : m.nome === "aço" ? "#6b7682" : "#c9a227";
    const heat = Math.min(1, Math.max(0, (T - num(p, "T0", 22)) / 80));

    // Bancada
    d.support(-0.12, -0.4, 0.9, -0.4, { color: theme.muted });
    // Apoio fixo em x = 0
    d.rect(-0.05, TY - 0.06, 0.05, 0.12, { fill: theme.muted });
    d.rect(-0.08, -0.4, 0.11, TY - 0.06 + 0.4, { fill: theme.muted, alpha: 0.35 });
    d.text("apoio fixo", -0.025, TY + 0.085, { color: theme.muted, size: 10 });
    // Tubo (cor esquenta com T)
    d.rect(0, TY - TR, L0, 2 * TR, { fill: metal, alpha: 0.85, stroke: theme.text, width: 1 });
    d.rect(0, TY - TR, L0, 2 * TR, { fill: hot, alpha: 0.35 * heat });
    d.text(`tubo de ${m.nome} · L₀ = ${fmt(L0 * 1000, 0)} mm`, L0 / 2, TY + TR + 0.025, { color: theme.text, size: 11 });
    // Cotas de L₀
    d.line(0, TY - TR - 0.03, L0, TY - TR - 0.03, { color: theme.muted, width: 1 });
    d.line(0, TY - TR - 0.04, 0, TY - TR - 0.02, { color: theme.muted, width: 1 });
    d.line(L0, TY - TR - 0.04, L0, TY - TR - 0.02, { color: theme.muted, width: 1 });
    d.text("L₀", L0 / 2, TY - TR - 0.045, { color: theme.muted, size: 10 });

    // Relógio comparador na ponta livre
    d.line(L0, TY, L0 + 0.03, TY, { color: theme.text, width: 2 });
    d.rect(L0 + 0.03, TY - 0.035, 0.05, 0.07, { fill: theme.muted, stroke: theme.text, width: 1 });
    d.rect(L0 + 0.08, TY - 0.08, 0.02, 0.16, { fill: theme.muted, alpha: 0.6 });
    d.line(L0 + 0.08, TY + 0.035, DIAL.x - DIAL.r * 0.7, DIAL.y - DIAL.r * 0.7, { color: theme.muted, dash: [3, 3], width: 1 });

    // Mostrador ampliado
    d.circle(DIAL.x, DIAL.y, DIAL.r * 1.06, { fill: theme.muted, alpha: 0.35 });
    d.circle(DIAL.x, DIAL.y, DIAL.r, { fill: theme.dark ? "#1d232c" : "#fbfbf7", stroke: theme.text, width: 1.5 });
    for (let i = 0; i < 100; i++) {
      const a = Math.PI / 2 - (2 * Math.PI * i) / 100;
      const len = i % 10 === 0 ? 0.018 : i % 5 === 0 ? 0.012 : 0.007;
      const c = Math.cos(a);
      const sn = Math.sin(a);
      d.line(DIAL.x + c * DIAL.r * 0.97, DIAL.y + sn * DIAL.r * 0.97, DIAL.x + c * (DIAL.r * 0.97 - len), DIAL.y + sn * (DIAL.r * 0.97 - len), {
        color: theme.text,
        width: i % 10 === 0 ? 1.4 : 0.8,
      });
      if (i % 10 === 0) d.text(`${i}`, DIAL.x + c * DIAL.r * 0.74, DIAL.y + sn * DIAL.r * 0.74, { color: theme.text, size: 9 });
    }
    // Contador de voltas (1 volta = 1 mm), mostrador pequeno
    const cx = DIAL.x;
    const cy = DIAL.y - DIAL.r * 0.42;
    const cr = DIAL.r * 0.2;
    d.circle(cx, cy, cr, { stroke: theme.muted, width: 1 });
    for (let i = 0; i < 10; i++) {
      const a = Math.PI / 2 - (2 * Math.PI * i) / 10;
      d.line(cx + Math.cos(a) * cr, cy + Math.sin(a) * cr, cx + Math.cos(a) * cr * 0.75, cy + Math.sin(a) * cr * 0.75, { color: theme.muted, width: 1 });
    }
    const aSmall = Math.PI / 2 - (2 * Math.PI * dL) / 10;
    d.line(cx, cy, cx + Math.cos(aSmall) * cr * 0.85, cy + Math.sin(aSmall) * cr * 0.85, { color: theme.text, width: 1.5 });
    d.text("mm", cx, cy - cr - 0.012, { color: theme.muted, size: 8 });
    // Ponteiro grande: centésimos de mm
    const aBig = Math.PI / 2 - 2 * Math.PI * dL;
    d.line(DIAL.x - Math.cos(aBig) * DIAL.r * 0.15, DIAL.y - Math.sin(aBig) * DIAL.r * 0.15, DIAL.x + Math.cos(aBig) * DIAL.r * 0.9, DIAL.y + Math.sin(aBig) * DIAL.r * 0.9, {
      color: theme.positive,
      width: 2,
    });
    d.dot(DIAL.x, DIAL.y, 3.5, theme.text);
    d.text("relógio comparador · 0,01 mm", DIAL.x, DIAL.y + DIAL.r + 0.03, { color: theme.text, size: 10 });

    // Termômetro na saída do fluido
    const tx = Math.max(0.12, L0 - 0.07);
    const tb = TY + TR + 0.04;
    const tt = 0.38;
    const tY = (c: number) => tb + 0.02 + ((Math.max(-5, Math.min(110, c)) + 5) / 115) * (tt - tb - 0.03);
    d.rect(tx - 0.008, tb, 0.016, tt - tb, { fill: theme.dark ? "#1d232c" : "#ffffff", stroke: theme.muted, width: 1 });
    d.circle(tx, tb, 0.013, { fill: theme.positive });
    d.rect(tx - 0.0035, tb, 0.007, tY(Th) - tb, { fill: theme.positive });
    for (let c = 0; c <= 110; c += 10) {
      d.line(tx + 0.008, tY(c), tx + 0.016, tY(c), { color: theme.text, width: 0.8 });
      if (c % 20 === 0) d.text(`${c}`, tx + 0.02, tY(c), { color: theme.muted, size: 8, align: "left" });
    }
    d.line(tx, TY + TR, tx, tb - 0.013, { color: theme.muted, width: 2 });
    d.text(`T = ${fmt(Th)} °C`, tx - 0.02, tt - 0.01, { color: theme.text, size: 11, weight: "600", align: "right" });

    // Fonte de calor
    const by = -0.37;
    if (vapor(p)) {
      d.rect(0.04, by, 0.16, 0.16, { fill: theme.muted, alpha: 0.4, stroke: theme.text, width: 1 });
      d.rect(0.05, by + 0.01, 0.14, 0.09, { fill: theme.series[0] ?? theme.accent, alpha: 0.4 });
      for (let i = 0; i < 4; i++) d.polyline([[0.06 + i * 0.035, by - 0.005], [0.075 + i * 0.035, by - 0.03], [0.09 + i * 0.035, by - 0.005]], { color: theme.series[1], width: 1.5 });
      d.text("gerador de vapor", 0.12, by + 0.185, { color: theme.text, size: 10 });
      d.polyline([[0.12, by + 0.16], [0.12, TY - 0.08], [0.03, TY - 0.08], [0.03, TY - TR]], { color: theme.muted, width: 3 });
    } else {
      d.rect(0.02, by, 0.2, 0.16, { fill: theme.series[0] ?? theme.accent, alpha: 0.2, stroke: theme.text, width: 1 });
      d.rect(0.05, by + 0.1, 0.14, 0.045, { fill: theme.dark ? "#0c1015" : "#203040" });
      d.text(`${fmt(num(p, "Tb", 60))} °C`, 0.12, by + 0.123, { color: "#7cf08a", size: 11, weight: "600" });
      d.text("banho termostático", 0.12, by + 0.185, { color: theme.text, size: 10 });
      d.polyline([[0.08, by + 0.16], [0.08, TY - 0.08], [0.03, TY - 0.08], [0.03, TY - TR]], { color: theme.muted, width: 3 });
    }
    // Saída para o béquer (vapor condensado / retorno do banho)
    const ox = Math.max(0.3, L0 - 0.03);
    d.polyline([[ox, TY - TR], [ox, -0.26]], { color: theme.muted, width: 3 });
    d.polyline([[ox - 0.05, -0.25], [ox - 0.05, -0.38], [ox + 0.05, -0.38], [ox + 0.05, -0.25]], { color: theme.text, width: 1.2 });
    d.rect(ox - 0.05, -0.38, 0.1, 0.05, { fill: theme.series[0] ?? theme.accent, alpha: 0.35 });
    d.text(vapor(p) ? "condensado" : "retorno", ox, -0.24, { color: theme.muted, size: 9, dy: -6 });

    // Leitura geral
    d.text(`ΔL = ${fmt(dL, 3)} mm   ·   ΔT = ${fmt(T - num(p, "T0", 22))} K   ·   α(tabela) = ${alphaTxt(m.alpha)}`, 0.45, 0.37, {
      color: theme.text, size: 12, weight: "600",
    });

    // Lâmina bimetálica (detalhe ampliado)
    if (Math.round(num(p, "bimetal")) === 1) {
      const k = bimetalCurvature(p, T);
      const S = BIM.s;
      d.rect(BIM.x - 0.02, BIM.y - 0.12, 0.33, 0.24, { stroke: theme.grid, width: 1 });
      d.rect(BIM.x - 0.015, BIM.y - 0.025, 0.015, 0.05, { fill: theme.muted });
      const strip = (off: number): [number, number][] => {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 40; i++) {
          const sArc = (LB * i) / 40;
          const th = k * sArc;
          // centro da lâmina; normal (−sen θ, cos θ)
          const x = Math.abs(k) < 1e-9 ? sArc : Math.sin(th) / k;
          const y = Math.abs(k) < 1e-9 ? 0 : (1 - Math.cos(th)) / k;
          pts.push([BIM.x + S * (x - Math.sin(th) * off), BIM.y + S * (y + Math.cos(th) * off)]);
        }
        return pts;
      };
      const half = HB / 2;
      // Espessura exagerada 6× para ficar visível
      const ex = 6;
      const lower = strip(-half * ex);
      const mid = strip(0);
      const upper = strip(half * ex);
      d.polyline([...lower, ...mid.slice().reverse()], { color: theme.text, width: 0.6, close: true, fill: metal });
      d.polyline([...mid, ...upper.slice().reverse()], { color: theme.text, width: 0.6, close: true, fill: theme.muted });
      d.line(BIM.x, BIM.y, BIM.x + S * LB, BIM.y, { color: theme.muted, dash: [3, 3], width: 1 });
      const tip = mid[mid.length - 1]!;
      d.text(`invar (cima) / ${m.nome} (baixo)`, BIM.x + 0.145, BIM.y + 0.1, { color: theme.text, size: 9 });
      d.text(`flecha ${fmt(bimetalDeflection(p, T) * 1000, 1)} mm · R = ${Math.abs(k) < 1e-3 ? "∞" : fmt(1 / Math.abs(k), 2) + " m"}`, BIM.x + 0.145, BIM.y - 0.1, {
        color: theme.text, size: 9,
      });
      d.dot(tip[0], tip[1], 2.5, theme.positive);
    }
  },
});

export default dilatacaoTermica;
