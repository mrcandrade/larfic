import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 18,
  intro: String.raw`Este capítulo abre a termodinâmica, o estudo da energia térmica e das suas transformações. Primeiro damos significado preciso à temperatura (lei zero, termômetros e escalas); depois vemos como os corpos reagem a ela (dilatação térmica) e o que é o calor: energia transferida por causa de uma diferença de temperatura. Medimos o calor absorvido por sólidos e líquidos, inclusive nas mudanças de fase, ligamos calor e trabalho no gás de um cilindro e chegamos à primeira lei da termodinâmica, a conservação da energia escrita para sistemas que trocam calor. O capítulo termina com os três mecanismos de transferência de calor: condução, convecção e radiação, essenciais para o projeto de edificações, motores e equipamentos eletrônicos.`,
  sections: {
    "18-2": {
      text: String.raw`A **temperatura** é uma das grandezas fundamentais do SI, ao lado de comprimento, massa e tempo. No dia a dia ela é "quanto algo está quente ou frio"; na física, ela é a propriedade que decide **em que sentido** a energia térmica flui quando dois corpos se tocam: sempre do de maior para o de menor temperatura. Do ponto de vista microscópico (capítulo 19), ela mede a energia cinética média de agitação das moléculas.

### A escala Kelvin
A unidade SI é o **kelvin** (K). A escala Kelvin é **absoluta**: o zero, $0\ \text{K}$, é o **zero absoluto**, um limite inferior que nenhum sistema pode atingir nem ultrapassar e no qual a agitação térmica é a mínima possível. Não há temperaturas negativas nessa escala, e não se escreve "grau kelvin".

### Uma ideia das faixas
- Universo hoje (radiação de fundo): cerca de 2,7 K.
- Hélio líquido: 4,2 K. Nitrogênio líquido: 77 K.
- Água congelando: 273,15 K; corpo humano: cerca de 310 K.
- Superfície do Sol: cerca de 5800 K; centro do Sol: cerca de $1{,}5\times10^7$ K.

### Exemplo
Ao aquecer um objeto de 300 K para 600 K, sua temperatura absoluta dobrou. Já passar de 10 °C para 20 °C **não** dobra a temperatura: em kelvin vai de 283,15 K para 293,15 K, um aumento de apenas 3,5%. Razões de temperaturas só fazem sentido na escala Kelvin.

**Armadilha comum:** confundir temperatura com calor. Uma piscina morna tem muito mais energia interna que uma brasa, mas a brasa está a uma temperatura muito maior: tocar na brasa queima porque a energia flui para a sua pele com rapidez.

No experimento, meça com um termômetro de gás a temperatura do nitrogênio líquido e de outros banhos e localize cada uma na escala Kelvin, que começa no zero absoluto; depois aqueça um conjunto de átomos de argônio e veja a agitação crescer com a temperatura.`,
      experiments: [
        { kind: "sim", id: "termometro-gas", scenario: "escalas", params: { banho: 1 }, note: "Meça o nitrogênio líquido (77 K) e outros banhos e veja-os na escala Kelvin, a partir do zero absoluto." },
        { kind: "sim", id: "estados-materia", scenario: "fusao", note: "Aqueça o argônio e relacione a temperatura com a agitação dos átomos, do sólido ao gás." },
        { kind: "concepcao", id: "calor-temperatura", note: "Separe as ideias de calor e de temperatura." },
      ],
    },
    "18-3": {
      text: String.raw`Coloque dois corpos em contato, isolados do resto. Suas propriedades que dependem da temperatura (comprimento, pressão de um gás, resistência elétrica, cor) mudam por algum tempo e depois param de mudar. Dizemos então que os corpos estão em **equilíbrio térmico**: não há mais fluxo líquido de energia entre eles.

### O enunciado
A **lei zero da termodinâmica** diz:
> Se dois corpos A e B estão, cada um, em equilíbrio térmico com um terceiro corpo T, então A e B estão em equilíbrio térmico entre si.

Parece óbvio, mas é isso que dá sentido aos termômetros. O corpo T é o termômetro: se ele dá a mesma leitura em contato com A e com B, sabemos, sem tocar um no outro, que A e B não trocariam calor. A lei zero permite atribuir a cada corpo um número, a **temperatura**, tal que corpos em equilíbrio têm o mesmo número. O nome "zero" foi dado depois que a primeira e a segunda leis já tinham nome, por ser mais fundamental que elas.

### Exemplo
Um termômetro mergulhado numa xícara de chá marca 70 °C. Em seguida, mergulhado num bule, também marca 70 °C. Pela lei zero, se o chá da xícara for despejado de volta no bule, não haverá aquecimento nem resfriamento de nenhuma das partes.

**Armadilha comum:** achar que, no equilíbrio, os corpos têm a mesma energia. Eles têm a mesma **temperatura**; um corpo grande ou de calor específico alto guarda muito mais energia que um pequeno à mesma temperatura. Também é comum pensar que um gás pesado e um leve em equilíbrio têm moléculas com a mesma rapidez; o que se iguala é a energia cinética média.

No experimento, deixe um gás quente e leve em contato com um gás frio e pesado através de uma parede e veja as duas temperaturas convergirem para o mesmo valor.`,
      experiments: [
        { kind: "sim", id: "boltzmann-dois-gases", scenario: "dois-gases", note: "Hélio quente e argônio frio separados por uma parede chegam à mesma temperatura." },
        { kind: "sim", id: "entropia", scenario: "contato", note: "Dois sólidos em contato trocam energia até que as temperaturas se igualem." },
      ],
    },
    "18-4": {
      text: String.raw`Para medir temperatura precisamos de um fenômeno reprodutível que sirva de ponto fixo e de uma propriedade que varie com a temperatura de forma conhecida.

### O ponto triplo da água
A água pura, num recipiente fechado, pode ter gelo, água líquida e vapor coexistindo em equilíbrio em uma única combinação de pressão e temperatura: o **ponto triplo**. Por convenção histórica, a esse estado se atribuiu
$$T_3 = 273{,}16\ \text{K}.$$
(Desde 2019 o kelvin é definido fixando a constante de Boltzmann, mas o valor do ponto triplo continua sendo, na prática, 273,16 K.)

### O termômetro de gás a volume constante
É o termômetro padrão. Um bulbo com gás é mantido a volume fixo, e mede-se a pressão $p$ do gás. Para um gás bem rarefeito, a pressão é proporcional à temperatura absoluta, e definimos
$$T = (273{,}16\ \text{K}) \lim_{\text{gás}\to 0}\frac{p}{p_3},$$
em que $p_3$ é a pressão com o bulbo no ponto triplo. O limite (cada vez menos gás no bulbo) faz todos os gases concordarem, independentemente da sua natureza.

### Exemplo
Um bulbo marca $p_3 = 80{,}0\ \text{kPa}$ no ponto triplo e $p = 109{,}3\ \text{kPa}$ em água fervendo ao nível do mar. Então $T \approx 273{,}16 \times 109{,}3/80{,}0 = 373{,}2\ \text{K}$.

### Outros termômetros
Termômetros de líquido em vidro, termopares, termistores e pirômetros ópticos são mais práticos, mas são calibrados contra a escala do termômetro de gás. Cada um usa uma propriedade diferente: dilatação, tensão termoelétrica, resistência, radiação emitida.

**Armadilha comum:** pensar que qualquer propriedade linear dá a mesma escala. Um termômetro de mercúrio e um de álcool, calibrados nos mesmos dois pontos, discordam um pouco entre eles, porque as dilatações não são exatamente lineares. Por isso se escolheu o gás rarefeito como referência.

No experimento, calibre o termômetro de gás na célula do ponto triplo, meça a água fervendo com várias quantidades de gás e extrapole as leituras para $p_3 \to 0$: N₂, H₂, He e O₂ dão retas diferentes que convergem para 373,12 K.`,
      experiments: [
        { kind: "sim", id: "termometro-gas", scenario: "extrapolacao", note: "Registre leituras com p₃ de 80 a 20 kPa, extrapole para p₃ → 0 e repita com outro gás." },
        { kind: "sim", id: "termometro-gas", scenario: "ponto-triplo", note: "Calibre o bulbo no ponto triplo (273,16 K) e meça a água fervendo com T = 273,16 K · p/p₃." },
        { kind: "sim", id: "processos-pv", scenario: "isocorica", note: "A volume constante, a temperatura acompanha a pressão: P/T fica fixo, como no termômetro de gás." },
        { kind: "pratica", id: "exp2-charles", note: "Extrapole o gráfico de um gás até pressão (ou volume) nula e estime o zero absoluto." },
        { kind: "sim", id: "moto-perpetuo", scenario: "galileu", note: "Um termômetro curioso: o de Galileu, que usa o empuxo em esferas num líquido que se dilata." },
      ],
    },
    "18-5": {
      text: String.raw`### Celsius
A escala Celsius usa graus do mesmo tamanho que o kelvin, apenas com o zero deslocado:
$$T_C = T - 273{,}15.$$
Na pressão de 1 atm, a água congela perto de 0 °C e ferve perto de 100 °C. Uma **diferença** de temperatura de 1 °C é igual a uma diferença de 1 K.

### Fahrenheit
Usada nos Estados Unidos, tem graus menores (100 °C correspondem a 180 °F) e outro zero:
$$T_F = \tfrac{9}{5}\,T_C + 32°.$$
O congelamento da água fica em 32 °F e a ebulição em 212 °F.

### Exemplos
- Temperatura corporal de 37,0 °C: $T_F = 1{,}8 \times 37{,}0 + 32 = 98{,}6\ °\text{F}$ e $T = 310{,}15\ \text{K}$.
- Um forno a 350 °F: $T_C = (350 - 32)/1{,}8 \approx 177\ °\text{C}$.
- As escalas Celsius e Fahrenheit coincidem em $-40°$: basta resolver $T_F = T_C$ na equação acima.

### Diferenças × leituras
Converta leituras com as fórmulas completas, mas converta **diferenças** só pelo fator de escala: um aumento de 10 °C é um aumento de 10 K e de 18 °F (sem somar 32).

**Armadilhas comuns:** somar 32 ao converter uma variação; usar graus Celsius em fórmulas que pedem temperatura absoluta (como $pV = nRT$ ou a radiação térmica, $\propto T^4$). Em qualquer equação com razão ou potência de $T$, use kelvin.

No experimento, leia a mesma temperatura nas escalas Kelvin, Celsius e Fahrenheit, lado a lado, e procure o valor em que Celsius e Fahrenheit coincidem. Na bancada, meça a pressão de um gás em várias temperaturas em graus Celsius e extrapole a reta até a pressão nula: o ponto de corte, perto de −273 °C, é o zero da escala Kelvin.`,
      experiments: [
        { kind: "sim", id: "termometro-gas", scenario: "escalas", note: "Leia a temperatura medida em K, °C e °F lado a lado e ache onde Celsius e Fahrenheit coincidem." },
        { kind: "pratica", id: "exp2-charles", note: "Ajuste uma reta aos dados em °C e encontre o zero absoluto no ponto em que ela corta o eixo." },
        { kind: "sim", id: "processos-pv", scenario: "isocorica", note: "Leia a temperatura final em kelvin e em graus Celsius para vários estados do gás." },
      ],
    },
    "18-6": {
      text: String.raw`Quase todos os materiais aumentam de tamanho quando aquecidos: com mais agitação, os átomos oscilam em torno de posições médias um pouco mais afastadas, porque a força entre eles não é simétrica. Juntas de dilatação em pontes, folgas em trilhos e a tampa de metal que se solta sob água quente são consequências práticas.

### Dilatação linear
Uma barra de comprimento $L$ cuja temperatura varia $\Delta T$ muda de comprimento
$$\Delta L = L\,\alpha\,\Delta T,$$
em que $\alpha$ é o **coeficiente de dilatação linear** (unidade: $\text{K}^{-1}$ ou $°\text{C}^{-1}$). Valores típicos: aço $1{,}2\times10^{-5}$, alumínio $2{,}3\times10^{-5}$, vidro comum $9\times10^{-6}$, invar (liga especial) $7\times10^{-7}$ por kelvin. A dilatação ocorre em todas as direções, inclusive em furos: um anel aquecido tem o furo maior.

### Dilatação volumétrica
Para o volume,
$$\Delta V = V\,\beta\,\Delta T, \qquad \beta \approx 3\alpha \ \ \text{(sólidos isotrópicos)}.$$

### Exemplo
Um trilho de aço de 12 m sujeito a uma variação de 40 °C entre noite de inverno e tarde de verão: $\Delta L = 12 \times 1{,}2\times10^{-5} \times 40 \approx 5{,}8\ \text{mm}$. Sem folga, o trilho entortaria.

### A lâmina bimetálica
Duas tiras de metais com $\alpha$ diferentes, soldadas, se curvam ao serem aquecidas: o metal que dilata mais fica do lado de fora da curva. É o princípio de termostatos e disjuntores térmicos.

### O comportamento anômalo da água
Entre 0 °C e 4 °C a água **contrai** ao ser aquecida; sua massa específica é máxima perto de 4 °C. Por isso lagos congelam de cima para baixo e a água do fundo fica a cerca de 4 °C, permitindo a vida aquática no inverno.

**Armadilha comum:** pensar que o furo de uma chapa diminui quando ela esquenta. Ele cresce, como se fosse feito do próprio material.

No experimento, aqueça o tubo de latão com vapor, leia o relógio comparador e calcule $\alpha$; depois veja a lâmina bimetálica se curvar.`,
      experiments: [
        { kind: "sim", id: "dilatacao-termica", scenario: "vapor", note: "Leia ΔL no relógio comparador e ΔT no termômetro e calcule α do latão." },
        { kind: "sim", id: "dilatacao-termica", scenario: "bimetal", note: "Observe a lâmina bimetálica se curvar para o lado do metal que dilata menos." },
        { kind: "pratica", id: "exp2-dilatacao", note: "Roteiro de bancada para medir o coeficiente de dilatação linear." },
      ],
    },
    "18-7": {
      text: String.raw`Uma lata de refrigerante tirada da geladeira esquenta até a temperatura da sala; uma xícara de café esfria até ela. Em ambos os casos há transferência de energia entre o **sistema** (a lata, o café) e o **ambiente**, por causa da diferença de temperatura.

### Definição de calor
**Calor** $Q$ é a energia transferida entre um sistema e seu ambiente **por causa de uma diferença de temperatura**. Convenção de sinais:
- $Q > 0$ quando o sistema **recebe** energia (o ambiente está mais quente);
- $Q < 0$ quando o sistema **perde** energia.
Se não há diferença de temperatura, não há calor.

O calor não é algo que o corpo "contém". Um corpo tem **energia interna** (energia cinética e potencial das moléculas); calor é o nome da energia **em trânsito**, assim como trabalho é energia transferida por uma força ao longo de um deslocamento.

### Unidades
No SI o calor se mede em joules. Historicamente usou-se a **caloria**, definida pela quantidade de calor que eleva 1 g de água de 14,5 °C para 15,5 °C:
$$1\ \text{cal} = 4{,}1868\ \text{J}.$$
A "Caloria" dos rótulos de alimentos é a quilocaloria (1 kcal = 4186,8 J). Também aparece a BTU, comum em aparelhos de ar-condicionado (1 BTU ≈ 1055 J).

### Exemplo
Uma barra de cereal de 120 kcal libera, ao ser metabolizada, $120 \times 4186{,}8 \approx 5{,}0\times10^5\ \text{J}$, energia suficiente para erguer uma pessoa de 70 kg a cerca de 730 m de altura (sem contar as perdas do corpo).

**Armadilha comum:** dizer que um objeto "tem muito calor" ou que "o frio entra" pela janela. O que existe é energia fluindo do quente para o frio; o "frio" não é uma substância. Outra: o metal parece mais frio que a madeira à mesma temperatura porque conduz energia para fora da mão mais depressa, não porque esteja a uma temperatura menor.

No experimento, coloque um bloco de cobre quente na água do calorímetro e acompanhe o fluxo de energia até as temperaturas se igualarem.`,
      experiments: [
        { kind: "sim", id: "calorimetria", scenario: "metal", note: "Cobre quente na água: veja o calor sair do metal e entrar na água até o equilíbrio." },
        { kind: "concepcao", id: "calor-temperatura", note: "Distinga energia interna, calor e temperatura." },
        { kind: "concepcao", id: "metal-mais-frio", note: "Por que o metal parece mais frio que a madeira na mesma sala?" },
      ],
    },
    "18-8": {
      text: String.raw`### Capacidade térmica e calor específico
A **capacidade térmica** $C$ de um objeto é a constante entre o calor recebido e a variação de temperatura: $Q = C\,\Delta T$. Dividindo pela massa obtemos o **calor específico** $c$, que depende só do material:
$$Q = c\,m\,\Delta T.$$
A água tem $c = 4186\ \text{J/(kg·K)}$, valor alto; o cobre, $386\ \text{J/(kg·K)}$. Às vezes é mais útil o **calor específico molar**, por mol em vez de por kg; para muitos sólidos ele fica perto de $3R \approx 25\ \text{J/(mol·K)}$. Para gases, importa se o aquecimento é a volume ou a pressão constante (capítulo 19); para sólidos e líquidos a diferença é pequena.

### Calores de transformação
Na **mudança de fase** (fusão, vaporização), o corpo absorve energia sem mudar de temperatura: a energia vai para desfazer ligações entre moléculas. O calor necessário é
$$Q = L\,m,$$
com $L$ o **calor de transformação**. Para a água: fusão $L_F = 333\ \text{kJ/kg}$, vaporização $L_V = 2256\ \text{kJ/kg}$.

### Exemplo
Quanto calor leva 0,50 kg de gelo a −10 °C até água a 20 °C? Com $c_{\text{gelo}} = 2090\ \text{J/(kg·K)}$:
- aquecer o gelo: $0{,}50 \times 2090 \times 10 = 10{,}5\ \text{kJ}$;
- derreter: $0{,}50 \times 333 = 166{,}5\ \text{kJ}$;
- aquecer a água: $0{,}50 \times 4186 \times 20 = 41{,}9\ \text{kJ}$.
Total: cerca de 219 kJ, dos quais três quartos só para derreter.

### Calorimetria
Num recipiente isolado, a soma de todos os calores trocados é zero: $\sum Q = 0$. É assim que se encontra a temperatura final de uma mistura ou se mede um calor específico.

**Armadilhas comuns:** esquecer o calor de fusão quando há gelo na mistura (e não verificar se ele derrete todo); achar que "ferver mais forte" deixa a água mais quente. Durante a ebulição, mais potência só evapora mais rápido; a temperatura fica presa em 100 °C (a 1 atm).

No experimento, aqueça gelo com potência constante e identifique na curva os patamares de fusão e de ebulição; depois resolva o desafio de chegar a 30 °C numa mistura.`,
      experiments: [
        { kind: "sim", id: "calorimetria", scenario: "aquecimento", note: "Veja os patamares de fusão e de ebulição na curva de aquecimento e meça L pela duração deles." },
        { kind: "sim", id: "calorimetria", scenario: "gelo", note: "Gelo demais na água: o equilíbrio fica em 0 °C com parte do gelo sobrando." },
        { kind: "desafio", id: "calorimetria-30", note: "Escolha massas e temperaturas para que a mistura termine em 30 °C." },
        { kind: "pratica", id: "exp2-calor-especifico", note: "Meça o calor específico de um metal com o calorímetro." },
        { kind: "concepcao", id: "ferver-mais-forte", note: "Mais fogo esquenta mais a água que já está fervendo?" },
      ],
    },
    "18-9": {
      text: String.raw`Calor e trabalho são as duas formas de transferir energia para um sistema. Para ver como se relacionam, considere um gás num cilindro com um pistão móvel, apoiado sobre uma fonte térmica de temperatura ajustável.

### O trabalho do gás
Se o gás empurra o pistão de área $A$ com pressão $p$ por um deslocamento $ds$, o trabalho feito **pelo gás** é $dW = pA\,ds = p\,dV$. Numa transformação do volume $V_i$ para $V_f$:
$$W = \int_{V_i}^{V_f} p\,dV.$$
No **diagrama pV**, $W$ é a **área sob a curva** do processo. É positivo quando o gás se expande e negativo quando é comprimido.

### O caminho importa
Do mesmo estado inicial ao mesmo estado final há infinitos caminhos no diagrama pV, cada um com uma área diferente. Por isso o trabalho **depende do caminho**, e o calor trocado também. Exemplo: um gás vai de (200 kPa, 2,0 L) a (100 kPa, 5,0 L).
- Primeiro expande a 200 kPa até 5,0 L e depois resfria a volume constante: $W = 200\times10^3 \times 3{,}0\times10^{-3} = 600\ \text{J}$.
- Primeiro resfria a volume constante até 100 kPa e depois expande: $W = 100\times10^3 \times 3{,}0\times10^{-3} = 300\ \text{J}$.
Mesmos estados inicial e final, trabalhos diferentes.

### Trabalho mecânico vira "calor"
Joule mostrou que agitar água com pás movidas por pesos que caem aumenta sua temperatura tanto quanto aquecê-la com chama: cerca de 4,19 J de trabalho equivalem a 1 cal. Essa equivalência derrubou a ideia de calor como fluido (o "calórico").

**Armadilha comum:** falar do "calor de um estado" ou do "trabalho de um estado". Calor e trabalho só existem durante um processo; um estado tem pressão, volume, temperatura e energia interna, não calor nem trabalho.

No experimento, leve o gás ao mesmo estado final por dois caminhos diferentes e compare as áreas; depois use o aparelho de Joule para converter trabalho de pesos em aumento de temperatura.`,
      experiments: [
        { kind: "sim", id: "processos-pv", scenario: "comparar", note: "Leve o gás ao mesmo volume por dois processos e compare as áreas (trabalhos)." },
        { kind: "sim", id: "equivalente-mecanico", scenario: "joule", note: "Pesos que caem giram pás na água: compare o trabalho mecânico com o calor e obtenha J ≈ 4,19 J/cal." },
        { kind: "pratica", id: "exp2-joule", note: "Roteiro do equivalente mecânico do calor." },
      ],
    },
    "18-10": {
      text: String.raw`Embora $Q$ e $W$ dependam do caminho, a experiência mostra que a diferença $Q - W$ é a **mesma para todos os caminhos** entre dois estados. Ela mede, portanto, a variação de uma propriedade do estado do sistema, a **energia interna** $E_{\text{int}}$ (ou $U$). Isso é a **primeira lei da termodinâmica**:
$$\Delta E_{\text{int}} = Q - W,$$
ou, para um processo infinitesimal, $dE_{\text{int}} = dQ - dW$. Aqui $Q$ é o calor **recebido** pelo sistema e $W$ o trabalho **realizado pelo** sistema.

### Leitura física
A energia interna de um sistema aumenta quando ele recebe calor e diminui quando ele realiza trabalho sobre o exterior. É o princípio da conservação da energia, estendido para incluir o calor. (Alguns textos, principalmente de química, usam $W$ como trabalho feito **sobre** o sistema e escrevem $\Delta U = Q + W$; a física é a mesma, mudando só o sinal de $W$.)

### Exemplos
- Um gás recebe 500 J de calor e, ao se expandir, realiza 200 J de trabalho: $\Delta E_{\text{int}} = 500 - 200 = 300\ \text{J}$, e a temperatura sobe.
- Um gás é comprimido com 150 J de trabalho ($W = -150\ \text{J}$) e ao mesmo tempo perde 150 J de calor: $\Delta E_{\text{int}} = -150 - (-150) = 0$. É o que acontece numa compressão isotérmica de um gás ideal.

### Por que a energia interna é uma função de estado
Se não fosse, poderíamos levar o sistema por um caminho e trazê-lo de volta por outro, terminando no mesmo estado com energia "sobrando" ou "faltando". Isso seria um moto-perpétuo de primeira espécie, que nunca foi observado.

**Armadilha comum:** usar $Q = \Delta E_{\text{int}}$ sempre. Só vale quando $W = 0$, ou seja, a volume constante.

No experimento, faça uma expansão isotérmica e confira que $\Delta U = 0$ e $Q = W$; depois veja, na roda de Bhaskara e no moinho que se realimenta, onde falham as máquinas que tentam violar a primeira lei.`,
      experiments: [
        { kind: "sim", id: "processos-pv", scenario: "isotermica", note: "Expansão isotérmica: confira ΔU = 0 e Q = W nas saídas da primeira lei." },
        { kind: "sim", id: "moto-perpetuo", scenario: "moinho", note: "Um moinho que bombeia a própria água: veja por que a conta de energia nunca fecha." },
      ],
    },
    "18-11": {
      text: String.raw`A primeira lei, $\Delta E_{\text{int}} = Q - W$, fica especialmente simples em quatro situações.

### Processo adiabático
Ocorre tão depressa, ou com isolamento tão bom, que não há troca de calor: $Q = 0$. Então
$$\Delta E_{\text{int}} = -W.$$
Se o gás se expande ($W > 0$), sua energia interna e sua temperatura caem; se é comprimido, esquenta. Exemplo: comprimir rapidamente o ar de uma bomba de bicicleta com 50 J de trabalho ($W = -50\ \text{J}$) aumenta a energia interna em 50 J, e a bomba esquenta.

### Processo a volume constante (isocórico)
Sem mudança de volume não há trabalho: $W = 0$, e
$$\Delta E_{\text{int}} = Q.$$
Todo o calor recebido vira energia interna. Exemplo: 300 J fornecidos a um gás numa lata rígida aumentam sua energia interna em 300 J.

### Processo cíclico
O sistema volta ao estado inicial: $\Delta E_{\text{int}} = 0$, logo
$$Q = W.$$
O trabalho líquido do ciclo (a área dentro do ciclo no diagrama pV) é igual ao calor líquido recebido. É o princípio das máquinas térmicas (capítulo 20).

### Expansão livre
Um gás isolado escapa para um compartimento vazio ao romper uma membrana. Não há troca de calor (isolado) e não há trabalho (não empurra nada), logo
$$Q = W = 0 \quad\Rightarrow\quad \Delta E_{\text{int}} = 0.$$
Para um gás ideal, a temperatura final é igual à inicial. A expansão livre não pode ser desenhada como uma curva no diagrama pV, pois os estados intermediários não são de equilíbrio.

**Armadilha comum:** achar que "adiabático" significa "temperatura constante". É o contrário: sem calor, a temperatura muda justamente porque todo o trabalho sai (ou entra) na energia interna. Temperatura constante é o processo isotérmico.

No experimento, comprima o gás adiabaticamente e veja a temperatura subir; depois feche um ciclo retangular e confira $\Delta U_{\text{total}} = 0$ e $Q = W$.`,
      experiments: [
        { kind: "sim", id: "processos-pv", scenario: "adiabatica", note: "Compressão adiabática: Q = 0 e o trabalho recebido vira energia interna." },
        { kind: "sim", id: "processos-pv", scenario: "isocorica", note: "Volume constante: W = 0 e Q = ΔU." },
        { kind: "sim", id: "processos-pv", scenario: "ciclo", note: "Feche um ciclo e confira ΔU total nulo e Q total igual ao trabalho total." },
        { kind: "sim", id: "entropia", scenario: "expansao", note: "Expansão livre de um gás: sem calor e sem trabalho, a energia não muda." },
      ],
    },
    "18-12": {
      text: String.raw`A energia térmica passa de um lugar a outro por três mecanismos.

### Condução
Numa parede de espessura $L$ e área $A$ com faces a $T_Q$ e $T_F$, a potência transmitida é
$$P_{\text{cond}} = kA\,\frac{T_Q - T_F}{L},$$
com $k$ a **condutividade térmica** (cobre 400, vidro 1,0, tijolo 0,6, isopor 0,033 W/(m·K)). Define-se a **resistência térmica** de uma camada por unidade de área, $R = L/k$. Camadas em série somam resistências, e no regime estacionário a mesma potência atravessa todas:
$$P = \frac{A\,(T_Q - T_F)}{\sum L_i/k_i}.$$
Exemplo: uma parede de tijolo de 10 m², 20 cm, com 20 °C de diferença conduz $10 \times 20/(0{,}2/0{,}6) = 600\ \text{W}$. Acrescentando 5 cm de isopor, $R = 0{,}33 + 1{,}52 = 1{,}85\ \text{m}^2\text{K/W}$ e a perda cai para cerca de 110 W.

### Convecção
Num fluido, a parte aquecida fica menos densa e sobe, levando energia consigo: correntes de convecção na panela, brisa marítima, chama de vela. Em engenharia descreve-se a troca entre uma superfície e um fluido por $P = hA\,\Delta T$, com $h$ o coeficiente de convecção, que cresce muito com vento ou bombeamento.

### Radiação
Todo corpo emite ondas eletromagnéticas, sem precisar de meio. A potência emitida é
$$P_{\text{rad}} = \sigma \varepsilon A T^4, \qquad \sigma = 5{,}67\times10^{-8}\ \text{W/(m}^2\text{K}^4),$$
com $\varepsilon$ a emissividade (0 a 1) e $T$ **em kelvin**. O corpo também absorve do ambiente $\sigma\varepsilon A T_{\text{amb}}^4$, e a potência líquida é $\sigma\varepsilon A(T^4 - T_{\text{amb}}^4)$. Exemplo: pele a 34 °C, área de 1,5 m², $\varepsilon = 0{,}97$, paredes a 22 °C: a perda líquida é cerca de 108 W, comparável ao metabolismo em repouso.

**Armadilhas comuns:** "o frio entra pela janela" (é a energia que sai); usar graus Celsius na lei de $T^4$; achar que a camada mais grossa da parede domina sempre. Domina a de maior $L/k$: 5 cm de isopor isolam mais que 20 cm de tijolo.

No experimento, monte uma parede com e sem isolante e compare as potências; depois veja o café esfriar por convecção e radiação e o efeito estufa de um planeta.`,
      experiments: [
        { kind: "sim", id: "transferencia-calor", scenario: "parede", note: "Compare a potência conduzida por uma parede de tijolo com e sem camada isolante." },
        { kind: "sim", id: "transferencia-calor", scenario: "resfriamento", note: "Separe as parcelas de convecção e de radiação no resfriamento de um café." },
        { kind: "sim", id: "conducao-calor", scenario: "barra", note: "Barra de cobre com termopares: perfil linear de temperatura e medida de k." },
        { kind: "sim", id: "transferencia-calor", scenario: "estufa", note: "Balanço de radiação de um planeta e o efeito estufa." },
        { kind: "pratica", id: "exp2-condutividade", note: "Meça a condutividade térmica de uma barra metálica." },
        { kind: "pratica", id: "exp2-newton", note: "Meça a curva de resfriamento de um corpo e teste a lei de Newton." },
        { kind: "concepcao", id: "frio-entra", note: "O frio entra ou a energia sai?" },
      ],
    },
  },
};
