import { defineSim, draw, num, rk4, texNum, type Params, type State } from "@fisilab/core";
import { PRESETS, at, closest, firstAtHeight, trackOf, turningPoints, type Pt, type Track } from "./track.ts";

export { PRESETS, at, trackOf, turningPoints, buildTrack } from "./track.ts";
export type { Pt, Track } from "./track.ts";

/** Região onde a pista pode ser desenhada (m). */
export const AREA = { x0: -10, x1: 10, y0: 0, y1: 9 };
/** Painel do gráfico U(s) no palco. */
const GR = { x0: -10, x1: 10, y0: -7.3, y1: -2.2 };
/** Barras de energia. */
const BAR = { x0: 10.75, w: 0.55, gap: 0.22 };
const GRAB = 0.45; // raio para pegar um ponto de controle, m
const CAR_H = 0.28; // altura do centro do carrinho acima do trilho, m

export interface Coaster {
  pts: Pt[];
  /** Coordenada de arco, m. */
  s: number;
  /** Velocidade ao longo da pista (positiva no sentido de s crescente), m/s. */
  v: number;
  /** Energia dissipada pelo atrito (térmica), J. */
  q: number;
  /** Índice do ponto de controle sendo arrastado. */
  drag: number | null;
}

const G = (p: Params) => num(p, "g", 9.81);
const M = (p: Params) => num(p, "m", 60);
const MU = (p: Params) => num(p, "mu", 0);

export interface Dyn {
  /** Aceleração tangencial, m/s². */
  a: number;
  /** Força normal (positiva empurrando o carrinho para o lado de cima do trilho), N. */
  N: number;
  /** Potência dissipada, W. */
  qdot: number;
}

/** Dinâmica na pista: m dv/dt = −mg sen φ − μ|N| sinal(v), N = m(g cos φ + v²κ). */
export function dynamics(tr: Track, s: number, v: number, p: Params): Dyn {
  const g = G(p), m = M(p), mu = MU(p);
  const q = at(tr, s);
  const n = g * q.cos + v * v * q.k; // N/m
  let a: number;
  if (v !== 0) a = -g * q.sin - mu * Math.abs(n) * Math.sign(v);
  else {
    // Parado: atrito estático segura enquanto |g sen φ| ≤ μ|g cos φ|.
    const drive = -g * q.sin;
    const lim = mu * Math.abs(n);
    a = Math.abs(drive) <= lim ? 0 : drive - Math.sign(drive) * lim;
  }
  return { a, N: m * n, qdot: m * mu * Math.abs(n) * Math.abs(v) };
}

const sticks = (tr: Track, s: number, p: Params) => {
  const q = at(tr, s);
  return Math.abs(q.sin) <= MU(p) * Math.abs(q.cos);
};

function integrate(tr: Track, y: State, p: Params, t: number, dt: number): State {
  const f = (z: State): State => {
    const d = dynamics(tr, z[0]!, z[1]!, p);
    return [z[1]!, d.a, d.qdot];
  };
  return rk4(f, y, p, t, dt);
}

export const K = (s: Coaster, p: Params) => 0.5 * M(p) * s.v * s.v;
export const U = (s: Coaster, p: Params) => M(p) * G(p) * at(trackOf(s.pts), s.s).y;

/** Estado inicial na pista `pts`, partindo do repouso (ou com v0) na altura h0. */
export function startOn(pts: Pt[], p: Params): Coaster {
  const tr = trackOf(pts);
  return { pts, s: firstAtHeight(tr, num(p, "h0", 7)), v: num(p, "v0"), q: 0, drag: null };
}

function clampPt(x: number, y: number): Pt {
  return [Math.max(AREA.x0, Math.min(AREA.x1, x)), Math.max(AREA.y0 + 0.1, Math.min(AREA.y1, y))];
}

function nearestPoint(s: Coaster, x: number, y: number): number | null {
  let best: number | null = null, bd = GRAB;
  s.pts.forEach(([px, py], i) => {
    const d = Math.hypot(px - x, py - y);
    if (d < bd) {
      bd = d;
      best = i;
    }
  });
  return best;
}

export const montanhaRussa = defineSim<Coaster>({
  id: "montanha-russa",
  title: "Pista de skate e montanha-russa: energia",
  course: "FG I",
  topic: "Energia",
  priority: "P1",
  summary:
    "Um carrinho preso a uma pista que você desenha arrastando os pontos de controle. Acompanhe as barras de energia cinética, potencial e térmica e o gráfico U(s) com os pontos de retorno.",
  equations: [
    String.raw`K + U + E_{\text{térm}} = \text{constante} \qquad K = \tfrac12 m v^2 \qquad U = m g\,y(s)`,
    String.raw`m\frac{dv}{ds}\,v = -m g \sin\varphi - \mu |N|\,\operatorname{sinal}(v)`,
    String.raw`N = m\left(g\cos\varphi + v^2\kappa\right) \qquad \frac{dE_{\text{térm}}}{dt} = \mu |N|\,|v|`,
    String.raw`\text{retorno: } U(s_r) = K + U \;\Rightarrow\; v(s_r) = 0`,
  ],
  liveEquations(s, p) {
    const k = K(s, p), u = U(s, p);
    const tr = trackOf(s.pts);
    const d = dynamics(tr, s.s, s.v, p);
    return [
      String.raw`K + U + E_{\text{térm}} = ${texNum(k)} + ${texNum(u)} + ${texNum(s.q)} = ${texNum(k + u + s.q)}\ \text{J}`,
      String.raw`v = ${texNum(s.v)}\ \text{m/s} \qquad y = ${texNum(at(tr, s.s).y)}\ \text{m} \qquad N = ${texNum(d.N)}\ \text{N}`,
    ];
  },

  params: [
    {
      key: "pista",
      label: "Pista pronta",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Meia-pipe" },
        { value: 1, label: "Montanha-russa com loop" },
        { value: 2, label: "Rampa dupla (dois vales)" },
      ],
    },
    { key: "h0", label: "Altura de partida", unit: "m", min: 0.5, max: 8, step: 0.1, default: 6 },
    { key: "v0", label: "Velocidade inicial", unit: "m/s", min: -10, max: 10, step: 0.1, default: 0 },
    { key: "m", label: "Massa (carrinho + pessoa)", unit: "kg", min: 10, max: 200, step: 1, default: 60, live: true },
    { key: "mu", label: "Coeficiente de atrito μ", unit: "", min: 0, max: 0.3, step: 0.005, default: 0, live: true },
    {
      key: "g",
      label: "Gravidade",
      unit: "m/s²",
      min: 1.62,
      max: 24.79,
      step: 0.01,
      default: 9.81,
      live: true,
      options: [
        { value: 9.81, label: "Terra (9,81 m/s²)" },
        { value: 1.62, label: "Lua (1,62 m/s²)" },
        { value: 3.71, label: "Marte (3,71 m/s²)" },
        { value: 24.79, label: "Júpiter (24,79 m/s²)" },
      ],
    },
  ],

  observables: [
    { key: "s", label: "Posição ao longo da pista s", unit: "m", value: (s) => s.s },
    { key: "y", label: "Altura y", unit: "m", value: (s) => at(trackOf(s.pts), s.s).y },
    { key: "v", label: "Velocidade v", unit: "m/s", value: (s) => s.v },
    { key: "K", label: "Energia cinética K", unit: "J", value: K },
    { key: "U", label: "Energia potencial U", unit: "J", value: U },
    { key: "Q", label: "Energia térmica (atrito)", unit: "J", value: (s) => s.q },
    { key: "Em", label: "Energia mecânica K + U", unit: "J", value: (s, p) => K(s, p) + U(s, p) },
    { key: "E", label: "Energia total K + U + térmica", unit: "J", value: (s, p) => K(s, p) + U(s, p) + s.q },
    { key: "N", label: "Força normal N", unit: "N", value: (s, p) => dynamics(trackOf(s.pts), s.s, s.v, p).N },
    { key: "at", label: "Aceleração tangencial", unit: "m/s²", value: (s, p) => dynamics(trackOf(s.pts), s.s, s.v, p).a },
  ],
  conserved: "E",
  chart: { x: "t", y: "v" },

  scenarios: [
    {
      id: "meia-pipe",
      label: "Meia-pipe sem atrito",
      params: { pista: 0, h0: 6, v0: 0, mu: 0 },
      guide: `### Sobe até a mesma altura
1. Antes de rodar, olhe o gráfico $U(s)$ embaixo: a linha tracejada é a energia mecânica $E = K + U$.
2. Os pontos de retorno estão onde $U(s) = E$: ali $K = 0$ e o carrinho para por um instante.
3. Rode e confira: as barras trocam $K$ por $U$, mas a soma não muda.
4. Arraste um ponto de controle do lado direito e deixe a rampa mais suave ou mais íngreme. A altura máxima muda?`,
      predict: [
        {
          question: "Solto do repouso a 6 m de altura no lado esquerdo da meia-pipe sem atrito, até que altura o carrinho sobe do lado direito?",
          options: ["menos de 6 m, porque perde velocidade na subida", "exatamente 6 m", "mais de 6 m, porque ganha impulso no fundo"],
          answer: 1,
          explanation: "Sem atrito, $K + U$ se conserva. No ponto de retorno $K = 0$, então $U = mgh$ volta ao valor inicial: a mesma altura, qualquer que seja a forma da pista.",
        },
      ],
    },
    {
      id: "atrito",
      label: "Meia-pipe com atrito",
      params: { pista: 0, h0: 7, v0: 0, mu: 0.05 },
      guide: `### Para onde vai a energia?
1. Rode e observe a barra de energia térmica crescer enquanto $K + U$ diminui.
2. No gráfico $U(s)$, a linha de energia desce e os pontos de retorno se aproximam do fundo.
3. Repare que o atrito tira mais energia no fundo: lá a normal é maior, $N = m(g\\cos\\varphi + v^2\\kappa)$.
4. A soma $K + U + E_{\\text{térm}}$ continua constante: é o que o medidor de conservação mostra.`,
    },
    {
      id: "loop",
      label: "Loop",
      params: { pista: 1, h0: 7.5, v0: 0, mu: 0 },
      guide: `### A normal no alto do loop
1. Rode e acompanhe a força normal $N$ (seta verde) dentro do loop.
2. No alto, $N = m(v^2/R - g)$. Se $v^2 < gR$, a pista precisaria **puxar** o carrinho: $N < 0$. É por isso que montanhas-russas têm rodas presas por baixo do trilho.
3. Diminua a altura de partida até a normal no alto ficar negativa. Compare com a previsão: o fundo do loop está a $0{,}4$ m e o raio é $R \\approx 1{,}6$ m, então $h_0 \\approx 0{,}4 + 2{,}5R = 4{,}4$ m.`,
      predict: [
        {
          question: "Um carrinho solto sem atrito de uma altura h acima do fundo de um loop de raio R só completa o loop sem ajuda do trilho se:",
          options: ["h ≥ 2R", "h ≥ 2,5R", "h ≥ 3R"],
          answer: 1,
          explanation: "No alto é preciso $v^2 \\ge gR$. Pela conservação, $mg h = mg\\,2R + \\tfrac12 m v^2 \\ge mg\\,2R + \\tfrac12 mgR$, logo $h \\ge 2{,}5R$.",
        },
      ],
    },
    {
      id: "dois-vales",
      label: "Barreira de potencial",
      params: { pista: 2, h0: 3.2, v0: 0, mu: 0 },
      guide: `### Preso num vale
1. A lombada no meio é uma **barreira de potencial**. Com $E$ menor que o topo dela, o carrinho fica preso no vale da esquerda.
2. Veja no gráfico $U(s)$ os dois pontos de retorno do mesmo lado da lombada.
3. Aumente a altura de partida até o carrinho passar para o outro vale. Qual é a altura mínima?`,
      predict: [
        {
          question: "Solto do repouso a 3,2 m de altura, sem atrito, o carrinho passa pela lombada de 3,8 m?",
          options: ["sim, se a descida for íngreme o bastante", "não, nunca", "só se a massa for pequena"],
          answer: 1,
          explanation: "Para passar seria preciso $U = mg(3{,}8\\,\\text{m}) \\le E = mg(3{,}2\\,\\text{m})$. Isso não depende da forma da descida nem da massa.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "velocidade",
      prompt:
        "Um skatista parte do repouso a {h} m de altura numa pista sem atrito. Qual é a sua velocidade quando passa por um ponto a {y} m de altura (g = 9,81 m/s²)?",
      vary: { h: [3, 8, 1], y: [0, 2.5, 1] },
      answer: { label: "v", unit: "m/s", compute: (p) => Math.sqrt(2 * 9.81 * (num(p, "h") - num(p, "y"))) },
      hint: "Iguale a energia mecânica nos dois pontos: mgh = mgy + ½mv².",
    },
    {
      id: "termica",
      prompt:
        "Um carrinho de {m} kg parte do repouso a {h} m de altura e, depois de algumas idas e vindas numa pista com atrito, sobe no máximo até {y} m. Quanta energia virou térmica até esse ponto de retorno (g = 9,81 m/s²)?",
      vary: { m: [20, 120, 0], h: [4, 8, 1], y: [1, 3.5, 1] },
      answer: { label: "E_térm", unit: "J", compute: (p) => num(p, "m") * 9.81 * (num(p, "h") - num(p, "y")) },
      hint: "No ponto de retorno K = 0: a energia térmica é a perda de energia potencial.",
    },
  ],

  init: (p) => startOn(PRESETS[Math.round(num(p, "pista"))] ?? PRESETS[0]!, p),

  step(st, p, t, dt) {
    const tr = trackOf(st.pts);
    const y0: State = [st.s, st.v, st.q];
    let y = integrate(tr, y0, p, t, dt);
    // Para-choques elásticos nas pontas: localiza o instante do contato e inverte v.
    if (y[0]! < 0 || y[0]! > tr.L) {
      const bound = y[0]! < 0 ? 0 : tr.L;
      const tau = Math.max(0, Math.min(dt, (dt * (bound - y0[0]!)) / (y[0]! - y0[0]!)));
      y = integrate(tr, y0, p, t, tau);
      y[0] = bound;
      y[1] = -y[1]!;
      y = integrate(tr, y, p, t + tau, dt - tau);
      y[0] = Math.max(0, Math.min(tr.L, y[0]!));
    }
    // Atrito estático: se a velocidade troca de sinal num ponto onde o atrito segura, para.
    if (st.v !== 0 && st.v * y[1]! <= 0 && sticks(tr, y[0]!, p)) y[1] = 0;
    return { ...st, s: y[0]!, v: y[1]!, q: y[2]! };
  },
  dt: 1e-3,
  sampleEvery: 20,
  maxSamples: 6000,

  pointer: {
    down(s, _p, pt) {
      const i = nearestPoint(s, pt.x, pt.y);
      if (i !== null) return { ...s, drag: i };
      const c = closest(trackOf(s.pts), pt.x, pt.y);
      if (c.d < 0.5) return { ...s, s: c.s, v: 0, q: 0 }; // solta o carrinho do repouso ali
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || s.drag === null) return undefined;
      const pts = s.pts.slice();
      pts[s.drag] = clampPt(pt.x, pt.y);
      const L0 = trackOf(s.pts).L;
      const L1 = trackOf(pts).L;
      return { ...s, pts, s: L0 > 0 ? (s.s / L0) * L1 : 0 };
    },
    up: (s) => (s.drag === null ? undefined : { ...s, drag: null }),
    cursor(s, _p, pt) {
      if (nearestPoint(s, pt.x, pt.y) !== null) return "grab";
      return closest(trackOf(s.pts), pt.x, pt.y).d < 0.5 ? "pointer" : undefined;
    },
  },

  actions: [
    {
      id: "adicionar",
      label: "Adicionar ponto",
      run(s) {
        // Insere um ponto no meio do trecho mais longo.
        let best = 0, bl = -1;
        for (let i = 0; i < s.pts.length - 1; i++) {
          const l = Math.hypot(s.pts[i + 1]![0] - s.pts[i]![0], s.pts[i + 1]![1] - s.pts[i]![1]);
          if (l > bl) {
            bl = l;
            best = i;
          }
        }
        const a = s.pts[best]!, b = s.pts[best + 1]!;
        const pts = [...s.pts.slice(0, best + 1), clampPt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2), ...s.pts.slice(best + 1)];
        return { ...s, pts, s: Math.min(s.s, trackOf(pts).L) };
      },
    },
    {
      id: "remover",
      label: "Remover ponto",
      run(s) {
        if (s.pts.length <= 3) return s;
        // Remove o ponto interno cuja retirada menos altera a pista.
        let best = 1, bd = Infinity;
        for (let i = 1; i < s.pts.length - 1; i++) {
          const a = s.pts[i - 1]!, b = s.pts[i]!, c = s.pts[i + 1]!;
          const d = Math.hypot(b[0] - (a[0] + c[0]) / 2, b[1] - (a[1] + c[1]) / 2);
          if (d < bd) {
            bd = d;
            best = i;
          }
        }
        const pts = s.pts.filter((_, i) => i !== best);
        return { ...s, pts, s: Math.min(s.s, trackOf(pts).L) };
      },
    },
    { id: "soltar", label: "Soltar da altura inicial", run: (s, p) => ({ ...startOn(s.pts, p) }) },
  ],

  viewport: () => ({ xMin: -10.4, xMax: 13.7, yMin: -8, yMax: 9.3 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: st, params: p, theme } = frame;
    const tr = trackOf(st.pts);
    const m = M(p), g = G(p);
    const here = at(tr, st.s);
    const dyn = dynamics(tr, st.s, st.v, p);
    const k = K(st, p), u = U(st, p);
    const Em = k + u;
    const hE = Em / (m * g); // altura equivalente da energia mecânica
    const [sl, sr] = turningPoints(tr, st.s, hE);

    // Fundo e chão
    d.grid(AREA.x0, AREA.x1, AREA.y0, AREA.y1, 1);
    d.rect(AREA.x0, -0.45, AREA.x1 - AREA.x0, 0.45, { fill: theme.ground });
    d.line(AREA.x0, 0, AREA.x1, 0, { color: theme.muted, width: 1 });
    for (let yy = 0; yy <= 8; yy += 2) d.text(`${yy}`, AREA.x0 + 0.05, yy, { color: theme.muted, size: 10, align: "left", dy: -6 });
    d.text("y (m)", AREA.x0 + 0.05, 8.85, { color: theme.muted, size: 10, align: "left" });

    // Linha da energia mecânica no palco: o carrinho nunca passa acima dela.
    if (hE < AREA.y1) {
      d.line(AREA.x0, hE, AREA.x1, hE, { color: theme.accent, dash: [6, 5], width: 1, alpha: 0.6 });
      d.text("altura máxima possível E/mg", AREA.x1 - 0.1, hE, { color: theme.accent, size: 10, align: "right", dy: -8 });
    }

    // Pilares e trilho
    for (let i = 0; i < tr.s.length; i += 24) {
      if (tr.cos[i]! > 0.4 && tr.k[i]! > -2) d.line(tr.x[i]!, tr.y[i]!, tr.x[i]!, 0, { color: theme.muted, width: 1, alpha: 0.35 });
    }
    const rail: [number, number][] = [];
    for (let i = 0; i < tr.s.length; i++) rail.push([tr.x[i]!, tr.y[i]!]);
    d.polyline(rail, { color: theme.text, width: 3.5 });
    // Para-choques nas pontas
    for (const sEnd of [0, tr.L]) {
      const e = at(tr, sEnd);
      d.line(e.x + e.sin * 0.35, e.y - e.cos * 0.15, e.x - e.sin * 0.6, e.y + e.cos * 0.6, { color: theme.negative, width: 4 });
    }
    // Pontos de controle
    st.pts.forEach(([px, py], i) => {
      d.circle(px, py, 0, { minPx: 6, fill: theme.accent, alpha: st.drag === i ? 0.9 : 0.35 });
      d.circle(px, py, 0, { minPx: 6, stroke: theme.accent, width: 1.5 });
    });

    // Pontos de retorno na pista
    for (const sR of [sl, sr]) {
      if (sR === null) continue;
      const r = at(tr, sR);
      d.dot(r.x, r.y, 4, theme.accent);
    }

    // Carrinho
    const nx = -here.sin, ny = here.cos; // normal "para cima" do trilho
    const cx = here.x + nx * CAR_H, cy = here.y + ny * CAR_H;
    const ang = Math.atan2(here.sin, here.cos);
    d.box(cx, cy, 0.9, 0.42, ang, { fill: theme.series[4] ?? theme.accent, stroke: theme.text, width: 1 });
    for (const w of [-0.28, 0.28]) d.circle(here.x + here.cos * w + nx * 0.08, here.y + here.sin * w + ny * 0.08, 0.09, { fill: theme.text });

    // Vetores: velocidade, peso e normal
    if (Math.abs(st.v) > 1e-3) {
      d.arrowPx(cx, cy, here.cos * st.v, here.sin * st.v, Math.min(120, 8 * Math.abs(st.v)), { color: theme.accent });
      d.text("v", cx + here.cos * Math.sign(st.v) * 0.9, cy + here.sin * Math.sign(st.v) * 0.9 + 0.35, { color: theme.accent, size: 12, weight: "600" });
    }
    const fScale = 36 / (m * g); // peso = 36 px
    d.arrowPx(cx, cy, 0, -1, 36, { color: theme.text });
    d.text("P", cx + 0.3, cy - 36 * d.px - 0.1, { size: 12, weight: "600" });
    if (Math.abs(dyn.N) > 1e-6) {
      const lenN = Math.min(160, Math.abs(dyn.N) * fScale);
      const sg = Math.sign(dyn.N);
      d.arrowPx(cx, cy, nx * sg, ny * sg, lenN, { color: theme.series[2] });
      d.text("N", cx + nx * sg * (lenN * d.px + 0.25), cy + ny * sg * (lenN * d.px + 0.25), { color: theme.series[2], size: 12, weight: "600" });
    }
    if (dyn.N < 0) d.text("N < 0: o trilho precisa puxar o carrinho", 0, 8.75, { color: theme.positive, size: 12, weight: "600" });

    // Barras de energia (altura da barra = energia/(mg), na mesma escala do palco)
    const bars: [string, number, string][] = [
      ["K", k, theme.series[0]!],
      ["U", u, theme.series[2]!],
      ["Q", st.q, theme.positive],
    ];
    const toH = (E: number) => Math.min(8.6, Math.max(0, E / (m * g)));
    bars.forEach(([lab, val, col], i) => {
      const x = BAR.x0 + i * (BAR.w + BAR.gap);
      d.rect(x, 0, BAR.w, toH(val), { fill: col, alpha: 0.85 });
      d.text(lab, x + BAR.w / 2, -0.25, { color: col, size: 12, weight: "600" });
    });
    const xt = BAR.x0 + 3 * (BAR.w + BAR.gap);
    let acc = 0;
    bars.forEach(([, val, col]) => {
      d.rect(xt, toH(acc), BAR.w, toH(acc + val) - toH(acc), { fill: col, alpha: 0.85 });
      acc += val;
    });
    d.rect(xt, 0, BAR.w, toH(acc), { stroke: theme.text, width: 1 });
    d.text("E", xt + BAR.w / 2, -0.25, { size: 12, weight: "600" });
    d.text("Energia (J)", BAR.x0 + 1.45, 8.85, { color: theme.muted, size: 11 });
    d.text(`E = ${(k + u + st.q).toFixed(0)} J`, BAR.x0 + 1.45, Math.min(8.3, toH(acc) + 0.35), { size: 11 });
    if (acc / (m * g) > 8.6) d.text("▲ fora da escala", BAR.x0 + 1.45, 7.8, { color: theme.muted, size: 10 });

    // Gráfico U(s) com a linha de energia e os pontos de retorno
    const Hmax = 9;
    const gx = (s: number) => GR.x0 + (s / Math.max(tr.L, 1e-9)) * (GR.x1 - GR.x0);
    const gy = (h: number) => GR.y0 + (Math.max(0, Math.min(Hmax, h)) / Hmax) * (GR.y1 - GR.y0);
    d.rect(GR.x0, GR.y0, GR.x1 - GR.x0, GR.y1 - GR.y0, { stroke: theme.grid, width: 1 });
    const curve: [number, number][] = [];
    for (let i = 0; i < tr.s.length; i += 2) curve.push([gx(tr.s[i]!), gy(tr.y[i]!)]);
    // Região proibida (U > E) sombreada
    for (let i = 0; i < tr.s.length - 2; i += 2) {
      if (tr.y[i]! > hE && hE < Hmax) {
        const x0 = gx(tr.s[i]!), x1 = gx(tr.s[Math.min(tr.s.length - 1, i + 2)]!);
        d.rect(x0, gy(hE), x1 - x0, gy(tr.y[i]!) - gy(hE), { fill: theme.muted, alpha: 0.18 });
      }
    }
    d.polyline(curve, { color: theme.series[2], width: 2 });
    if (hE <= Hmax) {
      d.line(GR.x0, gy(hE), GR.x1, gy(hE), { color: theme.accent, dash: [6, 4], width: 1.5 });
      d.text("E = K + U", GR.x1 + 0.15, gy(hE), { color: theme.accent, size: 11, align: "left" });
    } else d.text("E acima da escala: sem pontos de retorno", GR.x1 - 0.1, GR.y1 - 0.3, { color: theme.accent, size: 11, align: "right" });
    for (const sR of [sl, sr]) {
      if (sR === null) continue;
      d.line(gx(sR), GR.y0, gx(sR), gy(hE), { color: theme.accent, dash: [3, 3], width: 1 });
      d.dot(gx(sR), gy(hE), 4.5, theme.accent);
      d.text("retorno", gx(sR), gy(hE), { color: theme.accent, size: 10, dy: -10 });
    }
    // Carrinho no gráfico: K é a distância entre U(s) e a linha de E
    const xc = gx(st.s);
    d.dot(xc, gy(here.y), 5, theme.series[4] ?? theme.accent);
    if (hE <= Hmax && gy(hE) - gy(here.y) > 0.25) {
      d.arrow(xc, gy(here.y), 0, gy(hE) - gy(here.y), { color: theme.series[0], width: 1.5, head: 6 });
      d.text("K", xc + 0.25, (gy(hE) + gy(here.y)) / 2, { color: theme.series[0], size: 11, weight: "600", align: "left" });
    }
    // Eixos do gráfico
    d.text("U(s) = mg·y(s): energia potencial ao longo da pista", GR.x0 + 0.1, GR.y1 + 0.3, { color: theme.muted, size: 11, align: "left" });
    d.text("0", GR.x0, GR.y0 - 0.3, { color: theme.muted, size: 10 });
    d.text(`s = ${tr.L.toFixed(1).replace(".", ",")} m`, GR.x1, GR.y0 - 0.3, { color: theme.muted, size: 10, align: "right" });
    d.text("s (m)", (GR.x0 + GR.x1) / 2, GR.y0 - 0.3, { color: theme.muted, size: 10 });
    d.text(`${(m * g * Hmax).toFixed(0)} J`, GR.x1 + 0.15, GR.y1 - 0.1, { color: theme.muted, size: 10, align: "left" });
    d.text("0 J", GR.x1 + 0.15, GR.y0 + 0.1, { color: theme.muted, size: 10, align: "left" });
    d.text("Arraste os pontos azuis para mudar a pista; clique no trilho para soltar o carrinho ali.", AREA.x0, -0.95, { color: theme.muted, size: 11, align: "left" });
  },
});

export default montanhaRussa;
