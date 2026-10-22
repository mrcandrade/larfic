import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 19,
  intro: String.raw`A termodinâmica clássica descreve um gás por grandezas macroscópicas: pressão, volume, temperatura, energia interna. A teoria cinética explica essas grandezas a partir do movimento de um número enorme de moléculas que colidem entre si e com as paredes. Neste capítulo contamos as moléculas (número de Avogadro), estabelecemos a lei dos gases ideais, deduzimos a pressão a partir dos choques, interpretamos a temperatura como energia cinética média, estimamos a distância entre colisões e descrevemos a distribuição de velocidades de Maxwell. Em seguida explicamos os calores específicos dos gases pela equipartição da energia, vemos onde a física clássica falha e é preciso a mecânica quântica, e terminamos com a expansão adiabática, base dos motores do capítulo 20.`,
  sections: {
    "19-2": {
      text: String.raw`Quantidades macroscópicas de matéria contêm um número enorme de átomos. Para contá-las usamos o **mol**: a quantidade de substância que contém tantas entidades elementares quanto o **número de Avogadro**,
$$N_A = 6{,}022\times10^{23}\ \text{mol}^{-1}.$$
Desde 2019 esse valor é exato, por definição do SI.

### Relações úteis
Se uma amostra tem $N$ moléculas, o número de mols é $n = N/N_A$. Com a **massa molar** $M$ (massa de um mol, em kg/mol ou g/mol) e a massa $m$ de uma molécula:
$$M = m\,N_A, \qquad n = \frac{M_{\text{am}}}{M},$$
em que $M_{\text{am}}$ é a massa da amostra.

### Exemplo
Uma garrafa com 1,0 L de água tem 1000 g; com $M = 18{,}0\ \text{g/mol}$ são $n = 55{,}6\ \text{mol}$, ou $N = 55{,}6 \times 6{,}02\times10^{23} \approx 3{,}3\times10^{25}$ moléculas. Uma molécula de água tem massa $m = 0{,}018/6{,}02\times10^{23} \approx 3{,}0\times10^{-26}\ \text{kg}$.

### Como se mediu $N_A$
Antes de se poder "ver" átomos, $N_A$ foi obtido por caminhos indiretos. Um dos mais bonitos é o **movimento browniano**: grãos microscópicos em suspensão num líquido são empurrados ao acaso pelas moléculas. Einstein mostrou que o deslocamento quadrático médio cresce como $\langle x^2\rangle = 2Dt$, com $D = kT/(6\pi\eta a)$; medindo $D$, Perrin obteve a constante de Boltzmann $k$ e daí $N_A = R/k$. Outra pista é a **lei de Avogadro**: volumes iguais de gases diferentes, à mesma pressão e temperatura, contêm o mesmo número de moléculas.

**Armadilha comum:** confundir massa molar com massa da molécula; elas diferem pelo fator $N_A$. E o mol não é uma unidade de massa: um mol de hidrogênio tem 2 g, um mol de xenônio 131 g.

No experimento, acompanhe partículas brownianas, meça $\langle x^2\rangle$ ao longo do tempo e estime o número de Avogadro; depois veja a lei de Avogadro com dois gases separados por uma parede móvel.`,
      experiments: [
        { kind: "sim", id: "difusao-browniano", scenario: "browniano", note: "Meça ⟨x²⟩ = 2Dt de partículas brownianas e obtenha k e N_A pela relação de Einstein–Stokes." },
        { kind: "sim", id: "boltzmann-dois-gases", scenario: "avogadro", note: "Com mesma P e T, os volumes ficam na razão dos números de moléculas." },
      ],
    },
    "19-3": {
      text: String.raw`Medidas com gases muito rarefeitos mostram que, para qualquer gás, pressão, volume, temperatura e quantidade se relacionam pela **lei dos gases ideais**:
$$pV = nRT = NkT,$$
com $R = 8{,}31\ \text{J/(mol·K)}$ e $k = R/N_A = 1{,}38\times10^{-23}\ \text{J/K}$ (constante de Boltzmann). $T$ é sempre em kelvin. Gases reais seguem bem essa lei em baixas densidades; perto da condensação os desvios aparecem (modelo de van der Waals).

### Exemplo
Um mol de gás a 300 K e 1,0 atm (101 kPa) ocupa $V = nRT/p = 8{,}31 \times 300/1{,}01\times10^5 \approx 24{,}7\ \text{L}$.

### Trabalho em processos simples
Com $W = \int p\,dV$ (seção 18-9) e a lei dos gases:
- **Isotérmico** ($T$ constante, curva $pV = $ const, uma hipérbole):
$$W = nRT\ln\frac{V_f}{V_i}.$$
Dobrando o volume do mol acima a 300 K: $W = 8{,}31\times300\times\ln 2 \approx 1{,}73\ \text{kJ}$.
- **Isocórico** ($V$ constante): $W = 0$.
- **Isobárico** ($p$ constante): $W = p\,(V_f - V_i) = nR\,\Delta T$.

### Leis particulares
A lei dos gases ideais reúne as antigas leis de Boyle ($pV$ constante a $T$ fixo), de Charles ($V \propto T$ a $p$ fixo) e de Gay-Lussac ($p \propto T$ a $V$ fixo).

**Armadilha comum:** usar a fórmula do trabalho isotérmico em qualquer expansão. Ela supõe $T$ constante ao longo de todo o caminho; numa adiabática ou numa isobárica o resultado é outro.

No experimento, compare a pressão medida pelo impacto das moléculas nas paredes com $NkT$ dividido pela área (a versão 2D da lei), e depois faça uma expansão isotérmica no diagrama pV.`,
      experiments: [
        { kind: "sim", id: "gas-ideal", scenario: "pressao", note: "Compare a pressão medida pelos choques nas paredes com a previsão NkT/A (gás em 2D)." },
        { kind: "sim", id: "processos-pv", scenario: "isotermica", note: "Expansão isotérmica: compare a área sob a hipérbole com nRT ln(V_f/V_i)." },
        { kind: "pratica", id: "exp2-boyle", note: "Verifique a lei de Boyle medindo pV a temperatura constante." },
      ],
    },
    "19-4": {
      text: String.raw`Por que um gás exerce pressão? Considere $N$ moléculas de massa $m$ numa caixa cúbica de aresta $L$. Uma molécula com componente $v_x$ bate na parede perpendicular a $x$ e volta com $-v_x$: transfere momento $2mv_x$. Ela volta a essa parede depois de percorrer $2L$, isto é, a cada $2L/v_x$. A força média que ela exerce é $mv_x^2/L$. Somando sobre todas as moléculas e dividindo pela área $L^2$:
$$p = \frac{m}{L^3}\sum v_x^2 = \frac{Nm\,\overline{v_x^2}}{V}.$$
Como não há direção privilegiada, $\overline{v_x^2} = \overline{v^2}/3$, e com $Nm = nM$:
$$p = \frac{nM\,v_{\text{rms}}^2}{3V},$$
em que $v_{\text{rms}} = \sqrt{\overline{v^2}}$ é a **velocidade média quadrática**.

### Ligação com a temperatura
Comparando com $pV = nRT$:
$$v_{\text{rms}} = \sqrt{\frac{3RT}{M}}.$$
A pressão, uma grandeza macroscópica, sai do movimento microscópico; e a temperatura fica ligada à rapidez das moléculas.

### Exemplos (300 K)
- Nitrogênio ($M = 0{,}028\ \text{kg/mol}$): $v_{\text{rms}} = \sqrt{3\times8{,}31\times300/0{,}028} \approx 517\ \text{m/s}$.
- Hidrogênio ($M = 0{,}002$): cerca de 1930 m/s.
Esses valores são da ordem da velocidade do som no gás, o que não é coincidência: o som é transmitido pelas próprias colisões.

**Armadilhas comuns:** achar que moléculas pesadas exercem mais pressão. À mesma temperatura, elas são mais lentas na proporção exata para que $mv^2$ seja igual, e a pressão depende só de $N$, $T$ e $V$. E $v_{\text{rms}}$ não é a média das velocidades: é a raiz da média dos quadrados, um pouco maior.

No experimento, leia $v_{\text{rms}}$ do gás simulado, compare a pressão medida com a teórica e repita com hélio e xenônio à mesma temperatura.`,
      experiments: [
        { kind: "sim", id: "gas-ideal", scenario: "pressao", note: "Relacione a pressão medida com o impulso das moléculas nas paredes e leia v_rms." },
        { kind: "sim", id: "gas-ideal", scenario: "massas", note: "Hélio × xenônio à mesma temperatura: velocidades diferentes, mesma pressão." },
      ],
    },
    "19-5": {
      text: String.raw`A energia cinética de translação média de uma molécula é $\overline{K} = \tfrac{1}{2}m\,v_{\text{rms}}^2$. Usando $v_{\text{rms}}^2 = 3RT/M$ e $M/m = N_A$:
$$\overline{K} = \frac{3}{2}\,kT.$$
Este é um dos resultados centrais da teoria cinética: **a temperatura mede a energia cinética média de translação das moléculas**, e essa média é a mesma para todos os gases à mesma temperatura, qualquer que seja a massa das moléculas.

### Ordem de grandeza
A 300 K: $\overline{K} = 1{,}5 \times 1{,}38\times10^{-23} \times 300 \approx 6{,}2\times10^{-21}\ \text{J} \approx 0{,}039\ \text{eV}$. É pouco perto da energia de uma ligação química (alguns eV), e por isso a maioria das moléculas não se desfaz por colisões à temperatura ambiente.

### Energia de um gás monoatômico
Num gás ideal monoatômico toda a energia interna é cinética de translação:
$$E_{\text{int}} = N\cdot\tfrac{3}{2}kT = \tfrac{3}{2}\,nRT.$$
Um mol de hélio a 300 K guarda $1{,}5 \times 8{,}31 \times 300 \approx 3{,}7\ \text{kJ}$.

### Exemplo
Numa mistura de hélio e argônio em equilíbrio a 400 K, as duas espécies têm $\overline{K} = 8{,}3\times10^{-21}\ \text{J}$, mas a razão das velocidades é $\sqrt{40/4} \approx 3{,}2$: o hélio é três vezes mais rápido.

**Armadilha comum:** estender a igualdade para as velocidades. O que se iguala no equilíbrio é $\tfrac{1}{2}mv^2$ médio, não $v$. (O gás das simulações é bidimensional; ali há só dois movimentos de translação e $\overline{K} = kT$, mas a ideia é a mesma: $\tfrac{1}{2}kT$ por direção.)

No experimento, coloque hélio quente e argônio frio em contato e compare, no equilíbrio, as temperaturas e as velocidades médias dos dois.`,
      experiments: [
        { kind: "sim", id: "boltzmann-dois-gases", scenario: "dois-gases", note: "No equilíbrio as energias cinéticas médias se igualam, mas o hélio fica cerca de 3 vezes mais rápido." },
        { kind: "sim", id: "gas-ideal", scenario: "massas", note: "Compare a energia cinética total e a v_rms de hélio e xenônio à mesma temperatura." },
      ],
    },
    "19-6": {
      text: String.raw`Se as moléculas de um gás andam a centenas de metros por segundo, por que um perfume leva segundos ou minutos para atravessar uma sala? Porque cada molécula colide bilhões de vezes por segundo e muda de direção a cada choque. A distância média percorrida entre duas colisões sucessivas é o **livre caminho médio** $\lambda$.

### Estimativa
Modele as moléculas como esferas de diâmetro $d$. Duas colidem quando os centros passam a menos de $d$ um do outro, então uma molécula "varre" um cilindro de seção $\pi d^2$. Num intervalo em que anda a distância $L$, ela colide com as moléculas dentro de um volume $\pi d^2 L$; com $N/V$ moléculas por unidade de volume, o número de colisões é $\pi d^2 L\,N/V$. Levando em conta que as outras moléculas também se movem (o que dá um fator $\sqrt{2}$):
$$\lambda = \frac{1}{\sqrt{2}\,\pi d^2\,N/V}.$$

### Exemplo
Ar nas condições ambientes: $N/V \approx 2{,}5\times10^{25}\ \text{m}^{-3}$ e $d \approx 3\times10^{-10}\ \text{m}$. Então
$$\lambda \approx \frac{1}{1{,}41 \times 3{,}14 \times 9\times10^{-20} \times 2{,}5\times10^{25}} \approx 1\times10^{-7}\ \text{m},$$
cerca de 300 diâmetros moleculares. Com velocidade média de 470 m/s, a frequência de colisões é $v/\lambda \approx 5\times10^9$ por segundo. No vácuo de uma câmara a $10^{-4}$ Pa, $\lambda$ chega a cerca de 100 m, muito maior que a câmara.

### Consequências
O livre caminho médio controla a **difusão**, a viscosidade e a condutividade térmica dos gases. Como a molécula faz uma caminhada aleatória, a distância típica que ela se afasta cresce só com a raiz do tempo.

**Armadilha comum:** achar que $\lambda$ depende da temperatura a volume constante. Ele depende do número de moléculas por volume e do tamanho delas; aquecendo o gás num recipiente fechado, as colisões ficam mais frequentes, mas $\lambda$ não muda.

No experimento, meça o livre caminho médio do gás de discos e compare com a fórmula (na versão 2D); mude o diâmetro e o número de moléculas.`,
      experiments: [
        { kind: "sim", id: "difusao-browniano", scenario: "caminho", note: "Meça λ no gás simulado e compare com a previsão; dobre o diâmetro e veja λ cair." },
        { kind: "sim", id: "difusao-browniano", scenario: "difusao", note: "Veja duas espécies se misturarem devagar, apesar das velocidades moleculares altas." },
      ],
    },
    "19-7": {
      text: String.raw`As moléculas de um gás não têm todas a mesma rapidez: as colisões trocam energia ao acaso, e algumas ficam lentas enquanto outras ficam muito rápidas. Maxwell obteve a distribuição de equilíbrio. A fração de moléculas com rapidez entre $v$ e $v + dv$ é $P(v)\,dv$, com
$$P(v) = 4\pi\left(\frac{M}{2\pi RT}\right)^{3/2} v^2\, e^{-Mv^2/2RT}.$$
O fator $v^2$ vem do número de maneiras de ter uma rapidez $v$ (a área de uma casca esférica no espaço das velocidades); a exponencial é o fator de Boltzmann, que torna improváveis as energias muito acima de $kT$. A área total sob a curva é 1.

### Três velocidades características
$$v_P = \sqrt{\frac{2RT}{M}}, \qquad v_{\text{méd}} = \sqrt{\frac{8RT}{\pi M}}, \qquad v_{\text{rms}} = \sqrt{\frac{3RT}{M}},$$
sempre na ordem $v_P < v_{\text{méd}} < v_{\text{rms}}$. Para o oxigênio a 300 K: 395 m/s, 445 m/s e 483 m/s.

### Efeito da temperatura e da massa
Aquecer o gás ou usar moléculas mais leves desloca o pico para a direita e alarga a curva (a área continua 1, então o pico abaixa). A cauda de alta velocidade cresce muito com a temperatura, o que explica por que a evaporação e as reações químicas aceleram tanto quando se aquece: elas dependem das poucas moléculas mais rápidas. Também explica por que a Terra perdeu quase todo o hidrogênio e o hélio da atmosfera: uma fração pequena, mas não nula, supera a velocidade de escape.

### Exemplo
Para nitrogênio a 300 K, $v_P \approx 422\ \text{m/s}$. A fração com rapidez acima de $3v_P$ é cerca de $4\times10^{-4}$: poucas, mas, em $10^{25}$ moléculas, uma quantidade enorme.

**Armadilha comum:** imaginar que todas as moléculas de um gás a uma dada temperatura têm a mesma velocidade. A temperatura fixa a distribuição, não a velocidade de cada molécula.

No experimento, comece com todas as moléculas com a mesma rapidez e veja o histograma se espalhar até coincidir com a curva de Maxwell.`,
      experiments: [
        { kind: "sim", id: "gas-ideal", scenario: "relaxacao", note: "Todas começam com a mesma rapidez; as colisões levam o histograma à distribuição de Maxwell." },
        { kind: "concepcao", id: "gas-mesma-velocidade", note: "Confronte a ideia de que todas as moléculas têm a mesma velocidade." },
      ],
    },
    "19-8": {
      text: String.raw`### Energia interna de um gás ideal
Num gás ideal monoatômico, $E_{\text{int}} = \tfrac{3}{2}nRT$ (seção 19-5): a energia interna depende **só da temperatura**. Isso continua valendo para qualquer gás ideal, com outro coeficiente.

### Calor específico molar a volume constante
Aquecendo $n$ mols a volume fixo, $W = 0$ e todo o calor vira energia interna: $Q = nC_V\Delta T$. Para o gás monoatômico,
$$C_V = \frac{1}{n}\frac{\Delta E_{\text{int}}}{\Delta T} = \frac{3}{2}R \approx 12{,}5\ \text{J/(mol·K)},$$
valor confirmado para hélio, neônio e argônio. Como $E_{\text{int}}$ só depende de $T$, a relação
$$\Delta E_{\text{int}} = nC_V\,\Delta T$$
vale para **qualquer** processo de um gás ideal, mesmo que o volume mude.

### Calor específico molar a pressão constante
A pressão constante, parte do calor sai como trabalho, $W = p\Delta V = nR\Delta T$. Pela primeira lei, $nC_p\Delta T = nC_V\Delta T + nR\Delta T$, e então
$$C_p = C_V + R.$$
Para o gás monoatômico, $C_p = \tfrac{5}{2}R \approx 20{,}8\ \text{J/(mol·K)}$.

### Exemplo
Aquecer 2,0 mol de hélio em 50 K a pressão constante exige $Q = 2{,}0 \times 20{,}8 \times 50 \approx 2{,}08\ \text{kJ}$. Desses, $\Delta E_{\text{int}} = 2{,}0 \times 12{,}5 \times 50 = 1{,}25\ \text{kJ}$ ficam no gás e $W = 2{,}0 \times 8{,}31 \times 50 \approx 0{,}83\ \text{kJ}$ saem como trabalho de expansão.

**Armadilha comum:** usar $nC_p\Delta T$ para a variação de energia interna quando o processo é a pressão constante. A energia interna sempre varia $nC_V\Delta T$; $C_p$ entra no **calor** do processo isobárico.

No experimento, aqueça o gás a volume constante e divida $Q$ por $n\Delta T$; depois faça um processo isobárico e compare a razão $Q/(n\Delta T)$ obtida.`,
      experiments: [
        { kind: "sim", id: "processos-pv", scenario: "isocorica", note: "A volume constante, Q/(nΔT) dá C_V; compare com 3R/2." },
        { kind: "sim", id: "processos-pv", scenario: "ciclo", note: "No trecho isobárico, compare Q com ΔU e W e obtenha C_p = C_V + R." },
      ],
    },
    "19-9": {
      text: String.raw`Moléculas diatômicas e poliatômicas podem guardar energia de outras formas além da translação: girando e vibrando. Por isso seus calores específicos são maiores que $\tfrac{3}{2}R$.

### O teorema da equipartição
Maxwell e Boltzmann mostraram que, no equilíbrio, **cada grau de liberdade** (cada maneira independente de armazenar energia que entra ao quadrado na energia) recebe, em média, $\tfrac{1}{2}kT$ por molécula, ou $\tfrac{1}{2}RT$ por mol. Com $f$ graus de liberdade:
$$E_{\text{int}} = \frac{f}{2}\,nRT, \qquad C_V = \frac{f}{2}R, \qquad C_p = \left(\frac{f}{2} + 1\right)R, \qquad \gamma = \frac{C_p}{C_V} = 1 + \frac{2}{f}.$$

### Contando os graus
- **Monoatômico** (He, Ar): 3 de translação; $f = 3$, $C_V = 1{,}5R$, $\gamma = 5/3 \approx 1{,}67$.
- **Diatômico** (N₂, O₂): 3 de translação + 2 de rotação (a rotação em torno do eixo da molécula não conta, pois o momento de inércia é desprezível); $f = 5$, $C_V = 2{,}5R$, $\gamma = 1{,}4$.
- **Poliatômico não linear** (CH₄, H₂O): 3 + 3 rotações; $f = 6$, $C_V = 3R$, $\gamma \approx 1{,}33$.
Medidas à temperatura ambiente confirmam bem esses valores. As vibrações ficam de fora; a seção 19-10 explica por quê.

### Exemplo
Ar (quase só N₂ e O₂) num quarto de 50 m³ a 300 K e 101 kPa tem $nRT = pV \approx 5{,}1\times10^6\ \text{J}$, logo $E_{\text{int}} = \tfrac{5}{2}pV \approx 12{,}6\ \text{MJ}$. Aquecer esse ar em 5 K a volume constante custa $\tfrac{5}{2}nR\Delta T = 2{,}5 \times (5{,}1\times10^6/300) \times 5 \approx 0{,}21\ \text{MJ}$.

### Onde $\gamma$ aparece
$\gamma$ governa a expansão adiabática (seção 19-11) e a velocidade do som, $v = \sqrt{\gamma RT/M}$ (seção 17-3).

**Armadilha comum:** atribuir $\tfrac{1}{2}kT$ a cada átomo, em vez de a cada grau de liberdade da molécula.

No experimento, troque o gás monoatômico pelo diatômico no aquecimento a volume constante e confira que o calor necessário passa de $\tfrac{3}{2}R$ para $\tfrac{5}{2}R$ por mol e por kelvin.`,
      experiments: [
        { kind: "sim", id: "processos-pv", scenario: "isocorica", params: { gamma: 1.4 }, note: "Gás diatômico a volume constante: confira C_V = 5R/2 e compare com o monoatômico." },
        { kind: "sim", id: "tubo-kundt", scenario: "helio", note: "A velocidade do som no hélio revela γ = 5/3 de um gás monoatômico." },
      ],
    },
    "19-10": {
      text: String.raw`A equipartição prevê que uma molécula diatômica também deveria ter graus de liberdade de **vibração** (energia cinética e potencial da "mola" entre os átomos), o que daria $C_V = \tfrac{7}{2}R$. À temperatura ambiente, porém, mede-se $\tfrac{5}{2}R$. E em baixas temperaturas o hidrogênio tem só $\tfrac{3}{2}R$, como se nem girasse. A física clássica não explica isso.

### O que a mecânica quântica diz
A energia de rotação e de vibração de uma molécula é **quantizada**: só pode assumir valores discretos, com um espaçamento mínimo $\Delta E$ entre o estado fundamental e o primeiro excitado. Se a energia térmica típica $kT$ for muito menor que $\Delta E$, as colisões quase nunca conseguem excitar aquele movimento; a probabilidade é da ordem do fator de Boltzmann $e^{-\Delta E/kT}$. O grau de liberdade fica "congelado" e não contribui para $C_V$.

### O caso do hidrogênio
O gráfico de $C_V/R$ do H₂ contra $T$ mostra degraus:
- abaixo de cerca de 80 K: $\tfrac{3}{2}$ (só translação);
- à temperatura ambiente: $\tfrac{5}{2}$ (rotações "descongeladas");
- acima de alguns milhares de kelvin: aproxima-se de $\tfrac{7}{2}$ (vibrações ativas), antes de a molécula se dissociar.

### Exemplo
O quantum de vibração do H₂ é de cerca de 0,5 eV, enquanto $kT$ a 300 K vale 0,026 eV. O fator de Boltzmann é $e^{-0{,}5/0{,}026} \approx e^{-19} \approx 5\times10^{-9}$: praticamente nenhuma molécula vibra. Já a 3000 K, $kT \approx 0{,}26\ \text{eV}$ e o fator sobe para cerca de 0,15.

O mesmo mecanismo explica por que o calor específico dos sólidos cai a zero em baixas temperaturas (modelo de Einstein), em vez de ficar em $3R$.

**Armadilha comum:** pensar que a equipartição está errada. Ela vale no limite em que $kT$ é muito maior que o espaçamento dos níveis; o erro é aplicá-la a graus de liberdade cujos níveis estão muito separados.

No experimento, veja osciladores quânticos trocando quanta ao acaso num sistema "frio" (poucos quanta por oscilador): quase todos ficam no nível fundamental, que é o congelamento de um grau de liberdade.`,
      experiments: [
        { kind: "sim", id: "boltzmann-dois-gases", scenario: "temperatura", note: "Com kT pequeno perto do quantum ε, quase todos os osciladores ficam no fundamental; aumente q̄ e veja o limite clássico." },
        { kind: "sim", id: "boltzmann-dois-gases", scenario: "boltzmann", note: "Veja a ocupação dos níveis quantizados convergir para o fator de Boltzmann e^(−E/kT)." },
      ],
    },
    "19-11": {
      text: String.raw`Num processo **adiabático** não há troca de calor ($Q = 0$): por isolamento ou porque é rápido demais, como na compressão do ar num motor Diesel ou na expansão de uma onda sonora.

### A relação $pV^\gamma$ constante
Para um passo infinitesimal de um gás ideal, a primeira lei com $Q = 0$ dá $nC_V\,dT = -p\,dV$. Diferenciando $pV = nRT$ obtemos $p\,dV + V\,dp = nR\,dT$. Eliminando $dT$ e usando $R = C_p - C_V$ e $\gamma = C_p/C_V$:
$$\frac{dp}{p} + \gamma\frac{dV}{V} = 0 \quad\Rightarrow\quad pV^\gamma = \text{constante}.$$
Combinando com $pV = nRT$:
$$TV^{\gamma-1} = \text{constante}.$$
No diagrama pV, a adiabática é **mais inclinada** que a isoterma que passa pelo mesmo ponto, porque além do volume a temperatura também muda.

### Exemplo
Ar ($\gamma = 1{,}4$) a 300 K e 1,0 atm comprimido rapidamente a um décimo do volume, como num motor Diesel:
$$T_f = 300 \times 10^{0{,}4} \approx 754\ \text{K} \;(481\ °\text{C}), \qquad p_f = 1{,}0 \times 10^{1{,}4} \approx 25\ \text{atm}.$$
Essa temperatura basta para inflamar o diesel injetado, sem vela. Pelo caminho inverso, o ar que sobe numa montanha se expande e esfria.

### Expansão livre: um contraexemplo
A expansão livre (seção 18-11) também tem $Q = 0$, mas o gás não realiza trabalho e sua temperatura **não** muda. As relações acima valem só para processos lentos o bastante para o gás estar em equilíbrio a cada instante (quase estáticos), em que o gás empurra um pistão.

**Armadilha comum:** usar $pV = $ constante para uma compressão rápida. Isso é a isoterma; numa compressão adiabática a pressão sobe mais, porque o gás esquenta.

No experimento, comprima o gás adiabaticamente no diagrama pV e compare com a isoterma tracejada; depois comprima o gás molecular com o pistão sem trocar calor e veja a temperatura subir (no gás 2D, $\gamma = 2$ e $TA$ fica constante).`,
      experiments: [
        { kind: "sim", id: "processos-pv", scenario: "adiabatica", note: "Compressão adiabática: confira pV^γ constante e a subida da temperatura." },
        { kind: "sim", id: "gas-ideal", scenario: "adiabatica", note: "Comprima o gás molecular com o pistão e veja T·A constante, a adiabática do gás 2D." },
        { kind: "sim", id: "processos-pv", scenario: "comparar", note: "Isotérmica × adiabática a partir do mesmo estado: compare inclinações e trabalhos." },
      ],
    },
  },
};
