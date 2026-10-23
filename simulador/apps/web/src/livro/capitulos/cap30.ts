import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 30,
  intro: String.raw`Se uma corrente produz campo magnético, um campo magnético pode produzir corrente? Faraday mostrou em 1831 que sim, mas só quando algo **muda**: o fluxo magnético através de um circuito precisa variar. Essa **indução eletromagnética** gera praticamente toda a energia elétrica que usamos, nas usinas, e está nos transformadores, nos carregadores sem fio, nos freios magnéticos e nos captadores de guitarra. Neste capítulo estudamos as leis de Faraday e de Lenz, a energia envolvida, o campo elétrico induzido e o **indutor**, o componente que guarda energia no campo magnético e dá aos circuitos RL a sua constante de tempo.`,
  sections: {
    "30-1": {
      text: String.raw`### Dois Experimentos
Ligue uma espira a um galvanômetro e aproxime um ímã: o ponteiro se move enquanto o ímã se move, para quando ele para e se desvia para o outro lado quando ele se afasta. Agora troque o ímã por uma segunda espira com corrente: ao **ligar** ou **desligar** a corrente da segunda espira, surge corrente na primeira; com a corrente constante, nada. A corrente que aparece é chamada **induzida**, e o que a produz, uma **fem induzida**. Em ambos os casos, o ingrediente comum é a **variação** do campo magnético que atravessa a espira.

### A Lei de Indução de Faraday
A grandeza que importa é o **fluxo magnético** através da superfície limitada pela espira:

$$\Phi_B = \int\vec B\cdot d\vec A, \qquad \Phi_B = BA\cos\theta\ \text{(campo uniforme)},$$

medido em weber ($1\ \mathrm{Wb} = 1$ T·m²). A lei de Faraday diz que a fem induzida é a taxa de variação do fluxo; para uma bobina de $N$ espiras,

$$\varepsilon = -N\,\frac{d\Phi_B}{dt}.$$

O fluxo pode mudar de três formas: variando $B$, variando a área dentro do campo ou variando o ângulo $\theta$ entre o campo e a normal (é o que faz um gerador, que gira uma bobina num campo).

Exemplo: uma bobina de $200$ espiras e $10$ cm² está num campo perpendicular que sobe de $0$ a $0{,}50$ T em $0{,}10$ s. A fem média é $200\cdot1{,}0\times10^{-3}\cdot0{,}50/0{,}10 = 1{,}0$ V.

### A Lei de Lenz
O sinal negativo da lei de Faraday traduz a **lei de Lenz**: a corrente induzida tem um sentido tal que o campo magnético que ela produz se **opõe à variação** do fluxo que a criou. Se o polo norte de um ímã se aproxima, a espira cria um polo norte voltado para ele e o repele; se ele se afasta, a espira o atrai. A espira não se opõe ao fluxo, e sim à sua **mudança**. É uma consequência da conservação da energia: se a corrente induzida ajudasse a variação, o ímã seria acelerado sem que ninguém fizesse trabalho.

Armadilha: achar que um ímã parado dentro de uma bobina gera corrente. Sem variação de fluxo, não há fem, por mais forte que seja o campo.

No experimento, arraste o ímã para perto e para longe da espira, observe o sentido da corrente induzida e o gráfico de $\Phi$ e de $\varepsilon$; pare o ímã e veja a fem desaparecer.`,
      experiments: [
        { kind: "sim", id: "faraday-lenz", scenario: "arrastar", note: "Arraste o ímã e veja o sentido da corrente induzida se opor à variação." },
        { kind: "sim", id: "faraday-lenz", scenario: "oscilando", note: "Compare os gráficos de Φ(t) e ε(t): a fem é a derivada do fluxo." },
        { kind: "sim", id: "transformador", scenario: "ima", note: "Solte um ímã através de uma bobina e analise os dois picos de fem." },
        { kind: "sim", id: "faraday-lenz", scenario: "gerador", note: "Gire a bobina num campo uniforme: o fluxo muda pelo ângulo." },
        { kind: "concepcao", id: "ima-parado-induz" },
        { kind: "pratica", id: "exp3-transformador", note: "Meça fem induzidas na bancada com ímãs e bobinas." },
      ],
    },
    "30-2": {
      text: String.raw`A lei de Lenz garante que é preciso fazer trabalho para produzir corrente induzida. Considere uma barra condutora de comprimento $L$ deslizando com velocidade $v$ sobre dois trilhos, fechando um circuito de resistência $R$, num campo uniforme $B$ perpendicular. A área do circuito cresce a uma taxa $Lv$, e

$$\varepsilon = BLv, \qquad i = \frac{BLv}{R}.$$

A barra com corrente sofre a força magnética $F = iLB = B^2L^2v/R$, que, pela lei de Lenz, se opõe ao movimento. Para manter a velocidade constante, o agente externo precisa aplicar essa mesma força e fornecer a potência

$$P = Fv = \frac{B^2L^2v^2}{R} = i^2R.$$

Toda a energia fornecida vira energia térmica no resistor. Exemplo: $B = 0{,}50$ T, $L = 0{,}20$ m, $v = 2{,}0$ m/s e $R = 0{,}10\ \Omega$ dão $\varepsilon = 0{,}20$ V, $i = 2{,}0$ A, força de $0{,}20$ N e $0{,}40$ W, igual a $i^2R$.

### Correntes parasitas
Quando o condutor é uma placa maciça em vez de um fio, as correntes induzidas circulam em redemoinhos dentro do material: são as **correntes parasitas** (ou de Foucault). Elas também se opõem ao movimento e dissipam energia. Isso é útil nos **freios magnéticos** de trens e montanhas-russas e nos fogões de indução; é indesejável nos núcleos de transformadores e motores, que por isso são feitos de chapas finas isoladas, cortando os caminhos das correntes.

Armadilha: achar que a força de frenagem é constante. Ela é proporcional à velocidade: diminui à medida que o objeto desacelera, como um atrito viscoso.

No experimento, solte o pêndulo de Waltenhofen entre os polos de um ímã e compare a frenagem com placas de materiais e espessuras diferentes; no gerador, aumente a carga e veja crescer o esforço necessário.`,
      experiments: [
        { kind: "sim", id: "motores-geradores", scenario: "waltenhofen", note: "Compare a frenagem por correntes parasitas para materiais e espessuras diferentes." },
        { kind: "sim", id: "faraday-lenz", scenario: "passagem", params: { R: 0.5 }, note: "Com resistência baixa, veja a potência dissipada pela corrente induzida." },
        { kind: "sim", id: "transformador", scenario: "nucleo", note: "Troque o núcleo laminado pelo maciço e veja as perdas por correntes parasitas." },
      ],
    },
    "30-3": {
      text: String.raw`Na seção 30-1, a corrente induzida aparece numa espira **parada** dentro de um campo que varia. Quem empurra os elétrons? Não pode ser a força magnética, que exige carga em movimento. A interpretação correta é que **um campo magnético variável produz um campo elétrico**, mesmo no espaço vazio, haja ou não uma espira ali. A espira apenas revela esse campo.

O trabalho desse campo sobre uma carga que dá uma volta completa é $q\varepsilon$, de modo que a fem é a circulação de $\vec E$. A lei de Faraday assume então a forma geral

$$\oint\vec E\cdot d\vec s = -\frac{d\Phi_B}{dt}.$$

Numa região cilíndrica de raio $R$ onde o campo uniforme $B$ varia, as linhas do campo elétrico induzido são **círculos fechados** concêntricos. Para um círculo de raio $r < R$: $E\cdot2\pi r = \pi r^2\,dB/dt$, logo

$$E = \frac{r}{2}\,\frac{dB}{dt}.$$

Fora da região ($r > R$), $E = (R^2/2r)\,dB/dt$: o campo elétrico existe mesmo onde não há campo magnético.

Exemplo: se $B$ cresce a $0{,}10$ T/s numa região de raio $10$ cm, a $5{,}0$ cm do eixo o campo elétrico induzido é $E = 0{,}050\cdot0{,}10/2 = 2{,}5$ mV/m, e uma espira desse raio tem fem de $0{,}79$ mV.

Esse campo é diferente do eletrostático: suas linhas não começam nem terminam em cargas, e sua circulação não é zero. Por isso **não se pode definir um potencial elétrico** para ele: entre dois pontos, o trabalho depende do caminho. O bétatron, um acelerador de elétrons, usa esse campo circular para acelerá-los.

Armadilha: medir "a tensão" entre dois pontos numa região com campo magnético variável como se fosse única. O resultado depende do caminho dos fios do voltímetro.

No experimento, faça variar o campo de um solenoide e veja as linhas circulares do campo elétrico induzido, dentro e fora da bobina, sem nenhuma carga que as produza; depois observe a fem numa bobina em repouso enquanto a corrente no primário varia.`,
      experiments: [
        { kind: "sim", id: "faraday-lenz", scenario: "e-induzido", note: "Veja as linhas fechadas de E em torno do solenoide e o valor de E em função de r." },
        { kind: "sim", id: "transformador", scenario: "mutua", note: "Com as bobinas paradas, a variação da corrente no primário induz fem no secundário." },
        { kind: "sim", id: "faraday-lenz", scenario: "oscilando", note: "Relacione a fem na espira com a circulação do campo elétrico induzido." },
      ],
    },
    "30-4": {
      text: String.raw`Um **indutor** é um componente feito para produzir um campo magnético num volume definido, em geral uma bobina ou um solenoide, e é representado nos circuitos pelo símbolo de uma espiral. Se uma corrente $i$ passa por suas $N$ espiras e produz um fluxo $\Phi_B$ em cada uma, o **fluxo concatenado** $N\Phi_B$ é proporcional à corrente. A constante de proporcionalidade é a **indutância**:

$$L = \frac{N\Phi_B}{i}.$$

A unidade é o **henry** ($1\ \mathrm H = 1$ T·m²/A). Como a capacitância, a indutância depende só da geometria (e do material do núcleo), não da corrente.

Para um **solenoide longo** de comprimento $l$, área $A$ e $n$ espiras por metro, $B = \mu_0 n i$ (seção 29-4), $N = nl$ e $\Phi_B = BA$:

$$L = \mu_0\,n^2\,l\,A.$$

A indutância por unidade de comprimento depende do quadrado de $n$: dobrar a densidade de espiras quadruplica $L$, porque dobra o campo e também o número de espiras que o enlaçam.

Exemplo: $500$ espiras em $25$ cm, com raio de $1{,}0$ cm, dão $n = 2000$ m⁻¹ e $L = 4\pi\times10^{-7}\cdot2000^2\cdot0{,}25\cdot\pi\cdot(0{,}010)^2 \approx 0{,}39$ mH. Com um núcleo de ferro, a indutância pode crescer centenas de vezes. Indutores de filtros e fontes chaveadas vão de µH a mH; os de reatores de lâmpadas e de transformadores, a henrys.

Armadilha: achar que a indutância de uma bobina depende da corrente que passa por ela. No vácuo (sem núcleo ferromagnético) ela é constante; o fluxo é que acompanha a corrente.

No experimento, monte um solenoide e veja o campo interno crescer com o número de espiras; no circuito RL, compare a lentidão da subida da corrente para indutâncias diferentes.`,
      experiments: [
        { kind: "sim", id: "biot-savart", scenario: "solenoide", params: { N: 80, L: 16, R: 2 }, note: "Veja o campo interno de um solenoide longo, base do cálculo de L." },
        { kind: "sim", id: "rl-lc", scenario: "rl", params: { L: 5 }, note: "Aumente L e veja a corrente demorar mais para crescer." },
      ],
    },
    "30-5": {
      text: String.raw`Se a corrente num indutor muda, o fluxo concatenado $Li$ muda, e pela lei de Faraday aparece uma fem **no próprio indutor**: é a **autoindução**,

$$\varepsilon_L = -L\,\frac{di}{dt}.$$

A fem não depende do valor da corrente, só da rapidez com que ela muda. Pela lei de Lenz, ela se opõe à mudança: se a corrente cresce, a fem age contra ela; se a corrente diminui, a fem tenta mantê-la. O indutor é uma espécie de "inércia" para a corrente, assim como a massa é inércia para a velocidade.

Na análise de circuitos, trata-se o indutor como um elemento com diferença de potencial $V_L = L\,di/dt$, e na regra das malhas, ao atravessá-lo no sentido da corrente, soma-se $-L\,di/dt$. Com corrente constante, um indutor ideal se comporta como um fio.

Exemplo: um indutor de $2{,}0$ H conduz $1{,}0$ A. Se a chave for aberta e a corrente cair a zero em $1{,}0$ ms, a fem induzida chega a $2{,}0\times10^3$ V. É a faísca que aparece ao desligar motores e relés, por isso se coloca um diodo de proteção em paralelo com bobinas de relés. O mesmo princípio gera os milhares de volts da bobina de ignição dos motores a gasolina.

Armadilha: achar que a fem de autoindução é grande quando a corrente é grande. Uma corrente enorme e constante não induz nada; uma corrente pequena que muda bruscamente pode induzir uma tensão perigosa.

No experimento, observe no circuito RL a tensão no indutor: ela é máxima no instante em que a fonte é ligada (quando a corrente ainda é zero, mas varia rápido) e cai a zero quando a corrente se estabiliza.`,
      experiments: [
        { kind: "sim", id: "rl-lc", scenario: "rl", note: "Plote a tensão no indutor L di/dt e compare com a corrente." },
        { kind: "sim", id: "descargas-gases", scenario: "bobina", note: "Veja a bobina de indução produzir alta tensão ao interromper a corrente." },
      ],
    },
    "30-6": {
      text: String.raw`Num **circuito RL**, uma fem $\varepsilon$ é ligada a um resistor $R$ em série com um indutor $L$. A regra das malhas dá $\varepsilon - iR - L\,di/dt = 0$, com $i = 0$ em $t = 0$. A solução é

$$i(t) = \frac{\varepsilon}{R}\left(1 - e^{-t/\tau_L}\right), \qquad \tau_L = \frac{L}{R}.$$

No instante inicial, o indutor se opõe totalmente à variação: a corrente é zero, e toda a fem aparece sobre ele, como se fosse um circuito aberto. Muito tempo depois, a corrente é constante, o indutor não tem tensão, comporta-se como um fio, e $i = \varepsilon/R$. A **constante de tempo indutiva** $\tau_L$ mede o ritmo: em $t = \tau_L$, a corrente atinge $63\%$ do valor final.

Se a fonte é retirada e o circuito fecha só por $R$, a corrente não cai a zero instantaneamente; decai como

$$i(t) = i_0\,e^{-t/\tau_L}.$$

Compare com o circuito RC (seção 27-4): lá a tensão no capacitor não pode saltar; aqui, a corrente no indutor não pode saltar. Note que $\tau_L = L/R$ cresce quando $R$ **diminui**, ao contrário de $RC$.

Exemplo: $L = 1{,}0$ H e $R = 10\ \Omega$, com $6{,}0$ V: $\tau_L = 0{,}10$ s e corrente final $0{,}60$ A. Depois de $0{,}10$ s, $i \approx 0{,}38$ A; a tensão no indutor, inicialmente $6{,}0$ V, caiu para $2{,}2$ V.

Armadilha: esperar que a corrente no circuito RL salte ao valor final ao fechar a chave, como num circuito só com resistor. O indutor atrasa a subida.

No experimento, ligue e desligue a fonte e meça a constante de tempo no gráfico da corrente; depois reduza $R$ à metade e veja $\tau_L$ dobrar e a corrente final também.`,
      experiments: [
        { kind: "sim", id: "rl-lc", scenario: "rl", note: "Meça τ = L/R na subida e na descida da corrente." },
        { kind: "sim", id: "rl-lc", scenario: "rl", params: { R: 5 }, note: "Com R pela metade, τ e a corrente final dobram." },
      ],
    },
    "30-7": {
      text: String.raw`Para estabelecer uma corrente num indutor, a fonte precisa trabalhar contra a fem de autoindução. Multiplicando a equação do circuito RL pela corrente:

$$\varepsilon i = i^2R + Li\,\frac{di}{dt}.$$

O termo da esquerda é a potência fornecida pela fonte; o primeiro da direita é a potência dissipada no resistor; o segundo é a taxa com que a energia é **armazenada no campo magnético** do indutor, $dU_B/dt = Li\,di/dt$. Integrando de zero até $i$:

$$U_B = \frac12\,L\,i^2.$$

A fórmula é a análoga de $U_E = q^2/2C$ para o capacitor e de $\tfrac12mv^2$ para uma massa: o indutor é a "massa" e a corrente, a "velocidade". Essa energia não se perde enquanto a corrente circula; volta ao circuito quando a corrente diminui, o que explica a faísca da seção 30-5 e a troca de energia no circuito LC (capítulo 31).

Exemplo: no circuito da seção 30-6 ($L = 1{,}0$ H, corrente final $0{,}60$ A), a energia armazenada é $U_B = 0{,}5\cdot1{,}0\cdot0{,}36 = 0{,}18$ J. Os grandes ímãs supercondutores de aparelhos de ressonância, com dezenas de henrys e centenas de ampères, guardam megajoules, e precisam de procedimentos de segurança para desligar.

Armadilha: achar que a energia magnética é "consumida" como a do resistor. O indutor ideal não dissipa nada: só guarda e devolve.

No experimento, acompanhe no circuito RL as barras de energia: o trabalho da fonte, a energia dissipada no resistor e a energia armazenada no indutor, e verifique que a soma fecha.`,
      experiments: [
        { kind: "sim", id: "rl-lc", scenario: "rl", note: "Confira o balanço: trabalho da fonte = energia dissipada + ½Li²." },
        { kind: "sim", id: "rl-lc", scenario: "lc", note: "Veja a energia ½Li² voltar ao capacitor num circuito LC." },
      ],
    },
    "30-8": {
      text: String.raw`Onde fica a energia de um indutor? Assim como a energia do capacitor está no campo elétrico (seção 25-4), a do indutor está no **campo magnético**. Num solenoide longo, o campo $B = \mu_0 n i$ é uniforme no volume interno $Al$, e o campo externo é desprezível. Dividindo $U_B = \tfrac12Li^2$, com $L = \mu_0n^2lA$, pelo volume:

$$u_B = \frac{U_B}{Al} = \frac12\,\mu_0 n^2 i^2 = \frac{B^2}{2\mu_0}.$$

Embora deduzida para um solenoide, essa expressão da **densidade de energia magnética** vale para qualquer campo magnético no vácuo. Juntamente com $u_E = \tfrac12\varepsilon_0E^2$, ela diz que onde há campo há energia, mesmo no espaço vazio. Isso será essencial para as ondas eletromagnéticas (capítulo 33), que transportam energia sem que haja matéria.

Exemplo: um campo de $1{,}0$ T guarda $u_B = 1{,}0^2/(2\cdot4\pi\times10^{-7}) \approx 4{,}0\times10^5$ J/m³. Compare com o campo elétrico no limite de ruptura do ar ($3\times10^6$ V/m), que guarda só $40$ J/m³: campos magnéticos de laboratório armazenam muito mais energia por volume que os elétricos. No campo de $3$ T de um aparelho de ressonância, a densidade é $3{,}6\times10^6$ J/m³. Já o campo da Terra, de $50\ \mu$T, guarda apenas $10^{-3}$ J/m³.

Armadilha: aplicar a fórmula com $B$ em gauss ou com o campo de um ímã de geladeira medido longe dele. A energia depende do quadrado do campo, e $B$ precisa estar em tesla.

No experimento, compare a energia armazenada no indutor de um circuito RL para duas correntes finais diferentes e verifique que ela cresce com o quadrado da corrente, isto é, com o quadrado do campo dentro da bobina.`,
      experiments: [
        { kind: "sim", id: "rl-lc", scenario: "rl", params: { V0: 12 }, note: "Dobre a corrente final e veja a energia magnética quadruplicar." },
        { kind: "sim", id: "biot-savart", scenario: "solenoide", params: { N: 80, L: 16, R: 2 }, note: "Meça B no interior do solenoide e calcule a densidade B²/2μ₀." },
      ],
    },
    "30-9": {
      text: String.raw`Duas bobinas próximas compartilham fluxo: parte do campo da bobina 1 atravessa a bobina 2. Se a corrente $i_1$ varia, o fluxo concatenado na bobina 2 varia e nela aparece uma fem. É a **indução mútua**. Define-se a **indutância mútua** por

$$M = \frac{N_2\Phi_{21}}{i_1}, \qquad \varepsilon_2 = -M\,\frac{di_1}{dt},$$

e, simetricamente, $\varepsilon_1 = -M\,di_2/dt$. Um resultado não óbvio é que o mesmo $M$ vale nos dois sentidos, qualquer que seja a forma das bobinas. A unidade é o henry, e $M$ depende só da geometria e do núcleo: cresce quando as bobinas ficam mais próximas, coaxiais e com mais espiras.

Exemplo: uma bobina de $200$ espiras e raio $1{,}5$ cm é enrolada sobre o meio de um solenoide longo com $n = 2000$ m⁻¹. O fluxo do solenoide atravessa toda a bobina externa, e $M = \mu_0 n N_2 A \approx 4\pi\times10^{-7}\cdot2000\cdot200\cdot7{,}1\times10^{-4} \approx 0{,}36$ mH. Se a corrente no solenoide varia a $50$ A/s, a fem na bobina é de $18$ mV.

A indução mútua é a base do **transformador** (seção 31-6), dos carregadores sem fio de celulares e escovas de dente, dos cartões de aproximação e das bobinas de detectores de metais. Também é fonte de interferência indesejada ("diafonia") entre fios próximos, por isso cabos de sinal são trançados.

Armadilha: esperar fem na bobina 2 com corrente contínua constante na bobina 1. Como na autoindução, só a variação da corrente importa.

No experimento, faça a corrente no primário variar com forma triangular e observe a fem no secundário: ela é uma onda quadrada, porque $di_1/dt$ é constante em cada rampa.`,
      experiments: [
        { kind: "sim", id: "transformador", scenario: "mutua", note: "Corrente triangular no primário induz fem quadrada no secundário; meça M." },
        { kind: "sim", id: "transformador", scenario: "mutua", params: { forma: 0, f: 200 }, note: "Com corrente senoidal, veja a fem defasada de 90° e proporcional à frequência." },
        { kind: "pratica", id: "exp3-transformador", note: "Meça a indutância mútua e a relação de espiras na bancada." },
      ],
    },
  },
};
