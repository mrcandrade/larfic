import { clamp, defineSim, draw, num, rad, texNum, type Params } from "@fisilab/core";

/** Tempo característico com que a patinadora move os braços até a posição pedida. */
export const TAU_ARMS = 0.25;
/** Velocidade máxima com que a pessoa gira o eixo da roda (rad/s). */
export const BETA_RATE = rad(120);

export interface AngState {
  /** Ângulo de giro do corpo (patinadora ou cadeira), rad. */
  phi: number;
  /** Componente vertical do momento angular total (conservada). */
  L: number;
  /** Distância das mãos ao eixo (patinadora), m. */
  r: number;
  /** Inclinação do eixo da roda em relação à vertical, rad. */
  beta: number;
  /** Ângulo de giro da roda em torno do próprio eixo, rad. */
  psi: number;
  /** Energia cinética inicial, J. */
  K0: number;
}

const mode = (p: Params) => Math.round(num(p, "modo"));

/** Momento de inércia da patinadora: corpo + duas massas (braços) a r do eixo. */
export const skaterI = (p: Params, r: number) => num(p, "Ic", 1) + 2 * num(p, "mb", 3) * r * r;
/** Momento angular de spin da roda. */
export const wheelL = (p: Params) => num(p, "Iw", 0.15) * num(p, "ww", 25);

/** Momento de inércia em torno do eixo vertical do corpo que gira. */
export const bodyI = (s: AngState, p: Params) => (mode(p) === 1 ? num(p, "Ic", 1) : skaterI(p, s.r));

/** Velocidade angular do corpo: ω = L/I (patinadora) ou Ω = (L − L_roda cos β)/I_c (cadeira). */
export function omega(s: AngState, p: Params): number {
  if (mode(p) === 1) return (s.L - wheelL(p) * Math.cos(s.beta)) / num(p, "Ic", 1);
  return s.L / skaterI(p, s.r);
}

export function kinetic(s: AngState, p: Params): number {
  const w = omega(s, p);
  const K = 0.5 * bodyI(s, p) * w * w;
  return mode(p) === 1 ? K + 0.5 * num(p, "Iw", 0.15) * num(p, "ww", 25) ** 2 : K;
}

const wheelLz = (s: AngState, p: Params) => (mode(p) === 1 ? wheelL(p) * Math.cos(s.beta) : 0);

/** Projeção oblíqua simples: x para a direita, z para cima, y (profundidade) inclinado. */
const P = (x: number, y: number, z: number): [number, number] => [x + 0.12 * y, z + 0.3 * y];

const fmt = (v: number, n = 2) => v.toFixed(n).replace(".", ",");

export const momentoAngular = defineSim<AngState>({
  id: "momento-angular",
  title: "Conservação do momento angular",
  course: "FG I",
  topic: "Rotação",
  priority: "P1",
  summary:
    "Uma patinadora que abre e fecha os braços e uma pessoa numa cadeira giratória que inverte uma roda de bicicleta. Veja o vetor L em 3D, ω = L/I mudar ao vivo e a energia cinética variar pelo trabalho dos músculos.",
  equations: [
    String.raw`\vec L = I\vec\omega \qquad \frac{d\vec L}{dt} = \vec\tau_{ext} = 0 \;\Rightarrow\; I_1\omega_1 = I_2\omega_2`,
    String.raw`I = I_{corpo} + 2 m_b r^2 \qquad K = \frac{L^2}{2I}`,
    String.raw`L_z = I_c\,\Omega + I_r\,\omega_r\cos\beta = \text{constante}`,
    String.raw`W_{músculos} = \Delta K`,
  ],
  liveEquations(s, p) {
    const w = omega(s, p);
    const I = bodyI(s, p);
    const out = [
      String.raw`L_z = ${texNum(I)} \cdot ${texNum(w)} ${mode(p) === 1 ? `+ ${texNum(wheelLz(s, p))}` : ""} = ${texNum(I * w + wheelLz(s, p))}\ \text{kg·m}^2\text{/s}`,
      String.raw`K = ${texNum(kinetic(s, p))}\ \text{J} \qquad W_{músculos} = \Delta K = ${texNum(kinetic(s, p) - s.K0)}\ \text{J}`,
    ];
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Situação",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Patinadora (abre e fecha os braços)" },
        { value: 1, label: "Cadeira giratória com roda de bicicleta" },
      ],
    },
    { key: "r", label: "Distância das mãos ao eixo (patinadora)", unit: "m", min: 0.15, max: 0.9, step: 0.01, default: 0.8, live: true },
    { key: "mb", label: "Massa de cada braço (patinadora)", unit: "kg", min: 1, max: 6, step: 0.1, default: 3 },
    { key: "Ic", label: "Momento de inércia do corpo (sem braços) ou da cadeira com a pessoa", unit: "kg·m²", min: 0.5, max: 8, step: 0.1, default: 1 },
    { key: "w0", label: "Velocidade angular inicial do corpo", unit: "rad/s", min: -6, max: 6, step: 0.1, default: 2 },
    { key: "Iw", label: "Momento de inércia da roda", unit: "kg·m²", min: 0.05, max: 0.4, step: 0.01, default: 0.15 },
    { key: "ww", label: "Rotação da roda em torno do seu eixo", unit: "rad/s", min: 5, max: 40, step: 0.5, default: 25 },
    { key: "beta", label: "Inclinação do eixo da roda (0° = para cima)", unit: "°", min: 0, max: 180, step: 1, default: 0, live: true },
  ],

  observables: [
    { key: "omega", label: "Velocidade angular do corpo ω", unit: "rad/s", value: (s, p) => omega(s, p) },
    { key: "I", label: "Momento de inércia do corpo", unit: "kg·m²", value: (s, p) => bodyI(s, p) },
    { key: "Lz", label: "Momento angular total L_z", unit: "kg·m²/s", value: (s, p) => bodyI(s, p) * omega(s, p) + wheelLz(s, p) },
    { key: "Lcorpo", label: "Momento angular do corpo Iω", unit: "kg·m²/s", value: (s, p) => bodyI(s, p) * omega(s, p) },
    { key: "Lroda", label: "Componente vertical do L da roda", unit: "kg·m²/s", value: (s, p) => wheelLz(s, p) },
    { key: "K", label: "Energia cinética", unit: "J", value: (s, p) => kinetic(s, p) },
    { key: "W", label: "Trabalho dos músculos ΔK", unit: "J", value: (s, p) => kinetic(s, p) - s.K0 },
    { key: "rmao", label: "Distância das mãos ao eixo", unit: "m", value: (s) => s.r },
    { key: "betag", label: "Inclinação do eixo da roda", unit: "°", value: (s) => (s.beta * 180) / Math.PI },
  ],
  conserved: "Lz",
  chart: { x: "t", y: "omega" },

  scenarios: [
    {
      id: "fechar",
      label: "Patinadora fecha os braços",
      params: { modo: 0, r: 0.8, mb: 3, Ic: 1, w0: 2 },
      guide: `### Pirueta
1. Rode e, durante o giro, leve o controle **distância das mãos** de 0,8 m para 0,15 m.
2. Compare $\\omega_2/\\omega_1$ com $I_1/I_2$: $L$ não muda porque não há torque externo vertical.
3. Olhe a energia: $K = L^2/2I$ **aumenta**. De onde vem essa energia?
4. Abra os braços de novo: $K$ volta ao valor inicial.`,
      predict: [
        {
          question: "Quando a patinadora recolhe os braços e gira mais rápido, a energia cinética de rotação:",
          options: ["se conserva, como L", "aumenta", "diminui"],
          answer: 1,
          explanation: "Com $L$ fixo, $K = L^2/2I$ cresce quando $I$ diminui. A diferença é o trabalho que os músculos fazem para puxar os braços contra a tendência de afastá-los (a \"força centrífuga\" no referencial dela).",
        },
      ],
    },
    {
      id: "inverter",
      label: "Cadeira: inverter a roda",
      params: { modo: 1, Ic: 4, w0: 0, Iw: 0.15, ww: 25, beta: 0 },
      guide: `### A roda de bicicleta
1. A pessoa começa parada, segurando a roda girando com o eixo para cima: $L_z = I_r\\omega_r$.
2. Rode e leve a inclinação $\\beta$ de 0° a 180° (vire a roda de ponta-cabeça).
3. Confira: $I_c\\Omega = 2 I_r\\omega_r$. A cadeira gira no mesmo sentido em que a roda girava antes.
4. Veja que $L_z$ total fica constante; as componentes horizontais são absorvidas pelo apoio da cadeira.`,
      predict: [
        {
          question: "A pessoa, parada, vira de ponta-cabeça uma roda que gira no sentido anti-horário (vista de cima). A cadeira:",
          options: ["continua parada", "gira no sentido anti-horário", "gira no sentido horário"],
          answer: 1,
          explanation: "$L_z$ total era $+I_r\\omega_r$. Com a roda invertida ela contribui $-I_r\\omega_r$, então a cadeira precisa ter $+2I_r\\omega_r$: gira no sentido anti-horário.",
        },
      ],
    },
    {
      id: "horizontal",
      label: "Roda na horizontal",
      params: { modo: 1, Ic: 4, w0: 0, Iw: 0.15, ww: 25, beta: 0 },
      guide: `### Meio caminho
1. Leve a inclinação a 90°: o eixo da roda fica horizontal e ela não contribui para $L_z$.
2. Preveja a velocidade da cadeira: $\\Omega = I_r\\omega_r/I_c$.
3. Volte a 0°. A cadeira para de novo? Compare o trabalho realizado na ida e na volta.`,
    },
    {
      id: "abrir",
      label: "Patinadora abre os braços",
      params: { modo: 0, r: 0.15, mb: 3, Ic: 1, w0: 6 },
      guide: `### Freando sem atrito
1. A patinadora começa girando rápido com os braços fechados.
2. Abra os braços durante a simulação: $\\omega$ cai e $K$ diminui.
3. Para onde vai a energia? (Os músculos fazem trabalho negativo, segurando os braços enquanto eles se afastam.)`,
    },
  ],

  exercises: [
    {
      id: "patinadora",
      prompt:
        "Uma patinadora tem momento de inércia {Ic} kg·m² sem contar os braços; cada braço equivale a {mb} kg a {r} m do eixo. Ela gira a {w0} rad/s e recolhe as mãos até 0,15 m do eixo. Qual é a nova velocidade angular?",
      vary: { Ic: [0.8, 2, 1], mb: [2, 5, 1], r: [0.6, 0.9, 2], w0: [1, 4, 1] },
      fixed: { modo: 0 },
      answer: { label: "ω₂", unit: "rad/s", compute: (p) => (skaterI(p, num(p, "r")) * num(p, "w0")) / skaterI(p, 0.15) },
      hint: "I = I_c + 2 m r² antes e depois; L = Iω se conserva.",
    },
    {
      id: "roda",
      prompt:
        "Uma pessoa parada numa cadeira giratória (momento de inércia {Ic} kg·m², contando a pessoa) segura uma roda de momento de inércia {Iw} kg·m² girando a {ww} rad/s com o eixo vertical. Ela vira a roda de ponta-cabeça. Com que velocidade angular a cadeira passa a girar?",
      vary: { Ic: [2, 8, 1], Iw: [0.05, 0.4, 2], ww: [10, 40, 0] },
      fixed: { modo: 1, w0: 0, beta: 0 },
      answer: { label: "Ω", unit: "rad/s", compute: (p) => (2 * num(p, "Iw") * num(p, "ww")) / num(p, "Ic") },
      hint: "L_z antes = I_r ω_r; depois = I_c Ω − I_r ω_r.",
    },
  ],

  init(p) {
    const beta = rad(num(p, "beta"));
    const r = num(p, "r", 0.8);
    const w0 = num(p, "w0", 2);
    const L = mode(p) === 1 ? num(p, "Ic", 1) * w0 + wheelL(p) * Math.cos(beta) : skaterI(p, r) * w0;
    const s: AngState = { phi: 0, L, r, beta, psi: 0, K0: 0 };
    return { ...s, K0: kinetic(s, p) };
  },
  step(s, p, _t, dt) {
    // Braços: aproximação exponencial da posição pedida; roda: giro com velocidade limitada.
    const rT = num(p, "r", 0.8);
    const e = Math.exp(-dt / TAU_ARMS);
    const r1 = rT + (s.r - rT) * e;
    const bT = rad(num(p, "beta"));
    const beta1 = s.beta + clamp(bT - s.beta, -BETA_RATE * dt, BETA_RATE * dt);
    const mid = { ...s, r: rT + (s.r - rT) * Math.exp(-dt / (2 * TAU_ARMS)), beta: (s.beta + beta1) / 2 };
    // φ integrado pelo ponto médio (ω = L/I varia suavemente).
    const phi = s.phi + omega(mid, p) * dt;
    const psi = s.psi + num(p, "ww", 25) * dt;
    return { ...s, phi, r: r1, beta: beta1, psi };
  },
  dt: 1e-3,
  sampleEvery: 10,
  tEnd: 120,

  viewport: () => ({ xMin: -2.4, xMax: 2.6, yMin: -0.55, yMax: 3.05 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    const w = omega(s, p);
    const I = bodyI(s, p);
    const Lw = wheelL(p);
    const ell = (cx: number, cy: number, cz: number, rr: number, st: { color?: string; fill?: string; dash?: number[]; width?: number; alpha?: number }) => {
      const pts: [number, number][] = [];
      for (let k = 0; k <= 48; k++) {
        const a = (2 * Math.PI * k) / 48;
        pts.push(P(cx + rr * Math.cos(a), cy + rr * Math.sin(a), cz));
      }
      d.polyline(pts, { close: true, ...st });
    };
    const arrow3 = (o: [number, number, number], v: [number, number, number], color: string, label?: string, dash?: number[]) => {
      const [x0, y0] = P(...o);
      const [x1, y1] = P(o[0] + v[0], o[1] + v[1], o[2] + v[2]);
      if (Math.hypot(x1 - x0, y1 - y0) < 0.02) return;
      d.arrow(x0, y0, x1 - x0, y1 - y0, { color, width: 3, dash });
      if (label) d.text(label, x1, y1, { color, size: 13, weight: "700", dx: 12 });
    };
    const ex: [number, number, number] = [Math.cos(s.phi), Math.sin(s.phi), 0];

    // Chão
    ell(0, 0, 0, 1.25, { color: theme.muted, fill: theme.ground, width: 1 });

    if (m === 0) {
      // Patinadora
      const zs = 1.38;
      ell(0, 0, zs, s.r, { color: theme.muted, dash: [4, 4], width: 1 });
      const torso: [number, number][] = [P(0, 0, 0.02), P(0, 0, 1.45)];
      d.line(...torso[0]!, ...torso[1]!, { color: theme.text, width: 7 });
      d.line(...P(0, 0, 0.02), ...P(0.12 * ex[0], 0.12 * ex[1], 0.02), { color: theme.text, width: 3 });
      const [hx, hy] = P(0, 0, 1.62);
      d.circle(hx, hy, 0.12, { fill: theme.series[3], stroke: theme.text, width: 1 });
      const dot = Math.max(5, 2.2 * num(p, "mb", 3));
      for (const sg of [1, -1]) {
        const sh = P(sg * 0.15 * ex[0], sg * 0.15 * ex[1], zs);
        const hand = P(sg * s.r * ex[0], sg * s.r * ex[1], zs);
        d.line(sh[0], sh[1], hand[0], hand[1], { color: theme.series[1], width: 5 });
        d.dot(hand[0], hand[1], dot, theme.series[1]!);
      }
      // Vetores L e ω no eixo
      const L = s.L;
      const kL = 0.85 / Math.max(Math.abs(L), 1e-9);
      arrow3([0, 0, 1.78], [0, 0, kL * L], theme.positive, "L");
      const wRef = Math.abs(L) / skaterI(p, 0.15);
      arrow3([-0.28, 0, 1.78], [0, 0, (0.85 * w) / Math.max(wRef, 1e-9)], theme.accent, undefined);
      if (Math.abs(w) > 1e-6) {
        const tip = P(-0.28, 0, 1.78 + (0.85 * w) / Math.max(wRef, 1e-9));
        d.text("ω", tip[0], tip[1], { color: theme.accent, size: 13, weight: "700", dx: -12 });
      }
    } else {
      // Cadeira giratória e pessoa
      d.line(...P(0, 0, 0), ...P(0, 0, 0.55), { color: theme.muted, width: 5 });
      ell(0, 0, 0.6, 0.32, { color: theme.text, fill: theme.series[4], alpha: 0.6, width: 1 });
      d.line(...P(0, 0, 0.6), ...P(0, 0, 1.35), { color: theme.text, width: 7 });
      const [hx, hy] = P(0, 0, 1.5);
      d.circle(hx, hy, 0.12, { fill: theme.series[3], stroke: theme.text, width: 1 });
      const tng: [number, number, number] = [-Math.sin(s.phi), Math.cos(s.phi), 0];
      const c: [number, number, number] = [0.6 * ex[0], 0.6 * ex[1], 1.1];
      const a: [number, number, number] = [Math.sin(s.beta) * tng[0], Math.sin(s.beta) * tng[1], Math.cos(s.beta)];
      // e2 = a × e1, com e1 = ex (radial)
      const e2: [number, number, number] = [a[1] * ex[2] - a[2] * ex[1], a[2] * ex[0] - a[0] * ex[2], a[0] * ex[1] - a[1] * ex[0]];
      const Rw = 0.34;
      const rim: [number, number][] = [];
      for (let k = 0; k <= 48; k++) {
        const u = (2 * Math.PI * k) / 48;
        rim.push(P(c[0] + Rw * (Math.cos(u) * ex[0] + Math.sin(u) * e2[0]), c[1] + Rw * (Math.cos(u) * ex[1] + Math.sin(u) * e2[1]), c[2] + Rw * (Math.cos(u) * ex[2] + Math.sin(u) * e2[2])));
      }
      // Braços até as pontas do eixo
      for (const sg of [1, -1]) {
        const hub = P(c[0] + sg * 0.12 * a[0], c[1] + sg * 0.12 * a[1], c[2] + sg * 0.12 * a[2]);
        d.line(...P(0, 0, 1.25), hub[0], hub[1], { color: theme.series[1], width: 4 });
      }
      d.polyline(rim, { color: theme.text, width: 4 });
      for (const off of [0, Math.PI / 2, Math.PI, 1.5 * Math.PI]) {
        const u = s.psi + off;
        const sp = P(c[0] + Rw * (Math.cos(u) * ex[0] + Math.sin(u) * e2[0]), c[1] + Rw * (Math.cos(u) * ex[1] + Math.sin(u) * e2[1]), c[2] + Rw * (Math.cos(u) * ex[2] + Math.sin(u) * e2[2]));
        const cc = P(...c);
        d.line(cc[0], cc[1], sp[0], sp[1], { color: theme.muted, width: off === 0 ? 2.5 : 1 });
      }
      const kL = 0.7 / Math.max(Lw, 1e-9);
      arrow3(c, [kL * Lw * a[0], kL * Lw * a[1], kL * Lw * a[2]], theme.series[2]!, "L roda");
      arrow3([0, 0, 1.65], [0, 0, kL * I * w], theme.accent, "L cadeira");

      // Componentes verticais: roda + cadeira = total
      const bx = -1.9, bz = 1.4;
      d.text("componentes verticais", bx + 0.35, bz + 1.45, { size: 11, color: theme.muted });
      d.line(bx - 0.25, bz, bx + 0.95, bz, { color: theme.grid, width: 1 });
      const comps: [number, string, string][] = [
        [wheelLz(s, p), theme.series[2]!, "roda"],
        [I * w, theme.accent, "cadeira"],
        [I * w + wheelLz(s, p), theme.positive, "total"],
      ];
      comps.forEach(([v, col, lab], i) => {
        const x = bx + i * 0.4;
        if (Math.abs(v * kL) > 0.01) d.arrow(x, bz, 0, v * kL * 0.6, { color: col, width: 3 });
        d.text(lab, x, bz, { dy: v >= 0 ? 12 : -12, size: 10, color: col });
      });
    }

    // Seta curva indicando o sentido de giro (vista de cima: anti-horário = ω > 0)
    if (Math.abs(w) > 1e-3) {
      const pts: [number, number][] = [];
      const sg = Math.sign(w);
      for (let k = 0; k <= 20; k++) {
        const a = -Math.PI / 2 + sg * (k / 20) * 1.6;
        pts.push(P(1.05 * Math.cos(a), 1.05 * Math.sin(a), 0.05));
      }
      d.polyline(pts, { color: theme.accent, width: 2 });
      const [x1, y1] = pts[pts.length - 1]!, [x0, y0] = pts[pts.length - 2]!;
      d.arrowPx(x1, y1, x1 - x0, y1 - y0, 9, { color: theme.accent });
    }

    // Barras: cada uma cheia no maior valor possível nesta configuração
    const Lmag = Math.abs(s.L) + (m === 1 ? Lw : 0);
    const Imin = m === 1 ? num(p, "Ic", 1) : skaterI(p, 0.15);
    const Imax = m === 1 ? num(p, "Ic", 1) : skaterI(p, 0.9);
    const wMax = Lmag / Imin;
    const Kmax = 0.5 * Imin * wMax * wMax + (m === 1 ? 0.5 * num(p, "Iw", 0.15) * num(p, "ww", 25) ** 2 : 0);
    const rows: [string, number, number, string][] = [
      ["L_z", I * w + wheelLz(s, p), Math.max(Lmag, Math.abs(s.L)) * 1.2, theme.positive],
      ["I", I, Imax * 1.2, theme.series[1]!],
      ["|ω|", Math.abs(w), wMax * 1.05, theme.accent],
      ["K", kinetic(s, p), Kmax * 1.05, theme.series[4]!],
    ];
    const x0 = 1.25, wbar = 0.85;
    d.text("barras: escala até o máximo possível", x0 + 0.45, 2.95, { size: 10, color: theme.muted });
    rows.forEach(([lab, v, ref, col], i) => {
      const y = 2.65 - i * 0.3;
      const frac = clamp(ref > 0 ? Math.abs(v) / ref : 0, 0, 1);
      d.rect(x0, y - 0.08, wbar, 0.16, { stroke: theme.grid, width: 1 });
      d.rect(x0, y - 0.08, wbar * frac, 0.16, { fill: col, alpha: 0.8 });
      d.text(lab, x0 - 0.06, y, { align: "right", size: 11, color: col, weight: "600" });
      d.text(fmt(v), x0 + wbar + 0.05, y, { align: "left", size: 10, color: theme.text });
    });
    d.text(`W músculos = ΔK = ${fmt(kinetic(s, p) - s.K0)} J`, x0 + 0.45, 1.4, { size: 11, color: theme.text });
    d.text("vista em perspectiva; giro anti-horário visto de cima = ω > 0", 0.1, -0.45, { size: 10, color: theme.muted });
  },
});

export default momentoAngular;
