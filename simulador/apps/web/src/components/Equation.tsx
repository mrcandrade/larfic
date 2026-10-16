import katex from "katex";
import { useMemo } from "react";

export function Equation({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false }), [tex]);
  return <div className="equation" dangerouslySetInnerHTML={{ __html: html }} />;
}
