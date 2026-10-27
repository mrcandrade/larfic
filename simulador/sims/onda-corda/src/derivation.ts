/** Modo engenharia: equação de onda na corda, impedância, reflexão na emenda e o esquema de diferenças finitas. */
export const derivation = String.raw`### 1. Hipóteses
- Corda perfeitamente flexível, sob tensão $T$ uniforme, com densidade linear $\mu_1$ no primeiro trecho e $\mu_2$ no segundo.
- Deslocamentos transversais pequenos: a inclinação $\partial y/\partial x$ é muito menor que 1, de modo que a tensão não muda e cada ponto só se move na vertical.
- Sem gravidade, sem rigidez de flexão e sem atrito com o ar.

### 2. Equação de onda
Num pedaço de comprimento $\Delta x$, a tensão puxa nas duas pontas ao longo da corda. A força vertical resultante é $T\sin\theta(x + \Delta x) - T\sin\theta(x)$, e para ângulos pequenos $\sin\theta \approx \tan\theta = \partial y/\partial x$. A segunda lei de Newton dá
$$\mu\,\Delta x\,\frac{\partial^2 y}{\partial t^2} = T\left[\frac{\partial y}{\partial x}\Big|_{x+\Delta x} - \frac{\partial y}{\partial x}\Big|_{x}\right] \;\Rightarrow\; \frac{\partial^2 y}{\partial t^2} = v^2\,\frac{\partial^2 y}{\partial x^2}, \qquad v = \sqrt{\frac{T}{\mu}}.$$
A solução geral (de d'Alembert) é $y = f(x - vt) + g(x + vt)$: pulsos que viajam sem mudar de forma para a direita e para a esquerda.

### 3. Impedância
Para uma onda que vai para a direita, $y = f(x - vt)$, a força vertical que a parte da esquerda exerce sobre a da direita é
$$F_y = -T\,\frac{\partial y}{\partial x} = \frac{T}{v}\,\frac{\partial y}{\partial t} = Z\,\frac{\partial y}{\partial t}, \qquad Z = \frac{T}{v} = \sqrt{T\mu} = \mu v.$$
A corda se comporta, para quem a puxa, como um amortecedor de coeficiente $Z$. A potência transportada é $P = Z\,(\partial y/\partial t)^2$, proporcional a $Z A^2$ para uma amplitude $A$.

### 4. Reflexão e transmissão na emenda
Uma onda incidente $f(x - v_1 t)$ chega à emenda em $x = 0$ e gera uma refletida $R\,f(-x - v_1 t)$ e uma transmitida. Duas condições valem na emenda, que não tem massa:
- **continuidade** do deslocamento: a corda não se rompe;
- **continuidade** da força vertical $T\,\partial y/\partial x$: senão a emenda teria aceleração infinita.

Resolvendo, para as amplitudes de deslocamento:
$$R = \frac{Z_1 - Z_2}{Z_1 + Z_2}, \qquad \tau = \frac{2Z_1}{Z_1 + Z_2} = 1 + R.$$
Indo para uma corda mais pesada ($Z_2 > Z_1$) o pulso refletido volta invertido; para uma mais leve, volta do mesmo lado e o transmitido é maior que o incidente. A energia se conserva: $Z_1 = Z_1 R^2 + Z_2\tau^2$.

### 5. Pontas
- **Fixa** ($y = 0$): equivale a $Z_2 \to \infty$, logo $R = -1$.
- **Livre** (anel sem massa numa haste sem atrito, $\partial y/\partial x = 0$): equivale a $Z_2 \to 0$, logo $R = +1$.
- **Absorvente** (casada): uma terminação que exerce exatamente $F = Z_1\,\partial y/\partial t$ absorve toda a onda, $R = 0$.

### 6. Método numérico: colar de contas
A corda é trocada por contas de massa $m_i = \mu\,\Delta x$ ligadas por segmentos de rigidez $k_i = T/\Delta x$. A força na conta $i$ e a integração de Verlet (diferenças centrais no tempo) com passo $h$ são
$$F_i = k_{i-1}(y_{i-1} - y_i) + k_i(y_{i+1} - y_i), \qquad y_i^{n+1} = 2y_i^n - y_i^{n-1} + \frac{h^2}{m_i}\,F_i.$$
Num meio uniforme isso é a equação de onda discretizada com erro $O(\Delta x^2, h^2)$ e número de Courant $C = vh/\Delta x$. A escolha especial $C = 1$ torna o esquema **exato** nos nós: com $C = 1$ ele vira $y_i^{n+1} = y_{i+1}^n + y_{i-1}^n - y_i^{n-1}$, que é satisfeito exatamente por qualquer $f(x - vt) + g(x + vt)$ amostrada na grade. Por isso o segundo trecho usa um espaçamento diferente, $\Delta x_2 = v_2 h$, para que também ali $C = 1$; só a conta da emenda, com massa $(\mu_1\Delta x_1 + \mu_2\Delta x_2)/2$, introduz uma pequena aproximação.

### 7. Condições de contorno discretas
- Ponta esquerda (fonte): deslocamento imposto $s(t)$, um pulso gaussiano, um seno ou a mão do usuário, mais uma correção que deixa sair a onda que volta: $y_0^{n+1} = s^{n+1} + y_1^n - s^{n-1}$.
- Ponta fixa: $y_N = 0$. Ponta livre: $y_N^{n+1} = 2y_{N-1}^n - y_N^{n-1}$ (espelho, derivada nula). Ponta absorvente: $y_N^{n+1} = y_{N-1}^n$, que é exatamente a condição de onda só saindo, $y(x, t + h) = y(x - vh, t)$, quando $C = 1$.
- Os coeficientes medidos são os picos do pulso refletido e do transmitido em sondas no meio de cada trecho, divididos pela amplitude do pulso incidente. A energia da corda é a soma da cinética das contas com a elástica dos segmentos.`;
