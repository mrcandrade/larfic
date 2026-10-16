import type { AnySimulation } from "@fisilab/core";
import { projetilArrasto } from "@fisilab/sim-projetil-arrasto";
import { circuitosDc } from "@fisilab/sim-circuitos-dc";
import { ciclosTermicos } from "@fisilab/sim-ciclos-termicos";
import { vetores3d } from "@fisilab/sim-vetores-3d";
import { cinematica1d } from "@fisilab/sim-cinematica-1d";
import { movimentoCircular } from "@fisilab/sim-movimento-circular";
import { forcasDcl } from "@fisilab/sim-forcas-dcl";
import { atwood } from "@fisilab/sim-atwood";
import { montanhaRussa } from "@fisilab/sim-montanha-russa";
import { massaMola } from "@fisilab/sim-massa-mola";
import { colisoes } from "@fisilab/sim-colisoes";
import { rotacaoTorque } from "@fisilab/sim-rotacao-torque";
import { rolamento } from "@fisilab/sim-rolamento";
import { momentoAngular } from "@fisilab/sim-momento-angular";
import { orbitasKepler } from "@fisilab/sim-orbitas-kepler";
import { pendulos } from "@fisilab/sim-pendulos";
import { coulomb } from "@fisilab/sim-coulomb";
import { campoEletrico } from "@fisilab/sim-campo-eletrico";
import { gauss } from "@fisilab/sim-gauss";
import { potencial } from "@fisilab/sim-potencial";
import { capacitores } from "@fisilab/sim-capacitores";
import { circuitoRc } from "@fisilab/sim-circuito-rc";
import { imasBussola } from "@fisilab/sim-imas-bussola";
import { particulaCampoB } from "@fisilab/sim-particula-campo-b";
import { motorHall } from "@fisilab/sim-motor-hall";
import { biotSavart } from "@fisilab/sim-biot-savart";
import { ampere } from "@fisilab/sim-ampere";
import { faradayLenz } from "@fisilab/sim-faraday-lenz";
import { rlLc } from "@fisilab/sim-rl-lc";
import { rlcCa } from "@fisilab/sim-rlc-ca";
import { ondaEm } from "@fisilab/sim-onda-em";
import { hidrostatica } from "@fisilab/sim-hidrostatica";
import { empuxo } from "@fisilab/sim-empuxo";
import { bernoulli } from "@fisilab/sim-bernoulli";
import { mhs } from "@fisilab/sim-mhs";
import { amortecido } from "@fisilab/sim-amortecido";
import { ressonancia } from "@fisilab/sim-ressonancia";
import { ondaCorda } from "@fisilab/sim-onda-corda";
import { ondasEstacionarias } from "@fisilab/sim-ondas-estacionarias";
import { superposicao } from "@fisilab/sim-superposicao";
import { cubaOndas } from "@fisilab/sim-cuba-ondas";
import { somIntensidade } from "@fisilab/sim-som-intensidade";
import { doppler } from "@fisilab/sim-doppler";
import { calorimetria } from "@fisilab/sim-calorimetria";
import { gasIdeal } from "@fisilab/sim-gas-ideal";
import { processosPv } from "@fisilab/sim-processos-pv";
import { refracao } from "@fisilab/sim-refracao";
import { espelhos } from "@fisilab/sim-espelhos";
import { lentes } from "@fisilab/sim-lentes";
import { prisma } from "@fisilab/sim-prisma";
import { fendaDupla } from "@fisilab/sim-fenda-dupla";
import { filmesFinos } from "@fisilab/sim-filmes-finos";
import { difracao } from "@fisilab/sim-difracao";
import { relatividade } from "@fisilab/sim-relatividade";
import { corpoNegro } from "@fisilab/sim-corpo-negro";
import { fotoeletrico } from "@fisilab/sim-fotoeletrico";
import { modelosAtomicos } from "@fisilab/sim-modelos-atomicos";
import { deBroglie } from "@fisilab/sim-de-broglie";
import { pocoQuantico } from "@fisilab/sim-poco-quantico";
import { tunelamento } from "@fisilab/sim-tunelamento";
import { decaimento } from "@fisilab/sim-decaimento";
import { instrumentosMedida } from "@fisilab/sim-instrumentos-medida";
import { quedaLivre } from "@fisilab/sim-queda-livre";
import { trilhoDeAr } from "@fisilab/sim-trilho-de-ar";
import { leiHooke } from "@fisilab/sim-lei-hooke";
import { rodaMaxwell } from "@fisilab/sim-roda-maxwell";
import { viscosidadeStokes } from "@fisilab/sim-viscosidade-stokes";
import { tensaoSuperficial } from "@fisilab/sim-tensao-superficial";
import { tuboKundt } from "@fisilab/sim-tubo-kundt";
import { dilatacaoTermica } from "@fisilab/sim-dilatacao-termica";
import { equivalenteMecanico } from "@fisilab/sim-equivalente-mecanico";
import { conducaoCalor } from "@fisilab/sim-conducao-calor";
import { multimetroOsciloscopio } from "@fisilab/sim-multimetro-osciloscopio";
import { curvaIv } from "@fisilab/sim-curva-iv";
import { ponteWheatstone } from "@fisilab/sim-ponte-wheatstone";
import { transformador } from "@fisilab/sim-transformador";
import { polarizacao } from "@fisilab/sim-polarizacao";
import { espectroscopia } from "@fisilab/sim-espectroscopia";
import { planoInclinado } from "@fisilab/sim-plano-inclinado";
import { plan, type PlannedSim } from "./plan.ts";
import { practices } from "./practices.ts";

export interface CatalogEntry {
  sim: AnySimulation;
  /** Títulos do plano (plan.ts) que esta sim cobre. */
  covers: string[];
}

/** Simulações publicadas. Cada nova sim em sims/* entra aqui. */
export const catalog: CatalogEntry[] = [
  { sim: projetilArrasto, covers: ["Lançamento de projéteis", "Arrasto e velocidade terminal (paraquedista)"] },
  { sim: circuitosDc, covers: ["Construtor de circuitos (resistores, fontes, lâmpadas, chaves)"] },
  { sim: ciclosTermicos, covers: ["Ciclos Carnot, Otto, Diesel, Stirling, Rankine, Brayton"] },
  { sim: vetores3d, covers: ["Soma, decomposição, produto escalar e vetorial em 3D"] },
  { sim: cinematica1d, covers: ["Corredor / carro com gráficos x(t), v(t), a(t) ligados"] },
  { sim: movimentoCircular, covers: ["Movimento circular, aceleração centrípeta e tangencial"] },
  { sim: forcasDcl, covers: ["Forças e movimento, diagrama de corpo livre interativo"] },
  { sim: planoInclinado, covers: ["Plano inclinado com atrito estático e cinético"] },
  { sim: atwood, covers: ["Máquina de Atwood, polias, blocos acoplados"] },
  { sim: montanhaRussa, covers: ["Pista de skate / montanha-russa com energia"] },
  { sim: massaMola, covers: ["Sistema massa-mola, trabalho e potência"] },
  { sim: colisoes, covers: ["Colisões 1D e 2D (elásticas, inelásticas, coeficiente de restituição)"] },
  { sim: rotacaoTorque, covers: ["Cinemática rotacional, torque e momento de inércia"] },
  { sim: rolamento, covers: ["Rolamento em plano inclinado (cilindro, esfera, anel)"] },
  { sim: momentoAngular, covers: ["Conservação do momento angular (patinadora, cadeira giratória)"] },
  { sim: orbitasKepler, covers: ["Órbitas, leis de Kepler, campo gravitacional"] },
  { sim: pendulos, covers: ["Pêndulo simples, físico e de grandes amplitudes"] },
  { sim: coulomb, covers: ["Força entre cargas, superposição"] },
  { sim: campoEletrico, covers: ["Linhas de campo e vetores de cargas arrastáveis"] },
  { sim: gauss, covers: ["Superfícies gaussianas e fluxo"] },
  { sim: potencial, covers: ["Equipotenciais, voltímetro virtual, energia potencial"] },
  { sim: capacitores, covers: ["Placas paralelas, dielétrico, associações"] },
  { sim: circuitoRc, covers: ["RC: carga e descarga"] },
  { sim: imasBussola, covers: ["Ímãs, bússola, campo da Terra"] },
  { sim: particulaCampoB, covers: ["Partícula em campo B, ciclotron, espectrômetro de massa"] },
  { sim: motorHall, covers: ["Fio com corrente, motor DC, efeito Hall"] },
  { sim: biotSavart, covers: ["Biot-Savart (fio, espira, solenoide, toroide)"] },
  { sim: ampere, covers: ["Circulação de B em caminhos amperianos"] },
  { sim: faradayLenz, covers: ["Lei de Faraday e Lenz (ímã e espira, gerador)"] },
  { sim: rlLc, covers: ["Circuitos RL e LC"] },
  { sim: rlcCa, covers: ["RLC série/paralelo, ressonância, fasores"] },
  { sim: ondaEm, covers: ["Corrente de deslocamento, onda EM"] },
  { sim: hidrostatica, covers: ["Pressão com profundidade, manômetro, prensa hidráulica"] },
  { sim: empuxo, covers: ["Empuxo e flutuação (Arquimedes)"] },
  { sim: bernoulli, covers: ["Continuidade e Bernoulli (tubo de Venturi, Torricelli)"] },
  { sim: mhs, covers: ["Massa-mola, pêndulo, círculo de referência"] },
  { sim: amortecido, covers: ["Amortecido (sub, crítico, super)"] },
  { sim: ressonancia, covers: ["Forçado e ressonância"] },
  { sim: ondaCorda, covers: ["Onda em corda (pulsos, reflexão, extremidade fixa/livre)"] },
  { sim: ondasEstacionarias, covers: ["Ondas estacionárias e harmônicos"] },
  { sim: superposicao, covers: ["Superposição, batimentos, velocidade de grupo e fase"] },
  { sim: cubaOndas, covers: ["Interferência em 2D (cuba de ondas)"] },
  { sim: somIntensidade, covers: ["Ondas sonoras, intensidade, decibéis"] },
  { sim: doppler, covers: ["Efeito Doppler e cone de Mach"] },
  { sim: calorimetria, covers: ["Calorimetria e mudança de fase"] },
  { sim: gasIdeal, covers: ["Gás ideal molecular (pressão, temperatura, volume)"] },
  { sim: processosPv, covers: ["Processos no diagrama PV (isotérmico, adiabático, isobárico, isocórico)"] },
  { sim: refracao, covers: ["Reflexão, refração, Snell, reflexão interna total, fibra ótica"] },
  { sim: espelhos, covers: ["Espelhos planos e esféricos"] },
  { sim: lentes, covers: ["Lentes delgadas e espessas, associação"] },
  { sim: prisma, covers: ["Prisma e dispersão"] },
  { sim: fendaDupla, covers: ["Fenda dupla de Young"] },
  { sim: filmesFinos, covers: ["Filmes finos, anéis de Newton, interferômetro de Michelson"] },
  { sim: difracao, covers: ["Fenda simples, rede de difração, resolução (Rayleigh)"] },
  { sim: relatividade, covers: ["Dilatação do tempo, contração, simultaneidade"] },
  { sim: corpoNegro, covers: ["Radiação de corpo negro"] },
  { sim: fotoeletrico, covers: ["Efeito fotoelétrico"] },
  { sim: modelosAtomicos, covers: ["Modelos atômicos (Thomson, Rutherford, Bohr) e espectros"] },
  { sim: deBroglie, covers: ["De Broglie, difração de elétrons, fenda dupla de elétrons um a um"] },
  { sim: pocoQuantico, covers: ["Poço infinito e finito, oscilador harmônico"] },
  { sim: tunelamento, covers: ["Tunelamento e barreira"] },
  { sim: decaimento, covers: ["Decaimento radioativo, meia-vida, datação"] },
  { sim: instrumentosMedida, covers: [] },
  { sim: quedaLivre, covers: [] },
  { sim: trilhoDeAr, covers: [] },
  { sim: leiHooke, covers: [] },
  { sim: rodaMaxwell, covers: [] },
  { sim: viscosidadeStokes, covers: [] },
  { sim: tensaoSuperficial, covers: [] },
  { sim: tuboKundt, covers: [] },
  { sim: dilatacaoTermica, covers: [] },
  { sim: equivalenteMecanico, covers: [] },
  { sim: conducaoCalor, covers: [] },
  { sim: multimetroOsciloscopio, covers: [] },
  { sim: curvaIv, covers: [] },
  { sim: ponteWheatstone, covers: [] },
  { sim: transformador, covers: [] },
  { sim: polarizacao, covers: [] },
  { sim: espectroscopia, covers: [] },
];

export const simulations = catalog.map((c) => c.sim);

export function findSim(id: string): AnySimulation | undefined {
  return simulations.find((s) => s.id === id);
}

/** Item do plano ainda sem simulação publicada. */
export function pending(): PlannedSim[] {
  const done = new Set([...catalog.flatMap((c) => c.covers), ...practices.map((p) => p.title)]);
  return plan.filter((p) => !done.has(p.title));
}

/** Confere, em desenvolvimento, se os títulos de `covers` existem no plano. */
export function unknownCovers(): string[] {
  const titles = new Set(plan.map((p) => p.title));
  return [...catalog.flatMap((c) => c.covers), ...practices.map((p) => p.title)].filter((t) => !titles.has(t));
}
