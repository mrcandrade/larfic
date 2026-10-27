/**
 * Conteúdo dos capítulos: explicação de cada seção e os experimentos ligados a ela.
 * Cada capítulo fica em ./capitulos/capNN.ts (NN com dois dígitos) e exporta
 * `export const capitulo: ChapterContent`.
 */

/** Experimento ligado a uma seção. */
export type ExperimentRef =
  /** Simulação do catálogo, opcionalmente num cenário e com parâmetros. */
  | { kind: "sim"; id: string; scenario?: string; params?: Record<string, number>; note: string }
  /** Prática de bancada (practices.ts ou practices-extra). */
  | { kind: "pratica"; id: string; note: string }
  /** Concepção alternativa (concepts.ts). */
  | { kind: "concepcao"; id: string; note?: string }
  /** Desafio (challenge-core.ts). */
  | { kind: "desafio"; id: string; note?: string };

export interface SectionContent {
  /**
   * Explicação original (não copiar o livro), em Markdown com a sintaxe dos
   * roteiros: ### títulos, listas, **negrito**, $tex$ inline e $$tex$$ numa linha própria.
   */
  text: string;
  /** Experimentos para explorar a seção; a primeira é a principal. */
  experiments: ExperimentRef[];
}

export interface ChapterContent {
  n: number;
  /** Abertura do capítulo: o que se estuda e por que importa (Markdown). */
  intro: string;
  /** Pelo id da seção ("2-7"). Toda seção do sumário precisa estar aqui. */
  sections: Record<string, SectionContent>;
}

export const chapterContents: Record<number, ChapterContent> = Object.fromEntries(
  Object.values(import.meta.glob<{ capitulo: ChapterContent }>("./capitulos/cap*.ts", { eager: true })).map((m) => [m.capitulo.n, m.capitulo]),
);
