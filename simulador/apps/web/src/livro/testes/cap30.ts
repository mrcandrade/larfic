import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 30,
  sections: {
    "30-1": [
      {
        q: "Um ímã fica parado dentro de uma bobina ligada a um galvanômetro. O que o aparelho indica?",
        options: ["Uma corrente constante", "Nenhuma corrente", "Uma corrente alternada", "Depende da força do ímã"],
        answer: 1,
        why: "A fem induzida é $-d\\Phi_B/dt$: sem variação de fluxo, não há corrente, por mais forte que seja o ímã.",
      },
      {
        q: "O polo norte de um ímã se aproxima de uma espira. Pela lei de Lenz, a face da espira voltada para o ímã vira:",
        options: ["Um polo sul, atraindo o ímã", "Um polo norte, repelindo o ímã", "Nenhum polo", "Alterna rapidamente"],
        answer: 1,
        why: "A corrente induzida se opõe à variação que a criou: a espira repele o ímã que chega.",
      },
    ],
    "30-2": [
      {
        q: "Uma espira é puxada para fora de um campo magnético com velocidade constante. De onde vem a energia térmica dissipada na espira?",
        options: ["Do campo magnético, que enfraquece", "Do trabalho de quem puxa a espira", "Da própria espira", "Não há dissipação"],
        answer: 1,
        why: "A corrente induzida sofre uma força que freia o movimento; manter a velocidade exige trabalho, que vira calor $i^2R$. É o princípio do freio magnético.",
      },
    ],
    "30-3": [
      {
        q: "Como são as linhas do campo elétrico induzido por um campo magnético variável com simetria cilíndrica?",
        options: ["Começam e terminam em cargas", "São círculos fechados em torno do eixo", "Saem radialmente do eixo", "São paralelas ao campo magnético"],
        answer: 1,
        why: "O campo elétrico induzido não é conservativo: $\\oint\\vec E\\cdot d\\vec s = -d\\Phi_B/dt \\neq 0$, e as linhas se fecham sobre si mesmas.",
      },
    ],
    "30-4": [
      {
        q: "A indutância de um solenoide depende de:",
        options: ["Da corrente que passa nele", "Só da geometria (espiras, área, comprimento) e do núcleo", "Da tensão aplicada", "Da frequência"],
        answer: 1,
        why: "$L = \\mu_0 n^2 A\\ell$ para o solenoide longo, assim como a capacitância só depende da geometria.",
      },
    ],
    "30-5": [
      {
        q: "A corrente num indutor de 2 H cai de 3 A para 1 A em 0,5 s. Qual é a fem autoinduzida?",
        options: ["4 V, tentando manter a corrente", "8 V, tentando manter a corrente", "8 V, ajudando a corrente a cair", "1 V"],
        answer: 1,
        why: "$|\\mathscr{E}| = L|di/dt| = 2\\cdot4 = 8$ V, com sentido que se opõe à queda (Lenz).",
      },
    ],
    "30-6": [
      {
        q: "Num circuito RL ligado a uma bateria, logo após fechar a chave, a corrente é:",
        options: ["Máxima, $\\mathscr{E}/R$", "Zero, e cresce com constante de tempo $L/R$", "Infinita", "Oscila"],
        answer: 1,
        why: "O indutor se opõe à variação brusca: $i(t) = (\\mathscr{E}/R)(1 - e^{-tR/L})$.",
      },
    ],
    "30-7": [
      {
        q: "Um indutor de 0,5 H conduz 4 A. Quanto energia está armazenada no campo magnético?",
        options: ["1 J", "4 J", "2 J", "8 J"],
        answer: 1,
        why: "$U_B = \\tfrac12Li^2 = \\tfrac12\\cdot0{,}5\\cdot16 = 4$ J.",
      },
    ],
    "30-8": [
      {
        q: "Num campo magnético de 1 T, qual é a densidade de energia?",
        options: ["$1/(2\\mu_0) \\approx 4\\times10^5$ J/m³", "1 J/m³", "$\\mu_0/2$ J/m³", "Zero"],
        answer: 0,
        why: "$u_B = B^2/2\\mu_0$. Campos de alguns tesla guardam muita energia por volume, como nos ímãs supercondutores de ressonância magnética.",
      },
    ],
    "30-9": [
      {
        q: "Num transformador ou par de bobinas acopladas, o que induz fem na bobina 2?",
        options: ["A corrente constante na bobina 1", "A variação da corrente na bobina 1", "A resistência da bobina 1", "O calor gerado"],
        answer: 1,
        why: "$\\mathscr{E}_2 = -M\\,di_1/dt$: só a corrente que varia produz fluxo variável na outra bobina.",
      },
    ],
  },
};
