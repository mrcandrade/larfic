// Atrito: ângulo crítico (μe) e arrasto horizontal com dinamômetro, F × a → massa e μc.
import type { Practice } from "@fisilab/analysis";

const D = 1.2; // percurso entre a largada e a fotoporta (m)
const G = 9.81;

export const practice: Practice = {
  id: "exp1-atrito",
  course: "Exp I",
  title: "Coeficientes de atrito estático e cinético",
  sim: "plano-inclinado",
  scenario: "desce",
  params: { angulo: 0, m: 1, mus: 0.5, muk: 0.3, F: 0, v0: 0, componentes: 1 },
  locked: ["m", "mus", "muk", "v0"],
  objective:
    "Determinar o coeficiente de atrito estático pelo ângulo crítico de deslizamento e o coeficiente de atrito cinético puxando o bloco sobre a superfície horizontal com forças conhecidas.",
  materials: [
    "bloco de madeira de 1,000 kg",
    "rampa de inclinação ajustável com goniômetro",
    "dinamômetro de 10 N",
    "fotoporta a 1,20 m do ponto de largada",
  ],
  procedure: `### Parte A: atrito estático pelo ângulo crítico
1. Com $F = 0$, aumente a inclinação da rampa devagar, de grau em grau, até o bloco começar a deslizar.
2. No ângulo crítico $\\theta_c$ o atrito estático atinge o máximo: $mg\\sin\\theta_c = \\mu_e\\, mg\\cos\\theta_c$, logo $\\mu_e = \\tan\\theta_c$.
3. Repita três vezes e anote a média de $\\theta_c$.

### Parte B: atrito cinético pela segunda lei
1. Volte a rampa para a **horizontal** ($\\theta = 0$).
2. Puxe o bloco com o dinamômetro, com uma força $F$ constante e maior que a necessária para tirá-lo do repouso. A fotoporta mede o tempo $t$ que ele leva para percorrer $d = 1{,}20$ m. Clique em **Registrar medida** quando o bloco chegar à fotoporta.
3. Repita para pelo menos 6 forças entre 5,5 N e 9,5 N.
4. Partindo do repouso, $a = 2d/t^2$, e pela segunda lei
$$F = m a + \\mu_c m g$$
O gráfico de $F$ contra $a$ é uma reta: a inclinação é a massa do bloco e o intercepto é a força de atrito cinético $\\mu_c m g$.
5. Compare $\\mu_c$ com $\\mu_e$ da parte A.`,
  columns: [
    { key: "F", label: "F", unit: "N", source: { param: "F" }, instrument: "dinamometro" },
    { key: "t", label: "t", unit: "s", source: { time: true }, instrument: "fotoporta" },
    { key: "a", label: "a = 2d/t²", unit: "m/s²", from: ["t"], compute: (t) => (2 * D) / (t * t) },
  ],
  minRows: 5,
  analysis: {
    x: "a",
    y: "F",
    fit: "linear",
    xLabel: "a (m/s²)",
    yLabel: "F (N)",
    results: [
      { label: "m", unit: "kg", compute: (_a, b) => b, reference: 1 },
      { label: "μc", unit: "", compute: (a, b) => a / (b * G), reference: 0.3 },
    ],
  },
  demo: (i) => ({ params: { angulo: 0, F: 5.5 + 0.8 * i }, t: 1e6 }),
  questions: [
    "Qual foi o ângulo crítico e o valor de $\\mu_e$? Por que é preciso aumentar a inclinação lentamente?",
    "O coeficiente cinético é menor que o estático? Que força mínima você precisou aplicar no plano horizontal para tirar o bloco do repouso, e como ela se relaciona com $\\mu_e$?",
    "A massa obtida pela inclinação confere com a da balança? O que significaria uma inclinação maior que a massa real?",
    "Por que o intercepto do gráfico não depende da força aplicada? Como ele mudaria se o bloco tivesse o dobro da massa?",
  ],
};
