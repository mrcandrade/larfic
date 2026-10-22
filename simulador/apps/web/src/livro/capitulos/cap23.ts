import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 23,
  intro: String.raw`Calcular campos por integração, como no capítulo 22, funciona sempre, mas pode ser trabalhoso. A **lei de Gauss** oferece outro caminho: relaciona o campo na superfície de uma região fechada com a carga que está dentro dela. Quando a distribuição tem simetria (cilíndrica, plana ou esférica), essa lei dá o campo em poucas linhas. Ela também explica por que o excesso de carga de um condutor fica na superfície e por que o campo dentro de um metal em equilíbrio é nulo.`,
  sections: {
    "23-1": {
      text: String.raw`O **fluxo elétrico** mede "quanto campo atravessa" uma superfície. Para um pequeno elemento de área, representado por um vetor $d\vec A$ perpendicular a ele e de módulo igual à sua área, o fluxo é $\vec E\cdot d\vec A$. Somando sobre toda a superfície:

$$\Phi = \int \vec E\cdot d\vec A, \qquad \text{e para superfície fechada}\qquad \Phi = \oint \vec E\cdot d\vec A.$$

A unidade é N·m²/C. Numa superfície fechada, por convenção, $d\vec A$ aponta **para fora**: o campo saindo dá fluxo positivo e o campo entrando dá fluxo negativo. Só a componente do campo perpendicular à superfície contribui; um campo rasante (paralelo à superfície) não atravessa nada e dá fluxo zero.

Exemplo: um campo uniforme de $300$ N/C atravessa uma placa plana de $0{,}20$ m² cuja normal faz $60°$ com o campo. O fluxo é $\Phi = EA\cos60° = 300\cdot0{,}20\cdot0{,}5 = 30$ N·m²/C. Se a placa girar até ficar paralela ao campo, o fluxo cai a zero.

Um resultado importante: o fluxo de um campo **uniforme** através de qualquer superfície **fechada** é zero, porque tudo o que entra por um lado sai pelo outro. Pense num cubo num campo horizontal: a face da esquerda recebe $-EA$, a da direita $+EA$, e as outras quatro têm o campo rasante.

Armadilha: confundir o fluxo com o próprio campo. O fluxo depende também da área e da orientação; uma superfície grande num campo fraco pode ter mais fluxo que uma pequena num campo forte. A analogia com a vazão de água ajuda: o fluxo é o "volume de linhas" que cruza a superfície.

No experimento, observe as setas sobre cada elemento da superfície gaussiana (vermelhas saindo, azuis entrando) e veja o fluxo total, somado elemento por elemento, enquanto você arrasta e redimensiona a superfície.`,
      experiments: [
        { kind: "sim", id: "gauss", scenario: "pontuais", note: "Veja o fluxo somado elemento por elemento numa superfície fechada em torno de cargas." },
        { kind: "sim", id: "gauss", scenario: "pontuais", params: { q1: 0, q2: 0, q3: 5 }, note: "Deixe a carga fora da superfície e confira que entra tanto fluxo quanto sai." },
      ],
    },
    "23-2": {
      text: String.raw`A **lei de Gauss** afirma que o fluxo elétrico através de qualquer superfície fechada é proporcional à carga **envolvida** por ela:

$$\varepsilon_0\oint \vec E\cdot d\vec A = q_{\text{env}}.$$

A superfície fechada, chamada **superfície gaussiana**, é imaginária; você a escolhe como quiser. Cargas do lado de fora podem mudar o campo em cada ponto da superfície, mas o fluxo **total** que produzem é zero (tudo o que entra sai). Por isso só a carga interna aparece. A forma e o tamanho da superfície não importam: uma carga de $+5{,}0$ nC dentro de uma esfera, de um cubo ou de uma batata produz sempre $\Phi = 5{,}0\times10^{-9}/8{,}85\times10^{-12} \approx 565$ N·m²/C. Se ao lado houver uma carga de $-2{,}0$ nC também dentro, o fluxo cai para cerca de $339$ N·m²/C.

### Lei de Gauss e Lei de Coulomb
As duas leis dizem a mesma coisa em linguagens diferentes. Tome uma carga pontual $q$ e uma esfera gaussiana de raio $r$ centrada nela. Por simetria, o campo tem o mesmo módulo em toda a esfera e é radial, paralelo a $d\vec A$. Então o fluxo é simplesmente $E\cdot4\pi r^2$, e a lei de Gauss dá

$$\varepsilon_0\,E\,4\pi r^2 = q \quad\Rightarrow\quad E = \frac{1}{4\pi\varepsilon_0}\frac{q}{r^2},$$

que é a lei de Coulomb. O $1/r^2$ é justamente o que faz o fluxo ser o mesmo para qualquer esfera: a área cresce com $r^2$ e o campo cai com $r^2$.

Armadilha: a lei de Gauss vale sempre, mas só serve para **calcular** $E$ quando a simetria permite tirar $E$ de dentro da integral. E fluxo nulo não significa campo nulo na superfície: significa apenas que a carga interna é zero.

No experimento, mova uma carga dentro da superfície até perto da borda e veja que as setas mudam, mas a soma não; depois leve outra carga para dentro e acompanhe o salto do fluxo.`,
      experiments: [
        { kind: "sim", id: "gauss", scenario: "pontuais", note: "Mova as cargas por dentro e por fora da superfície e compare Φ com q_env/ε₀." },
        { kind: "sim", id: "campo-eletrico", scenario: "carga", note: "Confira com a sonda que E·4πr² não depende do raio, como a lei de Gauss exige." },
      ],
    },
    "23-3": {
      text: String.raw`Num condutor em **equilíbrio eletrostático**, os elétrons livres já pararam de se mover. Isso só é possível se o campo elétrico no **interior** do material for zero; se não fosse, ele empurraria os elétrons e haveria corrente. A lei de Gauss tira daí uma consequência forte: tome uma superfície gaussiana logo abaixo da superfície do condutor. Como $E = 0$ em todos os seus pontos, o fluxo é zero e a carga envolvida também. Logo, **todo o excesso de carga de um condutor isolado fica na superfície externa**.

Se o condutor tem uma **cavidade** vazia, a carga também não fica na parede da cavidade, e o campo lá dentro é nulo: é a **blindagem eletrostática**, ou gaiola de Faraday. Um carro atingido por um raio protege quem está dentro por esse motivo, e cabos coaxiais usam uma malha metálica para isolar o sinal de campos externos. Se houver uma carga $q$ dentro da cavidade, aparece $-q$ induzida na parede interna e $+q$ a mais na superfície externa.

Logo do lado de fora, o campo é **perpendicular** à superfície (uma componente tangencial moveria as cargas) e vale

$$E = \frac{\sigma}{\varepsilon_0},$$

o que se obtém com um pequeno cilindro gaussiano atravessando a superfície: só a tampa externa tem fluxo, $EA = \sigma A/\varepsilon_0$. Exemplo: uma esfera metálica com $\sigma = 2{,}0\ \mu\mathrm{C/m^2}$ tem, rente à superfície, $E = 2{,}0\times10^{-6}/8{,}85\times10^{-12} \approx 2{,}3\times10^5$ N/C, abaixo dos cerca de $3\times10^6$ N/C que rompem o ar seco.

Armadilha: achar que o campo externo "atravessa" o metal. Ele induz cargas na superfície, e o campo dessas cargas cancela exatamente o externo no interior. Em um condutor de forma irregular a densidade $\sigma$ não é uniforme; ela se concentra nas pontas (seção 24-8).

No experimento, aplique um campo externo à gaiola de Faraday e meça com a sonda o campo dentro e fora; depois desenhe um condutor com ponta e veja onde a carga se acumula.`,
      experiments: [
        { kind: "sim", id: "condutores-blindagem", scenario: "gaiola", note: "Meça o campo dentro e fora da gaiola de Faraday num campo externo." },
        { kind: "concepcao", id: "metal-nao-blinda", note: "Confronte a ideia de que o campo atravessa uma casca metálica." },
        { kind: "sim", id: "condutores-blindagem", scenario: "placas", note: "Coloque um condutor neutro entre placas e veja as cargas induzidas anularem o campo dentro dele." },
      ],
    },
    "23-4": {
      text: String.raw`Considere um fio retilíneo muito longo (ou um cilindro carregado) com densidade linear de carga uniforme $\lambda$. A simetria impõe que o campo seja **radial**, perpendicular ao fio, e tenha o mesmo módulo em todos os pontos à mesma distância $r$. A superfície gaussiana que aproveita isso é um **cilindro coaxial** de raio $r$ e comprimento $h$.

Nas tampas, o campo é paralelo a elas e o fluxo é zero. Na superfície lateral, $\vec E$ é paralelo a $d\vec A$ e tem módulo constante, então o fluxo é $E\cdot2\pi r h$. A carga envolvida é $\lambda h$. A lei de Gauss dá

$$\varepsilon_0\,E\,(2\pi r h) = \lambda h \quad\Rightarrow\quad E = \frac{\lambda}{2\pi\varepsilon_0\,r}.$$

O comprimento $h$ se cancela, como devia, e o campo cai com $1/r$, mais devagar que o de uma carga pontual. É o mesmo resultado da integração da seção 22-4, obtido sem integral nenhuma.

Exemplo: um fio com $\lambda = 5{,}0$ nC/m produz, a $r = 0{,}10$ m, $E = 5{,}0\times10^{-9}/(2\pi\cdot8{,}85\times10^{-12}\cdot0{,}10) \approx 900$ N/C. A $0{,}30$ m o campo cai para $300$ N/C.

O resultado vale também fora de um cilindro carregado de qualquer raio, desde que a carga tenha simetria cilíndrica. Dentro de um cilindro **condutor**, o campo é nulo; dentro de um cilindro **isolante** com carga uniforme no volume, só a carga interna a $r$ conta e o campo cresce proporcional a $r$.

Armadilha: usar uma caixa ou uma esfera como superfície gaussiana em volta do fio. A lei de Gauss continua verdadeira, mas o campo deixa de ser constante e perpendicular sobre a superfície, e a integral não se simplifica.

No experimento, arraste a alça do cilindro gaussiano e confira que o fluxo não muda com o raio; depois troque o círculo pela caixa e veja as setas ficarem desiguais com o mesmo fluxo total.`,
      experiments: [
        { kind: "sim", id: "gauss", scenario: "fio", note: "Use um cilindro coaxial ao fio e deduza E = λ/(2πε₀r) a partir do fluxo." },
        { kind: "sim", id: "potencial", scenario: "coaxial", note: "Veja o campo de um cabo coaxial ficar mais intenso perto do condutor interno." },
      ],
    },
    "23-5": {
      text: String.raw`Para uma **placa isolante** muito grande (um plano infinito) com densidade superficial uniforme $\sigma$, a simetria diz que o campo é perpendicular ao plano, aponta para fora dos dois lados (se $\sigma > 0$) e tem o mesmo módulo a qualquer distância. Use como superfície gaussiana um cilindro (ou uma caixa) que **atravessa** o plano, com tampas de área $A$ paralelas a ele. A lateral não tem fluxo; cada tampa tem fluxo $EA$; a carga envolvida é $\sigma A$:

$$\varepsilon_0(2EA) = \sigma A \quad\Rightarrow\quad E = \frac{\sigma}{2\varepsilon_0}.$$

É o limite do disco da seção 22-5 quando o raio cresce sem fim. Para uma **placa condutora** carregada, a carga fica nas faces e o campo dentro é nulo; do lado de fora vale $\sigma/\varepsilon_0$, com $\sigma$ a densidade **daquela face** (seção 23-3).

Duas placas paralelas com cargas opostas $\pm\sigma$ são o caso mais útil. Por superposição, entre elas os campos das duas placas se somam e fora se cancelam:

$$E_{\text{entre}} = \frac{\sigma}{\varepsilon_0}, \qquad E_{\text{fora}} = 0.$$

Esse é o campo uniforme do capacitor de placas paralelas (capítulo 25). Exemplo: com $\sigma = 4{,}0$ nC/m², um plano isolado produz $E = 4{,}0\times10^{-9}/(2\cdot8{,}85\times10^{-12}) \approx 226$ N/C dos dois lados; duas placas com $\pm4{,}0$ nC/m² produzem cerca de $452$ N/C entre elas e nada fora.

Armadilha: estranhar que o campo não diminua com a distância. Isso é uma idealização: perto de uma placa finita, comparado com o tamanho dela, o campo é quase constante; longe, a placa volta a parecer uma carga pontual.

No experimento, posicione a caixa atravessando o plano e confira $2EA = \sigma A/\varepsilon_0$; depois afaste a caixa do plano e veja o fluxo total se anular.`,
      experiments: [
        { kind: "sim", id: "gauss", scenario: "plano", note: "Atravesse o plano com uma caixa gaussiana e deduza E = σ/2ε₀." },
        { kind: "sim", id: "capacitores", scenario: "borda", note: "Veja o campo uniforme entre duas placas e o campo de borda nas extremidades." },
      ],
    },
    "23-6": {
      text: String.raw`Distribuições com **simetria esférica** completam o quadro. A superfície gaussiana é uma esfera concêntrica de raio $r$, sobre a qual o campo é radial e de módulo constante, de modo que o fluxo vale $E\cdot4\pi r^2$.

**Casca esférica** de raio $R$ e carga $q$. Fora ($r > R$), a esfera gaussiana envolve toda a carga e $E = q/(4\pi\varepsilon_0 r^2)$: a casca age como se a carga estivesse no centro. Dentro ($r < R$), a carga envolvida é zero, e $E = 0$. Esses são os dois **teoremas das cascas**, que Newton provou com muito esforço para a gravitação e que aqui saem em uma linha.

**Esfera isolante uniformemente carregada** com carga $Q$ e raio $R$. Fora, o campo é o de carga pontual. Dentro, só a carga a menos de $r$ conta: $q_{\text{env}} = Q\,r^3/R^3$, e

$$E = \frac{Q}{4\pi\varepsilon_0 R^3}\,r \qquad (r \le R),$$

que cresce linearmente a partir de zero no centro, atinge o máximo na superfície e depois cai como $1/r^2$.

Exemplo: uma esfera de raio $0{,}35$ m com $Q = 5{,}0$ nC. Na superfície, $E = 8{,}99\times10^9\cdot5{,}0\times10^{-9}/0{,}1225 \approx 367$ N/C. No meio do raio ($r = 0{,}175$ m), o campo é metade disso, cerca de $183$ N/C; a $0{,}70$ m do centro, fora, é um quarto do valor na superfície, cerca de $92$ N/C.

Armadilha: aplicar o resultado "dentro é zero" a uma esfera **maciça** isolante. Só a casca (ou um condutor) tem campo nulo dentro; a esfera maciça tem carga distribuída no interior.

No experimento, comece com a superfície gaussiana dentro da esfera e arraste a alça devagar para fora: o gráfico do fluxo cresce como $r^3$ e depois fica constante em $Q/\varepsilon_0$.`,
      experiments: [
        { kind: "sim", id: "gauss", scenario: "esfera", note: "Aumente a superfície gaussiana de dentro para fora da esfera e acompanhe Φ(r)." },
        { kind: "sim", id: "maquinas-eletrostaticas", scenario: "van-de-graaff", note: "Veja a cúpula esférica do Van de Graaff acumular carga na superfície até o ar romper." },
      ],
    },
  },
};
