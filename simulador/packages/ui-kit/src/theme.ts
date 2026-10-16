import { useEffect, useState } from "react";
import { darkTheme, lightTheme, type Theme } from "@fisilab/core";

function readTheme(): Theme {
  if (typeof window === "undefined") return lightTheme;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const dark = v("--scheme", "") === "dark" || (v("--scheme", "") === "" && matchMedia("(prefers-color-scheme: dark)").matches);
  const base = dark ? darkTheme : lightTheme;
  return {
    ...base,
    text: v("--text", base.text),
    muted: v("--muted", base.muted),
    grid: v("--grid", base.grid),
    accent: v("--accent", base.accent),
    dark,
  };
}

/** Tema do canvas resolvido a partir das variáveis CSS; acompanha a troca claro/escuro. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const mq = matchMedia("(prefers-color-scheme: dark)");
    const update = () => setTheme(readTheme());
    mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    return () => {
      mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);
  return theme;
}
