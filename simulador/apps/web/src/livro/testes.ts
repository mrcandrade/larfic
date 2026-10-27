/**
 * Testes rápidos de conceito: uma ou mais perguntas de múltipla escolha ao fim de cada seção,
 * para o aluno conferir se entendeu antes de seguir. Texto original (não copiar o livro).
 * Cada capítulo fica em ./testes/capNN.ts e exporta `export const testes: ChapterChecks`.
 */

export interface QuickCheck {
  /** Pergunta, em uma linha (aceita $tex$, **negrito** e *itálico*). */
  q: string;
  /** De 3 a 5 alternativas, uma linha cada. */
  options: string[];
  /** Índice da alternativa correta. */
  answer: number;
  /** Por que a correta está certa (e, se ajudar, onde as outras erram). Uma ou duas frases. */
  why: string;
}

export interface ChapterChecks {
  n: number;
  /** Pelo id da seção ("2-7"). */
  sections: Record<string, QuickCheck[]>;
}

/** Chave de uma pergunta: "seção#índice". */
export const checkKey = (sectionId: string, i: number) => `${sectionId}#${i}`;

/** Alternativas que são números ou medidas ("3 m/s", "$4\\pi$ rad/s") ficam na ordem em que foram escritas. */
const numeric = (o: string) => /^[−\-+]?\$?[\d,.\\{}^ ×\-−+a-z()/]*\$?\s*[a-zA-Zμ°²³/·%]*$/.test(o.trim()) && /\d/.test(o);

function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/**
 * Posição da alternativa correta sorteada (de forma fixa, pelo id) para não ficar sempre no mesmo
 * lugar em que o autor a escreveu. As demais mantêm a ordem relativa; listas numéricas não mudam.
 */
export function arrange(c: QuickCheck, key: string): QuickCheck {
  if (c.options.every(numeric)) return c;
  const target = hash(key) % c.options.length;
  const others = c.options.filter((_, i) => i !== c.answer);
  others.splice(target, 0, c.options[c.answer]!);
  return { ...c, options: others, answer: target };
}

const loaded: Record<number, ChapterChecks> = Object.fromEntries(
  Object.values(import.meta.glob<{ testes: ChapterChecks }>("./testes/cap*.ts", { eager: true })).map((m) => [m.testes.n, m.testes]),
);

/** Testes de cada capítulo, já com as alternativas na ordem em que aparecem na página. */
export const chapterChecks: Record<number, ChapterChecks> = Object.fromEntries(
  Object.entries(loaded).map(([n, ch]) => [
    n,
    { n: ch.n, sections: Object.fromEntries(Object.entries(ch.sections).map(([id, list]) => [id, list.map((c, i) => arrange(c, checkKey(id, i)))])) },
  ]),
);

export const sectionChecks = (n: number, sectionId: string): QuickCheck[] => chapterChecks[n]?.sections[sectionId] ?? [];

// ------------------------------------------------------------------ progresso (só neste navegador)

const KEY = "fisilab:testes";

/** Respostas certas já dadas, por chave "seção#pergunta". */
export function loadChecks(): Record<string, boolean> {
  try {
    return JSON.parse(localStorage.getItem(KEY) ?? "{}") as Record<string, boolean>;
  } catch {
    return {};
  }
}

export function saveCheck(key: string, right: boolean): void {
  try {
    const all = loadChecks();
    all[key] = right;
    localStorage.setItem(KEY, JSON.stringify(all));
  } catch {
    // Sem armazenamento (aba privada): o teste funciona, só não lembra.
  }
}

