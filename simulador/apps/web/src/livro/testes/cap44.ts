import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 44,
  sections: {
    "44-2": [
      {
        q: "O que distingue férmions de bósons?",
        options: ["A massa", "O spin: semi-inteiro nos férmions (obedecem a Pauli), inteiro nos bósons", "A carga", "A vida média"],
        answer: 1,
        why: "Elétrons, prótons e quarks são férmions; fótons, glúons e o Higgs são bósons.",
      },
    ],
    "44-3": [
      {
        q: "Um elétron e um pósitron em repouso se aniquilam. O que é produzido, no caso mais comum?",
        options: ["Um fóton de 1,022 MeV", "Dois fótons de 511 keV em sentidos opostos", "Um próton", "Nada"],
        answer: 1,
        why: "Um fóton só não conservaria o momento (nulo antes). Os dois fótons de 511 keV são detectados na tomografia por emissão de pósitrons (PET).",
      },
    ],
    "44-4": [
      {
        q: "Quantos números leptônicos se conservam separadamente no Modelo Padrão (sem considerar a oscilação de neutrinos)?",
        options: ["Um só", "Três: eletrônico, muônico e tauônico", "Nenhum", "Seis"],
        answer: 1,
        why: "É por isso que $\\mu^- \\to e^- + \\gamma$ nunca foi observado: violaria os números leptônicos do múon e do elétron.",
      },
    ],
    "44-5": [
      {
        q: "O que todos os hádrons têm em comum?",
        options: ["São léptons", "Sentem a interação forte (são feitos de quarks)", "Têm spin zero", "São estáveis"],
        answer: 1,
        why: "Hádrons se dividem em bárions (três quarks, como o próton) e mésons (quark e antiquark, como o píon).",
      },
    ],
    "44-6": [
      {
        q: "Por que se diz que a estranheza se conserva nas interações fortes, mas não nas fracas?",
        options: ["Porque as partículas estranhas não existem", "Porque partículas estranhas são produzidas aos pares rapidamente (forte), mas decaem devagar (fraca) mudando a estranheza", "Porque é uma convenção", "Porque só vale para léptons"],
        answer: 1,
        why: "A produção associada é forte e conserva a estranheza; o decaimento lento (cerca de $10^{-10}$ s) indica a interação fraca, que pode mudá-la.",
      },
    ],
    "44-7": [
      {
        q: "Qual previsão confirmou o caminho óctuplo?",
        options: ["A existência do elétron", "A existência e a massa da partícula $\\Omega^-$", "A massa do próton", "O neutrino"],
        answer: 1,
        why: "O decupleto de bárions tinha uma vaga; Gell-Mann previu a $\\Omega^-$, com estranheza −3 e massa perto de 1680 MeV, encontrada em 1964.",
      },
    ],
    "44-8": [
      {
        q: "Qual é a composição de quarks do próton?",
        options: ["$udd$", "$uud$", "$uuu$", "$u\\bar d$"],
        answer: 1,
        why: "Cargas $+\\tfrac23 + \\tfrac23 - \\tfrac13 = +1$. O nêutron é $udd$ e o píon positivo é $u\\bar d$.",
      },
    ],
    "44-9": [
      {
        q: "Qual partícula mensageira transmite a interação forte entre quarks?",
        options: ["O fóton", "O glúon", "O bóson W", "O gráviton"],
        answer: 1,
        why: "Glúons carregam a cor. Fótons transmitem a eletromagnética e os bósons $W^\\pm$ e $Z^0$, a fraca.",
      },
    ],
    "44-10": [
      {
        q: "Segundo o Modelo Padrão, quais partículas são realmente fundamentais (sem estrutura interna conhecida)?",
        options: ["Prótons e nêutrons", "Quarks, léptons, bósons mensageiros e o Higgs", "Átomos", "Píons"],
        answer: 1,
        why: "Prótons, nêutrons e píons são compostos de quarks; a lista atual é de 6 quarks, 6 léptons, os mensageiros e o Higgs.",
      },
    ],
    "44-11": [
      {
        q: "Uma galáxia a 100 Mpc, com $H_0 = 70$ km/(s·Mpc), afasta-se a que velocidade?",
        options: ["70 km/s", "7000 km/s", "700 km/s", "0,7 km/s"],
        answer: 1,
        why: "Lei de Hubble: $v = H_0 d = 70\\cdot100$ km/s. O inverso de $H_0$ dá a ordem de grandeza da idade do universo, cerca de 14 bilhões de anos.",
      },
    ],
    "44-12": [
      {
        q: "A radiação cósmica de fundo tem hoje um espectro de corpo negro a cerca de:",
        options: ["3000 K", "2,7 K", "300 K", "0 K"],
        answer: 1,
        why: "Ela foi emitida a cerca de 3000 K, quando os átomos se formaram, e a expansão esticou os comprimentos de onda por um fator de cerca de 1100.",
      },
    ],
    "44-13": [
      {
        q: "Que observação aponta para a matéria escura nas galáxias?",
        options: ["Estrelas mais quentes no centro", "Curvas de rotação planas: estrelas distantes giram rápido demais para a massa visível", "Galáxias se afastando", "Supernovas"],
        answer: 1,
        why: "Sem massa extra, a velocidade orbital deveria cair como $1/\\sqrt r$ longe do centro; o que se mede é aproximadamente constante.",
      },
    ],
    "44-14": [
      {
        q: "Qual destas é uma evidência do Big Bang?",
        options: ["O céu ser escuro de dia", "A abundância de hélio (cerca de 25% da massa) e a radiação de fundo", "A rotação da Terra", "O formato das constelações"],
        answer: 1,
        why: "A nucleossíntese nos primeiros minutos prevê as proporções de hélio e deutério observadas, e a radiação de fundo é o eco térmico do universo quente.",
      },
    ],
    "44-15": [
      {
        q: "Qual destas questões continua em aberto na física?",
        options: ["A carga do elétron", "A natureza da matéria e da energia escuras", "A lei de Coulomb", "A existência do núcleo"],
        answer: 1,
        why: "Matéria e energia escuras somam cerca de 95% do conteúdo do universo e ainda não se sabe o que são; a unificação da gravidade com a mecânica quântica também está em aberto.",
      },
    ],
  },
};
