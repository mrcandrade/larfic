import { clamp, defineSim, draw, formatBR, num, rk4, texNum, type Draw, type Params, type State } from "@fisilab/core";
import {
  BODIES,
  MATERIALS,
  NX,
  TC_FRAC,
  Ta,
  Thot,
  Tin,
  barA,
  barFluxes,
  barL,
  barSteady,
  barStep,
  body,
  coldG,
  coolingPower,
  materialOf,
  mdot,
  modeOf,
  newtonTau,
  ritmo,
  tempAt,
  waterOut,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: [tempo físico (s), ...temperaturas (°C)]
//   modo 0 (barra): 61 nós da barra, do lado quente ao frio;
//   modo 1 (resfriamento): temperatura do corpo.
const TF = 0;
const at = (s: State, i: number) => s[i] ?? 0;
const nodes = (s: State) => s.slice(1);

/** Cache do perfil estacionário por objeto de parâmetros. */
const steadyCache = new WeakMap<Params, number[]>();
function steady(p: Params): number[] {
  let s = steadyCache.get(p);
  if (!s) {
    s = barSteady(p);
    steadyCache.set(p, s);
  }
  return s;
}

/** Maior distância (K) entre o perfil atual e o estacionário. */
export function steadyGap(s: State, p: Params): number {
  if (modeOf(p) !== 0) return 0;
  const st = steady(p);
  let g = 0;
  for (let i = 0; i <= NX; i++) g = Math.max(g, Math.abs(at(s, i + 1) - st[i]!));
  return g;
}

const tc = (i: number) => (s: State, p: Params) => (modeOf(p) === 0 ? tempAt(nodes(s), p, TC_FRAC[i]! * barL(p)) : 0);
const bar = (s: State, p: Params) => (modeOf(p) === 0 ? nodes(s) : null);

function bodyT(s: State, p: Params): number {
  if (modeOf(p) === 1) return at(s, 1);
  const T = nodes(s);
  let sum = 0;
  for (let i = 0; i <= NX; i++) sum += (i === 0 || i === NX ? 0.5 : 1) * T[i]!;
  return sum / NX;
}

function fmtClock(t: number): string {
  const h = Math.floor(t / 3600), m = Math.floor((t % 3600) / 60), s = Math.floor(t % 60);
  const pad = (v: number) => String(v).padStart(2, "0");
  return h > 0 ? `${h} h ${pad(m)} min ${pad(s)} s` : `${m} min ${pad(s)} s`;
}

export const conducaoCalor = defineSim({
  id: "conducao-calor",
  title: "Condução de calor e resfriamento de Newton",
  course: "Exp II",
  topic: "Calor e temperatura",
  priority: "P1",
  summary:
    "Uma barra metálica entre uma fonte quente e um bloco resfriado a água, com termopares ao longo dela: no regime estacionário o perfil é linear e o calor levado pela água dá a condutividade térmica. No segundo experimento, um corpo esfria no ar segundo a lei de Newton — ou com convecção natural e radiação, que entortam a exponencial.",
  equations: [
    String.raw`\rho c\,\frac{\partial T}{\partial t} = k\,\frac{\partial^2 T}{\partial x^2} - \frac{h_l P}{A}\,(T - T_{\text{amb}})`,
    String.raw`\dot Q = k A\,\frac{T_1 - T_5}{d} = \dot m\,c_{\text{água}}\,(T_s - T_e) \;\Rightarrow\; k = \frac{\dot m\,c_{\text{água}}\,\Delta T_{\text{água}}\,d}{A\,(T_1 - T_5)}`,
    String.raw`C\,\frac{dT}{dt} = -hA\,(T - T_{\text{amb}}) \;\Rightarrow\; T - T_{\text{amb}} = (T_0 - T_{\text{amb}})\,e^{-t/\tau},\quad \tau = \frac{C}{hA}`,
    String.raw`\text{real: } C\,\frac{dT}{dt} = -1{,}32\left(\frac{\Delta T}{L}\right)^{1/4} A\,\Delta T - \varepsilon\sigma A\,(T^4 - T_{\text{amb}}^4)`,
  ],
  liveEquations(s, p) {
    if (modeOf(p) === 0) {
      const T = nodes(s);
      const f = barFluxes(T, p);
      const T1 = tempAt(T, p, TC_FRAC[0]! * barL(p)), T5 = tempAt(T, p, TC_FRAC[4]! * barL(p));
      const d = (TC_FRAC[4]! - TC_FRAC[0]!) * barL(p);
      const kEst = (f.qw * d) / (barA(p) * (T1 - T5));
      return [
        String.raw`\dot Q_{\text{água}} = \dot m c\,\Delta T = ${texNum(mdot(p) * 1000)}\ \text{g/s}\cdot 4186 \cdot ${texNum(waterOut(T, p) - Tin(p))}\ \text{K} = ${texNum(f.qw)}\ \text{W}`,
        String.raw`k \approx \frac{${texNum(f.qw)}\cdot ${texNum(d)}}{${texNum(barA(p))}\cdot ${texNum(T1 - T5)}} = ${texNum(kEst)}\ \text{W/(m·K)}\quad (\text{tabela: } ${materialOf(p).k})`,
      ];
    }
    const b = body(p);
    const T = at(s, 1);
    const q = coolingPower(T, p);
    return [
      String.raw`C = ${texNum(b.C)}\ \text{J/K} \quad A = ${texNum(b.A * 1e4)}\ \text{cm}^2 \quad \tau = C/(hA) = ${texNum(newtonTau(p))}\ \text{s}`,
      String.raw`T = ${texNum(T)}\ ^\circ\text{C} \quad P = ${texNum(q.total)}\ \text{W}\ (\text{radiação } ${texNum(q.rad)}\ \text{W})`,
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
        { value: 0, label: "Barra entre fonte quente e água (condutividade)" },
        { value: 1, label: "Resfriamento de um corpo no ar (Newton)" },
      ],
    },
    {
      key: "ritmo",
      label: "Relógio acelerado (tempo físico por segundo)",
      unit: "×",
      min: 1,
      max: 1000,
      step: 1,
      default: 50,
      live: true,
      options: [
        { value: 1, label: "1× (tempo real)" },
        { value: 10, label: "10×" },
        { value: 50, label: "50×" },
        { value: 100, label: "100×" },
        { value: 200, label: "200×" },
        { value: 1000, label: "1000×" },
      ],
    },
    { key: "Ta", label: "Temperatura ambiente", unit: "°C", min: 10, max: 35, step: 0.5, default: 22 },
    { key: "material", label: "Barra: material", unit: "", min: 0, max: 3, step: 1, default: 0, options: MATERIALS.map((m) => ({ value: m.value, label: `${m.label} (k = ${m.k} W/m·K)` })) },
    { key: "Lb", label: "Barra: comprimento", unit: "m", min: 0.1, max: 0.6, step: 0.01, default: 0.3 },
    { key: "Db", label: "Barra: diâmetro", unit: "mm", min: 10, max: 50, step: 1, default: 25 },
    { key: "Tq", label: "Barra: temperatura da fonte quente", unit: "°C", min: 30, max: 100, step: 1, default: 100 },
    { key: "Te", label: "Barra: água de resfriamento (entrada)", unit: "°C", min: 5, max: 30, step: 0.5, default: 18 },
    { key: "vazao", label: "Barra: vazão da água", unit: "mL/min", min: 10, max: 1000, step: 5, default: 40, live: true, log: true },
    { key: "hl", label: "Barra: perdas laterais (0 = isolada)", unit: "W/(m²·K)", min: 0, max: 25, step: 0.5, default: 0, live: true },
    { key: "corpo", label: "Resfriamento: corpo", unit: "", min: 0, max: 2, step: 1, default: 1, options: BODIES.map((b) => ({ value: b.value, label: b.label })) },
    { key: "Va", label: "Resfriamento: volume de água no béquer", unit: "mL", min: 50, max: 500, step: 10, default: 250 },
    { key: "Dc", label: "Resfriamento: diâmetro da esfera", unit: "mm", min: 20, max: 100, step: 1, default: 50 },
    { key: "T0", label: "Resfriamento: temperatura inicial", unit: "°C", min: 30, max: 95, step: 1, default: 80 },
    {
      key: "modelo",
      label: "Resfriamento: modelo de perdas",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Lei de Newton (h constante, ar forçado)" },
        { value: 1, label: "Convecção natural + radiação (ar parado)" },
      ],
    },
    { key: "h", label: "Resfriamento: coeficiente h (Newton)", unit: "W/(m²·K)", min: 2, max: 50, step: 0.5, default: 10 },
    { key: "eps", label: "Resfriamento: emissividade da superfície", unit: "", min: 0, max: 1, step: 0.01, default: 0.9 },
  ],

  observables: [
    { key: "T1", label: "Termopar T1", unit: "°C", value: tc(0) },
    { key: "T2", label: "Termopar T2", unit: "°C", value: tc(1) },
    { key: "T3", label: "Termopar T3", unit: "°C", value: tc(2) },
    { key: "T4", label: "Termopar T4", unit: "°C", value: tc(3) },
    { key: "T5", label: "Termopar T5", unit: "°C", value: tc(4) },
    { key: "Te", label: "Água: temperatura de entrada", unit: "°C", value: (_s, p) => Tin(p) },
    { key: "Ts", label: "Água: temperatura de saída", unit: "°C", value: (s, p) => { const T = bar(s, p); return T ? waterOut(T, p) : Tin(p); } },
    { key: "dTw", label: "Água: aquecimento T_s − T_e", unit: "K", value: (s, p) => { const T = bar(s, p); return T ? waterOut(T, p) - Tin(p) : 0; } },
    { key: "Qw", label: "Calor levado pela água", unit: "W", value: (s, p) => { const T = bar(s, p); return T ? barFluxes(T, p).qw : 0; } },
    { key: "Qq", label: "Calor entrando pela fonte quente", unit: "W", value: (s, p) => { const T = bar(s, p); return T ? barFluxes(T, p).qin : 0; } },
    { key: "Ql", label: "Perdas laterais", unit: "W", value: (s, p) => { const T = bar(s, p); return T ? barFluxes(T, p).qlat : 0; } },
    { key: "gap", label: "Distância ao regime estacionário", unit: "K", value: (s, p) => steadyGap(s, p) },
    { key: "T", label: "Temperatura do corpo (média da barra)", unit: "°C", value: (s, p) => bodyT(s, p) },
    { key: "P", label: "Potência perdida pelo corpo", unit: "W", value: (s, p) => (modeOf(p) === 1 ? coolingPower(at(s, 1), p).total : 0) },
    {
      key: "heff",
      label: "h efetivo do corpo",
      unit: "W/(m²·K)",
      value: (s, p) => {
        if (modeOf(p) !== 1) return 0;
        const dT = at(s, 1) - Ta(p);
        return Math.abs(dT) < 1e-9 ? 0 : coolingPower(at(s, 1), p).total / (body(p).A * dT);
      },
    },
    { key: "tf", label: "Tempo físico (cronômetro)", unit: "s", value: (s) => at(s, TF) },
  ],
  chart: { x: "tf", y: "T" },

  scenarios: [
    {
      id: "barra",
      label: "Barra de cobre",
      params: { modo: 0, material: 0, Lb: 0.3, Db: 25, Tq: 100, Te: 18, vazao: 40, hl: 0, Ta: 22, ritmo: 50 },
      guide: `### Condutividade térmica do cobre
1. A barra começa à temperatura ambiente. Rode e veja o calor avançar a partir da fonte quente (relógio acelerado: 1 s na tela = 50 s de experimento).
2. Espere o **regime estacionário** (cerca de 15 min de tempo físico): os termopares param de mudar e o perfil fica uma **reta**.
3. Leia $T_1$ e $T_5$ (distância $d = 20$ cm) e o aquecimento da água $T_s - T_e$.
4. Com $\\dot Q = \\dot m c\\,\\Delta T_{\\text{água}}$, calcule $k = \\dot Q\\, d/[A(T_1 - T_5)]$ e compare com 385 W/(m·K).`,
      predict: [
        {
          question: "No regime estacionário, com a barra bem isolada, o perfil de temperatura ao longo dela é:",
          options: ["exponencial", "linear", "constante"],
          answer: 1,
          explanation: "Sem acúmulo de energia e sem perdas, o mesmo fluxo $\\dot Q = -kA\\,dT/dx$ atravessa toda seção: o gradiente é constante e $T(x)$ é uma reta.",
        },
      ],
    },
    {
      id: "aco",
      label: "Aço: lento e íngreme",
      params: { modo: 0, material: 3, Lb: 0.3, Db: 25, Tq: 100, Te: 18, vazao: 40, hl: 0, Ta: 22, ritmo: 200 },
      guide: `### Comparando materiais
1. No aço o regime estacionário demora quase 10 vezes mais (difusividade $\\alpha = k/\\rho c$ menor): use o relógio a 200×.
2. Quase toda a queda de temperatura fica na barra e o fluxo é bem menor que no cobre.
3. Estime o tempo para o estacionário por $t \\sim L^2/\\alpha$ e compare com o observado.`,
    },
    {
      id: "perdas",
      label: "Barra sem isolamento",
      params: { modo: 0, material: 1, Lb: 0.5, Db: 15, Tq: 100, Te: 18, vazao: 40, hl: 15, Ta: 22, ritmo: 100 },
      guide: `### Perdas laterais
1. Sem isolamento, a barra perde calor pela superfície: o perfil estacionário fica **curvo** (combinação de $\\cosh$ e $\\sinh$ de $x\\sqrt{h_l P/kA}$).
2. Compare o calor que entra pela fonte quente com o que chega à água: a diferença são as perdas.
3. Calcule $k$ usando só o calor da água, como na barra isolada. O valor sai certo ou errado? Por quê?`,
    },
    {
      id: "newton",
      label: "Resfriamento de Newton",
      params: { modo: 1, corpo: 1, Dc: 50, T0: 80, Ta: 22, modelo: 0, h: 10, ritmo: 100 },
      guide: `### Lei do resfriamento de Newton
1. A esfera de cobre a 80 °C esfria sob um ventilador ($h$ constante). Anote $T$ a cada 5 min de tempo físico.
2. O gráfico de $\\ln[(T - T_{\\text{amb}})/(T_0 - T_{\\text{amb}})]$ contra $t$ é uma reta de inclinação $-1/\\tau$.
3. Calcule $h = C/(A\\tau)$ com $C = m c$ e $A = \\pi D^2$.`,
      predict: [
        {
          question: "Uma esfera de cobre com o dobro do diâmetro (mesmo h) esfria:",
          options: ["mais rápido", "na mesma rapidez", "mais devagar"],
          answer: 2,
          explanation: "$C \\propto D^3$ e $A \\propto D^2$, então $\\tau = C/(hA) \\propto D$: o dobro do diâmetro dá o dobro da constante de tempo.",
        },
      ],
    },
    {
      id: "real",
      label: "Béquer no ar parado",
      params: { modo: 1, corpo: 0, Va: 250, T0: 90, Ta: 22, modelo: 1, eps: 0.9, ritmo: 200 },
      guide: `### Quando Newton falha
1. Sem ventilador, a convecção natural tem $h \\propto \\Delta T^{1/4}$ e a radiação cresce com $T^4$: o resfriamento é mais rápido no início do que a exponencial prevê.
2. Veja o gráfico de $\\ln\\Delta T$: ele começa mais inclinado e vai ficando menos inclinado (curva, não reta).
3. O observável **h efetivo** cai de cerca de 13 para 9 W/(m²·K) ao longo do experimento. Para $\\Delta T$ pequeno, Newton volta a ser uma boa aproximação.`,
    },
  ],

  exercises: [
    {
      id: "fluxo",
      prompt:
        "Uma barra de cobre (k = 385 W/m·K) de {Db} mm de diâmetro, isolada lateralmente, tem as extremidades a {Tq} °C e {Te} °C, separadas por {Lb} m. Qual é a potência térmica conduzida em regime estacionário?",
      vary: { Db: [10, 40, 0], Tq: [60, 100, 0], Te: [10, 25, 0], Lb: [0.1, 0.5, 2] },
      fixed: { modo: 0, material: 0 },
      answer: { label: "Q", unit: "W", compute: (p) => (385 * Math.PI * (num(p, "Db") / 2000) ** 2 * (num(p, "Tq") - num(p, "Te"))) / num(p, "Lb") },
    },
    {
      id: "newton",
      prompt:
        "Um corpo com constante de tempo τ = {tau} s está a {T0} °C num ambiente a {Ta} °C. Pela lei de Newton, quanto tempo leva para chegar a {T1} °C?",
      vary: { tau: [600, 4000, 0], T0: [70, 95, 0], Ta: [15, 25, 0], T1: [35, 50, 0] },
      fixed: { modo: 1 },
      answer: { label: "t", unit: "s", compute: (p) => num(p, "tau") * Math.log((num(p, "T0") - num(p, "Ta")) / (num(p, "T1") - num(p, "Ta"))) },
      hint: "T − T_amb decai como e^{−t/τ}; isole t tomando o logaritmo.",
    },
  ],

  init(p) {
    if (modeOf(p) === 1) return [0, num(p, "T0", 80)];
    const T = new Array<number>(NX + 1).fill(Ta(p));
    T[0] = Thot(p);
    return [0, ...T];
  },
  step(s, p, _t, dt) {
    const H = ritmo(p) * dt; // tempo físico neste passo
    if (modeOf(p) === 0) {
      const n = Math.max(1, Math.ceil(H / 2));
      let T = nodes(s);
      for (let i = 0; i < n; i++) T = barStep(T, p, H / n);
      return [at(s, TF) + H, ...T];
    }
    const b = body(p);
    const tauMin = b.C / Math.max(1e-9, Math.abs(coolingPower(at(s, 1) + 1, p).total - coolingPower(at(s, 1), p).total));
    const n = clamp(Math.ceil(H / (0.02 * tauMin)), 1, 200);
    let y = [at(s, 1)];
    const f = (u: State) => [-coolingPower(u[0]!, p).total / b.C];
    for (let i = 0; i < n; i++) y = rk4(f, y, p, 0, H / n);
    return [at(s, TF) + H, y[0]!];
  },
  dt: 0.02,
  sampleEvery: 5,

  narrowSplit: () => 0.646,
  viewport: () => ({ xMin: -18, xMax: 122, yMin: -4, yMax: 66 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (modeOf(frame.params) === 0) renderBar(d, frame.state, frame.params);
    else renderCooling(d, frame.state, frame.params, frame.trail);
  },
});

/** Cor da temperatura: azul (frio) → vermelho (quente). */
function tempColor(T: number, lo = 10, hi = 100) {
  const u = clamp((T - lo) / (hi - lo), 0, 1);
  return `rgb(${Math.round(50 + 205 * u)}, ${Math.round(110 + 40 * Math.sin(Math.PI * u) - 40 * u)}, ${Math.round(230 - 200 * u)})`;
}

function clockText(d: Draw, s: State, p: Params, x: number, y: number) {
  const { theme } = d;
  d.text(`tempo físico: ${fmtClock(at(s, TF))}`, x, y, { size: 12, align: "left", weight: "600" });
  d.text(`relógio acelerado ${formatBR(ritmo(p), 4)}× (1 s na tela = ${formatBR(ritmo(p), 4)} s)`, x, y - 3.2, { size: 10, align: "left", color: theme.positive });
}

function renderBar(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const T = nodes(s);
  const L = barL(p), m = materialOf(p);
  const BW = 60; // comprimento desenhado
  const y0 = 40, th = 2.2;
  const X = (x: number) => (x / L) * BW;
  const lo = Math.min(Tin(p), Ta(p)) - 2, hi = Math.max(Thot(p), Ta(p)) + 2;

  // Fonte quente
  d.rect(-15, y0 - 8, 15, 16, { fill: theme.positive, alpha: 0.25, stroke: theme.positive, width: 1.5 });
  d.text("fonte quente", -7.5, y0 + 4, { size: 10, color: theme.positive, weight: "600" });
  d.text(`${formatBR(Thot(p), 3)} °C`, -7.5, y0 - 1, { size: 12, weight: "700", color: theme.positive });
  d.text(Thot(p) >= 99.5 ? "(vapor)" : "(banho)", -7.5, y0 - 5, { size: 9, color: theme.muted });

  // Isolamento
  if (num(p, "hl", 0) <= 0) {
    d.rect(0, y0 - th - 2.2, BW, 2 * th + 4.4, { fill: theme.muted, alpha: 0.15 });
    for (let x = 1; x < BW; x += 2) {
      d.line(x, y0 + th, x + 1.5, y0 + th + 2.2, { color: theme.muted, width: 0.8, alpha: 0.6 });
      d.line(x, y0 - th - 2.2, x + 1.5, y0 - th, { color: theme.muted, width: 0.8, alpha: 0.6 });
    }
    d.text("isolamento térmico", BW / 2, y0 - th - 4, { size: 9, color: theme.muted });
  } else {
    for (let i = 1; i <= 7; i++) {
      const x = (BW * i) / 8;
      const Tx = tempAt(T, p, (L * i) / 8);
      const len = clamp((Tx - Ta(p)) * 0.6, 0, 18);
      if (len > 2) d.arrowPx(x, y0 - th - 0.5, 0, -1, len, { color: theme.positive, width: 1.5, head: 6 });
    }
    d.text(`perdas laterais: ${formatBR(barFluxes(T, p).qlat, 3)} W`, BW / 2, y0 - th - 6, { size: 10, color: theme.positive });
  }
  // Barra colorida pela temperatura
  for (let i = 0; i < NX; i++) {
    const xa = (BW * i) / NX, xb = (BW * (i + 1)) / NX;
    d.rect(xa, y0 - th, xb - xa + 0.05, 2 * th, { fill: tempColor(0.5 * (T[i]! + T[i + 1]!), lo, hi) });
  }
  d.rect(0, y0 - th, BW, 2 * th, { stroke: theme.text, width: 1.5 });
  d.text(`${m.label}: L = ${formatBR(L * 100, 3)} cm, Ø ${formatBR(num(p, "Db", 25), 3)} mm`, BW / 2, y0 + th + 13.5, { size: 10, color: theme.muted });

  // Bloco frio com serpentina
  d.rect(BW, y0 - 7, 9, 14, { fill: theme.accent, alpha: 0.25, stroke: theme.accent, width: 1.5 });
  d.polyline([[BW + 2, y0 - 12], [BW + 2, y0 + 4], [BW + 7, y0 + 4], [BW + 7, y0 - 12]], { color: theme.accent, width: 2.5 });
  d.arrowPx(BW + 2, y0 - 14, 0, 1, 16, { color: theme.accent });
  d.arrowPx(BW + 7, y0 - 12, 0, -1, 16, { color: theme.positive });
  const tOut = waterOut(T, p);
  d.text(`T_e = ${formatBR(Tin(p), 3)} °C`, BW + 1, y0 - 17.5, { size: 10, align: "right", color: theme.accent });
  d.text(`T_s = ${formatBR(tOut, 4)} °C`, BW + 8, y0 - 17.5, { size: 10, align: "left", color: theme.positive });
  d.text(`água: ${formatBR(num(p, "vazao", 40), 3)} mL/min`, BW + 4.5, y0 + 9, { size: 10, color: theme.accent });

  // Termopares e indicador
  d.rect(2, 53, BW - 4, 10, { fill: theme.dark ? "#10151c" : "#20262e", stroke: theme.muted, width: 1.5 });
  TC_FRAC.forEach((fr, i) => {
    const x = fr * BW;
    const Tc = tempAt(T, p, fr * L);
    d.line(x, y0 + th, x, 53, { color: theme.series[i % theme.series.length], width: 1.2 });
    d.dot(x, y0 + th, 3, theme.text);
    d.text(`T${i + 1}`, x, 60.5, { size: 9, color: "#a9b4c2" });
    d.text(`${Tc.toFixed(1).replace(".", ",")}`, x, 56.3, { size: 12, weight: "700", color: "#7cf0a0" });
  });
  d.text("termopares (°C)", BW / 2, 64.5, { size: 9, color: theme.muted });

  // Perfil T(x)
  const gx0 = 0, gx1 = BW, gy0 = 2, gy1 = 24;
  const Y = (v: number) => gy0 + ((v - lo) / (hi - lo)) * (gy1 - gy0);
  d.line(gx0, gy0, gx1, gy0, { color: theme.muted });
  d.line(gx0, gy0, gx0, gy1, { color: theme.muted });
  d.text("x →", gx1, gy0 - 2.5, { size: 10, align: "right", color: theme.muted });
  d.text("T(x)", gx0 + 1, gy1 + 1.5, { size: 10, align: "left", color: theme.muted });
  for (const v of [Tin(p), Thot(p)]) {
    d.line(gx0, Y(v), gx1, Y(v), { color: theme.grid, dash: [3, 3] });
    d.text(`${formatBR(v, 3)}`, gx0 - 1, Y(v), { size: 9, align: "right", color: theme.muted });
  }
  const st = steady(p);
  d.polyline(st.map((v, i) => [(BW * i) / NX, Y(v)] as [number, number]), { color: theme.muted, dash: [5, 4], width: 1.2 });
  d.polyline(T.map((v, i) => [(BW * i) / NX, Y(v)] as [number, number]), { color: theme.accent, width: 2.2 });
  TC_FRAC.forEach((fr, i) => d.dot(fr * BW, Y(tempAt(T, p, fr * L)), 4, theme.series[i % theme.series.length]!));
  d.text("tracejado: perfil estacionário", gx1, gy1 + 1.5, { size: 9, align: "right", color: theme.muted });

  // Painel
  const f = barFluxes(T, p);
  const gap = steadyGap(s, p);
  const px = 84;
  clockText(d, s, p, px, 62);
  const lines: [string, string?][] = [
    [`k (tabela) = ${m.k} W/(m·K)`],
    [`α = k/ρc = ${formatBR(m.k / (m.rho * m.c), 3)} m²/s`, theme.muted],
    [`calor entrando: ${formatBR(f.qin, 3)} W`, theme.positive],
    [`calor para a água: ${formatBR(f.qw, 3)} W`, theme.accent],
    [`aquecimento da água: ${formatBR(tOut - Tin(p), 3)} K`],
    [`condutância barra–água: ${formatBR(coldG(p), 3)} W/K`, theme.muted],
    [`T ambiente: ${formatBR(Ta(p), 3)} °C`, theme.muted],
    [gap < 0.05 ? "regime estacionário atingido" : `aquecendo… (falta ${formatBR(gap, 2)} K)`, gap < 0.05 ? theme.series[2] : theme.muted],
  ];
  lines.forEach(([tx, c], i) => d.text(tx, px, 52 - i * 5, { size: 11, align: "left", color: c ?? theme.text }));
}

function renderCooling(d: Draw, s: State, p: Params, trail: State[]) {
  const { theme } = d;
  const b = body(p);
  const T = at(s, 1), ta = Ta(p), T0 = num(p, "T0", 80);
  const lo = ta - 3, hi = Math.max(T0, ta) + 3;
  const k = Math.round(num(p, "corpo", 1));

  // Suporte de cortiça
  d.rect(2, 4, 22, 3, { fill: "#b9894f", alpha: 0.8 });
  d.support(-2, 4, 28, 4);
  // Corpo
  if (k === 0) {
    const H = Math.min(30, (b.Lc / 0.1) * 30);
    d.rect(5, 7, 16, H, { fill: tempColor(T, lo, hi), alpha: 0.55 });
    d.polyline([[5, 7 + H + 8], [5, 7], [21, 7], [21, 7 + H + 8]], { color: theme.text, width: 2 });
    d.text(`${formatBR(num(p, "Va", 250), 3)} mL`, 13, 10, { size: 10, color: theme.text });
  } else {
    const R = clamp(num(p, "Dc", 50) / 10, 3, 10);
    d.circle(13, 7 + R, R, { fill: k === 1 ? "#c8733a" : "#aab3bd", stroke: theme.text, width: 1.5 });
    d.circle(13, 7 + R, R * 0.7, { fill: tempColor(T, lo, hi), alpha: 0.45 });
  }
  // Termômetro (termopar inserido)
  d.line(13, 18, 13, 46, { color: theme.text, width: 1.5 });
  d.rect(6, 46, 14, 7, { fill: theme.dark ? "#10151c" : "#20262e", stroke: theme.muted, width: 1.2 });
  d.text(`${T.toFixed(1).replace(".", ",")} °C`, 13, 49.5, { size: 13, weight: "700", color: "#7cf0a0" });
  d.text(b.label, 13, 57, { size: 11, weight: "600" });
  const q = coolingPower(T, p);
  if (q.total > 0.01) {
    for (const [dx, dy] of [[-1, 0.6], [1, 0.6], [1, -0.2], [-1, -0.2]] as const) d.arrowPx(13 + dx * 9, 22 + dy * 8, dx, dy, clamp(q.total * 1.5, 8, 30), { color: theme.positive, width: 1.5, head: 6 });
  }
  d.text(`perde ${formatBR(q.total, 3)} W${q.rad > 0 ? ` (${formatBR((100 * q.rad) / q.total, 2)} % radiação)` : ""}`, 13, 0.5, { size: 10, color: theme.positive });

  // Gráficos: T(t) e ln(ΔT/ΔT0)
  const tau = Math.round(num(p, "modelo", 0)) === 0 ? newtonTau(p) : b.C / (Math.max(1e-9, coolingPower(T0, p).total / Math.max(1e-9, T0 - ta)));
  const tMax = Math.max(3 * tau, at(s, TF) * 1.05, 1);
  const gx0 = 44, gx1 = 118;
  const X = (t: number) => gx0 + (t / tMax) * (gx1 - gx0);
  const pts = trail.filter((u) => u.length === 2).map((u) => [at(u, 0), at(u, 1)] as [number, number]);
  pts.push([at(s, TF), T]);
  // T(t)
  const ay0 = 36, ay1 = 62;
  const YT = (v: number) => ay0 + ((v - lo) / (hi - lo)) * (ay1 - ay0);
  d.line(gx0, ay0, gx1, ay0, { color: theme.muted });
  d.line(gx0, ay0, gx0, ay1, { color: theme.muted });
  d.text("T (°C)", gx0 + 1, ay1 + 1.5, { size: 10, align: "left", color: theme.muted });
  for (const v of [ta, T0]) d.text(formatBR(v, 3), gx0 - 1, YT(v), { size: 9, align: "right", color: theme.muted });
  d.line(gx0, YT(ta), gx1, YT(ta), { color: theme.grid, dash: [3, 3] });
  d.plot((x) => YT(ta + (T0 - ta) * Math.exp(-(((x - gx0) / (gx1 - gx0)) * tMax) / tau)), gx0, gx1, { color: theme.muted, dash: [5, 4], width: 1.2 });
  d.polyline(pts.map(([t, v]) => [X(t), YT(v)] as [number, number]), { color: theme.accent, width: 2.2 });
  d.text(`tracejado: Newton com τ = ${formatBR(tau, 3)} s`, gx1, ay1 + 1.5, { size: 9, align: "right", color: theme.muted });
  // ln
  const by0 = 4, by1 = 30;
  const lnMin = -Math.max(3, Math.ceil(tMax / tau));
  const YL = (v: number) => by1 + (v / -lnMin) * (by1 - by0);
  d.line(gx0, by1, gx1, by1, { color: theme.muted });
  d.line(gx0, by0, gx0, by1, { color: theme.muted });
  d.text("ln[(T − T_amb)/(T₀ − T_amb)]", gx0 + 1, by1 + 2, { size: 10, align: "left", color: theme.muted });
  d.text("0", gx0 - 1, by1, { size: 9, align: "right", color: theme.muted });
  d.text(`${lnMin}`, gx0 - 1, by0, { size: 9, align: "right", color: theme.muted });
  d.text(`t (até ${fmtClock(tMax)})`, gx1, by0 - 2.5, { size: 10, align: "right", color: theme.muted });
  d.line(gx0, YL(0), X(Math.min(tMax, -lnMin * tau)), YL(Math.max(lnMin, -tMax / tau)), { color: theme.muted, dash: [5, 4], width: 1.2 });
  const lnPts = pts.filter(([, v]) => v - ta > 1e-3 * (T0 - ta)).map(([t, v]) => [X(t), YL(Math.max(lnMin, Math.log((v - ta) / (T0 - ta))))] as [number, number]);
  d.polyline(lnPts, { color: theme.series[1], width: 2.2 });
  clockText(d, s, p, -16, 64);
}

export default conducaoCalor;
