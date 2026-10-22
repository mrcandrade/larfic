import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 9,
  intro: String.raw`Até aqui tratamos cada corpo como uma partícula. Mas um taco de beisebol girando no ar, um projétil que explode ou dois carros que colidem são **sistemas de partículas**. Este capítulo mostra que existe um ponto especial, o **centro de massa**, que se move como se toda a massa estivesse concentrada nele e todas as forças externas agissem ali. Em seguida introduz o **momento linear** $\vec p = m\vec v$, cuja conservação, na ausência de forças externas, é tão útil quanto a conservação da energia. Com essas duas ferramentas analisamos colisões em uma e duas dimensões e, no fim, um sistema cuja massa muda com o tempo: o foguete.`,
  sections: {
    "9-2": {
      text: String.raw`O **centro de massa** (CM) de um sistema é a posição média das partículas, ponderada pelas massas.

### Partículas
Para $n$ partículas de massa total $M$:
$$\vec r_{CM} = \frac{1}{M}\sum_{i=1}^{n} m_i \vec r_i ,$$
ou, por componente, $x_{CM} = \sum m_i x_i / M$ e o mesmo para $y$ e $z$. Para duas partículas, o CM fica na reta que as une, mais perto da mais pesada.

### Corpos extensos
Para um corpo contínuo, a soma vira integral: $x_{CM} = \frac{1}{M}\int x\,dm$. Se a densidade é uniforme, $dm = (M/V)\,dV$ e o CM coincide com o **centroide** geométrico. Três atalhos ajudam muito:
- se o corpo tem um elemento de simetria (ponto, reta ou plano), o CM está sobre ele;
- um corpo composto pode ser tratado como partículas localizadas nos CMs das partes;
- um furo pode ser tratado como uma "massa negativa".

### O CM pode estar fora do corpo
Num anel, num bumerangue ou numa ferradura, o CM fica no espaço vazio.

**Exemplo.** Uma placa quadrada uniforme de 40 cm de lado e 2,0 kg, com origem num canto, tem CM em $(20, 20)$ cm. Recorte um quadrado de 20 cm de lado no canto superior direito (massa 0,5 kg, CM em $(30, 30)$ cm). Para a placa restante, $x_{CM} = (2{,}0 \cdot 20 - 0{,}5 \cdot 30)/1{,}5 \approx 16{,}7$ cm, e o mesmo para $y$: o CM se afasta do recorte.

### Determinação experimental
Pendure a placa por um ponto: em equilíbrio, o CM fica na vertical abaixo do ponto de suspensão. Repita com outro ponto: o CM está no cruzamento das duas verticais (fios de prumo).

**Armadilha:** supor que o CM está sempre "no meio" do objeto, ou sempre dentro dele.

No experimento, arraste partículas e veja o CM se deslocar; depois recorte a placa célula a célula e confirme o CM pendurando-a por dois pontos diferentes.`,
      experiments: [
        { kind: "sim", id: "centro-massa", scenario: "particulas", note: "Arraste partículas de massas diferentes e preveja onde fica o centro de massa." },
        { kind: "sim", id: "centro-massa", scenario: "recortar", note: "Recorte a placa e veja o CM se afastar do recorte, até sair da placa." },
        { kind: "sim", id: "centro-massa", scenario: "pendurar", note: "Pendure a placa por dois pontos e ache o CM no cruzamento das verticais." },
      ],
    },
    "9-3": {
      text: String.raw`Derivando duas vezes a definição de $\vec r_{CM}$ e somando a segunda lei para cada partícula, as forças internas (entre partículas do sistema) se cancelam aos pares pela terceira lei. Sobra apenas
$$\vec F_{\text{res,ext}} = M\,\vec a_{CM} .$$
O centro de massa de um sistema se move como uma partícula de massa $M$ sujeita à soma das forças **externas**, por mais complicado que seja o movimento das partes.

### Consequências
- Se a força externa resultante é nula, o CM fica em repouso ou se move em linha reta com velocidade constante, mesmo que as partes girem, vibrem ou se separem.
- Um projétil que explode em voo: as forças da explosão são internas. Desprezando o ar, o CM dos fragmentos continua na mesma parábola, até o primeiro fragmento tocar o chão (aí aparece uma nova força externa).
- Um saltador ornamental gira e se estica no ar, mas seu CM descreve uma parábola.

**Exemplo.** Um projétil de 12 kg é lançado e, no ponto mais alto, a 80 m do lançador, explode em dois pedaços de 6 kg. Um deles cai verticalmente, chegando ao chão a 80 m do lançador. Se, sem a explosão, o projétil teria caído a 160 m, o CM dos pedaços ainda chega a 160 m (ambos tocam o chão ao mesmo tempo, pois partem da mesma altura com velocidade vertical nula). O segundo pedaço cai em $x$ tal que $(6 \cdot 80 + 6x)/12 = 160$, ou seja, $x = 240$ m.

### Quem move um carro?
Um carro só acelera porque uma força **externa** age sobre ele: o atrito do chão nos pneus. O motor gira as rodas, mas sozinho não poderia acelerar o CM do carro sobre gelo perfeito.

**Armadilha:** pensar que forças internas (explosão, músculos, motor) mudam o movimento do CM.

No experimento, faça o projétil explodir em instantes e direções diferentes e verifique que o centro de massa dos fragmentos continua sobre a parábola original.`,
      experiments: [
        { kind: "sim", id: "centro-massa", scenario: "explosao", note: "Mude o instante e a direção da explosão e veja o CM dos fragmentos seguir a parábola original." },
      ],
    },
    "9-4": {
      text: String.raw`O **momento linear** (ou quantidade de movimento) de uma partícula é
$$\vec p = m\vec v .$$
É um vetor com a direção e o sentido da velocidade; a unidade SI é kg·m/s.

### A segunda lei em termos de momento
Newton formulou a segunda lei assim: a taxa de variação do momento de uma partícula é igual à força resultante sobre ela,
$$\vec F_{\text{res}} = \frac{d\vec p}{dt} .$$
Para massa constante, isso se reduz a $m\vec a$. A forma com $\vec p$ é mais geral e continua válida na relatividade (com outra expressão para $\vec p$) e serve de ponto de partida para os sistemas de massa variável da seção 9-12.

### Momento × energia cinética
As duas grandezas dependem de $m$ e $v$, mas são diferentes:
- $\vec p$ é vetor e é linear em $v$; $K$ é escalar e quadrática.
- A relação entre elas é $K = p^2/(2m)$: com o mesmo momento, o corpo mais leve tem mais energia cinética.

**Exemplo.** Uma bola de tênis de 58 g a 50 m/s e uma bola de futebol de 430 g a 7 m/s têm momentos de $2{,}9$ e $3{,}0$ kg·m/s, praticamente iguais. As energias cinéticas, porém, são 72 J e 10,5 J: a bola de tênis carrega quase sete vezes mais energia.

### Por que o momento é útil
A força média necessária para parar um corpo num intervalo $\Delta t$ é $\Delta p/\Delta t$. Um caminhão lento e um carro rápido com o mesmo momento exigem a mesma força para parar no mesmo tempo.

**Armadilha:** associar o momento a um "ímpeto" que se esgota sozinho. O momento só muda se houver força resultante; sem ela, o corpo segue indefinidamente.

No experimento, meça a velocidade de cada carrinho nas fotoportas antes e depois da colisão e calcule $p = mv$ de cada um, com sinal.`,
      experiments: [
        { kind: "sim", id: "trilho-de-ar", scenario: "elastica", note: "Meça as velocidades nas fotoportas e calcule o momento de cada carrinho, com sinal." },
        { kind: "concepcao", id: "impeto", note: "Confronte a ideia de um ímpeto que se gasta sem que nenhuma força atue." },
      ],
    },
    "9-5": {
      text: String.raw`O momento total de um sistema é a soma vetorial dos momentos das partículas:
$$\vec P = \sum_i \vec p_i = \sum_i m_i \vec v_i .$$
Derivando a definição do centro de massa, $\sum m_i \vec v_i = M\vec v_{CM}$, então
$$\vec P = M\,\vec v_{CM} .$$
O momento total é o de uma única partícula de massa $M$ movendo-se com o CM. Combinando com a seção 9-3,
$$\vec F_{\text{res,ext}} = \frac{d\vec P}{dt} .$$

### O referencial do centro de massa
No referencial que acompanha o CM, $\vec v_{CM}' = 0$ e o momento total é **zero**: as partículas sempre têm momentos que se cancelam. Esse referencial simplifica muito a análise de colisões (seção 9-8): antes do choque os dois corpos se aproximam com momentos opostos; depois, se afastam com momentos opostos.

**Exemplo.** Um carrinho de 2 kg a +3 m/s e outro de 1 kg a −1,5 m/s: $P = 6 - 1{,}5 = 4{,}5$ kg·m/s e $v_{CM} = 4{,}5/3 = 1{,}5$ m/s. No referencial do CM, as velocidades são $+1{,}5$ e $-3$ m/s, e os momentos, $+3$ e $-3$ kg·m/s, somando zero.

### Energia cinética do sistema
A energia cinética total se separa em duas partes: a do movimento do CM, $\tfrac12 M v_{CM}^2$, e a do movimento **relativo** ao CM. Só a segunda pode ser convertida em outras formas numa colisão, porque a primeira está presa ao momento total, que se conserva.

**Armadilha:** somar os módulos dos momentos. O momento total é uma soma **vetorial**: dois corpos idênticos com velocidades opostas têm momento total zero.

No experimento, alterne entre o referencial do laboratório e o do centro de massa e confira que, no segundo, o momento total é sempre nulo.`,
      experiments: [
        { kind: "sim", id: "colisoes", scenario: "cm", note: "Alterne para o referencial do CM e veja os momentos dos dois carrinhos se cancelarem." },
        { kind: "sim", id: "centro-massa", scenario: "particulas", note: "Relacione a posição do CM com a média ponderada pelas massas antes de pensar em velocidades." },
      ],
    },
    "9-6": {
      text: String.raw`Numa colisão, os corpos interagem por um intervalo curto $\Delta t$ com forças intensas e variáveis, $\vec F(t)$. Integrando $\vec F = d\vec p/dt$ ao longo desse intervalo,
$$\vec J = \int_{t_i}^{t_f} \vec F(t)\,dt = \Delta\vec p .$$
A integral $\vec J$ é o **impulso** da força, e o resultado é o **teorema do impulso e momento linear**: o impulso é igual à variação do momento.

### Força média
Geometricamente, $J$ é a área sob o gráfico $F(t)$. A **força média** é a força constante que, no mesmo intervalo, daria o mesmo impulso: $F_{\text{méd}} = J/\Delta t$. Para o mesmo $\Delta p$, aumentar $\Delta t$ diminui a força média. É o princípio do air bag, do capacete, da luva de goleiro e de dobrar os joelhos ao saltar.

**Exemplo.** Uma bola de futebol de 0,43 kg chega a 12 m/s e é chutada de volta a 20 m/s, com contato de 8 ms. $\Delta p = 0{,}43 \cdot (20 - (-12)) \approx 13{,}8$ kg·m/s, e a força média vale $13{,}8/0{,}008 \approx 1{,}7$ kN, cerca de 400 vezes o peso da bola. Se a bola apenas parasse, o impulso seria menos da metade: ricochetear exige mais impulso do que parar.

### Série de colisões
Um fluxo de projéteis (granizo num telhado, água de uma mangueira numa parede) gera uma força média contínua: se $n$ corpos de massa $m$ batem por unidade de tempo e cada um sofre $\Delta v$, então $F_{\text{méd}} = n\,m\,\Delta v$.

**Armadilha:** achar que um corpo que bate e volta sofre a mesma força que um corpo que bate e para. O $\Delta v$ do ricochete é maior.

No experimento, compare as velocidades de cada carrinho antes e depois e calcule a variação de momento de cada um: os impulsos são iguais e opostos. Varie o coeficiente de restituição para ver o impulso crescer quando o choque fica mais elástico.`,
      experiments: [
        { kind: "sim", id: "colisoes", scenario: "troca", note: "Calcule Δp de cada carrinho: os impulsos recebidos são iguais e opostos." },
        { kind: "sim", id: "trilho-de-ar", scenario: "elastica", note: "Meça o impulso que cada carrinho recebe da mola de choque a partir das velocidades nas fotoportas." },
        { kind: "concepcao", id: "terceira-lei-massas", note: "Na colisão, o corpo pesado e o leve recebem impulsos de mesmo módulo." },
      ],
    },
    "9-7": {
      text: String.raw`Se a força externa resultante sobre um sistema é nula, a seção 9-5 dá $d\vec P/dt = 0$:
$$\vec P = \text{constante}, \qquad \vec P_i = \vec P_f .$$
Essa é a **lei de conservação do momento linear**. Ela vale para sistemas **fechados** (sem troca de matéria) e **isolados** (força externa resultante nula), qualquer que seja a natureza das forças internas: elásticas, de atrito, explosivas.

### Por componente
A lei vale separadamente para cada eixo. Se só a componente horizontal da força externa é nula (um projétil sob a gravidade), conserva-se apenas $P_x$.

### Situações típicas
- **Recuo:** um canhão em repouso dispara uma bala. Antes, $P = 0$; depois, $m_b v_b + M_c V_c = 0$, então o canhão recua com $V_c = -m_b v_b/M_c$.
- **Explosões:** fragmentos de um corpo em repouso têm momentos que somam zero.
- **Colisões:** durante o choque, as forças internas são tão maiores que as externas (peso, atrito) que estas podem ser desprezadas; o momento se conserva "imediatamente antes e depois".

**Exemplo.** Um patinador de 70 kg, parado no gelo, arremessa uma mochila de 5 kg a 8 m/s. Ele recua com $V = -5 \cdot 8/70 \approx -0{,}57$ m/s. Energia: a mochila sai com 160 J e o patinador com 11 J, energia que veio dos músculos. O momento se conservou; a energia cinética, não (ela aumentou às custas da energia química).

**Armadilha:** concluir que, se o momento se conserva, a energia cinética também se conserva. São leis independentes: a do momento vale sempre que o sistema está isolado; a energia cinética pode crescer (explosão) ou diminuir (choque inelástico).

No experimento, provoque uma colisão inelástica no trilho e confira $P$ antes e depois; depois, faça o projétil explodir e verifique que o momento horizontal total dos fragmentos é o do projétil inteiro.`,
      experiments: [
        { kind: "sim", id: "trilho-de-ar", scenario: "inelastica", note: "Compare o momento total antes e depois da colisão com velcro." },
        { kind: "sim", id: "centro-massa", scenario: "explosao", note: "Na explosão, o momento total dos fragmentos é o do projétil inteiro." },
        { kind: "pratica", id: "exp1-colisoes", note: "Roteiro de bancada para verificar a conservação do momento no trilho de ar." },
      ],
    },
    "9-8": {
      text: String.raw`Num sistema isolado, toda colisão conserva o momento total. A energia cinética é outra história, e serve para classificar os choques:
- **Elástica:** a energia cinética total também se conserva (bolas de bilhar, átomos de gás, aproximadamente).
- **Inelástica:** parte da energia cinética vira energia térmica, som, deformação permanente.
- **Perfeitamente inelástica:** os corpos ficam unidos depois do choque; é a maior perda compatível com a conservação do momento.

### Coeficiente de restituição
Em uma dimensão, a medida usual é
$$e = \frac{|v_2' - v_1'|}{|v_1 - v_2|} ,$$
a razão entre a velocidade relativa de afastamento e a de aproximação: $e = 1$ (elástica), $0 < e < 1$ (inelástica), $e = 0$ (perfeitamente inelástica).

### Qual energia pode ser perdida
Pela seção 9-5, $K = \tfrac12 M v_{CM}^2 + K_{\text{rel}}$. Como $\vec P = M\vec v_{CM}$ se conserva, a parcela do CM não muda; só $K_{\text{rel}}$ pode ser dissipada. No choque perfeitamente inelástico, toda $K_{\text{rel}}$ desaparece.

**Exemplo.** Uma bola de borracha cai de 1,0 m e volta a 0,64 m. Velocidades de chegada e saída: $\sqrt{2g \cdot 1{,}0}$ e $\sqrt{2g \cdot 0{,}64}$, então $e = \sqrt{0{,}64} = 0{,}8$. A cada quique, a bola perde $1 - e^2 = 36\%$ da energia cinética. (A Terra recebe o momento que falta, mas, com massa enorme, quase não ganha energia.)

**Armadilha:** dizer que "no choque inelástico o momento não se conserva". O momento se conserva em qualquer colisão de um sistema isolado; o que muda de um tipo para outro é a energia cinética.

No experimento, mantenha massas e velocidades fixas e varie o coeficiente de restituição de 1 a 0: acompanhe na tabela que o momento total não muda e a energia cinética final cai.`,
      experiments: [
        { kind: "sim", id: "colisoes", scenario: "troca", params: { e: 0.5 }, note: "Varie o coeficiente de restituição e veja o momento total ficar constante enquanto a energia cinética cai." },
        { kind: "sim", id: "colisoes", scenario: "cm", note: "No referencial do CM, veja que só a energia do movimento relativo pode ser dissipada." },
      ],
    },
    "9-9": {
      text: String.raw`### Perfeitamente inelástica, alvo parado
Um corpo $m_1$ com velocidade $v_{1i}$ atinge $m_2$ em repouso e os dois seguem juntos com velocidade $V$. Só a conservação do momento é necessária:
$$m_1 v_{1i} = (m_1 + m_2)V \;\Rightarrow\; V = \frac{m_1}{m_1 + m_2}\,v_{1i} .$$
A velocidade final é sempre menor que a inicial, e $V = v_{CM}$, que não muda durante a colisão.

### Fração de energia perdida
Com o alvo parado, $K_f/K_i = m_1/(m_1+m_2)$. Se o projétil é muito mais leve que o alvo, quase toda a energia é dissipada.

### Pêndulo balístico
Um projétil se aloja num bloco suspenso. A colisão (momento conservado, energia não) é seguida da subida do conjunto (energia mecânica conservada, momento não, por causa da tração e do peso). Combinando as duas etapas:
$$v_{1i} = \frac{m_1 + m_2}{m_1}\sqrt{2 g h} .$$

**Exemplo.** Uma flecha de 25 g se crava num alvo de palha de 2,5 kg suspenso, que sobe 5,0 cm. Velocidade do conjunto: $\sqrt{2 \cdot 9{,}8 \cdot 0{,}05} \approx 0{,}99$ m/s. Velocidade da flecha: $(2{,}525/0{,}025) \cdot 0{,}99 \approx 100$ m/s. Só cerca de 1% da energia cinética da flecha vira energia potencial do conjunto.

### Inelástica genérica
Se os corpos se separam mas parte da energia é perdida, o momento dá uma equação e é preciso mais uma informação (uma velocidade final medida, ou o coeficiente de restituição) para resolver.

**Armadilha:** usar conservação de energia na colisão do pêndulo balístico. A energia só se conserva **depois**, na subida.

No experimento, faça o carrinho rápido grudar no carrinho parado, confira $V = m_1 v_{1i}/(m_1+m_2)$ e calcule a fração de energia perdida; teste com alvos mais leves e mais pesados.`,
      experiments: [
        { kind: "sim", id: "colisoes", scenario: "gruda", note: "Confira a velocidade final comum e a fração de energia perdida para várias razões de massa." },
        { kind: "sim", id: "trilho-de-ar", scenario: "inelastica", note: "Colisão com velcro no trilho: meça V e compare com a previsão do momento." },
        { kind: "pratica", id: "exp1-colisoes", note: "Roteiro de bancada para colisões inelásticas no trilho de ar." },
      ],
    },
    "9-10": {
      text: String.raw`Numa colisão elástica, momento **e** energia cinética se conservam. Para dois corpos numa reta, com $m_2$ inicialmente parado:
$$v_{1f} = \frac{m_1 - m_2}{m_1 + m_2}\,v_{1i}, \qquad v_{2f} = \frac{2m_1}{m_1 + m_2}\,v_{1i} .$$

### Casos especiais
- **Massas iguais:** $v_{1f} = 0$ e $v_{2f} = v_{1i}$; os corpos trocam de velocidade. É o que se vê no berço de Newton e na tacada seca do bilhar.
- **Alvo muito pesado** ($m_2 \gg m_1$): $v_{1f} \approx -v_{1i}$; o projétil ricocheteia e o alvo quase não se move (bola na parede).
- **Projétil muito pesado** ($m_1 \gg m_2$): $v_{1f} \approx v_{1i}$ e $v_{2f} \approx 2v_{1i}$; o alvo leve sai com o dobro da velocidade.

### Alvo em movimento
O resultado geral é mais simples de lembrar por uma propriedade: numa colisão elástica unidimensional, a **velocidade relativa se inverte**, $v_{2f} - v_{1f} = -(v_{2i} - v_{1i})$. Junto com a conservação do momento, isso resolve qualquer caso.

**Exemplo.** Um nêutron (massa 1 u) a $2{,}0\times10^{7}$ m/s colide frontal e elasticamente com um núcleo de carbono (12 u) em repouso. Ele volta com $v_{1f} = (1-12)/13 \cdot 2{,}0\times10^7 \approx -1{,}7\times10^7$ m/s, perdendo apenas $1 - (11/13)^2 \approx 28\%$ da energia. Com um próton como alvo (massas iguais), perderia tudo em um choque frontal. É por isso que materiais ricos em hidrogênio (água, parafina) freiam nêutrons tão bem.

**Armadilha:** achar que, num choque elástico, cada corpo conserva a sua energia cinética. Só a soma se conserva.

No experimento, com massas iguais e $e = 1$, confira a troca de velocidades; depois aumente $m_2$ e veja o carrinho incidente voltar, ou diminua $m_2$ e veja o alvo sair mais rápido que o projétil.`,
      experiments: [
        { kind: "sim", id: "colisoes", scenario: "troca", note: "Massas iguais trocam de velocidade; depois mude m₂ e compare com as fórmulas." },
        { kind: "sim", id: "pendulos-especiais", scenario: "berco", note: "No berço de Newton, a troca de velocidades passa de esfera em esfera." },
        { kind: "sim", id: "trilho-de-ar", scenario: "elastica", note: "Colisão com molas no trilho: confira a conservação do momento e da energia cinética." },
      ],
    },
    "9-11": {
      text: String.raw`Quando a colisão não é frontal, os corpos saem em direções diferentes da inicial. O momento continua se conservando, agora como **vetor**: há uma equação para cada componente.
$$m_1 v_{1i} = m_1 v_{1f}\cos\theta_1 + m_2 v_{2f}\cos\theta_2$$
$$0 = -m_1 v_{1f}\sin\theta_1 + m_2 v_{2f}\sin\theta_2$$
(eixo $x$ ao longo da velocidade inicial de $m_1$, alvo parado, ângulos medidos de lados opostos do eixo). Se a colisão for elástica, vale também a conservação da energia cinética. São três equações e quatro incógnitas ($v_{1f}$, $v_{2f}$, $\theta_1$, $\theta_2$): um dado precisa vir de fora, em geral um dos ângulos, que depende do **parâmetro de impacto** $b$ (a distância entre a linha do movimento e o centro do alvo).

### Massas iguais, choque elástico
Um resultado elegante: se $m_1 = m_2$ e o alvo está parado, as velocidades finais são **perpendiculares**, $\theta_1 + \theta_2 = 90°$. Elevando $\vec v_{1i} = \vec v_{1f} + \vec v_{2f}$ ao quadrado e comparando com a energia, o termo cruzado $\vec v_{1f}\cdot\vec v_{2f}$ precisa ser zero.

**Exemplo.** Um disco de hóquei de 0,16 kg a 6,0 m/s atinge outro igual parado, saindo a 30° com 5,2 m/s. Na direção $y$: $5{,}2\sin 30° = v_{2f}\sin\theta_2$; na $x$: $6{,}0 = 5{,}2\cos 30° + v_{2f}\cos\theta_2$. Daí $v_{2f}\cos\theta_2 \approx 1{,}5$ e $v_{2f}\sin\theta_2 = 2{,}6$, o que dá $v_{2f} \approx 3{,}0$ m/s e $\theta_2 \approx 60°$. Os ângulos somam 90°, e a energia confere ($5{,}2^2 + 3{,}0^2 \approx 6{,}0^2$): o choque é elástico.

**Armadilha:** conservar o módulo do momento em vez do vetor, somando $m_1v_{1f} + m_2v_{2f}$ sem projetar nos eixos.

No experimento, varie o parâmetro de impacto entre os discos de mesma massa e meça o ângulo entre as velocidades finais: com $e = 1$ ele fica em 90°; reduza $e$ e veja o ângulo diminuir.`,
      experiments: [
        { kind: "sim", id: "colisoes", scenario: "disco", note: "Varie o parâmetro de impacto e meça o ângulo entre as velocidades finais dos discos." },
        { kind: "sim", id: "vetores-3d", scenario: "soma", note: "Monte p₁f + p₂f = p₁i como soma de vetores no plano." },
      ],
    },
    "9-12": {
      text: String.raw`Um foguete acelera expelindo massa: os gases de exaustão saem para trás com velocidade $v_{\text{rel}}$ em relação ao foguete e, pela conservação do momento do sistema foguete + gases, o foguete ganha velocidade para a frente. Como a massa do foguete diminui, não podemos usar $F = ma$ com $m$ constante; aplicamos a conservação do momento a um intervalo $dt$.

### Primeira equação do foguete
Com massa $M$ e taxa de consumo $R = -dM/dt$, longe de outras forças,
$$R\,v_{\text{rel}} = M a .$$
O produto $R\,v_{\text{rel}}$ é o **empuxo**. Como $M$ diminui durante a queima, a aceleração cresce mesmo com empuxo constante.

### Segunda equação (Tsiolkovsky)
Integrando de $M_i$ a $M_f$:
$$v_f - v_i = v_{\text{rel}} \ln\frac{M_i}{M_f} .$$
O ganho de velocidade cresce só com o **logaritmo** da razão de massas. Para chegar à órbita baixa (cerca de 9,4 km/s, contando perdas por gravidade e arrasto) com $v_{\text{rel}} \approx 3{,}5$ km/s, seria preciso $M_i/M_f \approx e^{2{,}7} \approx 15$: mais de 93% da massa inicial teria de ser combustível. Daí os **estágios**: descartar tanques vazios melhora a razão de massas de cada etapa.

**Exemplo.** Uma sonda de 1200 kg no espaço profundo, com $v_{\text{rel}} = 3000$ m/s, queima 400 kg de propelente. $\Delta v = 3000 \ln(1200/800) \approx 1{,}2$ km/s. Se a taxa de queima for 2 kg/s, o empuxo é 6 kN e a aceleração vai de 5 m/s² no início a 7,5 m/s² no fim.

### Perto da Terra
Na decolagem vertical, o peso entra no balanço: $M a = R\,v_{\text{rel}} - Mg$, e o foguete só sai do chão se o empuxo superar o peso. Quanto mais longa a queima, maior a "perda por gravidade".

**Armadilha:** pensar que o foguete precisa do ar para "empurrar". Ele empurra os próprios gases e funciona melhor no vácuo.

No experimento, compare $v(t)$ do foguete com a equação de Tsiolkovsky no espaço; depois divida a mesma massa em dois ou três estágios e veja o ganho de $\Delta v$.`,
      experiments: [
        { kind: "sim", id: "foguete", scenario: "espaco", note: "Compare a velocidade final do foguete com v_rel·ln(Mi/Mf)." },
        { kind: "sim", id: "foguete", scenario: "estagios", note: "Divida o foguete em estágios e compare o Δv com um único estágio." },
        { kind: "sim", id: "foguete", scenario: "gravidade", note: "Na decolagem vertical, veja a perda de velocidade causada pela gravidade." },
      ],
    },
  },
};
