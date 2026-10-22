/** Modo engenharia: oscilador amortecido, equação característica e os três regimes. */
export const derivation = String.raw`### 1. Hipóteses
- Bloco de massa $m$ preso a uma mola ideal de constante $k$ e a um amortecedor viscoso; movimento em uma dimensão, sem atrito seco.
- O amortecedor exerce força proporcional à velocidade, $F_b = -b\dot x$ (fluido em regime laminar dentro do cilindro).

### 2. Equação de movimento
$$m\ddot x + b\dot x + k x = 0 \;\Leftrightarrow\; \ddot x + 2\gamma\dot x + \omega_0^2 x = 0, \qquad \omega_0 = \sqrt{\frac{k}{m}}, \quad \gamma = \frac{b}{2m}.$$
O fator de amortecimento adimensional é $\zeta = \gamma/\omega_0 = b/b_c$, com $b_c = 2\sqrt{mk}$.

### 3. Equação característica
A equação é linear com coeficientes constantes; tentando $x = e^{st}$:
$$s^2 + 2\gamma s + \omega_0^2 = 0 \;\Rightarrow\; s_{1,2} = -\gamma \pm \sqrt{\gamma^2 - \omega_0^2}.$$
A posição dessas raízes no plano complexo (desenhado no palco) decide o regime.

### 4. Os três regimes, com $x(0) = x_0$ e $\dot x(0) = v_0$
**Subamortecido** ($\gamma < \omega_0$): raízes complexas $-\gamma \pm i\omega_d$, $\omega_d = \sqrt{\omega_0^2 - \gamma^2}$.
$$x(t) = e^{-\gamma t}\left[x_0\cos\omega_d t + \frac{v_0 + \gamma x_0}{\omega_d}\sin\omega_d t\right].$$
**Crítico** ($\gamma = \omega_0$): raiz dupla $-\gamma$; a segunda solução independente é $t\,e^{-\gamma t}$.
$$x(t) = \big[x_0 + (v_0 + \gamma x_0)\,t\big]\,e^{-\gamma t}.$$
**Superamortecido** ($\gamma > \omega_0$): duas raízes reais negativas $s_1 > s_2$.
$$x(t) = c_1 e^{s_1 t} + (x_0 - c_1)\,e^{s_2 t}, \qquad c_1 = \frac{v_0 - s_2 x_0}{s_1 - s_2}.$$
As constantes saem de impor $x(0) = x_0$ e $\dot x(0) = v_0$. O retorno mais rápido sem ultrapassar o equilíbrio ocorre no crítico: no superamortecido o termo lento $e^{s_1 t}$, com $|s_1| < \omega_0$, domina para tempos longos.

### 5. Energia
Multiplicando a equação por $\dot x$:
$$\frac{d}{dt}\left(\tfrac12 m\dot x^2 + \tfrac12 k x^2\right) = -b\dot x^2 \le 0.$$
A energia dissipada $E_d = \int b\dot x^2\,dt$ somada à energia mecânica dá a energia inicial. No subamortecido fraco, a energia média cai como $e^{-2\gamma t}$; o fator de qualidade $Q = \omega_0/(2\gamma)$ é $2\pi$ vezes a energia armazenada dividida pela energia perdida por ciclo, e a amplitude cai à metade em $t_{1/2} = \ln 2/\gamma$.

### 6. Método numérico
- O estado tem nove componentes: $(x, \dot x, E_d)$ do oscilador principal e $(x, \dot x)$ de três osciladores de comparação com $\zeta = 0{,}2$, $1$ e $2{,}5$, todos com as mesmas condições iniciais.
- Runge–Kutta de 4ª ordem com passo $h = 1$ ms; a solução analítica acima é usada pelos testes para conferir a integração.`;
