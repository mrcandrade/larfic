import { clamp, defineSim, draw, num, projector, rad, renderFaces, sphere, texNum, type Params, type V3 } from "@fisilab/core";
import {
  CONSTELLATIONS, LINES, R_EARTH_KM, SKY, STARS, T_SUN, WIEN_B, altAz, bvFromT, greatCircle, hrRegion, lst, msLifetime, planck, radiusOf, remnant, spectralClass,
  starColor, sunDec, sunRA, track, trackAt, zamsL, zamsT,
} from "./physics.ts";

export * from "./physics.ts";

type DragKind = "cur" | "temp" | "sky" | "cam";
export interface HRState {
  t: number;
  /** Estrela-cursor no diagrama HR: T (K) e L (L☉). */
  cur: [number, number];
  /** Estrela real selecionada (−1 = nenhuma). */
  sel: number;
  /** Progresso na trajetória evolutiva (nós). */
  u: number;
  /** Horas passadas desde a hora inicial (céu). */
  skyH: number;
  /** Temperatura escolhida na régua de cores (K). */
  Tc: number;
  yaw: number;
  pitch: number;
  drag: { kind: DragKind; x0: number; y0: number; a: number; b: number } | null;
}

const mode = (p: Params) => Math.round(num(p, "modo"));
// Diagrama HR
const PX0 = 1.2, PW = 9.0, PY0 = 0.9, PH = 8.5;
const LT0 = Math.log10(45000), LT1 = Math.log10(2400), LL0 = -5, LL1 = 6.5;
export const hrX = (T: number) => PX0 + (PW * (LT0 - Math.log10(T))) / (LT0 - LT1);
export const hrY = (L: number) => PY0 + (PH * (Math.log10(L) - LL0)) / (LL1 - LL0);
const hrT = (x: number) => 10 ** (LT0 - ((x - PX0) * (LT0 - LT1)) / PW);
const hrL = (y: number) => 10 ** (LL0 + ((y - PY0) * (LL1 - LL0)) / PH);
// Régua de temperatura (modo cor)
const BX0 = 0.8, BW = 9.6, BY = 8.9, BT0 = 2000, BT1 = 40000;
const barX = (T: number) => BX0 + (BW * Math.log(T / BT0)) / Math.log(BT1 / BT0);
const barT = (x: number) => BT0 * (BT1 / BT0) ** clamp((x - BX0) / BW, 0, 1);
// Céu
const SKX = 5.0, SKY_Y = 5.0, SKR = 4.5;
const EVOL_RATE = 0.3;

/** Hora solar local (h, 0–24) e dia do ano no céu. */
export function skyTime(s: HRState, p: Params) {
  const h = num(p, "hora", 21) + s.skyH;
  const day = num(p, "dia", 196) + Math.floor(h / 24);
  return { hour: ((h % 24) + 24) % 24, day };
}
export function skyLST(s: HRState, p: Params) {
  const { hour, day } = skyTime(s, p);
  return lst(day, hour);
}
export function starAltAz(name: string, s: HRState, p: Params) {
  const st = SKY.find((x) => x.name === name)!;
  return altAz(st.ra, st.dec, num(p, "lat", -23.5), skyLST(s, p));
}

/** (T, L, R) da estrela em foco no modo atual. */
export function focus(s: HRState, p: Params) {
  const m = mode(p);
  if (m === 1) {
    const a = trackAt(num(p, "M", 1), s.u);
    return { T: a.T, L: a.L, R: a.R };
  }
  if (m === 2) return { T: s.Tc, L: NaN, R: NaN };
  return { T: s.cur[0], L: s.cur[1], R: radiusOf(s.cur[1], s.cur[0]) };
}

const fmt = (v: number, n = 3) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e5 || a < 1e-2)) {
    const [m, e] = v.toExponential(n - 1).split("e");
    return `${m!.replace(".", ",")}×10^${Number(e)}`;
  }
  return Number(v.toPrecision(n)).toLocaleString("pt-BR");
};
const fmtAge = (yr: number) => (yr >= 1e9 ? `${fmt(yr / 1e9)} bilhões de anos` : yr >= 1e6 ? `${fmt(yr / 1e6)} milhões de anos` : `${fmt(yr)} anos`);
const MONTHS = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
const dateOf = (day: number) => {
  const dm = [31, 28, 31, 30, 31, 30, 31, 31, 30, 31, 30, 31];
  let d = ((Math.floor(day) - 1) % 365 + 365) % 365;
  let m = 0;
  while (d >= dm[m]!) { d -= dm[m]!; m++; }
  return `${d + 1} de ${MONTHS[m]}`;
};
const dms = (v: number, pos: string, neg: string) => {
  const a = Math.abs(v);
  const deg = Math.floor(a), min = Math.round((a - deg) * 60);
  return `${deg}°${String(min).padStart(2, "0")}′ ${v >= 0 ? pos : neg}`;
};

const LABELED = new Set(["Sol", "Sírius A", "Sírius B", "Betelgeuse", "Rigel", "Antares", "Próxima Centauri", "Arcturus", "Canopus", "Deneb", "Prócion B", "Vega", "Acrux", "Estrela de Barnard", "Aldebarã"]);

const ll3 = (lat: number, lon: number, r = 1): V3 => [r * Math.cos(rad(lat)) * Math.cos(rad(lon)), r * Math.cos(rad(lat)) * Math.sin(rad(lon)), r * Math.sin(rad(lat))];

export const estrelasHr = defineSim<HRState>({
  id: "estrelas-hr",
  title: "Estrelas: diagrama HR, evolução, cores e céu do hemisfério sul",
  course: "FG IV",
  topic: "Astrofísica",
  priority: "P2",
  summary:
    "Diagrama HR com estrelas reais e linhas de raio constante, evolução de uma estrela conforme a massa, cor e espectro de corpo negro, o céu do hemisfério sul por data, hora e latitude, e a Terra com paralelos e meridianos.",
  equations: [
    String.raw`L = 4\pi R^2 \sigma T^4 \;\Rightarrow\; \frac{L}{L_\odot} = \left(\frac{R}{R_\odot}\right)^2 \left(\frac{T}{T_\odot}\right)^4`,
    String.raw`\lambda_{max} T = 2{,}898\times10^{-3}\ \text{m·K} \qquad t_{SP} \approx 10^{10}\ \text{anos}\,\left(\frac{M}{M_\odot}\right)^{-2{,}5} \qquad L \propto M^{3{,}5\text{–}4}`,
    String.raw`\operatorname{sen} h = \operatorname{sen}\varphi \operatorname{sen}\delta + \cos\varphi\cos\delta\cos H \qquad H = \text{TSL} - \alpha \qquad h_{\text{polo}} = |\varphi|`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 3) {
      const a = starAltAz("Acrux", s, p);
      return [String.raw`\text{TSL} = ${texNum(skyLST(s, p) / 15)}\ \text{h} \qquad h_{\text{Acrux}} = ${texNum(a.alt)}^\circ \qquad h_{\text{polo sul}} = ${texNum(-num(p, "lat", -23.5))}^\circ`];
    }
    if (m === 4) {
      const d = greatCircle(num(p, "lat", -23.5), num(p, "lon", -46.6), num(p, "lat2", 51.5), num(p, "lon2", 0));
      return [String.raw`d_{AB} = R\,\Delta\sigma = ${texNum(d, 4)}\ \text{km} \qquad 2\pi R\cos\varphi = ${texNum(2 * Math.PI * R_EARTH_KM * Math.cos(rad(num(p, "lat", -23.5))), 4)}\ \text{km}`];
    }
    const f = focus(s, p);
    if (m === 2) return [String.raw`\lambda_{max} = \frac{2{,}898\times10^{-3}}{${texNum(f.T, 4)}} = ${texNum((WIEN_B / f.T) * 1e9, 4)}\ \text{nm} \qquad B-V = ${texNum(bvFromT(f.T))}`];
    const out = [String.raw`\frac{R}{R_\odot} = \frac{\sqrt{${texNum(f.L)}}}{(${texNum(f.T, 4)}/5772)^2} = ${texNum(f.R)}`];
    if (m === 1) out.push(String.raw`t_{SP} = 10^{10}\cdot ${texNum(num(p, "M", 1))}^{-2{,}5} = ${texNum(msLifetime(num(p, "M", 1)))}\ \text{anos} \qquad \text{idade} = ${texNum(trackAt(num(p, "M", 1), s.u).age)}\ \text{anos}`);
    return out;
  },

  params: [
    {
      key: "modo", label: "Atividade", unit: "", min: 0, max: 4, step: 1, default: 0,
      options: [
        { value: 0, label: "Diagrama HR com estrelas reais" },
        { value: 1, label: "Evolução de uma estrela" },
        { value: 2, label: "Cor e temperatura (corpo negro)" },
        { value: 3, label: "Céu noturno do hemisfério sul" },
        { value: 4, label: "Paralelos e meridianos" },
      ],
    },
    { key: "M", label: "Massa da estrela (evolução)", unit: "M☉", min: 0.5, max: 40, step: 0.1, default: 1, log: true },
    { key: "T", label: "Temperatura inicial (régua de cores)", unit: "K", min: 2000, max: 40000, step: 10, default: 5772, log: true },
    { key: "dia", label: "Dia do ano", unit: "", min: 1, max: 365, step: 1, default: 196, live: true },
    { key: "hora", label: "Hora solar local inicial", unit: "h", min: 0, max: 24, step: 0.25, default: 21, live: true },
    { key: "lat", label: "Latitude do observador", unit: "°", min: -90, max: 90, step: 0.5, default: -23.5, live: true },
    { key: "lon", label: "Longitude do observador", unit: "°", min: -180, max: 180, step: 0.5, default: -46.6, live: true },
    { key: "orient", label: "Mapa do céu", unit: "", min: 0, max: 1, step: 1, default: 1, live: true, options: [{ value: 1, label: "Olhando para o sul (S embaixo)" }, { value: 0, label: "Olhando para o norte (N embaixo)" }] },
    { key: "lat2", label: "Latitude do ponto B", unit: "°", min: -90, max: 90, step: 0.5, default: 51.5, live: true },
    { key: "lon2", label: "Longitude do ponto B", unit: "°", min: -180, max: 180, step: 0.5, default: 0, live: true },
  ],

  observables: [
    { key: "T", label: "Temperatura efetiva", unit: "K", value: (s, p) => focus(s, p).T },
    { key: "L", label: "Luminosidade", unit: "L☉", value: (s, p) => { const L = focus(s, p).L; return Number.isFinite(L) ? L : 0; } },
    { key: "R", label: "Raio", unit: "R☉", value: (s, p) => { const R = focus(s, p).R; return Number.isFinite(R) ? R : 0; } },
    { key: "lamMax", label: "Pico do espectro (Wien)", unit: "nm", value: (s, p) => (WIEN_B / focus(s, p).T) * 1e9 },
    { key: "BV", label: "Índice de cor B − V", unit: "", value: (s, p) => bvFromT(focus(s, p).T) },
    { key: "idade", label: "Idade (evolução)", unit: "Ga", value: (s, p) => trackAt(num(p, "M", 1), s.u).age / 1e9 },
    { key: "hAcrux", label: "Altura de Acrux", unit: "°", value: (s, p) => starAltAz("Acrux", s, p).alt },
    { key: "hAntares", label: "Altura de Antares", unit: "°", value: (s, p) => starAltAz("Antares", s, p).alt },
    { key: "hPolo", label: "Altura do polo sul celeste", unit: "°", value: (_s, p) => -num(p, "lat", -23.5) },
    { key: "hora", label: "Hora solar local", unit: "h", value: (s, p) => skyTime(s, p).hour },
    { key: "dist", label: "Distância A–B (grande círculo)", unit: "km", value: (_s, p) => greatCircle(num(p, "lat", -23.5), num(p, "lon", -46.6), num(p, "lat2", 51.5), num(p, "lon2", 0)) },
    { key: "paralelo", label: "Comprimento do paralelo de A", unit: "km", value: (_s, p) => 2 * Math.PI * R_EARTH_KM * Math.cos(rad(num(p, "lat", -23.5))) },
  ],
  chart: { x: "t", y: "T" },

  scenarios: [
    {
      id: "hr",
      label: "Diagrama HR",
      params: { modo: 0 },
      guide: `### Lendo o diagrama HR
1. A temperatura cresce para a **esquerda** e a luminosidade para cima (escalas logarítmicas).
2. Arraste a estrela-cursor: $R$ é calculado por $L = R^2 T^4$ (unidades solares). As retas tracejadas têm raio constante.
3. Clique nas estrelas reais: Betelgeuse e Antares são supergiantes vermelhas; Sírius B e Prócion B são anãs brancas, quentes mas pequenas.
4. Compare o tamanho das estrelas com o do Sol no quadro à direita.`,
      predict: [
        {
          question: "Uma estrela tem a mesma temperatura do Sol e luminosidade 100 vezes maior. Seu raio é:",
          options: ["100 R☉", "10 R☉", "igual ao do Sol", "1/10 R☉"],
          answer: 1,
          explanation: "Com $T$ igual, $L \\propto R^2$: $R = \\sqrt{100} = 10\\,R_\\odot$. Ela está acima da sequência principal, entre as gigantes.",
        },
      ],
    },
    {
      id: "evolucao",
      label: "Evolução do Sol",
      params: { modo: 1, M: 1 },
      guide: `### A vida de uma estrela
1. Rode: a estrela passa ~90% da vida na sequência principal, queimando hidrogênio no núcleo.
2. Depois sobe pelo ramo das gigantes vermelhas (o Sol chegará a ~100–200 $R_\\odot$), queima hélio, expele a nebulosa planetária e termina como anã branca.
3. Troque a massa para 15 $M_\\odot$: a vida é mil vezes mais curta, a estrela vira supergiante e explode como supernova.
4. Confira $t_{SP} \\approx 10^{10}\\,M^{-2{,}5}$ anos.`,
      predict: [
        {
          question: "Uma estrela de 10 massas solares, comparada ao Sol, vive:",
          options: ["10 vezes mais", "o mesmo tempo", "cerca de 300 vezes menos", "10 vezes menos"],
          answer: 2,
          explanation: "$t \\propto M/L \\propto M^{-2{,}5}$: $10^{-2{,}5} \\approx 1/316$. Ela queima o combustível muito mais depressa.",
        },
      ],
    },
    {
      id: "cor",
      label: "Cor × temperatura",
      params: { modo: 2, T: 3500 },
      guide: `### Cor de um corpo negro
1. Arraste o marcador na régua de temperatura. O pico do espectro segue a lei de Wien.
2. A 3500 K o pico está no infravermelho e a estrela parece **laranja-avermelhada**; a 25 000 K, azul-esbranquiçada.
3. Por que não existem estrelas verdes? Veja a curva quando o pico está em 500 nm: o espectro cobre todo o visível e a mistura parece branca.`,
      predict: [
        {
          question: "Uma estrela com pico de emissão em 500 nm (verde) parece:",
          options: ["verde", "branca (levemente amarelada)", "azul", "vermelha"],
          answer: 1,
          explanation: "O espectro de Planck é largo: a 5800 K todas as cores do visível estão presentes em proporções parecidas, e o olho vê branco.",
        },
      ],
    },
    {
      id: "ceu",
      label: "Céu de julho (São Paulo)",
      params: { modo: 3, dia: 196, hora: 21, lat: -23.5, orient: 1 },
      guide: `### O céu gira em torno do polo sul celeste
1. Rode: as estrelas giram 15° por hora em torno do **polo sul celeste**, que fica a $|\\varphi|$ acima do horizonte sul.
2. Ache o **Cruzeiro do Sul**, as guardas (α e β Centauro) e o **Escorpião** com Antares, a gigante vermelha.
3. Mude a latitude para −35°: o Cruzeiro passa a ser circumpolar (nunca se põe, pois $\\delta < -(90^\\circ - |\\varphi|)$).
4. Mude o dia para janeiro: às 21 h vemos **Órion** (as Três Marias) e **Sírius**.`,
      predict: [
        {
          question: "Em Porto Alegre (φ ≈ −30°), a que altura fica o polo sul celeste?",
          options: ["0° (no horizonte)", "30°", "60°", "90° (no zênite)"],
          answer: 1,
          explanation: "A altura do polo celeste é igual ao módulo da latitude: $h = |\\varphi| = 30^\\circ$.",
        },
      ],
    },
    {
      id: "globo",
      label: "Paralelos e meridianos",
      params: { modo: 4, lat: -23.5, lon: -46.6, lat2: 51.5, lon2: 0 },
      guide: `### Coordenadas geográficas
1. Arraste o globo para girar. **Paralelos** são círculos de latitude constante; **meridianos** ligam os polos.
2. O ponto A (São Paulo) e o ponto B (Greenwich) estão ligados pelo arco de grande círculo: a menor distância.
3. O comprimento de 1° de longitude é $111{,}2\\cos\\varphi$ km: diminui até zero nos polos.
4. Veja a seta do eixo da Terra em A: ela faz com o horizonte local um ângulo igual a $|\\varphi|$.`,
    },
  ],

  exercises: [
    {
      id: "raio",
      prompt: "Uma estrela tem temperatura {T} K e luminosidade {L} L☉. Qual é o raio, em raios solares? (T☉ = 5772 K)",
      vary: { T: [3000, 30000, 0], L: [0.01, 50000, 2] },
      answer: { label: "R", unit: "R☉", compute: (p) => radiusOf(num(p, "L"), num(p, "T")) },
      hint: "L/L☉ = (R/R☉)² (T/T☉)⁴.",
    },
    {
      id: "vida",
      prompt: "Estime o tempo de vida na sequência principal de uma estrela de {M} massas solares, em bilhões de anos (use t = 10¹⁰ anos·M^−2,5).",
      vary: { M: [0.6, 15, 1] },
      answer: { label: "t", unit: "Ga", compute: (p) => msLifetime(num(p, "M")) / 1e9 },
    },
    {
      id: "wien",
      prompt: "Em que comprimento de onda, em nm, está o pico de emissão de uma estrela de {T} K?",
      vary: { T: [3000, 30000, 0] },
      answer: { label: "λmax", unit: "nm", compute: (p) => (WIEN_B / num(p, "T")) * 1e9 },
    },
    {
      id: "culminacao",
      prompt: "Qual é a altura máxima (passagem meridiana) de uma estrela de declinação {dec}° vista de latitude {lat}°?",
      vary: { dec: [-70, 20, 1], lat: [-33, 0, 1] },
      answer: { label: "h", unit: "°", compute: (p) => 90 - Math.abs(num(p, "lat") - num(p, "dec")) },
      hint: "h_max = 90° − |φ − δ|.",
    },
  ],

  init: (p) => ({ t: 0, cur: [T_SUN, 1], sel: 0, u: 0, skyH: 0, Tc: num(p, "T", 5772), yaw: rad(num(p, "lon", -46.6) + 20), pitch: rad(20), drag: null }),
  step(s, p, t, dt) {
    const m = mode(p);
    if (m === 1) {
      const last = track(num(p, "M", 1)).length - 1;
      return { ...s, t: t + dt, u: Math.min(last, s.u + EVOL_RATE * dt) };
    }
    if (m === 3) return { ...s, t: t + dt, skyH: s.skyH + dt };
    return { ...s, t: t + dt };
  },
  dt: 0.02,
  sampleEvery: 5,

  viewport: (p) => (mode(p) === 4 ? { xMin: -5.2, xMax: 10.8, yMin: -5, yMax: 5, unit: "" } : { xMin: 0, xMax: 16, yMin: 0, yMax: 10, unit: "" }),

  pointer: {
    down(s, p, pt) {
      const m = mode(p);
      const base = { x0: pt.x, y0: pt.y };
      if (m === 0) {
        let best = -1, bd = 0.25;
        STARS.forEach((st, i) => {
          const dd = Math.hypot(pt.x - hrX(st.T), pt.y - hrY(st.L));
          if (dd < bd) { bd = dd; best = i; }
        });
        if (best >= 0) return { ...s, sel: best, cur: [STARS[best]!.T, STARS[best]!.L], drag: { kind: "cur", ...base, a: 0, b: 0 } };
        if (pt.x >= PX0 && pt.x <= PX0 + PW && pt.y >= PY0 && pt.y <= PY0 + PH) return { ...s, sel: -1, cur: [hrT(pt.x), hrL(pt.y)], drag: { kind: "cur", ...base, a: 0, b: 0 } };
      } else if (m === 2) {
        if (Math.abs(pt.y - BY) < 0.6 && pt.x > BX0 - 0.3 && pt.x < BX0 + BW + 0.3) return { ...s, Tc: barT(pt.x), drag: { kind: "temp", ...base, a: 0, b: 0 } };
      } else if (m === 3) {
        if (Math.hypot(pt.x - SKX, pt.y - SKY_Y) < SKR) return { ...s, drag: { kind: "sky", ...base, a: s.skyH, b: 0 } };
      } else if (m === 4) {
        return { ...s, drag: { kind: "cam", ...base, a: s.yaw, b: s.pitch } };
      }
      return undefined;
    },
    move(s, _p, pt, dragging) {
      const g = s.drag;
      if (!dragging || !g) return undefined;
      switch (g.kind) {
        case "cur": return { ...s, sel: -1, cur: [hrT(clamp(pt.x, PX0, PX0 + PW)), hrL(clamp(pt.y, PY0, PY0 + PH))] };
        case "temp": return { ...s, Tc: barT(pt.x) };
        case "sky": {
          // arrastar ao longo do círculo gira o céu: ângulo varrido → horas (15° por hora)
          const a0 = Math.atan2(g.y0 - SKY_Y, g.x0 - SKX), a1 = Math.atan2(pt.y - SKY_Y, pt.x - SKX);
          let da = a1 - a0;
          if (da > Math.PI) da -= 2 * Math.PI;
          if (da < -Math.PI) da += 2 * Math.PI;
          return { ...s, skyH: g.a + (da * 12) / Math.PI };
        }
        case "cam": return { ...s, yaw: g.a - (pt.x - g.x0) * 0.25, pitch: clamp(g.b - (pt.y - g.y0) * 0.25, rad(-85), rad(85)) };
      }
      return undefined;
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p) => (mode(p) === 4 ? "move" : mode(p) === 1 ? undefined : "grab"),
  },

  actions: [
    { id: "sol", label: "Cursor no Sol", run: (s) => ({ ...s, cur: [T_SUN, 1], sel: 0 }) },
    { id: "agora", label: "Céu: voltar à hora inicial", run: (s) => ({ ...s, skyH: 0 }) },
    { id: "frente", label: "Globo: ponto A de frente", run: (s, p) => ({ ...s, yaw: rad(num(p, "lon", -46.6)), pitch: rad(num(p, "lat", -23.5)) }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    const T = (str: string, x: number, y: number, o: Parameters<typeof d.text>[3] = {}) => d.text(str, x, y, { size: 12, ...o });
    const panel = (x: number, y0: number, lines: [string, string?, string?][]) => {
      let y = y0;
      for (const [str, c, w] of lines) {
        T(str, x, y, { align: "left", size: 11, color: c ?? theme.text, weight: w ?? "400" });
        y -= 0.42;
      }
      return y;
    };
    /** Disco da estrela comparado ao Sol, com raio R (R☉). */
    const sizeCompare = (cx: number, cy: number, R: number, Tst: number) => {
      const big = Math.max(R, 1);
      const k = 0.9 / big;
      const sx = cx + R * k + k + 0.3;
      d.circle(cx, cy, Math.max(R * k, 2 * d.px), { fill: starColor(Tst), stroke: theme.muted, width: 0.8 });
      d.circle(sx, cy, Math.max(k, 2 * d.px), { fill: starColor(T_SUN), stroke: theme.muted, width: 0.8 });
      T("Sol", sx, cy - Math.max(k, 0.1) - 0.25, { size: 9, color: theme.muted });
      T("tamanhos em escala", cx, cy - 1.3, { size: 9, color: theme.muted });
    };

    if (m === 0 || m === 1) {
      // eixos e grade
      d.rect(PX0, PY0, PW, PH, { stroke: theme.grid, width: 1 });
      for (let e = -4; e <= 6; e += 2) {
        d.line(PX0, hrY(10 ** e), PX0 + PW, hrY(10 ** e), { color: theme.grid, width: 1 });
        T(`10${e === 0 ? "⁰" : (e < 0 ? "⁻" : "") + "⁰¹²³⁴⁵⁶"[Math.abs(e)]}`, PX0 - 0.1, hrY(10 ** e), { size: 9, color: theme.muted, align: "right" });
      }
      for (const Tk of [40000, 20000, 10000, 5000, 3000]) {
        d.line(hrX(Tk), PY0, hrX(Tk), PY0 + PH, { color: theme.grid, width: 1 });
        T(fmt(Tk), hrX(Tk), PY0 - 0.25, { size: 9, color: theme.muted });
      }
      T("temperatura (K) ←", PX0 + PW, PY0 - 0.55, { size: 10, color: theme.muted, align: "right" });
      T("L/L☉", PX0 - 0.1, PY0 + PH + 0.25, { size: 10, color: theme.muted, align: "right" });
      // faixa de cores das classes espectrais
      for (const [l, Tk] of [["O", 38000], ["B", 18000], ["A", 8700], ["F", 6700], ["G", 5600], ["K", 4400], ["M", 3100]] as [string, number][])
        T(l, hrX(Tk), PY0 + PH + 0.22, { size: 10, weight: "600", color: starColor(Tk) === "rgb(255, 255, 255)" ? theme.text : theme.muted });
      // linhas de raio constante
      for (const [R, rl] of [[0.001, "0,001"], [0.01, "0,01"], [0.1, "0,1"], [1, "1"], [10, "10"], [100, "100"], [1000, "1000"]] as [number, string][]) {
        const pts: [number, number][] = [];
        for (let i = 0; i <= 60; i++) {
          const Tk = 10 ** (LT1 + ((LT0 - LT1) * i) / 60);
          const L = R * R * (Tk / T_SUN) ** 4;
          if (L > 10 ** LL0 && L < 10 ** LL1) pts.push([hrX(Tk), hrY(L)]);
        }
        d.polyline(pts, { color: theme.muted, dash: [3, 4], width: 1, alpha: 0.6 });
        const lab = pts[pts.length > 6 ? 4 : 0];
        if (lab) T(`${rl} R☉`, lab[0], lab[1], { size: 9, color: theme.muted, dy: -7 });
      }
      // sequência principal (idade zero)
      const ms: [number, number][] = [];
      for (let lm = -0.9; lm <= 1.8; lm += 0.02) {
        const M = 10 ** lm;
        if (zamsT(M) < 45000) ms.push([hrX(zamsT(M)), hrY(zamsL(M))]);
      }
      d.polyline(ms, { color: theme.accent, width: 8, alpha: 0.15 });
      T("sequência principal", hrX(15000), hrY(400), { size: 11, color: theme.accent, weight: "600" });
      T("gigantes", hrX(4600), hrY(150), { size: 11, color: theme.muted, weight: "600" });
      T("supergiantes", hrX(6000), hrY(3e5), { size: 11, color: theme.muted, weight: "600" });
      T("anãs brancas", hrX(14000), hrY(2e-4), { size: 11, color: theme.muted, weight: "600" });

      if (m === 0) {
        STARS.forEach((st, i) => {
          d.dot(hrX(st.T), hrY(st.L), i === s.sel ? 6 : 4, starColor(st.T));
          d.circle(hrX(st.T), hrY(st.L), 4 * d.px, { stroke: theme.muted, width: 0.6 });
          if (LABELED.has(st.name) || i === s.sel) T(st.name, hrX(st.T), hrY(st.L), { size: 9, dx: 6, align: "left", color: i === s.sel ? theme.text : theme.muted });
        });
        const [Tc, Lc] = s.cur;
        d.line(hrX(Tc), PY0, hrX(Tc), hrY(Lc), { color: theme.series[1], dash: [2, 3], width: 1 });
        d.line(PX0, hrY(Lc), hrX(Tc), hrY(Lc), { color: theme.series[1], dash: [2, 3], width: 1 });
        d.circle(hrX(Tc), hrY(Lc), 9 * d.px, { stroke: theme.series[1], width: 2 });
        const R = radiusOf(Lc, Tc);
        const y = panel(11.0, 9.4, [
          [s.sel >= 0 ? STARS[s.sel]!.name : "estrela-cursor (arraste)", theme.series[1], "600"],
          [`T = ${fmt(Tc, 4)} K   classe ${spectralClass(Tc)}`],
          [`L = ${fmt(Lc)} L☉`],
          [`R = ${fmt(R)} R☉ = ${fmt(R * 696000)} km`],
          [`região: ${hrRegion(Tc, Lc)}`],
          [`pico em ${fmt((WIEN_B / Tc) * 1e9)} nm`],
        ]);
        sizeCompare(12.6, y - 1.9, R, Tc);
        T("clique numa estrela real ou arraste o cursor", 13.3, 0.6, { size: 10, color: theme.muted });
        return;
      }

      // evolução
      const M = num(p, "M", 1);
      const tr = track(M);
      const a = trackAt(M, s.u);
      ctx.save();
      ctx.beginPath();
      ctx.rect(PX0, PY0, PW, PH);
      ctx.clip();
      d.polyline(tr.map((n) => [hrX(n.T), hrY(n.L)] as [number, number]), { color: theme.series[1], dash: [4, 3], width: 1.2, alpha: 0.6 });
      const done: [number, number][] = [];
      for (let k = 0; k <= s.u + 1e-9; k += 0.02) { const q = trackAt(M, k); done.push([hrX(q.T), hrY(q.L)]); }
      done.push([hrX(a.T), hrY(a.L)]);
      d.polyline(done, { color: theme.series[1], width: 2.2 });
      d.dot(hrX(a.T), hrY(a.L), 7, starColor(a.T));
      d.circle(hrX(a.T), hrY(a.L), 8 * d.px, { stroke: theme.text, width: 1 });
      ctx.restore();
      if (a.T > 45000) T(`T = ${fmt(a.T)} K: fora do diagrama, à esquerda`, PX0 + 0.2, hrY(Math.min(a.L, 1e6)), { size: 10, color: theme.series[1], align: "left" });
      const y = panel(11.0, 9.4, [
        [`Estrela de ${fmt(M)} M☉`, theme.series[1], "600"],
        [a.phase],
        [`idade: ${fmtAge(a.age)}`],
        [`T = ${fmt(a.T, 4)} K   L = ${fmt(a.L)} L☉`],
        [`R = ${fmt(a.R)} R☉`],
        [`fim: ${remnant(M)}`, theme.muted],
      ]);
      // fração do tempo de vida na sequência principal
      const total = tr[tr.length - 1]!.age;
      const tms = msLifetime(M);
      const life = M >= 8 ? total : tr[tr.length - 3]!.age;
      d.rect(11.0, y - 0.15, 4.6, 0.3, { stroke: theme.muted, width: 1 });
      d.rect(11.0, y - 0.15, (4.6 * tms) / life, 0.3, { fill: theme.accent, alpha: 0.6 });
      d.rect(11.0, y - 0.15, 4.6 * Math.min(1, a.age / life), 0.3, { fill: theme.series[1], alpha: 0.5 });
      T(`sequência principal: ${fmt((100 * tms) / life, 2)}% da vida ativa`, 11.0, y - 0.45, { size: 9, color: theme.muted, align: "left" });
      sizeCompare(12.6, y - 2.6, a.R, a.T);
      return;
    }

    if (m === 2) {
      const Tk = s.Tc;
      // régua de temperatura
      for (let i = 0; i < 96; i++) {
        const x = BX0 + (BW * i) / 96;
        d.rect(x, BY - 0.2, BW / 96 + 0.01, 0.4, { fill: starColor(barT(x + BW / 192)) });
      }
      d.rect(BX0, BY - 0.2, BW, 0.4, { stroke: theme.muted, width: 1 });
      for (const t of [2000, 3000, 5000, 10000, 20000, 40000]) T(fmt(t), barX(t), BY - 0.45, { size: 9, color: theme.muted });
      for (const st of ["Betelgeuse", "Sol", "Sírius A", "Rigel", "Acrux"]) {
        const S = STARS.find((x) => x.name === st)!;
        d.line(barX(S.T), BY + 0.2, barX(S.T), BY + 0.4, { color: theme.text, width: 1 });
        T(S.name, barX(S.T), BY + 0.6, { size: 9 });
      }
      d.polyline([[barX(Tk), BY - 0.25], [barX(Tk) - 0.15, BY - 0.6], [barX(Tk) + 0.15, BY - 0.6]], { close: true, fill: theme.series[1], color: theme.series[1] });
      // espectro
      const gx = 0.8, gy = 1.0, gw = 9.6, gh = 6.2, lmax = 2500;
      const X = (nm: number) => gx + (gw * nm) / lmax;
      for (let nm = 380; nm < 750; nm += 5) d.rect(X(nm), gy, (gw * 5) / lmax + 0.005, gh, { fill: wl(nm), alpha: 0.18 });
      let peak = 0;
      for (let nm = 50; nm <= lmax; nm += 10) peak = Math.max(peak, planck(nm * 1e-9, Tk));
      const pk = planck(WIEN_B / Tk, Tk);
      const ref = Math.max(peak, WIEN_B / Tk < lmax * 1e-9 ? pk : peak);
      d.plot((x) => gy + (gh * 0.95 * planck(((x - gx) / gw) * lmax * 1e-9, Tk)) / ref, gx + 0.01, gx + gw, { color: theme.series[1], width: 2, n: 400 });
      d.line(gx, gy, gx + gw, gy, { color: theme.muted, width: 1 });
      d.line(gx, gy, gx, gy + gh, { color: theme.muted, width: 1 });
      for (let nm = 0; nm <= lmax; nm += 500) T(String(nm), X(nm), gy - 0.25, { size: 9, color: theme.muted });
      T("λ (nm)", gx + gw, gy - 0.55, { size: 10, color: theme.muted, align: "right" });
      T("visível", X(565), gy + gh + 0.2, { size: 10, color: theme.muted });
      const lp = (WIEN_B / Tk) * 1e9;
      if (lp < lmax) {
        d.line(X(lp), gy, X(lp), gy + gh * 0.95, { color: theme.series[1], dash: [3, 3], width: 1 });
        T(`λmax = ${fmt(lp, 4)} nm`, X(lp), gy + gh * 0.95 + 0.2, { size: 10, color: theme.series[1], align: lp > 1800 ? "right" : "left" });
      }
      d.circle(13.2, 6.6, 1.3, { fill: starColor(Tk), stroke: theme.muted, width: 1 });
      panel(11.0, 4.6, [
        [`T = ${fmt(Tk, 4)} K`, theme.series[1], "600"],
        [`classe espectral ${spectralClass(Tk)}`],
        [`B − V = ${fmt(bvFromT(Tk), 2)}`],
        [`λmax = ${fmt(lp, 4)} nm`],
        [`σT⁴ = ${fmt(5.670374419e-8 * Tk ** 4)} W/m²`],
        ["arraste o marcador na régua", theme.muted],
      ]);
      return;
    }

    if (m === 3) {
      const lat = num(p, "lat", -23.5);
      const L = skyLST(s, p);
      const { hour, day } = skyTime(s, p);
      const A0 = num(p, "orient") > 0.5 ? 0 : Math.PI;
      const proj = (alt: number, az: number): [number, number] => {
        const rr = (SKR * (90 - alt)) / 90;
        const a = rad(az) - A0;
        return [SKX - rr * Math.sin(a), SKY_Y + rr * Math.cos(a)];
      };
      const sun = altAz(sunRA(day + hour / 24) / 15, sunDec(day + hour / 24), lat, L);
      const dayK = clamp((sun.alt + 12) / 18, 0, 1);
      const bg = `rgb(${Math.round(10 + 90 * dayK)}, ${Math.round(18 + 130 * dayK)}, ${Math.round(40 + 170 * dayK)})`;
      d.circle(SKX, SKY_Y, SKR, { fill: bg, stroke: theme.text, width: 1.5 });
      // equador celeste e polos
      const eq: [number, number][] = [];
      for (let ra = 0; ra <= 24.01; ra += 0.1) {
        const q = altAz(ra, 0, lat, L);
        if (q.alt > 0) eq.push(proj(q.alt, q.az));
        else if (eq.length) { d.polyline(eq.splice(0), { color: "#8fb3ff", width: 1, dash: [4, 4], alpha: 0.6 }); }
      }
      d.polyline(eq, { color: "#8fb3ff", width: 1, dash: [4, 4], alpha: 0.6 });
      for (const [dec, lbl] of [[-90, "polo sul celeste"], [90, "polo norte celeste"]] as [number, string][]) {
        const q = altAz(0, dec, lat, L);
        if (q.alt > 0) {
          const [x, y] = proj(q.alt, q.az);
          d.line(x - 0.12, y, x + 0.12, y, { color: "#ffcf6e", width: 1.5 });
          d.line(x, y - 0.12, x, y + 0.12, { color: "#ffcf6e", width: 1.5 });
          T(lbl, x, y - 0.3, { size: 9, color: "#ffcf6e" });
        }
      }
      // linhas das constelações
      const pos = new Map<string, { alt: number; xy: [number, number] }>();
      for (const st of SKY) {
        const q = altAz(st.ra, st.dec, lat, L);
        pos.set(st.name, { alt: q.alt, xy: proj(q.alt, q.az) });
      }
      for (const [a, b] of LINES) {
        const pa = pos.get(a), pb = pos.get(b);
        if (pa && pb && pa.alt > 0 && pb.alt > 0) d.line(pa.xy[0], pa.xy[1], pb.xy[0], pb.xy[1], { color: "#9fb4d8", width: 1, alpha: 0.55 });
      }
      for (const st of SKY) {
        const q = pos.get(st.name)!;
        if (q.alt <= 0) continue;
        d.dot(q.xy[0], q.xy[1], clamp(4.2 - 0.9 * st.mag, 1.2, 6), starColor(st.T), 1 - 0.7 * dayK);
      }
      for (const [nm, ref] of CONSTELLATIONS) {
        const q = pos.get(ref);
        if (q && q.alt > 3) T(nm, q.xy[0], q.xy[1], { size: 10, dy: 14, color: "#d6e2ff" });
      }
      if (sun.alt > 0) {
        const [x, y] = proj(sun.alt, sun.az);
        d.dot(x, y, 9, "#ffd34d");
      }
      // pontos cardeais
      for (const [az, l] of [[0, "N"], [90, "L"], [180, "S"], [270, "O"]] as [number, string][]) {
        const [x, y] = proj(-6, az);
        T(l, x, y, { size: 13, weight: "700" });
      }
      const hh = Math.floor(hour), mm = Math.floor((hour - hh) * 60);
      const acr = starAltAz("Acrux", s, p), ant = starAltAz("Antares", s, p);
      const circ = -90 + Math.abs(lat);
      panel(10.4, 9.4, [
        [`${dateOf(day)}, ${String(hh).padStart(2, "0")}h${String(mm).padStart(2, "0")} (hora solar)`, theme.text, "600"],
        [`latitude ${dms(lat, "N", "S")}`],
        [`tempo sideral local: ${fmt(L / 15, 3)} h`],
        [sun.alt > -6 ? (sun.alt > 0 ? "dia: o Sol ofusca as estrelas" : "crepúsculo") : "noite", sun.alt > -6 ? theme.positive : theme.muted],
        [""],
        [`polo sul celeste a ${fmt(-lat, 3)}° de altura`],
        [lat < 0 ? `circumpolares: δ < ${fmt(circ, 3)}°` : "polo sul celeste abaixo do horizonte"],
        [`Acrux: altura ${fmt(acr.alt, 3)}°`, acr.alt > 0 ? theme.text : theme.muted],
        [`Antares: altura ${fmt(ant.alt, 3)}°`, ant.alt > 0 ? theme.text : theme.muted],
        [""],
        ["arraste o céu em círculo para mudar a hora", theme.muted],
        ["o horizonte para onde você olha fica embaixo", theme.muted],
      ]);
      return;
    }

    // Globo
    const pr = projector({ yaw: s.yaw, pitch: s.pitch, dist: Infinity, zoom: 4.2 });
    const front = (q: V3) => q[0] * pr.basis.f[0] + q[1] * pr.basis.f[1] + q[2] * pr.basis.f[2] > 0;
    const curve = (pts: V3[], o: { color: string; width?: number; dash?: number[] }) => {
      let run: [number, number][] = [];
      const flush = () => { if (run.length > 1) d.polyline(run, o); run = []; };
      for (const q of pts) {
        if (front(q)) { const r = pr.project(q); run.push([r[0], r[1]]); } else flush();
      }
      flush();
    };
    renderFaces(d, pr, sphere([0, 0, 0], 0.995, theme.dark ? "#2f5d8a" : "#9cc3e6", 18), { ambient: 0.6 });
    for (let la = -75; la <= 75; la += 15) {
      const pts: V3[] = [];
      for (let lo = -180; lo <= 180; lo += 4) pts.push(ll3(la, lo));
      curve(pts, { color: la === 0 ? theme.positive : theme.text, width: la === 0 ? 2 : 0.7 });
    }
    for (let lo = -180; lo < 180; lo += 15) {
      const pts: V3[] = [];
      for (let la = -90; la <= 90; la += 4) pts.push(ll3(la, lo));
      curve(pts, { color: lo === 0 ? theme.series[2]! : theme.text, width: lo === 0 ? 2 : 0.7 });
    }
    const lat = num(p, "lat", -23.5), lon = num(p, "lon", -46.6), lat2 = num(p, "lat2", 51.5), lon2 = num(p, "lon2", 0);
    const par: V3[] = [], mer: V3[] = [];
    for (let lo = -180; lo <= 180; lo += 3) par.push(ll3(lat, lo, 1.003));
    for (let la = -90; la <= 90; la += 3) mer.push(ll3(la, lon, 1.003));
    curve(par, { color: theme.series[1]!, width: 2.2 });
    curve(mer, { color: theme.series[4]!, width: 2.2 });
    // arco de grande círculo A–B
    const A = ll3(lat, lon), B = ll3(lat2, lon2);
    const om = Math.acos(clamp(A[0] * B[0] + A[1] * B[1] + A[2] * B[2], -1, 1));
    const arc: V3[] = [];
    for (let i = 0; i <= 60; i++) {
      const f = i / 60;
      const k1 = om > 1e-6 ? Math.sin((1 - f) * om) / Math.sin(om) : 1 - f, k2 = om > 1e-6 ? Math.sin(f * om) / Math.sin(om) : f;
      arc.push([1.01 * (k1 * A[0] + k2 * B[0]), 1.01 * (k1 * A[1] + k2 * B[1]), 1.01 * (k1 * A[2] + k2 * B[2])]);
    }
    curve(arc, { color: theme.series[5]!, width: 2.5, dash: [6, 3] });
    // eixo e polos
    const n1 = pr.project([0, 0, 1.15]), s1 = pr.project([0, 0, -1.15]), n0 = pr.project([0, 0, 1]), s0 = pr.project([0, 0, -1]);
    d.line(n0[0], n0[1], n1[0], n1[1], { color: theme.text, width: 1.5 });
    d.line(s0[0], s0[1], s1[0], s1[1], { color: theme.text, width: 1.5 });
    T("N", n1[0], n1[1], { dy: -10, weight: "700" });
    T("S", s1[0], s1[1], { dy: 10, weight: "700" });
    const mark = (q: V3, lbl: string, c: string) => {
      const r = pr.project(q);
      d.dot(r[0], r[1], front(q) ? 6 : 4, c, front(q) ? 1 : 0.4);
      T(lbl, r[0], r[1], { dx: 10, dy: -8, weight: "700", color: c });
    };
    mark(A, "A", theme.series[1]!);
    mark(B, "B", theme.series[5]!);
    // horizonte local em A e direção do polo celeste
    if (front(A)) {
      const up = A;
      const east: V3 = [-Math.sin(rad(lon)), Math.cos(rad(lon)), 0];
      const north: V3 = [up[1] * east[2] - up[2] * east[1], up[2] * east[0] - up[0] * east[2], up[0] * east[1] - up[1] * east[0]];
      const ring: [number, number][] = [];
      for (let i = 0; i <= 36; i++) {
        const a = (i * 2 * Math.PI) / 36;
        const q: V3 = [up[0] + 0.2 * (Math.cos(a) * east[0] + Math.sin(a) * north[0]), up[1] + 0.2 * (Math.cos(a) * east[1] + Math.sin(a) * north[1]), up[2] + 0.2 * (Math.cos(a) * east[2] + Math.sin(a) * north[2])];
        const r = pr.project(q);
        ring.push([r[0], r[1]]);
      }
      d.polyline(ring, { color: theme.series[1], fill: theme.series[1], alpha: 0.3 });
      const pa = pr.project(A);
      const sgn = lat < 0 ? -1 : 1;
      const tip = pr.project([A[0], A[1], A[2] + sgn * 0.6]);
      d.arrow(pa[0], pa[1], tip[0] - pa[0], tip[1] - pa[1], { color: "#c9a227", width: 1.8 });
    }
    const dist = greatCircle(lat, lon, lat2, lon2);
    panel(5.6, 4.5, [
      ["Ponto A", theme.series[1], "600"],
      [`${dms(lat, "N", "S")}, ${dms(lon, "L", "O")}`],
      [`paralelo de A: ${fmt(2 * Math.PI * R_EARTH_KM * Math.cos(rad(lat)), 4)} km`],
      [`1° de longitude: ${fmt(111.19 * Math.cos(rad(lat)), 4)} km`],
      [`polo celeste a ${fmt(Math.abs(lat), 3)}° do horizonte (seta)`],
      ["Ponto B", theme.series[5], "600"],
      [`${dms(lat2, "N", "S")}, ${dms(lon2, "L", "O")}`],
      [`distância A–B: ${fmt(dist, 4)} km`, theme.series[5]],
      [`diferença de hora solar: ${fmt((lon2 - lon) / 15, 3)} h`],
      [""],
      ["— equador   — Greenwich", theme.muted],
      ["— paralelo de A   — meridiano de A", theme.muted],
      ["arraste para girar o globo", theme.muted],
    ]);
  },
});

/** Cor aproximada de um comprimento de onda visível (nm). */
function wl(nm: number): string {
  let r = 0, g = 0, b = 0;
  if (nm < 440) { r = (440 - nm) / 60; b = 1; }
  else if (nm < 490) { g = (nm - 440) / 50; b = 1; }
  else if (nm < 510) { g = 1; b = (510 - nm) / 20; }
  else if (nm < 580) { r = (nm - 510) / 70; g = 1; }
  else if (nm < 645) { r = 1; g = (645 - nm) / 65; }
  else r = 1;
  const c = (v: number) => Math.round(255 * Math.max(0, Math.min(1, v)));
  return `rgb(${c(r)}, ${c(g)}, ${c(b)})`;
}

export default estrelasHr;
