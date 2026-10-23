import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 42,
  intro: String.raw`Até aqui o núcleo foi só um ponto positivo no centro do átomo, responsável pela carga e por quase toda a massa. Neste capítulo ele vira o objeto de estudo. Veremos como se descobriu que ele existe, do que é feito, qual o seu tamanho e por que alguns núcleos são estáveis e outros se transformam espontaneamente, emitindo partículas alfa, elétrons, pósitrons ou raios gama. As energias envolvidas são de **milhões de elétrons-volts**, um milhão de vezes maiores que as das reações químicas, e a relação $E = mc^2$ passa a ser uma ferramenta de contabilidade do dia a dia. As aplicações aparecem em toda parte: datação de fósseis e rochas, medicina nuclear, radioterapia, proteção radiológica. O capítulo termina com os modelos que tentam descrever um núcleo com dezenas de prótons e nêutrons, e prepara o terreno para a fissão e a fusão do capítulo 43.`,
  sections: {
    "42-2": {
      text: String.raw`No início do século XX, o modelo atômico mais aceito era o de Thomson: uma esfera de carga positiva espalhada por todo o volume do átomo, com os elétrons embutidos nela. Para testar essa ideia, o grupo de Rutherford bombardeou folhas finíssimas de ouro com **partículas alfa** (núcleos de hélio, carga $+2e$, energia de alguns MeV) e contou, num anteparo cintilante, quantas eram desviadas em cada ângulo.

Se a carga positiva estivesse diluída por todo o átomo, o campo elétrico dentro dele seria fraco, e as alfas, pesadas e rápidas, passariam quase sem desvio: ângulos de, no máximo, uma fração de grau. O resultado foi outro. A grande maioria atravessava sem desvio, mas cerca de uma em alguns milhares era desviada de mais de $90°$, e algumas voltavam quase pelo mesmo caminho. Rutherford concluiu que a carga positiva e quase toda a massa estão concentradas numa região minúscula, o **núcleo**, e que o átomo é praticamente vazio.

Com um núcleo pontual de carga $Ze$, a força entre ele e a alfa é coulombiana em todo o trajeto. Uma colisão frontal permite estimar o tamanho máximo do núcleo: a alfa para quando toda a energia cinética $K$ virou energia potencial,

$$d = \frac{1}{4\pi\varepsilon_0}\,\frac{(2e)(Ze)}{K}.$$

Exemplo: alfas de $6{,}0$ MeV contra ouro ($Z = 79$). Usando $e^2/4\pi\varepsilon_0 = 1{,}44$ MeV·fm, $d = 1{,}44 \cdot 2 \cdot 79 / 6{,}0 \approx 38$ fm. Como o espalhamento continua seguindo a lei coulombiana mesmo nessas colisões, o núcleo de ouro tem de ser menor que isso. Hoje sabemos que seu raio é de cerca de $7$ fm, enquanto o átomo tem uns $10^5$ fm. Se o núcleo fosse uma bolinha de gude, o átomo seria um estádio de futebol.

A distribuição de ângulos prevista por Rutherford cai como $1/\sin^4(\theta/2)$: ângulos grandes são raros, mas não impossíveis. Só desvios por **um único** encontro com uma carga concentrada produzem essa cauda.

Armadilha: achar que as alfas que voltam "batem" no núcleo. Elas nem chegam a tocá-lo; são repelidas pelo campo elétrico intenso que só existe perto de uma carga concentrada.

No experimento, dispare alfas contra o núcleo pontual e compare o histograma com a curva $1/\sin^4(\theta/2)$; depois troque para o átomo de Thomson e veja os ângulos grandes desaparecerem.`,
      experiments: [
        { kind: "sim", id: "modelos-atomicos", scenario: "rutherford", note: "Conte as alfas desviadas em cada ângulo e compare com a lei de Rutherford." },
        { kind: "sim", id: "modelos-atomicos", scenario: "thomson", note: "Repita com a carga positiva espalhada (Thomson) e veja sumirem os desvios grandes." },
        { kind: "sim", id: "modelos-atomicos", scenario: "rutherford", params: { K: 6 }, note: "Com alfas de 6 MeV, calcule a distância de máxima aproximação e compare com o tamanho do núcleo." },
      ],
    },
    "42-3": {
      text: String.raw`Um núcleo é formado por **prótons** e **nêutrons**, chamados em conjunto de **núcleons**. Três números o descrevem: o **número atômico** $Z$ (prótons), o **número de nêutrons** $N$ e o **número de massa** $A = Z + N$. Um núcleo específico é um **nuclídeo**, escrito como $^{A}_{Z}\mathrm{X}$; por exemplo, $^{16}_{8}\mathrm{O}$. Nuclídeos com o mesmo $Z$ e $A$ diferentes são **isótopos**: têm a mesma química e massas diferentes, e por isso podem ser separados num espectrômetro de massa.

Num gráfico de $N$ contra $Z$, os nuclídeos estáveis formam uma faixa estreita, o **vale de estabilidade**. Para núcleos leves ela segue $N \approx Z$; para os pesados, inclina-se para $N > Z$, porque nêutrons extras ajudam a manter unidos muitos prótons que se repelem. Fora da faixa, os núcleos são radioativos.

### Tamanho e densidade
Experimentos de espalhamento mostram que o raio cresce com $A^{1/3}$:

$$r = r_0 A^{1/3},\qquad r_0 \approx 1{,}2\ \text{fm}.$$

O volume é proporcional a $A$, então a **densidade é a mesma** em todos os núcleos: os núcleons se empacotam como bolinhas numa gota. Ela vale cerca de $2\times10^{17}$ kg/m³; uma colher de chá de matéria nuclear pesaria um bilhão de toneladas.

### Massa e energia de ligação
Massas nucleares são dadas em **unidades de massa atômica** (1 u $= 1{,}6605\times10^{-27}$ kg, com $1\ \text{u}\cdot c^2 = 931{,}5$ MeV). A massa de um núcleo é **menor** que a soma das massas dos seus núcleons separados. A diferença, multiplicada por $c^2$, é a **energia de ligação**, a energia que seria preciso fornecer para desmontá-lo:

$$\Delta E_{\text{lig}} = \left(Z m_{\mathrm{H}} + N m_n - M\right)c^2.$$

Exemplo: para o $^{16}\mathrm{O}$, $8 \cdot 1{,}007825 + 8 \cdot 1{,}008665 - 15{,}994915 = 0{,}137$ u, ou seja, $127{,}6$ MeV; por núcleon, $8{,}0$ MeV. O gráfico da **energia de ligação por núcleon** sobe nos leves, tem máximo perto do ferro ($\approx 8{,}8$ MeV) e cai devagar até o urânio ($7{,}6$ MeV). Essa curva explica por que a fissão de pesados e a fusão de leves liberam energia (capítulo 43).

### A força nuclear
O que segura os núcleons é a **força nuclear forte**: atrativa, muito intensa, de alcance curto (alguns fm) e praticamente igual entre próton–próton, nêutron–nêutron e próton–nêutron. Por ter alcance curto, cada núcleon só interage com os vizinhos imediatos, o que explica a densidade constante e o patamar da curva de ligação.

Armadilha: pensar que a energia de ligação é energia "guardada" no núcleo. É o contrário: é a energia que **falta** a ele em relação aos núcleons livres, e por isso a massa é menor.

No experimento, mova $A$ ao longo da curva de energia de ligação e veja qual termo domina em cada região; no espectrômetro, separe os isótopos do urânio.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "ligacao", note: "Percorra a curva B/A e localize o máximo perto do ferro." },
        { kind: "sim", id: "nuclear", scenario: "ligacao", params: { A: 16 }, note: "Leia a energia de ligação do oxigênio-16 e compare com o cálculo pelas massas." },
        { kind: "sim", id: "particula-campo-b", scenario: "espectrometro", params: { isotopos: 3 }, note: "Separe U-235 e U-238 pelo raio da trajetória no espectrômetro de massa." },
      ],
    },
    "42-4": {
      text: String.raw`Um núcleo instável se transforma espontaneamente em outro, emitindo uma ou mais partículas. O fato decisivo é que esse processo é **aleatório**: não há como prever quando um dado núcleo vai decair, só a probabilidade de que isso aconteça num intervalo de tempo. Para cada nuclídeo instável, essa probabilidade por unidade de tempo é uma constante $\lambda$, a **constante de desintegração**, que não depende da idade do núcleo, da temperatura nem da química.

Se há $N$ núcleos, o número médio que decai em $dt$ é $\lambda N\,dt$, logo $dN/dt = -\lambda N$ e

$$N(t) = N_0\,e^{-\lambda t}.$$

A **atividade** $R$ é o número de decaimentos por segundo, $R = \lambda N = R_0 e^{-\lambda t}$, medida em **becquerel** (1 Bq = 1 decaimento/s); a unidade antiga, o curie, vale $3{,}7\times10^{10}$ Bq. Duas escalas de tempo resumem o decaimento:

$$T_{1/2} = \frac{\ln 2}{\lambda},\qquad \tau = \frac{1}{\lambda}.$$

A **meia-vida** $T_{1/2}$ é o tempo para que metade dos núcleos presentes decaia; a **vida média** $\tau$ é o tempo médio de vida de um núcleo. Num gráfico de $\ln N$ contra $t$, os pontos formam uma reta de inclinação $-\lambda$: é assim que se mede a meia-vida no laboratório.

Exemplo: o iodo-131, usado no tratamento da tireoide, tem $T_{1/2} \approx 8{,}0$ dias, então $\lambda = 0{,}693/(8{,}0 \cdot 86\,400\ \text{s}) = 1{,}0\times10^{-6}\ \text{s}^{-1}$. Uma amostra de $1{,}0\ \mu$g contém $N = (10^{-6}/131)\cdot6{,}02\times10^{23} = 4{,}6\times10^{15}$ núcleos e tem atividade $R = \lambda N \approx 4{,}6\times10^{9}$ Bq. Depois de 24 dias (três meias-vidas), restam $1/8$ dos núcleos e $1/8$ da atividade.

Como o processo é estatístico, uma amostra com poucos núcleos se afasta da exponencial: o número de decaimentos num intervalo flutua com desvio típico $\sqrt{n}$ (estatística de Poisson). A lei exponencial vale para a média, e fica precisa quando $N$ é grande.

Armadilha: achar que, se em uma meia-vida decai a metade, em duas decai tudo. Em cada meia-vida decai metade **do que sobrou**: depois de duas, resta um quarto.

No experimento, observe a grade de núcleos decaindo, ajuste a reta de $\ln N$ contra $t$ para obter a meia-vida e, com poucos núcleos, veja as flutuações em torno da exponencial.`,
      experiments: [
        { kind: "sim", id: "decaimento", scenario: "simples", note: "Meça a meia-vida pelo ajuste de ln N contra t." },
        { kind: "sim", id: "decaimento", scenario: "poucos", note: "Com 100 núcleos, veja as flutuações estatísticas em torno da exponencial." },
        { kind: "concepcao", id: "meia-vida-dobro", note: "Confronte a ideia de que em duas meias-vidas tudo decai." },
      ],
    },
    "42-5": {
      text: String.raw`No **decaimento alfa**, um núcleo pesado emite um núcleo de hélio-4 (dois prótons e dois nêutrons). O número atômico cai de 2 e o de massa cai de 4. Por exemplo, o urânio-238:

$$^{238}\mathrm{U} \rightarrow\ ^{234}\mathrm{Th} + {}^{4}\mathrm{He},\qquad Q = 4{,}27\ \text{MeV}.$$

O **valor de** $Q$ é a energia liberada, calculada pela diferença de massas: $Q = (M_{\text{pai}} - M_{\text{filho}} - M_{\text{He}})c^2$. Só há decaimento se $Q > 0$. Como o momento total é nulo, a alfa leva quase toda a energia: $K_\alpha = Q\,(A-4)/A \approx 4{,}20$ MeV, e o núcleo filho recua com o resto.

### O enigma da barreira
A alfa, uma vez formada dentro do núcleo, é presa pela força nuclear e, fora dele, repelida pela força coulombiana. A energia potencial forma uma **barreira**: para o tório ($Z = 90$), a energia coulombiana no contato, a uns $9$ fm do centro, é $1{,}44 \cdot 2 \cdot 90/9{,}3 \approx 28$ MeV. Uma alfa com $4{,}2$ MeV não teria como passar por cima dela. Classicamente, o urânio-238 seria estável.

A explicação é o **tunelamento** (capítulo 38): a função de onda da alfa não se anula dentro da barreira, e existe uma probabilidade pequena de encontrá-la do lado de fora. A cada choque contra a "parede", ela tem uma chance minúscula de escapar. Como a probabilidade de tunelar depende exponencialmente da largura e da altura da barreira, pequenas mudanças em $Q$ mudam a meia-vida de forma colossal:

- urânio-238, $Q \approx 4{,}3$ MeV: $T_{1/2} = 4{,}5\times10^9$ anos;
- polônio-212, $Q \approx 9{,}0$ MeV: $T_{1/2} \approx 0{,}3\ \mu$s.

Dobrar a energia muda a meia-vida por um fator de $10^{23}$.

Armadilha: imaginar que a alfa "ganha energia" para escapar. Ela sai com a mesma energia que tinha dentro; o que muda é só a probabilidade de atravessar a região proibida.

No experimento, mande um pacote de onda contra uma barreira mais alta que a sua energia e meça a fração transmitida; aumente a largura da barreira e veja essa fração despencar. Na fusão D–T, o mesmo tunelamento acontece no sentido contrário, de fora para dentro.`,
      experiments: [
        { kind: "sim", id: "tunelamento", scenario: "tunel", note: "Meça a probabilidade de atravessar uma barreira mais alta que a energia do pacote." },
        { kind: "sim", id: "tunelamento", scenario: "tunel", params: { a: 3 }, note: "Dobre a largura da barreira e veja a transmissão cair exponencialmente." },
        { kind: "sim", id: "nuclear", scenario: "fusao", note: "Veja a barreira coulombiana entre dois núcleos e a probabilidade de tunelamento." },
      ],
    },
    "42-6": {
      text: String.raw`No **decaimento beta**, o número de massa não muda, mas $Z$ muda de uma unidade: um nêutron vira próton, ou o contrário. Há duas formas:

$$\beta^-:\quad n \rightarrow p + e^- + \bar\nu,\qquad \beta^+:\quad p \rightarrow n + e^+ + \nu.$$

Exemplo de $\beta^-$: $^{32}\mathrm{P} \rightarrow\ ^{32}\mathrm{S} + e^- + \bar\nu$, com $T_{1/2} = 14$ dias, usado em medicina. Exemplo de $\beta^+$: $^{18}\mathrm{F} \rightarrow\ ^{18}\mathrm{O} + e^+ + \nu$, a base dos exames de PET. Núcleos com nêutrons demais (acima do vale de estabilidade) tendem ao $\beta^-$; os com prótons demais, ao $\beta^+$ ou à **captura eletrônica**, em que o núcleo absorve um elétron da camada K. O elétron emitido não estava no núcleo: é criado no momento do decaimento.

### O espectro contínuo e o neutrino
Se só o elétron e o núcleo filho saíssem, a conservação de energia e momento daria ao elétron sempre a mesma energia, como na alfa. Mas as medidas mostram um **espectro contínuo**, de zero até um máximo $K_{\max} \approx Q$. Para não abandonar a conservação de energia, Pauli propôs que uma terceira partícula, neutra e de massa quase nula, levasse a energia que falta: o **neutrino**. Ele interage tão pouco que atravessa a Terra quase sempre sem colidir com nada, e só foi detectado em 1956, junto a um reator nuclear.

A energia liberada é $Q = \Delta m\,c^2$. Para o $\beta^-$ com massas **atômicas**, $Q = (M_{\text{pai}} - M_{\text{filho}})c^2$, pois os elétrons dos átomos se compensam. Exemplo: $^{3}\mathrm{H}$ (trítio, $3{,}016049$ u) $\rightarrow$ $^{3}\mathrm{He}$ ($3{,}016029$ u): $\Delta M = 2{,}0\times10^{-5}$ u, ou seja, $Q \approx 18{,}6$ keV, dividido entre o elétron e o antineutrino em proporções que variam de um decaimento para outro.

Depois de um decaimento alfa ou beta, o núcleo filho costuma ficar num estado excitado e volta ao fundamental emitindo **raios gama**, fótons de energia bem definida (centenas de keV a alguns MeV). Muitos núcleos decaem em **cadeia**: o filho também é radioativo, e cada membro da série tem sua própria meia-vida.

Armadilha: achar que o elétron beta vem da eletrosfera. Ele nasce no núcleo, na conversão de um nêutron em próton.

No experimento, registre milhares de decaimentos do trítio e veja o histograma da energia dos elétrons formar um espectro contínuo que termina no ponto final $Q$; em cada decaimento, o antineutrino leva o resto. Compare com a linha única das alfas do polônio-210 e, depois, acompanhe uma cadeia pai → filho → estável.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "espectro-beta", note: "Acumule decaimentos beta do trítio, veja o espectro contínuo até o ponto final Q e compare com a linha única do alfa." },
        { kind: "sim", id: "decaimento", scenario: "cadeia", note: "Acompanhe o crescimento e a queda do número de núcleos filhos numa cadeia de decaimentos." },
        { kind: "sim", id: "nuclear", scenario: "ligacao", note: "Veja o termo de assimetria (N − Z) na energia de ligação: é ele que empurra os núcleos para o vale de estabilidade." },
      ],
    },
    "42-7": {
      text: String.raw`Como a meia-vida de um nuclídeo não depende de condições externas, o decaimento radioativo funciona como um relógio. Se sabemos quanto havia de um núcleo no início e medimos quanto resta, a idade sai da lei exponencial:

$$t = \frac{1}{\lambda}\ln\frac{N_0}{N} = \frac{T_{1/2}}{\ln 2}\ln\frac{N_0}{N}.$$

### Carbono-14
Na alta atmosfera, nêutrons dos raios cósmicos transformam nitrogênio-14 em **carbono-14** ($T_{1/2} = 5730$ anos). Esse carbono vira $\mathrm{CO_2}$, é absorvido pelas plantas e passa aos animais, de modo que todo ser vivo mantém a mesma proporção de $^{14}\mathrm{C}$ para $^{12}\mathrm{C}$ que a atmosfera, cerca de $1{,}3\times10^{-12}$. Quando o organismo morre, a troca para e o $^{14}\mathrm{C}$ passa a decair sem reposição.

Exemplo: um pedaço de carvão de uma fogueira antiga tem $40\%$ da atividade por grama de carbono de uma madeira atual. Então $t = (5730/0{,}693)\ln(1/0{,}40) = 8270 \cdot 0{,}916 \approx 7600$ anos. Hoje, em vez de contar decaimentos, contam-se os próprios átomos de $^{14}\mathrm{C}$ com um espectrômetro de massa acoplado a um acelerador, o que exige amostras de miligramas. O método funciona até umas dez meias-vidas (cerca de 50 mil anos); depois disso sobra pouco demais para medir.

### Rochas e a idade da Terra
Para tempos geológicos usam-se nuclídeos de meia-vida longa: potássio-40 (1,25 bilhão de anos), urânio-238 (4,5 bilhões), rubídio-87. A ideia é a mesma, mas, como não se conhece $N_0$ diretamente, mede-se também o **produto** do decaimento acumulado na rocha, que estava ausente quando ela se solidificou: $N_0 = N + N_{\text{filho}}$. Assim se data a solidificação de lavas, meteoritos e as rochas mais antigas da Terra, e se chega à idade de cerca de $4{,}5$ bilhões de anos para o sistema solar.

Armadilha: aplicar o carbono-14 a dinossauros (65 milhões de anos, mais de 11 mil meias-vidas). Não sobraria nenhum átomo; para essas idades se datam as camadas de rocha vulcânica que envolvem os fósseis.

No experimento, leia a fração de carbono-14 restante numa amostra fóssil, calcule a idade antes de rodar e compare com a estimativa obtida pelo ajuste.`,
      experiments: [
        { kind: "sim", id: "decaimento", scenario: "datacao", note: "Date uma amostra fóssil pela fração de carbono-14 que resta." },
        { kind: "sim", id: "decaimento", scenario: "datacao", params: { amostra: 12 }, note: "Escolha outra amostra e compare a incerteza da idade com a da primeira." },
        { kind: "sim", id: "particula-campo-b", scenario: "espectrometro", params: { isotopos: 2 }, note: "Separe carbono-12, 13 e 14 como faz a datação por espectrometria de massa." },
      ],
    },
    "42-8": {
      text: String.raw`A radiação ionizante (alfas, betas, gamas, raios X, nêutrons) arranca elétrons de átomos e moléculas por onde passa e pode danificar o DNA das células. Para quantificar esse efeito, distinguimos três grandezas que muitas vezes se confundem.

- **Atividade** da fonte, em becquerel: quantos decaimentos por segundo ela tem. Diz o quanto a fonte emite, não o quanto atinge alguém.
- **Dose absorvida** $D$: energia depositada por unidade de massa do material irradiado, medida em **gray** (1 Gy = 1 J/kg). A unidade antiga, o rad, vale $0{,}01$ Gy.
- **Dose equivalente** $H$: a dose absorvida multiplicada por um **fator de peso da radiação** $w_R$ que leva em conta o dano biológico de cada tipo de radiação, medida em **sievert** (Sv). Para fótons e elétrons $w_R = 1$; para prótons, cerca de 2; para alfas, 20, porque depositam a energia de forma muito concentrada ao longo de um rastro curto.

$$D = \frac{E_{\text{absorvida}}}{m},\qquad H = w_R\,D.$$

Exemplo: uma pessoa de $80$ kg absorve $0{,}50$ J de radiação gama distribuídos pelo corpo: $D = 0{,}50/80 = 6{,}3$ mGy e $H = 6{,}3$ mSv. Se a mesma energia viesse de alfas (de uma fonte inalada, por exemplo), $H = 20 \cdot 6{,}3 = 125$ mSv. Para comparação: a radiação natural (radônio, raios cósmicos, alimentos) dá cerca de $2$ a $3$ mSv por ano; uma tomografia de abdome, uns $10$ mSv; e uma dose aguda de $4$ a $5$ Gy no corpo inteiro é letal para metade das pessoas sem tratamento. A energia envolvida é ridícula em termos térmicos (5 Gy aquecem o corpo em um milésimo de grau); o dano vem da ionização localizada.

A **radioterapia** usa justamente esse dano, concentrando dezenas de gray num tumor e poupando o tecido em volta. Fótons depositam dose máxima logo abaixo da pele e decaem lentamente com a profundidade; elétrons param num alcance definido; prótons depositam a maior parte da energia no fim do percurso, no **pico de Bragg**. Combinar feixes de várias direções concentra a dose onde eles se cruzam.

Armadilha: achar que uma fonte de alta atividade é sempre mais perigosa. Importa a dose recebida, que depende da distância, da blindagem, do tempo de exposição e do tipo de radiação.

No experimento, compare as curvas de dose em profundidade de fótons, elétrons e prótons; depois, no planejamento, aumente o número de feixes e veja a dose no tecido sadio cair.`,
      experiments: [
        { kind: "sim", id: "radioterapia", scenario: "comparar", note: "Compare a dose em profundidade de fótons, elétrons e prótons na água." },
        { kind: "sim", id: "radioterapia", scenario: "sobp", note: "Espalhe o pico de Bragg dos prótons para cobrir um tumor inteiro." },
        { kind: "sim", id: "radioterapia", scenario: "plano", params: { nf: 5 }, note: "Combine cinco feixes e veja como a dose se concentra no tumor." },
      ],
    },
    "42-9": {
      text: String.raw`Um núcleo tem de alguns a mais de duzentos núcleons interagindo por uma força que não sabemos escrever de forma simples. Não há como resolver esse problema exatamente; usam-se **modelos**, cada um bom para explicar um conjunto de fatos. Dois deles, de espírito oposto, são os mais importantes.

### O modelo coletivo (gota líquida)
Como cada núcleon só interage com os vizinhos e a densidade é constante, o núcleo se parece com uma gota de líquido incompressível. Daí sai uma fórmula para a energia de ligação com termos de origem clara:

$$\Delta E_{\text{lig}} = a_V A - a_S A^{2/3} - a_C\frac{Z(Z-1)}{A^{1/3}} - a_A\frac{(A-2Z)^2}{A} \pm \delta.$$

O termo de **volume** conta as ligações de cada núcleon com os vizinhos; o de **superfície** desconta os núcleons da borda, que têm menos vizinhos (pesa nos núcleos leves); o de **Coulomb** desconta a repulsão entre prótons (pesa nos pesados); o de **assimetria** favorece $N \approx Z$; o de **emparelhamento** $\delta$ favorece números pares. Com cinco coeficientes ajustados ($a_V \approx 15{,}8$ MeV, por exemplo), a fórmula reproduz a curva de energia de ligação com erro de cerca de 1%.

O modelo também descreve **reações nucleares** pelo **núcleo composto**: um nêutron que entra divide sua energia entre todos os núcleons, o sistema "esquece" como foi formado e depois se desexcita por um dos canais possíveis. É o quadro da fissão no capítulo 43: a gota excitada oscila, se alonga e se parte.

### O modelo de camadas
Certos núcleos são excepcionalmente estáveis: aqueles com $Z$ ou $N$ igual a 2, 8, 20, 28, 50, 82 ou 126, os **números mágicos**. Têm mais isótopos estáveis, energias de ligação maiores e primeiros estados excitados mais altos. O padrão lembra os gases nobres da tabela periódica (capítulo 40). No **modelo de partícula independente**, cada núcleon se move num poço de potencial médio criado pelos demais e ocupa níveis quantizados, obedecendo ao princípio de exclusão. Com um forte acoplamento spin-órbita, os níveis se agrupam em camadas que se completam exatamente nos números mágicos. O $^{208}\mathrm{Pb}$, com $Z = 82$ e $N = 126$, é **duplamente mágico** e muito estável.

### Um modelo combinado
Os núcleons das camadas completas formam um caroço que se comporta coletivamente, enquanto os poucos de fora se movem como partículas independentes e definem o spin e o momento magnético do núcleo.

Armadilha: perguntar qual dos modelos é "o verdadeiro". Nenhum é; cada um é uma aproximação útil para certas perguntas.

No experimento, veja os níveis de um nêutron num poço nuclear com e sem spin–órbita: ligue o acoplamento aos poucos e acompanhe as maiores lacunas se abrirem nos números mágicos 2, 8, 20, 28, 50, 82 e 126, ao lado dos dados experimentais e da gota líquida; depois, na curva de energia de ligação, mova $A$ e veja o peso de cada termo da fórmula.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "camadas", note: "Ligue o spin–órbita num poço de Woods–Saxon e veja as camadas se fecharem nos números mágicos." },
        { kind: "sim", id: "nuclear", scenario: "ligacao", params: { A: 208 }, note: "Veja os termos da fórmula da gota líquida para o chumbo-208 e compare com o ferro-56." },
        { kind: "sim", id: "poco-quantico", scenario: "finito", note: "Veja os níveis quantizados de um poço finito, a base do modelo de camadas." },
        { kind: "sim", id: "nuclear", scenario: "fissao", note: "Veja a gota nuclear excitada se partir em dois fragmentos." },
      ],
    },
  },
};
