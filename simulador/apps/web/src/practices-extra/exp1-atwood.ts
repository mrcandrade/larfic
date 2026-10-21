// Máquina de Atwood: aceleração × fração de massa desbalanceada → g.
import type { Practice } from "@fisilab/analysis";

const H = 1.4; // percurso entre a largada e a fotoporta (m)

export const practice: Practice = {
  id: "exp1-atwood",
  course: "Exp I",
  title: "Máquina de Atwood",
  sim: "atwood",
  scenario: "atwood",
  params: { arranjo: 0, Mp: 0, m1: 1, m2: 1 },
  locked: ["arranjo", "Mp", "mu"],
  objective:
    "Verificar a segunda lei de Newton num sistema de duas massas ligadas por um fio e determinar a aceleração da gravidade a partir da aceleração medida para várias diferenças de massa, mantendo a massa total constante.",
  materials: [
    "máquina de Atwood com polia leve de baixo atrito",
    "conjunto de massas aferidas (total de 2,000 kg nos dois lados)",
    "balança digital (5 kg, resolução 0,1 g)",
    "trena",
    "fotoporta com cronômetro digital a 1,400 m abaixo do ponto de largada",
  ],
  procedure: `### Procedimento
1. Pese os dois porta-massas com as massas $m_1$ e $m_2$ (lado que desce: $m_2$). Mantenha **sempre** $m_1 + m_2 = 2{,}000$ kg: para mudar a diferença, passe massas de um lado para o outro. Assim a inércia total não muda e só a força resultante varia.
2. Solte o sistema do repouso. A fotoporta mede o tempo $t$ que $m_2$ leva para descer $h = 1{,}400$ m. Clique em **Registrar medida** quando ela chegar ao fim do percurso.
3. Repita para pelo menos 6 diferenças de massa, com $m_2 - m_1$ entre 0,1 kg e 0,6 kg.
4. Partindo do repouso, $h = \\tfrac12 a t^2$, logo $a = 2h/t^2$. Para fio e polia ideais,
$$a = \\frac{m_2 - m_1}{m_1 + m_2}\\,g$$
O gráfico de $a$ contra $\\dfrac{m_2 - m_1}{m_1 + m_2}$ é uma reta pela origem de inclinação $g$.
5. Ao final, escolha o cenário com **polia massiva** e observe o que muda: a polia também precisa ser acelerada.`,
  columns: [
    { key: "m1", label: "m₁", unit: "g", source: { param: "m1" }, instrument: { id: "balanca-5kg", name: "Balança digital (5 kg)", unit: "g", kind: "digital", resolution: 0.1, range: [0, 5000], accuracy: (r) => 0.2 + 1e-4 * r }, toUnit: 1000 },
    { key: "m2", label: "m₂", unit: "g", source: { param: "m2" }, instrument: { id: "balanca-5kg", name: "Balança digital (5 kg)", unit: "g", kind: "digital", resolution: 0.1, range: [0, 5000], accuracy: (r) => 0.2 + 1e-4 * r }, toUnit: 1000 },
    { key: "t", label: "t", unit: "s", source: { time: true }, instrument: "fotoporta" },
    { key: "fr", label: "(m₂ − m₁)/(m₁ + m₂)", unit: "", from: ["m1", "m2"], compute: (m1, m2) => (m2 - m1) / (m1 + m2) },
    { key: "a", label: "a = 2h/t²", unit: "m/s²", from: ["t"], compute: (t) => (2 * H) / (t * t) },
  ],
  minRows: 5,
  analysis: {
    x: "fr",
    y: "a",
    fit: "proporcional",
    xLabel: "(m₂ − m₁)/(m₁ + m₂)",
    yLabel: "a (m/s²)",
    results: [{ label: "g", unit: "m/s²", compute: (b) => b, reference: 9.81 }],
  },
  demo: (i) => {
    const m2 = 1.05 + 0.05 * i;
    return { params: { m1: 2 - m2, m2 }, t: 1e6 };
  },
  questions: [
    "O valor de g obtido é compatível com 9,81 m/s²? Qual grandeza domina a incerteza: as massas, o tempo ou o percurso h?",
    "Por que manter a massa total constante torna o gráfico uma reta pela origem? O que aconteceria se você só acrescentasse massa em $m_2$?",
    "Com uma polia de massa $M$ (disco), $a = (m_2 - m_1)g/(m_1 + m_2 + M/2)$. Que valor de g você obteria ignorando a polia se $M = 0{,}2$ kg? O erro seria sistemático ou aleatório?",
    "Calcule as trações $T_1 = m_1(g + a)$ e $T_2 = m_2(g - a)$ numa das medidas. Por que, com polia ideal, elas são iguais?",
  ],
};
