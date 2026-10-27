import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 31,
  intro: String.raw`Um capacitor carregado ligado a um indutor não descarrega simplesmente: a energia passa do campo elétrico para o magnético e volta, numa oscilação que obedece à mesma equação do sistema massa-mola. Esse **circuito LC** é o coração de rádios, filtros e osciladores. Neste capítulo estudamos essas oscilações, o amortecimento causado pela resistência e o que acontece quando uma fonte de **corrente alternada** força o circuito a oscilar numa frequência escolhida: reatâncias, impedância, ressonância, fator de potência e, por fim, o transformador, que explica por que a energia elétrica é distribuída em corrente alternada.`,
  sections: {
    "31-1": {
      text: String.raw`### Oscilações em um Circuito LC: Análise Qualitativa
Ligue um capacitor carregado com $Q$ a um indutor $L$, sem resistência. No início, toda a energia está no campo elétrico do capacitor. Ele começa a descarregar, mas o indutor impede que a corrente cresça de repente. A corrente aumenta aos poucos, e a energia vai passando para o campo magnético do indutor. Quando o capacitor fica descarregado, a corrente é máxima e toda a energia é magnética. O indutor então **mantém** a corrente, que carrega o capacitor com a polaridade invertida, até a corrente parar. Depois o processo se repete no sentido contrário. Carga e corrente oscilam indefinidamente, defasadas de um quarto de período.

### Analogia Eletromecânica
O circuito LC é o sistema massa-mola escrito com outras letras. A energia elétrica $q^2/2C$ corresponde à energia potencial elástica $kx^2/2$, e a magnética $Li^2/2$, à cinética $mv^2/2$. A correspondência é: carga $q \leftrightarrow x$, corrente $i \leftrightarrow v$, indutância $L \leftrightarrow m$ (a "inércia" da corrente) e $1/C \leftrightarrow k$ (a "rigidez"). Como no oscilador mecânico $\omega = \sqrt{k/m}$, aqui $\omega = 1/\sqrt{LC}$.

### Oscilações em um Circuito LC: Análise Quantitativa
A energia total $U = q^2/2C + Li^2/2$ é constante. Derivando e usando $i = dq/dt$:

$$L\,\frac{d^2q}{dt^2} + \frac{q}{C} = 0 \quad\Rightarrow\quad q(t) = Q\cos(\omega t + \phi), \qquad \omega = \frac{1}{\sqrt{LC}}.$$

A corrente é $i = -\omega Q\sin(\omega t + \phi)$, com amplitude $I = \omega Q$. As energias elétrica e magnética oscilam com o **dobro** da frequência e somam sempre $Q^2/2C$.

Exemplo: $L = 1{,}0$ H e $C = 1000\ \mu\mathrm F$ dão $\omega \approx 31{,}6$ rad/s, frequência de $5{,}0$ Hz e período de $0{,}20$ s. Carregado a $6{,}0$ V, o capacitor tem $Q = 6{,}0$ mC e $U = 18$ mJ; a corrente máxima é $I = \omega Q \approx 0{,}19$ A, e de fato $\tfrac12LI^2 = 18$ mJ. Em rádios, com nH e pF, a frequência chega a centenas de MHz.

Armadilha: achar que, quando o capacitor fica descarregado, a corrente também para. É exatamente o contrário: nesse instante a corrente é máxima.

No experimento, solte o circuito LC com o capacitor carregado e acompanhe as barras de energia passando de um campo para o outro; meça o período e compare com $2\pi\sqrt{LC}$.`,
      experiments: [
        { kind: "sim", id: "rl-lc", scenario: "lc", note: "Veja a energia ir do capacitor ao indutor e voltar; meça o período." },
        { kind: "sim", id: "rl-lc", scenario: "lc", params: { C: 250 }, note: "Reduza C a um quarto e verifique que a frequência dobra." },
        { kind: "sim", id: "massa-mola", scenario: "livre", note: "Compare com o oscilador massa-mola: x ↔ q, v ↔ i, m ↔ L, k ↔ 1/C." },
      ],
    },
    "31-2": {
      text: String.raw`Todo circuito real tem resistência, e o resistor transforma parte da energia em calor a cada ciclo. Num **circuito RLC série** sem fonte, a energia diminui à taxa $dU/dt = -i^2R$, o que leva a

$$L\,\frac{d^2q}{dt^2} + R\,\frac{dq}{dt} + \frac{q}{C} = 0,$$

a mesma equação do oscilador mecânico com amortecimento viscoso, com $R$ no papel do coeficiente de atrito. Para resistência pequena, a solução é

$$q(t) = Q\,e^{-Rt/2L}\cos(\omega' t + \phi), \qquad \omega' = \sqrt{\omega^2 - \left(\frac{R}{2L}\right)^2}.$$

A carga oscila dentro de um envelope que decai exponencialmente, e a energia decai como $e^{-Rt/L}$. Se o amortecimento é fraco, $\omega' \approx \omega$.

Aumentando $R$, o decaimento fica mais rápido e as oscilações, mais lentas. Quando $R = 2\sqrt{L/C}$, chega-se ao **amortecimento crítico**: o capacitor descarrega no menor tempo possível, sem oscilar. Acima disso, o circuito é **superamortecido** e descarrega lentamente, também sem oscilar.

Exemplo: com $L = 1{,}0$ H, $C = 1000\ \mu\mathrm F$ e $R = 5{,}0\ \Omega$, o envelope cai com $R/2L = 2{,}5$ s⁻¹ e reduz-se à metade a cada $\ln2/2{,}5 \approx 0{,}28$ s, pouco mais de um período. A resistência crítica é $2\sqrt{1{,}0/10^{-3}} \approx 63\ \Omega$.

Armadilha: pensar que a energia "some" no amortecimento. Ela é convertida em energia térmica no resistor, e a soma das energias armazenada e dissipada se conserva.

No experimento, compare o circuito com $R$ pequeno, que oscila amortecido, com o caso crítico; meça o tempo para o envelope cair à metade e confira $2L\ln2/R$.`,
      experiments: [
        { kind: "sim", id: "rl-lc", scenario: "rlc", note: "Meça o decaimento do envelope e compare com e^(−Rt/2L)." },
        { kind: "sim", id: "rl-lc", scenario: "critico", note: "Com R = 2√(L/C), o capacitor descarrega sem oscilar." },
        { kind: "sim", id: "rl-lc", scenario: "rlc", params: { R: 200 }, note: "Acima do crítico, veja a descarga lenta e superamortecida." },
      ],
    },
    "31-3": {
      text: String.raw`### Corrente Alternada
A energia elétrica das tomadas é distribuída em **corrente alternada** (CA): a fem dos geradores varia como $\varepsilon = \varepsilon_m\sin\omega_d t$, porque surge de uma bobina girando num campo magnético (seção 30-1). No Brasil, a frequência é $60$ Hz. A grande vantagem da CA é que a tensão pode ser elevada e reduzida por transformadores (seção 31-6).

### Oscilações Forçadas
Ligado a uma fonte alternada, um circuito oscila com a frequência **da fonte**, $\omega_d$, e não com a sua frequência natural. Para entender o circuito RLC, primeiro olhamos cada elemento sozinho ligado à fonte, com corrente $i = I\sin\omega_d t$.

**Carga resistiva.** $V_R = IR$, e tensão e corrente estão **em fase**.

**Carga capacitiva.** A amplitude da tensão é $V_C = IX_C$, com a **reatância capacitiva**

$$X_C = \frac{1}{\omega_d C}.$$

A corrente está **adiantada** de $90°$ em relação à tensão: o capacitor precisa receber carga antes de a tensão subir.

**Carga indutiva.** $V_L = IX_L$, com a **reatância indutiva**

$$X_L = \omega_d L,$$

e a corrente está **atrasada** de $90°$: o indutor resiste às variações de corrente. Um mnemônico é "CIVIL": no **C**, **I** vem antes de **V**; no **L**, **V** vem antes de **I**.

As reatâncias são medidas em ohms, mas dependem da frequência em sentidos opostos. Exemplo: um capacitor de $1{,}0\ \mu\mathrm F$ tem $X_C \approx 2{,}7$ kΩ a $60$ Hz e $27\ \Omega$ a $6$ kHz; um indutor de $10$ mH tem $3{,}8\ \Omega$ a $60$ Hz e $377\ \Omega$ a $6$ kHz. Em alta frequência, o capacitor deixa a corrente passar e o indutor a bloqueia; em baixa, o contrário. Os **fasores**, vetores girando com velocidade angular $\omega_d$ cujas projeções dão os valores instantâneos, tornam essas defasagens visíveis.

Armadilha: dizer que no capacitor e no indutor ideais há dissipação como num resistor. As reatâncias limitam a corrente, mas a energia só é guardada e devolvida a cada ciclo.

No experimento, observe os fasores e as curvas de tensão e corrente; ajuste a frequência para que o capacitor domine e depois o indutor, e veja a defasagem passar de $-90°$ a $+90°$.`,
      experiments: [
        { kind: "sim", id: "rlc-ca", scenario: "fasores", params: { f: 50 }, note: "Em baixa frequência o capacitor domina: corrente adiantada da tensão." },
        { kind: "sim", id: "rlc-ca", scenario: "fasores", params: { f: 50000 }, note: "Em alta frequência o indutor domina: corrente atrasada da tensão." },
        { kind: "sim", id: "multimetro-osciloscopio", scenario: "rc", note: "Meça a defasagem entre tensão e corrente num RC com o osciloscópio." },
        { kind: "sim", id: "faraday-lenz", scenario: "gerador", note: "Veja a fem senoidal de uma bobina girando num campo." },
      ],
    },
    "31-4": {
      text: String.raw`Com $R$, $L$ e $C$ em série com a fonte $\varepsilon_m\sin\omega_d t$, a corrente é a mesma em todos os elementos, $i = I\sin(\omega_d t - \phi)$. No diagrama de fasores, $V_R$ fica alinhado com a corrente, $V_L$ adiantado de $90°$ e $V_C$ atrasado de $90°$. Os dois últimos estão em oposição e se subtraem. Somando os fasores, $\varepsilon_m^2 = V_R^2 + (V_L - V_C)^2$, e

$$I = \frac{\varepsilon_m}{Z}, \qquad Z = \sqrt{R^2 + (X_L - X_C)^2}, \qquad \tan\phi = \frac{X_L - X_C}{R}.$$

A grandeza $Z$ é a **impedância**. Se $X_L > X_C$, o circuito é mais **indutivo**, e a corrente se atrasa ($\phi > 0$); se $X_C > X_L$, é mais **capacitivo**, e a corrente se adianta ($\phi < 0$).

### Ressonância
A corrente é máxima quando $X_L = X_C$, isto é, quando a frequência da fonte iguala a frequência natural do circuito:

$$\omega_d = \omega = \frac{1}{\sqrt{LC}}.$$

Na ressonância, $Z = R$, $\phi = 0$ e $I = \varepsilon_m/R$. A largura da curva de ressonância depende de $R$: quanto menor a resistência, mais estreito e alto o pico, o que se mede pelo **fator de qualidade** $Q = (1/R)\sqrt{L/C}$. É assim que um rádio sintoniza uma estação e rejeita as vizinhas.

Exemplo: $R = 20\ \Omega$, $L = 10$ mH, $C = 1{,}0\ \mu\mathrm F$ e $\varepsilon_m = 10$ V. A ressonância ocorre em $f_0 = 1/(2\pi\sqrt{LC}) \approx 1{,}59$ kHz, com $I = 0{,}50$ A e $Q = 5$. A $1{,}0$ kHz, $X_L = 63\ \Omega$ e $X_C = 159\ \Omega$; $Z \approx 99\ \Omega$, $I \approx 0{,}10$ A e $\phi \approx -78°$ (capacitivo).

Armadilha: somar as amplitudes das tensões como números. Na ressonância, $V_L$ e $V_C$ podem ser muito maiores que a própria fem, mas se cancelam.

No experimento, varra a frequência e trace a curva de ressonância; aumente $R$ e veja o pico baixar e alargar.`,
      experiments: [
        { kind: "sim", id: "rlc-ca", scenario: "ressonancia", note: "Varra a frequência, localize f₀ e meça a largura do pico." },
        { kind: "sim", id: "rlc-ca", scenario: "ressonancia", params: { R: 100 }, note: "Com R maior, o pico fica mais baixo e mais largo (Q menor)." },
        { kind: "sim", id: "rlc-ca", scenario: "filtros", note: "Use o RLC como filtro e leia o diagrama de Bode." },
        { kind: "desafio", id: "sintonia-ressonancia", note: "Ajuste o circuito para ressoar na frequência pedida." },
        { kind: "desafio", id: "radio-rlc", note: "Sintonize uma estação de rádio escolhendo L e C." },
        { kind: "pratica", id: "exp3-rlc", note: "Levante a curva de ressonância de um RLC na bancada." },
      ],
    },
    "31-5": {
      text: String.raw`Num circuito de CA, a potência instantânea oscila, e o que interessa é a **média** num ciclo. Capacitores e indutores ideais devolvem a cada ciclo tudo o que recebem; só o resistor dissipa. Com $i = I\sin(\omega_d t - \phi)$, a média de $\sin^2$ é $1/2$, e

$$P_{\text{méd}} = \frac12 I^2R = I_{\text{rms}}^2R.$$

Define-se o **valor eficaz** (rms, de *root mean square*) de uma grandeza senoidal como a amplitude dividida por $\sqrt2$: $I_{\text{rms}} = I/\sqrt2$, $V_{\text{rms}} = V/\sqrt2$, $\varepsilon_{\text{rms}} = \varepsilon_m/\sqrt2$. Com esses valores, as fórmulas de potência têm a mesma forma das de corrente contínua. Os multímetros de CA e as tensões de tomada indicam valores eficazes: os $127$ V de uma tomada correspondem a um pico de cerca de $180$ V, e os $220$ V, a $311$ V.

Usando $R = Z\cos\phi$, a potência média também se escreve

$$P_{\text{méd}} = \varepsilon_{\text{rms}}\,I_{\text{rms}}\cos\phi,$$

onde $\cos\phi$ é o **fator de potência**. Na ressonância ele vale $1$ e a transferência é máxima. Um motor (carga indutiva) com fator de potência baixo exige mais corrente da rede para a mesma potência útil, aquecendo os fios; por isso as concessionárias cobram de indústrias com fator de potência baixo, e se instalam bancos de capacitores para corrigi-lo.

Exemplo: no circuito da seção 31-4 a $1{,}0$ kHz, $I \approx 0{,}10$ A e $\cos\phi = R/Z \approx 0{,}20$; a potência média é $\tfrac12\cdot10\cdot0{,}10\cdot0{,}20 \approx 0{,}10$ W, contra $2{,}5$ W na ressonância. Um chuveiro de $5{,}5$ kW em $220$ V (carga resistiva) puxa $25$ A eficazes.

Armadilha: calcular a potência com os valores de pico, sem o fator $1/2$, ou multiplicar tensão e corrente eficazes esquecendo o fator de potência.

No experimento, compare um multímetro true RMS com um de média para diferentes formas de onda; no RLC, acompanhe a potência média enquanto varre a frequência pela ressonância.`,
      experiments: [
        { kind: "sim", id: "multimetro-osciloscopio", scenario: "rms", note: "Compare valor de pico e valor eficaz, e o multímetro true RMS com o de média." },
        { kind: "sim", id: "rlc-ca", scenario: "ressonancia", note: "Observe a potência média e o fator de potência ao varrer a frequência." },
        { kind: "sim", id: "consumo-energia", scenario: "chuveiro", note: "Calcule a corrente eficaz e a energia de um chuveiro em 127 V e 220 V." },
      ],
    },
    "31-6": {
      text: String.raw`Para transmitir uma potência $P$ por uma linha de resistência $R$, a corrente é $I = P/V$ e a perda é $I^2R = P^2R/V^2$. Quanto **maior** a tensão, menor a perda. Mas tensões altas são perigosas no consumo. A solução é o **transformador**: elevar a tensão na usina, transmitir, e baixá-la perto do consumidor.

Um transformador tem duas bobinas, o **primário** ($N_p$ espiras) e o **secundário** ($N_s$ espiras), enroladas num mesmo núcleo de ferro, que conduz o fluxo de uma para a outra (indução mútua, seção 30-9). A tensão alternada no primário produz um fluxo alternado, e o mesmo fluxo induz em cada espira a mesma fem. No transformador ideal (sem perdas e sem fuga de fluxo):

$$V_s = V_p\,\frac{N_s}{N_p}, \qquad I_s = I_p\,\frac{N_p}{N_s}, \qquad V_pI_p = V_sI_s.$$

Se $N_s > N_p$, ele **eleva** a tensão e reduz a corrente; se $N_s < N_p$, **abaixa**. A potência se conserva. Visto do primário, um resistor $R$ no secundário parece ter resistência $R_{\text{eq}} = (N_p/N_s)^2R$, o que permite **casar impedâncias**, por exemplo entre um amplificador e um alto-falante.

Exemplo: transmitir $1{,}0$ MW por uma linha de $10\ \Omega$. A $10$ kV, a corrente é $100$ A e a perda, $100$ kW ($10\%$). A $500$ kV, a corrente cai para $2{,}0$ A e a perda, para $40$ W. Na bancada, $500$ espiras no primário e $250$ no secundário, com $12$ V, dão $6{,}0$ V; com uma carga de $100\ \Omega$, $I_s = 60$ mA e $I_p \approx 30$ mA.

Transformadores reais têm perdas no cobre ($I^2R$ dos enrolamentos) e no núcleo (correntes parasitas e histerese), e uma pequena corrente de magnetização mesmo sem carga. Os bons chegam a $99\%$ de rendimento. Um transformador **não funciona com corrente contínua**: sem variação de fluxo, não há indução.

Armadilha: achar que o transformador elevador "cria" energia por aumentar a tensão. A corrente diminui na mesma proporção.

No experimento, mude o número de espiras e confira a relação de tensões; ligue uma carga e compare as potências no primário e no secundário e o rendimento.`,
      experiments: [
        { kind: "sim", id: "transformador", scenario: "transformador", note: "Confira V₂/V₁ = N₂/N₁ e compare as potências de entrada e saída." },
        { kind: "sim", id: "transformador", scenario: "transformador", params: { N2: 1000 }, note: "Transforme em elevador e veja a corrente no secundário diminuir." },
        { kind: "sim", id: "transformador", scenario: "nucleo", note: "Compare núcleo de ar, de ferro laminado e maciço." },
        { kind: "pratica", id: "exp3-transformador", note: "Meça a relação de tensões e o rendimento de um transformador." },
        { kind: "sim", id: "motores-geradores", scenario: "trifasico", note: "Veja o gerador trifásico usado na geração e distribuição." },
      ],
    },
  },
};
