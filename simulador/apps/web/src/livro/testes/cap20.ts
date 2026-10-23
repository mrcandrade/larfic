import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 20,
  sections: {
    "20-2": [
      {
        q: "Num sistema isolado, um processo irreversível sempre:",
        options: ["Diminui a entropia", "Aumenta a entropia", "Mantém a entropia", "Diminui a energia"],
        answer: 1,
        why: "A entropia é o que dá a seta do tempo: num sistema fechado, ela cresce nos processos irreversíveis (e fica constante nos reversíveis).",
      },
    ],
    "20-3": [
      {
        q: "Um gás ideal se expande livremente no vácuo (expansão de Joule), sem trocar calor. A entropia dele:",
        options: ["Não muda, porque $Q = 0$", "Aumenta, igual à de uma expansão isotérmica reversível entre os mesmos estados", "Diminui", "Vai a zero"],
        answer: 1,
        why: "A entropia é função de estado: calcula-se por um caminho reversível entre os mesmos estados, que dá $\\Delta S = nR\\ln(V_f/V_i) > 0$.",
      },
    ],
    "20-4": [
      {
        q: "A entropia da água que congela no freezer diminui. Isso viola a segunda lei?",
        options: ["Sim", "Não: a entropia do ambiente aumenta mais do que a da água diminui", "Não, porque o gelo não tem entropia", "Só se o freezer estiver desligado"],
        answer: 1,
        why: "A segunda lei vale para o sistema fechado inteiro. O calor jogado no ambiente pelo refrigerador aumenta a entropia total.",
      },
    ],
    "20-5": [
      {
        q: "Uma máquina de Carnot opera entre 600 K e 300 K. Qual é a eficiência dela?",
        options: ["100%", "50%", "33%", "200%"],
        answer: 1,
        why: "$\\varepsilon_C = 1 - T_F/T_Q = 1 - 300/600 = 0{,}5$. Nenhuma máquina real entre essas temperaturas faz melhor.",
      },
    ],
    "20-6": [
      {
        q: "Um refrigerador de Carnot opera entre −10 °C e 30 °C. Qual é o coeficiente de desempenho?",
        options: ["0,25", "6,6", "7,6", "1"],
        answer: 1,
        why: "$K_C = T_F/(T_Q - T_F) = 263/40 \\approx 6{,}6$. Use temperaturas em kelvin.",
      },
    ],
    "20-7": [
      {
        q: "Por que nenhuma máquina térmica real é mais eficiente que a de Carnot entre as mesmas temperaturas?",
        options: ["Por limitações de engenharia que podem ser vencidas", "Porque isso violaria a segunda lei da termodinâmica", "Porque a de Carnot é a mais barata", "Porque a de Carnot não tem atrito"],
        answer: 1,
        why: "Acoplar uma máquina \"melhor\" a um refrigerador de Carnot daria um refrigerador perfeito, que transfere calor do frio para o quente sem trabalho.",
      },
    ],
    "20-8": [
      {
        q: "Com 4 moléculas numa caixa dividida ao meio, qual configuração é a mais provável?",
        options: ["Todas de um lado", "Duas de cada lado", "Três de um lado e uma do outro", "Todas são igualmente prováveis"],
        answer: 1,
        why: "A configuração 2–2 tem $W = 4!/(2!\\,2!) = 6$ microestados, contra 4 da 3–1 e 1 da 4–0. Pela fórmula de Boltzmann, $S = k\\ln W$ é máxima nela.",
      },
    ],
  },
};
