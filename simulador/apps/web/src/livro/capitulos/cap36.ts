import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 36,
  intro: String.raw`Toda onda que passa por uma abertura ou contorna um obstáculo se espalha e forma um padrão de faixas claras e escuras: é a **difração**. Ela impõe um limite à nitidez de qualquer instrumento óptico, do olho ao telescópio espacial, e ao mesmo tempo é uma ferramenta: as redes de difração separam as cores com precisão para a espectroscopia, e a difração de raios X por cristais revelou o arranjo dos átomos nos sólidos e a estrutura do DNA. Neste capítulo calculamos o padrão de uma fenda, de uma abertura circular, de duas fendas reais e de muitas fendas.`,
  sections: {
    "36-2": {
      text: String.raw`Ilumine uma fenda estreita com luz monocromática e observe numa tela distante: em vez de uma faixa nítida com o tamanho da fenda, aparece uma **franja central** larga e brilhante, ladeada por franjas secundárias cada vez mais fracas, separadas por mínimos escuros. Esse é um **padrão de difração**. Padrões semelhantes aparecem na borda de qualquer sombra, em torno de um fio de cabelo, de uma lâmina ou de um furo, e explicam as "moscas volantes", manchas com halos que vemos ao olhar para o céu claro, causadas por partículas no humor vítreo do olho.

A difração não exige nenhuma física nova: é interferência de um número muito grande de ondinhas de Huygens que partem de pontos diferentes da mesma abertura. Distingue-se do capítulo 35 apenas pelo número de fontes.

### A Mancha Clara de Fresnel
No começo do século XIX, a teoria ondulatória ainda era contestada. Fresnel apresentou um tratamento matemático da difração a um concurso da Academia Francesa, e Poisson, partidário da teoria corpuscular, deduziu dela uma consequência que lhe parecia absurda: no centro da sombra de um disco opaco iluminado por uma fonte pontual deveria haver um **ponto claro**, porque todas as ondas que contornam a borda do disco percorrem a mesma distância até o centro e chegam em fase. Arago fez a experiência e encontrou o ponto. A previsão "absurda" virou uma das provas mais convincentes da natureza ondulatória da luz.

Exemplo de ordem de grandeza: luz de $500$ nm passando por uma fenda de $50\ \mu$m forma, a $1{,}0$ m, uma franja central com cerca de $2$ cm de largura, quatrocentas vezes mais larga que a fenda.

Armadilha: imaginar que a difração só acontece com fendas estreitas. Ela acontece sempre; só se torna perceptível quando a abertura não é muito maior que $\lambda$ ou quando se observa de perto a borda da sombra.

No experimento, desenhe aberturas de formas diferentes e veja o padrão de difração de cada uma; na cuba de ondas, mande uma onda plana contra uma fenda e observe as franjas laterais.`,
      experiments: [
        { kind: "sim", id: "difracao", scenario: "desenho", note: "Desenhe aberturas variadas e compare seus padrões de difração." },
        { kind: "sim", id: "cuba-ondas", scenario: "fenda", note: "Veja a onda se espalhar atrás de uma fenda, com mínimos laterais." },
      ],
    },
    "36-3": {
      text: String.raw`Para achar os mínimos do padrão de uma fenda de largura $a$, divida a fenda em duas metades iguais e emparelhe cada ponto da metade de cima com o ponto correspondente da metade de baixo, a uma distância $a/2$. Numa direção $\theta$, os raios de cada par diferem em percurso por $(a/2)\,\mathrm{sen}\,\theta$. Se essa diferença for $\lambda/2$, cada par se anula, e a fenda inteira dá escuridão: primeiro mínimo em $a\,\mathrm{sen}\,\theta = \lambda$.

Dividindo a fenda em quatro, seis, ... partes e repetindo o argumento, obtém-se todos os mínimos:

$$a\,\mathrm{sen}\,\theta = m\lambda,\qquad m = 1, 2, 3, \dots$$

(o valor $m = 0$ não é mínimo: na direção $\theta = 0$ todas as ondinhas chegam em fase, e lá está o máximo central).

Consequências: a franja central tem **o dobro** da largura das laterais, porque vai de $m = -1$ a $m = +1$. Quanto **menor** $a$, mais largo o padrão; se $a < \lambda$, nem o primeiro mínimo existe e a luz se espalha por todo o semiespaço. Note que a condição para **mínimos** de uma fenda tem a mesma forma da condição de **máximos** de duas fendas (seção 35-4); não confunda.

Exemplo: luz de $633$ nm e uma fenda de $40\ \mu$m. O primeiro mínimo está em $\mathrm{sen}\,\theta = 633\times10^{-9}/40\times10^{-6} = 0{,}0158$, isto é, $\theta \approx 0{,}91^\circ$. Numa tela a $2{,}0$ m, ele fica a $3{,}2$ cm do centro, e a franja central tem $6{,}3$ cm de largura.

Armadilha: achar que estreitar a fenda deixa a imagem dela mais fina na tela. Estreitar **alarga** a franja central.

No experimento, meça a posição dos mínimos para várias larguras e confira $a\,\mathrm{sen}\,\theta = m\lambda$; na bancada, obtenha a largura de uma fenda a partir do padrão.`,
      experiments: [
        { kind: "sim", id: "difracao", scenario: "fenda", note: "Meça a posição dos mínimos e confira a sen θ = mλ." },
        { kind: "sim", id: "difracao", scenario: "fenda", params: { a: 10 }, note: "Com uma fenda de 10 µm, veja a franja central se alargar muito." },
        { kind: "pratica", id: "exp3-fenda-simples", note: "Determine a largura de uma fenda a partir dos mínimos de difração." },
      ],
    },
    "36-4": {
      text: String.raw`Para obter a intensidade em qualquer direção, e não só os mínimos, divida a fenda em $N$ faixas muito estreitas, cada uma emitindo uma onda de amplitude $\Delta E$. Numa direção $\theta$, ondas de faixas vizinhas diferem em fase por um pequeno ângulo $\Delta\phi$. Represente cada uma por um **fasor**, e some as setas encadeando-as.

- Em $\theta = 0$, todas as setas são paralelas e formam uma reta de comprimento $E_m = N\Delta E$: é o máximo central.
- Afastando-se do centro, cada seta gira um pouco em relação à anterior, e a cadeia se curva num arco de circunferência. A resultante, que liga o início ao fim da cadeia, é a **corda** do arco, mais curta que $E_m$.
- Quando a diferença de fase entre a primeira e a última faixa chega a $2\pi$, a cadeia fecha um círculo completo e a resultante é **zero**: é o primeiro mínimo.
- Aumentando mais, a cadeia dá uma volta e meia e a resultante volta a crescer: é o primeiro máximo secundário, com diâmetro do círculo bem menor que o comprimento total da cadeia. Depois, duas voltas completas dão o segundo mínimo, e assim por diante.

Essa imagem mostra por que os máximos laterais são fracos: neles, a cadeia de comprimento fixo está enrolada em várias voltas, e a resultante é só o diâmetro de uma volta pequena. Uma estimativa: no primeiro máximo lateral, a cadeia de comprimento $E_m$ forma cerca de $1{,}5$ voltas, logo o diâmetro é $E_m/(1{,}5\pi)$, e a intensidade relativa é $(1/1{,}5\pi)^2 \approx 0{,}045$, cerca de $4{,}5\%$ do máximo central.

Armadilha: achar que os máximos secundários ficam exatamente a meio caminho entre os mínimos e são tão brilhantes quanto o central. Eles estão quase no meio, mas valem só alguns por cento do central.

No experimento, mude a escala do gráfico para logarítmica e compare a altura dos máximos secundários com a do central; mova o detector e imagine a cadeia de fasores se enrolando.`,
      experiments: [
        { kind: "sim", id: "difracao", scenario: "fenda", note: "Compare a intensidade dos máximos laterais com a do central (cerca de 4,5%)." },
        { kind: "sim", id: "lissajous-fourier", note: "Some fasores defasados e veja a resultante depender da fase entre eles." },
      ],
    },
    "36-5": {
      text: String.raw`Transformando o argumento dos fasores em conta: quando a cadeia de comprimento $E_m$ se curva num arco de ângulo total $\phi$, a corda vale $E_\theta = E_m\,\mathrm{sen}(\phi/2)/(\phi/2)$. Chamando $\alpha = \phi/2$, e lembrando que a diferença de fase entre as bordas da fenda é $\phi = (2\pi/\lambda)\,a\,\mathrm{sen}\,\theta$:

$$I(\theta) = I_m\left(\frac{\mathrm{sen}\,\alpha}{\alpha}\right)^2,\qquad \alpha = \frac{\pi a}{\lambda}\,\mathrm{sen}\,\theta.$$

Os **mínimos** ocorrem onde $\mathrm{sen}\,\alpha = 0$ com $\alpha \neq 0$, ou seja, $\alpha = m\pi$, o que reproduz $a\,\mathrm{sen}\,\theta = m\lambda$ (seção 36-3). No centro, $\alpha \to 0$ e $\mathrm{sen}\,\alpha/\alpha \to 1$: intensidade máxima. Os **máximos secundários** ficam aproximadamente em $\alpha \approx (m + \tfrac12)\pi$ (na verdade um pouco antes) e valem cerca de $4{,}5\%$, $1{,}6\%$ e $0{,}8\%$ de $I_m$.

Exemplo: em que fração da intensidade central está um ponto em que a diferença de percurso entre as bordas da fenda é $\lambda/2$? Então $\phi = \pi$, $\alpha = \pi/2$, e $I/I_m = (1/(\pi/2))^2 = 4/\pi^2 \approx 0{,}41$. A largura da franja central "à meia altura" é, portanto, um pouco menor que a distância entre os pontos de diferença de percurso $\lambda/2$.

Note que $I$ depende de $a$ e $\lambda$ apenas pela razão $a/\lambda$: dobrar a largura da fenda e o comprimento de onda deixa o padrão angular igual. O padrão é também a "assinatura" da fenda: medindo-o, recupera-se a largura. A forma geral (para qualquer abertura) é dada pela transformada de Fourier da abertura; é o que a simulação calcula quando você desenha uma forma livre.

Armadilha: usar a aproximação de ângulos pequenos para fendas comparáveis a $\lambda$. Nesses casos, $\mathrm{sen}\,\theta$ não é próximo de $\theta$, e os mínimos se afastam muito.

No experimento, ajuste a curva teórica $(\mathrm{sen}\,\alpha/\alpha)^2$ aos dados para obter a largura da fenda, e mude $\lambda$ e $a$ na mesma proporção para ver que o padrão não muda.`,
      experiments: [
        { kind: "sim", id: "difracao", scenario: "fenda", note: "Compare o perfil medido com (sen α/α)² e obtenha a largura da fenda." },
        { kind: "sim", id: "difracao", scenario: "desenho", params: { forma: 2 }, note: "Veja o padrão de uma fenda calculado por FFT, em escala logarítmica." },
        { kind: "pratica", id: "exp3-fenda-simples", note: "Meça o perfil de intensidade e ajuste a curva teórica." },
      ],
    },
    "36-6": {
      text: String.raw`Lentes, espelhos de telescópio e a pupila do olho são aberturas **circulares**. A difração por um orifício circular de diâmetro $d$ produz uma mancha central brilhante, o **disco de Airy**, cercada por anéis fracos. O primeiro mínimo está em

$$\mathrm{sen}\,\theta = 1{,}22\,\frac{\lambda}{d}.$$

O fator $1{,}22$ (em vez de $1$ da fenda) vem da geometria circular, que tem menos área perto das bordas.

### Resolução
Duas fontes pontuais distantes, como duas estrelas, produzem através da mesma lente dois discos de Airy. Se os discos se sobrepõem demais, as fontes parecem uma só. O **critério de Rayleigh** estabelece o limite: as fontes estão no limite de resolução quando o máximo central de uma cai sobre o primeiro mínimo da outra. A menor separação angular resolvida é

$$\theta_R \approx 1{,}22\,\frac{\lambda}{d}.$$

Para resolver detalhes menores é preciso aumentar o diâmetro ou diminuir o comprimento de onda. Por isso telescópios têm espelhos grandes, radiotelescópios combinam antenas espalhadas por continentes e microscópios eletrônicos usam elétrons de comprimento de onda muito curto.

Exemplo: a pupila humana, com $d = 3{,}0$ mm, em $\lambda = 550$ nm, resolve $\theta_R \approx 2{,}2\times10^{-4}$ rad. A $10$ m, isso corresponde a separar dois pontos a $2{,}2$ mm um do outro. Já os faróis de um carro, separados $1{,}4$ m, deixam de ser vistos como dois a cerca de $6$ km. É o mesmo efeito que funde os pontos de uma pintura pontilhista vista de longe.

Armadilha: achar que aumentar o aumento de um telescópio sempre revela mais detalhes. Acima do limite de difração, o aumento só amplia a mancha.

No experimento, aproxime duas fontes até o limite de Rayleigh e mude o diâmetro da abertura e o comprimento de onda; desenhe também um círculo e observe os anéis do disco de Airy.`,
      experiments: [
        { kind: "sim", id: "difracao", scenario: "rayleigh", note: "Aproxime as fontes até o limite de Rayleigh e varie D e λ." },
        { kind: "sim", id: "difracao", scenario: "desenho", params: { forma: 1 }, note: "Veja o disco de Airy e os anéis de uma abertura circular." },
      ],
    },
    "36-7": {
      text: String.raw`No experimento de Young (seção 35-4), tratamos as fendas como infinitamente estreitas. Fendas reais têm largura $a$, e cada uma produz seu próprio padrão de difração. Como as duas fendas difratam na mesma direção, o resultado é o padrão de interferência de duas fendas **modulado** pelo de difração de uma fenda:

$$I(\theta) = I_m\,\cos^2\beta\,\left(\frac{\mathrm{sen}\,\alpha}{\alpha}\right)^2,\qquad \beta = \frac{\pi d}{\lambda}\,\mathrm{sen}\,\theta,\quad \alpha = \frac{\pi a}{\lambda}\,\mathrm{sen}\,\theta.$$

O fator $\cos^2\beta$ produz franjas finas e próximas (separação $d$ grande); o fator de difração forma uma **envoltória** larga (largura $a$ pequena). As franjas de interferência ficam dentro dela.

Quando um máximo de interferência ($d\,\mathrm{sen}\,\theta = m\lambda$) coincide com um mínimo de difração ($a\,\mathrm{sen}\,\theta = m'\lambda$), ele **desaparece**: é uma **ordem ausente**. Isso acontece quando $d/a$ é um número inteiro ou racional simples. Se $d = 3a$, por exemplo, as ordens $3, 6, 9, \dots$ faltam.

Exemplo: $d = 0{,}30$ mm e $a = 0{,}10$ mm, com $\lambda = 550$ nm. A razão $d/a = 3$ indica que a franja de ordem $3$ cai sobre o primeiro mínimo da envoltória. Dentro do pico central da envoltória cabem as franjas $m = 0, \pm1, \pm2$: cinco franjas claras.

Em geral, o número de franjas claras no pico central da envoltória é $2(d/a) - 1$, quando $d/a$ é inteiro. A forma da envoltória permite medir $a$, e o espaçamento das franjas, $d$, a partir do mesmo padrão.

Armadilha: atribuir a variação de altura das franjas de Young a um "erro" de montagem. A queda de brilho ao se afastar do centro é a envoltória de difração de cada fenda.

No experimento, observe a envoltória com $d = 3a$ e procure as ordens ausentes; mude $a$ mantendo $d$ e veja quantas franjas cabem no pico central.`,
      experiments: [
        { kind: "sim", id: "fenda-dupla", scenario: "envoltoria", note: "Encontre as ordens ausentes onde a envoltória de difração se anula." },
        { kind: "sim", id: "fenda-dupla", scenario: "envoltoria", params: { a: 0.05 }, note: "Estreite as fendas e conte as franjas dentro do pico central." },
        { kind: "sim", id: "cuba-ondas", scenario: "dupla", note: "Veja na água o padrão de fenda dupla com fendas de largura finita." },
      ],
    },
    "36-8": {
      text: String.raw`Uma **rede de difração** é uma placa com um grande número $N$ de fendas (ou ranhuras) paralelas, igualmente espaçadas de $d$. Tipicamente, $d$ é de alguns micrômetros e $N$ chega a milhares. Os máximos principais estão nas mesmas posições que para duas fendas:

$$d\,\mathrm{sen}\,\theta = m\lambda,\qquad m = 0, 1, 2, \dots,$$

mas, com muitas fendas, eles ficam **extremamente estreitos e brilhantes**, separados por regiões quase escuras com $N - 2$ máximos secundários fraquíssimos. São as **linhas** do espectro.

### Largura das Linhas
O máximo de ordem $m$ termina no mínimo vizinho, onde as ondas das $N$ fendas, com fasores formando um polígono fechado, se cancelam. A meia-largura angular de uma linha é

$$\Delta\theta_{\text{ml}} = \frac{\lambda}{N d\cos\theta}.$$

Quanto mais fendas iluminadas (maior $Nd$, a largura total da rede), mais fina a linha.

### O Espectroscópio de Rede
Num **espectroscópio**, a luz de uma fonte passa por uma fenda, é colimada, atravessa a rede e é observada por uma luneta que gira e mede $\theta$. Cada comprimento de onda presente produz uma linha em cada ordem, permitindo identificar elementos pelas suas linhas características. Ao contrário do prisma, a rede desvia **mais** o vermelho que o azul, e a relação entre ângulo e $\lambda$ é exata, sem depender do material.

Exemplo: rede de $600$ linhas por milímetro ($d = 1{,}67\ \mu$m) com a luz de $589$ nm do sódio. Primeira ordem: $\mathrm{sen}\,\theta = 0{,}353$, $\theta \approx 20{,}7^\circ$. A maior ordem possível é a que mantém $\mathrm{sen}\,\theta \le 1$: $m \le d/\lambda = 2{,}8$, logo há só as ordens $1$ e $2$ de cada lado.

Armadilha: achar que aumentar o número de fendas muda a posição das linhas. A posição depende só de $d$ e $\lambda$; $N$ muda a largura.

No experimento, aumente o número de fendas e veja as linhas ficarem mais finas sem sair do lugar; na bancada, meça o comprimento de onda de um laser com uma rede conhecida.`,
      experiments: [
        { kind: "sim", id: "difracao", scenario: "rede", params: { N: 5 }, note: "Comece com 5 fendas e aumente N: as linhas afinam sem mudar de lugar." },
        { kind: "pratica", id: "exp3-rede", note: "Meça o comprimento de onda com uma rede de difração." },
        { kind: "sim", id: "espectros-laser", note: "Observe linhas de emissão de gases no espectroscópio de rede." },
      ],
    },
    "36-9": {
      text: String.raw`Para separar comprimentos de onda próximos, uma rede precisa de duas qualidades distintas.

**Dispersão** é o quanto as linhas de comprimentos de onda diferentes se afastam angularmente:

$$D = \frac{\Delta\theta}{\Delta\lambda} = \frac{m}{d\cos\theta}.$$

Cresce com a ordem e com ranhuras mais próximas. Uma dispersão grande separa bem os centros das linhas.

**Resolução** é a capacidade de ver como duas as linhas de $\lambda$ e $\lambda + \Delta\lambda$, que exige que elas não se sobreponham. Pelo critério de Rayleigh, a separação angular deve ser pelo menos a meia-largura de uma linha (seção 36-8). Daí resulta o **poder de resolução**

$$R = \frac{\lambda_{\text{méd}}}{\Delta\lambda} = Nm.$$

Ele depende do **número total de fendas iluminadas** e da ordem, não do espaçamento.

As duas grandezas são independentes. Três redes com o mesmo $N$ e espaçamentos diferentes têm o mesmo poder de resolução e dispersões diferentes; duas redes com o mesmo $d$ e $N$ diferentes têm a mesma dispersão e resoluções diferentes. A dispersão diz onde ficam as linhas; a resolução diz se elas são finas o bastante para não se misturar.

Exemplo: o dubleto amarelo do sódio tem linhas em $589{,}00$ nm e $589{,}59$ nm, separadas por $0{,}59$ nm. É preciso $R = 589/0{,}59 \approx 1000$. Em primeira ordem, uma rede precisa de pelo menos $1000$ fendas iluminadas; em segunda ordem, bastam $500$. Com só $200$ fendas, seria preciso ir à quinta ordem ($5\cdot200 = 1000$), o que exige $d \ge 5\lambda \approx 3\ \mu$m.

Armadilha: confundir dispersão com resolução e achar que basta afastar as linhas (por exemplo, olhando de mais longe) para separá-las. Se elas são largas demais, afastá-las também as alarga na mesma proporção.

No experimento, use a lâmpada de sódio e procure o menor $N$ que resolve o dubleto em primeira e em segunda ordem; compare com $R = Nm$.`,
      experiments: [
        { kind: "sim", id: "difracao", scenario: "rede", note: "Varie N e a ordem até resolver o dubleto do sódio; confira R = Nm." },
        { kind: "sim", id: "difracao", scenario: "rede", params: { d: 2 }, note: "Diminua o período da rede e veja a dispersão aumentar." },
        { kind: "sim", id: "interferometros", scenario: "fabry-perot", note: "Compare com o Fabry–Perot, que resolve o dubleto com muito mais folga." },
      ],
    },
    "36-10": {
      text: String.raw`Os **raios X** são ondas eletromagnéticas com comprimentos de onda da ordem de $0{,}1$ nm, comparáveis à distância entre átomos num sólido. Uma rede óptica comum, com $d$ de micrômetros, daria ângulos de difração minúsculos. Mas um **cristal**, com seus átomos dispostos num arranjo regular tridimensional, funciona como uma rede natural com o espaçamento certo.

Uma forma prática de analisar o problema, devida a W. L. Bragg, é imaginar o cristal como uma pilha de **planos atômicos** paralelos, separados por $d$. Cada plano reflete fracamente os raios X, como um espelho; as ondas refletidas por planos sucessivos interferem. Para um feixe que faz um ângulo $\theta$ com os planos (atenção: ângulo com o **plano**, não com a normal), a diferença de percurso entre planos vizinhos é $2d\,\mathrm{sen}\,\theta$, e há reflexão intensa quando

$$2d\,\mathrm{sen}\,\theta = m\lambda,\qquad m = 1, 2, 3, \dots$$

Essa é a **lei de Bragg**. Um mesmo cristal tem muitas famílias de planos, com espaçamentos diferentes, e cada uma dá reflexões numa direção própria; o conjunto dos ângulos e intensidades permite reconstruir a estrutura do cristal.

A lei funciona nos dois sentidos. Com um cristal de espaçamento conhecido, mede-se o comprimento de onda dos raios X (é assim que se analisam os espectros de tubos de raios X). Com raios X de $\lambda$ conhecido, mede-se o espaçamento e se determina a estrutura.

Exemplo: raios X de $0{,}154$ nm (linha do cobre) num cristal de cloreto de sódio, com planos separados por $0{,}282$ nm. Primeira ordem: $\mathrm{sen}\,\theta = 0{,}154/(2\cdot0{,}282) = 0{,}273$, $\theta \approx 15{,}8^\circ$. A segunda ordem aparece em $\mathrm{sen}\,\theta = 0{,}546$, $\theta \approx 33^\circ$.

A mesma ideia vale para elétrons, cujo comprimento de onda de de Broglie também é da ordem do espaçamento atômico (capítulo 38).

Armadilha: medir $\theta$ em relação à normal, como na refração. Na lei de Bragg, $\theta$ é o ângulo com os planos, e o feixe difratado se desvia de $2\theta$ em relação ao incidente.

No experimento, gire o cristal no difratômetro, encontre os picos da linha Kα e calcule $\lambda$ pela lei de Bragg; depois veja os anéis de difração de elétrons no grafite.`,
      experiments: [
        { kind: "sim", id: "raios-x", scenario: "bragg", note: "Gire o cristal, localize os picos e calcule λ por 2d sen θ = mλ." },
        { kind: "sim", id: "difracao-eletrons", scenario: "aneis", note: "Veja os anéis de Debye–Scherrer de elétrons num cristal de grafite." },
        { kind: "pratica", id: "exp3-difracao-eletrons", note: "Meça a distância interplanar do grafite pela difração de elétrons." },
      ],
    },
  },
};
