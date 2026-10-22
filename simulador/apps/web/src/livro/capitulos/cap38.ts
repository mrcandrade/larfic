import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 38,
  intro: String.raw`Até aqui a luz foi uma onda eletromagnética, e o elétron, uma partícula com massa e carga. No começo do século XX, uma série de experimentos mostrou que as duas imagens estão incompletas: a luz troca energia e momento em pacotes indivisíveis, os **fótons**, e os elétrons formam franjas de interferência como uma onda. Este capítulo apresenta essas descobertas e a teoria que as reúne, a **mecânica quântica**: a energia do fóton, o efeito fotoelétrico, o momento da luz e o efeito Compton, a interpretação probabilística, o comprimento de onda de de Broglie, a equação de Schrödinger, o princípio de indeterminação e o efeito túnel. Tudo o que vem depois (átomos, sólidos, núcleos) se apoia nessas ideias, e boa parte da tecnologia atual (LEDs, câmeras digitais, microscópios eletrônicos, memórias flash) também.`,
  sections: {
    "38-2": {
      text: String.raw`Em 1905, Einstein propôs que a energia de uma onda luminosa de frequência $f$ não se distribui de forma contínua: ela vem em porções, os **quanta de luz**, hoje chamados **fótons**. Cada fóton carrega a energia

$$E = hf = \frac{hc}{\lambda},$$

em que $h = 6{,}63\times10^{-34}$ J·s é a **constante de Planck**. A ideia nasceu do trabalho de Planck sobre a radiação de corpo negro: para reproduzir o espectro medido, ele teve de supor que as paredes da cavidade só trocam energia com a radiação em múltiplos de $hf$. Sem essa hipótese, a teoria clássica prevê uma emissão que cresce sem limite no ultravioleta.

Na prática, é cômodo usar $hc \approx 1240$ eV·nm. Um fóton de luz verde ($\lambda = 530$ nm) tem $E = 1240/530 \approx 2{,}3$ eV; um fóton de micro-ondas de $12$ cm tem só $10^{-5}$ eV; um de raios X de $0{,}1$ nm, cerca de $12$ keV. Uma lâmpada LED que emite $1$ W de luz verde lança $1/(2{,}3\cdot1{,}6\times10^{-19}) \approx 2{,}7\times10^{18}$ fótons por segundo. Esse número enorme explica por que, no dia a dia, a luz parece contínua.

O fóton não tem massa, viaja sempre a $c$ e não pode ser dividido: ou é absorvido inteiro, ou não é absorvido. Uma luz mais intensa, na mesma frequência, tem **mais fótons**, e não fótons mais energéticos.

Armadilha: pensar que $E = hf$ só vale para luz visível. Vale para toda a radiação eletromagnética, das ondas de rádio aos raios gama; o que muda é o tamanho do quantum diante das energias envolvidas.

No experimento, aqueça o corpo negro e compare o espectro de Planck com a curva clássica, que diverge no ultravioleta; depois, nas moléculas, veja fótons de energias diferentes chegando um a um.`,
      experiments: [
        { kind: "sim", id: "corpo-negro", scenario: "catastrofe", note: "Compare o espectro de Planck com a previsão clássica e veja onde a quantização faz diferença." },
        { kind: "sim", id: "moleculas-luz", scenario: "micro-ondas", note: "Dispare fótons um a um e relacione a energia hf de cada um com o que a molécula faz." },
      ],
    },
    "38-3": {
      text: String.raw`Quando luz incide sobre um metal limpo, elétrons podem ser arrancados da superfície: é o **efeito fotoelétrico**. Numa célula fotoelétrica, os elétrons ejetados do catodo são coletados por um anodo; aplicando uma tensão que freia os elétrons, encontra-se o **potencial de corte** $V_0$, a partir do qual nem os mais rápidos chegam ao anodo. Então $eV_0 = K_{\max}$.

Os resultados contrariam a teoria ondulatória. Primeiro: $K_{\max}$ **não depende da intensidade** da luz, só da frequência. Segundo: existe uma **frequência de corte** $f_0$ abaixo da qual nenhum elétron sai, por mais intensa que seja a luz. Terceiro: a emissão começa sem atraso perceptível, mesmo com luz fraca.

A explicação de Einstein: cada elétron absorve **um** fóton. Parte da energia $hf$ serve para vencer a ligação com o metal, a **função trabalho** $\Phi$; o resto vira energia cinética:

$$hf = K_{\max} + \Phi \quad\Rightarrow\quad V_0 = \frac{h}{e}f - \frac{\Phi}{e}.$$

O gráfico de $V_0$ contra $f$ é uma reta de inclinação $h/e$, **a mesma para todos os metais**; só o ponto de corte $f_0 = \Phi/h$ muda. Foi assim que Millikan, tentando refutar Einstein, acabou medindo $h$.

Exemplo: um metal com $\Phi = 2{,}3$ eV iluminado com luz de $400$ nm ($hf = 3{,}10$ eV) emite elétrons com $K_{\max} = 0{,}80$ eV, logo $V_0 = 0{,}80$ V. O comprimento de onda de corte é $\lambda_0 = 1240/2{,}3 \approx 540$ nm: luz vermelha, por mais forte, não arranca nada.

Armadilha: achar que luz mais intensa arranca elétrons mais rápidos. A intensidade aumenta o **número** de fótons e, portanto, a corrente; a energia de cada elétron depende só de $f$.

No experimento, ajuste a tensão até a corrente zerar para vários comprimentos de onda, faça o gráfico de $V_0$ contra $f$ e obtenha $h$ e $\Phi$; depois troque o metal e veja a reta se deslocar sem mudar a inclinação.`,
      experiments: [
        { kind: "sim", id: "fotoeletrico", scenario: "corte", note: "Varie a tensão até a corrente zerar e registre o potencial de corte." },
        { kind: "sim", id: "fotoeletrico", scenario: "millikan", note: "Ajuste V₀ contra f por mínimos quadrados e meça a constante de Planck." },
        { kind: "sim", id: "fotoeletrico", scenario: "limiar", note: "Abaixo da frequência de corte, aumente a intensidade e veja que nada sai." },
        { kind: "pratica", id: "exp3-fotoeletrico", note: "Roteiro de bancada: potencial de corte para várias cores e medida de h." },
        { kind: "concepcao", id: "luz-intensa-arranca-eletron" },
      ],
    },
    "38-4": {
      text: String.raw`Se o fóton carrega energia $E = hf$ e viaja à velocidade da luz, a relatividade diz que ele também carrega **momento**:

$$p = \frac{E}{c} = \frac{h}{\lambda}.$$

Um fóton visível tem momento minúsculo (cerca de $10^{-27}$ kg·m/s), mas a soma de muitos dá a **pressão de radiação** do capítulo 33: é ela que freia átomos no resfriamento a laser e empurra as velas solares.

A prova direta veio com o **efeito Compton** (1923). Raios X de comprimento de onda $\lambda$ incidem sobre um alvo com elétrons fracamente ligados; a radiação espalhada num ângulo $\phi$ contém, além de um pico em $\lambda$, um pico em comprimento de onda **maior**, $\lambda'$. Classicamente, a onda espalhada teria a mesma frequência que a incidente. Tratando o espalhamento como uma colisão elástica entre um fóton e um elétron livre em repouso, e conservando energia (relativística) e momento, obtém-se

$$\Delta\lambda = \lambda' - \lambda = \frac{h}{mc}\,(1 - \cos\phi).$$

A grandeza $h/mc = 2{,}43$ pm é o **comprimento de onda de Compton** do elétron. O deslocamento vai de zero (fóton que passa reto) a $2h/mc \approx 4{,}9$ pm (fóton que volta). O pico não deslocado vem de fótons que colidem com elétrons fortemente ligados: nesse caso quem recua é o átomo inteiro, com massa milhares de vezes maior, e $\Delta\lambda$ é desprezível.

Exemplo: raios X de $50{,}0$ pm espalhados a $90°$ saem com $\lambda' = 52{,}4$ pm. A energia do fóton cai de $24{,}8$ keV para $23{,}7$ keV, e a diferença, cerca de $1{,}1$ keV, fica com o elétron.

Armadilha: esperar ver o efeito Compton com luz visível. O deslocamento máximo é de poucos picômetros: relativamente a $500$ nm, é uma fração de $10^{-5}$, imperceptível. Só com raios X ou gama o efeito aparece.

No experimento, gire o detector e veja o pico deslocado se afastar do original; na colisão, confira o triângulo de momentos; por fim, ajuste $\Delta\lambda$ contra $1-\cos\phi$ para medir $h/mc$.`,
      experiments: [
        { kind: "sim", id: "compton", scenario: "espectro", note: "Gire o detector e acompanhe os picos deslocado e não deslocado." },
        { kind: "sim", id: "compton", scenario: "colisao", note: "Veja a colisão fóton–elétron e a conservação do momento no triângulo de vetores." },
        { kind: "sim", id: "compton", scenario: "ajuste", note: "Ajuste Δλ contra 1 − cos φ e meça o comprimento de onda de Compton." },
        { kind: "sim", id: "resfriamento-laser", scenario: "melaco", note: "Use o momento dos fótons absorvidos para frear átomos." },
      ],
    },
    "38-5": {
      text: String.raw`Se a luz é feita de fótons, como explicar as franjas de interferência da fenda dupla (capítulo 35)? A resposta vem do experimento feito com luz tão fraca que só há **um fóton por vez** no aparelho. Cada fóton deixa um único ponto na tela, num lugar aparentemente aleatório. Mas, depois de milhares de pontos, a distribuição reproduz exatamente o padrão de franjas previsto pela teoria ondulatória.

A interpretação é **probabilística**: a onda associada à luz não diz onde o fóton vai chegar, mas com que **probabilidade** ele será detectado em cada região. A probabilidade de detecção por unidade de área é proporcional ao quadrado da amplitude do campo, isto é, à intensidade da onda clássica:

$$P \propto E_m^2 \propto I.$$

Cada fóton, sozinho, "passa pelas duas fendas" no sentido de que a onda de probabilidade atravessa ambas e interfere consigo mesma. Se colocarmos um detector que revele por qual fenda cada fóton passou, as franjas desaparecem: o padrão vira a soma de duas manchas de fenda simples.

Exemplo: numa tela onde o máximo central recebe intensidade $I_0$ e um ponto lateral recebe $I_0/4$, um fóton tem quatro vezes mais chance de cair perto do centro do que perto daquele ponto. Com $10$ fótons, o padrão ainda parece ruído; com $10^4$, as franjas ficam nítidas, porque as flutuações relativas caem como $1/\sqrt N$.

Armadilha: imaginar que os fótons "interferem uns com os outros", como se precisassem estar juntos. Mesmo enviados um de cada vez, separados por longos intervalos, o padrão aparece: cada fóton interfere apenas consigo.

No experimento, dispare partículas uma a uma na fenda dupla e veja os pontos isolados formarem as franjas; depois ligue o detector de caminho e veja-as sumirem. O mesmo vale para fótons e para elétrons (seção 38-6).`,
      experiments: [
        { kind: "sim", id: "de-broglie", scenario: "um-a-um", note: "Veja impactos isolados, um de cada vez, construírem o padrão de franjas." },
        { kind: "sim", id: "de-broglie", scenario: "detector", note: "Descubra por qual fenda cada partícula passa e veja as franjas desaparecerem." },
        { kind: "sim", id: "fenda-dupla", scenario: "classico", note: "Compare com a intensidade da onda clássica, que dá a densidade de probabilidade." },
        { kind: "sim", id: "qubit-dois-niveis", scenario: "moeda", note: "Repita uma medida quântica muitas vezes e veja as probabilidades surgirem das contagens." },
      ],
    },
    "38-6": {
      text: String.raw`Em 1924, de Broglie inverteu o raciocínio: se a luz, que parecia onda, tem comportamento de partícula, talvez as partículas tenham comportamento de onda. Ele associou a toda partícula de momento $p$ um **comprimento de onda de de Broglie**

$$\lambda = \frac{h}{p}.$$

Para um elétron acelerado do repouso por uma diferença de potencial $V$ (sem efeitos relativísticos), $p = \sqrt{2meV}$, e

$$\lambda = \frac{h}{\sqrt{2meV}} \approx \frac{1{,}23\ \mathrm{nm}}{\sqrt{V/\mathrm{volt}}}.$$

Com $V = 100$ V, $\lambda \approx 0{,}12$ nm, da ordem do espaçamento entre átomos num cristal. Por isso um cristal funciona como rede de difração para elétrons, como faz para raios X. Davisson e Germer observaram em 1927 um máximo forte de elétrons de $54$ eV espalhados a $50°$ por um cristal de níquel, exatamente onde a onda de de Broglie previa. Pouco depois, G. P. Thomson obteve anéis de difração ao passar elétrons por folhas finas. Hoje há interferência com nêutrons, átomos e até moléculas grandes.

A fenda dupla com elétrons enviados um a um dá o mesmo resultado da seção 38-5: impactos pontuais que, somados, formam franjas. O elétron é detectado como partícula, mas se propaga como onda de probabilidade.

Exemplo: uma bola de tênis de $57$ g a $30$ m/s tem $\lambda = 6{,}63\times10^{-34}/(0{,}057\cdot30) \approx 4\times10^{-34}$ m, absurdamente menor que qualquer fenda: os efeitos ondulatórios de objetos macroscópicos são inobserváveis. O microscópio eletrônico explora o oposto: elétrons de dezenas de kV têm $\lambda$ de picômetros, muito abaixo dos $500$ nm da luz, e resolvem detalhes atômicos.

Armadilha: dobrar a tensão esperando dobrar o comprimento de onda. Como $\lambda \propto 1/\sqrt V$, dobrar $V$ **reduz** $\lambda$ por um fator $\sqrt2$.

No experimento, mude a tensão de aceleração e meça o espaçamento das franjas; na folha de grafite, confirme que o raio dos anéis cai com $1/\sqrt V$; no arranjo de Davisson–Germer, procure o máximo a $50°$.`,
      experiments: [
        { kind: "sim", id: "de-broglie", scenario: "lambda", note: "Mude a tensão e veja o espaçamento das franjas acompanhar λ = h/p." },
        { kind: "sim", id: "difracao-eletrons", scenario: "raio-tensao", note: "Meça o raio dos anéis do grafite contra 1/√V." },
        { kind: "sim", id: "difracao-eletrons", scenario: "davisson-germer", note: "Varra o coletor e encontre o máximo de Davisson–Germer." },
        { kind: "pratica", id: "exp3-difracao-eletrons", note: "Roteiro de bancada: anéis de difração no grafite e a distância entre planos." },
      ],
    },
    "38-7": {
      text: String.raw`Se o elétron se comporta como onda, precisa de uma equação de onda. A grandeza que se propaga é a **função de onda** $\Psi(x,y,z,t)$, em geral complexa. Para um estado de energia definida, a dependência temporal se separa, $\Psi = \psi(x)\,e^{-iEt/\hbar}$, e a parte espacial obedece, em uma dimensão, à **equação de Schrödinger independente do tempo**:

$$-\frac{\hbar^2}{2m}\frac{d^2\psi}{dx^2} + U(x)\,\psi = E\,\psi,$$

com $\hbar = h/2\pi$ e $U(x)$ a energia potencial. A equação não é deduzida de nada mais básico: é postulada e confirmada pelas previsões.

O significado físico está na **densidade de probabilidade** $|\psi|^2 = \psi^*\psi$: a probabilidade de encontrar a partícula entre $x$ e $x+dx$ é $|\psi|^2dx$. Como a partícula está em algum lugar, $\int|\psi|^2dx = 1$ (normalização).

Para uma **partícula livre** ($U = 0$), a solução é uma onda com número de onda $k = \sqrt{2mE}/\hbar$, ou seja, $p = \hbar k = h/\lambda$, o que recupera de Broglie. Uma onda que viaja para a direita, $\psi = A e^{ikx}$, tem $|\psi|^2 = A^2$ **constante**: o momento é exatamente conhecido, e a posição, totalmente indefinida. Para localizar a partícula, é preciso somar ondas de vários $k$, formando um **pacote de onda**, assunto da próxima seção.

Exemplo: um elétron livre de $10$ eV tem $k = \sqrt{2\cdot9{,}11\times10^{-31}\cdot1{,}6\times10^{-18}}/1{,}055\times10^{-34} \approx 1{,}6\times10^{10}$ m⁻¹, isto é, $\lambda \approx 0{,}39$ nm.

Onde $E > U$, a solução oscila; onde $E < U$ (região classicamente proibida), ela decai exponencialmente em vez de zerar de repente. Esse detalhe dá origem ao efeito túnel (seção 38-9) e à penetração nas paredes de um poço (capítulo 39).

Armadilha: interpretar $\psi$ como uma "nuvem de matéria" ou de carga espalhada. O elétron é detectado inteiro num ponto; $|\psi|^2$ dá a probabilidade de onde isso acontece.

No experimento, resolva a equação para o poço infinito e alterne entre $\psi_n$ e $|\psi_n|^2$; no pacote livre, veja a onda se propagar e se alargar.`,
      experiments: [
        { kind: "sim", id: "poco-quantico", scenario: "infinito", note: "Veja as soluções da equação de Schrödinger e alterne entre ψ e |ψ|²." },
        { kind: "sim", id: "incerteza", scenario: "livre", note: "Acompanhe um pacote livre evoluindo pela equação de Schrödinger." },
      ],
    },
    "38-8": {
      text: String.raw`Uma onda plana de comprimento de onda único tem momento bem definido, mas se estende por todo o espaço. Para que a partícula esteja localizada numa região de largura $\Delta x$, a função de onda precisa ser um **pacote**, uma soma de ondas planas com números de onda espalhados por $\Delta k$. Quanto mais estreito o pacote, mais ondas de comprimentos diferentes ele exige. É uma propriedade matemática de qualquer onda (vale também para o som e para pulsos de rádio), que na mecânica quântica, com $p = \hbar k$, vira o **princípio de indeterminação de Heisenberg**:

$$\Delta x\,\Delta p_x \ge \frac{\hbar}{2},$$

e o mesmo para $y$ e $z$. A indeterminação não vem de instrumentos ruins: é impossível **preparar** um estado em que posição e momento sejam ambos bem definidos além desse limite. (Em estimativas de ordem de grandeza, usa-se muitas vezes $\Delta x\,\Delta p \approx \hbar$.)

Uma consequência: um pacote livre **se alarga** com o tempo, porque suas componentes de momento diferente andam com velocidades diferentes. Quanto mais estreito no início, mais depressa se espalha.

Outra: ao passar luz ou elétrons por uma fenda de largura $a$, a posição transversal fica conhecida com $\Delta y \sim a$, e o momento transversal ganha uma incerteza $\Delta p_y \sim h/a$. É exatamente o espalhamento angular da difração, $\sin\theta \approx \lambda/a$: estreitar a fenda alarga o padrão.

Exemplo: um elétron confinado numa região de $0{,}10$ nm (tamanho de um átomo) tem $\Delta p \ge 1{,}055\times10^{-34}/(2\cdot10^{-11}) \approx 5{,}3\times10^{-25}$ kg·m/s, o que corresponde a uma energia cinética da ordem de $1$ eV, justamente a escala das energias atômicas. Já um grão de poeira de $1$ µg localizado em $1$ µm tem incerteza de velocidade de $10^{-19}$ m/s, irrelevante.

Armadilha: dizer que "medir perturba e por isso há incerteza". A perturbação existe, mas o princípio é mais profundo: a própria descrição ondulatória não admite um estado com $\Delta x$ e $\Delta p$ simultaneamente pequenos.

No experimento, some ondas planas e veja o pacote estreitar quando $\sigma_k$ cresce; depois feche a fenda e veja o padrão de difração se abrir.`,
      experiments: [
        { kind: "sim", id: "incerteza", scenario: "soma", note: "Some ondas planas e verifique que Δx·Δk nunca fica abaixo de 1/2." },
        { kind: "sim", id: "incerteza", scenario: "fenda", note: "Estreite a fenda e veja o momento transversal se espalhar." },
        { kind: "sim", id: "incerteza", scenario: "livre", note: "Compare o alargamento de pacotes inicialmente estreitos e largos." },
      ],
    },
    "38-9": {
      text: String.raw`Classicamente, uma bola com energia $E$ menor que a altura $U_0$ de uma lombada sempre volta. Na mecânica quântica, um elétron com $E < U_0$ diante de uma **barreira de potencial** de largura $L$ tem uma probabilidade não nula de aparecer do outro lado: é o **efeito túnel** (ou tunelamento).

Dentro da barreira, a equação de Schrödinger não dá oscilação, mas uma exponencial decrescente, $\psi \propto e^{-bx}$, com

$$b = \frac{\sqrt{2m(U_0 - E)}}{\hbar}.$$

A onda chega à outra face com amplitude reduzida e continua como onda transmitida. O **coeficiente de transmissão** (probabilidade de atravessar), para barreiras não muito finas, é aproximadamente

$$T \approx e^{-2bL}.$$

O coeficiente de reflexão é $R = 1 - T$. Como $T$ depende **exponencialmente** da largura e da raiz de $U_0 - E$, pequenas mudanças produzem grandes efeitos.

Exemplo: elétron com $E = 5{,}0$ eV e barreira de $U_0 = 6{,}0$ eV: $b = \sqrt{2\cdot9{,}11\times10^{-31}\cdot1{,}6\times10^{-19}}/1{,}055\times10^{-34} \approx 5{,}1$ nm⁻¹. Com $L = 0{,}50$ nm, $T \approx e^{-5{,}1} \approx 6\times10^{-3}$; com $L = 1{,}0$ nm, $T \approx 4\times10^{-5}$. Dobrar a largura reduziu a transmissão mais de cem vezes.

Essa sensibilidade é o princípio do **microscópio de tunelamento** (STM): uma ponta metálica a menos de um nanômetro da amostra recebe uma corrente de tunelamento que muda cerca de um fator dez para cada $0{,}1$ nm de distância, revelando átomos individuais. O tunelamento também explica o decaimento alfa, a fusão no interior das estrelas e o funcionamento das memórias flash e dos diodos túnel.

Mesmo com $E > U_0$ há alguma reflexão, ao contrário do caso clássico. E duas barreiras em série podem ter transmissão quase total para certas energias: é o **tunelamento ressonante**.

Armadilha: pensar que a partícula "perde energia" ao atravessar. A energia da parte transmitida é a mesma $E$ da incidente; o que diminui é a probabilidade, isto é, a amplitude da onda.

No experimento, lance o pacote contra a barreira e compare a fração transmitida com $T(E)$; aumente a largura e veja a transmissão despencar; depois teste energias acima da barreira e a barreira dupla.`,
      experiments: [
        { kind: "sim", id: "tunelamento", scenario: "tunel", note: "Lance um pacote com E < U₀ e meça a probabilidade transmitida." },
        { kind: "sim", id: "tunelamento", scenario: "tunel", params: { a: 3 }, note: "Dobre a largura da barreira e veja a transmissão cair exponencialmente." },
        { kind: "sim", id: "tunelamento", scenario: "acima", note: "Com E > U₀, veja que ainda há uma parte refletida." },
        { kind: "sim", id: "tunelamento", scenario: "ressonancia", note: "Encontre a energia em que a barreira dupla fica quase transparente." },
      ],
    },
  },
};
