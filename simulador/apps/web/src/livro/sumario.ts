/**
 * Sumário do FisiLab, na ordem de "Fundamentos de Física" (Halliday, Resnick e Walker).
 * Só a estrutura (partes, capítulos, seções); as explicações e os experimentos de
 * cada seção ficam em ./capitulos/capNN.ts.
 */
export interface BookSection {
  /** Número da seção, como no livro ("2-7"). */
  id: string;
  title: string;
  /** Subtópicos listados dentro da seção, quando há. */
  topics?: string[];
}

export interface BookChapter {
  n: number;
  title: string;
  sections: BookSection[];
}

export interface BookPart {
  /** "I", "II", "III", "IV". */
  id: string;
  title: string;
  chapters: BookChapter[];
}

export const parts: BookPart[] = [
  {
    id: "I",
    title: "Mecânica",
    chapters: [
      {
        n: 1,
        title: "Medição",
        sections: [
          {
            id: "1-2",
            title: "Medindo Grandezas",
          },
          {
            id: "1-3",
            title: "O Sistema Internacional de Unidades",
          },
          {
            id: "1-4",
            title: "Mudança de Unidades",
          },
          {
            id: "1-5",
            title: "Comprimento",
          },
          {
            id: "1-6",
            title: "Tempo",
          },
          {
            id: "1-7",
            title: "Massa",
          },
        ],
      },
      {
        n: 2,
        title: "Movimento Retilíneo",
        sections: [
          {
            id: "2-2",
            title: "Movimento",
          },
          {
            id: "2-3",
            title: "Posição e Deslocamento",
          },
          {
            id: "2-4",
            title: "Velocidade Média e Velocidade Escalar Média",
          },
          {
            id: "2-5",
            title: "Velocidade Instantânea e Velocidade Escalar Instantânea",
          },
          {
            id: "2-6",
            title: "Aceleração",
          },
          {
            id: "2-7",
            title: "Aceleração Constante: Um Caso Especial",
          },
          {
            id: "2-8",
            title: "Mais sobre Aceleração Constante",
          },
          {
            id: "2-9",
            title: "Aceleração em Queda Livre",
          },
          {
            id: "2-10",
            title: "Integração de Gráficos em Análise de Movimento",
          },
        ],
      },
      {
        n: 3,
        title: "Vetores",
        sections: [
          {
            id: "3-2",
            title: "Vetores e Escalares",
          },
          {
            id: "3-3",
            title: "Soma Geométrica de Vetores",
          },
          {
            id: "3-4",
            title: "Componentes de Vetores",
          },
          {
            id: "3-5",
            title: "Vetores Unitários",
          },
          {
            id: "3-6",
            title: "Soma de Vetores a partir das Componentes",
          },
          {
            id: "3-7",
            title: "Vetores e as Leis da Física",
          },
          {
            id: "3-8",
            title: "Multiplicação de Vetores",
          },
        ],
      },
      {
        n: 4,
        title: "Movimento em Duas e Três Dimensões",
        sections: [
          {
            id: "4-2",
            title: "Posição e Deslocamento",
          },
          {
            id: "4-3",
            title: "Velocidade Média e Velocidade Instantânea",
          },
          {
            id: "4-4",
            title: "Aceleração Média e Aceleração Instantânea",
          },
          {
            id: "4-5",
            title: "Movimento Balístico",
          },
          {
            id: "4-6",
            title: "Análise do Movimento Balístico",
          },
          {
            id: "4-7",
            title: "Movimento Circular Uniforme",
          },
          {
            id: "4-8",
            title: "Movimento Relativo em Uma Dimensão",
          },
          {
            id: "4-9",
            title: "Movimento Relativo em Duas Dimensões",
          },
        ],
      },
      {
        n: 5,
        title: "Força e Movimento — I",
        sections: [
          {
            id: "5-2",
            title: "Mecânica Newtoniana",
          },
          {
            id: "5-3",
            title: "A Primeira Lei de Newton",
          },
          {
            id: "5-4",
            title: "Força",
          },
          {
            id: "5-5",
            title: "Massa",
          },
          {
            id: "5-6",
            title: "A Segunda Lei de Newton",
          },
          {
            id: "5-7",
            title: "Algumas Forças Especiais",
          },
          {
            id: "5-8",
            title: "A Terceira Lei de Newton",
          },
          {
            id: "5-9",
            title: "Aplicando as Leis de Newton",
          },
        ],
      },
      {
        n: 6,
        title: "Força e Movimento — II",
        sections: [
          {
            id: "6-2",
            title: "Atrito",
          },
          {
            id: "6-3",
            title: "Propriedades do Atrito",
          },
          {
            id: "6-4",
            title: "Força de Arrasto e Velocidade Terminal",
          },
          {
            id: "6-5",
            title: "Movimento Circular Uniforme",
          },
        ],
      },
      {
        n: 7,
        title: "Energia Cinética e Trabalho",
        sections: [
          {
            id: "7-2",
            title: "O que É Energia?",
          },
          {
            id: "7-3",
            title: "Energia Cinética",
          },
          {
            id: "7-4",
            title: "Trabalho",
          },
          {
            id: "7-5",
            title: "Trabalho e Energia Cinética",
          },
          {
            id: "7-6",
            title: "Trabalho Realizado pela Força Gravitacional",
          },
          {
            id: "7-7",
            title: "Trabalho Realizado por uma Força Elástica",
          },
          {
            id: "7-8",
            title: "Trabalho Realizado por uma Força Variável Genérica",
          },
          {
            id: "7-9",
            title: "Potência",
          },
        ],
      },
      {
        n: 8,
        title: "Energia Potencial e Conservação da Energia",
        sections: [
          {
            id: "8-2",
            title: "Trabalho e Energia Potencial",
          },
          {
            id: "8-3",
            title:
              "Independência da Trajetória para o Trabalho de Forças Conservativas",
          },
          {
            id: "8-4",
            title: "Cálculo da Energia Potencial",
          },
          {
            id: "8-5",
            title: "Conservação da Energia Mecânica",
          },
          {
            id: "8-6",
            title: "Interpretação de uma Curva de Energia Potencial",
          },
          {
            id: "8-7",
            title: "Trabalho Realizado por uma Força Externa sobre um Sistema",
          },
          {
            id: "8-8",
            title: "Conservação da Energia",
          },
        ],
      },
      {
        n: 9,
        title: "Centro de Massa e Momento Linear",
        sections: [
          {
            id: "9-2",
            title: "O Centro de Massa",
          },
          {
            id: "9-3",
            title: "A Segunda Lei de Newton para um Sistema de Partículas",
          },
          {
            id: "9-4",
            title: "Momento Linear",
          },
          {
            id: "9-5",
            title: "O Momento Linear de um Sistema de Partículas",
          },
          {
            id: "9-6",
            title: "Colisão e Impulso",
          },
          {
            id: "9-7",
            title: "Conservação do Momento Linear",
          },
          {
            id: "9-8",
            title: "Momento e Energia Cinética em Colisões",
          },
          {
            id: "9-9",
            title: "Colisões Inelásticas em Uma Dimensão",
          },
          {
            id: "9-10",
            title: "Colisões Elásticas em Uma Dimensão",
          },
          {
            id: "9-11",
            title: "Colisões em Duas Dimensões",
          },
          {
            id: "9-12",
            title: "Sistemas de Massa Variável: Um Foguete",
          },
        ],
      },
      {
        n: 10,
        title: "Rotação",
        sections: [
          {
            id: "10-2",
            title: "As Variáveis da Rotação",
          },
          {
            id: "10-3",
            title: "As Grandezas Angulares São Vetores?",
          },
          {
            id: "10-4",
            title: "Rotação com Aceleração Angular Constante",
          },
          {
            id: "10-5",
            title: "Relações entre as Variáveis Lineares e Angulares",
          },
          {
            id: "10-6",
            title: "Energia Cinética de Rotação",
          },
          {
            id: "10-7",
            title: "Cálculo do Momento de Inércia",
          },
          {
            id: "10-8",
            title: "Torque",
          },
          {
            id: "10-9",
            title: "A Segunda Lei de Newton para Rotações",
          },
          {
            id: "10-10",
            title: "Trabalho e Energia Cinética de Rotação",
          },
        ],
      },
      {
        n: 11,
        title: "Rolamento, Torque e Momento Angular",
        sections: [
          {
            id: "11-2",
            title: "O Rolamento como uma Combinação de Translação e Rotação",
          },
          {
            id: "11-3",
            title: "A Energia Cinética de Rolamento",
          },
          {
            id: "11-4",
            title: "As Forças do Rolamento",
          },
          {
            id: "11-5",
            title: "O Ioiô",
          },
          {
            id: "11-6",
            title: "Revisão do Torque",
          },
          {
            id: "11-7",
            title: "Momento Angular",
          },
          {
            id: "11-8",
            title: "Segunda Lei de Newton para Rotações",
          },
          {
            id: "11-9",
            title: "O Momento Angular de um Sistema de Partículas",
          },
          {
            id: "11-10",
            title:
              "O Momento Angular de um Corpo Rígido Girando em Torno de um Eixo Fixo",
          },
          {
            id: "11-11",
            title: "Conservação do Momento Angular",
          },
          {
            id: "11-12",
            title: "Precessão de um Giroscópio",
          },
        ],
      },
    ],
  },
  {
    id: "II",
    title: "Gravitação, Fluidos, Oscilações e Termodinâmica",
    chapters: [
      {
        n: 12,
        title: "Equilíbrio e Elasticidade",
        sections: [
          {
            id: "12-2",
            title: "Equilíbrio",
          },
          {
            id: "12-3",
            title: "As Condições de Equilíbrio",
          },
          {
            id: "12-4",
            title: "O Centro de Gravidade",
          },
          {
            id: "12-5",
            title: "Alguns Exemplos de Equilíbrio Estático",
          },
          {
            id: "12-6",
            title: "Estruturas Indeterminadas",
          },
          {
            id: "12-7",
            title: "Elasticidade",
          },
        ],
      },
      {
        n: 13,
        title: "Gravitação",
        sections: [
          {
            id: "13-2",
            title: "A Lei da Gravitação de Newton",
          },
          {
            id: "13-3",
            title: "Gravitação e o Princípio da Superposição",
          },
          {
            id: "13-4",
            title: "A Gravitação Perto da Superfície da Terra",
          },
          {
            id: "13-5",
            title: "A Gravitação no Interior da Terra",
          },
          {
            id: "13-6",
            title: "Energia Potencial Gravitacional",
          },
          {
            id: "13-7",
            title: "Planetas e Satélites: As Leis de Kepler",
          },
          {
            id: "13-8",
            title: "Satélites: Órbitas e Energias",
          },
          {
            id: "13-9",
            title: "Einstein e a Gravitação",
          },
        ],
      },
      {
        n: 14,
        title: "Fluidos",
        sections: [
          {
            id: "14-2",
            title: "O que É um Fluido?",
          },
          {
            id: "14-3",
            title: "Massa Específica e Pressão",
          },
          {
            id: "14-4",
            title: "Fluidos em Repouso",
          },
          {
            id: "14-5",
            title: "Medindo a Pressão",
          },
          {
            id: "14-6",
            title: "O Princípio de Pascal",
          },
          {
            id: "14-7",
            title: "O Princípio de Arquimedes",
          },
          {
            id: "14-8",
            title: "Fluidos Ideais em Movimento",
          },
          {
            id: "14-9",
            title: "A Equação da Continuidade",
          },
          {
            id: "14-10",
            title: "A Equação de Bernoulli",
          },
        ],
      },
      {
        n: 15,
        title: "Oscilações",
        sections: [
          {
            id: "15-2",
            title: "Movimento Harmônico Simples",
          },
          {
            id: "15-3",
            title: "A Lei do Movimento Harmônico Simples",
          },
          {
            id: "15-4",
            title: "A Energia do Movimento Harmônico Simples",
          },
          {
            id: "15-5",
            title: "Um Oscilador Harmônico Angular Simples",
          },
          {
            id: "15-6",
            title: "Pêndulos",
          },
          {
            id: "15-7",
            title: "Movimento Harmônico Simples e Movimento Circular Uniforme",
          },
          {
            id: "15-8",
            title: "Oscilações Harmônicas Simples Amortecidas",
          },
          {
            id: "15-9",
            title: "Oscilações Forçadas e Ressonância",
          },
        ],
      },
      {
        n: 16,
        title: "Ondas — I",
        sections: [
          {
            id: "16-2",
            title: "Tipos de Ondas",
          },
          {
            id: "16-3",
            title: "Ondas Transversais e Longitudinais",
          },
          {
            id: "16-4",
            title: "Comprimento de Onda e Frequência",
          },
          {
            id: "16-5",
            title: "A Velocidade de uma Onda Progressiva",
          },
          {
            id: "16-6",
            title: "Velocidade da Onda em uma Corda Esticada",
          },
          {
            id: "16-7",
            title: "Energia e Potência de uma Onda Progressiva em uma Corda",
          },
          {
            id: "16-8",
            title: "A Equação de Onda",
          },
          {
            id: "16-9",
            title: "O Princípio da Superposição de Ondas",
          },
          {
            id: "16-10",
            title: "Interferência de Ondas",
          },
          {
            id: "16-11",
            title: "Fasores",
          },
          {
            id: "16-12",
            title: "Ondas Estacionárias",
          },
          {
            id: "16-13",
            title: "Ondas Estacionárias e Ressonância",
          },
        ],
      },
      {
        n: 17,
        title: "Ondas — II",
        sections: [
          {
            id: "17-2",
            title: "Ondas Sonoras",
          },
          {
            id: "17-3",
            title: "A Velocidade do Som",
          },
          {
            id: "17-4",
            title: "Ondas Sonoras Progressivas",
          },
          {
            id: "17-5",
            title: "Interferência",
          },
          {
            id: "17-6",
            title: "Intensidade e Nível Sonoro",
          },
          {
            id: "17-7",
            title: "Fontes de Sons Musicais",
          },
          {
            id: "17-8",
            title: "Batimentos",
          },
          {
            id: "17-9",
            title: "O Efeito Doppler",
          },
          {
            id: "17-10",
            title: "Velocidades Supersônicas, Ondas de Choque",
          },
        ],
      },
      {
        n: 18,
        title: "Temperatura, Calor e a Primeira Lei da Termodinâmica",
        sections: [
          {
            id: "18-2",
            title: "Temperatura",
          },
          {
            id: "18-3",
            title: "A Lei Zero da Termodinâmica",
          },
          {
            id: "18-4",
            title: "Medindo a Temperatura",
          },
          {
            id: "18-5",
            title: "As Escalas Celsius e Fahrenheit",
          },
          {
            id: "18-6",
            title: "Dilatação Térmica",
          },
          {
            id: "18-7",
            title: "Temperatura e Calor",
          },
          {
            id: "18-8",
            title: "A Absorção de Calor por Sólidos e Líquidos",
          },
          {
            id: "18-9",
            title: "Calor e Trabalho",
          },
          {
            id: "18-10",
            title: "A Primeira Lei da Termodinâmica",
          },
          {
            id: "18-11",
            title: "Alguns Casos Especiais da Primeira Lei da Termodinâmica",
          },
          {
            id: "18-12",
            title: "Mecanismos de Transferência de Calor",
          },
        ],
      },
      {
        n: 19,
        title: "A Teoria Cinética dos Gases",
        sections: [
          {
            id: "19-2",
            title: "O Número de Avogadro",
          },
          {
            id: "19-3",
            title: "Gases Ideais",
          },
          {
            id: "19-4",
            title: "Pressão, Temperatura e Velocidade Média Quadrática",
          },
          {
            id: "19-5",
            title: "Energia Cinética de Translação",
          },
          {
            id: "19-6",
            title: "Livre Caminho Médio",
          },
          {
            id: "19-7",
            title: "A Distribuição de Velocidades das Moléculas",
          },
          {
            id: "19-8",
            title: "Os Calores Específicos Molares de um Gás Ideal",
          },
          {
            id: "19-9",
            title: "Graus de Liberdade e Calores Específicos Molares",
          },
          {
            id: "19-10",
            title: "Efeitos Quânticos",
          },
          {
            id: "19-11",
            title: "A Expansão Adiabática de um Gás Ideal",
          },
        ],
      },
      {
        n: 20,
        title: "Entropia e a Segunda Lei da Termodinâmica",
        sections: [
          {
            id: "20-2",
            title: "Processos Irreversíveis e Entropia",
          },
          {
            id: "20-3",
            title: "Variação de Entropia",
          },
          {
            id: "20-4",
            title: "A Segunda Lei da Termodinâmica",
          },
          {
            id: "20-5",
            title: "Entropia no Mundo Real: Máquinas Térmicas",
          },
          {
            id: "20-6",
            title: "Entropia no Mundo Real: Refrigeradores",
          },
          {
            id: "20-7",
            title: "A Eficiência de Máquinas Térmicas Reais",
          },
          {
            id: "20-8",
            title: "Uma Visão Estatística da Entropia",
          },
        ],
      },
    ],
  },
  {
    id: "III",
    title: "Eletromagnetismo",
    chapters: [
      {
        n: 21,
        title: "A Lei de Coulomb",
        sections: [
          {
            id: "21-1",
            title: "A Lei de Coulomb",
            topics: [
              "Cargas Elétricas",
              "Condutores e Isolantes",
              "A Lei de Coulomb",
            ],
          },
          {
            id: "21-2",
            title: "A Carga É Quantizada",
          },
          {
            id: "21-3",
            title: "A Carga É Conservada",
          },
        ],
      },
      {
        n: 22,
        title: "Campos Elétricos",
        sections: [
          {
            id: "22-1",
            title: "O Campo Elétrico",
            topics: ["O Campo Elétrico", "Linhas de Campo Elétrico"],
          },
          {
            id: "22-2",
            title: "O Campo Elétrico Produzido por uma Partícula Carregada",
          },
          {
            id: "22-3",
            title: "O Campo Elétrico Produzido por um Dipolo Elétrico",
          },
          {
            id: "22-4",
            title: "O Campo Elétrico Produzido por uma Linha de Carga",
          },
          {
            id: "22-5",
            title: "O Campo Elétrico Produzido por um Disco Carregado",
          },
          {
            id: "22-6",
            title: "Uma Carga Pontual em um Campo Elétrico",
          },
          {
            id: "22-7",
            title: "Um Dipolo em um Campo Elétrico",
          },
        ],
      },
      {
        n: 23,
        title: "Lei de Gauss",
        sections: [
          {
            id: "23-1",
            title: "Fluxo Elétrico",
          },
          {
            id: "23-2",
            title: "Lei de Gauss",
            topics: ["Lei de Gauss e Lei de Coulomb"],
          },
          {
            id: "23-3",
            title: "Um Condutor Carregado",
          },
          {
            id: "23-4",
            title: "Aplicações da Lei de Gauss: Simetria Cilíndrica",
          },
          {
            id: "23-5",
            title: "Aplicações da Lei de Gauss: Simetria Planar",
          },
          {
            id: "23-6",
            title: "Aplicações da Lei de Gauss: Simetria Esférica",
          },
        ],
      },
      {
        n: 24,
        title: "Potencial Elétrico",
        sections: [
          {
            id: "24-1",
            title: "Potencial Elétrico",
            topics: ["Potencial Elétrico e Energia Potencial Elétrica"],
          },
          {
            id: "24-2",
            title: "Superfícies Equipotenciais e o Campo Elétrico",
            topics: [
              "Superfícies Equipotenciais",
              "Cálculo do Potencial a Partir do Campo Elétrico",
            ],
          },
          {
            id: "24-3",
            title: "Potencial Produzido por uma Partícula Carregada",
            topics: [
              "Potencial Produzido por um Grupo de Partículas Carregadas",
            ],
          },
          {
            id: "24-4",
            title: "Potencial Produzido por um Dipolo Elétrico",
          },
          {
            id: "24-5",
            title: "Potencial Produzido por uma Distribuição Contínua de Carga",
          },
          {
            id: "24-6",
            title: "Cálculo do Campo Elétrico a Partir do Potencial",
          },
          {
            id: "24-7",
            title:
              "Energia Potencial Elétrica de um Sistema de Partículas Carregadas",
          },
          {
            id: "24-8",
            title: "Potencial de um Condutor Carregado",
          },
        ],
      },
      {
        n: 25,
        title: "Capacitância",
        sections: [
          {
            id: "25-1",
            title: "Capacitância",
          },
          {
            id: "25-2",
            title: "Cálculo da Capacitância",
          },
          {
            id: "25-3",
            title: "Capacitores em Paralelo e em Série",
          },
          {
            id: "25-4",
            title: "Energia Armazenada em um Campo Elétrico",
          },
          {
            id: "25-5",
            title: "Capacitor com um Dielétrico",
            topics: ["Dielétricos: Uma Visão Atômica"],
          },
          {
            id: "25-6",
            title: "Dielétricos e a Lei de Gauss",
          },
        ],
      },
      {
        n: 26,
        title: "Corrente e Resistência",
        sections: [
          {
            id: "26-1",
            title: "Corrente Elétrica",
          },
          {
            id: "26-2",
            title: "Densidade de Corrente",
          },
          {
            id: "26-3",
            title: "Resistência e Resistividade",
          },
          {
            id: "26-4",
            title: "A Lei de Ohm",
            topics: ["Uma Visão Microscópica da Lei de Ohm"],
          },
          {
            id: "26-5",
            title: "Potência, Semicondutores e Supercondutores",
            topics: [
              "A Potência em Circuitos Elétricos",
              "Semicondutores",
              "Supercondutores",
            ],
          },
        ],
      },
      {
        n: 27,
        title: "Circuitos",
        sections: [
          {
            id: "27-1",
            title: "Circuitos de uma Malha",
            topics: [
              "“Bombeamento” de Cargas",
              "Trabalho, Energia e Força Eletromotriz",
              "Cálculo da Corrente em um Circuito de uma Malha",
              "Outros Circuitos de uma Malha",
              "Diferença de Potencial Entre Dois Pontos",
            ],
          },
          {
            id: "27-2",
            title: "Circuitos com Mais de uma Malha",
          },
          {
            id: "27-3",
            title: "O Amperímetro e o Voltímetro",
          },
          {
            id: "27-4",
            title: "Circuitos RC",
          },
        ],
      },
      {
        n: 28,
        title: "Campos Magnéticos",
        sections: [
          {
            id: "28-1",
            title: "Campos Magnéticos e a Definição de B",
            topics: ["O que Produz um Campo Magnético?", "A Definição de B"],
          },
          {
            id: "28-2",
            title: "Campos Cruzados: A Descoberta do Elétron",
          },
          {
            id: "28-3",
            title: "Campos Cruzados: O Efeito Hall",
          },
          {
            id: "28-4",
            title: "Uma Partícula Carregada em Movimento Circular",
          },
          {
            id: "28-5",
            title: "Cíclotrons e Síncrotrons",
          },
          {
            id: "28-6",
            title: "Força Magnética em um Fio Percorrido por Corrente",
          },
          {
            id: "28-7",
            title: "Torque em uma Espira Percorrida por Corrente",
          },
          {
            id: "28-8",
            title: "O Momento Dipolar Magnético",
          },
        ],
      },
      {
        n: 29,
        title: "Campos Magnéticos Produzidos por Correntes",
        sections: [
          {
            id: "29-1",
            title: "O Campo Magnético Produzido por uma Corrente",
            topics: ["Cálculo do Campo Magnético Produzido por uma Corrente"],
          },
          {
            id: "29-2",
            title: "Forças Entre Duas Correntes Paralelas",
          },
          {
            id: "29-3",
            title: "Lei de Ampère",
          },
          {
            id: "29-4",
            title: "Solenoides e Toroides",
          },
          {
            id: "29-5",
            title: "Relação Entre uma Bobina Plana e um Dipolo Magnético",
          },
        ],
      },
      {
        n: 30,
        title: "Indução e Indutância",
        sections: [
          {
            id: "30-1",
            title: "Lei de Faraday e Lei de Lenz",
            topics: [
              "Dois Experimentos",
              "A Lei de Indução de Faraday",
              "A Lei de Lenz",
            ],
          },
          {
            id: "30-2",
            title: "Indução e Transferências de Energia",
          },
          {
            id: "30-3",
            title: "Campos Elétricos Induzidos",
          },
          {
            id: "30-4",
            title: "Indutores e Indutância",
          },
          {
            id: "30-5",
            title: "Autoindução",
          },
          {
            id: "30-6",
            title: "Circuitos RL",
          },
          {
            id: "30-7",
            title: "Energia Armazenada em um Campo Magnético",
          },
          {
            id: "30-8",
            title: "Densidade de Energia de um Campo Magnético",
          },
          {
            id: "30-9",
            title: "Indução Mútua",
          },
        ],
      },
      {
        n: 31,
        title: "Oscilações Eletromagnéticas e Corrente Alternada",
        sections: [
          {
            id: "31-1",
            title: "Oscilações em um Circuito LC",
            topics: [
              "Oscilações em um Circuito LC: Análise Qualitativa",
              "Analogia Eletromecânica",
              "Oscilações em um Circuito LC: Análise Quantitativa",
            ],
          },
          {
            id: "31-2",
            title: "Oscilações Amortecidas em um Circuito RLC",
          },
          {
            id: "31-3",
            title: "Oscilações Forçadas em Três Circuitos Simples",
            topics: ["Corrente Alternada", "Oscilações Forçadas"],
          },
          {
            id: "31-4",
            title: "O Circuito RLC Série",
          },
          {
            id: "31-5",
            title: "Potência em Circuitos de Corrente Alternada",
          },
          {
            id: "31-6",
            title: "Transformadores",
          },
        ],
      },
      {
        n: 32,
        title: "Equações de Maxwell; Magnetismo da Matéria",
        sections: [
          {
            id: "32-1",
            title: "Lei de Gauss para Campos Magnéticos",
          },
          {
            id: "32-2",
            title: "Campos Magnéticos Induzidos",
          },
          {
            id: "32-3",
            title: "Corrente de Deslocamento",
            topics: ["Equações de Maxwell"],
          },
          {
            id: "32-4",
            title: "Ímãs Permanentes",
          },
          {
            id: "32-5",
            title: "O Magnetismo e os Elétrons",
            topics: ["Propriedades Magnéticas dos Materiais"],
          },
          {
            id: "32-6",
            title: "Diamagnetismo",
          },
          {
            id: "32-7",
            title: "Paramagnetismo",
          },
          {
            id: "32-8",
            title: "Ferromagnetismo",
          },
        ],
      },
    ],
  },
  {
    id: "IV",
    title: "Óptica e Física Moderna",
    chapters: [
      {
        n: 33,
        title: "Ondas Eletromagnéticas",
        sections: [
          {
            id: "33-2",
            title: "O Arco-íris de Maxwell",
          },
          {
            id: "33-3",
            title: "Descrição Qualitativa de uma Onda Eletromagnética",
          },
          {
            id: "33-4",
            title: "Descrição Matemática de uma Onda Eletromagnética",
          },
          {
            id: "33-5",
            title: "Transporte de Energia e o Vetor de Poynting",
          },
          {
            id: "33-6",
            title: "Pressão da Radiação",
          },
          {
            id: "33-7",
            title: "Polarização",
          },
          {
            id: "33-8",
            title: "Reflexão e Refração",
          },
          {
            id: "33-9",
            title: "Reflexão Interna Total",
          },
          {
            id: "33-10",
            title: "Polarização por Reflexão",
          },
        ],
      },
      {
        n: 34,
        title: "Imagens",
        sections: [
          {
            id: "34-2",
            title: "Dois Tipos de Imagens",
          },
          {
            id: "34-3",
            title: "Espelhos Planos",
          },
          {
            id: "34-4",
            title: "Espelhos Esféricos",
          },
          {
            id: "34-5",
            title: "Imagens Produzidas por Espelhos Esféricos",
          },
          {
            id: "34-6",
            title: "Refração em Interfaces Esféricas",
          },
          {
            id: "34-7",
            title: "Lentes Delgadas",
          },
          {
            id: "34-8",
            title: "Instrumentos Ópticos",
          },
          {
            id: "34-9",
            title: "Três Demonstrações",
          },
        ],
      },
      {
        n: 35,
        title: "Interferência",
        sections: [
          {
            id: "35-2",
            title: "A Luz como uma Onda",
          },
          {
            id: "35-3",
            title: "Difração",
          },
          {
            id: "35-4",
            title: "O Experimento de Young",
          },
          {
            id: "35-5",
            title: "Coerência",
          },
          {
            id: "35-6",
            title: "Intensidade das Franjas de Interferência",
          },
          {
            id: "35-7",
            title: "Interferência em Filmes Finos",
          },
          {
            id: "35-8",
            title: "O Interferômetro de Michelson",
          },
        ],
      },
      {
        n: 36,
        title: "Difração",
        sections: [
          {
            id: "36-2",
            title: "Difração e a Teoria Ondulatória da Luz",
          },
          {
            id: "36-3",
            title: "Difração por uma Fenda: Posições dos Mínimos",
          },
          {
            id: "36-4",
            title:
              "Determinação da Intensidade da Luz Difratada por uma Fenda — Método Qualitativo",
          },
          {
            id: "36-5",
            title:
              "Determinação da Intensidade da Luz Difratada por uma Fenda — Método Quantitativo",
          },
          {
            id: "36-6",
            title: "Difração por uma Abertura Circular",
          },
          {
            id: "36-7",
            title: "Difração por Duas Fendas",
          },
          {
            id: "36-8",
            title: "Redes de Difração",
          },
          {
            id: "36-9",
            title: "Redes de Difração: Dispersão e Resolução",
          },
          {
            id: "36-10",
            title: "Difração de Raios X",
          },
        ],
      },
      {
        n: 37,
        title: "Relatividade",
        sections: [
          {
            id: "37-2",
            title: "Os Postulados da Relatividade",
          },
          {
            id: "37-3",
            title: "Registrando um Evento",
          },
          {
            id: "37-4",
            title: "A Relatividade da Simultaneidade",
          },
          {
            id: "37-5",
            title: "A Relatividade do Tempo",
          },
          {
            id: "37-6",
            title: "A Relatividade das Distâncias",
          },
          {
            id: "37-7",
            title: "A Transformação de Lorentz",
          },
          {
            id: "37-8",
            title: "Algumas Consequências das Equações de Lorentz",
          },
          {
            id: "37-9",
            title: "A Relatividade das Velocidades",
          },
          {
            id: "37-10",
            title: "O Efeito Doppler para a Luz",
          },
          {
            id: "37-11",
            title: "Uma Nova Interpretação do Momento",
          },
          {
            id: "37-12",
            title: "Uma Nova Interpretação da Energia",
          },
        ],
      },
      {
        n: 38,
        title: "Fótons e Ondas de Matéria",
        sections: [
          {
            id: "38-2",
            title: "O Fóton, o Quantum da Luz",
          },
          {
            id: "38-3",
            title: "O Efeito Fotoelétrico",
          },
          {
            id: "38-4",
            title: "Os Fótons Possuem Momento",
          },
          {
            id: "38-5",
            title: "A Luz como uma Onda de Probabilidade",
          },
          {
            id: "38-6",
            title: "Elétrons e Ondas de Matéria",
          },
          {
            id: "38-7",
            title: "A Equação de Schrödinger",
          },
          {
            id: "38-8",
            title: "O Princípio de Indeterminação de Heisenberg",
          },
          {
            id: "38-9",
            title: "O Efeito Túnel",
          },
        ],
      },
      {
        n: 39,
        title: "Mais Ondas de Matéria",
        sections: [
          {
            id: "39-2",
            title: "Ondas em Cordas e Ondas de Matéria",
          },
          {
            id: "39-3",
            title: "Energia de um Elétron Confinado",
          },
          {
            id: "39-4",
            title: "Funções de Onda de um Elétron Aprisionado",
          },
          {
            id: "39-5",
            title: "Um Elétron em um Poço Finito",
          },
          {
            id: "39-6",
            title: "Outras Armadilhas para Elétrons",
          },
          {
            id: "39-7",
            title: "Armadilhas Eletrônicas Bidimensionais e Tridimensionais",
          },
          {
            id: "39-8",
            title: "O Modelo de Bohr do Átomo de Hidrogênio",
          },
          {
            id: "39-9",
            title: "A Equação de Schrödinger e o Átomo de Hidrogênio",
          },
        ],
      },
      {
        n: 40,
        title: "Tudo sobre os Átomos",
        sections: [
          {
            id: "40-2",
            title: "Algumas Propriedades dos Átomos",
          },
          {
            id: "40-3",
            title: "O Spin do Elétron",
          },
          {
            id: "40-4",
            title: "Momento Angular e Momento Magnético",
          },
          {
            id: "40-5",
            title: "O Experimento de Stern-Gerlach",
          },
          {
            id: "40-6",
            title: "Ressonância Magnética",
          },
          {
            id: "40-7",
            title: "O Princípio de Exclusão de Pauli",
          },
          {
            id: "40-8",
            title: "Armadilhas Retangulares com Mais de um Elétron",
          },
          {
            id: "40-9",
            title: "Construção da Tabela Periódica",
          },
          {
            id: "40-10",
            title: "Os Espectros de Raios X dos Elementos",
          },
          {
            id: "40-11",
            title: "O Laser",
          },
          {
            id: "40-12",
            title: "Como Funcionam os Lasers",
          },
        ],
      },
      {
        n: 41,
        title: "Condução de Eletricidade nos Sólidos",
        sections: [
          {
            id: "41-2",
            title: "Propriedades Elétricas dos Sólidos",
          },
          {
            id: "41-3",
            title: "Níveis de Energia em um Sólido Cristalino",
          },
          {
            id: "41-4",
            title: "Isolantes",
          },
          {
            id: "41-5",
            title: "Metais",
          },
          {
            id: "41-6",
            title: "Semicondutores",
          },
          {
            id: "41-7",
            title: "Semicondutores Dopados",
          },
          {
            id: "41-8",
            title: "A Junção p-n",
          },
          {
            id: "41-9",
            title: "O Diodo Retificador",
          },
          {
            id: "41-10",
            title: "O Diodo Emissor de Luz (LED)",
          },
          {
            id: "41-11",
            title: "O Transistor",
          },
        ],
      },
      {
        n: 42,
        title: "Física Nuclear",
        sections: [
          {
            id: "42-2",
            title: "A Descoberta do Núcleo",
          },
          {
            id: "42-3",
            title: "Propriedades dos Núcleos",
          },
          {
            id: "42-4",
            title: "Decaimento Radioativo",
          },
          {
            id: "42-5",
            title: "Decaimento Alfa",
          },
          {
            id: "42-6",
            title: "Decaimento Beta",
          },
          {
            id: "42-7",
            title: "Datação Radioativa",
          },
          {
            id: "42-8",
            title: "Medida da Dose de Radiação",
          },
          {
            id: "42-9",
            title: "Modelos Nucleares",
          },
        ],
      },
      {
        n: 43,
        title: "Energia Nuclear",
        sections: [
          {
            id: "43-2",
            title: "Fissão do Urânio: O Processo Básico",
          },
          {
            id: "43-3",
            title: "Um Modelo para a Fissão Nuclear",
          },
          {
            id: "43-4",
            title: "O Reator Nuclear",
          },
          {
            id: "43-5",
            title: "Um Reator Nuclear Natural",
          },
          {
            id: "43-6",
            title: "Fusão Termonuclear: O Processo Básico",
          },
          {
            id: "43-7",
            title: "A Fusão Termonuclear no Sol e em Outras Estrelas",
          },
          {
            id: "43-8",
            title: "A Fusão Nuclear Controlada",
          },
        ],
      },
      {
        n: 44,
        title: "Quarks, Léptons e o Big Bang",
        sections: [
          {
            id: "44-2",
            title: "Partículas, Partículas e Mais Partículas",
          },
          {
            id: "44-3",
            title: "Antipartículas",
          },
          {
            id: "44-4",
            title: "Os Léptons",
          },
          {
            id: "44-5",
            title: "Os Hádrons",
          },
          {
            id: "44-6",
            title: "Mais uma Lei de Conservação",
          },
          {
            id: "44-7",
            title: "O Caminho Óctuplo",
          },
          {
            id: "44-8",
            title: "O Modelo dos Quarks",
          },
          {
            id: "44-9",
            title: "As Interações Básicas e as Partículas Mensageiras",
          },
          {
            id: "44-10",
            title: "Uma Pausa para Refletir",
          },
          {
            id: "44-11",
            title: "O Universo em Expansão",
          },
          {
            id: "44-12",
            title: "A Radiação Cósmica de Fundo",
          },
          {
            id: "44-13",
            title: "A Matéria Escura",
          },
          {
            id: "44-14",
            title: "O Big Bang",
          },
          {
            id: "44-15",
            title: "Conclusão",
          },
        ],
      },
    ],
  },
];

export const chapters: BookChapter[] = parts.flatMap((p) => p.chapters);

export function findChapter(n: number): BookChapter | undefined {
  return chapters.find((c) => c.n === n);
}

export function partOf(n: number): BookPart | undefined {
  return parts.find((p) => p.chapters.some((c) => c.n === n));
}
