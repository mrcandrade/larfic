/** Modo engenharia: oscilador forçado, solução particular por fasores, curva de ressonância e potência. */
export const derivation = String.raw`### 1. Hipóteses
- Oscilador linear: massa $m$, mola ideal $k$, amortecimento viscoso $b$; força externa senoidal $F(t) = F_0\cos\omega t$ de amplitude e frequência fixas.
- A ponte do cenário é reduzida a um único modo de flexão, que se comporta exatamente como esse oscilador (massa e rigidez modais); o desenho é ilustrativo.

### 2. Equação de movimento
$$m\ddot x + b\dot x + kx = F_0\cos\omega t \;\Leftrightarrow\; \ddot x + 2\gamma\dot x + \omega_0^2 x = \frac{F_0}{m}\cos\omega t,$$
com $\omega_0 = \sqrt{k/m}$ e $\gamma = b/(2m)$. Por ser linear, a solução geral é $x = x_h + x_p$: a solução homogênea (transiente) mais uma solução particular.

### 3. Solução particular por fasores
Escreve-se a força como $\mathrm{Re}\big(F_0 e^{i\omega t}\big)$ e procura-se $x_p = \mathrm{Re}\big(\hat X e^{i\omega t}\big)$. Substituindo, cada derivada vira um fator $i\omega$:
$$\left(\omega_0^2 - \omega^2 + 2i\gamma\omega\right)\hat X = \frac{F_0}{m} \;\Rightarrow\; \hat X = \frac{F_0/m}{\omega_0^2 - \omega^2 + 2i\gamma\omega}.$$
Escrevendo $\hat X = A\,e^{-i\delta}$:
$$A(\omega) = \frac{F_0/m}{\sqrt{(\omega_0^2 - \omega^2)^2 + (2\gamma\omega)^2}}, \qquad \tan\delta = \frac{2\gamma\omega}{\omega_0^2 - \omega^2}, \quad 0 \le \delta \le \pi,$$
e $x_p = A\cos(\omega t - \delta)$. Abaixo da ressonância o bloco acompanha a força ($\delta \to 0$); em $\omega = \omega_0$ o atraso é exatamente $90^\circ$; muito acima, o bloco se move em oposição ($\delta \to 180^\circ$).

### 4. Pico de amplitude
$A$ é máxima onde o denominador $D(\omega) = (\omega_0^2 - \omega^2)^2 + 4\gamma^2\omega^2$ é mínimo. Derivando em relação a $\omega^2$:
$$\frac{dD}{d(\omega^2)} = -2(\omega_0^2 - \omega^2) + 4\gamma^2 = 0 \;\Rightarrow\; \omega_r = \sqrt{\omega_0^2 - 2\gamma^2},$$
que existe só se $\gamma < \omega_0/\sqrt2$. Para amortecimento fraco $\omega_r \approx \omega_0$ e $A_{max} \approx F_0/(2m\gamma\omega_0) = Q\,F_0/k$: a resposta estática $F_0/k$ é amplificada pelo fator $Q$.

### 5. Potência e largura da ressonância
A potência média que a força entrega, igual à dissipada no regime permanente, é
$$\bar P = \overline{F\dot x} = \tfrac12 F_0\,\omega A\sin\delta = \frac{F_0^2}{2m}\,\frac{2\gamma\omega^2}{(\omega_0^2 - \omega^2)^2 + (2\gamma\omega)^2},$$
máxima exatamente em $\omega = \omega_0$. Perto do pico, com $\omega_0^2 - \omega^2 \approx 2\omega_0(\omega_0 - \omega)$, a curva vira uma lorentziana que cai à metade em $|\omega - \omega_0| = \gamma$. A largura a meia potência é $\Delta\omega = 2\gamma$ e
$$Q = \frac{\omega_0}{2\gamma} = \frac{\omega_0}{\Delta\omega} = \frac{\sqrt{mk}}{b}.$$

### 6. Transiente e batimentos
Partindo do repouso, $x_h = C e^{-\gamma t}\cos(\omega_d t + \varphi)$, com $\omega_d = \sqrt{\omega_0^2 - \gamma^2}$ e $C$, $\varphi$ fixados por $x(0) = \dot x(0) = 0$. Enquanto o transiente não morre, a soma de duas oscilações de frequências $\omega$ e $\omega_d$ produz batimentos com frequência angular $|\omega - \omega_d|$; o regime permanente é atingido após alguns múltiplos de $1/\gamma$.

### 7. Método numérico
- Estado: $(x, \dot x, W_{ext}, E_d, \psi)$, com $\dot W_{ext} = F\dot x$ (trabalho da força), $\dot E_d = b\dot x^2$ (energia dissipada) e $\dot\psi = \omega$ (fase da força, para que mudar $\omega$ ao vivo não provoque saltos).
- Runge–Kutta de 4ª ordem com passo $h = 1$ ms. As curvas $A(\omega)$ e $\delta(\omega)$ do palco usam as fórmulas fechadas acima.`;
