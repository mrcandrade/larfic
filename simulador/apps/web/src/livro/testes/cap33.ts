import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 33,
  sections: {
    "33-2": [
      {
        q: "O que diferencia raios X, luz visível e ondas de rádio?",
        options: ["A velocidade no vácuo", "O comprimento de onda (e a frequência)", "A natureza: só a luz é eletromagnética", "A carga que transportam"],
        answer: 1,
        why: "Todas são ondas eletromagnéticas que viajam a $c$ no vácuo; diferem só em $\\lambda$ e $f$, com $c = \\lambda f$.",
      },
    ],
    "33-3": [
      {
        q: "Numa onda eletromagnética no vácuo, como se orientam $\\vec E$, $\\vec B$ e a direção de propagação?",
        options: ["Todos paralelos", "Mutuamente perpendiculares, com a propagação na direção de $\\vec E\\times\\vec B$", "$\\vec E$ paralelo à propagação", "$\\vec B$ paralelo a $\\vec E$"],
        answer: 1,
        why: "A onda é transversal e os campos oscilam em fase, perpendiculares entre si e à direção de propagação.",
      },
    ],
    "33-4": [
      {
        q: "Numa onda eletromagnética, se a amplitude do campo elétrico é 300 V/m, a do campo magnético é:",
        options: ["300 T", "1 μT", "$9\\times10^{10}$ T", "1 mT"],
        answer: 1,
        why: "$E/B = c$, logo $B = 300/(3\\times10^8) = 10^{-6}$ T.",
      },
    ],
    "33-5": [
      {
        q: "Uma lâmpada emite igualmente em todas as direções. A 2 m dela a intensidade é $I$. Quanto vale a 4 m?",
        options: ["$I/2$", "$I/4$", "$I/16$", "$I$"],
        answer: 1,
        why: "A potência se espalha numa esfera de área $4\\pi r^2$: dobrar a distância divide a intensidade por 4.",
      },
    ],
    "33-6": [
      {
        q: "A pressão de radiação sobre uma superfície que reflete totalmente a luz, comparada à de uma que absorve tudo, é:",
        options: ["Igual", "O dobro", "Metade", "Zero"],
        answer: 1,
        why: "Na reflexão o momento da luz se inverte, e a variação de momento é o dobro: $p_r = 2I/c$ contra $I/c$. É o princípio das velas solares.",
      },
    ],
    "33-7": [
      {
        q: "Luz não polarizada passa por dois polarizadores com eixos a 60°. Que fração da intensidade original sai?",
        options: ["1/2", "1/8", "1/4", "Zero"],
        answer: 1,
        why: "O primeiro deixa passar 1/2; o segundo multiplica por $\\cos^2 60° = 1/4$ (lei de Malus): no total, 1/8.",
      },
    ],
    "33-8": [
      {
        q: "A luz passa do ar para o vidro ($n = 1{,}5$) com incidência de 30°. O raio refratado:",
        options: ["Se afasta da normal", "Se aproxima da normal", "Não muda de direção", "É totalmente refletido"],
        answer: 1,
        why: "$n_1\\,\\text{sen}\\,\\theta_1 = n_2\\,\\text{sen}\\,\\theta_2$: com $n_2 > n_1$, $\\theta_2 \\approx 19{,}5°$, menor que 30°.",
      },
    ],
    "33-9": [
      {
        q: "A reflexão interna total pode acontecer quando a luz vai:",
        options: ["Do ar para a água", "Da água para o ar, com ângulo acima do ângulo crítico", "Do ar para o vidro", "Em qualquer interface"],
        answer: 1,
        why: "É preciso sair de um meio mais refringente para um menos refringente. Para água–ar, $\\theta_c = \\text{arcsen}(1/1{,}33) \\approx 49°$. Fibras ópticas funcionam assim.",
      },
    ],
    "33-10": [
      {
        q: "No ângulo de Brewster, a luz refletida é:",
        options: ["Não polarizada", "Totalmente polarizada, perpendicular ao plano de incidência", "Totalmente polarizada no plano de incidência", "Nula"],
        answer: 1,
        why: "Com $\\tan\\theta_B = n_2/n_1$, a componente paralela ao plano de incidência não é refletida. Óculos polarizados cortam esse reflexo da água e do asfalto.",
      },
    ],
  },
};
