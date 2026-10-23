// Catálogo do plano de implementação (FG I–IV e Exp I–III), extraído do documento do plano.
// O app usa esta lista para mostrar o que já foi publicado e o que vem a seguir.
import type { Course, Priority } from "@fisilab/core";

export interface PlannedSim {
  course: Course;
  topic: string;
  title: string;
  priority: Priority;
  /** O que a sim oferece além dos concorrentes, segundo o plano. */
  beyond: string;
}

export const plan: PlannedSim[] = [
  {
    "course": "FG I",
    "topic": "Vetores",
    "title": "Soma, decomposição, produto escalar e vetorial em 3D",
    "priority": "P1",
    "beyond": "Produto vetorial com regra da mão direita animada em 3D"
  },
  {
    "course": "FG I",
    "topic": "Cinemática 1D",
    "title": "Corredor / carro com gráficos x(t), v(t), a(t) ligados",
    "priority": "P1",
    "beyond": "Desenhar a(t) e ver x(t) integrado; derivada e área mostradas"
  },
  {
    "course": "FG I",
    "topic": "Cinemática 2D",
    "title": "Lançamento de projéteis",
    "priority": "P1",
    "beyond": "Arrasto linear e quadrático, vento, alvo, comparação com ou sem ar"
  },
  {
    "course": "FG I",
    "topic": "Cinemática 2D",
    "title": "Movimento circular, aceleração centrípeta e tangencial",
    "priority": "P1",
    "beyond": "Vetores em coordenadas polares"
  },
  {
    "course": "FG I",
    "topic": "Referenciais",
    "title": "Movimento relativo (barco no rio, avião com vento, chuva)",
    "priority": "P2",
    "beyond": "Troca de referencial com um clique, incluindo não-inercial"
  },
  {
    "course": "FG I",
    "topic": "Leis de Newton",
    "title": "Forças e movimento, diagrama de corpo livre interativo",
    "priority": "P1",
    "beyond": "Aluno monta o DCL e o sistema verifica"
  },
  {
    "course": "FG I",
    "topic": "Leis de Newton",
    "title": "Plano inclinado com atrito estático e cinético",
    "priority": "P1",
    "beyond": "Curva de atrito vs força aplicada, transição estático→cinético"
  },
  {
    "course": "FG I",
    "topic": "Leis de Newton",
    "title": "Máquina de Atwood, polias, blocos acoplados",
    "priority": "P1",
    "beyond": "Polias com massa e momento de inércia"
  },
  {
    "course": "FG I",
    "topic": "Dinâmica",
    "title": "Arrasto e velocidade terminal (paraquedista)",
    "priority": "P2",
    "beyond": "Densidade do ar variável com altitude"
  },
  {
    "course": "FG I",
    "topic": "Dinâmica",
    "title": "Curva com inclinação (loop, estrada compensada)",
    "priority": "P2",
    "beyond": "Mapa de forças normal e atrito ao longo da pista"
  },
  {
    "course": "FG I",
    "topic": "Energia",
    "title": "Pista de skate / montanha-russa com energia",
    "priority": "P1",
    "beyond": "Pista desenhável, atrito, gráfico de energia potencial U(x) com pontos de retorno"
  },
  {
    "course": "FG I",
    "topic": "Energia",
    "title": "Sistema massa-mola, trabalho e potência",
    "priority": "P1",
    "beyond": "Trabalho como área sob F(x) em tempo real"
  },
  {
    "course": "FG I",
    "topic": "Energia",
    "title": "Forças conservativas vs não conservativas",
    "priority": "P2",
    "beyond": "Integral de linha por caminhos diferentes"
  },
  {
    "course": "FG I",
    "topic": "Momento",
    "title": "Colisões 1D e 2D (elásticas, inelásticas, coeficiente de restituição)",
    "priority": "P1",
    "beyond": "Referencial do CM, tabela de momento/energia antes e depois"
  },
  {
    "course": "FG I",
    "topic": "Momento",
    "title": "Centro de massa de sistemas e corpos extensos",
    "priority": "P2",
    "beyond": "Recortar formato e calcular CM numericamente"
  },
  {
    "course": "FG I",
    "topic": "Momento",
    "title": "Foguete e massa variável",
    "priority": "P2",
    "beyond": "Equação de Tsiolkovsky com estágios"
  },
  {
    "course": "FG I",
    "topic": "Rotação",
    "title": "Cinemática rotacional, torque e momento de inércia",
    "priority": "P1",
    "beyond": "Teorema dos eixos paralelos interativo"
  },
  {
    "course": "FG I",
    "topic": "Rotação",
    "title": "Rolamento em plano inclinado (cilindro, esfera, anel)",
    "priority": "P1",
    "beyond": "Corrida entre corpos com previsão antes de soltar"
  },
  {
    "course": "FG I",
    "topic": "Rotação",
    "title": "Conservação do momento angular (patinadora, cadeira giratória)",
    "priority": "P1",
    "beyond": "Vetor L em 3D"
  },
  {
    "course": "FG I",
    "topic": "Rotação",
    "title": "Giroscópio e precessão, pião",
    "priority": "P3",
    "beyond": "Nutação, Euler em 3D"
  },
  {
    "course": "FG I",
    "topic": "Estática",
    "title": "Equilíbrio de corpos (gangorra, escada, viga, guindaste)",
    "priority": "P2",
    "beyond": "Cálculo de reações de apoio e treliças simples"
  },
  {
    "course": "FG I",
    "topic": "Gravitação",
    "title": "Órbitas, leis de Kepler, campo gravitacional",
    "priority": "P1",
    "beyond": "Problema de 2 e 3 corpos, velocidade de escape, transferência de Hohmann"
  },
  {
    "course": "FG I",
    "topic": "Gravitação",
    "title": "Marés e pontos de Lagrange",
    "priority": "P3",
    "beyond": "Potencial efetivo em referencial girante"
  },
  {
    "course": "FG I",
    "topic": "Oscilações (ponte p/ FG II)",
    "title": "Pêndulo simples, físico e de grandes amplitudes",
    "priority": "P1",
    "beyond": "Solução exata vs aproximação de pequenos ângulos, espaço de fase"
  },
  {
    "course": "FG I",
    "topic": "Caos",
    "title": "Pêndulo duplo e pêndulo forçado",
    "priority": "P3",
    "beyond": "Expoente de Lyapunov, mapa de Poincaré"
  },
  {
    "course": "FG II",
    "topic": "Hidrostática",
    "title": "Pressão com profundidade, manômetro, prensa hidráulica",
    "priority": "P1",
    "beyond": "Fluidos com densidades diferentes em camadas"
  },
  {
    "course": "FG II",
    "topic": "Hidrostática",
    "title": "Empuxo e flutuação (Arquimedes)",
    "priority": "P1",
    "beyond": "Estabilidade de navio: metacentro e tombamento"
  },
  {
    "course": "FG II",
    "topic": "Hidrodinâmica",
    "title": "Continuidade e Bernoulli (tubo de Venturi, Torricelli)",
    "priority": "P1",
    "beyond": "Medidor de vazão com perda de carga"
  },
  {
    "course": "FG II",
    "topic": "Hidrodinâmica",
    "title": "Escoamento laminar vs turbulento, viscosidade, Poiseuille",
    "priority": "P2",
    "beyond": "Número de Reynolds ao vivo; Lattice Boltzmann 2D (vórtices de Kármán)"
  },
  {
    "course": "FG II",
    "topic": "Hidrodinâmica",
    "title": "Sustentação em aerofólio",
    "priority": "P3",
    "beyond": "Campo de velocidade e pressão em volta do perfil"
  },
  {
    "course": "FG II",
    "topic": "MHS",
    "title": "Massa-mola, pêndulo, círculo de referência",
    "priority": "P1",
    "beyond": "Fasores e projeção animados"
  },
  {
    "course": "FG II",
    "topic": "Oscilações",
    "title": "Amortecido (sub, crítico, super)",
    "priority": "P1",
    "beyond": "Plano complexo das raízes da equação característica"
  },
  {
    "course": "FG II",
    "topic": "Oscilações",
    "title": "Forçado e ressonância",
    "priority": "P1",
    "beyond": "Curva de ressonância e fase, fator Q, ponte de Tacoma"
  },
  {
    "course": "FG II",
    "topic": "Oscilações",
    "title": "Osciladores acoplados e modos normais",
    "priority": "P2",
    "beyond": "N massas → transição para onda contínua; autovalores mostrados"
  },
  {
    "course": "FG II",
    "topic": "Ondas",
    "title": "Onda em corda (pulsos, reflexão, extremidade fixa/livre)",
    "priority": "P1",
    "beyond": "Junção de cordas com densidades diferentes (R e T)"
  },
  {
    "course": "FG II",
    "topic": "Ondas",
    "title": "Ondas estacionárias e harmônicos",
    "priority": "P1",
    "beyond": "Série de Fourier: arrastar a corda e ver o espectro"
  },
  {
    "course": "FG II",
    "topic": "Ondas",
    "title": "Superposição, batimentos, velocidade de grupo e fase",
    "priority": "P1",
    "beyond": "Pacote de onda com dispersão"
  },
  {
    "course": "FG II",
    "topic": "Ondas",
    "title": "Interferência em 2D (cuba de ondas)",
    "priority": "P1",
    "beyond": "FDTD 2D com obstáculos desenháveis, difração em fenda"
  },
  {
    "course": "FG II",
    "topic": "Som",
    "title": "Ondas sonoras, intensidade, decibéis",
    "priority": "P1",
    "beyond": "Áudio real pelo alto-falante + microfone do aparelho"
  },
  {
    "course": "FG II",
    "topic": "Som",
    "title": "Tubos abertos/fechados, instrumentos",
    "priority": "P2",
    "beyond": "Análise de espectro de instrumento real gravado"
  },
  {
    "course": "FG II",
    "topic": "Som",
    "title": "Efeito Doppler e cone de Mach",
    "priority": "P1",
    "beyond": "Fonte e observador móveis, estrondo sônico"
  },
  {
    "course": "FG II",
    "topic": "Termometria",
    "title": "Escalas, dilatação linear/volumétrica, lâmina bimetálica",
    "priority": "P2",
    "beyond": "Tensão térmica em trilho"
  },
  {
    "course": "FG II",
    "topic": "Calor",
    "title": "Calorimetria e mudança de fase",
    "priority": "P1",
    "beyond": "Curva de aquecimento com calor latente, mistura de substâncias"
  },
  {
    "course": "FG II",
    "topic": "Calor",
    "title": "Condução, convecção, radiação",
    "priority": "P2",
    "beyond": "Equação do calor 1D/2D por diferenças finitas, parede composta, corpo negro"
  },
  {
    "course": "FG II",
    "topic": "Gases",
    "title": "Gás ideal molecular (pressão, temperatura, volume)",
    "priority": "P1",
    "beyond": "Distribuição de Maxwell-Boltzmann medida das partículas"
  },
  {
    "course": "FG II",
    "topic": "Teoria cinética",
    "title": "Livre caminho médio, difusão, movimento browniano",
    "priority": "P2",
    "beyond": "Random walk com ajuste de D"
  },
  {
    "course": "FG II",
    "topic": "1ª Lei",
    "title": "Processos no diagrama PV (isotérmico, adiabático, isobárico, isocórico)",
    "priority": "P1",
    "beyond": "Arrastar o estado no PV e ver Q, W, ΔU calculados"
  },
  {
    "course": "FG II",
    "topic": "Máquinas",
    "title": "Ciclos Carnot, Otto, Diesel, Stirling, Rankine, Brayton",
    "priority": "P1",
    "beyond": "Motor animado acoplado ao diagrama PV e TS, rendimento ao vivo"
  },
  {
    "course": "FG II",
    "topic": "Máquinas",
    "title": "Refrigerador e bomba de calor",
    "priority": "P2",
    "beyond": "COP e ciclo de compressão de vapor"
  },
  {
    "course": "FG II",
    "topic": "2ª Lei",
    "title": "Entropia, irreversibilidade, expansão livre",
    "priority": "P2",
    "beyond": "Contagem de microestados, entropia estatística"
  },
  {
    "course": "FG II",
    "topic": "Gases reais",
    "title": "Van der Waals, ponto crítico",
    "priority": "P3",
    "beyond": "Construção de Maxwell nas isotermas"
  },
  {
    "course": "FG III",
    "topic": "Eletrostática",
    "title": "Carga por atrito, indução, eletroscópio",
    "priority": "P2",
    "beyond": "Polarização microscópica animada"
  },
  {
    "course": "FG III",
    "topic": "Coulomb",
    "title": "Força entre cargas, superposição",
    "priority": "P1",
    "beyond": "Distribuições contínuas (anel, disco, fio) com integração numérica mostrada"
  },
  {
    "course": "FG III",
    "topic": "Campo elétrico",
    "title": "Linhas de campo e vetores de cargas arrastáveis",
    "priority": "P1",
    "beyond": "3D, sonda de campo, dipolo em campo externo (torque)"
  },
  {
    "course": "FG III",
    "topic": "Gauss",
    "title": "Superfícies gaussianas e fluxo",
    "priority": "P1",
    "beyond": "Superfície arrastável com fluxo calculado por elemento"
  },
  {
    "course": "FG III",
    "topic": "Potencial",
    "title": "Equipotenciais, voltímetro virtual, energia potencial",
    "priority": "P1",
    "beyond": "Solver de Laplace (relaxação) com condutores desenháveis; E = −∇V visível"
  },
  {
    "course": "FG III",
    "topic": "Condutores",
    "title": "Blindagem, gaiola de Faraday, poder das pontas",
    "priority": "P2",
    "beyond": "Densidade superficial de carga em forma arbitrária"
  },
  {
    "course": "FG III",
    "topic": "Capacitores",
    "title": "Placas paralelas, dielétrico, associações",
    "priority": "P1",
    "beyond": "Campo de borda, energia armazenada, força entre placas"
  },
  {
    "course": "FG III",
    "topic": "Corrente",
    "title": "Modelo microscópico (Drude), resistividade",
    "priority": "P2",
    "beyond": "Velocidade de deriva vs térmica"
  },
  {
    "course": "FG III",
    "topic": "Circuitos DC",
    "title": "Construtor de circuitos (resistores, fontes, lâmpadas, chaves)",
    "priority": "P1",
    "beyond": "Solver MNA, Kirchhoff mostrado nó a nó, multímetro com erro, ponte de Wheatstone"
  },
  {
    "course": "FG III",
    "topic": "Circuitos",
    "title": "RC: carga e descarga",
    "priority": "P1",
    "beyond": "Osciloscópio virtual com τ medido por cursor"
  },
  {
    "course": "FG III",
    "topic": "Magnetismo",
    "title": "Ímãs, bússola, campo da Terra",
    "priority": "P1",
    "beyond": "Inclinação magnética por latitude (incluindo Porto Alegre)"
  },
  {
    "course": "FG III",
    "topic": "Força magnética",
    "title": "Partícula em campo B, ciclotron, espectrômetro de massa",
    "priority": "P1",
    "beyond": "Seletor de velocidades, garrafa magnética, campo E e B cruzados"
  },
  {
    "course": "FG III",
    "topic": "Força magnética",
    "title": "Fio com corrente, motor DC, efeito Hall",
    "priority": "P1",
    "beyond": "Motor desmontável com torque vs ângulo"
  },
  {
    "course": "FG III",
    "topic": "Fontes de B",
    "title": "Biot-Savart (fio, espira, solenoide, toroide)",
    "priority": "P1",
    "beyond": "Integração de Biot-Savart com segmentos desenháveis em 3D"
  },
  {
    "course": "FG III",
    "topic": "Ampère",
    "title": "Circulação de B em caminhos amperianos",
    "priority": "P1",
    "beyond": "Caminho desenhável com ∮B·dl calculado"
  },
  {
    "course": "FG III",
    "topic": "Indução",
    "title": "Lei de Faraday e Lenz (ímã e espira, gerador)",
    "priority": "P1",
    "beyond": "Fluxo Φ(t) e fem(t) plotados juntos"
  },
  {
    "course": "FG III",
    "topic": "Indução",
    "title": "Transformador, correntes de Foucault, freio magnético",
    "priority": "P2",
    "beyond": "Perdas e eficiência"
  },
  {
    "course": "FG III",
    "topic": "Indutância",
    "title": "Circuitos RL e LC",
    "priority": "P1",
    "beyond": "Energia oscilando entre L e C"
  },
  {
    "course": "FG III",
    "topic": "CA",
    "title": "RLC série/paralelo, ressonância, fasores",
    "priority": "P1",
    "beyond": "Diagrama fasorial girando, impedância complexa, filtros e diagrama de Bode"
  },
  {
    "course": "FG III",
    "topic": "Materiais",
    "title": "Dia, para e ferromagnetismo, histerese",
    "priority": "P2",
    "beyond": "Modelo de Ising 2D (domínios)"
  },
  {
    "course": "FG III",
    "topic": "Maxwell",
    "title": "Corrente de deslocamento, onda EM",
    "priority": "P1",
    "beyond": "FDTD 1D/2D/3D: antena dipolo irradiando, polarização"
  },
  {
    "course": "FG III",
    "topic": "Ondas EM",
    "title": "Espectro, energia, vetor de Poynting",
    "priority": "P2",
    "beyond": "Fluxo de energia visível em capacitor carregando"
  },
  {
    "course": "FG IV",
    "topic": "Ótica geométrica",
    "title": "Reflexão, refração, Snell, reflexão interna total, fibra ótica",
    "priority": "P1",
    "beyond": "Ray tracing com meios de índice variável (miragem)"
  },
  {
    "course": "FG IV",
    "topic": "Ótica geométrica",
    "title": "Espelhos planos e esféricos",
    "priority": "P1",
    "beyond": "Aberração esférica visível"
  },
  {
    "course": "FG IV",
    "topic": "Ótica geométrica",
    "title": "Lentes delgadas e espessas, associação",
    "priority": "P1",
    "beyond": "Bancada ótica montável: microscópio, telescópio, olho e correção de miopia"
  },
  {
    "course": "FG IV",
    "topic": "Ótica geométrica",
    "title": "Prisma e dispersão",
    "priority": "P1",
    "beyond": "Arco-íris primário e secundário"
  },
  {
    "course": "FG IV",
    "topic": "Interferência",
    "title": "Fenda dupla de Young",
    "priority": "P1",
    "beyond": "Intensidade com envoltória de difração, luz branca"
  },
  {
    "course": "FG IV",
    "topic": "Interferência",
    "title": "Filmes finos, anéis de Newton, interferômetro de Michelson",
    "priority": "P1",
    "beyond": "Michelson para medir λ e índice de refração (vira prática do Exp III)"
  },
  {
    "course": "FG IV",
    "topic": "Difração",
    "title": "Fenda simples, rede de difração, resolução (Rayleigh)",
    "priority": "P1",
    "beyond": "Difração de Fraunhofer por abertura desenhável via FFT 2D"
  },
  {
    "course": "FG IV",
    "topic": "Polarização",
    "title": "Malus, Brewster, polarizadores e lâminas de onda",
    "priority": "P2",
    "beyond": "Esfera de Poincaré, polarização elíptica 3D"
  },
  {
    "course": "FG IV",
    "topic": "Relatividade",
    "title": "Dilatação do tempo, contração, simultaneidade",
    "priority": "P1",
    "beyond": "Diagrama de Minkowski interativo com transformação de Lorentz"
  },
  {
    "course": "FG IV",
    "topic": "Relatividade",
    "title": "Paradoxo dos gêmeos, Doppler relativístico, E = mc²",
    "priority": "P2",
    "beyond": "Linhas de mundo arrastáveis"
  },
  {
    "course": "FG IV",
    "topic": "Quântica (origens)",
    "title": "Radiação de corpo negro",
    "priority": "P1",
    "beyond": "Planck vs Rayleigh-Jeans, lei de Wien e Stefan"
  },
  {
    "course": "FG IV",
    "topic": "Quântica (origens)",
    "title": "Efeito fotoelétrico",
    "priority": "P1",
    "beyond": "Ajuste linear para obter h e função trabalho"
  },
  {
    "course": "FG IV",
    "topic": "Quântica (origens)",
    "title": "Efeito Compton",
    "priority": "P2",
    "beyond": "Cinemática da colisão fóton-elétron"
  },
  {
    "course": "FG IV",
    "topic": "Átomo",
    "title": "Modelos atômicos (Thomson, Rutherford, Bohr) e espectros",
    "priority": "P1",
    "beyond": "Espalhamento Rutherford com contagem estatística"
  },
  {
    "course": "FG IV",
    "topic": "Átomo",
    "title": "Espectros de emissão e absorção, laser",
    "priority": "P2",
    "beyond": "Espectroscópio com rede, níveis de energia, inversão de população"
  },
  {
    "course": "FG IV",
    "topic": "Ondas de matéria",
    "title": "De Broglie, difração de elétrons, fenda dupla de elétrons um a um",
    "priority": "P1",
    "beyond": "Construção estatística do padrão"
  },
  {
    "course": "FG IV",
    "topic": "Quântica",
    "title": "Poço infinito e finito, oscilador harmônico",
    "priority": "P1",
    "beyond": "Solver de Schrödinger 1D (Numerov / diferenças finitas) com potencial desenhável"
  },
  {
    "course": "FG IV",
    "topic": "Quântica",
    "title": "Tunelamento e barreira",
    "priority": "P1",
    "beyond": "Pacote gaussiano evoluindo (Crank-Nicolson), coeficiente de transmissão"
  },
  {
    "course": "FG IV",
    "topic": "Quântica",
    "title": "Princípio da incerteza, pacotes de onda",
    "priority": "P2",
    "beyond": "Espaço x e p lado a lado via FFT"
  },
  {
    "course": "FG IV",
    "topic": "Quântica",
    "title": "Átomo de hidrogênio, orbitais",
    "priority": "P2",
    "beyond": "Orbitais 3D (nuvem de probabilidade)"
  },
  {
    "course": "FG IV",
    "topic": "Quântica",
    "title": "Spin, Stern-Gerlach",
    "priority": "P3",
    "beyond": "Medidas sequenciais"
  },
  {
    "course": "FG IV",
    "topic": "Sólidos",
    "title": "Bandas de energia, semicondutores, diodo e LED",
    "priority": "P3",
    "beyond": "Modelo de Kronig-Penney"
  },
  {
    "course": "FG IV",
    "topic": "Nuclear",
    "title": "Decaimento radioativo, meia-vida, datação",
    "priority": "P1",
    "beyond": "Monte Carlo com ajuste exponencial"
  },
  {
    "course": "FG IV",
    "topic": "Nuclear",
    "title": "Fissão, fusão, reação em cadeia",
    "priority": "P2",
    "beyond": "Fator de multiplicação k e criticalidade"
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Medidas e incertezas (paquímetro, micrômetro, densidade de sólidos)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Queda livre e medida de g",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Trilho de ar: MRU e MRUV",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "2ª Lei de Newton",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Pêndulo simples (período vs comprimento e amplitude)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Lei de Hooke e associação de molas",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Colisões no trilho de ar",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Plano inclinado e atrito",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Momento de inércia (disco/roda de Maxwell)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp I",
    "topic": "Prática",
    "title": "Lançamento horizontal",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Densidade e empuxo",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Viscosidade (Stokes)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Tensão superficial",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Oscilador amortecido e forçado",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Ondas estacionárias em corda (Melde)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Tubo de Kundt / ressonância e velocidade do som",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Dilatação térmica",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Calor específico (calorímetro)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Equivalente mecânico do calor",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Lei de Boyle",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Resfriamento de Newton",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp II",
    "topic": "Prática",
    "title": "Condutividade térmica",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Uso de multímetro e osciloscópio",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Lei de Ohm e resistores não-ôhmicos (lâmpada, diodo)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Kirchhoff e ponte de Wheatstone",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Carga e descarga RC",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Mapeamento de equipotenciais (cuba eletrolítica)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Campo magnético de bobina (Biot-Savart, Helmholtz)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Relação e/m",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Indução e transformador",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "RLC e ressonância",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Reflexão e refração",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Lentes e bancada ótica",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Difração e rede",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Polarização (Malus)",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Efeito fotoelétrico",
    "priority": "P1",
    "beyond": ""
  },
  {
    "course": "Exp III",
    "topic": "Prática",
    "title": "Espectroscopia",
    "priority": "P1",
    "beyond": ""
  }
];
