import { defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";

/** Constante dos gases, J/(mol·K). */
export const R = 8.314462618;
/** Temperatura do ponto triplo da água, por definição (K). */
export const T3 = 273.16;
/** Massa específica do mercúrio (kg/m³) e g (m/s²) para a coluna do manômetro. */
const RHO_HG = 13595;
const G = 9.80665;

/** Gases do bulbo: constantes de van der Waals a (Pa·m⁶/mol²) e b (m³/mol). */
export const GASES = [
  { nome: "Hidrogênio (H₂)", curto: "H₂", a: 0.02476, b: 2.661e-5 },
  { nome: "Hélio (He)", curto: "He", a: 0.00346, b: 2.38e-5 },
  { nome: "Nitrogênio (N₂)", curto: "N₂", a: 0.137, b: 3.87e-5 },
  { nome: "Oxigênio (O₂)", curto: "O₂", a: 0.1382, b: 3.186e-5 },
];

/** Banhos cuja temperatura o termômetro mede (valores de referência da ITS-90, em K). */
export const BANHOS = [
  { nome: "Água fervendo a 1 atm", T: 373.124 },
  { nome: "Nitrogênio líquido a 1 atm", T: 77.355 },
  { nome: "Gálio fundindo", T: 302.9146 },
  { nome: "Zinco solidificando", T: 692.677 },
  { nome: "Temperatura escolhida", T: NaN },
];

export const gasOf = (p: Params) => GASES[Math.min(GASES.length - 1, Math.max(0, Math.round(num(p, "gas", 2))))]!;
/** Temperatura verdadeira do banho (K). */
export function bathT(p: Params): number {
  const i = Math.min(BANHOS.length - 1, Math.max(0, Math.round(num(p, "banho"))));
  return i === BANHOS.length - 1 ? num(p, "Tx", 310.15) : BANHOS[i]!.T;
}

/** Pressão de van der Waals (Pa) para volume molar V (m³/mol) e temperatura T (K). */
export const pVdw = (g: { a: number; b: number }, V: number, T: number) => (R * T) / (V - g.b) - g.a / (V * V);

/** Volume molar (ramo gasoso) com pressão p (Pa) a T (K), por Newton a partir do gás ideal. */
export function molarVolume(g: { a: number; b: number }, p: number, T: number): number {
  let V = (R * T) / p;
  for (let i = 0; i < 60; i++) {
    const f = pVdw(g, V, T) - p;
    const df = (-R * T) / (V - g.b) ** 2 + (2 * g.a) / V ** 3;
    const dV = f / df;
    V -= dV;
    if (Math.abs(dV) < 1e-15 * V) break;
  }
  return V;
}

/** Leitura do termômetro: p₃ no ponto triplo (dado), p no banho e T* = 273,16 K·p/p₃. */
export function reading(p: Params, gas = gasOf(p), p3kPa = num(p, "p3", 80), T = bathT(p)) {
  const p3 = p3kPa * 1000;
  const V = molarVolume(gas, p3, T3); // o bulbo tem volume fixo: o volume molar não muda
  const pb = pVdw(gas, V, T);
  return { p3, p: pb, V, Tstar: (T3 * pb) / p3 };
}

export const toCelsius = (T: number) => T - 273.15;
export const toFahrenheit = (T: number) => (9 / 5) * toCelsius(T) + 32;

export interface Leitura {
  gas: number;
  banho: number;
  Tx: number;
  p3: number;
  T: number;
}
export interface TermState {
  pts: Leitura[];
}

/** Ajuste linear T* = A + B·p₃ das leituras do gás e do banho atuais; devolve A (extrapolação p₃ → 0). */
export function extrapolate(s: TermState, p: Params): { A: number; B: number; n: number } {
  const g = Math.round(num(p, "gas", 2)), b = Math.round(num(p, "banho"));
  const pts = s.pts.filter((q) => q.gas === g && q.banho === b && (b !== BANHOS.length - 1 || q.Tx === num(p, "Tx", 310.15)));
  const n = pts.length;
  const ps = [...new Set(pts.map((q) => q.p3))];
  if (ps.length < 2) return { A: NaN, B: NaN, n };
  const mx = pts.reduce((a, q) => a + q.p3, 0) / n;
  const my = pts.reduce((a, q) => a + q.T, 0) / n;
  let sxy = 0, sxx = 0;
  for (const q of pts) {
    sxy += (q.p3 - mx) * (q.T - my);
    sxx += (q.p3 - mx) ** 2;
  }
  const B = sxy / sxx;
  return { A: my - B * mx, B, n };
}

/** Número com `d` casas decimais, vírgula e sinal de menos tipográfico. */
const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",").replace(/^-/, "−") : "—");
const f3 = (v: number) => v.toFixed(3).replace(".", ",");
const naCelula = (p: Params) => Math.round(num(p, "etapa")) === 0;

// Painéis (unidades do palco)
const GR = { x0: 7.2, x1: 15.6, y0: 4.9, y1: 8.4 };
const SC = { y0: 0.7, y1: 3.9 };

function drawApparatus(d: Draw, theme: Theme, p: Params) {
  const r = reading(p);
  const cel = naCelula(p);
  const pNow = cel ? r.p3 : r.p;
  const hmm = (pNow / (RHO_HG * G)) * 1000;
  // recipiente (célula do ponto triplo ou banho)
  const bx = 0.5, by = 0.5, bw = 2.8, bh = 3.2;
  d.rect(bx, by, bw, bh, { fill: cel ? theme.series[0]! : theme.series[3]!, alpha: 0.18 });
  d.rect(bx, by, bw, bh, { stroke: theme.text, width: 1.5 });
  if (cel) {
    // gelo, água e vapor coexistindo
    d.rect(bx + 0.2, by + 0.2, bw - 0.4, 1.2, { fill: theme.series[0]!, alpha: 0.3 });
    d.rect(bx + 0.5, by + 1.4, bw - 1.0, 0.5, { fill: "#ffffff", alpha: 0.6, stroke: theme.muted, width: 1 });
    d.text("gelo + água + vapor", bx + bw / 2, by + bh + 0.3, { color: theme.text, size: 11, weight: "600" });
    d.text("célula do ponto triplo: 273,16 K", bx + bw / 2, by - 0.25, { color: theme.muted, size: 10 });
  } else {
    const i = Math.round(num(p, "banho"));
    d.text(BANHOS[i]?.nome ?? "", bx + bw / 2, by + bh + 0.3, { color: theme.text, size: 11, weight: "600" });
    d.text("banho cuja temperatura se quer medir", bx + bw / 2, by - 0.25, { color: theme.muted, size: 10 });
  }
  // bulbo e capilar
  const cx = bx + bw / 2, cy = by + 1.5;
  d.circle(cx, cy, 0.45, { fill: theme.series[2]!, alpha: 0.5, stroke: theme.text, width: 1.5 });
  d.text(gasOf(p).curto, cx, cy, { color: theme.text, size: 11, weight: "700" });
  const mx = 5.0;
  d.polyline([[cx, cy + 0.45], [cx, 4.6], [mx, 4.6], [mx, 1.0]], { color: theme.text, width: 2 });
  // manômetro de mercúrio absoluto (vácuo no topo)
  const top = 7.6, foot = 1.0;
  const Hmax = 2000; // mm na escala
  const hh = Math.min(1, hmm / Hmax) * (top - foot - 0.3);
  d.rect(mx + 0.4, foot, 0.25, top - foot, { stroke: theme.text, width: 1.2 });
  d.rect(mx + 0.4, foot, 0.25, hh, { fill: theme.muted, alpha: 0.9 });
  d.line(mx, foot, mx + 0.52, foot, { color: theme.text, width: 2 });
  d.text("vácuo", mx + 0.52, top - 0.2, { color: theme.muted, size: 9 });
  for (let mm = 0; mm <= Hmax; mm += 250) {
    const y = foot + (mm / Hmax) * (top - foot - 0.3);
    d.line(mx + 0.65, y, mx + 0.8, y, { color: theme.muted, width: 1 });
    if (mm % 500 === 0) d.text(`${mm}`, mx + 0.85, y, { color: theme.muted, size: 9, align: "left" });
  }
  d.text("mm Hg", mx + 0.85, top + 0.1, { color: theme.muted, size: 9, align: "left" });
  d.text(`h = ${fmt(hmm, 1)} mm`, mx - 0.1, foot + hh, { color: theme.text, size: 11, weight: "600", align: "right" });
  d.line(mx + 0.05, foot + hh, mx + 0.4, foot + hh, { color: theme.muted, width: 1, dash: [2, 2] });
  d.text(cel ? `p₃ = ρgh = ${fmt(r.p3 / 1000, 3)} kPa` : `p = ρgh = ${fmt(r.p / 1000, 3)} kPa`, 0.4, 8.6, { color: theme.text, size: 13, weight: "700", align: "left" });
  d.text(
    cel ? "Calibração: anote p₃ e mude a etapa para o banho." : `T = 273,16 K · p/p₃ = 273,16 · ${fmt(r.p / 1000, 3)}/${fmt(r.p3 / 1000, 3)} = ${f3(r.Tstar)} K`,
    0.4,
    8.1,
    { color: theme.accent, size: 12, weight: "600", align: "left" },
  );
}

function drawGraph(d: Draw, theme: Theme, s: TermState, p: Params) {
  const Ttrue = bathT(p);
  const gIdx = Math.round(num(p, "gas", 2));
  const bIdx = Math.round(num(p, "banho"));
  // faixa vertical: desvios típicos até ~0,5% em 100 kPa
  const span = Math.max(0.6, ...GASES.map((g) => Math.abs(reading(p, g, 100).Tstar - Ttrue))) * 1.15;
  const X = (p3: number) => GR.x0 + (p3 / 100) * (GR.x1 - GR.x0);
  const Y = (T: number) => (GR.y0 + GR.y1) / 2 + ((T - Ttrue) / span) * ((GR.y1 - GR.y0) / 2);
  d.rect(GR.x0, GR.y0, GR.x1 - GR.x0, GR.y1 - GR.y0, { stroke: theme.grid, width: 1 });
  d.line(GR.x0, Y(Ttrue), GR.x1, Y(Ttrue), { color: theme.muted, width: 1, dash: [5, 4] });
  d.text(`${f3(Ttrue)} K`, GR.x0, Y(Ttrue), { color: theme.muted, size: 10, align: "right", dx: -4 });
  for (const q of [0, 20, 40, 60, 80, 100]) d.text(`${q}`, X(q), GR.y0 - 0.2, { color: theme.muted, size: 9 });
  d.text("p₃ (kPa)", GR.x1, GR.y0 - 0.5, { color: theme.muted, size: 10, align: "right" });
  d.text("T lida (K)", GR.x0, GR.y1 + 0.25, { color: theme.muted, size: 10, align: "left" });
  d.text(`${fmt(Ttrue + span, 2)}`, GR.x0, GR.y1, { color: theme.muted, size: 9, align: "right", dx: -4 });
  d.text(`${fmt(Ttrue - span, 2)}`, GR.x0, GR.y0, { color: theme.muted, size: 9, align: "right", dx: -4 });
  const clip = (T: number) => Math.max(GR.y0, Math.min(GR.y1, Y(T)));
  if (Math.round(num(p, "teoria")) === 1) {
    GASES.forEach((g, i) => {
      const pts: [number, number][] = [];
      for (let q = 1; q <= 100; q += 3) pts.push([X(q), clip(reading(p, g, q).Tstar)]);
      d.polyline(pts, { color: theme.series[i]!, width: 1.2, alpha: 0.6, dash: [4, 3] });
      d.text(g.curto, X(100), clip(reading(p, g, 100).Tstar), { color: theme.series[i]!, size: 10, align: "left", dx: 4 });
    });
  }
  for (const q of s.pts) {
    if (q.banho !== bIdx || (bIdx === BANHOS.length - 1 && q.Tx !== num(p, "Tx", 310.15))) continue;
    d.dot(X(q.p3), clip(q.T), q.gas === gIdx ? 5 : 3.5, theme.series[q.gas]!, q.gas === gIdx ? 1 : 0.6);
  }
  const fit = extrapolate(s, p);
  if (Number.isFinite(fit.A)) {
    d.line(X(0), clip(fit.A), X(100), clip(fit.A + 100 * fit.B), { color: theme.series[gIdx]!, width: 2 });
    d.dot(X(0), clip(fit.A), 6, theme.accent);
    d.text(`extrapolação p₃ → 0: ${f3(fit.A)} K`, GR.x0 + 0.15, GR.y1 - 0.3, { color: theme.accent, size: 12, weight: "600", align: "left" });
  } else {
    d.text("Registre leituras com pelo menos dois valores de p₃.", GR.x0 + 0.15, GR.y1 - 0.3, { color: theme.muted, size: 11, align: "left" });
  }
}

function drawScales(d: Draw, theme: Theme, p: Params) {
  const T = naCelula(p) ? T3 : reading(p).Tstar;
  const cols = [
    { nome: "Kelvin (K)", x: 8.9, conv: (k: number) => k },
    { nome: "Celsius (°C)", x: 11.6, conv: toCelsius },
    { nome: "Fahrenheit (°F)", x: 14.2, conv: toFahrenheit },
  ];
  const refs: [number, string][] = [
    [0, "zero absoluto"],
    [273.15, "gelo fundindo"],
    [310.15, "corpo humano"],
    [373.124, "água fervendo"],
  ];
  const Tmax = Math.max(400, T * 1.05);
  const Y = (k: number) => SC.y0 + (k / Tmax) * (SC.y1 - SC.y0);
  for (const c of cols) {
    d.line(c.x, SC.y0, c.x, SC.y1, { color: theme.muted, width: 6, alpha: 0.35 });
    d.line(c.x, SC.y0, c.x, Y(Math.max(0, T)), { color: theme.negative, width: 6 });
    d.text(c.nome, c.x, SC.y1 + 0.3, { color: theme.text, size: 11, weight: "600" });
    for (const [k] of refs) {
      d.line(c.x - 0.15, Y(k), c.x + 0.15, Y(k), { color: theme.text, width: 1 });
      d.text(fmt(c.conv(k), k === 373.124 ? 3 : 2), c.x + 0.2, Y(k), { color: theme.muted, size: 9, align: "left" });
    }
    d.text(fmt(c.conv(T), 2), c.x - 0.2, Y(Math.max(0, T)), { color: theme.negative, size: 11, weight: "700", align: "right" });
  }
  for (const [k, nome] of refs) d.text(nome, 6.3, Y(k), { color: theme.muted, size: 9, align: "left" });
  d.text("Leitura atual nas três escalas: T_C = T − 273,15   ·   T_F = (9/5) T_C + 32", 11, 0.25, { color: theme.text, size: 11 });
}

export const termometroGas = defineSim<TermState>({
  id: "termometro-gas",
  title: "Termômetro de gás e escalas de temperatura",
  course: "FG II",
  topic: "Temperatura",
  priority: "P1",
  summary:
    "Termômetro de gás a volume constante calibrado no ponto triplo da água: leia a pressão na coluna de mercúrio, calcule T = 273,16 K·p/p₃, repita com menos gás e com outros gases e extrapole para p₃ → 0. A leitura aparece nas escalas Kelvin, Celsius e Fahrenheit.",
  equations: [
    String.raw`T = (273{,}16\ \text{K})\,\lim_{p_3\to 0}\frac{p}{p_3} \qquad p = \rho g h`,
    String.raw`T_C = T - 273{,}15 \qquad T_F = \tfrac95\,T_C + 32`,
    String.raw`\text{gás real (van der Waals): } \Big(p + \frac{a}{V_m^2}\Big)(V_m - b) = RT,\quad V_m\ \text{fixo pelo bulbo}`,
  ],
  liveEquations(_s, p) {
    const r = reading(p);
    return [
      String.raw`T = 273{,}16\ \text{K}\cdot\frac{${texNum(r.p / 1000, 5)}\ \text{kPa}}{${texNum(r.p3 / 1000, 5)}\ \text{kPa}} = ${texNum(r.Tstar, 6)}\ \text{K}`,
      String.raw`T_C = ${texNum(toCelsius(r.Tstar), 5)}\ {}^\circ\text{C} \qquad T_F = ${texNum(toFahrenheit(r.Tstar), 5)}\ {}^\circ\text{F} \qquad T - T_{\text{banho}} = ${texNum(r.Tstar - bathT(p), 3)}\ \text{K}`,
    ];
  },
  derivation: String.raw`### 1. Hipóteses
- O bulbo tem volume fixo e guarda $n$ mols de gás; o capilar que o liga ao manômetro tem volume desprezível. Assim o volume molar $V_m = V/n$ é o mesmo na calibração e na medida.
- O gás é descrito pela equação de van der Waals, com as constantes $a$ e $b$ tabeladas de cada gás. Ela basta para mostrar o desvio de primeira ordem em relação ao gás ideal, que é o que a extrapolação elimina.
- O manômetro é de mercúrio, com vácuo no topo (manômetro absoluto): $p = \rho g h$, com $\rho = 13\,595$ kg/m³ e $g = 9{,}80665$ m/s². A dilatação do vidro e do mercúrio é ignorada.
- As temperaturas dos banhos são os valores de referência da ITS-90 (água fervendo a 1 atm, nitrogênio líquido, fusão do gálio, solidificação do zinco), tratados como exatos.

### 2. Calibração no ponto triplo
Por definição, o ponto triplo da água está a $T_3 = 273{,}16$ K. Com o bulbo na célula, a pressão medida é $p_3$. O volume molar sai da equação de estado,
$$\Big(p_3 + \frac{a}{V_m^2}\Big)(V_m - b) = R\,T_3 ,$$
resolvida pelo método de Newton a partir do valor do gás ideal $V_m^{(0)} = RT_3/p_3$ (ramo gasoso).

### 3. Medida no banho
Com o mesmo $V_m$ e o banho a $T$,
$$p = \frac{RT}{V_m - b} - \frac{a}{V_m^2}, \qquad T_{\text{lida}} = T_3\,\frac{p}{p_3} .$$
$T_{\text{lida}}$ é a temperatura que o termômetro indica, calculada como se o gás fosse ideal.

### 4. Por que a extrapolação funciona
Para gás rarefeito, $pV_m \approx RT\,[1 + B(T)/V_m]$, com o segundo coeficiente do virial $B(T) = b - a/(RT)$. Então
$$T_{\text{lida}} \approx T\,\Big[1 + \frac{B(T) - B(T_3)}{V_m}\Big] .$$
O desvio é proporcional a $1/V_m$, isto é, a $p_3$: o gráfico de $T_{\text{lida}}$ contra $p_3$ é quase uma reta, com inclinação que depende do gás, e todas as retas passam por $T$ em $p_3 = 0$. Para o N₂ a 373 K, $B(T) - B(T_3) \approx 1{,}6\times10^{-5}$ m³/mol, e com $p_3 = 80$ kPa o termômetro marca uns 0,2 K a mais.

### 5. Escalas
$T_C = T - 273{,}15$ e $T_F = \tfrac95 T_C + 32$. A diferença de 0,01 entre 273,16 e 273,15 é a diferença entre o ponto triplo e a fusão do gelo a 1 atm.

### 6. Método numérico
Newton com derivada analítica, $dp/dV_m = -RT/(V_m - b)^2 + 2a/V_m^3$, até variação relativa abaixo de $10^{-15}$. Não há evolução no tempo (simulação estática). A extrapolação é um ajuste linear por mínimos quadrados das leituras registradas do gás e do banho atuais, e o ponto em $p_3 = 0$ é o coeficiente linear da reta.`,

  params: [
    { key: "gas", label: "Gás do bulbo", unit: "", min: 0, max: GASES.length - 1, step: 1, default: 2, options: GASES.map((g, i) => ({ value: i, label: g.nome })) },
    { key: "p3", label: "Pressão no ponto triplo p₃ (quantidade de gás)", unit: "kPa", min: 5, max: 100, step: 1, default: 80, live: true },
    {
      key: "etapa", label: "Onde está o bulbo", unit: "", min: 0, max: 1, step: 1, default: 1, live: true,
      options: [
        { value: 0, label: "Na célula do ponto triplo (calibração)" },
        { value: 1, label: "No banho (medida)" },
      ],
    },
    { key: "banho", label: "Banho", unit: "", min: 0, max: BANHOS.length - 1, step: 1, default: 0, live: true, options: BANHOS.map((b, i) => ({ value: i, label: Number.isFinite(b.T) ? `${b.nome} (${f3(b.T)} K)` : b.nome })) },
    { key: "Tx", label: "Temperatura escolhida (último banho)", unit: "K", min: 20, max: 1000, step: 0.05, default: 310.15, live: true },
    {
      key: "teoria", label: "Curvas dos quatro gases", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Esconder" },
        { value: 1, label: "Mostrar" },
      ],
    },
  ],

  observables: [
    { key: "p3", label: "Pressão no ponto triplo p₃", unit: "kPa", value: (_s, p) => reading(p).p3 / 1000 },
    { key: "p", label: "Pressão no banho p", unit: "kPa", value: (_s, p) => reading(p).p / 1000 },
    { key: "h", label: "Altura da coluna de mercúrio agora", unit: "mm", value: (_s, p) => ((naCelula(p) ? reading(p).p3 : reading(p).p) / (RHO_HG * G)) * 1000 },
    { key: "T", label: "Temperatura lida T = 273,16 K·p/p₃", unit: "K", value: (_s, p) => reading(p).Tstar },
    { key: "Tc", label: "Temperatura lida em Celsius", unit: "°C", value: (_s, p) => toCelsius(reading(p).Tstar) },
    { key: "Tf", label: "Temperatura lida em Fahrenheit", unit: "°F", value: (_s, p) => toFahrenheit(reading(p).Tstar) },
    { key: "erro", label: "Desvio da leitura (T lida − T do banho)", unit: "K", value: (_s, p) => reading(p).Tstar - bathT(p) },
    { key: "Text", label: "Extrapolação p₃ → 0 (0 se faltam leituras)", unit: "K", value: (s, p) => { const A = extrapolate(s, p).A; return Number.isFinite(A) ? A : 0; } },
    { key: "n", label: "Leituras registradas (gás e banho atuais)", unit: "", value: (s, p) => extrapolate(s, p).n },
  ],
  chart: { x: "p3", y: "T" },

  scenarios: [
    {
      id: "ponto-triplo",
      label: "Calibração no ponto triplo",
      params: { gas: 2, p3: 80, etapa: 0, banho: 0, teoria: 0 },
      guide: `### O ponto fixo da escala Kelvin
1. O bulbo está numa **célula do ponto triplo**: gelo, água líquida e vapor coexistem em equilíbrio. Isso só acontece numa única temperatura e numa única pressão, por isso é um padrão reprodutível. Por definição, $T_3 = 273{,}16$ K.
2. Leia a altura da coluna de mercúrio e calcule $p_3 = \\rho g h$. Confira com o valor exibido.
3. Mude a etapa para **No banho** (água fervendo). A pressão sobe; como o volume do bulbo não muda, a temperatura é proporcional à pressão: $T = 273{,}16\\ \\text{K}\\cdot p/p_3$.
4. Compare a leitura com 373,124 K. A diferença, de alguns décimos de kelvin, vem de o gás não ser ideal. O próximo cenário mostra como eliminá-la.`,
      predict: [
        {
          question: "Por que o ponto triplo da água, e não o ponto de fusão do gelo, foi escolhido como ponto fixo da escala Kelvin?",
          options: [
            "Porque é mais quente",
            "Porque ocorre numa só pressão e numa só temperatura, sem precisar fixar a pressão externa",
            "Porque é o zero da escala Celsius",
          ],
          answer: 1,
          explanation: "A fusão do gelo depende da pressão ambiente. As três fases da água só coexistem num único par $(p, T)$: basta montar a célula para reproduzir exatamente 273,16 K (0,01 °C).",
        },
      ],
    },
    {
      id: "extrapolacao",
      label: "Extrapolação para p₃ → 0",
      params: { gas: 2, p3: 80, etapa: 1, banho: 0, teoria: 0 },
      guide: `### Uma escala que não depende do gás
1. Com N₂ e $p_3 = 80$ kPa, clique em **Registrar leitura**. A leitura passa um pouco de 373,124 K.
2. Tire gás do bulbo: repita com $p_3$ = 60, 40 e 20 kPa, registrando cada vez. Os pontos ficam numa reta.
3. A reta ajustada, extrapolada até $p_3 = 0$, cai em cima de 373,12 K.
4. Troque o gás (H₂, He, O₂) e repita. Cada gás dá uma reta diferente, mas **todas convergem** para o mesmo valor em $p_3 \\to 0$. Ligue as **curvas dos quatro gases** para conferir.
5. É assim que se define a temperatura do gás ideal: $T = (273{,}16\\ \\text{K})\\lim_{p_3\\to0}(p/p_3)$.`,
      predict: [
        {
          question: "Termômetros de N₂ e de H₂ medem água fervendo com p₃ = 80 kPa e dão leituras diferentes. Ao reduzir a quantidade de gás:",
          options: ["a diferença aumenta", "as leituras convergem para um mesmo valor", "as duas leituras vão a zero"],
          answer: 1,
          explanation: "Com o gás cada vez mais rarefeito, as interações entre moléculas e o volume próprio delas deixam de importar: todo gás se comporta como ideal e $p/p_3 \\to T/T_3$.",
        },
      ],
    },
    {
      id: "escalas",
      label: "Kelvin, Celsius e Fahrenheit",
      params: { gas: 1, p3: 10, etapa: 1, banho: 4, Tx: 310.15, teoria: 0 },
      guide: `### Conversão de escalas
1. O termômetro de hélio, com pouco gás, mede a temperatura escolhida (corpo humano, 310,15 K). Leia o valor nas três colunas.
2. Celsius só desloca o zero: $T_C = T - 273{,}15$. Uma variação de 1 K é uma variação de 1 °C.
3. Fahrenheit muda também o tamanho do grau: $T_F = \\tfrac95 T_C + 32$. Uma variação de 1 °C é de 1,8 °F.
4. Mude a temperatura escolhida e ache o valor em que Celsius e Fahrenheit coincidem.
5. Por que não existe temperatura negativa na escala Kelvin?`,
      predict: [
        {
          question: "Em que temperatura as escalas Celsius e Fahrenheit marcam o mesmo número?",
          options: ["0", "−40", "100", "Nunca coincidem"],
          answer: 1,
          explanation: "$T_F = T_C$ dá $T_C = \\tfrac95 T_C + 32$, ou $-\\tfrac45 T_C = 32$, isto é, $T_C = -40$. Em kelvin, $233{,}15$ K.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "leitura",
      prompt: "Um termômetro de gás a volume constante marca {p3} kPa no ponto triplo da água e {pb} kPa num banho. Considerando o gás ideal, qual é a temperatura do banho, em °C?",
      vary: { p3: [20, 90, 1], pb: [25, 120, 1] },
      answer: { label: "T_C", unit: "°C", compute: (p) => toCelsius((T3 * num(p, "pb")) / num(p, "p3")) },
      hint: "T = 273,16 K · p/p₃ e T_C = T − 273,15.",
    },
    {
      id: "fahrenheit",
      prompt: "Converta {Tc} °C para a escala Fahrenheit.",
      vary: { Tc: [-60, 200, 1] },
      answer: { label: "T_F", unit: "°F", compute: (p) => (9 / 5) * num(p, "Tc") + 32 },
      tolerance: 0.005,
    },
  ],

  static: true,
  init: () => ({ pts: [] }),
  step: (s) => s,

  actions: [
    {
      id: "registrar",
      label: "Registrar leitura",
      run: (s, p) => {
        if (naCelula(p)) return s;
        const q: Leitura = { gas: Math.round(num(p, "gas", 2)), banho: Math.round(num(p, "banho")), Tx: num(p, "Tx", 310.15), p3: num(p, "p3", 80), T: reading(p).Tstar };
        return { pts: [...s.pts.filter((o) => !(o.gas === q.gas && o.banho === q.banho && o.Tx === q.Tx && o.p3 === q.p3)), q] };
      },
    },
    { id: "apagar", label: "Apagar leituras", run: () => ({ pts: [] }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    drawApparatus(d, theme, p);
    drawGraph(d, theme, s, p);
    drawScales(d, theme, p);
  },
});

export default termometroGas;
