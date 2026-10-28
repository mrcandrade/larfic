# Simulador FisiLab

Laboratório virtual de física para engenharia, em português: simulações de nível universitário
(cálculo, unidades SI, incerteza) para as Físicas Gerais I–IV e Experimentais I–III.

O desenvolvimento segue o roadmap do plano de implementação, uma fase por PR. A Fase 0
(fundação) traz o núcleo de física, o contrato de simulação, o UI kit, o app web (PWA
offline) e as três sims-piloto: **projétil com arrasto** (FG I), **construtor de circuitos**
(FG III) e **ciclos térmicos no diagrama PV** (FG II).

## Rodar

Requer Node 22+ e pnpm 10.

```sh
cd simulador
pnpm install
pnpm dev        # app em http://localhost:5173
pnpm test       # testes de física (integradores, conservação, soluções analíticas)
pnpm typecheck
pnpm build      # gera apps/web/dist
```

## Publicação

Cada merge na `main` que mexa em `simulador/` publica o app no GitHub Pages
(`.github/workflows/simulador-pages.yml`), em https://mrcandrade.github.io/larfic/. Na primeira
vez, ative em Settings › Pages › Source = "GitHub Actions". As variáveis de repositório
`VITE_SUPABASE_URL` e `VITE_SUPABASE_ANON_KEY`, quando existirem, ligam o servidor (login, turmas,
tutor); sem elas o app roda em modo local.

## Estrutura

| Pacote | Papel |
| --- | --- |
| `packages/core` | Contrato de simulação, integradores (Euler, RK4, Verlet, RK45 adaptativo), runner com passo fixo e volta no tempo, solver de circuitos MNA, desenho em coordenadas do mundo, exercícios paramétricos, CSV |
| `packages/ui-kit` | Componentes React: player da simulação, palco, controles, gráficos (linhas paramétricas, barras de erro, log), equações vivas em KaTeX, roteiros, previsões, exercícios, progresso |
| `sims/*` | Uma simulação por pacote |
| `apps/web` | App: catálogo por disciplina com busca, links compartilháveis com parâmetros, modo incorporado (iframe), tema claro/escuro, PWA offline |

## Contrato de uma simulação

Cada pacote em `sims/*` exporta um objeto `Simulation` (`packages/core/src/simulation.ts`) com:

1. `init(params)`: estado inicial. Um vetor de números em SI (integrado pelo runner) ou um
   objeto qualquer (um circuito editável) com `step` próprio.
2. `params`: controles com faixa, passo, unidade, escala log, lista de opções ou ajuste ao vivo.
3. `derivatives(state, params, t)` ou `step(...)`: a física; o runner escolhe o integrador.
4. `render(ctx, frame)`: desenho 2D em coordenadas do mundo, com os utilitários de `draw()`.
5. `observables`: grandezas medidas que alimentam gráfico, tabela e CSV. `conserved` aponta a
   grandeza que deve se conservar, e o app mostra o desvio.
6. `scenarios`: presets com roteiro didático em Markdown e perguntas de previsão
   (prever → observar → explicar).
7. Opcionais: `exercises` (questões com valores sorteados e correção automática),
   `liveEquations` (equações com os valores atuais), `pointer` e `actions` (interação no palco).

O runner usa passo de tempo fixo desacoplado da taxa de quadros, localiza eventos por
bissecção (`stopWhen`, por exemplo o projétil tocando o chão) e guarda amostras para gráficos,
exportação e "voltar no tempo".

## Nova simulação

1. Copie `sims/projetil-arrasto` para `sims/<nome>` e troque o `name` no `package.json`.
2. Implemente o contrato e escreva testes contra uma solução analítica e uma lei de conservação.
3. Adicione a sim em `apps/web/src/catalog.ts` (com os títulos do plano que ela cobre, em
   `plan.ts`) e a dependência em `apps/web/package.json`.

O teste `apps/web/test/catalog.test.ts` roda todos os cenários de todas as sims, desenha
cada uma num canvas falso e gera os exercícios, então uma sim nova já nasce testada.

## Links

- `#/sim/<id>?cenario=<id>&p.<param>=<valor>` abre a sim num estado específico.
- `&travar=a,b` trava parâmetros (roteiros do professor).
- `&embed=1` mostra só a simulação, para `<iframe>`.
