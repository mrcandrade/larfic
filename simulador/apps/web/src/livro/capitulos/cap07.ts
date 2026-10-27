import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 7,
  intro: String.raw`As leis de Newton resolvem qualquer problema de mecânica, mas exigem conhecer a força em cada instante e integrar o movimento passo a passo. Muitas vezes queremos uma resposta mais direta: com que velocidade o carrinho chega ao fim da pista? Quanta energia o motor precisa fornecer? Este capítulo apresenta a **energia cinética**, associada ao movimento, e o **trabalho**, a forma de transferir energia por meio de uma força. O teorema do trabalho e energia cinética liga as duas ideias e permite ignorar os detalhes da trajetória. No fim, a **potência** mede a rapidez dessa transferência, a grandeza que aparece na placa de qualquer motor ou aparelho elétrico.`,
  sections: {
    "7-2": {
      text: String.raw`"Energia" é uma palavra do cotidiano, mas em física tem um significado preciso: é um **número associado ao estado de um sistema** que, somado sobre todas as suas formas, não muda com o tempo quando o sistema está isolado. Não se trata de uma substância nem de algo que se veja diretamente; é uma grandeza contábil extraordinariamente útil, porque a soma se conserva em todos os processos já observados.

### Formas e transferências
A energia aparece em várias formas: cinética (movimento), potencial gravitacional e elástica (configuração), térmica (agitação microscópica), química, elétrica, radiante, nuclear. Nos processos ela **muda de forma** (a queda d'água transforma potencial gravitacional em cinética e depois em elétrica no gerador) ou **é transferida** entre sistemas, por trabalho ou por calor.

### Unidade
No SI, a energia é medida em **joule**: $1\ \text{J} = 1\ \text{kg·m}^2/\text{s}^2$. Outras unidades aparecem em contextos específicos: a caloria (≈ 4,19 J) em nutrição e termodinâmica, o quilowatt-hora (3,6 MJ) na conta de luz, o elétron-volt ($1{,}6\times10^{-19}$ J) em física atômica.

**Exemplo de ordem de grandeza.** Levantar um livro de 1 kg por 1 m exige cerca de 10 J. Um sanduíche de 300 kcal contém cerca de $1{,}3\times10^{6}$ J, o suficiente, em princípio, para erguer esse livro 130 km, se o corpo fosse uma máquina perfeita (não é: o rendimento muscular é da ordem de 20%).

**Armadilha:** dizer que a energia "se gasta". Ela muda de forma; o que se perde é a parte **utilizável**, que tende a terminar como energia térmica espalhada no ambiente.

No experimento, monte cadeias fonte → conversor → usuário e acompanhe os pacotes de energia: em cada etapa, some o que segue adiante com o que vira calor e confira que nada desaparece.`,
      experiments: [
        { kind: "sim", id: "formas-energia", scenario: "sol-led", note: "Siga a energia do Sol até a luz do LED e veja quanto vira calor em cada conversão." },
        { kind: "sim", id: "formas-energia", scenario: "chaleira", note: "Da chama ao vapor e à turbina: identifique as formas de energia em cada etapa." },
      ],
    },
    "7-3": {
      text: String.raw`A **energia cinética** é a energia associada ao movimento de um corpo. Para uma partícula de massa $m$ com velocidade $v$ (muito menor que a da luz),
$$K = \tfrac{1}{2} m v^2 .$$

### Características
- $K$ é um **escalar** e nunca é negativa; depende só do módulo da velocidade, não da direção. Um carro a 60 km/h para o norte ou para o sul tem a mesma $K$.
- Depende do **quadrado** da velocidade: dobrar $v$ quadruplica $K$. Isso explica por que a distância de frenagem cresce tão depressa com a velocidade (veja a seção 7-5).
- Depende do referencial: no referencial do próprio carro, a $K$ dele é zero.

**Exemplo.** Um carro de 1200 kg a 72 km/h (20 m/s): $K = \tfrac12 \cdot 1200 \cdot 20^2 = 2{,}4\times10^5$ J. A 108 km/h (30 m/s), $K = 5{,}4\times10^5$ J, mais que o dobro, embora a velocidade tenha aumentado só 50%.

Outro exemplo instrutivo: uma bala de 10 g a 400 m/s tem $K = 800$ J, enquanto uma bola de boliche de 7 kg a 5 m/s tem $K \approx 88$ J. Momento e energia cinética medem coisas diferentes: a bola de boliche tem mais momento ($35$ kg·m/s contra $4$ kg·m/s).

**Armadilha:** somar energias cinéticas como vetores ou atribuir sinal a $K$ conforme o sentido do movimento. $K$ é sempre um escalar positivo (ou nulo).

No experimento, solte o carrinho na meia-pipe e observe a barra de energia cinética: ela é máxima no fundo, onde a velocidade é máxima, e zero nos pontos de retorno, qualquer que seja o sentido do movimento.`,
      experiments: [
        { kind: "sim", id: "montanha-russa", scenario: "meia-pipe", note: "Observe a barra de energia cinética subir e descer com o módulo da velocidade, nos dois sentidos." },
        { kind: "sim", id: "trilho-de-ar", scenario: "segunda-lei", note: "Meça a velocidade do carrinho nas fotoportas e calcule sua energia cinética em cada ponto." },
      ],
    },
    "7-4": {
      text: String.raw`**Trabalho** é a energia transferida para um corpo ou dele retirada por meio de uma força. Quando a energia é transferida para o corpo, o trabalho é positivo; quando é retirada, negativo.

### Força constante
Para uma força constante $\vec F$ que age enquanto o corpo sofre um deslocamento $\vec d$,
$$W = \vec F \cdot \vec d = F d \cos\phi ,$$
em que $\phi$ é o ângulo entre a força e o deslocamento. Só a componente da força **ao longo do deslocamento** realiza trabalho:
- $\phi < 90°$: $W > 0$ (a força ajuda o movimento);
- $\phi = 90°$: $W = 0$ (a força só desvia, como a normal num piso horizontal ou a força centrípeta num MCU);
- $\phi > 90°$: $W < 0$ (a força se opõe, como o atrito cinético).

A unidade é o joule: $1\ \text{J} = 1\ \text{N·m}$.

### Trabalho total
Quando várias forças agem, o trabalho total é a soma dos trabalhos de cada uma, que é igual ao trabalho da força resultante: $W_{\text{tot}} = \vec F_{\text{res}}\cdot\vec d$.

**Exemplo.** Você puxa um trenó por 15 m com uma corda que faz 30° com a horizontal, com tração de 60 N; o atrito cinético vale 40 N. Trabalho da corda: $60 \cdot 15 \cos 30° \approx 779$ J. Trabalho do atrito: $-40 \cdot 15 = -600$ J. Peso e normal: zero. Total: $\approx 179$ J, que vai virar energia cinética do trenó.

**Armadilha:** confundir o esforço de segurar uma mala parada com trabalho. Sem deslocamento, a força sobre a mala não realiza trabalho (os músculos gastam energia internamente, mas nada é transferido para a mala).

No experimento, use o produto escalar para ver como $W$ depende do ângulo entre $\vec F$ e $\vec d$; depois, na mesa, mude o ângulo da corda e compare o trabalho dela com o do atrito.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "escalar", note: "Veja o produto escalar como projeção: trate A como força e B como deslocamento e varie o ângulo." },
        { kind: "sim", id: "massa-mola", scenario: "forca", note: "Acompanhe o trabalho de cada força separadamente e o sinal de cada um." },
        { kind: "sim", id: "forcas-dcl", scenario: "mesa", note: "Identifique, no diagrama, quais forças têm componente ao longo do deslocamento." },
      ],
    },
    "7-5": {
      text: String.raw`Combinando a segunda lei com as equações de aceleração constante, para uma força resultante constante ao longo de um deslocamento $d$: $v_f^2 = v_i^2 + 2ad$, e multiplicando por $m/2$,
$$\tfrac12 m v_f^2 - \tfrac12 m v_i^2 = F_{\text{res}}\, d .$$
O resultado vale em geral (seção 7-8) e é o **teorema do trabalho e energia cinética**:
$$\Delta K = K_f - K_i = W_{\text{tot}} .$$
A variação da energia cinética de uma partícula é igual ao trabalho total realizado sobre ela.

### Como usar
- O teorema não pede o tempo nem a forma detalhada da trajetória, apenas o trabalho total.
- Se $W_{\text{tot}} > 0$, a partícula acelera; se $W_{\text{tot}} < 0$, freia; se $W_{\text{tot}} = 0$, o módulo da velocidade não muda (MCU, por exemplo).

**Exemplo: distância de frenagem.** Um carro a 20 m/s trava as rodas numa pista com $\mu_c = 0{,}7$. O único trabalho é o do atrito, $-\mu_c m g\, d$. Então $0 - \tfrac12 m v^2 = -\mu_c m g\, d$ e
$$d = \frac{v^2}{2\mu_c g} = \frac{400}{2 \cdot 0{,}7 \cdot 9{,}8} \approx 29\ \text{m}.$$
A 30 m/s, a distância sobe para cerca de 66 m: o fator $v^2$ aparece de forma direta. A massa do carro se cancela.

**Armadilha:** aplicar o teorema com o trabalho de uma só força. É o trabalho **total** (de todas as forças) que dá $\Delta K$.

No experimento, aplique uma força constante, meça o deslocamento e compare a soma dos trabalhos de todas as forças com a variação da energia cinética mostrada no painel.`,
      experiments: [
        { kind: "sim", id: "massa-mola", scenario: "forca", note: "Compare a soma dos trabalhos de todas as forças com a variação de energia cinética do bloco." },
        { kind: "sim", id: "plano-inclinado", scenario: "lancado", note: "Lance o bloco rampa acima e preveja, pelo teorema, até onde ele sobe antes de parar." },
        { kind: "sim", id: "trilho-de-ar", scenario: "segunda-lei", note: "O peso pendurado realiza trabalho; confira que ele vira energia cinética do sistema." },
      ],
    },
    "7-6": {
      text: String.raw`O peso $m\vec g$ é constante perto da superfície da Terra, então o trabalho que ele realiza quando um corpo se desloca $\vec d$ é
$$W_g = m g\, d \cos\phi .$$
Na subida ($\phi = 180°$) o trabalho da gravidade é $-mgh$; na descida ($\phi = 0$), $+mgh$. Para qualquer caminho, só o **desnível** importa: $W_g = -mg\,\Delta y$, com $y$ medido para cima. Essa independência do caminho será a base da energia potencial no capítulo 8.

### Levantar e abaixar com uma força aplicada
Quando você ergue um corpo de $K_i$ a $K_f$, o teorema da seção 7-5 dá
$$\Delta K = W_a + W_g .$$
Se o corpo começa e termina em repouso, $\Delta K = 0$ e $W_a = -W_g = mgh$: o trabalho que você faz é exatamente o que a gravidade "desfaz". Isso vale qualquer que seja o ritmo ou a trajetória.

**Exemplo.** Um operário levanta, com velocidade constante, um saco de cimento de 50 kg do chão até uma laje a 3,2 m. A gravidade realiza $W_g = -50 \cdot 9{,}8 \cdot 3{,}2 \approx -1570$ J; o operário (ou a roldana) realiza $+1570$ J. Se depois o saco desce devagar até o chão, a gravidade realiza $+1570$ J e a força de quem segura, $-1570$ J.

### Elevador e máquina de Atwood
Num elevador subindo com velocidade constante, o cabo realiza trabalho positivo e a gravidade, negativo, de mesmo módulo. Numa máquina de Atwood, a gravidade realiza trabalho positivo no corpo que desce e negativo no que sobe; a diferença é que aumenta a energia cinética do conjunto.

**Armadilha:** concluir que o trabalho da gravidade num caminho longo e inclinado é maior que numa queda vertical do mesmo desnível. É igual.

No experimento, leve a partícula de A até B pelos três caminhos e compare o trabalho do peso; depois, na Atwood, some os trabalhos da gravidade nos dois corpos.`,
      experiments: [
        { kind: "sim", id: "forcas-conservativas", scenario: "gravidade", note: "Compare o trabalho do peso em três caminhos com o mesmo desnível." },
        { kind: "sim", id: "atwood", scenario: "atwood", note: "Some o trabalho da gravidade sobre o corpo que desce e sobre o que sobe e compare com a energia cinética ganha." },
      ],
    },
    "7-7": {
      text: String.raw`Uma mola ideal, esticada ou comprimida de $x$ a partir do seu comprimento relaxado, exerce uma força que tende a restaurar esse comprimento. Para deformações pequenas vale a **lei de Hooke**:
$$F_x = -k x ,$$
em que $k$ (N/m) é a **constante elástica**: quanto mais rígida a mola, maior $k$. O sinal negativo indica que a força aponta sempre para a posição relaxada.

### Trabalho da força elástica
Como a força varia com a posição, não podemos usar $Fd\cos\phi$. Somando trabalhos em pequenos deslocamentos (uma integral),
$$W_s = \int_{x_i}^{x_f} (-kx)\,dx = \tfrac12 k x_i^2 - \tfrac12 k x_f^2 .$$
- Afastando o bloco do ponto relaxado, $W_s < 0$; voltando em direção a ele, $W_s > 0$.
- Se o bloco sai de $x_i$ e volta a $x_i$, o trabalho total da mola é zero.
- Geometricamente, $W_s$ é menos a área sob a reta $F = kx$ no gráfico de força por posição: um triângulo.

### Força aplicada
Se você estica a mola devagar, a partir do repouso e até o repouso, o seu trabalho é $W_a = -W_s$. Para esticar de $0$ a $x$: $W_a = \tfrac12 k x^2$.

**Exemplo.** Uma mola com $k = 400$ N/m é esticada de 0 a 5 cm e depois de 5 a 10 cm. Primeiro trecho: $\tfrac12 \cdot 400 \cdot 0{,}05^2 = 0{,}5$ J. Segundo: $\tfrac12 \cdot 400 \cdot (0{,}10^2 - 0{,}05^2) = 1{,}5$ J. O mesmo alongamento de 5 cm custa três vezes mais no segundo trecho, porque a força já é maior.

**Armadilha:** usar o deslocamento total vezes a força final ($kx \cdot x$) e obter o dobro do valor correto. A força média num esticamento a partir do repouso é $kx/2$.

No experimento, calibre a mola pendurando massas e medindo o alongamento; depois, no oscilador horizontal, observe o trabalho da mola trocar de sinal a cada meia oscilação.`,
      experiments: [
        { kind: "sim", id: "lei-hooke", scenario: "uma-mola", note: "Pendure massas, meça o alongamento e obtenha k pelo gráfico força × alongamento." },
        { kind: "sim", id: "massa-mola", scenario: "livre", note: "Acompanhe o trabalho da mola ao longo da oscilação: positivo na volta ao centro, negativo no afastamento." },
        { kind: "pratica", id: "exp1-hooke", note: "Roteiro de bancada da lei de Hooke e da associação de molas." },
      ],
    },
    "7-8": {
      text: String.raw`Quando a força muda ao longo do caminho, dividimos o deslocamento em pedaços pequenos $\Delta x$, em cada um dos quais a força é quase constante, e somamos $F_x\,\Delta x$. No limite de pedaços infinitesimais, a soma vira uma integral.

### Uma dimensão
$$W = \int_{x_i}^{x_f} F_x(x)\,dx ,$$
que é a **área sob a curva** $F_x(x)$ entre $x_i$ e $x_f$ (área abaixo do eixo conta como negativa). Para uma força dada por um gráfico experimental, basta medir a área.

### Três dimensões
Para uma força $\vec F(\vec r)$ e uma trajetória qualquer,
$$W = \int_{i}^{f} \vec F \cdot d\vec r = \int (F_x\,dx + F_y\,dy + F_z\,dz) .$$
Em geral, o resultado depende do caminho seguido (seção 8-3 trata das forças para as quais não depende).

### O teorema continua valendo
Usando $F = m\,dv/dt$ e a regra da cadeia, $F\,dx = m v\,dv$, e a integral dá $\tfrac12 m v_f^2 - \tfrac12 m v_i^2$. Assim o teorema da seção 7-5 vale para forças variáveis.

**Exemplo.** Um cabo elástico de bungee exerce, a partir do alongamento $x$, uma força $F = -(50x + 8x^2)$ N (x em metros). O trabalho dele quando é esticado de 0 a 3 m é
$$W = -\int_0^3 (50x + 8x^2)\,dx = -(25 \cdot 9 + \tfrac83 \cdot 27) = -297\ \text{J}.$$
Uma mola linear de 50 N/m teria realizado apenas $-225$ J.

**Armadilha:** multiplicar a força num ponto pelo deslocamento total. Isso só dá certo se a força for constante.

No experimento, defina você mesmo a força $F(x)$ em cinco pontos, calcule a área sob o gráfico e veja o bloco ganhar exatamente essa energia cinética enquanto a região sombreada acompanha a posição; depois desenhe caminhos em 2D e acompanhe a soma de $\vec F \cdot d\vec r$ trecho a trecho.`,
      experiments: [
        { kind: "sim", id: "massa-mola", scenario: "forca-variavel", note: "Monte F(x) nos controles e confira que K − K₀ é a área sob o gráfico entre a posição inicial e a atual." },
        { kind: "sim", id: "forcas-conservativas", scenario: "desenhar", note: "Desenhe um caminho e acompanhe a integral de F·dr sendo somada trecho a trecho." },
        { kind: "sim", id: "massa-mola", scenario: "livre", note: "Relacione o trabalho da mola com a área sob a reta F × x entre duas posições." },
      ],
    },
    "7-9": {
      text: String.raw`Dois guindastes que erguem a mesma carga à mesma altura realizam o mesmo trabalho, mas um pode fazê-lo em 10 s e o outro em 1 min. A grandeza que distingue os dois é a **potência**, a taxa de realização de trabalho.

### Potência média e instantânea
$$P_{\text{méd}} = \frac{W}{\Delta t}, \qquad P = \frac{dW}{dt} .$$
Para uma força $\vec F$ agindo sobre um corpo com velocidade $\vec v$, $dW = \vec F\cdot d\vec r$, e então
$$P = \vec F \cdot \vec v = F v \cos\phi .$$
A unidade SI é o **watt**: $1\ \text{W} = 1\ \text{J/s}$. O cavalo-vapor vale cerca de 735 W e o horsepower, 746 W. O quilowatt-hora é uma unidade de **energia** (potência × tempo): $1\ \text{kWh} = 3{,}6\times10^6$ J.

**Exemplo 1.** Um elevador de 900 kg (com passageiros) sobe a 2 m/s com velocidade constante. A tração do cabo vale $mg \approx 8800$ N e a potência do motor deve ser, ao menos, $P = Fv \approx 17{,}6$ kW. Se o motor tiver rendimento de 80%, ele consome cerca de 22 kW da rede.

**Exemplo 2.** Um carro a 30 m/s enfrenta arrasto e atrito de rolamento somando 600 N. A potência necessária só para manter a velocidade é $600 \cdot 30 = 18$ kW. Como o arrasto cresce com $v^2$, a potência cresce aproximadamente com $v^3$ em velocidades altas.

**Armadilha:** confundir potência com energia ("gastei 100 W"). O watt mede quão depressa a energia é transferida; a conta de luz cobra kWh, a energia total.

No experimento, aplique uma força externa constante ao bloco e acompanhe o gráfico da potência instantânea $Fv$: ela muda de sinal quando a velocidade inverte. Depois, compare as potências de entrada e de saída numa cadeia de conversão de energia.`,
      experiments: [
        { kind: "sim", id: "massa-mola", scenario: "forca", note: "Acompanhe a potência instantânea F·v da força externa e veja quando ela fica negativa." },
        { kind: "sim", id: "formas-energia", scenario: "lampadas", note: "Compare a potência elétrica de entrada e a potência luminosa útil de uma lâmpada incandescente e de um LED." },
      ],
    },
  },
};
