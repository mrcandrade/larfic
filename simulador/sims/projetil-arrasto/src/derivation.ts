/** Modo engenharia: derivação completa do modelo do projétil com arrasto quadrático. */
export const derivation = String.raw`### 1. Hipóteses
- O projétil é uma esfera rígida de massa $m$ e diâmetro $D$, tratada como partícula (sem rotação, portanto sem efeito Magnus).
- Gravidade uniforme $\vec g = -g\,\hat y$ (alcances pequenos frente ao raio da Terra; Terra tratada como referencial inercial).
- Ar parado, com densidade $\rho$ constante ao longo da trajetória (sem vento, sem variação com a altitude).
- Regime de número de Reynolds alto ($Re = \rho v D/\eta \sim 10^4$ a $10^5$ para bolas de esporte), em que o arrasto é dominado pela pressão e cresce com $v^2$; o coeficiente $C_d$ é tomado constante.

### 2. Força de arrasto
A análise dimensional diz que uma força que depende só de $\rho$, $v$ e da área frontal $A$ tem a forma $F \propto \rho v^2 A$. A constante adimensional é o coeficiente de arrasto, definido por
$$F_d = \tfrac12\,\rho\,C_d\,A\,v^2, \qquad A = \pi D^2/4.$$
O termo $\tfrac12\rho v^2$ é a pressão dinâmica (Bernoulli). A força aponta contra a velocidade relativa ao ar:
$$\vec F_d = -k\,|\vec v|\,\vec v, \qquad k = \tfrac12\rho C_d A.$$
Note que $|\vec v|\,\vec v$ tem módulo $v^2$ e direção de $\vec v$; isso acopla as componentes $x$ e $y$, ao contrário do arrasto linear.

### 3. Segunda lei de Newton
$$m\,\frac{d\vec v}{dt} = m\vec g - k\,|\vec v|\,\vec v.$$
Em componentes, com $v = \sqrt{v_x^2 + v_y^2}$:
$$\dot x = v_x, \qquad \dot y = v_y, \qquad \dot v_x = -\frac{k}{m}\,v\,v_x, \qquad \dot v_y = -g - \frac{k}{m}\,v\,v_y.$$
Não há solução fechada geral para esse sistema (o acoplamento por $v$ impede separar as equações), por isso ele é integrado numericamente.

### 4. Velocidade terminal
Na queda vertical o regime estacionário tem $\dot v_y = 0$, logo $m g = k v_t^2$:
$$v_t = \sqrt{\frac{m g}{k}} = \sqrt{\frac{2 m g}{\rho C_d A}}.$$
Na queda a partir do repouso a equação $\dot v = g\,(1 - v^2/v_t^2)$ é separável e dá $v(t) = v_t \tanh(g t / v_t)$, que a simulação deve reproduzir no cenário da peteca.

### 5. Balanço de energia
Multiplicando a equação de movimento escalarmente por $\vec v$:
$$\frac{d}{dt}\left(\tfrac12 m v^2 + m g y\right) = \vec F_d\cdot\vec v = -k\,v^3 \le 0.$$
Definindo a energia dissipada $W_d$ por $\dot W_d = k\,v^3 = |\vec F_d|\,v$, resulta a lei de conservação usada como teste numérico:
$$E_{mec}(t) + W_d(t) = E_{mec}(0).$$

### 6. Limite do vácuo
Com $k = 0$ as equações desacoplam: $x = v_0\cos\theta\,t$ e $y = h_0 + v_0\sin\theta\,t - \tfrac12 g t^2$. Para $h_0 = 0$ o alcance é $R = v_0^2\sin 2\theta/g$, máximo em $\theta = 45^\circ$. Com arrasto, a componente horizontal perde velocidade durante todo o voo e o ângulo ótimo cai abaixo de $45^\circ$.

### 7. Método numérico
- Estado $\mathbf y = (x, y, v_x, v_y, W_d)$, com $\dot W_d = k v^3$ integrado junto com o movimento.
- Integração por Runge–Kutta clássico de 4ª ordem com passo fixo $h = 1$ ms (erro global $O(h^4)$).
- O pouso é um evento: a função $y(t)$ é monitorada e, quando cruza zero descendo, o instante exato é localizado por bissecção dentro do último passo, para que o alcance não dependa de $h$.
- O desvio relativo de $E_{mec} + W_d$ mostrado no painel mede a qualidade da integração: ele deve ficar na casa de $10^{-9}$ ou menor.`;
