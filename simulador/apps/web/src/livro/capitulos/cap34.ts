import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 34,
  intro: String.raw`Uma **imagem** é a reprodução de um objeto feita pela luz depois de refletir ou refratar. Óculos, câmeras, microscópios, telescópios, retrovisores e o próprio olho funcionam formando imagens. Usando apenas raios, a lei da reflexão e a lei de Snell (capítulo 33), vamos localizar as imagens produzidas por espelhos planos e esféricos, por superfícies refratoras e por lentes delgadas, aprender a convenção de sinais que torna uma única equação válida para todos os casos e entender como se combinam lentes num instrumento óptico.`,
  sections: {
    "34-2": {
      text: String.raw`Enxergamos um objeto quando raios que partem de cada ponto dele chegam ao olho. O cérebro supõe que esses raios vieram em linha reta e "localiza" o ponto onde as retas, prolongadas para trás, se cruzam. Se algum desvio no caminho mudou a direção dos raios, o ponto percebido não coincide com o objeto: vemos uma **imagem**.

Há dois tipos:

- **Imagem real**: os raios luminosos **passam de fato** pelo ponto imagem. Ela pode ser projetada numa tela ou num sensor, como a imagem que a lente de um projetor forma na parede ou a que o cristalino forma na retina.
- **Imagem virtual**: os raios apenas **parecem** vir do ponto imagem; quem se cruza ali são os prolongamentos. Ela não aparece numa tela colocada naquele lugar, mas é vista por quem olha para o sistema, como a imagem num espelho plano.

Um exemplo natural de imagem virtual é a **miragem**. Num dia quente, o ar perto do asfalto é mais quente e tem índice de refração um pouco menor que o ar acima. Raios que vêm do céu e descem em direção à pista vão se encurvando gradualmente para cima, como numa sequência de refrações sucessivas, e chegam ao olho vindos de baixo. O cérebro interpreta essa luz azulada como vinda do chão, e vemos o que parece uma poça d'água refletindo o céu.

Outro exemplo: um peixe visto de cima parece mais raso do que está, porque os raios que saem da água se afastam da normal. Olhando quase na vertical, a profundidade aparente é a real dividida pelo índice: um peixe a $1{,}2$ m de profundidade parece estar a $1{,}2/1{,}33 \approx 0{,}90$ m.

Armadilha: achar que a imagem de um espelho está "na superfície do vidro". A imagem virtual fica atrás do espelho, à mesma distância que o objeto está à frente.

No experimento, observe a miragem formada pelo ar aquecido sobre a pista e mude a diferença de temperatura; no espelho plano, siga os prolongamentos dos raios até a imagem virtual.`,
      experiments: [
        { kind: "sim", id: "refracao", scenario: "miragem", note: "Aqueça o asfalto e veja os raios do céu se curvarem e formarem a miragem." },
        { kind: "sim", id: "espelhos", scenario: "plano", note: "Siga os prolongamentos dos raios refletidos até a imagem virtual." },
        { kind: "concepcao", id: "imagem-no-espelho" },
      ],
    },
    "34-3": {
      text: String.raw`Num **espelho plano**, cada raio que parte de um ponto objeto $O$ reflete com ângulo igual ao de incidência. Prolongando para trás os raios refletidos, todos se cruzam num único ponto $I$, situado sobre a perpendicular ao espelho que passa por $O$, **à mesma distância atrás do espelho** que o objeto está à frente. Usando a convenção de que distâncias de imagens virtuais são negativas:

$$i = -p.$$

A imagem é **virtual**, **direita** (não invertida de cima para baixo) e do **mesmo tamanho** que o objeto. O que ela inverte é a profundidade: o eixo perpendicular ao espelho troca de sentido, o que faz uma mão direita aparecer como esquerda.

Só uma pequena parte do espelho é usada por um observador para ver um ponto da imagem: a região onde estão os raios que de fato entram no olho. Por isso, para se ver de corpo inteiro num espelho vertical, basta um espelho com **metade da sua altura**, colocado na posição certa, qualquer que seja a distância até ele.

Exemplo: você está a $1{,}5$ m de um espelho plano. Sua imagem está $1{,}5$ m atrás dele, a $3{,}0$ m de você. Se você se aproxima do espelho a $0{,}5$ m/s, a imagem se aproxima do espelho também a $0{,}5$ m/s, e a distância entre você e a imagem diminui a $1{,}0$ m/s.

Dois espelhos planos formando um ângulo produzem imagens de imagens. Com espelhos a $90^\circ$ aparecem três imagens; com $60^\circ$, cinco. Em geral, se $360^\circ/\alpha$ é inteiro, o número de imagens é $360^\circ/\alpha - 1$.

Armadilha: pensar que, recuando, você passa a se ver inteiro num espelho pequeno. O tamanho angular da imagem e o do espelho diminuem na mesma proporção, e a fração do corpo que aparece não muda.

No experimento, arraste o objeto diante do espelho plano e confira que a imagem acompanha, sempre simétrica; observe quais raios chegam a um ponto de observação.`,
      experiments: [
        { kind: "sim", id: "espelhos", scenario: "plano", note: "Mova o objeto e confira i = −p e o aumento igual a 1." },
        { kind: "concepcao", id: "imagem-no-espelho" },
      ],
    },
    "34-4": {
      text: String.raw`Um **espelho esférico** é uma calota de esfera de raio $r$ espelhada por dentro (**côncavo**) ou por fora (**convexo**). O centro da esfera é o **centro de curvatura** $C$; o eixo que passa por $C$ e pelo centro do espelho é o **eixo central**.

Raios paralelos ao eixo central e próximos dele (**raios paraxiais**), ao refletir num espelho côncavo, convergem para um ponto do eixo, o **ponto focal** $F$. Num espelho convexo, os raios refletidos divergem como se viessem de um ponto atrás do espelho: o foco é virtual. Em ambos os casos, a **distância focal** é metade do raio de curvatura:

$$f = \frac{r}{2},$$

com a convenção de sinais: $f$ e $r$ positivos para o espelho côncavo e negativos para o convexo.

Comparado com um espelho plano, o côncavo **aproxima** os raios uns dos outros e pode ampliar a imagem de um objeto próximo, como num espelho de maquiagem. O convexo **afasta** os raios e mostra uma imagem menor, mas com campo de visão maior, como nos retrovisores externos e espelhos de garagem.

Exemplo: um espelho côncavo com raio de curvatura de $60$ cm tem foco a $30$ cm; um convexo de mesmo raio tem $f = -30$ cm.

A relação $f = r/2$ só é exata para raios paraxiais. Raios paralelos que atingem o espelho longe do eixo cruzam o eixo um pouco mais perto do espelho, e o feixe refletido não converge para um ponto: forma uma superfície brilhante chamada **cáustica** (é a curva que aparece numa xícara iluminada). Esse defeito é a **aberração esférica**. Um espelho **parabólico** não a tem para raios paralelos ao eixo, por isso é usado em telescópios e antenas.

Armadilha: aplicar $f = r/2$ a espelhos muito abertos. Quanto maior a abertura comparada a $r$, mais a imagem se borra.

No experimento, mande um feixe paralelo ao espelho côncavo e ao convexo e localize o foco; depois aumente a abertura e veja a cáustica, comparando com o espelho parabólico.`,
      experiments: [
        { kind: "sim", id: "espelhos", scenario: "aberracao", note: "Aumente a abertura e veja a cáustica; compare esférico com parabólico." },
        { kind: "sim", id: "espelhos", scenario: "concavo", note: "Localize o foco do espelho côncavo e confira f = r/2." },
        { kind: "pratica", id: "exp3-espelho-concavo", note: "Meça a distância focal de um espelho côncavo na bancada." },
      ],
    },
    "34-5": {
      text: String.raw`Para um objeto a uma distância $p$ de um espelho esférico de distância focal $f$, a imagem fica a uma distância $i$ dada por

$$\frac1p + \frac1i = \frac1f,$$

e a **ampliação lateral** (razão entre a altura da imagem e a do objeto, com sinal) é

$$m = -\frac{i}{p}.$$

Convenção de sinais: $p > 0$ para objetos reais; $i > 0$ para imagens **reais** (na frente do espelho, do lado da luz refletida) e $i < 0$ para imagens **virtuais** (atrás); $m > 0$ indica imagem direita e $m < 0$, invertida.

Num **espelho côncavo**, tudo depende de onde está o objeto em relação ao foco:
- $p > f$: imagem real e invertida; menor que o objeto se $p > 2f$ e maior se $f < p < 2f$;
- $p = f$: os raios saem paralelos e a imagem vai para o infinito;
- $p < f$: imagem virtual, direita e ampliada.

Num **espelho convexo** ($f < 0$), a imagem de um objeto real é sempre virtual, direita e reduzida.

### Localização de Imagens por Meio de Raios
Três raios principais bastam para desenhar a imagem de um ponto: o que chega **paralelo** ao eixo reflete passando pelo foco; o que passa **pelo foco** reflete paralelo ao eixo; o que passa **pelo centro de curvatura** volta sobre si mesmo. Um quarto raio, o que atinge o vértice, reflete simetricamente em relação ao eixo. Dois raios já determinam a imagem; o terceiro serve de conferência.

Exemplo: objeto a $45$ cm de um espelho côncavo de $f = 30$ cm. Então $1/i = 1/30 - 1/45$, $i = 90$ cm (real) e $m = -2$: imagem invertida e duas vezes maior. Com o objeto a $20$ cm: $i = -60$ cm, $m = +3$, imagem virtual direita e três vezes maior.

Armadilha: esquecer o sinal de $f$ no espelho convexo e obter uma imagem real. Com $f = -30$ cm e $p = 45$ cm, $i = -18$ cm: virtual, como deve ser.

No experimento, arraste o objeto diante do espelho côncavo atravessando $2f$ e $f$ e observe a imagem passar de real reduzida a real ampliada e a virtual; repita com o convexo.`,
      experiments: [
        { kind: "sim", id: "espelhos", scenario: "concavo", note: "Arraste o objeto através de 2f e de f e acompanhe a natureza da imagem." },
        { kind: "sim", id: "espelhos", scenario: "convexo", note: "Confira que a imagem do espelho convexo é sempre virtual, direita e menor." },
        { kind: "pratica", id: "exp3-espelho-concavo", note: "Meça pares (p, i) e obtenha f pelo gráfico de 1/i contra 1/p." },
      ],
    },
    "34-6": {
      text: String.raw`Uma superfície esférica que separa dois meios transparentes também forma imagens, desta vez por refração. Seja um objeto no meio de índice $n_1$, a uma distância $p$ da superfície de raio de curvatura $r$, atrás da qual está o meio de índice $n_2$. Para raios paraxiais, a imagem fica a uma distância $i$ tal que

$$\frac{n_1}{p} + \frac{n_2}{i} = \frac{n_2 - n_1}{r}.$$

Convenção de sinais (diferente da dos espelhos, porque agora a luz atravessa a superfície): a imagem é **real** e $i > 0$ quando fica do lado **oposto** ao objeto, onde está a luz refratada; é **virtual** e $i < 0$ quando fica do mesmo lado do objeto. O raio $r$ é **positivo** quando o centro de curvatura está do lado da luz refratada (superfície convexa vista pelo objeto) e negativo no caso contrário.

A equação contém casos já conhecidos. Para uma superfície **plana**, $r \to \infty$, e $i = -(n_2/n_1)\,p$: é a profundidade aparente da seção 34-2. Se $n_1 = n_2$, nada acontece, como esperado.

Exemplo: uma bolinha está dentro de uma esfera de vidro maciça ($n = 1{,}5$) de raio $5{,}0$ cm, a $2{,}0$ cm da superfície, e é vista de fora pelo ar. Do ponto de vista da bolinha, a superfície é côncava: o centro de curvatura está do lado do objeto, logo $r = -5{,}0$ cm. Com $n_1 = 1{,}5$ e $n_2 = 1{,}0$: $1{,}5/2{,}0 + 1{,}0/i = (1{,}0 - 1{,}5)/(-5{,}0)$, o que dá $i \approx -1{,}5$ cm. A imagem é virtual, fica dentro da esfera e parece um pouco mais perto da superfície que a bolinha.

Uma lente é formada por duas dessas superfícies; aplicando a equação duas vezes, usando a imagem da primeira como objeto da segunda, obtém-se a equação das lentes (seções 34-7 e 34-9).

Armadilha: usar a convenção dos espelhos, contando como reais as imagens do mesmo lado do objeto. Na refração, a imagem real está do outro lado.

No experimento, use a lente espessa, que tem duas superfícies esféricas: mude o raio das faces, a espessura e o índice e veja como a refração em cada face desloca o ponto de convergência.`,
      experiments: [
        { kind: "sim", id: "lentes", params: { montagem: 7 }, note: "Na lente espessa, varie o raio das faces e o índice e acompanhe a refração em cada superfície." },
        { kind: "sim", id: "principio-fermat", scenario: "lamina", note: "Veja a imagem deslocada por uma superfície plana, o caso r → ∞." },
      ],
    },
    "34-7": {
      text: String.raw`Uma **lente** é um corpo transparente limitado por duas superfícies refratoras com eixo comum. Quando sua espessura é pequena diante das distâncias envolvidas, ela é uma **lente delgada**, e a imagem obedece à mesma forma da equação dos espelhos:

$$\frac1p + \frac1i = \frac1f,\qquad m = -\frac ip.$$

A distância focal depende do material e das curvaturas pela **equação do fabricante de lentes** (para uma lente no ar):

$$\frac1f = (n - 1)\left(\frac1{r_1} - \frac1{r_2}\right),$$

em que $r_1$ é o raio da face voltada para o objeto e $r_2$ o da outra, com os sinais da seção 34-6. Lentes mais grossas no centro são **convergentes** ($f > 0$); mais finas no centro, **divergentes** ($f < 0$). Como $n$ depende da cor, $f$ também depende: é a **aberração cromática**.

Convenção: $i > 0$ para imagem real, do outro lado da lente; $i < 0$ para imagem virtual, do mesmo lado do objeto. A classificação das imagens é a mesma do espelho côncavo (convergente) e do convexo (divergente).

### Localização de Imagens de Objetos Extensos por Meio de Raios
Raios principais: o que chega **paralelo** ao eixo sai passando pelo foco do outro lado (ou parece vir do foco do mesmo lado, numa divergente); o que passa pelo **foco** do lado do objeto sai paralelo; o que passa pelo **centro** da lente não se desvia.

### Sistemas de Duas Lentes
Ache a imagem da primeira lente e use-a como objeto da segunda (se ela cair depois da segunda lente, é um objeto virtual, com $p < 0$). A ampliação total é o produto: $M = m_1m_2$.

Exemplo: uma lente convergente de $f = 10$ cm e um objeto a $15$ cm dão $i = 30$ cm e $m = -2$. Uma segunda lente de $f = 10$ cm a $40$ cm da primeira recebe esse objeto a $10$ cm, exatamente no foco, e manda a imagem final para o infinito.

Armadilha: achar que, cobrindo metade da lente, some metade da imagem. Cada ponto da lente recebe luz de todo o objeto; a imagem continua inteira, apenas mais escura.

No experimento, mova o objeto diante de uma lente convergente e de uma divergente; depois monte a associação de duas lentes e acompanhe a imagem intermediária.`,
      experiments: [
        { kind: "sim", id: "lentes", scenario: "lente", note: "Arraste o objeto e confira 1/p + 1/i = 1/f e a ampliação." },
        { kind: "sim", id: "lentes", params: { montagem: 2 }, note: "Na associação de duas lentes, use a imagem da primeira como objeto da segunda." },
        { kind: "pratica", id: "exp3-lentes", note: "Meça a distância focal de uma lente convergente na bancada óptica." },
        { kind: "pratica", id: "exp3-lente-divergente", note: "Meça a distância focal de uma lente divergente pelo método da paralaxe." },
        { kind: "concepcao", id: "imagem-precisa-lente-inteira" },
      ],
    },
    "34-8": {
      text: String.raw`O tamanho com que vemos um objeto depende do ângulo que ele ocupa no campo visual. O olho normal não focaliza a menos de cerca de $25$ cm (o **ponto próximo**); aproximar mais não ajuda. Os instrumentos ópticos aumentam o ângulo.

### Lente de Aumento Simples
Com o objeto no foco de uma lente convergente, a imagem fica no infinito e é vista com o olho relaxado. A **ampliação angular** em relação ao objeto visto a $25$ cm é

$$m_\theta \approx \frac{25\ \mathrm{cm}}{f}.$$

Uma lupa de $f = 5$ cm amplia cerca de $5$ vezes.

### Microscópio Composto
A **objetiva**, de distância focal curta, forma uma imagem real e ampliada do objeto perto do foco da **ocular**, que funciona como lupa. Se $s$ é a distância entre o foco da objetiva e a imagem que ela forma (o comprimento do tubo, tipicamente $16$ cm), a ampliação total é

$$M = m\,m_\theta = -\frac{s}{f_{ob}}\,\frac{25\ \mathrm{cm}}{f_{oc}}.$$

Com $f_{ob} = 4{,}0$ mm e $f_{oc} = 2{,}5$ cm: $M \approx -40\cdot10 = -400$.

### Telescópio Refrator
Para um objeto muito distante, a objetiva forma a imagem no seu foco, que coincide com o foco da ocular; a luz sai paralela. A ampliação angular é

$$m_\theta = -\frac{f_{ob}}{f_{oc}}.$$

Uma objetiva de $1{,}2$ m com ocular de $2{,}0$ cm dá $60$ vezes. Mais importante que o aumento, porém, é o diâmetro da objetiva, que define quanta luz é coletada e o poder de resolução (seção 36-6).

O próprio **olho** é um sistema de lentes: córnea e cristalino formam a imagem na retina, e os músculos mudam a curvatura do cristalino para focalizar (acomodação). Na miopia, a imagem de objetos distantes se forma antes da retina; corrige-se com lente divergente.

Armadilha: achar que um telescópio "aproxima" o objeto. A imagem final está no infinito; o que aumenta é o ângulo sob o qual ela é vista.

No experimento, monte o microscópio e o telescópio e calcule as ampliações; depois corrija o olho míope com a lente adequada.`,
      experiments: [
        { kind: "sim", id: "lentes", scenario: "microscopio", note: "Ajuste objetiva e ocular e confira M = −(s/f_ob)(25 cm/f_oc)." },
        { kind: "sim", id: "lentes", scenario: "telescopio", note: "Compare a ampliação angular com −f_ob/f_oc." },
        { kind: "sim", id: "lentes", scenario: "miopia", note: "Escolha a vergência da lente que corrige o olho míope." },
        { kind: "desafio", id: "telescopio-20x", note: "Monte um telescópio com aumento de 20 vezes." },
        { kind: "desafio", id: "microscopio-250x", note: "Monte um microscópio com aumento de 250 vezes." },
        { kind: "pratica", id: "exp3-olho", note: "Simule o olho míope e determine a lente corretiva." },
      ],
    },
    "34-9": {
      text: String.raw`As equações deste capítulo podem ser obtidas com geometria simples e a aproximação de ângulos pequenos ($\mathrm{sen}\,\alpha \approx \tan\alpha \approx \alpha$). Vale a pena ver o roteiro de cada uma.

### Equação do espelho esférico
Um raio sai do ponto objeto $O$ no eixo, reflete no espelho e cruza o eixo na imagem $I$. Sejam $\alpha$, $\beta$ e $\gamma$ os ângulos que a reta que sai de $O$, o raio do espelho até o ponto de reflexão e a reta até $I$ fazem com o eixo. A lei da reflexão e o teorema do ângulo externo dos triângulos dão $\alpha + \gamma = 2\beta$. Para ângulos pequenos, $\alpha \approx h/p$, $\beta = h/r$ e $\gamma \approx h/i$, em que $h$ é a altura do ponto de reflexão. Substituindo, $1/p + 1/i = 2/r$, e $f = r/2$.

### Equação da superfície refratora
O mesmo desenho, agora com a lei de Snell na forma $n_1\theta_1 \approx n_2\theta_2$ e os ângulos externos dos triângulos, leva a $n_1\alpha + n_2\gamma = (n_2 - n_1)\beta$, e daí a $n_1/p + n_2/i = (n_2 - n_1)/r$.

### Equações da lente delgada
Aplicando a equação da superfície refratora à primeira face (do ar para o vidro) e depois à segunda (do vidro para o ar), com a imagem da primeira servindo de objeto para a segunda e desprezando a espessura, os termos da imagem intermediária se cancelam. Sobra $1/p + 1/i = (n-1)(1/r_1 - 1/r_2)$, que é a equação das lentes e a do fabricante de uma só vez.

Exemplo de verificação: uma lente biconvexa de vidro ($n = 1{,}5$) com faces de raio $20$ cm tem $r_1 = +20$ cm e $r_2 = -20$ cm, logo $1/f = 0{,}5\cdot(2/20)$ e $f = 20$ cm.

Armadilha: esquecer que todas essas deduções supõem raios **paraxiais**. Fora dessa aproximação surgem as aberrações, e as equações deixam de ser exatas.

No experimento, compare o traçado exato dos raios num espelho de grande abertura com a previsão paraxial; na lente espessa, veja quando a aproximação de lente delgada deixa de valer.`,
      experiments: [
        { kind: "sim", id: "espelhos", scenario: "aberracao", note: "Compare o traçado exato com a previsão paraxial f = r/2 para várias aberturas." },
        { kind: "sim", id: "lentes", params: { montagem: 7 }, note: "Aumente a espessura da lente e veja o resultado se afastar da equação da lente delgada." },
      ],
    },
  },
};
