import { describe, expect, it } from "vitest";
import { Runner, withOverrides } from "@fisilab/core";
import {
  C,
  CADEIAS,
  DNU_CS,
  H,
  K_J,
  OBJETOS,
  R_K,
  atrasoQuartzo,
  cancelados,
  ciclosCesio,
  escalasUnidades as sim,
  kibble,
  massaCubo,
  objetoMaisProximo,
  ondasHeNe,
  ordemDeGrandeza,
  tempoLuz,
  textoUnidades,
  unidadesApos,
  unidadesConferem,
  valorApos,
} from "../src/index.ts";

const run = (o: Record<string, number>) => new Runner(sim, withOverrides(sim, o)).runToEnd(200);

describe("Medição: ordens de grandeza, unidades e padrões SI", () => {
  it("conversões em cadeia reproduzem os valores tabelados e as unidades se cancelam", () => {
    const esperado = [1 / 3.6, 1000, 6894.757293168361, 3.6e6, 9.4607304725808e15, 1e-3, Math.PI / 30];
    CADEIAS.forEach((c, i) => {
      const f = valorApos(c, 1, c.fatores.length);
      expect(f / esperado[i]!).toBeCloseTo(1, 12);
      expect(f / c.ref).toBeCloseTo(1, 12);
      expect(unidadesConferem(c)).toBe(true);
    });
    expect(valorApos(CADEIAS[0]!, 72, 3)).toBeCloseTo(20, 12);
    expect(textoUnidades(unidadesApos(CADEIAS[1]!, 2))).toBe("kg/m³");
    expect(textoUnidades(unidadesApos(CADEIAS[0]!, 1))).toBe("m/h");
  });

  it("um fator de cabeça para baixo deixa unidades sobrando", () => {
    for (const c of CADEIAS) expect(unidadesConferem(c, true)).toBe(false);
    // 100 km/h com o 1º fator invertido: km²/(h·m)
    expect(textoUnidades(unidadesApos(CADEIAS[0]!, 3, true))).toBe("km²/(m·s)");
  });

  it("riscos de cancelamento: na conversão completa de km/h só sobram m e s", () => {
    const p = withOverrides(sim, { modo: 1, grandeza: 0 });
    const r = cancelados(p, 3);
    expect([...r[0]!.num, ...r[0]!.den]).toEqual([0, 0]); // km e h da partida
    expect([...r[1]!.num]).toEqual([]); // m do primeiro fator sobrevive
    expect([...r[1]!.den]).toEqual([0]); // km
    expect([...r[3]!.num]).toEqual([0]); // min
    expect([...r[3]!.den]).toEqual([]); // s sobrevive
  });

  it("escalas: tempo de luz, massa do cubo e objeto mais próximo", () => {
    expect(tempoLuz(1)).toBeCloseTo(1 / 299_792_458, 20);
    expect(massaCubo(1)).toBe(1000);
    expect(OBJETOS[objetoMaisProximo(0)]!.nome).toBe("Pessoa");
    expect(OBJETOS[objetoMaisProximo(7)]!.nome).toBe("Terra (diâmetro)");
    expect(ordemDeGrandeza(3.0e8)).toBe(8);
    expect(ordemDeGrandeza(3.3e8)).toBe(9);
    // a luz leva da ordem da idade do Universo (4,35 × 10¹⁷ s) para cruzar 10²⁶ m
    expect(ordemDeGrandeza(tempoLuz(1e26))).toBe(ordemDeGrandeza(4.35e17));
  });

  it("zoom: o expoente cresce linearmente e para exatamente em 10²⁶ m", () => {
    const r = run({ modo: 0, e0: -15, vel: 2 });
    expect(r.finished).toBe(true);
    expect(r.state[0]).toBeCloseTo(26, 9);
    expect(r.t).toBeCloseTo(41 / 2, 9);
  });

  it("metro: o pulso chega ao fim da régua em L/c", () => {
    const r = run({ modo: 2, padrao: 0, Lalvo: 1 });
    expect(r.state[2]).toBeCloseTo(1 / C, 18);
    expect(C * r.state[2]!).toBeCloseTo(1, 9);
    expect(ondasHeNe(1)).toBeCloseTo(1_579_800.3, 0);
  });

  it("segundo e quilograma: césio, quartzo e balança de Kibble", () => {
    expect(ciclosCesio(1)).toBe(DNU_CS);
    expect(atrasoQuartzo(20, 1)).toBeCloseTo(1.728, 12);
    const k = kibble(1, 9.787, 400, 0.002);
    expect(k.U * k.I).toBeCloseTo(1 * 9.787 * 0.002, 15);
    expect(k.m).toBeCloseTo(1, 14);
    // a massa não depende de BL
    expect(kibble(0.5, 9.8, 137, 0.003).m).toBeCloseTo(0.5, 14);
    // constantes derivadas do SI
    expect(K_J / 483_597.848_4e9).toBeCloseTo(1, 9);
    expect(R_K).toBeCloseTo(25_812.807_45, 4);
    expect(H).toBe(6.62607015e-34);
    // bobina percorre o curso (20 mm) a 2 mm/s: 10 s
    const r = run({ modo: 2, padrao: 2, vK: 2 });
    expect(r.t).toBeCloseTo(10, 9);
  });
});
