// Utilidades de exportação do lado do navegador: fórmulas em MathML para o HTML do relatório e janela de impressão.
import katex from "katex";
import { htmlEscape } from "@fisilab/analysis";

/** Converte TeX em MathML (renderizado pelo próprio navegador, sem CSS externo). */
export function mathml(tex: string, display: boolean): string {
  try {
    return katex.renderToString(tex, { displayMode: display, output: "mathml", throwOnError: false });
  } catch {
    return htmlEscape(tex);
  }
}

/** Abre o HTML numa nova aba e chama a impressão (o navegador oferece "Salvar como PDF"). */
export function openForPrint(html: string): boolean {
  const url = URL.createObjectURL(new Blob([html], { type: "text/html;charset=utf-8" }));
  const w = window.open(url, "_blank");
  if (!w) {
    URL.revokeObjectURL(url);
    return false;
  }
  w.addEventListener("load", () => setTimeout(() => w.print(), 300));
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
  return true;
}

/** Copia texto para a área de transferência (true se conseguiu). */
export async function copyText(text: string): Promise<boolean> {
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}
