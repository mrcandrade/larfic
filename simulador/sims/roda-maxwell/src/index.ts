import { defineSim, draw, num, texNum, type Params, type State } from "@fisilab/core";

// Estado: [y = distância descida pelo centro (m, para baixo), v (m/s, para baixo), s = caminho percorrido (m, para o ângulo)]
const Y = 0, V = 1, S = 2;
const TOP = 0.08;

export const FORMAS = [
  { label: "Disco uniforme (I = ½MR²)", beta: 0.5 },
  { label: "Roda com aro pesado (I ≈ 0,8MR²)", beta: 0.8 },
  { label: "Anel fino (I = MR²)", beta: 1 },
];

export const massa = (p: Params) => num(p, "m", 0.5);
export const raioEixo = (p: Params) => num(p, "r", 0.004);
export const altura = (p: Params) => num(p, "h", 0.6);
const beta = (p: Params) => (FORMAS[Math.round(num(p, "forma"))] ?? FORMAS[0]!).beta;

/** Momento de inércia em torno do eixo (eixo fino desprezado). */
export const inertia = (p: Params) => beta(p) * massa(p) * num(p, "R", 0.065) ** 2;

/** Aceleração do centro: a = g / (1 + I/(m r²)). */
export function accel(p: Params): number {
  const r = raioEixo(p);
  return num(p, "g", 9.79) / (1 + inertia(p) / (massa(p) * r * r));
}

/** Tração no fio: T = m(g − a) = mg/(1 + m r²/I). */
export const tracao = (p: Params) => massa(p) * (num(p, "g", 9.79) - accel(p));

/** Tempo verdadeiro de descida da altura h a partir do repouso. */
export const tDescida = (p: Params) => Math.sqrt((2 * altura(p)) / accel(p));
export const vFinal = (p: Params) => accel(p) * tDescida(p);

/** Fotoporta 1,5 cm acima do ponto mais baixo; o eixo (diâmetro 2r) bloqueia o feixe. */
export const gateY = (p: Params) => Math.max(altura(p) - 0.015, 0.5 * altura(p));
export function blockTime(p: Params): number {
  const a = accel(p), r = raioEixo(p), yg = gateY(p);
  const t = (y: number) => Math.sqrt((2 * Math.max(0, y)) / a);
  return t(Math.min(yg + r, altura(p))) - t(yg - r);
}

/** Comprimento de caminho percorrido com v0 e a constantes durante dt (com possível inversão). */
function pathLen(v0: number, a: number, dt: number): number {
  const disp = (tt: number) => v0 * tt + 0.5 * a * tt * tt;
  const tApex = a !== 0 ? -v0 / a : -1;
  if (tApex > 0 && tApex < dt) return Math.abs(disp(tApex)) + Math.abs(disp(dt) - disp(tApex));
  return Math.abs(disp(dt));
}

/** Passo exato: aceleração constante, com inversão no fundo (fio todo desenrolado). */
export function stepExact(s: State, p: Params, dt: number): State {
  const a = accel(p), h = altura(p), e = num(p, "e", 0.95);
  let y = s[Y]!, v = s[V]!, path = s[S]!;
  let rest = dt;
  for (let k = 0; k < 3 && rest > 0; k++) {
    const y1 = y + v * rest + 0.5 * a * rest * rest;
    if (y1 < h) {
      path += pathLen(v, a, rest);
      y = Math.max(0, y1);
      v += a * rest;
      rest = 0;
      break;
    }
    const tau = (-v + Math.sqrt(v * v + 2 * a * (h - y))) / a;
    path += pathLen(v, a, tau);
    v = -e * (v + a * tau);
    y = h;
    rest -= tau;
  }
  return [y, v, path];
}

const fmt = (v: number, dec: number) => v.toFixed(dec).replace(".", ",");

function energies(s: State, p: Params) {
  const m = massa(p), r = raioEixo(p), v = s[V]!;
  const Kt = 0.5 * m * v * v;
  const Kr = 0.5 * inertia(p) * (v / r) ** 2;
  const U = m * num(p, "g", 9.79) * (altura(p) - s[Y]!);
  return { Kt, Kr, U, E: Kt + Kr + U };
}

export const rodaMaxwell = defineSim({
  id: "roda-maxwell",
  title: "Roda de Maxwell e momento de inércia",
  course: "Exp I",
  topic: "Rotação",
  priority: "P1",
  summary:
    "Um disco com eixo fino desce desenrolando dois fios. Cronometre a descida para várias alturas e determine o momento de inércia da roda a partir da aceleração.",
  equations: [
    String.raw`a = \frac{g}{1 + I/(m r^2)} \qquad h = \tfrac12 a t^2`,
    String.raw`I = m r^2\left(\frac{g t^2}{2h} - 1\right)`,
    String.raw`m g h = \tfrac12 m v^2 + \tfrac12 I \omega^2,\quad \omega = v/r`,
  ],
  liveEquations(s, p) {
    const en = energies(s, p);
    return [
      String.raw`a = ${texNum(accel(p), 4)}\ \text{m/s}^2 \qquad t_{desc} = ${texNum(tDescida(p), 4)}\ \text{s} \qquad I = ${texNum(inertia(p), 3)}\ \text{kg·m}^2`,
      String.raw`K_{trans} = ${texNum(en.Kt, 3)}\ \text{J} \qquad K_{rot} = ${texNum(en.Kr, 3)}\ \text{J} \qquad \frac{K_{rot}}{K_{trans}} = \frac{I}{m r^2} = ${texNum(inertia(p) / (massa(p) * raioEixo(p) ** 2), 4)}`,
    ];
  },

  params: [
    { key: "h", label: "Altura de descida h", unit: "m", min: 0.1, max: 1, step: 0.005, default: 0.6 },
    { key: "m", label: "Massa da roda m", unit: "kg", min: 0.2, max: 1.5, step: 0.01, default: 0.5 },
    { key: "R", label: "Raio do disco R", unit: "m", min: 0.04, max: 0.12, step: 0.001, default: 0.065 },
    { key: "r", label: "Raio do eixo r", unit: "m", min: 0.002, max: 0.01, step: 0.0005, default: 0.004 },
    {
      key: "forma",
      label: "Distribuição de massa",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: FORMAS.map((f, i) => ({ value: i, label: f.label })),
    },
    { key: "e", label: "Fração da velocidade mantida no fundo", unit: "", min: 0.7, max: 1, step: 0.01, default: 0.95 },
    { key: "g", label: "Gravidade local g", unit: "m/s²", min: 9.7, max: 9.9, step: 0.01, default: 9.79 },
  ],

  observables: [
    { key: "y", label: "Distância descida", unit: "m", value: (s) => s[Y]! },
    { key: "v", label: "Velocidade do centro", unit: "m/s", value: (s) => s[V]! },
    { key: "omega", label: "Velocidade angular", unit: "rad/s", value: (s, p) => s[V]! / raioEixo(p) },
    { key: "tq", label: "Tempo de descida", unit: "s", value: (_s, p) => tDescida(p) },
    { key: "h", label: "Altura de descida", unit: "m", value: (_s, p) => altura(p) },
    { key: "vf", label: "Velocidade no fundo", unit: "m/s", value: (_s, p) => vFinal(p) },
    { key: "tb", label: "Tempo de bloqueio do eixo na fotoporta", unit: "s", value: (_s, p) => blockTime(p) },
    { key: "a", label: "Aceleração do centro", unit: "m/s²", value: (_s, p) => accel(p) },
    { key: "I", label: "Momento de inércia verdadeiro", unit: "kg·m²", value: (_s, p) => inertia(p) },
    { key: "m", label: "Massa da roda", unit: "kg", value: (_s, p) => massa(p) },
    { key: "r", label: "Raio do eixo", unit: "m", value: (_s, p) => raioEixo(p) },
    { key: "Kt", label: "Energia cinética de translação", unit: "J", value: (s, p) => energies(s, p).Kt },
    { key: "Kr", label: "Energia cinética de rotação", unit: "J", value: (s, p) => energies(s, p).Kr },
    { key: "E", label: "Energia mecânica", unit: "J", value: (s, p) => energies(s, p).E },
    { key: "T", label: "Tração no fio", unit: "N", value: (_s, p) => tracao(p) },
  ],
  chart: { x: "t", y: "y" },

  scenarios: [
    {
      id: "medir-I",
      label: "Medir o momento de inércia",
      params: { h: 0.6, m: 0.5, R: 0.065, r: 0.004, forma: 0 },
      guide: `### Momento de inércia pela descida
1. Meça o diâmetro do eixo com o paquímetro (aqui $2r$ = 8 mm) e a massa com a balança.
2. Solte a roda de alturas $h$ diferentes (pelo menos 6, entre 0,2 m e 0,9 m) e registre o tempo de descida.
3. Faça o gráfico de $h$ contra $t^2$: a inclinação é $a/2$.
4. Calcule $I = m r^2\\,(g/a - 1)$ e compare com $\\tfrac12 m R^2$.
5. A incerteza de $r$ entra ao quadrado: qual medida domina a incerteza de $I$?`,
      predict: [
        {
          question: "Comparada a uma queda livre da mesma altura, a roda de Maxwell desce:",
          options: ["no mesmo tempo", "um pouco mais devagar (uns 10%)", "muito mais devagar (dezenas de vezes)", "mais rápido"],
          answer: 2,
          explanation: "Com $I/(mr^2) \\approx 130$, a aceleração é cerca de $g/130$ e o tempo fica $\\sqrt{130} \\approx 11$ vezes maior.",
        },
      ],
    },
    {
      id: "energia",
      label: "Energia de rotação e translação",
      params: { h: 0.8, m: 0.5, R: 0.065, r: 0.004, forma: 0, e: 1 },
      guide: `### Para onde vai a energia
1. Compare $K_{rot}$ e $K_{trans}$ durante a descida. A razão é constante?
2. No fundo a roda continua girando e **sobe enrolando o fio**. Com perda nula, até onde ela volta?
3. Diminua a fração mantida no fundo e observe a altura de retorno cair a cada ciclo.`,
    },
    {
      id: "eixo",
      label: "Eixo mais grosso",
      params: { h: 0.6, m: 0.5, R: 0.065, r: 0.008, forma: 0 },
      guide: `### Efeito do raio do eixo
1. Dobre o raio do eixo. O tempo de descida diminui quanto?
2. Mostre que, para $I \\gg m r^2$, $t \\propto 1/r$.`,
      predict: [
        {
          question: "Dobrando o raio do eixo (com I ≫ mr²), o tempo de descida:",
          options: ["dobra", "cai quase à metade", "fica igual", "cai a um quarto"],
          answer: 1,
          explanation: "$a \\approx g\\,m r^2/I$ quadruplica e $t = \\sqrt{2h/a}$ cai à metade.",
        },
      ],
    },
    {
      id: "ioio",
      label: "Ioiô: rolando sobre o fio",
      params: { h: 0.9, m: 0.2, R: 0.04, r: 0.004, forma: 0, e: 0.9, g: 9.79 },
      guide: `### O ioiô
Um ioiô é um corpo que **rola sobre o próprio fio**: o fio se desenrola do eixo de raio $r$ sem deslizar, então $v = \\omega r$, como no rolamento (com $r$ no lugar do raio externo).
1. Escreva a segunda lei para a translação, $mg - T = ma$, e para a rotação em torno do centro, $Tr = I\\alpha = I a/r$. Daí $a = g/(1 + I/mr^2)$ e $T = mg/(1 + mr^2/I)$.
2. Com $m = 0{,}2$ kg, $R = 4$ cm (disco) e $r = 4$ mm, $I/mr^2 = 50$: a aceleração é $g/51$. Rode e confira $a$ e a tração $T$ nos observáveis.
3. Compare $K_{rot}$ e $K_{trans}$: a razão é $I/mr^2 = 50$. Quase toda a energia potencial vira rotação.
4. No fundo o fio está todo desenrolado: o ioiô continua girando no mesmo sentido e **sobe** enrolando o fio. Aqui ele mantém 90% da velocidade; quanto volta a subir?
5. Engrosse o eixo ($r$) e veja o ioiô ficar mais "rápido" e girar menos.`,
      predict: [
        {
          question: "Enquanto o ioiô desce, a tração no fio é:",
          options: ["maior que o peso", "igual ao peso", "um pouco menor que o peso", "zero, porque ele cai"],
          answer: 2,
          explanation: "O centro acelera para baixo, então $T < mg$: $T = m(g - a) = mg/(1 + mr^2/I)$. Com $I/mr^2 = 50$, $T \\approx 0{,}98\\,mg$: o fio sustenta quase todo o peso, e é o torque dessa tração que faz o ioiô girar.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "tempo",
      prompt:
        "Uma roda de Maxwell (disco uniforme) tem raio R = {R} m e eixo de raio r = {r} m. Ela é solta do repouso e desce h = {h} m (g = {g} m/s²). Quanto tempo leva?",
      vary: { R: [0.05, 0.1, 3], r: [0.003, 0.008, 4], h: [0.3, 0.9, 2], g: [9.78, 9.81, 2] },
      fixed: { forma: 0 },
      answer: {
        label: "t",
        unit: "s",
        compute: (p) => Math.sqrt((2 * num(p, "h") * (1 + 0.5 * (num(p, "R") / num(p, "r")) ** 2)) / num(p, "g")),
      },
    },
    {
      id: "inercia",
      prompt:
        "Uma roda de {m} kg com eixo de raio {r} m desce {h} m em {t} s, partindo do repouso (g = {g} m/s²). Qual é o momento de inércia da roda?",
      vary: { m: [0.3, 1.2, 2], r: [0.003, 0.008, 4], h: [0.3, 0.9, 2], t: [3, 8, 2], g: [9.78, 9.81, 2] },
      answer: {
        label: "I",
        unit: "kg·m²",
        compute: (p) => num(p, "m") * num(p, "r") ** 2 * ((num(p, "g") * num(p, "t") ** 2) / (2 * num(p, "h")) - 1),
      },
      hint: "I = m r² (g t²/(2h) − 1).",
    },
  ],

  init: () => [0, 0, 0],
  step: (s, p, _t, dt) => stepExact(s, p, dt),
  dt: 2e-3,
  sampleEvery: 10,
  tEnd: 60,

  viewport: (p) => {
    const R = num(p, "R", 0.065), h = altura(p);
    const H = h + TOP + R + 0.1;
    return { xMin: -0.55 * H, xMax: 0.65 * H, yMin: -H, yMax: 0.06 };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t } = frame;
    const R = num(p, "R", 0.065), r = raioEixo(p), h = altura(p);
    const H = h + TOP + R + 0.1;
    const cy = -TOP - s[Y]!;
    const phi = s[S]! / r;

    // Suporte
    d.support(-0.12, 0, 0.12, 0, { color: theme.muted });
    // Fio (tangente ao eixo)
    d.line(-r, 0, -r, cy, { color: theme.text, width: 1.2 });

    // Roda
    const forma = Math.round(num(p, "forma"));
    d.circle(0, cy, R, { fill: theme.dark ? "#2b3441" : "#e3e8ef", stroke: theme.text, width: 1.5 });
    if (forma >= 1) d.circle(0, cy, R * 0.92, { stroke: theme.series[1]!, width: forma === 2 ? 3 : 6 });
    for (let k = 0; k < 6; k++) {
      const ang = phi + (k * Math.PI) / 3;
      d.line(0, cy, R * 0.85 * Math.cos(ang), cy - R * 0.85 * Math.sin(ang), { color: theme.muted, width: 1 });
    }
    const ang0 = phi;
    d.dot(R * 0.7 * Math.cos(ang0), cy - R * 0.7 * Math.sin(ang0), 4, theme.positive);
    d.circle(0, cy, r, { fill: theme.text, minPx: 3 });
    if (Math.abs(s[V]!) > 1e-3) d.arrowPx(R + 0.02, cy, 0, -s[V]!, Math.min(60, 40 * Math.abs(s[V]!) + 8), { color: theme.accent });

    // Régua (zero na posição inicial do eixo)
    const rx = -0.35 * H;
    d.rect(rx, -TOP - h - 0.005, 0.03, h + 0.01, { fill: theme.dark ? "#3a3420" : "#f6e9b8", stroke: theme.muted, width: 1 });
    for (let cm = 0; cm <= Math.round(h * 100); cm++) {
      const y = -TOP - cm / 100;
      const big = cm % 10 === 0, mid = cm % 5 === 0;
      d.line(rx + 0.03, y, rx + 0.03 - (big ? 0.02 : mid ? 0.013 : 0.007), y, { color: theme.text, width: big ? 1 : 0.6 });
      if (big) d.text(`${cm}`, rx - 0.005, y, { size: 10, align: "right", color: theme.muted });
    }
    d.text("cm", rx - 0.005, -TOP + 0.03, { size: 10, align: "right", color: theme.muted });
    d.line(rx + 0.03, cy, -R - 0.01, cy, { color: theme.muted, dash: [3, 3], width: 1, alpha: 0.7 });

    // Fotoporta no fundo
    const yg = -TOP - gateY(p);
    d.rect(-R - 0.05, yg - 0.012, 0.02, 0.024, { fill: theme.text });
    d.rect(R + 0.03, yg - 0.012, 0.02, 0.024, { fill: theme.text });
    const blocked = Math.abs(s[Y]! - gateY(p)) < r;
    d.line(-R - 0.03, yg, R + 0.03, yg, { color: blocked ? theme.muted : theme.positive, width: 1, dash: blocked ? [3, 3] : [] });

    // Cronômetro
    const tq = tDescida(p);
    const px0 = 0.22 * H, w = 0.4 * H, lh = 0.055 * H;
    d.rect(px0, -0.02 - 3.6 * lh, w, 3.4 * lh, { fill: theme.dark ? "#0f1a12" : "#1d2a20", stroke: theme.text, width: 1 });
    const lcd = "#7cf29a";
    d.text("CRONÔMETRO", px0 + w / 2, -0.02 - 0.55 * lh, { color: lcd, size: 10, weight: "600" });
    d.text(`descida ${fmt(Math.min(t, tq), 3)} s`, px0 + 0.03 * H, -0.02 - 1.6 * lh, { color: lcd, size: 12, align: "left", weight: "600" });
    const tg = Math.sqrt((2 * (gateY(p) + r)) / accel(p));
    d.text(`bloqueio ${fmt(t >= tg ? blockTime(p) * 1000 : 0, 2)} ms`, px0 + 0.03 * H, -0.02 - 2.6 * lh, { color: lcd, size: 12, align: "left" });
    d.text(`a = ${fmt(accel(p), 4)} m/s²`, px0 + w / 2, -0.02 - 4.2 * lh, { color: theme.muted, size: 11 });
  },
});

export default rodaMaxwell;
