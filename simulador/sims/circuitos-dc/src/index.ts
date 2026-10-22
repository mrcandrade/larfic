import { defineSim, draw, type Draw, type SimAction, type Theme } from "@fisilab/core";
import { distToComp, makeComp, sameSegment, si, solveStep, stepValue, type CircuitState, type Comp, type Kind, type Pt, type Tool } from "./model.ts";
import { PRESETS } from "./presets.ts";
import { derivation } from "./derivation.ts";

export * from "./model.ts";
export { PRESETS } from "./presets.ts";

const W = 12;
const H = 8;

const TOOLS: { tool: Tool; label: string }[] = [
  { tool: "selecionar", label: "Selecionar" },
  { tool: "fio", label: "Fio" },
  { tool: "resistor", label: "Resistor" },
  { tool: "bateria", label: "Bateria" },
  { tool: "lampada", label: "Lâmpada" },
  { tool: "chave", label: "Chave" },
  { tool: "capacitor", label: "Capacitor" },
  { tool: "indutor", label: "Indutor" },
  { tool: "diodo", label: "Diodo" },
  { tool: "amperimetro", label: "Amperímetro" },
  { tool: "voltimetro", label: "Voltímetro" },
  { tool: "apagar", label: "Apagar" },
];

const UNIT: Partial<Record<Kind, string>> = { resistor: "Ω", lampada: "Ω", bateria: "V", capacitor: "F", indutor: "H" };

const snap = (x: number, y: number): Pt => [Math.max(0, Math.min(W, Math.round(x))), Math.max(0, Math.min(H, Math.round(y)))];

const first = (s: CircuitState, kind: Kind) => s.comps.find((c) => c.kind === kind);

function withSelected(s: CircuitState, fn: (c: Comp) => Comp): CircuitState {
  if (s.selected === null) return s;
  return { ...s, comps: s.comps.map((c) => (c.id === s.selected ? fn(c) : c)) };
}

const toolActions: SimAction<CircuitState>[] = TOOLS.map(({ tool, label }) => ({
  id: `tool-${tool}`,
  label,
  run: (s) => ({ ...s, tool, drag: null }),
  active: (s) => s.tool === tool,
}));

export const circuitosDc = defineSim<CircuitState>({
  id: "circuitos-dc",
  title: "Construtor de circuitos",
  course: "FG III",
  topic: "Circuitos DC",
  priority: "P1",
  summary:
    "Monte circuitos na bancada com baterias, resistores, lâmpadas, chaves, capacitores, indutores, diodos e instrumentos. Correntes e tensões vêm de um solver nodal (MNA) a cada passo.",
  derivation,
  equations: [
    String.raw`\sum_k I_k = 0 \quad \text{(nós)} \qquad \sum_k \Delta V_k = 0 \quad \text{(malhas)}`,
    String.raw`V = R\,I \qquad P = V I = R I^2`,
    String.raw`V_{\text{terminal}} = \varepsilon - r\,I`,
  ],
  liveEquations(s) {
    const bat = first(s, "bateria");
    if (!bat) return [];
    const P = s.comps.filter((c) => c.kind === "bateria").reduce((acc, c) => acc - c.v * c.i, 0);
    return [String.raw`I_{\text{bateria}} = \text{${si(-bat.i, "A")}} \qquad P_{\text{fornecida}} = \text{${si(P, "W")}}`];
  },

  params: [
    {
      key: "montagem",
      label: "Montagem",
      unit: "",
      min: 0,
      max: PRESETS.length - 1,
      step: 1,
      default: 1,
      options: PRESETS.map((p, i) => ({ value: i, label: p.label })),
    },
    { key: "rInterna", label: "Resistência interna das baterias", unit: "Ω", min: 0.001, max: 10, step: 0.001, default: 0.1, log: true, live: true },
  ],

  observables: [
    { key: "Ibat", label: "Corrente da bateria", unit: "A", value: (s) => -(first(s, "bateria")?.i ?? 0) },
    { key: "Vbat", label: "Tensão terminal da bateria", unit: "V", value: (s) => first(s, "bateria")?.v ?? 0 },
    {
      key: "P",
      label: "Potência fornecida",
      unit: "W",
      value: (s) => s.comps.filter((c) => c.kind === "bateria").reduce((acc, c) => acc - c.v * c.i, 0),
    },
    { key: "A1", label: "Amperímetro", unit: "A", value: (s) => first(s, "amperimetro")?.i ?? 0 },
    { key: "V1", label: "Voltímetro", unit: "V", value: (s) => first(s, "voltimetro")?.v ?? 0 },
    { key: "Vc", label: "Tensão no capacitor", unit: "V", value: (s) => first(s, "capacitor")?.v ?? 0 },
    {
      key: "Isel",
      label: "Corrente no selecionado",
      unit: "A",
      value: (s) => Math.abs(s.comps.find((c) => c.id === s.selected)?.i ?? 0),
    },
    {
      key: "Vsel",
      label: "Tensão no selecionado",
      unit: "V",
      value: (s) => Math.abs(s.comps.find((c) => c.id === s.selected)?.v ?? 0),
    },
  ],
  chart: { x: "t", y: "Ibat" },

  scenarios: [
    {
      id: "serie",
      label: "Resistores em série",
      params: { montagem: 1 },
      guide: `### Série
1. Compare a leitura do amperímetro com $\\varepsilon/(R_1+R_2+R_3)$.
2. Selecione cada resistor e veja a tensão nele. A soma das tensões dá a da bateria?
3. Aumente a **resistência interna** e observe a tensão terminal cair.`,
      predict: [
        {
          question: "Se você trocar o resistor de 100 Ω por um de 1 kΩ, a corrente no circuito:",
          options: ["aumenta", "diminui", "não muda"],
          answer: 1,
          explanation: "Em série a resistência equivalente é a soma; ela cresce e a corrente $I = \\varepsilon / R_{eq}$ cai.",
        },
      ],
    },
    {
      id: "paralelo",
      label: "Resistores em paralelo",
      params: { montagem: 2 },
      guide: `### Paralelo
1. Selecione cada resistor: a tensão é a mesma em todos?
2. Some as correntes dos ramos e compare com o amperímetro (lei dos nós).
3. Apague um ramo. O que acontece com a corrente total?`,
      predict: [
        {
          question: "Ao acrescentar mais um resistor em paralelo, a corrente que sai da bateria:",
          options: ["aumenta", "diminui", "não muda"],
          answer: 0,
          explanation: "Cada ramo novo é um caminho a mais: $1/R_{eq}$ cresce, $R_{eq}$ cai e a corrente total sobe.",
        },
      ],
    },
    {
      id: "lampadas",
      label: "Lâmpadas: série × paralelo",
      params: { montagem: 3 },
      guide: `### Qual brilha mais?
As lâmpadas são iguais e as baterias também. O brilho é proporcional à potência $P = RI^2$.
1. Compare o brilho do lado em série com o lado em paralelo.
2. Selecione uma lâmpada de cada lado e compare as correntes.`,
      predict: [
        {
          question: "Qual par de lâmpadas brilha mais?",
          options: ["As em série", "As em paralelo", "Brilham igual"],
          answer: 1,
          explanation: "Em paralelo cada lâmpada recebe a tensão total da bateria; em série dividem a tensão, e $P = V^2/R$ cai a um quarto.",
        },
      ],
    },
    {
      id: "wheatstone",
      label: "Ponte de Wheatstone",
      params: { montagem: 4 },
      guide: `### Equilibrar a ponte
A ponte está equilibrada quando o amperímetro do meio marca zero, isto é, quando $R_1/R_2 = R_3/R_4$.
1. Selecione o resistor de 330 Ω e ajuste com os botões de valor até zerar o amperímetro.
2. Use a condição de equilíbrio para prever o valor antes de ajustar.`,
    },
    {
      id: "kirchhoff",
      label: "Kirchhoff: duas fontes",
      params: { montagem: 5 },
      guide: `### Leis de Kirchhoff
1. Escreva as equações de malha para este circuito e resolva para as correntes.
2. Compare com o amperímetro e com as correntes de cada resistor (botão Selecionar).
3. Inverta a bateria de 6 V (Selecionar → Inverter) e refaça a previsão.`,
    },
    {
      id: "rc",
      label: "Circuito RC com chave",
      params: { montagem: 6 },
      guide: `### Carga do capacitor
1. Clique em **Iniciar**, escolha **Selecionar** e clique na chave para fechá-la.
2. No gráfico, plote **Tensão no capacitor** contra **t**. Em $t = RC$ ela deve valer $63\\%$ da final.
3. Abra a chave e troque a bateria por um fio para ver a descarga.`,
    },
    {
      id: "diodo",
      label: "Diodo",
      params: { montagem: 7 },
      guide: `### Diodo
1. Note a queda de cerca de 0,6 V no diodo (Selecionar → diodo).
2. Inverta o diodo: a corrente cai a quase zero.
3. Varie a bateria e observe que a tensão no diodo quase não muda.`,
    },
    {
      id: "livre",
      label: "Bancada livre",
      params: { montagem: 0 },
      guide: `### Bancada livre
Escolha uma ferramenta e arraste de um ponto da grade a outro para colocar o componente.
Use **Selecionar** para ver correntes e tensões, fechar chaves e mudar valores.`,
    },
  ],

  exercises: [
    {
      id: "serie",
      prompt: "Uma bateria ideal de {eps} V alimenta três resistores em série de {r1} Ω, {r2} Ω e {r3} Ω. Qual é a corrente no circuito?",
      vary: { eps: [3, 24, 1], r1: [10, 500, 0], r2: [10, 500, 0], r3: [10, 500, 0] },
      answer: { label: "I", unit: "A", compute: (p) => (p.eps ?? 0) / ((p.r1 ?? 1) + (p.r2 ?? 0) + (p.r3 ?? 0)) },
      hint: "Em série, R_eq = R₁ + R₂ + R₃.",
    },
    {
      id: "paralelo",
      prompt: "Dois resistores de {r1} Ω e {r2} Ω estão em paralelo com uma bateria ideal de {eps} V. Qual é a corrente total fornecida?",
      vary: { eps: [3, 24, 1], r1: [10, 1000, 0], r2: [10, 1000, 0] },
      answer: { label: "I", unit: "A", compute: (p) => (p.eps ?? 0) * (1 / (p.r1 ?? 1) + 1 / (p.r2 ?? 1)) },
      hint: "Em paralelo, 1/R_eq = 1/R₁ + 1/R₂.",
    },
    {
      id: "rc",
      prompt: "Um capacitor de {c} mF carrega por um resistor de {r} Ω ligado a uma fonte. Quanto tempo leva para atingir 63% da tensão final?",
      vary: { c: [0.1, 5, 1], r: [100, 5000, 0] },
      answer: { label: "τ", unit: "s", compute: (p) => ((p.c ?? 0) / 1000) * (p.r ?? 0) },
      hint: "A constante de tempo é τ = RC.",
    },
  ],

  init(p) {
    const preset = PRESETS[Math.round(p.montagem ?? 0)] ?? PRESETS[0]!;
    return solveStep(preset.build(), p, 1e-3, false);
  },

  step(s, p, _t, dt) {
    return solveStep(s, p, dt, true);
  },
  dt: 1e-3,
  sampleEvery: 20,
  maxSamples: 3000,

  viewport: () => ({ xMin: -0.6, xMax: W + 0.6, yMin: -0.6, yMax: H + 0.6 }),

  pointer: {
    down(s, p, pt) {
      const g = snap(pt.x, pt.y);
      if (s.tool === "selecionar") {
        const hit = nearest(s, pt.x, pt.y);
        if (!hit) return { ...s, selected: null };
        let comps = s.comps;
        if (hit.kind === "chave" && s.selected === hit.id) comps = comps.map((c) => (c.id === hit.id ? { ...c, closed: !c.closed } : c));
        return solveStep({ ...s, comps, selected: hit.id }, p, 1e-3, false);
      }
      if (s.tool === "apagar") {
        const hit = nearest(s, pt.x, pt.y);
        if (!hit) return undefined;
        return solveStep({ ...s, comps: s.comps.filter((c) => c.id !== hit.id), selected: null }, p, 1e-3, false);
      }
      return { ...s, drag: { from: g, to: g } };
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const [fx, fy] = s.drag.from;
      const g = snap(pt.x, pt.y);
      // Componentes sempre na horizontal ou na vertical.
      const to: Pt = Math.abs(g[0] - fx) >= Math.abs(g[1] - fy) ? [g[0], fy] : [fx, g[1]];
      if (to[0] === s.drag.to[0] && to[1] === s.drag.to[1]) return undefined;
      return { ...s, drag: { from: s.drag.from, to } };
    },
    up(s, p) {
      if (!s.drag) return undefined;
      const { from, to } = s.drag;
      if (from[0] === to[0] && from[1] === to[1]) return { ...s, drag: null };
      const kind = s.tool as Kind;
      const comps = s.comps.filter((c) => !sameSegment(c, from, to));
      const comp = makeComp(s.nextId, kind, kind === "bateria" ? to : from, kind === "bateria" ? from : to);
      return solveStep({ ...s, comps: [...comps, comp], drag: null, nextId: s.nextId + 1, selected: comp.id }, p, 1e-3, false);
    },
    cursor(s, _p, pt) {
      if (s.tool === "selecionar" || s.tool === "apagar") return nearest(s, pt.x, pt.y) ? "pointer" : undefined;
      return "crosshair";
    },
  },

  actions: [
    ...toolActions,
    {
      id: "mais",
      label: "Valor +",
      run: (s) => withSelected(s, (c) => (UNIT[c.kind] ? { ...c, value: stepValue(c.kind, c.value, 1) } : c)),
    },
    {
      id: "menos",
      label: "Valor −",
      run: (s) => withSelected(s, (c) => (UNIT[c.kind] ? { ...c, value: stepValue(c.kind, c.value, -1) } : c)),
    },
    {
      id: "inverter",
      label: "Inverter",
      run: (s) => withSelected(s, (c) => ({ ...c, a: c.b, b: c.a, i: -c.i, v: -c.v })),
    },
    {
      id: "chave",
      label: "Abrir/fechar chave",
      run: (s) => withSelected(s, (c) => (c.kind === "chave" ? { ...c, closed: !c.closed } : c)),
    },
    {
      id: "limpar",
      label: "Limpar bancada",
      run: (s) => ({ ...s, comps: [], selected: null, drag: null, warning: "" }),
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, theme } = frame;

    // Pontos da grade
    for (let x = 0; x <= W; x++) for (let y = 0; y <= H; y++) d.dot(x, y, 1.6, theme.muted, 0.45);

    for (const c of s.comps) drawComp(d, theme, c, c.id === s.selected);

    // Nós com mais de duas ligações ganham um ponto de junção
    const count = new Map<string, number>();
    for (const c of s.comps) for (const p of [c.a, c.b]) count.set(`${p[0]},${p[1]}`, (count.get(`${p[0]},${p[1]}`) ?? 0) + 1);
    for (const [k, n] of count) {
      const [x, y] = k.split(",").map(Number) as [number, number];
      if (n >= 3) d.dot(x, y, 4, theme.text);
      else d.dot(x, y, 2.5, theme.text, 0.8);
    }

    if (s.drag) {
      const { from, to } = s.drag;
      d.line(from[0], from[1], to[0], to[1], { color: theme.accent, width: 3, dash: [6, 4] });
      d.dot(from[0], from[1], 5, theme.accent);
    }

    if (s.warning) d.text(s.warning, W / 2, H + 0.25, { color: theme.positive, weight: "600", size: 13 });
    else d.text(`Ferramenta: ${TOOLS.find((t) => t.tool === s.tool)?.label ?? ""}`, 0, H + 0.3, { color: theme.muted, align: "left", size: 12 });
  },
});

function nearest(s: CircuitState, x: number, y: number): Comp | undefined {
  let best: Comp | undefined;
  let bd = 0.3;
  for (const c of s.comps) {
    const dd = distToComp(c, x, y);
    if (dd < bd) {
      bd = dd;
      best = c;
    }
  }
  return best;
}

function drawComp(d: Draw, theme: Theme, c: Comp, selected: boolean) {
  const [ax, ay] = c.a;
  const [bx, by] = c.b;
  const len = Math.hypot(bx - ax, by - ay);
  const ux = (bx - ax) / len;
  const uy = (by - ay) / len;
  const nx = -uy;
  const ny = ux;
  const mx = (ax + bx) / 2;
  const my = (ay + by) / 2;
  const color = selected ? theme.accent : theme.text;
  const w = selected ? 3 : 2;
  const half = Math.min(0.45, len / 2); // meio-comprimento do símbolo
  const P = (t: number, n = 0): [number, number] => [mx + ux * t + nx * n, my + uy * t + ny * n];
  const lead = (h: number) => {
    d.line(ax, ay, ...P(-h), { color, width: w });
    d.line(...P(h), bx, by, { color, width: w });
  };

  switch (c.kind) {
    case "fio":
      d.line(ax, ay, bx, by, { color, width: w });
      break;
    case "resistor": {
      lead(half);
      const pts: [number, number][] = [P(-half)];
      for (let k = 1; k < 8; k++) pts.push(P(-half + (2 * half * k) / 8, k % 2 ? 0.14 : -0.14));
      pts.push(P(half));
      d.polyline(pts, { color, width: w });
      break;
    }
    case "lampada": {
      const r = 0.28;
      lead(r);
      const P_ = Math.abs(c.v * c.i);
      const glow = Math.min(1, P_ / 6);
      if (glow > 0.01) d.circle(mx, my, r * (1 + 1.4 * glow), { fill: "#ffd54a", alpha: 0.25 + 0.5 * glow });
      d.circle(mx, my, r, { fill: glow > 0.01 ? `rgba(255, 213, 74, ${0.3 + 0.7 * glow})` : "transparent", stroke: color, width: w });
      const k = r * 0.7;
      d.line(mx - k, my - k, mx + k, my + k, { color, width: 1.5 });
      d.line(mx - k, my + k, mx + k, my - k, { color, width: 1.5 });
      break;
    }
    case "bateria": {
      lead(0.08);
      // Placa longa no terminal positivo (a), curta no negativo (b)
      d.line(...P(-0.08, -0.32), ...P(-0.08, 0.32), { color, width: 3 });
      d.line(...P(0.08, -0.18), ...P(0.08, 0.18), { color, width: 5 });
      d.text("+", ...P(-0.3, 0.32), { color: theme.positive, weight: "700", size: 14 });
      break;
    }
    case "chave": {
      lead(half);
      d.dot(...P(-half), 3, color);
      d.dot(...P(half), 3, color);
      const end = c.closed ? P(half) : P(half * 0.8, 0.45);
      d.line(...P(-half), ...end, { color, width: w + 0.5 });
      break;
    }
    case "capacitor": {
      lead(0.07);
      d.line(...P(-0.07, -0.3), ...P(-0.07, 0.3), { color, width: 3 });
      d.line(...P(0.07, -0.3), ...P(0.07, 0.3), { color, width: 3 });
      break;
    }
    case "indutor": {
      lead(half);
      const pts: [number, number][] = [];
      const loops = 4;
      for (let k = 0; k <= 64; k++) {
        const t = k / 64;
        const ang = Math.PI * loops * t;
        pts.push(P(-half + 2 * half * t, 0.16 * Math.abs(Math.sin(ang))));
      }
      d.polyline(pts, { color, width: w });
      break;
    }
    case "diodo": {
      lead(0.18);
      d.polyline([P(-0.18, -0.2), P(-0.18, 0.2), P(0.18, 0)], { color, width: w, close: true, fill: color });
      d.line(...P(0.18, -0.2), ...P(0.18, 0.2), { color, width: 3 });
      break;
    }
    case "amperimetro":
    case "voltimetro": {
      const r = 0.26;
      lead(r);
      d.circle(mx, my, r, { fill: theme.dark ? "#1a2029" : "#ffffff", stroke: color, width: w });
      d.text(c.kind === "amperimetro" ? "A" : "V", mx, my, { color, weight: "700", size: 14 });
      const reading = c.kind === "amperimetro" ? si(c.i, "A") : si(c.v, "V");
      d.text(reading, ...P(0, 0.55), { color: theme.accent, weight: "600", size: 12 });
      break;
    }
  }

  // Valor do componente
  const unit = UNIT[c.kind];
  if (unit) d.text(si(c.value, unit), ...P(0, -0.42), { color: theme.muted, size: 11 });

  // Cargas em movimento (sentido convencional), espaçadas de 0,25 unidade
  if (Math.abs(c.i) > 1e-7) {
    const spacing = 0.25;
    for (let s = ((c.phase % spacing) + spacing) % spacing; s < len; s += spacing) {
      d.dot(ax + ux * s, ay + uy * s, 2.4, theme.series[1]!, 0.9);
    }
  }
}

export default circuitosDc;
