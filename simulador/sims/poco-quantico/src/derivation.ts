/** Modo engenharia: equação de Schrödinger estacionária em 1D, soluções analíticas e o método de diferenças finitas. */
export const derivation = String.raw`### 1. Hipóteses e unidades
- Uma partícula não relativística de massa $m$ em uma dimensão, sem spin, num potencial $V(x)$ que não depende do tempo.
- Unidades adimensionais com $\hbar = m = 1$: comprimentos numa escala $\ell$ escolhida, energias em $\hbar^2/(m\ell^2)$ e tempos em $m\ell^2/\hbar$. Para um elétron com $\ell = 1$ nm, a unidade de energia vale cerca de $76$ meV.
- O sistema inteiro é posto numa caixa $[-X, X]$ com $X = 8$, onde $\psi = 0$; para estados ligados bem dentro dela isso não altera os resultados.

### 2. Estados estacionários
A equação de Schrödinger é $i\hbar\,\partial_t\Psi = \hat H\Psi$ com $\hat H = -\frac{\hbar^2}{2m}\partial_x^2 + V(x)$. Separando variáveis, $\Psi = \psi(x)\,e^{-iEt/\hbar}$, e $\psi$ obedece ao problema de autovalores
$$-\frac{\hbar^2}{2m}\,\psi'' + V(x)\,\psi = E\,\psi.$$
Exige-se $\psi$ contínua, normalizável ($\int|\psi|^2dx = 1$) e com $\psi'$ contínua onde $V$ é finito. Essas condições só são satisfeitas para energias discretas $E_n$ quando a partícula está ligada. O $n$-ésimo estado tem $n - 1$ nós (teorema de oscilação de Sturm).

### 3. Poço infinito (largura $L$)
Dentro, $V = 0$ e $\psi'' = -k^2\psi$ com $k = \sqrt{2mE}/\hbar$; fora, $\psi = 0$. As condições $\psi(\pm L/2) = 0$ exigem $kL = n\pi$:
$$\psi_n \propto \sin\!\left(\frac{n\pi(x + L/2)}{L}\right), \qquad E_n = \frac{n^2\pi^2\hbar^2}{2mL^2}, \quad n = 1, 2, \dots$$
A energia mínima é positiva (energia de ponto zero), coerente com o princípio da incerteza.

### 4. Poço finito (profundidade $V_0$)
Com $0 < E < V_0$, dentro a solução oscila ($k = \sqrt{2mE}/\hbar$) e fora decai ($\kappa = \sqrt{2m(V_0 - E)}/\hbar$, $\psi \propto e^{-\kappa|x|}$). Como o poço é simétrico, os estados são pares ($\cos kx$) ou ímpares ($\sin kx$). Impondo a continuidade de $\psi'/\psi$ em $x = L/2$:
$$\text{pares: } k\tan\frac{kL}{2} = \kappa, \qquad \text{ímpares: } -k\cot\frac{kL}{2} = \kappa.$$
Com $k^2 + \kappa^2 = 2mV_0/\hbar^2$ fixo, as soluções são interseções de curvas; há sempre pelo menos um estado ligado, e o número cresce com $L\sqrt{V_0}$. A função penetra na região proibida classicamente com comprimento $1/\kappa$.

### 5. Oscilador harmônico
Para $V = \tfrac12 m\omega^2 x^2$, os operadores de escada $a^{\pm} = (m\omega x \mp i\hat p)/\sqrt{2m\hbar\omega}$ fatoram o hamiltoniano, $\hat H = \hbar\omega(a^+a^- + \tfrac12)$, e dão níveis igualmente espaçados:
$$E_n = \left(n + \tfrac12\right)\hbar\omega, \qquad n = 0, 1, 2, \dots, \qquad \psi_0 \propto e^{-m\omega x^2/(2\hbar)}.$$

### 6. Poço duplo e superposição
O poço duplo $V = V_0\,(x^2/c^2 - 1)^2$ tem dois mínimos em $x = \pm c$. Os dois níveis mais baixos são quase degenerados: um par e um ímpar, separados por $\Delta E$ que diminui exponencialmente com a altura e a largura da barreira. Uma superposição de dois estados estacionários
$$\Psi(x, t) = \frac{1}{\sqrt2}\left(\psi_a e^{-iE_a t/\hbar} + \psi_b e^{-iE_b t/\hbar}\right)$$
tem densidade $|\Psi|^2 = \tfrac12\left[\psi_a^2 + \psi_b^2 + 2\psi_a\psi_b\cos\big((E_b - E_a)t/\hbar\big)\right]$ (funções reais), que oscila com período $T = 2\pi\hbar/(E_b - E_a)$. No poço duplo isso é a partícula tunelando de um lado para o outro.

### 7. Método numérico
- A caixa é dividida em $N = 1599$ pontos internos com espaçamento $h = 2X/(N + 1)$. A segunda derivada vira a diferença central de 2ª ordem, $\psi''_i \approx (\psi_{i+1} - 2\psi_i + \psi_{i-1})/h^2$, e o problema vira uma matriz tridiagonal simétrica:
$$H_{ii} = \frac{1}{h^2} + V_i, \qquad H_{i,i\pm1} = -\frac{1}{2h^2}.$$
- Paredes infinitas são representadas por $V = 10^{12}$.
- Os autovalores são encontrados por bissecção com a sequência de Sturm: o número de sinais negativos na eliminação de $H - \lambda I$ é igual ao número de autovalores menores que $\lambda$, o que isola cada $E_n$ com precisão relativa de $10^{-13}$.
- Os autovetores vêm da iteração inversa, resolvendo $(H - \sigma I)\,y = b$ pelo algoritmo de Thomas (eliminação tridiagonal, custo $O(N)$) com $\sigma$ ligeiramente acima de $E_n$; três iterações bastam. Cada $\psi_n$ é normalizado com $\sum_i \psi_i^2\,h = 1$.
- O erro de discretização é $O(h^2)$: no poço infinito, os níveis numéricos ficam um pouco abaixo de $n^2\pi^2/(2L^2)$, com diferença relativa da ordem de $(n\pi h/L)^2/12$.
- A evolução temporal da superposição é analítica (seção 6): não há integração no tempo.`;
