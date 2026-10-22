import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 32,
  intro: String.raw`Este capítulo fecha a teoria clássica do eletromagnetismo. Primeiro, completamos as leis do campo magnético: não existem monopolos, e um campo elétrico **variável** produz campo magnético, assim como um campo magnético variável produz campo elétrico. A ideia de Maxwell de uma **corrente de deslocamento** reúne tudo em quatro equações, das quais sairão as ondas eletromagnéticas e a luz (capítulo 33). Na segunda parte, olhamos para dentro da matéria: o campo da Terra, a origem atômica do magnetismo nos momentos dos elétrons e os três comportamentos dos materiais, o diamagnetismo, o paramagnetismo e o ferromagnetismo, que explica os ímãs permanentes.`,
  sections: {
    "32-1": {
      text: String.raw`A lei de Gauss para o campo elétrico diz que o fluxo por uma superfície fechada é proporcional à carga envolvida, porque as linhas de $\vec E$ nascem nas cargas positivas e morrem nas negativas. Para o campo magnético, a lei correspondente é

$$\Phi_B = \oint\vec B\cdot d\vec A = 0.$$

O fluxo magnético por **qualquer** superfície fechada é zero: tudo o que entra sai. Isso exprime o fato experimental de que **não existem monopolos magnéticos**, isto é, cargas magnéticas isoladas. As linhas de campo magnético não têm começo nem fim; são laços fechados, ou se estendem ao infinito.

Num ímã em barra, as linhas saem do polo norte, contornam o ímã por fora, entram no polo sul e **continuam por dentro** dele até o norte, fechando o laço. Uma superfície gaussiana em torno do polo norte apenas parece ter fluxo só saindo: considerando a parte dela que passa por dentro do ímã, o fluxo que entra ali compensa exatamente. O mesmo se vê num solenoide (seção 29-4).

Uma consequência prática: ao quebrar um ímã ao meio, não se separa um polo norte de um polo sul. Cada pedaço vira um ímã completo, com os dois polos. Repetindo até chegar aos átomos, cada átomo e cada elétron ainda é um dipolo. Teorias de física de partículas preveem monopolos, mas nenhum foi encontrado, apesar de buscas intensas.

Exemplo: uma bobina plana de $4{,}0$ cm² fica a $2{,}0$ cm do polo norte de um ímã, e o fluxo que a atravessa, vindo do ímã, é de $4\times10^{-5}$ Wb. Se a bobina fosse fechada num "saco" em torno do polo, incluindo a parte que corta o ímã, o fluxo total seria zero, não $4\times10^{-5}$ Wb.

Armadilha: imaginar que as linhas "terminam" no polo sul como as de $\vec E$ terminam numa carga negativa. Elas atravessam o ímã e fecham o laço.

No experimento, mapeie com bússolas o campo de um ímã em barra e veja as linhas formarem laços; no solenoide, observe as linhas continuarem pelo interior da bobina.`,
      experiments: [
        { kind: "sim", id: "imas-bussola", scenario: "um-ima", note: "Mapeie as linhas de um ímã e veja que formam laços fechados." },
        { kind: "sim", id: "biot-savart", scenario: "solenoide", params: { N: 40, L: 10 }, note: "No corte lateral, siga as linhas que atravessam o solenoide e voltam por fora." },
      ],
    },
    "32-2": {
      text: String.raw`A lei de Faraday diz que um fluxo magnético variável induz um campo elétrico. Maxwell propôs a simetria: um **fluxo elétrico variável induz um campo magnético**. Essa é a **lei de indução de Maxwell**,

$$\oint\vec B\cdot d\vec s = \mu_0\varepsilon_0\,\frac{d\Phi_E}{dt}.$$

As duas leis têm a mesma forma, com uma diferença de sinal e das constantes. Combinando com a lei de Ampère (campo produzido por correntes), obtém-se a **lei de Ampère-Maxwell**:

$$\oint\vec B\cdot d\vec s = \mu_0\varepsilon_0\,\frac{d\Phi_E}{dt} + \mu_0\,i_{\text{env}}.$$

O exemplo clássico é um capacitor de placas circulares sendo carregado. Entre as placas não passa corrente, mas o campo elétrico cresce, e as linhas de campo magnético são círculos em torno do eixo, como as de um fio. Para um círculo de raio $r$ menor que o raio $R$ das placas, o fluxo elétrico envolvido é $\pi r^2E$, e

$$B = \frac{\mu_0\varepsilon_0\,r}{2}\,\frac{dE}{dt} \quad (r \le R), \qquad B = \frac{\mu_0\varepsilon_0R^2}{2r}\,\frac{dE}{dt} \quad (r \ge R).$$

O campo cresce linearmente do eixo até a borda e decai com $1/r$ fora, exatamente como no interior e no exterior de um fio (seção 29-3).

Exemplo: placas de raio $5{,}0$ cm em que o campo elétrico cresce a $1{,}0\times10^{13}$ V/(m·s). Na borda, $B = 4\pi\times10^{-7}\cdot8{,}85\times10^{-12}\cdot0{,}050\cdot10^{13}/2 \approx 2{,}8\ \mu$T; na metade do raio, $1{,}4\ \mu$T. O produto $\mu_0\varepsilon_0 = 1/c^2$ é minúsculo, por isso o efeito passou despercebido até Maxwell.

Armadilha: achar que o campo magnético entre as placas surge de alguma corrente de carga atravessando o vácuo. Não há transporte de carga ali; é o campo elétrico variável que produz $\vec B$.

No experimento, carregue o capacitor e veja as linhas de $\vec B$ circulando entre as placas enquanto o campo elétrico cresce; elas somem quando o capacitor fica carregado.`,
      experiments: [
        { kind: "sim", id: "onda-em", scenario: "capacitor", note: "Veja o campo magnético entre as placas enquanto o capacitor carrega." },
        { kind: "sim", id: "espectro-em", scenario: "capacitor", note: "Acompanhe o campo B induzido e a energia entrando pela borda do capacitor." },
      ],
    },
    "32-3": {
      text: String.raw`Comparando os dois termos da lei de Ampère-Maxwell, o termo $\varepsilon_0\,d\Phi_E/dt$ tem unidade de corrente. Maxwell o chamou de **corrente de deslocamento**:

$$i_d = \varepsilon_0\,\frac{d\Phi_E}{dt}, \qquad \oint\vec B\cdot d\vec s = \mu_0\,(i_d + i)_{\text{env}}.$$

O nome é enganoso: nada se desloca. Mas a ideia é poderosa. Num capacitor de placas paralelas sendo carregado com corrente $i$, $\Phi_E = EA = q/\varepsilon_0$, logo $i_d = dq/dt = i$: a corrente de deslocamento entre as placas é **igual** à corrente de condução nos fios. A "corrente total" é contínua ao longo do circuito, e a lei de Ampère dá o mesmo resultado, seja a superfície atravessada pelo fio ou passe entre as placas. Sem esse termo, a lei de Ampère seria inconsistente. Para pontos entre as placas, a corrente de deslocamento se distribui uniformemente pela área, e o campo magnético se calcula como num fio grosso.

Exemplo: se um capacitor de placas de $0{,}010$ m² é carregado com $2{,}0$ A, a corrente de deslocamento também é $2{,}0$ A, e o campo entre as placas cresce a $dE/dt = i/(\varepsilon_0A) \approx 2{,}3\times10^{13}$ V/(m·s).

### Equações de Maxwell
Com isso, o eletromagnetismo clássico se resume a quatro equações (no vácuo, sem materiais magnéticos ou dielétricos):

- lei de Gauss para a eletricidade: $\oint\vec E\cdot d\vec A = q_{\text{env}}/\varepsilon_0$ (carga e campo elétrico);
- lei de Gauss para o magnetismo: $\oint\vec B\cdot d\vec A = 0$ (não há monopolos);
- lei de Faraday: $\oint\vec E\cdot d\vec s = -d\Phi_B/dt$ (campo magnético variável gera campo elétrico);
- lei de Ampère-Maxwell: $\oint\vec B\cdot d\vec s = \mu_0\varepsilon_0\,d\Phi_E/dt + \mu_0 i_{\text{env}}$ (correntes e campo elétrico variável geram campo magnético).

Juntando a terceira com a quarta, um campo variável alimenta o outro, e a perturbação se propaga com velocidade $1/\sqrt{\mu_0\varepsilon_0} \approx 3{,}0\times10^8$ m/s: a velocidade da luz. A luz é uma onda eletromagnética (capítulo 33).

Armadilha: achar que a corrente "pula" de uma placa para a outra. A carga se acumula nas placas; o que continua entre elas é a corrente de deslocamento, que não transporta carga.

No experimento, compare a corrente de condução no fio com a corrente de deslocamento entre as placas; depois veja as equações de Maxwell produzirem um pulso eletromagnético que se propaga.`,
      experiments: [
        { kind: "sim", id: "onda-em", scenario: "capacitor", note: "Confira que a corrente de deslocamento ε₀dΦ_E/dt iguala a corrente nos fios." },
        { kind: "sim", id: "onda-em", scenario: "pulso", note: "Veja as equações de Maxwell propagarem um pulso com E e B em fase." },
        { kind: "sim", id: "onda-em", scenario: "antena", note: "Observe uma antena irradiando: campos que se sustentam no espaço vazio." },
      ],
    },
    "32-4": {
      text: String.raw`Ímãs permanentes, como os de ferrite das geladeiras e os de neodímio-ferro-boro dos motores e fones de ouvido, são materiais ferromagnéticos (seção 32-8) que conservam a magnetização depois de retirado o campo externo. O maior ímã do nosso cotidiano é a própria **Terra**.

O campo terrestre se parece, em primeira aproximação, com o de um dipolo no centro do planeta, com momento de cerca de $8{,}0\times10^{22}$ A·m². O eixo do dipolo está inclinado cerca de $10°$ em relação ao eixo de rotação, e o polo do dipolo que fica no hemisfério norte é, magneticamente, um polo **sul**, pois atrai o polo norte das bússolas. Na superfície, o campo vale de $25$ a $65\ \mu$T. Duas grandezas descrevem sua direção num lugar: a **declinação**, ângulo entre o norte geográfico e a direção apontada pela bússola, e a **inclinação**, ângulo do campo com a horizontal. Para um dipolo ideal, a inclinação $I$ se relaciona com a latitude magnética $\lambda$ por

$$\tan I = 2\tan\lambda.$$

No equador magnético, o campo é horizontal; nos polos, vertical. Exemplo: a $30°$ de latitude magnética, $\tan I = 2\cdot0{,}577$, e $I \approx 49°$. No hemisfério sul, o campo aponta para cima, e a agulha de inclinação ergue o polo norte.

O campo da Terra não é fixo: os polos se deslocam alguns quilômetros por ano, a intensidade varia, e há regiões anômalas, como a **Anomalia Magnética do Atlântico Sul**, onde o campo é mais fraco e satélites recebem mais radiação. Rochas vulcânicas registram a direção do campo quando esfriam, e mostram que ele se **inverteu** muitas vezes ao longo da história geológica; as faixas simétricas de magnetização no fundo do oceano foram uma das provas da expansão do assoalho oceânico.

Armadilha: achar que o polo norte geográfico é um polo norte magnético. Se fosse, repeliria o polo norte da bússola.

No experimento, mude a latitude no globo e confira a relação entre inclinação e latitude; depois compare o modelo de dipolo com os valores medidos em Porto Alegre.`,
      experiments: [
        { kind: "sim", id: "imas-bussola", scenario: "globo", note: "Varie a latitude e verifique tan I = 2 tan λ." },
        { kind: "sim", id: "imas-bussola", scenario: "porto-alegre", note: "Compare o dipolo ideal com o campo medido em Porto Alegre." },
        { kind: "sim", id: "magnetismo-materia", scenario: "histerese", note: "Veja por que um material duro conserva a magnetização: o ímã permanente." },
      ],
    },
    "32-5": {
      text: String.raw`O magnetismo dos materiais vem dos elétrons, que contribuem de duas maneiras.

**Momento de spin.** Todo elétron tem um momento angular intrínseco, o **spin** $\vec S$, e um momento magnético associado, $\vec\mu_s = -(e/m)\vec S$, em sentido oposto. Nenhum dos dois pode ser medido por inteiro; só suas componentes ao longo de um eixo, e estas são **quantizadas**: $\mu_{s,z} = \pm\mu_B$, onde

$$\mu_B = \frac{eh}{4\pi m} = 9{,}27\times10^{-24}\ \mathrm{J/T}$$

é o **magnéton de Bohr**. Num campo $B$ ao longo de $z$, a energia é $U = -\mu_{s,z}B$, com dois valores possíveis. O experimento de Stern-Gerlach mostra essa quantização: um feixe de átomos se divide em dois, e não num borrão contínuo.

**Momento orbital.** O movimento do elétron em torno do núcleo equivale a uma pequena espira com corrente, com momento $\vec\mu_{\text{orb}} = -(e/2m)\vec L_{\text{orb}}$. Sua componente também é quantizada, $\mu_{\text{orb},z} = -m_l\mu_B$, com $m_l$ inteiro.

Num átomo, esses momentos se somam vetorialmente. Em muitos átomos eles se cancelam par a par; em outros, sobra um momento resultante. Os núcleos também têm momentos, mas cerca de mil vezes menores, por causa da massa maior; são eles que a ressonância magnética nuclear detecta.

Exemplo: num campo de $1{,}0$ T, a diferença de energia entre os dois estados de spin é $2\mu_BB \approx 1{,}9\times10^{-23}$ J, ou $1{,}2\times10^{-4}$ eV. A energia térmica típica à temperatura ambiente, $kT \approx 0{,}026$ eV, é duzentas vezes maior: a agitação térmica atrapalha muito o alinhamento.

### Propriedades Magnéticas dos Materiais
Os materiais se dividem em três grupos. **Diamagnéticos** (seção 32-6): os átomos não têm momento resultante; o campo externo induz momentos fracos e opostos a ele, e o material é repelido por polos de ímã. **Paramagnéticos** (seção 32-7): os átomos têm momento resultante, que tende a se alinhar com o campo, contra a agitação térmica; o material é fracamente atraído. **Ferromagnéticos** (seção 32-8): os momentos se alinham espontaneamente em regiões inteiras, e a atração é forte. O diamagnetismo existe em todos os materiais, mas fica mascarado nos outros dois.

Armadilha: imaginar o spin como uma bola girando de fato. É uma propriedade quântica intrínseca, sem equivalente clássico exato.

No experimento, veja no aparelho de Stern-Gerlach o feixe se dividir em dois; compare depois a resposta de um diamagneto, de um paramagneto e de um ferromagneto ao mesmo campo.`,
      experiments: [
        { kind: "sim", id: "stern-gerlach", scenario: "feixe", note: "Veja o feixe se dividir em dois: a componente do momento de spin é quantizada." },
        { kind: "sim", id: "magnetismo-materia", scenario: "para", note: "Compare a resposta dos três tipos de material trocando o tipo no painel." },
        { kind: "concepcao", id: "ima-atrai-qualquer-metal" },
      ],
    },
    "32-6": {
      text: String.raw`Num material **diamagnético**, os átomos não têm momento magnético resultante na ausência de campo: os momentos orbitais e de spin de seus elétrons se cancelam. Ao aplicar um campo externo $\vec B_{\text{ext}}$, porém, o movimento orbital dos elétrons se altera ligeiramente. O efeito pode ser entendido pela lei de Lenz: enquanto o campo é ligado, ele induz nas "espiras" atômicas uma pequena variação de corrente que cria um momento **oposto** ao campo. O material adquire uma magnetização fraca contrária a $\vec B_{\text{ext}}$, que desaparece quando o campo é retirado.

Consequência: num **campo não uniforme**, um objeto diamagnético é empurrado da região de campo mais intenso para a de campo mais fraco, ou seja, é **repelido** pelos polos de um ímã, qualquer que seja o polo. Lembre que um dipolo antiparalelo ao campo tem energia $U = -\vec\mu\cdot\vec B$ positiva, que diminui quando ele se afasta.

O efeito é muito pequeno. A **suscetibilidade magnética** (razão entre a magnetização e o campo aplicado, em unidades adequadas) é da ordem de $-10^{-5}$ para a água e $-1{,}7\times10^{-4}$ para o bismuto, um dos mais diamagnéticos. Ainda assim, com campos intensos, o efeito vence a gravidade: com cerca de $16$ T, pode-se fazer levitar gotas d'água, morangos e até um sapo vivo, cujo corpo é quase todo água. Um ímã de neodímio forte faz levitar uma lâmina fina de grafite pirolítico sobre ele.

Exemplo: a força sobre um objeto diamagnético é proporcional a $B\,dB/dz$. Para levitar água é preciso $B\,dB/dz$ da ordem de $1400$ T²/m; com $B = 16$ T, basta um gradiente de cerca de $90$ T/m.

Os **supercondutores** são diamagnéticos perfeitos: expulsam completamente o campo magnético do seu interior (efeito Meissner).

Armadilha: achar que materiais "não magnéticos", como água, cobre ou madeira, não respondem ao campo magnético. Todos são diamagnéticos; o efeito só é pequeno demais para notar com ímãs comuns.

No experimento, aplique um campo crescente ao diamagneto e observe a magnetização induzida ter sinal oposto ao do campo e desaparecer quando ele volta a zero.`,
      experiments: [
        { kind: "sim", id: "magnetismo-materia", scenario: "dia", note: "Veja a magnetização induzida sempre oposta ao campo aplicado." },
        { kind: "concepcao", id: "ima-atrai-qualquer-metal", note: "Confronte a ideia de que ímãs atraem qualquer metal." },
      ],
    },
    "32-7": {
      text: String.raw`Num material **paramagnético**, cada átomo tem um momento magnético resultante $\vec\mu$ (por exemplo, por ter elétrons desemparelhados). Sem campo externo, a agitação térmica orienta esses momentos ao acaso, e a magnetização total é zero. Com um campo, os momentos tendem a se alinhar com ele, pois isso reduz a energia $U = -\vec\mu\cdot\vec B$, mas as colisões térmicas desfazem o alinhamento o tempo todo. O resultado é um alinhamento **parcial**, e o material é fracamente **atraído** para regiões de campo intenso. Alumínio, platina, oxigênio líquido e sais de terras-raras são exemplos.

A **magnetização** $M$ é o momento magnético por unidade de volume, medido em A/m. Se $N$ átomos por volume estivessem todos alinhados, ela atingiria a saturação $M_{\text{máx}} = N\mu$. Para campos fracos ou temperaturas altas ($\mu B \ll kT$), Pierre Curie descobriu experimentalmente que

$$M = C\,\frac{B_{\text{ext}}}{T},$$

a **lei de Curie**, com $C$ uma constante do material. A magnetização cresce com o campo, que favorece o alinhamento, e diminui com a temperatura, que o desfaz. Para $\mu B$ comparável a $kT$, a lei falha e a magnetização se aproxima da saturação.

Exemplo: para $\mu = \mu_B$, a $300$ K e $1{,}0$ T, $\mu B/kT = 9{,}27\times10^{-24}/(1{,}38\times10^{-23}\cdot300) \approx 2{,}2\times10^{-3}$, e a magnetização é só cerca de $0{,}2\%$ da saturação. Resfriando o material a $3$ K, a fração sobe para cerca de $20\%$; a lei de Curie já não vale bem, e a curva começa a se curvar em direção à saturação.

Armadilha: confundir paramagnetismo com ferromagnetismo. Um paramagneto perde a magnetização assim que o campo é retirado e é atraído só fracamente; não forma ímãs permanentes.

No experimento, mude o campo e a temperatura do paramagneto e compare a magnetização com a lei de Curie; leve o campo a valores altos e veja a saturação.`,
      experiments: [
        { kind: "sim", id: "magnetismo-materia", scenario: "para", note: "Varie o campo e a temperatura e compare M com a lei de Curie." },
        { kind: "sim", id: "magnetismo-materia", scenario: "para", params: { h: 4, Tr: 0.3 }, note: "Com campo forte e temperatura baixa, veja a magnetização saturar." },
      ],
    },
    "32-8": {
      text: String.raw`Ferro, cobalto, níquel, gadolínio e muitas ligas são **ferromagnéticos**: mesmo sem campo externo, os momentos de spin vizinhos se alinham espontaneamente, graças a um efeito quântico chamado **acoplamento de troca**. Esse alinhamento resiste à agitação térmica até a **temperatura de Curie**, acima da qual o material passa a ser apenas paramagnético. Para o ferro, ela é $1043$ K ($770$ °C).

Por que, então, um prego de ferro não é sempre um ímã? Porque o material se divide em **domínios magnéticos**, regiões microscópicas, cada uma totalmente magnetizada, mas com orientações diferentes, que se cancelam no conjunto. Ao aplicar um campo externo, os domínios alinhados com ele crescem à custa dos outros (as paredes se deslocam) e, em campos maiores, os domínios giram. A magnetização resultante pode ser enorme: num núcleo de ferro dentro de uma bobina, o campo total pode ser **milhares** de vezes o campo produzido só pela corrente. É por isso que eletroímãs, motores e transformadores têm núcleos ferromagnéticos.

### Histerese
Reduzindo o campo externo a zero, os domínios não voltam todos à configuração inicial, porque defeitos e impurezas "prendem" as paredes. Sobra uma magnetização, a **remanência**. Para anulá-la, é preciso um campo em sentido oposto, a **coercividade**. Percorrendo um ciclo de campo, a curva de magnetização forma um **laço de histerese**, cuja área é a energia dissipada por ciclo. Materiais **macios** (ferro-silício) têm laços estreitos e servem para núcleos de transformadores; materiais **duros** (ferrites, neodímio) têm laços largos e servem para ímãs permanentes e memórias magnéticas.

Exemplo: um ímã de neodímio retém uma magnetização que produz cerca de $1{,}2$ T junto à superfície, e só uma coercividade enorme impede que ele se desmagnetize. Aquecido acima de sua temperatura de Curie (cerca de $310$ °C), perde a magnetização.

Armadilha: achar que magnetizar um material é "colocar magnetismo" nele. Os momentos já estão alinhados dentro de cada domínio; o campo externo apenas reorganiza os domínios.

No experimento, percorra o laço de histerese com um material macio e um duro e compare a remanência e a coercividade; depois aqueça o ferromagneto e veja a magnetização desaparecer na temperatura de Curie.`,
      experiments: [
        { kind: "sim", id: "magnetismo-materia", scenario: "histerese", note: "Percorra o laço de histerese e meça remanência e coercividade." },
        { kind: "sim", id: "magnetismo-materia", scenario: "histerese", params: { material: 0 }, note: "Compare com um material macio, de laço estreito." },
        { kind: "sim", id: "magnetismo-materia", scenario: "curie", note: "Aqueça o ferromagneto e veja a magnetização sumir em T_c." },
        { kind: "sim", id: "transformador", scenario: "nucleo", note: "Veja o efeito de um núcleo ferromagnético num transformador." },
      ],
    },
  },
};
