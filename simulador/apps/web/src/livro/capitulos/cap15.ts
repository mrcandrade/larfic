import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 15,
  intro: String.raw`Um relógio de pêndulo, a suspensão de um carro, o cristal de quartzo de um celular, os átomos de um sólido e um prédio balançando num terremoto têm o mesmo comportamento básico: quando afastados do equilíbrio, voltam, passam do ponto e repetem o movimento. Este capítulo estuda essas **oscilações**. O caso modelo é o **movimento harmônico simples**, produzido por uma força restauradora proporcional ao deslocamento, cuja solução é uma senoide com período independente da amplitude. A partir dele vêm a energia do oscilador, o pêndulo de torção, os pêndulos simples e físico, a ligação com o movimento circular, o efeito do amortecimento e, por fim, a **ressonância**, que explica tanto o funcionamento de um rádio quanto a queda de uma ponte.`,
  sections: {
    "15-2": {
      text: String.raw`Um movimento que se repete em intervalos regulares é **periódico**. O tempo de uma repetição completa é o **período** $T$, e o número de repetições por segundo é a **frequência**
$$f = \frac{1}{T},$$
medida em hertz (1 Hz = 1 oscilação por segundo).

### O deslocamento
No **movimento harmônico simples** (MHS), o deslocamento em relação ao equilíbrio é uma função senoidal do tempo:
$$x(t) = x_m \cos(\omega t + \phi) .$$
- $x_m$ é a **amplitude**, o deslocamento máximo;
- $\omega$ é a **frequência angular**, em rad/s, com $\omega = 2\pi f = 2\pi/T$;
- $\phi$ é a **constante de fase**, que fixa onde o movimento está em $t = 0$; o argumento $\omega t + \phi$ é a **fase**.

### Velocidade e aceleração
Derivando:
$$v(t) = -\omega x_m \sin(\omega t + \phi), \qquad a(t) = -\omega^2 x_m \cos(\omega t + \phi) = -\omega^2 x(t) .$$
A velocidade máxima é $\omega x_m$, no centro; a aceleração máxima é $\omega^2 x_m$, nos extremos. A relação $a = -\omega^2 x$ é a assinatura do MHS: aceleração proporcional ao deslocamento e de sentido oposto.

**Exemplo.** Um alto-falante vibra a 440 Hz com amplitude de 0,20 mm. Então $\omega = 2\pi \cdot 440 \approx 2760$ rad/s, a velocidade máxima do cone é $2760 \cdot 2\times10^{-4} \approx 0{,}55$ m/s e a aceleração máxima, $2760^2 \cdot 2\times10^{-4} \approx 1{,}5\times10^{3}$ m/s², umas 150 vezes $g$.

**Armadilha:** pensar que, onde a velocidade é zero (nos extremos), a aceleração também é. É exatamente ali que a aceleração é máxima.

No experimento, gire o fasor e veja sua projeção desenhar $x(t)$; mude a fase inicial para 90° e compare as curvas de $x$, $v$ e $a$, defasadas de um quarto de período.`,
      experiments: [
        { kind: "sim", id: "mhs", scenario: "circulo", note: "Acompanhe x(t), v(t) e a(t) e identifique amplitude, período e fase." },
        { kind: "sim", id: "mhs", scenario: "fase", note: "Com φ = 90°, veja onde o oscilador está em t = 0 e como as três curvas se defasam." },
        { kind: "concepcao", id: "velocidade-zero-aceleracao-zero", note: "Confronte a ideia de que velocidade nula implica aceleração nula, nos extremos da oscilação." },
      ],
    },
    "15-3": {
      text: String.raw`Combinando $a = -\omega^2 x$ com a segunda lei de Newton, a força sobre um corpo em MHS é
$$F = m a = -(m\omega^2)\, x .$$
Uma força restauradora proporcional ao deslocamento é justamente a da lei de Hooke, $F = -kx$ (seção 7-7). Logo, **um bloco preso a uma mola ideal executa MHS**, com
$$\omega = \sqrt{\frac{k}{m}}, \qquad T = 2\pi\sqrt{\frac{m}{k}} .$$
Esse sistema é o **oscilador harmônico linear simples**.

### O que o período não depende
- O período **não depende da amplitude**: puxar mais a mola aumenta a força na mesma proporção.
- A gravidade não altera o período de uma mola vertical: ela só desloca a posição de equilíbrio para $y_0 = mg/k$, e as oscilações ocorrem em torno dela.
A amplitude e a fase são fixadas pelas condições iniciais (posição e velocidade em $t = 0$).

**Exemplo.** Uma massa de 0,25 kg presa a uma mola de 40 N/m: $\omega = \sqrt{160} \approx 12{,}6$ rad/s, $T \approx 0{,}50$ s. Quadruplicando a massa (1,0 kg), o período dobra para 1,0 s. Pendurada na vertical, a mola estica $0{,}25 \cdot 9{,}8/40 \approx 6{,}1$ cm até o novo equilíbrio, e o período continua 0,50 s.

### Massa da mola
Uma mola real tem massa $m_s$; uma análise mais cuidadosa mostra que ela entra como se cerca de um terço dela estivesse no bloco: $T \approx 2\pi\sqrt{(m + m_s/3)/k}$.

**Armadilha:** achar que uma oscilação de amplitude maior demora mais. Para uma mola ideal, o período é o mesmo; o corpo percorre mais caminho, mas mais depressa.

No experimento, pendure massas diferentes na mola, cronometre dez oscilações e faça o gráfico de $T^2$ contra $m$: a inclinação dá $4\pi^2/k$. Compare com o $k$ obtido pela deformação estática.`,
      experiments: [
        { kind: "sim", id: "lei-hooke", scenario: "periodo", note: "Meça o período para várias massas e obtenha k pelo gráfico de T² contra m." },
        { kind: "sim", id: "massa-mola", scenario: "livre", params: { k: 40, m: 0.25, x0: 0.2, v0: 0 }, note: "Com k = 40 N/m e m = 0,25 kg, confira T ≈ 0,50 s; depois dobre x₀ e veja o período não mudar." },
        { kind: "sim", id: "mhs", scenario: "comparacao", note: "Compare a mola vertical com um pêndulo de mesma frequência." },
      ],
    },
    "15-4": {
      text: String.raw`Sem atrito, a energia mecânica do oscilador bloco-mola se conserva e passa continuamente de potencial a cinética e de volta. Com $x = x_m\cos(\omega t + \phi)$:
$$U = \tfrac12 k x^2 = \tfrac12 k x_m^2 \cos^2(\omega t + \phi),$$
$$K = \tfrac12 m v^2 = \tfrac12 k x_m^2 \sin^2(\omega t + \phi),$$
usando $m\omega^2 = k$. Somando,
$$E = K + U = \tfrac12 k x_m^2 ,$$
constante e proporcional ao **quadrado da amplitude**.

### Leitura do gráfico de energia
No gráfico $U(x)$, a parábola $\tfrac12 kx^2$ e a reta horizontal $E$ se cruzam nos pontos de retorno $\pm x_m$. Em cada posição, $K$ é a distância vertical entre a reta e a parábola. A energia passa duas vezes por período de uma forma a outra; $K$ e $U$ oscilam com o dobro da frequência do movimento, e cada uma vale em média $E/2$.

**Exemplo.** Uma mola de 200 N/m com bloco de 0,50 kg, solta a 6,0 cm do equilíbrio: $E = \tfrac12 \cdot 200 \cdot 0{,}06^2 = 0{,}36$ J. A velocidade máxima sai de $\tfrac12 m v_m^2 = E$: $v_m = 1{,}2$ m/s. Em $x = 3{,}0$ cm, $U = 0{,}09$ J e $K = 0{,}27$ J: na metade da amplitude, três quartos da energia já são cinéticos.

**Armadilha:** supor que, na metade do caminho, a energia está dividida meio a meio. O ponto de $K = U$ está em $x = x_m/\sqrt2 \approx 0{,}71\,x_m$.

No experimento, observe as barras de energia cinética e potencial trocarem de valor enquanto a soma fica constante; depois ligue o atrito e veja a energia total escoar para energia térmica a cada ciclo.`,
      experiments: [
        { kind: "sim", id: "massa-mola", scenario: "livre", params: { k: 200, m: 0.5, x0: 0.06, v0: 0 }, note: "Confira E = ½kx_m² = 0,36 J e encontre a posição em que K = U." },
        { kind: "sim", id: "massa-mola", scenario: "atrito", note: "Ligue o atrito e veja a energia mecânica cair a cada oscilação." },
        { kind: "sim", id: "montanha-russa", scenario: "meia-pipe", note: "Compare com outro poço de potencial: a meia-pipe também troca K e U, com pontos de retorno." },
      ],
    },
    "15-5": {
      text: String.raw`Um disco pendurado por um fio, preso pelo centro, pode girar em torno do eixo do fio. Ao torcê-lo de um ângulo $\theta$, o fio reage com um **torque restaurador** proporcional à torção:
$$\tau = -\kappa\, \theta ,$$
em que $\kappa$ (kapa, em N·m/rad) é a **constante de torção** do fio. É a versão angular da lei de Hooke. Pela segunda lei para a rotação, $\tau = I\alpha$, e então $\alpha = -(\kappa/I)\theta$: o ângulo executa MHS com
$$\omega = \sqrt{\frac{\kappa}{I}}, \qquad T = 2\pi\sqrt{\frac{I}{\kappa}} .$$
Esse é o **pêndulo de torção**, um oscilador harmônico angular simples. Diferentemente do pêndulo comum, ele permanece harmônico para torções grandes, enquanto o fio obedecer à lei linear.

### Para que serve
- **Medir momentos de inércia:** com um corpo de $I$ conhecido calibra-se $\kappa$; trocando pelo corpo desconhecido, $I_x = I_{\text{ref}}\,(T_x/T_{\text{ref}})^2$.
- **Medir torques minúsculos:** um fio muito fino tem $\kappa$ pequeno, e torques ínfimos produzem ângulos mensuráveis. É o princípio da balança de Cavendish (seção 13-2) e da balança de Coulomb.
- **Relógios:** a roda de balanço de um relógio mecânico é um oscilador de torção com mola espiral.

**Exemplo.** Uma barra com $I = 2{,}0\times10^{-3}$ kg·m² pendurada num fio oscila com período 4,0 s; logo $\kappa = 4\pi^2 I/T^2 \approx 4{,}9\times10^{-3}$ N·m/rad. Trocando a barra por um disco, o período passa a 6,0 s: $I_{\text{disco}} = 2{,}0\times10^{-3}\,(6/4)^2 = 4{,}5\times10^{-3}$ kg·m².

**Armadilha:** usar $\kappa$ e $k$ indistintamente. $k$ (N/m) relaciona força e deslocamento linear; $\kappa$ (N·m/rad) relaciona torque e ângulo.

No experimento, troque o diâmetro e o material do fio e meça o período; afaste as massas da barra (maior $I$) e veja $T$ crescer com $\sqrt I$.`,
      experiments: [
        { kind: "sim", id: "pendulos-especiais", scenario: "torcao", note: "Varie a distância das massas e o diâmetro do fio e relacione T com I e κ." },
        { kind: "pratica", id: "exp1-pendulo-torcao", note: "Roteiro de bancada para medir momento de inércia com o pêndulo de torção." },
        { kind: "sim", id: "cavendish", scenario: "cavendish", note: "Veja o pêndulo de torção como instrumento: o período da balança de Cavendish dá a constante do fio." },
      ],
    },
    "15-6": {
      text: String.raw`### Pêndulo simples
Uma partícula de massa $m$ presa a um fio leve de comprimento $L$, afastada de um ângulo $\theta$, sofre um torque restaurador da gravidade em torno do ponto de suspensão: $\tau = -L\, mg \sin\theta$. Para ângulos pequenos, $\sin\theta \approx \theta$ (em radianos), e
$$\tau \approx -(mgL)\,\theta .$$
Comparando com o oscilador angular (seção 15-5), com $I = mL^2$:
$$T = 2\pi\sqrt{\frac{L}{g}} .$$
O período **não depende da massa** nem, para pequenas amplitudes, da amplitude. Para amplitudes grandes a aproximação falha e o período cresce: cerca de 1% a mais em 23°, 7% em 60°.

### Pêndulo físico
Um corpo rígido qualquer, suspenso por um ponto $O$ que não é o centro de massa, também oscila. Se $h$ é a distância de $O$ ao centro de massa e $I$ o momento de inércia em torno de $O$:
$$T = 2\pi\sqrt{\frac{I}{m g h}} .$$
O ponto a uma distância $L_0 = I/(mh)$ de $O$ é o **centro de oscilação**: um pêndulo simples desse comprimento teria o mesmo período.

### Medindo g
Como $g = 4\pi^2 L/T^2$, um pêndulo é um medidor de $g$: cronometrando muitas oscilações e variando $L$, a inclinação de $T^2$ contra $L$ dá $4\pi^2/g$.

**Exemplo.** Um pêndulo de 0,80 m: $T = 2\pi\sqrt{0{,}80/9{,}8} \approx 1{,}80$ s. Uma régua de 1,00 m suspensa por uma ponta ($I = mL^2/3$, $h = L/2$) tem $T = 2\pi\sqrt{2L/3g} \approx 1{,}64$ s; seu centro de oscilação fica a 0,67 m do pivô.

**Armadilha:** achar que o pêndulo mais pesado oscila mais devagar. A massa aparece no torque e na inércia e se cancela.

No experimento, compare pequenas e grandes amplitudes com a aproximação linear desenhada ao lado; troque a massa e veja o período não mudar; depois troque a esfera pela barra e meça o período do pêndulo físico.`,
      experiments: [
        { kind: "sim", id: "pendulos", scenario: "pequeno", params: { L: 0.8, theta0: 8 }, note: "Com L = 0,80 m, confira T ≈ 1,80 s; troque a massa e o período continua o mesmo." },
        { kind: "sim", id: "pendulos", scenario: "grande", note: "Compare o pêndulo real a 120° com a aproximação de pequenos ângulos." },
        { kind: "sim", id: "pendulos", scenario: "fisico", note: "Meça o período da barra e encontre o comprimento do pêndulo simples equivalente." },
        { kind: "pratica", id: "exp1-pendulo", note: "Roteiro de bancada: período contra comprimento e amplitude, e medida de g." },
        { kind: "pratica", id: "exp1-pendulo-fisico", note: "Roteiro de bancada do pêndulo físico com uma barra." },
        { kind: "concepcao", id: "pendulo-pesado-mais-lento", note: "Confronte a ideia de que o pêndulo mais pesado é mais lento." },
      ],
    },
    "15-7": {
      text: String.raw`Imagine uma partícula em movimento circular uniforme num círculo de raio $x_m$, com velocidade angular $\omega$. O ângulo do seu raio vetor com o eixo $x$ é $\omega t + \phi$. A **projeção** da posição sobre o eixo $x$ é
$$x(t) = x_m \cos(\omega t + \phi),$$
exatamente o MHS da seção 15-2. O mesmo vale para a velocidade e a aceleração: a velocidade tangencial $\omega x_m$ projetada dá $-\omega x_m\sin(\omega t + \phi)$, e a aceleração centrípeta $\omega^2 x_m$, apontando para o centro, projetada dá $-\omega^2 x_m \cos(\omega t + \phi)$.

**O MHS é a projeção de um movimento circular uniforme sobre um diâmetro.** O círculo é chamado **círculo de referência**, e o vetor girante, **fasor**. Isso dá significado geométrico às grandezas:
- a frequência angular do MHS é a velocidade angular do fasor;
- a fase é o ângulo do fasor;
- a amplitude é o raio do círculo.

### Duas projeções
A projeção sobre o eixo $y$ é outro MHS, defasado de 90°. Ao contrário, dois MHS perpendiculares de mesma frequência e amplitude, defasados de 90°, compõem um movimento circular; com frequências ou fases diferentes, compõem as **figuras de Lissajous**. Historicamente, Galileu viu as luas de Júpiter indo e voltando em MHS: era o movimento circular delas visto de perfil.

**Exemplo.** Um ponto na borda de uma roda de 0,30 m de raio a 2 voltas por segundo tem sombra projetada numa parede com amplitude 0,30 m, $\omega = 4\pi$ rad/s e velocidade máxima $4\pi \cdot 0{,}30 \approx 3{,}8$ m/s, igual à velocidade escalar do ponto na roda.

**Armadilha:** pensar que o objeto em MHS "gira". A partícula em MHS anda em linha reta; o círculo é uma construção auxiliar.

No experimento, arraste o fasor e veja sua sombra reproduzir $x(t)$; depois componha dois MHS perpendiculares e encontre a defasagem que transforma a reta em círculo.`,
      experiments: [
        { kind: "sim", id: "mhs", scenario: "circulo", params: { fasores: 1 }, note: "Veja os fasores de posição, velocidade e aceleração girando e suas projeções no eixo." },
        { kind: "sim", id: "lissajous-fourier", scenario: "lissajous", note: "Componha dois MHS perpendiculares e mude a fase até obter uma circunferência." },
        { kind: "sim", id: "pendulos-especiais", scenario: "esferico", note: "No pêndulo cônico, a sombra do movimento circular num eixo é um MHS." },
      ],
    },
    "15-8": {
      text: String.raw`Oscilações reais perdem energia por atrito. Num modelo simples, um amortecedor viscoso exerce uma força proporcional à velocidade, $F_a = -b v$, em que $b$ (kg/s) é a **constante de amortecimento**. A segunda lei fica
$$m\frac{d^2x}{dt^2} + b\frac{dx}{dt} + kx = 0 .$$
Para amortecimento pequeno, a solução é
$$x(t) = x_m e^{-bt/2m}\cos(\omega' t + \phi), \qquad \omega' = \sqrt{\frac{k}{m} - \frac{b^2}{4m^2}} .$$
É uma senoide cuja amplitude decai exponencialmente, com frequência angular $\omega'$ um pouco menor que a do oscilador livre. A energia, proporcional ao quadrado da amplitude, decai como
$$E(t) \approx \tfrac12 k x_m^2\, e^{-bt/m} .$$

### Regimes
- **Subamortecido** ($b < 2\sqrt{km}$): oscila com amplitude decrescente.
- **Crítico** ($b = 2\sqrt{km}$): volta ao equilíbrio o mais depressa possível, sem oscilar. É o ajuste buscado em amortecedores de carro e ponteiros de instrumentos.
- **Superamortecido** ($b > 2\sqrt{km}$): volta sem oscilar, mas devagar.

**Exemplo.** Um bloco de 0,50 kg numa mola de 50 N/m com $b = 0{,}20$ kg/s. O tempo para a amplitude cair à metade é $t = (2m/b)\ln 2 = 5 \ln 2 \approx 3{,}5$ s; nesse tempo, com $T \approx 0{,}63$ s, ele faz cerca de 5,5 oscilações. A energia cai à metade em metade desse tempo, 1,7 s. O amortecimento crítico seria $b = 2\sqrt{50 \cdot 0{,}5} = 10$ kg/s.

**Armadilha:** esperar que o amortecimento altere muito o período. Para amortecimento fraco, $\omega'$ é praticamente igual a $\omega$; o efeito visível é o decaimento da amplitude.

No experimento, aumente $b$ e veja o movimento passar de oscilação que decai a retorno sem oscilar; compare os três regimes lado a lado e meça o tempo para a amplitude cair à metade.`,
      experiments: [
        { kind: "sim", id: "amortecido", scenario: "sub", params: { m: 0.5, k: 50, b: 0.2 }, note: "Meça o tempo em que a amplitude cai à metade e compare com (2m/b) ln 2 ≈ 3,5 s." },
        { kind: "sim", id: "amortecido", scenario: "comparar", note: "Compare sub, crítico e superamortecido partindo da mesma posição." },
        { kind: "sim", id: "pendulos", scenario: "amortecido", note: "Veja o pêndulo com atrito no pivô perder amplitude a cada oscilação." },
        { kind: "sim", id: "lei-hooke", scenario: "uma-mola", note: "Observe a oscilação amortecida da mola real terminar na posição de equilíbrio." },
      ],
    },
    "15-9": {
      text: String.raw`Uma criança no balanço oscila na **frequência natural** $\omega$ do sistema. Quem empurra aplica uma força periódica com outra frequência, a **frequência de excitação** $\omega_d$. Para um oscilador amortecido sob uma força $F_0\cos\omega_d t$, depois que o transiente inicial desaparece, o sistema oscila **na frequência da força**, não na sua frequência natural:
$$x(t) = x_m \cos(\omega_d t + \phi),$$
com uma amplitude que depende de $\omega_d$:
$$x_m = \frac{F_0}{\sqrt{m^2(\omega^2 - \omega_d^2)^2 + b^2\omega_d^2}} .$$

### Ressonância
A amplitude (e a velocidade) é máxima quando $\omega_d \approx \omega$: é a **ressonância**. Quanto menor o amortecimento, mais alto e estreito é o pico. A largura do pico se mede pelo **fator de qualidade** $Q \approx m\omega/b$: um diapasão tem $Q$ de milhares; uma suspensão de carro, perto de 1. A fase também muda: abaixo da ressonância o oscilador acompanha a força; acima, fica em oposição; na ressonância, atrasa 90°, e a força está sempre a favor da velocidade, injetando o máximo de potência.

### Onde aparece
- Instrumentos musicais, sintonia de rádio (capítulo 31), forno de micro-ondas.
- Engenharia estrutural: pontes e prédios têm frequências naturais que ventos, passos sincronizados ou terremotos podem excitar. Amortecedores de massa sintonizada, no topo de arranha-céus, absorvem energia perto da ressonância.

**Exemplo.** Um oscilador com $m = 1{,}0$ kg, $k = 100$ N/m ($\omega = 10$ rad/s) e $b = 0{,}5$ kg/s, sob $F_0 = 1$ N. Em ressonância, $x_m = F_0/(b\omega) = 0{,}20$ m. Com $\omega_d = 5$ rad/s, $x_m \approx 1/\sqrt{75^2 + 2{,}5^2} \approx 0{,}013$ m, quinze vezes menor. Aqui $Q = 20$.

**Armadilha:** achar que, em regime, o oscilador forçado vibra na sua própria frequência. Ele vibra na frequência de quem força; a frequência natural só define quanto ele responde.

No experimento, varra a frequência e desenhe a curva de ressonância, medindo a largura do pico; perto da ressonância, observe os batimentos do transiente; no prédio, ligue o amortecedor de massa sintonizada e veja o pico cair.`,
      experiments: [
        { kind: "sim", id: "ressonancia", scenario: "varredura", params: { m: 1, k: 100, b: 0.5, F0: 1 }, note: "Varra ω e confira a amplitude de 0,20 m na ressonância e o fator Q ≈ 20." },
        { kind: "sim", id: "ressonancia", scenario: "batimento", note: "Ligue a força perto da ressonância e observe os batimentos entre o transiente e o regime." },
        { kind: "sim", id: "amortecedor-predio", scenario: "ressonancia", note: "Excite o prédio no primeiro modo e compare a resposta com e sem o amortecedor sintonizado." },
        { kind: "desafio", id: "sintonia-ressonancia", note: "Ajuste a frequência da força para atingir a amplitude pedida." },
        { kind: "pratica", id: "exp2-oscilador", note: "Roteiro de bancada do oscilador amortecido e forçado." },
      ],
    },
  },
};
