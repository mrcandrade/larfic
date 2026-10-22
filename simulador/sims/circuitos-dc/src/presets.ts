import { makeComp, type CircuitState, type Comp, type Kind, type Pt } from "./model.ts";

type Spec = [Kind, Pt, Pt, number?, boolean?];

function build(specs: Spec[]): CircuitState {
  const comps: Comp[] = specs.map(([kind, a, b, value, closed], i) => makeComp(i + 1, kind, a, b, value, closed));
  return { comps, tool: "selecionar", selected: null, drag: null, nextId: comps.length + 1, warning: "" };
}

/** Montagens prontas, escolhidas pelo parâmetro "montagem". */
export const PRESETS: { label: string; build(): CircuitState }[] = [
  {
    label: "Bancada vazia",
    build: () => build([["bateria", [2, 5], [2, 3]]]),
  },
  {
    label: "Resistores em série",
    build: () =>
      build([
        ["bateria", [2, 5], [2, 2], 12],
        ["fio", [2, 5], [2, 6]],
        ["resistor", [2, 6], [5, 6], 100],
        ["resistor", [5, 6], [8, 6], 220],
        ["fio", [8, 6], [10, 6]],
        ["resistor", [10, 6], [10, 2], 330],
        ["amperimetro", [10, 2], [6, 2]],
        ["fio", [6, 2], [2, 2]],
        ["voltimetro", [5, 7], [8, 7]],
        ["fio", [5, 6], [5, 7]],
        ["fio", [8, 6], [8, 7]],
      ]),
  },
  {
    label: "Resistores em paralelo",
    build: () =>
      build([
        ["bateria", [2, 5], [2, 2], 9],
        ["fio", [2, 5], [2, 6]],
        ["amperimetro", [2, 6], [5, 6]],
        ["fio", [5, 6], [8, 6]],
        ["fio", [8, 6], [11, 6]],
        ["resistor", [5, 6], [5, 2], 100],
        ["resistor", [8, 6], [8, 2], 220],
        ["resistor", [11, 6], [11, 2], 470],
        ["fio", [11, 2], [8, 2]],
        ["fio", [8, 2], [5, 2]],
        ["fio", [5, 2], [2, 2]],
      ]),
  },
  {
    label: "Lâmpadas: série × paralelo",
    build: () =>
      build([
        ["bateria", [1, 5], [1, 2], 12],
        ["fio", [1, 5], [1, 6]],
        ["lampada", [1, 6], [4, 6]],
        ["lampada", [4, 6], [7, 6]],
        ["fio", [7, 6], [7, 2]],
        ["fio", [7, 2], [1, 2]],
        ["bateria", [8, 5], [8, 2], 12],
        ["fio", [8, 5], [8, 6]],
        ["fio", [8, 6], [10, 6]],
        ["lampada", [10, 6], [10, 2]],
        ["fio", [10, 6], [12, 6]],
        ["lampada", [12, 6], [12, 2]],
        ["fio", [12, 2], [10, 2]],
        ["fio", [10, 2], [8, 2]],
      ]),
  },
  {
    label: "Ponte de Wheatstone",
    build: () =>
      build([
        ["bateria", [1, 5], [1, 2], 10],
        ["fio", [1, 5], [1, 7]],
        ["fio", [1, 7], [6, 7]],
        ["resistor", [6, 7], [3, 4], 100],
        ["resistor", [6, 7], [9, 4], 150],
        ["resistor", [3, 4], [6, 1], 200],
        ["resistor", [9, 4], [6, 1], 330],
        ["amperimetro", [3, 4], [9, 4]],
        ["fio", [6, 1], [1, 1]],
        ["fio", [1, 1], [1, 2]],
      ]),
  },
  {
    label: "Kirchhoff: duas fontes",
    build: () =>
      build([
        ["bateria", [2, 5], [2, 2], 12],
        ["fio", [2, 5], [2, 6]],
        ["resistor", [2, 6], [6, 6], 100],
        ["amperimetro", [6, 6], [6, 4]],
        ["resistor", [6, 4], [6, 2], 220],
        ["resistor", [6, 6], [10, 6], 150],
        ["fio", [10, 6], [10, 5]],
        ["bateria", [10, 5], [10, 2], 6],
        ["fio", [10, 2], [6, 2]],
        ["fio", [6, 2], [2, 2]],
      ]),
  },
  {
    label: "Circuito RC com chave",
    build: () =>
      build([
        ["bateria", [2, 5], [2, 2], 9],
        ["fio", [2, 5], [2, 6]],
        ["chave", [2, 6], [5, 6], 0, false],
        ["resistor", [5, 6], [8, 6], 1000],
        ["fio", [8, 6], [10, 6]],
        ["capacitor", [10, 6], [10, 2], 1e-3],
        ["fio", [10, 2], [2, 2]],
        ["voltimetro", [11, 6], [11, 2]],
        ["fio", [10, 6], [11, 6]],
        ["fio", [10, 2], [11, 2]],
      ]),
  },
  {
    label: "Diodo e LED",
    build: () =>
      build([
        ["bateria", [2, 5], [2, 2], 6],
        ["fio", [2, 5], [2, 6]],
        ["resistor", [2, 6], [6, 6], 330],
        ["diodo", [6, 6], [10, 6]],
        ["fio", [10, 6], [10, 2]],
        ["amperimetro", [10, 2], [6, 2]],
        ["fio", [6, 2], [2, 2]],
      ]),
  },
];
