import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 8,
  intro: String.raw`No capítulo 7 o trabalho foi a ponte entre forças e energia cinética. Para algumas forças, como a gravidade e a força elástica, o trabalho pode ser "guardado" e devolvido integralmente; isso permite definir uma **energia potencial**, que depende apenas da configuração do sistema. Com ela chegamos a uma das leis mais poderosas da física: a **conservação da energia**. Primeiro na versão mecânica, válida quando só atuam forças conservativas, e depois na versão geral, que inclui a energia térmica produzida pelo atrito e qualquer outra forma de energia. Também aprenderemos a ler uma curva de energia potencial para prever, sem resolver equações de movimento, onde um corpo pode estar e onde ele para e volta.`,
  sections: {
    "8-2": {
      text: String.raw`Jogue uma pedra para cima. Na subida, a gravidade realiza trabalho negativo e a energia cinética diminui; na descida, realiza trabalho positivo e a energia cinética volta. É natural pensar que a energia não sumiu na subida: ficou armazenada na **configuração** do sistema pedra–Terra (a distância entre elas). Essa energia armazenada é a **energia potencial** $U$.

### Definição
Para uma força $\vec F$ entre as partes de um sistema, a variação da energia potencial é o negativo do trabalho dessa força:
$$\Delta U = -W .$$
Se a força realiza trabalho negativo (pedra subindo), $U$ aumenta; se realiza trabalho positivo, $U$ diminui. Só faz sentido definir $U$ quando o trabalho pode ser recuperado por completo, o que acontece com as **forças conservativas**.

### Forças conservativas e não conservativas
- A gravidade e a força de uma mola ideal são conservativas: o trabalho num percurso de ida e volta é zero.
- O atrito cinético e o arrasto **não** são: num percurso fechado, sempre realizam trabalho negativo. A energia retirada vira energia térmica e não volta espontaneamente como energia cinética.

**Exemplo.** Um bloco desliza numa mesa com atrito, ida e volta, 2 m em cada sentido, com atrito de 3 N. Trabalho do atrito no percurso fechado: $-3 \cdot 2 - 3 \cdot 2 = -12$ J, e não zero. Já uma bola de 0,5 kg que sobe 4 m e desce os mesmos 4 m sofre um trabalho do peso de $-19{,}6 + 19{,}6 = 0$.

**Armadilha:** dizer que um corpo "tem" energia potencial sozinho. A energia potencial pertence ao **sistema** (corpo + Terra, bloco + mola), porque depende da configuração das partes que interagem.

No experimento, percorra um caminho fechado com a gravidade em destaque e depois com o atrito: compare o trabalho total da volta completa nos dois casos.`,
      experiments: [
        { kind: "sim", id: "forcas-conservativas", scenario: "circulacao", note: "Percorra um caminho fechado e compare o trabalho total da gravidade, da mola e do atrito." },
        { kind: "sim", id: "montanha-russa", scenario: "meia-pipe", note: "Veja a energia cinética virar potencial e voltar, sem perdas, na pista sem atrito." },
      ],
    },
    "8-3": {
      text: String.raw`Há duas maneiras equivalentes de reconhecer uma força conservativa:
1. O trabalho total que ela realiza sobre uma partícula que percorre **qualquer caminho fechado** é zero.
2. O trabalho que ela realiza entre dois pontos A e B **não depende do caminho** seguido.

### Por que as duas afirmações são equivalentes
Considere dois caminhos 1 e 2 de A até B. Vá por 1 e volte por 2 ao contrário: o percurso é fechado, então $W_{AB,1} + W_{BA,2} = 0$. Como inverter o sentido troca o sinal do trabalho, $W_{BA,2} = -W_{AB,2}$, e resulta $W_{AB,1} = W_{AB,2}$.

### Por que isso é útil
Se a força é conservativa, podemos trocar um caminho complicado por um simples com os mesmos extremos. Para calcular o trabalho do peso sobre um esquiador numa encosta cheia de curvas, basta o desnível: $W_g = -mg(y_B - y_A)$. E só porque o trabalho depende apenas dos extremos é que podemos atribuir um valor de $U$ a cada ponto.

**Exemplo.** Um carrinho de 80 kg vai de A (altura 12 m) a B (altura 5 m) por uma rampa reta de 20 m ou por uma pista ondulada de 45 m. Em ambos os casos o peso realiza $80 \cdot 9{,}8 \cdot 7 \approx 5490$ J. Com atrito de 30 N, porém, o atrito realiza $-600$ J na rampa curta e $-1350$ J na pista longa: o trabalho do atrito depende do caminho.

### O tempo é outra história
Independência do caminho vale para o **trabalho**, não para o tempo de percurso. Entre dois pontos dados, contas soltas por curvas diferentes chegam com a mesma rapidez, mas em instantes diferentes; a curva mais rápida (a braquistócrona) não é a reta.

No experimento, compare o trabalho do peso e o do atrito nos vários caminhos entre A e B; depois, na corrida das curvas, confira que todas as contas chegam com a mesma velocidade, mas não ao mesmo tempo.`,
      experiments: [
        { kind: "sim", id: "forcas-conservativas", scenario: "gravidade", note: "Trabalho do peso em três caminhos diferentes entre A e B: sempre o mesmo." },
        { kind: "sim", id: "forcas-conservativas", scenario: "atrito", note: "Repita com o atrito em destaque e veja o trabalho crescer com o comprimento do caminho." },
        { kind: "sim", id: "braquistocrona", scenario: "corrida", note: "Mesma velocidade de chegada em todas as curvas, tempos diferentes." },
      ],
    },
    "8-4": {
      text: String.raw`Para uma força conservativa unidimensional $F(x)$, a definição $\Delta U = -W$ dá
$$\Delta U = -\int_{x_i}^{x_f} F(x)\,dx .$$
Só as **variações** de $U$ têm significado físico; escolhemos livremente uma configuração de referência onde $U = 0$.

### Energia potencial gravitacional
Perto da superfície, $F_y = -mg$ (eixo $y$ para cima). Então $\Delta U = mg\,\Delta y$ e, escolhendo $U = 0$ em $y = 0$,
$$U(y) = m g y .$$
A referência pode ser o chão, a mesa ou o topo do prédio: os valores de $U$ mudam, as diferenças não.

### Energia potencial elástica
Para a mola, $F = -kx$ e, com $U = 0$ na posição relaxada,
$$U(x) = \tfrac12 k x^2 .$$
Aqui a referência natural é o comprimento relaxado; $U$ é igual para compressão e alongamento de mesmo valor.

**Exemplo.** Um saltador de 70 kg está numa plataforma a 10 m acima da água. Com referência na água, $U = 70 \cdot 9{,}8 \cdot 10 \approx 6{,}9$ kJ; com referência na plataforma, $U = 0$ ali e $-6{,}9$ kJ na água. Em ambos os casos, a variação na queda é $-6{,}9$ kJ. Já uma mola de suspensão com $k = 3\times10^4$ N/m comprimida 8 cm armazena $\tfrac12 \cdot 3\times10^4 \cdot 0{,}08^2 = 96$ J.

### Da energia para a força
O caminho inverso também vale: $F(x) = -\dfrac{dU}{dx}$. A força aponta no sentido em que $U$ diminui (seção 8-6).

**Armadilha:** achar que a energia potencial negativa é "impossível". O sinal só reflete a escolha da referência.

No experimento, calibre a mola e calcule $\tfrac12 k x^2$ para alguns alongamentos; depois, mude a altura de partida do carrinho e veja como $mgh$ define a energia disponível.`,
      experiments: [
        { kind: "sim", id: "lei-hooke", scenario: "uma-mola", note: "Obtenha k e calcule a energia elástica armazenada para cada massa pendurada." },
        { kind: "sim", id: "montanha-russa", scenario: "meia-pipe", note: "Mude a altura de partida e compare a energia potencial inicial com a cinética no fundo." },
        { kind: "sim", id: "forcas-conservativas", scenario: "desenhar", note: "Com a mola em destaque, veja que o trabalho entre A e B só depende das distâncias ao centro." },
      ],
    },
    "8-5": {
      text: String.raw`A **energia mecânica** de um sistema é a soma das energias cinética e potencial:
$$E_{\text{mec}} = K + U .$$
Se, no sistema isolado, só forças conservativas realizam trabalho, cada joule que sai de $K$ entra em $U$ e vice-versa ($\Delta K = W = -\Delta U$). Logo
$$\Delta E_{\text{mec}} = \Delta K + \Delta U = 0, \qquad K_1 + U_1 = K_2 + U_2 .$$
Esse é o **princípio de conservação da energia mecânica**.

### O poder do método
Ele relaciona dois estados sem precisar das forças intermediárias nem do tempo. A normal de uma pista, por exemplo, não realiza trabalho (é perpendicular ao movimento) e não entra na conta, por mais complicada que seja a pista.

**Exemplo 1: pista.** Um carrinho parte do repouso a 6 m de altura numa pista sem atrito. No ponto a 1,5 m: $mg\cdot 6 = \tfrac12 m v^2 + mg \cdot 1{,}5$, então $v = \sqrt{2 \cdot 9{,}8 \cdot 4{,}5} \approx 9{,}4$ m/s, qualquer que seja o formato da pista.

**Exemplo 2: estilingue vertical.** Uma mola com $k = 800$ N/m comprimida 10 cm lança para cima uma bolinha de 20 g. A altura máxima acima do ponto de partida (desprezando a pequena variação de $U_g$ durante a distensão) é $h = kx^2/(2mg) = 800 \cdot 0{,}01/(2 \cdot 0{,}02 \cdot 9{,}8) \approx 20$ m.

### Pêndulo e loop
No pêndulo, a energia oscila entre $U$ (extremos) e $K$ (ponto mais baixo). No loop, a conservação da energia combinada com a condição do topo (seção 6-5) dá a altura mínima de largada: $h = 2{,}5R$.

**Armadilha:** esperar que o carrinho "ganhe impulso" na descida e suba acima da altura inicial. Sem uma fonte externa de energia, ele nunca passa da altura de partida.

No experimento, solte o carrinho de várias alturas na pista sem atrito e verifique que a soma das barras $K + U$ fica constante; depois tente completar o loop com a menor altura possível.`,
      experiments: [
        { kind: "sim", id: "montanha-russa", scenario: "meia-pipe", note: "Verifique que K + U fica constante em toda a pista sem atrito." },
        { kind: "sim", id: "montanha-russa", scenario: "loop", note: "Use a conservação da energia para prever a altura mínima que completa o loop." },
        { kind: "sim", id: "pendulos", scenario: "pequeno", note: "Acompanhe a troca entre energia cinética e potencial ao longo da oscilação." },
        { kind: "concepcao", id: "energia-vai-mais-alto", note: "Confronte a ideia de que a descida dá impulso para subir além da altura inicial." },
        { kind: "desafio", id: "loop-sem-cair", note: "Complete o loop usando a conservação da energia." },
      ],
    },
    "8-6": {
      text: String.raw`Para um movimento em uma dimensão sob uma força conservativa, o gráfico $U(x)$ resume quase tudo o que se pode saber sobre o movimento, sem resolver nenhuma equação diferencial.

### A força é a inclinação
$$F(x) = -\frac{dU}{dx} .$$
Onde $U$ desce para a direita, a força aponta para a direita; onde a curva é plana, a força é nula.

### Regiões permitidas e pontos de retorno
Como $K = E_{\text{mec}} - U(x)$ e $K \ge 0$, a partícula só pode estar onde $U(x) \le E_{\text{mec}}$. Desenhe uma reta horizontal na altura de $E_{\text{mec}}$: os pontos em que ela corta a curva são **pontos de retorno**, onde $K = 0$ e o movimento inverte. Entre eles, a altura da reta acima da curva é a energia cinética.

### Equilíbrios
- **Estável:** fundo de um vale ($dU/dx = 0$, curva côncava para cima). Um pequeno deslocamento gera força de volta e a partícula oscila.
- **Instável:** topo de um morro. Qualquer perturbação a afasta.
- **Neutro (indiferente):** trecho plano. Deslocada, ela fica onde está.

**Exemplo.** Um carrinho de 50 kg move-se numa pista cuja energia potencial tem um vale em $U = 0$, um morro de 2000 J e outro vale mais à frente. Se o carrinho passa pelo primeiro vale a 8 m/s, tem $E = \tfrac12 \cdot 50 \cdot 64 = 1600$ J: menor que 2000 J, então ele fica preso no primeiro vale, retornando onde $U = 1600$ J. A 10 m/s ($E = 2500$ J), passa pelo morro com $K = 500$ J no topo.

**Armadilha:** ler a curva $U(x)$ como a trajetória do corpo. Ela é um gráfico de energia; mesmo para uma mola horizontal, a curva é uma parábola e o movimento é reto.

No experimento, escolha a energia inicial do carrinho na pista com dois vales, preveja os pontos de retorno no gráfico $U(s)$ e verifique se ele vence ou não a barreira.`,
      experiments: [
        { kind: "sim", id: "montanha-russa", scenario: "dois-vales", note: "Marque a energia total no gráfico U(s), preveja os pontos de retorno e veja se o carrinho vence a barreira." },
        { kind: "sim", id: "massa-mola", scenario: "livre", note: "A curva parabólica de U(x) e os pontos de retorno ±x₀ da oscilação." },
      ],
    },
    "8-7": {
      text: String.raw`Na seção 7-4, o trabalho era energia transferida para uma **partícula**. Agora a ideia vale para um **sistema** qualquer: o trabalho de uma força externa é a energia transferida para o sistema (ou dele retirada).

### Sem atrito
Se o sistema tem apenas energia mecânica e a força externa é a única troca com o exterior,
$$W = \Delta E_{\text{mec}} = \Delta K + \Delta U .$$
Exemplo: você ergue uma bola com velocidade crescente. O sistema bola–Terra ganha energia potencial **e** cinética, e a soma é o seu trabalho.

### Com atrito
Quando um bloco é puxado sobre o piso com atrito cinético, escolhemos o sistema bloco + piso. O atrito é interno: não transfere energia para fora, mas a converte em **energia térmica** das superfícies. A experiência mostra que
$$\Delta E_{\text{t}} = f_c\, d ,$$
e o balanço passa a ser
$$W = \Delta E_{\text{mec}} + \Delta E_{\text{t}} .$$

**Exemplo.** Você puxa uma caixa de 25 kg, com força horizontal de 120 N, ao longo de 4 m de um piso com $\mu_c = 0{,}35$, partindo do repouso. Trabalho seu: $480$ J. Energia térmica: $0{,}35 \cdot 25 \cdot 9{,}8 \cdot 4 \approx 343$ J. Sobra $\Delta K \approx 137$ J, e a caixa chega a $v = \sqrt{2 \cdot 137/25} \approx 3{,}3$ m/s.

**Por que não usar só $f_c d$ como "trabalho do atrito"?** Para um bloco rígido, o produto coincide; mas o atrito age por uma interface que se deforma e se aquece, e a forma mais segura de contabilizar é como energia térmica do sistema.

**Armadilha:** esquecer que o mesmo trabalho externo se divide entre $\Delta K$, $\Delta U$ e $\Delta E_{\text{t}}$; nada garante que tudo vire movimento.

No experimento, empurre o bloco rampa acima com força constante e confira que o trabalho da força aplicada é igual à soma das variações de energia cinética, potencial e térmica.`,
      experiments: [
        { kind: "sim", id: "plano-inclinado", scenario: "empurra", note: "Some as variações de energia cinética, potencial e térmica e compare com o trabalho da força aplicada." },
        { kind: "sim", id: "massa-mola", scenario: "atrito", note: "Acompanhe a energia mecânica do oscilador virar energia térmica na mesa." },
      ],
    },
    "8-8": {
      text: String.raw`A versão mais geral do princípio diz: **a energia total de um sistema isolado não pode variar**. Ela pode mudar de forma, mas a soma de todas as formas fica constante:
$$\Delta E_{\text{mec}} + \Delta E_{\text{t}} + \Delta E_{\text{int}} = 0 \quad \text{(sistema isolado)},$$
em que $E_{\text{int}}$ inclui outras energias internas (química, por exemplo). Se o sistema não é isolado, o trabalho externo entra no balanço: $W = \Delta E$. Nunca se observou uma exceção, e a busca por exceções levou à descoberta de novas formas de energia (e de novas partículas, como o neutrino).

### Forças internas que transferem energia
Uma patinadora que empurra a parede e sai deslizando ganha energia cinética, mas a parede não realiza trabalho sobre ela (o ponto de aplicação não se move). A energia vem da **energia química** dos músculos, convertida internamente. O mesmo acontece com o carro: o atrito do chão empurra o carro, mas a energia vem do combustível.

### Potência e rendimento
A potência média de uma transferência é $P = \Delta E/\Delta t$. Em uma máquina, o rendimento é a razão entre a energia útil e a energia fornecida; o restante vira, em geral, energia térmica.

**Exemplo.** Um esquiador de 75 kg desce 120 m de desnível e chega à base a 25 m/s. Energia potencial perdida: $75 \cdot 9{,}8 \cdot 120 \approx 88$ kJ. Energia cinética final: $\tfrac12 \cdot 75 \cdot 625 \approx 23$ kJ. Os 65 kJ restantes viraram energia térmica (neve, ar e esquis). A energia total se conservou; a mecânica, não.

### Moto-perpétuo
Uma máquina que entregasse trabalho indefinidamente sem receber energia violaria esse princípio. Todos os projetos já propostos escondem uma perda ou uma fonte não contabilizada.

**Armadilha:** dizer que, com atrito, "a energia não se conserva". A energia mecânica diminui; a energia total se conserva.

No experimento, ligue o atrito na pista e acompanhe a barra de energia térmica crescer exatamente o que a mecânica perde; depois, no aparelho de Joule, veja a queda dos pesos aquecer a água.`,
      experiments: [
        { kind: "sim", id: "montanha-russa", scenario: "atrito", note: "Veja a energia térmica crescer na mesma medida em que a energia mecânica diminui." },
        { kind: "sim", id: "equivalente-mecanico", scenario: "joule", note: "A energia potencial dos pesos que caem vira energia térmica da água." },
        { kind: "pratica", id: "exp2-joule", note: "Roteiro de bancada do equivalente mecânico do calor." },
        { kind: "sim", id: "braquistocrona", scenario: "atrito", note: "Com atrito, a velocidade de chegada passa a depender da curva: parte da energia vira calor." },
      ],
    },
  },
};
