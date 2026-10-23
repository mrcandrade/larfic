import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 11,
  intro: String.raw`O capítulo 10 tratou de corpos que giram em torno de um eixo fixo. Agora o eixo também se move: uma roda que **rola** pela estrada combina translação e rotação, e a ligação entre as duas depende do atrito no ponto de contato. Depois generalizamos o torque como produto vetorial e introduzimos o **momento angular**, a grandeza rotacional que corresponde ao momento linear. Sua forma da segunda lei, $\vec\tau = d\vec L/dt$, e sua conservação explicam a patinadora que gira mais depressa ao recolher os braços, a estabilidade de uma bicicleta em movimento, a órbita dos planetas e o curioso comportamento do giroscópio, que não cai mas precessiona.`,
  sections: {
    "11-2": {
      text: String.raw`Uma roda de raio $R$ que rola **sem deslizar** sobre uma superfície plana está ao mesmo tempo transladando (o centro avança) e girando (em torno do centro). As duas coisas estão amarradas: quando a roda dá uma volta, o centro avança exatamente uma circunferência, $2\pi R$. Daí
$$v_{CM} = \omega R, \qquad a_{CM} = \alpha R .$$
Essa é a **condição de rolamento**.

### Superposição de dois movimentos
A velocidade de cada ponto da roda é a soma de duas partes: a translação $\vec v_{CM}$, igual para todos, e a rotação em torno do centro, de módulo $\omega R$ na borda, tangente ao aro.
- No **ponto de contato** com o chão, as duas parcelas são opostas e se cancelam: velocidade **zero**.
- No **topo**, elas se somam: $2v_{CM}$.
- No centro, só a translação: $v_{CM}$.

### Rotação pura em torno do ponto de contato
Outra forma de ver: a cada instante, a roda gira em torno de um eixo que passa pelo ponto de contato, com o mesmo $\omega$. A velocidade de cada ponto é $\omega$ vezes a distância até o contato. Por isso, numa foto de uma roda de bicicleta, os raios de cima saem borrados e os de baixo, nítidos.

**Exemplo.** Um carro anda a 72 km/h (20 m/s) com pneus de 0,30 m de raio. A roda gira a $\omega = 20/0{,}30 \approx 67$ rad/s (≈ 640 rpm). O ponto mais alto do pneu passa a 40 m/s e o ponto em contato com o asfalto está parado: é por isso que o atrito entre pneu e asfalto, num carro que não derrapa, é **estático**.

**Armadilha:** achar que todos os pontos da roda se movem com a velocidade do carro.

No experimento, observe os corpos rolando na rampa: com atrito suficiente, a condição $v_{CM} = \omega R$ se mantém em todo o percurso e o ponto de contato fica instantaneamente parado.`,
      experiments: [
        { kind: "sim", id: "rolamento", scenario: "corrida", note: "Acompanhe v_CM e ωR de cada corpo e confira que são iguais quando não há deslizamento." },
        { kind: "sim", id: "rolamento", scenario: "desliza", note: "Com atrito insuficiente, v_CM e ωR se separam: o corpo rola e desliza ao mesmo tempo." },
      ],
    },
    "11-3": {
      text: String.raw`Visto como rotação pura em torno do ponto de contato P, um corpo que rola tem energia cinética $K = \tfrac12 I_P\omega^2$. Pelo teorema dos eixos paralelos, $I_P = I_{CM} + MR^2$, e com $v_{CM} = \omega R$:
$$K = \tfrac12 I_{CM}\omega^2 + \tfrac12 M v_{CM}^2 .$$
A energia cinética de rolamento é a soma de uma parcela de **rotação** em torno do CM e uma de **translação** do CM.

### A corrida rampa abaixo
Um corpo que desce rolando, sem deslizar, de uma altura $h$ converte $Mgh$ nessas duas parcelas (o atrito estático não dissipa energia, porque o ponto de contato não se move). Escrevendo $I_{CM} = \beta MR^2$:
$$Mgh = \tfrac12 M v^2 (1 + \beta) \;\Rightarrow\; v = \sqrt{\frac{2gh}{1 + \beta}} .$$
O resultado **não depende da massa nem do raio**, só da forma ($\beta$). Quanto maior a fração da energia que vai para a rotação, mais devagar o corpo desce:
- esfera maciça ($\beta = 2/5$): $v = \sqrt{10gh/7}$;
- cilindro maciço ($\beta = 1/2$): $v = \sqrt{4gh/3}$;
- anel ou casca cilíndrica ($\beta = 1$): $v = \sqrt{gh}$.
Num empate entre todos, só um bloco deslizando sem atrito ($\beta = 0$) chegaria a $\sqrt{2gh}$.

**Exemplo.** De uma rampa com 1,5 m de desnível, uma bola de bilhar chega a $\sqrt{10 \cdot 9{,}8 \cdot 1{,}5/7} \approx 4{,}6$ m/s; uma lata de tinta cheia (≈ cilindro maciço), a 4,4 m/s; um anel, a 3,8 m/s. A esfera guarda só $2/7$ de sua energia cinética como rotação; o anel, metade.

**Armadilha:** apostar que o corpo mais pesado ou maior vence a corrida.

No experimento, preveja a ordem de chegada de esfera, cilindro e anel; depois troque massa e raio de um deles e veja que o tempo não muda.`,
      experiments: [
        { kind: "sim", id: "rolamento", scenario: "corrida", note: "Preveja a ordem de chegada da esfera, do cilindro e do anel e confira." },
        { kind: "sim", id: "rolamento", scenario: "tamanhos", note: "Mude massa e raio de um mesmo tipo de corpo e veja que o tempo de descida não muda." },
        { kind: "concepcao", id: "maior-rola-mais-rapido", note: "Confronte a ideia de que o cilindro maior desce mais rápido." },
      ],
    },
    "11-4": {
      text: String.raw`Para que um corpo role sem deslizar, a condição $a_{CM} = \alpha R$ precisa ser imposta por alguma força. Quem faz isso é o **atrito estático** no ponto de contato.

### Rolamento rampa abaixo
Sobre uma rampa de ângulo $\theta$ atuam o peso, a normal e o atrito estático $f_e$, para cima da rampa. Translação e rotação (torques em torno do CM; só o atrito tem braço):
$$Mg\sin\theta - f_e = M a_{CM}, \qquad f_e R = I_{CM}\frac{a_{CM}}{R} .$$
Resolvendo,
$$a_{CM} = \frac{g\sin\theta}{1 + I_{CM}/(MR^2)}, \qquad f_e = \frac{\beta}{1+\beta}\,Mg\sin\theta .$$
O atrito freia a translação e, ao mesmo tempo, acelera a rotação; não realiza trabalho, porque age num ponto parado.

### Quando o atrito não basta
O atrito estático tem limite: $f_e \le \mu_e Mg\cos\theta$. Rolar sem deslizar exige
$$\tan\theta \le \frac{1 + \beta}{\beta}\,\mu_e .$$
Se a rampa é íngreme demais, o corpo **rola e desliza**: o atrito passa a ser cinético, dissipa energia e a relação $v = \omega R$ deixa de valer.

**Exemplo.** Um cilindro maciço ($\beta = 1/2$) numa rampa de 30°: $a = 9{,}8 \cdot 0{,}5/1{,}5 \approx 3{,}3$ m/s², e o atrito necessário é $\tfrac13 Mg\sin 30°$. Para rolar sem deslizar, precisa de $\mu_e \ge \tan 30°/3 \approx 0{,}19$. Um anel ($\beta = 1$) exigiria $\mu_e \ge 0{,}29$.

### Em superfície horizontal
Uma roda que rola com velocidade constante num plano horizontal não precisa de atrito. O atrito só aparece quando alguém tenta acelerar ou frear a roda.

**Armadilha:** desenhar o atrito sempre contra o movimento. No rolamento rampa abaixo ele aponta rampa acima, mas numa roda motriz que acelera ele aponta para a frente.

No experimento, aumente a inclinação e reduza $\mu$ até os corpos começarem a deslizar; compare o valor crítico com a fórmula para cada forma.`,
      experiments: [
        { kind: "sim", id: "rolamento", scenario: "desliza", note: "Com atrito pequeno, os corpos deixam de rolar puramente; encontre o μ mínimo para cada forma." },
        { kind: "sim", id: "rolamento", scenario: "todos", note: "Compare a aceleração de cinco corpos com g sen θ/(1 + I/MR²)." },
      ],
    },
    "11-5": {
      text: String.raw`O ioiô é um laboratório de rolamento: ele "rola" para baixo ao longo do próprio fio, que se desenrola de um eixo de raio $R_0$ pequeno. A condição de rolamento é $a = \alpha R_0$, com o fio fazendo o papel da superfície.

### Equações
Atuam o peso, para baixo, e a tração $T$, para cima, aplicada na borda do eixo:
$$Mg - T = Ma, \qquad T R_0 = I_{CM}\,\frac{a}{R_0} .$$
Daí
$$a = \frac{g}{1 + I_{CM}/(MR_0^2)} .$$
É exatamente a expressão do rolamento numa rampa (seção 11-4) com $\theta = 90°$ e o raio do eixo no lugar do raio externo. Como $R_0$ é pequeno, $I_{CM}/(MR_0^2)$ é grande e a aceleração é muito menor que $g$: o ioiô desce devagar e gira muito depressa.

### Energia
Na descida, a energia potencial vira principalmente energia cinética de **rotação**. No fundo, com o fio totalmente desenrolado, o ioiô continua girando e, se o fio estiver preso ao eixo, começa a subir enrolando-o de novo; numa subida ideal, voltaria à altura inicial. Um ioiô "que dorme" tem o fio frouxo em volta do eixo: gira no fundo, sem subir, até um puxão fazer o fio prender.

**Exemplo.** Um ioiô de 0,12 kg, com $I_{CM} = 6{,}0\times10^{-5}$ kg·m² e eixo de raio 4 mm: $I_{CM}/(MR_0^2) = 6{,}0\times10^{-5}/(0{,}12 \cdot 1{,}6\times10^{-5}) \approx 31$. Então $a \approx 9{,}8/32 \approx 0{,}31$ m/s². Descendo 0,8 m, chega a $v = \sqrt{2 \cdot 0{,}31 \cdot 0{,}8} \approx 0{,}70$ m/s e $\omega = 0{,}70/0{,}004 \approx 175$ rad/s; menos de 3% da energia está na translação.

**Armadilha:** achar que a tração no fio é igual ao peso. Ela é um pouco menor, $T = Mg - Ma$; a diferença é o que acelera o ioiô.

No experimento, solte o ioiô (0,2 kg, eixo de 4 mm), confira $a = g/51$ e a tração um pouco menor que o peso, veja a razão entre as energias de rotação e de translação e acompanhe a subida depois que o fio se desenrola; depois engrosse o eixo e veja o ioiô descer mais depressa.`,
      experiments: [
        { kind: "sim", id: "roda-maxwell", scenario: "ioio", note: "Confira a = g/(1 + I/MR₀²) e T = Mg/(1 + MR₀²/I) nos observáveis e veja o ioiô subir de volta." },
        { kind: "sim", id: "roda-maxwell", scenario: "medir-I", note: "A roda de Maxwell é um ioiô: meça a aceleração de descida e compare com g/(1 + I/MR₀²)." },
        { kind: "sim", id: "roda-maxwell", scenario: "eixo", note: "Com o eixo mais grosso, a roda desce mais depressa e gira menos." },
        { kind: "sim", id: "roda-maxwell", scenario: "energia", note: "Veja que quase toda a energia vai para a rotação, e acompanhe o retorno na subida." },
      ],
    },
    "11-6": {
      text: String.raw`Na seção 10-8, o torque foi definido para rotação em torno de um eixo fixo. A definição geral, em relação a um **ponto** O, usa o produto vetorial:
$$\vec\tau = \vec r \times \vec F ,$$
em que $\vec r$ é o vetor que vai de O até o ponto de aplicação da força.

### Módulo, direção e sentido
- Módulo: $\tau = rF\sin\phi$, com $\phi$ o menor ângulo entre $\vec r$ e $\vec F$; equivale a $r_\perp F$ ou $r F_\perp$.
- Direção: perpendicular ao plano formado por $\vec r$ e $\vec F$.
- Sentido: regra da mão direita; dedos de $\vec r$ para $\vec F$, polegar dá $\vec\tau$.
Em componentes, $\tau_x = yF_z - zF_y$, $\tau_y = zF_x - xF_z$, $\tau_z = xF_y - yF_x$.

### O torque depende do ponto
Ao contrário da força, o torque muda se mudarmos a origem O. Sempre se fala em "torque **em relação a** um ponto". Uma força cuja linha de ação passa por O não produz torque em relação a O.

**Exemplo.** Uma força $\vec F = (0, 5, 0)$ N age no ponto $\vec r = (2, 0, 1)$ m. Então $\vec\tau = \vec r \times \vec F = (0 \cdot 0 - 1 \cdot 5,\; 1 \cdot 0 - 2 \cdot 0,\; 2 \cdot 5 - 0) = (-5, 0, 10)$ N·m. O módulo é $\sqrt{125} \approx 11{,}2$ N·m e o vetor é perpendicular tanto a $\vec r$ quanto a $\vec F$ (confira com produtos escalares).

### Ligação com o eixo fixo
Quando o corpo só pode girar em torno de um eixo, o que importa é a componente de $\vec\tau$ ao longo do eixo; as outras componentes são equilibradas pelos mancais.

**Armadilha:** inverter a ordem do produto ($\vec F \times \vec r$), o que troca o sentido do torque.

No experimento, coloque $\vec r$ e $\vec F$ como os dois vetores do produto vetorial, gire a cena e confira o módulo $rF\sin\phi$ e a direção dada pela mão direita.`,
      experiments: [
        { kind: "sim", id: "vetores-3d", scenario: "vetorial", params: { Ax: 2, Ay: 0, Az: 1, Bx: 0, By: 5, Bz: 0 }, note: "Monte r = (2, 0, 1) e F = (0, 5, 0) e confira o torque (−5, 0, 10) pela mão direita." },
      ],
    },
    "11-7": {
      text: String.raw`O **momento angular** de uma partícula de massa $m$ e momento $\vec p = m\vec v$, em relação a um ponto O, é
$$\vec\ell = \vec r \times \vec p = m(\vec r \times \vec v) .$$
Unidade: kg·m²/s (ou J·s).

### Módulo
$\ell = rmv\sin\phi = r_\perp\, p = r\, p_\perp$, em que $r_\perp$ é a distância de O à linha do movimento e $p_\perp$ a componente de $\vec p$ perpendicular a $\vec r$. Direção perpendicular ao plano de $\vec r$ e $\vec v$, com sentido dado pela regra da mão direita.

### Uma partícula em linha reta tem momento angular
Se a partícula se move em linha reta com velocidade constante, $r_\perp$ não muda, e $\ell$ é **constante** e diferente de zero (desde que a reta não passe por O). Momento angular não exige rotação, só um movimento que "passa ao lado" do ponto de referência.

### Momento angular e a lei das áreas
Para uma partícula, a área varrida pelo vetor $\vec r$ por unidade de tempo é $\dfrac{dA}{dt} = \dfrac{\ell}{2m}$. Um planeta sujeito apenas à atração do Sol (força central, sem torque em relação ao Sol) conserva $\ell$ e, portanto, varre áreas iguais em tempos iguais: é a segunda lei de Kepler.

**Exemplo.** Um satélite de 500 kg a 7,5 km/s em órbita circular de raio 7000 km: $\ell = 500 \cdot 7{,}0\times10^{6} \cdot 7{,}5\times10^{3} \approx 2{,}6\times10^{13}$ kg·m²/s. Num ponto da órbita elíptica em que estivesse a 6800 km, com velocidade perpendicular ao raio, a velocidade teria de ser $7{,}5 \cdot 7000/6800 \approx 7{,}7$ km/s para conservar $\ell$.

**Armadilha:** esquecer que o momento angular, como o torque, depende do ponto escolhido.

No experimento, acompanhe o planeta na órbita elíptica: as áreas varridas em tempos iguais são iguais, e o planeta anda mais depressa perto da estrela, conservando $rv_\perp$.`,
      experiments: [
        { kind: "sim", id: "orbitas-kepler", scenario: "elipse", note: "Veja as áreas iguais em tempos iguais e o produto r·v⊥ constante ao longo da elipse." },
        { kind: "sim", id: "vetores-3d", scenario: "vetorial", note: "Trate A como r e B como p: o momento angular é perpendicular ao plano do movimento." },
      ],
    },
    "11-8": {
      text: String.raw`Para uma partícula, derivar $\vec\ell = m\,\vec r \times \vec v$ dá $m(\vec v \times \vec v + \vec r \times \vec a)$. O primeiro termo é zero (produto vetorial de um vetor por si mesmo) e $m\vec a = \vec F_{\text{res}}$. Então
$$\vec\tau_{\text{res}} = \frac{d\vec\ell}{dt} .$$
É a **segunda lei de Newton na forma angular**: o torque resultante sobre uma partícula, em relação a um ponto, é igual à taxa de variação do seu momento angular em relação ao **mesmo** ponto. É o análogo exato de $\vec F = d\vec p/dt$.

### Consequências
- Se o torque resultante é nulo, $\vec\ell$ é constante (seção 11-11).
- O torque muda $\vec\ell$ na **direção do torque**. Se o torque é paralelo a $\vec\ell$, muda só o módulo (a rotação acelera ou freia). Se é perpendicular, muda só a direção, como na precessão do giroscópio (seção 11-12).

**Exemplo.** Um peso de 0,4 kg cai, a partir do repouso, a uma distância horizontal de 0,5 m de um ponto O no mesmo nível do ponto de partida. Em relação a O, o peso exerce torque $0{,}5 \cdot 0{,}4 \cdot 9{,}8 = 1{,}96$ N·m, constante. Depois de 2 s, a velocidade é 19,6 m/s e $\ell = 0{,}5 \cdot 0{,}4 \cdot 19{,}6 \approx 3{,}9$ kg·m²/s, exatamente torque × tempo, como prevê a lei.

### Força × torque
Força resultante nula não implica torque nulo (um binário de forças gira um volante sem deslocar o CM), e torque nulo em relação a um ponto não implica força nula (uma força central, como a gravidade do Sol sobre um planeta).

**Armadilha:** calcular o torque em relação a um ponto e o momento angular em relação a outro.

No experimento, observe o giroscópio rápido: o torque do peso é horizontal e perpendicular a $\vec L$, então o vetor $\vec L$ gira em vez de crescer; o eixo não cai.`,
      experiments: [
        { kind: "sim", id: "giroscopio", scenario: "rapido", note: "Mostre os vetores: o torque do peso é perpendicular a L e muda só a sua direção." },
        { kind: "sim", id: "momento-angular", scenario: "inverter", note: "Ao inverter a roda, o torque que a pessoa aplica muda L da roda e a cadeira reage." },
      ],
    },
    "11-9": {
      text: String.raw`O momento angular de um sistema de partículas é a soma vetorial dos momentos angulares individuais, todos em relação ao mesmo ponto:
$$\vec L = \sum_i \vec\ell_i .$$
Derivando e usando a seção 11-8 para cada partícula, aparecem torques internos e externos. As forças internas vêm em pares de ação e reação, iguais, opostas e (para as forças usuais) ao longo da reta que une as partículas; seus torques se cancelam aos pares. Sobra
$$\vec\tau_{\text{res,ext}} = \frac{d\vec L}{dt} .$$
Só torques **externos** podem mudar o momento angular total de um sistema.

### Trocas internas de momento angular
Forças internas podem transferir momento angular de uma parte do sistema para outra sem mudar o total. Uma pessoa sentada numa cadeira giratória, segurando uma roda de bicicleta que gira com o eixo vertical, inverte a roda: o momento angular da roda passa de $+L_r$ para $-L_r$. Como nenhum torque externo vertical age (o eixo da cadeira é livre), a cadeira com a pessoa passa a girar com $+2L_r$, no sentido em que a roda girava antes.

**Exemplo.** Roda com $I_r = 0{,}15$ kg·m² a 25 rad/s ($L_r = 3{,}75$ kg·m²/s) e conjunto pessoa + cadeira com $I_c = 4$ kg·m². Depois de inverter a roda, a cadeira gira com $\omega_c = 2 \cdot 3{,}75/4 \approx 1{,}9$ rad/s. Se a roda for apenas deitada na horizontal, a componente vertical vai a zero e a cadeira fica com $\omega_c \approx 0{,}94$ rad/s.

### Vale também em relação ao CM
A mesma equação vale tomando o centro de massa como origem, mesmo que ele esteja acelerado. É o que permite analisar a rotação de um saltador em pleno voo.

**Armadilha:** achar que a pessoa "cria" momento angular com os braços. Ela só redistribui o que já existe no sistema.

No experimento, inverta a roda e depois deixe-a na horizontal: confira que o momento angular vertical total (roda + cadeira) não muda.`,
      experiments: [
        { kind: "sim", id: "momento-angular", scenario: "inverter", note: "Inverta a roda e confira que a componente vertical de L total (roda + cadeira) não muda." },
        { kind: "sim", id: "momento-angular", scenario: "horizontal", note: "Com a roda na horizontal, metade da troca: a cadeira gira com Lr/Ic." },
      ],
    },
    "11-10": {
      text: String.raw`Para um corpo rígido que gira com velocidade angular $\omega$ em torno de um eixo fixo, cada elemento de massa $m_i$, a uma distância $r_{\perp i}$ do eixo, move-se num círculo com $v_i = \omega r_{\perp i}$. A componente do seu momento angular ao longo do eixo é $m_i r_{\perp i}^2\,\omega$. Somando sobre o corpo:
$$L = I\omega ,$$
com $I$ o momento de inércia em relação ao eixo de rotação (seção 10-7).

### O paralelo com a translação
Assim como $p = mv$, temos $L = I\omega$; e a forma angular da segunda lei, $\tau = dL/dt$, recupera $\tau = I\alpha$ quando $I$ é constante. Mas $\tau = dL/dt$ é mais geral: vale também quando o corpo muda sua distribuição de massa e, com ela, o seu $I$.

### Corpos simétricos
Se o corpo é simétrico em relação ao eixo (disco, roda, cilindro), $\vec L$ é paralelo a $\vec\omega$ e vale a forma vetorial $\vec L = I\vec\omega$. Para corpos sem essa simetria (uma roda desbalanceada), $\vec L$ pode ter componentes fora do eixo, e os mancais precisam exercer torques para manter o eixo fixo: é a vibração de um pneu mal balanceado.

**Exemplo.** Um disco de esmeril de 2,0 kg e 0,10 m de raio a 3000 rpm (314 rad/s): $I = \tfrac12 \cdot 2{,}0 \cdot 0{,}01 = 0{,}010$ kg·m² e $L \approx 3{,}1$ kg·m²/s. Para pará-lo em 5 s, é preciso um torque médio de $3{,}1/5 \approx 0{,}63$ N·m.

### Energia e momento angular
A energia cinética de rotação pode ser escrita como $K = L^2/(2I)$. Se $L$ se conserva e $I$ diminui, $K$ aumenta (seção 11-11).

**Armadilha:** confundir momento angular com velocidade angular. Dois corpos com o mesmo $\omega$ podem ter $L$ muito diferentes.

No experimento, ajuste o momento de inércia do corpo da patinadora e a velocidade angular inicial e compare o valor de $L = I\omega$ mostrado com o seu cálculo.`,
      experiments: [
        { kind: "sim", id: "momento-angular", scenario: "fechar", note: "Calcule L = Iω no início e compare com o valor mostrado pelo vetor em 3D." },
        { kind: "sim", id: "rotacao-torque", scenario: "formas", note: "Mesmo torque por um tempo igual: anel e disco recebem o mesmo L, mas giram com ω diferentes." },
      ],
    },
    "11-11": {
      text: String.raw`Se o torque externo resultante sobre um sistema é nulo, $d\vec L/dt = 0$ e
$$\vec L = \text{constante}, \qquad I_i\omega_i = I_f\omega_f \;\text{(eixo fixo)} .$$
É a **lei de conservação do momento angular**, uma das três grandes leis de conservação da mecânica, ao lado das do momento linear e da energia. Ela vale por componente: se só o torque em torno de um eixo é nulo, conserva-se a componente de $\vec L$ ao longo dele.

### A patinadora
Ao recolher os braços, a patinadora reduz seu momento de inércia; como $L = I\omega$ se mantém, $\omega$ aumenta. A energia cinética $L^2/(2I)$ também aumenta: essa energia vem do **trabalho dos músculos**, que puxam os braços para dentro contra a tendência deles de seguir em linha reta. Abrir os braços faz o caminho inverso.

### Outros exemplos
- Mergulhador ou ginasta: encolhido no salto, gira rápido; esticado na entrada na água, gira devagar.
- Estrela que colapsa até virar estrela de nêutrons: o raio cai de centenas de milhares de quilômetros para cerca de 10 km e a rotação passa a frações de segundo.
- Gato que cai de costas: gira o corpo no ar sem momento angular total, torcendo partes em sentidos opostos.

**Exemplo.** Uma patinadora com $I = 3{,}5$ kg·m² (braços abertos) gira a 1,5 voltas/s. Recolhendo os braços, $I$ cai para 1,2 kg·m²: $\omega_f = 1{,}5 \cdot 3{,}5/1{,}2 \approx 4{,}4$ voltas/s. A energia cinética é multiplicada pelo mesmo fator, $3{,}5/1{,}2 \approx 2{,}9$.

**Armadilha:** concluir que, se $L$ se conserva, a energia cinética de rotação também se conserva. Em geral não: forças internas podem realizar trabalho.

No experimento, faça a patinadora fechar e depois abrir os braços, anote $I$ e $\omega$ antes e depois e confira $I_i\omega_i = I_f\omega_f$ e a variação da energia cinética.`,
      experiments: [
        { kind: "sim", id: "momento-angular", scenario: "fechar", note: "Feche os braços e confira Iω constante e o aumento da energia cinética." },
        { kind: "sim", id: "momento-angular", scenario: "abrir", note: "Abra os braços: ω diminui e a energia cinética cai." },
        { kind: "sim", id: "orbitas-kepler", scenario: "elipse", note: "Força central, torque nulo: o planeta conserva o momento angular em toda a órbita." },
      ],
    },
    "11-12": {
      text: String.raw`Um pião ou giroscópio girando rapidamente, apoiado numa ponta com o eixo inclinado, não cai: seu eixo gira lentamente em torno da vertical. Esse movimento é a **precessão**.

### Por que não cai
O giroscópio tem momento angular de rotação própria $\vec L = I\vec\omega$, ao longo do eixo. O peso, aplicado no CM a uma distância $r$ do ponto de apoio, produz um torque $\vec\tau = \vec r \times M\vec g$, **horizontal** e **perpendicular** a $\vec L$. Pela seção 11-8, em $dt$ o momento angular ganha $d\vec L = \vec\tau\,dt$, também horizontal e perpendicular: o vetor $\vec L$ muda de direção, não de módulo. A ponta de $\vec L$ descreve um círculo horizontal.

### Taxa de precessão
Para um eixo horizontal, o ângulo girado em $dt$ é $d\phi = dL/L = Mgr\,dt/L$, e a velocidade angular de precessão é
$$\Omega = \frac{Mgr}{I\omega} .$$
Ela não depende do ângulo de inclinação (para eixo inclinado, o seno se cancela) e é tanto menor quanto mais rápido o giroscópio gira. Essa fórmula é uma aproximação, válida quando a rotação própria é muito mais rápida que a precessão.

**Exemplo.** Um giroscópio de brinquedo: disco de 0,15 kg, raio 3 cm, girando a 300 rad/s, com CM a 4 cm do apoio. $I = \tfrac12 \cdot 0{,}15 \cdot 0{,}03^2 \approx 6{,}8\times10^{-5}$ kg·m² e $L \approx 0{,}020$ kg·m²/s. Então $\Omega = 0{,}15 \cdot 9{,}8 \cdot 0{,}04/0{,}020 \approx 2{,}9$ rad/s, cerca de uma volta a cada 2 s. Com o disco girando à metade, a precessão fica duas vezes mais rápida.

### Nutação
Se o giroscópio é solto em repouso (sem a precessão já iniciada), o eixo primeiro cai um pouco e depois oscila para cima e para baixo enquanto precessiona: é a **nutação**. Quanto mais rápida a rotação, menor e mais rápida a nutação.

**Armadilha:** esperar que o torque do peso derrube o giroscópio. O torque muda $\vec L$ na direção **do torque**, horizontalmente.

No experimento, mostre os vetores, compare a precessão com $\Omega = Mgr/(I\omega)$ e reduza $\omega_3$ para ver a aproximação falhar; depois solte o pião do repouso e observe a nutação.`,
      experiments: [
        { kind: "sim", id: "giroscopio", scenario: "rapido", note: "Compare a precessão medida com Ω = Mgl/(I₃ω₃) e veja o torque perpendicular a L." },
        { kind: "sim", id: "giroscopio", scenario: "nutacao", note: "Solto do repouso, o eixo cai um pouco e oscila: a nutação." },
        { kind: "sim", id: "giroscopio", scenario: "lento", note: "Com rotação lenta, a aproximação de precessão uniforme deixa de valer." },
      ],
    },
  },
};
