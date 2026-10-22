# Backend do FisiLab (Supabase)

O app funciona sem backend: perfil, progresso, práticas e atividades ficam no navegador, as atividades
viajam no próprio link e o professor recolhe os envios como arquivos `.json`. Com o Supabase configurado,
ganham-se contas, turmas, envios centralizados, o tutor de IA e a integração LTI 1.3 com o Moodle.

## Configuração

1. Crie um projeto no Supabase e aplique `migrations/` (`supabase db push`).
2. No app, defina no build:
   - `VITE_SUPABASE_URL=https://<projeto>.supabase.co`
   - `VITE_SUPABASE_ANON_KEY=<chave anônima>`
3. Tutor de IA: `supabase secrets set ANTHROPIC_API_KEY=...` (opcional: `TUTOR_MODEL`, `TUTOR_LIMITE_DIARIO`, padrão 60 perguntas/dia por aluno) e `supabase functions deploy tutor`.
4. Modo desafio (ranking da turma): a pontuação é calculada no servidor. O app envia a tentativa (parâmetros,
   montagem no palco, número de tentativas e tempo) à função `desafio`, que refaz a avaliação com o mesmo código
   do app (`apps/web/src/challenge-core.ts`) e grava com a service role; o aluno não grava pontos direto
   (migração `20261023000000_desafios_servidor.sql`). O Deno não resolve os pacotes do workspace, então a
   avaliação vai num pacote gerado:
   - `node scripts/bundle-desafio.mjs` (gera `functions/desafio/avaliacao.js`; refaça sempre que mudar um desafio ou uma simulação usada por eles);
   - `supabase functions deploy desafio`.
   Sem a função publicada, o app continua avaliando no navegador e mostra o ranking do aparelho; o envio à turma avisa que falhou.
5. LTI (Moodle):
   - Gere uma chave RSA em JWK (por exemplo com `node scripts/gen-lti-key.mjs`) e guarde: `supabase secrets set LTI_PRIVATE_JWK='<json>' LTI_KID=fisilab-1 FISILAB_APP_URL=https://<onde o app está>/`.
   - `supabase functions deploy lti --no-verify-jwt`.
   - No Moodle (Administração → Plugins → Ferramenta externa → Gerenciar ferramentas → Configurar manualmente):
     - Versão LTI: 1.3; Tipo de chave pública: URL do conjunto de chaves → `https://<projeto>.supabase.co/functions/v1/lti/jwks`
     - URL de início de login: `.../functions/v1/lti/login`; URL de redirecionamento: `.../functions/v1/lti/launch`
     - URL da ferramenta: `.../functions/v1/lti/login`; marque **Deep Linking** e **Serviço de notas (IMS LTI Assignment and Grade Services)**.
   - Copie *Platform ID*, *Client ID*, *Deployment ID* e as URLs mostradas pelo Moodle para a tabela `lti_plataformas`.
   - Parâmetros personalizados aceitos num link: `sim=<id>`, `cenario=<id>`, `pratica=<id>`, `atividade=<código>`.
