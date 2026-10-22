/** Modo engenharia: da lei da gravitação ao túnel através da Terra e ao princípio da equivalência. */
export const derivation = String.raw`### 1. Hipóteses
- Gravitação newtoniana, sem efeitos relativísticos (exceto o argumento qualitativo da seção 6 sobre a luz).
- Terra esférica de massa $M = 5{,}972\times10^{24}$ kg e raio médio $R = 6371$ km, com densidade que só depende de $r$; rotação rígida com o dia sideral (23,93 h) por padrão.
- No túnel: sem atrito, sem ar e com paredes rígidas; no elevador: campo uniforme dentro da cabine (sem efeitos de maré).
- Unidades SI; o tempo físico do túnel e do elevador é reescalado só para a animação.

### 2. Lei da gravitação e superposição
Duas partículas se atraem com força de módulo $F = Gm_1m_2/r^2$ ao longo da reta que as une, com $G = 6{,}674\times10^{-11}$ N·m²/kg². A força é linear na massa de cada fonte, então várias fontes simplesmente se somam como vetores:
$$\vec F_0 = \sum_i \frac{G m_0 m_i}{|\vec r_i - \vec r_0|^3}\,(\vec r_i - \vec r_0).$$
A simulação calcula cada termo em componentes cartesianas e soma. O campo $\vec g = \vec F_0/m_0$ não depende da massa de teste. As esferas são desenhadas com o raio de uma esfera de chumbo da mesma massa; pelo teorema das cascas (seção 4), uma esfera homogênea atrai como se toda a massa estivesse no centro.

### 3. g com a altitude, a latitude e a rotação
Para uma Terra esférica de massa $M$ e raio $R$, a aceleração gravitacional a uma altitude $h$ é
$$g(h) = \frac{GM}{(R + h)^2} \approx g_0\left(1 - \frac{2h}{R}\right)\quad (h \ll R).$$
Quem está parado na superfície gira com a Terra em torno do eixo, num círculo de raio $\rho = r\cos\varphi$. A balança mede a força normal $\vec N$, e a segunda lei no referencial inercial dá
$$\vec N + m\vec g = -m\,\omega^2\rho\,\hat\rho \;\Rightarrow\; \vec N = -m\left(\vec g + \omega^2\rho\,\hat\rho\right) = -m\,\vec g_{ef}.$$
Decompondo nas direções radial (para cima) e norte:
$$g_{ef,\,r} = -g + \omega^2 r\cos^2\varphi, \qquad g_{ef,\,N} = -\omega^2 r\cos\varphi\sin\varphi.$$
No equador o peso aparente é $m(g - \omega^2R)$, cerca de 0,34% menor; nos polos não há correção. Com $\omega = 2\pi/T_{dia}$, o peso aparente no equador some quando $\omega^2R = g$, ou seja $T_{dia} = 2\pi\sqrt{R/g} \approx 1{,}4$ h. A mesma condição, $\omega^2 r = GM/r^2$, dá o raio da órbita geoestacionária, $r = (GM/\omega^2)^{1/3} \approx 42\,164$ km.

A Terra real é um elipsoide achatado (raio equatorial 21 km maior que o polar), o que soma outro efeito de mesmo sinal. A curva tracejada usa a fórmula de Somigliana para o elipsoide WGS 84:
$$g(\varphi) = 9{,}7803\,\frac{1 + 0{,}0019319\,\sin^2\varphi}{\sqrt{1 - 0{,}0066944\,\sin^2\varphi}}\ \text{m/s}^2.$$

### 4. Teorema das cascas e o interior
Uma casca esférica homogênea (i) atrai um ponto externo como se toda a sua massa estivesse no centro e (ii) exerce força resultante nula em qualquer ponto interno: as partes próximas puxam mais forte, mas as distantes são maiores, e os ângulos sólidos se compensam exatamente porque a força cai com $1/r^2$. Pela lei de Gauss da gravitação, $\oint \vec g\cdot d\vec A = -4\pi G M_{int}$, que com simetria esférica dá
$$g(r) = \frac{G\,M(r)}{r^2}, \qquad M(r) = \int_0^r 4\pi r'^2\rho(r')\,dr'.$$
- **Uniforme:** $M(r) = M r^3/R^3$ e $g = (GM/R^3)\,r$, linear até a superfície.
- **Núcleo + manto:** núcleo de raio $r_c = 3480$ km e densidade $\rho_c$; a densidade do manto é escolhida para que a massa total seja a da Terra, $\rho_m = \big(M - \tfrac43\pi r_c^3\rho_c\big)/\big(\tfrac43\pi(R^3 - r_c^3)\big)$. Com $\rho_c = 10{,}9$ g/cm³, $\rho_m \approx 4{,}5$ g/cm³ e $g(r_c) \approx 10{,}6$ m/s², próximo do modelo sismológico PREM.
- **Casca oca:** $M(r) = 0$ dentro, então $g = 0$.

### 5. Túnel através da Terra
Um túnel reto passa a uma distância $b$ do centro. Seja $s$ a posição ao longo dele, medida do ponto mais próximo do centro, com $r = \sqrt{s^2 + b^2}$. As paredes (sem atrito) anulam a componente de $\vec g$ perpendicular ao túnel; a componente ao longo dele é
$$\ddot s = -g(r)\,\frac{s}{r}.$$
Na Terra uniforme, $g(r)/r = GM/R^3$ e a equação vira um MHS que não depende de $b$:
$$\ddot s = -\omega^2 s, \qquad \omega = \sqrt{\frac{GM}{R^3}}, \qquad T = 2\pi\sqrt{\frac{R^3}{GM}} \approx 84{,}3\ \text{min}.$$
É o mesmo período de um satélite em órbita rasante ($v^2/R = GM/R^2$), cuja projeção sobre o diâmetro é exatamente esse MHS (o círculo de referência). A velocidade máxima, $\omega\sqrt{R^2 - b^2}$, é a velocidade orbital (7,9 km/s) no túnel diametral. Com o núcleo denso, $g(r)/r$ cresce para dentro, o movimento deixa de ser harmônico e a travessia é mais curta.

A energia por unidade de massa $\varepsilon = \tfrac12 v^2 + U(r)$ se conserva, com $U(r) = -GM/R - \int_r^R g\,dr'$. Em cada camada de densidade constante, $g = G\big[k/r^2 + \tfrac43\pi\rho r\big]$ com $k = M(r_0) - \tfrac43\pi\rho r_0^3$, e a integral é feita em forma fechada.

### 6. Princípio da equivalência
Na cabine que acelera com $\vec a$ em relação a um referencial inercial, onde existe um campo $\vec g$, um corpo livre tem aceleração $\vec g$ (inercial) e aceleração relativa
$$\vec g_{ap} = \vec g - \vec a.$$
- Parada na Terra: $\vec g_{ap} = \vec g$. Foguete com $\vec a = -\vec g$ longe de massas: o mesmo $\vec g_{ap}$. Nenhum experimento mecânico local distingue os dois casos.
- Em queda livre ($\vec a = \vec g$) ou à deriva ($\vec g = \vec a = 0$): $\vec g_{ap} = 0$.

Einstein estendeu a equivalência a **todos** os fenômenos, inclusive a luz. Um pulso emitido na horizontal atravessa a cabine de largura $L$ em $L/c$; no foguete, o piso sobe $\tfrac12 a(L/c)^2$ nesse tempo, e de dentro o pulso parece cair essa distância. Pela equivalência, a gravidade também curva a luz. Para $L = 4$ m e $a = 9{,}8$ m/s², o desvio é $\approx 9\times10^{-16}$ m, por isso o desenho usa uma luz de 10 m/s. (A relatividade geral prevê, para um raio que passa rente ao Sol, o dobro do valor obtido só com este argumento: 1,75″, medido no eclipse de 1919.)

### 7. Método numérico
- Superposição, $g(h)$, $g(r)$ e o elevador usam fórmulas fechadas; o elevador é avaliado analiticamente em cada instante.
- O túnel é integrado com Runge–Kutta de 4ª ordem no estado $(s, v)$. O tempo físico corre 240 vezes mais rápido que o relógio do app (o elevador, 2 vezes mais devagar), com passo físico de 1,2 s, muito menor que $T/2\pi \approx 806$ s: o erro relativo na energia fica abaixo de $10^{-10}$.
- O instante de chegada à outra boca é o zero da velocidade, localizado por interpolação linear dentro do passo.`;
