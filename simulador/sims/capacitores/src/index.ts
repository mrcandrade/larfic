import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { contour, domainFor, plateCharge, seeds, solve, trace, type Grid } from "./laplace.ts";
import { EPS0, assoc, capIdeal, fmt, forcePlates, forceSlab, insertion } from "./physics.ts";

export * from "./physics.ts";
export * from "./laplace.ts";

export interface CapState {
  /** Borda esquerda do bloco dielétrico (cm). */
  slab: number;
  /** Bateria ligada (V constante) ou desligada (Q constante). */
  bat: boolean;
  /** Carga mantida quando a bateria está desligada (C). */
  Qfix: number;
  drag: { ox: number } | null;
}

const modo = (p: Params) => Math.round(num(p, "modo"));
const geo = (p: Params) => ({ Lp: num(p, "Lp", 8), d: num(p, "d", 1.5), kappa: num(p, "kappa", 1) });
const slabOut = (Lp: number) => Lp / 2 + 0.5;

export function xIn(s: CapState, p: Params): number {
  return insertion(geo(p).Lp, s.slab);
}
export function capNow(s: CapState, p: Params): number {
  const { Lp, d, kappa } = geo(p);
  return capIdeal(Lp, d, xIn(s, p), kappa);
}
export function capAir(p: Params): number {
  const { Lp, d } = geo(p);
  return capIdeal(Lp, d, 0, 1);
}
export function voltNow(s: CapState, p: Params): number {
  return s.bat ? num(p, "V") : s.Qfix / capNow(s, p);
}
export const chargeNow = (s: CapState, p: Params) => capNow(s, p) * voltNow(s, p);
export const energyNow = (s: CapState, p: Params) => 0.5 * capNow(s, p) * voltNow(s, p) ** 2;
/** Energia de referência sem dielétrico, com o mesmo vínculo (mesmo V se ligada, mesma Q se desligada). */
export function energyRef(s: CapState, p: Params): number {
  const C0 = capAir(p);
  return s.bat ? 0.5 * C0 * num(p, "V") ** 2 : (s.Qfix * s.Qfix) / (2 * C0);
}

export function gridOf(s: CapState, p: Params): Grid {
  const { Lp, d, kappa } = geo(p);
  return solve({ Lp, d, kappa, slab: s.slab });
}
/** Capacitância com efeito de borda, pela carga da placa na solução de Laplace (F). */
export function capFringe(s: CapState, p: Params): number {
  return EPS0 * (geo(p).Lp / 100) * plateCharge(gridOf(s, p));
}

const assocOf = (p: Params) =>
  assoc(Math.round(num(p, "tipo")), num(p, "C1") * 1e-6, num(p, "C2") * 1e-6, num(p, "C3") * 1e-6, num(p, "Vs"));

function vpPlates(p: Params) {
  const { Lp, d } = geo(p);
  return { xMin: -Lp / 2 - 4, xMax: 1.5 * Lp + 1.5, yMin: -(d / 2 + 6.5), yMax: d / 2 + 4 };
}

export const capacitores = defineSim<CapState>({
  id: "capacitores",
  title: "Placas paralelas, dielétrico e associações",
  course: "FG III",
  topic: "Capacitores",
  priority: "P1",
  summary:
    "Campo de borda calculado pela equação de Laplace, dielétrico deslizável com bateria ligada ou desligada (energia e forças) e associações em série e paralelo.",
  equations: [
    String.raw`C = \frac{\varepsilon_0 w\,[\kappa x + (L - x)]}{d} \qquad Q = CV \qquad U = \tfrac12 CV^2 = \frac{Q^2}{2C}`,
    String.raw`F_\text{dielétrico} = \tfrac12 V^2 \frac{dC}{dx} = \frac{\varepsilon_0 w(\kappa-1)V^2}{2d} \qquad F_\text{placas} = \frac{Q^2}{2Cd}`,
    String.raw`\nabla\cdot(\kappa\nabla V) = 0 \ \text{(campo de borda)} \qquad \frac{1}{C_\text{eq}} = \sum_i \frac{1}{C_i}\ \text{(série)} \qquad C_\text{eq} = \sum_i C_i\ \text{(paralelo)}`,
  ],
  liveEquations(s, p) {
    if (modo(p) === 1) {
      const a = assocOf(p);
      return [
        String.raw`C_\text{eq} = ${texNum(a.Ceq * 1e6)}\ \mu\text{F} \qquad Q = C_\text{eq}V = ${texNum(a.Q * 1e6)}\ \mu\text{C} \qquad U = ${texNum(a.U * 1e6)}\ \mu\text{J}`,
      ];
    }
    const C = capNow(s, p);
    const V = voltNow(s, p);
    return [
      String.raw`C = ${texNum(C * 1e12)}\ \text{pF} \quad (\text{com borda: } ${texNum(capFringe(s, p) * 1e12)}\ \text{pF}) \qquad V = ${texNum(V)}\ \text{V} \qquad Q = ${texNum(C * V * 1e9)}\ \text{nC}`,
      String.raw`U = \tfrac12 CV^2 = ${texNum(energyNow(s, p) * 1e9)}\ \text{nJ} \qquad U_0 = ${texNum(energyRef(s, p) * 1e9)}\ \text{nJ}\ (\text{sem dielétrico})`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Placas paralelas (borda e dielétrico)" },
        { value: 1, label: "Associação de capacitores" },
      ],
    },
    { key: "V", label: "Tensão da bateria (placas)", unit: "V", min: 10, max: 1000, step: 10, default: 200, live: true },
    { key: "d", label: "Separação d entre as placas", unit: "cm", min: 1, max: 3, step: 0.25, default: 1.5, live: true },
    { key: "Lp", label: "Lado L das placas quadradas", unit: "cm", min: 4, max: 10, step: 1, default: 8 },
    { key: "kappa", label: "Constante dielétrica κ", unit: "", min: 1, max: 10, step: 0.1, default: 3, live: true },
    { key: "ins", label: "Inserção inicial do dielétrico (fração de L)", unit: "", min: 0, max: 1, step: 0.05, default: 0 },
    {
      key: "bateria",
      label: "Bateria no início",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Ligada (V constante)" },
        { value: 1, label: "Carregada e desligada (Q constante)" },
      ],
    },
    {
      key: "tipo",
      label: "Associação",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Série" },
        { value: 1, label: "Paralelo" },
        { value: 2, label: "Mista: C₁ em série com (C₂ ∥ C₃)" },
      ],
    },
    { key: "C1", label: "C₁", unit: "µF", min: 0.5, max: 20, step: 0.5, default: 2, live: true },
    { key: "C2", label: "C₂", unit: "µF", min: 0.5, max: 20, step: 0.5, default: 4, live: true },
    { key: "C3", label: "C₃ (0 = ausente)", unit: "µF", min: 0, max: 20, step: 0.5, default: 0, live: true },
    { key: "Vs", label: "Tensão da fonte (associação)", unit: "V", min: 1, max: 100, step: 1, default: 12, live: true },
  ],

  observables: [
    { key: "x", label: "Inserção do dielétrico", unit: "cm", value: (s, p) => xIn(s, p) },
    { key: "C", label: "Capacitância ideal", unit: "pF", value: (s, p) => (modo(p) === 0 ? capNow(s, p) * 1e12 : 0) },
    { key: "Cb", label: "Capacitância com borda (Laplace)", unit: "pF", value: (s, p) => (modo(p) === 0 ? capFringe(s, p) * 1e12 : 0) },
    { key: "V", label: "Tensão entre as placas", unit: "V", value: (s, p) => (modo(p) === 0 ? voltNow(s, p) : num(p, "Vs")) },
    { key: "Q", label: "Carga na placa", unit: "nC", value: (s, p) => (modo(p) === 0 ? chargeNow(s, p) * 1e9 : 0) },
    { key: "U", label: "Energia armazenada", unit: "nJ", value: (s, p) => (modo(p) === 0 ? energyNow(s, p) * 1e9 : 0) },
    { key: "U0", label: "Energia sem dielétrico (mesmo vínculo)", unit: "nJ", value: (s, p) => (modo(p) === 0 ? energyRef(s, p) * 1e9 : 0) },
    { key: "Fp", label: "Força entre as placas", unit: "µN", value: (s, p) => (modo(p) === 0 ? forcePlates(capNow(s, p), voltNow(s, p), geo(p).d) * 1e6 : 0) },
    {
      key: "Fd",
      label: "Força sobre o dielétrico",
      unit: "µN",
      value: (s, p) => (modo(p) === 0 ? forceSlab(voltNow(s, p), geo(p).Lp, geo(p).d, xIn(s, p), geo(p).kappa) * 1e6 : 0),
    },
    { key: "Ceq", label: "Capacitância equivalente", unit: "µF", value: (_s, p) => assocOf(p).Ceq * 1e6 },
    { key: "Qt", label: "Carga fornecida pela fonte", unit: "µC", value: (_s, p) => assocOf(p).Q * 1e6 },
    { key: "Ut", label: "Energia da associação", unit: "µJ", value: (_s, p) => assocOf(p).U * 1e6 },
  ],
  chart: { x: "x", y: "U" },

  scenarios: [
    {
      id: "borda",
      label: "Campo de borda",
      params: { modo: 0, bateria: 0, d: 2, Lp: 8, V: 200, kappa: 3 },
      guide: `### Placas finitas não são ideais
1. As linhas cheias são linhas de $\\vec E$ calculadas resolvendo $\\nabla^2 V = 0$ numa grade; as tracejadas são equipotenciais.
2. No meio das placas o campo é uniforme, $E = V/d$. Nas pontas as linhas se abrem: é o **campo de borda**.
3. Compare $C$ ideal, $\\varepsilon_0 A/d$, com a capacitância "com borda" (carga da placa na solução numérica). Aumente $d$: a diferença cresce, porque a borda pesa mais quando $L/d$ é menor.
4. Diminua $d$ até 1 cm: as linhas ficam quase todas retas e as duas capacitâncias se aproximam.`,
      predict: [
        {
          question: "Levando em conta o campo de borda, a capacitância real das placas finitas é:",
          options: ["maior que ε₀A/d", "menor que ε₀A/d", "igual a ε₀A/d"],
          answer: 0,
          explanation:
            "O campo que escapa pelas bordas e pelas faces externas também termina em cargas nas placas: para a mesma tensão, há mais carga do que no modelo ideal, logo $C > \\varepsilon_0 A/d$.",
        },
      ],
    },
    {
      id: "v-constante",
      label: "Dielétrico com bateria ligada",
      params: { modo: 0, bateria: 0, d: 1.5, Lp: 8, V: 200, kappa: 3 },
      guide: `### V constante
1. Arraste o bloco dielétrico para dentro das placas. Com a bateria ligada, $V$ não muda e $C$ cresce linearmente com a inserção $x$.
2. Observe a energia: $U = \\tfrac12 CV^2$ **aumenta**. O gráfico $U \\times x$ é uma reta.
3. A bateria fornece $\\Delta Q = V\\,\\Delta C$ e realiza trabalho $V\\Delta Q = 2\\Delta U$: metade vira energia do campo, metade é o trabalho feito pela força que puxa o dielétrico para dentro.
4. Note que as linhas de $\\vec E$ têm o mesmo espaçamento dentro e fora do dielétrico: $E = V/d$ nos dois trechos. Quem fica maior é a carga livre nas placas.`,
    },
    {
      id: "q-constante",
      label: "Dielétrico com bateria desligada",
      params: { modo: 0, bateria: 1, d: 1.5, Lp: 8, V: 200, kappa: 3 },
      guide: `### Q constante
1. O capacitor foi carregado a 200 V e desligado. Arraste o dielétrico para dentro: $Q$ fica fixa, $C$ cresce e $V = Q/C$ cai.
2. A energia $U = Q^2/(2C)$ **diminui**. Para onde foi? Para o trabalho da força que puxou o bloco.
3. Com o dielétrico todo dentro, $U = U_0/\\kappa$. Confira com os valores no palco.
4. Agora aumente $d$ (bateria desligada): $V$ e $U$ crescem, porque você faz trabalho contra a atração entre as placas.`,
      predict: [
        {
          question: "Com a bateria desligada, você insere completamente um dielétrico de κ = 3. A energia armazenada:",
          options: ["triplica", "cai para um terço", "não muda"],
          answer: 1,
          explanation:
            "Com $Q$ fixa, $U = Q^2/(2C)$ e $C$ fica $\\kappa$ vezes maior; então $U$ cai para $U_0/\\kappa$. O campo puxa o dielétrico para dentro e essa energia vira trabalho.",
        },
      ],
    },
    {
      id: "associacao",
      label: "Associações série e paralelo",
      params: { modo: 1, tipo: 2, C1: 2, C2: 4, C3: 2, Vs: 12 },
      guide: `### Série, paralelo e mista
1. Em **série**, todos têm a mesma carga e as tensões se somam: $1/C_\\text{eq} = \\sum 1/C_i$. O menor capacitor fica com a maior tensão.
2. Em **paralelo**, todos têm a mesma tensão e as cargas se somam: $C_\\text{eq} = \\sum C_i$.
3. Na **mista**, $C_2 \\parallel C_3$ vira $C_{23} = C_2 + C_3$, em série com $C_1$. Confira $V_1 + V_{23} = V$ e $Q_1 = Q_2 + Q_3$.
4. Mude $C_3$ para 0 para trabalhar com só dois capacitores.`,
    },
  ],

  exercises: [
    {
      id: "dieletrico-q",
      prompt:
        "Um capacitor de placas paralelas quadradas de lado {L} cm e separação {d} mm é carregado a {V} V e desligado da bateria. Em seguida, insere-se um dielétrico de κ = {k} que preenche todo o espaço entre as placas. Qual é a nova energia armazenada?",
      vary: { L: [5, 20, 0], d: [1, 5, 1], V: [50, 500, 0], k: [2, 6, 1] },
      answer: {
        label: "U",
        unit: "nJ",
        compute: (p) => {
          const C0 = (EPS0 * (num(p, "L") / 100) ** 2) / (num(p, "d") / 1000);
          const Q = C0 * num(p, "V");
          return ((Q * Q) / (2 * num(p, "k") * C0)) * 1e9;
        },
      },
      hint: "A carga não muda: U = Q²/(2κC₀), com C₀ = ε₀A/d.",
    },
    {
      id: "mista",
      prompt:
        "Um capacitor C₁ = {c1} µF está em série com a associação em paralelo de C₂ = {c2} µF e C₃ = {c3} µF. O conjunto é ligado a uma fonte de {V} V. Qual é a carga em C₂?",
      vary: { c1: [1, 10, 0], c2: [1, 10, 0], c3: [1, 10, 0], V: [6, 48, 0] },
      answer: {
        label: "Q₂",
        unit: "µC",
        compute: (p) => assoc(2, num(p, "c1"), num(p, "c2"), num(p, "c3"), num(p, "V")).caps[1]!.Q,
      },
      hint: "C₂₃ = C₂ + C₃; Q₁ = C_eq V; V₂₃ = Q₁/C₂₃; Q₂ = C₂V₂₃.",
    },
  ],

  init(p) {
    const Lp = geo(p).Lp;
    const out: CapState = { slab: slabOut(Lp), bat: true, Qfix: 0, drag: null };
    // Fração inicial inserida (0 = bloco fora, como antes); a carga com a bateria desligada é a do capacitor sem dielétrico.
    const f = Math.max(0, Math.min(1, num(p, "ins")));
    const slab = f > 0 ? Lp / 2 - f * Lp : out.slab;
    if (Math.round(num(p, "bateria")) === 1) return { ...out, slab, bat: false, Qfix: capNow(out, p) * num(p, "V") };
    return { ...out, slab };
  },
  static: true,
  step: (s) => s,
  sampleEvery: 1000,
  maxSamples: 4000,

  pointer: {
    down(s, p, pt) {
      if (modo(p) !== 0) return undefined;
      const { Lp, d } = geo(p);
      if (pt.x >= s.slab && pt.x <= s.slab + Lp && Math.abs(pt.y) <= d / 2 + 0.4) return { ...s, drag: { ox: pt.x - s.slab } };
      return undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const Lp = geo(p).Lp;
      const slab = clamp(pt.x - s.drag.ox, -Lp / 2, slabOut(Lp));
      return Math.abs(slab - s.slab) < 1e-3 ? undefined : { ...s, slab };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor(s, p, pt) {
      if (modo(p) !== 0) return undefined;
      const { Lp, d } = geo(p);
      return pt.x >= s.slab && pt.x <= s.slab + Lp && Math.abs(pt.y) <= d / 2 + 0.4 ? "ew-resize" : undefined;
    },
  },
  actions: [
    { id: "ligar", label: "Ligar bateria", run: (s) => ({ ...s, bat: true }), active: (s) => s.bat },
    {
      id: "desligar",
      label: "Desligar bateria",
      run: (s, p) => (s.bat ? { ...s, bat: false, Qfix: chargeNow(s, p) } : s),
      active: (s) => !s.bat,
    },
    { id: "inserir", label: "Inserir dielétrico", run: (s, p) => ({ ...s, slab: -geo(p).Lp / 2 }) },
    { id: "retirar", label: "Retirar dielétrico", run: (s, p) => ({ ...s, slab: slabOut(geo(p).Lp) }) },
  ],

  viewport: (p) => (modo(p) === 1 ? { xMin: 0, xMax: 12.5, yMin: -0.6, yMax: 7.7, unit: "" } : { ...vpPlates(p), unit: "cm" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    if (modo(frame.params) === 1) renderAssoc(d, frame.theme, frame.params);
    else renderPlates(d, frame.theme, frame.state, frame.params);
  },
});

function renderPlates(d: Draw, theme: Theme, s: CapState, p: Params) {
  const { Lp, d: gap, kappa } = geo(p);
  const vp = vpPlates(p);
  const G = gridOf(s, p);
  const V = voltNow(s, p);
  const inVp = (x: number, y: number) => x >= vp.xMin && x <= vp.xMax && y >= vp.yMin && y <= vp.yMax;
  const yPanel = vp.yMin + 4.1;

  // Bloco dielétrico (recortado ao palco)
  const sx1 = Math.min(s.slab + Lp, vp.xMax);
  d.rect(s.slab, -gap / 2, sx1 - s.slab, gap, { fill: theme.series[4]!, alpha: 0.22 });
  d.rect(s.slab, -gap / 2, sx1 - s.slab, gap, { stroke: theme.series[4]!, width: 1.5 });

  // Equipotenciais a cada 10% da tensão
  for (let k = -4; k <= 4; k++) {
    for (const [x1, y1, x2, y2] of contour(G, k / 10)) {
      if (!inVp(x1, y1) || !inVp(x2, y2) || y1 < yPanel || y2 < yPanel) continue;
      d.line(x1, y1, x2, y2, { color: k > 0 ? theme.positive : k < 0 ? theme.negative : theme.muted, width: 1, alpha: 0.55 });
    }
  }

  // Linhas de E com densidade proporcional a |E|
  for (const [x0, y0] of seeds(G, 30)) {
    const pts = trace(G, x0, y0);
    let run: [number, number][] = [];
    const flush = () => {
      if (run.length > 1) d.polyline(run, { color: theme.text, width: 1.2, alpha: 0.75 });
      run = [];
    };
    for (const pt of pts) {
      if (inVp(pt[0], pt[1]) && pt[1] > yPanel) run.push(pt);
      else flush();
    }
    flush();
    // Ponta de seta no meio da linha
    const m = Math.floor(pts.length / 2);
    const a = pts[m];
    const b = pts[Math.min(pts.length - 1, m + 2)];
    if (a && b && inVp(a[0], a[1]) && a[1] > yPanel + 0.3) d.arrowPx(a[0], a[1], b[0] - a[0], b[1] - a[1], 7, { color: theme.text, width: 1.2, head: 7 });
  }

  // Placas
  const th = 0.16;
  d.rect(-Lp / 2, gap / 2, Lp, th, { fill: theme.positive });
  d.rect(-Lp / 2, -gap / 2 - th, Lp, th, { fill: theme.negative });
  d.text(`+${fmt(V, 3)} V`, Lp / 2, gap / 2 + th, { dx: 4, dy: -8, align: "left", size: 11, color: theme.positive });
  d.text("0 V", Lp / 2, -gap / 2 - th, { dx: 4, dy: 8, align: "left", size: 11, color: theme.negative });
  d.text(`κ = ${fmt(kappa, 2)}`, (s.slab + sx1) / 2, 0, { size: 12, weight: "600", color: theme.series[4]! });

  // Bateria e fios
  const xb = -Lp / 2 - 2.6;
  const yt = gap / 2 + th / 2;
  const yb = -gap / 2 - th / 2;
  d.line(-Lp / 2, yb, xb, yb, { color: theme.text, width: 2 });
  d.line(xb, yb, xb, -0.25, { color: theme.text, width: 2 });
  d.line(xb, 0.25, xb, yt, { color: theme.text, width: 2 });
  d.line(xb - 0.5, 0.25, xb + 0.5, 0.25, { color: theme.text, width: 3 });
  d.line(xb - 0.28, -0.25, xb + 0.28, -0.25, { color: theme.text, width: 3 });
  d.text("+", xb - 0.75, 0.3, { size: 12, color: theme.positive, weight: "700" });
  if (s.bat) {
    d.line(xb, yt, -Lp / 2, yt, { color: theme.text, width: 2 });
  } else {
    const xs = xb + 0.8;
    d.line(xb, yt, xs, yt, { color: theme.text, width: 2 });
    d.line(xs, yt, xs + 0.75, yt + 0.55, { color: theme.text, width: 2 });
    d.line(xs + 1, yt, -Lp / 2, yt, { color: theme.text, width: 2 });
    d.dot(xs, yt, 2.5, theme.text);
    d.dot(xs + 1, yt, 2.5, theme.text);
  }
  d.text(s.bat ? `${fmt(num(p, "V"))} V` : "desligada", xb - 0.8, -0.35, { size: 11, align: "right", color: theme.muted });

  // Painel inferior
  const panel = theme.dark ? "rgba(15, 20, 27, 0.88)" : "rgba(255, 255, 255, 0.9)";
  d.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, yPanel - vp.yMin, { fill: panel });
  d.line(vp.xMin, yPanel, vp.xMax, yPanel, { color: theme.grid, width: 1 });
  const C = capNow(s, p);
  const Cb = capFringe(s, p);
  const U = energyNow(s, p);
  const U0 = energyRef(s, p);
  const Fp = forcePlates(C, V, gap);
  const Fd = forceSlab(V, Lp, gap, xIn(s, p), kappa);
  const x0 = vp.xMin + 0.3;
  let y = yPanel - 0.5;
  const ln = (str: string, col = theme.text, w = "400") => {
    d.text(str, x0, y, { align: "left", size: 12, color: col, weight: w });
    y -= 0.62;
  };
  ln(`C ideal = ${fmt(C * 1e12)} pF    C com borda (Laplace) = ${fmt(Cb * 1e12)} pF  (${Cb >= C ? "+" : "−"}${fmt(Math.abs(Cb / C - 1) * 100, 2)} %)`, theme.text, "600");
  ln(
    s.bat
      ? `Bateria ligada: V = ${fmt(V)} V constante, Q = ${fmt(C * V * 1e9)} nC`
      : `Bateria desligada: Q = ${fmt(s.Qfix * 1e9)} nC constante, V = Q/C = ${fmt(V)} V`,
  );
  ln(
    s.bat
      ? `U = ½CV² = ${fmt(U * 1e9)} nJ    trabalho da bateria desde x = 0: ${fmt(2 * (U - U0) * 1e9)} nJ = 2ΔU`
      : `U = Q²/2C = ${fmt(U * 1e9)} nJ    U₀/κ = ${fmt((U0 / kappa) * 1e9)} nJ (dielétrico todo dentro)`,
  );
  ln(`Força entre as placas: ${fmt(Fp * 1e6)} µN (atração)    Força no dielétrico: ${Fd > 0 ? `${fmt(Fd * 1e6)} µN, puxa para dentro` : "nula (fora ou todo dentro)"}`);
  ln("Arraste o bloco dielétrico. Linhas cheias: E; coloridas: equipotenciais a cada 10% de V.", theme.muted);

  // Barras de energia: U agora × U₀ sem dielétrico
  const bx = vp.xMax - 5.2;
  const bw = 3.6;
  const Umax = Math.max(U, U0, 1e-30);
  const bar = (yy: number, val: number, label: string, col: string) => {
    d.text(label, bx - 0.2, yy, { align: "right", size: 11, color: theme.muted });
    d.rect(bx, yy - 0.2, bw, 0.4, { stroke: theme.grid, width: 1 });
    d.rect(bx, yy - 0.2, (bw * val) / Umax, 0.4, { fill: col, alpha: 0.85 });
  };
  bar(yPanel - 0.5, U, "U", theme.accent);
  bar(yPanel - 1.12, U0, "U₀", theme.muted);
}

function capSymbol(d: Draw, x: number, y: number, vertical: boolean, col: string) {
  // vertical = placas verticais (capacitor num fio horizontal)
  const g = 0.14;
  const L = 0.5;
  if (vertical) {
    d.line(x - g, y - L, x - g, y + L, { color: col, width: 3 });
    d.line(x + g, y - L, x + g, y + L, { color: col, width: 3 });
  } else {
    d.line(x - L, y - g, x + L, y - g, { color: col, width: 3 });
    d.line(x - L, y + g, x + L, y + g, { color: col, width: 3 });
  }
}

function renderAssoc(d: Draw, theme: Theme, p: Params) {
  const tipo = Math.round(num(p, "tipo"));
  const a = assocOf(p);
  const Vs = num(p, "Vs");
  const yT = 5.6;
  const yB = 1.6;
  const xL = 1.2;
  const xR = 11.6;
  const w = { color: theme.text, width: 2 };
  const sub = ["₁", "₂", "₃"];
  const label = (i: number, x: number, y: number, align: CanvasTextAlign = "center") => {
    const c = a.caps[i]!;
    const col = theme.series[i]!;
    d.text(`C${sub[i]} = ${fmt(c.C * 1e6)} µF`, x, y, { size: 12, weight: "600", color: col, align });
    d.text(`Q = ${fmt(c.Q * 1e6)} µC`, x, y - 0.42, { size: 11, color: theme.text, align });
    d.text(`V = ${fmt(c.V)} V`, x, y - 0.8, { size: 11, color: theme.text, align });
  };

  // Fonte à esquerda
  d.line(xL, yB, xL, 3.35, w);
  d.line(xL, 3.85, xL, yT, w);
  d.line(xL - 0.5, 3.85, xL + 0.5, 3.85, { color: theme.text, width: 3 });
  d.line(xL - 0.28, 3.35, xL + 0.28, 3.35, { color: theme.text, width: 3 });
  d.text(`${fmt(Vs)} V`, xL - 0.65, 3.6, { size: 12, align: "right" });
  d.text("+", xL + 0.7, 4.05, { size: 12, color: theme.positive, weight: "700" });
  d.line(xL, yB, xR, yB, w);
  d.line(xR, yB, xR, yT, w);

  if (tipo === 0) {
    const n = a.caps.length;
    const xs = a.caps.map((_, i) => xL + ((i + 1) * (xR - xL)) / (n + 1));
    let prev = xL;
    xs.forEach((x, i) => {
      d.line(prev, yT, x - 0.14, yT, w);
      capSymbol(d, x, yT, true, theme.series[i]!);
      label(i, x, yT + 1.65);
      prev = x + 0.14;
    });
    d.line(prev, yT, xR, yT, w);
  } else if (tipo === 1) {
    d.line(xL, yT, xR, yT, w);
    const n = a.caps.length;
    a.caps.forEach((_, i) => {
      const x = xL + ((i + 1) * (xR - xL)) / (n + 1) + 0.6;
      const ym = (yT + yB) / 2;
      d.line(x, yT, x, ym + 0.14, w);
      d.line(x, ym - 0.14, x, yB, w);
      d.dot(x, yT, 3, theme.text);
      d.dot(x, yB, 3, theme.text);
      capSymbol(d, x, ym, false, theme.series[i]!);
      label(i, x + 0.7, ym + 0.4, "left");
    });
  } else {
    const x1 = 3.6;
    d.line(xL, yT, x1 - 0.14, yT, w);
    capSymbol(d, x1, yT, true, theme.series[0]!);
    label(0, x1, yT + 1.65);
    d.line(x1 + 0.14, yT, xR, yT, w);
    const xs = a.caps.length === 3 ? [6.3, 9.3] : [7.8];
    const ym = (yT + yB) / 2;
    xs.forEach((x, k) => {
      d.line(x, yT, x, ym + 0.14, w);
      d.line(x, ym - 0.14, x, yB, w);
      d.dot(x, yT, 3, theme.text);
      d.dot(x, yB, 3, theme.text);
      capSymbol(d, x, ym, false, theme.series[k + 1]!);
      label(k + 1, x + 0.7, ym + 0.4, "left");
    });
  }

  const nome = ["série", "paralelo", "mista"][tipo] ?? "";
  d.text(
    `Associação ${nome}:  C_eq = ${fmt(a.Ceq * 1e6)} µF    Q da fonte = ${fmt(a.Q * 1e6)} µC    U = ½C_eq V² = ${fmt(a.U * 1e6)} µJ`,
    0.3,
    0.6,
    { align: "left", size: 12, weight: "600" },
  );
  d.text(
    tipo === 0 ? "Série: mesma carga em todos; as tensões somam V." : tipo === 1 ? "Paralelo: mesma tensão em todos; as cargas somam Q." : "Mista: Q₁ = Q₂ + Q₃ e V₁ + V₂₃ = V.",
    0.3,
    0.0,
    { align: "left", size: 11, color: theme.muted },
  );
}

export default capacitores;
