import { clamp, deg, defineSim, draw, formatBR, num, rad, rk4, texNum, type Draw, type Params, type State } from "@fisilab/core";
import {
  blockMass,
  blockOf,
  buoyancy,
  displaced,
  dynamometer,
  floatAccel,
  floatDepth,
  floatEnergy,
  gyration2,
  heel,
  heelEnergy,
  hullOf,
  inertia,
  metacentric,
  type Hull,
  type Pt,
} from "./physics.ts";

export * from "./physics.ts";

// Estado: [θ, ω, profundidade da mão (dinamômetro), y da base do bloco livre, v do bloco livre]
const TH = 0, OM = 1, DH = 2, Y = 3, VY = 4;
const at = (s: State, i: number) => s[i] ?? 0;
const modeOf = (p: Params) => Math.round(num(p, "modo", 0));
const zetaOf = (p: Params) => num(p, "zeta", 0.05);

/** Profundidade de água do recipiente nos modos do bloco (em arestas). */
const HW = 3;
/** Ponto final da descida no dinamômetro (em arestas). */
const DMAX = 2.4;

/** Amortecimento de rolagem: c = 2ζ I ω_ref. */
function rollDamping(h: Hull, zeta: number) {
  const k2 = gyration2(h);
  const w = Math.sqrt((h.g * Math.max(Math.abs(metacentric(h).GM), 0.05)) / k2);
  return 2 * zeta * inertia(h) * w;
}

export function rollAccel(h: Hull, th: number, om: number, zeta: number) {
  return (heel(h, th).tau - rollDamping(h, zeta) * om) / inertia(h);
}

/** Período de pequenas oscilações de rolagem: T = 2π k/√(g GM). */
export const rollPeriod = (h: Hull) => (2 * Math.PI * Math.sqrt(gyration2(h))) / Math.sqrt(h.g * metacentric(h).GM);

const LIQ = [
  { value: 1000, label: "Água doce (1000 kg/m³)" },
  { value: 1025, label: "Água do mar (1025 kg/m³)" },
  { value: 900, label: "Óleo (900 kg/m³)" },
  { value: 13600, label: "Mercúrio (13 600 kg/m³)" },
];

const SOLIDS = [
  { value: 240, label: "Cortiça (240 kg/m³)" },
  { value: 500, label: "Pinho (500 kg/m³)" },
  { value: 917, label: "Gelo (917 kg/m³)" },
  { value: 1380, label: "PVC (1380 kg/m³)" },
  { value: 2700, label: "Alumínio (2700 kg/m³)" },
  { value: 7870, label: "Ferro (7870 kg/m³)" },
  { value: 11340, label: "Chumbo (11 340 kg/m³)" },
  { value: 19300, label: "Ouro (19 300 kg/m³)" },
];

function shipEnergy(s: State, p: Params) {
  const h = hullOf(p);
  return 0.5 * inertia(h) * at(s, OM) ** 2 + heelEnergy(h, at(s, TH));
}

export const empuxo = defineSim({
  id: "empuxo",
  title: "Empuxo, flutuação e estabilidade de navios",
  course: "FG II",
  topic: "Hidrostática",
  priority: "P1",
  summary:
    "Incline a seção de um casco e veja o centro de carena B se deslocar, o metacentro M e o torque que endireita ou tomba o navio. Meça o peso aparente com um dinamômetro e solte blocos para flutuarem.",
  equations: [
    String.raw`E = \rho_f\, g\, V_{\text{sub}} \qquad P_{\text{ap}} = mg - E \qquad \frac{V_{\text{sub}}}{V} = \frac{\rho_c}{\rho_f}`,
    String.raw`\overline{KB} = \frac{T}{2} \qquad \overline{BM} = \frac{I_{\text{fl}}}{\nabla} = \frac{B^2}{12\,T} \qquad \overline{GM} = \overline{KB} + \overline{BM} - \overline{KG}`,
    String.raw`I\ddot\theta = -\rho g \nabla\, \overline{GZ}(\theta) - c\,\dot\theta \qquad \overline{GZ} \approx \overline{GM}\sin\theta \qquad T_{\text{rol}} = \frac{2\pi k}{\sqrt{g\,\overline{GM}}}`,
  ],
  liveEquations(s, p) {
    const m = modeOf(p);
    if (m === 0) {
      const h = hullOf(p);
      const mc = metacentric(h);
      const hh = heel(h, at(s, TH));
      return [
        String.raw`\overline{GM} = ${texNum(mc.KB)} + ${texNum(mc.BM)} - ${texNum(h.KG)} = ${texNum(mc.GM)}\ \text{m}\ ${mc.GM > 0 ? String.raw`\text{(estável)}` : String.raw`\text{(instável)}`}`,
        String.raw`\theta = ${texNum(deg(at(s, TH)))}^\circ \qquad \overline{GZ} = ${texNum(hh.GZ)}\ \text{m} \qquad \tau = ${texNum(hh.tau / 1000)}\ \text{kN·m/m}`,
      ];
    }
    const b = blockOf(p);
    const mg = blockMass(b) * b.g;
    if (m === 1) {
      const dy = dynamometer(b, at(s, DH) * b.a);
      return [String.raw`P_{\text{ap}} = mg - \rho_f g V_{\text{sub}} = ${texNum(mg)} - ${texNum(dy.E)} = ${texNum(dy.T)}\ \text{N}`];
    }
    const sub = Math.max(0, Math.min(b.a, -at(s, Y) * b.a));
    return [
      String.raw`E = ${texNum(buoyancy(b, sub))}\ \text{N} \qquad mg = ${texNum(mg)}\ \text{N} \qquad \frac{V_{\text{sub}}}{V} = ${texNum(sub / b.a)} \quad (\rho_c/\rho_f = ${texNum(b.rhoB / b.rhoF)})`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Estabilidade do navio (metacentro)" },
        { value: 1, label: "Bloco no dinamômetro (peso aparente)" },
        { value: 2, label: "Bloco solto (flutuação)" },
      ],
    },
    { key: "rhoF", label: "Líquido", unit: "kg/m³", min: 900, max: 13600, step: 5, default: 1025, options: LIQ },
    { key: "zeta", label: "Amortecimento", unit: "", min: 0, max: 1, step: 0.01, default: 0.05, live: true },
    { key: "B", label: "Navio: boca (largura) B", unit: "m", min: 2, max: 14, step: 0.1, default: 6 },
    { key: "Hc", label: "Navio: pontal (altura do casco)", unit: "m", min: 1, max: 8, step: 0.1, default: 3 },
    { key: "T", label: "Navio: calado T", unit: "m", min: 0.2, max: 6, step: 0.05, default: 1.2 },
    { key: "KG", label: "Navio: altura do centro de gravidade KG", unit: "m", min: 0.2, max: 6, step: 0.05, default: 1.8, live: true },
    { key: "xG", label: "Navio: deslocamento lateral de G (carga)", unit: "m", min: -1, max: 1, step: 0.01, default: 0, live: true },
    { key: "theta0", label: "Navio: inclinação inicial", unit: "°", min: -80, max: 80, step: 1, default: 15 },
    { key: "a", label: "Bloco: aresta", unit: "cm", min: 4, max: 30, step: 1, default: 10 },
    { key: "rhoB", label: "Bloco: material", unit: "kg/m³", min: 200, max: 20000, step: 10, default: 2700, options: SOLIDS },
    { key: "vd", label: "Dinamômetro: velocidade de descida", unit: "arestas/s", min: 0.05, max: 1, step: 0.05, default: 0.25, live: true },
    { key: "y0", label: "Bloco solto: altura inicial da base", unit: "arestas", min: -2.5, max: 2, step: 0.05, default: 0.5 },
  ],

  observables: [
    { key: "theta", label: "Inclinação θ", unit: "°", value: (s) => deg(at(s, TH)) },
    { key: "omega", label: "Velocidade angular", unit: "rad/s", value: (s) => at(s, OM) },
    { key: "GZ", label: "Braço de endireitamento GZ", unit: "m", value: (s, p) => (modeOf(p) === 0 ? heel(hullOf(p), at(s, TH)).GZ : 0) },
    { key: "tau", label: "Torque do empuxo (por metro)", unit: "kN·m/m", value: (s, p) => (modeOf(p) === 0 ? heel(hullOf(p), at(s, TH)).tau / 1000 : 0) },
    { key: "GM", label: "Altura metacêntrica GM", unit: "m", value: (_s, p) => metacentric(hullOf(p)).GM },
    { key: "prof", label: "Profundidade da base do bloco", unit: "cm", value: (s, p) => { const b = blockOf(p); return modeOf(p) === 2 ? -at(s, Y) * b.a * 100 : dynamometer(b, at(s, DH) * b.a).d * 100; } },
    { key: "Pap", label: "Leitura do dinamômetro (peso aparente)", unit: "N", value: (s, p) => (modeOf(p) === 1 ? dynamometer(blockOf(p), at(s, DH) * blockOf(p).a).T : 0) },
    {
      key: "E",
      label: "Empuxo",
      unit: "N",
      value: (s, p) => {
        const b = blockOf(p);
        const m = modeOf(p);
        if (m === 1) return dynamometer(b, at(s, DH) * b.a).E;
        if (m === 2) return buoyancy(b, -at(s, Y) * b.a);
        return (hullOf(p).rho * 9.81 * displaced(hullOf(p))) / 1000;
      },
    },
    { key: "frac", label: "Fração submersa", unit: "", value: (s, p) => (modeOf(p) === 2 ? clamp(-at(s, Y), 0, 1) : 0) },
    {
      key: "Emec",
      label: "Energia mecânica (navio: por metro)",
      unit: "J",
      value: (s, p) => {
        const m = modeOf(p);
        if (m === 0) return shipEnergy(s, p);
        if (m === 2) { const b = blockOf(p); return floatEnergy(b, at(s, Y) * b.a, at(s, VY) * b.a, HW * b.a); }
        return 0;
      },
    },
  ],
  conserved: "Emec",
  chart: { x: "t", y: "theta" },

  scenarios: [
    {
      id: "estavel",
      label: "Navio estável",
      params: { modo: 0, B: 6, Hc: 3, T: 1.2, KG: 1.8, xG: 0, theta0: 15, zeta: 0.05, rhoF: 1025 },
      guide: `### Por que o navio volta a ficar de pé?
1. Rode. Ao inclinar, a parte submersa muda de forma e o **centro de carena B** se desloca para o lado que afundou.
2. O empuxo (em B) e o peso (em G) formam um binário. Se a vertical que passa por B cruza a linha de centro **acima** de G (em M), o torque endireita.
3. Compare o período medido com $T = 2\\pi k/\\sqrt{g\\,\\overline{GM}}$ (veja as equações).
4. Arraste o casco para inclinar e solte. Observe a curva $\\overline{GZ}(\\theta)$ no painel: até que ângulo ela é positiva?`,
      predict: [
        {
          question: "Um navio mais largo (B maior), com o mesmo calado e o mesmo KG, balança:",
          options: ["com período maior (mais devagar)", "com período menor (mais rápido e 'duro')", "do mesmo jeito"],
          answer: 1,
          explanation: "$\\overline{BM} = B^2/(12T)$ cresce muito com a largura, então $\\overline{GM}$ aumenta e o torque restaurador também: o balanço fica mais rápido (embora $k$ também cresça um pouco).",
        },
      ],
    },
    {
      id: "tomba",
      label: "Carga alta: tombamento",
      params: { modo: 0, B: 4, Hc: 4, T: 1.5, KG: 2.6, xG: 0, theta0: 3, zeta: 0.15, rhoF: 1025 },
      guide: `### Centro de gravidade alto demais
1. Aqui $\\overline{KG}$ está acima do metacentro: $\\overline{GM} < 0$. Rode a partir de 3°.
2. O torque passa a **aumentar** a inclinação. O casco tomba até um novo equilíbrio (ângulo de banda) ou emborca.
3. Durante a simulação, baixe $\\overline{KG}$ (lastro) até o torque virar restaurador. Qual é o valor crítico? Compare com $\\overline{KB} + \\overline{BM}$.`,
      predict: [
        {
          question: "Se $\\overline{KG}$ fica acima de $\\overline{KM}$, uma pequena inclinação:",
          options: ["é corrigida pelo empuxo", "cresce: o binário peso–empuxo tomba o casco", "não muda nada"],
          answer: 1,
          explanation: "Com G acima de M, a vertical do empuxo passa do lado de dentro de G e o binário gira no mesmo sentido da inclinação.",
        },
      ],
    },
    {
      id: "carga",
      label: "Carga deslocada (banda)",
      params: { modo: 0, B: 6, Hc: 3, T: 1.2, KG: 1.8, xG: 0.3, theta0: 0, zeta: 0.3, rhoF: 1025 },
      guide: `### Banda permanente
1. A carga foi deslocada 0,3 m para o lado. O navio aderna até B ficar de novo na vertical de G.
2. Para ângulos pequenos, $\\tan\\theta \\approx x_G/\\overline{GM}$. Confira o ângulo final.
3. Aumente $x_G$ ao vivo. Em que ângulo a borda do convés chega à água?`,
    },
    {
      id: "dinamometro",
      label: "Peso aparente no dinamômetro",
      params: { modo: 1, rhoB: 2700, a: 10, rhoF: 1000, vd: 0.25 },
      guide: `### Arquimedes com uma balança de mola
1. Rode: o bloco de alumínio desce na água. No gráfico, escolha **Profundidade** no eixo x e **Leitura** no eixo y.
2. Enquanto o bloco entra, a leitura cai linearmente. Depois de totalmente submerso, ela fica **constante**: o empuxo não depende da profundidade.
3. Calcule $mg - \\rho g a^3$ e compare com a leitura final.
4. Troque para cortiça ou gelo: o fio fica frouxo quando o empuxo iguala o peso.`,
      predict: [
        {
          question: "Depois que o bloco está todo submerso, descê-lo mais fundo faz a leitura do dinamômetro:",
          options: ["diminuir (a pressão é maior lá embaixo)", "ficar constante", "aumentar"],
          answer: 1,
          explanation: "A diferença de pressão entre a base e o topo do bloco é sempre $\\rho g a$, então o empuxo $\\rho g a^3$ não depende da profundidade.",
        },
      ],
    },
    {
      id: "flutua",
      label: "Bloco que flutua",
      params: { modo: 2, rhoB: 500, a: 10, rhoF: 1000, y0: 0.5, zeta: 0.1 },
      guide: `### Fração submersa
1. Solte o bloco de pinho. Ele oscila e se acomoda com uma fração $\\rho_c/\\rho_f$ submersa.
2. Zere o amortecimento: a energia mecânica se conserva e o período das pequenas oscilações é $2\\pi\\sqrt{\\rho_c a/(\\rho_f g)}$.
3. Troque o líquido por mercúrio e o bloco por ferro. O ferro flutua? Com que fração submersa?`,
    },
  ],

  exercises: [
    {
      id: "peso-aparente",
      prompt: "Um cubo de alumínio (2700 kg/m³) de aresta {a} cm está totalmente mergulhado em água (1000 kg/m³), pendurado num dinamômetro. Qual é a leitura? (g = 9,81 m/s²)",
      vary: { a: [4, 20, 0] },
      fixed: { modo: 1, rhoB: 2700, rhoF: 1000 },
      answer: { label: "P_ap", unit: "N", compute: (p) => (2700 - 1000) * 9.81 * (num(p, "a") / 100) ** 3 },
      hint: "P_ap = mg − ρ_água g V.",
    },
    {
      id: "fracao",
      prompt: "Um bloco de densidade {rhoB} kg/m³ flutua em água do mar (1025 kg/m³). Que porcentagem do volume fica submersa?",
      vary: { rhoB: [200, 1000, 0] },
      fixed: { modo: 2, rhoF: 1025 },
      answer: { label: "V_sub/V", unit: "%", compute: (p) => (100 * num(p, "rhoB")) / 1025 },
    },
    {
      id: "gm",
      prompt: "Uma barcaça de seção retangular tem boca B = {B} m e calado T = {T} m, e seu centro de gravidade está {KG} m acima da quilha. Qual é a altura metacêntrica GM?",
      vary: { B: [4, 12, 1], T: [0.8, 2.5, 2], KG: [1, 3, 2] },
      fixed: { modo: 0, Hc: 8 },
      answer: { label: "GM", unit: "m", compute: (p) => num(p, "T") / 2 + num(p, "B") ** 2 / (12 * num(p, "T")) - num(p, "KG") },
      tolerance: 0.03,
      hint: "GM = KB + BM − KG, com KB = T/2 e BM = B²/(12T).",
    },
  ],

  init: (p) => [rad(num(p, "theta0", 15)), 0, -0.6, num(p, "y0", 0.5), 0],
  step(s, p, t, dt) {
    const m = modeOf(p);
    const out = s.slice();
    if (m === 0) {
      const h = hullOf(p);
      const z = zetaOf(p);
      const [th, om] = rk4((y) => [at(y, 1), rollAccel(h, at(y, 0), at(y, 1), z)], [at(s, TH), at(s, OM)], p, t, dt);
      // Fora de ±180° o casco já emborcou: mantém o ângulo em (−π, π].
      out[TH] = Math.atan2(Math.sin(th!), Math.cos(th!));
      out[OM] = om!;
    } else if (m === 1) {
      out[DH] = Math.min(DMAX, at(s, DH) + num(p, "vd", 0.25) * dt);
    } else {
      // Integração em unidades de aresta: y e v em arestas e arestas/s.
      const b = blockOf(p);
      const z = zetaOf(p);
      let [y, v] = rk4((q) => [at(q, 1), floatAccel(b, at(q, 0) * b.a, at(q, 1) * b.a, z) / b.a], [at(s, Y), at(s, VY)], p, t, dt) as [number, number];
      if (y < -HW) {
        y = -HW;
        v = Math.max(0, v);
      }
      out[Y] = y;
      out[VY] = v;
    }
    return out;
  },
  dt: 2e-3,
  sampleEvery: 10,
  stopWhen: (s, p) => (modeOf(p) === 1 ? DMAX - at(s, DH) : 1),

  pointer: {
    down: (s, p, pt) => grab(s, p, pt),
    move: (s, p, pt, dragging) => (dragging ? grab(s, p, pt) : undefined),
    cursor: (_s, p) => (modeOf(p) === 1 ? undefined : "grab"),
  },

  narrowSplit: () => 0.569,
  viewport(p) {
    const m = modeOf(p);
    if (m === 0) {
      const h = hullOf(p);
      const D = Math.hypot(h.B, h.H);
      return { xMin: -0.85 * D, xMax: 2.4 * D, yMin: -0.6 * D, yMax: 0.8 * D };
    }
    const a = blockOf(p).a;
    if (m === 1) return { xMin: -1.9 * a, xMax: 5 * a, yMin: -3.3 * a, yMax: 3.7 * a };
    return { xMin: -2.3 * a, xMax: 4.6 * a, yMin: -3.3 * a, yMax: Math.max(2.4, num(p, "y0", 0.5) + 1.4) * a };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = modeOf(frame.params);
    if (m === 0) renderShip(d, frame.state, frame.params);
    else if (m === 1) renderDynamometer(d, frame.state, frame.params);
    else renderFloat(d, frame.state, frame.params);
  },
});

function grab(s: State, p: Params, pt: { x: number; y: number }): State | undefined {
  const m = modeOf(p);
  const out = s.slice();
  if (m === 0) {
    const h = hullOf(p);
    const D = Math.hypot(h.B, h.H);
    if (pt.x > 0.9 * D) return undefined;
    // O mastro aponta para o ponteiro (centro de rotação desenhado em G).
    const cy = heel(h, at(s, TH));
    const gy = cy.Gc[1] - cy.w;
    const th = clamp(Math.atan2(-pt.x, pt.y - gy), rad(-175), rad(175));
    out[TH] = th;
    out[OM] = 0;
    return out;
  }
  if (m === 2) {
    const a = blockOf(p).a;
    if (pt.x > 2 * a) return undefined;
    out[Y] = clamp(pt.y / a - 0.5, -HW, Math.max(2, num(p, "y0", 0.5)));
    out[VY] = 0;
    return out;
  }
  return undefined;
}

function renderShip(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const h = hullOf(p);
  const D = Math.hypot(h.B, h.H);
  const th = at(s, TH);
  const hh = heel(h, th);
  const mc = metacentric(h);
  // Mundo: G no x = 0 e linha d'água em y = 0.
  const ox = hh.Gc[0], oy = hh.w;
  const W = (q: Pt): Pt => [q[0] - ox, q[1] - oy];
  const R = (u: number, v: number): Pt => W([u * Math.cos(th) - v * Math.sin(th), u * Math.sin(th) + v * Math.cos(th)]);

  // Água
  d.rect(-0.85 * D, -0.6 * D, 1.8 * D, 0.6 * D, { fill: theme.series[0], alpha: 0.16 });
  d.line(-0.85 * D, 0, 0.95 * D, 0, { color: theme.series[0], width: 2 });
  // Casco e parte submersa
  d.polyline(hh.corners.map(W), { close: true, fill: theme.dark ? "#3a4352" : "#d9dee6", color: theme.text, width: 2 });
  if (hh.submerged.length > 2) d.polyline(hh.submerged.map(W), { close: true, fill: theme.series[0], alpha: 0.35, color: "none" });
  // Superestrutura e mastro (alça para arrastar)
  const deck = h.H;
  d.polyline([R(-h.B * 0.2, deck), R(h.B * 0.2, deck), R(h.B * 0.2, deck + 0.12 * D), R(-h.B * 0.2, deck + 0.12 * D)], { close: true, fill: theme.muted, alpha: 0.6, color: theme.text, width: 1 });
  const mastTop = R(0, deck + 0.22 * D);
  d.line(...R(0, deck + 0.12 * D), ...mastTop, { color: theme.text, width: 2 });
  d.dot(mastTop[0], mastTop[1], 4, theme.accent);
  // Linha de centro
  const KM = mc.KM;
  const top = Math.max(KM, deck) + 0.15 * D;
  d.line(...R(0, -0.05 * D), ...R(0, top), { color: theme.muted, dash: [6, 4] });

  // Pontos
  const G = W(hh.Gc), B = W(hh.Bc);
  const M0 = R(0, KM);
  // Linha de ação do empuxo (vertical por B)
  d.line(B[0], B[1], B[0], Math.min(0.75 * D, Math.max(M0[1], G[1]) + 0.1 * D), { color: theme.positive, dash: [3, 4], alpha: 0.6 });
  const mag = 70;
  d.arrowPx(B[0], B[1], 0, 1, mag, { color: theme.positive });
  d.text("E", B[0] + 10 * d.px, B[1] + mag * d.px * 0.8, { color: theme.positive, weight: "600", align: "left" });
  d.arrowPx(G[0], G[1], 0, -1, mag, { color: theme.series[4] });
  d.text("P", G[0] - 10 * d.px, G[1] - mag * d.px * 0.8, { color: theme.series[4], weight: "600", align: "right" });
  d.dot(B[0], B[1], 5, theme.positive);
  d.text("B", B[0] + 10 * d.px, B[1] - 10 * d.px, { color: theme.positive, weight: "700", align: "left" });
  d.circle(G[0], G[1], 7 * d.px, { fill: theme.dark ? "#141a22" : "#ffffff", stroke: theme.series[4], width: 2 });
  d.line(G[0] - 7 * d.px, G[1], G[0] + 7 * d.px, G[1], { color: theme.series[4], width: 1.5 });
  d.line(G[0], G[1] - 7 * d.px, G[0], G[1] + 7 * d.px, { color: theme.series[4], width: 1.5 });
  d.text("G", G[0] - 12 * d.px, G[1] + 2 * d.px, { color: theme.series[4], weight: "700", align: "right" });
  d.dot(M0[0], M0[1], 5, theme.accent);
  d.text("M", M0[0] + 10 * d.px, M0[1] + 6 * d.px, { color: theme.accent, weight: "700", align: "left" });
  // Braço GZ
  if (Math.abs(hh.GZ) > 1e-3) {
    d.line(G[0], G[1], B[0], G[1], { color: theme.text, width: 2.5 });
    
  }
  // Torque: arco em torno de G
  const tau = hh.tau;
  if (Math.abs(hh.GZ) > 2e-3) {
    const r = 0.16 * D;
    const sgn = Math.sign(tau);
    const pts: Pt[] = [];
    for (let i = 0; i <= 20; i++) {
      const a = Math.PI / 2 + sgn * (-0.6 + (1.2 * i) / 20);
      pts.push([G[0] + r * Math.cos(a), G[1] + r * Math.sin(a)]);
    }
    const restoring = tau * th < 0;
    const col = restoring ? theme.series[2]! : theme.positive;
    d.polyline(pts, { color: col, width: 2.5 });
    const [xe, ye] = pts[pts.length - 1]!;
    const [xp, yp] = pts[pts.length - 2]!;
    d.arrow(xp, yp, xe - xp, ye - yp, { color: col, head: 10 });
    d.text(Math.abs(th) > Math.PI / 2 ? "casco emborcado" : restoring ? "torque restaurador" : "torque de tombamento", -0.8 * D, 0.68 * D, { color: col, size: 12, weight: "600", align: "left" });
  }
  d.text(`θ = ${formatBR(deg(th), 3)}°    GZ = ${formatBR(hh.GZ, 3)} m`, -0.8 * D, 0.75 * D, { align: "left", size: 13, weight: "600" });
  d.text("Arraste o casco (o mastro segue o ponteiro).", -0.8 * D, -0.55 * D, { align: "left", size: 11, color: theme.muted });

  // Painel: curva GZ(θ)
  const px0 = 1.1 * D, px1 = 2.3 * D, py0 = -0.5 * D, py1 = 0.45 * D;
  const N = 72;
  const curve: Pt[] = [];
  let gmax = 1e-6;
  for (let i = 0; i <= N; i++) {
    const tt = rad(-90 + (180 * i) / N);
    const gz = heel(h, tt).GZ;
    gmax = Math.max(gmax, Math.abs(gz));
    curve.push([tt, gz]);
  }
  gmax = Math.max(gmax, Math.abs(mc.GM) * 0.6);
  const midY = (py0 + py1) / 2;
  const X = (tt: number) => px0 + ((deg(tt) + 90) / 180) * (px1 - px0);
  const Yg = (gz: number) => midY + (gz / gmax) * 0.45 * (py1 - py0);
  d.rect(px0 - 0.05 * D, py0 - 0.12 * D, px1 - px0 + 0.1 * D, py1 - py0 + 0.32 * D, { stroke: theme.grid, width: 1 });
  d.line(px0, midY, px1, midY, { color: theme.muted });
  d.line(X(0), py0, X(0), py1, { color: theme.muted });
  for (const a of [-90, -45, 45, 90]) d.text(`${a}°`, X(rad(a)), midY - 12 * d.px, { size: 10, color: theme.muted });
  d.text("GZ(θ)", px0, py1 + 0.08 * D, { align: "left", size: 12, weight: "600" });
  d.text(`GM = ${formatBR(mc.GM, 3)} m  ${mc.GM > 0 ? "estável" : "instável"}`, px1, py1 + 0.08 * D, { align: "right", size: 12, color: mc.GM > 0 ? theme.series[2] : theme.positive, weight: "600" });
  d.plot((tt) => Yg(mc.GM * Math.sin(tt)), rad(-35), rad(35), { color: theme.muted, dash: [4, 4], n: 40 });
  d.polyline(curve.map(([tt, gz]) => [X(tt), Yg(gz)] as [number, number]), { color: theme.accent, width: 2 });
  const thc = clamp(th, rad(-90), rad(90));
  if (Math.abs(th) <= rad(90)) d.dot(X(thc), Yg(hh.GZ), 5, theme.positive);
  d.text("tracejado: GM·sen θ", px0, py0 - 0.06 * D, { align: "left", size: 10, color: theme.muted });
}

function renderDynamometer(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const b = blockOf(p);
  const a = b.a;
  const mg = blockMass(b) * b.g;
  const dy = dynamometer(b, at(s, DH) * a);
  const slack = dy.T <= 1e-9 && b.rhoB < b.rhoF;
  // Recipiente e água
  d.rect(-1.5 * a, -HW * a, 3 * a, HW * a, { fill: theme.series[0], alpha: 0.2 });
  d.line(-1.5 * a, 0, 1.5 * a, 0, { color: theme.series[0], width: 2 });
  d.polyline([[-1.5 * a, 0.6 * a], [-1.5 * a, -HW * a], [1.5 * a, -HW * a], [1.5 * a, 0.6 * a]], { color: theme.text, width: 2.5 });
  // Bloco
  const yb = -dy.d;
  d.rect(-a / 2, yb, a, a, { fill: theme.series[1], alpha: 0.85, stroke: theme.text, width: 1.5 });
  // Mola e corpo do dinamômetro (sobe com a mão)
  const hand = -at(s, DH) * a;
  const yHook = hand + a;
  const stretch = 0.2 * a + 0.8 * a * Math.min(1.2, dy.T / Math.max(mg, 1e-9));
  const yCase = yHook + 0.35 * a + 0.8 * a;
  const ySpringTop = yCase;
  const ySpringBot = ySpringTop - stretch;
  if (slack) {
    d.polyline([[0, yb + a], [0.1 * a, (yb + a + ySpringBot) / 2], [0, ySpringBot]], { color: theme.muted, width: 1.5 });
  } else d.line(0, yb + a, 0, ySpringBot, { color: theme.text, width: 1.5 });
  d.spring(0, ySpringBot, 0, ySpringTop, { color: theme.text, coils: 8, amplitudePx: 5 });
  d.rect(-0.3 * a, yCase, 0.6 * a, 1.2 * a, { fill: theme.dark ? "#2a3240" : "#eef1f5", stroke: theme.text, width: 1.5 });
  d.text(`${formatBR(dy.T, 3)} N`, 0, yCase + 0.6 * a, { size: 12, weight: "700", color: theme.accent });
  d.line(0, yCase + 1.2 * a, 0, yCase + 1.45 * a, { color: theme.text, width: 3 });
  // Forças no bloco
  const sc = 60 / Math.max(mg, 1e-9);
  const cx = 0, cy = yb + a / 2;
  d.arrowPx(cx - 0.18 * a, cy, 0, -1, mg * sc, { color: theme.series[4] });
  d.text("P", cx - 0.25 * a, cy - 0.35 * a, { color: theme.series[4], weight: "600", align: "right" });
  if (dy.E > 1e-6) {
    d.arrowPx(cx + 0.18 * a, cy, 0, 1, dy.E * sc, { color: theme.positive });
    d.text("E", cx + 0.25 * a, cy + 0.35 * a, { color: theme.positive, weight: "600", align: "left" });
  }
  if (slack) d.text("Fio frouxo: o bloco flutua", 0, 0.9 * a, { color: theme.positive, size: 11, weight: "600" });

  // Gráfico leitura × profundidade
  const gx0 = 2.0 * a, gx1 = 4.7 * a, gy0 = -2.6 * a, gy1 = 1.6 * a;
  const dmax = DMAX * a;
  const X = (dd: number) => gx0 + ((dd + 0.6 * a) / (dmax + 0.6 * a)) * (gx1 - gx0);
  const Yv = (T: number) => gy0 + (T / Math.max(mg, 1e-9)) * (gy1 - gy0) * 0.9;
  d.line(gx0, gy0, gx1, gy0, { color: theme.muted });
  d.line(gx0, gy0, gx0, gy1, { color: theme.muted });
  d.text("leitura (N)", gx0, gy1 + 0.2 * a, { align: "left", size: 11, color: theme.muted });
  d.text("profundidade da base →", gx1, gy0 - 0.25 * a, { align: "right", size: 11, color: theme.muted });
  d.line(X(0), gy0, X(0), gy1, { color: theme.series[0], dash: [3, 3], alpha: 0.7 });
  d.line(X(a), gy0, X(a), gy1, { color: theme.series[0], dash: [3, 3], alpha: 0.7 });
  d.text("entra", X(0), gy0 - 0.25 * a, { size: 10, color: theme.series[0] });
  d.text("submerso", X(a), gy1 + 0.2 * a, { size: 10, color: theme.series[0] });
  d.text(`mg = ${formatBR(mg, 3)}`, gx0 - 0.05 * a, Yv(mg), { align: "right", size: 10, color: theme.muted });
  d.plot((x) => Yv(dynamometer(b, ((x - gx0) / (gx1 - gx0)) * (dmax + 0.6 * a) - 0.6 * a).T), gx0, gx1, { color: theme.accent, width: 2, n: 120 });
  d.dot(X(Math.max(-0.6 * a, at(s, DH) * a)), Yv(dy.T), 5, theme.positive);
}

function renderFloat(d: Draw, s: State, p: Params) {
  const { theme } = d;
  const b = blockOf(p);
  const a = b.a;
  const y = at(s, Y) * a;
  const m = blockMass(b);
  d.rect(-2 * a, -HW * a, 4 * a, HW * a, { fill: theme.series[0], alpha: 0.2 });
  d.line(-2 * a, 0, 2 * a, 0, { color: theme.series[0], width: 2 });
  d.polyline([[-2 * a, 1.6 * a], [-2 * a, -HW * a], [2 * a, -HW * a], [2 * a, 1.6 * a]], { color: theme.text, width: 2.5 });
  d.rect(-a / 2, y, a, a, { fill: theme.series[1], alpha: 0.85, stroke: theme.text, width: 1.5 });
  const sub = Math.max(0, Math.min(a, -y));
  if (sub > 0) d.rect(-a / 2, y, a, sub, { fill: theme.series[0], alpha: 0.25 });
  const mg = m * b.g;
  const E = buoyancy(b, sub);
  const sc = 60 / mg;
  d.arrowPx(-0.15 * a, y + a / 2, 0, -1, mg * sc, { color: theme.series[4] });
  d.text("P", -0.22 * a, y + a / 2 - 0.4 * a, { color: theme.series[4], weight: "600", align: "right" });
  if (E > 1e-9) {
    d.arrowPx(0.15 * a, y + sub / 2, 0, 1, Math.min(240, E * sc), { color: theme.positive });
    d.text("E", 0.22 * a, y + sub / 2 + 0.4 * a, { color: theme.positive, weight: "600", align: "left" });
  }
  const fd = floatDepth(b);
  if (Number.isFinite(fd)) {
    d.line(-0.75 * a, -fd + a, 0.75 * a, -fd + a, { color: theme.muted, dash: [4, 3] });
    d.text("topo no equilíbrio", 0.8 * a, -fd + a, { align: "left", size: 10, color: theme.muted });
  }
  const lines = [
    `ρ do bloco / ρ do líquido = ${formatBR(b.rhoB / b.rhoF, 3)}`,
    `fração submersa = ${formatBR(sub / a, 3)}`,
    `E = ${formatBR(E, 3)} N   P = ${formatBR(mg, 3)} N`,
    Number.isFinite(fd) ? "flutua (ρ_bloco < ρ_líquido)" : "afunda (ρ_bloco > ρ_líquido)",
  ];
  lines.forEach((t, i) => d.text(t, 2.3 * a, 1.3 * a - i * 0.4 * a, { align: "left", size: 11, color: i === 3 ? theme.accent : theme.text }));
  d.text("Arraste o bloco e solte.", 2.3 * a, -2.8 * a, { align: "left", size: 11, color: theme.muted });
}

export default empuxo;
