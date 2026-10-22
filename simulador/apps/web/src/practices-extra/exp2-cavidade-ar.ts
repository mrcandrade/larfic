// Ressonâncias de uma coluna de ar fechada numa ponta: f_n × (2n − 1) → velocidade do som.
import type { Practice } from "@fisilab/analysis";

const L = 0.6;
const RB = 0.02; // raio da boca (m)
const LEFF = L + 0.61 * RB;

export const practice: Practice = {
  id: "exp2-cavidade-ar",
  course: "Exp II",
  title: "Ressonância numa coluna de ar e velocidade do som",
  sim: "tubos-sonoros",
  scenario: "clarinete",
  params: { tipo: 1, L, T: 20, r: 2, n: 1, instr: 2, som: 0 },
  locked: ["tipo", "L", "T", "r"],
  objective:
    "Encontrar as frequências de ressonância de uma coluna de ar fechada numa extremidade, verificar que só aparecem os harmônicos ímpares e determinar a velocidade do som no ar.",
  materials: [
    "tubo de PVC de 60,0 cm de comprimento e 2,0 cm de raio, fechado numa ponta",
    "alto-falante ligado a gerador de funções com frequencímetro",
    "microfone na boca do tubo",
    "termômetro (ar a 20 °C)",
  ],
  procedure: `### Procedimento
1. Coloque o alto-falante junto à boca aberta do tubo e varra a frequência do gerador devagar, a partir de 50 Hz.
2. A cada máximo de intensidade no microfone (uma **ressonância**), anote a ordem $n$ da ressonância (1ª, 2ª, …) e leia a frequência $f_n$ no frequencímetro. Clique em **Registrar medida** (no aparato, escolha a ressonância $n$ mostrada).
3. Registre pelo menos as 6 primeiras ressonâncias.
4. Num tubo fechado numa ponta há um nó de deslocamento no fundo e um ventre na boca, logo
$$f_n = (2n - 1)\\,\\frac{v}{4L'} \\qquad L' = L + 0{,}61\\,r$$
onde $0{,}61\\,r$ é a correção de extremidade da boca.
5. O gráfico de $f_n$ contra $2n - 1$ é uma reta pela origem de inclinação $v/(4L')$. Calcule a velocidade do som e compare com $v = 331{,}3\\sqrt{1 + \\theta/273{,}15}$ m/s.
6. Troque para o tubo **aberto nas duas pontas** e compare a sequência de frequências.`,
  columns: [
    { key: "n", label: "n", unit: "", source: { param: "n" }, instrument: { id: "ordem-ressonancia", name: "Ordem da ressonância (contagem)", unit: "", kind: "digital", resolution: 1, range: [0, 20] } },
    { key: "f", label: "f_n", unit: "Hz", source: { observable: "fn" }, instrument: { id: "gerador-frequencimetro", name: "Gerador com frequencímetro (pico localizado a ±0,5 %)", unit: "Hz", kind: "digital", resolution: 1, range: [0, 20000], accuracy: (x) => 0.005 * x + 1 } },
    { key: "k", label: "2n − 1", unit: "", from: ["n"], compute: (n) => 2 * Math.round(n) - 1 },
  ],
  minRows: 5,
  analysis: {
    x: "k",
    y: "f",
    fit: "proporcional",
    xLabel: "2n − 1",
    yLabel: "f_n (Hz)",
    results: [
      { label: "f₁", unit: "Hz", compute: (b) => b, reference: 343.215 / (4 * LEFF) },
      { label: "v", unit: "m/s", compute: (b) => 4 * LEFF * b, reference: 343.2 },
    ],
  },
  demo: (i) => ({ params: { n: i + 1 } }),
  questions: [
    "A velocidade do som obtida é compatível com 343 m/s a 20 °C?",
    "Por que o tubo fechado só ressoa nos harmônicos ímpares? Desenhe os perfis de deslocamento das três primeiras ressonâncias.",
    "Qual seria o erro em $v$ se você ignorasse a correção de extremidade?",
    "Num dia a 35 °C, quanto subiria a frequência fundamental deste tubo?",
  ],
};
