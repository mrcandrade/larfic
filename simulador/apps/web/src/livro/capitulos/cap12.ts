import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 12,
  intro: String.raw`Pontes, prédios, guindastes, escadas encostadas na parede e o próprio esqueleto humano têm um objetivo comum: **não se mover**. Este capítulo aplica as leis de Newton para translação e rotação ao caso em que nada acelera. As duas condições de equilíbrio, força resultante nula e torque resultante nulo, permitem calcular as forças que apoios, cabos e articulações precisam suportar, desde que o problema tenha tantas equações quanto incógnitas. Quando não tem, a resposta depende de como os materiais se deformam, e isso leva à **elasticidade**: tensão, deformação e os módulos que dizem quanto um material estica, cisalha ou se comprime. É o ponto de partida da engenharia estrutural e da resistência dos materiais.`,
  sections: {
    "12-2": {
      text: String.raw`Um corpo rígido está em **equilíbrio** quando, num referencial inercial,
- o momento linear do centro de massa é constante: $\vec P = \text{constante}$;
- o momento angular em relação ao centro de massa (ou a qualquer ponto fixo) é constante: $\vec L = \text{constante}$.

Um disco de hóquei deslizando com velocidade constante ou uma roda girando com velocidade angular constante estão em equilíbrio. Neste capítulo o interesse principal é o **equilíbrio estático**, em que as duas constantes são **zero**: o corpo está parado e não gira. Um livro sobre a mesa, uma ponte, uma escada encostada.

### Estabilidade
O equilíbrio estático pode ser de três tipos, conforme o que acontece após um pequeno deslocamento:
- **estável:** surgem forças ou torques que trazem o corpo de volta (um pêndulo em repouso embaixo, uma bola no fundo de uma tigela);
- **instável:** o deslocamento cresce (um lápis equilibrado na ponta, uma bola no topo de uma cúpula);
- **indiferente:** o corpo fica em equilíbrio na nova posição (uma bola num piso horizontal).

Em termos de energia potencial, o equilíbrio estável corresponde a um mínimo de $U$ e o instável, a um máximo (seção 8-6). Para corpos apoiados pela gravidade, a regra prática é: o equilíbrio é estável enquanto a vertical pelo centro de gravidade passa dentro da **base de apoio**. Um caminhão carregado no alto tomba numa inclinação menor porque o centro de gravidade sobe e sai da base mais cedo.

**Exemplo.** Um bloco de 30 cm de base e 1,2 m de altura, com centro de gravidade no meio, tomba quando inclinado mais que $\arctan(15/60) \approx 14°$. Se ele tivesse 60 cm de altura, aguentaria até $\arctan(15/30) \approx 27°$.

**Armadilha:** confundir "em equilíbrio" com "parado". Um corpo pode estar em equilíbrio movendo-se com velocidade constante; e um corpo pode estar momentaneamente parado sem estar em equilíbrio (o topo da trajetória de uma bola lançada para cima).

No experimento, pendure a placa por pontos diferentes e veja que ela sempre para com o centro de massa abaixo do ponto de suspensão; depois incline o casco do navio e observe a diferença entre equilíbrio estável e instável.`,
      experiments: [
        { kind: "sim", id: "centro-massa", scenario: "pendurar", note: "Pendure a placa por vários pontos: no equilíbrio estável o centro de massa fica sempre abaixo do apoio." },
        { kind: "sim", id: "empuxo", scenario: "estavel", note: "Incline o navio estável e veja o torque que o devolve à posição de equilíbrio." },
        { kind: "sim", id: "empuxo", scenario: "tomba", note: "Com a carga alta, o mesmo pequeno desvio cresce: o equilíbrio é instável." },
      ],
    },
    "12-3": {
      text: String.raw`As leis de Newton para translação e rotação, $\vec F_{\text{res}} = d\vec P/dt$ e $\vec\tau_{\text{res}} = d\vec L/dt$, dizem que, para $\vec P$ e $\vec L$ constantes:
$$\sum \vec F_{\text{ext}} = 0, \qquad \sum \vec \tau_{\text{ext}} = 0 .$$
São as duas **condições de equilíbrio**. Só as forças e torques **externos** entram: as forças internas se cancelam aos pares pela terceira lei.

### Forças num plano
Na maioria dos problemas de engenharia elementar as forças estão todas num plano $xy$. Então sobram três equações escalares:
$$\sum F_x = 0, \qquad \sum F_y = 0, \qquad \sum \tau_z = 0 .$$
Com três equações, só se determinam até **três incógnitas**.

### Liberdade de escolha do ponto
Se a força resultante é zero, o torque resultante tem o mesmo valor em relação a **qualquer** ponto. Por isso se escolhe o ponto de referência de forma estratégica: passando pela linha de ação de forças desconhecidas, elas somem da equação de torques.

### Roteiro
1. Escolha o corpo e desenhe o diagrama de corpo livre com todas as forças externas, cada uma no seu ponto de aplicação.
2. Escolha eixos e um ponto para os torques que elimine o maior número de incógnitas.
3. Escreva as equações e resolva; confira sinais e unidades.

**Exemplo.** Uma viga uniforme de 4,0 m e 20 kg está apoiada nas pontas e carrega um motor de 60 kg a 1,0 m da ponta esquerda. Torques em torno do apoio esquerdo: $N_D \cdot 4{,}0 = 20 \cdot 9{,}8 \cdot 2{,}0 + 60 \cdot 9{,}8 \cdot 1{,}0$, dando $N_D = 245$ N. Da soma das forças, $N_E = 80 \cdot 9{,}8 - 245 = 539$ N. O apoio mais perto da carga carrega mais.

**Armadilha:** igualar só as forças e esquecer os torques. Duas forças iguais e opostas aplicadas em pontos diferentes (um binário) têm resultante nula, mas fazem o corpo girar.

No experimento, arraste as cargas e os apoios da viga e confira as reações calculadas; depois, na alavanca, verifique o equilíbrio de torques em torno do apoio.`,
      experiments: [
        { kind: "sim", id: "equilibrio-corpos", scenario: "viga", note: "Mova as cargas e os apoios e verifique ΣF = 0 e Στ = 0 com as reações calculadas." },
        { kind: "sim", id: "equilibrio-corpos", params: { modo: 0, L: 4, xa: 2, m1: 30, x1: 0, m2: 40, x2: 3.5 }, note: "Na gangorra, 30 kg a 2,0 m do pivô equilibram 40 kg a 1,5 m: confira os torques." },
        { kind: "sim", id: "maquinas-simples", scenario: "alavanca", note: "Equilibre a alavanca nas três classes e compare os braços de alavanca da força e da carga." },
        { kind: "sim", id: "forcas-dcl", scenario: "fios", note: "Monte o diagrama de corpo livre de um corpo pendurado por dois fios e aplique ΣF = 0." },
      ],
    },
    "12-4": {
      text: String.raw`A gravidade age sobre cada partícula de um corpo extenso. Para escrever a equação de torques, porém, queremos tratar o peso como **uma única força** aplicada num ponto. Esse ponto é o **centro de gravidade** (CG): o ponto em que a força gravitacional total $M\vec g$ produz o mesmo torque que a soma dos torques sobre todas as partículas.

### CG e centro de massa
O torque gravitacional total em relação à origem é $\sum x_i\, m_i g_i$. Se $\vec g$ é o mesmo em todo o corpo, o $g$ sai da soma e
$$x_{CG} = \frac{\sum m_i x_i}{M} = x_{CM} .$$
**Se a aceleração da gravidade é uniforme sobre o corpo, o centro de gravidade coincide com o centro de massa** (seção 9-2). Isso vale com excelente aproximação para qualquer objeto do dia a dia. Só para corpos muito altos (um arranha-céu de 1 km tem $g$ cerca de 0,03% menor no topo) ou muito extensos em relação à Terra a diferença aparece.

### Encontrando o CG
- Para corpos simétricos e homogêneos, o CG está no centro de simetria.
- Experimentalmente: pendure o corpo por um ponto; no equilíbrio, o CG fica na vertical abaixo do ponto. Repita com outro ponto: o CG está no cruzamento das duas verticais.
- O CG pode estar fora do material: num anel, num bumerangue, num atleta arqueado no salto em altura.

**Exemplo.** Uma régua de 1,0 m e 100 g tem um peso de 50 g preso na marca de 90 cm. O CG do conjunto está em $x = (100 \cdot 50 + 50 \cdot 90)/150 \approx 63$ cm. Apoiada num dedo nesse ponto, ela fica em equilíbrio.

**Armadilha:** achar que o CG fica no ponto em que há "mais material" ou no meio geométrico do contorno. Ele é uma média ponderada pela massa.

No experimento, levante uma barra uniforme de 2000 km sobre a Terra e veja o centro de gravidade ficar dezenas de quilômetros abaixo do centro de massa; encurte-a para 1 km e veja a diferença cair para uns 2,6 cm. Depois recorte uma placa irregular e compare o centro de massa calculado com o ponto encontrado pendurando-a por dois pontos.`,
      experiments: [
        { kind: "sim", id: "gravitacao-terra", scenario: "corpo-alto", note: "Com g diminuindo com a altura, o CG de uma barra muito alta fica abaixo do CM; reduza a altura até a diferença sumir." },
        { kind: "sim", id: "centro-massa", scenario: "recortar", note: "Recorte uma placa irregular e veja onde fica o centro de massa, inclusive fora do material." },
        { kind: "sim", id: "centro-massa", scenario: "pendurar", note: "Pendure a placa por dois pontos e encontre o CG no cruzamento das verticais." },
      ],
    },
    "12-5": {
      text: String.raw`Os problemas de estática seguem sempre o roteiro da seção 12-3. Algumas situações típicas ensinam truques úteis.

### Escada encostada na parede
Uma escada de comprimento $L$ e massa $m$ encosta numa parede lisa (sem atrito), fazendo ângulo $\theta$ com o chão. Agem o peso, a força horizontal da parede $F_p$, a normal do chão $N$ e o atrito estático do chão $f$. Das forças: $N = $ peso total e $f = F_p$. Dos torques em torno do pé da escada (elimina $N$ e $f$): $F_p L\sin\theta = mg\,(L/2)\cos\theta + \ldots$ Quanto mais alto sobe uma pessoa, maior o atrito necessário; quando ele passa de $\mu_e N$, a escada escorrega.

**Exemplo.** Escada de 5,0 m e 12 kg a 60° com o chão, pessoa de 70 kg a 3,0 m da base. Torques no pé: $F_p \cdot 5{,}0 \sin 60° = 12 \cdot 9{,}8 \cdot 2{,}5\cos60° + 70 \cdot 9{,}8 \cdot 3{,}0 \cos 60°$, o que dá $F_p \approx 272$ N. Então $f = 272$ N e $N = 82 \cdot 9{,}8 \approx 804$ N: é preciso $\mu_e \geq 0{,}34$.

### Lança de guindaste
Uma lança articulada na base e sustentada por um cabo. Torques em torno da articulação eliminam as duas componentes da força da articulação e dão a tração do cabo de uma vez; quanto mais baixo o ângulo do cabo em relação à lança, maior a tração.

### Viga e alavanca
Vigas sobre dois apoios, alavancas e gangorras se resolvem com uma única equação de torques em torno de um apoio.

**Armadilha:** esquecer que o peso de um corpo homogêneo age no seu centro, não na ponta, ou considerar a força da articulação ao longo da barra quando a barra também carrega cargas transversais.

No experimento, faça a pessoa subir a escada até ela escorregar e compare com o atrito calculado; no guindaste, abaixe a altura do cabo e veja a tração crescer até o limite de resistência.`,
      experiments: [
        { kind: "sim", id: "equilibrio-corpos", scenario: "escada", params: { L: 5, mc: 12, m1: 70, x1: 3, ang: 60, mu: 0.5 }, note: "Reproduza o exemplo e suba a pessoa até a escada escorregar; compare o atrito exigido com μ_e N." },
        { kind: "sim", id: "equilibrio-corpos", scenario: "guindaste", note: "Mude o ângulo da lança e a altura do cabo e veja como a tração e a força na articulação variam." },
        { kind: "sim", id: "maquinas-simples", scenario: "talha", note: "Na talha, use o equilíbrio de cada roldana para achar a força que segura a carga." },
      ],
    },
    "12-6": {
      text: String.raw`Num problema plano há só três equações de equilíbrio. Se o número de forças desconhecidas for maior, as leis de Newton **não bastam** para encontrá-las: a estrutura é **estaticamente indeterminada** (ou hiperestática).

### O exemplo da mesa
Uma mesa de quatro pernas sob um peso tem quatro forças verticais desconhecidas, uma por perna, e apenas três equações úteis (soma das forças verticais e torques em torno de dois eixos horizontais). Infinitas combinações das quatro forças satisfazem o equilíbrio. Com pernas perfeitamente rígidas, se uma for um pouco mais curta, a mesa **manca**: apoia-se em três pernas e a quarta fica no ar, com força zero.

### A saída: elasticidade
Na realidade, nenhum material é perfeitamente rígido. As pernas se comprimem um pouco, como molas de constante $k = EA/L$ (seção 12-7). Acrescentando a condição de que o tampo, rígido, desce como um plano, obtêm-se equações extras de **compatibilidade de deformações**, e o problema passa a ter solução única. Quando a perna curta encosta no chão, ela começa a carregar uma parte do peso que cresce com a carga.

**Exemplo.** Pernas de aço de 75 cm e 10 mm de diâmetro têm $k = EA/L \approx 200\times10^9 \cdot 7{,}85\times10^{-5}/0{,}75 \approx 2{,}1\times10^{7}$ N/m. Uma perna 0,05 mm mais curta só encosta quando as outras se comprimem 0,05 mm, o que só acontece com um peso da ordem de $k\delta = 2{,}1\times10^7 \cdot 5\times10^{-5} \approx 1{,}0$ kN. Com um calço de borracha, $k$ cai por milhares de vezes e a folga deixa de importar.

### Na engenharia
Vigas contínuas sobre três apoios, pórticos engastados e pontes hiperestáticas são resolvidos com essas equações extras. Estruturas indeterminadas são mais robustas (a falha de um apoio não derruba tudo), mas sensíveis a recalques e dilatação térmica. Já uma treliça bem projetada pode ser estaticamente determinada: cada nó dá duas equações.

**Armadilha:** "resolver" a mesa supondo que cada perna leva um quarto do peso. Isso só vale com as quatro pernas idênticas, peso centrado e piso perfeitamente plano.

No experimento, aumente o peso sobre a mesa e encontre a carga em que a perna curta encosta; mova o peso e troque o material das pernas. Compare com a treliça, que se resolve só com equilíbrio nó a nó.`,
      experiments: [
        { kind: "sim", id: "elasticidade", scenario: "mesa-quatro-pernas", note: "Aumente o peso e veja a perna mais curta encostar e passar a dividir a carga, conforme a rigidez das pernas." },
        { kind: "sim", id: "elasticidade", scenario: "mesa-quatro-pernas", params: { mat: 0, delta: 0, xw: 0, yw: 0 }, note: "Sem folga e com o peso no centro, confirme que cada perna leva um quarto do peso; depois mova o peso." },
        { kind: "sim", id: "equilibrio-corpos", scenario: "trelica", note: "Compare com uma treliça determinada: as forças nas barras saem só do equilíbrio de cada nó." },
      ],
    },
    "12-7": {
      text: String.raw`Os átomos de um sólido formam uma rede ligada por forças que se comportam, para pequenos deslocamentos, como molas. Por isso todo corpo "rígido" se deforma um pouco sob carga e volta ao normal ao ser descarregado, desde que a carga não passe de certo limite. A deformação é descrita por duas grandezas:
- **tensão:** força por unidade de área, $F/A$ (Pa, ou N/m²);
- **deformação:** variação relativa de uma dimensão (adimensional).
Na região elástica, elas são proporcionais: tensão = módulo × deformação.

### Tração e compressão
Uma barra de comprimento $L$ e seção $A$ sob força $F$ ao longo do eixo:
$$\frac{F}{A} = E\,\frac{\Delta L}{L},$$
em que $E$ é o **módulo de Young**: cerca de 200 GPa para o aço, 70 GPa para o alumínio, 17 GPa para o osso, poucos MPa para a borracha. No gráfico tensão × deformação de um ensaio, após o **limite elástico** o material escoa e fica com deformação permanente; mais adiante vem a **ruptura**.

### Cisalhamento
Forças paralelas às faces de um bloco deslocam a face de cima em $\Delta x$ em relação à de baixo (altura $L$):
$$\frac{F}{A} = G\,\frac{\Delta x}{L},$$
com $G$ o **módulo de cisalhamento** (cerca de 80 GPa no aço).

### Tensão hidráulica
Um corpo submetido a pressão $p$ por todos os lados (no fundo do mar, numa prensa hidráulica) diminui de volume:
$$p = B\,\frac{|\Delta V|}{V},$$
com $B$ o **módulo de elasticidade volumétrico** (também escrito $K$, como no simulador): 2,2 GPa para a água e cerca de 160 GPa para o aço.

**Exemplo.** Uma barra de aço de 2,0 m e 10 mm de diâmetro ($A \approx 7{,}85\times10^{-5}$ m²) sustenta 10 kN. A tensão é 127 MPa, abaixo do limite elástico (cerca de 250 MPa), e o alongamento é $\Delta L = (F/A)\,L/E \approx 127\times10^6 \cdot 2{,}0/200\times10^9 \approx 1{,}3$ mm.

**Armadilha:** confundir a força de ruptura com a tensão de ruptura. Uma barra mais grossa suporta mais força, mas rompe na mesma tensão: a tensão de ruptura é propriedade do material.

No experimento, rode o ensaio de tração no aço, meça $E$ pela inclinação do trecho reto e descarregue depois do limite elástico para ver a deformação permanente; depois compare borracha e aço no cisalhamento e na compressão hidráulica.`,
      experiments: [
        { kind: "sim", id: "elasticidade", scenario: "tracao", note: "Meça E pela inclinação inicial da curva tensão × deformação e encontre o limite elástico e a ruptura." },
        { kind: "sim", id: "elasticidade", scenario: "cisalhamento", note: "Compare o deslocamento do topo de um apoio de borracha e de um bloco de aço sob a mesma força." },
        { kind: "sim", id: "elasticidade", scenario: "compressao", note: "Aplique pressão hidráulica e meça a variação relativa de volume para obter o módulo volumétrico." },
        { kind: "sim", id: "lei-hooke", scenario: "uma-mola", note: "Na mola, a mesma proporcionalidade entre força e deformação aparece como a lei de Hooke." },
        { kind: "pratica", id: "exp1-hooke", note: "Roteiro de bancada da lei de Hooke e da associação de molas." },
      ],
    },
  },
};
