import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 25,
  intro: String.raw`Um **capacitor** é qualquer par de condutores isolados entre si, capaz de guardar cargas opostas e, com elas, energia no campo elétrico entre eles. Está em praticamente todo circuito: filtra ruído em fontes, dá o tempo em osciladores, guarda a energia do flash de uma câmera e do desfibrilador, sente o toque na tela do celular. Neste capítulo definimos a capacitância, calculamos seu valor para geometrias simples, associamos capacitores, localizamos a energia no próprio campo e vemos como um material isolante entre as placas (o dielétrico) muda tudo isso.`,
  sections: {
    "25-1": {
      text: String.raw`Ligue um capacitor descarregado a uma bateria. Elétrons saem de uma placa e chegam à outra, até que a diferença de potencial entre as placas iguale a da bateria. Ao fim, uma placa tem carga $+q$ e a outra $-q$ (a carga **total** do capacitor continua zero; por "carga do capacitor" entende-se o módulo $q$ de cada placa). Experimentalmente, $q$ é proporcional à diferença de potencial $V$:

$$q = C\,V.$$

A constante $C$ é a **capacitância**. Ela depende só da geometria dos condutores e do material entre eles, não de $q$ nem de $V$. A unidade é o **farad**, $1\ \mathrm F = 1$ C/V, um valor enorme; na prática se usam µF, nF e pF.

Exemplo: um capacitor de $470\ \mu\mathrm F$ ligado a $12$ V guarda $q = 470\times10^{-6}\cdot12 \approx 5{,}6$ mC em cada placa. Se a tensão cair para $6$ V, a carga cai à metade; a capacitância não muda.

Durante a carga, a corrente no circuito começa alta e vai diminuindo, porque a tensão do capacitor cresce e se opõe à da bateria; o processo segue uma exponencial com constante de tempo $\tau = RC$ (capítulo 27). Uma vez carregado, nenhuma corrente contínua passa: o capacitor se comporta como um circuito aberto.

Armadilha: dizer que um capacitor "maior" (de capacitância maior) tem sempre mais carga. Isso só vale para a mesma tensão. Outra: imaginar que a carga atravessa o espaço entre as placas; ela apenas se acumula de cada lado, enquanto a corrente circula pelo resto do circuito.

No experimento, ligue a bateria às placas e compare a carga para duas tensões diferentes; no circuito RC, acompanhe a carga do capacitor crescer até a tensão da fonte.`,
      experiments: [
        { kind: "sim", id: "capacitores", scenario: "borda", note: "Mude a tensão da bateria e verifique que q/V permanece constante." },
        { kind: "sim", id: "circuito-rc", scenario: "medir-tau", note: "Carregue um capacitor por um resistor e veja a tensão chegar à da fonte." },
      ],
    },
    "25-2": {
      text: String.raw`O roteiro para calcular uma capacitância é sempre o mesmo: (1) suponha cargas $\pm q$ nos condutores; (2) ache o campo entre eles com a lei de Gauss; (3) integre o campo para obter $V$; (4) faça $C = q/V$. A carga se cancela, e sobra só geometria.

**Placas paralelas** de área $A$ separadas por $d$ (com $d$ pequeno diante do tamanho das placas): $E = q/(\varepsilon_0A)$, $V = Ed$, e

$$C = \frac{\varepsilon_0 A}{d}.$$

**Capacitor cilíndrico** (dois cilindros coaxiais de raios $a < b$ e comprimento $L$): $C = 2\pi\varepsilon_0 L/\ln(b/a)$. **Capacitor esférico** (cascas de raios $a < b$): $C = 4\pi\varepsilon_0\,ab/(b-a)$. **Esfera isolada** de raio $R$ (a outra "placa" está no infinito): $C = 4\pi\varepsilon_0R$.

Exemplo: placas quadradas de $8{,}0$ cm de lado separadas por $1{,}5$ cm: $C = 8{,}85\times10^{-12}\cdot0{,}0064/0{,}015 \approx 3{,}8$ pF. Para chegar a $1$ F com $d = 1$ mm, a área precisaria ter cerca de $10^8$ m², uns $10$ km de lado. Já uma esfera do tamanho da Terra tem apenas uns $0{,}7$ mF. Os supercapacitores alcançam farads porque usam áreas microscópicas imensas e separações de escala molecular.

Armadilha: o modelo ideal ignora o **campo de borda**, as linhas que se curvam nas extremidades das placas. Esse campo extra termina em cargas adicionais, de modo que a capacitância real é um pouco **maior** que $\varepsilon_0A/d$, tanto mais quanto maior a separação comparada ao lado das placas.

No experimento, aumente a separação das placas e veja a capacitância cair e o campo de borda pesar mais; depois aproxime as placas até as linhas ficarem quase todas retas. Na bancada, meça $C$ em função de $d$.`,
      experiments: [
        { kind: "sim", id: "capacitores", scenario: "borda", note: "Varie d e o lado das placas e compare C ideal com a capacitância com campo de borda." },
        { kind: "pratica", id: "exp3-capacitor-dieletrico", note: "Meça a capacitância de placas paralelas em função da separação." },
        { kind: "sim", id: "potencial", scenario: "coaxial", note: "Veja o campo entre os condutores de um capacitor cilíndrico." },
      ],
    },
    "25-3": {
      text: String.raw`Num circuito, vários capacitores podem ser trocados por um único **capacitor equivalente**, que, ligado à mesma tensão, recebe a mesma carga total.

**Em paralelo**, os capacitores estão ligados aos mesmos dois pontos e ficam todos com a **mesma tensão** $V$. As cargas se somam: $q = q_1 + q_2 + \dots = (C_1 + C_2 + \dots)V$, logo

$$C_{\text{eq}} = \sum_i C_i.$$

É como aumentar a área das placas. **Em série**, os capacitores formam uma fila; a bateria tira carga só da primeira placa e põe na última, e as placas intermediárias se carregam por indução. Todos ficam com a **mesma carga** $q$, e as tensões se somam: $V = q/C_1 + q/C_2 + \dots$, logo

$$\frac{1}{C_{\text{eq}}} = \sum_i \frac{1}{C_i}.$$

É como aumentar a separação das placas, e o equivalente é **menor** que o menor dos capacitores.

Exemplo: $C_1 = 2\ \mu\mathrm F$ em série com o conjunto $C_2 = 4\ \mu\mathrm F$ em paralelo com $C_3 = 2\ \mu\mathrm F$, ligados a $12$ V. O paralelo vale $6\ \mu\mathrm F$; em série com $2\ \mu\mathrm F$ dá $C_{\text{eq}} = 2\cdot6/8 = 1{,}5\ \mu\mathrm F$. A carga fornecida é $q = 18\ \mu\mathrm C$; $C_1$ fica com $V_1 = 9$ V e o paralelo com $3$ V, onde $q_2 = 12\ \mu\mathrm C$ e $q_3 = 6\ \mu\mathrm C$ (somando $18$, como devia).

Armadilha: trocar as regras com as dos resistores (capítulo 27). Para capacitores, **paralelo soma diretamente** e série soma inversos; para resistores é o contrário. Outra: num arranjo em série, o capacitor **menor** fica com a **maior** tensão, o que importa na hora de respeitar a tensão máxima de cada componente.

No experimento, escolha série, paralelo e a ligação mista e confira as cargas e tensões de cada capacitor; ponha $C_3 = 0$ para estudar só dois.`,
      experiments: [
        { kind: "sim", id: "capacitores", scenario: "associacao", note: "Confira cargas, tensões e capacitância equivalente na ligação mista." },
        { kind: "sim", id: "capacitores", scenario: "associacao", params: { tipo: 0, C3: 0 }, note: "Dois capacitores em série: veja o menor ficar com a maior tensão." },
        { kind: "sim", id: "capacitores", scenario: "associacao", params: { tipo: 1 }, note: "Em paralelo: mesma tensão em todos e cargas que se somam." },
      ],
    },
    "25-4": {
      text: String.raw`Carregar um capacitor custa trabalho: cada pequena carga $dq$ tem de ser levada de uma placa à outra contra a diferença de potencial $q'/C$ já existente. Somando desde zero até $q$:

$$U = \int_0^q \frac{q'}{C}\,dq' = \frac{q^2}{2C} = \frac12 CV^2 = \frac12 qV.$$

O fator $\tfrac12$ aparece porque a tensão cresceu de zero até $V$ ao longo do processo. Ligando o capacitor a uma bateria por um resistor, a bateria fornece $qV$, mas só metade fica no capacitor; a outra metade é dissipada no resistor, **qualquer que seja** o valor da resistência.

Onde está essa energia? No **campo elétrico**. Para placas paralelas, dividindo $U$ pelo volume $Ad$ entre as placas, obtém-se a **densidade de energia**

$$u = \frac12\varepsilon_0E^2,$$

um resultado que vale para qualquer campo elétrico, não só em capacitores. Onde há campo, há energia armazenada.

Exemplo: o capacitor de um flash, $150\ \mu\mathrm F$ a $300$ V, guarda $U = \tfrac12\cdot150\times10^{-6}\cdot300^2 \approx 6{,}8$ J; descarregado em $1$ ms, entrega uma potência média próxima de $7$ kW. Num campo de $3\times10^6$ V/m, perto do limite de ruptura do ar, a densidade é $u = 0{,}5\cdot8{,}85\times10^{-12}\cdot9\times10^{12} \approx 40$ J/m³.

Armadilha: achar que dobrar a tensão dobra a energia. Com $C$ fixa, $U \propto V^2$: dobrar a tensão **quadruplica** a energia. E ligar dois capacitores carregados entre si em paralelo conserva a carga, mas não a energia: parte é perdida no fio, em calor e radiação.

No experimento, carregue o capacitor e veja a energia na bateria, no resistor e no capacitor; confira que metade do que a bateria entrega se perde no resistor.`,
      experiments: [
        { kind: "sim", id: "circuito-rc", scenario: "energia", note: "Acompanhe para onde vai a energia fornecida pela bateria ao carregar o capacitor." },
        { kind: "sim", id: "capacitores", scenario: "v-constante", note: "Veja U = ½CV² e a densidade de energia entre as placas." },
      ],
    },
    "25-5": {
      text: String.raw`Preenchendo o espaço entre as placas com um isolante, a capacitância aumenta por um fator $\kappa$, a **constante dielétrica** do material:

$$C = \kappa\,C_{\text{ar}}.$$

Valores típicos: ar, $1{,}0006$; papel, cerca de $3$; vidro, $5$ a $7$; água, cerca de $80$; cerâmicas especiais, milhares. Além de aumentar $C$, o dielétrico mantém as placas separadas e suporta campos maiores que o ar antes de romper (sua **rigidez dielétrica**).

O efeito depende do que está fixo. **Com a bateria ligada** ($V$ constante), a carga nas placas aumenta $\kappa$ vezes e a energia $\tfrac12CV^2$ também. **Com o capacitor isolado** ($q$ constante), a tensão e o campo entre as placas caem para $1/\kappa$, e a energia $q^2/2C$ diminui; a diferença é o trabalho que o campo faz puxando o dielétrico para dentro. Exemplo: um capacitor de $10$ pF carregado a $200$ V e desligado recebe um bloco de $\kappa = 3$: a tensão cai para cerca de $67$ V, e a energia, de $0{,}20\ \mu\mathrm J$ para $0{,}067\ \mu\mathrm J$.

### Dielétricos: Uma Visão Atômica
Há dois tipos de material. Nos **polares** (água), as moléculas já são dipolos, orientados ao acaso; o campo tende a alinhá-los, contra a agitação térmica. Nos **apolares**, o campo **induz** dipolos deslocando as nuvens eletrônicas (seção 24-4). Nos dois casos, o efeito líquido é uma fina camada de carga induzida em cada face do dielétrico, de sinal oposto ao da placa vizinha. O campo dessas cargas se opõe ao das placas, e o campo dentro do material fica menor: $E = E_0/\kappa$.

Armadilha: dizer que o dielétrico "conduz um pouco". Não há corrente através dele; as cargas induzidas são ligadas às moléculas e só se deslocam distâncias atômicas.

No experimento, deslize o dielétrico para dentro das placas primeiro com a bateria ligada e depois com ela desligada, e compare o que acontece com a carga, a tensão e a energia.`,
      experiments: [
        { kind: "sim", id: "capacitores", scenario: "v-constante", note: "Insira o dielétrico com a bateria ligada: a carga e a energia aumentam." },
        { kind: "sim", id: "capacitores", scenario: "q-constante", note: "Insira o dielétrico com a bateria desligada: a tensão e a energia caem para 1/κ." },
        { kind: "pratica", id: "exp3-capacitor-dieletrico", note: "Meça a constante dielétrica de um material na bancada." },
      ],
    },
    "25-6": {
      text: String.raw`A lei de Gauss continua válida com um dielétrico, mas a carga envolvida agora inclui a carga **livre** $q$ das placas e a carga **induzida** $-q'$ na face do dielétrico. Tome uma caixa gaussiana com uma face dentro da placa e outra dentro do dielétrico:

$$\varepsilon_0\oint\vec E\cdot d\vec A = q - q'.$$

O inconveniente é que $q'$ não é conhecida de antemão. Mas sabemos, pela seção 25-5, que o campo no dielétrico é $\kappa$ vezes menor que seria sem ele, o que equivale a dizer que $q - q' = q/\kappa$. Daí a forma útil da lei de Gauss em presença de dielétricos:

$$\varepsilon_0\oint\kappa\,\vec E\cdot d\vec A = q,$$

em que só aparece a carga **livre**. Três observações: a integral envolve $\kappa\vec E$, não apenas $\vec E$; $q$ é só a carga livre, e as cargas induzidas são levadas em conta por $\kappa$; e $\kappa$ fica dentro da integral porque pode variar de ponto a ponto (por exemplo, com dois dielétricos diferentes lado a lado ou empilhados).

Exemplo: placas de $0{,}010$ m² com $q = 50$ nC e um dielétrico de $\kappa = 4{,}0$ ocupando todo o espaço. Sem o dielétrico, $E_0 = q/(\varepsilon_0A) \approx 5{,}6\times10^5$ V/m. Com ele, $E = E_0/\kappa \approx 1{,}4\times10^5$ V/m, e a carga induzida em cada face é $q' = q(1 - 1/\kappa) = 37{,}5$ nC.

Se o dielétrico ocupa só parte do espaço, como uma placa de espessura $b < d$, o campo é $E_0$ no ar e $E_0/\kappa$ no dielétrico, e a tensão total é a soma dos dois trechos. Com a bateria ligada, o raciocínio é outro: $V$ fixo obriga o campo a ser $V/d$ onde o dielétrico ocupa toda a espessura, e quem muda é a carga livre.

Armadilha: incluir a carga induzida duas vezes, somando $q'$ e usando também $\kappa$.

No experimento, com a bateria desligada, compare o campo entre as placas sem dielétrico e com ele todo inserido, e verifique a razão $\kappa$.`,
      experiments: [
        { kind: "sim", id: "capacitores", scenario: "q-constante", note: "Com carga livre fixa, compare o campo com e sem dielétrico e confira o fator κ." },
        { kind: "sim", id: "capacitores", scenario: "q-constante", params: { kappa: 6 }, note: "Repita com κ = 6 e calcule a carga induzida na face do dielétrico." },
      ],
    },
  },
};
