/**
 * Lógica pura de acessibilidade e do modo apresentação: mapa de atalhos de
 * teclado, resumo textual do palco para leitores de tela e o ritmo dos
 * anúncios na região aria-live. Sem DOM nem React, para ser testável.
 */

export type ShortcutAction =
  | { kind: "toggle-play" }
  | { kind: "step" }
  | { kind: "back" }
  | { kind: "reset" }
  | { kind: "scenario"; index: number }
  | { kind: "exit" }
  | { kind: "help" }
  | { kind: "clear-ink" }
  | { kind: "pen" }
  | { kind: "panel" };

/** O que tem o foco quando a tecla é pressionada. */
export type FocusKind =
  /** Campo de texto, número, lista ou slider: as teclas pertencem ao controle. */
  | "field"
  /** Botão ou link: Espaço e Enter ativam o próprio botão. */
  | "button"
  /** Palco, corpo da página ou outro elemento sem teclas próprias. */
  | "other";

export interface KeyInput {
  key: string;
  ctrlKey?: boolean;
  metaKey?: boolean;
  altKey?: boolean;
}

export interface ShortcutContext {
  presenting: boolean;
  /** Número de cenários da simulação (as teclas 1–9 só valem até esse número). */
  scenarios: number;
  /** Simulação estática: sem rodar, passo, voltar. */
  isStatic?: boolean;
}

/** Lista exibida na ajuda dos atalhos (tecla ?). */
export const SHORTCUTS: { keys: string; label: string; presentingOnly?: boolean }[] = [
  { keys: "Espaço", label: "Rodar ou pausar" },
  { keys: "→", label: "Avançar um passo" },
  { keys: "←", label: "Voltar no tempo" },
  { keys: "R", label: "Reiniciar" },
  { keys: "1 a 9", label: "Escolher o cenário" },
  { keys: "P", label: "Ligar ou desligar a caneta", presentingOnly: true },
  { keys: "C", label: "Limpar as anotações da caneta", presentingOnly: true },
  { keys: "L", label: "Mostrar ou recolher o painel lateral", presentingOnly: true },
  { keys: "?", label: "Mostrar esta ajuda" },
  { keys: "Esc", label: "Fechar a ajuda ou sair da apresentação" },
];

/** Classifica o elemento focado a partir do nome da tag, do tipo e de contentEditable. */
export function focusKind(el: { tagName?: string; type?: string; isContentEditable?: boolean } | null | undefined): FocusKind {
  if (!el || !el.tagName) return "other";
  if (el.isContentEditable) return "field";
  const tag = el.tagName.toUpperCase();
  if (tag === "TEXTAREA" || tag === "SELECT") return "field";
  if (tag === "INPUT") {
    const t = (el.type ?? "text").toLowerCase();
    return t === "button" || t === "submit" || t === "reset" || t === "checkbox" || t === "radio" ? "button" : "field";
  }
  if (tag === "BUTTON" || tag === "A" || tag === "SUMMARY") return "button";
  return "other";
}

/**
 * Traduz uma tecla em ação. Devolve null quando a tecla não é um atalho ou
 * pertence ao elemento focado (digitar num campo, mover um slider, ativar um
 * botão com Espaço). Esc sempre chega, para nunca prender o usuário.
 */
export function shortcutFor(e: KeyInput, focus: FocusKind, ctx: ShortcutContext): ShortcutAction | null {
  if (e.ctrlKey || e.metaKey || e.altKey) return null;
  const key = e.key;
  if (key === "Escape") return { kind: "exit" };
  if (focus === "field") return null;
  if (focus === "button" && (key === " " || key === "Spacebar" || key === "Enter")) return null;
  const timeOk = !ctx.isStatic;
  switch (key) {
    case " ":
    case "Spacebar":
      return timeOk ? { kind: "toggle-play" } : null;
    case "ArrowRight":
      return timeOk ? { kind: "step" } : null;
    case "ArrowLeft":
      return timeOk ? { kind: "back" } : null;
    case "r":
    case "R":
      return { kind: "reset" };
    case "?":
      return { kind: "help" };
    case "c":
    case "C":
      return ctx.presenting ? { kind: "clear-ink" } : null;
    case "p":
    case "P":
      return ctx.presenting ? { kind: "pen" } : null;
    case "l":
    case "L":
      return ctx.presenting ? { kind: "panel" } : null;
  }
  if (/^[1-9]$/.test(key)) {
    const index = Number(key) - 1;
    return index < ctx.scenarios ? { kind: "scenario", index } : null;
  }
  return null;
}

/** Número em português com 3–4 algarismos significativos (vírgula decimal). */
export function spokenNumber(v: number): string {
  if (!Number.isFinite(v)) return "indefinido";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e5 || a < 1e-3) {
    const [m, e] = v.toExponential(2).split("e");
    return `${m!.replace(".", ",")} vezes 10 elevado a ${Number(e)}`;
  }
  return String(Number(v.toPrecision(4))).replace(".", ",");
}

export interface SummaryInput {
  title: string;
  observables: { label: string; unit: string }[];
  values: number[];
  t: number;
  playing: boolean;
  finished: boolean;
  isStatic?: boolean;
  scenario?: string;
  /** Máximo de grandezas lidas (as primeiras da lista, que costumam ser as principais). */
  max?: number;
}

/** Resumo textual do estado do palco, para a região aria-live e o aria-label do canvas. */
export function stageSummary(s: SummaryInput): string {
  const max = s.max ?? 8;
  const status = s.isStatic ? "" : s.playing ? "rodando" : s.finished ? "terminada" : s.t > 0 ? "pausada" : "parada";
  const head = [s.title, s.scenario ? `cenário ${s.scenario}` : "", status, s.isStatic ? "" : `t = ${spokenNumber(s.t)} s`]
    .filter(Boolean)
    .join(", ");
  const parts = s.observables.slice(0, max).map((o, i) => `${o.label.trim()}: ${spokenNumber(s.values[i] ?? NaN)}${o.unit ? ` ${o.unit}` : ""}`);
  const extra = s.observables.length > max ? ` (mais ${s.observables.length - max} grandezas na tabela de medidas)` : "";
  return parts.length ? `${head}. ${parts.join("; ")}.${extra}` : `${head}.`;
}

export interface AnnounceState {
  /** Instante (ms) do último anúncio. */
  at: number;
  playing: boolean;
}

/**
 * Decide se é hora de atualizar a região aria-live: ao pausar ou terminar,
 * quando pedido (passo, reinício, troca de cenário) e, durante a animação, no
 * máximo a cada `intervalMs`, para não inundar o leitor de tela.
 */
export function shouldAnnounce(prev: AnnounceState, now: number, playing: boolean, force = false, intervalMs = 5000): boolean {
  if (force) return true;
  if (prev.playing && !playing) return true;
  if (playing && now - prev.at >= intervalMs) return true;
  return false;
}
