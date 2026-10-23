import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 39,
  sections: {
    "39-2": [
      {
        q: "Por que a energia de uma partícula confinada é quantizada?",
        options: ["Porque a partícula é pequena", "Porque, como numa corda presa, só ondas com nós nas paredes cabem no poço", "Porque a carga é quantizada", "Não é quantizada"],
        answer: 1,
        why: "O confinamento impõe condições de contorno à onda de matéria, e só alguns comprimentos de onda (logo, energias) são permitidos.",
      },
    ],
    "39-3": [
      {
        q: "Num poço infinito, se a largura dobra, a energia do estado fundamental:",
        options: ["Dobra", "Cai a um quarto", "Cai à metade", "Fica igual"],
        answer: 1,
        why: "$E_n = n^2h^2/(8mL^2)$: dobrar $L$ divide a energia por 4. Por isso pontos quânticos menores emitem cores mais azuis.",
      },
    ],
    "39-4": [
      {
        q: "No estado $n = 2$ de um poço infinito, onde a probabilidade de achar o elétron é zero (fora as paredes)?",
        options: ["Nas paredes só", "No centro do poço", "Em todo lugar", "Em nenhum ponto"],
        answer: 1,
        why: "$\\psi_2 \\propto \\text{sen}(2\\pi x/L)$ tem um nó em $x = L/2$; o estado $n$ tem $n - 1$ nós internos.",
      },
    ],
    "39-5": [
      {
        q: "Comparado ao poço infinito de mesma largura, num poço finito os níveis de energia são:",
        options: ["Mais altos", "Mais baixos, porque a onda penetra nas paredes e o comprimento efetivo aumenta", "Iguais", "Infinitos"],
        answer: 1,
        why: "A função de onda decai exponencialmente dentro das paredes; o poço \"parece\" mais largo e as energias caem. E há só um número finito de estados ligados.",
      },
    ],
    "39-6": [
      {
        q: "Num ponto quântico de semicondutor, o que muda a cor da luz emitida?",
        options: ["O material da embalagem", "O tamanho do ponto", "A temperatura apenas", "A tensão da rede"],
        answer: 1,
        why: "O confinamento eleva os níveis de energia conforme o ponto diminui: pontos menores emitem fótons mais energéticos.",
      },
    ],
    "39-7": [
      {
        q: "Numa caixa quadrada bidimensional, os estados $(n_x, n_y) = (1,2)$ e $(2,1)$ têm:",
        options: ["Energias diferentes", "A mesma energia (são degenerados)", "Energia zero", "Funções de onda iguais"],
        answer: 1,
        why: "$E \\propto n_x^2 + n_y^2$ dá 5 nos dois casos; a simetria da caixa produz a degenerescência.",
      },
    ],
    "39-8": [
      {
        q: "No modelo de Bohr, qual a energia para ionizar o hidrogênio a partir do estado $n = 2$?",
        options: ["13,6 eV", "3,4 eV", "10,2 eV", "6,8 eV"],
        answer: 1,
        why: "$E_n = -13{,}6/n^2$ eV dá $E_2 = -3{,}4$ eV; basta 3,4 eV para levar o elétron a $E = 0$.",
      },
    ],
    "39-9": [
      {
        q: "No estado fundamental do hidrogênio, a que distância do núcleo é mais provável encontrar o elétron?",
        options: ["No núcleo", "No raio de Bohr, $a_0 \\approx 52{,}9$ pm", "No infinito", "Em $2a_0$"],
        answer: 1,
        why: "A densidade radial $P(r) = 4\\pi r^2|\\psi|^2$ tem máximo em $a_0$, embora $|\\psi|^2$ sozinho seja máximo no núcleo.",
      },
    ],
  },
};
