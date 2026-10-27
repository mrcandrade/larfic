import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 18,
  sections: {
    "18-2": [
      {
        q: "Qual é a menor temperatura possível na escala Kelvin?",
        options: ["−273,15 K", "0 K", "273,15 K", "Não há limite"],
        answer: 1,
        why: "O zero absoluto, 0 K, equivale a −273,15 °C. Não existem temperaturas Kelvin negativas no sentido usual.",
      },
    ],
    "18-3": [
      {
        q: "A está em equilíbrio térmico com B, e B com C. O que a lei zero garante?",
        options: ["Que A e C têm a mesma massa", "Que A e C estão em equilíbrio térmico entre si", "Que B é o mais quente", "Nada sobre A e C"],
        answer: 1,
        why: "É o que permite usar um termômetro (B) para comparar temperaturas de corpos que nunca se tocaram.",
      },
    ],
    "18-4": [
      {
        q: "Num termômetro de gás a volume constante, como se define a temperatura?",
        options: ["Pela altura de uma coluna de mercúrio", "Por $T = 273{,}16\\,\\text{K}\\cdot(p/p_3)$, no limite de gás muito rarefeito", "Pela cor do gás", "Pelo volume do gás"],
        answer: 1,
        why: "A pressão é comparada com a do ponto triplo da água; extrapolando para baixa densidade, todos os gases concordam.",
      },
    ],
    "18-5": [
      {
        q: "Quanto vale 37 °C em Fahrenheit?",
        options: ["66,6 °F", "98,6 °F", "99,6 °F", "310 °F"],
        answer: 1,
        why: "$T_F = \\tfrac95T_C + 32 = 66{,}6 + 32 = 98{,}6$ °F.",
      },
    ],
    "18-6": [
      {
        q: "Uma placa metálica com um furo é aquecida. O que acontece com o furo?",
        options: ["Diminui", "Aumenta, como se fosse feito do mesmo metal", "Fica igual", "Some"],
        answer: 1,
        why: "A dilatação é uma ampliação de todas as dimensões; o furo se dilata como o metal que o preencheria.",
      },
      {
        q: "Uma barra de aço de 10 m ($\\alpha = 12\\times10^{-6}$/°C) aquece 50 °C. Quanto ela se alonga?",
        options: ["0,6 mm", "6 mm", "60 mm", "0,06 mm"],
        answer: 1,
        why: "$\\Delta L = \\alpha L\\Delta T = 12\\times10^{-6}\\cdot10\\cdot50 = 6\\times10^{-3}$ m. Daí as juntas de dilatação em pontes e trilhos.",
      },
    ],
    "18-7": [
      {
        q: "O que é calor, na física?",
        options: ["A energia guardada num corpo quente", "Energia transferida por causa de uma diferença de temperatura", "O mesmo que temperatura", "Uma substância que flui"],
        answer: 1,
        why: "Calor é energia em trânsito. Um corpo tem energia interna, não \"calor\"; e a temperatura mede outra coisa.",
      },
    ],
    "18-8": [
      {
        q: "Quanto calor é preciso para aquecer 2 kg de água de 20 °C para 70 °C? ($c = 4190$ J/(kg·K))",
        options: ["419 kJ", "838 kJ", "168 kJ", "4,19 kJ"],
        answer: 0,
        why: "$Q = mc\\Delta T = 2\\cdot4190\\cdot50 \\approx 4{,}19\\times10^5$ J.",
      },
      {
        q: "Durante a fusão do gelo a 0 °C, ao receber calor, a temperatura da mistura:",
        options: ["Sobe aos poucos", "Fica em 0 °C até todo o gelo derreter", "Cai", "Sobe e desce"],
        answer: 1,
        why: "O calor vai para a mudança de fase ($Q = mL_F$), não para aumentar a temperatura.",
      },
    ],
    "18-9": [
      {
        q: "Um gás se expande de 2 L para 5 L à pressão constante de 100 kPa. Quanto trabalho ele realiza?",
        options: ["300 J", "500 J", "30 J", "300 kJ"],
        answer: 0,
        why: "$W = p\\Delta V = 10^5\\cdot3\\times10^{-3} = 300$ J. No diagrama $p$–$V$, é a área sob o processo.",
      },
    ],
    "18-10": [
      {
        q: "Um gás recebe 500 J de calor e realiza 200 J de trabalho. Quanto varia a energia interna?",
        options: ["+700 J", "+300 J", "−300 J", "+200 J"],
        answer: 1,
        why: "$\\Delta E_{int} = Q - W = 500 - 200 = 300$ J (com $W$ o trabalho feito pelo gás).",
      },
    ],
    "18-11": [
      {
        q: "Num processo adiabático, o que é zero?",
        options: ["O trabalho", "O calor trocado", "A variação de energia interna", "A pressão"],
        answer: 1,
        why: "Adiabático: $Q = 0$, então $\\Delta E_{int} = -W$. Num ciclo, é $\\Delta E_{int}$ que zera; num processo isocórico, é $W$.",
      },
    ],
    "18-12": [
      {
        q: "Por que um piso de cerâmica parece mais frio que um tapete na mesma temperatura?",
        options: ["A cerâmica está mais fria", "A cerâmica conduz calor muito melhor e tira energia do pé mais depressa", "O tapete produz calor", "A cerâmica reflete o calor"],
        answer: 1,
        why: "Os dois estão à temperatura do ambiente; a sensação depende da taxa de condução $P = kA\\Delta T/L$, muito maior na cerâmica.",
      },
    ],
  },
};
