import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 22,
  intro: String.raw`A lei de Coulomb diz quanto vale a força entre duas cargas, mas deixa uma pergunta: como uma carga "sabe" da outra à distância? A resposta da física é o **campo elétrico**: cada carga altera o espaço à sua volta, e outra carga colocada ali sente a força desse campo. Neste capítulo calculamos o campo de uma partícula, de um dipolo e de distribuições contínuas (linha, anel e disco), e depois invertemos o problema: o que acontece com uma carga ou com um dipolo colocados num campo conhecido.`,
  sections: {
    "22-1": {
      text: String.raw`### O Campo Elétrico
Para descobrir o campo num ponto P, imaginamos uma **carga de prova** $q_0$ positiva e pequena (para não perturbar as outras cargas) e medimos a força sobre ela. O campo é a força por unidade de carga:

$$\vec E = \frac{\vec F}{q_0}, \qquad [E] = \mathrm{N/C} = \mathrm{V/m}.$$

O campo é um **vetor** definido em cada ponto do espaço, exista ou não uma carga ali. Uma vez conhecido $\vec E$, a força sobre qualquer carga $q$ é $\vec F = q\vec E$: no mesmo sentido do campo se $q > 0$, no sentido oposto se $q < 0$. Exemplo: num ponto onde $E = 2{,}0\times10^4$ N/C apontando para leste, um elétron sente $F = 1{,}6\times10^{-19}\cdot 2{,}0\times10^4 = 3{,}2\times10^{-15}$ N para **oeste**.

### Linhas de Campo Elétrico
As linhas de campo são um desenho que ajuda a enxergar o campo: em cada ponto a linha é **tangente** a $\vec E$, e a **densidade** de linhas (quantas atravessam uma área perpendicular) é proporcional ao módulo de $E$. As linhas nascem nas cargas positivas e morrem nas negativas (ou no infinito), e duas linhas nunca se cruzam, pois o campo tem uma só direção em cada ponto. Numa carga isolada as linhas são radiais e se espalham, mostrando que $E$ diminui com a distância; entre placas paralelas carregadas são retas paralelas igualmente espaçadas, sinal de campo uniforme.

Armadilha: o campo não existe só "em cima" das linhas. Elas são uma amostra; entre duas linhas desenhadas o campo existe e tem a direção que você interpolaria. Outra: uma linha de campo não é a trajetória de uma carga solta ali, porque a carga tem inércia e a força dá a direção da aceleração, não da velocidade.

No experimento, arraste a carga e a sonda, alterne entre linhas e grade de vetores e compare as duas representações do mesmo campo.`,
      experiments: [
        { kind: "sim", id: "campo-eletrico", scenario: "carga", note: "Compare linhas de campo e vetores e meça E com a sonda em vários pontos." },
        { kind: "concepcao", id: "campo-so-nas-linhas", note: "Confronte a ideia de que o campo só existe onde há linha desenhada." },
      ],
    },
    "22-2": {
      text: String.raw`Aplicando a definição $\vec E = \vec F/q_0$ à lei de Coulomb, o campo de uma partícula de carga $q$ num ponto à distância $r$ é

$$\vec E = \frac{1}{4\pi\varepsilon_0}\,\frac{q}{r^2}\,\hat r,$$

onde $\hat r$ é o unitário que aponta **da carga para o ponto**. Para $q > 0$ o campo aponta para fora; para $q < 0$, para dentro. O módulo cai com o inverso do quadrado da distância: dobrar $r$ divide $E$ por quatro.

Com várias partículas, o campo total é a **soma vetorial** dos campos de cada uma (superposição):

$$\vec E = \vec E_1 + \vec E_2 + \dots + \vec E_n.$$

O procedimento seguro é desenhar cada vetor no ponto, decompor em componentes $x$ e $y$ e somar componente por componente. Exemplo: duas cargas de $+4{,}0$ nC estão em $x = -0{,}20$ m e $x = +0{,}20$ m. No ponto médio, os campos têm módulo $8{,}99\times10^9\cdot4{,}0\times10^{-9}/0{,}04 = 900$ N/C cada, mas sentidos opostos, e o campo resultante é **zero**. No ponto $(0;\ 0{,}20$ m$)$, cada campo vale $8{,}99\times10^9\cdot4{,}0\times10^{-9}/0{,}08 \approx 450$ N/C, a $45°$ do eixo; as componentes $x$ se cancelam e as $y$ se somam: $E = 2\cdot450\cos45° \approx 640$ N/C, para cima.

Armadilha: o ponto de campo nulo entre duas cargas de mesmo sinal e módulos diferentes fica **mais perto da carga menor**, e entre cargas de sinais opostos ele não está entre elas, mas do lado de fora, junto à de menor módulo.

No experimento, coloque as duas cargas iguais, leve a sonda ao ponto médio para ver o campo nulo e depois desloque uma carga e procure o novo ponto de equilíbrio.`,
      experiments: [
        { kind: "sim", id: "campo-eletrico", scenario: "iguais", note: "Ache o ponto de campo nulo entre duas cargas e veja como ele se desloca." },
        { kind: "sim", id: "campo-eletrico", scenario: "carga", note: "Meça E a 0,5 m e a 1,0 m e confira a lei do inverso do quadrado." },
      ],
    },
    "22-3": {
      text: String.raw`Um **dipolo elétrico** é um par de cargas $+q$ e $-q$ separadas por uma distância $d$. Ele é caracterizado pelo **momento dipolar**

$$\vec p = q\,\vec d,$$

um vetor que aponta da carga negativa para a positiva. Muitas moléculas (a água, por exemplo) se comportam como dipolos, porque o centro das cargas positivas não coincide com o das negativas.

Sobre o eixo do dipolo, a uma distância $z$ do centro, os campos das duas cargas têm sentidos opostos e quase se cancelam. Fazendo a conta e supondo $z \gg d$:

$$E \approx \frac{1}{2\pi\varepsilon_0}\,\frac{p}{z^3}.$$

O campo do dipolo cai com o **cubo** da distância, mais depressa que o de uma carga isolada. A razão física é que, de longe, as duas cargas parecem estar no mesmo lugar, e a carga total é zero; só sobra a pequena diferença entre as distâncias. Note também que só o produto $p = qd$ aparece: dobrar $q$ e reduzir $d$ à metade dá o mesmo campo distante.

Exemplo: um dipolo com $q = 5{,}0$ nC e $d = 2{,}0$ cm tem $p = 1{,}0\times10^{-10}$ C·m. A $z = 0{,}20$ m sobre o eixo, $E \approx 2\cdot8{,}99\times10^9\cdot1{,}0\times10^{-10}/0{,}008 \approx 225$ N/C. A $0{,}40$ m o campo cai para cerca de $28$ N/C, um oitavo.

Armadilha: aplicar a fórmula aproximada perto do dipolo ($z$ comparável a $d$) dá erros grandes; ali é preciso somar os dois campos exatamente. Na mediatriz, o campo também cai como $1/r^3$, mas aponta paralelo ao eixo, no sentido de $-\vec p$.

No experimento, observe que todas as linhas que saem de $+q$ terminam em $-q$ e leve a sonda ao longo do eixo para ver o campo cair rapidamente.`,
      experiments: [
        { kind: "sim", id: "campo-eletrico", scenario: "dipolo", note: "Explore as linhas de um dipolo e meça como E cai ao longo do eixo." },
      ],
    },
    "22-4": {
      text: String.raw`Quando a carga está espalhada por um objeto, trocamos a soma por uma integral. Descrevemos a distribuição pela **densidade linear de carga** $\lambda = dq/d\ell$ (C/m), dividimos o objeto em elementos $dq = \lambda\,d\ell$, escrevemos o campo $d\vec E$ de cada elemento como se fosse uma partícula e integramos. O passo decisivo é usar a **simetria** para descobrir quais componentes se cancelam antes de integrar.

O exemplo clássico é o **anel** de raio $R$ e carga $Q$, num ponto do eixo a uma distância $z$ do centro. Para cada elemento existe outro diametralmente oposto: as componentes perpendiculares ao eixo se anulam e só as axiais se somam. Todas as contribuições axiais são iguais, e o resultado é

$$E = \frac{1}{4\pi\varepsilon_0}\,\frac{Q\,z}{(z^2+R^2)^{3/2}}.$$

Dois limites servem de verificação: no centro ($z = 0$) o campo é nulo, e longe ($z \gg R$) vira $kQ/z^2$, o de uma carga pontual. Entre os dois há um máximo, em $z = R/\sqrt2$.

Exemplo: anel com $Q = 10$ nC e $R = 0{,}40$ m, em $z = 0{,}30$ m: $E = 8{,}99\times10^9\cdot10^{-8}\cdot0{,}30/(0{,}25)^{3/2} \approx 216$ N/C.

Para um **fio retilíneo** muito longo com densidade $\lambda$, o mesmo método dá $E = \lambda/(2\pi\varepsilon_0 r)$, que cai como $1/r$ (veja também a seção 23-4, onde a lei de Gauss chega a esse resultado em uma linha).

Armadilha: integrar o módulo $dE$ sem projetar no eixo dá um resultado maior que o correto, porque soma contribuições que deveriam se cancelar.

No experimento, divida o anel em $N$ pedaços e veja as componentes perpendiculares girarem e se cancelarem; depois passe para o fio finito e compare com o fio infinito.`,
      experiments: [
        { kind: "sim", id: "coulomb", scenario: "anel", note: "Some os campos dos elementos do anel e compare com a fórmula fechada." },
        { kind: "sim", id: "coulomb", scenario: "fio", note: "Divida um fio finito em N pedaços e compare com o fio infinito perto dele." },
      ],
    },
    "22-5": {
      text: String.raw`Para uma carga espalhada numa superfície usamos a **densidade superficial** $\sigma = dq/dA$ (C/m²). Um disco de raio $R$ uniformemente carregado pode ser visto como uma coleção de anéis concêntricos de raio $r$ e largura $dr$, cada um com carga $dq = \sigma\,2\pi r\,dr$. Usando o resultado do anel (seção 22-4) e somando todos os anéis, o campo num ponto do eixo a uma distância $z$ é

$$E = \frac{\sigma}{2\varepsilon_0}\left(1 - \frac{z}{\sqrt{z^2+R^2}}\right).$$

Os limites contam a história. Muito perto do disco ($z \ll R$), ou com o disco muito grande ($R\to\infty$), o termo entre parênteses tende a 1 e

$$E = \frac{\sigma}{2\varepsilon_0},$$

um campo que **não depende da distância**: é o campo de um plano infinito, retomado na seção 23-5. Muito longe ($z \gg R$), o disco se comporta como uma carga pontual $Q = \sigma\pi R^2$.

Exemplo: um disco de raio $0{,}10$ m com $\sigma = 5{,}0\ \mu\mathrm{C/m^2}$. A $z = 1{,}0$ cm, $E \approx (5{,}0\times10^{-6}/1{,}77\times10^{-11})(1 - 0{,}0995) \approx 2{,}5\times10^5$ N/C; a $z = 50$ cm, o campo caiu para cerca de $5{,}4\times10^3$ N/C, perto do valor de carga pontual.

Armadilha: achar que "campo constante" significa que o plano infinito não tem nada de especial perto ou longe; na verdade é a geometria (quanto mais longe, mais carga fica num cone de mesmo ângulo) que compensa o $1/r^2$.

No experimento, fatie o disco em poucos anéis, anote o erro da soma e aumente $N$ para ver a convergência; depois aproxime e afaste o ponto P para reconhecer os dois limites.`,
      experiments: [
        { kind: "sim", id: "coulomb", scenario: "disco", note: "Fatie o disco em anéis e veja a soma convergir para a fórmula fechada." },
      ],
    },
    "22-6": {
      text: String.raw`Agora o problema inverso: o campo é dado e queremos saber o que ele faz com uma partícula de carga $q$ e massa $m$. A força é $\vec F = q\vec E$ e, pela segunda lei de Newton,

$$\vec a = \frac{q\,\vec E}{m}.$$

Num **campo uniforme** a aceleração é constante, e todas as ferramentas da cinemática do capítulo 4 se aplicam. Uma partícula que entra com velocidade perpendicular ao campo descreve uma **parábola**, como um projétil, com o campo fazendo o papel da gravidade. É assim que funcionam os tubos de raios catódicos e as impressoras a jato de tinta: gotas carregadas passam entre placas defletoras e são desviadas para o lugar certo do papel.

Exemplo: um elétron entra a $2{,}0\times10^7$ m/s entre placas de $4{,}0$ cm de comprimento onde $E = 1{,}0\times10^4$ N/C. A aceleração é $a = 1{,}6\times10^{-19}\cdot10^4/9{,}1\times10^{-31} \approx 1{,}8\times10^{15}$ m/s². O tempo entre as placas é $t = 0{,}04/2\times10^7 = 2{,}0$ ns, e o desvio vertical é $\tfrac12at^2 \approx 3{,}5$ mm. O peso do elétron é cerca de $10^{14}$ vezes menor que a força elétrica e pode ser ignorado.

O mesmo raciocínio está por trás do experimento de Millikan (seção 21-2): ajustando o campo entre placas horizontais, a força elétrica $qE$ equilibra o peso $mg$ de uma gotícula, e a carga sai de $q = mg/E$.

Armadilha: a direção da aceleração é a do campo (para $q > 0$), mas a trajetória só segue as linhas de campo se a partícula partir do repouso num campo de linhas retas.

No experimento, desligue o campo magnético do tubo e veja o feixe de elétrons descrever uma parábola entre as placas; ajuste também a tensão entre as placas de Millikan até segurar uma gota parada e, no hóquei elétrico, posicione cargas para que o campo leve o disco ao gol.`,
      experiments: [
        { kind: "sim", id: "razao-em", scenario: "parabola-e", note: "Só com o campo elétrico, confira que o desvio do feixe cresce com o quadrado da distância percorrida." },
        { kind: "sim", id: "millikan", scenario: "equilibrio", note: "Ajuste o campo entre as placas até a força elétrica equilibrar o peso da gota." },
        { kind: "sim", id: "jogos-fisica", scenario: "hoquei", note: "Posicione cargas fixas para que o campo conduza o disco carregado ao gol." },
        { kind: "desafio", id: "hoquei-uma-carga", note: "Faça o gol usando uma única carga." },
        { kind: "sim", id: "razao-em", scenario: "teltron", note: "Veja a deflexão parabólica de um feixe de elétrons entre placas carregadas." },
      ],
    },
    "22-7": {
      text: String.raw`Num campo **uniforme**, as forças sobre as duas cargas de um dipolo, $+q\vec E$ e $-q\vec E$, se cancelam: a força resultante é nula e o centro do dipolo não acelera. Mas as forças atuam em pontos diferentes e formam um **binário**, que produz um torque

$$\vec\tau = \vec p \times \vec E, \qquad \tau = pE\sin\theta,$$

onde $\theta$ é o ângulo entre $\vec p$ e $\vec E$. O torque tende a girar o dipolo para alinhá-lo com o campo. Associada a esse torque há uma **energia potencial** de orientação,

$$U = -\vec p\cdot\vec E = -pE\cos\theta,$$

mínima ($-pE$) quando o dipolo está alinhado e máxima ($+pE$) quando está antiparalelo. Para girar o dipolo de $\theta_i$ até $\theta_f$, um agente externo precisa realizar trabalho $W = U_f - U_i$ (com o dipolo começando e terminando em repouso).

Exemplo: uma molécula de água tem $p \approx 6{,}2\times10^{-30}$ C·m. Num campo de $1{,}0\times10^5$ N/C, o torque máximo (a $90°$) é $6{,}2\times10^{-25}$ N·m, e virá-la do alinhamento para a posição antiparalela exige $2pE = 1{,}2\times10^{-24}$ J. É esse alinhamento que o forno de micro-ondas explora: o campo oscila, as moléculas giram de um lado para o outro e transferem energia para a comida.

Armadilha: força resultante nula não significa que nada acontece. Solto do repouso fora do alinhamento e sem atrito, o dipolo não para alinhado: ele passa pela posição de equilíbrio com velocidade máxima e oscila como um pêndulo. Com amortecimento, acaba em $\theta = 0$. Num campo **não uniforme** aparece também uma força resultante, que puxa o dipolo para a região de campo mais intenso.

No experimento, solte o dipolo a $60°$ do campo, meça o período das oscilações e depois ligue o amortecimento para vê-lo se alinhar.`,
      experiments: [
        { kind: "sim", id: "campo-eletrico", scenario: "torque", note: "Solte o dipolo num campo uniforme, meça o período e veja a energia se conservar." },
        { kind: "sim", id: "campo-eletrico", scenario: "torque", params: { th0: 10, b: 0 }, note: "Com ângulo inicial pequeno, compare o período medido com T = 2π√(I/pE)." },
      ],
    },
  },
};
