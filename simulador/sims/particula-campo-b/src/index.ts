import { defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  BOTTLE,
  CYC,
  ISOTOPES,
  QE,
  SEL,
  SPEC,
  SPECIES,
  borisStep,
  bottleField,
  bottleMirror,
  cyclotronKmax,
  cyclotronPeriod,
  ionMass,
  larmorRadius,
  type Fields,
  type Particle,
  type V3,
} from "./physics.ts";

export * from "./physics.ts";

export interface PState {
  ps: Particle[];
  /** Tempo físico (s). O relógio do app mostra tempo de animação (câmera lenta). */
  tau: number;
}

export const MODOS = [
  "Campo B uniforme (órbita circular)",
  "Campos E e B cruzados (deriva E×B)",
  "Seletor de velocidades",
  "Espectrômetro de massa",
  "Ciclotron",
  "Garrafa magnética",
];

/** Fatores de velocidade lançados no seletor (o primeiro é a partícula de referência). */
export const SEL_FACTORS = [1, 0.8, 0.9, 0.95, 1.05, 1.1, 1.2];
export const SPEC_FACTORS = [1, 0.92, 1.08];
/** Número de períodos de cíclotron mostrados na deriva E×B. */
const EXB_TURNS = 4;

const modo = (p: Params) => Math.round(num(p, "modo"));
export const species = (p: Params) => SPECIES[Math.round(num(p, "particula"))] ?? SPECIES[0]!;
const isoSet = (p: Params) => ISOTOPES[Math.round(num(p, "isotopos"))] ?? ISOTOPES[0]!;
const Bp = (p: Params) => Math.max(num(p, "B", 0.1), 1e-6);
const Ep = (p: Params) => num(p, "E", 1e5);
const v0p = (p: Params) => num(p, "v0", 1e6);
const B2p = (p: Params) => Math.max(num(p, "B2", 0.1), 1e-6);
const Vgap = (p: Params) => num(p, "Vgap", 50) * 1e3;

function mk(x: number, y: number, z: number, vx: number, vy: number, vz: number, m: number, q: number, tag: number, vf = 1): Particle {
  return { x, y, z, vx, vy, vz, m, q, tag, vf, alive: true, hit: false, hx: 0, hy: 0 };
}

/** Campos E e B no ponto, no instante físico τ. */
export function fieldsAt(p: Params, x: number, y: number, z: number, tau: number): Fields {
  const B = Bp(p);
  const zero: V3 = [0, 0, 0];
  switch (modo(p)) {
    case 1:
      return { E: [0, Ep(p), 0], B: [0, 0, B] };
    case 2:
      return x >= 0 && x <= SEL.L && Math.abs(y) < SEL.h ? { E: [0, Ep(p), 0], B: [0, 0, B] } : { E: zero, B: zero };
    case 3:
      if (y >= -SPEC.L && y < 0 && Math.abs(x) < SPEC.h) return { E: [-Ep(p), 0, 0], B: [0, 0, B] };
      return y > 0 ? { E: zero, B: [0, 0, B2p(p)] } : { E: zero, B: zero };
    case 4: {
      if (Math.hypot(x, y) > CYC.R) return { E: zero, B: zero };
      const sp = species(p);
      const w = num(p, "fRF", 1) * ((Math.abs(sp.q) * B) / sp.m);
      const Ex = Math.abs(x) < CYC.gap / 2 ? (Vgap(p) / CYC.gap) * Math.cos(w * tau) : 0;
      return { E: [Ex, 0, 0], B: [0, 0, B] };
    }
    case 5:
      return { E: zero, B: bottleField(B, x, y, z) };
    default:
      return { E: zero, B: [0, 0, B] };
  }
}

/** Potencial eletrostático (V) dos modos com campo E estático, para a energia mecânica. */
function potential(p: Params, x: number, y: number): number {
  switch (modo(p)) {
    case 1:
      return -Ep(p) * y;
    case 2:
      return x >= 0 && x <= SEL.L ? -Ep(p) * y : 0;
    case 3:
      return y >= -SPEC.L && y < 0 ? Ep(p) * x : 0;
    default:
      return 0;
  }
}

/** Período de cíclotron da partícula principal (ou do íon mais leve). */
function refPeriod(p: Params): number {
  const m = modo(p);
  if (m === 3) return cyclotronPeriod(ionMass(isoSet(p).A[0]!), QE, B2p(p));
  const sp = species(p);
  return cyclotronPeriod(sp.m, sp.q, Bp(p));
}

/** Tempo físico por segundo de animação (câmera lenta). */
export function tauRate(p: Params): number {
  const Tc = refPeriod(p);
  switch (modo(p)) {
    case 1:
      return Tc / 1.5;
    case 2:
      return (SEL.screen - SEL.x0) / Math.max(v0p(p), 1e3) / 3;
    case 3: {
      const r = Math.max(...isoSet(p).A.map((A) => larmorRadius(ionMass(A), v0p(p), QE, B2p(p))));
      return (SPEC.L + Math.PI * r) / Math.max(v0p(p), 1e3) / 4;
    }
    case 4:
      return Tc / 0.5;
    case 5:
      return Tc / 0.25;
    default:
      return Tc / 1.5;
  }
}

/** Maior campo B que a partícula pode encontrar (para escolher o subpasso). */
function bMax(p: Params): number {
  const m = modo(p);
  if (m === 3) return Math.max(Bp(p), B2p(p));
  if (m === 5) return Bp(p) * bottleMirror().ratio * 1.2;
  return Bp(p);
}

export const particleRadius = (p: Params) => {
  const sp = species(p);
  return larmorRadius(sp.m, v0p(p), sp.q, Bp(p));
};

function initState(p: Params): PState {
  const sp = species(p);
  const v0 = v0p(p);
  switch (modo(p)) {
    case 2:
      return { tau: 0, ps: SEL_FACTORS.map((f, i) => mk(SEL.x0, 0, 0, f * v0, 0, 0, sp.m, sp.q, i, f)) };
    case 3: {
      const iso = isoSet(p);
      const ps: Particle[] = [];
      SPEC_FACTORS.forEach((f) => iso.A.forEach((A, i) => ps.push(mk(0, SPEC.y0, 0, 0, f * v0, 0, ionMass(A), QE, i, f))));
      return { tau: 0, ps };
    }
    case 4:
      return { tau: 0, ps: [mk(0, 0, 0, 0, 0, 0, sp.m, sp.q, 0)] };
    case 5: {
      const a = (num(p, "pitch", 50) * Math.PI) / 180;
      return { tau: 0, ps: [mk(0.1, 0, 0, 0, v0 * Math.sin(a), v0 * Math.cos(a), sp.m, sp.q, 0)] };
    }
    default:
      return { tau: 0, ps: [mk(0, 0, 0, v0, 0, 0, sp.m, sp.q, 0)] };
  }
}

function stepState(s: PState, p: Params, dt: number): PState {
  const H = tauRate(p) * dt;
  const mode = modo(p);
  const ps = s.ps.map((q) => ({ ...q }));
  const Bm = bMax(p);
  for (const q of ps) {
    if (!q.alive || q.hit) continue;
    const Tc = cyclotronPeriod(q.m, q.q, Bm);
    const n = Math.min(4000, Math.max(1, Math.ceil(H / (Tc / 80))));
    const h = H / n;
    for (let j = 0; j < n && q.alive && !q.hit; j++) {
      const tm = s.tau + (j + 0.5) * h;
      const px = q.x;
      const py = q.y;
      borisStep(q, (x, y, z) => fieldsAt(p, x, y, z, tm), h);
      if (mode === 2) {
        const wall = SEL.L + 0.02;
        if (q.x >= 0 && q.x <= SEL.L && Math.abs(q.y) >= SEL.h) q.alive = false;
        else if (px < wall && q.x >= wall && Math.abs(q.y) > SEL.slit) {
          q.alive = false;
          q.x = wall;
        } else if (q.x >= SEL.screen) {
          q.hit = true;
          q.hy = py + ((q.y - py) * (SEL.screen - px)) / (q.x - px);
          q.hx = SEL.screen;
          q.x = SEL.screen;
          q.y = q.hy;
        }
      } else if (mode === 3) {
        if (q.y >= -SPEC.L && q.y <= 0 && py <= 0 && Math.abs(q.x) >= SPEC.h) q.alive = false;
        else if (py <= 0 && q.y > 0 && Math.abs(q.x) > SPEC.slit) {
          q.alive = false;
          q.y = 0;
        } else if (py > 0 && q.y <= 0) {
          q.hit = true;
          q.hx = px + ((q.x - px) * py) / (py - q.y);
          q.hy = 0;
          q.x = q.hx;
          q.y = 0;
        }
      }
    }
  }
  return { ps, tau: s.tau + H };
}

const P0 = (s: PState) => s.ps[0]!;
const speed = (q: Particle) => Math.hypot(q.vx, q.vy, q.vz);
const kinetic = (q: Particle) => 0.5 * q.m * speed(q) ** 2;

/** Componentes de v paralela e perpendicular ao campo local. */
function vParPerp(s: PState, p: Params): { par: number; perp: number; B: number } {
  const q = P0(s);
  const { B } = fieldsAt(p, q.x, q.y, q.z, s.tau);
  const b = Math.hypot(B[0], B[1], B[2]);
  const v = speed(q);
  if (b < 1e-15) return { par: v, perp: 0, B: 0 };
  const par = (q.vx * B[0] + q.vy * B[1] + q.vz * B[2]) / b;
  return { par, perp: Math.sqrt(Math.max(0, v * v - par * par)), B: b };
}

const fmtBR = (v: number, d = 3) => texNum(v, d).replace(/\{,\}/g, ",").replace(/ \\times 10\^\{(-?\d+)\}/, "e$1");

export const particulaCampoB = defineSim<PState>({
  id: "particula-campo-b",
  title: "Partícula em campo B: ciclotron e espectrômetro de massa",
  course: "FG III",
  topic: "Magnetismo",
  priority: "P1",
  summary:
    "Força de Lorentz integrada pelo método de Boris: órbita circular r = mv/|q|B, deriva E×B, seletor de velocidades, espectrômetro separando isótopos, ciclotron ganhando energia no vão e garrafa magnética. Tempo físico em câmera lenta.",
  equations: [
    String.raw`\vec F = q\left(\vec E + \vec v\times\vec B\right) \qquad r = \frac{m v_\perp}{|q|B} \qquad \omega_c = \frac{|q|B}{m}`,
    String.raw`\vec v_d = \frac{\vec E\times\vec B}{B^2} \qquad \text{seletor: } v = \frac{E}{B} \qquad \text{espectrômetro: } x = 2r = \frac{2mv}{qB'}`,
    String.raw`\text{ciclotron: } f = \frac{|q|B}{2\pi m},\ K_{\max} = \frac{q^2B^2R^2}{2m} \qquad \text{garrafa: } \mu = \frac{m v_\perp^2}{2B} \approx \text{cte},\ \mathrm{sen}^2\alpha_c = \frac{B_{\min}}{B_{\max}}`,
  ],
  liveEquations(s, p) {
    const sp = species(p);
    const B = Bp(p);
    const q = P0(s);
    switch (modo(p)) {
      case 1: {
        const vd = Ep(p) / B;
        return [String.raw`v_d = \frac{E}{B} = \frac{${texNum(Ep(p))}\ \text{V/m}}{${texNum(B)}\ \text{T}} = ${texNum(vd)}\ \text{m/s} \qquad v_0 = ${texNum(v0p(p))}\ \text{m/s}`];
      }
      case 2:
        return [String.raw`v_{\text{passa}} = \frac{E}{B} = ${texNum(Ep(p) / B)}\ \text{m/s} \qquad v_0 = ${texNum(v0p(p))}\ \text{m/s}`];
      case 3: {
        const iso = isoSet(p);
        const v = Ep(p) / B;
        const xs = iso.A.map((A) => 2 * larmorRadius(ionMass(A), v, QE, B2p(p)));
        return [
          String.raw`v = E/B = ${texNum(v)}\ \text{m/s} \qquad x_i = \frac{2 m_i v}{e B'}: ` + xs.map((x) => String.raw`${texNum(x * 100)}\ \text{cm}`).join(",\\ "),
        ];
      }
      case 4: {
        const f = (Math.abs(sp.q) * B) / (2 * Math.PI * sp.m);
        const Kmax = cyclotronKmax(sp.m, sp.q, B);
        return [
          String.raw`f_c = \frac{|q|B}{2\pi m} = ${texNum(f / 1e6)}\ \text{MHz} \qquad K_{\max} = \frac{q^2B^2R^2}{2m} = ${texNum(Kmax / QE / 1e6)}\ \text{MeV}`,
          String.raw`K = ${texNum(kinetic(q) / QE / 1e3)}\ \text{keV} \qquad \text{voltas} \approx \frac{K_{\max}}{2|q|V} = ${texNum(Kmax / (2 * Math.abs(sp.q) * Vgap(p)))}`,
        ];
      }
      case 5: {
        const { ratio, lossCone } = bottleMirror();
        const { perp, B: b } = vParPerp(s, p);
        return [
          String.raw`R_m = \frac{B_{\max}}{B_{\min}} = ${texNum(ratio)} \qquad \alpha_c = \arcsen\sqrt{1/R_m} = ${texNum(lossCone)}^\circ \qquad \alpha_0 = ${texNum(num(p, "pitch", 50))}^\circ`,
          String.raw`\mu = \frac{m v_\perp^2}{2B} = ${texNum(b > 0 ? (q.m * perp * perp) / (2 * b) : 0)}\ \text{J/T}`,
        ];
      }
      default: {
        const r = particleRadius(p);
        return [
          String.raw`r = \frac{mv}{|q|B} = \frac{${texNum(sp.m)}\ \text{kg}\cdot ${texNum(v0p(p))}\ \text{m/s}}{${texNum(Math.abs(sp.q))}\ \text{C}\cdot ${texNum(B)}\ \text{T}} = ${texNum(r)}\ \text{m}`,
          String.raw`T = \frac{2\pi m}{|q|B} = ${texNum(cyclotronPeriod(sp.m, sp.q, B))}\ \text{s} \qquad |\vec v| = ${texNum(speed(q))}\ \text{m/s}`,
        ];
      }
    }
  },

  params: [
    { key: "modo", label: "Situação", unit: "", min: 0, max: 5, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "particula", label: "Partícula", unit: "", min: 0, max: 4, step: 1, default: 0, options: SPECIES.map((s, value) => ({ value, label: s.nome })) },
    { key: "B", label: "Campo magnético B", unit: "T", min: 0.01, max: 2, step: 0.01, default: 0.1, live: true },
    { key: "v0", label: "Velocidade inicial v₀", unit: "m/s", min: 0, max: 1e7, step: 1e4, default: 1e6 },
    { key: "E", label: "Campo elétrico E", unit: "V/m", min: 0, max: 1e6, step: 1e3, default: 1e5, live: true },
    { key: "isotopos", label: "Isótopos (espectrômetro)", unit: "", min: 0, max: 3, step: 1, default: 0, options: ISOTOPES.map((s, value) => ({ value, label: s.nome })) },
    { key: "B2", label: "Campo B′ do espectrômetro", unit: "T", min: 0.01, max: 1, step: 0.01, default: 0.1, live: true },
    { key: "Vgap", label: "Tensão no vão do ciclotron", unit: "kV", min: 1, max: 100, step: 1, default: 50, live: true },
    { key: "fRF", label: "Frequência do oscilador / f_c", unit: "", min: 0.9, max: 1.1, step: 0.005, default: 1, live: true },
    { key: "pitch", label: "Ângulo entre v e B (garrafa)", unit: "°", min: 5, max: 85, step: 1, default: 50 },
  ],

  observables: [
    { key: "x", label: "Posição x", unit: "m", value: (s) => P0(s).x },
    { key: "y", label: "Posição y", unit: "m", value: (s) => P0(s).y },
    { key: "z", label: "Posição z (eixo da garrafa)", unit: "m", value: (s) => P0(s).z },
    { key: "v", label: "Velocidade |v|", unit: "m/s", value: (s) => speed(P0(s)) },
    { key: "K", label: "Energia cinética", unit: "eV", value: (s) => kinetic(P0(s)) / QE },
    { key: "Em", label: "Energia mecânica K + qV", unit: "eV", value: (s, p) => (kinetic(P0(s)) + P0(s).q * potential(p, P0(s).x, P0(s).y)) / QE },
    {
      key: "r",
      label: "Raio de curvatura mv⊥/|q|B",
      unit: "m",
      value: (s, p) => {
        const { perp, B } = vParPerp(s, p);
        return B > 0 ? (P0(s).m * perp) / (Math.abs(P0(s).q) * B) : 0;
      },
    },
    {
      key: "pitch",
      label: "Ângulo entre v e B",
      unit: "°",
      value: (s, p) => {
        const { par, perp, B } = vParPerp(s, p);
        return B > 0 && par * par + perp * perp > 0 ? (Math.atan2(perp, par) * 180) / Math.PI : 0;
      },
    },
    {
      key: "mu",
      label: "Momento magnético μ = mv⊥²/2B",
      unit: "J/T",
      value: (s, p) => {
        const { perp, B } = vParPerp(s, p);
        return B > 0 ? (P0(s).m * perp * perp) / (2 * B) : 0;
      },
    },
    { key: "xImpacto", label: "Impacto no detector (íon 1)", unit: "m", value: (s, p) => (P0(s).hit ? (modo(p) === 2 ? P0(s).hy : P0(s).hx) : 0) },
    { key: "tau", label: "Tempo físico τ", unit: "s", value: (s) => s.tau },
  ],
  conserved: "Em",
  chart: { x: "x", y: "y" },

  scenarios: [
    {
      id: "circular",
      label: "Órbita circular",
      params: { modo: 0, particula: 0, B: 0.1, v0: 1e6 },
      guide: `### Raio da órbita
1. Rode e meça o raio no palco. Compare com $r = \\dfrac{mv}{|q|B}$ (equação viva).
2. Dobre $B$ durante o movimento: o raio cai à metade, mas $|\\vec v|$ não muda. A força magnética é sempre perpendicular a $\\vec v$ e **não realiza trabalho** (veja a energia conservada).
3. Troque próton por **elétron** e por **pósitron**: o sentido de giro depende do sinal de $q$; o raio, de $m/|q|$.
4. O período $T = 2\\pi m/|q|B$ não depende de $v$: é isso que faz o ciclotron funcionar.`,
      predict: [
        {
          question: "Se a velocidade do próton dobrar (mesmo B), o período da órbita:",
          options: ["dobra", "cai à metade", "não muda"],
          answer: 2,
          explanation: "O raio dobra ($r \\propto v$), mas a circunferência a percorrer também: $T = 2\\pi r/v = 2\\pi m/|q|B$ não depende de $v$.",
        },
      ],
    },
    {
      id: "exb",
      label: "Deriva E×B",
      params: { modo: 1, particula: 0, B: 0.1, E: 1e5, v0: 0 },
      guide: `### Campos cruzados
1. O próton parte do repouso: $\\vec E$ o acelera, $\\vec B$ o curva, e ele descreve uma **cicloide** que avança na direção $\\vec E\\times\\vec B$.
2. A velocidade média é $v_d = E/B$, **independente** de $q$ e de $m$. Troque para elétron: a cicloide fica minúscula e invertida, mas avança para o mesmo lado!
3. Ponha $v_0 = E/B$: a partícula segue em linha reta. Esse é o princípio do seletor de velocidades.`,
      predict: [
        {
          question: "Um elétron solto em repouso nos mesmos campos E e B deriva:",
          options: ["no mesmo sentido do próton", "no sentido oposto ao do próton", "não deriva"],
          answer: 0,
          explanation: "$\\vec v_d = \\vec E\\times\\vec B/B^2$ não contém $q$: trocar o sinal da carga inverte tanto o efeito de $\\vec E$ quanto o de $\\vec B$.",
        },
      ],
    },
    {
      id: "seletor",
      label: "Seletor de velocidades",
      params: { modo: 2, particula: 0, B: 0.1, E: 1e5, v0: 1e6 },
      guide: `### Só passa quem tem v = E/B
1. Sete prótons saem com velocidades de $0{,}8\\,v_0$ a $1{,}2\\,v_0$. Na região entre as placas, $q\\vec E$ e $q\\vec v\\times\\vec B$ têm sentidos opostos.
2. Só o próton com $v = E/B$ sente força nula e atravessa a fenda.
3. Mude $E$ (ao vivo) para selecionar outra velocidade. Os lentos são desviados pelo campo elétrico; os rápidos, pelo magnético.`,
    },
    {
      id: "espectrometro",
      label: "Espectrômetro de massa",
      params: { modo: 3, isotopos: 0, B: 0.1, E: 1e4, v0: 1e5, B2: 0.1 },
      guide: `### Separando isótopos
1. Íons $^{20}$Ne$^+$ e $^{22}$Ne$^+$ passam pelo seletor (só $v = E/B$ segue) e entram no campo $B'$.
2. Todos têm a mesma carga e a mesma velocidade: o raio $r = mv/eB'$ é proporcional à massa.
3. O impacto no detector fica em $x = 2r$. Confira as posições com a equação viva e calcule $\\Delta x$.
4. Experimente urânio-235 e 238: a separação relativa é só 1,3% — por isso o enriquecimento é tão difícil.`,
      predict: [
        {
          question: "Com a mesma velocidade e carga, onde cai o ²²Ne⁺ em relação ao ²⁰Ne⁺?",
          options: ["mais perto da fenda", "mais longe da fenda (cerca de 10% a mais)", "no mesmo ponto"],
          answer: 1,
          explanation: "$x = 2mv/eB'$ é proporcional à massa: $22/20 = 1{,}1$, ou seja, 10% mais longe.",
        },
      ],
    },
    {
      id: "ciclotron",
      label: "Ciclotron",
      params: { modo: 4, particula: 0, B: 0.5, Vgap: 50, fRF: 1 },
      guide: `### Acelerando em espiral
1. A tensão no vão entre os "dês" alterna com a frequência de cíclotron $f_c = |q|B/2\\pi m$. A cada passagem pelo vão o próton ganha cerca de $qV$.
2. Dentro dos dês só há $\\vec B$: a partícula descreve meias-voltas de raio crescente, todas com a mesma duração $T/2$.
3. A energia final $K_{\\max} = q^2B^2R^2/2m$ não depende de $V$; um $V$ maior só reduz o número de voltas.
4. Mude a razão $f/f_c$ para 0,97: a fase escorrega, e a partícula passa a ser freada. Aqui a energia **não** se conserva — o campo varia no tempo.`,
    },
    {
      id: "garrafa",
      label: "Garrafa magnética",
      params: { modo: 5, particula: 0, B: 0.5, v0: 1e6, pitch: 50 },
      guide: `### Espelhos magnéticos
1. Duas espiras criam um campo mais fraco no centro e mais forte nas pontas. A partícula gira em hélice ao longo das linhas.
2. O momento magnético $\\mu = mv_\\perp^2/2B$ quase se conserva; como $|\\vec v|$ é constante, $v_\\parallel$ zera onde $B$ é grande o bastante: a partícula é **refletida**.
3. Só escapa quem tem ângulo inicial menor que o do **cone de perda**: $\\mathrm{sen}^2\\alpha_c = B_{\\min}/B_{\\max}$. Teste $\\alpha = 25°$ e $\\alpha = 40°$.
4. É o mesmo mecanismo que aprisiona prótons e elétrons nos cinturões de Van Allen.`,
    },
  ],

  exercises: [
    {
      id: "raio",
      prompt: "Um próton com velocidade de {v0} m/s entra perpendicularmente num campo magnético uniforme de {B} T. Qual é o raio da órbita, em centímetros?",
      vary: { v0: [200000, 5000000, -4], B: [0.05, 1.5, 2] },
      fixed: { modo: 0, particula: 0 },
      answer: { label: "r", unit: "cm", compute: (p) => (larmorRadius(SPECIES[0]!.m, num(p, "v0"), QE, num(p, "B")) * 100) },
      hint: "r = mv/(|q|B), com m = 1,673 × 10⁻²⁷ kg e q = 1,602 × 10⁻¹⁹ C.",
    },
    {
      id: "espectrometro",
      prompt:
        "Num espectrômetro de massa, íons de carga +e passam por um seletor com E = {E} V/m e B = {B} T e entram num campo B′ = {B2} T. Qual é a distância, em centímetros, entre os pontos de impacto de ²⁰Ne⁺ e ²²Ne⁺ (massas 19,99 u e 21,99 u)?",
      vary: { E: [5000, 30000, -3], B: [0.05, 0.2, 2], B2: [0.05, 0.3, 2] },
      fixed: { modo: 3, isotopos: 0 },
      answer: {
        label: "Δx",
        unit: "cm",
        compute: (p) => {
          const v = num(p, "E") / num(p, "B");
          return ((2 * v * (ionMass(21.9914) - ionMass(19.9924))) / (QE * num(p, "B2"))) * 100;
        },
      },
      hint: "v = E/B; x = 2mv/(eB′); Δx = 2Δm·v/(eB′), com 1 u = 1,6605 × 10⁻²⁷ kg.",
    },
  ],

  init: initState,
  step: (s, p, _t, dt) => stepState(s, p, dt),
  dt: 1e-3,
  sampleEvery: 5,
  tEnd: 600,
  stopWhen(s, p) {
    const m = modo(p);
    const q = P0(s);
    if (m === 1) return EXB_TURNS * refPeriod(p) - s.tau;
    if (m === 2 || m === 3) return s.ps.some((x) => x.alive && !x.hit) ? 1 : 0;
    if (m === 4) return Math.min(CYC.R + 0.02 - Math.hypot(q.x, q.y), 300 * refPeriod(p) - s.tau);
    if (m === 5) return 1.45 - Math.abs(q.z);
    return 1;
  },

  viewport(p) {
    const m = modo(p);
    const sp = species(p);
    if (m === 1) {
      const B = Bp(p);
      const vd = Ep(p) / B;
      const rho = larmorRadius(sp.m, Math.abs(v0p(p) - vd), sp.q, B);
      const Ld = EXB_TURNS * 2 * Math.PI * larmorRadius(sp.m, vd, sp.q, B);
      const r = Math.max(rho, Ld / 14, 1e-9);
      return { xMin: -1.5 * r, xMax: Ld + 1.5 * r, yMin: -2.6 * r, yMax: 2.6 * r, unit: "m" };
    }
    if (m === 2) return { xMin: -0.08, xMax: 0.5, yMin: -0.1, yMax: 0.1, unit: "m" };
    if (m === 3) {
      const r = Math.max(...isoSet(p).A.map((A) => larmorRadius(ionMass(A), Ep(p) / Bp(p), QE, B2p(p))));
      return { xMin: -0.12, xMax: Math.max(2 * r * 1.12 + 0.05, 0.3), yMin: SPEC.y0 - 0.04, yMax: Math.max(r * 1.15 + 0.03, 0.1), unit: "m" };
    }
    if (m === 4) return { xMin: -CYC.R - 0.06, xMax: CYC.R + 0.06, yMin: -CYC.R - 0.06, yMax: CYC.R + 0.06, unit: "m" };
    if (m === 5) return { xMin: -1.5, xMax: 1.5, yMin: -0.85, yMax: 0.85, unit: "m" };
    const r = Math.max(particleRadius(p), 1e-9);
    const cy = -Math.sign(sp.q) * r;
    return { xMin: -1.7 * r, xMax: 1.7 * r, yMin: cy - 1.45 * r, yMax: cy + 1.45 * r, unit: "m" };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = modo(p);
    const vp = particulaCampoB.viewport(p, s);
    if (m === 0 || m === 1) drawBDots(d, vp, Bp(p), 1);
    if (m === 0) {
      const sp = species(p);
      const r = particleRadius(p);
      const cy = -Math.sign(sp.q) * r;
      d.circle(0, cy, r, { stroke: theme.muted, width: 1, dash: [5, 4] });
      d.dot(0, cy, 3, theme.muted);
      d.line(0, cy, r * Math.cos(-0.6), cy + r * Math.sin(-0.6), { color: theme.muted, width: 1 });
      d.text(`r = mv/|q|B = ${fmtBR(r)} m`, 0, cy - 0.2 * r, { color: theme.muted, size: 11, dy: 12 });
    }
    if (m === 1) {
      const vd = Ep(p) / Bp(p);
      const h = (vp.yMax - vp.yMin) / 2;
      for (let i = 0; i < 5; i++) {
        const x = vp.xMin + ((i + 0.5) * (vp.xMax - vp.xMin)) / 5;
        d.arrowPx(x, -0.9 * h, 0, 1, 26, { color: theme.series[3] ?? theme.accent, width: 1.5, alpha: 0.6 });
      }
      d.text("E", vp.xMin + (0.5 * (vp.xMax - vp.xMin)) / 5, -0.9 * h, { color: theme.series[3] ?? theme.accent, size: 12, weight: "600", dx: 10, dy: -14 });
      d.text(`deriva v_d = E/B = ${fmtBR(vd)} m/s →`, vp.xMax, vp.yMax, { color: theme.text, size: 12, align: "right", baseline: "top", dx: -6, dy: 4 });
    }
    if (m === 2) drawSelector(d, p);
    if (m === 3) drawSpectrometer(d, s, p, vp);
    if (m === 4) drawCyclotron(d, p, s);
    if (m === 5) drawBottle(d, p);

    // Rastros
    const proj = (q: Particle): [number, number] => (m === 5 ? [q.z, q.x] : [q.x, q.y]);
    const n = s.ps.length;
    const trail = frame.trail.length > 8000 ? frame.trail.slice(-8000) : frame.trail;
    for (let i = 0; i < n; i++) {
      const pts: [number, number][] = [];
      for (const st of trail) {
        const q = st.ps[i];
        if (q) pts.push(proj(q));
      }
      const q = s.ps[i]!;
      pts.push(proj(q));
      const color = theme.series[q.tag % theme.series.length] ?? theme.accent;
      d.polyline(pts, { color, width: 1.5, alpha: q.alive ? 0.85 : 0.35 });
    }
    for (const q of s.ps) {
      const [x, y] = proj(q);
      const color = theme.series[q.tag % theme.series.length] ?? theme.accent;
      d.dot(x, y, 6, q.alive ? color : theme.muted, q.alive ? 1 : 0.5);
      d.text(q.q > 0 ? "+" : "−", x, y, { color: "#ffffff", size: 10, weight: "700" });
    }
    // Vetores da partícula principal
    const q = P0(s);
    if (q.alive && !q.hit && m !== 3 && m !== 2) {
      const [x, y] = proj(q);
      const v = speed(q);
      const f = fieldsAt(p, q.x, q.y, q.z, s.tau);
      const F: V3 = [
        q.q * (f.E[0] + q.vy * f.B[2] - q.vz * f.B[1]),
        q.q * (f.E[1] + q.vz * f.B[0] - q.vx * f.B[2]),
        q.q * (f.E[2] + q.vx * f.B[1] - q.vy * f.B[0]),
      ];
      // Normaliza: forças de 10⁻¹⁴ N seriam "nulas" para o desenho de setas.
      const unit = (a: number, b: number): [number, number] => {
        const n = Math.hypot(a, b);
        return n > 0 ? [a / n, b / n] : [0, 0];
      };
      const vv = m === 5 ? unit(q.vz, q.vx) : unit(q.vx, q.vy);
      const FF = m === 5 ? unit(F[2], F[0]) : unit(F[0], F[1]);
      if (v > 0 && Math.hypot(...vv) > 0) {
        d.arrowPx(x, y, vv[0], vv[1], 44, { color: theme.accent, width: 2 });
        d.text("v", x + (vv[0] / Math.hypot(...vv)) * 52 * d.px, y + (vv[1] / Math.hypot(...vv)) * 52 * d.px, { color: theme.accent, size: 12, weight: "600" });
      }
      if (Math.hypot(...FF) > 0) {
        d.arrowPx(x, y, FF[0], FF[1], 34, { color: theme.positive, width: 2 });
        d.text("F", x + (FF[0] / Math.hypot(...FF)) * 42 * d.px, y + (FF[1] / Math.hypot(...FF)) * 42 * d.px, { color: theme.positive, size: 12, weight: "600" });
      }
    }
    d.text(`τ = ${fmtBR(s.tau)} s (câmera lenta)`, vp.xMin, vp.yMin, { color: theme.muted, size: 11, align: "left", baseline: "bottom", dx: 4, dy: -4 });
  },
});

export default particulaCampoB;

// ---------------------------------------------------------------- desenho

/** Símbolos de B saindo (⊙) ou entrando (⊗) do plano. */
function drawBDots(d: Draw, vp: { xMin: number; xMax: number; yMin: number; yMax: number }, B: number, alpha: number, region?: (x: number, y: number) => boolean) {
  const w = vp.xMax - vp.xMin;
  const h = vp.yMax - vp.yMin;
  const step = Math.max(w, h) / 14;
  const r = 4 * d.px;
  for (let x = vp.xMin + step / 2; x < vp.xMax; x += step)
    for (let y = vp.yMin + step / 2; y < vp.yMax; y += step) {
      if (region && !region(x, y)) continue;
      d.circle(x, y, r, { stroke: d.theme.muted, width: 1, alpha: 0.45 * alpha });
      if (B >= 0) d.dot(x, y, 1.3, d.theme.muted, 0.6 * alpha);
      else {
        d.line(x - r * 0.7, y - r * 0.7, x + r * 0.7, y + r * 0.7, { color: d.theme.muted, width: 1, alpha: 0.45 * alpha });
        d.line(x - r * 0.7, y + r * 0.7, x + r * 0.7, y - r * 0.7, { color: d.theme.muted, width: 1, alpha: 0.45 * alpha });
      }
    }
}

function drawSelector(d: Draw, p: Params) {
  const { theme } = d;
  const { L, h, slit, screen } = SEL;
  d.rect(0, -h, L, 2 * h, { fill: theme.series[3] ?? theme.accent, alpha: 0.08 });
  drawBDots(d, { xMin: 0, xMax: L, yMin: -h, yMax: h }, 1, 1);
  d.rect(0, h, L, 0.004, { fill: theme.negative });
  d.rect(0, -h - 0.004, L, 0.004, { fill: theme.positive });
  for (let x = 0.02; x < L; x += 0.04) {
    d.text("−", x, h + 0.002, { color: "#ffffff", size: 10, weight: "700" });
    d.text("+", x, -h - 0.002, { color: "#ffffff", size: 10, weight: "700" });
  }
  for (let x = 0.04; x < L; x += 0.08) d.arrowPx(x, -h * 0.8, 0, 1, 22, { color: theme.series[3] ?? theme.accent, width: 1.2, alpha: 0.7 });
  const wall = L + 0.02;
  d.line(wall, slit, wall, 0.09, { color: theme.text, width: 3 });
  d.line(wall, -slit, wall, -0.09, { color: theme.text, width: 3 });
  d.line(screen, -0.09, screen, 0.09, { color: theme.muted, width: 3 });
  d.text("anteparo", screen, 0.092, { color: theme.muted, size: 10, baseline: "bottom" });
  d.text("fenda", wall, 0.092, { color: theme.muted, size: 10, baseline: "bottom" });
  d.text(`E, B cruzados: passa v = E/B = ${fmtBR(Ep(p) / Bp(p))} m/s`, L / 2, h + 0.03, { color: theme.text, size: 11 });
  d.text("fonte", SEL.x0, -0.012, { color: theme.muted, size: 10, baseline: "top" });
  // Legenda das velocidades
  SEL_FACTORS.forEach((f, i) => {
    d.text(`${String(f).replace(".", ",")} v₀`, 0.38 + (i % 4) * 0.028, -0.06 - Math.floor(i / 4) * 0.014, { color: theme.series[i % theme.series.length] ?? theme.accent, size: 10 });
  });
}

function drawSpectrometer(d: Draw, s: PState, p: Params, vp: { xMax: number; yMax: number }) {
  const { theme } = d;
  const { L, h, slit, y0 } = SPEC;
  d.rect(-h, -L, 2 * h, L, { fill: theme.series[3] ?? theme.accent, alpha: 0.08 });
  d.rect(-h - 0.004, -L, 0.004, L, { fill: theme.negative });
  d.rect(h, -L, 0.004, L, { fill: theme.positive });
  d.text("seletor", -h - 0.012, -L / 2, { color: theme.muted, size: 10, align: "right" });
  d.text(`B′ = ${fmtBR(B2p(p))} T (saindo)`, vp.xMax, vp.yMax, { color: theme.text, size: 11, align: "right", baseline: "top", dx: -6, dy: 4 });
  drawBDots(d, { xMin: -0.1, xMax: vp.xMax, yMin: 0, yMax: vp.yMax }, 1, 0.7, (_x, y) => y > 0.01);
  d.line(-0.1, 0, -slit, 0, { color: theme.text, width: 3 });
  d.line(slit, 0, vp.xMax, 0, { color: theme.muted, width: 4 });
  d.text("detector", vp.xMax, -0.012, { color: theme.muted, size: 10, align: "right", baseline: "top", dx: -4 });
  d.text("fonte de íons", 0, y0 - 0.012, { color: theme.muted, size: 10, baseline: "top" });
  // Posições teóricas x = 2mv/eB′
  const iso = isoSet(p);
  const v = Ep(p) / Bp(p);
  iso.A.forEach((A, i) => {
    const x = 2 * larmorRadius(ionMass(A), v, QE, B2p(p));
    const color = theme.series[i % theme.series.length] ?? theme.accent;
    d.line(x, -0.008, x, 0.008, { color, width: 2 });
    d.text(iso.rotulos[i] ?? "", x, -0.02, { color, size: 11, weight: "600", baseline: "top", dy: 10 * (i % 2) });
  });
  const hits = s.ps.filter((q) => q.hit).length;
  d.text(`${hits} de ${s.ps.length} íons chegaram ao detector`, vp.xMax, -0.06, { color: theme.muted, size: 10, align: "right", dx: -4 });
}

function drawCyclotron(d: Draw, p: Params, s: PState) {
  const { theme } = d;
  const { R, gap } = CYC;
  const sp = species(p);
  const w = num(p, "fRF", 1) * ((Math.abs(sp.q) * Bp(p)) / sp.m);
  const V = Math.cos(w * s.tau);
  for (const side of [-1, 1]) {
    const shape: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const a = -Math.PI / 2 + (Math.PI * i) / 60;
      shape.push([side * Math.max(R * Math.cos(a), gap / 2), R * Math.sin(a)]);
    }
    const pos = side * V > 0;
    d.polyline(shape, { close: true, color: theme.muted, width: 1.5, fill: pos ? "rgba(217,69,59,0.12)" : "rgba(47,111,217,0.12)" });
    d.text(pos ? "+" : "−", side * R * 0.75, R * 0.8, { color: pos ? theme.positive : theme.negative, size: 16, weight: "700" });
  }
  drawBDots(d, { xMin: -R, xMax: R, yMin: -R, yMax: R }, 1, 0.6, (x, y) => Math.hypot(x, y) < R * 0.95 && Math.abs(x) > gap);
  d.arrowPx(0, R * 0.9, V >= 0 ? 1 : -1, 0, 18 * Math.abs(V) + 4, { color: theme.series[3] ?? theme.accent, width: 2 });
  d.text("E no vão", 0, R * 0.9, { color: theme.series[3] ?? theme.accent, size: 10, dy: -12 });
  const K = kinetic(P0(s)) / QE;
  d.text(`K = ${fmtBR(K / 1e3)} keV  (máx. ${fmtBR(cyclotronKmax(sp.m, sp.q, Bp(p)) / QE / 1e3)} keV)`, -R - 0.05, -R - 0.05, { color: theme.text, size: 11, align: "left", baseline: "bottom", dy: -18 });
}

function drawBottle(d: Draw, p: Params) {
  const { theme } = d;
  const B0 = Bp(p);
  // Linhas de campo no plano (z, x), traçadas a partir do centro
  for (const r0 of [0.05, 0.12, 0.2, 0.28, 0.36]) {
    for (const sgn of [1, -1]) {
      for (const dir of [1, -1]) {
        const pts: [number, number][] = [];
        let z = 0;
        let x = sgn * r0;
        for (let i = 0; i < 400 && Math.abs(z) < 1.5 && Math.abs(x) < 0.85; i++) {
          pts.push([z, x]);
          const B = bottleField(B0, x, 0, z);
          const n = Math.hypot(B[0], B[2]);
          z += (dir * 0.01 * B[2]) / n;
          x += (dir * 0.01 * B[0]) / n;
        }
        d.polyline(pts, { color: theme.accent, width: 1, alpha: 0.35 });
      }
    }
  }
  for (const zc of [-BOTTLE.L, BOTTLE.L]) {
    d.circle(zc, BOTTLE.a, 0.035, { fill: theme.text });
    d.circle(zc, -BOTTLE.a, 0.035, { stroke: theme.text, width: 1.5 });
    d.dot(zc, BOTTLE.a, 1.5, theme.dark ? "#141a22" : "#ffffff");
    d.line(zc - 0.02, -BOTTLE.a - 0.02, zc + 0.02, -BOTTLE.a + 0.02, { color: theme.text, width: 1.2 });
    d.line(zc - 0.02, -BOTTLE.a + 0.02, zc + 0.02, -BOTTLE.a - 0.02, { color: theme.text, width: 1.2 });
    d.text("espira", zc, BOTTLE.a + 0.06, { color: theme.muted, size: 10, baseline: "bottom" });
  }
  const { ratio, lossCone } = bottleMirror();
  d.text(`B_max/B_min = ${ratio.toFixed(2).replace(".", ",")}   cone de perda α_c = ${lossCone.toFixed(1).replace(".", ",")}°`, 0, 0.8, {
    color: theme.text,
    size: 11,
    baseline: "top",
  });
  d.text("vista lateral: z (eixo) na horizontal, x na vertical", 1.48, -0.82, { color: theme.muted, size: 10, align: "right", baseline: "bottom" });
}
