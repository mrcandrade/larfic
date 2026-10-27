import { defineSim, draw, num, texNum, type Params } from "@fisilab/core";

/** Distância entre centros no contato: carrinhos de 1 m de comprimento ou discos de raio 0,5 m. */
export const D = 1;
/** Instante em que a colisão acontece com as posições iniciais escolhidas, s. */
export const T_HIT = 2;

export interface Body {
  x: number;
  y: number;
  vx: number;
  vy: number;
}

export interface Col {
  b: [Body, Body];
  /** Estado inicial (para a tabela "antes"). */
  ini: [Body, Body];
  /** Número de colisões já resolvidas. */
  hits: number;
  /** Modo com para-choques de mola: força que 1 exerce sobre 2 (N, positiva empurra 2 para +x). */
  F?: number;
  /** Impulso acumulado sobre o carrinho 2, ∫F dt (N·s). */
  imp?: number;
  /** Maior compressão do contato atual (m); 0 fora de contato. */
  dmax?: number;
  /** Curva F(t) do contato: pares [t, F]. */
  hist?: [number, number][];
}

const m1 = (p: Params) => num(p, "m1", 1);
const m2 = (p: Params) => num(p, "m2", 1);
const is2D = (p: Params) => Math.round(num(p, "modo")) === 1;
/** Modo 2: 1D com para-choques de mola, força de contato finita. */
export const isSpring = (p: Params) => Math.round(num(p, "modo")) === 2;
/** Comprimento livre de cada para-choque (m). */
export const BUMP = 0.12;
/** Menor restituição usada no modo com para-choques (e = 0 exigiria descarga instantânea). */
export const E_MIN_SPRING = 0.05;
const isCM = (p: Params) => Math.round(num(p, "ref")) === 1;

/** Velocidades finais de uma colisão 1D com coeficiente de restituição e (fórmulas fechadas). */
export function final1D(ma: number, mb: number, va: number, vb: number, e: number): [number, number] {
  const M = ma + mb;
  return [((ma - e * mb) * va + (1 + e) * mb * vb) / M, ((mb - e * ma) * vb + (1 + e) * ma * va) / M];
}

/** Velocidade do centro de massa. */
export function vcm(s: Col, p: Params): [number, number] {
  const a = m1(p), c = m2(p), M = a + c;
  return [(a * s.b[0].vx + c * s.b[1].vx) / M, (a * s.b[0].vy + c * s.b[1].vy) / M];
}

export function rcm(b: [Body, Body], p: Params): [number, number] {
  const a = m1(p), c = m2(p), M = a + c;
  return [(a * b[0].x + c * b[1].x) / M, (a * b[0].y + c * b[1].y) / M];
}

/** Energia cinética total no laboratório. */
export function kinetic(b: [Body, Body], p: Params): number {
  return 0.5 * m1(p) * (b[0].vx ** 2 + b[0].vy ** 2) + 0.5 * m2(p) * (b[1].vx ** 2 + b[1].vy ** 2);
}

/** Tempo até o contato (|r₂ − r₁| = D) com os corpos se aproximando, ou null. */
export function timeToContact(b: [Body, Body]): number | null {
  const rx = b[1].x - b[0].x, ry = b[1].y - b[0].y;
  const ux = b[1].vx - b[0].vx, uy = b[1].vy - b[0].vy;
  const ru = rx * ux + ry * uy;
  if (ru >= 0) return null; // afastando-se ou parados
  const c = rx * rx + ry * ry - D * D;
  if (c <= 0) return 0;
  const a = ux * ux + uy * uy;
  const disc = ru * ru - a * c;
  if (disc < 0) return null; // passam sem se tocar
  return c / (-ru + Math.sqrt(disc)); // raiz menor, forma estável
}

/** Impulso ao longo da linha dos centros (sem atrito entre as superfícies). */
export function resolve(b: [Body, Body], p: Params): [Body, Body] {
  const e = num(p, "e", 1);
  const rx = b[1].x - b[0].x, ry = b[1].y - b[0].y;
  const r = Math.hypot(rx, ry) || 1;
  const nx = rx / r, ny = ry / r;
  const un = (b[0].vx - b[1].vx) * nx + (b[0].vy - b[1].vy) * ny;
  if (un <= 0) return b;
  const J = ((1 + e) * un) / (1 / m1(p) + 1 / m2(p));
  return [
    { ...b[0], vx: b[0].vx - (J / m1(p)) * nx, vy: b[0].vy - (J / m1(p)) * ny },
    { ...b[1], vx: b[1].vx + (J / m2(p)) * nx, vy: b[1].vy + (J / m2(p)) * ny },
  ];
}

const move = (b: [Body, Body], h: number): [Body, Body] =>
  b.map((q) => ({ ...q, x: q.x + q.vx * h, y: q.y + q.vy * h })) as [Body, Body];

/** Passo exato: movimento retilíneo uniforme entre colisões, colisão no instante exato do contato. */
export function advance(s: Col, p: Params, dt: number): Col {
  let b = s.b, hits = s.hits, rem = dt;
  for (let k = 0; k < 4; k++) {
    const tau = timeToContact(b);
    if (tau === null || tau > rem) break;
    b = resolve(move(b, tau), p);
    rem -= tau;
    hits++;
  }
  return { ...s, b: move(b, rem), hits };
}

/**
 * Força de contato dos para-choques (modelo de Walton e Braun): carrega com rigidez k e
 * descarrega com rigidez k/e², a partir da compressão máxima dmax. A energia devolvida é
 * e² vezes a armazenada, então a restituição é exatamente e. Nunca puxa (F ≥ 0).
 */
export function contactForce(delta: number, dmax: number, k: number, e: number): number {
  if (delta <= 0) return 0;
  if (delta >= dmax) return k * delta;
  const e2 = e * e;
  return Math.max(0, (k / e2) * (delta - dmax * (1 - e2)));
}

/** Duração prevista do contato: meia oscilação na carga e meia na descarga. */
export const contactDuration = (mu: number, k: number, e: number) => (Math.PI / 2) * Math.sqrt(mu / k) * (1 + e);
/** Força máxima prevista: k·δmax, com δmax = u·√(μ/k). */
export const peakForce = (mu: number, k: number, u: number) => Math.abs(u) * Math.sqrt(k * mu);

/** Passo do modo com para-choques: Euler simplético em subpassos, forças iguais e opostas. */
export function advanceSpring(s: Col, p: Params, t: number, dt: number): Col {
  const k = num(p, "k", 200);
  const e = Math.min(1, Math.max(E_MIN_SPRING, num(p, "e", 1)));
  const ma = m1(p), mb = m2(p);
  const mu = (ma * mb) / (ma + mb);
  const hMax = Math.min(2e-4, 0.05 / Math.sqrt(k / (e * e) / mu));
  const n = Math.max(1, Math.ceil(dt / hMax));
  const h = dt / n;
  let x1 = s.b[0].x, v1 = s.b[0].vx, x2 = s.b[1].x, v2 = s.b[1].vx;
  let dmax = s.dmax ?? 0, imp = s.imp ?? 0, hits = s.hits;
  for (let i = 0; i < n; i++) {
    const delta = D - (x2 - x1);
    let F = 0;
    if (delta > 0) {
      dmax = Math.max(dmax, delta);
      F = contactForce(delta, dmax, k, e);
    } else if (dmax > 0) {
      hits++;
      dmax = 0;
    }
    v1 -= (F / ma) * h;
    v2 += (F / mb) * h;
    x1 += v1 * h;
    x2 += v2 * h;
    imp += F * h;
  }
  const F = contactForce(D - (x2 - x1), dmax, k, e);
  let hist = s.hist ?? [];
  const last = hist[hist.length - 1];
  if (F > 0 || (last && last[1] > 0)) {
    hist = hist.length === 0 ? [[t, 0], [t + dt, F]] : hist.length < 4000 ? [...hist, [t + dt, F]] : hist;
  }
  return {
    ...s,
    b: [
      { ...s.b[0], x: x1, vx: v1 },
      { ...s.b[1], x: x2, vx: v2 },
    ],
    hits,
    F,
    imp,
    dmax,
    hist,
  };
}

/** Molas em zigue-zague para os para-choques. */
function zigzag(d: ReturnType<typeof draw>, x0: number, x1: number, y: number, amp: number, color: string) {
  const n = 5;
  const pts: [number, number][] = [[x0, y]];
  for (let i = 1; i < 2 * n; i++) pts.push([x0 + ((x1 - x0) * i) / (2 * n), y + (i % 2 ? amp : -amp)]);
  pts.push([x1, y]);
  d.polyline(pts, { color, width: 1.5 });
}

export function initial(p: Params): [Body, Body] {
  const v1 = num(p, "v1", 2), v2 = num(p, "v2", 0);
  const two = is2D(p);
  const bb = two ? Math.min(num(p, "b"), 2) : 0;
  if (v1 <= v2) {
    // Não se aproximam: começam separados.
    return [
      { x: -2, y: bb / 2, vx: v1, vy: 0 },
      { x: 2, y: -bb / 2, vx: v2, vy: 0 },
    ];
  }
  // Posições escolhidas para que o contato (ou a maior aproximação) ocorra em t = T_HIT perto da origem.
  const dx = bb < D ? Math.sqrt(D * D - bb * bb) : 0;
  return [
    { x: -dx / 2 - v1 * T_HIT, y: bb / 2, vx: v1, vy: 0 },
    { x: dx / 2 - v2 * T_HIT, y: -bb / 2, vx: v2, vy: 0 },
  ];
}

/** Velocidades no referencial escolhido (laboratório ou centro de massa). */
function framed(b: [Body, Body], p: Params): [Body, Body] {
  if (!isCM(p)) return b;
  const a = m1(p), c = m2(p), M = a + c;
  const ux = (a * b[0].vx + c * b[1].vx) / M, uy = (a * b[0].vy + c * b[1].vy) / M;
  const [xc, yc] = rcm(b, p);
  return b.map((q) => ({ x: q.x - xc, y: q.y - yc, vx: q.vx - ux, vy: q.vy - uy })) as [Body, Body];
}

const deg = (vx: number, vy: number) => (Math.abs(vx) + Math.abs(vy) < 1e-12 ? 0 : (Math.atan2(vy, vx) * 180) / Math.PI);

const fmt = (v: number, d = 2) => {
  const r = Math.abs(v) < 0.5 * 10 ** -d ? 0 : v;
  return r.toFixed(d).replace(".", ",").replace(/^-/, "−");
};

export const colisoes = defineSim<Col>({
  id: "colisoes",
  title: "Colisões 1D e 2D: restituição e centro de massa",
  course: "FG I",
  topic: "Momento",
  priority: "P1",
  summary:
    "Dois carrinhos num trilho ou dois discos numa mesa sem atrito colidem com coeficiente de restituição ajustável. Alterne entre o referencial do laboratório e o do centro de massa e compare momento e energia antes e depois.",
  equations: [
    String.raw`m_1\vec v_1 + m_2\vec v_2 = m_1\vec v_1\,' + m_2\vec v_2\,' \qquad e = -\frac{(\vec v_1\,' - \vec v_2\,')\cdot\hat n}{(\vec v_1 - \vec v_2)\cdot\hat n}`,
    String.raw`v_1' = \frac{(m_1 - e\,m_2)\,v_1 + (1+e)\,m_2 v_2}{m_1+m_2} \qquad v_2' = \frac{(m_2 - e\,m_1)\,v_2 + (1+e)\,m_1 v_1}{m_1+m_2}`,
    String.raw`\vec v_{CM} = \frac{m_1\vec v_1 + m_2\vec v_2}{m_1+m_2} \qquad K = \tfrac12 M v_{CM}^2 + K_{CM}`,
    String.raw`\Delta K = -\tfrac12\,\mu\,(1-e^2)\,u_n^2 \qquad \mu = \frac{m_1 m_2}{m_1+m_2}`,
  ],
  liveEquations(s, p) {
    const [ux, uy] = vcm(s, p);
    const M = m1(p) + m2(p);
    const K = kinetic(s.b, p);
    const Kc = K - 0.5 * M * (ux * ux + uy * uy);
    const px = m1(p) * s.b[0].vx + m2(p) * s.b[1].vx;
    const out = [
      String.raw`p_x = ${texNum(px)}\ \text{kg·m/s} \qquad v_{CM} = ${texNum(ux)}\ \text{m/s} \qquad K = \tfrac12 M v_{CM}^2 + K_{CM} = ${texNum(0.5 * M * (ux * ux + uy * uy))} + ${texNum(Kc)}\ \text{J}`,
    ];
    if (isSpring(p)) {
      const dv2 = s.b[1].vx - s.ini[1].vx;
      out.push(
        String.raw`F_{12} = -F_{21} = ${texNum(s.F ?? 0)}\ \text{N} \qquad J = \int F_{12}\,dt = ${texNum(s.imp ?? 0)}\ \text{N·s} \qquad m_2\,\Delta v_2 = ${texNum(m2(p) * dv2)}\ \text{kg·m/s}`,
      );
    }
    if (!is2D(p)) {
      const [a, b] = final1D(m1(p), m2(p), num(p, "v1", 2), num(p, "v2"), num(p, "e", 1));
      out.push(String.raw`\text{previsto: } v_1' = ${texNum(a)}\ \text{m/s} \qquad v_2' = ${texNum(b)}\ \text{m/s}`);
    }
    return out;
  },

  params: [
    {
      key: "modo",
      label: "Tipo de colisão",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "1D: carrinhos num trilho" },
        { value: 1, label: "2D: discos numa mesa de ar" },
        { value: 2, label: "1D: para-choques de mola (força de contato finita)" },
      ],
    },
    {
      key: "ref",
      label: "Referencial",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Laboratório" },
        { value: 1, label: "Centro de massa" },
      ],
    },
    { key: "m1", label: "Massa m₁", unit: "kg", min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: "m2", label: "Massa m₂", unit: "kg", min: 0.1, max: 10, step: 0.1, default: 1 },
    { key: "v1", label: "Velocidade inicial v₁", unit: "m/s", min: -4, max: 4, step: 0.1, default: 2 },
    { key: "v2", label: "Velocidade inicial v₂", unit: "m/s", min: -4, max: 4, step: 0.1, default: 0 },
    { key: "e", label: "Coeficiente de restituição e", unit: "", min: 0, max: 1, step: 0.01, default: 1 },
    { key: "b", label: "Parâmetro de impacto b (2D)", unit: "m", min: 0, max: 1.2, step: 0.01, default: 0.5 },
    { key: "k", label: "Rigidez dos para-choques (modo de mola)", unit: "N/m", min: 20, max: 2000, step: 10, default: 200 },
  ],

  observables: [
    { key: "x1", label: "Posição x₁", unit: "m", value: (s) => s.b[0].x },
    { key: "x2", label: "Posição x₂", unit: "m", value: (s) => s.b[1].x },
    { key: "v1x", label: "Velocidade v₁ₓ", unit: "m/s", value: (s) => s.b[0].vx },
    { key: "v2x", label: "Velocidade v₂ₓ", unit: "m/s", value: (s) => s.b[1].vx },
    { key: "v1y", label: "Velocidade v₁ᵧ", unit: "m/s", value: (s) => s.b[0].vy },
    { key: "v2y", label: "Velocidade v₂ᵧ", unit: "m/s", value: (s) => s.b[1].vy },
    { key: "px", label: "Momento total pₓ", unit: "kg·m/s", value: (s, p) => m1(p) * s.b[0].vx + m2(p) * s.b[1].vx },
    { key: "py", label: "Momento total pᵧ", unit: "kg·m/s", value: (s, p) => m1(p) * s.b[0].vy + m2(p) * s.b[1].vy },
    { key: "K", label: "Energia cinética total (laboratório)", unit: "J", value: (s, p) => kinetic(s.b, p) },
    {
      key: "Kcm",
      label: "Energia cinética no referencial do CM",
      unit: "J",
      value: (s, p) => {
        const [ux, uy] = vcm(s, p);
        return kinetic(s.b, p) - 0.5 * (m1(p) + m2(p)) * (ux * ux + uy * uy);
      },
    },
    { key: "dK", label: "Energia cinética dissipada", unit: "J", value: (s, p) => kinetic(s.ini, p) - kinetic(s.b, p) },
    { key: "xcm", label: "Posição do centro de massa", unit: "m", value: (s, p) => rcm(s.b, p)[0] },
    { key: "th1", label: "Direção de v₁ (ângulo com x)", unit: "°", value: (s) => deg(s.b[0].vx, s.b[0].vy) },
    { key: "th2", label: "Direção de v₂ (ângulo com x)", unit: "°", value: (s) => deg(s.b[1].vx, s.b[1].vy) },
    { key: "F12", label: "Força de 1 sobre 2 (para-choques)", unit: "N", value: (s) => s.F ?? 0 },
    { key: "F21", label: "Força de 2 sobre 1 (para-choques)", unit: "N", value: (s) => -(s.F ?? 0) },
    { key: "J", label: "Impulso sobre 2, ∫F dt (para-choques)", unit: "N·s", value: (s) => s.imp ?? 0 },
  ],
  conserved: "px",
  chart: { x: "t", y: "v1x" },

  scenarios: [
    {
      id: "troca",
      label: "Elástica, massas iguais",
      params: { modo: 0, ref: 0, m1: 1, m2: 1, v1: 2, v2: 0, e: 1 },
      guide: `### Troca de velocidades
1. Rode e compare as velocidades antes e depois na tabela.
2. Com $m_1 = m_2$ e $e = 1$, as fórmulas dão $v_1' = v_2$ e $v_2' = v_1$: os carrinhos **trocam** de velocidade.
3. Agora faça $m_2 = 5$ kg. O carrinho 1 volta? E com $m_2 = 0{,}2$ kg?
4. Confira na tabela que $p$ total e $K$ total não mudam numa colisão elástica.`,
      predict: [
        {
          question: "Um carrinho a 2 m/s bate elasticamente num carrinho idêntico parado. Depois da colisão:",
          options: [
            "os dois seguem juntos a 1 m/s",
            "o primeiro para e o segundo sai a 2 m/s",
            "o primeiro volta a 2 m/s e o segundo fica parado",
          ],
          answer: 1,
          explanation: "Conservar $p$ e $K$ ao mesmo tempo com massas iguais só é possível trocando as velocidades: $v_1' = 0$ e $v_2' = 2$ m/s.",
        },
      ],
    },
    {
      id: "gruda",
      label: "Perfeitamente inelástica",
      params: { modo: 0, ref: 0, m1: 1, m2: 3, v1: 3, v2: 0, e: 0 },
      guide: `### Grudam e seguem juntos
1. Com $e = 0$ os carrinhos saem com a mesma velocidade $v_{CM}$.
2. Calcule a fração de energia cinética perdida e confira na tabela: $\\Delta K / K = m_2/(m_1+m_2)$ quando o alvo está parado.
3. Troque para o **referencial do centro de massa**: antes, os momentos são opostos e somam zero; depois, os dois ficam parados. Toda a energia $K_{CM}$ foi dissipada.
4. A parte $\\tfrac12 M v_{CM}^2$ nunca pode ser perdida: por quê?`,
      predict: [
        {
          question: "Um carrinho de 1 kg a 3 m/s gruda num de 3 kg parado. Que fração da energia cinética é dissipada?",
          options: ["25%", "50%", "75%", "nenhuma, a energia se conserva"],
          answer: 2,
          explanation: "$v' = m_1 v_1/(m_1+m_2) = 0{,}75$ m/s. $K$ cai de $4{,}5$ J para $1{,}125$ J: perde $3{,}375$ J, isto é, $m_2/(m_1+m_2) = 75\\%$.",
        },
      ],
    },
    {
      id: "cm",
      label: "Visto do centro de massa",
      params: { modo: 0, ref: 1, m1: 2, m2: 1, v1: 3, v2: -1, e: 0.6 },
      guide: `### O referencial mais simples
1. No referencial do CM o momento total é zero antes e depois: confira na tabela.
2. Cada carrinho volta com a velocidade multiplicada por $-e$: $u_i' = -e\\,u_i$. É a definição do coeficiente de restituição.
3. Por isso a energia cinética no CM cai pelo fator $e^2$: $K_{CM}' = e^2 K_{CM}$.
4. Alterne para o laboratório durante o movimento e veja o mesmo choque com outros números.`,
    },
    {
      id: "disco",
      label: "Discos 2D, massas iguais",
      params: { modo: 1, ref: 0, m1: 1, m2: 1, v1: 2, v2: 0, e: 1, b: 0.5 },
      guide: `### Saem em ângulo reto
1. O parâmetro de impacto $b$ é a distância entre as retas de movimento dos centros. Com $b = 0$ a colisão é frontal (1D).
2. Rode com $b = 0{,}5$ m e meça os ângulos $\\theta_1$ e $\\theta_2$ das velocidades finais.
3. Numa colisão elástica entre massas iguais com o alvo parado, $\\theta_1 + \\theta_2 = 90^\\circ$ (em módulo). Teste outros valores de $b$.
4. Com $b \\ge 1$ m (soma dos raios) os discos não se tocam.`,
      predict: [
        {
          question: "Um disco bate elasticamente e de raspão num disco idêntico parado. O ângulo entre as velocidades finais é:",
          options: ["sempre 90°", "sempre 180°", "depende de b, entre 0° e 90°"],
          answer: 0,
          explanation: "Com $m_1 = m_2$: $\\vec v_1 = \\vec v_1\\,' + \\vec v_2\\,'$ e $v_1^2 = v_1'^2 + v_2'^2$. Pelo teorema de Pitágoras os vetores finais são perpendiculares (se nenhum deles for nulo).",
        },
      ],
    },
    {
      id: "acao-reacao",
      label: "Ação e reação durante o choque",
      params: { modo: 2, ref: 0, m1: 4, m2: 1, v1: 1.5, v2: -1.5, e: 1, k: 200 },
      guide: `### As duas forças do par
Os carrinhos têm para-choques de mola, então o choque dura um tempo finito e dá para ver as forças.
1. Rode devagar. Durante o contato aparecem duas setas: $\\vec F_{21}$, que o carrinho 2 faz sobre o 1, e $\\vec F_{12}$, que o 1 faz sobre o 2. Cada uma está desenhada **no corpo em que age**.
2. Pause em vários instantes: as setas têm sempre o **mesmo comprimento** e sentidos opostos, embora o carrinho 1 tenha 4 vezes a massa do 2. Leia $F_{12}$ e $F_{21}$ no gráfico (observáveis).
3. As acelerações não são iguais: $a_1 = F/m_1$ é quatro vezes menor que $a_2 = F/m_2$. Na tabela, $\\Delta p_1 = -\\Delta p_2$, e o momento total não muda.
4. As duas forças não se cancelam: agem em corpos diferentes. Cada uma muda o momento do corpo em que age.`,
      predict: [
        {
          question: "Um carrinho de 4 kg e um de 1 kg colidem de frente. Durante o contato, a força que o carrinho de 4 kg faz sobre o de 1 kg é:",
          options: ["4 vezes maior que a força do de 1 kg sobre o de 4 kg", "igual em módulo e oposta", "4 vezes menor", "depende de qual está mais rápido"],
          answer: 1,
          explanation: "Pela terceira lei, $\\vec F_{12} = -\\vec F_{21}$ a cada instante, quaisquer que sejam as massas e as velocidades. O que difere são as acelerações: o carrinho leve muda de velocidade quatro vezes mais.",
        },
      ],
    },
    {
      id: "forca-contato",
      label: "Força de contato finita: F(t) e impulso",
      params: { modo: 2, ref: 0, m1: 1, m2: 3, v1: 2, v2: 0, e: 1, k: 200 },
      guide: `### O impulso é a área sob F(t)
1. Rode. Durante o contato o gráfico acima do trilho desenha a força $F(t)$ que o carrinho 1 faz sobre o 2; a área sombreada é o impulso $J = \\int F\\,dt$.
2. Depois do choque, compare $J$ com a variação de momento do carrinho 2 na tabela: $J = m_2\\,\\Delta v_2$ (teorema impulso–momento).
3. Calcule a força média $F_{\\text{méd}} = J/\\Delta t$ com a duração $\\Delta t$ indicada. Ela é menor que o pico: para um pulso em forma de meia senoide, $F_{\\text{méd}} = (2/\\pi)F_{\\text{máx}}$.
4. Quadruplique a rigidez $k$ (para-choques mais duros): o contato dura metade, o pico dobra, mas a área não muda. É o que fazem os airbags e os capacetes, só que ao contrário: aumentar $\\Delta t$ para reduzir a força.
5. Baixe $e$ para 0,5: a curva fica assimétrica (a descarga é mais rápida) e o impulso cai para $(1+e)\\,\\mu\\,u$, com $\\mu = m_1m_2/(m_1+m_2)$. Neste modo, $e$ mínimo é 0,05.`,
      predict: [
        {
          question: "Se os para-choques ficarem 4 vezes mais rígidos, mantendo massas e velocidades, o impulso que um carrinho recebe:",
          options: ["fica 4 vezes maior", "dobra", "não muda", "cai pela metade"],
          answer: 2,
          explanation: "O impulso é igual à variação de momento, que só depende das massas, das velocidades e de $e$. Com $k$ quatro vezes maior, $\\Delta t \\propto \\sqrt{\\mu/k}$ cai à metade e o pico $F_{\\text{máx}} \\propto \\sqrt{k}$ dobra: a área fica igual.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "restituicao",
      prompt:
        "Um carrinho de {m1} kg a {v1} m/s bate num carrinho de {m2} kg parado, num trilho sem atrito. O coeficiente de restituição é {e}. Qual é a velocidade do segundo carrinho depois da colisão?",
      vary: { m1: [0.5, 5, 1], m2: [0.5, 5, 1], v1: [1, 4, 1], e: [0, 1, 2] },
      fixed: { modo: 0, v2: 0 },
      answer: { label: "v₂'", unit: "m/s", compute: (p) => final1D(m1(p), m2(p), num(p, "v1"), 0, num(p, "e"))[1] },
      hint: "Use a conservação do momento e a definição de e: v₂' − v₁' = e·v₁.",
    },
    {
      id: "dissipada",
      prompt:
        "Um carrinho de {m1} kg a {v1} m/s gruda num carrinho de {m2} kg parado. Quanta energia cinética é dissipada na colisão?",
      vary: { m1: [0.5, 5, 1], m2: [0.5, 5, 1], v1: [1, 4, 1] },
      fixed: { modo: 0, v2: 0, e: 0 },
      answer: {
        label: "ΔK",
        unit: "J",
        compute: (p) => (0.5 * m1(p) * m2(p) * num(p, "v1") ** 2) / (m1(p) + m2(p)),
      },
      hint: "Só a energia no referencial do CM pode ser perdida: ½·μ·v₁², com μ = m₁m₂/(m₁+m₂).",
    },
  ],

  init: (p) => {
    const b = initial(p);
    return { b, ini: b, hits: 0 };
  },
  step: (s, p, t, dt) => (isSpring(p) ? advanceSpring(s, p, t, dt) : advance(s, p, dt)),
  dt: 2e-3,
  sampleEvery: 5,
  tEnd: 5,

  viewport: (p) => ({ xMin: -10.4, xMax: 10.4, yMin: -8, yMax: is2D(p) ? 4.6 : isSpring(p) ? 6.9 : 2.9 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const two = is2D(p), cm = isCM(p), spring = isSpring(p);
    const ma = m1(p), mb = m2(p), M = ma + mb;
    const cols = [theme.series[0]!, theme.series[1]!];
    const Y0 = two ? 1.6 : 0.6; // altura do centro dos corpos no palco
    const AREA = { x0: -10, x1: 10, y0: -1.0, y1: two ? 4.4 : 2.7 };
    const [xc] = rcm(s.b, p);
    const shown = framed(s.b, p);
    const off = (q: Body): [number, number] => [q.x, Y0 + q.y];

    // Área de jogo recortada
    ctx.save();
    ctx.beginPath();
    ctx.rect(AREA.x0, AREA.y0, AREA.x1 - AREA.x0, AREA.y1 - AREA.y0);
    ctx.clip();
    if (two) {
      d.rect(AREA.x0, AREA.y0, AREA.x1 - AREA.x0, AREA.y1 - AREA.y0, { fill: theme.ground, alpha: 0.35 });
      // Marcas da mesa: andam para trás no referencial do CM.
      const shift = cm ? xc : 0;
      for (let k = Math.ceil(AREA.x0 + shift - 1); k <= AREA.x1 + shift + 1; k++)
        d.line(k - shift, AREA.y0, k - shift, AREA.y1, { color: theme.grid, width: 1 });
      for (let y = Math.ceil(AREA.y0); y <= AREA.y1; y++) d.line(AREA.x0, y, AREA.x1, y, { color: theme.grid, width: 1 });
      // Rastros
      const tr = frame.trail;
      for (let i = 0; i < 2; i++) {
        const pts: [number, number][] = tr.map((st) => off(framed(st.b, p)[i]!));
        d.polyline(pts, { color: cols[i], width: 1.5, alpha: 0.6, dash: [4, 3] });
      }
    } else {
      // Trilho com marcas a cada metro
      d.rect(AREA.x0, -0.25, AREA.x1 - AREA.x0, 0.2, { fill: theme.ground });
      const shift = cm ? xc : 0;
      for (let k = Math.ceil(AREA.x0 + shift - 1); k <= AREA.x1 + shift + 1; k++) {
        d.line(k - shift, -0.05, k - shift, -0.25, { color: theme.muted, width: 1 });
        if (k % 2 === 0) d.text(`${k}`, k - shift, -0.55, { color: theme.muted, size: 10 });
      }
    }

    shown.forEach((q, i) => {
      const [x, y] = off(q);
      const col = cols[i]!;
      const m = i === 0 ? ma : mb;
      if (two) {
        d.circle(x, y, D / 2, { fill: col, alpha: 0.85, stroke: theme.text, width: 1 });
        d.text(`${i + 1}`, x, y, { color: theme.dark ? "#10151c" : "#ffffff", size: 13, weight: "700" });
      } else {
        const h = 0.35 + 0.35 * Math.min(1, Math.sqrt(m / 10) * 1.6); // altura sugere a massa
        const wC = spring ? D - 2 * BUMP : D;
        d.rect(x - wC / 2, 0.05, wC, h, { fill: col, alpha: 0.9, stroke: theme.text, width: 1 });
        if (spring) {
          // para-choque na face voltada para o outro carrinho
          const other = shown[1 - i]!;
          const gap = Math.abs(other.x - q.x) - wC;
          const L = Math.max(0, Math.min(BUMP, gap / 2));
          const dir = other.x >= q.x ? 1 : -1;
          zigzag(d, x + (dir * wC) / 2, x + dir * (wC / 2 + L), 0.05 + h / 2, 0.07, theme.text);
        }
        d.circle(x - 0.28, 0.02, 0.07, { fill: theme.text });
        d.circle(x + 0.28, 0.02, 0.07, { fill: theme.text });
        d.text(`${fmt(m, 1)} kg`, x, 0.05 + h, { color: col, size: 11, weight: "600", dy: -9, align: spring ? (q.x <= shown[1 - i]!.x ? "right" : "left") : "center" });
      }
      const sp = Math.hypot(q.vx, q.vy);
      const ay = two ? y : 1.35 + 0.5 * i;
      if (sp > 1e-3) {
        d.arrowPx(x, ay, q.vx, q.vy, Math.min(150, 32 * sp), { color: col });
        const lp = (Math.min(150, 32 * sp) + 12) * d.px;
        d.text(`v${i === 0 ? "₁" : "₂"}`, x + (q.vx / sp) * lp, ay + (q.vy / sp) * lp, { color: col, size: 12, weight: "600" });
      } else if (!two) d.text(`v${i === 0 ? "₁" : "₂"} = 0`, x, ay, { color: col, size: 11 });
    });

    // Centro de massa
    const [cx, cy] = two ? (cm ? [0, Y0] : off({ x: xc, y: rcm(s.b, p)[1], vx: 0, vy: 0 })) : [cm ? 0 : xc, -0.15];
    const r = 9 * d.px;
    if (!two) d.line(cx, cy + r, cx, 1.15, { color: theme.text, dash: [3, 3], width: 1, alpha: 0.6 });
    d.circle(cx, cy, r, { stroke: theme.text, width: 1.5 });
    d.line(cx - r, cy, cx + r, cy, { color: theme.text, width: 1.5 });
    d.line(cx, cy - r, cx, cy + r, { color: theme.text, width: 1.5 });
    d.text("CM", cx + r, cy, { size: 10, color: theme.text, align: "left", dx: 4, dy: two ? 0 : 6 });
    ctx.restore();

    // Forças do par ação–reação (fora do recorte, para os rótulos caberem)
    const Fc = s.F ?? 0;
    if (spring && Fc > 1e-6) {
      const mu = (ma * mb) / M;
      const Fpk = Math.max(1e-6, peakForce(mu, num(p, "k", 200), s.ini[0].vx - s.ini[1].vx));
      const len = Math.min(140, (110 * Fc) / Fpk);
      const yF = 2.2;
      const [q1, q2] = shown;
      d.arrowPx(q2.x, yF, 1, 0, len, { color: theme.negative, width: 3 });
      d.arrowPx(q1.x, yF, -1, 0, len, { color: theme.negative, width: 3 });
      d.text(`F₁₂ = ${fmt(Fc, 1)} N (1 sobre 2)`, q2.x, yF, { color: theme.negative, size: 11, weight: "600", align: "left", dy: -12 });
      d.text(`F₂₁ = ${fmt(Fc, 1)} N (2 sobre 1)`, q1.x, yF, { color: theme.negative, size: 11, weight: "600", align: "right", dy: -12 });
    }

    if (spring) {
      // Gráfico F(t) com a área (impulso) sombreada
      const G = { x0: -6.5, x1: 6.5, y0: 3.4, y1: 6.2 };
      const mu = (ma * mb) / M;
      const kk = num(p, "k", 200);
      const ee = Math.min(1, Math.max(E_MIN_SPRING, num(p, "e", 1)));
      const u0 = s.ini[0].vx - s.ini[1].vx;
      const Fpk = Math.max(1e-6, peakForce(mu, kk, u0));
      const dtc = contactDuration(mu, kk, ee);
      d.line(G.x0, G.y0, G.x1, G.y0, { color: theme.muted, width: 1 });
      d.line(G.x0, G.y0, G.x0, G.y1, { color: theme.muted, width: 1 });
      d.text("F₁₂ (N)", G.x0, G.y1, { color: theme.muted, size: 11, align: "left", dx: 4, dy: 2 });
      d.text("t", G.x1, G.y0, { color: theme.muted, size: 11, align: "left", dx: 4 });
      d.text(fmt(Fpk * 1.1, 1), G.x0, G.y1 - 0.3, { color: theme.muted, size: 10, align: "right", dx: -4 });
      const hist = s.hist ?? [];
      if (hist.length > 1) {
        const t0 = hist[0]![0];
        const W = Math.max(1.5 * dtc, hist[hist.length - 1]![0] - t0) || 1;
        const X = (tt: number) => G.x0 + 0.5 + ((tt - t0) / W) * (G.x1 - G.x0 - 1);
        const Y = (F: number) => G.y0 + (F / (1.1 * Fpk)) * (G.y1 - G.y0 - 0.3);
        const pts: [number, number][] = hist.map(([tt, F]) => [X(tt), Y(F)]);
        d.polyline([[X(t0), G.y0], ...pts, [pts[pts.length - 1]![0], G.y0]], { color: "none", fill: theme.negative, alpha: 0.2, close: true });
        d.polyline(pts, { color: theme.negative, width: 2 });
        const ended = hist[hist.length - 1]![1] === 0;
        const dur = ended ? hist[hist.length - 1]![0] - t0 : NaN;
        d.text(`área = impulso J = ∫F dt = ${fmt(s.imp ?? 0, 3)} N·s`, G.x1, G.y1 - 0.2, { color: theme.negative, size: 12, weight: "600", align: "right" });
        d.text(
          ended ? `Δt ≈ ${fmt(dur, 3)} s   F_máx ≈ ${fmt(Math.max(...hist.map((h) => h[1])), 1)} N   F_méd = J/Δt ≈ ${fmt((s.imp ?? 0) / dur, 1)} N` : "contato em andamento…",
          G.x1,
          G.y1 - 0.75,
          { color: theme.text, size: 11, align: "right" },
        );
      } else {
        d.text("O gráfico de F(t) aparece quando os para-choques se tocam.", 0, (G.y0 + G.y1) / 2, { color: theme.muted, size: 12 });
      }
    }

    // Legenda do referencial
    const [ux, uy] = vcm(s, p);
    d.text(
      cm ? `Referencial do centro de massa (move-se a ${fmt(ux)} m/s em relação ao laboratório)` : "Referencial do laboratório",
      AREA.x0 + 0.1,
      AREA.y1 - 0.1,
      { color: theme.text, size: 12, weight: "600", align: "left", baseline: "top" },
    );
    if (two && num(p, "b") >= D && num(p, "v1", 2) > num(p, "v2")) d.text("b ≥ soma dos raios: os discos não se tocam", AREA.x1 - 0.1, AREA.y1 - 0.1, { color: theme.muted, size: 11, align: "right", baseline: "top" });
    if (num(p, "v1", 2) <= num(p, "v2")) d.text("v₁ ≤ v₂: os corpos não se aproximam", AREA.x1 - 0.1, AREA.y1 - 0.1, { color: theme.muted, size: 11, align: "right", baseline: "top" });

    // Tabela de momento e energia, antes e depois, no referencial escolhido
    const before = framed(s.ini, p);
    const after = s.hits > 0 ? shown : null;
    const kOf = (q: Body, m: number) => 0.5 * m * (q.vx ** 2 + q.vy ** 2);
    const pStr = (vx: number, vy: number) => (two ? `(${fmt(vx)}; ${fmt(vy)})` : fmt(vx));
    const pRow = (bs: [Body, Body] | null, i: number | null) => {
      if (!bs) return "—";
      if (i === null) return pStr(ma * bs[0].vx + mb * bs[1].vx, ma * bs[0].vy + mb * bs[1].vy);
      const m = i === 0 ? ma : mb;
      return pStr(m * bs[i]!.vx, m * bs[i]!.vy);
    };
    const kRow = (bs: [Body, Body] | null, i: number | null) => {
      if (!bs) return "—";
      return fmt(i === null ? kOf(bs[0], ma) + kOf(bs[1], mb) : kOf(bs[i]!, i === 0 ? ma : mb));
    };
    const rows: [string, string, string, string?][] = [
      [`p₁ (kg·m/s)`, pRow(before, 0), pRow(after, 0)],
      [`p₂ (kg·m/s)`, pRow(before, 1), pRow(after, 1)],
      [`p total (kg·m/s)`, pRow(before, null), pRow(after, null), "bold"],
      [`K₁ (J)`, kRow(before, 0), kRow(after, 0)],
      [`K₂ (J)`, kRow(before, 1), kRow(after, 1)],
      [`K total (J)`, kRow(before, null), kRow(after, null), "bold"],
    ];
    const TX = { lab: -9.9, a: -2.5, b: 3.2, c: 8.3 };
    const yH = -1.75;
    d.line(-10, yH - 0.3, 10, yH - 0.3, { color: theme.grid, width: 1 });
    d.text(cm ? "Tabela no referencial do CM" : "Tabela no referencial do laboratório", TX.lab, yH, { size: 12, weight: "600", align: "left", color: theme.muted });
    d.text("antes", TX.a, yH, { size: 12, weight: "600" });
    d.text(s.hits > 0 ? "depois" : "depois (aguardando)", TX.b, yH, { size: 12, weight: "600" });
    d.text("variação", TX.c, yH, { size: 12, weight: "600" });
    rows.forEach(([lab, a, b, w], k) => {
      const y = yH - 0.75 - 0.68 * k;
      const weight = w ? "600" : "400";
      d.text(lab, TX.lab, y, { size: 12, align: "left", weight, color: k < 3 ? theme.text : theme.text });
      d.text(a, TX.a, y, { size: 12, weight });
      d.text(b, TX.b, y, { size: 12, weight });
      if (after && w) {
        const delta =
          k === 2
            ? pStr(ma * (after[0].vx - before[0].vx) + mb * (after[1].vx - before[1].vx), ma * (after[0].vy - before[0].vy) + mb * (after[1].vy - before[1].vy))
            : fmt(kOf(after[0], ma) + kOf(after[1], mb) - kOf(before[0], ma) - kOf(before[1], mb));
        d.text(delta, TX.c, y, { size: 12, weight, color: k === 5 && Math.abs(kinetic(s.ini, p) - kinetic(s.b, p)) > 1e-6 ? theme.positive : theme.series[2] });
      }
      if (k === 2) d.line(-10, y - 0.34, 10, y - 0.34, { color: theme.grid, width: 1 });
    });
    const KcmShare = 0.5 * M * (ux * ux + uy * uy);
    d.text(
      `Energia do movimento do CM, ½·M·V² (V = velocidade do CM): ${fmt(KcmShare)} J. Ela não pode ser dissipada. Coeficiente e = ${fmt(num(p, "e", 1))}.`,
      TX.lab,
      -7.6,
      { size: 11, align: "left", color: theme.muted },
    );
  },
});

export default colisoes;
