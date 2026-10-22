// Práticas de Física Experimental (Exp I–III). Cada uma usa uma simulação como aparato.
import { dmmAccuracy, type Practice } from "@fisilab/analysis";

const rad = (d: number) => (d * Math.PI) / 180;

const planned: Practice[] = [
  {
    id: "exp1-pendulo",
    course: "Exp I",
    title: "Pêndulo simples (período vs comprimento e amplitude)",
    sim: "pendulos",
    scenario: "pequeno",
    params: { tipo: 0, b: 0, g: 9.79, theta0: 8, fantasma: 0 },
    locked: ["tipo", "g", "b", "m", "fantasma"],
    objective: "Determinar a aceleração da gravidade local a partir da relação entre o período e o comprimento do pêndulo, e verificar o efeito da amplitude.",
    materials: ["pêndulo com fio inextensível", "trena", "cronômetro manual", "transferidor"],
    procedure: `### Procedimento
1. Ajuste o **comprimento** e mantenha a amplitude pequena (até 10°).
2. Clique em **Iniciar** e, com o pêndulo oscilando, clique em **Registrar medida**: a bancada cronometra 10 oscilações três vezes, como você faria com o cronômetro na mão.
3. Repita para pelo menos 6 comprimentos entre 0,3 m e 2,0 m.
4. O gráfico de $T^2$ contra $L$ deve ser uma reta pela origem com inclinação $4\\pi^2/g$.
5. Depois, fixe $L$ e meça para amplitudes de 10°, 30°, 60° e 90°. O período continua o mesmo?`,
    columns: [
      { key: "L", label: "L", unit: "m", source: { param: "L" }, instrument: "trena" },
      { key: "t10", label: "10 T", unit: "s", source: { observable: "T" }, instrument: "cronometroManual", times: 10, repeat: 3 },
      { key: "T2", label: "T²", unit: "s²", from: ["t10"], compute: (t) => (t / 10) ** 2 },
    ],
    minRows: 5,
    analysis: {
      x: "L",
      y: "T2",
      fit: "proporcional",
      results: [{ label: "g", unit: "m/s²", compute: (b) => (4 * Math.PI ** 2) / b, reference: 9.79 }],
    },
    questions: [
      "Por que cronometrar 10 oscilações em vez de uma? Compare a incerteza do período nos dois casos.",
      "O valor de g é compatível com 9,79 m/s² (Porto Alegre)? Se não, qual a fonte de erro mais provável?",
      "Quanto o período a 60° difere do período a 10°? Explique pela não linearidade de $\\sin\\theta$.",
    ],
  },
  {
    id: "exp1-plano-inclinado",
    course: "Exp I",
    title: "Plano inclinado e atrito",
    sim: "plano-inclinado",
    scenario: "desce",
    params: { mus: 0.45, muk: 0.3, F: 0, v0: 0, m: 2, componentes: 0 },
    locked: ["mus", "muk", "F", "v0", "m"],
    objective: "Determinar o coeficiente de atrito cinético entre o bloco e a rampa a partir do tempo de descida em várias inclinações.",
    materials: ["rampa de inclinação ajustável", "bloco", "goniômetro", "duas fotoportas com cronômetro digital"],
    procedure: `### Procedimento
1. Escolha uma inclinação acima do ângulo crítico (o bloco precisa deslizar sozinho).
2. Rode até o bloco chegar ao fim da rampa (3,2 m de percurso) e clique em **Registrar medida**.
3. Repita para pelo menos 6 ângulos entre 30° e 60°.
4. De $d = \\tfrac12 a t^2$ e $a = g(\\sin\\theta - \\mu_c\\cos\\theta)$:
$$\\frac{a}{\\cos\\theta} = g\\tan\\theta - \\mu_c g$$
O gráfico de $a/\\cos\\theta$ contra $\\tan\\theta$ é uma reta: inclinação $g$ e intercepto $-\\mu_c g$.`,
    columns: [
      { key: "th", label: "θ", unit: "°", source: { param: "angulo" }, instrument: "goniometro" },
      { key: "t", label: "t", unit: "s", source: { time: true }, instrument: "fotoporta" },
      { key: "tg", label: "tan θ", unit: "", from: ["th"], compute: (th) => Math.tan(rad(th)) },
      { key: "y", label: "a/cos θ", unit: "m/s²", from: ["t", "th"], compute: (t, th) => (2 * 3.2) / (t * t * Math.cos(rad(th))) },
    ],
    minRows: 5,
    analysis: {
      x: "tg",
      y: "y",
      fit: "linear",
      results: [
        { label: "g", unit: "m/s²", compute: (_a, b) => b, reference: 9.81 },
        { label: "μc", unit: "", compute: (a, b) => -a / b, reference: 0.3 },
      ],
    },
    demo: (i) => ({ params: { angulo: 32 + 5 * i }, t: 1e6 }),
    questions: [
      "Por que é preciso que o bloco deslize sozinho para esta análise valer?",
      "Como você mediria o coeficiente de atrito estático com o mesmo aparato?",
      "Qual medida domina a incerteza de μc: o ângulo ou o tempo? E se o tempo fosse medido com cronômetro na mão?",
    ],
  },
  {
    id: "exp1-lancamento-horizontal",
    course: "Exp I",
    title: "Lançamento horizontal",
    sim: "projetil-arrasto",
    scenario: "vacuo",
    params: { angulo: 0, h0: 1, rho: 0, g: 9.81, massa: 0.03, diametro: 0.02 },
    locked: ["angulo", "h0", "rho", "g", "massa", "diametro", "cd"],
    objective: "Verificar que o alcance de um lançamento horizontal é proporcional à velocidade de saída e obter g a partir da altura da mesa.",
    materials: ["rampa de lançamento", "esfera de aço", "fotoporta na saída da rampa", "trena", "papel carbono"],
    procedure: `### Procedimento
1. A mesa tem altura $h = 1{,}00$ m. Escolha a velocidade de saída da esfera.
2. Rode até a esfera tocar o chão e clique em **Registrar medida** (a fotoporta mede $v_0$ e a trena mede o alcance).
3. Repita para pelo menos 6 velocidades.
4. Como $x = v_0\\sqrt{2h/g}$, o gráfico de $x$ contra $v_0$ é uma reta pela origem com inclinação $\\sqrt{2h/g}$.`,
    columns: [
      {
        key: "v0",
        label: "v₀",
        unit: "m/s",
        source: { param: "v0" },
        instrument: { id: "fotoporta-v", name: "Fotoporta (velocidade)", unit: "m/s", kind: "digital", resolution: 0.01, range: [0, 100], accuracy: (r) => 0.01 * r },
      },
      { key: "x", label: "alcance x", unit: "m", source: { observable: "x" }, instrument: "trena" },
    ],
    minRows: 5,
    analysis: {
      x: "v0",
      y: "x",
      fit: "proporcional",
      results: [{ label: "g", unit: "m/s²", compute: (b) => (2 * 1) / (b * b), reference: 9.81 }],
    },
    demo: (i) => ({ params: { v0: 1 + 0.8 * i }, t: 1e6 }),
    questions: [
      "O tempo de queda depende da velocidade de saída? Justifique com os dados.",
      "Que erro sistemático surge se a fotoporta estiver alguns centímetros antes da borda da mesa?",
    ],
  },
  {
    id: "exp1-medidas",
    course: "Exp I",
    title: "Medidas e incertezas (paquímetro, micrômetro, densidade de sólidos)",
    sim: "instrumentos-medida",
    scenario: "paquimetro",
    params: { instrumento: 0, peca: 0, dimensao: 0, material: 1, zero: 0, gabarito: 0 },
    locked: ["instrumento", "peca", "material", "zero", "gabarito"],
    objective: "Medir dimensões e massas de cilindros de alumínio com paquímetro e balança, propagar as incertezas e determinar a densidade do material.",
    materials: ["cilindros de alumínio de tamanhos variados", "paquímetro (nônio de 0,05 mm)", "balança digital (0,01 g)"],
    procedure: `### Procedimento
1. Escolha uma amostra e meça o **diâmetro** e a **altura** com o paquímetro. Pratique a leitura do nônio antes de olhar o gabarito.
2. Pese a amostra e clique em **Registrar medida**.
3. Repita para pelo menos 6 amostras.
4. Para cada cilindro, $V = \\pi D^2 H/4$, com incerteza propagada:
$$\\frac{u_V}{V} = \\sqrt{\\left(\\frac{2u_D}{D}\\right)^2 + \\left(\\frac{u_H}{H}\\right)^2}$$
5. O gráfico de $m$ contra $V$ é uma reta pela origem de inclinação $\\rho$.`,
    columns: [
      { key: "D", label: "D", unit: "mm", source: { observable: "D" }, instrument: "paquimetro", toUnit: 1000 },
      { key: "H", label: "H", unit: "mm", source: { observable: "H" }, instrument: "paquimetro", toUnit: 1000 },
      { key: "m", label: "m", unit: "g", source: { observable: "m" }, instrument: "balanca", toUnit: 1000 },
      { key: "V", label: "V", unit: "cm³", from: ["D", "H"], compute: (D, H) => (Math.PI * D * D * H) / 4 / 1000 },
    ],
    minRows: 5,
    analysis: {
      x: "V",
      y: "m",
      fit: "proporcional",
      results: [{ label: "ρ", unit: "g/cm³", compute: (b) => b, reference: 2.7 }],
    },
    demo: (i) => ({ params: { amostra: 1 + 3 * i } }),
    questions: [
      "Qual medida domina a incerteza do volume: o diâmetro ou a altura? Por quê o diâmetro pesa em dobro?",
      "A densidade obtida é compatível com a do alumínio (2,70 g/cm³)?",
      "Quando valeria a pena trocar o paquímetro pelo micrômetro?",
    ],
  },
  {
    id: "exp1-queda-livre",
    course: "Exp I",
    title: "Queda livre e medida de g",
    sim: "queda-livre",
    scenario: "medir-g",
    params: { nPortas: 2, d1: 0.2, H: 2, esfera: 0, arrasto: 0, g: 9.79 },
    locked: ["nPortas", "d1", "H", "esfera", "arrasto", "g"],
    objective: "Determinar a aceleração da gravidade com uma esfera em queda livre e fotoportas.",
    materials: ["esfera de aço de 25 mm", "eletroímã de liberação", "fotoportas com cronômetro digital (0,1 ms)", "trena"],
    procedure: `### Procedimento
1. Posicione a segunda fotoporta a uma distância $d$ do ponto de liberação e meça-a com a trena.
2. Libere a esfera e clique em **Registrar medida**: o cronômetro registra o tempo $t$ de queda até a fotoporta.
3. Repita para pelo menos 6 distâncias entre 0,4 m e 1,8 m.
4. Partindo do repouso, $d = \\tfrac12 g t^2$: o gráfico de $d$ contra $t^2$ é uma reta pela origem de inclinação $g/2$.`,
    columns: [
      { key: "d", label: "d", unit: "m", source: { param: "d2" }, instrument: "trena" },
      { key: "t", label: "t", unit: "s", source: { observable: "t2" }, instrument: "fotoporta" },
      { key: "t2", label: "t²", unit: "s²", from: ["t"], compute: (t) => t * t },
    ],
    minRows: 5,
    analysis: {
      x: "t2",
      y: "d",
      fit: "proporcional",
      results: [{ label: "g", unit: "m/s²", compute: (b) => 2 * b, reference: 9.79 }],
    },
    demo: (i) => ({ params: { d2: 0.4 + 0.25 * i }, t: 1 }),
    questions: [
      "O valor de g é compatível com 9,79 m/s²? Qual a incerteza relativa?",
      "Se a esfera fosse de isopor, como ficaria o gráfico? Que termo falta no modelo?",
      "Por que medir várias distâncias e ajustar uma reta é melhor que calcular g com um ponto só?",
    ],
  },
  {
    id: "exp1-trilho-mruv",
    course: "Exp I",
    title: "Trilho de ar: MRU e MRUV",
    sim: "trilho-de-ar",
    scenario: "inclinado",
    params: { modo: 0, M1: 0.2, mp: 0, v0: 0, b: 0, xg1: 0.4, xg2: 1.2, Lb: 0.05 },
    locked: ["modo", "M1", "mp", "v0", "b", "xg1", "xg2", "Lb"],
    objective: "Verificar o movimento uniforme com o trilho nivelado e o uniformemente variado com o trilho inclinado, obtendo g a partir da aceleração.",
    materials: ["trilho de ar com carrinho e bandeira de 5,0 cm", "duas fotoportas (x = 0,40 m e 1,20 m)", "calços e paquímetro para a inclinação"],
    procedure: `### Procedimento
1. Com o trilho **nivelado** e um empurrão inicial, confira que os tempos de bloqueio nas duas fotoportas são iguais (MRU).
2. Incline o trilho por um ângulo $\\theta$ e solte o carrinho do repouso.
3. Clique em **Registrar medida**: as fotoportas registram o tempo de bloqueio da bandeira em cada uma.
4. A velocidade em cada porta é $v = L_b/t_b$ e a aceleração, pela equação de Torricelli, $a = (v_2^2 - v_1^2)/(2\\Delta x)$ com $\\Delta x = 0{,}80$ m.
5. Repita para pelo menos 6 inclinações entre 1° e 9°. O gráfico de $a$ contra $\\sin\\theta$ é uma reta pela origem de inclinação $g$.`,
    columns: [
      { key: "th", label: "θ", unit: "°", source: { param: "theta" }, instrument: { id: "inclinometro", name: "Inclinação (calço e paquímetro)", unit: "°", kind: "digital", resolution: 0.01, range: [0, 90], accuracy: () => 0.02 } },
      { key: "tb1", label: "t_b1", unit: "s", source: { observable: "tb1" }, instrument: "fotoporta" },
      { key: "tb2", label: "t_b2", unit: "s", source: { observable: "tb2" }, instrument: "fotoporta" },
      { key: "s", label: "sen θ", unit: "", from: ["th"], compute: (th) => Math.sin(rad(th)) },
      { key: "a", label: "a", unit: "m/s²", from: ["tb1", "tb2"], compute: (t1, t2) => ((0.05 / t2) ** 2 - (0.05 / t1) ** 2) / (2 * 0.8) },
    ],
    minRows: 5,
    analysis: {
      x: "s",
      y: "a",
      fit: "proporcional",
      results: [{ label: "g", unit: "m/s²", compute: (b) => b, reference: 9.79 }],
    },
    demo: (i) => ({ params: { theta: 1 + 1.5 * i } }),
    questions: [
      "No trilho nivelado, os tempos nas duas fotoportas foram iguais? O que isso diz sobre o atrito?",
      "Por que $L_b/t_b$ é a velocidade no meio da passagem da bandeira, e não na entrada?",
      "Como um pequeno desnível residual do trilho apareceria no gráfico?",
    ],
  },
  {
    id: "exp1-segunda-lei",
    course: "Exp I",
    title: "2ª Lei de Newton",
    sim: "trilho-de-ar",
    scenario: "segunda-lei",
    params: { modo: 0, M1: 0.2, theta: 0, v0: 0, b: 0, xg1: 0.5, xg2: 1, Lb: 0.05 },
    locked: ["modo", "M1", "theta", "v0", "b", "xg1", "xg2", "Lb"],
    objective: "Verificar que a força resultante no carrinho é proporcional à sua aceleração e obter a massa do carrinho.",
    materials: ["trilho de ar nivelado", "carrinho com bandeira de 5,0 cm", "polia, fio e porta-pesos", "balança", "duas fotoportas (Δx = 0,50 m)"],
    procedure: `### Procedimento
1. Pendure uma massa $m_p$ no fio (pese-a antes) e solte o carrinho do repouso.
2. Clique em **Registrar medida**: as fotoportas registram os tempos de bloqueio $t_{b1}$ e $t_{b2}$.
3. Repita para pelo menos 6 massas entre 5 g e 50 g.
4. A aceleração é $a = (v_2^2 - v_1^2)/(2\\Delta x)$ com $v = L_b/t_b$. A tensão no fio, que é a força resultante no carrinho, é $T = m_p(g - a)$.
5. O gráfico de $T$ contra $a$ é uma reta pela origem de inclinação $M$, a massa do carrinho.`,
    columns: [
      { key: "mp", label: "m_p", unit: "g", source: { param: "mp" }, instrument: "balanca", toUnit: 1000 },
      { key: "tb1", label: "t_b1", unit: "s", source: { observable: "tb1" }, instrument: "fotoporta" },
      { key: "tb2", label: "t_b2", unit: "s", source: { observable: "tb2" }, instrument: "fotoporta" },
      { key: "a", label: "a", unit: "m/s²", from: ["tb1", "tb2"], compute: (t1, t2) => ((0.05 / t2) ** 2 - (0.05 / t1) ** 2) / (2 * 0.5) },
      { key: "T", label: "T", unit: "N", from: ["mp", "a"], compute: (mp, a) => (mp / 1000) * (9.79 - a) },
    ],
    minRows: 5,
    analysis: {
      x: "a",
      y: "T",
      fit: "proporcional",
      results: [{ label: "M", unit: "kg", compute: (b) => b, reference: 0.2 }],
    },
    demo: (i) => ({ params: { mp: 0.005 + 0.008 * i } }),
    questions: [
      "A massa do carrinho obtida confere com a pesagem (200 g)?",
      "Por que a força no carrinho não é simplesmente o peso $m_p g$? Quando essa aproximação é boa?",
      "Como você mostraria que $a$ é inversamente proporcional à massa, com a força fixa?",
    ],
  },
  {
    id: "exp1-hooke",
    course: "Exp I",
    title: "Lei de Hooke e associação de molas",
    sim: "lei-hooke",
    scenario: "uma-mola",
    params: { arranjo: 0, k1: 20, k2: 30, ms: 0, g: 9.79 },
    locked: ["k1", "k2", "ms", "g"],
    objective: "Determinar a constante elástica de uma mola pelo método estático e verificar as regras de associação em série e em paralelo.",
    materials: ["molas helicoidais", "suporte com régua milimetrada", "massas aferidas", "balança"],
    procedure: `### Procedimento
1. Pendure uma massa, espere a oscilação parar e leia a deformação $\\Delta y$ na régua.
2. Clique em **Registrar medida**.
3. Repita para pelo menos 6 massas entre 20 g e 450 g.
4. O gráfico do peso $P = mg$ contra $\\Delta y$ é uma reta pela origem de inclinação $k$.
5. Troque o **arranjo** para série e paralelo, limpe a tabela e repita. Compare com $1/k_s = 1/k_1 + 1/k_2$ e $k_p = k_1 + k_2$.`,
    columns: [
      { key: "m", label: "m", unit: "g", source: { param: "m" }, instrument: "balanca", toUnit: 1000 },
      { key: "dy", label: "Δy", unit: "mm", source: { observable: "yeq" }, instrument: "regua", toUnit: 1000 },
      { key: "P", label: "P", unit: "N", from: ["m"], compute: (m) => (m / 1000) * 9.79 },
    ],
    minRows: 5,
    analysis: {
      x: "dy",
      y: "P",
      fit: "proporcional",
      results: [{ label: "k (uma mola)", unit: "N/m", compute: (b) => b * 1000, reference: 20 }],
    },
    demo: (i) => ({ params: { m: 0.05 + 0.07 * i } }),
    questions: [
      "O gráfico passa pela origem? O que um intercepto indicaria?",
      "Os valores de $k$ em série e em paralelo seguem as regras de associação?",
      "Compare $k$ estático com o obtido pelo período $T = 2\\pi\\sqrt{m/k}$. Qual método é mais preciso aqui?",
    ],
  },
  {
    id: "exp1-maxwell",
    course: "Exp I",
    title: "Momento de inércia (disco/roda de Maxwell)",
    sim: "roda-maxwell",
    scenario: "medir-I",
    params: { m: 0.5, R: 0.065, r: 0.004, forma: 0, g: 9.79 },
    locked: ["m", "R", "r", "forma", "g"],
    objective: "Determinar o momento de inércia de uma roda de Maxwell a partir da aceleração de descida e comparar com o valor calculado pela geometria.",
    materials: ["roda de Maxwell (disco de 500 g e 65 mm de raio, eixo de 4,0 mm de raio)", "trena", "cronômetro manual"],
    procedure: `### Procedimento
1. Enrole o fio até a altura $h$ desejada e meça-a com a trena.
2. Solte a roda e cronometre a descida até o ponto mais baixo. Clique em **Registrar medida** (a bancada cronometra três descidas).
3. Repita para pelo menos 6 alturas entre 0,2 m e 1,0 m.
4. A descida é uniformemente acelerada: $h = \\tfrac12 a t^2$, com
$$a = \\frac{g}{1 + I/(m r^2)} \\quad\\Rightarrow\\quad I = m r^2\\left(\\frac{g}{a} - 1\\right)$$
5. Compare com $I = \\tfrac12 m R^2$ do disco.`,
    columns: [
      { key: "h", label: "h", unit: "m", source: { param: "h" }, instrument: "trena" },
      { key: "t", label: "t", unit: "s", source: { observable: "tq" }, instrument: "cronometroManual", repeat: 3 },
      { key: "t2", label: "t²", unit: "s²", from: ["t"], compute: (t) => t * t },
    ],
    minRows: 5,
    analysis: {
      x: "t2",
      y: "h",
      fit: "proporcional",
      results: [
        { label: "a", unit: "m/s²", compute: (b) => 2 * b, reference: 9.79 / (1 + 0.5 * 0.065 ** 2 / 0.004 ** 2) },
        { label: "I", unit: "10⁻³ kg·m²", compute: (b) => 0.5 * 0.004 ** 2 * (9.79 / (2 * b) - 1) * 1000, reference: 0.25 * 0.065 ** 2 * 1000 },
      ],
    },
    demo: (i) => ({ params: { h: 0.25 + 0.15 * i } }),
    questions: [
      "O momento de inércia medido é compatível com $\\tfrac12 mR^2$? O que o eixo e o fio acrescentam?",
      "Por que a roda desce tão devagar comparada a uma queda livre?",
      "Qual medida mais contribui para a incerteza de $I$: o tempo ou o raio do eixo?",
    ],
  },
  {
    id: "exp1-colisoes",
    course: "Exp I",
    title: "Colisões no trilho de ar",
    sim: "colisoes",
    scenario: "gruda",
    params: { modo: 0, ref: 0, m1: 1, v1: 3, v2: 0, e: 0 },
    locked: ["modo", "m1", "v1", "v2", "e"],
    objective: "Verificar a conservação do momento linear numa colisão perfeitamente inelástica variando a massa do carrinho alvo.",
    materials: ["trilho de ar", "dois carrinhos com velcro", "massas adicionais", "fotoportas", "balança"],
    procedure: `### Procedimento
1. O carrinho 1 (1,000 kg) chega a 3,00 m/s no carrinho 2, parado; eles grudam.
2. Escolha a massa do carrinho 2, rode até depois da colisão e clique em **Registrar medida** (a balança mede $m_2$ e a fotoporta mede a velocidade final).
3. Repita para pelo menos 6 massas.
4. Se o momento se conserva, $v' = \\dfrac{m_1 v_1}{m_1+m_2}$: o gráfico de $v'$ contra $m_1 v_1/(m_1+m_2)$ é uma reta pela origem com inclinação 1.`,
    columns: [
      { key: "m2", label: "m₂", unit: "g", source: { param: "m2" }, instrument: { id: "balanca-10kg", name: "Balança (10 kg)", unit: "g", kind: "digital", resolution: 1, range: [0, 10000], accuracy: () => 2 }, toUnit: 1000 },
      {
        key: "vf",
        label: "v'",
        unit: "m/s",
        source: { observable: "v1x" },
        instrument: { id: "fotoporta-v", name: "Fotoporta (velocidade)", unit: "m/s", kind: "digital", resolution: 0.001, range: [-10, 10], accuracy: (r) => 0.005 * Math.abs(r) },
      },
      { key: "vp", label: "m₁v₁/(m₁+m₂)", unit: "m/s", from: ["m2"], compute: (m2) => (1 * 3) / (1 + m2 / 1000) },
    ],
    minRows: 5,
    analysis: {
      x: "vp",
      y: "vf",
      fit: "proporcional",
      results: [{ label: "p depois / p antes", unit: "", compute: (b) => b, reference: 1 }],
    },
    questions: [
      "Que fração da energia cinética se perdeu em cada colisão? Compare com $m_2/(m_1+m_2)$.",
      "Por que o trilho de ar é essencial para este experimento?",
    ],
  },
  {
    id: "exp2-kundt",
    course: "Exp II",
    title: "Tubo de Kundt / ressonância e velocidade do som",
    sim: "tubo-kundt",
    params: { modo: 0, gas: 0, T: 20, r: 0.0175, vel: 0, teoria: 0 },
    locked: ["modo", "gas", "T", "r", "vel", "teoria"],
    objective: "Medir a velocidade do som no ar e a correção de extremidade de um tubo pela primeira ressonância de uma coluna de ar.",
    materials: ["tubo de ressonância com reservatório de água", "alto-falante e gerador de frequência", "trena"],
    procedure: `### Procedimento
1. Escolha a frequência do gerador.
2. Baixe lentamente a água a partir da boca do tubo até ouvir (e ver no gráfico) a **primeira ressonância**, onde o som fica mais intenso.
3. Meça a distância $L$ da boca até a água e clique em **Registrar medida**.
4. Repita para pelo menos 6 frequências entre 300 Hz e 1300 Hz.
5. Na primeira ressonância, $L + e = \\lambda/4 = c/(4f)$: o gráfico de $L$ contra $1/f$ é uma reta de inclinação $c/4$ e intercepto $-e$ (correção de extremidade).
6. Depois, experimente o modo **Kundt**: o pó de cortiça se acumula nos nós, separados de $\\lambda/2$.`,
    columns: [
      { key: "f", label: "f", unit: "Hz", source: { param: "f" }, instrument: { id: "frequencimetro", name: "Frequencímetro", unit: "Hz", kind: "digital", resolution: 1, range: [0, 100000], accuracy: (r) => 1e-4 * r + 1 } },
      { key: "L", label: "L", unit: "m", source: { observable: "L" }, instrument: "trena" },
      { key: "invf", label: "1/f", unit: "ms", from: ["f"], compute: (f) => 1000 / f },
    ],
    minRows: 5,
    analysis: {
      x: "invf",
      y: "L",
      fit: "linear",
      results: [
        { label: "c", unit: "m/s", compute: (_a, b) => 4000 * b, reference: 343.2 },
        { label: "e", unit: "cm", compute: (a) => -100 * a, reference: 1.05 },
      ],
    },
    demo: (i) => {
      const f = 300 + 200 * i;
      return { params: { f, L: 343.23 / (4 * f) - 0.0105 }, t: 1 };
    },
    questions: [
      "A velocidade do som obtida é compatível com $c = 331\\sqrt{T/273}$ m/s a 20 °C?",
      "Compare a correção de extremidade com $0{,}6\\,r$ para o raio do tubo (1,75 cm).",
      "Onde estariam a segunda e a terceira ressonâncias para 500 Hz? Confira no aparato.",
    ],
  },
  {
    id: "exp2-dilatacao",
    course: "Exp II",
    title: "Dilatação térmica",
    sim: "dilatacao-termica",
    params: { material: 0, aquec: 1, T0: 22, L0: 0.5, bimetal: 0 },
    locked: ["material", "aquec", "T0", "L0"],
    objective: "Determinar o coeficiente de dilatação linear de um tubo de latão com um dilatômetro e um relógio comparador.",
    materials: ["dilatômetro com tubo de latão (L₀ = 500 mm)", "banho termostático", "relógio comparador (0,01 mm)", "termômetro digital"],
    procedure: `### Procedimento
1. Ajuste a temperatura do banho e espere o termômetro e o relógio comparador estabilizarem (o tubo leva alguns segundos para entrar em equilíbrio).
2. Clique em **Registrar medida** para ler a temperatura e a dilatação $\\Delta L$.
3. Repita para pelo menos 6 temperaturas entre 30 °C e 95 °C.
4. Como $\\Delta L = \\alpha L_0 (T - T_0)$, o gráfico de $\\Delta L$ contra $T$ é uma reta de inclinação $\\alpha L_0$.`,
    columns: [
      { key: "T", label: "T", unit: "°C", source: { observable: "T" }, instrument: "termopar" },
      { key: "dL", label: "ΔL", unit: "mm", source: { observable: "dL" }, instrument: { id: "relogio-comparador", name: "Relógio comparador", unit: "mm", kind: "analogico", resolution: 0.01, range: [-10, 10] } },
    ],
    minRows: 5,
    analysis: {
      x: "T",
      y: "dL",
      fit: "linear",
      results: [
        { label: "α", unit: "10⁻⁶ /K", compute: (_a, b) => (b / (1000 * 0.5)) * 1e6, reference: 19 },
        { label: "T₀", unit: "°C", compute: (a, b) => -a / b, reference: 22 },
      ],
    },
    demo: (i) => ({ params: { Tb: 35 + 12 * i }, t: 30 }),
    questions: [
      "O coeficiente obtido é compatível com o do latão (19 × 10⁻⁶ /K)?",
      "O que acontece com os pontos se você registrar antes de o tubo entrar em equilíbrio?",
      "Na lâmina bimetálica, para que lado ela curva ao aquecer? Por quê?",
    ],
  },
  {
    id: "exp2-joule",
    course: "Exp II",
    title: "Equivalente mecânico do calor",
    sim: "equivalente-mecanico",
    params: { modo: 0, m: 10, h: 1.5, mw: 0.5, E: 50, T0: 20, Ta: 20, Gp: 0 },
    locked: ["modo", "m", "h", "mw", "E", "T0", "Ta", "Gp"],
    objective: "Determinar o equivalente mecânico do calor com o aparelho de Joule.",
    materials: ["aparelho de Joule com dois pesos de 10 kg e altura de queda de 1,50 m", "calorímetro com 500 g de água (equivalente em água do recipiente: 50 g)", "termômetro de Beckmann (0,01 K)", "fotoporta para a velocidade final"],
    procedure: `### Procedimento
1. Escolha o número $N$ de quedas e rode até a última queda terminar.
2. Clique em **Registrar medida**: a bancada lê o aumento de temperatura $\\Delta T$ e a velocidade de chegada dos pesos $v$.
3. Repita para pelo menos 6 valores de $N$ entre 2 e 12.
4. O trabalho entregue à água é $W = N\\,(2mgh - m v^2)$, descontando a energia cinética de chegada dos dois pesos.
5. O calor recebido é $Q = C\\,\\Delta T$ com $C = 550$ cal/K. O gráfico de $\\Delta T$ contra $W$ é uma reta pela origem de inclinação $1/(J\\,C)$.`,
    columns: [
      { key: "N", label: "N", unit: "", source: { param: "N" }, instrument: { id: "contador", name: "Contador de quedas", unit: "", kind: "digital", resolution: 1, range: [0, 100] } },
      { key: "v", label: "v", unit: "m/s", source: { observable: "vf" }, instrument: { id: "fotoporta-v", name: "Fotoporta (velocidade)", unit: "m/s", kind: "digital", resolution: 0.001, range: [0, 20], accuracy: (r) => 0.005 * r } },
      { key: "dT", label: "ΔT", unit: "K", source: { observable: "dT" }, instrument: { id: "beckmann", name: "Termômetro de Beckmann", unit: "K", kind: "analogico", resolution: 0.01, range: [0, 6] } },
      { key: "W", label: "W", unit: "J", from: ["N", "v"], compute: (N, v) => N * (2 * 10 * 9.81 * 1.5 - 10 * v * v) },
    ],
    minRows: 5,
    analysis: {
      x: "W",
      y: "dT",
      fit: "proporcional",
      results: [{ label: "J", unit: "J/cal", compute: (b) => 1 / (b * 550), reference: 4.186 }],
    },
    demo: (i) => ({ params: { N: 2 + 2 * i }, t: 1e6 }),
    questions: [
      "O valor de J é compatível com 4,186 J/cal?",
      "Por que é preciso descontar a energia cinética com que os pesos chegam ao chão?",
      "Como as perdas de calor para o ambiente afetariam o resultado? Para que lado?",
    ],
  },
  {
    id: "exp2-stokes",
    course: "Exp II",
    title: "Viscosidade (Stokes)",
    sim: "viscosidade-stokes",
    params: { fluido: 0, T: 20, material: 0, D: 50, parede: 1, yA: 0.2, L: 0.5 },
    locked: ["fluido", "T", "material", "D", "parede", "yA", "L"],
    objective: "Determinar a viscosidade da glicerina pela velocidade terminal de esferas de aço (lei de Stokes).",
    materials: ["proveta de 1 m com glicerina a 20 °C (diâmetro interno 50 mm)", "esferas de aço de vários diâmetros", "micrômetro", "cronômetro manual", "dois elásticos marcando 0,50 m"],
    procedure: `### Procedimento
1. Meça o diâmetro da esfera com o micrômetro.
2. Solte a esfera no centro da proveta e cronometre a passagem entre as marcas A e B (0,50 m). Clique em **Registrar medida** depois que ela passar por B (a bancada cronometra três vezes).
3. Repita para pelo menos 6 diâmetros entre 1,5 mm e 4 mm.
4. Corrija o efeito da parede (Ladenburg): $v_\\infty = v\\,(1 + 2{,}4\\,d/D)$.
5. Pela lei de Stokes, $v_\\infty = \\frac{2(\\rho_e - \\rho_f) g}{9\\mu} r^2$: o gráfico de $v_\\infty$ contra $r^2$ é uma reta pela origem.
6. Confira o número de Reynolds de cada esfera: a lei de Stokes vale para $Re \\ll 1$.`,
    columns: [
      { key: "d", label: "d", unit: "mm", source: { param: "d" }, instrument: "micrometro" },
      { key: "t", label: "t_AB", unit: "s", source: { observable: "tAB" }, instrument: "cronometroManual", repeat: 3 },
      { key: "r2", label: "r²", unit: "mm²", from: ["d"], compute: (d) => (d / 2) ** 2 },
      { key: "v", label: "v∞", unit: "mm/s", from: ["t", "d"], compute: (t, d) => (500 / t) * (1 + (2.4 * d) / 50) },
    ],
    minRows: 5,
    analysis: {
      x: "r2",
      y: "v",
      fit: "proporcional",
      results: [{ label: "μ", unit: "Pa·s", compute: (b) => (2 * (7850 - 1261) * 9.81) / (9 * b * 1000), reference: 1.41 }],
    },
    demo: (i) => ({ params: { d: 1.5 + 0.5 * i }, t: 1e6 }),
    questions: [
      "A viscosidade obtida é compatível com 1,41 Pa·s (glicerina a 20 °C)? Discuta o efeito do número de Reynolds nas esferas maiores.",
      "Quanto mudaria o resultado sem a correção de parede?",
      "Por que a marca A precisa ficar alguns centímetros abaixo da superfície?",
    ],
  },
  {
    id: "exp2-tensao-superficial",
    course: "Exp II",
    title: "Tensão superficial",
    sim: "tensao-superficial",
    params: { modo: 0, liquido: 0, T: 20, theta: 0, u: 0.5 },
    locked: ["modo", "liquido", "T", "theta"],
    objective: "Determinar a tensão superficial da água pelo método do anel de Du Noüy.",
    materials: ["anéis de platina de vários raios", "dinamômetro de torção (mN)", "béquer com água a 20 °C sobre macaco", "paquímetro"],
    procedure: `### Procedimento
1. Meça o raio do anel e leia o peso dele no ar.
2. Mergulhe o anel e baixe o béquer lentamente: a força cresce até o filme romper. Clique em **Registrar medida** depois da ruptura (a bancada registra a força máxima três vezes).
3. Repita para pelo menos 6 anéis.
4. O filme puxa o anel pelas duas bordas, num comprimento total $4\\pi R$: $F_{max} - P = 4\\pi R\\,\\gamma$. O gráfico de $F_{max} - P$ contra $4\\pi R$ é uma reta pela origem de inclinação $\\gamma$.
5. No modo **capilar**, verifique a lei de Jurin $h = 2\\gamma\\cos\\theta/(\\rho g r)$.`,
    columns: [
      { key: "R", label: "R", unit: "mm", source: { param: "R" }, instrument: "paquimetro" },
      { key: "P", label: "P", unit: "mN", source: { observable: "P" }, instrument: { id: "tensiometro", name: "Dinamômetro de torção", unit: "mN", kind: "analogico", resolution: 0.05, range: [0, 100] }, toUnit: 1000 },
      { key: "Fm", label: "F_max", unit: "mN", source: { observable: "Fmax" }, instrument: { id: "tensiometro", name: "Dinamômetro de torção", unit: "mN", kind: "analogico", resolution: 0.05, range: [0, 100] }, toUnit: 1000, repeat: 3 },
      { key: "L", label: "4πR", unit: "m", from: ["R"], compute: (R) => (4 * Math.PI * R) / 1000 },
      { key: "Ff", label: "F_max − P", unit: "mN", from: ["Fm", "P"], compute: (Fm, P) => Fm - P },
    ],
    minRows: 5,
    analysis: {
      x: "L",
      y: "Ff",
      fit: "proporcional",
      results: [{ label: "γ", unit: "mN/m", compute: (b) => b, reference: 72.8 }],
    },
    demo: (i) => ({ params: { R: [6, 8, 9.55, 12, 15, 18][i] ?? 10 }, t: 1e6 }),
    questions: [
      "O valor de γ é compatível com 72,8 mN/m da água a 20 °C?",
      "Como a tensão superficial muda com a temperatura e com sabão? Confira no aparato.",
      "O que é o fator de correção de Harkins–Jordan e por que os tensiômetros reais o usam?",
    ],
  },
  {
    id: "exp2-newton",
    course: "Exp II",
    title: "Resfriamento de Newton",
    sim: "conducao-calor",
    params: { modo: 1, corpo: 1, Dc: 50, T0: 80, Ta: 22, modelo: 0, h: 10, ritmo: 100 },
    locked: ["modo", "corpo", "Dc", "T0", "Ta", "modelo", "h"],
    objective: "Verificar a lei de resfriamento de Newton e determinar a constante de tempo de uma esfera de cobre esfriando no ar.",
    materials: ["esfera de cobre de 50 mm aquecida a 80 °C", "termômetro digital (termopar)", "cronômetro", "sala a 22 °C"],
    procedure: `### Procedimento
1. Inicie o resfriamento e, a intervalos regulares, clique em **Registrar medida** para anotar o tempo (em minutos) e a temperatura.
2. Faça pelo menos 8 leituras ao longo de uns 80 minutos (o relógio do aparato é acelerado).
3. Pela lei de Newton, $\\Delta T = \\Delta T_0\\,e^{-t/\\tau}$ com $\\Delta T = T - T_{amb}$: o gráfico de $\\ln\\Delta T$ contra $t$ é uma reta de inclinação $-1/\\tau$.
4. Compare com $\\tau = mc/(hA)$. Troque o **modelo** para convecção natural com radiação e veja o desvio da reta.`,
    columns: [
      { key: "t", label: "t", unit: "min", source: { observable: "tf" }, instrument: "cronometroManual", toUnit: 1 / 60 },
      { key: "T", label: "T", unit: "°C", source: { observable: "T" }, instrument: "termopar" },
      { key: "dT", label: "ΔT", unit: "K", from: ["T"], compute: (T) => T - 22 },
    ],
    minRows: 6,
    analysis: {
      x: "t",
      y: "dT",
      fit: "exponencial",
      results: [{ label: "τ", unit: "s", compute: (_A, b) => -60 / b, reference: 2875 }],
    },
    demo: (i) => ({ t: 3 + 7 * i }),
    questions: [
      "Os pontos de $\\ln\\Delta T$ ficam numa reta? Em que faixa de temperatura a lei de Newton funciona melhor?",
      "Compare o τ medido com $mc/(hA)$ para a esfera de cobre.",
      "Por que uma esfera de alumínio do mesmo tamanho esfria mais depressa?",
    ],
  },
  {
    id: "exp2-condutividade",
    course: "Exp II",
    title: "Condutividade térmica",
    sim: "conducao-calor",
    params: { modo: 0, material: 0, Lb: 0.3, Db: 25, Te: 18, vazao: 40, hl: 0, Ta: 22, ritmo: 50 },
    locked: ["modo", "material", "Lb", "Db", "Te", "vazao", "hl", "Ta"],
    objective: "Determinar a condutividade térmica do cobre pelo fluxo de calor em regime estacionário numa barra isolada.",
    materials: ["barra de cobre isolada (Ø 25 mm) entre fonte quente e bloco resfriado a água", "termopares a cada 5 cm", "termopar diferencial na água", "proveta e cronômetro para a vazão"],
    procedure: `### Procedimento
1. Ajuste a temperatura da fonte quente e espere o **regime estacionário** (as leituras param de mudar).
2. Clique em **Registrar medida**: a bancada lê os termopares $T_1$ e $T_5$ (separados por 0,20 m), a vazão da água e o aumento de temperatura dela.
3. Repita para pelo menos 6 temperaturas da fonte entre 50 °C e 100 °C.
4. O calor levado pela água é $\\dot Q = \\dot m c\\,\\Delta T_{água}$. Pela lei de Fourier, $\\dot Q = kA\\,(T_1 - T_5)/\\Delta x$: o gráfico de $\\dot Q$ contra $A(T_1 - T_5)/\\Delta x$ é uma reta pela origem de inclinação $k$.`,
    columns: [
      { key: "T1", label: "T₁", unit: "°C", source: { observable: "T1" }, instrument: "termopar" },
      { key: "T5", label: "T₅", unit: "°C", source: { observable: "T5" }, instrument: "termopar" },
      { key: "dTw", label: "ΔT_água", unit: "K", source: { observable: "dTw" }, instrument: { id: "termopar-dif", name: "Termopar diferencial", unit: "K", kind: "digital", resolution: 0.01, range: [-50, 50], accuracy: (r) => 0.02 + 0.005 * Math.abs(r) } },
      { key: "V", label: "vazão", unit: "mL/min", source: { param: "vazao" }, instrument: { id: "proveta-cronometro", name: "Proveta e cronômetro", unit: "mL/min", kind: "digital", resolution: 1, range: [0, 1000], accuracy: (r) => 0.01 * r } },
      { key: "x", label: "A(T₁ − T₅)/Δx", unit: "m·K", from: ["T1", "T5"], compute: (T1, T5) => (Math.PI * 0.0125 ** 2 * (T1 - T5)) / 0.2 },
      { key: "Q", label: "Q̇", unit: "W", from: ["V", "dTw"], compute: (V, dT) => (V / 6e7) * 1000 * 4186 * dT },
    ],
    minRows: 5,
    analysis: {
      x: "x",
      y: "Q",
      fit: "proporcional",
      results: [{ label: "k", unit: "W/(m·K)", compute: (b) => b, reference: 385 }],
    },
    demo: (i) => ({ params: { Tq: 50 + 10 * i }, t: 30 }),
    questions: [
      "A condutividade obtida é compatível com a do cobre (cerca de 385 W/m·K)?",
      "O perfil de temperatura ao longo da barra é linear? O que mudaria com perdas laterais?",
      "Por que é preciso esperar o regime estacionário antes de medir?",
    ],
  },
  {
    id: "exp3-instrumentos",
    course: "Exp III",
    title: "Uso de multímetro e osciloscópio",
    sim: "multimetro-osciloscopio",
    params: { onda: 0, dmm: 0, f: 500, off: 0, dmmFunc: 0 },
    locked: ["off", "dmmFunc"],
    objective: "Aprender a medir tensões alternadas com o osciloscópio e o multímetro e verificar a relação entre valor de pico e valor eficaz.",
    materials: ["gerador de funções", "osciloscópio de 2 canais", "multímetro true RMS e multímetro de média", "protoboard com circuito RC"],
    procedure: `### Procedimento
1. Ajuste o gerador para uma senoide de 500 Hz. No osciloscópio, escolha V/div e s/div para ver dois ou três períodos e ajuste o **disparo** até o traço ficar parado.
2. Leia a tensão pico a pico $V_{pp}$ na tela e a tensão eficaz no multímetro. Clique em **Registrar medida**.
3. Repita para pelo menos 6 amplitudes.
4. Para a senoide, $V_{rms} = V_p/\\sqrt2 = V_{pp}/(2\\sqrt2)$: o gráfico de $V_{rms}$ contra $V_{pp}$ é uma reta pela origem.
5. Troque para onda **quadrada** e **triangular** e para o multímetro de **média**. Qual multímetro erra, e quanto?
6. Ligue o canal 2 no capacitor e meça a defasagem entre os canais.`,
    columns: [
      { key: "vpp", label: "V_pp", unit: "V", source: { observable: "Vpp" }, instrument: { id: "osciloscopio", name: "Osciloscópio (cursores)", unit: "V", kind: "digital", resolution: 0.01, range: [-100, 100], accuracy: (r) => 0.03 * Math.abs(r) } },
      { key: "vrms", label: "V_rms", unit: "V", source: { observable: "Vdmm" }, instrument: { id: "multimetro-ca", name: "Multímetro (V~)", unit: "V", kind: "digital", resolution: 0.001, range: [0, 200], accuracy: dmmAccuracy(1, 3, 0.001) } },
    ],
    minRows: 5,
    analysis: {
      x: "vpp",
      y: "vrms",
      fit: "proporcional",
      results: [{ label: "V_p/V_rms", unit: "", compute: (b) => 1 / (2 * b), reference: Math.SQRT2 }],
    },
    demo: (i) => ({ params: { A: 0.4 + 0.2 * i } }),
    questions: [
      "A razão $V_p/V_{rms}$ obtida é compatível com $\\sqrt2$?",
      "Na onda quadrada, quanto o multímetro de média erra? Explique pelo fator de forma.",
      "O que acontece com o traço se o nível de disparo ficar acima do pico do sinal?",
    ],
  },
  {
    id: "exp3-diodo",
    course: "Exp III",
    title: "Lei de Ohm e resistores não-ôhmicos (lâmpada, diodo)",
    sim: "curva-iv",
    params: { comp: 2, Rp: 100, montagem: 0, Ra: 1, Rv: 1e7 },
    locked: ["Ra", "Rv"],
    objective: "Levantar a curva I–V de um resistor, de uma lâmpada e de um diodo de silício, e obter o fator de idealidade do diodo pela equação de Shockley.",
    materials: ["fonte DC ajustável", "resistor de proteção de 100 Ω", "resistor de 470 Ω, lâmpada de 12 V e diodo 1N4148", "voltímetro e miliamperímetro", "protoboard"],
    procedure: `### Procedimento
1. Comece pelo **resistor**: varie a tensão da fonte, registre $V$ e $I$ e confira que $V/I$ é constante (lei de Ohm). Compare as montagens a jusante e a montante.
2. Troque para a **lâmpada**: $V/I$ cresce com a corrente porque o filamento esquenta.
3. Troque para o **diodo** em polarização direta, limpe a tabela e registre pelo menos 6 pontos com a fonte entre 0,6 V e 1,6 V.
4. Pela equação de Shockley, $I = I_s\\,e^{V/(nV_T)}$ com $V_T = 25{,}85$ mV a 27 °C: o ajuste exponencial de $I$ contra $V$ dá $n$.`,
    columns: [
      { key: "V", label: "V", unit: "V", source: { observable: "V" }, instrument: { id: "voltimetro-2v", name: "Multímetro (V DC, 2 V)", unit: "V", kind: "digital", resolution: 0.0001, range: [-2, 2], accuracy: dmmAccuracy(0.5, 2, 0.0001) } },
      { key: "I", label: "I", unit: "mA", source: { observable: "I" }, instrument: { id: "miliamperimetro", name: "Multímetro (mA DC, 20 mA)", unit: "mA", kind: "digital", resolution: 0.001, range: [-20, 20], accuracy: dmmAccuracy(1, 3, 0.001) }, toUnit: 1000 },
    ],
    minRows: 5,
    analysis: {
      x: "V",
      y: "I",
      fit: "exponencial",
      results: [{ label: "n", unit: "", compute: (_A, B) => 1 / (B * 0.025852), reference: 1.752 }],
    },
    demo: (i) => ({ params: { Vf: [0.6, 0.75, 0.9, 1.1, 1.3, 1.6][i] ?? 1 } }),
    questions: [
      "Qual montagem (jusante ou montante) dá menor erro sistemático para o resistor de 470 Ω? E para um de 1 MΩ?",
      "Por que a resistência da lâmpada fria é muito menor que a quente?",
      "O fator de idealidade obtido está entre 1 e 2? O que ele indica sobre o diodo?",
    ],
  },
  {
    id: "exp3-wheatstone",
    course: "Exp III",
    title: "Kirchhoff e ponte de Wheatstone",
    sim: "ponte-wheatstone",
    params: { modo: 0, rx: 0, E: 6, sens: 1, R2: 1000 },
    locked: ["modo", "rx", "E"],
    objective: "Medir uma resistência desconhecida com a ponte de Wheatstone, usando várias razões de braço.",
    materials: ["fonte de 6 V", "resistores de precisão R₁ e R₂", "década resistiva R₃", "galvanômetro com shunt", "resistor desconhecido Rx"],
    procedure: `### Procedimento
1. Escolha a razão $R_1/R_2$ dos braços.
2. Com o shunt do galvanômetro ligado, ajuste a década $R_3$ até o ponteiro zerar; depois tire o shunt e faça o ajuste fino.
3. Na ponte equilibrada, $R_3 = R_x\\,R_1/R_2$. Clique em **Registrar medida**.
4. Repita para pelo menos 6 razões entre 0,1 e 5.
5. O gráfico de $R_3$ contra $R_1/R_2$ é uma reta pela origem de inclinação $R_x$.
6. No modo **Kirchhoff**, confira as leis dos nós e das malhas com os amperímetros.`,
    columns: [
      { key: "R1", label: "R₁", unit: "Ω", source: { param: "R1" }, instrument: { id: "resistor-precisao", name: "Resistor de precisão (0,1 %)", unit: "Ω", kind: "digital", resolution: 0.1, range: [0, 100000], accuracy: (r) => 0.001 * r } },
      { key: "R2", label: "R₂", unit: "Ω", source: { param: "R2" }, instrument: { id: "resistor-precisao", name: "Resistor de precisão (0,1 %)", unit: "Ω", kind: "digital", resolution: 0.1, range: [0, 100000], accuracy: (r) => 0.001 * r } },
      { key: "R3", label: "R₃", unit: "Ω", source: { param: "R3" }, instrument: { id: "decada", name: "Década resistiva (0,1 %)", unit: "Ω", kind: "digital", resolution: 1, range: [0, 11110], accuracy: (r) => 0.001 * r + 0.5 } },
      { key: "k", label: "R₁/R₂", unit: "", from: ["R1", "R2"], compute: (a, b) => a / b },
    ],
    minRows: 5,
    analysis: {
      x: "k",
      y: "R3",
      fit: "proporcional",
      results: [{ label: "Rx", unit: "Ω", compute: (b) => b, reference: 327.4 }],
    },
    demo: (i) => {
      const R1 = [100, 200, 500, 1000, 2000, 5000][i] ?? 1000;
      return { params: { R1, R2: 1000, R3: Math.round((327.4 * R1) / 1000) } };
    },
    questions: [
      "Por que a ponte não depende da tensão da fonte nem da resistência do galvanômetro?",
      "Qual razão de braços deu a medida mais precisa? Por quê?",
      "No modo Kirchhoff, a soma das correntes no nó e das tensões em cada malha deu zero dentro das incertezas?",
    ],
  },
  {
    id: "exp3-transformador",
    course: "Exp III",
    title: "Indução e transformador",
    sim: "transformador",
    params: { modo: 2, nucleo: 0, N1: 500, V1: 12, f: 60, RL: 10000 },
    locked: ["modo", "nucleo", "N1", "V1", "f", "RL"],
    objective: "Verificar a relação de espiras de um transformador com núcleo de ferro e observar a lei de Faraday.",
    materials: ["núcleo de ferro laminado", "bobina primária de 500 espiras", "bobinas secundárias de 100 a 850 espiras", "fonte CA de 12 V / 60 Hz", "multímetro (V~)"],
    procedure: `### Procedimento
1. No modo **ímã**, deixe o ímã cair pela bobina e observe a fem no osciloscópio: por que os dois picos têm sinais opostos e áreas iguais?
2. No modo **transformador**, escolha a bobina secundária (número de espiras $N_2$) e meça a tensão $V_2$ em vazio (carga de 10 kΩ). Clique em **Registrar medida**.
3. Repita para pelo menos 6 bobinas.
4. Para o transformador ideal, $V_2/N_2 = V_1/N_1$: o gráfico de $V_2$ contra $N_2$ é uma reta pela origem de inclinação $V_1/N_1$.
5. Troque o núcleo por ar e veja o que acontece com a relação e com o rendimento.`,
    columns: [
      { key: "N2", label: "N₂", unit: "espiras", source: { param: "N2" }, instrument: { id: "espiras", name: "Número de espiras (rótulo)", unit: "", kind: "digital", resolution: 1, range: [0, 10000] } },
      { key: "V2", label: "V₂", unit: "V", source: { observable: "V2" }, instrument: { id: "multimetro-ca", name: "Multímetro (V~)", unit: "V", kind: "digital", resolution: 0.001, range: [0, 200], accuracy: dmmAccuracy(1, 3, 0.001) } },
    ],
    minRows: 5,
    analysis: {
      x: "N2",
      y: "V2",
      fit: "proporcional",
      results: [{ label: "V₁/N₁", unit: "V/espira", compute: (b) => b, reference: 0.024 }],
    },
    demo: (i) => ({ params: { N2: 100 + 150 * i } }),
    questions: [
      "A inclinação é compatível com $V_1/N_1$? Que perdas explicam a diferença?",
      "Com núcleo de ar, por que a tensão no secundário cai tanto?",
      "Por que os núcleos de transformador são laminados?",
    ],
  },
  {
    id: "exp3-rc",
    course: "Exp III",
    title: "Carga e descarga RC",
    sim: "circuito-rc",
    scenario: "medir-tau",
    params: { modo: 0, inicio: 0, V0: 5, R: 1000, C: 100 },
    locked: ["modo", "inicio", "V0", "R", "C"],
    objective: "Determinar a constante de tempo de um circuito RC pela linearização da curva de carga do capacitor.",
    materials: ["fonte de 5 V", "resistor de 1 kΩ", "capacitor de 100 µF", "osciloscópio", "chave"],
    procedure: `### Procedimento
1. Feche a chave em A (carga) e rode. Pause em vários instantes durante a carga e clique em **Registrar medida**: o osciloscópio fornece o tempo e a tensão no capacitor.
2. Registre pelo menos 8 pontos entre 0 e $3\\tau$, evitando o final em que $V_C \\approx V_0$.
3. Como $V_C = V_0(1 - e^{-t/\\tau})$, o gráfico de $\\ln(1 - V_C/V_0)$ contra $t$ é uma reta de inclinação $-1/\\tau$.
4. Compare com $RC$ nominal. Depois use os cursores do osciloscópio para medir $\\tau$ diretamente (63% de $V_0$).`,
    columns: [
      { key: "t", label: "t", unit: "s", source: { time: true }, instrument: "fotoporta" },
      { key: "vc", label: "V_C", unit: "V", source: { observable: "Vc" }, instrument: "voltimetro" },
      { key: "y", label: "ln(1 − V_C/V₀)", unit: "", from: ["vc"], compute: (v) => Math.log(1 - v / 5) },
    ],
    minRows: 6,
    demo: (i) => ({ t: 0.02 + 0.03 * i }),
    analysis: {
      x: "t",
      y: "y",
      fit: "linear",
      results: [{ label: "τ", unit: "s", compute: (_a, b) => -1 / b, reference: 0.1 }],
    },
    questions: [
      "Por que os pontos com $V_C$ perto de $V_0$ têm barras de erro enormes no gráfico linearizado?",
      "Quanto da energia fornecida pela fonte fica no capacitor ao fim da carga? Justifique.",
    ],
  },
  {
    id: "exp3-equipotenciais",
    course: "Exp III",
    title: "Mapeamento de equipotenciais (cuba eletrolítica)",
    sim: "potencial",
    scenario: "placas",
    params: { montagem: 0, V0: 10, borda: 0 },
    locked: ["montagem", "V0", "borda"],
    objective: "Mapear o potencial entre dois eletrodos planos e obter o campo elétrico a partir de V(x).",
    materials: ["cuba eletrolítica", "eletrodos planos", "fonte de 10 V", "voltímetro com ponta de prova", "papel milimetrado"],
    procedure: `### Procedimento
1. A carga de teste faz o papel da ponta de prova: arraste-a ao longo da linha que une os eletrodos.
2. Em cada posição clique em **Registrar medida** (régua para a posição, voltímetro para o potencial).
3. Meça pelo menos 7 posições entre as placas, longe das bordas.
4. Entre placas paralelas $V(x)$ é linear e $E = -dV/dx$ é a inclinação com sinal trocado.
5. Use o voltímetro de duas pontas para seguir uma equipotencial: elas são perpendiculares às linhas de campo?`,
    columns: [
      { key: "x", label: "x", unit: "m", source: { observable: "xq" }, instrument: "trena" },
      { key: "V", label: "V", unit: "V", source: { observable: "Vq" }, instrument: "voltimetro" },
    ],
    minRows: 5,
    demo: (i) => ({ drag: { from: ["xq", "yq"], to: [-0.3 + 0.12 * i, 0] } }),
    analysis: {
      x: "x",
      y: "V",
      fit: "linear",
      results: [{ label: "E", unit: "V/m", compute: (_a, b) => -b }],
    },
    questions: [
      "O campo é uniforme em toda a região entre as placas? Onde ele deixa de ser?",
      "O que mudaria se a água da cuba fosse substituída por água destilada?",
    ],
  },
  {
    id: "exp3-bobina",
    course: "Exp III",
    title: "Campo magnético de bobina (Biot-Savart, Helmholtz)",
    sim: "biot-savart",
    params: { modo: 2, R: 3 },
    locked: ["modo", "R"],
    objective: "Verificar que o campo no centro de uma espira circular é proporcional à corrente e obter $\\mu_0$.",
    materials: ["espira circular de 3,0 cm de raio", "fonte de corrente", "amperímetro", "sonda Hall (teslâmetro)"],
    procedure: `### Procedimento
1. Coloque a sonda no centro da espira (ponto de referência).
2. Ajuste a corrente e clique em **Registrar medida**.
3. Meça para pelo menos 6 correntes, incluindo valores negativos.
4. No centro, $B = \\mu_0 I / (2R)$: o gráfico de $B$ contra $I$ é uma reta pela origem.`,
    columns: [
      { key: "I", label: "I", unit: "A", source: { param: "I" }, instrument: { id: "amperimetro-a", name: "Amperímetro (A)", unit: "A", kind: "digital", resolution: 0.01, range: [-20, 20], accuracy: (r) => 0.01 * Math.abs(r) + 0.02 } },
      { key: "B", label: "B", unit: "mT", source: { observable: "Bz" }, instrument: { id: "teslametro", name: "Teslâmetro (sonda Hall)", unit: "mT", kind: "digital", resolution: 0.001, range: [-200, 200], accuracy: (r) => 0.02 * Math.abs(r) + 0.002 }, toUnit: 1000 },
    ],
    minRows: 5,
    analysis: {
      x: "I",
      y: "B",
      fit: "proporcional",
      results: [{ label: "μ₀", unit: "T·m/A", compute: (b) => b * 1e-3 * 2 * 0.03, reference: 1.2566e-6 }],
    },
    questions: [
      "O sinal de B muda quando a corrente inverte? O que isso diz sobre a regra da mão direita?",
      "Como você montaria duas bobinas em configuração de Helmholtz para obter campo uniforme?",
    ],
  },
  {
    id: "exp3-em",
    course: "Exp III",
    title: "Relação e/m",
    sim: "particula-campo-b",
    scenario: "circular",
    params: { modo: 0, particula: 1, v0: 10000000, B: 0.02 },
    locked: ["modo", "particula", "v0"],
    objective: "Determinar a razão carga/massa do elétron pelo raio da órbita num campo magnético uniforme.",
    materials: ["ampola de feixe filiforme", "bobinas de Helmholtz", "fonte de alta tensão", "escala milimetrada"],
    procedure: `### Procedimento
1. Os elétrons saem do canhão com $v = 1{,}00 \\times 10^7$ m/s.
2. Ajuste o campo $B$ e clique em **Registrar medida** (a escala da ampola lê o raio da órbita).
3. Meça para pelo menos 6 valores de $B$ entre 0,01 T e 0,05 T.
4. De $evB = mv^2/r$, $r = \\dfrac{v}{(e/m)}\\cdot\\dfrac{1}{B}$: o gráfico de $r$ contra $1/B$ é uma reta pela origem.`,
    columns: [
      { key: "B", label: "B", unit: "T", source: { param: "B" }, instrument: { id: "teslametro-t", name: "Teslâmetro", unit: "T", kind: "digital", resolution: 0.0001, range: [0, 2], accuracy: (r) => 0.01 * r } },
      { key: "r", label: "r", unit: "mm", source: { observable: "r" }, instrument: { id: "escala-ampola", name: "Escala da ampola", unit: "mm", kind: "analogico", resolution: 0.1, range: [0, 100] }, toUnit: 1000 },
      { key: "invB", label: "1/B", unit: "1/T", from: ["B"], compute: (b) => 1 / b },
    ],
    minRows: 5,
    analysis: {
      x: "invB",
      y: "r",
      fit: "proporcional",
      results: [{ label: "e/m", unit: "C/kg", compute: (b) => (1e7 * 1000) / b, reference: 1.7588e11 }],
    },
    questions: [
      "Por que o feixe é visível na ampola real, e que efeito isso tem sobre a velocidade dos elétrons?",
      "Qual medida mais contribui para a incerteza de e/m?",
    ],
  },
  {
    id: "exp3-rlc",
    course: "Exp III",
    title: "RLC e ressonância",
    sim: "rlc-ca",
    scenario: "ressonancia",
    params: { topologia: 0, inicio: 1, Vp: 10, R: 20, L: 10, C: 1, Rg: 0 },
    locked: ["topologia", "inicio", "Vp", "R", "L", "C", "Rg"],
    objective: "Levantar a curva de ressonância de um RLC série e obter a frequência de ressonância e o fator de qualidade.",
    materials: ["gerador de funções", "resistor de 20 Ω", "indutor de 10 mH", "capacitor de 1 µF", "osciloscópio"],
    procedure: `### Procedimento
1. Varie a frequência do gerador e, para cada valor, clique em **Registrar medida** (o osciloscópio fornece a amplitude da corrente).
2. Concentre pontos perto do pico: pelo menos 12 frequências entre 500 Hz e 5 kHz.
3. Leia no gráfico a frequência de ressonância $f_0$ e a largura de meia potência $\\Delta f$ (onde $I = I_{max}/\\sqrt2$).
4. Compare $f_0$ com $1/(2\\pi\\sqrt{LC})$ e $Q = f_0/\\Delta f$ com $\\frac1R\\sqrt{L/C}$.`,
    columns: [
      { key: "f", label: "f", unit: "Hz", source: { param: "f" }, instrument: { id: "frequencimetro", name: "Frequencímetro", unit: "Hz", kind: "digital", resolution: 1, range: [0, 100000], accuracy: (r) => 1e-4 * r + 1 } },
      { key: "Ip", label: "I_p", unit: "mA", source: { observable: "Ip" }, instrument: "amperimetro", toUnit: 1000 },
    ],
    minRows: 8,
    questions: [
      "Qual foi $f_0$ medido e qual o valor teórico? Discuta a diferença.",
      "Qual o fator de qualidade $Q$ obtido pela largura da curva?",
      "Na ressonância, qual é a fase entre a tensão do gerador e a corrente?",
    ],
  },
  {
    id: "exp2-empuxo",
    course: "Exp II",
    title: "Densidade e empuxo",
    sim: "empuxo",
    scenario: "dinamometro",
    params: { modo: 1, rhoF: 1000, rhoB: 2700, vd: 1 },
    locked: ["modo", "rhoF", "rhoB"],
    objective: "Verificar o princípio de Arquimedes (empuxo proporcional ao volume deslocado) e determinar a densidade do líquido.",
    materials: ["blocos cúbicos de alumínio de várias arestas", "paquímetro de 300 mm", "dinamômetro de 300 N", "béquer com água"],
    procedure: `### Procedimento
1. Escolha a aresta do bloco e meça-a com o paquímetro.
2. Leia o peso no ar e mergulhe o bloco por completo (rode até o dinamômetro estabilizar).
3. Clique em **Registrar medida**: a bancada registra o empuxo $E = P - P_{ap}$ lido no dinamômetro.
4. Repita para pelo menos 6 arestas entre 5 cm e 25 cm.
5. Como $E = \\rho_L g a^3$, o gráfico log-log de $E$ contra $a$ é uma reta de inclinação 3.`,
    columns: [
      { key: "a", label: "a", unit: "cm", source: { param: "a" }, instrument: { id: "paquimetro-300", name: "Paquímetro 300 mm (0,05 mm)", unit: "mm", kind: "nonio", resolution: 0.05, range: [0, 300] }, toUnit: 10 },
      { key: "E", label: "E", unit: "N", source: { observable: "E" }, instrument: { id: "dinamometro-300", name: "Dinamômetro 300 N", unit: "N", kind: "analogico", resolution: 0.2, range: [0, 300] } },
      { key: "acm", label: "a", unit: "cm", from: ["a"], compute: (a) => a / 10 },
    ],
    minRows: 5,
    analysis: {
      x: "acm",
      y: "E",
      fit: "potencia",
      results: [
        { label: "expoente", unit: "", compute: (_A, n) => n, reference: 3 },
        { label: "ρ do líquido", unit: "kg/m³", compute: (A) => A / (9.81 * 1e-6), reference: 1000 },
      ],
    },
    demo: (i) => ({ params: { a: 5 + 4 * i }, t: 4 }),
    questions: [
      "O expoente obtido é compatível com 3? O que isso diz sobre a dependência do empuxo com o volume?",
      "Como você usaria o mesmo aparato para medir a densidade do bloco?",
      "O empuxo depende da profundidade depois que o bloco está todo submerso? Por quê?",
    ],
  },
  {
    id: "exp2-oscilador",
    course: "Exp II",
    title: "Oscilador amortecido e forçado",
    sim: "ressonancia",
    scenario: "varredura",
    params: { modo: 0, m: 1, k: 25, b: 2, F0: 5 },
    locked: ["modo", "m", "k", "b", "F0"],
    objective: "Levantar a curva de ressonância de um oscilador massa-mola forçado e determinar a massa, a constante elástica e a frequência natural.",
    materials: ["carrinho com mola num trilho de ar", "excitador com motor de frequência ajustável", "sensor de posição a laser"],
    procedure: `### Procedimento
1. Ajuste a frequência angular $\\omega$ do excitador e espere o regime estacionário (o transiente morre em alguns $1/\\gamma$).
2. Clique em **Registrar medida**: o sensor registra a amplitude de regime $A$.
3. Meça pelo menos 8 frequências entre 2 e 14 rad/s, com mais pontos perto do pico.
4. De $A = F_0/\\sqrt{(k - m\\omega^2)^2 + (b\\omega)^2}$ com $F_0 = 5$ N:
$$\\left(\\frac{F_0}{A}\\right)^2 = k^2 + (b^2 - 2km)\\,\\omega^2 + m^2\\omega^4$$
Um ajuste quadrático de $(F_0/A)^2$ contra $\\omega^2$ dá $k$ e $m$.`,
    columns: [
      { key: "w", label: "ω", unit: "rad/s", source: { param: "w" }, instrument: { id: "tacometro", name: "Tacômetro do motor", unit: "rad/s", kind: "digital", resolution: 0.01, range: [0, 50], accuracy: (r) => 0.002 * r } },
      { key: "A", label: "A", unit: "cm", source: { observable: "A" }, instrument: { id: "sensor-laser", name: "Sensor de posição a laser", unit: "cm", kind: "digital", resolution: 0.01, range: [0, 200], accuracy: (r) => 0.005 * r + 0.01 }, toUnit: 100 },
      { key: "w2", label: "ω²", unit: "rad²/s²", from: ["w"], compute: (w) => w * w },
      { key: "y", label: "(F₀/A)²", unit: "N²/m²", from: ["A"], compute: (A) => (5 / (A / 100)) ** 2 },
    ],
    minRows: 6,
    analysis: {
      x: "w2",
      y: "y",
      fit: "quadratico",
      results: [
        { label: "k", unit: "N/m", compute: (c0) => Math.sqrt(Math.abs(c0)), reference: 25 },
        { label: "m", unit: "kg", compute: (_c0, _c1, c2) => Math.sqrt(Math.abs(c2)), reference: 1 },
        { label: "ω₀", unit: "rad/s", compute: (c0, _c1, c2) => Math.sqrt(Math.sqrt(Math.abs(c0)) / Math.sqrt(Math.abs(c2))), reference: 5 },
      ],
    },
    demo: (i) => ({ params: { w: 2 + 2 * i } }),
    questions: [
      "Em que frequência a amplitude foi máxima? Compare com $\\omega_0 = \\sqrt{k/m}$ e com $\\sqrt{\\omega_0^2 - 2\\gamma^2}$.",
      "Estime a largura da curva e o fator de qualidade $Q$. Como $Q$ mudaria se o amortecimento dobrasse?",
      "Por que é preciso esperar antes de registrar cada medida?",
    ],
  },
  {
    id: "exp2-melde",
    course: "Exp II",
    title: "Ondas estacionárias em corda (Melde)",
    sim: "ondas-estacionarias",
    scenario: "modo",
    params: { L: 1, mu: 4 },
    locked: ["L", "mu"],
    objective: "Verificar que a frequência fundamental de uma corda cresce com a raiz da tensão e determinar a densidade linear da corda.",
    materials: ["corda de 1,00 m presa a um vibrador", "gerador de frequência", "polia e porta-pesos (tensão)", "frequencímetro"],
    procedure: `### Procedimento
1. Ajuste a tensão $T$ pendurando massas no porta-pesos.
2. Varie a frequência do vibrador até a corda vibrar no modo fundamental com a maior amplitude e clique em **Registrar medida**.
3. Repita para pelo menos 6 tensões entre 10 N e 150 N.
4. Como $f_1 = \\frac{1}{2L}\\sqrt{T/\\mu}$, o gráfico de $f_1^2$ contra $T$ é uma reta pela origem de inclinação $1/(4L^2\\mu)$.`,
    columns: [
      { key: "T", label: "T", unit: "N", source: { param: "T" }, instrument: { id: "dinamometro-200", name: "Dinamômetro 200 N", unit: "N", kind: "analogico", resolution: 0.5, range: [0, 200] } },
      { key: "f1", label: "f₁", unit: "Hz", source: { observable: "f1" }, instrument: { id: "frequencimetro", name: "Frequencímetro", unit: "Hz", kind: "digital", resolution: 0.1, range: [0, 10000], accuracy: (r) => 2e-3 * r + 0.1 } },
      { key: "f2", label: "f₁²", unit: "Hz²", from: ["f1"], compute: (f) => f * f },
    ],
    minRows: 5,
    analysis: {
      x: "T",
      y: "f2",
      fit: "proporcional",
      results: [{ label: "μ", unit: "g/m", compute: (b) => 1000 / (4 * b), reference: 4 }],
    },
    demo: (i) => ({ params: { T: 15 + 25 * i } }),
    questions: [
      "O valor de μ obtido é compatível com a massa e o comprimento da corda (4 g/m)?",
      "Mantida a tensão, que frequências produzem 2 e 3 ventres? E se a corda fosse quatro vezes mais densa?",
      "Por que a amplitude fica grande só em certas frequências?",
    ],
  },
  {
    id: "exp2-calor-especifico",
    course: "Exp II",
    title: "Calor específico (calorímetro)",
    sim: "calorimetria",
    scenario: "metal",
    params: { modo: 1, corpo: 2, ma: 0.2, Ta: 20, Ccal: 80, Tb: 100, k: 10, kamb: 0, ritmo: 20 },
    locked: ["modo", "corpo", "ma", "Ta", "Ccal", "Tb", "kamb"],
    objective: "Determinar o calor específico do alumínio pelo método das misturas.",
    materials: ["calorímetro (C = 80 J/K) com 200 g de água a 20 °C", "amostras de alumínio aquecidas em banho de água fervente (100 °C)", "balança", "termômetro digital"],
    procedure: `### Procedimento
1. Escolha a massa da amostra de alumínio e pese-a.
2. Transfira a amostra a 100 °C para o calorímetro e rode até a temperatura estabilizar.
3. Clique em **Registrar medida** para ler a temperatura de equilíbrio $T_e$.
4. Repita para pelo menos 6 massas diferentes.
5. O calor cedido pela amostra é o recebido pela água e pelo recipiente:
$$m_b c\\,(T_b - T_e) = (m_a c_a + C)(T_e - T_a)$$
O gráfico de $(m_a c_a + C)(T_e - T_a)$ contra $m_b(T_b - T_e)$ é uma reta pela origem de inclinação $c$.`,
    columns: [
      { key: "mb", label: "m_b", unit: "g", source: { param: "mb" }, instrument: "balanca", toUnit: 1000 },
      { key: "Te", label: "T_e", unit: "°C", source: { observable: "T" }, instrument: "termopar" },
      { key: "x", label: "m_b(T_b − T_e)", unit: "kg·K", from: ["mb", "Te"], compute: (mb, Te) => (mb / 1000) * (100 - Te) },
      { key: "y", label: "Q_água+cal", unit: "J", from: ["Te"], compute: (Te) => (0.2 * 4186 + 80) * (Te - 20) },
    ],
    minRows: 5,
    analysis: {
      x: "x",
      y: "y",
      fit: "proporcional",
      results: [{ label: "c (alumínio)", unit: "J/(kg·K)", compute: (b) => b, reference: 900 }],
    },
    demo: (i) => ({ params: { mb: 0.1 + 0.06 * i }, t: 25 }),
    questions: [
      "O calor específico obtido é compatível com o tabelado (900 J/kg·K)?",
      "Que efeito teria ignorar a capacidade térmica do recipiente? Calcule a diferença no seu resultado.",
      "Por que amostras maiores dão resultados mais precisos com o mesmo termômetro?",
    ],
  },
  {
    id: "exp2-boyle",
    course: "Exp II",
    title: "Lei de Boyle",
    sim: "processos-pv",
    scenario: "isotermica",
    params: { processo: 0, n: 1, P0: 100, V0: 25 },
    locked: ["processo", "n", "P0", "V0"],
    objective: "Verificar que, a temperatura constante, a pressão de um gás é inversamente proporcional ao volume e obter o produto $nRT$.",
    materials: ["seringa de gás com êmbolo graduado", "manômetro", "banho térmico (mantém a temperatura constante)"],
    procedure: `### Procedimento
1. Comprima ou expanda lentamente o gás até o volume escolhido (a compressão lenta mantém a temperatura constante).
2. Clique em **Registrar medida** para ler a pressão no manômetro.
3. Repita para pelo menos 6 volumes entre 10 L e 60 L.
4. Pela lei de Boyle, $PV = nRT$ é constante: o gráfico de $P$ contra $1/V$ é uma reta pela origem de inclinação $nRT$.`,
    columns: [
      { key: "V", label: "V", unit: "L", source: { observable: "V" }, instrument: { id: "seringa", name: "Escala da seringa", unit: "L", kind: "analogico", resolution: 0.5, range: [0, 120] } },
      { key: "P", label: "P", unit: "kPa", source: { observable: "P" }, instrument: "manometro" },
      { key: "iv", label: "1/V", unit: "1/L", from: ["V"], compute: (V) => 1 / V },
    ],
    minRows: 5,
    analysis: {
      x: "iv",
      y: "P",
      fit: "proporcional",
      results: [
        { label: "nRT", unit: "J", compute: (b) => b, reference: 2500 },
        { label: "T", unit: "K", compute: (b) => b / 8.314, reference: 300.7 },
      ],
    },
    demo: (i) => ({ params: { Vf: 12 + 8 * i } }),
    questions: [
      "O produto $PV$ ficou constante dentro das incertezas? Em que faixa de volume ele mais se desvia?",
      "Por que a compressão precisa ser lenta? O que aconteceria se fosse rápida?",
      "Qual seria o gráfico se o gás estivesse a uma temperatura maior?",
    ],
  },
  {
    id: "exp3-rede",
    course: "Exp III",
    title: "Difração e rede",
    sim: "difracao",
    scenario: "rede",
    params: { modo: 1, fonte: 0, lambda: 633, N: 200 },
    locked: ["modo", "fonte", "lambda"],
    objective: "Determinar o comprimento de onda de um laser medindo o ângulo de primeira ordem com redes de difração de densidades diferentes.",
    materials: ["laser de He-Ne", "redes de difração de 20 a 600 linhas/mm", "goniômetro com nônio de 1′", "anteparo"],
    procedure: `### Procedimento
1. Escolha uma rede (período $d$) e alinhe o laser perpendicular a ela.
2. Gire o goniômetro até a mancha de primeira ordem e clique em **Registrar medida**.
3. Repita para pelo menos 6 redes diferentes.
4. Pela equação da rede, $d\\sin\\theta_1 = \\lambda$: o gráfico de $\\sin\\theta_1$ contra $1/d$ (linhas por mm) é uma reta pela origem de inclinação $\\lambda$.`,
    columns: [
      { key: "d", label: "d", unit: "µm", source: { param: "d" }, instrument: { id: "rotulo-rede", name: "Especificação da rede", unit: "µm", kind: "digital", resolution: 0.01, range: [0, 100], accuracy: (r) => 0.002 * r } },
      { key: "th", label: "θ₁", unit: "°", source: { observable: "ord1" }, instrument: { id: "goniometro-nonio", name: "Goniômetro com nônio (1′)", unit: "°", kind: "nonio", resolution: 1 / 60, range: [0, 360] } },
      { key: "n", label: "1/d", unit: "linhas/mm", from: ["d"], compute: (d) => 1000 / d },
      { key: "s", label: "sen θ₁", unit: "", from: ["th"], compute: (th) => Math.sin(rad(th)) },
    ],
    minRows: 5,
    analysis: {
      x: "n",
      y: "s",
      fit: "proporcional",
      results: [{ label: "λ", unit: "nm", compute: (b) => b * 1e6, reference: 633 }],
    },
    demo: (i) => ({ params: { d: [1.67, 2, 3.33, 5, 10, 20][i] ?? 5 } }),
    questions: [
      "O comprimento de onda obtido é compatível com 632,8 nm do He-Ne?",
      "Por que a rede de 600 linhas/mm dá uma medida mais precisa que a de 20 linhas/mm com o mesmo goniômetro?",
      "Quantas ordens são visíveis com a rede de 600 linhas/mm? Justifique.",
    ],
  },
  {
    id: "exp3-fotoeletrico",
    course: "Exp III",
    title: "Efeito fotoelétrico",
    sim: "fotoeletrico",
    scenario: "corte",
    params: { metal: 2, P: 1, dados: 0 },
    locked: ["metal", "dados"],
    objective: "Medir o potencial de corte para vários comprimentos de onda e determinar a constante de Planck e a função trabalho do catodo.",
    materials: ["célula fotoelétrica com catodo de sódio", "lâmpada de mercúrio com monocromador", "fonte de tensão reversa ajustável", "voltímetro", "picoamperímetro"],
    procedure: `### Procedimento
1. Escolha o comprimento de onda no monocromador.
2. Aumente a tensão reversa (V negativo) até a corrente cair a **zero** e clique em **Registrar medida**: o potencial de corte é $V_0 = -V$.
3. Repita para pelo menos 6 comprimentos de onda abaixo do limiar.
4. Pela equação de Einstein, $eV_0 = hf - \\phi$: o gráfico de $V_0$ contra $f$ é uma reta de inclinação $h/e$ e intercepto $-\\phi/e$.`,
    columns: [
      { key: "lam", label: "λ", unit: "nm", source: { param: "lambda" }, instrument: { id: "monocromador", name: "Monocromador", unit: "nm", kind: "analogico", resolution: 1, range: [100, 900] } },
      { key: "V", label: "V", unit: "V", source: { param: "V" }, instrument: "voltimetro" },
      { key: "I", label: "I", unit: "µA", source: { observable: "I" }, instrument: { id: "picoamperimetro", name: "Picoamperímetro", unit: "µA", kind: "digital", resolution: 0.001, range: [-100, 100] } },
      { key: "f", label: "f", unit: "10¹⁴ Hz", from: ["lam"], compute: (l) => 2997.92458 / l },
      { key: "V0", label: "V₀", unit: "V", from: ["V"], compute: (v) => -v },
    ],
    minRows: 5,
    analysis: {
      x: "f",
      y: "V0",
      fit: "linear",
      results: [
        { label: "h", unit: "10⁻³⁴ J·s", compute: (_a, b) => b * 16.02176634, reference: 6.626 },
        { label: "φ", unit: "eV", compute: (a) => -a, reference: 2.36 },
      ],
    },
    demo: (i) => {
      const lambda = 250 + 45 * i;
      return { params: { lambda, V: -(1239.84198 / lambda - 2.36) } };
    },
    questions: [
      "O valor de h obtido é compatível com 6,626 × 10⁻³⁴ J·s?",
      "Qual é o comprimento de onda de corte do sódio? Por que luz vermelha intensa não arranca elétrons?",
      "Dobrar a intensidade da luz muda o potencial de corte? E a corrente de saturação?",
    ],
  },
  {
    id: "exp3-refracao",
    course: "Exp III",
    title: "Reflexão e refração",
    sim: "refracao",
    scenario: "snell",
    params: { modo: 0, n1: 1, n2: 1.5, pol: 0 },
    locked: ["modo", "n1", "n2", "pol"],
    objective: "Verificar a lei de Snell e determinar o índice de refração de um semicilindro de acrílico.",
    materials: ["laser", "semicilindro de acrílico sobre disco graduado"],
    procedure: `### Procedimento
1. Gire o laser para um ângulo de incidência $\\theta_1$ e leia o ângulo de refração $\\theta_2$ no disco graduado.
2. Clique em **Registrar medida**.
3. Repita para pelo menos 6 ângulos entre 10° e 80°.
4. Pela lei de Snell, $\\sin\\theta_2 = (n_1/n_2)\\sin\\theta_1$: o gráfico de $\\sin\\theta_2$ contra $\\sin\\theta_1$ é uma reta pela origem de inclinação $1/n$.
5. Confira também que o ângulo de reflexão é igual ao de incidência.`,
    columns: [
      { key: "t1", label: "θ₁", unit: "°", source: { observable: "th1" }, instrument: "goniometro" },
      { key: "t2", label: "θ₂", unit: "°", source: { observable: "th2" }, instrument: { id: "disco-graduado", name: "Disco graduado (0,5°)", unit: "°", kind: "analogico", resolution: 0.5, range: [0, 360] } },
      { key: "s1", label: "sen θ₁", unit: "", from: ["t1"], compute: (t) => Math.sin(rad(t)) },
      { key: "s2", label: "sen θ₂", unit: "", from: ["t2"], compute: (t) => Math.sin(rad(t)) },
    ],
    minRows: 5,
    analysis: {
      x: "s1",
      y: "s2",
      fit: "proporcional",
      results: [{ label: "n do acrílico", unit: "", compute: (b) => 1 / b, reference: 1.5 }],
    },
    demo: (i) => ({ params: { theta: 12 + 13 * i } }),
    questions: [
      "O índice obtido é compatível com o do acrílico (cerca de 1,49)?",
      "Invertendo o semicilindro (luz saindo do acrílico), a partir de que ângulo o feixe refratado some? Compare com $\\arcsin(1/n)$.",
      "Por que a incerteza relativa de $\\theta_2$ é maior nos ângulos pequenos?",
    ],
  },
  {
    id: "exp3-lentes",
    course: "Exp III",
    title: "Lentes e bancada ótica",
    sim: "lentes",
    scenario: "lente",
    params: { montagem: 0 },
    locked: ["montagem"],
    objective: "Determinar a distância focal de uma lente convergente pelo método de Gauss (conjugação objeto–imagem).",
    materials: ["banco ótico", "objeto luminoso", "lente convergente", "anteparo", "trena"],
    procedure: `### Procedimento
1. Arraste o objeto para uma posição no banco e meça a distância $p$ até a lente.
2. Mova o anteparo até a imagem ficar nítida e meça a distância $p'$ até a lente. Clique em **Registrar medida**.
3. Repita para pelo menos 6 posições do objeto, todas além do foco.
4. Pela equação de Gauss, $\\frac1{p'} = \\frac1f - \\frac1p$: o gráfico de $1/p'$ contra $1/p$ é uma reta de inclinação $-1$ e intercepto $1/f$.`,
    columns: [
      { key: "p", label: "p", unit: "cm", source: { observable: "p" }, instrument: { id: "trena-banco", name: "Escala do banco ótico", unit: "cm", kind: "analogico", resolution: 0.1, range: [0, 200] }, toUnit: 100 },
      { key: "q", label: "p′", unit: "cm", source: { observable: "q" }, instrument: { id: "trena-banco", name: "Escala do banco ótico", unit: "cm", kind: "analogico", resolution: 0.1, range: [0, 200] }, toUnit: 100 },
      { key: "ip", label: "1/p", unit: "1/m", from: ["p"], compute: (p) => 100 / p },
      { key: "iq", label: "1/p′", unit: "1/m", from: ["q"], compute: (q) => 100 / q },
    ],
    minRows: 5,
    analysis: {
      x: "ip",
      y: "iq",
      fit: "linear",
      results: [
        { label: "f", unit: "cm", compute: (a) => 100 / a, reference: 10 },
        { label: "inclinação", unit: "", compute: (_a, b) => b, reference: -1 },
      ],
    },
    demo: (i) => ({ drag: { from: ["ox", "oy"], to: [-(0.14 + 0.05 * i), 0.015] } }),
    questions: [
      "A inclinação ficou compatível com −1? O que isso confirma sobre o modelo de lente delgada?",
      "O que acontece com a imagem quando o objeto se aproxima do foco? E quando fica entre o foco e a lente?",
      "Compare o aumento medido $-p'/p$ com a razão entre as alturas da imagem e do objeto.",
    ],
  },
  {
    id: "exp3-malus",
    course: "Exp III",
    title: "Polarização (Malus)",
    sim: "polarizacao",
    scenario: "malus",
    params: { modo: 0, fonte: 0, lamina: 0, an: 1, p1: 0, I0: 1000, amb: 20, curva: 0 },
    locked: ["modo", "fonte", "lamina", "an", "p1", "I0", "curva"],
    objective: "Verificar a lei de Malus e separar o sinal polarizado da luz de fundo.",
    materials: ["laser de He-Ne polarizado", "polarizador e analisador com disco graduado", "fotodiodo ligado a multímetro (mV)"],
    procedure: `### Procedimento
1. Bloqueie o feixe e anote a leitura de fundo (luz ambiente + sinal de escuro).
2. Gire o analisador para um ângulo $\\theta$ em relação ao polarizador e clique em **Registrar medida**.
3. Repita de 0° a 90° em passos de 10°.
4. Pela lei de Malus, $V = I_0\\cos^2\\theta + V_{fundo}$: o gráfico de $V$ contra $\\cos^2\\theta$ é uma reta de inclinação $I_0$ e intercepto igual ao fundo.
5. Depois, coloque um terceiro polarizador entre os dois cruzados e veja a luz voltar.`,
    columns: [
      { key: "th", label: "θ", unit: "°", source: { observable: "theta" }, instrument: "goniometro" },
      { key: "V", label: "V", unit: "mV", source: { observable: "V" }, instrument: { id: "fotodiodo", name: "Fotodiodo + multímetro (mV)", unit: "mV", kind: "digital", resolution: 0.1, range: [0, 2000], accuracy: dmmAccuracy(0.5, 2, 0.1) } },
      { key: "c2", label: "cos²θ", unit: "", from: ["th"], compute: (t) => Math.cos(rad(t)) ** 2 },
    ],
    minRows: 6,
    analysis: {
      x: "c2",
      y: "V",
      fit: "linear",
      results: [
        { label: "I₀", unit: "mV", compute: (_a, b) => b, reference: 1000 },
        { label: "fundo", unit: "mV", compute: (a) => a, reference: 21.5 },
      ],
    },
    demo: (i) => ({ params: { theta: 10 + 15 * i }, t: 0 }),
    questions: [
      "O intercepto do ajuste confere com a leitura com o feixe bloqueado?",
      "Com três polarizadores (0°, θ, 90°), que ângulo do intermediário maximiza a luz? Quanto passa?",
      "Por que a luz de uma lâmpada comum perde metade da intensidade no primeiro polarizador?",
    ],
  },
  {
    id: "exp3-espectroscopia",
    course: "Exp III",
    title: "Espectroscopia",
    sim: "espectroscopia",
    scenario: "balmer",
    params: { modo: 0, lampada: 0, N: 600, fenda: 50, mapa: 0 },
    locked: ["modo", "lampada", "N", "mapa"],
    objective: "Medir os comprimentos de onda das linhas visíveis do hidrogênio com um espectroscópio de rede e determinar a constante de Rydberg.",
    materials: ["goniômetro-espectroscópio com nônio de 1′", "rede de 600 linhas/mm", "lâmpada de hidrogênio"],
    procedure: `### Procedimento
1. Gire a luneta até o retículo coincidir com uma linha do espectro e leia o ângulo $\\varphi$ no nônio.
2. Identifique a linha pela cor (vermelha $n = 3$, azul-esverdeada $n = 4$, violeta $n = 5$ e $n = 6$) e clique em **Registrar medida**.
3. Meça cada linha nas ordens $+1$ e $-1$ (a média elimina erros de alinhamento).
4. Pela equação da rede, $\\lambda = d\\sin\\varphi/m$ com $d = 1/600$ mm.
5. Pela série de Balmer, $\\frac{1}{\\lambda} = R_H\\left(\\frac14 - \\frac1{n^2}\\right)$: o gráfico de $1/\\lambda$ contra $\\frac14 - \\frac1{n^2}$ é uma reta pela origem de inclinação $R_H$.`,
    columns: [
      { key: "phi", label: "φ", unit: "°", source: { observable: "phi" }, instrument: { id: "goniometro-nonio", name: "Goniômetro com nônio (1′)", unit: "°", kind: "nonio", resolution: 1 / 60, range: [-180, 360] } },
      { key: "m", label: "m", unit: "", source: { observable: "ordem" }, instrument: { id: "ordem", name: "Ordem (contagem)", unit: "", kind: "digital", resolution: 1, range: [-5, 5] } },
      { key: "n", label: "n", unit: "", source: { observable: "nsup" }, instrument: { id: "nivel", name: "Identificação da linha", unit: "", kind: "digital", resolution: 1, range: [0, 20] } },
      { key: "il", label: "1/λ", unit: "µm⁻¹", from: ["phi", "m"], compute: (phi, m) => (m * 1000) / ((1e6 / 600) * Math.sin(rad(phi))) },
      { key: "x", label: "1/4 − 1/n²", unit: "", from: ["n"], compute: (n) => 0.25 - 1 / (n * n) },
    ],
    minRows: 6,
    analysis: {
      x: "x",
      y: "il",
      fit: "proporcional",
      results: [{ label: "R_H", unit: "10⁷ m⁻¹", compute: (b) => b / 10, reference: 1.0968 }],
    },
    demo: (i) => {
      const lines = [656.28, 486.13, 434.05, 410.17];
      const lam = lines[i % 4]!;
      const m = i < 4 ? 1 : -1;
      return { params: { phi: (Math.asin(m * lam * 600e-6) * 180) / Math.PI }, t: 0 };
    },
    questions: [
      "A constante de Rydberg obtida é compatível com $1{,}0968 \\times 10^7$ m⁻¹?",
      "Por que medir nas ordens $+1$ e $-1$? Que erro sistemático isso elimina?",
      "Qual seria o ângulo da linha $H_\\alpha$ em segunda ordem? Ela aparece com esta rede?",
    ],
  },
];

export const findPractice = (id: string) => practices.find((p) => p.id === id);

// Práticas extras, além do plano original: um arquivo por prática em practices-extra/.
const extras = Object.values(import.meta.glob<{ practice: Practice }>("./practices-extra/*.ts", { eager: true }))
  .map((m) => ({ ...m.practice, extra: true }))
  .sort((a, b) => a.course.localeCompare(b.course) || a.title.localeCompare(b.title, "pt"));

export const practices: Practice[] = [...planned, ...extras];
