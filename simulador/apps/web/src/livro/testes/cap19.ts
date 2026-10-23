import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 19,
  sections: {
    "19-2": [
      {
        q: "Quantas moléculas há em 36 g de água ($M = 18$ g/mol)?",
        options: ["$6{,}02\\times10^{23}$", "$1{,}2\\times10^{24}$", "36", "$3{,}0\\times10^{23}$"],
        answer: 1,
        why: "36 g são 2 mol, e cada mol tem $N_A = 6{,}02\\times10^{23}$ moléculas.",
      },
    ],
    "19-3": [
      {
        q: "Um gás ideal num recipiente rígido é aquecido de 300 K para 600 K. A pressão:",
        options: ["Cai à metade", "Dobra", "Fica igual", "Quadruplica"],
        answer: 1,
        why: "$pV = nRT$ com $V$ e $n$ fixos: $p \\propto T$ (em kelvin).",
      },
    ],
    "19-4": [
      {
        q: "Se a temperatura absoluta de um gás quadruplica, a velocidade média quadrática das moléculas:",
        options: ["Quadruplica", "Dobra", "Fica igual", "Aumenta 16 vezes"],
        answer: 1,
        why: "$v_{rms} = \\sqrt{3RT/M}$ cresce com a raiz de $T$.",
      },
    ],
    "19-5": [
      {
        q: "Hidrogênio e oxigênio estão à mesma temperatura. Comparando a energia cinética de translação média por molécula:",
        options: ["A do hidrogênio é maior", "São iguais", "A do oxigênio é maior", "Depende da pressão"],
        answer: 1,
        why: "$K_{méd} = \\tfrac32kT$ só depende da temperatura. As moléculas de hidrogênio são mais rápidas porque são mais leves.",
      },
    ],
    "19-6": [
      {
        q: "Se a densidade de moléculas de um gás dobra (mesma temperatura), o livre caminho médio:",
        options: ["Dobra", "Cai à metade", "Fica igual", "Quadruplica"],
        answer: 1,
        why: "$\\lambda = 1/(\\sqrt2\\pi d^2 N/V)$: com o dobro de moléculas por volume, as colisões ficam duas vezes mais frequentes.",
      },
    ],
    "19-7": [
      {
        q: "Na distribuição de Maxwell, como se ordenam a velocidade mais provável, a média e a quadrática média?",
        options: ["$v_p < v_{méd} < v_{rms}$", "$v_{rms} < v_{méd} < v_p$", "São todas iguais", "$v_{méd} < v_p < v_{rms}$"],
        answer: 0,
        why: "A cauda longa de moléculas rápidas puxa a média e, mais ainda, a média quadrática para cima do pico.",
      },
    ],
    "19-8": [
      {
        q: "Por que $C_p$ é maior que $C_V$ para um gás ideal?",
        options: ["Porque a pressão constante aumenta a massa", "Porque a pressão constante o gás se expande e parte do calor vira trabalho", "Porque o volume constante libera energia", "Não é: são iguais"],
        answer: 1,
        why: "Para a mesma $\\Delta T$, a energia interna varia igual; a pressão constante é preciso calor extra para o trabalho de expansão: $C_p - C_V = R$.",
      },
    ],
    "19-9": [
      {
        q: "Qual é o $C_V$ molar esperado para um gás diatômico à temperatura ambiente?",
        options: ["$\\tfrac32R$", "$\\tfrac52R$", "$\\tfrac72R$", "$3R$"],
        answer: 1,
        why: "Três graus de translação e dois de rotação, cada um com $\\tfrac12R$ pela equipartição. A vibração ainda está \"congelada\".",
      },
    ],
    "19-10": [
      {
        q: "Por que a vibração das moléculas de H₂ não contribui para o calor específico a 300 K?",
        options: ["Porque as moléculas não vibram", "Porque a energia vibracional é quantizada e $kT$ é pequeno demais para excitar o primeiro nível", "Porque a vibração é proibida pela segunda lei", "Porque a molécula se dissocia"],
        answer: 1,
        why: "A equipartição clássica só vale quando $kT$ é grande comparado ao espaçamento dos níveis; a vibração do H₂ só aparece acima de milhares de kelvin.",
      },
    ],
    "19-11": [
      {
        q: "Um gás ideal é comprimido adiabaticamente. A temperatura dele:",
        options: ["Diminui", "Aumenta", "Fica igual", "Vai a zero"],
        answer: 1,
        why: "Sem troca de calor, o trabalho feito sobre o gás vira energia interna. É assim que o motor diesel inflama o combustível.",
      },
    ],
  },
};
