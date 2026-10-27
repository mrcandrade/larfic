import { clamp, defineSim, deg, draw, num, rad, texNum, type Params } from "@fisilab/core";

/**
 * Movimento relativo entre o solo (S) e um referencial S' que se move com
 * velocidade V (e, opcionalmente, aceleração A ao longo de x: referencial não
 * inercial). Três cenas:
 *  - barco: a velocidade própria do barco é em relação à água (S');
 *  - avião: a velocidade própria do avião é em relação ao ar (S');
 *  - chuva: a velocidade da gota é em relação ao solo (S); S' é o carro;
 *  - trem: movimento 1D; a velocidade do passageiro é em relação ao trem (S').
 */
export interface Rel {
  /** Velocidade própria do objeto: em relação a S' (barco, avião) ou ao solo (chuva). */
  ox: number;
  oy: number;
  /** Velocidade atual de S' em relação ao solo. */
  Vx: number;
  Vy: number;
  /** Posição do objeto no solo e da origem de S' no solo. */
  x: number;
  y: number;
  Rx: number;
  Ry: number;
  /** Referencial em destaque (observáveis e gráfico): 0 = solo, 1 = S'. */
  ref: number;
  /** Alça arrastada no diagrama de vetores. */
  drag: "" | "u" | "V";
}

export const cena = (p: Params) => Math.round(num(p, "cena"));
/** Altura de onde as gotas caem (m). */
export const H_RAIN = 25;
/** Altura (m) do ponto marcado no passageiro do trem (o peito). */
export const PASS_Y = 2.5;
/** Tempo máximo da cena do trem quando o passageiro está parado no vagão (s). */
export const T_TREM = 30;
/** Velocidade do passageiro em relação ao solo, no trem: u = u' + V (1D). */
export const velTrem = (vp: number, Vt: number) => vp + Vt;

/** Velocidade do objeto em relação ao solo. */
export const velS = (s: Rel, p: Params): [number, number] => (cena(p) === 2 ? [s.ox, s.oy] : [s.ox + s.Vx, s.oy + s.Vy]);
/** Velocidade do objeto em relação a S'. */
export const velP = (s: Rel, p: Params): [number, number] => (cena(p) === 2 ? [s.ox - s.Vx, s.oy - s.Vy] : [s.ox, s.oy]);

/** Rumo (a partir da travessia perpendicular, positivo rio acima) para cruzar o rio em linha reta. */
export function rumoReto(vb: number, u: number): number {
  return Math.abs(u) < vb ? deg(Math.asin(u / vb)) : NaN;
}
/** Tempo para cruzar o rio de largura L com rumo θ (graus). */
export const tempoTravessia = (L: number, vb: number, thetaDeg: number) => L / (vb * Math.cos(rad(thetaDeg)));
/** Ângulo (graus, a partir da vertical) da chuva vista de quem anda a Vc, com a chuva caindo a vr e vento wx. */
export const anguloChuva = (vr: number, wx: number, Vc: number) => deg(Math.atan2(Math.abs(wx - Vc), vr));

/** Vento como vetor a partir de velocidade e direção para onde sopra (graus a partir de +x). */
const windVec = (p: Params): [number, number] => {
  const w = num(p, "w", 30);
  const f = rad(num(p, "phiw", 90));
  return [w * Math.cos(f), w * Math.sin(f)];
};

function initial(p: Params): Rel {
  const c = cena(p);
  const base = { x: 0, y: 0, Rx: 0, Ry: 0, ref: 0, drag: "" as const };
  if (c === 1) {
    const va = num(p, "va", 80);
    const psi = rad(num(p, "psi", 0));
    const [Vx, Vy] = windVec(p);
    return { ...base, ox: va * Math.cos(psi), oy: va * Math.sin(psi), Vx, Vy };
  }
  if (c === 2) {
    return { ...base, ox: num(p, "wx", 0), oy: -num(p, "vr", 8), Vx: num(p, "Vc", 15), Vy: 0, y: H_RAIN };
  }
  if (c === 3) {
    const vp = num(p, "vp", 1.5);
    // o passageiro parte da ponta de trás do vagão (ou da da frente, se anda para trás)
    return { ...base, ox: vp, oy: 0, Vx: num(p, "Vt", 10), Vy: 0, x: vp < 0 ? num(p, "Lt", 16) : 0, y: PASS_Y };
  }
  const vb = num(p, "vb", 3);
  const th = rad(num(p, "theta", 0));
  return { ...base, ox: -vb * Math.sin(th), oy: vb * Math.cos(th), Vx: num(p, "u", 1.5), Vy: 0 };
}

/** Escala de velocidades de cada cena (m/s), usada no diagrama e nas setas. */
const vref = (p: Params) => [6, 120, 25, 12][cena(p)] ?? 6;

// ---------- Layout do palco (unidades abstratas) ----------
interface Box {
  x0: number;
  x1: number;
  y0: number;
  y1: number;
}
const PANELS: [Box, Box] = [
  { x0: 1, x1: 49, y0: 22, y1: 61 },
  { x0: 51, x1: 99, y0: 22, y1: 61 },
];
const DIAG = { cx: 21, cy: 10.5 };
const DIAG_R = 9.5;

/** Janela do mundo (m) mostrada em cada painel. */
function worldBox(p: Params) {
  const c = cena(p);
  const aspect = (PANELS[0].y1 - PANELS[0].y0) / (PANELS[0].x1 - PANELS[0].x0);
  if (c === 1) {
    const D = num(p, "D", 10000);
    const hw = 0.65 * D;
    return { cx: 0.5 * D, cy: 0, hw, hh: hw * aspect };
  }
  if (c === 2) {
    const hw = 20;
    const hh = hw * aspect;
    return { cx: 0, cy: hh - 2, hw, hh };
  }
  if (c === 3) {
    const hw = 18;
    const hh = hw * aspect;
    return { cx: num(p, "Lt", 16) / 2, cy: hh - 3, hw, hh };
  }
  const L = num(p, "L", 100);
  const hh = 0.62 * L;
  return { cx: 0.3 * L, cy: 0.5 * L, hw: hh / aspect, hh };
}

function mapper(panel: Box, p: Params) {
  const wb = worldBox(p);
  const k = (panel.x1 - panel.x0) / (2 * wb.hw);
  const mx = (panel.x0 + panel.x1) / 2;
  const my = (panel.y0 + panel.y1) / 2;
  return {
    k,
    wb,
    X: (x: number) => mx + (x - wb.cx) * k,
    Y: (y: number) => my + (y - wb.cy) * k,
  };
}

const wrap = (x: number, x0: number, w: number) => x0 + ((((x - x0) % w) + w) % w);
const hash = (k: number) => {
  const s = Math.sin(k * 12.9898 + 78.233) * 43758.5453;
  return s - Math.floor(s);
};

/** Escala do diagrama de vetores: unidades do palco por m/s. */
const kDiag = (p: Params) => (DIAG_R * 0.55) / vref(p);

function dragDiagram(s: Rel, p: Params, pt: { x: number; y: number }, which: "u" | "V"): Rel {
  const c = cena(p);
  const k = kDiag(p);
  const vmax = vref(p) * 1.6;
  let vx = clamp((pt.x - DIAG.cx) / k, -vmax, vmax);
  let vy = clamp((pt.y - DIAG.cy) / k, -vmax, vmax);
  if (which === "V") {
    if (c !== 1) vy = 0; // correnteza e carro: só horizontais
    vx = Math.round(vx * 10) / 10;
    vy = Math.round(vy * 10) / 10;
    // barco/avião: mantém u' (o objeto anda com o meio); chuva: mantém u (a gota não liga para o carro)
    return { ...s, Vx: vx, Vy: vy };
  }
  // ponta de u: muda a velocidade própria, mantendo V
  vx = Math.round(vx * 10) / 10;
  vy = Math.round(vy * 10) / 10;
  if (c === 2) return { ...s, ox: vx, oy: Math.min(vy, -0.5) };
  if (c === 3) return { ...s, ox: vx - s.Vx, oy: 0 };
  return { ...s, ox: vx - s.Vx, oy: vy - s.Vy };
}

function nearDiagram(s: Rel, p: Params, pt: { x: number; y: number }): "" | "u" | "V" {
  const k = kDiag(p);
  const [ux, uy] = velS(s, p);
  const du = Math.hypot(pt.x - (DIAG.cx + ux * k), pt.y - (DIAG.cy + uy * k));
  const dv = Math.hypot(pt.x - (DIAG.cx + s.Vx * k), pt.y - (DIAG.cy + s.Vy * k));
  if (Math.min(du, dv) > 1.6) return "";
  return du <= dv ? "u" : "V";
}

/** Rumo que leva o objeto em linha reta de A a B (barco: atravessa; avião: segue +x). */
function headingStraight(s: Rel, p: Params): Rel {
  const c = cena(p);
  if (c === 2 || c === 3) return s;
  const speed = Math.hypot(s.ox, s.oy);
  if (c === 0) {
    if (Math.abs(s.Vx) >= speed) return s;
    return { ...s, ox: -s.Vx, oy: Math.sqrt(speed * speed - s.Vx * s.Vx) };
  }
  if (Math.abs(s.Vy) >= speed) return s;
  return { ...s, oy: -s.Vy, ox: Math.sqrt(speed * speed - s.Vy * s.Vy) };
}

function headingFastest(s: Rel, p: Params): Rel {
  const c = cena(p);
  const speed = Math.hypot(s.ox, s.oy);
  if (c === 0) return { ...s, ox: 0, oy: speed };
  return headingStraight(s, p);
}

const frameName = (p: Params) => ["água", "ar", "carro", "trem"][cena(p)] ?? "S'";

export const movimentoRelativo = defineSim<Rel>({
  id: "movimento-relativo",
  title: "Movimento relativo",
  course: "FG I",
  topic: "Cinemática",
  priority: "P2",
  summary:
    "Barco atravessando o rio, avião com vento e chuva vista de um carro: arraste os vetores de velocidade e veja a mesma trajetória no solo e no referencial móvel, lado a lado, inclusive com o referencial acelerando.",
  equations: [
    String.raw`\vec u = \vec u\,' + \vec V \qquad \vec r = \vec r\,' + \vec R(t)`,
    String.raw`\vec R(t) = \vec V_0\,t + \tfrac12 \vec A\,t^2 \qquad \vec a = \vec a\,' + \vec A \ \Rightarrow\ m\vec a\,' = \vec F - m\vec A`,
    String.raw`\text{rio: } \sin\theta^* = \frac{u_c}{v'} \qquad t_{\min} = \frac{L}{v'} \qquad t_{\text{reto}} = \frac{L}{\sqrt{v'^2 - u_c^2}}`,
    String.raw`\text{chuva: } \tan\alpha = \frac{|V_{\text{carro}} - w|}{v_{\text{chuva}}}`,
  ],
  liveEquations(s, p) {
    const [ux, uy] = velS(s, p);
    const [px, py] = velP(s, p);
    const out = [
      String.raw`\vec u = (${texNum(ux)},\ ${texNum(uy)})\ \text{m/s} \quad \vec u\,' = (${texNum(px)},\ ${texNum(py)})\ \text{m/s} \quad \vec V = (${texNum(s.Vx)},\ ${texNum(s.Vy)})\ \text{m/s}`,
    ];
    const c = cena(p);
    if (c === 0) {
      const vb = Math.hypot(s.ox, s.oy);
      const L = num(p, "L", 100);
      const th = rumoReto(vb, s.Vx);
      out.push(
        Number.isFinite(th)
          ? String.raw`\theta^* = \arcsin\frac{${texNum(s.Vx)}}{${texNum(vb)}} = ${texNum(th)}^\circ \qquad t_{\min} = \frac{${texNum(L)}}{${texNum(vb)}} = ${texNum(L / vb)}\ \text{s}`
          : String.raw`u_c \ge v' \Rightarrow \text{impossível atravessar reto} \qquad t_{\min} = ${texNum(L / vb)}\ \text{s}`,
      );
    } else if (c === 3) {
      out.push(String.raw`u_x = u'_x + V_x = ${texNum(s.ox)} + ${texNum(s.Vx)} = ${texNum(s.ox + s.Vx)}\ \text{m/s}`);
    } else if (c === 2) {
      out.push(String.raw`\alpha = \arctan\frac{|${texNum(px)}|}{|${texNum(py)}|} = ${texNum(deg(Math.atan2(Math.abs(px), Math.abs(py))))}^\circ`);
    } else {
      const va = Math.hypot(s.ox, s.oy);
      const gs = Math.sqrt(Math.max(0, va * va - s.Vy * s.Vy)) + s.Vx;
      out.push(String.raw`\text{rumo reto: } \sin\psi = -\frac{V_y}{v'} \Rightarrow \psi = ${texNum(deg(Math.asin(clamp(-s.Vy / va, -1, 1))))}^\circ \qquad v_{\text{solo}} = ${texNum(gs)}\ \text{m/s}`);
    }
    if (num(p, "A") !== 0)
      out.push(String.raw`\vec A = (${texNum(num(p, "A"))},\ 0)\ \text{m/s}^2:\ \text{em S' aparece } -m\vec A`);
    return out;
  },

  params: [
    {
      key: "cena",
      label: "Situação",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Barco atravessando o rio" },
        { value: 1, label: "Avião com vento" },
        { value: 2, label: "Chuva vista de um carro" },
        { value: 3, label: "Passageiro andando no trem (1D)" },
      ],
    },
    { key: "L", label: "Largura do rio", unit: "m", min: 20, max: 200, step: 5, default: 60 },
    { key: "vb", label: "Barco em relação à água", unit: "m/s", min: 0.5, max: 6, step: 0.1, default: 3 },
    { key: "u", label: "Correnteza", unit: "m/s", min: 0, max: 5, step: 0.1, default: 1.5 },
    { key: "theta", label: "Rumo do barco (rio acima)", unit: "°", min: -80, max: 80, step: 1, default: 0 },
    { key: "D", label: "Distância entre as cidades", unit: "m", min: 2000, max: 20000, step: 500, default: 6000 },
    { key: "va", label: "Avião em relação ao ar", unit: "m/s", min: 30, max: 120, step: 1, default: 80 },
    { key: "w", label: "Vento", unit: "m/s", min: 0, max: 60, step: 1, default: 30 },
    { key: "phiw", label: "Vento sopra para (a partir de +x)", unit: "°", min: -180, max: 180, step: 5, default: 90 },
    { key: "psi", label: "Rumo do avião (a partir de +x)", unit: "°", min: -90, max: 90, step: 1, default: 0 },
    { key: "vr", label: "Queda da chuva", unit: "m/s", min: 2, max: 15, step: 0.5, default: 8 },
    { key: "wx", label: "Vento na chuva (horizontal)", unit: "m/s", min: -10, max: 10, step: 0.5, default: 0 },
    { key: "Vc", label: "Velocidade do carro", unit: "m/s", min: 0, max: 30, step: 0.5, default: 15 },
    { key: "A", label: "Aceleração de S' (não inercial)", unit: "m/s²", min: -3, max: 3, step: 0.1, default: 0 },
    { key: "Vt", label: "Trem: velocidade em relação ao solo", unit: "m/s", min: -30, max: 30, step: 0.5, default: 10 },
    { key: "vp", label: "Trem: passageiro em relação ao trem", unit: "m/s", min: -3, max: 3, step: 0.1, default: 1.5 },
    { key: "Lt", label: "Trem: comprimento do vagão", unit: "m", min: 8, max: 30, step: 1, default: 16 },
  ],

  observables: [
    { key: "x", label: "x no referencial em destaque", unit: "m", value: (s) => (s.ref === 1 ? s.x - s.Rx : s.x) },
    { key: "y", label: "y no referencial em destaque", unit: "m", value: (s) => (s.ref === 1 ? s.y - s.Ry : s.y) },
    { key: "vx", label: "vₓ no referencial em destaque", unit: "m/s", value: (s, p) => (s.ref === 1 ? velP(s, p) : velS(s, p))[0] },
    { key: "vy", label: "v_y no referencial em destaque", unit: "m/s", value: (s, p) => (s.ref === 1 ? velP(s, p) : velS(s, p))[1] },
    { key: "uS", label: "Rapidez em relação ao solo |u|", unit: "m/s", value: (s, p) => Math.hypot(...velS(s, p)) },
    { key: "uP", label: "Rapidez em relação a S' |u'|", unit: "m/s", value: (s, p) => Math.hypot(...velP(s, p)) },
    {
      key: "incl",
      label: "Inclinação da trajetória com a vertical (em destaque)",
      unit: "°",
      value: (s, p) => {
        const [vx, vy] = s.ref === 1 ? velP(s, p) : velS(s, p);
        return deg(Math.atan2(Math.abs(vx), Math.abs(vy)));
      },
    },
    { key: "V", label: "Velocidade de S' |V|", unit: "m/s", value: (s) => Math.hypot(s.Vx, s.Vy) },
  ],
  chart: { x: "x", y: "y" },

  scenarios: [
    {
      id: "barco",
      label: "Barco: rumo e tempo",
      params: { cena: 0, L: 60, vb: 3, u: 1.5, theta: 0, A: 0 },
      guide: `### Atravessando o rio
1. O barco aponta **perpendicular** às margens ($\\theta = 0$). Rode e compare os dois painéis: no da água ele vai reto; no do solo, desce rio abaixo.
2. Anote o tempo de travessia e confira $t = L/v'$. Agora arraste a ponta de $\\vec V$ (correnteza) no diagrama e rode de novo: o tempo muda?
3. Clique em **Rumo para ir reto de A a B**. O barco passa a apontar rio acima com $\\sin\\theta^* = u_c/v'$ e chega em B, mas demora mais: $t = L/\\sqrt{v'^2-u_c^2}$.
4. Com a correnteza maior que $v'$, existe rumo para chegar em B?`,
      predict: [
        {
          question: "Se a correnteza dobrar e o barco continuar apontando perpendicular às margens, o tempo de travessia:",
          options: ["dobra", "não muda", "cai pela metade"],
          answer: 1,
          explanation: "A correnteza é horizontal (ao longo do rio) e não tem componente na direção da travessia. O tempo é $L/v'_y = L/v'$; só a deriva rio abaixo aumenta.",
        },
      ],
    },
    {
      id: "aviao",
      label: "Avião com vento lateral",
      params: { cena: 1, D: 6000, va: 80, w: 30, phiw: 90, psi: 0, A: 0 },
      guide: `### Voando com vento
1. O avião aponta para B ($\\psi = 0$), mas o vento sopra para o norte. Rode: no referencial do **ar** ele voa reto, mas no do solo é empurrado.
2. Clique em **Rumo para ir reto de A a B**: o nariz aponta contra o vento com $\\sin\\psi = -V_y/v'$, e a velocidade em relação ao solo cai para $\\sqrt{v'^2 - V_y^2}$.
3. Arraste a ponta de $\\vec V$ para um vento de cauda e depois de proa. O tempo de ida e volta com vento é maior ou menor que sem vento?`,
      predict: [
        {
          question: "Para chegar em B com vento lateral, o avião deve apontar:",
          options: ["direto para B", "um pouco contra o vento", "um pouco a favor do vento"],
          answer: 1,
          explanation: "A componente do vento perpendicular à rota precisa ser cancelada pela componente da velocidade do avião em relação ao ar: o nariz aponta contra o vento (ângulo de correção de deriva).",
        },
      ],
    },
    {
      id: "chuva",
      label: "Chuva vista do carro",
      params: { cena: 2, vr: 8, wx: 0, Vc: 15, A: 0 },
      guide: `### Por que a chuva fica inclinada?
1. No solo, a chuva cai na vertical. No referencial do carro, cada gota tem velocidade $\\vec u\\,' = \\vec u - \\vec V$: ela vem de frente, inclinada.
2. Meça a inclinação (observável no referencial do carro, botão **Ver de S'**) e confira $\\tan\\alpha = V/v_{\\text{chuva}}$.
3. Arraste a ponta de $\\vec V$ até a chuva parecer vertical para o motorista. Isso só acontece com vento ($w \\neq 0$): por quê?`,
      predict: [
        {
          question: "A chuva cai a 8 m/s na vertical e o carro anda a 8 m/s. O motorista vê a chuva inclinada de:",
          options: ["0°", "30°", "45°", "60°"],
          answer: 2,
          explanation: "$\\vec u\\,' = (-8, -8)$ m/s no referencial do carro: $\\tan\\alpha = 8/8 = 1$, $\\alpha = 45^\\circ$.",
        },
      ],
    },
    {
      id: "nao-inercial",
      label: "Carro acelerando (não inercial)",
      params: { cena: 2, vr: 6, wx: 0, Vc: 0, A: 2.5 },
      guide: `### Referencial acelerado
1. O carro parte do repouso com $A = 2{,}5$ m/s². No solo as gotas descem retas e verticais.
2. No referencial do carro as trajetórias **se curvam** para trás: lá, cada gota parece sofrer uma força horizontal $-m\\vec A$ que nenhum corpo exerce (força fictícia).
3. Compare as acelerações: no solo $\\vec a = 0$ (velocidade terminal); no carro $\\vec a\\,' = \\vec a - \\vec A = -\\vec A$.
4. Troque de referencial com os botões e acompanhe o gráfico de $y$ contra $x$ nos dois casos.`,
    },
    {
      id: "trem",
      label: "Passageiro no trem (1D)",
      params: { cena: 3, Vt: 10, vp: -2, Lt: 16, A: 0 },
      guide: `### Uma dimensão, dois observadores
1. O trem anda a $V = 10$ m/s em relação ao solo; o passageiro caminha **para trás** a $u' = -2$ m/s em relação ao trem. Rode e compare os painéis.
2. No referencial do trem, o passageiro percorre o vagão devagar; no do solo, ele vai **para a frente** a $u = u' + V = 8$ m/s. Em 1D a soma é de números com sinal.
3. Use **Ver do solo** e **Ver de S'** e leia $v_x$ nos dois: a diferença é sempre $V$. As posições também diferem por $X_{S'} = Vt$: $x = x' + Vt$.
4. Ponha $V = 2$ m/s e $u' = -2$ m/s: o passageiro anda no vagão, mas para quem está na plataforma ele fica parado ($u = 0$). Com $u' = +2$ m/s, ele passa a $12$ m/s se $V = 10$ m/s.
5. Acelere o trem ($A \\neq 0$). As velocidades continuam somando, e as acelerações também: $a = a' + A$. Como $V$ muda, o referencial do trem deixa de ser inercial.`,
      predict: [
        {
          question: "O trem passa pela plataforma a 10 m/s e o passageiro anda para o fundo do vagão a 2 m/s em relação ao trem. Para quem está na plataforma, o passageiro anda:",
          options: ["a 12 m/s para a frente", "a 8 m/s para a frente", "a 2 m/s para trás", "a 8 m/s para trás"],
          answer: 1,
          explanation: "Com o eixo $x$ no sentido do trem, $u' = -2$ m/s e $V = +10$ m/s: $u = u' + V = +8$ m/s. O passageiro anda para trás no vagão, mas o vagão o carrega para a frente mais depressa.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "travessia",
      prompt:
        "Um barco anda a {vb} m/s em relação à água num rio de {L} m de largura com correnteza de {u} m/s. Quanto tempo leva para atravessar indo em linha reta até o ponto oposto?",
      vary: { vb: [3, 6, 1], u: [0.5, 2.5, 1], L: [40, 200, 0] },
      fixed: { cena: 0 },
      answer: { label: "t", unit: "s", compute: (p) => num(p, "L") / Math.sqrt(num(p, "vb") ** 2 - num(p, "u") ** 2) },
      hint: "A componente da velocidade do barco ao longo do rio cancela a correnteza; sobra √(v'² − u²) na travessia.",
    },
    {
      id: "chuva",
      prompt:
        "A chuva cai na vertical a {vr} m/s. Um carro anda a {Vc} m/s numa estrada reta. Que ângulo com a vertical o motorista vê as gotas fazerem?",
      vary: { vr: [4, 12, 1], Vc: [5, 30, 0] },
      fixed: { cena: 2, wx: 0 },
      answer: { label: "α", unit: "°", compute: (p) => anguloChuva(num(p, "vr"), 0, num(p, "Vc")) },
    },
  ],

  init: initial,
  step(s, p, _t, dt) {
    const A = num(p, "A");
    const c = cena(p);
    const n = { ...s };
    const dR = s.Vx * dt + 0.5 * A * dt * dt;
    n.Rx = s.Rx + dR;
    n.Ry = s.Ry + s.Vy * dt;
    n.Vx = s.Vx + A * dt;
    if (c === 2) {
      n.x = s.x + s.ox * dt;
      n.y = s.y + s.oy * dt;
      // a gota marcada chegou ao chão: solta outra acima do carro
      if (n.y <= 0) {
        n.y += H_RAIN;
        n.x = n.Rx;
      }
    } else {
      n.x = s.x + s.ox * dt + dR;
      n.y = s.y + s.oy * dt + s.Vy * dt;
    }
    return n;
  },
  dt: 0.02,
  sampleEvery: 5,
  maxSamples: 4000,
  tEnd: 1200,
  stopWhen(s, p, _t) {
    const c = cena(p);
    if (c === 0) return num(p, "L", 60) - s.y;
    if (c === 1) return num(p, "D", 6000) - s.x;
    if (c === 3) {
      // o passageiro chega à outra ponta do vagão (ou o tempo da cena acaba, se está parado nele)
      const xl = s.x - s.Rx;
      const Lt = num(p, "Lt", 16);
      if (s.ox > 0) return Lt - xl;
      if (s.ox < 0) return xl;
      return T_TREM - _t;
    }
    return 1;
  },

  pointer: {
    down(s, p, pt) {
      const h = nearDiagram(s, p, pt);
      return h ? { ...dragDiagram(s, p, pt, h), drag: h } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      return dragDiagram(s, p, pt, s.drag);
    },
    up: (s) => (s.drag ? { ...s, drag: "" } : undefined),
    cursor: (s, p, pt) => (nearDiagram(s, p, pt) ? "grab" : undefined),
  },
  actions: [
    { id: "solo", label: "Ver do solo (S)", run: (s) => ({ ...s, ref: 0 }), active: (s) => s.ref === 0 },
    { id: "movel", label: "Ver de S' (água, ar, carro ou trem)", run: (s) => ({ ...s, ref: 1 }), active: (s) => s.ref === 1 },
    { id: "reto", label: "Rumo para ir reto de A a B", run: headingStraight },
    { id: "rapido", label: "Rumo de tempo mínimo", run: headingFastest },
  ],

  viewport: () => ({ xMin: 0, xMax: 100, yMin: 0, yMax: 62, unit: "" }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme, t, trail } = frame;
    const c = cena(p);
    const [ux, uy] = velS(s, p);
    const [px, py] = velP(s, p);
    const ka = 7 / vref(p); // seta nos painéis: unidades do palco por m/s
    const A = num(p, "A");

    for (const f of [0, 1] as const) {
      const panel = PANELS[f];
      const m = mapper(panel, p);
      const { X, Y, wb } = m;
      const hi = s.ref === f;
      // deslocamento aplicado a tudo que é fixo no solo quando visto de S'
      const offX = f === 1 ? -s.Rx : 0;
      const offY = f === 1 ? -s.Ry : 0;

      ctx.save();
      ctx.beginPath();
      ctx.rect(panel.x0, panel.y0, panel.x1 - panel.x0, panel.y1 - panel.y0);
      ctx.clip();

      if (c === 0) {
        const L = num(p, "L", 60);
        d.rect(X(wb.cx - wb.hw), Y(wb.cy - wb.hh), panel.x1 - panel.x0, Y(0) - Y(wb.cy - wb.hh), { fill: theme.ground });
        d.rect(X(wb.cx - wb.hw), Y(L), panel.x1 - panel.x0, Y(wb.cy + wb.hh) - Y(L), { fill: theme.ground });
        d.rect(X(wb.cx - wb.hw), Y(0), panel.x1 - panel.x0, Y(L) - Y(0), { fill: theme.series[0]!, alpha: 0.13 });
        // marcas na água: andam com a correnteza no solo, paradas na água
        const W = 2 * wb.hw;
        for (let i = 0; i < 18; i++) {
          const wx0 = (i * W) / 18 + (f === 0 ? s.Rx : 0);
          const xx = wrap(wx0, wb.cx - wb.hw, W);
          const yy = L * (0.15 + 0.7 * hash(i));
          d.line(X(xx), Y(yy), X(xx) + 1.2, Y(yy), { color: theme.series[0]!, alpha: 0.5, width: 1.5 });
        }
        // A (largada) e B (ponto oposto): fixos no solo
        d.dot(X(offX), Y(offY), 4, theme.text);
        d.text("A", X(offX) - 1.2, Y(offY) - 1, { size: 11, weight: "600" });
        d.dot(X(offX), Y(L + offY), 4, theme.text);
        d.text("B", X(offX) - 1.2, Y(L + offY) + 1, { size: 11, weight: "600" });
      } else if (c === 1) {
        const D = num(p, "D", 6000);
        const W = 2 * wb.hw;
        // traços de vento: movem-se com o ar no solo, parados no ar
        for (let i = 0; i < 26; i++) {
          const xx = wrap(wb.cx - wb.hw + hash(i) * W + (f === 0 ? s.Rx : 0), wb.cx - wb.hw, W);
          const yy = wrap(wb.cy - wb.hh + hash(i + 50) * 2 * wb.hh + (f === 0 ? s.Ry : 0), wb.cy - wb.hh, 2 * wb.hh);
          const vlen = Math.hypot(s.Vx, s.Vy);
          if (vlen > 0.1) d.line(X(xx), Y(yy), X(xx) + (s.Vx / vlen) * 1.4, Y(yy) + (s.Vy / vlen) * 1.4, { color: theme.muted, alpha: 0.45, width: 1 });
        }
        d.line(X(offX), Y(offY), X(D + offX), Y(offY), { color: theme.muted, dash: [5, 4], width: 1 });
        for (const [nm, cxw] of [["A", 0], ["B", D]] as const) {
          d.circle(X(cxw + offX), Y(offY), 0.9, { fill: theme.ground, stroke: theme.text, width: 1 });
          d.text(nm, X(cxw + offX), Y(offY) - 2, { size: 11, weight: "600" });
        }
      } else if (c === 3) {
        const W = 2 * wb.hw;
        const Lt = num(p, "Lt", 16);
        d.rect(X(wb.cx - wb.hw), Y(wb.cy - wb.hh), panel.x1 - panel.x0, Y(-1) - Y(wb.cy - wb.hh), { fill: theme.ground });
        // dormentes e postes: fixos no solo
        for (let i = 0; i < 18; i++) {
          const xx = wrap(i * 2 + offX, wb.cx - wb.hw, W);
          d.rect(X(xx), Y(-1.3), 0.5 * m.k, 0.3 * m.k, { fill: theme.muted, alpha: 0.6 });
        }
        for (let i = 0; i < 3; i++) {
          const xx = wrap(i * 12 + offX, wb.cx - wb.hw, W);
          d.line(X(xx), Y(-1), X(xx), Y(7), { color: theme.muted, width: 2 });
        }
        // vagão: anda no solo (com volta), parado no referencial do trem
        const tx = f === 1 ? 0 : wrap(s.Rx, wb.cx - wb.hw, W);
        d.rect(X(tx), Y(-0.6), Lt * m.k, 5 * m.k, { fill: theme.series[1]!, alpha: 0.18 });
        d.rect(X(tx), Y(-0.6), Lt * m.k, 5 * m.k, { stroke: theme.series[1]!, width: 1.5 });
        d.line(X(tx), Y(0), X(tx + Lt), Y(0), { color: theme.series[1]!, width: 1.5 });
        for (let i = 1; i < Math.floor(Lt / 4); i++) d.rect(X(tx + i * 4 - 1), Y(3.2), 1.6 * m.k, 0.9 * m.k, { fill: theme.series[1]!, alpha: 0.35 });
        d.circle(X(tx + 2), Y(-0.6), 0.5 * m.k, { fill: theme.text });
        d.circle(X(tx + Lt - 2), Y(-0.6), 0.5 * m.k, { fill: theme.text });
        if (f === 0) {
          d.arrow(X(tx + Lt / 2), Y(5.6), s.Vx * ka, 0, { color: theme.series[1]! });
          if (Math.abs(s.Vx) > 0.3) d.text("V", X(tx + Lt / 2) + s.Vx * ka + (s.Vx > 0 ? 1 : -1), Y(5.6) + 0.8, { color: theme.series[1]!, size: 11, weight: "600" });
        } else if (Math.abs(s.Vx) > 0.3) {
          d.arrow(X(wb.cx), Y(8.5), -s.Vx * ka, 0, { color: theme.series[1]! });
          d.text("−V (solo)", X(wb.cx), Y(8.5) + 1.4, { color: theme.series[1]!, size: 10 });
        }
      } else {
        const W = 2 * wb.hw;
        d.rect(X(wb.cx - wb.hw), Y(wb.cy - wb.hh), panel.x1 - panel.x0, Y(0) - Y(wb.cy - wb.hh), { fill: theme.ground });
        // postes fixos no solo
        for (let i = 0; i < 4; i++) {
          const xx = wrap(i * 10 + offX, wb.cx - wb.hw, W);
          d.line(X(xx), Y(0), X(xx), Y(6), { color: theme.muted, width: 2 });
        }
        // gotas: soltas a cada 0,02 s em x pseudoaleatórios (no solo)
        const tau = 0.02;
        const tf = H_RAIN / Math.max(0.5, -s.oy);
        const kMin = Math.floor((t - tf) / tau);
        const kMax = Math.floor(t / tau);
        const delta = 0.08;
        for (let k = Math.max(kMin, kMax - 400); k <= kMax; k++) {
          const age = t - k * tau;
          const xg = wb.cx - wb.hw + hash(k) * W + s.ox * age;
          const yg = H_RAIN + s.oy * age;
          if (yg < 0) continue;
          // posição atrás no tempo (para o traço): no solo e em S'
          const xgB = xg - s.ox * delta;
          const ygB = yg - s.oy * delta;
          let hx = xg + offX;
          let tx = xgB + offX;
          if (f === 1) tx = xgB - (s.Rx - s.Vx * delta + 0.5 * A * delta * delta);
          if (f === 1) hx = xg - s.Rx;
          const sh = wrap(hx, wb.cx - wb.hw, W) - hx;
          d.line(X(tx + sh), Y(ygB), X(hx + sh), Y(yg), { color: theme.series[0]!, alpha: 0.55, width: 1.2 });
        }
      }

      // ---- objeto e trajetória ----
      const carShift = (c === 2 || c === 3) && f === 0 ? wrap(s.Rx, wb.cx - wb.hw, 2 * wb.hw) - s.Rx : 0;
      const pts: [number, number][] = [];
      let prevY = Infinity;
      for (let i = trail.length - 1; i >= 0; i--) {
        const st = trail[i]!;
        if (c === 2 && st.y > prevY + 1) break; // gota marcada foi reciclada
        prevY = st.y;
        const wx = f === 1 ? st.x - st.Rx : st.x + carShift;
        const wy = f === 1 ? st.y - st.Ry : st.y;
        pts.push([X(wx), Y(wy)]);
      }
      const ox = f === 1 ? s.x - s.Rx : s.x + carShift;
      const oy = f === 1 ? s.y - s.Ry : s.y;
      pts.unshift([X(ox), Y(oy)]);
      d.polyline(pts, { color: theme.series[3]!, width: 2 });

      const [vx, vy] = f === 1 ? [px, py] : [ux, uy];
      if (c === 2) {
        // carro: no solo anda (com volta), em S' parado
        const cxw = f === 1 ? 0 : wrap(s.Rx, wb.cx - wb.hw, 2 * wb.hw);
        d.rect(X(cxw - 2.2), Y(0.3), 4.4 * m.k, 1.3 * m.k, { fill: theme.series[1]! });
        d.rect(X(cxw - 1.2), Y(1.6), 2.4 * m.k, 1.0 * m.k, { fill: theme.series[1]!, alpha: 0.8 });
        d.circle(X(cxw - 1.3), Y(0.35), 0.35 * m.k, { fill: theme.text });
        d.circle(X(cxw + 1.3), Y(0.35), 0.35 * m.k, { fill: theme.text });
        if (f === 0) {
          d.arrow(X(cxw), Y(4), s.Vx * ka, 0, { color: theme.series[1]! });
          if (Math.abs(s.Vx) > 0.3) d.text("V", X(cxw) + s.Vx * ka + 1, Y(4) + 0.8, { color: theme.series[1]!, size: 11, weight: "600" });
        } else if (Math.abs(s.Vx) > 0.3) {
          d.arrow(X(wb.cx + wb.hw * 0.55), Y(-1), -s.Vx * ka, 0, { color: theme.series[1]! });
          d.text("−V (solo)", X(wb.cx + wb.hw * 0.55) + 2, Y(-1), { color: theme.series[1]!, size: 10, align: "left" });
        }
        d.dot(X(ox), Y(oy), 4, theme.series[3]!);
      } else if (c === 3) {
        // passageiro: pés no piso do vagão (y = 0), ponto marcado no peito
        const col = theme.series[4]!;
        d.circle(X(ox), Y(oy + 0.9), 0.35 * m.k, { fill: col });
        d.line(X(ox), Y(oy + 0.55), X(ox), Y(oy - 1), { color: col, width: 2.5 });
        d.line(X(ox), Y(oy - 1), X(ox - 0.4), Y(0), { color: col, width: 2 });
        d.line(X(ox), Y(oy - 1), X(ox + 0.4), Y(0), { color: col, width: 2 });
      } else {
        // barco/avião aponta para u' (rumo), mas anda com u no solo
        const hl = Math.hypot(s.ox, s.oy) || 1;
        const hx = s.ox / hl;
        const hy = s.oy / hl;
        const sz = c === 0 ? 1.6 : 1.8;
        const cx0 = X(ox);
        const cy0 = Y(oy);
        d.polyline(
          [
            [cx0 + hx * sz, cy0 + hy * sz],
            [cx0 - hx * sz * 0.6 - hy * sz * 0.55, cy0 - hy * sz * 0.6 + hx * sz * 0.55],
            [cx0 - hx * sz * 0.3, cy0 - hy * sz * 0.3],
            [cx0 - hx * sz * 0.6 + hy * sz * 0.55, cy0 - hy * sz * 0.6 - hx * sz * 0.55],
          ],
          { close: true, fill: c === 0 ? theme.series[5]! : theme.series[4]!, color: theme.text, width: 1 },
        );
        // meio (água/ar) visto do solo: seta V; solo visto do meio: seta −V
        const vlen = Math.hypot(s.Vx, s.Vy);
        if (vlen > 0.05) {
          const bx = panel.x0 + 4;
          const by = panel.y1 - 6;
          const sgn = f === 0 ? 1 : -1;
          d.arrow(bx, by, sgn * s.Vx * ka, sgn * s.Vy * ka, { color: theme.series[1]! });
          d.text(f === 0 ? `V (${frameName(p)})` : "−V (solo)", bx, by - 1.6, { color: theme.series[1]!, size: 10, align: "left" });
        }
      }
      const vlab = f === 0 ? "u" : "u'";
      d.arrow(X(ox), Y(oy), vx * ka, vy * ka, { color: f === 0 ? theme.accent : theme.series[2]!, width: 2.5 });
      if (Math.hypot(vx, vy) > 0.05)
        d.text(vlab, X(ox) + vx * ka * 1.1 + 0.8, Y(oy) + vy * ka * 1.1 + 0.8, { color: f === 0 ? theme.accent : theme.series[2]!, size: 12, weight: "700" });
      if (f === 1 && A !== 0) {
        d.arrow(X(ox), Y(oy), -Math.sign(A) * 5, 0, { color: theme.negative, dash: [4, 3] });
        d.text("−mA (fictícia)", X(ox) - Math.sign(A) * 5, Y(oy) + 1.4, { color: theme.negative, size: 10 });
      }
      ctx.restore();

      d.rect(panel.x0, panel.y0, panel.x1 - panel.x0, panel.y1 - panel.y0, { stroke: hi ? theme.accent : theme.grid, width: hi ? 2.5 : 1 });
      const title = f === 0 ? "Referencial do solo (S)" : ["Referencial da água (S')", "Referencial do ar (S')", "Referencial do carro (S')", "Referencial do trem (S')"][c]!;
      d.text(title + (f === 1 && A !== 0 ? " — não inercial" : ""), panel.x0 + 1, panel.y1 - 1.6, {
        align: "left",
        size: 12,
        weight: hi ? "700" : "500",
        color: hi ? theme.accent : theme.text,
      });
    }

    // ---- diagrama de vetores: u = u' + V ----
    const k = kDiag(p);
    d.circle(DIAG.cx, DIAG.cy, DIAG_R, { stroke: theme.grid, width: 1 });
    d.line(DIAG.cx - DIAG_R, DIAG.cy, DIAG.cx + DIAG_R, DIAG.cy, { color: theme.grid, width: 1 });
    d.line(DIAG.cx, DIAG.cy - DIAG_R, DIAG.cx, DIAG.cy + DIAG_R, { color: theme.grid, width: 1 });
    const Vt: [number, number] = [DIAG.cx + s.Vx * k, DIAG.cy + s.Vy * k];
    const Ut: [number, number] = [DIAG.cx + ux * k, DIAG.cy + uy * k];
    d.arrow(DIAG.cx, DIAG.cy, s.Vx * k, s.Vy * k, { color: theme.series[1]!, width: 2.5 });
    d.arrow(Vt[0], Vt[1], px * k, py * k, { color: theme.series[2]!, width: 2.5 });
    d.arrow(DIAG.cx, DIAG.cy, ux * k, uy * k, { color: theme.accent, width: 2.5 });
    d.circle(Ut[0], Ut[1], 0.7, { fill: theme.accent, alpha: s.drag === "u" ? 0.9 : 0.35 });
    d.circle(Vt[0], Vt[1], 0.7, { fill: theme.series[1]!, alpha: s.drag === "V" ? 0.9 : 0.35 });
    d.text("Arraste as pontas", DIAG.cx, DIAG.cy - DIAG_R - 0.2, { color: theme.muted, size: 10, baseline: "top" });
    const lx = DIAG.cx + DIAG_R + 1.5;
    const vlabel = ["correnteza", "vento", "carro", "trem"][c];
    const ulabel = c === 2 ? "chuva" : c === 0 ? "barco" : c === 3 ? "passageiro" : "avião";
    d.text(`u: ${ulabel} em relação ao solo`, lx, 17.5, { color: theme.accent, align: "left", size: 11, weight: "600" });
    d.text(`u': ${ulabel} em relação ${c === 2 ? "ao carro" : c === 0 ? "à água" : c === 3 ? "ao trem" : "ao ar"}`, lx, 15, { color: theme.series[2]!, align: "left", size: 11, weight: "600" });
    d.text(`V: ${vlabel} em relação ao solo`, lx, 12.5, { color: theme.series[1]!, align: "left", size: 11, weight: "600" });
    d.text("u = u' + V", lx, 10, { align: "left", size: 12, weight: "700" });

    // ---- resultados da cena ----
    const fmt = (v: number, n = 3) => (Number.isFinite(v) ? Number(v.toPrecision(n)).toString().replace(".", ",") : "—");
    const lines: string[] = [];
    if (c === 0) {
      const vb = Math.hypot(s.ox, s.oy);
      const L = num(p, "L", 60);
      const th = rumoReto(vb, s.Vx);
      lines.push(`Rumo atual: ${fmt(deg(Math.atan2(-s.ox, s.oy)))}° rio acima`);
      lines.push(Number.isFinite(th) ? `Para ir reto: θ* = ${fmt(th)}°, t = ${fmt(L / Math.sqrt(vb * vb - s.Vx * s.Vx))} s` : "Correnteza ≥ v': não dá para ir reto");
      lines.push(`Tempo mínimo (θ = 0): ${fmt(L / vb)} s, deriva ${fmt((s.Vx * L) / vb)} m`);
      if (s.oy > 0) lines.push(`Este rumo: t = ${fmt(L / s.oy)} s, deriva ${fmt(((s.ox + s.Vx) * L) / s.oy)} m`);
    } else if (c === 1) {
      const va = Math.hypot(s.ox, s.oy);
      const D = num(p, "D", 6000);
      const ok = Math.abs(s.Vy) < va;
      const gs = ok ? Math.sqrt(va * va - s.Vy * s.Vy) + s.Vx : NaN;
      lines.push(`Rumo atual: ${fmt(deg(Math.atan2(s.oy, s.ox)))}° (a partir de +x)`);
      lines.push(ok ? `Para ir reto: ψ = ${fmt(deg(Math.asin(-s.Vy / va)))}°` : "Vento lateral ≥ v': impossível manter a rota");
      lines.push(ok && gs > 0 ? `Velocidade no solo ${fmt(gs)} m/s, t = ${fmt(D / gs)} s` : "Não chega a B");
      lines.push(`Sem vento: t = ${fmt(D / va)} s`);
    } else if (c === 3) {
      const Lt = num(p, "Lt", 16);
      lines.push(`Passageiro no trem: u' = ${fmt(s.ox)} m/s`);
      lines.push(`Trem no solo: V = ${fmt(s.Vx)} m/s`);
      lines.push(`Passageiro no solo: u = u' + V = ${fmt(s.ox + s.Vx)} m/s`);
      lines.push(`Posição no vagão x' = ${fmt(s.x - s.Rx)} m de ${fmt(Lt, 2)} m; no solo x = ${fmt(s.x)} m`);
    } else {
      lines.push(`Chuva no solo: ${fmt(deg(Math.atan2(Math.abs(s.ox), Math.abs(s.oy))))}° com a vertical`);
      lines.push(`Vista do carro: ${fmt(deg(Math.atan2(Math.abs(px), Math.abs(py))))}° com a vertical`);
      lines.push(`|u'| = ${fmt(Math.hypot(px, py))} m/s`);
      if (A !== 0) lines.push(`Carro acelera: A = ${fmt(A)} m/s², gotas curvam em S'`);
    }
    lines.forEach((ln, i) => d.text(ln, 62, 17.5 - i * 2.6, { align: "left", size: 11 }));
    d.text(`t = ${fmt(t, 4)} s`, 99, 1.5, { align: "right", size: 11, color: theme.muted });
  },
});

export default movimentoRelativo;
