import { useEffect, useState } from "react";

export interface Route {
  page: "catalog" | "sim";
  simId?: string;
  query: URLSearchParams;
}

/** Rotas por hash, para funcionar em hospedagem estática e offline: #/ e #/sim/<id>?cenario=...&p.v0=30 */
export function parseRoute(hash = location.hash): Route {
  const [path = "", qs = ""] = hash.replace(/^#/, "").split("?");
  const parts = path.split("/").filter(Boolean);
  const query = new URLSearchParams(qs);
  if (parts[0] === "sim" && parts[1]) return { page: "sim", simId: decodeURIComponent(parts[1]), query };
  return { page: "catalog", query };
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
