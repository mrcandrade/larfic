/** Modo engenharia: carga e descarga do capacitor, balanço de energia e a solução exata por trechos. */
export const derivation = String.raw`### 1. Hipóteses
- Fonte ideal de tensão $V_{fonte}(t)$: constante $V_0$ (chave em A), zero (chave em B, curto) ou onda quadrada entre $V_0$ e $0$.
- Resistor ôhmico $R$ e capacitor ideal $C$ (sem fuga, sem resistência série); fios ideais.
- Modelo de parâmetros concentrados: a corrente é a mesma em todo o laço.

### 2. Equação do circuito
A lei das malhas, percorrendo fonte, resistor e capacitor, dá $V_{fonte} - R\,i - V_C = 0$. A corrente carrega o capacitor: $i = dq/dt = C\,dV_C/dt$. Juntando:
$$RC\,\frac{dV_C}{dt} + V_C = V_{fonte}(t), \qquad \tau = RC.$$
A constante de tempo tem unidade de segundo: $\Omega\cdot\text{F} = (\text{V/A})(\text{C/V}) = \text{C/A} = \text{s}$.

### 3. Solução com fonte constante
Com $V_{fonte} = V_s$ constante, a equação é linear de 1ª ordem e separável:
$$\frac{dV_C}{V_s - V_C} = \frac{dt}{\tau} \;\Rightarrow\; V_C(t) = V_s + \big(V_C(0) - V_s\big)\,e^{-t/\tau}.$$
- **Carga** a partir de zero ($V_s = V_0$): $V_C = V_0\,(1 - e^{-t/\tau})$; em $t = \tau$ o capacitor atinge $1 - e^{-1} \approx 63{,}2\%$ de $V_0$, e em $5\tau$, mais de $99\%$.
- **Descarga** ($V_s = 0$): $V_C = V_0\,e^{-t/\tau}$.
- Corrente: $i = (V_s - V_C)/R$, que salta no instante da comutação e decai com a mesma constante $\tau$. O tempo para atingir uma fração $f$ da carga final é $t = -\tau\ln(1 - f)$.

### 4. Balanço de energia na carga completa
O trabalho da fonte, a energia dissipada no resistor e a energia armazenada são
$$W_{fonte} = \int_0^\infty V_0\,i\,dt = V_0\,q_{final} = C V_0^2,$$
$$W_R = \int_0^\infty R\,i^2\,dt = \int_0^\infty \frac{V_0^2}{R}\,e^{-2t/\tau}\,dt = \frac{V_0^2}{R}\,\frac{\tau}{2} = \tfrac12 C V_0^2,$$
$$U_C = \tfrac12 C V_0^2.$$
Metade do trabalho da fonte sempre vira calor, qualquer que seja $R$: um resistor menor dissipa com corrente maior por menos tempo.

### 5. Onda quadrada
Com a fonte alternando entre $V_0$ e $0$ a cada meio período $T/2$, a solução da seção 3 vale em cada meio período, partindo do valor deixado pelo anterior. Em regime permanente o capacitor oscila entre $V_{min}$ e $V_{max}$ com $V_{max} = V_0 + (V_{min} - V_0)\,e^{-T/(2\tau)}$ e $V_{min} = V_{max}\,e^{-T/(2\tau)}$, ou seja,
$$V_{max} = \frac{V_0}{1 + e^{-T/(2\tau)}}, \qquad V_{min} = V_0 - V_{max}.$$
Se $\tau \ll T$, o sinal vira uma sequência de cargas e descargas completas; se $\tau \gg T$, o circuito funciona como integrador (filtro passa-baixa) e $V_C$ fica perto da média $V_0/2$ com uma pequena ondulação triangular.

### 6. Método numérico (solução exata por trechos)
Nada é integrado de forma aproximada. Em cada passo de $0{,}1$ ms:
- o intervalo é quebrado nas bordas da onda quadrada, para que a fonte seja constante em cada pedaço;
- em cada pedaço de duração $\Delta t$ aplica-se a solução fechada $V_C \leftarrow V_s + (V_C - V_s)\,e^{-\Delta t/\tau}$;
- as energias também são integradas em forma fechada: com $d_0 = V_s - V_C$ no início do pedaço, $\Delta W_R = \dfrac{d_0^2}{R}\,\dfrac{\tau}{2}\left(1 - e^{-2\Delta t/\tau}\right)$ e $\Delta W_{fonte} = V_s\,C\,\Delta V_C$.

Por isso o resultado não depende do passo, e a identidade $W_{fonte} = \Delta U_C + W_R$ vale até o arredondamento. O osciloscópio dispara a cada comutação da chave (ou a cada número inteiro de períodos da onda quadrada), como um disparo por borda.`;
