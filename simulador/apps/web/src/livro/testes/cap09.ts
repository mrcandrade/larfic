import type { ChapterChecks } from "../testes.ts";

export const testes: ChapterChecks = {
  n: 9,
  sections: {
    "9-2": [
      {
        q: "Duas massas, de 1 kg em $x = 0$ e 3 kg em $x = 4$ m, ficam numa barra leve. Onde está o centro de massa?",
        options: ["$x = 2$ m", "$x = 3$ m", "$x = 1$ m", "$x = 4$ m"],
        answer: 1,
        why: "$x_{CM} = (1\\cdot0 + 3\\cdot4)/4 = 3$ m: o centro de massa fica mais perto da massa maior.",
      },
      {
        q: "O centro de massa de um corpo precisa estar dentro do material do corpo?",
        options: ["Sim, sempre", "Não: num anel ou num bumerangue ele fica no vazio", "Só se o corpo for homogêneo", "Só se o corpo for simétrico"],
        answer: 1,
        why: "O centro de massa é uma média ponderada de posições e pode cair fora do material, como no centro de um anel.",
      },
    ],
    "9-3": [
      {
        q: "Um projétil explode no ar em vários pedaços. Desprezando o ar, o que acontece com o centro de massa dos pedaços?",
        options: ["Para no ponto da explosão", "Continua na mesma parábola que o projétil seguiria", "Sobe, por causa da energia da explosão", "Cai verticalmente"],
        answer: 1,
        why: "As forças da explosão são internas e se anulam; a única força externa continua sendo o peso, então o centro de massa segue a mesma trajetória.",
      },
    ],
    "9-4": [
      {
        q: "Uma bola de 0,4 kg a 10 m/s e um carrinho de 2 kg a 2 m/s, no mesmo sentido. Qual tem mais momento linear?",
        options: ["A bola", "O carrinho", "Os dois têm o mesmo", "Não dá para comparar"],
        answer: 2,
        why: "$p = mv$: $0{,}4\\cdot10 = 4$ e $2\\cdot2 = 4$ kg·m/s. Momentos iguais não implicam energias cinéticas iguais (a bola tem 20 J, o carrinho 4 J).",
      },
    ],
    "9-5": [
      {
        q: "O momento linear total de um sistema de partículas é igual a:",
        options: ["A soma das massas vezes a maior velocidade", "A massa total vezes a velocidade do centro de massa", "Zero, sempre", "A soma dos módulos dos momentos"],
        answer: 1,
        why: "$\\vec P = \\sum m_i\\vec v_i = M\\vec v_{CM}$. A soma é vetorial: momentos opostos se cancelam.",
      },
    ],
    "9-6": [
      {
        q: "Por que um air bag reduz a força sobre o motorista numa batida?",
        options: ["Porque diminui a variação de momento", "Porque aumenta o tempo da colisão para a mesma variação de momento", "Porque absorve a massa do motorista", "Porque aumenta a velocidade final"],
        answer: 1,
        why: "O impulso $J = \\Delta p = F_{méd}\\,\\Delta t$ é fixado pela velocidade inicial; esticar $\\Delta t$ reduz a força média.",
      },
    ],
    "9-7": [
      {
        q: "Um patinador de 60 kg, parado, arremessa uma mochila de 6 kg para a frente a 5 m/s. Com que velocidade ele recua (sem atrito)?",
        options: ["5 m/s", "0,5 m/s", "50 m/s", "0"],
        answer: 1,
        why: "O momento total era zero e continua zero: $60\\,v = 6\\cdot5$, então $v = 0{,}5$ m/s no sentido oposto.",
      },
    ],
    "9-8": [
      {
        q: "Numa colisão de dois carrinhos num trilho de ar, o que sempre se conserva?",
        options: ["A energia cinética", "O momento linear total", "As duas coisas", "Nenhuma"],
        answer: 1,
        why: "Sem forças externas horizontais, o momento se conserva em qualquer colisão; a energia cinética só se conserva nas colisões elásticas.",
      },
    ],
    "9-9": [
      {
        q: "Um carrinho de 2 kg a 3 m/s bate e gruda num carrinho parado de 1 kg. Qual a velocidade final?",
        options: ["3 m/s", "2 m/s", "1,5 m/s", "1 m/s"],
        answer: 1,
        why: "Colisão perfeitamente inelástica: $2\\cdot3 = 3\\,v$, logo $v = 2$ m/s. A energia cinética cai de 9 J para 6 J.",
      },
    ],
    "9-10": [
      {
        q: "Numa colisão elástica frontal, uma bola de bilhar bate numa outra igual que estava parada. O que acontece?",
        options: ["As duas seguem juntas com metade da velocidade", "A primeira para e a segunda sai com a velocidade da primeira", "A primeira volta com a mesma velocidade", "A segunda fica parada"],
        answer: 1,
        why: "Com massas iguais e choque elástico frontal, as velocidades se trocam. É o que se vê no pêndulo de Newton.",
      },
    ],
    "9-11": [
      {
        q: "Numa colisão elástica em que uma bola bate de raspão em outra igual e parada, qual é o ângulo entre as velocidades finais?",
        options: ["0°", "45°", "90°", "180°"],
        answer: 2,
        why: "Conservar momento e energia cinética com massas iguais exige $\\vec v_1 = \\vec v_1' + \\vec v_2'$ e $v_1^2 = v_1'^2 + v_2'^2$: os vetores finais formam um ângulo reto.",
      },
    ],
    "9-12": [
      {
        q: "Segundo a equação do foguete, de que depende o ganho de velocidade $\\Delta v$ no espaço?",
        options: ["Só da massa de combustível", "Da velocidade de exaustão e do logaritmo da razão entre as massas inicial e final", "Da potência do motor", "Do tempo de queima"],
        answer: 1,
        why: "$\\Delta v = v_{rel}\\ln(M_i/M_f)$. Como depende do logaritmo, dobrar o combustível não dobra $\\Delta v$; daí os estágios descartáveis.",
      },
    ],
  },
};
