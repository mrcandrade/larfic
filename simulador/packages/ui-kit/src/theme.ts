import { useEffect, useState } from "react";
import { darkTheme, lightTheme, type Theme } from "@fisilab/core";

/** Paletas de alto contraste do canvas: cores puras e saturadas, grade bem visível. */
export const contrastDarkTheme: Theme = {
  text: "#ffffff",
  muted: "#e6e6e6",
  grid: "rgba(255, 255, 255, 0.45)",
  accent: "#ffd400",
  series: ["#ffd400", "#00e5ff", "#7cff4f", "#ff6ec7", "#ff9a1f", "#b8a6ff"],
  positive: "#ff5c5c",
  negative: "#4fc3ff",
  ground: "rgba(160, 200, 140, 0.6)",
  dark: true,
};

export const contrastLightTheme: Theme = {
  text: "#000000",
  muted: "#1a1a1a",
  grid: "rgba(0, 0, 0, 0.45)",
  accent: "#0033cc",
  series: ["#0033cc", "#c40000", "#006b1f", "#8f0091", "#a34700", "#005f73"],
  positive: "#c40000",
  negative: "#0033cc",
  ground: "rgba(60, 90, 40, 0.6)",
  dark: false,
};

function readTheme(): Theme {
  if (typeof window === "undefined") return lightTheme;
  const css = getComputedStyle(document.documentElement);
  const v = (name: string, fallback: string) => css.getPropertyValue(name).trim() || fallback;
  const dark = v("--scheme", "") === "dark" || (v("--scheme", "") === "" && matchMedia("(prefers-color-scheme: dark)").matches);
  // --contrast vem do CSS: "more" no tema "Alto contraste" ou com prefers-contrast: more no automático.
  const contrast = v("--contrast", "") === "more";
  const base = contrast ? (dark ? contrastDarkTheme : contrastLightTheme) : dark ? darkTheme : lightTheme;
  return {
    ...base,
    text: v("--text", base.text),
    muted: v("--muted", base.muted),
    grid: v("--grid", base.grid),
    accent: v("--accent", base.accent),
    dark,
  };
}

/** Tema do canvas resolvido a partir das variáveis CSS; acompanha claro/escuro/alto contraste. */
export function useTheme(): Theme {
  const [theme, setTheme] = useState<Theme>(readTheme);
  useEffect(() => {
    const queries = ["(prefers-color-scheme: dark)", "(prefers-contrast: more)"].map((q) => matchMedia(q));
    const update = () => setTheme(readTheme());
    for (const mq of queries) mq.addEventListener("change", update);
    const obs = new MutationObserver(update);
    obs.observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
    // O tema salvo pode ter sido aplicado entre o primeiro render e esta inscrição.
    update();
    return () => {
      for (const mq of queries) mq.removeEventListener("change", update);
      obs.disconnect();
    };
  }, []);
  return theme;
}

/** Usuário pediu menos movimento (prefers-reduced-motion: reduce). */
export function prefersReducedMotion(): boolean {
  return typeof window !== "undefined" && typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;
}
