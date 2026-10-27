import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 40,
  intro: String.raw`O hidrogênio, com um único elétron, foi resolvido no capítulo 39. Os outros átomos têm muitos elétrons, e duas ideias novas são necessárias para entendê-los: o elétron tem um momento angular intrínseco, o **spin**, com um momento magnético associado; e dois elétrons nunca ocupam o mesmo estado quântico (**princípio de exclusão de Pauli**). Com elas, a estrutura da **tabela periódica** deixa de ser uma coleção de regularidades empíricas e passa a ser consequência da física. Neste capítulo vemos as propriedades gerais dos átomos, o spin e o experimento de Stern–Gerlach que o revelou, a ressonância magnética usada nos hospitais, o preenchimento de armadilhas e átomos com muitos elétrons, os raios X característicos que permitiram ordenar os elementos pelo número atômico e, por fim, o laser, uma das aplicações mais importantes da física atômica.`,
  sections: {
    "40-2": {
      text: String.raw`Antes de entrar nos detalhes, vale reunir o que se observa nos átomos e que uma teoria precisa explicar.

### Os átomos formam famílias
Ordenados pelo número atômico $Z$, os elementos repetem propriedades químicas e físicas em intervalos regulares. A **energia de ionização** (energia para arrancar o elétron mais externo) é o exemplo mais claro: tem picos agudos nos gases nobres (He $24{,}6$ eV, Ne $21{,}6$ eV, Ar $15{,}8$ eV) e cai bruscamente no elemento seguinte, um metal alcalino (Li $5{,}4$ eV, Na $5{,}1$ eV, K $4{,}3$ eV). Os raios atômicos fazem o oposto: diminuem ao longo de um período e saltam ao começar o próximo.

### Os átomos emitem e absorvem luz em comprimentos de onda definidos
Cada elemento tem um espectro de linhas próprio, sinal de que as energias dos estados são quantizadas, como no hidrogênio.

### Os átomos têm momento angular e momento magnético
Um elétron que "circula" em torno do núcleo tem momento angular orbital e, como é carregado, forma uma pequena espira de corrente com momento magnético. Os dois vetores estão ligados (seção 40-4). Experimentos como o de Einstein–de Haas mostram essa ligação: magnetizar um cilindro de ferro faz o cilindro girar.

### Os momentos angulares são quantizados
Num campo magnético, as componentes dos momentos angulares e magnéticos só assumem valores discretos.

Exemplo: o sódio ($Z = 11$) tem energia de ionização de $5{,}1$ eV, cerca de um quarto da do neônio ($Z = 10$), apesar de ter um próton a mais. A explicação, vista na seção 40-9, é que o 11º elétron começa uma camada nova, mais afastada e blindada por dez elétrons internos.

Armadilha: esperar que a energia de ionização cresça sempre com $Z$, já que a carga nuclear cresce. A blindagem pelos elétrons internos e a camada ocupada pesam mais que o número de prótons.

No experimento, percorra a tabela e localize os picos de ionização nos gases nobres e as quedas nos alcalinos; acompanhe também o raio atômico.`,
      experiments: [
        { kind: "sim", id: "tabela-periodica", scenario: "propriedades", note: "Percorra a tabela e veja a energia de ionização e o raio se repetirem a cada período." },
        { kind: "sim", id: "espectros-laser", scenario: "emissao-absorcao", note: "Veja as linhas de emissão e absorção próprias de um elemento." },
      ],
    },
    "40-3": {
      text: String.raw`Além do momento angular orbital, ligado ao "movimento" em torno do núcleo, todo elétron tem um momento angular **intrínseco**, o **spin** $\vec S$, que existe mesmo para um elétron livre e em repouso. O nome sugere uma bolinha girando, mas essa imagem não funciona (a superfície teria de andar mais depressa que a luz); o spin é uma propriedade tão fundamental quanto a massa e a carga.

O spin é quantizado como os outros momentos angulares, mas com número quântico **semi-inteiro**, $s = \tfrac12$, para todos os elétrons:

$$S = \sqrt{s(s+1)}\,\hbar = \frac{\sqrt3}{2}\hbar,\qquad S_z = m_s\hbar,\quad m_s = \pm\tfrac12.$$

Só há duas orientações possíveis em relação a um eixo: "spin para cima" e "spin para baixo". Prótons e nêutrons também têm $s = \tfrac12$; os fótons têm $s = 1$.

Assim, o estado de um elétron no átomo de hidrogênio exige **quatro** números quânticos: $n$, $\ell$, $m_\ell$ e $m_s$. O número de estados de mesmo $n$ dobra, de $n^2$ para $2n^2$: duas para $n = 1$, oito para $n = 2$, dezoito para $n = 3$. Essas contagens reaparecem nos comprimentos dos períodos da tabela periódica.

Exemplo: o vetor $\vec S$ tem módulo $0{,}866\hbar$, mas a componente $S_z$ vale só $0{,}5\hbar$. O ângulo entre $\vec S$ e o eixo $z$ é, portanto, $\arccos(0{,}5/0{,}866) \approx 55°$: o spin nunca aponta exatamente ao longo do eixo de medida, e as componentes $S_x$ e $S_y$ ficam indefinidas.

Armadilha: confundir $s$ com $m_s$. O número $s = \tfrac12$ é fixo e caracteriza o elétron; o que varia de estado para estado é $m_s$, a projeção sobre o eixo escolhido.

No experimento, mande átomos de prata, cujo momento magnético vem de um único elétron desemparelhado, por um ímã não uniforme e veja só dois pontos de chegada; no qubit, um sistema de dois estados como o spin, meça muitas vezes e acompanhe as contagens.`,
      experiments: [
        { kind: "sim", id: "stern-gerlach", scenario: "feixe", note: "Veja o feixe se dividir em exatamente dois, um para cada valor de m_s." },
        { kind: "sim", id: "qubit-dois-niveis", scenario: "moeda", note: "Prepare um sistema de dois níveis, como um spin ½, e meça-o muitas vezes." },
      ],
    },
    "40-4": {
      text: String.raw`Uma carga que circula forma uma espira de corrente e, portanto, um dipolo magnético (capítulo 28). Para o elétron, de carga negativa, o momento magnético orbital aponta **contra** o momento angular orbital:

$$\vec\mu_{\text{orb}} = -\frac{e}{2m}\vec L.$$

Como $L_z = m_\ell\hbar$, a componente do momento magnético também é quantizada:

$$\mu_{\text{orb},z} = -m_\ell\,\mu_B,\qquad \mu_B = \frac{e\hbar}{2m} = 9{,}27\times10^{-24}\ \mathrm{J/T},$$

em que $\mu_B$ é o **magnéton de Bohr**, a unidade natural dos momentos magnéticos atômicos.

O spin também tem momento magnético, mas com o dobro da razão entre $\mu$ e o momento angular:

$$\vec\mu_s = -\frac{e}{m}\vec S,\qquad \mu_{s,z} = -2m_s\,\mu_B = \mp\mu_B.$$

O fator $2$ não tem explicação clássica; sai da teoria relativística de Dirac (e uma correção minúscula, de $0{,}1\%$, da eletrodinâmica quântica).

Num campo magnético $\vec B$ ao longo de $z$, um dipolo tem energia potencial $U = -\mu_zB$. Por isso, os níveis de um átomo se separam num campo: é o **efeito Zeeman**. Num átomo com vários elétrons, os momentos se somam; em camadas completas, se cancelam aos pares. Por isso o momento magnético atômico vem dos elétrons **desemparelhados**, que tornam o material paramagnético (capítulo 32).

Exemplo: um elétron com spin para cima num campo de $1{,}0$ T tem $U = +\mu_B B = 9{,}3\times10^{-24}$ J $\approx 58$ µeV; com spin para baixo, $-58$ µeV. A diferença, $116$ µeV, corresponde a um fóton de $28$ GHz (micro-ondas): é a ressonância de spin eletrônico.

Armadilha: esquecer o sinal negativo e supor $\vec\mu$ paralelo a $\vec L$. Para o elétron, os dois são antiparalelos; um elétron com "spin para cima" tem $\mu_z$ para baixo e menor energia quando o momento magnético se alinha com $\vec B$.

No experimento, alinhe momentos magnéticos atômicos com um campo aplicado e veja a lei de Curie; no hidrogênio, relacione os orbitais 2p com os valores de $m_\ell$.`,
      experiments: [
        { kind: "sim", id: "magnetismo-materia", scenario: "para", note: "Veja momentos magnéticos atômicos se alinharem parcialmente com o campo." },
        { kind: "sim", id: "hidrogenio", scenario: "2p", note: "Relacione os orbitais 2p com m_ℓ e com a componente L_z do momento angular." },
        { kind: "sim", id: "stern-gerlach", scenario: "feixe", note: "Meça a força sobre μ_z num gradiente de campo." },
      ],
    },
    "40-5": {
      text: String.raw`Em 1922, Stern e Gerlach mandaram um feixe de átomos de prata, evaporados num forno, entre os polos de um ímã com campo **não uniforme**. Num campo uniforme, um dipolo só sofre torque; num campo que varia com $z$, sofre também uma força resultante,

$$F_z = \mu_z\,\frac{dB}{dz},$$

que desvia o átomo para cima ou para baixo conforme o sinal de $\mu_z$. Se os momentos magnéticos pudessem apontar em qualquer direção, como se espera classicamente para átomos que saem do forno com orientações aleatórias, o feixe chegaria ao anteparo como uma mancha contínua. O que se viu foram **duas manchas** separadas e nada no meio.

A conclusão: $\mu_z$ só tem dois valores. A prata tem 47 elétrons; 46 formam camadas completas com momentos cancelados e o último está num estado com $\ell = 0$, sem momento orbital. O momento do átomo vem só do **spin** desse elétron, com $\mu_z = \mp\mu_B$. (Na época, o spin ainda não tinha sido proposto; a interpretação veio alguns anos depois.)

O experimento mostra também a natureza da medida quântica. Selecione os átomos com $\mu_z$ para cima e mande-os a um segundo ímã orientado em $z$: todos saem para cima. Se o segundo ímã estiver em $x$, metade sai para cada lado; e, se um terceiro ímã em $z$ vier depois, os dois resultados em $z$ reaparecem, como se a medida em $x$ tivesse "apagado" a anterior. Com o aparelho girado de $\theta$, a fração que segue pelo mesmo lado é $\cos^2(\theta/2)$.

Exemplo: átomos de prata ($m = 1{,}79\times10^{-25}$ kg) a $600$ m/s atravessam $4{,}0$ cm de um ímã com $dB/dz = 1000$ T/m. A aceleração é $\mu_B\cdot1000/m \approx 5{,}2\times10^4$ m/s², o tempo no ímã, $67$ µs, e o desvio na saída, cerca de $0{,}12$ mm para cada lado; a separação cresce no voo até o anteparo.

Armadilha: atribuir as duas manchas a "dois tipos de átomos" no feixe. Todos os átomos são iguais; cada um, ao ser medido, sai num dos dois resultados, com probabilidades dadas pelo seu estado.

No experimento, compare o feixe quântico com o borrão clássico; depois monte aparelhos em série (z, x, z) e gire o segundo aparelho para verificar $\cos^2(\theta/2)$.`,
      experiments: [
        { kind: "sim", id: "stern-gerlach", scenario: "feixe", note: "Compare as duas manchas com o borrão previsto classicamente." },
        { kind: "sim", id: "stern-gerlach", scenario: "zxz", note: "Monte z, x e z em série e veja a medida em x apagar a informação sobre z." },
        { kind: "sim", id: "stern-gerlach", scenario: "angulo", note: "Gire o segundo aparelho e confira a fração cos²(θ/2)." },
      ],
    },
    "40-6": {
      text: String.raw`Os prótons também têm spin $\tfrac12$ e momento magnético, cerca de 660 vezes menor que o do elétron: a componente vale $\mu_z = \pm1{,}41\times10^{-26}$ J/T. Num campo $\vec B$, os dois estados de spin do próton têm energias $\mp\mu_zB$, separadas por $2\mu_zB$. Um fóton de radiofrequência faz o próton saltar entre eles quando

$$hf = 2\mu_z B.$$

Essa é a condição de **ressonância magnética nuclear** (RMN). Ela depende do campo **local** que o próton sente, que é o campo externo mais pequenas contribuições dos elétrons e núcleos vizinhos. Por isso, a frequência de ressonância identifica o ambiente químico de cada hidrogênio numa molécula, e a RMN se tornou uma das principais ferramentas da química.

Na **imagem por ressonância magnética** (IRM), um gradiente de campo faz a frequência de ressonância depender da posição. Medindo a intensidade do sinal em cada frequência, reconstrói-se a densidade de prótons (sobretudo da água e da gordura) ponto a ponto. Os contrastes entre tecidos vêm dos tempos de **relaxação**: depois de um pulso de RF, os spins voltam ao equilíbrio com um tempo $T_1$ e perdem a coerência entre si com um tempo $T_2$, diferentes em cada tecido.

Visto de forma semiclássica, o momento magnético **precessa** em torno de $\vec B$ com a frequência de Larmor, que coincide com a frequência de ressonância. O pulso de RF, sintonizado nessa frequência, gira a magnetização (um pulso de $90°$ a deita no plano transversal), e o sinal medido vem dela precessando e decaindo.

Exemplo: num tomógrafo de $1{,}5$ T, $f = 2\cdot1{,}41\times10^{-26}\cdot1{,}5/6{,}63\times10^{-34} \approx 64$ MHz, na faixa das rádios FM. A energia de cada fóton, $hf \approx 0{,}26$ µeV, é dezenas de milhões de vezes menor que a de um fóton visível: a radiação não é ionizante.

Armadilha: associar "nuclear" a radioatividade. A ressonância magnética nuclear não envolve decaimento nem radiação ionizante; o nome se refere apenas aos spins dos núcleos.

No experimento, veja a precessão de Larmor, aplique um pulso de $90°$ e acompanhe a relaxação; depois mude os tempos de repetição e de eco para trocar o contraste da imagem.`,
      experiments: [
        { kind: "sim", id: "rmn-mri", scenario: "larmor", note: "Veja os spins precessarem e relacione a frequência com o campo B₀." },
        { kind: "sim", id: "rmn-mri", scenario: "relaxacao", note: "Aplique um pulso de 90° e meça T₁ e T₂ no sinal de indução livre." },
        { kind: "sim", id: "rmn-mri", scenario: "imagem", note: "Ajuste TR e TE e veja o contraste entre tecidos mudar." },
        { kind: "sim", id: "qubit-dois-niveis", scenario: "rabi", note: "Gire um sistema de dois níveis com um campo ressonante e veja o efeito da dessintonia." },
      ],
    },
    "40-7": {
      text: String.raw`Em 1925, Pauli propôs uma regra que, até onde se sabe, nunca é violada:

**Dois elétrons num mesmo sistema não podem estar no mesmo estado quântico.**

Num átomo, isso significa que dois elétrons não podem ter os quatro números quânticos $n$, $\ell$, $m_\ell$ e $m_s$ todos iguais. Cada combinação $(n, \ell, m_\ell)$, isto é, cada **orbital**, pode receber no máximo **dois** elétrons, e eles precisam ter spins opostos.

O princípio vale para todas as partículas de spin semi-inteiro (**férmions**: elétrons, prótons, nêutrons, quarks). Partículas de spin inteiro (**bósons**, como os fótons) não obedecem a ele; muitas podem ocupar o mesmo estado, o que é a base do laser (seção 40-11).

Sem a exclusão, todos os elétrons de um átomo cairiam no estado fundamental $n = 1$, os átomos seriam todos parecidos e pequenos, e não haveria química. É o princípio de Pauli que força os elétrons a ocupar níveis cada vez mais altos, dando aos átomos seu tamanho e sua estrutura em camadas. A rigidez da matéria (por que não atravessamos as paredes) e a estabilidade das anãs brancas e das estrelas de nêutrons também dependem dele.

Exemplo: a camada $n = 2$ tem as subcamadas $\ell = 0$ (um orbital, $m_\ell = 0$) e $\ell = 1$ (três orbitais, $m_\ell = -1, 0, 1$). São quatro orbitais e, com dois spins cada, **oito** elétrons: é o número de elementos do segundo período, do lítio ao neônio.

Armadilha: entender o princípio como uma repulsão elétrica entre os elétrons. A repulsão de Coulomb existe e importa para as energias, mas a exclusão é outra coisa: valeria mesmo para elétrons sem carga, e vale para nêutrons.

No experimento, coloque vários elétrons num poço e alterne entre "com Pauli" e "sem exclusão": veja como a energia total muda; no preenchimento atômico, veja que nenhuma caixa recebe mais de dois elétrons.`,
      experiments: [
        { kind: "sim", id: "tabela-periodica", scenario: "poco-muitos-eletrons", params: { pauli: 0 }, note: "Desligue a exclusão e veja todos os elétrons caírem no nível mais baixo." },
        { kind: "sim", id: "tabela-periodica", scenario: "aufbau", note: "Preencha os orbitais e confira que cada um recebe no máximo dois elétrons de spins opostos." },
      ],
    },
    "40-8": {
      text: String.raw`Antes dos átomos, vale aplicar o princípio de exclusão às armadilhas do capítulo 39, em que os níveis são simples. Suponha que vários elétrons sejam colocados num poço infinito e, para simplificar, ignore a repulsão entre eles. Cada estado espacial (rotulado por $n$ em 1D ou por $(n_x, n_y)$ em 2D) aceita dois elétrons, um com cada spin. O **estado fundamental** do sistema se obtém enchendo os níveis de baixo para cima, dois elétrons por estado; a energia total é a soma das energias individuais.

Num poço 1D, com $E_n = n^2E_1$:

- $N = 4$: dois elétrons em $n = 1$ e dois em $n = 2$, $E_{\text{tot}} = 2\cdot1 + 2\cdot4 = 10\,E_1$;
- $N = 5$: o quinto vai para $n = 3$, $E_{\text{tot}} = 19\,E_1$.

O primeiro **estado excitado** é o de menor energia acima do fundamental. Com $N = 4$, a menor excitação leva um elétron de $n = 2$ para $n = 3$: $\Delta E = 9E_1 - 4E_1 = 5E_1$. Quando o nível mais alto está só pela metade, porém, pode ser mais barato promover um elétron de baixo para a vaga.

Num curral **quadrado** 2D, $E = (n_x^2 + n_y^2)E_1$, e os estados $(1,2)$ e $(2,1)$ são degenerados. Com $N = 3$: dois elétrons em $(1,1)$ e um em $(1,2)$ ou $(2,1)$: $E_{\text{tot}} = 2\cdot2 + 5 = 9\,E_1$. Os níveis degenerados formam grupos que se enchem juntos, exatamente como as subcamadas atômicas.

Exemplo numérico: para $L = 1{,}0$ nm, $E_1 = h^2/8mL^2 \approx 0{,}38$ eV. Quatro elétrons no poço 1D somam $3{,}8$ eV, e a menor excitação, $1{,}9$ eV, corresponde a um fóton de $660$ nm, vermelho.

Armadilha: colocar todos os elétrons no nível mais baixo (ou um só por nível, esquecendo o spin). São dois por estado espacial, nem mais, nem menos.

No experimento, escolha $N$ e confira a energia total e a menor excitação; passe para 2D e veja os níveis degenerados se encherem em grupos.`,
      experiments: [
        { kind: "sim", id: "tabela-periodica", scenario: "poco-muitos-eletrons", params: { N: 4 }, note: "Com quatro elétrons num poço 1D, confira a energia total e a menor excitação." },
        { kind: "sim", id: "tabela-periodica", scenario: "poco-muitos-eletrons", params: { dim: 2, N: 3 }, note: "Num curral quadrado, veja os níveis degenerados receberem elétrons." },
      ],
    },
    "40-9": {
      text: String.raw`Com os quatro números quânticos e o princípio de exclusão, a tabela periódica se constrói acrescentando elétrons, um a um, aos estados de menor energia disponíveis. Os estados de mesmo $n$ formam uma **camada**; os de mesmo $n$ e $\ell$, uma **subcamada**, com $2(2\ell + 1)$ lugares: $2, 6, 10, 14$ para s, p, d, f. Diferente do hidrogênio, num átomo com muitos elétrons a energia depende também de $\ell$: elétrons de $\ell$ pequeno penetram mais perto do núcleo, são menos blindados e ficam mais ligados. A ordem prática de preenchimento é a de $n + \ell$ crescente (para $n+\ell$ iguais, o de menor $n$ primeiro): $1s, 2s, 2p, 3s, 3p, 4s, 3d, 4p, \dots$

### Neônio
Dez elétrons: $1s^2\,2s^2\,2p^6$. As camadas $n = 1$ e $n = 2$ estão completas; a distribuição de carga é esfericamente simétrica e fortemente ligada. Por isso o neônio quase não reage e tem ionização alta.

### Sódio
O 11º elétron começa a camada $n = 3$: $[\mathrm{Ne}]\,3s^1$. Ele está longe e blindado por dez elétrons internos, que deixam uma carga efetiva próxima de $+e$. Ionizá-lo custa só $5{,}1$ eV, e o sódio cede esse elétron com facilidade: é um metal alcalino.

### Cloro
Com $17$ elétrons, $[\mathrm{Ne}]\,3s^2\,3p^5$, falta **um** para completar a subcamada $3p$. O cloro captura um elétron facilmente, formando $\mathrm{Cl^-}$; com o sódio, faz o sal de cozinha.

### Ferro
Com $26$ elétrons, $[\mathrm{Ar}]\,3d^6\,4s^2$. A subcamada $4s$ enche antes da $3d$, e os elétrons $3d$, internos, ficam parcialmente preenchidos. Os metais de transição devem a esses elétrons $d$ suas cores e seu magnetismo; pela **regra de Hund**, elétrons numa subcamada ocupam primeiro orbitais diferentes com spins paralelos, deixando momentos magnéticos desemparelhados.

Exemplo: o oxigênio ($Z = 8$), $1s^2\,2s^2\,2p^4$, tem quatro elétrons para três orbitais $2p$; pela regra de Hund, dois ficam desemparelhados. O $\mathrm O_2$ líquido é atraído por um ímã.

Armadilha: achar que a ordem $n+\ell$ é uma lei exata. Há exceções medidas, como o cromo e o cobre, em que um elétron $4s$ passa para a $3d$.

No experimento, construa os átomos passo a passo, confira as configurações do neônio, do sódio, do cloro e do ferro e compare a configuração real com a regra simples nas exceções.`,
      experiments: [
        { kind: "sim", id: "tabela-periodica", scenario: "aufbau", note: "Construa os átomos elétron a elétron e veja as camadas se completarem." },
        { kind: "sim", id: "tabela-periodica", scenario: "aufbau", params: { Z: 26 }, note: "Monte o ferro e veja os elétrons 3d desemparelhados." },
        { kind: "sim", id: "tabela-periodica", scenario: "propriedades", note: "Relacione as camadas completas aos picos de ionização dos gases nobres." },
      ],
    },
    "40-10": {
      text: String.raw`Elétrons acelerados por dezenas de quilovolts e freados num alvo metálico produzem **raios X**. O espectro tem duas partes.

### O espectro contínuo
Ao ser desacelerado no campo de um núcleo, o elétron emite um fóton (radiação de frenagem). Pode perder qualquer fração da energia cinética, mas no máximo toda ela, $eV$. Isso dá um **comprimento de onda de corte** abaixo do qual não há emissão, independente do metal do alvo:

$$\lambda_{\min} = \frac{hc}{eV}.$$

Com $V = 30$ kV, $\lambda_{\min} = 1240/30\,000$ nm $\approx 41$ pm. A existência desse corte nítido é, por si só, prova do caráter de fóton da radiação.

### O espectro característico
Sobre o contínuo aparecem picos agudos que dependem do **material** do alvo. Um elétron incidente arranca um elétron da camada mais interna ($K$, $n = 1$); um elétron de cima cai para a vaga e emite um fóton. A queda da camada $L$ ($n = 2$) dá a linha $K_\alpha$; da camada $M$, a $K_\beta$.

### A lei de Moseley e a ordem da tabela
Em 1913, Moseley mediu as linhas $K_\alpha$ de dezenas de elementos e viu que $\sqrt f$ cresce **linearmente** com a posição do elemento na tabela. Um modelo de Bohr explica: o elétron que cai sente o núcleo de carga $Ze$ blindado pelo elétron $K$ que restou, ou seja, uma carga efetiva $(Z - 1)e$. Então

$$E_{K\alpha} \approx 13{,}6\ \mathrm{eV}\,(Z-1)^2\left(1 - \tfrac14\right) \approx 10{,}2\ \mathrm{eV}\,(Z-1)^2.$$

Isso estabeleceu que a ordem natural dos elementos é a do **número atômico** (carga nuclear), não a da massa, e mostrou lacunas onde faltavam elementos ainda não descobertos.

Exemplo: para o cobre ($Z = 29$), $E_{K\alpha} \approx 10{,}2\cdot28^2 \approx 8{,}0$ keV, $\lambda \approx 0{,}155$ nm, muito perto do valor medido. Essa linha é a fonte padrão dos difratômetros de laboratório.

Armadilha: pensar que aumentar a tensão do tubo desloca as linhas características. A tensão move o corte $\lambda_{\min}$ e aumenta a intensidade; as linhas ficam onde estão, pois dependem só dos níveis do alvo (desde que $eV$ supere a energia da camada $K$).

No experimento, varie a tensão e veja o corte de Duane–Hunt se mover enquanto os picos ficam parados; depois percorra os elementos e confira a reta de Moseley.`,
      experiments: [
        { kind: "sim", id: "raios-x", scenario: "duane-hunt", note: "Mude a tensão e veja o corte λ_min se mover enquanto as linhas K ficam fixas." },
        { kind: "sim", id: "raios-x", scenario: "moseley", note: "Meça a linha Kα de vários elementos e ajuste a lei de Moseley." },
        { kind: "sim", id: "tabela-periodica", scenario: "moseley", note: "Veja √f crescer linearmente com Z e as lacunas da tabela de 1914." },
        { kind: "sim", id: "raios-x", scenario: "bragg", note: "Meça o comprimento de onda da linha Kα com um cristal (difração de Bragg)." },
      ],
    },
    "40-11": {
      text: String.raw`A luz de uma lâmpada comum vem de bilhões de átomos que emitem independentemente, em instantes, direções e fases aleatórias. A luz de um **laser** (sigla em inglês para amplificação de luz por emissão estimulada de radiação) é diferente em quatro aspectos:

- **monocromática**: a largura espectral pode ser de uma parte em $10^{15}$ nos lasers mais estáveis;
- **coerente**: as ondas mantêm a fase ao longo de distâncias enormes (quilômetros, em alguns casos), e por isso interferem com facilidade;
- **direcional**: o feixe se abre muito pouco, limitado só pela difração na abertura de saída;
- **concentrável**: pode ser focalizada num ponto da ordem do comprimento de onda, atingindo intensidades altíssimas.

Essas propriedades sustentam uma lista longa de aplicações: leitura de códigos de barras e discos, comunicações por fibra óptica, cirurgias oftalmológicas, corte e solda industriais, medidas de distância (até a Lua, com refletores deixados pelos astronautas), impressoras, interferômetros de ondas gravitacionais, pinças ópticas e resfriamento de átomos a microkelvins.

Exemplo: um apontador laser de $1$ mW, $650$ nm, com feixe de $1$ mm de diâmetro tem intensidade $10^{-3}/(\pi\cdot0{,}0005^2) \approx 1{,}3$ kW/m², parecida com a do Sol a pino. Focalizado pela lente do olho num ponto de alguns micrômetros, ela sobe para milhões de watts por metro quadrado: por isso nunca se olha para um feixe laser.

O ângulo de abertura por difração é da ordem de $\lambda/D$; com $D = 1$ mm e $\lambda = 650$ nm, cerca de $0{,}65$ mrad, o que faz o ponto ter $6{,}5$ cm de diâmetro a $100$ m.

Armadilha: achar que um laser é simplesmente "luz muito forte". Muitos lasers têm potência menor que a de uma lâmpada; o que os distingue é a coerência e a direcionalidade, que permitem concentrar a energia.

No experimento, veja o laser começar a emitir quando o bombeamento passa do limiar; nas pinças ópticas, use um feixe focalizado para prender uma esfera microscópica.`,
      experiments: [
        { kind: "sim", id: "espectros-laser", scenario: "limiar", note: "Aumente o bombeamento e veja a emissão disparar acima do limiar." },
        { kind: "sim", id: "resfriamento-laser", scenario: "pinca", note: "Use um feixe laser focalizado para prender uma esfera e medir a rigidez da pinça." },
      ],
    },
    "40-12": {
      text: String.raw`Um átomo com dois níveis de energia, $E_0$ e $E_x$ ($E_x > E_0$), interage com a radiação de frequência $f = (E_x - E_0)/h$ de três maneiras:

- **absorção**: no nível baixo, absorve um fóton e sobe;
- **emissão espontânea**: no nível alto, decai sozinho depois de um tempo médio (a vida média, tipicamente $10^{-8}$ s) e emite um fóton em direção e fase aleatórias;
- **emissão estimulada**: no nível alto, um fóton de frequência $f$ que passa provoca o decaimento, e o fóton emitido é **idêntico** ao que o estimulou (mesma frequência, fase, direção e polarização). É o processo (previsto por Einstein) que amplifica a luz.

Num gás em equilíbrio térmico, a população dos níveis segue Boltzmann, $N_x/N_0 = e^{-(E_x - E_0)/kT}$. Para $E_x - E_0 = 2$ eV a $300$ K, a razão é cerca de $10^{-34}$: quase todos os átomos estão embaixo, e a absorção vence a emissão estimulada. Para amplificar, é preciso uma **inversão de população**, com mais átomos no nível alto, mantida fora do equilíbrio por **bombeamento** (descarga elétrica, luz, corrente).

Com só dois níveis, a inversão é impossível por bombeamento óptico: a mesma luz que sobe os átomos os estimula a descer. Os lasers práticos usam **três ou quatro níveis**. No esquema de quatro níveis, os átomos são bombeados para um nível alto, caem rapidamente para um nível **metaestável** (vida média longa, da ordem de milissegundos), e a transição laser vai desse nível para um nível inferior que se esvazia depressa. A inversão aparece com pouco bombeamento.

O meio ativo fica numa **cavidade** entre dois espelhos; um deles deixa sair uma pequena fração da luz. Os fótons que viajam ao longo do eixo são amplificados a cada passagem. O laser "liga" quando o ganho por volta supera as perdas: é o **limiar**.

Exemplo: no laser de hélio–neônio, a descarga excita átomos de hélio para um nível metaestável a $20{,}61$ eV; por colisão, eles passam a energia a átomos de neônio, cujo nível de $20{,}66$ eV fica quase coincidente. A transição laser leva o neônio a $18{,}70$ eV, emitindo $1{,}96$ eV, ou seja, $632{,}8$ nm.

Armadilha: imaginar que os espelhos "geram" a luz. Eles só realimentam; sem inversão de população, a luz que vai e volta é absorvida em vez de amplificada.

No experimento, compare o meio de três níveis com o de quatro e veja quanto bombeamento cada um exige; diminua a refletividade do espelho de saída e observe o limiar subir.`,
      experiments: [
        { kind: "sim", id: "espectros-laser", scenario: "limiar", note: "Ajuste o bombeamento no meio de quatro níveis e encontre o limiar de oscilação." },
        { kind: "sim", id: "espectros-laser", scenario: "tres-niveis", note: "Veja por que o meio de três níveis exige muito mais bombeamento." },
        { kind: "sim", id: "espectros-laser", scenario: "limiar", params: { R: 0.7 }, note: "Reduza a refletividade do espelho de saída e veja o limiar subir." },
      ],
    },
  },
};
