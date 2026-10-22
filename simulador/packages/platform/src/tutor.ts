// Tutor de IA: monta o contexto da simulação para o modelo e oferece um tutor offline de reserva.
import type { AnySimulation, Params } from "@fisilab/core";
import { formatBR } from "@fisilab/core";

export interface TutorMessage {
  role: "user" | "assistant";
  content: string;
}

export interface TutorContext {
  simId: string;
  title: string;
  course: string;
  topic: string;
  summary: string;
  equations: string[];
  params: { label: string; value: string }[];
  readings: { label: string; value: string }[];
  scenario?: { label: string; guide?: string };
  /** Exercício que o aluno está tentando (enunciado já com números). */
  exercise?: string;
  t: number;
}

export function buildContext(sim: AnySimulation, params: Params, values: number[], t: number, scenarioId?: string, exercise?: string): TutorContext {
  const sc = sim.scenarios.find((s) => s.id === scenarioId);
  return {
    simId: sim.id,
    title: sim.title,
    course: sim.course,
    topic: sim.topic,
    summary: sim.summary,
    equations: sim.equations,
    params: sim.params.map((p) => {
      const v = params[p.key] ?? p.default;
      const opt = p.options?.find((o) => o.value === v);
      return { label: p.label, value: opt ? opt.label : `${formatBR(v)} ${p.unit}`.trim() };
    }),
    readings: sim.observables.map((o, i) => ({ label: o.label, value: `${formatBR(values[i] ?? NaN)} ${o.unit}`.trim() })),
    scenario: sc ? { label: sc.label, guide: sc.guide } : undefined,
    exercise,
    t,
  };
}

/** Instruções do tutor (vão no `system` da API). */
export function systemPrompt(ctx: TutorContext): string {
  const lines = [
    "Você é o tutor do FisiLab, um laboratório virtual de física para estudantes de engenharia de uma universidade brasileira.",
    "Responda sempre em português do Brasil, em poucas frases, com notação LaTeX entre $...$ quando escrever fórmulas.",
    "Ensine pelo método socrático: faça uma pergunta que leve o aluno ao próximo passo, sugira o que observar ou mudar na simulação, e explique o conceito físico por trás.",
    "Nunca entregue a resposta numérica final de um exercício; ajude a montar o raciocínio e confira contas que o aluno mostrar.",
    "Use os valores atuais da simulação abaixo quando forem úteis. Se a pergunta fugir da física ou da simulação, redirecione com gentileza.",
    "",
    `Simulação: ${ctx.title} (${ctx.course}, ${ctx.topic}). ${ctx.summary}`,
    `Modelo: ${ctx.equations.join(" ; ")}`,
    `Parâmetros: ${ctx.params.map((p) => `${p.label} = ${p.value}`).join("; ")}`,
    `Leituras em t = ${formatBR(ctx.t)} s: ${ctx.readings.map((r) => `${r.label} = ${r.value}`).join("; ")}`,
  ];
  if (ctx.scenario) lines.push(`Cenário: ${ctx.scenario.label}.${ctx.scenario.guide ? ` Roteiro: ${ctx.scenario.guide.replace(/\s+/g, " ")}` : ""}`);
  if (ctx.exercise) lines.push(`O aluno está resolvendo: ${ctx.exercise}`);
  return lines.join("\n");
}

const norm = (s: string) => s.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");

/**
 * Tutor offline: sem servidor de IA configurado, responde com perguntas-guia tiradas do
 * próprio conteúdo da sim (roteiro, equações, leituras). Melhor que nada, e funciona no PWA offline.
 */
export function offlineTutor(ctx: TutorContext, question: string): string {
  const q = norm(question);
  const reading = ctx.readings.find((r) => q.includes(norm(r.label).split(" ")[0]!));
  if (/(resposta|resultado|quanto da|qual o valor)/.test(q) && ctx.exercise) {
    return `Vamos por partes no exercício. Quais grandezas o enunciado dá, e qual equação do modelo liga essas grandezas ao que se pede? As equações desta simulação são: ${ctx.equations.map((e) => `$${e}$`).join(", ")}. Escreva a equação com os números e eu confiro com você.`;
  }
  if (/(por que|porque|explica|entender)/.test(q)) {
    const guide = ctx.scenario?.guide?.split("\n").find((l) => /^\d+\./.test(l.trim()));
    return `Boa pergunta. Comece pelo modelo: $${ctx.equations[0] ?? ""}$. Que termo dessa equação muda quando você mexe no parâmetro que está investigando?${guide ? ` Uma sugestão do roteiro: ${guide.replace(/^\d+\.\s*/, "")}` : ""}`;
  }
  if (reading) {
    return `Agora a leitura de ${reading.label} é ${reading.value}. Antes de rodar de novo, preveja: se você dobrar um dos parâmetros, essa leitura dobra, cai pela metade ou muda de outro jeito? Teste e compare com a equação.`;
  }
  return `Para orientar melhor: o que você esperava observar, e o que a simulação mostrou? Olhe as leituras (${ctx.readings.slice(0, 3).map((r) => `${r.label} = ${r.value}`).join("; ")}) e diga qual delas te surpreendeu. (Tutor offline: com o servidor de IA configurado, as respostas ficam mais completas.)`;
}

export interface TutorClientOptions {
  /** URL da Edge Function `tutor` (ex.: https://<projeto>.supabase.co/functions/v1/tutor). */
  endpoint?: string;
  /** Token do usuário (JWT do Supabase) ou chave anônima. */
  token?: string;
  fetchFn?: typeof fetch;
}

/** Pergunta ao tutor. Sem endpoint, ou se a rede falhar, usa o tutor offline. */
export async function askTutor(ctx: TutorContext, history: TutorMessage[], question: string, opts: TutorClientOptions = {}): Promise<{ answer: string; offline: boolean }> {
  if (!opts.endpoint) return { answer: offlineTutor(ctx, question), offline: true };
  try {
    const r = await (opts.fetchFn ?? fetch)(opts.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: JSON.stringify({ system: systemPrompt(ctx), messages: [...history.slice(-10), { role: "user", content: question }] }),
    });
    if (!r.ok) throw new Error(String(r.status));
    const data = (await r.json()) as { answer?: string };
    if (!data.answer) throw new Error("vazio");
    return { answer: data.answer, offline: false };
  } catch {
    return { answer: offlineTutor(ctx, question), offline: true };
  }
}

/** Instruções para a revisão de relatório pelo tutor de IA. */
export function reportReviewSystem(): string {
  return [
    "Você é o tutor do FisiLab e revisa relatórios de Física Experimental de estudantes de engenharia de uma universidade brasileira.",
    "Responda em português do Brasil, em tópicos curtos, com notação LaTeX entre $...$ quando escrever fórmulas.",
    "Verifique: (1) coerência entre objetivo, análise e conclusão; (2) algarismos significativos (incerteza com 1 ou 2 algarismos e valor arredondado na mesma casa); (3) unidades em todos os resultados; (4) se a conclusão interpreta corretamente a compatibilidade com o valor de referência e o χ² reduzido; (5) clareza do procedimento.",
    "Aponte os problemas com sugestões concretas de reescrita, mas não reescreva o relatório inteiro nem invente dados. Termine com os três pontos mais importantes a corrigir.",
  ].join("\n");
}

/**
 * Pede ao tutor de IA uma revisão do relatório (em Markdown). Sem endpoint, ou se a rede
 * falhar, devolve `null` (a revisão automática por regras locais continua disponível).
 */
export async function askReportReview(report: string, opts: TutorClientOptions = {}): Promise<string | null> {
  if (!opts.endpoint) return null;
  try {
    const r = await (opts.fetchFn ?? fetch)(opts.endpoint, {
      method: "POST",
      headers: { "content-type": "application/json", ...(opts.token ? { authorization: `Bearer ${opts.token}` } : {}) },
      body: JSON.stringify({ system: `${reportReviewSystem()}\n\nRelatório do aluno:\n\n${report.slice(0, 9000)}`, messages: [{ role: "user", content: "Revise o meu relatório, por favor." }] }),
    });
    if (!r.ok) return null;
    const data = (await r.json()) as { answer?: string };
    return data.answer || null;
  } catch {
    return null;
  }
}
