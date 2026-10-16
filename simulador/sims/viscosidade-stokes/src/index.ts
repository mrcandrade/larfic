import { clamp, defineSim, draw, formatBR, num, texNum, type Draw, type Params, type State } from "@fisilab/core";
import {
  FLUIDS,
  G,
  H_COL,
  MATERIALS,
  X0,
  diam,
  dragFactor,
  dragForce,
  effMass,
  fluidOf,
  ladenburg,
  marks,
  materialOf,
  muFluid,
  netWeight,
  reynolds,
  rhoFluid,
  rhoSphere,
  stokesVelocity,
  terminalVelocity,
  tubeD,
  volume,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: [profundidade do centro da esfera (m, para baixo +), velocidade (m/s, para baixo +),
//          instante em que passou pela marca A (−1 se ainda não), instante na marca B (−1 se ainda não)]
const X = 0, V = 1, TA = 2, TB = 3;
const at = (s: State, i: number) => s[i] ?? 0;

/** Leitura do cronômetro: dispara na marca A, para na marca B. */
export function stopwatch(s: State, t: number): number {
  const ta = at(s, TA), tb = at(s, TB);
  if (ta < 0) return 0;
  return tb < 0 ? t - ta : tb - ta;
}

/** Limite de validade usual da lei de Stokes. */
export const RE_STOKES = 0.5;

/** Constantes do passo, guardadas por objeto de parâmetros (o runner reutiliza o mesmo objeto). */
const cache = new WeakMap<Params, { dt: number; W: number; m: number; k0: number; reK: number; n: number }>();
function stepConsts(p: Params, dt: number) {
  const c = cache.get(p);
  if (c && c.dt === dt) return c;
  const W = netWeight(p), m = effMass(p);
  const k0 = -dragForce(p, 1e-9) / 1e-9; // 3πμd·k_p (limite Re → 0)
  const reK = reynolds(p, 1); // Re = reK·|v|
  const vt = Math.abs(terminalVelocity(p));
  const tau = m / (k0 * dragFactor(reK * vt));
  const out = { dt, W, m, k0, reK, n: clamp(Math.ceil(dt / (0.5 * tau)), 1, 40) };
  cache.set(p, out);
  return out;
}

/** Exagero horizontal do desenho da proveta (ela é muito estreita perto da altura). */
const EX = 2.5;

export const viscosidadeStokes = defineSim({
  id: "viscosidade-stokes",
  title: "Viscosímetro de Stokes",
  course: "Exp II",
  topic: "Fluidos",
  priority: "P1",
  summary:
    "Solte esferas numa proveta alta com glicerina, óleo ou mel e cronometre a queda entre duas marcas. A velocidade terminal dá a viscosidade pela lei de Stokes, com correção de parede (Ladenburg) e aviso quando o número de Reynolds fica grande demais.",
  equations: [
    String.raw`m_{\text{ef}}\,\frac{dv}{dt} = (\rho_e - \rho_f)\,V g - 3\pi\mu d\,v\;f(Re)\,k_p`,
    String.raw`v_S = \frac{2(\rho_e - \rho_f)\,g\,r^2}{9\mu} \qquad Re = \frac{\rho_f\,v\,d}{\mu}`,
    String.raw`k_p = 1 + 2{,}4\,\frac{r}{R}\ \text{(Ladenburg)} \qquad f(Re) \approx 1 + \tfrac{3}{16}Re\ \text{(Oseen)}`,
    String.raw`\mu = \frac{2(\rho_e - \rho_f)\,g\,r^2}{9\,v_\infty} \qquad v_\infty = \frac{L}{\Delta t}\,k_p`,
  ],
  liveEquations(s, p) {
    const vS = stokesVelocity(p), vt = terminalVelocity(p);
    const Re = reynolds(p, vt);
    const lines = [
      String.raw`\rho_f = ${texNum(rhoFluid(p), 4)}\ \text{kg/m}^3 \quad \mu = ${texNum(muFluid(p))}\ \text{Pa·s} \quad \rho_e = ${texNum(rhoSphere(p), 4)}\ \text{kg/m}^3`,
      String.raw`v_S = ${texNum(vS * 100)}\ \text{cm/s} \quad v_t = ${texNum(vt * 100)}\ \text{cm/s} \quad Re_t = ${texNum(Re)} \quad k_p = ${texNum(ladenburg(p), 4)}`,
    ];
    const tAB = stopwatch(s, 0);
    if (at(s, TB) >= 0) {
      const { L } = marks(p);
      const r = diam(p) / 2;
      const vinf = (L / tAB) * (num(p, "parede", 1) > 0.5 ? ladenburg(p) : 1);
      lines.push(
        String.raw`\mu_{\text{medido}} = \frac{2\,(${texNum(rhoSphere(p), 4)} - ${texNum(rhoFluid(p), 4)})\cdot 9{,}81\cdot(${texNum(r * 1000)}\times10^{-3})^2}{9\cdot ${texNum(vinf)}} = ${texNum((2 * (rhoSphere(p) - rhoFluid(p)) * G * r * r) / (9 * vinf))}\ \text{Pa·s}`,
      );
    }
    return lines;
  },

  params: [
    { key: "fluido", label: "Fluido", unit: "", min: 0, max: 3, step: 1, default: 0, options: FLUIDS.map((f) => ({ value: f.value, label: f.label })) },
    { key: "T", label: "Temperatura do banho", unit: "°C", min: 15, max: 50, step: 0.5, default: 20 },
    { key: "material", label: "Material da esfera", unit: "", min: 0, max: 4, step: 1, default: 0, options: MATERIALS.map((m) => ({ value: m.value, label: `${m.label} (${formatBR(m.rho, 5)} kg/m³)` })) },
    { key: "d", label: "Diâmetro da esfera", unit: "mm", min: 0.5, max: 12, step: 0.1, default: 3 },
    { key: "D", label: "Diâmetro interno da proveta", unit: "mm", min: 20, max: 100, step: 1, default: 50 },
    {
      key: "parede",
      label: "Efeito da parede",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      options: [
        { value: 1, label: "Proveta real (arrasto maior perto da parede)" },
        { value: 0, label: "Meio infinito (sem parede)" },
      ],
    },
    { key: "yA", label: "Marca A (abaixo da superfície)", unit: "m", min: 0.05, max: 0.5, step: 0.01, default: 0.2 },
    { key: "L", label: "Distância entre as marcas A e B", unit: "m", min: 0.1, max: 0.75, step: 0.01, default: 0.5 },
  ],

  observables: [
    { key: "tAB", label: "Cronômetro (marca A → marca B)", unit: "s", value: (s, _p, t) => stopwatch(s, t) },
    { key: "vm", label: "Velocidade média entre as marcas", unit: "m/s", value: (s, p) => (at(s, TB) >= 0 ? marks(p).L / stopwatch(s, 0) : 0) },
    { key: "y", label: "Profundidade da esfera", unit: "m", value: (s) => at(s, X) },
    { key: "v", label: "Velocidade da esfera", unit: "m/s", value: (s) => at(s, V) },
    { key: "vt", label: "Velocidade terminal (arrasto real)", unit: "m/s", value: (_s, p) => terminalVelocity(p) },
    { key: "vS", label: "Velocidade de Stokes ideal", unit: "m/s", value: (_s, p) => stokesVelocity(p) },
    { key: "Re", label: "Número de Reynolds", unit: "", value: (s, p) => reynolds(p, at(s, V)) },
    { key: "Fd", label: "Força de arrasto", unit: "N", value: (s, p) => -dragForce(p, at(s, V)) },
    { key: "mu", label: "Viscosidade do fluido (tabela)", unit: "Pa·s", value: (_s, p) => muFluid(p) },
    { key: "rhof", label: "Densidade do fluido", unit: "kg/m³", value: (_s, p) => rhoFluid(p) },
    { key: "rhoe", label: "Densidade da esfera", unit: "kg/m³", value: (_s, p) => rhoSphere(p) },
  ],
  chart: { x: "t", y: "v" },

  scenarios: [
    {
      id: "glicerina",
      label: "Glicerina e esferas de aço",
      params: { fluido: 0, T: 20, material: 0, d: 3, D: 50, parede: 1, yA: 0.2, L: 0.5 },
      guide: `### Medindo a viscosidade da glicerina
1. A esfera de aço é solta logo abaixo da superfície. Observe no gráfico $v \\times t$ que ela atinge a velocidade terminal em poucos milímetros: por isso a marca A fica a 20 cm da superfície.
2. O cronômetro dispara na marca A e para na marca B. Calcule $v = L/\\Delta t$.
3. Corrija pela parede: $v_\\infty = v\\,(1 + 2{,}4\\,r/R)$, com $R$ o raio interno da proveta.
4. Obtenha $\\mu = \\dfrac{2(\\rho_e - \\rho_f) g r^2}{9 v_\\infty}$ e compare com o valor de tabela (1,41 Pa·s a 20 °C).
5. Confira que $Re = \\rho_f v d/\\mu$ é bem menor que 1: só assim a lei de Stokes vale.`,
      predict: [
        {
          question: "Trocando a esfera de 3 mm por uma de 6 mm (mesmo material), a velocidade terminal fica:",
          options: ["igual", "2 vezes maior", "4 vezes maior", "8 vezes maior"],
          answer: 2,
          explanation: "O peso aparente cresce com $r^3$ e o arrasto de Stokes com $r\\,v$: no equilíbrio $v_t \\propto r^2$. Dobrar o raio quadruplica a velocidade (um pouco menos, por causa da parede e do Reynolds maior).",
        },
      ],
    },
    {
      id: "parede",
      label: "Efeito da parede da proveta",
      params: { fluido: 0, T: 20, material: 0, d: 8, D: 30, parede: 1, yA: 0.2, L: 0.5 },
      guide: `### A parede freia a esfera
1. Com $d = 8$ mm numa proveta de 30 mm, meça $\\Delta t$ e calcule $\\mu$ **sem** corrigir pela parede. O valor sai muito maior que o de tabela.
2. Aplique o fator de Ladenburg $1 + 2{,}4\\,r/R$ e refaça a conta.
3. Troque o efeito da parede para "meio infinito" e rode de novo: agora $v$ coincide com a previsão de Stokes (a menos da correção de Reynolds).
4. Quanto deve valer $d/D$ para o erro sem correção ficar abaixo de 2%?`,
      predict: [
        {
          question: "Numa proveta mais estreita, a mesma esfera cai:",
          options: ["mais depressa", "na mesma velocidade", "mais devagar"],
          answer: 2,
          explanation: "O fluido deslocado pela esfera precisa subir pela fresta entre ela e a parede; quanto mais estreita a fresta, maior o gradiente de velocidade e maior o arrasto viscoso.",
        },
      ],
    },
    {
      id: "reynolds",
      label: "Quando Stokes deixa de valer",
      params: { fluido: 2, T: 20, material: 0, d: 4, D: 60, parede: 1, yA: 0.2, L: 0.5 },
      guide: `### Óleo de soja: Reynolds alto
1. O óleo de soja é cerca de 25 vezes menos viscoso que a glicerina. Rode com a esfera de aço de 4 mm e veja o aviso: $Re$ passa de 100.
2. Compare $v_t$ medida com a previsão de Stokes $v_S$: a esfera cai **muito** mais devagar do que Stokes prevê, porque o arrasto passa a ter uma parte inercial ($\\propto \\rho v^2$).
3. Calcule $\\mu$ pela fórmula de Stokes com esses dados: o resultado sai errado. Reduza o diâmetro (ou troque por vidro) até $Re < 0{,}5$ e refaça.`,
    },
    {
      id: "temperatura",
      label: "Mel aquecido",
      params: { fluido: 3, T: 25, material: 0, d: 5, D: 50, parede: 1, yA: 0.1, L: 0.3 },
      guide: `### Viscosidade e temperatura
1. Meça $\\Delta t$ no mel a 25 °C.
2. Aqueça o banho para 35 °C e 45 °C e repita. A viscosidade cai várias vezes enquanto a densidade quase não muda.
3. Faça o gráfico de $\\ln\\mu$ contra $1/T$ (T em kelvin): a dependência é de tipo Arrhenius, $\\mu \\propto e^{E/RT}$, aproximadamente.`,
    },
  ],

  exercises: [
    {
      id: "terminal",
      prompt:
        "Uma esfera de aço (ρ = 7850 kg/m³) de {d} mm de diâmetro cai em glicerina (ρ = 1261 kg/m³, μ = 1,41 Pa·s) num recipiente muito largo. Qual é a velocidade terminal pela lei de Stokes, em cm/s? (g = 9,81 m/s²)",
      vary: { d: [1, 4, 1] },
      fixed: { fluido: 0, T: 20, material: 0, parede: 0 },
      answer: { label: "v_t", unit: "cm/s", compute: (p) => (100 * 2 * (7850 - 1261) * 9.81 * (num(p, "d") / 2000) ** 2) / (9 * 1.41) },
      tolerance: 0.03,
    },
    {
      id: "viscosidade",
      prompt:
        "Uma esfera de vidro (ρ = 2500 kg/m³) de {d} mm de diâmetro percorre {L} m entre duas marcas de uma proveta com óleo de rícino (ρ = 961 kg/m³) em {tt} s, já em velocidade terminal. Desprezando o efeito da parede, qual é a viscosidade do óleo, em Pa·s? (g = 9,81 m/s²)",
      vary: { d: [2, 6, 1], L: [0.2, 0.6, 2], tt: [10, 40, 1] },
      fixed: { fluido: 1, T: 20, material: 1, parede: 0 },
      answer: {
        label: "μ",
        unit: "Pa·s",
        compute: (p) => (2 * (2500 - 961) * 9.81 * (num(p, "d") / 2000) ** 2 * num(p, "tt")) / (9 * num(p, "L")),
      },
      hint: "Com velocidade terminal constante, v = L/Δt e o peso aparente equilibra o arrasto 6πμrv.",
    },
  ],

  init: () => [X0, 0, -1, -1],
  step(s, p, t, dt) {
    // Integrador exponencial: em cada subpasso o coeficiente de arrasto é congelado e a
    // equação linear resultante é resolvida exatamente (estável mesmo com τ ≪ dt).
    const { W, m, k0, reK, n } = stepConsts(p, dt);
    const h = dt / n;
    const { a: xa, b: xb } = marks(p);
    let x = at(s, X), v = at(s, V), ta = at(s, TA), tb = at(s, TB);
    for (let i = 0; i < n; i++) {
      const k = k0 * dragFactor(reK * Math.abs(v));
      const vInf = W / k;
      const e = Math.exp((-k * h) / m);
      const x1 = x + vInf * h + (v - vInf) * (m / k) * (1 - e);
      const v1 = vInf + (v - vInf) * e;
      const ti = t + i * h;
      if (ta < 0 && x < xa && x1 >= xa) ta = ti + (h * (xa - x)) / (x1 - x);
      if (ta >= 0 && tb < 0 && x < xb && x1 >= xb) tb = ti + (h * (xb - x)) / (x1 - x);
      x = x1;
      v = v1;
    }
    return [x, v, ta, tb];
  },
  dt: 2e-3,
  sampleEvery: 10,
  tEnd: 1800,
  // Termina quando a esfera chega ao fundo da proveta ou volta à superfície (se flutuar).
  stopWhen: (s, p) => Math.min(H_COL - diam(p) / 2 - at(s, X), at(s, X) - 0.002),

  viewport: () => ({ xMin: -0.34, xMax: 1.48, yMin: -0.1, yMax: 1.2 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    renderBench(d, frame.state, frame.params, frame.t);
  },
});

function renderBench(d: Draw, s: State, p: Params, t: number) {
  const { theme } = d;
  const fl = fluidOf(p);
  const R = (tubeD(p) / 2) * EX;
  const top = H_COL; // superfície do fluido em y = 1
  const yOf = (depth: number) => top - depth;
  const { a: xa, b: xb, L } = marks(p);

  // Banho termostático
  d.rect(-0.27, -0.04, 0.65, 1.12, { fill: theme.series[0], alpha: 0.07, stroke: theme.muted, width: 1 });
  d.text(`banho a ${formatBR(num(p, "T", 20), 3)} °C`, 0.055, -0.07, { size: 11, color: theme.muted });
  // Termômetro no banho
  const tx = 0.33;
  d.rect(tx - 0.008, 0.45, 0.016, 0.62, { stroke: theme.text, width: 1 });
  const fr = clamp((num(p, "T", 20) - 0) / 60, 0, 1);
  d.rect(tx - 0.004, 0.45, 0.008, 0.62 * fr, { fill: theme.positive });
  d.circle(tx, 0.44, 0.014, { fill: theme.positive });
  for (const T of [0, 20, 40, 60]) {
    const y = 0.45 + (0.62 * T) / 60;
    d.line(tx + 0.008, y, tx + 0.02, y, { color: theme.muted, width: 1 });
    d.text(`${T}`, tx + 0.024, y, { size: 9, align: "left", color: theme.muted });
  }

  // Fluido e proveta
  d.rect(-R, 0, 2 * R, top, { fill: fl.color });
  d.polyline([[-R, top + 0.08], [-R, 0], [R, 0], [R, top + 0.08]], { color: theme.text, width: 2.5 });
  d.line(-R - 0.03, 0, R + 0.03, 0, { color: theme.text, width: 3 });
  d.line(-R, top, R, top, { color: theme.text, width: 1, alpha: 0.6 });
  d.text(`Ø ${formatBR(num(p, "D", 50), 3)} mm`, 0, top + 0.12, { size: 11, color: theme.muted });

  // Régua (zero na superfície, crescendo para baixo)
  const rx = -R - 0.07;
  d.rect(rx - 0.05, -0.01, 0.05, top + 0.02, { fill: theme.dark ? "#2a2f38" : "#f6f1e3", stroke: theme.muted, width: 1 });
  for (let cm = 0; cm <= 100; cm++) {
    const y = yOf(cm / 100);
    const big = cm % 10 === 0, mid = cm % 5 === 0;
    d.line(rx, y, rx - (big ? 0.03 : mid ? 0.02 : 0.012), y, { color: theme.text, width: big ? 1.2 : 0.7 });
    if (big) d.text(`${cm}`, rx - 0.035, y, { size: 9, align: "right", color: theme.text });
  }
  d.text("cm", rx - 0.025, top + 0.05, { size: 10, color: theme.muted });

  // Marcas A e B (elásticos na proveta)
  for (const [lab, depth] of [["A", xa], ["B", xb]] as const) {
    const y = yOf(depth);
    d.line(-R - 0.012, y, R + 0.012, y, { color: theme.negative, width: 3 });
    d.text(lab, R + 0.03, y, { size: 13, weight: "700", color: theme.negative, align: "left" });
  }
  d.line(R + 0.075, yOf(xa), R + 0.075, yOf(xb), { color: theme.negative, width: 1, dash: [4, 3] });
  d.text(`L = ${formatBR(L * 100, 3)} cm`, R + 0.09, yOf((xa + xb) / 2), { size: 11, color: theme.negative, align: "left" });

  // Esfera (mesmo exagero horizontal que a proveta)
  const x = at(s, X);
  const rr = (diam(p) / 2) * EX;
  d.circle(0, yOf(x), rr, { fill: materialColor(p, theme.dark), stroke: theme.text, width: 1, minPx: 3 });

  // Cronômetro digital
  const cx = 0.7, cy = 1.06;
  const tAB = stopwatch(s, t);
  d.rect(cx - 0.2, cy - 0.08, 0.4, 0.16, { fill: theme.dark ? "#10151c" : "#20262e", stroke: theme.muted, width: 1.5 });
  d.text(`${tAB.toFixed(2).replace(".", ",")} s`, cx, cy + 0.005, { size: 22, weight: "700", color: "#7cf0a0" });
  const status = at(s, TA) < 0 ? "aguardando a marca A" : at(s, TB) < 0 ? "cronometrando…" : "parado na marca B";
  d.text(`cronômetro: ${status}`, cx, cy - 0.11, { size: 11, color: theme.muted });

  // Lupa com o diagrama de forças
  const lx = 0.66, ly = 0.6, lr = 0.17;
  d.circle(lx, ly, lr, { fill: theme.dark ? "#141a22" : "#ffffff", stroke: theme.text, width: 2 });
  d.circle(lx, ly, lr - 0.005, { fill: fl.color });
  d.line(lx - lr * 0.72, ly - lr * 0.72, lx - lr * 1.15, ly - lr * 1.15, { color: theme.text, width: 4 });
  const br = 0.035;
  d.circle(lx, ly, br, { fill: materialColor(p, theme.dark), stroke: theme.text, width: 1 });
  const P = rhoSphere(p) * volume(p) * G;
  const E = rhoFluid(p) * volume(p) * G;
  const Fd = -dragForce(p, at(s, V));
  const k = 0.11 / Math.max(P, E);
  d.arrow(lx, ly - br, 0, -P * k, { color: theme.text });
  d.text("P", lx + 0.015, ly - br - P * k, { size: 11, weight: "600", align: "left" });
  d.arrow(lx - 0.018, ly + br, 0, E * k, { color: theme.accent });
  d.text("E", lx - 0.03, ly + br + E * k, { size: 11, weight: "600", color: theme.accent, align: "right" });
  if (Math.abs(Fd) * k > 0.003) {
    d.arrow(lx + 0.018, ly + Math.sign(Fd) * br, 0, Fd * k, { color: theme.positive });
    d.text("F_a", lx + 0.03, ly + Math.sign(Fd) * br + Fd * k, { size: 11, weight: "600", color: theme.positive, align: "left" });
  }
  d.text("lupa: forças na esfera", lx, ly + lr + 0.03, { size: 10, color: theme.muted });

  // Painel de dados
  const vt = terminalVelocity(p), vS = stokesVelocity(p);
  const Re = reynolds(p, vt);
  const px0 = 0.9, py0 = 0.8;
  const lines: [string, string?][] = [
    [`${fl.label}: ρ = ${formatBR(rhoFluid(p), 4)} kg/m³`],
    [`μ (tabela) = ${formatBR(muFluid(p), 3)} Pa·s`],
    [`Esfera de ${materialOf(p).label.toLowerCase()}: d = ${formatBR(num(p, "d", 3), 3)} mm`],
    [`v agora = ${formatBR(at(s, V) * 100, 3)} cm/s`],
    [`v terminal = ${formatBR(vt * 100, 3)} cm/s`],
    [`v de Stokes (ideal) = ${formatBR(vS * 100, 3)} cm/s`],
    [`fator de parede 1 + 2,4 r/R = ${formatBR(ladenburg(p), 4)}`],
    [`P = ${formatBR(P * 1000, 3)} mN  E = ${formatBR(E * 1000, 3)} mN  F_a = ${formatBR(Fd * 1000, 3)} mN`, theme.muted],
    [`Re terminal = ${formatBR(Re, 3)}`, Re > RE_STOKES ? theme.positive : theme.series[2]],
  ];
  lines.forEach(([tx2, c], i) => d.text(tx2, px0, py0 - i * 0.058, { size: 11, align: "left", color: c ?? theme.text }));
  if (vt < 0) d.text("A esfera é menos densa que o fluido: ela sobe!", px0, py0 - 9 * 0.058, { size: 11, align: "left", color: theme.positive, weight: "600" });
  else if (Re > RE_STOKES)
    d.text("Atenção: Re > 0,5, a lei de Stokes não vale.", px0, py0 - 9 * 0.058, { size: 11, align: "left", color: theme.positive, weight: "600" });
  else d.text("Re < 0,5: regime de Stokes.", px0, py0 - 9 * 0.058, { size: 11, align: "left", color: theme.series[2] });
  d.text("(largura da proveta e da esfera ampliada 2,5×)", px0, -0.06, { size: 10, align: "left", color: theme.muted });
}

function materialColor(p: Params, dark: boolean) {
  switch (Math.round(num(p, "material", 0))) {
    case 1: return dark ? "rgba(190,230,240,0.7)" : "rgba(170,215,230,0.8)";
    case 2: return "#c8ccd2";
    case 3: return "#5d6470";
    case 4: return "#f2efe6";
    default: return "#8f99a6";
  }
}

export default viscosidadeStokes;
