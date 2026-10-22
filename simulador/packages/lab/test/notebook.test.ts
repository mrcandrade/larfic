import { describe, expect, it } from "vitest";
import { parseTable, preamble, pyName, starterCode, toIpynb } from "../src/notebook.ts";

describe("notebook", () => {
  it("nomes Python válidos e únicos", () => {
    const t = new Set<string>();
    expect(pyName("T² (s²)", t)).toBe("t2_s2");
    expect(pyName("T² (s²)", t)).toBe("t2_s2_2");
    expect(pyName("1/λ", t)).toBe("c_1");
    expect(pyName("lambda", t)).toBe("lambda_");
    expect(pyName("Δ", t)).toBe("col");
  });
  it("lê o CSV da bancada (; e vírgula decimal) e casa u(...) com a coluna", () => {
    const ds = parseTable("L (m);u(L) (m);10 T (s);u(10 T) (s)\n0,5;0,001;14,2;0,1\n1,0;0,001;20,1;0,1", "pêndulo");
    expect(ds.columns.map((c) => c.key)).toEqual(["l_m", "u_l_m", "c_10_t_s", "u_10_t_s"]);
    expect(ds.columns[2]!.values).toEqual([14.2, 20.1]);
    expect(starterCode(ds)).toContain("sigma = u_10_t_s");
  });
  it("CSV com vírgula e sem cabeçalho", () => {
    const ds = parseTable("1,2\n3,4.5");
    expect(ds.columns.map((c) => c.key)).toEqual(["c1", "c2"]);
    expect(ds.columns[1]!.values).toEqual([2, 4.5]);
  });
  it("preâmbulo e ipynb", () => {
    const ds = parseTable("x,y\n1,2\n2,");
    const pre = preamble(ds);
    expect(pre).toContain("y = np.array([2, nan])");
    const nb = JSON.parse(toIpynb(ds, ["print(x)"]));
    expect(nb.nbformat).toBe(4);
    expect(nb.cells).toHaveLength(3);
    expect(nb.cells[2].source.join("")).toBe("print(x)");
  });
});
