import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 1,
  intro: String.raw`A física é uma ciência experimental: suas leis são relações entre grandezas que alguém **mediu**. Antes de estudar movimento, forças ou energia, precisamos combinar o que significa medir, quais unidades usar e como passar de uma unidade a outra sem errar. Este capítulo apresenta o **Sistema Internacional de Unidades** (SI), a técnica de conversão por fatores que valem 1, a notação científica e as ordens de grandeza, e conta como o metro, o segundo e o quilograma passaram de objetos guardados num cofre a definições baseadas em constantes da natureza. Pode parecer burocracia, mas erros de unidade já derrubaram sondas espaciais e deixaram aviões sem combustível no meio do voo.`,
  sections: {
    "1-2": {
      text: String.raw`Medir uma grandeza é **compará-la com um padrão** da mesma espécie. Dizer que uma mesa tem 1,8 m significa que ela é 1,8 vez mais comprida que o padrão chamado metro. Todo resultado de medida tem, portanto, três partes: um **número**, uma **unidade** e uma **incerteza**.

### Grandezas de base e derivadas
Há muitas grandezas físicas, mas elas não são independentes. Escolhe-se um pequeno conjunto de **grandezas de base** (comprimento, tempo, massa e mais algumas), com padrões definidos com cuidado, e as demais são **derivadas** delas: velocidade é comprimento por tempo, densidade é massa por volume, força é massa vezes comprimento por tempo ao quadrado.

### O que se espera de um padrão
Um bom padrão precisa ser **acessível** (laboratórios do mundo todo devem poder reproduzi-lo) e **invariável** (não pode mudar com o tempo, a temperatura ou o lugar). Essas duas exigências explicam por que as definições das unidades mudaram ao longo da história (seções 1-5 a 1-7).

### Resolução e algarismos significativos
Todo instrumento tem uma **resolução**: uma régua milimetrada, um paquímetro com nônio de 0,05 mm, um micrômetro de 0,01 mm. O número de **algarismos significativos** de um resultado indica até onde ele é confiável. Medir um cartão com uma régua de centímetro e escrever "8,5372 cm" é afirmar uma precisão que não existe; o correto seria algo como "8,5 cm".

**Exemplo.** Uma peça medida com paquímetro dá 23,45 mm (quatro algarismos significativos). A mesma peça medida com uma régua comum daria 23 mm ou 23,5 mm. Num produto ou num quociente, o resultado deve ter tantos algarismos significativos quanto o fator **menos** preciso.

**Armadilha:** confundir os zeros à esquerda com algarismos significativos. Em 0,0042 m há apenas dois; escrever $4{,}2\times10^{-3}$ m deixa isso claro.

No experimento, meça o mesmo cartão com réguas de resoluções diferentes e escreva cada resultado com o número correto de algarismos significativos; depois use o paquímetro e o micrômetro para medir peças de bancada.`,
      experiments: [
        { kind: "sim", id: "medidas-erros", scenario: "algarismos", note: "Meça um cartão com réguas de resoluções diferentes e aplique as regras dos algarismos significativos." },
        { kind: "sim", id: "instrumentos-medida", scenario: "paquimetro", note: "Leia o paquímetro com nônio de 0,05 mm e registre o resultado com a resolução correta." },
        { kind: "pratica", id: "exp1-medidas", note: "Roteiro de bancada: medidas, incertezas e densidade de sólidos." },
      ],
    },
    "1-3": {
      text: String.raw`O **Sistema Internacional de Unidades** (SI) é o sistema adotado em praticamente todo o mundo na ciência, na engenharia e no comércio. Ele tem **sete unidades de base**: o metro (m, comprimento), o segundo (s, tempo), o quilograma (kg, massa), o ampère (A, corrente elétrica), o kelvin (K, temperatura), o mol (mol, quantidade de matéria) e a candela (cd, intensidade luminosa). Na mecânica, as três primeiras bastam.

### Unidades derivadas
Todas as outras unidades são produtos e quocientes das de base. Algumas ganham nome próprio:
- newton: $1\ \text{N} = 1\ \text{kg·m/s}^2$ (força);
- joule: $1\ \text{J} = 1\ \text{N·m} = 1\ \text{kg·m}^2/\text{s}^2$ (energia);
- watt: $1\ \text{W} = 1\ \text{J/s}$ (potência);
- pascal: $1\ \text{Pa} = 1\ \text{N/m}^2$ (pressão).

### Notação científica e prefixos
Grandezas físicas vão de $10^{-15}$ m (um próton) a $10^{26}$ m (o Universo observável). Escrevemos esses números em **notação científica**, como $3{,}56\times10^{9}$, e usamos **prefixos** para as potências de dez mais comuns:
- giga (G) $10^{9}$, mega (M) $10^{6}$, quilo (k) $10^{3}$;
- centi (c) $10^{-2}$, mili (m) $10^{-3}$, micro (µ) $10^{-6}$, nano (n) $10^{-9}$, pico (p) $10^{-12}$.

Assim, $2{,}5\times10^{-9}$ s $= 2{,}5$ ns e $4{,}7\times10^{6}$ W $= 4{,}7$ MW.

### Ordem de grandeza
A **ordem de grandeza** de um número é a potência de dez mais próxima dele. Estimativas desse tipo ("uma pessoa tem massa da ordem de $10^2$ kg") são úteis para conferir contas e para resolver problemas em que não se tem todos os dados.

**Exemplo.** Quantas batidas o coração dá numa vida de 80 anos? Cerca de 70 por minuto: $70 \times 60 \times 24 \times 365 \times 80 \approx 3\times10^{9}$. A ordem de grandeza é $10^{9}$, e essa estimativa vale mesmo que a frequência varie bastante.

**Armadilha:** misturar símbolos de prefixos: "M" (mega) e "m" (mili) diferem por um fator $10^{9}$; "K" maiúsculo é kelvin, não quilo.

No experimento, faça o zoom do próton ao Universo e identifique a ordem de grandeza de cada objeto; depois veja como os padrões do SI são definidos a partir de constantes da natureza.`,
      experiments: [
        { kind: "sim", id: "escalas-unidades", scenario: "potencias-de-dez", note: "Faça o zoom de 41 ordens de grandeza e situe cada objeto numa régua logarítmica." },
        { kind: "sim", id: "escalas-unidades", scenario: "padroes-si", note: "Veja o metro, o segundo e o quilograma definidos por constantes exatas." },
      ],
    },
    "1-4": {
      text: String.raw`Para mudar a unidade de uma grandeza usamos a **conversão em cadeia**: multiplicamos a medida por **fatores de conversão**, frações em que o numerador e o denominador representam a mesma quantidade em unidades diferentes. Como, por exemplo,
$$\frac{1\ \text{km}}{1000\ \text{m}} = 1 \quad\text{e}\quad \frac{3600\ \text{s}}{1\ \text{h}} = 1 ,$$
multiplicar por eles não muda a grandeza, apenas a sua expressão.

### Como escolher a fração
As unidades se comportam como símbolos algébricos: cancelam-se quando aparecem no numerador e no denominador. Escolha cada fator de modo que a unidade indesejada fique no lado oposto e se cancele.

**Exemplo 1.** Um carro a 90 km/h:
$$90\ \frac{\text{km}}{\text{h}}\times\frac{1000\ \text{m}}{1\ \text{km}}\times\frac{1\ \text{h}}{3600\ \text{s}} = 25\ \text{m/s} .$$
Um atalho útil: dividir km/h por 3,6 dá m/s.

### Unidades elevadas a potências
Quando a unidade está ao quadrado ou ao cubo, o fator inteiro também vai à potência. Como $1\ \text{m} = 100\ \text{cm}$,
$$1\ \text{m}^3 = (100\ \text{cm})^3 = 10^{6}\ \text{cm}^3 .$$

**Exemplo 2.** A densidade do alumínio é 2,70 g/cm³. Em unidades do SI:
$$2{,}70\ \frac{\text{g}}{\text{cm}^3}\times\frac{1\ \text{kg}}{1000\ \text{g}}\times\left(\frac{100\ \text{cm}}{1\ \text{m}}\right)^3 = 2{,}70\times10^{3}\ \text{kg/m}^3 .$$

### Análise dimensional como detector de erros
Se, ao final, as unidades não se cancelam até sobrar a unidade desejada, há um fator invertido. Conferir as unidades é a forma mais barata de pegar erros em contas.

**Armadilha:** converter cm³ para m³ dividindo por 100, como se fosse cm para m. O fator correto é $10^{6}$.

No experimento, acompanhe as conversões em cadeia com as unidades sendo riscadas a cada fator; troque para massa específica e volume para ver o fator ao cubo, e ligue o "erro comum" para ver como as unidades denunciam um fator de cabeça para baixo.`,
      experiments: [
        { kind: "sim", id: "escalas-unidades", scenario: "conversao", params: { modo: 1, grandeza: 0, valor: 90 }, note: "Converta 90 km/h em m/s acompanhando as unidades que se cancelam a cada fator." },
        { kind: "sim", id: "escalas-unidades", scenario: "conversao", params: { modo: 1, grandeza: 1, valor: 2.7 }, note: "Converta 2,7 g/cm³ em kg/m³ e veja o fator de comprimento ir ao cubo." },
        { kind: "sim", id: "escalas-unidades", scenario: "conversao", params: { modo: 1, erro: 1 }, note: "Monte o primeiro fator de cabeça para baixo e veja as unidades denunciarem o erro." },
      ],
    },
    "1-5": {
      text: String.raw`### Uma história de padrões
O metro nasceu, no fim do século XVIII, como a décima milionésima parte da distância do polo norte ao equador. Logo depois foi materializado numa barra de platina e, mais tarde, numa barra de platina e irídio guardada perto de Paris, com cópias distribuídas pelo mundo. Barras, porém, dilatam, se desgastam e só podem ser comparadas com precisão limitada. Em 1960 o metro passou a ser definido por um número de comprimentos de onda de uma luz emitida pelo criptônio-86.

### A definição atual
Desde 1983, o metro é definido pela **velocidade da luz no vácuo**, fixada em exatamente
$$c = 299\,792\,458\ \text{m/s} .$$
Um metro é a distância que a luz percorre no vácuo em $1/299\,792\,458$ de segundo. Como o segundo é medido com precisão enorme (seção 1-6), o metro herda essa precisão. Na prática, ele é realizado com lasers estabilizados e interferometria, contando comprimentos de onda.

### Escalas de comprimento
Do raio de um próton ($\sim10^{-15}$ m) ao raio do Universo observável ($\sim10^{26}$ m) há mais de 40 ordens de grandeza. A Terra tem diâmetro de cerca de $1{,}3\times10^{7}$ m; um glóbulo vermelho, $7\times10^{-6}$ m.

**Exemplo.** Em 1 ns a luz percorre $3\times10^{8}\cdot10^{-9} = 0{,}30$ m. É por isso que, num computador com relógio de 3 GHz, um sinal não consegue atravessar mais que cerca de 10 cm por ciclo, o que limita o tamanho dos circuitos.

### Medidas na bancada
No laboratório, comprimentos pequenos são medidos com paquímetro (resolução típica de 0,05 mm) e micrômetro (0,01 mm). Fios finos e esferas pequenas pedem o micrômetro.

**Armadilha:** achar que, por $c$ ser "exata", a velocidade da luz deixou de ser medida. O que mudou foi a definição: agora é o metro que decorre de $c$.

No experimento, veja o pulso de luz percorrer a régua de 1 m em câmera lenta e conte os comprimentos de onda do laser; depois use o zoom de potências de dez para comparar comprimentos de objetos reais e meça um fio com o micrômetro.`,
      experiments: [
        { kind: "sim", id: "escalas-unidades", scenario: "padroes-si", params: { modo: 2, padrao: 0, Lalvo: 1 }, note: "Veja a luz percorrer 1 m em 3,34 ns e conte os comprimentos de onda do laser de He-Ne." },
        { kind: "sim", id: "escalas-unidades", scenario: "potencias-de-dez", note: "Compare os comprimentos de objetos reais do próton ao Universo." },
        { kind: "sim", id: "instrumentos-medida", scenario: "micrometro", note: "Meça o diâmetro de um fio e de uma esfera com o micrômetro." },
      ],
    },
    "1-6": {
      text: String.raw`O tempo serve tanto para datar acontecimentos quanto para medir intervalos. Qualquer fenômeno que se repita de forma regular pode servir de relógio: a rotação da Terra, um pêndulo, um cristal de quartzo vibrando, um átomo emitindo radiação.

### Do dia ao átomo
O segundo foi definido por muito tempo como uma fração do dia solar médio. Mas a rotação da Terra não é perfeitamente regular: ela se desacelera lentamente por causa das marés e sofre flutuações de alguns milissegundos por dia. Relógios de quartzo, que oscilam a 32 768 Hz, são bons para o dia a dia, mas variam com a temperatura e envelhecem.

### A definição atual
Desde 1967, o segundo é definido por um **relógio atômico de césio-133**: é a duração de exatamente
$$9\,192\,631\,770$$
períodos da radiação emitida numa transição entre dois níveis de energia do átomo de césio. Os melhores relógios de césio erram menos de 1 segundo em dezenas de milhões de anos, e relógios ópticos mais recentes são ainda melhores. O sistema de navegação por satélite depende dessa precisão: um erro de 1 µs no relógio corresponde a cerca de 300 m de erro na posição.

### Escalas de tempo
De $10^{-24}$ s (a vida de partículas muito instáveis) a $4\times10^{17}$ s (a idade do Universo), passando por uma batida do coração (cerca de 1 s) e um ano ($3{,}16\times10^{7}$ s).

**Exemplo.** Um relógio de quartzo com erro de 20 ppm (partes por milhão) atrasa ou adianta $20\times10^{-6}\times 86\,400 \approx 1{,}7$ s por dia, cerca de 52 s por mês. Um relógio de césio, no mesmo mês, erraria menos de um bilionésimo de segundo.

### Tempo de reação
Medidas manuais de tempo esbarram no **tempo de reação** humano, da ordem de 0,2 s. Por isso cronômetros de mão não servem para medir intervalos curtos, e laboratórios usam fotoportas.

**Armadilha:** achar que mais casas decimais no cronômetro significam mais precisão. Num cronômetro manual, a incerteza é dominada pela reação de quem aperta o botão.

No experimento, compare o relógio de césio com um de quartzo de erro ajustável e calcule o desvio acumulado; depois meça o seu tempo de reação com a régua em queda.`,
      experiments: [
        { kind: "sim", id: "escalas-unidades", scenario: "padroes-si", params: { modo: 2, padrao: 1, ppm: 20 }, note: "Conte os ciclos do césio e veja quanto um relógio de quartzo de 20 ppm se afasta por dia." },
        { kind: "sim", id: "medidas-erros", scenario: "reacao", note: "Meça o seu tempo de reação e veja por que cronômetros manuais não medem intervalos curtos." },
        { kind: "pratica", id: "exp1-tempo-reacao", note: "Roteiro de bancada: tempo de reação com régua em queda." },
      ],
    },
    "1-7": {
      text: String.raw`### O quilograma
Durante 130 anos, o quilograma foi a massa de um cilindro de platina e irídio guardado em Sèvres, na França, o **protótipo internacional**. Comparações periódicas mostraram que as cópias nacionais e o protótipo se afastavam uns dos outros em dezenas de microgramas, sem que se pudesse dizer qual deles estava "mudando". Em 2019 o quilograma passou a ser definido fixando o valor exato da **constante de Planck**:
$$h = 6{,}626\,070\,15\times10^{-34}\ \text{J·s} .$$
Como $\text{J·s} = \text{kg·m}^2/\text{s}$ e o metro e o segundo já estão definidos, fixar $h$ define o quilograma. Uma das formas de realizá-lo é a **balança de Kibble**, que compara o peso de uma massa com uma força eletromagnética medida por padrões elétricos ligados a $h$.

### A unidade de massa atômica
Na escala atômica é mais cômodo comparar massas com a de um átomo. A **unidade de massa atômica** é $1/12$ da massa do átomo de carbono-12:
$$1\ \text{u} = 1{,}660\,539\times10^{-27}\ \text{kg} .$$
Um próton tem cerca de 1,007 u; uma molécula de água, cerca de 18 u.

### Massa específica
A **massa específica** (densidade) de um material é a massa por unidade de volume:
$$\rho = \frac{m}{V} .$$
Na unidade SI, kg/m³: água, cerca de 1000 kg/m³; alumínio, 2700; aço, 7800; ar ao nível do mar, 1,2.

**Exemplo.** Um cilindro de 2,00 cm de diâmetro e 5,00 cm de altura tem massa de 42,4 g. O volume é $\pi\,(1{,}00)^2\cdot 5{,}00 = 15{,}7$ cm³, e $\rho = 42{,}4/15{,}7 \approx 2{,}70$ g/cm³ $= 2{,}70\times10^{3}$ kg/m³: provavelmente alumínio.

**Armadilha:** confundir massa com peso. A massa mede a inércia e não depende do lugar; o peso é uma força e depende da gravidade local (seção 5-5).

No experimento, veja na balança de Kibble como o peso é equilibrado por uma força magnética e confira que a massa calculada não depende do fator geométrico; depois meça e pese peças na bancada para identificar o material pela densidade.`,
      experiments: [
        { kind: "sim", id: "escalas-unidades", scenario: "padroes-si", params: { modo: 2, padrao: 2, mK: 1 }, note: "Na balança de Kibble, confira que m = UI/(gv) devolve a massa qualquer que seja B·L." },
        { kind: "sim", id: "instrumentos-medida", scenario: "paquimetro", note: "Meça um cilindro, pese-o e calcule a densidade com a propagação de incertezas." },
        { kind: "sim", id: "escalas-unidades", scenario: "conversao", params: { modo: 1, grandeza: 1, valor: 2.7 }, note: "Converta a densidade de g/cm³ para kg/m³." },
      ],
    },
  },
};
