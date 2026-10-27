import { defineSim, draw, formatBR, num, rk4, rng, texNum, type Draw, type Params, type State } from "@fisilab/core";
import {
  G,
  VX,
  diameterAt,
  dhdt,
  drainTime,
  flowRate,
  jetRange,
  jetSpeed,
  manometerH,
  pressureAt,
  speedAt,
  tankOf,
  venturiDp,
  venturiIdealQ,
  venturiLoss,
  venturiOf,
} from "./physics.ts";

export * from "./physics.ts";

/** Número de partículas traçadoras. */
export const NP = 54;
// Estado: [nível do tanque h, x das partículas...]
const at = (s: State, i: number) => s[i] ?? 0;
const modeOf = (p: Params) => Math.round(num(p, "modo", 0));

/** Posição lateral fixa de cada traçador, como fração do raio local. */
const LANES = (() => {
  const r = rng(11);
  return Array.from({ length: NP }, () => (r() * 2 - 1) * 0.82);
})();

/** Semeia as partículas com fluxo uniforme: intervalos iguais de tempo de trânsito. */
function seedParticles(p: Params): number[] {
  const v = venturiOf(p);
  const n = 400;
  const xs: number[] = [0];
  const ts: number[] = [0];
  for (let i = 1; i <= n; i++) {
    const x = (VX.out1 * i) / n;
    xs.push(x);
    ts.push(ts[i - 1]! + (VX.out1 / n) / speedAt(v, x - VX.out1 / n / 2));
  }
  const Ttot = ts[n]!;
  const r = rng(5);
  return Array.from({ length: NP }, (_, k) => {
    const target = ((k + r() * 0.8) / NP) * Ttot;
    let i = 1;
    while (i < n && ts[i]! < target) i++;
    return xs[i]!;
  });
}

const L_PER_S = 1000;

export const bernoulli = defineSim({
  id: "bernoulli",
  title: "Continuidade e Bernoulli: Venturi e Torricelli",
  course: "FG II",
  topic: "Hidrodinâmica",
  priority: "P1",
  summary:
    "Um medidor Venturi com manômetro diferencial, coeficiente de descarga e perda de carga ajustáveis, com traçadores que aceleram na garganta; e um tanque que se esvazia por um orifício, com h(t) integrado e o alcance do jato.",
  equations: [
    String.raw`A_1 v_1 = A_2 v_2 = Q \qquad p + \tfrac12\rho v^2 + \rho g z = \text{const}`,
    String.raw`Q = C_d\,A_2\sqrt{\frac{2\,\Delta p}{\rho\,(1-\beta^4)}} \qquad \Delta p = (\rho_m - \rho)\,g\,h \qquad \Delta p_{\text{perda}} = K\,\tfrac12\rho v_2^2`,
    String.raw`v = \sqrt{\frac{2gh}{1-(a/A)^2}} \qquad A\frac{dh}{dt} = -C_d\,a\,v \qquad R = v\sqrt{\frac{2 z_o}{g}}`,
  ],
  liveEquations(s, p) {
    if (modeOf(p) === 0) {
      const v = venturiOf(p);
      const v1 = speedAt(v, 0), v2 = speedAt(v, VX.c1);
      return [
        String.raw`v_1 = ${texNum(v1)}\ \text{m/s} \qquad v_2 = ${texNum(v2)}\ \text{m/s} \qquad \Delta p = ${texNum(venturiDp(v) / 1000)}\ \text{kPa} \qquad h = ${texNum(manometerH(v) * 100)}\ \text{cm}`,
        String.raw`Q_{\text{ideal}} = ${texNum(venturiIdealQ(v) * L_PER_S)}\ \text{L/s} \quad Q_{\text{real}} = ${texNum(v.Q * L_PER_S)}\ \text{L/s} \quad \Delta p_{\text{perda}} = ${texNum(venturiLoss(v) / 1000)}\ \text{kPa}`,
      ];
    }
    const k = tankOf(p);
    const h = at(s, 0);
    return [
      String.raw`v = \sqrt{2\cdot${texNum(G)}\cdot${texNum(h)}/(1-${texNum((k.a / k.A) ** 2)})} = ${texNum(jetSpeed(k, h))}\ \text{m/s} \qquad R = ${texNum(jetRange(k, h))}\ \text{m}`,
      String.raw`\frac{dh}{dt} = ${texNum(dhdt(k, h) * 1000)}\ \text{mm/s} \qquad t_{\text{esvaziar}} = \frac{A}{C_d a}\sqrt{\frac{2h_0(1-(a/A)^2)}{g}} = ${texNum(drainTime(k))}\ \text{s}`,
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
        { value: 0, label: "Medidor Venturi" },
        { value: 1, label: "Tanque esvaziando (Torricelli)" },
      ],
    },
    { key: "Q", label: "Venturi: vazão real Q", unit: "L/s", min: 0.5, max: 20, step: 0.1, default: 5, live: true },
    { key: "D1", label: "Venturi: diâmetro do tubo D₁", unit: "cm", min: 4, max: 20, step: 0.5, default: 10 },
    { key: "D2", label: "Venturi: diâmetro da garganta D₂", unit: "cm", min: 1.5, max: 16, step: 0.5, default: 5 },
    {
      key: "rho",
      label: "Venturi: fluido",
      unit: "kg/m³",
      min: 700,
      max: 1300,
      step: 10,
      default: 1000,
      options: [
        { value: 1000, label: "Água (1000 kg/m³)" },
        { value: 850, label: "Óleo leve (850 kg/m³)" },
      ],
    },
    {
      key: "rhoM",
      label: "Venturi: líquido do manômetro",
      unit: "kg/m³",
      min: 1500,
      max: 13600,
      step: 10,
      default: 13600,
      options: [
        { value: 13600, label: "Mercúrio (13 600 kg/m³)" },
        { value: 1590, label: "Tetracloreto de carbono (1590 kg/m³)" },
      ],
    },
    { key: "CdV", label: "Venturi: coeficiente de descarga C_d", unit: "", min: 0.85, max: 1, step: 0.005, default: 0.98, live: true },
    { key: "K", label: "Venturi: coeficiente de perda permanente K", unit: "", min: 0, max: 0.6, step: 0.01, default: 0.15, live: true },
    { key: "Dt", label: "Tanque: diâmetro", unit: "m", min: 0.1, max: 1, step: 0.01, default: 0.3 },
    { key: "d", label: "Tanque: diâmetro do orifício", unit: "cm", min: 0.5, max: 6, step: 0.1, default: 3 },
    { key: "CdO", label: "Tanque: coeficiente de descarga do orifício", unit: "", min: 0.5, max: 1, step: 0.01, default: 0.62 },
    { key: "h0", label: "Tanque: nível inicial acima do orifício", unit: "m", min: 0.1, max: 2, step: 0.05, default: 1 },
    { key: "zo", label: "Tanque: altura do orifício acima do chão", unit: "m", min: 0.1, max: 1.5, step: 0.05, default: 0.5 },
  ],

  observables: [
    { key: "Qv", label: "Vazão", unit: "L/s", value: (s, p) => (modeOf(p) === 0 ? venturiOf(p).Q : flowRate(tankOf(p), at(s, 0))) * L_PER_S },
    { key: "v1", label: "Velocidade no tubo v₁", unit: "m/s", value: (_s, p) => speedAt(venturiOf(p), 0) },
    { key: "v2", label: "Velocidade na garganta v₂", unit: "m/s", value: (_s, p) => speedAt(venturiOf(p), VX.c1) },
    { key: "dp", label: "Δp entrada–garganta", unit: "kPa", value: (_s, p) => venturiDp(venturiOf(p)) / 1000 },
    { key: "hm", label: "Desnível do manômetro", unit: "cm", value: (_s, p) => manometerH(venturiOf(p)) * 100 },
    { key: "Qi", label: "Vazão deduzida com C_d = 1", unit: "L/s", value: (_s, p) => venturiIdealQ(venturiOf(p)) * L_PER_S },
    { key: "perda", label: "Perda de carga permanente", unit: "kPa", value: (_s, p) => venturiLoss(venturiOf(p)) / 1000 },
    { key: "h", label: "Nível do tanque h", unit: "m", value: (s) => at(s, 0) },
    { key: "vj", label: "Velocidade do jato", unit: "m/s", value: (s, p) => jetSpeed(tankOf(p), at(s, 0)) },
    { key: "R", label: "Alcance do jato", unit: "m", value: (s, p) => jetRange(tankOf(p), at(s, 0)) },
  ],
  chart: { x: "t", y: "h" },

  scenarios: [
    {
      id: "venturi",
      label: "Venturi com mercúrio",
      params: { modo: 0, Q: 5, D1: 10, D2: 5, rho: 1000, rhoM: 13600, CdV: 0.98, K: 0.15 },
      guide: `### Medindo vazão pela queda de pressão
1. Observe os traçadores: na garganta eles correm $(D_1/D_2)^2 = 4$ vezes mais rápido (continuidade).
2. A pressão cai onde a velocidade sobe (Bernoulli). O manômetro de mercúrio mostra o desnível $h$.
3. Calcule $Q$ a partir de $h$ supondo o tubo ideal e compare com a vazão real: a razão é $C_d$.
4. Aumente $K$: a pressão na saída não volta ao valor da entrada. Essa é a **perda de carga** que a bomba precisa pagar.`,
      predict: [
        {
          question: "Dobrando a vazão Q, o desnível do manômetro:",
          options: ["dobra", "quadruplica", "não muda"],
          answer: 1,
          explanation: "$\\Delta p \\propto v^2 \\propto Q^2$: o Venturi é um medidor quadrático, por isso perde resolução em vazões pequenas.",
        },
      ],
    },
    {
      id: "sensivel",
      label: "Manômetro mais sensível",
      params: { modo: 0, Q: 2, D1: 10, D2: 6, rho: 1000, rhoM: 1590, CdV: 0.98, K: 0.1 },
      guide: `### Escolhendo o líquido manométrico
Com tetracloreto de carbono, $\\rho_m - \\rho$ é só 590 kg/m³ e o mesmo $\\Delta p$ dá um desnível cerca de 21 vezes maior que com mercúrio. Bom para vazões pequenas; ruim se a vazão subir (o líquido sai do tubo).`,
    },
    {
      id: "torricelli",
      label: "Tanque esvaziando",
      params: { modo: 1, Dt: 0.3, d: 3, CdO: 0.62, h0: 1, zo: 0.5 },
      guide: `### Torricelli
1. A velocidade do jato é a de queda livre da altura $h$: $v = \\sqrt{2gh}$ (o tanque largo quase não muda isso).
2. O nível baixa cada vez mais devagar: no gráfico, $h(t)$ é uma parábola e $\\sqrt h$ cai linearmente.
3. Meça o tempo para esvaziar e compare com $t = \\frac{A}{C_d a}\\sqrt{2h_0/g}$.
4. O alcance $R = 2\\sqrt{h\\,z_o}$ diminui junto com o nível.`,
      predict: [
        {
          question: "O tempo para o nível cair de 1 m para 0,5 m comparado ao tempo de 0,5 m até esvaziar:",
          options: ["é maior", "é igual", "é menor"],
          answer: 2,
          explanation: "Com $\\sqrt h$ decrescendo linearmente, os tempos são proporcionais a $1 - \\sqrt{0{,}5} \\approx 0{,}29$ e $\\sqrt{0{,}5} \\approx 0{,}71$: a segunda metade demora mais que o dobro.",
        },
      ],
    },
    {
      id: "alcance",
      label: "Alcance máximo",
      params: { modo: 1, Dt: 0.5, d: 2, CdO: 0.62, h0: 0.8, zo: 0.8 },
      guide: `### Onde furar a lata?
Para uma coluna total $H = h + z_o$ fixa, o alcance $2\\sqrt{h\\,z_o}$ é máximo com o furo no meio ($h = z_o$). Varie $z_o$ e $h_0$ mantendo a soma e confira.`,
    },
  ],

  exercises: [
    {
      id: "venturi",
      prompt:
        "Um Venturi ideal (C_d = 1) tem tubo de {D1} cm e garganta de {D2} cm e transporta água. O manômetro de mercúrio (13 600 kg/m³) indica desnível de {hcm} cm. Qual é a vazão, em L/s? (g = 9,81 m/s²)",
      vary: { D1: [8, 16, 0], D2: [3, 6, 1], hcm: [1, 15, 1] },
      fixed: { modo: 0, CdV: 1, rho: 1000, rhoM: 13600 },
      answer: {
        label: "Q",
        unit: "L/s",
        compute: (p) => {
          const D1 = num(p, "D1") / 100, D2 = num(p, "D2") / 100;
          const dp = 12600 * G * (num(p, "hcm") / 100);
          const A2 = (Math.PI * D2 * D2) / 4;
          return 1000 * A2 * Math.sqrt((2 * dp) / (1000 * (1 - (D2 / D1) ** 4)));
        },
      },
      hint: "Δp = (ρ_Hg − ρ_água) g h; depois combine continuidade e Bernoulli entre o tubo e a garganta.",
    },
    {
      id: "torricelli",
      prompt:
        "Um tanque aberto tem água {h0} m acima de um pequeno orifício lateral situado a {zo} m do chão. A que distância horizontal do tanque o jato atinge o chão?",
      vary: { h0: [0.2, 2, 2], zo: [0.2, 1.5, 2] },
      fixed: { modo: 1 },
      answer: { label: "R", unit: "m", compute: (p) => 2 * Math.sqrt(num(p, "h0") * num(p, "zo")) },
      hint: "v = √(2gh) na horizontal; tempo de queda √(2z_o/g).",
    },
  ],

  init: (p) => [num(p, "h0", 1), ...seedParticles(p)],
  step(s, p, t, dt) {
    const out = s.slice();
    if (modeOf(p) === 1) {
      const k = tankOf(p);
      out[0] = Math.max(0, rk4((y) => [dhdt(k, at(y, 0))], [at(s, 0)], p, t, dt)[0]!);
      return out;
    }
    const v = venturiOf(p);
    for (let i = 1; i <= NP; i++) {
      const x = at(s, i);
      const xm = x + 0.5 * dt * speedAt(v, x);
      let xn = x + dt * speedAt(v, xm);
      if (xn > VX.out1) xn -= VX.out1;
      out[i] = xn;
    }
    return out;
  },
  dt: 2e-3,
  sampleEvery: 10,
  stopWhen: (s, p) => (modeOf(p) === 1 ? at(s, 0) - 1e-4 : 1),

  viewport(p) {
    if (modeOf(p) === 0) return { xMin: -0.15, xMax: 1.45, yMin: -0.72, yMax: 0.66 };
    const k = tankOf(p);
    const R = jetRange(k, k.h0);
    const top = k.zo + 1.25 * k.h0 + 0.15;
    const right = Math.max(k.Dt + R + 0.3, k.Dt + 1.3);
    return { xMin: -0.3, xMax: right, yMin: -0.12, yMax: top };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (modeOf(frame.params) === 0) renderVenturi(d, frame.state, frame.params);
    else renderTank(d, frame.state, frame.params, frame.t);
  },
});

function renderVenturi(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const v = venturiOf(p);
  const xs = Array.from({ length: 131 }, (_, i) => (VX.out1 * i) / 130);
  const top: [number, number][] = xs.map((x) => [x, diameterAt(v, x) / 2]);
  const bot: [number, number][] = xs.map((x) => [x, -diameterAt(v, x) / 2]);
  d.polyline([...top, ...bot.slice().reverse()], { close: true, fill: theme.series[0], alpha: 0.18, color: "none" });
  d.polyline(top, { color: theme.text, width: 2.5 });
  d.polyline(bot, { color: theme.text, width: 2.5 });
  d.text("escoamento →", 0.02, v.D1 / 2 + 0.035, { align: "left", size: 11, color: theme.muted });

  // Traçadores (cor pela velocidade)
  const v1 = speedAt(v, 0), v2 = speedAt(v, VX.c1);
  for (let i = 1; i <= NP; i++) {
    const x = at(s, i);
    const r = diameterAt(v, x) / 2;
    const u = (speedAt(v, x) - v1) / Math.max(1e-9, v2 - v1);
    d.dot(x, (LANES[i - 1] ?? 0) * r, 3, u > 0.5 ? theme.positive : theme.accent, 0.9);
  }
  // Setas de velocidade na entrada e na garganta
  const len = (vv: number) => 15 + 60 * (vv / v2);
  d.arrowPx(0.08, 0, 1, 0, len(v1), { color: theme.series[2] });
  d.text(`v₁ = ${formatBR(v1, 3)} m/s`, 0.15, -v.D1 / 2 - 0.03, { size: 11, color: theme.series[2] });
  d.arrowPx(0.5, 0, 1, 0, len(v2), { color: theme.series[2] });
  d.text(`v₂ = ${formatBR(v2, 3)} m/s`, 0.55, -v.D1 / 2 - 0.03, { size: 11, color: theme.series[2] });

  // Gráfico p(x) − p₁ acima do tubo
  const gy0 = 0.2, gy1 = 0.58;
  const dpMax = Math.max(venturiDp(v), 1e-9);
  const Yp = (pp: number) => gy1 - 0.03 - (-pp / dpMax) * (gy1 - gy0 - 0.06);
  d.line(0, gy0, 0, gy1, { color: theme.muted });
  d.line(0, Yp(0), VX.out1, Yp(0), { color: theme.muted, dash: [3, 3] });
  d.text("p − p₁", 0.01, gy1 + 0.03, { align: "left", size: 11, color: theme.muted });
  d.plot((x) => Yp(pressureAt(v, x, true)), 0, VX.out1, { color: theme.muted, dash: [5, 4], n: 130 });
  d.plot((x) => Yp(pressureAt(v, x)), 0, VX.out1, { color: theme.accent, width: 2.5, n: 130 });
  d.text(`−${formatBR(venturiDp(v) / 1000, 3)} kPa`, VX.c1 + 0.05, Yp(-venturiDp(v)), { align: "left", size: 10, color: theme.accent });
  const loss = venturiLoss(v);
  if (loss > 1e-6) {
    d.line(VX.d1, Yp(0), VX.d1, Yp(-loss), { color: theme.positive, width: 2 });
    d.text(`perda ${formatBR(loss / 1000, 3)} kPa`, VX.d1 + 0.02, (Yp(0) + Yp(-loss)) / 2, { align: "left", size: 10, color: theme.positive });
  }
  d.text("real (azul) × Bernoulli ideal (tracejado)", VX.out1, gy1 + 0.03, { align: "right", size: 10, color: theme.muted });

  // Manômetro diferencial ligado à entrada (x = 0,15) e à garganta (x = 0,55)
  const xa = 0.15, xb = 0.55, w = 0.03;
  const ybase = -0.62, rest = -0.38;
  const hm = manometerH(v);
  const hDraw = Math.min(hm, 2 * (rest - ybase) - 0.02);
  const yA = rest - hDraw / 2, yB = rest + hDraw / 2;
  const mcol = v.rhoM > 5000 ? theme.muted : theme.series[4]!;
  // Fluido do tubo nas pernas acima do líquido manométrico
  d.rect(xa - w / 2, yA, w, -v.D1 / 2 - yA, { fill: theme.series[0], alpha: 0.25 });
  d.rect(xb - w / 2, yB, w, -v.D2 / 2 - yB, { fill: theme.series[0], alpha: 0.25 });
  d.rect(xa - w / 2, ybase, w, yA - ybase, { fill: mcol, alpha: 0.8 });
  d.rect(xb - w / 2, ybase, w, yB - ybase, { fill: mcol, alpha: 0.8 });
  d.rect(xa + w / 2, ybase, xb - xa - w, w, { fill: mcol, alpha: 0.8 });
  const tw = { color: theme.text, width: 1.5 };
  d.polyline([[xa - w / 2, -v.D1 / 2], [xa - w / 2, ybase], [xb + w / 2, ybase], [xb + w / 2, -v.D2 / 2]], tw);
  d.polyline([[xa + w / 2, -v.D1 / 2], [xa + w / 2, ybase + w], [xb - w / 2, ybase + w], [xb - w / 2, -v.D2 / 2]], tw);
  d.line(xa, yA, xb + 0.08, yA, { color: theme.muted, dash: [3, 3] });
  d.line(xb, yB, xb + 0.08, yB, { color: theme.muted, dash: [3, 3] });
  if (hDraw > 0.005) d.arrow(xb + 0.06, yA, 0, hDraw, { color: theme.positive, width: 1.5, head: 7 });
  d.text(`h = ${formatBR(hm * 100, 3)} cm${hm > hDraw + 1e-9 ? " (fora de escala)" : ""}`, xb + 0.09, rest, { align: "left", size: 12, weight: "600", color: theme.positive });

  // Painel
  const qi = venturiIdealQ(v);
  const lines = [
    `Q real = ${formatBR(v.Q * 1000, 3)} L/s`,
    `Q deduzida (C_d = 1) = ${formatBR(qi * 1000, 3)} L/s`,
    `erro sem C_d: ${formatBR(((qi - v.Q) / v.Q) * 100, 2)} %`,
    `Δp = ${formatBR(venturiDp(v) / 1000, 3)} kPa`,
  ];
  lines.forEach((t, i) => d.text(t, 0.82, -0.24 - i * 0.075, { align: "left", size: 11, color: i === 2 ? theme.positive : theme.text }));
}

function renderTank(d: Draw, s: State, p: Params, t: number) {
  const { theme } = d;
  const k = tankOf(p);
  const h = at(s, 0);
  const zb = k.zo - 0.03; // fundo do tanque um pouco abaixo do orifício
  const H = k.h0 * 1.2;
  // Chão e suporte
  d.line(-0.3, 0, Math.max(k.Dt + jetRange(k, k.h0) + 0.3, k.Dt + 1.3), 0, { color: theme.muted, width: 2 });
  d.rect(0.1 * k.Dt, 0, 0.8 * k.Dt, zb, { fill: theme.ground });
  // Água e tanque
  d.rect(0, zb, k.Dt, h + 0.03, { fill: theme.series[0], alpha: 0.35 });
  d.polyline([[0, zb + H], [0, zb], [k.Dt, zb], [k.Dt, zb + H]], { color: theme.text, width: 2.5 });
  d.line(0, zb + 0.03 + h, k.Dt, zb + 0.03 + h, { color: theme.series[0], width: 2 });
  // Cota h
  d.line(-0.06, k.zo, -0.02, k.zo, { color: theme.muted });
  if (h > 0.01) d.arrow(-0.04, k.zo, 0, h, { color: theme.accent, width: 1.5, head: 7 });
  d.text(`h = ${formatBR(h, 3)} m`, -0.07, k.zo + h / 2, { align: "right", size: 12, weight: "600", color: theme.accent });
  d.text(`z_o = ${formatBR(k.zo, 3)} m`, k.Dt + 0.04, k.zo / 2, { align: "left", size: 11, color: theme.muted });
  // Jato: parábola x = v τ, y = z_o − g τ²/2
  const vj = jetSpeed(k, h);
  const R = jetRange(k, h);
  if (h > 1e-4) {
    const tf = Math.sqrt((2 * k.zo) / G);
    const pts: [number, number][] = [];
    for (let i = 0; i <= 40; i++) {
      const tau = (tf * i) / 40;
      pts.push([k.Dt + vj * tau, k.zo - 0.5 * G * tau * tau]);
    }
    d.polyline(pts, { color: theme.series[0], width: Math.max(2, Math.sqrt(k.a) * 400) });
    // Gotas andando no jato
    for (let j = 0; j < 8; j++) {
      const tau = (((t * 1.5) / tf + j / 8) % 1) * tf;
      d.dot(k.Dt + vj * tau, k.zo - 0.5 * G * tau * tau, 2.5, theme.accent);
    }
    d.arrowPx(k.Dt, k.zo + 0.05, 1, 0, 20 + 8 * vj, { color: theme.series[2] });
    d.text(`v = ${formatBR(vj, 3)} m/s`, k.Dt + 0.03, k.zo + 0.1, { align: "left", size: 11, color: theme.series[2] });
    d.line(k.Dt + R, 0, k.Dt + R, 0.06, { color: theme.positive, width: 2 });
    d.text(`R = ${formatBR(R, 3)} m`, k.Dt + R, 0.12, { size: 12, weight: "600", color: theme.positive });
  }
  // Mini gráfico h(t): integrado (pontos) × analítico
  const T = drainTime(k);
  const gx0 = k.Dt + 0.25, gx1 = gx0 + Math.min(1.1, Math.max(0.5, R + 0.2)), gy0 = k.zo + 0.35 * k.h0, gy1 = k.zo + 1.15 * k.h0;
  d.line(gx0, gy0, gx1, gy0, { color: theme.muted });
  d.line(gx0, gy0, gx0, gy1, { color: theme.muted });
  d.text("h(t)", gx0 + 0.02, gy1, { align: "left", size: 11, color: theme.muted });
  d.text(`t esvaziar = ${formatBR(T, 3)} s`, gx1, gy0 - 0.05, { align: "right", size: 10, color: theme.muted });
  const X = (tt: number) => gx0 + (tt / T) * (gx1 - gx0);
  const Y = (hh: number) => gy0 + (hh / k.h0) * (gy1 - gy0);
  const c = (k.Cd * k.a) / k.A * Math.sqrt(G / 2 / (1 - (k.a / k.A) ** 2));
  d.plot((x) => { const tt = ((x - gx0) / (gx1 - gx0)) * T; const r = Math.sqrt(k.h0) - c * tt; return Y(r > 0 ? r * r : 0); }, gx0, gx1, { color: theme.accent, n: 60 });
  d.dot(X(Math.min(t, T)), Y(h), 4, theme.positive);
}

export default bernoulli;
