import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 43,
  intro: String.raw`A curva de energia de ligação por núcleon do capítulo 42 tem um máximo perto do ferro. Isso abre dois caminhos para extrair energia do núcleo: **partir** um núcleo pesado em dois de massa intermediária (**fissão**) ou **juntar** dois núcleos leves num mais pesado (**fusão**). Nos dois casos, os núcleons terminam mais fortemente ligados, a massa total diminui e a diferença aparece como energia, segundo $E = mc^2$. Por quilograma de combustível, essas reações liberam milhões de vezes mais energia do que qualquer reação química. Neste capítulo vemos como a fissão do urânio acontece, por que ela permite uma reação em cadeia, como um reator a controla (e como a natureza montou um sozinha), como a fusão alimenta o Sol e as estrelas e por que reproduzi-la na Terra de forma controlada é tão difícil.`,
  sections: {
    "43-2": {
      text: String.raw`Em 1938, Hahn e Strassmann bombardearam urânio com nêutrons esperando produzir elementos mais pesados e encontraram bário, de massa quase metade da do urânio. Meitner e Frisch interpretaram o resultado: o núcleo tinha se partido em dois. Chamaram o processo de **fissão**, emprestando o termo da divisão celular.

Um nêutron lento é absorvido pelo urânio-235, formando urânio-236 num estado muito excitado, que se divide em dois **fragmentos** e alguns nêutrons livres. Um canal típico:

$$n + {}^{235}\mathrm{U} \rightarrow {}^{236}\mathrm{U}^* \rightarrow {}^{141}\mathrm{Ba} + {}^{92}\mathrm{Kr} + 3n.$$

Os fragmentos variam de uma fissão para outra; a divisão costuma ser **assimétrica**, com um fragmento perto de $A \approx 95$ e outro perto de $A \approx 140$.

### Quanta energia
Pela curva de energia de ligação, o urânio tem cerca de $7{,}6$ MeV por núcleon e os fragmentos, cerca de $8{,}5$ MeV. Cada um dos 236 núcleons fica uns $0{,}9$ MeV mais ligado, e a energia liberada é da ordem de

$$Q \approx 236 \times 0{,}9\ \text{MeV} \approx 200\ \text{MeV}.$$

A maior parte (cerca de 170 MeV) sai como energia cinética dos fragmentos, que se repelem eletricamente e logo são freados no material, aquecendo-o. O resto vem dos nêutrons, de raios gama e dos decaimentos posteriores.

Exemplo: $1{,}0$ kg de urânio-235 tem $(1000/235)\cdot6{,}02\times10^{23} = 2{,}6\times10^{24}$ núcleos. Fissionando todos, a energia é $2{,}6\times10^{24}\cdot200\ \text{MeV}\cdot1{,}6\times10^{-13}\ \text{J/MeV} \approx 8\times10^{13}$ J, o mesmo que queimar uns 2,7 milhões de quilos de carvão.

### Os produtos
Como os núcleos pesados têm proporcionalmente mais nêutrons que os de massa média, os fragmentos nascem **ricos em nêutrons** e muito radioativos: decaem por uma série de emissões $\beta^-$ até chegar ao vale de estabilidade. Esses produtos de fissão são a parte mais problemática do lixo nuclear. Além disso, alguns fragmentos emitem nêutrons segundos depois da fissão, os **nêutrons atrasados**, que serão essenciais para controlar um reator.

Armadilha: achar que a energia vem de "quebrar ligações", como numa reação química. Vem de os núcleons passarem a ficar **mais** ligados nos fragmentos do que estavam no urânio.

No experimento, observe uma fissão do urânio-235, compare as massas antes e depois e veja qual fragmento sai mais rápido; troque o par de fragmentos e confira como mudam a energia e o número de nêutrons.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "fissao", note: "Acompanhe uma fissão e calcule a energia liberada pelo defeito de massa." },
        { kind: "sim", id: "nuclear", scenario: "fissao", params: { canal: 1 }, note: "Troque os fragmentos e compare a energia e o número de nêutrons emitidos." },
        { kind: "sim", id: "nuclear", scenario: "ligacao", params: { A: 236 }, note: "Compare a energia de ligação por núcleon do urânio com a dos fragmentos." },
      ],
    },
    "43-3": {
      text: String.raw`O modelo da **gota líquida** (seção 42-9) dá uma imagem clara da fissão, proposta por Bohr e Wheeler em 1939. Dois efeitos competem quando o núcleo se deforma:

- a **tensão superficial** nuclear (o termo de superfície da energia de ligação) tende a manter a forma esférica, que tem a menor área;
- a **repulsão coulombiana** entre os prótons tende a separar as cargas e favorece formas alongadas.

Para pequenas deformações a superfície vence, e o núcleo volta a ficar esférico. Mas, se ele se alongar o bastante, formando um "pescoço", a repulsão entre as duas metades passa a dominar e ele se parte. Entre a forma esférica e a de ruptura existe portanto uma **barreira de fissão** de energia $E_b$, de cerca de 5 a 6 MeV para os núcleos de urânio. Quanto maior $Z^2/A$, mais baixa a barreira; para núcleos muito mais pesados que o urânio ela desaparece, e eles se partem espontaneamente quase de imediato.

### Por que nêutrons lentos fissionam o U-235 e não o U-238
Quando um núcleo absorve um nêutron, a energia de excitação do núcleo composto é a energia de ligação desse nêutron, mais a energia cinética que ele trazia. Aí entra o termo de emparelhamento:

- $^{235}\mathrm{U} + n \rightarrow {}^{236}\mathrm{U}^*$: o nêutron completa um par e fica ligado com cerca de $6{,}5$ MeV, acima da barreira de $\approx 5{,}2$ MeV. Mesmo um nêutron **térmico** (energia de $0{,}025$ eV) provoca fissão;
- $^{238}\mathrm{U} + n \rightarrow {}^{239}\mathrm{U}^*$: o nêutron entra desemparelhado, com uns $4{,}8$ MeV, abaixo da barreira de $\approx 5{,}7$ MeV. Só nêutrons **rápidos**, de mais de cerca de 1 MeV, fissionam o U-238, e com baixa probabilidade.

Exemplo: um nêutron térmico absorvido pelo U-235 deixa o núcleo $6{,}5 - 5{,}2 = 1{,}3$ MeV acima do topo da barreira. Para o U-238, faltam $5{,}7 - 4{,}8 = 0{,}9$ MeV, que o nêutron teria de trazer como energia cinética. É por isso que o combustível dos reatores precisa de U-235, que forma só $0{,}7\%$ do urânio natural.

A barreira também explica a **fissão espontânea**: por tunelamento, como no decaimento alfa, o núcleo pode atravessá-la sem receber energia, mas a probabilidade é muito pequena para o urânio.

Armadilha: achar que o nêutron "quebra" o núcleo por impacto, como uma bala. Ele quase não traz energia; o que provoca a fissão é a energia de ligação liberada quando ele é capturado.

No experimento, mova $A$ na curva de energia de ligação e compare o peso dos termos de superfície e de Coulomb nos núcleos leves e nos pesados; depois veja a gota excitada se partir.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "ligacao", params: { A: 235 }, note: "Compare os termos de superfície e de Coulomb da gota líquida no urânio." },
        { kind: "sim", id: "nuclear", scenario: "fissao", note: "Veja o núcleo composto excitado se alongar e se partir." },
      ],
    },
    "43-4": {
      text: String.raw`Cada fissão do U-235 libera em média cerca de $2{,}5$ nêutrons. Se pelo menos um deles provocar outra fissão, o processo se sustenta: é a **reação em cadeia**. O parâmetro que decide tudo é o **fator de multiplicação**

$$k = \frac{\text{nêutrons de uma geração}}{\text{nêutrons da geração anterior}}.$$

Com $k < 1$ (**subcrítico**), a população de nêutrons morre; com $k = 1$ (**crítico**), mantém-se constante e a potência é estável; com $k > 1$ (**supercrítico**), cresce exponencialmente. Um reator opera em $k = 1$.

### As perdas de nêutrons
- **Fuga**: nêutrons que escapam pela superfície. A produção cresce com o volume e a fuga com a área; por isso existe um **tamanho crítico** abaixo do qual a cadeia não se mantém.
- **Captura sem fissão**: o U-238, mais abundante, absorve nêutrons de energia intermediária (ressonâncias) sem se partir.
- **Energia errada**: os nêutrons nascem rápidos (cerca de 2 MeV), mas o U-235 fissiona com muito mais probabilidade com nêutrons térmicos. Um **moderador** (água, água pesada ou grafite), feito de núcleos leves, freia os nêutrons por colisões, como uma bola de bilhar que perde muita energia ao bater em outra de massa igual.

### O controle
**Barras de controle** de cádmio ou boro absorvem nêutrons e ajustam $k$. Isso só é possível graças aos **nêutrons atrasados** (seção 43-2): sem eles, o tempo entre gerações seria de milissegundos e a potência mudaria rápido demais; com eles, as variações levam segundos e o sistema de controle tem tempo de agir.

### O reator de água pressurizada
No tipo mais comum, a água sob alta pressão é ao mesmo tempo moderador e refrigerante: atravessa o núcleo, esquenta a uns $300\ ^\circ$C sem ferver e entrega o calor num gerador de vapor a um segundo circuito, cujo vapor gira a turbina. O combustível é urânio enriquecido a 3–5% em U-235.

Exemplo: uma usina de $1000$ MW elétricos com eficiência de $33\%$ produz $3000$ MW de calor. São $3{,}0\times10^9/(200\cdot1{,}6\times10^{-13}) \approx 9\times10^{19}$ fissões por segundo, que consomem cerca de $3$ kg de U-235 por dia. Uma usina a carvão equivalente queima uns 8 mil toneladas por dia.

Armadilha: confundir um reator com uma bomba. No reator, com urânio pouco enriquecido e moderador, $k$ fica em torno de 1 e a potência é controlada pelos nêutrons atrasados; uma explosão nuclear exige material muito enriquecido em que a cadeia cresce com nêutrons rápidos.

No experimento, aumente o raio de uma esfera de U-235 até ela ficar crítica; depois use urânio natural com grafite, ou enriquecido com água, e traga o núcleo de volta a $k = 1$ com as barras de controle.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "cadeia", note: "Aumente o raio da esfera de U-235 até a população de nêutrons crescer." },
        { kind: "sim", id: "nuclear", scenario: "cadeia", params: { enr: 3, moderador: 2, R: 100 }, note: "Com urânio a 3% e água, insira as barras de controle até chegar a k = 1." },
        { kind: "sim", id: "nuclear", scenario: "cadeia", params: { enr: 0.7, moderador: 1, R: 600 }, note: "Monte uma pilha de urânio natural com grafite, como a de Fermi." },
      ],
    },
    "43-5": {
      text: String.raw`Em 1972, num laboratório francês, uma remessa de urânio vinda da mina de **Oklo**, no Gabão, apresentou uma anomalia: a fração de U-235 era um pouco menor que os $0{,}720\%$ encontrados em todo urânio natural da Terra, da Lua e dos meteoritos. Em algumas amostras, caía a $0{,}44\%$. Alguma coisa tinha consumido U-235. A investigação mostrou que, há cerca de dois bilhões de anos, aquele depósito funcionou como um **reator nuclear natural**, intermitentemente, durante centenas de milhares de anos.

### Por que era possível naquela época
O U-235 decai mais rápido que o U-238 (meias-vidas de $0{,}70$ e $4{,}5$ bilhões de anos), então no passado havia proporcionalmente mais U-235. A razão entre eles cresce, para trás no tempo, como

$$\frac{N_{235}}{N_{238}}(t\ \text{atrás}) = \frac{N_{235}}{N_{238}}(\text{hoje})\;e^{(\lambda_{235} - \lambda_{238})\,t}.$$

Exemplo: com $\lambda_{235} = 0{,}693/0{,}704 = 0{,}98$ por bilhão de anos e $\lambda_{238} = 0{,}693/4{,}47 = 0{,}155$ por bilhão de anos, para $t = 2{,}0$ bilhões de anos o fator é $e^{0{,}83\cdot2{,}0} \approx 5{,}2$. A razão atual, $0{,}0073$, vira $0{,}038$: o urânio natural tinha cerca de $3{,}7\%$ de U-235, praticamente o enriquecimento do combustível dos reatores de água leve de hoje. Faltava um moderador, e a **água subterrânea** que infiltrava o minério fez esse papel.

O reator se regulava sozinho: quando a potência subia, a água fervia ou era expulsa, a moderação diminuía e a reação parava; ao esfriar, a água voltava e a cadeia recomeçava.

### As provas
- O U-235 estava empobrecido exatamente nas zonas mais ricas em urânio.
- Os elementos produzidos por fissão, como o neodímio e o rutênio, aparecem com proporções de isótopos típicas de **produtos de fissão**, muito diferentes das naturais.
- A quantidade de produtos indica que algumas toneladas de U-235 fissionaram, liberando uma energia média de dezenas de quilowatts por milhares de séculos.

Os produtos de fissão ficaram quase imóveis na rocha por dois bilhões de anos, o que interessa a quem estuda o armazenamento geológico do lixo nuclear. Hoje um reator natural é impossível: com $0{,}72\%$ de U-235, a água leve absorve nêutrons demais.

Armadilha: achar que a natureza não pode produzir uma reação em cadeia. As condições físicas são as mesmas de um reator; só a composição isotópica do urânio mudou com o tempo.

No experimento, monte o núcleo com urânio a $3{,}7\%$ e água como moderador e veja a cadeia se sustentar; depois baixe o enriquecimento para o valor de hoje e veja $k$ cair abaixo de 1 para qualquer tamanho.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "cadeia", params: { enr: 3.7, moderador: 2, R: 100 }, note: "Com o urânio de dois bilhões de anos atrás e água, veja a cadeia se sustentar." },
        { kind: "sim", id: "nuclear", scenario: "cadeia", params: { enr: 0.7, moderador: 2, R: 100 }, note: "Com o urânio natural de hoje e água, confirme que k fica abaixo de 1." },
        { kind: "sim", id: "decaimento", scenario: "simples", note: "Lembre por que o isótopo de meia-vida mais curta fica mais raro com o tempo." },
      ],
    },
    "43-6": {
      text: String.raw`Na **fusão**, dois núcleos leves se juntam num mais pesado. Pela curva de energia de ligação, que sobe muito depressa entre os núcleos leves, o ganho de energia por núcleon é ainda maior que na fissão. A reação mais fácil de produzir é a do deutério com o trítio:

$$^{2}\mathrm{H} + {}^{3}\mathrm{H} \rightarrow {}^{4}\mathrm{He} + n,\qquad Q = 17{,}6\ \text{MeV}.$$

Exemplo: por quilograma de combustível D–T, a energia é $17{,}6\ \text{MeV}\cdot1{,}6\times10^{-13}\ \text{J/MeV}/(5 \cdot 1{,}66\times10^{-27}\ \text{kg}) \approx 3{,}4\times10^{14}$ J/kg, cerca de quatro vezes a da fissão completa do U-235.

### A barreira coulombiana
O problema é juntar os núcleos. Ambos são positivos, e a força nuclear só age quando eles se tocam, a poucos fermis. A energia potencial elétrica nessa distância é a **barreira coulombiana**: cerca de $0{,}4$ MeV para D–T e da mesma ordem para dois prótons. Num acelerador é fácil dar essa energia a alguns núcleos, mas eles perdem energia ionizando o alvo muito antes de colidir com outro núcleo; o rendimento é inútil.

### Fusão **termo**nuclear
A saída é aquecer o gás até que a agitação térmica faça os núcleos colidirem com energia suficiente. A energia média de agitação é da ordem de $kT$; mesmo a $15$ milhões de kelvins, $kT = 8{,}6\times10^{-5}\ \text{eV/K}\cdot1{,}5\times10^{7}\ \text{K} \approx 1{,}3$ keV, centenas de vezes menor que a barreira. A fusão acontece assim mesmo por dois motivos que se combinam:

- a **distribuição de Maxwell** tem uma cauda de núcleos muito mais rápidos que a média;
- o **tunelamento** (seção 42-5) permite atravessar a barreira sem chegar ao topo, com probabilidade que cresce rapidamente com a energia.

O produto das duas curvas, uma caindo e outra subindo, tem um máximo, o **pico de Gamow**: a maior parte das fusões ocorre numa faixa estreita, algumas vezes acima de $kT$ e muito abaixo da barreira. A essas temperaturas, a matéria é um **plasma**: os átomos perderam todos os elétrons.

Armadilha: achar que a fusão exige que os núcleos tenham energia maior que a barreira. Se fosse assim, nem o Sol funcionaria; sem o tunelamento, não haveria fusão nas estrelas.

No experimento, veja a barreira coulombiana entre D e T, mude a energia da colisão e acompanhe a probabilidade de tunelamento; depois mude a temperatura do plasma e veja o pico de Gamow se deslocar.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "fusao", note: "Veja a barreira D–T e localize o pico de Gamow." },
        { kind: "sim", id: "nuclear", scenario: "fusao", params: { E: 100 }, note: "Aumente a energia da colisão e veja a probabilidade de tunelamento crescer." },
        { kind: "sim", id: "tunelamento", scenario: "tunel", note: "Reveja o tunelamento de um pacote de onda por uma barreira mais alta que a sua energia." },
      ],
    },
    "43-7": {
      text: String.raw`O Sol irradia $3{,}8\times10^{26}$ W há cerca de $4{,}6$ bilhões de anos. Nenhuma fonte química ou gravitacional sustentaria isso; a fonte é a fusão de hidrogênio em hélio no núcleo, onde a temperatura chega a $1{,}5\times10^7$ K e a densidade a 150 vezes a da água.

### A cadeia próton-próton
No Sol, o processo dominante é uma sequência de reações:

$$p + p \rightarrow {}^{2}\mathrm{H} + e^+ + \nu,$$

$$^{2}\mathrm{H} + p \rightarrow {}^{3}\mathrm{He} + \gamma,$$

$$^{3}\mathrm{He} + {}^{3}\mathrm{He} \rightarrow {}^{4}\mathrm{He} + p + p.$$

A primeira etapa transforma um próton em nêutron, o que só a interação fraca faz; por isso é extremamente lenta: um próton do núcleo solar espera em média bilhões de anos para participar dela. Essa lentidão é o que faz o Sol durar tanto. Somando tudo (e contando a aniquilação dos pósitrons com elétrons), o balanço é

$$4p \rightarrow {}^{4}\mathrm{He} + 2e^+ + 2\nu,\qquad Q \approx 26{,}7\ \text{MeV},$$

dos quais cerca de $0{,}5$ MeV escapam com os neutrinos. Detectar esses neutrinos solares na Terra confirmou que a teoria está certa.

Exemplo: a perda de massa do Sol é $P/c^2 = 3{,}8\times10^{26}/(3{,}0\times10^{8})^2 \approx 4{,}3\times10^{9}$ kg/s. Como cada reação de $26{,}2$ MeV ($4{,}2\times10^{-12}$ J) consome quatro prótons, o Sol transforma cerca de $6\times10^{11}$ kg de hidrogênio por segundo, ou 600 milhões de toneladas. Mesmo assim, o hidrogênio do núcleo dura uns 10 bilhões de anos.

### Depois do hidrogênio
Quando o hidrogênio do núcleo acaba, ele se contrai e esquenta. A cerca de $10^8$ K começa a **queima do hélio**: três núcleos de hélio formam carbono-12, e daí vem o oxigênio. Estrelas de massa bem maior que a do Sol continuam a fusão até o silício e o ferro, em camadas como uma cebola. No ferro a cadeia termina, porque juntar mais núcleons não libera energia (ele está no topo da curva). O núcleo de ferro colapsa numa **supernova**; os elementos mais pesados que o ferro se formam por captura rápida de nêutrons em explosões desse tipo e em colisões de estrelas de nêutrons. O carbono do seu corpo e o ferro do seu sangue foram fabricados em estrelas.

Armadilha: imaginar o Sol como uma fogueira gigante. Nenhuma combustão química duraria mais que algumas dezenas de milhares de anos com essa potência.

No experimento, acompanhe a evolução de uma estrela como o Sol no diagrama HR e veja as fases de queima de hidrogênio e de hélio; depois compare com uma estrela de massa bem maior.`,
      experiments: [
        { kind: "sim", id: "estrelas-hr", scenario: "evolucao", note: "Acompanhe a evolução do Sol no diagrama HR, da sequência principal à gigante vermelha." },
        { kind: "sim", id: "estrelas-hr", scenario: "evolucao", params: { M: 15 }, note: "Repita com uma estrela de 15 massas solares e compare o tempo de vida." },
        { kind: "sim", id: "nuclear", scenario: "ligacao", params: { A: 4 }, note: "Veja na curva de ligação por que fundir hidrogênio em hélio libera tanta energia e por que a fusão para no ferro." },
      ],
    },
    "43-8": {
      text: String.raw`Reproduzir a fusão na Terra como fonte de energia é um objetivo perseguido desde os anos 1950. O combustível é abundante (o deutério existe na água do mar, e o trítio pode ser produzido a partir do lítio) e não há reação em cadeia que possa disparar. A dificuldade é cumprir três exigências ao mesmo tempo:

- **temperatura alta**: para D–T, cerca de $10^8$ K ($kT \approx 10$ keV), para que haja fusões suficientes (seção 43-6);
- **densidade** $n$ de partículas alta, para que as colisões sejam frequentes;
- **tempo de confinamento** $\tau$ longo, para que o plasma não perca a energia antes de devolvê-la em fusões.

As duas últimas se combinam no **critério de Lawson**: para que a energia de fusão compense as perdas, é preciso aproximadamente

$$n\,\tau \gtrsim 10^{20}\ \text{s/m}^3\quad\text{(D–T a cerca de 10 keV).}$$

Exemplo: num plasma com $n = 10^{20}$ partículas por metro cúbico (cem mil vezes mais rarefeito que o ar), a energia precisa ficar confinada por pelo menos $1$ s. Com densidade mil vezes maior, bastaria um milissegundo.

### Confinamento magnético
Nenhum material resiste a $10^8$ K. Como o plasma é formado de partículas carregadas, um campo magnético pode prendê-lo: as partículas giram em hélices em torno das linhas de campo e não chegam às paredes. No **tokamak**, as linhas fecham-se em espiral num toro (uma rosca). Esses aparelhos já produziram potências de fusão de megawatts por alguns segundos; o ITER, em construção, foi projetado para gerar dez vezes mais potência de fusão do que a usada para aquecer o plasma.

### Confinamento inercial
A outra estratégia aposta em densidade enorme por tempo curtíssimo: uma pastilha de D–T de um milímetro é comprimida por feixes de laser muito intensos até mil vezes a densidade do sólido. A fusão acontece em menos de um nanossegundo, antes que a pastilha se desfaça, contida apenas pela própria inércia. Em 2022, uma dessas experiências liberou mais energia de fusão do que a energia de laser depositada na pastilha, embora ainda muito menos do que a energia elétrica gasta para alimentar os lasers.

Em ambos os casos, $80\%$ da energia sai com os nêutrons de $14$ MeV, que atravessam o campo magnético e serão freados num manto ao redor, aquecendo-o e produzindo trítio a partir do lítio.

Armadilha: achar que um reator de fusão pode "explodir" como uma bomba. Há muito pouco combustível no plasma a cada instante, e qualquer falha o esfria e apaga a reação.

No experimento, aumente a temperatura do plasma e veja a taxa de fusões crescer; depois prenda uma partícula carregada numa garrafa magnética e veja-a ir e voltar entre as regiões de campo forte.`,
      experiments: [
        { kind: "sim", id: "nuclear", scenario: "fusao", params: { kT: 20 }, note: "Aqueça o plasma e veja o número de fusões D–T crescer." },
        { kind: "sim", id: "particula-campo-b", scenario: "garrafa", note: "Prenda uma partícula carregada numa garrafa magnética, a ideia do confinamento magnético." },
      ],
    },
  },
};
