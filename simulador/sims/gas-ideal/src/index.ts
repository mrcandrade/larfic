import { defineSim, draw, formatBR, num, texNum, type Params } from "@fisilab/core";
import {
  DT,
  H,
  KB,
  L_MAX,
  L_MIN,
  NBINS,
  TIME_SCALE,
  areaOf,
  heat,
  idealPressure,
  initGas,
  kineticEnergy,
  mass,
  mb2d,
  meanPressure,
  resetAverages,
  sigmaV,
  stepGas,
  temperatureOf,
  type GasState,
} from "./md.ts";

export * from "./md.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const HP = { x0: 36, x1: 62, y0: 2, y1: 18.5 };
const GASES = [
  { value: 4, label: "Hélio (4 u)" },
  { value: 20, label: "Neônio (20 u)" },
  { value: 40, label: "Argônio (40 u)" },
  { value: 84, label: "Criptônio (84 u)" },
  { value: 131, label: "Xenônio (131 u)" },
];

const T = (s: GasState, p: Params) => temperatureOf(s, mass(p));
const nearPiston = (s: GasState, pt: { x: number; y: number }) => Math.abs(pt.x - s.xp - 0.3) < 1.2 && pt.y > -0.5 && pt.y < H + 0.5;

export const gasIdeal = defineSim<GasState>({
  id: "gas-ideal",
  title: "Gás ideal molecular",
  course: "FG II",
  topic: "Gases",
  priority: "P1",
  summary:
    "Dinâmica molecular de discos que colidem elasticamente numa caixa 2D com pistão móvel e parede aquecida. A pressão é medida pelo impulso nas paredes e comparada com NkT/A; o histograma de velocidades converge para a curva de Maxwell–Boltzmann.",
  equations: [
    String.raw`P A = N k T \qquad \text{(gás ideal em 2D: } P \text{ em N/m, } A \text{ em m}^2)`,
    String.raw`\left\langle \tfrac12 m v^2 \right\rangle = k T \qquad P = \frac{1}{\Delta t\,\ell}\sum 2 m v_\perp \ \text{(impulso por tempo por comprimento de parede)}`,
    String.raw`f(v) = \frac{m v}{k T}\, e^{-m v^2/2kT} \qquad v_p = \sqrt{\frac{kT}{m}},\ \ v_{\text{rms}} = \sqrt{\frac{2kT}{m}}`,
    String.raw`\text{adiabática 2D } (\gamma = 2):\ T A = \text{const} \qquad \text{isotérmica: } P A = \text{const}`,
  ],
  liveEquations(s, p) {
    const m = mass(p);
    const Tm = T(s, p);
    const n = s.x.length;
    return [
      String.raw`T = \frac{\sum \tfrac12 m v^2}{N k} = ${texNum(Tm, 4)}\ \text{K} \qquad A = ${texNum(areaOf(s))}\ \text{nm}^2`,
      String.raw`P_{\text{medida}} = ${texNum(meanPressure(s) * 1e3)}\ \text{mN/m} \qquad \frac{NkT}{A} = \frac{${n} \cdot ${texNum(KB)} \cdot ${texNum(Tm)}}{${texNum(areaOf(s) * 1e-18)}} = ${texNum(idealPressure(s, m) * 1e3)}\ \text{mN/m}`,
      String.raw`v_p = ${texNum(sigmaV(Tm, m) * 1000)}\ \text{m/s} \qquad v_{\text{rms}} = ${texNum(Math.SQRT2 * sigmaV(Tm, m) * 1000)}\ \text{m/s}`,
    ];
  },

  params: [
    { key: "N", label: "Número de moléculas", unit: "", min: 20, max: 300, step: 10, default: 120 },
    { key: "massa", label: "Gás", unit: "u", min: 4, max: 131, step: 1, default: 40, options: GASES },
    { key: "T0", label: "Temperatura inicial", unit: "K", min: 50, max: 1000, step: 10, default: 300 },
    { key: "L0", label: "Largura inicial da caixa", unit: "nm", min: L_MIN, max: L_MAX, step: 0.5, default: 20 },
    { key: "diam", label: "Diâmetro molecular", unit: "nm", min: 0.1, max: 0.8, step: 0.05, default: 0.2 },
    {
      key: "dist",
      label: "Velocidades iniciais",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Sorteadas de Maxwell–Boltzmann" },
        { value: 1, label: "Todas com a mesma rapidez" },
      ],
    },
    {
      key: "parede",
      label: "Parede esquerda",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Isolante (choque elástico)" },
        { value: 1, label: "Térmica a T_w (aquecedor)" },
      ],
    },
    { key: "Tw", label: "Temperatura da parede T_w", unit: "K", min: 50, max: 1000, step: 10, default: 600, live: true },
    { key: "vpist", label: "Velocidade máxima do pistão", unit: "nm/ps", min: 0.01, max: 1, step: 0.01, default: 0.1, live: true },
    { key: "seed", label: "Semente", unit: "", min: 1, max: 999, step: 1, default: 1 },
  ],

  observables: [
    { key: "tf", label: "Tempo físico", unit: "ps", value: (s) => s.tp },
    { key: "T", label: "Temperatura medida", unit: "K", value: (s, p) => T(s, p) },
    { key: "P", label: "Pressão medida (média de 20 ps)", unit: "mN/m", value: (s) => s.Pema * 1e3 },
    { key: "Pmed", label: "Pressão medida (média acumulada)", unit: "mN/m", value: (s) => meanPressure(s) * 1e3 },
    { key: "Pid", label: "Pressão do gás ideal NkT/A", unit: "mN/m", value: (s, p) => idealPressure(s, mass(p)) * 1e3 },
    { key: "Z", label: "P·A/(NkT) medido", unit: "", value: (s, p) => meanPressure(s) / idealPressure(s, mass(p)) },
    { key: "A", label: "Área", unit: "nm²", value: (s) => areaOf(s) },
    { key: "TA", label: "T·A (constante na adiabática 2D)", unit: "K·nm²", value: (s, p) => T(s, p) * areaOf(s) },
    { key: "E", label: "Energia cinética total", unit: "zJ", value: (s, p) => kineticEnergy(s, mass(p)) * 1e21 },
    { key: "vrms", label: "Velocidade quadrática média", unit: "m/s", value: (s, p) => Math.SQRT2 * sigmaV(T(s, p), mass(p)) * 1000 },
  ],
  conserved: "E",
  chart: { x: "tf", y: "P" },

  scenarios: [
    {
      id: "relaxacao",
      label: "Todas com a mesma rapidez",
      params: { dist: 1, N: 200, diam: 0.35, massa: 20 },
      guide: `### O gás "descobre" Maxwell–Boltzmann
1. Todas as moléculas começam com a mesma rapidez: o histograma é uma barra só.
2. Rode e acompanhe o histograma. As colisões trocam energia entre as moléculas e a distribuição se espalha.
3. Depois de algumas dezenas de picossegundos, compare com a curva $f(v) = \\frac{mv}{kT}e^{-mv^2/2kT}$.
4. A energia total (e portanto $T$) não mudou. O que mudou foi só a **distribuição**.`,
      predict: [
        {
          question: "As moléculas começam todas com a mesma rapidez. Depois de muitas colisões elásticas, a rapidez delas:",
          options: ["continua igual para todas", "se espalha numa distribuição com muitas lentas e algumas muito rápidas", "cai para zero, pois as colisões dissipam energia"],
          answer: 1,
          explanation: "Colisões elásticas conservam a energia total, mas redistribuem: o estado mais provável é a distribuição de Maxwell–Boltzmann.",
        },
      ],
    },
    {
      id: "pressao",
      label: "Pressão: medida × NkT/A",
      params: { N: 150, T0: 300, L0: 20, massa: 40 },
      guide: `### De onde vem a pressão
1. A pressão é o impulso $2mv_\\perp$ entregue às paredes por unidade de tempo e de comprimento. Compare a **média acumulada** com $NkT/A$.
2. A média de 20 ps flutua bastante: são poucas moléculas. Quanto maior $N$, menor a flutuação relativa.
3. Aumente o diâmetro molecular para 0,8 nm: $PA/NkT$ passa de 1. É o volume excluído de um gás real (van der Waals).`,
    },
    {
      id: "massas",
      label: "Hélio × xenônio",
      params: { massa: 4, N: 120, T0: 300 },
      guide: `### Mesma temperatura, massas diferentes
1. Anote $P$ e $v_{\\text{rms}}$ para o hélio.
2. Troque para xenônio (131 u), mantendo $N$, $T$ e $A$. A rapidez cai como $1/\\sqrt m$.
3. E a pressão? Cada choque de xenônio transfere mais momento, mas os choques são mais raros.`,
      predict: [
        {
          question: "Com o mesmo N, a mesma T e a mesma área, qual gás exerce maior pressão?",
          options: ["Hélio, porque as moléculas são mais rápidas", "Xenônio, porque as moléculas são mais pesadas", "A mesma pressão"],
          answer: 2,
          explanation: "$PA = NkT$ não depende da massa: $mv^2$ médio é o mesmo ($2kT$) para os dois gases.",
        },
      ],
    },
    {
      id: "adiabatica",
      label: "Compressão adiabática e isotérmica",
      params: { parede: 0, vpist: 0.03, N: 150, diam: 0.35, L0: 24 },
      guide: `### Empurrando o pistão
1. Com a parede **isolante**, use *Comprimir à metade* (ou arraste o pistão). Cada molécula que bate no pistão em movimento volta mais rápida: o gás esquenta.
2. Em 2D o gás monoatômico tem $\\gamma = 2$, então $TA$ deve ficar constante. Confira com o observável $T\\cdot A$.
3. Troque a parede para **térmica** com $T_w$ igual à temperatura do gás e repita: agora $PA$ fica constante (isotérmica).
4. Aumente a velocidade do pistão: a compressão rápida não é quase-estática e $TA$ sobe mais.`,
      predict: [
        {
          question: "Comprimindo devagar o gás pela metade da área, com paredes isolantes, a temperatura (em 2D):",
          options: ["fica igual", "dobra", "aumenta 4 vezes", "cai à metade"],
          answer: 1,
          explanation: "Na adiabática $TA^{\\gamma - 1}$ é constante e em 2D $\\gamma = 2$: metade da área, o dobro da temperatura.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "pressao2d",
      prompt: "Um gás bidimensional de {N} moléculas ocupa uma caixa de {L0} nm × 20 nm a {T0} K. Qual é a pressão (força por unidade de comprimento) prevista por PA = NkT, em mN/m?",
      vary: { N: [50, 300, 0], L0: [8, 30, 0], T0: [100, 1000, 0] },
      answer: { label: "P", unit: "mN/m", compute: (p) => ((num(p, "N") * KB * num(p, "T0")) / (num(p, "L0") * H * 1e-18)) * 1e3 },
      hint: "A = L × 20 nm em m²; k = 1,38 × 10⁻²³ J/K.",
    },
    {
      id: "vp",
      prompt: "Num gás bidimensional de moléculas de massa {massa} u a {T0} K, qual é a velocidade mais provável (o pico de f(v))?",
      vary: { massa: [4, 131, 0], T0: [100, 1000, 0] },
      answer: { label: "v_p", unit: "m/s", compute: (p) => Math.sqrt((KB * num(p, "T0")) / (num(p, "massa") * 1.66053907e-27)) },
      hint: "Em 2D, f(v) ∝ v e^(−mv²/2kT) tem máximo em v_p = √(kT/m); 1 u = 1,66 × 10⁻²⁷ kg.",
    },
  ],

  init: initGas,
  step: (s, p, _t, dt) => stepGas(s, p, dt),
  dt: DT,
  sampleEvery: 25,
  maxSamples: 900,

  pointer: {
    down: (s, _p, pt) => (nearPiston(s, pt) ? { ...s, grab: true } : undefined),
    move: (s, _p, pt, dragging) => (dragging && s.grab ? { ...s, xt: Math.max(L_MIN, Math.min(L_MAX, pt.x)) } : undefined),
    up: (s) => (s.grab ? { ...s, grab: false } : undefined),
    cursor: (s, _p, pt) => (nearPiston(s, pt) ? "ew-resize" : undefined),
  },
  actions: [
    { id: "comprimir", label: "Comprimir à metade", run: (s) => ({ ...s, xt: Math.max(L_MIN, s.xt / 2) }) },
    { id: "expandir", label: "Expandir ao dobro", run: (s) => ({ ...s, xt: Math.min(L_MAX, s.xt * 2) }) },
    { id: "aquecer", label: "Aquecer (+20% em T)", run: (s, p) => heat(s, 1.2, mass(p)) },
    { id: "resfriar", label: "Resfriar (−20% em T)", run: (s, p) => heat(s, 0.8, mass(p)) },
    { id: "zerar", label: "Zerar médias", run: (s, p) => resetAverages(s, mass(p)) },
  ],

  viewport: () => ({ xMin: -2, xMax: 63, yMin: -4, yMax: 23 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mass(p);
    const Tm = T(s, p);
    const vp = sigmaV(Tm, m);
    const rad = num(p, "diam", 0.2) / 2;
    const thermal = Math.round(num(p, "parede")) === 1;

    // ---------- Caixa ----------
    d.rect(0, 0, s.xp, H, { fill: theme.accent, alpha: 0.05 });
    d.line(0, 0, L_MAX + 1, 0, { width: 3 });
    d.line(0, H, L_MAX + 1, H, { width: 3 });
    if (thermal) {
      const Tw = num(p, "Tw", 300);
      d.rect(-1.2, 0, 1.2, H, { fill: Tw >= Tm ? theme.positive : theme.negative, alpha: 0.75 });
      d.text(`T_w = ${fmt(Tw)} K`, -0.6, H + 0.9, { size: 11, color: Tw >= Tm ? theme.positive : theme.negative, weight: "600" });
    } else d.line(0, 0, 0, H, { width: 3 });
    // Pistão e haste
    d.rect(s.xp, -0.2, 0.6, H + 0.4, { fill: theme.muted, stroke: theme.text, width: 1 });
    d.line(s.xp + 0.6, H / 2, L_MAX + 1.5, H / 2, { color: theme.muted, width: 5 });
    if (s.grab || Math.abs(s.xt - s.xp) > 0.01) d.line(s.xt, -0.8, s.xt, H + 0.8, { color: theme.accent, dash: [4, 4], width: 1 });
    // Força do gás no pistão (P × H por unidade de profundidade)
    d.arrowPx(s.xp + 0.6, H * 0.8, 1, 0, 18 + 14 * Math.min(4, s.Pema / Math.max(idealPressure(s, m), 1e-12)), { color: theme.positive });
    d.text("F do gás", s.xp + 0.9, H * 0.8 + 1, { size: 10, align: "left", color: theme.positive });

    // Moléculas: cor pela rapidez relativa a v_p
    const n = s.x.length;
    for (let i = 1; i < n; i++) {
      const v = Math.hypot(s.vx[i]!, s.vy[i]!) / vp;
      const c = v < 0.7 ? theme.negative : v > 1.7 ? theme.positive : theme.series[5]!;
      d.circle(s.x[i]!, s.y[i]!, rad, { fill: c, minPx: 2.6 });
    }
    // Molécula rastreada: trajetória recente e vetor velocidade
    const tr = frame.trail.slice(-40).map((q): [number, number] => [q.x[0] ?? 0, q.y[0] ?? 0]);
    if (tr.length > 1) d.polyline(tr, { color: theme.text, width: 1, alpha: 0.35 });
    d.circle(s.x[0]!, s.y[0]!, rad, { fill: theme.text, minPx: 4 });
    d.arrowPx(s.x[0]!, s.y[0]!, s.vx[0]!, s.vy[0]!, 14 + 22 * Math.min(3, Math.hypot(s.vx[0]!, s.vy[0]!) / vp), { color: theme.accent });

    d.text(`T = ${fmt(Tm, 4)} K    P = ${fmt(meanPressure(s) * 1e3)} mN/m    NkT/A = ${fmt(idealPressure(s, m) * 1e3)} mN/m`, 0, H + 2.3, { size: 12, weight: "600", align: "left" });
    d.text(`câmera lenta: 1 s = ${TIME_SCALE} ps   ·   t = ${fmt(s.tp, 4)} ps   ·   A = ${fmt(areaOf(s))} nm²   ·   arraste o pistão`, 0, -1.4, { size: 10, color: theme.muted, align: "left" });
    // Legenda de cores
    const leg: [string, string][] = [["lenta", theme.negative], ["≈ v_p", theme.series[5]!], ["rápida", theme.positive]];
    leg.forEach(([lab, c], i) => {
      d.dot(1 + i * 4.2, -2.9, 4, c);
      d.text(lab, 1.5 + i * 4.2, -2.9, { size: 10, align: "left" });
    });
    d.text("● rastreada: seta = velocidade", 14.5, -2.9, { size: 10, align: "left", color: theme.muted });

    // ---------- Histograma de rapidez ----------
    const vmaxMs = s.vmax * 1000;
    const bw = vmaxMs / NBINS;
    const fpk = mb2d(vp * 1000, Tm, m);
    const fTop = fpk * 1.45;
    const X = (v: number) => HP.x0 + (v / vmaxMs) * (HP.x1 - HP.x0);
    const Y = (f: number) => HP.y0 + (Math.min(f, fTop) / fTop) * (HP.y1 - HP.y0);
    d.line(HP.x0, HP.y0, HP.x1, HP.y0, { color: theme.muted });
    d.line(HP.x0, HP.y0, HP.x0, HP.y1, { color: theme.muted });
    d.text("v (m/s)", HP.x1, HP.y0 - 1.6, { size: 11, color: theme.muted, align: "right" });
    d.text("f(v): fração por m/s", HP.x0, HP.y1 + 0.9, { size: 11, color: theme.muted, align: "left" });
    const tick = niceStep(vmaxMs);
    for (let v = 0; v <= vmaxMs * 1.0001; v += tick) d.text(fmt(v), X(v), HP.y0 - 0.7, { size: 9, color: theme.muted });
    if (s.hw > 0) {
      s.hist.forEach((h, b) => {
        const f = h / (s.hw * bw);
        d.rect(X(b * bw) + 0.05, HP.y0, X(bw) - HP.x0 - 0.1, Y(f) - HP.y0, { fill: theme.accent, alpha: 0.5 });
      });
    }
    d.plot((x) => Y(mb2d(((x - HP.x0) / (HP.x1 - HP.x0)) * vmaxMs, Tm, m)), HP.x0, HP.x1, { color: theme.positive, width: 2.5 });
    const vrms = Math.SQRT2 * vp * 1000;
    d.line(X(vp * 1000), HP.y0, X(vp * 1000), Y(fpk), { color: theme.positive, dash: [3, 3], width: 1 });
    d.text(`v_p = ${fmt(vp * 1000)} m/s`, X(vp * 1000), Y(fpk) + 0.8, { size: 10, color: theme.positive });
    if (vrms < vmaxMs) {
      d.line(X(vrms), HP.y0, X(vrms), Y(mb2d(vrms, Tm, m)), { color: theme.muted, dash: [3, 3], width: 1 });
      d.text("v_rms", X(vrms), Y(mb2d(vrms, Tm, m)) + 0.7, { size: 10, color: theme.muted, align: "left", dx: 3 });
    }
    d.rect(HP.x1 - 9.5, HP.y1 - 0.4, 0.8, 0.5, { fill: theme.accent, alpha: 0.5 });
    d.text("medido (média móvel)", HP.x1 - 8.5, HP.y1 - 0.15, { size: 10, align: "left" });
    d.line(HP.x1 - 9.5, HP.y1 - 1.3, HP.x1 - 8.7, HP.y1 - 1.3, { color: theme.positive, width: 2.5 });
    d.text("Maxwell–Boltzmann 2D", HP.x1 - 8.5, HP.y1 - 1.3, { size: 10, align: "left" });
  },
});

function niceStep(range: number, n = 5): number {
  const raw = range / n;
  const e = 10 ** Math.floor(Math.log10(raw));
  const f = raw / e;
  return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * e;
}

export default gasIdeal;
