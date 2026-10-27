import { clamp, defineSim, draw, num, texNum, type Params, type WorldPoint } from "@fisilab/core";
import {
  BEAM_Y,
  G,
  NODE_NAMES,
  PIVOT_H,
  TRUSS_BARS,
  beamLoads,
  bendingMoment,
  craneGeometry,
  fmt,
  fmtN,
  initState,
  ladderPoint,
  lenOf,
  modeOf,
  seesawPoint,
  solve,
  trussNodes,
  type EqState,
  type Force,
  type Result,
} from "./statics.ts";

export * from "./statics.ts";

const MODES = ["Gangorra", "Escada apoiada na parede", "Viga com cargas", "Guindaste (lança e cabo)", "Treliça simples"];
const fin = (v: number) => (Number.isFinite(v) ? v : 0);

function viewportOf(p: Params, s: EqState) {
  const L = lenOf(p);
  const k = L / 4;
  switch (modeOf(p)) {
    case 1:
      return { xMin: -L - 1.2, xMax: 1.1, yMin: -1.5, yMax: L + 0.7, unit: "m" };
    case 2:
      return { xMin: -0.7 * k, xMax: L + 0.7 * k, yMin: -2.3 * k, yMax: 2.0 * k, unit: "m" };
    case 3: {
      const top = Math.max(L * Math.sin(s.ang), s.H, 1) + 1;
      return { xMin: -1.8, xMax: L + 1.2, yMin: -1.6, yMax: Math.max(top, 0.6 * L), unit: "m" };
    }
    case 4: {
      const h = (L / 2) * (Math.sqrt(3) / 2);
      return { xMin: -0.7 * k, xMax: L + 0.7 * k, yMin: -1.3 * k, yMax: h + 1.1 * k, unit: "m" };
    }
    default:
      return { xMin: -0.6, xMax: L + 0.6, yMin: -1.7, yMax: Math.max(2.6, 0.55 * L + 1.2), unit: "m" };
  }
}

/** Alças arrastáveis do modo atual: nome e posição no mundo. */
function handles(s: EqState, p: Params, r: Result): { kind: string; x: number; y: number }[] {
  const L = lenOf(p);
  switch (modeOf(p)) {
    case 0: {
      const a = seesawPoint(s, r.tilt, s.x1), b = seesawPoint(s, r.tilt, s.x2);
      return [
        { kind: "x1", x: a[0], y: a[1] + 0.2 },
        { kind: "x2", x: b[0], y: b[1] + 0.2 },
        { kind: "xa", x: s.xa, y: PIVOT_H / 2 },
      ];
    }
    case 1: {
      const pp = ladderPoint(s, L, clamp(s.x1, 0, L)), top = ladderPoint(s, L, L);
      return [
        { kind: "x1", x: pp[0], y: pp[1] + 0.3 },
        { kind: "top", x: top[0], y: top[1] },
      ];
    }
    case 2:
      return [
        { kind: "x1", x: s.x1, y: BEAM_Y + 0.25 },
        { kind: "x2", x: s.x2, y: BEAM_Y + 0.25 },
        { kind: "xa", x: s.xa, y: BEAM_Y - 0.25 },
        { kind: "xb", x: s.xb, y: BEAM_Y - 0.25 },
      ];
    case 3: {
      const { tip, C } = craneGeometry(s, p);
      const d = clamp(s.x1, 0, L);
      return [
        { kind: "x1", x: d * Math.cos(s.ang), y: d * Math.sin(s.ang) - 0.7 },
        { kind: "top", x: tip[0], y: tip[1] },
        { kind: "H", x: C[0], y: C[1] },
      ];
    }
    default: {
      const nodes = trussNodes(p);
      return [
        { kind: "n1", x: nodes[s.n1]![0], y: nodes[s.n1]![1] - 0.35 },
        { kind: "n2", x: nodes[s.n2]![0], y: nodes[s.n2]![1] - 0.35 },
      ];
    }
  }
}

function pick(s: EqState, p: Params, pt: WorldPoint): string | null {
  const r = solve(s, p);
  const tol = 0.07 * Math.max(lenOf(p), 3);
  let best: string | null = null, bd = tol;
  for (const h of handles(s, p, r)) {
    const dd = Math.hypot(pt.x - h.x, pt.y - h.y);
    if (dd < bd) {
      bd = dd;
      best = h.kind;
    }
  }
  return best;
}

function dragTo(s: EqState, p: Params, kind: string, pt: WorldPoint): EqState {
  const L = lenOf(p);
  const m = modeOf(p);
  const n = { ...s };
  if (m === 0) {
    const tilt = solve(s, p).tilt;
    const u = clamp(s.xa + (pt.x - s.xa) / Math.cos(tilt), 0, L);
    if (kind === "x1") n.x1 = u;
    if (kind === "x2") {
      n.x2 = u;
      const eq = solve(n, p).x2eq;
      if (Number.isFinite(eq) && Math.abs(u - eq) < 0.03 * L) n.x2 = eq;
    }
    if (kind === "xa") n.xa = clamp(pt.x, 0.05 * L, 0.95 * L);
  } else if (m === 1) {
    if (kind === "x1") {
      const foot = ladderPoint(s, L, 0);
      n.x1 = clamp((pt.x - foot[0]) * Math.cos(s.ang) + pt.y * Math.sin(s.ang), 0, L);
    }
    if (kind === "top") n.ang = Math.asin(clamp(pt.y / L, Math.sin((10 * Math.PI) / 180), Math.sin((85 * Math.PI) / 180)));
  } else if (m === 2) {
    const x = clamp(pt.x, 0, L);
    if (kind === "x1") n.x1 = x;
    if (kind === "x2") n.x2 = x;
    if (kind === "xa") n.xa = x;
    if (kind === "xb") n.xb = x;
  } else if (m === 3) {
    if (kind === "x1") n.x1 = clamp(pt.x * Math.cos(s.ang) + (pt.y + 0.7) * Math.sin(s.ang), 0, L);
    if (kind === "top") n.ang = clamp(Math.atan2(pt.y, Math.max(pt.x, 0.05)), (5 * Math.PI) / 180, (80 * Math.PI) / 180);
    if (kind === "H") n.H = clamp(pt.y, 0.2, 1.5 * L);
  } else {
    const nodes = trussNodes(p);
    let best = 0;
    nodes.forEach((q, i) => {
      if (Math.hypot(q[0] - pt.x, q[1] - pt.y) < Math.hypot(nodes[best]![0] - pt.x, nodes[best]![1] - pt.y)) best = i;
    });
    if (kind === "n1") n.n1 = best;
    if (kind === "n2") n.n2 = best;
  }
  return n;
}

export const equilibrioCorpos = defineSim<EqState>({
  id: "equilibrio-corpos",
  title: "Equilíbrio de corpos rígidos",
  course: "FG I",
  topic: "Estática",
  priority: "P2",
  summary:
    "Gangorra, escada, viga, guindaste e treliça com cargas e apoios arrastáveis: diagrama de corpo livre, reações calculadas pelas condições ΣF = 0 e Στ = 0 e aviso quando o equilíbrio é impossível.",
  equations: [
    String.raw`\sum \vec F = 0 \qquad \sum \tau_O = 0 \ \ (\text{qualquer ponto } O)`,
    String.raw`\text{Escada: } N_p = \frac{\big(P_e\,\tfrac{L}{2} + P\,d\big)\cos\theta}{L\sin\theta},\quad \mu_{\min} = \frac{N_p}{P_e + P}`,
    String.raw`\text{Viga: } R_B = \frac{\sum P_i\,(x_i - x_A)}{x_B - x_A},\quad R_A = \sum P_i - R_B \qquad M(x) = \sum_{x_i<x} F_i\,(x - x_i)`,
  ],
  liveEquations(s, p) {
    const r = solve(s, p);
    const L = lenOf(p);
    switch (modeOf(p)) {
      case 0:
        return [
          String.raw`\tau_{\text{cargas}} = ${texNum(r.tau)}\ \text{N·m} \qquad N_{\text{pivô}} = ${texNum(r.R1)}\ \text{N}`,
          Number.isFinite(r.x2eq) ? String.raw`x_2^{\text{eq}} = ${texNum(r.x2eq)}\ \text{m}\ (\text{a } ${texNum(r.x2eq - s.xa)}\ \text{m do pivô})` : String.raw`x_2^{\text{eq}}:\ \text{não existe}`,
        ];
      case 1:
        return [
          String.raw`N_p = f = ${texNum(r.R2)}\ \text{N} \qquad N_c = ${texNum(r.R1)}\ \text{N}`,
          String.raw`\mu_{\min} = \frac{f}{N_c} = ${texNum(r.muMin)} \quad (\mu = ${texNum(num(p, "mu", 0.4))}) \qquad d_{\max} = ${Number.isFinite(r.climbMax) ? texNum(clamp(r.climbMax, 0, L)) : "—"}\ \text{m}`,
        ];
      case 2:
        return [String.raw`R_A = ${texNum(r.R1)}\ \text{N} \qquad R_B = ${texNum(r.R2)}\ \text{N} \qquad R_A + R_B = ${texNum(r.R1 + r.R2)}\ \text{N}`];
      case 3:
        return [String.raw`T = \frac{\big(P\,d + P_l\,\tfrac{L}{2}\big)\cos\alpha}{|\vec r_{\text{ponta}}\times\hat u|} = ${texNum(r.F)}\ \text{N} \qquad |\vec R| = ${texNum(r.R1)}\ \text{N}`];
      default:
        return [String.raw`A_y = ${texNum(r.R1)}\ \text{N} \qquad C_y = ${texNum(r.R2)}\ \text{N} \qquad |F|_{\max} = ${texNum(r.F)}\ \text{N}`];
    }
  },

  params: [
    { key: "modo", label: "Situação", unit: "", min: 0, max: 4, step: 1, default: 0, options: MODES.map((label, value) => ({ value, label })) },
    { key: "L", label: "Comprimento do corpo L", unit: "m", min: 1, max: 8, step: 0.1, default: 4 },
    { key: "mc", label: "Massa do corpo (prancha, escada, viga, lança)", unit: "kg", min: 0, max: 300, step: 1, default: 10 },
    { key: "m1", label: "Massa 1 (criança, pessoa, carga)", unit: "kg", min: 0, max: 2000, step: 1, default: 30 },
    { key: "m2", label: "Massa 2", unit: "kg", min: 0, max: 2000, step: 1, default: 40 },
    { key: "x1", label: "Posição da massa 1 (desde a ponta esquerda/base)", unit: "m", min: 0, max: 8, step: 0.05, default: 0.5 },
    { key: "x2", label: "Posição da massa 2", unit: "m", min: 0, max: 8, step: 0.05, default: 3 },
    { key: "xa", label: "Pivô / apoio A", unit: "m", min: 0, max: 8, step: 0.05, default: 2 },
    { key: "xb", label: "Apoio B (viga)", unit: "m", min: 0, max: 8, step: 0.05, default: 3 },
    { key: "ang", label: "Ângulo (escada com o chão, lança com a horizontal)", unit: "°", min: 5, max: 85, step: 1, default: 60 },
    { key: "mu", label: "Atrito estático no chão μ", unit: "", min: 0, max: 1.2, step: 0.01, default: 0.4 },
    { key: "H", label: "Altura do cabo no mastro", unit: "m", min: 0.2, max: 10, step: 0.1, default: 4 },
    { key: "Tmax", label: "Resistência do cabo", unit: "kN", min: 1, max: 100, step: 1, default: 30 },
    {
      key: "dcl",
      label: "Desenho",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      live: true,
      options: [
        { value: 0, label: "Cena com forças" },
        { value: 1, label: "Diagrama de corpo livre (corpo isolado)" },
      ],
    },
  ],

  observables: [
    { key: "R1", label: "Reação 1 (pivô, chão, apoio A, articulação, A_y)", unit: "N", value: (s, p) => fin(solve(s, p).R1) },
    { key: "R2", label: "Reação 2 (chão da gangorra, parede, apoio B, R_y, C_y)", unit: "N", value: (s, p) => fin(solve(s, p).R2) },
    { key: "F", label: "Atrito necessário / tensão / maior força em barra", unit: "N", value: (s, p) => fin(solve(s, p).F) },
    { key: "muMin", label: "Atrito mínimo μ_min (escada)", unit: "", value: (s, p) => fin(solve(s, p).muMin) },
    { key: "tau", label: "Torque das cargas no pivô (gangorra)", unit: "N·m", value: (s, p) => fin(solve(s, p).tau) },
    { key: "ok", label: "Equilíbrio possível (1 = sim)", unit: "", value: (s, p) => (solve(s, p).ok ? 1 : 0) },
  ],
  chart: { x: "t", y: "R1" },

  scenarios: [
    {
      id: "escada",
      label: "Escada: até onde dá para subir?",
      params: { modo: 1, L: 5, mc: 15, m1: 70, x1: 1.5, ang: 60, mu: 0.3 },
      guide: `### Escada apoiada numa parede lisa
1. A parede lisa só empurra na horizontal ($N_p$); quem equilibra $N_p$ é o **atrito** no pé da escada.
2. Arraste a pessoa escada acima e acompanhe $\\mu_{\\min}$: o torque do peso em torno do pé cresce e a parede precisa empurrar mais.
3. Quando $\\mu_{\\min}$ passa de $\\mu$, aparece o aviso: a escada escorrega. Leia $d_{\\max}$ nas equações vivas.
4. Arraste o topo da escada para deixá-la mais em pé (ângulo maior) e repita. Por que escadas devem ficar íngremes?`,
      predict: [
        {
          question: "À medida que a pessoa sobe a escada, o atrito necessário no pé da escada:",
          options: ["diminui", "não muda, pois o peso total é o mesmo", "aumenta"],
          answer: 2,
          explanation:
            "Somando torques em torno do pé: $N_p L\\sin\\theta = (P_e L/2 + P d)\\cos\\theta$. Com $d$ maior, $N_p$ cresce, e o atrito tem de ser igual a $N_p$. Já a normal do chão continua $P_e + P$.",
        },
      ],
    },
    {
      id: "viga",
      label: "Viga com balanço",
      params: { modo: 2, L: 6, mc: 30, m1: 100, m2: 80, x1: 1.5, x2: 5.8, xa: 0.5, xb: 4.5 },
      guide: `### Reações de apoio e momento fletor
1. A viga tem um apoio fixo (A, triângulo) e um móvel (B, rolete). Escreva $\\sum F_y = 0$ e $\\sum\\tau_A = 0$ e confira $R_A$ e $R_B$.
2. Arraste a massa 2 para a ponta do **balanço** à direita, ou o apoio B para a esquerda: $R_A$ diminui até ficar negativa.
3. Um apoio simples não puxa: com $R_A < 0$ o equilíbrio é **impossível** e a viga tomba sobre B.
4. Embaixo, o diagrama de momento fletor $M(x)$, desenhado do lado tracionado. Onde a viga é mais solicitada?`,
      predict: [
        {
          question: "Uma viga sem peso de 4 m, apoiada nas pontas, recebe 1000 N a 1 m do apoio A. Quanto vale R_A?",
          options: ["250 N", "500 N", "750 N", "1000 N"],
          answer: 2,
          explanation: "Torques em torno de A: $R_B\\cdot 4 = 1000\\cdot 1$, logo $R_B = 250$ N e $R_A = 1000 - 250 = 750$ N. O apoio mais próximo da carga recebe mais.",
        },
      ],
    },
    {
      id: "guindaste",
      label: "Guindaste: tensão no cabo",
      params: { modo: 3, L: 6, mc: 200, m1: 500, x1: 6, ang: 30, H: 4, Tmax: 30 },
      guide: `### Lança articulada e cabo
1. A lança é articulada na base do mastro e sustentada por um cabo que vai da ponta até o mastro, à altura $H$.
2. Arraste a **ponta** para baixar a lança: o braço do peso ($d\\cos\\alpha$) aumenta e o do cabo diminui. A tensão dispara.
3. Arraste o **ponto de fixação** do cabo no mastro: cabo mais alto tem braço maior e precisa de menos tensão.
4. Aumente a carga até passar da resistência do cabo e veja o aviso.`,
      predict: [
        {
          question: "Abaixando a lança de 45° para 15° (mesma carga na ponta e mesmo ponto do cabo), a tensão no cabo:",
          options: ["diminui", "fica igual", "aumenta"],
          answer: 2,
          explanation: "O torque do peso, $P\\,L\\cos\\alpha$, aumenta quando a lança abaixa, e o cabo, mais alinhado com ela, tem braço de alavanca menor. As duas coisas aumentam $T$.",
        },
      ],
    },
    {
      id: "trelica",
      label: "Treliça pelo método dos nós",
      params: { modo: 4, L: 6, m1: 1000, m2: 0, x1: 3, x2: 0 },
      guide: `### Barras tracionadas e comprimidas
1. Cada nó é um ponto em equilíbrio: $\\sum F_x = 0$ e $\\sum F_y = 0$. Com 5 nós há 10 equações para 7 barras e 3 reações.
2. **Vermelho**: barra tracionada (puxa os nós); **azul**: comprimida (empurra). A espessura é proporcional à força.
3. Arraste a carga para outro nó (ela gruda no nó mais próximo). Qual barra fica com força nula quando a carga está sobre um apoio?
4. Confira no nó A: $A_y + F_{AD}\\sin 60^\\circ = 0$.`,
    },
  ],

  exercises: [
    {
      id: "escada",
      prompt:
        "Uma escada uniforme de {L} m e {mc} kg está apoiada numa parede lisa, formando {ang}° com o chão. Uma pessoa de {m1} kg está no topo. Qual o coeficiente de atrito estático mínimo entre a escada e o chão?",
      vary: { L: [3, 6, 1], mc: [10, 25, 0], ang: [50, 75, 0], m1: [50, 95, 0] },
      fixed: { modo: 1, x1: 100 },
      answer: { label: "μ_min", unit: "", compute: (p) => solve(initState(p), p).muMin },
      hint: "Torques em torno do pé: N_parede L sen θ = (P_escada L/2 + P_pessoa L) cos θ. O atrito equilibra N_parede.",
    },
    {
      id: "viga",
      prompt:
        "Uma viga de massa desprezível com {L} m está apoiada nas duas pontas. Uma carga de {m1} kg está a {x1} m do apoio esquerdo (g = 9,81 m/s²). Qual é a reação no apoio direito?",
      vary: { L: [4, 8, 1], m1: [100, 900, 0], x1: [0.5, 3.5, 1] },
      fixed: { modo: 2, mc: 0, m2: 0, xa: 0, xb: 100 },
      answer: { label: "R_B", unit: "N", compute: (p) => solve(initState(p), p).R2 },
    },
    {
      id: "guindaste",
      prompt:
        "A lança de um guindaste, de massa desprezível e {L} m, faz {ang}° com a horizontal e sustenta {m1} kg na ponta. O cabo vai da ponta da lança até o mastro, {H} m acima da articulação (g = 9,81 m/s²). Qual é a tensão no cabo?",
      vary: { L: [3, 6, 1], ang: [20, 45, 0], m1: [100, 800, 0], H: [3, 6, 1] },
      fixed: { modo: 3, mc: 0, x1: 100 },
      answer: { label: "T", unit: "N", compute: (p) => solve(initState(p), p).F },
      hint: "Torques em torno da articulação: T · (braço do cabo) = P · L cos α.",
    },
  ],

  init: (p) => initState(p),
  step: (s) => s,
  static: true,

  viewport: (p, s) => viewportOf(p, s),

  pointer: {
    down(s, p, pt) {
      const k = pick(s, p, pt);
      return k ? { ...s, drag: { kind: k } } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || !s.drag) return undefined;
      return { ...dragTo(s, p, s.drag.kind, pt), drag: s.drag };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (s, p, pt) => (pick(s, p, pt) ? "grab" : undefined),
  },
  actions: [
    {
      id: "equilibrar",
      label: "Equilibrar (gangorra: mover massa 2)",
      run: (s, p) => {
        const eq = solve(s, p).x2eq;
        return modeOf(p) === 0 && Number.isFinite(eq) && eq >= 0 && eq <= lenOf(p) ? { ...s, x2: eq } : s;
      },
    },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const L = lenOf(p);
    const mode = modeOf(p);
    const r = solve(s, p);
    const vp = viewportOf(p, s);
    const env = num(p, "dcl") > 0.5 ? 0.12 : 1;
    const body = theme.series[5]!;
    const colors: Record<Force["kind"], string> = { peso: theme.series[0]!, reacao: theme.series[2]!, atrito: theme.series[3]!, tensao: theme.series[4]! };
    const block = (x: number, y: number, m: number, color: string, label: string) => {
      const a = 0.12 + 0.1 * Math.cbrt(Math.max(m, 1) / 50);
      d.rect(x - a, y, 2 * a, 2 * a, { fill: color, stroke: theme.text, width: 1, alpha: 0.9 });
      d.text(label, x, y + a, { color: theme.dark ? "#10151c" : "#ffffff", size: 11, weight: "600" });
    };
    const ground = (x0: number, x1: number, y = 0) => {
      d.rect(x0, y - 0.25, x1 - x0, 0.25, { fill: theme.ground, alpha: env });
      d.line(x0, y, x1, y, { color: theme.muted, alpha: env });
    };

    if (mode === 0) {
      ground(vp.xMin, vp.xMax);
      // pivô triangular
      d.polyline([[s.xa - 0.3, 0], [s.xa + 0.3, 0], [s.xa, PIVOT_H]], { close: true, fill: theme.muted, color: theme.text, alpha: env });
      const a = seesawPoint(s, r.tilt, 0), b = seesawPoint(s, r.tilt, L);
      d.line(a[0], a[1], b[0], b[1], { color: body, width: 9 });
      const m1 = num(p, "m1"), m2 = num(p, "m2");
      const ang = r.tilt;
      const put = (u: number, m: number, color: string, label: string) => {
        if (m <= 0) return;
        const [x, y] = seesawPoint(s, ang, u);
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(ang);
        block(0, 0.04, m, color, label);
        ctx.restore();
      };
      put(s.x1, m1, theme.series[0]!, "1");
      put(s.x2, m2, theme.series[1]!, "2");
      if (Number.isFinite(r.x2eq) && r.x2eq >= 0 && r.x2eq <= L && !r.ok) {
        const [x, y] = seesawPoint(s, ang, r.x2eq);
        d.line(x, y, x, y + 0.55, { color: theme.series[1]!, dash: [4, 3] });
        d.text("equilíbrio da massa 2", x, y + 0.65, { color: theme.series[1]!, size: 11 });
      }
    } else if (mode === 1) {
      ground(vp.xMin, 0.2);
      d.rect(0, -0.25, 0.4, L + 0.6, { fill: theme.ground, alpha: env });
      d.line(0, 0, 0, L + 0.5, { color: theme.muted, alpha: env, width: 2 });
      const foot = ladderPoint(s, L, 0), top = ladderPoint(s, L, L);
      const nx = -Math.sin(s.ang) * 0.18, ny = Math.cos(s.ang) * 0.18;
      d.line(foot[0] + nx, foot[1] + ny, top[0] + nx, top[1] + ny, { color: body, width: 4 });
      d.line(foot[0] - nx, foot[1] - ny, top[0] - nx, top[1] - ny, { color: body, width: 4 });
      for (let u = 0.4; u < L; u += 0.4) {
        const q = ladderPoint(s, L, u);
        d.line(q[0] + nx, q[1] + ny, q[0] - nx, q[1] - ny, { color: body, width: 2 });
      }
      const pp = ladderPoint(s, L, clamp(s.x1, 0, L));
      if (num(p, "m1") > 0) {
        d.circle(pp[0], pp[1] + 0.55, 0.12, { fill: theme.series[0]! });
        d.line(pp[0], pp[1] + 0.43, pp[0], pp[1] + 0.1, { color: theme.series[0]!, width: 4 });
      }
      // ângulo
      const arc: [number, number][] = [];
      for (let i = 0; i <= 20; i++) arc.push([foot[0] + 0.6 * Math.cos((s.ang * i) / 20), 0.6 * Math.sin((s.ang * i) / 20)]);
      d.polyline(arc, { color: theme.muted, width: 1 });
      d.text(`${Math.round((s.ang * 180) / Math.PI)}°`, foot[0] + 0.85, 0.22, { color: theme.muted, size: 11 });
      if (Number.isFinite(r.climbMax) && r.climbMax > 0 && r.climbMax < L) {
        const q = ladderPoint(s, L, r.climbMax);
        d.dot(q[0], q[1], 5, theme.positive);
        d.text("d_max", q[0] - 0.35, q[1], { color: theme.positive, size: 11 });
      }
    } else if (mode === 2) {
      // apoios
      const tri = (x: number) => d.polyline([[x - 0.18, BEAM_Y - 0.38], [x + 0.18, BEAM_Y - 0.38], [x, BEAM_Y - 0.08]], { close: true, fill: theme.muted, color: theme.text, alpha: env });
      tri(s.xa);
      d.text("A", s.xa, BEAM_Y - 0.5, { color: theme.muted, size: 11 });
      d.circle(s.xb, BEAM_Y - 0.22, 0.13, { fill: theme.muted, stroke: theme.text, width: 1, alpha: env });
      d.text("B", s.xb, BEAM_Y - 0.5, { color: theme.muted, size: 11 });
      d.rect(-0.1, BEAM_Y - 0.08, L + 0.2, 0.16, { fill: body, stroke: theme.text, width: 1 });
      block(s.x1, BEAM_Y + 0.08, num(p, "m1"), theme.series[0]!, "1");
      block(s.x2, BEAM_Y + 0.08, num(p, "m2"), theme.series[1]!, "2");
      // Diagrama de momento fletor (desenhado do lado tracionado: positivo para baixo)
      const pts = [...beamLoads(s, p), { x: s.xa, F: r.R1, label: "" }, { x: s.xb, F: r.R2, label: "" }];
      const k = L / 4;
      const y0 = -1.35 * k;
      const N = 240;
      const M = Array.from({ length: N + 1 }, (_, i) => bendingMoment(pts, (L * i) / N));
      const Mmax = Math.max(...M.map(Math.abs), 1e-9);
      const sc = (0.65 * k) / Mmax;
      d.line(0, y0, L, y0, { color: theme.muted, width: 1 });
      d.polyline(
        [[0, y0], ...M.map((m, i) => [(L * i) / N, y0 - m * sc] as [number, number]), [L, y0]],
        { color: theme.accent, fill: theme.accent, alpha: 0.25, close: true },
      );
      d.polyline(M.map((m, i) => [(L * i) / N, y0 - m * sc] as [number, number]), { color: theme.accent, width: 2 });
      const iMax = M.reduce((bi, m, i) => (Math.abs(m) > Math.abs(M[bi]!) ? i : bi), 0);
      d.text(`|M|máx = ${fmt(Mmax, 0)} N·m em x = ${fmt((L * iMax) / N, 2)} m`, L / 2, y0 - 0.85 * k, { color: theme.accent, size: 11 });
      d.text("momento fletor M(x) (lado tracionado)", 0, y0 + 0.2, { color: theme.muted, size: 11, align: "left" });
    } else if (mode === 3) {
      const { tip, C } = craneGeometry(s, p);
      ground(vp.xMin, vp.xMax);
      const mastTop = Math.max(C[1], tip[1] * 0.5) + 0.3;
      d.rect(-0.6, -0.25, 1.2, 0.25, { fill: theme.muted, alpha: env });
      d.line(-0.12, 0, -0.12, mastTop, { color: theme.muted, width: 6, alpha: env });
      d.line(0, 0, tip[0], tip[1], { color: body, width: 8 });
      d.line(tip[0], tip[1], C[0], C[1], { color: theme.text, width: 1.5 });
      d.dot(0, 0, 5, theme.text);
      d.dot(C[0], C[1], 4, theme.text);
      const dd = clamp(s.x1, 0, L);
      const hp: [number, number] = [dd * Math.cos(s.ang), dd * Math.sin(s.ang)];
      d.line(hp[0], hp[1], hp[0], hp[1] - 0.55, { color: theme.text, width: 1 });
      if (num(p, "m1") > 0) block(hp[0], hp[1] - 1.0, num(p, "m1"), theme.series[0]!, "1");
      d.text(`${Math.round((s.ang * 180) / Math.PI)}°`, 0.9 * Math.cos(s.ang / 2), 0.9 * Math.sin(s.ang / 2), { color: theme.muted, size: 11 });
      d.text(`H = ${fmt(C[1], 1)} m`, -0.25, C[1], { color: theme.muted, size: 11, align: "right" });
    } else {
      const nodes = trussNodes(p);
      ground(vp.xMin, vp.xMax, -0.35 * (L / 4));
      const hs = 0.35 * (L / 4);
      d.polyline([[-0.2 * (L / 4), -hs], [0.2 * (L / 4), -hs], [0, 0]], { close: true, fill: theme.muted, color: theme.text, alpha: env });
      d.circle(L, -hs / 2, hs / 2, { fill: theme.muted, stroke: theme.text, width: 1, alpha: env });
      const Fm = Math.max(...r.bars.map(Math.abs), 1e-9);
      TRUSS_BARS.forEach(([i, j], k) => {
        const F = r.bars[k] ?? 0;
        const a = nodes[i]!, b = nodes[j]!;
        const zero = Math.abs(F) < 1e-6 * Math.max(Fm, 1);
        d.line(a[0], a[1], b[0], b[1], { color: zero ? theme.muted : F > 0 ? theme.positive : theme.negative, width: zero ? 1.5 : 2 + 7 * (Math.abs(F) / Fm), dash: zero ? [4, 4] : undefined });
        const mx = (a[0] + b[0]) / 2, my = (a[1] + b[1]) / 2;
        d.text(zero ? "0" : `${fmtN(Math.abs(F))} ${F > 0 ? "T" : "C"}`, mx, my, { color: theme.text, size: 11, dy: -9 });
      });
      nodes.forEach((q, i) => {
        d.circle(q[0], q[1], 0.05, { fill: theme.text, minPx: 4 });
        d.text(NODE_NAMES[i]!, q[0], q[1], { color: theme.muted, size: 12, dx: i < 3 ? -12 : 0, dy: i < 3 ? 12 : -14 });
      });
    }

    // Forças (DCL)
    const Fmax = Math.max(...r.forces.map((f) => Math.hypot(f.fx, f.fy)), 1e-9);
    for (const f of r.forces) {
      const mag = Math.hypot(f.fx, f.fy);
      if (mag < 1e-9) continue;
      const lenPx = 28 + 80 * (mag / Fmax);
      const ux = f.fx / mag, uy = f.fy / mag;
      const Lw = lenPx * d.px;
      const color = colors[f.kind];
      if (f.head) {
        d.arrow(f.x - ux * Lw, f.y - uy * Lw, ux * Lw, uy * Lw, { color, width: 2.5 });
        d.text(f.label, f.x - ux * Lw, f.y - uy * Lw, { color, size: 11, dy: uy > 0.5 ? 10 : uy < -0.5 ? -10 : 0, dx: Math.abs(uy) <= 0.5 ? -ux * 40 : 0 });
      } else {
        d.arrow(f.x, f.y, ux * Lw, uy * Lw, { color, width: 2.5 });
        d.text(f.label, f.x + ux * Lw, f.y + uy * Lw, { color, size: 11, dy: uy < -0.5 ? 10 : uy > 0.5 ? -10 : 0, dx: Math.abs(uy) <= 0.5 ? ux * 40 : 0 });
      }
    }

    // Verificação numérica: soma das forças e dos torques em torno da origem
    let Sx = 0, Sy = 0, St = 0;
    for (const f of r.forces) {
      Sx += f.fx;
      Sy += f.fy;
      St += f.x * f.fy - f.y * f.fx;
    }
    const x0 = vp.xMin + 0.03 * (vp.xMax - vp.xMin);
    const y0 = vp.yMax - 0.05 * (vp.yMax - vp.yMin);
    const dy = 0.055 * (vp.yMax - vp.yMin);
    let line = 0;
    const say = (str: string, color = theme.text, weight = "400") => d.text(str, x0, y0 - dy * line++, { color, size: 12, align: "left", weight });
    say(r.ok ? "Em equilíbrio" : "Fora de equilíbrio", r.ok ? theme.series[2]! : theme.positive, "700");
    for (const m of r.msgs) say(m, theme.positive);
    const clean = (v: number) => (Math.abs(v) < 1e-6 * Math.max(1, Fmax) ? 0 : v);
    say(`ΣFx = ${fmt(clean(Sx), 1)} N   ΣFy = ${fmt(clean(Sy), 1)} N   Στ = ${fmt(clean(St), 1)} N·m`, theme.muted);
    if (mode === 1) say(`μ mínimo = ${fmt(r.muMin, 3)}   (μ do chão = ${fmt(num(p, "mu", 0.4), 2)})`, theme.muted);
    say(`g = ${fmt(G, 2)} m/s² · arraste as massas, os apoios e as pontas`, theme.muted);
  },
});

export default equilibrioCorpos;
