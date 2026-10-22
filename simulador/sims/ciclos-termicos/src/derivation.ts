/** Modo engenharia: termodinâmica de gás ideal em processos quase-estáticos e as eficiências dos ciclos. */
export const derivation = String.raw`### 1. Hipóteses
- O fluido de trabalho é um gás ideal com $n$ mols e capacidades caloríficas constantes; $\gamma = C_P/C_V$ vale $5/3$ (monoatômico) ou $7/5$ (diatômico).
- Todos os processos são quase-estáticos (reversíveis): o gás passa por uma sucessão de estados de equilíbrio, então $P$, $V$ e $T$ estão definidos o tempo todo e o trabalho é a área sob a curva no diagrama PV.
- Não há atrito no pistão nem perdas de calor fora das etapas indicadas.

### 2. Ferramentas
Equação de estado e energia interna do gás ideal (só depende de $T$):
$$PV = nRT, \qquad U = n C_V T, \qquad C_V = \frac{R}{\gamma - 1}, \qquad C_P = C_V + R = \frac{\gamma R}{\gamma - 1}.$$
Primeira lei, com $W$ o trabalho realizado **pelo** gás:
$$dU = \delta Q - \delta W, \qquad \delta W = P\,dV.$$

### 3. Os quatro processos
**Isocórico** ($V$ constante): $W = 0$ e $Q = \Delta U = n C_V \Delta T$.

**Isobárico** ($P$ constante): $W = P\,\Delta V = nR\,\Delta T$, logo $Q = \Delta U + W = n C_P\,\Delta T$.

**Isotérmico** ($T$ constante): $\Delta U = 0$ e
$$W = \int_{V_i}^{V_f} \frac{nRT}{V}\,dV = nRT\ln\frac{V_f}{V_i} = Q.$$

**Adiabático** ($\delta Q = 0$): $n C_V\,dT = -P\,dV = -\frac{nRT}{V}\,dV$. Separando variáveis,
$$\frac{dT}{T} = -\frac{R}{C_V}\,\frac{dV}{V} = -(\gamma - 1)\,\frac{dV}{V} \;\Rightarrow\; T V^{\gamma-1} = \text{const} \;\Leftrightarrow\; P V^{\gamma} = \text{const},$$
e o trabalho é $W = -\Delta U = n C_V (T_i - T_f)$.

### 4. Eficiência
Num ciclo $\Delta U = 0$, então $W_{liq} = Q_{in} - |Q_{out}|$ e
$$\eta = \frac{W_{liq}}{Q_{in}} = 1 - \frac{|Q_{out}|}{Q_{in}}.$$

**Carnot** (isotérmicas a $T_H$ e $T_C$ ligadas por adiabáticas). As adiabáticas impõem $V_3/V_2 = V_4/V_1 = (T_H/T_C)^{1/(\gamma-1)}$, logo $V_2/V_1 = V_3/V_4$ e
$$\frac{|Q_{out}|}{Q_{in}} = \frac{nRT_C\ln(V_3/V_4)}{nRT_H\ln(V_2/V_1)} = \frac{T_C}{T_H} \;\Rightarrow\; \eta_{Carnot} = 1 - \frac{T_C}{T_H}.$$

**Otto** (adiabáticas e isocóricas, razão de compressão $r = V_1/V_2$). O calor entra e sai a volume constante: $Q_{in} = n C_V (T_3 - T_2)$, $|Q_{out}| = n C_V (T_4 - T_1)$. Nas adiabáticas $T_2 = T_1 r^{\gamma-1}$ e $T_3 = T_4 r^{\gamma-1}$, então $T_3 - T_2 = r^{\gamma-1}(T_4 - T_1)$ e
$$\eta_{Otto} = 1 - r^{1-\gamma}.$$

**Diesel** (calor entra a pressão constante, razão de corte $r_c = V_3/V_2$). $Q_{in} = n C_P (T_3 - T_2)$ e $|Q_{out}| = n C_V (T_4 - T_1)$. Com $T_2 = T_1 r^{\gamma-1}$, $T_3 = r_c T_2$ e $T_4 = T_3 (r_c/r)^{\gamma-1} = T_1 r_c^{\gamma}$:
$$\eta_{Diesel} = 1 - \frac{1}{\gamma}\,\frac{T_4 - T_1}{T_3 - T_2} = 1 - \frac{r_c^{\gamma} - 1}{\gamma\,r^{\gamma-1}\,(r_c - 1)}.$$

**Brayton** (adiabáticas e isobáricas, razão de pressões $r_p$). Nas adiabáticas $T_2/T_1 = T_3/T_4 = r_p^{(\gamma-1)/\gamma}$; com $Q_{in} = n C_P (T_3 - T_2)$ e $|Q_{out}| = n C_P (T_4 - T_1)$:
$$\eta_{Brayton} = 1 - r_p^{(1-\gamma)/\gamma}.$$

**Stirling** (isotérmicas e isocóricas). Sem regenerador, o calor das isocóricas também entra pelo reservatório quente: $Q_{in} = nRT_H\ln r + n C_V (T_H - T_C)$, e a eficiência fica abaixo da de Carnot. Com um regenerador ideal, o calor da isocórica de resfriamento é reaproveitado no aquecimento e $\eta \to 1 - T_C/T_H$.

### 5. Método numérico: como a simulação percorre o ciclo
- Os quatro estados de cada ciclo são calculados em forma fechada a partir de $n$, $\gamma$, $T_H$, $T_C$, $V_{max}$ e das razões $r$, $r_c$, $r_p$.
- Um parâmetro de progresso $u \in [0, 4]$ cresce linearmente no tempo ($\dot u = 1/\tau$, Euler com passo de 5 ms, que é exato para derivada constante); a parte inteira de $u$ escolhe a etapa e a fração $\lambda$ dá o ponto ao longo dela.
- Nas isotérmicas e adiabáticas o volume varia geometricamente, $V = V_A (V_B/V_A)^{\lambda}$, e $T$ vem da lei do processo; nas isocóricas $T$ varia linearmente; nas isobáricas, $V$.
- $Q$, $W$ e $\Delta U$ acumulados até o ponto atual vêm das fórmulas exatas acima (não de integração numérica), e a eficiência medida $W_{liq}/Q_{in}$ deve coincidir com a fórmula teórica do ciclo.`;
