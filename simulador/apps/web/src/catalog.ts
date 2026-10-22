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
import { planoInclinado } from "@fisilab/sim-plano-inclinado";
import { plan, type PlannedSim } from "./plan.ts";

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
];

export const simulations = catalog.map((c) => c.sim);

export function findSim(id: string): AnySimulation | undefined {
  return simulations.find((s) => s.id === id);
}

/** Item do plano ainda sem simulação publicada. */
export function pending(): PlannedSim[] {
  const done = new Set(catalog.flatMap((c) => c.covers));
  return plan.filter((p) => !done.has(p.title));
}

/** Confere, em desenvolvimento, se os títulos de `covers` existem no plano. */
export function unknownCovers(): string[] {
  const titles = new Set(plan.map((p) => p.title));
  return catalog.flatMap((c) => c.covers).filter((t) => !titles.has(t));
}
