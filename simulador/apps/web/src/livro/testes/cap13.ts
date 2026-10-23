import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 13,
  sections: {
    "13-2": [
      {
        q: "Se a distância entre dois corpos triplica, a força gravitacional entre eles:",
        options: ["Cai para 1/3", "Cai para 1/9", "Triplica", "Não muda"],
        answer: 1,
        why: "$F = Gm_1m_2/r^2$: com $r$ três vezes maior, a força fica $3^2 = 9$ vezes menor.",
      },
    ],
    "13-3": [
      {
        q: "Uma partícula está exatamente no meio entre duas esferas iguais. Qual é a força gravitacional resultante sobre ela?",
        options: ["O dobro da força de uma esfera", "Zero", "Aponta para cima", "Igual à de uma só esfera"],
        answer: 1,
        why: "Pela superposição, as duas forças têm o mesmo módulo e sentidos opostos e se cancelam.",
      },
    ],
    "13-4": [
      {
        q: "Por que a balança marca um pouco menos no equador do que nos polos?",
        options: ["Só porque a massa muda", "Porque a rotação da Terra exige parte do peso como força centrípeta e o equador está mais longe do centro", "Porque o ar é mais denso no equador", "Porque o campo magnético é mais fraco no equador"],
        answer: 1,
        why: "Os dois efeitos (achatamento e rotação) reduzem o $g$ efetivo no equador para cerca de 9,78 m/s², contra 9,83 m/s² nos polos.",
      },
    ],
    "13-5": [
      {
        q: "Supondo a Terra com densidade uniforme, como varia $g$ ao descer por um poço até o centro?",
        options: ["Aumenta até o centro", "Diminui linearmente até zero no centro", "Fica constante", "Cresce com $1/r^2$"],
        answer: 1,
        why: "Só a massa interna à esfera de raio $r$ atrai (a casca externa dá resultante nula), e ela cresce com $r^3$: $g \\propto r$.",
      },
    ],
    "13-6": [
      {
        q: "Qual é a velocidade de escape de um planeta de massa $M$ e raio $R$?",
        options: ["$\\sqrt{GM/R}$", "$\\sqrt{2GM/R}$", "$2GM/R$", "$GM/R^2$"],
        answer: 1,
        why: "Escapar é ter energia total $\\tfrac12mv^2 - GMm/R \\ge 0$. Não depende da massa do objeto lançado; para a Terra dá cerca de 11,2 km/s.",
      },
    ],
    "13-7": [
      {
        q: "Um planeta está quatro vezes mais longe do Sol do que outro (órbitas circulares). Quantas vezes maior é o período dele?",
        options: ["4", "8", "16", "2"],
        answer: 1,
        why: "Terceira lei de Kepler: $T^2 \\propto r^3$, então $T \\propto r^{3/2} = 4^{3/2} = 8$.",
      },
      {
        q: "Segundo a segunda lei de Kepler, onde um planeta anda mais depressa na órbita elíptica?",
        options: ["No afélio (mais longe do Sol)", "No periélio (mais perto do Sol)", "A velocidade é constante", "Nos pontos médios da elipse"],
        answer: 1,
        why: "A reta Sol–planeta varre áreas iguais em tempos iguais, o que equivale à conservação do momento angular: perto do Sol o raio é menor e a velocidade maior.",
      },
    ],
    "13-8": [
      {
        q: "Um satélite em órbita circular recebe um impulso que o leva a uma órbita circular mais alta. Na nova órbita, a velocidade dele é:",
        options: ["Maior", "Menor", "Igual", "Zero"],
        answer: 1,
        why: "$v = \\sqrt{GM/r}$ cai com o raio. A energia total $-GMm/2r$ aumenta (fica menos negativa), mas a cinética diminui.",
      },
    ],
    "13-9": [
      {
        q: "Segundo o princípio de equivalência, um astronauta num foguete fechado que acelera a $g$ no espaço:",
        options: ["Percebe a diferença soltando um objeto", "Não consegue distinguir, por experimentos locais, essa situação de estar parado na Terra", "Flutua", "Sente o dobro do peso"],
        answer: 1,
        why: "Localmente, aceleração e gravidade produzem os mesmos efeitos. Einstein partiu dessa ideia para a relatividade geral, que descreve a gravidade como curvatura do espaço-tempo.",
      },
    ],
  },
};
