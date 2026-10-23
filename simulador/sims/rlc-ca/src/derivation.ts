/** Modo engenharia: circuito RLC em corrente alternada, fasores, ressonância e o transiente por MNA. */
export const derivation = String.raw`### 1. Hipóteses
- Gerador senoidal $v_s(t) = V_p\sin\omega t$, $\omega = 2\pi f$, com resistência interna $R_g$.
- Resistor, indutor e capacitor ideais e lineares (indutor sem resistência do fio, capacitor sem fuga), parâmetros concentrados.

### 2. Equações no domínio do tempo
**Série**: a mesma corrente $i$ passa por todos; a lei das malhas dá
$$L\,\frac{di}{dt} + (R + R_g)\,i + \frac{1}{C}\int i\,dt = v_s(t).$$
Derivando, obtém-se um oscilador forçado: $L\ddot q + (R + R_g)\dot q + q/C = v_s$, com a carga $q$ no papel da posição, $L$ no da massa, $R$ no do atrito e $1/C$ no da rigidez.

**Paralelo**: a mesma tensão $v$ está sobre R, L e C; a lei dos nós dá $i = v/R + \frac{1}{L}\int v\,dt + C\,\dot v$.

### 3. Fasores
Em regime permanente todas as grandezas oscilam com a frequência da fonte. Representa-se cada uma por um número complexo $\hat X$ tal que $x(t) = \mathrm{Im}\big(\hat X e^{i\omega t}\big)$. Derivar no tempo vira multiplicar por $j\omega$ (usa-se $j$ para não confundir com a corrente), e as relações de cada elemento ficam algébricas:
$$\hat V_R = R\,\hat I, \qquad \hat V_L = j\omega L\,\hat I, \qquad \hat V_C = \frac{\hat I}{j\omega C}.$$
As impedâncias $Z_R = R$, $Z_L = jX_L$ e $Z_C = -jX_C$, com $X_L = \omega L$ e $X_C = 1/(\omega C)$, se combinam como resistências.

**Série**:
$$Z = R + R_g + j\left(\omega L - \frac{1}{\omega C}\right), \qquad |Z| = \sqrt{(R + R_g)^2 + (X_L - X_C)^2}, \qquad \tan\varphi = \frac{X_L - X_C}{R + R_g},$$
$$\hat I = \hat V_s/Z, \qquad I_p = V_p/|Z|.$$
**Paralelo**: $Y = \dfrac{1}{R} + \dfrac{1}{j\omega L} + j\omega C$, $Z = R_g + 1/Y$.

### 4. Ressonância
No série, $|Z|$ é mínima e a corrente é máxima quando $X_L = X_C$:
$$\omega_0 = \frac{1}{\sqrt{LC}}, \qquad f_0 = \frac{1}{2\pi\sqrt{LC}}.$$
Nesse ponto $Z = R + R_g$ é real, a corrente fica em fase com a fonte e as tensões em L e C são iguais e opostas, cada uma $Q$ vezes maior que a da fonte. O fator de qualidade e a banda de meia potência são
$$Q_{serie} = \frac{1}{R + R_g}\sqrt{\frac{L}{C}} = \frac{\omega_0 L}{R + R_g}, \qquad \Delta f = \frac{f_0}{Q}.$$
No paralelo a admitância é mínima em $\omega_0$ (a impedância é máxima) e $Q_{paralelo} = R_{ef}\sqrt{C/L}$, com $R_{ef} = R\parallel R_g$ quando o gerador tem resistência interna.

### 5. Função de transferência e potência
A saída escolhida (tensão em R, L ou C) define $H(f) = \hat V_{saida}/\hat V_s$, mostrada em decibéis, $|H|_{dB} = 20\log_{10}|H|$. Tomando a saída no resistor tem-se um passa-faixa; no capacitor, um passa-baixa; no indutor, um passa-alta. A potência média entregue pela fonte é
$$\bar P = \frac{1}{T}\int_0^T v_s\,i\,dt = \tfrac12 V_p I_p\cos\varphi,$$
toda dissipada nos resistores, pois L e C só trocam energia com a fonte.

### 6. Método numérico: transiente integrado no tempo
Ao ligar a fonte com o circuito descarregado, a resposta é a solução particular (fasorial) mais a solução homogênea, que decai com $e^{-(R + R_g)t/(2L)}$ no série. Para mostrá-la a simulação resolve o circuito no tempo com análise nodal modificada:
- capacitor e indutor viram modelos companheiros da regra do trapézio: $i_n = \frac{2C}{h}(v_n - v_{n-1}) - i_{n-1}$ e $i_n = i_{n-1} + \frac{h}{2L}(v_n + v_{n-1})$;
- o primeiro passo usa Euler implícito, porque ainda não há corrente (ou tensão) anterior;
- a regra do trapézio é de 2ª ordem e A-estável e não dissipa energia artificialmente, de modo que um LC sem resistência oscila sem perder amplitude.

O tempo é mostrado em câmera lenta: cada segundo de animação avança $\text{ritmo}/f$ segundos físicos, isto é, um número fixo de ciclos da fonte, com passo físico $h = \text{ritmo}/(500 f)$. Com a opção já em regime permanente, o estado inicial é tirado dos fasores e não há transiente.`;
