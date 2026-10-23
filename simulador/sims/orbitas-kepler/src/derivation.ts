/** Modo engenharia: das leis de Newton às leis de Kepler, transferência de Hohmann e integração de N corpos. */
export const derivation = String.raw`### 1. Hipóteses e unidades
- Corpos esféricos (ou pontuais) que interagem só pela gravitação newtoniana; sem efeitos relativísticos, de maré ou de arrasto.
- Movimento no plano (o momento angular total fixa esse plano).
- Unidades astronômicas: distância em UA, tempo em anos, massa em massas solares. Nelas $G = 4\pi^2\ \text{UA}^3/(M_\odot\,\text{ano}^2)$, de modo que a Terra em torno do Sol tem $T^2 = a^3$.

### 2. Equações de movimento
Para $N$ corpos, a lei da gravitação e a segunda lei dão
$$\ddot{\vec r}_i = \sum_{j\neq i} G m_j\,\frac{\vec r_j - \vec r_i}{|\vec r_j - \vec r_i|^3}.$$
A soma das forças internas é nula (terceira lei), então o centro de massa se move em linha reta; a simulação o coloca em repouso na origem subtraindo sua posição e velocidade das condições iniciais.

### 3. Redução do problema de dois corpos
Com $\vec r = \vec r_2 - \vec r_1$ e $M = m_1 + m_2$, subtraindo as equações dos dois corpos:
$$\ddot{\vec r} = -\frac{\mu}{r^3}\,\vec r, \qquad \mu = G M.$$
É o movimento de uma partícula num campo central fixo. Duas grandezas se conservam:
- **momento angular específico** $h = |\vec r\times\dot{\vec r}| = r^2\dot\theta$, porque a força é central (torque nulo);
- **energia específica** $\varepsilon = \tfrac12 v^2 - \mu/r$, porque a força é conservativa.

### 4. Segunda lei de Kepler
A área varrida pelo raio vetor num intervalo $dt$ é $dA = \tfrac12 r^2\,d\theta$, logo
$$\frac{dA}{dt} = \tfrac12 r^2\dot\theta = \frac{h}{2} = \text{constante}.$$
A simulação mede as áreas de 12 setores de duração $T/12$ e elas devem coincidir.

### 5. Primeira lei: a órbita é uma cônica
Com $u = 1/r$ e $\theta$ como variável independente, $\dot r = -h\,du/d\theta$ e $\ddot r = -h^2u^2\,d^2u/d\theta^2$. A componente radial da equação de movimento, $\ddot r - r\dot\theta^2 = -\mu/r^2$, vira a equação de Binet:
$$\frac{d^2u}{d\theta^2} + u = \frac{\mu}{h^2} \;\Rightarrow\; r(\theta) = \frac{h^2/\mu}{1 + e\cos(\theta - \theta_0)}.$$
É uma cônica com foco na origem e excentricidade $e = \sqrt{1 + 2\varepsilon h^2/\mu^2}$: elipse se $\varepsilon < 0$, parábola se $\varepsilon = 0$, hipérbole se $\varepsilon > 0$. Para a elipse, o semieixo maior é $a = -\mu/(2\varepsilon)$, o que dá a equação vis-viva
$$v^2 = \mu\left(\frac{2}{r} - \frac{1}{a}\right).$$

### 6. Terceira lei
A área da elipse é $\pi a b$, com $b = a\sqrt{1 - e^2}$ e $h^2 = \mu a(1 - e^2)$. Dividindo pela velocidade areolar $h/2$:
$$T = \frac{2\pi a b}{h} = 2\pi\sqrt{\frac{a^3}{\mu}} \;\Rightarrow\; T^2 = \frac{4\pi^2}{G(m_1 + m_2)}\,a^3.$$
Em UA, anos e massas solares, com $m_2 \ll m_1 = 1$, isso é $T^2 = a^3$.

### 7. Transferência de Hohmann
Para ir de uma órbita circular de raio $r_1$ a outra de raio $r_2$ com dois impulsos tangenciais, usa-se a elipse de transferência com periélio $r_1$ e afélio $r_2$, $a_T = (r_1 + r_2)/2$. Pela vis-viva:
$$v_{t1} = \sqrt{\frac{\mu}{r_1}}\sqrt{\frac{2r_2}{r_1 + r_2}}, \qquad v_{t2} = \sqrt{\frac{\mu}{r_2}}\sqrt{\frac{2r_1}{r_1 + r_2}},$$
com $\Delta v_1 = v_{t1} - \sqrt{\mu/r_1}$ no início e $\Delta v_2 = \sqrt{\mu/r_2} - v_{t2}$ ao chegar. O trânsito dura meio período da elipse: $t_H = \pi\sqrt{a_T^3/\mu}$.

### 8. Método numérico
- Estado: $(x, y, v_x, v_y)$ de cada corpo, em UA e UA/ano.
- Dormand–Prince 5(4) com passo adaptativo (tolerâncias relativa $10^{-10}$ e absoluta $10^{-13}$) dentro de cada quadro de $0{,}002$ ano: o passo encolhe automaticamente no periélio de órbitas excêntricas e em encontros próximos do problema de três corpos.
- Um amaciamento mínimo $r^2 \to r^2 + \epsilon^2$, com $\epsilon^2 = 10^{-8}\ \text{UA}^2$, evita a divisão por zero numa colisão; ele é desprezível nas distâncias mostradas.
- A queima da segunda etapa de Hohmann é aplicada no instante exato $t_H$, dividindo o passo em que ele cai.
- A energia total e o momento angular servem de verificação: na órbita de dois corpos o desvio relativo da energia fica muito abaixo de $10^{-6}$.`;
