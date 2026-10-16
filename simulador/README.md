# Simulador FisiLab

Laboratório virtual de física para engenharia, em português: simulações de nível universitário
(cálculo, unidades SI, incerteza) para as Físicas Gerais I–IV e Experimentais I–III.

Esta é a fundação do projeto: o núcleo de física, o contrato de simulação, o app web e a
primeira sim-piloto, **Projétil com arrasto** (FG I).

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

## Estrutura

| Pacote | Papel |
| --- | --- |
| `packages/core` | Contrato de simulação, integradores (Euler, RK4, Verlet), runner com passo fixo e volta no tempo, exportação CSV |
| `sims/*` | Uma simulação por pacote. Hoje: `projetil-arrasto` |
| `apps/web` | App React + Vite: catálogo, palco 2D, controles, gráfico ao vivo (uPlot), equações (KaTeX), roteiros |

## Contrato de uma simulação

Cada pacote em `sims/*` exporta um objeto `Simulation` (`packages/core/src/simulation.ts`) com:

1. `stateVars` e `init(params)`: estado dinâmico em unidades SI.
2. `params`: controles com faixa, passo e unidade.
3. `derivatives(state, params, t)` ou `step(...)`: a física; o runner escolhe o integrador.
4. `render(ctx, frame)`: desenho 2D em coordenadas do mundo (metros, y para cima).
5. `observables`: grandezas medidas que alimentam gráfico, tabela e CSV. `conserved` aponta a
   grandeza que deve se conservar, e o app mostra o desvio.
6. `scenarios`: presets com roteiro didático em Markdown.

O runner usa passo de tempo fixo desacoplado da taxa de quadros, localiza eventos por
bissecção (`stopWhen`, por exemplo o projétil tocando o chão) e guarda amostras para gráficos,
exportação e "voltar no tempo".

## Nova simulação

1. Copie `sims/projetil-arrasto` para `sims/<nome>` e troque o `name` no `package.json`.
2. Implemente o contrato e escreva testes contra uma solução analítica e uma lei de conservação.
3. Adicione a sim em `apps/web/src/catalog.ts` e a dependência em `apps/web/package.json`.

## Próximas sims-piloto

- Construtor de circuitos DC (FG III), validando o solver de circuitos.
- Ciclo termodinâmico no diagrama PV, validando o motor de campos e estados.
