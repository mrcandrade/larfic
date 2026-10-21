import { clamp, defineSim, draw, num, texNum, type Draw, type Params } from "@fisilab/core";
import {
  AU_KM,
  GM_EARTH,
  GU,
  KMS_PER_AUYR,
  MOON_INCL,
  MOON_SYNODIC,
  PLANETS,
  PRESETS,
  R_EARTH,
  R_SUN_KM,
  SIDEREAL_DAY,
  YEAR_DAYS,
  angularMomentum,
  bodyRadius,
  centerOfMass,
  eclipse,
  geoLongitude,
  momentum,
  moonGeo,
  nbodyEnergy,
  nbodyStep,
  orbitPeriod,
  phaseName,
  planetPos,
  presetBodies,
  rGeo,
  synodic,
  toCM,
  v1,
  v2,
  type Body,
} from "./astro.ts";

export * from "./astro.ts";

export const MODOS = ["N corpos (editável)", "Sistema solar em escala", "Movimento retrógrado (geo × helio)", "Fases da Lua e eclipses", "Canhão de Newton", "Satélite geoestacionário"];
export const NCORPOS = 0, ESCALA = 1, RETRO = 2, FASES = 3, CANHAO = 4, GEO = 5;
/** Unidade do tempo físico de cada modo e quanto passa por segundo de tela (× rapidez). */
const UNIT = ["ano", "ano", "dia", "dia", "s", "s"];
const RATE = [0.25, 1, 30, 3, 600, 3600];
/** Corpos que podem ser observados no modo retrógrado (índices em PLANETS). */
const RETRO_TARGETS = [0, 1, 3, 4, 5];

export const modeOf = (p: Params) => clamp(Math.round(num(p, "modo")), 0, 5);
const rad = (d: number) => (d * Math.PI) / 180;
const deg = (r: number) => (r * 180) / Math.PI;
const fmt = (v: number, d = 3) => (Number.isFinite(v) ? Number(v.toPrecision(d)).toString().replace(".", ",") : "—");

export interface SState {
  /** Tempo físico na unidade do modo (ano, dia ou s). */
  tf: number;
  bodies: Body[];
  nextId: number;
  sel: number;
  /** Canhão: [x, y, vx, vy] (m, m/s). */
  y: number[];
  /** Canhão: o projétil caiu. */
  hit: boolean;
  drag: { kind: "pos" | "vel"; id: number } | null;
}

/** Escala de desenho das setas de velocidade no modo n corpos (UA por UA/ano). */
const KV = 0.12;
export const retroPlanet = (p: Params) => PLANETS[RETRO_TARGETS[clamp(Math.round(num(p, "alvo", 2)), 0, RETRO_TARGETS.length - 1)]!]!;
const scalePlanet = (p: Params) => PLANETS[clamp(Math.round(num(p, "planeta", 2)), 0, 7)]!;

/** Taxa de variação da longitude geocêntrica (°/dia), por diferença central. */
export function lambdaRate(p: Params, tDays: number): number {
  const pl = retroPlanet(p), h = 0.5;
  let d = geoLongitude(pl, (tDays + h) / YEAR_DAYS) - geoLongitude(pl, (tDays - h) / YEAR_DAYS);
  if (d > Math.PI) d -= 2 * Math.PI;
  if (d < -Math.PI) d += 2 * Math.PI;
  return deg(d) / (2 * h);
}
/** Dia (desde J2000) da próxima oposição/conjunção inferior do planeta escolhido a partir de 2025. */
function retroStart(p: Params): number {
  const pl = retroPlanet(p);
  // Procura o mínimo de dλ/dt (meio do laço retrógrado) e começa 120 dias antes.
  let best = 9200, bv = Infinity;
  const span = synodic(pl.a ** 1.5) * YEAR_DAYS;
  for (let t = 9200; t < 9200 + span; t += 2) {
    const v = lambdaRate({ ...p }, t);
    if (v < bv) [bv, best] = [v, t];
  }
  return best - 0.45 * span * Math.min(1, 300 / span);
}

function cannonInit(p: Params): number[] {
  const h = num(p, "h", 200) * 1e3;
  return [0, R_EARTH + h, num(p, "v", 7.8) * 1e3, 0];
}
function cannonRhs(y: number[]): number[] {
  const r = Math.hypot(y[0]!, y[1]!), k = -GM_EARTH / r ** 3;
  return [y[2]!, y[3]!, k * y[0]!, k * y[1]!];
}
function rk4(f: (y: number[]) => number[], y: number[], h: number): number[] {
  const k1 = f(y), k2 = f(y.map((v, i) => v + (h / 2) * k1[i]!)), k3 = f(y.map((v, i) => v + (h / 2) * k2[i]!)), k4 = f(y.map((v, i) => v + h * k3[i]!));
  return y.map((v, i) => v + (h / 6) * (k1[i]! + 2 * k2[i]! + 2 * k3[i]! + k4[i]!));
}
/** Elementos da órbita do projétil: energia específica, semieixo e excentricidade. */
export function cannonOrbit(y: number[]) {
  const r = Math.hypot(y[0]!, y[1]!), v2s = y[2]! ** 2 + y[3]! ** 2;
  const eps = v2s / 2 - GM_EARTH / r;
  const hz = y[0]! * y[3]! - y[1]! * y[2]!;
  const a = -GM_EARTH / (2 * eps);
  const e = Math.sqrt(Math.max(0, 1 + (2 * eps * hz * hz) / GM_EARTH ** 2));
  return { r, eps, a, e, hz };
}

const geoR = (p: Params) => num(p, "rsat", 42164) * 1e3;
const earthAngle = (tf: number) => (2 * Math.PI * tf) / SIDEREAL_DAY;
/** Longitude do ponto sob o satélite em relação ao solo (°), partindo de 0. */
export const subLongitude = (p: Params, tf: number) => {
  const ws = (2 * Math.PI) / orbitPeriod(geoR(p));
  return deg((ws - (2 * Math.PI) / SIDEREAL_DAY) * tf);
};

export const sistemaSolar = defineSim<SState>({
  id: "sistema-solar",
  title: "Sistema solar: n corpos, fases da Lua, retrogradação e satélites",
  course: "FG I",
  topic: "Gravitação",
  priority: "P2",
  summary:
    "Monte seu próprio sistema de até 6 corpos (arraste posições e velocidades) com integrador simplético, explore o sistema solar com dados reais, veja o laço retrógrado de Marte lado a lado nos referenciais geocêntrico e heliocêntrico, as fases da Lua com eclipses, o canhão de Newton e o satélite geoestacionário.",
  equations: [
    String.raw`\ddot{\vec r}_i = \sum_{j\ne i} \frac{G m_j (\vec r_j - \vec r_i)}{|\vec r_j - \vec r_i|^3} \qquad G = 4\pi^2\ \text{UA}^3/(M_\odot\,\text{ano}^2)`,
    String.raw`T^2 = a^3\ \text{(anos, UA)} \qquad \frac{1}{T_{\text{sin}}} = \left|\frac{1}{T_\oplus} - \frac{1}{T}\right|`,
    String.raw`v_1 = \sqrt{\frac{GM}{R+h}} \qquad v_2 = \sqrt{\frac{2GM}{R+h}} \qquad r_{\text{geo}} = \sqrt[3]{\frac{GM\,T_{\text{sid}}^2}{4\pi^2}}`,
    String.raw`\text{fração iluminada da Lua} = \frac{1 - \cos\psi}{2}`,
  ],
  liveEquations(s, p) {
    switch (modeOf(p)) {
      case NCORPOS: {
        const [px, py] = momentum(s.bodies);
        return [String.raw`E = ${texNum(nbodyEnergy(s.bodies))}\ M_\odot\text{UA}^2/\text{ano}^2 \quad \vec P = (${texNum(px)};\ ${texNum(py)}) \quad L = ${texNum(angularMomentum(s.bodies))}`];
      }
      case ESCALA: {
        const pl = scalePlanet(p);
        return [String.raw`\text{${pl.name}: } \frac{T^2}{a^3} = \frac{${texNum(pl.T)}^2}{${texNum(pl.a)}^3} = ${texNum(pl.T ** 2 / pl.a ** 3, 4)}\ \text{ano}^2/\text{UA}^3 \quad g = \frac{GM}{R^2} = ${texNum((6.674e-11 * pl.m) / (pl.R * 1e3) ** 2)}\ \text{m/s}^2`];
      }
      case RETRO: {
        const pl = retroPlanet(p);
        return [String.raw`T_{\text{sin}} = \frac{1}{|1 - 1/${texNum(pl.T)}|} = ${texNum(synodic(pl.T) * YEAR_DAYS)}\ \text{dias} \quad \dot\lambda = ${texNum(lambdaRate(p, retroT0(p, s)))}^\circ/\text{dia}`];
      }
      case FASES: {
        const g = moonGeo(s.tf, num(p, "nodo", 40));
        return [String.raw`\psi = ${texNum(deg(g.sep))}^\circ \quad k = \frac{1-\cos\psi}{2} = ${texNum(g.k * 100)}\% \quad T_{\text{sin}} = \frac{1}{1/${texNum(27.3217)} - 1/${texNum(YEAR_DAYS)}} = ${texNum(MOON_SYNODIC, 4)}\ \text{dias}`];
      }
      case CANHAO: {
        const h = num(p, "h", 200) * 1e3;
        return [String.raw`v_1 = \sqrt{\frac{GM}{R+h}} = ${texNum(v1(h) / 1e3)}\ \text{km/s} \quad v_2 = ${texNum(v2(h) / 1e3)}\ \text{km/s} \quad v_0 = ${texNum(num(p, "v", 7.8))}\ \text{km/s}`];
      }
      default:
        return [String.raw`T = 2\pi\sqrt{\frac{r^3}{GM}} = ${texNum(orbitPeriod(geoR(p)) / 3600, 4)}\ \text{h} \quad r_{\text{geo}} = ${texNum(rGeo() / 1e3, 5)}\ \text{km} \quad \text{deriva} = ${texNum(subLongitude(p, 86400))}^\circ/\text{dia}`];
    }
  },

  params: [
    { key: "modo", label: "Experimento", unit: "", min: 0, max: 5, step: 1, default: 0, options: MODOS.map((label, value) => ({ value, label })) },
    { key: "rapidez", label: "Rapidez da animação", unit: "×", min: 0.05, max: 40, step: 0.05, default: 1, log: true, live: true },
    { key: "preset", label: "N corpos: configuração inicial", unit: "", min: 0, max: PRESETS.length - 1, step: 1, default: 0, options: PRESETS.map((label, value) => ({ value, label })) },
    { key: "zoom", label: "N corpos: meia largura da vista", unit: "UA", min: 0.5, max: 10, step: 0.1, default: 3, live: true },
    {
      key: "dist",
      label: "Escala: distâncias",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Planetas internos (até 1,8 UA)" },
        { value: 1, label: "Todos, em escala linear" },
        { value: 2, label: "Todos, distância em escala logarítmica" },
      ],
    },
    { key: "planeta", label: "Escala: planeta em destaque", unit: "", min: 0, max: 7, step: 1, default: 2, live: true, options: PLANETS.map((pl, value) => ({ value, label: pl.name })) },
    { key: "alvo", label: "Retrógrado: planeta observado", unit: "", min: 0, max: RETRO_TARGETS.length - 1, step: 1, default: 2, options: RETRO_TARGETS.map((i, value) => ({ value, label: PLANETS[i]!.name })) },
    { key: "nodo", label: "Lua: ângulo inicial entre a linha dos nodos e o Sol", unit: "°", min: 0, max: 180, step: 1, default: 40 },
    {
      key: "hemis",
      label: "Lua: observador no hemisfério",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Sul (Brasil)" },
        { value: 1, label: "Norte" },
      ],
    },
    { key: "v", label: "Canhão: velocidade horizontal v₀", unit: "km/s", min: 1, max: 13, step: 0.05, default: 7.8 },
    { key: "h", label: "Canhão: altura da montanha", unit: "km", min: 10, max: 2000, step: 10, default: 200 },
    { key: "rsat", label: "Satélite: raio da órbita", unit: "km", min: 7000, max: 60000, step: 10, default: 42164 },
  ],

  observables: [
    { key: "tano", label: "Tempo simulado", unit: "ano", value: (s, p) => toDays(s.tf, p) / YEAR_DAYS },
    { key: "tdia", label: "Tempo simulado", unit: "dia", value: (s, p) => toDays(s.tf, p) },
    { key: "E", label: "N corpos: energia total", unit: "M☉·UA²/ano²", value: (s, p) => (modeOf(p) === NCORPOS ? nbodyEnergy(s.bodies) : 0) },
    { key: "L", label: "N corpos: momento angular total", unit: "M☉·UA²/ano", value: (s, p) => (modeOf(p) === NCORPOS ? angularMomentum(s.bodies) : 0) },
    { key: "nc", label: "N corpos: número de corpos", unit: "", value: (s) => s.bodies.length },
    {
      key: "r12",
      label: "N corpos: distância corpo 1 – corpo 2",
      unit: "UA",
      value: (s) => (s.bodies.length > 1 ? Math.hypot(s.bodies[1]!.x - s.bodies[0]!.x, s.bodies[1]!.y - s.bodies[0]!.y) : 0),
    },
    { key: "rpl", label: "Escala: distância do planeta ao Sol", unit: "UA", value: (s, p) => (modeOf(p) === ESCALA ? Math.hypot(...planetPos(scalePlanet(p), s.tf)) : 0) },
    { key: "lambda", label: "Retrógrado: longitude geocêntrica λ", unit: "°", value: (s, p) => (modeOf(p) === RETRO ? deg(geoLongitude(retroPlanet(p), retroT0(p, s) / YEAR_DAYS)) : 0) },
    { key: "dlambda", label: "Retrógrado: dλ/dt", unit: "°/dia", value: (s, p) => (modeOf(p) === RETRO ? lambdaRate(p, retroT0(p, s)) : 0) },
    { key: "fracao", label: "Lua: fração iluminada", unit: "%", value: (s, p) => (modeOf(p) === FASES ? moonGeo(s.tf, num(p, "nodo", 40)).k * 100 : 0) },
    { key: "idade", label: "Lua: idade desde a lua nova", unit: "dia", value: (s, p) => (modeOf(p) === FASES ? (moonGeo(s.tf, num(p, "nodo", 40)).elong / (2 * Math.PI)) * MOON_SYNODIC : 0) },
    { key: "betaLua", label: "Lua: latitude eclíptica", unit: "°", value: (s, p) => (modeOf(p) === FASES ? deg(moonGeo(s.tf, num(p, "nodo", 40)).beta) : 0) },
    { key: "alt", label: "Canhão: altitude", unit: "km", value: (s, p) => (modeOf(p) === CANHAO ? (Math.hypot(s.y[0]!, s.y[1]!) - R_EARTH) / 1e3 : 0) },
    { key: "vel", label: "Canhão: velocidade", unit: "km/s", value: (s, p) => (modeOf(p) === CANHAO ? Math.hypot(s.y[2]!, s.y[3]!) / 1e3 : 0) },
    {
      key: "alcance",
      label: "Canhão: arco percorrido sobre a superfície",
      unit: "km",
      value: (s, p) => {
        if (modeOf(p) !== CANHAO) return 0;
        let a = Math.atan2(s.y[0]!, s.y[1]!);
        if (a < 0) a += 2 * Math.PI;
        return (a * R_EARTH) / 1e3;
      },
    },
    { key: "Tsat", label: "Satélite: período orbital", unit: "h", value: (_s, p) => orbitPeriod(geoR(p)) / 3600 },
    { key: "deriva", label: "Satélite: longitude sob o satélite (deriva)", unit: "°", value: (s, p) => (modeOf(p) === GEO ? subLongitude(p, s.tf) : 0) },
  ],
  conserved: "E",
  chart: { x: "t", y: "r12" },

  scenarios: [
    {
      id: "ncorpos",
      label: "Monte seu sistema",
      params: { modo: NCORPOS, preset: 1, zoom: 3, rapidez: 1 },
      guide: `### Gravitação de n corpos
1. Arraste um corpo para mudar a posição; arraste a **ponta da seta** para mudar a velocidade.
2. Use **Adicionar corpo** (até 6), **Massa ×10 / ÷10** no corpo selecionado e **Ir para o centro de massa**.
3. A energia total e o momento angular ficam constantes (integrador simplético) — até dois corpos colidirem e se fundirem.
4. Na estrela binária, o planeta distante orbita o **centro de massa** (×) das duas estrelas.
5. Compare com a sim *Órbitas e leis de Kepler*, que mede as leis de Kepler em detalhe.`,
      predict: [
        {
          question: "Se a massa do Sol dobrar de repente, mantendo a velocidade da Terra, a órbita da Terra:",
          options: ["continua igual", "fica menor e elíptica, com o periélio onde a Terra está", "a Terra escapa"],
          answer: 1,
          explanation: "A velocidade circular passa a $\\sqrt{2}$ vezes a atual; com velocidade menor que a circular, a Terra está no afélio de uma elipse menor.",
        },
      ],
    },
    {
      id: "escala",
      label: "Sistema solar em escala",
      params: { modo: ESCALA, dist: 2, planeta: 4, rapidez: 1 },
      guide: `### Tamanhos, massas e períodos reais
1. Em escala linear, os planetas internos se espremem perto do Sol: use a escala logarítmica para ver todos.
2. Escolha cada planeta e confira $T^2/a^3 \\approx 1$ ano²/UA³ (3ª lei).
3. Na faixa de baixo, os tamanhos estão na mesma escala: Júpiter é ~11 Terras, e o Sol (arco) ~10 Júpiteres.
4. Note as rotações retrógradas de Vênus e Urano (período negativo).`,
    },
    {
      id: "retro",
      label: "Movimento retrógrado de Marte",
      params: { modo: RETRO, alvo: 2, rapidez: 1 },
      guide: `### Laço retrógrado
1. À esquerda (heliocêntrico), as linhas de visada Terra → Marte. À direita (geocêntrico), Marte visto da Terra desenha laços — os epiciclos de Ptolomeu.
2. Perto da **oposição**, a Terra ultrapassa Marte pela parte de dentro e $\\dot\\lambda < 0$: Marte anda "para trás" no céu.
3. O laço se repete a cada período sinódico (~780 dias). Troque para Júpiter e Vênus.`,
      predict: [
        {
          question: "Quando Marte faz o movimento retrógrado, ele está:",
          options: ["em conjunção com o Sol (atrás dele)", "perto da oposição (do lado oposto ao Sol)", "em qualquer posição"],
          answer: 1,
          explanation: "A retrogradação acontece quando a Terra, mais rápida, ultrapassa Marte; isso ocorre perto da oposição, quando Marte está mais perto e mais brilhante.",
        },
      ],
    },
    {
      id: "fases",
      label: "Fases da Lua e eclipses",
      params: { modo: FASES, nodo: 0, hemis: 0, rapidez: 1 },
      guide: `### Fases e eclipses
1. Metade da Lua está sempre iluminada pelo Sol; a fase depende de quanto dessa metade vemos da Terra.
2. Mês sinódico (de uma lua nova a outra) = 29,53 dias > mês sideral (27,32 dias), porque a Terra também anda em volta do Sol.
3. A órbita da Lua é inclinada 5,1°: só há **eclipse** quando a lua nova ou cheia acontece perto da linha dos nodos. Com o nodo alinhado ao Sol ($0°$) começa com eclipse solar; mude para 40° e veja os meses sem eclipse.
4. No hemisfério Sul a lua crescente aparece iluminada à **esquerda**.`,
      predict: [
        {
          question: "Por que não há eclipse solar em toda lua nova?",
          options: ["Porque a Lua é pequena demais", "Porque a órbita da Lua é inclinada em relação à da Terra", "Porque a Terra gira"],
          answer: 1,
          explanation: "Com 5,1° de inclinação, na maioria das luas novas a Lua passa acima ou abaixo do Sol no céu; o alinhamento só ocorre perto dos nodos.",
        },
      ],
    },
    {
      id: "canhao",
      label: "Canhão de Newton",
      params: { modo: CANHAO, h: 200, v: 7.8, rapidez: 1 },
      guide: `### Velocidades cósmicas
1. Com $v_0$ abaixo de $v_1$ o projétil cai de volta, cada vez mais longe.
2. Em $v_0 = v_1 \\approx 7{,}8$ km/s (para 200 km) a órbita é circular: o projétil "cai" o tempo todo sem tocar o chão.
3. Entre $v_1$ e $v_2$ a órbita é elíptica; a partir de $v_2 \\approx 11{,}0$ km/s ele escapa (parábola/hipérbole).
4. A linha tracejada é a cônica prevista pelas condições iniciais.`,
      predict: [
        {
          question: "Lançado horizontalmente a 9 km/s de 200 km de altura, o projétil:",
          options: ["cai na Terra", "fica numa órbita elíptica", "escapa da Terra"],
          answer: 1,
          explanation: "$v_1 = 7{,}8$ km/s < 9 km/s < $v_2 = 11{,}0$ km/s: energia negativa e velocidade acima da circular — elipse com perigeu no ponto de lançamento.",
        },
      ],
    },
    {
      id: "geo",
      label: "Satélite geoestacionário",
      params: { modo: GEO, rsat: 42164, rapidez: 1 },
      guide: `### Parado no céu
1. Com $r = 42\\,164$ km o período é um dia sideral (23 h 56 min): o satélite acompanha a rotação da Terra e a antena em Brasília não precisa se mexer.
2. Diminua o raio: o satélite fica mais rápido que a Terra e deriva para leste. Aumente: deriva para oeste.
3. Compare com a ISS (r ≈ 6 780 km, ~92 min).`,
    },
  ],

  exercises: [
    {
      id: "v1",
      prompt: "Qual é a velocidade de uma órbita circular a {h} km de altitude? (GM_Terra = 3,986 × 10^14 m³/s², R = 6 371 km)",
      vary: { h: [200, 2000, 0] },
      fixed: { modo: CANHAO },
      answer: { label: "v₁", unit: "km/s", compute: (p) => v1(num(p, "h") * 1e3) / 1e3 },
      tolerance: 0.01,
    },
    {
      id: "periodo-satelite",
      prompt: "Um satélite em órbita circular tem raio {rsat} km. Qual é o seu período? (GM_Terra = 3,986 × 10^14 m³/s²)",
      vary: { rsat: [7000, 50000, 0] },
      fixed: { modo: GEO },
      answer: { label: "T", unit: "h", compute: (p) => orbitPeriod(num(p, "rsat") * 1e3) / 3600 },
      tolerance: 0.01,
      hint: "T = 2π√(r³/GM).",
    },
  ],

  init(p): SState {
    const m = modeOf(p);
    const bodies = m === NCORPOS ? presetBodies(Math.round(num(p, "preset"))) : [];
    return {
      tf: m === ESCALA ? 25 : m === RETRO ? 0 : 0,
      bodies,
      nextId: 10,
      sel: bodies[1]?.id ?? 1,
      y: m === CANHAO ? cannonInit(p) : [0, 0, 0, 0],
      hit: false,
      drag: null,
    };
  },

  step(s, p, _t, dt): SState {
    const m = modeOf(p);
    const h = RATE[m]! * num(p, "rapidez", 1) * dt;
    if (m === NCORPOS) {
      if (s.drag) return s;
      return { ...s, tf: s.tf + h, bodies: nbodyStep(s.bodies, h) };
    }
    if (m === CANHAO) {
      if (s.hit) return s;
      let y = s.y;
      const n = Math.max(1, Math.ceil(h / 2));
      for (let i = 0; i < n; i++) {
        y = rk4(cannonRhs, y, h / n);
        if (Math.hypot(y[0]!, y[1]!) < R_EARTH) {
          const r = Math.hypot(y[0]!, y[1]!);
          y = [(y[0]! * R_EARTH) / r, (y[1]! * R_EARTH) / r, 0, 0];
          return { ...s, tf: s.tf + (h * (i + 1)) / n, y, hit: true };
        }
      }
      return { ...s, tf: s.tf + h, y };
    }
    return { ...s, tf: s.tf + h };
  },
  dt: 0.01,
  sampleEvery: 2,
  maxSamples: 6000,
  tEnd: 3600,

  viewport(p) {
    switch (modeOf(p)) {
      case NCORPOS: {
        const z = num(p, "zoom", 3);
        return { xMin: -z, xMax: z, yMin: -z * 0.72, yMax: z * 0.72, unit: "UA" };
      }
      case ESCALA:
        return { xMin: -1.35, xMax: 1.35, yMin: -1.45, yMax: 1.05 };
      case RETRO:
        return { xMin: -2.15, xMax: 2.15, yMin: -1.2, yMax: 1.2 };
      case FASES:
        return { xMin: -2.2, xMax: 2.2, yMin: -1.2, yMax: 1.2 };
      default:
        return { xMin: -2.3, xMax: 2.3, yMin: -1.5, yMax: 1.5 };
    }
  },

  pointer: {
    down(s, p, pt) {
      if (modeOf(p) !== NCORPOS) return undefined;
      for (const b of s.bodies) {
        if (Math.hypot(pt.x - (b.x + KV * b.vx), pt.y - (b.y + KV * b.vy)) < 0.08 * num(p, "zoom", 3) / 3) return { ...s, drag: { kind: "vel", id: b.id }, sel: b.id };
      }
      for (const b of s.bodies) {
        if (Math.hypot(pt.x - b.x, pt.y - b.y) < Math.max(bodyRadius(b.m), 0.1 * num(p, "zoom", 3) / 3)) return { ...s, drag: { kind: "pos", id: b.id }, sel: b.id };
      }
      return undefined;
    },
    move(s, _p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      const { kind, id } = s.drag;
      return {
        ...s,
        bodies: s.bodies.map((b) => (b.id !== id ? b : kind === "pos" ? { ...b, x: pt.x, y: pt.y } : { ...b, vx: (pt.x - b.x) / KV, vy: (pt.y - b.y) / KV })),
      };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p) => (modeOf(p) === NCORPOS ? (s.drag ? "grabbing" : "grab") : undefined),
  },
  actions: [
    {
      id: "add",
      label: "N corpos: adicionar corpo",
      run: (s) => {
        if (s.bodies.length >= 6) return s;
        const k = s.bodies.length;
        const r = 1.2 + 0.5 * k, ang = 1.1 * k;
        const M = s.bodies.reduce((a, b) => a + b.m, 0) || 1;
        const v = Math.sqrt((GU * M) / r);
        const b: Body = { id: s.nextId, m: 3e-6, x: r * Math.cos(ang), y: r * Math.sin(ang), vx: -v * Math.sin(ang), vy: v * Math.cos(ang) };
        return { ...s, bodies: [...s.bodies, b], nextId: s.nextId + 1, sel: b.id };
      },
    },
    { id: "remove", label: "N corpos: remover selecionado", run: (s) => ({ ...s, bodies: s.bodies.filter((b) => b.id !== s.sel) }) },
    { id: "mais", label: "Massa ×10", run: (s) => ({ ...s, bodies: s.bodies.map((b) => (b.id === s.sel ? { ...b, m: Math.min(b.m * 10, 5) } : b)) }) },
    { id: "menos", label: "Massa ÷10", run: (s) => ({ ...s, bodies: s.bodies.map((b) => (b.id === s.sel ? { ...b, m: Math.max(b.m / 10, 1e-9) } : b)) }) },
    { id: "cm", label: "Ir para o centro de massa", run: (s) => ({ ...s, bodies: toCM(s.bodies) }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p } = frame;
    switch (modeOf(p)) {
      case NCORPOS:
        return renderNBody(d, s, p, frame.trail);
      case ESCALA:
        return renderScale(d, s, p);
      case RETRO:
        return renderRetro(d, s, p);
      case FASES:
        return renderPhases(d, s, p);
      case CANHAO:
        return renderCannon(d, s, p, frame.trail);
      default:
        return renderGeo(d, s, p);
    }
  },
});

function toDays(tf: number, p: Params): number {
  const u = UNIT[modeOf(p)];
  return u === "ano" ? tf * YEAR_DAYS : u === "dia" ? tf : tf / 86400;
}

/** Dia (desde J2000) mostrado no modo retrógrado. */
const retroCache = new Map<number, number>();
export function retroT0(p: Params, s: SState): number {
  const k = Math.round(num(p, "alvo", 2));
  if (!retroCache.has(k)) retroCache.set(k, retroStart(p));
  return retroCache.get(k)! + s.tf;
}

// ---------------------------------------------------------------------------
// Desenhos
// ---------------------------------------------------------------------------

const COLORS = ["#f2b632", "#3b7dd8", "#c8553d", "#19a979", "#8a63d2", "#d64f8a"];

function renderNBody(d: Draw, s: SState, p: Params, trail: SState[]) {
  const { theme } = d;
  const z = num(p, "zoom", 3);
  d.grid(-z, z, -z, z, z > 4 ? 1 : 0.5);
  const colorOf = (id: number) => COLORS[(id - 1) % COLORS.length]!;
  // Rastros: casa os corpos pelo id
  for (const b of s.bodies) {
    const pts: [number, number][] = [];
    for (const q of trail.slice(-1500)) {
      const c = q.bodies.find((x) => x.id === b.id);
      if (c) pts.push([c.x, c.y]);
    }
    d.polyline(pts, { color: colorOf(b.id), width: 1.2, alpha: 0.55 });
  }
  const [cx, cy] = centerOfMass(s.bodies);
  d.line(cx - 0.06, cy - 0.06, cx + 0.06, cy + 0.06, { color: theme.text, width: 1.5 });
  d.line(cx - 0.06, cy + 0.06, cx + 0.06, cy - 0.06, { color: theme.text, width: 1.5 });
  for (const b of s.bodies) {
    d.circle(b.x, b.y, bodyRadius(b.m), { fill: colorOf(b.id), stroke: b.id === s.sel ? theme.text : undefined, width: 2, minPx: 4 });
    d.arrow(b.x, b.y, KV * b.vx, KV * b.vy, { color: colorOf(b.id), width: 1.8 });
    d.dot(b.x + KV * b.vx, b.y + KV * b.vy, 4, theme.text, 0.6);
    d.text(`${fmt(b.m, 2)} M☉`, b.x, b.y, { color: theme.muted, size: 10, dy: 14 });
  }
  const E = nbodyEnergy(s.bodies);
  d.text(`E = ${fmt(E, 5)}   L = ${fmt(angularMomentum(s.bodies), 5)}   × centro de massa`, -z + 0.05 * z, z * 0.66, { color: theme.text, size: 12, align: "left" });
  d.text("arraste corpos e pontas das setas", -z + 0.05 * z, -z * 0.66, { color: theme.muted, size: 11, align: "left" });
}

function renderScale(d: Draw, s: SState, p: Params) {
  const { theme } = d;
  const mode = Math.round(num(p, "dist"));
  const amax = mode === 0 ? 1.75 : 31;
  const R = 1.0;
  const map = (x: number, y: number): [number, number] => {
    const r = Math.hypot(x, y);
    if (r === 0) return [0, 0];
    const rr = mode === 2 ? (R * Math.log10(1 + (r / 0.3) * 9)) / Math.log10(1 + (31 / 0.3) * 9) : (R * r) / amax;
    return [(x / r) * rr, (y / r) * rr - 0.15];
  };
  d.dot(0, -0.15, 7, "#f2b632");
  const sel = Math.round(num(p, "planeta", 2));
  PLANETS.forEach((pl, i) => {
    if (mode === 0 && pl.a > 1.8) return;
    const orb: [number, number][] = [];
    for (let k = 0; k <= 120; k++) orb.push(map(...planetPos(pl, (k / 120) * pl.a ** 1.5)));
    d.polyline(orb, { color: theme.grid, width: i === sel ? 1.8 : 1 });
    const [x, y] = map(...planetPos(pl, s.tf));
    d.dot(x, y, i === sel ? 6 : 4, pl.color);
    d.text(pl.name, x, y, { color: i === sel ? theme.text : theme.muted, size: 10, dy: -10 });
  });
  const pl = PLANETS[sel]!;
  const [xs, ys] = planetPos(pl, s.tf);
  const info = [
    `${pl.name}: a = ${fmt(pl.a, 4)} UA · e = ${fmt(pl.e, 3)} · T = ${fmt(pl.T, 4)} anos`,
    `massa = ${fmt(pl.m / 5.972e24, 3)} Terras · raio = ${fmt(pl.R, 5)} km · dia sideral = ${fmt(pl.rot, 4)} dias`,
    `distância ao Sol agora = ${fmt(Math.hypot(xs, ys), 4)} UA · ano ${fmt(2000 + s.tf, 5)}`,
  ];
  info.forEach((t, k) => d.text(t, -1.32, 1.0 - 0.07 * k, { color: k === 0 ? theme.text : theme.muted, size: 11, align: "left" }));
  // Faixa de tamanhos em escala (raios reais)
  const y0 = -1.32, k = 0.13 / 69911;
  d.line(-1.35, y0 - 0.13, 1.35, y0 - 0.13, { color: theme.grid });
  d.circle(-1.35 - R_SUN_KM * k + 0.12, y0, R_SUN_KM * k, { fill: "#f2b632", alpha: 0.85 });
  let x = -1.08;
  for (const q of PLANETS) {
    const r = Math.max(q.R * k, 0.004);
    x += r + 0.03;
    d.circle(x, y0, r, { fill: q.color });
    d.text(q.name.slice(0, 3), x, y0 - 0.13, { color: theme.muted, size: 9, dy: 8 });
    x += r + 0.03;
  }
  d.text("tamanhos na mesma escala (Sol à esquerda)", 0.6, y0 + 0.17, { color: theme.muted, size: 10 });
  void AU_KM;
}

function renderRetro(d: Draw, s: SState, p: Params) {
  const { theme } = d;
  const pl = retroPlanet(p), earth = PLANETS[2]!;
  const t = retroT0(p, s), tY = t / YEAR_DAYS;
  const span = Math.max(1.6, pl.a) * 1.05;
  const k = 0.95 / span;
  // Esquerda: heliocêntrico
  const L = (v: [number, number]): [number, number] => [-1.08 + k * v[0], k * v[1]];
  d.text("heliocêntrico", -1.08, 1.12, { color: theme.text, size: 12 });
  for (const q of [earth, pl]) {
    const orb: [number, number][] = [];
    for (let i = 0; i <= 100; i++) orb.push(L(planetPos(q, (i / 100) * q.a ** 1.5)));
    d.polyline(orb, { color: theme.grid });
  }
  d.dot(-1.08, 0, 6, "#f2b632");
  const hist = 300;
  for (let i = 0; i <= 10; i++) {
    const tt = (t - hist + (hist * i) / 10) / YEAR_DAYS;
    const e = L(planetPos(earth, tt)), m = L(planetPos(pl, tt));
    d.line(e[0], e[1], e[0] + (m[0] - e[0]) * 1.6, e[1] + (m[1] - e[1]) * 1.6, { color: theme.accent, width: 1, alpha: 0.15 + 0.08 * i });
  }
  const E = L(planetPos(earth, tY)), M = L(planetPos(pl, tY));
  d.dot(E[0], E[1], 5, earth.color);
  d.dot(M[0], M[1], 5, pl.color);
  d.line(E[0], E[1], M[0], M[1], { color: theme.accent, width: 1.5 });
  // Direita: geocêntrico
  const R2 = (v: [number, number]): [number, number] => [1.08 + k * 0.5 * v[0], k * 0.5 * v[1]];
  d.text("geocêntrico (Terra fixa)", 1.08, 1.12, { color: theme.text, size: 12 });
  const path: [number, number][] = [];
  for (let i = 0; i <= 400; i++) {
    const tt = (t - 800 + (800 * i) / 400) / YEAR_DAYS;
    const e = planetPos(earth, tt), m = planetPos(pl, tt);
    path.push(R2([m[0] - e[0], m[1] - e[1]]));
  }
  d.polyline(path, { color: pl.color, width: 1.5 });
  const sun: [number, number][] = [];
  for (let i = 0; i <= 100; i++) {
    const e = planetPos(earth, (t - 365 + 3.65 * i) / YEAR_DAYS);
    sun.push(R2([-e[0], -e[1]]));
  }
  d.polyline(sun, { color: "#f2b632", width: 1, alpha: 0.6 });
  d.dot(1.08, 0, 5, earth.color);
  const e = planetPos(earth, tY), m = planetPos(pl, tY);
  const Mg = R2([m[0] - e[0], m[1] - e[1]]);
  d.dot(Mg[0], Mg[1], 5, pl.color);
  const Sg = R2([-e[0], -e[1]]);
  d.dot(Sg[0], Sg[1], 5, "#f2b632");
  // Faixa de longitude λ(t)
  const rate = lambdaRate(p, t);
  const retro = rate < 0;
  d.text(`λ = ${fmt(deg(geoLongitude(pl, tY)), 4)}°   dλ/dt = ${fmt(rate, 3)} °/dia ${retro ? "· RETRÓGRADO" : "· direto"}`, 0, -1.12, { color: retro ? theme.negative : theme.text, size: 12, weight: retro ? "600" : "400" });
}

function renderPhases(d: Draw, s: SState, p: Params) {
  const { theme } = d;
  const g = moonGeo(s.tf, num(p, "nodo", 40));
  const lamS = (2 * Math.PI * s.tf) / YEAR_DAYS;
  // Vista de cima, girada para o Sol ficar sempre à direita
  const cx = -0.95, R = 0.75;
  for (let k = -3; k <= 3; k++) d.arrow(cx + 1.15, k * 0.28, -0.25, 0, { color: "#f2b632", width: 1.2 });
  d.text("luz do Sol", cx + 1.0, 1.1, { color: theme.muted, size: 11 });
  d.circle(cx, 0, R, { stroke: theme.grid, width: 1 });
  // Linha dos nodos
  const node = rad(num(p, "nodo", 40)) - (2 * Math.PI * s.tf) / 6798.38 - lamS;
  d.line(cx - R * 1.1 * Math.cos(node), -R * 1.1 * Math.sin(node), cx + R * 1.1 * Math.cos(node), R * 1.1 * Math.sin(node), { color: theme.muted, dash: [4, 4] });
  d.text("nodos", cx + R * 1.1 * Math.cos(node), R * 1.1 * Math.sin(node), { color: theme.muted, size: 10, dy: -8 });
  // Terra (dia/noite)
  d.circle(cx, 0, 0.12, { fill: "#1f3f73" });
  d.ctx.beginPath();
  d.ctx.arc(cx, 0, 0.12, -Math.PI / 2, Math.PI / 2);
  d.ctx.fillStyle = "#3b7dd8";
  d.ctx.fill();
  const mx = cx + R * Math.cos(g.elong), my = R * Math.sin(g.elong);
  const rm = 0.07;
  d.circle(mx, my, rm, { fill: "#30343a" });
  d.ctx.beginPath();
  d.ctx.arc(mx, my, rm, -Math.PI / 2, Math.PI / 2);
  d.ctx.fillStyle = "#e9e4d4";
  d.ctx.fill();
  d.text("Lua", mx, my, { color: theme.text, size: 11, dy: -14 });
  // Disco visto da Terra
  const px = 1.15, pr = 0.62;
  d.text("vista da Terra", px, 1.1, { color: theme.text, size: 12 });
  d.circle(px, 0.1, pr, { fill: "#30343a" });
  const south = Math.round(num(p, "hemis")) === 0;
  const waxing = g.elong < Math.PI;
  // Lado iluminado: direita (norte, crescente) / esquerda (sul, crescente)
  const side = (waxing ? 1 : -1) * (south ? -1 : 1);
  const tx = pr * Math.cos(g.sep); // semieixo do terminador
  const pts: [number, number][] = [];
  for (let i = 0; i <= 60; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / 60;
    pts.push([px + side * pr * Math.cos(a), 0.1 + pr * Math.sin(a)]);
  }
  for (let i = 0; i <= 60; i++) {
    const a = Math.PI / 2 - (Math.PI * i) / 60;
    pts.push([px + side * tx * Math.cos(a), 0.1 + pr * Math.sin(a)]);
  }
  d.polyline(pts, { fill: "#e9e4d4", color: "none", close: true });
  const ecl = eclipse(g);
  const age = (g.elong / (2 * Math.PI)) * MOON_SYNODIC;
  d.text(`${phaseName(g.elong)} · ${fmt(g.k * 100, 3)}% iluminada · idade ${fmt(age, 3)} d`, px, -0.68, { color: theme.text, size: 12 });
  d.text(`dia ${fmt(s.tf, 4)} · latitude da Lua ${fmt(deg(g.beta), 2)}° (inclinação ${fmt(MOON_INCL, 3)}°)`, px, -0.84, { color: theme.muted, size: 11 });
  if (ecl) d.text(ecl === "solar" ? "ECLIPSE SOLAR" : "ECLIPSE LUNAR", px, -1.02, { color: theme.negative, size: 14, weight: "700" });
}

function renderCannon(d: Draw, s: SState, p: Params, trail: SState[]) {
  const { theme } = d;
  const k = 1 / R_EARTH;
  d.circle(0, 0, 1, { fill: theme.dark ? "#1d3a5f" : "#9cc3e6", stroke: theme.muted, width: 1 });
  const h = num(p, "h", 200) * 1e3;
  d.polyline([[-0.08, 0.99], [0, 1 + h * k], [0.08, 0.99]], { fill: theme.ground, color: theme.muted, close: true });
  // Cônica prevista (tracejada) a partir das condições iniciais
  const y0 = cannonInit(p);
  const o = cannonOrbit(y0);
  const pts: [number, number][] = [];
  for (let i = 0; i <= 360; i++) {
    const nu = (i / 360) * 2 * Math.PI;
    const r = (o.hz * o.hz) / GM_EARTH / (1 + o.e * Math.cos(nu));
    if (r <= 0 || r * k > 6) continue;
    // Periapse/apoapse no ponto de lançamento (x = 0, y > 0)
    const sgn = num(p, "v", 7.8) * 1e3 >= v1(h) ? 0 : Math.PI;
    const ang = Math.PI / 2 - (nu + sgn);
    pts.push([r * k * Math.cos(ang), r * k * Math.sin(ang)]);
  }
  d.polyline(pts, { color: theme.muted, dash: [4, 4], width: 1 });
  const tr = trail.filter((q) => q.y.length === 4 && q.y[1] !== 0).map((q) => [q.y[0]! * k, q.y[1]! * k] as [number, number]);
  d.polyline(tr, { color: theme.accent, width: 2 });
  const x = s.y[0]! * k, y = s.y[1]! * k;
  d.dot(x, y, 5, theme.negative);
  if (!s.hit) d.arrowPx(x, y, s.y[2]!, s.y[3]!, 30, { color: theme.negative });
  const vv = num(p, "v", 7.8) * 1e3;
  const kind = s.hit ? "caiu" : vv >= v2(h) ? "escapa" : vv >= v1(h) * 0.999 ? "em órbita" : "subórbita";
  d.text(`v₀ = ${fmt(vv / 1e3, 3)} km/s · v₁ = ${fmt(v1(h) / 1e3, 3)} · v₂ = ${fmt(v2(h) / 1e3, 3)} km/s → ${kind}`, 0, 1.38, { color: theme.text, size: 12 });
  d.text(`t = ${fmt(s.tf / 60, 4)} min · altitude ${fmt((Math.hypot(s.y[0]!, s.y[1]!) - R_EARTH) / 1e3, 4)} km`, 0, -1.38, { color: theme.muted, size: 11 });
}

function renderGeo(d: Draw, s: SState, p: Params) {
  const { theme } = d;
  const r = geoR(p);
  const k = 1.3 / Math.max(rGeo(), r);
  const Re = R_EARTH * k;
  const th = earthAngle(s.tf);
  d.circle(0, 0, Re, { fill: theme.dark ? "#1d3a5f" : "#9cc3e6", stroke: theme.muted });
  for (let i = 0; i < 12; i++) {
    const a = th + (i * Math.PI) / 6;
    d.line(0, 0, Re * Math.cos(a), Re * Math.sin(a), { color: theme.muted, width: 0.8, alpha: 0.6 });
  }
  // Estação em solo (Brasília) e satélite
  const st: [number, number] = [Re * Math.cos(th), Re * Math.sin(th)];
  d.dot(st[0], st[1], 5, theme.series[2]!);
  d.text("antena", st[0], st[1], { color: theme.series[2]!, size: 10, dy: 12 });
  d.circle(0, 0, rGeo() * k, { stroke: theme.grid, width: 1, dash: [5, 4] });
  d.circle(0, 0, r * k, { stroke: theme.accent, width: 1 });
  const ws = (2 * Math.PI) / orbitPeriod(r);
  const sa = ws * s.tf;
  const sx = r * k * Math.cos(sa), sy = r * k * Math.sin(sa);
  d.line(st[0], st[1], sx, sy, { color: theme.series[2]!, dash: [3, 3] });
  d.rect(sx - 0.03, sy - 0.03, 0.06, 0.06, { fill: theme.negative });
  d.text(`T = ${fmt(orbitPeriod(r) / 3600, 4)} h · r_geo = ${fmt(rGeo() / 1e3, 5)} km`, 0, 1.4, { color: theme.text, size: 12 });
  const drift = ((subLongitude(p, s.tf) + 180) % 360 + 360) % 360 - 180;
  d.text(`tempo ${fmt(s.tf / 3600, 4)} h · deriva do satélite em relação à antena ${fmt(drift, 3)}°`, 0, -1.4, { color: theme.muted, size: 11 });
  void SIDEREAL_DAY;
  void KMS_PER_AUYR;
}

export default sistemaSolar;
