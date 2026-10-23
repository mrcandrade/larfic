import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 35,
  intro: String.raw`A óptica geométrica explica espelhos e lentes, mas não explica as cores de uma bolha de sabão, as franjas que aparecem quando a luz passa por duas fendas estreitas nem o funcionamento de um interferômetro capaz de medir deslocamentos menores que um comprimento de onda. Para isso é preciso tratar a luz como **onda** e somar ondas que chegam ao mesmo ponto por caminhos diferentes. Essa **interferência** é a base de medidas de altíssima precisão, de revestimentos antirreflexo e dos detectores de ondas gravitacionais.`,
  sections: {
    "35-2": {
      text: String.raw`Huygens propôs uma construção geométrica simples para seguir uma onda: **todos os pontos de uma frente de onda funcionam como fontes de ondas secundárias esféricas**; depois de um tempo $t$, a nova frente de onda é a superfície tangente a todas essas ondinhas. Num meio homogêneo, uma frente plana continua plana e avança $vt$.

### Lei da Refração
Uma frente de onda plana chega inclinada à fronteira entre dois meios. Enquanto uma ponta dela ainda percorre a distância até a fronteira no meio 1, com velocidade $v_1$, as ondinhas que já entraram no meio 2 crescem com velocidade $v_2$. Se $v_2 < v_1$, a frente se dobra, e a geometria dos dois triângulos dá $\mathrm{sen}\,\theta_1/\mathrm{sen}\,\theta_2 = v_1/v_2$. Com $n = c/v$, isso é a lei de Snell, agora deduzida.

### Comprimento de Onda e Índice de Refração
A frequência é imposta pela fonte e **não muda** ao passar de um meio para outro (cada crista que chega à fronteira gera uma do outro lado). Como a velocidade muda, o comprimento de onda muda:

$$\lambda_n = \frac{\lambda}{n},$$

em que $\lambda$ é o comprimento de onda no vácuo. Consequência importante: duas ondas que percorrem a mesma distância $L$ em meios diferentes saem defasadas. O número de comprimentos de onda em $L$ é $N = Ln/\lambda$, e a diferença de fase, em comprimentos de onda, é

$$N_2 - N_1 = \frac{L}{\lambda}(n_2 - n_1).$$

Exemplo: luz de $600$ nm atravessa $5{,}0\ \mu$m de vidro ($n = 1{,}50$) enquanto outra onda percorre $5{,}0\ \mu$m de ar. A diferença é $5000\cdot0{,}50/600 \approx 4{,}2$ comprimentos de onda; a parte fracionária, $0{,}2$, é o que conta para a interferência.

### Arco-íris e Interferência Óptica
O arco-íris da seção 33-8 também tem uma assinatura ondulatória: perto da borda interna do arco primário aparecem às vezes faixas fracas, os **arcos supranumerários**, causados pela interferência entre raios que percorrem caminhos ligeiramente diferentes dentro da gota.

Armadilha: achar que a cor da luz muda ao entrar na água porque o comprimento de onda muda. A cor percebida depende da frequência, que se conserva.

No experimento, observe as frentes de onda de uma fonte na cuba e confira $\lambda = v/f$; depois, no princípio de Fermat, veja a refração emergir do tempo de percurso.`,
      experiments: [
        { kind: "sim", id: "cuba-ondas", scenario: "uma", note: "Meça λ das frentes de onda e confira λ = v/f." },
        { kind: "sim", id: "principio-fermat", scenario: "refracao", note: "Veja a lei de Snell surgir das diferentes velocidades nos dois meios." },
        { kind: "sim", id: "prisma", scenario: "ceu", note: "Observe o arco-íris primário e o secundário no céu." },
      ],
    },
    "35-3": {
      text: String.raw`Quando uma onda passa por uma abertura cuja largura é comparável ao comprimento de onda, ela não segue em linha reta como um feixe recortado: **espalha-se** para os lados. Esse fenômeno é a **difração**. Pela construção de Huygens, os pontos da abertura emitem ondinhas em todas as direções, e nada as obriga a ficar dentro da "sombra geométrica".

Quanto mais estreita a abertura comparada a $\lambda$, mais a onda se abre. Para uma fenda de largura $a$, a ordem de grandeza do ângulo de abertura é

$$\theta \sim \frac{\lambda}{a}.$$

Com ondas na água, de alguns centímetros, a difração por uma abertura num quebra-mar é bem visível. O som, com $\lambda$ da ordem de um metro, contorna portas e esquinas. A luz visível, com $\lambda$ de meio micrômetro, só se difrata de modo perceptível por aberturas muito estreitas; por isso, no dia a dia, sombras parecem nítidas e a óptica geométrica funciona.

Exemplo: luz de $500$ nm passando por uma fenda de $0{,}10$ mm se abre num ângulo da ordem de $5\times10^{-3}$ rad; numa tela a $2$ m, a mancha tem uns $1$ cm, bem maior que a fenda. A mesma luz por uma janela de $1$ m se abre $5\times10^{-7}$ rad, imperceptível.

A difração é também o que permite o experimento de interferência da próxima seção: cada fenda precisa espalhar a luz para que os feixes das duas fendas se sobreponham na tela. O estudo detalhado do padrão de difração fica para o capítulo 36.

Armadilha: dizer que, estreitando a fenda, o feixe fica mais fino. Abaixo de certo ponto acontece o contrário: quanto mais estreita a fenda, mais **largo** o feixe que sai dela.

No experimento, mande uma onda plana contra uma fenda na cuba e diminua a largura até a onda se espalhar em leque; depois, com luz, varie a largura de uma fenda e observe a mancha central se alargar.`,
      experiments: [
        { kind: "sim", id: "cuba-ondas", scenario: "fenda", note: "Estreite a fenda e veja a onda se abrir em leque atrás dela." },
        { kind: "sim", id: "difracao", scenario: "fenda", note: "Diminua a largura da fenda e veja a mancha central se alargar." },
      ],
    },
    "35-4": {
      text: String.raw`Em 1801, Thomas Young fez a luz de uma fonte passar por uma fenda e depois por duas fendas paralelas próximas. Numa tela distante apareceram faixas claras e escuras alternadas, as **franjas de interferência**. Nenhuma teoria corpuscular explicava as faixas escuras: em certos pontos, luz somada a luz dava escuridão.

Cada ponto da tela recebe uma onda de cada fenda. Se a tela está a uma distância $D$ muito maior que a separação $d$ entre as fendas, os dois raios que chegam a um ponto no ângulo $\theta$ são quase paralelos, e a **diferença de percurso** é

$$\Delta L = d\,\mathrm{sen}\,\theta.$$

Quando $\Delta L$ é um número inteiro de comprimentos de onda, as ondas chegam em fase e há uma **franja clara** (máximo):

$$d\,\mathrm{sen}\,\theta = m\lambda,\qquad m = 0, 1, 2, \dots$$

Quando é um número semi-inteiro, chegam em oposição e há uma **franja escura** (mínimo):

$$d\,\mathrm{sen}\,\theta = \left(m + \tfrac12\right)\lambda.$$

O número $m$ é a **ordem** da franja; a franja central ($m = 0$) é clara. Para ângulos pequenos, a posição na tela é $y \approx D\tan\theta \approx D\theta$, e as franjas ficam igualmente espaçadas:

$$\Delta y = \frac{\lambda D}{d}.$$

Exemplo: fendas separadas por $0{,}25$ mm, tela a $1{,}5$ m e laser de $633$ nm: $\Delta y = 633\times10^{-9}\cdot1{,}5/(0{,}25\times10^{-3}) \approx 3{,}8$ mm. Medindo $\Delta y$, $d$ e $D$, Young obteve o primeiro valor do comprimento de onda da luz.

Armadilha: achar que nas franjas escuras a energia "se perde". Ela é redistribuída: as franjas claras recebem o dobro da intensidade média (seção 35-6).

No experimento, varie $\lambda$, $d$ e $D$ e confira $\Delta y = \lambda D/d$; na cuba, veja as linhas nodais entre as duas fontes.`,
      experiments: [
        { kind: "sim", id: "fenda-dupla", scenario: "classico", note: "Meça o espaçamento das franjas e confira Δy = λD/d." },
        { kind: "sim", id: "fenda-dupla", scenario: "cor", note: "Varie λ ao vivo e veja as franjas se afastarem para o vermelho." },
        { kind: "sim", id: "cuba-ondas", scenario: "duas", note: "Observe as linhas nodais de duas fontes em fase na água." },
      ],
    },
    "35-5": {
      text: String.raw`Para que franjas de interferência estáveis apareçam, a diferença de fase entre as duas ondas num ponto da tela precisa permanecer **constante no tempo**. Fontes com essa propriedade são **coerentes**.

A luz comum é emitida por um número enorme de átomos, cada um durante um intervalo curtíssimo (da ordem de nanossegundos) e com fase aleatória. Duas lâmpadas independentes iluminando a mesma região produzem um padrão de interferência que muda bilhões de vezes por segundo; o olho e qualquer detector veem só a média, que é uniforme. Essas fontes são **incoerentes**, e as intensidades simplesmente se somam: $I = I_1 + I_2$.

Young contornou o problema iluminando as duas fendas com a luz de **uma única** fenda anterior. Assim, cada mudança aleatória de fase da fonte chega às duas fendas ao mesmo tempo, e a diferença de fase entre elas fica fixa. O mesmo truque aparece em todo interferômetro: dividir **um** feixe em dois e depois reuni-los.

A coerência também tem limites. A **coerência temporal** está ligada à largura espectral da fonte: se o caminho percorrido por um feixe excede o outro em mais que o **comprimento de coerência**, as franjas desaparecem. Para luz branca, esse comprimento é de poucos micrômetros; por isso só a franja central e as primeiras de cada lado aparecem, coloridas. Para uma lâmpada espectral, chega a milímetros ou centímetros; para um laser estabilizado, pode passar de quilômetros. A **coerência espacial** depende do tamanho da fonte: uma fonte extensa ilumina as fendas com fases diferentes vindas de pontos diferentes, e o padrão se apaga se a fonte for grande demais.

Exemplo: a luz de um LED com largura espectral de $30$ nm em torno de $600$ nm tem comprimento de coerência da ordem de $\lambda^2/\Delta\lambda = 12\ \mu$m: as franjas somem a partir da ordem $m \approx 20$.

Armadilha: dizer que só lasers interferem. Qualquer luz interfere consigo mesma, desde que a diferença de percurso seja menor que o comprimento de coerência.

No experimento, alargue a banda espectral da fonte no interferômetro de Michelson e veja as franjas perderem nitidez quando a diferença de caminho passa do comprimento de coerência, $\lambda^2/\Delta\lambda$; depois troque o laser por luz branca na fenda dupla e veja quantas franjas sobrevivem e como se colorem.`,
      experiments: [
        { kind: "sim", id: "filmes-finos", scenario: "coerencia", note: "Varie a largura espectral e veja o contraste das franjas cair com a diferença de caminho." },
        { kind: "sim", id: "fenda-dupla", scenario: "branca", note: "Com luz branca, conte as franjas que sobrevivem e observe as cores." },
        { kind: "sim", id: "filmes-finos", scenario: "michelson", note: "No Michelson, afaste o espelho e veja até onde as franjas permanecem nítidas." },
      ],
    },
    "35-6": {
      text: String.raw`Para calcular a intensidade em qualquer ponto da tela, e não só nos máximos e mínimos, soma-se os campos elétricos das duas ondas. Se cada uma chega com amplitude $E_0$ e a diferença de fase entre elas é $\phi$, a amplitude resultante é $2E_0\cos(\phi/2)$, e a intensidade

$$I = 4I_0\cos^2\frac{\phi}{2},\qquad \phi = \frac{2\pi d}{\lambda}\,\mathrm{sen}\,\theta,$$

em que $I_0$ é a intensidade que uma só fenda produziria. A fase sai da diferença de percurso: cada comprimento de onda corresponde a $2\pi$ rad.

Nos máximos, $\phi = 2\pi m$ e $I = 4I_0$; nos mínimos, $I = 0$. A **média** sobre muitas franjas é $2I_0$, exatamente o que as duas fendas dariam se fossem incoerentes. A interferência não cria nem destrói energia: só a redistribui.

A soma pode ser feita com **fasores**: cada onda é uma seta girando com velocidade angular $\omega$, de comprimento igual à amplitude; a resultante é a soma vetorial das setas. Com duas setas iguais separadas pelo ângulo $\phi$, a geometria do triângulo isósceles dá diretamente $2E_0\cos(\phi/2)$. O método se estende a três ou mais ondas, e será usado para a difração (capítulo 36).

Exemplo: num ponto em que a diferença de percurso é $\lambda/3$, a fase é $\phi = 2\pi/3$, e $I = 4I_0\cos^2 60^\circ = I_0$: a intensidade é a de uma fenda só, um quarto do máximo.

Na prática, as fendas têm largura finita, e a curva $\cos^2$ fica multiplicada pela envoltória de difração de uma fenda (seção 36-7). Se as fendas forem muito estreitas, a envoltória é larga e as franjas têm todas praticamente a mesma altura.

Armadilha: somar intensidades em vez de campos. Duas ondas coerentes de intensidade $I_0$ dão de $0$ a $4I_0$, e não sempre $2I_0$.

No experimento, escolha fendas muito estreitas e compare o perfil medido com $4I_0\cos^2(\phi/2)$; depois feche uma fenda e veja a intensidade cair para a de uma só.`,
      experiments: [
        { kind: "sim", id: "fenda-dupla", scenario: "classico", params: { modelo: 1 }, note: "Com fendas muito estreitas, compare o perfil com 4I₀cos²(φ/2)." },
        { kind: "sim", id: "fenda-dupla", scenario: "classico", params: { modelo: 2 }, note: "Abra só uma fenda e compare a intensidade com a de duas." },
        { kind: "sim", id: "lissajous-fourier", note: "Some fasores de mesma frequência e veja a amplitude depender da fase." },
      ],
    },
    "35-7": {
      text: String.raw`As cores de uma bolha de sabão, de uma mancha de óleo no asfalto molhado ou da asa de algumas borboletas vêm da interferência entre a luz refletida na face de cima e na face de baixo de uma película muito fina.

Considere luz quase perpendicular a um filme de espessura $L$ e índice $n_2$, entre meios de índices $n_1$ e $n_3$. Duas coisas determinam a fase entre os dois raios refletidos:

- **diferença de percurso**: o raio que entra no filme anda $2L$ a mais, com comprimento de onda $\lambda/n_2$;
- **mudança de fase na reflexão**: a reflexão numa interface com meio de índice **maior** inverte a onda (equivale a meio comprimento de onda); com índice menor, não há inversão.

Para um filme no ar ($n_1 = n_3 = 1 < n_2$), como a bolha de sabão, só a primeira reflexão inverte a fase. Então

$$2L = \left(m + \tfrac12\right)\frac{\lambda}{n_2}\ \text{(claro)},\qquad 2L = m\,\frac{\lambda}{n_2}\ \text{(escuro)}.$$

Se as duas reflexões invertem a fase (ou nenhuma), as condições trocam de lugar. Quando o filme fica muito mais fino que $\lambda$, a diferença de percurso some, e na bolha sobra só a inversão: a película aparece **escura** pouco antes de estourar.

Exemplo: um **revestimento antirreflexo** de fluoreto de magnésio ($n = 1{,}38$) sobre vidro ($n = 1{,}50$). As duas reflexões invertem a fase, de modo que a reflexão é mínima quando $2L = \lambda/(2n)$. Para $\lambda = 550$ nm, $L = 550/(4\cdot1{,}38) \approx 100$ nm. O verde é pouco refletido, e as lentes tratadas parecem arroxeadas.

Com espessura variável, cada espessura reforça uma cor: surgem faixas coloridas que acompanham as linhas de igual espessura. Uma lente convexa apoiada num vidro plano cria uma lâmina de ar de espessura crescente a partir do centro, e aparecem os **anéis de Newton**, cujo raio permite medir a curvatura da lente.

Armadilha: esquecer a inversão de fase na reflexão e prever claro onde há escuro.

No experimento, deposite sobre o vidro um revestimento de espessura fixa e veja a refletância cair a quase zero só perto do comprimento de onda em que a espessura vale $\lambda/4n$; observe também as cores da película de sabão enquanto ela afina e, nos anéis de Newton, meça os raios e obtenha o raio de curvatura da lente.`,
      experiments: [
        { kind: "sim", id: "filmes-finos", scenario: "antirreflexo", note: "Com o revestimento fixo, veja a refletância variar com a cor e ache o mínimo." },
        { kind: "sim", id: "filmes-finos", scenario: "bolha", note: "Acompanhe as cores da película enquanto ela afina até ficar escura." },
        { kind: "sim", id: "filmes-finos", scenario: "newton", note: "Meça o raio dos anéis de Newton e calcule a curvatura da lente." },
        { kind: "sim", id: "filmes-finos", scenario: "bolha", params: { nf: 1.38, ns: 1, e0: 200 }, note: "Monte um revestimento fino sobre vidro e procure a espessura antirreflexo." },
      ],
    },
    "35-8": {
      text: String.raw`O **interferômetro de Michelson** divide um feixe em dois com um espelho semitransparente. Cada metade vai até um espelho, volta e as duas se reencontram no divisor, seguindo juntas até o observador. Se os braços têm comprimentos $L_1$ e $L_2$, a diferença de percurso é $2(L_2 - L_1)$, e o padrão de franjas depende dela.

Deslocar um dos espelhos de $\lambda/2$ muda a diferença de percurso de $\lambda$: o padrão passa por um ciclo completo, e uma franja passa pelo ponto de observação. Contando $N$ franjas enquanto o espelho anda $\Delta L$:

$$2\,\Delta L = N\lambda.$$

Exemplo: o espelho é movido $0{,}158$ mm e passam $500$ franjas; então $\lambda = 2\cdot0{,}158\times10^{-3}/500 = 632$ nm. Inversamente, conhecendo $\lambda$, mede-se deslocamentos de frações de micrômetro.

Também é possível medir **índices de refração**. Colocando num braço uma célula de comprimento $L$ cujo gás vai sendo bombeado, o número de comprimentos de onda no percurso de ida e volta muda de $2L(n-1)/\lambda$ em relação ao vácuo, e esse é o número de franjas contadas.

O instrumento tem papel histórico. Michelson e Morley o usaram para procurar o movimento da Terra em relação ao suposto "éter" e encontraram resultado nulo, um dos pontos de partida da relatividade (capítulo 37). Hoje, interferômetros de Michelson com braços de quilômetros detectam ondas gravitacionais medindo variações de comprimento menores que o diâmetro de um próton.

Armadilha: achar que uma franja corresponde a um deslocamento de $\lambda$ do espelho. Como a luz vai e volta, basta $\lambda/2$.

No experimento, ligue o motor do espelho, conte as franjas e calcule $\lambda$; depois bombeie gás na célula e determine o índice de refração. Na versão de micro-ondas, faça o mesmo com o refletor arrastável.`,
      experiments: [
        { kind: "sim", id: "filmes-finos", scenario: "michelson", note: "Conte as franjas enquanto o espelho anda e calcule λ = 2ΔL/N." },
        { kind: "sim", id: "filmes-finos", scenario: "gas", note: "Bombeie gás na célula e determine n − 1 pela contagem de franjas." },
        { kind: "sim", id: "interferometros", scenario: "michelson-mo", note: "Mova o refletor no Michelson de micro-ondas e meça λ." },
        { kind: "pratica", id: "exp3-michelson-microondas", note: "Meça o comprimento de onda das micro-ondas com o interferômetro." },
      ],
    },
  },
};
