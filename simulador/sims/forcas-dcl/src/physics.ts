import { num, rad, type Params } from "@fisilab/core";

export const G = 9.81;

/** Tipos de força que o aluno pode colocar no diagrama. */
export type Kind = "P" | "N" | "T" | "f" | "F";

export const KIND_NAME: Record<Kind, string> = {
  P: "Peso",
  N: "Normal",
  T: "Tração",
  f: "Atrito",
  F: "Aplicada",
};

/** Índice em theme.series de cada tipo de força. */
export const KIND_COLOR: Record<Kind, number> = { P: 0, N: 2, T: 1, f: 3, F: 4 };

export interface Force {
  kind: Kind;
  /** Componentes em newtons (x para a direita, y para cima). */
  fx: number;
  fy: number;
}

export interface Expected {
  forces: Force[];
  /** Aceleração real do corpo no referencial do chão, m/s². */
  a: [number, number];
  /** Desenho no referencial da cabine (elevador) ou do chão. */
  cabinFrame: boolean;
  /** Descrição curta do estado físico (desliza, em repouso...). */
  note: string;
}

export const situationOf = (p: Params) => Math.round(num(p, "situacao"));

/** Forças corretas e aceleração para a situação e os parâmetros dados. */
export function expected(p: Params): Expected {
  const sit = situationOf(p);
  const m = num(p, "m", 2);
  const mg = m * G;
  const th = rad(num(p, "ang", 30));
  const mu = num(p, "mu", 0.3);

  if (sit === 1) {
    const th2 = rad(num(p, "ang2", 50));
    const s = Math.sin(th + th2);
    const T1 = (mg * Math.cos(th2)) / s;
    const T2 = (mg * Math.cos(th)) / s;
    return {
      forces: [
        { kind: "P", fx: 0, fy: -mg },
        { kind: "T", fx: -T1 * Math.cos(th), fy: T1 * Math.sin(th) },
        { kind: "T", fx: T2 * Math.cos(th2), fy: T2 * Math.sin(th2) },
      ],
      a: [0, 0],
      cabinFrame: false,
      note: "em equilíbrio",
    };
  }

  if (sit === 2) {
    const ae = num(p, "ae", 2);
    const N = m * (G + ae);
    return {
      forces: [
        { kind: "P", fx: 0, fy: -mg },
        { kind: "N", fx: 0, fy: N },
      ],
      a: [0, ae],
      cabinFrame: true,
      note: ae > 0 ? "acelerando para cima" : ae < 0 ? "acelerando para baixo" : "com velocidade constante",
    };
  }

  if (sit === 3) {
    // Rampa subindo para a direita; "descendo" = (−cos θ, −sen θ).
    const N = mg * Math.cos(th);
    const drive = mg * Math.sin(th);
    const sliding = drive > mu * N + 1e-9;
    const f = sliding ? mu * N : drive;
    const forces: Force[] = [
      { kind: "P", fx: 0, fy: -mg },
      { kind: "N", fx: -N * Math.sin(th), fy: N * Math.cos(th) },
    ];
    if (f > 0.05) forces.push({ kind: "f", fx: f * Math.cos(th), fy: f * Math.sin(th) });
    const aAlong = sliding ? (drive - mu * N) / m : 0;
    return {
      forces,
      a: [-aAlong * Math.cos(th), -aAlong * Math.sin(th)],
      cabinFrame: false,
      note: sliding ? "deslizando rampa abaixo" : "parado (atrito estático)",
    };
  }

  // 0: bloco na mesa puxado por corda inclinada θ acima da horizontal
  const F = num(p, "F", 12);
  const Tx = F * Math.cos(th), Ty = F * Math.sin(th);
  const N = mg - Ty;
  const forces: Force[] = [{ kind: "P", fx: 0, fy: -mg }];
  if (F > 0.05) forces.push({ kind: "T", fx: Tx, fy: Ty });
  if (N <= 0) {
    return { forces, a: [Tx / m, (Ty - mg) / m], cabinFrame: false, note: "a corda levanta o bloco" };
  }
  forces.push({ kind: "N", fx: 0, fy: N });
  const sliding = Tx > mu * N + 1e-9;
  const f = sliding ? mu * N : Tx;
  if (f > 0.05) forces.push({ kind: "f", fx: -f, fy: 0 });
  return {
    forces,
    a: [sliding ? (Tx - mu * N) / m : 0, 0],
    cabinFrame: false,
    note: sliding ? "deslizando para a direita" : "parado (atrito estático)",
  };
}

export const sum = (fs: Force[]): [number, number] => fs.reduce<[number, number]>((acc, f) => [acc[0] + f.fx, acc[1] + f.fy], [0, 0]);
export const mag = (f: { fx: number; fy: number }) => Math.hypot(f.fx, f.fy);

/** Diferença angular em graus (0 a 180). */
export function angleBetween(a: Force, b: Force): number {
  const ma = mag(a), mb = mag(b);
  if (ma < 1e-9 || mb < 1e-9) return 180;
  const c = (a.fx * b.fx + a.fy * b.fy) / (ma * mb);
  return (Math.acos(Math.max(-1, Math.min(1, c))) * 180) / Math.PI;
}

export const ANGLE_TOL = 10; // graus
export const MAG_TOL = 0.15; // relativa
export const MAG_TOL_ABS = 1; // N

export interface CheckLine {
  text: string;
  good: boolean;
}

export interface CheckResult {
  ok: boolean;
  /** Estado de cada força do aluno, na ordem do DCL. */
  status: ("ok" | "dir" | "mod" | "extra")[];
  matched: number;
  total: number;
  lines: CheckLine[];
}

const DIR_HINT: Record<Kind, string> = {
  P: "o peso é vertical, para baixo",
  N: "a normal é perpendicular à superfície e empurra o corpo",
  T: "a tração puxa o corpo ao longo do fio ou da corda",
  f: "o atrito é paralelo à superfície e se opõe ao deslizamento (ou à tendência de deslizar)",
  F: "não há força aplicada diretamente aqui",
};

const MISSING_HINT: Record<Kind, string> = {
  P: "Falta o peso: a Terra atrai todo corpo com massa.",
  N: "Falta a força que a superfície de apoio faz sobre o corpo.",
  T: "Falta a força de um fio ou de uma corda.",
  f: "Falta uma força de contato paralela à superfície.",
  F: "Falta uma força aplicada.",
};

const EXTRA_HINT: Record<Kind, string> = {
  P: "Peso a mais: o corpo tem um só peso.",
  N: "Normal a mais: que superfície está empurrando o corpo?",
  T: "Tração a mais: confira quantos fios ou cordas tocam o corpo.",
  f: "Atrito a mais: sem superfície ou sem tendência de deslizar, não há atrito.",
  F: "Força aplicada a mais: ninguém empurra o corpo diretamente; fios e cordas exercem tração.",
};

const fmtN = (v: number) => String(Number(v.toFixed(1))).replace(".", ",");

/** Compara o DCL do aluno com as forças corretas (direção e módulo, com tolerância). */
export function checkDCL(student: Force[], exp: Force[]): CheckResult {
  const status: CheckResult["status"] = student.map(() => "extra");
  const used = new Set<number>();
  const lines: CheckLine[] = [];
  let matched = 0;
  // Casa primeiro as forças com melhor concordância de direção.
  const pairs: { e: number; s: number; ang: number }[] = [];
  exp.forEach((e, ei) =>
    student.forEach((s, si) => {
      if (s.kind === e.kind) pairs.push({ e: ei, s: si, ang: angleBetween(s, e) });
    }),
  );
  pairs.sort((a, b) => a.ang - b.ang);
  const expMatch = new Map<number, number>();
  for (const pr of pairs) {
    if (expMatch.has(pr.e) || used.has(pr.s)) continue;
    expMatch.set(pr.e, pr.s);
    used.add(pr.s);
  }
  exp.forEach((e, ei) => {
    const si = expMatch.get(ei);
    const name = KIND_NAME[e.kind];
    if (si === undefined) {
      lines.push({ text: MISSING_HINT[e.kind], good: false });
      return;
    }
    const s = student[si]!;
    const ang = angleBetween(s, e);
    const me = mag(e), ms = mag(s);
    if (ang > ANGLE_TOL) {
      status[si] = "dir";
      lines.push({ text: `${name}: direção errada (${fmtN(ang)}° de desvio); ${DIR_HINT[e.kind]}.`, good: false });
    } else if (Math.abs(ms - me) > Math.max(MAG_TOL * me, MAG_TOL_ABS)) {
      status[si] = "mod";
      lines.push({ text: `${name}: direção certa, módulo ${ms > me ? "grande" : "pequeno"} demais.`, good: false });
    } else {
      status[si] = "ok";
      matched++;
    }
  });
  student.forEach((s, si) => {
    if (!used.has(si)) lines.push({ text: EXTRA_HINT[s.kind], good: false });
  });
  const ok = matched === exp.length && student.length === exp.length;
  if (ok) lines.unshift({ text: `DCL correto: ${exp.length} forças com direção e módulo certos.`, good: true });
  else lines.unshift({ text: `${matched} de ${exp.length} forças corretas.`, good: false });
  return { ok, status, matched, total: exp.length, lines };
}
