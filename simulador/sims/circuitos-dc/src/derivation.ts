/** Modo engenharia: das leis de Kirchhoff ao solver nodal (MNA) usado pelo construtor de circuitos. */
export const derivation = String.raw`### 1. Hipóteses (modelo de parâmetros concentrados)
- As dimensões do circuito são muito menores que o comprimento de onda dos sinais: os campos ficam confinados nos componentes, e cada fio é uma região equipotencial (aproximação quase-estática).
- Cada componente é descrito só pela relação entre a tensão $v$ nos seus terminais e a corrente $i$ que o atravessa.
- Fios e amperímetros são resistores de $R_f = 10^{-4}\ \Omega$ (quase ideais); o voltímetro é um resistor de $10\ \text{M}\Omega$; a bateria é uma fonte ideal $\varepsilon$ em série com a resistência interna $r$; a lâmpada é um resistor ôhmico de valor fixo (sem aquecimento do filamento).

### 2. Leis de Kirchhoff
**Lei dos nós** (conservação da carga): em regime quase-estático não há acúmulo de carga num nó, logo
$$\sum_{k\,\in\,\text{nó}} i_k = 0.$$
**Lei das malhas** (campo eletrostático conservativo): como $\oint \vec E\cdot d\vec l = 0$ fora de regiões com fluxo magnético variável, a soma das quedas de tensão em qualquer laço fechado é nula:
$$\sum_{k\,\in\,\text{malha}} \Delta V_k = 0.$$
A lei das malhas é automaticamente satisfeita quando se atribui um potencial $v_n$ a cada nó e se escreve a tensão de cada ramo como diferença de potenciais.

### 3. Relações constitutivas
$$\text{resistor: } i = \frac{v_a - v_b}{R} \qquad \text{fonte: } v_a - v_b - r\,i = \varepsilon$$
$$\text{capacitor: } i = C\,\frac{dv}{dt} \qquad \text{indutor: } v = L\,\frac{di}{dt} \qquad \text{diodo: } i = I_s\left(e^{v/(n V_T)} - 1\right)$$
Para o diodo usa-se o modelo de Shockley com $I_s = 2{,}52\ \text{nA}$, $n = 1{,}75$ e $V_T = k_B T/e \approx 25{,}85\ \text{mV}$ a $300\ \text{K}$.

### 4. Método numérico: análise nodal modificada (MNA)
Escolhe-se um nó de referência (terra, $v_0 = 0$). Para cada outro nó escreve-se a lei dos nós com as correntes expressas pelos potenciais. Um resistor entre os nós $a$ e $b$ contribui com a condutância $G = 1/R$ na matriz:
$$G_{aa} \mathrel{+}= G,\quad G_{bb} \mathrel{+}= G,\quad G_{ab} \mathrel{-}= G,\quad G_{ba} \mathrel{-}= G.$$
Fontes de tensão não têm relação $i(v)$, então sua corrente vira uma incógnita extra e a equação da fonte vira uma linha extra. O sistema fica
$$\begin{pmatrix} G & B \\ B^{T} & -R_{int} \end{pmatrix}\begin{pmatrix} \mathbf v \\ \mathbf i_V \end{pmatrix} = \begin{pmatrix} \mathbf i_s \\ \boldsymbol\varepsilon \end{pmatrix},$$
em que $B$ tem $\pm 1$ nas posições dos terminais de cada fonte. A solução é obtida por eliminação gaussiana com pivotamento parcial. Se a matriz é singular (por exemplo, um laço só de fontes ideais), o app avisa que o circuito não tem solução.

### 5. Capacitores e indutores: modelo companheiro
Discretizando no tempo com passo $h$, a regra do trapézio aplicada a $i = C\,dv/dt$ dá
$$i_n = \frac{2C}{h}\,(v_n - v_{n-1}) - i_{n-1},$$
ou seja, um resistor de condutância $G_C = 2C/h$ em paralelo com uma fonte de corrente $G_C v_{n-1} + i_{n-1}$. Para o indutor, $v = L\,di/dt$ dá
$$i_n = i_{n-1} + \frac{h}{2L}\,(v_n + v_{n-1}),$$
um resistor de condutância $h/(2L)$ em paralelo com uma fonte $i_{n-1} + \frac{h}{2L} v_{n-1}$. A regra do trapézio é A-estável e não introduz amortecimento artificial: num circuito LC ideal a energia $\tfrac12 C v^2 + \tfrac12 L i^2$ se conserva. No primeiro passo depois de inserir um componente (quando $i_{n-1}$ ou $v_{n-1}$ ainda não existem) usa-se Euler implícito ($i_n = \frac{C}{h}(v_n - v_{n-1})$), que só precisa da tensão anterior.

### 6. Diodo: Newton–Raphson
A curva do diodo é linearizada em torno da estimativa $v_d$:
$$i \approx I_d + g_d\,(v - v_d), \qquad g_d = \frac{I_s}{n V_T}\,e^{v_d/(n V_T)},$$
isto é, uma condutância $g_d$ em paralelo com uma fonte $I_d - g_d v_d$. O sistema linear é resolvido, a estimativa é atualizada e o processo se repete até a variação dos potenciais ficar abaixo de $10^{-9}\ \text{V}$. Cada atualização é limitada a $0{,}5\ \text{V}$ para a exponencial não estourar.

### 7. Grandezas mostradas
Corrente e tensão de cada componente vêm da solução; a potência é $P = v\,i$ (para resistores, $P = R i^2$). A tensão nos terminais da bateria cai com a corrente: $V_{terminal} = \varepsilon - r\,i$, e em curto ($R_{ext} \to 0$) a corrente tende a $\varepsilon/r$. O passo de tempo é $h = 1$ ms.`;
