import { defineSim, draw, num, texNum, type Params, type Theme } from "@fisilab/core";

/** Grade da cuba: NX × NY células de DX centímetros. */
export const NX = 160;
export const NY = 120;
export const DX = 0.2;
export const W = NX * DX;
export const H = NY * DX;
/** Largura (em células) da borda absorvente. */
const SW = 14;
/** Coluna da barreira (x = 12 cm) e da fonte de onda plana. */
export const XB = 12;
const IB = Math.round(XB / DX);
const IS = SW + 1;
const YC = H / 2;

export const ARRANJO = { uma: 0, duas: 1, fenda: 2, dupla: 3, plana: 4 } as const;
export const TOOL = { parede: 0, apagar: 1, mover: 2 } as const;

/** Amortecimento por célula: zero no interior, crescendo quadraticamente na borda. */
const SIG = (() => {
  const s = new Float32Array(NX * NY);
  for (let j = 0; j < NY; j++)
    for (let i = 0; i < NX; i++) {
      const dist = Math.min(i, j, NX - 1 - i, NY - 1 - j);
      const q = dist < SW ? (SW - dist) / SW : 0;
      s[j * NX + i] = 0.45 * q * q;
    }
  return s;
})();

export interface Cuba {
  tau: number;
  /** Elevação da água agora e no passo anterior (relativa à amplitude da fonte). */
  u: Float32Array;
  up: Float32Array;
  /** Média móvel de u² (intensidade). */
  avg: Float32Array;
  /** 1 onde há parede. */
  wall: Uint8Array;
  /** Fontes pontuais (cm). */
  src: [number, number][];
  probe: [number, number];
  tool: number;
  /** Arrastando: índice da fonte, 99 para a sonda, −1 nada. */
  drag: number;
  /** Último ponto pintado (para ligar o traço). */
  last: [number, number] | null;
}

export const lambda = (p: Params) => num(p, "c", 20) / num(p, "f", 8);
const idx = (i: number, j: number) => j * NX + i;
const cellOf = (x: number, y: number): [number, number] => [Math.round(x / DX), Math.round(y / DX)];

/** Centros das fendas da barreira (cm), quando há barreira. */
export function slitCenters(p: Params): number[] {
  const a = Math.round(num(p, "arranjo"));
  if (a === ARRANJO.fenda) return [YC];
  if (a === ARRANJO.dupla) return [YC - num(p, "d", 4) / 2, YC + num(p, "d", 4) / 2];
  return [];
}

function initialWalls(p: Params): Uint8Array {
  const wall = new Uint8Array(NX * NY);
  const centers = slitCenters(p);
  if (!centers.length) return wall;
  const a = num(p, "a", 2);
  for (let j = 0; j < NY; j++) {
    const y = j * DX;
    if (centers.some((c) => Math.abs(y - c) < a / 2)) continue;
    wall[idx(IB, j)] = 1;
    wall[idx(IB + 1, j)] = 1;
  }
  return wall;
}

function initialSources(p: Params): [number, number][] {
  const a = Math.round(num(p, "arranjo"));
  if (a === ARRANJO.uma) return [[8, YC]];
  if (a === ARRANJO.duas) return [[6, YC - num(p, "d", 4) / 2], [6, YC + num(p, "d", 4) / 2]];
  return [];
}

const CROSS: [number, number][] = [[0, 0], [1, 0], [-1, 0], [0, 1], [0, -1]];

const planeWave = (p: Params) => Math.round(num(p, "arranjo")) >= ARRANJO.fenda;

/** Avança a equação de onda 2D com `steps` passos internos de duração h. */
export function advance(s: Cuba, p: Params, steps: number, h: number): Cuba {
  const c = num(p, "c", 20);
  const C2 = ((c * h) / DX) ** 2;
  const w = 2 * Math.PI * num(p, "f", 8);
  const plane = planeWave(p);
  let u = Float32Array.from(s.u);
  let up = Float32Array.from(s.up);
  let un = new Float32Array(NX * NY);
  const avg = Float32Array.from(s.avg);
  const wall = s.wall;
  const kAvg = Math.min(1, h / 1.0);
  const srcCells = s.src.map(([x, y]) => cellOf(x, y));
  let tau = s.tau;
  for (let n = 0; n < steps; n++) {
    for (let j = 1; j < NY - 1; j++) {
      const row = j * NX;
      for (let i = 1; i < NX - 1; i++) {
        const k = row + i;
        if (wall[k]) {
          un[k] = 0;
          continue;
        }
        const lap = u[k - 1]! + u[k + 1]! + u[k - NX]! + u[k + NX]! - 4 * u[k]!;
        const sg = SIG[k]!;
        un[k] = (2 * u[k]! - (1 - sg) * up[k]! + C2 * lap) / (1 + sg);
      }
    }
    tau += h;
    const ramp = 1 - Math.exp(-tau / 0.3);
    const val = ramp * Math.sin(w * tau);
    if (plane) for (let j = 0; j < NY; j++) un[idx(IS, j)] = val;
    // Fonte pontual: disco de 5 células (centro + vizinhas) oscilando em fase.
    for (const [i, j] of srcCells)
      for (const [di, dj] of CROSS) {
        const a = i + di;
        const b = j + dj;
        if (a > 0 && a < NX - 1 && b > 0 && b < NY - 1) un[idx(a, b)] = val;
      }
    for (let k = 0; k < NX * NY; k++) {
      const a = avg[k]!;
      avg[k] = a + (un[k]! * un[k]! - a) * kAvg;
    }
    const tmp = up;
    up = u;
    u = un;
    un = tmp;
  }
  return { ...s, tau, u, up, avg };
}

const sampleAt = (g: Float32Array, x: number, y: number) => {
  const [i, j] = cellOf(x, y);
  return g[idx(Math.max(0, Math.min(NX - 1, i)), Math.max(0, Math.min(NY - 1, j)))] ?? 0;
};

/** Os dois "emissores" coerentes do arranjo (fontes ou fendas), para a diferença de caminho. */
export function emitters(s: Cuba, p: Params): [number, number][] {
  const a = Math.round(num(p, "arranjo"));
  if (a === ARRANJO.dupla) return slitCenters(p).map((y) => [XB + DX, y] as [number, number]);
  return s.src.slice(0, 2);
}

function pathDiff(s: Cuba, p: Params): number {
  const e = emitters(s, p);
  if (e.length < 2) return 0;
  const [x, y] = s.probe;
  const r1 = Math.hypot(x - e[0]![0], y - e[0]![1]);
  const r2 = Math.hypot(x - e[1]![0], y - e[1]![1]);
  return (r1 - r2) / lambda(p);
}

function paint(s: Cuba, x: number, y: number, on: boolean): Cuba {
  const wall = s.wall.slice();
  const u = s.u.slice();
  const up = s.up.slice();
  const from = s.last ?? [x, y];
  const len = Math.hypot(x - from[0], y - from[1]);
  const nSeg = Math.max(1, Math.ceil(len / (DX * 1.5)));
  const r = 0.5;
  for (let q = 0; q <= nSeg; q++) {
    const px = from[0] + ((x - from[0]) * q) / nSeg;
    const py = from[1] + ((y - from[1]) * q) / nSeg;
    const [ci, cj] = cellOf(px, py);
    const rc = Math.ceil(r / DX);
    for (let j = cj - rc; j <= cj + rc; j++)
      for (let i = ci - rc; i <= ci + rc; i++) {
        if (i < 1 || j < 1 || i >= NX - 1 || j >= NY - 1) continue;
        if ((i - ci) ** 2 + (j - cj) ** 2 > (r / DX) ** 2 + 0.5) continue;
        const k = idx(i, j);
        wall[k] = on ? 1 : 0;
        if (on) u[k] = up[k] = 0;
      }
  }
  return { ...s, wall, u, up, last: [x, y] };
}

const inside = (x: number, y: number) => x >= 0 && x <= W && y >= 0 && y <= H;
const NOMES_TOOL = ["Pintar parede", "Apagar parede", "Mover fontes e sonda"];

export const cubaOndas = defineSim<Cuba>({
  id: "cuba-ondas",
  title: "Cuba de ondas: interferência e difração em 2D",
  course: "FG II",
  topic: "Ondas",
  priority: "P1",
  summary:
    "Uma cuba de ondas simulada pela equação de onda 2D (diferenças finitas). Coloque duas fontes em fase e veja as linhas nodais, mande uma onda plana por uma fenda e pinte paredes com o mouse para criar seus próprios obstáculos.",
  equations: [
    String.raw`\frac{\partial^2 u}{\partial t^2} = v^2\left(\frac{\partial^2 u}{\partial x^2} + \frac{\partial^2 u}{\partial y^2}\right) \qquad \lambda = \frac{v}{f}`,
    String.raw`\text{duas fontes em fase: } |r_1 - r_2| = m\lambda \;\text{(máximo)} \qquad |r_1 - r_2| = \left(m + \tfrac12\right)\lambda \;\text{(linha nodal)}`,
    String.raw`\text{fenda simples de largura } a:\; a\,\operatorname{sen}\theta = m\lambda \;\text{(mínimos)} \qquad \text{fenda dupla: } d\,\operatorname{sen}\theta = \left(m + \tfrac12\right)\lambda`,
  ],
  liveEquations(s, p) {
    const lam = lambda(p);
    const arr = Math.round(num(p, "arranjo"));
    const eqs = [String.raw`\lambda = \frac{v}{f} = \frac{${texNum(num(p, "c", 20))}\ \text{cm/s}}{${texNum(num(p, "f", 8))}\ \text{Hz}} = ${texNum(lam)}\ \text{cm}`];
    if (arr === ARRANJO.duas || arr === ARRANJO.dupla) {
      eqs.push(String.raw`\text{na sonda: } \frac{r_1 - r_2}{\lambda} = ${texNum(pathDiff(s, p))} \qquad \langle u^2\rangle = ${texNum(sampleAt(s.avg, ...s.probe))}`);
      const d = arr === ARRANJO.duas && s.src.length >= 2 ? Math.hypot(s.src[0]![0] - s.src[1]![0], s.src[0]![1] - s.src[1]![1]) : num(p, "d", 4);
      eqs.push(String.raw`\text{linhas nodais: } 2\left\lfloor \frac{d}{\lambda} + \frac12 \right\rfloor = ${2 * Math.floor(d / lam + 0.5)}`);
    }
    if (arr === ARRANJO.fenda) {
      const a = num(p, "a", 2);
      eqs.push(
        lam < a
          ? String.raw`\theta_1 = \operatorname{arcsen}\frac{\lambda}{a} = ${texNum((Math.asin(lam / a) * 180) / Math.PI)}^\circ`
          : String.raw`\lambda \ge a:\ \text{sem mínimos; a onda se espalha por todo o lado}`,
      );
    }
    return eqs;
  },

  params: [
    {
      key: "arranjo", label: "Arranjo", unit: "", min: 0, max: 4, step: 1, default: 1,
      options: [
        { value: ARRANJO.uma, label: "Uma fonte pontual" },
        { value: ARRANJO.duas, label: "Duas fontes em fase" },
        { value: ARRANJO.fenda, label: "Onda plana + fenda simples" },
        { value: ARRANJO.dupla, label: "Onda plana + fenda dupla" },
        { value: ARRANJO.plana, label: "Onda plana livre (desenhe obstáculos)" },
      ],
    },
    { key: "f", label: "Frequência", unit: "Hz", min: 4, max: 12, step: 0.1, default: 8, live: true },
    { key: "c", label: "Velocidade da onda", unit: "cm/s", min: 12, max: 30, step: 0.5, default: 20 },
    { key: "d", label: "Separação das fontes/fendas", unit: "cm", min: 1.5, max: 10, step: 0.1, default: 5 },
    { key: "a", label: "Largura da fenda", unit: "cm", min: 0.6, max: 8, step: 0.1, default: 2 },
    {
      key: "visual", label: "Mostrar", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Elevação instantânea" },
        { value: 1, label: "Intensidade média ⟨u²⟩" },
      ],
    },
    {
      key: "linhas", label: "Linhas nodais teóricas", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Ocultar" },
        { value: 1, label: "Mostrar" },
      ],
    },
    { key: "ganho", label: "Contraste", unit: "", min: 0.5, max: 8, step: 0.1, default: 3, live: true },
  ],

  observables: [
    { key: "u", label: "Elevação na sonda (relativa à fonte)", unit: "", value: (s) => sampleAt(s.u, ...s.probe) },
    { key: "I", label: "Intensidade média na sonda ⟨u²⟩", unit: "", value: (s) => sampleAt(s.avg, ...s.probe) },
    { key: "dr", label: "Diferença de caminho na sonda (em λ)", unit: "", value: (s, p) => pathDiff(s, p) },
    { key: "lambda", label: "Comprimento de onda", unit: "cm", value: (_s, p) => lambda(p) },
  ],
  chart: { x: "t", y: "u" },

  scenarios: [
    {
      id: "uma",
      label: "Uma fonte: λ = v/f",
      params: { arranjo: ARRANJO.uma, linhas: 0, visual: 0 },
      guide: `### Ondas circulares
1. Uma fonte pontual oscila com frequência $f$. Meça a distância entre duas cristas vizinhas (use a escala de 1 λ no canto) e confira $\\lambda = v/f$.
2. Aumente $f$ com a simulação rodando: as cristas se aproximam, mas a velocidade não muda.
3. Escolha a ferramenta **Pintar parede** e desenhe uma parede reta perto da fonte: a onda refletida parece vir de uma **fonte imagem** atrás da parede.
4. A borda tracejada é absorvente (simula uma praia): quase nada volta dela.`,
    },
    {
      id: "duas",
      label: "Duas fontes em fase",
      params: { arranjo: ARRANJO.duas, d: 5, linhas: 1, visual: 1 },
      guide: `### Linhas nodais
1. Duas fontes em fase, separadas por $d$. Espere a intensidade média se formar: aparecem faixas escuras, as **linhas nodais**.
2. As linhas tracejadas são as hipérboles teóricas $|r_1 - r_2| = (m + \\tfrac12)\\lambda$. Elas coincidem com as faixas?
3. Arraste a sonda (ferramenta **Mover fontes e sonda**) para cima de uma linha nodal e leia $(r_1 - r_2)/\\lambda$ nas equações ao vivo.
4. Afaste as fontes ou aumente $f$: o número de linhas nodais é $2\\lfloor d/\\lambda + \\tfrac12 \\rfloor$.`,
      predict: [
        {
          question: "Se a frequência das duas fontes aumentar (mesma separação), o número de linhas nodais:",
          options: ["aumenta", "diminui", "não muda"],
          answer: 0,
          explanation: "Com $f$ maior, $\\lambda = v/f$ diminui e cabem mais valores de $(m + \\tfrac12)\\lambda$ menores que $d$: surgem mais linhas nodais.",
        },
      ],
    },
    {
      id: "fenda",
      label: "Difração numa fenda",
      params: { arranjo: ARRANJO.fenda, a: 4, f: 8, linhas: 1, visual: 1 },
      guide: `### Quanto mais estreita, mais espalha
1. Uma onda plana atravessa uma fenda de largura $a$. Atrás dela a onda se abre em leque.
2. As retas tracejadas marcam o primeiro mínimo previsto, $a\\operatorname{sen}\\theta = \\lambda$.
3. Diminua a largura da fenda até $a \\approx \\lambda$: a fenda passa a agir como uma fonte pontual (princípio de Huygens).
4. Desenhe paredes extras para fechar parte da fenda e veja o leque se alargar.`,
      predict: [
        {
          question: "Ao estreitar a fenda (mesmo λ), o feixe que sai do outro lado fica:",
          options: ["mais estreito", "mais aberto", "igual"],
          answer: 1,
          explanation: "O primeiro mínimo está em $\\operatorname{sen}\\theta = \\lambda/a$: com $a$ menor, $\\theta$ cresce e a onda se espalha mais.",
        },
      ],
    },
    {
      id: "dupla",
      label: "Fenda dupla",
      params: { arranjo: ARRANJO.dupla, a: 1, d: 5, f: 9, linhas: 1, visual: 1 },
      guide: `### Duas fendas: o experimento de Young na água
1. Cada fenda funciona como uma fonte em fase com a outra (a mesma frente de onda chega às duas).
2. Compare o padrão com o de **duas fontes em fase**: as linhas nodais seguem a mesma regra $|r_1 - r_2| = (m + \\tfrac12)\\lambda$.
3. Longe das fendas, os mínimos ficam em $d\\operatorname{sen}\\theta = (m + \\tfrac12)\\lambda$.
4. Feche uma das fendas pintando uma parede sobre ela: as linhas nodais somem.`,
    },
  ],

  exercises: [
    {
      id: "nodais",
      prompt:
        "Duas fontes em fase, separadas por {d} cm, oscilam a {f} Hz numa cuba onde as ondas andam a {c} cm/s. Quantas linhas nodais aparecem entre as fontes e o resto da cuba (contando os dois lados)?",
      vary: { d: [3, 10, 1], f: [5, 12, 0], c: [15, 30, 0] },
      fixed: { arranjo: ARRANJO.duas },
      answer: { label: "número de linhas", unit: "", compute: (p) => 2 * Math.floor(num(p, "d") / lambda(p) + 0.5) },
      tolerance: 0.001,
      hint: "Uma linha nodal existe para cada m ≥ 0 com (m + ½)λ < d, de cada lado da mediatriz.",
    },
    {
      id: "fenda-angulo",
      prompt: "Uma onda plana de {f} Hz, com velocidade {c} cm/s, passa por uma fenda de {a} cm. Em que ângulo (em graus, medido a partir da direção de incidência) fica o primeiro mínimo?",
      vary: { a: [3.5, 7, 1], f: [6, 10, 0], c: [15, 20, 0] },
      fixed: { arranjo: ARRANJO.fenda },
      answer: { label: "θ₁", unit: "°", compute: (p) => (Math.asin(lambda(p) / num(p, "a")) * 180) / Math.PI },
      hint: "a·sen θ = λ, com λ = v/f.",
    },
  ],

  init(p) {
    const n = NX * NY;
    return {
      tau: 0,
      u: new Float32Array(n),
      up: new Float32Array(n),
      avg: new Float32Array(n),
      wall: initialWalls(p),
      src: initialSources(p),
      probe: [24, YC],
      tool: TOOL.mover,
      drag: -1,
      last: null,
    };
  },
  step(s, p, _t, dt) {
    const c = num(p, "c", 20);
    const sub = Math.max(1, Math.ceil((c * dt) / (0.5 * DX)));
    return advance(s, p, sub, dt / sub);
  },
  dt: 0.004,
  sampleEvery: 25,
  maxSamples: 40,
  tEnd: 120,

  pointer: {
    down(s, _p, pt) {
      if (!inside(pt.x, pt.y)) return undefined;
      if (s.tool === TOOL.mover) {
        const cands: [number, number][] = [[99, Math.hypot(pt.x - s.probe[0], pt.y - s.probe[1])], ...s.src.map(([x, y], i) => [i, Math.hypot(pt.x - x, pt.y - y)] as [number, number])];
        cands.sort((a, b) => a[1] - b[1]);
        const best = cands[0];
        return best && best[1] < 2 ? { ...s, drag: best[0] } : undefined;
      }
      return paint({ ...s, last: null }, pt.x, pt.y, s.tool === TOOL.parede);
    },
    move(s, _p, pt, dragging) {
      if (!dragging) return undefined;
      const x = Math.max(SW * DX, Math.min(W - SW * DX, pt.x));
      const y = Math.max(SW * DX, Math.min(H - SW * DX, pt.y));
      if (s.tool === TOOL.mover) {
        if (s.drag === 99) return { ...s, probe: [pt.x, pt.y].map((v, i) => Math.max(0, Math.min(i ? H : W, v))) as [number, number] };
        if (s.drag >= 0 && s.drag < s.src.length) return { ...s, src: s.src.map((q, i) => (i === s.drag ? ([x, y] as [number, number]) : q)) };
        return undefined;
      }
      return inside(pt.x, pt.y) ? paint(s, pt.x, pt.y, s.tool === TOOL.parede) : undefined;
    },
    up: (s) => (s.drag !== -1 || s.last ? { ...s, drag: -1, last: null } : undefined),
    cursor(s, _p, pt) {
      if (!inside(pt.x, pt.y)) return undefined;
      if (s.tool !== TOOL.mover) return "crosshair";
      const near = [s.probe, ...s.src].some(([x, y]) => Math.hypot(pt.x - x, pt.y - y) < 2);
      return near ? "grab" : undefined;
    },
  },
  actions: [
    ...[TOOL.parede, TOOL.apagar, TOOL.mover].map((tool) => ({
      id: `tool-${tool}`,
      label: NOMES_TOOL[tool]!,
      run: (s: Cuba) => ({ ...s, tool }),
      active: (s: Cuba) => s.tool === tool,
    })),
    { id: "limpar", label: "Remover todas as paredes", run: (s: Cuba) => ({ ...s, wall: new Uint8Array(NX * NY) }) },
    { id: "barreira", label: "Restaurar barreira do arranjo", run: (s: Cuba, p: Params) => ({ ...s, wall: initialWalls(p) }) },
    {
      id: "acalmar",
      label: "Acalmar a água",
      run: (s: Cuba) => ({ ...s, u: new Float32Array(NX * NY), up: new Float32Array(NX * NY), avg: new Float32Array(NX * NY), tau: 0 }),
    },
  ],

  viewport: () => ({ xMin: 0, xMax: W, yMin: -2.2, yMax: H, unit: "cm" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const lam = lambda(p);
    const mostrarI = Math.round(num(p, "visual")) === 1;
    heatmap(ctx, s, theme, num(p, "ganho", 2), mostrarI);

    // Cuba e borda absorvente
    d.rect(0, 0, W, H, { stroke: theme.muted, width: 1.5 });
    d.rect(SW * DX, SW * DX, W - 2 * SW * DX, H - 2 * SW * DX, { stroke: theme.muted, width: 1, dash: [4, 5], alpha: 0.7 });

    // Linhas nodais teóricas
    if (Math.round(num(p, "linhas")) === 1) {
      ctx.save();
      ctx.beginPath();
      ctx.rect(0, 0, W, H);
      ctx.clip();
      const arr = Math.round(num(p, "arranjo"));
      const e = emitters(s, p);
      if ((arr === ARRANJO.duas || arr === ARRANJO.dupla) && e.length === 2) {
        const [a, b] = e as [[number, number], [number, number]];
        const cx = (a[0] + b[0]) / 2;
        const cy = (a[1] + b[1]) / 2;
        const c = Math.hypot(b[0] - a[0], b[1] - a[1]) / 2;
        const ux = (b[0] - a[0]) / (2 * c || 1);
        const uy = (b[1] - a[1]) / (2 * c || 1);
        for (let m = 0; (m + 0.5) * lam < 2 * c; m++) {
          const A = ((m + 0.5) * lam) / 2;
          const B = Math.sqrt(Math.max(0, c * c - A * A));
          for (const side of [-1, 1]) {
            const pts: [number, number][] = [];
            for (let q = -60; q <= 60; q++) {
              const tt = q / 15;
              const sAxis = side * A * Math.cosh(tt);
              const perp = B * Math.sinh(tt);
              pts.push([cx + sAxis * ux - perp * uy, cy + sAxis * uy + perp * ux]);
            }
            const trimmed = arr === ARRANJO.dupla ? pts.filter(([x]) => x > XB) : pts;
            d.polyline(trimmed, { color: theme.text, width: 1, dash: [5, 4], alpha: 0.8 });
          }
        }
      }
      if (arr === ARRANJO.fenda) {
        const a = num(p, "a", 2);
        if (lam < a) {
          const th = Math.asin(lam / a);
          for (const sg of [-1, 1]) d.line(XB + DX, YC, XB + DX + 40 * Math.cos(th), YC + sg * 40 * Math.sin(th), { color: theme.text, width: 1, dash: [5, 4] });
        }
      }
      ctx.restore();
    }

    // Fontes, sonda e escala
    if (planeWave(p)) {
      d.line(IS * DX, SW * DX, IS * DX, H - SW * DX, { color: theme.series[2], width: 3 });
      d.text("gerador de onda plana", IS * DX + 0.3, H - SW * DX + 0.6, { color: theme.muted, size: 10, align: "left" });
      d.arrowPx(IS * DX, YC, 1, 0, 30, { color: theme.series[2] });
    }
    s.src.forEach(([x, y], i) => {
      d.dot(x, y, 6, theme.series[2] ?? theme.accent);
      d.text(`F${i + 1}`, x, y, { color: theme.text, size: 11, dy: -12, weight: "600" });
    });
    const [px, py] = s.probe;
    d.circle(px, py, 0.5, { stroke: theme.text, width: 2, minPx: 6 });
    d.line(px - 0.8, py, px + 0.8, py, { color: theme.text, width: 1 });
    d.line(px, py - 0.8, px, py + 0.8, { color: theme.text, width: 1 });
    d.text("sonda", px, py, { color: theme.text, size: 10, dy: -14 });

    d.line(W - 1 - lam, -0.9, W - 1, -0.9, { color: theme.text, width: 2 });
    d.text(`λ = ${lam.toFixed(2).replace(".", ",")} cm`, W - 1 - lam / 2, -0.9, { color: theme.text, size: 10, dy: 10 });
    d.text(
      `${mostrarI ? "intensidade média ⟨u²⟩" : "vermelho: crista · azul: vale"}  ·  ferramenta: ${NOMES_TOOL[s.tool] ?? ""}`,
      0.2,
      -1.2,
      { color: theme.muted, size: 11, align: "left" },
    );
  },
});

function rgbOf(color: string, fallback: [number, number, number]): [number, number, number] {
  const m = /^#([0-9a-f]{6})$/i.exec(color.trim());
  if (m) {
    const v = parseInt(m[1]!, 16);
    return [(v >> 16) & 255, (v >> 8) & 255, v & 255];
  }
  const r = /rgba?\(([^)]+)\)/.exec(color);
  if (r) {
    const [a = 0, b = 0, c = 0] = r[1]!.split(",").map((x) => Number(x.trim()));
    return [a, b, c];
  }
  return fallback;
}

let off: HTMLCanvasElement | null = null;

/** Mapa de cores da elevação (ou da intensidade) desenhado como imagem NX × NY esticada sobre a cuba. */
function heatmap(ctx: CanvasRenderingContext2D, s: Cuba, theme: Theme, gain: number, intensity: boolean): void {
  if (typeof document === "undefined") return;
  if (!off) {
    off = document.createElement("canvas");
    off.width = NX;
    off.height = NY;
  }
  const octx = off.getContext("2d");
  if (!octx) return;
  const img = octx.createImageData(NX, NY);
  const pos = rgbOf(theme.positive, [217, 69, 59]);
  const neg = rgbOf(theme.negative, [47, 111, 217]);
  const acc = rgbOf(theme.accent, [47, 125, 225]);
  const wallC = rgbOf(theme.text, [28, 36, 48]);
  const data = img.data;
  for (let k = 0; k < NX * NY; k++) {
    const o = 4 * k; // linha j da imagem = linha j da grade; y para cima é tratado pela transformação do palco
    if (s.wall[k]) {
      data[o] = wallC[0];
      data[o + 1] = wallC[1];
      data[o + 2] = wallC[2];
      data[o + 3] = 255;
      continue;
    }
    let v: number;
    let c: [number, number, number];
    if (intensity) {
      v = Math.min(1, Math.sqrt(s.avg[k]! * 2) * gain);
      c = acc;
    } else {
      const u = s.u[k]! * gain;
      v = Math.min(1, Math.abs(u));
      c = u >= 0 ? pos : neg;
    }
    data[o] = c[0];
    data[o + 1] = c[1];
    data[o + 2] = c[2];
    data[o + 3] = Math.round(255 * v);
  }
  octx.putImageData(img, 0, 0);
  ctx.save();
  ctx.imageSmoothingEnabled = true;
  ctx.drawImage(off, 0, 0, W, H);
  ctx.restore();
}

export default cubaOndas;
