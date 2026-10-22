// Modo desafio no app: as definições e a avaliação ficam em challenge-core.ts (código puro, que a
// Edge Function `desafio` também usa); aqui ficam o histórico local, os perfis e o ranking do aparelho.
import { findChallenge } from "./challenge-core.ts";

export * from "./challenge-core.ts";

// ------------------------------------------------------------------ histórico e ranking local

export interface ChallengeRecord {
  best: number;
  stars: number;
  attempts: number;
  /** Segundos da melhor tentativa. */
  seconds: number;
  at: string;
}

export interface LogEntry {
  profile: string;
  id: string;
  points: number;
  stars: number;
  at: string;
}

export interface Book {
  v: 1;
  current: string;
  profiles: Record<string, Record<string, ChallengeRecord>>;
  log: LogEntry[];
}

export const BOOK_KEY = "fisilab.desafios.v1";
export const emptyBook = (name = "Eu"): Book => ({ v: 1, current: name, profiles: { [name]: {} }, log: [] });

export function loadBook(storage: Pick<Storage, "getItem"> | undefined = globalThis.localStorage, fallbackName = "Eu"): Book {
  try {
    const b = JSON.parse(storage?.getItem(BOOK_KEY) ?? "null") as Book | null;
    if (b && b.v === 1 && b.profiles && typeof b.current === "string") {
      b.profiles[b.current] ??= {};
      b.log ??= [];
      return b;
    }
  } catch {
    /* histórico ilegível: recomeça */
  }
  return emptyBook(fallbackName);
}

export function saveBook(b: Book, storage: Pick<Storage, "setItem"> | undefined = globalThis.localStorage) {
  try {
    storage?.setItem(BOOK_KEY, JSON.stringify(b));
  } catch {
    /* sem armazenamento: o histórico só vale nesta sessão */
  }
}

/** Número da próxima tentativa deste perfil no desafio. */
export const nextAttempt = (b: Book, id: string) => (b.profiles[b.current]?.[id]?.attempts ?? 0) + 1;

/** Registra uma tentativa avaliada; guarda a melhor pontuação. */
export function recordAttempt(b: Book, id: string, r: { points: number; stars: number; seconds: number }, now = new Date()): Book {
  const name = b.current;
  const mine = { ...(b.profiles[name] ?? {}) };
  const prev = mine[id];
  const attempts = (prev?.attempts ?? 0) + 1;
  const better = !prev || r.points > prev.best || (r.points === prev.best && r.stars > prev.stars);
  mine[id] = better ? { best: r.points, stars: r.stars, attempts, seconds: Math.round(r.seconds), at: now.toISOString() } : { ...prev, attempts };
  const log = [...b.log, { profile: name, id, points: r.points, stars: r.stars, at: now.toISOString() }].slice(-300);
  return { ...b, profiles: { ...b.profiles, [name]: mine }, log };
}

export function switchProfile(b: Book, name: string): Book {
  const n = name.trim().slice(0, 40);
  if (!n) return b;
  return { ...b, current: n, profiles: { ...b.profiles, [n]: b.profiles[n] ?? {} } };
}

export function removeProfile(b: Book, name: string): Book {
  const profiles = { ...b.profiles };
  delete profiles[name];
  const names = Object.keys(profiles);
  if (!names.length) return emptyBook();
  return { ...b, profiles, current: b.current === name ? names[0]! : b.current, log: b.log.filter((e) => e.profile !== name) };
}

export interface RankRow {
  name: string;
  points: number;
  stars: number;
  done: number;
}

export function profileTotals(recs: Record<string, ChallengeRecord> = {}): Omit<RankRow, "name"> {
  const rs = Object.entries(recs).filter(([id]) => findChallenge(id));
  return {
    points: rs.reduce((a, [, r]) => a + r.best, 0),
    stars: rs.reduce((a, [, r]) => a + r.stars, 0),
    done: rs.filter(([, r]) => r.stars > 0).length,
  };
}

export function localRanking(b: Book): RankRow[] {
  return Object.entries(b.profiles)
    .map(([name, recs]) => ({ name, ...profileTotals(recs) }))
    .sort((x, y) => y.points - x.points || y.stars - x.stars || x.name.localeCompare(y.name, "pt-BR"));
}
