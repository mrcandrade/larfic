import { defineSim, draw, hashSeed, num, rng, texNum, type Draw, type Params, type Theme } from "@fisilab/core";

// Coordenadas do mundo em milímetros. Estado: [u], fração (0 → 1) do movimento de fechamento do instrumento.

export const MATERIAIS = [
  { nome: "Alumínio", rho: 2700 },
  { nome: "Latão", rho: 8500 },
  { nome: "Aço", rho: 7850 },
  { nome: "Cobre", rho: 8960 },
  { nome: "PVC", rho: 1380 },
];

export const PECAS = ["Cilindro", "Esfera", "Arruela", "Fio", "Nenhuma (conferir o zero)", "Bloco-padrão"];

export interface Peca {
  tipo: number;
  /** Diâmetro externo (mm). */
  D: number;
  /** Altura, espessura ou comprimento (mm). */
  H: number;
  /** Diâmetro interno (mm), só na arruela. */
  Di: number;
  /** Volume (mm³). */
  V: number;
  /** Densidade (kg/m³). */
  rho: number;
  material: string;
}

const r3 = (v: number) => Math.round(v * 1000) / 1000;

/** Peça sorteada pela amostra (dimensões verdadeiras, com 0,001 mm). */
export function peca(p: Params): Peca {
  const tipo = Math.round(num(p, "peca"));
  const amostra = Math.round(num(p, "amostra", 1));
  const rand = rng(hashSeed(`peca${tipo}-amostra${amostra}`));
  const u = (a: number, b: number) => a + (b - a) * rand();
  const matSel = Math.round(num(p, "material"));
  const mat = matSel === 0 ? MATERIAIS[Math.floor(rand() * MATERIAIS.length)]! : MATERIAIS[matSel - 1] ?? MATERIAIS[0]!;
  let D = 0, H = 0, Di = 0, V = 0;
  switch (tipo) {
    case 0:
      D = r3(u(12, 24.9));
      H = r3(u(15, 60));
      V = (Math.PI * D * D * H) / 4;
      break;
    case 1:
      D = r3(u(8, 24.9));
      H = D;
      V = (Math.PI * D ** 3) / 6;
      break;
    case 2:
      D = r3(u(16, 40));
      Di = r3(D * u(0.35, 0.6));
      H = r3(u(1.2, 4));
      V = (Math.PI * (D * D - Di * Di) * H) / 4;
      break;
    case 3:
      D = r3(u(0.25, 2.5));
      H = r3(u(100, 140));
      V = (Math.PI * D * D * H) / 4;
      break;
    case 5:
      H = num(p, "Lb", 23.35);
      D = 9;
      V = H * 9 * 35;
      break;
    default:
      break;
  }
  return { tipo, D, H, Di, V, rho: tipo === 4 ? 0 : tipo === 5 ? 7850 : mat.rho, material: tipo === 5 ? "Aço" : mat.nome };
}

export const instrumento = (p: Params) => Math.round(num(p, "instrumento"));

/** Qual dimensão está entre as faces do instrumento (0 externo, 1 altura/espessura, 2 interno). */
export function dimensao(p: Params): number {
  const pc = peca(p);
  const d = Math.round(num(p, "dimensao"));
  if (pc.tipo === 5 || pc.tipo === 4) return 1;
  if (d === 2 && (pc.tipo !== 2 || instrumento(p) === 1)) return 0;
  return d;
}

/** Comprimento verdadeiro sendo medido (mm). */
export function alvo(p: Params): number {
  const pc = peca(p);
  if (pc.tipo === 4) return 0;
  if (pc.tipo === 5) return pc.H;
  const d = dimensao(p);
  return d === 2 ? pc.Di : d === 1 ? pc.H : pc.D;
}

const FAIXA = [150, 25];
export const cabe = (p: Params) => alvo(p) <= FAIXA[instrumento(p)]!;

const ease = (u: number) => {
  const c = Math.min(1, Math.max(0, u));
  return c * c * (3 - 2 * c);
};

/** Abertura do instrumento (mm) durante o fechamento sobre a peça. */
export function abertura(u: number, p: Params): number {
  const max = FAIXA[instrumento(p)]!;
  const L = cabe(p) ? alvo(p) : max;
  const interno = dimensao(p) === 2;
  const start = interno ? L * 0.55 : Math.min(max, L + 8);
  return start + (L - start) * ease(u);
}

/** Valor indicado pela escala: abertura somada ao erro de zero. */
export const leituraEscala = (u: number, p: Params) => abertura(u, p) + num(p, "zero");

/** Decomposição da leitura no paquímetro de 0,05 mm (nônio de 20 divisões em 39 mm). */
export function vernier(v: number) {
  const q = Math.round(v / 0.05) * 0.05;
  const main = Math.floor(q + 1e-9);
  return { main, line: Math.round((q - main) / 0.05), value: q };
}

/** Decomposição da leitura no micrômetro: bainha (0,5 mm) + tambor de 50 divisões (0,01 mm). */
export function micrometer(v: number) {
  const q = Math.round(v / 0.01) * 0.01;
  const sleeve = Math.floor((q + 1e-9) / 0.5) * 0.5;
  return { sleeve, drum: Math.round((q - sleeve) / 0.01) % 50, value: q };
}

const fmt = (v: number, dec: number) => v.toFixed(dec).replace(".", ",");
const massKg = (pc: Peca) => (pc.V * 1e-9) * pc.rho;

// ---------------------------------------------------------------- desenho

function piece(d: Draw, theme: Theme, pc: Peca, dim: number, x0: number, yc: number) {
  const fill = theme.dark ? "#8b95a3" : "#b9c2cc";
  const st = { fill, stroke: theme.text, width: 1 };
  if (pc.tipo === 4) return;
  if (pc.tipo === 5) {
    d.rect(x0, yc - 10, pc.H, 20, st);
    return;
  }
  if (pc.tipo === 1) {
    d.circle(x0 + pc.D / 2, yc, pc.D / 2, { ...st, minPx: 2 });
    return;
  }
  if (pc.tipo === 2 && dim === 2) {
    // corte da arruela: as pontas internas estão dentro do furo
    const w = (pc.D - pc.Di) / 2;
    d.rect(x0 - w, yc - pc.H / 2, w, pc.H, st);
    d.rect(x0 + pc.Di, yc - pc.H / 2, w, pc.H, st);
    return;
  }
  if (dim === 1) {
    // perfil: largura = altura/espessura/comprimento, altura do desenho = diâmetro
    const h = Math.max(pc.D, 0.5);
    d.rect(x0, yc - h / 2, pc.H, h, st);
    return;
  }
  d.circle(x0 + pc.D / 2, yc, pc.D / 2, { ...st, minPx: 2 });
  if (pc.tipo === 2) d.circle(x0 + pc.D / 2, yc, pc.Di / 2, { fill: theme.dark ? "#1b2230" : "#ffffff", stroke: theme.text, width: 1 });
}

function caliper(d: Draw, theme: Theme, p: Params, u: number) {
  const open = abertura(u, p);
  const read = leituraEscala(u, p);
  const metal = theme.dark ? "#4a5565" : "#d5dbe2";
  const slide = theme.dark ? "#3b4553" : "#c4ccd6";
  const ink = theme.text;
  // Haste com escala principal (zero da escala deslocado pelo erro de zero)
  const z = -num(p, "zero");
  d.rect(-14, 0, 190, 16, { fill: metal, stroke: ink, width: 1 });
  for (let m = 0; m <= 160; m++) {
    const x = z + m;
    const h = m % 10 === 0 ? 7 : m % 5 === 0 ? 5 : 3.5;
    d.line(x, 0, x, h, { color: ink, width: m % 10 === 0 ? 1 : 0.6 });
    if (m % 10 === 0) d.text(`${m / 10}`, x, 11.5, { size: 9, color: ink });
  }
  d.text("cm", 170, 11.5, { size: 9, color: theme.muted });
  // Bico fixo (externo, para baixo) e orelha fixa (interna, para cima)
  d.polyline([[-14, 0], [0, 0], [0, -60], [-6, -66], [-14, -60]], { close: true, fill: metal, color: ink, width: 1 });
  d.polyline([[0, 16], [0, 42], [3, 42], [5, 16]], { close: true, fill: metal, color: ink, width: 1 });
  // Cursor: nônio, bico móvel e orelha móvel
  d.rect(open - 6, -14, 56, 14, { fill: slide, stroke: ink, width: 1 });
  d.rect(open - 6, 16, 56, 5, { fill: slide, stroke: ink, width: 1 });
  d.polyline([[open, -14], [open, -60], [open + 6, -66], [open + 14, -60], [open + 14, -14]], { close: true, fill: slide, color: ink, width: 1 });
  d.polyline([[open, 21], [open, 42], [open - 3, 42], [open - 5, 21]], { close: true, fill: slide, color: ink, width: 1, alpha: 0.9 });
  d.circle(open + 30, -18, 4, { fill: metal, stroke: ink, width: 1 });
  // Nônio: 20 divisões em 39 mm, rótulos 0..10
  const x0 = open;
  for (let k = 0; k <= 20; k++) {
    const x = x0 + k * 1.95;
    d.line(x, 0, x, k % 2 === 0 ? -5 : -3.5, { color: ink, width: 0.6 });
    if (k % 2 === 0 && k % 4 === 0) d.text(`${k / 2}`, x, -8.5, { size: 8, color: ink });
  }
  return { open, read };
}

function caliperLens(d: Draw, theme: Theme, read: number, box: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = box;
  const span = 46;
  const a = read - 3;
  const mag = w / span;
  const X = (v: number) => x + (v - a) * mag;
  const base = y + h * 0.55;
  d.rect(x, y, w, h, { fill: theme.dark ? "#1b2230" : "#fbfbf7", stroke: theme.text, width: 1.2 });
  // escala principal (posições relativas à escala gravada; read já inclui o zero)
  for (let m = Math.ceil(a); m <= a + span; m++) {
    if (m < 0) continue;
    const t = m % 10 === 0 ? 0.3 : m % 5 === 0 ? 0.22 : 0.15;
    d.line(X(m), base, X(m), base + h * t, { color: theme.text, width: m % 10 === 0 ? 1.6 : 1 });
    if (m % 10 === 0) d.text(`${m / 10}`, X(m), base + h * 0.37, { size: 13, weight: "600" });
  }
  // nônio
  for (let k = 0; k <= 20; k++) {
    const xv = X(read + k * 1.95);
    d.line(xv, base, xv, base - h * (k % 2 === 0 ? 0.22 : 0.15), { color: theme.accent, width: k === 0 ? 1.8 : 1.1 });
    if (k % 2 === 0) d.text(`${k / 2}`, xv, base - h * 0.3, { size: 12, color: theme.accent, weight: "600" });
  }
  d.line(x, base, x + w, base, { color: theme.muted, width: 0.8 });
  d.text("lupa: escala principal (cm, divisões de 1 mm) e nônio (0,05 mm)", x + w / 2, y - 6, { size: 11, color: theme.muted });
}

function micrometerView(d: Draw, theme: Theme, p: Params, u: number) {
  const open = abertura(u, p);
  const read = leituraEscala(u, p);
  const metal = theme.dark ? "#4a5565" : "#d5dbe2";
  const ink = theme.text;
  const yc = -38;
  // Arco (estrutura em C)
  const frameC = theme.dark ? "#7a4a3a" : "#c9826b";
  d.rect(-28, -74, 14, yc + 74 + 7, { fill: frameC, stroke: ink, width: 1 });
  d.rect(-28, -74, 90, 12, { fill: frameC, stroke: ink, width: 1 });
  d.rect(50, -74, 12, yc + 74 - 6, { fill: frameC, stroke: ink, width: 1 });
  d.rect(-14, yc - 7, 2, 14, { fill: frameC });
  // Batente fixo
  d.rect(-12, yc - 4, 12, 8, { fill: metal, stroke: ink, width: 1 });
  // Fuso
  d.rect(open, yc - 4, 60 - open, 8, { fill: metal, stroke: ink, width: 1 });
  // Bainha com escala (zero da bainha em x = 60 + erro de zero)
  const z = 60 - num(p, "zero");
  d.rect(52, yc - 6, 40, 12, { fill: metal, stroke: ink, width: 1 });
  d.line(52, yc, 92, yc, { color: ink, width: 0.8 });
  for (let k = 0; k <= 50; k++) {
    const x = z + k * 0.5;
    if (x > 92) break;
    const up = k % 2 === 0;
    d.line(x, yc, x, up ? yc + (k % 10 === 0 ? 4 : 3) : yc - 2.5, { color: ink, width: 0.6 });
    if (up && k % 10 === 0 && x < 60 + open - 1) d.text(`${k / 2}`, x, yc + 8.5, { size: 7 });
  }
  // Tambor
  const edge = 60 + open;
  d.rect(edge, yc - 9, 30, 18, { fill: metal, stroke: ink, width: 1 });
  d.rect(edge + 30, yc - 6, 10, 12, { fill: metal, stroke: ink, width: 1 });
  const drum = ((read % 0.5) + 0.5) % 0.5 / 0.01;
  for (let j = 0; j < 50; j++) {
    const th = (2 * Math.PI * (j - drum)) / 50;
    if (Math.cos(th) < 0.2) continue;
    const y = yc - 9 * Math.sin(th);
    d.line(edge, y, edge + (j % 5 === 0 ? 3 : 1.8), y, { color: ink, width: 0.5 });
  }
  d.text("catraca", edge + 35, yc + 10, { size: 9, color: theme.muted });
  return { open, read, yc };
}

function micrometerLens(d: Draw, theme: Theme, read: number, box: { x: number; y: number; w: number; h: number }) {
  const { x, y, w, h } = box;
  const yc = y + h / 2;
  const edgeX = x + w * 0.62;
  const mag = 11;
  // A borda do tambor está na leitura; a bainha mostra traços até ela.
  d.rect(x, y, w, h, { fill: theme.dark ? "#1b2230" : "#fbfbf7", stroke: theme.text, width: 1.2 });
  d.rect(x, yc - h * 0.22, edgeX - x, h * 0.44, { fill: theme.dark ? "#3b4553" : "#e3e8ef" });
  d.line(x, yc, edgeX, yc, { color: theme.text, width: 1.2 });
  const first = Math.max(0, Math.ceil((read - (edgeX - x) / mag) * 2) / 2);
  for (let k = Math.round(first * 2); k / 2 <= read + 1e-9; k++) {
    const v = k / 2;
    const xx = edgeX - (read - v) * mag;
    if (xx < x + 2) continue;
    const up = k % 2 === 0;
    d.line(xx, yc, xx, up ? yc + h * (k % 10 === 0 ? 0.17 : 0.13) : yc - h * 0.13, { color: theme.text, width: 1.2 });
    if (up && (k / 2) % 5 === 0) d.text(`${k / 2}`, xx, yc + h * 0.27, { size: 13, weight: "600" });
  }
  // Tambor
  d.rect(edgeX, y + 2, x + w - edgeX - 2, h - 4, { fill: theme.dark ? "#4a5565" : "#d5dbe2", stroke: theme.text, width: 1 });
  const drum = (((read % 0.5) + 0.5) % 0.5) / 0.01;
  const R = h * 0.45;
  for (let j = 0; j < 50; j++) {
    for (const turn of [-50, 0, 50]) {
      const th = (2 * Math.PI * (j + turn - drum)) / 50;
      if (Math.abs(th) > 1.25) continue;
      const yy = yc - R * Math.sin(th);
      if (yy < y + 3 || yy > y + h - 3) continue;
      const long = j % 5 === 0;
      d.line(edgeX, yy, edgeX + (long ? 14 : 8), yy, { color: theme.accent, width: 1.1 });
      if (long) d.text(`${j}`, edgeX + 24, yy, { size: 12, color: theme.accent, weight: "600" });
    }
  }
  d.text("lupa: bainha (traços de 0,5 mm) e tambor (50 divisões de 0,01 mm)", x + w / 2, y - 6, { size: 11, color: theme.muted });
}

function balance(d: Draw, theme: Theme, pc: Peca, x: number, y: number) {
  const ink = theme.text;
  d.rect(x, y, 56, 22, { fill: theme.dark ? "#3b4553" : "#e3e8ef", stroke: ink, width: 1 });
  d.rect(x + 6, y + 22, 44, 3, { fill: theme.muted });
  d.rect(x + 8, y + 4, 40, 11, { fill: "#1d2a20", stroke: ink, width: 0.8 });
  const g = massKg(pc) * 1000;
  d.text(`${fmt(Math.round(g * 100) / 100, 2)} g`, x + 46, y + 9.5, { size: 13, color: "#7cf29a", align: "right", weight: "600" });
  d.text("balança (0,01 g)", x + 28, y + 31, { size: 10, color: theme.muted });
}

export const instrumentosMedida = defineSim({
  id: "instrumentos-medida",
  title: "Paquímetro, micrômetro e densidade",
  course: "Exp I",
  topic: "Medidas",
  priority: "P1",
  summary:
    "Meça cilindros, esferas, arruelas e fios com paquímetro (nônio de 0,05 mm) e micrômetro (0,01 mm), leia as escalas com a lupa, pese na balança e calcule volume e densidade com a propagação de incertezas.",
  equations: [
    String.raw`L = L_{\text{principal}} + n \times 0{,}05\ \text{mm} \quad\text{(paquímetro)}`,
    String.raw`L = L_{\text{bainha}} + n_{\text{tambor}} \times 0{,}01\ \text{mm} \quad\text{(micrômetro)}`,
    String.raw`\rho = \frac{m}{V},\quad V_{\text{cil}} = \frac{\pi D^2 H}{4} \qquad \frac{u(\rho)}{\rho} = \sqrt{\left(\frac{u_m}{m}\right)^2 + \left(\frac{2u_D}{D}\right)^2 + \left(\frac{u_H}{H}\right)^2}`,
  ],
  liveEquations(s, p) {
    const u = s[0]!;
    const pc = peca(p);
    const out = [String.raw`\text{peça: } \text{${PECAS[pc.tipo] ?? ""}}${pc.tipo === 4 ? "" : String.raw`\ (\text{${pc.material}})`}`];
    if (num(p, "gabarito") >= 1 && u >= 1) {
      const r = leituraEscala(u, p);
      if (instrumento(p) === 0) {
        const v = vernier(r);
        out.push(String.raw`L = ${v.main}\ \text{mm} + ${v.line} \times 0{,}05\ \text{mm} = ${texNum(v.value, 5)}\ \text{mm}`);
      } else {
        const m = micrometer(r);
        out.push(String.raw`L = ${texNum(m.sleeve, 4)}\ \text{mm} + ${m.drum} \times 0{,}01\ \text{mm} = ${texNum(m.value, 5)}\ \text{mm}`);
      }
      out.push(String.raw`V = ${texNum(pc.V, 5)}\ \text{mm}^3 \qquad \rho = ${texNum(pc.rho, 4)}\ \text{kg/m}^3`);
    } else {
      out.push(String.raw`\text{leia a escala na lupa (ative "Mostrar a leitura" para conferir)}`);
    }
    return out;
  },

  params: [
    {
      key: "instrumento",
      label: "Instrumento",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Paquímetro (0,05 mm)" },
        { value: 1, label: "Micrômetro (0,01 mm)" },
      ],
    },
    { key: "peca", label: "Peça", unit: "", min: 0, max: 5, step: 1, default: 0, options: PECAS.map((n, i) => ({ value: i, label: n })) },
    {
      key: "dimensao",
      label: "Dimensão medida",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Diâmetro (externo)" },
        { value: 1, label: "Altura / espessura / comprimento" },
        { value: 2, label: "Diâmetro interno (arruela, paquímetro)" },
      ],
    },
    { key: "amostra", label: "Amostra nº", unit: "", min: 1, max: 30, step: 1, default: 1 },
    {
      key: "material",
      label: "Material",
      unit: "",
      min: 0,
      max: 5,
      step: 1,
      default: 0,
      options: [{ value: 0, label: "Desconhecido (sorteado)" }, ...MATERIAIS.map((m, i) => ({ value: i + 1, label: m.nome }))],
    },
    { key: "Lb", label: "Comprimento do bloco-padrão", unit: "mm", min: 1, max: 140, step: 0.01, default: 23.35 },
    { key: "zero", label: "Erro de zero do instrumento", unit: "mm", min: -0.2, max: 0.2, step: 0.01, default: 0 },
    {
      key: "gabarito",
      label: "Mostrar a leitura (gabarito)",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Não" },
        { value: 1, label: "Sim" },
      ],
    },
  ],

  observables: [
    { key: "L", label: "Dimensão medida (valor verdadeiro)", unit: "m", value: (_s, p) => alvo(p) / 1000 },
    { key: "leitura", label: "Valor indicado pela escala", unit: "m", value: (s, p) => leituraEscala(s[0]!, p) / 1000 },
    { key: "D", label: "Diâmetro externo", unit: "m", value: (_s, p) => peca(p).D / 1000 },
    { key: "H", label: "Altura / espessura / comprimento", unit: "m", value: (_s, p) => peca(p).H / 1000 },
    { key: "Di", label: "Diâmetro interno", unit: "m", value: (_s, p) => peca(p).Di / 1000 },
    { key: "m", label: "Massa", unit: "kg", value: (_s, p) => massKg(peca(p)) },
    { key: "V", label: "Volume", unit: "m³", value: (_s, p) => peca(p).V * 1e-9 },
    { key: "rho", label: "Densidade", unit: "kg/m³", value: (_s, p) => peca(p).rho },
  ],
  chart: { x: "t", y: "leitura" },

  scenarios: [
    {
      id: "paquimetro",
      label: "Paquímetro: cilindro",
      params: { instrumento: 0, peca: 0, dimensao: 0, amostra: 1, material: 0, zero: 0, gabarito: 0 },
      guide: `### Lendo o nônio
1. Na lupa, o traço **0 do nônio** passou por qual traço da escala principal? Esse é o valor inteiro em mm.
2. Procure o traço do nônio que **coincide** com um traço da escala principal: cada traço vale 0,05 mm (os rótulos 1, 2, … valem 0,1, 0,2, … mm).
3. Some: $L = L_{\\text{principal}} + n \\times 0{,}05$ mm. Confira ativando *Mostrar a leitura*.
4. Meça o diâmetro e a altura e pese o cilindro. Calcule $V = \\pi D^2 H/4$ e $\\rho = m/V$, com incerteza.`,
      predict: [
        {
          question: "O zero do nônio está entre 23 e 24 mm e o traço 7 do nônio coincide com a escala. A leitura é:",
          options: ["23,07 mm", "23,35 mm", "23,70 mm", "30,0 mm"],
          answer: 1,
          explanation: "Cada traço do nônio vale 0,05 mm: $23 + 7 \\times 0{,}05 = 23{,}35$ mm.",
        },
      ],
    },
    {
      id: "micrometro",
      label: "Micrômetro: fio e esfera",
      params: { instrumento: 1, peca: 3, dimensao: 0, amostra: 1, material: 4, zero: 0, gabarito: 0 },
      guide: `### Lendo o micrômetro
1. Na bainha, conte os milímetros (traços de cima) e veja se o traço de **meio milímetro** (embaixo) já apareceu.
2. No tambor, leia a divisão alinhada com a linha de referência: cada uma vale 0,01 mm.
3. $L = L_{\\text{bainha}} + n \\times 0{,}01$ mm.
4. Meça o fio com o paquímetro também. Qual instrumento dá menor incerteza relativa para um diâmetro de 1 mm?`,
      predict: [
        {
          question: "Para medir o diâmetro de um fio de cerca de 0,5 mm, a incerteza relativa com o paquímetro (0,05 mm) comparada à do micrômetro (0,01 mm) é:",
          options: ["a mesma", "5 vezes maior", "5 vezes menor", "50 vezes maior"],
          answer: 1,
          explanation: "A incerteza tipo B é proporcional à resolução, e $0{,}05/0{,}01 = 5$.",
        },
      ],
    },
    {
      id: "arruela",
      label: "Arruela: diâmetro interno",
      params: { instrumento: 0, peca: 2, dimensao: 2, amostra: 3, material: 0, zero: 0, gabarito: 0 },
      guide: `### Orelhas internas
As orelhas de cima medem diâmetros internos.
1. Meça o diâmetro interno, o externo e a espessura da arruela.
2. Calcule $V = \\pi (D^2 - D_i^2)\\,e/4$ e a densidade. Identifique o material: alumínio 2,70; latão 8,5; aço 7,85; cobre 8,96; PVC 1,38 g/cm³.
3. Qual medida contribui mais para a incerteza de $\\rho$? (Dica: a espessura é pequena.)`,
    },
    {
      id: "zero",
      label: "Erro de zero",
      params: { instrumento: 0, peca: 4, zero: 0.1, gabarito: 0 },
      guide: `### Antes de medir: o zero
Feche o instrumento sem peça. Se o zero do nônio não coincide com o zero da escala, há um **erro sistemático** que deve ser descontado de todas as leituras.
1. Qual é o erro de zero (com sinal)?
2. Meça uma peça e corrija: $L = L_{\\text{lido}} - L_{\\text{zero}}$.
3. Repetir a medida várias vezes elimina esse erro? Por quê?`,
    },
  ],

  exercises: [
    {
      id: "nonio",
      prompt:
        "Um bloco-padrão de {Lb} mm é medido com um paquímetro de nônio de 20 divisões (resolução 0,05 mm). Qual é o número do traço do nônio (0 a 19) que coincide com um traço da escala principal?",
      vary: { Lb: [2, 140, 2] },
      fixed: { instrumento: 0, peca: 5, zero: 0 },
      answer: { label: "traço", unit: "", compute: (p) => vernier(num(p, "Lb")).line % 20 },
      tolerance: 0.001,
      hint: "Tire a parte inteira em mm e divida o resto por 0,05.",
    },
    {
      id: "tambor",
      prompt:
        "Um micrômetro mede um bloco-padrão de {Lb} mm. Qual divisão do tambor (0 a 49) fica alinhada com a linha de referência da bainha?",
      vary: { Lb: [1, 24.5, 2] },
      fixed: { instrumento: 1, peca: 5, zero: 0 },
      answer: { label: "divisão", unit: "", compute: (p) => micrometer(num(p, "Lb")).drum },
      tolerance: 0.001,
      hint: "A bainha mostra meios milímetros; o tambor completa de 0,01 em 0,01 mm.",
    },
    {
      id: "densidade",
      prompt:
        "Um cilindro tem diâmetro {Dc} mm e altura {Hc} mm, medidos com paquímetro, e massa {Mg} g. Qual é a densidade em g/cm³?",
      vary: { Dc: [12, 25, 2], Hc: [15, 60, 2], Mg: [5, 200, 2] },
      fixed: { instrumento: 0, peca: 0 },
      answer: {
        label: "ρ",
        unit: "g/cm³",
        compute: (p) => num(p, "Mg") / ((Math.PI * (num(p, "Dc") / 10) ** 2 * (num(p, "Hc") / 10)) / 4),
      },
      hint: "Converta para cm: V = πD²H/4.",
    },
  ],

  init: () => [0],
  derivatives: () => [1 / 1.2],
  dt: 1e-2,
  sampleEvery: 2,
  tEnd: 2,
  stopWhen: (s) => 1 - s[0]!,

  viewport: () => ({ xMin: -36, xMax: 252, yMin: -168, yMax: 50 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const u = s[0]!;
    const pc = peca(p);
    const dim = dimensao(p);
    const lens = { x: -30, y: -160, w: 276, h: 64 };
    if (instrumento(p) === 0) {
      const { read } = caliper(d, theme, p, u);
      if (dim === 2) piece(d, theme, pc, dim, 0, 34);
      else piece(d, theme, pc, dim, 0, -38);
      caliperLens(d, theme, read, lens);
      if (!cabe(p)) d.text("peça maior que a faixa do paquímetro", 80, -80, { size: 12, color: theme.negative });
    } else {
      const k = 1.4;
      ctx.save();
      ctx.translate(14, -40 + 38 * k);
      ctx.scale(k, k);
      const dk = draw(ctx, { ...frame, scale: frame.scale * k });
      const { read, yc } = micrometerView(dk, theme, p, u);
      if (cabe(p)) piece(dk, theme, pc, dim, 0, yc);
      ctx.restore();
      if (!cabe(p)) d.text("fora da faixa do micrômetro (0 a 25 mm): use o paquímetro", 110, -84, { size: 12, color: theme.negative });
      micrometerLens(d, theme, read, lens);
    }
    balance(d, theme, pc, 188, 0);
    d.text(`${PECAS[pc.tipo]}${pc.tipo === 4 || pc.tipo === 5 ? "" : ` · amostra ${Math.round(num(p, "amostra", 1))}`}`, 216, 44, { size: 12, weight: "600" });
  },
});

export default instrumentosMedida;
