import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 39,
  intro: String.raw`O capítulo anterior mostrou que um elétron se propaga como onda. Aqui vemos a consequência mais importante disso: quando a onda de um elétron fica **confinada** numa região, só certos padrões de onda estacionária cabem nela, e a energia do elétron fica **quantizada**. É a mesma razão pela qual uma corda de violão presa nas pontas só vibra em certas frequências. Começamos pelo modelo mais simples, o poço de paredes infinitas, passamos ao poço finito e a armadilhas reais (nanocristais, pontos quânticos, currais de átomos), estendemos a ideia para duas e três dimensões e chegamos ao sistema que deu origem a tudo: o átomo de hidrogênio, primeiro no modelo de Bohr e depois pela equação de Schrödinger. Os níveis de energia calculados aqui explicam as linhas espectrais, a cor dos LEDs e dos pontos quânticos e a estrutura da tabela periódica (capítulo 40).`,
  sections: {
    "39-2": {
      text: String.raw`Uma corda de comprimento $L$ presa nas duas pontas não vibra com qualquer comprimento de onda. Como as extremidades são nós, só cabem ondas estacionárias em que um número inteiro de meios comprimentos de onda ocupa a corda:

$$L = n\,\frac{\lambda}{2},\qquad n = 1, 2, 3, \dots$$

Cada $n$ é um **modo**, com sua frequência própria (capítulo 16). Uma onda solta, sem fronteiras, pode ter qualquer frequência; a quantização vem do **confinamento**.

Com ondas de matéria acontece o mesmo. Um elétron preso entre duas paredes impenetráveis tem função de onda nula nas paredes, então só são permitidos comprimentos de onda de de Broglie que satisfazem a mesma condição da corda. Como $\lambda = h/p$ fixa o momento e o momento fixa a energia cinética, **só certas energias são possíveis**. Esse é o princípio geral do capítulo:

- **confinamento de uma onda leva à quantização**: estados discretos, cada um rotulado por um **número quântico** inteiro;
- quanto mais apertado o confinamento, mais espaçados os níveis.

Exemplo: na corda de $0{,}65$ m de um violão, os modos têm $\lambda = 1{,}30$ m, $0{,}65$ m, $0{,}43$ m... Para um elétron numa caixa de $0{,}65$ nm (um bilhão de vezes menor), os comprimentos de onda permitidos seguem exatamente a mesma sequência, só que em nanômetros.

As diferenças também importam. Na corda, a grandeza que oscila é o deslocamento, que vemos diretamente; no elétron, é a função de onda, e o que se mede é $|\psi|^2$, a probabilidade de encontrá-lo. Além disso, a energia da corda num modo pode ser qualquer (depende da amplitude); a do elétron fica determinada pelo modo.

Armadilha: achar que a quantização é uma propriedade misteriosa "do elétron". É uma propriedade de qualquer onda confinada; o novo, na física quântica, é que a energia da partícula está ligada ao comprimento de onda.

No experimento, compare os modos normais da corda, com seus nós e ventres, com as autofunções do poço infinito: os desenhos são os mesmos.`,
      experiments: [
        { kind: "sim", id: "ondas-estacionarias", scenario: "modo", note: "Veja os modos normais da corda presa e conte os nós de cada um." },
        { kind: "sim", id: "poco-quantico", scenario: "infinito", note: "Compare as autofunções do poço infinito com os modos da corda." },
        { kind: "pratica", id: "exp2-melde", note: "Na bancada, encontre as frequências em que a corda entra em ressonância." },
      ],
    },
    "39-3": {
      text: String.raw`Considere um elétron preso num **poço de potencial infinito** unidimensional: energia potencial nula entre $x = 0$ e $x = L$ e infinita fora. Dentro, ele é livre; as paredes exigem $\psi = 0$ nas bordas. Pela seção 39-2, $\lambda = 2L/n$; com $p = h/\lambda$ e $E = p^2/2m$:

$$E_n = \frac{h^2}{8mL^2}\,n^2,\qquad n = 1, 2, 3, \dots$$

Três conclusões:

- os níveis crescem com $n^2$: o espaçamento **aumenta** para cima;
- a energia escala com $1/L^2$: confinar mais aumenta muito as energias;
- o estado de menor energia, o **fundamental** ($n = 1$), não tem energia zero. Essa **energia de ponto zero** é exigida pelo princípio de indeterminação: um elétron localizado em $L$ não pode ter momento nulo. $n = 0$ não é permitido, pois daria $\psi = 0$ em toda parte (nenhum elétron).

O elétron pode passar de um nível a outro absorvendo ou emitindo um fóton de energia exatamente igual à diferença:

$$hf = \Delta E = E_{\text{alto}} - E_{\text{baixo}}.$$

Exemplo: para $L = 0{,}50$ nm, $h^2/8mL^2 = (6{,}63\times10^{-34})^2/(8\cdot9{,}11\times10^{-31}\cdot2{,}5\times10^{-19}) \approx 2{,}4\times10^{-19}$ J $\approx 1{,}5$ eV. Então $E_1 = 1{,}5$ eV, $E_2 = 6{,}0$ eV, $E_3 = 13{,}5$ eV. O salto de $n = 1$ para $n = 2$ exige um fóton de $4{,}5$ eV, com $\lambda = 1240/4{,}5 \approx 276$ nm (ultravioleta). Dobrando $L$, todas as energias caem a um quarto.

Armadilha: aplicar a fórmula a uma bola numa caixa e esperar níveis visíveis. Para $m = 1$ g e $L = 1$ cm, $h^2/8mL^2 \sim 10^{-60}$ J: os níveis são tão próximos que formam um contínuo, e a física clássica volta a valer.

No experimento, leia $E_1$, $E_2$ e $E_3$ e confirme a razão $1 : 4 : 9$; depois aumente a largura e veja todos os níveis descerem como $1/L^2$.`,
      experiments: [
        { kind: "sim", id: "poco-quantico", scenario: "infinito", note: "Leia os níveis e confira que crescem como n²." },
        { kind: "sim", id: "poco-quantico", scenario: "infinito", params: { L: 4 }, note: "Dobre a largura do poço e verifique que as energias caem a um quarto." },
      ],
    },
    "39-4": {
      text: String.raw`Resolvendo a equação de Schrödinger dentro do poço infinito com $\psi(0) = \psi(L) = 0$, obtêm-se as **funções de onda**

$$\psi_n(x) = A\,\sin\!\left(\frac{n\pi x}{L}\right),\qquad 0 \le x \le L,$$

e $\psi = 0$ fora. São exatamente os modos da corda. O que tem significado físico é a **densidade de probabilidade** $|\psi_n|^2 = A^2\sin^2(n\pi x/L)$. A constante $A$ vem da **normalização**, $\int_0^L|\psi_n|^2dx = 1$, que dá $A = \sqrt{2/L}$.

Algumas leituras:

- o estado $n$ tem $n - 1$ **nós** internos, pontos onde o elétron **nunca** é encontrado;
- no estado fundamental, o elétron é mais provável no centro; no estado $n = 2$, o centro é um nó, e os máximos ficam a $L/4$ e $3L/4$;
- para $n$ grande, as oscilações ficam tão finas que a média de $|\psi|^2$ se torna uniforme, como na previsão clássica de uma partícula quicando entre paredes. É o **princípio da correspondência**: a física quântica tende à clássica para números quânticos grandes.

Exemplo: a probabilidade de encontrar o elétron no terço central do poço ($L/3 < x < 2L/3$) é $\int|\psi|^2dx$ sobre esse intervalo. Para $n = 1$, dá cerca de $0{,}61$; classicamente seria $1/3$. Para $n = 2$, só $0{,}20$, porque o nó está bem no meio. Para $n = 3$, exatamente $1/3$, por simetria.

Um estado que é **superposição** de dois níveis, como $\psi_1$ e $\psi_2$, não é estacionário: as duas componentes evoluem com fases $e^{-iE_nt/\hbar}$ diferentes, e $|\psi|^2$ oscila de um lado para outro com frequência $(E_2 - E_1)/h$. É assim que um elétron "se move" num poço.

Armadilha: perguntar "como o elétron passa de um lado do nó para o outro se nunca está no nó?". A pergunta supõe uma trajetória; o elétron não tem trajetória definida, só uma distribuição de probabilidade.

No experimento, mostre as densidades $|\psi_n|^2$ e conte os nós; depois escolha a superposição de dois níveis e veja a probabilidade oscilar.`,
      experiments: [
        { kind: "sim", id: "poco-quantico", scenario: "infinito", params: { mostrar: 1 }, note: "Mostre |ψₙ|² e conte os nós de cada estado." },
        { kind: "sim", id: "poco-quantico", scenario: "infinito", params: { mostrar: 2, n1: 1, n2: 2 }, note: "Superponha os níveis 1 e 2 e veja a probabilidade oscilar no tempo." },
      ],
    },
    "39-5": {
      text: String.raw`Um poço real tem paredes de altura finita $U_0$. Dentro do poço ($E < U_0$), a solução de Schrödinger continua oscilante; fora, na região classicamente proibida, ela não cai a zero de repente, mas decai exponencialmente,

$$\psi(x) \propto e^{-bx},\qquad b = \frac{\sqrt{2m(U_0 - E)}}{\hbar},$$

como na barreira do efeito túnel (seção 38-9). A função de onda e sua derivada precisam ser contínuas nas paredes. Consequências:

- o elétron tem probabilidade não nula de estar **fora** do poço, numa faixa de espessura da ordem de $1/b$ (penetração);
- como a onda "vaza", o comprimento de onda efetivo é um pouco maior que no poço infinito de mesma largura, e **todas as energias ficam menores**;
- o número de estados ligados é **finito**: só os níveis com $E < U_0$ ficam presos. Acima de $U_0$, o elétron não está confinado e pode ter qualquer energia (contínuo);
- um poço finito sempre tem pelo menos um estado ligado, por mais raso que seja.

Exemplo: tome um poço de largura $0{,}50$ nm, cujo análogo infinito tem níveis $1{,}5$, $6{,}0$ e $13{,}5$ eV, com profundidade $U_0 = 10$ eV. Resolvendo as condições de continuidade, encontram-se três estados ligados, com cerca de $1{,}0$, $3{,}8$ e $8{,}0$ eV: todos abaixo dos do poço infinito, e o terceiro ainda preso, embora seu análogo infinito ficasse acima de $U_0$. Um fóton com energia maior que $U_0 - E_1 \approx 9$ eV libera o elétron do estado fundamental.

Armadilha: achar que a penetração viola a conservação de energia, porque na região de fora a energia cinética "seria negativa". Não há como medir o elétron lá sem dar a ele energia suficiente; a penetração só aparece como probabilidade de detecção.

No experimento, compare os níveis do poço finito com os do infinito, veja as caudas exponenciais além das paredes e reduza $U_0$ até restar apenas um estado ligado.`,
      experiments: [
        { kind: "sim", id: "poco-quantico", scenario: "finito", note: "Veja as caudas de ψ penetrando nas paredes e compare os níveis com o poço infinito." },
        { kind: "sim", id: "poco-quantico", scenario: "finito", params: { V0: 2 }, note: "Reduza a profundidade e veja o número de estados ligados diminuir." },
      ],
    },
    "39-6": {
      text: String.raw`Poços de potencial não são só exercícios: hoje se fabricam armadilhas para elétrons com dimensões de nanômetros, e a quantização aparece em propriedades visíveis.

### Nanocristais
Um cristal semicondutor muito pequeno funciona como um poço. A energia mínima que ele absorve aumenta quando o tamanho diminui (como $1/L^2$, seção 39-3). Assim, o mesmo material, moído em grãos cada vez menores, passa a absorver só luz de comprimento de onda cada vez mais curto, e sua **cor muda com o tamanho**. Pós de seleneto de cádmio vão do preto ao amarelo conforme o grão encolhe.

### Pontos quânticos
Um **ponto quântico** é uma ilha de semicondutor com alguns nanômetros, envolta por outro material de gap maior, que confina elétrons nas três direções. Os níveis são discretos como os de um átomo ("átomos artificiais") e são ajustados pelo tamanho. Pontos quânticos de $2$ nm emitem azul; os de $6$ nm, vermelho. São usados em telas de TV, marcadores biológicos e lasers. Em escala de engenharia, uma camada fina entre dois materiais forma um **poço quântico**, base dos lasers de diodo dos leitores ópticos e das comunicações por fibra.

### Currais quânticos
Com a ponta de um microscópio de tunelamento, é possível empurrar átomos sobre uma superfície metálica e montar um anel deles. Elétrons da superfície ficam presos dentro do anel, e o mesmo microscópio mostra ondulações concêntricas: a densidade de probabilidade de uma onda estacionária circular.

Exemplo: modelando um ponto quântico como poço infinito com $L = 4{,}0$ nm, $h^2/8mL^2 \approx 0{,}024$ eV (usando a massa do elétron livre). Reduzir $L$ para $2{,}0$ nm quadruplica as energias de confinamento. Em materiais reais, a massa efetiva menor amplia ainda mais o efeito.

Armadilha: pensar que só a composição química define a cor. Nesses sistemas, o tamanho é tão importante quanto o material.

No experimento, mude o raio de um nanocristal de CdSe e veja a cor emitida ir do vermelho ao azul à medida que ele encolhe; desenhe o seu próprio potencial (um degrau, dois poços) e veja como os níveis se rearranjam; no oscilador harmônico, outro tipo de armadilha, observe níveis igualmente espaçados; no LED, ligue a energia do gap à cor emitida.`,
      experiments: [
        { kind: "sim", id: "poco-quantico", scenario: "pontos-quanticos", note: "Mude o tamanho do ponto quântico e veja a cor da luz emitida mudar." },
        { kind: "sim", id: "poco-quantico", scenario: "desenhar", note: "Desenhe uma armadilha qualquer e veja os níveis e as funções de onda que ela admite." },
        { kind: "sim", id: "poco-quantico", scenario: "oscilador", note: "Compare uma armadilha parabólica com o poço quadrado: níveis igualmente espaçados." },
        { kind: "sim", id: "semicondutores", scenario: "led", note: "Mude a energia do gap e veja a cor emitida mudar, como num ponto quântico de outro tamanho." },
      ],
    },
    "39-7": {
      text: String.raw`Uma armadilha pode confinar o elétron em mais de uma direção. O caso mais simples é o **curral retangular**: um poço infinito bidimensional com lados $L_x$ e $L_y$. Dentro, o elétron é livre nas duas direções; a equação de Schrödinger se separa, e cada direção dá sua própria quantização. A energia é a soma:

$$E_{n_x,n_y} = \frac{h^2}{8m}\left(\frac{n_x^2}{L_x^2} + \frac{n_y^2}{L_y^2}\right),$$

com **dois números quânticos** independentes, ambos a partir de $1$. A função de onda é o produto $\sin(n_x\pi x/L_x)\,\sin(n_y\pi y/L_y)$, com linhas nodais retas paralelas aos lados. Na **caixa** tridimensional, acrescenta-se o termo $n_z^2/L_z^2$ e um terceiro número quântico.

Numa caixa **quadrada** ($L_x = L_y = L$), aparece a **degenerescência**: estados diferentes com a mesma energia. Os estados $(1,2)$ e $(2,1)$ têm ambos $E = 5\,h^2/8mL^2$, mas funções de onda giradas de $90°$. A degenerescência sempre vem de uma simetria; ao alongar um dos lados, ela se desfaz.

Exemplo: num curral quadrado com $h^2/8mL^2 = 0{,}50$ eV, os primeiros níveis são $(1,1)$: $1{,}0$ eV; $(1,2)$ e $(2,1)$: $2{,}5$ eV; $(2,2)$: $4{,}0$ eV; $(1,3)$ e $(3,1)$: $5{,}0$ eV. A transição de $(2,2)$ para $(1,1)$ emite um fóton de $3{,}0$ eV ($413$ nm, violeta).

Armadilha: somar os números quânticos ($n_x + n_y$) para ordenar os níveis. O que conta é $n_x^2 + n_y^2$ (ponderado pelos lados): $(1,3)$ fica acima de $(2,2)$ apesar de ambos somarem $4$.

O simulador resolve poços em uma dimensão; a separação de variáveis significa que cada direção do curral se comporta como um desses poços. A degenerescência em três dimensões, por sua vez, aparece de forma clara no átomo de hidrogênio.

No experimento, veja os níveis $E_{n_x,n_y}$ de um poço quadrado e de uma caixa cúbica, com os estados de mesma energia agrupados, e desfaça a degenerescência tornando a caixa retangular; depois, no hidrogênio, veja orbitais diferentes com a mesma energia e conte os nós.`,
      experiments: [
        { kind: "sim", id: "poco-quantico", scenario: "caixa-2d", note: "Conte os estados de cada nível no poço 2D e na caixa 3D e veja o mapa de |ψ|²." },
        { kind: "sim", id: "poco-quantico", scenario: "infinito", note: "Use os níveis 1D de cada direção para montar os níveis de um curral retangular." },
        { kind: "sim", id: "hidrogenio", scenario: "nos", note: "Veja estados degenerados em três dimensões: formas diferentes, mesma energia." },
      ],
    },
    "39-8": {
      text: String.raw`O hidrogênio aquecido numa lâmpada de descarga emite luz em comprimentos de onda bem definidos, as **linhas espectrais**. No visível aparece a **série de Balmer** ($656$, $486$, $434$, $410$ nm), e todas as linhas obedecem a uma regra empírica simples. Em 1913, Bohr a explicou com um modelo híbrido:

- o elétron gira em órbita circular em torno do próton, preso pela força de Coulomb;
- só são permitidas órbitas em que o momento angular é múltiplo de $\hbar$: $L = n\hbar$;
- nessas órbitas, o elétron não irradia; um fóton é emitido ou absorvido apenas num salto entre órbitas, com $hf = E_{\text{alto}} - E_{\text{baixo}}$.

Combinando a força centrípeta com a quantização, os raios são $r_n = n^2a$, com o **raio de Bohr** $a = 52{,}9$ pm, e as energias

$$E_n = -\frac{me^4}{8\varepsilon_0^2h^2}\,\frac{1}{n^2} = -\frac{13{,}6\ \mathrm{eV}}{n^2}.$$

A energia é negativa porque o elétron está ligado; $13{,}6$ eV é a **energia de ionização** a partir do estado fundamental. Os comprimentos de onda emitidos seguem

$$\frac{1}{\lambda} = R\left(\frac{1}{n_{\text{baixo}}^2} - \frac{1}{n_{\text{alto}}^2}\right),$$

com $R = 1{,}097\times10^7$ m⁻¹ (constante de Rydberg). Saltos até $n = 1$ formam a série de **Lyman** (ultravioleta); até $n = 2$, a de **Balmer** (visível); até $n = 3$, a de **Paschen** (infravermelho).

Exemplo: de $n = 3$ para $n = 2$, $\Delta E = 13{,}6(1/4 - 1/9) = 1{,}89$ eV, e $\lambda = 1240/1{,}89 \approx 656$ nm: a linha vermelha $\mathrm H_\alpha$.

O modelo acerta as energias do hidrogênio (e de íons com um elétron, trocando $e^4$ por $Z^2e^4$), mas falha para átomos com mais elétrons e não explica as intensidades das linhas. A imagem de órbitas definidas foi abandonada; a quantização da energia permaneceu.

Armadilha: imaginar o elétron como um planetinha numa trajetória circular nítida. A mecânica quântica (seção 39-9) substitui a órbita por uma distribuição de probabilidade.

No experimento, escolha os níveis inicial e final e veja a linha emitida; meça a série de Balmer com o espectroscópio e confira a constante de Rydberg.`,
      experiments: [
        { kind: "sim", id: "modelos-atomicos", scenario: "balmer", note: "Escolha saltos entre níveis e confira os comprimentos de onda da série de Balmer." },
        { kind: "sim", id: "espectroscopia", scenario: "balmer", note: "Meça os ângulos das linhas do hidrogênio e obtenha a constante de Rydberg." },
        { kind: "sim", id: "franck-hertz", scenario: "mercurio", note: "Veja a quantização da energia atômica nas quedas periódicas de corrente." },
        { kind: "concepcao", id: "orbitas-bohr-planetas" },
      ],
    },
    "39-9": {
      text: String.raw`A descrição correta do hidrogênio vem da equação de Schrödinger em três dimensões com a energia potencial de Coulomb, $U(r) = -e^2/(4\pi\varepsilon_0r)$. O resultado surpreendente é que as energias permitidas são **as mesmas** do modelo de Bohr,

$$E_n = -\frac{13{,}6\ \mathrm{eV}}{n^2},$$

mas cada estado é uma função de onda $\psi_{n\ell m_\ell}$ caracterizada por **três números quânticos**:

- $n = 1, 2, 3, \dots$ (principal): fixa a energia;
- $\ell = 0, 1, \dots, n-1$ (orbital): fixa o módulo do momento angular, $L = \sqrt{\ell(\ell+1)}\,\hbar$;
- $m_\ell = -\ell, \dots, +\ell$ (magnético orbital): fixa a componente $L_z = m_\ell\hbar$.

Os estados com $\ell = 0, 1, 2, 3$ são chamados s, p, d, f. Para cada $n$ há $n^2$ estados com a mesma energia (sem contar o spin, capítulo 40): degenerescência que vem da simetria esférica da força de Coulomb.

No **estado fundamental** ($n = 1$, $\ell = 0$), $\psi_{100} = e^{-r/a}/\sqrt{\pi a^3}$. A probabilidade de achar o elétron numa casca entre $r$ e $r + dr$ é a **densidade radial**

$$P(r) = 4\pi r^2|\psi|^2 = \frac{4r^2}{a^3}\,e^{-2r/a},$$

que tem máximo exatamente em $r = a$, o raio de Bohr. Mas o elétron não está "em" $r = a$: pode estar mais perto ou mais longe, e o valor médio é $1{,}5a$. A própria $|\psi|^2$ é máxima no núcleo; o fator $r^2$ (área da casca) é que desloca o máximo de $P(r)$.

Exemplo: a probabilidade de encontrar o elétron do estado fundamental além de $r = 2a$ é $13e^{-4} \approx 0{,}24$; além de $5a$, menos de $0{,}3\%$.

Os estados com $\ell > 0$ têm formas angulares: os orbitais p são lóbulos alinhados com um eixo, os d têm quatro lóbulos ou um anel. O número de nós é $n - 1$ ao todo, divididos entre nós radiais ($n - \ell - 1$) e angulares ($\ell$).

Armadilha: confundir $|\psi|^2$ (densidade por volume) com $P(r)$ (densidade por distância radial) e concluir que o elétron "evita" o núcleo ou "mora" no raio de Bohr.

No experimento, veja a nuvem de pontos do estado 1s e o gráfico de $P(r)$; passe para 2p e 3d e conte os nós radiais e angulares.`,
      experiments: [
        { kind: "sim", id: "hidrogenio", scenario: "1s", note: "Amostre o estado fundamental e localize o máximo de P(r) no raio de Bohr." },
        { kind: "sim", id: "hidrogenio", scenario: "2p", note: "Compare os orbitais 2p complexos e reais e relacione-os com m_ℓ." },
        { kind: "sim", id: "hidrogenio", scenario: "3d", note: "Explore as formas dos orbitais 3d e seus nós angulares." },
        { kind: "sim", id: "modelos-atomicos", scenario: "lampada", note: "Ligue os níveis de energia ao espectro observado da lâmpada de hidrogênio." },
      ],
    },
  },
};
