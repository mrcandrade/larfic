import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 29,
  intro: String.raw`No capítulo 28 o campo magnético era dado, e estudamos o que ele faz com cargas e correntes. Agora invertemos a pergunta: que campo uma corrente produz? A resposta, observada por Ørsted em 1820 ao ver uma bússola desviar perto de um fio, é dada pela **lei de Biot-Savart**, que soma as contribuições de cada pedaço do fio, e pela **lei de Ampère**, que resolve com elegância os casos de alta simetria. Com elas calculamos o campo de fios, espiras, solenoides e toroides, entendemos por que fios paralelos se atraem e vemos que uma espira com corrente é um dipolo magnético, como um pequeno ímã.`,
  sections: {
    "29-1": {
      text: String.raw`Cada elemento $d\vec s$ de um fio com corrente $i$ contribui com um pequeno campo $d\vec B$ num ponto a uma distância $r$, dado pela **lei de Biot-Savart**:

$$d\vec B = \frac{\mu_0}{4\pi}\,\frac{i\,d\vec s\times\hat r}{r^2}, \qquad \mu_0 = 4\pi\times10^{-7}\ \mathrm{T\cdot m/A},$$

onde $\hat r$ aponta do elemento para o ponto. A constante $\mu_0$ é a **permeabilidade do vácuo**. Como no caso elétrico, a contribuição cai com $1/r^2$; a diferença é o produto vetorial: $d\vec B$ é perpendicular ao elemento e a $\hat r$, e é nula para pontos alinhados com o próprio elemento.

### Cálculo do Campo Magnético Produzido por uma Corrente
**Fio retilíneo longo.** Integrando ao longo de um fio infinito, o campo a uma distância $R$ é

$$B = \frac{\mu_0\,i}{2\pi R}.$$

As linhas de campo são **círculos** concêntricos ao fio. O sentido sai da regra da mão direita: polegar no sentido da corrente, os dedos curvados dão o sentido de $\vec B$. Para um ponto na perpendicular que passa pela **extremidade** de um fio semi-infinito, o campo é metade disso.

**Arco de circunferência.** No centro de um arco de raio $R$ e ângulo central $\phi$ (em radianos), todos os elementos estão à mesma distância e perpendiculares a $\hat r$, e a integral é imediata:

$$B = \frac{\mu_0\,i\,\phi}{4\pi R}.$$

Para uma espira completa ($\phi = 2\pi$), $B = \mu_0 i/(2R)$. Trechos retos cuja reta passa pelo ponto não contribuem.

Exemplo: um fio longo com $10$ A produz, a $2{,}0$ cm de distância, $B = 2\times10^{-7}\cdot10/0{,}020 = 1{,}0\times10^{-4}$ T, o dobro do campo da Terra. Por isso uma bússola perto de cabos de alta corrente erra. Uma espira de $3{,}0$ cm de raio com $5{,}0$ A produz no centro cerca de $1{,}0\times10^{-4}$ T.

Armadilha: esperar que as linhas de campo de um fio saiam dele ou cheguem a ele, como as de uma carga. Elas giram ao redor do fio e nunca terminam.

No experimento, desenhe um caminho de corrente qualquer e veja o campo calculado pela soma dos trechos; depois, no fio longo, mova a sonda e confira que $B$ cai com $1/R$.`,
      experiments: [
        { kind: "sim", id: "biot-savart", scenario: "fio", note: "Mova a sonda e verifique B = μ₀i/(2πR) em torno do fio longo." },
        { kind: "sim", id: "biot-savart", scenario: "desenho", note: "Desenhe um caminho de corrente e veja B somado trecho a trecho." },
        { kind: "concepcao", id: "campo-so-nas-linhas" },
      ],
    },
    "29-2": {
      text: String.raw`Dois fios paralelos com corrente interagem: cada um está no campo magnético do outro. O fio $a$, com corrente $i_a$, produz no fio $b$, a uma distância $d$, o campo $B_a = \mu_0 i_a/(2\pi d)$, perpendicular a $b$. Pela seção 28-6, um trecho $L$ do fio $b$ sofre a força $i_bLB_a$, e a força por unidade de comprimento é

$$\frac{F}{L} = \frac{\mu_0\,i_a\,i_b}{2\pi d}.$$

Aplicando a regra da mão direita duas vezes (uma para o campo e outra para a força), conclui-se: **correntes paralelas se atraem e correntes antiparalelas se repelem**. É o oposto do que ocorre com cargas, em que sinais iguais se repelem. Pela terceira lei de Newton, a força em $a$ devida a $b$ tem o mesmo módulo.

Até 2019, essa força definia o **ampère**: a corrente que, em dois fios paralelos infinitos a $1$ m de distância no vácuo, produz $2\times10^{-7}$ N por metro. Hoje o ampère é definido pelo valor fixado da carga elementar, mas a relação continua valendo.

Exemplo: num cabo de extensão, os dois condutores levam $10$ A em sentidos opostos, a $3{,}0$ mm um do outro. A repulsão é $F/L = 2\times10^{-7}\cdot10\cdot10/0{,}0030 \approx 6{,}7\times10^{-3}$ N/m, imperceptível. Mas num curto-circuito de $10$ kA em barramentos de subestação a $10$ cm, a força chega a $200$ N por metro, e os barramentos precisam ser bem fixados. O mesmo efeito é usado no **canhão eletromagnético** (railgun) e explica o "estrangulamento" de plasmas por correntes intensas.

Armadilha: aplicar a intuição eletrostática ("iguais se repelem") a correntes. Para correntes, o sentido igual atrai.

No experimento, ponha dois fios paralelos lado a lado e meça a força por unidade de comprimento, $\mu_0 I_1 I_2/(2\pi d)$: atração com correntes no mesmo sentido, repulsão com sentidos opostos; depois, no experimento da força num fio, aplique o campo de um fio sobre o outro e confira o sentido da força.`,
      experiments: [
        { kind: "sim", id: "ampere", scenario: "dois-fios", note: "Veja a força entre dois fios paralelos e inverta uma das correntes." },
        { kind: "sim", id: "ampere", scenario: "opostas", note: "Meça o campo de um fio na posição do outro e veja o efeito do sentido das correntes." },
        { kind: "sim", id: "motor-hall", scenario: "fio", params: { B: 0.0001, Ifio: 10 }, note: "Ponha um fio de 10 A num campo de 0,1 mT (o de outro fio a 2 cm) e calcule a força." },
      ],
    },
    "29-3": {
      text: String.raw`A lei de Gauss relaciona o fluxo elétrico numa superfície fechada com a carga envolvida. O análogo magnético é a **lei de Ampère**, que relaciona a **circulação** de $\vec B$ ao longo de uma curva fechada (o **caminho amperiano**) com a corrente que atravessa a superfície limitada por ela:

$$\oint\vec B\cdot d\vec s = \mu_0\,i_{\text{env}}.$$

Correntes fora do caminho produzem campo sobre ele, mas a contribuição delas para a circulação se cancela. O sinal de cada corrente envolvida vem da regra da mão direita: dedos no sentido em que se percorre o caminho, o polegar indica as correntes positivas.

Como a lei de Gauss, a de Ampère vale sempre, mas só permite **calcular** $B$ quando a simetria faz $B$ sair da integral. **Fora de um fio longo** de raio $R$: um círculo de raio $r$ concêntrico dá $B\cdot2\pi r = \mu_0 i$, e recupera-se $B = \mu_0 i/(2\pi r)$. **Dentro do fio**, com a corrente distribuída uniformemente, o círculo de raio $r < R$ envolve apenas a fração $r^2/R^2$ da corrente:

$$B = \frac{\mu_0\,i}{2\pi R^2}\,r.$$

O campo cresce linearmente do centro (onde é zero) até a superfície e depois decai com $1/r$.

Exemplo: um fio de $2{,}0$ mm de raio com $20$ A tem, na superfície, $B = 2\times10^{-7}\cdot20/0{,}0020 = 2{,}0$ mT; a $1{,}0$ mm do eixo, $1{,}0$ mT; a $4{,}0$ mm, de novo $1{,}0$ mT.

Armadilha: concluir que, se a circulação é zero, o campo é zero no caminho. Um fio fora do caminho produz campo sobre ele; só a integral se anula, porque as contribuições positivas e negativas se compensam.

No experimento, percorra o caminho com o fio dentro e fora e acompanhe a integral acumulada; aumente o caminho, mude sua forma e confira que só a corrente envolvida importa.`,
      experiments: [
        { kind: "sim", id: "ampere", scenario: "um-fio", note: "Mude o tamanho e a forma do caminho: a circulação continua μ₀i." },
        { kind: "sim", id: "ampere", scenario: "fora", note: "Com o fio fora, veja B não nulo no caminho mas circulação zero." },
        { kind: "sim", id: "ampere", scenario: "desenho", note: "Desenhe caminhos que envolvam um, dois ou três fios e some as correntes com sinal." },
      ],
    },
    "29-4": {
      text: String.raw`Um **solenoide** é um fio enrolado em hélice, com espiras bem juntas. Os campos das espiras se somam no interior e quase se cancelam do lado de fora. Para um solenoide **ideal**, longo comparado ao diâmetro, o campo interno é uniforme e paralelo ao eixo, e o externo é desprezível. Um caminho amperiano retangular com um lado dentro e outro fora, de comprimento $h$, envolve $nh$ espiras ($n$ é o número de espiras por metro):

$$B\,h = \mu_0\,i\,n\,h \quad\Rightarrow\quad B = \mu_0\,n\,i.$$

O campo não depende do diâmetro nem da posição dentro do solenoide (longe das pontas). Nas extremidades, as linhas se abrem, e no centro de uma das bocas o campo vale aproximadamente a metade. O sentido segue a regra da mão direita: dedos acompanhando a corrente nas espiras, o polegar aponta o campo interno. Um solenoide se comporta como um ímã em barra, com o polo norte na ponta por onde as linhas saem.

Um **toroide** é um solenoide fechado em forma de rosca. Por simetria, as linhas são círculos dentro do núcleo. Um caminho circular de raio $r$ dentro dele envolve as $N$ espiras:

$$B = \frac{\mu_0\,i\,N}{2\pi r}.$$

O campo não é uniforme: diminui do raio interno para o externo. Fora do toroide, o campo ideal é zero, pois a corrente líquida envolvida é nula. Esse confinamento é usado em transformadores e nos tokamaks de fusão.

Exemplo: $500$ espiras em $25$ cm ($n = 2000$ m⁻¹) com $2{,}0$ A dão $B = 4\pi\times10^{-7}\cdot2000\cdot2{,}0 \approx 5{,}0$ mT, cem vezes o campo da Terra. Um núcleo de ferro (capítulo 32) pode multiplicar esse valor por centenas.

Armadilha: achar que um solenoide mais largo, com o mesmo número de espiras por metro, tem um campo interno mais fraco. No modelo ideal, $B$ depende só de $n$ e $i$.

No experimento, comece com uma espira e aumente o número de espiras e o comprimento até o campo interno ficar uniforme; compare com $\mu_0 n i$. No toroide, meça $B$ ao longo do raio do núcleo.`,
      experiments: [
        { kind: "sim", id: "biot-savart", scenario: "solenoide", params: { N: 80, L: 16, R: 2 }, note: "Num solenoide longo, compare o campo interno com μ₀ni e veja as bordas." },
        { kind: "sim", id: "biot-savart", scenario: "toroide", note: "Meça B dentro e fora do toroide e veja a dependência com 1/r." },
        { kind: "pratica", id: "exp3-bobina", note: "Meça o campo de bobinas na bancada e compare com Biot-Savart." },
      ],
    },
    "29-5": {
      text: String.raw`Uma bobina plana com corrente sofre torque num campo externo como um dipolo (seção 28-8). Ela também **produz** um campo de dipolo. No eixo de uma espira circular de raio $R$, a uma distância $z$ do centro, Biot-Savart dá

$$B(z) = \frac{\mu_0\,i\,R^2}{2\,(R^2 + z^2)^{3/2}}.$$

No centro ($z = 0$), recupera-se $\mu_0 i/(2R)$. Longe da espira ($z \gg R$), o resultado se simplifica, e com $\mu = NiA = Ni\pi R^2$:

$$B(z) \approx \frac{\mu_0}{2\pi}\,\frac{\mu}{z^3}.$$

É a mesma forma do campo de um dipolo elétrico no eixo, com $\mu_0/4\pi$ no lugar de $1/4\pi\varepsilon_0$ e $\mu$ no lugar de $p$. Por isso uma espira e um pequeno ímã em barra têm, longe deles, campos indistinguíveis: as linhas saem de um lado (o "norte") e voltam pelo outro. A face da espira de onde saem as linhas é dada pela regra da mão direita aplicada à corrente. Isso sugere, como Ampère propôs, que o magnetismo dos ímãs vem de correntes microscópicas.

Exemplo: uma espira de $3{,}0$ cm de raio com $5{,}0$ A tem $\mu = 5{,}0\cdot\pi\cdot(0{,}030)^2 \approx 1{,}4\times10^{-2}$ A·m². A $30$ cm no eixo, a fórmula aproximada dá $1{,}05\times10^{-7}$ T e a exata $1{,}03\times10^{-7}$ T: a diferença é só de $2\%$. Duplicar a distância reduz o campo a um oitavo.

Duas bobinas coaxiais separadas por uma distância igual ao raio (**bobinas de Helmholtz**) produzem entre si um campo bastante uniforme, usado para medir $e/m$ (seção 28-4).

Armadilha: aplicar a dependência $1/z^3$ perto da espira. Para $z \lesssim R$, use a fórmula completa.

No experimento, use uma única espira, mova a sonda ao longo do eixo e compare com a fórmula; depois compare o padrão de linhas com o de um ímã em barra.`,
      experiments: [
        { kind: "sim", id: "biot-savart", scenario: "solenoide", params: { N: 1, R: 3, I: 5 }, note: "Com uma espira, meça B ao longo do eixo e compare com μ₀iR²/[2(R² + z²)^(3/2)]." },
        { kind: "sim", id: "imas-bussola", scenario: "um-ima", note: "Compare o padrão do campo de um ímã em barra com o de uma espira." },
        { kind: "pratica", id: "exp3-bobina", note: "Meça o campo no eixo de uma bobina e de um par de Helmholtz." },
      ],
    },
  },
};
