-- Modo desafio: melhor pontuação de cada aluno por desafio, por turma, para o ranking da turma.
-- Só membros da turma (alunos matriculados e o professor) leem; cada aluno só grava as próprias linhas.

create table if not exists public.desafio_pontos (
  turma uuid not null references public.turmas(id) on delete cascade,
  aluno uuid not null references public.profiles(id) on delete cascade,
  nome text not null default '',
  desafio text not null check (desafio ~ '^[a-z0-9-]{1,64}$'),
  pontos int not null default 0 check (pontos between 0 and 100000),
  estrelas int not null default 0 check (estrelas between 0 and 3),
  tentativas int not null default 1 check (tentativas >= 1),
  tempo_s int not null default 0 check (tempo_s >= 0),
  atualizado_em timestamptz not null default now(),
  primary key (turma, aluno, desafio)
);

create index if not exists desafio_pontos_turma on public.desafio_pontos (turma);

alter table public.desafio_pontos enable row level security;

create or replace function public.is_membro_da_turma(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from matriculas where turma = t and aluno = auth.uid())
      or exists (select 1 from turmas where id = t and professor = auth.uid());
$$;

create policy "turma vê o ranking" on public.desafio_pontos for select using (public.is_membro_da_turma(turma));
create policy "aluno grava a própria pontuação" on public.desafio_pontos for insert with check (
  aluno = auth.uid() and exists (select 1 from matriculas where turma = desafio_pontos.turma and aluno = auth.uid())
);
create policy "aluno atualiza a própria pontuação" on public.desafio_pontos for update using (aluno = auth.uid()) with check (
  aluno = auth.uid() and exists (select 1 from matriculas where turma = desafio_pontos.turma and aluno = auth.uid())
);
create policy "professor limpa o ranking" on public.desafio_pontos for delete using (public.is_professor_da_turma(turma));

-- Entrar na turma pelo código divulgado pelo professor (o aluno não enxerga turmas alheias por select).
create or replace function public.entrar_turma(codigo_turma text) returns table (id uuid, nome text)
language plpgsql security definer set search_path = public as $$
declare t public.turmas;
begin
  if auth.uid() is null then raise exception 'é preciso entrar com e-mail'; end if;
  select * into t from turmas where codigo = lower(trim(codigo_turma));
  if not found then raise exception 'turma não encontrada'; end if;
  insert into matriculas (turma, aluno) values (t.id, auth.uid()) on conflict do nothing;
  return query select t.id, t.nome;
end;
$$;

-- Grava a tentativa mantendo a melhor pontuação (roda com as permissões do aluno: valem as políticas acima).
create or replace function public.registrar_desafio(
  p_turma uuid, p_nome text, p_desafio text, p_pontos int, p_estrelas int, p_tentativas int, p_tempo_s int
) returns void
language sql security invoker set search_path = public as $$
  insert into desafio_pontos as d (turma, aluno, nome, desafio, pontos, estrelas, tentativas, tempo_s)
  values (p_turma, auth.uid(), left(coalesce(p_nome, ''), 60), p_desafio, p_pontos, p_estrelas, p_tentativas, p_tempo_s)
  on conflict (turma, aluno, desafio) do update set
    nome = excluded.nome,
    tentativas = greatest(d.tentativas, excluded.tentativas),
    pontos = greatest(d.pontos, excluded.pontos),
    estrelas = greatest(d.estrelas, excluded.estrelas),
    tempo_s = case when excluded.pontos > d.pontos then excluded.tempo_s else d.tempo_s end,
    atualizado_em = now();
$$;

grant execute on function public.entrar_turma(text) to authenticated;
grant execute on function public.registrar_desafio(uuid, text, text, int, int, int, int) to authenticated;
