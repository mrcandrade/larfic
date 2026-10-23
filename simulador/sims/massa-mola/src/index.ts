import { defineSim, draw, num, rk4, texNum, type Draw, type Params, type State, type Theme } from "@fisilab/core";
import { derivation } from "./derivation.ts";

// Estado: [x, v, W_atrito (energia dissipada, ≥ 0), W_externa (trabalho da força F)]
const X = 0, V = 1, WD = 2, WF = 3;

/** Modo 1: sem mola; a força externa é F(x), definida pelo aluno em pontos. */
export const isProfile = (p: Params) => Math.round(num(p, "modo")) === 1;
/** Abscissas dos pontos de F(x) (m); fora de [0; 0,6] m a força é nula. */
export const XS = [0, 0.15, 0.3, 0.45, 0.6];
const FKEYS = ["F0", "F1", "F2", "F3", "F4"];

/** F(x) interpolada linearmente entre os pontos do aluno; zero fora do intervalo. */
export function profileForce(x: number, p: Params): number {
  if (x < XS[0]! || x > XS[XS.length - 1]!) return 0;
  for (let i = 0; i < XS.length - 1; i++) {
    const a = XS[i]!, b = XS[i + 1]!;
    if (x <= b) {
      const fa = num(p, FKEYS[i]!), fb = num(p, FKEYS[i + 1]!);
      return fa + ((fb - fa) * (x - a)) / (b - a);
    }
  }
  return 0;
}

/** Trabalho de F(x) entre xa e xb: área sob a curva (exata, por trapézios nos trechos lineares). */
export function profileWork(xa: number, xb: number, p: Params): number {
  const sgn = xb >= xa ? 1 : -1;
  // fora de [0; 0,6] m a força é nula: integra só a parte dentro do intervalo
  const lo = Math.max(Math.min(xa, xb), XS[0]!), hi = Math.min(Math.max(xa, xb), XS[XS.length - 1]!);
  if (hi <= lo) return 0;
  const cuts = [lo, ...XS.filter((x) => x > lo && x < hi), hi];
  let W = 0;
  for (let i = 0; i < cuts.length - 1; i++) {
    const a = cuts[i]!, b = cuts[i + 1]!;
    W += 0.5 * (profileForce(a, p) + profileForce(b, p)) * (b - a);
  }
  return sgn * W;
}

const forces = (s: number[], p: Params) => {
  const k = num(p, "k", 20), m = num(p, "m", 1), mu = num(p, "mu"), g = 9.81;
  const x = s[X]!, v = s[V]!;
  const prof = isProfile(p);
  const F = prof ? profileForce(x, p) : num(p, "F");
  const Fs = prof ? 0 : -k * x;
  const fmax = mu * m * g;
  let Ff = 0;
  if (Math.abs(v) > 1e-4) Ff = -Math.sign(v) * fmax;
  else if (Math.abs(Fs + F) > fmax) Ff = -Math.sign(Fs + F) * fmax;
  else Ff = -(Fs + F); // atrito estático segura o bloco
  return { Fs, Ff, F, net: Fs + Ff + F };
};

function derivatives(s: State, p: Params): State {
  const f = forces(s, p);
  const v = s[V]!;
  return [v, Math.abs(v) <= 1e-4 && Math.abs(f.net) < 1e-12 ? 0 : f.net / num(p, "m", 1), -f.Ff * v, f.F * v];
}

function bar(d: Draw, theme: Theme, x: number, base: number, h: number, w: number, color: string, label: string) {
  d.rect(x, base, w, Math.max(0, h), { fill: color, alpha: 0.85 });
  d.text(label, x + w / 2, base - 0.06, { color: theme.muted, size: 11 });
}

const fmtBR = (v: number, n = 2) => (Math.abs(v) < 0.5 * 10 ** -n ? "0" : v.toFixed(n).replace(".", ",").replace(/^-/, "−"));

/** Montagem F(x): gráfico da força alinhado com o eixo x da mesa e a área (trabalho) sombreada. */
function renderProfile(d: Draw, theme: Theme, s: number[], p: Params) {
  const x = s[X]!, x0 = num(p, "x0");
  const bw = 0.08, bh = 0.08;
  const base = 0.5, ky = 0.012; // 1 N = 0,012 m no desenho
  const Y = (F: number) => base + F * ky;
  d.line(-1, base, 0.82, base, { color: theme.muted, width: 1 });
  d.line(0, base - 0.26, 0, base + 0.27, { color: theme.muted, width: 1 });
  d.text("F (N)", 0, base + 0.29, { color: theme.muted, size: 11, align: "left", dx: 4 });
  for (const F of [-20, -10, 10, 20]) {
    d.line(-0.01, Y(F), 0.01, Y(F), { color: theme.muted, width: 1 });
    d.text(`${F}`, -0.015, Y(F), { color: theme.muted, size: 10, align: "right" });
  }
  // área de x0 até x (trabalho realizado até agora)
  const lo = Math.min(x0, x), hi = Math.max(x0, x);
  if (hi - lo > 1e-4) {
    const n = 80;
    const pts: [number, number][] = [[lo, base]];
    for (let i = 0; i <= n; i++) {
      const xx = lo + ((hi - lo) * i) / n;
      pts.push([xx, Y(profileForce(xx, p))]);
    }
    pts.push([hi, base]);
    d.polyline(pts, { color: "none", fill: theme.accent, alpha: 0.25, close: true });
  }
  const curve: [number, number][] = [[-1, Y(0)], [0, Y(0)]];
  for (const xx of XS) curve.push([xx, Y(profileForce(xx, p))]);
  curve.push([XS[XS.length - 1]!, Y(0)], [0.82, Y(0)]);
  d.polyline(curve, { color: theme.accent, width: 2.5 });
  for (const xx of XS) d.dot(xx, Y(profileForce(xx, p)), 4, theme.accent);
  // bloco e força
  const F = profileForce(x, p);
  d.line(x, bh, x, Y(F), { color: theme.muted, dash: [3, 3], width: 1 });
  d.rect(x - bw / 2, 0, bw, bh, { fill: theme.series[1], stroke: theme.text, width: 1 });
  if (Math.abs(F) > 1e-6) d.arrow(x, bh / 2, F * 0.01, 0, { color: theme.accent });
  const m = num(p, "m", 1);
  const K = 0.5 * m * s[V]! ** 2, K0 = 0.5 * m * num(p, "v0") ** 2;
  d.text(`W = área sob F(x) = ${fmtBR(s[WF]!, 3)} J`, -0.98, 0.8, { align: "left", size: 12, weight: "600", color: theme.accent });
  d.text(`ΔK = K − K₀ = ${fmtBR(K - K0, 3)} J`, -0.98, 0.74, { align: "left", size: 12, weight: "600", color: theme.series[0]! });
  d.text(`x = ${fmtBR(x, 3)} m   F(x) = ${fmtBR(F, 2)} N   v = ${fmtBR(s[V]!, 2)} m/s`, -0.98, 0.68, { align: "left", size: 11 });
  d.text(`área de 0 a 0,6 m: ${fmtBR(profileWork(0, 0.6, p), 3)} J`, -0.98, 0.62, { align: "left", size: 11, color: theme.muted });
}

export const massaMola = defineSim({
  id: "massa-mola",
  title: "Massa-mola, trabalho e potência",
  course: "FG I",
  topic: "Energia",
  priority: "P1",
  summary:
    "Um bloco preso a uma mola sobre uma mesa com atrito e uma força externa ajustável. Acompanhe o trabalho de cada força, a potência instantânea e para onde vai a energia.",
  derivation,
  equations: [
    String.raw`m\ddot x = -kx + F - \mu m g\,\text{sgn}(\dot x)`,
    String.raw`W = \int \vec F\cdot d\vec r \qquad P = \vec F\cdot\vec v \qquad U_{el} = \tfrac12 k x^2`,
    String.raw`K + U_{el} + W_{\text{atrito}} - W_F = E_0`,
  ],
  liveEquations(s, p) {
    const f = forces(s, p);
    const v = s[V]!;
    return [String.raw`P_{\text{mola}} = ${texNum(f.Fs * v)}\ \text{W} \qquad P_{\text{atrito}} = ${texNum(f.Ff * v)}\ \text{W} \qquad P_F = ${texNum(f.F * v)}\ \text{W}`];
  },

  params: [
    { key: "k", label: "Constante da mola k", unit: "N/m", min: 1, max: 200, step: 1, default: 40 },
    { key: "m", label: "Massa", unit: "kg", min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: "x0", label: "Deslocamento inicial", unit: "m", min: -0.5, max: 0.5, step: 0.01, default: 0.3 },
    { key: "v0", label: "Velocidade inicial", unit: "m/s", min: -3, max: 3, step: 0.05, default: 0 },
    { key: "mu", label: "Coeficiente de atrito μ", unit: "", min: 0, max: 0.5, step: 0.01, default: 0 },
    { key: "F", label: "Força externa F", unit: "N", min: -20, max: 20, step: 0.5, default: 0, live: true },
    {
      key: "modo",
      label: "Montagem",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Bloco com mola" },
        { value: 1, label: "Sem mola: força variável F(x) definida por você" },
      ],
    },
    { key: "F0", label: "F(x) em x = 0 m", unit: "N", min: -20, max: 20, step: 0.5, default: 2 },
    { key: "F1", label: "F(x) em x = 0,15 m", unit: "N", min: -20, max: 20, step: 0.5, default: 6 },
    { key: "F2", label: "F(x) em x = 0,30 m", unit: "N", min: -20, max: 20, step: 0.5, default: 10 },
    { key: "F3", label: "F(x) em x = 0,45 m", unit: "N", min: -20, max: 20, step: 0.5, default: 4 },
    { key: "F4", label: "F(x) em x = 0,60 m", unit: "N", min: -20, max: 20, step: 0.5, default: -4 },
  ],

  observables: [
    { key: "x", label: "x", unit: "m", value: (s) => s[X]! },
    { key: "v", label: "v", unit: "m/s", value: (s) => s[V]! },
    { key: "a", label: "a", unit: "m/s²", value: (s, p) => forces(s, p).net / num(p, "m", 1) },
    { key: "K", label: "Energia cinética", unit: "J", value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 },
    { key: "U", label: "Energia elástica", unit: "J", value: (s, p) => (isProfile(p) ? 0 : 0.5 * num(p, "k", 20) * s[X]! ** 2) },
    { key: "Fx", label: "Força F(x) no bloco", unit: "N", value: (s, p) => (isProfile(p) ? profileForce(s[X]!, p) : num(p, "F")) },
    { key: "Wd", label: "Energia dissipada pelo atrito", unit: "J", value: (s) => s[WD]! },
    { key: "WF", label: "Trabalho da força externa", unit: "J", value: (s) => s[WF]! },
    { key: "Pmola", label: "Potência da mola", unit: "W", value: (s, p) => forces(s, p).Fs * s[V]! },
    {
      key: "bal",
      label: "K + U + W_atrito − W_F",
      unit: "J",
      value: (s, p) => 0.5 * num(p, "m", 1) * s[V]! ** 2 + (isProfile(p) ? 0 : 0.5 * num(p, "k", 20) * s[X]! ** 2) + s[WD]! - s[WF]!,
    },
  ],
  conserved: "bal",
  chart: { x: "t", y: "x" },

  scenarios: [
    {
      id: "livre",
      label: "Oscilação livre",
      params: { mu: 0, F: 0, x0: 0.3, v0: 0 },
      guide: `### Troca de energia
1. Plote **Energia cinética** e compare com **Energia elástica**: quando uma é máxima, a outra é zero.
2. Plote a **potência da mola**. Quando ela é positiva, a mola está entregando energia ao bloco.
3. Confira que o período é $2\\pi\\sqrt{m/k}$.`,
      predict: [
        {
          question: "Se você quadruplicar a massa, o período da oscilação:",
          options: ["dobra", "quadruplica", "fica igual"],
          answer: 0,
          explanation: "$T = 2\\pi\\sqrt{m/k}$: com $4m$, a raiz dobra.",
        },
      ],
    },
    {
      id: "atrito",
      label: "Com atrito na mesa",
      params: { mu: 0.08, F: 0, x0: 0.4 },
      guide: `### Atrito seco
Com atrito constante a amplitude cai **linearmente** (não exponencialmente) a cada meio ciclo, $4\\mu mg/k$ por ciclo, e o bloco para fora do zero.
Observe a energia dissipada crescer até igualar a energia inicial perdida.`,
    },
    {
      id: "forca",
      label: "Força externa constante",
      params: { mu: 0, F: 8, x0: 0, v0: 0 },
      guide: `### Novo equilíbrio
Uma força constante só desloca o ponto de equilíbrio para $x_e = F/k$. O bloco oscila em torno dele.
Mude **F** durante o movimento e veja o trabalho externo entrar no balanço.`,
    },
    {
      id: "forca-variavel",
      label: "Força variável F(x): trabalho como área",
      params: { modo: 1, m: 1, mu: 0, x0: 0, v0: 0, F0: 2, F1: 6, F2: 10, F3: 4, F4: -4 },
      guide: `### Você define a força
Não há mola: a única força horizontal é $F(x)$, que você define nos controles **F(x) em x = …** (cinco pontos ligados por retas; fora de $0 \\le x \\le 0{,}6$ m a força é nula).
1. Antes de rodar, calcule a área sob o gráfico de $0$ a $0{,}6$ m somando trapézios. Essa área é o trabalho $W = \\int F\\,dx$.
2. Rode. A região sombreada acompanha o bloco: é o trabalho feito até ali. Compare com a energia cinética: $K - K_0 = W$ a cada instante (teorema trabalho–energia).
3. Onde a velocidade é máxima? Repare no ponto em que $F(x)$ troca de sinal.
4. Faça a força ficar negativa num trecho grande (por exemplo, $F_3 = F_4 = -15$ N). A área negativa tira energia: o bloco para e volta?
5. Faça $F(x)$ constante ($F_0 = \\dots = F_4$) e confira $W = F\\,\\Delta x$.`,
      predict: [
        {
          question: "Com os pontos 2, 6, 10, 4 e −4 N (de 0 a 0,6 m, de 0,15 em 0,15 m), onde o bloco, que parte do repouso em x = 0, tem a maior velocidade?",
          options: ["Em x = 0,30 m, onde a força é máxima", "Em x = 0,525 m, onde a força se anula", "Em x = 0,60 m, no fim do trecho", "A velocidade é a mesma em todo o trecho"],
          answer: 1,
          explanation: "Enquanto $F > 0$ a área cresce e o bloco ganha energia cinética, mesmo com a força diminuindo. A partir de onde $F$ fica negativa (entre 4 N e −4 N, em $x = 0{,}525$ m) a área passa a diminuir. A força máxima dá a maior **aceleração**, não a maior velocidade.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "periodo",
      prompt: "Um bloco de {m} kg preso a uma mola de constante {k} N/m oscila sem atrito. Qual é o período?",
      vary: { m: [0.2, 5, 1], k: [5, 200, 0] },
      answer: { label: "T", unit: "s", compute: (p) => 2 * Math.PI * Math.sqrt(num(p, "m") / num(p, "k")) },
    },
    {
      id: "vmax",
      prompt: "Uma mola de {k} N/m é comprimida {x0} m com um bloco de {m} kg e solta do repouso sem atrito. Qual é a velocidade máxima do bloco?",
      vary: { k: [10, 200, 0], x0: [0.05, 0.5, 2], m: [0.2, 5, 1] },
      answer: { label: "v_max", unit: "m/s", compute: (p) => Math.abs(num(p, "x0")) * Math.sqrt(num(p, "k") / num(p, "m")) },
      hint: "½kx₀² = ½mv²_max.",
    },
  ],

  init: (p) => [num(p, "x0"), num(p, "v0"), 0, 0],
  step(s, p, t, dt) {
    const next = rk4(derivatives, s, p, t, dt);
    // Atrito estático: se a velocidade trocou de sinal (ou zerou) e a mola não vence o atrito máximo, o bloco para.
    const v0 = s[V]!, v1 = next[V]!;
    if (v0 * v1 <= 0 && v0 !== 0) {
      const k = num(p, "k", 20), m = num(p, "m", 1), mu = num(p, "mu");
      const drive = isProfile(p) ? profileForce(next[X]!, p) : -k * next[X]! + num(p, "F");
      if (Math.abs(drive) <= mu * m * 9.81) next[V] = 0;
    }
    return next;
  },
  dt: 5e-4,
  tEnd: 60,
  // Só a montagem F(x) termina: quando o bloco sai da mesa desenhada.
  stopWhen: (s, p) => (isProfile(p) ? Math.min(0.8 - s[X]!, s[X]! + 0.9) : 1),

  viewport: () => ({ xMin: -1.05, xMax: 0.85, yMin: -0.3, yMax: 0.85, unit: "m" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const x = s[X]!;
    const wall = -0.95;
    const bw = 0.16, bh = 0.12;
    d.rect(-1.05, -0.3, 2, 0.3, { fill: theme.ground });
    if (isProfile(p)) {
      renderProfile(d, theme, s, p);
      return;
    }
    d.support(wall, 0, wall, 0.3, { color: theme.muted });
    d.spring(wall, bh / 2, x - bw / 2, bh / 2, { color: theme.muted, coils: 12, width: 2 });
    d.line(0, -0.03, 0, 0.32, { color: theme.grid, dash: [4, 4] });
    d.text("x = 0", 0, -0.08, { color: theme.muted, size: 11 });
    const F = num(p, "F");
    const xe = F / num(p, "k", 20);
    if (Math.abs(xe) > 1e-3) {
      d.line(xe, -0.03, xe, 0.32, { color: theme.accent, dash: [2, 4], alpha: 0.7 });
      d.text("equilíbrio", xe, -0.16, { color: theme.accent, size: 10 });
    }
    d.rect(x - bw / 2, 0, bw, bh, { fill: theme.series[1], stroke: theme.text, width: 1 });

    // Forças (escala: 1 N = 0,01 m na tela)
    const f = forces(s, p);
    const sc = 0.01;
    d.arrow(x, bh * 0.75, f.Fs * sc, 0, { color: theme.positive });
    if (Math.abs(f.Ff) > 1e-6) d.arrow(x, bh * 0.25, f.Ff * sc, 0, { color: theme.muted });
    if (Math.abs(F) > 1e-6) d.arrow(x, bh + 0.04, F * sc, 0, { color: theme.accent });

    // Barras de energia
    const m = num(p, "m", 1), k = num(p, "k", 20);
    const K = 0.5 * m * s[V]! ** 2, U = 0.5 * k * x ** 2, Wd = s[WD]!;
    const total = Math.max(1e-9, K + U + Wd, 0.5 * k * num(p, "x0") ** 2 + 0.5 * m * num(p, "v0") ** 2);
    const hmax = 0.4, base = 0.38, w = 0.1;
    bar(d, theme, 0.25, base, (K / total) * hmax, w, theme.series[0]!, "K");
    bar(d, theme, 0.4, base, (U / total) * hmax, w, theme.series[2]!, "U");
    bar(d, theme, 0.55, base, (Wd / total) * hmax, w, theme.muted, "dissip.");
    d.text("Energia", 0.45, base + hmax + 0.05, { color: theme.text, size: 11, weight: "600" });
  },
});

export default massaMola;
