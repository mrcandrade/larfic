-- Modo desafio: a pontuação passa a ser calculada no servidor. O app envia a tentativa (parâmetros e
-- montagem) à Edge Function `desafio`, que refaz a avaliação e grava com a service role. O aluno perde a
-- permissão de gravar pontos direto (pela tabela ou pela função antiga); continua lendo o ranking da turma.

drop policy if exists "aluno grava a própria pontuação" on public.desafio_pontos;
drop policy if exists "aluno atualiza a própria pontuação" on public.desafio_pontos;
revoke insert, update on public.desafio_pontos from anon, authenticated;
revoke execute on function public.registrar_desafio(uuid, text, text, int, int, int, int) from public, anon, authenticated;
drop function if exists public.registrar_desafio(uuid, text, text, int, int, int, int);

-- Gravação feita pela Edge Function: mantém a melhor pontuação e conta as tentativas avaliadas.
create or replace function public.registrar_desafio_servidor(
  p_turma uuid, p_aluno uuid, p_nome text, p_desafio text, p_pontos int, p_estrelas int, p_tentativas int, p_tempo_s int
) returns void
language sql security invoker set search_path = public as $$
  insert into desafio_pontos as d (turma, aluno, nome, desafio, pontos, estrelas, tentativas, tempo_s)
  values (p_turma, p_aluno, left(coalesce(p_nome, ''), 60), p_desafio, greatest(p_pontos, 0), least(greatest(p_estrelas, 0), 3), greatest(p_tentativas, 1), greatest(p_tempo_s, 0))
  on conflict (turma, aluno, desafio) do update set
    nome = case when excluded.nome <> '' then excluded.nome else d.nome end,
    tentativas = greatest(d.tentativas + 1, excluded.tentativas),
    pontos = greatest(d.pontos, excluded.pontos),
    estrelas = greatest(d.estrelas, excluded.estrelas),
    tempo_s = case when excluded.pontos > d.pontos then excluded.tempo_s else d.tempo_s end,
    atualizado_em = now();
$$;

revoke execute on function public.registrar_desafio_servidor(uuid, uuid, text, text, int, int, int, int) from public, anon, authenticated;
grant execute on function public.registrar_desafio_servidor(uuid, uuid, text, text, int, int, int, int) to service_role;
