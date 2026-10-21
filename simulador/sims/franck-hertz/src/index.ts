import { defineSim, draw, num, rng, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { HG, NE, curve, glowProfile, hgPressure, interp, lambdaRel, meanSpacing, peaks, type CurveParams, type Gas } from "./physics.ts";

export * from "./physics.ts";

interface Part {
  x: number;
  y: number;
  E: number;
  tau: number;
  back: boolean;
}
interface Flash {
  x: number;
  y: number;
  age: number;
  visible: boolean;
}

export interface FHState {
  /** Tensão de aceleração atual (V). */
  U: number;
  /** Pontos (U, I) registrados. */
  trace: [number, number][];
  parts: Part[];
  flashes: Flash[];
  seed: number;
  acc: number;
}

export const gasOf = (p: Params): Gas => (Math.round(num(p, "gas")) === 1 ? NE : HG);
export const curveParams = (p: Params): CurveParams => ({ gas: gasOf(p), Tc: num(p, "T", 180), Ur: num(p, "Ur", 1.5), Uc: num(p, "Uc", 2) });
const sweep = (p: Params) => Math.round(num(p, "modo")) === 1;
const mainE = (g: Gas) => g.channels.find((c) => c.w === 1)!.E;
/** Região de retardo grade–ânodo, em unidades da distância cátodo–grade. */
const GA = 0.2;

/** Corrente no ânodo (nA) para a tensão U, lida da curva em cache. */
export const currentAt = (p: Params, U: number) => interp(curve(curveParams(p)), U);

const peakList = (p: Params) => peaks(curve(curveParams(p)), mainE(gasOf(p)) * 0.6);

function initState(p: Params): FHState {
  return { U: sweep(p) ? 0 : num(p, "U", 15), trace: [], parts: [], flashes: [], seed: 1923, acc: 0 };
}

export const franckHertz = defineSim<FHState>({
  id: "franck-hertz",
  title: "Experimento de Franck–Hertz",
  course: "FG IV",
  topic: "Física moderna",
  priority: "P2",
  summary:
    "Elétrons acelerados num tubo com vapor de mercúrio (forno de temperatura ajustável) ou neônio perdem energia em pacotes ao excitar os átomos: a corrente no ânodo cai a cada 4,9 V (Hg) ou cerca de 19 V (Ne), e no neônio as colisões aparecem como camadas de luz.",
  equations: [
    String.raw`E_{\text{grade}} = e(U - U_c) - n\,\Delta E \qquad \text{chega ao ânodo se } E > eU_r`,
    String.raw`\Delta U_{\text{picos}} = \frac{\Delta E}{e} \quad (\text{Hg: } 4{,}9\ \text{V},\ \text{Ne: } \approx 19\ \text{V})`,
    String.raw`\lambda_{\text{livre}} = \frac{k_BT}{p(T)\,\sigma} \qquad \lambda_{\text{fóton}} = \frac{hc}{\Delta E}`,
  ],
  liveEquations(s, p) {
    const g = gasOf(p);
    const c = curveParams(p);
    const pk = peakList(p);
    const out = [
      String.raw`U = ${texNum(s.U)}\ \text{V} \quad I = ${texNum(currentAt(p, s.U))}\ \text{nA} \quad U_r = ${texNum(c.Ur)}\ \text{V}`,
      String.raw`\overline{\Delta U} = ${texNum(meanSpacing(pk))}\ \text{V} \Rightarrow \Delta E = ${texNum(meanSpacing(pk))}\ \text{eV},\ \lambda = \frac{hc}{\Delta E} = ${texNum(meanSpacing(pk) > 0 ? 1239.84 / meanSpacing(pk) : 0)}\ \text{nm}`,
    ];
    if (g === HG)
      out.push(String.raw`p_{\text{Hg}}(${texNum(c.Tc)}\ ^\circ\text{C}) = ${texNum(hgPressure(c.Tc))}\ \text{Pa} \qquad \lambda_{\text{livre}}/L = ${texNum(lambdaRel(g, c.Tc))}`);
    return out;
  },

  params: [
    {
      key: "gas",
      label: "Gás no tubo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Mercúrio (forno)" },
        { value: 1, label: "Neônio" },
      ],
    },
    {
      key: "modo",
      label: "Tensão de aceleração",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      options: [
        { value: 0, label: "Manual (botão U)" },
        { value: 1, label: "Varredura automática" },
      ],
    },
    { key: "U", label: "Tensão de aceleração U (manual)", unit: "V", min: 0, max: 80, step: 0.1, default: 15, live: true },
    { key: "taxa", label: "Velocidade da varredura", unit: "V/s", min: 0.5, max: 10, step: 0.5, default: 2, live: true },
    { key: "T", label: "Temperatura do forno (Hg)", unit: "°C", min: 110, max: 220, step: 1, default: 180, live: true },
    { key: "Ur", label: "Contrapotencial U_r", unit: "V", min: 0, max: 10, step: 0.1, default: 1.5, live: true },
    { key: "Uc", label: "Potencial de contato U_c", unit: "V", min: 0, max: 3, step: 0.1, default: 2, live: true },
  ],

  observables: [
    { key: "U", label: "Tensão de aceleração", unit: "V", value: (s) => s.U },
    { key: "I", label: "Corrente no ânodo", unit: "nA", value: (s, p) => currentAt(p, s.U) },
    { key: "Ur", label: "Contrapotencial", unit: "V", value: (_s, p) => num(p, "Ur", 1.5) },
    { key: "dU", label: "Espaçamento médio entre picos", unit: "V", value: (_s, p) => meanSpacing(peakList(p)) },
    { key: "picos", label: "Picos na faixa varrida", unit: "", value: (s, p) => peakList(p).filter((u) => u <= s.U).length },
    {
      key: "camadas",
      label: "Camadas de colisão no tubo",
      unit: "",
      value: (s, p) => Math.max(0, Math.floor((s.U - num(p, "Uc", 2)) / mainE(gasOf(p)))),
    },
    { key: "lambda", label: "λ do fóton principal", unit: "nm", value: (_s, p) => gasOf(p).photon },
    { key: "pHg", label: "Pressão de vapor do Hg", unit: "Pa", value: (_s, p) => (gasOf(p) === HG ? hgPressure(num(p, "T", 180)) : 0) },
  ],
  chart: { x: "U", y: "I" },

  scenarios: [
    {
      id: "mercurio",
      label: "Mercúrio a 180 °C",
      params: { gas: 0, modo: 1, taxa: 2, T: 180, Ur: 1.5, Uc: 2 },
      guide: `### Energia em pacotes
1. A varredura sobe $U$ de 0 a 30 V. A corrente cresce, mas cai bruscamente a intervalos regulares.
2. Meça as tensões dos máximos (ou mínimos) no gráfico e calcule o espaçamento médio. Deve dar $\\approx 4{,}9\\ \\text{V}$: é a energia do primeiro nível excitado do Hg.
3. O primeiro pico não está em 4,9 V: ele é deslocado pelo **potencial de contato** $U_c$ entre cátodo e grade. Por isso se usa a *diferença* entre picos.
4. Cada átomo excitado emite um fóton de $\\lambda = hc/4{,}9\\ \\text{eV} = 254\\ \\text{nm}$ (ultravioleta, marcado em violeta).`,
      predict: [
        {
          question: "Por que a corrente cai logo depois de U ≈ 4,9 V (descontado o potencial de contato)?",
          options: [
            "os elétrons são absorvidos pelos átomos",
            "os elétrons perdem 4,9 eV numa colisão e não vencem o contrapotencial",
            "o vapor de mercúrio se ioniza",
            "a grade fica saturada",
          ],
          answer: 1,
          explanation: "Ao atingir 4,9 eV, o elétron excita um átomo e fica com energia quase nula perto da grade: não sobe o pequeno contrapotencial até o ânodo.",
        },
      ],
    },
    {
      id: "temperatura",
      label: "Efeito da temperatura do forno",
      params: { gas: 0, modo: 1, taxa: 4, T: 130, Ur: 1.5, Uc: 2 },
      guide: `### Mais vapor, colisões mais cedo
1. A 130 °C a pressão de vapor é baixa e o livre caminho médio é grande: os elétrons passam do limiar antes de colidir, e os picos ficam largos e borrados. Aparece também a excitação em 6,7 V.
2. Suba o forno para 180 °C e 200 °C durante a varredura: os mínimos ficam mais nítidos e a corrente total diminui (mais espalhamento).
3. Compare $\\lambda_{\\text{livre}}/L$ nas equações vivas para cada temperatura.`,
      predict: [
        {
          question: "Aumentando a temperatura do forno, os mínimos da curva ficam:",
          options: ["mais nítidos", "mais borrados", "iguais", "desaparecem"],
          answer: 0,
          explanation: "Mais vapor encurta o livre caminho médio: o elétron colide assim que atinge 4,9 eV, então quase todos chegam à grade com energia parecida.",
        },
      ],
    },
    {
      id: "neonio",
      label: "Neônio: camadas de luz",
      params: { gas: 1, modo: 0, U: 45, Ur: 7, Uc: 1 },
      guide: `### Onde os elétrons colidem, o gás brilha
1. No neônio a excitação principal é em torno de 18,7 eV; os átomos decaem emitindo luz **vermelho-alaranjada** (≈ 600 nm).
2. Com $U = 45\\ \\text{V}$ aparecem duas camadas de luz entre o cátodo e a grade. Suba $U$ devagar até 60 V: surge a terceira camada, e as existentes se aproximam do cátodo.
3. Cada camada corresponde a uma colisão: o número de camadas é o número de vezes que o elétron atingiu o limiar.
4. Varra $U$ (modo automático) e meça o espaçamento entre picos: perto de 19 V.`,
    },
  ],

  exercises: [
    {
      id: "fóton",
      prompt: "Numa curva de Franck–Hertz, o primeiro e o último de {np} máximos consecutivos estão separados por {soma} V. Qual é o comprimento de onda da luz emitida pelos átomos excitados?",
      vary: { np: [4, 6, 0], soma: [14, 26, 1] },
      answer: { label: "λ", unit: "nm", compute: (p) => 1239.84 / (num(p, "soma") / (num(p, "np") - 1)) },
      hint: "ΔE = e·ΔU por intervalo e λ = hc/ΔE (hc = 1240 eV·nm).",
    },
    {
      id: "contato",
      prompt: "O primeiro mínimo da corrente num tubo de mercúrio aparece em {um} V. Sabendo que a excitação do Hg é 4,9 eV e que o mínimo ocorre quando U − U_c ≈ 4,9 V + U_r, com U_r = {ur} V, qual é o potencial de contato?",
      vary: { um: [7.5, 9, 1], ur: [0.5, 2.5, 1] },
      answer: { label: "U_c", unit: "V", compute: (p) => num(p, "um") - 4.9 - num(p, "ur") },
      tolerance: 0.03,
    },
  ],

  init: initState,
  step(s, p, _t, dt) {
    const g = gasOf(p);
    const U = sweep(p) ? Math.min(g.Umax, s.U + num(p, "taxa", 2) * dt) : Math.min(g.Umax, num(p, "U", 15));
    const I = currentAt(p, U);
    const last = s.trace[s.trace.length - 1];
    let trace = s.trace;
    if (!last || Math.abs(last[0] - U) > 0.02) trace = [...(s.trace.length > 3000 ? s.trace.slice(1) : s.trace), [U, I]];
    return { ...animate(s, p, U, dt), U, trace };
  },
  dt: 0.02,
  sampleEvery: 2,
  maxSamples: 8000,

  actions: [
    { id: "reiniciar", label: "Reiniciar varredura", run: (s) => ({ ...s, U: 0, trace: [] }) },
    { id: "limpar", label: "Limpar curva", run: (s) => ({ ...s, trace: [] }) },
  ],

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    renderTube(d, frame.theme, frame.state, frame.params);
    renderCurve(d, frame.theme, frame.state, frame.params);
  },
});

/** Animação dos elétrons no tubo com as mesmas regras de colisão do modelo. */
function animate(s: FHState, p: Params, U: number, dt: number): Pick<FHState, "parts" | "flashes" | "seed" | "acc"> {
  const g = gasOf(p);
  const c = curveParams(p);
  const lam = lambdaRel(g, c.Tc);
  const Ueff = U - c.Uc;
  const rand = rng(s.seed);
  const flashes = s.flashes.map((f) => ({ ...f, age: f.age + dt })).filter((f) => f.age < 0.5);
  const parts: Part[] = [];
  const Em = mainE(g);
  for (const q0 of s.parts) {
    const q = { ...q0 };
    const dx = dt * 0.55 * (0.3 + Math.sqrt(Math.max(q.E, 0) / Em));
    const n = 8;
    let alive = true;
    for (let k = 0; k < n && alive; k++) {
      const h = dx / n;
      if (q.back) {
        q.x -= h;
        if (q.x < 1) alive = false;
        continue;
      }
      if (q.x < 1) {
        q.x += h;
        q.E += Ueff * h;
        let R = 0;
        for (const ch of g.channels) if (q.E >= ch.E) R += ch.w / lam;
        q.tau -= R * h;
        if (q.tau <= 0 && R > 0) {
          let u = rand() * R;
          let j = 0;
          for (let i = 0; i < g.channels.length; i++) {
            const ch = g.channels[i]!;
            if (q.E < ch.E) continue;
            j = i;
            u -= ch.w / lam;
            if (u <= 0) break;
          }
          q.E -= g.channels[j]!.E;
          flashes.push({ x: q.x, y: q.y, age: 0, visible: g.channels[j]!.visible });
          q.tau = -Math.log(Math.max(1e-12, rand()));
        }
      } else {
        q.x += h;
        q.E -= (c.Ur * h) / GA;
        if (q.E < 0) q.back = true;
        if (q.x >= 1 + GA) alive = false;
      }
    }
    if (alive) parts.push(q);
  }
  let acc = s.acc + 30 * dt;
  while (acc >= 1 && Ueff > 0 && parts.length < 80) {
    parts.push({ x: 0, y: 2 * rand() - 1, E: -0.1 * Math.log(Math.max(1e-12, rand() * rand())), tau: -Math.log(Math.max(1e-12, rand())), back: false });
    acc -= 1;
  }
  return { parts, flashes: flashes.slice(-120), seed: Math.floor(rand() * 2 ** 31), acc: acc % 1 };
}

const X = (x: number) => (x <= 1 ? 1.4 + 9.6 * x : 11 + ((x - 1) / GA) * 1.5);
const Y = (y: number) => 9.75 + y * 1.0;

function renderTube(d: Draw, th: Theme, s: FHState, p: Params) {
  const g = gasOf(p);
  const c = curveParams(p);
  if (g === HG) {
    d.rect(0.3, 7.75, 13.2, 4.0, { stroke: th.series[1]!, width: 1.5, dash: [6, 4] });
    d.text(`forno: ${fmt(c.Tc)} °C   p(Hg) = ${fmt(hgPressure(c.Tc))} Pa`, 0.5, 11.45, { align: "left", size: 10, color: th.series[1]! });
  }
  // Bulbo
  d.rect(0.8, 8.35, 12.2, 2.8, { fill: g === NE ? (th.dark ? "rgba(255,120,60,0.06)" : "rgba(255,120,60,0.05)") : th.dark ? "rgba(150,170,220,0.07)" : "rgba(80,100,160,0.05)", stroke: th.muted, width: 1.2 });
  // Camadas de luz (neônio)
  if (g === NE) {
    const prof = glowProfile(c, s.U, 60);
    const mx = Math.max(0.02, ...prof);
    prof.forEach((v, i) => {
      if (v <= 0) return;
      const a = Math.min(0.85, (v / mx) * 0.85);
      d.rect(X(i / 60), 8.75, X((i + 1) / 60) - X(i / 60), 2.0, { fill: "#ff7a2e", alpha: a });
    });
  }
  // Cátodo, grade e ânodo
  d.line(X(0), 8.7, X(0), 10.8, { color: th.text, width: 4 });
  d.polyline(
    Array.from({ length: 9 }, (_, i) => [X(0) - 0.25 - (i % 2) * 0.2, 8.8 + i * 0.25] as [number, number]),
    { color: th.positive, width: 1.2 },
  );
  d.text("K", X(0), 8.0, { size: 11, weight: "600" });
  d.line(X(1), 8.6, X(1), 10.9, { color: th.text, width: 1.5, dash: [3, 3] });
  d.text("G", X(1), 8.0, { size: 11, weight: "600" });
  d.line(X(1 + GA), 8.7, X(1 + GA), 10.8, { color: th.text, width: 4 });
  d.text("A", X(1 + GA), 8.0, { size: 11, weight: "600" });
  d.text(`U = ${fmt(s.U)} V`, (X(0) + X(1)) / 2, 7.95, { size: 11, color: th.accent });
  d.text(`−U_r = ${fmt(c.Ur)} V`, (X(1) + X(1 + GA)) / 2, 11.5, { size: 10, color: th.muted });
  // Elétrons e colisões
  for (const q of s.parts) {
    const hot = Math.min(1, Math.max(0, q.E) / mainE(g));
    d.dot(X(q.x), Y(q.y), 2.2, q.back ? th.muted : hot > 0.85 ? th.positive : th.accent);
  }
  for (const f of s.flashes) {
    const a = 1 - f.age / 0.5;
    const col = f.visible ? "#ff7a2e" : "#9b5cff";
    d.dot(X(f.x), Y(f.y), 3 + 6 * (1 - a), col, 0.25 * a);
    d.dot(X(f.x), Y(f.y), 2.4, col, 0.8 * a);
  }
  // Leituras
  const pk = peakList(p);
  const rows = [
    `I = ${fmt(currentAt(p, s.U))} nA`,
    `U = ${fmt(s.U)} V   U_r = ${fmt(c.Ur)} V`,
    `ΔU médio = ${fmt(meanSpacing(pk))} V`,
    `${g.name}: fóton ${fmt(g.photon)} nm ${g === HG ? "(UV)" : "(visível)"}`,
    `λ_livre/L = ${fmt(lambdaRel(g, c.Tc))}`,
  ];
  rows.forEach((r, i) => d.text(r, 14.0, 11.4 - i * 0.62, { align: "left", size: 12, weight: i === 0 ? "600" : "400" }));
  d.dot(14.15, 7.95, 3, th.accent);
  d.text("elétron", 14.4, 7.95, { align: "left", size: 10, color: th.muted });
  d.dot(15.9, 7.95, 3, th.positive);
  d.text("perto do limiar", 16.15, 7.95, { align: "left", size: 10, color: th.muted });
  d.dot(18.6, 7.95, 3, g === NE ? "#ff7a2e" : "#9b5cff");
  d.text("colisão", 18.85, 7.95, { align: "left", size: 10, color: th.muted });
}

function renderCurve(d: Draw, th: Theme, s: FHState, p: Params) {
  const g = gasOf(p);
  const cv = curve(curveParams(p));
  const top = Math.max(1, ...cv.I) * 1.1;
  const P = panel(d, { x0: 1.4, y0: 0.9, x1: 19.4, y1: 6.6 }, { min: 0, max: g.Umax }, { min: 0, max: top });
  P.frame({ xlabel: "U (V)", ylabel: "I no ânodo (nA)" });
  P.line(
    cv.U.map((u, i) => [u, cv.I[i]!] as [number, number]),
    { color: th.muted, width: 1, dash: [3, 3], alpha: 0.6 },
  );
  if (s.trace.length > 1) P.line(s.trace, { color: th.accent, width: 2 });
  P.line([[s.U, 0], [s.U, top]], { color: th.positive, width: 1, alpha: 0.5 });
  d.dot(P.X(s.U), P.Y(currentAt(p, s.U)), 4, th.positive);
  // Picos já varridos e espaçamentos
  const pk = peakList(p).filter((u) => u <= s.U);
  pk.forEach((u, i) => {
    const y = interp(cv, u);
    P.line([[u, y], [u, y + top * 0.06]], { color: th.series[2]!, width: 1.5 });
    if (i > 0) d.text(`${fmt(u - pk[i - 1]!, 3)} V`, P.X((u + pk[i - 1]!) / 2), P.Y(Math.max(y, interp(cv, pk[i - 1]!)) + top * 0.08), { size: 10, color: th.series[2]! });
  });
  d.text("tracejado: curva completa do modelo; azul: medida", 19.4, 6.6, { align: "right", size: 10, color: th.muted, dy: -9 });
}

export default franckHertz;
