/** Modo engenharia: do princípio de exclusão à tabela periódica e à lei de Moseley. */
export const derivation = String.raw`### 1. Hipóteses
- Átomos não relativísticos na aproximação de campo central (modelo de partículas independentes); as exceções de configuração e as energias vêm de medidas.
- Nos poços, os elétrons não interagem entre si e as paredes são infinitas; só o spin e o princípio de exclusão os acoplam.
- Na lei de Moseley, modelo de Bohr para o par de níveis $K$ e $L$ com blindagem de uma carga.
- Energias em eV (ou keV) e comprimentos em nm ou pm.

### 2. Estados de um elétron num átomo
Na aproximação de campo central, cada elétron se move no potencial médio $V(r)$ do núcleo e dos outros elétrons. Como $V$ só depende de $r$, os estados ainda são rotulados como no hidrogênio: $n = 1, 2, \dots$; $l = 0, \dots, n-1$; $m_l = -l, \dots, +l$; e o spin $m_s = \pm\tfrac12$. Uma subcamada $(n, l)$ tem $2l + 1$ orbitais e, portanto, $2(2l+1)$ estados: 2, 6, 10 e 14 para $s, p, d, f$.

A diferença em relação ao hidrogênio é que a energia passa a depender de $l$: um elétron com $l$ pequeno penetra mais perto do núcleo, onde a blindagem é menor, e fica mais ligado. Por isso $4s$ fica abaixo de $3d$ nos átomos neutros leves.

### 3. Princípio de exclusão e preenchimento
Pauli: dois elétrons não podem ocupar o mesmo estado $(n, l, m_l, m_s)$; equivalentemente, a função de onda de vários elétrons é antissimétrica pela troca de dois deles. No estado fundamental, os $Z$ elétrons ocupam os estados disponíveis de menor energia.

A **regra de Madelung** resume a ordem empírica: subcamadas em ordem crescente de $n + l$ e, no empate, de $n$:
$$1s,\,2s,\,2p,\,3s,\,3p,\,4s,\,3d,\,4p,\,5s,\,4d,\,5p,\,6s,\,4f,\,5d,\,6p,\,7s,\,5f,\,6d,\,7p.$$
Ela falha em 20 elementos até $Z = 103$ (Cr, Cu, Nb, Mo, Ru, Rh, Pd, Ag, La, Ce, Gd, Pt, Au, Ac, Th, Pa, U, Np, Cm, Lr), em que a configuração medida desloca um ou dois elétrons, em geral para formar uma subcamada $d$ ou $f$ cheia ou pela metade. A opção **Configuração real** aplica essas correções.

### 4. Regras de Hund
Numa subcamada incompleta, o estado de menor energia:
1. tem o **máximo spin total** $S$: os elétrons ocupam orbitais diferentes com spins paralelos, porque a antissimetria os mantém afastados e reduz a repulsão (energia de troca);
2. com $S$ máximo, tem o maior $L = |\sum m_l|$;
3. tem $J = |L - S|$ se a subcamada está até a metade (inclusive) e $J = L + S$ se passou da metade.

O número de elétrons desemparelhados de $k$ elétrons numa subcamada de $2l+1$ orbitais é $k$ se $k \le 2l+1$ e $2(2l+1) - k$ caso contrário. O termo $^{2S+1}L_J$ mostrado soma $S$ e $L$ das subcamadas abertas e usa a de maior $l$ na terceira regra; ele coincide com o medido em quase todos os elementos (o cério, $^1G_4$, é a exceção mais conhecida).

### 5. Carga efetiva e periodicidade
Um elétron externo vê o núcleo blindado pelos elétrons internos: $Z_{ef} = Z - \sigma$. As **regras de Slater** estimam $\sigma$ agrupando as subcamadas em $[1s][2s2p][3s3p][3d][4s4p][4d][4f][5s5p]\dots$: cada outro elétron do mesmo grupo contribui com 0,35 (0,30 no $1s$); para um elétron $s$ ou $p$, cada elétron com $n$ uma unidade menor contribui com 0,85 e os mais internos com 1,00; para um elétron $d$ ou $f$, todos os grupos internos contribuem com 1,00.

Num modelo hidrogenoide, a energia de ionização seria $I \approx 13{,}6\ \text{eV}\,Z_{ef}^2/n^2$, o que define uma carga efetiva "medida", $Z_{ef}^{(I)} = n\sqrt{I/13{,}6\ \text{eV}}$. Ao longo de um período, $Z_{ef}$ cresce cerca de 0,65 por elemento (só 0,35 de cada novo elétron blinda o seguinte), então $I$ aumenta e o raio diminui. Ao abrir uma camada nova, $n$ aumenta e $Z_{ef}$ despenca: daí o gás nobre no topo e o metal alcalino no fundo de cada ciclo.

Os dados são reais: energias de ionização do NIST e raios covalentes de Cordero et al. (2008).

### 6. N elétrons num poço infinito
Sem interação entre os elétrons, o hamiltoniano é a soma dos de cada um e os estados de uma partícula são os do poço:
$$\text{1D: } E_n = n^2 E_1, \qquad \text{2D (quadrado): } E_{n_x n_y} = (n_x^2 + n_y^2)\,E_1, \qquad E_1 = \frac{h^2}{8mL^2}.$$
Cada estado espacial recebe até dois elétrons. A energia do estado fundamental é a soma das energias ocupadas, preenchendo de baixo para cima. Em 1D, para $N$ par, $E_{tot} = 2E_1\sum_{n=1}^{N/2} n^2 \approx N^3E_1/12$, enquanto sem exclusão seria apenas $N E_1$. Em 2D, níveis como $(1,2)$ e $(2,1)$ são degenerados; o número de estados com energia abaixo de $E$ cresce como $\tfrac{\pi}{4}(E/E_1)$, e por isso o nível mais alto ocupado cresce linearmente com $N$.

A menor energia de excitação é a menor diferença $E_b - E_a$ entre um estado ocupado $a$ e um estado $b$ com vaga e energia maior; se o nível do topo está pela metade, um elétron de baixo pode subir para a vaga.

### 7. Lei de Moseley
Uma linha $K\alpha$ surge quando um elétron $L$ ($n = 2$) cai numa vaga $K$ ($n = 1$). O elétron $K$ restante blinda uma carga, e o modelo de Bohr com $Z - 1$ dá
$$h f = R_\infty hc\,(Z-1)^2\left(1 - \frac14\right) \;\Rightarrow\; \sqrt f = \sqrt{\tfrac34 c R_\infty}\,(Z - 1) = 4{,}97\times10^7\ \text{Hz}^{1/2}\,(Z - 1).$$
O gráfico usa energias $K\alpha_1$ medidas; o ajuste linear $\sqrt f = k(Z - \sigma)$ para $Z \le 50$ dá $\sigma \approx 1$ e $k$ próximo do teórico. Para $Z$ grande, a correção relativística aumenta a inclinação. Moseley (1913) mostrou que o número atômico, não a massa, ordena os elementos (Ar antes de K, Co antes de Ni, Te antes de I) e apontou lacunas em $Z = 43, 61, 72, 75$.

### 8. Método numérico
Não há integração no tempo: tudo é calculado em forma fechada. A animação do preenchimento acrescenta um elétron a cada 0,35 s. O ajuste de Moseley é por mínimos quadrados lineares.`;
