import { NodeMap, solveCircuit, type Element, type Params } from "@fisilab/core";

export type Kind = "fio" | "resistor" | "bateria" | "lampada" | "chave" | "amperimetro" | "voltimetro" | "capacitor" | "indutor" | "diodo";
export type Tool = Kind | "selecionar" | "apagar";

export type Pt = [number, number];

export interface Comp {
  id: number;
  kind: Kind;
  /** Terminal a (positivo da bateria, anodo do diodo). Pontos inteiros da grade. */
  a: Pt;
  b: Pt;
  /** Ω para resistor/lâmpada, V para bateria, F para capacitor, H para indutor. */
  value: number;
  /** Chave fechada? */
  closed?: boolean;
  /** Corrente de a → b, em A (resultado do último passo). */
  i: number;
  /** Tensão v(a) − v(b), em V. */
  v: number;
  /** Capacitor/indutor recém-inserido: o próximo passo usa Euler implícito. */
  fresh?: boolean;
  /** Fase da animação das cargas, em unidades da grade. */
  phase: number;
}

export interface CircuitState {
  comps: Comp[];
  tool: Tool;
  selected: number | null;
  drag: { from: Pt; to: Pt } | null;
  nextId: number;
  /** Aviso para o aluno (curto-circuito, laço de fontes). */
  warning: string;
}

export const WIRE_R = 1e-4;
export const VOLTMETER_R = 10e6;

export const DEFAULTS: Record<Kind, number> = {
  fio: 0,
  resistor: 100,
  bateria: 9,
  lampada: 12,
  chave: 0,
  amperimetro: 0,
  voltimetro: 0,
  capacitor: 1e-3,
  indutor: 1,
  diodo: 0,
};

const key = (p: Pt) => `${p[0]},${p[1]}`;

export function makeComp(id: number, kind: Kind, a: Pt, b: Pt, value = DEFAULTS[kind], closed = true): Comp {
  return { id, kind, a, b, value, closed: kind === "chave" ? closed : undefined, i: 0, v: 0, phase: 0, fresh: kind === "capacitor" || kind === "indutor" ? true : undefined };
}

/** Monta os elementos MNA a partir dos componentes e resolve um passo. */
export function solveStep(s: CircuitState, p: Params, dt: number, commit: boolean): CircuitState {
  const r = Math.max(1e-3, p.rInterna ?? 0.1);
  const nodes = new NodeMap();
  for (const c of s.comps) {
    nodes.add(key(c.a));
    nodes.add(key(c.b));
  }
  const battery = s.comps.find((c) => c.kind === "bateria");
  const { index, count } = nodes.number(battery ? key(battery.b) : s.comps[0] ? key(s.comps[0].a) : undefined);

  const els: (Element | null)[] = s.comps.map((c) => {
    const a = index(key(c.a));
    const b = index(key(c.b));
    switch (c.kind) {
      case "fio":
      case "amperimetro":
        return { kind: "R", a, b, R: WIRE_R };
      case "chave":
        return c.closed ? { kind: "R", a, b, R: WIRE_R } : null;
      case "resistor":
      case "lampada":
        return { kind: "R", a, b, R: c.value };
      case "voltimetro":
        return { kind: "R", a, b, R: VOLTMETER_R };
      case "bateria":
        return { kind: "V", a, b, V: c.value, R: r };
      case "capacitor":
        return { kind: "C", a, b, C: c.value, v0: c.v, i0: c.fresh ? undefined : c.i };
      case "indutor":
        return { kind: "L", a, b, L: c.value, i0: c.i, v0: c.fresh ? undefined : c.v };
      case "diodo":
        return { kind: "D", a, b };
    }
  });
  const active = els.filter((e): e is Element => e !== null);
  const sol = solveCircuit(count, active, dt);

  let k = 0;
  const comps = s.comps.map((c, idx) => {
    const e = els[idx];
    if (!e) {
      // Chave aberta: sem corrente; tensão entre os terminais ainda é medida.
      return { ...c, i: 0, v: sol.v[index(key(c.a))]! - sol.v[index(key(c.b))]! };
    }
    const i = sol.i[k]!;
    const v = sol.dv[k]!;
    k++;
    const next: Comp = { ...c, i, v };
    if (commit) {
      next.fresh = undefined;
      // Velocidade visual das cargas cresce com log da corrente, para correntes de µA a A ficarem visíveis.
      const speed = Math.sign(i) * Math.min(3, Math.log10(1 + Math.abs(i) * 1e4) * 0.6);
      next.phase = (c.phase + speed * dt) % 1;
    }
    return next;
  });

  let warning = "";
  if (sol.singular) warning = "Laço de fontes ideais: o circuito não tem solução.";
  else if (comps.some((c) => c.kind === "bateria" && Math.abs(c.i) > 5)) warning = "Curto-circuito! A bateria está fornecendo uma corrente enorme.";
  else if (comps.some((c) => c.kind === "amperimetro" && Math.abs(c.i) > 5)) warning = "O amperímetro foi ligado em paralelo e virou um curto.";

  return { ...s, comps, warning };
}

/** Distância de um ponto ao segmento de um componente. */
export function distToComp(c: Comp, x: number, y: number): number {
  const [ax, ay] = c.a;
  const [bx, by] = c.b;
  const dx = bx - ax;
  const dy = by - ay;
  const L2 = dx * dx + dy * dy || 1;
  const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
  return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}

export function sameSegment(c: Comp, a: Pt, b: Pt): boolean {
  const eq = (p: Pt, q: Pt) => p[0] === q[0] && p[1] === q[1];
  return (eq(c.a, a) && eq(c.b, b)) || (eq(c.a, b) && eq(c.b, a));
}

// Séries de valores para os botões de aumentar/diminuir.
const E6 = [1, 1.5, 2.2, 3.3, 4.7, 6.8];
const BATTERY = [1.5, 3, 4.5, 6, 9, 12, 24];

export function stepValue(kind: Kind, v: number, dir: 1 | -1): number {
  if (kind === "bateria") {
    const i = BATTERY.findIndex((x) => x >= v - 1e-9);
    const j = Math.max(0, Math.min(BATTERY.length - 1, (i < 0 ? BATTERY.length - 1 : i) + dir));
    return BATTERY[j]!;
  }
  const exp = Math.floor(Math.log10(v) + 1e-9);
  const mant = v / 10 ** exp;
  let idx = E6.findIndex((m) => Math.abs(m - mant) < 0.05);
  if (idx < 0) idx = 0;
  idx += dir;
  let e = exp;
  if (idx >= E6.length) {
    idx = 0;
    e++;
  }
  if (idx < 0) {
    idx = E6.length - 1;
    e--;
  }
  const next = Number((E6[idx]! * 10 ** e).toPrecision(3));
  const [lo, hi] = kind === "capacitor" ? [1e-9, 1] : kind === "indutor" ? [1e-6, 100] : [0.1, 1e7];
  return Math.min(hi, Math.max(lo, next));
}

/** Formata com prefixo SI: 4700 Ω → "4,7 kΩ". */
export function si(v: number, unit: string): string {
  if (v === 0) return `0 ${unit}`;
  const prefixes: [number, string][] = [
    [1e6, "M"],
    [1e3, "k"],
    [1, ""],
    [1e-3, "m"],
    [1e-6, "µ"],
    [1e-9, "n"],
  ];
  const a = Math.abs(v);
  const [f, pre] = prefixes.find(([f]) => a >= f * 0.999) ?? prefixes[prefixes.length - 1]!;
  return `${Number((v / f).toPrecision(3)).toString().replace(".", ",")} ${pre}${unit}`;
}
