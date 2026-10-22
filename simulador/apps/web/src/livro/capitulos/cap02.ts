import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 2,
  intro: String.raw`A física começa descrevendo como as coisas se movem, antes de perguntar por quê. Este capítulo trata do caso mais simples: um corpo que anda sobre uma reta, como um carro numa estrada plana, um elevador ou uma pedra que cai. Com apenas três grandezas, **posição**, **velocidade** e **aceleração**, e com a ideia de taxa de variação (a derivada), construímos a **cinemática**: as equações e os gráficos que contam onde o corpo está a cada instante. O caso da aceleração constante, que inclui a queda livre perto da superfície da Terra, ganha destaque porque aparece em toda parte e porque suas equações serão usadas em quase todos os capítulos seguintes.`,
  sections: {
    "2-2": {
      text: String.raw`Dizer que um corpo **se move** é dizer que a sua posição muda com o tempo **em relação a um referencial**. Um passageiro sentado num ônibus está em repouso em relação ao ônibus e em movimento em relação à calçada; nenhuma das duas descrições é a "verdadeira". Antes de qualquer conta, é preciso escolher o referencial e deixá-lo explícito.

### O que este capítulo considera
- **Movimento retilíneo**: a trajetória é uma reta, de modo que uma única coordenada ($x$ ou $y$) basta para dizer onde o corpo está.
- **Partícula**: tratamos o corpo como um ponto. Isso vale quando todas as suas partes se deslocam do mesmo modo (sem girar nem se deformar) ou quando o tamanho dele é desprezível diante das distâncias envolvidas. Um carro numa viagem de 300 km é uma partícula; o mesmo carro manobrando numa vaga não é.
- **Sem causas**: aqui só descrevemos o movimento. As forças que o produzem são assunto do capítulo 5.

### Por que tanta simplificação?
Movimentos em duas e três dimensões (capítulo 4) se decompõem em movimentos retilíneos ao longo de cada eixo. Dominar a reta é, portanto, dominar a base de tudo.

**Exemplo.** Um trem metropolitano percorre 1,2 km entre duas estações, em linha reta. Para estudar o horário, o trem é uma partícula com posição $x(t)$ ao longo dos trilhos. Para estudar a força nos engates entre os vagões, já não é.

**Armadilha:** achar que "parado" é uma propriedade absoluta. Repouso e movimento sempre dependem do referencial.

No experimento, rode o carro na estrada reta com o controle ao vivo e observe como a única coordenada $x$ descreve tudo o que acontece; mude a aceleração durante o movimento e veja os gráficos responderem.`,
      experiments: [
        { kind: "sim", id: "cinematica-1d", scenario: "vivo", note: "Controle a aceleração de um carro numa estrada reta e acompanhe x(t), v(t) e a(t) ao mesmo tempo." },
        { kind: "sim", id: "jogos-fisica", scenario: "labirinto-v", note: "Atravesse o labirinto controlando a velocidade e veja a posição resultante nos gráficos." },
      ],
    },
    "2-3": {
      text: String.raw`Para localizar uma partícula sobre uma reta, escolhemos uma **origem** e um **sentido positivo** e usamos a coordenada $x$: a distância até a origem, com sinal. Pontos de um lado da origem têm $x > 0$, do outro, $x < 0$. A unidade SI é o metro.

### Deslocamento
Quando a partícula vai da posição $x_1$ à posição $x_2$, o seu **deslocamento** é
$$\Delta x = x_2 - x_1 .$$
- O sinal de $\Delta x$ informa o sentido: positivo no sentido de $x$ crescente, negativo no outro.
- O deslocamento só depende das posições inicial e final, não do caminho. Uma pessoa que anda 30 m para a frente e 30 m de volta tem $\Delta x = 0$, embora tenha caminhado 60 m.
- Deslocamento é o exemplo mais simples de **vetor** (capítulo 3): tem módulo e sentido. Na reta, o sinal faz o papel do sentido.

### Distância percorrida
A **distância total percorrida** soma os módulos de todos os trechos e nunca é negativa. Ela coincide com $|\Delta x|$ apenas se a partícula não inverter o sentido.

**Exemplo.** Uma ciclista parte de $x_1 = -200$ m, vai até $x = 500$ m e volta para $x_2 = 300$ m. Deslocamento: $\Delta x = 300 - (-200) = 500$ m. Distância percorrida: $700 + 200 = 900$ m.

**Armadilha:** confundir posição negativa com movimento para trás. $x < 0$ diz apenas de que lado da origem a partícula está; o sentido do movimento é dado pelo sinal da **variação** de $x$.

No experimento, coloque o carro numa posição inicial negativa com velocidade positiva, deixe-o andar com aceleração nula e leia, no gráfico $x(t)$, o deslocamento entre dois instantes. Depois dê uma aceleração negativa para que ele volte e compare deslocamento com distância percorrida.`,
      experiments: [
        { kind: "sim", id: "cinematica-1d", scenario: "vivo", params: { modo: 0, a: 0, x0: -20, v0: 4 }, note: "Parta de x negativo com velocidade positiva e leia o deslocamento no gráfico x(t)." },
        { kind: "sim", id: "cinematica-1d", scenario: "vivo", params: { modo: 0, a: -1, x0: -10, v0: 6 }, note: "Faça o carro inverter o sentido e compare o deslocamento com a distância percorrida." },
      ],
    },
    "2-4": {
      text: String.raw`### Velocidade média
A **velocidade média** num intervalo de tempo é o deslocamento dividido pela duração:
$$v_{\text{méd}} = \frac{\Delta x}{\Delta t} = \frac{x_2 - x_1}{t_2 - t_1} .$$
Ela tem o sinal do deslocamento. No gráfico $x(t)$, $v_{\text{méd}}$ é a **inclinação da reta secante** que liga os pontos $(t_1, x_1)$ e $(t_2, x_2)$. Só importam as extremidades: o que aconteceu no meio não entra na conta.

### Velocidade escalar média
A **velocidade escalar média** usa a distância total percorrida:
$$s_{\text{méd}} = \frac{\text{distância total}}{\Delta t} ,$$
e é sempre positiva. É o que o velocímetro "médio" de um aplicativo de corrida mostra.

**Exemplo.** Um motorista percorre 60 km em linha reta a 100 km/h e, em seguida, mais 60 km a 60 km/h. Os tempos são 0,6 h e 1,0 h; logo $v_{\text{méd}} = 120/1{,}6 = 75$ km/h, e **não** a média aritmética 80 km/h, porque ele passou mais tempo no trecho lento. Se ele voltasse ao ponto de partida pelo mesmo caminho, a velocidade média da viagem completa seria zero, mas a velocidade escalar média, não.

**Armadilha:** fazer a média das velocidades dos trechos. Isso só vale se os trechos tiverem a **mesma duração**; com trechos de mesma distância, a média correta é ponderada pelo tempo.

No experimento, rode o perfil acelera–cruzeiro–freia e calcule a velocidade média de todo o percurso dividindo o deslocamento pelo tempo total; compare com a velocidade de cruzeiro. Depois, na queda livre com fotoportas, a velocidade obtida pela largura da esfera dividida pelo tempo de bloqueio é uma velocidade média num intervalo curto.`,
      experiments: [
        { kind: "sim", id: "cinematica-1d", scenario: "trajeto", note: "Calcule a velocidade média do percurso inteiro e compare com a velocidade de cruzeiro." },
        { kind: "sim", id: "queda-livre", scenario: "velocidade", note: "Obtenha velocidades médias dividindo o tamanho da esfera pelo tempo em que ela bloqueia a fotoporta." },
      ],
    },
    "2-5": {
      text: String.raw`A velocidade média não diz quão rápido a partícula ia num instante específico. Para isso, encolhemos o intervalo em torno desse instante até que ele tenda a zero.

### Velocidade instantânea
$$v = \lim_{\Delta t \to 0} \frac{\Delta x}{\Delta t} = \frac{dx}{dt} .$$
A velocidade (instantânea) é a **derivada da posição em relação ao tempo**. No gráfico $x(t)$, é a inclinação da **reta tangente** à curva naquele instante: onde a curva sobe, $v > 0$; onde desce, $v < 0$; nos picos e vales, $v = 0$.

### Velocidade escalar
A **velocidade escalar** (instantânea) é o módulo de $v$; é o que o velocímetro do carro mostra, sem dizer o sentido. Diferentemente das grandezas médias da seção 2-4, aqui não há ambiguidade: o módulo da velocidade instantânea é exatamente a velocidade escalar instantânea.

**Exemplo.** Uma partícula tem $x(t) = 4t^2 - 2t^3$ (x em metros, t em segundos). Derivando, $v(t) = 8t - 6t^2$. Em $t = 1$ s, $v = 2$ m/s; em $t = 2$ s, $v = -8$ m/s (já está voltando). A velocidade se anula em $t = 4/3$ s, instante em que $x$ atinge o valor máximo, cerca de 2,37 m.

### Medindo na prática
Fotoportas medem o tempo $\Delta t$ que uma bandeira de largura $L$ leva para passar. A razão $L/\Delta t$ é uma velocidade média, mas, se $L$ for pequena diante das variações do movimento, aproxima muito bem a velocidade instantânea.

**Armadilha:** achar que velocidade nula significa que a partícula está em repouso por um intervalo. No ponto de retorno, $v = 0$ só por um instante.

No experimento, meça a velocidade do carrinho no trilho de ar com bandeiras de larguras diferentes e veja o valor convergir quando a bandeira fica estreita; depois, no labirinto, controle diretamente a velocidade e veja a inclinação de $x(t)$ seguir seus comandos.`,
      experiments: [
        { kind: "sim", id: "trilho-de-ar", scenario: "segunda-lei", params: { Lb: 0.01 }, note: "Com bandeira estreita, L/Δt nas fotoportas aproxima a velocidade instantânea; compare com bandeiras largas." },
        { kind: "sim", id: "jogos-fisica", scenario: "labirinto-v", note: "Controle a velocidade e observe que ela é a inclinação do gráfico x(t)." },
        { kind: "sim", id: "queda-livre", scenario: "velocidade", note: "Estime a velocidade da esfera em cada fotoporta pelo tempo de bloqueio." },
      ],
    },
    "2-6": {
      text: String.raw`Quando a velocidade de uma partícula muda, dizemos que ela tem **aceleração**.

### Aceleração média e instantânea
$$a_{\text{méd}} = \frac{\Delta v}{\Delta t}, \qquad a = \frac{dv}{dt} = \frac{d^2x}{dt^2} .$$
A aceleração instantânea é a inclinação da tangente ao gráfico $v(t)$ e a "curvatura" do gráfico $x(t)$: concavidade para cima indica $a > 0$, para baixo, $a < 0$. A unidade SI é o m/s² (metro por segundo, a cada segundo).

### O sinal da aceleração
O sinal de $a$ diz para que lado a velocidade está mudando, **não** se o corpo acelera ou freia no sentido coloquial:
- $v$ e $a$ com o **mesmo sinal**: o módulo da velocidade aumenta (o corpo "acelera");
- $v$ e $a$ com **sinais opostos**: o módulo diminui (o corpo freia).

Um carro andando no sentido negativo com $a < 0$ está ganhando rapidez, apesar de a aceleração ser negativa.

### Escala com g
Acelerações costumam ser comparadas com $g \approx 9{,}8$ m/s². Um carro esportivo chega a cerca de $0{,}5g$; uma frenagem forte, a $0{,}8g$; pilotos de caça suportam alguns $g$ por instantes.

**Exemplo.** Um carro vai de 0 a 100 km/h (27,8 m/s) em 8,0 s: $a_{\text{méd}} = 3{,}5$ m/s², cerca de $0{,}35g$. Numa frenagem de 27,8 m/s até o repouso em 3,5 s, $a_{\text{méd}} = -7{,}9$ m/s².

**Armadilha:** concluir que, se a velocidade é zero, a aceleração também é. Uma bola lançada para cima tem $v = 0$ no ponto mais alto, mas a aceleração continua sendo $g$ para baixo; se fosse zero, ela ficaria parada lá em cima.

No experimento, use o controle ao vivo para produzir as quatro combinações de sinais de $v$ e $a$ e veja, em cada uma, se o carro ganha ou perde rapidez; depois atravesse o labirinto controlando só a aceleração.`,
      experiments: [
        { kind: "sim", id: "cinematica-1d", scenario: "vivo", params: { modo: 0, a: -2, x0: 0, v0: -3 }, note: "Velocidade e aceleração negativas: confira que o carro ganha rapidez; depois troque os sinais." },
        { kind: "concepcao", id: "velocidade-zero-aceleracao-zero", note: "Teste a ideia de que velocidade nula implica aceleração nula." },
        { kind: "sim", id: "jogos-fisica", scenario: "labirinto-a", note: "Controle apenas a aceleração e sinta o atraso entre comando, velocidade e posição." },
      ],
    },
    "2-7": {
      text: String.raw`Em muitos movimentos a aceleração é constante, ou quase: um carro que arranca com o pedal fixo, um avião na pista de decolagem, um objeto que cai de pequena altura. Nesse caso, a velocidade média num intervalo é a média simples das velocidades inicial e final, e as relações entre as grandezas ficam algébricas.

### As equações
Com $a$ constante, posição $x_0$ e velocidade $v_0$ em $t = 0$:
$$v = v_0 + a t$$
$$x - x_0 = v_0 t + \tfrac12 a t^2$$
$$v^2 = v_0^2 + 2a\,(x - x_0)$$
$$x - x_0 = \tfrac12 (v_0 + v)\, t$$
$$x - x_0 = v t - \tfrac12 a t^2$$
Cada equação omite uma das cinco grandezas ($x - x_0$, $v$, $t$, $a$, $v_0$). A estratégia é escolher a que **não contém** a grandeza que você nem conhece nem quer.

### Gráficos
$a(t)$ é uma reta horizontal, $v(t)$ é uma reta de inclinação $a$, e $x(t)$ é uma parábola.

**Exemplo.** Um avião precisa de 70 m/s para decolar e acelera a 2,5 m/s² a partir do repouso. Sem conhecer o tempo, usamos a terceira equação: $x - x_0 = v^2/(2a) = 4900/5 = 980$ m de pista. O tempo é $t = v/a = 28$ s.

**Armadilha:** usar essas equações quando a aceleração muda (por exemplo, numa partida seguida de frenagem). Nesse caso, divida o movimento em trechos de aceleração constante e aplique as equações em cada um, usando o estado final de um trecho como inicial do seguinte.

No experimento, fixe uma aceleração constante e confira, com as medidas de $x$ e $v$, as equações acima em dois ou três instantes; no trilho de ar, faça o mesmo com o carrinho puxado por um peso.`,
      experiments: [
        { kind: "sim", id: "cinematica-1d", scenario: "vivo", params: { modo: 0, a: 2, x0: -20, v0: 0 }, note: "Com a = 2 m/s² a partir do repouso, confira x e v medidos com as equações da aceleração constante." },
        { kind: "pratica", id: "exp1-trilho-mruv", note: "Roteiro de bancada: MRU e MRUV no trilho de ar com fotoportas." },
        { kind: "sim", id: "trilho-de-ar", scenario: "segunda-lei", note: "O carrinho puxado por um peso tem aceleração constante: verifique v² = v₀² + 2aΔx entre as fotoportas." },
      ],
    },
    "2-8": {
      text: String.raw`As equações da seção 2-7 podem ser obtidas sem argumentos geométricos, por **integração**. Esse caminho é mais geral: vale também quando a aceleração não é constante, desde que conheçamos $a(t)$.

### Da aceleração à velocidade
Como $a = dv/dt$, temos $dv = a\,dt$. Integrando de $0$ a $t$:
$$v(t) - v_0 = \int_0^t a\,dt' .$$
Com $a$ constante, a integral vale $at$, e voltamos a $v = v_0 + at$.

### Da velocidade à posição
Como $v = dx/dt$:
$$x(t) - x_0 = \int_0^t v\,dt' = \int_0^t (v_0 + a t')\,dt' = v_0 t + \tfrac12 a t^2 .$$
Eliminando $t$ entre as duas relações chega-se a $v^2 = v_0^2 + 2a\,\Delta x$.

### Constantes de integração
As constantes $v_0$ e $x_0$ são as **condições iniciais**. Sem elas, a aceleração sozinha não determina o movimento: dois carros com a mesma $a(t)$ mas posições ou velocidades iniciais diferentes seguem trajetórias diferentes.

**Exemplo.** Um carrinho parte de $x_0 = 5$ m com $v_0 = 8$ m/s e freia com $a = -2$ m/s². Então $v = 8 - 2t$ e $x = 5 + 8t - t^2$. Ele para em $t = 4$ s, em $x = 21$ m, e depois volta (se nada o segurar): em $t = 8$ s está de novo em $x = 5$ m, com $v = -8$ m/s. A simetria entre ida e volta é uma marca do movimento com aceleração constante.

**Exemplo com aceleração variável.** Se $a(t) = 6t$ (m/s²) e o corpo parte do repouso na origem, $v = 3t^2$ e $x = t^3$. As equações da seção 2-7 dariam respostas erradas.

**Armadilha:** esquecer as condições iniciais ao integrar, como se toda partida fosse da origem e do repouso.

No experimento, lance o carro com velocidade positiva e aceleração negativa e compare o instante de parada e a posição máxima com o que as integrais preveem; observe a simetria da volta.`,
      experiments: [
        { kind: "sim", id: "cinematica-1d", scenario: "vivo", params: { modo: 0, a: -2, x0: 5, v0: 8 }, note: "Preveja por integração o instante de parada e a posição máxima e confira; observe a volta simétrica." },
        { kind: "sim", id: "cinematica-1d", scenario: "desenhar", note: "Desenhe uma aceleração variável e veja v(t) e x(t) saírem das integrais." },
      ],
    },
    "2-9": {
      text: String.raw`Perto da superfície da Terra e sem resistência do ar, todo corpo solto cai com a **mesma aceleração**, independentemente da massa, da forma ou do material. Essa aceleração de **queda livre** aponta para baixo e tem módulo $g \approx 9{,}8$ m/s² (varia um pouco com a latitude e a altitude: cerca de 9,78 m/s² no equador e 9,83 m/s² nos polos).

### As equações
Queda livre é um caso de aceleração constante. Com o eixo $y$ **para cima**, $a = -g$:
$$v = v_0 - g t, \qquad y - y_0 = v_0 t - \tfrac12 g t^2, \qquad v^2 = v_0^2 - 2g\,(y - y_0) .$$
- A aceleração é $-g$ durante **todo** o voo: na subida, no ponto mais alto e na descida.
- A subida e a descida entre as mesmas alturas levam o mesmo tempo, e a bola passa por cada altura com a mesma rapidez na ida e na volta.

**Exemplo.** Uma bola é lançada para cima a 12 m/s. Ela para em $t = 12/9{,}8 \approx 1{,}2$ s, a uma altura de $12^2/(2 \cdot 9{,}8) \approx 7{,}3$ m, e volta à mão em 2,4 s, de novo com 12 m/s, agora para baixo.

### Tempo de reação
Se um colega solta uma régua entre seus dedos e você a pega depois de ela cair $d$, seu tempo de reação é $t = \sqrt{2d/g}$. Uma queda de 20 cm corresponde a cerca de 0,20 s.

### O papel do ar
Uma pena e uma moeda caem juntas no vácuo. No ar, a resistência cresce com a velocidade e pode equilibrar o peso, levando a uma **velocidade terminal**; isso é assunto do capítulo 6.

**Armadilha:** achar que o corpo mais pesado cai mais depressa. Sem ar, não cai; com ar, a diferença vem da resistência, não da massa por si.

No experimento, meça os tempos de passagem da esfera pelas fotoportas e obtenha $g$ pelo gráfico de altura contra $t^2$; depois meça o seu tempo de reação com a régua em queda.`,
      experiments: [
        { kind: "sim", id: "queda-livre", scenario: "medir-g", note: "Meça os tempos nas fotoportas e determine g pela inclinação de h contra t²." },
        { kind: "pratica", id: "exp1-queda-livre", note: "Roteiro de bancada: queda livre e medida de g." },
        { kind: "concepcao", id: "mais-pesado-cai-mais-rapido", note: "Confronte a ideia de que o corpo mais pesado cai mais depressa." },
        { kind: "sim", id: "medidas-erros", scenario: "reacao", note: "Pegue a régua em queda e calcule o seu tempo de reação por t = √(2d/g)." },
      ],
    },
    "2-10": {
      text: String.raw`Muitas vezes conhecemos o movimento por um gráfico medido, e não por uma fórmula. As integrais da seção 2-8 têm então uma leitura geométrica direta: **área sob a curva**.

### Área sob a(t)
$$v_1 - v_0 = \int_{t_0}^{t_1} a\,dt = \text{área sob } a(t) \text{ entre } t_0 \text{ e } t_1 .$$
Áreas abaixo do eixo do tempo contam como negativas.

### Área sob v(t)
$$x_1 - x_0 = \int_{t_0}^{t_1} v\,dt = \text{área sob } v(t) .$$
Essa área dá o **deslocamento**. Para obter a distância percorrida, some os módulos das áreas acima e abaixo do eixo.

### Na prática
Gráficos reais costumam ser feitos de trechos retos; as áreas se reduzem a retângulos, triângulos e trapézios. Com dados experimentais em pontos discretos, a soma de trapézios é a forma numérica da integral.

**Exemplo.** Um elevador parte do repouso, acelera a 1,0 m/s² por 2 s, sobe com velocidade constante de 2 m/s por 10 s e freia a $-1{,}0$ m/s² por 2 s. No gráfico $v(t)$, temos um trapézio: área $= \tfrac12 \cdot 2 \cdot 2 + 2 \cdot 10 + \tfrac12 \cdot 2 \cdot 2 = 24$ m. O elevador subiu 24 m, cerca de oito andares.

### Recíproca
O caminho inverso é a derivada: inclinações de $x(t)$ dão $v(t)$, e inclinações de $v(t)$ dão $a(t)$. Saber passar de um gráfico a outro nos dois sentidos é uma das habilidades mais cobradas da cinemática.

**Armadilha:** ler a altura do gráfico $v(t)$ como se fosse a posição. O valor de $x$ está na **área** acumulada, não na altura da curva.

No experimento, desenhe uma aceleração por trechos e preveja, por áreas, a velocidade e a posição ao fim de cada trecho antes de rodar; depois confira no perfil acelera–cruzeiro–freia.`,
      experiments: [
        { kind: "sim", id: "cinematica-1d", scenario: "desenhar", note: "Desenhe a(t) por trechos e preveja v e x pelas áreas antes de rodar." },
        { kind: "sim", id: "cinematica-1d", scenario: "trajeto", note: "Calcule a distância total pela área do trapézio no gráfico v(t) e confira." },
      ],
    },
  },
};
