import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";
import {
  MU0,
  blobPath,
  circlePath,
  distToPath,
  enclosedCurrent,
  fieldAt,
  forcePerLength,
  lineIntegral,
  perimeter,
  pointAt,
  squarePath,
  winding,
  type Pt,
  type Wire,
} from "./physics.ts";

export * from "./physics.ts";

export interface AmpState {
  wires: Wire[];
  /** Caminho amperiano fechado (cm), percorrido na ordem dos vértices. */
  path: Pt[];
  /** Fração do perímetro já percorrida pelo marcador (0 a 1). */
  u: number;
  /** Arraste: índice do fio, −2 caminho inteiro, −3 desenhando, −1 nada. */
  drag: number;
  grab: Pt;
}

/** Tempo de uma volta do marcador (s). */
export const T_LAP = 6;
const VP = { xMin: -12, xMax: 12, yMin: -9, yMax: 8.8 };

const pathKind = (p: Params) => Math.round(num(p, "caminho"));
/** Montagens dos dois fios paralelos, em que o palco mostra a força entre eles. */
const showForces = (p: Params) => Math.round(num(p, "montagem")) >= 4;
/** Força por comprimento (N/m) sobre o fio 1 (componente x: positiva = para a direita, rumo ao fio 2). */
const f1x = (s: AmpState) => forcePerLength(s.wires, 0)[0];

export function makePath(p: Params, cx = 0, cy = 0): Pt[] {
  const R = num(p, "R", 4);
  switch (pathKind(p)) {
    case 1:
      return squarePath(cx, cy, R);
    case 2:
      return blobPath(cx, cy, R);
    default:
      return circlePath(cx, cy, R);
  }
}

export function makeWires(p: Params): Wire[] {
  const I = num(p, "I", 5);
  switch (Math.round(num(p, "montagem"))) {
    case 1:
      return [{ x: 8, y: 2, I }];
    case 2:
      return [
        { x: -1.5, y: 0.5, I },
        { x: 1.5, y: -0.5, I: -I },
        { x: 8.5, y: -4, I },
      ];
    case 3:
      return [
        { x: -2, y: 1, I },
        { x: 2, y: -1.5, I },
        { x: 7, y: 4, I: -I },
      ];
    case 4:
      return [
        { x: -2, y: 0, I },
        { x: 2, y: 0, I },
      ];
    case 5:
      return [
        { x: -2, y: 0, I },
        { x: 2, y: 0, I: -I },
      ];
    default:
      return [{ x: 0, y: 0, I }];
  }
}

const circ = (s: AmpState) => lineIntegral(s.path, s.wires);
const ienc = (s: AmpState) => enclosedCurrent(s.path, s.wires);
const onPath = (s: AmpState) => s.wires.some((w) => distToPath(s.path, w.x, w.y) < 0.25);

function fmt(v: number, unit: string): string {
  if (Math.abs(v) < 1e-12) return `0 ${unit}`;
  const e = Math.floor(Math.log10(Math.abs(v)) / 3) * 3;
  const pre: Record<number, string> = { [-9]: "n", [-6]: "μ", [-3]: "m", 0: "" };
  const k = pre[e] !== undefined ? e : Math.abs(v) < 1e-9 ? -9 : 0;
  return `${Number((v / 10 ** k).toPrecision(3)).toString().replace(".", ",")} ${pre[k]}${unit}`;
}

const nearestWire = (s: AmpState, x: number, y: number) => {
  let best = -1;
  let bd = 0.7;
  s.wires.forEach((w, i) => {
    const d = Math.hypot(w.x - x, w.y - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
};

function insideOrNear(s: AmpState, x: number, y: number) {
  return winding(s.path, x, y) !== 0 || distToPath(s.path, x, y) < 0.5;
}

const clampX = (x: number) => Math.max(VP.xMin + 0.4, Math.min(VP.xMax - 0.4, x));
const clampY = (y: number) => Math.max(VP.yMin + 1.2, Math.min(7.6, y));

function addWire(s: AmpState, I: number): AmpState {
  // Primeira posição livre numa fila no canto inferior esquerdo
  for (let k = 0; k < 30; k++) {
    const x = -10.5 + (k % 10) * 1.6;
    const y = -6.8 + Math.floor(k / 10) * 1.6;
    if (s.wires.every((w) => Math.hypot(w.x - x, w.y - y) > 1)) return { ...s, wires: [...s.wires, { x, y, I }], u: 0 };
  }
  return s;
}

export const ampere = defineSim<AmpState>({
  id: "ampere",
  title: "Lei de Ampère: circulação de B",
  course: "FG III",
  topic: "Ampère",
  priority: "P1",
  summary:
    "Arraste fios com correntes saindo ou entrando da tela e desenhe um caminho amperiano qualquer. A circulação ∮B·dl é integrada numericamente ao longo do caminho e comparada com μ₀ I_env.",
  equations: [
    String.raw`\oint_C \vec B \cdot d\vec\ell = \mu_0\, I_{\text{env}}`,
    String.raw`\text{fio longo: } \vec B = \frac{\mu_0 I}{2\pi r}\,\hat\varphi \quad\Rightarrow\quad \vec B\cdot d\vec\ell = \frac{\mu_0 I}{2\pi}\,d\varphi`,
    String.raw`I_{\text{env}} = \sum_k n_k I_k \quad (n_k = \text{voltas do caminho em torno do fio } k)`,
  ],
  liveEquations(s) {
    const c = circ(s);
    const I = ienc(s);
    const part = lineIntegral(s.path, s.wires, s.u);
    return [
      String.raw`\oint \vec B\cdot d\vec\ell \;(\text{numérico}) = ${texNum(c, 4)}\ \text{T·m} \qquad \mu_0 I_{\text{env}} = \mu_0 \cdot (${texNum(I)}\ \text{A}) = ${texNum(MU0 * I, 4)}\ \text{T·m}`,
      String.raw`\int_0^{${texNum(s.u * perimeter(s.path))}\,\text{cm}} \vec B\cdot d\vec\ell = ${texNum(part)}\ \text{T·m}`,
      ...(onPath(s) ? [String.raw`\text{Atenção: um fio está sobre o caminho; } I_{\text{env}} \text{ fica indefinida.}`] : []),
    ];
  },

  params: [
    {
      key: "caminho",
      label: "Caminho amperiano",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Círculo" },
        { value: 1, label: "Quadrado" },
        { value: 2, label: "Desenho livre" },
      ],
    },
    {
      key: "montagem",
      label: "Fios iniciais",
      unit: "",
      min: 0,
      max: 5,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Um fio no centro" },
        { value: 1, label: "Um fio fora do caminho" },
        { value: 2, label: "Par de correntes opostas + um fio fora" },
        { value: 3, label: "Três fios" },
        { value: 4, label: "Dois fios paralelos (mesmo sentido): forças" },
        { value: 5, label: "Dois fios paralelos (sentidos opostos): forças" },
      ],
    },
    { key: "R", label: "Tamanho do caminho (raio ou meio-lado)", unit: "cm", min: 1, max: 7, step: 0.1, default: 4 },
    { key: "I", label: "Corrente de cada fio", unit: "A", min: 0.5, max: 20, step: 0.5, default: 5 },
  ],

  observables: [
    { key: "parcial", label: "∫B·dl até o marcador", unit: "T·m", value: (s) => lineIntegral(s.path, s.wires, s.u) },
    { key: "circ", label: "∮B·dl (numérico)", unit: "T·m", value: (s) => circ(s) },
    { key: "mu0I", label: "μ₀ I_env", unit: "T·m", value: (s) => MU0 * ienc(s) },
    { key: "Ienc", label: "Corrente envolvida I_env", unit: "A", value: (s) => ienc(s) },
    {
      key: "Bt",
      label: "B tangente no marcador",
      unit: "T",
      value: (s) => {
        const { p, t } = pointAt(s.path, s.u);
        const B = fieldAt(s.wires, p[0], p[1]);
        return B[0] * t[0] + B[1] * t[1];
      },
    },
    { key: "F1", label: "Força por comprimento no fio 1 (x; + = rumo ao fio 2)", unit: "N/m", value: (s) => f1x(s) },
    {
      key: "d12",
      label: "Distância entre os fios 1 e 2",
      unit: "cm",
      value: (s) => (s.wires.length >= 2 ? Math.hypot(s.wires[0]!.x - s.wires[1]!.x, s.wires[0]!.y - s.wires[1]!.y) : 0),
    },
  ],
  chart: { x: "t", y: "parcial" },

  scenarios: [
    {
      id: "um-fio",
      label: "Um fio no centro",
      params: { caminho: 0, montagem: 0, R: 4, I: 5 },
      guide: `### Circulação em torno de um fio
1. Rode: o marcador percorre o caminho e o gráfico mostra $\\int \\vec B\\cdot d\\vec\\ell$ acumulada. Ao fim da volta ela vale $\\mu_0 I$.
2. Aumente o raio. $B$ diminui como $1/r$, mas o perímetro cresce como $r$: a circulação não muda.
3. Arraste o fio para fora do centro (ainda dentro do círculo). O integrando muda ponto a ponto, mas o total continua $\\mu_0 I$.
4. Troque para **Quadrado**: o resultado depende da forma?`,
      predict: [
        {
          question: "Se o raio do círculo amperiano dobrar (o fio continua dentro), a circulação ∮B·dl:",
          options: ["cai à metade", "dobra", "não muda", "cai a um quarto"],
          answer: 2,
          explanation: "$B = \\mu_0 I/(2\\pi r)$ cai à metade, mas o comprimento $2\\pi r$ dobra. O produto é sempre $\\mu_0 I$.",
        },
      ],
    },
    {
      id: "fora",
      label: "Fio fora do caminho",
      params: { caminho: 0, montagem: 1, R: 4, I: 5 },
      guide: `### Campo não nulo, circulação nula
1. O fio está fora do círculo, e $B$ **não** é zero sobre o caminho (veja as setas e o marcador).
2. Rode e observe o gráfico: a integral sobe num trecho e desce no outro, terminando em zero.
3. Arraste o fio para dentro do caminho, cruzando a borda: a circulação salta para $\\mu_0 I$.`,
      predict: [
        {
          question: "Com o fio fora do caminho, ∮B·dl = 0. Isso significa que B = 0 em todo o caminho?",
          options: ["Sim, B é zero no caminho", "Não: as contribuições positivas e negativas se cancelam", "Depende do formato do caminho"],
          answer: 1,
          explanation: "$\\vec B$ é diferente de zero, mas no lado próximo ao fio $\\vec B\\cdot d\\vec\\ell$ tem um sinal e no lado distante tem o outro. Em ângulo, o caminho \"vai e volta\" sem dar a volta no fio.",
        },
      ],
    },
    {
      id: "opostas",
      label: "Correntes opostas",
      params: { caminho: 1, montagem: 2, R: 4, I: 5 },
      guide: `### Somando correntes com sinal
1. Dentro do quadrado há uma corrente saindo (⊙) e outra entrando (⊗): $I_{\\text{env}} = 0$.
2. Leve o fio de fora para dentro. Qual o novo valor de $\\oint \\vec B\\cdot d\\vec\\ell$?
3. Use **Inverter sentido** no caminho e veja o sinal da circulação trocar.`,
    },
    {
      id: "desenho",
      label: "Desenhe o caminho",
      params: { caminho: 2, montagem: 3, R: 4, I: 5 },
      guide: `### Qualquer caminho fechado
1. Arraste num espaço vazio do palco para desenhar um caminho fechado (ele fecha sozinho ao soltar). O sentido do desenho é o sentido de $d\\vec\\ell$.
2. Desenhe um caminho que envolva só um dos fios, depois dois. Compare com $\\mu_0 I_{\\text{env}}$.
3. Desenhe um laço que dê **duas voltas** em torno de um fio: a circulação dobra.
4. Arraste os fios: enquanto nenhum cruza o caminho, o valor não muda.`,
      predict: [
        {
          question: "Um caminho em forma de \"8\" envolve um fio ⊙ em cada laço; um laço é percorrido no sentido anti-horário e o outro no horário. A circulação é:",
          options: ["2 μ₀ I", "zero", "μ₀ I", "−2 μ₀ I"],
          answer: 1,
          explanation: "Cada fio entra com o sinal do sentido do laço que o envolve: $+\\mu_0 I - \\mu_0 I = 0$.",
        },
      ],
    },
    {
      id: "dois-fios",
      label: "Força entre dois fios paralelos",
      params: { caminho: 0, montagem: 4, R: 1.5, I: 10 },
      guide: `### Um fio no campo do outro
1. Dois fios longos e paralelos, separados por $d = 4\\ \\text{cm}$, com $I = 10\\ \\text{A}$ saindo da tela nos dois. O círculo amperiano em torno do fio 1 lembra que ele cria $B_1 = \\mu_0 I_1/(2\\pi r)$ ao redor.
2. No lugar do fio 2, esse campo é perpendicular ao fio, e a força por comprimento é $\\vec F/L = I_2\\,\\hat z \\times \\vec B_1$:
$$\\frac{F}{L} = \\frac{\\mu_0 I_1 I_2}{2\\pi d}$$
Confira: $2\\times10^{-7} \\times 100/0{,}04 = 5\\times10^{-4}\\ \\text{N/m}$ (setas roxas).
3. As duas forças têm o mesmo módulo e sentidos opostos (terceira lei). Correntes no **mesmo sentido se atraem**.
4. Clique em **Inverter correntes**: nada muda (os dois sinais trocam). Agora troque a montagem para sentidos opostos: os fios se repelem.
5. Arraste o fio 2 para longe: $F/L$ cai como $1/d$ (veja o observável). Foi assim que o ampère foi definido até 2019: $2\\times10^{-7}\\ \\text{N/m}$ entre fios a 1 m com 1 A.`,
      predict: [
        {
          question: "Dois fios paralelos levam correntes no mesmo sentido. Eles:",
          options: ["se atraem", "se repelem", "não exercem força um no outro", "giram um em torno do outro"],
          answer: 0,
          explanation: "O campo do fio 1 no fio 2 é perpendicular à ligação entre eles; $I_2\\hat z \\times \\vec B_1$ aponta para o fio 1. Ao contrário das cargas, correntes de mesmo sentido se atraem.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "soma",
      prompt: "Um caminho circular, percorrido no sentido anti-horário, envolve um fio com {I1} A saindo da tela e outro com {I2} A entrando. Quanto vale ∮B·dl?",
      vary: { I1: [1, 20, 1], I2: [1, 20, 1] },
      answer: { label: "∮B·dl", unit: "μT·m", compute: (p) => MU0 * (num(p, "I1") - num(p, "I2")) * 1e6 },
      hint: "Corrente saindo da tela conta positiva para o sentido anti-horário (regra da mão direita).",
      tolerance: 0.03,
    },
    {
      id: "condutor",
      prompt: "Um condutor cilíndrico longo de raio {a} mm transporta {I} A distribuídos uniformemente na seção. Qual é B a {r} mm do eixo (dentro do condutor)?",
      vary: { a: [5, 10, 1], I: [1, 50, 0], r: [1, 4, 1] },
      answer: { label: "B", unit: "mT", compute: (p) => ((MU0 * num(p, "I") * (num(p, "r") / 1000)) / (2 * Math.PI * (num(p, "a", 1) / 1000) ** 2)) * 1e3 },
      hint: "A corrente envolvida por um círculo de raio r é I r²/a².",
    },
  ],

  init(p) {
    const m = Math.round(num(p, "montagem"));
    return { wires: makeWires(p), path: makePath(p, m === 1 ? -1 : m >= 4 ? -2 : 0, 0), u: 0, drag: -1, grab: [0, 0] };
  },
  step(s, _p, _t, dt) {
    return { ...s, u: (s.u + dt / T_LAP) % 1 };
  },
  dt: 0.01,
  sampleEvery: 2,

  pointer: {
    down(s, p, pt) {
      const i = nearestWire(s, pt.x, pt.y);
      if (i >= 0) return { ...s, drag: i };
      if (pathKind(p) === 2 && !(distToPath(s.path, pt.x, pt.y) < 0.5)) return { ...s, drag: -3, path: [[clampX(pt.x), clampY(pt.y)]], u: 0 };
      if (insideOrNear(s, pt.x, pt.y)) return { ...s, drag: -2, grab: [pt.x, pt.y] };
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || s.drag === -1) return undefined;
      const x = clampX(pt.x), y = clampY(pt.y);
      if (s.drag >= 0) return { ...s, wires: s.wires.map((w, k) => (k === s.drag ? { ...w, x, y } : w)) };
      if (s.drag === -2) {
        const dx = pt.x - s.grab[0], dy = pt.y - s.grab[1];
        return { ...s, path: s.path.map(([a, b]) => [a + dx, b + dy] as Pt), grab: [pt.x, pt.y] };
      }
      const last = s.path[s.path.length - 1]!;
      if (Math.hypot(x - last[0], y - last[1]) < 0.35 || s.path.length >= 600) return undefined;
      return { ...s, path: [...s.path, [x, y]] };
    },
    up(s) {
      if (s.drag === -1) return undefined;
      if (s.drag === -3 && s.path.length < 4) return { ...s, drag: -1, path: blobPath(0, 0, 4), u: 0 };
      return { ...s, drag: -1, u: s.drag === -3 ? 0 : s.u };
    },
    cursor(s, p, pt) {
      if (nearestWire(s, pt.x, pt.y) >= 0) return "grab";
      if (pathKind(p) === 2) return "crosshair";
      return insideOrNear(s, pt.x, pt.y) ? "move" : undefined;
    },
  },

  actions: [
    { id: "sai", label: "+ Fio saindo (⊙)", run: (s, p) => addWire(s, num(p, "I", 5)) },
    { id: "entra", label: "+ Fio entrando (⊗)", run: (s, p) => addWire(s, -num(p, "I", 5)) },
    { id: "remover", label: "Remover último fio", run: (s) => ({ ...s, wires: s.wires.slice(0, -1) }) },
    { id: "inverter-fios", label: "Inverter correntes", run: (s) => ({ ...s, wires: s.wires.map((w) => ({ ...w, I: -w.I })) }) },
    { id: "inverter-caminho", label: "Inverter sentido do caminho", run: (s) => ({ ...s, path: s.path.slice().reverse(), u: 0 }) },
  ],

  viewport: () => ({ ...VP, unit: "cm" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, theme } = frame;

    // Campo de fundo
    const grid: { x: number; y: number; B: Pt; m: number }[] = [];
    let max = 0;
    for (let x = -11; x <= 11; x += 1.25)
      for (let y = -7.25; y <= 7.5; y += 1.25) {
        const B = fieldAt(s.wires, x, y);
        const m = Math.hypot(B[0], B[1]);
        if (s.wires.every((w) => Math.hypot(w.x - x, w.y - y) > 0.6)) {
          grid.push({ x, y, B, m });
          max = Math.max(max, m);
        }
      }
    for (const g of grid) {
      if (max <= 0) break;
      const l = Math.max(0, Math.min(1, 1 + Math.log10(g.m / max) / 2));
      const len = (8 + 22 * l);
      d.arrowPx(g.x - (g.B[0] / g.m) * len * 0.5 * d.px, g.y - (g.B[1] / g.m) * len * 0.5 * d.px, g.B[0], g.B[1], len, { color: theme.accent, width: 1.2, head: 5, alpha: 0.2 + 0.5 * l });
    }

    // Caminho: trecho já percorrido colorido pelo sinal de B·dl
    const n = s.path.length;
    const P = perimeter(s.path);
    let walked = 0;
    for (let i = 0; i < n; i++) {
      const a = s.path[i]!, b = s.path[(i + 1) % n]!;
      const L = Math.hypot(b[0] - a[0], b[1] - a[1]);
      const mid: Pt = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
      const done = walked + L / 2 <= s.u * P;
      walked += L;
      if (s.drag === -3 && i === n - 1) continue; // ainda desenhando: não fecha
      if (!done) {
        d.line(a[0], a[1], b[0], b[1], { color: theme.muted, width: 2.5 });
        continue;
      }
      const B = fieldAt(s.wires, mid[0], mid[1]);
      const dot = L > 0 ? (B[0] * (b[0] - a[0]) + B[1] * (b[1] - a[1])) / L : 0;
      d.line(a[0], a[1], b[0], b[1], { color: dot >= 0 ? theme.series[2]! : theme.series[1]!, width: 4 });
    }
    // Setas de sentido
    if (s.drag !== -3)
      for (let k = 0; k < 8; k++) {
        const { p, t } = pointAt(s.path, (k + 0.5) / 8);
        d.arrowPx(p[0] - t[0] * 6 * d.px, p[1] - t[1] * 6 * d.px, t[0], t[1], 12, { color: theme.text, width: 2, head: 8 });
      }

    // Fios
    for (const w of s.wires) {
      const env = s.drag !== -3 && winding(s.path, w.x, w.y) !== 0;
      const col = w.I > 0 ? theme.positive : theme.negative;
      if (env) d.circle(w.x, w.y, 0.62, { stroke: theme.series[2]!, width: 2, dash: [3, 3] });
      d.circle(w.x, w.y, 0.42, { fill: theme.dark ? "#1a2029" : "#ffffff", stroke: col, width: 2.2 });
      if (w.I > 0) d.circle(w.x, w.y, 0.12, { fill: col });
      else {
        const k = 0.27;
        d.line(w.x - k, w.y - k, w.x + k, w.y + k, { color: col, width: 2.2 });
        d.line(w.x - k, w.y + k, w.x + k, w.y - k, { color: col, width: 2.2 });
      }
      d.text(`${w.I > 0 ? "+" : "−"}${Math.abs(w.I).toString().replace(".", ",")} A`, w.x, w.y - 0.8, { color: col, size: 11, weight: "600" });
    }

    // Marcador
    if (s.drag !== -3 && n > 2) {
      const { p, t } = pointAt(s.path, s.u);
      const B = fieldAt(s.wires, p[0], p[1]);
      d.arrowPx(p[0], p[1], B[0], B[1], 34, { color: theme.accent, width: 2.5 });
      d.arrowPx(p[0], p[1], t[0], t[1], 24, { color: theme.text, width: 1.5, dash: [3, 2] });
      d.dot(p[0], p[1], 5.5, theme.text);
      d.text("B", p[0] + (B[0] / (Math.hypot(B[0], B[1]) || 1)) * 44 * d.px, p[1] + (B[1] / (Math.hypot(B[0], B[1]) || 1)) * 44 * d.px, { color: theme.accent, weight: "700" });
    }

    // Força entre fios (montagens de fios paralelos)
    if (showForces(frame.params)) {
      const fs = s.wires.map((_, k) => forcePerLength(s.wires, k));
      const fmax = Math.max(...fs.map((f) => Math.hypot(f[0], f[1])), 1e-30);
      fs.forEach((f, k) => {
        const m = Math.hypot(f[0], f[1]);
        if (m < 1e-15) return;
        const w = s.wires[k]!;
        d.arrowPx(w.x + (f[0] / m) * 0.5, w.y + (f[1] / m) * 0.5, f[0], f[1], 20 + 50 * (m / fmax), { color: theme.series[3]!, width: 3.5, head: 11 });
        d.text(`F/L = ${fmt(m, "N/m")}`, w.x, w.y + 1.1, { color: theme.series[3]!, size: 11, weight: "600" });
      });
      if (s.wires.length >= 2) {
        const [a, b] = s.wires as [Wire, Wire];
        const dd = Math.hypot(a.x - b.x, a.y - b.y) / 100;
        d.text(
          `μ₀I₁I₂/(2πd) = ${fmt((MU0 * Math.abs(a.I * b.I)) / (2 * Math.PI * dd), "N/m")} com d = ${Number((dd * 100).toPrecision(3)).toString().replace(".", ",")} cm: ${a.I * b.I > 0 ? "correntes no mesmo sentido se atraem" : "correntes opostas se repelem"}`,
          VP.xMin + 0.3,
          VP.yMax - 1.3,
          { color: theme.series[3]!, size: 12, weight: "600", align: "left" },
        );
      }
    }

    // Placar
    const c = circ(s);
    const I = ienc(s);
    d.text(`∮B·dl = ${fmt(c, "T·m")}    μ₀I_env = ${fmt(MU0 * I, "T·m")}   (I_env = ${Number(I.toPrecision(4)).toString().replace(".", ",")} A)`, VP.xMin + 0.3, VP.yMax - 0.4, {
      color: theme.text,
      size: 13,
      weight: "600",
      align: "left",
    });
    const warn = onPath(s) ? "Fio sobre o caminho: I_env indefinida" : "";
    d.text(warn || "verde: B·dl > 0   laranja: B·dl < 0   tracejado: fio envolvido", VP.xMin + 0.3, VP.yMin + 0.4, {
      color: warn ? theme.positive : theme.muted,
      size: 11,
      align: "left",
    });
  },
});

export default ampere;
