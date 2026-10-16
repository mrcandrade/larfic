import katex from "katex";
import { useMemo } from "react";

export function Equation({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: true, throwOnError: false }), [tex]);
  return <div className="fl-equation" dangerouslySetInnerHTML={{ __html: html }} />;
}

export function InlineMath({ tex }: { tex: string }) {
  const html = useMemo(() => katex.renderToString(tex, { displayMode: false, throwOnError: false }), [tex]);
  return <span dangerouslySetInnerHTML={{ __html: html }} />;
}
