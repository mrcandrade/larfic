import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 1,
  sections: {
    "1-2": [
      {
        q: "Um laboratório decide medir comprimentos com a largura de um caderno qualquer. Qual é o principal problema desse padrão?",
        options: ["Não é reprodutível: outro laboratório não consegue obter exatamente o mesmo padrão", "Cadernos são grandes demais para medir objetos pequenos", "Comprimento não pode ter padrão, só tempo e massa", "O padrão deveria ser uma grandeza derivada"],
        answer: 0,
        why: "Um bom padrão precisa ser acessível e invariável, para que qualquer pessoa obtenha o mesmo valor. Por isso hoje os padrões são definidos por constantes da natureza.",
      },
    ],
    "1-3": [
      {
        q: "No SI, qual destas unidades é derivada (e não de base)?",
        options: ["quilograma", "ampère", "newton", "kelvin"],
        answer: 2,
        why: "O newton é definido a partir das unidades de base: $1\\,\\text{N} = 1\\,\\text{kg}\\cdot\\text{m/s}^2$. Quilograma, ampère e kelvin estão entre as sete unidades de base.",
      },
      {
        q: "Quanto vale 3,2 GHz em notação científica?",
        options: ["$3{,}2\\times10^{6}$ Hz", "$3{,}2\\times10^{9}$ Hz", "$3{,}2\\times10^{12}$ Hz", "$3{,}2\\times10^{-9}$ Hz"],
        answer: 1,
        why: "O prefixo giga (G) vale $10^9$. Mega é $10^6$ e tera é $10^{12}$.",
      },
    ],
    "1-4": [
      {
        q: "Para converter 72 km/h em m/s, por qual fator de conversão (igual a 1) você multiplica?",
        options: ["$\\frac{1000\\ \\text{m}}{1\\ \\text{km}}\\cdot\\frac{1\\ \\text{h}}{3600\\ \\text{s}}$", "$\\frac{1\\ \\text{km}}{1000\\ \\text{m}}\\cdot\\frac{3600\\ \\text{s}}{1\\ \\text{h}}$", "$\\frac{1000\\ \\text{m}}{1\\ \\text{km}}\\cdot\\frac{3600\\ \\text{s}}{1\\ \\text{h}}$", "$\\frac{1\\ \\text{h}}{60\\ \\text{s}}$"],
        answer: 0,
        why: "Escolha os fatores que cancelam km e h: $72\\cdot\\frac{1000}{3600} = 20$ m/s. Os outros deixam km ou h sobrando no resultado.",
      },
    ],
    "1-5": [
      {
        q: "Um terreno quadrado tem 20 m de lado. Quanto vale a área em cm²?",
        options: ["$4\\times10^{4}$ cm²", "$4\\times10^{6}$ cm²", "$2\\times10^{3}$ cm²", "$4\\times10^{2}$ cm²"],
        answer: 1,
        why: "A área é $400\\ \\text{m}^2$ e $1\\ \\text{m}^2 = (100\\ \\text{cm})^2 = 10^4\\ \\text{cm}^2$, logo $4\\times10^6$ cm². O erro comum é converter só uma vez o fator 100.",
      },
      {
        q: "Uma medida registrada como 0,004050 m tem quantos algarismos significativos?",
        options: ["7", "4", "3", "6"],
        answer: 1,
        why: "Os zeros à esquerda só posicionam a vírgula; contam o 4, o 0 do meio, o 5 e o zero final, que indica precisão: quatro algarismos.",
      },
    ],
    "1-6": [
      {
        q: "Por que o segundo é definido por uma transição do átomo de césio e não pela rotação da Terra?",
        options: ["Porque a rotação da Terra varia (e está ficando mais lenta), enquanto a transição atômica é a mesma em qualquer átomo", "Porque o césio é radioativo e decai num ritmo fixo", "Porque a rotação da Terra é rápida demais para ser medida", "Porque o dia não tem exatamente 24 horas por causa dos fusos horários"],
        answer: 0,
        why: "A duração do dia oscila em milissegundos e cresce lentamente com o atrito das marés; a frequência da transição hiperfina do césio é igual para todos os átomos e reprodutível em qualquer laboratório.",
      },
    ],
    "1-7": [
      {
        q: "A massa específica do alumínio é 2,7 g/cm³. Qual é a massa de um cubo de alumínio de 2 cm de aresta?",
        options: ["5,4 g", "10,8 g", "21,6 g", "2,7 g"],
        answer: 2,
        why: "O volume é $2^3 = 8\\ \\text{cm}^3$ e $m = \\rho V = 2{,}7\\cdot 8 = 21{,}6$ g. Multiplicar pela aresta em vez do volume dá 5,4 g.",
      },
    ],
  },
};
