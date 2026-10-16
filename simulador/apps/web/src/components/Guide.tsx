import { Fragment, type ReactNode } from "react";

/** Renderizador mínimo para os roteiros: títulos ###, listas numeradas e **negrito**. */
export function Guide({ markdown }: { markdown: string }) {
  const blocks: ReactNode[] = [];
  let list: string[] = [];
  const flush = () => {
    if (list.length) blocks.push(<ol key={blocks.length}>{list.map((li, i) => <li key={i}>{inline(li)}</li>)}</ol>);
    list = [];
  };
  for (const line of markdown.split("\n")) {
    const item = /^\d+\.\s+(.*)$/.exec(line);
    if (item) {
      list.push(item[1]!);
      continue;
    }
    flush();
    if (line.startsWith("### ")) blocks.push(<h3 key={blocks.length}>{inline(line.slice(4))}</h3>);
    else if (line.trim()) blocks.push(<p key={blocks.length}>{inline(line)}</p>);
  }
  flush();
  return <div className="guide">{blocks}</div>;
}

function inline(text: string): ReactNode {
  return text.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
    part.startsWith("**") ? <strong key={i}>{part.slice(2, -2)}</strong> : <Fragment key={i}>{part}</Fragment>,
  );
}
