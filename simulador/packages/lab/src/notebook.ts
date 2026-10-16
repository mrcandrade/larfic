// Notebook Python (Pyodide no navegador): dados como colunas numéricas, código de
// preâmbulo que cria os arrays numpy e exportação para Jupyter (.ipynb).

export interface Dataset {
  name: string;
  /** Colunas na ordem original: nome Python, rótulo legível e valores. */
  columns: { key: string; label: string; values: number[] }[];
}

/** Transforma um rótulo qualquer num identificador Python válido e sem acentos. */
export function pyName(label: string, taken: Set<string> = new Set()): string {
  let s = label
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/[²]/g, "2")
    .replace(/[³]/g, "3")
    .replace(/[^A-Za-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .toLowerCase();
  if (!s) s = "col";
  if (/^[0-9]/.test(s)) s = `c_${s}`;
  if (PY_KEYWORDS.has(s)) s = `${s}_`;
  let out = s;
  for (let i = 2; taken.has(out); i++) out = `${s}_${i}`;
  taken.add(out);
  return out;
}

const PY_KEYWORDS = new Set(["and", "as", "assert", "break", "class", "continue", "def", "del", "elif", "else", "except", "false", "finally", "for", "from", "global", "if", "import", "in", "is", "lambda", "none", "nonlocal", "not", "or", "pass", "raise", "return", "true", "try", "while", "with", "yield"]);

const num = (s: string): number => {
  const t = s.trim().replace(/\s/g, "");
  if (!t) return NaN;
  // vírgula decimal (1,23) quando não há ponto
  return Number(t.includes(".") ? t.replace(/,/g, "") : t.replace(",", "."));
};

/** Lê CSV com separador ; , ou tabulação; a primeira linha não numérica vira cabeçalho. */
export function parseTable(text: string, name = "dados"): Dataset {
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter((l) => l && !l.startsWith("#"));
  if (!lines.length) return { name, columns: [] };
  const sep = lines[0]!.includes(";") ? ";" : lines[0]!.includes("\t") ? "\t" : ",";
  const split = (l: string) => l.split(sep).map((c) => c.trim().replace(/^"|"$/g, ""));
  const first = split(lines[0]!);
  const hasHeader = first.some((c) => c !== "" && Number.isNaN(num(c)));
  const labels = hasHeader ? first : first.map((_, i) => `c${i + 1}`);
  const body = (hasHeader ? lines.slice(1) : lines).map(split);
  const taken = new Set<string>();
  return {
    name,
    columns: labels.map((label, j) => ({ key: pyName(label, taken), label, values: body.map((r) => num(r[j] ?? "")) })),
  };
}

const pyNum = (v: number) => (Number.isFinite(v) ? String(v) : "nan");

/** Código Python que recria o conjunto de dados como arrays numpy e um dicionário `dados`. */
export function preamble(ds: Dataset): string {
  const lines = ["import numpy as np", `# ${ds.name}`, "nan = float('nan')"];
  for (const c of ds.columns) lines.push(`${c.key} = np.array([${c.values.map(pyNum).join(", ")}])  # ${c.label.replace(/\n/g, " ")}`);
  lines.push(`dados = {${ds.columns.map((c) => `${JSON.stringify(c.label)}: ${c.key}`).join(", ")}}`);
  return lines.join("\n");
}

/** Célula inicial sugerida: ajuste linear com incertezas, se houver colunas u(...). */
export function starterCode(ds: Dataset): string {
  const isU = (label: string) => /^u\(/.test(label);
  const base = (label: string) => label.replace(/\s*\([^()]*\)\s*$/, "").trim();
  const val = ds.columns.filter((c) => !isU(c.label));
  const x = val[0]?.key ?? "x";
  const y = val[1]?.key ?? "y";
  const uy = val[1] && ds.columns.find((c) => isU(c.label) && base(c.label) === `u(${base(val[1]!.label)})`)?.key;
  return [
    "import matplotlib.pyplot as plt",
    "",
    `x, y = ${x}, ${y}`,
    uy ? `sigma = ${uy}` : "sigma = None",
    "w = None if sigma is None else 1 / sigma**2",
    "(a, b), cov = np.polyfit(x, y, 1, w=None if w is None else np.sqrt(w), cov='unscaled' if w is not None else True)",
    "print(f'inclinação = {a:.4g} ± {np.sqrt(cov[0, 0]):.2g}')",
    "print(f'intercepto = {b:.4g} ± {np.sqrt(cov[1, 1]):.2g}')",
    "",
    "plt.errorbar(x, y, yerr=sigma, fmt='o', capsize=3, label='medidas')",
    "xs = np.linspace(min(x), max(x), 100)",
    "plt.plot(xs, a * xs + b, label='ajuste')",
    `plt.xlabel(${JSON.stringify(val[0]?.label ?? "x")}); plt.ylabel(${JSON.stringify(val[1]?.label ?? "y")})`,
    "plt.legend(); plt.show()",
  ].join("\n");
}

/** Notebook Jupyter (nbformat 4) com o preâmbulo de dados e as células do aluno. */
export function toIpynb(ds: Dataset, cells: string[]): string {
  const code = (src: string) => ({ cell_type: "code", execution_count: null, metadata: {}, outputs: [], source: src.split("\n").map((l, i, a) => (i < a.length - 1 ? `${l}\n` : l)) });
  const nb = {
    nbformat: 4,
    nbformat_minor: 5,
    metadata: { kernelspec: { name: "python3", display_name: "Python 3", language: "python" }, language_info: { name: "python" } },
    cells: [
      { cell_type: "markdown", metadata: {}, source: [`# ${ds.name}\n`, "\n", "Dados exportados do FisiLab."] },
      code(preamble(ds)),
      ...cells.map(code),
    ],
  };
  return JSON.stringify(nb, null, 1);
}

/** Código que captura a figura atual do matplotlib como PNG em base64 (a página mostra a imagem). */
export const CAPTURE_FIGURES = `
import io, base64
import matplotlib
matplotlib.use("Agg")
import matplotlib.pyplot as plt
_fisilab_figs = []
def _fisilab_show(*args, **kwargs):
    for n in plt.get_fignums():
        buf = io.BytesIO()
        plt.figure(n).savefig(buf, format="png", dpi=110, bbox_inches="tight")
        _fisilab_figs.append(base64.b64encode(buf.getvalue()).decode())
    plt.close("all")
plt.show = _fisilab_show
`;
