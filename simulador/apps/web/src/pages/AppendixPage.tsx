import { useMemo, useState, type ReactNode } from "react";
import { InlineMath, Markdown } from "@fisilab/ui-kit";
import { apendices, findApendice } from "../livro/apendices/index.ts";
import { outrasDerivadas, prefixos, unidadesBase, unidadesDerivadas } from "../livro/apendices/si.ts";
import { constantes, notacao, valoresUteis, type Constante } from "../livro/apendices/constantes.ts";
import { lua, planetas, sol, terra, type DadoSimples } from "../livro/apendices/astronomicos.ts";
import { converter, formatarNumero, grandezas } from "../livro/apendices/conversao.ts";
import { formulas } from "../livro/apendices/formulas.ts";
import { elementos, familias, posicao, type Elemento, type Familia } from "../livro/apendices/elementos.ts";
import { BOOK_HREF, appendixHref, normalize } from "../livro/livro.ts";
import "./book.css";

export function AppendixPage({ id }: { id: string }) {
  const ap = findApendice(id);
  if (!ap) {
    return (
      <div className="notfound">
        <h1>Apêndice não encontrado</h1>
        <p>
          <a href={BOOK_HREF}>Voltar ao sumário</a>
        </p>
      </div>
    );
  }
  const i = apendices.indexOf(ap);
  const prev = apendices[i - 1];
  const next = apendices[i + 1];
  return (
    <div className="appendix">
      <nav className="crumbs">
        <a href={BOOK_HREF}>Sumário</a> <span aria-hidden>›</span> Apêndices <span aria-hidden>›</span> {ap.letra}
      </nav>
      <header className="chapter-head">
        <span className="book-kind">Apêndice {ap.letra}</span>
        <h1>{ap.titulo}</h1>
        <p className="muted">{ap.resumo}</p>
      </header>
      {ap.id === "a" && <AppendixSI />}
      {ap.id === "b" && <AppendixConstants />}
      {ap.id === "c" && <AppendixAstro />}
      {ap.id === "d" && <AppendixConversion />}
      {ap.id === "e" && <AppendixFormulas />}
      {ap.id === "f" && <AppendixElements />}
      {ap.id === "g" && <PeriodicTable />}
      <nav className="chapter-pager" aria-label="Outros apêndices">
        {prev ? (
          <a href={appendixHref(prev.id)} className="chapter-pager-prev">
            <span className="muted">← Apêndice {prev.letra}</span>
            <strong>{prev.titulo}</strong>
          </a>
        ) : (
          <span />
        )}
        {next ? (
          <a href={appendixHref(next.id)} className="chapter-pager-next">
            <span className="muted">Apêndice {next.letra} →</span>
            <strong>{next.titulo}</strong>
          </a>
        ) : (
          <span />
        )}
      </nav>
    </div>
  );
}

function Table({ head, children, caption }: { head: ReactNode[]; children: ReactNode; caption?: string }) {
  return (
    <div className="book-table-wrap">
      <table className="book-table">
        {caption && <caption>{caption}</caption>}
        <thead>
          <tr>
            {head.map((h, i) => (
              <th key={i} scope="col">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}

// ------------------------------------------------------------------ A

function AppendixSI() {
  return (
    <>
      <section className="book-block">
        <h2>Unidades de base</h2>
        <p>
          Desde 2019, as sete unidades de base são definidas fixando o valor exato de constantes da natureza (veja o{" "}
          <a href={appendixHref("b")}>Apêndice B</a>). Todas as outras unidades do SI são produtos de potências destas.
        </p>
        <Table head={["Grandeza", "Unidade", "Símbolo", "Definição"]}>
          {unidadesBase.map((u) => (
            <tr key={u.simbolo}>
              <td>{u.grandeza}</td>
              <td>{u.nome}</td>
              <td className="num">{u.simbolo}</td>
              <td>{u.definicao}</td>
            </tr>
          ))}
        </Table>
      </section>
      <section className="book-block">
        <h2>Unidades derivadas com nome especial</h2>
        <Table head={["Grandeza", "Unidade", "Símbolo", "Equivalência"]}>
          {unidadesDerivadas.map((u) => (
            <tr key={u.nome}>
              <td>{u.grandeza}</td>
              <td>{u.nome}</td>
              <td className="num">{u.simbolo}</td>
              <td>
                <InlineMath tex={u.equivalente} />
              </td>
            </tr>
          ))}
        </Table>
      </section>
      <section className="book-block">
        <h2>Outras unidades derivadas</h2>
        <Table head={["Grandeza", "Unidade", "Símbolo"]}>
          {outrasDerivadas.map((u) => (
            <tr key={u.nome}>
              <td>{u.grandeza}</td>
              <td>{u.nome}</td>
              <td className="num">{u.simbolo}</td>
            </tr>
          ))}
        </Table>
      </section>
      <section className="book-block">
        <h2>Prefixos do SI</h2>
        <p className="muted">Um prefixo multiplica a unidade pela potência de dez indicada: 1 km = 10³ m, 1 µs = 10⁻⁶ s.</p>
        <div className="book-prefixes">
          {prefixos.map((p) => (
            <div key={p.nome} className="book-prefix">
              <InlineMath tex={`10^{${p.expoente}}`} />
              <strong>{p.nome}</strong>
              <span className="num">{p.simbolo}</span>
            </div>
          ))}
        </div>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ B

function constTex(c: Constante): string {
  const { mantissa, expoente } = notacao(c);
  const m = mantissa.replace(/,/g, "{,}").replace(/…/g, "\\ldots");
  const unc = c.incerteza ?? "";
  const pow = expoente ? `\\times 10^{${expoente}}` : "";
  const unit = c.unidade ? `\\ \\mathrm{${c.unidade}}` : "";
  return `${m}${unc}${pow}${unit}`;
}

const TIPO_LABEL: Record<Constante["tipo"], string> = { definida: "exata (define o SI)", exata: "exata", medida: "medida" };

function ConstTable({ list }: { list: Constante[] }) {
  return (
    <Table head={["Constante", "Símbolo", "Valor", "Status"]}>
      {list.map((c) => (
        <tr key={c.id}>
          <td>{c.nome}</td>
          <td>
            <InlineMath tex={c.simbolo} />
          </td>
          <td className="num">
            <InlineMath tex={constTex(c)} />
          </td>
          <td className={c.tipo === "medida" ? "muted" : ""}>{TIPO_LABEL[c.tipo]}</td>
        </tr>
      ))}
    </Table>
  );
}

function AppendixConstants() {
  return (
    <>
      <section className="book-block">
        <Markdown
          text={String.raw`Na revisão do SI de 2019, sete constantes passaram a ter valor **exato**, escolhido para definir as unidades. Constantes que só dependem delas (como $R = N_A k$) também são exatas; as reticências indicam que a dízima continua. As demais são **medidas**: valores recomendados do CODATA 2018, com a incerteza padrão nos últimos algarismos entre parênteses. Por exemplo, $G = 6{,}67430(15) \times 10^{-11}$ significa $G = (6{,}67430 \pm 0{,}00015) \times 10^{-11}$, nas unidades da tabela.`}
        />
      </section>
      <section className="book-block">
        <ConstTable list={constantes} />
      </section>
      <section className="book-block">
        <h2>Valores convencionais úteis</h2>
        <ConstTable list={valoresUteis} />
      </section>
    </>
  );
}

// ------------------------------------------------------------------ C

function SimpleTable({ rows }: { rows: DadoSimples[] }) {
  return (
    <Table head={["Grandeza", "Valor"]}>
      {rows.map((r) => (
        <tr key={r.grandeza}>
          <td>{r.grandeza}</td>
          <td className="num">{r.valor}</td>
        </tr>
      ))}
    </Table>
  );
}

const br = (v: number, d?: number) =>
  v.toLocaleString("pt-BR", d === undefined ? { maximumFractionDigits: 4, useGrouping: false } : { minimumFractionDigits: d, maximumFractionDigits: d, useGrouping: false });

/** 1,898 × 10²⁷ em texto com expoente sobrescrito. */
function Sci({ v, sig = 3 }: { v: number; sig?: number }) {
  const s = formatarNumero(v, sig);
  const [m, e] = s.split(" × 10^");
  return e ? (
    <>
      {m} × 10<sup>{e}</sup>
    </>
  ) : (
    <>{s}</>
  );
}

function AppendixAstro() {
  const rows: { label: string; cell(p: (typeof planetas)[number]): ReactNode }[] = [
    { label: "Distância média ao Sol (10⁶ km)", cell: (p) => br(p.distancia, 1) },
    { label: "Período orbital (anos)", cell: (p) => br(p.periodoAnos) },
    { label: "Período de rotação (dias)ᵃ", cell: (p) => br(p.rotacaoDias) },
    { label: "Velocidade orbital (km/s)", cell: (p) => br(p.velocidadeOrbital, 1) },
    { label: "Inclinação da órbita", cell: (p) => `${br(p.inclinacaoOrbita, 1)}°` },
    { label: "Excentricidade da órbita", cell: (p) => br(p.excentricidade, 3) },
    { label: "Diâmetro equatorial (km)", cell: (p) => br(p.diametro) },
    { label: "Massa (kg)", cell: (p) => <Sci v={p.massa} sig={p.massa >= 1e27 ? 4 : 3} /> },
    { label: "Massa (Terra = 1)", cell: (p) => br(p.massa / 5.97e24, p.massa / 5.97e24 < 10 ? 3 : 1) },
    { label: "Massa específica média (kg/m³)", cell: (p) => br(p.densidade) },
    { label: "Gravidade na superfície (m/s²)ᵇ", cell: (p) => br(p.gravidade, 1) },
    { label: "Velocidade de escape (km/s)", cell: (p) => br(p.escape, 1) },
    { label: "Inclinação do eixo de rotação", cell: (p) => `${br(p.inclinacaoEixo, 1)}°` },
  ];
  return (
    <>
      <section className="book-block">
        <h2>O Sol</h2>
        <SimpleTable rows={sol} />
      </section>
      <section className="book-block">
        <h2>A Terra</h2>
        <SimpleTable rows={terra} />
      </section>
      <section className="book-block">
        <h2>A Lua</h2>
        <SimpleTable rows={lua} />
      </section>
      <section className="book-block">
        <h2>Os planetas</h2>
        <Table head={["", ...planetas.map((p) => p.nome)]}>
          {rows.map((r) => (
            <tr key={r.label}>
              <th scope="row">{r.label}</th>
              {planetas.map((p) => (
                <td key={p.nome} className="num">
                  {r.cell(p)}
                </td>
              ))}
            </tr>
          ))}
        </Table>
        <p className="muted book-footnote">
          ᵃ Período sideral; o sinal negativo indica rotação retrógrada (Vênus e Urano). ᵇ Para Júpiter, Saturno, Urano e Netuno,
          no nível em que a pressão é 1 bar, incluindo o efeito da rotação.
        </p>
      </section>
    </>
  );
}

// ------------------------------------------------------------------ D

function NumberText({ v }: { v: number }) {
  return <Sci v={v} sig={7} />;
}

function Converter() {
  const [gid, setGid] = useState("comprimento");
  const g = grandezas.find((x) => x.id === gid)!;
  const [de, setDe] = useState(g.unidades[0]!.id);
  const [para, setPara] = useState(g.unidades[1]!.id);
  const [text, setText] = useState("1");
  const valor = Number(text.replace(/\s/g, "").replace(",", "."));
  const result = converter(gid, valor, de, para);
  const pick = (id: string) => {
    const ng = grandezas.find((x) => x.id === id)!;
    setGid(id);
    setDe(ng.unidades[0]!.id);
    setPara(ng.unidades[1]!.id);
  };
  return (
    <div className="panel book-converter">
      <h2>Conversor</h2>
      <div className="form-grid">
        <label>
          Grandeza
          <select value={gid} onChange={(e) => pick(e.target.value)}>
            {grandezas.map((x) => (
              <option key={x.id} value={x.id}>
                {x.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Valor
          <input value={text} inputMode="decimal" onChange={(e) => setText(e.target.value)} />
        </label>
        <label>
          De
          <select value={de} onChange={(e) => setDe(e.target.value)}>
            {g.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} ({u.simbolo})
              </option>
            ))}
          </select>
        </label>
        <label>
          Para
          <select value={para} onChange={(e) => setPara(e.target.value)}>
            {g.unidades.map((u) => (
              <option key={u.id} value={u.id}>
                {u.nome} ({u.simbolo})
              </option>
            ))}
          </select>
        </label>
      </div>
      <p className="book-converter-out" aria-live="polite">
        {Number.isFinite(valor) && text.trim() ? (
          <>
            {text.trim()} {g.unidades.find((u) => u.id === de)?.simbolo} = <strong><NumberText v={result} /></strong>{" "}
            {g.unidades.find((u) => u.id === para)?.simbolo}
          </>
        ) : (
          "Digite um número (a vírgula decimal vale)."
        )}
      </p>
    </div>
  );
}

function AppendixConversion() {
  return (
    <>
      <Converter />
      <section className="book-block">
        <p className="muted">
          Cada linha dá o valor de 1 unidade na unidade do SI. Fatores marcados com ★ são exatos por definição. Para temperatura:{" "}
          <InlineMath tex="T_C = T - 273{,}15" /> e <InlineMath tex="T_F = \tfrac{9}{5} T_C + 32" />.
        </p>
      </section>
      <div className="book-conv-grid">
        {grandezas
          .filter((g) => g.id !== "temperatura")
          .map((g) => (
            <section key={g.id} className="book-block">
              <h2>{g.nome}</h2>
              <Table head={["1 unidade", `em ${g.unidadeSI}`]}>
                {g.unidades
                  .filter((u) => u.si !== 1)
                  .map((u) => (
                    <tr key={u.id}>
                      <td>
                        1 {u.simbolo} <span className="muted">({u.nome})</span>
                      </td>
                      <td className="num">
                        <NumberText v={u.si} /> {u.exata ? "★" : ""}
                      </td>
                    </tr>
                  ))}
              </Table>
            </section>
          ))}
      </div>
    </>
  );
}

// ------------------------------------------------------------------ E

function AppendixFormulas() {
  return (
    <>
      <nav className="book-chips" aria-label="Assuntos">
        {formulas.map((f) => (
          <button key={f.id} className="book-chip" onClick={() => document.getElementById(`formulas-${f.id}`)?.scrollIntoView({ block: "start" })}>
            {f.titulo}
          </button>
        ))}
      </nav>
      {formulas.map((f) => (
        <section key={f.id} id={`formulas-${f.id}`} className="book-block book-formulas">
          <h2>{f.titulo}</h2>
          <Markdown text={f.texto} />
        </section>
      ))}
    </>
  );
}

// ------------------------------------------------------------------ F e G

const famLabel = (f: Familia) => familias.find((x) => x.id === f)?.label ?? f;

/** °C a partir de kelvins: uma casa abaixo de 100 °C em módulo, inteiro acima. */
export function celsius(k: number | null): string {
  if (k === null) return "—";
  const c = k - 273.15;
  return Math.abs(c) < 100 ? br(Math.round(c * 10) / 10, 1).replace("-", "−") : br(Math.round(c), 0).replace("-", "−");
}

export function massaTexto(e: Elemento): string {
  return e.isotopo ? `[${e.massa}]` : String(e.massa).replace(".", ",");
}

function densidadeTexto(e: Elemento): ReactNode {
  if (e.densidade === null) return "—";
  if (e.gas)
    return (
      <>
        {br(e.densidade * 1000, 4)} × 10<sup>−3</sup>
      </>
    );
  return br(e.densidade);
}

function AppendixElements() {
  const [q, setQ] = useState("");
  const list = useMemo(() => {
    const n = normalize(q);
    return n ? elementos.filter((e) => normalize(`${e.nome} ${e.simbolo}`).includes(n) || String(e.z) === n || normalize(e.simbolo) === n) : elementos;
  }, [q]);
  return (
    <>
      <section className="book-block">
        <p>
          Massa molar em g/mol; entre colchetes, o número de massa do isótopo mais estável dos elementos sem composição isotópica
          característica. Massa específica (densidade) em g/cm³ perto da temperatura ambiente; para os gases, a 0 °C e 1 atm.
          Temperaturas de fusão e ebulição a 1 atm. Um travessão indica valor não medido (só há estimativas). Veja também a{" "}
          <a href={appendixHref("g")}>tabela periódica interativa</a>.
        </p>
        <div className="filters">
          <input type="search" placeholder="Filtrar por nome, símbolo ou número atômico" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Filtrar elementos" />
        </div>
      </section>
      <Table head={["Z", "Símbolo", "Elemento", "Massa molar (g/mol)", "Densidade (g/cm³)", "Fusão (°C)", "Ebulição (°C)"]}>
        {list.map((e) => (
          <tr key={e.z} id={`elemento-${e.z}`}>
            <td className="num">{e.z}</td>
            <td className="num">
              <strong>{e.simbolo}</strong>
            </td>
            <td>
              {e.nome}
              {e.nota && <span className="muted book-note"> · {e.nota}</span>}
            </td>
            <td className="num">{massaTexto(e)}</td>
            <td className="num">{densidadeTexto(e)}</td>
            <td className="num">{celsius(e.fusao)}</td>
            <td className="num">{celsius(e.ebulicao)}</td>
          </tr>
        ))}
      </Table>
    </>
  );
}

function ElementDetails({ e }: { e: Elemento }) {
  return (
    <div className={`panel pt-details pt-${e.familia}`}>
      <div className="pt-details-head">
        <span className="pt-big">
          <small>{e.z}</small>
          {e.simbolo}
        </span>
        <div>
          <h2>{e.nome}</h2>
          <span className="muted">
            {famLabel(e.familia)} · {e.grupo ? `grupo ${e.grupo}, ` : ""}período {e.periodo}
          </span>
        </div>
      </div>
      <dl className="pt-props">
        <dt>Número atômico</dt>
        <dd>{e.z}</dd>
        <dt>Massa molar</dt>
        <dd>
          {massaTexto(e)} g/mol{e.isotopo ? " (isótopo mais estável)" : ""}
        </dd>
        <dt>Densidade</dt>
        <dd>
          {densidadeTexto(e)}
          {e.densidade !== null ? " g/cm³" : ""}
          {e.gas ? " (gás a 0 °C e 1 atm)" : ""}
        </dd>
        <dt>Fusão</dt>
        <dd>{e.fusao === null ? "—" : `${celsius(e.fusao)} °C (${br(e.fusao, 1)} K)`}</dd>
        <dt>Ebulição</dt>
        <dd>{e.ebulicao === null ? "—" : `${celsius(e.ebulicao)} °C (${br(e.ebulicao, 1)} K)`}</dd>
      </dl>
      {e.nota && <p className="muted">{e.nota}</p>}
    </div>
  );
}

function PeriodicTable() {
  const [z, setZ] = useState(26);
  const [fam, setFam] = useState<Familia | null>(null);
  const sel = elementos[z - 1]!;
  return (
    <>
      <p className="muted">Clique (ou use Tab e Enter) num elemento para ver as propriedades do Apêndice F. Clique numa família da legenda para destacá-la.</p>
      <div className="pt-wrap">
        <div className="pt-grid" role="group" aria-label="Tabela periódica">
          {elementos.map((e) => {
            const p = posicao(e);
            const dim = fam && e.familia !== fam;
            return (
              <button
                key={e.z}
                className={`pt-cell pt-${e.familia}${e.z === z ? " is-selected" : ""}${dim ? " is-dim" : ""}`}
                style={{ gridRow: p.linha + (p.linha >= 9 ? 1 : 0), gridColumn: p.coluna }}
                onClick={() => setZ(e.z)}
                aria-pressed={e.z === z}
                aria-label={`${e.nome}, número atômico ${e.z}`}
                title={`${e.z} ${e.nome}`}
              >
                <span className="pt-z">{e.z}</span>
                <span className="pt-sym">{e.simbolo}</span>
              </button>
            );
          })}
          <span className={`pt-cell pt-ph pt-lantanideo${fam && fam !== "lantanideo" ? " is-dim" : ""}`} style={{ gridRow: 6, gridColumn: 3 }} aria-hidden>
            <span className="pt-z">57–71</span>
          </span>
          <span className={`pt-cell pt-ph pt-actinideo${fam && fam !== "actinideo" ? " is-dim" : ""}`} style={{ gridRow: 7, gridColumn: 3 }} aria-hidden>
            <span className="pt-z">89–103</span>
          </span>
        </div>
      </div>
      <div className="pt-legend" role="group" aria-label="Famílias">
        {familias.map((f) => (
          <button key={f.id} className={`pt-legend-item pt-${f.id}`} aria-pressed={fam === f.id} onClick={() => setFam(fam === f.id ? null : f.id)}>
            <span className="pt-swatch" aria-hidden /> {f.label}
          </button>
        ))}
      </div>
      <ElementDetails e={sel} />
    </>
  );
}
