import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 3,
  intro: String.raw`Na reta, um sinal bastava para indicar o sentido. No plano e no espaço, deslocamentos, velocidades e forças apontam em qualquer direção, e precisamos de uma ferramenta que guarde ao mesmo tempo **quanto** e **para onde**: o **vetor**. Este capítulo é de matemática a serviço da física: como somar vetores pela geometria e pelas componentes, como escrevê-los com vetores unitários, por que as leis físicas não dependem da orientação dos eixos e como multiplicar vetores de duas maneiras, o produto escalar e o produto vetorial, que reaparecem no trabalho, no torque e na força magnética.`,
  sections: {
    "3-2": {
      text: String.raw`Algumas grandezas ficam completamente determinadas por um número e uma unidade: temperatura, massa, tempo, energia. São **escalares**, e obedecem à aritmética comum. Outras exigem também uma direção e um sentido: deslocamento, velocidade, aceleração, força. São **vetores**.

### O que define um vetor
- Um **módulo** (o "tamanho", sempre positivo, com unidade);
- uma **orientação** (direção e sentido).

Graficamente, um vetor é uma seta: o comprimento representa o módulo, e a ponta indica o sentido. Escrevemos $\vec a$ (ou **a** em negrito) para o vetor e $a$ ou $|\vec a|$ para o seu módulo.

### O deslocamento como modelo
O deslocamento de uma partícula só depende de onde ela começou e de onde terminou. Três viagens diferentes de Porto Alegre a Canoas, por ruas distintas, têm o **mesmo** vetor deslocamento. Além disso, transportar a seta paralelamente a si mesma não muda o vetor: dois deslocamentos de 3 km para o norte são iguais, não importa de onde partam.

**Exemplo.** Um drone sobe 40 m na vertical e depois voa 30 m para leste. O vetor deslocamento resultante liga o ponto de partida ao de chegada, tem módulo $\sqrt{40^2 + 30^2} = 50$ m e aponta cerca de 37° acima da horizontal. A distância voada foi de 70 m, um escalar.

**Armadilha:** tratar todo número com sinal como vetor. Uma temperatura de $-5$ °C é negativa, mas não tem direção: é escalar. Já uma componente de velocidade negativa diz o sentido em relação a um eixo.

No experimento, gire a cena 3D, arraste a ponta de um vetor e observe que o módulo e a direção mudam independentemente; mova a cauda e veja que o vetor continua o mesmo.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "componentes", note: "Arraste a ponta de um vetor e veja módulo e direção mudarem; gire a câmera para enxergar a orientação no espaço." },
        { kind: "sim", id: "movimento-relativo", scenario: "barco", note: "Veja velocidades representadas por setas que se somam: o rumo do barco e a correnteza." },
      ],
    },
    "3-3": {
      text: String.raw`Para somar dois vetores geometricamente, desenhamos o segundo com a cauda na ponta do primeiro; a **soma** $\vec s = \vec a + \vec b$ é a seta que vai da cauda do primeiro à ponta do segundo. Equivalentemente, desenhamos os dois com a mesma origem e tomamos a diagonal do paralelogramo que eles formam (**regra do paralelogramo**).

### Propriedades
- **Comutativa**: $\vec a + \vec b = \vec b + \vec a$ (os dois caminhos ao redor do paralelogramo chegam ao mesmo ponto).
- **Associativa**: $(\vec a + \vec b) + \vec c = \vec a + (\vec b + \vec c)$.
- **Vetor oposto**: $-\vec b$ tem o mesmo módulo de $\vec b$ e sentido contrário, e a **subtração** é a soma com o oposto: $\vec a - \vec b = \vec a + (-\vec b)$.

### Módulos não se somam
O módulo da soma fica entre a diferença e a soma dos módulos:
$$|a - b| \le |\vec a + \vec b| \le a + b .$$
O máximo ocorre quando os vetores são paralelos; o mínimo, quando são antiparalelos.

**Exemplo.** Duas pessoas puxam um carrinho com forças de 30 N e 40 N. Se puxam na mesma direção, a resultante vale 70 N; em sentidos opostos, 10 N; perpendicularmente, 50 N. Num ângulo de 60° entre elas, a lei dos cossenos dá $\sqrt{30^2 + 40^2 + 2\cdot 30 \cdot 40 \cos 60°} \approx 61$ N.

### Só vetores de mesma espécie
Só faz sentido somar vetores da mesma grandeza física: deslocamento com deslocamento, força com força.

**Armadilha:** somar os módulos ("30 N mais 40 N dá 70 N") sem olhar o ângulo entre os vetores.

No experimento, arraste as pontas dos dois vetores e acompanhe o paralelogramo: encontre as orientações que dão a maior e a menor resultante e compare com $a + b$ e $|a - b|$.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "soma", params: { Ax: 3, Ay: 0, Az: 0, Bx: 0, By: 4, Bz: 0 }, note: "Com A = 3 e B = 4 perpendiculares a soma vale 5; gire B e encontre a resultante máxima e a mínima." },
        { kind: "sim", id: "coulomb", note: "Veja forças elétricas de várias cargas se somando como vetores sobre uma carga de prova." },
      ],
    },
    "3-4": {
      text: String.raw`Somar setas desenhadas é intuitivo, mas impreciso. O método analítico usa **componentes**: as projeções do vetor sobre os eixos de um sistema de coordenadas.

### Decompondo
Num plano $xy$, um vetor $\vec a$ de módulo $a$ que faz ângulo $\theta$ com o semieixo $x$ positivo (medido no sentido anti-horário) tem componentes
$$a_x = a\cos\theta, \qquad a_y = a\sin\theta .$$
As componentes são **escalares com sinal**: $a_x < 0$ significa que a projeção aponta para o lado negativo de $x$.

### Recompondo
Conhecidas as componentes,
$$a = \sqrt{a_x^2 + a_y^2}, \qquad \tan\theta = \frac{a_y}{a_x} .$$
Cuidado: a calculadora devolve $\arctan$ entre $-90°$ e $90°$. Se $a_x < 0$, some 180° ao resultado para obter o ângulo correto.

### Em três dimensões
Acrescenta-se $a_z$, e $a = \sqrt{a_x^2 + a_y^2 + a_z^2}$. Os **cossenos diretores** $a_x/a$, $a_y/a$, $a_z/a$ dão os ângulos do vetor com cada eixo.

**Exemplo.** Um barco navega 8,0 km num rumo que faz 120° com o leste ($x$). Componentes: $a_x = 8{,}0\cos 120° = -4{,}0$ km (oeste) e $a_y = 8{,}0\sin 120° \approx 6{,}9$ km (norte). Na volta, $\arctan(6{,}9/-4{,}0) = -60°$, que somado a 180° devolve os 120°.

### Eixos inclinados
Nada obriga $x$ a ser horizontal. Num plano inclinado de ângulo $\theta$, convém alinhar $x$ com a rampa: o peso fica com componentes $mg\sin\theta$ ao longo da rampa e $mg\cos\theta$ perpendicular a ela.

**Armadilha:** usar seno e cosseno trocados quando o ângulo é medido a partir de outro eixo. Desenhe o triângulo e confira qual cateto é adjacente ao ângulo.

No experimento, mova a ponta de um vetor e leia suas componentes e cossenos diretores; depois, no plano inclinado, ligue a decomposição do peso e veja as duas componentes mudarem com o ângulo da rampa.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "componentes", params: { Ax: -4, Ay: 5, Az: 0 }, note: "Com A no segundo quadrante, leia as componentes e confira o ângulo somando 180° ao arctan." },
        { kind: "sim", id: "plano-inclinado", scenario: "critico", params: { componentes: 1 }, note: "Decomponha o peso em eixos alinhados com a rampa e veja mg sen θ e mg cos θ mudarem com o ângulo." },
      ],
    },
    "3-5": {
      text: String.raw`Um **vetor unitário** tem módulo 1, não tem unidade física e serve só para indicar uma direção e um sentido. Os unitários dos eixos cartesianos são $\hat i$, $\hat j$ e $\hat k$, apontando nos sentidos positivos de $x$, $y$ e $z$.

### Notação de vetores unitários
Qualquer vetor se escreve como soma das suas componentes vetoriais:
$$\vec a = a_x\,\hat i + a_y\,\hat j + a_z\,\hat k .$$
Cada termo $a_x\hat i$ é um vetor paralelo ao eixo $x$, com o módulo e o sinal da componente. A notação deixa explícito o que, num desenho, é preciso adivinhar.

### Sistema dextrogiro
Os eixos são sempre escolhidos de modo que, ao girar os dedos da mão direita de $x$ para $y$, o polegar aponte para $z$. Essa convenção será essencial para o produto vetorial (seção 3-8).

### Unitário de um vetor qualquer
Dividindo um vetor pelo seu módulo, obtemos o unitário na sua direção: $\hat a = \vec a / a$.

**Exemplo.** Um deslocamento $\vec d = (3{,}0\,\hat i - 4{,}0\,\hat j)$ m tem módulo 5,0 m e unitário $\hat d = 0{,}6\,\hat i - 0{,}8\,\hat j$. Uma força de 20 N nessa direção é $\vec F = 20\,\hat d = (12\,\hat i - 16\,\hat j)$ N.

### Unitários que mudam
No movimento circular é cômodo usar unitários **polares**: $\hat r$, para fora do centro, e $\hat\theta$, tangente ao círculo. Ao contrário de $\hat i$ e $\hat j$, eles giram junto com a partícula, e por isso suas derivadas não são nulas, o que dá origem à aceleração centrípeta (seção 4-7).

**Armadilha:** atribuir unidade ao unitário ("$\hat i$ metros"). A unidade fica na componente; $\hat i$ é adimensional.

No experimento, escreva os vetores mostrados na forma $a_x\hat i + a_y\hat j + a_z\hat k$ e confira os cossenos diretores; depois, no movimento circular, observe $\hat r$ e $\hat\theta$ girarem com a partícula.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "componentes", params: { Ax: 3, Ay: -4, Az: 0 }, note: "Escreva A em notação de unitários e calcule o unitário na sua direção pelos cossenos diretores." },
        { kind: "sim", id: "movimento-circular", scenario: "mcu", note: "Observe os unitários polares r̂ e θ̂ girarem com a partícula, ao contrário de î e ĵ." },
      ],
    },
    "3-6": {
      text: String.raw`Com componentes, a soma de vetores vira soma de números: **componentes de mesmo eixo se somam**.
$$\vec r = \vec a + \vec b \iff r_x = a_x + b_x,\quad r_y = a_y + b_y,\quad r_z = a_z + b_z .$$
A subtração é análoga: $\vec a - \vec b$ tem componentes $a_x - b_x$, e assim por diante.

### Roteiro
1. Escolha os eixos (de preferência, alinhados com o maior número possível de vetores).
2. Decomponha cada vetor.
3. Some as componentes de cada eixo.
4. Recomponha o módulo e o ângulo da resultante, se for pedido.

### Exemplo: três deslocamentos
Um robô de armazém anda 4,0 m para o leste, depois 6,0 m num rumo 30° ao norte do leste e, por fim, 3,0 m para o sul. Com $x$ para leste e $y$ para o norte:
- $\vec d_1 = (4{,}0;\ 0)$ m
- $\vec d_2 = (6{,}0\cos 30°;\ 6{,}0\sin 30°) = (5{,}2;\ 3{,}0)$ m
- $\vec d_3 = (0;\ -3{,}0)$ m

Soma: $\vec r = (9{,}2;\ 0)$ m. O robô terminou 9,2 m a leste do ponto de partida, exatamente sobre o eixo $x$. Pelo desenho, isso seria difícil de perceber.

### Equilíbrio
Se a soma de várias forças é nula, cada soma de componentes é nula. Duas equações escalares ($\sum F_x = 0$, $\sum F_y = 0$) permitem achar duas incógnitas, como as trações em dois fios que sustentam um vaso.

**Armadilha:** somar os ângulos ou os módulos dos vetores. Apenas as componentes, eixo por eixo, se somam diretamente.

No experimento, escolha componentes para A e B, calcule a soma à mão e confira com a sim; depois, no diagrama de corpo livre do objeto pendurado por dois fios, verifique que as componentes horizontais das trações se cancelam.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "soma", params: { Ax: 4, Ay: 2, Az: 1, Bx: -1, By: 3, Bz: -2 }, note: "Some as componentes à mão (resultado 3î + 5ĵ − k̂) e confira o paralelogramo na cena 3D." },
        { kind: "sim", id: "forcas-dcl", scenario: "fios", note: "Monte o DCL do corpo pendurado por dois fios e verifique que as componentes das forças somam zero." },
      ],
    },
    "3-7": {
      text: String.raw`A escolha dos eixos é uma conveniência nossa; a natureza não sabe onde os colocamos. Por isso, **as relações entre vetores não dependem do sistema de coordenadas**.

### Girando os eixos
Se giramos os eixos $x$ e $y$ de um ângulo $\phi$, as componentes de um vetor mudam: num sistema, $\vec a = (3;\ 4)$; no outro, as mesmas setas podem ter componentes $(5;\ 0)$. Mas o módulo, $\sqrt{a_x^2 + a_y^2}$, e o ângulo **entre** dois vetores continuam iguais. Essas grandezas são **invariantes**.

### Leis vetoriais
Uma equação como $\vec F = m\vec a$ (seção 5-6) vale em qualquer sistema de eixos. Se ela é verdadeira num sistema, as componentes de cada lado se transformam da mesma maneira ao girar os eixos, e ela continua verdadeira no outro. Escrever as leis em forma vetorial é afirmar essa independência.

### Consequência prática
Podemos escolher os eixos que mais simplificam as contas:
- num plano inclinado, $x$ ao longo da rampa (a aceleração tem uma só componente);
- num lançamento, $y$ vertical (a gravidade tem uma só componente);
- num movimento circular, eixos que giram com a partícula (seção 4-7).

**Exemplo.** Um bloco desliza numa rampa de 30° sem atrito. Com eixos horizontal e vertical, a aceleração tem duas componentes ($g\sin 30°\cos 30°$ e $-g\sin^2 30°$) e a normal também. Com $x$ ao longo da rampa, a aceleração é simplesmente $g\sin 30° = 4{,}9$ m/s² e a normal fica inteira no eixo $y$. O resultado físico é o mesmo; o trabalho algébrico, não.

**Armadilha:** achar que, por terem componentes diferentes em dois sistemas, os vetores são diferentes. O vetor é a seta; as componentes são só uma descrição dela.

No experimento, gire a câmera em torno da cena 3D e observe que o paralelogramo e o módulo da soma não mudam; depois resolva o bloco na rampa com eixos alinhados ao plano.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "soma", params: { giro: 1 }, note: "Gire a câmera e veja que o módulo da soma e o ângulo entre os vetores não dependem do ponto de vista." },
        { kind: "sim", id: "plano-inclinado", scenario: "desce", params: { componentes: 1 }, note: "Use eixos alinhados com a rampa: a aceleração fica com uma única componente." },
      ],
    },
    "3-8": {
      text: String.raw`Há três modos de multiplicar envolvendo vetores, e cada um aparece em leis físicas diferentes.

### Escalar vezes vetor
$s\vec a$ é um vetor de módulo $|s|a$, com a mesma direção de $\vec a$; o sentido se inverte se $s < 0$. Exemplo: $\vec p = m\vec v$.

### Produto escalar
$$\vec a \cdot \vec b = ab\cos\phi = a_x b_x + a_y b_y + a_z b_z .$$
O resultado é um **escalar**. Geometricamente, é o módulo de um vetor vezes a **projeção** do outro sobre ele. É positivo para ângulos agudos, nulo para vetores perpendiculares e negativo para ângulos obtusos. Como $\hat i\cdot\hat i = 1$ e $\hat i\cdot\hat j = 0$, a forma em componentes sai diretamente. Aplicação: o trabalho $W = \vec F \cdot \vec d$ (capítulo 7). Também serve para achar o ângulo entre dois vetores: $\cos\phi = \vec a\cdot\vec b/(ab)$.

### Produto vetorial
$\vec c = \vec a \times \vec b$ é um **vetor** de módulo
$$c = ab\sin\phi ,$$
perpendicular ao plano de $\vec a$ e $\vec b$, com sentido dado pela **regra da mão direita**: dedos de $\vec a$ para $\vec b$ pelo menor ângulo, polegar ao longo de $\vec c$. Propriedades: $\vec b\times\vec a = -\vec a\times\vec b$ (não comuta), $\vec a\times\vec a = 0$, $\hat i\times\hat j = \hat k$. Em componentes,
$$\vec a\times\vec b = (a_y b_z - a_z b_y)\,\hat i + (a_z b_x - a_x b_z)\,\hat j + (a_x b_y - a_y b_x)\,\hat k .$$
Aplicações: torque $\vec\tau = \vec r\times\vec F$ (capítulo 10) e força magnética $q\vec v\times\vec B$ (capítulo 28).

**Exemplo.** $\vec a = 2\hat i + 1\hat j$ e $\vec b = 1\hat i + 3\hat j$. Escalar: $2 + 3 = 5$; como $a = \sqrt5$ e $b = \sqrt{10}$, $\cos\phi = 5/\sqrt{50}$, $\phi = 45°$. Vetorial: $(2\cdot 3 - 1\cdot 1)\hat k = 5\hat k$, de módulo $\sqrt5\sqrt{10}\sin 45° = 5$, como esperado.

**Armadilha:** inverter a ordem no produto vetorial. Isso troca o sentido do resultado, e um torque horário vira anti-horário.

No experimento, use o modo de produto escalar para ver a projeção de B sobre A mudar com o ângulo; depois, no produto vetorial, acompanhe a mão direita e confirme que trocar a ordem inverte o vetor resultante.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "escalar", params: { Ax: 2, Ay: 1, Az: 0, Bx: 1, By: 3, Bz: 0 }, note: "Confira A·B = 5 e o ângulo de 45° pela projeção de B sobre A." },
        { kind: "sim", id: "vetores-3d", scenario: "vetorial", params: { Ax: 2, Ay: 1, Az: 0, Bx: 1, By: 3, Bz: 0 }, note: "Veja A × B = 5k̂ com a regra da mão direita e troque a ordem dos vetores." },
      ],
    },
  },
};
