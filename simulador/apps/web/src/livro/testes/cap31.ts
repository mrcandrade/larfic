import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 31,
  sections: {
    "31-1": [
      {
        q: "Num circuito LC ideal, com o capacitor totalmente carregado num instante, onde está a energia um quarto de período depois?",
        options: ["Toda no capacitor", "Toda no indutor (campo magnético)", "Dissipada", "Metade em cada"],
        answer: 1,
        why: "A energia oscila entre o campo elétrico e o magnético, como entre potencial e cinética num oscilador massa–mola.",
      },
      {
        q: "Qual é a frequência angular de um circuito LC?",
        options: ["$\\sqrt{LC}$", "$1/\\sqrt{LC}$", "$LC$", "$R/L$"],
        answer: 1,
        why: "$\\omega = 1/\\sqrt{LC}$, com $L$ no papel da massa e $1/C$ no papel da constante da mola.",
      },
    ],
    "31-2": [
      {
        q: "O que o resistor faz num circuito RLC sem fonte?",
        options: ["Aumenta a frequência", "Dissipa energia e faz a amplitude das oscilações decair", "Não muda nada", "Mantém a oscilação"],
        answer: 1,
        why: "A carga oscila com envoltória $e^{-Rt/2L}$; a energia vira calor no resistor.",
      },
    ],
    "31-3": [
      {
        q: "Num circuito só com capacitor e fonte alternada, como a corrente se relaciona com a tensão?",
        options: ["Em fase", "Adiantada de 90°", "Atrasada de 90°", "Oposta"],
        answer: 1,
        why: "No capacitor a corrente é máxima quando a tensão passa por zero: ela se adianta 90°. No indutor, ela se atrasa 90°.",
      },
    ],
    "31-4": [
      {
        q: "Num RLC série em ressonância, a impedância é:",
        options: ["Máxima", "Igual a $R$ (mínima)", "Zero", "Igual a $X_L + X_C$"],
        answer: 1,
        why: "Na ressonância $X_L = X_C$ e $Z = \\sqrt{R^2 + (X_L - X_C)^2} = R$; a corrente é máxima e fica em fase com a fonte.",
      },
    ],
    "31-5": [
      {
        q: "A tensão da tomada de 127 V é o valor eficaz. Qual é o valor de pico?",
        options: ["127 V", "180 V", "90 V", "254 V"],
        answer: 1,
        why: "Para senoide, $V_{rms} = V_m/\\sqrt2$, então $V_m = 127\\sqrt2 \\approx 180$ V.",
      },
    ],
    "31-6": [
      {
        q: "Um transformador ideal tem 100 espiras no primário e 1000 no secundário, com 120 V no primário. Qual a tensão no secundário?",
        options: ["12 V", "1200 V", "120 V", "12 000 V"],
        answer: 1,
        why: "$V_s/V_p = N_s/N_p = 10$; a corrente no secundário cai na mesma proporção, conservando a potência.",
      },
    ],
  },
};
