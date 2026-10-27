import { defineSim, draw, formatBR, num, rng, texNum, type Params } from "@fisilab/core";
import { panel } from "./panel.ts";
import {
  BODY_A,
  BODY_C,
  K0,
  MAT_OPTIONS,
  SIGMA,
  WIEN,
  TambOf,
  TinOf,
  ToutOf,
  bodyEquilibrium,
  bodyPowers,
  bodyRate,
  greenhouse,
  hRad,
  layersOf,
  meshOf,
  planck,
  resistances,
  steadyFlux,
  steadyInterfaces,
  surfaceTemps,
  wallFluxes,
  wallStep,
} from "./physics.ts";

export interface Heat {
  /** Tempo físico (s). */
  tp: number;
  /** Temperatura do corpo (°C). */
  T: number;
  /** Temperaturas das células da parede (°C). */
  wall: number[];
  /** Partículas traçadoras do ar em convecção (coordenadas locais 0..1). */
  parts: [number, number][];
}

const ritmo = (p: Params) => num(p, "ritmo", 300);
const radView = (p: Params) => Math.round(num(p, "rad", 0));

// Caixa da convecção (coordenadas do mundo)
const CV = { x0: 5.5, x1: 9.5, y0: 3.55, y1: 7.7 };
const BODY = { x0: 6.85, x1: 8.15, y0: 2.95, y1: 3.55 };

function initParts(): [number, number][] {
  const r = rng(7);
  return Array.from({ length: 70 }, (): [number, number] => [r(), 0.03 + 0.94 * r()]);
}

/** Velocidade das células de convecção, ψ = sen(2πu) sen(πv), em unidades da caixa por segundo real. */
function cellVel(u: number, v: number, U: number): [number, number] {
  // v_u = ∂ψ/∂v, v_v = −∂ψ/∂u (divergência nula)
  return [U * 0.3 * Math.PI * Math.sin(2 * Math.PI * u) * Math.cos(Math.PI * v), -U * 0.3 * 2 * Math.PI * Math.cos(2 * Math.PI * u) * Math.sin(Math.PI * v)];
}

const fmtTime = (s: number) => {
  if (s < 120) return `${formatBR(s, 3)} s`;
  if (s < 7200) return `${formatBR(s / 60, 3)} min`;
  return `${formatBR(s / 3600, 3)} h`;
};

/** Cor de temperatura: azul (frio) → vermelho (quente), entre lo e hi. */
function tempColor(T: number, lo: number, hi: number): string {
  const u = Math.max(0, Math.min(1, (T - lo) / Math.max(1e-9, hi - lo)));
  return `hsl(${Math.round(230 - 230 * u)}, 75%, ${Math.round(48 + 4 * Math.sin(Math.PI * u))}%)`;
}

export const transferenciaCalor = defineSim<Heat>({
  id: "transferencia-calor",
  title: "Condução, convecção e radiação",
  course: "FG II",
  topic: "Calor",
  priority: "P2",
  summary:
    "Os três mecanismos lado a lado: condução por uma parede composta resolvida por diferenças finitas (resistências térmicas em série), um corpo que perde calor por convecção e radiação até o equilíbrio com o aquecedor, e o corpo negro e o efeito estufa de um planeta.",
  equations: [
    String.raw`\rho c\,\frac{\partial T}{\partial t} = \frac{\partial}{\partial x}\!\left(k\,\frac{\partial T}{\partial x}\right) \qquad q = \frac{T_i - T_e}{R_{\text{tot}}},\quad R_{\text{tot}} = \frac{1}{h_i} + \sum_j \frac{e_j}{k_j} + \frac{1}{h_e}`,
    String.raw`C\,\frac{dT}{dt} = P - hA\,(T - T_a) - \varepsilon\sigma A\,(T^4 - T_a^4)`,
    String.raw`\text{sem radiação: } T - T_a = (T_0 - T_a)\,e^{-t/\tau},\ \tau = \frac{C}{hA} \qquad \lambda_{\max} T = 2{,}898\times10^{-3}\ \text{m·K}`,
    String.raw`\text{estufa (1 camada): } T_e = \left[\frac{S(1-a)}{4\sigma}\right]^{1/4},\quad T_s = T_e\left(\frac{2}{2-\varepsilon_{\text{atm}}}\right)^{1/4}`,
  ],
  liveEquations(s, p) {
    const R = resistances(p);
    const { qIn } = wallFluxes(s.wall, p);
    const w = bodyPowers(s.T, p);
    const gh = greenhouse(p);
    return [
      String.raw`R_{\text{tot}} = ${texNum(R.total)}\ \text{m}^2\text{K/W} \quad q_{\text{reg}} = ${texNum(steadyFlux(p))}\ \text{W/m}^2 \quad q_{\text{entra}}(t) = ${texNum(qIn)}\ \text{W/m}^2`,
      String.raw`P = ${texNum(w.heater)} = \underbrace{${texNum(w.conv)}}_{\text{conv.}} + \underbrace{${texNum(w.rad)}}_{\text{rad.}} + C\dot T\ \text{(W)} \qquad T_{\text{eq}} = ${texNum(bodyEquilibrium(p))}\ ^\circ\text{C}`,
      String.raw`T_e = ${texNum(gh.Te, 4)}\ \text{K} \qquad T_s = ${texNum(gh.Ts, 4)}\ \text{K} = ${texNum(gh.Ts - K0)}\ ^\circ\text{C}`,
    ];
  },

  params: [
    { key: "Tq", label: "Parede: temperatura interna", unit: "°C", min: -10, max: 50, step: 1, default: 22, live: true },
    { key: "Tf", label: "Parede: temperatura externa", unit: "°C", min: -20, max: 45, step: 1, default: 2, live: true },
    { key: "m1", label: "Camada 1 (interna)", unit: "", min: 0, max: 7, step: 1, default: 5, options: MAT_OPTIONS },
    { key: "e1", label: "Espessura da camada 1", unit: "cm", min: 0, max: 30, step: 0.5, default: 1.5 },
    { key: "m2", label: "Camada 2", unit: "", min: 0, max: 7, step: 1, default: 0, options: MAT_OPTIONS },
    { key: "e2", label: "Espessura da camada 2", unit: "cm", min: 0, max: 30, step: 0.5, default: 10 },
    { key: "m3", label: "Camada 3 (externa)", unit: "", min: 0, max: 7, step: 1, default: 2, options: MAT_OPTIONS },
    { key: "e3", label: "Espessura da camada 3", unit: "cm", min: 0, max: 30, step: 0.5, default: 0 },
    { key: "hi", label: "Película interna h_i", unit: "W/(m²·K)", min: 2, max: 50, step: 1, default: 8, live: true },
    { key: "he", label: "Película externa h_e (vento)", unit: "W/(m²·K)", min: 2, max: 100, step: 1, default: 25, live: true },
    { key: "T0", label: "Corpo: temperatura inicial", unit: "°C", min: 0, max: 200, step: 1, default: 90 },
    { key: "Ta", label: "Corpo: temperatura do ambiente", unit: "°C", min: -20, max: 40, step: 1, default: 20, live: true },
    { key: "h", label: "Coeficiente de convecção h", unit: "W/(m²·K)", min: 1, max: 200, step: 1, default: 10, live: true, log: true },
    { key: "eps", label: "Emissividade ε do corpo", unit: "", min: 0, max: 1, step: 0.01, default: 0.9, live: true },
    { key: "P", label: "Potência do aquecedor", unit: "W", min: 0, max: 200, step: 1, default: 0, live: true },
    {
      key: "rad",
      label: "Painel de radiação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Espectro de corpo negro do corpo" },
        { value: 1, label: "Efeito estufa (planeta)" },
      ],
    },
    { key: "S", label: "Estufa: constante solar S", unit: "W/m²", min: 500, max: 3000, step: 1, default: 1361, live: true },
    { key: "alb", label: "Estufa: albedo a", unit: "", min: 0, max: 0.9, step: 0.01, default: 0.3, live: true },
    { key: "epsA", label: "Estufa: absortividade da atmosfera no IV", unit: "", min: 0, max: 1, step: 0.01, default: 0.78, live: true },
    {
      key: "ritmo",
      label: "Relógio acelerado (tempo físico por segundo)",
      unit: "×",
      min: 1,
      max: 5000,
      step: 1,
      default: 300,
      live: true,
      log: true,
    },
  ],

  observables: [
    { key: "tp", label: "Tempo físico", unit: "s", value: (s) => s.tp },
    { key: "T", label: "Temperatura do corpo", unit: "°C", value: (s) => s.T },
    { key: "Pconv", label: "Potência perdida por convecção", unit: "W", value: (s, p) => bodyPowers(s.T, p).conv },
    { key: "Prad", label: "Potência perdida por radiação", unit: "W", value: (s, p) => bodyPowers(s.T, p).rad },
    { key: "Teq", label: "Temperatura de equilíbrio do corpo", unit: "°C", value: (_s, p) => bodyEquilibrium(p) },
    { key: "hr", label: "Coeficiente de radiação 4εσT³", unit: "W/(m²·K)", value: (s, p) => hRad(s.T, p) },
    { key: "qin", label: "Fluxo entrando na parede", unit: "W/m²", value: (s, p) => wallFluxes(s.wall, p).qIn },
    { key: "qout", label: "Fluxo saindo da parede", unit: "W/m²", value: (s, p) => wallFluxes(s.wall, p).qOut },
    { key: "qreg", label: "Fluxo de regime ΔT/R", unit: "W/m²", value: (_s, p) => steadyFlux(p) },
    { key: "Rtot", label: "Resistência térmica total", unit: "m²·K/W", value: (_s, p) => resistances(p).total },
    { key: "Tsi", label: "Temperatura da face interna", unit: "°C", value: (s, p) => surfaceTemps(s.wall, p).si },
    { key: "Ts", label: "Temperatura da superfície do planeta", unit: "K", value: (_s, p) => greenhouse(p).Ts },
  ],
  chart: { x: "tp", y: "T" },

  scenarios: [
    {
      id: "parede",
      label: "Parede de tijolo com e sem isolante",
      params: { m1: 5, e1: 1.5, m2: 0, e2: 10, m3: 2, e3: 0, Tq: 22, Tf: 2, hi: 8, he: 25, ritmo: 3000 },
      guide: `### Resistências térmicas em série
1. A parede é gesso (1,5 cm) + tijolo (10 cm). Rode: o perfil de temperatura evolui até ficar **reto em cada camada**, com inclinação $\\propto 1/k$.
2. Plote **Fluxo entrando** e **Fluxo saindo**: no começo são diferentes (a parede armazena calor); no regime os dois valem $q = \\Delta T/R_{\\text{tot}}$.
3. Coloque **3 cm de isopor** na camada 3 e reinicie. A resistência total salta e o fluxo cai a uma fração.
4. Repare nas **películas de ar**: $1/h_i$ é parte importante da resistência de uma parede fina.`,
      predict: [
        {
          question: "Acrescentar 3 cm de isopor (k = 0,035) a 10 cm de tijolo (k = 0,72) reduz o fluxo de calor em cerca de:",
          options: ["5%", "30%", "70%"],
          answer: 2,
          explanation:
            "Tijolo: $0{,}1/0{,}72 = 0{,}14$; isopor: $0{,}03/0{,}035 = 0{,}86\\ \\text{m}^2\\text{K/W}$. Com películas e gesso, $R$ passa de cerca de 0,37 para 1,23: o fluxo cai uns 70%.",
        },
      ],
    },
    {
      id: "resfriamento",
      label: "Café esfriando (convecção + radiação)",
      params: { T0: 90, Ta: 20, h: 10, eps: 0.9, P: 0, ritmo: 300, rad: 0 },
      guide: `### Lei do resfriamento
1. O recipiente começa a 90 °C. Veja as **células de convecção**: o ar sobe sobre o corpo quente e desce pelos lados.
2. Compare **Potência por convecção** e **por radiação**: com $h = 10$ e $\\varepsilon = 0{,}9$ elas são da mesma ordem! ($h_r = 4\\varepsilon\\sigma T^3 \\approx 6\\ \\text{W/m}^2\\text{K}$).
3. Zere $\\varepsilon$ (superfície polida) e reinicie: o resfriamento fica exponencial puro, $\\tau = C/hA$.
4. Suba $h$ (ventilador): só a parte convectiva cresce.`,
      predict: [
        {
          question: "Uma xícara a 90 °C num ambiente a 20 °C, sem vento. A perda por radiação, comparada à convecção natural, é:",
          options: ["desprezível", "da mesma ordem", "muito maior"],
          answer: 1,
          explanation: "Perto da temperatura ambiente $h_r = 4\\varepsilon\\sigma T^3 \\approx 6\\ \\text{W/m}^2\\text{K}$, comparável ao $h$ de 5–10 da convecção natural.",
        },
      ],
    },
    {
      id: "equilibrio",
      label: "Aquecedor: balanço de energia",
      params: { T0: 20, Ta: 20, h: 10, eps: 0.9, P: 40, ritmo: 500, rad: 0 },
      guide: `### Temperatura de equilíbrio
1. O aquecedor fornece $P = 40$ W. O corpo esquenta até que **as perdas igualem a potência**: $P = hA\\,\\Delta T + \\varepsilon\\sigma A\\,(T^4 - T_a^4)$.
2. Acompanhe as barras do balanço: no fim, convecção + radiação = aquecedor.
3. Veja o pico do espectro de Planck: mesmo a 100 °C ele está no infravermelho ($\\lambda_{\\max} \\approx 8\\ \\mu\\text{m}$).`,
    },
    {
      id: "estufa",
      label: "Efeito estufa de um planeta",
      params: { rad: 1, S: 1361, alb: 0.3, epsA: 0.78 },
      guide: `### Modelo de uma camada
1. Sem atmosfera ($\\varepsilon_{\\text{atm}} = 0$), a Terra estaria a $T_e \\approx 255$ K ($-18$ °C).
2. A atmosfera é transparente ao visível e absorve uma fração $\\varepsilon_{\\text{atm}}$ do infravermelho; ela reemite metade para baixo.
3. Com $\\varepsilon_{\\text{atm}} = 0{,}78$ a superfície chega a $\\approx 288$ K (15 °C).
4. Aumente o **albedo** (gelo, nuvens) e veja o planeta esfriar; aumente $\\varepsilon_{\\text{atm}}$ (mais CO₂) e veja esquentar.`,
      predict: [
        {
          question: "Se a atmosfera absorvesse todo o infravermelho (ε = 1), a temperatura da superfície seria:",
          options: ["igual à de emissão Te", "2^(1/4)·Te ≈ 1,19 Te", "2·Te"],
          answer: 1,
          explanation: "Com $\\varepsilon = 1$: $\\sigma T_s^4 = 2\\sigma T_e^4$, logo $T_s = 2^{1/4}T_e \\approx 303$ K.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "parede-composta",
      prompt:
        "Uma parede tem {e1} cm de tijolo (k = 0,72 W/m·K) e {e2} cm de isopor (k = 0,035 W/m·K). As faces estão a {Tq} °C e {Tf} °C. Desprezando as películas de ar, qual é o fluxo de calor por metro quadrado?",
      vary: { e1: [5, 25, 0], e2: [1, 6, 1], Tq: [18, 26, 0], Tf: [-5, 10, 0] },
      answer: {
        label: "q",
        unit: "W/m²",
        compute: (p) => (num(p, "Tq") - num(p, "Tf")) / (num(p, "e1") / 100 / 0.72 + num(p, "e2") / 100 / 0.035),
      },
      hint: "Resistências em série: R = e₁/k₁ + e₂/k₂ (com e em metros).",
    },
    {
      id: "estufa-ts",
      prompt:
        "Um planeta recebe S = {S} W/m², tem albedo {alb} e uma atmosfera que absorve uma fração {epsA} do infravermelho (modelo de uma camada). Qual é a temperatura da superfície?",
      vary: { S: [600, 2600, 0], alb: [0.1, 0.6, 2], epsA: [0.2, 1, 2] },
      answer: {
        label: "T_s",
        unit: "K",
        compute: (p) => ((num(p, "S") * (1 - num(p, "alb"))) / (4 * SIGMA)) ** 0.25 * (2 / (2 - num(p, "epsA"))) ** 0.25,
      },
      hint: "T_e⁴ = S(1 − a)/(4σ) e T_s⁴ = 2T_e⁴/(2 − ε).",
    },
  ],

  init(p) {
    const n = meshOf(p).x.length;
    // Parede começa em equilíbrio com o lado externo (a casa acaba de ligar o aquecimento)
    return { tp: 0, T: num(p, "T0", 90), wall: new Array<number>(n).fill(ToutOf(p)), parts: initParts() };
  },

  step(s, p, _t, dt) {
    const H = ritmo(p) * dt;
    // Corpo: RK4 com subpassos curtos diante da constante de tempo
    const tau = BODY_C / ((num(p, "h", 10) + hRad(Math.max(s.T, TambOf(p)), p) + 1e-9) * BODY_A);
    const nsub = Math.max(1, Math.ceil(H / (0.1 * tau)));
    const hs = H / nsub;
    let T = s.T;
    for (let i = 0; i < nsub; i++) {
      const k1 = bodyRate(T, p), k2 = bodyRate(T + 0.5 * hs * k1, p), k3 = bodyRate(T + 0.5 * hs * k2, p), k4 = bodyRate(T + hs * k3, p);
      T += (hs / 6) * (k1 + 2 * k2 + 2 * k3 + k4);
    }
    const wall = wallStep(s.wall.length === meshOf(p).x.length ? s.wall : new Array<number>(meshOf(p).x.length).fill(ToutOf(p)), p, H);
    // Ar em convecção (animação em tempo real; velocidade cresce com √ΔT)
    const U = 0.06 * Math.sqrt(Math.max(0, T - TambOf(p))) * Math.sqrt(num(p, "h", 10) / 10);
    const parts = s.parts.map(([u, v]): [number, number] => {
      // RK4: preserva as linhas de corrente fechadas das células
      const [ax, ay] = cellVel(u, v, U);
      const [bx, by] = cellVel(u + 0.5 * dt * ax, v + 0.5 * dt * ay, U);
      const [cx, cy] = cellVel(u + 0.5 * dt * bx, v + 0.5 * dt * by, U);
      const [ex, ey] = cellVel(u + dt * cx, v + dt * cy, U);
      let nu = u + (dt / 6) * (ax + 2 * bx + 2 * cx + ex), nv = v + (dt / 6) * (ay + 2 * by + 2 * cy + ey);
      nu = Math.min(0.995, Math.max(0.005, nu));
      nv = Math.min(0.99, Math.max(0.01, nv));
      return [nu, nv];
    });
    return { tp: s.tp + H, T, wall, parts };
  },
  dt: 0.05,
  sampleEvery: 4,
  maxSamples: 5000,

  narrowSplit: () => 0.356,
  viewport: () => ({ xMin: 0, xMax: 15, yMin: -0.1, yMax: 9.4, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;

    // ======== Coluna 1: condução pela parede ========
    d.text("Condução", 2.5, 9.1, { size: 13, weight: "700" });
    const layers = layersOf(p);
    const mesh = meshOf(p);
    const total = mesh.faces[mesh.faces.length - 1]!;
    const WX0 = 1.0, WX1 = 4.0, WY0 = 3.6, WY1 = 8.1;
    const X = (x: number) => WX0 + (x / total) * (WX1 - WX0);
    const Tlo = Math.min(TinOf(p), ToutOf(p)) - 3, Thi = Math.max(TinOf(p), ToutOf(p)) + 3;
    const Y = (T: number) => WY0 + ((T - Tlo) / (Thi - Tlo)) * (WY1 - WY0);
    layers.forEach((l, i) => {
      d.rect(X(mesh.faces[i]!), WY0, X(mesh.faces[i + 1]!) - X(mesh.faces[i]!), WY1 - WY0, { fill: l.m.color, alpha: 0.45, stroke: theme.muted, width: 1 });
      const xm = (X(mesh.faces[i]!) + X(mesh.faces[i + 1]!)) / 2;
      if (X(mesh.faces[i + 1]!) - X(mesh.faces[i]!) > 0.35) d.text(l.m.label.split(" ")[0]!, xm, WY0 + 0.2, { color: theme.text, size: 9 });
    });
    d.rect(0.15, WY0, WX0 - 0.15, WY1 - WY0, { fill: tempColor(TinOf(p), -10, 45), alpha: 0.25 });
    d.rect(WX1, WY0, 4.85 - WX1, WY1 - WY0, { fill: tempColor(ToutOf(p), -10, 45), alpha: 0.25 });
    d.text(`dentro ${formatBR(TinOf(p), 3)} °C`, 0.6, WY1 + 0.25, { color: theme.text, size: 10 });
    d.text(`fora ${formatBR(ToutOf(p), 3)} °C`, 4.4, WY1 + 0.25, { color: theme.text, size: 10 });
    // Perfil de regime (tracejado) e perfil atual
    const ifs = steadyInterfaces(p);
    const steady: [number, number][] = [[0.15, Y(TinOf(p))], [WX0, Y(ifs[0]!)]];
    mesh.faces.forEach((f, i) => steady.push([X(f), Y(ifs[i]!)]));
    steady.push([4.85, Y(ToutOf(p))]);
    d.polyline(steady, { color: theme.muted, width: 1.3, dash: [5, 4] });
    const st = surfaceTemps(s.wall, p);
    const cur: [number, number][] = [[0.15, Y(TinOf(p))], [WX0, Y(st.si)], ...mesh.x.map((x, i): [number, number] => [X(x), Y(s.wall[i] ?? 0)]), [WX1, Y(st.se)], [4.85, Y(ToutOf(p))]];
    d.polyline(cur, { color: theme.positive, width: 2.4 });
    const { qIn, qOut } = wallFluxes(s.wall, p);
    const qs = steadyFlux(p);
    const qmax = Math.max(Math.abs(qIn), Math.abs(qOut), Math.abs(qs), 1e-9);
    d.arrow(0.25, WY0 - 0.35, (0.65 * qIn) / qmax, 0, { color: theme.positive });
    d.arrow(WX1 + 0.1, WY0 - 0.35, (0.65 * qOut) / qmax, 0, { color: theme.positive });
    d.text(`q_entra = ${formatBR(qIn, 3)} W/m²`, 1.2, WY0 - 0.7, { color: theme.text, size: 10 });
    d.text(`q_sai = ${formatBR(qOut, 3)} W/m²`, 3.9, WY0 - 0.7, { color: theme.text, size: 10 });
    // Circuito térmico
    const R = resistances(p);
    const rs = [R.Ri, ...R.layers, R.Re];
    const names = ["1/hᵢ", ...layers.map((_, i) => `e${i + 1}/k${i + 1}`), "1/hₑ"];
    const rx0 = 0.25, rx1 = 4.75, ry = 1.85;
    // Largura de cada resistor ∝ R (com mínimo legível)
    const wsum = rs.reduce((a, b) => a + b, 0);
    const raw = rs.map((r) => Math.max(0.1, r / wsum));
    const rawSum = raw.reduce((a, b) => a + b, 0);
    let xc = rx0;
    rs.forEach((r, i) => {
      const ww = ((rx1 - rx0) * raw[i]!) / rawSum;
      d.spring(xc + 0.05, ry, xc + ww - 0.05, ry, { color: i === 0 || i === rs.length - 1 ? theme.accent : theme.text, coils: 4, amplitudePx: 5, width: 1.3 });
      d.text(names[i]!, xc + ww / 2, ry + 0.32, { color: theme.muted, size: 9 });
      d.text(formatBR(r, 2), xc + ww / 2, ry - 0.3, { color: theme.text, size: 9 });
      xc += ww;
    });
    d.text(`R_tot = ${formatBR(R.total, 3)} m²K/W → q = ${formatBR(qs, 3)} W/m² (tracejado: regime)`, 2.5, 1.05, { color: theme.text, size: 10 });
    d.text("circuito térmico (m²·K/W)", 2.5, 2.55, { color: theme.muted, size: 10 });

    // ======== Coluna 2: convecção ========
    d.text("Convecção", 7.5, 9.1, { size: 13, weight: "700" });
    const w = bodyPowers(s.T, p);
    d.rect(CV.x0, CV.y0, CV.x1 - CV.x0, CV.y1 - CV.y0, { stroke: theme.grid, width: 1 });
    const hot = s.T > TambOf(p) + 0.5;
    for (const [u, v] of s.parts) {
      const x = CV.x0 + u * (CV.x1 - CV.x0), y = CV.y0 + v * (CV.y1 - CV.y0);
      const warm = Math.abs(u - 0.5) < 0.25 ? 1 - v * 0.6 : 0.2 * (1 - v);
      d.dot(x, y, 2.6, hot ? tempColor(TambOf(p) + warm * (s.T - TambOf(p)), TambOf(p), Math.max(s.T, TambOf(p) + 1)) : theme.muted, 0.85);
    }
    if (hot) {
      d.arrow(7.5, 4.3, 0, 1.6, { color: theme.positive, width: 1.5 });
      d.arrow(5.85, 6.2, 0, -1.4, { color: theme.negative, width: 1.5 });
      d.arrow(9.15, 6.2, 0, -1.4, { color: theme.negative, width: 1.5 });
    }
    d.rect(BODY.x0, BODY.y0, BODY.x1 - BODY.x0, BODY.y1 - BODY.y0, { fill: tempColor(s.T, 0, 120), stroke: theme.text, width: 1.2 });
    d.rect(BODY.x0 - 0.5, BODY.y0 - 0.12, BODY.x1 - BODY.x0 + 1, 0.12, { fill: theme.ground });
    d.text(`${formatBR(s.T, 4)} °C`, 7.5, (BODY.y0 + BODY.y1) / 2, { color: "#fff", size: 11, weight: "700" });
    d.text(`ar a ${formatBR(TambOf(p), 3)} °C · h = ${formatBR(num(p, "h", 10), 3)} W/m²K`, 7.5, CV.y1 + 0.3, { color: theme.muted, size: 10 });
    d.text(`P_conv = hA(T − Tₐ) = ${formatBR(w.conv, 3)} W`, 7.5, 2.55, { color: theme.text, size: 10 });
    d.text(`τ = C/hA = ${fmtTime(BODY_C / (num(p, "h", 10) * BODY_A))}`, 7.5, 2.2, { color: theme.muted, size: 10 });

    // ======== Coluna 3: radiação ========
    d.text("Radiação", 12.5, 9.1, { size: 13, weight: "700" });
    if (radView(p) === 0) {
      const Tk = s.T + K0, Tak = TambOf(p) + K0;
      const eps = num(p, "eps", 0.9);
      // Corpo irradiando
      const cx = 12.5, cy = 7.45;
      const nRay = Math.max(0, Math.min(12, Math.round(w.rad / 3)));
      for (let i = 0; i < 12; i++) {
        const a = (2 * Math.PI * i) / 12;
        if (i < nRay) d.arrow(cx + 0.45 * Math.cos(a), cy + 0.45 * Math.sin(a), 0.5 * Math.cos(a), 0.5 * Math.sin(a), { color: theme.series[1], width: 1.3 });
      }
      d.circle(cx, cy, 0.38, { fill: tempColor(s.T, 0, 120), stroke: theme.text, width: 1 });
      d.text(`P_rad = εσA(T⁴ − Tₐ⁴) = ${formatBR(w.rad, 3)} W`, cx, 6.5, { color: theme.text, size: 10 });
      // Espectro de Planck
      const Bmax = Math.max(planck(WIEN / Tk, Tk), planck(WIEN / Tak, Tak)) * 1.1;
      const pl = panel(d, { x0: 10.5, y0: 3.4, x1: 14.6, y1: 5.9 }, { min: 0, max: 40 }, { min: 0, max: 1.05 });
      pl.frame({ xlabel: "λ (μm)", ylabel: "radiância espectral (rel.)", yticks: [0, 0.5, 1], xticks: [0, 10, 20, 30, 40], fy: (v) => formatBR(v, 2) });
      pl.plot((l) => planck(l * 1e-6, Tak) / Bmax, 0.5, 40, { color: theme.negative, width: 1.5 });
      pl.plot((l) => planck(l * 1e-6, Tk) / Bmax, 0.5, 40, { color: theme.muted, width: 1, dash: [4, 3] });
      pl.plot((l) => (eps * planck(l * 1e-6, Tk)) / Bmax, 0.5, 40, { color: theme.series[1], width: 2 });
      const lp = (WIEN / Tk) * 1e6;
      if (lp < 40) d.line(pl.X(lp), pl.Y(0), pl.X(lp), pl.Y(1.05), { color: theme.series[1], width: 1, dash: [2, 3] });
      d.text(`λ_max = ${formatBR(lp, 3)} μm (Wien)`, 12.55, 3.0, { color: theme.text, size: 10 });
      d.text("laranja: corpo (ε·corpo negro) · azul: ambiente", 12.55, 2.6, { color: theme.muted, size: 9 });
    } else {
      const gh = greenhouse(p);
      const e = num(p, "epsA", 0.78);
      const S4 = num(p, "S", 1361) / 4;
      const a = num(p, "alb", 0.3);
      const sT = SIGMA * gh.Ts ** 4, aT = e * SIGMA * gh.Tatm ** 4;
      d.rect(10.2, 2.4, 4.6, 0.5, { fill: tempColor(gh.Ts - K0, -40, 60), alpha: 0.8 });
      d.text(`superfície ${formatBR(gh.Ts, 4)} K (${formatBR(gh.Ts - K0, 3)} °C)`, 12.5, 2.65, { color: "#fff", size: 10, weight: "600" });
      d.rect(10.2, 6.0, 4.6, 0.55, { fill: theme.accent, alpha: 0.15 + 0.35 * e });
      d.text(`atmosfera ${formatBR(gh.Tatm, 4)} K · absorve ${formatBR(100 * e, 3)}% do IV`, 12.5, 6.27, { color: theme.text, size: 9 });
      const sc = 1.6 / 400;
      d.arrow(10.6, 8.6, 0, -(8.6 - 2.95), { color: "#e0bd48", width: 2 });
      d.text(`Sol ${formatBR(S4, 3)}`, 10.6, 8.75, { color: theme.text, size: 9 });
      d.arrow(11.0, 2.95, 0, 5.4, { color: "#e0bd48", width: 1.2, alpha: 0.6 });
      d.text(`refletido ${formatBR(a * S4, 3)}`, 11.05, 8.55, { color: theme.muted, size: 9, align: "left" });
      d.arrow(12.4, 2.95, 0, 3.0, { color: theme.positive, width: 1 + sT * sc });
      d.text(`σTₛ⁴ = ${formatBR(sT, 3)}`, 12.4, 4.9, { color: theme.text, size: 9, align: "right", dx: -6 });
      d.arrow(12.4, 6.6, 0, 1.6, { color: theme.positive, width: 1 + (1 - e) * sT * sc, alpha: 0.7 });
      d.text(`passa ${formatBR((1 - e) * sT, 3)}`, 12.4, 8.35, { color: theme.muted, size: 9 });
      d.arrow(13.8, 6.6, 0, 1.6, { color: theme.series[1], width: 1 + aT * sc });
      d.text(`atm. ↑ ${formatBR(aT, 3)}`, 13.8, 8.35, { color: theme.muted, size: 9 });
      d.arrow(13.8, 5.95, 0, -3.0, { color: theme.series[1], width: 1 + aT * sc });
      d.text(`atm. ↓ ${formatBR(aT, 3)}`, 13.85, 4.4, { color: theme.text, size: 9, align: "left" });
      d.text(`fluxos em W/m² · sem estufa: Tₑ = ${formatBR(gh.Te, 4)} K`, 12.5, 2.05, { color: theme.muted, size: 9 });
    }

    // ======== Balanço do corpo ========
    const pmax = Math.max(1, w.heater, Math.abs(w.conv) + Math.abs(w.rad));
    const bx0 = 5.6, bx1 = 14.6, by = 0.95;
    const bX = (v: number) => bx0 + 1.6 + ((bx1 - bx0 - 1.6) * v) / pmax;
    d.text("balanço do corpo", bx0, by + 0.95, { color: theme.text, size: 10, weight: "600", align: "left" });
    d.text("aquecedor", bx0, by + 0.45, { color: theme.muted, size: 9, align: "left" });
    d.rect(bX(0), by + 0.3, bX(w.heater) - bX(0), 0.3, { fill: theme.series[5] ?? theme.accent });
    d.text("perdas", bx0, by - 0.05, { color: theme.muted, size: 9, align: "left" });
    d.rect(bX(0), by - 0.2, bX(Math.max(0, w.conv)) - bX(0), 0.3, { fill: theme.series[0] });
    d.rect(bX(Math.max(0, w.conv)), by - 0.2, bX(Math.max(0, w.conv) + Math.max(0, w.rad)) - bX(Math.max(0, w.conv)), 0.3, { fill: theme.series[1] });
    d.text(`convecção ${formatBR(w.conv, 3)} W · radiação ${formatBR(w.rad, 3)} W · T_eq = ${formatBR(bodyEquilibrium(p), 4)} °C`, (bx0 + bx1) / 2 + 0.8, by - 0.55, { color: theme.text, size: 10 });
    d.text(`tempo físico ${fmtTime(s.tp)} · relógio ${formatBR(ritmo(p), 4)}×`, 2.5, 0.3, { color: theme.muted, size: 10 });
  },
});

export default transferenciaCalor;
