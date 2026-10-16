import { Fragment, type ReactNode } from "react";
import { InlineMath } from "./Equation.tsx";

/**
 * Renderizador mínimo de Markdown para roteiros: títulos ###, listas numeradas
 * e com marcadores, **negrito**, *itálico* e $LaTeX$ inline.
 */
export function Markdown({ text }: { text: string }) {
  const blocks: ReactNode[] = [];
  let list: { ordered: boolean; items: string[] } | null = null;
  const flush = () => {
    if (!list) return;
    const items = list.items.map((li, i) => <li key={i}>{inline(li)}</li>);
    blocks.push(list.ordered ? <ol key={blocks.length}>{items}</ol> : <ul key={blocks.length}>{items}</ul>);
    list = null;
  };
  for (const line of text.split("\n")) {
    const ol = /^\s*\d+\.\s+(.*)$/.exec(line);
    const ul = /^\s*[-*]\s+(.*)$/.exec(line);
    if (ol || ul) {
      const ordered = Boolean(ol);
      if (list && list.ordered !== ordered) flush();
      list ??= { ordered, items: [] };
      list.items.push((ol ?? ul)![1]!);
      continue;
    }
    flush();
    if (line.startsWith("### ")) blocks.push(<h3 key={blocks.length}>{inline(line.slice(4))}</h3>);
    else if (line.startsWith("## ")) blocks.push(<h3 key={blocks.length}>{inline(line.slice(3))}</h3>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="fl-markdown">{blocks}</div>;
}

function inline(text: string): ReactNode {
  return text.split(/(\$[^$]+\$|\*\*[^*]+\*\*|\*[^*]+\*)/).map((part, i) => {
    if (part.startsWith("$") && part.endsWith("$") && part.length > 2) return <InlineMath key={i} tex={part.slice(1, -1)} />;
    if (part.startsWith("**")) return <strong key={i}>{part.slice(2, -2)}</strong>;
    if (part.startsWith("*") && part.length > 2) return <em key={i}>{part.slice(1, -1)}</em>;
    return <Fragment key={i}>{part}</Fragment>;
  });
}

/** Mantido para compatibilidade: roteiro de um cenário. */
export function Guide({ markdown }: { markdown: string }) {
  return <Markdown text={markdown} />;
}
