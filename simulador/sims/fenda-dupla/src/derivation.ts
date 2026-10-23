/** Modo engenharia: interferência de duas fendas com difração de Fraunhofer de cada uma. */
export const derivation = String.raw`### 1. Hipóteses
- Luz monocromática de comprimento de onda $\lambda$, coerente, incidindo como onda plana normal ao anteparo (ou um espectro plano de 400 a 700 nm no caso da luz branca, tratado como soma incoerente de comprimentos de onda).
- Duas fendas idênticas, longas, de largura $a$, com centros separados por $d$; a tela fica a uma distância $L$ muito maior que $d$ e que $a^2/\lambda$ (regime de Fraunhofer: os raios que chegam a um ponto da tela são praticamente paralelos).
- Teoria escalar da difração (princípio de Huygens–Fresnel), sem efeitos de polarização; a variação lenta da obliquidade e da distância à tela é desprezada.

### 2. Uma fenda: envoltória de difração
Cada ponto da fenda, na posição $s \in [-a/2, a/2]$, é fonte de uma onda secundária. Na direção $\theta$, sua diferença de caminho em relação ao centro é $s\sin\theta$, o que dá uma fase $k s\sin\theta$ com $k = 2\pi/\lambda$. Somando (integrando) as contribuições:
$$E_1(\theta) \propto \int_{-a/2}^{a/2} e^{i k s\sin\theta}\,ds = a\,\frac{\sin\beta}{\beta}, \qquad \beta = \frac{\pi a\sin\theta}{\lambda}.$$
A intensidade de uma fenda é $I_1 \propto (\sin\beta/\beta)^2$: máximo central em $\theta = 0$ e zeros em $a\sin\theta = p\lambda$, $p = \pm1, \pm2, \dots$

### 3. Duas fendas: interferência
As fendas estão em $s = \pm d/2$; a segunda soma é a mesma da primeira deslocada, o que só multiplica o campo por uma fase. O campo total é
$$E(\theta) = E_1(\theta)\left(e^{i\alpha} + e^{-i\alpha}\right) = 2E_1(\theta)\cos\alpha, \qquad \alpha = \frac{\pi d\sin\theta}{\lambda},$$
e a intensidade, normalizada pelo máximo central, é
$$\frac{I(\theta)}{I_0} = \cos^2\!\left(\frac{\pi d\sin\theta}{\lambda}\right)\left[\frac{\sin\beta}{\beta}\right]^2.$$
O fator $\cos^2\alpha$ vem da interferência entre as fendas; o fator $(\sin\beta/\beta)^2$ é a difração de cada fenda e funciona como envoltória.

### 4. Máximos, zeros e franjas
- Máximos de interferência: $d\sin\theta = m\lambda$ (diferença de caminho igual a um número inteiro de comprimentos de onda).
- Zeros da envoltória: $a\sin\theta = p\lambda$. Quando um máximo de interferência coincide com um zero da envoltória ($m/d = p/a$), essa ordem desaparece (ordem ausente).
- Dentro do máximo central de difração, $|\sin\theta| < \lambda/a$, cabem as ordens com $|m| < d/a$: são $2\lceil d/a\rceil - 1$ franjas claras, descontando a que cai exatamente no zero.
- Na tela, a posição é $y = L\tan\theta$, de modo que $\sin\theta = y/\sqrt{y^2 + L^2}$ (relação exata usada pela simulação). Para ângulos pequenos $\sin\theta \approx y/L$ e as franjas ficam igualmente espaçadas:
$$\Delta y \approx \frac{\lambda L}{d}.$$

### 5. Luz branca
Comprimentos de onda diferentes não interferem entre si (em média temporal), então as intensidades se somam. O centro ($y = 0$) é claro para todos os $\lambda$ e fica branco; fora dele, as franjas de cada cor têm espaçamento $\lambda L/d$ diferente e se separam, produzindo bordas coloridas que se misturam até ficarem acinzentadas longe do centro.

### 6. Método numérico
Não há equação diferencial: a intensidade é calculada diretamente pela fórmula da seção 3 em cada ponto da tela. A cor de cada $\lambda$ vem de uma aproximação por partes do espectro visível (Bruton), e para a luz branca a cor é a média, sobre 61 comprimentos de onda de 400 a 700 nm, das cores ponderadas pela intensidade. O tempo da simulação só move o detector, que varre a tela de uma ponta à outra para traçar o gráfico de $I(y)$.`;
