import { defineSim, draw, formatBR, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import {
  DTR,
  P_CRIT,
  P_TRIPLE,
  R_MIN,
  SUB,
  SUBSTANCES,
  T_CRIT,
  T_TRIPLE,
  initMD,
  kinetic,
  ljF,
  ljU,
  localPhases,
  meanPressure,
  meltingT,
  phaseName,
  potential,
  stepMD,
  stepPair,
  subOf,
  sublimationPressure,
  temperature,
  units,
  vaporPressure,
  type MD,
} from "./md.ts";

export * from "./md.ts";

const fmt = (v: number, d = 3) => formatBR(v, d);
const ZJ = 1e-21;
/** Tempo reduzido por passo no modo de dois átomos. */
const DT_PAIR = 0.01;

const modo = (p: Params) => Math.round(num(p, "modo"));
const sub = (p: Params) => subOf(num(p, "sub", 1));
const gOf = (p: Params) => num(p, "g", 0.03);
const Lof = (p: Params) => num(p, "L", 14);
/** Temperatura em kelvin a partir da reduzida. */
const TK = (p: Params, Tr: number) => Tr * sub(p).epsK;

// Palco: caixa à esquerda, painéis à direita.
const BOX = { x0: 0.5, y0: 0.6, size: 8.2 };
const PD = { x0: 10.3, x1: 15.6, y0: 5.0, y1: 8.6 };
// Modo de dois átomos: r em σ → x do palco
const PR = { r0: 0, r1: 5.6, x0: 1.4, x1: 15.4 };
const rx = (r: number) => PR.x0 + ((r - PR.r0) / (PR.r1 - PR.r0)) * (PR.x1 - PR.x0);
const xr = (x: number) => PR.r0 + ((x - PR.x0) / (PR.x1 - PR.x0)) * (PR.r1 - PR.r0);
const UPLOT = { y0: 0.7, y1: 5.6, u0: -1.3, u1: 1.6 };
const uy = (u: number) => UPLOT.y0 + ((Math.max(UPLOT.u0, Math.min(UPLOT.u1, u)) - UPLOT.u0) / (UPLOT.u1 - UPLOT.u0)) * (UPLOT.y1 - UPLOT.y0);
const ATOM_Y = 7.4;

function pairEnergy(s: MD) {
  return 0.5 * s.v2 * s.v2 + ljU(s.r2);
}

function phaseColors(theme: Theme) {
  return [theme.series[0]!, theme.series[2]!, theme.series[1]!];
}

function renderBulk(d: Draw, s: MD, p: Params, theme: Theme) {
  const L = s.L || Lof(p);
  const k = BOX.size / L;
  const X = (x: number) => BOX.x0 + x * k, Y = (y: number) => BOX.y0 + y * k;
  const sb = sub(p);
  const T = temperature(s);
  const heat = Math.max(-1, Math.min(1, (s.Tset - T) / Math.max(0.05, T)));
  // Banho térmico (placa embaixo)
  const thermo = Math.round(num(p, "termo")) === 0;
  d.rect(BOX.x0, BOX.y0 - 0.45, BOX.size, 0.35, {
    fill: !thermo ? theme.grid : heat > 0.05 ? "rgba(217,69,59,0.75)" : heat < -0.05 ? "rgba(47,111,217,0.75)" : theme.muted,
  });
  d.text(thermo ? `banho térmico a ${fmt(TK(p, s.Tset))} K` : "isolado (energia constante)", BOX.x0 + BOX.size / 2, BOX.y0 - 0.28, { size: 10, color: "#ffffff", weight: "600" });
  d.rect(BOX.x0, BOX.y0, BOX.size, BOX.size, { stroke: theme.text, width: 2.5 });
  const { phase } = localPhases(s);
  const cols = phaseColors(theme);
  const water = Math.round(num(p, "sub", 1)) === 3;
  const o2 = Math.round(num(p, "sub", 1)) === 2;
  for (let i = 0; i < s.x.length; i++) {
    const cx = X(s.x[i]!), cy = Y(s.y[i]!);
    const rr = 0.5 * k * 0.92;
    if (o2) {
      const a = i * 1.7 + s.tr * 0.8 * (phase[i] === 0 ? 0.1 : 1);
      const dx = Math.cos(a) * rr * 0.4, dy = Math.sin(a) * rr * 0.4;
      d.circle(cx - dx, cy - dy, rr * 0.65, { fill: cols[phase[i]!], alpha: 0.9 });
      d.circle(cx + dx, cy + dy, rr * 0.65, { fill: cols[phase[i]!], alpha: 0.9 });
    } else {
      d.circle(cx, cy, rr, { fill: cols[phase[i]!], alpha: 0.88 });
      if (water) {
        const a = i * 2.3;
        for (const da of [-0.9, 0.9]) d.circle(cx + Math.cos(a + da) * rr * 0.8, cy + Math.sin(a + da) * rr * 0.8, rr * 0.35, { fill: theme.text, alpha: 0.6 });
      }
    }
  }
  d.text(`${sb.name} · ${s.x.length} partículas · caixa ${fmt(L * sb.sigma * 1e9)} nm`, BOX.x0, BOX.y0 + BOX.size + 0.3, { size: 10, align: "left", color: theme.muted });
  // Legenda de cores
  ["sólido", "líquido", "gás"].forEach((lab, j) => {
    d.dot(BOX.x0 + 0.2 + j * 1.6, -0.45, 5, cols[j]!);
    d.text(lab, BOX.x0 + 0.38 + j * 1.6, -0.45, { size: 10, align: "left", color: theme.muted });
  });
  d.text("cor = vizinhança local de cada átomo", BOX.x0 + 4.9, -0.45, { size: 10, align: "left", color: theme.muted });

  // Diagrama de fases do modelo (T em K, P reduzida em escala log)
  const sbK = sb.epsK;
  const t0 = 0.25, t1 = 0.75;
  const lp0 = -4, lp1 = 0.3;
  const PX = (Tr: number) => PD.x0 + ((Tr - t0) / (t1 - t0)) * (PD.x1 - PD.x0);
  const PY = (Pr: number) => PD.y0 + ((Math.log10(Math.max(Pr, 1e-6)) - lp0) / (lp1 - lp0)) * (PD.y1 - PD.y0);
  const inside = (x: number, y: number) => x >= PD.x0 && x <= PD.x1 && y >= PD.y0 && y <= PD.y1;
  d.rect(PD.x0, PD.y0, PD.x1 - PD.x0, PD.y1 - PD.y0, { stroke: theme.muted, width: 1 });
  const line = (f: (u: number) => [number, number], a: number, b: number, color: string) => {
    const pts: [number, number][] = [];
    for (let i = 0; i <= 60; i++) {
      const [x, y] = f(a + ((b - a) * i) / 60);
      if (inside(x, y)) pts.push([x, y]);
    }
    d.polyline(pts, { color, width: 2 });
  };
  line((Tr) => [PX(Tr), PY(sublimationPressure(Tr))], t0, T_TRIPLE, theme.text);
  line((Tr) => [PX(Tr), PY(vaporPressure(Tr))], T_TRIPLE, T_CRIT, theme.text);
  line((lp) => [PX(meltingT(10 ** lp)), PY(10 ** lp)], Math.log10(P_TRIPLE), lp1, theme.text);
  d.dot(PX(T_TRIPLE), PY(P_TRIPLE), 3.5, theme.text);
  d.dot(PX(T_CRIT), PY(P_CRIT), 3.5, theme.text);
  d.text("sólido", PX(0.33), PY(0.3), { size: 10, color: cols[0] });
  d.text("líquido", PX(0.5), PY(0.6), { size: 10, color: cols[1] });
  d.text("gás", PX(0.62), PY(3e-3), { size: 10, color: cols[2] });
  d.text("PT", PX(T_TRIPLE), PY(P_TRIPLE), { size: 9, dx: 12, dy: 8, color: theme.muted });
  d.text("PC", PX(T_CRIT), PY(P_CRIT), { size: 9, dx: 10, dy: 8, color: theme.muted });
  for (const Tr of [0.3, 0.45, 0.6, 0.75]) d.text(fmt(Tr * sbK, 3), PX(Tr), PD.y0 - 0.22, { size: 9, color: theme.muted });
  d.text("T (K)", PD.x1, PD.y0 - 0.5, { size: 10, align: "right", color: theme.muted });
  d.text("P (escala log, modelo 2D)", PD.x0, PD.y1 + 0.25, { size: 10, align: "left", color: theme.muted });
  const Pm = Math.max(1e-6, s.P);
  const mx = Math.max(PD.x0, Math.min(PD.x1, PX(T))), my = Math.max(PD.y0, Math.min(PD.y1, PY(Pm)));
  d.dot(mx, my, 6, theme.positive);
  d.text("agora", mx, my, { size: 9, dy: -10, color: theme.positive });

  // Leituras
  const u = units(sb);
  const ph = phaseName(phase);
  const N = s.x.length;
  const lines = [
    `Fase: ${ph}`,
    `T = ${fmt(TK(p, T))} K   (alvo ${fmt(TK(p, s.Tset))} K)`,
    `P medida = ${fmt(s.P * u.press2d * 1e3)} mN/m`,
    `E/átomo = ${fmt(((kinetic(s) + potential(s, gOf(p))) / N) * u.eps / ZJ)} zJ`,
    `Real: ponto triplo ${fmt(sb.Ttp)} K, ebulição ${fmt(sb.Teb)} K`,
  ];
  lines.forEach((t, j) => d.text(t, 10.3, 3.9 - j * 0.55, { size: j === 0 ? 13 : 11, weight: j === 0 ? "700" : "400", align: "left", color: j === 4 ? theme.muted : theme.text }));
}

function renderPair(d: Draw, s: MD, p: Params, theme: Theme) {
  const sb = sub(p);
  const u = units(sb);
  const r = s.r2;
  const E = pairEnergy(s);
  // Átomos
  const rad = (0.4 / (PR.r1 - PR.r0)) * (PR.x1 - PR.x0);
  const xa = rx(0), xB = rx(r);
  d.circle(xa, ATOM_Y, rad, { fill: theme.series[0]!, stroke: theme.text, width: 1 });
  d.circle(xB, ATOM_Y, rad, { fill: theme.series[1]!, stroke: theme.text, width: 1, alpha: s.drag ? 0.75 : 1 });
  d.text("A (fixo)", xa, ATOM_Y + rad + 0.3, { size: 10, color: theme.muted });
  d.text("B: arraste", xB, ATOM_Y + rad + 0.3, { size: 10, color: theme.series[1] });
  const F = ljF(r);
  d.arrowPx(xB, ATOM_Y, Math.sign(F), 0, Math.min(150, 20 * Math.abs(F) + (Math.abs(F) > 1e-3 ? 8 : 0)), { color: F > 0 ? theme.positive : theme.negative });
  d.text(F > 0 ? "repulsão" : "atração", xB + Math.sign(F) * 1.2, ATOM_Y - 0.55, { size: 10, color: F > 0 ? theme.positive : theme.negative });
  // Curva U(r)
  d.line(PR.x0, uy(0), PR.x1, uy(0), { color: theme.muted, width: 1 });
  d.line(rx(0.5), UPLOT.y0, rx(0.5), UPLOT.y1, { color: theme.muted, width: 1 });
  d.plot((x) => uy(ljU(xr(x))), rx(0.88), PR.x1, { color: theme.accent, width: 2.5 });
  // Energia total (linha horizontal) e regiões permitidas
  d.line(PR.x0, uy(E), PR.x1, uy(E), { color: theme.series[1], dash: [6, 4], width: 1.5 });
  d.text(`E = ${fmt(E * u.eps / ZJ)} zJ`, PR.x1, uy(E), { size: 10, align: "right", dy: -9, color: theme.series[1] });
  d.dot(rx(r), uy(ljU(r)), 6, theme.series[1]!);
  d.line(rx(r), uy(ljU(r)), rx(r), ATOM_Y - rad, { color: theme.grid, dash: [3, 3] });
  // Marcas: r0 e profundidade do poço
  d.line(rx(R_MIN), uy(0), rx(R_MIN), uy(-1), { color: theme.muted, dash: [3, 3], width: 1 });
  d.arrow(rx(R_MIN) + 0.15, uy(0), 0, uy(-1) - uy(0), { color: theme.muted, width: 1.2, head: 7 });
  d.text(`ε = ${fmt(u.eps / ZJ)} zJ (energia de ligação)`, rx(R_MIN) + 0.35, uy(-0.55), { size: 10, align: "left", color: theme.muted });
  d.text(`r₀ = 2^(1/6)σ = ${fmt(R_MIN * sb.sigma * 1e12)} pm`, rx(R_MIN), uy(-1) - 0.35, { size: 10, color: theme.muted });
  d.text(`σ = ${fmt(sb.sigma * 1e12)} pm`, rx(1), uy(0), { size: 10, dy: 12, align: "right", dx: -4, color: theme.muted });
  for (let k = 1; k <= 5; k++) d.text(`${fmt(k * sb.sigma * 1e12, 3)}`, rx(k), UPLOT.y0 - 0.25, { size: 9, color: theme.muted });
  d.text("r (pm)", PR.x1, UPLOT.y0 - 0.55, { size: 10, align: "right", color: theme.muted });
  d.text("U(r)", rx(0.5) + 0.1, UPLOT.y1, { size: 10, align: "left", color: theme.accent });
  d.text(
    `r = ${fmt(r * sb.sigma * 1e12)} pm   ·   F = ${fmt(F * u.force * 1e12)} pN   ·   U = ${fmt(ljU(r) * u.eps / ZJ)} zJ   ·   ${E < 0 ? "ligados (E < 0)" : "livres (E ≥ 0)"}`,
    PR.x0,
    -0.35,
    { size: 11, align: "left", weight: "600" },
  );
}

export const estadosMateria = defineSim<MD>({
  id: "estados-materia",
  title: "Estados da matéria e interações atômicas",
  course: "FG II",
  topic: "Termodinâmica",
  priority: "P2",
  summary:
    "Dinâmica molecular 2D com potencial de Lennard-Jones: aqueça e resfrie neônio, argônio, oxigênio ou água e veja sólido, líquido e gás, a pressão medida nas paredes e o ponto no diagrama de fases. No modo de dois átomos, arraste um deles sobre a curva U(r).",
  equations: [
    String.raw`U(r) = 4\varepsilon\left[\left(\frac{\sigma}{r}\right)^{12} - \left(\frac{\sigma}{r}\right)^{6}\right] \qquad F(r) = -\frac{dU}{dr}`,
    String.raw`r_0 = 2^{1/6}\sigma \qquad U(r_0) = -\varepsilon`,
    String.raw`k_B T = \frac{1}{N-1}\sum \tfrac12 m v^2 \ \text{(2D)} \qquad P = \frac{1}{\ell\,\Delta t}\sum 2 m |v_\perp|`,
    String.raw`\mathbf{r}(t+\Delta t) = \mathbf{r} + \mathbf{v}\Delta t + \tfrac12 \mathbf{a}\Delta t^2 \ \text{(Verlet)}`,
  ],
  liveEquations(s, p) {
    const sb = sub(p);
    const u = units(sb);
    if (modo(p) === 1) {
      return [
        String.raw`U(${texNum(s.r2 * sb.sigma * 1e12)}\ \text{pm}) = ${texNum((ljU(s.r2) * u.eps) / ZJ)}\ \text{zJ} \qquad F = ${texNum(ljF(s.r2) * u.force * 1e12)}\ \text{pN}`,
        String.raw`E = K + U = ${texNum((pairEnergy(s) * u.eps) / ZJ)}\ \text{zJ} \quad (\varepsilon = ${texNum(u.eps / ZJ)}\ \text{zJ})`,
      ];
    }
    const T = temperature(s);
    return [
      String.raw`T = \frac{E_c}{(N-1)k_B} = ${texNum(T * sb.epsK)}\ \text{K} \qquad P = ${texNum(s.P * u.press2d * 1e3)}\ \text{mN/m}`,
      String.raw`\varepsilon/k_B = ${texNum(sb.epsK)}\ \text{K} \qquad \sigma = ${texNum(sb.sigma * 1e12)}\ \text{pm} \qquad \tau = ${texNum(u.tau * 1e12)}\ \text{ps}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Modo",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Estados da matéria (muitos átomos)" },
        { value: 1, label: "Interação entre dois átomos" },
      ],
    },
    { key: "sub", label: "Substância", unit: "", min: 0, max: 3, step: 1, default: 1, options: SUBSTANCES.map((s, i) => ({ value: i, label: s.name })) },
    { key: "T0", label: "Temperatura inicial", unit: "K", min: 5, max: 800, step: 1, default: 50 },
    { key: "N", label: "Número de partículas", unit: "", min: 16, max: 100, step: 1, default: 64 },
    { key: "L", label: "Lado da caixa (em σ)", unit: "", min: 9, max: 30, step: 0.5, default: 14, live: true },
    {
      key: "termo",
      label: "Contato térmico",
      unit: "",
      min: 0,
      max: 1,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Banho térmico (termostato de Berendsen)" },
        { value: 1, label: "Isolado (energia constante)" },
      ],
    },
    {
      key: "g",
      label: "Gravidade (para assentar)",
      unit: "",
      min: 0,
      max: 0.1,
      step: 0.01,
      default: 0.03,
      live: true,
      options: [
        { value: 0, label: "Sem gravidade" },
        { value: 0.03, label: "Fraca" },
        { value: 0.1, label: "Forte" },
      ],
    },
    { key: "r0", label: "Separação inicial (dois átomos)", unit: "σ", min: 0.9, max: 4, step: 0.05, default: 1.6 },
    { key: "amort", label: "Perda de energia (dois átomos)", unit: "", min: 0, max: 1, step: 0.05, default: 0, live: true },
  ],

  observables: [
    { key: "T", label: "Temperatura", unit: "K", value: (s, p) => TK(p, temperature(s)) },
    { key: "P", label: "Pressão medida (2D)", unit: "mN/m", value: (s, p) => s.P * units(sub(p)).press2d * 1e3 },
    { key: "Pm", label: "Pressão média desde o início (2D)", unit: "mN/m", value: (s, p) => meanPressure(s) * units(sub(p)).press2d * 1e3 },
    { key: "E", label: "Energia total", unit: "zJ", value: (s, p) => ((modo(p) === 1 ? pairEnergy(s) : kinetic(s) + potential(s, gOf(p))) * units(sub(p)).eps) / ZJ },
    { key: "Ep", label: "Energia potencial por átomo", unit: "zJ", value: (s, p) => ((potential(s, 0) / Math.max(1, s.x.length)) * units(sub(p)).eps) / ZJ },
    { key: "psi6", label: "Ordem hexagonal ψ₆", unit: "", value: (s) => localPhases(s).psi6 },
    { key: "viz", label: "Vizinhos por átomo", unit: "", value: (s) => localPhases(s).coord },
    { key: "r", label: "Separação dos dois átomos", unit: "pm", value: (s, p) => s.r2 * sub(p).sigma * 1e12 },
    { key: "F", label: "Força entre os dois átomos", unit: "pN", value: (s, p) => ljF(s.r2) * units(sub(p)).force * 1e12 },
    { key: "U", label: "Energia potencial do par", unit: "zJ", value: (s, p) => (ljU(s.r2) * units(sub(p)).eps) / ZJ },
    { key: "tf", label: "Tempo físico", unit: "ps", value: (s, p) => s.tr * units(sub(p)).tau * 1e12 },
  ],
  chart: { x: "t", y: "T" },
  conserved: "E",

  scenarios: [
    {
      id: "fusao",
      label: "Argônio: do sólido ao gás",
      params: { modo: 0, sub: 1, T0: 50, N: 64, L: 14, termo: 0, g: 0.03 },
      guide: `### Aquecendo um cristal
1. O argônio começa sólido: átomos em rede hexagonal (cor azul), vibrando em torno de posições fixas.
2. Clique em **Aquecer** algumas vezes. Perto de 84 K (ponto triplo) a rede se desfaz: o líquido escorre e ocupa o fundo.
3. Continue aquecendo: átomos escapam da superfície (vapor) e a **pressão medida** sobe rapidamente, como prevê a curva de vapor $P \\propto e^{-L/RT}$.
4. Acompanhe o ponto "agora" no diagrama de fases e troque o gráfico para **ψ₆ × t**.`,
      predict: [
        {
          question: "Durante a fusão, com o banho fornecendo calor aos poucos, a temperatura do argônio:",
          options: ["Sobe sempre no mesmo ritmo", "Fica quase parada enquanto a rede se desfaz", "Cai"],
          answer: 1,
          explanation: "A energia recebida vai para quebrar ligações (energia potencial), não para a energia cinética: é o calor latente. Veja $E_p$ subir com $T$ quase constante no modo isolado.",
        },
      ],
    },
    {
      id: "isolado",
      label: "Líquido isolado: energia conservada",
      params: { modo: 0, sub: 0, T0: 26, N: 64, L: 14, termo: 1, g: 0 },
      guide: `### Sistema isolado
1. Sem banho, a energia total deve se conservar (o integrador de Verlet a mantém dentro de uma pequena flutuação: veja o desvio no painel).
2. Energia cinética e potencial trocam entre si: o líquido em gota tem $E_p < 0$.
3. Use **Aquecer** (que injeta energia) e veja o novo patamar.`,
    },
    {
      id: "agua",
      label: "Água simplificada e pressão",
      params: { modo: 0, sub: 3, T0: 330, N: 64, L: 12, termo: 0, g: 0.03 },
      guide: `### Pressão e volume
1. Diminua o **lado da caixa** com a simulação rodando (um pistão): o vapor é comprimido e a pressão medida sobe até o vapor condensar.
2. A água daqui é só LJ com $\\varepsilon$ ajustado para o ponto triplo: não tem pontes de hidrogênio, por isso o gelo do modelo é **mais denso** que o líquido (na água real é o contrário, e a linha de fusão tem inclinação negativa).`,
    },
    {
      id: "dois-atomos",
      label: "Dois átomos: poço de potencial",
      params: { modo: 1, sub: 1, r0: 1.6, amort: 0 },
      guide: `### Interação atômica
1. Arraste o átomo B: à esquerda de $r_0$ a força é repulsiva, à direita é atrativa. Confira o sinal de $F = -dU/dr$ pela inclinação da curva.
2. Solte B em $r = 1{,}6\\sigma$: ele oscila no poço (E < 0, ligados). Solte em $r$ bem grande: $E \\approx 0$ e ele quase escapa.
3. Ligue a **perda de energia**: B termina parado em $r_0 = 2^{1/6}\\sigma$, e a energia perdida vale $\\varepsilon$, a energia de ligação.`,
      predict: [
        {
          question: "Soltando B em repouso exatamente em r₀ = 2^(1/6)σ, ele:",
          options: ["Vai para longe", "Fica parado", "Oscila em torno de r₀", "Colide com A"],
          answer: 1,
          explanation: "Em $r_0$ a curva $U(r)$ tem mínimo, então $F = -dU/dr = 0$: é o comprimento de equilíbrio da ligação.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "equilibrio",
      prompt: "Dois átomos interagem por Lennard-Jones com σ = {sig} pm. Qual é a distância de equilíbrio, em pm?",
      vary: { sig: [250, 400, 0] },
      answer: { label: "r₀", unit: "pm", compute: (p) => R_MIN * num(p, "sig") },
      tolerance: 0.01,
      hint: "No mínimo de U, dU/dr = 0 ⇒ (σ/r)^6 = 1/2.",
    },
    {
      id: "forca",
      prompt: "Com ε = {eps} zJ e σ = {sig} pm, qual é a força entre os átomos quando r = {rr} pm? (positiva = repulsão, em pN)",
      vary: { eps: [1, 4, 2], sig: [270, 350, 0], rr: [300, 450, 0] },
      answer: {
        label: "F",
        unit: "pN",
        compute: (p) => {
          const sg = num(p, "sig"), x = num(p, "rr") / sg;
          return (ljF(x) * num(p, "eps") * 1e-21) / (sg * 1e-12) * 1e12;
        },
      },
      hint: "F = (24ε/r)[2(σ/r)^12 − (σ/r)^6].",
    },
  ],

  init(p) {
    const sb = sub(p);
    const s = initMD(Math.round(num(p, "N", 64)), Lof(p), num(p, "T0", 50) / sb.epsK);
    if (modo(p) === 1) return { ...s, x: [], y: [], vx: [], vy: [], r2: num(p, "r0", 1.6), v2: 0 };
    return s;
  },
  step(s, p) {
    if (modo(p) === 1) {
      if (s.drag) return { ...s, tr: s.tr + DT_PAIR };
      const [r, v] = stepPair(s.r2, s.v2, DT_PAIR, num(p, "amort"));
      return { ...s, r2: r, v2: v, tr: s.tr + DT_PAIR };
    }
    return stepMD(s, { L: Lof(p), g: gOf(p), thermostat: Math.round(num(p, "termo")) === 0, nsub: SUB, dt: DTR });
  },
  dt: 1 / 120,
  sampleEvery: 6,
  maxSamples: 3000,

  actions: [
    {
      id: "aquecer",
      label: "Aquecer (+20%)",
      run: (s, p) => (Math.round(num(p, "termo")) === 1 ? scaleVel(s, 1.2) : { ...s, Tset: s.Tset * 1.2 + 0.005 }),
    },
    {
      id: "resfriar",
      label: "Resfriar (−20%)",
      run: (s, p) => (Math.round(num(p, "termo")) === 1 ? scaleVel(s, 1 / 1.2) : { ...s, Tset: s.Tset / 1.2 }),
    },
  ],

  pointer: {
    down(s, p, pt) {
      if (modo(p) !== 1) return undefined;
      if (Math.abs(pt.x - rx(s.r2)) > 0.9 || Math.abs(pt.y - ATOM_Y) > 1.2) return undefined;
      return { ...s, drag: true, v2: 0 };
    },
    move(s, p, pt, dragging) {
      if (modo(p) !== 1 || !dragging || !s.drag) return undefined;
      return { ...s, r2: Math.max(0.88, Math.min(5.4, xr(pt.x))), v2: 0 };
    },
    up: (s, p) => (modo(p) === 1 && s.drag ? { ...s, drag: false } : undefined),
    cursor: (s, p, pt) => (modo(p) === 1 && Math.abs(pt.x - rx(s.r2)) < 0.9 && Math.abs(pt.y - ATOM_Y) < 1.2 ? "grab" : undefined),
  },

  viewport: () => ({ xMin: 0, xMax: 16, yMin: -0.9, yMax: 9.2 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    if (modo(p) === 1) renderPair(d, s, p, theme);
    else renderBulk(d, s, p, theme);
  },
});

function scaleVel(s: MD, f: number): MD {
  const k = Math.sqrt(f);
  return { ...s, vx: s.vx.map((v) => v * k), vy: s.vy.map((v) => v * k), Tset: s.Tset * f };
}

export default estadosMateria;
