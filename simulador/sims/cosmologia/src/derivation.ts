/** Modo engenharia: modelos e métodos da sim de cosmologia. */
export const derivation = String.raw`### 1. Hipóteses, unidades e constantes
- Distâncias cosmológicas em megaparsecs (1 Mpc $= 3{,}086\times10^{22}$ m), velocidades em km/s, tempos em bilhões de anos (Gyr). Daí $1/H_0 = 977{,}8/H_0$ Gyr com $H_0$ em km/s/Mpc.
- Galáxias: raios em kpc, massas em massas solares, $G = 4{,}301\times10^{-6}$ kpc (km/s)$^2/M_\odot$.
- Radiação de fundo: $T_0 = 2{,}7255$ K (COBE/FIRAS); razão bárions/fótons $\eta = 6{,}1\times10^{-10}$; parâmetros ΛCDM do Planck 2018 ($\Omega_m = 0{,}315$, $\Omega_\Lambda \approx 0{,}685$, $H_0 = 67{,}4$ km/s/Mpc, $\Omega_r = 9{,}15\times10^{-5}$ contando fótons e três neutrinos sem massa).

### 2. Expansão homogênea e a lei de Hubble
Num universo homogêneo e isotrópico toda distância própria escala com um único fator, $\vec r(t) = a(t)\,\vec x$, com $\vec x$ fixo (coordenada comóvel). Derivando, $\dot{\vec r} = (\dot a/a)\,\vec r = H\vec r$. Para duas galáxias quaisquer, $\vec v_2 - \vec v_1 = H(\vec r_2 - \vec r_1)$: todo observador vê a mesma lei, sem centro.

Na animação $H$ é mantido constante, $a = e^{Ht}$, durante alguns bilhões de anos: é só para visualizar; a evolução real de $H(t)$ está no tema "Big bang". A velocidade medida é a radial, $v = H d + \vec u\cdot\hat d$, onde $\vec u$ é a velocidade peculiar relativa (gaussiana com desvio $\sigma_v$ por componente). A distância medida tem erro relativo gaussiano $\sigma_d$. Para $z \ll 1$ o redshift é $z \approx v/c$.

**Ajuste.** Minimizando $\sum (v_i - Hd_i)^2$ para uma reta pela origem: $H = \sum v_id_i/\sum d_i^2$, com incerteza $\sigma_H = \sqrt{\sum r_i^2/[(N - 1)\sum d_i^2]}$ ($r_i$ = resíduos).

### 3. Radiação de fundo
Fótons livres num universo em expansão mantêm o espectro de corpo negro: cada frequência cai como $\nu \propto 1/a$ e a densidade de fótons como $a^{-3}$, o que equivale a um corpo negro com $T \propto 1/a$, ou $T = T_0(1 + z)$. A radiância espectral é a de Planck,
$$B_\nu(T) = \frac{2h\nu^3}{c^2}\,\frac{1}{e^{h\nu/kT} - 1},$$
com pico em $h\nu = 2{,}821\,kT$ (160 GHz hoje) e, por comprimento de onda, em $\lambda_\text{máx} = 2{,}898\ \text{mm·K}/T$. Integrando: $n_\gamma = \frac{2\zeta(3)}{\pi^2}\left(\frac{kT}{\hbar c}\right)^3 \approx 411\ \text{cm}^{-3}$ e $u = aT^4 \approx 4{,}2\times10^{-14}$ J/m³ hoje.

**Recombinação (Saha).** Em equilíbrio térmico, $p + e^- \rightleftharpoons \text{H} + \gamma$ dá
$$\frac{X_e^2}{1 - X_e} = \frac{1}{n_b}\left(\frac{m_ekT}{2\pi\hbar^2}\right)^{3/2} e^{-B/kT}, \qquad B = 13{,}6\ \text{eV},\ n_b = \eta\,n_\gamma,$$
desprezando o hélio. A sim resolve a quadrática na forma estável $X_e = 2S/(S + \sqrt{S^2 + 4S})$. Com $\eta \sim 10^{-9}$ o fator $1/n_b$ é enorme, e $X_e = 1/2$ só ocorre em $T \approx 3760$ K ($z \approx 1380$). O desacoplamento real ($z \approx 1090$, $T \approx 2970$ K) é mais tardio porque a recombinação sai do equilíbrio (fótons de Lyman-α reionizam átomos); esse valor observado é marcado no gráfico.

**Animação dos fótons.** Na caixa comóvel, cada fóton anda em linha reta e muda de direção ao acaso com taxa proporcional a $X_e$ (espalhamento Thomson pelos elétrons livres). O comprimento de onda desenhado cresce com $a$ (escala comprimida para caber na tela).

### 4. Curvas de rotação
Para órbitas circulares no plano do disco, $v^2/r = |\partial\Phi/\partial r|$. As contribuições se somam em quadratura, $v^2 = \sum_k v_k^2$:
- **Disco exponencial fino** (estrelas e gás), $\Sigma(R) = \Sigma_0e^{-R/R_d}$, $M = 2\pi\Sigma_0R_d^2$ (Freeman, 1970):
$$v_\text{disco}^2 = \frac{2GM}{R_d}\,y^2\left[I_0(y)K_0(y) - I_1(y)K_1(y)\right],\quad y = \frac{r}{2R_d},$$
com $I_n$, $K_n$ funções de Bessel modificadas (aproximações polinomiais de Abramowitz e Stegun, erro relativo $< 10^{-7}$). O máximo fica em $r \approx 2{,}15R_d$ e para $r \gg R_d$ tende a $GM/r$ (Kepler).
- **Bojo de Hernquist:** $v^2 = GMr/(r + a)^2$.
- **Halo isotérmico com núcleo:** $\rho = \rho_0/(1 + r^2/r_c^2)$, logo $M(r) = 4\pi\rho_0r_c^2\left[r - r_c\arctan(r/r_c)\right]$ e $v^2 = GM(r)/r$. Longe do núcleo $M \propto r$ e $v$ fica constante. A sim normaliza $\rho_0$ pela massa do halo dentro do último raio medido, $M_h(R_\text{máx})$, que é o parâmetro ajustado.

Os "dados" são sintéticos: o modelo com um halo de referência mais ruído gaussiano de 3–5% (semente fixa). O ajuste usa $\chi^2_\nu = \frac{1}{N - 1}\sum[(v_i - v_\text{modelo})/\sigma_i]^2$; o melhor $M_h$ é encontrado por busca ternária em $\log M_h$. A massa dinâmica é $M = v^2r/G$.

### 5. Friedmann
Da relatividade geral para um universo homogêneo (ou, de forma newtoniana, da energia de uma casca esférica em expansão):
$$H^2 = \left(\frac{\dot a}{a}\right)^2 = H_0^2\left(\Omega_ra^{-4} + \Omega_ma^{-3} + \Omega_ka^{-2} + \Omega_\Lambda\right),\qquad \Omega_k = 1 - \Omega_r - \Omega_m - \Omega_\Lambda.$$
A radiação dilui como $a^{-4}$ (número $\propto a^{-3}$ e energia de cada fóton $\propto a^{-1}$), a matéria como $a^{-3}$ e a energia do vácuo é constante. Derivando e usando a conservação de energia, vem a equação da aceleração
$$\frac{\ddot a}{a} = -\frac{H_0^2}{2}\left(2\Omega_ra^{-4} + \Omega_ma^{-3} - 2\Omega_\Lambda\right),$$
que vale também quando $\dot a$ muda de sinal (universo fechado que recolapsa). O parâmetro de desaceleração é $q = -\ddot aa/\dot a^2$.

Soluções de um componente: radiação $a \propto t^{1/2}$, matéria $a \propto t^{2/3}$ (idade $\tfrac23H_0^{-1}$), $\Lambda$ $a \propto e^{Ht}$.

### 6. Método numérico
- **Idade:** $t(a) = \int_0^a \frac{da'}{a'H(a')}$. Com $a' = u^2$, o integrando vira $2/[uH_0\sqrt{E^2(u^2)}]$, finito em $u = 0$ quando há matéria ou radiação; regra de Simpson com 2000 intervalos (erro relativo $< 10^{-6}$ no ΛCDM: 13,79 Gyr).
- **a(t):** o estado $[a, \dot a]$ é integrado por Runge–Kutta de 4ª ordem a partir de $a = 0{,}01$ (onde $t$ vem da integral acima), com subpassos $h \le \min(0{,}02\ \text{Gyr},\ 0{,}02/H)$. A animação avança 1 Gyr por segundo.
- **Eventos da linha do tempo:** nucleossíntese em $T = 10^9$ K ($a = T_0/T$), igualdade matéria–radiação em $a = \Omega_r/\Omega_m$, desacoplamento em $z = 1090$, primeiras estrelas em $z \approx 20$ e início da aceleração em $q = 0$, isto é $a = (\Omega_m/2\Omega_\Lambda)^{1/3}$ (desprezando a radiação).
- Se $E^2(a) \le 0$ para algum $0 < a \le 1$, não houve big bang (o universo teria passado por um mínimo de $a$); a idade fica indefinida e a animação começa em $a = 1$.`;
