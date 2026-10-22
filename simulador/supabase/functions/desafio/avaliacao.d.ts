// Tipos do pacote gerado `avaliacao.js` (fonte: apps/web/src/challenge-server.ts).
export interface ScoreRow {
  turma: string;
  aluno: string;
  nome: string;
  desafio: string;
  pontos: number;
  estrelas: number;
  tentativas: number;
  tempo_s: number;
}

export interface AttemptDeps {
  userFromToken(token: string): Promise<string | null>;
  isEnrolled(turma: string, aluno: string): Promise<boolean>;
  priorAttempts(turma: string, aluno: string, desafio: string): Promise<number>;
  save(row: ScoreRow): Promise<void>;
}

export interface AttemptResponse {
  status: number;
  body: { error: string } | { ok: boolean; pontos: number; estrelas: number; tentativas: number; mensagem: string };
}

export function handleAttempt(body: unknown, token: string | null, deps: AttemptDeps): Promise<AttemptResponse>;
