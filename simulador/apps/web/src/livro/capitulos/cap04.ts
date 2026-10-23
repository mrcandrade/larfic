import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 4,
  intro: String.raw`Uma bola chutada, um satélite, um barco que cruza um rio com correnteza: quase nenhum movimento real é retilíneo. Neste capítulo juntamos a cinemática do capítulo 2 com os vetores do capítulo 3. Posição, velocidade e aceleração passam a ser vetores, e o movimento se decompõe em movimentos retilíneos independentes ao longo de cada eixo. Dois casos ganham destaque: o **movimento balístico**, em que a gravidade age só na vertical, e o **movimento circular uniforme**, em que a aceleração aponta sempre para o centro. No fim, vemos como o mesmo movimento é descrito por observadores que se movem uns em relação aos outros.`,
  sections: {
    "4-2": {
      text: String.raw`No plano ou no espaço, a posição de uma partícula é dada pelo **vetor posição** $\vec r$, que vai da origem até a partícula:
$$\vec r = x\,\hat i + y\,\hat j + z\,\hat k .$$
As componentes $x$, $y$, $z$ são as coordenadas da partícula. À medida que ela se move, $\vec r$ muda, e a ponta da seta desenha a **trajetória**.

### Deslocamento
Se a posição passa de $\vec r_1$ para $\vec r_2$, o **deslocamento** é
$$\Delta\vec r = \vec r_2 - \vec r_1 = \Delta x\,\hat i + \Delta y\,\hat j + \Delta z\,\hat k .$$
Cada componente do deslocamento é a variação da coordenada correspondente, como no capítulo 2. O deslocamento independe da origem escolhida, embora os vetores posição dependam.

### Movimento como três movimentos retilíneos
Descrever $\vec r(t)$ é descrever, ao mesmo tempo, as funções $x(t)$, $y(t)$ e $z(t)$. Muitas vezes cada uma delas é simples, mesmo quando a trajetória é uma curva complicada.

**Exemplo.** Um drone parte de $\vec r_1 = (2\,\hat i - 3\,\hat j + 1\,\hat k)$ m e, 10 s depois, está em $\vec r_2 = (14\,\hat i + 2\,\hat j + 1\,\hat k)$ m. O deslocamento é $\Delta\vec r = (12\,\hat i + 5\,\hat j)$ m, de módulo 13 m, inteiramente horizontal, já que $z$ não mudou.

**Armadilha:** confundir o vetor posição com o deslocamento. A posição depende de onde está a origem; o deslocamento, não.

No experimento, lance um projétil no vácuo e acompanhe, ao longo da trajetória, as coordenadas $x(t)$ e $y(t)$: a curva no plano é feita de dois movimentos retilíneos simples.`,
      experiments: [
        { kind: "sim", id: "projetil-arrasto", scenario: "vacuo", note: "Acompanhe x(t) e y(t) do projétil e calcule o deslocamento entre dois instantes." },
        { kind: "sim", id: "vetores-3d", scenario: "soma", note: "Trate A e B como posições: a diferença B − A é o deslocamento, independente da origem." },
      ],
    },
    "4-3": {
      text: String.raw`### Velocidade média
$$\vec v_{\text{méd}} = \frac{\Delta\vec r}{\Delta t} .$$
Tem a direção do deslocamento, ou seja, da corda que liga as duas posições.

### Velocidade instantânea
Quando $\Delta t \to 0$, a corda tende à tangente à trajetória, e
$$\vec v = \frac{d\vec r}{dt} = \frac{dx}{dt}\,\hat i + \frac{dy}{dt}\,\hat j + \frac{dz}{dt}\,\hat k = v_x\,\hat i + v_y\,\hat j + v_z\,\hat k .$$
- A velocidade instantânea é sempre **tangente à trajetória** e aponta no sentido do movimento.
- Cada componente é a derivada da coordenada correspondente, como na seção 2-5.
- O módulo, $v = \sqrt{v_x^2 + v_y^2 + v_z^2}$, é a velocidade escalar.

**Exemplo.** Um carrinho de controle remoto tem posição $x = 2t^2$ e $y = 6t$ (metros, segundos). Então $v_x = 4t$ e $v_y = 6$. Em $t = 2$ s, $\vec v = (8\,\hat i + 6\,\hat j)$ m/s, com módulo 10 m/s, apontando 37° acima do eixo $x$. Entre $t = 0$ e $t = 2$ s, a velocidade média é $(8\,\hat i + 12\,\hat j)/2 = (4\,\hat i + 6\,\hat j)$ m/s: diferente da instantânea no fim do intervalo.

**Armadilha:** achar que a velocidade aponta para onde a partícula "vai chegar". Ela aponta para onde a partícula está indo **naquele instante**. Se a força que a mantém numa curva desaparecer, a partícula segue pela tangente, não pelo raio.

No experimento, observe a seta da velocidade na partícula em movimento circular: sempre tangente ao círculo. No projétil, veja as componentes $v_x$ (constante) e $v_y$ (variável) se combinarem numa seta que acompanha a curva.`,
      experiments: [
        { kind: "sim", id: "movimento-circular", scenario: "mcu", note: "Observe que a velocidade é sempre tangente ao círculo, perpendicular ao raio." },
        { kind: "sim", id: "projetil-arrasto", scenario: "vacuo", note: "Compare as componentes da velocidade: v_x fica constante e v_y diminui na subida." },
      ],
    },
    "4-4": {
      text: String.raw`### Aceleração média e instantânea
$$\vec a_{\text{méd}} = \frac{\Delta\vec v}{\Delta t}, \qquad \vec a = \frac{d\vec v}{dt} = a_x\,\hat i + a_y\,\hat j + a_z\,\hat k .$$
Como a velocidade é um vetor, ela muda quando muda o **módulo**, a **direção** ou ambos. Portanto, há aceleração numa curva mesmo que o velocímetro marque sempre o mesmo valor.

### Componentes tangencial e normal
É útil separar a aceleração em duas partes:
- a **tangencial**, paralela a $\vec v$, que muda o módulo da velocidade;
- a **normal** (ou centrípeta), perpendicular a $\vec v$, que muda a direção.

Se $\vec a$ faz ângulo agudo com $\vec v$, a partícula ganha rapidez; ângulo obtuso, perde; ângulo reto, a rapidez fica constante e só a direção muda.

**Exemplo.** Uma partícula tem $\vec v = (3t^2\,\hat i + 4\,\hat j)$ m/s. Sua aceleração é $\vec a = 6t\,\hat i$ m/s². Em $t = 1$ s, $\vec v = (3, 4)$ m/s e $\vec a = (6, 0)$ m/s². A componente de $\vec a$ ao longo de $\vec v$ é $\vec a\cdot\vec v/v = 18/5 = 3{,}6$ m/s² (tangencial), e a perpendicular vale $\sqrt{36 - 3{,}6^2} = 4{,}8$ m/s² (normal): a partícula acelera e faz curva ao mesmo tempo.

**Armadilha:** dizer que um corpo em movimento circular com rapidez constante "não tem aceleração". A direção da velocidade muda o tempo todo, então $\vec a \ne 0$.

No experimento, coloque a partícula em movimento circular partindo do repouso e veja as duas setas de aceleração: a tangencial, constante, e a centrípeta, que cresce com a rapidez. Mude $\alpha$ durante o movimento e observe só a tangencial responder.`,
      experiments: [
        { kind: "sim", id: "movimento-circular", scenario: "partida", note: "Separe a aceleração em tangencial e centrípeta enquanto a partícula ganha rapidez." },
        { kind: "concepcao", id: "mcu-sem-aceleracao", note: "Confronte a ideia de que rapidez constante significa aceleração nula." },
      ],
    },
    "4-5": {
      text: String.raw`Um **projétil** é um corpo lançado com velocidade inicial $\vec v_0$ que, depois, se move sob a ação apenas da gravidade (desprezamos o ar). Uma bola de basquete, um jato de água, um pacote solto de um avião são exemplos aproximados.

### A ideia central
A aceleração é $\vec a = -g\,\hat j$, constante e vertical. Por isso:
- **na horizontal**, não há aceleração: $v_x$ é constante e o movimento é uniforme;
- **na vertical**, a aceleração é $-g$: o movimento é a queda livre da seção 2-9.

Os dois movimentos são **independentes**: o que acontece na vertical não interfere no que acontece na horizontal, exceto por compartilharem o mesmo tempo $t$.

### Uma demonstração clássica
Se uma bola é solta e outra é lançada horizontalmente no mesmo instante e da mesma altura, as duas chegam ao chão juntas. O movimento horizontal da segunda não muda em nada a sua queda.

**Exemplo.** Uma bola rola para fora de uma mesa de 1,25 m de altura a 3,0 m/s. O tempo de queda depende só da altura: $t = \sqrt{2h/g} \approx 0{,}50$ s. Durante esse tempo ela anda $3{,}0 \cdot 0{,}50 = 1{,}5$ m na horizontal.

### Componentes iniciais
Para um lançamento com módulo $v_0$ e ângulo $\theta_0$ acima da horizontal:
$$v_{0x} = v_0\cos\theta_0, \qquad v_{0y} = v_0\sin\theta_0 .$$

**Armadilha:** imaginar uma força "para a frente" que mantém o projétil andando, ou que acaba no topo da trajetória. Depois do lançamento, a única força é o peso; a velocidade horizontal se mantém por inércia.

No experimento, lance no vácuo e confira que a velocidade horizontal não muda ao longo do voo; depois, faça o roteiro de lançamento horizontal e preveja o alcance a partir da altura da mesa.`,
      experiments: [
        { kind: "sim", id: "projetil-arrasto", scenario: "vacuo", params: { angulo: 0, h0: 1.25, v0: 3 }, note: "Lance horizontalmente de 1,25 m a 3 m/s e confira o tempo de queda de 0,5 s e o alcance de 1,5 m." },
        { kind: "pratica", id: "exp1-lancamento-horizontal", note: "Roteiro de bancada: lançamento horizontal e previsão do alcance." },
        { kind: "concepcao", id: "forca-no-topo", note: "Teste a ideia de uma força para a frente no topo da trajetória." },
      ],
    },
    "4-6": {
      text: String.raw`Aplicando as equações de aceleração constante a cada eixo, com origem no ponto de lançamento:
$$x = v_0\cos\theta_0\, t, \qquad y = v_0\sin\theta_0\, t - \tfrac12 g t^2 .$$
$$v_x = v_0\cos\theta_0, \qquad v_y = v_0\sin\theta_0 - g t .$$

### Trajetória
Eliminando $t$:
$$y = (\tan\theta_0)\,x - \frac{g\,x^2}{2(v_0\cos\theta_0)^2} ,$$
uma **parábola**.

### Altura máxima e alcance
No topo, $v_y = 0$, e a altura máxima é $H = (v_0\sin\theta_0)^2/(2g)$. Para lançamento e chegada na mesma altura, o **alcance horizontal** é
$$R = \frac{v_0^2}{g}\sin 2\theta_0 .$$
- O alcance é máximo para $\theta_0 = 45°$.
- Ângulos complementares (por exemplo, 30° e 60°) dão o mesmo alcance; o mais alto fica mais tempo no ar.

**Exemplo.** Um jato de mangueira sai a 15 m/s. A 45°, alcança $15^2/9{,}8 \approx 23$ m. A 30° ou a 60°, $23\sin 60° \approx 20$ m. A altura máxima a 60° é $(15\sin 60°)^2/19{,}6 \approx 8{,}6$ m; a 30°, só 2,9 m.

### O efeito do ar
A resistência do ar encurta o alcance, torna a trajetória assimétrica (a descida é mais íngreme) e desloca o ângulo de alcance máximo para menos de 45°. Para uma bola de futebol num chute longo, a diferença em relação à parábola ideal é grande.

**Armadilha:** usar a fórmula do alcance quando o ponto de chegada está em outra altura (por exemplo, um arremesso de cima de um prédio). Nesse caso, resolva $y(t)$ para o tempo de voo e depois calcule $x$.

No experimento, lance no vácuo com ângulos complementares e confirme o mesmo alcance; depois ligue o arrasto no chute de futebol e compare a trajetória com a parábola. Por fim, acerte o alvo do desafio.`,
      experiments: [
        { kind: "sim", id: "projetil-arrasto", scenario: "vacuo", params: { v0: 15, angulo: 30, h0: 0 }, note: "Lance a 15 m/s com 30° e depois com 60°: alcances iguais, alturas e tempos de voo diferentes." },
        { kind: "sim", id: "projetil-arrasto", scenario: "futebol", note: "Compare a trajetória real de um chute longo com a parábola do vácuo." },
        { kind: "desafio", id: "alvo-com-arrasto", note: "Escolha velocidade e ângulo para acertar o alvo levando em conta o ar." },
        { kind: "desafio", id: "barreira-com-arrasto", note: "Passe por cima da barreira e caia no alvo." },
      ],
    },
    "4-7": {
      text: String.raw`Uma partícula está em **movimento circular uniforme** (MCU) quando percorre um círculo (ou um arco) com rapidez constante. Embora a rapidez não mude, a direção da velocidade muda continuamente, e por isso **há aceleração** (seção 4-4).

### Aceleração centrípeta
Para uma partícula de rapidez $v$ num círculo de raio $r$, a aceleração aponta sempre para o **centro** e tem módulo
$$a = \frac{v^2}{r} .$$
Uma forma de ver isso: em um intervalo pequeno, o vetor velocidade gira de um ângulo $\Delta\theta = v\,\Delta t/r$, e a variação $\Delta\vec v$ tem módulo $v\,\Delta\theta$, apontando para o centro. Dividindo por $\Delta t$, obtemos $v^2/r$. Com os unitários polares da seção 3-5, $\vec a = -(v^2/r)\,\hat r$.

### Período
O tempo para uma volta completa é o **período**:
$$T = \frac{2\pi r}{v} .$$

**Exemplo.** Numa centrífuga de laboratório, um tubo gira a 15 cm do eixo, dando 6000 voltas por minuto (100 por segundo). Então $T = 0{,}01$ s, $v = 2\pi \cdot 0{,}15/0{,}01 \approx 94$ m/s e $a = 94^2/0{,}15 \approx 5{,}9\times10^4$ m/s², cerca de 6000 $g$. É isso que separa os componentes de uma amostra.

**Exemplo cotidiano.** Um carro que faz uma curva de 50 m de raio a 54 km/h (15 m/s) tem aceleração centrípeta de $4{,}5$ m/s², quase $0{,}5g$, mesmo com velocímetro constante. Quem fornece essa aceleração (atrito, normal, tração) é assunto da seção 6-5.

**Armadilha:** pensar que a aceleração aponta "para fora", porque é para fora que o passageiro se sente empurrado. No referencial do chão, a aceleração aponta para dentro; o passageiro só tende a seguir em linha reta.

No experimento, coloque a partícula em MCU, varie o raio e a velocidade angular e confira $a = v^2/r$ no painel; observe que a seta da aceleração aponta sempre para o centro.`,
      experiments: [
        { kind: "sim", id: "movimento-circular", scenario: "mcu", params: { modo: 0, r: 2, omega0: 3 }, note: "Com r = 2 m e ω = 3 rad/s, confira v = 6 m/s e a = v²/r = 18 m/s² apontando para o centro." },
        { kind: "concepcao", id: "forca-centrifuga", note: "Confronte a ideia de que o corpo em curva é empurrado para fora." },
        { kind: "concepcao", id: "mcu-sem-aceleracao" },
      ],
    },
    "4-8": {
      text: String.raw`A velocidade de uma partícula depende de **quem a observa**. Um ciclista visto da calçada anda a 20 km/h; visto de um ônibus que o ultrapassa, parece ir para trás.

### Composição de velocidades
Considere dois referenciais, A (por exemplo, o solo) e B (um vagão), em que B se move com velocidade constante $v_{BA}$ em relação a A ao longo de $x$. Se uma partícula P tem posições $x_{PA}$ e $x_{PB}$ medidas por A e por B,
$$x_{PA} = x_{PB} + x_{BA} .$$
Derivando no tempo,
$$v_{PA} = v_{PB} + v_{BA} .$$
A velocidade de P em relação a A é a de P em relação a B mais a de B em relação a A. Note a "regra dos índices": o índice interno ($B$) se cancela.

### Aceleração
Se $v_{BA}$ é constante, derivando de novo obtemos $a_{PA} = a_{PB}$: **observadores que se movem com velocidade constante uns em relação aos outros medem a mesma aceleração**. Esses são os referenciais inerciais, em que as leis de Newton valem (capítulo 5).

**Exemplo.** Num trem que anda a 25 m/s, um passageiro caminha para a frente a 1,5 m/s em relação ao vagão. Para quem está na plataforma, ele anda a 26,5 m/s. Se caminhar para trás, a 23,5 m/s. Para o passageiro, a plataforma se move a $-25$ m/s.

### Colisões vistas de outro referencial
Em colisões é comum analisar o movimento no referencial do **centro de massa**, que se move com velocidade constante: as contas ficam simétricas e o resultado é traduzido de volta somando a velocidade do centro de massa.

**Armadilha:** aplicar a regra a referenciais **acelerados**. Se B acelera, $a_{PA} \ne a_{PB}$ e aparecem acelerações que nenhum corpo explica (veja os referenciais não inerciais).

No experimento, acompanhe o passageiro que anda para trás num trem a 10 m/s e confira, nos dois referenciais, que $v_{PA} = v_{PB} + v_{BA}$ dá 8 m/s para a frente; depois acelere o trem e perceba que, aí, as acelerações deixam de coincidir.`,
      experiments: [
        { kind: "sim", id: "movimento-relativo", scenario: "trem", note: "Passageiro a −2 m/s no trem a 10 m/s: leia a velocidade no solo e no trem e confira u = u′ + V." },
        { kind: "sim", id: "colisoes", scenario: "cm", note: "Compare velocidades no laboratório e no centro de massa: diferem sempre pela velocidade do CM." },
        { kind: "sim", id: "movimento-relativo", scenario: "nao-inercial", note: "Veja que, com o referencial acelerando, as acelerações medidas deixam de coincidir." },
      ],
    },
    "4-9": {
      text: String.raw`Em duas ou três dimensões, a composição da seção 4-8 vale para os vetores:
$$\vec r_{PA} = \vec r_{PB} + \vec r_{BA}, \qquad \vec v_{PA} = \vec v_{PB} + \vec v_{BA} .$$
Se $\vec v_{BA}$ for constante, $\vec a_{PA} = \vec a_{PB}$.

### Barco e correnteza
Um barco mantém velocidade $\vec v_{Ba}$ em relação à água (índice a); a água corre com $\vec u$ em relação à margem. A velocidade em relação à margem é a soma vetorial $\vec v_{BM} = \vec v_{Ba} + \vec u$.
- Para **cruzar no menor tempo**, aponte o barco perpendicularmente às margens: o tempo é $L/v_{Ba}$, e a correnteza só desloca o ponto de chegada rio abaixo.
- Para **chegar bem em frente**, aponte rio acima de um ângulo $\theta$ com $\sin\theta = u/v_{Ba}$ (só possível se $u < v_{Ba}$); a travessia demora mais.

**Exemplo.** Rio de 120 m, barco a 4,0 m/s na água, correnteza de 2,0 m/s. Apontando reto: 30 s de travessia, chegando 60 m rio abaixo. Para chegar em frente: $\sin\theta = 0{,}5$, $\theta = 30°$; a componente útil é $4{,}0\cos 30° \approx 3{,}5$ m/s e a travessia leva cerca de 35 s.

### Avião e vento
O mesmo raciocínio vale para um avião: o rumo (para onde aponta o nariz) e a rota (para onde ele realmente vai em relação ao solo) diferem quando há vento lateral.

### Chuva vista do carro
Chuva que cai na vertical, vista de um carro em movimento, parece cair inclinada vindo da frente: a velocidade relativa é $\vec v_{\text{chuva}} - \vec v_{\text{carro}}$.

**Armadilha:** somar os módulos ($4 + 2 = 6$ m/s) em vez dos vetores.

No experimento, ajuste o rumo do barco para cruzar em frente e para cruzar no menor tempo e compare; depois corrija o rumo do avião contra o vento e veja a chuva se inclinar quando o carro acelera.`,
      experiments: [
        { kind: "sim", id: "movimento-relativo", scenario: "barco", params: { L: 120, vb: 4, u: 2, theta: 30 }, note: "Com rumo de 30° rio acima o barco chega bem em frente; compare com o rumo de 0°." },
        { kind: "sim", id: "movimento-relativo", scenario: "aviao", note: "Corrija o rumo do avião para compensar o vento lateral." },
        { kind: "sim", id: "movimento-relativo", scenario: "chuva", note: "Veja a inclinação aparente da chuva crescer com a velocidade do carro." },
      ],
    },
  },
};
