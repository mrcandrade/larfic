import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 40,
  sections: {
    "40-2": [
      {
        q: "Por que gases nobres como hélio e neônio quase não reagem?",
        options: ["Porque são leves", "Porque têm camadas completas, com energia de ionização alta", "Porque não têm elétrons", "Porque são radioativos"],
        answer: 1,
        why: "A energia de ionização tem picos nos gases nobres e cai bruscamente no metal alcalino seguinte, que tem um elétron sozinho numa camada nova.",
      },
    ],
    "40-3": [
      {
        q: "Quantos valores pode ter a componente $z$ do spin de um elétron?",
        options: ["1", "2", "3", "Infinitos"],
        answer: 1,
        why: "$m_s = \\pm\\tfrac12$: \"para cima\" e \"para baixo\". O spin é intrínseco e não corresponde a uma bolinha girando de verdade.",
      },
    ],
    "40-4": [
      {
        q: "Para $\\ell = 2$, quantos valores de $m_\\ell$ são possíveis?",
        options: ["2", "5", "3", "4"],
        answer: 1,
        why: "$m_\\ell$ vai de $-\\ell$ a $+\\ell$: $-2, -1, 0, 1, 2$. A componente $L_z = m_\\ell\\hbar$ é quantizada.",
      },
    ],
    "40-5": [
      {
        q: "O que o experimento de Stern–Gerlach com átomos de prata mostrou?",
        options: ["Uma mancha contínua, como esperado classicamente", "O feixe se dividindo em duas manchas: quantização espacial do momento magnético", "Nenhum desvio", "Três manchas"],
        answer: 1,
        why: "O campo não uniforme separa os átomos conforme a componente do momento magnético, que só tem dois valores (spin do elétron externo).",
      },
    ],
    "40-6": [
      {
        q: "Na ressonância magnética nuclear, a frequência absorvida é proporcional a:",
        options: ["A temperatura", "O campo magnético aplicado", "O volume da amostra", "A massa do núcleo só"],
        answer: 1,
        why: "$hf = 2\\mu_z B$: o fóton absorvido inverte o spin. Para prótons em 1,5 T, a frequência é cerca de 64 MHz.",
      },
    ],
    "40-7": [
      {
        q: "O que diz o princípio de exclusão de Pauli?",
        options: ["Dois elétrons não podem estar no mesmo átomo", "Dois elétrons num mesmo sistema não podem ter todos os números quânticos iguais", "Elétrons se repelem", "Só dois elétrons por átomo"],
        answer: 1,
        why: "Cada estado ($n, \\ell, m_\\ell, m_s$) comporta um elétron; isso organiza as camadas e dá estrutura à tabela periódica.",
      },
    ],
    "40-8": [
      {
        q: "Cinco elétrons num poço infinito unidimensional, no estado de menor energia total. Qual é o nível mais alto ocupado?",
        options: ["$n = 5$", "$n = 3$", "$n = 1$", "$n = 2$"],
        answer: 1,
        why: "Dois elétrons (spins opostos) em $n = 1$, dois em $n = 2$, e o quinto vai para $n = 3$.",
      },
    ],
    "40-9": [
      {
        q: "Qual é a configuração eletrônica do sódio ($Z = 11$)?",
        options: ["$1s^2\\,2s^2\\,2p^7$", "$1s^2\\,2s^2\\,2p^6\\,3s^1$", "$1s^2\\,2s^2\\,2p^6\\,3p^1$", "$1s^2\\,2p^9$"],
        answer: 1,
        why: "A subcamada 2p comporta 6 elétrons; o 11º vai para 3s, que tem energia menor que 3p. O elétron isolado explica a reatividade do sódio.",
      },
    ],
    "40-10": [
      {
        q: "O que mostra a lei de Moseley sobre as linhas $K_\\alpha$ dos elementos?",
        options: ["$\\sqrt f$ cresce linearmente com o número atômico $Z$", "$f$ não depende de $Z$", "$f$ cai com a massa atômica", "Só os metais emitem raios X"],
        answer: 0,
        why: "Moseley ordenou os elementos pela carga nuclear, não pela massa, e previu elementos que ainda faltavam na tabela.",
      },
    ],
    "40-11": [
      {
        q: "O que distingue a luz de um laser da de uma lâmpada comum?",
        options: ["Só a cor", "É muito monocromática, coerente, direcional e pode ser muito concentrada", "Tem fótons mais rápidos", "É sempre invisível"],
        answer: 1,
        why: "A emissão estimulada produz fótons idênticos (mesma frequência, fase, direção e polarização) ao que a provocou.",
      },
    ],
    "40-12": [
      {
        q: "Por que um laser precisa de inversão de população?",
        options: ["Para esfriar o meio", "Para que a emissão estimulada supere a absorção", "Para mudar a cor", "Não precisa"],
        answer: 1,
        why: "Em equilíbrio térmico há mais átomos no nível baixo, e os fótons seriam mais absorvidos que multiplicados. Um nível metaestável permite acumular átomos no estado excitado.",
      },
    ],
  },
};
