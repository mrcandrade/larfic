import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 12,
  sections: {
    "12-2": [
      {
        q: "Um corpo está em equilíbrio estático quando:",
        options: ["Só a força resultante é nula", "Força resultante e torque resultante são nulos e ele está em repouso", "Só o torque resultante é nulo", "Está em movimento retilíneo uniforme"],
        answer: 1,
        why: "Equilíbrio exige $\\vec P$ e $\\vec L$ constantes; o estático pede ainda que o corpo esteja parado. Uma força resultante nula sozinha não impede o corpo de começar a girar.",
      },
    ],
    "12-3": [
      {
        q: "Ao montar as equações de equilíbrio de uma viga, como escolher o ponto para calcular os torques?",
        options: ["Tem que ser o centro de massa", "Qualquer ponto serve; convém escolher um por onde passam forças desconhecidas", "Tem que ser uma das extremidades", "Tem que ser o ponto de apoio mais alto"],
        answer: 1,
        why: "Com força resultante nula, o torque resultante é nulo em relação a qualquer ponto. Escolher um ponto onde agem forças desconhecidas elimina essas incógnitas da equação.",
      },
    ],
    "12-4": [
      {
        q: "Quando o centro de gravidade coincide com o centro de massa?",
        options: ["Nunca", "Quando $\\vec g$ é o mesmo em todo o corpo", "Só para corpos esféricos", "Só no vácuo"],
        answer: 1,
        why: "Os dois diferem apenas se a gravidade variar ao longo do corpo, o que só importa para objetos enormes, como um prédio muito alto ou uma montanha.",
      },
    ],
    "12-5": [
      {
        q: "Uma tábua de 4 m e 20 kg fica apoiada nas pontas. Uma pessoa de 60 kg está a 1 m da ponta A. Quanto vale a força no apoio A? ($g = 10$ m/s²)",
        options: ["400 N", "550 N", "250 N", "800 N"],
        answer: 1,
        why: "Torques em relação a B: $N_A\\cdot4 = 600\\cdot3 + 200\\cdot2$, logo $N_A = 550$ N e $N_B = 250$ N. O apoio mais perto da pessoa leva mais carga.",
      },
    ],
    "12-6": [
      {
        q: "Por que uma mesa de quatro pernas num piso rígido é um problema estaticamente indeterminado?",
        options: ["Porque há mais forças desconhecidas do que equações de equilíbrio independentes", "Porque a mesa não está em equilíbrio", "Porque o peso da mesa é desconhecido", "Porque as pernas são iguais"],
        answer: 0,
        why: "Há quatro normais e só três equações úteis. Para resolver é preciso saber como pernas e piso se deformam, isto é, usar a elasticidade.",
      },
    ],
    "12-7": [
      {
        q: "Um fio de aço é trocado por outro do mesmo material, mesmo comprimento e o dobro do diâmetro. Sob a mesma carga, o alongamento:",
        options: ["Dobra", "Cai à metade", "Cai a um quarto", "Fica igual"],
        answer: 2,
        why: "$\\Delta L = FL/(EA)$ e a área cresce com o quadrado do diâmetro: dobrar o diâmetro multiplica $A$ por 4.",
      },
    ],
  },
};
