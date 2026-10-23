import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 36,
  sections: {
    "36-2": [
      {
        q: "O que a mancha clara no centro da sombra de um disco (mancha de Fresnel–Arago) mostrou?",
        options: ["Que a luz é feita de partículas", "Que a luz é uma onda: as ondas difratadas pela borda chegam em fase no centro", "Que o disco era transparente", "Um erro do experimento"],
        answer: 1,
        why: "Poisson achou absurda essa previsão da teoria ondulatória de Fresnel; Arago fez o experimento e viu a mancha.",
      },
    ],
    "36-3": [
      {
        q: "Numa fenda simples de largura $a$, onde fica o primeiro mínimo de difração?",
        options: ["$a\\,\\text{sen}\\,\\theta = \\lambda/2$", "$a\\,\\text{sen}\\,\\theta = \\lambda$", "$a\\,\\text{sen}\\,\\theta = 2\\lambda$", "$\\theta = 0$"],
        answer: 1,
        why: "Dividindo a fenda em duas metades, cada ponto de uma cancela o correspondente da outra quando a diferença de caminho é $\\lambda/2$, o que dá $a\\,\\text{sen}\\,\\theta = \\lambda$.",
      },
    ],
    "36-4": [
      {
        q: "No método dos fasores para uma fenda, o que acontece no primeiro mínimo?",
        options: ["Os fasores ficam todos alinhados", "A cadeia de fasores se fecha num círculo e a resultante é zero", "Os fasores ficam perpendiculares", "A cadeia fica reta e longa"],
        answer: 1,
        why: "A diferença de fase total entre as bordas é $2\\pi$; a cadeia dá uma volta completa e volta ao ponto de partida.",
      },
    ],
    "36-5": [
      {
        q: "Se a fenda é estreitada, o máximo central de difração fica:",
        options: ["Mais estreito", "Mais largo", "Igual", "Some"],
        answer: 1,
        why: "Os mínimos estão em $\\text{sen}\\,\\theta = m\\lambda/a$: fenda menor espalha mais a luz.",
      },
    ],
    "36-6": [
      {
        q: "Por que telescópios grandes resolvem detalhes menores?",
        options: ["Porque captam luz mais rápida", "Porque o ângulo mínimo resolvível $1{,}22\\lambda/d$ diminui com o diâmetro", "Porque aumentam mais", "Porque eliminam a atmosfera"],
        answer: 1,
        why: "O critério de Rayleigh limita a resolução pela difração na abertura; maior diâmetro, menor disco de Airy.",
      },
    ],
    "36-7": [
      {
        q: "Num padrão de duas fendas reais, o que a difração de cada fenda faz com as franjas de interferência?",
        options: ["Nada", "Modula a intensidade: as franjas ficam dentro de uma envoltória de difração", "Desloca todas as franjas", "Inverte o padrão"],
        answer: 1,
        why: "A intensidade é o produto do fator de interferência ($\\cos^2\\beta$) pelo de difração ($(\\text{sen}\\,\\alpha/\\alpha)^2$); algumas franjas podem sumir onde cai um mínimo de difração.",
      },
    ],
    "36-8": [
      {
        q: "Por que uma rede de difração com milhares de fendas produz linhas tão finas?",
        options: ["Porque bloqueia a maior parte da luz", "Porque, fora dos ângulos exatos $d\\,\\text{sen}\\,\\theta = m\\lambda$, as contribuições de muitas fendas se cancelam", "Porque usa luz laser", "Porque as fendas são largas"],
        answer: 1,
        why: "A meia largura de cada linha cai com o número de fendas $N$; com $N$ grande, as linhas ficam estreitas e brilhantes.",
      },
    ],
    "36-9": [
      {
        q: "O poder de resolução de uma rede é $R = Nm$. Para separar duas linhas mais próximas, você pode:",
        options: ["Usar menos fendas", "Iluminar mais fendas ou usar uma ordem mais alta", "Usar a ordem zero", "Diminuir a intensidade"],
        answer: 1,
        why: "$R = \\lambda_{méd}/\\Delta\\lambda = Nm$; a ordem zero não separa cores, porque todas vão para $\\theta = 0$.",
      },
    ],
    "36-10": [
      {
        q: "Raios X de 0,10 nm refletem em planos cristalinos separados de 0,20 nm. Em que ângulo aparece o máximo de primeira ordem?",
        options: ["30°", "14,5°", "60°", "90°"],
        answer: 1,
        why: "Lei de Bragg: $2d\\,\\text{sen}\\,\\theta = m\\lambda$ dá $\\text{sen}\\,\\theta = 0{,}25$, $\\theta \\approx 14{,}5°$ (medido a partir dos planos).",
      },
    ],
  },
};
