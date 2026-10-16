import { defineSim, draw, formatBR, gaussian, num, rng, texNum, type Params } from "@fisilab/core";
import { panel } from "./panel.ts";
import { FLUIDS, RE_LAM, RE_TURB, diamOf, fTurb, fluidOf, intermittency, lenOf, pipeState, pressureDrop, profile } from "./pipe.ts";
import { HIST_EVERY, NX, NY, R_CYL, U0, advectDye, lbmSteps, makeLbm, meanCd, moveCylinder, strouhal, tauOf, vorticity, type Lbm } from "./lbm.ts";

export interface Flow {
  /** Traçadores no tubo: [x ∈ [0, 1), r ∈ [−1, 1]]. */
  parts: [number, number][];
  /** Corante injetado pelo bico. */
  dye: [number, number][];
  /** Posição radial do bico de corante (−1..1). */
  noz: number;
  seed: number;
  lbm: Lbm | null;
  drag: boolean;
}

const modo = (p: Params) => Math.round(num(p, "modo", 0));
const reCyl = (p: Params) => num(p, "Rec", 100);
/** Passos de rede por passo da simulação. */
const SUB = 4;

// Geometria do desenho do tubo
const TX0 = 0.6, TX1 = 11.4, TY = 6.7, TR = 1.25;
/** Velocidade de exibição: v̄ ↔ VIS unidades da tela por segundo (câmera ajustada). */
const VIS = 0.2;
// Canal do LBM
const CX0 = 0.3, CS = 11.4 / NX, CY0 = 4.75;
const cellToX = (x: number) => CX0 + (x + 0.5) * CS;
const cellToY = (y: number) => CY0 + (y + 0.5) * CS;

function initParts(): [number, number][] {
  const out: [number, number][] = [];
  for (let i = 0; i < 6; i++) for (let j = 0; j < 9; j++) out.push([(i + 0.5 * (j % 2)) / 6, -0.88 + (1.76 * j) / 8]);
  return out;
}

/** Espalhamento radial do corante (desvio-padrão de r): ~0 laminar, cresce com a turbulência. */
function dyeSpread(s: Flow): number {
  const d = s.dye.filter(([x]) => x > 0.5);
  if (d.length < 3) return 0;
  const m = d.reduce((a, [, r]) => a + r, 0) / d.length;
  return Math.sqrt(d.reduce((a, [, r]) => a + (r - m) ** 2, 0) / d.length);
}

const lbmVal = (s: Flow, f: (L: Lbm) => number) => (s.lbm ? f(s.lbm) : 0);
const lastCl = (L: Lbm) => L.cl[L.cl.length - 1] ?? 0;
const lastCd = (L: Lbm) => L.cd[L.cd.length - 1] ?? 0;

function vortColor(w: number, dark: boolean): string | null {
  const u = Math.max(-1, Math.min(1, w / 0.025));
  if (Math.abs(u) < 0.04) return null;
  const a = Math.abs(u);
  return u > 0 ? `rgba(220, 70, 60, ${(0.85 * a).toFixed(3)})` : `rgba(50, ${dark ? 130 : 110}, 225, ${(0.85 * a).toFixed(3)})`;
}

export const escoamentoViscoso = defineSim<Flow>({
  id: "escoamento-viscoso",
  title: "Escoamento laminar e turbulento (Poiseuille)",
  course: "FG II",
  topic: "Fluidos",
  priority: "P2",
  summary:
    "Escoamento num tubo: perfil parabólico de Poiseuille, vazão proporcional a r⁴ e perda de carga; o experimento de Reynolds com corante mostra a transição para a turbulência (perfil achatado, atrito de Blasius no diagrama de Moody). Um modo Lattice Boltzmann 2D mostra a esteira de vórtices de Kármán atrás de um cilindro.",
  equations: [
    String.raw`u(r) = \frac{\Delta p}{4\mu L}\,(R^2 - r^2) = 2\bar v\left(1 - \frac{r^2}{R^2}\right) \qquad Q = \frac{\pi R^4\,\Delta p}{8\mu L}`,
    String.raw`Re = \frac{\rho \bar v D}{\mu} \qquad \text{laminar: } Re < 2300 \qquad \text{turbulento: } Re > 4000`,
    String.raw`\Delta p = f\,\frac{L}{D}\,\frac{\rho\bar v^2}{2} \qquad f_{\text{lam}} = \frac{64}{Re} \qquad f_{\text{Blasius}} = 0{,}316\,Re^{-1/4}`,
    String.raw`\text{LBM: } f_i(\mathbf x + \mathbf e_i, t+1) = f_i - \frac{f_i - f_i^{\text{eq}}}{\tau},\quad \nu = \tfrac13\left(\tau - \tfrac12\right) \qquad St = \frac{f_{\text{v}} D}{U}`,
  ],
  liveEquations(s, p) {
    if (modo(p) === 1) {
      const L = s.lbm;
      return [
        String.raw`Re = \frac{UD}{\nu} = ${texNum(reCyl(p))} \qquad \tau = ${texNum(tauOf(reCyl(p)), 4)} \qquad \text{passos de rede} = ${L?.steps ?? 0}`,
        String.raw`St = ${L && strouhal(L) > 0 ? texNum(strouhal(L)) : String.raw`\text{(medindo...)}`} \qquad \bar C_D = ${texNum(L ? meanCd(L) : 0)}`,
      ];
    }
    const ps = pipeState(p);
    const fl = fluidOf(p);
    const R = diamOf(p) / 2;
    const regime = ps.re < RE_LAM ? "laminar" : ps.re < RE_TURB ? "transição" : "turbulento";
    return [
      String.raw`Re = \frac{${texNum(fl.rho)}\cdot ${texNum(ps.v)}\cdot ${texNum(diamOf(p))}}{${texNum(fl.mu)}} = ${texNum(ps.re)}\ \ (\text{${regime}})`,
      String.raw`f = ${texNum(ps.f)} \qquad \Delta p = ${texNum(ps.dp)}\ \text{Pa} \qquad Q = ${texNum(ps.q * 1e6)}\ \text{mL/s}`,
      String.raw`\text{Poiseuille: } \frac{\pi R^4 \Delta p}{8\mu L} = ${texNum(((Math.PI * R ** 4 * ps.dp) / (8 * fl.mu * lenOf(p))) * 1e6)}\ \text{mL/s}${ps.re < RE_LAM ? "" : String.raw`\ \ (\text{não vale: turbulento})`}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Tubo: Poiseuille e Reynolds" },
        { value: 1, label: "Cilindro: Lattice Boltzmann 2D (Kármán)" },
      ],
    },
    { key: "fluido", label: "Fluido", unit: "", min: 0, max: FLUIDS.length - 1, step: 1, default: 0, live: true, options: FLUIDS.map((f) => ({ value: f.value, label: f.label })) },
    { key: "D", label: "Diâmetro do tubo D", unit: "mm", min: 1, max: 50, step: 0.5, default: 10, live: true, log: true },
    { key: "L", label: "Comprimento do tubo L", unit: "m", min: 0.1, max: 10, step: 0.1, default: 1, live: true },
    {
      key: "ctrl",
      label: "Grandeza controlada",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Velocidade média v̄" },
        { value: 1, label: "Diferença de pressão Δp" },
      ],
    },
    { key: "vm", label: "Velocidade média v̄", unit: "m/s", min: 0.001, max: 5, step: 0.001, default: 0.1, live: true, log: true },
    { key: "dp", label: "Diferença de pressão Δp", unit: "Pa", min: 0.1, max: 100000, step: 0.1, default: 100, live: true, log: true },
    { key: "Rec", label: "Reynolds do cilindro (modo LBM)", unit: "", min: 10, max: 160, step: 1, default: 100, live: true },
  ],

  observables: [
    { key: "Re", label: "Número de Reynolds", unit: "", value: (_s, p) => (modo(p) === 1 ? reCyl(p) : pipeState(p).re) },
    { key: "vm", label: "Velocidade média v̄", unit: "m/s", value: (_s, p) => pipeState(p).v },
    { key: "Q", label: "Vazão Q", unit: "mL/s", value: (_s, p) => pipeState(p).q * 1e6 },
    { key: "dp", label: "Perda de carga Δp", unit: "Pa", value: (_s, p) => pipeState(p).dp },
    { key: "f", label: "Fator de atrito de Darcy f", unit: "", value: (_s, p) => pipeState(p).f },
    { key: "umax", label: "u_max / v̄", unit: "", value: (_s, p) => profile(pipeState(p).re, 0) },
    { key: "gama", label: "Intermitência (fração turbulenta)", unit: "", value: (_s, p) => intermittency(pipeState(p).re) },
    { key: "Pot", label: "Potência de bombeamento QΔp", unit: "W", value: (_s, p) => pipeState(p).q * pipeState(p).dp },
    { key: "mix", label: "Espalhamento do corante (desvio de r/R)", unit: "", value: (s) => dyeSpread(s) },
    { key: "CL", label: "C_L do cilindro (LBM)", unit: "", value: (s) => lbmVal(s, lastCl) },
    { key: "CD", label: "C_D do cilindro (LBM)", unit: "", value: (s) => lbmVal(s, lastCd) },
    { key: "St", label: "Número de Strouhal (LBM)", unit: "", value: (s) => lbmVal(s, strouhal) },
  ],
  chart: { x: "t", y: "mix" },

  scenarios: [
    {
      id: "poiseuille",
      label: "Poiseuille: vazão ∝ R⁴",
      params: { modo: 0, fluido: 1, D: 10, L: 1, ctrl: 1, dp: 2000 },
      guide: `### Lei de Hagen–Poiseuille
1. Glicerina num tubo de 10 mm com $\\Delta p$ fixo: o escoamento é laminar ($Re \\ll 1$) e o perfil é uma **parábola**, $u_{\\max} = 2\\bar v$.
2. Anote a **vazão Q** e dobre o diâmetro para 20 mm. A vazão fica **16 vezes** maior: $Q \\propto R^4$.
3. Dobre o comprimento $L$: a vazão cai à metade. Dobre $\\Delta p$: dobra.
4. A resistência hidráulica $\\Delta p/Q = 8\\mu L/\\pi R^4$ é análoga à resistência elétrica de um fio.`,
      predict: [
        {
          question: "Com a mesma diferença de pressão, você troca o tubo por outro com o dobro do diâmetro. A vazão:",
          options: ["dobra", "fica 4 vezes maior", "fica 16 vezes maior"],
          answer: 2,
          explanation: "Área ×4 e velocidade média ×4 (ela é proporcional a $R^2\\Delta p/\\mu L$): $Q \\propto R^4$, ou seja ×16.",
        },
      ],
    },
    {
      id: "reynolds",
      label: "Experimento de Reynolds",
      params: { modo: 0, fluido: 0, D: 10, L: 1, ctrl: 0, vm: 0.1 },
      guide: `### O filete de corante
1. Água num tubo de 10 mm com $\\bar v = 0{,}1$ m/s: $Re \\approx 1000$. O corante forma um **filete reto**: as camadas deslizam sem se misturar.
2. Com a simulação rodando, suba $\\bar v$ para 0,3 m/s ($Re \\approx 3000$, transição): o filete passa a se romper em rajadas.
3. Suba para 1 m/s ($Re \\approx 10^4$): o corante se espalha por toda a seção logo após o bico. Acompanhe o **espalhamento do corante** no gráfico.
4. Arraste o **bico** para perto da parede: no laminar o corante ali anda devagar (perfil parabólico).`,
      predict: [
        {
          question: "Reynolds aumentou aos poucos a vazão de água num tubo de vidro. O que ele viu ao passar de Re ≈ 2300?",
          options: ["O filete de corante ficou mais fino", "O filete começou a oscilar e se misturar", "O corante parou"],
          answer: 1,
          explanation: "Acima do Reynolds crítico, perturbações crescem em vez de serem amortecidas pela viscosidade: o filete se rompe e o corante se mistura.",
        },
      ],
    },
    {
      id: "turbulento",
      label: "Perfil turbulento e Blasius",
      params: { modo: 0, fluido: 0, D: 20, L: 5, ctrl: 0, vm: 1 },
      guide: `### Atrito turbulento
1. Com $Re = 2\\times10^4$ o perfil médio é **achatado** ($u \\propto (1 - r/R)^{1/n}$, $n \\approx 6$–$7$): $u_{\\max}/\\bar v \\approx 1{,}2$ em vez de 2.
2. No diagrama de Moody o ponto está sobre a curva de Blasius, $f = 0{,}316\\,Re^{-1/4}$.
3. Dobre $\\bar v$: no laminar $\\Delta p$ dobraria; aqui ele cresce $2^{1{,}75} \\approx 3{,}4$ vezes. Veja a inclinação no painel $\\Delta p \\times Q$.`,
      predict: [
        {
          question: "Em regime turbulento (Blasius), dobrar a vazão multiplica a perda de carga por aproximadamente:",
          options: ["2", "3,4", "4"],
          answer: 1,
          explanation: "$\\Delta p \\propto f\\,v^2 \\propto Re^{-1/4}v^2 \\propto v^{1{,}75}$, e $2^{1{,}75} \\approx 3{,}4$.",
        },
      ],
    },
    {
      id: "karman",
      label: "Esteira de Kármán (Lattice Boltzmann)",
      params: { modo: 1, Rec: 100 },
      guide: `### Vórtices atrás de um cilindro
1. Um fluido de rede (Lattice Boltzmann D2Q9) passa por um cilindro. As cores mostram a **vorticidade**: vermelho gira no sentido anti-horário, azul no horário.
2. Depois de alguns segundos a esteira fica instável e os vórtices se desprendem **alternadamente**: a esteira de von Kármán. O $C_L$ passa a oscilar.
3. O número de Strouhal medido fica perto de 0,2 (com o canal estreito, um pouco acima do valor 0,16–0,19 de um cilindro isolado).
4. Reduza $Re$ para 30: a esteira fica estacionária, com dois vórtices presos atrás do cilindro. **Arraste** o cilindro para outra posição.`,
    },
  ],

  exercises: [
    {
      id: "poiseuille-vazao",
      prompt:
        "Glicerina (μ = 1,41 Pa·s) escoa por um tubo de raio {R} mm e comprimento {L} m sob uma diferença de pressão de {dpk} kPa. Qual é a vazão em mL/s?",
      vary: { R: [2, 8, 1], L: [0.5, 3, 1], dpk: [1, 20, 1] },
      answer: {
        label: "Q",
        unit: "mL/s",
        compute: (p) => ((Math.PI * (num(p, "R") / 1000) ** 4 * num(p, "dpk") * 1000) / (8 * 1.41 * num(p, "L"))) * 1e6,
      },
      hint: "Q = πR⁴Δp/(8μL), com R em metros.",
    },
    {
      id: "blasius",
      prompt:
        "Água (ρ = 998 kg/m³, μ = 1,0 × 10⁻³ Pa·s) escoa a {v} m/s num tubo liso de {Dc} cm de diâmetro e {L} m de comprimento. Usando Blasius, f = 0,316 Re^(−1/4), qual é a perda de carga?",
      vary: { v: [0.5, 2, 1], Dc: [2, 5, 1], L: [5, 50, 0] },
      answer: {
        label: "Δp",
        unit: "Pa",
        compute: (p) => {
          const D = num(p, "Dc") / 100, v = num(p, "v");
          const re = (998 * v * D) / 1e-3;
          return 0.316 * re ** -0.25 * (num(p, "L") / D) * 0.5 * 998 * v * v;
        },
      },
      tolerance: 0.03,
      hint: "Calcule Re = ρvD/μ, depois f e Δp = f (L/D) ρv²/2.",
    },
  ],

  init(p) {
    return { parts: initParts(), dye: [], noz: 0, seed: 1, lbm: modo(p) === 1 ? makeLbm() : null, drag: false };
  },

  step(s, p, _t, dt) {
    if (modo(p) === 1) {
      const L = s.lbm ?? makeLbm();
      lbmSteps(L, reCyl(p), SUB);
      advectDye(L, SUB);
      return { ...s, lbm: L };
    }
    const { re } = pipeState(p);
    const g = intermittency(re);
    const rand = rng(s.seed);
    const k = (VIS * dt) / ((TX1 - TX0) / 10);
    // Traçadores: andam com u(r); na turbulência saltam entre camadas (mistura)
    const parts = s.parts.map(([x, r]): [number, number] => {
      let nr = r + g * 0.5 * Math.sqrt(dt) * gaussian(rand);
      if (nr > 0.95) nr = 1.9 - nr;
      if (nr < -0.95) nr = -1.9 - nr;
      let nx = x + k * profile(re, nr) * (1 + g * 0.25 * gaussian(rand));
      nx -= Math.floor(nx);
      return [nx, nr];
    });
    // Corante: novo ponto no bico a cada passo
    const dye: [number, number][] = [];
    for (const [x, r] of s.dye) {
      // A mistura cresce a jusante: perturbações amplificadas na turbulência
      const amp = g * (0.25 + 1.4 * Math.min(1, x * 3));
      let nr = r + amp * Math.sqrt(dt) * gaussian(rand);
      if (nr > 0.97) nr = 1.94 - nr;
      if (nr < -0.97) nr = -1.94 - nr;
      const nx = x + k * profile(re, nr) * (1 + g * 0.3 * gaussian(rand));
      if (nx < 1) dye.push([Math.max(0, nx), nr]);
    }
    dye.push([0, s.noz]);
    return { ...s, parts, dye: dye.length > 900 ? dye.slice(dye.length - 900) : dye, seed: s.seed + 1 };
  },
  dt: 1 / 60,
  sampleEvery: 10,
  maxSamples: 120,

  pointer: {
    down(s, p, pt) {
      if (modo(p) === 1) {
        const L = s.lbm;
        if (!L) return undefined;
        return Math.hypot(pt.x - cellToX(L.cx), pt.y - cellToY(L.cy)) < (R_CYL + 3) * CS ? { ...s, drag: true } : undefined;
      }
      if (pt.x < TX0 - 0.5 || pt.x > TX0 + 1.2 || Math.abs(pt.y - TY) > TR) return undefined;
      return { ...s, drag: true, noz: Math.max(-0.9, Math.min(0.9, (pt.y - TY) / TR)) };
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      if (modo(p) === 1) {
        const L = s.lbm;
        if (!L) return undefined;
        const cx = Math.round(Math.max(15, Math.min(90, (pt.x - CX0) / CS - 0.5)));
        const cy = Math.round(Math.max(R_CYL + 4, Math.min(NY - R_CYL - 5, (pt.y - CY0) / CS - 0.5))) + 0.6;
        if (cx === L.cx && cy === L.cy) return undefined;
        return { ...s, lbm: moveCylinder(L, cx, cy) };
      }
      return { ...s, noz: Math.max(-0.9, Math.min(0.9, (pt.y - TY) / TR)) };
    },
    up: (s) => (s.drag ? { ...s, drag: false } : undefined),
    cursor(s, p, pt) {
      if (modo(p) === 1) return s.lbm && Math.hypot(pt.x - cellToX(s.lbm.cx), pt.y - cellToY(s.lbm.cy)) < (R_CYL + 3) * CS ? "move" : undefined;
      return pt.x > TX0 - 0.5 && pt.x < TX0 + 1.2 && Math.abs(pt.y - TY) < TR ? "ns-resize" : undefined;
    },
  },
  actions: [{ id: "limpar", label: "Limpar o corante", run: (s) => ({ ...s, dye: [], lbm: s.lbm ? Object.assign(s.lbm, { dye: [] }) : null }) }],

  viewport: () => ({ xMin: 0, xMax: 12, yMin: -0.1, yMax: 9.2, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    if (modo(p) === 1) {
      renderLbm(d, ctx, s, p, theme.dark);
      return;
    }
    const ps = pipeState(p);
    const re = ps.re;
    const g = intermittency(re);
    const X = (x: number) => TX0 + x * (TX1 - TX0);
    const Y = (r: number) => TY + r * TR;

    // Tubo
    d.rect(TX0, TY - TR, TX1 - TX0, 2 * TR, { fill: theme.accent, alpha: 0.06 });
    d.line(TX0, TY + TR, TX1, TY + TR, { color: theme.text, width: 2.5 });
    d.line(TX0, TY - TR, TX1, TY - TR, { color: theme.text, width: 2.5 });
    // Traçadores
    for (const [x, r] of s.parts) d.dot(X(x), Y(r), 3, theme.muted, 0.8);
    // Corante
    const dyeColor = theme.series[3] ?? theme.positive;
    if (g < 0.02) {
      d.polyline(
        s.dye.map(([x, r]): [number, number] => [X(x), Y(r)]),
        { color: dyeColor, width: 2.5 },
      );
    } else for (const [x, r] of s.dye) d.dot(X(x), Y(r), 2.2, dyeColor, 0.75);
    // Bico
    d.line(TX0 - 0.45, Y(s.noz), TX0 + 0.05, Y(s.noz), { color: dyeColor, width: 4 });
    d.text("bico de corante (arraste)", TX0 + 0.1, TY + TR + 0.32, { color: theme.muted, size: 10, align: "left" });
    // Perfil de velocidade
    const xs = TX0 + 1.2;
    const umax = profile(re, 0);
    const sc = 1.1 / Math.max(2, umax);
    d.line(xs, TY - TR, xs, TY + TR, { color: theme.muted, width: 1 });
    const prof: [number, number][] = [];
    for (let i = -20; i <= 20; i++) {
      const r = i / 20;
      prof.push([xs + sc * profile(re, r), Y(r)]);
      if (i % 4 === 0 && Math.abs(i) < 20) d.arrow(xs, Y(r), sc * profile(re, r), 0, { color: theme.accent, width: 1.3, head: 6 });
    }
    d.polyline(prof, { color: theme.accent, width: 2 });
    // Parábola de referência quando não é laminar
    if (g > 0.02) {
      const par: [number, number][] = [];
      for (let i = -20; i <= 20; i++) par.push([xs + sc * 2 * (1 - (i / 20) ** 2), Y(i / 20)]);
      d.polyline(par, { color: theme.muted, width: 1, dash: [4, 3] });
    }
    d.text(`u_max = ${formatBR(umax, 3)} v̄`, xs + sc * umax + 0.1, TY, { color: theme.accent, size: 10, align: "left" });
    // Cabeçalho
    const regime = re < RE_LAM ? "laminar" : re < RE_TURB ? "transição" : "turbulento";
    d.text(`${fluidOf(p).label} · D = ${formatBR(num(p, "D", 10), 3)} mm · Re = ${formatBR(re, 4)} (${regime})`, 6, TY + TR + 0.75, { size: 13, weight: "600" });
    d.text(`v̄ = ${formatBR(ps.v, 3)} m/s · Q = ${formatBR(ps.q * 1e6, 3)} mL/s · Δp = ${formatBR(ps.dp, 3)} Pa em L = ${formatBR(lenOf(p), 3)} m`, 6, TY - TR - 0.35, { color: theme.text, size: 11 });
    d.text("partículas em câmera ajustada: a velocidade média sempre aparece igual na tela", 6, TY - TR - 0.72, { color: theme.muted, size: 10 });

    // Diagrama de Moody
    const pm = panel(d, { x0: 1.0, y0: 0.6, x1: 5.6, y1: 3.6 }, { min: 100, max: 1e7, log: true }, { min: 0.008, max: 0.7, log: true });
    pm.frame({ xlabel: "Re", ylabel: "f (Darcy)", fx: (v) => `10^${Math.round(Math.log10(v))}`, fy: (v) => formatBR(v, 2) });
    pm.clip(() => d.rect(pm.X(RE_LAM), pm.Y(0.008), pm.X(RE_TURB) - pm.X(RE_LAM), pm.Y(0.7) - pm.Y(0.008), { fill: theme.series[5] ?? theme.muted, alpha: 0.15 }));
    pm.plot((r) => 64 / r, 100, RE_TURB, { color: theme.series[0], width: 1.8 });
    pm.plot((r) => fTurb(r), RE_LAM, 1e7, { color: theme.series[1], width: 1.8 });
    pm.plot((r) => 0.3164 * r ** -0.25, 1e5, 1e7, { color: theme.series[1], width: 1, dash: [4, 3] });
    d.circle(pm.X(Math.min(1e7, Math.max(100, re))), pm.Y(Math.min(0.7, Math.max(0.008, ps.f))), 0, { minPx: 5, fill: theme.positive });
    d.text("64/Re", pm.X(400), pm.Y(64 / 400), { color: theme.series[0], size: 10, dx: 18 });
    d.text("Blasius / tubo liso", pm.X(3e5), pm.Y(fTurb(3e5)), { color: theme.series[1], size: 10, dy: -10 });
    d.text("diagrama de Moody (tubo liso)", 3.3, 3.95, { size: 11, weight: "600" });

    // Δp × Q
    const q0 = ps.q;
    const pq = panel(d, { x0: 7.0, y0: 0.6, x1: 11.4, y1: 3.6 }, { min: q0 / 100, max: q0 * 100, log: true }, { min: Math.max(1e-6, pressureDrop(p, ps.v / 100) / 3), max: pressureDrop(p, ps.v * 100) * 3, log: true });
    pq.frame({ xlabel: "Q (m³/s)", ylabel: "Δp (Pa)", fx: (v) => `10^${Math.round(Math.log10(v))}`, fy: (v) => `10^${Math.round(Math.log10(v))}` });
    const area = (Math.PI * diamOf(p) ** 2) / 4;
    pq.plot((q) => pressureDrop(p, q / area), q0 / 100, q0 * 100, { color: theme.accent, width: 1.8 });
    d.circle(pq.X(q0), pq.Y(ps.dp), 0, { minPx: 5, fill: theme.positive });
    d.text("perda de carga × vazão (inclinação 1 → 1,75)", 9.2, 3.95, { size: 11, weight: "600" });
  },
});

function renderLbm(d: ReturnType<typeof draw>, ctx: CanvasRenderingContext2D, s: Flow, p: Params, dark: boolean) {
  const theme = d.theme;
  const L = s.lbm;
  d.text(`Cilindro num canal: Re = ${formatBR(reCyl(p), 3)} (Lattice Boltzmann D2Q9, ${NX} × ${NY} células)`, 6, 9.0, { size: 13, weight: "600" });
  if (!L) {
    d.text("reinicie para criar o canal", 6, 6.6, { color: theme.muted, size: 12 });
    return;
  }
  // Vorticidade
  for (let y = 1; y < NY - 1; y++)
    for (let x = 1; x < NX - 1; x++) {
      if (L.solid[x + y * NX]) continue;
      const c = vortColor(vorticity(L, x, y), dark);
      if (!c) continue;
      ctx.fillStyle = c;
      ctx.fillRect(CX0 + x * CS, CY0 + y * CS, CS * 1.05, CS * 1.05);
    }
  // Corante
  ctx.fillStyle = dark ? "rgba(235, 235, 235, 0.75)" : "rgba(40, 40, 40, 0.6)";
  for (let i = 0; i < L.dye.length; i += 2) ctx.fillRect(CX0 + L.dye[i]! * CS, CY0 + L.dye[i + 1]! * CS, CS * 0.7, CS * 0.7);
  // Paredes e cilindro
  d.line(CX0, CY0, CX0 + NX * CS, CY0, { color: theme.text, width: 2 });
  d.line(CX0, CY0 + NY * CS, CX0 + NX * CS, CY0 + NY * CS, { color: theme.text, width: 2 });
  d.circle(cellToX(L.cx), cellToY(L.cy), R_CYL * CS, { fill: theme.dark ? "#4a5564" : "#9aa3ae", stroke: theme.text, width: 1.5 });
  d.arrow(CX0 + 0.1, CY0 + NY * CS + 0.25, 0.6, 0, { color: theme.text });
  d.text("U", CX0 + 0.85, CY0 + NY * CS + 0.25, { size: 11 });
  d.text("vermelho: vorticidade anti-horária · azul: horária · pontos: corante · arraste o cilindro", 6, CY0 - 0.3, { color: theme.muted, size: 10 });
  // Faixa da esponja
  d.rect(CX0 + (NX - 30) * CS, CY0, 30 * CS, NY * CS, { fill: theme.muted, alpha: 0.08 });
  d.text("zona de saída", CX0 + (NX - 15) * CS, CY0 + NY * CS + 0.2, { color: theme.muted, size: 9 });

  // C_L e C_D ao longo do tempo
  const n = L.cl.length;
  const pc = panel(d, { x0: 1.0, y0: 0.6, x1: 7.2, y1: 3.5 }, { min: 0, max: 240 * HIST_EVERY }, { min: -1.5, max: 3.5 });
  pc.frame({ xlabel: "passos de rede (últimos)", ylabel: "coeficientes", yticks: [-1, 0, 1, 2, 3], fx: (v) => formatBR(v, 4) });
  const off = 240 - n;
  pc.line(L.cl.map((v, i): [number, number] => [(i + off) * HIST_EVERY, v]), { color: theme.series[0], width: 1.6 });
  pc.line(L.cd.map((v, i): [number, number] => [(i + off) * HIST_EVERY, v]), { color: theme.series[1], width: 1.6 });
  d.text("C_L (sustentação)", 2.2, 3.85, { color: theme.series[0], size: 10, weight: "600" });
  d.text("C_D (arrasto)", 4.4, 3.85, { color: theme.series[1], size: 10, weight: "600" });
  // Resumo
  const St = strouhal(L);
  const lines = [
    `passos de rede: ${L.steps}`,
    `τ = ${formatBR(tauOf(reCyl(p)), 4)} · ν = ${formatBR((tauOf(reCyl(p)) - 0.5) / 3, 3)} (rede)`,
    `U = ${formatBR(U0, 2)} · D = ${2 * R_CYL} células`,
    `C_D médio = ${formatBR(meanCd(L), 3)}`,
    St > 0 ? `Strouhal medido: ${formatBR(St, 3)}` : reCyl(p) < 45 ? "esteira estacionária (Re < ~47)" : "Strouhal: aguardando a esteira…",
  ];
  lines.forEach((t, i) => d.text(t, 7.8, 3.3 - i * 0.55, { color: i === 4 ? theme.accent : theme.text, size: 11, align: "left" }));
}

export default escoamentoViscoso;
