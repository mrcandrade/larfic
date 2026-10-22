import { describe, expect, it } from "vitest";
import { focusKind, shortcutFor, shouldAnnounce, spokenNumber, stageSummary } from "../src/a11y.ts";
import { displayMath, mathFragments, unbalancedMathLines } from "../src/markdown.ts";

const ctx = { presenting: false, scenarios: 3 };
const key = (k: string, extra: Record<string, boolean> = {}) => ({ key: k, ...extra });

describe("atalhos de teclado", () => {
  it("mapeia as teclas básicas com o foco no palco", () => {
    expect(shortcutFor(key(" "), "other", ctx)).toEqual({ kind: "toggle-play" });
    expect(shortcutFor(key("ArrowRight"), "other", ctx)).toEqual({ kind: "step" });
    expect(shortcutFor(key("ArrowLeft"), "other", ctx)).toEqual({ kind: "back" });
    expect(shortcutFor(key("r"), "other", ctx)).toEqual({ kind: "reset" });
    expect(shortcutFor(key("R"), "other", ctx)).toEqual({ kind: "reset" });
    expect(shortcutFor(key("?"), "other", ctx)).toEqual({ kind: "help" });
    expect(shortcutFor(key("Escape"), "other", ctx)).toEqual({ kind: "exit" });
  });

  it("teclas 1–9 escolhem cenários existentes", () => {
    expect(shortcutFor(key("1"), "other", ctx)).toEqual({ kind: "scenario", index: 0 });
    expect(shortcutFor(key("3"), "other", ctx)).toEqual({ kind: "scenario", index: 2 });
    expect(shortcutFor(key("4"), "other", ctx)).toBeNull();
    expect(shortcutFor(key("0"), "other", ctx)).toBeNull();
  });

  it("caneta, limpar e painel só valem na apresentação", () => {
    expect(shortcutFor(key("c"), "other", ctx)).toBeNull();
    expect(shortcutFor(key("p"), "other", ctx)).toBeNull();
    const pres = { ...ctx, presenting: true };
    expect(shortcutFor(key("c"), "other", pres)).toEqual({ kind: "clear-ink" });
    expect(shortcutFor(key("P"), "other", pres)).toEqual({ kind: "pen" });
    expect(shortcutFor(key("l"), "other", pres)).toEqual({ kind: "panel" });
  });

  it("não rouba teclas de campos nem a ativação de botões", () => {
    expect(shortcutFor(key("ArrowRight"), "field", ctx)).toBeNull();
    expect(shortcutFor(key("r"), "field", ctx)).toBeNull();
    expect(shortcutFor(key(" "), "button", ctx)).toBeNull();
    expect(shortcutFor(key("Enter"), "button", ctx)).toBeNull();
    expect(shortcutFor(key("ArrowRight"), "button", ctx)).toEqual({ kind: "step" });
    // Esc sempre chega, para não prender o usuário na apresentação.
    expect(shortcutFor(key("Escape"), "field", ctx)).toEqual({ kind: "exit" });
  });

  it("ignora combinações com modificadores e controles de tempo em sims estáticas", () => {
    expect(shortcutFor(key("r", { ctrlKey: true }), "other", ctx)).toBeNull();
    expect(shortcutFor(key("1", { altKey: true }), "other", ctx)).toBeNull();
    const st = { ...ctx, isStatic: true };
    expect(shortcutFor(key(" "), "other", st)).toBeNull();
    expect(shortcutFor(key("ArrowRight"), "other", st)).toBeNull();
    expect(shortcutFor(key("r"), "other", st)).toEqual({ kind: "reset" });
  });

  it("classifica o elemento focado", () => {
    expect(focusKind(null)).toBe("other");
    expect(focusKind({ tagName: "DIV" })).toBe("other");
    expect(focusKind({ tagName: "INPUT", type: "range" })).toBe("field");
    expect(focusKind({ tagName: "INPUT", type: "number" })).toBe("field");
    expect(focusKind({ tagName: "INPUT", type: "checkbox" })).toBe("button");
    expect(focusKind({ tagName: "SELECT" })).toBe("field");
    expect(focusKind({ tagName: "TEXTAREA" })).toBe("field");
    expect(focusKind({ tagName: "BUTTON" })).toBe("button");
    expect(focusKind({ tagName: "DIV", isContentEditable: true })).toBe("field");
  });
});

describe("resumo textual do palco", () => {
  it("formata números em português", () => {
    expect(spokenNumber(12.3456)).toBe("12,35");
    expect(spokenNumber(0)).toBe("0");
    expect(spokenNumber(-2)).toBe("-2");
    expect(spokenNumber(1.5e-6)).toBe("1,50 vezes 10 elevado a -6");
    expect(spokenNumber(NaN)).toBe("indefinido");
  });

  it("lista grandezas com rótulos e unidades", () => {
    const s = stageSummary({
      title: "Projétil",
      observables: [
        { label: "x", unit: "m" },
        { label: "Fator Q", unit: "" },
      ],
      values: [3.5, 12],
      t: 1.25,
      playing: false,
      finished: false,
      scenario: "Vácuo",
    });
    expect(s).toBe("Projétil, cenário Vácuo, pausada, t = 1,25 s. x: 3,5 m; Fator Q: 12.");
  });

  it("informa o estado e limita o número de grandezas", () => {
    const obs = Array.from({ length: 10 }, (_, i) => ({ label: `g${i}`, unit: "J" }));
    const s = stageSummary({ title: "T", observables: obs, values: obs.map(() => 1), t: 0, playing: true, finished: false, max: 3 });
    expect(s).toContain("rodando");
    expect(s).toContain("g2: 1 J");
    expect(s).not.toContain("g3:");
    expect(s).toContain("mais 7 grandezas");
    expect(stageSummary({ title: "T", observables: [], values: [], t: 0, playing: false, finished: false })).toBe("T, parada, t = 0 s.");
    expect(stageSummary({ title: "T", observables: [], values: [], t: 0, playing: false, finished: false, isStatic: true })).toBe("T.");
  });

  it("anuncia com moderação", () => {
    const idle = { at: 0, playing: false };
    const running = { at: 1000, playing: true };
    expect(shouldAnnounce(idle, 100, false)).toBe(false);
    expect(shouldAnnounce(idle, 100, false, true)).toBe(true);
    expect(shouldAnnounce(running, 2000, true)).toBe(false);
    expect(shouldAnnounce(running, 6000, true)).toBe(true);
    expect(shouldAnnounce(running, 1200, false)).toBe(true); // acabou de pausar
    expect(shouldAnnounce(running, 3000, true, false, 1500)).toBe(true);
  });
});

describe("matemática no Markdown", () => {
  it("reconhece equações em destaque e inline", () => {
    expect(displayMath("$$ E = mc^2 $$")).toBe("E = mc^2");
    expect(displayMath("texto $x$")).toBeNull();
    const f = mathFragments("Seja $a$ e $b$.\n$$a+b$$");
    expect(f.map((x) => [x.tex, x.display])).toEqual([["a", false], ["b", false], ["a+b", true]]);
  });

  it("acha delimitadores desbalanceados", () => {
    expect(unbalancedMathLines("ok $x$\nruim $x\n$$y$$\n$$z")).toEqual([2, 4]);
  });
});
