import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 29,
  sections: {
    "29-1": [
      {
        q: "A 1 cm de um fio longo com corrente o campo vale $B$. Quanto vale a 4 cm?",
        options: ["$B/16$", "$B/4$", "$4B$", "$B/2$"],
        answer: 1,
        why: "Para um fio longo, $B = \\mu_0 i/(2\\pi r)$: o campo cai com $1/r$, não com $1/r^2$.",
      },
    ],
    "29-2": [
      {
        q: "Dois fios paralelos conduzem correntes no mesmo sentido. Eles:",
        options: ["Se repelem", "Se atraem", "Não interagem", "Giram"],
        answer: 1,
        why: "O campo de um fio faz força $i\\vec L\\times\\vec B$ no outro apontando para ele. Correntes opostas se repelem.",
      },
    ],
    "29-3": [
      {
        q: "Pela lei de Ampère, $\\oint\\vec B\\cdot d\\vec s$ ao longo de uma curva fechada depende de:",
        options: ["Todas as correntes do circuito", "Só da corrente que atravessa a superfície limitada pela curva", "Do tamanho da curva", "Da forma da curva"],
        answer: 1,
        why: "$\\oint\\vec B\\cdot d\\vec s = \\mu_0 i_{env}$. Correntes fora da curva alteram $\\vec B$ ponto a ponto, mas não a circulação.",
      },
    ],
    "29-4": [
      {
        q: "Dentro de um solenoide ideal longo, o campo magnético:",
        options: ["Cresce perto das espiras", "É uniforme e vale $\\mu_0 in$", "É zero", "Cai com $1/r$"],
        answer: 1,
        why: "A lei de Ampère num retângulo dá $B = \\mu_0 in$, com $n$ espiras por metro, independente da posição dentro. Fora, o campo é praticamente nulo.",
      },
    ],
    "29-5": [
      {
        q: "Longe de uma pequena espira com corrente, o campo magnético se parece com o de:",
        options: ["Um fio longo", "Um dipolo, como o de um ímã em barra", "Uma carga elétrica pontual", "Um solenoide infinito"],
        answer: 1,
        why: "No eixo, $B = \\mu_0\\mu/(2\\pi z^3)$, a mesma forma do campo de um dipolo elétrico. Por isso uma espira é um pequeno ímã.",
      },
    ],
  },
};
