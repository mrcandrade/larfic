/** Modo engenharia: equação do pêndulo físico, aproximação linear e período exato. */
export const derivation = String.raw`### 1. Hipóteses
- Corpo rígido que gira em torno de um eixo horizontal fixo (o pivô), sem folga; movimento num plano vertical.
- Gravidade uniforme $g$. O ângulo $\theta$ é medido a partir da vertical para baixo.
- Atrito no pivô e resistência do ar modelados por um torque viscoso $-b\,\dot\theta$ (linear na velocidade angular).

### 2. Equação de movimento
Para rotação em torno de um eixo fixo, a segunda lei de Newton toma a forma $I\,\ddot\theta = \sum \tau$, com $I$ o momento de inércia em relação ao pivô. O peso atua no centro de massa, a uma distância $d$ do pivô; seu braço de alavanca é $d\sin\theta$ e o torque tende a trazer o corpo de volta:
$$I\,\ddot\theta = -m g d\,\sin\theta - b\,\dot\theta.$$
Os três corpos da simulação diferem só em $I$ e $d$:
- massa pontual na ponta de um fio de comprimento $L$: $I = mL^2$, $d = L$;
- barra uniforme presa pela ponta: $I = \tfrac13 mL^2$, $d = L/2$;
- disco de raio $r = L/5$ na ponta de uma haste sem massa: pelo teorema dos eixos paralelos, $I = \tfrac12 m r^2 + m L^2$, $d = L$.

### 3. Pequenas oscilações
Para $|\theta| \ll 1$ rad, $\sin\theta = \theta - \theta^3/6 + \dots \approx \theta$, e sem amortecimento
$$\ddot\theta + \omega_0^2\,\theta = 0, \qquad \omega_0 = \sqrt{\frac{m g d}{I}}, \qquad T_0 = 2\pi\sqrt{\frac{I}{m g d}}.$$
Para a massa pontual, $T_0 = 2\pi\sqrt{L/g}$, independente da massa e da amplitude (isocronismo, válido só nessa aproximação). A grandeza $L_{eq} = I/(m d)$ é o comprimento do pêndulo simples equivalente.

### 4. Período exato para amplitude finita
Sem amortecimento a energia se conserva. Multiplicando a equação por $\dot\theta$ e integrando:
$$\tfrac12 I\dot\theta^2 - m g d\cos\theta = -m g d\cos\theta_0 \;\Rightarrow\; \dot\theta = \omega_0\sqrt{2(\cos\theta - \cos\theta_0)}.$$
Um quarto de período é o tempo de ir de $0$ a $\theta_0$:
$$T = \frac{4}{\omega_0}\int_0^{\theta_0}\frac{d\theta}{\sqrt{2(\cos\theta - \cos\theta_0)}}.$$
Usando $\cos\theta = 1 - 2\sin^2(\theta/2)$, a substituição $\sin(\theta/2) = k\sin\phi$ com $k = \sin(\theta_0/2)$ remove a singularidade no limite superior e leva à integral elíptica completa de primeira espécie:
$$T = \frac{4}{\omega_0}\,K(k), \qquad K(k) = \int_0^{\pi/2}\frac{d\phi}{\sqrt{1 - k^2\sin^2\phi}}.$$
Expandindo, $T \approx T_0\left(1 + \tfrac{1}{16}\theta_0^2 + \tfrac{11}{3072}\theta_0^4 + \dots\right)$: a $30^\circ$ o período é cerca de $1{,}7\%$ maior que $T_0$; a $90^\circ$, cerca de $18\%$.

### 5. Amortecimento
Com $b > 0$ e ângulos pequenos, $\ddot\theta + 2\gamma\dot\theta + \omega_0^2\theta = 0$ com $\gamma = b/(2I)$; a amplitude decai como $e^{-\gamma t}$ e a frequência passa a $\omega_d = \sqrt{\omega_0^2 - \gamma^2}$.

### 6. Método numérico
- O estado tem quatro componentes: $(\theta, \omega)$ do pêndulo real e $(\theta_L, \omega_L)$ de um pêndulo-fantasma que obedece à equação linearizada, com as mesmas condições iniciais, para a comparação lado a lado.
- As equações de primeira ordem $\dot\theta = \omega$, $\dot\omega = -\omega_0^2\sin\theta - (b/I)\,\omega$ são integradas por Runge–Kutta de 4ª ordem com passo $h = 1$ ms.
- $K(k)$ é calculada pela média aritmético-geométrica: $K(k) = \pi / \big(2\,\mathrm{MAG}(1, \sqrt{1-k^2})\big)$, que converge quadraticamente.`;
