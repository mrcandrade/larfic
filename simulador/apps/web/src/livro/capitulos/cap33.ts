import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 33,
  intro: String.raw`As equações de Maxwell preveem que um campo elétrico variável cria um campo magnético e vice-versa, e que esse par pode se desprender das cargas e viajar pelo espaço vazio. Essas **ondas eletromagnéticas** são a luz visível, mas também as ondas de rádio, as micro-ondas, o infravermelho, o ultravioleta, os raios X e os raios gama. Neste capítulo descrevemos a onda, calculamos a energia e o momento que ela transporta, estudamos a polarização e aplicamos o modelo de raios às leis da reflexão e da refração, incluindo a reflexão interna total que guia a luz nas fibras ópticas.`,
  sections: {
    "33-2": {
      text: String.raw`Até meados do século XIX, luz, eletricidade e magnetismo eram assuntos separados. Ao completar as equações do eletromagnetismo com a corrente de deslocamento (capítulo 32), Maxwell mostrou que elas admitem soluções em forma de onda que se propagam no vácuo com velocidade

$$c = \frac{1}{\sqrt{\mu_0\varepsilon_0}} \approx 3{,}00\times10^8\ \mathrm{m/s},$$

exatamente a velocidade medida para a luz. Conclusão: a luz é uma onda eletromagnética, e deve haver ondas desse tipo com qualquer comprimento de onda. Hertz confirmou a previsão produzindo ondas de rádio com um circuito oscilante.

O conjunto de todos esses comprimentos de onda forma o **espectro eletromagnético**. Não há limites naturais entre as faixas; os nomes vêm da forma como as ondas são produzidas e detectadas: rádio (metros a quilômetros), micro-ondas (milímetros a centímetros), infravermelho, visível, ultravioleta, raios X e raios gama (abaixo de $10^{-11}$ m). Em todas, $c = \lambda f$.

A faixa **visível** é minúscula: aproximadamente de $400$ nm (violeta) a $700$ nm (vermelho). A sensibilidade do olho não é uniforme; ela tem um máximo perto de $555$ nm, no verde-amarelo, e cai suavemente nas bordas, por isso os limites da faixa são convencionais.

Exemplo: uma rádio FM em $100$ MHz emite ondas com $\lambda = c/f = 3{,}0$ m; o forno de micro-ondas, em $2{,}45$ GHz, usa $\lambda \approx 12$ cm; a luz verde de $530$ nm tem frequência $f = c/\lambda \approx 5{,}7\times10^{14}$ Hz.

Armadilha: achar que rádio e luz são fenômenos de natureza diferente porque um "é som" e o outro "é luz". As ondas de rádio não são som: são o mesmo tipo de onda que a luz, só que com $\lambda$ milhões de vezes maior; o rádio converte essa onda em som.

No experimento, percorra o espectro mudando o comprimento de onda e observe como frequência e energia do fóton variam juntas, e onde ficam os exemplos do dia a dia.`,
      experiments: [
        { kind: "sim", id: "espectro-em", scenario: "espectro", note: "Percorra o espectro dos raios gama às ondas de rádio e compare λ, f e exemplos." },
        { kind: "sim", id: "velocidade-luz", scenario: "fizeau", note: "Refaça a medida de c de Fizeau e compare com 1/√(μ₀ε₀)." },
        { kind: "sim", id: "fotometria", scenario: "olho", note: "Veja a curva de sensibilidade do olho e onde fica a faixa visível." },
      ],
    },
    "33-3": {
      text: String.raw`Uma forma simples de gerar uma onda eletromagnética é uma **antena dipolo**: duas hastes ligadas a um oscilador, em que as cargas sobem e descem periodicamente. O campo elétrico perto da antena acompanha as cargas; o campo magnético acompanha a corrente. Longe da antena (a muitos comprimentos de onda), as frentes de onda são praticamente planas, e a onda tem propriedades simples:

- os campos $\vec E$ e $\vec B$ são sempre **perpendiculares à direção de propagação**: a onda é **transversal**;
- $\vec E$ é perpendicular a $\vec B$, e o produto $\vec E\times\vec B$ aponta no sentido de propagação;
- os dois campos variam senoidalmente, com a **mesma frequência e em fase**: chegam juntos ao máximo e ao zero;
- os módulos estão sempre na razão $E/B = c$.

Diferentemente de uma onda numa corda, a onda eletromagnética **não precisa de meio**. Ela se sustenta sozinha: o campo elétrico variável induz o magnético (lei de Ampère–Maxwell) e o magnético variável induz o elétrico (lei de Faraday).

O dipolo não irradia igualmente em todas as direções: a intensidade é máxima no plano perpendicular à antena e nula ao longo do eixo dela. O campo elétrico irradiado oscila paralelo à antena, por isso a orientação da antena receptora importa.

Exemplo: a $1$ km de uma antena, um campo elétrico de amplitude $E_m = 0{,}30$ V/m vem acompanhado de um campo magnético $B_m = E_m/c = 1{,}0\times10^{-9}$ T, cerca de cinquenta mil vezes menor que o campo da Terra, e mesmo assim igualmente importante para a onda.

Armadilha: pensar que, por $B$ ser numericamente pequeno, a parte magnética da onda é desprezível. Em unidades do SI os números parecem desiguais, mas a energia se divide **igualmente** entre os dois campos (seção 33-5).

No experimento, veja o dipolo irradiar e repare onde a radiação é forte e onde some; depois, na onda plana, gire a vista e confira que $\vec E$, $\vec B$ e a propagação são mutuamente perpendiculares.`,
      experiments: [
        { kind: "sim", id: "espectro-em", scenario: "dipolo", note: "Observe o diagrama de irradiação do dipolo: máximo no plano equatorial, zero no eixo." },
        { kind: "sim", id: "espectro-em", scenario: "onda", note: "Gire a onda plana em 3D e confira E ⊥ B ⊥ direção de propagação." },
      ],
    },
    "33-4": {
      text: String.raw`Para uma onda plana que se propaga no sentido $+x$, com $\vec E$ ao longo de $y$ e $\vec B$ ao longo de $z$:

$$E = E_m\,\mathrm{sen}(kx - \omega t),\qquad B = B_m\,\mathrm{sen}(kx - \omega t),$$

com $k = 2\pi/\lambda$, $\omega = 2\pi f$ e velocidade $\omega/k = c$. As duas funções têm a mesma fase, como antecipado na seção 33-3.

A relação entre as amplitudes sai da **lei de Faraday** aplicada a um retângulo estreito no plano $xy$: o fluxo magnético variável através dele exige que $\partial E/\partial x = -\partial B/\partial t$. Substituindo as senoides, $kE_m = \omega B_m$, ou seja,

$$\frac{E_m}{B_m} = \frac{\omega}{k} = c,$$

e a mesma razão vale para os valores instantâneos. A **lei de Ampère–Maxwell** aplicada a um retângulo no plano $xz$ dá a segunda relação, $-\partial B/\partial x = \mu_0\varepsilon_0\,\partial E/\partial t$, que leva a $\omega/k = 1/\sqrt{\mu_0\varepsilon_0}$. Combinadas, as duas reproduzem a equação de onda e fixam a velocidade da luz a partir de constantes medidas em laboratório com capacitores e bobinas.

Exemplo: um laser de comprimento de onda $633$ nm tem $k = 2\pi/\lambda \approx 9{,}9\times10^6$ rad/m e $\omega = ck \approx 3{,}0\times10^{15}$ rad/s. Se a amplitude do campo elétrico é $E_m = 600$ V/m, então $B_m = 2{,}0\ \mu\mathrm T$.

Armadilha: desenhar $\vec E$ e $\vec B$ defasados de um quarto de período, como se a energia passasse de um campo para o outro, como num circuito LC. Numa onda plana progressiva eles estão em fase: os dois são máximos nos mesmos pontos e instantes.

No experimento, mude o comprimento de onda e a intensidade e confira que a razão entre as amplitudes de $E$ e $B$ continua igual a $c$; nas medidas históricas, veja de onde veio o valor de $c$.`,
      experiments: [
        { kind: "sim", id: "espectro-em", scenario: "onda", note: "Varie λ e a intensidade e verifique que E_m/B_m = c sempre." },
        { kind: "sim", id: "velocidade-luz", scenario: "foucault", note: "Meça c com o espelho giratório de Foucault." },
      ],
    },
    "33-5": {
      text: String.raw`A onda eletromagnética transporta energia: é assim que o Sol aquece a Terra. A taxa de transporte de energia por unidade de área é dada pelo **vetor de Poynting**

$$\vec S = \frac{1}{\mu_0}\,\vec E\times\vec B,$$

que aponta no sentido da propagação e tem unidade W/m². Como $E$ e $B$ estão em fase e $B = E/c$, o módulo instantâneo é $S = E^2/(c\mu_0)$, que oscila entre zero e um máximo. O que um detector mede é a média no tempo, a **intensidade**:

$$I = \overline{S} = \frac{1}{c\mu_0}E_{\text{rms}}^2,\qquad E_{\text{rms}} = \frac{E_m}{\sqrt2}.$$

As densidades de energia elétrica $\tfrac12\varepsilon_0E^2$ e magnética $B^2/2\mu_0$ são **iguais** em cada ponto da onda, o que confirma que nenhum dos campos é secundário.

### Variação da intensidade com a distância
Uma fonte pontual que emite potência $P_s$ igualmente em todas as direções espalha essa potência sobre esferas cada vez maiores, de área $4\pi r^2$. Se o meio não absorve, a intensidade cai com o inverso do quadrado:

$$I = \frac{P_s}{4\pi r^2}.$$

Exemplo: a luz solar chega à Terra com $I \approx 1{,}36$ kW/m². Daí $E_{\text{rms}} = \sqrt{c\mu_0I} \approx 7{,}2\times10^2$ V/m e $B_{\text{rms}} \approx 2{,}4\ \mu\mathrm T$. Multiplicando $I$ pela área $4\pi r^2$ com $r = 1{,}5\times10^{11}$ m, obtém-se a potência do Sol, cerca de $3{,}8\times10^{26}$ W.

Armadilha: aplicar o $1/r^2$ a um feixe de laser. O laser é quase paralelo; sua intensidade praticamente não cai com a distância até que a difração alargue o feixe (capítulo 36).

No experimento, veja o vetor de Poynting acompanhar a onda e calcule a intensidade da luz solar; no capacitor que carrega, repare que a energia entra pela borda, vinda do campo em volta. Com o luxímetro, confira o inverso do quadrado.`,
      experiments: [
        { kind: "sim", id: "espectro-em", scenario: "onda", note: "Leia o vetor de Poynting instantâneo e a intensidade média da luz solar." },
        { kind: "sim", id: "espectro-em", scenario: "capacitor", note: "Veja o fluxo de energia entrar pela borda de um capacitor que carrega." },
        { kind: "sim", id: "fotometria", scenario: "inverso-quadrado", note: "Afaste o luxímetro da lâmpada e confira a queda com 1/r²." },
      ],
    },
    "33-6": {
      text: String.raw`Além de energia, a onda eletromagnética transporta **momento linear**. Se uma superfície absorve uma energia $\Delta U$ de um feixe, ela recebe um momento

$$\Delta p = \frac{\Delta U}{c}\quad\text{(absorção total)},\qquad \Delta p = \frac{2\Delta U}{c}\quad\text{(reflexão total, incidência normal)}.$$

A reflexão dá o dobro, como uma bola que quica e volta. Dividindo pelo intervalo de tempo e pela área, a força por unidade de área, a **pressão de radiação**, é

$$p_r = \frac{I}{c}\ \text{(absorção)},\qquad p_r = \frac{2I}{c}\ \text{(reflexão)}.$$

Os valores são pequenos no dia a dia. Exemplo: a luz solar, $I = 1{,}36$ kW/m², sobre um painel preto produz $p_r = 1360/(3{,}0\times10^8) \approx 4{,}5\times10^{-6}$ Pa; num espelho, $9\times10^{-6}$ Pa, cerca de $10^{-10}$ atmosfera. Uma vela solar de $100\ \mathrm m\times100\ \mathrm m$ refletora recebe uma força de cerca de $0{,}09$ N: pouco, mas contínua e sem gastar combustível.

Em escalas menores, a pressão de radiação é decisiva. As caudas dos cometas apontam para longe do Sol em parte por causa dela. Feixes de laser focalizados exercem forças de piconewtons, suficientes para prender microesferas e células (pinças ópticas) e para frear átomos até temperaturas de microkelvins (resfriamento a laser).

Armadilha: pensar que só objetos com massa transportam momento. A luz não tem massa, mas tem momento $p = U/c$; essa relação reaparece na relatividade (seção 37-11) e no fóton (capítulo 38).

No experimento, troque a superfície iluminada de preta para espelho e compare a pressão; depois aumente a intensidade em várias ordens de grandeza para ver quando o efeito se torna mensurável. No resfriamento a laser, veja a pressão de radiação frear os átomos.`,
      experiments: [
        { kind: "sim", id: "espectro-em", scenario: "onda", params: { superficie: 1 }, note: "Compare a pressão de radiação numa superfície refletora com a de uma preta." },
        { kind: "sim", id: "resfriamento-laser", scenario: "melaco", note: "Veja a pressão de radiação de feixes de laser frear e esfriar átomos." },
        { kind: "sim", id: "resfriamento-laser", scenario: "pinca", note: "Prenda uma microesfera com a força da luz numa pinça óptica." },
      ],
    },
    "33-7": {
      text: String.raw`A **direção de polarização** de uma onda eletromagnética é a direção em que oscila o seu campo elétrico. Uma onda em que $\vec E$ oscila sempre na mesma direção é **plano-polarizada** (ou linearmente polarizada). A luz do Sol e de uma lâmpada é **não polarizada**: é emitida por um número enorme de átomos independentes, e a direção de $\vec E$ muda ao acaso muito rapidamente. Ela pode ser tratada como a soma de duas componentes perpendiculares de mesma intensidade, sem relação de fase.

Um **filtro polarizador** deixa passar só a componente de $\vec E$ paralela ao seu eixo de transmissão e absorve a perpendicular.

### Intensidade da Luz Polarizada Transmitida
Se a luz incidente é **não polarizada**, o filtro transmite metade da intensidade (**regra da metade**):

$$I = \tfrac12 I_0.$$

Se a luz incidente já é **polarizada**, e seu campo faz ângulo $\theta$ com o eixo do filtro, passa a componente $E\cos\theta$, e a intensidade, proporcional a $E^2$, segue a **lei de Malus**:

$$I = I_0\cos^2\theta.$$

Com dois filtros cruzados ($\theta = 90^\circ$), nada passa. Exemplo: luz não polarizada de $80$ W/m² atravessa três filtros com eixos a $0^\circ$, $30^\circ$ e $90^\circ$. Após o primeiro: $40$ W/m². Após o segundo: $40\cos^2 30^\circ = 30$ W/m². Após o terceiro, que faz $60^\circ$ com o segundo: $30\cos^2 60^\circ = 7{,}5$ W/m². Sem o filtro do meio, os dois restantes estariam cruzados e passaria zero.

Armadilha: achar que um filtro "só tira" luz e, portanto, acrescentar um filtro nunca aumenta a luz transmitida. O filtro intermediário **muda a direção** de polarização, e o terceiro passa a deixar passar alguma luz.

No experimento, gire o analisador e registre a intensidade em função do ângulo para verificar $\cos^2\theta$; depois coloque um terceiro polarizador entre dois cruzados e veja a luz reaparecer.`,
      experiments: [
        { kind: "sim", id: "polarizacao", scenario: "malus", note: "Gire o analisador e ajuste a curva I = I₀cos²θ aos pontos medidos." },
        { kind: "sim", id: "polarizacao", scenario: "tres", note: "Insira um polarizador entre dois cruzados e veja a luz voltar." },
        { kind: "pratica", id: "exp3-malus", note: "Verifique a lei de Malus na bancada, com luz de fundo e incertezas." },
      ],
    },
    "33-8": {
      text: String.raw`Quando a luz atravessa aberturas e obstáculos muito maiores que $\lambda$, podemos descrevê-la por **raios**, linhas retas que indicam a direção de propagação: é a **óptica geométrica**. Ao chegar à fronteira entre dois meios transparentes, um raio em geral se divide em um refletido e um refratado. Os ângulos são medidos em relação à **normal** à superfície.

**Reflexão:** o raio refletido fica no plano de incidência e $\theta_1' = \theta_1$.

**Refração:** o raio refratado também fica no plano de incidência e obedece à **lei de Snell**

$$n_1\,\mathrm{sen}\,\theta_1 = n_2\,\mathrm{sen}\,\theta_2,$$

em que $n = c/v$ é o **índice de refração** do meio ($n = 1$ no vácuo, $1{,}0003$ no ar, $1{,}33$ na água, cerca de $1{,}5$ no vidro). Ao passar para um meio de índice maior, o raio se aproxima da normal; para um de índice menor, se afasta. Na incidência normal ($\theta_1 = 0$) não há desvio.

Exemplo: luz incide do ar na água a $50^\circ$. Então $\mathrm{sen}\,\theta_2 = \mathrm{sen}\,50^\circ/1{,}33 = 0{,}576$, e $\theta_2 \approx 35^\circ$.

### Dispersão Cromática
O índice de refração depende do comprimento de onda: no vidro, é maior para o azul que para o vermelho. Num prisma, cada cor se desvia de um ângulo diferente, e a luz branca se abre num espectro. É a **dispersão cromática**.

### Arco-íris
Numa gota de chuva, a luz do Sol refrata ao entrar, reflete no fundo e refrata ao sair. Como o desvio depende da cor, cada cor sai concentrada num ângulo próprio, perto de $42^\circ$ em relação à direção oposta ao Sol (um pouco menos para o violeta, um pouco mais para o vermelho). As gotas nessa direção formam o arco primário, vermelho por fora. Com duas reflexões internas surge o arco secundário, perto de $51^\circ$, mais fraco e com as cores invertidas.

Armadilha: dizer que a luz "sempre se desvia" ao mudar de meio. Na incidência normal não há desvio, embora a velocidade mude.

No experimento, gire o laser e confira a lei de Snell; depois decomponha a luz branca no prisma e siga os raios dentro de uma gota.`,
      experiments: [
        { kind: "sim", id: "refracao", scenario: "snell", note: "Gire o laser e verifique n₁ sen θ₁ = n₂ sen θ₂ e θ₁' = θ₁." },
        { kind: "sim", id: "prisma", scenario: "prisma", note: "Decomponha a luz branca e compare os desvios de cada cor." },
        { kind: "sim", id: "prisma", scenario: "gota", note: "Siga os raios numa gota e encontre o ângulo do arco primário." },
        { kind: "pratica", id: "exp3-refracao", note: "Meça ângulos de incidência e refração e obtenha o índice do vidro." },
        { kind: "concepcao", id: "refracao-sempre-desvia" },
      ],
    },
    "33-9": {
      text: String.raw`Quando a luz passa de um meio de índice **maior** para um de índice **menor** (do vidro para o ar, por exemplo), o raio refratado se afasta da normal. Aumentando o ângulo de incidência, chega-se a um ângulo em que o refratado sai rasante à superfície ($\theta_2 = 90^\circ$). Esse é o **ângulo crítico**:

$$\mathrm{sen}\,\theta_c = \frac{n_2}{n_1}\qquad (n_2 < n_1).$$

Para ângulos de incidência maiores que $\theta_c$, não existe raio refratado: toda a luz é refletida. É a **reflexão interna total**. Na prática, ao se aproximar de $\theta_c$, o refratado vai ficando fraco e o refletido forte, até que, além do crítico, a reflexão é de $100\%$, melhor que a de qualquer espelho metálico.

Exemplo: do vidro ($n = 1{,}50$) para o ar, $\theta_c = \operatorname{arcsen}(1/1{,}50) \approx 41{,}8^\circ$. Por isso um prisma de $45^\circ$ reflete totalmente a luz que entra perpendicular a uma das faces, e é usado em binóculos e periscópios. Do diamante ($n = 2{,}42$) para o ar, $\theta_c \approx 24{,}4^\circ$: a luz que entra fica presa em muitas reflexões, o que explica o brilho da pedra lapidada.

A aplicação mais importante é a **fibra óptica**: um núcleo de vidro com índice ligeiramente maior que o da casca que o envolve. A luz que entra com ângulo pequeno em relação ao eixo atinge a fronteira núcleo–casca acima do ângulo crítico e é refletida milhares de vezes por quilômetro, quase sem perda. Se a fibra é dobrada demais, alguns raios passam a incidir abaixo do crítico e escapam.

Armadilha: esperar reflexão interna total também do ar para a água. Ela só acontece no sentido do meio mais refringente para o menos refringente; no sentido inverso, sempre há raio refratado.

No experimento, partindo do vidro, aumente o ângulo até o refratado desaparecer e meça o ângulo crítico; depois guie o laser numa fibra e diminua o raio da curva até a luz vazar.`,
      experiments: [
        { kind: "sim", id: "refracao", scenario: "rit", note: "Aumente o ângulo até o raio refratado sumir e meça θ_c." },
        { kind: "sim", id: "refracao", scenario: "fibra", note: "Curve a fibra até que parte da luz escape pela casca." },
        { kind: "pratica", id: "exp3-semicilindro", note: "Meça o ângulo crítico com um semicilindro de acrílico." },
      ],
    },
    "33-10": {
      text: String.raw`A luz refletida por uma superfície de vidro, água ou asfalto é, em geral, **parcialmente polarizada**. Para entender, decomponha o campo elétrico incidente em duas componentes: a **s**, perpendicular ao plano de incidência (paralela à superfície), e a **p**, contida no plano de incidência. As duas são refletidas em proporções diferentes, e a componente **p** é sempre a menos refletida.

Existe um ângulo de incidência, o **ângulo de Brewster** $\theta_B$, em que a componente **p** não é refletida em nada: a luz refletida é totalmente polarizada perpendicularmente ao plano de incidência. Nesse ângulo, o raio refletido e o refratado são perpendiculares entre si, $\theta_B + \theta_r = 90^\circ$. Combinando com a lei de Snell, obtém-se a **lei de Brewster**:

$$\tan\theta_B = \frac{n_2}{n_1}.$$

Uma forma de ver por que: os elétrons do segundo meio oscilam acompanhando o campo do raio refratado e reirradiam a luz refletida. Na geometria de Brewster, a componente **p** os faria oscilar justamente ao longo da direção do raio refletido, e um dipolo não irradia ao longo do seu eixo (seção 33-3).

Exemplo: do ar para o vidro de $n = 1{,}52$, $\theta_B = \arctan 1{,}52 \approx 56{,}7^\circ$; para a água, $\theta_B \approx 53^\circ$. A luz do Sol refletida por um lago, vista com ângulos próximos desse, é fortemente polarizada na horizontal. Óculos de sol polarizados têm eixo de transmissão **vertical** e cortam esse reflexo. Lasers usam janelas inclinadas no ângulo de Brewster para deixar passar sem perda a luz com a polarização desejada.

Armadilha: achar que a luz refletida é sempre polarizada. Ela é totalmente polarizada só em $\theta_B$; na incidência normal ou rasante, não há polarização preferida.

No experimento, gire a lâmina de vidro olhando a luz refletida através do analisador e encontre o ângulo em que ela some; compare com $\arctan n$. Na interface, escolha luz polarizada p e veja o refletido anular-se.`,
      experiments: [
        { kind: "sim", id: "polarizacao", scenario: "brewster", note: "Gire o vidro até a reflexão da componente p se anular e meça θ_B." },
        { kind: "sim", id: "refracao", scenario: "snell", params: { pol: 2 }, note: "Com luz polarizada p, encontre o ângulo em que o raio refletido some." },
      ],
    },
  },
};
