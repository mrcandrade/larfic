/** Modo engenharia: bloco, mola, atrito de Coulomb e força externa; teorema trabalho-energia. */
export const derivation = String.raw`### 1. Hipóteses
- Bloco rígido de massa $m$ que desliza numa mesa horizontal; só o movimento em $x$ importa (peso e normal se cancelam: $N = mg$).
- Mola ideal (lei de Hooke), sem massa, com constante $k$; $x$ é medido a partir do comprimento natural.
- Atrito seco de Coulomb com o mesmo coeficiente $\mu$ para o estático e o cinético; $g = 9{,}81\ \text{m/s}^2$.
- Força externa horizontal $F$ constante, que pode ser mudada ao vivo.

### 2. Forças
$$F_{mola} = -k x, \qquad F_{ext} = F, \qquad F_{at} = \begin{cases} -\mu m g\,\operatorname{sgn}(\dot x), & \dot x \neq 0 \\ -(F - kx), & \dot x = 0 \text{ e } |F - kx| \le \mu m g \\ -\mu m g\,\operatorname{sgn}(F - kx), & \dot x = 0 \text{ e } |F - kx| > \mu m g \end{cases}$$
Parado, o atrito estático equilibra o que for preciso até o limite $\mu m g$; em movimento, o cinético tem módulo fixo e se opõe à velocidade.

### 3. Equação de movimento
$$m\ddot x = -k x + F + F_{at}.$$
Em cada meia oscilação o atrito é constante, então o movimento é um MHS em torno de um equilíbrio deslocado $x_\pm = (F \mp \mu m g)/k$ (sinal conforme o sentido do movimento). Cada meia oscilação reduz a amplitude, medida a partir de $F/k$, de $2\mu m g/k$: o decaimento é **linear**, não exponencial como no amortecimento viscoso. O bloco para quando, num ponto de retorno, $|F - kx| \le \mu m g$.

### 4. Trabalho, potência e energia
O trabalho de uma força ao longo do caminho e sua potência instantânea são
$$W = \int \vec F\cdot d\vec r = \int F_x\,\dot x\,dt, \qquad P = \vec F\cdot\vec v.$$
Multiplicando a equação de movimento por $\dot x$:
$$\frac{d}{dt}\left(\tfrac12 m\dot x^2 + \tfrac12 k x^2\right) = F\dot x + F_{at}\dot x.$$
A mola é conservativa, com $U_{el} = \tfrac12 k x^2$ (pois $-dU/dx = -kx$). Definindo a energia dissipada pelo atrito $W_{at} = -\int F_{at}\dot x\,dt \ge 0$ e o trabalho da força externa $W_F = \int F\dot x\,dt$, chega-se ao balanço exibido:
$$K + U_{el} + W_{at} - W_F = E_0.$$

### 5. Casos de referência
Sem atrito e sem força externa, $x(t) = A\cos(\omega t + \varphi)$ com $\omega = \sqrt{k/m}$ e a energia se divide entre $K$ e $U_{el}$; a velocidade máxima é $v_{max} = A\sqrt{k/m}$, pois $\tfrac12 k A^2 = \tfrac12 m v_{max}^2$.

### 6. Método numérico
- Estado: $(x, \dot x, W_{at}, W_F)$, com $\dot W_{at} = -F_{at}\dot x$ e $\dot W_F = F\dot x$ integrados junto com o movimento, para que o balanço seja uma verificação independente.
- Runge–Kutta de 4ª ordem com passo $h = 0{,}5$ ms.
- A descontinuidade do atrito em $\dot x = 0$ é tratada à parte: se a velocidade troca de sinal dentro de um passo e a força resultante sem atrito, $|F - kx|$, não vence $\mu m g$, a velocidade é zerada e o bloco fica preso pelo atrito estático. Sem isso, o integrador faria o bloco tremer em torno da parada.`;
