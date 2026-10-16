import { clamp, defineSim, draw, num, texNum, type Params, type V2 } from "@fisilab/core";
import {
  BOX_H,
  BOX_W,
  carrierDensity,
  conductivity,
  currentDensity,
  driftSpeed,
  E_CHARGE,
  makeGas,
  massOf,
  material,
  mobility,
  relaxationTime,
  resistivity,
  stepGas,
  thermalSpeed,
  type Gas,
} from "./model.ts";

export * from "./model.ts";

export interface DState {
  gas: Gas;
  /** Tempo físico simulado (fs). */
  tfs: number;
  /** Média móvel de ⟨vx⟩ na animação (nm/fs). */
  vxEma: number;
  /** Rastro do elétron destacado (nm). */
  path: V2[];
}

const mat = (p: Params) => material(num(p, "material"));
const T = (p: Params) => num(p, "T", 300);
const Ef = (p: Params) => num(p, "E", 1);
const tauFs = (p: Params) => relaxationTime(mat(p), T(p)) * 1e15;
/** Desvio-padrão de cada componente da velocidade (nm/fs): √(kT/m). */
const sigmaV = (p: Params) => (thermalSpeed(mat(p), T(p)) / Math.SQRT2) * 1e-6;
/** Passo físico (fs) por passo da animação: pelo menos 10 passos por τ. */
export const fsPerStep = (p: Params) => Math.min(tauFs(p) / 10, 2.5);

/** Fator de ampliação do campo na animação (1 = real). Ampliado: deriva = 30 % de v_th. */
export function zoom(p: Params): number {
  if (Math.round(num(p, "lupa", 1)) === 0) return 1;
  const vd = driftSpeed(mat(p), T(p), Ef(p));
  return vd > 0 ? (0.3 * thermalSpeed(mat(p), T(p))) / vd : 1;
}

/** Número de elétrons desenhados: real numa fatia de 40 × 22 × 1,5 nm³ (metal) ou ∝ n (semicondutor). */
export function electronCount(p: Params): number {
  const m = mat(p);
  const n = carrierDensity(m, T(p));
  if (m.kind === "metal") return clamp(Math.round(n * BOX_W * BOX_H * 1.5e-27), 30, 260);
  return clamp(Math.round((40 * n) / m.n300), 2, 260);
}

/** Velocidade de deriva medida na animação, convertida para o campo real (m/s, sinal de vx). */
export const measuredDrift = (s: DState, p: Params) => (s.vxEma * 1e6) / zoom(p);
export const measuredTau = (s: DState) => (s.gas.coll > 0 ? s.gas.tAcc / s.gas.coll : 0);
/** Média de vx desde o início (m/s, campo real). */
export const meanDrift = (s: DState, p: Params) => (s.gas.tAcc > 0 ? (s.gas.vxInt / s.gas.tAcc) * 1e6 / zoom(p) : 0);

const fmtSci = (v: number) => {
  if (v === 0 || !Number.isFinite(v)) return "0";
  const e = Math.floor(Math.log10(Math.abs(v)));
  if (e >= -2 && e < 4) return v.toPrecision(3).replace(".", ",");
  const m = v / 10 ** e;
  const sup = String(e).replace(/[-0-9]/g, (c) => "⁻⁰¹²³⁴⁵⁶⁷⁸⁹"["-0123456789".indexOf(c)]!);
  return `${m.toFixed(2).replace(".", ",")}×10${sup}`;
};

// Layout do palco
const BOX_Y0 = 6;
const HIST = { x0: 0, x1: 40, y0: -12, y1: 1 };
const RHO = { x0: 45, x1: 64, y0: 9, y1: 26 };

export const drude = defineSim<DState>({
  id: "drude",
  title: "Modelo de Drude e resistividade",
  course: "FG III",
  topic: "Corrente",
  priority: "P2",
  summary:
    "Elétrons livres voam, colidem ao acaso e ganham uma pequena deriva contra o campo. Meça τ, a mobilidade e σ = ne²τ/m, compare a deriva com a velocidade térmica e veja a resistividade subir com T no metal e cair no semicondutor.",
  equations: [
    String.raw`m\frac{d\langle\vec v\rangle}{dt} = -e\vec E - \frac{m\langle\vec v\rangle}{\tau} \;\Rightarrow\; \vec v_d = -\frac{e\tau}{m}\vec E = -\mu\vec E`,
    String.raw`\vec J = -ne\vec v_d = \sigma\vec E,\qquad \sigma = \frac{ne^2\tau}{m},\qquad \rho = \frac1\sigma = \frac{m}{ne^2\tau}`,
    String.raw`P(\text{colidir em } dt) = \frac{dt}{\tau} \qquad v_{\text{th}} = \sqrt{\frac{2k_BT}{m}}\ \text{(2D)}`,
    String.raw`\text{metal: } \frac1\tau = \frac1{\tau_{\text{imp}}} + \frac1{\tau_{\text{fônon}}(T)},\ \frac1{\tau_{\text{fônon}}} \propto T \qquad \text{semicondutor: } n \propto T^{3/2}e^{-E_g/2k_BT}`,
  ],
  liveEquations(s, p) {
    const m = mat(p);
    const tau = relaxationTime(m, T(p));
    const vd = driftSpeed(m, T(p), Ef(p));
    return [
      String.raw`v_d = \frac{e\tau E}{m} = \frac{(1{,}6\times10^{-19})(${texNum(tau)})(${texNum(Ef(p))})}{${texNum(massOf(m))}} = ${texNum(vd)}\ \text{m/s} \quad \text{(medida: } ${texNum(Math.abs(measuredDrift(s, p)))}\text{)}`,
      String.raw`\frac{v_d}{v_{\text{th}}} = \frac{${texNum(vd)}}{${texNum(thermalSpeed(m, T(p)))}} = ${texNum(vd / thermalSpeed(m, T(p)))}`,
      String.raw`\sigma = \frac{ne^2\tau}{m} = ${texNum(conductivity(m, T(p)))}\ \text{S/m} \qquad \rho = ${texNum(resistivity(m, T(p)))}\ \Omega\cdot\text{m} \qquad J = \sigma E = ${texNum(currentDensity(m, T(p), Ef(p)))}\ \text{A/m}^2`,
      String.raw`\tau_{\text{medido}} = ${texNum(measuredTau(s))}\ \text{fs} \quad (\tau = ${texNum(tau * 1e15)}\ \text{fs})`,
    ];
  },

  params: [
    {
      key: "material",
      label: "Material",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Cobre (metal)" },
        { value: 1, label: "Alumínio (metal)" },
        { value: 2, label: "Silício intrínseco (semicondutor)" },
      ],
    },
    { key: "T", label: "Temperatura", unit: "K", min: 50, max: 800, step: 10, default: 300 },
    { key: "E", label: "Campo elétrico E", unit: "V/m", min: 0.01, max: 10000, step: 0.01, default: 1, log: true, live: true },
    {
      key: "lupa",
      label: "Deriva na animação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 0, label: "Real (invisível: v_d ≪ v_th)" },
        { value: 1, label: "Ampliada até 30 % de v_th" },
      ],
    },
  ],

  observables: [
    { key: "vd", label: "Velocidade de deriva medida", unit: "m/s", value: (s, p) => -measuredDrift(s, p) },
    { key: "vdTeo", label: "Deriva prevista eEτ/m", unit: "m/s", value: (_s, p) => driftSpeed(mat(p), T(p), Ef(p)) },
    { key: "vth", label: "Velocidade térmica √(2kT/m)", unit: "m/s", value: (_s, p) => thermalSpeed(mat(p), T(p)) },
    { key: "razao", label: "v_d / v_th", unit: "", value: (_s, p) => driftSpeed(mat(p), T(p), Ef(p)) / thermalSpeed(mat(p), T(p)) },
    { key: "tauMed", label: "Tempo entre colisões medido", unit: "fs", value: (s) => measuredTau(s) },
    { key: "tau", label: "Tempo de relaxação τ", unit: "fs", value: (_s, p) => tauFs(p) },
    { key: "mu", label: "Mobilidade μ = eτ/m", unit: "m²/(V·s)", value: (_s, p) => mobility(mat(p), T(p)) },
    { key: "n", label: "Densidade de portadores n", unit: "m⁻³", value: (_s, p) => carrierDensity(mat(p), T(p)) },
    { key: "sigma", label: "Condutividade σ", unit: "S/m", value: (_s, p) => conductivity(mat(p), T(p)) },
    { key: "rho", label: "Resistividade ρ", unit: "Ω·m", value: (_s, p) => resistivity(mat(p), T(p)) },
    { key: "E", label: "Campo E", unit: "V/m", value: (_s, p) => Ef(p) },
    { key: "J", label: "Densidade de corrente medida n e v_d", unit: "A/m²", value: (s, p) => -carrierDensity(mat(p), T(p)) * E_CHARGE * measuredDrift(s, p) },
    { key: "tfs", label: "Tempo físico", unit: "fs", value: (s) => s.tfs },
  ],
  chart: { x: "t", y: "vd" },

  scenarios: [
    {
      id: "deriva",
      label: "Deriva × agitação térmica",
      params: { material: 0, T: 300, E: 1, lupa: 1 },
      guide: `### Uma deriva lenta no meio do caos
1. Rode e siga o elétron destacado: trechos retos (voo livre) curvados pelo campo, interrompidos por colisões.
2. O histograma de $v_x$ é quase a gaussiana térmica, **deslocada** para a esquerda: isso é a deriva.
3. A animação amplia o campo. Troque para **Real**: o deslocamento some. Compare $v_d \\approx$ mm/s com $v_{\\text{th}} \\approx 10^5$ m/s nas equações.
4. Espere o gráfico de $v_d$ estabilizar e compare com $e\\tau E/m$. Confira também $\\tau_{\\text{medido}}$.`,
      predict: [
        {
          question: "Num fio de cobre com E = 1 V/m, a velocidade média de deriva dos elétrons é da ordem de…",
          options: ["10⁸ m/s (quase a da luz)", "10⁵ m/s", "1 m/s", "Alguns mm/s"],
          answer: 3,
          explanation:
            "v_d = eτE/m ≈ (1,6×10⁻¹⁹)(2,5×10⁻¹⁴)(1)/(9,1×10⁻³¹) ≈ 4×10⁻³ m/s. A agitação térmica é dez milhões de vezes mais rápida, mas aponta em todas as direções e se cancela na média.",
        },
      ],
    },
    {
      id: "ohm",
      label: "Lei de Ohm emergente",
      params: { material: 0, T: 300, E: 2, lupa: 1 },
      guide: `### J proporcional a E
1. Rode até $v_d$ estabilizar. Anote $E$ e $J$.
2. Dobre $E$ (ao vivo) e espere de novo. O que acontece com $J$?
3. Ponha o gráfico com $E$ no eixo x e $J$ no eixo y: os pontos formam uma reta pela origem, de inclinação $\\sigma$.
4. A linearidade vem de $\\tau$ não depender de $E$: cada elétron "esquece" o ganho a cada colisão.`,
    },
    {
      id: "temperatura",
      label: "Metal × semicondutor",
      params: { material: 0, T: 300, E: 1, lupa: 1 },
      guide: `### O efeito da temperatura
1. Veja o gráfico $\\rho(T)$ à direita: no cobre ele cresce quase linearmente (mais fônons, $\\tau$ menor).
2. Aumente $T$ para 600 K e meça $\\tau$: as colisões ficam mais frequentes.
3. Troque para **silício**: $\\rho$ despenca com $T$, porque $n \\propto e^{-E_g/2k_BT}$ cresce muito mais rápido do que $\\tau$ diminui.
4. Conte os elétrons na caixa a 300 K e a 600 K no silício.`,
      predict: [
        {
          question: "Ao aquecer, a resistividade de um metal ___ e a de um semicondutor intrínseco ___.",
          options: ["aumenta; diminui", "diminui; aumenta", "aumenta; aumenta", "não muda; diminui"],
          answer: 0,
          explanation:
            "No metal n é fixo e τ cai com T (mais colisões com fônons). No semicondutor τ também cai, mas o número de portadores cresce exponencialmente e domina.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "deriva-cobre",
      prompt:
        "No cobre, n = 8,47 × 10²⁸ m⁻³ e ρ = {rho} × 10⁻⁸ Ω·m. Um fio de seção {A} mm² conduz {I} A. Qual a velocidade de deriva dos elétrons, em mm/s?",
      vary: { rho: [1.6, 1.8, 2], A: [0.5, 4, 1], I: [1, 20, 0] },
      answer: { label: "v_d", unit: "mm/s", compute: (p) => (num(p, "I") / (num(p, "A") * 1e-6 * 8.47e28 * E_CHARGE)) * 1e3 },
      hint: "I = n e v_d A. A resistividade não é necessária aqui.",
    },
    {
      id: "tau-de-rho",
      prompt: "Um metal tem {nn} × 10²⁸ elétrons livres por m³ e resistividade {rho} × 10⁻⁸ Ω·m. Pelo modelo de Drude, quanto vale τ, em fs?",
      vary: { nn: [2, 18, 1], rho: [1.5, 10, 2] },
      answer: { label: "τ", unit: "fs", compute: (p) => (9.1093837015e-31 / (num(p, "nn") * 1e28 * E_CHARGE ** 2 * num(p, "rho") * 1e-8)) * 1e15 },
      hint: "ρ = m/(ne²τ) ⇒ τ = m/(ne²ρ).",
    },
  ],

  init(p) {
    const gas = makeGas(electronCount(p), sigmaV(p), 12345);
    return { gas, tfs: 0, vxEma: 0, path: [[gas.x[0]!, gas.y[0]!]] };
  },

  step(s, p) {
    const h = fsPerStep(p);
    const tau = tauFs(p);
    // a = −eE/m (elétron, E em +x), em nm/fs², com o fator de ampliação.
    const ax = ((-E_CHARGE * Ef(p) * zoom(p)) / massOf(mat(p))) * 1e-21;
    const gas = stepGas(s.gas, h, tau, ax, sigmaV(p));
    const N = gas.vx.length;
    let mean = 0;
    for (let i = 0; i < N; i++) mean += gas.vx[i]!;
    mean /= N;
    const w = 1 - Math.exp(-h / (6 * tau));
    const vxEma = s.vxEma + (mean - s.vxEma) * w;
    const path = s.path.length >= 120 ? s.path.slice(-119) : s.path.slice();
    path.push([gas.x[0]!, gas.y[0]!]);
    return { gas, tfs: s.tfs + h, vxEma, path };
  },
  dt: 0.02,
  sampleEvery: 5,
  maxSamples: 3000,

  viewport: () => ({ xMin: -2, xMax: 68, yMin: -15.5, yMax: 34.5 }),

  render(ctx, frame) {
    const { state: s, params: p, theme } = frame;
    const d = draw(ctx, frame);
    const m = mat(p);
    const g = s.gas;
    const y0 = BOX_Y0;

    // Rede cristalina (íons) e caixa
    d.rect(0, y0, BOX_W, BOX_H, { fill: theme.dark ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.02)", stroke: theme.muted, width: 1 });
    for (let x = 2; x < BOX_W; x += 4) for (let y = 2; y < BOX_H; y += 4) d.dot(x, y0 + y, 3.5, theme.positive, 0.18);

    // Rastro do elétron destacado (quebra quando atravessa a borda periódica)
    let seg: [number, number][] = [];
    const flush = () => {
      if (seg.length > 1) d.polyline(seg, { color: theme.series[1], width: 1.4, alpha: 0.85 });
      seg = [];
    };
    for (let i = 0; i < s.path.length; i++) {
      const q = s.path[i]!;
      const prev = s.path[i - 1];
      if (prev && Math.hypot(q[0] - prev[0], q[1] - prev[1]) > 5) flush();
      seg.push([q[0], y0 + q[1]]);
    }
    flush();

    // Elétrons
    for (let i = 0; i < g.x.length; i++) d.dot(g.x[i]!, y0 + g.y[i]!, i === 0 ? 4.5 : 3, i === 0 ? theme.series[1]! : theme.negative, i === 0 ? 1 : 0.85);

    // Campo e deriva
    d.arrow(2, y0 + BOX_H + 2, 10, 0, { color: theme.accent, width: 2.5 });
    d.text(`E = ${fmtSci(Ef(p))} V/m`, 13, y0 + BOX_H + 2, { color: theme.accent, size: 12, align: "left", weight: "600" });
    const vdAnim = s.vxEma; // nm/fs
    const sv = sigmaV(p);
    if (Math.abs(vdAnim) > 1e-6) {
      const L = clamp((vdAnim / sv) * 12, -12, 12);
      d.arrow(36, y0 + BOX_H + 2, L, 0, { color: theme.negative, width: 2.5 });
      d.text("deriva dos elétrons", 37, y0 + BOX_H + 3.6, { color: theme.negative, size: 11, align: "right" });
    }
    const zf = zoom(p);
    d.text(
      `${m.name}  •  T = ${T(p)} K  •  ${g.x.length} elétrons${m.kind === "semicondutor" ? " (∝ n)" : ""}${zf > 1.0001 ? `  •  campo ampliado ${fmtSci(zf)}×` : ""}`,
      0,
      y0 + BOX_H + 5.2,
      { color: theme.text, size: 12, align: "left" },
    );

    // Histograma de vx com a gaussiana deslocada
    const nb = 31;
    const vmax = 3.5 * sv;
    const counts = new Array<number>(nb).fill(0);
    for (const v of g.vx) {
      const b = Math.floor(((v + vmax) / (2 * vmax)) * nb);
      if (b >= 0 && b < nb) counts[b]!++;
    }
    const N = g.vx.length;
    const bw = (2 * vmax) / nb;
    const peak = N * bw / (sv * Math.sqrt(2 * Math.PI));
    const hy = (c: number) => HIST.y0 + ((HIST.y1 - HIST.y0) * c) / (1.35 * peak);
    const hx = (v: number) => HIST.x0 + ((v + vmax) / (2 * vmax)) * (HIST.x1 - HIST.x0);
    for (let b = 0; b < nb; b++) {
      const v0 = -vmax + b * bw;
      d.rect(hx(v0) + 0.05, HIST.y0, hx(v0 + bw) - hx(v0) - 0.1, hy(counts[b]!) - HIST.y0, { fill: theme.negative, alpha: 0.35 });
    }
    d.plot((x) => {
      const v = -vmax + ((x - HIST.x0) / (HIST.x1 - HIST.x0)) * 2 * vmax;
      return hy(peak * Math.exp(-((v - vdAnim) ** 2) / (2 * sv * sv)));
    }, HIST.x0, HIST.x1, { color: theme.text, width: 1.6 });
    d.line(HIST.x0, HIST.y0, HIST.x1, HIST.y0, { color: theme.muted, width: 1 });
    d.line(hx(0), HIST.y0, hx(0), HIST.y1, { color: theme.muted, width: 1, dash: [3, 3] });
    d.text("vₓ = 0", hx(0), HIST.y0 - 1, { color: theme.muted, size: 11 });
    d.text("distribuição de vₓ (histograma) e gaussiana térmica deslocada pela deriva", HIST.x0, HIST.y1 + 1.6, { color: theme.text, size: 12, align: "left" });

    // Barras: deriva × térmica (valores reais)
    const vth = thermalSpeed(m, T(p));
    const vd = driftSpeed(m, T(p), Ef(p));
    d.text("valores reais", RHO.x0, 3.2, { color: theme.text, size: 12, align: "left", weight: "600" });
    d.text(`v_th ≈ ${fmtSci(vth)} m/s`, RHO.x0, 1.4, { color: theme.text, size: 12, align: "left" });
    d.text(`v_d ≈ ${fmtSci(vd)} m/s`, RHO.x0, -0.4, { color: theme.negative, size: 12, align: "left" });
    d.text(`v_d/v_th ≈ ${fmtSci(vd / vth)}`, RHO.x0, -2.2, { color: theme.text, size: 12, align: "left" });
    d.text(`τ ≈ ${fmtSci(tauFs(p))} fs`, RHO.x0, -4, { color: theme.muted, size: 11, align: "left" });
    d.text(`livre caminho ℓ ≈ ${fmtSci(vth * relaxationTime(m, T(p)) * 1e9)} nm`, RHO.x0, -5.8, { color: theme.muted, size: 11, align: "left" });

    // ρ(T) do material
    const Ts: number[] = [];
    for (let t = 50; t <= 800; t += 10) Ts.push(t);
    const logR = Ts.map((t) => Math.log10(resistivity(m, t)));
    const lo = Math.min(...logR), hi = Math.max(...logR);
    const metal = m.kind === "metal";
    const val = (t: number) => (metal ? resistivity(m, t) / resistivity(m, 800) : (Math.log10(resistivity(m, t)) - lo) / Math.max(hi - lo, 1e-9));
    const px = (t: number) => RHO.x0 + ((t - 50) / 750) * (RHO.x1 - RHO.x0);
    const py = (u: number) => RHO.y0 + u * (RHO.y1 - RHO.y0);
    d.line(RHO.x0, RHO.y0, RHO.x1, RHO.y0, { color: theme.muted, width: 1 });
    d.line(RHO.x0, RHO.y0, RHO.x0, RHO.y1, { color: theme.muted, width: 1 });
    d.polyline(Ts.map((t) => [px(t), py(val(t))] as [number, number]), { color: theme.series[2], width: 2 });
    d.dot(px(T(p)), py(val(T(p))), 5, theme.series[1]!);
    d.text(metal ? "ρ(T) (linear)" : "log ρ(T)", RHO.x0, RHO.y1 + 1.4, { color: theme.text, size: 12, align: "left", weight: "600" });
    d.text("T (K)", RHO.x1, RHO.y0 - 1.3, { color: theme.muted, size: 11, align: "right" });
    d.text(`ρ = ${fmtSci(resistivity(m, T(p)))} Ω·m`, RHO.x0, RHO.y0 - 3, { color: theme.text, size: 12, align: "left" });
  },
});

export default drude;
