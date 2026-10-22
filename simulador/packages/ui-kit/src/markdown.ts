/**
 * Utilitários puros para o Markdown dos roteiros e derivações: uma linha
 * inteira entre $$ ... $$ é equação em destaque; $...$ dentro de uma linha é
 * fórmula inline. Os delimitadores não atravessam linhas.
 */

/** Linha que é uma equação em destaque ($$ ... $$). Devolve o TeX ou null. */
export function displayMath(line: string): string | null {
  const t = line.trim();
  return t.length > 4 && t.startsWith("$$") && t.endsWith("$$") ? t.slice(2, -2).trim() : null;
}

/** Todos os trechos de TeX do texto, com a indicação de destaque/inline. */
export function mathFragments(md: string): { tex: string; display: boolean; line: number }[] {
  const out: { tex: string; display: boolean; line: number }[] = [];
  md.split("\n").forEach((line, i) => {
    const d = displayMath(line);
    if (d !== null) {
      out.push({ tex: d, display: true, line: i + 1 });
      return;
    }
    for (const m of line.matchAll(/\$([^$]+)\$/g)) out.push({ tex: m[1]!, display: false, line: i + 1 });
  });
  return out;
}

/** Números das linhas (a partir de 1) com delimitadores $ desbalanceados. */
export function unbalancedMathLines(md: string): number[] {
  const bad: number[] = [];
  md.split("\n").forEach((line, i) => {
    if (displayMath(line) !== null) {
      if (displayMath(line)!.includes("$")) bad.push(i + 1);
      return;
    }
    const n = (line.match(/\$/g) ?? []).length;
    if (n % 2 !== 0 || /\$\$/.test(line)) bad.push(i + 1);
  });
  return bad;
}
