import { describe, expect, it } from "vitest";
import {
  DataParser,
  LineSplitter,
  SimDevice,
  describe as stats,
  fitModel,
  guessTimeColumn,
  indicesInRange,
  ntcResistance,
  parseNumber,
  parseText,
  simDevices,
  sketches,
  steinhartHart,
  tableToCsv,
  unitOf,
  type DataRow,
} from "../src/index.ts";

describe("LineSplitter", () => {
  it("junta linhas quebradas entre pedaços", () => {
    const sp = new LineSplitter();
    expect(sp.push("t_ms,d")).toEqual([]);
    expect(sp.push("ist_cm\n10,2")).toEqual(["t_ms,dist_cm"]);
    expect(sp.push("0.5\n20,21\n")).toEqual(["10,20.5", "20,21"]);
    expect(sp.flush()).toEqual([]);
  });

  it("trata \\r\\n mesmo partido entre pedaços, e \\r sozinho", () => {
    const sp = new LineSplitter();
    expect(sp.push("a\r")).toEqual(["a"]);
    expect(sp.push("\nb\r\nc")).toEqual(["b"]);
    expect(sp.push("\rd\n")).toEqual(["c", "d"]);
    expect(sp.push("e")).toEqual([]);
    expect(sp.flush()).toEqual(["e"]);
  });

  it("descarta a primeira linha parcial ao conectar", () => {
    const sp = new LineSplitter({ dropPartialFirst: true });
    expect(sp.push("3.4\n100,20.1\n")).toEqual(["100,20.1"]);
  });
});

describe("DataParser", () => {
  const feed = (lines: string[]) => {
    const p = new DataParser();
    const rows: DataRow[] = [];
    for (const l of lines) {
      const r = p.parseLine(l);
      if (r.kind === "dados") rows.push(r.row);
    }
    return { p, rows };
  };

  it("CSV com cabeçalho", () => {
    const { p, rows } = feed(["t_ms,dist_cm", "0,20.0", "50,20.5"]);
    expect(p.columns).toEqual(["t_ms", "dist_cm"]);
    expect(p.format).toBe("csv");
    expect(rows[1]).toEqual({ t_ms: 50, dist_cm: 20.5 });
  });

  it("CSV sem cabeçalho ganha nomes genéricos", () => {
    const { p, rows } = feed(["1,2,3", "4,5,6"]);
    expect(p.columns).toEqual(["c1", "c2", "c3"]);
    expect(rows[1]).toEqual({ c1: 4, c2: 5, c3: 6 });
  });

  it("TSV e ponto e vírgula com vírgula decimal", () => {
    expect(feed(["t\tV", "0,5\t1,25"]).rows[0]).toEqual({ t: 0.5, V: 1.25 });
    const r = feed(["t (s);x (m)", "0,1;2,5"]);
    expect(r.p.format).toBe("ponto-e-virgula");
    expect(r.rows[0]).toEqual({ "t (s)": 0.1, "x (m)": 2.5 });
  });

  it("separado por espaços", () => {
    const { p, rows } = feed(["tempo valor", "1.5   2e3"]);
    expect(p.columns).toEqual(["tempo", "valor"]);
    expect(rows[0]).toEqual({ tempo: 1.5, valor: 2000 });
  });

  it("chave: valor e chave=valor, com unidades depois do número", () => {
    const { p, rows } = feed(["t: 1.20 s, R: 4520 ohm, T: 63.21 C", "t=1.4 T=63.0", "Temperatura (C): 22,5"]);
    expect(p.format).toBe("chave-valor");
    expect(rows[0]).toEqual({ t: 1.2, R: 4520, T: 63.21 });
    expect(rows[1]).toEqual({ t: 1.4, T: 63 });
    expect(rows[2]).toEqual({ "Temperatura (C)": 22.5 });
    expect(p.columns).toEqual(["t", "R", "T", "Temperatura (C)"]);
  });

  it("mensagens e linhas cortadas são ignoradas", () => {
    const { p, rows } = feed(["Iniciando sensor...", "# comentário", "t_ms,v", "10,1", "0.5", "20,2", "Erro: sensor"]);
    expect(rows).toHaveLength(2);
    expect(p.ignored).toBe(4);
    expect(p.lastMessage).toBe("Erro: sensor");
  });

  it("um falso cabeçalho é descartado se os dados não batem com ele", () => {
    const { p, rows } = feed(["Ola mundo", "1,2,3"]);
    expect(rows[0]).toEqual({ c1: 1, c2: 2, c3: 3 });
    expect(p.columns).toContain("c1");
  });

  it("cabeçalho repetido (Arduino reiniciou) não duplica colunas", () => {
    const { p, rows } = feed(["t,x", "1,2", "t,x", "2,3"]);
    expect(p.columns).toEqual(["t", "x"]);
    expect(rows).toHaveLength(2);
  });

  it("parseNumber", () => {
    expect(parseNumber("1,5")).toBe(1.5);
    expect(parseNumber("1,5", false)).toBeNaN();
    expect(parseNumber("-2.5e-3")).toBe(-0.0025);
    expect(parseNumber("abc")).toBeNaN();
    expect(parseNumber("")).toBeNaN();
  });
});

describe("arquivos e colunas", () => {
  it("lê o CSV exportado pelo próprio FisiLab", () => {
    const csv = tableToCsv(["t (s)", "x (m)"], [[0, 0.5], [0.1, NaN], [0.2, 1.25]]);
    expect(csv).toBe("t (s);x (m)\n0;0,5\n0,1;\n0,2;1,25");
    const t = parseText(csv);
    expect(t.columns).toEqual(["t (s)", "x (m)"]);
    // a linha com célula vazia é ignorada (não numérica)
    expect(t.rows).toEqual([{ "t (s)": 0, "x (m)": 0.5 }, { "t (s)": 0.2, "x (m)": 1.25 }]);
  });

  it("coluna de tempo e unidades pelo nome", () => {
    expect(guessTimeColumn(["dist_cm", "t_ms"])).toEqual({ key: "t_ms", factor: 1e-3 });
    expect(guessTimeColumn(["millis", "v"])).toEqual({ key: "millis", factor: 1e-3 });
    expect(guessTimeColumn(["tempo (s)", "v"])).toEqual({ key: "tempo (s)", factor: 1 });
    expect(guessTimeColumn(["t", "R", "T"])).toEqual({ key: "t", factor: 1 });
    expect(guessTimeColumn(["a", "b"])).toBeNull();
    expect(unitOf("dist_cm")).toBe("cm");
    expect(unitOf("T (°C)")).toBe("°C");
    expect(unitOf("R_kohm")).toBe("kΩ");
    expect(unitOf("adc")).toBe("");
  });
});

describe("sketches de Arduino", () => {
  it("a saída de exemplo de cada sketch é entendida pelo parser", () => {
    for (const s of sketches) {
      const t = parseText(s.sampleOutput);
      expect(t.rows.length, s.id).toBeGreaterThanOrEqual(2);
      expect(t.columns.length, s.id).toBeGreaterThanOrEqual(2);
      expect(guessTimeColumn(t.columns), s.id).not.toBeNull();
    }
  });

  it("Steinhart–Hart: 10 kΩ ≈ 25 °C e a inversa é consistente", () => {
    expect(steinhartHart(10000) - 273.15).toBeCloseTo(24.7, 0);
    for (const T of [0, 25, 60, 90]) expect(steinhartHart(ntcResistance(T)) - 273.15).toBeCloseTo(T, 6);
  });
});

describe("dispositivos simulados", () => {
  const run = (id: (typeof simDevices)[number]["id"], ms: number) => {
    const dev = new SimDevice(id, 7);
    const sp = new LineSplitter();
    const p = new DataParser();
    const rows: DataRow[] = [];
    for (let now = 0; now <= ms; now += 37) for (const l of sp.push(dev.read(now))) {
      const r = p.parseLine(l);
      if (r.kind === "dados") rows.push(r.row);
    }
    let rest = "";
    for (let k = 0; k < 30; k++) rest += dev.read(ms);
    for (const l of [...sp.push(rest), ...sp.flush()]) {
      const r = p.parseLine(l);
      if (r.kind === "dados") rows.push(r.row);
    }
    return { p, rows };
  };

  it("ultrassônico: MRUV com aceleração ≈ 25 cm/s²", () => {
    const { p, rows } = run("ultrassonico", 4000);
    expect(p.columns).toEqual(["t_ms", "dist_cm"]);
    expect(p.ignored).toBe(1); // a linha de boas-vindas
    const sel = rows.filter((r) => r.t_ms! >= 600 && r.t_ms! <= 3800);
    const res = fitModel("quadratico", sel.map((r) => r.t_ms! / 1000), sel.map((r) => r.dist_cm!), "s", "cm")!;
    expect(res.params[3]!.value).toBeCloseTo(25, 0);
  });

  it("termistor: constante de tempo ≈ 25 s", () => {
    const { p, rows } = run("termistor", 60000);
    expect(p.columns).toEqual(["t", "R", "T"]);
    const res = fitModel("assintotico", rows.map((r) => r.t!), rows.map((r) => r.T!), "s", "°C")!;
    expect(res.params[2]!.value).toBeCloseTo(25, 0);
    expect(res.params[0]!.value).toBeCloseTo(25, 0);
    expect(res.params[1]!.value).toBeCloseTo(50, 0);
  });

  it("LDR e RC geram linhas válidas", () => {
    const ldr = run("ldr", 2000);
    expect(ldr.p.columns).toEqual(["t_ms", "adc", "R_kohm"]);
    expect(ldr.rows.length).toBeGreaterThan(90);
    expect(Math.min(...ldr.rows.map((r) => r.adc!))).toBeLessThan(400);
    const rc = run("rc", 6000);
    const charge = rc.rows.filter((r) => r.t_ms! >= 1000 && r.t_ms! < 6000);
    const res = fitModel("assintotico", charge.map((r) => r.t_ms! / 1000), charge.map((r) => r.Vc!), "s", "V")!;
    expect(res.params[2]!.value).toBeCloseTo(1, 1);
  });
});

describe("estatística e intervalo", () => {
  it("média, desvio e desvio da média", () => {
    const s = stats([1, 2, 3, 4, NaN])!;
    expect(s.n).toBe(4);
    expect(s.mean).toBe(2.5);
    expect(s.sd).toBeCloseTo(Math.sqrt(5 / 3));
    expect(s.sem).toBeCloseTo(Math.sqrt(5 / 3) / 2);
    expect(stats([])).toBeNull();
  });

  it("índices no intervalo", () => {
    expect(indicesInRange([0, 1, 2, 3], 2.5, 0.5)).toEqual([1, 2]);
  });

  it("unidades dos parâmetros", () => {
    const x = [0, 1, 2, 3, 4], y = x.map((t) => 1 + 2 * t + 0.5 * t * t);
    const q = fitModel("quadratico", x, y, "s", "m")!;
    expect(q.params.map((p) => p.unit)).toEqual(["m", "m/s", "m/s²", "m/s²"]);
    expect(q.params[3]!.value).toBeCloseTo(1);
    const l = fitModel("linear", x, x.map((t) => 3 * t), "s", "cm")!;
    expect(l.params[1]!.unit).toBe("cm/s");
    expect(fitModel("linear", [1, 2], [1, 2])).toBeNull();
    expect(fitModel("nenhum", x, y)).toBeNull();
    const e = fitModel("exponencial", x, x.map((t) => 3 * Math.exp(-0.5 * t)), "s", "V")!;
    expect(e.params[1]!.value).toBeCloseTo(-0.5, 6);
    expect(e.params[1]!.unit).toBe("1/s");
  });
});
