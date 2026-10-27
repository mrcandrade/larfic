import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 6,
  intro: String.raw`No capítulo 5 as forças eram quase sempre ideais: superfícies lisas, fios sem massa, nada de ar. Este capítulo traz para a conta três forças que aparecem em qualquer projeto real. O **atrito** entre superfícies sólidas segura o carro na curva, mas também gasta pneus e energia. A **força de arrasto** de um fluido limita a velocidade de uma gota de chuva, de um paraquedista ou de um carro na estrada. E, quando um corpo descreve uma curva, alguma força (atrito, normal, tração, gravidade) precisa fazer o papel de **força centrípeta**. Em todos os casos a ferramenta continua a mesma: diagrama de corpo livre e segunda lei de Newton, agora com modelos empíricos para as forças de contato.`,
  sections: {
    "6-2": {
      text: String.raw`Empurre de leve um armário pesado: ele não se move. A força que você aplica é equilibrada por uma força paralela ao piso, exercida pelo chão sobre o armário, que aparece justamente para impedir o deslizamento. Essa é a **força de atrito estático** $\vec f_e$. Aumente o empurrão e $f_e$ cresce junto, até um limite. Passado esse limite, o armário começa a deslizar e a força de contato tangencial cai para um valor aproximadamente constante, a **força de atrito cinético** $\vec f_c$.

### De onde vem o atrito
As superfícies, mesmo polidas, só se tocam em pequenas saliências. Nesses pontos de contato os átomos das duas faces chegam tão perto que se formam ligações (quase "microssoldas"). Para deslizar, essas ligações precisam ser rompidas continuamente; a energia gasta vira energia térmica. Quanto mais as superfícies são comprimidas uma contra a outra, maior a área real de contato, e por isso o atrito é proporcional à força normal.

### O gráfico força aplicada × atrito
Se você puxa um bloco com uma força horizontal $F$ que cresce devagar:
- enquanto o bloco está parado, $f_e = F$ (a reta a 45° no gráfico);
- no instante em que $F$ atinge $f_{e,\max}$, o bloco se solta;
- depois, com o bloco deslizando, o atrito vale $f_c < f_{e,\max}$, quase independente da velocidade.

**Exemplo.** Um caixote de 30 kg no chão exige 120 N para começar a se mover e 90 N para continuar deslizando a velocidade constante. Então $f_{e,\max} = 120$ N e $f_c = 90$ N. Se você aplicar 50 N, o atrito vale 50 N, e não 120 N.

**Armadilha comum:** usar $f = \mu N$ para o atrito estático sempre. A expressão dá apenas o **máximo**; o valor real é o que a segunda lei exigir.

No experimento, aumente devagar a inclinação da rampa e observe a força de atrito estático crescer junto com a componente do peso até o bloco escorregar; no diagrama de forças da mesa, mude a força na corda e veja o atrito acompanhar.`,
      experiments: [
        { kind: "sim", id: "plano-inclinado", scenario: "critico", note: "Incline a rampa devagar e veja o atrito estático crescer até o limite, quando o bloco escorrega." },
        { kind: "sim", id: "forcas-dcl", scenario: "mesa", note: "Monte o diagrama de corpo livre do bloco puxado na mesa e compare o atrito com a componente horizontal da força." },
        { kind: "concepcao", id: "forca-implica-movimento", note: "Um corpo pode receber força e ficar parado: o atrito estático equilibra a força aplicada." },
      ],
    },
    "6-3": {
      text: String.raw`Experimentos com blocos e superfícies secas levam a três regras práticas. Elas não são leis fundamentais, mas descrevem bem muitos materiais de engenharia.

### Propriedade 1: atrito estático ajusta-se até um máximo
Se o corpo não se move, a componente da força resultante paralela à superfície é equilibrada por $f_e$, com qualquer valor entre zero e o máximo.

### Propriedade 2: o máximo é proporcional à normal
$$f_{e,\max} = \mu_e N$$
em que $\mu_e$ é o **coeficiente de atrito estático**, adimensional, que depende do par de materiais (borracha-asfalto seco ≈ 0,9; aço-gelo ≈ 0,03).

### Propriedade 3: o atrito cinético vale
$$f_c = \mu_c N$$
com $\mu_c$ em geral menor que $\mu_e$. Os dois coeficientes quase não dependem da área aparente de contato nem (em faixas moderadas) da velocidade.

### A normal não é sempre o peso
$N$ é o que a superfície faz para impedir a penetração. Num plano inclinado de ângulo $\theta$, $N = mg\cos\theta$; se você puxa o bloco com uma corda inclinada para cima, a normal diminui, e o atrito também.

### O ângulo crítico
Num plano inclinado, o bloco está na iminência de escorregar quando $mg\sin\theta = \mu_e mg\cos\theta$, ou seja,
$$\tan\theta_c = \mu_e .$$
Essa é uma forma simples de medir $\mu_e$ no laboratório. Depois que o bloco desliza, a aceleração rampa abaixo é $a = g(\sin\theta - \mu_c\cos\theta)$.

**Exemplo.** Uma caixa de madeira começa a escorregar numa tábua inclinada a 27°: $\mu_e = \tan 27° \approx 0{,}51$. Se $\mu_c = 0{,}35$, a aceleração com a tábua a 27° é $a = 9{,}8(\sin 27° - 0{,}35\cos 27°) \approx 1{,}4$ m/s².

**Armadilha:** achar que dobrar a área de contato dobra o atrito. Com o mesmo peso, a pressão em cada ponto cai e a área real de contato fica praticamente igual.

No experimento, encontre o ângulo crítico para dois valores de $\mu_e$, confira $\tan\theta_c = \mu_e$ e depois meça a aceleração na descida para obter $\mu_c$.`,
      experiments: [
        { kind: "sim", id: "plano-inclinado", scenario: "desce", note: "Meça a aceleração na descida e calcule μc a partir de a = g(sen θ − μc cos θ)." },
        { kind: "pratica", id: "exp1-atrito", note: "Roteiro de bancada para medir os coeficientes de atrito estático e cinético." },
        { kind: "concepcao", id: "normal-igual-peso", note: "Veja em que situações a normal fica diferente do peso, e o atrito muda junto." },
      ],
    },
    "6-4": {
      text: String.raw`Um corpo que se move dentro de um fluido (ar, água, óleo) sente uma força oposta à sua velocidade relativa ao fluido: a **força de arrasto** $\vec D$. Para objetos do tamanho de bolas, carros e pessoas se movendo no ar, o escoamento atrás do corpo é turbulento e o arrasto é bem descrito por
$$D = \tfrac{1}{2} C \rho A v^2 ,$$
em que $\rho$ é a densidade do ar (≈ 1,2 kg/m³ ao nível do mar), $A$ é a área da seção reta perpendicular ao movimento e $C$ é o **coeficiente de arrasto**, determinado experimentalmente (≈ 0,5 para uma esfera, ≈ 0,3 para um carro aerodinâmico, ≈ 1 para uma pessoa de braços abertos).

### Velocidade terminal
Um corpo que cai a partir do repouso começa com aceleração $g$. À medida que a velocidade cresce, o arrasto cresce com $v^2$ e a força resultante diminui. Quando $D = mg$, a aceleração se anula e a velocidade fica constante:
$$v_t = \sqrt{\frac{2mg}{C\rho A}} .$$
Corpos com mais massa por unidade de área atingem velocidade terminal maior. É por isso que uma bola de aço e uma bola de isopor do mesmo tamanho chegam ao chão em tempos diferentes no ar, embora caiam juntas no vácuo.

**Exemplo.** Uma bola de 0,45 kg e 22 cm de diâmetro ($A \approx 0{,}038$ m²), com $C = 0{,}25$: $v_t = \sqrt{2 \cdot 0{,}45 \cdot 9{,}8 / (0{,}25 \cdot 1{,}2 \cdot 0{,}038)} \approx 28$ m/s, cerca de 100 km/h.

### Arrasto viscoso
Para corpos muito pequenos ou lentos em fluidos viscosos (uma gota de neblina, uma esfera de aço no mel), o escoamento é laminar e o arrasto passa a ser proporcional a $v$: para uma esfera de raio $r$, $D = 6\pi\eta r v$ (lei de Stokes). A ideia de velocidade terminal é a mesma, só muda a dependência com $v$.

**Armadilha:** pensar que, na velocidade terminal, não há força agindo. Há duas, peso e arrasto, e elas se cancelam.

No experimento, solte o corpo a partir do repouso, acompanhe $v(t)$ se aproximar da assíntota e mude a massa ou o diâmetro para ver como $v_t$ muda; compare depois com o lançamento no vácuo.`,
      experiments: [
        { kind: "sim", id: "projetil-arrasto", scenario: "terminal", note: "Acompanhe v(t) tender à velocidade terminal e teste como ela depende da massa e do diâmetro." },
        { kind: "sim", id: "queda-livre", scenario: "arrasto", note: "Compare a queda de uma bola leve com a de uma bola pesada e veja o arrasto aparecer nos tempos." },
        { kind: "sim", id: "viscosidade-stokes", scenario: "glicerina", note: "Arrasto viscoso: a esfera atinge a velocidade terminal na glicerina e dá a viscosidade." },
        { kind: "concepcao", id: "mais-pesado-cai-mais-rapido", note: "No vácuo a massa não importa; no ar, importa a razão massa/área." },
        { kind: "desafio", id: "alvo-com-arrasto", note: "Acerte o alvo levando em conta a resistência do ar." },
      ],
    },
    "6-5": {
      text: String.raw`Na seção 4-7 vimos que uma partícula em movimento circular uniforme (raio $r$, velocidade $v$) tem uma aceleração dirigida para o centro, de módulo $a = v^2/r$. Pela segunda lei, isso exige uma força resultante também dirigida para o centro:
$$F_{\text{res}} = m\frac{v^2}{r} .$$
Essa resultante é chamada **força centrípeta**. O nome indica direção, não um tipo novo de força: em cada problema ela é feita por alguma força conhecida.

### Quem faz o papel de força centrípeta
- Um carro numa curva plana: o **atrito estático** dos pneus com o asfalto.
- Um satélite: a **gravidade** da Terra.
- Uma pedra girando num barbante: a **tração**.
- Um vagão no ponto mais baixo de um loop: a diferença entre a **normal** e o peso.

### Curva plana e curva compensada
Numa curva plana de raio $R$, a maior velocidade sem derrapar sai de $\mu_e mg = mv^2/R$: $v_{\max} = \sqrt{\mu_e g R}$. Inclinando a pista de um ângulo $\theta$, a componente horizontal da normal ajuda; sem precisar de atrito nenhum, a velocidade de projeto é
$$v = \sqrt{gR\tan\theta} .$$

**Exemplo.** Curva de raio 80 m com asfalto molhado ($\mu_e = 0{,}4$): $v_{\max} = \sqrt{0{,}4 \cdot 9{,}8 \cdot 80} \approx 18$ m/s (64 km/h). Se a pista for inclinada a 12°, a velocidade que dispensa atrito é $\sqrt{9{,}8 \cdot 80 \tan 12°} \approx 13$ m/s; com atrito, a faixa segura se estende acima e abaixo desse valor.

### Topo de um loop
No ponto mais alto, peso e normal apontam para o centro: $N + mg = mv^2/R$. O carrinho perde contato quando $N$ chega a zero, o que dá a velocidade mínima $v = \sqrt{gR}$.

**Armadilha:** desenhar uma "força centrífuga" para fora no diagrama de corpo livre num referencial inercial. Não existe nenhum agente que a exerça; o que se sente "jogado para fora" é a inércia do corpo tentando seguir em linha reta.

No experimento, escolha o raio e a inclinação da estrada, varie a velocidade e encontre a faixa em que o carro não derrapa; depois, no loop, ache a altura mínima de largada.`,
      experiments: [
        { kind: "sim", id: "curva-inclinada", scenario: "estrada", note: "Varie a velocidade numa curva compensada e encontre a faixa em que o carro não derrapa." },
        { kind: "sim", id: "curva-inclinada", scenario: "loop", note: "Ache a menor altura de largada para o carrinho completar o loop sem perder contato." },
        { kind: "sim", id: "pendulos-especiais", scenario: "esferico", note: "No pêndulo cônico, a componente horizontal da tração é a força centrípeta." },
        { kind: "concepcao", id: "forca-centrifuga", note: "Confronte a ideia de uma força que empurra para fora da curva." },
        { kind: "desafio", id: "loop-sem-cair", note: "Faça o carrinho completar o loop." },
      ],
    },
  },
};
