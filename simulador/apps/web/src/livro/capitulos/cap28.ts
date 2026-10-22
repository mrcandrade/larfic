import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 28,
  intro: String.raw`O campo magnético está por trás de motores, alto-falantes, discos rígidos, aparelhos de ressonância magnética e aceleradores de partículas. Neste capítulo ele aparece pelo efeito que produz: uma força sobre cargas **em movimento**, sempre perpendicular à velocidade. Dessa força simples saem a medida da razão carga/massa do elétron, o efeito Hall, as órbitas circulares dos cíclotrons, a força sobre fios com corrente e o torque que faz girar uma espira, ideia central dos motores elétricos e do conceito de dipolo magnético.`,
  sections: {
    "28-1": {
      text: String.raw`### O que Produz um Campo Magnético?
Há duas fontes. A primeira são **cargas em movimento**, ou seja, correntes elétricas: um fio enrolado com corrente vira um eletroímã (capítulo 29). A segunda são as **partículas elementares**, como o elétron, que têm um campo magnético intrínseco associado ao spin; nos ímãs permanentes, esses campos atômicos se somam em vez de se cancelar (capítulo 32). Não se conhece carga magnética isolada: todo ímã tem polo norte e polo sul inseparáveis.

### A Definição de B
O campo elétrico foi definido pela força numa carga em repouso. O campo magnético $\vec B$ é definido pela força numa carga $q$ que passa com velocidade $\vec v$:

$$\vec F_B = q\,\vec v\times\vec B, \qquad F_B = |q|\,vB\sin\phi,$$

onde $\phi$ é o ângulo entre $\vec v$ e $\vec B$. Consequências: a força é nula se a carga está parada ou se move paralela ao campo; é máxima quando $\vec v \perp \vec B$; e é **sempre perpendicular à velocidade**, de modo que não realiza trabalho e não muda a energia cinética, só a direção do movimento. O sentido sai da regra da mão direita para $\vec v\times\vec B$, invertido se a carga for negativa.

A unidade SI é o **tesla**: $1\ \mathrm T = 1$ N/(A·m). Também se usa o gauss, $1\ \mathrm G = 10^{-4}$ T. Valores típicos: campo da Terra, cerca de $5\times10^{-5}$ T; ímã de geladeira, $10^{-2}$ T; aparelho de ressonância, $1{,}5$ a $3$ T.

**Linhas de campo** são desenhadas como no caso elétrico: tangentes a $\vec B$ e mais densas onde o campo é mais forte. Fora de um ímã, saem do polo norte e entram no polo sul; dentro dele continuam, formando laços fechados. Polos de nomes opostos se atraem. O polo norte de uma bússola aponta para o norte geográfico porque lá existe um polo **sul** magnético.

Exemplo: um próton a $2{,}0\times10^6$ m/s, perpendicular a um campo de $0{,}50$ T, sofre uma força $F = 1{,}6\times10^{-19}\cdot2{,}0\times10^6\cdot0{,}50 = 1{,}6\times10^{-13}$ N, cerca de $10^{13}$ vezes o seu peso. Se o ângulo for $30°$, a força cai à metade.

Armadilha: imaginar que a força magnética aponta ao longo das linhas de campo, como a elétrica. Ela é perpendicular a $\vec B$ e a $\vec v$ ao mesmo tempo.

No experimento, mapeie o campo de um ímã com bússolas; depois lance uma partícula perpendicular a um campo uniforme e veja a força curvar a trajetória sem mudar a rapidez.`,
      experiments: [
        { kind: "sim", id: "imas-bussola", scenario: "um-ima", note: "Mapeie as linhas de campo de um ímã em barra com bússolas." },
        { kind: "sim", id: "particula-campo-b", scenario: "circular", note: "Veja a força perpendicular à velocidade curvar a trajetória sem mudar a energia cinética." },
        { kind: "concepcao", id: "ima-atrai-qualquer-metal" },
      ],
    },
    "28-2": {
      text: String.raw`Quando uma partícula atravessa uma região com campos elétrico e magnético perpendiculares entre si e à velocidade (**campos cruzados**), as duas forças podem ter sentidos opostos. A força elétrica $qE$ não depende da velocidade; a magnética $qvB$ depende. Elas se anulam para uma única velocidade:

$$qE = qvB \quad\Rightarrow\quad v = \frac{E}{B}.$$

Partículas mais lentas são desviadas para o lado da força elétrica, e as mais rápidas para o lado da magnética. O arranjo funciona como um **seletor de velocidades**, e é independente da carga e da massa.

Foi com campos cruzados que J. J. Thomson, em 1897, mostrou que os "raios catódicos" eram feitos de partículas carregadas muito leves. O raciocínio: (1) com só o campo elétrico, mede-se a deflexão do feixe na tela; ela depende de $q/m$ e da velocidade; (2) liga-se o campo magnético e ajusta-se $B$ até o feixe voltar ao centro, o que fornece $v = E/B$; (3) com a velocidade conhecida, a deflexão inicial dá a razão $q/m$. O valor encontrado era cerca de mil vezes maior que o do íon de hidrogênio, mostrando uma partícula muito mais leve que um átomo: o **elétron**. Hoje, $e/m = 1{,}76\times10^{11}$ C/kg.

Exemplo: elétrons acelerados por $2{,}0$ kV atingem $v = \sqrt{2eV/m} \approx 2{,}65\times10^7$ m/s. Entre placas que produzem $E = 1{,}5\times10^4$ V/m, o feixe passa reto se $B = E/v \approx 0{,}57$ mT, um campo pequeno, que um par de bobinas produz facilmente.

Armadilha: achar que o seletor separa partículas por massa ou por carga. Só a velocidade importa; para separar massas é preciso um segundo estágio, como no espectrômetro de massa (seção 28-4).

No experimento, ligue só as placas e meça o desvio do feixe; depois aumente a corrente nas bobinas até o feixe voltar ao centro e calcule $v$ e $e/m$.`,
      experiments: [
        { kind: "sim", id: "razao-em", scenario: "thomson", note: "Equilibre as forças elétrica e magnética no tubo de Thomson e calcule e/m." },
        { kind: "sim", id: "particula-campo-b", scenario: "seletor", note: "Mude a velocidade de entrada e veja só v = E/B passar sem desvio." },
        { kind: "sim", id: "particula-campo-b", scenario: "exb", note: "Solte uma carga parada em campos cruzados e veja a deriva com velocidade E/B." },
      ],
    },
    "28-3": {
      text: String.raw`Num condutor com corrente colocado num campo magnético perpendicular, os portadores de carga em deriva também sofrem a força $q\vec v_d\times\vec B$. Eles se acumulam numa das bordas da fita, e a borda oposta fica com falta deles. Surge um campo elétrico transversal que cresce até que a força elétrica equilibre a magnética: é a mesma condição dos campos cruzados, agora dentro do material. A diferença de potencial entre as bordas é a **tensão Hall**.

No equilíbrio, $eE = ev_dB$. Com $E = V_H/w$ ($w$ é a largura) e $v_d = i/(neA)$, com $A = wt$ ($t$ é a espessura), obtém-se

$$V_H = \frac{iB}{n\,e\,t} \quad\text{ou}\quad n = \frac{iB}{V_H\,e\,t}.$$

O efeito Hall responde a duas perguntas. Primeiro, o **sinal dos portadores**: para a mesma corrente, cargas positivas e negativas se acumulam na **mesma** borda, mas deixam tensões de sinais opostos. Foi assim que se descobriu que a corrente nos metais é feita de elétrons, e que em certos semicondutores ela é feita de **lacunas**, que se comportam como cargas positivas. Segundo, a **densidade** $n$ de portadores, que aparece no denominador.

Como $n$ é enorme nos metais, a tensão Hall neles é minúscula: numa fita de cobre de $0{,}10$ mm de espessura, com $5{,}0$ A e $1{,}0$ T, $V_H = 5{,}0\cdot1{,}0/(8{,}5\times10^{28}\cdot1{,}6\times10^{-19}\cdot1{,}0\times10^{-4}) \approx 3{,}7\ \mu$V. Num semicondutor com $n = 10^{21}$ m⁻³, espessura de $1{,}0$ mm, $10$ mA e $0{,}50$ T, ela chega a cerca de $31$ mV. Por isso os **sensores Hall** (que medem campos e detectam a rotação de rodas e motores) usam semicondutores.

Armadilha: achar que a tensão Hall depende da largura $w$ da fita. Ela depende da espessura $t$ medida ao longo de $\vec B$; a largura se cancela.

No experimento, troque o material da placa entre o tipo n e o tipo p e observe o sinal da tensão Hall inverter; depois passe para o cobre e veja quanto ela diminui.`,
      experiments: [
        { kind: "sim", id: "motor-hall", scenario: "hall", note: "Compare o sinal da tensão Hall com portadores negativos e positivos." },
        { kind: "sim", id: "motor-hall", scenario: "hall", params: { material: 2, Ihall: 5, esp: 0.1, B: 1 }, note: "Repita com cobre e veja a tensão Hall cair a microvolts." },
      ],
    },
    "28-4": {
      text: String.raw`Se a velocidade de uma partícula é perpendicular a um campo uniforme, a força tem módulo constante e está sempre perpendicular à velocidade: é exatamente uma força centrípeta. A partícula descreve um **círculo** com rapidez constante. Da segunda lei, $|q|vB = mv^2/r$:

$$r = \frac{mv}{|q|B}, \qquad T = \frac{2\pi m}{|q|B}, \qquad f = \frac{|q|B}{2\pi m}.$$

O resultado notável é que o período e a frequência (a **frequência de cíclotron**) **não dependem da velocidade**: uma partícula mais rápida descreve um círculo maior no mesmo tempo. Isso vale enquanto $v \ll c$. Cargas positivas e negativas giram em sentidos opostos.

Se a velocidade tiver uma componente paralela ao campo, essa componente não é afetada, e a trajetória vira uma **hélice** em torno das linhas de $\vec B$, com raio dado pela componente perpendicular e passo $p = v_{\parallel}T$. Num campo que se intensifica nas extremidades, as partículas podem ser refletidas e ficar presas (garrafa magnética); é o que acontece nos cinturões de Van Allen, e as partículas que escapam perto dos polos produzem as auroras.

Exemplo: um próton a $1{,}0\times10^6$ m/s num campo de $0{,}10$ T descreve um círculo de $r = 1{,}67\times10^{-27}\cdot10^6/(1{,}6\times10^{-19}\cdot0{,}10) \approx 10$ cm, com frequência de $1{,}5$ MHz. Um elétron com a mesma velocidade gira num círculo $1836$ vezes menor e com frequência $1836$ vezes maior.

A medida do raio permite medir massas: no **espectrômetro de massa**, íons de mesma carga e mesma velocidade (ou mesma tensão de aceleração) descrevem semicírculos de raios proporcionais às massas, e os isótopos chegam ao detector em pontos diferentes.

Armadilha: pensar que o campo magnético acelera a partícula no sentido de aumentar a rapidez. Ele só a desvia; a energia cinética permanece a mesma.

No experimento, mude a velocidade e o campo e confira o raio com $mv/|q|B$; verifique que o período não muda com a velocidade e troque o próton por um elétron.`,
      experiments: [
        { kind: "sim", id: "particula-campo-b", scenario: "circular", note: "Confira r = mv/|q|B e veja que o período não depende de v." },
        { kind: "sim", id: "particula-campo-b", scenario: "circular", params: { particula: 1, v0: 1000000, B: 0.01 }, note: "Troque por um elétron e observe o sentido de giro e o raio muito menor." },
        { kind: "sim", id: "particula-campo-b", scenario: "espectrometro", note: "Separe isótopos pelo raio da trajetória." },
        { kind: "sim", id: "particula-campo-b", scenario: "garrafa", note: "Veja a hélice e a reflexão numa garrafa magnética." },
        { kind: "sim", id: "razao-em", scenario: "feixe-fino", note: "Meça o diâmetro do círculo do feixe de elétrons e calcule e/m." },
        { kind: "pratica", id: "exp3-razao-em", note: "Meça a razão carga/massa do elétron com o tubo de feixe fino." },
      ],
    },
    "28-5": {
      text: String.raw`O fato de a frequência de cíclotron não depender da velocidade é a base do **cíclotron**, inventado por Lawrence em 1931. Dois eletrodos ocos em forma de "D" ficam dentro de um campo magnético uniforme, separados por um vão estreito. Um oscilador aplica entre eles uma tensão alternada. Dentro dos "D" não há campo elétrico, e o íon apenas gira; a cada passagem pelo vão, ele é acelerado e ganha energia $qV$. Como cada meia volta leva sempre o mesmo tempo, basta que o oscilador tenha a mesma frequência do giro, a **condição de ressonância**

$$f_{\text{osc}} = f = \frac{|q|B}{2\pi m}.$$

O raio cresce a cada volta, e o íon sai pela borda com energia cinética determinada pelo raio $R$ dos "D":

$$K = \frac{q^2B^2R^2}{2m}.$$

Exemplo: prótons num campo de $0{,}50$ T exigem um oscilador de $7{,}6$ MHz. Com $R = 0{,}50$ m, saem com $K \approx 4{,}8\times10^{-13}$ J $\approx 3{,}0$ MeV. Se o vão tem $50$ kV, cada volta acrescenta $100$ keV, e são necessárias cerca de $30$ voltas.

O limite do cíclotron vem da relatividade: perto de alguns por cento da velocidade da luz, a frequência de giro diminui, e o íon sai de fase com o oscilador. No **síncrotron**, o campo magnético e a frequência do oscilador são variados durante a aceleração, de modo que as partículas percorram um anel de raio **fixo**. Isso permite energias enormes com ímãs apenas ao longo do anel; o LHC, por exemplo, tem 27 km de circunferência. Os síncrotrons também são fontes de luz intensa, como o Sirius, em Campinas.

Armadilha: achar que é o campo magnético que dá energia aos íons. Quem acelera é o campo elétrico no vão; o campo magnético só faz o íon voltar ao vão no momento certo.

No experimento, deixe o oscilador em ressonância e conte as voltas até a saída; depois desafine a frequência alguns por cento e veja o íon perder o sincronismo.`,
      experiments: [
        { kind: "sim", id: "particula-campo-b", scenario: "ciclotron", note: "Acompanhe o ganho de energia a cada passagem pelo vão em ressonância." },
        { kind: "sim", id: "particula-campo-b", scenario: "ciclotron", params: { fRF: 1.03 }, note: "Desafine o oscilador em 3% e veja o íon sair de fase." },
      ],
    },
    "28-6": {
      text: String.raw`A corrente num fio é feita de cargas em movimento, e a força magnética sobre elas é transmitida ao fio. Num trecho reto de comprimento $L$ com corrente $i$, a carga que atravessa o trecho num tempo $t = L/v_d$ é $q = it$, e a força total é $qv_dB\sin\phi = iLB\sin\phi$. Em forma vetorial,

$$\vec F_B = i\,\vec L\times\vec B,$$

onde $\vec L$ aponta no sentido da corrente. Para um fio de forma qualquer, divide-se em elementos $d\vec L$ e soma-se: $d\vec F_B = i\,d\vec L\times\vec B$. Num campo uniforme, um fio curvo entre dois pontos sofre a mesma força que um fio reto ligando esses pontos.

Exemplo: um fio horizontal de $0{,}20$ m com $5{,}0$ A, perpendicular a um campo de $0{,}50$ T, sofre $0{,}50$ N. Para que essa força segure um fio de cobre de $1{,}0$ mm² de seção (cerca de $1{,}8$ g nesse comprimento) contra a gravidade, bastaria uma corrente de cerca de $0{,}18$ A. É o princípio da **balança de corrente**: equilibrar a força magnética com um peso conhecido para medir $B$ ou a corrente.

O sentido da força segue a regra da mão direita para $\vec L\times\vec B$. Invertendo a corrente ou o campo, a força se inverte. É essa força que move o cone dos alto-falantes e os motores.

Armadilha: aplicar a fórmula com o fio paralelo ao campo. Nesse caso $\sin\phi = 0$ e a força é nula, por maior que seja a corrente.

No experimento, mude o sentido da corrente e a direção do campo e preveja o sentido da força antes de olhar; troque o fio reto por um semicírculo e compare.`,
      experiments: [
        { kind: "sim", id: "motor-hall", scenario: "fio", note: "Preveja o sentido de F = iL × B para cada combinação de corrente e campo." },
        { kind: "sim", id: "motor-hall", scenario: "fio", params: { forma: 1 }, note: "Compare a força no fio em semicírculo com a do fio reto que liga as pontas." },
        { kind: "pratica", id: "exp3-forca-magnetica", note: "Meça a força num condutor com uma balança de corrente." },
      ],
    },
    "28-7": {
      text: String.raw`Considere uma espira retangular com corrente $i$ num campo uniforme. Nos dois lados paralelos ao eixo de rotação, as forças têm o mesmo módulo e sentidos opostos, mas **não estão na mesma linha**: formam um binário. A força total é zero, mas o torque não. Para uma espira de área $A$ com $N$ voltas,

$$\tau = N\,i\,A\,B\sin\theta,$$

onde $\theta$ é o ângulo entre a **normal** à espira e o campo. O torque é máximo quando o plano da espira contém $\vec B$ ($\theta = 90°$) e nulo quando a espira fica perpendicular ao campo ($\theta = 0$). O sentido da normal vem da regra da mão direita: dedos acompanhando a corrente, o polegar dá a normal.

O torque tende a girar a espira até a normal se alinhar com o campo. Sem mais nada, a espira oscilaria em torno dessa posição. Num **motor elétrico de corrente contínua**, um **comutador** inverte a corrente na espira a cada meia volta, exatamente quando ela passa pela posição de equilíbrio. Assim o torque mantém sempre o mesmo sentido, e o rotor gira continuamente. Motores reais usam várias bobinas defasadas para suavizar o torque. O mesmo torque move o ponteiro dos galvanômetros analógicos, contra uma mola.

Exemplo: uma bobina de $100$ espiras, quadrada com $5{,}0$ cm de lado, com $1{,}5$ A num campo de $0{,}50$ T: $\tau_{\text{máx}} = 100\cdot1{,}5\cdot2{,}5\times10^{-3}\cdot0{,}50 \approx 0{,}19$ N·m.

Armadilha: achar que o torque é máximo quando a espira está "de frente" para o campo. Nessa posição as forças estão alinhadas e o torque é zero; o máximo ocorre com o plano da espira paralelo ao campo.

No experimento, desligue o comutador e veja a espira apenas oscilar em torno do equilíbrio; ligue-o e observe o gráfico do torque em função do ângulo ficar sempre com o mesmo sinal.`,
      experiments: [
        { kind: "sim", id: "motor-hall", scenario: "sem-comutador", note: "Sem comutador, a espira só oscila em torno da posição de equilíbrio." },
        { kind: "sim", id: "motor-hall", scenario: "motor", note: "Com comutador, o torque mantém o sinal e o motor gira; acrescente carga." },
        { kind: "sim", id: "motores-geradores", scenario: "motor-carga", note: "Veja a característica torque × rotação de um motor DC real." },
      ],
    },
    "28-8": {
      text: String.raw`A seção 28-7 mostra que uma bobina com corrente se comporta, num campo magnético, como uma agulha de bússola. Esse comportamento é resumido por um vetor, o **momento dipolar magnético**

$$\vec\mu = N\,i\,A\,\hat n,$$

com módulo $NiA$ e o sentido da normal dada pela regra da mão direita. Sua unidade é A·m² (ou J/T). Com ele, o torque e a energia potencial ficam

$$\vec\tau = \vec\mu\times\vec B, \qquad U = -\vec\mu\cdot\vec B,$$

formas idênticas às do dipolo elétrico num campo elétrico (seção 22-7). A energia é mínima, $-\mu B$, com $\vec\mu$ alinhado com o campo, e máxima, $+\mu B$, com $\vec\mu$ antiparalelo. Para girar o dipolo da posição estável até a oposta, um agente externo precisa realizar trabalho $2\mu B$.

Muitos objetos têm momento dipolar: ímãs em barra, a agulha da bússola, a Terra (cerca de $8\times10^{22}$ A·m²) e partículas como o elétron e o próton, cujos momentos intrínsecos (escala de $10^{-23}$ A·m² para o elétron) explicam o magnetismo dos materiais (capítulo 32) e a ressonância magnética. Longe da fonte, o campo de qualquer dipolo tem a mesma forma, decaindo com $1/r^3$ (seção 29-5).

Exemplo: a bobina da seção 28-7 tem $\mu = 100\cdot1{,}5\cdot2{,}5\times10^{-3} \approx 0{,}38$ A·m². Num campo de $0{,}50$ T, sua energia varia entre $-0{,}19$ J e $+0{,}19$ J, e virar a bobina de ponta-cabeça exige $0{,}38$ J.

Armadilha: confundir a orientação de **menor energia** com a de **maior torque**. Na posição alinhada, a energia é mínima e o torque é nulo; o torque é máximo a $90°$, onde a energia vale zero.

No experimento, solte a espira sem comutador fora do equilíbrio e veja-a oscilar em torno da posição de energia mínima; compare com uma bússola alinhando-se ao campo de um ímã.`,
      experiments: [
        { kind: "sim", id: "motor-hall", scenario: "sem-comutador", params: { theta0: 170 }, note: "Solte a espira quase antiparalela e veja-a oscilar em torno de U mínima." },
        { kind: "sim", id: "imas-bussola", scenario: "dois-imas", note: "Trate ímãs e bússolas como dipolos e encontre o ponto de campo nulo." },
        { kind: "sim", id: "stern-gerlach", scenario: "feixe", note: "Veja o momento magnético de átomos sentir a força de um campo não uniforme." },
      ],
    },
  },
};
