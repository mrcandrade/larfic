import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 24,
  intro: String.raw`A força elétrica, como a gravitacional, é **conservativa**: o trabalho que ela realiza não depende do caminho. Isso permite associar a ela uma energia potencial e, dividindo pela carga, uma grandeza escalar definida em cada ponto do espaço, o **potencial elétrico** $V$. Trabalhar com $V$ costuma ser mais simples que com $\vec E$ (soma-se números, não vetores), e é o potencial, medido em volts, que pilhas, tomadas e voltímetros nos mostram. Neste capítulo calculamos $V$ para cargas, dipolos e distribuições contínuas, passamos de $V$ para $\vec E$ e vice-versa e terminamos com o potencial de um condutor.`,
  sections: {
    "24-1": {
      text: String.raw`### Potencial Elétrico e Energia Potencial Elétrica
Quando uma carga $q$ se desloca num campo elétrico, a força elétrica realiza um trabalho $W$, e a **energia potencial elétrica** muda de $\Delta U = -W$. Como $U$ é proporcional a $q$, dividimos por ela e obtemos uma propriedade só do campo, o **potencial elétrico**:

$$V = \frac{U}{q}, \qquad \Delta V = V_f - V_i = \frac{\Delta U}{q} = -\frac{W}{q}.$$

A unidade é o **volt** (V = J/C). Só diferenças de potencial têm significado físico; o zero é escolhido por conveniência (em geral no infinito, ou na Terra num circuito). Daí sai também uma unidade de energia muito usada em física atômica: o **elétron-volt**, $1\ \mathrm{eV} = 1{,}602\times10^{-19}$ J, a energia ganha por uma carga $e$ ao atravessar 1 V.

Se um agente externo leva a carga devagar (sem mudar a energia cinética), o trabalho dele é o oposto do trabalho do campo: $W_{\text{ext}} = q\,\Delta V$. Se a carga se move livremente, a energia mecânica se conserva: $\Delta K = -q\,\Delta V$.

Exemplo: um próton parte do repouso e atravessa uma diferença de potencial de $-2000$ V (vai do potencial mais alto para o mais baixo). Ele ganha $\Delta K = -e(-2000) = 2000$ eV $\approx 3{,}2\times10^{-16}$ J e atinge $v = \sqrt{2K/m} \approx 6{,}2\times10^5$ m/s. Um elétron, com carga negativa, ganharia energia indo no sentido contrário, do potencial baixo para o alto.

Armadilha: confundir **potencial** (J/C, propriedade do ponto) com **energia potencial** (J, propriedade da carga naquele ponto). Uma carga negativa num ponto de potencial alto tem energia potencial **baixa**. Cargas positivas "descem" o potencial espontaneamente; as negativas "sobem".

No experimento, arraste a carga de teste de uma placa à outra e acompanhe sua energia potencial; depois troque o sinal da carga de teste e veja o gráfico inverter a inclinação.`,
      experiments: [
        { kind: "sim", id: "potencial", scenario: "placas", note: "Arraste a carga de teste entre as placas e acompanhe U = qV ao longo do caminho." },
        { kind: "sim", id: "potencial", scenario: "placas", params: { q: -2 }, note: "Repita com carga de teste negativa e compare o sentido em que U diminui." },
      ],
    },
    "24-2": {
      text: String.raw`### Superfícies Equipotenciais
Uma **superfície equipotencial** reúne os pontos com o mesmo potencial. Mover uma carga ao longo dela não custa trabalho, porque $\Delta V = 0$. Isso só é possível se o campo for **perpendicular** às equipotenciais em todos os pontos: uma componente de $\vec E$ ao longo da superfície faria trabalho. Para uma carga pontual as equipotenciais são esferas concêntricas; num campo uniforme, planos perpendiculares às linhas de campo. Desenhadas com o mesmo passo de potencial (por exemplo, de 1 em 1 V), elas ficam mais juntas onde o campo é mais intenso.

### Cálculo do Potencial a Partir do Campo Elétrico
O trabalho da força elétrica num deslocamento $d\vec s$ é $q\vec E\cdot d\vec s$. Somando ao longo de qualquer caminho de $i$ até $f$:

$$V_f - V_i = -\int_i^f \vec E\cdot d\vec s.$$

O sinal negativo diz que o potencial **diminui no sentido do campo**. Num campo uniforme, andando uma distância $d$ ao longo dele, a integral fica simplesmente

$$\Delta V = -E\,d.$$

Exemplo: entre duas placas separadas por $0{,}80$ m, com $+10$ V numa e $-10$ V na outra, o campo é $E = 20/0{,}80 = 25$ V/m. Um ponto a $0{,}20$ m da placa positiva está a $10 - 25\cdot0{,}20 = 5$ V. Andar paralelo às placas não muda o potencial.

Armadilha: achar que onde $V = 0$ o campo é nulo (ou vice-versa). O campo depende de como $V$ **varia**, não do seu valor. No ponto médio de um dipolo $V = 0$ e o campo é intenso; no centro de um anel carregado $E = 0$ e $V$ é máximo.

No experimento, coloque as duas pontas do voltímetro sobre a mesma equipotencial e leia zero; depois alinhe-as ao longo do campo e confira $E = \Delta V/d$. Na prática de bancada, mapeie equipotenciais numa cuba eletrolítica.`,
      experiments: [
        { kind: "sim", id: "potencial", scenario: "placas", note: "Meça ΔV com o voltímetro de duas pontas e obtenha E = ΔV/d entre as placas." },
        { kind: "pratica", id: "exp3-equipotenciais", note: "Mapeie equipotenciais numa cuba eletrolítica e desenhe as linhas de campo." },
        { kind: "sim", id: "potencial", scenario: "desenhar", note: "Pinte seus próprios eletrodos e veja as equipotenciais se ajustarem à forma deles." },
      ],
    },
    "24-3": {
      text: String.raw`Para uma partícula de carga $q$, integramos o campo radial $kq/r^2$ desde o infinito (onde tomamos $V = 0$) até uma distância $r$:

$$V = \frac{1}{4\pi\varepsilon_0}\,\frac{q}{r}.$$

O potencial tem o **sinal da carga**: positivo em torno de cargas positivas, negativo em torno de negativas. E cai com $1/r$, mais devagar que o campo ($1/r^2$). Uma carga de $+5{,}0$ nC produz, a $0{,}50$ m, $V = 8{,}99\times10^9\cdot5{,}0\times10^{-9}/0{,}50 \approx 90$ V; a $1{,}0$ m, $45$ V. Note que o resultado para $r$ fora de uma esfera ou casca com carga $q$ é o mesmo (teorema das cascas, seção 23-6).

### Potencial Produzido por um Grupo de Partículas Carregadas
Como o potencial é escalar, a superposição é uma **soma algébrica**, sem componentes nem ângulos:

$$V = \sum_i \frac{1}{4\pi\varepsilon_0}\,\frac{q_i}{r_i}.$$

Só importam as distâncias e os sinais. Exemplo: nos quatro vértices de um quadrado de lado $0{,}20$ m há cargas de $+2$, $+2$, $-1$ e $-1$ nC. Todas estão a $0{,}141$ m do centro, e o potencial ali é $8{,}99\times10^9(2+2-1-1)\times10^{-9}/0{,}141 \approx 127$ V. Calcular o campo no mesmo ponto exigiria somar quatro vetores.

Armadilha: aplicar a regra do vetor e "cancelar" potenciais de cargas iguais em lados opostos. Os campos de duas cargas positivas iguais se cancelam no ponto médio, mas os potenciais **se somam**: $V = 2kq/r$, e não zero.

No experimento, mostre linhas e equipotenciais, leve a sonda a distâncias diferentes da carga e confira o $1/r$; depois use as duas cargas iguais e compare o campo nulo com o potencial no ponto médio.`,
      experiments: [
        { kind: "sim", id: "campo-eletrico", scenario: "carga", params: { vis: 3 }, note: "Veja as equipotenciais esféricas de uma carga e meça V a várias distâncias." },
        { kind: "sim", id: "campo-eletrico", scenario: "iguais", params: { vis: 3 }, note: "No ponto médio entre cargas iguais, compare o campo nulo com o potencial, que não se anula." },
      ],
    },
    "24-4": {
      text: String.raw`O potencial do dipolo é a soma dos potenciais de $+q$ e $-q$. Num ponto a uma distância $r$ do centro, numa direção que faz ângulo $\theta$ com o eixo do dipolo, as distâncias às duas cargas diferem de aproximadamente $d\cos\theta$. Para $r \gg d$:

$$V = \frac{1}{4\pi\varepsilon_0}\,\frac{p\cos\theta}{r^2},$$

com $p = qd$ o momento dipolar (seção 22-3). Três observações: o potencial cai com $1/r^2$, uma potência a mais que o de uma carga; ele é positivo do lado da carga positiva ($\theta < 90°$), negativo do outro lado; e é **zero em todo o plano mediador** ($\theta = 90°$), onde as duas cargas estão à mesma distância. Esse plano é uma equipotencial, embora o campo ali não seja nulo.

Exemplo: um dipolo com $p = 2{,}0\times10^{-10}$ C·m. A $r = 0{,}30$ m, sobre o eixo ($\theta = 0$), $V = 8{,}99\times10^9\cdot2{,}0\times10^{-10}/0{,}09 \approx 20$ V. A $60°$ do eixo, à mesma distância, $V$ cai para $10$ V; a $90°$, zero.

**Dipolos induzidos.** Átomos e moléculas sem dipolo próprio adquirem um quando colocados num campo: a nuvem eletrônica se desloca para um lado e o núcleo para o outro. O momento induzido aponta no sentido do campo e é responsável pela atração de objetos neutros (papel picado, o balão na parede) e pelo comportamento dos dielétricos (seção 25-5).

Armadilha: usar a fórmula aproximada perto das cargas; para $r$ comparável a $d$ é preciso somar $kq/r_+ - kq/r_-$ exatamente.

No experimento, escolha linhas e equipotenciais e repare que as equipotenciais cruzam as linhas em ângulo reto e que a mediatriz é a equipotencial de zero volt.`,
      experiments: [
        { kind: "sim", id: "campo-eletrico", scenario: "dipolo", note: "Observe as equipotenciais do dipolo e confira V = 0 na mediatriz com a sonda." },
        { kind: "sim", id: "maquinas-eletrostaticas", scenario: "balao", note: "Veja dipolos induzidos na parede neutra segurarem o balão carregado." },
      ],
    },
    "24-5": {
      text: String.raw`Para uma distribuição contínua, dividimos a carga em elementos $dq$, tratamos cada um como partícula e integramos:

$$V = \frac{1}{4\pi\varepsilon_0}\int\frac{dq}{r}.$$

É mais fácil que o cálculo do campo da seção 22-4, porque não há componentes a projetar.

**Linha de carga.** Uma barra de comprimento $L$ com densidade uniforme $\lambda$, num ponto P sobre a perpendicular que passa por uma extremidade, a uma distância $d$. Cada elemento $dx$ está a $\sqrt{x^2+d^2}$ de P, e a integral dá

$$V = \frac{\lambda}{4\pi\varepsilon_0}\,\ln\!\left(\frac{L+\sqrt{L^2+d^2}}{d}\right).$$

**Disco carregado.** No eixo de um disco de raio $R$ e densidade $\sigma$, somando anéis de raio $r'$ (todos os pontos de um anel estão à mesma distância de P):

$$V = \frac{\sigma}{2\varepsilon_0}\left(\sqrt{z^2+R^2} - z\right).$$

Longe ($z \gg R$), vira $kQ/z$, como devia.

Exemplo: uma barra de $1{,}0$ m com $\lambda = 2{,}0$ nC/m, com P a $d = 0{,}50$ m de uma ponta: $V = 8{,}99\times10^9\cdot2{,}0\times10^{-9}\,\ln[(1+1{,}118)/0{,}5] \approx 18\cdot1{,}444 \approx 26$ V.

Para geometrias com simetria, também se pode integrar o campo já conhecido (seção 24-2). No cabo coaxial, por exemplo, o campo $\lambda/(2\pi\varepsilon_0 r)$ integrado entre os raios dá uma variação logarítmica do potencial.

Armadilha: esquecer que $r$ na integral é a distância do **elemento** ao ponto P, e não uma coordenada fixa; ela varia ao longo da distribuição.

No experimento, divida um anel, um disco ou um fio carregado em elementos e veja a soma dos $dV = k\,dq/r$ convergir para o valor exato da integral; no cabo coaxial, veja o potencial entre o condutor interno e a malha cair de forma logarítmica e meça $V$ em dois raios.`,
      experiments: [
        { kind: "sim", id: "coulomb", scenario: "potencial-continuo", note: "Aumente o número de elementos e compare a soma dos potenciais com a integral exata." },
        { kind: "sim", id: "potencial", scenario: "coaxial", note: "Meça V a duas distâncias do centro do cabo coaxial e confira a variação logarítmica." },
        { kind: "sim", id: "coulomb", scenario: "anel", note: "Some as contribuições dos elementos de um anel carregado, como na integral do potencial." },
      ],
    },
    "24-6": {
      text: String.raw`Se conhecemos $V$ em todos os pontos, podemos voltar ao campo. Para um deslocamento $ds$ numa direção qualquer, $dV = -E_s\,ds$, onde $E_s$ é a componente do campo nessa direção. Logo

$$E_s = -\frac{\partial V}{\partial s}, \qquad E_x = -\frac{\partial V}{\partial x},\quad E_y = -\frac{\partial V}{\partial y},\quad E_z = -\frac{\partial V}{\partial z}.$$

Em palavras: o campo aponta no sentido em que o potencial **diminui mais depressa**, e seu módulo é a taxa dessa diminuição. É a versão elétrica de "a água desce pela linha de maior declive". Nos mapas de equipotenciais, isso significa que o campo é perpendicular às curvas e mais intenso onde elas se apertam.

Exemplo: numa região, $V(x,y) = 3{,}0x^2 - 2{,}0y$ (em volts, com $x$ e $y$ em metros). No ponto $(1{,}0;\ 2{,}0)$ m: $E_x = -6{,}0x = -6{,}0$ V/m e $E_y = +2{,}0$ V/m, de modo que $E \approx 6{,}3$ V/m. Para o anel da seção 22-4, derivar $V = kQ/\sqrt{z^2+R^2}$ em relação a $z$ reproduz exatamente o campo axial obtido por integração.

No campo uniforme entre placas, $V$ varia linearmente e o campo é constante, $E = \Delta V/d$; num cabo coaxial, as equipotenciais se apertam perto do condutor interno, onde o campo é maior.

Armadilha: derivar um valor numérico de $V$ num ponto. Para obter o campo é preciso saber como $V$ varia na vizinhança; um único valor não basta. Outra: esquecer o sinal negativo e obter um campo apontando "morro acima".

No experimento, mostre o mapa de cores de $V$ e as setas de $\vec E$ juntos; confira que as setas descem o mapa perpendicularmente às equipotenciais e são maiores onde elas estão mais próximas.`,
      experiments: [
        { kind: "sim", id: "potencial", scenario: "coaxial", params: { vis: 0 }, note: "Compare o espaçamento das equipotenciais com o tamanho dos vetores E." },
        { kind: "sim", id: "potencial", scenario: "placas", params: { vis: 1 }, note: "Veja o mapa de cores de V e confirme que E aponta para onde V diminui." },
      ],
    },
    "24-7": {
      text: String.raw`A energia potencial de um **sistema** de cargas é o trabalho que um agente externo precisa fazer para montá-lo, trazendo cada carga do infinito, em repouso, até sua posição. Para duas cargas a uma distância $r$:

$$U = \frac{1}{4\pi\varepsilon_0}\,\frac{q_1 q_2}{r}.$$

O sinal tem significado físico. Se $U > 0$ (cargas de mesmo sinal), foi preciso empurrar contra a repulsão, e o sistema "quer" se desfazer: soltas, as cargas se afastam e ganham energia cinética. Se $U < 0$ (sinais opostos), o sistema é ligado: para separar as cargas é preciso fornecer energia, como no átomo de hidrogênio.

Para três ou mais cargas, somamos a energia de **cada par** uma única vez:

$$U = \frac{1}{4\pi\varepsilon_0}\left(\frac{q_1q_2}{r_{12}} + \frac{q_1q_3}{r_{13}} + \frac{q_2q_3}{r_{23}}\right).$$

Exemplo: três cargas de $+3{,}0$ nC nos vértices de um triângulo equilátero de lado $0{,}10$ m. Cada par contribui $8{,}99\times10^9\cdot(3{,}0\times10^{-9})^2/0{,}10 \approx 8{,}1\times10^{-7}$ J, e $U = 2{,}4\times10^{-6}$ J. Se uma das cargas for trocada por $-3{,}0$ nC, dois pares ficam negativos e $U = -8{,}1\times10^{-7}$ J: o sistema passa a ser ligado.

Ao liberar uma das cargas, a energia potencial do sistema se converte em cinética. Duas cargas de $+3{,}0$ nC, de $1{,}0$ mg cada, soltas a $0{,}10$ m uma da outra, chegam a uma separação muito grande com energia cinética total de $8{,}1\times10^{-7}$ J, ou seja, cerca de $0{,}9$ m/s cada.

Armadilha: contar cada par duas vezes (somar "a energia de $q_1$ por causa de $q_2$" e também "a de $q_2$ por causa de $q_1$"). Outra: atribuir a energia a uma carga só, quando ela pertence ao par.

No experimento, monte três cargas e veja a energia de cada par, $kq_iq_j/r_{ij}$, somar-se na energia do sistema; arraste uma carga e acompanhe o sinal de $U$; com a carga de teste entre as placas, veja como sua energia potencial muda quando ela é deslocada.`,
      experiments: [
        { kind: "sim", id: "coulomb", scenario: "energia-sistema", note: "Some as energias dos três pares e veja U mudar ao arrastar as cargas." },
        { kind: "sim", id: "coulomb", scenario: "superposicao", note: "Monte três cargas, identifique os três pares e estime a energia de cada um a partir das distâncias." },
        { kind: "sim", id: "potencial", scenario: "placas", note: "Desloque a carga de teste e veja o trabalho do campo virar variação de energia potencial." },
        { kind: "sim", id: "jogos-fisica", scenario: "hoquei", note: "Use a repulsão entre cargas para dar energia cinética ao disco." },
      ],
    },
    "24-8": {
      text: String.raw`Na seção 23-3 vimos que o campo dentro de um condutor em equilíbrio é nulo. Como $\Delta V = -\int\vec E\cdot d\vec s$, o potencial não varia de um ponto a outro do condutor: **todo o condutor, por dentro e na superfície, é uma equipotencial**. Isso vale para qualquer forma, maciça ou oca.

Para uma esfera condutora de raio $R$ e carga $q$, fora dela o potencial é o de uma carga pontual, $kq/r$, e dentro ele fica constante no valor da superfície, $kq/R$. Exemplo: uma cúpula de $0{,}20$ m de raio com $q = 2{,}0\ \mu\mathrm{C}$ está a $V = 8{,}99\times10^9\cdot2{,}0\times10^{-6}/0{,}20 \approx 9{,}0\times10^4$ V, com campo de $4{,}5\times10^5$ V/m na superfície.

**Poder das pontas.** Ligue por um fio duas esferas de raios $R_1 > R_2$, longe uma da outra. Elas ficam no mesmo potencial: $q_1/R_1 = q_2/R_2$. Como $\sigma = q/(4\pi R^2)$, resulta $\sigma_1R_1 = \sigma_2R_2$: a esfera **menor** tem densidade de carga maior e, portanto, campo superficial maior ($\sigma/\varepsilon_0$). Num condutor irregular, as regiões de curvatura acentuada (pontas, quinas) se comportam como esferas pequenas e concentram carga e campo. Quando o campo passa de cerca de $3\times10^6$ V/m, o ar se ioniza e surge uma descarga: é o princípio do para-raios e o motivo de as cúpulas de geradores eletrostáticos serem lisas e grandes.

Um condutor oco também blinda seu interior de campos externos (gaiola de Faraday), e o campo externo, ao chegar ao condutor, se ajusta para ficar perpendicular à superfície.

Armadilha: achar que potencial igual significa carga igual ou densidade uniforme. O condutor é equipotencial, mas a densidade de carga na superfície varia com a curvatura.

No experimento, observe as equipotenciais se apertarem junto à ponta do condutor e meça o campo ali e na parte lisa; depois veja a descarga começar nas pontas do para-raios.`,
      experiments: [
        { kind: "sim", id: "condutores-blindagem", scenario: "pontas", note: "Veja a carga e o campo se concentrarem na ponta de um condutor equipotencial." },
        { kind: "sim", id: "potencial", scenario: "ponta", note: "Compare o campo junto à ponta do eletrodo com o campo sobre a parte lisa do plano." },
        { kind: "sim", id: "maquinas-eletrostaticas", scenario: "pontas", note: "Observe a descarga começar nas pontas quando o campo rompe o ar." },
      ],
    },
  },
};
