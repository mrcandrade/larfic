import { clamp, defineSim, deg, draw, formatBR, num, rad, texNum, type Params } from "@fisilab/core";

/**
 * Três laboratórios de referenciais não inerciais:
 *  0. elevador acelerado: balança (peso aparente) e uma bola lançada, vistas
 *     do solo e de dentro da cabine (g_ef = g + a);
 *  1. carrossel: bola lançada sobre um disco girando, vista de fora (reta) e
 *     de dentro (curva sob as forças centrífuga e de Coriolis), integrada nos
 *     dois referenciais;
 *  2. pêndulo de Foucault: oscilador no plano horizontal com Coriolis
 *     Ω_z = Ω sen φ; o plano precessa a −Ω_z.
 */
export interface RN {
  // elevador (solo: y para cima)
  ye: number;
  ve: number;
  bx: number;
  by: number;
  bvx: number;
  bvy: number;
  // carrossel
  phi: number;
  /** Fase do disco no lançamento e tempo desde o lançamento. */
  phiL: number;
  tau: number;
  /** Lançamento, no referencial do disco: posição e velocidade. */
  lx: number;
  ly: number;
  lvx: number;
  lvy: number;
  /** Bola integrada no referencial girante. */
  x: number;
  y: number;
  vx: number;
  vy: number;
  aiming: boolean;
  // Foucault
  fx: number;
  fy: number;
  fvx: number;
  fvy: number;
  /** Azimute do plano de oscilação, desenrolado (graus). */
  az: number;
  pins: boolean[];
}

export const modo = (p: Params) => Math.round(num(p, "modo"));
const G = (p: Params) => num(p, "g", 9.8);
export const M_PESSOA = 70;
export const CAB = { w: 2, h: 2.4 };
const HAND = { x: -0.55, y: 1.3 };
const E_BALL = 0.7;
export const OMEGA_T = 7.2921e-5; // rotação da Terra (rad/s)
export const RD = 4; // raio do carrossel (m)
const NPINS = 36;

// ------------------------------------------------------------------- elevador

/** Aceleração do elevador (para cima positiva) no instante t. */
export function accElev(p: Params, t: number): number {
  const g = G(p);
  switch (Math.round(num(p, "perfil"))) {
    case 1: // viagem para cima: acelera, cruzeiro, freia
      return t < 2 ? 1.5 : t < 7 ? 0 : t < 9 ? -1.5 : 0;
    case 2: // cabo rompe em t = 1 s; freio de emergência em t = 3 s
      return t < 1 ? 0 : t < 3 ? -g : t < 4 ? 2 * g : 0;
    case 3: // "super elevador": desce acelerando mais que a gravidade
      return t < 1 ? 0 : t < 2.5 ? -1.5 * g : t < 5 ? 0.9 * g : 0;
    default:
      return num(p, "a", 2);
  }
}
/** Leitura da balança sob a pessoa (N): m(g + a), ou zero se ela flutua. */
export const balanca = (p: Params, t: number) => Math.max(0, M_PESSOA * (G(p) + accElev(p, t)));

function stepElev(s: RN, p: Params, t: number, dt: number): RN {
  const a = accElev(p, t);
  const g = G(p);
  const ye = s.ye + s.ve * dt + 0.5 * a * dt * dt;
  const ve = s.ve + a * dt;
  let bx = s.bx + s.bvx * dt;
  let by = s.by + s.bvy * dt - 0.5 * g * dt * dt;
  let bvx = s.bvx;
  let bvy = s.bvy - g * dt;
  const r = 0.08;
  // choques com o piso, o teto e as paredes, no referencial da cabine
  let ry = by - ye;
  let rvy = bvy - ve;
  if (ry < r && rvy < 0) {
    ry = r;
    rvy = Math.abs(rvy) < 0.05 ? 0 : -E_BALL * rvy;
  } else if (ry > CAB.h - r && rvy > 0) {
    ry = CAB.h - r;
    rvy = -E_BALL * rvy;
  }
  if (ry === r && rvy === 0) bvx *= 1 - 2 * dt; // rola no piso com atrito
  by = ye + ry;
  bvy = ve + rvy;
  if (Math.abs(bx) > CAB.w / 2 - r && bx * bvx > 0) {
    bx = Math.sign(bx) * (CAB.w / 2 - r);
    bvx = -E_BALL * bvx;
  }
  return { ...s, ye, ve, bx, by, bvx, bvy };
}

// ------------------------------------------------------------------ carrossel

const W = (p: Params) => num(p, "W", 0.8);
const rot = (x: number, y: number, a: number): [number, number] => [x * Math.cos(a) - y * Math.sin(a), x * Math.sin(a) + y * Math.cos(a)];

/** Posição e velocidade exatas no referencial inercial (movimento retilíneo uniforme). */
export function inertialBall(s: RN, p: Params): { X: number; Y: number; VX: number; VY: number } {
  const w = W(p);
  const [X0, Y0] = rot(s.lx, s.ly, s.phiL);
  const [VX, VY] = rot(s.lvx - w * s.ly, s.lvy + w * s.lx, s.phiL);
  return { X: X0 + VX * s.tau, Y: Y0 + VY * s.tau, VX, VY };
}
/** Acelerações fictícias no referencial do disco (Ω no eixo +z). */
export const fict = (x: number, y: number, vx: number, vy: number, w: number) => ({
  cfx: w * w * x,
  cfy: w * w * y,
  cox: 2 * w * vy,
  coy: -2 * w * vx,
});

function stepCar(s: RN, p: Params, dt: number): RN {
  const w = W(p);
  const f = (u: number[]): number[] => {
    const a = fict(u[0]!, u[1]!, u[2]!, u[3]!, w);
    return [u[2]!, u[3]!, a.cfx + a.cox, a.cfy + a.coy];
  };
  const u0 = [s.x, s.y, s.vx, s.vy];
  const k1 = f(u0);
  const k2 = f(u0.map((v, i) => v + (dt / 2) * k1[i]!));
  const k3 = f(u0.map((v, i) => v + (dt / 2) * k2[i]!));
  const k4 = f(u0.map((v, i) => v + dt * k3[i]!));
  const u = u0.map((v, i) => v + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
  return { ...s, phi: s.phi + w * dt, tau: s.tau + dt, x: u[0]!, y: u[1]!, vx: u[2]!, vy: u[3]! };
}

function launch(s: RN, lvx: number, lvy: number): RN {
  return { ...s, phiL: s.phi, tau: 0, lvx, lvy, x: s.lx, y: s.ly, vx: lvx, vy: lvy, aiming: false };
}

// ------------------------------------------------------------------- Foucault

export const wz = (p: Params) => num(p, "k", 2000) * OMEGA_T * Math.sin(rad(num(p, "lat", 48.85)));
const w0f = (p: Params) => Math.sqrt(G(p) / num(p, "Lf", 67));
/** Azimute (graus, 0–180) do eixo maior da órbita: tensor de Fradkin ω₀² r rᵀ + v vᵀ. */
export function planeAz(s: RN, p: Params): number {
  const w2 = w0f(p) ** 2;
  const qxx = w2 * s.fx * s.fx + s.fvx * s.fvx;
  const qyy = w2 * s.fy * s.fy + s.fvy * s.fvy;
  const qxy = w2 * s.fx * s.fy + s.fvx * s.fvy;
  return deg(0.5 * Math.atan2(2 * qxy, qxx - qyy));
}

function stepFou(s: RN, p: Params, dt: number): RN {
  const w2 = w0f(p) ** 2;
  const O = wz(p);
  const f = (u: number[]): number[] => [u[2]!, u[3]!, -w2 * u[0]! + 2 * O * u[3]!, -w2 * u[1]! - 2 * O * u[2]!];
  const u0 = [s.fx, s.fy, s.fvx, s.fvy];
  const k1 = f(u0);
  const k2 = f(u0.map((v, i) => v + (dt / 2) * k1[i]!));
  const k3 = f(u0.map((v, i) => v + (dt / 2) * k2[i]!));
  const k4 = f(u0.map((v, i) => v + dt * k3[i]!));
  const u = u0.map((v, i) => v + (dt / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
  const n: RN = { ...s, fx: u[0]!, fy: u[1]!, fvx: u[2]!, fvy: u[3]! };
  let a = planeAz(n, p);
  while (a - s.az > 90) a -= 180;
  while (a - s.az < -90) a += 180;
  n.az = a;
  // pinos derrubados pela ponta do pêndulo
  const A = num(p, "A", 3);
  if (Math.hypot(n.fx, n.fy) > 0.93 * A) {
    let pins: boolean[] | undefined;
    for (let i = 0; i < NPINS; i++) {
      if (!s.pins[i]) continue;
      const q = (2 * Math.PI * i) / NPINS;
      if (Math.hypot(n.fx - A * Math.cos(q), n.fy - A * Math.sin(q)) < 0.09 * A) {
        pins ??= s.pins.slice();
        pins[i] = false;
      }
    }
    if (pins) n.pins = pins;
  }
  return n;
}

// ------------------------------------------------------------------ simulação

function initial(p: Params): RN {
  const r0 = num(p, "r0", 1);
  const v0 = num(p, "v0", 3);
  const al = rad(num(p, "alfa", 0));
  const base: RN = {
    ye: 0,
    ve: 0,
    bx: HAND.x,
    by: HAND.y,
    bvx: num(p, "u", 2),
    bvy: 0,
    phi: 0,
    phiL: 0,
    tau: 0,
    lx: r0,
    ly: 0,
    lvx: v0 * Math.cos(al),
    lvy: v0 * Math.sin(al),
    x: 0,
    y: 0,
    vx: 0,
    vy: 0,
    aiming: false,
    fx: num(p, "A", 3),
    fy: 0,
    fvx: 0,
    fvy: 0,
    az: 0,
    pins: new Array<boolean>(NPINS).fill(true),
  };
  if (Math.round(num(p, "solta")) === 1) {
    // empurrado do centro: passa pelo centro em cada oscilação (sem roseta)
    base.fx = 0;
    base.fvx = num(p, "A", 3) * w0f(p);
  }
  return launch(base, base.lvx, base.lvy);
}

const PANEL = 4.7; // centros dos painéis do carrossel em ±PANEL
const EL = { L: -2.2, R: 2.2, y0: 0.6 }; // cabines do elevador

export const referenciaisNaoInerciais = defineSim<RN>({
  id: "referenciais-nao-inerciais",
  title: "Referenciais não inerciais: elevador, carrossel, Coriolis e Foucault",
  course: "FG I",
  topic: "Leis de Newton",
  priority: "P2",
  summary:
    "O mesmo movimento visto de um referencial inercial e de um acelerado, lado a lado: peso aparente e imponderabilidade no elevador, forças centrífuga e de Coriolis num carrossel e a precessão do pêndulo de Foucault em qualquer latitude.",
  equations: [
    String.raw`\text{elevador: } \vec F_{fic} = -m\vec a \qquad N = m(g + a) \qquad \vec g_{ef} = \vec g - \vec a`,
    String.raw`\text{disco: } \vec a' = \underbrace{-\vec\Omega\times(\vec\Omega\times\vec r')}_{\Omega^2 r\ \text{(centrífuga)}} \; \underbrace{-\,2\vec\Omega\times\vec v'}_{\text{Coriolis}}`,
    String.raw`\text{Foucault: } \ddot x = -\omega_0^2 x + 2\Omega_z \dot y,\;\; \ddot y = -\omega_0^2 y - 2\Omega_z \dot x,\;\; \Omega_z = \Omega\,\text{sen}\,\varphi`,
    String.raw`T_{prec} = \frac{2\pi}{\Omega\,\text{sen}\,\varphi} \approx \frac{23{,}93\ \text{h}}{\text{sen}\,\varphi}`,
  ],
  liveEquations(s, p, t) {
    const md = modo(p);
    const g = G(p);
    if (md === 0) {
      const a = accElev(p, t);
      return [
        String.raw`a = ${texNum(a)}\ \text{m/s}^2 \qquad N = ${M_PESSOA}\,(${texNum(g)} ${a < 0 ? "-" : "+"} ${texNum(Math.abs(a))}) = ${texNum(balanca(p, t))}\ \text{N} \;(${texNum(balanca(p, t) / g)}\ \text{kgf})`,
        String.raw`g_{ef} = g + a = ${texNum(g + a)}\ \text{m/s}^2 \qquad v_{elev} = ${texNum(s.ve)}\ \text{m/s}`,
      ];
    }
    if (md === 1) {
      const w = W(p);
      const v = Math.hypot(s.vx, s.vy);
      return [
        String.raw`\Omega^2 r = ${texNum(w * w)}\cdot ${texNum(Math.hypot(s.x, s.y))} = ${texNum(w * w * Math.hypot(s.x, s.y))}\ \text{m/s}^2 \qquad 2\Omega v' = 2\cdot${texNum(w)}\cdot${texNum(v)} = ${texNum(2 * w * v)}\ \text{m/s}^2`,
      ];
    }
    const O = wz(p);
    return [
      String.raw`\Omega_z = ${texNum(num(p, "k", 2000))}\cdot 7{,}29\times10^{-5}\cdot \text{sen}\,${texNum(num(p, "lat", 48.85))}^\circ = ${texNum(O)}\ \text{rad/s}`,
      String.raw`\text{azimute do plano: } ${texNum(s.az)}^\circ \quad (\text{previsto } ${texNum(-deg(O * t))}^\circ) \qquad T_{prec,real} = ${texNum(Math.abs(2 * Math.PI / (OMEGA_T * Math.sin(rad(num(p, "lat", 48.85))))) / 3600)}\ \text{h}`,
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
        { value: 0, label: "Elevador acelerado" },
        { value: 1, label: "Carrossel: centrífuga e Coriolis" },
        { value: 2, label: "Pêndulo de Foucault" },
      ],
    },
    {
      key: "perfil",
      label: "Elevador: movimento",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Aceleração ao vivo (controle)" },
        { value: 1, label: "Viagem: acelera, sobe, freia" },
        { value: 2, label: "Cabo rompe: queda livre e freio" },
        { value: 3, label: "Super elevador: desce com a > g" },
      ],
    },
    { key: "a", label: "Elevador: aceleração (para cima +)", unit: "m/s²", min: -20, max: 20, step: 0.1, default: 2, live: true },
    { key: "u", label: "Elevador: velocidade da bola lançada (em relação à cabine)", unit: "m/s", min: 0, max: 4, step: 0.1, default: 2 },
    { key: "W", label: "Carrossel: velocidade angular Ω", unit: "rad/s", min: 0, max: 2, step: 0.05, default: 0.8 },
    { key: "r0", label: "Carrossel: distância do lançador ao centro", unit: "m", min: 0, max: 3.8, step: 0.1, default: 1 },
    { key: "v0", label: "Carrossel: velocidade de lançamento (no disco)", unit: "m/s", min: 0.5, max: 8, step: 0.1, default: 3 },
    { key: "alfa", label: "Carrossel: direção do lançamento (0° = para fora)", unit: "°", min: -180, max: 180, step: 5, default: 0 },
    { key: "lat", label: "Foucault: latitude (negativa = sul)", unit: "°", min: -90, max: 90, step: 0.5, default: 48.85, live: true },
    { key: "k", label: "Foucault: aceleração da rotação da Terra", unit: "×", min: 1, max: 20000, step: 1, default: 2000, log: true, live: true },
    { key: "Lf", label: "Foucault: comprimento do fio", unit: "m", min: 2, max: 100, step: 1, default: 67 },
    { key: "A", label: "Foucault: amplitude", unit: "m", min: 0.5, max: 6, step: 0.1, default: 3 },
    {
      key: "solta",
      label: "Foucault: início",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Solto do repouso na ponta (roseta)" },
        { value: 1, label: "Empurrado a partir do centro" },
      ],
    },
    { key: "g", label: "Gravidade", unit: "m/s²", min: 1, max: 25, step: 0.1, default: 9.8 },
  ],

  observables: [
    { key: "ae", label: "Aceleração do elevador", unit: "m/s²", value: (_s, p, t) => (modo(p) === 0 ? accElev(p, t) : 0) },
    { key: "N", label: "Leitura da balança", unit: "N", value: (_s, p, t) => (modo(p) === 0 ? balanca(p, t) : 0) },
    { key: "kgf", label: "Peso aparente", unit: "kgf", value: (_s, p, t) => (modo(p) === 0 ? balanca(p, t) / G(p) : 0) },
    { key: "ve", label: "Velocidade do elevador", unit: "m/s", value: (s) => s.ve },
    { key: "hb", label: "Altura da bola sobre o piso da cabine", unit: "m", value: (s) => s.by - s.ye },
    { key: "r", label: "Carrossel: distância da bola ao centro", unit: "m", value: (s) => Math.hypot(s.x, s.y) },
    { key: "vrel", label: "Carrossel: velocidade da bola no disco", unit: "m/s", value: (s) => Math.hypot(s.vx, s.vy) },
    { key: "acf", label: "Aceleração centrífuga", unit: "m/s²", value: (s, p) => W(p) ** 2 * Math.hypot(s.x, s.y) },
    { key: "aco", label: "Aceleração de Coriolis", unit: "m/s²", value: (s, p) => 2 * W(p) * Math.hypot(s.vx, s.vy) },
    {
      key: "err",
      label: "Diferença entre os dois referenciais",
      unit: "m",
      value: (s, p) => {
        const b = inertialBall(s, p);
        const [X, Y] = rot(s.x, s.y, s.phi);
        return Math.hypot(X - b.X, Y - b.Y);
      },
    },
    { key: "az", label: "Foucault: azimute do plano", unit: "°", value: (s) => s.az },
    { key: "azp", label: "Foucault: azimute previsto", unit: "°", value: (_s, p, t) => -deg(wz(p) * t) },
    { key: "pinos", label: "Foucault: pinos derrubados", unit: "", value: (s) => s.pins.filter((b) => !b).length },
  ],
  chart: { x: "t", y: "N" },

  scenarios: [
    {
      id: "elevador",
      label: "Elevador: peso aparente",
      params: { modo: 0, perfil: 1, u: 2 },
      guide: `### A balança mente?
1. A pessoa (70 kg) está sobre uma balança. Rode a **viagem**: na arrancada a balança marca mais que 686 N; no cruzeiro, o peso verdadeiro; na freada, menos.
2. Para quem está dentro, tudo se passa como se a gravidade fosse $g_{ef} = g + a$. A bola lançada descreve uma parábola mais "fechada" na arrancada (painel da direita) e a de sempre vista do solo (painel da esquerda).
3. Escolha **aceleração ao vivo** e leve $a$ a $-9{,}8$ m/s²: a balança marca zero. É a **imponderabilidade** dos astronautas em órbita: tudo cai junto.
4. Com $a < -g$ (**super elevador**), a pessoa e a bola vão para o teto: dentro da cabine a "gravidade" aponta para cima.`,
      predict: [
        {
          question: "O elevador sobe e está freando (aceleração para baixo de 2 m/s²). A balança sob uma pessoa de 70 kg marca:",
          options: ["mais que 686 N", "686 N", "menos que 686 N", "zero"],
          answer: 2,
          explanation: "O que conta é a aceleração, não a velocidade: $N = m(g + a) = 70\\,(9{,}8 - 2) = 546$ N.",
        },
      ],
    },
    {
      id: "queda",
      label: "Cabo rompe: imponderabilidade",
      params: { modo: 0, perfil: 2, u: 1.5 },
      guide: `### Queda livre
1. Em $t = 1$ s o cabo rompe. A bola, lançada na horizontal, passa a andar em **linha reta** dentro da cabine (painel da direita), enquanto do solo ela segue uma parábola.
2. A balança marca zero durante a queda e quase o triplo do peso no freio de emergência ($a = +2g$).
3. Compare com o **super elevador**: descendo com $a = -1{,}5g$ a balança também marca zero, mas a pessoa e a bola grudam no teto.`,
    },
    {
      id: "carrossel",
      label: "Carrossel: Coriolis",
      params: { modo: 1, W: 0.8, r0: 1, v0: 3, alfa: 0 },
      guide: `### A mesma bola, dois relatos
1. A bola é lançada para fora a partir de 1 m do centro de um disco que gira no sentido anti-horário. Vista **de fora** (esquerda) ela anda em linha reta: nenhuma força age.
2. Vista **de dentro** (direita) ela se curva para a direita: para explicar a curva, quem gira com o disco precisa das forças fictícias **centrífuga** ($\\Omega^2 r$, para fora) e **de Coriolis** ($2\\Omega v'$, perpendicular à velocidade).
3. A simulação integra a bola nos dois referenciais, de forma independente; o observável "diferença entre os dois referenciais" mostra que os relatos coincidem.
4. Arraste a partir do lançador (painel da direita) para mirar e lance de novo. Tente acertar o centro: é preciso mirar à esquerda!`,
      predict: [
        {
          question: "Num disco que gira no sentido anti-horário, a bola lançada para fora, vista de cima por quem gira junto, desvia:",
          options: ["para a esquerda", "para a direita", "não desvia"],
          answer: 1,
          explanation: "A aceleração de Coriolis $-2\\vec\\Omega\\times\\vec v'$ aponta para a direita de $\\vec v'$ quando $\\vec\\Omega$ aponta para cima. É o mesmo sentido do desvio dos ventos no hemisfério norte.",
        },
      ],
    },
    {
      id: "foucault",
      label: "Pêndulo de Foucault",
      params: { modo: 2, lat: 48.85, k: 2000, Lf: 67, A: 3, solta: 0 },
      guide: `### A Terra gira debaixo do pêndulo
1. O pêndulo do Panthéon (Paris, 48,85° N) tem 67 m. Aqui a rotação da Terra foi acelerada 2000 vezes. Veja os pinos caírem um a um, no sentido horário.
2. Leia o azimute do plano e compare com o previsto, $-\\Omega\\,\\text{sen}\\,\\varphi\\; t$. Na vida real, a volta completa em Paris leva cerca de 32 h.
3. Mude a latitude: no polo a precessão é de 360° por dia sideral; no equador ela **não existe**; no hemisfério sul o sentido se inverte.
4. Solto da ponta o pêndulo desenha uma roseta de pontas; empurrado do centro, laços. Os dois precessam igual.`,
      predict: [
        {
          question: "Um pêndulo de Foucault em Porto Alegre (30° S) leva quanto tempo para girar seu plano 360°?",
          options: ["24 h", "cerca de 48 h, no sentido anti-horário", "cerca de 48 h, no sentido horário", "nunca gira"],
          answer: 1,
          explanation: "$T = 23{,}93\\ \\text{h}/|\\text{sen}\\,30^\\circ| \\approx 48$ h. No hemisfério sul $\\Omega_z < 0$ e o plano gira no sentido anti-horário (visto de cima).",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "balanca",
      prompt: "Uma pessoa de {mp} kg está sobre uma balança num elevador que acelera para cima a {ae} m/s². Quanto marca a balança, em newtons? (g = 9,8 m/s²)",
      vary: { mp: [40, 110, 0], ae: [0.5, 4, 1] },
      answer: { label: "N", unit: "N", compute: (p) => num(p, "mp") * (9.8 + num(p, "ae")) },
    },
    {
      id: "foucault",
      prompt: "Quanto tempo, em horas, o plano de um pêndulo de Foucault leva para dar uma volta completa na latitude {lat}°? (Use 23,93 h para a rotação da Terra.)",
      vary: { lat: [10, 80, 1] },
      fixed: { modo: 2 },
      answer: { label: "T", unit: "h", compute: (p) => 23.93 / Math.sin(rad(num(p, "lat"))) },
    },
    {
      id: "coriolis",
      prompt: "Uma bola rola a {v0} m/s sobre um carrossel que gira a {W} rad/s. Qual o módulo da aceleração de Coriolis que um passageiro atribui a ela?",
      vary: { v0: [1, 6, 1], W: [0.2, 1.5, 2] },
      fixed: { modo: 1 },
      answer: { label: "a_C", unit: "m/s²", compute: (p) => 2 * num(p, "W") * num(p, "v0") },
    },
  ],

  init: initial,
  step(s, p, t, dt) {
    const md = modo(p);
    if (md === 0) return stepElev(s, p, t, dt);
    if (md === 1) return s.aiming ? { ...s, phi: s.phi + W(p) * dt } : stepCar(s, p, dt);
    return stepFou(s, p, dt);
  },
  dt: 1e-3,
  sampleEvery: 20,
  maxSamples: 8000,
  stopWhen: (s, p) => (modo(p) === 1 && !s.aiming ? 1.6 * RD - Math.hypot(s.x, s.y) : 1),

  pointer: {
    down(s, p, pt) {
      if (modo(p) !== 1) return undefined;
      if (pt.x <= 0) return undefined;
      return { ...s, aiming: true, lvx: 1.5 * (pt.x - PANEL - s.lx), lvy: 1.5 * (pt.y - s.ly) };
    },
    move(s, p, pt, dragging) {
      if (modo(p) !== 1 || !dragging || !s.aiming) return undefined;
      const k = 1.5; // 1 m de arrasto = 1,5 m/s
      return { ...s, lvx: k * (pt.x - PANEL - s.lx), lvy: k * (pt.y - s.ly) };
    },
    up(s, p) {
      if (modo(p) !== 1 || !s.aiming) return undefined;
      const v = Math.hypot(s.lvx, s.lvy);
      const f = v > 8 ? 8 / v : 1;
      return launch(s, s.lvx * f, s.lvy * f);
    },
    cursor: (_s, p, pt) => (modo(p) === 1 && pt.x > 0 ? "crosshair" : undefined),
  },
  actions: [
    { id: "relancar", label: "Lançar de novo (mesma mira)", run: (s) => launch({ ...s, lx: s.lx, ly: s.ly }, s.lvx, s.lvy) },
    { id: "pinos", label: "Repor os pinos (Foucault)", run: (s) => ({ ...s, pins: new Array<boolean>(NPINS).fill(true) }) },
  ],

  viewport(p) {
    const md = modo(p);
    if (md === 0) return { xMin: -4.4, xMax: 4.4, yMin: -0.3, yMax: 4.4 };
    if (md === 1) return { xMin: -9.6, xMax: 9.6, yMin: -5.6, yMax: 5.8 };
    const A = num(p, "A", 3);
    return { xMin: -1.6 * A, xMax: 2.6 * A, yMin: -1.35 * A, yMax: 1.35 * A };
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const md = modo(frame.params);
    if (md === 0) renderElev(d, frame.state, frame.params, frame.t, frame.trail);
    else if (md === 1) renderCar(d, frame.state, frame.params, frame.trail);
    else renderFou(d, frame.state, frame.params, frame.t, frame.trail);
  },
});

type D = ReturnType<typeof draw>;

function person(d: D, x: number, y0: number, up: boolean) {
  // desenhada de pé no piso (up) ou "de pé" no teto (cabeça para baixo)
  const s = up ? 1 : -1;
  const c = d.theme.text;
  d.line(x - 0.12, y0, x, y0 + s * 0.55, { color: c, width: 3 });
  d.line(x + 0.12, y0, x, y0 + s * 0.55, { color: c, width: 3 });
  d.line(x, y0 + s * 0.55, x, y0 + s * 1.15, { color: c, width: 3 });
  d.line(x, y0 + s * 1.0, x - 0.3, y0 + s * 0.75, { color: c, width: 2.5 });
  d.circle(x, y0 + s * 1.33, 0.15, { fill: c });
}

function renderElev(d: D, s: RN, p: Params, t: number, trail: RN[]) {
  const th = d.theme;
  const g = G(p);
  const a = accElev(p, t);
  const N = balanca(p, t);
  const floating = g + a < 0;
  for (const [cx, title] of [
    [EL.L, "visto do solo (inercial)"],
    [EL.R, "visto de dentro da cabine"],
  ] as const) {
    d.text(title, cx, 4.2, { size: 12, weight: "600" });
    // cabine
    d.rect(cx - CAB.w / 2, EL.y0, CAB.w, CAB.h, { stroke: th.text, width: 2 });
    d.rect(cx - 0.75, EL.y0 + 0.02, 0.5, 0.08, { fill: th.muted });
    person(d, cx - 0.5, floating ? EL.y0 + CAB.h : EL.y0 + 0.1, !floating);
    // bola
    d.circle(cx + s.bx, EL.y0 + s.by - s.ye, 0.08, { fill: th.series[1] });
  }
  // poço do elevador (esquerda): andares rolando, a cada 3 m
  const x0 = EL.L - CAB.w / 2 - 0.6;
  for (let k = Math.floor((s.ye - 2) / 3); k <= Math.ceil((s.ye + 5) / 3); k++) {
    const yy = EL.y0 + 3 * k - s.ye;
    if (yy < -0.25 || yy > 3.9) continue;
    d.line(x0, yy, x0 + 0.4, yy, { color: th.muted });
    d.text(`${k}º`, x0 - 0.1, yy + 0.12, { size: 9, color: th.muted, align: "right" });
  }
  d.line(x0 + 0.2, -0.3, x0 + 0.2, 3.9, { color: th.muted, width: 1, dash: [3, 3] });
  // rastros da bola: solo (relativo à câmera que segue a cabine) e cabine
  const tr = trail.slice(-600);
  d.polyline(tr.map((q) => [EL.L + q.bx, EL.y0 + q.by - s.ye]), { color: th.series[1], width: 1.5, alpha: 0.7 });
  d.polyline(tr.map((q) => [EL.R + q.bx, EL.y0 + q.by - q.ye]), { color: th.series[1], width: 1.5, alpha: 0.7 });
  // vetores
  d.arrowPx(EL.L + CAB.w / 2 + 0.25, EL.y0 + 1.2, 0, Math.sign(a), clamp(Math.abs(a) * 6, 0, 80), { color: th.accent });
  d.text("a", EL.L + CAB.w / 2 + 0.4, EL.y0 + 1.2, { color: th.accent, size: 12, weight: "600" });
  d.text(`v = ${s.ve.toFixed(1)} m/s`, EL.L + CAB.w / 2 + 0.25, EL.y0 + 0.4, { size: 10, color: th.muted, align: "left" });
  const px = EL.R - 0.5;
  const pyc = floating ? EL.y0 + CAB.h - 0.7 : EL.y0 + 0.8;
  d.arrowPx(px + 0.25, pyc, 0, -1, clamp(g * 4, 0, 70), { color: th.series[2] });
  d.text("mg", px + 0.35, pyc - 0.35, { color: th.series[2], size: 11, align: "left" });
  if (Math.abs(a) > 0.05) {
    d.arrowPx(px + 0.6, pyc, 0, -Math.sign(a), clamp(Math.abs(a) * 4, 0, 90), { color: th.positive });
    d.text("−ma (fictícia)", px + 0.7, pyc + (a > 0 ? -0.5 : 0.5), { color: th.positive, size: 11, align: "left" });
  }
  // painel de leitura
  d.rect(-0.75, EL.y0 + 0.4, 1.5, 1.4, { stroke: th.grid, width: 1 });
  d.text("balança", 0, EL.y0 + 1.6, { size: 11, color: th.muted });
  d.text(`${N.toFixed(0)} N`, 0, EL.y0 + 1.25, { size: 18, weight: "700", color: N < 1 ? th.positive : th.text });
  d.text(`${(N / g).toFixed(1)} kgf`, 0, EL.y0 + 0.9, { size: 12 });
  d.text(N < 1 ? (floating ? "na balança: nada (vai ao teto)" : "imponderabilidade") : `g_ef = ${(g + a).toFixed(1)} m/s²`, 0, EL.y0 + 0.6, {
    size: 10,
    color: N < 1 ? th.positive : th.muted,
  });
  d.text(`a = ${a.toFixed(2)} m/s²`, 0, EL.y0 + 2.2, { size: 12, color: th.accent, weight: "600" });
}

function disk(d: D, cx: number, ang: number, label: string) {
  const th = d.theme;
  d.circle(cx, 0, RD, { fill: th.ground, stroke: th.text, width: 1.5 });
  for (let k = 0; k < 8; k++) {
    const q = ang + (k * Math.PI) / 4;
    d.line(cx, 0, cx + RD * Math.cos(q), RD * Math.sin(q), { color: th.muted, width: 1, alpha: 0.5 });
  }
  d.text(label, cx, 5.4, { size: 12, weight: "600" });
}

function renderCar(d: D, s: RN, p: Params, trail: RN[]) {
  const th = d.theme;
  const w = W(p);
  const L = -PANEL;
  const R = PANEL;
  disk(d, L, s.phi, "visto de fora (inercial)");
  disk(d, R, 0, "visto de cima, girando com o disco");
  d.text(`Ω = ${w.toFixed(2)} rad/s ↺`, L, -5.2, { size: 11, color: th.muted });
  // marco fixo do lado de fora (aparece girando no painel do disco)
  const [mx, my] = rot(RD + 0.6, 0, -s.phi);
  d.dot(R + mx, my, 5, th.muted);
  d.text("poste", R + mx, my - 0.35, { size: 9, color: th.muted });
  d.dot(L + RD + 0.6, 0, 5, th.muted);
  // lançador
  const [lX, lY] = rot(s.lx, s.ly, s.phi);
  d.circle(L + lX, lY, 0.22, { fill: th.series[2] });
  d.circle(R + s.lx, s.ly, 0.22, { fill: th.series[2] });
  // seta de mira (velocidade de lançamento no disco)
  d.arrow(R + s.lx, s.ly, s.lvx / 1.5, s.lvy / 1.5, { color: th.series[2], dash: s.aiming ? [] : [4, 3], width: 1.5 });
  // centrífuga sobre o lançador parado no disco
  if (Math.hypot(s.lx, s.ly) > 0.05) d.arrowPx(R + s.lx, s.ly, s.lx, s.ly, clamp(w * w * Math.hypot(s.lx, s.ly) * 20, 0, 50), { color: th.positive, width: 1.5 });
  if (s.aiming) {
    d.text("solte para lançar", R, -5.2, { size: 11, color: th.series[2] });
    return;
  }
  // rastros: inercial (reta) e girante (curva)
  const tr = trail.filter((q) => !q.aiming && q.phiL === s.phiL).slice(-1500);
  d.polyline(
    tr.map((q) => {
      const b = inertialBall(q, p);
      return [L + b.X, b.Y];
    }),
    { color: th.series[1], width: 1.8 },
  );
  d.polyline(tr.map((q) => [R + q.x, q.y]), { color: th.series[1], width: 1.8 });
  const b = inertialBall(s, p);
  d.circle(L + b.X, b.Y, 0.15, { fill: th.series[1] });
  d.arrowPx(L + b.X, b.Y, b.VX, b.VY, clamp(Math.hypot(b.VX, b.VY) * 10, 0, 70), { color: th.accent });
  d.circle(R + s.x, s.y, 0.15, { fill: th.series[1] });
  d.arrowPx(R + s.x, s.y, s.vx, s.vy, clamp(Math.hypot(s.vx, s.vy) * 10, 0, 70), { color: th.accent });
  const f = fict(s.x, s.y, s.vx, s.vy, w);
  d.arrowPx(R + s.x, s.y, f.cfx, f.cfy, clamp(Math.hypot(f.cfx, f.cfy) * 12, 0, 70), { color: th.positive });
  d.arrowPx(R + s.x, s.y, f.cox, f.coy, clamp(Math.hypot(f.cox, f.coy) * 12, 0, 70), { color: th.series[4] });
  d.text("v", L - 5.2, -4.5, { color: th.accent, size: 11, align: "left", weight: "600" });
  d.text("nenhuma força: linha reta", L - 4.9, -4.5, { size: 10, color: th.muted, align: "left" });
  d.text("centrífuga", R - 4.6, -4.5, { color: th.positive, size: 11, align: "left", weight: "600" });
  d.text("Coriolis", R - 2.9, -4.5, { color: th.series[4], size: 11, align: "left", weight: "600" });
  d.text("arraste do lançador para mirar", R + 0.4, -4.5, { size: 10, color: th.muted, align: "left" });
}

function renderFou(d: D, s: RN, p: Params, t: number, trail: RN[]) {
  const th = d.theme;
  const A = num(p, "A", 3);
  const lat = num(p, "lat", 48.85);
  // mostrador
  d.circle(0, 0, 1.15 * A, { fill: th.ground, stroke: th.muted, width: 1 });
  for (let k = 0; k < 36; k++) {
    const q = (k * Math.PI) / 18;
    const r1 = k % 9 === 0 ? 1.04 * A : 1.1 * A;
    d.line(r1 * Math.cos(q), r1 * Math.sin(q), 1.15 * A * Math.cos(q), 1.15 * A * Math.sin(q), { color: th.muted, width: 1 });
  }
  for (const [lbl, q] of [
    ["L", 0],
    ["N", 90],
    ["O", 180],
    ["S", 270],
  ] as const)
    d.text(lbl, 1.25 * A * Math.cos(rad(q)), 1.25 * A * Math.sin(rad(q)), { size: 11, weight: "600", color: th.muted });
  // pinos
  s.pins.forEach((up, i) => {
    const q = (2 * Math.PI * i) / NPINS;
    if (up) d.dot(A * 1.02 * Math.cos(q), A * 1.02 * Math.sin(q), 3.5, th.series[5] ?? th.accent);
    else d.dot(A * 1.08 * Math.cos(q), A * 1.08 * Math.sin(q), 2, th.muted, 0.6);
  });
  // rastro (roseta)
  d.polyline(trail.slice(-2500).map((q) => [q.fx, q.fy]), { color: th.accent, width: 1, alpha: 0.6 });
  // plano previsto e medido
  const qp = -wz(p) * t;
  d.line(-A * Math.cos(qp), -A * Math.sin(qp), A * Math.cos(qp), A * Math.sin(qp), { color: th.positive, dash: [6, 4], width: 1.2 });
  const qm = rad(s.az);
  d.line(-A * 0.9 * Math.cos(qm), -A * 0.9 * Math.sin(qm), A * 0.9 * Math.cos(qm), A * 0.9 * Math.sin(qm), { color: th.series[2], width: 1, alpha: 0.6 });
  d.line(0, 0, s.fx, s.fy, { color: th.muted, width: 1 });
  d.circle(s.fx, s.fy, 0.06 * A, { fill: th.series[1], stroke: th.text, width: 1 });
  // painel lateral: Terra e leituras
  const ex = 1.95 * A;
  const ey = 0.55 * A;
  const er = 0.45 * A;
  d.circle(ex, ey, er, { stroke: th.text, width: 1.2 });
  d.line(ex, ey - er * 1.3, ex, ey + er * 1.3, { color: th.muted, dash: [3, 3], width: 1 });
  d.arrow(ex, ey + er, 0, er * 0.45, { color: th.accent });
  d.text("Ω", ex + 0.08 * A, ey + 1.4 * er, { color: th.accent, size: 11, align: "left" });
  const ql = rad(lat);
  const sx = ex + er * Math.cos(ql);
  const sy = ey + er * Math.sin(ql);
  d.line(ex, ey, sx, sy, { color: th.muted, width: 1 });
  d.dot(sx, sy, 4, th.series[1]!);
  d.arrow(sx, sy, er * 0.5 * Math.cos(ql), er * 0.5 * Math.sin(ql), { color: th.positive, width: 1.5 });
  d.text(`φ = ${formatBR(lat, 3)}°`, ex, ey - er - 0.12 * A, { size: 11 });
  const Treal = Math.abs((2 * Math.PI) / (OMEGA_T * Math.sin(ql))) / 3600;
  const Tsim = Math.abs((2 * Math.PI) / wz(p));
  const lines = [
    `azimute medido: ${s.az.toFixed(1)}°`,
    `previsto −Ω sen φ · t: ${deg(qp).toFixed(1)}°`,
    Math.abs(lat) < 0.01 ? "no equador o plano não gira" : `volta completa: ${Treal.toFixed(1)} h reais`,
    Number.isFinite(Tsim) ? `(na tela: ${formatBR(Tsim, 3)} s, Terra ${formatBR(num(p, "k", 2000), 4)}× mais rápida)` : "",
    `período de oscilação: ${formatBR(2 * Math.PI * Math.sqrt(num(p, "Lf", 67) / G(p)), 3)} s`,
    lat > 0 ? "gira no sentido horário (norte)" : lat < 0 ? "gira no sentido anti-horário (sul)" : "",
  ];
  lines.forEach((l, i) => d.text(l, 1.5 * A, -0.1 * A - i * 0.17 * A, { size: 11, align: "left", color: i < 2 ? (i ? th.positive : th.series[2]) : th.text }));
}

export default referenciaisNaoInerciais;
