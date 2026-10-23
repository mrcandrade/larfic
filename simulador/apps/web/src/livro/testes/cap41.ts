import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 41,
  sections: {
    "41-2": [
      {
        q: "Qual propriedade separa melhor metais, isolantes e semicondutores?",
        options: ["A cor", "A resistividade e como ela varia com a temperatura", "A densidade", "A dureza"],
        answer: 1,
        why: "A resistividade vai de cerca de $10^{-8}$ Ω·m nos metais a $10^{16}$ Ω·m em isolantes; nos semicondutores ela cai quando a temperatura sobe.",
      },
    ],
    "41-3": [
      {
        q: "Por que os níveis de energia de um sólido formam bandas?",
        options: ["Porque os átomos estão parados", "Porque, ao aproximar $N$ átomos, cada nível atômico se desdobra em $N$ níveis muito próximos", "Porque os elétrons são livres", "Por causa da gravidade"],
        answer: 1,
        why: "A sobreposição das funções de onda vizinhas quebra a degenerescência; com $N \\sim 10^{23}$, os níveis viram uma faixa quase contínua.",
      },
    ],
    "41-4": [
      {
        q: "Por que o diamante é isolante?",
        options: ["Porque não tem elétrons livres de nenhum tipo", "Porque a banda de valência está cheia e o gap (cerca de 5,5 eV) é grande demais para a energia térmica", "Porque é transparente", "Porque é duro"],
        answer: 1,
        why: "Com $kT \\approx 0{,}025$ eV, quase nenhum elétron cruza um gap de 5,5 eV, e uma banda cheia não conduz.",
      },
    ],
    "41-5": [
      {
        q: "Num metal a 0 K, até que energia os estados estão ocupados?",
        options: ["Até zero", "Até a energia de Fermi", "Até $kT$", "Todos os estados"],
        answer: 1,
        why: "Os elétrons preenchem os estados de baixo para cima (Pauli) até $E_F$, alguns eV, muito acima de $kT$. Só os elétrons perto de $E_F$ participam da condução.",
      },
    ],
    "41-6": [
      {
        q: "No silício puro, o que conduz corrente além dos elétrons na banda de condução?",
        options: ["Prótons", "As lacunas deixadas na banda de valência, que se comportam como cargas positivas", "Íons da rede", "Nada"],
        answer: 1,
        why: "Cada elétron excitado deixa uma lacuna; os elétrons vizinhos ocupando-a fazem a lacuna andar como uma carga $+e$.",
      },
    ],
    "41-7": [
      {
        q: "Dopar o silício com fósforo (5 elétrons de valência) produz um semicondutor:",
        options: ["Tipo p", "Tipo n", "Isolante", "Metálico"],
        answer: 1,
        why: "O quinto elétron fica num nível doador logo abaixo da banda de condução e é facilmente liberado: os portadores majoritários são elétrons.",
      },
    ],
    "41-8": [
      {
        q: "O que existe na região de depleção de uma junção p-n sem tensão aplicada?",
        options: ["Muitos portadores livres", "Íons fixos descobertos e um campo elétrico interno, quase sem portadores livres", "Nada, é vácuo", "Corrente elevada"],
        answer: 1,
        why: "A difusão de elétrons e lacunas através da junção deixa íons fixos dos dois lados; o campo deles barra a continuação da difusão.",
      },
    ],
    "41-9": [
      {
        q: "Num diodo retificador ideal, com polarização reversa:",
        options: ["A corrente é grande", "Praticamente não há corrente", "A corrente é alternada", "O diodo queima sempre"],
        answer: 1,
        why: "A tensão reversa alarga a região de depleção e só uma corrente minúscula de portadores minoritários atravessa; o diodo conduz num sentido só.",
      },
    ],
    "41-10": [
      {
        q: "O que determina a cor de um LED?",
        options: ["A cor do plástico", "A energia do gap do semicondutor", "A corrente", "A tensão da fonte"],
        answer: 1,
        why: "O fóton sai na recombinação elétron–lacuna com energia $\\approx E_g$: $\\lambda = hc/E_g$. Gaps maiores dão luz mais azul.",
      },
    ],
    "41-11": [
      {
        q: "Num transistor de efeito de campo (MOSFET), o que controla a corrente entre fonte e dreno?",
        options: ["A temperatura", "A tensão na porta, que cria ou desfaz o canal condutor", "A luz", "A corrente na porta"],
        answer: 1,
        why: "A porta é isolada; a tensão nela atrai portadores e forma o canal. É essa chave controlada por tensão que compõe os chips digitais.",
      },
    ],
  },
};
