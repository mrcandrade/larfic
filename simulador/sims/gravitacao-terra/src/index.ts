import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type WorldPoint } from "@fisilab/core";
import { fmt, panel } from "./panel.ts";
import { derivation } from "./derivation.ts";
import {
  CAB,
  G,
  G0,
  GM,
  ME,
  RE,
  SIDEREAL_DAY_H,
  apparentG,
  ballRel,
  density,
  elevatorCase,
  floorY,
  gAt,
  gEffective,
  gInside,
  geoRadius,
  halfChord,
  lightRel,
  mantleDensity,
  massInside,
  netForce,
  omegaTunnel,
  periodTunnel,
  potential,
  realLightDrop,
  somigliana,
  tunnelStep,
  type EarthModel,
  type PointMass,
} from "./physics.ts";

export * from "./physics.ts";

export interface GravState {
  /** Tempo físico (s). O túnel corre acelerado e o elevador em câmera lenta. */
  tau: number;
  /** Posições das massas A, B, C e da partícula de teste (m). */
  src: { x: number; y: number }[];
  probe: { x: number; y: number };
  /** Objeto sendo arrastado: 0–2 massas, 3 partícula de teste, −1 nenhum. */
  drag: number;
  /** Túnel: posição ao longo da corda (m) e velocidade (m/s). */
  s: number;
  v: number;
  /** Instante (s) em que chegou à outra boca pela primeira vez (0 enquanto não chega). */
  tArr: number;
}

export const mode = (p: Params) => Math.round(num(p, "modo"));
/** Fator entre o tempo físico e o tempo do relógio do app, por modo. */
const TIME_SCALE = [1, 600, 1, 240, 0.5];
/** Duração da cena do elevador (s, tempo físico). */
export const ELEV_T = 1.2;
const BALL_R = 0.15;
const BALL_H0 = 2.5;
const LIGHT_H = 2.4;
/** Velocidade da luz no desenho (m/s): o pulso real cairia 10⁻¹⁶ m. */
export const C_DRAW = 10;
const NAMES = ["A", "B", "C"];

export const earthModel = (p: Params): EarthModel => ({
  kind: Math.round(num(p, "modelo")),
  rc: 3.48e6,
  rhoc: num(p, "rhoc", 10.9) * 1000,
});

export function sources(s: GravState, p: Params): PointMass[] {
  const n = clamp(Math.round(num(p, "n", 3)), 1, 3);
  return s.src.slice(0, n).map((q, i) => ({ ...q, m: num(p, ["mA", "mB", "mC"][i]!, 100) }));
}

export const forceOn = (s: GravState, p: Params) => netForce(sources(s, p), s.probe.x, s.probe.y, num(p, "m0", 1));

export const elevCase = (p: Params) => elevatorCase(Math.round(num(p, "situacao")), num(p, "a", G0));

/** Energia mecânica por unidade de massa no túnel (J/kg). */
export function tunnelEnergy(s: GravState, p: Params): number {
  return 0.5 * s.v * s.v + potential(Math.hypot(s.s, num(p, "b") * 1000), earthModel(p));
}

const ISS = 400, GPS = 20200;
const GEO_H = (geoRadius() - RE) / 1000;

export const gravitacaoTerra = defineSim<GravState>({
  id: "gravitacao-terra",
  title: "Gravitação: superposição, interior da Terra e equivalência",
  course: "FG I",
  topic: "Gravitação",
  priority: "P1",
  summary:
    "Some as forças de várias massas arrastáveis, veja g mudar com a altitude, a latitude e a rotação, desça ao interior da Terra (teorema das cascas), atravesse-a por um túnel em 42 minutos e entre no elevador de Einstein.",
  derivation,
  equations: [
    String.raw`\vec F_0 = \sum_i \frac{G m_0 m_i}{r_{0i}^2}\,\hat r_{0i} \qquad G = 6{,}674\times10^{-11}\ \text{N·m}^2/\text{kg}^2`,
    String.raw`g(h) = \frac{GM}{(R+h)^2} \qquad \vec g_{ef} = \vec g - \vec\omega\times(\vec\omega\times\vec r) \qquad \text{equador: } g_{ef} = g - \omega^2 R`,
    String.raw`g(r) = \frac{G M(r)}{r^2} \qquad \text{Terra uniforme: } g = \frac{GM}{R^3}\,r\ \ (r \le R)`,
    String.raw`\text{túnel: } \ddot s = -\frac{GM}{R^3}\,s \;\Rightarrow\; T = 2\pi\sqrt{\frac{R^3}{GM}} \approx 84\ \text{min}`,
    String.raw`\text{equivalência: } \vec g_{ap} = \vec g - \vec a_{cabine}`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    switch (m) {
      case 0: {
        const f = forceOn(s, p);
        const terms = f.parts.map((q, i) => String.raw`F_${NAMES[i]} = ${texNum(q.F)}`).join(",\\ ");
        const ang = (Math.atan2(f.fy, f.fx) * 180) / Math.PI;
        return [
          String.raw`${terms}\ \text{N}`,
          String.raw`\vec F = (${texNum(f.fx)},\ ${texNum(f.fy)})\ \text{N} \qquad |\vec F| = ${texNum(f.F)}\ \text{N},\ \ \theta = ${texNum(ang)}^\circ`,
          String.raw`|\vec F| ${f.F < f.parts.reduce((a, q) => a + q.F, 0) - 1e-30 ? "<" : "="} \textstyle\sum |\vec F_i| = ${texNum(f.parts.reduce((a, q) => a + q.F, 0))}\ \text{N}\ \ (\text{soma vetorial})`,
        ];
      }
      case 1: {
        const h = num(p, "h") * 1000;
        const e = gEffective(h, num(p, "lat"), num(p, "dia", SIDEREAL_DAY_H));
        return [
          String.raw`g = \frac{GM}{(R+h)^2} = \frac{${texNum(GM, 4)}}{(${texNum((RE + h) / 1000, 5)}\ \text{km})^2} = ${texNum(e.g, 4)}\ \text{m/s}^2 = ${texNum((100 * e.g) / gAt(0), 3)}\%\ g_0`,
          String.raw`\omega^2 r\cos\varphi = ${texNum(e.ac, 3)}\ \text{m/s}^2 \qquad g_{ef} = ${texNum(e.mag, 5)}\ \text{m/s}^2 \qquad P_{ap} = m g_{ef} = ${texNum(num(p, "m0", 70) * e.mag, 4)}\ \text{N}`,
          String.raw`\text{prumo desviado de } ${texNum(e.dev, 2)}^\circ \qquad g_{real}(\varphi,\ h=0) = ${texNum(somigliana(num(p, "lat")), 5)}\ \text{m/s}^2\ (\text{elipsoide WGS 84})`,
        ];
      }
      case 2: {
        const em = earthModel(p);
        const r = num(p, "r") * 1000;
        const M = massInside(r, em);
        const out = [
          String.raw`r = ${texNum(r / 1000, 4)}\ \text{km} \qquad M(r) = ${texNum(M, 4)}\ \text{kg} = ${texNum((100 * M) / ME, 3)}\%\ M_T`,
          String.raw`g(r) = \frac{G M(r)}{r^2} = ${texNum(gInside(r, em), 4)}\ \text{m/s}^2 \qquad \text{uniforme: } ${texNum(gInside(r, { ...em, kind: 0 }), 4)}\ \text{m/s}^2`,
        ];
        if (em.kind === 1) out.push(String.raw`\rho_{núcleo} = ${texNum(em.rhoc / 1000, 3)}\ \text{g/cm}^3 \qquad \rho_{manto} = ${texNum(mantleDensity(em) / 1000, 3)}\ \text{g/cm}^3 \qquad g(R_{núcleo}) = ${texNum(gInside(em.rc, em), 4)}\ \text{m/s}^2`);
        return out;
      }
      case 3: {
        const w = omegaTunnel();
        const b = num(p, "b") * 1000;
        return [
          String.raw`\omega = \sqrt{GM/R^3} = ${texNum(w, 4)}\ \text{rad/s} \qquad T = ${texNum(periodTunnel() / 60, 4)}\ \text{min} \qquad T/2 = ${texNum(periodTunnel() / 120, 4)}\ \text{min}`,
          String.raw`s = ${texNum(s.s / 1000, 4)}\ \text{km} \qquad v = ${texNum(s.v / 1000, 4)}\ \text{km/s} \qquad v_{máx}^{unif} = \omega\sqrt{R^2 - b^2} = ${texNum((w * halfChord(b)) / 1000, 4)}\ \text{km/s}`,
          String.raw`t = ${texNum(s.tau / 60, 4)}\ \text{min} \qquad t_{travessia} = ${s.tArr > 0 ? `${texNum(s.tArr / 60, 4)}\\ \\text{min (medido)}` : String.raw`\text{(ainda não chegou)}`}`,
        ];
      }
      default: {
        const c = elevCase(p);
        const ga = apparentG(c);
        const ball = ballRel(c, BALL_H0, s.tau, BALL_R);
        return [
          String.raw`g_{ap} = g - a_{cab} = ${texNum(c.gField)} - (${texNum(c.aCab)}) = ${texNum(ga)}\ \text{m/s}^2`,
          String.raw`y_{bola} = h_0 - \tfrac12 g_{ap} t^2 = ${texNum(ball.y)}\ \text{m} \qquad t_{piso} = ${Number.isFinite(ball.tHit) ? `${texNum(ball.tHit)}\\ \\text{s}` : "\\infty"}`,
          String.raw`\text{luz real: } \Delta y = \tfrac12 g_{ap}\left(\tfrac{L}{c}\right)^2 = ${texNum(realLightDrop(ga))}\ \text{m}\ \ (L = ${CAB.w}\ \text{m})`,
        ];
      }
    }
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 4,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Superposição de forças" },
        { value: 1, label: "g com a altitude e a latitude" },
        { value: 2, label: "g no interior da Terra" },
        { value: 3, label: "Túnel através da Terra" },
        { value: 4, label: "Elevador de Einstein" },
      ],
    },
    { key: "n", label: "Superposição: número de massas", unit: "", min: 1, max: 3, step: 1, default: 3, live: true },
    { key: "mA", label: "Superposição: massa A", unit: "kg", min: 1, max: 5000, step: 1, default: 800, log: true, live: true },
    { key: "mB", label: "Superposição: massa B", unit: "kg", min: 1, max: 5000, step: 1, default: 500, log: true, live: true },
    { key: "mC", label: "Superposição: massa C", unit: "kg", min: 1, max: 5000, step: 1, default: 300, log: true, live: true },
    { key: "dA", label: "Superposição: posição inicial de A no eixo x", unit: "m", min: 0.5, max: 5, step: 0.1, default: 2.5 },
    { key: "dB", label: "Superposição: posição inicial de B no eixo y", unit: "m", min: 0.5, max: 4, step: 0.1, default: 2 },
    { key: "m0", label: "Massa de teste (ou da pessoa na balança)", unit: "kg", min: 0.1, max: 150, step: 0.1, default: 1, live: true },
    {
      key: "campo",
      label: "Superposição: campo g ao fundo",
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
    { key: "h", label: "Altitude h", unit: "km", min: 0, max: 40000, step: 10, default: 0, live: true },
    { key: "lat", label: "Latitude φ", unit: "°", min: 0, max: 90, step: 1, default: 0, live: true },
    { key: "dia", label: "Duração do dia (rotação)", unit: "h", min: 1.2, max: 48, step: 0.1, default: SIDEREAL_DAY_H, live: true },
    {
      key: "modelo",
      label: "Modelo da Terra (interior e túnel)",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Densidade uniforme" },
        { value: 1, label: "Núcleo denso + manto" },
        { value: 2, label: "Casca oca (mesma massa)" },
      ],
    },
    { key: "rhoc", label: "Densidade do núcleo (raio 3480 km)", unit: "g/cm³", min: 5.5, max: 13, step: 0.1, default: 10.9 },
    { key: "r", label: "Interior: distância ao centro r", unit: "km", min: 0, max: 12742, step: 10, default: 3000, live: true },
    { key: "b", label: "Túnel: distância da corda ao centro", unit: "km", min: 0, max: 6000, step: 50, default: 0 },
    {
      key: "situacao",
      label: "Elevador: situação",
      unit: "",
      min: 0,
      max: 3,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Parado na Terra" },
        { value: 1, label: "Foguete acelerando no espaço" },
        { value: 2, label: "Em queda livre na Terra" },
        { value: 3, label: "À deriva no espaço" },
      ],
    },
    { key: "a", label: "Elevador: aceleração do foguete", unit: "m/s²", min: 0, max: 15, step: 0.1, default: 9.8 },
    {
      key: "ref",
      label: "Elevador: ponto de vista",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "De dentro da cabine" },
        { value: 1, label: "De fora (referencial inercial)" },
      ],
    },
  ],

  observables: [
    { key: "F", label: "Superposição: |F| resultante", unit: "N", value: (s, p) => forceOn(s, p).F },
    { key: "Fdir", label: "Superposição: direção de F (a partir de +x)", unit: "°", value: (s, p) => { const f = forceOn(s, p); return (Math.atan2(f.fy, f.fx) * 180) / Math.PI; } },
    { key: "g", label: "g gravitacional na altitude h", unit: "m/s²", value: (_s, p) => gAt(num(p, "h") * 1000) },
    { key: "gef", label: "g efetivo (com a rotação)", unit: "m/s²", value: (_s, p) => gEffective(num(p, "h") * 1000, num(p, "lat"), num(p, "dia", SIDEREAL_DAY_H)).mag },
    { key: "Pap", label: "Peso aparente (leitura da balança)", unit: "N", value: (_s, p) => num(p, "m0", 1) * gEffective(num(p, "h") * 1000, num(p, "lat"), num(p, "dia", SIDEREAL_DAY_H)).mag },
    { key: "gr", label: "Interior: g(r)", unit: "m/s²", value: (_s, p) => gInside(num(p, "r") * 1000, earthModel(p)) },
    { key: "Mr", label: "Interior: massa interna M(r)/M", unit: "", value: (_s, p) => massInside(num(p, "r") * 1000, earthModel(p)) / ME },
    { key: "s", label: "Túnel: posição s ao longo da corda", unit: "km", value: (s) => s.s / 1000 },
    { key: "v", label: "Túnel: velocidade", unit: "km/s", value: (s) => s.v / 1000 },
    { key: "E", label: "Túnel: energia mecânica por massa", unit: "J/kg", value: (s, p) => tunnelEnergy(s, p) },
    { key: "tmin", label: "Tempo físico", unit: "min", value: (s) => s.tau / 60 },
    { key: "yb", label: "Elevador: altura da bola sobre o piso", unit: "m", value: (s, p) => ballRel(elevCase(p), BALL_H0, s.tau, BALL_R).y - BALL_R },
    { key: "yl", label: "Elevador: queda do pulso de luz (no desenho)", unit: "m", value: (s, p) => LIGHT_H - lightRel(elevCase(p), LIGHT_H, C_DRAW, s.tau).y },
  ],
  conserved: "E",
  chart: { x: "tmin", y: "s" },

  scenarios: [
    {
      id: "superposicao",
      label: "Superposição: várias massas puxando",
      params: { modo: 0, n: 3, mA: 800, mB: 500, mC: 300, dA: 2.5, dB: 2, m0: 1, campo: 1 },
      guide: `### Princípio da superposição
1. Cada massa puxa a partícula de teste $m_0$ como se as outras não existissem: $F_i = G m_0 m_i / r_i^2$, apontando para a massa $i$ (setas coloridas).
2. A força resultante (seta grossa) é a **soma vetorial**: compare $|\\vec F|$ com a soma dos módulos nas equações vivas.
3. **Arraste** as esferas e a partícula de teste. Dobre a distância a uma massa e veja a seta dela cair a um quarto.
4. Procure um ponto onde a resultante se anula (com duas massas, fica sobre a reta que as une, mais perto da menor).
5. As setas cinzas ao fundo mostram o campo $\\vec g = \\vec F/m_0$, que não depende de $m_0$.`,
      predict: [
        {
          question: "Uma partícula está exatamente no meio do segmento entre duas massas iguais. A força gravitacional resultante sobre ela:",
          options: ["é o dobro da força de uma só massa", "é nula", "aponta perpendicularmente ao segmento", "depende da massa da partícula ser grande ou pequena"],
          answer: 1,
          explanation: "As duas forças têm o mesmo módulo e sentidos opostos; a soma vetorial é zero. Use **n = 2**, massas iguais, e leve a partícula ao ponto médio para conferir.",
        },
      ],
    },
    {
      id: "g-altitude",
      label: "g com a altitude, a latitude e a rotação",
      params: { modo: 1, h: 400, lat: 0, dia: SIDEREAL_DAY_H, m0: 70 },
      guide: `### Quanto você pesa lá em cima?
1. Com $h = 400$ km (altura da Estação Espacial), $g$ ainda vale cerca de 89% do valor na superfície: os astronautas flutuam porque estão em **queda livre**, não por falta de gravidade.
2. Leve $h$ a zero e varie a latitude: no equador, parte da gravidade é gasta para manter você girando ($\\omega^2 R \\approx 0{,}034$ m/s²), e a balança marca menos. No gráfico de baixo, compare o modelo esférico com a fórmula internacional (a Terra real é achatada e o efeito dobra).
3. Encurte o **dia**: com cerca de 1,4 h, o peso aparente no equador some ($\\omega^2 R = g$).
4. No gráfico de cima, a curva tracejada é o $g$ efetivo de quem gira junto com a Terra (numa torre): ela zera na altitude geoestacionária, cerca de 35 800 km.`,
      predict: [
        {
          question: "Na altitude da Estação Espacial Internacional (cerca de 400 km), a aceleração da gravidade vale aproximadamente:",
          options: ["zero", "10% do valor na superfície", "50% do valor na superfície", "90% do valor na superfície"],
          answer: 3,
          explanation: "$g = GM/(R+h)^2$ com $R = 6371$ km dá $(6371/6771)^2 \\approx 0{,}89$. A sensação de ausência de peso vem da queda livre em órbita.",
        },
      ],
    },
    {
      id: "interior",
      label: "Interior da Terra e teorema das cascas",
      params: { modo: 2, modelo: 0, r: 3000, rhoc: 10.9 },
      guide: `### Descendo ao centro
1. Pelo **teorema das cascas**, a casca esférica acima de você (região hachurada) exerce força resultante nula; só a massa interna $M(r)$ (região colorida) puxa.
2. Na Terra uniforme, $M(r) \\propto r^3$ e $g = (GM/R^3)\\,r$: o gráfico é uma reta até a superfície e depois cai como $1/r^2$.
3. Troque para **núcleo denso + manto**: como o núcleo é muito mais denso (cerca de 11 g/cm³ contra 4,5 g/cm³), $g$ **aumenta** ao descer pelo manto e passa de 10 m/s² no limite do núcleo, como na Terra real.
4. No modelo de **casca oca**, $g = 0$ em todo o interior.`,
      predict: [
        {
          question: "Na Terra real, com o núcleo muito mais denso que o manto, ao descer da superfície até o limite do núcleo (2900 km de profundidade), g:",
          options: ["diminui linearmente até cerca de metade", "fica praticamente igual ou aumenta um pouco", "cai a zero", "dobra"],
          answer: 1,
          explanation: "A massa externa que deixa de puxar é pouca (o manto é leve), enquanto $1/r^2$ cresce. No modelo de duas camadas, $g$ chega a cerca de 10,6 m/s² no limite do núcleo.",
        },
      ],
    },
    {
      id: "tunel",
      label: "Túnel através da Terra",
      params: { modo: 3, modelo: 0, b: 0 },
      guide: `### De um lado ao outro do planeta em 42 minutos
1. Solte o corpo na boca do túnel (sem atrito nem ar). Na Terra uniforme, a força é $-m(GM/R^3)\\,s$: um **MHS** com período $T = 2\\pi\\sqrt{R^3/GM} \\approx 84$ min.
2. O satélite rasante (ponto na borda) dá uma volta no mesmo tempo: sua projeção acompanha o corpo no túnel. A velocidade máxima, no meio, é a velocidade orbital, cerca de 7,9 km/s.
3. Mude a **distância da corda ao centro** e reinicie: o caminho é mais curto, mas a componente de $g$ ao longo do túnel também é menor, e o tempo **não muda**.
4. Troque para **núcleo denso**: o movimento deixa de ser harmônico e a travessia fica mais rápida (cerca de 39 min).
5. A energia mecânica (medidas) se conserva: o desvio mostrado é o erro numérico.`,
      predict: [
        {
          question: "Um túnel reto liga duas cidades sem passar pelo centro de uma Terra uniforme. Comparado ao túnel que passa pelo centro, o tempo de travessia é:",
          options: ["menor, porque o caminho é mais curto", "maior, porque a força ao longo do túnel é menor", "igual: cerca de 42 minutos", "zero, porque não há componente de g ao longo do túnel"],
          answer: 2,
          explanation: "A componente de g ao longo do túnel é $(GM/R^3)\\,s$, com a mesma constante de mola para qualquer corda. O período de um MHS não depende da amplitude.",
        },
      ],
    },
    {
      id: "equivalencia",
      label: "Elevador de Einstein: princípio da equivalência",
      params: { modo: 4, situacao: 0, a: 9.8, ref: 0 },
      guide: `### Gravidade ou aceleração?
1. Rode com a cabine **parada na Terra**: a bola cai com $g$ e o pulso de luz (desenhado muito mais lento que a luz real) se curva para baixo.
2. Troque para **foguete acelerando** com $a = 9{,}8$ m/s², longe de qualquer planeta. De dentro, o resultado é **idêntico**: nenhum experimento local distingue os dois casos.
3. Mude para o ponto de vista **de fora**: no foguete, a bola e a luz seguem em linha reta e é o piso que sobe ao encontro delas.
4. **Queda livre na Terra** e **à deriva no espaço** também são indistinguíveis: a bola flutua e a luz segue reta na cabine.
5. Conclusão de Einstein: se a aceleração curva a luz, a gravidade também curva. O desvio real numa cabine de 4 m é de cerca de $10^{-15}$ m (equações vivas).`,
      predict: [
        {
          question: "Num foguete longe de qualquer planeta, acelerando a 9,8 m/s², um astronauta solta uma bola. Para ele, a bola:",
          options: ["flutua parada, porque não há gravidade", "cai até o piso exatamente como na Terra", "sobe até o teto", "cai mais devagar que na Terra"],
          answer: 1,
          explanation: "A bola segue em linha reta com a velocidade que tinha; o piso acelera para cima a 9,8 m/s². Na cabine, a aceleração relativa é 9,8 m/s² para baixo: princípio da equivalência.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "superposicao",
      prompt:
        "Uma partícula de {m0} kg está na origem. Uma esfera A de {mA} kg está no eixo x, a {dA} m dela, e uma esfera B de {mB} kg está no eixo y, a {dB} m. Qual é o módulo da força gravitacional resultante sobre a partícula, em nanonewtons?",
      vary: { m0: [1, 20, 0], mA: [100, 2000, 0], dA: [1, 4, 1], mB: [100, 2000, 0], dB: [1, 4, 1] },
      fixed: { modo: 0, n: 2 },
      answer: {
        label: "|F|",
        unit: "nN",
        compute: (p) => {
          const m0 = num(p, "m0");
          return Math.hypot((G * m0 * num(p, "mA")) / num(p, "dA") ** 2, (G * m0 * num(p, "mB")) / num(p, "dB") ** 2) * 1e9;
        },
      },
      hint: "As duas forças são perpendiculares: some-as como vetores (Pitágoras), não os módulos.",
    },
    {
      id: "altitude",
      prompt: "Qual é a aceleração da gravidade a {h} km de altitude? Use GM = 3,986 × 10^14 m³/s² e R = 6371 km.",
      vary: { h: [200, 36000, 0] },
      fixed: { modo: 1 },
      answer: { label: "g", unit: "m/s²", compute: (p) => gAt(num(p, "h") * 1000) },
      hint: "g = GM/(R + h)², com tudo em metros.",
    },
    {
      id: "equador",
      prompt: "Uma pessoa de {m0} kg está sobre uma balança no equador de uma Terra esférica (GM = 3,986 × 10^14 m³/s², R = 6371 km). Se a Terra girasse uma vez a cada {dia} h, quanto a balança marcaria, em newtons?",
      vary: { m0: [50, 100, 0], dia: [2, 24, 1] },
      fixed: { modo: 1, h: 0, lat: 0 },
      answer: { label: "N", unit: "N", compute: (p) => num(p, "m0") * gEffective(0, 0, num(p, "dia")).mag },
      hint: "No equador, N = m(g − ω²R), com ω = 2π/T.",
    },
    {
      id: "interior",
      prompt: "Numa Terra de densidade uniforme (GM = 3,986 × 10^14 m³/s², R = 6371 km), qual é o módulo de g a {r} km do centro?",
      vary: { r: [500, 6000, 0] },
      fixed: { modo: 2, modelo: 0 },
      answer: { label: "g", unit: "m/s²", compute: (p) => gInside(num(p, "r") * 1000, { kind: 0, rc: 0, rhoc: 0 }) },
      hint: "Só a massa interna conta: M(r) = M r³/R³, então g = GMr/R³.",
    },
    {
      id: "tunel",
      prompt: "Um túnel reto e sem atrito atravessa uma Terra uniforme (GM = 3,986 × 10^14 m³/s², R = 6371 km) passando a {b} km do centro. Um corpo é solto do repouso numa das bocas. Qual é a velocidade máxima, em km/s?",
      vary: { b: [0, 5000, 0] },
      fixed: { modo: 3, modelo: 0 },
      answer: { label: "v_máx", unit: "km/s", compute: (p) => (omegaTunnel() * halfChord(num(p, "b") * 1000)) / 1000 },
      hint: "É um MHS com ω = √(GM/R³) e amplitude igual à meia-corda √(R² − b²); v_máx = ωA.",
    },
    {
      id: "foguete",
      prompt: "Num foguete longe de qualquer planeta, com aceleração {a} m/s², um astronauta solta uma bola cuja parte de baixo está a 2,35 m do piso. Quanto tempo a bola leva para tocar o piso?",
      vary: { a: [2, 15, 1] },
      fixed: { modo: 4, situacao: 1 },
      answer: { label: "t", unit: "s", compute: (p) => Math.sqrt((2 * (BALL_H0 - BALL_R)) / num(p, "a")) },
      hint: "Na cabine, a bola cai com aceleração aparente igual a a: t = √(2h/a).",
    },
  ],

  init(p) {
    const s0 = mode(p) === 3 ? halfChord(num(p, "b") * 1000) : 0;
    return {
      tau: 0,
      src: [
        { x: num(p, "dA", 2.5), y: 0 },
        { x: 0, y: num(p, "dB", 2) },
        { x: -2.5, y: -2 },
      ],
      probe: { x: 0, y: 0 },
      drag: -1,
      s: s0,
      v: 0,
      tArr: 0,
    };
  },
  step(s, p, _t, dt) {
    const m = mode(p);
    const h = dt * (TIME_SCALE[m] ?? 1);
    const tau = s.tau + h;
    if (m !== 3) return { ...s, tau };
    const b = num(p, "b") * 1000;
    const [x, v] = tunnelStep(s.s, s.v, b, earthModel(p), h);
    let tArr = s.tArr;
    // Chegada à outra boca: a velocidade volta a zero (de negativa para positiva).
    if (tArr === 0 && s.v < 0 && v >= 0) tArr = s.tau + (h * -s.v) / (v - s.v);
    return { ...s, tau, s: x, v, tArr };
  },
  dt: 0.005,
  sampleEvery: 6,
  maxSamples: 20_000,
  stopWhen(s, p) {
    const m = mode(p);
    if (m === 3) return 2.05 * periodTunnel() - s.tau;
    if (m === 4) return ELEV_T - s.tau;
    return 1;
  },

  pointer: {
    down(s, p, pt) {
      if (mode(p) !== 0) return undefined;
      const i = pick(s, p, pt);
      return i >= 0 ? { ...s, drag: i } : undefined;
    },
    move(s, p, pt, dragging) {
      if (mode(p) !== 0 || !dragging || s.drag < 0) return undefined;
      const q = { x: Math.round(clamp(pt.x, -5.7, 5.7) * 20) / 20, y: Math.round(clamp(pt.y, -4.6, 4.6) * 20) / 20 };
      if (s.drag === 3) return { ...s, probe: q };
      const src = s.src.slice();
      src[s.drag] = q;
      return { ...s, src };
    },
    up: (s) => (s.drag >= 0 ? { ...s, drag: -1 } : undefined),
    cursor: (s, p, pt) => (mode(p) === 0 && pick(s, p, pt) >= 0 ? "grab" : undefined),
  },
  actions: [
    {
      id: "simetrico",
      label: "Superposição: A e B simétricos (ponto médio)",
      run: (s) => ({ ...s, src: [{ x: -2.5, y: 0 }, { x: 2.5, y: 0 }, s.src[2]!], probe: { x: 0, y: 0 } }),
    },
  ],

  viewport(p, s) {
    switch (mode(p)) {
      case 0:
        return { xMin: -6, xMax: 10.5, yMin: -5, yMax: 5, unit: "m" };
      case 4: {
        if (num(p, "ref") < 0.5) return { xMin: -3.6, xMax: 7.6, yMin: -1.4, yMax: 4.1 };
        const c = elevCase(p);
        const yE = floorY(c, ELEV_T);
        void s;
        return { xMin: -3.6, xMax: 7.6, yMin: Math.min(-1.4, yE - 1.2), yMax: Math.max(4.1, yE + CAB.h + 1.1) };
      }
      default:
        return { xMin: 0, xMax: 20, yMin: 0, yMax: 12 };
    }
  },

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const m = mode(frame.params);
    // Fonte proporcional à largura disponível (telas estreitas).
    const vp = gravitacaoTerra.viewport(frame.params, frame.state);
    const k = clamp((frame.scale * (vp.xMax - vp.xMin)) / 760, 0.62, 1);
    K = k;
    const fs = (n: number) => Math.round(n * k * 10) / 10;
    if (m === 0) renderSuperposition(d, frame.state, frame.params, fs);
    else if (m === 1) renderAltitude(d, frame.params, frame.state, fs);
    else if (m === 2) renderInterior(d, frame.params, fs);
    else if (m === 3) renderTunnel(d, frame.state, frame.params, frame.trail, fs);
    else renderElevator(d, frame.state, frame.params, fs);
  },
});

type Fs = (n: number) => number;

/** Escala de fonte do quadro atual (menor em telas estreitas) e opções dos gráficos. */
let K = 1;
const narrow = () => K < 0.85;
const PO = () => ({ font: Math.max(K, 0.75), ticks: narrow() ? 3 : 5 });

const SUPD = "⁰¹²³⁴⁵⁶⁷⁸⁹";
/** Número em notação científica legível (1,23 × 10⁻⁸). */
function sci(v: number, digits = 3): string {
  if (v === 0 || (Math.abs(v) >= 1e-3 && Math.abs(v) < 1e5)) return fmt(v, digits);
  const [m, e] = v.toExponential(digits - 1).split("e");
  const ee = Number(e);
  return `${m!.replace(".", ",")} × 10${ee < 0 ? "⁻" : ""}${String(Math.abs(ee)).split("").map((c) => SUPD[Number(c)]).join("")}`;
}

function pick(s: GravState, p: Params, pt: WorldPoint): number {
  const n = clamp(Math.round(num(p, "n", 3)), 1, 3);
  if (Math.hypot(pt.x - s.probe.x, pt.y - s.probe.y) < 0.45) return 3;
  for (let i = 0; i < n; i++) if (Math.hypot(pt.x - s.src[i]!.x, pt.y - s.src[i]!.y) < 0.55) return i;
  return -1;
}

/** Raio de uma esfera de chumbo (11,3 g/cm³) com a massa dada (m). */
const leadRadius = (m: number) => Math.cbrt((3 * m) / (4 * Math.PI * 11340));

function legend(d: Draw, x: number, y: number, fs: Fs) {
  let yy = y;
  return (str: string, color = d.theme.text, weight = "400", size = 11) => {
    d.text(str, x, yy, { align: "left", size: fs(size), color, weight });
    yy -= fs(size + 6) * d.px;
  };
}

function renderSuperposition(d: Draw, s: GravState, p: Params, fs: Fs) {
  const { theme } = d;
  const srcs = sources(s, p);
  const m0 = num(p, "m0", 1);
  d.grid(-6, 6, -5, 5, 1);
  // Campo g ao fundo
  if (num(p, "campo", 1) > 0.5) {
    const ref = netForce(srcs, 0, 0, 1).F || 1e-9;
    for (let x = -5.5; x <= 5.5; x += 0.85) {
      for (let y = -4.5; y <= 4.5; y += 0.85) {
        if (srcs.some((q) => Math.hypot(q.x - x, q.y - y) < 0.6)) continue;
        const f = netForce(srcs, x, y, 1);
        const alpha = clamp(0.3 + 0.22 * Math.log10(f.F / ref), 0.1, 0.75);
        d.arrowPx(x, y, f.fx, f.fy, 12, { color: theme.muted, width: 1.1, head: 4.5, alpha });
      }
    }
  }
  const f = netForce(srcs, s.probe.x, s.probe.y, m0);
  const Fmax = Math.max(f.F, ...f.parts.map((q) => q.F), 1e-30);
  const L = 2.4 / Fmax;
  // Linhas até as massas, com distâncias
  srcs.forEach((q, i) => {
    const c = theme.series[i + 1]!;
    d.line(s.probe.x, s.probe.y, q.x, q.y, { color: c, width: 1, dash: [3, 4], alpha: 0.6 });
    const r = f.parts[i]!.r;
    d.text(`${fmt(r, 3)} m`, (s.probe.x + q.x) / 2, (s.probe.y + q.y) / 2, { size: fs(10), color: c, dy: -8 });
  });
  // Massas
  srcs.forEach((q, i) => {
    const c = theme.series[i + 1]!;
    const R = leadRadius(q.m);
    d.circle(q.x, q.y, R, { fill: c, alpha: 0.85, minPx: 7 });
    d.circle(q.x, q.y, R, { stroke: theme.text, width: s.drag === i ? 2.5 : 1, minPx: 7 });
    d.text(`${NAMES[i]}  ${fmt(q.m, 4)} kg`, q.x, q.y, { size: fs(11), weight: "600", color: c, dy: -Math.max(R / d.px, 7) - 10 });
  });
  // Forças individuais e resultante
  f.parts.forEach((q, i) => d.arrow(s.probe.x, s.probe.y, q.fx * L, q.fy * L, { color: theme.series[i + 1], width: 2 }));
  if (f.F > 0) {
    d.line(s.probe.x, s.probe.y, s.probe.x + f.fx * L, s.probe.y, { color: theme.text, width: 1, dash: [4, 3], alpha: 0.6 });
    d.line(s.probe.x + f.fx * L, s.probe.y, s.probe.x + f.fx * L, s.probe.y + f.fy * L, { color: theme.text, width: 1, dash: [4, 3], alpha: 0.6 });
    d.arrow(s.probe.x, s.probe.y, f.fx * L, f.fy * L, { color: theme.text, width: 3.5, head: 12 });
    d.text("F", s.probe.x + f.fx * L, s.probe.y + f.fy * L, { size: fs(13), weight: "700", dx: 10, dy: -8 });
  }
  d.dot(s.probe.x, s.probe.y, 6, theme.accent);
  d.circle(s.probe.x, s.probe.y, 0, { stroke: theme.text, width: s.drag === 3 ? 2.5 : 1, minPx: 6 });
  d.text("m₀", s.probe.x, s.probe.y, { size: fs(11), color: theme.accent, weight: "600", dx: -12, dy: 12 });

  // Legenda
  const line = legend(d, 6.4, 4.5, fs);
  line("Forças sobre m₀", theme.text, "600", 12);
  f.parts.forEach((q, i) => line(`F_${NAMES[i]} = ${fmt(q.F * 1e9, 3)} nN`, theme.series[i + 1]));
  line(`|F| = ${fmt(f.F * 1e9, 3)} nN`, theme.text, "700");
  line(`Σ|Fᵢ| = ${fmt(f.parts.reduce((a, q) => a + q.F, 0) * 1e9, 3)} nN`, theme.muted);
  if (!narrow()) line(`g = F/m₀ = ${sci(f.F / m0)} m/s²`, theme.muted);
  line("");
  line("Arraste as esferas", theme.accent);
  line("e a partícula m₀.", theme.accent);
  if (num(p, "campo", 1) > 0.5) line("setas cinzas: campo g", theme.muted);
}

/** Posição no desenho (raio comprimido acima da superfície). */
const drawnRadius = (Rd: number, h: number) => Rd * (1 + h / (h + RE));

function renderAltitude(d: Draw, p: Params, s: GravState, fs: Fs) {
  const { theme } = d;
  const h = num(p, "h") * 1000;
  const lat = num(p, "lat");
  const dia = num(p, "dia", SIDEREAL_DAY_H);
  const m0 = num(p, "m0", 70);
  const e = gEffective(h, lat, dia);
  const C = { x: 4.6, y: 5.9 }, Rd = 2.5;
  const phi = (lat * Math.PI) / 180;

  // Terra (vista de lado), eixo e equador
  d.circle(C.x, C.y, Rd, { fill: theme.series[0], alpha: 0.18 });
  d.circle(C.x, C.y, Rd, { stroke: theme.series[0], width: 1.5 });
  d.line(C.x - Rd - 0.3, C.y, C.x + Rd + 0.3, C.y, { color: theme.muted, width: 1, dash: [4, 4] });
  d.text("equador", C.x - Rd - 0.3, C.y, { size: fs(10), color: theme.muted, align: "left", dy: -8 });
  d.arrow(C.x, C.y - Rd - 0.5, 0, 2 * Rd + 1.2, { color: theme.muted, width: 1.2 });
  d.text(`ω (dia de ${fmt(dia, 3)} h)`, C.x, C.y + Rd + 0.7, { size: fs(10), color: theme.muted, dy: -8 });
  // Meridianos girando (só ilustração)
  const spin = (s.tau / (dia * 3600)) * 2 * Math.PI;
  for (let i = 0; i < 6; i++) {
    const a = spin + (i * Math.PI) / 6;
    const w = Rd * Math.cos(a);
    if (Math.sin(a) < 0) continue;
    const pts: [number, number][] = [];
    for (let j = 0; j <= 40; j++) {
      const th = -Math.PI / 2 + (j * Math.PI) / 40;
      pts.push([C.x + w * Math.cos(th), C.y + Rd * Math.sin(th)]);
    }
    d.polyline(pts, { color: theme.series[0], width: 0.8, alpha: 0.35 });
  }

  // Ponto P na latitude e altitude escolhidas (raio comprimido)
  const rd = drawnRadius(Rd, h);
  const P = { x: C.x + rd * Math.cos(phi), y: C.y + rd * Math.sin(phi) };
  if (h > 0) d.circle(C.x, C.y, rd, { stroke: theme.muted, width: 0.8, dash: [2, 4] });
  d.line(C.x, P.y, P.x, P.y, { color: theme.series[1], width: 1, dash: [4, 3] });
  d.text("ρ = r cos φ", (C.x + P.x) / 2, P.y, { size: fs(10), color: theme.series[1], dy: -9 });
  d.line(C.x, C.y, P.x, P.y, { color: theme.muted, width: 1 });
  if (lat > 3) d.text(`φ = ${fmt(lat, 3)}°`, C.x + 0.9 * Math.cos(phi / 2), C.y + 0.9 * Math.sin(phi / 2), { size: fs(10), color: theme.muted, align: "left", dx: 4 });

  // Vetores em escala real: 1,6 unidade = 9,8 m/s²
  const sc = 1.6 / 9.8;
  const up = { x: Math.cos(phi), y: Math.sin(phi) };
  const north = { x: -Math.sin(phi), y: Math.cos(phi) };
  const gx = -e.g * up.x, gy = -e.g * up.y;
  const cx = e.ac, cy = 0; // centrífuga: para fora do eixo (horizontal no desenho)
  const ex = e.up * up.x + e.north * north.x, ey = e.up * up.y + e.north * north.y;
  d.arrow(P.x, P.y, gx * sc, gy * sc, { color: theme.series[3], width: 2.5 });
  d.text("g", P.x + gx * sc, P.y + gy * sc, { size: fs(12), weight: "700", color: theme.series[3], dx: -8, dy: 12 });
  if (e.ac * sc > 0.03) {
    d.arrow(P.x, P.y, cx * sc, cy * sc, { color: theme.series[1], width: 2 });
    d.text("ω²ρ", P.x + cx * sc, P.y, { size: fs(11), color: theme.series[1], dx: 14, dy: -8 });
  }
  d.arrow(P.x, P.y, ex * sc, ey * sc, { color: theme.accent, width: 2, dash: [5, 3] });
  d.text("g_ef", P.x + 0.55 * ex * sc, P.y + 0.55 * ey * sc, { size: fs(11), weight: "600", color: theme.accent, dy: 22 });
  d.dot(P.x, P.y, 5, theme.text);

  const line = legend(d, 0.4, 2.55, fs);
  line(`h = ${fmt(h / 1000, 4)} km   (raio fora de escala)`, theme.muted, "400", 10);
  line(`g = ${fmt(e.g, 4)} m/s²   (${fmt((100 * e.g) / gAt(0), 3)}% da superfície)`, theme.series[3], "600");
  line(`g_ef = ${fmt(e.mag, 5)} m/s²   prumo desviado ${fmt(e.dev, 2)}°`, theme.accent);
  line(`balança (m = ${fmt(m0, 3)} kg): ${fmt(m0 * e.mag, 4)} N`, theme.text, "600");

  // Gráfico 1: g × h
  const hMax = 40000;
  const A = panel(d, { x0: 11.9, y0: 6.6, x1: 19.6, y1: 11.1 }, { min: 0, max: hMax }, { min: 0, max: 10.5 }, PO());
  A.frame({ xlabel: "h (km)", ylabel: "g (m/s²)", fx: (v) => fmt(v / 1000, 3) + (v ? " mil" : "") });
  A.plot((x) => gAt(x * 1000), 0, hMax, { color: theme.series[3], width: 2 });
  A.plot((x) => gEffective(x * 1000, lat, dia).up * -1, 0, hMax, { color: theme.accent, width: 1.5, dash: [5, 3] });
  for (const [hh, name] of [[ISS, "ISS"], [GPS, "GPS"], [GEO_H, "GEO"]] as [number, string][]) {
    A.line([[hh, 0], [hh, gAt(hh * 1000)]], { color: theme.muted, width: 1, dash: [2, 3] });
    d.text(name, A.X(hh), A.Y(gAt(hh * 1000)), { size: fs(9), color: theme.muted, dy: -8, dx: name === "ISS" ? 10 : 0 });
  }
  if (h / 1000 <= hMax) d.dot(A.X(h / 1000), A.Y(e.g), 5, theme.series[3]!);
  if (!narrow()) d.text("— g   - - g_ef girando junto (radial)", A.box.x1, A.box.y1, { size: fs(9), color: theme.muted, align: "right", dy: -9 });

  // Gráfico 2: g na superfície × latitude
  const lo = Math.min(9.74, gEffective(0, 0, dia).mag - 0.01);
  const B = panel(d, { x0: 11.9, y0: 0.9, x1: 19.6, y1: 4.9 }, { min: 0, max: 90 }, { min: Math.max(0, lo), max: 9.86 }, PO());
  B.frame({ xlabel: "φ (°)", ylabel: narrow() ? "g_ef, h = 0" : "g_ef ao nível do mar (m/s²)", fx: (v) => fmt(v, 2), fy: (v) => fmt(v, 4) });
  B.plot((x) => gEffective(0, x, dia).mag, 0, 90, { color: theme.accent, width: 2 });
  B.plot((x) => somigliana(x), 0, 90, { color: theme.series[2], width: 2, dash: [5, 3] });
  d.dot(B.X(lat), B.Y(gEffective(0, lat, dia).mag), 5, theme.accent);
  d.text(narrow() ? "— modelo  - - WGS 84" : "— esfera girando   - - Terra real (WGS 84)", B.box.x1 - 0.15, B.box.y0 + 0.3, { size: fs(9), color: theme.muted, align: "right" });
}

function renderInterior(d: Draw, p: Params, fs: Fs) {
  const { theme } = d;
  const em = earthModel(p);
  const r = num(p, "r") * 1000;
  const C = { x: 4.6, y: 5.6 }, Rd = 3.7;
  const toD = (rr: number) => (rr <= RE ? (Rd * rr) / RE : Rd * (1 + 0.35 * (rr / RE - 1)));

  // Corte da Terra
  if (em.kind === 2) {
    d.circle(C.x, C.y, Rd, { stroke: theme.series[1], width: 5 });
  } else {
    d.circle(C.x, C.y, Rd, { fill: theme.series[1], alpha: em.kind === 1 ? 0.18 : 0.25 });
    if (em.kind === 1) d.circle(C.x, C.y, (Rd * em.rc) / RE, { fill: theme.series[1], alpha: 0.45 });
    d.circle(C.x, C.y, Rd, { stroke: theme.series[1], width: 1.5 });
  }
  // Esfera interna (puxa) e casca externa (não puxa)
  const rd = toD(r);
  const ang = (55 * Math.PI) / 180;
  if (r < RE) {
    d.circle(C.x, C.y, rd, { fill: theme.accent, alpha: 0.22 });
    d.circle(C.x, C.y, rd, { stroke: theme.accent, width: 1.5 });
    // Hachura da casca externa
    d.ctx.save();
    d.ctx.beginPath();
    d.ctx.arc(C.x, C.y, Rd, 0, 2 * Math.PI);
    d.ctx.arc(C.x, C.y, rd, 0, 2 * Math.PI, true);
    d.ctx.clip("evenodd");
    for (let x = C.x - Rd - Rd; x < C.x + Rd; x += 0.35) d.line(x, C.y - Rd, x + 2 * Rd, C.y + Rd, { color: theme.muted, width: 1, alpha: 0.45 });
    d.ctx.restore();
  } else {
    d.circle(C.x, C.y, rd, { stroke: theme.muted, width: 1, dash: [3, 4] });
  }
  const P = { x: C.x + rd * Math.cos(ang), y: C.y + rd * Math.sin(ang) };
  d.line(C.x, C.y, P.x, P.y, { color: theme.muted, width: 1, dash: [3, 3] });
  d.text("r", (C.x + P.x) / 2, (C.y + P.y) / 2, { size: fs(11), color: theme.muted, dx: -8 });
  const g = gInside(r, em);
  const L = (1.6 * g) / 10;
  d.arrow(P.x, P.y, -L * Math.cos(ang), -L * Math.sin(ang), { color: theme.series[3], width: 2.5 });
  d.dot(P.x, P.y, 5, theme.text);
  d.text(`g = ${fmt(g, 3)} m/s²`, P.x, P.y, { size: fs(11), weight: "600", color: theme.series[3], align: "left", dx: 9, dy: -2 });

  const line = legend(d, 0.3, 11.5, fs);
  line(`M(r) = ${fmt((100 * massInside(r, em)) / ME, 3)}% da massa da Terra`, theme.accent, "600");
  if (r < RE) line("casca hachurada: força resultante nula", theme.muted, "400", 10);
  if (em.kind === 1) line(`núcleo ${fmt(em.rhoc / 1000, 3)} g/cm³, manto ${fmt(mantleDensity(em) / 1000, 3)} g/cm³`, theme.series[1], "400", 10);
  if (em.kind === 2) line("toda a massa numa casca fina na superfície", theme.series[1], "400", 10);

  // Gráfico g(r)
  const A = panel(d, { x0: 11.6, y0: 1.2, x1: 19.6, y1: 10.6 }, { min: 0, max: 2 * RE }, { min: 0, max: 12 }, PO());
  A.frame({ xlabel: "r (km)", ylabel: "g (m/s²)", fx: (v) => fmt(v / 1000, 4), xticks: narrow() ? [0, 4e6, 8e6, 12e6] : [0, 2e6, 4e6, 6e6, 8e6, 10e6, 12e6] });
  A.line([[RE, 0], [RE, 12]], { color: theme.muted, width: 1, dash: [3, 3] });
  d.text("superfície", A.X(RE), A.box.y1, { size: fs(9), color: theme.muted, dy: 8, align: "left", dx: 3 });
  if (em.kind === 1) {
    A.line([[em.rc, 0], [em.rc, 12]], { color: theme.series[1], width: 1, dash: [3, 3] });
    d.text("núcleo", A.X(em.rc), A.box.y1, { size: fs(9), color: theme.series[1], dy: 8, align: "right", dx: -3 });
  }
  if (em.kind !== 0) A.plot((x) => gInside(x, { ...em, kind: 0 }), 0, 2 * RE, { color: theme.muted, width: 1.5, dash: [5, 3], n: 300 });
  A.plot((x) => gInside(x, em), 0, 2 * RE, { color: theme.series[3], width: 2.2, n: 400 });
  d.dot(A.X(r), A.Y(g), 5, theme.series[3]!);
  // Densidade, como barra fina no rodapé
  d.text(em.kind === 0 ? "— Terra uniforme" : "— modelo escolhido   - - uniforme", A.box.x1, A.box.y1, { size: fs(9), color: theme.muted, align: "right", dy: -9 });
  void density;
}

function renderTunnel(d: Draw, s: GravState, p: Params, trail: GravState[], fs: Fs) {
  const { theme } = d;
  const em = earthModel(p);
  const b = num(p, "b") * 1000;
  const C = { x: 5.0, y: 5.5 }, Rd = 4.3;
  const k = Rd / RE;
  const hc = halfChord(b);
  const yT = C.y - b * k;

  d.circle(C.x, C.y, Rd, { fill: theme.series[1], alpha: em.kind === 1 ? 0.15 : 0.22 });
  if (em.kind === 1) d.circle(C.x, C.y, em.rc * k, { fill: theme.series[1], alpha: 0.4 });
  d.circle(C.x, C.y, Rd, { stroke: theme.series[1], width: 1.5 });
  // Túnel
  d.rect(C.x - hc * k, yT - 0.09, 2 * hc * k, 0.18, { fill: theme.ground, stroke: theme.muted, width: 1 });
  if (b > 0) {
    d.line(C.x, C.y, C.x, yT, { color: theme.muted, width: 1, dash: [3, 3] });
    d.text(`b = ${fmt(b / 1000, 3)} km`, C.x, (C.y + yT) / 2, { size: fs(10), color: theme.muted, align: "left", dx: 5 });
  }
  // Satélite rasante (mesmo período da Terra uniforme) e sua sombra no túnel
  const w0 = omegaTunnel();
  const th = w0 * s.tau;
  const sat = { x: C.x + (Rd + 0.25) * Math.cos(th), y: C.y + (Rd + 0.25) * Math.sin(th) };
  d.circle(C.x, C.y, Rd + 0.25, { stroke: theme.muted, width: 0.8, dash: [2, 5] });
  d.dot(sat.x, sat.y, 5, theme.series[2]!);
  d.text("satélite rasante", sat.x, sat.y, { size: fs(9), color: theme.series[2], dy: sat.y > C.y ? -10 : 12 });
  const ghost = C.x + hc * k * Math.cos(th);
  d.line(ghost, yT, ghost, yT + 0.6 * Math.sign(Math.sin(th) || 1), { color: theme.series[2], width: 1, dash: [2, 2] });
  d.dot(ghost, yT, 4, theme.series[2]!, 0.7);
  // Corpo
  const xb = C.x + s.s * k;
  const r = Math.hypot(s.s, b);
  const a = r > 0 ? (gInside(r, em) * s.s) / r : 0;
  d.dot(xb, yT, 7, theme.accent);
  if (Math.abs(a) > 0.05) d.arrowPx(xb, yT, -a, 0, clamp(Math.abs(a) * 5, 8, 50), { color: theme.series[3], width: 2 });
  if (Math.abs(s.v) > 10) d.arrowPx(xb, yT + 0.35, s.v, 0, clamp(Math.abs(s.v) / 140, 6, 60), { color: theme.accent, width: 1.5, head: 6 });

  const line = legend(d, 0.3, 11.6, fs);
  line(`t = ${fmt(s.tau / 60, 3)} min`, theme.text, "600");
  line(`v = ${fmt(s.v / 1000, 3)} km/s`, theme.accent);
  if (s.tArr > 0) line(`travessia: ${fmt(s.tArr / 60, 4)} min`, theme.series[3], "600");
  line("sombra verde: MHS da Terra uniforme", theme.muted, "400", 10);

  // Gráfico s(t)
  const Tm = (2.05 * periodTunnel()) / 60;
  const R0 = RE / 1000;
  const A = panel(d, { x0: 12.2, y0: 1.3, x1: 19.6, y1: 10.6 }, { min: 0, max: Tm }, { min: -R0 * 1.05, max: R0 * 1.05 }, PO());
  A.frame({ xlabel: "t (min)", ylabel: "s (km)", fx: (v) => fmt(v, 3), fy: (v) => fmt(v, 4) });
  A.plot((t) => (hc / 1000) * Math.cos(w0 * t * 60), 0, Tm, { color: theme.series[2], width: 1.5, dash: [5, 3], n: 300 });
  const pts: [number, number][] = trail.map((q) => [q.tau / 60, q.s / 1000]);
  pts.push([s.tau / 60, s.s / 1000]);
  A.line(pts, { color: theme.accent, width: 2 });
  d.dot(A.X(s.tau / 60), A.Y(s.s / 1000), 4, theme.accent);
  d.text("— simulado   - - MHS (T = 84 min)", A.box.x1, A.box.y1, { size: fs(9), color: theme.muted, align: "right", dy: -9 });
}

function renderElevator(d: Draw, s: GravState, p: Params, fs: Fs) {
  const { theme } = d;
  const sit = Math.round(num(p, "situacao"));
  const c = elevCase(p);
  const outside = num(p, "ref") > 0.5;
  const t = s.tau;
  const yE = outside ? floorY(c, t) : 0;
  const W = CAB.w, H = CAB.h;
  const X0 = -W / 2;
  const vp = gravitacaoTerra.viewport(p, s);

  // Fundo: régua fixa no referencial inercial (só visível de fora)
  if (outside) {
    for (let y = Math.ceil(vp.yMin); y <= vp.yMax; y++) {
      d.line(-3.3, y, y % 5 === 0 ? -2.7 : -2.95, y, { color: theme.muted, width: 1 });
      if (y % 2 === 0) d.text(`${y} m`, -2.6, y, { size: fs(9), color: theme.muted, align: "left" });
    }
    d.line(-3.3, vp.yMin, -3.3, vp.yMax, { color: theme.muted, width: 1 });
    if (sit === 1 || sit === 3) for (let i = 0; i < 26; i++) d.dot(-3.2 + ((i * 37) % 70) / 6.5, vp.yMin + ((i * 53) % 97) / 97 * (vp.yMax - vp.yMin), 1.4, theme.muted, 0.6);
  }
  // Cabine
  d.rect(X0, yE, W, H, { fill: theme.ground, alpha: 0.35 });
  d.rect(X0, yE, W, H, { stroke: theme.text, width: 2 });
  // Indicadores da situação
  if (sit === 0 || sit === 2) {
    if (!outside || sit === 0) {
      if (sit === 0) d.support(X0 - 0.3, -0.05, X0 + W + 0.3, -0.05);
      d.text("Terra", 0, -0.55, { size: fs(10), color: theme.muted });
    }
    if (sit === 0) d.line(0, yE + H, 0, yE + H + 1.2, { color: theme.muted, width: 1.5 });
    else {
      d.line(0, yE + H + 0.6, 0, yE + H + 1.2, { color: theme.muted, width: 1.5 });
      d.text("cabo cortado", 0.15, yE + H + 0.4, { size: fs(9), color: theme.muted, align: "left" });
    }
    d.arrow(X0 - 0.75, yE + H * 0.75, 0, -1.0, { color: theme.series[3], width: 2 });
    d.text("g", X0 - 0.75, yE + H * 0.75, { size: fs(11), color: theme.series[3], dy: -8 });
  } else if (sit === 1) {
    const fl = 0.35 + 0.15 * Math.sin(t * 40);
    d.polyline([[-0.6, yE], [0, yE - 0.4 - fl], [0.6, yE]], { color: theme.series[1], fill: theme.series[1], alpha: 0.75, close: true });
    d.text("foguete", 0.9, yE - 0.3, { size: fs(9), color: theme.series[1], align: "left" });
    d.arrow(X0 - 0.75, yE + H * 0.25, 0, 1.0, { color: theme.series[1], width: 2 });
    d.text("a", X0 - 0.75, yE + H * 0.25 + 1, { size: fs(11), color: theme.series[1], dy: -8 });
  } else {
    d.text("espaço, sem forças", 0, yE + H + 0.3, { size: fs(9), color: theme.muted });
  }

  // Trajetórias (estroboscópio a cada 0,1 s) e posições atuais
  const toY = (yRel: number, tt: number) => yRel + (outside ? floorY(c, tt) : 0);
  const ballX = 1.1;
  for (let tt = 0; tt < t - 1e-9; tt += 0.1) {
    const bb = ballRel(c, BALL_H0, tt, BALL_R);
    d.circle(ballX, toY(bb.y, tt), BALL_R, { stroke: theme.series[3], width: 1, alpha: 0.35 });
  }
  const bNow = ballRel(c, BALL_H0, t, BALL_R);
  d.circle(ballX, toY(bNow.y, t), BALL_R, { fill: theme.series[3] });
  d.text("bola", ballX, toY(bNow.y, t), { size: fs(9), color: theme.series[3], align: "left", dx: 16 });

  const lNow = lightRel(c, LIGHT_H, C_DRAW, t);
  const path: [number, number][] = [];
  const nS = 40;
  for (let i = 0; i <= nS; i++) {
    const tt = (Math.min(t, lNow.tCross) * i) / nS;
    const l = lightRel(c, LIGHT_H, C_DRAW, tt);
    path.push([l.x, toY(l.y, tt)]);
  }
  d.line(X0, toY(LIGHT_H, 0), X0 + W, toY(LIGHT_H, 0), { color: theme.muted, width: 1, dash: [3, 4], alpha: 0.6 });
  d.polyline(path, { color: theme.series[5], width: 2.5 });
  d.dot(lNow.x, toY(lNow.y, t), 4, theme.series[5]!);
  d.rect(X0 - 0.12, yE + LIGHT_H - 0.1, 0.12, 0.2, { fill: theme.series[5] });
  d.text("luz", X0 + 0.15, yE + LIGHT_H + 0.25, { size: fs(9), color: theme.series[5], align: "left" });

  // Legenda
  const names = ["Parado na Terra", "Foguete no espaço", "Queda livre na Terra", "À deriva no espaço"];
  const line = legend(d, 2.6, vp.yMax - 0.35, fs);
  line(names[sit] ?? "", theme.text, "700", 12);
  line(outside ? "visto de fora (inercial)" : "visto de dentro da cabine", theme.muted, "400", 10);
  line(`t = ${fmt(t, 3)} s`, theme.text);
  line(`g aparente = ${fmt(apparentG(c), 3)} m/s²`, theme.accent, "600");
  line(apparentG(c) > 1e-9 ? "bola e luz caem juntas" : "bola flutua, luz reta", theme.muted, "400", 10);
  line(`luz desenhada a ${C_DRAW} m/s`, theme.muted, "400", 10);
}

export default gravitacaoTerra;
