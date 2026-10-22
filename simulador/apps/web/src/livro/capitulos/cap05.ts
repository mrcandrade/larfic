import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 5,
  intro: String.raw`Até aqui descrevemos movimentos sem perguntar o que os produz. Agora entra a **dinâmica**: por que um corpo acelera? A resposta de Newton, publicada em 1687, cabe em três leis que relacionam a aceleração de um corpo com as **forças** que outros corpos exercem sobre ele e com a sua **massa**. Este capítulo apresenta as três leis, as forças que aparecem em quase todo problema (peso, normal, tração e atrito, este detalhado no capítulo 6) e um método sistemático, o **diagrama de corpo livre**, para aplicá-las a blocos, cordas, polias, rampas e elevadores.`,
  sections: {
    "5-2": {
      text: String.raw`A **mecânica newtoniana** é o conjunto de leis que relaciona forças e movimentos. Ela explica com precisão desde a queda de uma maçã até as órbitas dos planetas e o lançamento de satélites, e é a base de toda a engenharia mecânica e civil.

### A ideia central
Um corpo muda de velocidade (acelera) porque **interage** com outros corpos. Essas interações são descritas por **forças**. A pergunta "por que este corpo se move?" é a pergunta errada; a certa é "por que a velocidade dele **muda**?".

### Limites de validade
A mecânica de Newton é uma aproximação excelente, mas tem limites:
- para velocidades comparáveis à da luz ($c \approx 3\times10^8$ m/s), é substituída pela **relatividade especial** (capítulo 37);
- para objetos de escala atômica, pela **mecânica quântica** (capítulos 38 a 41).

Para um avião a 250 m/s, a correção relativística é da ordem de $(v/c)^2 \approx 10^{-12}$: totalmente desprezível. Para elétrons num tubo de raios X, já não é.

### Um modelo de trabalho
Na prática, aplicamos as leis a "partículas" (seção 2-2), escolhemos um referencial e listamos, para cada corpo, as forças exercidas pelos outros corpos. O resto deste capítulo e do seguinte desenvolve esse procedimento.

**Exemplo.** Uma caixa de 20 kg está parada sobre uma mesa. Há duas interações: a Terra a puxa para baixo (peso) e a mesa a empurra para cima (normal). As duas forças se equilibram, e a velocidade não muda. Se você empurrar a caixa com força maior que o atrito máximo, uma terceira interação passa a dominar e a velocidade passa a mudar.

**Armadilha:** a ideia, herdada de Aristóteles, de que é preciso uma força para manter um corpo em movimento. Força está associada à **mudança** de velocidade, não à velocidade.

No experimento, monte o diagrama de corpo livre da caixa puxada por uma corda sobre a mesa e veja o corpo se mover segundo as forças que você desenhou; depois confronte a concepção "força implica movimento".`,
      experiments: [
        { kind: "sim", id: "forcas-dcl", scenario: "mesa", note: "Desenhe as forças sobre a caixa na mesa e veja o movimento que elas produzem." },
        { kind: "concepcao", id: "forca-implica-movimento", note: "Teste a ideia de que é preciso força para manter o movimento." },
      ],
    },
    "5-3": {
      text: String.raw`### Enunciado
**Se nenhuma força resultante age sobre um corpo, a sua velocidade não pode mudar**: um corpo em repouso continua em repouso, e um corpo em movimento continua com a mesma velocidade (mesmo módulo e mesma direção).

Essa propriedade de "resistir a mudanças de velocidade" chama-se **inércia**. No dia a dia ela é mascarada pelo atrito: um disco de hóquei desliza muito no gelo e quase nada no asfalto. Num trilho de ar, onde o atrito é quase nulo, um carrinho empurrado segue com velocidade praticamente constante até o fim.

### Referenciais inerciais
A primeira lei não vale em qualquer referencial. Dentro de um ônibus que freia, uma bolinha no chão rola para a frente sem que nada a empurre. Chamamos de **referencial inercial** aquele em que a primeira lei vale. Qualquer referencial com velocidade constante em relação a um inercial também é inercial (seção 4-8); referenciais que aceleram ou giram não são.

O solo é aproximadamente inercial. A rotação da Terra produz efeitos pequenos (o pêndulo de Foucault, os desvios de Coriolis nos ventos), que em geral desprezamos em problemas de laboratório.

**Exemplo.** Uma sonda espacial longe de qualquer estrela desliga os motores a 15 km/s. Sem força resultante, ela continua a 15 km/s, na mesma direção, indefinidamente. Ela não "perde o impulso".

**Armadilha:** imaginar um "ímpeto" guardado no corpo que vai se esgotando e faz o movimento parar. O que faz o corpo parar é uma força (atrito, resistência do ar), não o fim de uma reserva interna.

No experimento, dê um empurrão no carrinho do trilho de ar sem peso pendurado e verifique, pelas duas fotoportas, que a velocidade se mantém; depois, no carrossel, veja um movimento retilíneo parecer curvo para quem gira junto.`,
      experiments: [
        { kind: "sim", id: "trilho-de-ar", scenario: "segunda-lei", params: { mp: 0, v0: 0.5, b: 0 }, note: "Sem peso pendurado e sem atrito, confira que as duas fotoportas medem a mesma velocidade." },
        { kind: "concepcao", id: "impeto", note: "Confronte a ideia de um ímpeto que se gasta." },
        { kind: "sim", id: "referenciais-nao-inerciais", scenario: "carrossel", note: "Compare a trajetória reta vista do chão com a trajetória curva vista do carrossel, que não é inercial." },
      ],
    },
    "5-4": {
      text: String.raw`Uma **força** é uma interação que pode alterar a velocidade de um corpo. Ela é medida pela aceleração que produz num corpo-padrão: definimos 1 **newton** (N) como a força que dá a uma massa de 1 kg uma aceleração de 1 m/s². Assim, $1\ \text{N} = 1\ \text{kg·m/s}^2$. Para ter uma ideia, o peso de uma maçã média é de cerca de 1 N.

### Forças são vetores
Experimentalmente, duas forças aplicadas ao mesmo corpo produzem o mesmo efeito que uma única força igual à sua soma vetorial. Por isso as forças se somam como vetores (capítulo 3), e o que importa para o movimento é a **força resultante**:
$$\vec F_{\text{res}} = \sum \vec F_i .$$
Esse fato, o **princípio da superposição**, permite decompor cada força em componentes e somar eixo por eixo.

### A primeira lei reescrita
Com essa definição, a primeira lei diz: se $\vec F_{\text{res}} = 0$, a velocidade é constante. Um corpo pode ter várias forças agindo e, ainda assim, não acelerar, se elas se cancelarem.

**Exemplo.** Um quadro de 50 N está pendurado por dois fios, cada um a 30° com a horizontal. Por simetria, as duas trações têm o mesmo módulo $T$. Na vertical, $2T\sin 30° = 50$ N, então $T = 50$ N. Cada fio puxa com força igual ao peso inteiro do quadro: fios quase horizontais exigem trações muito grandes. Com 10° de inclinação, a tração seria de 144 N.

### Diagrama de corpo livre
Para aplicar as leis, desenhamos o corpo isolado como um ponto e **todas as forças que agem sobre ele**, cada uma exercida por um agente identificável (a Terra, uma corda, uma superfície). Forças que o corpo exerce sobre os outros não entram.

**Armadilha:** desenhar uma "força do movimento" no sentido da velocidade. Toda força precisa de um agente; se você não consegue dizer quem a exerce, ela não existe.

No experimento, monte o diagrama do quadro pendurado por dois fios, peça a verificação e varie os ângulos dos fios para ver as trações crescerem quando eles se aproximam da horizontal.`,
      experiments: [
        { kind: "sim", id: "forcas-dcl", scenario: "fios", params: { m: 5, ang: 30, ang2: 30 }, note: "Monte o DCL do corpo pendurado em dois fios a 30° e confira que cada tração vale o peso." },
        { kind: "sim", id: "vetores-3d", scenario: "soma", note: "Relembre a soma vetorial: forças se compõem pela regra do paralelogramo." },
      ],
    },
    "5-5": {
      text: String.raw`Empurrar um carrinho de supermercado vazio e um cheio com a mesma força produz acelerações muito diferentes. A propriedade do corpo que determina essa resposta é a **massa** (inercial).

### Definição operacional
Aplicando a mesma força a dois corpos e medindo as acelerações,
$$\frac{m_1}{m_2} = \frac{a_2}{a_1} .$$
Quanto maior a massa, menor a aceleração produzida por uma dada força. Escolhendo um corpo como padrão (o quilograma, seção 1-7), qualquer outra massa pode ser medida assim.

### Propriedades
- A massa é um **escalar** positivo e é **aditiva**: dois corpos de 2 kg presos juntos têm 4 kg.
- É uma propriedade **intrínseca**: não depende de onde o corpo está.

### Massa não é peso
O **peso** é a força com que a Terra (ou outro astro) atrai o corpo, e vale $mg$ (seção 5-7). Um astronauta de 80 kg pesa cerca de 780 N na Terra e 130 N na Lua, mas tem os mesmos 80 kg nos dois lugares: na Lua, empurrá-lo horizontalmente para acelerá-lo exige a mesma força que na Terra.

**Exemplo.** Uma força horizontal de 12 N dá a um carrinho de laboratório uma aceleração de 4,0 m/s². Colocando uma carga sobre ele, a mesma força produz 1,5 m/s². A massa do carrinho é $12/4 = 3{,}0$ kg; a do conjunto, $12/1{,}5 = 8{,}0$ kg; logo, a carga tem 5,0 kg. Nenhuma balança foi usada.

**Armadilha:** dizer que um objeto "não tem massa" no espaço porque flutua. Ele tem a mesma massa; no máximo, o peso aparente é nulo (seção 13-7).

No experimento, puxe o carrinho do trilho de ar sempre com o mesmo peso pendurado e mude a massa do carrinho: meça as acelerações e confira que o produto massa total × aceleração fica constante.`,
      experiments: [
        { kind: "sim", id: "trilho-de-ar", scenario: "segunda-lei", params: { M1: 0.2, mp: 0.02 }, note: "Mantenha a massa pendurada e dobre a do carrinho (0,2 e 0,4 kg): compare as acelerações." },
        { kind: "sim", id: "atwood", scenario: "mesa", note: "Mude a massa do bloco na mesa mantendo o peso pendurado e observe a aceleração cair." },
      ],
    },
    "5-6": {
      text: String.raw`### Enunciado
**A força resultante sobre um corpo é igual ao produto da massa pela aceleração**:
$$\vec F_{\text{res}} = m\,\vec a .$$
Em componentes, são três equações independentes:
$$F_{\text{res},x} = m a_x, \qquad F_{\text{res},y} = m a_y, \qquad F_{\text{res},z} = m a_z .$$
A primeira lei é o caso particular $\vec F_{\text{res}} = 0 \Rightarrow \vec a = 0$.

### Como usar
1. Escolha **o corpo** (ou o sistema) a analisar.
2. Desenhe o diagrama de corpo livre com todas as forças **externas** a ele.
3. Escolha eixos convenientes (seção 3-7).
4. Escreva $\sum F = ma$ em cada eixo e resolva.

### Sistemas e forças internas
Se o "corpo" é um conjunto (dois blocos encostados, um trem de vagões), as forças que as partes exercem umas sobre as outras são **internas** e se cancelam aos pares (seção 5-8). Só as externas entram na resultante.

**Exemplo.** Um carrinho de 0,40 kg num trilho sem atrito é puxado por um fio que passa por uma polia e sustenta um peso de 0,050 kg. Tomando o sistema inteiro, a única força externa que o move é o peso pendurado: $a = m_p g/(M + m_p) = 0{,}49/0{,}45 \approx 1{,}09$ m/s². A tração no fio é $T = M a \approx 0{,}44$ N, **menor** que o peso pendurado (0,49 N); se fossem iguais, o peso não aceleraria.

**Armadilha:** colocar $m\vec a$ no diagrama como se fosse mais uma força. $m\vec a$ é o **resultado** da soma das forças, não uma força a mais.

No experimento, faça o roteiro da segunda lei no trilho de ar: varie a massa pendurada mantendo a massa total constante e trace a aceleração contra a força; a inclinação dá $1/m$.`,
      experiments: [
        { kind: "sim", id: "trilho-de-ar", scenario: "segunda-lei", params: { M1: 0.4, mp: 0.05 }, note: "Com M = 0,40 kg e peso de 0,050 kg, confira a ≈ 1,09 m/s² pelas fotoportas." },
        { kind: "pratica", id: "exp1-segunda-lei", note: "Roteiro de bancada: aceleração contra força no trilho de ar." },
        { kind: "sim", id: "forcas-dcl", scenario: "mesa", note: "Veja o corpo se mover sob o DCL que você montou, pela segunda lei." },
      ],
    },
    "5-7": {
      text: String.raw`Algumas forças aparecem em quase todo problema de mecânica.

### Força gravitacional e peso
Perto da superfície da Terra, a força gravitacional sobre um corpo de massa $m$ é $\vec F_g = m\vec g$, vertical para baixo, com $g \approx 9{,}8$ m/s². O **peso** é o módulo dessa força, $P = mg$, medido num referencial inercial. Uma balança de banheiro, porém, mede a força com que você a comprime; num elevador acelerando, esse **peso aparente** difere de $mg$.

### Força normal
Quando um corpo se apoia numa superfície, a superfície se deforma um pouco e empurra o corpo **perpendicularmente** a ela: é a **força normal** $\vec N$. Seu valor não é fixo; ele se ajusta ao que for necessário para impedir que o corpo atravesse a superfície. Num piso horizontal sem outras forças verticais, $N = mg$; mas, se você empurra a caixa para baixo, $N$ aumenta; numa rampa, $N = mg\cos\theta$; num elevador, $N = m(g + a)$.

### Atrito
Uma superfície também pode exercer uma força **paralela** a ela, que se opõe ao deslizamento (ou à tendência de deslizar): o **atrito**. Ele é estudado em detalhe na seção 6-2.

### Tração
Uma corda (ou cabo) esticada puxa o corpo ao qual está presa, ao longo da própria corda, com força $T$, a **tração**. Para uma corda ideal (sem massa e inextensível), a tração é a mesma em toda a sua extensão, mesmo passando por uma polia ideal.

**Exemplo.** Uma pessoa de 60 kg está numa balança dentro de um elevador. Subindo com aceleração de 1,5 m/s², a balança indica $N = 60(9{,}8 + 1{,}5) \approx 680$ N (69 kg "aparentes"). Descendo e acelerando para baixo com 1,5 m/s², indica 500 N. Se o cabo se rompesse, indicaria zero.

**Armadilha:** assumir sempre $N = mg$. A normal é o que for preciso; calcule-a pela segunda lei em cada situação.

No experimento, coloque a caixa no elevador com acelerações diferentes e acompanhe a normal; depois, na rampa, veja $N = mg\cos\theta$ diminuir com a inclinação.`,
      experiments: [
        { kind: "sim", id: "forcas-dcl", scenario: "elevador", params: { m: 6, ae: 1.5 }, note: "Monte o DCL da caixa no elevador acelerando para cima e compare a normal com o peso." },
        { kind: "concepcao", id: "normal-igual-peso", note: "Teste a ideia de que a normal é sempre igual ao peso." },
        { kind: "sim", id: "referenciais-nao-inerciais", scenario: "elevador", note: "Leia o peso aparente na balança do elevador durante a partida, a viagem e a frenagem." },
        { kind: "sim", id: "plano-inclinado", scenario: "critico", note: "Veja a normal e as componentes do peso mudarem com a inclinação da rampa." },
      ],
    },
    "5-8": {
      text: String.raw`### Enunciado
**Quando dois corpos interagem, as forças que cada um exerce sobre o outro têm o mesmo módulo e sentidos opostos**:
$$\vec F_{AB} = -\vec F_{BA} .$$
Essas duas forças formam um **par ação–reação** (ou par de terceira lei).

### Características do par
- As duas forças são da **mesma natureza** (ambas gravitacionais, ambas de contato etc.).
- Agem em **corpos diferentes**. Por isso **nunca se cancelam** entre si: uma entra no diagrama de A, a outra no de B.
- Existem simultaneamente; não há "primeiro a ação, depois a reação".

### Identificando pares
Um livro sobre a mesa: a Terra puxa o livro para baixo ($m\vec g$), e o livro puxa a Terra para cima com a mesma força. A mesa empurra o livro para cima ($\vec N$), e o livro empurra a mesa para baixo. O peso e a normal **não** formam um par: agem no mesmo corpo, são de naturezas diferentes e só são iguais porque o livro não acelera.

**Exemplo.** Um caminhão de 10 t bate num carro de 1 t. Durante o choque, as forças entre eles são iguais em módulo, digamos $2\times10^5$ N. As acelerações, porém, não: $20$ m/s² no caminhão e $200$ m/s² no carro. É a diferença de massa, não de força, que torna o choque tão pior para quem está no carro.

**Armadilha:** achar que o corpo mais pesado, mais rápido ou "mais forte" empurra com mais força. Na interação, as forças são sempre iguais; o que muda são os efeitos, pela segunda lei.

No experimento, provoque uma colisão entre carrinhos de massas muito diferentes e compare as variações de velocidade: o produto massa × variação de velocidade é igual e oposto nos dois, sinal de forças iguais e opostas durante o mesmo intervalo.`,
      experiments: [
        { kind: "concepcao", id: "terceira-lei-massas", note: "Confronte a ideia de que o corpo mais pesado empurra com mais força." },
        { kind: "sim", id: "colisoes", scenario: "gruda", params: { m1: 4, m2: 1, v1: 2, v2: -2 }, note: "Compare m·Δv nos dois carrinhos: iguais e opostos, embora as massas difiram quatro vezes." },
      ],
    },
    "5-9": {
      text: String.raw`Problemas com as leis de Newton seguem quase sempre o mesmo roteiro: **identificar os corpos, desenhar um diagrama de corpo livre para cada um, escolher eixos, escrever** $\sum F = ma$ **por eixo, usar os vínculos e resolver**.

### Vínculos
Corpos ligados por uma corda inextensível têm acelerações de mesmo módulo; a tração é a mesma dos dois lados de uma polia ideal. Esses vínculos fornecem as equações que faltam.

### Máquina de Atwood
Duas massas $m_1 > m_2$ penduradas numa polia ideal. Para $m_1$ (descendo): $m_1 g - T = m_1 a$. Para $m_2$ (subindo): $T - m_2 g = m_2 a$. Somando:
$$a = \frac{m_1 - m_2}{m_1 + m_2}\,g, \qquad T = \frac{2 m_1 m_2}{m_1 + m_2}\,g .$$
A tração fica entre os dois pesos, como deve ser.

**Exemplo.** Com $m_1 = 1{,}2$ kg e $m_2 = 0{,}8$ kg: $a = (0{,}4/2{,}0)\cdot 9{,}8 = 1{,}96$ m/s² e $T = (2\cdot 0{,}96/2{,}0)\cdot 9{,}8 \approx 9{,}4$ N. Medindo $a$, a máquina permite determinar $g$ com movimentos lentos e fáceis de cronometrar.

### Bloco na rampa sem atrito
Com $x$ ao longo da rampa de ângulo $\theta$: $mg\sin\theta = ma$, então $a = g\sin\theta$, independente da massa; e $N = mg\cos\theta$.

### Bloco empurrado rampa acima
Com uma força $F$ paralela à rampa, $F - mg\sin\theta = ma$. Para subir com velocidade constante, basta $F = mg\sin\theta$ (sem atrito), menor que o peso: é a vantagem da rampa.

### Elevador
Um cabo sustenta uma cabine de massa $M$ com aceleração $a$ para cima: $T = M(g + a)$.

**Armadilha:** tratar todo o sistema como um único corpo e tentar achar a tração assim. Forças internas se cancelam no sistema; para obter a tração é preciso isolar ao menos um dos corpos.

No experimento, monte a máquina de Atwood com as massas do exemplo e confira $a$ e $T$; depois empurre o bloco rampa acima e encontre a força que o faz subir com velocidade constante.`,
      experiments: [
        { kind: "sim", id: "atwood", scenario: "atwood", params: { m1: 1.2, m2: 0.8, Mp: 0, mu: 0 }, note: "Com 1,2 kg e 0,8 kg, confira a = 1,96 m/s² e T ≈ 9,4 N." },
        { kind: "pratica", id: "exp1-atwood", note: "Roteiro de bancada: máquina de Atwood e medida de g." },
        { kind: "sim", id: "plano-inclinado", scenario: "empurra", note: "Encontre a força que faz o bloco subir a rampa com velocidade constante." },
        { kind: "sim", id: "forcas-dcl", scenario: "rampa", note: "Monte o DCL do bloco na rampa e verifique-o antes de ver o movimento." },
      ],
    },
  },
};
