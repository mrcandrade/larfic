import { clamp, defineSim, deg, draw, num, rad, rk4, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { wavelengthColor } from "./color.ts";
import { fmt, panel } from "./panel.ts";
import {
  GASES,
  HC_EV_NM,
  KB_EV,
  KGAIN,
  TAU2,
  boltzmannRatio,
  emission,
  gasOf,
  gratingAngle,
  gratingD,
  gratingLambda,
  hydrogenNm,
  laserDerivs,
  lineDepth,
  outputPower,
  photonLifetime,
  thresholdInversion,
  thresholdPump,
  transmission,
  type Gas,
} from "./physics.ts";

export * from "./physics.ts";

export interface Medida {
  theta: number;
  m: number;
  lam: number;
  ref: number;
}

export interface LaserState {
  /** [N0, N1, N2, N3, q, t(ms)] */
  y: number[];
  /** Ângulo da luneta (graus), arrastável. */
  tel: number;
  meas: Medida[];
  drag: boolean;
  msg: string;
}

const mode = (p: Params) => Math.round(num(p, "modo", 0));
const gas = (p: Params) => gasOf(num(p, "gas", 2));
const absorb = (p: Params) => Math.round(num(p, "fonte", 0)) === 1;
const temp = (p: Params) => num(p, "T", 600);
const column = (p: Params) => num(p, "col", 1e-4);
const lines = (p: Params) => num(p, "N", 600);
const order = (p: Params) => Math.round(num(p, "ordem", 1));
const levels = (p: Params): 3 | 4 => (Math.round(num(p, "niveis", 4)) === 3 ? 3 : 4);
const pump = (p: Params) => num(p, "Wp", 0.5);
const refl = (p: Params) => num(p, "R", 0.9);

const deltaN = (y: number[], p: Params) => (y[2] ?? 0) - (levels(p) === 4 ? (y[1] ?? 0) : (y[0] ?? 0));

/** λ lido na luneta. */
export const telescopeLambda = (tel: number, p: Params) => gratingLambda(rad(tel), lines(p), order(p));

/** Linha do gás mais próxima de um λ. */
const nearestLine = (g: Gas, nm: number) => g.lines.reduce((a, b) => (Math.abs(b.nm - nm) < Math.abs(a.nm - nm) ? b : a));

// geometria do espectroscópio
const G = { x: 4.4, y: 9.1 };
const ARM = 2.75;
const EYE = { x: 9.3, y: 9.1, r: 1.45 };
const EYE_FIELD = 1.5; // graus de meia abertura do campo da luneta
const STRIP = { x0: 1.7, x1: 19.4, l0: 380, l1: 750 };
const sx = (nm: number) => STRIP.x0 + ((nm - STRIP.l0) / (STRIP.l1 - STRIP.l0)) * (STRIP.x1 - STRIP.x0);

const hitTel = (s: LaserState, x: number, y: number) =>
  Math.hypot(x - (G.x + ARM * Math.cos(rad(s.tel))), y - (G.y + ARM * Math.sin(rad(s.tel)))) < 0.55;

export const espectrosLaser = defineSim<LaserState>({
  id: "espectros-laser",
  title: "Espectros de emissão e absorção e o laser",
  course: "FG IV",
  topic: "Átomo",
  priority: "P2",
  summary:
    "Um espectroscópio de rede mostra as linhas de emissão de um gás e as linhas escuras que o mesmo gás produz na luz branca, ligadas ao diagrama de níveis. No modo laser, as equações de taxa de um sistema de 3 ou 4 níveis mostram a inversão de população e o laser ligando acima do limiar.",
  equations: [
    String.raw`h f = \frac{hc}{\lambda} = E_{\text{sup}} - E_{\text{inf}},\qquad d\,\operatorname{sen}\theta = m\lambda`,
    String.raw`\frac{N_2}{N_1} = e^{-(E_2 - E_1)/k_BT}\quad\text{(equilíbrio térmico: nunca há inversão)}`,
    String.raw`\frac{dN_2}{dt} = \frac{N_3}{\tau_{32}} - \frac{N_2}{\tau_2} - K\,q\,(N_2 - N_1),\qquad \frac{dN_3}{dt} = W_p (N_0 - N_3) - \frac{N_3}{\tau_{32}}`,
    String.raw`\frac{dq}{dt} = \underbrace{K q (N_2 - N_1)}_{\text{estimulada}} - \underbrace{\frac{q}{\tau_c}}_{\text{perdas}} + \underbrace{\beta\,\frac{N_2}{\tau_2}}_{\text{espontânea}},\qquad \tau_c = \frac{t_{\text{ida e volta}}}{-\ln R}`,
    String.raw`\text{limiar: } K\,\Delta N_{\text{th}}\,\tau_c = 1`,
  ],
  liveEquations(s, p) {
    if (mode(p) === 0) {
      const lam = telescopeLambda(s.tel, p);
      return [
        String.raw`\lambda = \frac{d\,\operatorname{sen}\theta}{m} = \frac{${texNum(gratingD(lines(p)), 5)}\ \text{nm} \times \operatorname{sen} ${texNum(s.tel, 4)}^\circ}{${order(p)}} = ${texNum(lam, 5)}\ \text{nm}`,
        String.raw`E_\gamma = hc/\lambda = ${texNum(HC_EV_NM / lam, 4)}\ \text{eV},\qquad k_BT = ${texNum(KB_EV * temp(p), 3)}\ \text{eV}`,
      ];
    }
    const R = refl(p);
    const Wth = thresholdPump(R, levels(p));
    return [
      String.raw`\tau_c = ${texNum(photonLifetime(R), 3)}\ \text{ms},\quad \Delta N_{\text{th}} = ${texNum(thresholdInversion(R), 3)},\quad \Delta N = ${texNum(deltaN(s.y, p), 3)}`,
      String.raw`W_{\text{th}} = ${texNum(Wth, 3)}\ \text{ms}^{-1},\quad W_p/W_{\text{th}} = ${texNum(pump(p) / Wth, 3)},\quad q = ${texNum(s.y[4] ?? 0, 3)}`,
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
        { value: 0, label: "Espectroscópio de rede" },
        { value: 1, label: "Laser: inversão de população" },
      ],
    },
    { key: "gas", label: "Gás", unit: "", min: 0, max: GASES.length - 1, step: 1, default: 2, live: true, options: GASES.map((g, i) => ({ value: i, label: g.name })) },
    {
      key: "fonte",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Emissão: lâmpada de descarga com o gás" },
        { value: 1, label: "Absorção: luz branca atravessando o gás" },
      ],
    },
    { key: "T", label: "Temperatura do gás absorvedor", unit: "K", min: 300, max: 30000, step: 10, default: 600, log: true, live: true },
    { key: "col", label: "Densidade de coluna do gás (relativa)", unit: "", min: 1e-6, max: 1, step: 1e-6, default: 1e-4, log: true, live: true },
    { key: "N", label: "Rede: linhas por milímetro", unit: "linhas/mm", min: 100, max: 1200, step: 10, default: 600, live: true },
    { key: "ordem", label: "Ordem m usada na leitura", unit: "", min: 1, max: 3, step: 1, default: 1, live: true },
    {
      key: "niveis",
      label: "Meio ativo",
      unit: "",
      min: 3,
      max: 4,
      step: 1,
      default: 4,
      options: [
        { value: 3, label: "3 níveis (tipo rubi)" },
        { value: 4, label: "4 níveis (tipo Nd:YAG)" },
      ],
    },
    { key: "Wp", label: "Taxa de bombeamento Wp", unit: "1/ms", min: 0.01, max: 20, step: 0.01, default: 0.5, log: true, live: true },
    { key: "R", label: "Refletividade do espelho de saída R", unit: "", min: 0.5, max: 0.995, step: 0.005, default: 0.9, live: true },
  ],

  observables: [
    { key: "tel", label: "Ângulo da luneta θ", unit: "°", value: (s) => s.tel },
    { key: "lamTel", label: "λ lido na luneta", unit: "nm", value: (s, p) => telescopeLambda(s.tel, p) },
    { key: "nmeas", label: "Medidas registradas", unit: "", value: (s) => s.meas.length },
    { key: "tms", label: "Tempo do laser", unit: "ms", value: (s) => s.y[5] ?? 0 },
    { key: "N0", label: "População N₀ (fundamental)", unit: "", value: (s) => s.y[0] ?? 0 },
    { key: "N1", label: "População N₁", unit: "", value: (s) => s.y[1] ?? 0 },
    { key: "N2", label: "População N₂ (nível superior)", unit: "", value: (s) => s.y[2] ?? 0 },
    { key: "N3", label: "População N₃ (banda de bombeio)", unit: "", value: (s) => s.y[3] ?? 0 },
    { key: "dN", label: "Inversão ΔN", unit: "", value: (s, p) => deltaN(s.y, p) },
    { key: "q", label: "Fótons no modo (por átomo)", unit: "", value: (s) => s.y[4] ?? 0 },
    { key: "P", label: "Potência de saída", unit: "u.a.", value: (s, p) => outputPower(s.y[4] ?? 0, refl(p)) },
    { key: "Ntot", label: "População total", unit: "", value: (s) => (s.y[0] ?? 0) + (s.y[1] ?? 0) + (s.y[2] ?? 0) + (s.y[3] ?? 0) },
  ],
  conserved: "Ntot",
  chart: { x: "tms", y: "P" },

  scenarios: [
    {
      id: "emissao-absorcao",
      label: "Emissão e absorção do sódio",
      params: { modo: 0, gas: 2, fonte: 0, T: 600, col: 1e-4, N: 600, ordem: 1 },
      guide: `### As mesmas cores, claras e escuras
1. A lâmpada de sódio emite poucas cores. A rede separa cada uma num ângulo $\\theta$ com $d\\,\\operatorname{sen}\\theta = m\\lambda$.
2. As faixas no meio do palco comparam o espectro de **emissão** (linhas claras) com o de **absorção** (luz branca atravessando o vapor de sódio).
3. Troque a montagem para absorção: as linhas escuras do dubleto D aparecem **exatamente** onde estavam as claras.
4. Mas só as linhas que terminam no nível fundamental (3s) absorvem: o vapor frio quase não tem átomos em 3p. Veja as setas no diagrama de níveis.
5. Arraste a luneta até o dubleto D e meça os dois comprimentos de onda (use ordem 2 para separá-los melhor).`,
      predict: [
        {
          question: "Luz branca atravessa vapor de sódio a 600 K. Quais linhas escuras aparecem?",
          options: ["todas as linhas de emissão do sódio", "só o dubleto D (589 nm)", "nenhuma: absorção não depende do gás", "linhas em posições diferentes das de emissão"],
          answer: 1,
          explanation:
            "Absorver exige átomos no nível inferior da transição. A 600 K, $k_BT \\approx 0{,}05$ eV: praticamente todos estão em 3s, e só as transições 3s → 3p (dubleto D) absorvem.",
        },
      ],
    },
    {
      id: "estrela",
      label: "Hidrogênio numa estrela quente",
      params: { modo: 0, gas: 0, fonte: 1, T: 12000, col: 0.05, N: 600, ordem: 1 },
      guide: `### Linhas de Balmer em absorção
1. As linhas visíveis do hidrogênio (Balmer) começam ou terminam em $n = 2$, que fica 10,2 eV acima do fundamental.
2. Diminua a temperatura até 3000 K: as linhas escuras somem. Não há átomos em $n = 2$ para absorver.
3. Suba até 12 000 K ou mais: a fração em $n = 2$, $\\propto e^{-10{,}2\\,\\text{eV}/k_BT}$, já basta. É por isso que estrelas tipo A mostram linhas de Balmer fortes.
4. Meça $H_\\alpha$ e confira com Bohr: $1/\\lambda = R_H (1/4 - 1/9)$.`,
      predict: [
        {
          question: "Por que o hidrogênio frio não mostra as linhas de Balmer em absorção?",
          options: ["porque o hidrogênio é transparente", "porque quase nenhum átomo está em n = 2", "porque as linhas de Balmer estão no ultravioleta", "porque a rede não as separa"],
          answer: 1,
          explanation:
            "Balmer absorve a partir de $n = 2$. Em equilíbrio, $N_2/N_1 \\sim e^{-10{,}2/k_BT}$, desprezível a menos que $T$ seja da ordem de $10^4$ K.",
        },
      ],
    },
    {
      id: "limiar",
      label: "O laser liga: limiar de 4 níveis",
      params: { modo: 1, niveis: 4, Wp: 0.5, R: 0.9 },
      guide: `### Inversão, ganho e limiar
1. O bombeio leva átomos à banda 3, que decai rápido para o nível 2 (metaestável, $\\tau_2 = 1$ ms). O nível 1 esvazia rápido para o 0: a inversão $N_2 - N_1$ aparece com pouco bombeio.
2. Rode. A emissão espontânea semeia alguns fótons; a estimulada os amplifica a cada passagem. Quando o ganho supera as perdas do espelho, $q$ cresce milhões de vezes: o laser liga, com oscilações de relaxação.
3. Repare que, acima do limiar, $\\Delta N$ fica **preso** em $\\Delta N_{\\text{th}}$: o excesso de bombeio vira luz.
4. No gráfico $P \\times W_p$ veja a dobra no limiar. Mude $W_p$ ao vivo abaixo e acima de $W_{\\text{th}}$. (O tempo do laser está em ms.)`,
      predict: [
        {
          question: "Acima do limiar, se você dobrar o bombeio, a inversão ΔN em regime:",
          options: ["dobra", "fica igual a ΔN_th", "cai a zero", "cresce sem limite"],
          answer: 1,
          explanation: "No estado estacionário o ganho tem de igualar as perdas: $K\\,\\Delta N\\,\\tau_c = 1$. O bombeio extra aumenta o número de fótons, não a inversão.",
        },
      ],
    },
    {
      id: "tres-niveis",
      label: "Rubi: por que 3 níveis é difícil",
      params: { modo: 1, niveis: 3, Wp: 0.8, R: 0.9 },
      guide: `### O nível inferior é o fundamental
1. No rubi a transição laser termina no fundamental. Para inverter, é preciso tirar **mais da metade** dos átomos do fundamental.
2. Com $W_p = 0{,}8$/ms nada acontece. Aumente $W_p$ até o laser ligar e compare com o limiar de 4 níveis (cerca de 10 vezes menor).
3. Diminua $R$: as perdas aumentam, $\\Delta N_{\\text{th}}$ sobe e o limiar também.`,
    },
  ],

  exercises: [
    {
      id: "rede",
      prompt: "Uma rede de {N} linhas/mm mostra uma linha em primeira ordem a {theta}°. Qual é o comprimento de onda?",
      vary: { N: [300, 1200, 0], theta: [14, 26, 2] },
      answer: { label: "λ", unit: "nm", compute: (p) => gratingLambda(rad(num(p, "theta")), num(p, "N"), 1) },
      hint: "d = 1 mm / N e λ = d sen θ.",
    },
    {
      id: "balmer",
      prompt: "Qual é o comprimento de onda emitido pelo hidrogênio na transição do nível n = {ni} para n = 2?",
      vary: { ni: [3, 7, 0] },
      answer: { label: "λ", unit: "nm", compute: (p) => hydrogenNm(num(p, "ni"), 2) },
      hint: "E_n = −13,6 eV/n² e λ = hc/ΔE, com hc = 1240 eV·nm.",
      tolerance: 0.01,
    },
    {
      id: "boltzmann",
      prompt: "Em equilíbrio térmico a {T} K, qual é a razão N₂/N₁ entre as populações de dois níveis separados por uma transição de {lam} nm?",
      vary: { T: [2000, 9000, -2], lam: [500, 1100, 0] },
      answer: { label: "N₂/N₁", unit: "", compute: (p) => boltzmannRatio(num(p, "lam"), num(p, "T")) },
      hint: "N₂/N₁ = exp(−hc/(λ k_B T)); k_B = 8,617 × 10⁻⁵ eV/K.",
      tolerance: 0.05,
    },
  ],

  init: () => ({ y: [1, 0, 0, 0, 0, 0], tel: 20, meas: [], drag: false, msg: "" }),
  step(s, p, _t, dt) {
    if (mode(p) !== 1) return s;
    const f = (y: number[]) => [...laserDerivs(y, pump(p), refl(p), levels(p)), 1];
    const y = rk4((yy) => f(yy), s.y, p, 0, dt);
    y[4] = Math.max(0, y[4]!);
    return { ...s, y };
  },
  dt: 0.0005,
  sampleEvery: 10,
  maxSamples: 6000,

  pointer: {
    down: (s, p, pt) => (mode(p) === 0 && hitTel(s, pt.x, pt.y) ? { ...s, drag: true } : undefined),
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag || mode(p) !== 0) return undefined;
      const a = clamp(deg(Math.atan2(pt.y - G.y, pt.x - G.x)), -80, 80);
      return { ...s, tel: Math.round(a * 100) / 100 };
    },
    up: (s) => (s.drag ? { ...s, drag: false } : undefined),
    cursor: (s, p, pt) => (mode(p) === 0 && hitTel(s, pt.x, pt.y) ? "grab" : undefined),
  },
  actions: [
    { id: "menos", label: "Luneta −0,02°", run: (s) => ({ ...s, tel: Math.round((s.tel - 0.02) * 100) / 100 }) },
    { id: "mais", label: "Luneta +0,02°", run: (s) => ({ ...s, tel: Math.round((s.tel + 0.02) * 100) / 100 }) },
    {
      id: "medir",
      label: "Medir λ na luneta",
      run(s, p) {
        const lam = telescopeLambda(s.tel, p);
        if (!(lam > 0)) return { ...s, msg: "Gire a luneta para um ângulo positivo." };
        const ref = nearestLine(gas(p), lam).nm;
        const m: Medida = { theta: s.tel, m: order(p), lam, ref };
        return { ...s, meas: [...s.meas.slice(-5), m], msg: `θ = ${fmt(s.tel, 4)}°, m = ${order(p)}: λ = ${fmt(lam, 5)} nm (linha tabelada mais próxima: ${fmt(ref, 5)} nm)` };
      },
    },
    { id: "limpar", label: "Limpar medidas", run: (s) => ({ ...s, meas: [], msg: "" }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    if (mode(p) === 0) {
      renderSpectroscope(d, theme, s, p);
      renderStrips(d, theme, p);
      renderLevels(d, theme, p);
    } else {
      renderLaserLevels(d, theme, s, p);
      renderCavity(d, theme, s, p, frame.t);
      renderLaserPlots(d, theme, s, p, frame.trail);
    }
  },
});

// ---------------- espectroscópio ----------------

function renderSpectroscope(d: Draw, theme: Theme, s: LaserState, p: Params) {
  const g = gas(p);
  const N = lines(p);
  const ab = absorb(p);
  const dark = theme.dark;
  const bg = dark ? "rgba(0,0,0,0.45)" : "rgba(15,20,35,0.92)";
  d.rect(0.2, 6.25, 19.6, 5.65, { fill: bg });
  // fonte
  if (ab) {
    d.circle(0.8, G.y, 0.32, { fill: "#fffbe8", stroke: "#ffffff", width: 1 });
    d.text("luz branca", 0.8, G.y - 0.6, { color: "#ffffff", size: 9 });
    d.rect(1.3, G.y - 0.35, 0.8, 0.7, { fill: wavelengthColor(g.lines[0]!.nm), alpha: 0.25, stroke: "#ffffff", width: 1 });
    d.text(`${g.name} (${fmt(temp(p), 3)} K)`, 1.7, G.y + 0.6, { color: "#ffffff", size: 9 });
  } else {
    d.rect(0.5, G.y - 0.5, 1.4, 1.0, { fill: wavelengthColor(g.lines[0]!.nm), alpha: 0.85, stroke: "#ffffff", width: 1 });
    d.text(`lâmpada de ${g.name.toLowerCase()}`, 1.2, G.y - 0.75, { color: "#ffffff", size: 9 });
  }
  // fenda, colimador e rede
  d.line(2.5, G.y - 0.5, 2.5, G.y - 0.05, { color: "#ffffff", width: 3 });
  d.line(2.5, G.y + 0.05, 2.5, G.y + 0.5, { color: "#ffffff", width: 3 });
  d.line(2.5, G.y, G.x, G.y, { color: "#ffffff", width: 2, alpha: 0.7 });
  d.ctx.beginPath();
  d.ctx.ellipse(3.4, G.y, 0.12, 0.55, 0, 0, 2 * Math.PI);
  d.ctx.strokeStyle = "#9fd0ff";
  d.ctx.lineWidth = 1.5 * d.px;
  d.ctx.stroke();
  d.line(G.x, G.y - 0.7, G.x, G.y + 0.7, { color: "#ffffff", width: 2, dash: [2, 2] });
  d.text(`rede: ${fmt(N, 4)} linhas/mm, d = ${fmt(gratingD(N), 4)} nm`, G.x, G.y - 1.0, { color: "#ffffff", size: 9 });

  // raios difratados (ordens −3..3)
  for (let m = -3; m <= 3; m++) {
    if (m === 0) {
      d.line(G.x, G.y, G.x + ARM, G.y, { color: "#ffffff", width: 2, alpha: 0.6 });
      continue;
    }
    if (ab) {
      for (let l = 380; l <= 750; l += 2) {
        const a = gratingAngle(l, N, m);
        if (!Number.isFinite(a) || Math.abs(deg(a)) > 85) continue;
        const tr = transmission(g, l, temp(p), column(p));
        d.line(G.x, G.y, G.x + ARM * Math.cos(a), G.y + ARM * Math.sin(a), { color: wavelengthColor(l), width: 1.2, alpha: 0.12 + 0.6 * tr });
      }
    } else {
      for (const ln of g.lines) {
        const a = gratingAngle(ln.nm, N, m);
        if (!Number.isFinite(a) || Math.abs(deg(a)) > 85) continue;
        d.line(G.x, G.y, G.x + ARM * Math.cos(a), G.y + ARM * Math.sin(a), { color: wavelengthColor(ln.nm), width: 1.5, alpha: 0.35 + 0.6 * ln.I });
      }
    }
  }
  // escala angular e luneta
  for (let a = -80; a <= 80; a += 20) {
    const c = Math.cos(rad(a));
    const sn = Math.sin(rad(a));
    d.line(G.x + (ARM + 0.05) * c, G.y + (ARM + 0.05) * sn, G.x + (ARM + 0.2) * c, G.y + (ARM + 0.2) * sn, { color: "#ffffff", width: 1, alpha: 0.6 });
    d.text(`${a}°`, G.x + (ARM + 0.45) * c, G.y + (ARM + 0.45) * sn, { color: "#cfd6e0", size: 8 });
  }
  const tx = G.x + ARM * Math.cos(rad(s.tel));
  const ty = G.y + ARM * Math.sin(rad(s.tel));
  d.box(tx, ty, 0.8, 0.35, rad(s.tel), { fill: theme.accent, stroke: "#ffffff", width: 1.2 });
  d.text("luneta", tx, ty + 0.45, { color: "#ffffff", size: 9, weight: "600" });

  // vista pela luneta: campo de ±1,5° em torno de θ
  const { ctx } = d;
  ctx.save();
  ctx.beginPath();
  ctx.arc(EYE.x, EYE.y, EYE.r, 0, 2 * Math.PI);
  ctx.fillStyle = "#05070c";
  ctx.fill();
  ctx.clip();
  const ex = (th: number) => EYE.x + ((th - s.tel) / EYE_FIELD) * EYE.r;
  if (ab) {
    for (let k = -60; k <= 60; k++) {
      const th = s.tel + (k / 60) * EYE_FIELD;
      for (let m = 1; m <= 3; m++) {
        const l = gratingLambda(rad(th), N, m);
        if (l < 380 || l > 750) continue;
        const tr = transmission(g, l, temp(p), column(p));
        d.rect(ex(th), EYE.y - EYE.r, (EYE.r * 2) / 120 + 0.01, 2 * EYE.r, { fill: wavelengthColor(l), alpha: 0.85 * tr });
      }
    }
  } else {
    for (let m = -3; m <= 3; m++) {
      if (m === 0) continue;
      for (const ln of g.lines) {
        const a = gratingAngle(ln.nm, N, m);
        if (!Number.isFinite(a)) continue;
        const th = deg(a);
        if (Math.abs(th - s.tel) > EYE_FIELD) continue;
        d.line(ex(th), EYE.y - EYE.r, ex(th), EYE.y + EYE.r, { color: wavelengthColor(ln.nm), width: 3, alpha: 0.4 + 0.6 * ln.I });
      }
    }
  }
  d.line(EYE.x, EYE.y - EYE.r, EYE.x, EYE.y + EYE.r, { color: "#ffffff", width: 1 });
  d.line(EYE.x - EYE.r, EYE.y, EYE.x + EYE.r, EYE.y, { color: "#ffffff", width: 1 });
  ctx.restore();
  d.circle(EYE.x, EYE.y, EYE.r, { stroke: "#ffffff", width: 1.5 });
  d.text("vista pela luneta (±1,5°)", EYE.x, EYE.y + EYE.r + 0.25, { color: "#ffffff", size: 9 });

  // leitura e medidas
  const lam = telescopeLambda(s.tel, p);
  let y = 11.55;
  const x0 = 11.2;
  d.text(`θ = ${fmt(s.tel, 4)}°   m = ${order(p)}   λ = d sen θ / m = ${fmt(lam, 5)} nm`, x0, y, { color: "#ffffff", size: 11, weight: "600", align: "left" });
  y -= 0.5;
  d.text("Arraste a luneta; centralize a linha no retículo e clique Medir.", x0, y, { color: "#cfd6e0", size: 9, align: "left" });
  y -= 0.5;
  d.text("θ (°)      m      λ medido (nm)      tabelado (nm)", x0, y, { color: "#cfd6e0", size: 10, align: "left" });
  for (const mm of s.meas) {
    y -= 0.42;
    d.text(`${fmt(mm.theta, 4)}`, x0, y, { color: wavelengthColor(mm.lam, "#ffffff"), size: 10, align: "left" });
    d.text(`${mm.m}`, x0 + 1.75, y, { color: "#ffffff", size: 10, align: "left" });
    d.text(`${fmt(mm.lam, 5)}`, x0 + 2.75, y, { color: "#ffffff", size: 10, align: "left" });
    d.text(`${fmt(mm.ref, 5)}`, x0 + 5.6, y, { color: "#cfd6e0", size: 10, align: "left" });
  }
  if (s.msg) d.text(s.msg, 0.4, 6.5, { color: "#ffffff", size: 9, align: "left" });
}

function renderStrips(d: Draw, theme: Theme, p: Params) {
  const g = gas(p);
  const yE = 5.0;
  const yA = 4.25;
  const h = 0.6;
  const step = 1;
  d.rect(STRIP.x0, yE, STRIP.x1 - STRIP.x0, h, { fill: "#000000" });
  for (let l = STRIP.l0; l < STRIP.l1; l += step) {
    const e = Math.min(1, emission(g, l + step / 2) * 1.6);
    if (e > 0.01) d.rect(sx(l), yE, sx(l + step) - sx(l) + 0.005, h, { fill: wavelengthColor(l + step / 2), alpha: e });
    const tr = transmission(g, l + step / 2, temp(p), column(p));
    d.rect(sx(l), yA, sx(l + step) - sx(l) + 0.005, h, { fill: "#000000" });
    d.rect(sx(l), yA, sx(l + step) - sx(l) + 0.005, h, { fill: wavelengthColor(l + step / 2), alpha: tr });
  }
  d.rect(STRIP.x0, yE, STRIP.x1 - STRIP.x0, h, { stroke: theme.muted, width: 1 });
  d.rect(STRIP.x0, yA, STRIP.x1 - STRIP.x0, h, { stroke: theme.muted, width: 1 });
  d.text("emissão", STRIP.x0 - 0.1, yE + h / 2, { size: 10, align: "right" });
  d.text("absorção", STRIP.x0 - 0.1, yA + h / 2, { size: 10, align: "right" });
  for (let l = 400; l <= 750; l += 50) d.text(`${l}`, sx(l), yA, { color: theme.muted, size: 9, dy: 9 });
  d.text("λ (nm)", STRIP.x1, yA, { color: theme.muted, size: 9, align: "right", dy: 20 });
}

function renderLevels(d: Draw, theme: Theme, p: Params) {
  const g = gas(p);
  const y0 = 0.4;
  const y1 = 3.3;
  const used = new Set<number>();
  for (const l of g.lines) {
    used.add(l.up);
    used.add(l.low);
  }
  const Es = [...used].map((i) => g.levels[i]!.E);
  const eMin = Math.min(...Es);
  const eMax = Math.max(...Es);
  const Y = (E: number) => y0 + ((E - eMin) / Math.max(eMax - eMin, 1e-6)) * (y1 - y0);
  const kT = KB_EV * temp(p);
  let lastY = -Infinity;
  for (const i of [...used].sort((a, b) => g.levels[a]!.E - g.levels[b]!.E)) {
    const lv = g.levels[i]!;
    d.line(STRIP.x0, Y(lv.E), STRIP.x1, Y(lv.E), { color: theme.muted, width: 1, alpha: 0.6 });
    if (Y(lv.E) - lastY < 0.25) continue; // níveis quase coincidentes (dubleto): um rótulo só
    lastY = Y(lv.E);
    d.text(lv.label, STRIP.x0 - 0.1, Y(lv.E), { size: 8, align: "right", color: theme.muted });
    d.text(`${fmt(lv.E, 4)} eV`, STRIP.x1, Y(lv.E), { size: 8, align: "right", color: theme.muted, dy: -6 });
  }
  for (const l of g.lines) {
    const x = sx(l.nm);
    const ya = Y(g.levels[l.up]!.E);
    const yb = Y(g.levels[l.low]!.E);
    const col = wavelengthColor(l.nm);
    if (absorb(p)) {
      const tau = lineDepth(g, l, temp(p), column(p));
      d.arrow(x, yb, 0, ya - yb, { color: col, width: 2, alpha: tau > 0.05 ? 1 : 0.2 });
    } else d.arrow(x, ya, 0, yb - ya, { color: col, width: 2 });
  }
  const groundNote = eMin > 0.01 ? `fundamental em 0 eV (fora da escala); kT = ${fmt(kT, 3)} eV` : `kT = ${fmt(kT, 3)} eV`;
  d.text(
    absorb(p) ? `Setas para cima: absorção (apagadas se o nível inferior está vazio). ${groundNote}` : `Setas para baixo: emissão hf = E_sup − E_inf. ${groundNote}`,
    STRIP.x1,
    3.7,
    { size: 9, align: "right", color: theme.muted },
  );
}

// ---------------- laser ----------------

function renderLaserLevels(d: Draw, theme: Theme, s: LaserState, p: Params) {
  const lv = levels(p);
  const [N0 = 0, N1 = 0, N2 = 0, N3 = 0] = s.y;
  const Ey = lv === 4 ? [6.4, 7.5, 9.6, 11.1] : [6.4, 6.4, 9.6, 11.1];
  const xL = 1.0;
  const xR = 5.6;
  const pops = [N0, N1, N2, N3];
  const names = lv === 4 ? ["0 fundamental", "1 inferior do laser", "2 metaestável (τ₂ = 1 ms)", "3 banda de bombeio"] : ["0 fundamental = inferior do laser", "", "2 metaestável (τ₂ = 1 ms)", "3 banda de bombeio"];
  d.text(`Níveis e populações (${lv} níveis)`, 0.4, 11.75, { size: 12, weight: "600", align: "left" });
  for (let i = 0; i < 4; i++) {
    if (lv === 3 && i === 1) continue;
    d.line(xL, Ey[i]!, xR, Ey[i]!, { color: theme.text, width: 2 });
    d.rect(xR + 0.2, Ey[i]! - 0.12, 3.6 * pops[i]!, 0.24, { fill: theme.series[i]!, alpha: 0.8 });
    d.text(`${names[i]}: N = ${fmt(pops[i]!, 3)}`, xL, Ey[i]!, { size: 9, align: "left", dy: -9, color: theme.muted });
  }
  // bombeio
  d.arrow(1.6, Ey[0]!, 0, Ey[3]! - Ey[0]! - 0.05, { color: theme.series[4]!, width: 3 });
  d.text(`bombeio Wp = ${fmt(pump(p), 3)}/ms`, 1.75, (Ey[0]! + Ey[3]!) / 2 + 0.8, { size: 9, align: "left", color: theme.series[4]! });
  // decaimento rápido 3 → 2 (ondulado)
  const wavy = (x: number, ya: number, yb: number, col: string) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 30; i++) pts.push([x + 0.08 * Math.sin(i * 1.3), ya + ((yb - ya) * i) / 30]);
    d.polyline(pts, { color: col, width: 1.5 });
    d.arrowPx(x, yb + 0.05, 0, -1, 8, { color: col });
  };
  wavy(2.7, Ey[3]!, Ey[2]!, theme.muted);
  d.text("rápido", 2.85, (Ey[3]! + Ey[2]!) / 2, { size: 8, align: "left", color: theme.muted });
  if (lv === 4) {
    wavy(2.7, Ey[1]!, Ey[0]!, theme.muted);
    d.text("rápido", 2.85, (Ey[1]! + Ey[0]!) / 2, { size: 8, align: "left", color: theme.muted });
  }
  // transição laser
  const laserCol = theme.positive;
  const yl = lv === 4 ? Ey[1]! : Ey[0]!;
  d.arrow(4.3, Ey[2]!, 0, yl - Ey[2]!, { color: laserCol, width: 3 });
  d.text("laser", 4.45, (Ey[2]! + yl) / 2, { size: 10, weight: "600", align: "left", color: laserCol });
  const dn = deltaN(s.y, p);
  const R = refl(p);
  d.text(
    `ΔN = ${fmt(dn, 3)} ${dn > 0 ? "(inversão!)" : "(sem inversão)"} · limiar ΔN_th = ${fmt(thresholdInversion(R), 3)}`,
    0.4,
    5.75,
    { size: 10, align: "left", color: dn > thresholdInversion(R) * 0.98 ? theme.positive : theme.text },
  );
}

/** Hash determinístico para posições de átomos e fótons. */
const hash = (k: number) => {
  const x = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return x - Math.floor(x);
};

function renderCavity(d: Draw, theme: Theme, s: LaserState, p: Params, t: number) {
  const [, , N2 = 0, , q = 0] = s.y;
  const R = refl(p);
  const X0 = 11.0;
  const X1 = 18.2;
  const Yc = 9.3;
  d.text("Cavidade: meio ativo entre dois espelhos", 10.4, 11.75, { size: 12, weight: "600", align: "left" });
  // espelhos
  d.rect(X0 - 0.35, Yc - 1.3, 0.25, 2.6, { fill: theme.muted, stroke: theme.text, width: 1 });
  d.rect(X1 + 0.1, Yc - 1.3, 0.25, 2.6, { fill: theme.muted, alpha: 0.5, stroke: theme.text, width: 1 });
  d.text("R = 100 %", X0 - 0.22, Yc - 1.6, { size: 9 });
  d.text(`R = ${fmt(R * 100, 3)} %`, X1 + 0.22, Yc - 1.6, { size: 9 });
  // meio ativo e átomos (fração excitada = N₂)
  d.rect(X0 + 0.2, Yc - 0.9, X1 - X0 - 0.4, 1.8, { fill: theme.ground, stroke: theme.muted, width: 1 });
  const na = 60;
  for (let i = 0; i < na; i++) {
    const x = X0 + 0.4 + (X1 - X0 - 0.8) * hash(i);
    const y = Yc - 0.75 + 1.5 * hash(i + 100);
    const excited = hash(i + 200) < N2;
    d.dot(x, y, 3, excited ? theme.positive : theme.series[0]!, excited ? 1 : 0.6);
  }
  // fótons no modo: número desenhado ~ log q
  const nph = Math.round(clamp(4 * Math.log10(Math.max(q, 1e-12) / 1e-8), 0, 40));
  const laserCol = theme.positive;
  const Lc = X1 - X0;
  for (let i = 0; i < nph; i++) {
    const u = (hash(i + 300) + t * (0.8 + hash(i + 400))) % 2;
    const x = X0 + (u < 1 ? u : 2 - u) * Lc;
    const y = Yc - 0.7 + 1.4 * hash(i + 500);
    d.arrowPx(x, y, u < 1 ? 1 : -1, 0, 14, { color: laserCol, width: 1.5, head: 5 });
  }
  // feixe de saída
  const P = outputPower(q, R);
  const a = clamp(Math.log10(Math.max(P, 1e-9) / 1e-6) / 6, 0, 1);
  if (a > 0) d.rect(X1 + 0.35, Yc - 0.12 - 0.15 * a, 1.3, 0.24 + 0.3 * a, { fill: laserCol, alpha: a });
  d.text(`P = ${fmt(P, 3)} u.a.`, X1 + 1.0, Yc + 0.75, { size: 9 });
  // legenda dos processos
  let y = 7.4;
  const x0 = 10.4;
  d.text("●", x0, y, { color: theme.positive, size: 10, align: "left" });
  d.text("átomo excitado (nível 2)", x0 + 0.3, y, { size: 9, align: "left" });
  d.text("●", x0 + 4.6, y, { color: theme.series[0]!, size: 10, align: "left" });
  d.text("átomo no nível inferior", x0 + 4.9, y, { size: 9, align: "left" });
  y -= 0.45;
  d.text("Absorção: fóton + átomo em baixo → átomo excitado (B₁₂).", x0, y, { size: 9, align: "left", color: theme.muted });
  y -= 0.4;
  d.text("Espontânea: átomo excitado → fóton em direção aleatória (A₂₁ = 1/τ₂).", x0, y, { size: 9, align: "left", color: theme.muted });
  y -= 0.4;
  d.text("Estimulada: fóton + átomo excitado → 2 fótons idênticos (B₂₁ = B₁₂).", x0, y, { size: 9, align: "left", color: theme.muted });
}

function renderLaserPlots(d: Draw, theme: Theme, s: LaserState, p: Params, trail: LaserState[]) {
  const R = refl(p);
  const tNow = s.y[5] ?? 0;
  const tMin = Math.max(0, tNow - 4);
  const Pt = panel(d, { x0: 1.3, y0: 0.8, x1: 9.4, y1: 4.6 }, { min: tMin, max: tMin + 4 }, { min: -1, max: 1 });
  Pt.frame({ xlabel: "t (ms)", ylabel: "ΔN e potência (normalizada)" });
  const pts = trail.filter((x) => (x.y[5] ?? 0) >= tMin).concat([s]);
  Pt.line(
    pts.map((x) => [x.y[5] ?? 0, deltaN(x.y, p)]),
    { color: theme.series[2]!, width: 2 },
  );
  const pmax = Math.max(1e-30, ...pts.map((x) => outputPower(x.y[4] ?? 0, R)));
  Pt.line(
    pts.map((x) => [x.y[5] ?? 0, outputPower(x.y[4] ?? 0, R) / pmax]),
    { color: theme.positive, width: 1.5 },
  );
  Pt.line(
    [
      [tMin, thresholdInversion(R)],
      [tMin + 4, thresholdInversion(R)],
    ],
    { color: theme.series[2]!, width: 1, dash: [5, 4] },
  );
  d.text("ΔN", Pt.box.x0 + 0.15, Pt.box.y1 - 0.3, { color: theme.series[2]!, size: 10, align: "left" });
  d.text(`P/P_max (P_max = ${fmt(pmax, 3)})`, Pt.box.x0 + 0.15, Pt.box.y1 - 0.7, { color: theme.positive, size: 10, align: "left" });
  d.text("ΔN_th", Pt.box.x1 - 0.1, Pt.Y(thresholdInversion(R)) + 0.2, { color: theme.series[2]!, size: 9, align: "right" });

  // P × Wp em regime (aproximação analítica com N₁, N₃ ≈ 0) para 3 e 4 níveis
  const steady = (W: number, lv: 3 | 4) => {
    const dn = thresholdInversion(R);
    if (lv === 4) {
      const q = (W * (1 - dn) - dn / TAU2) / (KGAIN * dn);
      return q > 0 ? outputPower(q, R) : 0;
    }
    const N2 = (1 + dn) / 2;
    const q = (W * (1 - N2) - N2 / TAU2) / (KGAIN * dn);
    return q > 0 ? outputPower(q, R) : 0;
  };
  const yMax = steady(20, 4) * 1.1 + 1;
  const Pw = panel(d, { x0: 11.4, y0: 0.8, x1: 19.4, y1: 4.6 }, { min: 0.01, max: 20, log: true }, { min: 0, max: yMax });
  Pw.frame({ xlabel: "Wp (1/ms)", ylabel: "potência de saída (u.a.)", fx: (v) => fmt(v, 2) });
  Pw.plot((W) => steady(W, 4), 0.01, 20, { color: theme.accent, width: 2, n: 300 });
  Pw.plot((W) => steady(W, 3), 0.01, 20, { color: theme.series[1]!, width: 2, dash: [6, 4], n: 300 });
  const lv = levels(p);
  const Wth = thresholdPump(R, lv);
  d.line(Pw.X(Wth), Pw.box.y0, Pw.X(Wth), Pw.box.y1, { color: theme.muted, width: 1, dash: [3, 3] });
  d.text(`W_th = ${fmt(Wth, 3)}`, Pw.X(Wth), Pw.box.y1 - 0.25, { size: 9, color: theme.muted, align: "left", dx: 4 });
  const Pnow = outputPower(s.y[4] ?? 0, R);
  if (Pw.inside(pump(p), Pnow)) d.dot(Pw.X(pump(p)), Pw.Y(Pnow), 6, theme.positive);
  d.text("4 níveis", Pw.box.x0 + 0.15, Pw.box.y1 - 0.3, { color: theme.accent, size: 10, align: "left" });
  d.text("3 níveis", Pw.box.x0 + 0.15, Pw.box.y1 - 0.7, { color: theme.series[1]!, size: 10, align: "left" });
  d.text("tempo do laser em ms", Pt.box.x1, Pt.box.y0, { size: 9, color: theme.muted, align: "right", dy: 22 });
}

export default espectrosLaser;
