import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 37,
  intro: String.raw`A **relatividade restrita** de Einstein (1905) reformulou as noções de espaço e tempo. Ela parte de duas hipóteses simples e chega a conclusões que contrariam a intuição: relógios em movimento atrasam, réguas em movimento encurtam, dois eventos simultâneos para um observador não são para outro, e massa é uma forma de energia. Os efeitos só se tornam grandes perto da velocidade da luz, mas são medidos todos os dias: nos aceleradores de partículas, nos múons dos raios cósmicos e na correção dos relógios dos satélites de GPS.`,
  sections: {
    "37-2": {
      text: String.raw`A relatividade restrita trata de medidas feitas em **referenciais inerciais**, aqueles em que vale a lei da inércia, que se movem uns em relação aos outros com velocidade constante. Ela se apoia em dois postulados.

**1. Postulado da relatividade:** as leis da física são as mesmas para todos os observadores em referenciais inerciais. Nenhum referencial é privilegiado, e nenhum experimento feito dentro de um laboratório fechado em movimento uniforme pode revelar esse movimento. Galileu já havia afirmado isso para a mecânica; Einstein o estendeu a toda a física, incluindo o eletromagnetismo.

**2. Postulado da velocidade da luz:** a velocidade da luz no vácuo tem o mesmo valor $c$ em todas as direções e em todos os referenciais inerciais, independentemente do movimento da fonte.

O segundo postulado contraria a soma de velocidades do dia a dia: se uma nave a $0{,}5c$ acende um farol para a frente, um observador em repouso mede a luz do farol a $c$, e não a $1{,}5c$. Ele também implica que nenhuma partícula com massa pode ser acelerada até $c$: há uma **velocidade-limite** na natureza.

### Teste do Postulado da Velocidade da Luz
Os testes são muitos e precisos. O experimento de Michelson–Morley (1887) procurou uma diferença na velocidade da luz ao longo e transversalmente ao movimento da Terra, que o "vento de éter" deveria produzir, e não encontrou nenhuma. Em 1964, no CERN, píons que se moviam a $0{,}99975c$ decaíram emitindo raios gama; a velocidade desses raios gama, medida no laboratório, foi $c$ com precisão de partes em dez mil, e não perto de $2c$.

Exemplo: no experimento de Michelson–Morley com braços efetivos de $11$ m e luz de $550$ nm, a teoria do éter previa, ao girar o aparelho, um deslocamento de cerca de $0{,}4$ franja para a velocidade orbital da Terra ($30$ km/s). O observado foi menos de um décimo disso.

Armadilha: achar que o segundo postulado é só uma questão de instrumentos de medida imperfeitos. A constância de $c$ é uma propriedade do espaço e do tempo; é ela que obriga a revisar os conceitos de duração e comprimento.

No experimento, gire o interferômetro de Michelson–Morley e compare o deslocamento de franjas previsto pela teoria do éter com o resultado nulo.`,
      experiments: [
        { kind: "sim", id: "interferometros", scenario: "michelson-morley", note: "Gire o aparelho e compare a previsão do éter com o resultado nulo." },
        { kind: "sim", id: "velocidade-luz", scenario: "romer", note: "Veja como c foi medido pela primeira vez, com as luas de Júpiter." },
      ],
    },
    "37-3": {
      text: String.raw`Um **evento** é algo que acontece num ponto do espaço e num instante: um flash, uma colisão, a passagem de um ponteiro por uma marca. Para um dado observador, ele fica caracterizado por quatro números, as **coordenadas espaço-temporais** $(x, y, z, t)$.

Como medir essas coordenadas sem ambiguidade? Imagine o referencial do observador preenchido por uma grade tridimensional de réguas, com um relógio em cada nó, todos em repouso em relação ao observador. A posição do evento é lida na régua mais próxima; o instante, no relógio local, **onde o evento acontece**. Isso elimina o problema do tempo que a luz leva para trazer a notícia do evento até o observador: ele não "vê" o instante, ele o lê depois no registro do relógio local.

Os relógios precisam estar **sincronizados**. Um procedimento possível: no instante $t = 0$, um flash é emitido da origem. Cada relógio, a uma distância $r$ da origem, é ajustado previamente para marcar $r/c$ quando a luz chegar. Como $c$ é a mesma em todas as direções (segundo postulado), esse método funciona e não depende de nenhuma hipótese adicional.

É comum representar eventos num **diagrama de espaço-tempo** (diagrama de Minkowski): o eixo horizontal é $x$ e o vertical é $ct$, ambos em unidades de comprimento. Um objeto em repouso traça uma reta vertical, a sua **linha de mundo**; um pulso de luz traça uma reta a $45^\circ$. Nenhuma linha de mundo de partícula com massa pode ser mais inclinada que a da luz.

Exemplo: um raio atinge um poste a $900$ m da origem, e o observador vê o clarão em $t = 5{,}000000\ \mu$s depois do instante zero do seu relógio. Como a luz leva $900/(3\times10^8) = 3{,}0\ \mu$s para chegar, o evento ocorreu em $t = 2{,}0\ \mu$s; é esse o valor que o relógio junto ao poste registra.

Armadilha: confundir o instante em que o evento é **visto** com o instante em que **ocorreu**. As coordenadas de um evento são as do relógio local, não a hora de chegada da luz ao observador.

No experimento, arraste os eventos no diagrama de Minkowski e leia suas coordenadas $(x, ct)$; observe a linha de mundo da luz a $45^\circ$.`,
      experiments: [
        { kind: "sim", id: "relatividade", scenario: "simultaneidade", params: { beta: 0 }, note: "Com β = 0, arraste eventos e leia suas coordenadas no diagrama de Minkowski." },
      ],
    },
    "37-4": {
      text: String.raw`Dois eventos que acontecem em lugares diferentes e são **simultâneos** para um observador em geral **não** são simultâneos para outro que se move em relação ao primeiro. Isso é consequência direta da constância de $c$.

Considere um vagão muito longo que se move para a direita em relação à plataforma. Exatamente no meio do vagão está Sara; na plataforma, Pedro. Dois raios atingem as pontas do vagão e deixam marcas também na plataforma. Pedro, que está a meio caminho entre as marcas da plataforma, recebe os dois clarões ao mesmo tempo e conclui que os raios foram simultâneos no seu referencial.

Sara, que se move em direção à frente do vagão, encontra antes a luz que vem da frente. Para ela, as duas luzes percorreram distâncias iguais (ela está no meio do vagão) com a mesma velocidade $c$; se a da frente chegou primeiro, o raio da frente **ocorreu antes**. Os dois raciocínios estão corretos, cada um no seu referencial. Não existe um "agora" universal para eventos separados no espaço.

Não se trata de atraso de sinais: cada observador já descontou o tempo de trânsito da luz. A ordem temporal de eventos separados no espaço depende do referencial. Mas a relatividade da simultaneidade nunca inverte a ordem de eventos que podem estar **causalmente** ligados, isto é, separados por uma distância menor que $c$ vezes o intervalo de tempo entre eles (seção 37-8).

Exemplo de ordem de grandeza: para dois eventos simultâneos para Pedro e separados por $\Delta x = 600$ m, um observador a $0{,}6c$ mede um intervalo de $\gamma v\Delta x/c^2 = 1{,}25\cdot0{,}6\cdot600/(3\times10^8) = 1{,}5\ \mu$s. Para um trem a $30$ m/s, o mesmo cálculo dá cerca de $2\times10^{-13}$ s: inobservável no cotidiano.

Armadilha: pensar que "na verdade" os eventos foram simultâneos e que Sara se engana por causa do movimento. Nenhum dos dois referenciais é privilegiado.

No experimento, coloque dois eventos simultâneos em S e aumente $\beta$; veja a linha de simultaneidade de S' se inclinar e a ordem dos eventos mudar de sinal com o sentido da velocidade.`,
      experiments: [
        { kind: "sim", id: "relatividade", scenario: "simultaneidade", note: "Aumente β e veja eventos simultâneos em S deixarem de sê-lo em S'." },
        { kind: "sim", id: "relatividade", scenario: "simultaneidade", params: { beta: -0.6 }, note: "Inverta o sentido da velocidade e veja a ordem dos eventos se inverter." },
      ],
    },
    "37-5": {
      text: String.raw`Imagine um **relógio de luz**: um pulso que vai e volta entre dois espelhos separados por $D$. Para quem está em repouso com o relógio, cada tique dura $\Delta t_0 = 2D/c$. Esse é o **tempo próprio**: o intervalo entre dois eventos que ocorrem **no mesmo lugar** para o observador que os mede.

Para um observador em relação ao qual o relógio se move com velocidade $v$, o pulso percorre uma trajetória em zigue-zague, mais longa. Como a luz tem a mesma velocidade $c$ para ele, o tique dura mais. Pelo teorema de Pitágoras, $(c\Delta t/2)^2 = D^2 + (v\Delta t/2)^2$, o que dá

$$\Delta t = \gamma\,\Delta t_0,\qquad \gamma = \frac{1}{\sqrt{1 - \beta^2}},\quad \beta = \frac vc.$$

O **fator de Lorentz** $\gamma$ vale $1$ em repouso e cresce sem limite quando $v \to c$. Como $\gamma \ge 1$, o intervalo medido por quem vê o relógio passar é sempre maior: é a **dilatação do tempo**. Não é um defeito do relógio de luz; vale para qualquer processo físico, inclusive o envelhecimento biológico.

### Dois Testes da Dilatação do Tempo
**Partículas microscópicas.** Os múons têm vida média própria de $2{,}2\ \mu$s. Criados a uns $15$ km de altitude pelos raios cósmicos, sem dilatação percorreriam em média só $660$ m antes de decair. Mas a $0{,}9994c$, $\gamma \approx 29$, e a vida média no referencial da Terra passa a $64\ \mu$s: muitos chegam ao solo.

**Relógios macroscópicos.** Relógios atômicos levados em aviões e comparados com os que ficaram em terra mostraram as diferenças de nanossegundos previstas (somando o efeito da gravidade, da relatividade geral). Os relógios dos satélites de GPS precisam ser corrigidos continuamente pelos dois efeitos.

Exemplo: a $0{,}80c$, $\gamma = 1/\sqrt{1 - 0{,}64} = 5/3$. Um relógio em movimento que marca $3{,}0$ s é medido pelo outro observador como $5{,}0$ s.

Armadilha: achar que só o relógio "que se move de verdade" atrasa. Cada observador vê o relógio do outro atrasar; o paradoxo dos gêmeos se resolve porque o gêmeo viajante muda de referencial na volta.

No experimento, acompanhe o relógio de luz em movimento e meça $\gamma$ para várias velocidades; depois veja o paradoxo dos gêmeos no diagrama de espaço-tempo.`,
      experiments: [
        { kind: "sim", id: "relatividade", scenario: "dilatacao", note: "Compare o tique do relógio de luz em repouso e em movimento e meça γ." },
        { kind: "sim", id: "relatividade-dinamica", scenario: "gemeos", note: "Siga a viagem do gêmeo e compare as idades no reencontro." },
      ],
    },
    "37-6": {
      text: String.raw`O **comprimento próprio** $L_0$ de um objeto é o que se mede no referencial em que ele está **em repouso**. Para um observador em relação ao qual o objeto se move com velocidade $v$, paralela ao comprimento, o comprimento medido é menor:

$$L = \frac{L_0}{\gamma} = L_0\sqrt{1 - \beta^2}.$$

É a **contração do comprimento**. Ela ocorre apenas na direção do movimento; as dimensões transversais não mudam.

Por que deve ser assim? Considere a viagem de um múon através da atmosfera (seção 37-5). No referencial da Terra, a camada tem espessura $L_0$ e o múon vive mais por causa da dilatação do tempo. No referencial do múon, ele vive o seu tempo próprio normal, mas a atmosfera, que passa por ele a $0{,}9994c$, tem espessura $L_0/\gamma$. As duas descrições concordam sobre o fato que importa: o múon chega ao chão. Dilatação do tempo e contração do comprimento são duas faces do mesmo fenômeno.

Medir o comprimento de um objeto em movimento exige marcar as posições das duas extremidades **ao mesmo tempo**, e "ao mesmo tempo" depende do referencial (seção 37-4). É por isso que observadores diferentes obtêm comprimentos diferentes, e nenhum deles está errado.

Exemplo: uma nave com comprimento próprio de $120$ m passa pela Terra a $0{,}866c$, quando $\gamma = 2{,}0$. Da Terra, ela mede $60$ m. Para um tripulante, a distância de $4{,}0$ anos-luz até uma estrela se reduz a $2{,}0$ anos-luz, e a viagem dura $2{,}0/0{,}866 \approx 2{,}3$ anos no relógio de bordo, contra $4{,}6$ anos no relógio da Terra.

Armadilha: achar que uma régua em movimento "pareceria" encurtada numa fotografia. A contração é o resultado de uma medida com relógios sincronizados; uma fotografia registra luz que partiu de pontos diferentes em instantes diferentes e mostra uma imagem distorcida de outra maneira.

No experimento, coloque a régua em movimento e meça seu comprimento no referencial S; varie $\beta$ e confira $L = L_0/\gamma$.`,
      experiments: [
        { kind: "sim", id: "relatividade", scenario: "contracao", note: "Meça a régua em movimento e confira L = L₀/γ para vários β." },
        { kind: "sim", id: "relatividade", scenario: "contracao", params: { beta: 0.5, L0: 3 }, note: "Com β = 0,5, veja a régua de 3 al encolher para cerca de 2,6 al." },
      ],
    },
    "37-7": {
      text: String.raw`Um mesmo evento tem coordenadas $(x, y, z, t)$ no referencial S e $(x', y', z', t')$ no referencial S', que se move com velocidade $v$ ao longo do eixo $x$ em relação a S, com as origens coincidindo em $t = t' = 0$. Antes de Einstein, a relação era a **transformação de Galileu**: $x' = x - vt$ e $t' = t$. Ela leva à soma simples de velocidades e é incompatível com a constância de $c$.

A transformação que respeita os dois postulados é a **transformação de Lorentz**:

$$x' = \gamma\,(x - vt),\qquad y' = y,\qquad z' = z,\qquad t' = \gamma\left(t - \frac{vx}{c^2}\right).$$

A inversa (de S' para S) é obtida trocando o sinal de $v$. Para $v \ll c$, $\gamma \approx 1$ e o termo $vx/c^2$ é desprezível: recupera-se Galileu. A grande novidade é que o tempo $t'$ depende da posição $x$: é daí que vem a relatividade da simultaneidade.

Para pares de eventos, as mesmas fórmulas valem para as diferenças:

$$\Delta x' = \gamma\,(\Delta x - v\Delta t),\qquad \Delta t' = \gamma\left(\Delta t - \frac{v\Delta x}{c^2}\right).$$

A combinação $(c\Delta t)^2 - (\Delta x)^2$, o **intervalo** entre os eventos, tem o mesmo valor em todos os referenciais inerciais, embora $\Delta x$ e $\Delta t$ separadamente mudem.

Exemplo: em S, um evento ocorre em $x = 900$ m e $t = 2{,}0\ \mu$s. Para S' a $v = 0{,}60c$ ($\gamma = 1{,}25$): $x' = 1{,}25\,(900 - 0{,}60\cdot3\times10^8\cdot2{,}0\times10^{-6}) = 1{,}25\cdot540 = 675$ m e $t' = 1{,}25\,(2{,}0\times10^{-6} - 0{,}60\cdot900/(3\times10^8)) = 1{,}25\cdot0{,}20\ \mu\mathrm s = 0{,}25\ \mu$s.

Armadilha: aplicar $\Delta t = \gamma\Delta t_0$ sem verificar se o intervalo é próprio. Na dúvida, use a transformação de Lorentz completa, que vale sempre.

No experimento, arraste um evento e compare as coordenadas lidas nos eixos de S e de S'; confira os valores com as fórmulas e verifique que o intervalo não muda.`,
      experiments: [
        { kind: "sim", id: "relatividade", scenario: "simultaneidade", params: { eventos: 1 }, note: "Arraste os eventos e compare as coordenadas nos eixos de S e de S'." },
        { kind: "sim", id: "movimento-relativo", scenario: "barco", note: "Relembre a transformação de Galileu, o limite de baixa velocidade." },
      ],
    },
    "37-8": {
      text: String.raw`As equações de Lorentz contêm, como casos particulares, todos os efeitos das seções anteriores.

### Simultaneidade
Dois eventos simultâneos em S ($\Delta t = 0$) e separados por $\Delta x$ têm, em S', $\Delta t' = -\gamma v\Delta x/c^2$, diferente de zero. Só são simultâneos para os dois observadores se ocorrem no mesmo lugar.

### Dilatação do Tempo
Dois eventos no mesmo lugar em S' ($\Delta x' = 0$), separados pelo tempo próprio $\Delta t_0 = \Delta t'$. Pela transformação inversa, $\Delta t = \gamma(\Delta t' + v\Delta x'/c^2) = \gamma\Delta t_0$.

### Contração das Distâncias
Uma régua em repouso em S', de comprimento próprio $L_0 = \Delta x'$, tem suas extremidades marcadas **simultaneamente** em S ($\Delta t = 0$). Então $L_0 = \gamma(\Delta x - 0)$, logo $L = \Delta x = L_0/\gamma$.

### Causalidade
Se um evento pode causar outro, um sinal com velocidade no máximo $c$ tem de ir de um a outro: $|\Delta x| \le c|\Delta t|$, e o intervalo é do **tipo tempo**. Nesse caso, $\Delta t'$ tem o mesmo sinal que $\Delta t$ para qualquer $v < c$, e a ordem causa–efeito é a mesma para todos. Para eventos com $|\Delta x| > c|\Delta t|$ (tipo **espaço**), a ordem pode se inverter, mas nenhum pode influenciar o outro.

Exemplo: dois eventos em S com $\Delta x = 1200$ m e $\Delta t = 2{,}0\ \mu$s. Como $c\Delta t = 600$ m $< 1200$ m, a separação é do tipo espaço. Para $v = 0{,}60c$: $\Delta t' = 1{,}25\,(2{,}0\ \mu\mathrm s - 0{,}60\cdot1200/(3\times10^8)) = 1{,}25\,(2{,}0 - 2{,}4)\ \mu\mathrm s = -0{,}50\ \mu$s. A ordem se inverteu, e nenhum dos eventos pode ter causado o outro.

Armadilha: tratar dilatação e contração como regras independentes e aplicá-las mecanicamente. Elas só valem nas condições indicadas (eventos no mesmo lugar, ou extremidades marcadas ao mesmo tempo).

No experimento, escolha eventos com separação do tipo tempo e do tipo espaço e varie $\beta$: veja quando a ordem dos eventos pode se inverter e quando nunca se inverte.`,
      experiments: [
        { kind: "sim", id: "relatividade", scenario: "simultaneidade", params: { eventos: 2 }, note: "Com separação tipo espaço, encontre β que inverte a ordem dos eventos." },
        { kind: "sim", id: "relatividade", scenario: "dilatacao", params: { eventos: 1 }, note: "Com separação tipo tempo, confirme que nenhum β inverte a ordem." },
        { kind: "sim", id: "relatividade", scenario: "contracao", note: "Veja a contração surgir das extremidades marcadas ao mesmo tempo." },
      ],
    },
    "37-9": {
      text: String.raw`Uma partícula se move com velocidade $u'$ ao longo de $x'$ no referencial S', que se move com velocidade $v$ em relação a S. Qual é a velocidade $u$ da partícula em S? Dividindo $\Delta x$ por $\Delta t$ pela transformação de Lorentz inversa, obtém-se a **composição relativística de velocidades**:

$$u = \frac{u' + v}{1 + u'v/c^2}.$$

Para velocidades pequenas diante de $c$, o denominador é praticamente $1$ e recupera-se a soma de Galileu, $u = u' + v$. Mas, se $u' = c$, então $u = (c + v)/(1 + v/c) = c$: a luz tem velocidade $c$ em qualquer referencial, como exige o segundo postulado. E, se $u' < c$ e $v < c$, o resultado é sempre menor que $c$; não há como somar velocidades até ultrapassar a da luz.

Exemplo: uma nave se afasta da Terra a $0{,}80c$ e dispara para a frente uma sonda a $0{,}60c$ em relação à nave. Galileu daria $1{,}40c$. A relatividade dá $u = 1{,}40c/(1 + 0{,}48) \approx 0{,}95c$. Se a sonda for disparada para trás ($u' = -0{,}60c$), $u = 0{,}20c/(1 - 0{,}48) \approx 0{,}38c$, em vez de $0{,}20c$.

O resultado foi confirmado de muitas formas, como na medida de Fizeau da velocidade da luz em água corrente, que só se explica por essa fórmula, e na constância de $c$ para os raios gama dos píons rápidos (seção 37-2).

Armadilha: aplicar a fórmula a duas velocidades medidas no **mesmo** referencial. Se dois corpos se aproximam a $0{,}8c$ cada um em relação à Terra, a Terra vê a distância entre eles diminuir a $1{,}6c$, e isso não viola nada: nenhum objeto se move mais rápido que $c$. A velocidade de um **em relação ao outro** é que vale $1{,}6c/1{,}64 \approx 0{,}98c$.

No experimento (não há montagem específica de composição de velocidades), aplique uma força constante a uma partícula e veja a velocidade se aproximar de $c$ sem nunca alcançá-la; compare com a composição galileana no movimento relativo.`,
      experiments: [
        { kind: "sim", id: "relatividade-dinamica", scenario: "energia", note: "Empurre a partícula indefinidamente e veja a velocidade nunca passar de c." },
        { kind: "sim", id: "movimento-relativo", scenario: "aviao", note: "Compare com a soma galileana de velocidades, válida para v ≪ c." },
      ],
    },
    "37-10": {
      text: String.raw`Para o som, o efeito Doppler depende de quem se move em relação ao ar. Para a luz não há meio: só importa a **velocidade relativa** entre fonte e detector. Se eles se **afastam** com velocidade $v$ ao longo da linha que os une, a frequência detectada é

$$f = f_0\sqrt{\frac{1 - \beta}{1 + \beta}},$$

em que $f_0$ é a frequência própria, medida no referencial da fonte. Na aproximação, os dois sinais se trocam e $f > f_0$. O afastamento desloca as cores para o vermelho (**desvio para o vermelho**); a aproximação, para o azul.

Para $v \ll c$, a fórmula se reduz a $\Delta\lambda/\lambda \approx \pm\beta$, o que permite medir velocidades de estrelas e galáxias pelo deslocamento de linhas espectrais conhecidas. Foi assim que se descobriu que as galáxias distantes se afastam de nós, com velocidade proporcional à distância (capítulo 44). Os radares de trânsito usam o mesmo princípio com micro-ondas.

### Efeito Doppler Transversal
Se a fonte passa perpendicularmente à linha de visada, não há componente de velocidade ao longo dela, e a fórmula clássica não prevê nada. Mas a relatividade prevê uma diminuição da frequência: o relógio da fonte, isto é, sua oscilação, está dilatado. Assim,

$$f = f_0\sqrt{1 - \beta^2} = f_0/\gamma.$$

Esse efeito transversal, puramente relativístico, foi observado e é uma confirmação direta da dilatação do tempo.

Exemplo: uma galáxia mostra a linha do hidrogênio de $656{,}3$ nm em $721{,}9$ nm. A razão $\lambda/\lambda_0 = 1{,}10$ dá $(1 + \beta)/(1 - \beta) = 1{,}21$, logo $\beta \approx 0{,}095$: ela se afasta a cerca de $2{,}9\times10^4$ km/s. A fórmula aproximada daria $\beta = 0{,}10$.

Armadilha: usar as fórmulas do Doppler acústico para a luz, distinguindo "fonte em movimento" de "observador em movimento". Para a luz, os dois casos são o mesmo.

No experimento, faça a nave se aproximar e se afastar e observe a cor da sua luz; meça o comprimento de onda recebido e calcule $\beta$.`,
      experiments: [
        { kind: "sim", id: "relatividade-dinamica", scenario: "doppler", note: "Veja a cor da nave ao se aproximar e ao se afastar e calcule β." },
        { kind: "sim", id: "relatividade-dinamica", scenario: "doppler", params: { beta: 0.8 }, note: "A 0,8c, o desvio é grande: compare com a fórmula clássica." },
        { kind: "concepcao", id: "doppler-volume" },
      ],
    },
    "37-11": {
      text: String.raw`Se o momento continuasse a ser $mv$, ele não se conservaria nas colisões quando vistas de referenciais diferentes, já que as velocidades se transformam pela regra da seção 37-9. Para que a conservação do momento continue valendo em todos os referenciais inerciais, o momento precisa ser redefinido:

$$\vec p = \gamma\,m\,\vec v = \frac{m\vec v}{\sqrt{1 - v^2/c^2}}.$$

Aqui $m$ é a massa da partícula, a mesma em qualquer referencial. Uma forma de ver a origem do $\gamma$: o momento é a massa vezes o deslocamento $\Delta x$ medido no laboratório, dividido pelo tempo **próprio** $\Delta t_0$ da partícula, e $\Delta t_0 = \Delta t/\gamma$.

Para $v \ll c$, $\gamma \approx 1$ e volta-se a $p = mv$. Mas, quando $v \to c$, $\gamma \to \infty$ e o momento cresce sem limite. Aplicando uma força constante, $dp/dt = F$ continua valendo, o momento cresce linearmente com o tempo, mas a velocidade se aproxima assintoticamente de $c$. É mais um motivo pelo qual nenhuma partícula com massa alcança a velocidade da luz.

Exemplo: um elétron ($m = 9{,}11\times10^{-31}$ kg) a $0{,}990c$ tem $\gamma \approx 7{,}09$ e $p = 7{,}09\cdot9{,}11\times10^{-31}\cdot2{,}97\times10^8 \approx 1{,}9\times10^{-21}$ kg·m/s, sete vezes o valor clássico. Levá-lo de $0{,}990c$ para $0{,}999c$ (aumento de $1\%$ na velocidade) triplica o momento, pois $\gamma$ passa a $22{,}4$.

Armadilha: falar em "massa relativística que aumenta com a velocidade". A interpretação moderna mantém a massa invariante e põe o fator $\gamma$ na definição de momento (e de energia); o resultado numérico é o mesmo, mas a massa fica como propriedade intrínseca da partícula.

No experimento, aplique uma força constante a um elétron e a um próton e compare o momento relativístico com o clássico enquanto a velocidade satura perto de $c$.`,
      experiments: [
        { kind: "sim", id: "relatividade-dinamica", scenario: "energia", note: "Com força constante, compare p = γmv com mv enquanto v se aproxima de c." },
        { kind: "sim", id: "relatividade-dinamica", scenario: "energia", params: { particula: 1 }, note: "Repita com outra partícula e compare quanto tempo leva para γ crescer." },
      ],
    },
    "37-12": {
      text: String.raw`A relatividade associa energia à própria massa de um corpo. Uma partícula de massa $m$ em repouso tem **energia de repouso**

$$E_0 = mc^2.$$

Em reações químicas e nucleares, a massa total dos produtos difere da dos reagentes, e a diferença aparece como energia liberada ou absorvida: $Q = -\Delta M\,c^2$. Nas reações químicas, $\Delta M$ é imperceptível (bilionésimos da massa); nas nucleares, chega a frações de por cento. Em física de partículas usa-se o MeV: a energia de repouso do elétron é $0{,}511$ MeV; a do próton, $938$ MeV.

### Energia Total
A energia total de uma partícula livre é

$$E = \gamma\,mc^2,$$

que inclui a de repouso. A **energia cinética** é o que sobra: $K = E - mc^2 = (\gamma - 1)\,mc^2$. Para $v \ll c$, desenvolvendo $\gamma \approx 1 + \beta^2/2$, recupera-se $K \approx \tfrac12mv^2$.

### Momento e Energia Cinética
Eliminando a velocidade entre $E = \gamma mc^2$ e $p = \gamma mv$, obtém-se a relação, válida em qualquer referencial,

$$E^2 = (pc)^2 + (mc^2)^2.$$

Para uma partícula sem massa, como o fóton, $E = pc$, a mesma relação da pressão de radiação (seção 33-6). Também é útil: $\beta = pc/E$.

Exemplo: um próton acelerado a $K = 2{,}0$ GeV tem $E = 2{,}94$ GeV e $\gamma = 3{,}13$, logo $\beta = \sqrt{1 - 1/\gamma^2} \approx 0{,}95$ e $pc = \sqrt{E^2 - (mc^2)^2} \approx 2{,}78$ GeV. Para comparação, a fissão de um núcleo de urânio-235 libera cerca de $200$ MeV, que corresponde a uma diminuição de massa de aproximadamente $0{,}1\%$.

Armadilha: usar $K = \tfrac12mv^2$ para partículas rápidas. Para o próton acima, a fórmula clássica com $v = 0{,}95c$ daria $0{,}42$ GeV, quase cinco vezes menos que o correto.

No experimento, acelere a partícula e compare as energias cinéticas clássica e relativística; na física nuclear, calcule a energia da fissão a partir do defeito de massa.`,
      experiments: [
        { kind: "sim", id: "relatividade-dinamica", scenario: "energia", note: "Compare K = (γ − 1)mc² com ½mv² e veja E² = (pc)² + (mc²)²." },
        { kind: "sim", id: "nuclear", scenario: "fissao", note: "Obtenha a energia liberada na fissão a partir do defeito de massa." },
        { kind: "sim", id: "nuclear", scenario: "ligacao", note: "Veja a energia de ligação por núcleon, a massa que falta convertida em energia." },
      ],
    },
  },
};
