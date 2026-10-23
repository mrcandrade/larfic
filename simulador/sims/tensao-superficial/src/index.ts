import { defineSim, draw, formatBR, num, texNum, type Draw, type Params, type State } from "@fisilab/core";
import {
  LIQUIDS,
  TUBES,
  Z0,
  capLength,
  capillaryStep,
  filmForce,
  filmMax,
  gamma,
  jurin,
  liquidOf,
  mu,
  rho,
  ringForce,
  ringR,
  ringWeight,
  theta,
  tubeR,
  zBreak,
  zEnd,
  zPeak,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: [z do anel (m), força máxima registrada (N), filme rompido (0/1),
//          altura no capilar selecionado (m), alturas nos 4 capilares de comparação (m)]
const Z = 0, FMAX = 1, BROKEN = 2, HSEL = 3;
const at = (s: State, i: number) => s[i] ?? 0;
const modeOf = (p: Params) => Math.round(num(p, "modo", 0));
const speed = (p: Params) => num(p, "u", 0.5) / 1000;

const forceOf = (s: State, p: Params) => ringForce(p, at(s, Z), at(s, BROKEN) > 0.5);

export const tensaoSuperficial = defineSim({
  id: "tensao-superficial",
  title: "Tensão superficial (anel de Du Noüy e capilaridade)",
  course: "Exp II",
  topic: "Fluidos",
  priority: "P1",
  summary:
    "Puxe um anel de platina para fora do líquido e registre no dinamômetro a força máxima antes de o filme romper, ou mergulhe capilares de raios diferentes e meça a altura da coluna (lei de Jurin). Água, etanol, glicerina, água com sabão e mercúrio, com efeito da temperatura.",
  equations: [
    String.raw`F_{\max} = P + 4\pi R\,\gamma \;\Rightarrow\; \gamma = \frac{F_{\max} - P}{4\pi R}`,
    String.raw`h = \frac{2\gamma\cos\theta}{\rho g r}\ \text{(lei de Jurin)}`,
    String.raw`8\mu h\,\frac{dh}{dt} = r^2\left(\frac{2\gamma\cos\theta}{r} - \rho g h\right)\ \text{(Lucas–Washburn)}`,
    String.raw`\gamma(T) \approx \gamma_{20} + \frac{d\gamma}{dT}\,(T - 20\ ^\circ\text{C})`,
  ],
  liveEquations(s, p) {
    const g = gamma(p);
    if (modeOf(p) === 0) {
      const R = ringR(p);
      return [
        String.raw`\gamma = ${texNum(g * 1000)}\ \text{mN/m} \qquad P = ${texNum(ringWeight(p) * 1000)}\ \text{mN} \qquad F = ${texNum(forceOf(s, p) * 1000)}\ \text{mN}`,
        String.raw`4\pi R\gamma = 4\pi\cdot ${texNum(R * 1000)}\times10^{-3}\cdot ${texNum(g)} = ${texNum(filmMax(p) * 1000)}\ \text{mN} \qquad F_{\max} = ${texNum(at(s, FMAX) * 1000)}\ \text{mN}`,
      ];
    }
    const r = tubeR(p);
    return [
      String.raw`h_{\text{Jurin}} = \frac{2\cdot ${texNum(g)}\cdot\cos ${texNum(num(p, "theta", 0))}^\circ}{${texNum(rho(p), 4)}\cdot 9{,}81\cdot ${texNum(r * 1000)}\times10^{-3}} = ${texNum(jurin(p, r) * 1000)}\ \text{mm}`,
      String.raw`h(t) = ${texNum(at(s, HSEL) * 1000)}\ \text{mm} \qquad \mu = ${texNum(mu(p))}\ \text{Pa·s}`,
    ];
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
        { value: 0, label: "Anel de Du Noüy (dinamômetro)" },
        { value: 1, label: "Capilares (lei de Jurin)" },
      ],
    },
    { key: "liquido", label: "Líquido", unit: "", min: 0, max: 4, step: 1, default: 0, options: LIQUIDS.map((l) => ({ value: l.value, label: l.label })) },
    { key: "T", label: "Temperatura do líquido", unit: "°C", min: 5, max: 80, step: 1, default: 20 },
    { key: "theta", label: "Ângulo de contato com a parede", unit: "°", min: 0, max: 150, step: 1, default: 0 },
    { key: "R", label: "Anel: raio", unit: "mm", min: 5, max: 20, step: 0.05, default: 9.55 },
    { key: "u", label: "Anel: velocidade de subida", unit: "mm/s", min: 0.1, max: 2, step: 0.1, default: 0.5, live: true },
    { key: "r", label: "Capilar: raio interno do tubo selecionado", unit: "mm", min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
  ],

  observables: [
    { key: "F", label: "Leitura do dinamômetro", unit: "N", value: (s, p) => forceOf(s, p) },
    { key: "Fmax", label: "Força máxima registrada", unit: "N", value: (s) => at(s, FMAX) },
    { key: "P", label: "Peso do anel (leitura no ar)", unit: "N", value: (_s, p) => ringWeight(p) },
    { key: "z", label: "Altura do anel acima da superfície", unit: "m", value: (s) => at(s, Z) },
    { key: "h", label: "Altura capilar (tubo selecionado)", unit: "m", value: (s) => at(s, HSEL) },
    { key: "hJ", label: "Altura prevista por Jurin", unit: "m", value: (_s, p) => jurin(p, tubeR(p)) },
    { key: "gamma", label: "Tensão superficial (tabela)", unit: "N/m", value: (_s, p) => gamma(p) },
    { key: "rho", label: "Densidade do líquido", unit: "kg/m³", value: (_s, p) => rho(p) },
  ],
  chart: { x: "z", y: "F" },

  scenarios: [
    {
      id: "anel",
      label: "Anel na água",
      params: { modo: 0, liquido: 0, T: 20, theta: 0, R: 9.55, u: 0.5 },
      guide: `### Anel de Du Noüy
1. Com o anel ainda no ar, o dinamômetro mostra o peso $P$ do anel com o estribo. Anote.
2. Rode: o anel sobe devagar. Ao sair da água, ele arrasta um filme (lamela) que puxa para baixo pelas **duas** bordas do fio, num comprimento total $4\\pi R$.
3. A força cresce, passa por um máximo e o filme rompe. O ponteiro de arraste guarda $F_{\\max}$.
4. Calcule $\\gamma = (F_{\\max} - P)/(4\\pi R)$ e compare com 72,8 mN/m (água a 20 °C).
5. Nos tensiômetros reais aplica-se ainda o fator de correção de Harkins–Jordan (≈ 0,9 a 0,95), que aqui foi desprezado.`,
      predict: [
        {
          question: "Usando um anel com o dobro do raio, a força máxima do filme (descontado o peso):",
          options: ["fica igual", "dobra", "quadruplica"],
          answer: 1,
          explanation: "A tensão superficial é força por comprimento de linha de contato; o comprimento $4\\pi R$ dobra com o raio, então a força do filme também dobra.",
        },
      ],
    },
    {
      id: "sabao",
      label: "Sabão e temperatura",
      params: { modo: 0, liquido: 3, T: 20, theta: 0, R: 9.55, u: 0.5 },
      guide: `### Tensoativos
1. Meça $F_{\\max}$ com a água com sabão e compare com a água pura: o sabão reduz $\\gamma$ para menos da metade.
2. Volte para a água e aqueça até 60 °C: $\\gamma$ cai cerca de 0,15 mN/m por grau.
3. Por que água quente com sabão limpa melhor?`,
    },
    {
      id: "capilar",
      label: "Capilares na água",
      params: { modo: 1, liquido: 0, T: 20, theta: 0, r: 0.5 },
      guide: `### Lei de Jurin
1. Os tubos são mergulhados juntos no início. A água sobe mais depressa nos tubos largos, mas para mais alto nos finos.
2. Espere a coluna do tubo destacado parar e meça $h$ com a régua.
3. Troque o raio do tubo destacado e repita: o gráfico de $h$ contra $1/r$ é uma reta pela origem com inclinação $2\\gamma\\cos\\theta/(\\rho g)$.
4. Com glicerina a subida demora minutos: a viscosidade controla a rapidez (Lucas–Washburn), mas não a altura final.`,
      predict: [
        {
          question: "Num tubo com metade do raio, a água sobe até uma altura:",
          options: ["metade", "igual", "duas vezes maior", "quatro vezes maior"],
          answer: 2,
          explanation: "A força da tensão superficial cresce com o perímetro ($2\\pi r$) e o peso da coluna com a área ($\\pi r^2 h$): no equilíbrio $h \\propto 1/r$.",
        },
      ],
    },
    {
      id: "mercurio",
      label: "Mercúrio: depressão capilar",
      params: { modo: 1, liquido: 4, T: 20, theta: 140, r: 0.5 },
      guide: `### Quando o líquido não molha o vidro
O mercúrio tem ângulo de contato de cerca de 140° com o vidro: $\\cos\\theta < 0$ e a coluna **desce** abaixo do nível do recipiente, com o menisco convexo. Compare o módulo de $h$ com o da água no mesmo tubo.`,
    },
  ],

  exercises: [
    {
      id: "jurin",
      prompt:
        "Um capilar de vidro limpo de raio interno {r} mm é mergulhado em água a 20 °C (γ = 72,8 mN/m, ρ = 998 kg/m³, θ = 0°). Até que altura, em mm, a água sobe? (g = 9,81 m/s²)",
      vary: { r: [0.1, 1.0, 2] },
      fixed: { modo: 1, liquido: 0, T: 20, theta: 0 },
      answer: { label: "h", unit: "mm", compute: (p) => (1000 * 2 * 0.0728) / (998 * 9.81 * (num(p, "r") / 1000)) },
    },
    {
      id: "anel",
      prompt:
        "Num tensiômetro de Du Noüy com anel de raio {R} mm, o dinamômetro marca {P} mN com o anel no ar e {Fm} mN no instante em que o filme se rompe. Qual é a tensão superficial do líquido, em mN/m?",
      vary: { R: [6, 15, 2], P: [8, 12, 2], Fm: [12, 30, 2] },
      fixed: { modo: 0 },
      answer: { label: "γ", unit: "mN/m", compute: (p) => (1000 * (num(p, "Fm") - num(p, "P"))) / (4 * Math.PI * num(p, "R")) },
      hint: "O filme puxa pelas duas bordas do fio: o comprimento de contato é 4πR.",
    },
  ],

  init(p) {
    const z = Z0;
    return [z, ringForce(p, z, false), 0, 0, 0, 0, 0, 0];
  },
  step(s, p, _t, dt) {
    if (modeOf(p) === 0) {
      const z = at(s, Z) + speed(p) * dt;
      const broken = at(s, BROKEN) > 0.5 || z >= zBreak(p);
      const F = ringForce(p, z, broken);
      return [z, Math.max(at(s, FMAX), F), broken ? 1 : 0, at(s, HSEL), ...s.slice(4)];
    }
    const out = s.slice();
    out[HSEL] = capillaryStep(p, tubeR(p), at(s, HSEL), dt);
    TUBES.forEach((r, i) => (out[4 + i] = capillaryStep(p, r, at(s, 4 + i), dt)));
    return out;
  },
  dt: 0.01,
  sampleEvery: 5,
  tEnd: 3600,
  stopWhen(s, p) {
    if (modeOf(p) === 0) return zEnd(p) - at(s, Z);
    const heq = jurin(p, tubeR(p));
    return Math.abs(at(s, HSEL) - heq) - 1e-4 * Math.abs(heq) - 1e-8;
  },

  narrowSplit: () => 0.523,
  viewport(p) {
    if (modeOf(p) === 0) return { xMin: -48, xMax: 112, yMin: -32, yMax: 92 };
    const hs = [jurin(p, tubeR(p)), ...TUBES.map((r) => jurin(p, r))].map((h) => h * 1000);
    const top = Math.min(260, Math.max(70, Math.max(...hs) + 22));
    const bottom = Math.min(-40, Math.min(...hs) - 40);
    return { xMin: -72, xMax: 72 + 0.95 * (top - bottom), yMin: bottom, yMax: top };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (modeOf(frame.params) === 0) renderRing(d, frame.state, frame.params, frame.trail);
    else renderCapillary(d, frame.state, frame.params, frame.t);
  },
});

// Desenho do anel em milímetros.
function renderRing(d: Draw, s: State, p: Params, trail: State[]) {
  const { theme } = d;
  const liq = liquidOf(p);
  const R = ringR(p) * 1000;
  const z = at(s, Z) * 1000;
  const broken = at(s, BROKEN) > 0.5;
  const F = forceOf(s, p);

  // Macaco de laboratório e béquer
  d.rect(-34, -32, 68, 4, { fill: theme.muted, alpha: 0.5 });
  d.polyline([[-26, -28], [26, -22], [-26, -22], [26, -28]], { color: theme.muted, width: 1.5 });
  d.rect(-30, -22, 60, 22, { fill: liq.color });
  d.polyline([[-30, 12], [-30, -22], [30, -22], [30, 12]], { color: theme.text, width: 2 });
  d.text(liq.label, 0, -15, { size: 11, color: theme.text });
  d.text(`${formatBR(num(p, "T", 20), 3)} °C`, 0, -19, { size: 10, color: theme.muted, dy: 4 });

  // Filme (lamela) entre o anel e a superfície
  const zf = Math.max(z, 0);
  if (!broken && z > 0 && filmMax(p) > 0) {
    for (const sg of [-1, 1]) {
      const pts: [number, number][] = [];
      const spread = 0.5 + 1.5 * capLength(p) * 1000 * (1 - z / (zBreak(p) * 1000));
      for (let i = 0; i <= 16; i++) {
        const u = i / 16;
        pts.push([sg * (R + spread * (1 - Math.sqrt(1 - u)) - 0.6 * Math.sin(Math.PI * u) * (z / (zPeak(p) * 1000))), u * zf]);
      }
      d.polyline([...pts, [sg * (R + spread + 3), 0]], { color: theme.accent, width: 1.5, fill: liq.color });
      d.polyline(pts.map(([x, y]) => [x - sg * 0.8, y] as [number, number]), { color: theme.accent, width: 1, alpha: 0.6 });
    }
    d.polyline([[-R + 0.8, 0], [-R + 0.8, zf], [R - 0.8, zf], [R - 0.8, 0]], { color: theme.accent, width: 1, alpha: 0.5, dash: [2, 2] });
  }
  d.line(-30, 0, 30, 0, { color: theme.accent, width: 1.5 });

  // Anel (elipse achatada), estribo e fio até o dinamômetro
  const ry = Math.max(1.2, R * 0.18);
  d.ctx.save();
  d.ctx.beginPath();
  d.ctx.ellipse(0, z, R, ry, 0, 0, 2 * Math.PI);
  d.ctx.strokeStyle = theme.dark ? "#d8dde6" : "#59606b";
  d.ctx.lineWidth = 3 * d.px;
  d.ctx.stroke();
  d.ctx.restore();
  const hook = 34;
  for (const x of [-R, 0, R]) d.line(x, z + (x === 0 ? ry : 0), 0, z + 14, { color: theme.muted, width: 1 });
  d.line(0, z + 14, 0, hook, { color: theme.text, width: 1 });

  // Dinamômetro (mola com escala em mN)
  const top = 88, scaleK = 0.9; // mm de mola por mN (exagerado)
  const fm = F * 1000;
  const yHook = Math.max(hook, top - 18 - fm * scaleK - 4);
  d.support(-14, top, 14, top);
  d.rect(-8, top - 60, 16, 58, { stroke: theme.muted, width: 1.5, fill: theme.dark ? "#1a2029" : "#f4f6f9" });
  for (let mN = 0; mN <= 40; mN += 2) {
    const y = top - 18 - mN * scaleK;
    if (y < top - 60) break;
    d.line(-8, y, mN % 10 === 0 ? -4 : -6, y, { color: theme.text, width: 1 });
    if (mN % 10 === 0) d.text(`${mN}`, -9, y, { size: 9, align: "right", color: theme.muted });
  }
  d.spring(0, top - 2, 0, yHook + 4, { color: theme.text, coils: 12, amplitudePx: 5 });
  d.line(-6, yHook + 4, 6, yHook + 4, { color: theme.positive, width: 3 });
  d.line(0, yHook + 4, 0, hook, { color: theme.text, width: 1.5 });
  d.text("mN", 10, top - 6, { size: 9, align: "left", color: theme.muted });
  // Ponteiro de arraste (máximo)
  const yMax = top - 18 - at(s, FMAX) * 1000 * scaleK;
  if (yMax > top - 60) d.line(4, yMax, 8, yMax, { color: theme.negative, width: 3 });

  // Visor
  const vx = 22, vy = 72;
  d.rect(vx, vy - 9, 38, 20, { fill: theme.dark ? "#10151c" : "#20262e", stroke: theme.muted, width: 1.5 });
  d.text(`${(fm).toFixed(2).replace(".", ",")} mN`, vx + 19, vy + 4, { size: 15, weight: "700", color: "#7cf0a0" });
  d.text(`máx ${(at(s, FMAX) * 1000).toFixed(2).replace(".", ",")} mN`, vx + 19, vy - 4, { size: 11, color: "#f0d27c" });
  d.text(broken ? "filme rompido" : z > 0 ? "filme preso ao anel" : "anel imerso", vx + 19, vy - 13, { size: 11, color: broken ? theme.positive : theme.muted });

  // Gráfico F × z
  const gx0 = 50, gx1 = 106, gy0 = 6, gy1 = 52;
  const zMin = Z0 * 1000, zMaxG = zEnd(p) * 1000;
  const W = ringWeight(p) * 1000, Fpk = W + filmMax(p) * 1000;
  const fLo = Math.min(W - 1, 0), fHi = Math.max(Fpk * 1.1, W + 2);
  const X = (zz: number) => gx0 + ((zz - zMin) / (zMaxG - zMin)) * (gx1 - gx0);
  const Y = (ff: number) => gy0 + ((ff - fLo) / (fHi - fLo)) * (gy1 - gy0);
  d.line(gx0, gy0, gx1, gy0, { color: theme.muted });
  d.line(gx0, gy0, gx0, gy1, { color: theme.muted });
  d.line(X(0), gy0, X(0), gy1, { color: theme.grid });
  d.text("z (mm)", gx1, gy0 - 4, { size: 10, align: "right", color: theme.muted });
  d.text("F (mN)", gx0, gy1 + 4, { size: 10, align: "left", color: theme.muted });
  for (const ff of [W, Fpk]) {
    d.line(gx0, Y(ff), gx1, Y(ff), { color: theme.grid, dash: [3, 3] });
    d.text(formatBR(ff, 3), gx0 - 1, Y(ff), { size: 9, align: "right", color: theme.muted });
  }
  d.text("P", gx1, Y(W) + 2.5, { size: 9, align: "right", color: theme.muted });
  d.text("P + 4πRγ", gx1, Y(Fpk) + 2.5, { size: 9, align: "right", color: theme.muted });
  d.text("0", X(0), gy0 - 3, { size: 9, color: theme.muted });
  const pts = trail.filter((x) => x.length > 3).map((x) => [X(at(x, Z) * 1000), Y(forceOf(x, p) * 1000)] as [number, number]);
  pts.push([X(z), Y(fm)]);
  d.polyline(pts, { color: theme.accent, width: 2 });
  d.dot(X(z), Y(fm), 4, theme.positive);
  d.text(`γ = ${formatBR(gamma(p) * 1000, 3)} mN/m   R = ${formatBR(R, 3)} mm   P = ${formatBR(W, 3)} mN`, 78, -12, { size: 11, color: theme.text });
  d.text(`subida do anel: ${formatBR(num(p, "u", 0.5), 2)} mm/s`, 78, -20, { size: 10, color: theme.muted });
}

// Desenho dos capilares em milímetros (tubos com largura ampliada).
function renderCapillary(d: Draw, s: State, p: Params, t: number) {
  const { theme } = d;
  const liq = liquidOf(p);
  const EX = 5;
  const vp = tensaoSuperficial.viewport(p, s);
  const bottom = vp.yMin + 8;
  // Cuba
  d.rect(-66, bottom, 132, -bottom, { fill: liq.color });
  d.polyline([[-66, 4], [-66, bottom], [66, bottom], [66, 4]], { color: theme.text, width: 2 });
  d.line(-66, 0, 66, 0, { color: theme.accent, width: 1.5 });
  d.text(`${liq.label} a ${formatBR(num(p, "T", 20), 3)} °C`, 0, bottom - 4, { size: 11, color: theme.muted });

  const tubes: { x: number; r: number; h: number; sel: boolean }[] = [
    { x: -48, r: TUBES[0]!, h: at(s, 4), sel: false },
    { x: -26, r: TUBES[1]!, h: at(s, 5), sel: false },
    { x: 0, r: tubeR(p), h: at(s, HSEL), sel: true },
    { x: 26, r: TUBES[2]!, h: at(s, 6), sel: false },
    { x: 48, r: TUBES[3]!, h: at(s, 7), sel: false },
  ];
  const tubeTop = vp.yMax - 6;
  const tubeBot = bottom + 6;
  const cth = Math.cos(theta(p));
  for (const tb of tubes) {
    const w = Math.max(tb.r * 1000 * EX, 1.6);
    const h = tb.h * 1000;
    // Coluna de líquido dentro do tubo
    d.rect(tb.x - w, tubeBot, 2 * w, h - tubeBot, { fill: liq.color.replace(/[\d.]+\)$/, "0.75)") });
    // Menisco (côncavo se molha, convexo se não)
    const pts: [number, number][] = [];
    for (let i = 0; i <= 12; i++) {
      const u = -1 + (2 * i) / 12;
      pts.push([tb.x + w * u, h + 0.6 * w * cth * (u * u - 0.33)]);
    }
    d.polyline(pts, { color: theme.accent, width: 1.5 });
    d.line(tb.x - w, tubeBot, tb.x - w, tubeTop, { color: tb.sel ? theme.accent : theme.text, width: tb.sel ? 2.5 : 1.5 });
    d.line(tb.x + w, tubeBot, tb.x + w, tubeTop, { color: tb.sel ? theme.accent : theme.text, width: tb.sel ? 2.5 : 1.5 });
    d.text(`r = ${formatBR(tb.r * 1000, 3)} mm`, tb.x, tubeTop + 3, { size: 10, color: tb.sel ? theme.accent : theme.muted, weight: tb.sel ? "700" : "400" });
  }
  // Régua junto ao tubo selecionado (zero no nível da cuba)
  const rx = 9;
  const yLo = Math.ceil((tubeBot + 2) / 10) * 10, yHi = tubeTop - 4;
  d.rect(rx, yLo - 1, 7, yHi - yLo + 2, { fill: theme.dark ? "#2a2f38" : "#f6f1e3", stroke: theme.muted, width: 1 });
  for (let mm = yLo; mm <= yHi; mm++) {
    const big = mm % 10 === 0, mid = mm % 5 === 0;
    if (!mid && (yHi - yLo) > 160) continue;
    d.line(rx, mm, rx + (big ? 4 : mid ? 3 : 1.6), mm, { color: theme.text, width: big ? 1.1 : 0.6 });
    if (big) d.text(`${mm}`, rx + 8, mm, { size: 9, align: "left", color: theme.text });
  }
  const hs = at(s, HSEL) * 1000;
  d.line(-2, hs, rx, hs, { color: theme.positive, width: 1.5, dash: [3, 2] });

  // Painel
  const px = 76;
  const heq = jurin(p, tubeR(p)) * 1000;
  const lines: [string, string?][] = [
    [`γ = ${formatBR(gamma(p) * 1000, 3)} mN/m`],
    [`ρ = ${formatBR(rho(p), 4)} kg/m³`],
    [`θ = ${formatBR(num(p, "theta", 0), 3)}°   μ = ${formatBR(mu(p) * 1000, 3)} mPa·s`],
    [`tubo destacado: r = ${formatBR(num(p, "r", 0.5), 3)} mm`, theme.accent],
    [`h = ${formatBR(hs, 4)} mm`, theme.positive],
    [`Jurin: h = 2γcosθ/(ρgr) = ${formatBR(heq, 4)} mm`],
    [Math.abs(hs - heq) <= 1e-3 * Math.abs(heq) + 1e-3 ? "coluna em equilíbrio" : "coluna ainda se movendo…", theme.muted],
    [`t = ${formatBR(t, 4)} s`, theme.muted],
  ];
  const span = vp.yMax - vp.yMin;
  lines.forEach(([tx, c], i) => d.text(tx, px, vp.yMax - 10 - i * span * 0.06, { size: 11, align: "left", color: c ?? theme.text }));
  d.text("(largura dos tubos ampliada 5×)", px, vp.yMin + 4, { size: 10, align: "left", color: theme.muted });
}

export default tensaoSuperficial;
