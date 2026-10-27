import { describe, expect, it } from "vitest";
import katex from "katex";
import { elementos, familias, posicao } from "../src/livro/apendices/elementos.ts";
import { constantes, findConstante, notacao, valoresUteis } from "../src/livro/apendices/constantes.ts";
import { planetas } from "../src/livro/apendices/astronomicos.ts";
import { converter, formatarNumero, grandezas } from "../src/livro/apendices/conversao.ts";
import { formulas } from "../src/livro/apendices/formulas.ts";
import { prefixos, unidadesBase, unidadesDerivadas } from "../src/livro/apendices/si.ts";
import { apendices, findApendice } from "../src/livro/apendices/index.ts";
import { mathFragments, unbalancedMathLines } from "../../../packages/ui-kit/src/markdown.ts";

const rel = (a: number, b: number) => Math.abs(a - b) / Math.abs(b);

describe("apêndice F: elementos", () => {
  it("118 elementos, Z de 1 a 118 em ordem, símbolos únicos", () => {
    expect(elementos).toHaveLength(118);
    expect(elementos.map((e) => e.z)).toEqual(Array.from({ length: 118 }, (_, i) => i + 1));
    expect(new Set(elementos.map((e) => e.simbolo)).size).toBe(118);
    expect(new Set(elementos.map((e) => e.nome)).size).toBe(118);
  });

  it("massas crescentes, salvo as inversões conhecidas", () => {
    const inversions: string[] = [];
    for (let i = 1; i < elementos.length; i++) {
      const a = elementos[i - 1]!;
      const b = elementos[i]!;
      if (b.massa <= a.massa) inversions.push(`${a.simbolo}-${b.simbolo}`);
    }
    // Ar/K, Co/Ni, Te/I, Th/Pa e U/Np são as inversões clássicas; Pu/Am, Cm/Bk, Bh/Hs... vêm de
    // números de massa de isótopos (os mais estáveis conhecidos), não de pesos atômicos.
    expect(inversions).toEqual(["Ar-K", "Co-Ni", "Te-I", "Th-Pa", "U-Np", "Pu-Am", "Cm-Bk", "Bh-Hs", "Fl-Mc", "Ts-Og"]);
  });

  it("valores de referência", () => {
    const by = (s: string) => elementos.find((e) => e.simbolo === s)!;
    expect(by("H").massa).toBe(1.008);
    expect(by("C").massa).toBe(12.011);
    expect(by("O").massa).toBe(15.999);
    expect(by("Fe").massa).toBeCloseTo(55.845, 3);
    expect(by("Au").massa).toBeCloseTo(196.966569, 5);
    expect(by("U").massa).toBeCloseTo(238.02891, 4);
    expect(by("Fe").densidade).toBeCloseTo(7.87, 2);
    expect(by("Os").densidade).toBeGreaterThan(22);
    expect(by("Hg").fusao).toBeCloseTo(234.32, 1);
    expect(by("W").fusao).toBeCloseTo(3687, 0);
    expect(by("N").ebulicao).toBeCloseTo(77.36, 1);
    expect(by("Tc").isotopo).toBe(true);
    expect(by("Og").nome).toBe("Oganessônio");
  });

  it("fusão abaixo da ebulição e densidades positivas", () => {
    for (const e of elementos) {
      if (e.fusao !== null && e.ebulicao !== null) expect(e.fusao, e.simbolo).toBeLessThan(e.ebulicao);
      if (e.densidade !== null) expect(e.densidade, e.simbolo).toBeGreaterThan(0);
      if (e.gas) expect(e.densidade!, e.simbolo).toBeLessThan(0.02);
    }
    // gases a 0 °C e 1 atm: ρ ≈ pM/RT, dentro de 2% (o cloro, mais real, desvia 1,6%)
    for (const e of elementos.filter((x) => x.gas)) {
      const M = e.massa * (["H", "N", "O", "F", "Cl"].includes(e.simbolo) ? 2 : 1);
      const ideal = (101325 * M) / (8.314462618 * 273.15) / 1e6; // g/cm³
      expect(rel(e.densidade!, ideal), e.simbolo).toBeLessThan(0.02);
    }
  });

  it("tabela periódica: posições únicas, famílias válidas, 7 períodos", () => {
    const seen = new Set<string>();
    for (const e of elementos) {
      const p = posicao(e);
      const k = `${p.linha},${p.coluna}`;
      expect(seen.has(k), `${e.simbolo} em ${k}`).toBe(false);
      seen.add(k);
      expect(p.coluna).toBeGreaterThanOrEqual(1);
      expect(p.coluna).toBeLessThanOrEqual(18);
      expect(familias.some((f) => f.id === e.familia)).toBe(true);
    }
    // os lugares do bloco f na linha principal ficam livres para os marcadores 57–71 e 89–103
    expect(seen.has("6,3")).toBe(false);
    expect(seen.has("7,3")).toBe(false);
    expect(elementos.filter((e) => e.periodo === 1)).toHaveLength(2);
    expect(elementos.filter((e) => e.periodo === 6)).toHaveLength(32);
    expect(elementos.filter((e) => e.periodo === 7)).toHaveLength(32);
    expect(elementos.filter((e) => e.familia === "gas-nobre").map((e) => e.simbolo)).toEqual(["He", "Ne", "Ar", "Kr", "Xe", "Rn"]);
    expect(elementos.filter((e) => e.familia === "lantanideo")).toHaveLength(15);
    expect(elementos.filter((e) => e.familia === "actinideo")).toHaveLength(15);
  });
});

describe("apêndice B: constantes", () => {
  const v = (id: string) => findConstante(id)!.valor;
  it("as sete constantes definidoras têm os valores exatos do SI de 2019", () => {
    expect(v("c")).toBe(299792458);
    expect(v("h")).toBe(6.62607015e-34);
    expect(v("e")).toBe(1.602176634e-19);
    expect(v("k")).toBe(1.380649e-23);
    expect(v("NA")).toBe(6.02214076e23);
    expect(v("dnuCs")).toBe(9192631770);
    expect(v("Kcd")).toBe(683);
    expect(constantes.filter((c) => c.tipo === "definida")).toHaveLength(7);
  });

  it("as exatas derivadas batem com as definidoras", () => {
    expect(rel(v("R"), 8.314462618)).toBeLessThan(1e-9);
    expect(rel(v("F"), 96485.33212)).toBeLessThan(1e-9);
    expect(rel(v("hbar"), 1.054571817e-34)).toBeLessThan(1e-9);
    const sigma = (2 * Math.PI ** 5 * v("k") ** 4) / (15 * v("h") ** 3 * v("c") ** 2);
    expect(rel(v("sigma"), sigma)).toBeLessThan(1e-9);
    // Wien: b = hc / (x k), com x solução de x = 5(1 − e^{−x})
    let x = 5;
    for (let i = 0; i < 50; i++) x = 5 * (1 - Math.exp(-x));
    expect(rel(v("b"), (v("h") * v("c")) / (x * v("k")))).toBeLessThan(1e-9);
    expect(rel(v("Vm"), 22.41396954e-3)).toBeLessThan(1e-9);
  });

  it("as medidas são coerentes entre si (CODATA 2018)", () => {
    expect(rel(1 / (v("mu0") * v("c") ** 2), v("eps0"))).toBeLessThan(1e-9);
    expect(rel(1 / (4 * Math.PI * v("eps0")), v("ke"))).toBeLessThan(1e-9);
    expect(rel(v("e") / v("me"), v("em"))).toBeLessThan(1e-9);
    expect(rel(v("mp") / v("me"), v("mpme"))).toBeLessThan(1e-9);
    expect(rel((v("me") * v("c") ** 2) / v("e") / 1e6, v("mec2"))).toBeLessThan(1e-9);
    expect(rel((v("u") * v("c") ** 2) / v("e") / 1e6, v("uc2"))).toBeLessThan(1e-9);
    expect(rel(v("e") ** 2 / (4 * Math.PI * v("eps0") * v("hbar") * v("c")), v("alpha"))).toBeLessThan(1e-9);
    expect(rel((v("e") * v("hbar")) / (2 * v("me")), v("muB"))).toBeLessThan(1e-9);
    expect(rel(v("h") / (v("me") * v("c")), v("lambdaC"))).toBeLessThan(1e-9);
    expect(rel(v("hbar") / (v("me") * v("c") * v("alpha")), v("a0"))).toBeLessThan(1e-9);
    expect(v("G")).toBe(6.6743e-11);
  });

  it("notação científica com vírgula", () => {
    expect(notacao({ valor: 299792458 })).toEqual({ mantissa: "2,99792458", expoente: 8 });
    expect(notacao({ valor: 683 })).toEqual({ mantissa: "683", expoente: 0 });
    expect(notacao({ valor: 6.6743e-11, texto: "6,67430" })).toEqual({ mantissa: "6,67430", expoente: -11 });
    expect(notacao({ valor: 1.380649e-23 })).toEqual({ mantissa: "1,380649", expoente: -23 });
    for (const c of [...constantes, ...valoresUteis]) {
      const n = notacao(c);
      const mant = Number(n.mantissa.replace(/\s|…|\\,/g, "").replace(",", "."));
      expect(rel(mant * 10 ** n.expoente, c.valor), c.id).toBeLessThan(1e-6);
    }
  });
});

describe("apêndice C: dados astronômicos", () => {
  const G = 6.6743e-11;
  it("terceira lei de Kepler: T²/a³ igual para todos os planetas", () => {
    const k = planetas.map((p) => p.periodoAnos ** 2 / (p.distancia / 149.6) ** 3);
    for (const [i, x] of k.entries()) expect(Math.abs(x - 1), planetas[i]!.nome).toBeLessThan(0.02);
  });
  it("velocidade de escape e massa específica coerentes com massa e raio", () => {
    for (const p of planetas) {
      const R = (p.diametro / 2) * 1000;
      expect(rel(Math.sqrt((2 * G * p.massa) / R) / 1000, p.escape), p.nome).toBeLessThan(0.03);
      // planetas achatados: o diâmetro é o equatorial, por isso a tolerância maior
      expect(rel(p.massa / ((4 / 3) * Math.PI * R ** 3), p.densidade), p.nome).toBeLessThan(0.15);
    }
  });
});

describe("apêndice D: conversões", () => {
  it("fatores exatos", () => {
    expect(converter("comprimento", 1, "in", "cm")).toBeCloseTo(2.54, 12);
    expect(converter("comprimento", 1, "mi", "km")).toBeCloseTo(1.609344, 12);
    expect(converter("massa", 1, "lb", "kg")).toBeCloseTo(0.45359237, 12);
    expect(converter("pressao", 1, "atm", "torr")).toBeCloseTo(760, 9);
    expect(converter("pressao", 1, "psi", "Pa")).toBeCloseTo(6894.757293, 5);
    expect(converter("energia", 1, "cal", "J")).toBe(4.184);
    expect(converter("energia", 1, "kWh", "J")).toBe(3.6e6);
    expect(converter("potencia", 1, "hp", "W")).toBeCloseTo(745.6998716, 6);
    expect(converter("velocidade", 72, "kmh", "ms")).toBeCloseTo(20, 12);
    expect(converter("angulo", 180, "grau", "rad")).toBeCloseTo(Math.PI, 12);
    expect(converter("comprimento", 1, "al", "m")).toBeCloseTo(9.4607304725808e15, -3);
    expect(converter("comprimento", 1, "pc", "al")).toBeCloseTo(3.2616, 4);
    expect(converter("massa", 1, "slug", "kg")).toBeCloseTo(14.5939, 4);
  });
  it("temperatura e ida e volta", () => {
    expect(converter("temperatura", 100, "C", "F")).toBeCloseTo(212, 9);
    expect(converter("temperatura", -40, "F", "C")).toBeCloseTo(-40, 9);
    expect(converter("temperatura", 0, "C", "K")).toBeCloseTo(273.15, 9);
    for (const g of grandezas)
      for (const a of g.unidades)
        for (const b of g.unidades) expect(converter(g.id, converter(g.id, 3.7, a.id, b.id), b.id, a.id)).toBeCloseTo(3.7, 9);
    expect(converter("massa", 1, "kg", "nada")).toBeNaN();
  });
  it("formatação", () => {
    expect(formatarNumero(2.54)).toBe("2,54");
    expect(formatarNumero(1609.344)).toBe("1609,34");
    expect(formatarNumero(9.4607304725808e15)).toBe("9,46073 × 10^15");
    expect(formatarNumero(1.602176634e-19, 4)).toBe("1,602 × 10^-19");
    expect(formatarNumero(NaN)).toBe("—");
  });
});

describe("apêndices A, E e lista", () => {
  it("SI: 7 unidades de base, 22 derivadas com nome, 24 prefixos sem repetição", () => {
    expect(unidadesBase).toHaveLength(7);
    expect(unidadesDerivadas).toHaveLength(22);
    expect(prefixos).toHaveLength(24);
    expect(new Set(prefixos.map((p) => p.simbolo)).size).toBe(24);
    const exps = prefixos.map((p) => p.expoente);
    expect([...exps].sort((a, b) => b - a)).toEqual(exps);
  });
  it("todo o LaTeX das fórmulas e unidades compila no KaTeX", () => {
    const tex = [
      ...formulas.flatMap((f) => mathFragments(f.texto).map((m) => m.tex)),
      ...unidadesDerivadas.map((u) => u.equivalente),
      ...constantes.map((c) => c.simbolo),
      ...constantes.filter((c) => c.unidade).map((c) => `\\mathrm{${c.unidade}}`),
    ];
    for (const t of tex) expect(() => katex.renderToString(t, { throwOnError: true }), t).not.toThrow();
    for (const f of formulas) expect(unbalancedMathLines(f.texto), f.id).toEqual([]);
  });
  it("apêndices de A a G", () => {
    expect(apendices.map((a) => a.letra).join("")).toBe("ABCDEFG");
    expect(findApendice("G")?.id).toBe("g");
  });
});
