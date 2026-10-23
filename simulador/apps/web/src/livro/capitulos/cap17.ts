import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 17,
  intro: String.raw`O som é uma onda mecânica longitudinal: camadas de ar (ou de água, ou de aço) são empurradas e puxadas ao longo da direção em que a onda avança. Neste capítulo aplicamos tudo o que foi visto sobre ondas em cordas ao som: de que depende a sua velocidade, como se descrevem o deslocamento e a variação de pressão, como duas fontes interferem, como medir a intensidade em decibéis, por que uma flauta e um clarinete do mesmo tamanho soam diferentes, o que são batimentos, o efeito Doppler e as ondas de choque. São ferramentas de projeto em acústica de salas, ultrassom médico, sonar, controle de ruído e aeronáutica.`,
  sections: {
    "17-2": {
      text: String.raw`Uma **onda sonora** é qualquer onda mecânica longitudinal que se propaga num meio material: gás, líquido ou sólido. "Longitudinal" quer dizer que cada pequena porção do meio oscila para a frente e para trás na **mesma direção** em que a onda avança, formando regiões alternadas de **compressão** (pressão um pouco acima da ambiente) e **rarefação** (pressão um pouco abaixo). Nos sólidos também existem ondas transversais, mas neste capítulo tratamos só das longitudinais.

### Frentes de onda e raios
Para descrever uma fonte que emite em todas as direções usamos duas imagens:
- **frentes de onda**: superfícies em que a oscilação do ar tem a mesma fase (por exemplo, todas as cristas de compressão);
- **raios**: linhas perpendiculares às frentes que indicam a direção de propagação.

Perto de uma fonte pequena as frentes são esferas. Longe dela, um pedaço pequeno de esfera é quase plano, e podemos tratar a onda como **onda plana**, o que simplifica muito as contas.

### Um número para fixar a escala
O ouvido humano percebe frequências de cerca de 20 Hz a 20 kHz. Com $v \approx 343\ \text{m/s}$ no ar a 20 °C, o comprimento de onda $\lambda = v/f$ vai de
$$\lambda_{20\,\text{Hz}} = 17\ \text{m} \quad\text{a}\quad \lambda_{20\,\text{kHz}} = 1{,}7\ \text{cm}.$$
Um lá de 440 Hz tem $\lambda \approx 0{,}78\ \text{m}$, comparável a uma porta, por isso o som contorna obstáculos com facilidade.

**Armadilha comum:** pensar que o ar "viaja" da fonte até o ouvido. Cada camada de ar só oscila alguns nanômetros em torno da sua posição; o que se propaga é a perturbação e a energia. E, sem meio material, não há som: no vácuo não existe nada para comprimir.

No experimento, abra o cenário da onda longitudinal e acompanhe uma única partícula de ar: ela vai e volta, enquanto as compressões avançam.`,
      experiments: [
        { kind: "sim", id: "som-intensidade", scenario: "longitudinal", note: "Observe as partículas de ar oscilando na direção da propagação enquanto as compressões avançam." },
        { kind: "concepcao", id: "som-no-vacuo", note: "Confronte a ideia de que o som pode atravessar o vácuo." },
      ],
    },
    "17-3": {
      text: String.raw`A velocidade de qualquer onda mecânica resulta de uma competição entre uma propriedade **elástica** do meio (que devolve o meio ao equilíbrio) e uma propriedade **inercial** (que resiste à aceleração). Na corda eram a tensão e a densidade linear. Para o som, a propriedade elástica é o **módulo de elasticidade volumétrico** $B$, que diz quanta pressão é preciso para mudar o volume em uma dada fração:
$$B = -\frac{\Delta p}{\Delta V / V}.$$
O sinal negativo deixa $B$ positivo, já que um aumento de pressão reduz o volume. A propriedade inercial é a massa específica $\rho$. Aplicando a segunda lei de Newton a uma fatia de fluido que é comprimida quando o pulso passa, obtém-se
$$v = \sqrt{\frac{B}{\rho}}.$$

### Exemplos numéricos
- Ar a 20 °C: as compressões são rápidas demais para trocar calor, então o processo é adiabático e $B = \gamma p \approx 1{,}4 \times 1{,}01\times10^5\ \text{Pa} = 1{,}42\times10^5\ \text{Pa}$. Com $\rho = 1{,}21\ \text{kg/m}^3$, $v = \sqrt{1{,}42\times10^5/1{,}21} \approx 343\ \text{m/s}$.
- Água: $B \approx 2{,}2\times10^9\ \text{Pa}$ e $\rho = 1000\ \text{kg/m}^3$ dão $v \approx 1480\ \text{m/s}$.

### Temperatura e tipo de gás
Para um gás ideal, $v = \sqrt{\gamma R T / M}$: a velocidade cresce com a raiz da temperatura absoluta e é maior para gases leves. Uma aproximação útil para o ar é $v \approx 331\sqrt{T/273\ \text{K}}\ \text{m/s}$. No hélio ($M = 4\ \text{g/mol}$, $\gamma = 5/3$) o som anda a cerca de 1000 m/s, e é por isso que a voz fica aguda depois de inspirar hélio: o trato vocal ressoa em frequências mais altas.

**Armadilha comum:** concluir que o som é mais lento em meios mais densos. A água é 800 vezes mais densa que o ar e mesmo assim o som é 4 vezes mais rápido nela, porque $B$ cresce muito mais do que $\rho$.

No experimento, meça a velocidade do som no tubo de ressonância e depois troque o ar por hélio ou mude a temperatura e veja os nós se deslocarem.`,
      experiments: [
        { kind: "sim", id: "tubo-kundt", scenario: "ressonancia", note: "Baixe a coluna de água, encontre as ressonâncias e calcule v a partir da distância entre elas." },
        { kind: "sim", id: "tubo-kundt", scenario: "helio", note: "Repita a medida com hélio e compare com √(γRT/M)." },
        { kind: "pratica", id: "exp2-kundt", note: "Roteiro de bancada para medir a velocidade do som com o tubo de Kundt." },
      ],
    },
    "17-4": {
      text: String.raw`Para uma onda sonora senoidal que avança no sentido $+x$, descrevemos o **deslocamento** $s$ de cada camada de ar em relação à sua posição de equilíbrio:
$$s(x,t) = s_m \cos(kx - \omega t),$$
com $k = 2\pi/\lambda$, $\omega = 2\pi f$ e $v = \omega/k$. Atenção: $s$ é um deslocamento **ao longo de** $x$, não perpendicular como na corda.

### A onda de pressão
Onde camadas vizinhas se aproximam o ar é comprimido; onde se afastam, é rarefeito. Usando a definição de $B$ da seção 17-3, a variação de pressão fica
$$\Delta p(x,t) = \Delta p_m \sin(kx - \omega t), \qquad \Delta p_m = v\rho\omega\, s_m.$$
O seno no lugar do cosseno significa que as duas descrições estão **defasadas de 90°**: onde o deslocamento é máximo (a camada está parada no extremo), a pressão é a ambiente; onde o deslocamento é nulo, a pressão está no máximo ou no mínimo. É exatamente aí que as camadas vizinhas estão mais apertadas ou mais afastadas.

### Ordem de grandeza
Um som de conversa forte a 1000 Hz tem $\Delta p_m \approx 0{,}03\ \text{Pa}$, menos de um milionésimo da pressão atmosférica. A amplitude de deslocamento correspondente no ar ($v = 343\ \text{m/s}$, $\rho = 1{,}21\ \text{kg/m}^3$) é
$$s_m = \frac{\Delta p_m}{v\rho\omega} = \frac{0{,}03}{343 \times 1{,}21 \times 2\pi \times 1000} \approx 1{,}2\times10^{-8}\ \text{m},$$
cerca de 12 nm, uma fração do tamanho de um vírus. O ouvido é um detector extraordinariamente sensível.

**Armadilha comum:** supor que os máximos de pressão coincidem com os máximos de deslocamento. Desenhe as camadas: os pontos de maior compressão ficam entre uma camada empurrada para a direita e outra empurrada para a esquerda.

No experimento, compare as saídas "amplitude de pressão" e "amplitude de deslocamento do ar" e mude a frequência: para a mesma intensidade, $s_m$ cai com $f$ e $\Delta p_m$ não muda.`,
      experiments: [
        { kind: "sim", id: "som-intensidade", scenario: "longitudinal", note: "Veja ao mesmo tempo o deslocamento das camadas e a pressão, defasados de um quarto de período." },
      ],
    },
    "17-5": {
      text: String.raw`Quando duas ondas sonoras de mesma frequência chegam ao mesmo ponto, o deslocamento resultante é a soma dos dois (princípio da superposição). O resultado depende da **diferença de fase** com que elas chegam. Se duas fontes $S_1$ e $S_2$ emitem **em fase** e o ponto $P$ está a distâncias $L_1$ e $L_2$ delas, a diferença de fase vem só da **diferença de percurso** $\Delta L = |L_2 - L_1|$:
$$\phi = 2\pi\,\frac{\Delta L}{\lambda}.$$

### Condições de interferência
- **Construtiva** (som reforçado): $\Delta L = m\lambda$, com $m = 0, 1, 2, \dots$
- **Destrutiva** (som quase cancelado): $\Delta L = (m + \tfrac{1}{2})\lambda$.

Valores intermediários dão reforço parcial. Os pontos de interferência destrutiva formam curvas (hipérboles) chamadas **linhas nodais**.

### Exemplo
Duas caixas de som em fase tocam 686 Hz no ar ($\lambda = 343/686 = 0{,}50\ \text{m}$). Um ouvinte está a 3,00 m de uma e a 3,75 m da outra. Então $\Delta L = 0{,}75\ \text{m} = 1{,}5\lambda$: interferência destrutiva, o tom fica muito fraco naquele ponto. Se ele andar até $\Delta L = 1{,}00\ \text{m} = 2\lambda$, o som volta reforçado.

**Armadilha comum:** pensar que a interferência destrutiva destrói energia. A energia apenas se redistribui: o que falta nas linhas nodais aparece a mais nas regiões de interferência construtiva. Fones com cancelamento ativo de ruído usam essa ideia num ponto pequeno, junto do ouvido.

No experimento, mova o ouvinte diante de duas caixas de som em fase ($\lambda = 1$ m) e ache os pontos em que $\Delta L = 0$, $\lambda/2$ e $\lambda$; ligue o som para ouvir o volume subir e descer. Depois, numa cuba de ondas, veja em 2D as linhas nodais do mesmo fenômeno.`,
      experiments: [
        { kind: "sim", id: "som-intensidade", scenario: "duas-caixas", note: "Desloque o ouvinte e confira interferência construtiva em ΔL = mλ e destrutiva em ΔL = (m + ½)λ." },
        { kind: "sim", id: "cuba-ondas", scenario: "duas", params: { linhas: 1 }, note: "Duas fontes em fase: confira que as linhas nodais ficam onde ΔL = (m + 1/2)λ." },
      ],
    },
    "17-6": {
      text: String.raw`### Intensidade
A **intensidade** $I$ de uma onda é a potência média que atravessa uma unidade de área perpendicular à propagação:
$$I = \frac{P}{A}, \qquad I = \tfrac{1}{2}\rho v \omega^2 s_m^2.$$
A dependência com $s_m^2$ e $\omega^2$ é a mesma da onda na corda: a energia de um oscilador vai com o quadrado da amplitude.

### Variação com a distância
Uma fonte pontual que emite igualmente em todas as direções espalha a potência $P$ sobre esferas de área $4\pi r^2$. Sem perdas,
$$I = \frac{P}{4\pi r^2}.$$
Dobrar a distância divide a intensidade por 4.

### Nível sonoro em decibéis
O ouvido responde a intensidades de $10^{-12}$ a cerca de $1\ \text{W/m}^2$, doze ordens de grandeza. Por isso se usa uma escala logarítmica, o **nível sonoro**:
$$\beta = (10\ \text{dB}) \log_{10}\frac{I}{I_0}, \qquad I_0 = 10^{-12}\ \text{W/m}^2.$$
Cada fator 10 em $I$ soma 10 dB; cada fator 2 soma cerca de 3 dB.

### Exemplo
Uma fonte de 0,01 W a 1,0 m: $I = 0{,}01/(4\pi) = 8{,}0\times10^{-4}\ \text{W/m}^2$ e $\beta = 10\log(8{,}0\times10^{8}) \approx 89\ \text{dB}$. A 2,0 m a intensidade cai a um quarto, ou seja, $\beta$ cai $10\log 4 \approx 6\ \text{dB}$, para 83 dB.

**Armadilhas comuns:** dez violinos iguais não dão "dez vezes mais decibéis": dão $10\log 10 = 10$ dB a mais. E o nível em dB não é a sensação de volume: o ouvido é muito menos sensível a graves, então 40 dB a 40 Hz podem ser inaudíveis enquanto 40 dB a 3 kHz são claramente ouvidos.

No experimento, afaste o ouvinte da fonte e confira a queda de 6 dB a cada dobro da distância; depois teste os cenários dos violinos e da sensibilidade do ouvido.`,
      experiments: [
        { kind: "sim", id: "som-intensidade", scenario: "distancia", note: "Dobre a distância e confira que o nível cai cerca de 6 dB." },
        { kind: "sim", id: "som-intensidade", scenario: "potencia", note: "Multiplique a potência por 10 e veja o nível subir só 10 dB." },
        { kind: "sim", id: "som-intensidade", scenario: "sensibilidade", note: "Compare o nível em dB com a curva de limiar do ouvido nos graves." },
      ],
    },
    "17-7": {
      text: String.raw`Instrumentos musicais produzem som estável porque confinam uma onda e criam **ondas estacionárias**: cordas (violão, piano) ou colunas de ar (flauta, clarinete, órgão). Só sobrevivem as frequências cujas ondas "cabem" no instrumento respeitando as condições nas extremidades.

### Tubos sonoros
Numa extremidade **aberta** a pressão fica presa à atmosférica: há um nó de pressão (ventre de deslocamento). Numa extremidade **fechada** o ar não pode se mover: nó de deslocamento (ventre de pressão).
- **Aberto nas duas pontas** (flauta): cabem meios comprimentos de onda inteiros, $L = n\lambda/2$, e
$$f_n = \frac{n v}{2L}, \quad n = 1, 2, 3, \dots$$
- **Fechado numa ponta** (clarinete, aproximadamente): cabem quartos de onda ímpares, $L = n\lambda/4$, e
$$f_n = \frac{n v}{4L}, \quad n = 1, 3, 5, \dots$$
Só aparecem os harmônicos **ímpares**.

### Exemplo
Um tubo de 0,60 m aberto nas duas pontas, com $v = 343\ \text{m/s}$, tem fundamental $f_1 = 343/1{,}20 \approx 286\ \text{Hz}$ e harmônicos 572, 858 Hz… O mesmo tubo fechado numa ponta tem $f_1 = 343/2{,}40 \approx 143\ \text{Hz}$ (uma oitava abaixo) e depois 429, 715 Hz…

### Timbre
Um instrumento real soa ao mesmo tempo o fundamental e vários harmônicos, com amplitudes próprias. O conjunto dessas amplitudes, o **espectro**, é o que distingue uma flauta de um oboé tocando a mesma nota. Nas cordas (seção 16-13) vale $f_n = nv/2L$, com $v = \sqrt{T/\mu}$, e o ponto onde a corda é tangida muda o espectro.

**Armadilha comum:** esquecer que a frequência depende de $v$, que depende da temperatura. Um órgão afina mais agudo numa igreja quente, enquanto um violão (cuja $v$ vem da tensão) quase não muda pelo ar.

No experimento, compare a série de harmônicos da flauta e do clarinete com o mesmo comprimento e depois mude a temperatura do ar.`,
      experiments: [
        { kind: "sim", id: "tubos-sonoros", scenario: "flauta", params: { L: 0.6 }, note: "Tubo aberto de 0,60 m: confira f₁ ≈ 286 Hz e a série completa de harmônicos." },
        { kind: "sim", id: "tubos-sonoros", scenario: "clarinete", params: { L: 0.6 }, note: "Feche uma ponta do mesmo tubo: o fundamental cai uma oitava e só restam harmônicos ímpares." },
        { kind: "sim", id: "ondas-estacionarias", scenario: "ponte", note: "Numa corda, mude o ponto do dedilhado e veja o espectro (o timbre) mudar." },
        { kind: "pratica", id: "exp2-cavidade-ar", note: "Meça as ressonâncias de uma coluna de ar e obtenha a velocidade do som." },
      ],
    },
    "17-8": {
      text: String.raw`Quando duas ondas sonoras de frequências **próximas** mas diferentes, $f_1$ e $f_2$, chegam juntas ao ouvido, ouvimos um tom na frequência média cuja intensidade sobe e desce periodicamente. Essas oscilações lentas de volume são os **batimentos**.

### De onde vêm
Somando dois deslocamentos de mesma amplitude no mesmo ponto e usando a identidade da soma de cossenos:
$$s = s_m\cos\omega_1 t + s_m\cos\omega_2 t = \left[2 s_m \cos\omega' t\right]\cos\omega t,$$
com $\omega = (\omega_1 + \omega_2)/2$ e $\omega' = (\omega_1 - \omega_2)/2$. O fator $\cos\omega t$ é o tom que ouvimos; o termo entre colchetes é uma **envoltória** lenta. Como o volume é máximo tanto quando a envoltória vale $+2s_m$ quanto $-2s_m$, há dois máximos por período de $\cos\omega' t$, e a frequência de batimento é
$$f_{\text{bat}} = |f_1 - f_2|.$$

### Exemplo
Um diapasão de 440 Hz e uma corda de violão afinada em 443 Hz soam juntos: ouvem-se 3 batimentos por segundo. O músico gira a tarraxa até os batimentos ficarem cada vez mais lentos e desaparecerem: as frequências ficaram iguais. Se ao apertar a corda os batimentos aceleram, ele estava indo no sentido errado.

**Armadilha comum:** usar $(f_1 - f_2)/2$ como frequência de batimento. Essa é a frequência do cosseno da envoltória; o ouvido percebe os máximos de volume, que ocorrem duas vezes por ciclo dessa função.

No experimento, some duas ondas com comprimentos de onda próximos e meça o intervalo entre dois máximos da envoltória; depois diminua $\Delta k$ e veja os batimentos ficarem mais lentos.`,
      experiments: [
        { kind: "sim", id: "superposicao", scenario: "batimentos", note: "Some duas ondas próximas e meça o período dos batimentos; reduza Δk e veja-o crescer." },
      ],
    },
    "17-9": {
      text: String.raw`O **efeito Doppler** é a mudança da frequência percebida quando a fonte, o detector, ou ambos, se movem em relação ao ar. A sirene de uma ambulância soa mais aguda quando ela se aproxima e mais grave depois que passa.

### Por que acontece
- **Detector em movimento:** ao ir de encontro às frentes de onda, ele as encontra com mais frequência; a frequência aumenta na proporção $(v + v_D)/v$.
- **Fonte em movimento:** a fonte persegue as frentes que acabou de emitir, de modo que à sua frente elas ficam mais juntas (comprimento de onda menor) e atrás ficam mais separadas.

### A equação geral
Com $v$ a velocidade do som no ar, $v_D$ a do detector e $v_S$ a da fonte (todas em relação ao ar, ao longo da linha que as une):
$$f' = f\,\frac{v \pm v_D}{v \mp v_S}.$$
Regra de sinais: escolha o sinal que faz $f'$ **aumentar** quando o movimento é de aproximação (sinal de cima) e **diminuir** quando é de afastamento.

### Exemplo
Uma sirene de 700 Hz numa ambulância a 30 m/s; ouvinte parado, $v = 343\ \text{m/s}$.
- Aproximando: $f' = 700 \times 343/(343 - 30) \approx 767\ \text{Hz}$.
- Afastando: $f' = 700 \times 343/(343 + 30) \approx 644\ \text{Hz}$.
A queda que se ouve na passagem é de mais de 120 Hz. Se fosse o ouvinte a 30 m/s indo para uma sirene parada, a aproximação daria $700 \times 373/343 \approx 761\ \text{Hz}$: o efeito não é simétrico, porque o ar define um referencial privilegiado.

**Armadilha comum:** confundir o Doppler com o som "ficar mais alto". O volume aumenta porque a fonte chega mais perto; o Doppler é a mudança de **altura** (frequência), e, para a fonte passando em linha reta, a frequência ouvida na aproximação é praticamente constante até bem perto da passagem.

No experimento, deixe a fonte passar pelo ouvinte e compare a frequência medida com a da fórmula; depois deixe a fonte parada e ponha o ouvinte em movimento.`,
      experiments: [
        { kind: "sim", id: "doppler", scenario: "ambulancia", note: "Compare a frequência medida e a calculada na aproximação e no afastamento." },
        { kind: "sim", id: "doppler", scenario: "ouvinte", note: "Fonte parada e ouvinte em movimento: verifique que o resultado difere do caso da fonte móvel." },
        { kind: "concepcao", id: "doppler-volume", note: "Separe a mudança de frequência da mudança de volume." },
      ],
    },
    "17-10": {
      text: String.raw`Na equação do efeito Doppler, o denominador $v - v_S$ vai a zero quando a fonte atinge a velocidade do som. Fisicamente, as frentes de onda emitidas para a frente se acumulam todas num único ponto junto à fonte: é a "barreira do som". Se a fonte for ainda mais rápida, $v_S > v$, ela ultrapassa as próprias frentes e a equação de Doppler deixa de valer.

### O cone de Mach
Cada frente emitida é uma esfera que cresce com velocidade $v$, enquanto a fonte avança com $v_S$. A envoltória de todas essas esferas é um **cone** com vértice na fonte, ao longo do qual as perturbações se somam numa **onda de choque**. Num intervalo $t$, uma frente cresce até raio $vt$ enquanto a fonte anda $v_S t$, logo o semiângulo do cone satisfaz
$$\sin\theta = \frac{v}{v_S} = \frac{1}{M},$$
em que $M = v_S/v$ é o **número de Mach**.

### Exemplo
Um avião a $M = 2$ tem $\sin\theta = 0{,}5$, ou seja, $\theta = 30°$. Voando a 9 km de altitude, o cone toca o solo a uma distância horizontal de $9\ \text{km}/\tan 30° \approx 16\ \text{km}$ **atrás** do avião. Quem está no chão ouve o **estrondo sônico** quando o cone passa por ele, bem depois de o avião ter passado sobre sua cabeça.

Outros exemplos do mesmo fenômeno: o estalo de um chicote (a ponta supera a velocidade do som), a esteira em V de um barco rápido (ondas de superfície) e a radiação Cherenkov, em que partículas carregadas andam mais rápido que a luz na água.

**Armadilha comum:** achar que o estrondo acontece só no instante em que o avião "rompe a barreira". O cone acompanha o avião durante todo o voo supersônico, e cada ponto do solo varrido por ele ouve o estrondo.

No experimento, leve a fonte a $M = 1$ e veja as frentes se empilharem; depois passe para $M = 2$, meça o ângulo do cone e observe quando o ouvinte recebe o choque.`,
      experiments: [
        { kind: "sim", id: "doppler", scenario: "supersonico", note: "Meça o semiângulo do cone de Mach e confira sin θ = 1/M." },
        { kind: "sim", id: "doppler", scenario: "mach1", note: "Fonte exatamente na velocidade do som: as frentes se empilham à frente dela." },
      ],
    },
  },
};
