/**
 * Física das "máquinas de moto-perpétuo" e de duas máquinas reais que parecem
 * uma: o pássaro bebedor (máquina térmica) e o termômetro de Galileu.
 * SI em tudo, exceto onde indicado (°C).
 */

export const G = 9.81;
export const RHO_W = 1000;

// ---------- Rodas desbalanceadas (Bhaskara e braços articulados) ----------

/** Raio da roda (m) e momento de inércia do aro e raios (kg·m²). */
export const R_WHEEL = 1;
export const I_RIM = 2.5;

/** Posição (lab, m) de cada peso na roda girada de θ. Configuração quase-estática: cada peso no ponto mais baixo que pode alcançar. */
export function wheelMasses(kind: number, K: number, theta: number): [number, number][] {
  const out: [number, number][] = [];
  for (let k = 0; k < K; k++) {
    const phi = theta + (2 * Math.PI * k) / K;
    const c = Math.cos(phi), s = Math.sin(phi);
    const lab = (u: number, w: number): [number, number] => [u * c - w * s, u * s + w * c];
    if (kind === 0) {
      // Bhaskara: tubo reto inclinado de (0,30; 0) a (0,92; −0,32) no referencial da roda; a bola rola para a ponta mais baixa.
      const a = lab(0.3, 0), b = lab(0.92, -0.32);
      out.push(a[1] <= b[1] ? a : b);
    } else {
      // Braço articulado na dobradiça (0,62; 0), comprimento 0,36, ângulo α ∈ [−110°, 0°] em relação ao raio.
      const hu = 0.62, l = 0.36, aMin = (-110 * Math.PI) / 180, aMax = 0;
      const hx = hu * c, hy = hu * s;
      let target = -Math.PI / 2 - phi; // aponta para baixo
      target = Math.atan2(Math.sin(target), Math.cos(target));
      const pos = (a: number): [number, number] => [hx + l * Math.cos(phi + a), hy + l * Math.sin(phi + a)];
      if (target >= aMin && target <= aMax) out.push(pos(target));
      else {
        const p1 = pos(aMin), p2 = pos(aMax);
        out.push(p1[1] <= p2[1] ? p1 : p2);
      }
    }
  }
  return out;
}

/** Torque da gravidade em relação ao eixo (N·m, positivo = anti-horário). */
export function wheelTorque(kind: number, K: number, m: number, theta: number): number {
  return -m * G * wheelMasses(kind, K, theta).reduce((a, [x]) => a + x, 0);
}

/** Energia potencial gravitacional dos pesos (J). */
export function wheelU(kind: number, K: number, m: number, theta: number): number {
  return m * G * wheelMasses(kind, K, theta).reduce((a, [, y]) => a + y, 0);
}

export const wheelInertia = (K: number, m: number) => I_RIM + K * m * 0.7 * 0.7;

/** Torque médio numa volta completa: (1/2π)∮τ dθ. */
export function meanTorque(kind: number, K: number, m: number, n = 3600): number {
  let s = 0;
  for (let i = 0; i < n; i++) s += wheelTorque(kind, K, m, (2 * Math.PI * (i + 0.5)) / n);
  return s / n;
}

/** Quantos pesos estão de cada lado do eixo e a soma dos braços de alavanca. */
export function sides(kind: number, K: number, theta: number) {
  let nL = 0, nR = 0, armL = 0, armR = 0;
  for (const [x] of wheelMasses(kind, K, theta)) {
    if (x < 0) { nL++; armL -= x; } else { nR++; armR += x; }
  }
  return { nL, nR, armL, armR };
}

// ---------- Moinho de água que bombeia a própria água (Fludd) ----------

export interface Mill {
  Q: number; // vazão que passa pela roda, m³/s
  H: number; // altura de queda, m
  etaR: number; // rendimento da roda
  etaB: number; // rendimento da bomba
  load: number; // potência útil retirada (moinho), W
}

export function millBalance(m: Mill) {
  const Pdisp = RHO_W * G * m.Q * m.H; // potência que a água entrega ao cair
  const Proda = m.etaR * Pdisp;
  const Pbomba = Math.max(0, Proda - m.load);
  const Qp = (Pbomba * m.etaB) / (RHO_W * G * m.H);
  const Pnecessaria = Pdisp / m.etaB; // para devolver toda a água
  return { Pdisp, Proda, Qp, Pnecessaria, deficit: m.Q - Qp };
}

// ---------- Rampa magnética (Wilkins) ----------

/** Laço fechado: rampa A→H (furo) e calha de retorno H→A, em metros. */
const LOOP_PTS: [number, number][] = [
  [-2.4, 0.0], [-1.2, 0.5], [0.0, 1.0], [1.2, 1.5], // rampa
  [1.6, 1.1], [1.65, 0.4], [1.1, -0.2], [0.0, -0.35], [-1.2, -0.35], [-2.1, -0.25],
];
export const MAGNET: [number, number] = [1.35, 1.95];

function catmull(p0: number, p1: number, p2: number, p3: number, t: number) {
  return 0.5 * (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);
}

/** Pontos do laço amostrados uniformemente em comprimento de arco. */
export const LOOP = (() => {
  const n = LOOP_PTS.length;
  const raw: [number, number][] = [];
  for (let i = 0; i < n; i++) {
    const p0 = LOOP_PTS[(i - 1 + n) % n]!, p1 = LOOP_PTS[i]!, p2 = LOOP_PTS[(i + 1) % n]!, p3 = LOOP_PTS[(i + 2) % n]!;
    for (let k = 0; k < 40; k++) {
      const t = k / 40;
      raw.push([catmull(p0[0], p1[0], p2[0], p3[0], t), catmull(p0[1], p1[1], p2[1], p3[1], t)]);
    }
  }
  const cum = [0];
  for (let i = 1; i <= raw.length; i++) {
    const a = raw[i - 1]!, b = raw[i % raw.length]!;
    cum.push(cum[i - 1]! + Math.hypot(b[0] - a[0], b[1] - a[1]));
  }
  return { raw, cum, length: cum[cum.length - 1]! };
})();

/** Ponto do laço no comprimento de arco s (periódico). */
export function loopAt(s: number): [number, number] {
  const L = LOOP.length;
  const u = ((s % L) + L) % L;
  let lo = 0, hi = LOOP.raw.length;
  while (hi - lo > 1) {
    const m = (lo + hi) >> 1;
    if (LOOP.cum[m]! <= u) lo = m;
    else hi = m;
  }
  const a = LOOP.raw[lo]!, b = LOOP.raw[(lo + 1) % LOOP.raw.length]!;
  const f = (u - LOOP.cum[lo]!) / Math.max(1e-12, LOOP.cum[lo + 1]! - LOOP.cum[lo]!);
  return [a[0] + (b[0] - a[0]) * f, a[1] + (b[1] - a[1]) * f];
}
/** Comprimento de arco do furo (fim da rampa). */
export const S_HOLE = LOOP.cum[3 * 40]!;

/** Potencial por unidade de massa (J/kg): gravidade + ímã (modelo suave, atração ∝ 1/d² no potencial). */
export function magPhi(s: number, kmag: number): number {
  const [x, y] = loopAt(s);
  const d2 = (x - MAGNET[0]) ** 2 + (y - MAGNET[1]) ** 2;
  return G * y - (kmag * 1.5 * G) / (d2 + 0.04);
}
export const magForce = (s: number, kmag: number) => -(magPhi(s + 1e-4, kmag) - magPhi(s - 1e-4, kmag)) / 2e-4;

// ---------- Pássaro bebedor ----------

/** Pressão de vapor do diclorometano (Antoine), Pa, t em °C. */
export const psatDCM = (t: number) => 133.322 * 10 ** (7.0803 - 1138.91 / (231.45 + t));
export const RHO_DCM = 1326;
/** Altura da coluna para o pássaro tombar (m), massa de líquido que sobe (kg). */
export const H_TIP = 0.06;
export const M_COL = 0.002;
/** Tempo característico de resfriamento da cabeça (s), área e coeficiente de troca da cabeça. */
export const TAU_HEAD = 400;
export const A_HEAD = 1e-3;
export const H_CONV = 10;

/** Pressão de saturação da água (Magnus), Pa, t em °C. */
export const esat = (t: number) => 611.2 * Math.exp((17.62 * t) / (243.12 + t));
/** Temperatura de bulbo úmido (°C) com a equação psicrométrica. */
export function wetBulb(t: number, ur: number, P = 101325): number {
  const e = ur * esat(t);
  let lo = -40, hi = t;
  for (let i = 0; i < 80; i++) {
    const m = (lo + hi) / 2;
    if (esat(m) - 6.62e-4 * P * (t - m) > e) hi = m;
    else lo = m;
  }
  return (lo + hi) / 2;
}

/** Altura da coluna de diclorometano para a cabeça a th e o corpo a tb (°C). */
export const columnHeight = (tb: number, th: number) => (psatDCM(tb) - psatDCM(th)) / (RHO_DCM * G);

/** Resultados do ciclo do pássaro para ar a t (°C) com umidade relativa ur (0–1). */
export function birdCycle(t: number, ur: number) {
  const tu = wetBulb(t, ur);
  const dT = t - tu;
  // ΔT da cabeça para a coluna atingir H_TIP (linearizando a pressão de vapor)
  const dpdT = (psatDCM(t + 0.05) - psatDCM(t - 0.05)) / 0.1;
  const dTneed = (H_TIP * RHO_DCM * G) / dpdT;
  const period = dT > dTneed ? -TAU_HEAD * Math.log(1 - dTneed / dT) : Infinity;
  const W = M_COL * G * H_TIP;
  const Pheat = H_CONV * A_HEAD * dT; // calor que o ar entrega à cabeça (vai para a evaporação)
  const Q = Pheat * period;
  return { tu, dT, dTneed, period, W, Q, eta: Number.isFinite(period) && Q > 0 ? W / Q : 0, carnot: dT / (t + 273.15) };
}

// ---------- Termômetro de Galileu ----------

export const BETA = 1.0e-3; // 1/K, expansão do líquido
export const RHO20 = 800; // kg/m³ a 20 °C
export const rhoLiquid = (t: number) => RHO20 / (1 + BETA * (t - 20));
export const TAGS = [16, 18, 20, 22, 24, 26, 28];
export const V_AMP = 4e-6;
export const B_DRAG = 8e-3;
export const COL_H = 0.3;
export const SPACING = 0.032;

/** Leitura: menor etiqueta entre as ampolas que flutuam (NaN se nenhuma flutua). */
export function galileoReading(t: number): number {
  const floating = TAGS.filter((tg) => rhoLiquid(tg) < rhoLiquid(t));
  return floating.length ? Math.min(...floating) : NaN;
}

/** Velocidade terminal (m/s, positivo para cima) de uma ampola com etiqueta tg num líquido a t. */
export const terminalV = (tg: number, t: number) => ((rhoLiquid(t) - rhoLiquid(tg)) * V_AMP * G) / B_DRAG;
