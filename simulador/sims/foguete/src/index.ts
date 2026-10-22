import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

export const G0 = 9.81;
const RHO0 = 1.225;
const HSCALE = 8500;

/** Estado: [h, v, m, estágio atual (0..n), propelente restante no estágio atual, t]. */
export const H = 0;
export const V = 1;
export const M = 2;
export const K = 3;
export const PROP = 4;
export const TT = 5;

export interface Stage {
  /** Massa total do estágio (estrutura + propelente). */
  mass: number;
  prop: number;
  dry: number;
  mdot: number;
}

export const nStages = (p: Params) => Math.max(1, Math.min(3, Math.round(num(p, "n", 1))));

export function stages(p: Params): Stage[] {
  const n = nStages(p);
  const M1 = num(p, "M1", 20000);
  const r = num(p, "r", 0.3);
  const eps = num(p, "eps", 0.1);
  const tb = num(p, "tb", 60);
  const out: Stage[] = [];
  for (let j = 0; j < n; j++) {
    const mass = M1 * r ** j;
    const prop = (1 - eps) * mass;
    out.push({ mass, prop, dry: eps * mass, mdot: prop / tb });
  }
  return out;
}

/** Massa na ignição de cada estágio. */
export function ignitionMasses(p: Params): number[] {
  const st = stages(p);
  const mpl = num(p, "mpl", 500);
  return st.map((_, j) => mpl + st.slice(j).reduce((a, s) => a + s.mass, 0));
}

/** Δv ideal de Tsiolkovsky somado sobre os estágios. */
export function deltaVIdeal(p: Params): number {
  const ve = num(p, "ve", 2500);
  const st = stages(p);
  return ignitionMasses(p).reduce((a, m0, j) => a + ve * Math.log(m0 / (m0 - st[j]!.prop)), 0);
}

/** Δv de um único estágio com a mesma massa total, mesma fração estrutural e mesma carga útil. */
export function deltaVSingle(p: Params): number {
  const ve = num(p, "ve", 2500);
  const st = stages(p);
  const total = st.reduce((a, s) => a + s.mass, 0);
  const mpl = num(p, "mpl", 500);
  const eps = num(p, "eps", 0.1);
  return ve * Math.log((mpl + total) / (mpl + eps * total));
}

/** Velocidade ideal (Tsiolkovsky, sem gravidade nem arrasto) correspondente ao consumo até o estado s. */
export function vIdealNow(s: State, p: Params): number {
  const ve = num(p, "ve", 2500);
  const st = stages(p);
  const mi = ignitionMasses(p);
  const k = s[K]!;
  let dv = 0;
  for (let j = 0; j < Math.min(k, st.length); j++) dv += ve * Math.log(mi[j]! / (mi[j]! - st[j]!.prop));
  if (k < st.length) dv += ve * Math.log(mi[k]! / s[M]!);
  return dv;
}

const gOn = (p: Params) => Math.round(num(p, "grav", 1)) === 1;
const dragOn = (p: Params) => Math.round(num(p, "arrasto", 0)) === 1;
export const rho = (h: number) => RHO0 * Math.exp(-Math.max(0, h) / HSCALE);
export const dragForce = (h: number, v: number, p: Params) => (dragOn(p) ? 0.5 * rho(h) * num(p, "CdA", 1) * v * Math.abs(v) : 0);
export const thrust = (s: State, p: Params) => {
  const st = stages(p)[s[K]!];
  return st && s[PROP]! > 0 ? st.mdot * num(p, "ve", 2500) : 0;
};

function deriv(y: State, p: Params, burning: boolean, mdot: number): State {
  const [h, v, m] = y as [number, number, number];
  const T = burning ? mdot * num(p, "ve", 2500) : 0;
  const g = gOn(p) ? G0 : 0;
  let a = (T - dragForce(h, v, p)) / m - g;
  // apoiado na plataforma: o chão segura enquanto o empuxo não vence o peso
  if (h <= 0 && v <= 0 && a < 0) a = 0;
  return [h <= 0 && v <= 0 && a <= 0 ? 0 : v, a, burning ? -mdot : 0, 0, burning ? -mdot : 0, 1];
}

function rk4seg(y: State, p: Params, dt: number): State {
  const st = stages(p)[y[K]!];
  const burning = !!st && y[PROP]! > 0;
  const md = st ? st.mdot : 0;
  const f = (z: State) => deriv(z, p, burning, md);
  const add = (a: State, b: State, c: number) => a.map((v, i) => v + c * b[i]!);
  const k1 = f(y);
  const k2 = f(add(y, k1, dt / 2));
  const k3 = f(add(y, k2, dt / 2));
  const k4 = f(add(y, k3, dt));
  const out = y.map((v, i) => v + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
  if (out[H]! < 0) {
    out[H] = 0;
    if (out[V]! < 0) out[V] = 0;
  }
  return out;
}

/** Passo com troca de estágio exata no instante da queima total. */
export function advance(y: State, p: Params, dt: number): State {
  let s = y.slice();
  let left = dt;
  const st = stages(p);
  for (let guard = 0; guard < 8 && left > 1e-15; guard++) {
    const cur = st[s[K]!];
    if (cur && s[PROP]! > 0) {
      const tOut = s[PROP]! / cur.mdot;
      if (tOut <= left) {
        s = rk4seg(s, p, tOut);
        // separa a estrutura vazia e acende o próximo estágio
        s[M] = s[M]! - Math.max(0, s[PROP]!) - cur.dry;
        s[K] = s[K]! + 1;
        const nxt = st[s[K]!];
        s[PROP] = nxt ? nxt.prop : 0;
        left -= tOut;
        continue;
      }
    }
    s = rk4seg(s, p, left);
    left = 0;
  }
  return s;
}

const fmt = (v: number, n = 3) => (Number.isFinite(v) ? Number(v.toPrecision(n)).toString().replace(".", ",") : "—");

const COL = { x0: 3, x1: 22, y0: 4, y1: 57 };
const PV = { x0: 32, x1: 97, y0: 35, y1: 57 };
const PM = { x0: 32, x1: 97, y0: 6, y1: 27 };

export const foguete = defineSim({
  id: "foguete",
  title: "Foguete e massa variável",
  course: "FG I",
  topic: "Sistemas de partículas",
  priority: "P2",
  summary:
    "Lançamento vertical com empuxo, gravidade e arrasto opcional, em até três estágios: compare v(t) com a equação de Tsiolkovsky e veja quanto se ganha descartando os tanques vazios.",
  equations: [
    String.raw`m\frac{dv}{dt} = v_e\left|\frac{dm}{dt}\right| - mg - \tfrac12 \rho C_D A\, v|v|`,
    String.raw`\text{Tsiolkovsky: } \Delta v = v_e \ln\frac{m_0}{m_f} \qquad \text{com } g \text{ constante: } v(t_q) = v_e\ln\frac{m_0}{m_f} - g\,t_q`,
    String.raw`\text{estágios: } \Delta v = \sum_j v_e \ln\frac{m_{0,j}}{m_{0,j} - m_{p,j}} \qquad \rho(h) = \rho_0\, e^{-h/H}`,
  ],
  liveEquations(s, p) {
    const ve = num(p, "ve", 2500);
    const vi = vIdealNow(s, p);
    return [
      String.raw`v_{\text{ideal}} = ${texNum(vi)}\ \text{m/s} \qquad v = ${texNum(s[V]!)}\ \text{m/s} \qquad \text{perdas} = ${texNum(vi - s[V]!)}\ \text{m/s}`,
      String.raw`\Delta v_{\text{total}} = ${texNum(deltaVIdeal(p))}\ \text{m/s} \quad (1\ \text{estágio de mesma massa: } ${texNum(deltaVSingle(p))}\ \text{m/s}) \quad v_e = ${texNum(ve)}\ \text{m/s}`,
      String.raw`m = ${texNum(s[M]!)}\ \text{kg} \qquad h = ${texNum(s[H]!)}\ \text{m}`,
    ];
  },

  params: [
    { key: "n", label: "Número de estágios", unit: "", min: 1, max: 3, step: 1, default: 1, options: [{ value: 1, label: "1 estágio" }, { value: 2, label: "2 estágios" }, { value: 3, label: "3 estágios" }] },
    { key: "M1", label: "Massa do 1º estágio", unit: "kg", min: 1000, max: 100000, step: 500, default: 20000 },
    { key: "r", label: "Razão de massa entre estágios", unit: "", min: 0.1, max: 1, step: 0.05, default: 0.3 },
    { key: "eps", label: "Fração estrutural de cada estágio", unit: "", min: 0.03, max: 0.4, step: 0.01, default: 0.1 },
    { key: "mpl", label: "Carga útil", unit: "kg", min: 10, max: 5000, step: 10, default: 500 },
    { key: "ve", label: "Velocidade de exaustão", unit: "m/s", min: 500, max: 4500, step: 50, default: 2500 },
    { key: "tb", label: "Tempo de queima de cada estágio", unit: "s", min: 5, max: 200, step: 1, default: 60 },
    { key: "grav", label: "Gravidade", unit: "", min: 0, max: 1, step: 1, default: 1, options: [{ value: 1, label: "Com gravidade (g = 9,81 m/s²)" }, { value: 0, label: "Sem gravidade (espaço)" }] },
    { key: "arrasto", label: "Arrasto do ar", unit: "", min: 0, max: 1, step: 1, default: 0, options: [{ value: 0, label: "Sem arrasto" }, { value: 1, label: "Com arrasto (atmosfera exponencial)" }] },
    { key: "CdA", label: "Área efetiva de arrasto C_D·A", unit: "m²", min: 0.1, max: 5, step: 0.1, default: 1 },
  ],

  observables: [
    { key: "v", label: "Velocidade", unit: "m/s", value: (s) => s[V]! },
    { key: "vid", label: "Velocidade ideal (Tsiolkovsky)", unit: "m/s", value: vIdealNow },
    { key: "h", label: "Altitude", unit: "m", value: (s) => s[H]! },
    { key: "m", label: "Massa", unit: "kg", value: (s) => s[M]! },
    { key: "T", label: "Empuxo", unit: "N", value: thrust },
    { key: "D", label: "Arrasto", unit: "N", value: (s, p) => dragForce(s[H]!, s[V]!, p) },
    { key: "perda", label: "Perdas (ideal − real)", unit: "m/s", value: (s, p) => vIdealNow(s, p) - s[V]! },
    { key: "est", label: "Estágio em queima", unit: "", value: (s, p) => Math.min(s[K]! + 1, nStages(p) + 1) },
  ],
  chart: { x: "t", y: "v" },

  scenarios: [
    {
      id: "espaco",
      label: "Tsiolkovsky puro",
      params: { n: 1, grav: 0, arrasto: 0, eps: 0.1, ve: 2500, tb: 60 },
      guide: `### A equação do foguete
1. Sem gravidade nem ar, só o empuxo age: $m\\,dv = -v_e\\,dm$, e $v = v_e\\ln(m_0/m)$.
2. Rode: a curva de $v(t)$ coincide com a ideal (tracejada). Ela **acelera cada vez mais**: a mesma vazão empurra uma massa cada vez menor.
3. Dobre a massa do estágio mantendo a carga útil. O $\\Delta v$ dobra?`,
      predict: [
        {
          question: "Com a mesma fração estrutural, dobrar a quantidade de combustível de um foguete faz o Δv:",
          options: ["dobrar", "crescer menos que o dobro", "crescer mais que o dobro"],
          answer: 1,
          explanation: "O Δv depende do logaritmo da razão de massas, e o tanque maior também pesa mais. Por isso não se chega à órbita com um estágio só: o ganho satura em $v_e\\ln(1/\\varepsilon)$.",
        },
      ],
    },
    {
      id: "estagios",
      label: "Vários estágios",
      params: { n: 3, grav: 0, arrasto: 0, M1: 20000, r: 0.3, eps: 0.12, mpl: 300 },
      guide: `### Jogar fora o peso morto
1. Com três estágios, cada tanque vazio é descartado: o próximo estágio só acelera o que ainda é útil.
2. Compare no painel o $\\Delta v$ dos estágios com o de **um único estágio de mesma massa total**.
3. Varie a razão entre estágios: há um valor que maximiza o $\\Delta v$?`,
      predict: [
        {
          question: "Com a mesma massa total, propelente e carga útil, dividir o foguete em 3 estágios dá:",
          options: ["o mesmo Δv", "Δv maior", "Δv menor"],
          answer: 1,
          explanation: "Depois que cada estágio queima, sua estrutura vazia é descartada e não precisa mais ser acelerada: as razões de massa de cada estágio se multiplicam.",
        },
      ],
    },
    {
      id: "gravidade",
      label: "Perda por gravidade",
      params: { n: 1, grav: 1, arrasto: 0, M1: 20000, eps: 0.1, mpl: 500, ve: 2500, tb: 60 },
      guide: `### O preço de subir devagar
1. Com gravidade constante, no fim da queima $v = v_e\\ln(m_0/m_f) - g\\,t_q$.
2. Rode e compare a perda com $g\\,t_q$. Diminua o tempo de queima (mais empuxo): a perda cai.
3. Se o empuxo inicial for menor que o peso ($v_e\\dot m < m_0 g$), o foguete espera na plataforma queimando combustível.`,
    },
    {
      id: "arrasto",
      label: "Com atmosfera",
      params: { n: 2, grav: 1, arrasto: 1, CdA: 1.5, M1: 20000, r: 0.3, eps: 0.1, mpl: 300, tb: 50 },
      guide: `### Arrasto na atmosfera
1. O arrasto $\\tfrac12\\rho C_DA v^2$ é grande na baixa atmosfera e some com a altitude ($\\rho$ cai pela metade a cada ~6 km).
2. Compare o gráfico do arrasto com a altitude: ele tem um máximo (pressão dinâmica máxima, o "Max Q").
3. Qual perda é maior aqui, a de gravidade ou a de arrasto?`,
    },
  ],

  exercises: [
    {
      id: "tsiolkovsky",
      prompt:
        "Um foguete de um estágio tem {M1} kg (fração estrutural {eps}) e leva {mpl} kg de carga útil. A velocidade de exaustão é {ve} m/s. Qual o Δv ideal?",
      vary: { M1: [5000, 50000, 0], eps: [0.05, 0.2, 2], mpl: [100, 2000, 0], ve: [2000, 4000, 0] },
      fixed: { n: 1, grav: 0, arrasto: 0 },
      answer: { label: "Δv", unit: "m/s", compute: (p) => deltaVIdeal(p) },
      hint: "m₀ = carga + estágio; m_f = carga + estrutura.",
    },
    {
      id: "queima-g",
      prompt:
        "O mesmo tipo de foguete ({M1} kg, fração estrutural {eps}, carga {mpl} kg, v_e = {ve} m/s) sobe na vertical queimando tudo em {tb} s, com g = 9,81 m/s² constante e sem ar. Qual a velocidade ao fim da queima?",
      vary: { M1: [5000, 50000, 0], eps: [0.05, 0.2, 2], mpl: [100, 2000, 0], ve: [2000, 4000, 0], tb: [20, 120, 0] },
      fixed: { n: 1, grav: 1, arrasto: 0 },
      answer: { label: "v", unit: "m/s", compute: (p) => deltaVIdeal(p) - G0 * num(p, "tb") },
      hint: "O empuxo inicial precisa vencer o peso (confira); então v = v_e ln(m₀/m_f) − g t.",
    },
  ],

  init(p) {
    const st = stages(p);
    return [0, 0, ignitionMasses(p)[0]!, 0, st[0]!.prop, 0];
  },
  step: (s, p, _t, dt) => advance(s, p, dt),
  dt: 0.05,
  sampleEvery: 4,
  tEnd: 2000,
  stopWhen(s, p, t) {
    if (s[K]! < nStages(p)) return 1;
    if (gOn(p)) return s[V]!;
    return nStages(p) * num(p, "tb", 60) + 40 - t;
  },

  viewport: () => ({ xMin: 0, xMax: 100, yMin: 0, yMax: 60, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, trail, t } = frame;
    const st = stages(p);
    const n = st.length;
    const k = s[K]!;

    // ---- coluna de altitude com o foguete ----
    const hs = trail.map((x) => x[H]!);
    const hTop = Math.max(1000, ...hs, s[H]!) * 1.15;
    const Yh = (h: number) => COL.y0 + (h / hTop) * (COL.y1 - COL.y0 - 10);
    d.line(COL.x0, COL.y0, COL.x0, COL.y1 - 10, { color: theme.muted, width: 1 });
    for (let i = 0; i <= 4; i++) {
      const hh = (hTop * i) / 4.6;
      d.line(COL.x0, Yh(hh), COL.x0 + 1, Yh(hh), { color: theme.muted, width: 1 });
      d.text(hh >= 1000 ? `${fmt(hh / 1000, 2)} km` : `${fmt(hh, 2)} m`, COL.x0 + 1.5, Yh(hh), { align: "left", size: 9, color: theme.muted });
    }
    d.rect(0, COL.y0 - 2, 25, 2, { fill: theme.ground });
    const cx = 15;
    let yb = Yh(s[H]!);
    const scaleW = 2.2;
    for (let j = k; j < n; j++) {
      const hgt = 2.2 + 3.6 * (st[j]!.mass / st[0]!.mass) ** (1 / 3);
      const w = scaleW * (0.6 + 0.4 * (st[j]!.mass / st[0]!.mass) ** (1 / 3));
      const frac = j === k ? s[PROP]! / st[j]!.prop : 1;
      d.rect(cx - w / 2, yb, w, hgt, { fill: theme.series[j]!, alpha: 0.35, stroke: theme.text, width: 1 });
      d.rect(cx - w / 2, yb, w, hgt * frac, { fill: theme.series[j]!, alpha: 0.85 });
      if (j === k && s[PROP]! > 0) {
        const fl = 2 + 1.5 * Math.abs(Math.sin(t * 40));
        d.polyline(
          [
            [cx - w * 0.35, yb],
            [cx, yb - fl],
            [cx + w * 0.35, yb],
          ],
          { close: true, fill: theme.series[5]!, color: theme.series[1]!, width: 1 },
        );
      }
      yb += hgt;
    }
    d.polyline(
      [
        [cx - 0.9, yb],
        [cx, yb + 2],
        [cx + 0.9, yb],
      ],
      { close: true, fill: theme.muted, color: theme.text, width: 1 },
    );
    d.text(k < n ? `Estágio ${k + 1} de ${n}` : "Queima encerrada", cx, COL.y1 - 4, { size: 11, weight: "600" });
    d.text(`h = ${fmt(s[H]!)} m`, cx, COL.y1 - 6.5, { size: 11 });

    // ---- gráficos v(t) e m(t) ----
    const tq = n * num(p, "tb", 60);
    const tMax = Math.max(tq * 1.25, t * 1.05, 1);
    const dvI = deltaVIdeal(p);
    const vMax = Math.max(dvI * 1.1, ...trail.map((x) => x[V]!), 1);
    const m0 = ignitionMasses(p)[0]!;
    const X = (box: typeof PV, tt: number) => box.x0 + (tt / tMax) * (box.x1 - box.x0);
    const Yv = (v: number) => PV.y0 + (v / vMax) * (PV.y1 - PV.y0);
    const Ym = (m: number) => PM.y0 + (m / m0) * (PM.y1 - PM.y0);
    for (const box of [PV, PM]) {
      d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, { stroke: theme.grid, width: 1 });
      for (let j = 1; j <= n; j++) d.line(X(box, j * num(p, "tb", 60)), box.y0, X(box, j * num(p, "tb", 60)), box.y1, { color: theme.grid, width: 1, dash: [3, 3] });
    }
    const dtS = (num(p, "tb", 60) * n) / 400;
    // v ideal ao longo da queima (analítico), em função de t
    const ideal: [number, number][] = [];
    const mi = ignitionMasses(p);
    const ve = num(p, "ve", 2500);
    for (let tt = 0; tt <= tq + 1e-9; tt += dtS) {
      const j = Math.min(n - 1, Math.floor(tt / num(p, "tb", 60)));
      let dv = 0;
      for (let q = 0; q < j; q++) dv += ve * Math.log(mi[q]! / (mi[q]! - st[q]!.prop));
      const mNow = mi[j]! - st[j]!.mdot * (tt - j * num(p, "tb", 60));
      dv += ve * Math.log(mi[j]! / mNow);
      ideal.push([X(PV, tt), Yv(dv)]);
    }
    ideal.push([X(PV, tMax), Yv(dvI)]);
    d.polyline(ideal, { color: theme.muted, dash: [6, 4], width: 1.5 });
    const tr = [...trail, s];
    d.polyline(tr.map((x) => [X(PV, x[TT] ?? 0), Yv(x[V]!)] as [number, number]), { color: theme.accent, width: 2 });
    d.polyline(tr.map((x) => [X(PM, x[TT] ?? 0), Ym(x[M]!)] as [number, number]), { color: theme.series[1]!, width: 2 });
    d.text("v(t): simulação (azul) e Tsiolkovsky ideal (tracejado)", PV.x0, PV.y1 + 1.5, { align: "left", size: 11, weight: "600" });
    d.text("m(t): degraus = estágios descartados", PM.x0, PM.y1 + 1.5, { align: "left", size: 11, weight: "600" });
    d.text(`${fmt(vMax)} m/s`, PV.x0 - 0.5, PV.y1, { align: "right", size: 9, color: theme.muted });
    d.text("0", PV.x0 - 0.5, PV.y0, { align: "right", size: 9, color: theme.muted });
    d.text(`${fmt(m0)} kg`, PM.x0 - 0.5, PM.y1, { align: "right", size: 9, color: theme.muted });
    d.text("0", PM.x0 - 0.5, PM.y0, { align: "right", size: 9, color: theme.muted });
    d.text(`t (s), até ${fmt(tMax)} s`, PM.x1, PM.y0 - 1.6, { align: "right", size: 9, color: theme.muted });

    // ---- comparação com a fórmula ideal ----
    const vi = vIdealNow(s, p);
    const lines = [
      `Δv ideal (${n} estágio${n > 1 ? "s" : ""}): ${fmt(dvI)} m/s`,
      `1 estágio de mesma massa: ${fmt(deltaVSingle(p))} m/s`,
      `Agora: v = ${fmt(s[V]!)} m/s, ideal ${fmt(vi)} m/s`,
      `Perdas: ${fmt(vi - s[V]!)} m/s${gOn(p) ? ` (g·t = ${fmt(G0 * Math.min(t, tq))} m/s)` : ""}`,
    ];
    lines.forEach((ln, i) => d.text(ln, PM.x1 - 1, PM.y1 - 1.5 - i * 2, { align: "right", size: 10, weight: i === 0 ? "700" : "400" }));
    const T0 = st[0]!.mdot * ve;
    if (gOn(p) && T0 < m0 * G0) d.text("Empuxo inicial menor que o peso: o foguete espera na plataforma", PM.x0 + 1, PM.y0 + 1.5, { align: "left", size: 10, color: theme.negative, weight: "700" });
  },
});

export default foguete;
