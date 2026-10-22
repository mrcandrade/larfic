import type { ChapterContent } from "../conteudo.ts";

export const capitulo: ChapterContent = {
  n: 21,
  intro: String.raw`O eletromagnetismo começa por uma propriedade da matéria que não se vê, mas que explica quase tudo o que acontece em escala atômica e química: a **carga elétrica**. Neste capítulo você vai ver como os corpos se carregam, por que alguns materiais deixam a carga se mover e outros não, e como medir a força entre duas cargas com a **lei de Coulomb**. Fechamos com duas leis experimentais que valem sem exceção conhecida: a carga vem em múltiplos de uma quantidade mínima, $e$, e a carga total de um sistema isolado nunca muda.`,
  sections: {
    "21-1": {
      text: String.raw`### Cargas Elétricas
Toda matéria comum é feita de prótons (carga positiva), elétrons (carga negativa) e nêutrons (sem carga). Um corpo com o mesmo número de prótons e elétrons é **neutro**; ao ganhar elétrons fica negativo, ao perdê-los fica positivo. A regra qualitativa é simples: **cargas de mesmo sinal se repelem, de sinais opostos se atraem**. Quando você esfrega um canudo plástico num pano de lã, elétrons passam de um material para o outro (a série triboelétrica diz quem tende a ganhar); nada é criado, apenas transferido.

### Condutores e Isolantes
Nos **condutores** (metais, água salgada, o corpo humano) parte dos elétrons fica livre para andar pelo material; nos **isolantes** (vidro, borracha, plástico seco) as cargas ficam presas onde foram colocadas. Os **semicondutores** ficam no meio do caminho. Isso explica a **indução**: aproximar um bastão negativo de uma esfera metálica neutra empurra elétrons para o lado oposto, e o lado próximo fica positivo. Como a parte positiva está mais perto, a atração vence a repulsão e o corpo neutro é atraído. Uma armadilha comum é achar que um corpo neutro não sente a presença de uma carga: ele sente, por polarização.

### A Lei de Coulomb
Para duas partículas com cargas $q_1$ e $q_2$ separadas por $r$, o módulo da força é

$$F = k\,\frac{|q_1|\,|q_2|}{r^2}, \qquad k = \frac{1}{4\pi\varepsilon_0} \approx 8{,}99\times10^9\ \mathrm{N\,m^2/C^2},$$

dirigida ao longo da reta que une as cargas. A força sobre $q_1$ e a força sobre $q_2$ têm o mesmo módulo e sentidos opostos (terceira lei). Com várias cargas, vale a **superposição**: a força sobre uma delas é a soma **vetorial** das forças exercidas por cada uma das outras, como se as demais não existissem.

Exemplo: duas cargas de $+2\ \mu\mathrm{C}$ e $-3\ \mu\mathrm{C}$ a $0{,}30$ m uma da outra se atraem com $F = 8{,}99\times10^9\cdot(2\times10^{-6})(3\times10^{-6})/0{,}09 \approx 0{,}60$ N. Dobrando a distância, a força cai para um quarto. Atenção: somar os **módulos** das forças em vez dos vetores é o erro mais frequente nos problemas de superposição. Uma casca esférica uniformemente carregada atrai ou repele cargas externas como se toda a carga estivesse no centro, e não exerce força sobre cargas no seu interior.

No experimento, arraste as três cargas e veja o paralelogramo das forças sobre cada uma; depois, na eletrização, aproxime o bastão do eletroscópio sem encostar e observe as folhas se abrirem por indução.`,
      experiments: [
        { kind: "sim", id: "coulomb", scenario: "superposicao", note: "Arraste as cargas e confira a lei de Coulomb e a soma vetorial das forças." },
        { kind: "sim", id: "eletrizacao", scenario: "inducao", note: "Carregue o eletroscópio por indução e veja os elétrons livres do metal migrarem." },
        { kind: "sim", id: "eletrizacao", scenario: "atrito", note: "Esfregue materiais da série triboelétrica e descubra quem fica com os elétrons." },
        { kind: "concepcao", id: "neutro-nao-atraido", note: "Confronte a ideia de que um objeto neutro não sente uma carga próxima." },
        { kind: "sim", id: "maquinas-eletrostaticas", scenario: "balao", note: "Veja o balão carregado grudar na parede neutra por polarização." },
      ],
    },
    "21-2": {
      text: String.raw`Por muito tempo a eletricidade foi pensada como um fluido contínuo. Os experimentos mostram outra coisa: qualquer carga observada livre na natureza é um **múltiplo inteiro** da carga elementar,

$$q = n\,e, \qquad n = 0, \pm1, \pm2, \dots \qquad e = 1{,}602\times10^{-19}\ \mathrm{C}.$$

O elétron tem carga $-e$ e o próton $+e$. Dizemos que a carga é **quantizada**. Os quarks, que formam prótons e nêutrons, têm cargas de $\pm e/3$ e $\pm 2e/3$, mas nunca aparecem isolados, de modo que a regra continua valendo para tudo o que se mede no laboratório.

Por que não percebemos esses "degraus" no dia a dia? Porque $e$ é minúsculo. Um coulomb corresponde a $1/e \approx 6{,}24\times10^{18}$ elétrons. Uma corrente de $1$ A, típica de um aparelho pequeno, faz passar mais de seis quintilhões de elétrons por segundo por qualquer seção do fio. Exemplo: um bastão com carga de $-8{,}0$ nC ganhou $N = 8{,}0\times10^{-9}/1{,}602\times10^{-19} \approx 5{,}0\times10^{10}$ elétrons, número tão grande que acrescentar ou tirar um não faz diferença mensurável na prática.

A prova direta da quantização veio do experimento da **gota de óleo** de Millikan: gotículas carregadas são suspensas entre placas horizontais e a carga de cada uma é calculada a partir do equilíbrio entre peso, força elétrica e arrasto do ar. As cargas medidas se agrupam em valores múltiplos de um mesmo número. A armadilha aqui é tomar o **maior divisor comum** de poucas medidas como prova: com dados ruidosos é preciso muitas gotas e um histograma para que os agrupamentos apareçam.

No experimento, faça a borrifada de gotas, meça a carga de várias delas e monte o histograma: os picos aparecem em $e$, $2e$, $3e$… Depois tente segurar uma gota parada ajustando a tensão.`,
      experiments: [
        { kind: "sim", id: "millikan", scenario: "histograma", note: "Meça muitas gotas e veja as cargas se agruparem em múltiplos de e." },
        { kind: "pratica", id: "exp3-millikan", note: "Roteiro de bancada para determinar a carga elementar." },
        { kind: "desafio", id: "millikan-gota-parada", note: "Ache a tensão que deixa uma gota imóvel e conclua quantas cargas ela tem." },
      ],
    },
    "21-3": {
      text: String.raw`A segunda grande lei experimental sobre a carga é a **conservação**: num sistema isolado, a soma algébrica das cargas é sempre a mesma. Quando um bastão de vidro é esfregado na seda, o vidro fica positivo e a seda negativa **na mesma medida**; a soma continua zero. Quando duas esferas metálicas idênticas, uma com $+12$ nC e outra neutra, se tocam e se separam, cada uma fica com $+6$ nC: a carga se redistribuiu, mas o total de $+12$ nC se manteve. Se as esferas tiverem raios diferentes, a divisão deixa de ser meio a meio (a maior fica com mais carga), mas a soma, de novo, não muda.

A conservação vale também nos processos em que partículas são criadas ou destruídas. No decaimento beta, um nêutron vira um próton, um elétron e um antineutrino: $0 = (+e) + (-e) + 0$. Na **aniquilação**, um elétron e um pósitron somem e deixam dois fótons, sem carga; na **produção de pares**, um fóton energético cria um elétron e um pósitron. Em todas as reações nucleares, a soma dos números atômicos de um lado é igual à do outro.

Uma confusão comum é pensar que "aterrar" um corpo destrói a sua carga. O que acontece é que a carga escoa para a Terra (ou vem dela), que funciona como um reservatório enorme; a carga total do sistema corpo + Terra continua a mesma. Do mesmo modo, quando uma faísca salta de um dedo para a maçaneta, os elétrons apenas mudam de lugar.

No experimento, encoste uma esfera carregada no eletroscópio e confira que a carga perdida por uma aparece na outra; depois esfregue o bastão no pano e compare as duas cargas, sempre de mesmo módulo e sinais opostos.`,
      experiments: [
        { kind: "sim", id: "eletrizacao", scenario: "contato", note: "Divida a carga de uma esfera por contato e verifique que o total se conserva." },
        { kind: "sim", id: "eletrizacao", scenario: "atrito", note: "Compare a carga do bastão com a do pano depois de esfregar." },
        { kind: "sim", id: "maquinas-eletrostaticas", scenario: "travoltage", note: "Acompanhe a carga acumulada no corpo passando para a maçaneta numa faísca." },
      ],
    },
  },
};
