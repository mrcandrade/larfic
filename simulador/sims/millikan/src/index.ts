import { defineSim, draw, gaussian, num, rng, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import {
  E_CHARGE,
  GAP,
  RETICLE,
  apparentMass,
  balanceVoltage,
  chargeFromBalance,
  chargeFromVelocities,
  cunningham,
  diffusion,
  drift,
  estimateE,
  fallSpeed,
  radiusFromFall,
  viscosity,
} from "./physics.ts";

export * from "./physics.ts";

export interface Drop {
  id: number;
  /** Posição horizontal (m, 0 no eixo da luneta) e altura acima da placa inferior (m). */
  x: number;
  y: number;
  r: number;
  /** Número de cargas elementares em excesso. */
  n: number;
}

export interface MKState {
  drops: Drop[];
  sel: number;
  seed: number;
  nextId: number;
  /** Cronômetro automático da gota selecionada entre as duas linhas do retículo. */
  timer: { dir: number; t0: number } | null;
  tq: number;
  ts: number;
  /** Tensão na qual a subida foi cronometrada. */
  Vs: number;
  /** Cargas registradas (C). */
  qs: number[];
}

/** Centro do campo da luneta (m) e meia abertura (m). */
const YC = GAP / 2;
const FOV = 1.25e-3;
const Y_UP = YC + RETICLE / 2;
const Y_LO = YC - RETICLE / 2;

const T = (p: Params) => num(p, "T", 23);
const fieldOn = (p: Params) => Math.round(num(p, "campo", 0)) === 1;
const Vplates = (p: Params) => num(p, "V", 400);
const Efield = (p: Params) => (fieldOn(p) ? Vplates(p) / GAP : 0);
const corr = (p: Params) => Math.round(num(p, "cunningham", 1)) === 1;
const metodo = (p: Params) => Math.round(num(p, "metodo", 0));

const selected = (s: MKState) => s.drops.find((d) => d.id === s.sel);
const qOf = (d: Drop) => d.n * E_CHARGE;

/** Sorteia uma gota nova: raio entre 0,45 e 1,3 µm, carga de 1 a 9 e. */
function newDrop(rand: () => number, id: number, yMin: number, yMax: number): Drop {
  const r = (0.45 + 0.85 * rand()) * 1e-6;
  const n = 1 + Math.min(8, Math.floor(-Math.log(1 - rand() * 0.999) * 2.2));
  return { id, x: (2 * rand() - 1) * FOV * 0.8, y: yMin + (yMax - yMin) * rand(), r, n };
}

export function spray(s: MKState, count = 7): MKState {
  const rand = rng(s.seed);
  const drops = s.drops.slice();
  let id = s.nextId;
  for (let i = 0; i < count; i++) drops.push(newDrop(rand, id++, YC - 0.4e-3, YC + 1.2e-3));
  const sel = selected(s) ? s.sel : (drops[0]?.id ?? -1);
  return { ...s, drops, nextId: id, sel, seed: Math.floor(rand() * 2 ** 31), timer: null };
}

/** Tempo para percorrer a distância do retículo com a velocidade dada (0 se não chega). */
const transit = (v: number) => (v > 0 ? RETICLE / v : 0);

/** Carga calculada pelo método escolhido a partir dos tempos de queda e subida. */
export function chargeFromTimes(p: Params, tq: number, ts: number, V: number): number {
  if (!(tq > 0)) return 0;
  const vq = RETICLE / tq;
  if (metodo(p) === 1) return chargeFromBalance(vq, V, T(p), corr(p));
  if (!(ts > 0) || !(V > 0)) return 0;
  return chargeFromVelocities(vq, RETICLE / ts, V, T(p), corr(p));
}

/** Mede automaticamente `count` gotas novas, com o ruído browniano na cronometragem. */
export function autoMeasure(s: MKState, p: Params, count: number): MKState {
  const rand = rng(s.seed ^ 0x5bd1e995);
  const qs = s.qs.slice();
  const Tc = T(p);
  let tries = 0;
  while (qs.length < s.qs.length + count && tries++ < count * 20) {
    const d = newDrop(rand, 0, YC, YC);
    const q = qOf(d);
    const D = diffusion(d.r, Tc);
    const noisy = (v: number) => {
      const t = RETICLE / v;
      return t * (1 + (Math.sqrt(2 * D * t) / RETICLE) * gaussian(rand));
    };
    const vq = fallSpeed(d.r, Tc);
    const tq = noisy(vq);
    if (metodo(p) === 1) {
      // o operador acerta a tensão de equilíbrio com ruído de ±1 %
      const Veq = balanceVoltage(d.r, q) * (1 + 0.01 * gaussian(rand));
      if (Veq > 1500) continue;
      qs.push(chargeFromTimes(p, tq, 0, Veq));
    } else {
      const V = Vplates(p);
      const vs = drift(d.r, q, V / GAP, Tc);
      if (vs <= 0 || RETICLE / vs > 120) continue;
      qs.push(chargeFromTimes(p, tq, noisy(vs), V));
    }
  }
  return { ...s, qs, seed: Math.floor(rand() * 2 ** 31) };
}

export const initState = (): MKState =>
  spray({ drops: [], sel: -1, seed: 20240917, nextId: 1, timer: null, tq: 0, ts: 0, Vs: 0, qs: [] });

const val = (s: MKState, f: (d: Drop) => number) => {
  const d = selected(s);
  return d ? f(d) : 0;
};

export const millikan = defineSim<MKState>({
  id: "millikan",
  title: "Gota de óleo de Millikan",
  course: "FG IV",
  topic: "Física moderna",
  priority: "P2",
  summary:
    "Gotas de óleo carregadas entre placas paralelas, vistas pela luneta com retículo. Cronometre a queda livre (lei de Stokes dá raio e massa) e a subida com campo, ou ache a tensão de equilíbrio: o histograma das cargas medidas mostra a quantização q = n·e.",
  equations: [
    String.raw`6\pi\eta_{\text{ef}} r\, v_q = \tfrac43\pi r^3 (\rho_o - \rho_{ar}) g \qquad \eta_{\text{ef}} = \frac{\eta}{1 + b/(pr)}`,
    String.raw`q = \frac{6\pi\eta_{\text{ef}}\, r\,(v_q + v_s)}{E} \qquad E = \frac{V}{d}`,
    String.raw`\text{equilíbrio: } q = \frac{m' g\, d}{V_{eq}} \qquad \langle \Delta y^2\rangle = 2Dt,\ D = \frac{k_BT}{6\pi\eta_{\text{ef}} r}`,
  ],
  liveEquations(s, p) {
    const d = selected(s);
    const out = [String.raw`E = \frac{V}{d} = \frac{${texNum(fieldOn(p) ? Vplates(p) : 0)}}{${texNum(GAP)}} = ${texNum(Efield(p))}\ \text{V/m} \qquad \eta = ${texNum(eta(p))}\ \text{Pa·s}`];
    if (s.tq > 0) {
      const vq = RETICLE / s.tq;
      const r = radiusFromFall(vq, T(p), corr(p));
      out.push(String.raw`v_q = \frac{1\ \text{mm}}{${texNum(s.tq)}\ \text{s}} = ${texNum(vq)}\ \text{m/s} \Rightarrow r = ${texNum(r * 1e6)}\ \mu\text{m}`);
      const q = chargeFromTimes(p, s.tq, s.ts, metodo(p) === 1 ? Vplates(p) : s.Vs);
      if (q > 0) out.push(String.raw`q = ${texNum(q)}\ \text{C} = ${texNum(q / E_CHARGE)}\, e`);
    } else if (d) out.push(String.raw`\text{gota selecionada: cronometre a queda entre as linhas do retículo}`);
    out.push(String.raw`e_{\text{estimado}} = ${texNum(estimateE(s.qs))}\ \text{C} \quad (N = ${s.qs.length})`);
    return out;
  },

  params: [
    {
      key: "metodo",
      label: "Método",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Queda livre e subida com campo" },
        { value: 1, label: "Queda livre e tensão de equilíbrio" },
      ],
      live: true,
    },
    {
      key: "campo",
      label: "Campo entre as placas",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Desligado (queda livre)" },
        { value: 1, label: "Ligado" },
      ],
      live: true,
    },
    { key: "V", label: "Tensão nas placas V", unit: "V", min: 0, max: 1500, step: 1, default: 500, live: true },
    { key: "T", label: "Temperatura do ar", unit: "°C", min: 10, max: 40, step: 0.5, default: 23 },
    {
      key: "cunningham",
      label: "Correção de Cunningham na análise",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      options: [
        { value: 1, label: "Aplicar" },
        { value: 0, label: "Não aplicar (Stokes puro)" },
      ],
      live: true,
    },
    {
      key: "luneta",
      label: "Imagem da luneta",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Direita" },
        { value: 1, label: "Invertida (como na luneta real)" },
      ],
      live: true,
    },
  ],

  observables: [
    { key: "y", label: "Altura da gota selecionada", unit: "mm", value: (s) => val(s, (d) => d.y * 1e3) },
    { key: "r", label: "Raio da gota (real)", unit: "µm", value: (s) => val(s, (d) => d.r * 1e6) },
    { key: "vq", label: "Velocidade de queda livre", unit: "mm/s", value: (s, p) => val(s, (d) => fallSpeed(d.r, T(p)) * 1e3) },
    { key: "tq", label: "Tempo de queda em 1 mm (ideal)", unit: "s", value: (s, p) => val(s, (d) => transit(fallSpeed(d.r, T(p)))) },
    { key: "ts", label: "Tempo de subida em 1 mm (ideal)", unit: "s", value: (s, p) => val(s, (d) => transit(drift(d.r, qOf(d), Vplates(p) / GAP, T(p)))) },
    { key: "Veq", label: "Tensão de equilíbrio da gota", unit: "V", value: (s) => val(s, (d) => balanceVoltage(d.r, qOf(d))) },
    { key: "tqMed", label: "Tempo de queda cronometrado", unit: "s", value: (s) => s.tq },
    { key: "tsMed", label: "Tempo de subida cronometrado", unit: "s", value: (s) => s.ts },
    { key: "n", label: "Cargas da gota (n)", unit: "", value: (s) => val(s, (d) => d.n) },
    { key: "N", label: "Gotas registradas", unit: "", value: (s) => s.qs.length },
    { key: "e", label: "e estimado pelo histograma", unit: "C", value: (s) => estimateE(s.qs) },
  ],
  chart: { x: "t", y: "y" },

  scenarios: [
    {
      id: "queda-subida",
      label: "Queda e subida de uma gota",
      params: { metodo: 0, campo: 0, V: 500, T: 23, cunningham: 1, luneta: 0 },
      guide: `### Cronometrando uma gota
1. A gota selecionada (anel) está caindo sem campo. Quando ela cruza a **linha de cima** do retículo o cronômetro dispara; na **linha de baixo**, para: é o tempo de queda $t_q$ em 1 mm.
2. Ligue o **campo** (500 V): a gota sobe. O cronômetro mede o tempo de subida $t_s$.
3. Clique em **Registrar gota**: $v_q = 1\\ \\text{mm}/t_q$ dá o raio pela lei de Stokes, e $q = 6\\pi\\eta_{ef}r(v_q + v_s)/E$.
4. Repare no tremor da gota: é o **movimento browniano**, que limita a precisão do cronômetro.
5. Clique em outra gota na luneta para selecioná-la e repita.`,
      predict: [
        {
          question: "Uma gota de raio duas vezes maior cai, sem campo, com velocidade:",
          options: ["igual", "duas vezes maior", "quatro vezes maior", "oito vezes maior"],
          answer: 2,
          explanation: "Peso ∝ $r^3$ e arrasto de Stokes ∝ $r v$, então $v \\propto r^2$ (a correção de Cunningham muda isso um pouco para gotas muito pequenas).",
        },
      ],
    },
    {
      id: "histograma",
      label: "Quantização: histograma de cargas",
      params: { metodo: 0, campo: 1, V: 600, T: 23, cunningham: 1, luneta: 0 },
      guide: `### A carga vem em pacotes
1. Clique em **Medir 25 gotas** algumas vezes. Cada medida tem o ruído browniano de uma cronometragem real.
2. No histograma de $q/e$, as cargas se agrupam em torno de inteiros: $q = n e$.
3. O valor de $e$ estimado busca o divisor comum das cargas medidas. Compare com $1{,}602 \\times 10^{-19}\\ \\text{C}$.
4. Mude a análise para **Stokes puro** e meça de novo: os picos escorregam para a direita, porque sem a correção de Cunningham as gotas pequenas parecem ter mais carga.`,
      predict: [
        {
          question: "Sem a correção de Cunningham (o ar não é contínuo na escala de 1 µm), o valor de e obtido fica:",
          options: ["maior que o verdadeiro", "menor que o verdadeiro", "igual"],
          answer: 0,
          explanation:
            "Gotas pequenas caem mais depressa do que Stokes prevê (escorregam entre as moléculas do ar). Interpretando $v_q$ com Stokes puro, o raio e a carga saem superestimados.",
        },
      ],
    },
    {
      id: "equilibrio",
      label: "Tensão de equilíbrio",
      params: { metodo: 1, campo: 1, V: 400, T: 23, cunningham: 1, luneta: 1 },
      guide: `### Segurar a gota parada
1. A imagem da luneta agora é **invertida**, como na luneta real: a gota que cai parece subir.
2. Ajuste $V$ até a gota selecionada ficar parada (o observável **tensão de equilíbrio** confere a sua leitura).
3. Desligue o campo e cronometre a queda livre para obter o raio.
4. **Registre**: $q = m'g\\,d/V$ usa a tensão atual. Se $V$ não estiver no equilíbrio, a carga sai errada.`,
    },
  ],

  exercises: [
    {
      id: "raio",
      prompt:
        "Uma gota de óleo (ρ = 886 kg/m³) cai 1,00 mm em {t} s entre as placas, no ar a 23 °C (η = 1,83 × 10⁻⁵ Pa·s). Usando a lei de Stokes sem correção, qual é o raio da gota?",
      vary: { t: [8, 40, 1] },
      answer: { label: "r", unit: "µm", compute: (p) => radiusFromFall(RETICLE / num(p, "t"), 23, false) * 1e6 },
      hint: "r = √(9ηv/(2(ρ − ρ_ar)g)), com v = 1 mm/t.",
    },
    {
      id: "carga",
      prompt:
        "Uma gota de raio {r} µm (ρ = 886 kg/m³) fica parada entre placas separadas por 6,0 mm quando a tensão é {V} V. Qual é a carga da gota, em múltiplos de e?",
      vary: { r: [0.5, 1.2, 2], V: [150, 900, 0] },
      answer: { label: "q/e", unit: "", compute: (p) => (apparentMass(num(p, "r") * 1e-6) * 9.81 * GAP) / num(p, "V") / E_CHARGE },
      hint: "qV/d = m'g, com m' = (4/3)πr³(ρ − ρ_ar).",
    },
  ],

  init: () => initState(),
  step(s, p, t, dt) {
    const rand = rng(s.seed);
    const E = Efield(p);
    const Tc = T(p);
    const drops: Drop[] = [];
    let { timer, tq, ts, Vs } = s;
    for (const d of s.drops) {
      const D = diffusion(d.r, Tc);
      const sig = Math.sqrt(2 * D * dt);
      const y = d.y + drift(d.r, qOf(d), E, Tc) * dt + sig * gaussian(rand);
      const x = d.x + sig * gaussian(rand);
      if (y <= 0 || y >= GAP) continue;
      if (d.id === s.sel) {
        // cronômetro nas linhas do retículo, com interpolação do instante do cruzamento
        const cross = (line: number) => (d.y - line) * (y - line) <= 0 && d.y !== y ? t + (dt * (d.y - line)) / (d.y - y) : NaN;
        const cu = cross(Y_UP);
        const cl = cross(Y_LO);
        if (y < d.y) {
          if (!Number.isNaN(cu)) timer = { dir: -1, t0: cu };
          else if (!Number.isNaN(cl) && timer?.dir === -1) {
            tq = cl - timer.t0;
            timer = null;
          }
        } else {
          if (!Number.isNaN(cl)) timer = { dir: 1, t0: cl };
          else if (!Number.isNaN(cu) && timer?.dir === 1) {
            ts = cu - timer.t0;
            Vs = fieldOn(p) ? Vplates(p) : 0;
            timer = null;
          }
        }
      }
      drops.push({ ...d, x, y });
    }
    const sel = drops.some((d) => d.id === s.sel) ? s.sel : -1;
    if (sel !== s.sel) timer = null;
    return { ...s, drops, sel, timer, tq, ts, Vs, seed: Math.floor(rand() * 2 ** 31) };
  },
  dt: 0.05,
  sampleEvery: 4,
  maxSamples: 6000,

  actions: [
    { id: "borrifar", label: "Borrifar óleo", run: (s) => spray(s) },
    {
      id: "proxima",
      label: "Selecionar outra gota",
      run(s) {
        const vis = s.drops.filter((d) => Math.abs(d.y - YC) < FOV);
        const list = vis.length ? vis : s.drops;
        if (!list.length) return s;
        const i = list.findIndex((d) => d.id === s.sel);
        return { ...s, sel: list[(i + 1) % list.length]!.id, timer: null, tq: 0, ts: 0, Vs: 0 };
      },
    },
    {
      id: "registrar",
      label: "Registrar gota",
      run(s, p) {
        const q = chargeFromTimes(p, s.tq, s.ts, metodo(p) === 1 ? (fieldOn(p) ? Vplates(p) : 0) : s.Vs);
        if (!(q > 0)) return s;
        return { ...s, qs: [...s.qs, q], tq: 0, ts: 0, Vs: 0 };
      },
    },
    { id: "auto", label: "Medir 25 gotas", run: (s, p) => autoMeasure(s, p, 25) },
    { id: "limpar", label: "Limpar histograma", run: (s) => ({ ...s, qs: [] }) },
  ],

  pointer: {
    down(s, p, pt) {
      const best = pickDrop(s, p, pt.x, pt.y);
      return best ? { ...s, sel: best.id, timer: null, tq: 0, ts: 0, Vs: 0 } : undefined;
    },
    cursor: (s, p, pt) => (pickDrop(s, p, pt.x, pt.y) ? "pointer" : undefined),
  },

  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    renderChamber(d, frame.theme, frame.state, frame.params);
    renderScope(d, frame.theme, frame.state, frame.params, frame.t);
    renderHistogram(d, frame.theme, frame.state, frame.params);
  },
});

const eta = (p: Params) => viscosity(T(p));

/** Luneta: centro e raio no palco; escala palco/metro. */
const SC = { cx: 8.6, cy: 6.4, R: 4.6 };
const K = SC.R / FOV;
const invert = (p: Params) => (Math.round(num(p, "luneta")) === 1 ? -1 : 1);
const toScope = (p: Params, d: Drop): [number, number] => [SC.cx + invert(p) * d.x * K, SC.cy + invert(p) * (d.y - YC) * K];

function pickDrop(s: MKState, p: Params, x: number, y: number): Drop | undefined {
  let best: Drop | undefined;
  let bd = 0.45;
  for (const d of s.drops) {
    const [X, Y] = toScope(p, d);
    const dist = Math.hypot(X - x, Y - y);
    if (dist < bd && Math.hypot(X - SC.cx, Y - SC.cy) < SC.R) {
      bd = dist;
      best = d;
    }
  }
  return best;
}

function renderChamber(d: Draw, th: Theme, s: MKState, p: Params) {
  // Câmara (vista lateral esquemática)
  const x0 = 0.6;
  const x1 = 3.6;
  const yb = 4.2;
  const yt = 8.6;
  const on = fieldOn(p);
  d.rect(x0, yt, x1 - x0, 0.25, { fill: on ? th.positive : th.muted });
  d.rect(x0, yb - 0.25, x1 - x0, 0.25, { fill: on ? th.negative : th.muted });
  d.text(on ? `+${fmt(Vplates(p))} V` : "0 V", (x0 + x1) / 2, yt + 0.6, { size: 10, color: on ? th.positive : th.muted });
  d.text("0 V", (x0 + x1) / 2, yb - 0.6, { size: 10, color: th.muted });
  d.text("d = 6 mm", x1 + 0.1, (yb + yt) / 2, { size: 10, color: th.muted, align: "left" });
  // atomizador e furo na placa de cima
  d.polyline([[1.9, 10.6], [2.1, 9.2], [2.1, 8.85]], { color: th.muted, width: 1.5 });
  d.text("atomizador", 2.1, 11, { size: 10, color: th.muted });
  // gotas na escala da câmara
  const ky = (yt - yb) / GAP;
  for (const g of s.drops) {
    const X = (x0 + x1) / 2 + g.x * ky;
    const Y = yb + g.y * ky;
    if (X > x0 && X < x1) d.dot(X, Y, g.id === s.sel ? 2.6 : 1.6, g.id === s.sel ? th.accent : th.text, 0.8);
  }
  // campo de visão da luneta
  d.rect((x0 + x1) / 2 - FOV * ky, yb + (YC - FOV) * ky, 2 * FOV * ky, 2 * FOV * ky, { stroke: th.accent, width: 1, dash: [3, 3] });
  if (on) for (let x = x0 + 0.4; x < x1; x += 0.8) d.arrowPx(x, yt - 0.15, 0, -1, 14, { color: th.series[0]!, width: 1 });
  d.text("luz →", 0.6, 2.9, { size: 10, color: th.series[5]!, align: "left" });
  d.text("campo da luneta (tracejado)", 0.6, 2.2, { size: 10, color: th.muted, align: "left" });
}

function renderScope(d: Draw, th: Theme, s: MKState, p: Params, t: number) {
  d.circle(SC.cx, SC.cy, SC.R + 0.15, { fill: "#05070c", stroke: th.muted, width: 3 });
  const { ctx } = d;
  ctx.save();
  ctx.beginPath();
  ctx.arc(SC.cx, SC.cy, SC.R, 0, 2 * Math.PI);
  ctx.clip();
  // Retículo: linhas a cada 0,25 mm; as de 1 mm mais fortes
  for (let k = -5; k <= 5; k++) {
    const yy = SC.cy + k * 0.25e-3 * K;
    const major = k === -2 || k === 2;
    d.line(SC.cx - SC.R, yy, SC.cx + SC.R, yy, { color: major ? "#e8c860" : "rgba(220,220,200,0.35)", width: major ? 1.4 : 0.7 });
  }
  d.line(SC.cx, SC.cy - SC.R, SC.cx, SC.cy + SC.R, { color: "rgba(220,220,200,0.35)", width: 0.7 });
  for (const g of s.drops) {
    const [X, Y] = toScope(p, g);
    const size = 1.2 + g.r * 2.6e6;
    d.dot(X, Y, size * 2.2, "#fff6c8", 0.12);
    d.dot(X, Y, size, "#fff6c8", 0.95);
    if (g.id === s.sel) d.circle(X, Y, 0.32, { stroke: "#5bd0ff", width: 1.6 });
  }
  ctx.restore();
  d.text("luneta (clique numa gota para selecioná-la)", SC.cx, SC.cy - SC.R - 0.45, { size: 10, color: th.muted });
  d.text("linhas amarelas: 1,00 mm", SC.cx, SC.cy + SC.R + 0.45, { size: 10, color: th.muted });
  // Cronômetro
  const run = s.timer ? t - s.timer.t0 : 0;
  const rows = [
    s.timer ? `cronômetro: ${fmt(run, 3)} s (${s.timer.dir < 0 ? "queda" : "subida"})` : "cronômetro parado",
    `t queda = ${s.tq > 0 ? fmt(s.tq, 4) + " s" : "—"}`,
    `t subida = ${s.ts > 0 ? fmt(s.ts, 4) + " s" : "—"}`,
  ];
  rows.forEach((r, i) => d.text(r, 13.4, 11.6 - i * 0.55, { align: "left", size: 12, weight: i === 0 ? "600" : "400" }));
  const g = selected(s);
  if (g) {
    const Tc = T(p);
    d.text(`gota: v = ${fmt(drift(g.r, qOf(g), Efield(p), Tc) * 1e3)} mm/s,  C = ${fmt(cunningham(g.r))}`, 13.4, 11.6 - 3 * 0.55, { align: "left", size: 11, color: th.muted });
  }
}

function renderHistogram(d: Draw, th: Theme, s: MKState, p: Params) {
  const NB = 90;
  const qmax = 9;
  const counts = new Array<number>(NB).fill(0);
  for (const q of s.qs) {
    const i = Math.floor((q / E_CHARGE / qmax) * NB);
    if (i >= 0 && i < NB) counts[i]!++;
  }
  const peak = Math.max(4, ...counts);
  const P = panel(d, { x0: 13.4, y0: 1.2, x1: 19.6, y1: 8.4 }, { min: 0, max: qmax }, { min: 0, max: peak * 1.1 });
  P.frame({ xlabel: "q / e", ylabel: "gotas", xticks: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9] });
  for (let n = 1; n <= 8; n++) P.line([[n, 0], [n, peak * 1.1]], { color: th.positive, dash: [3, 3], width: 1, alpha: 0.6 });
  const w = qmax / NB;
  counts.forEach((c, i) => {
    if (!c) return;
    const xa = P.X(i * w);
    d.rect(xa, P.box.y0, P.X((i + 1) * w) - xa, P.Y(c) - P.box.y0, { fill: th.accent, alpha: 0.75 });
  });
  const e = estimateE(s.qs);
  d.text(`N = ${s.qs.length}   e ≈ ${e > 0 ? fmt(e, 4) + " C" : "—"}   (${corr(p) ? "com" : "sem"} Cunningham)`, 13.4, 9.15, { align: "left", size: 11 });
}

export default millikan;
