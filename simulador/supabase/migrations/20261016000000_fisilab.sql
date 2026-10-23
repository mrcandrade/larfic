-- Esquema do FisiLab no Supabase: perfis, turmas, atividades, envios, progresso e LTI.

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  matricula text,
  role text not null default 'aluno' check (role in ('aluno', 'professor', 'admin')),
  created_at timestamptz not null default now()
);

create table if not exists public.turmas (
  id uuid primary key default gen_random_uuid(),
  nome text not null,
  disciplina text,
  semestre text,
  professor uuid not null references public.profiles(id) on delete cascade,
  codigo text unique not null default substr(md5(random()::text), 1, 6),
  created_at timestamptz not null default now()
);

create table if not exists public.matriculas (
  turma uuid references public.turmas(id) on delete cascade,
  aluno uuid references public.profiles(id) on delete cascade,
  primary key (turma, aluno)
);

create table if not exists public.atividades (
  id uuid primary key default gen_random_uuid(),
  turma uuid references public.turmas(id) on delete cascade,
  autor uuid not null references public.profiles(id) on delete cascade,
  codigo text not null,           -- encodeAssignment(...) do app
  titulo text not null,
  prazo timestamptz,
  lti_lineitem text,              -- quando criada pelo Moodle (deep linking)
  created_at timestamptz not null default now()
);

create table if not exists public.envios (
  id uuid primary key default gen_random_uuid(),
  atividade uuid not null references public.atividades(id) on delete cascade,
  aluno uuid not null references public.profiles(id) on delete cascade,
  conteudo jsonb not null,        -- Submission do app
  nota numeric(4,1),
  enviado_em timestamptz not null default now(),
  unique (atividade, aluno)
);

create table if not exists public.progresso (
  aluno uuid references public.profiles(id) on delete cascade,
  sim text not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (aluno, sim)
);

-- LTI 1.3: plataformas (instalações do Moodle) e estados de login em andamento.
create table if not exists public.lti_plataformas (
  issuer text not null,
  client_id text not null,
  deployment_ids text[] not null default '{}',
  auth_url text not null,
  token_url text not null,
  jwks_url text not null,
  primary key (issuer, client_id)
);

create table if not exists public.lti_estados (
  state text primary key,
  nonce text not null,
  issuer text not null,
  client_id text not null,
  criado_em timestamptz not null default now()
);

create table if not exists public.lti_usuarios (
  issuer text not null,
  sub text not null,
  perfil uuid not null references public.profiles(id) on delete cascade,
  primary key (issuer, sub)
);

-- Uso do tutor (limite diário por aluno).
create table if not exists public.tutor_uso (
  aluno uuid references public.profiles(id) on delete cascade,
  dia date not null default current_date,
  perguntas int not null default 0,
  primary key (aluno, dia)
);

alter table public.profiles enable row level security;
alter table public.turmas enable row level security;
alter table public.matriculas enable row level security;
alter table public.atividades enable row level security;
alter table public.envios enable row level security;
alter table public.progresso enable row level security;
alter table public.lti_plataformas enable row level security;
alter table public.lti_estados enable row level security;
alter table public.lti_usuarios enable row level security;
alter table public.tutor_uso enable row level security;

create or replace function public.is_professor_da_turma(t uuid) returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from turmas where id = t and professor = auth.uid());
$$;

create policy "perfil próprio" on public.profiles for all using (id = auth.uid()) with check (id = auth.uid() and role = 'aluno' or id = auth.uid() and role = (select role from profiles where id = auth.uid()));
create policy "professor vê alunos das turmas" on public.profiles for select using (
  exists (select 1 from matriculas m join turmas t on t.id = m.turma where m.aluno = profiles.id and t.professor = auth.uid())
);

create policy "professor gerencia turmas" on public.turmas for all using (professor = auth.uid()) with check (professor = auth.uid());
create policy "aluno vê suas turmas" on public.turmas for select using (exists (select 1 from matriculas where turma = turmas.id and aluno = auth.uid()));

create policy "aluno entra na turma" on public.matriculas for insert with check (aluno = auth.uid());
create policy "matrícula visível" on public.matriculas for select using (aluno = auth.uid() or public.is_professor_da_turma(turma));
create policy "professor remove matrícula" on public.matriculas for delete using (public.is_professor_da_turma(turma));

create policy "professor gerencia atividades" on public.atividades for all using (autor = auth.uid()) with check (autor = auth.uid());
create policy "aluno vê atividades das turmas" on public.atividades for select using (
  turma is null or exists (select 1 from matriculas where turma = atividades.turma and aluno = auth.uid())
);

create policy "aluno envia e revê" on public.envios for all using (aluno = auth.uid()) with check (aluno = auth.uid());
create policy "professor vê envios" on public.envios for select using (
  exists (select 1 from atividades a where a.id = envios.atividade and a.autor = auth.uid())
);
create policy "professor dá nota" on public.envios for update using (
  exists (select 1 from atividades a where a.id = envios.atividade and a.autor = auth.uid())
);

create policy "progresso próprio" on public.progresso for all using (aluno = auth.uid()) with check (aluno = auth.uid());
-- lti_* e tutor_uso: só a service role (Edge Functions) acessa; sem políticas para usuários.

-- Cria o perfil automaticamente no primeiro login.
create or replace function public.novo_usuario() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name) values (new.id, coalesce(new.raw_user_meta_data->>'name', split_part(new.email, '@', 1)))
  on conflict do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.novo_usuario();
