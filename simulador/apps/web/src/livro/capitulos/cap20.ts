import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 20,
  intro: String.raw`A primeira lei garante que a energia se conserva, mas não diz em que sentido os processos acontecem. Um ovo quebrado não se recompõe, o café não esquenta sozinho tirando energia do ar da sala, um gás que escapou para um recipiente vazio não volta ao canto de onde saiu, embora nenhum desses processos invertidos violasse a conservação da energia. A grandeza que dá direção aos processos é a entropia, e a regra que a governa é a segunda lei da termodinâmica. Neste capítulo calculamos variações de entropia, enunciamos a segunda lei e a aplicamos a máquinas térmicas e refrigeradores, mostrando que nenhuma máquina real supera a eficiência de Carnot. Terminamos com a interpretação estatística: a entropia conta o número de maneiras microscópicas de realizar um estado macroscópico.`,
  sections: {
    "20-2": {
      text: String.raw`Muitos processos do dia a dia ocorrem num só sentido: calor flui do quente para o frio, um gás se espalha pelo recipiente, um bloco deslizando para por atrito e esquenta. Chamamos esses processos de **irreversíveis**: não podem ser desfeitos por uma pequena mudança nas condições externas. O filme de qualquer um deles, passado de trás para a frente, parece absurdo, mesmo sem violar a conservação da energia.

### Entropia
O que define o sentido não é a energia, mas outra propriedade de estado, a **entropia** $S$. O postulado central é:
> Num sistema fechado, se ocorre um processo irreversível, a entropia do sistema sempre aumenta.

Diferentemente da energia, a entropia **não se conserva**. Ela é uma **função de estado**: depende só do estado do sistema (de $p$, $V$, $T$…), não de como ele chegou ali. Isso será a chave para calculá-la na seção 20-3.

### Exemplo
Um litro de gás está num dos lados de uma caixa isolada, separado do vácuo por uma membrana. A membrana se rompe e o gás ocupa a caixa toda (expansão livre). A energia não mudou, a temperatura também não (gás ideal), mas o estado final tem entropia maior. O processo inverso, o gás voltar espontaneamente para a metade inicial, deixaria a energia igual e diminuiria a entropia: nunca é observado.

### Por que "nunca"
A seção 20-8 mostra que o processo inverso não é proibido por nenhuma lei microscópica: as colisões entre moléculas são reversíveis. Ele é apenas fantasticamente improvável para um número grande de moléculas. A "seta do tempo" é estatística.

**Armadilha comum:** pensar que a entropia de **qualquer** sistema sempre aumenta. A entropia de uma parte pode diminuir (a água que congela no freezer perde entropia); o postulado vale para o sistema **fechado** como um todo.

No experimento, abra a partição e veja o gás se espalhar; depois inverta as velocidades de todas as partículas e observe que o gás só volta se a inversão for perfeita e feita cedo.`,
      experiments: [
        { kind: "sim", id: "entropia", scenario: "expansao", note: "Abra a partição e acompanhe a entropia S/k = ln Ω crescer até o gás ocupar toda a caixa." },
        { kind: "sim", id: "entropia", scenario: "seta", note: "Inverta as velocidades: o gás volta, mas só se a inversão for exata e feita cedo." },
      ],
    },
    "20-3": {
      text: String.raw`A variação de entropia entre dois estados de equilíbrio $i$ e $f$ é definida por
$$\Delta S = S_f - S_i = \int_i^f \frac{dQ}{T},$$
calculada ao longo de um processo **reversível** que ligue esses estados ($T$ em kelvin). Unidade: J/K.

### E se o processo real for irreversível?
Como $S$ é função de estado, $\Delta S$ depende só dos estados inicial e final. Se o processo real for irreversível (como a expansão livre, em que nem se define $T$ durante o processo), **substituímos** por qualquer processo reversível com os mesmos extremos e calculamos por ele.

### Casos úteis
- **Isotérmico reversível**: $\Delta S = Q/T$.
- **Gás ideal**, de $(V_i, T_i)$ a $(V_f, T_f)$, por qualquer caminho:
$$\Delta S = nR\ln\frac{V_f}{V_i} + nC_V\ln\frac{T_f}{T_i}.$$
- **Aquecimento de um sólido ou líquido** com $c$ constante: $\Delta S = mc\ln(T_f/T_i)$.
- **Mudança de fase** à temperatura $T$: $\Delta S = mL/T$.

### Exemplos
- Expansão livre de 1,0 mol de gás ideal até o dobro do volume: $T_f = T_i$, então $\Delta S = 8{,}31 \times \ln 2 \approx +5{,}76\ \text{J/K}$, embora $Q = 0$ no processo real.
- Derreter 1,0 kg de gelo a 273 K: $\Delta S = 333\times10^3/273 \approx +1{,}22\ \text{kJ/K}$.
- Aquecer 1,0 kg de água de 20 °C a 80 °C: $\Delta S = 1{,}0 \times 4186 \times \ln(353/293) \approx +780\ \text{J/K}$.

**Armadilha comum:** concluir que $\Delta S = 0$ na expansão livre porque $Q = 0$. A integral $\int dQ/T$ deve ser feita num caminho **reversível**; no caminho real irreversível ela não dá $\Delta S$.

No experimento, faça uma expansão isotérmica reversível no diagrama pV e calcule $Q/T$; depois compare com o $\Delta S$ da expansão livre do mesmo gás até o mesmo volume, no simulador de entropia.`,
      experiments: [
        { kind: "sim", id: "processos-pv", scenario: "isotermica", note: "Expansão isotérmica reversível: calcule ΔS = Q/T e compare com nR ln(V_f/V_i)." },
        { kind: "sim", id: "entropia", scenario: "expansao", note: "Expansão livre até o dobro do volume: confira ΔS/k ≈ N ln 2 no final." },
      ],
    },
    "20-4": {
      text: String.raw`Na seção 20-2, o postulado da entropia falava só de processos irreversíveis. Incluindo os reversíveis idealizados (em que a entropia do sistema fechado não muda), chegamos à **segunda lei da termodinâmica**:
$$\Delta S \ge 0 \quad\text{(sistema fechado)}.$$
O sinal de igualdade vale para processos reversíveis e o de desigualdade para os irreversíveis. Todos os processos reais são irreversíveis em algum grau (atrito, turbulência, troca de calor com diferença finita de temperatura), então na prática a entropia do universo sempre cresce.

### Sistema × vizinhança
Num processo reversível, a entropia de uma parte pode diminuir, desde que outra parte aumente pelo menos o mesmo tanto. Na compressão isotérmica reversível de um gás, $\Delta S_{\text{gás}} = -Q/T$ e o reservatório recebe $+Q/T$: soma zero.

### Exemplo: calor do quente para o frio
1000 J passam diretamente de um reservatório a 400 K para outro a 300 K (por uma barra metálica, por exemplo). Para os reservatórios, cujas temperaturas não mudam:
$$\Delta S = -\frac{1000}{400} + \frac{1000}{300} = -2{,}50 + 3{,}33 = +0{,}83\ \text{J/K}.$$
Positivo: o processo é permitido. O fluxo contrário, do frio para o quente sozinho, daria $-0{,}83$ J/K e violaria a segunda lei. Esse é o enunciado de Clausius em linguagem de entropia.

### Contato térmico entre dois corpos
Quando dois corpos a temperaturas diferentes se tocam, a energia flui até que as temperaturas se igualem. Esse é exatamente o estado em que a entropia total é máxima: o corpo quente perde menos entropia do que o frio ganha, porque $|dQ|/T_{\text{quente}} < |dQ|/T_{\text{frio}}$.

**Armadilha comum:** aplicar $\Delta S \ge 0$ a um sistema que troca calor com o exterior. Uma geladeira diminui a entropia do seu interior; somando a cozinha, que recebe calor, a entropia total aumenta.

No experimento, coloque dois sólidos em contato e acompanhe $S_A$, $S_B$ e a soma: a energia flui até a entropia total parar de crescer, e é aí que as temperaturas se igualam.`,
      experiments: [
        { kind: "sim", id: "entropia", scenario: "contato", note: "Acompanhe S_A, S_B e a entropia total no contato térmico; o equilíbrio é o máximo da soma." },
        { kind: "sim", id: "entropia", scenario: "mistura", note: "A mistura de dois gases também aumenta a entropia, sem troca de energia." },
      ],
    },
    "20-5": {
      text: String.raw`Uma **máquina térmica** extrai calor $|Q_Q|$ de uma fonte quente a $T_Q$, realiza trabalho $W$ e rejeita calor $|Q_F|$ para uma fonte fria a $T_F$, operando num ciclo: a substância de trabalho (gás, vapor) volta sempre ao estado inicial, então $\Delta E_{\text{int}} = 0$ e
$$W = |Q_Q| - |Q_F|.$$
A **eficiência** é o que se aproveita dividido pelo que se paga:
$$\varepsilon = \frac{W}{|Q_Q|} = 1 - \frac{|Q_F|}{|Q_Q|}.$$

### A máquina de Carnot
É a máquina ideal: duas isotermas (absorve calor a $T_Q$, rejeita a $T_F$) e duas adiabáticas, tudo reversível. Como o ciclo é reversível, a entropia total não muda: a entropia que o gás recebe da fonte quente, $|Q_Q|/T_Q$, é a que ele entrega à fria, $|Q_F|/T_F$. Daí $|Q_F|/|Q_Q| = T_F/T_Q$ e
$$\varepsilon_C = 1 - \frac{T_F}{T_Q}.$$
A eficiência de Carnot depende só das temperaturas das fontes, em kelvin. O ciclo de Stirling ideal (duas isotermas e duas isocóricas com regenerador) atinge a mesma eficiência.

### Exemplo
Entre 800 K e 300 K: $\varepsilon_C = 1 - 300/800 = 62{,}5\%$. Para extrair 1,0 kJ de trabalho por ciclo, a máquina absorve $|Q_Q| = 1{,}6\ \text{kJ}$ e rejeita $0{,}6\ \text{kJ}$. Para chegar a 100% seria preciso $T_F = 0\ \text{K}$.

### A máquina perfeita não existe
Uma máquina que transformasse todo o calor em trabalho ($|Q_F| = 0$) reduziria a entropia da fonte quente sem aumentar a de nada: violaria a segunda lei. Esse é o enunciado de Kelvin–Planck: **não existe uma série de processos cujo único resultado seja converter integralmente calor em trabalho.**

**Armadilha comum:** usar graus Celsius na eficiência de Carnot. Entre 527 °C e 27 °C, $1 - 27/527$ daria 95%, um absurdo; em kelvin são os mesmos 62,5%.

No experimento, rode o ciclo de Carnot entre 800 K e 300 K, confira o trabalho como área do ciclo e a eficiência; depois mude $T_F$ e veja a eficiência acompanhar $1 - T_F/T_Q$.`,
      experiments: [
        { kind: "sim", id: "ciclos-termicos", scenario: "carnot", note: "Ciclo de Carnot entre 800 K e 300 K: confira ε = 1 − T_F/T_Q e o trabalho como área no diagrama PV." },
        { kind: "sim", id: "ciclos-termicos", scenario: "stirling", note: "O ciclo de Stirling ideal: compare sua eficiência com a de Carnot entre as mesmas temperaturas." },
      ],
    },
    "20-6": {
      text: String.raw`Um **refrigerador** é uma máquina térmica funcionando ao contrário: recebe trabalho $W$ (do compressor) para retirar calor $|Q_F|$ de um ambiente frio e despejar $|Q_Q| = |Q_F| + |W|$ num ambiente quente. Geladeiras, aparelhos de ar-condicionado e bombas de calor funcionam assim.

### Coeficiente de desempenho
Para um refrigerador, o que interessa é o calor retirado do ambiente frio:
$$K = \frac{|Q_F|}{|W|}.$$
Para o refrigerador de Carnot (reversível), usando $|Q_F|/|Q_Q| = T_F/T_Q$:
$$K_C = \frac{T_F}{T_Q - T_F}.$$
Numa **bomba de calor**, o que interessa é o calor entregue ao ambiente quente, e o coeficiente é $|Q_Q|/|W|$, que no caso ideal vale $T_Q/(T_Q - T_F)$, sempre maior que 1.

### Exemplos
- Um freezer a −18 °C (255 K) numa cozinha a 25 °C (298 K): $K_C = 255/43 \approx 5{,}9$. Freezers reais ficam perto de 2 a 3, por causa das diferenças de temperatura nos trocadores de calor e das perdas no compressor.
- Uma bomba de calor que aquece uma casa a 35 °C (nos radiadores) tirando calor do ar externo a 0 °C tem, no limite ideal, $308/35 \approx 8{,}8$: cada joule elétrico entrega até 8,8 J de calor. Um aquecedor de resistência entrega só 1 J por joule.

### O refrigerador perfeito não existe
Um refrigerador sem trabalho ($W = 0$) levaria calor do frio para o quente sozinho. A entropia do lado frio cairia $|Q|/T_F$ e a do lado quente subiria só $|Q|/T_Q$, menos: $\Delta S < 0$. É o enunciado de Clausius da segunda lei.

**Armadilha comum:** deixar a porta da geladeira aberta para esfriar a cozinha. O calor retirado do interior volta para a cozinha somado ao trabalho do compressor: a cozinha **esquenta**.

No experimento, compare o coeficiente de desempenho da geladeira com o de Carnot para as mesmas temperaturas; depois passe para o modo bomba de calor e veja o desempenho cair quando o inverno fica mais frio.`,
      experiments: [
        { kind: "sim", id: "refrigerador", scenario: "geladeira", note: "Compare o COP real da geladeira com T_F/(T_Q − T_F)." },
        { kind: "sim", id: "refrigerador", scenario: "bomba", note: "Bomba de calor no inverno: baixe a temperatura externa e veja o coeficiente de desempenho cair." },
        { kind: "sim", id: "refrigerador", scenario: "carnot", note: "Mesmo com trocadores e compressor ideais o COP fica abaixo do de Carnot: identifique as perdas na válvula e no superaquecimento." },
      ],
    },
    "20-7": {
      text: String.raw`### Nenhuma máquina supera a de Carnot
Suponha que um inventor afirme ter uma máquina X, operando entre as mesmas fontes, com eficiência maior que a de Carnot: $\varepsilon_X > \varepsilon_C$. Acople X a um refrigerador de Carnot, ajustando-os para que o trabalho que X produz seja exatamente o que o refrigerador consome. Como X é mais eficiente, ela tira da fonte quente **menos** calor do que o refrigerador devolve a ela; e, para fechar a conta de energia, o conjunto retira da fonte fria o mesmo excesso. Resultado líquido: calor passa do frio para o quente sem nenhum trabalho externo, um refrigerador perfeito, proibido pela segunda lei. Logo:
$$\varepsilon_{\text{real}} \le \varepsilon_C = 1 - \frac{T_F}{T_Q},$$
e todas as máquinas **reversíveis** entre as mesmas fontes têm exatamente $\varepsilon_C$.

### Ciclos reais
Motores reais não seguem o ciclo de Carnot: o motor a gasolina segue aproximadamente o **ciclo Otto** (duas adiabáticas e duas isocóricas), cuja eficiência ideal depende da razão de compressão $r = V_{\text{máx}}/V_{\text{mín}}$:
$$\varepsilon_{\text{Otto}} = 1 - \frac{1}{r^{\gamma-1}}.$$
Com $r = 8$ e $\gamma = 1{,}4$: $\varepsilon = 1 - 8^{-0{,}4} \approx 56\%$. O motor real fica perto de 25% a 35%, por atrito, combustão finita, troca de calor com as paredes e gases que não se comportam idealmente. O Diesel admite $r$ maior (cerca de 18) e por isso é mais eficiente. Usinas termelétricas modernas chegam a cerca de 40%, e as de ciclo combinado, perto de 60%.

### Exemplo
Uma usina a vapor com caldeira a 550 °C (823 K) e condensador a 40 °C (313 K) tem limite de Carnot $1 - 313/823 \approx 62\%$. Se a eficiência real for 40%, para cada 1000 MW elétricos ela rejeita $1000/0{,}40 - 1000 = 1500\ \text{MW}$ de calor para o rio ou para as torres de resfriamento.

**Armadilha comum:** achar que melhorar o projeto pode levar qualquer máquina térmica a 100%. O limite de Carnot é imposto pelas temperaturas, não pela engenharia; a única saída é aumentar $T_Q$ ou baixar $T_F$.

No experimento, rode o ciclo Otto, compare sua eficiência com a de Carnot entre as temperaturas extremas do próprio ciclo e varie a razão de compressão; depois compare Otto e Diesel no simulador de motores.`,
      experiments: [
        { kind: "sim", id: "ciclos-termicos", scenario: "otto", note: "Ciclo Otto: compare ε = 1 − r^(1−γ) com a eficiência de Carnot entre as temperaturas extremas." },
        { kind: "sim", id: "motores-termicos", scenario: "diesel", note: "Diesel × Otto: veja o efeito da razão de compressão no rendimento e na potência." },
        { kind: "sim", id: "moto-perpetuo", scenario: "passaro", note: "O pássaro bebedor é uma máquina térmica real: descubra quais são as suas fontes quente e fria." },
      ],
    },
    "20-8": {
      text: String.raw`A entropia ganha um significado concreto quando olhamos as moléculas. Considere $N$ moléculas numa caixa dividida em duas metades iguais.

### Microestados e configurações
Uma **configuração** diz quantas moléculas estão em cada metade, por exemplo $n_1$ à esquerda e $n_2 = N - n_1$ à direita. Um **microestado** diz em que metade está **cada** molécula. O número de microestados de uma configuração, a **multiplicidade**, é
$$W = \frac{N!}{n_1!\,n_2!}.$$
A hipótese fundamental da física estatística é que todos os microestados são igualmente prováveis. Logo, a configuração mais provável é a de maior $W$.

### Exemplo pequeno
Com $N = 4$ há $2^4 = 16$ microestados. A configuração 2–2 tem $W = 4!/(2!\,2!) = 6$ (probabilidade 6/16); a 4–0 tem $W = 1$ (1/16). Com $N = 100$, a probabilidade de todas estarem do mesmo lado é $2\times2^{-100} \approx 2\times10^{-30}$. Com $10^{23}$ moléculas, o espalhamento uniforme deixa de ser apenas o mais provável e passa a ser praticamente certo.

### A equação de Boltzmann
Boltzmann ligou entropia e multiplicidade:
$$S = k\ln W.$$
O logaritmo faz a entropia de dois sistemas independentes se somar ($W$ se multiplica). Para $N$ grande usa-se a **aproximação de Stirling**, $\ln N! \approx N\ln N - N$.

### Conferindo com a termodinâmica
Na expansão livre para o dobro do volume, cada molécula passa a ter duas metades disponíveis em vez de uma: $W_f/W_i = 2^N$, e
$$\Delta S = k\ln 2^N = Nk\ln 2 = nR\ln 2,$$
exatamente o resultado da seção 20-3. A segunda lei é, no fundo, a afirmação de que sistemas grandes evoluem para as configurações com mais microestados, porque elas são esmagadoramente mais prováveis.

**Armadilha comum:** entender entropia como "bagunça" visual. O que ela conta é o número de microestados compatíveis com o que se mede macroscopicamente; um estado que parece ordenado pode ter mais microestados do que outro que parece desordenado.

No experimento, acompanhe o número de partículas em cada metade e o valor de $\ln\Omega$ durante a expansão livre; na tábua de Galton, veja os mesmos coeficientes binomiais surgirem como a distribuição das bolas.`,
      experiments: [
        { kind: "sim", id: "entropia", scenario: "expansao", note: "Acompanhe as partículas em cada metade e S/k = ln Ω até o máximo com metade de cada lado." },
        { kind: "sim", id: "probabilidade-montecarlo", scenario: "galton", note: "A tábua de Galton gera a distribuição binomial: as configurações com mais caminhos (microestados) dominam." },
      ],
    },
  },
};
