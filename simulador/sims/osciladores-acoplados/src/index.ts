import { defineSim, draw, formatBR, num, texNum, type Params } from "@fisilab/core";
import { panel } from "./panel.ts";
import {
  A_REDE,
  derivatives,
  dispersion,
  initialState,
  kcOf,
  massOf,
  modeEnergies,
  modeQ,
  modesOf,
  modalCoords,
  nOf,
  oscillatorEnergy,
  sistemaOf,
  totalEnergy,
} from "./physics.ts";

const X0 = 0.6;
const X1 = 11.4;
const spacing = (n: number) => (X1 - X0) / (n + 1);
const eqX = (n: number, i: number) => X0 + (i + 1) * spacing(n);
/** Ganho visual dos deslocamentos: a amplitude inicial ocupa ~40% do espaçamento. */
const gain = (p: Params) => (0.4 * spacing(nOf(p))) / Math.max(0.005, num(p, "A", 0.1));
const PIV_Y = 9.2;
const PEND_L = 2.4;
const MASS_Y = 7.3;

/** Período de batimento (troca completa de energia ida e volta) para os dois modos mais baixos. */
function beatPeriod(p: Params): number {
  const { omega } = modesOf(p);
  const dw = omega[1]! - omega[0]!;
  return dw > 1e-12 ? (2 * Math.PI) / dw : Infinity;
}

export const osciladoresAcoplados = defineSim({
  id: "osciladores-acoplados",
  title: "Osciladores acoplados e modos normais",
  course: "FG II",
  topic: "Oscilações",
  priority: "P2",
  summary:
    "De 2 a 40 massas ligadas por molas (ou pêndulos acoplados): os modos normais saem dos autovalores da matriz dinâmica, a condição inicial é decomposta em modos e a energia troca de oscilador em batimentos. Com muitas massas, a cadeia vira um meio contínuo com relação de dispersão.",
  equations: [
    String.raw`m\ddot x_i = -k_c\,(2x_i - x_{i-1} - x_{i+1}) \quad\Longleftrightarrow\quad \ddot{\mathbf x} = -D\,\mathbf x`,
    String.raw`D\,\boldsymbol\phi_n = \omega_n^2\,\boldsymbol\phi_n \qquad \mathbf x(t) = \sum_n \boldsymbol\phi_n\left[q_n(0)\cos\omega_n t + \frac{\dot q_n(0)}{\omega_n}\,\text{sen}\,\omega_n t\right],\quad q_n = \boldsymbol\phi_n\!\cdot\mathbf x`,
    String.raw`N = 2:\ \ \omega_1 = \omega_0,\ \ \omega_2 = \sqrt{\omega_0^2 + 2k_c/m} \qquad T_{\text{bat}} = \frac{2\pi}{\omega_2 - \omega_1}`,
    String.raw`\text{cadeia: } \omega(k) = 2\sqrt{k_c/m}\;\left|\text{sen}\frac{ka}{2}\right| \xrightarrow{ka \ll 1} \omega = a\sqrt{k_c/m}\;k`,
  ],
  liveEquations(s, p) {
    const { omega } = modesOf(p);
    const n = omega.length;
    const list = omega
      .slice(0, Math.min(4, n))
      .map((w, i) => String.raw`\omega_{${i + 1}} = ${texNum(w)}`)
      .join(",\\ ");
    const E = modeEnergies(s, p);
    const Et = E.reduce((a, b) => a + b, 0) || 1;
    const frac = E.slice(0, Math.min(4, n))
      .map((e, i) => String.raw`${texNum((100 * e) / Et, 2)}\%_{(${i + 1})}`)
      .join("\\ ");
    const out = [String.raw`${list}${n > 4 ? ",\\ \\dots" : ""}\ \text{rad/s}`, String.raw`\text{energia por modo: } ${frac}`];
    const Tb = beatPeriod(p);
    if (Number.isFinite(Tb)) out.push(String.raw`T_{\text{bat}} = \frac{2\pi}{\omega_2-\omega_1} = ${texNum(Tb)}\ \text{s}`);
    if (sistemaOf(p) === 0) out.push(String.raw`v_{\text{som}} = a\sqrt{k_c/m} = ${texNum(A_REDE * Math.sqrt(kcOf(p) / massOf(p)))}\ \text{m/s}\ (a = 10\ \text{cm})`);
    return out;
  },

  params: [
    {
      key: "sistema",
      label: "Sistema",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Massas e molas (paredes fixas)" },
        { value: 1, label: "Pêndulos acoplados por molas" },
      ],
    },
    { key: "N", label: "Número de osciladores N", unit: "", min: 2, max: 40, step: 1, default: 2 },
    { key: "m", label: "Massa de cada oscilador", unit: "kg", min: 0.05, max: 2, step: 0.05, default: 0.5 },
    { key: "k", label: "Mola das paredes k", unit: "N/m", min: 0, max: 50, step: 0.5, default: 10 },
    { key: "kc", label: "Mola de acoplamento k_c", unit: "N/m", min: 0.1, max: 50, step: 0.1, default: 2 },
    { key: "L", label: "Comprimento dos pêndulos", unit: "m", min: 0.2, max: 3, step: 0.05, default: 1 },
    {
      key: "ci",
      label: "Condição inicial",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Só o oscilador 1 deslocado" },
        { value: 1, label: "Um modo normal puro" },
        { value: 2, label: "Pulso viajando (cadeia longa)" },
        { value: 3, label: "Osciladores 1 e 2 opostos" },
      ],
    },
    { key: "nmodo", label: "Modo normal escolhido n", unit: "", min: 1, max: 40, step: 1, default: 1 },
    { key: "A", label: "Amplitude inicial", unit: "m", min: 0.01, max: 0.3, step: 0.01, default: 0.1 },
    { key: "b", label: "Amortecimento b", unit: "1/s", min: 0, max: 1, step: 0.01, default: 0, live: true },
  ],

  observables: [
    { key: "x1", label: "x₁", unit: "m", value: (s) => s[0]! },
    { key: "x2", label: "x₂", unit: "m", value: (s) => s[1]! },
    { key: "q1", label: "Coordenada normal q₁", unit: "m", value: (s, p) => modalCoords(s, p).q[0]! },
    { key: "q2", label: "Coordenada normal q₂", unit: "m", value: (s, p) => modalCoords(s, p).q[1]! },
    { key: "E1", label: "Energia do oscilador 1", unit: "J", value: (s, p) => oscillatorEnergy(s, p, 0) },
    { key: "E2", label: "Energia do oscilador 2", unit: "J", value: (s, p) => oscillatorEnergy(s, p, 1) },
    { key: "Em1", label: "Energia no modo 1", unit: "J", value: (s, p) => modeEnergies(s, p)[0]! },
    { key: "Em2", label: "Energia no modo 2", unit: "J", value: (s, p) => modeEnergies(s, p)[1]! },
    { key: "E", label: "Energia mecânica total", unit: "J", value: (s, p) => totalEnergy(s, p) },
    { key: "w1", label: "ω₁ (modo mais lento)", unit: "rad/s", value: (_s, p) => modesOf(p).omega[0]! },
    { key: "w2", label: "ω₂", unit: "rad/s", value: (_s, p) => modesOf(p).omega[1]! },
    { key: "Tbat", label: "Período de batimento", unit: "s", value: (_s, p) => Math.min(1e6, beatPeriod(p)) },
  ],
  conserved: "E",
  chart: { x: "t", y: "E1" },

  scenarios: [
    {
      id: "batimento",
      label: "Pêndulos acoplados: batimento",
      params: { sistema: 1, N: 2, L: 1, m: 0.5, kc: 0.4, ci: 0, A: 0.1, b: 0 },
      guide: `### Troca de energia entre pêndulos
1. Só o pêndulo 1 começa deslocado. Rode e acompanhe as energias **E1** e **E2** no gráfico (escolha as duas).
2. A energia passa toda para o pêndulo 2 e volta: é um **batimento** entre os dois modos, $\\omega_1 = \\sqrt{g/L}$ (em fase) e $\\omega_2 = \\sqrt{g/L + 2k_c/m}$ (em oposição).
3. Meça o tempo entre dois máximos de **E1** e compare com $T_{\\text{bat}} = 2\\pi/(\\omega_2 - \\omega_1)$.
4. Plote **Energia no modo 1** e **no modo 2**: elas **não** mudam. Os modos não trocam energia; quem troca são os osciladores.`,
      predict: [
        {
          question: "Só o pêndulo 1 começa a oscilar. Com uma mola de acoplamento fraca, o que acontece com o pêndulo 2?",
          options: [
            "Fica quase parado o tempo todo",
            "Ganha amplitude aos poucos até ficar com toda a energia, e depois devolve",
            "Passa a oscilar igual ao 1, em fase, para sempre",
          ],
          answer: 1,
          explanation:
            "O estado inicial é a soma meio a meio dos dois modos, com frequências ligeiramente diferentes. A defasagem entre eles cresce até que os deslocamentos se cancelam no pêndulo 1: a energia vai e volta com período $2\\pi/(\\omega_2-\\omega_1)$.",
        },
      ],
    },
    {
      id: "modos-dois",
      label: "Dois modos normais",
      params: { sistema: 0, N: 2, m: 0.5, k: 10, kc: 5, ci: 1, nmodo: 2, A: 0.1, b: 0 },
      guide: `### Modo normal: todos na mesma frequência
1. Com **Um modo normal puro** e $n = 2$, as massas oscilam em oposição para sempre, com $\\omega_2 = \\sqrt{(k+2k_c)/m}$.
2. Troque para $n = 1$: as massas andam juntas e a mola central nem é esticada, $\\omega_1 = \\sqrt{k/m}$.
3. Volte para **Só o oscilador 1 deslocado** e veja no painel de baixo que a energia se divide meio a meio entre os modos: $\\mathbf x(0) = \\tfrac12(\\boldsymbol\\phi_1 + \\boldsymbol\\phi_2)\\,A\\sqrt2$.
4. **Arraste** uma das massas para criar outra condição inicial e observe como ela se decompõe.`,
    },
    {
      id: "tres-massas",
      label: "Três massas",
      params: { sistema: 0, N: 3, m: 0.5, k: 8, kc: 8, ci: 1, nmodo: 2, A: 0.1, b: 0 },
      guide: `### Três modos
1. Com $k = k_c$, as frequências são $\\omega_n = 2\\sqrt{k/m}\\,\\text{sen}\\frac{n\\pi}{8}$.
2. No modo 2 a massa do meio fica **parada** (é um nó).
3. Percorra $n = 1, 2, 3$: o número de trocas de sinal ao longo da cadeia cresce com $n$, como numa corda.`,
      predict: [
        {
          question: "No 2º modo de três massas iguais entre paredes, o que faz a massa do meio?",
          options: ["Oscila com amplitude máxima", "Fica parada", "Oscila em fase com as outras duas"],
          answer: 1,
          explanation: "O vetor do modo 2 é $(1, 0, -1)/\\sqrt2$: as massas das pontas vão em oposição e a do meio é um nó.",
        },
      ],
    },
    {
      id: "cadeia",
      label: "Cadeia longa: onda e dispersão",
      params: { sistema: 0, N: 40, m: 0.1, k: 10, kc: 10, ci: 2, A: 0.1, b: 0 },
      guide: `### Do discreto ao contínuo
1. Um pulso começa à esquerda e viaja com velocidade $v = a\\sqrt{k_c/m}$ (com $a = 10$ cm).
2. No painel **ω × número de onda**, os 40 autovalores caem sobre a curva $\\omega = 2\\sqrt{k_c/m}\\,\\text{sen}(ka/2)$: para $ka \\ll 1$ ela é uma reta (meio contínuo, sem dispersão).
3. Veja o pulso se **deformar** e deixar uma cauda oscilante: os comprimentos de onda curtos andam mais devagar (dispersão da rede).
4. Na parede, o pulso volta **invertido** (extremidade fixa).`,
    },
  ],

  exercises: [
    {
      id: "batimento-pendulos",
      prompt:
        "Dois pêndulos iguais de comprimento {L} m e massa {m} kg são ligados por uma mola fraca de constante {kc} N/m. Só um deles é afastado do equilíbrio. Depois de quanto tempo a energia volta toda para ele pela primeira vez (período de batimento)? Use g = 9,81 m/s².",
      vary: { L: [0.5, 2, 2], m: [0.2, 1, 2], kc: [0.1, 0.8, 2] },
      fixed: { sistema: 1, N: 2 },
      answer: {
        label: "T_bat",
        unit: "s",
        compute: (p) => {
          const w1 = Math.sqrt(9.81 / num(p, "L"));
          const w2 = Math.sqrt(9.81 / num(p, "L") + (2 * num(p, "kc")) / num(p, "m"));
          return (2 * Math.PI) / (w2 - w1);
        },
      },
      hint: "ω₁ = √(g/L) (em fase) e ω₂ = √(g/L + 2k_c/m) (em oposição); T = 2π/(ω₂ − ω₁).",
    },
    {
      id: "tres-massas-modo",
      prompt:
        "Três massas de {m} kg estão em linha entre duas paredes, ligadas por quatro molas iguais de {k} N/m. Qual é a frequência (em Hz) do modo normal mais rápido?",
      vary: { m: [0.1, 2, 2], k: [5, 50, 0] },
      fixed: { sistema: 0, N: 3 },
      answer: {
        label: "f₃",
        unit: "Hz",
        compute: (p) => (2 * Math.sqrt(num(p, "k") / num(p, "m")) * Math.sin((3 * Math.PI) / 8)) / (2 * Math.PI),
      },
      hint: "Autovalores da matriz (k/m)·[[2,−1,0],[−1,2,−1],[0,−1,2]]: ω² = (k/m)(2 − √2), 2k/m e (k/m)(2 + √2).",
    },
  ],

  init: (p) => initialState(p),
  derivatives: (s, p) => derivatives(s, p),
  integrator: "rk4",
  dt: 1e-3,
  sampleEvery: 20,
  tEnd: 600,

  pointer: {
    down(s, p, pt) {
      const i = pickMass(s, p, pt.x, pt.y);
      return i < 0 ? undefined : moveMass(s, p, i, pt.x);
    },
    move(s, p, pt, dragging) {
      if (!dragging) return undefined;
      const i = pickMass(s, p, pt.x, pt.y, true);
      return i < 0 ? undefined : moveMass(s, p, i, pt.x);
    },
    cursor: (s, p, pt) => (pickMass(s, p, pt.x, pt.y) >= 0 ? "ew-resize" : undefined),
  },
  actions: [
    { id: "zerar", label: "Parar todos", run: (s) => s.map(() => 0) },
  ],

  viewport: () => ({ xMin: 0, xMax: 12, yMin: -0.1, yMax: 9.9, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const n = nOf(p);
    const G = gain(p);
    const sys = sistemaOf(p);
    const small = n > 12;
    const massR = Math.min(0.32, spacing(n) * (small ? 0.22 : 0.32));
    const colorOf = (i: number) => (i === 0 ? theme.series[1]! : i === 1 ? theme.series[2]! : theme.series[0]!);

    // ---- Sistema físico ----
    const pos = Array.from({ length: n }, (_, i) => eqX(n, i) + G * s[i]!);
    if (sys === 1) {
      d.support(X0 - 0.2, PIV_Y, X1 + 0.2, PIV_Y, { color: theme.muted });
      const by = PIV_Y - PEND_L;
      for (let i = 0; i < n; i++) {
        const px0 = eqX(n, i);
        const bx = pos[i]!;
        const dy = Math.sqrt(Math.max(0, PEND_L ** 2 - (bx - px0) ** 2));
        d.line(px0, PIV_Y, bx, PIV_Y - dy, { color: theme.muted, width: 1.2 });
        if (i < n - 1) d.spring(bx + massR, PIV_Y - dy * 0.55, pos[i + 1]! - massR, PIV_Y - Math.sqrt(Math.max(0, PEND_L ** 2 - (pos[i + 1]! - eqX(n, i + 1)) ** 2)) * 0.55, { color: theme.accent, coils: small ? 4 : 8, amplitudePx: small ? 3 : 5, width: 1.2 });
        d.circle(bx, PIV_Y - dy, massR, { fill: colorOf(i), stroke: theme.text, width: 1 });
      }
      d.text("pêndulos de comprimento L ligados por molas k_c", 6, by - 0.65, { color: theme.muted, size: 10 });
    } else {
      d.support(X0, MASS_Y - 0.7, X0, MASS_Y + 0.7, { color: theme.muted });
      d.support(X1, MASS_Y + 0.7, X1, MASS_Y - 0.7, { color: theme.muted });
      d.line(X0, MASS_Y - massR - 0.02, X1, MASS_Y - massR - 0.02, { color: theme.grid, width: 1 });
      for (let i = 0; i <= n; i++) {
        const xa = i === 0 ? X0 : pos[i - 1]! + massR;
        const xb = i === n ? X1 : pos[i]! - massR;
        const wall = i === 0 || i === n;
        d.spring(xa, MASS_Y, xb, MASS_Y, { color: wall ? theme.muted : theme.accent, coils: small ? 3 : 8, amplitudePx: small ? 3 : 6, width: 1.2 });
      }
      for (let i = 0; i < n; i++) {
        d.line(eqX(n, i), MASS_Y - 0.55, eqX(n, i), MASS_Y - 0.4, { color: theme.muted, width: 1 });
        d.box(pos[i]!, MASS_Y, 2 * massR, 2 * massR, 0, { fill: colorOf(i), stroke: theme.text, width: 1 });
      }
      d.text("molas das paredes: k   ·   molas entre massas: k_c (azul)", 6, MASS_Y + 0.95, { color: theme.muted, size: 10 });
    }
    if (n <= 12) for (let i = 0; i < n; i++) d.text(String(i + 1), eqX(n, i), sys === 1 ? PIV_Y + 0.25 : MASS_Y - 0.8, { color: theme.muted, size: 10 });
    d.text(`deslocamentos ampliados ${formatBR(G, 2)}× · arraste uma massa para deslocá-la`, 6, 5.75, { color: theme.muted, size: 10 });

    // ---- Deslocamento × posição (vista transversal) ----
    const A = Math.max(0.005, num(p, "A", 0.1));
    const pw = panel(d, { x0: 0.9, y0: 3.55, x1: 11.4, y1: 5.35 }, { min: 0, max: n + 1 }, { min: -1.3 * A, max: 1.3 * A });
    pw.frame({ xlabel: "oscilador i", ylabel: "x_i (m)", xticks: n <= 12 ? Array.from({ length: n }, (_, i) => i + 1) : [1, 10, 20, 30, 40].filter((v) => v <= n), fy: (v) => formatBR(v, 2) });
    const pts: [number, number][] = [[0, 0], ...Array.from({ length: n }, (_, i): [number, number] => [i + 1, s[i]!]), [n + 1, 0]];
    pw.line(pts, { color: theme.accent, width: 1.5 });
    pw.clip(() => {
      for (let i = 0; i < n; i++) d.dot(pw.X(i + 1), pw.Y(Math.max(-1.3 * A, Math.min(1.3 * A, s[i]!))), small ? 2.5 : 4, colorOf(i));
    });

    // ---- Relação de dispersão com autovalores ----
    const { omega } = modesOf(p);
    const E = modeEnergies(s, p);
    const Et = E.reduce((a, b) => a + b, 0) || 1;
    const wmax = Math.max(dispersion(p, 1), omega[n - 1]!) * 1.12;
    const pd = panel(d, { x0: 0.9, y0: 0.55, x1: 5.9, y1: 2.75 }, { min: 0, max: 1 }, { min: 0, max: wmax });
    pd.frame({ xlabel: "ka/π", ylabel: "ω (rad/s)", xticks: [0, 0.5, 1], fy: (v) => formatBR(v, 2) });
    pd.plot((q) => dispersion(p, q), 0, 1, { color: theme.muted, width: 1.2, dash: [5, 4] });
    if (sys === 0) pd.plot((q) => (Math.PI * q) * Math.sqrt(kcOf(p) / massOf(p)), 0, 1, { color: theme.grid, width: 1 });
    for (let k = 0; k < n; k++) {
      const q = modeQ(p, k);
      const share = E[k]! / Et;
      d.circle(pd.X(q), pd.Y(omega[k]!), 0, { minPx: 2.5 + 7 * Math.sqrt(share), fill: theme.series[1], alpha: 0.25 + 0.75 * Math.min(1, share * 3) });
    }
    d.text("autovalores ω_n (círculo ∝ energia no modo)", 3.4, 3.05, { color: theme.text, size: 10, weight: "600" });

    // ---- Energia por modo ----
    const pe = panel(d, { x0: 6.8, y0: 0.55, x1: 11.4, y1: 2.75 }, { min: 0.5, max: n + 0.5 }, { min: 0, max: 1 });
    pe.frame({ xlabel: "modo n", ylabel: "E_n / E", xticks: n <= 10 ? Array.from({ length: n }, (_, i) => i + 1) : [1, 10, 20, 30, 40].filter((v) => v <= n), yticks: [0, 0.5, 1], fy: (v) => formatBR(v, 2) });
    const bw = 0.7 * (pe.X(2) - pe.X(1));
    for (let k = 0; k < n; k++) {
      const h = pe.Y(E[k]! / Et) - pe.Y(0);
      d.rect(pe.X(k + 1) - bw / 2, pe.Y(0), bw, h, { fill: theme.series[1], alpha: 0.8 });
      if (n <= 6) d.text(`${formatBR(omega[k]!, 3)} rad/s`, pe.X(k + 1), pe.Y(0), { color: theme.muted, size: 9, dy: 20 });
    }
    d.text("decomposição em modos normais", 9.1, 3.05, { color: theme.text, size: 10, weight: "600" });
  },
});

function pickMass(s: number[], p: Params, x: number, y: number, loose = false): number {
  const n = nOf(p);
  const G = gain(p);
  const yMass = sistemaOf(p) === 1 ? PIV_Y - PEND_L : MASS_Y;
  if (Math.abs(y - yMass) > (loose ? 1.5 : 0.5)) return -1;
  let best = -1;
  let dist = loose ? spacing(n) * 0.6 : Math.max(0.25, spacing(n) * 0.4);
  for (let i = 0; i < n; i++) {
    const dd = Math.abs(x - (eqX(n, i) + G * s[i]!));
    if (dd < dist) {
      dist = dd;
      best = i;
    }
  }
  return best;
}

function moveMass(s: number[], p: Params, i: number, x: number): number[] {
  const n = nOf(p);
  const G = gain(p);
  const lim = (0.48 * spacing(n)) / G;
  const out = s.slice();
  out[i] = Math.max(-lim, Math.min(lim, (x - eqX(n, i)) / G));
  out[n + i] = 0;
  return out;
}

export default osciladoresAcoplados;
