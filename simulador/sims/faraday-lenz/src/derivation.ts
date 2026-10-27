/** Modo engenharia: lei de Faraday, fluxo de um dipolo numa espira, gerador e o cálculo numérico. */
export const derivation = String.raw`### 1. Hipóteses
- O ímã é pequeno frente às distâncias envolvidas e é modelado como um dipolo magnético pontual de momento $m$ alinhado com o eixo da espira.
- A bobina tem $N$ espiras circulares coincidentes de raio $a$ e resistência total $R$; sua autoindutância é desprezada, de modo que $I = \varepsilon/R$.
- O movimento do ímã é imposto (oscilação, velocidade constante ou arraste): a força de frenagem que a corrente induzida exerce sobre ele não altera a cinemática.
- No gerador, o campo $B$ é uniforme e a espira gira com velocidade angular constante $\omega$.

### 2. Lei de Faraday
A circulação do campo elétrico induzido numa espira é igual a menos a taxa de variação do fluxo magnético:
$$\oint \vec E\cdot d\vec l = -\frac{d\Phi_B}{dt}, \qquad \Phi_B = \int_A \vec B\cdot d\vec A.$$
Com $N$ espiras em série as fems se somam: $\varepsilon = -N\,d\Phi_B/dt$. O sinal negativo é a lei de Lenz: a corrente induzida cria um campo que se opõe à variação do fluxo, o que é exigido pela conservação da energia (se reforçasse a variação, a energia cresceria sem fonte).

### 3. Campo de um dipolo
O potencial vetor de um dipolo é $\vec A = \frac{\mu_0}{4\pi}\frac{\vec m\times\hat r}{r^2}$, e $\vec B = \nabla\times\vec A$ dá
$$\vec B = \frac{\mu_0}{4\pi}\,\frac{3(\vec m\cdot\hat r)\hat r - \vec m}{r^3}.$$
Num ponto à distância axial $d$ e radial $\rho$, com $r^2 = d^2 + \rho^2$, a componente ao longo do eixo é
$$B_x = \frac{\mu_0 m}{4\pi}\,\frac{3d^2 - r^2}{r^5}.$$

### 4. Fluxo através da espira
Somando anéis de raio $\rho$ e área $2\pi\rho\,d\rho$:
$$\Phi(d) = \int_0^a B_x(d, \rho)\,2\pi\rho\,d\rho.$$
O caminho mais curto é usar o potencial vetor: na espira $A_\phi = \frac{\mu_0 m}{4\pi}\frac{a}{(a^2 + d^2)^{3/2}}$ e $\Phi = \oint \vec A\cdot d\vec l = 2\pi a A_\phi$, logo
$$\Phi(d) = \frac{\mu_0 m\,a^2}{2\,(a^2 + d^2)^{3/2}}.$$
(Por reciprocidade, é o mesmo que o campo de uma espira com corrente unitária no eixo vezes $m$: $\Phi = M\,m$.) O fluxo é máximo com o ímã no centro da espira.

### 5. Fem com o ímã em movimento
Com o ímã na posição $x(t)$, a regra da cadeia separa geometria e cinemática:
$$\varepsilon = -N\,\frac{d\Phi}{dt} = -N\,\frac{d\Phi}{dx}\,\dot x, \qquad \frac{d\Phi}{dx} = -\frac{3\mu_0 m\,a^2\,x}{2\,(a^2 + x^2)^{5/2}}.$$
A fem troca de sinal quando o ímã passa pelo centro ($d\Phi/dx = 0$ em $x = 0$): ao se aproximar o fluxo cresce, ao se afastar diminui. Os picos ficam em $x = \pm a/2$, onde $|d\Phi/dx|$ é máximo. Inverter o polo inverte $m$ e, portanto, todo o sinal.

### 6. Gerador
Com a normal da espira fazendo ângulo $\theta = \omega t$ com $\vec B$ uniforme, $\Phi = BA\cos\omega t$ por espira e
$$\varepsilon = -N\frac{d\Phi}{dt} = NBA\omega\sin\omega t, \qquad \varepsilon_{max} = NBA\omega, \quad A = \pi a^2.$$

### 7. Método numérico
- A cinemática é analítica: $x = -A_0\cos\omega t$ na oscilação, $x = x_0 + vt$ na passagem; no arraste a posição segue o ponteiro com um filtro de primeira ordem de constante $60$ ms, e a velocidade é a diferença finita entre passos.
- O fluxo é calculado pela integral da seção 4 com quadratura de Gauss–Legendre composta (6 painéis de 8 pontos). Quando o dipolo está perto do plano da espira ($|d| < a$) o integrando é quase singular no centro; usa-se então que o fluxo através do plano inteiro é nulo e integra-se o complemento, $\Phi = -\int_a^\infty B_x\,2\pi\rho\,d\rho$, com a troca $\rho = a/u$ que torna o intervalo finito.
- $d\Phi/dx$ vem de uma diferença central com passo de $0{,}01$ cm sobre esse fluxo numérico. A fórmula fechada da seção 4 serve de referência nos testes.
- Passo de tempo: $1$ ms.`;
