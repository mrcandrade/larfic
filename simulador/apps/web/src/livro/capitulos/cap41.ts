import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 41,
  intro: String.raw`Por que o cobre conduz eletricidade tão bem, o diamante quase nada e o silício fica no meio, conduzindo cada vez melhor quando esquenta? A resposta está na física quântica dos sólidos: quando muitos átomos se juntam num cristal, os níveis de energia de cada um se combinam em **bandas** separadas por **gaps**, e o princípio de exclusão de Pauli decide como os elétrons as ocupam. Neste capítulo construímos essa imagem e a usamos para classificar os sólidos em isolantes, metais e semicondutores. Em seguida vemos como a **dopagem** controla a condução nos semicondutores e como uma **junção p-n** dá origem ao diodo retificador, ao LED e às células solares. Terminamos no **transistor**, o dispositivo que, repetido bilhões de vezes num único chip, sustenta toda a eletrônica e a computação.`,
  sections: {
    "41-2": {
      text: String.raw`Para comparar sólidos quanto à condução elétrica, três propriedades medidas bastam:

- a **resistividade** $\rho$ à temperatura ambiente (capítulo 26), em Ω·m;
- o **coeficiente de temperatura da resistividade**, $\alpha = \frac{1}{\rho}\frac{d\rho}{dT}$, em K⁻¹;
- a **concentração de portadores de carga** $n$, o número de portadores por metro cúbico, obtida, por exemplo, pelo efeito Hall (capítulo 28).

Os valores de dois materiais típicos revelam que há duas classes muito diferentes:

- **cobre** (metal): $\rho \approx 2\times10^{-8}$ Ω·m, $\alpha \approx +4\times10^{-3}$ K⁻¹, $n \approx 8\times10^{28}$ m⁻³;
- **silício** (semicondutor): $\rho \approx 3\times10^{3}$ Ω·m, $\alpha \approx -70\times10^{-3}$ K⁻¹, $n \approx 1\times10^{16}$ m⁻³.

A resistividade do silício é cerca de $10^{11}$ vezes maior; ele tem $10^{13}$ vezes menos portadores; e, o mais revelador, sua resistividade **diminui** quando a temperatura aumenta, enquanto a do metal aumenta. Há ainda os **isolantes**, como o diamante, com $\rho$ acima de $10^{16}$ Ω·m.

O modelo clássico de elétrons livres (Drude) explica bem a lei de Ohm e o aumento de $\rho$ com $T$ num metal: os elétrons colidem mais com a rede quando ela vibra mais. Mas não diz **por que** um material tem tantos elétrons livres e outro quase nenhum, nem por que no semicondutor o número de portadores cresce com a temperatura. Isso exige a teoria de bandas.

Exemplo: um fio de cobre de $1{,}0$ m e $1{,}0$ mm² tem resistência de $0{,}02$ Ω; um bastão de silício puro do mesmo tamanho teria cerca de $3$ GΩ. Aquecido de $20$ °C para $30$ °C, o cobre ganha uns $4\%$ de resistência, enquanto o silício perde mais da metade.

Armadilha: achar que um semicondutor é só um "condutor ruim". O comportamento com a temperatura é qualitativamente oposto ao do metal e vem de um mecanismo diferente: no metal, muda o atrito; no semicondutor, muda o número de portadores.

No experimento, compare a resistividade de um metal e de um semicondutor ao variar a temperatura; no efeito Hall, determine a concentração e o sinal dos portadores.`,
      experiments: [
        { kind: "sim", id: "drude", scenario: "temperatura", note: "Aqueça um metal e um semicondutor e compare o comportamento da resistividade." },
        { kind: "sim", id: "motor-hall", scenario: "hall", note: "Meça a tensão Hall e obtenha a concentração e o sinal dos portadores." },
      ],
    },
    "41-3": {
      text: String.raw`Num átomo isolado, cada elétron ocupa um nível de energia bem definido. Aproxime dois átomos iguais: as funções de onda dos elétrons externos se sobrepõem, e cada nível se divide em dois, um pouco acima e um pouco abaixo do original. Com $N$ átomos, cada nível se divide em $N$ níveis. Num cristal real, $N$ é da ordem de $10^{23}$, e esses níveis ficam tão juntos que formam uma faixa praticamente contínua, uma **banda de energia**.

Entre as bandas podem sobrar faixas de energia em que **não há nenhum estado** permitido: são os **gaps** (bandas proibidas). A largura das bandas depende da sobreposição: as de níveis internos, cujos elétrons ficam perto do núcleo, são estreitas; as dos níveis externos, largas.

Outra forma de ver a origem dos gaps: um elétron numa rede periódica é uma onda de de Broglie se propagando num potencial periódico de período $a$. Quando o comprimento de onda satisfaz a condição de Bragg ($\lambda = 2a/n$), as reflexões nos íons se somam em fase, a onda não se propaga, e formam-se ondas estacionárias de duas energias diferentes. Entre elas fica o gap. É o que mostra o modelo de Kronig–Penney, uma fileira de barreiras de potencial.

Cada banda tem $N$ estados espaciais por nível atômico de origem; pelo princípio de Pauli, recebe no máximo $2N$ elétrons (mais, se o nível de origem for degenerado). Como os elétrons enchem os estados de baixo para cima, o que importa é **onde fica o último elétron**: se termina no meio de uma banda ou bem no topo de uma banda cheia, separada da próxima por um gap. Essa diferença classifica os sólidos (seções 41-4 a 41-6).

Exemplo: um grão de silício de $1$ mm³ tem cerca de $5\times10^{19}$ átomos. Se uma banda tem $5$ eV de largura, o espaçamento médio entre seus níveis é $5/(5\times10^{19}) = 10^{-19}$ eV, muito menor que a energia térmica $kT \approx 0{,}026$ eV: na prática, um contínuo.

Armadilha: pensar que um gap é uma região do **espaço** onde o elétron não pode estar. É uma faixa de **energias** que nenhum estado do cristal possui.

No experimento, aumente a força das barreiras do modelo de Kronig–Penney e veja os gaps se abrirem e as bandas se estreitarem; mude o período da rede e veja as energias se deslocarem.`,
      experiments: [
        { kind: "sim", id: "semicondutores", scenario: "kronig-penney", note: "Varie a força das barreiras e veja bandas e gaps se formarem." },
        { kind: "sim", id: "semicondutores", scenario: "kronig-penney", params: { P: 0 }, note: "Zere as barreiras e veja os gaps sumirem: elétron livre." },
      ],
    },
    "41-4": {
      text: String.raw`Num **isolante**, os elétrons preenchem completamente uma ou mais bandas, e a banda vazia mais baixa fica separada da última banda cheia por um gap largo, $E_g$ de vários elétron-volts. A banda cheia é a **banda de valência**; a vazia, a **banda de condução**.

Por que uma banda cheia não conduz? Para haver corrente, o campo elétrico precisa dar aos elétrons um pouco de energia e momento extra, levando-os a estados ligeiramente acima. Numa banda cheia, todos os estados próximos já estão ocupados, e o princípio de Pauli proíbe a transição. A única saída seria saltar o gap inteiro, o que um campo comum não consegue.

A agitação térmica também não ajuda. A probabilidade de um elétron ter energia térmica suficiente para cruzar o gap é da ordem de

$$P \sim e^{-E_g/kT}.$$

Exemplo: o diamante tem $E_g \approx 5{,}5$ eV. À temperatura ambiente, $kT \approx 0{,}026$ eV, então $P \sim e^{-212} \approx 10^{-92}$. Num cristal com cerca de $10^{23}$ elétrons de valência por centímetro cúbico, o número esperado de elétrons na banda de condução é, na prática, zero. Mesmo a $1000$ K, $P \sim 10^{-28}$. O diamante é um excelente isolante (e, curiosamente, um ótimo condutor de calor, que é levado pelas vibrações da rede, não pelos elétrons).

Pela mesma razão, os isolantes de gap largo são **transparentes**: fótons visíveis, de $1{,}8$ a $3{,}1$ eV, não têm energia para levar um elétron através de um gap de $5$ eV e atravessam o material sem ser absorvidos.

Armadilha: achar que o isolante não conduz porque "não tem elétrons livres", como se os elétrons estivessem presos aos átomos. Na teoria de bandas, os elétrons de valência são estados do cristal inteiro; o que impede a condução é não haver estados vazios próximos para onde ir.

No experimento, escolha o diamante e compare a ocupação das bandas com a do silício; aqueça até $800$ K e veja que a banda de condução continua praticamente vazia.`,
      experiments: [
        { kind: "sim", id: "semicondutores", scenario: "materiais", params: { material: 4 }, note: "Escolha o diamante e veja a banda de condução vazia, mesmo aquecido." },
        { kind: "sim", id: "semicondutores", scenario: "materiais", params: { material: 4, T: 800 }, note: "A 800 K, compare a ocupação com a do silício na mesma temperatura." },
      ],
    },
    "41-5": {
      text: String.raw`Num **metal**, a banda mais alta ocupada está só **parcialmente** cheia. Há estados vazios logo acima dos ocupados, e um campo elétrico pequeno consegue levar elétrons a eles: o metal conduz. À temperatura zero, os elétrons ocupam todos os estados até uma energia máxima, a **energia de Fermi** $E_F$; acima dela, tudo vazio.

### Quantos elétrons de condução?
Cada átomo contribui com seus elétrons de valência: $n = (\text{átomos por volume})\times(\text{valência})$. Para o cobre, um elétron por átomo, $n = \rho_m N_A/M \approx 8{,}5\times10^{28}$ m⁻³.

### Condutividade acima do zero absoluto
Ao aquecer, só os elétrons com energias a poucos $kT$ de $E_F$ podem ser excitados, pois os de baixo não têm estados vazios por perto. A distribuição quase não muda; por isso a condutividade de um metal mal depende do número de portadores, e o aumento de $\rho$ com $T$ vem das colisões com a rede vibrante.

### Quantos estados?
Tratando os elétrons como partículas numa caixa 3D, a **densidade de estados** (estados por volume e por intervalo de energia) é

$$N(E) = \frac{8\sqrt2\,\pi\,m^{3/2}}{h^3}\,E^{1/2}.$$

### Probabilidade de ocupação
A fração ocupada de estados de energia $E$ é dada pela **distribuição de Fermi–Dirac**,

$$P(E) = \frac{1}{e^{(E - E_F)/kT} + 1},$$

um degrau a $T = 0$ que se arredonda numa faixa de alguns $kT$; em $E = E_F$, $P = \tfrac12$.

### Quantos estados ocupados?
O produto $N(E)P(E)$ dá a densidade de estados ocupados. Integrando até $E_F$ a $T = 0$ e igualando a $n$, obtém-se

$$E_F = \left(\frac{3}{16\sqrt2\,\pi}\right)^{2/3}\frac{h^2}{m}\,n^{2/3} \approx 0{,}121\,\frac{h^2}{m}\,n^{2/3}.$$

Exemplo: para o cobre, $E_F = 0{,}121\cdot(6{,}63\times10^{-34})^2/(9{,}11\times10^{-31})\cdot(8{,}5\times10^{28})^{2/3} \approx 7{,}0$ eV. É uma energia cinética enorme, que corresponde a velocidades de $1{,}6\times10^6$ m/s, e independe da temperatura: é consequência do princípio de exclusão. A $300$ K, $kT = 0{,}026$ eV é menos de $0{,}4\%$ disso.

Armadilha: imaginar que, ao esfriar até $0$ K, todos os elétrons do metal param. Pela exclusão, eles empilham até $E_F$ e continuam com energias de alguns eV.

No experimento, veja o metal com estados vazios logo acima dos ocupados; no modelo de Drude, compare a velocidade de deriva com a agitação dos elétrons.`,
      experiments: [
        { kind: "sim", id: "semicondutores", scenario: "materiais", params: { material: 0 }, note: "Veja a banda parcialmente cheia do cobre e a ocupação de Fermi–Dirac." },
        { kind: "sim", id: "drude", scenario: "deriva", note: "Compare a deriva lenta dos elétrons com sua agitação rápida." },
        { kind: "sim", id: "drude", scenario: "ohm", note: "Veja a lei de Ohm emergir das colisões dos elétrons de condução." },
      ],
    },
    "41-6": {
      text: String.raw`Um **semicondutor** tem a mesma estrutura de bandas de um isolante, com valência cheia e condução vazia a $T = 0$, mas o gap é **estreito**: $1{,}12$ eV no silício, $0{,}66$ eV no germânio, $1{,}42$ eV no arseneto de gálio. À temperatura ambiente, a agitação térmica leva alguns elétrons através do gap.

Cada elétron promovido deixa na banda de valência um estado vazio, a **lacuna** (ou buraco). Os elétrons vizinhos podem ocupar a lacuna, que assim se desloca no sentido oposto; tudo se passa como se uma partícula de carga $+e$ se movesse na banda de valência. Num semicondutor puro (**intrínseco**), elétrons de condução e lacunas aparecem aos pares, e ambos conduzem.

O número de portadores cresce com a temperatura de forma aproximadamente exponencial,

$$n_i \propto T^{3/2}\,e^{-E_g/2kT},$$

o que explica o coeficiente de temperatura **negativo** da resistividade (seção 41-2): o aumento das colisões com a rede é pequeno diante do aumento do número de portadores. É o princípio dos **termistores** NTC, usados como sensores de temperatura.

Exemplo: no silício a $300$ K, $n_i \approx 10^{10}$ cm⁻³, um portador para cada $5\times10^{12}$ átomos. Aquecendo $30$ K, o fator exponencial $e^{-E_g/2kT}$ cresce cerca de $e^{1{,}12\cdot30/(2\cdot0{,}0259\cdot330)} \approx e^{2{,}0}$; com o fator $T^{3/2}$, $n_i$ fica cerca de oito vezes maior. No germânio, de gap menor, há milhares de vezes mais portadores intrínsecos que no silício à mesma temperatura.

Armadilha: tratar a lacuna como um próton ou um íon que se move. Nada de pesado se desloca; a lacuna é a ausência de um elétron na banda de valência, e seu movimento é o movimento coletivo dos elétrons ao redor.

No experimento, compare germânio, silício e arseneto de gálio à mesma temperatura; depois aqueça o silício e veja $n_i$ crescer exponencialmente.`,
      experiments: [
        { kind: "sim", id: "semicondutores", scenario: "materiais", note: "Compare os gaps e as concentrações intrínsecas de Ge, Si e GaAs." },
        { kind: "sim", id: "semicondutores", scenario: "materiais", params: { material: 2, T: 450 }, note: "Aqueça o silício e veja o número de portadores crescer exponencialmente." },
        { kind: "sim", id: "transistor-retificador", scenario: "sensores", note: "Use um termistor NTC, cuja resistência cai com a temperatura, num divisor de tensão." },
      ],
    },
    "41-7": {
      text: String.raw`A grande vantagem dos semicondutores é que sua condução pode ser controlada pela adição deliberada de pequenas quantidades de impurezas, a **dopagem**.

### Tipo n
O silício tem quatro elétrons de valência, todos usados nas ligações com os vizinhos. Substitua um átomo de silício por um de fósforo, com cinco: sobra um elétron fracamente ligado ao íon $\mathrm P^+$. Seu nível de energia fica logo **abaixo** da banda de condução (a uns $0{,}045$ eV), e a agitação térmica o promove com facilidade. O fósforo é um **doador**. O material fica com muito mais elétrons que lacunas: os elétrons são os **portadores majoritários**.

### Tipo p
Com um átomo de boro, de valência três, falta um elétron para completar as ligações. O nível vazio que surge fica logo **acima** da banda de valência; um elétron de valência pula para ele e deixa uma lacuna móvel. O boro é um **aceitador**, e as lacunas são as portadoras majoritárias.

Em ambos os casos o material continua eletricamente neutro: cada portador livre é compensado por um íon fixo na rede. Num semicondutor em equilíbrio, vale ainda a lei da ação das massas, $np = n_i^2$: mais elétrons implica menos lacunas.

Exemplo: o silício tem $5\times10^{22}$ átomos/cm³. Uma dopagem de um átomo de fósforo para cada dez milhões de silício dá $N_D = 5\times10^{15}$ cm⁻³ elétrons, cerca de $500\,000$ vezes mais que os $10^{10}$ cm⁻³ intrínsecos. A concentração de lacunas cai para $n_i^2/N_D = 2\times10^{4}$ cm⁻³. A resistividade cai de milhares de Ω·m para cerca de $1$ Ω·cm.

Armadilha: dizer que um material tipo n tem carga negativa. A palavra se refere ao sinal dos portadores majoritários; o cristal como um todo é neutro.

No experimento, escolha dopagem tipo n e depois tipo p, varie a concentração de impurezas e acompanhe $n$, $p$ e a posição do nível de Fermi; no efeito Hall, veja o sinal da tensão inverter com o tipo de portador.`,
      experiments: [
        { kind: "sim", id: "semicondutores", scenario: "materiais", params: { vista: 2, dopagem: 1 }, note: "Dope o silício com doadores e acompanhe n, p e o nível de Fermi." },
        { kind: "sim", id: "semicondutores", scenario: "materiais", params: { vista: 2, dopagem: 2 }, note: "Troque para aceitadores e veja as lacunas virarem majoritárias." },
        { kind: "sim", id: "motor-hall", scenario: "hall", note: "Compare o sinal da tensão Hall para portadores positivos e negativos." },
      ],
    },
    "41-8": {
      text: String.raw`Uma **junção p-n** é um único cristal semicondutor dopado tipo p de um lado e tipo n do outro. No instante em que se forma, há muitos elétrons do lado n e muitas lacunas do lado p. Por **difusão**, elétrons passam para o lado p e lacunas para o lado n, onde se recombinam com os majoritários de lá.

Isso deixa, perto da junção, os íons fixos descobertos: doadores positivos no lado n e aceitadores negativos no lado p. Essa **carga espacial** cria um campo elétrico dirigido do lado n para o p, e uma **diferença de potencial de contato** $V_0$ entre os lados. A região sem portadores livres, de largura típica de um micrômetro, é a **zona de depleção**.

O campo freia a difusão. Ao mesmo tempo, os poucos portadores minoritários (elétrons no lado p, lacunas no lado n) gerados termicamente perto da junção são arrastados por ele para o outro lado, formando uma corrente de **deriva** no sentido oposto. Em equilíbrio, as duas correntes se cancelam e a corrente líquida é zero.

Exemplo: no silício com $N_A = N_D = 10^{16}$ cm⁻³ a $300$ K, o potencial de contato é

$$V_0 = \frac{kT}{e}\ln\frac{N_AN_D}{n_i^2} \approx 0{,}026\cdot\ln(10^{12}) \approx 0{,}7\ \mathrm V,$$

e a zona de depleção tem cerca de $0{,}4$ µm. Dopando mais, $V_0$ sobe um pouco e a zona fica mais estreita.

Armadilha: tentar medir $V_0$ ligando um voltímetro nos terminais da junção. Os contatos metálicos criam suas próprias diferenças de potencial, que cancelam exatamente a da junção; um diodo isolado não é uma pilha, e não fornece energia.

No experimento, veja a zona de depleção, o campo e o potencial de contato; mude as dopagens e acompanhe a largura da zona e $V_0$.`,
      experiments: [
        { kind: "sim", id: "semicondutores", scenario: "diodo", params: { V: 0 }, note: "Sem tensão aplicada, veja a zona de depleção, o campo e o potencial de contato." },
        { kind: "sim", id: "semicondutores", scenario: "diodo", params: { V: 0, Na: 1e18, Nd: 1e18 }, note: "Aumente as dopagens e veja a zona de depleção estreitar e V₀ subir." },
      ],
    },
    "41-9": {
      text: String.raw`Ligue uma junção p-n a uma fonte. Na **polarização direta** (positivo da fonte no lado p), a tensão aplicada reduz a barreira de potencial: a difusão dos majoritários cresce exponencialmente, e a zona de depleção estreita. Na **polarização reversa**, a barreira aumenta, a difusão praticamente cessa e sobra só a pequena corrente de deriva dos minoritários, quase independente da tensão. Para um diodo ideal,

$$I = I_0\left(e^{eV/kT} - 1\right),$$

com $I_0$ muito pequeno (picoampères ou menos no silício). Em polarização direta, a corrente fica apreciável a partir de uns $0{,}6$ V; cada $60$ mV a mais multiplica a corrente por dez. Em reversa, $I \approx -I_0$. O diodo é uma "válvula" de mão única para a corrente.

Essa assimetria transforma corrente alternada em corrente num só sentido: é o **retificador**. Num retificador de **meia onda**, o diodo deixa passar só os semiciclos positivos. Com quatro diodos numa **ponte**, os dois semiciclos são aproveitados, sempre no mesmo sentido na carga. Um capacitor em paralelo com a carga alisa a saída, deixando uma pequena ondulação. É assim que carregadores e fontes convertem a tensão da tomada em tensão contínua.

Exemplo: um diodo de silício com $I_0 = 1$ pA a $300$ K ($kT/e = 0{,}026$ V). Com $V = 0{,}60$ V, $I = 10^{-12}e^{23} \approx 10$ mA; com $0{,}66$ V, cerca de $100$ mA; com $-5$ V, $-1$ pA. A razão entre as correntes direta e reversa chega a dez bilhões.

Armadilha: tratar o diodo como um resistor. Sua curva corrente-tensão não é uma reta, e ele não tem "uma resistência": a razão $V/I$ muda enormemente com o ponto de operação.

No experimento, levante a curva corrente-tensão de um diodo e encontre a tensão de limiar; depois monte o retificador em ponte e veja o efeito do capacitor de filtro.`,
      experiments: [
        { kind: "sim", id: "curva-iv", scenario: "diodo", note: "Levante a curva I–V do diodo e localize o limiar de condução." },
        { kind: "sim", id: "semicondutores", scenario: "diodo", note: "Polarize a junção direta e reversamente e veja a barreira e a corrente mudarem." },
        { kind: "sim", id: "transistor-retificador", scenario: "ponte", note: "Retifique a tensão alternada com uma ponte de diodos e filtre com um capacitor." },
        { kind: "pratica", id: "exp3-diodo", note: "Na bancada, meça a curva I–V de um diodo e compare com a de um resistor." },
      ],
    },
    "41-10": {
      text: String.raw`Na junção em polarização direta, elétrons do lado n e lacunas do lado p entram na zona de junção e se **recombinam**: um elétron da banda de condução cai numa lacuna da banda de valência e libera uma energia aproximadamente igual ao gap. Em semicondutores de gap **direto**, como o arseneto de gálio e o nitreto de gálio, essa energia sai como um fóton. É o **diodo emissor de luz** (LED). A cor é fixada pelo gap:

$$\lambda \approx \frac{hc}{E_g} = \frac{1240\ \mathrm{eV\cdot nm}}{E_g}.$$

No silício, de gap **indireto**, a recombinação libera a energia sobretudo como vibração da rede (calor), por isso o silício não serve para LEDs.

Para escolher a cor, ajusta-se o gap com ligas: o GaAs ($1{,}42$ eV) emite em $870$ nm, no infravermelho (controles remotos); a liga GaAsP, com gap de cerca de $1{,}9$ eV, emite vermelho ($650$ nm); o InGaN emite azul. O LED branco usa um chip azul coberto de um material fluorescente que converte parte da luz em amarelo.

O processo inverso também é útil: um fóton com energia maior que o gap, absorvido na junção, cria um par elétron-lacuna que o campo da zona de depleção separa, gerando corrente. É o **fotodiodo** e, em grande área, a **célula solar**.

Se a corrente for alta, a inversão de população na junção permite emissão estimulada; com as faces do cristal polidas como espelhos, tem-se o **laser de junção** (seção 40-12), presente em leitores ópticos e nas comunicações por fibra.

Exemplo: um LED azul de $460$ nm tem $E_g \approx 1240/460 = 2{,}7$ eV; por isso precisa de cerca de $3$ V para acender, enquanto um vermelho acende com uns $1{,}8$ V. A tensão de condução de cada cor dá uma estimativa de $h$.

Armadilha: achar que a cor do LED vem do plástico da cápsula. O plástico colorido só ajuda a identificar o componente; a cor é definida pelo gap do semicondutor.

No experimento, mude o gap do LED e veja a cor e o comprimento de onda; compare a tensão de condução de LEDs de cores diferentes.`,
      experiments: [
        { kind: "sim", id: "semicondutores", scenario: "led", note: "Ajuste o gap e veja a cor emitida e λ = hc/E_g." },
        { kind: "sim", id: "semicondutores", scenario: "led", params: { EgLED: 2.7, V: 2.8 }, note: "Monte um LED azul e veja que ele precisa de mais tensão para acender." },
        { kind: "sim", id: "fotoeletrico", scenario: "corte", note: "Compare com o efeito fotoelétrico: em ambos, a energia do fóton é a chave." },
      ],
    },
    "41-11": {
      text: String.raw`Um **transistor** é um dispositivo de três terminais em que um sinal pequeno aplicado a um deles controla uma corrente grande entre os outros dois. Com isso, ele **amplifica** sinais e funciona como **chave** liga-desliga, a base da eletrônica digital.

### O transistor de efeito de campo (MOSFET)
Nos circuitos integrados, o tipo dominante é o **MOSFET**. Num substrato tipo p, duas regiões tipo n, a **fonte** e o **dreno**, são ligadas por um canal estreito. Sobre o canal, separada por uma camada fina de óxido isolante, fica uma placa metálica, a **porta**. Uma tensão positiva na porta atrai elétrons para a superfície do semicondutor sob o óxido e cria um canal condutor tipo n entre fonte e dreno; sem essa tensão, não há canal e a corrente é praticamente nula. Como a porta é isolada, quase nenhuma corrente entra por ela: o controle é feito pelo **campo elétrico**, como num capacitor. Um processador moderno tem dezenas de bilhões desses transistores, com canais de poucos nanômetros.

### O transistor bipolar
O transistor bipolar de junção (BJT), mais antigo e ainda usado em amplificadores, é um sanduíche n-p-n (ou p-n-p). Uma pequena corrente de **base** $I_B$ controla uma corrente de **coletor** $I_C = \beta I_B$, com ganho $\beta$ de algumas centenas. Num amplificador emissor-comum, uma variação de microampères na base vira uma variação de miliampères no coletor e, num resistor de carga, uma tensão muito maior que a de entrada.

Exemplo: com $\beta = 200$ e $I_B = 20$ µA, $I_C = 4{,}0$ mA. Num resistor de coletor de $1{,}0$ kΩ, uma variação de $\pm5$ µA na base produz $\pm1$ mA no coletor e $\pm1$ V na saída. Como chave: com a base sem corrente, $I_C \approx 0$ (desligado); com corrente de base suficiente, o transistor satura e conduz quase com tensão zero (ligado).

Armadilha: pensar que o transistor "cria" energia ao amplificar. A potência do sinal de saída vem da fonte de alimentação; o sinal de entrada apenas controla quanto dessa potência passa.

O simulador mostra o transistor bipolar; o MOSFET segue a mesma lógica de controle (porta no lugar da base, tensão no lugar de corrente). No experimento, levante as curvas $I_C \times V_{CE}$, trace a reta de carga e veja o amplificador emissor-comum no osciloscópio.`,
      experiments: [
        { kind: "sim", id: "transistor-retificador", scenario: "curvas", note: "Levante as curvas I_C × V_CE e escolha o ponto de operação na reta de carga." },
        { kind: "sim", id: "transistor-retificador", scenario: "amplificador", note: "Amplifique um sinal pequeno e meça o ganho e a distorção no osciloscópio." },
      ],
    },
  },
};
