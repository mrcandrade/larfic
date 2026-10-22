import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 10,
  intro: String.raw`Rodas, turbinas, discos rígidos, a própria Terra: muitos movimentos importantes são **rotações** de um corpo rígido em torno de um eixo. Este capítulo constrói, para a rotação em torno de um eixo fixo, um paralelo completo com a mecânica da translação: posição, velocidade e aceleração **angulares**; as equações de aceleração angular constante; a ligação entre grandezas angulares e lineares. Em seguida aparece o papel da massa na rotação, o **momento de inércia**, que depende não só de quanta massa existe mas de como ela está distribuída em torno do eixo. Com o **torque**, a versão rotacional da força, chegamos à segunda lei de Newton para rotações e ao teorema do trabalho e energia para corpos que giram.`,
  sections: {
    "10-2": {
      text: String.raw`Um **corpo rígido** gira em torno de um **eixo fixo** quando todos os seus pontos descrevem círculos centrados nesse eixo. Para descrever o movimento basta uma única coordenada.

### Posição angular
Escolha uma reta de referência fixa no corpo, perpendicular ao eixo. A **posição angular** $\theta$ é o ângulo dessa reta em relação a uma direção fixa no espaço, medido em **radianos**: $\theta = s/r$, o comprimento de arco dividido pelo raio. Uma volta completa vale $2\pi$ rad = 360°. Positivo no sentido anti-horário, por convenção. O ângulo não é "zerado" a cada volta: depois de duas voltas, $\theta = 4\pi$ rad.

### Deslocamento, velocidade e aceleração angulares
$$\Delta\theta = \theta_2 - \theta_1, \qquad \omega = \frac{d\theta}{dt}, \qquad \alpha = \frac{d\omega}{dt} .$$
A unidade de $\omega$ é rad/s (frequentemente se usa rpm, rotações por minuto; $1$ rpm $= 2\pi/60$ rad/s); a de $\alpha$, rad/s². Como o corpo é rígido, **todos os pontos** têm os mesmos $\theta$, $\omega$ e $\alpha$: essas grandezas descrevem o corpo inteiro.

**Exemplo.** Um ventilador de teto parte do repouso e sua posição angular segue $\theta(t) = 0{,}6t^2$ rad nos primeiros 5 s. Então $\omega = 1{,}2t$ rad/s e $\alpha = 1{,}2$ rad/s² (constante). Em $t = 5$ s, $\omega = 6$ rad/s ≈ 57 rpm, e o ventilador já deu $15/(2\pi) \approx 2{,}4$ voltas.

### Analogia com a translação
$\theta \leftrightarrow x$, $\omega \leftrightarrow v$, $\alpha \leftrightarrow a$. Tudo o que vimos no capítulo 2 sobre gráficos, derivadas e áreas vale aqui com essa troca.

**Armadilha:** fazer contas com graus nas fórmulas de cinemática angular. As relações como $s = r\theta$ só valem com ângulos em radianos.

No experimento, coloque a partícula em MCU e depois em MCUV partindo do repouso e leia os gráficos $\theta(t)$ e $\omega(t)$: inclinação de um é o valor do outro.`,
      experiments: [
        { kind: "sim", id: "movimento-circular", scenario: "mcu", note: "Leia θ(t) e ω(t) em rotação uniforme: θ cresce linearmente e ω é constante." },
        { kind: "sim", id: "movimento-circular", scenario: "partida", note: "Partindo do repouso com α constante: θ(t) parabólico e ω(t) linear." },
      ],
    },
    "10-3": {
      text: String.raw`Na rotação em torno de um eixo fixo, o sinal (horário ou anti-horário) basta. Mas, em problemas tridimensionais, convém tratar a velocidade e a aceleração angulares como **vetores**.

### A regra da mão direita
O vetor $\vec\omega$ aponta **ao longo do eixo de rotação**. Para saber o sentido, curve os dedos da mão direita no sentido da rotação: o polegar dá o sentido de $\vec\omega$. Um disco girando no sentido anti-horário, visto de cima, tem $\vec\omega$ para cima. Note que nada se move na direção do vetor: ele indica o eixo e o sentido do giro, e seu módulo é a rapidez. Se a rotação acelera, $\vec\alpha$ tem o sentido de $\vec\omega$; se freia, o sentido oposto.

### Deslocamentos angulares não são vetores
Para ser vetor, uma grandeza precisa somar-se de forma comutativa. Deslocamentos angulares **grandes** não passam nesse teste. Pegue um livro sobre a mesa, gire-o 90° em torno de um eixo $x$ e depois 90° em torno de $y$; volte e faça na ordem inversa. A orientação final é diferente. Por isso $\Delta\vec\theta$ finito não é vetor. Já rotações **infinitesimais** comutam, e por isso $\vec\omega = d\vec\theta/dt$ é um vetor legítimo.

**Exemplo.** Um disco de vinil a 33⅓ rpm, girando no sentido horário visto de cima, tem $\omega = 33{,}3 \cdot 2\pi/60 \approx 3{,}5$ rad/s e $\vec\omega$ apontando **para baixo**. A roda dianteira de uma bicicleta que se move para a frente (para leste) tem $\vec\omega$ horizontal, apontando para o norte (para a esquerda do ciclista).

### Para onde isso leva
Vetores angulares serão essenciais no capítulo 11, com o produto vetorial $\vec\tau = \vec r \times \vec F$, o momento angular e a precessão de giroscópios.

**Armadilha:** esperar que um ponto do corpo se mova na direção de $\vec\omega$.

No experimento, use o produto vetorial com a mão direita animada: escolha dois vetores no plano horizontal e veja o resultado apontar ao longo do eixo perpendicular, como $\vec\omega$ numa rotação.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "vetorial", note: "Veja a regra da mão direita: o vetor resultante aponta ao longo do eixo perpendicular ao plano." },
        { kind: "sim", id: "momento-angular", scenario: "inverter", note: "Os vetores ω da roda e da cadeira aparecem em 3D, ao longo dos eixos de rotação." },
      ],
    },
    "10-4": {
      text: String.raw`Quando a aceleração angular é constante, as equações da cinemática angular são cópias das de aceleração linear constante (seção 2-4), com $x \to \theta$, $v \to \omega$, $a \to \alpha$:
$$\omega = \omega_0 + \alpha t$$
$$\theta - \theta_0 = \omega_0 t + \tfrac12 \alpha t^2$$
$$\omega^2 = \omega_0^2 + 2\alpha(\theta - \theta_0)$$
$$\theta - \theta_0 = \tfrac12(\omega_0 + \omega)t$$
$$\theta - \theta_0 = \omega t - \tfrac12 \alpha t^2$$
Cada equação deixa de fora uma das cinco grandezas ($\theta - \theta_0$, $\omega_0$, $\omega$, $\alpha$, $t$); escolha a que não contém a incógnita que você não conhece nem precisa.

**Exemplo.** O tambor de uma máquina de lavar gira a 1000 rpm (≈ 105 rad/s) e, ao desligar, para em 12 s com desaceleração constante. Aceleração angular: $\alpha = (0 - 105)/12 \approx -8{,}7$ rad/s². Ângulo percorrido: $\tfrac12(105 + 0) \cdot 12 \approx 630$ rad, ou cerca de 100 voltas.

### Inversão do sentido
Se a aceleração angular é oposta à velocidade e continua agindo depois que $\omega$ chega a zero, o corpo para e passa a girar no sentido contrário, como uma bola lançada para cima que para e volta. Nesse caso $\theta(t)$ é uma parábola com vértice no instante em que $\omega = 0$.

**Armadilha:** usar essas equações quando $\alpha$ varia (um motor que acelera cada vez menos, por exemplo). Aí é preciso integrar $\alpha(t)$.

No experimento, escolha $\omega_0$ e um $\alpha$ de sinal oposto e preveja o instante em que a partícula para e inverte o sentido; confira no gráfico $\omega(t)$.`,
      experiments: [
        { kind: "sim", id: "movimento-circular", scenario: "frenagem", note: "Preveja quando a partícula para e inverte o sentido; confira no gráfico ω(t)." },
        { kind: "sim", id: "movimento-circular", scenario: "partida", note: "Partida com α constante: compare θ e ω medidos com as equações." },
      ],
    },
    "10-5": {
      text: String.raw`Todos os pontos de um corpo rígido têm o mesmo $\omega$, mas pontos mais afastados do eixo percorrem círculos maiores e, portanto, andam mais depressa.

### Posição e velocidade
Um ponto a uma distância $r$ do eixo percorre o arco $s = \theta r$ (com $\theta$ em radianos). Derivando:
$$v = \omega r .$$
A velocidade é tangente ao círculo. O período de uma volta é $T = 2\pi r/v = 2\pi/\omega$.

### Aceleração
A aceleração de um ponto tem duas componentes perpendiculares:
- **tangencial**, ligada à mudança da rapidez: $a_t = \alpha r$;
- **radial (centrípeta)**, ligada à mudança de direção: $a_r = \dfrac{v^2}{r} = \omega^2 r$.

O módulo é $a = \sqrt{a_t^2 + a_r^2}$. Num MCU, $\alpha = 0$ e só existe a componente centrípeta; mas ela existe, embora a rapidez seja constante.

**Exemplo.** Um esmeril de 15 cm de raio acelera de 0 a 3600 rpm (377 rad/s) em 4 s. Na borda: $a_t = (377/4) \cdot 0{,}15 \approx 14$ m/s². No fim, $v = 377 \cdot 0{,}15 \approx 57$ m/s e $a_r = 377^2 \cdot 0{,}15 \approx 2{,}1\times10^{4}$ m/s², mais de 2000 vezes $g$. É por isso que discos abrasivos têm velocidade máxima de segurança.

### Correias e engrenagens
Duas polias ligadas por uma correia que não desliza têm a mesma velocidade **linear** na borda: $\omega_1 r_1 = \omega_2 r_2$. A polia menor gira mais rápido.

**Armadilha:** achar que, em movimento circular com rapidez constante, a aceleração é zero.

No experimento, mude $\alpha$ ao vivo e observe as setas da aceleração: a tangencial aparece só quando $\alpha \ne 0$, e a centrípeta cresce com $\omega^2$.`,
      experiments: [
        { kind: "sim", id: "movimento-circular", scenario: "ao-vivo", note: "Mude α ao vivo e veja as componentes tangencial (αr) e centrípeta (ω²r) da aceleração." },
        { kind: "concepcao", id: "mcu-sem-aceleracao", note: "Em MCU a rapidez é constante, mas a aceleração centrípeta não é nula." },
      ],
    },
    "10-6": {
      text: String.raw`Um corpo rígido que gira tem energia cinética, mesmo que seu centro de massa esteja parado. Não podemos usar $\tfrac12 M v^2$ com uma só velocidade, porque cada ponto tem a sua. Somamos as contribuições de todas as partículas, usando $v_i = \omega r_i$:
$$K = \sum \tfrac12 m_i (\omega r_i)^2 = \tfrac12 \Big(\sum m_i r_i^2\Big)\omega^2 .$$
A grandeza entre parênteses é o **momento de inércia** em relação ao eixo de rotação:
$$I = \sum m_i r_i^2, \qquad K = \tfrac12 I\omega^2 .$$

### O que é o momento de inércia
- Faz, na rotação, o papel da massa: mede a "resistência" a mudar a velocidade angular.
- Depende de **como a massa está distribuída em relação ao eixo**: a massa longe do eixo conta muito mais (peso $r^2$).
- O mesmo corpo tem momentos de inércia diferentes para eixos diferentes. Unidade: kg·m².

**Exemplo.** Uma haste leve de 1,0 m com duas esferas de 0,5 kg nas pontas, girando em torno do centro: $I = 2 \cdot 0{,}5 \cdot 0{,}5^2 = 0{,}25$ kg·m². Em torno de uma das pontas: $I = 0{,}5 \cdot 1{,}0^2 = 0{,}5$ kg·m², o dobro, com a mesma massa. Girando a 10 rad/s, a energia cinética é 12,5 J ou 25 J.

### Volantes de inércia
Volantes armazenam energia cinética de rotação e a devolvem quando necessário (motores, sistemas de recuperação de frenagem, alguns nobreaks). Para guardar muita energia com pouca massa, a massa fica na borda e $\omega$ é alta.

**Armadilha:** achar que dois corpos de mesma massa, girando com o mesmo $\omega$, têm a mesma energia. Um anel e um disco de mesma massa e raio diferem por um fator 2.

No experimento, compare anel, disco e barra com a mesma massa e o mesmo torque; depois, na roda de Maxwell, acompanhe como a energia potencial se divide entre translação e rotação.`,
      experiments: [
        { kind: "sim", id: "rotacao-torque", scenario: "formas", note: "Mesmo torque e mesma massa: anel, disco e barra ganham velocidade angular e energia de modos diferentes." },
        { kind: "sim", id: "roda-maxwell", scenario: "energia", note: "Veja a energia potencial se dividir entre energia de translação e de rotação." },
      ],
    },
    "10-7": {
      text: String.raw`Para um corpo contínuo, a soma sobre partículas vira uma integral:
$$I = \int r^2\,dm ,$$
em que $r$ é a distância perpendicular de cada elemento de massa ao eixo.

### Resultados úteis (eixo pelo centro de massa)
- Anel fino ou casca cilíndrica, eixo central: $I = MR^2$.
- Disco ou cilindro maciço, eixo central: $I = \tfrac12 MR^2$.
- Barra fina de comprimento $L$, eixo perpendicular pelo centro: $I = \tfrac{1}{12}ML^2$.
- Esfera maciça: $I = \tfrac25 MR^2$; casca esférica fina: $I = \tfrac23 MR^2$.
- Placa retangular $a \times b$, eixo perpendicular pelo centro: $I = \tfrac{1}{12}M(a^2 + b^2)$.

### Teorema dos eixos paralelos
Se $I_{CM}$ é o momento de inércia em relação a um eixo pelo CM, então, para um eixo paralelo a uma distância $h$,
$$I = I_{CM} + M h^2 .$$
O menor momento de inércia, entre todos os eixos de uma mesma direção, é o que passa pelo CM.

**Exemplo.** Barra de 1,2 m e 0,8 kg. Pelo centro: $I = 0{,}8 \cdot 1{,}44/12 \approx 0{,}096$ kg·m². Por uma ponta ($h = 0{,}6$ m): $0{,}096 + 0{,}8 \cdot 0{,}36 = 0{,}384$ kg·m², igual a $\tfrac13 ML^2$, como confirma a integral direta $\int_0^L x^2 (M/L)\,dx$.

### Medida experimental
Em formas irregulares, $I$ é medido: aplica-se um torque conhecido e mede-se $\alpha$ (seção 10-9), ou mede-se o período de oscilação, ou a aceleração de descida de uma roda de Maxwell.

**Armadilha:** usar no teorema dos eixos paralelos um eixo de referência que não passa pelo CM; a fórmula exige $I_{CM}$.

No experimento, arraste o eixo pelo corpo e confira $I = I_{CM} + Md^2$; depois cronometre a descida da roda de Maxwell para obter seu momento de inércia.`,
      experiments: [
        { kind: "sim", id: "rotacao-torque", scenario: "eixos", note: "Arraste o eixo para longe do CM e confira I = I_CM + Md²." },
        { kind: "sim", id: "roda-maxwell", scenario: "medir-I", note: "Cronometre a descida da roda e obtenha seu momento de inércia." },
        { kind: "pratica", id: "exp1-maxwell", note: "Roteiro de bancada para medir o momento de inércia com a roda de Maxwell." },
      ],
    },
    "10-8": {
      text: String.raw`Para abrir uma porta você empurra longe das dobradiças e perpendicularmente à porta; empurrar perto do eixo, ou na direção da própria porta, não adianta. A grandeza que mede a capacidade de uma força de produzir rotação é o **torque**.

### Definição
Para uma força $\vec F$ aplicada num ponto à distância $r$ do eixo, com $\phi$ o ângulo entre o vetor posição $\vec r$ (a partir do eixo) e $\vec F$:
$$\tau = rF\sin\phi .$$
Há duas leituras equivalentes:
- $\tau = r F_t$, em que $F_t = F\sin\phi$ é a componente tangencial da força (a radial não gira nada);
- $\tau = r_\perp F$, em que $r_\perp = r\sin\phi$ é o **braço de alavanca**, a distância do eixo à linha de ação da força.

Unidade: N·m (não se usa joule para torque, embora a dimensão seja a mesma). Sinal: positivo se tende a girar no sentido anti-horário. O torque resultante é a soma dos torques individuais.

**Exemplo.** Uma chave de roda de 35 cm é empurrada na ponta com 250 N, perpendicularmente ao cabo: $\tau = 0{,}35 \cdot 250 \approx 88$ N·m. Se o empurrão fizer 60° com o cabo, o torque cai para $88 \sin 60° \approx 76$ N·m. Um cano de 70 cm encaixado no cabo dobra o torque com a mesma força.

### Alavancas
Em equilíbrio, os torques em torno do apoio se anulam: $F_1 d_1 = F_2 d_2$. Uma força pequena com braço grande equilibra uma força grande com braço pequeno.

**Armadilha:** multiplicar a força pela distância ao eixo sem considerar o ângulo; uma força cuja linha de ação passa pelo eixo produz torque zero, por maior que seja.

No experimento, aplique uma força tangencial ao disco e compare com a massa pendurada no carretel; depois, nas alavancas, ache a posição do apoio que equilibra a carga.`,
      experiments: [
        { kind: "sim", id: "rotacao-torque", scenario: "massa", note: "A tração no fio age com braço igual ao raio do carretel: calcule o torque e veja o disco acelerar." },
        { kind: "sim", id: "maquinas-simples", scenario: "alavanca", note: "Equilibre a carga na alavanca igualando os torques em torno do apoio." },
        { kind: "sim", id: "equilibrio-corpos", note: "Arraste cargas e apoios e veja a soma dos torques se anular no equilíbrio." },
      ],
    },
    "10-9": {
      text: String.raw`Para uma partícula presa a uma haste leve que gira em torno de um eixo, a força tangencial dá $F_t = m a_t = m r\alpha$; multiplicando por $r$, $\tau = (mr^2)\alpha$. Somando sobre todas as partículas de um corpo rígido:
$$\tau_{\text{res}} = I\alpha .$$
É a **segunda lei de Newton para rotações** em torno de um eixo fixo: torque resultante faz o papel de força, momento de inércia o de massa, aceleração angular o de aceleração. As forças internas entram aos pares e seus torques se cancelam, de modo que só os torques **externos** importam.

### Problemas com fio e polia
Quando um fio enrolado numa polia com massa sustenta um bloco, montamos um sistema:
- bloco: $mg - T = ma$;
- polia de raio $R$: $TR = I\alpha$;
- fio que não desliza: $a = \alpha R$.

Resultado: $a = \dfrac{g}{1 + I/(mR^2)}$. A polia com massa reduz a aceleração e faz a tração ficar menor que o peso. Numa máquina de Atwood com polia pesada, as trações nos dois lados passam a ser diferentes, e é essa diferença que gera o torque que acelera a polia.

**Exemplo.** Um balde de 4 kg pende de uma corda enrolada num sarilho cilíndrico maciço de 12 kg e raio 0,15 m ($I = 0{,}135$ kg·m²). Então $I/(mR^2) = 0{,}135/0{,}09 = 1{,}5$ e $a = 9{,}8/2{,}5 \approx 3{,}9$ m/s²; a tração vale $4(9{,}8 - 3{,}9) \approx 24$ N, e não 39 N.

**Armadilha:** supor tração igual dos dois lados de uma polia com massa, ou igualar a tração ao peso do bloco que acelera.

No experimento, pendure massas diferentes no carretel, meça $\alpha$ e faça o gráfico de $\tau$ contra $\alpha$: a inclinação é $I$. Na Atwood, ligue a massa da polia e compare as duas trações.`,
      experiments: [
        { kind: "sim", id: "rotacao-torque", scenario: "massa", note: "Meça α para várias massas penduradas e obtenha I pela inclinação do gráfico τ × α." },
        { kind: "sim", id: "atwood", scenario: "polia", note: "Com a polia pesada, as trações dos dois lados ficam diferentes; compare com a polia leve." },
        { kind: "pratica", id: "exp1-rotacao", note: "Roteiro de bancada de dinâmica de rotação: torque e momento de inércia." },
      ],
    },
    "10-10": {
      text: String.raw`O paralelo com a translação se completa com o trabalho e a energia.

### Trabalho de um torque
Uma força tangencial $F_t$ que age enquanto o ponto de aplicação percorre um arco $ds = r\,d\theta$ realiza o trabalho $dW = F_t r\,d\theta = \tau\,d\theta$. Então
$$W = \int_{\theta_i}^{\theta_f} \tau\,d\theta ,$$
que, para torque constante, vale $W = \tau(\theta_f - \theta_i)$.

### Teorema do trabalho e energia cinética de rotação
$$\Delta K = \tfrac12 I\omega_f^2 - \tfrac12 I\omega_i^2 = W .$$

### Potência
$$P = \frac{dW}{dt} = \tau\omega .$$
Essa relação explica as curvas de motores: um motor de potência fixa entrega muito torque em baixa rotação e pouco torque em alta. O câmbio troca rotação por torque, mantendo (idealmente) a potência.

### Quadro de correspondências
- $x$, $v$, $a$ correspondem a $\theta$, $\omega$, $\alpha$;
- a massa $m$ corresponde ao momento de inércia $I$;
- $F = ma$ corresponde a $\tau = I\alpha$;
- $W = \int F\,dx$ corresponde a $W = \int \tau\,d\theta$;
- $K = \tfrac12 mv^2$ corresponde a $K = \tfrac12 I\omega^2$;
- $P = Fv$ corresponde a $P = \tau\omega$.

**Exemplo.** Um motor elétrico de 1,5 kW a 1750 rpm (183 rad/s) entrega torque de $1500/183 \approx 8{,}2$ N·m. Uma redução 10:1 leva o eixo de saída a 175 rpm com cerca de 82 N·m (menos as perdas). Se um torque de atrito de 0,5 N·m freia um volante de $I = 2$ kg·m² que gira a 30 rad/s, ele para depois de $\tfrac12 \cdot 2 \cdot 900/0{,}5 = 1800$ rad, cerca de 290 voltas.

**Armadilha:** esquecer que o trabalho do torque de atrito é negativo e vira energia térmica no eixo.

No experimento, gire o disco com um torque de atrito no eixo, desligue o torque aplicado e verifique que a energia cinética de rotação diminui exatamente o trabalho do atrito, $\tau_a\,\Delta\theta$.`,
      experiments: [
        { kind: "sim", id: "rotacao-torque", scenario: "atrito", note: "Compare a perda de energia cinética de rotação com o trabalho do torque de atrito τ·Δθ." },
        { kind: "sim", id: "roda-maxwell", scenario: "energia", note: "O trabalho da gravidade vira energia cinética de translação e de rotação da roda." },
      ],
    },
  },
};
