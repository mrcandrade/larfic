import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 27,
  intro: String.raw`Até aqui estudamos resistores, capacitores e a corrente em um único fio. Agora juntamos as peças: uma fonte de energia mantém a corrente circulando, e as **regras das malhas e dos nós** (leis de Kirchhoff) permitem calcular a corrente em cada ramo de qualquer rede de resistores e baterias. Veremos também como amperímetros e voltímetros reais perturbam o que medem e como um capacitor carrega e descarrega através de um resistor, com a constante de tempo $\tau = RC$ que marca o ritmo de temporizadores, filtros e do pisca-pisca do carro.`,
  sections: {
    "27-1": {
      text: String.raw`### “Bombeamento” de Cargas
Num fio ligado a um capacitor, a corrente para assim que os potenciais se igualam. Para manter uma corrente **contínua**, é preciso um dispositivo que leve as cargas de volta do terminal de potencial mais baixo para o mais alto, contra o campo elétrico: uma **fonte de força eletromotriz** (fem). Pilhas e baterias fazem isso com reações químicas; geradores, com indução magnética (capítulo 30); células solares, com a energia da luz. Dentro da fonte, a carga positiva sobe o "morro" de potencial; no circuito externo, ela desce.

### Trabalho, Energia e Força Eletromotriz
A fem $\varepsilon$ é o trabalho que a fonte realiza por unidade de carga que a atravessa: $\varepsilon = dW/dq$, medida em volts. O nome é histórico: não se trata de uma força. Numa fonte **ideal**, a diferença de potencial entre os terminais é sempre $\varepsilon$; numa fonte **real** há também uma resistência interna $r$. A potência que a fonte entrega às cargas é $P = i\varepsilon$.

### Cálculo da Corrente em um Circuito de uma Malha
Percorrendo uma malha fechada e somando as variações de potencial, o resultado tem de ser zero, pois voltamos ao mesmo ponto (**regra das malhas**). Convenções: atravessar um resistor **no sentido** da corrente dá $-iR$; atravessar uma fonte do terminal $-$ para o $+$ dá $+\varepsilon$. Para uma fonte real ligada a um resistor $R$:

$$\varepsilon - ir - iR = 0 \quad\Rightarrow\quad i = \frac{\varepsilon}{R + r}.$$

O mesmo resultado sai da energia: $i\varepsilon$ fornecido é igual a $i^2(R+r)$ dissipado.

### Outros Circuitos de uma Malha
Resistores **em série** são percorridos pela mesma corrente, e as tensões se somam: $R_{\text{eq}} = R_1 + R_2 + \dots$. A resistência interna entra simplesmente como mais um resistor da série.

### Diferença de Potencial Entre Dois Pontos
Para achar $V_b - V_a$, parta de $a$ e some as variações por **qualquer** caminho até $b$. A tensão entre os terminais de uma fonte real é $V = \varepsilon - ir$: só iguala a fem quando $i = 0$. Exemplo: uma bateria de $12{,}0$ V com $r = 0{,}50\ \Omega$ ligada a $R = 5{,}5\ \Omega$ fornece $i = 2{,}0$ A, e a tensão terminal cai para $11{,}0$ V. Ligar um ponto à terra apenas define o zero dos potenciais; não muda nenhuma corrente.

Armadilha: achar que a bateria fornece sempre a mesma corrente. Ela mantém aproximadamente a mesma **fem**; a corrente depende do circuito. Outra: achar que a corrente "se gasta" nos resistores; o que se transforma é a energia, e a corrente é a mesma em toda a malha.

No experimento, meça a corrente e as tensões na montagem em série, confira que a soma das tensões dá a fem e aumente a resistência interna para ver a tensão terminal cair.`,
      experiments: [
        { kind: "sim", id: "circuitos-dc", scenario: "serie", note: "Some as tensões dos resistores e compare com a fem; aumente a resistência interna." },
        { kind: "sim", id: "circuitos-dc", scenario: "serie", params: { rInterna: 5 }, note: "Com r = 5 Ω, calcule i = ε/(R + r) e a tensão terminal antes de rodar." },
        { kind: "concepcao", id: "bateria-corrente-constante", note: "Confronte a ideia de que a bateria fornece sempre a mesma corrente." },
        { kind: "concepcao", id: "corrente-gasta" },
      ],
    },
    "27-2": {
      text: String.raw`Quando o circuito tem ramificações, aparecem **nós** (pontos onde três ou mais fios se encontram) e **ramos** (trechos entre nós, cada um com a sua corrente). Além da regra das malhas, usamos a **regra dos nós**: como a carga se conserva e não se acumula num nó, a soma das correntes que chegam é igual à soma das que saem,

$$\sum i_{\text{entra}} = \sum i_{\text{sai}}.$$

O procedimento: (1) escolha um sentido para a corrente de cada ramo, sem se preocupar em acertar; (2) escreva a regra dos nós para todos os nós menos um; (3) escreva a regra das malhas para malhas independentes até ter tantas equações quanto incógnitas; (4) resolva. Uma corrente negativa apenas indica que o sentido verdadeiro é o oposto ao escolhido.

**Em paralelo**, os resistores estão ligados aos mesmos dois nós e têm a **mesma tensão**; as correntes se somam, e

$$\frac{1}{R_{\text{eq}}} = \sum_i \frac{1}{R_i}.$$

O equivalente é menor que o menor resistor: cada ramo novo é um caminho a mais para a corrente. Para dois resistores, $R_{\text{eq}} = R_1R_2/(R_1+R_2)$. (Note a inversão em relação aos capacitores, seção 25-3.)

Exemplo com duas fontes: $\varepsilon_1 = 9{,}0$ V em série com $R_1 = 3{,}0\ \Omega$ num ramo, $\varepsilon_2 = 6{,}0$ V em série com $R_2 = 6{,}0\ \Omega$ no outro, ambos com o terminal positivo para o mesmo nó, e $R_3 = 2{,}0\ \Omega$ no ramo do meio. Com o nó inferior a $0$ V e o superior a $V$: $(9 - V)/3 + (6 - V)/6 = V/2$, de onde $V = 4{,}0$ V. Então $i_1 = 1{,}67$ A, $i_2 = 0{,}33$ A, e $i_3 = 2{,}0$ A, que é a soma das duas, como manda a regra dos nós.

Armadilha: escrever a regra das malhas com sinais inconsistentes. O sinal do termo $iR$ depende do sentido em que você percorre o resistor **em relação ao sentido escolhido para a corrente**, não do sentido "real". Outra: achar que ligar mais aparelhos em paralelo numa tomada diminui a corrente; ela aumenta, e é por isso que existem disjuntores.

No experimento, escreva as equações das malhas para o circuito com duas fontes, preveja as correntes e confira com os amperímetros; depois inverta uma das baterias e refaça.`,
      experiments: [
        { kind: "sim", id: "circuitos-dc", scenario: "kirchhoff", note: "Resolva as correntes com as leis de Kirchhoff e confira nos instrumentos; inverta uma fonte." },
        { kind: "sim", id: "circuitos-dc", scenario: "paralelo", note: "Verifique a mesma tensão nos ramos e a soma das correntes no nó." },
        { kind: "sim", id: "ponte-wheatstone", scenario: "kirchhoff", note: "Meça correntes de ramo e tensões num circuito de duas malhas real." },
        { kind: "pratica", id: "exp3-wheatstone", note: "Verifique as leis dos nós e das malhas e equilibre uma ponte na bancada." },
        { kind: "desafio", id: "circuito-economico", note: "Ligue quatro lâmpadas gastando a menor potência possível." },
      ],
    },
    "27-3": {
      text: String.raw`Para medir corrente, o **amperímetro** é inserido **em série** no ramo: o circuito é aberto e o instrumento é colocado no corte, de modo que a mesma corrente o atravesse. Para não alterar a corrente que mede, sua resistência interna $R_A$ deve ser **muito menor** que as demais resistências do ramo.

Para medir tensão, o **voltímetro** é ligado **em paralelo** com o trecho, entre os dois pontos de interesse, sem abrir o circuito. Ele desvia um pouco de corrente; para que isso não altere a tensão medida, sua resistência $R_V$ deve ser **muito maior** que a do trecho medido. Um multímetro digital típico tem $R_V \approx 10$ MΩ.

Exemplo: um resistor de $100$ kΩ em série com outro igual, ligados a $10$ V; cada um tem $5{,}0$ V. Um voltímetro de $1{,}0$ MΩ posto sobre um deles forma um paralelo de $90{,}9$ kΩ, e a leitura cai para $10\cdot90{,}9/190{,}9 \approx 4{,}76$ V, um erro de quase $5\%$ causado pelo próprio instrumento. Com $10$ MΩ, o erro cai para cerca de $0{,}5\%$.

Na medida de uma resistência com os dois instrumentos ao mesmo tempo há duas montagens possíveis. Com o voltímetro **diretamente** sobre o componente, o amperímetro inclui a corrente do voltímetro, e a resistência obtida sai menor que a verdadeira; o erro é pequeno para resistências baixas. Com o voltímetro **antes** do amperímetro, a tensão lida inclui a queda no amperímetro, e o resultado sai maior; essa montagem é melhor para resistências altas.

Armadilha: ligar um amperímetro em paralelo com um componente (ou diretamente na bateria). Como sua resistência é muito pequena, ele vira um quase curto-circuito, a corrente dispara e o fusível do instrumento queima.

No experimento, levante a curva de um resistor nas duas montagens, troque as resistências internas dos instrumentos e veja quando cada montagem dá o menor erro sistemático.`,
      experiments: [
        { kind: "sim", id: "curva-iv", scenario: "ohmico", params: { Rx: 100000, Rv: 1000000 }, note: "Meça um resistor de 100 kΩ com um voltímetro de 1 MΩ e encontre o erro de inserção." },
        { kind: "sim", id: "curva-iv", scenario: "ohmico", params: { Rx: 10, montagem: 1, Ra: 5 }, note: "Na montagem a montante, veja o amperímetro estragar a medida de um resistor pequeno." },
        { kind: "pratica", id: "exp3-instrumentos", note: "Use o multímetro e o osciloscópio na bancada virtual." },
        { kind: "pratica", id: "exp3-ohm", note: "Levante a curva I–V de um resistor medindo corrente e tensão." },
      ],
    },
    "27-4": {
      text: String.raw`Num **circuito RC**, um capacitor $C$ é carregado ou descarregado através de um resistor $R$. Agora a corrente varia com o tempo.

**Carga.** Ao fechar a chave com o capacitor vazio, a regra das malhas dá $\varepsilon - iR - q/C = 0$, com $i = dq/dt$. A solução é

$$q(t) = C\varepsilon\left(1 - e^{-t/RC}\right), \qquad i(t) = \frac{\varepsilon}{R}\,e^{-t/RC}.$$

No instante inicial o capacitor descarregado se comporta como um fio, e a corrente é $\varepsilon/R$; muito tempo depois ele se comporta como um circuito aberto, e a corrente é zero.

**Constante de tempo.** O produto $\tau = RC$ tem unidade de segundo. Em $t = \tau$, a carga atinge $1 - e^{-1} \approx 63\%$ do valor final; após $5\tau$, mais de $99\%$.

**Descarga.** Com o capacitor carregado com $q_0$ e ligado só ao resistor, $iR + q/C = 0$ e

$$q(t) = q_0\,e^{-t/RC}, \qquad i(t) = -\frac{q_0}{RC}\,e^{-t/RC},$$

onde o sinal indica que a corrente agora tem sentido oposto ao da carga. Em $t = \tau$ restam $37\%$ da carga.

Exemplo: $R = 10$ kΩ e $C = 220\ \mu\mathrm F$ dão $\tau = 2{,}2$ s. Ligados a $9{,}0$ V, a corrente começa em $0{,}90$ mA e o capacitor chega a $5{,}7$ V depois de $2{,}2$ s. Para que a tensão caia à metade numa descarga, é preciso esperar $\tau\ln2 \approx 1{,}5$ s.

Armadilha: achar que a carga dura um tempo $\tau$. A exponencial nunca chega exatamente ao final; $\tau$ só mede o ritmo. Outra: esquecer que, como visto na seção 25-4, metade da energia fornecida pela fonte é dissipada no resistor durante a carga.

No experimento, carregue o capacitor, use os cursores do osciloscópio para achar o instante em que a tensão chega a $63\%$ do final e compare com o produto $RC$; depois dobre $R$ e repita.`,
      experiments: [
        { kind: "sim", id: "circuito-rc", scenario: "medir-tau", note: "Meça τ com os cursores e compare com RC; dobre R e repita." },
        { kind: "sim", id: "circuito-rc", scenario: "descarga", note: "Acompanhe a tensão e a corrente durante a descarga e veja o sinal da corrente." },
        { kind: "sim", id: "circuitos-dc", scenario: "rc", note: "Feche a chave e plote a tensão no capacitor no construtor de circuitos." },
        { kind: "pratica", id: "exp3-rc", note: "Levante as curvas de carga e descarga e ajuste a exponencial." },
      ],
    },
  },
};
