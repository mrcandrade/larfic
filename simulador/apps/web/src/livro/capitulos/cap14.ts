import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 14,
  intro: String.raw`Água, ar, óleo, sangue e o magma sob a crosta têm algo em comum: não guardam forma própria e escoam. Este capítulo trata da mecânica desses **fluidos**. Na primeira metade o fluido está em repouso e as ferramentas são a **massa específica** e a **pressão**: por que a pressão cresce com a profundidade, como se mede, por que uma prensa hidráulica multiplica forças e por que um navio de aço flutua. Na segunda metade o fluido se move, e duas leis de conservação aplicadas a um modelo idealizado, a **equação da continuidade** (massa) e a **equação de Bernoulli** (energia), explicam medidores de vazão, jatos de tanques e parte da sustentação de uma asa. São as bases da hidráulica, da aerodinâmica e da engenharia biomédica.`,
  sections: {
    "14-2": {
      text: String.raw`Um sólido resiste a uma força que tenta deslizar uma camada sobre outra (uma **tensão de cisalhamento**): ele se deforma um pouco e para. Um **fluido** não consegue sustentar cisalhamento em repouso: sob qualquer tensão tangencial, por menor que seja, ele continua se deformando, isto é, **escoa**. Por isso um fluido toma a forma do recipiente.

### Líquidos e gases
- **Líquidos** têm volume praticamente fixo: comprimir água em 1% exige cerca de 200 atm. Formam superfície livre.
- **Gases** ocupam todo o volume disponível e são facilmente compressíveis.
Os dois são fluidos; muitas leis deste capítulo valem para ambos, desde que a massa específica possa ser tratada como constante na região estudada.

### Descrição contínua
Um copo d'água tem cerca de $10^{25}$ moléculas. Em vez de seguir cada uma, descrevemos o fluido por **campos** contínuos: massa específica $\rho$, pressão $p$ e velocidade $\vec v$ em cada ponto, como médias sobre um elemento pequeno no tamanho macroscópico, mas que ainda contém muitas moléculas.

### Viscosidade
A rapidez com que o fluido escoa sob uma dada tensão é medida pela **viscosidade**. O mel e a glicerina são centenas de vezes mais viscosos que a água; o ar, cerca de 50 vezes menos. Viscosidade não impede o escoamento, só o torna mais lento.

**Exemplo.** Uma esfera de aço de 2 mm cai em glicerina a poucos centímetros por segundo, e na água a mais de 1 m/s. Os dois são fluidos; o que muda é a resistência interna ao escoamento.

**Armadilha:** achar que piche, vidro "líquido" ou areia se encaixam claramente numa categoria. Materiais reais vão de sólidos a fluidos em escalas de tempo diferentes; a areia escoa como um fluido, mas sustenta um monte inclinado (tem atrito interno), o que um fluido não faz.

No experimento, solte esferas na glicerina e meça a velocidade terminal; depois, na dinâmica molecular, aqueça o argônio e veja o arranjo passar de sólido a líquido, quando as partículas começam a deslizar umas sobre as outras.`,
      experiments: [
        { kind: "sim", id: "viscosidade-stokes", scenario: "glicerina", note: "Cronometre a queda de esferas na glicerina e veja como a viscosidade freia o escoamento em torno delas." },
        { kind: "sim", id: "estados-materia", scenario: "fusao", note: "Aqueça o argônio e observe o momento em que as camadas de átomos passam a deslizar umas sobre as outras." },
        { kind: "pratica", id: "exp2-stokes", note: "Roteiro de bancada para medir a viscosidade de um líquido pela lei de Stokes." },
      ],
    },
    "14-3": {
      text: String.raw`### Massa específica
A **massa específica** (ou densidade absoluta) de um fluido num ponto é a massa por unidade de volume de um pequeno elemento em torno do ponto:
$$\rho = \frac{\Delta m}{\Delta V}, \qquad \rho = \frac{m}{V}\ \text{(fluido uniforme)} .$$
Unidade SI: kg/m³. Valores típicos: ar ao nível do mar, 1,2 kg/m³; água, 1000 kg/m³; óleo de cozinha, cerca de 920 kg/m³; mercúrio, 13 600 kg/m³. A **densidade relativa** é $\rho/\rho_{\text{água}}$, um número puro.

### Pressão
Um fluido em repouso empurra qualquer superfície em contato com ele com uma força **perpendicular** à superfície. A **pressão** é essa força por unidade de área:
$$p = \frac{\Delta F}{\Delta A}, \qquad p = \frac{F}{A}\ \text{(força uniforme sobre área plana)} .$$
A pressão é um **escalar**: num ponto do fluido ela tem o mesmo valor qualquer que seja a orientação da superfície imaginária que se coloque ali; a direção está na força, não na pressão.

### Unidades
- pascal: $1\ \text{Pa} = 1\ \text{N/m}^2$;
- atmosfera: $1\ \text{atm} = 1{,}013\times10^5\ \text{Pa} = 760\ \text{mmHg}$ (torr);
- bar: $10^5$ Pa; libra por polegada quadrada: 1 psi ≈ 6,9 kPa.

**Exemplo.** O ar de uma sala de 5 m × 4 m × 3 m tem massa $1{,}2 \cdot 60 = 72$ kg. A atmosfera empurra o tampo de uma mesa de 1,0 m × 0,8 m com $1{,}0\times10^5 \cdot 0{,}8 \approx 8\times10^4$ N, o peso de uns 8 carros; a mesa não quebra porque o ar empurra por baixo com força quase igual.

**Armadilha:** tratar pressão como vetor ou dizer que ela "aponta para baixo". Num ponto do fluido ela age igualmente em todas as direções; a força sobre uma parede é que é perpendicular à parede.

No experimento, pese corpos no ar e mergulhados para obter a massa específica; no tubo em U, compare as alturas de dois líquidos imiscíveis para medir a densidade de um em relação ao outro.`,
      experiments: [
        { kind: "sim", id: "vasos-comunicantes", scenario: "tubo-u", note: "Despeje um segundo líquido no tubo em U e obtenha sua massa específica pela razão entre as alturas." },
        { kind: "sim", id: "instrumentos-medida", scenario: "paquimetro", note: "Meça as dimensões e a massa de um cilindro e calcule sua massa específica com a incerteza." },
        { kind: "pratica", id: "exp1-medidas", note: "Determine a densidade de sólidos com paquímetro, micrômetro e balança." },
      ],
    },
    "14-4": {
      text: String.raw`Considere, dentro de um líquido em repouso, um cilindro imaginário de base $A$ e altura $h$, com o topo à pressão $p_1$ e a base à pressão $p_2$. Ele está em equilíbrio sob três forças verticais: $p_1A$ para baixo, $p_2A$ para cima e o peso $\rho A h g$. Então
$$p_2 = p_1 + \rho g h .$$
Medindo a profundidade $h$ a partir da superfície livre, onde a pressão é a atmosférica $p_0$:
$$p = p_0 + \rho g h .$$

### Consequências
- A pressão depende **só da profundidade**, não da forma do recipiente nem da quantidade de líquido. Pontos no mesmo nível de um mesmo líquido em repouso e conectado têm a mesma pressão; daí os vasos comunicantes e o nível de mangueira dos pedreiros.
- A diferença $p - p_0 = \rho g h$ é a **pressão manométrica**; $p$ é a **pressão absoluta**.
- Com várias camadas de líquidos imiscíveis, a pressão cresce com inclinação $\rho_i g$ diferente em cada camada.
- Num gás, $\rho$ é pequena e $p$ quase não varia em alguns metros; em quilômetros de atmosfera, $\rho$ cai com a altitude e a relação deixa de ser linear.

**Exemplo.** Um mergulhador a 15 m em água do mar ($\rho = 1030$ kg/m³) sente $\rho g h = 1030 \cdot 9{,}8 \cdot 15 \approx 1{,}5\times10^5$ Pa de pressão manométrica: a pressão absoluta é cerca de 2,5 atm. Os pulmões cheios na superfície, se ele subir prendendo a respiração desde ali, tendem a expandir 2,5 vezes: por isso a regra de expirar na subida.

**Armadilha:** achar que a represa precisa ser mais forte porque o lago atrás dela é muito grande. A pressão na parede depende só da profundidade da água junto a ela.

No experimento, empilhe óleo, água e mercúrio e arraste a sonda: o gráfico $p(y)$ é formado por retas com inclinações diferentes. Depois troque a gravidade pela de Marte e compare; no paradoxo hidrostático, vasos de formas diferentes com a mesma altura de água fazem a mesma força no fundo.`,
      experiments: [
        { kind: "sim", id: "hidrostatica", scenario: "camadas", note: "Arraste a sonda pelas três camadas e meça a inclinação de p(y) em cada líquido." },
        { kind: "sim", id: "hidrostatica", scenario: "marte", note: "Repita a medida com a gravidade de Marte e veja a pressão crescer mais devagar com a profundidade." },
        { kind: "sim", id: "vasos-comunicantes", scenario: "paradoxo", note: "Compare a força no fundo de vasos de formas diferentes cheios até a mesma altura." },
        { kind: "concepcao", id: "pressao-quantidade-agua", note: "Confronte a ideia de que mais água no recipiente significa mais pressão no fundo." },
      ],
    },
    "14-5": {
      text: String.raw`### Barômetro de mercúrio
Um tubo longo cheio de mercúrio é emborcado numa cuba de mercúrio. A coluna desce até uma altura $h$, deixando no topo um espaço quase vazio (pressão praticamente nula, só o vapor de mercúrio). No nível da cuba, a pressão do ar equilibra o peso da coluna:
$$p_0 = \rho g h .$$
Ao nível do mar, $h \approx 760$ mm, o que dá a unidade mmHg. O resultado não depende da área do tubo. Com água, a coluna teria cerca de 10,3 m; esse é também o limite de uma **bomba de sucção**: ela só retira o ar de cima da água, e a atmosfera não consegue empurrar a água mais alto que isso.

### Manômetro de tubo aberto
Um tubo em U com líquido de massa específica $\rho$ tem um ramo ligado ao recipiente e o outro aberto ao ar. A diferença de nível $h$ dá a **pressão manométrica** do gás:
$$p_m = p - p_0 = \rho g h .$$
Se o gás estiver abaixo da pressão atmosférica, o líquido sobe do lado do gás e $p_m$ é negativa. Calibradores de pneu e esfigmomanômetros medem pressão manométrica.

**Exemplo.** Um manômetro com água mostra desnível de 12 cm, com o líquido mais baixo no ramo do gás: $p_m = 1000 \cdot 9{,}8 \cdot 0{,}12 \approx 1{,}2$ kPa. Com mercúrio, o mesmo gás daria só 0,88 cm de desnível; escolhe-se o líquido conforme a faixa de pressão.

**Armadilha:** confundir pressão absoluta e manométrica. Um pneu "a 30 psi" está a cerca de 30 + 14,7 ≈ 45 psi absolutos; um pneu murcho tem pressão manométrica zero, não pressão absoluta zero.

No experimento, ajuste a pressão do gás e leia o desnível no manômetro em U; depois, na bomba de sucção, aumente a altura da saída e encontre a altura máxima que a água alcança. Por fim, suba com o balão-sonda e acompanhe a pressão atmosférica cair.`,
      experiments: [
        { kind: "sim", id: "hidrostatica", scenario: "manometro", note: "Varie a pressão do gás e confira que o desnível no tubo em U vale p_m/(ρg)." },
        { kind: "sim", id: "vasos-comunicantes", scenario: "succao", note: "Aumente a altura da bomba de sucção até a água parar de subir: o limite de cerca de 10 m." },
        { kind: "sim", id: "atmosfera-umidade", scenario: "balao", note: "Suba com o balão-sonda e veja a pressão atmosférica diminuir com a altitude." },
      ],
    },
    "14-6": {
      text: String.raw`Como a pressão num líquido em repouso é $p = p_{\text{ext}} + \rho g h$, qualquer variação $\Delta p_{\text{ext}}$ na pressão aplicada a um ponto aparece igualmente em todos os pontos do líquido. Esse é o **princípio de Pascal**: uma variação de pressão aplicada a um fluido incompressível em repouso, num recipiente fechado, é transmitida integralmente a todas as partes do fluido e às paredes do recipiente.

### Prensa hidráulica
Dois pistões, de áreas $A_e$ (entrada) e $A_s$ (saída), comunicam-se por um líquido. Empurrando o pistão menor com $F_e$, o aumento de pressão $F_e/A_e$ chega ao pistão maior:
$$F_s = F_e \frac{A_s}{A_e} .$$
A força é multiplicada, mas não há ganho de energia: como o volume de líquido deslocado é o mesmo, $A_e d_e = A_s d_s$, e o pistão grande sobe muito menos. O trabalho de entrada $F_e d_e$ é igual ao de saída $F_s d_s$ (sem perdas).

**Exemplo.** Num elevador de oficina, o pistão de entrada tem 2 cm de diâmetro e o de saída, 24 cm. A razão das áreas é $(24/2)^2 = 144$. Para erguer um carro de 1300 kg (cerca de 12 700 N), basta $12\,700/144 \approx 88$ N na entrada; mas para subir o carro 10 cm, o pistão pequeno deve percorrer 14,4 m, feito com muitas bombadas e uma válvula.

### Outros exemplos
Freios hidráulicos, macacos, direção hidráulica e o barril de Pascal: um tubo fino e alto cheio de água sobre um barril fechado aumenta a pressão em todo o barril em $\rho g h$, e alguns litros de água bastam para rachá-lo.

**Armadilha:** concluir que a prensa "cria energia". Ela troca força por deslocamento, como uma alavanca (seção 12-5).

No experimento, aplique uma força no pistão pequeno, mude os diâmetros e veja que carga o pistão grande ergue e quanto cada um se desloca; depois, encha o tubo do barril até a tampa ceder.`,
      experiments: [
        { kind: "sim", id: "hidrostatica", scenario: "prensa", note: "Mude os diâmetros dos pistões e compare a razão das forças com a razão dos deslocamentos." },
        { kind: "sim", id: "vasos-comunicantes", scenario: "barril", note: "Encha o tubo fino sobre o barril e encontre a altura de água que rompe a tampa." },
        { kind: "sim", id: "vasos-comunicantes", scenario: "ludiao", note: "Aperte a garrafa e veja o aumento de pressão chegar ao ludião e fazê-lo afundar." },
      ],
    },
    "14-7": {
      text: String.raw`Um corpo mergulhado num fluido recebe forças de pressão em toda a superfície. Como a pressão cresce com a profundidade, a parte de baixo é empurrada com mais força que a de cima, e a resultante aponta para cima: é o **empuxo**. Para calculá-lo, imagine retirar o corpo e preencher o espaço com o próprio fluido: essa "porção de fluido" ficaria em equilíbrio, então as forças de pressão em volta valem exatamente o peso dela. Daí o **princípio de Arquimedes**:
$$E = m_f\, g = \rho_f\, V_{\text{sub}}\, g ,$$
em que $V_{\text{sub}}$ é o volume submerso e $\rho_f$ a massa específica do **fluido**.

### Flutuação
Um corpo flutua em equilíbrio quando o empuxo iguala o peso: $\rho_f V_{\text{sub}} = \rho_c V$. A fração submersa é
$$\frac{V_{\text{sub}}}{V} = \frac{\rho_c}{\rho_f} .$$
Um bloco de madeira com $\rho = 600$ kg/m³ flutua na água com 60% submerso. Um navio de aço flutua porque o casco envolve muito ar: o que conta é a massa específica **média**.

### Peso aparente
Pendurado num dinamômetro e mergulhado, o corpo marca o **peso aparente**: $P_{\text{ap}} = P - E$. Medindo $P$ e $P_{\text{ap}}$ obtém-se a massa específica: $\rho_c = \rho_f\, P/(P - P_{\text{ap}})$.

**Exemplo.** Uma peça metálica pesa 7,80 N no ar e 6,80 N na água. O empuxo é 1,00 N, logo o volume é $1{,}00/(1000 \cdot 9{,}8) \approx 1{,}02\times10^{-4}$ m³ e $\rho_c = 1000 \cdot 7{,}80/1{,}00 = 7800$ kg/m³: aço.

### Estabilidade
O empuxo age no centro do volume submerso (centro de carena). Num navio, se o casco se inclina e esse ponto se desloca de modo a criar um torque que endireita, o navio é estável; carga alta demais inverte o torque e o navio tomba.

**Armadilha:** dizer que coisas pesadas afundam. Um transatlântico flutua e um grão de areia afunda: decide a comparação entre as massas específicas, não o peso.

No experimento, desça o bloco no dinamômetro e veja o peso aparente cair enquanto ele submerge e ficar constante depois; solte blocos de materiais diferentes e confira a fração submersa; incline o casco e veja o torque de endireitamento.`,
      experiments: [
        { kind: "sim", id: "empuxo", scenario: "dinamometro", note: "Desça o bloco e acompanhe o peso aparente diminuir só enquanto o volume submerso aumenta." },
        { kind: "sim", id: "empuxo", scenario: "flutua", note: "Troque o material do bloco e compare a fração submersa com ρ_corpo/ρ_líquido." },
        { kind: "sim", id: "empuxo", scenario: "tomba", note: "Suba o centro de gravidade da carga e veja o torque do empuxo deixar de endireitar o navio." },
        { kind: "concepcao", id: "pesado-afunda", note: "Confronte a ideia de que o que é pesado afunda." },
        { kind: "pratica", id: "exp2-empuxo", note: "Roteiro de bancada para medir densidade pelo empuxo." },
      ],
    },
    "14-8": {
      text: String.raw`O escoamento de fluidos reais pode ser extremamente complicado: redemoinhos, turbulência, viscosidade, compressão. Para obter leis simples, adotamos um **fluido ideal**, com quatro hipóteses:
- **Escoamento estacionário (laminar):** a velocidade em cada ponto fixo não muda com o tempo. Um rio calmo é aproximadamente estacionário; uma corredeira, não.
- **Escoamento incompressível:** $\rho$ é constante. Vale bem para líquidos e para gases a velocidades bem abaixo da do som.
- **Escoamento não viscoso:** não há atrito interno; um corpo pode se mover no fluido sem arrasto viscoso.
- **Escoamento irrotacional:** um pequeno elemento do fluido não gira em torno do próprio centro (embora possa percorrer uma curva).

### Linhas de corrente
No escoamento estacionário, cada elemento do fluido segue uma trajetória fixa, a **linha de corrente**; a velocidade é tangente a ela em cada ponto. Duas linhas de corrente nunca se cruzam (se cruzassem, o elemento teria duas velocidades no mesmo ponto). Um feixe de linhas de corrente forma um **tubo de escoamento**, pelo qual nenhum fluido entra ou sai pelas paredes. Linhas próximas indicam velocidade alta; afastadas, velocidade baixa. Na prática, traçadores (fumaça, corante, partículas) tornam as linhas visíveis.

**Exemplo.** No experimento clássico de Reynolds, um filete de corante numa água que escoa devagar por um tubo permanece fino e reto (laminar). Aumentando a vazão, a partir de um número de Reynolds de cerca de 2000 o filete ondula e se mistura: a hipótese de escoamento estacionário deixa de valer.

**Armadilha:** aplicar os resultados do fluido ideal (seções 14-9 e 14-10) a escoamentos turbulentos ou muito viscosos, como mel num canudo fino, em que a perda por atrito domina.

No experimento, aumente a velocidade do escoamento no tubo e observe o filete de corante passar de laminar a turbulento; depois veja as linhas de corrente em torno de um aerofólio, apertadas sobre o dorso, onde o ar é mais rápido.`,
      experiments: [
        { kind: "sim", id: "escoamento-viscoso", scenario: "reynolds", note: "Aumente a velocidade e encontre o ponto em que o filete de corante deixa de ser laminar." },
        { kind: "sim", id: "aerofolio", scenario: "basico", note: "Observe as linhas de corrente em torno da asa e onde elas se aproximam." },
        { kind: "sim", id: "escoamento-viscoso", scenario: "karman", note: "Veja a esteira de vórtices atrás de um cilindro: um escoamento que não é estacionário nem irrotacional." },
      ],
    },
    "14-9": {
      text: String.raw`Num tubo de escoamento de fluido incompressível em regime estacionário, o fluido não se acumula em lugar nenhum: o volume que entra por uma seção num intervalo $\Delta t$ é igual ao que sai por qualquer outra. Por uma seção de área $A$ onde a velocidade é $v$, passa em $\Delta t$ o volume $A\,v\,\Delta t$. Igualando para duas seções:
$$A_1 v_1 = A_2 v_2 .$$
Essa é a **equação da continuidade**. A grandeza conservada é a **vazão volumétrica**
$$R_V = A v \quad (\text{m}^3/\text{s}),$$
e a **vazão mássica** é $R_m = \rho R_V$ (kg/s). Onde o tubo se estreita, o fluido acelera; onde se alarga, desacelera. A equação traduz a conservação da massa.

**Exemplo 1.** Uma mangueira de 2,0 cm de diâmetro despeja água a 1,5 m/s. A vazão é $\pi (0{,}010)^2 \cdot 1{,}5 \approx 4{,}7\times10^{-4}$ m³/s, ou 0,47 L/s: um balde de 10 L enche em 21 s. Com um bico de 0,5 cm de diâmetro, a área cai 16 vezes e a velocidade sobe para 24 m/s, com a mesma vazão.

**Exemplo 2.** O filete d'água que cai de uma torneira afina com a queda: a velocidade aumenta pela gravidade e, com vazão constante, a área da seção diminui.

### Em vasos ramificados
Se um tubo se divide em vários, a soma das vazões nos ramos é a vazão do tubo principal. No sistema circulatório, o sangue sai da aorta a cerca de 30 cm/s e passa a menos de 1 mm/s nos capilares, porque a área total de bilhões de capilares é centenas de vezes maior que a da aorta.

**Armadilha:** pensar que, num estreitamento, a vazão diminui. A vazão é a mesma; é a velocidade que aumenta. (Num fluido real e viscoso a vazão total do circuito depende do atrito, seção 14-8, mas ao longo de um mesmo tubo ela continua igual em todas as seções.)

No experimento, mude o diâmetro da garganta do Venturi e veja os traçadores acelerarem no estreitamento, conferindo $v_2 = v_1 (D_1/D_2)^2$.`,
      experiments: [
        { kind: "sim", id: "bernoulli", scenario: "venturi", note: "Estreite a garganta e confira que a velocidade cresce com o inverso da área." },
        { kind: "sim", id: "escoamento-viscoso", scenario: "poiseuille", note: "Num tubo real, compare a vazão medida com o produto da área pela velocidade média." },
      ],
    },
    "14-10": {
      text: String.raw`Aplique o teorema do trabalho e energia a uma porção de fluido ideal que avança por um tubo de escoamento, de uma seção 1 a uma seção 2. Sobre ela agem a gravidade e as forças de pressão do fluido vizinho; por trás, o fluido empurra a favor (trabalho $p_1\Delta V$), e à frente, contra ($-p_2\Delta V$). Dividindo pela variação de volume, obtém-se a **equação de Bernoulli**:
$$p_1 + \tfrac12 \rho v_1^2 + \rho g y_1 = p_2 + \tfrac12 \rho v_2^2 + \rho g y_2 ,$$
ou seja, $p + \tfrac12\rho v^2 + \rho g y$ é constante ao longo de uma linha de corrente. Os termos são energias por unidade de volume: pressão, cinética e potencial. Com $v = 0$, a equação volta à lei hidrostática da seção 14-4.

### Consequência principal
No mesmo nível, **onde a velocidade é maior, a pressão é menor**. Combinada com a continuidade, ela explica:
- **Medidor Venturi:** no estreitamento a velocidade aumenta e a pressão cai; a diferença de pressão, lida num manômetro, dá a vazão.
- **Tanque com orifício (Torricelli):** a pressão é atmosférica na superfície e no jato, e a superfície desce devagar; então $v = \sqrt{2gh}$, a velocidade de queda livre da altura $h$.
- **Sustentação:** o ar mais rápido sobre o dorso de uma asa tem pressão menor que o de baixo. (A razão de o ar ser mais rápido em cima envolve a circulação em torno do perfil, não a ideia de que as duas porções de ar "precisam chegar juntas" ao bordo de fuga.)

**Exemplo.** Um tanque aberto tem água 1,8 m acima de um orifício lateral. A velocidade de saída é $\sqrt{2 \cdot 9{,}8 \cdot 1{,}8} \approx 5{,}9$ m/s. Num Venturi com água em que $v_1 = 2$ m/s e a garganta tem metade do diâmetro, $v_2 = 8$ m/s e $p_1 - p_2 = \tfrac12 \cdot 1000\,(64 - 4) = 30$ kPa.

**Armadilha:** aplicar Bernoulli entre pontos de linhas de corrente diferentes num escoamento rotacional, ou ignorar perdas por atrito em tubos longos. Medidores reais usam um coeficiente de descarga para corrigir isso.

No experimento, ajuste a vazão do Venturi e compare a vazão calculada pelo desnível do manômetro com a real; depois esvazie o tanque e confira $v = \sqrt{2gh}$ pelo alcance do jato.`,
      experiments: [
        { kind: "sim", id: "bernoulli", scenario: "venturi", note: "Leia o desnível do manômetro e calcule a vazão pela continuidade e por Bernoulli." },
        { kind: "sim", id: "bernoulli", scenario: "torricelli", note: "Acompanhe h(t) enquanto o tanque se esvazia e compare a velocidade do jato com √(2gh)." },
        { kind: "sim", id: "bernoulli", scenario: "alcance", note: "Encontre a altura do orifício que dá o maior alcance do jato." },
        { kind: "sim", id: "aerofolio", scenario: "placa", note: "Veja a diferença de pressão entre o dorso e o ventre e a sustentação crescer com o ângulo de ataque." },
      ],
    },
  },
};
