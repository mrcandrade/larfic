/** Modo engenharia: derivação do modelo de elasticidade. */
export const derivation = String.raw`### 1. Tensão e deformação
Num corpo sob carga, a **tensão** é força por área e a **deformação** é a variação relativa de uma dimensão (adimensional):
- tração/compressão: $\sigma = F/A$ (força normal à seção), $\varepsilon = \Delta L/L_0$;
- cisalhamento: $\tau = F/A$ (força paralela à face), $\gamma = \Delta x/h \approx \tan\gamma$;
- compressão hidrostática: a tensão é a pressão $p$ do fluido e a deformação é $\Delta V/V$.

Usar tensão e deformação em vez de força e alongamento separa o **material** (a curva $\sigma\times\varepsilon$) da **geometria** (área e comprimento).

### 2. Lei de Hooke e os três módulos
No regime elástico a tensão é proporcional à deformação:
$$\sigma = E\,\varepsilon, \qquad \tau = G\,\gamma, \qquad p = -K\,\frac{\Delta V}{V}.$$
Para uma barra, $\Delta L = \dfrac{F L_0}{E A}$: a barra se comporta como uma mola de rigidez $k = EA/L_0$.

Num sólido **isotrópico** só há duas constantes independentes. Com o coeficiente de Poisson $\nu$ (a contração lateral é $\varepsilon_{lat} = -\nu\,\varepsilon$), a sim usa
$$G = \frac{E}{2(1+\nu)}, \qquad K = \frac{E}{3(1-2\nu)}.$$
Para $\nu \to 0{,}5$ (borracha) $K \to \infty$: o material quase não muda de volume, embora seja facílimo de esticar ($G \approx 1$ MPa contra $K \approx 2{,}5$ GPa).

### 3. Variação de volume sob pressão
Um cubo de aresta $a$ sob pressão $p$ por todos os lados sofre $\varepsilon = -p(1-2\nu)/E$ em cada direção, então
$$\frac{\Delta V}{V} = (1+\varepsilon)^3 - 1 \approx 3\varepsilon = -\frac{p}{K}, \qquad \frac{\Delta a}{a} = -\frac{p}{3K}.$$
A pressão é produzida por uma prensa hidráulica: uma força $F$ num pistão de diâmetro $d_p$ dá $p = F/(\pi d_p^2/4)$, transmitida pelo fluido (princípio de Pascal) a toda a superfície da amostra.

### 4. Além do limite elástico (tração)
A sim usa uma curva de engenharia fenomenológica, com parâmetros típicos de cada material:
- $0 \le \varepsilon \le \varepsilon_y = \sigma_y/E$: Hooke, $\sigma = E\varepsilon$.
- $\varepsilon_y < \varepsilon \le \varepsilon_u$ (encruamento): $\sigma = \sigma_y + (\sigma_u - \sigma_y)\,\dfrac{1 - e^{-(\varepsilon-\varepsilon_y)/\varepsilon_0}}{1 - e^{-3}}$, com $\varepsilon_0 = (\varepsilon_u - \varepsilon_y)/3$; chega a $\sigma_u$ (limite de resistência) em $\varepsilon_u$.
- $\varepsilon_u < \varepsilon \le \varepsilon_r$ (estricção): a seção afina localmente e a tensão de engenharia cai, $\sigma = \sigma_u - 0{,}2\,\sigma_u f^2$, $f = (\varepsilon-\varepsilon_u)/(\varepsilon_r-\varepsilon_u)$, até a ruptura em $\varepsilon_r$.
- Descarga a partir de $\varepsilon_{max}$: volta por uma reta de inclinação $E$, e sobra a **deformação permanente** $\varepsilon_p = \varepsilon_{max} - \sigma(\varepsilon_{max})/E$. Recarregando, o material segue a mesma reta e só volta a escoar em $\varepsilon_{max}$ (o limite elástico aparente subiu: encruamento).
- Materiais frágeis (vidro, concreto tracionado) seguem a reta de Hooke até romper em $\sigma_u$.
- Borracha (neo-hookeana): $\sigma = G(\lambda - 1/\lambda^2)$, $\lambda = 1+\varepsilon$; para $\varepsilon$ pequeno, $\sigma \approx 3G\,\varepsilon = E\,\varepsilon$.

A energia absorvida por volume é a área sob a curva percorrida, $w = \int\sigma\,d\varepsilon$, integrada pela regra do trapézio a cada passo (a descarga devolve a parte elástica). No elástico linear, $w = \sigma^2/2E$. A contração lateral usa $\nu$ na parte elástica e conservação de volume ($\nu_{ef} = 0{,}5$) na parte plástica.

### 5. Mesa de quatro pernas: estrutura indeterminada
Um tampo rígido com peso $W$ em $(x_w, y_w)$ sobre quatro pernas tem **quatro** forças desconhecidas $F_i$, mas só **três** equações de equilíbrio:
$$\sum F_i = W, \qquad \sum F_i\,x_i = W x_w, \qquad \sum F_i\,y_i = W y_w.$$
Com pernas perfeitamente rígidas o problema não tem solução única. A solução vem da **compatibilidade de deformações**: o tampo rígido desce como um plano, $w(x, y) = h_0 + a_x x + a_y y$, e cada perna $i$, de rigidez $k_i = E A/L$ e folga $\delta_i$ (quanto é mais curta), encurta
$$u_i = w(x_i, y_i) - \delta_i, \qquad F_i = k_i\,u_i \ \ (\text{só se } u_i > 0;\ \text{a perna não puxa o chão}).$$
Substituindo nas três equações de equilíbrio obtemos um sistema linear $3\times3$ para $(h_0, a_x, a_y)$:
$$\sum_{i\in S} k_i\,(h_0 + a_x x_i + a_y y_i - \delta_i)\,(1, x_i, y_i) = W\,(1, x_w, y_w).$$
Como o contato é unilateral, a sim testa os conjuntos $S$ de pernas em contato (as quatro e as quatro trincas) e escolhe o que é consistente: $u_i \ge 0$ nas pernas de $S$ e $u_j \le 0$ nas outras.

**Resultados analíticos que a sim reproduz:**
- Pernas iguais, sem folga: $F_i = W\left(\dfrac14 + \dfrac{x_w x_i}{a^2} + \dfrac{y_w y_i}{b^2}\right)$, com $a \times b$ o retângulo das pernas.
- Perna 4 mais curta de $\delta$ e peso no centro: com carga leve só três pernas tocam, o centro fica na diagonal 1–3 e $F_1 = F_3 = W/2$, $F_2 = 0$ (a mesa "manca"). Como o tampo é plano, $w_4 = w_1 + w_3 - w_2 = W/k$, e a perna 4 encosta quando $W/k = \delta$, isto é, $W^* = k\,\delta$. Pernas mais macias (menor $k$) igualam melhor as forças.

### 6. Método numérico
O ensaio de tração é controlado por deformação (como uma máquina de ensaios real): $\varepsilon$ cresce com taxa constante em cada trecho (30% do tempo no elástico, 70% no plástico, para que o trecho elástico fique visível), e a tensão é calculada pela curva constitutiva com histórico. A ruptura é um evento localizado por bissecção. Nos demais modos a carga cresce linearmente, $\lambda = t/T$, e a resposta é calculada em forma fechada a cada passo.`;
