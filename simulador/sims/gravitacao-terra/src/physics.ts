// Física da gravitação perto da Terra e dentro dela (Halliday, cap. 13).

/** Constante gravitacional (CODATA 2018), N·m²/kg². */
export const G = 6.6743e-11;
/** Massa da Terra (kg), raio médio (m) e GM (m³/s²). */
export const ME = 5.972e24;
export const RE = 6.371e6;
export const GM = G * ME;
/** Dia sideral (h): a Terra gira 360° em relação às estrelas. */
export const SIDEREAL_DAY_H = 23.9345;
/** g de referência para a Terra no elevador de Einstein (m/s²). */
export const G0 = 9.8;

// ---------- Superposição ----------

export interface PointMass {
  x: number;
  y: number;
  m: number;
}

/** Força de cada massa sobre a partícula de teste m0 em (x, y), e a resultante (N). */
export function netForce(sources: PointMass[], x: number, y: number, m0: number) {
  const parts = sources.map((s) => {
    const dx = s.x - x;
    const dy = s.y - y;
    const r = Math.hypot(dx, dy);
    if (r < 1e-9) return { fx: 0, fy: 0, F: 0, r };
    const F = (G * s.m * m0) / (r * r);
    return { fx: (F * dx) / r, fy: (F * dy) / r, F, r };
  });
  const fx = parts.reduce((a, q) => a + q.fx, 0);
  const fy = parts.reduce((a, q) => a + q.fy, 0);
  return { parts, fx, fy, F: Math.hypot(fx, fy) };
}

// ---------- g com a altitude e a latitude ----------

/** Aceleração gravitacional (só gravitação) a uma altitude h (m), Terra esférica. */
export const gAt = (h: number) => GM / (RE + h) ** 2;

/** Velocidade angular de rotação (rad/s) para um dia de `dayH` horas. */
export const omegaOf = (dayH: number) => (2 * Math.PI) / (dayH * 3600);

/**
 * Gravidade efetiva para um corpo em repouso em relação à Terra que gira, na
 * latitude `latDeg` e altitude `h`. Componentes no referencial local:
 * radial (para cima) e horizontal (para o norte).
 */
export function gEffective(h: number, latDeg: number, dayH = SIDEREAL_DAY_H) {
  const phi = (latDeg * Math.PI) / 180;
  const r = RE + h;
  const w = omegaOf(dayH);
  const g = gAt(h);
  const ac = w * w * r * Math.cos(phi); // centrípeta necessária, aponta para o eixo
  const up = -g + ac * Math.cos(phi);
  const north = -ac * Math.sin(phi);
  const mag = Math.hypot(up, north);
  /** Desvio do prumo em relação à vertical geocêntrica (graus). */
  const dev = (Math.atan2(Math.abs(north), Math.abs(up)) * 180) / Math.PI;
  return { g, ac, up, north, mag, dev, w, r };
}

/** Fórmula internacional da gravidade (Somigliana, elipsoide WGS 84), ao nível do mar (m/s²). */
export function somigliana(latDeg: number): number {
  const s2 = Math.sin((latDeg * Math.PI) / 180) ** 2;
  return (9.7803253359 * (1 + 0.00193185265241 * s2)) / Math.sqrt(1 - 0.00669437999013 * s2);
}

/** Dia (h) em que o peso aparente no equador se anula: ω²R = g. */
export const weightlessDayH = () => (2 * Math.PI) / Math.sqrt(GM / RE ** 3) / 3600;

/** Raio da órbita geoestacionária (m): g(r) = ω² r. */
export const geoRadius = (dayH = SIDEREAL_DAY_H) => Math.cbrt(GM / omegaOf(dayH) ** 2);

// ---------- Interior ----------

export interface EarthModel {
  /** 0 = uniforme, 1 = núcleo denso + manto, 2 = casca oca. */
  kind: number;
  /** Raio do núcleo (m). */
  rc: number;
  /** Densidade do núcleo (kg/m³). */
  rhoc: number;
}

const V = (r: number) => (4 / 3) * Math.PI * r ** 3;
export const RHO_MEAN = ME / V(RE);

/** Densidade do manto que mantém a massa total igual à da Terra (kg/m³). */
export function mantleDensity(m: EarthModel): number {
  const rc = Math.min(m.rc, RE * 0.999);
  const rhoc = Math.min(m.rhoc, ME / V(rc));
  return (ME - rhoc * V(rc)) / (V(RE) - V(rc));
}

/** Densidade do modelo a uma distância r do centro (kg/m³). */
export function density(r: number, m: EarthModel): number {
  if (r > RE) return 0;
  if (m.kind === 1) return r <= m.rc ? Math.min(m.rhoc, ME / V(m.rc)) : mantleDensity(m);
  if (m.kind === 2) return 0;
  return RHO_MEAN;
}

/** Massa contida numa esfera de raio r (kg). */
export function massInside(r: number, m: EarthModel): number {
  if (r >= RE) return ME;
  if (r <= 0) return 0;
  if (m.kind === 2) return 0;
  if (m.kind === 1) {
    const rhoc = Math.min(m.rhoc, ME / V(m.rc));
    if (r <= m.rc) return rhoc * V(r);
    return rhoc * V(m.rc) + mantleDensity(m) * (V(r) - V(m.rc));
  }
  return ME * (r / RE) ** 3;
}

/** Módulo de g a uma distância r do centro (teorema das cascas: só a massa interna conta). */
export function gInside(r: number, m: EarthModel): number {
  if (r <= 0) return 0;
  return (G * massInside(r, m)) / (r * r);
}

/** Pulsação e período do movimento no túnel de uma Terra uniforme. */
export const omegaTunnel = () => Math.sqrt(GM / RE ** 3);
export const periodTunnel = () => (2 * Math.PI) / omegaTunnel();

/**
 * Derivadas do movimento ao longo de uma corda a distância b do centro:
 * s é a posição ao longo do túnel (0 no meio) e a aceleração é a componente
 * de g ao longo do túnel, −g(r) s / r. As paredes cancelam a componente normal.
 */
export function tunnelDeriv(s: number, v: number, b: number, m: EarthModel): [number, number] {
  const r = Math.hypot(s, b);
  const a = r > 0 ? (-gInside(r, m) * s) / r : 0;
  return [v, a];
}

/** Passo de RK4 para [s, v] no túnel. */
export function tunnelStep(s: number, v: number, b: number, m: EarthModel, h: number): [number, number] {
  const k1 = tunnelDeriv(s, v, b, m);
  const k2 = tunnelDeriv(s + (h / 2) * k1[0], v + (h / 2) * k1[1], b, m);
  const k3 = tunnelDeriv(s + (h / 2) * k2[0], v + (h / 2) * k2[1], b, m);
  const k4 = tunnelDeriv(s + h * k3[0], v + h * k3[1], b, m);
  return [s + (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), v + (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
}

/** Meia-corda: a partícula parte do repouso na boca do túnel, em s = √(R² − b²). */
export const halfChord = (b: number) => Math.sqrt(Math.max(0, RE * RE - b * b));

// ---------- Elevador de Einstein ----------

/** Dimensões da cabine (m). */
export const CAB = { w: 4, h: 3 };

export interface ElevatorCase {
  /** Campo gravitacional externo (m/s², para baixo). */
  gField: number;
  /** Aceleração da cabine em relação ao referencial inercial (m/s², para cima). */
  aCab: number;
}

/** Situações: 0 parada na Terra, 1 foguete no espaço, 2 queda livre na Terra, 3 à deriva no espaço. */
export function elevatorCase(situation: number, a: number, g = G0): ElevatorCase {
  switch (situation) {
    case 1:
      return { gField: 0, aCab: a };
    case 2:
      return { gField: g, aCab: -g };
    case 3:
      return { gField: 0, aCab: 0 };
    default:
      return { gField: g, aCab: 0 };
  }
}

/** Aceleração aparente (dentro da cabine) de um corpo livre: g_ap = g + a_cab (para baixo). */
export const apparentG = (c: ElevatorCase) => c.gField + c.aCab;

/** Altura do piso da cabine no referencial inercial (parte do repouso em 0). */
export const floorY = (c: ElevatorCase, t: number) => 0.5 * c.aCab * t * t;

/**
 * Bola solta do repouso (em relação à cabine) a uma altura h0 do piso, em t = 0.
 * Devolve a altura em relação ao piso e o instante em que toca o piso (Infinity se nunca).
 */
export function ballRel(c: ElevatorCase, h0: number, t: number, radius = 0.15) {
  const ga = apparentG(c);
  const tHit = ga > 1e-12 ? Math.sqrt((2 * Math.max(0, h0 - radius)) / ga) : Infinity;
  const y = t >= tHit ? radius : h0 - 0.5 * ga * t * t;
  return { y, tHit, landed: t >= tHit };
}

/**
 * Pulso de luz emitido na horizontal pela parede esquerda, a uma altura hL,
 * com velocidade c. Na cabine, ele cai com a aceleração aparente:
 * y = hL − g_ap x²/(2c²).
 */
export function lightRel(c: ElevatorCase, hL: number, cLight: number, t: number) {
  const tCross = CAB.w / cLight;
  const tt = Math.min(t, tCross);
  return { x: -CAB.w / 2 + cLight * tt, y: hL - 0.5 * apparentG(c) * tt * tt, tCross, done: t >= tCross };
}

/** Velocidade da luz (m/s) e o desvio real do pulso ao atravessar a cabine (m). */
export const C_LIGHT = 299_792_458;
export const realLightDrop = (gApp: number, width = CAB.w) => 0.5 * gApp * (width / C_LIGHT) ** 2;

/**
 * Energia potencial por unidade de massa (J/kg) a uma distância r do centro,
 * com U(∞) = 0. Por fora, −GM/r; por dentro, integra g de r até R camada a
 * camada (densidade constante em cada camada, então a integral é exata).
 */
export function potential(r: number, m: EarthModel): number {
  if (r >= RE) return -GM / r;
  const layers: [number, number][] =
    m.kind === 1 ? [[0, Math.min(m.rc, RE * 0.999)], [Math.min(m.rc, RE * 0.999), RE]] : [[0, RE]];
  let U = -GM / RE;
  for (let i = layers.length - 1; i >= 0; i--) {
    const [r0, r1] = layers[i]!;
    if (r >= r1) break;
    const lo = Math.max(r, r0);
    const rho = density((r0 + r1) / 2, m);
    const M0 = massInside(r0, m);
    const k = M0 - rho * V(r0);
    // ∫_lo^r1 g dr com g = G[k/r² + (4/3)πρ r]
    const work = G * (k * (1 / Math.max(lo, 1e-9) - 1 / r1) + ((2 / 3) * Math.PI * rho * (r1 * r1 - lo * lo)));
    U -= work;
  }
  return U;
}
