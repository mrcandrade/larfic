import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 26,
  intro: String.raw`Até aqui as cargas estavam paradas. Agora elas se movem: é a **corrente elétrica**, que acende lâmpadas, gira motores e leva informação por cabos e chips. Neste capítulo definimos a corrente e a densidade de corrente, vemos que os elétrons num fio andam surpreendentemente devagar, introduzimos a resistência e a resistividade dos materiais, interpretamos a lei de Ohm pelo modelo microscópico dos elétrons livres e calculamos a potência dissipada. Fechamos com dois tipos de material que fogem do comportamento metálico comum: os semicondutores e os supercondutores.`,
  sections: {
    "26-1": {
      text: String.raw`Um fio metálico isolado tem bilhões de elétrons livres em movimento desordenado, mas tantos atravessam uma seção num sentido quanto no outro: não há corrente. Ligando o fio a uma bateria, surge um campo elétrico dentro dele e os elétrons ganham um pequeno movimento médio num sentido. A **corrente** $i$ é a taxa com que a carga atravessa uma seção do condutor:

$$i = \frac{dq}{dt}, \qquad q = \int i\,dt.$$

A unidade é o **ampère** (1 A = 1 C/s). Por convenção, o sentido da corrente é aquele em que se moveriam cargas **positivas**; num metal, onde quem se move são os elétrons, a corrente aponta no sentido contrário ao movimento deles. A corrente é um escalar, não um vetor: a seta num fio indica o sentido ao longo do condutor, e se o fio faz uma curva a corrente continua a mesma.

Em regime estacionário, a carga não se acumula em nenhum ponto do circuito. Por isso a corrente é a **mesma** em todas as seções de um fio sem ramificações, e num nó a soma das correntes que chegam é igual à soma das que saem (a regra dos nós, que retomaremos no capítulo 27). É a conservação da carga (seção 21-3) aplicada a cargas em movimento.

Exemplo: um carregador fornece $2{,}0$ A durante $1{,}5$ h. A carga transferida é $q = 2{,}0\cdot5400 = 1{,}08\times10^4$ C, ou $3000$ mAh, o equivalente a cerca de $6{,}7\times10^{22}$ elétrons.

Armadilha: achar que a corrente "se gasta" ao passar por uma lâmpada, chegando menor ao outro terminal. O que a lâmpada consome é energia, não carga; a corrente que entra é exatamente a que sai.

No experimento, monte lâmpadas em série com amperímetros antes e depois de cada uma e confira que a corrente é a mesma em todo o circuito.`,
      experiments: [
        { kind: "sim", id: "circuitos-dc", scenario: "serie", note: "Meça a corrente antes e depois de cada resistor e confira que ela não se gasta." },
        { kind: "concepcao", id: "corrente-gasta", note: "Confronte a ideia de que a corrente é consumida na lâmpada." },
      ],
    },
    "26-2": {
      text: String.raw`A corrente descreve o fio como um todo; para descrever o que acontece em cada ponto do condutor usamos a **densidade de corrente** $\vec J$, um vetor com o sentido do movimento das cargas positivas (o mesmo do campo) e módulo igual à corrente por unidade de área perpendicular:

$$i = \int\vec J\cdot d\vec A, \qquad J = \frac{i}{A}\ \text{(corrente uniforme)}.$$

A unidade é A/m². Se o fio afina, a mesma corrente passa por uma área menor e $J$ aumenta; as linhas de corrente se apertam.

**Velocidade de deriva.** Sob o campo, os elétrons ganham uma velocidade média $v_d$ ao longo do fio, sobreposta à agitação térmica. Se há $n$ portadores por unidade de volume, cada um com carga $e$, a carga que passa por uma área $A$ num tempo $dt$ é $neAv_d\,dt$, e

$$\vec J = n e\,\vec v_d.$$

Exemplo: um fio de cobre de $2{,}5$ mm² ($n \approx 8{,}5\times10^{28}$ elétrons/m³) conduz $10$ A. Então $J = 4{,}0\times10^6$ A/m² e $v_d = J/(ne) \approx 4{,}0\times10^6/(8{,}5\times10^{28}\cdot1{,}6\times10^{-19}) \approx 0{,}29$ mm/s. Um elétron leva quase uma hora para andar um metro! Enquanto isso, sua velocidade térmica é da ordem de $10^5$ a $10^6$ m/s, em direções aleatórias.

Por que, então, a lâmpada acende assim que se fecha o interruptor? Porque o fio já está cheio de elétrons, e o que se propaga quase à velocidade da luz é o **campo elétrico** que os põe em movimento, ao longo de todo o circuito ao mesmo tempo, como água num cano já cheio.

Armadilha: confundir a velocidade de deriva com a velocidade do sinal ou com a velocidade térmica dos elétrons.

No experimento, compare a deriva com a agitação térmica dos elétrons, troque a animação para a escala real e veja o deslocamento médio quase sumir.`,
      experiments: [
        { kind: "sim", id: "drude", scenario: "deriva", note: "Compare a velocidade de deriva, de mm/s, com a velocidade térmica dos elétrons." },
        { kind: "concepcao", id: "eletrons-velocidade-luz", note: "Confronte a ideia de que os elétrons correm à velocidade da luz no fio." },
      ],
    },
    "26-3": {
      text: String.raw`Aplicando a mesma diferença de potencial às pontas de uma barra de cobre e de uma de vidro, as correntes são muito diferentes. A **resistência** de um objeto é definida por

$$R = \frac{V}{i},$$

em ohms ($1\ \Omega = 1$ V/A). Um componente feito para ter uma resistência definida chama-se **resistor**. A resistência depende do objeto (forma e tamanho); a propriedade do **material** é a **resistividade** $\rho$, definida ponto a ponto por $\vec E = \rho\vec J$, ou seu inverso, a condutividade $\sigma = 1/\rho$. Para um fio uniforme de comprimento $L$ e seção $A$:

$$R = \rho\,\frac{L}{A}.$$

Fio mais longo, mais resistência; fio mais grosso, menos. Valores à temperatura ambiente: cobre, $1{,}7\times10^{-8}\ \Omega\cdot$m; alumínio, $2{,}8\times10^{-8}$; silício puro, cerca de $2\times10^3$; vidro, $10^{10}$ a $10^{14}$. A faixa cobre mais de vinte ordens de grandeza.

**Variação com a temperatura.** Nos metais a resistividade cresce quase linearmente com a temperatura, numa faixa ampla:

$$\rho - \rho_0 = \rho_0\,\alpha\,(T - T_0),$$

com $\alpha \approx 4\times10^{-3}\ \mathrm K^{-1}$ para o cobre. É por isso que o filamento de uma lâmpada incandescente tem, aceso, uma resistência mais de dez vezes maior que frio.

Exemplo: um circuito de $30$ m (ida e volta, $60$ m de fio) com fio de cobre de $2{,}5$ mm² tem $R = 1{,}7\times10^{-8}\cdot60/2{,}5\times10^{-6} \approx 0{,}41\ \Omega$. Com $20$ A, isso provoca uma queda de $8{,}2$ V, quase $4\%$ de $220$ V, e dissipa $160$ W no próprio fio: daí a importância de escolher a bitola certa.

Armadilha: dizer que a resistência é propriedade do material. O material tem resistividade; a resistência depende também da geometria.

No experimento, acompanhe a resistividade do metal crescer com a temperatura; depois escolha a seção e o comprimento do fio de uma instalação e veja quanto ele aquece.`,
      experiments: [
        { kind: "sim", id: "drude", scenario: "temperatura", note: "Veja a resistividade do cobre crescer com a temperatura e a do silício cair." },
        { kind: "sim", id: "consumo-energia", scenario: "disjuntor", note: "Escolha a seção e o comprimento do fio e veja a resistência aquecer o circuito." },
        { kind: "sim", id: "curva-iv", scenario: "lampada", note: "Veja a resistência do filamento crescer à medida que ele esquenta." },
      ],
    },
    "26-4": {
      text: String.raw`Para muitos materiais, a corrente é **proporcional** à diferença de potencial aplicada, ou seja, a resistência não depende da tensão nem do sentido em que ela é aplicada. Esse comportamento é a **lei de Ohm**, e os componentes que a seguem são chamados **ôhmicos**: o gráfico $i \times V$ é uma reta pela origem, com inclinação $1/R$.

Note a diferença: a relação $R = V/i$ é uma **definição** e vale para qualquer componente; a lei de Ohm é a afirmação experimental de que, para certos materiais, esse quociente é **constante**. Uma lâmpada incandescente não é ôhmica (sua resistência cresce com o aquecimento) e um diodo muito menos: quase não conduz num sentido e conduz bem no outro depois de um limiar de cerca de $0{,}6$ V para o silício.

Exemplo: um resistor de $220\ \Omega$ ligado a $5{,}0$ V conduz $22{,}7$ mA; a $10$ V, $45{,}5$ mA, o dobro. Um diodo de silício passa de praticamente zero a $0{,}5$ V para dezenas de miliampères a $0{,}7$ V.

### Uma Visão Microscópica da Lei de Ohm
No **modelo de Drude**, os elétrons livres são acelerados pelo campo, $a = eE/m$, e colidem a todo momento com os íons da rede, perdendo a direção do movimento. Se $\tau$ é o tempo médio entre colisões, a velocidade de deriva é $v_d = eE\tau/m$. Com $J = nev_d$:

$$\rho = \frac{m}{e^2 n\,\tau}.$$

O ponto-chave é que $\tau$ é determinado pela agitação térmica, enorme comparada à deriva, e **não depende do campo**. Por isso $\rho$ é constante e vale a lei de Ohm. Para o cobre, $\tau \approx 2{,}5\times10^{-14}$ s. Com a temperatura, a rede vibra mais, $\tau$ diminui e $\rho$ aumenta, como na seção 26-3.

Armadilha: dizer que "todo componente obedece $V = Ri$". Essa relação define $R$; a lei de Ohm é a constância de $R$.

No experimento, levante a curva $i \times V$ de um resistor, de uma lâmpada e de um diodo e compare; no modelo de Drude, dobre o campo e veja a densidade de corrente dobrar.`,
      experiments: [
        { kind: "sim", id: "curva-iv", scenario: "ohmico", note: "Levante a curva i × V de um resistor e confira a reta pela origem." },
        { kind: "sim", id: "curva-iv", scenario: "diodo", note: "Compare com a curva de um diodo, que não obedece à lei de Ohm." },
        { kind: "sim", id: "drude", scenario: "ohm", note: "Veja a lei de Ohm surgir das colisões dos elétrons livres com a rede." },
        { kind: "pratica", id: "exp3-ohm", note: "Roteiro de bancada: resistor e lâmpada." },
        { kind: "pratica", id: "exp3-diodo", note: "Roteiro de bancada: componentes não ôhmicos." },
      ],
    },
    "26-5": {
      text: String.raw`### A Potência em Circuitos Elétricos
Quando uma carga $dq$ atravessa um componente com diferença de potencial $V$, perde energia potencial $V\,dq$. Dividindo por $dt$, a **potência** transferida da bateria para o componente é

$$P = iV.$$

Num resistor essa energia vira calor (efeito Joule), e com $V = iR$:

$$P = i^2R = \frac{V^2}{R}.$$

Qual das formas usar depende do que está fixo. Exemplo: um chuveiro de $5500$ W em $220$ V puxa $25$ A e tem resistência de $8{,}8\ \Omega$. Na posição "verão", a resistência é **maior** (por exemplo, $16\ \Omega$) e a potência cai para cerca de $3000$ W, porque a tensão da rede é fixa e $P = V^2/R$. A conta de luz cobra energia em kWh: $5{,}5$ kW durante $10$ min por dia dá cerca de $27$ kWh por mês.

### Semicondutores
No silício puro, cada átomo usa seus quatro elétrons de valência em ligações; há poucos portadores livres ($n \approx 10^{16}$ m⁻³, contra $10^{29}$ m⁻³ no cobre), e a resistividade é alta. Para liberar um elétron é preciso vencer uma lacuna de energia (o **gap**, cerca de $1{,}1$ eV). Ao aquecer, mais elétrons cruzam o gap: o número de portadores cresce tão depressa que a resistividade **diminui** com a temperatura, ao contrário dos metais ($\alpha$ negativo). A **dopagem** com átomos de fósforo ou boro controla $n$ com enorme precisão, e é isso que torna possíveis diodos, transistores e chips (capítulo 41).

### Supercondutores
Certos materiais, resfriados abaixo de uma **temperatura crítica** $T_c$, perdem **toda** a resistência: o mercúrio a $4{,}2$ K, alguns óxidos cerâmicos acima de $90$ K. Uma corrente induzida num anel supercondutor circula por anos sem enfraquecer. O fenômeno não se explica pelo modelo de Drude: os elétrons formam pares que se movem pela rede sem trocar energia com ela. Os supercondutores também expulsam o campo magnético do seu interior e são usados nos eletroímãs de ressonância magnética e de aceleradores.

Armadilha: dizer que "resistência maior sempre aquece mais". Com corrente fixa ($i^2R$), sim; com tensão fixa ($V^2/R$), o contrário.

No experimento, resfrie um supercondutor abaixo de $T_c$ e veja a resistividade cair a zero e os elétrons seguirem sem colisões; compare também a potência do chuveiro no verão e no inverno e veja a resistividade do silício cair com a temperatura enquanto a do metal sobe.`,
      experiments: [
        { kind: "sim", id: "drude", scenario: "supercondutor", note: "Abaixe a temperatura do YBCO abaixo de 92 K e veja a resistividade desaparecer." },
        { kind: "sim", id: "consumo-energia", scenario: "chuveiro", note: "Compare potência, corrente e resistência do chuveiro nas posições verão e inverno." },
        { kind: "sim", id: "drude", scenario: "temperatura", params: { material: 2 }, note: "Veja a resistividade do silício cair com a temperatura, ao contrário do metal." },
        { kind: "sim", id: "semicondutores", scenario: "materiais", note: "Compare as bandas de um metal, de um semicondutor e de um isolante." },
        { kind: "desafio", id: "circuito-economico", note: "Acenda quatro lâmpadas gastando a menor potência possível." },
        { kind: "sim", id: "consumo-energia", scenario: "casa", note: "Monte o consumo diário de uma casa e veja a conta em kWh." },
      ],
    },
  },
};
