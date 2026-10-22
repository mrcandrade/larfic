import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 44,
  intro: String.raw`Este capítulo junta os dois extremos de escala da física. De um lado, as **partículas elementares**: o que existe abaixo do núcleo, quais leis de conservação decidem que reações podem acontecer e como centenas de partículas aparentemente fundamentais se reduzem a poucos **quarks** e **léptons** que interagem trocando partículas mensageiras. Do outro, o **universo como um todo**: ele se expande, está cheio de uma radiação fria que sobrou de uma fase muito quente, contém muito mais massa do que a que brilha e teve um começo, há cerca de 13,8 bilhões de anos. As duas pontas se encontram porque, nos primeiros instantes, o universo era tão quente e denso que funcionava como o maior acelerador de partículas possível: entender os quarks e léptons é entender a origem da matéria. Tudo aqui usa ferramentas que você já tem: conservação de energia e momento, relatividade, $E = mc^2$, níveis quânticos e radiação de corpo negro.`,
  sections: {
    "44-2": {
      text: String.raw`Até os anos 1930, bastavam três partículas para construir a matéria: próton, nêutron e elétron (mais o fóton para a luz). Com os raios cósmicos e, depois, com aceleradores cada vez mais energéticos, apareceram dezenas e logo centenas de outras: píons, múons, káons, lambdas, sigmas... Quase todas instáveis, com vidas de microssegundos a $10^{-23}$ s. Para pôr ordem nesse "zoológico", três classificações se mostraram úteis.

### Pelo spin
- **Férmions**, de spin semi-inteiro ($\tfrac12$, $\tfrac32$...): elétron, próton, nêutron, neutrinos. Obedecem ao princípio de exclusão de Pauli; dois férmions idênticos não ocupam o mesmo estado. É isso que dá estrutura aos átomos e aos núcleos.
- **Bósons**, de spin inteiro (0, 1, 2...): fóton, píons. Não obedecem à exclusão e podem se acumular num mesmo estado (é o que acontece no laser).

### Pela interação
- **Hádrons** sentem a interação **forte**: prótons, nêutrons, píons e a maioria das partículas novas.
- **Léptons** não a sentem: elétron, múon, neutrinos.

### Pela vida média
A vida média revela qual interação provoca o decaimento: decaimentos pela interação forte levam uns $10^{-23}$ s; pela eletromagnética, de $10^{-20}$ a $10^{-16}$ s; pela fraca, $10^{-13}$ s ou mais. O $\pi^0$ ($8\times10^{-17}$ s) decai em dois fótons, eletromagneticamente; o $\pi^+$, quase com a mesma massa, vive $2{,}6\times10^{-8}$ s, porque só pode decair pela fraca.

Partículas tão efêmeras só são vistas porque andam perto da velocidade da luz e a **dilatação do tempo** (capítulo 37) aumenta o caminho que percorrem antes de decair: $L = \gamma\beta c\tau$.

Exemplo: um múon ($mc^2 = 105{,}7$ MeV, $\tau = 2{,}2\ \mu$s) com energia cinética de $1{,}0$ GeV tem $\gamma = 1 + 1000/105{,}7 \approx 10{,}5$ e $\gamma\beta \approx 10{,}4$. Ele percorre em média $10{,}4 \cdot 3{,}0\times10^8 \cdot 2{,}2\times10^{-6} \approx 6{,}9$ km, e não os 660 m que a física clássica daria.

Armadilha: pensar que "partícula elementar" quer dizer "partícula estável". A maioria delas é instável; elementar quer dizer sem estrutura interna conhecida, e o próton, estável, não é elementar (seção 44-8).

No experimento, percorra o catálogo de partículas, compare as vidas médias das que decaem pela interação forte, eletromagnética e fraca, e mude a energia cinética para ver quanto cada uma voa no laboratório.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "zoologico", note: "Percorra o catálogo e compare vida média, spin e tipo de interação das partículas." },
        { kind: "sim", id: "particulas-elementares", scenario: "zoologico", params: { Kz: 10000 }, note: "Aumente a energia cinética e veja a dilatação do tempo esticar o percurso das partículas instáveis." },
        { kind: "sim", id: "relatividade-dinamica", scenario: "energia", params: { particula: 1 }, note: "Acelere um múon e veja a energia crescer sem que a velocidade passe de c." },
      ],
    },
    "44-3": {
      text: String.raw`Em 1928, Dirac escreveu uma equação de onda relativística para o elétron e encontrou soluções com energia negativa que não sabia interpretar. A conclusão foi que deveria existir uma partícula com a mesma massa do elétron e carga oposta. Em 1932, Anderson a encontrou nos raios cósmicos: o **pósitron**, $e^+$. Hoje sabemos que **toda partícula tem uma antipartícula**, com a mesma massa, o mesmo spin e a mesma vida média, mas carga e outros números quânticos (bariônico, leptônico, estranheza) opostos. O antipróton foi produzido em 1955; já se fabricaram átomos de anti-hidrogênio. Algumas partículas neutras, como o fóton e o $\pi^0$, são a própria antipartícula; o nêutron não é, pois o antinêutron tem número bariônico oposto. A notação usual é uma barra: $\bar p$, $\bar\nu$.

### Aniquilação
Quando uma partícula encontra sua antipartícula, as duas podem se **aniquilar**, convertendo toda a massa em outras partículas. Um elétron e um pósitron quase em repouso produzem dois fótons:

$$e^- + e^+ \rightarrow \gamma + \gamma,\qquad E_\gamma = m_ec^2 = 511\ \text{keV cada}.$$

Saem dois fótons, e não um, porque o momento total inicial é nulo: um único fóton sempre carrega momento. Eles partem em sentidos opostos, e é isso que a tomografia por emissão de pósitrons (PET) detecta, localizando no corpo o ponto de onde vieram.

### Produção de pares
O processo inverso também ocorre: um fóton de energia suficiente, passando perto de um núcleo, vira um par elétron-pósitron. A energia mínima é $2m_ec^2 = 1{,}022$ MeV; o núcleo é necessário para absorver parte do momento, pois no vácuo um fóton isolado não pode criar um par com conservação de energia e momento.

Exemplo: um próton e um antiproton em repouso se aniquilam liberando $2 \cdot 938 = 1876$ MeV, cerca de 3700 vezes a energia da aniquilação $e^+e^-$. Em geral essa energia sai como alguns píons, por exemplo $p + \bar p \rightarrow \pi^+ + \pi^- + \pi^0$, com bastante energia cinética.

Armadilha: dizer que a matéria "desaparece" na aniquilação. A energia e o momento se conservam integralmente; o que deixa de existir são as partículas com massa de repouso.

No experimento, aniquile um pósitron parado e veja os dois fótons de 511 keV saindo em sentidos opostos; depois mude para produção de pares, baixe a energia do fóton até o limiar e tente fazer o processo sem núcleo.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "aniquilacao", note: "Aniquile um par elétron-pósitron e confira a energia e as direções dos fótons." },
        { kind: "sim", id: "particulas-elementares", scenario: "aniquilacao", params: { processo: 1, Eg: 1.1 }, note: "Produza um par com um fóton logo acima do limiar de 1,022 MeV." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 16, Kr: 0 }, note: "Veja a aniquilação próton-antipróton produzir três píons." },
      ],
    },
    "44-4": {
      text: String.raw`Os **léptons** são as partículas de spin $\tfrac12$ que não sentem a interação forte. São seis, organizados em três **famílias**, cada uma com um lépton carregado e o seu neutrino:

- elétron $e^-$ ($0{,}511$ MeV) e neutrino do elétron $\nu_e$;
- múon $\mu^-$ ($105{,}7$ MeV, vida média $2{,}2\ \mu$s) e neutrino do múon $\nu_\mu$;
- tau $\tau^-$ ($1777$ MeV, vida média $2{,}9\times10^{-13}$ s) e neutrino do tau $\nu_\tau$.

Mais as seis antipartículas. Os léptons carregados são, até onde se sabe, **pontuais**: nenhum experimento encontrou estrutura interna. O múon e o tau são cópias mais pesadas do elétron e decaem para ele. Os neutrinos têm massa muito pequena, menor que $1$ eV, mas não nula, e só interagem pela interação fraca (e pela gravidade).

### Números leptônicos
Observa-se que cada família tem um **número leptônico** que se conserva separadamente: $L_e = +1$ para $e^-$ e $\nu_e$, $-1$ para $e^+$ e $\bar\nu_e$, zero para as demais partículas; o mesmo para $L_\mu$ e $L_\tau$. Em toda reação observada, as somas antes e depois são iguais.

Exemplo: no decaimento do múon,

$$\mu^- \rightarrow e^- + \bar\nu_e + \nu_\mu,$$

$L_\mu$ vale $1$ antes e $0 + 0 + 1 = 1$ depois; $L_e$ vale $0$ antes e $1 - 1 + 0 = 0$ depois. A carga vai de $-1$ a $-1$. Tudo confere. Já $\mu^- \rightarrow e^- + \gamma$ conservaria energia e carga, mas não $L_\mu$ nem $L_e$: nunca foi observado, apesar de buscas que chegaram a uma sensibilidade de uma parte em $10^{13}$.

Uma ressalva moderna: os neutrinos **oscilam**, isto é, um $\nu_e$ produzido no Sol pode chegar à Terra como $\nu_\mu$, o que mostra que as famílias não são perfeitamente separadas. Para todas as reações deste capítulo, porém, a conservação de cada número leptônico funciona.

Armadilha: achar que o múon é um "elétron excitado". Não há estado excitado: o múon é outra partícula, com massa própria, que decai pela interação fraca emitindo neutrinos.

No experimento, escolha o decaimento do múon e confira a tabela de números leptônicos; depois teste $\mu^- \rightarrow e^- + \gamma$ e veja qual lei de conservação o proíbe.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 2 }, note: "Confira os números leptônicos no decaimento do múon." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 10 }, note: "Descubra por que μ⁻ → e⁻ + γ nunca é observado." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 1 }, note: "Veja por que o píon carregado decai num múon e num neutrino do múon." },
      ],
    },
    "44-5": {
      text: String.raw`Os **hádrons** são as partículas que sentem a interação forte. Eles se dividem em dois grupos:

- **bárions**, de spin semi-inteiro: próton, nêutron, $\Lambda$, $\Sigma$, $\Xi$, $\Delta$, $\Omega$...;
- **mésons**, de spin inteiro: píons, káons, $\eta$...

Os bárions recebem **número bariônico** $B = +1$, os antibárions $B = -1$, e mésons e léptons $B = 0$. Experimentalmente, **o número bariônico total se conserva** em todas as reações. Os mésons não têm número conservado: podem ser criados e destruídos à vontade, desde que haja energia.

A conservação de $B$ explica a estabilidade do próton. Ele é o bárion mais leve; para decair, teria de dar origem a partículas mais leves, todas com $B = 0$. Uma reação como $p \rightarrow e^+ + \pi^0$ conserva carga, energia e momento angular, mas viola a conservação de $B$ (e de $L_e$). Experimentos com toneladas de água mostram que a vida média do próton, se ele decai, passa de $10^{34}$ anos, muito mais que a idade do universo.

### Colisões e limiar
Em colisões de hádrons podem ser criados novos hádrons, desde que haja energia para a massa deles. O que conta é a energia no referencial do centro de massa; com o alvo parado, parte da energia do projétil fica presa no movimento do centro de massa e o **limiar** é maior que a simples soma de massas.

Exemplo: em $p + p \rightarrow p + p + \pi^0$, a energia total no centro de massa precisa ser pelo menos $2m_pc^2 + m_\pi c^2 = 1876{,}5 + 135{,}0 = 2011{,}5$ MeV. Com um próton parado, isso exige $E = [(2011{,}5)^2 - 2(938{,}3)^2]/(2\cdot938{,}3) \approx 1218$ MeV de energia total do projétil, ou seja, energia cinética de cerca de $280$ MeV, mais que o dobro dos $135$ MeV da massa do píon.

Os hádrons não são pontuais: o próton tem raio de cerca de $0{,}8$ fm e uma estrutura interna que a seção 44-8 descreve.

Armadilha: achar que basta o projétil ter energia cinética igual à massa da partícula criada. Com alvo parado, o momento total tem de se conservar e parte da energia fica como movimento dos produtos.

No experimento, verifique a conservação do número bariônico em reações permitidas e no decaimento proibido do próton; depois ajuste a energia do próton incidente até encontrar o limiar da produção de um píon.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 13, Kr: 280 }, note: "Encontre o limiar de energia para criar um píon numa colisão próton-próton." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 9 }, note: "Veja qual lei de conservação impede o próton de decair." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 5 }, note: "Veja o Δ⁺⁺ decair pela interação forte em próton e píon." },
      ],
    },
    "44-6": {
      text: String.raw`Nos anos 1950 surgiu um enigma. Certas partículas, como os káons e o $\Lambda$, eram produzidas copiosamente em colisões de píons com prótons, o que indica interação forte (tempos de $10^{-23}$ s), mas decaíam devagar, em uns $10^{-10}$ s, típico da interação fraca. Além disso, nunca apareciam sozinhas: eram sempre criadas **aos pares**, por exemplo

$$\pi^- + p \rightarrow K^0 + \Lambda^0.$$

Gell-Mann e Nishijima resolveram o enigma atribuindo a essas partículas um novo número quântico, a **estranheza** $S$: o $K^0$ tem $S = +1$, o $\Lambda^0$ tem $S = -1$, e as partículas "comuns" (próton, nêutron, píons) têm $S = 0$. A regra é:

- nas interações **forte** e **eletromagnética**, a estranheza se conserva;
- na interação **fraca**, pode mudar de $\pm 1$.

Isso explica tudo. Na produção, uma interação forte, $S$ vale $0$ antes e $+1 - 1 = 0$ depois: as partículas estranhas nascem juntas com estranhezas opostas (**produção associada**). Depois de separadas, cada uma é a partícula estranha mais leve com seu valor de $S$ e não tem como decair sem mudar a estranheza; só a interação fraca permite, e por isso a vida é longa.

Exemplo: o $\Lambda^0 \rightarrow p + \pi^-$ tem $S = -1$ antes e $0$ depois, $\Delta S = +1$: decaimento fraco, com vida média de $2{,}6\times10^{-10}$ s. Já $\pi^- + p \rightarrow K^- + \Sigma^+$ teria $S = 0$ antes e $-1 - 1 = -2$ depois. Não ocorre, embora conserve carga e número bariônico e haja energia de sobra.

A estranheza é uma lei de conservação **parcial**: vale para umas interações e não para outras. Ela parece arbitrária aqui, mas ganha sentido no modelo dos quarks (seção 44-8): $S$ conta, com sinal trocado, quantos quarks **estranhos** há na partícula.

Armadilha: achar que uma lei de conservação só é útil se valer sempre. A conservação parcial é justamente o que permite descobrir qual interação está atuando num processo.

No experimento, compare a produção associada $\pi^- + p \rightarrow K^0 + \Lambda^0$ com o processo proibido $\pi^- + p \rightarrow K^- + \Sigma^+$, e veja que a sim identifica o decaimento do $\Lambda$ como fraco.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 14 }, note: "Some a estranheza na produção associada de K⁰ e Λ⁰." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 15 }, note: "Descubra por que π⁻ + p → K⁻ + Σ⁺ não acontece." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 4 }, note: "Veja que o decaimento do Λ⁰ muda a estranheza e por isso é fraco." },
      ],
    },
    "44-7": {
      text: String.raw`Com carga, número bariônico, spin e estranheza em mãos, Gell-Mann e Ne'eman (1961) encontraram uma ordem no zoológico dos hádrons. Agrupando partículas de **mesmo spin** e **mesma paridade** e colocando cada uma num plano com a **estranheza** num eixo e a **carga** (ou, mais precisamente, a componente $I_3$ do isospin) no outro, surgem figuras geométricas regulares:

- o **octeto** dos bárions de spin $\tfrac12$: próton, nêutron, três $\Sigma$, o $\Lambda$ e dois $\Xi$, formando um hexágono com duas partículas no centro;
- o **noneto** dos mésons de spin 0: píons, káons, $\eta$ e $\eta'$;
- o **decupleto** dos bárions de spin $\tfrac32$: um triângulo de dez partículas.

Gell-Mann batizou o esquema de **caminho óctuplo**, numa alusão budista aos oito caminhos.

### A previsão do $\Omega^-$
Em 1962, nove membros do decupleto eram conhecidos: quatro $\Delta$ ($S = 0$), três $\Sigma^*$ ($S = -1$) e dois $\Xi^*$ ($S = -2$). O vértice de baixo do triângulo, com $S = -3$ e carga $-1$, estava vazio. As massas cresciam em passos quase iguais a cada unidade de estranheza perdida:

$$1232 \rightarrow 1385 \rightarrow 1533\ \text{MeV}/c^2,$$

com diferenças de $153$ e $148$ MeV. Continuando o padrão, a partícula que faltava deveria ter cerca de $1533 + 150 \approx 1680$ MeV. Gell-Mann previu, além da massa, a carga, a estranheza e o fato de que ela decairia pela interação fraca, com vida relativamente longa. Em 1964, uma câmara de bolhas em Brookhaven registrou o $\Omega^-$, com $1672$ MeV.

A situação lembra a tabela periódica: Mendeleiev deixou buracos para elementos ainda não descobertos e previu suas propriedades. Nos dois casos, a regularidade das figuras indicava uma estrutura interna mais simples: elétrons em camadas para os átomos, e **quarks** para os hádrons (seção 44-8).

Armadilha: achar que os padrões geométricos são apenas um jeito bonito de desenhar. Eles têm poder preditivo, como mostrou o $\Omega^-$, e foram a pista que levou aos quarks.

No experimento, abra o decupleto, leia as massas por linha de estranheza, dê o seu palpite para a massa do bárion que falta e só então revele o $\Omega^-$; depois explore o octeto e o noneto de mésons.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "caminho-octuplo", note: "Preveja a massa do Ω⁻ a partir do padrão do decupleto e depois revele." },
        { kind: "sim", id: "particulas-elementares", scenario: "caminho-octuplo", params: { multipleto: 0 }, note: "Localize próton, nêutron, Λ, Σ e Ξ no octeto bariônico." },
        { kind: "sim", id: "particulas-elementares", scenario: "caminho-octuplo", params: { multipleto: 2 }, note: "Veja o noneto de mésons no plano estranheza × carga." },
      ],
    },
    "44-8": {
      text: String.raw`Em 1964, Gell-Mann e Zweig propuseram que os padrões do caminho óctuplo vêm de os hádrons serem feitos de partículas menores, os **quarks**. Bastavam três **sabores**: **up** ($u$, carga $+\tfrac23 e$), **down** ($d$, $-\tfrac13 e$) e **strange** ($s$, $-\tfrac13 e$, estranheza $-1$), cada um com spin $\tfrac12$ e número bariônico $\tfrac13$, mais os antiquarks com valores opostos. Mais tarde vieram o **charm** ($c$), o **bottom** ($b$) e o **top** ($t$), completando três famílias como as dos léptons.

As regras de construção são simples:

- **bárion** = três quarks ($B = \tfrac13 + \tfrac13 + \tfrac13 = 1$);
- **méson** = quark + antiquark ($B = 0$).

Exemplos: próton $= uud$, com carga $\tfrac23 + \tfrac23 - \tfrac13 = +1$; nêutron $= udd$, carga $0$; $\pi^+ = u\bar d$, carga $\tfrac23 + \tfrac13 = +1$; $\Omega^- = sss$, carga $-1$ e $S = -3$, exatamente o vértice do decupleto. A estranheza de um hádron é menos o número de quarks $s$ que ele contém.

O decaimento beta ganha uma descrição mais simples: no nêutron, um quark $d$ vira $u$, emitindo um elétron e um antineutrino, $d \rightarrow u + e^- + \bar\nu_e$. A interação fraca é a única capaz de mudar o sabor de um quark.

### Cor e confinamento
Uma dificuldade: o $\Omega^-$ e o $\Delta^{++}$ ($uuu$) têm três quarks idênticos com spins alinhados, o que violaria o princípio de exclusão. A saída foi dar a cada quark uma nova propriedade com três valores, chamada (sem relação com a cor visual) de **cor**: vermelho, verde ou azul. Os três quarks de um bárion têm cores diferentes, e o conjunto é "branco". Só combinações brancas existem livres; por isso nunca se observou um quark isolado. Isso é o **confinamento**: ao tentar separar dois quarks, a energia do campo entre eles cresce até criar um novo par quark-antiquark.

As evidências de que os quarks são reais vieram do espalhamento de elétrons de alta energia em prótons (final dos anos 1960), que revelou centros espalhadores pontuais dentro deles, como o experimento de Rutherford tinha revelado o núcleo dentro do átomo.

Armadilha: achar que a massa do próton é a soma das massas dos quarks. Os quarks $u$ e $d$ têm poucos MeV; os $9$ MeV somados são cerca de $1\%$ dos $938$ MeV do próton. O resto é energia do campo de glúons que prende os quarks, segundo $E = mc^2$.

No experimento, monte o próton e o nêutron com quarks e confira as cargas; tente formar um par de quarks sozinhos ou um quark isolado; depois alinhe os spins de três quarks $s$ e obtenha o $\Omega^-$.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "quarks", note: "Monte o próton com quarks e compare a massa do hádron com a soma das massas dos quarks." },
        { kind: "sim", id: "particulas-elementares", scenario: "quarks", params: { combo: 1 }, note: "Monte o nêutron e confira carga, número bariônico e estranheza." },
        { kind: "sim", id: "particulas-elementares", scenario: "quarks", params: { combo: 3, spinAlinhado: 1 }, note: "Alinhe os spins de três quarks s e veja por que é preciso a cor." },
      ],
    },
    "44-9": {
      text: String.raw`Na física moderna, uma força entre duas partículas é descrita como a **troca de partículas mensageiras**: uma emite, a outra absorve, e o momento transferido aparece como força. Essas partículas trocadas são **virtuais**: existem por um tempo tão curto que o princípio de indeterminação permite que "tomem emprestada" a energia $mc^2$ por um tempo $\Delta t \sim \hbar/mc^2$. Nesse tempo andam no máximo $c\,\Delta t$, então o **alcance** da força é

$$R \sim \frac{\hbar}{mc} = \frac{\hbar c}{mc^2},\qquad \hbar c = 197\ \text{MeV·fm}.$$

Um mensageiro sem massa dá alcance infinito; um pesado, alcance curto.

### Eletromagnética
O mensageiro é o **fóton**, sem massa: alcance infinito, força que cai com $1/r^2$. A teoria, a eletrodinâmica quântica, é a mais precisa já feita: prevê o momento magnético do elétron com dez algarismos significativos.

### Fraca
Os mensageiros são os bósons $W^+$, $W^-$ e $Z^0$, com massas de $80{,}4$ e $91{,}2$ GeV/$c^2$, previstos e depois descobertos no CERN em 1983. O alcance é $197/80\,400 \approx 2\times10^{-3}$ fm, muito menor que um próton; por isso a interação parece "fraca" em baixas energias. Glashow, Salam e Weinberg mostraram que a eletromagnética e a fraca são duas faces de uma só, a **interação eletrofraca**. As massas dos $W$ e $Z$ vêm do campo de Higgs, cujo bóson foi detectado em 2012 (125 GeV/$c^2$).

### Forte
Entre quarks, o mensageiro é o **glúon**, sem massa, mas com cor: os glúons interagem entre si, e é isso que produz o confinamento (seção 44-8). A teoria é a cromodinâmica quântica. A força nuclear entre prótons e nêutrons é um efeito residual dessa interação, como a força de van der Waals entre moléculas neutras é um resíduo da elétrica. Yukawa a descreveu, em 1935, como troca de **píons**: com $m_\pi c^2 \approx 140$ MeV, o alcance é $197/140 \approx 1{,}4$ fm, exatamente o tamanho dos núcleos.

### Gravitacional
É de longe a mais fraca entre partículas elementares: a atração gravitacional entre dois prótons é $10^{36}$ vezes menor que a repulsão elétrica. Supõe-se um mensageiro sem massa, o **gráviton**, nunca detectado; não há ainda uma teoria quântica da gravidade.

Armadilha: imaginar as partículas virtuais como bolinhas que viajam e empurram o alvo. A troca é uma imagem do cálculo; ela explica bem até forças atrativas, que nenhuma bolinha arremessada produziria.

No experimento, veja no catálogo os bósons mediadores e suas massas; depois compare um decaimento eletromagnético ($\pi^0 \rightarrow \gamma\gamma$) com um fraco ($\pi^+ \rightarrow \mu^+\nu_\mu$) e suas vidas médias.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "zoologico", note: "Encontre o fóton, o glúon, os bósons W e Z e o Higgs no catálogo." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 3 }, note: "Veja o π⁰ decair eletromagneticamente em dois fótons." },
        { kind: "sim", id: "particulas-elementares", scenario: "conservacao", params: { reacao: 18, Kr: 50000 }, note: "Produza um par de múons numa colisão elétron-pósitron, um processo eletromagnético." },
      ],
    },
    "44-10": {
      text: String.raw`Vale juntar as peças. Toda a matéria conhecida é feita de **doze férmions** elementares, em três famílias, mais as suas antipartículas:

- quarks: ($u$, $d$), ($c$, $s$), ($t$, $b$);
- léptons: ($e$, $\nu_e$), ($\mu$, $\nu_\mu$), ($\tau$, $\nu_\tau$).

Eles interagem trocando os bósons mensageiros (fóton, $W^\pm$, $Z^0$, oito glúons), e o campo de Higgs dá massa às partículas. Esse conjunto é o **Modelo Padrão**. Toda a matéria comum, de átomos a estrelas, usa só a primeira família: $u$ e $d$ (em prótons e nêutrons), elétrons e o $\nu_e$ dos decaimentos beta. As outras duas famílias são cópias mais pesadas e instáveis, que só aparecem em raios cósmicos, aceleradores e no universo primordial.

As massas variam de forma enorme e ainda inexplicada: o quark top tem cerca de $173$ GeV/$c^2$, mais que um átomo de ouro, enquanto o elétron tem $0{,}511$ MeV, 340 mil vezes menos, e os neutrinos menos de um milionésimo disso.

Exemplo de escala: estudar distâncias de $10^{-18}$ m exige partículas de comprimento de onda dessa ordem, com energias de $E \approx hc/\lambda = 1{,}24\ \text{GeV·fm}/10^{-3}\ \text{fm} \approx 1$ TeV. Os maiores aceleradores, com feixes de alguns TeV, sondam exatamente essa escala. Energias ainda maiores existiram de forma natural numa só época: o começo do universo, quando a temperatura era tão alta que $kT$ superava qualquer massa de partícula.

O Modelo Padrão explica com precisão impressionante tudo o que se mede em aceleradores, mas deixa perguntas abertas:

- por que três famílias, e por que essas massas?
- de onde vem a massa dos neutrinos?
- por que o universo tem matéria e quase nenhuma antimatéria?
- o que é a **matéria escura** (seção 44-13) e a **energia escura** (seção 44-14)?
- como incluir a gravidade?

As seções seguintes mudam de escala, do menor para o maior. A conexão é real: para entender o universo primordial é preciso a física de partículas, e algumas das perguntas acima só têm resposta (ou evidência) cosmológica.

Armadilha: achar que o Modelo Padrão está "superado" por não responder tudo. Dentro do seu domínio, nunca foi contrariado por um experimento; as perguntas abertas estão fora dele.

No experimento, percorra o catálogo e separe as partículas do Modelo Padrão das que são compostas; repare quantas delas só existem por frações de segundo.`,
      experiments: [
        { kind: "sim", id: "particulas-elementares", scenario: "zoologico", note: "Separe no catálogo os férmions elementares, os bósons mediadores e os hádrons compostos." },
        { kind: "sim", id: "particulas-elementares", scenario: "quarks", params: { combo: 4 }, note: "Comece com a sacola vazia e monte hádrons com quarks da primeira e da segunda família." },
      ],
    },
    "44-11": {
      text: String.raw`Na década de 1920, Hubble mediu as distâncias de galáxias próximas usando estrelas de brilho conhecido e comparou com as velocidades obtidas pelo **desvio para o vermelho** das linhas espectrais (efeito Doppler, capítulo 37). Quase todas se afastam, e com velocidade proporcional à distância:

$$v = H_0\,d,$$

a **lei de Hubble**. Medidas atuais dão $H_0 \approx 70$ km/s por megaparsec (1 Mpc $= 3{,}26$ milhões de anos-luz $= 3{,}09\times10^{19}$ km); valores obtidos por métodos diferentes vão de 67 a 73, uma discrepância ainda não resolvida.

Exemplo: uma galáxia a $100$ Mpc se afasta a $v = 70 \cdot 100 = 7000$ km/s. Como $v \ll c$, o desvio é $z = \Delta\lambda/\lambda \approx v/c = 0{,}023$, e a linha $H_\alpha$ do hidrogênio, de $656{,}3$ nm, aparece em $671{,}6$ nm.

### Expansão, não explosão
A lei de Hubble não significa que estamos no centro de uma explosão. Se o espaço entre todas as galáxias aumenta pelo mesmo fator, qualquer observador vê as outras se afastando com velocidade proporcional à distância: é como pontos desenhados num balão que enche, ou passas num bolo que cresce. Não há centro nem borda. Para distâncias grandes, o desvio para o vermelho é melhor entendido como o próprio comprimento de onda da luz **esticado** pela expansão durante a viagem: $1 + z = a_{\text{hoje}}/a_{\text{emissão}}$, em que $a(t)$ é o **fator de escala**. Galáxias próximas, presas pela gravidade, como Andrômeda e a nossa, não se expandem; Andrômeda até se aproxima.

### A idade de Hubble
Se as velocidades fossem constantes, todas as galáxias estariam juntas há um tempo $d/v = 1/H_0$:

$$\frac{1}{H_0} = \frac{3{,}09\times10^{19}\ \text{km}}{70\ \text{km/s}} = 4{,}4\times10^{17}\ \text{s} \approx 14\ \text{bilhões de anos}.$$

É uma estimativa da idade do universo; o cálculo com a expansão variável dá 13,8 bilhões de anos (seção 44-14).

Armadilha: interpretar o afastamento das galáxias como movimento através do espaço a partir de um ponto especial. É o espaço entre elas que cresce, igual para todos os observadores.

No experimento, meça velocidades e distâncias de várias galáxias, ajuste a reta $v = H_0 d$ e troque de galáxia observadora para ver que o diagrama não muda; depois aumente as velocidades peculiares e veja por que as galáxias próximas enganam.`,
      experiments: [
        { kind: "sim", id: "cosmologia", scenario: "hubble", note: "Ajuste a reta de Hubble e mude de galáxia observadora para ver que não há centro." },
        { kind: "sim", id: "cosmologia", scenario: "hubble", params: { sigmaV: 1500, erroD: 20 }, note: "Aumente as velocidades peculiares e o erro das distâncias e veja o ajuste de H₀ piorar." },
        { kind: "sim", id: "doppler", note: "Reveja como o movimento da fonte desloca a frequência medida." },
      ],
    },
    "44-12": {
      text: String.raw`Em 1965, Penzias e Wilson tentavam eliminar um ruído de micro-ondas na antena que usavam para radioastronomia. O ruído vinha igualmente de todas as direções, a qualquer hora, e não sumiu nem depois de limparem a antena. Era a **radiação cósmica de fundo**, prevista anos antes como resto de um universo primitivo quente.

### De onde ela vem
Se o universo se expande, no passado era menor e mais quente. Até umas centenas de milhares de anos depois do início, a temperatura passava de alguns milhares de kelvins, e a matéria era um **plasma** de núcleos e elétrons livres. Os fótons eram espalhados pelos elétrons o tempo todo, e o universo era opaco, como o interior de uma estrela. Quando a temperatura caiu para cerca de $3000$ K, os elétrons se ligaram aos núcleos formando átomos neutros (**recombinação**), e os fótons passaram a viajar livremente: é o **desacoplamento**, cerca de $380$ mil anos após o big bang. A radiação de fundo que vemos hoje é essa luz, vinda de todas as direções.

Desde então, o universo cresceu cerca de $1100$ vezes, e cada comprimento de onda esticou na mesma proporção. Um espectro de **corpo negro** esticado continua sendo de corpo negro, mas a uma temperatura menor, $T \propto 1/a$:

$$T_{\text{hoje}} = \frac{T_{\text{desacoplamento}}}{1 + z} \approx \frac{3000\ \text{K}}{1100} \approx 2{,}7\ \text{K}.$$

Exemplo: com $T = 2{,}725$ K, a lei de Wien dá o pico em $\lambda_{\max} = 2{,}898\ \text{mm·K}/2{,}725\ \text{K} \approx 1{,}06$ mm, na faixa de micro-ondas. O satélite COBE mediu, em 1990, o espectro de corpo negro mais perfeito já observado na natureza.

### As pequenas variações
A temperatura é a mesma em todas as direções até cerca de uma parte em cem mil. Essas pequenas **anisotropias**, mapeadas pelos satélites WMAP e Planck, são as sementes das galáxias: regiões levemente mais densas que depois cresceram pela gravidade. O padrão delas permite medir a idade, a geometria e a composição do universo.

Por que só $3000$ K, e não os $158\,000$ K correspondentes à energia de ionização do hidrogênio ($13{,}6$ eV)? Porque há cerca de um bilhão de fótons para cada próton: mesmo quando a temperatura média é bem menor que $13{,}6$ eV$/k$, a cauda de alta energia da distribuição de Planck tem fótons de sobra para manter o hidrogênio ionizado.

Armadilha: achar que a radiação de fundo vem de um lugar específico onde ocorreu o big bang. Ela preenche todo o espaço; vemos em cada direção a parte que acabou de chegar até nós.

No experimento, acompanhe o espectro de corpo negro esfriando com a expansão, veja o momento do desacoplamento e mude o número de bárions por fóton para ver a temperatura da recombinação mudar.`,
      experiments: [
        { kind: "sim", id: "cosmologia", scenario: "radiacao-fundo", note: "Veja o corpo negro esfriar com a expansão e o universo ficar transparente no desacoplamento." },
        { kind: "sim", id: "cosmologia", scenario: "radiacao-fundo", params: { eta: 60 }, note: "Aumente a razão bárions por fóton e veja a recombinação acontecer a uma temperatura mais alta." },
        { kind: "sim", id: "corpo-negro", scenario: "stefan", note: "Reveja como o pico do espectro de corpo negro se desloca com a temperatura." },
      ],
    },
    "44-13": {
      text: String.raw`Uma estrela numa órbita circular de raio $r$ em torno do centro de uma galáxia tem velocidade dada pela massa $M(r)$ contida dentro da órbita, como um planeta em torno do Sol (capítulo 13):

$$\frac{v^2}{r} = \frac{G M(r)}{r^2}\quad\Rightarrow\quad v = \sqrt{\frac{G M(r)}{r}}.$$

A maior parte da luz de uma galáxia espiral vem de uma região central. Se a massa estivesse onde está a luz, então, longe do centro, $M(r)$ seria praticamente constante e $v$ cairia como $1/\sqrt r$, como as velocidades dos planetas. Mas a velocidade orbital de estrelas e nuvens de hidrogênio, medida pelo efeito Doppler, fica **constante** até onde se consegue medir, muito além da borda visível. Curva plana significa $M(r) \propto r$: a massa continua crescendo onde quase não há luz.

Exemplo: na nossa galáxia, a velocidade orbital vale cerca de $220$ km/s até pelo menos $30$ kpc ($9{,}3\times10^{20}$ m). A massa dentro desse raio é $M = v^2 r/G = (2{,}2\times10^5)^2\cdot9{,}3\times10^{20}/6{,}67\times10^{-11} \approx 7\times10^{41}$ kg, ou cerca de $3\times10^{11}$ massas solares, várias vezes a massa de todas as estrelas e gás visíveis.

Essa massa invisível é a **matéria escura**: não emite nem absorve luz, só se manifesta pela gravidade. Ela forma um **halo** aproximadamente esférico que envolve o disco da galáxia. Outras evidências independentes apontam na mesma direção:

- galáxias em aglomerados se movem rápido demais para a massa visível os manter juntos (Zwicky já notou isso em 1933);
- a luz de objetos distantes é desviada (lente gravitacional) por mais massa do que a que se vê;
- o padrão das anisotropias da radiação de fundo (seção 44-12) exige cerca de cinco vezes mais matéria escura do que matéria comum.

O balanço atual: a matéria comum (bárions) é cerca de $5\%$ do conteúdo de energia do universo, a matéria escura uns $27\%$ e a energia escura (seção 44-14) uns $68\%$. A natureza da matéria escura é desconhecida. Não pode ser feita de bárions, pelo que se sabe da nucleossíntese; a hipótese mais aceita é uma partícula nova, fora do Modelo Padrão, ainda não detectada.

Armadilha: imaginar a matéria escura como gás ou poeira escura comum. Gás e poeira absorvem e emitem radiação e seriam detectados; a matéria escura praticamente não interage com nada, exceto pela gravidade.

No experimento, compare a curva de rotação medida com a prevista pela matéria visível, ligue um halo de matéria escura e ajuste a massa dele até a curva passar pelos pontos; depois repita com a galáxia anã.`,
      experiments: [
        { kind: "sim", id: "cosmologia", scenario: "materia-escura", note: "Compare a curva de rotação medida com a prevista só pela matéria visível." },
        { kind: "sim", id: "cosmologia", scenario: "materia-escura", params: { halo: 1, Mh: 24 }, note: "Ligue o halo de matéria escura e ajuste a massa até a curva passar pelos pontos." },
        { kind: "sim", id: "cosmologia", scenario: "materia-escura", params: { galaxia: 1, halo: 1 }, note: "Repita com uma galáxia anã, dominada pela matéria escura em todos os raios." },
        { kind: "sim", id: "orbitas-kepler", note: "Reveja como a velocidade orbital cai com a distância quando toda a massa está no centro." },
      ],
    },
    "44-14": {
      text: String.raw`Rodando a expansão para trás, chega-se a um instante em que tudo estava comprimido num estado de densidade e temperatura enormes: o **big bang**, há cerca de $13{,}8$ bilhões de anos. A evolução segue as equações de Friedmann, da relatividade geral, que dão a taxa de expansão $H = \dot a/a$ a partir do conteúdo: radiação, matéria e energia escura.

### Uma linha do tempo
Como a temperatura da radiação cai como $T \propto 1/a$, cada época corresponde a uma temperatura, e a física de partículas diz o que acontecia nela.

- **$t \sim 10^{-43}$ s** (tempo de Planck): antes disso, sem uma teoria quântica da gravidade, não sabemos descrever.
- **$t \sim 10^{-35}$ s**: provável **inflação**, uma expansão rapidíssima que deixaria o universo uniforme e plano.
- **até $\sim 10^{-6}$ s**: plasma de quarks, glúons, léptons e fótons; depois os quarks se juntam em prótons e nêutrons. Quase toda a matéria se aniquila com a antimatéria; sobra um bárion para cada bilhão de fótons.
- **$t \sim 1$ s** ($T \sim 10^{10}$ K): os neutrinos deixam de interagir; nêutrons e prótons param de se converter um no outro.
- **alguns minutos** ($T \sim 10^9$ K): **nucleossíntese primordial**. Nêutrons e prótons formam deutério e hélio. O resultado previsto, cerca de $25\%$ da massa em hélio-4 e traços de deutério e lítio, é exatamente o observado nas estrelas mais antigas: um dos grandes acertos da teoria.
- **380 mil anos** ($T \approx 3000$ K): recombinação e desacoplamento; a radiação de fundo é liberada (seção 44-12).
- **100 a 200 milhões de anos**: primeiras estrelas e galáxias, crescidas das pequenas flutuações de densidade.
- **há uns 5 bilhões de anos**: a **energia escura** passa a dominar e a expansão começa a **acelerar**, como mostraram em 1998 as supernovas distantes.

Exemplo: a nucleossíntese ocorreu a $T \approx 10^9$ K. Como $T \propto 1/a$ e hoje $T = 2{,}7$ K, o universo era então $10^9/2{,}7 \approx 4\times10^8$ vezes menor em escala linear. A energia típica dos fótons, $kT = 8{,}6\times10^{-5}\ \text{eV/K}\cdot10^{9}\ \text{K} \approx 86$ keV, era a de reações nucleares: o universo inteiro era um reator de fusão.

Num universo só de matéria, a idade seria $\tfrac23(1/H_0) \approx 9{,}7$ bilhões de anos, menos que a das estrelas mais velhas; com a energia escura, a idade sobe para $13{,}8$ bilhões de anos.

Armadilha: perguntar "o que havia antes do big bang" ou "onde ele aconteceu" como se fosse um evento num espaço e num tempo preexistentes. O espaço e o tempo fazem parte do que começou a evoluir; a física atual não descreve o instante zero.

No experimento, rode o modelo padrão (ΛCDM) e acompanhe o fator de escala com as épocas de radiação, matéria e energia escura; depois troque para um universo só de matéria e para um universo fechado que volta a colapsar.`,
      experiments: [
        { kind: "sim", id: "cosmologia", scenario: "big-bang", note: "Acompanhe a(t) no modelo ΛCDM e leia a idade do universo." },
        { kind: "sim", id: "cosmologia", scenario: "big-bang", params: { modelo: 2 }, note: "Compare com um universo só de matéria e veja a idade ficar menor que a das estrelas mais velhas." },
        { kind: "sim", id: "cosmologia", scenario: "big-bang", params: { modelo: 5 }, note: "Veja um universo fechado parar de expandir e colapsar num big crunch." },
      ],
    },
    "44-15": {
      text: String.raw`Este livro começou com medidas de comprimento, tempo e massa e termina com a história do universo. Vale olhar para o caminho percorrido. As mesmas poucas leis, conservação de energia, de momento e de carga, as leis de Newton e de Maxwell, a relatividade e a mecânica quântica, explicam do movimento de um projétil ao espectro da radiação de fundo, passando por circuitos, lentes, átomos e núcleos. A física de partículas e a cosmologia não exigiram abandonar nada disso, apenas aplicar essas leis em escalas extremas.

Ao mesmo tempo, o quadro tem lacunas grandes e honestas. Toda a matéria feita de quarks e léptons, com que o Modelo Padrão lida tão bem, é só cerca de $5\%$ do conteúdo do universo. Os outros $95\%$ são matéria escura e energia escura, das quais conhecemos apenas os efeitos gravitacionais. Não sabemos por que há matéria e não só radiação, nem como unir a gravidade à mecânica quântica, nem o que aconteceu no instante inicial.

Exemplo de quanto ainda falta: das contas da seção 44-13, se a nossa galáxia tem cerca de $3\times10^{11}$ massas solares dentro de $30$ kpc e as estrelas e o gás somam algo como $6\times10^{10}$, então de cada cinco quilogramas que atuam gravitacionalmente ali, apenas um é do tipo de que estamos feitos.

Isso não é motivo de desânimo. A história da física mostra que as anomalias, como o espalhamento de alfas em grandes ângulos, o espectro contínuo do decaimento beta ou o ruído que não sumia numa antena, foram justamente o que abriu os capítulos seguintes. Cada lacuna atual é uma pergunta bem formulada, e perguntas bem formuladas são o ponto de partida de uma descoberta.

Armadilha: pensar que, por não sabermos o que é a matéria escura, nada sabemos sobre o universo. Idade, composição, temperatura e história térmica são conhecidas com precisão de poucos por cento; o que falta é entender a natureza de alguns de seus ingredientes.

No experimento, monte um universo próprio, escolhendo as frações de matéria e de energia escura, e veja como a história da expansão e a idade dependem dessas duas quantidades que ainda não entendemos.`,
      experiments: [
        { kind: "sim", id: "cosmologia", scenario: "big-bang", params: { modelo: 0, Om: 0.05, OL: 0 }, note: "Monte um universo só com a matéria comum e compare a idade e o destino com os do ΛCDM." },
        { kind: "sim", id: "cosmologia", scenario: "big-bang", params: { modelo: 0, Om: 0.3, OL: 1.2 }, note: "Exagere a energia escura e veja como a aceleração muda a história da expansão." },
      ],
    },
  },
};
