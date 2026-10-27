import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 16,
  intro: String.raw`Uma onda transporta energia e informação de um lugar a outro **sem transportar matéria**: a rolha num lago sobe e desce enquanto a ondulação passa. Este capítulo usa a onda numa corda esticada como laboratório para as ideias que valem para qualquer onda: a função $y(x,t)$ que descreve uma onda senoidal, comprimento de onda, frequência e velocidade, o que fixa a velocidade num meio, a energia transportada e a equação diferencial que toda onda obedece. Em seguida vem o fato que mais distingue ondas de partículas: elas se **superpõem**, e daí nascem a interferência, a representação por fasores e as **ondas estacionárias**, que explicam as notas de um violão e preparam o estudo do som no capítulo 17 e da luz nos capítulos 33 a 36.`,
  sections: {
    "16-2": {
      text: String.raw`Ondas aparecem em quase todos os ramos da física. Há três grandes tipos:
- **Ondas mecânicas:** perturbações de um meio material que obedecem às leis de Newton. Ondas na água, numa corda, o som e as ondas sísmicas. Precisam de um meio: o som não atravessa o vácuo.
- **Ondas eletromagnéticas:** luz visível, rádio, micro-ondas, raios X. São oscilações dos campos elétrico e magnético e não precisam de meio; no vácuo todas viajam a $c = 299\,792\,458$ m/s (capítulo 33).
- **Ondas de matéria:** elétrons, prótons e átomos também se comportam como ondas, com comprimento de onda $\lambda = h/p$ (capítulo 38). Microscópios eletrônicos dependem disso.

Neste capítulo e no próximo, o foco são as ondas mecânicas, mas as ferramentas matemáticas servem para as três.

### O que viaja
Numa onda mecânica, cada elemento do meio oscila em torno de sua posição de equilíbrio; o que se propaga é o **padrão** da perturbação, junto com energia e momento. Um estádio fazendo "ola" é uma boa imagem: cada torcedor só levanta e senta, mas a onda dá a volta no estádio.

**Exemplo.** Num terremoto, as ondas primárias (longitudinais) andam a cerca de 6 km/s na crosta e as secundárias (transversais) a cerca de 3,5 km/s. Uma estação a 350 km do epicentro recebe as primeiras cerca de 42 s antes das segundas (58 s contra 100 s de viagem): medindo esse atraso, os sismólogos estimam a distância.

**Armadilha:** imaginar que o som é ar que viaja da fonte ao ouvido. O ar só oscila; vento é outra coisa.

No experimento, mande um pulso pela corda e observe que cada ponto só sobe e desce enquanto o pulso passa; depois, numa onda sonora, veja as partículas de ar oscilarem em torno de posições fixas.`,
      experiments: [
        { kind: "sim", id: "onda-corda", scenario: "fixa", note: "Envie um pulso e acompanhe um ponto da corda: ele sobe e desce, mas não avança." },
        { kind: "sim", id: "som-intensidade", scenario: "longitudinal", note: "Veja as partículas de ar oscilarem no lugar enquanto a onda sonora se propaga." },
        { kind: "concepcao", id: "som-no-vacuo", note: "Confronte a ideia de que o som se propaga no vácuo." },
      ],
    },
    "16-3": {
      text: String.raw`As ondas mecânicas se classificam pela direção em que os elementos do meio oscilam em relação à direção de propagação.

### Ondas transversais
Os elementos oscilam **perpendicularmente** à direção de propagação. Sacudir para cima e para baixo a ponta de uma corda esticada produz uma onda transversal: os pontos sobem e descem enquanto a onda avança na horizontal. As ondas eletromagnéticas também são transversais (os campos são perpendiculares à propagação), e as ondas S de um terremoto.

### Ondas longitudinais
Os elementos oscilam **na mesma direção** da propagação. Empurrando e puxando um pistão num tubo de ar (ou a ponta de uma mola esticada), formam-se regiões de compressão e de rarefação que avançam pelo tubo. O som no ar é longitudinal, assim como as ondas P de um terremoto.

### Observações
- Fluidos (sem atrito interno) não sustentam cisalhamento em volume (seção 14-2), por isso só transmitem ondas longitudinais; sólidos transmitem os dois tipos. Foi a ausência de ondas S do outro lado da Terra que revelou o núcleo externo líquido.
- Ondas na superfície da água são mistas: as partículas descrevem círculos ou elipses.
- Só ondas transversais podem ser **polarizadas** (capítulo 33).

**Exemplo.** Numa mola longa ("slinky") esticada no chão, um movimento lateral rápido da ponta gera um pulso transversal; um empurrão ao longo do eixo gera um pulso longitudinal, visível como espiras mais juntas que avançam.

**Armadilha:** associar "transversal" ao sentido em que a onda anda. Os dois tipos podem andar para qualquer lado; o que muda é a direção da oscilação do meio em relação à propagação.

No experimento, compare a onda transversal na corda com a onda sonora longitudinal; depois, na cadeia de massas e molas, observe a perturbação passar de uma massa à seguinte.`,
      experiments: [
        { kind: "sim", id: "onda-corda", scenario: "fixa", params: { fonte: 1, ponta: 2 }, note: "Gere uma onda senoidal transversal e veja os pontos oscilarem perpendicularmente à propagação." },
        { kind: "sim", id: "som-intensidade", scenario: "longitudinal", note: "Observe compressões e rarefações avançando na mesma direção da oscilação do ar." },
        { kind: "sim", id: "osciladores-acoplados", scenario: "cadeia", note: "Na cadeia longa de massas e molas, a perturbação passa de uma massa à vizinha e vira uma onda." },
      ],
    },
    "16-4": {
      text: String.raw`Uma onda senoidal que se propaga no sentido positivo de $x$ numa corda é descrita por
$$y(x,t) = y_m \sin(kx - \omega t) .$$
- $y_m$ é a **amplitude**, o deslocamento máximo de um elemento.
- $kx - \omega t$ é a **fase**.
- $k$ é o **número de onda angular**. Fixando o tempo, o perfil se repete quando $x$ aumenta de um **comprimento de onda** $\lambda$, e então $k\lambda = 2\pi$:
$$k = \frac{2\pi}{\lambda} \quad (\text{rad/m}) .$$
- $\omega$ é a **frequência angular**. Fixando a posição, cada elemento executa MHS (seção 15-2) e repete o movimento após um **período** $T$, com $\omega T = 2\pi$:
$$\omega = \frac{2\pi}{T} = 2\pi f .$$

Há, portanto, duas periodicidades: no espaço (λ, "fotografia" da corda) e no tempo (T, "filme" de um ponto). Uma constante de fase $\phi$ pode ser acrescentada, $y = y_m\sin(kx - \omega t + \phi)$, para ajustar o estado em $x = 0$, $t = 0$.

**Exemplo.** Uma onda numa corda é dada por $y = 0{,}020 \sin(3{,}0x - 24t)$, em unidades SI. A amplitude é 2,0 cm; $\lambda = 2\pi/3{,}0 \approx 2{,}1$ m; $T = 2\pi/24 \approx 0{,}26$ s; $f \approx 3{,}8$ Hz. A velocidade transversal máxima de um elemento é $\omega y_m = 0{,}48$ m/s.

**Armadilha:** confundir a velocidade com que um elemento sobe e desce, $\partial y/\partial t$, com a velocidade da onda (seção 16-5). São grandezas diferentes: aqui, 0,48 m/s contra 8,0 m/s.

No experimento, gere uma onda senoidal na corda, congele mentalmente uma "fotografia" e meça λ entre duas cristas; depois acompanhe a sonda num ponto fixo e meça o período.`,
      experiments: [
        { kind: "sim", id: "onda-corda", scenario: "fixa", params: { fonte: 1, ponta: 2, T: 10, mu1: 0.1, f: 5, A: 0.2 }, note: "Com f = 5 Hz, meça λ entre cristas e o período na sonda; confira λ ≈ 2 m." },
        { kind: "sim", id: "cuba-ondas", scenario: "uma", note: "Na cuba, mude a frequência da fonte e veja a distância entre as frentes de onda mudar." },
      ],
    },
    "16-5": {
      text: String.raw`Num intervalo $\Delta t$, a crista de uma onda avança $\Delta x$. Um ponto do perfil com fase fixa satisfaz $kx - \omega t = \text{constante}$; derivando em relação ao tempo, $k\,dx/dt - \omega = 0$, e a **velocidade da onda** (velocidade de fase) é
$$v = \frac{\omega}{k} = \frac{\lambda}{T} = \lambda f .$$
Em um período, a onda avança exatamente um comprimento de onda.

### Sentido
- $y = y_m\sin(kx - \omega t)$ anda no sentido $+x$;
- $y = y_m\sin(kx + \omega t)$ anda no sentido $-x$.
Mais geralmente, **qualquer** função da forma $h(kx \pm \omega t)$, ou $h(x \mp vt)$, representa uma onda que se propaga com velocidade $v$ sem mudar de forma; um pulso isolado é um exemplo.

### O que fixa a velocidade
A velocidade é uma propriedade do **meio** (tensão e densidade numa corda, seção 16-6; compressibilidade e densidade no som, capítulo 17). A frequência é fixada pela **fonte**. O comprimento de onda se ajusta: $\lambda = v/f$. Quando a onda passa de um meio a outro, $f$ se mantém e $\lambda$ muda.

**Exemplo.** A onda da seção 16-4, $y = 0{,}020\sin(3{,}0x - 24t)$, tem $v = 24/3{,}0 = 8{,}0$ m/s. Se a fonte dobrar a frequência na mesma corda, $v$ continua 8,0 m/s e $\lambda$ cai à metade, para 1,05 m.

**Armadilha:** achar que sacudir a corda com mais força ou mais depressa faz a onda andar mais rápido. Amplitude e frequência mudam a onda, não a velocidade com que ela se propaga num meio dado (para ondas de amplitude pequena).

No experimento, mude a frequência na cuba de ondas e confira que $\lambda f$ fica constante; na corda emendada, veja o pulso mudar de velocidade e de largura ao passar para a corda mais pesada.`,
      experiments: [
        { kind: "sim", id: "cuba-ondas", scenario: "uma", note: "Meça λ para várias frequências e confira que o produto λf não muda." },
        { kind: "sim", id: "onda-corda", scenario: "densa", note: "Veja o pulso desacelerar ao passar para a corda mais pesada." },
        { kind: "concepcao", id: "onda-amplitude", note: "Confronte a ideia de que uma onda maior anda mais rápido." },
      ],
    },
    "16-6": {
      text: String.raw`### Análise dimensional
A velocidade de uma onda numa corda só pode depender das propriedades da corda: a **tensão** $\tau$ (N) e a **massa específica linear** $\mu = m/L$ (kg/m). A única combinação com unidade de velocidade é $\sqrt{\tau/\mu}$.

### Pela segunda lei de Newton
Num referencial que se move junto com um pulso, a corda passa pelo pulso com velocidade $v$. Um pequeno elemento de comprimento $\Delta l$ no topo do pulso descreve um arco de raio $R$; a tração nas duas pontas dá uma força resultante para o centro $\tau\,\Delta l/R$, que deve fornecer a força centrípeta $\mu\,\Delta l\, v^2/R$. Igualando,
$$v = \sqrt{\frac{\tau}{\mu}} .$$
A velocidade cresce com a tensão e diminui com a inércia da corda. Ela não depende da frequência nem da amplitude.

**Exemplo.** Uma corda de violão de aço tem 0,65 m e massa de 1,0 g ($\mu \approx 1{,}5\times10^{-3}$ kg/m), sob tensão de 70 N: $v = \sqrt{70/1{,}5\times10^{-3}} \approx 216$ m/s. Para dobrar $v$, seria preciso quadruplicar a tensão. As cordas graves são mais grossas (maior $\mu$), com velocidades menores e, por isso, notas mais graves (seção 16-13).

### Corda emendada
Quando uma corda é emendada a outra de $\mu$ diferente sob a mesma tensão, a velocidade muda na junção. Parte da onda é refletida e parte transmitida, com a frequência mantida e o comprimento de onda ajustado a $v/f$.

**Armadilha:** usar a massa total da corda no lugar de $\mu$, ou o peso pendurado em gramas no lugar da tensão em newtons.

No experimento, mude a tensão e a densidade linear e cronometre o pulso entre duas marcas, comparando com $\sqrt{\tau/\mu}$; com $\tau = 10$ N e $\mu = 0{,}1$ kg/m, ele deve andar a 10 m/s.`,
      experiments: [
        { kind: "sim", id: "onda-corda", scenario: "fixa", params: { T: 10, mu1: 0.1 }, note: "Cronometre o pulso e confira v = √(τ/μ) = 10 m/s; depois quadruplique τ." },
        { kind: "sim", id: "onda-corda", scenario: "leve", note: "Passe da corda pesada para a leve e observe o pulso acelerar e alongar." },
        { kind: "pratica", id: "exp2-melde", note: "No experimento de Melde, obtenha v = √(τ/μ) pelos modos de uma corda vibrante." },
      ],
    },
    "16-7": {
      text: String.raw`Uma onda numa corda transporta energia: a fonte realiza trabalho sobre a corda, e cada elemento recebe energia do vizinho de trás e a passa ao da frente.

### Energias de um elemento
- **Cinética:** máxima quando o elemento passa por $y = 0$, onde a velocidade transversal é máxima; nula nos extremos $y = \pm y_m$.
- **Potencial elástica:** associada ao **estiramento** da corda, que é maior onde a inclinação $\partial y/\partial x$ é maior, também em $y = 0$. Nos extremos a corda está quase sem inclinação e sem estiramento.
Ao contrário do oscilador bloco-mola, numa onda progressiva as duas energias estão em fase: os elementos em $y = 0$ têm o máximo das duas.

### Potência média
Somando as energias sobre um comprimento de onda e dividindo pelo período, a taxa média de transmissão de energia é
$$P_{\text{méd}} = \tfrac12 \mu v \omega^2 y_m^2 .$$
O fator $\mu v$ depende só da corda; $\omega^2 y_m^2$, da fonte. A potência cresce com o **quadrado** da amplitude e o **quadrado** da frequência.

**Exemplo.** Na corda com $\mu = 0{,}10$ kg/m e $v = 10$ m/s, uma onda de 5,0 Hz ($\omega \approx 31{,}4$ rad/s) e amplitude 4,0 cm transporta $\tfrac12 \cdot 0{,}10 \cdot 10 \cdot 31{,}4^2 \cdot 0{,}04^2 \approx 0{,}79$ W. Dobrando a amplitude, 3,2 W; dobrando a frequência, também 3,2 W.

### Intensidade
Para ondas que se espalham em três dimensões (som, luz), usa-se a **intensidade**, potência por unidade de área. Para uma fonte pontual, a mesma potência se espalha sobre esferas cada vez maiores, e $I = P/(4\pi r^2)$ (capítulo 17).

**Armadilha:** achar que a energia potencial do elemento é máxima no alto da crista, como numa partícula que sobe. Na corda, o que armazena energia é o estiramento, máximo no meio.

No experimento, gere uma onda senoidal com a ponta absorvente e veja, elemento por elemento, as energias cinética e potencial máximas juntas onde a corda passa por $y = 0$; compare a potência média medida na sonda com $\tfrac12\mu v\omega^2 y_m^2$ e dobre a amplitude para ver a potência quadruplicar. Depois, com a fonte sonora, verifique a queda da intensidade com $1/r^2$.`,
      experiments: [
        { kind: "sim", id: "onda-corda", scenario: "energia-potencia", note: "Veja as energias cinética e potencial de cada elemento e compare a potência média medida com ½μvω²A²." },
        { kind: "sim", id: "onda-corda", scenario: "fixa", params: { fonte: 1, ponta: 2, T: 10, mu1: 0.1, f: 5, A: 0.2 }, note: "Acompanhe a energia na corda e compare ao dobrar a amplitude ou a frequência." },
        { kind: "sim", id: "som-intensidade", scenario: "distancia", note: "Afaste o ouvinte e confira que a intensidade cai com 1/r²." },
      ],
    },
    "16-8": {
      text: String.raw`Toda onda que se propaga sem mudar de forma, seja numa corda, no ar ou no vácuo, satisfaz a mesma equação diferencial. Para a corda, considere um elemento de comprimento $dx$ e massa $\mu\,dx$. As trações nas duas pontas têm o mesmo módulo $\tau$ (para pequenas inclinações) mas direções ligeiramente diferentes. A força vertical resultante é $\tau$ vezes a variação da inclinação:
$$F_y = \tau\left[\left(\frac{\partial y}{\partial x}\right)_{x+dx} - \left(\frac{\partial y}{\partial x}\right)_{x}\right] = \tau \frac{\partial^2 y}{\partial x^2}\,dx .$$
Pela segunda lei, $F_y = \mu\,dx\,\partial^2 y/\partial t^2$. Dividindo e usando $v = \sqrt{\tau/\mu}$:
$$\frac{\partial^2 y}{\partial x^2} = \frac{1}{v^2}\frac{\partial^2 y}{\partial t^2} .$$
Essa é a **equação de onda**. A curvatura da corda num ponto determina a aceleração daquele elemento: onde a corda é côncava para cima, o elemento acelera para cima.

### Verificação
Para $y = y_m\sin(kx - \omega t)$: $\partial^2 y/\partial x^2 = -k^2 y$ e $\partial^2 y/\partial t^2 = -\omega^2 y$. A equação é satisfeita se $k^2 = \omega^2/v^2$, isto é, $v = \omega/k$, como na seção 16-5. Qualquer função $h(x - vt)$ também a satisfaz.

### Linearidade
A equação é **linear**: se $y_1$ e $y_2$ são soluções, $y_1 + y_2$ também é. É a base matemática do princípio da superposição (seção 16-9).

**Exemplo.** Uma cadeia de massas de 20 g a cada 1,0 cm ($\mu = 2{,}0$ kg/m) ligadas por molas tensionadas a 50 N comporta-se, para comprimentos de onda bem maiores que o espaçamento, como uma corda com $v = \sqrt{50/2} = 5$ m/s. Para comprimentos de onda próximos do espaçamento, a aproximação contínua falha e a velocidade passa a depender de $\lambda$ (dispersão).

**Armadilha:** ler a equação como se dissesse que a aceleração é proporcional ao deslocamento (como no MHS). Ela é proporcional à **curvatura**.

No experimento, siga um pulso na corda com as setas de aceleração de cada elemento e de $v^2\,\partial^2y/\partial x^2$ calculado pela forma da corda: elas coincidem em todo ponto; depois veja a cadeia longa de osciladores acoplados virar um meio contínuo.`,
      experiments: [
        { kind: "sim", id: "onda-corda", scenario: "equacao-onda", note: "Compare a aceleração de cada elemento com v² vezes a curvatura da corda: são iguais, como diz a equação de onda." },
        { kind: "sim", id: "osciladores-acoplados", scenario: "cadeia", note: "Com muitas massas, veja a cadeia discreta se comportar como uma corda contínua e note a dispersão nas ondas curtas." },
        { kind: "sim", id: "onda-corda", scenario: "fixa", note: "Observe o pulso avançar sem mudar de forma, como prevê qualquer solução h(x − vt)." },
      ],
    },
    "16-9": {
      text: String.raw`Quando duas ou mais ondas passam pelo mesmo ponto ao mesmo tempo, o deslocamento resultante é a **soma algébrica** dos deslocamentos que cada uma produziria sozinha:
$$y'(x,t) = y_1(x,t) + y_2(x,t) .$$
Esse é o **princípio da superposição**, consequência da linearidade da equação de onda (seção 16-8). Ele vale enquanto as amplitudes são pequenas o bastante para que o meio responda linearmente.

### Consequências
- Ondas que se cruzam **não se alteram** mutuamente: depois do encontro, cada uma segue com a forma e a velocidade que tinha. Duas pessoas conversam numa sala cheia sem que as ondas de uma voz deformem as da outra.
- Durante o encontro, os deslocamentos se somam. Dois pulsos iguais e opostos que se cruzam produzem, num instante, uma corda reta; a energia não desapareceu, está toda na forma cinética.
- Ondas de frequências próximas somadas produzem **batimentos**; muitas ondas somadas podem formar um **pacote**. Qualquer forma periódica pode ser montada somando senoides (síntese de Fourier).

**Exemplo.** Um pulso de 3 cm para cima vindo da esquerda encontra um de 2 cm para baixo vindo da direita. Quando os picos coincidem, o deslocamento é $3 - 2 = 1$ cm para cima; logo depois os dois se separam, intactos. Somando duas ondas de 440 Hz e 444 Hz de mesma amplitude, ouve-se um som de 442 Hz cuja intensidade oscila 4 vezes por segundo.

**Armadilha:** achar que as ondas "colidem" e se refletem uma na outra, como bolas. Elas se atravessam.

No experimento, some duas ondas de comprimentos de onda próximos e veja os batimentos; depois reconstrua uma onda quadrada somando harmônicos e observe a aproximação melhorar a cada termo.`,
      experiments: [
        { kind: "sim", id: "superposicao", scenario: "batimentos", note: "Some duas ondas de comprimentos de onda próximos e meça o período dos batimentos." },
        { kind: "sim", id: "lissajous-fourier", scenario: "fourier", note: "Monte uma onda quadrada somando senoides e veja a superposição em ação." },
        { kind: "sim", id: "ondas-estacionarias", scenario: "desenho", note: "Desenhe uma forma inicial e veja-a decomposta como soma de modos que evoluem independentemente." },
      ],
    },
    "16-10": {
      text: String.raw`Considere duas ondas senoidais de mesma amplitude, frequência e comprimento de onda, que se propagam no mesmo sentido numa corda, defasadas de $\phi$:
$$y_1 = y_m\sin(kx - \omega t), \qquad y_2 = y_m\sin(kx - \omega t + \phi) .$$
Usando a identidade da soma de senos,
$$y' = \left[2 y_m \cos\tfrac{\phi}{2}\right]\sin\!\left(kx - \omega t + \tfrac{\phi}{2}\right) .$$
O resultado é outra onda senoidal, com a mesma frequência e o mesmo sentido, de amplitude $y'_m = 2y_m|\cos(\phi/2)|$. Esse efeito de combinação é a **interferência**.

### Casos
- $\phi = 0$ (ondas em fase): $y'_m = 2y_m$, **interferência construtiva** total.
- $\phi = \pi$ rad (180°, meio comprimento de onda): $y'_m = 0$, **interferência destrutiva** total; a corda fica parada.
- Valores intermediários: interferência parcial. Com $\phi = 2\pi/3$ (120°), por exemplo, $y'_m = 2y_m\cos 60° = y_m$.

A diferença de fase pode vir de uma **diferença de percurso**: ondas de duas fontes em fase que percorrem distâncias diferentes chegam defasadas de $\phi = 2\pi\,\Delta L/\lambda$. Construtiva onde $\Delta L$ é múltiplo inteiro de $\lambda$; destrutiva onde é múltiplo semi-inteiro.

**Exemplo.** Dois alto-falantes em fase emitem 680 Hz ($\lambda = 0{,}50$ m no ar). Num ponto 3,00 m de um e 3,25 m do outro, $\Delta L = 0{,}25$ m = $\lambda/2$: o som quase se cancela. A 3,50 m do segundo, $\Delta L = \lambda$ e o som é reforçado.

**Armadilha:** concluir que a energia se perde na interferência destrutiva. Ela se redistribui: o que falta nas regiões escuras (ou silenciosas) sobra nas claras.

No experimento, na cuba de ondas, coloque duas fontes em fase e localize as linhas nodais; meça as distâncias de um ponto nodal até cada fonte e confira que a diferença é meio comprimento de onda (ou 1,5, 2,5...).`,
      experiments: [
        { kind: "sim", id: "cuba-ondas", scenario: "duas", note: "Localize as linhas nodais e confira que a diferença de percurso ali é um múltiplo semi-inteiro de λ." },
        { kind: "sim", id: "lissajous-fourier", scenario: "fasores", params: { fx: 1, fy: 1, A: 5, B: 5, fase: 180 }, note: "Some dois MHS iguais e varie a fase de 0 a 180° para ir da construtiva à destrutiva." },
      ],
    },
    "16-11": {
      text: String.raw`Somar ondas com amplitudes diferentes pela trigonometria fica trabalhoso. Uma alternativa geométrica é o **fasor**: um vetor de comprimento igual à amplitude da onda que gira em torno da origem com velocidade angular $\omega$. A projeção do fasor sobre o eixo vertical dá o deslocamento $y$ de um ponto da corda, exatamente como no círculo de referência do MHS (seção 15-7).

### Somando ondas de mesma frequência
Duas ondas $y_1 = y_{m1}\sin(kx - \omega t)$ e $y_2 = y_{m2}\sin(kx - \omega t + \phi)$ são representadas por dois fasores que giram juntos, separados pelo ângulo $\phi$. Como giram com a mesma $\omega$, o ângulo entre eles não muda, e a soma vetorial dos fasores é um fasor também girante:
- seu comprimento é a amplitude $y'_m$ da onda resultante;
- seu ângulo em relação ao primeiro é a constante de fase $\beta$ da resultante.
Pela lei dos cossenos,
$$y'^2_m = y_{m1}^2 + y_{m2}^2 + 2y_{m1}y_{m2}\cos\phi .$$
Com amplitudes iguais, volta-se ao resultado da seção 16-10.

**Exemplo.** Duas ondas de amplitudes 4,0 mm e 3,0 mm, defasadas de 90°: os fasores formam um triângulo retângulo e $y'_m = 5{,}0$ mm, com $\beta = \arctan(3/4) \approx 37°$ em relação à primeira. Se estiverem em oposição de fase, $y'_m = 1{,}0$ mm.

### Mais de duas ondas
O método se estende: somam-se os fasores um após o outro, ponta com cauda. Será a ferramenta para a difração por fendas e redes (capítulo 36) e para circuitos de corrente alternada (capítulo 31).

**Armadilha:** somar amplitudes como números quando as ondas estão defasadas. 4 mm + 3 mm só dá 7 mm se as ondas estiverem em fase.

No experimento, some duas ondas progressivas de mesma frequência e amplitudes diferentes: os fasores giram juntos, a resultante tem comprimento dado pela lei dos cossenos e a onda resultante, desenhada embaixo, tem essa amplitude e a fase $\beta$; mude $\phi$ de 0 a 180°.`,
      experiments: [
        { kind: "sim", id: "superposicao", scenario: "fasores", note: "Mude a diferença de fase φ e confira A′ e β pela soma dos fasores e na onda resultante." },
        { kind: "sim", id: "lissajous-fourier", scenario: "fasores", params: { fx: 1, fy: 1, A: 4, B: 3, fase: 90 }, note: "Some amplitudes 4 e 3 defasadas de 90° e confira a resultante 5 pela soma dos fasores." },
        { kind: "sim", id: "mhs", scenario: "circulo", params: { fasores: 1 }, note: "Reveja o fasor girante e sua projeção, a base do método." },
      ],
    },
    "16-12": {
      text: String.raw`Duas ondas senoidais iguais que se propagam em **sentidos opostos** se superpõem assim:
$$y' = y_m\sin(kx - \omega t) + y_m\sin(kx + \omega t) = \left[2y_m\sin kx\right]\cos\omega t .$$
A expressão não tem a forma $h(kx \pm \omega t)$: o padrão não anda. É uma **onda estacionária**. Cada elemento oscila em MHS com amplitude $2y_m|\sin kx|$, que depende da posição.

### Nós e antinós
- **Nós:** pontos de amplitude zero, onde $\sin kx = 0$: $x = n\lambda/2$ ($n = 0, 1, 2, \ldots$). Permanecem parados.
- **Antinós (ventres):** amplitude máxima $2y_m$, a meio caminho entre nós: $x = (n + \tfrac12)\lambda/2$.
Nós vizinhos (ou antinós vizinhos) estão a $\lambda/2$ um do outro. A energia não flui ao longo da corda: fica oscilando entre cinética e potencial em cada trecho.

### Reflexão nas extremidades
Na prática, a segunda onda vem da **reflexão** da primeira numa extremidade:
- **extremidade fixa:** a corda não pode se mover, e o pulso refletido volta **invertido** (a parede puxa para o lado oposto). A extremidade é um nó.
- **extremidade livre** (anel que desliza numa haste sem atrito): o pulso volta **sem inversão**; a extremidade é um antinó.
Entre cordas de densidades diferentes, há reflexão parcial; ela inverte quando a onda vai para a corda mais pesada.

**Exemplo.** Numa corda com $\lambda = 0{,}40$ m formando onda estacionária a partir de uma parede, os nós estão em 0, 20, 40, 60 cm da parede e os antinós em 10, 30, 50 cm. Se cada onda tem $y_m = 5$ mm, os antinós oscilam com 10 mm.

**Armadilha:** pensar que a corda nos nós "não tem onda". As duas ondas progressivas passam por ali; elas apenas se cancelam o tempo todo.

No experimento, mande pulsos contra a ponta fixa e contra a ponta livre e compare o pulso refletido; depois escolha um modo normal da corda e localize os nós e ventres.`,
      experiments: [
        { kind: "sim", id: "onda-corda", scenario: "fixa", note: "Veja o pulso voltar invertido na ponta fixa." },
        { kind: "sim", id: "onda-corda", scenario: "livre", note: "Compare com a ponta livre, onde o pulso volta sem inversão." },
        { kind: "sim", id: "ondas-estacionarias", scenario: "modo", note: "Num modo normal, localize os nós parados e os ventres com amplitude máxima." },
      ],
    },
    "16-13": {
      text: String.raw`Numa corda presa nas duas pontas, separadas por $L$, as ondas refletidas de um lado a outro só formam um padrão estacionário estável se as duas pontas forem nós. Isso exige que $L$ contenha um número inteiro de meios comprimentos de onda:
$$L = n\frac{\lambda}{2} \quad\Longrightarrow\quad \lambda_n = \frac{2L}{n}, \qquad f_n = \frac{v}{\lambda_n} = n\frac{v}{2L},\quad n = 1, 2, 3, \ldots$$
Essas são as **frequências de ressonância** da corda. Se a corda for excitada numa delas, as ondas refletidas se reforçam e a amplitude cresce muito; em outras frequências, o padrão é pequeno e irregular.

### Série harmônica
- $n = 1$: **modo fundamental** ou **primeiro harmônico**, um único ventre, $f_1 = v/2L$.
- $n = 2$: segundo harmônico, com um nó no meio, $f_2 = 2f_1$.
- O conjunto dos modos é a **série harmônica**. As frequências são múltiplos inteiros da fundamental.

### Instrumentos
Uma corda de violão dedilhada vibra numa **combinação** de vários harmônicos ao mesmo tempo; a nota percebida é a fundamental, e a mistura de harmônicos define o **timbre**. Dedilhar perto da ponte excita mais harmônicos altos (som mais brilhante); dedilhar no meio não excita os harmônicos pares, que têm nó ali. Apertar a corda no braço encurta $L$ e sobe a nota; afinar muda a tensão e, portanto, $v$.

**Exemplo.** A corda de aço da seção 16-6 ($v \approx 216$ m/s, $L = 0{,}65$ m) tem fundamental $f_1 = 216/1{,}30 \approx 166$ Hz e harmônicos 332 Hz, 498 Hz, ... Para subir a nota a 196 Hz sem mudar a corda, a tensão precisa crescer pelo fator $(196/166)^2 \approx 1{,}39$.

**Armadilha:** concluir que a corda dedilhada vibra só no modo fundamental. Quase sempre há vários modos superpostos.

No experimento, dedilhe a corda no meio e perto da ponte e compare os espectros de harmônicos; excite um modo $n$ e confira $f_n = n\,v/2L$; nas figuras de Chladni, veja ressonâncias de uma placa em duas dimensões.`,
      experiments: [
        { kind: "sim", id: "ondas-estacionarias", scenario: "meio", note: "Dedilhe no meio e veja que os harmônicos pares não aparecem no espectro." },
        { kind: "sim", id: "ondas-estacionarias", scenario: "ponte", note: "Dedilhe perto da ponte e compare o timbre e o peso dos harmônicos altos." },
        { kind: "sim", id: "ondas-estacionarias", scenario: "modo", params: { n: 2 }, note: "Excite o segundo harmônico e confira f₂ = 2f₁ com um nó no meio." },
        { kind: "pratica", id: "exp2-melde", note: "Roteiro de bancada do experimento de Melde: frequências de ressonância de uma corda." },
        { kind: "sim", id: "chladni-membranas", note: "Excite uma placa em frequências de ressonância e veja as linhas nodais em duas dimensões." },
      ],
    },
  },
};
