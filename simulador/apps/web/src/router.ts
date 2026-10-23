import { useEffect, useState } from "react";

export interface Route {
  page: "book" | "catalog" | "chapter" | "appendix" | "answers" | "bookIndex" | "sim" | "practice" | "teacher" | "assignment" | "video" | "sensors" | "notebook" | "concepts" | "challenges";
  conceptId?: string;
  challengeId?: string;
  code?: string;
  simId?: string;
  practiceId?: string;
  /** Capítulo do livro (#/capitulo/<n>) ou das respostas (#/respostas/<n>). */
  chapter?: number;
  /** Seção para rolar até ela (#/capitulo/<n>/<secao>). */
  sectionId?: string;
  /** Letra do apêndice, minúscula (#/apendice/<a…g>). */
  appendixId?: string;
  query: URLSearchParams;
}

/**
 * Rotas por hash, para funcionar em hospedagem estática e offline: #/ (sumário do livro),
 * #/simulacoes (catálogo), #/capitulo/2/2-7, #/apendice/f e #/sim/<id>?cenario=...&p.v0=30
 */
export function parseRoute(hash = location.hash): Route {
  const [path = "", qs = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const query = new URLSearchParams(qs);
  if (parts[0] === "sim" && parts[1]) return { page: "sim", simId: decodeURIComponent(parts[1]), query };
  if (parts[0] === "pratica" && parts[1]) return { page: "practice", practiceId: decodeURIComponent(parts[1]), query };
  if (parts[0] === "professor") return { page: "teacher", query };
  if (parts[0] === "video") return { page: "video", query };
  if (parts[0] === "sensores") return { page: "sensors", query };
  if (parts[0] === "notebook") return { page: "notebook", query };
  if (parts[0] === "concepcoes") return { page: "concepts", conceptId: parts[1] ? decodeURIComponent(parts[1]) : undefined, query };
  if (parts[0] === "desafios") return { page: "challenges", challengeId: parts[1] ? decodeURIComponent(parts[1]) : undefined, query };
  if (parts[0] === "atividade" && parts[1]) return { page: "assignment", code: parts[1], query };
  if (parts[0] === "simulacoes") return { page: "catalog", query };
  if (parts[0] === "capitulo" && parts[1] && Number.isInteger(Number(parts[1])))
    return { page: "chapter", chapter: Number(parts[1]), sectionId: parts[2] ? decodeURIComponent(parts[2]) : undefined, query };
  if (parts[0] === "apendice" && parts[1]) return { page: "appendix", appendixId: decodeURIComponent(parts[1]).toLowerCase(), query };
  if (parts[0] === "respostas") return { page: "answers", chapter: parts[1] && Number.isInteger(Number(parts[1])) ? Number(parts[1]) : undefined, query };
  if (parts[0] === "indice") return { page: "bookIndex", query };
  return { page: "book", query };
}

export function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute());
  useEffect(() => {
    const on = () => setRoute(parseRoute());
    window.addEventListener("hashchange", on);
    return () => window.removeEventListener("hashchange", on);
  }, []);
  return route;
}

export function simHref(id: string, query?: URLSearchParams): string {
  const q = query?.toString();
  return `#/sim/${encodeURIComponent(id)}${q ? `?${q}` : ""}`;
}

/** Parâmetros codificados na URL como p.<chave>=<valor>. */
export function paramsFromQuery(q: URLSearchParams): Record<string, number> {
  const out: Record<string, number> = {};
  q.forEach((v, k) => {
    if (k.startsWith("p.") && Number.isFinite(Number(v))) out[k.slice(2)] = Number(v);
  });
  return out;
}

export const practiceHref = (id: string) => `#/pratica/${encodeURIComponent(id)}`;
