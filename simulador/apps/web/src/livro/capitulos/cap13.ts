import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 13,
  intro: String.raw`A mesma força que faz uma maçã cair mantém a Lua em órbita, organiza o Sistema Solar e reúne galáxias. Este capítulo apresenta a **lei da gravitação universal** de Newton e suas consequências: a superposição de forças de várias massas, a variação de $g$ com a altitude, a latitude e a profundidade, a energia potencial gravitacional e a velocidade de escape, as **leis de Kepler** para os planetas e a energia dos satélites em órbita. No fim, o princípio da equivalência de Einstein mostra que a gravitação pode ser entendida de outra maneira, como curvatura do espaço-tempo, ideia que hoje é indispensável até para o GPS do celular funcionar.`,
  sections: {
    "13-2": {
      text: String.raw`Toda partícula do Universo atrai todas as outras. Para duas partículas de massas $m_1$ e $m_2$ separadas por uma distância $r$, a força de atração tem módulo
$$F = G\,\frac{m_1 m_2}{r^2},$$
está dirigida ao longo da reta que une as partículas e forma um par ação-reação: a Terra puxa a maçã com a mesma força com que a maçã puxa a Terra. $G$ é a **constante gravitacional**:
$$G = 6{,}674\times10^{-11}\ \text{N·m}^2/\text{kg}^2 .$$

### Quão fraca é a gravitação
O valor minúsculo de $G$ faz a atração entre objetos comuns ser imperceptível. Por isso medir $G$ é difícil: Cavendish, em 1798, usou uma **balança de torção** (seção 15-5) com esferas de chumbo e mediu ângulos de frações de grau. Só porque a Terra tem massa enorme o peso dos objetos é apreciável.

### Corpos extensos
A lei vale para partículas. Para corpos esféricos, Newton provou o **teorema das cascas**: uma casca esférica uniforme atrai uma partícula externa como se toda a sua massa estivesse no centro. Assim, planetas e estrelas, que são aproximadamente camadas esféricas, podem ser tratados como partículas para quem está fora deles.

**Exemplo.** Duas pessoas de 70 kg a 1,0 m uma da outra se atraem com $6{,}67\times10^{-11} \cdot 70 \cdot 70/1{,}0^2 \approx 3{,}3\times10^{-7}$ N, cerca do peso de um grão de poeira. Já a Terra ($5{,}97\times10^{24}$ kg) e a Lua ($7{,}35\times10^{22}$ kg), a $3{,}84\times10^{8}$ m, se atraem com cerca de $2{,}0\times10^{20}$ N.

**Armadilha:** achar que o corpo mais pesado puxa mais forte. As forças sobre os dois têm o mesmo módulo; quem acelera muito mais é o de menor massa.

No experimento, arraste as duas massas e veja $F$ cair com $1/r^2$ e dobrar quando uma massa dobra; depois troque as esferas da balança de Cavendish de lado, meça o deslocamento do equilíbrio e calcule $G$.`,
      experiments: [
        { kind: "sim", id: "cavendish", scenario: "lei", note: "Arraste as duas massas e confira que F cai com 1/r² e é proporcional ao produto das massas." },
        { kind: "sim", id: "cavendish", scenario: "cavendish", note: "Troque as esferas grandes de lado, meça o novo equilíbrio e o período e calcule G." },
        { kind: "pratica", id: "exp1-cavendish", note: "Roteiro de bancada da balança de torção de Cavendish." },
        { kind: "concepcao", id: "terceira-lei-massas", note: "Confronte a ideia de que o corpo de maior massa atrai com mais força." },
      ],
    },
    "13-3": {
      text: String.raw`Quando várias partículas atraem uma partícula de massa $m_1$, a força resultante é a **soma vetorial** das forças que cada uma exerceria sozinha:
$$\vec F_{1,\text{res}} = \sum_{i=2}^{n} \vec F_{1i} .$$
É o **princípio da superposição**: a presença de uma terceira massa não altera a força entre as duas primeiras. Cada termo tem módulo $G m_1 m_i/r_{1i}^2$ e aponta de $m_1$ para $m_i$; soma-se por componentes, como qualquer vetor.

### Corpo extenso
Para um corpo contínuo, divide-se o corpo em elementos de massa $dm$ e a soma vira integral:
$$\vec F_1 = \int d\vec F .$$
O teorema das cascas (seção 13-2) é justamente o resultado dessa integral para uma casca esférica.

### Campo gravitacional
Dividindo a força sobre uma partícula de teste pela sua massa, obtém-se o **campo gravitacional** $\vec g = \vec F/m$ em cada ponto, que também é uma soma vetorial das contribuições de todas as massas. Em pontos entre duas massas os campos podem se cancelar.

**Exemplo.** Uma partícula de 1,0 kg na origem, uma massa de 800 kg em $x = 2{,}5$ m e outra de 500 kg em $y = 2{,}0$ m. As forças valem $6{,}67\times10^{-11}\cdot 800/2{,}5^2 \approx 8{,}5\times10^{-9}$ N (para $+x$) e $6{,}67\times10^{-11}\cdot 500/2{,}0^2 \approx 8{,}3\times10^{-9}$ N (para $+y$). A resultante tem módulo $\approx 1{,}19\times10^{-8}$ N, a cerca de 44° do eixo $x$.

**Armadilha:** somar os módulos das forças, como se todas apontassem na mesma direção. Só se somam módulos quando as forças são paralelas.

No experimento, coloque duas massas como no exemplo e confira módulo e direção da resultante; acrescente a terceira massa, arraste-as e veja o campo ao fundo se reorganizar, incluindo pontos onde ele se anula.`,
      experiments: [
        { kind: "sim", id: "gravitacao-terra", scenario: "superposicao", params: { n: 2, mA: 800, mB: 500, dA: 2.5, dB: 2, m0: 1 }, note: "Reproduza o exemplo e confira |F| ≈ 1,19 × 10⁻⁸ N a cerca de 44° do eixo x." },
        { kind: "sim", id: "gravitacao-terra", scenario: "superposicao", note: "Com três massas, arraste-as e veja a força resultante e o campo g mudarem." },
        { kind: "sim", id: "orbitas-kepler", scenario: "tres", note: "Com três corpos, a força sobre cada um é a soma das outras duas e o movimento fica complexo." },
      ],
    },
    "13-4": {
      text: String.raw`Tratando a Terra como uma esfera uniforme de massa $M$, uma partícula a uma distância $r$ do centro (fora da Terra) tem aceleração gravitacional
$$a_g = \frac{GM}{r^2} .$$
A uma altitude $h$ acima da superfície ($r = R + h$), $a_g$ diminui com o quadrado da distância ao centro. Na superfície, $GM/R^2 \approx 9{,}83$ m/s².

### Por que o g medido varia
O peso medido numa balança, $mg$, difere de $m a_g$ por três motivos:
- **A Terra não é uniforme.** A densidade varia de região para região (minérios densos, cadeias de montanhas); geólogos mapeiam essas anomalias.
- **A Terra não é esférica.** Ela é achatada nos polos: o raio equatorial é cerca de 21 km maior que o polar, e nos polos se está mais perto do centro.
- **A Terra gira.** No equador, parte da atração gravitacional é usada como força centrípeta. A balança marca $mg = m a_g - m\omega^2 R$. Nos polos, o termo de rotação é zero.
Os dois últimos efeitos fazem $g$ ir de cerca de 9,78 m/s² no equador a 9,83 m/s² nos polos.

**Exemplo.** A 400 km de altitude (estação espacial), $a_g = 3{,}99\times10^{14}/(6{,}77\times10^{6})^2 \approx 8{,}7$ m/s², ainda 89% do valor na superfície: os astronautas não flutuam por falta de gravidade (seção 13-8). No equador, $\omega^2 R = (7{,}29\times10^{-5})^2 \cdot 6{,}37\times10^{6} \approx 0{,}034$ m/s²: uma pessoa de 70 kg "pesa" 2,4 N a menos por causa da rotação.

**Armadilha:** dizer que a gravidade "acaba" pouco acima da atmosfera. Ela diminui com $1/r^2$ e nunca se anula.

No experimento, suba a altitude e veja $g$ cair; mude a latitude e a duração do dia e acompanhe o peso aparente de uma pessoa na balança. Encurte o dia até a balança no equador marcar zero.`,
      experiments: [
        { kind: "sim", id: "gravitacao-terra", scenario: "g-altitude", note: "Na altitude da estação espacial, confira g ≈ 8,7 m/s² e varie h até milhares de quilômetros." },
        { kind: "sim", id: "gravitacao-terra", scenario: "g-altitude", params: { h: 0, lat: 0, m0: 70 }, note: "Na superfície, mude a latitude do equador ao polo e a duração do dia e leia o peso aparente." },
        { kind: "sim", id: "cavendish", scenario: "campo", note: "Veja o campo gravitacional de um planeta apontando para o centro e enfraquecendo com a distância." },
        { kind: "sim", id: "mares-lagrange", scenario: "sizigia", note: "A diferença de g entre os dois lados da Terra produz as marés." },
      ],
    },
    "13-5": {
      text: String.raw`O teorema das cascas tem uma segunda parte: **uma casca esférica uniforme não exerce força resultante sobre uma partícula no seu interior**. As atrações das partes da casca, mais próximas mas menores de um lado, mais distantes e maiores do outro, se cancelam exatamente.

### Dentro de uma Terra uniforme
A uma distância $r$ do centro, a matéria fora do raio $r$ forma cascas que não contribuem; só a massa interna $M_{\text{int}} = M\, r^3/R^3$ atrai a partícula, como se estivesse no centro:
$$a_g(r) = \frac{G M_{\text{int}}}{r^2} = \frac{GM}{R^3}\, r .$$
A gravidade cresce **linearmente** do centro (onde é zero) até a superfície e depois cai com $1/r^2$.

### A Terra real
A Terra não é uniforme: o núcleo de ferro tem densidade em torno de 11 g/cm³, o dobro da média das rochas do manto. Por isso, descendo, $g$ primeiro **aumenta** um pouco (chega a cerca de 10,7 m/s² na fronteira entre manto e núcleo) e só depois cai a zero no centro.

### Túnel pela Terra
Num túnel retilíneo através de uma Terra uniforme, a componente da força ao longo do túnel é proporcional ao deslocamento a partir do meio: o movimento é um **MHS** (seção 15-3) com período
$$T = 2\pi\sqrt{\frac{R^3}{GM}} = 2\pi\sqrt{\frac{R}{g}} \approx 84\ \text{min},$$
o mesmo de uma órbita rasante, qualquer que seja a corda escolhida.

**Exemplo.** Numa Terra uniforme, a 3000 km do centro, $g = 9{,}8 \cdot 3000/6371 \approx 4{,}6$ m/s². Uma cápsula solta num túnel de São Paulo a Tóquio (sem atrito) chegaria do outro lado em cerca de 42 minutos e voltaria se ninguém a segurasse.

**Armadilha:** imaginar que a gravidade é máxima no centro da Terra, onde "toda a massa está em volta". Lá ela é zero: puxões de todos os lados se cancelam.

No experimento, desça ao interior nos três modelos (uniforme, núcleo denso, casca oca) e compare os gráficos de $g(r)$; depois atravesse a Terra pelo túnel e meça o tempo de travessia para cordas diferentes.`,
      experiments: [
        { kind: "sim", id: "gravitacao-terra", scenario: "interior", note: "Compare g(r) para a Terra uniforme, com núcleo denso e oca, e localize o máximo de g." },
        { kind: "sim", id: "gravitacao-terra", scenario: "tunel", note: "Atravesse a Terra pelo túnel e meça o tempo; mude a distância da corda ao centro e veja que ele não muda." },
        { kind: "sim", id: "gravitacao-terra", scenario: "tunel", params: { b: 4000 }, note: "Num túnel que não passa pelo centro, confira o mesmo tempo de travessia de cerca de 42 minutos." },
      ],
    },
    "13-6": {
      text: String.raw`A força gravitacional é conservativa (seção 8-3): o trabalho que ela realiza só depende das posições inicial e final. Escolhendo a energia potencial **nula no infinito**, a energia potencial de duas partículas separadas por $r$ é
$$U = -\frac{GMm}{r} .$$
Ela é negativa e se aproxima de zero quando $r$ cresce: é preciso fornecer energia para afastar as partículas. Para um sistema de várias partículas, soma-se $U$ de cada par.

### Ligação com a força e com mgh
A força é $F = -dU/dr = -GMm/r^2$ (o sinal indica atração). Perto da superfície, para pequenos desníveis $h \ll R$, $\Delta U = GMm\,[1/R - 1/(R+h)] \approx mgh$, e recupera-se o resultado do capítulo 8.

### Velocidade de escape
Um projétil lançado da superfície escapa da Terra se tiver energia mecânica total maior ou igual a zero, chegando ao infinito com velocidade nula no caso limite:
$$\tfrac12 m v^2 - \frac{GMm}{R} = 0 \quad\Longrightarrow\quad v_{\text{esc}} = \sqrt{\frac{2GM}{R}} .$$
Para a Terra, $v_{\text{esc}} = \sqrt{2 \cdot 3{,}99\times10^{14}/6{,}37\times10^{6}} \approx 11{,}2$ km/s; para a Lua, 2,4 km/s, pequena demais para reter uma atmosfera. A velocidade de escape não depende da massa do projétil nem da direção de lançamento (desprezando o ar).

**Exemplo.** Levar 1,0 kg da superfície a 400 km de altitude exige $\Delta U = 3{,}99\times10^{14}\,(1/6{,}37\times10^6 - 1/6{,}77\times10^6) \approx 3{,}7$ MJ, um pouco menos que os 3,9 MJ dados por $mgh$ com $g$ constante.

**Armadilha:** achar que $U$ negativa significa "falta de energia" ou erro de sinal. Só as diferenças de $U$ têm significado físico; o sinal vem da escolha do zero no infinito.

No experimento, no canhão de Newton, aumente a velocidade de lançamento e veja a trajetória passar de queda a órbita e, acima de 11,2 km/s, a escape; nas órbitas de Kepler, aumente a velocidade inicial até a elipse se abrir.`,
      experiments: [
        { kind: "sim", id: "sistema-solar", scenario: "canhao", note: "Aumente v₀ do canhão de Newton e encontre as velocidades de órbita circular e de escape." },
        { kind: "sim", id: "orbitas-kepler", scenario: "elipse", note: "Aumente a razão entre a velocidade inicial e a circular até √2: a órbita deixa de ser fechada." },
        { kind: "sim", id: "gravitacao-terra", scenario: "tunel", note: "No túnel, veja a energia mecânica constante enquanto a energia potencial e a cinética se trocam." },
      ],
    },
    "13-7": {
      text: String.raw`No início do século XVII, Kepler analisou as observações precisas de Tycho Brahe e extraiu três leis empíricas do movimento dos planetas. Newton mostrou depois que todas decorrem da gravitação universal.

### 1ª lei: lei das órbitas
Todos os planetas descrevem **órbitas elípticas**, com o Sol num dos focos. A elipse tem semieixo maior $a$ e excentricidade $e$; a distância ao Sol varia de $a(1-e)$ (periélio) a $a(1+e)$ (afélio). A maioria das órbitas planetárias é quase circular (a da Terra tem $e \approx 0{,}017$).

### 2ª lei: lei das áreas
A reta que liga o planeta ao Sol varre **áreas iguais em tempos iguais**. Ela equivale à conservação do momento angular (a força gravitacional é central e não produz torque em relação ao Sol): $dA/dt = L/2m$ é constante. O planeta anda mais depressa perto do Sol e mais devagar longe dele.

### 3ª lei: lei dos períodos
O quadrado do período é proporcional ao cubo do semieixo maior:
$$T^2 = \left(\frac{4\pi^2}{GM}\right) a^3 .$$
A constante depende só da massa $M$ do corpo central; vale também para as luas de um planeta e os satélites artificiais, com a massa do planeta no lugar da do Sol. Medindo $T$ e $a$ de um satélite, obtém-se a massa do corpo central.

**Exemplo.** Em unidades de UA e anos, a 3ª lei para o Sol fica $T^2 = a^3$. Um asteroide com $a = 2{,}8$ UA tem $T = 2{,}8^{1{,}5} \approx 4{,}7$ anos. Um cometa com periélio a 0,6 UA e afélio a 35 UA tem $a \approx 17{,}8$ UA e $T \approx 75$ anos.

**Armadilha:** achar que o período depende da excentricidade. Duas órbitas com o mesmo semieixo maior, uma circular e outra muito alongada, têm o mesmo período.

No experimento, observe as áreas varridas em intervalos iguais numa órbita elíptica; depois compare os planetas internos e confira que $T^2/a^3$ é o mesmo para todos.`,
      experiments: [
        { kind: "sim", id: "orbitas-kepler", scenario: "elipse", note: "Compare as áreas varridas em intervalos iguais perto e longe da estrela." },
        { kind: "sim", id: "orbitas-kepler", scenario: "planetas", note: "Meça T e a dos planetas internos e confira que T²/a³ é constante." },
        { kind: "sim", id: "sistema-solar", scenario: "retro", note: "Veja como órbitas keplerianas simples produzem o laço retrógrado de Marte visto da Terra." },
      ],
    },
    "13-8": {
      text: String.raw`Para um satélite de massa $m$ em **órbita circular** de raio $r$ em torno de um planeta de massa $M$, a gravidade fornece a força centrípeta: $GMm/r^2 = mv^2/r$. Então
$$v = \sqrt{\frac{GM}{r}}, \qquad K = \frac{GMm}{2r} .$$
Com $U = -GMm/r$:
$$U = -2K, \qquad E = K + U = -\frac{GMm}{2r} .$$
A energia total é negativa (o satélite está ligado) e vale $-K$.

### Órbitas elípticas
Para uma órbita elíptica de semieixo maior $a$, a energia total é a mesma da órbita circular de raio $a$:
$$E = -\frac{GMm}{2a} .$$
Órbitas com o mesmo $a$ têm a mesma energia e o mesmo período (seção 13-7), independentemente da excentricidade.

### Paradoxos aparentes
- Satélites mais baixos andam **mais depressa**. Para subir de órbita, é preciso aumentar a energia total, mas a velocidade final será menor.
- Um satélite que sofre arrasto do ar perde energia, desce e **acelera**: o arrasto aumenta sua energia cinética, porque $U$ diminui o dobro.
- Manobras de transferência entre órbitas (Hohmann) usam dois impulsos tangenciais, no perigeu e no apogeu de uma elipse de transferência.

**Exemplo.** Um satélite de 1000 kg a 400 km de altitude ($r = 6{,}77\times10^{6}$ m) tem $v = \sqrt{3{,}99\times10^{14}/6{,}77\times10^{6}} \approx 7{,}7$ km/s, período de 92 min e $E \approx -2{,}9\times10^{10}$ J. A órbita **geoestacionária**, com período de um dia sideral (86 164 s), tem raio $r = (GMT^2/4\pi^2)^{1/3} \approx 42\,200$ km, a cerca de 35 800 km de altitude, e $v \approx 3{,}1$ km/s.

**Armadilha:** dizer que em órbita não há gravidade. A gravidade é o que mantém a órbita; os astronautas flutuam porque eles e a estação estão em **queda livre** juntos.

No experimento, ajuste o raio da órbita até o satélite acompanhar a rotação da Terra; depois faça uma transferência de Hohmann e compare as velocidades e energias nas duas órbitas circulares.`,
      experiments: [
        { kind: "sim", id: "sistema-solar", scenario: "geo", note: "Ajuste o raio da órbita até o satélite ficar parado em relação ao solo, em cerca de 42 000 km." },
        { kind: "sim", id: "orbitas-kepler", scenario: "hohmann", note: "Execute a transferência de Hohmann e compare velocidades e energias das órbitas inicial e final." },
        { kind: "desafio", id: "orbita-geoestacionaria", note: "Coloque um satélite em órbita geoestacionária." },
        { kind: "concepcao", id: "orbita-sem-gravidade", note: "Confronte a ideia de que em órbita não há gravidade." },
      ],
    },
    "13-9": {
      text: String.raw`### O princípio da equivalência
Einstein partiu de um fato que a física newtoniana tratava como coincidência: a massa que aparece na lei da gravitação (massa gravitacional) é igual à massa que aparece em $F = ma$ (massa inercial), e por isso todos os corpos caem com a mesma aceleração. Ele elevou isso a princípio: **num laboratório pequeno e fechado, não há experimento capaz de distinguir um campo gravitacional uniforme de uma aceleração do laboratório**.
- Uma cabine parada na Terra e um foguete acelerando a 9,8 m/s² no espaço são indistinguíveis por dentro: uma bola solta "cai" igual nos dois.
- Uma cabine em queda livre na Terra e uma cabine à deriva longe de tudo também são indistinguíveis: objetos flutuam nas duas.

### Consequências
- **A luz se curva na gravidade.** Num foguete acelerado, um pulso de luz que atravessa a cabine na horizontal chega à parede oposta um pouco mais baixo; pela equivalência, o mesmo deve ocorrer num campo gravitacional. A luz de estrelas que passa rente ao Sol é desviada de cerca de 1,75 segundo de arco, medido no eclipse de 1919.
- **Relógios andam mais devagar** em campos gravitacionais mais intensos. Os relógios dos satélites GPS, a 20 000 km de altitude, adiantam cerca de 45 μs por dia por esse efeito (e atrasam cerca de 7 μs pela velocidade); sem a correção de 38 μs por dia, o erro de posição cresceria uns 10 km por dia.

### Curvatura do espaço-tempo
Na relatividade geral, a gravitação deixa de ser uma força: massas curvam o espaço-tempo, e corpos livres seguem as trajetórias "mais retas" possíveis nessa geometria curva. Dois aviões que partem do equador rumo ao norte em rotas paralelas se aproximam no polo sem nenhuma força entre eles, só porque a superfície da Terra é curva; da mesma forma, a curvatura faz corpos livres se aproximarem. Para campos fracos, a teoria de Einstein reproduz a de Newton; a diferença aparece perto de estrelas compactas, buracos negros e nas ondas gravitacionais, detectadas diretamente em 2015.

**Armadilha:** pensar que a equivalência vale em qualquer escala. Num laboratório grande, as diferenças de direção e intensidade de $g$ (efeitos de maré, seção 13-4) revelam o campo gravitacional.

No experimento, compare por dentro a cabine parada na Terra com o foguete acelerado e a queda livre com a deriva no espaço; mude o ponto de vista para fora e veja o pulso de luz se curvar.`,
      experiments: [
        { kind: "sim", id: "gravitacao-terra", scenario: "equivalencia", note: "Compare a cabine parada na Terra com o foguete acelerando: por dentro, a bola cai do mesmo jeito." },
        { kind: "sim", id: "gravitacao-terra", scenario: "equivalencia", params: { situacao: 2 }, note: "Na cabine em queda livre, objetos flutuam como à deriva no espaço; troque o ponto de vista para fora." },
        { kind: "concepcao", id: "orbita-sem-gravidade", note: "Queda livre não é ausência de gravidade: confronte a concepção com o elevador de Einstein." },
      ],
    },
  },
};
