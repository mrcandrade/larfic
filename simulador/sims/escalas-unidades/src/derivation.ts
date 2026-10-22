/** Modo engenharia: de onde vêm as contas da sim de medição. */
export const derivation = String.raw`### 1. Hipóteses
- As unidades são tratadas como símbolos algébricos que se multiplicam e se cancelam; um fator de conversão é exato quando a equivalência é uma definição (1 in = 2,54 cm, 1 lbf = 4,448 221 615 260 5 N, 1 ano juliano = 365,25 d).
- Tamanhos e massas dos objetos de referência são ordens de grandeza (valores típicos arredondados), suficientes para comparar escalas, não para cálculos de precisão.
- As constantes que definem o SI ($c$, $\Delta\nu_{Cs}$, $h$, $e$) são exatas desde 2019; a luz se propaga no vácuo e a gravidade local $g$ da balança de Kibble é conhecida.

### 2. Grandeza, número e unidade
Toda medida é um número vezes uma unidade: $L = \{L\}\,[L]$. Trocar de unidade não muda a grandeza, só a maneira de escrevê-la: se $[L]' = \alpha\,[L]$, então $\{L\}' = \{L\}/\alpha$. É isso que permite tratar unidades como **símbolos algébricos**, que se multiplicam, se dividem e se cancelam como letras.

### 3. Fator de conversão é um "1" bem escolhido
Uma equivalência como $1\ \text{km} = 1000\ \text{m}$ pode ser escrita como uma fração de valor 1:
$$\frac{1000\ \text{m}}{1\ \text{km}} = 1 = \frac{1\ \text{km}}{1000\ \text{m}}.$$
Multiplicar uma medida por 1 não a altera; escolhendo a versão em que a unidade indesejada fica no denominador, ela se cancela:
$$100\ \frac{\text{km}}{\text{h}}\times\frac{1000\ \text{m}}{1\ \text{km}}\times\frac{1\ \text{h}}{60\ \text{min}}\times\frac{1\ \text{min}}{60\ \text{s}} = 27{,}78\ \frac{\text{m}}{\text{s}}.$$
Quando a unidade aparece elevada a uma potência, o fator inteiro é elevado à mesma potência: $1\ \text{m}^3 = (100\ \text{cm})^3 = 10^6\ \text{cm}^3$, não $100\ \text{cm}^3$.

### 4. Como a sim confere o cancelamento
Cada unidade é guardada como um par (símbolo, expoente). A unidade de partida e cada fator somam seus expoentes num mapa: numerador com sinal $+$, denominador com sinal $-$, tudo multiplicado pela potência do fator. Um símbolo com expoente total zero se cancelou. No fim, o mapa restante é comparado com a unidade pedida; com um fator invertido (a opção de erro) sobram unidades como $\text{km}^2/(\text{h}\cdot\text{m})$ e o resultado é rejeitado, mesmo que o número "pareça razoável". O valor numérico é o produto $\prod_i (n_i/d_i)^{p_i}$ dos fatores aplicados.

### 5. Potências de dez e ordem de grandeza
Num zoom contínuo, a largura do quadro é $L = 10^{e}$ m, e o expoente $e$ cresce a uma taxa constante $\dot e = r$ (décadas por segundo). O zoom é, portanto, **exponencial** em $L$: $L(t) = 10^{e_0 + r t}$. A ordem de grandeza de um número $x$ é a potência de dez mais próxima em escala logarítmica, $\operatorname{round}(\log_{10}|x|)$; o ponto de corte entre $10^n$ e $10^{n+1}$ é $10^{n+0{,}5} \approx 3{,}16\times10^n$.

Para cada largura a sim calcula duas grandezas "equivalentes":
$$t_{luz} = \frac{L}{c}, \qquad m_{\text{cubo}} = \rho_{\text{água}}\,L^3.$$
O tempo de luz vai de $\sim 10^{-23}$ s (um núcleo) a $\sim 10^{17}$ s (a idade do Universo), o que mostra que a escala do Universo observável é, aproximadamente, $c$ vezes a sua idade.

### 6. As definições do SI (desde 2019)
O SI fixa os valores numéricos de sete constantes e define as unidades a partir delas:
- **Segundo:** $\Delta\nu_{Cs} = 9\,192\,631\,770$ Hz exatos; um segundo é a duração de $9\,192\,631\,770$ períodos da radiação da transição hiperfina do césio-133. Contar $N$ ciclos dá $\tau = N/\Delta\nu_{Cs}$.
- **Metro:** $c = 299\,792\,458$ m/s exatos; um metro é a distância que a luz percorre no vácuo em $1/299\,792\,458$ s $\approx 3{,}336$ ns. Na prática o metro é realizado por interferometria: um comprimento $L$ contém $N = L/\lambda$ comprimentos de onda de um laser de frequência conhecida (He-Ne: $\lambda \approx 632{,}991$ nm).
- **Quilograma:** $h = 6{,}626\,070\,15\times10^{-34}$ J·s exatos. Como $h$ tem unidade kg·m²/s e o metro e o segundo já estão definidos, fixar $h$ define o quilograma.

### 7. Balança de Kibble: a massa medida por grandezas elétricas
Uma bobina de fio de comprimento $L$ num campo magnético radial $B$ é usada de dois modos:
- **Pesagem:** uma corrente $I$ na bobina faz a força magnética equilibrar o peso: $B L I = m g$.
- **Velocidade:** a bobina é movida com velocidade $v$ e aparece uma tensão induzida $U = B L v$.

Dividindo uma equação pela outra o fator geométrico $BL$, difícil de medir, desaparece:
$$m = \frac{U I}{g v}.$$
$U$ é medida por comparação com o efeito Josephson ($U = n f / K_J$, $K_J = 2e/h$) e $I$ por uma tensão Josephson sobre uma resistência Hall quântica ($R_K = h/e^2$). O produto $U I$ fica proporcional a $h$ (a carga $e$ se cancela), por isso a massa fica ligada diretamente à constante de Planck. Uma relação simples que mostra a mesma ligação é $f = m c^2/h$: 1 kg corresponde a $1{,}36\times10^{50}$ Hz.

### 8. Método numérico
O estado é $(e, k, \tau)$: o expoente do zoom, o número de fatores já aplicados e o tempo físico do padrão. As três equações são lineares, $\dot e = r$, $\dot k = 1/t_{\text{passo}}$ e $\dot\tau = s$ (fator de câmera lenta: 1 ns de tempo físico por segundo de animação para o metro), integradas por Runge–Kutta, que é exato para elas. Os fins (zoom no limite, último fator, pulso de luz chegando ao fim da régua, bobina no fim do curso) são eventos localizados por bissecção dentro do passo.`;
