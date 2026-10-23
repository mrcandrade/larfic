import { defineSim, draw, num, texNum, type Params, type Theme } from "@fisilab/core";

/** Ar a 20 °C. */
export const RHO = 1.2;
export const C_SOM = 343;
/** Intensidade de referência (limiar a 1 kHz), W/m². */
export const I0 = 1e-12;
/** Frequência das oscilações mostradas na tela (câmera lenta automática). */
const F_VIS = 0.6;
/** Ganho máximo entregue ao alto-falante (protege os ouvidos). */
export const GAIN_MAX = 0.25;

export const intensity = (p: Params) => num(p, "P", 0.01) / (4 * Math.PI * num(p, "r", 2) ** 2);
export const level = (p: Params) => 10 * Math.log10(intensity(p) / I0);
/** Amplitude de pressão p₀ (Pa): I = p₀²/(2ρc). */
export const pressureAmp = (p: Params) => Math.sqrt(2 * RHO * C_SOM * intensity(p));
/** Amplitude de deslocamento das partículas s₀ = p₀/(ρcω) (m). */
export const displacementAmp = (p: Params) => pressureAmp(p) / (RHO * C_SOM * 2 * Math.PI * num(p, "f", 1000));
export const wavelength = (p: Params) => C_SOM / num(p, "f", 1000);

/** Modo 1: duas caixas de som em fase, separadas por d, e um ouvinte em (D, y). */
export const isDuas = (p: Params) => Math.round(num(p, "modo")) === 1;

/** Interferência de duas caixas coerentes e em fase, cada uma com potência P (ondas esféricas). */
export function duasCaixas(p: Params) {
  const d = num(p, "d", 1.5), D = num(p, "D", 4), y = num(p, "yL", 0);
  const L1 = Math.hypot(D, y - d / 2);
  const L2 = Math.hypot(D, y + d / 2);
  const lam = wavelength(p);
  const dL = L2 - L1;
  const phi = (2 * Math.PI * dL) / lam;
  const P = num(p, "P", 0.01);
  const I1 = P / (4 * Math.PI * L1 * L1);
  const I2 = P / (4 * Math.PI * L2 * L2);
  const I = I1 + I2 + 2 * Math.sqrt(I1 * I2) * Math.cos(phi);
  return { L1, L2, dL, phi, I1, I2, I: Math.max(0, I), lam };
}
/** Nível sonoro total no ouvinte, com as duas caixas (dB). */
export const levelDuas = (p: Params) => 10 * Math.log10(Math.max(duasCaixas(p).I, 1e-30) / I0);

/** Limiar de audição aproximado (dB), fórmula de Terhardt. */
export function threshold(f: number): number {
  const k = f / 1000;
  return 3.64 * k ** -0.8 - 6.5 * Math.exp(-0.6 * (k - 3.3) ** 2) + 1e-3 * k ** 4;
}

/**
 * Tom que o app deve tocar pelo alto-falante (a sim não toca áudio).
 * O ganho acompanha o nível β de forma comprimida (metade dos decibéis) e é
 * limitado a GAIN_MAX; com o som desligado, o ganho é zero.
 */
export function toneFor(params: Params): { freq: number; gain: number } {
  const freq = num(params, "f", 1000);
  if (Math.round(num(params, "som")) !== 1) return { freq, gain: 0 };
  const beta = isDuas(params) ? levelDuas(params) : level(params);
  const gain = Math.min(GAIN_MAX, GAIN_MAX * 10 ** ((beta - 110) / 40));
  return { freq, gain: Number.isFinite(gain) ? Math.max(0, gain) : 0 };
}

const fmtBR = (v: number, d = 1) => v.toFixed(d).replace(".", ",");
function fmtSci(v: number): string {
  if (v === 0) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 4) return fmtBR(v, Math.max(0, 2 - e));
  const m = v / 10 ** e;
  return `${fmtBR(m, 2)}×10^${e}`;
}

// Painéis do palco (coordenadas do mundo, sem unidade física)
const PA = { x0: 0.4, x1: 9.6, y0: 4.55, y1: 6.5 };
const PB = { x0: 0.4, x1: 9.6, y: 3.45 };
const PC = { x0: 1.0, x1: 9.2, y0: 0.35, y1: 2.55 };
const R_MIN = 0.5;
const R_MAX = 50;
const rX = (r: number) => PB.x0 + 0.9 + ((Math.log10(r) - Math.log10(R_MIN)) / (Math.log10(R_MAX) - Math.log10(R_MIN))) * (PB.x1 - PB.x0 - 1.1);
const fX = (f: number) => PC.x0 + ((Math.log10(f) - Math.log10(20)) / (Math.log10(20000) - Math.log10(20))) * (PC.x1 - PC.x0);
const dbY = (b: number) => PC.y0 + (Math.max(-10, Math.min(140, b)) / 140) * (PC.y1 - PC.y0);

const REFERENCIAS: [number, string][] = [
  [20, "sussurro"],
  [60, "conversa"],
  [85, "trânsito pesado"],
  [110, "show de rock"],
  [130, "limiar da dor"],
];

/** Vista de cima das duas caixas, frentes de onda e perfil de intensidade na linha do ouvinte. */
function renderDuas(d: ReturnType<typeof draw>, theme: Theme, p: Params, tv: number) {
  const dd = num(p, "d", 1.5), D = num(p, "D", 4), y = num(p, "yL", 0);
  const q = duasCaixas(p);
  const s = Math.min(0.6, 5.4 / (D + 0.6));
  const X0 = 0.8, Y0 = 3.2;
  const X = (xm: number) => X0 + s * xm;
  const Yy = (ym: number) => Y0 + s * ym;
  const cols = [theme.series[0]!, theme.series[1]!];
  const srcs: [number, number][] = [[0, dd / 2], [0, -dd / 2]];
  // frentes de onda (cristas), em câmera lenta
  const lamS = q.lam * s;
  const Rmax = Math.hypot(D, 5.5) + 0.5;
  if (lamS > 0.07) {
    const frac = (F_VIS * tv) % 1;
    srcs.forEach(([sx, sy], i) => {
      for (let n = 0; (n + frac) * q.lam < Rmax; n++) {
        const R = (n + frac) * q.lam;
        const pts: [number, number][] = [];
        for (let z = 0; z <= 40; z++) {
          const a = -Math.PI / 2 + (Math.PI * z) / 40;
          const px = sx + R * Math.cos(a), py = sy + R * Math.sin(a);
          if (px <= D + 0.3 && Math.abs(py) <= 5.3) pts.push([X(px), Yy(py)]);
          else if (pts.length > 1) break;
        }
        if (pts.length > 1) d.polyline(pts, { color: cols[i]!, width: 1.2, alpha: 0.45 });
      }
    });
  } else {
    d.text("λ pequeno demais para desenhar as frentes de onda nesta escala", X(D / 2), 0.35, { color: theme.muted, size: 10 });
  }
  // caixas
  srcs.forEach(([sx, sy], i) => {
    d.rect(X(sx) - 0.22, Yy(sy) - 0.16, 0.22, 0.32, { fill: theme.text });
    d.text(`S${i + 1}`, X(sx) - 0.11, Yy(sy), { color: cols[i]!, size: 11, weight: "700", dx: -16 });
  });
  // linha do ouvinte e caminhos
  d.line(X(D), Yy(-5.3), X(D), Yy(5.3), { color: theme.grid, width: 1, dash: [4, 4] });
  const [Lx, Ly] = [X(D), Yy(y)];
  d.line(X(0), Yy(dd / 2), Lx, Ly, { color: cols[0]!, width: 1.5 });
  d.line(X(0), Yy(-dd / 2), Lx, Ly, { color: cols[1]!, width: 1.5 });
  d.dot(Lx, Ly, 7, theme.series[2] ?? theme.accent);
  d.text("ouvinte", Lx, Ly, { color: theme.text, size: 10, dy: -14 });
  // perfil de intensidade ao longo da linha x = D
  const PX0 = 7.0, PW = 2.6;
  const Iy = (yy: number) => duasCaixas({ ...p, yL: yy }).I;
  let Imax = 0;
  const ys: number[] = [];
  for (let z = 0; z <= 400; z++) ys.push(-5 + (10 * z) / 400);
  const Is = ys.map(Iy);
  for (const I of Is) Imax = Math.max(Imax, I);
  d.line(PX0, Yy(-5), PX0, Yy(5), { color: theme.muted, width: 1 });
  d.polyline(ys.map((yy, z) => [PX0 + (PW * Is[z]!) / Imax, Yy(yy)] as [number, number]), { color: theme.accent, width: 2 });
  d.line(PX0, Ly, PX0 + (PW * q.I) / Imax, Ly, { color: theme.series[2] ?? theme.accent, width: 2 });
  d.dot(PX0 + (PW * q.I) / Imax, Ly, 5, theme.series[2] ?? theme.accent);
  d.text("intensidade ao longo da linha do ouvinte", PX0 + PW / 2, Yy(5) + 0.25, { color: theme.muted, size: 10 });
  // números
  const fr = (((q.dL / q.lam) % 1) + 1) % 1;
  const tipo = fr < 0.05 || fr > 0.95 ? "construtiva" : Math.abs(fr - 0.5) < 0.05 ? "destrutiva" : "intermediária";
  d.text(
    `L₁ = ${fmtBR(q.L1, 2)} m   L₂ = ${fmtBR(q.L2, 2)} m   ΔL = ${fmtBR(q.dL, 3)} m = ${fmtBR(q.dL / q.lam, 2)} λ   (λ = ${fmtSci(q.lam)} m)   interferência ${tipo}`,
    0.3,
    6.75,
    { color: theme.text, size: 12, weight: "600", align: "left" },
  );
  d.text(
    `I/(I₁ + I₂) = ${fmtBR(q.I / (q.I1 + q.I2), 2)}   ·   β = ${fmtBR(levelDuas(p))} dB (uma caixa só: ${fmtBR(10 * Math.log10(q.I1 / I0))} dB)   ·   ${Math.round(num(p, "som")) === 1 ? "som ligado" : "som desligado"}`,
    0.3,
    6.35,
    { color: theme.text, size: 11, align: "left" },
  );
}

export const somIntensidade = defineSim({
  tone: (p) => toneFor(p),
  id: "som-intensidade",
  title: "Ondas sonoras: intensidade e decibéis",
  course: "FG II",
  topic: "Som",
  priority: "P1",
  summary:
    "Uma fonte sonora pontual: veja as partículas de ar oscilando na direção da propagação, a pressão, a queda da intensidade com 1/r² e o nível em decibéis comparado com a curva de sensibilidade do ouvido. Ligue o som para ouvir o tom correspondente.",
  equations: [
    String.raw`I = \frac{P}{4\pi r^2} \qquad \beta = 10\log_{10}\frac{I}{I_0} \quad (I_0 = 10^{-12}\ \text{W/m}^2)`,
    String.raw`I = \frac{p_0^2}{2\rho c} \qquad s_0 = \frac{p_0}{\rho c\,\omega} \qquad \lambda = \frac{c}{f}`,
    String.raw`s(x,t) = s_0\cos(kx - \omega t) \qquad \Delta p(x,t) = \rho c\,\omega\, s_0 \operatorname{sen}(kx - \omega t)`,
  ],
  liveEquations(_s, p) {
    if (isDuas(p)) {
      const q = duasCaixas(p);
      return [
        String.raw`\Delta L = L_2 - L_1 = ${texNum(q.L2)} - ${texNum(q.L1)} = ${texNum(q.dL)}\ \text{m} = ${texNum(q.dL / q.lam)}\,\lambda \qquad \phi = 2\pi\frac{\Delta L}{\lambda} = ${texNum((q.phi * 180) / Math.PI)}^\circ`,
        String.raw`I = I_1 + I_2 + 2\sqrt{I_1 I_2}\cos\phi = ${texNum(q.I)}\ \text{W/m}^2 \qquad \frac{I}{I_1 + I_2} = ${texNum(q.I / (q.I1 + q.I2))} \qquad \beta = ${texNum(levelDuas(p), 3)}\ \text{dB}`,
      ];
    }
    const I = intensity(p);
    const b = level(p);
    return [
      String.raw`I = \frac{${texNum(num(p, "P", 0.01))}\ \text{W}}{4\pi (${texNum(num(p, "r", 2))}\ \text{m})^2} = ${texNum(I)}\ \text{W/m}^2 \qquad \beta = ${texNum(b, 3)}\ \text{dB}`,
      String.raw`p_0 = ${texNum(pressureAmp(p))}\ \text{Pa} \qquad s_0 = ${texNum(displacementAmp(p))}\ \text{m} \qquad \lambda = ${texNum(wavelength(p))}\ \text{m}`,
      String.raw`\text{limiar em } ${texNum(num(p, "f", 1000))}\ \text{Hz}: ${texNum(threshold(num(p, "f", 1000)), 2)}\ \text{dB} \;\Rightarrow\; ${b > threshold(num(p, "f", 1000)) ? String.raw`\text{audível}` : String.raw`\text{inaudível}`}`,
    ];
  },

  params: [
    { key: "P", label: "Potência sonora da fonte", unit: "W", min: 1e-6, max: 10, step: 1e-6, default: 0.01, log: true, live: true },
    { key: "r", label: "Distância ao ouvinte", unit: "m", min: R_MIN, max: R_MAX, step: 0.1, default: 2, log: true, live: true },
    { key: "f", label: "Frequência", unit: "Hz", min: 20, max: 20000, step: 1, default: 1000, log: true, live: true },
    {
      key: "som", label: "Som pelo alto-falante", unit: "", min: 0, max: 1, step: 1, default: 0, live: true,
      options: [
        { value: 0, label: "Desligado" },
        { value: 1, label: "Ligado (volume limitado)" },
      ],
    },
    {
      key: "modo", label: "Montagem", unit: "", min: 0, max: 1, step: 1, default: 0,
      options: [
        { value: 0, label: "Uma fonte pontual" },
        { value: 1, label: "Duas caixas de som em fase (interferência)" },
      ],
    },
    { key: "d", label: "Duas caixas: separação d", unit: "m", min: 0.2, max: 5, step: 0.05, default: 1.5 },
    { key: "D", label: "Duas caixas: distância do ouvinte à linha das caixas", unit: "m", min: 1, max: 10, step: 0.1, default: 4 },
    { key: "yL", label: "Duas caixas: posição lateral do ouvinte", unit: "m", min: -5, max: 5, step: 0.01, default: 0, live: true },
  ],

  observables: [
    { key: "I", label: "Intensidade no ouvinte", unit: "W/m²", value: (_s, p) => intensity(p) },
    { key: "beta", label: "Nível sonoro β", unit: "dB", value: (_s, p) => level(p) },
    { key: "p0", label: "Amplitude de pressão", unit: "Pa", value: (_s, p) => pressureAmp(p) },
    { key: "s0", label: "Amplitude de deslocamento do ar", unit: "m", value: (_s, p) => displacementAmp(p) },
    { key: "lambda", label: "Comprimento de onda", unit: "m", value: (_s, p) => wavelength(p) },
    { key: "acima", label: "Nível acima do limiar de audição", unit: "dB", value: (_s, p) => level(p) - threshold(num(p, "f", 1000)) },
    { key: "dL", label: "Duas caixas: diferença de caminho ΔL", unit: "m", value: (_s, p) => duasCaixas(p).dL },
    { key: "dLl", label: "Duas caixas: ΔL/λ", unit: "", value: (_s, p) => duasCaixas(p).dL / wavelength(p) },
    { key: "Irel", label: "Duas caixas: I/(I₁ + I₂)", unit: "", value: (_s, p) => { const q = duasCaixas(p); return q.I / (q.I1 + q.I2); } },
    { key: "beta2", label: "Duas caixas: nível total β", unit: "dB", value: (_s, p) => levelDuas(p) },
    { key: "p", label: "Pressão no ouvinte (câmera lenta)", unit: "Pa", value: (s, p) => pressureAmp(p) * Math.sin(-2 * Math.PI * F_VIS * (s[0] ?? 0)) },
  ],
  chart: { x: "t", y: "beta" },

  scenarios: [
    {
      id: "distancia",
      label: "Lei do inverso do quadrado",
      params: { P: 0.01, r: 1, f: 1000 },
      guide: `### Dobrando a distância
1. Anote $\\beta$ a 1 m. Agora coloque o ouvinte a 2 m, 4 m e 8 m.
2. A intensidade cai com $1/r^2$: dobrar $r$ divide $I$ por 4.
3. Em decibéis, dividir por 4 é subtrair $10\\log_{10} 4 \\approx 6$ dB, qualquer que seja a distância inicial.
4. Ligue o som (volume limitado) e ouça a diferença ao afastar o ouvinte.`,
      predict: [
        {
          question: "Ao dobrar a distância até uma fonte pontual, o nível sonoro:",
          options: ["cai pela metade", "cai cerca de 6 dB", "cai cerca de 3 dB"],
          answer: 1,
          explanation: "$I \\propto 1/r^2$: dobrar $r$ divide $I$ por 4, e $\\Delta\\beta = 10\\log_{10}(1/4) \\approx -6$ dB.",
        },
      ],
    },
    {
      id: "potencia",
      label: "Dez violinos",
      params: { P: 0.001, r: 5, f: 440 },
      guide: `### Somando fontes
1. Um violino emite cerca de 1 mW. Anote $\\beta$ a 5 m.
2. Dez violinos iguais tocando juntos (sons incoerentes) somam as potências: $P = 10$ mW. Quanto muda $\\beta$?
3. Cada fator 10 em intensidade acrescenta 10 dB; cada fator 2, cerca de 3 dB.
4. Repare que a escala em decibéis transforma multiplicações em somas: é por isso que o ouvido, que percebe razões, "fala" em dB.`,
      predict: [
        {
          question: "Um violino produz 60 dB num ponto. Dez violinos iguais, no mesmo lugar, produzem:",
          options: ["600 dB", "70 dB", "66 dB"],
          answer: 1,
          explanation: "A intensidade fica 10 vezes maior: $\\Delta\\beta = 10\\log_{10}10 = 10$ dB.",
        },
      ],
    },
    {
      id: "sensibilidade",
      label: "Graves fracos são inaudíveis",
      params: { P: 1e-6, r: 3, f: 40 },
      guide: `### A curva de sensibilidade do ouvido
1. Um som de 40 Hz com cerca de 40 dB fica **abaixo** da curva do limiar de audição: não é ouvido.
2. Sem mudar a potência, suba a frequência até 3 kHz: o ponto passa para a região audível. O ouvido é mais sensível entre 2 e 5 kHz.
3. Acima de 15 kHz o limiar sobe de novo (e sobe mais com a idade).
4. Por isso um som de mesmo nível em dB pode parecer muito mais fraco no grave do que no médio.`,
    },
    {
      id: "longitudinal",
      label: "Onda longitudinal",
      params: { P: 0.1, r: 1, f: 200 },
      guide: `### Partículas de ar e pressão
1. No painel de cima, cada ponto é uma "porção" de ar, em câmera lenta e com o deslocamento muito ampliado. Elas oscilam **na mesma direção** da propagação.
2. As regiões onde os pontos se juntam são **compressões** (pressão acima da atmosférica); onde se afastam, **rarefações**.
3. Compare a curva de pressão com o deslocamento: a pressão é máxima onde o deslocamento é **zero** (defasagem de 90°).
4. Com 1 W a 1 m, a amplitude real de deslocamento é de micrômetros, e a de pressão, de alguns pascals, contra 101 325 Pa da atmosfera.`,
    },
    {
      id: "duas-caixas",
      label: "Interferência de duas caixas de som",
      params: { modo: 1, P: 0.01, f: 343, d: 1.5, D: 4, yL: 0 },
      guide: `### Construtiva ou destrutiva?
Duas caixas ligadas ao mesmo amplificador emitem o mesmo tom, em fase. Com $f = 343$ Hz, $\\lambda = c/f = 1$ m.
1. Com o ouvinte em $y = 0$, as distâncias $L_1$ e $L_2$ são iguais: as ondas chegam em fase e a intensidade é **4 vezes** a de uma caixa só (+6 dB), não 2 vezes.
2. Mova o ouvinte de lado (controle **posição lateral**). A diferença de fase é $\\phi = 2\\pi\\,\\Delta L/\\lambda$. Ache o primeiro mínimo: ali $\\Delta L = \\lambda/2$.
3. Confira as condições: **construtiva** para $\\Delta L = m\\lambda$ e **destrutiva** para $\\Delta L = (m + \\tfrac12)\\lambda$. O perfil à direita mostra a intensidade ao longo da linha do ouvinte.
4. Nos mínimos o som não some por completo: as caixas estão a distâncias diferentes e as amplitudes não são iguais.
5. Ligue o som e mova o ouvinte: o volume sobe e desce. Mude a frequência: os mínimos mudam de lugar, porque dependem de $\\lambda$.`,
      predict: [
        {
          question: "Com o ouvinte à mesma distância das duas caixas (em fase), a intensidade, comparada à de uma caixa só, é:",
          options: ["a mesma", "o dobro", "o quádruplo", "zero"],
          answer: 2,
          explanation: "As ondas chegam em fase e as **amplitudes** se somam: amplitude dobrada, intensidade (proporcional ao quadrado) quadruplicada. A energia não é criada: ela sai dos mínimos, onde a intensidade é menor que a de uma caixa só.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "nivel",
      prompt: "Uma fonte pontual emite {P} W de potência sonora igualmente em todas as direções. Qual o nível sonoro a {r} m dela?",
      vary: { P: [0.001, 2, 3], r: [1, 40, 1] },
      answer: { label: "β", unit: "dB", compute: (p) => level(p) },
      tolerance: 0.01,
      hint: "I = P/(4πr²) e β = 10 log(I/10⁻¹² W/m²).",
    },
    {
      id: "pressao",
      prompt: "Qual a amplitude de pressão de um som de {beta} dB no ar (ρ = 1,2 kg/m³, c = 343 m/s)?",
      vary: { beta: [40, 120, 0] },
      answer: {
        label: "p₀",
        unit: "Pa",
        compute: (p) => Math.sqrt(2 * RHO * C_SOM * I0 * 10 ** (num(p, "beta") / 10)),
      },
      hint: "Ache I a partir de β e use I = p₀²/(2ρc).",
    },
  ],

  init: () => [0],
  derivatives: () => [1],
  dt: 1 / 120,
  sampleEvery: 6,
  tEnd: 600,

  viewport: () => ({ xMin: 0, xMax: 10, yMin: 0, yMax: 7 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state, params: p, theme } = frame;
    const tv = state[0] ?? 0;
    const f = num(p, "f", 1000);
    const r = num(p, "r", 2);
    const beta = level(p);
    const thr = threshold(f);
    if (isDuas(p)) {
      renderDuas(d, theme, p, tv);
      return;
    }

    // ---- Painel A: partículas de ar numa janela de 3λ ao redor do ouvinte
    const cols = 46;
    const rows = 6;
    const spacing = (PA.x1 - PA.x0) / cols;
    const k = (2 * Math.PI * 3) / (PA.x1 - PA.x0); // 3 comprimentos de onda na janela
    const w = 2 * Math.PI * F_VIS;
    const rel = Math.max(0.08, Math.min(1, beta / 120));
    const amp = 0.45 * spacing * rel;
    const yb = PA.y0 + 0.1;
    const rowH = 0.17;
    for (let i = 0; i <= cols; i++) {
      const x = PA.x0 + i * spacing;
      const s = amp * Math.cos(k * (x - PA.x0) - w * tv);
      for (let j = 0; j < rows; j++) {
        const jitter = ((i * 7 + j * 13) % 5) * 0.012;
        d.dot(x + s + jitter, yb + j * rowH, 2.6, i === Math.round(cols / 2) ? (theme.series[1] ?? theme.accent) : theme.muted, 0.9);
      }
    }
    // Pressão Δp = ρcω s₀ sen(kx − ωt)
    const yp = PA.y0 + rows * rowH + 0.35;
    d.line(PA.x0, yp, PA.x1, yp, { color: theme.grid, width: 1 });
    d.plot((x) => yp + 0.28 * Math.sin(k * (x - PA.x0) - w * tv), PA.x0, PA.x1, { color: theme.positive, width: 2 });
    d.text("pressão Δp", PA.x1, yp + 0.38, { color: theme.positive, size: 10, align: "right" });
    d.text(
      `ar perto do ouvinte: janela de 3λ = ${fmtSci(3 * wavelength(p))} m · câmera lenta e deslocamento ampliados (real: s₀ = ${fmtSci(displacementAmp(p))} m)`,
      PA.x0,
      PA.y1 + 0.35,
      { color: theme.muted, size: 10, align: "left" },
    );
    const xc = PA.x0 + (cols / 2) * spacing;
    d.arrowPx(PA.x0, PA.y0 - 0.12, 1, 0, 40, { color: theme.text, width: 1.5 });
    d.text("propagação", PA.x0, PA.y0 - 0.12, { color: theme.muted, size: 10, align: "left", dx: 46 });
    d.text("partícula marcada", xc, PA.y0 - 0.12, { color: theme.series[1], size: 10 });

    // ---- Painel B: fonte, ouvinte e distância (escala logarítmica)
    const xL = rX(r);
    d.line(PB.x0 + 0.9, PB.y, PB.x1 - 0.2, PB.y, { color: theme.muted, width: 1 });
    for (const rr of [0.5, 1, 2, 5, 10, 20, 50]) {
      d.line(rX(rr), PB.y - 0.06, rX(rr), PB.y + 0.06, { color: theme.muted, width: 1 });
      d.text(`${fmtBR(rr, rr < 1 ? 1 : 0)} m`, rX(rr), PB.y - 0.22, { color: theme.muted, size: 9 });
    }
    // Alto-falante
    d.rect(PB.x0, PB.y - 0.18, 0.22, 0.36, { fill: theme.text });
    d.polyline([[PB.x0 + 0.22, PB.y - 0.1], [PB.x0 + 0.5, PB.y - 0.32], [PB.x0 + 0.5, PB.y + 0.32], [PB.x0 + 0.22, PB.y + 0.1]], { color: theme.text, close: true, fill: theme.muted });
    d.text(`P = ${fmtSci(num(p, "P", 0.01))} W`, PB.x0 + 0.25, PB.y + 0.5, { color: theme.text, size: 10 });
    for (let q = 1; q <= 3; q++) {
      const a0 = -0.6;
      const pts: [number, number][] = [];
      for (let z = 0; z <= 12; z++) {
        const a = a0 + (z / 12) * -2 * a0;
        pts.push([PB.x0 + 0.5 + q * 0.18 * Math.cos(a), PB.y + q * 0.18 * Math.sin(a)]);
      }
      d.polyline(pts, { color: theme.accent, width: 1.5, alpha: 1 - q * 0.25 });
    }
    // Ouvinte
    d.dot(xL, PB.y, 7, theme.series[2] ?? theme.accent);
    d.text("ouvinte", xL, PB.y + 0.28, { color: theme.text, size: 10 });
    d.arrow(PB.x0 + 0.9, PB.y + 0.5, xL - PB.x0 - 0.9, 0, { color: theme.text, width: 1 });
    d.text(`r = ${fmtBR(r, r < 10 ? 2 : 1)} m`, (PB.x0 + 0.9 + xL) / 2, PB.y + 0.62, { color: theme.text, size: 10 });
    d.text(
      `I = ${fmtSci(intensity(p))} W/m²   ·   β = ${fmtBR(beta)} dB   ·   p₀ = ${fmtSci(pressureAmp(p))} Pa   ·   ${Math.round(num(p, "som")) === 1 ? "som ligado" : "som desligado"}`,
      5,
      PB.y - 0.55,
      { color: theme.text, size: 12, weight: "600" },
    );

    // ---- Painel C: limiar de audição × frequência
    d.rect(PC.x0, PC.y0, PC.x1 - PC.x0, PC.y1 - PC.y0, { stroke: theme.grid, width: 1 });
    for (const ff of [20, 50, 100, 200, 500, 1000, 2000, 5000, 10000, 20000]) {
      d.line(fX(ff), PC.y0, fX(ff), PC.y1, { color: theme.grid, width: 1 });
      d.text(ff >= 1000 ? `${ff / 1000}k` : `${ff}`, fX(ff), PC.y0 - 0.12, { color: theme.muted, size: 9 });
    }
    for (const b of [0, 40, 80, 120]) d.text(`${b}`, PC.x0 - 0.1, dbY(b), { color: theme.muted, size: 9, align: "right" });
    d.text("dB", PC.x0 - 0.1, PC.y1 + 0.12, { color: theme.muted, size: 9, align: "right" });
    d.text("Hz", PC.x1 + 0.1, PC.y0 - 0.12, { color: theme.muted, size: 9, align: "left" });
    for (const [b, nome] of REFERENCIAS) {
      d.line(PC.x1, dbY(b), PC.x1 + 0.08, dbY(b), { color: theme.muted, width: 1 });
      d.text(nome, PC.x1 + 0.12, dbY(b), { color: theme.muted, size: 9, align: "left" });
    }
    const curve: [number, number][] = [];
    for (let z = 0; z <= 120; z++) {
      const ff = 20 * 1000 ** (z / 120);
      curve.push([fX(ff), dbY(threshold(ff))]);
    }
    const top: [number, number][] = [[fX(20000), dbY(130)], [fX(20), dbY(130)]];
    d.polyline([...curve, ...top], { color: "none", fill: theme.series[2], alpha: 0.1, close: true });
    d.polyline(curve, { color: theme.accent, width: 2 });
    d.line(PC.x0, dbY(130), PC.x1, dbY(130), { color: theme.positive, dash: [5, 4], width: 1.2 });
    d.text("limiar de audição", fX(60), dbY(threshold(60)) + 0.15, { color: theme.accent, size: 10, align: "left" });
    d.text("região audível", fX(1500), dbY(95), { color: theme.series[2], size: 10 });
    const audivel = beta > thr;
    d.dot(fX(f), dbY(beta), 6, audivel ? (theme.series[1] ?? theme.accent) : theme.muted);
    d.text(`${fmtBR(beta)} dB, ${f >= 1000 ? fmtBR(f / 1000, 2) + " kHz" : Math.round(f) + " Hz"} (${audivel ? "audível" : "inaudível"})`, fX(f), dbY(beta), {
      color: theme.text,
      size: 10,
      dy: -12,
      align: fX(f) > 7 ? "right" : "left",
    });
  },
});

export default somIntensidade;
