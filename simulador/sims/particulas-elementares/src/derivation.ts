/** Modo engenharia: de onde vêm as regras e as contas da sim de partículas elementares. */
export const derivation = String.raw`### 1. Dados e unidades
- Massas em MeV/$c^2$, energias em MeV e momentos em MeV/$c$ (na prática, $c = 1$ nas contas). Valores de massa, vida média, largura e modos de decaimento do *Review of Particle Physics* (PDG, 2024). Para ressonâncias, a vida média vem da largura: $\tau = \hbar/\Gamma$, com $\hbar = 6{,}582\times10^{-22}$ MeV·s.
- Massas dos quarks: massas "de corrente" do PDG ($u \approx 2{,}2$, $d \approx 4{,}7$, $s \approx 94$, $c \approx 1273$ MeV/$c^2$). Elas não somam a massa dos hádrons; a diferença é energia de interação.
- Neutrinos são tratados como sem massa (os limites atuais são menores que 1 eV, irrelevantes nestas contas).

### 2. Números quânticos aditivos
Cada partícula carrega carga $Q$, número bariônico $B$ ($+1$ para bárions, $+\tfrac13$ por quark), números leptônicos $L_e$, $L_\mu$, $L_\tau$ ($+1$ para o lépton e o seu neutrino, $-1$ para as antipartículas) e estranheza $S = -(n_s - n_{\bar s})$. A antipartícula tem todos os números com sinal trocado e a mesma massa e vida média (teorema CPT).

Uma reação $a + b \to c + d + \dots$ conserva uma grandeza aditiva $X$ quando $\sum X_\text{antes} = \sum X_\text{depois}$. A sim soma cada coluna e compara com tolerância de $10^{-9}$ (as frações de quark são exatas em ponto flutuante até essa ordem).

### 3. Qual interação permite a reação
Hipóteses do modelo (as mesmas da discussão do capítulo):
- $Q$, $B$, $L_e$, $L_\mu$, $L_\tau$ se conservam em **todas** as interações (as oscilações de neutrinos violam os $L$ de família, mas só ao longo de distâncias macroscópicas; elas não aparecem num vértice).
- A **forte** e a **eletromagnética** conservam a estranheza. A **fraca** pode mudar o sabor de um quark por vez: $|\Delta S| \le 1$. Mudanças $|\Delta S| = 2$ não ocorrem num único processo.
- Só a fraca age sobre neutrinos. Fótons e léptons carregados não sentem a forte.

Daí a regra de classificação: (i) há neutrino ou $\Delta S \ne 0$ → fraca; (ii) senão, se há fóton ou lépton → eletromagnética; (iii) senão (só hádrons) → forte. A ordem importa: a sim aponta a interação mais forte capaz de produzir o processo, que é a que domina.

### 4. Momento angular
O spin total é a soma de spins e momentos orbitais. Momento orbital é inteiro, então a paridade do número de férmions (partículas de spin semi-inteiro) precisa ser a mesma dos dois lados. É isso que proíbe $n \to p + e^-$ mesmo conservando carga e energia: $\tfrac12 \to \tfrac12 + \tfrac12$ não fecha.

### 5. Energia: decaimentos e limiares
Num decaimento em repouso, $Q = (m_\text{pai} - \sum m_f)c^2$ precisa ser positivo. Numa colisão com o projétil 1 (energia total $E_1 = K + m_1$) contra o alvo 2 parado, o invariante
$$s = (E_1 + m_2)^2 - p_1^2 = m_1^2 + m_2^2 + 2m_2E_1$$
é a energia disponível no centro de massa ao quadrado. A reação só ocorre se $\sqrt s \ge \sum m_f$, o que dá o limiar
$$K_\text{lim} = \frac{(\sum m_f)^2 - (m_1 + m_2)^2}{2m_2}.$$
Exemplo: $p + p \to p + p + \pi^0$ exige $K \ge 279{,}7$ MeV, mais que o dobro de $m_\pi = 135$ MeV, porque parte da energia vai para o movimento do centro de massa.

### 6. Vida média no laboratório
Uma partícula com energia cinética $K$ tem $\gamma = 1 + K/mc^2$ e $\beta = \sqrt{1 - 1/\gamma^2}$. A vida média medida no laboratório é $\gamma\tau$ (dilatação do tempo), e a distância média de voo é $L = \gamma\beta c\tau$. A probabilidade de sobreviver até $x$ é $e^{-x/L}$.

### 7. Caminho óctuplo
Para cada hádron, $I_3 = Q - (B + S)/2$ (relação de Gell-Mann–Nishijima). No plano $(I_3, S)$ os bárions de spin ½ formam um octeto (hexágono com dois estados no centro), os de spin 3/2 um decupleto (triângulo) e os mésons de spin 0 um noneto. As retas de carga constante são $I_3 = Q - B/2 - S/2$: inclinadas, porque cada unidade de estranheza desloca $I_3$ de ½.
- **Decupleto:** a massa cresce quase linearmente com $-S$ (cada quark $s$ no lugar de um $u$ ou $d$). Com as médias das três primeiras linhas, $m_\Omega \approx m_{\Xi^*} + (m_{\Xi^*} - m_\Delta)/2 \approx 1683$ MeV; o medido é $1672{,}45$ MeV.
- **Octeto:** a relação de Gell-Mann–Okubo $\tfrac12(m_N + m_\Xi) = \tfrac14(3m_\Lambda + m_\Sigma)$ vale com erro de ~0,6%.

### 8. Quarks, cor e identificação dos hádrons
A sacola soma $Q = \sum q_i$, $B = \sum B_i$, $S$ e charme. Só são aceitos singletos de cor com até três peças: $qqq$, $\bar q\bar q\bar q$ e $q\bar q$. O hádron é procurado numa tabela pelo conteúdo de sabores e pelo spin (½ ou 3/2 para bárions; 0 ou 1 para mésons). Três quarks iguais no estado fundamental (onda espacial simétrica, cor antissimétrica) precisam de spin simétrico, logo spin 3/2: não existe $uuu$ de spin ½. Estados neutros $u\bar u$, $d\bar d$, $s\bar s$ são misturas na natureza ($\pi^0$, $\eta$, $\eta'$, $\rho^0$, $\omega$, $\phi$); a sim indica o estado principal e avisa da mistura.

### 9. Aniquilação $e^+e^- \to \gamma\gamma$
Com o elétron parado e o pósitron com energia $E_+ = K + m$: $\sqrt s = \sqrt{2m^2 + 2mE_+}$ e o centro de massa se move com $\beta = p_+/(E_+ + m)$, $\gamma = (E_+ + m)/\sqrt s$. No CM os fótons têm $E^* = \sqrt s/2$ e saem opostos, em $\theta^*$ e $\theta^* + \pi$. A transformação de Lorentz dá
$$E_{1,2} = \gamma E^*(1 \pm \beta\cos\theta^*), \qquad \tan\theta_\text{lab} = \frac{\sin\theta^*}{\gamma(\cos\theta^* + \beta)}.$$
Soma: $E_1 + E_2 = 2\gamma E^* = E_+ + m$; momento: $E_1\cos\theta_1 + E_2\cos\theta_2 = 2\gamma\beta E^* = p_+$. As duas leis fecham exatamente. Um único fóton não basta, pois teria massa invariante nula, enquanto $\sqrt s \ge 2m$.

### 10. Produção de pares
No vácuo, $\gamma \to e^+e^-$ é impossível: a massa invariante do fóton é zero e a do par é no mínimo $2m$. Junto a um núcleo de massa $M$, o limiar sai de $s = M^2 + 2ME_\gamma \ge (M + 2m)^2$:
$$E_\gamma \ge 2mc^2\left(1 + \frac{m}{M}\right).$$
Acima do limiar a sim escolhe os ângulos ($\pm\theta$) e a divisão da energia cinética (fração $f$) do par; o núcleo recebe o momento que falta, $\vec q = \vec p_\gamma - \vec p_- - \vec p_+$, e a energia total do par é achada por bissecção para que $E_\gamma + M = E_- + E_+ + \sqrt{M^2 + q^2}$. Como $M \gg m$, a energia de recuo $q^2/2M$ é de poucos eV a keV.

### 11. Método numérico
Não há integração no tempo: o relógio só anima a cena. Todas as grandezas são calculadas em forma fechada; a única iteração é a bissecção (80 passos, precisão de máquina) da produção de pares.`;
