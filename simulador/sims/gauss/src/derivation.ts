/** Modo engenharia: da lei de Coulomb à lei de Gauss, campos das distribuições simétricas e o fluxo numérico. */
export const derivation = String.raw`### 1. Hipóteses
- Eletrostática no vácuo: cargas em repouso, $\varepsilon_0 = 8{,}854\times10^{-12}\ \text{F/m}$.
- O fio e o plano são infinitos (na prática, muito maiores que a superfície gaussiana) e perpendiculares à tela; a esfera tem densidade volumétrica uniforme.

### 2. Do campo de Coulomb à lei de Gauss
Uma carga pontual $q$ na origem cria $\vec E = \dfrac{q}{4\pi\varepsilon_0}\dfrac{\hat r}{r^2}$. O fluxo através de um elemento de área é $d\Phi = \vec E\cdot\hat n\,dA = \dfrac{q}{4\pi\varepsilon_0}\,d\Omega$, em que $d\Omega = \hat r\cdot\hat n\,dA/r^2$ é o ângulo sólido sob o qual o elemento é visto da carga. Assim:
- se a carga está dentro de uma superfície fechada, os ângulos sólidos somam $4\pi$ e $\Phi = q/\varepsilon_0$, qualquer que seja a forma da superfície;
- se está fora, cada cone de ângulo sólido atravessa a superfície um número par de vezes, entrando e saindo, e as contribuições se cancelam: $\Phi = 0$.

Pelo princípio da superposição, para qualquer distribuição:
$$\oint_S \vec E\cdot\hat n\,dA = \frac{q_{int}}{\varepsilon_0}.$$
O fluxo só depende da carga interna, mas o campo em cada ponto depende de todas as cargas, de dentro e de fora.

### 3. Campos das distribuições simétricas
A lei de Gauss permite calcular $E$ quando a simetria garante que $E$ é constante e normal sobre uma superfície escolhida.

**Fio infinito** (densidade linear $\lambda$): por simetria cilíndrica $\vec E$ é radial. Num cilindro coaxial de raio $r$ e comprimento $L$ só a lateral contribui: $E\cdot 2\pi r L = \lambda L/\varepsilon_0$, logo
$$E = \frac{\lambda}{2\pi\varepsilon_0 r}.$$
**Plano infinito** (densidade superficial $\sigma$): $\vec E$ é perpendicular ao plano e tem o mesmo módulo dos dois lados. Numa caixa que atravessa o plano, com tampas de área $A$: $2EA = \sigma A/\varepsilon_0$, logo
$$E = \frac{\sigma}{2\varepsilon_0},$$
independente da distância.

**Esfera uniforme** (carga $Q$, raio $R$): numa esfera concêntrica de raio $r$, $E\cdot 4\pi r^2 = q_{int}/\varepsilon_0$. Fora, $q_{int} = Q$; dentro, $q_{int} = Q\,r^3/R^3$:
$$E = \frac{Q}{4\pi\varepsilon_0 r^2}\ (r \ge R), \qquad E = \frac{Q\,r}{4\pi\varepsilon_0 R^3}\ (r < R).$$

### 4. Geometria das superfícies da simulação
- Para cargas pontuais e para a esfera, o problema é 3D: o círculo do palco é o corte em $z = 0$ de uma esfera gaussiana e o retângulo é o corte de uma caixa com profundidade igual à largura.
- Para o fio e o plano, o problema é 2D: o círculo é o corte de um cilindro e o retângulo o de uma caixa, ambos com comprimento $L = 1$ m ao longo de $z$. Como $E_z = 0$, as tampas não contribuem e $\Phi = L\oint \vec E\cdot\hat n\,dl$.

### 5. Método numérico: fluxo por soma de elementos
A integral de superfície é aproximada pela regra do ponto médio com $N$ elementos (o controle Elementos na borda):
$$\Phi \approx \sum_i (\vec E_i\cdot\hat n_i)\,\Delta A_i.$$
- Esfera: grade em $(\theta, \phi)$ com $N\times 2N$ células, $\Delta A = a^2\sin\theta\,\Delta\theta\,\Delta\phi$ e $\hat n = (\sin\theta\cos\phi, \sin\theta\sin\phi, \cos\theta)$.
- Caixa: $N\times N$ células em cada uma das seis faces.
- Contornos 2D: $N$ segmentos de mesmo comprimento ao longo do círculo; no retângulo, distribuídos pelos lados proporcionalmente ao comprimento.

A regra do ponto médio tem erro $O(1/N^2)$ quando o campo é suave na superfície; quando uma carga fica muito perto da superfície o integrando varia rápido e o erro cresce, o que se vê na linha de diferença $\Phi - q_{int}/\varepsilon_0$. Para evitar a divisão por zero exatamente sobre uma carga, usa-se $r^2 \ge 10^{-8}\ \text{m}^2$.

### 6. Carga interna de referência
- Cargas pontuais: soma das que estão dentro do corte da superfície.
- Fio: $\lambda L$ se o fio atravessa a superfície.
- Plano: $\sigma$ vezes a área da seção do plano dentro da superfície (corda do círculo ou altura da caixa, vezes $L$).
- Esfera carregada: $Q$ vezes a fração do volume da bola dentro da superfície (volume da lente entre duas esferas, ou quadratura numérica para a caixa).`;
