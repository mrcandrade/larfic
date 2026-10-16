import { clamp, defineSim, draw, makeRk45, num, texNum, type Params, type State } from "@fisilab/core";

/** G em UA³/(M☉·ano²): com essas unidades, T² = a³ para uma órbita em torno de 1 M☉. */
export const GU = 4 * Math.PI * Math.PI;
/** 1 UA/ano em km/s. */
export const KMS = 1.495978707e8 / 3.15576e7;
const EPS2 = 1e-8;
const N_SECT = 12;

export interface Body {
  name: string;
  m: number;
  color: number;
}

export interface OrbState {
  /** [x, y, vx, vy] de cada corpo, em UA e UA/ano. */
  y: number[];
  t: number;
  /** Ângulo acumulado de cada corpo em torno do corpo 0 (rad). */
  ang: number[];
  /** Instante da última volta completa de cada corpo (anos). */
  lastT: number[];
  /** Período medido de cada corpo (anos; 0 enquanto não completa uma volta). */
  Tm: number[];
  /** Áreas varridas pelo corpo 1 em cada intervalo T/12 da primeira volta (UA²). */
  areas: number[];
  /** Transferência de Hohmann: 1 = em trânsito, 2 = circularizada. */
  burn: number;
}

const mode = (p: Params) => Math.round(num(p, "modo"));

const PLANETS = [
  { name: "Mercúrio", a: 0.387, e: 0.206, m: 1.66e-7, ph: 0 },
  { name: "Vênus", a: 0.723, e: 0.007, m: 2.45e-6, ph: 1.7 },
  { name: "Terra", a: 1, e: 0.017, m: 3.0e-6, ph: 3.4 },
  { name: "Marte", a: 1.524, e: 0.093, m: 3.2e-7, ph: 5.0 },
];

/** Massas e nomes dos corpos em cada modo. */
export function bodies(p: Params): Body[] {
  const M = num(p, "M", 1), q = num(p, "q", 0.001);
  switch (mode(p)) {
    case 1:
      return [
        { name: "Estrela", m: M, color: 5 },
        { name: "Planeta", m: 3e-6 * M, color: 0 },
        { name: "Gigante", m: q * M, color: 1 },
      ];
    case 2:
      return [
        { name: "A", m: M, color: 0 },
        { name: "B", m: M, color: 1 },
        { name: "C", m: M, color: 2 },
      ];
    case 3:
      return [
        { name: "Sol", m: M, color: 5 },
        { name: "Sonda", m: 1e-12 * M, color: 3 },
      ];
    case 4:
      return [{ name: "Sol", m: M, color: 5 }, ...PLANETS.map((pl, i) => ({ name: pl.name, m: pl.m * M, color: i }))];
    default:
      return [
        { name: "Estrela", m: M, color: 5 },
        { name: "Planeta", m: q * M, color: 0 },
      ];
  }
}

/** Dados da transferência de Hohmann entre r1 e r2 em torno de M. */
export function hohmann(p: Params) {
  const GM = GU * num(p, "M", 1);
  const r1 = num(p, "r0", 1), r2 = num(p, "r2", 1.524);
  const aT = (r1 + r2) / 2;
  const vc1 = Math.sqrt(GM / r1), vc2 = Math.sqrt(GM / r2);
  const vt1 = vc1 * Math.sqrt((2 * r2) / (r1 + r2));
  const vt2 = vc2 * Math.sqrt((2 * r1) / (r1 + r2));
  const tH = Math.PI * Math.sqrt(aT ** 3 / GM);
  return { r1, r2, vc1, vc2, vt1, vt2, dv1: vt1 - vc1, dv2: vc2 - vt2, tH, n1: vc1 / r1, n2: vc2 / r2 };
}

/** Condições iniciais [x, y, vx, vy] de todos os corpos, no referencial do centro de massa. */
export function initialY(p: Params): number[] {
  const bs = bodies(p);
  const M = num(p, "M", 1), r0 = num(p, "r0", 1), fv = num(p, "fv", 1);
  let y: number[];
  switch (mode(p)) {
    case 1: {
      const rg = 1.6 * r0;
      y = [0, 0, 0, 0, r0, 0, 0, fv * Math.sqrt((GU * M) / r0), -rg, 0, 0, -Math.sqrt((GU * M * (1 + num(p, "q", 0.001))) / rg)];
      break;
    }
    case 2: {
      const a = r0, vs = Math.sqrt((GU * M) / a);
      const x1 = 0.97000436, y1 = -0.24308753, vx2 = -0.93240737, vy2 = -0.86473146;
      y = [
        x1 * a, y1 * a, (-vx2 / 2) * vs, (-vy2 / 2) * vs,
        0, 0, vx2 * vs, vy2 * vs,
        -x1 * a, -y1 * a, (-vx2 / 2) * vs, (-vy2 / 2) * vs,
      ];
      break;
    }
    case 3: {
      const h = hohmann(p);
      y = [0, 0, 0, 0, h.r1, 0, 0, h.vt1];
      break;
    }
    case 4: {
      y = [0, 0, 0, 0];
      for (const pl of PLANETS) {
        const rp = pl.a * (1 - pl.e);
        const vp = Math.sqrt((GU * M * (1 + pl.e)) / rp);
        y.push(rp * Math.cos(pl.ph), rp * Math.sin(pl.ph), -vp * Math.sin(pl.ph), vp * Math.cos(pl.ph));
      }
      break;
    }
    default: {
      const m = bs[1]!.m;
      const v = fv * Math.sqrt((GU * (M + m)) / r0);
      const f0 = m / (M + m), f1 = M / (M + m);
      y = [-f0 * r0, 0, 0, -f0 * v, f1 * r0, 0, 0, f1 * v];
    }
  }
  // Remove o movimento do centro de massa
  const Mt = bs.reduce((acc, b) => acc + b.m, 0);
  const cm = [0, 0, 0, 0];
  bs.forEach((b, i) => {
    for (let k = 0; k < 4; k++) cm[k]! += (b.m * y[4 * i + k]!) / Mt;
  });
  return y.map((v, j) => v - cm[j % 4]!);
}

/** Acelerações gravitacionais (com amaciamento mínimo para encontros muito próximos). */
export function deriv(y: State, masses: number[]): State {
  const n = masses.length;
  const out = new Array<number>(4 * n).fill(0);
  for (let i = 0; i < n; i++) {
    out[4 * i] = y[4 * i + 2]!;
    out[4 * i + 1] = y[4 * i + 3]!;
  }
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const dx = y[4 * j]! - y[4 * i]!, dy = y[4 * j + 1]! - y[4 * i + 1]!;
      const r2 = dx * dx + dy * dy + EPS2;
      const inv = GU / (r2 * Math.sqrt(r2));
      out[4 * i + 2]! += masses[j]! * inv * dx;
      out[4 * i + 3]! += masses[j]! * inv * dy;
      out[4 * j + 2]! -= masses[i]! * inv * dx;
      out[4 * j + 3]! -= masses[i]! * inv * dy;
    }
  }
  return out;
}

export function energy(y: State, masses: number[]): number {
  let E = 0;
  const n = masses.length;
  for (let i = 0; i < n; i++) {
    E += 0.5 * masses[i]! * (y[4 * i + 2]! ** 2 + y[4 * i + 3]! ** 2);
    for (let j = i + 1; j < n; j++) {
      const r = Math.hypot(y[4 * j]! - y[4 * i]!, y[4 * j + 1]! - y[4 * i + 1]!);
      E -= (GU * masses[i]! * masses[j]!) / Math.sqrt(r * r + EPS2);
    }
  }
  return E;
}

/** Posição e velocidade do corpo i relativas ao corpo 0. */
function rel(y: State, i: number) {
  return { x: y[4 * i]! - y[0]!, y: y[4 * i + 1]! - y[1]!, vx: y[4 * i + 2]! - y[2]!, vy: y[4 * i + 3]! - y[3]! };
}

/** Energia específica, semieixo maior e velocidade areolar do corpo i em relação ao corpo 0. */
export function orbitOf(y: State, p: Params, i = 1) {
  const bs = bodies(p);
  const mu = GU * (bs[0]!.m + (bs[i]?.m ?? 0));
  const r = rel(y, i);
  const d = Math.hypot(r.x, r.y);
  const v2 = r.vx * r.vx + r.vy * r.vy;
  const eps = v2 / 2 - mu / d;
  const h = r.x * r.vy - r.y * r.vx;
  const a = eps < 0 ? -mu / (2 * eps) : Infinity;
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * h * h) / (mu * mu)));
  return { d, v: Math.sqrt(v2), eps, h, a, e, mu, T: Number.isFinite(a) ? 2 * Math.PI * Math.sqrt(a ** 3 / mu) : Infinity };
}

/** Período kepleriano da órbita inicial do corpo 1 (escala dos setores da 2ª lei). */
function sectorDt(p: Params): number {
  const o = orbitOf(initialY(p), p, 1);
  return Number.isFinite(o.T) ? o.T / N_SECT : 0;
}

const rk45 = makeRk45({ rtol: 1e-10, atol: 1e-13 });

/** Raio da região visível (UA). */
export function viewR(p: Params): number {
  const r0 = num(p, "r0", 1);
  switch (mode(p)) {
    case 1:
      return 2.3 * r0;
    case 2:
      return 1.35 * r0;
    case 3:
      return 1.2 * Math.max(r0, num(p, "r2", 1.524));
    case 4:
      return 1.85;
    default: {
      const o = orbitOf(initialY(p), p, 1);
      const ra = Number.isFinite(o.a) ? Math.max(r0, 2 * o.a - r0) : 4 * r0;
      return Math.min(1.15 * ra, 8 * r0);
    }
  }
}

function integrate(s: OrbState, p: Params, dt: number): number[] {
  const masses = bodies(p).map((b) => b.m);
  return rk45((y) => deriv(y, masses), s.y, p, s.t, dt);
}

export const orbitasKepler = defineSim<OrbState>({
  id: "orbitas-kepler",
  title: "Órbitas e leis de Kepler",
  course: "FG I",
  topic: "Gravitação",
  priority: "P1",
  summary:
    "Dois e três corpos sob gravitação em unidades de UA, ano e massa solar: áreas iguais em tempos iguais, T² ∝ a³, velocidade de escape, transferência de Hohmann e o campo gravitacional desenhado ao fundo.",
  equations: [
    String.raw`\vec F_{12} = -\frac{G m_1 m_2}{r^2}\,\hat r \qquad \vec g = -\frac{GM}{r^2}\hat r \qquad G = 4\pi^2\ \tfrac{\text{UA}^3}{M_\odot\,\text{ano}^2}`,
    String.raw`\frac{dA}{dt} = \frac{|\vec r \times \vec v|}{2} = \text{const.} \qquad T^2 = \frac{4\pi^2}{G(M+m)}\,a^3`,
    String.raw`E = \tfrac12 mv^2 - \frac{GMm}{r} = -\frac{GMm}{2a} \qquad v_{esc} = \sqrt{\frac{2GM}{r}} = \sqrt2\, v_{circ}`,
    String.raw`\text{Hohmann: } \Delta v_1 = \sqrt{\tfrac{GM}{r_1}}\left(\sqrt{\tfrac{2r_2}{r_1+r_2}} - 1\right), \quad \Delta v_2 = \sqrt{\tfrac{GM}{r_2}}\left(1 - \sqrt{\tfrac{2r_1}{r_1+r_2}}\right)`,
  ],
  liveEquations(s, p) {
    const o = orbitOf(s.y, p, 1);
    const m = mode(p);
    const out = [
      String.raw`r = ${texNum(o.d)}\ \text{UA} \quad v = ${texNum(o.v * KMS)}\ \text{km/s} \quad v_{esc} = ${texNum(Math.sqrt((2 * o.mu) / o.d) * KMS)}\ \text{km/s} \quad \varepsilon = ${texNum(o.eps)}\ \text{UA}^2/\text{ano}^2`,
    ];
    if (m === 3) {
      const h = hohmann(p);
      out.push(String.raw`\Delta v_1 = ${texNum(h.dv1 * KMS)}\ \text{km/s} \quad \Delta v_2 = ${texNum(h.dv2 * KMS)}\ \text{km/s} \quad t_H = ${texNum(h.tH)}\ \text{ano}`);
    } else if (Number.isFinite(o.a)) {
      const T = s.Tm[1]! > 0 ? s.Tm[1]! : o.T;
      out.push(String.raw`a = ${texNum(o.a)}\ \text{UA} \quad e = ${texNum(o.e)} \quad T${s.Tm[1]! > 0 ? "_{med}" : ""} = ${texNum(T)}\ \text{ano} \quad \frac{T^2}{a^3} = ${texNum((T * T) / o.a ** 3)}\ \tfrac{\text{ano}^2}{\text{UA}^3}`);
    } else {
      out.push(String.raw`\varepsilon \ge 0:\ \text{órbita aberta, o corpo escapa}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Sistema",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Dois corpos: estrela e planeta" },
        { value: 1, label: "Três corpos: estrela, planeta e gigante" },
        { value: 2, label: "Três corpos: coreografia em oito" },
        { value: 3, label: "Transferência de Hohmann" },
        { value: 4, label: "Planetas internos (3ª lei)" },
      ],
    },
    { key: "M", label: "Massa da estrela (ou de cada corpo no oito)", unit: "M☉", min: 0.2, max: 3, step: 0.05, default: 1 },
    { key: "r0", label: "Distância inicial r₀ (raio de partida no Hohmann)", unit: "UA", min: 0.3, max: 3, step: 0.05, default: 1 },
    { key: "fv", label: "Velocidade inicial / velocidade circular", unit: "", min: 0.2, max: 1.6, step: 0.01, default: 0.75 },
    { key: "q", label: "Massa do planeta (ou gigante) / massa da estrela", unit: "", min: 0, max: 1, step: 0.001, default: 0.001 },
    { key: "r2", label: "Raio da órbita de destino (Hohmann)", unit: "UA", min: 0.3, max: 5, step: 0.01, default: 1.524 },
    {
      key: "campo",
      label: "Campo gravitacional ao fundo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 1,
      live: true,
      options: [
        { value: 1, label: "Mostrar" },
        { value: 0, label: "Esconder" },
      ],
    },
  ],

  observables: [
    { key: "r", label: "Distância corpo 1 – corpo 0", unit: "UA", value: (s, p) => orbitOf(s.y, p).d },
    { key: "v", label: "Velocidade relativa do corpo 1", unit: "km/s", value: (s, p) => orbitOf(s.y, p).v * KMS },
    { key: "E", label: "Energia total do sistema", unit: "M☉·UA²/ano²", value: (s, p) => energy(s.y, bodies(p).map((b) => b.m)) },
    { key: "eps", label: "Energia específica do corpo 1", unit: "UA²/ano²", value: (s, p) => orbitOf(s.y, p).eps },
    { key: "areolar", label: "Velocidade areolar dA/dt", unit: "UA²/ano", value: (s, p) => Math.abs(orbitOf(s.y, p).h) / 2 },
    { key: "a", label: "Semieixo maior (corpo 1)", unit: "UA", value: (s, p) => { const a = orbitOf(s.y, p).a; return Number.isFinite(a) ? a : 0; } },
    { key: "Tmed", label: "Período medido (corpo 1)", unit: "ano", value: (s) => s.Tm[1] ?? 0 },
  ],
  conserved: "E",
  chart: { x: "t", y: "r" },

  scenarios: [
    {
      id: "elipse",
      label: "Elipse, 2ª lei e escape",
      params: { modo: 0, M: 1, r0: 1, fv: 0.75, q: 0.001, campo: 1 },
      guide: `### Áreas iguais em tempos iguais
1. Rode uma volta. Os setores coloridos são varridos em intervalos iguais de $T/12$: compare as áreas escritas neles.
2. Onde o planeta anda mais rápido? Confira $v$ no periélio e no afélio: $r_p v_p = r_a v_a$.
3. Veja $T^2/a^3$ nas equações vivas: com $M = 1\\,M_\\odot$ ele vale 1 ano²/UA³.
4. Aumente $v_0/v_{circ}$ até $\\sqrt2 \\approx 1{,}414$ e reinicie: a energia fica $\\ge 0$ e o planeta escapa.`,
      predict: [
        {
          question: "Numa órbita elíptica, o planeta é mais rápido:",
          options: ["no ponto mais próximo da estrela", "no ponto mais distante", "tem a mesma rapidez em toda a órbita"],
          answer: 0,
          explanation: "A velocidade areolar $|\\vec r \\times \\vec v|/2$ é constante (o momento angular se conserva). Com $r$ menor, $v$ precisa ser maior.",
        },
        {
          question: "Partindo da órbita circular, por qual fator é preciso multiplicar a velocidade para o planeta escapar?",
          options: ["2", "√2 ≈ 1,41", "1,5", "não há limite: ele sempre volta"],
          answer: 1,
          explanation: "Escapar exige $E = \\tfrac12 v^2 - GM/r \\ge 0$, ou seja $v \\ge \\sqrt{2GM/r} = \\sqrt2\\, v_{circ}$.",
        },
      ],
    },
    {
      id: "planetas",
      label: "Planetas internos: 3ª lei",
      params: { modo: 4, M: 1, campo: 0 },
      guide: `### T² ∝ a³
1. Rode alguns anos. Cada planeta marca seu período quando completa uma volta.
2. O quadro à direita põe $a^3$ no eixo horizontal e $T^2$ no vertical: os pontos caem sobre a reta $T^2 = a^3/M$.
3. Mude a massa da estrela e reinicie: a inclinação da reta muda como $1/M$.`,
    },
    {
      id: "hohmann",
      label: "Transferência de Hohmann",
      params: { modo: 3, M: 1, r0: 1, r2: 1.524, campo: 0 },
      guide: `### Da Terra a Marte
1. A sonda parte da órbita da Terra já com o primeiro impulso $\\Delta v_1$, numa elipse que toca as duas órbitas.
2. No afélio ela recebe $\\Delta v_2$ e passa a circular na órbita de destino. Confira os valores nas equações vivas.
3. Marte (quadrado) foi posicionado para chegar junto: qual deve ser o ângulo entre Terra e Marte no lançamento?
4. Observe o salto na energia nos dois impulsos: é o trabalho do motor.`,
      predict: [
        {
          question: "Para ir de uma órbita circular menor para uma maior, a sonda chega à órbita final:",
          options: ["mais rápida do que estava na órbita inicial", "mais lenta do que estava na órbita inicial", "com a mesma velocidade"],
          answer: 1,
          explanation: "Apesar de os dois impulsos serem para a frente, a velocidade circular $\\sqrt{GM/r}$ diminui com o raio. A energia total aumentou, mas foi para a energia potencial.",
        },
      ],
    },
    {
      id: "tres",
      label: "Três corpos",
      params: { modo: 2, M: 1, r0: 1, campo: 1 },
      guide: `### Coreografia em oito
1. Três massas iguais seguem a mesma curva em forma de oito (solução de Chenciner e Montgomery).
2. A energia total se conserva, mas a energia de cada par não: não há mais elipses de Kepler.
3. Troque o sistema para **estrela, planeta e gigante** e aumente a massa do gigante: a órbita do planeta deixa de se fechar.`,
    },
  ],

  exercises: [
    {
      id: "periodo",
      prompt: "Um planeta de massa desprezível orbita uma estrela de {M} massas solares numa elipse de semieixo maior {a} UA. Qual é o período, em anos?",
      vary: { M: [0.3, 3, 1], a: [0.3, 10, 1] },
      answer: { label: "T", unit: "ano", compute: (p) => Math.sqrt(num(p, "a") ** 3 / num(p, "M")) },
      hint: "Em UA, anos e massas solares, T² = a³/M.",
    },
    {
      id: "escape",
      prompt: "Qual é a velocidade de escape, em km/s, a {r0} UA de uma estrela de {M} massas solares? (Use 1 UA/ano = 4,74 km/s e G = 4π² UA³/(M☉·ano²).)",
      vary: { M: [0.3, 3, 1], r0: [0.3, 3, 1] },
      answer: { label: "v_esc", unit: "km/s", compute: (p) => Math.sqrt((2 * GU * num(p, "M")) / num(p, "r0")) * KMS },
      hint: "v_esc = √(2GM/r) = √2 v_circ.",
    },
  ],

  init(p) {
    const y = initialY(p);
    const n = bodies(p).length;
    return { y, t: 0, ang: new Array<number>(n).fill(0), lastT: new Array<number>(n).fill(0), Tm: new Array<number>(n).fill(0), areas: new Array<number>(N_SECT).fill(0), burn: 1 };
  },
  step(s, p, t, dt) {
    let y: number[];
    let burn = s.burn;
    const m = mode(p);
    if (m === 3 && burn === 1) {
      const { tH } = hohmann(p);
      if (t < tH && t + dt >= tH) {
        // Integra até o afélio (ou periélio), aplica Δv₂ e segue.
        const h1 = tH - t;
        y = h1 > 0 ? integrate(s, p, h1) : s.y.slice();
        const r = rel(y, 1);
        const v = Math.hypot(r.vx, r.vy), d = Math.hypot(r.x, r.y);
        const vc = Math.sqrt((GU * num(p, "M", 1)) / d);
        y[6] = y[2]! + (r.vx / v) * vc;
        y[7] = y[3]! + (r.vy / v) * vc;
        burn = 2;
        if (dt - h1 > 0) y = integrate({ ...s, y, t: tH }, p, dt - h1);
      } else y = integrate(s, p, dt);
    } else y = integrate(s, p, dt);
    const t1 = t + dt;

    // Ângulos acumulados e períodos medidos (em torno do corpo 0)
    const n = bodies(p).length;
    const ang = s.ang.slice(), lastT = s.lastT.slice(), Tm = s.Tm.slice();
    for (let i = 1; i < n; i++) {
      const a0 = rel(s.y, i), a1 = rel(y, i);
      let dth = Math.atan2(a1.y, a1.x) - Math.atan2(a0.y, a0.x);
      if (dth > Math.PI) dth -= 2 * Math.PI;
      if (dth < -Math.PI) dth += 2 * Math.PI;
      const before = Math.floor(Math.abs(ang[i]!) / (2 * Math.PI));
      ang[i] = ang[i]! + dth;
      const after = Math.floor(Math.abs(ang[i]!) / (2 * Math.PI));
      if (after > before && Math.abs(dth) > 0) {
        const target = Math.sign(ang[i]!) * after * 2 * Math.PI;
        const tc = t + (dt * (target - (ang[i]! - dth))) / dth;
        Tm[i] = tc - lastT[i]!;
        lastT[i] = tc;
      }
    }

    // Áreas varridas pelo corpo 1 em cada setor de T/12 (primeira volta, modo de dois corpos)
    let areas = s.areas;
    const sd = m === 0 ? sectorDt(p) : 0;
    if (sd > 0) {
      const k = Math.floor((t + dt / 2) / sd);
      if (k < N_SECT) {
        const a0 = rel(s.y, 1), a1 = rel(y, 1);
        areas = s.areas.slice();
        areas[k] = areas[k]! + Math.abs(a0.x * a1.y - a0.y * a1.x) / 2;
      }
    }
    return { y, t: t1, ang, lastT, Tm, areas, burn };
  },
  dt: 0.002,
  sampleEvery: 2,
  maxSamples: 20_000,
  tEnd: 100,
  stopWhen(s, p) {
    const R = viewR(p) * 0.98;
    let far = 0;
    for (let i = 0; i < s.y.length; i += 4) far = Math.max(far, Math.hypot(s.y[i]!, s.y[i + 1]!));
    return R - far;
  },

  viewport(p) {
    const R = viewR(p);
    const m = mode(p);
    return { xMin: -R, xMax: (m === 4 ? 2.05 : 1.55) * R, yMin: -R, yMax: R, unit: "UA" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, trail } = frame;
    const bs = bodies(p);
    const m = mode(p);
    const R = viewR(p);
    const col = (b: Body) => (b.color === 5 ? (theme.dark ? "#f2c94c" : "#d89b00") : theme.series[b.color % theme.series.length]!);
    const fmt = (v: number, n = 3) => (Math.abs(v) < 1e-3 ? "0" : Number(v.toPrecision(n)).toString().replace(".", ","));

    // Campo gravitacional
    if (num(p, "campo", 1) > 0.5) {
      const Mt = bs.reduce((a, b) => a + b.m, 0);
      const heavy = bs.map((b, i) => ({ b, i })).filter(({ b }) => b.m > 1e-3 * Mt);
      const gref = (GU * Mt) / (R * R);
      const nx = 14, ny = 11;
      for (let ix = 0; ix < nx; ix++) {
        for (let iy = 0; iy < ny; iy++) {
          const x = -R + ((ix + 0.5) * 2 * R) / nx, y = -R + ((iy + 0.5) * 2 * R) / ny;
          let gx = 0, gy = 0, near = false;
          for (const { b, i } of heavy) {
            const dx = s.y[4 * i]! - x, dy = s.y[4 * i + 1]! - y;
            const r2 = dx * dx + dy * dy;
            if (r2 < (0.07 * R) ** 2) near = true;
            const inv = (GU * b.m) / (r2 * Math.sqrt(r2) + 1e-30);
            gx += inv * dx;
            gy += inv * dy;
          }
          if (near) continue;
          const g = Math.hypot(gx, gy);
          const alpha = clamp(0.35 + 0.25 * Math.log10(g / gref), 0.12, 0.85);
          d.arrowPx(x, y, gx, gy, 13, { color: theme.muted, width: 1.2, head: 5, alpha });
        }
      }
    }

    // Órbitas de referência (Hohmann)
    if (m === 3) {
      const h = hohmann(p);
      d.circle(0, 0, h.r1, { stroke: theme.series[0], width: 1, dash: [4, 4], alpha: 0.7 });
      d.circle(0, 0, h.r2, { stroke: theme.series[1], width: 1, dash: [4, 4], alpha: 0.7 });
      const te = s.t * h.n1, tm = Math.PI - h.n2 * h.tH + h.n2 * s.t;
      d.dot(h.r1 * Math.cos(te), h.r1 * Math.sin(te), 5, theme.series[0]!);
      d.text("Terra", h.r1 * Math.cos(te), h.r1 * Math.sin(te), { dy: -11, size: 11, color: theme.series[0] });
      const mx = h.r2 * Math.cos(tm), my = h.r2 * Math.sin(tm);
      d.rect(mx - 5 * d.px, my - 5 * d.px, 10 * d.px, 10 * d.px, { fill: theme.series[1] });
      d.text("destino", mx, my, { dy: 14, size: 11, color: theme.series[1] });
    }

    // Setores da 2ª lei
    const sd = m === 0 ? sectorDt(p) : 0;
    if (sd > 0 && trail.length > 1) {
      const groups = new Map<number, [number, number][]>();
      const anchor = new Map<number, [number, number]>();
      for (const st of trail) {
        const k = Math.floor(st.t / sd + 1e-9);
        if (k >= N_SECT || k % 2 !== 0) continue;
        const r = rel(st.y, 1);
        if (!groups.has(k)) {
          groups.set(k, []);
          anchor.set(k, [st.y[0]!, st.y[1]!]);
        }
        groups.get(k)!.push([r.x, r.y]);
      }
      const sx = s.y[0]!, sy = s.y[1]!;
      for (const [k, pts] of groups) {
        if (pts.length < 2) continue;
        const poly: [number, number][] = [[sx, sy], ...pts.map(([x, y]) => [sx + x, sy + y] as [number, number])];
        const c = theme.series[(k / 2) % 2 === 0 ? 2 : 4]!;
        d.polyline(poly, { close: true, fill: c, color: "none", alpha: 0.3 });
        const mid = pts[Math.floor(pts.length / 2)]!;
        if (s.areas[k]! > 0 && (s.t >= (k + 1) * sd || s.t >= N_SECT * sd))
          d.text(`${fmt(s.areas[k]!)} UA²`, sx + mid[0] * 0.6, sy + mid[1] * 0.6, { size: 10, color: theme.text });
      }
    }

    // Rastros
    bs.forEach((b, i) => {
      if (b.m === 0) return;
      const step = Math.max(1, Math.ceil(trail.length / 2500));
      const pts: [number, number][] = [];
      for (let k = 0; k < trail.length; k += step) pts.push([trail[k]!.y[4 * i]!, trail[k]!.y[4 * i + 1]!]);
      pts.push([s.y[4 * i]!, s.y[4 * i + 1]!]);
      d.polyline(pts, { color: col(b), width: 1.3, alpha: 0.75 });
    });

    // Corpos e velocidades
    const Mt = bs.reduce((a, b) => a + b.m, 0);
    bs.forEach((b, i) => {
      const x = s.y[4 * i]!, y = s.y[4 * i + 1]!;
      const rPx = clamp(4 + 4 * Math.log10(1 + (1e3 * b.m) / Mt), 3, 11);
      d.dot(x, y, rPx, col(b));
      const vx = s.y[4 * i + 2]!, vy = s.y[4 * i + 3]!;
      const v = Math.hypot(vx, vy);
      if (b.m < 0.5 * Mt && v > 1e-6) d.arrowPx(x, y, vx, vy, clamp(v * KMS * 1.2, 8, 60), { color: theme.accent, width: 1.5, head: 6 });
      if (m === 4 || m === 1 || i <= 1 || m === 2) d.text(b.name, x, y, { dy: -rPx - 8, size: 11, color: col(b) });
    });

    // Legenda
    const lx = 1.05 * R;
    let ly = 0.92 * R;
    const line = (str: string, c = theme.text, weight = "400") => {
      d.text(str, lx, ly, { align: "left", size: 11, color: c, weight });
      ly -= 17 * d.px;
    };
    line(`t = ${fmt(s.t, 3)} anos`, theme.text, "600");
    if (m !== 4 && m !== 2) {
      const o = orbitOf(s.y, p, 1);
      line(`r = ${fmt(o.d)} UA`);
      line(`v = ${fmt(o.v * KMS)} km/s`, theme.accent);
      line(Number.isFinite(o.a) ? `a = ${fmt(o.a)} UA, e = ${fmt(o.e, 2)}` : "órbita aberta (E ≥ 0)", Number.isFinite(o.a) ? theme.text : theme.positive);
      if (s.Tm[1]! > 0 && m !== 3) line(`T medido = ${fmt(s.Tm[1]!)} anos`);
      if (m === 3) line(s.burn === 2 ? "2º impulso aplicado" : "em trânsito", theme.muted);
    }
    if (m === 0 && sd > 0) line("setores: intervalos iguais de T/12", theme.muted);
    if (num(p, "campo", 1) > 0.5) line("setas cinzas: direção de g", theme.muted);

    // Quadro T² × a³ (planetas)
    if (m === 4) {
      const x0 = 1.12 * R, y0 = -0.85 * R, W = 0.82 * R, H = 0.95 * R;
      const amax = 1.6 ** 3, Tmax = amax / num(p, "M", 1);
      d.rect(x0, y0, W, H, { stroke: theme.grid, width: 1 });
      d.line(x0, y0, x0 + W, y0 + Math.min(H, (H * (amax / num(p, "M", 1))) / Tmax), { color: theme.muted, dash: [4, 3] });
      d.text("a³ (UA³)", x0 + W / 2, y0, { dy: 12, size: 10, color: theme.muted });
      d.text("T² (ano²)", x0, y0 + H, { dy: -9, size: 10, color: theme.muted, align: "left" });
      d.text("T² = a³/M", x0 + W, y0 + H, { dy: -9, size: 10, color: theme.muted, align: "right" });
      bs.forEach((b, i) => {
        if (i === 0 || !(s.Tm[i]! > 0)) return;
        const a = orbitOf(s.y, p, i).a;
        if (!Number.isFinite(a)) return;
        const px = x0 + (W * a ** 3) / amax, py = y0 + (H * s.Tm[i]! ** 2) / Tmax;
        if (px <= x0 + W && py <= y0 + H) d.dot(px, py, 4, col(b));
      });
    }
  },
});

export default orbitasKepler;
