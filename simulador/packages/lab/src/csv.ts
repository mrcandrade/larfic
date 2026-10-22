// Exportação de tabelas no mesmo padrão do pacote analysis (rowsToCsv): ponto e vírgula e vírgula decimal,
// que o Excel e o LibreOffice em português abrem direto.

/** Formata um número para CSV brasileiro; não finitos viram célula vazia. */
export function csvNumber(v: number, digits = 6): string {
  if (!Number.isFinite(v)) return "";
  return String(+v.toPrecision(digits)).replace(".", ",");
}

const quote = (s: string) => (/[;"\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s);

/** Monta um CSV com cabeçalho; cada linha é uma lista de números. */
export function tableToCsv(headers: readonly string[], rows: readonly (readonly number[])[], digits = 6): string {
  return [headers.map(quote).join(";"), ...rows.map((r) => r.map((v) => csvNumber(v, digits)).join(";"))].join("\n");
}
