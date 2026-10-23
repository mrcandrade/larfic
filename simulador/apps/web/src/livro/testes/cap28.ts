import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 28,
  sections: {
    "28-1": [
      {
        q: "Uma carga se move paralelamente a um campo magnético. Qual é a força magnética sobre ela?",
        options: ["Máxima", "Zero", "$qvB/2$", "Depende do sinal da carga"],
        answer: 1,
        why: "$\\vec F = q\\vec v\\times\\vec B$ tem módulo $|q|vB\\,\\text{sen}\\,\\phi$, nulo para $\\phi = 0$.",
      },
      {
        q: "A força magnética sobre uma carga em movimento pode mudar a energia cinética dela?",
        options: ["Sim, sempre", "Não: ela é perpendicular à velocidade e não realiza trabalho", "Só se a carga for negativa", "Só em campos fortes"],
        answer: 1,
        why: "Sendo sempre perpendicular a $\\vec v$, a força magnética muda só a direção do movimento.",
      },
    ],
    "28-2": [
      {
        q: "No experimento de Thomson, o feixe passa sem desvio pelos campos cruzados quando:",
        options: ["$v = EB$", "$v = E/B$", "$v = B/E$", "$E = 0$"],
        answer: 1,
        why: "As forças elétrica ($qE$) e magnética ($qvB$) se cancelam para $v = E/B$; é assim que se seleciona a velocidade e se mede $e/m$.",
      },
    ],
    "28-3": [
      {
        q: "O que o sinal da tensão Hall revela sobre um material?",
        options: ["A temperatura", "O sinal dos portadores de carga", "A massa dos elétrons", "A resistividade apenas"],
        answer: 1,
        why: "Portadores positivos e negativos se acumulam em lados opostos da fita; o efeito Hall mostrou que em alguns semicondutores a condução é por lacunas.",
      },
    ],
    "28-4": [
      {
        q: "Se a velocidade de um próton num campo magnético uniforme dobra, o período do movimento circular:",
        options: ["Dobra", "Cai à metade", "Fica igual", "Quadruplica"],
        answer: 2,
        why: "$r = mv/|q|B$ dobra, mas o caminho e a velocidade dobram juntos: $T = 2\\pi m/|q|B$ não depende de $v$.",
      },
    ],
    "28-5": [
      {
        q: "Por que o cíclotron pode usar uma tensão alternada de frequência fixa?",
        options: ["Porque o raio é constante", "Porque a frequência de revolução não depende da velocidade (enquanto o movimento não é relativístico)", "Porque o campo magnético varia", "Porque as partículas não aceleram"],
        answer: 1,
        why: "A frequência de cíclotron $f = |q|B/2\\pi m$ é fixa; perto da velocidade da luz isso deixa de valer e é preciso o síncrotron.",
      },
    ],
    "28-6": [
      {
        q: "Um fio de 0,5 m com 4 A está perpendicular a um campo de 0,2 T. Qual é a força?",
        options: ["0,4 N", "4 N", "0,1 N", "1,6 N"],
        answer: 0,
        why: "$F = iLB\\,\\text{sen}\\,90° = 4\\cdot0{,}5\\cdot0{,}2 = 0{,}4$ N.",
      },
    ],
    "28-7": [
      {
        q: "Numa espira com corrente num campo uniforme, quando o torque é máximo?",
        options: ["Quando o plano da espira é perpendicular ao campo", "Quando o plano da espira é paralelo ao campo", "Sempre igual", "Nunca há torque"],
        answer: 1,
        why: "$\\tau = NiAB\\,\\text{sen}\\,\\theta$ com $\\theta$ entre a normal e o campo: máximo quando a normal é perpendicular a $\\vec B$, isto é, o plano paralelo. É o princípio do motor elétrico.",
      },
    ],
    "28-8": [
      {
        q: "Qual é a orientação de menor energia de um dipolo magnético num campo?",
        options: ["Antiparalelo ao campo", "Paralelo ao campo", "Perpendicular", "Qualquer uma"],
        answer: 1,
        why: "$U = -\\vec\\mu\\cdot\\vec B$ é mínima com $\\vec\\mu$ paralelo a $\\vec B$, como uma bússola que se alinha.",
      },
    ],
  },
};
