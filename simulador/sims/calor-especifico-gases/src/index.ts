import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

/** Constante dos gases, J/(mol·K). */
export const R = 8.314462618;

/** Gases: temperaturas características de rotação e de vibração (K). Monoatômico: sem rotação nem vibração. */
export const GASES = [
  { nome: "Hidrogênio (H₂)", curto: "H₂", thetaR: 87.6, thetaV: 6332, mono: false },
  { nome: "Nitrogênio (N₂)", curto: "N₂", thetaR: 2.88, thetaV: 3374, mono: false },
  { nome: "Cloro (Cl₂)", curto: "Cl₂", thetaR: 0.351, thetaV: 808, mono: false },
  { nome: "Hélio (He), monoatômico", curto: "He", thetaR: 0, thetaV: 0, mono: true },
];

export const gasOf = (p: Params) => GASES[Math.min(GASES.length - 1, Math.max(0, Math.round(num(p, "gas"))))]!;

/** Capacidade térmica de rotação por mol, em unidades de R: rotor rígido, soma sobre J (sem estatística de spin nuclear). */
export function cRot(thetaR: number, T: number): number {
  if (thetaR <= 0) return 0;
  const x = thetaR / T;
  const Jmax = Math.ceil(Math.sqrt(60 / x)) + 10;
  let Z = 0, E1 = 0, E2 = 0;
  for (let J = 0; J <= Jmax; J++) {
    const e = J * (J + 1);
    const w = (2 * J + 1) * Math.exp(-e * x);
    Z += w;
    E1 += w * e;
    E2 += w * e * e;
  }
  const m1 = E1 / Z, m2 = E2 / Z;
  return x * x * (m2 - m1 * m1);
}

/** Capacidade térmica de vibração por mol, em unidades de R (oscilador harmônico quântico, função de Einstein). */
export function cVib(thetaV: number, T: number): number {
  if (thetaV <= 0) return 0;
  const y = thetaV / T;
  if (y > 700) return 0;
  const em = Math.exp(-y);
  return (y * y * em) / (1 - em) ** 2;
}

/** C_V/R e as três partes. */
export function cv(g: (typeof GASES)[number], T: number) {
  const tr = 1.5;
  const rot = g.mono ? 0 : cRot(g.thetaR, T);
  const vib = g.mono ? 0 : cVib(g.thetaV, T);
  return { tr, rot, vib, total: tr + rot + vib };
}

const temp = (p: Params) => num(p, "T", 300);
/** Número com `d` casas decimais, vírgula e sinal de menos tipográfico. */
const fmt = (v: number, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace(".", ",").replace(/^-/, "−") : "—");

// Gráfico (unidades do palco)
const GR = { x0: 1.2, x1: 10.2, y0: 1.2, y1: 8.0 };
const TMIN = 10, TMAX = 10000, CMAX = 4.2;
const gx = (T: number) => GR.x0 + ((Math.log10(T) - Math.log10(TMIN)) / (Math.log10(TMAX) - Math.log10(TMIN))) * (GR.x1 - GR.x0);
const gy = (c: number) => GR.y0 + (c / CMAX) * (GR.y1 - GR.y0);

export const calorEspecificoGases = defineSim({
  id: "calor-especifico-gases",
  title: "Calor específico dos gases e graus de liberdade",
  course: "FG II",
  topic: "Teoria cinética",
  priority: "P1",
  summary:
    "A capacidade térmica molar a volume constante de um gás diatômico em função da temperatura: translação sempre ativa, rotação que só desperta acima de algumas dezenas de kelvins e vibração que só desperta a milhares de kelvins. Veja os degraus 3/2 R, 5/2 R e 7/2 R e a molécula girando e vibrando.",
  equations: [
    String.raw`C_V = \frac{f}{2}R \ \text{(equipartição, cada grau de liberdade ativo contribui com } \tfrac12 R)`,
    String.raw`\frac{C_{\text{rot}}}{R} = x^2\left(\langle\epsilon^2\rangle - \langle\epsilon\rangle^2\right),\ \epsilon = J(J+1),\ x = \frac{\Theta_r}{T} \qquad \frac{C_{\text{vib}}}{R} = \frac{y^2 e^{y}}{(e^{y}-1)^2},\ y = \frac{\Theta_v}{T}`,
    String.raw`\gamma = \frac{C_p}{C_V} = \frac{C_V + R}{C_V}`,
  ],
  liveEquations(_s, p) {
    const g = gasOf(p);
    const c = cv(g, temp(p));
    return [
      String.raw`T = ${texNum(temp(p), 4)}\ \text{K}: \quad \frac{C_V}{R} = \underbrace{1{,}5}_{\text{transl.}} + \underbrace{${texNum(c.rot, 3)}}_{\text{rot.}} + \underbrace{${texNum(c.vib, 3)}}_{\text{vib.}} = ${texNum(c.total, 4)}`,
      String.raw`C_V = ${texNum(c.total * R, 4)}\ \text{J/(mol·K)} \qquad \gamma = ${texNum((c.total + 1) / c.total, 4)}`,
    ];
  },
  derivation: String.raw`### 1. Hipóteses
- Gás ideal: as moléculas não interagem, a não ser para trocar energia em colisões; a capacidade térmica é a soma das contribuições de cada tipo de movimento de uma molécula isolada.
- Translação: três graus de liberdade com níveis tão próximos que se comportam como contínuos em qualquer temperatura do gráfico, dando $\tfrac32 R$.
- Rotação: rotor rígido (distância entre os núcleos fixa). A estatística de spin nuclear, que separa o hidrogênio em orto e para, é ignorada; ela muda a forma da subida do H₂ abaixo de uns 300 K, mas não os patamares.
- Vibração: oscilador harmônico, sem anarmonicidade. Não há dissociação nem excitação eletrônica (o H₂ começa a se dissociar acima de uns 3000 K, região sombreada no gráfico).

### 2. Capacidade térmica a partir das flutuações
Para um movimento com níveis $E_i$ e degenerescências $g_i$, a energia média por molécula é $\langle E\rangle = \sum g_i E_i e^{-E_i/kT}/Z$, com $Z = \sum g_i e^{-E_i/kT}$. Derivando em relação a $T$,
$$\frac{C}{R} = \frac{\langle E^2\rangle - \langle E\rangle^2}{(kT)^2} ,$$
por mol. Esse é o caminho usado para a rotação.

### 3. Rotação
$E_J = J(J+1)\,k\Theta_r$, com $g_J = 2J+1$ e $\Theta_r = \hbar^2/(2Ik)$. Com $\epsilon = J(J+1)$ e $x = \Theta_r/T$,
$$\frac{C_{\text{rot}}}{R} = x^2\big(\langle\epsilon^2\rangle - \langle\epsilon\rangle^2\big) .$$
Para $T \ll \Theta_r$ só $J = 0$ e $J = 1$ importam e $C_{\text{rot}} \approx 12R\,x^2 e^{-2x}$: a rotação está congelada. Para $T \gg \Theta_r$, $C_{\text{rot}} \to R$ (dois graus de liberdade), depois de um pequeno pico de uns 10% perto de $T \approx 0{,}8\,\Theta_r$.

### 4. Vibração
Níveis $E_n = n\,k\Theta_v$ (a energia do ponto zero não muda $C$). A soma geométrica dá a função de Einstein,
$$\frac{C_{\text{vib}}}{R} = \frac{y^2 e^{y}}{(e^{y} - 1)^2}, \qquad y = \frac{\Theta_v}{T},$$
que tende a $R$ (energia cinética e potencial da vibração) quando $T \gg \Theta_v$ e cai como $y^2 e^{-y}$ quando $T \ll \Theta_v$.

### 5. Valores usados
H₂: $\Theta_r = 87{,}6$ K, $\Theta_v = 6332$ K. N₂: 2,88 K e 3374 K. Cl₂: 0,351 K e 808 K. He: monoatômico, só translação. A razão $\gamma = C_p/C_V = (C_V + R)/C_V$ vem da relação de Mayer para o gás ideal.

### 6. Método numérico
A soma de rotação vai de $J = 0$ até $J_{\max} = \lceil\sqrt{60/x}\,\rceil + 10$, onde o fator de Boltzmann já é menor que $e^{-60}$. A função de Einstein é calculada com $e^{-y}$ para evitar estouro. Não há equação diferencial: o tempo só anima a molécula desenhada, cuja rotação e vibração são proporcionais às contribuições $C_{\text{rot}}$ e $C_{\text{vib}}$.`,

  params: [
    { key: "gas", label: "Gás", unit: "", min: 0, max: GASES.length - 1, step: 1, default: 0, options: GASES.map((g, i) => ({ value: i, label: g.nome })) },
    { key: "T", label: "Temperatura", unit: "K", min: TMIN, max: TMAX, step: 1, default: 300, log: true, live: true },
  ],

  observables: [
    { key: "cv", label: "C_V/R", unit: "", value: (_s, p) => cv(gasOf(p), temp(p)).total },
    { key: "CV", label: "C_V", unit: "J/(mol·K)", value: (_s, p) => cv(gasOf(p), temp(p)).total * R },
    { key: "ctr", label: "Translação (em R)", unit: "", value: () => 1.5 },
    { key: "crot", label: "Rotação (em R)", unit: "", value: (_s, p) => cv(gasOf(p), temp(p)).rot },
    { key: "cvib", label: "Vibração (em R)", unit: "", value: (_s, p) => cv(gasOf(p), temp(p)).vib },
    { key: "gamma", label: "γ = C_p/C_V", unit: "", value: (_s, p) => { const c = cv(gasOf(p), temp(p)).total; return (c + 1) / c; } },
    { key: "T", label: "Temperatura", unit: "K", value: (_s, p) => temp(p) },
  ],
  chart: { x: "t", y: "cv" },

  scenarios: [
    {
      id: "hidrogenio",
      label: "H₂: graus de liberdade congelados",
      params: { gas: 0, T: 300 },
      guide: `### Degraus de C_V
1. A 300 K o H₂ tem $C_V \\approx \\tfrac52 R$: três graus de translação e dois de rotação. A vibração não contribui.
2. Baixe a temperatura até 20 K. Abaixo de uns 80 K a rotação **congela** e $C_V$ cai para $\\tfrac32 R$, como num gás monoatômico. A molécula para de girar no desenho.
3. Suba até 5000 K. Acima de uns 1000 K a vibração desperta e $C_V$ se aproxima de $\\tfrac72 R$.
4. O motivo é quântico: a energia de rotação e a de vibração vêm em degraus ($k\\Theta_r$ e $k\\Theta_v$). Se $kT$ é muito menor que o degrau, quase nenhuma colisão tem energia para excitar o movimento, e ele não entra na equipartição.
5. Acompanhe $\\gamma = C_p/C_V$: de $5/3$ a $7/5$ e depois a $9/7$. Isso muda, por exemplo, a velocidade do som no gás.`,
      predict: [
        {
          question: "Por que, à temperatura ambiente, o H₂ tem C_V ≈ 5/2 R e não 7/2 R, como preveria a equipartição com a vibração?",
          options: [
            "Porque a molécula de H₂ é rígida e não pode vibrar",
            "Porque o quantum de vibração (Θᵥ ≈ 6300 K) é muito maior que kT: a vibração está congelada",
            "Porque a rotação absorve a energia da vibração",
          ],
          answer: 1,
          explanation: "A molécula pode vibrar, mas o primeiro nível excitado fica $k\\Theta_v$ acima do fundamental, com $\\Theta_v \\approx 6300$ K. A 300 K, a fração de moléculas excitadas é da ordem de $e^{-21}$: a vibração praticamente não armazena energia.",
        },
      ],
    },
    {
      id: "comparar",
      label: "Comparar gases à temperatura ambiente",
      params: { gas: 2, T: 300 },
      guide: `### Moléculas pesadas vibram antes
1. O Cl₂, mais pesado e com ligação mais fraca, tem $\\Theta_v \\approx 800$ K: a 300 K a vibração já contribui e $C_V$ passa de $\\tfrac52 R$.
2. Troque para N₂ ($\\Theta_v \\approx 3400$ K) e para H₂ ($6300$ K). Qual dos três está mais perto de $\\tfrac52 R$?
3. Troque para o hélio: $C_V = \\tfrac32 R$ em qualquer temperatura, porque um átomo isolado não tem rotação nem vibração que importem.`,
    },
  ],

  exercises: [
    {
      id: "energia",
      prompt: "Quanto calor é preciso, a volume constante, para aquecer {n} mol de H₂ de 300 K para 310 K? (Use C_V do H₂ a 300 K = 5/2 R.)",
      vary: { n: [0.5, 5, 1] },
      fixed: { gas: 0, T: 300 },
      answer: { label: "Q", unit: "J", compute: (p) => num(p, "n") * 2.5 * R * 10 },
      hint: "Q = n C_V ΔT, com C_V = (5/2)·8,31 J/(mol·K).",
    },
  ],

  init: () => [0],
  derivatives: () => [1],
  dt: 1 / 60,
  sampleEvery: 6,
  tEnd: 600,

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state, params: p, theme } = frame;
    const g = gasOf(p);
    const T = temp(p);
    const c = cv(g, T);
    const t = state[0] ?? 0;

    // ---- gráfico C_V/R × T (log)
    d.rect(GR.x0, GR.y0, GR.x1 - GR.x0, GR.y1 - GR.y0, { stroke: theme.grid, width: 1 });
    for (const TT of [10, 20, 50, 100, 200, 500, 1000, 2000, 5000, 10000]) {
      d.line(gx(TT), GR.y0, gx(TT), GR.y1, { color: theme.grid, width: 1, alpha: 0.6 });
      d.text(TT >= 1000 ? `${TT / 1000}k` : `${TT}`, gx(TT), GR.y0 - 0.25, { color: theme.muted, size: 10 });
    }
    d.text("T (K), escala log", GR.x1, GR.y0 - 0.65, { color: theme.muted, size: 10, align: "right" });
    for (const [v, lab] of [[1.5, "3/2"], [2.5, "5/2"], [3.5, "7/2"]] as const) {
      d.line(GR.x0, gy(v), GR.x1, gy(v), { color: theme.muted, width: 1, dash: [5, 4] });
      d.text(`${lab} R`, GR.x0, gy(v), { color: theme.muted, size: 10, align: "right", dx: -4 });
    }
    d.text("C_V", GR.x0, GR.y1 + 0.3, { color: theme.muted, size: 11, align: "left" });
    const pts: [number, number][] = [];
    for (let i = 0; i <= 300; i++) {
      const TT = TMIN * (TMAX / TMIN) ** (i / 300);
      pts.push([gx(TT), gy(cv(g, TT).total)]);
    }
    d.polyline(pts, { color: theme.accent, width: 2.5 });
    if (g.curto === "H₂") {
      d.rect(gx(3000), GR.y0, gx(TMAX) - gx(3000), GR.y1 - GR.y0, { fill: theme.muted, alpha: 0.08 });
      d.text("H₂ se dissocia (fora do modelo)", (gx(3000) + gx(TMAX)) / 2, GR.y1 - 0.3, { color: theme.muted, size: 9 });
    }
    d.line(gx(T), GR.y0, gx(T), GR.y1, { color: theme.negative, width: 1, alpha: 0.6 });
    d.dot(gx(T), gy(c.total), 7, theme.negative);
    d.text(`${fmt(c.total, 3)} R`, gx(T), gy(c.total), { color: theme.negative, size: 12, weight: "700", dy: -14 });
    d.text(`${g.nome}: C_V = ${fmt(c.total * R, 2)} J/(mol·K) a ${fmt(T, T < 100 ? 1 : 0)} K   ·   γ = ${fmt((c.total + 1) / c.total, 3)}`, GR.x0, 8.65, {
      color: theme.text,
      size: 13,
      weight: "600",
      align: "left",
    });

    // ---- molécula animada
    const mx = 13.3, my = 6.0;
    const jx = 0.25 * Math.sin(3.1 * t) + 0.12 * Math.sin(7.3 * t);
    const jy = 0.2 * Math.cos(2.7 * t) + 0.1 * Math.sin(5.9 * t);
    d.rect(11.0, 4.1, 4.6, 3.8, { stroke: theme.grid, width: 1 });
    if (g.mono) {
      d.circle(mx + jx, my + jy, 0.3, { fill: theme.series[0]!, stroke: theme.text, width: 1 });
    } else {
      const fr = Math.min(1, c.rot);
      const fv = Math.min(1, c.vib);
      const ang = 0.4 + fr * 1.6 * t;
      const L = 0.7 * (1 + 0.25 * fv * Math.sin(14 * t));
      const ax = Math.cos(ang) * L / 2, ay = Math.sin(ang) * L / 2;
      d.line(mx + jx - ax, my + jy - ay, mx + jx + ax, my + jy + ay, { color: theme.text, width: 3 });
      d.circle(mx + jx - ax, my + jy - ay, 0.25, { fill: theme.series[0]!, stroke: theme.text, width: 1 });
      d.circle(mx + jx + ax, my + jy + ay, 0.25, { fill: theme.series[0]!, stroke: theme.text, width: 1 });
    }
    d.text("molécula (movimento ilustrativo)", 13.3, 4.35, { color: theme.muted, size: 9 });

    // ---- barras das contribuições
    const parts: [string, number, string][] = [
      ["translação", c.tr, theme.series[0]!],
      ["rotação", c.rot, theme.series[1]!],
      ["vibração", c.vib, theme.series[2]!],
    ];
    parts.forEach(([nome, v, col], i) => {
      const y = 3.3 - i * 0.8;
      d.text(nome, 11.0, y, { color: theme.text, size: 11, align: "left" });
      d.rect(12.5, y - 0.2, 2.8 * (v / 1.5), 0.4, { fill: col, alpha: 0.85 });
      d.text(`${fmt(v, 2)} R`, 12.5 + 2.8 * (v / 1.5) + 0.1, y, { color: theme.text, size: 10, align: "left" });
    });
    d.text("contribuições a C_V", 13.3, 3.85, { color: theme.muted, size: 10 });
  },
});

export default calorEspecificoGases;
