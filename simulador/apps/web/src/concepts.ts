/**
 * Concept Builders: banco de concepções alternativas clássicas de física básica,
 * cada uma ligada a uma simulação que a confronta, no ciclo prever → observar → explicar.
 * Fontes de inspiração: FCI (Force Concept Inventory), CSEM, DIRECT, FMCE e a literatura de ensino de física.
 */
import { simHref } from "./router.ts";

export type ConceptArea = "mecanica" | "fluidos-ondas-termo" | "eletromagnetismo" | "otica-moderna";

export const conceptAreas: { id: ConceptArea; label: string }[] = [
  { id: "mecanica", label: "Mecânica" },
  { id: "fluidos-ondas-termo", label: "Fluidos, ondas e termodinâmica" },
  { id: "eletromagnetismo", label: "Eletromagnetismo" },
  { id: "otica-moderna", label: "Ótica e física moderna" },
];

export interface ConceptQuestion {
  prompt: string;
  options: string[];
  /** Índice da opção correta. */
  answer: number;
}

export interface Concept {
  id: string;
  /** Título curto da concepção. */
  title: string;
  /** A frase como o aluno costuma dizê-la. */
  statement: string;
  /** Por que ela é atraente (de onde vem a intuição). */
  appeal: string;
  area: ConceptArea;
  topic: string;
  /** Instrumento ou referência em que aparece (FCI, CSEM, DIRECT...). */
  source?: string;
  /** Pergunta de previsão, feita antes de abrir a simulação. */
  predict: ConceptQuestion;
  /** Simulação que confronta a concepção: id da sim, cenário e parâmetros (p.<chave>=valor). */
  sim: { id: string; scenario: string; params?: Record<string, number> };
  /** O que observar na simulação. */
  observe: string;
  /** Explicação depois da observação (aceita Markdown e $LaTeX$). */
  explanation: string;
  /** Pergunta de verificação (transferência para outra situação). */
  check: ConceptQuestion & { explanation: string };
}

export const concepts: Concept[] = [
  // ───────────────────────────── Mecânica ─────────────────────────────
  {
    id: "forca-implica-movimento",
    title: "Força implica movimento",
    statement: "Se o objeto está se movendo, tem alguma força empurrando ele para a frente.",
    appeal: "No dia a dia tudo para quando paramos de empurrar: o atrito está sempre presente e passa despercebido, então parece que manter o movimento exige força.",
    area: "mecanica",
    topic: "Leis de Newton",
    source: "FCI",
    predict: {
      prompt: "Um carrinho recebe um empurrão e passa a deslizar num trilho de ar horizontal, sem atrito e sem nada puxando. O que acontece com a velocidade dele?",
      options: ["Diminui aos poucos até parar, porque a força do empurrão vai acabando", "Fica constante", "Aumenta um pouco e depois diminui"],
      answer: 1,
    },
    sim: { id: "trilho-de-ar", scenario: "segunda-lei", params: { mp: 0, v0: 0.5, b: 0 } },
    observe: "Observe a velocidade do carrinho nas duas fotoportas e no gráfico v(t): sem massa pendurada e sem atrito, nenhuma força horizontal age depois do empurrão.",
    explanation:
      "A velocidade permanece constante: pela 1ª lei de Newton, um corpo mantém sua velocidade quando a força resultante é nula. Força não é o que mantém o movimento, é o que **muda** a velocidade ($\\vec F_{res} = m\\vec a$). No cotidiano os objetos param porque o atrito e a resistência do ar são forças reais, opostas ao movimento.",
    check: {
      prompt: "Uma sonda espacial, longe de qualquer planeta ou estrela, desliga os motores enquanto viaja a 15 km/s. Depois disso, ela:",
      options: ["para em pouco tempo", "continua a 15 km/s em linha reta", "desacelera devagar até parar", "passa a cair em direção ao Sol mais próximo imediatamente"],
      answer: 1,
      explanation: "Sem força resultante, a velocidade (módulo e direção) não muda. É por isso que sondas viajam anos sem combustível entre as manobras.",
    },
  },
  {
    id: "mais-pesado-cai-mais-rapido",
    title: "O mais pesado cai mais rápido",
    statement: "Uma bola de aço cai mais rápido que uma de madeira, porque é mais pesada.",
    appeal: "A gravidade puxa mais forte o corpo mais pesado, e no ar uma pena realmente cai mais devagar que uma pedra. Aristóteles pensava assim.",
    area: "mecanica",
    topic: "Queda livre",
    source: "FCI",
    predict: {
      prompt: "Uma esfera de aço e uma de madeira são soltas da mesma altura, sem resistência do ar. Qual chega primeiro?",
      options: ["A de aço", "A de madeira", "Chegam juntas"],
      answer: 2,
    },
    sim: { id: "queda-livre", scenario: "medir-g", params: { esfera: 1, arrasto: 0 } },
    observe: "Observe os tempos t₁ e t₂ registrados pelas fotoportas com a esfera de madeira. Depois troque para a esfera de aço (mesmo arrasto desprezado) e compare.",
    explanation:
      "Os tempos são iguais. A força peso é proporcional à massa ($P = mg$), mas a inércia também: $a = P/m = g$. A massa se cancela e todos os corpos caem com a mesma aceleração no vácuo. Com ar, a diferença vem do arrasto, que depende da forma e do tamanho, não de \"o peso puxar mais\".",
    check: {
      prompt: "Na Lua, sem atmosfera, um astronauta solta ao mesmo tempo um martelo e uma pena da mesma altura. O que acontece?",
      options: ["O martelo chega bem antes", "A pena chega antes", "Chegam juntos", "A pena flutua"],
      answer: 2,
      explanation: "Sem ar não há arrasto; os dois têm aceleração g da Lua (1,62 m/s²). David Scott fez exatamente isso na Apollo 15, em 1971.",
    },
  },
  {
    id: "forca-centrifuga",
    title: "Força centrífuga “para fora”",
    statement: "Se o fio que gira a pedra arrebentar, ela é jogada para fora, na direção do raio, pela força centrífuga.",
    appeal: "Quem está dentro de um carro numa curva sente-se empurrado para fora, e esse empurrão parece uma força real que continua agindo quando o fio se solta.",
    area: "mecanica",
    topic: "Movimento circular e referenciais",
    source: "FCI",
    predict: {
      prompt: "Uma bola é lançada a partir de um ponto de um carrossel que gira. Vista por alguém parado do lado de fora, qual é a trajetória dela depois de solta?",
      options: ["Uma espiral que se abre", "Uma linha reta", "Um arco que continua a curva do carrossel", "Uma linha que se afasta radialmente do centro"],
      answer: 1,
    },
    sim: { id: "referenciais-nao-inerciais", scenario: "carrossel" },
    observe: "Observe os dois painéis: à esquerda, a bola vista de fora (referencial inercial); à direita, vista por quem gira com o disco.",
    explanation:
      "De fora, a bola anda em **linha reta**, tangente ao círculo no instante em que é solta: nenhuma força age sobre ela. A \"força centrífuga\" só aparece para quem gira junto (referencial não inercial); é uma força fictícia, necessária para explicar a curva vista de dentro. Enquanto o fio está preso, a força real sobre a pedra é a tração, que aponta **para o centro**.",
    check: {
      prompt: "Um carro faz uma curva para a esquerda e um copo escorrega no painel em direção à porta direita. Do ponto de vista de quem está na rua, o que acontece?",
      options: ["Uma força empurra o copo para a direita", "O copo tende a seguir em linha reta enquanto o carro curva para a esquerda", "O copo é atraído pela porta", "O peso do copo muda de direção"],
      answer: 1,
      explanation: "O atrito no painel não basta para dar ao copo a aceleração centrípeta; por inércia, ele segue quase reto e é o carro que \"vem\" para cima dele.",
    },
  },
  {
    id: "forca-no-topo",
    title: "Força para a frente no topo da trajetória",
    statement: "No ponto mais alto, a bola tem uma força para a frente (do chute) e o peso para baixo.",
    appeal: "A bola continua avançando, e a ideia de que movimento exige força faz imaginar que a \"força do chute\" a acompanha.",
    area: "mecanica",
    topic: "Lançamento de projéteis",
    source: "FCI",
    predict: {
      prompt: "Desprezando o ar, quais forças agem sobre uma bola no ponto mais alto da trajetória?",
      options: ["Só o peso, para baixo", "O peso e uma força horizontal para a frente", "Nenhuma, pois ali ela está parada na vertical", "Uma força para a frente maior que o peso"],
      answer: 0,
    },
    sim: { id: "projetil-arrasto", scenario: "vacuo" },
    observe: "Observe os gráficos de vₓ e v_y: o que acontece com a componente horizontal da velocidade ao longo de todo o voo?",
    explanation:
      "vₓ fica **constante** e v_y diminui no ritmo de g: a única aceleração é vertical, para baixo. Logo a única força é o peso. A bola continua avançando por inércia, não porque alguma força a empurra. A \"força do chute\" só existe enquanto o pé toca a bola.",
    check: {
      prompt: "Um pacote é solto de um avião que voa na horizontal com velocidade constante. Desprezando o ar, visto do chão, o pacote:",
      options: ["cai na vertical, a partir do ponto em que foi solto", "fica para trás do avião", "segue uma parábola e permanece sempre logo abaixo do avião", "segue em linha reta inclinada"],
      answer: 2,
      explanation: "O pacote conserva a velocidade horizontal do avião (só o peso age, na vertical). Por isso ele fica sempre na vertical do avião enquanto cai.",
    },
  },
  {
    id: "terceira-lei-massas",
    title: "O mais pesado empurra mais forte",
    statement: "Na batida, o caminhão faz mais força no carro do que o carro faz no caminhão.",
    appeal: "O carro sofre um efeito muito maior (amassa e muda muito de velocidade), então parece que recebeu uma força maior.",
    area: "mecanica",
    topic: "3ª lei de Newton e colisões",
    source: "FCI",
    predict: {
      prompt: "Um carrinho de 5 kg colide com outro de 1 kg e os dois grudam. Durante a colisão, comparando as forças que um exerce no outro:",
      options: ["O de 5 kg exerce mais força", "O de 1 kg exerce mais força", "As forças têm o mesmo módulo", "Só o de 5 kg exerce força, pois o outro estava parado"],
      answer: 2,
    },
    sim: { id: "colisoes", scenario: "gruda", params: { m1: 5, m2: 1, v1: 3 } },
    observe: "Observe as variações de momento: compare quanto o momento de cada carrinho muda na colisão (m·Δv) e confira que o momento total pₓ não muda.",
    explanation:
      "As variações de momento são iguais e opostas: $\\Delta p_1 = -\\Delta p_2$. Como o tempo de contato é o mesmo para os dois, as forças médias também são iguais e opostas (3ª lei). O carrinho leve muda muito mais de **velocidade** porque, com a mesma força, $a = F/m$ é maior para a massa menor.",
    check: {
      prompt: "Uma pessoa de 50 kg e outra de 100 kg, de patins e paradas, empurram uma à outra. Qual força é maior e quem sai mais rápido?",
      options: ["A de 100 kg empurra mais; ela sai mais rápido", "As forças são iguais; a de 50 kg sai com o dobro da velocidade", "As forças são iguais; as duas saem com a mesma velocidade", "A de 50 kg empurra mais; ela sai mais rápido"],
      answer: 1,
      explanation: "Forças de ação e reação têm sempre o mesmo módulo. Com momento total zero, $50 v_1 = 100 v_2$: a mais leve sai com o dobro da velocidade.",
    },
  },
  {
    id: "impeto",
    title: "Ímpeto que se gasta",
    statement: "O bloco sobe a rampa porque leva a força do empurrão, que vai se gastando até acabar.",
    appeal: "É a teoria medieval do ímpeto: parece natural que o objeto \"carregue\" uma provisão de força que se esgota.",
    area: "mecanica",
    topic: "Plano inclinado",
    source: "FCI",
    predict: {
      prompt: "Um bloco é lançado rampa acima e já se soltou da mão. Enquanto sobe, qual força aponta para cima ao longo da rampa?",
      options: ["A força do lançamento, que diminui", "Nenhuma: peso (componente) e atrito apontam rampa abaixo", "A normal", "O atrito, que ajuda o bloco a subir"],
      answer: 1,
    },
    sim: { id: "plano-inclinado", scenario: "lancado" },
    observe: "Observe as forças desenhadas no bloco e o sinal da aceleração durante a subida.",
    explanation:
      "Durante a subida só agem o peso, a normal e o atrito; nenhuma delas aponta rampa acima. A aceleração aponta rampa abaixo desde o primeiro instante, e por isso o bloco desacelera. O que o bloco \"carrega\" é **velocidade** (e energia cinética), não força.",
    check: {
      prompt: "Uma bola de hóquei desliza no gelo depois de receber uma tacada. Quais forças horizontais agem nela?",
      options: ["A força da tacada, para a frente", "Apenas o pequeno atrito com o gelo e o arrasto do ar, para trás", "A força da tacada e o atrito, que se equilibram", "Nenhuma força, nem mesmo atrito"],
      answer: 1,
      explanation: "A tacada só age durante o contato. Depois, as únicas forças horizontais são as dissipativas, contrárias ao movimento: por isso a bola desacelera devagar.",
    },
  },
  {
    id: "velocidade-zero-aceleracao-zero",
    title: "Velocidade zero, aceleração zero",
    statement: "No ponto mais alto, a bola jogada para cima para; então a aceleração dela ali é zero.",
    appeal: "Velocidade e aceleração são confundidas: se \"não está se movendo\", parece que nada está mudando.",
    area: "mecanica",
    topic: "Cinemática 1D",
    predict: {
      prompt: "Uma bola é lançada verticalmente para cima. No instante em que atinge a altura máxima, a aceleração dela é:",
      options: ["zero", "g, para baixo", "g, para cima", "maior que g"],
      answer: 1,
    },
    sim: { id: "projetil-arrasto", scenario: "vacuo", params: { angulo: 90, v0: 15 } },
    observe: "Observe o gráfico de v_y: no ponto mais alto ele cruza o zero. A inclinação da curva (a aceleração) muda nesse ponto?",
    explanation:
      "O gráfico v_y(t) é uma reta de inclinação constante −g: ela cruza o zero sem se dobrar. Aceleração é a taxa de **variação** da velocidade. No topo a velocidade é zero por um instante, mas está mudando (de positiva para negativa), então a aceleração continua sendo g para baixo.",
    check: {
      prompt: "Um pêndulo está no ponto extremo da oscilação, parado por um instante. A aceleração dele é:",
      options: ["zero, pois está parado", "diferente de zero, apontando para o ponto mais baixo da trajetória", "infinita", "igual à aceleração no ponto mais baixo"],
      answer: 1,
      explanation: "No extremo a velocidade é nula, mas a componente tangencial do peso não é: ela acelera o pêndulo de volta.",
    },
  },
  {
    id: "mcu-sem-aceleracao",
    title: "Movimento circular uniforme sem aceleração",
    statement: "Se a velocidade da roda é constante, não há aceleração.",
    appeal: "No cotidiano \"velocidade\" é o número do velocímetro, e ele não muda. A direção da velocidade é esquecida.",
    area: "mecanica",
    topic: "Movimento circular",
    source: "FMCE",
    predict: {
      prompt: "Uma partícula percorre um círculo com rapidez constante. A aceleração dela:",
      options: ["é nula", "aponta para o centro", "aponta na direção do movimento", "aponta para fora do círculo"],
      answer: 1,
    },
    sim: { id: "movimento-circular", scenario: "mcu" },
    observe: "Observe os vetores velocidade e aceleração desenhados na partícula e os valores de a_c e a_t na tabela.",
    explanation:
      "O módulo de $\\vec v$ é constante, mas sua direção gira o tempo todo; isso é uma variação de velocidade. A aceleração centrípeta $a_c = v^2/r = \\omega^2 r$ aponta para o centro, e a tangencial é zero. Para existir, ela precisa de uma força resultante para o centro (tração, atrito, gravidade...).",
    check: {
      prompt: "Um satélite em órbita circular tem rapidez constante. A força resultante sobre ele:",
      options: ["é zero", "aponta para a Terra", "aponta na direção do movimento", "aponta para fora, equilibrando a gravidade"],
      answer: 1,
      explanation: "A gravidade é a força centrípeta da órbita: aponta para o centro da Terra e curva continuamente a trajetória.",
    },
  },
  {
    id: "normal-igual-peso",
    title: "A normal é sempre igual ao peso",
    statement: "A normal é a reação do peso, então tem sempre o mesmo valor que ele.",
    appeal: "Na mesa horizontal parada é verdade, e é o primeiro exemplo que todos veem. A 3ª lei é aplicada ao par errado.",
    area: "mecanica",
    topic: "Leis de Newton",
    predict: {
      prompt: "Uma caixa está no piso de um elevador que sobe acelerando. A força normal do piso sobre a caixa é:",
      options: ["igual ao peso", "maior que o peso", "menor que o peso", "zero"],
      answer: 1,
    },
    sim: { id: "forcas-dcl", scenario: "elevador" },
    observe: "Observe, ao montar o diagrama de corpo livre da caixa, quando ele concorda com o movimento real: compare ΣF_y com m·a_y.",
    explanation:
      "Com aceleração para cima, a resultante precisa apontar para cima: $N - mg = ma$, então $N = m(g + a) > mg$. Peso e normal **não** são par ação-reação: agem no mesmo corpo. O par do peso é a força que a caixa faz na Terra; o par da normal é a força que a caixa faz no piso.",
    check: {
      prompt: "Um bloco está parado numa rampa inclinada. Comparando a normal com o peso:",
      options: ["N = mg", "N < mg", "N > mg", "N = 0"],
      answer: 1,
      explanation: "A normal equilibra só a componente do peso perpendicular à rampa: $N = mg\\cos\\theta < mg$.",
    },
  },
  {
    id: "pendulo-pesado-mais-lento",
    title: "Pêndulo mais pesado é mais lento",
    statement: "Se eu colocar uma massa maior no pêndulo, ele vai balançar mais devagar.",
    appeal: "Objetos pesados parecem \"preguiçosos\": custam mais a pôr em movimento. Só se lembra da inércia e esquece que a força também cresce.",
    area: "mecanica",
    topic: "Oscilações",
    predict: {
      prompt: "Um pêndulo simples tem a massa multiplicada por 5, com o mesmo comprimento. O período das pequenas oscilações:",
      options: ["fica 5 vezes maior", "fica √5 vezes maior", "não muda", "fica menor"],
      answer: 2,
    },
    sim: { id: "pendulos", scenario: "pequeno", params: { m: 5 } },
    observe: "Observe o período T na tabela com massa de 5 kg. Depois mude a massa para 1 kg e depois o comprimento: qual das duas mudanças altera o período?",
    explanation:
      "A massa aparece na força restauradora ($mg\\sin\\theta$) e na inércia ($mL$): ela se cancela e $T = 2\\pi\\sqrt{L/g}$. É o mesmo cancelamento que faz corpos de massas diferentes caírem juntos. Só o comprimento e a gravidade alteram o período.",
    check: {
      prompt: "Uma criança e um adulto usam o mesmo balanço (mesmo comprimento das correntes), com pequenas oscilações. Quem tem o período maior?",
      options: ["O adulto", "A criança", "Aproximadamente o mesmo"],
      answer: 2,
      explanation: "Tratando o balanço como pêndulo simples, o período só depende do comprimento e de g (pequenas diferenças vêm da posição do centro de massa de cada um).",
    },
  },
  {
    id: "maior-rola-mais-rapido",
    title: "O cilindro maior desce mais rápido",
    statement: "Um cilindro grande e pesado rola rampa abaixo mais rápido que um pequeno e leve.",
    appeal: "Combina a ideia de que o mais pesado cai mais rápido com a impressão de que rodas grandes \"embalam\".",
    area: "mecanica",
    topic: "Rolamento",
    predict: {
      prompt: "Dois cilindros maciços do mesmo material, um pequeno (0,5 kg) e um grande (5 kg), rolam sem deslizar pela mesma rampa. Quem chega primeiro?",
      options: ["O grande", "O pequeno", "Empate"],
      answer: 2,
    },
    sim: { id: "rolamento", scenario: "tamanhos" },
    observe: "Observe a corrida: compare as posições nas raias ao longo do tempo. Depois compare com o anel do cenário \"corrida\".",
    explanation:
      "Para corpos que rolam sem deslizar, $a = g\\sin\\theta/(1 + k)$, com $I = k\\,mR^2$. Massa e raio se cancelam: só a **forma** (o valor de k) importa. Todo cilindro maciço tem $k = 1/2$ e empata; um anel ($k = 1$) perde, porque guarda mais energia em rotação.",
    check: {
      prompt: "Uma esfera maciça pequena e uma lata cilíndrica oca (anel) grande descem a mesma rampa rolando. Quem chega primeiro?",
      options: ["A esfera", "A lata", "Empate, pois partem da mesma altura"],
      answer: 0,
      explanation: "A esfera tem $k = 2/5$ e o anel $k = 1$: a esfera converte uma fração maior da energia em translação.",
    },
  },
  {
    id: "orbita-sem-gravidade",
    title: "Em órbita não há gravidade",
    statement: "Os astronautas flutuam na estação espacial porque lá em cima não tem gravidade.",
    appeal: "As imagens de astronautas flutuando são marcantes, e \"gravidade zero\" é uma expressão comum na mídia.",
    area: "mecanica",
    topic: "Gravitação",
    predict: {
      prompt: "A Estação Espacial Internacional orbita a cerca de 400 km de altura. A gravidade da Terra lá vale, em relação à da superfície:",
      options: ["zero", "cerca de 10%", "cerca de 90%", "o dobro"],
      answer: 2,
    },
    sim: { id: "orbitas-kepler", scenario: "elipse" },
    observe: "Observe as setas do campo gravitacional ao redor da estrela e a trajetória do planeta: ele está sempre sendo puxado para a estrela?",
    explanation:
      "A gravidade age sempre, e é ela que curva a órbita: sem gravidade, o corpo seguiria em linha reta. A 400 km, $g$ vale $g_0\\,(R/(R+h))^2 \\approx 0{,}89\\,g_0$. Astronautas flutuam porque eles e a estação **caem juntos** (queda livre contínua em torno da Terra): não há nada empurrando um contra o outro.",
    check: {
      prompt: "Se o cabo de um elevador se rompesse e ele caísse livremente, uma balança no piso marcaria, para uma pessoa dentro dele:",
      options: ["o peso normal", "o dobro do peso", "zero", "um valor negativo"],
      answer: 2,
      explanation: "Em queda livre, pessoa e piso têm a mesma aceleração g: a normal é zero. É a mesma \"ausência de peso\" da estação espacial.",
    },
  },

  // ─────────────────── Fluidos, ondas e termodinâmica ───────────────────
  {
    id: "calor-temperatura",
    title: "Calor e temperatura são a mesma coisa",
    statement: "Se eu continuo dando calor ao gelo, a temperatura dele tem que continuar subindo.",
    appeal: "Na linguagem do dia a dia \"calor\" e \"quente\" são usados como sinônimos, e em geral aquecer um objeto realmente aumenta a temperatura.",
    area: "fluidos-ondas-termo",
    topic: "Calorimetria",
    predict: {
      prompt: "Um bloco de gelo a 0 °C recebe calor de um aquecedor de potência constante enquanto derrete. A temperatura da mistura gelo–água:",
      options: ["sobe no mesmo ritmo de antes", "fica em 0 °C até todo o gelo derreter", "sobe devagar", "cai"],
      answer: 1,
    },
    sim: { id: "calorimetria", scenario: "aquecimento" },
    observe: "Observe o gráfico T × t e o calor recebido Q: o que acontece com a temperatura enquanto a fração líquida cresce?",
    explanation:
      "Nos **patamares** o calor continua entrando, mas a temperatura não muda: a energia rompe as ligações do sólido (calor latente), sem aumentar a energia cinética média das moléculas. **Calor** é energia em trânsito por diferença de temperatura; **temperatura** mede a agitação térmica média. São grandezas diferentes.",
    check: {
      prompt: "Uma banheira com água a 40 °C e uma xícara com água a 80 °C. Qual tem mais energia térmica armazenada?",
      options: ["A xícara, porque está mais quente", "A banheira, porque tem muito mais água", "As duas têm a mesma", "Não dá para comparar energia térmica"],
      answer: 1,
      explanation: "A temperatura é maior na xícara, mas a energia interna depende também da quantidade de matéria. A banheira cede muito mais calor ao esfriar.",
    },
  },
  {
    id: "frio-entra",
    title: "O frio entra pela parede",
    statement: "Feche a janela para o frio não entrar; a parede fina deixa o frio passar.",
    appeal: "A sensação é de frio chegando. A linguagem trata \"frio\" como uma substância que flui, como o calórico antigo.",
    area: "fluidos-ondas-termo",
    topic: "Transferência de calor",
    predict: {
      prompt: "Numa casa a 22 °C num dia a 2 °C, o que atravessa a parede?",
      options: ["Frio, de fora para dentro", "Calor, de dentro para fora", "Calor de dentro para fora e frio de fora para dentro, ao mesmo tempo", "Nada, se a parede estiver em equilíbrio"],
      answer: 1,
    },
    sim: { id: "transferencia-calor", scenario: "parede" },
    observe: "Observe o perfil de temperatura dentro da parede e o sinal dos fluxos \"entrando\" e \"saindo\": em que sentido a energia está indo?",
    explanation:
      "Só existe fluxo de **calor**, sempre do mais quente para o mais frio. A casa esfria porque perde energia para fora; \"frio\" é só a ausência de energia térmica. Um isolante (como o isopor) não barra o frio: aumenta a resistência térmica e reduz o fluxo de calor que sai.",
    check: {
      prompt: "Um cobertor de lã deixa você aquecido numa noite fria porque:",
      options: ["produz calor", "impede o frio de entrar", "reduz a perda do calor que o seu corpo produz", "absorve o frio do ar"],
      answer: 2,
      explanation: "O cobertor é um isolante: o ar preso nas fibras conduz mal o calor. A fonte de energia é o seu corpo. Enrolado num objeto frio, o cobertor o manteria frio.",
    },
  },
  {
    id: "metal-mais-frio",
    title: "Metal é mais frio que madeira",
    statement: "A maçaneta de metal está mais fria que a porta de madeira, mesmo estando no mesmo lugar.",
    appeal: "Ao tocar, o metal realmente parece mais frio. A sensação de frio é interpretada como temperatura.",
    area: "fluidos-ondas-termo",
    topic: "Condução de calor",
    predict: {
      prompt: "Uma maçaneta de metal e uma porta de madeira estão há horas na mesma sala a 20 °C. As temperaturas delas:",
      options: ["metal mais frio", "madeira mais fria", "iguais", "depende da cor"],
      answer: 2,
    },
    sim: { id: "conducao-calor", scenario: "barra", params: { material: 0 } },
    observe: "Observe os termopares antes de o calor avançar: todos marcam a temperatura ambiente. Depois compare a rapidez com que o calor atravessa a barra de cobre e a de aço (troque o material).",
    explanation:
      "Em equilíbrio térmico, objetos no mesmo ambiente têm a mesma temperatura. O metal **parece** mais frio porque é melhor condutor: retira calor da sua mão muito mais depressa, e a pele sente a taxa de perda de calor, não a temperatura do objeto. Na barra de cobre ($k = 385$ W/m·K) o calor passa cerca de oito vezes mais rápido que no aço.",
    check: {
      prompt: "Numa sauna a 80 °C, sentar num banco de metal ou de madeira à mesma temperatura:",
      options: ["o metal parece mais quente", "a madeira parece mais quente", "parecem iguais", "o metal parece mais frio"],
      answer: 0,
      explanation: "Agora o objeto está mais quente que a pele: o metal transfere calor para você mais depressa e queima. Por isso os bancos de sauna são de madeira.",
    },
  },
  {
    id: "onda-amplitude",
    title: "Onda maior anda mais rápido",
    statement: "Se eu sacudir a corda com mais força, o pulso vai chegar mais rápido na outra ponta.",
    appeal: "Mais força no movimento da mão parece dar mais velocidade, como ao jogar uma bola. A velocidade da onda é confundida com a do meio.",
    area: "fluidos-ondas-termo",
    topic: "Ondas em cordas",
    source: "Wittmann et al.",
    predict: {
      prompt: "Numa mesma corda esticada, um pulso alto e um pulso baixo são gerados. Qual chega antes à outra ponta?",
      options: ["O pulso alto", "O pulso baixo", "Chegam ao mesmo tempo"],
      answer: 2,
    },
    sim: { id: "onda-corda", scenario: "fixa", params: { A: 0.6 } },
    observe: "Observe quanto tempo o pulso leva para chegar à parede. Depois reduza a amplitude A para 0,2 e compare. Em seguida mude a tensão T.",
    explanation:
      "A velocidade do pulso depende só do meio: $v = \\sqrt{T/\\mu}$ (tensão e densidade linear da corda). A amplitude muda a energia transportada, não a rapidez. Para um pulso mais rápido é preciso esticar mais a corda ou usar uma corda mais leve.",
    check: {
      prompt: "Você fala baixo e depois grita para um amigo a 100 m. Qual som chega antes?",
      options: ["O grito", "A fala baixa", "Chegam juntos"],
      answer: 2,
      explanation: "A velocidade do som no ar (≈ 343 m/s) depende da temperatura do ar, não da intensidade.",
    },
  },
  {
    id: "som-no-vacuo",
    title: "O som viaja no vácuo",
    statement: "No espaço dá para ouvir a explosão de uma nave, só que mais fraco.",
    appeal: "Filmes de ficção mostram explosões barulhentas no espaço, e a luz atravessa o vácuo, então parece que o som também atravessaria.",
    area: "fluidos-ondas-termo",
    topic: "Ondas sonoras",
    predict: {
      prompt: "O que está oscilando quando um som de 200 Hz se propaga no ar?",
      options: ["Nada material: o som é uma onda de energia pura", "As próprias moléculas do ar, para a frente e para trás", "Ondas eletromagnéticas emitidas pela fonte", "Partículas de som que viajam da fonte ao ouvinte"],
      answer: 1,
    },
    sim: { id: "som-intensidade", scenario: "longitudinal" },
    observe: "Observe as porções de ar no painel de cima: como elas se movem em relação à direção de propagação, e onde ficam as compressões e rarefações?",
    explanation:
      "O som é uma onda **mecânica**: são as moléculas do meio que oscilam e empurram as vizinhas, formando compressões e rarefações de pressão. Sem meio material, como no vácuo, não há o que oscilar e o som não se propaga. A luz é diferente: é onda eletromagnética e não precisa de meio.",
    check: {
      prompt: "Uma campainha toca dentro de um pote de vidro enquanto o ar é retirado por uma bomba. O que acontece?",
      options: ["O som fica mais agudo", "O som vai ficando mais fraco até quase sumir", "O som fica igual, pois o vidro vibra", "O som fica mais alto"],
      answer: 1,
      explanation: "Com menos ar, há cada vez menos meio para transmitir a vibração até o vidro. Ainda se ouve um pouco pelo suporte da campainha.",
    },
  },
  {
    id: "pesado-afunda",
    title: "Coisas pesadas afundam",
    statement: "Um tronco grande afunda porque é pesado; um prego flutua porque é leve.",
    appeal: "Muitos objetos pesados do dia a dia afundam e muitos leves flutuam; a densidade é um conceito menos intuitivo que o peso.",
    area: "fluidos-ondas-termo",
    topic: "Empuxo",
    predict: {
      prompt: "Um bloco de pinho grande, de várias toneladas, é colocado na água. Ele:",
      options: ["afunda, por ser muito pesado", "flutua, com cerca de metade do volume submerso", "fica totalmente submerso, a meia profundidade", "depende do formato"],
      answer: 1,
    },
    sim: { id: "empuxo", scenario: "flutua", params: { a: 30 } },
    observe: "Observe a fração submersa do bloco de pinho grande. Depois troque o material para ferro e reduza o tamanho: o que decide se ele afunda?",
    explanation:
      "Quem decide é a **densidade**, não o peso. O empuxo é o peso do líquido deslocado; um corpo flutua se for menos denso que o líquido, com fração submersa $\\rho_{corpo}/\\rho_{líquido}$. O pinho (500 kg/m³) flutua com metade submersa qualquer que seja o tamanho; o ferro (7870 kg/m³) afunda na água qualquer que seja o tamanho, mas flutua no mercúrio.",
    check: {
      prompt: "Como um navio de aço de 100 mil toneladas flutua, se o aço é mais denso que a água?",
      options: ["Os motores o mantêm na superfície", "O casco oco desloca um volume de água cujo peso iguala o do navio", "A água do mar é mais densa que o aço", "Navios grandes não seguem o princípio de Arquimedes"],
      answer: 1,
      explanation: "A densidade média do navio (aço + ar do casco) é menor que a da água. Se o casco se enche de água, a densidade média sobe e ele afunda.",
    },
  },
  {
    id: "pressao-quantidade-agua",
    title: "Mais água, mais pressão no fundo",
    statement: "No recipiente que tem mais água, a pressão no fundo é maior.",
    appeal: "Parece natural que o peso de toda a água acima \"se apoie\" no fundo. A pressão é confundida com o peso total.",
    area: "fluidos-ondas-termo",
    topic: "Hidrostática",
    predict: {
      prompt: "Vasos de formatos diferentes (cilíndrico, alargado em cima, com gargalo) têm a mesma área de fundo e a mesma altura de água. A força da água no fundo é maior:",
      options: ["no alargado, que tem mais água", "no de gargalo", "igual em todos"],
      answer: 2,
    },
    sim: { id: "vasos-comunicantes", scenario: "paradoxo" },
    observe: "Observe a força no fundo e o peso da água em cada vaso: os valores coincidem?",
    explanation:
      "A pressão num líquido em repouso só depende da profundidade: $p = p_0 + \\rho g h$. Com mesma altura e mesma área de fundo, a força no fundo é a mesma ($\\rho g h A$) em todos os vasos. A diferença de peso é sustentada pelas paredes inclinadas. É o paradoxo hidrostático.",
    check: {
      prompt: "Uma represa estreita e alta e um lago enorme e raso. Qual barragem precisa ser mais resistente na base?",
      options: ["A do lago enorme, que tem mais água", "A da represa alta, que tem maior profundidade", "As duas igualmente"],
      answer: 1,
      explanation: "A pressão na base depende da profundidade, não do volume de água armazenado atrás da barragem.",
    },
  },
  {
    id: "ferver-mais-forte",
    title: "Fervura forte esquenta mais",
    statement: "Se eu aumentar o fogo, a água fervendo fica mais quente e o macarrão cozinha mais rápido.",
    appeal: "Mais fogo costuma significar mais temperatura, e a fervura mais vigorosa parece mais quente.",
    area: "fluidos-ondas-termo",
    topic: "Mudança de fase",
    predict: {
      prompt: "Água já fervendo ao nível do mar recebe o triplo da potência do fogão. A temperatura dela:",
      options: ["sobe para cerca de 120 °C", "fica em 100 °C; ela só evapora mais depressa", "sobe um pouco, para uns 102 °C", "cai, pois evapora mais"],
      answer: 1,
    },
    sim: { id: "calorimetria", scenario: "aquecimento", params: { P: 5000 } },
    observe: "Observe o patamar de ebulição em 100 °C com potência alta. Compare com a potência menor: o que muda é a temperatura do patamar ou a duração dele?",
    explanation:
      "Durante a ebulição sob pressão constante a temperatura fica fixa (100 °C a 1 atm). Mais potência só encurta o patamar: mais vapor por segundo. Para cozinhar mais rápido é preciso aumentar a **pressão** (panela de pressão), o que eleva a temperatura de ebulição.",
    check: {
      prompt: "No alto de uma montanha, a água ferve a cerca de 90 °C. O feijão cozinha:",
      options: ["mais rápido, porque ferve antes", "mais devagar, porque a água fervente está mais fria", "no mesmo tempo"],
      answer: 1,
      explanation: "Com pressão atmosférica menor, a água ferve a temperatura mais baixa; a comida fica em água menos quente e cozinha mais devagar.",
    },
  },
  {
    id: "doppler-volume",
    title: "O Doppler é o som ficando mais alto",
    statement: "A sirene muda de som quando passa porque fica mais forte quando chega perto e mais fraca quando se afasta.",
    appeal: "Intensidade e altura (frequência) são confundidas: \"som alto\" no cotidiano quer dizer tanto forte quanto agudo.",
    area: "fluidos-ondas-termo",
    topic: "Efeito Doppler",
    predict: {
      prompt: "Uma ambulância se aproxima com velocidade constante. A frequência que você ouve, enquanto ela se aproxima:",
      options: ["vai aumentando aos poucos", "é constante e maior que a emitida", "é igual à emitida, só a intensidade muda", "é constante e menor que a emitida"],
      answer: 1,
    },
    sim: { id: "doppler", scenario: "ambulancia" },
    observe: "Observe o espaçamento das frentes de onda à frente e atrás da fonte, e o gráfico da frequência medida f′ antes e depois da passagem.",
    explanation:
      "Com a fonte em movimento, as frentes de onda ficam comprimidas à frente e espaçadas atrás: a **frequência** percebida é constante e maior na aproximação ($f/(1 - M)$) e constante e menor no afastamento ($f/(1 + M)$). A intensidade varia com a distância, mas é outro efeito: um som pode ficar mais forte sem ficar mais agudo.",
    check: {
      prompt: "Você corre em direção a um alto-falante parado que emite 440 Hz. Você ouve:",
      options: ["440 Hz, pois a fonte está parada", "um pouco mais que 440 Hz", "um pouco menos que 440 Hz"],
      answer: 1,
      explanation: "O Doppler também ocorre quando o ouvinte se move: você encontra mais frentes de onda por segundo, $f' = f(1 + v_o/c)$.",
    },
  },
  {
    id: "gas-mesma-velocidade",
    title: "Todas as moléculas têm a mesma velocidade",
    statement: "Num gás a 300 K, todas as moléculas se movem com a mesma velocidade, que corresponde àquela temperatura.",
    appeal: "A temperatura é um número só, e a fórmula da velocidade quadrática média dá um valor só, que é tomado como a velocidade de cada molécula.",
    area: "fluidos-ondas-termo",
    topic: "Teoria cinética",
    predict: {
      prompt: "Moléculas começam todas com a mesma rapidez e colidem elasticamente entre si por muito tempo. Depois, as rapidezes:",
      options: ["continuam todas iguais", "se espalham: muitas moléculas medianas, algumas lentas e algumas muito rápidas", "caem a zero", "ficam metade rápidas e metade paradas"],
      answer: 1,
    },
    sim: { id: "gas-ideal", scenario: "relaxacao" },
    observe: "Observe o histograma de rapidez enquanto as colisões acontecem e compare com a curva de Maxwell–Boltzmann.",
    explanation:
      "As colisões trocam energia entre as moléculas e a distribuição evolui para a de Maxwell–Boltzmann, larga e assimétrica. A temperatura é ligada à energia cinética **média**, não à de cada molécula. A cauda de moléculas rápidas explica, por exemplo, por que a água evapora abaixo de 100 °C.",
    check: {
      prompt: "Uma poça de água seca ao sol a 30 °C, bem abaixo do ponto de ebulição. Por quê?",
      options: ["A água ferve a 30 °C ao sol", "Algumas moléculas da superfície têm energia bem acima da média e escapam", "O sol decompõe a água", "A água é absorvida pelo chão, não evapora"],
      answer: 1,
      explanation: "Na distribuição de velocidades sempre há moléculas rápidas o bastante para vencer a atração das vizinhas. A evaporação leva as mais energéticas e esfria o restante.",
    },
  },

  // ───────────────────────────── Eletromagnetismo ─────────────────────────────
  {
    id: "corrente-gasta",
    title: "A corrente é gasta na lâmpada",
    statement: "A corrente sai da bateria, a primeira lâmpada consome uma parte e sobra menos para a segunda.",
    appeal: "A lâmpada \"consome\" algo, e é natural pensar que é a corrente. A energia (que realmente é convertida) é confundida com a carga (que se conserva).",
    area: "eletromagnetismo",
    topic: "Circuitos DC",
    source: "DIRECT",
    predict: {
      prompt: "Três resistores estão em série com uma bateria. Comparando a corrente que entra no primeiro com a que sai do último:",
      options: ["Sai menos, porque os resistores consomem corrente", "São iguais", "Sai mais", "Depende de qual resistor é maior"],
      answer: 1,
    },
    sim: { id: "circuitos-dc", scenario: "serie" },
    observe: "Observe a leitura do amperímetro e selecione cada resistor para ver a corrente e a tensão nele.",
    explanation:
      "A corrente é a **mesma** em todos os elementos em série: a carga se conserva e não se acumula em lugar nenhum. O que muda ao longo do circuito é o **potencial**: cada resistor converte energia elétrica em calor e luz, e a tensão cai ($V = RI$). A lâmpada gasta energia, não carga.",
    check: {
      prompt: "Uma lâmpada está ligada a uma pilha. Comparando a corrente no fio que chega à lâmpada com a do fio que sai dela:",
      options: ["Maior no fio que chega", "Maior no fio que sai", "Iguais"],
      answer: 2,
      explanation: "Toda carga que entra na lâmpada sai dela. Se medir com o amperímetro antes e depois, a leitura é a mesma.",
    },
  },
  {
    id: "bateria-corrente-constante",
    title: "Bateria é fonte de corrente constante",
    statement: "A pilha sempre fornece a mesma corrente; o circuito só reparte essa corrente entre as lâmpadas.",
    appeal: "A pilha parece um reservatório que \"solta\" uma quantidade fixa de corrente. A ideia de diferença de potencial é abstrata.",
    area: "eletromagnetismo",
    topic: "Circuitos DC",
    source: "DIRECT",
    predict: {
      prompt: "Duas lâmpadas iguais ligadas em paralelo a uma bateria, comparadas com duas iguais ligadas em série a outra bateria igual. A corrente fornecida pela bateria é:",
      options: ["a mesma nos dois casos", "maior no circuito em paralelo", "maior no circuito em série"],
      answer: 1,
    },
    sim: { id: "circuitos-dc", scenario: "lampadas" },
    observe: "Observe o brilho das lâmpadas dos dois lados e selecione uma lâmpada de cada lado para comparar as correntes.",
    explanation:
      "A bateria mantém aproximadamente uma **diferença de potencial** fixa; a corrente que ela fornece depende da resistência equivalente do circuito ($I = \\varepsilon/R_{eq}$). Em paralelo, $R_{eq}$ é menor, então a bateria fornece **mais** corrente (quatro vezes mais que em série, com lâmpadas iguais) e se descarrega mais rápido.",
    check: {
      prompt: "Numa casa, você liga mais aparelhos na mesma tomada (em paralelo). A corrente total no fio de entrada:",
      options: ["fica igual e é dividida entre os aparelhos", "aumenta", "diminui"],
      answer: 1,
      explanation: "A tensão da rede é fixa; cada aparelho em paralelo é um caminho a mais, e a corrente total cresce. Por isso os disjuntores desarmam com muitos aparelhos ligados.",
    },
  },
  {
    id: "eletrons-velocidade-luz",
    title: "Elétrons correm à velocidade da luz",
    statement: "A lâmpada acende na hora porque os elétrons saem do interruptor e chegam nela quase à velocidade da luz.",
    appeal: "A resposta instantânea do circuito sugere que algo viaja muito rápido do interruptor à lâmpada, e os elétrons são os candidatos óbvios.",
    area: "eletromagnetismo",
    topic: "Corrente elétrica",
    predict: {
      prompt: "Num fio de cobre comum com corrente de alguns ampères, a velocidade média de avanço (deriva) dos elétrons é da ordem de:",
      options: ["300 000 km/s", "1000 km/s", "1 m/s", "décimos de milímetro por segundo"],
      answer: 3,
    },
    sim: { id: "drude", scenario: "deriva", params: { lupa: 0 } },
    observe: "Observe o histograma de velocidades no modo \"Real\" e compare a velocidade de deriva v_d com a velocidade térmica v_th na tabela. Depois ligue a lupa ampliada.",
    explanation:
      "Os elétrons têm agitação térmica rápida (~10⁵ m/s) em todas as direções, mas a **deriva** que constitui a corrente é lentíssima (mm/s ou menos). A lâmpada acende na hora porque o **campo elétrico** se estabelece no fio inteiro quase à velocidade da luz, e os elétrons já presentes no filamento começam a derivar imediatamente, como água num cano já cheio.",
    check: {
      prompt: "Ao ligar o interruptor, os elétrons que passam pelo filamento da lâmpada no primeiro segundo vieram:",
      options: ["do interruptor", "da usina", "do próprio filamento e dos fios bem próximos dele", "da bateria"],
      answer: 2,
      explanation: "A deriva é tão lenta que, num segundo, os elétrons avançam menos de um milímetro. A energia chega pelo campo, não pela viagem dos elétrons.",
    },
  },
  {
    id: "campo-so-nas-linhas",
    title: "Campo só onde há linha",
    statement: "Entre duas linhas de campo desenhadas, o campo elétrico é zero.",
    appeal: "As linhas são desenhos concretos e parecem \"fios\" de campo; o espaço vazio entre elas parece sem campo.",
    area: "eletromagnetismo",
    topic: "Campo elétrico",
    source: "CSEM",
    predict: {
      prompt: "Uma carga positiva está desenhada com 16 linhas de campo. Num ponto exatamente entre duas linhas vizinhas, o campo é:",
      options: ["zero", "diferente de zero, com valor próximo ao das linhas vizinhas", "infinito", "só existe se você desenhar mais linhas"],
      answer: 1,
    },
    sim: { id: "campo-eletrico", scenario: "carga" },
    observe: "Observe a grade de vetores sobreposta às linhas e arraste a sonda para pontos entre duas linhas: |E| cai a zero ali?",
    explanation:
      "O campo existe em **todos** os pontos do espaço ao redor da carga; as linhas são só uma representação com um número escolhido de curvas. A **densidade** das linhas indica a intensidade e a tangente indica a direção. Desenhar mais linhas não muda o campo.",
    check: {
      prompt: "Um próton é colocado num ponto onde nenhuma linha de campo foi desenhada, perto de uma carga negativa. Ele:",
      options: ["fica parado, pois ali não há campo", "é atraído pela carga negativa", "é repelido", "só se move se estiver sobre uma linha"],
      answer: 1,
      explanation: "O campo da carga negativa age ali normalmente e aponta para ela; a força no próton, $q\\vec E$, o atrai.",
    },
  },
  {
    id: "ima-atrai-qualquer-metal",
    title: "Ímã atrai qualquer metal",
    statement: "Um ímã gruda em qualquer metal: alumínio, cobre, prata, ouro...",
    appeal: "Os objetos que um ímã atrai no dia a dia (geladeira, clipes, pregos) são de metal, então \"metal\" e \"magnético\" viram sinônimos.",
    area: "eletromagnetismo",
    topic: "Magnetismo na matéria",
    source: "CSEM",
    predict: {
      prompt: "Um ímã de geladeira é encostado numa lata de alumínio limpa. O que acontece?",
      options: ["Gruda, como no aço", "Não gruda: a resposta do alumínio é milhares de vezes mais fraca", "É repelido com força", "Gruda só se a lata estiver cheia"],
      answer: 1,
    },
    sim: { id: "magnetismo-materia", scenario: "dia" },
    observe: "Observe a magnetização M ao variar o campo h num material diamagnético (o efeito está exagerado para ficar visível). Depois troque para ferromagnético e compare a forma da curva.",
    explanation:
      "Só os materiais **ferromagnéticos** (ferro, níquel, cobalto e algumas ligas) têm domínios que se alinham em conjunto e produzem forte atração. Alumínio é paramagnético e cobre, prata e ouro são diamagnéticos: a resposta é da ordem de 10⁻⁵ da do ferro, imperceptível com um ímã comum. Ser metal (conduzir eletricidade) e ser magnético são propriedades diferentes.",
    check: {
      prompt: "Numa reciclagem, um ímã grande separa o lixo metálico. Ele recolhe:",
      options: ["latas de alumínio e de aço", "só as latas de aço", "só as de alumínio", "nenhuma lata"],
      answer: 1,
      explanation: "O aço (liga de ferro) é ferromagnético. O alumínio é separado por outro método: correntes de Foucault induzidas por ímãs em rotação.",
    },
  },
  {
    id: "neutro-nao-atraido",
    title: "Objeto neutro não sente carga",
    statement: "Um objeto sem carga não é atraído por um bastão carregado; só objetos com carga oposta são atraídos.",
    appeal: "A regra \"cargas opostas se atraem\" é aplicada ao pé da letra: sem carga, parece não haver interação.",
    area: "eletromagnetismo",
    topic: "Eletrostática",
    source: "CSEM",
    predict: {
      prompt: "Um bastão positivo se aproxima (sem encostar) da esfera de um eletroscópio neutro. As folhas:",
      options: ["não se movem, pois o eletroscópio está neutro", "se abrem", "se fecham ainda mais", "ficam negativas"],
      answer: 1,
    },
    sim: { id: "eletrizacao", scenario: "inducao" },
    observe: "Observe, depois de usar \"Aproximar\", a carga na esfera, nas folhas e a carga líquida do eletroscópio.",
    explanation:
      "O bastão positivo atrai elétrons para a esfera e deixa as folhas positivas: as folhas se repelem e abrem, embora a carga **total** continue zero. Essa separação de cargas (polarização) faz o lado mais próximo ter carga oposta à do bastão; como a força cai com a distância, a atração vence a repulsão. Por isso corpos neutros são atraídos por corpos carregados.",
    check: {
      prompt: "Um pente atritado no cabelo atrai pedacinhos de papel neutros. Isso ocorre porque:",
      options: ["o papel estava carregado", "o pente polariza o papel e a parte mais próxima tem carga oposta", "o pente é magnético", "o ar transfere carga ao papel antes"],
      answer: 1,
      explanation: "O papel é isolante, mas suas moléculas se polarizam. A carga induzida mais próxima do pente é atraída com mais força que a mais distante é repelida.",
    },
  },
  {
    id: "ima-parado-induz",
    title: "Ímã parado gera corrente",
    statement: "Se eu deixar um ímã forte dentro da bobina, ela vai ficar gerando corrente.",
    appeal: "O ímã tem campo e a bobina está no campo; parece que basta haver campo magnético para haver indução.",
    area: "eletromagnetismo",
    topic: "Indução eletromagnética",
    source: "CSEM",
    predict: {
      prompt: "Um ímã oscila através de uma espira. No instante em que ele está no centro dela, onde o fluxo magnético é máximo, a fem induzida é:",
      options: ["máxima", "zero", "metade da máxima", "infinita"],
      answer: 1,
    },
    sim: { id: "faraday-lenz", scenario: "oscilando" },
    observe: "Observe juntos o fluxo NΦ (azul) e a fem ε (laranja): onde o fluxo é máximo, quanto vale ε? Onde ε é maior?",
    explanation:
      "A fem depende da **variação** do fluxo, não do fluxo: $\\varepsilon = -N\\,d\\Phi/dt$. Com o ímã no centro, o fluxo passa por um máximo e não está mudando naquele instante: ε = 0. Um ímã parado dentro da bobina, por mais forte que seja, não induz corrente nenhuma.",
    check: {
      prompt: "Uma espira fica parada num campo magnético uniforme de 2 T que não varia. A corrente induzida:",
      options: ["é grande, pois o campo é forte", "é zero", "depende da área da espira", "alterna sozinha"],
      answer: 1,
      explanation: "Sem variação de fluxo (campo, área ou orientação), não há fem. Girar a espira ou variar o campo é o que gera corrente, como num gerador.",
    },
  },
  {
    id: "metal-nao-blinda",
    title: "O campo atravessa o metal",
    statement: "Dentro de uma caixa de metal o campo elétrico é ainda mais forte, porque o metal conduz eletricidade.",
    appeal: "Metal é associado a eletricidade e choque; parece que ele concentraria o campo em vez de bloqueá-lo.",
    area: "eletromagnetismo",
    topic: "Condutores",
    predict: {
      prompt: "Um anel condutor neutro é colocado num campo elétrico uniforme de 100 V/m. No interior do anel, o campo vale:",
      options: ["100 V/m", "mais de 100 V/m", "zero", "cerca de 50 V/m"],
      answer: 2,
    },
    sim: { id: "condutores-blindagem", scenario: "gaiola" },
    observe: "Observe |E| na sonda no centro do anel e arraste-a para fora. Repare nas cargas induzidas nos dois lados do condutor.",
    explanation:
      "As cargas livres do metal se rearranjam até que o campo delas **cancele** o externo em todo o interior: em equilíbrio, o campo dentro de um condutor (e numa cavidade vazia dentro dele) é zero. É a blindagem eletrostática da gaiola de Faraday. Ser bom condutor é exatamente o que permite essa redistribuição.",
    check: {
      prompt: "Durante uma tempestade, um lugar relativamente seguro contra raios é:",
      options: ["debaixo de uma árvore alta", "dentro de um carro de carroceria metálica, com as janelas fechadas", "em campo aberto, deitado", "segurando um guarda-chuva metálico"],
      answer: 1,
      explanation: "A carroceria funciona como gaiola de Faraday: a corrente do raio percorre a superfície metálica, não o interior.",
    },
  },

  // ───────────────────────────── Ótica e moderna ─────────────────────────────
  {
    id: "imagem-precisa-lente-inteira",
    title: "Cada parte da lente forma uma parte da imagem",
    statement: "Se eu tapar a metade de cima da lente, a imagem projetada perde a metade de cima.",
    appeal: "Pensa-se na imagem como um \"retrato\" que atravessa a lente pedaço por pedaço, cada parte da lente responsável por uma parte da imagem.",
    area: "otica-moderna",
    topic: "Lentes",
    source: "Goldberg & McDermott",
    predict: {
      prompt: "Uma lente convergente projeta numa tela a imagem real de uma vela. Você cobre a metade de cima da lente. A imagem:",
      options: ["perde a metade de cima", "perde a metade de baixo", "continua inteira, porém mais fraca", "desaparece"],
      answer: 2,
    },
    sim: { id: "lentes", scenario: "lente" },
    observe: "Observe os raios que saem da ponta do objeto: eles passam por partes diferentes da lente. Para onde todos convergem?",
    explanation:
      "Cada ponto do objeto envia raios para **toda** a lente, e todos os que a atravessam convergem para o mesmo ponto da imagem. Qualquer parte da lente basta para formar a imagem inteira; cobrir metade só reduz a quantidade de luz, e a imagem fica mais escura. Os três raios principais são só um atalho de desenho.",
    check: {
      prompt: "Um inseto pousa no centro da lente de um projetor. Na tela, aparece:",
      options: ["a silhueta nítida do inseto", "a imagem inteira, um pouco mais escura", "um buraco no centro da imagem", "a imagem cortada ao meio"],
      answer: 1,
      explanation: "O inseto está na lente, não no plano do objeto: ele só bloqueia parte dos raios de cada ponto. A imagem continua completa, com menos luz.",
    },
  },
  {
    id: "luz-intensa-arranca-eletron",
    title: "Luz mais intensa arranca elétrons",
    statement: "Se a luz não arranca elétrons do metal, é só aumentar a intensidade que uma hora eles saem.",
    appeal: "Classicamente, uma onda mais intensa carrega mais energia; parece que basta acumular energia suficiente.",
    area: "otica-moderna",
    topic: "Efeito fotoelétrico",
    predict: {
      prompt: "Luz azul (450 nm) não arranca elétrons de uma placa de zinco. Você dobra a potência da luz. O que acontece?",
      options: ["Os elétrons começam a sair", "Continua sem nenhum elétron", "Saem depois de algum tempo acumulando energia", "Saem elétrons mais lentos"],
      answer: 1,
    },
    sim: { id: "fotoeletrico", scenario: "limiar" },
    observe: "Observe a corrente com a potência no máximo. Depois diminua o comprimento de onda λ até a corrente aparecer e anote o valor.",
    explanation:
      "A luz troca energia com os elétrons em pacotes, os fótons, de energia $E = hf$. Cada elétron absorve um fóton: se $hf$ for menor que a função trabalho $\\phi$ do metal (4,3 eV no zinco), nenhum elétron sai, por mais fótons que cheguem. A intensidade só muda **quantos** fótons chegam; abaixo do limiar, nada acontece.",
    check: {
      prompt: "Acima do limiar, você dobra a intensidade da luz sem mudar a cor. A energia cinética máxima dos elétrons:",
      options: ["dobra", "não muda; o número de elétrons por segundo dobra", "cai pela metade", "aumenta um pouco"],
      answer: 1,
      explanation: "$K_{máx} = hf - \\phi$ depende só da frequência. Mais intensidade significa mais fótons e portanto mais elétrons, cada um com a mesma energia máxima.",
    },
  },
  {
    id: "orbitas-bohr-planetas",
    title: "Elétron em órbita como um planeta",
    statement: "O elétron do hidrogênio gira em volta do núcleo numa órbita circular, como a Terra em torno do Sol.",
    appeal: "O modelo de Bohr é ensinado com desenhos de órbitas, e a analogia com o sistema solar é forte e visual.",
    area: "otica-moderna",
    topic: "Átomo de hidrogênio",
    predict: {
      prompt: "No estado fundamental do hidrogênio, onde a densidade de probabilidade |ψ|² de encontrar o elétron é máxima?",
      options: ["Sobre uma circunferência de raio a₀", "No núcleo (r = 0)", "Distribuída igualmente em todo o espaço", "Num anel no plano equatorial"],
      answer: 1,
    },
    sim: { id: "hidrogenio", scenario: "1s" },
    observe: "Observe a nuvem de pontos do estado 1s girando a câmera e o gráfico P(r): onde estão mais pontos, e onde fica o pico de P(r)?",
    explanation:
      "Na mecânica quântica o elétron não tem trajetória: é descrito por uma nuvem de probabilidade esfericamente simétrica no estado 1s, com $|\\psi|^2$ máximo no núcleo. O raio de Bohr $a_0$ aparece como a distância **mais provável** (pico de $P(r) = 4\\pi r^2|\\psi|^2$), não como uma órbita. O modelo planetário acerta os níveis de energia, mas falha na estrutura do átomo.",
    check: {
      prompt: "Por que o elétron num átomo não espirala até o núcleo, como faria uma carga clássica em órbita que irradia energia?",
      options: ["Porque gira rápido demais", "Porque no estado fundamental não há estado de menor energia para onde ir; não é uma órbita clássica", "Porque o núcleo o repele a curta distância", "Porque perde energia muito devagar"],
      answer: 1,
      explanation: "O estado 1s é estacionário: a distribuição de carga não varia no tempo e não irradia. É a menor energia permitida.",
    },
  },
  {
    id: "imagem-no-espelho",
    title: "A imagem está na superfície do espelho",
    statement: "A minha imagem fica desenhada na superfície do espelho, como uma figura num papel.",
    appeal: "Vemos o espelho como um objeto plano e a imagem parece estar \"nele\", como uma foto.",
    area: "otica-moderna",
    topic: "Espelhos",
    predict: {
      prompt: "Você está a 1 m de um espelho plano. A que distância de você está a sua imagem?",
      options: ["1 m (na superfície do espelho)", "2 m", "0,5 m", "Depende do tamanho do espelho"],
      answer: 1,
    },
    sim: { id: "espelhos", scenario: "plano" },
    observe: "Observe os raios refletidos e os prolongamentos tracejados: onde eles se encontram? Arraste o objeto e acompanhe a imagem.",
    explanation:
      "A imagem num espelho plano é **virtual** e fica atrás dele, à mesma distância que o objeto está à frente ($p' = -p$). Os raios refletidos divergem como se viessem desse ponto. Por isso, ao fotografar seu reflexo, é preciso focar a câmera a uma distância maior que a do espelho.",
    check: {
      prompt: "Para ver o corpo inteiro num espelho plano vertical, a altura mínima do espelho é:",
      options: ["a sua altura", "metade da sua altura, qualquer que seja a distância", "depende da distância: mais longe, menor", "o dobro da sua altura"],
      answer: 1,
      explanation: "Os raios dos pés e da cabeça refletem em pontos a meia altura entre os olhos e cada extremidade: basta metade da altura, a qualquer distância.",
    },
  },
  {
    id: "filtro-tinge-luz",
    title: "O filtro pinta a luz",
    statement: "O filtro vermelho tinge a luz branca de vermelho, como uma tinta.",
    appeal: "A luz sai vermelha do filtro, e parece que ele acrescentou vermelho a ela, como um pigmento.",
    area: "otica-moderna",
    topic: "Cor",
    predict: {
      prompt: "Uma folha verde é iluminada só por luz que passou por um filtro vermelho. Ela aparece:",
      options: ["verde", "vermelha", "quase preta", "amarela"],
      answer: 2,
    },
    sim: { id: "cores-visao", scenario: "filtros" },
    observe: "Observe a cor do tomate, da folha e da camisa azul sob o filtro vermelho. Depois troque para o filtro verde e o azul.",
    explanation:
      "O filtro não acrescenta nada: ele **remove** (absorve) as componentes que não são vermelhas e deixa passar só o vermelho. A folha reflete principalmente verde; sem verde na luz que recebe, quase nada é refletido e ela parece escura. A cor de um objeto depende da luz que o ilumina.",
    check: {
      prompt: "Sob a luz amarela quase monocromática de uma lâmpada de sódio, um carro azul parece:",
      options: ["azul", "verde", "escuro, quase preto", "branco"],
      answer: 2,
      explanation: "A lâmpada de sódio emite quase só 589 nm. Uma pintura azul absorve essa luz e reflete muito pouco: parece escura.",
    },
  },
  {
    id: "meia-vida-dobro",
    title: "Duas meias-vidas, tudo decaiu",
    statement: "Se em uma meia-vida decai metade, em duas meias-vidas decai tudo.",
    appeal: "Raciocínio linear: se a metade some num intervalo, a outra metade sumiria no próximo intervalo igual.",
    area: "otica-moderna",
    topic: "Decaimento radioativo",
    predict: {
      prompt: "Uma amostra tem meia-vida de 5 s. Depois de 10 s, que fração dos núcleos ainda não decaiu?",
      options: ["Nenhuma", "1/2", "1/4", "1/3"],
      answer: 2,
    },
    sim: { id: "decaimento", scenario: "simples" },
    observe: "Observe a fração restante N/N₀ em t = 5 s e em t = 10 s, e a forma do gráfico de ln N.",
    explanation:
      "Cada núcleo tem a mesma probabilidade de decair por unidade de tempo, sem \"memória\" da idade. Assim, em cada meia-vida decai metade do que **restou**: $N = N_0 (1/2)^{t/T_{1/2}}$. Depois de duas meias-vidas sobra 1/4; depois de dez, cerca de 1/1000. O decaimento é exponencial, não linear.",
    check: {
      prompt: "Um núcleo de uma amostra com meia-vida de 1 hora já existe há 3 horas sem decair. A probabilidade de ele decair na próxima hora é:",
      options: ["maior, porque já está \"velho\"", "50%, igual à de qualquer núcleo", "100%", "menor, porque ele é resistente"],
      answer: 1,
      explanation: "O decaimento é aleatório e sem memória: a probabilidade de decair na próxima meia-vida é sempre 1/2, qualquer que seja a idade do núcleo.",
    },
  },
  {
    id: "refracao-sempre-desvia",
    title: "A luz sempre se desvia ao mudar de meio",
    statement: "Quando a luz passa do ar para a água, ela sempre se dobra.",
    appeal: "Os exemplos mostrados (canudo \"quebrado\" no copo) sempre têm incidência oblíqua, e refração vira sinônimo de \"curvar\".",
    area: "otica-moderna",
    topic: "Refração",
    predict: {
      prompt: "Um raio de luz incide perpendicularmente (ângulo de 0° com a normal) do ar para um bloco de vidro. Ele:",
      options: ["se desvia em direção à normal", "atravessa sem mudar de direção, mas mais devagar", "é totalmente refletido", "se desvia para longe da normal"],
      answer: 1,
    },
    sim: { id: "refracao", scenario: "snell", params: { theta: 0 } },
    observe: "Observe o ângulo de refração θ₂ com incidência normal (θ₁ = 0). Depois aumente θ₁ e veja quando o desvio aparece.",
    explanation:
      "Pela lei de Snell, $n_1\\sin\\theta_1 = n_2\\sin\\theta_2$: com $\\theta_1 = 0$, $\\theta_2 = 0$ e não há desvio. A refração é, antes de tudo, a mudança de **velocidade** da luz ($v = c/n$); a mudança de direção só aparece com incidência oblíqua.",
    check: {
      prompt: "Uma pessoa olha um peixe exatamente de cima, na vertical. Comparando a posição aparente com a real, o peixe parece:",
      options: ["deslocado para o lado", "na mesma direção, mas mais perto da superfície", "na mesma posição exata", "mais fundo"],
      answer: 1,
      explanation: "Na vertical não há desvio lateral, mas os raios quase verticais que entram no olho divergem como se viessem de uma profundidade aparente menor (≈ h/n).",
    },
  },
  {
    id: "energia-vai-mais-alto",
    title: "Ganha impulso na descida",
    statement: "O skatista que desce a rampa ganha impulso no fundo e consegue subir mais alto do outro lado.",
    appeal: "Na descida a velocidade aumenta muito, e essa velocidade parece algo \"a mais\" que permite ir além do ponto de partida.",
    area: "mecanica",
    topic: "Energia mecânica",
    predict: {
      prompt: "Solto do repouso a 6 m de altura numa meia-pipe sem atrito, até que altura o carrinho sobe do outro lado?",
      options: ["Menos de 6 m", "Exatamente 6 m", "Mais de 6 m"],
      answer: 1,
    },
    sim: { id: "montanha-russa", scenario: "meia-pipe" },
    observe: "Observe as barras de energia K e U durante o movimento e a linha da energia mecânica no gráfico U(s).",
    explanation:
      "Sem atrito, a energia mecânica $E = K + U$ se conserva: a energia cinética ganha na descida é exatamente a potencial perdida, e ela só basta para voltar à mesma altura. Para subir mais é preciso que alguma força externa realize trabalho positivo, como o skatista que flexiona as pernas.",
    check: {
      prompt: "Uma bola de boliche presa ao teto como pêndulo é solta encostada no nariz de uma pessoa, sem empurrão. Ao voltar, ela:",
      options: ["acerta o nariz com força", "para um pouco antes do nariz", "volta exatamente até tocar o nariz com mais velocidade"],
      answer: 1,
      explanation: "Com um pouco de atrito do ar, a bola volta a uma altura um pouco menor que a inicial. Sem empurrão, ela nunca ultrapassa o ponto de partida.",
    },
  },
];

// ───────────────────────────── consultas ─────────────────────────────

export function findConcept(id: string): Concept | undefined {
  return concepts.find((c) => c.id === id);
}

/** Parâmetros de busca da sim que confronta a concepção (cenário e p.<chave>=valor). */
export function conceptSimQuery(c: Concept): URLSearchParams {
  const q = new URLSearchParams();
  q.set("cenario", c.sim.scenario);
  q.set("concepcao", c.id);
  for (const [k, v] of Object.entries(c.sim.params ?? {})) q.set(`p.${k}`, String(v));
  return q;
}

export function conceptSimHref(c: Concept): string {
  return simHref(c.sim.id, conceptSimQuery(c));
}

export const conceptHref = (id: string) => `#/concepcoes/${encodeURIComponent(id)}`;

/** Normaliza para busca: minúsculas, sem acentos. */
export function normalize(s: string): string {
  return s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
}

/** Filtra por área e por texto (título, frase do aluno, tópico, fonte), ignorando acentos. */
export function searchConcepts(list: Concept[], text: string, area?: ConceptArea | ""): Concept[] {
  const words = normalize(text).split(/\s+/).filter(Boolean);
  return list.filter((c) => {
    if (area && c.area !== area) return false;
    const hay = normalize([c.title, c.statement, c.topic, c.source ?? "", c.sim.id].join(" "));
    return words.every((w) => hay.includes(w));
  });
}

// ───────────────────────────── progresso ─────────────────────────────

export interface ConceptRecord {
  /** Opção escolhida na previsão (fica registrada e não muda). */
  prediction?: number;
  /** O aluno abriu a simulação (ou declarou que observou). */
  observed?: boolean;
  /** Última resposta da verificação. */
  check?: number;
  /** Tentativas na verificação. */
  attempts?: number;
  updatedAt?: string;
}

export type ConceptProgress = Record<string, ConceptRecord>;

export type ConceptStage = "nova" | "previu" | "observou" | "revisar" | "superada";

export const stageLabel: Record<ConceptStage, string> = {
  nova: "Nova",
  previu: "Previsão feita",
  observou: "Observada",
  revisar: "Revisar",
  superada: "Superada",
};

export function stageOf(c: Concept, r: ConceptRecord | undefined): ConceptStage {
  if (!r || r.prediction === undefined) return "nova";
  if (r.check !== undefined) return r.check === c.check.answer ? "superada" : "revisar";
  return r.observed ? "observou" : "previu";
}

const stamp = (r: ConceptRecord): ConceptRecord => ({ ...r, updatedAt: new Date().toISOString() });

export function recordPrediction(p: ConceptProgress, id: string, choice: number): ConceptProgress {
  const r = p[id] ?? {};
  if (r.prediction !== undefined) return p;
  return { ...p, [id]: stamp({ ...r, prediction: choice }) };
}

export function recordObserved(p: ConceptProgress, id: string): ConceptProgress {
  const r = p[id] ?? {};
  if (r.observed) return p;
  return { ...p, [id]: stamp({ ...r, observed: true }) };
}

export function recordCheck(p: ConceptProgress, id: string, choice: number): ConceptProgress {
  const r = p[id] ?? {};
  return { ...p, [id]: stamp({ ...r, check: choice, attempts: (r.attempts ?? 0) + 1 }) };
}

/** Limpa só a resposta da verificação, para tentar de novo (a previsão continua registrada). */
export function retryCheck(p: ConceptProgress, id: string): ConceptProgress {
  const r = p[id];
  if (!r || r.check === undefined) return p;
  const { check: _c, ...rest } = r;
  return { ...p, [id]: stamp(rest) };
}

export interface ConceptSummary {
  total: number;
  superadas: number;
  emAndamento: number;
  /** Previsões feitas que estavam erradas (a concepção alternativa apareceu). */
  previsoesErradas: number;
  previsoes: number;
}

export function summarize(list: Concept[], p: ConceptProgress): ConceptSummary {
  let superadas = 0, emAndamento = 0, previsoesErradas = 0, previsoes = 0;
  for (const c of list) {
    const r = p[c.id];
    const st = stageOf(c, r);
    if (st === "superada") superadas++;
    else if (st !== "nova") emAndamento++;
    if (r?.prediction !== undefined) {
      previsoes++;
      if (r.prediction !== c.predict.answer) previsoesErradas++;
    }
  }
  return { total: list.length, superadas, emAndamento, previsoesErradas, previsoes };
}

export const PROGRESS_KEY = "fisilab.concepcoes.v1";

type StorageLike = Pick<Storage, "getItem" | "setItem">;

function defaultStorage(): StorageLike | undefined {
  try {
    return typeof localStorage === "undefined" ? undefined : localStorage;
  } catch {
    return undefined;
  }
}

export function loadConceptProgress(storage: StorageLike | undefined = defaultStorage()): ConceptProgress {
  try {
    const raw = storage?.getItem(PROGRESS_KEY);
    const v: unknown = raw ? JSON.parse(raw) : null;
    return v && typeof v === "object" && !Array.isArray(v) ? (v as ConceptProgress) : {};
  } catch {
    return {};
  }
}

export function saveConceptProgress(p: ConceptProgress, storage: StorageLike | undefined = defaultStorage()): void {
  try {
    storage?.setItem(PROGRESS_KEY, JSON.stringify(p));
  } catch {
    /* armazenamento indisponível (modo privado, cota): o progresso vale só nesta sessão */
  }
}
