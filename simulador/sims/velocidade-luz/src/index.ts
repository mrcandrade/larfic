import { clamp, defineSim, deg, draw, num, rad, texNum, type Params } from "@fisilab/core";
import {
  ARCSEC, AU, C0, DAY, IO_P, JUP_A, JUP_D, V_EARTH, YEAR_D, aberration, annualAberration, earthJupiter, eclipse, elongation, fizeauFirst, fizeauI, foucaultShift,
  galileoResult, galileoTrial, romerFit, tubeMiss, type Eclipse, type Trial,
} from "./physics.ts";

export * from "./physics.ts";

export interface VState {
  t: number;
  trials: Trial[];
  ecl: Eclipse[];
  /** Próximo eclipse de Io a verificar. */
  nextN: number;
  /** Inclinação do telescópio de Bradley (rad, positiva no sentido do movimento). */
  psi: number;
  drag: "tube" | null;
}

const mode = (p: Params) => Math.round(num(p, "modo"));
const cOf = (p: Params) => num(p, "cmod", C0);
/** Duração de cada ensaio de Galileu na animação (s). */
export const TRIAL_T = 0.8;
/** Dias simulados por segundo no modo Rømer. */
export const ROMER_DPS = 20;
/** Dias por segundo na elipse de aberração anual. */
const BRAD_DPS = 30;
const MIN_ELONG = rad(15);
// Bradley: tubo animado
const TUBE_L = 3.4, TUBE_W = 0.24, C_ANIM = 2.6, TUBE_X0 = 1.4, TUBE_Y0 = 1.6, TUBE_RUN = 3.2;

export const romerDay = (s: VState) => s.t * ROMER_DPS;
export function romerC(s: VState): number {
  return romerFit(s.ecl);
}
export function fizeauRun(p: Params) {
  const N = num(p, "N", 720), L = num(p, "Lf", 8633), f = num(p, "f", 5), c = cOf(p);
  return { N, L, f, I: fizeauI(N, f, L, c), f1: fizeauFirst(N, L, c), x: (N * f * 2 * L) / c, cCalc: 4 * N * L * f };
}
export function foucaultRun(p: Params) {
  const R = num(p, "Rf", 20), fm = num(p, "fm", 800), D = num(p, "Dm", 0.5), c = cOf(p);
  const lw = num(p, "agua") > 0.5 ? Math.min(num(p, "lw", 3), R) : 0;
  const delta = foucaultShift(fm, R, D, c, lw);
  const w = 2 * Math.PI * fm;
  return { R, fm, D, lw, delta, w, dth: delta / (2 * D), cEst: delta > 0 ? (4 * w * R * D) / delta : 0 };
}
export const kappaOf = (p: Params) => aberration(V_EARTH, cOf(p));

/** Ciclo do fóton no tubo de Bradley: instante de início, posição do fundo do tubo e tempo de queda. */
function bradleyCycle(s: VState, p: Params) {
  const beta = num(p, "beta", 0.3);
  const u = beta * C_ANIM;
  const fall = (TUBE_L * Math.cos(s.psi)) / C_ANIM;
  const period = fall + 0.6;
  const k = Math.floor(s.t / period);
  const t0 = k * period;
  const xb0 = TUBE_X0 + ((u * t0) % TUBE_RUN);
  const tau = s.t - t0;
  return { u, fall, period, xb0, tau, xb: xb0 + u * tau, beta };
}

const fmt = (v: number, n = 3) => {
  if (!Number.isFinite(v)) return "—";
  const a = Math.abs(v);
  if (a !== 0 && (a >= 1e6 || a < 1e-3)) {
    const [m, e] = v.toExponential(n - 1).split("e");
    return `${m!.replace(".", ",")}×10^${Number(e)}`;
  }
  return Number(v.toPrecision(n)).toLocaleString("pt-BR");
};
const cTxt = (c: number) => (c > 0 ? `${fmt(c / 1e8, 4)}×10⁸ m/s` : "—");

export const velocidadeLuz = defineSim<VState>({
  id: "velocidade-luz",
  title: "Medindo a velocidade da luz: Galileu, Rømer, Bradley, Fizeau e Foucault",
  course: "FG IV",
  topic: "Ótica",
  priority: "P2",
  summary:
    "Refaça as cinco medidas históricas de c: as lanternas de Galileu (e por que o tempo de reação esconde tudo), o atraso dos eclipses de Io de Rømer, a aberração estelar de Bradley, a roda dentada de Fizeau e o espelho giratório de Foucault, sempre lendo os dados e calculando c.",
  equations: [
    String.raw`\text{Galileu: } t_m = \frac{2d}{c} + \tau_A + \tau_B \qquad \text{Rømer: } \Delta t = \frac{\Delta d_{TJ}}{c}`,
    String.raw`\text{Bradley: } \tan\kappa = \frac{v_\oplus}{c} \;\Rightarrow\; c = \frac{v_\oplus}{\tan\kappa}`,
    String.raw`\text{Fizeau: } \frac{2L}{c} = \frac{1}{2Nf_1} \;\Rightarrow\; c = 4NLf_1 \qquad \text{Foucault: } \delta = 2\omega\,\frac{2R}{c}\,D \;\Rightarrow\; c = \frac{4\omega R D}{\delta}`,
  ],
  liveEquations(s, p) {
    switch (mode(p)) {
      case 1: {
        const day = romerDay(s);
        const last = s.ecl[s.ecl.length - 1];
        const c = romerC(s);
        return [
          String.raw`d_{TJ} = ${texNum(Math.hypot(earthJupiter(day).J[0] - earthJupiter(day).E[0], earthJupiter(day).J[1] - earthJupiter(day).E[1]))}\ \text{UA} \qquad O-C = ${texNum(last?.oc ?? 0)}\ \text{s} \ (${s.ecl.length}\ \text{eclipses})`,
          String.raw`c = \frac{\sum \Delta d^2}{\sum \Delta d\,(O-C)} = ${c > 0 ? texNum(c, 4) : String.raw`\text{(faltam dados)}`}\ \text{m/s}`,
        ];
      }
      case 2: {
        const k = kappaOf(p);
        return [
          String.raw`\text{tubo: } \tan\psi = ${texNum(Math.tan(s.psi))} \ \text{vs.}\ v/c = ${texNum(num(p, "beta", 0.3))}`,
          String.raw`\kappa = ${texNum(k / ARCSEC, 4)}'' \;\Rightarrow\; c = \frac{${texNum(V_EARTH)}\ \text{m/s}}{\tan ${texNum(k / ARCSEC, 4)}''} = ${texNum(V_EARTH / Math.tan(k), 4)}\ \text{m/s}`,
        ];
      }
      case 3: {
        const r = fizeauRun(p);
        return [
          String.raw`x = \frac{N f\,2L}{c} = ${texNum(r.x)}\ \text{dente} \qquad I = |1 - 2\{x\}| = ${texNum(100 * r.I)}\ \%`,
          String.raw`4NLf = 4 \cdot ${r.N} \cdot ${texNum(r.L)} \cdot ${texNum(r.f)} = ${texNum(r.cCalc, 4)}\ \text{m/s}`,
        ];
      }
      case 4: {
        const r = foucaultRun(p);
        return [
          String.raw`\omega = ${texNum(r.w)}\ \text{rad/s} \qquad \delta = ${texNum(r.delta * 1e3)}\ \text{mm}`,
          String.raw`c = \frac{4\omega R D}{\delta} = \frac{4\cdot ${texNum(r.w)}\cdot ${texNum(r.R)}\cdot ${texNum(r.D)}}{${texNum(r.delta)}} = ${texNum(r.cEst, 4)}\ \text{m/s}`,
        ];
      }
      default: {
        const g = galileoResult(s.trials, num(p, "dist", 1.5));
        return [
          String.raw`\frac{2d}{c} = ${texNum((2 * num(p, "dist", 1.5) * 1000) / cOf(p))}\ \text{s} \qquad \bar t_{longe} - \bar t_{perto} = (${texNum(g.diff * 1000)} \pm ${texNum(g.se * 1000)})\ \text{ms}`,
        ];
      }
    }
  },

  params: [
    {
      key: "modo", label: "Experimento", unit: "", min: 0, max: 4, step: 1, default: 0,
      options: [
        { value: 0, label: "Galileu: lanternas (c. 1638)" },
        { value: 1, label: "Rømer: eclipses de Io (1676)" },
        { value: 2, label: "Bradley: aberração estelar (1728)" },
        { value: 3, label: "Fizeau: roda dentada (1849)" },
        { value: 4, label: "Foucault: espelho giratório (1862)" },
      ],
    },
    { key: "cmod", label: "c no modelo (para testar o método)", unit: "m/s", min: 1e8, max: 6e8, step: 1e6, default: C0 },
    { key: "dist", label: "Galileu: distância entre as lanternas", unit: "km", min: 0.1, max: 50, step: 0.1, default: 1.5 },
    { key: "tau", label: "Galileu: tempo de reação médio", unit: "s", min: 0.1, max: 0.4, step: 0.01, default: 0.2 },
    { key: "sigma", label: "Galileu: variação do tempo de reação", unit: "s", min: 0.005, max: 0.1, step: 0.005, default: 0.03 },
    { key: "ruido", label: "Rømer: erro de cronometragem", unit: "s", min: 0, max: 120, step: 5, default: 30 },
    { key: "beta", label: "Bradley: v/c na animação (exagerado)", unit: "", min: 0.05, max: 0.8, step: 0.01, default: 0.3, live: true },
    { key: "N", label: "Fizeau: número de dentes", unit: "", min: 50, max: 1000, step: 1, default: 720, live: true },
    { key: "Lf", label: "Fizeau: distância até o espelho", unit: "m", min: 500, max: 20000, step: 1, default: 8633, live: true },
    { key: "f", label: "Fizeau: rotação da roda", unit: "rot/s", min: 0, max: 60, step: 0.01, default: 5, live: true },
    { key: "Rf", label: "Foucault: distância ao espelho côncavo R", unit: "m", min: 1, max: 40, step: 0.5, default: 20, live: true },
    { key: "fm", label: "Foucault: rotação do espelho", unit: "rot/s", min: 0, max: 1000, step: 1, default: 800, live: true },
    { key: "Dm", label: "Foucault: distância espelho giratório–retículo D", unit: "m", min: 0.1, max: 2, step: 0.01, default: 0.5, live: true },
    { key: "agua", label: "Foucault: tubo com água no caminho", unit: "", min: 0, max: 1, step: 1, default: 0, live: true, options: [{ value: 0, label: "Não (ar)" }, { value: 1, label: "Sim (n = 1,333)" }] },
    { key: "lw", label: "Foucault: comprimento do tubo de água", unit: "m", min: 0.5, max: 20, step: 0.5, default: 3, live: true },
  ],

  observables: [
    {
      key: "cEst", label: "c estimado", unit: "m/s",
      value: (s, p) => {
        switch (mode(p)) {
          case 1: return romerC(s);
          case 2: return V_EARTH / Math.tan(kappaOf(p));
          case 3: return fizeauRun(p).cCalc;
          case 4: return foucaultRun(p).cEst;
          default: return galileoResult(s.trials, num(p, "dist", 1.5)).cEst;
        }
      },
    },
    { key: "tm", label: "Galileu: último tempo medido", unit: "s", value: (s) => s.trials[s.trials.length - 1]?.tm ?? 0 },
    { key: "dif", label: "Galileu: média longe − média perto", unit: "s", value: (s, p) => galileoResult(s.trials, num(p, "dist", 1.5)).diff },
    { key: "ntrials", label: "Galileu: número de ensaios", unit: "", value: (s) => s.trials.length },
    { key: "dEJ", label: "Rømer: distância Terra–Júpiter", unit: "UA", value: (s) => { const { E, J } = earthJupiter(romerDay(s)); return Math.hypot(J[0] - E[0], J[1] - E[1]); } },
    { key: "oc", label: "Rømer: atraso do último eclipse (O − C)", unit: "s", value: (s) => s.ecl[s.ecl.length - 1]?.oc ?? 0 },
    { key: "dia", label: "Rømer: dias desde a oposição", unit: "d", value: (s) => romerDay(s) },
    { key: "psi", label: "Bradley: inclinação do tubo", unit: "°", value: (s) => deg(s.psi) },
    { key: "erro", label: "Bradley: desvio do fóton no fundo (fração de L)", unit: "", value: (s, p) => tubeMiss(s.psi, num(p, "beta", 0.3)) },
    { key: "kappa", label: "Bradley: constante de aberração", unit: "″", value: (_s, p) => kappaOf(p) / ARCSEC },
    { key: "I", label: "Fizeau: brilho que volta", unit: "%", value: (_s, p) => 100 * fizeauRun(p).I },
    { key: "f1", label: "Fizeau: primeira extinção (teoria)", unit: "rot/s", value: (_s, p) => fizeauRun(p).f1 },
    { key: "delta", label: "Foucault: deslocamento da imagem", unit: "mm", value: (_s, p) => 1e3 * foucaultRun(p).delta },
  ],
  chart: { x: "t", y: "cEst" },

  scenarios: [
    {
      id: "galileu",
      label: "Galileu e o tempo de reação",
      params: { modo: 0, dist: 1.5, tau: 0.2, sigma: 0.03 },
      guide: `### Por que Galileu não conseguiu
1. Rode: os ensaios alternam lanternas **lado a lado** (azul, calibração) e **separadas** por $d$ (laranja).
2. Compare os histogramas: eles se sobrepõem. A luz leva $2d/c \\approx 10\\ \\mu$s, mil vezes menos que a dispersão do tempo de reação.
3. Veja a estimativa ingênua $2d/\\bar t_m$: dá alguns km/s, um absurdo.
4. Use **Medir 500 vezes** e veja $\\bar t_{longe} - \\bar t_{perto}$: o erro padrão continua muito maior que $2d/c$. O painel diz quantas medidas seriam necessárias.`,
      predict: [
        {
          question: "Com lanternas a 1,5 km, quanto do tempo medido é devido à luz?",
          options: ["cerca de metade", "cerca de 10%", "menos de 0,01%", "quase todo"],
          answer: 2,
          explanation: "$2d/c = 3000/3\\times10^8 = 10\\ \\mu$s, contra cerca de 0,4 s de reações: 0,0025%.",
        },
      ],
    },
    {
      id: "romer",
      label: "Rømer e as luas de Júpiter",
      params: { modo: 1, ruido: 30 },
      guide: `### O atraso dos eclipses de Io
1. Os eclipses de Io se repetem a cada ${String(IO_P).replace(".", ",")} dia, mas são vistos **atrasados** quando a Terra se afasta de Júpiter.
2. O gráfico de cima mostra $O - C$ (observado − previsto pela tabela feita na oposição) ao longo do ano.
3. Perto da conjunção Júpiter fica atrás do Sol e não há observações.
4. No gráfico de baixo, $O-C$ cresce em linha reta com o aumento da distância $\\Delta d$: a inclinação é $1/c$. Compare com $499$ s/UA.`,
      predict: [
        {
          question: "Quanto tempo a luz leva para atravessar o diâmetro da órbita da Terra (2 UA)?",
          options: ["cerca de 8 s", "cerca de 16,6 min", "cerca de 2 h", "é instantâneo"],
          answer: 1,
          explanation: "$2 \\times 1{,}496\\times10^{11}/2{,}998\\times10^8 \\approx 998$ s $\\approx 16{,}6$ min. Rømer estimou 22 min.",
        },
      ],
    },
    {
      id: "bradley",
      label: "Bradley: chuva e telescópio",
      params: { modo: 2, beta: 0.3 },
      guide: `### A estrela parece deslocada no sentido do movimento
1. O tubo anda para a direita. Com ele na vertical, o fóton bate na parede.
2. Arraste o topo do tubo para inclinar até o fóton chegar à ocular: $\\tan\\psi = v/c$ (como inclinar o guarda-chuva ao correr na chuva).
3. Com a Terra a $v = 29{,}8$ km/s, o ângulo real é só $\\kappa \\approx 20{,}5''$. Ao longo do ano a estrela descreve a elipse da direita.
4. Leia $\\kappa$ e calcule $c = v/\\tan\\kappa$.`,
    },
    {
      id: "fizeau",
      label: "Fizeau: roda dentada",
      params: { modo: 3, N: 720, Lf: 8633, f: 5 },
      guide: `### Encontrando a primeira extinção
1. A luz passa por um vão, vai até o espelho a $L$ e volta. Se nesse tempo a roda girou meio dente, a luz bate num dente.
2. Aumente devagar a rotação $f$ e observe o brilho. Ache o primeiro mínimo $f_1$.
3. Calcule $c = 4NLf_1$. Fizeau (1849) achou $f_1 \\approx 12{,}6$ rot/s e $c \\approx 3{,}13\\times10^8$ m/s.
4. Continue aumentando: o brilho volta e há novos mínimos em $3f_1, 5f_1, \\dots$`,
      predict: [
        {
          question: "Se a distância L dobrar, a primeira extinção acontece com uma rotação:",
          options: ["duas vezes maior", "duas vezes menor", "igual", "quatro vezes menor"],
          answer: 1,
          explanation: "$f_1 = c/(4NL)$: com o dobro do caminho, a roda precisa girar a metade da rapidez para avançar meio dente.",
        },
      ],
    },
    {
      id: "foucault",
      label: "Foucault: espelho giratório e água",
      params: { modo: 4, Rf: 20, fm: 800, Dm: 0.5, agua: 0 },
      guide: `### O desvio da imagem
1. Enquanto a luz vai e volta do espelho côncavo, o espelho giratório gira $\\Delta\\theta = \\omega\\,2R/c$ e o feixe volta desviado de $2\\Delta\\theta$.
2. Leia o deslocamento $\\delta$ no retículo (em mm) e calcule $c = 4\\omega R D/\\delta$.
3. Coloque o **tubo com água**: o desvio aumenta, pois a luz é mais lenta na água ($v = c/n$). Esse resultado de 1850 derrubou a teoria corpuscular de Newton.`,
      predict: [
        {
          question: "Ao pôr água em parte do caminho, o deslocamento da imagem:",
          options: ["aumenta", "diminui", "não muda"],
          answer: 0,
          explanation: "A luz demora mais (velocidade $c/n$ na água), o espelho gira mais nesse tempo e o desvio cresce.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "fizeau",
      prompt: "Uma roda de Fizeau tem {N} dentes e o espelho está a {L} m. A primeira extinção ocorre a {f} rot/s. Qual o valor de c obtido?",
      vary: { N: [300, 900, 0], L: [3000, 12000, 0], f: [8, 40, 1] },
      answer: { label: "c", unit: "m/s", compute: (p) => 4 * num(p, "N") * num(p, "L") * num(p, "f") },
      hint: "Meio período de dente: 1/(2Nf) = 2L/c.",
    },
    {
      id: "bradley",
      prompt: "A constante de aberração medida é {k}″ e a velocidade orbital da Terra é {v} km/s. Qual o valor de c?",
      vary: { k: [19.5, 21.5, 2], v: [29, 30.5, 2] },
      answer: { label: "c", unit: "m/s", compute: (p) => (num(p, "v") * 1000) / Math.tan(num(p, "k") * ARCSEC) },
      hint: "c = v / tan κ; converta segundos de arco em radianos.",
    },
    {
      id: "romer",
      prompt: "Os eclipses de Io chegam {dt} min atrasados quando a Terra está do lado oposto da órbita (2 UA mais longe, 1 UA = 1,496×10¹¹ m). Qual o valor de c?",
      vary: { dt: [15, 22, 1] },
      answer: { label: "c", unit: "m/s", compute: (p) => (2 * AU) / (num(p, "dt") * 60) },
    },
    {
      id: "foucault",
      prompt: "Num arranjo de Foucault, R = {R} m, D = {D} m e o espelho gira a {f} rot/s. A imagem se desloca {d} mm. Qual o valor de c?",
      vary: { R: [10, 30, 0], D: [0.3, 1.5, 2], f: [300, 1000, 0], d: [0.3, 1.5, 2] },
      answer: { label: "c", unit: "m/s", compute: (p) => (4 * 2 * Math.PI * num(p, "f") * num(p, "R") * num(p, "D")) / (num(p, "d") / 1000) },
    },
  ],

  init: () => ({ t: 0, trials: [], ecl: [], nextN: 0, psi: 0, drag: null }),
  step(s, p, t, dt) {
    const t1 = t + dt;
    const m = mode(p);
    if (m === 0) {
      const want = Math.min(4000, Math.floor(t1 / TRIAL_T));
      if (want > s.trials.length) {
        const trials = s.trials.slice();
        while (trials.length < want) trials.push(galileoTrial(trials.length, num(p, "dist", 1.5), num(p, "tau", 0.2), num(p, "sigma", 0.03), cOf(p)));
        return { ...s, t: t1, trials };
      }
    } else if (m === 1) {
      const day1 = t1 * ROMER_DPS;
      let ecl = s.ecl, n = s.nextN;
      for (;;) {
        const e = eclipse(n, cOf(p), num(p, "ruido", 30));
        if (e.day > day1) break;
        if (elongation(e.day) > MIN_ELONG) {
          if (ecl === s.ecl) ecl = s.ecl.slice();
          ecl.push(e);
        }
        n++;
      }
      if (ecl.length > 1500) ecl = ecl.slice(-1500);
      return { ...s, t: t1, ecl, nextN: n };
    }
    return { ...s, t: t1 };
  },
  dt: 0.01,
  sampleEvery: 5,

  viewport: () => ({ xMin: 0, xMax: 16, yMin: 0, yMax: 10, unit: "" }),

  pointer: {
    down(s, p, pt) {
      if (mode(p) !== 2) return undefined;
      const c = bradleyCycle(s, p);
      const tx = c.xb + TUBE_L * Math.sin(s.psi), ty = TUBE_Y0 + TUBE_L * Math.cos(s.psi);
      return Math.hypot(pt.x - tx, pt.y - ty) < 0.8 ? { ...s, drag: "tube" } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || s.drag !== "tube") return undefined;
      const c = bradleyCycle(s, p);
      return { ...s, psi: clamp(Math.atan2(pt.x - c.xb, Math.max(0.3, pt.y - TUBE_Y0)), rad(-50), rad(50)) };
    },
    up: (s) => (s.drag ? { ...s, drag: null } : undefined),
    cursor: (_s, p) => (mode(p) === 2 ? "grab" : undefined),
  },

  actions: [
    {
      id: "medir",
      label: "Galileu: medir 500 vezes",
      run(s, p) {
        const trials = s.trials.slice();
        for (let i = 0; i < 500 && trials.length < 4000; i++) trials.push(galileoTrial(trials.length, num(p, "dist", 1.5), num(p, "tau", 0.2), num(p, "sigma", 0.03), cOf(p)));
        return { ...s, trials };
      },
    },
    { id: "zerar", label: "Bradley: tubo na vertical", run: (s) => ({ ...s, psi: 0 }) },
    { id: "ajustar", label: "Bradley: inclinar tan ψ = v/c", run: (s, p) => ({ ...s, psi: Math.atan(num(p, "beta", 0.3)) }) },
  ],

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    const T = (str: string, x: number, y: number, o: Parameters<typeof d.text>[3] = {}) => d.text(str, x, y, { size: 12, ...o });
    const glow = theme.dark ? "#ffd866" : "#e0a800";
    const panelText = (x: number, y0: number, lines: [string, string?, string?][]) => {
      let y = y0;
      for (const [str, c, w] of lines) {
        T(str, x, y, { align: "left", size: 11, color: c ?? theme.text, weight: w ?? "400" });
        y -= 0.42;
      }
    };

    if (m === 0) {
      const dKm = num(p, "dist", 1.5);
      const g = galileoResult(s.trials, dKm);
      // paisagem
      d.polyline([[0.3, 6.2], [1.5, 6.9], [2.7, 6.2], [6.5, 6.2], [7.7, 6.9], [8.9, 6.2]], { color: theme.muted, width: 1.5 });
      const cur = s.trials[s.trials.length - 1];
      const u = cur ? ((s.t % TRIAL_T) / TRIAL_T) * cur.tm * 1.15 : 0;
      const lightT = (dKm * 1000) / cOf(p);
      const lanternA = !!cur && u >= 0;
      const lanternB = !!cur && u >= lightT + cur.rB;
      const person = (x: number, lbl: string, on: boolean) => {
        d.circle(x, 7.75, 0.16, { stroke: theme.text, width: 1.5 });
        d.line(x, 7.6, x, 7.1, { color: theme.text, width: 1.5 });
        d.line(x, 7.1, x - 0.15, 6.9, { color: theme.text, width: 1.5 });
        d.line(x, 7.1, x + 0.15, 6.9, { color: theme.text, width: 1.5 });
        d.line(x, 7.45, x + (x < 5 ? 0.35 : -0.35), 7.35, { color: theme.text, width: 1.5 });
        const lx = x + (x < 5 ? 0.42 : -0.42);
        if (on) d.circle(lx, 7.35, 0.35, { fill: glow, alpha: 0.35 });
        d.rect(lx - 0.08, 7.25, 0.16, 0.2, { fill: on ? glow : theme.muted, stroke: theme.text, width: 1 });
        T(lbl, x, 8.2, { size: 11 });
      };
      person(1.5, "A (cronometra)", lanternA);
      person(7.7, "B", lanternB);
      if (lanternA) d.line(1.95, 7.35, 7.25, 7.35, { color: glow, width: 1.5, dash: [6, 4], alpha: 0.7 });
      d.line(1.9, 6.0, 7.3, 6.0, { color: theme.muted, width: 1 });
      T(`d = ${fmt(dKm)} km`, 4.6, 5.8, { size: 11, color: theme.muted });
      if (cur) T(`t = ${fmt(Math.min(u, cur.tm), 3)} s`, 1.5, 8.65, { size: 12, weight: "600", color: theme.series[0] });
      T(cur ? (cur.far ? "ensaio com as lanternas separadas" : "calibração: lanternas lado a lado") : "", 4.6, 9.4, { size: 11, color: cur?.far ? theme.series[1] : theme.series[0] });

      // linha do tempo do último ensaio
      if (cur) {
        const x0 = 0.6, w = 8.2, k = w / cur.tm;
        const y = 4.8;
        d.rect(x0, y, cur.rB * k, 0.35, { fill: theme.series[3], alpha: 0.8 });
        d.rect(x0 + cur.rB * k, y, cur.rA * k, 0.35, { fill: theme.series[4], alpha: 0.8 });
        d.line(x0, y - 0.1, x0, y + 0.45, { color: theme.positive, width: 2 });
        T("reação de B", x0 + (cur.rB * k) / 2, y + 0.17, { size: 10, color: "#fff" });
        T("reação de A", x0 + cur.rB * k + (cur.rA * k) / 2, y + 0.17, { size: 10, color: "#fff" });
        T(`luz (ida e volta): ${fmt((2 * (cur.far ? dKm * 1000 : 2)) / cOf(p) * 1e6, 3)} µs, invisível nesta escala`, x0, y - 0.3, { size: 10, color: theme.positive, align: "left" });
      }

      // histogramas
      const all = s.trials.map((q) => q.tm);
      const gx = 0.6, gy = 0.7, gw = 8.2, gh = 3.0;
      d.line(gx, gy, gx + gw, gy, { color: theme.muted, width: 1 });
      T("tempo medido t_m (s)", gx + gw, gy - 0.3, { size: 10, color: theme.muted, align: "right" });
      if (all.length > 1) {
        const lo = Math.min(...all), hi = Math.max(...all);
        const nb = 30, bw = (hi - lo) / nb || 1e-3;
        const hist = (far: boolean) => {
          const h = new Array<number>(nb).fill(0);
          for (const q of s.trials) if (q.far === far) h[Math.min(nb - 1, Math.floor((q.tm - lo) / bw))]!++;
          return h;
        };
        const hn = hist(false), hf = hist(true);
        const hmax = Math.max(...hn, ...hf, 1);
        for (let i = 0; i < nb; i++) {
          const x = gx + (gw * i) / nb;
          d.rect(x, gy, gw / nb, (gh * hn[i]!) / hmax, { fill: theme.series[0], alpha: 0.45 });
          d.rect(x, gy, gw / nb, (gh * hf[i]!) / hmax, { fill: theme.series[1], alpha: 0.45 });
        }
        T(fmt(lo, 3), gx, gy - 0.3, { size: 9, color: theme.muted });
        T(fmt(hi, 3), gx + gw, gy - 0.6, { size: 9, color: theme.muted, align: "right" });
      }
      T("■ perto (calibração)", gx + 0.1, gy + gh + 0.25, { size: 10, color: theme.series[0], align: "left" });
      T("■ longe", gx + 2.6, gy + gh + 0.25, { size: 10, color: theme.series[1], align: "left" });

      const twoDc = (2 * dKm * 1000) / cOf(p);
      const sdT = Math.hypot(g.far.sd, g.near.sd) || num(p, "sigma", 0.03) * 2;
      const need = (3 * sdT / twoDc) ** 2 * 2;
      panelText(9.6, 9.3, [
        ["Resultados", theme.text, "600"],
        [`ensaios: ${g.near.n} perto + ${g.far.n} longe`],
        [`média perto: ${fmt(g.near.mean, 4)} s`, theme.series[0]],
        [`média longe: ${fmt(g.far.mean, 4)} s`, theme.series[1]],
        [`diferença: (${fmt(g.diff * 1e3, 3)} ± ${fmt(g.se * 1e3, 2)}) ms`],
        [`esperado 2d/c = ${fmt(twoDc * 1e6, 3)} µs`, theme.positive],
        [""],
        ["Estimativas de c", theme.text, "600"],
        [`ingênua 2d/t̄ = ${fmt(g.naive / 1000, 3)} km/s`],
        [`pela diferença: ${g.cEst > 0 ? fmt(g.cEst / 1000, 3) + " km/s" : "negativa (sem sentido)"}`],
        [""],
        ["Para ver o atraso da luz (3 erros-padrão)", theme.muted],
        [`seriam precisos ~${fmt(need, 2)} ensaios`, theme.muted],
        ["Conclusão de Galileu: a luz é, no mínimo,", theme.muted],
        ["muito rápida; talvez instantânea.", theme.muted],
      ]);
      return;
    }

    if (m === 1) {
      const day = romerDay(s);
      const cx = 3.9, cy = 5.4, kE = 1.15, rJ = 3.7;
      const { E, J } = earthJupiter(day);
      const ex = cx + kE * E[0], ey = cy + kE * E[1];
      const thJ = Math.atan2(J[1], J[0]);
      const jx = cx + rJ * Math.cos(thJ), jy = cy + rJ * Math.sin(thJ);
      d.circle(cx, cy, kE, { stroke: theme.series[0], width: 1, dash: [3, 3] });
      d.circle(cx, cy, rJ, { stroke: theme.series[1], width: 1, dash: [3, 3] });
      d.circle(cx, cy, 0.28, { fill: glow });
      T("Sol", cx, cy - 0.5, { size: 10, color: theme.muted });
      const visible = elongation(day) > MIN_ELONG;
      d.line(jx, jy, ex, ey, { color: glow, width: 1.4, dash: visible ? [] : [3, 4], alpha: visible ? 0.9 : 0.4 });
      // sombra de Júpiter e Io
      const ux = Math.cos(thJ), uy = Math.sin(thJ);
      d.polyline([[jx - uy * 0.13, jy + ux * 0.13], [jx + ux * 0.9 - uy * 0.13, jy + uy * 0.9 + ux * 0.13], [jx + ux * 0.9 + uy * 0.13, jy + uy * 0.9 - ux * 0.13], [jx + uy * 0.13, jy - ux * 0.13]], { color: "none", fill: theme.muted, alpha: 0.35, close: true });
      d.circle(jx, jy, 0.18, { fill: theme.series[1] });
      const io = thJ + (2 * Math.PI * (day - 0.3)) / IO_P;
      d.dot(jx + 0.45 * Math.cos(io), jy + 0.45 * Math.sin(io), 3, theme.text);
      T("Júpiter e Io", jx, jy + 0.45, { size: 10, color: theme.series[1] });
      d.circle(ex, ey, 0.11, { fill: theme.series[0] });
      T("Terra", ex, ey - 0.3, { size: 10, color: theme.series[0] });
      T("órbita de Júpiter fora de escala", cx, 0.95, { size: 10, color: theme.muted });
      if (!visible) T("Júpiter perto do Sol: eclipses não observáveis", cx, 9.6, { size: 11, color: theme.positive });
      else T(`dia ${fmt(day, 4)} após a oposição`, cx, 9.6, { size: 11 });

      // O−C × tempo
      const gx = 8.6, gw = 7.0;
      const plot = (gy: number, gh: number, xs: (e: Eclipse) => number, xmax: number, xlbl: string, fit: boolean, now?: number) => {
        const ymax = (2.2 * AU) / cOf(p) + 3 * num(p, "ruido", 30) + 60;
        const ymin = -3 * num(p, "ruido", 30) - 60;
        const Y = (v: number) => gy + (gh * (v - ymin)) / (ymax - ymin);
        d.line(gx, Y(0), gx + gw, Y(0), { color: theme.muted, width: 1 });
        d.line(gx, gy, gx, gy + gh, { color: theme.muted, width: 1 });
        for (const v of [0, 500, 1000]) if (v < ymax) T(`${v}`, gx - 0.08, Y(v), { size: 9, color: theme.muted, align: "right" });
        T(xlbl, gx + gw, gy - 0.3, { size: 10, color: theme.muted, align: "right" });
        T("O − C (s)", gx + 0.1, gy + gh + 0.2, { size: 10, color: theme.muted, align: "left" });
        const x0 = now !== undefined ? Math.max(0, now - xmax) : 0;
        for (const e of s.ecl) {
          const xv = xs(e) - x0;
          if (xv >= 0 && xv <= xmax) d.dot(gx + (gw * xv) / xmax, Y(e.oc), 2.2, theme.series[0]!, 0.8);
        }
        if (fit) {
          const c = romerC(s);
          if (c > 0) {
            d.line(gx, Y(0), gx + gw, Y((xmax * AU) / c), { color: theme.series[1], width: 1.5 });
            T(`inclinação 1/c → c = ${cTxt(c)}`, gx + gw, gy + gh - 0.15, { size: 10, color: theme.series[1], align: "right" });
          }
        }
        return x0;
      };
      const x0 = plot(5.7, 3.4, (e) => e.day, 420, "dias", false, day);
      T(x0 > 0 ? `janela: dias ${fmt(x0, 4)} a ${fmt(x0 + 420, 4)}` : "atraso volta a zero depois de 399 dias (período sinódico)", gx + gw / 2, 9.65, { size: 10, color: theme.muted });
      plot(1.0, 3.4, (e) => e.dd, 2.1, "Δd = d − d(oposição)  (UA)", true);
      return;
    }

    if (m === 2) {
      const c = bradleyCycle(s, p);
      const xb = c.xb, yb = TUBE_Y0;
      const ax = Math.sin(s.psi), ay = Math.cos(s.psi);
      const nx = ay, ny = -ax;
      const wall = (sgn: number) => d.line(xb + sgn * TUBE_W * nx, yb + sgn * TUBE_W * ny, xb + sgn * TUBE_W * nx + TUBE_L * ax, yb + sgn * TUBE_W * ny + TUBE_L * ay, { color: theme.text, width: 3 });
      wall(1);
      wall(-1);
      d.circle(xb, yb - 0.15, 0.14, { fill: theme.series[0] });
      T("ocular", xb, yb - 0.5, { size: 10, color: theme.muted });
      d.dot(xb + TUBE_L * ax, yb + TUBE_L * ay, 6, theme.series[2]!);
      T("arraste para inclinar", xb + TUBE_L * ax, yb + TUBE_L * ay + 0.35, { size: 10, color: theme.series[2] });
      d.arrow(xb + 0.3, yb - 0.85, 1.0, 0, { color: theme.accent });
      T("v (telescópio)", xb + 1.4, yb - 0.85, { size: 10, color: theme.accent, align: "left" });
      // fóton: parte do topo do tubo no início do ciclo e cai na vertical
      const xTop0 = c.xb0 + TUBE_L * ax, yTop = yb + TUBE_L * ay;
      const fallen = Math.min(c.tau, c.fall);
      const py = yTop - C_ANIM * fallen;
      // posição relativa ao eixo do tubo
      const rel = (px: number, pyy: number) => (px - (c.xb0 + c.u * Math.min(c.tau, c.fall))) * nx + (pyy - yb) * ny;
      const off = rel(xTop0, py);
      const ok = Math.abs(off) < TUBE_W;
      const missEnd = tubeMiss(s.psi, c.beta) * TUBE_L;
      const success = Math.abs(missEnd) < TUBE_W * 0.9;
      d.line(xTop0, yTop + 2.2, xTop0, py, { color: glow, width: 1, dash: [3, 4], alpha: 0.6 });
      d.dot(xTop0, py, 5, ok ? glow : theme.positive);
      T("luz da estrela", xTop0, yTop + 2.4, { size: 10, color: glow });
      T(success ? "o fóton chega à ocular" : "o fóton bate na parede do tubo", 4.2, 9.6, { size: 12, weight: "600", color: success ? theme.series[2] : theme.positive });
      T(`ψ = ${fmt(deg(s.psi), 3)}°   arctan(v/c) = ${fmt(deg(Math.atan(c.beta)), 3)}°`, 4.2, 9.15, { size: 11 });
      T("(v/c exagerado na animação)", 4.2, 8.75, { size: 10, color: theme.muted });

      // elipse anual de γ Draconis
      const kap = kappaOf(p);
      const ox = 12.4, oy = 6.8, k = 2.2 / (kap / ARCSEC);
      const beta = rad(74.8), lam = rad(268.6);
      const pts: [number, number][] = [];
      for (let i = 0; i <= 120; i++) {
        const [a, b] = annualAberration((i * YEAR_D) / 120, kap, beta, lam);
        pts.push([ox + (k * a) / ARCSEC, oy + (k * b) / ARCSEC]);
      }
      d.line(ox - 2.8, oy, ox + 2.8, oy, { color: theme.grid, width: 1 });
      d.line(ox, oy - 2.6, ox, oy + 2.6, { color: theme.grid, width: 1 });
      d.polyline(pts, { color: theme.series[1], width: 1.5 });
      const day = s.t * BRAD_DPS;
      const [a, b] = annualAberration(day, kap, beta, lam);
      d.dot(ox + (k * a) / ARCSEC, oy + (k * b) / ARCSEC, 6, glow);
      d.line(ox + 2.2, oy - 2.45, ox + 2.2, oy - 2.25, { color: theme.text, width: 1 });
      d.line(ox, oy - 2.35, ox + 2.2, oy - 2.35, { color: theme.text, width: 1 });
      T(`${fmt(kap / ARCSEC, 3)}″`, ox + 1.1, oy - 2.6, { size: 10 });
      T("γ Draconis ao longo do ano (Δλ cos β, Δβ)", ox, 9.6, { size: 11 });
      const months = ["jan", "fev", "mar", "abr", "mai", "jun", "jul", "ago", "set", "out", "nov", "dez"];
      T(`mês: ${months[Math.floor(((day % YEAR_D) / YEAR_D) * 12)]}`, ox, 9.2, { size: 10, color: theme.muted });
      panelText(9.4, 3.6, [
        ["Medida de Bradley", theme.text, "600"],
        [`v da Terra = ${fmt(V_EARTH / 1000, 3)} km/s`],
        [`semieixo da elipse κ = ${fmt(kap / ARCSEC, 4)}″`],
        [`c = v / tan κ = ${cTxt(V_EARTH / Math.tan(kap))}`, theme.series[2], "600"],
        ["Bradley (1728) obteve ≈ 3,0×10⁸ m/s", theme.muted],
      ]);
      return;
    }

    if (m === 3) {
      const r = fizeauRun(p);
      // esquema
      const y = 8.4;
      d.circle(0.9, 9.4, 0.18, { fill: glow });
      T("fonte", 0.9, 9.8, { size: 10, color: theme.muted });
      d.line(0.9, 9.2, 0.9, y, { color: glow, width: 1.5 });
      d.line(0.6, y + 0.3, 1.2, y - 0.3, { color: theme.text, width: 2 });
      T("semiespelho", 1.3, y + 0.45, { size: 9, color: theme.muted, align: "left" });
      d.line(0.9, y, 14.8, y, { color: glow, width: 1.5, alpha: 0.5 + 0.5 * r.I });
      d.rect(3.0, y - 0.6, 0.12, 1.2, { fill: theme.muted });
      T("roda", 3.06, y + 0.8, { size: 10 });
      d.line(14.9, y - 0.7, 14.9, y + 0.7, { color: theme.text, width: 3 });
      T(`espelho a L = ${fmt(r.L, 4)} m (fora de escala)`, 12.5, y + 0.95, { size: 10, color: theme.muted });
      d.line(0.9, y, 0.9, y - 1.1, { color: glow, width: 1.5, alpha: r.I });
      const g = Math.round(40 + 215 * r.I);
      d.circle(0.9, y - 1.5, 0.35, { fill: `rgb(${g}, ${g}, ${Math.round(g * 0.85)})`, stroke: theme.text, width: 1 });
      T(`observador: ${fmt(100 * r.I, 3)} %`, 1.4, y - 1.5, { size: 11, align: "left", weight: "600" });

      // roda em câmera lenta
      const wx = 2.6, wy = 3.5, R0 = 2.0;
      const ang = (2 * Math.PI * r.f * s.t) / 50;
      const nT = 36;
      const pts: [number, number][] = [];
      for (let i = 0; i < nT; i++) {
        for (const [fr, rr] of [[0, R0], [0.5, R0], [0.5, R0 * 0.85], [1, R0 * 0.85]] as [number, number][]) {
          const a = ang + ((i + fr) * 2 * Math.PI) / nT;
          pts.push([wx + rr * Math.cos(a), wy + rr * Math.sin(a)]);
        }
      }
      d.polyline(pts, { close: true, fill: theme.muted, alpha: 0.5, color: theme.text, width: 1 });
      d.circle(wx, wy, 0.15, { fill: theme.text });
      T(`${r.N} dentes (desenho com ${nT}); câmera lenta ×50`, wx, wy - 2.4, { size: 10, color: theme.muted });

      // dentes na ida e na volta
      const sx0 = 5.4, sw = 4.6;
      const strip = (yy: number, shift: number, lbl: string) => {
        const per = sw / 3;
        for (let k = -1; k < 4; k++) {
          const x = sx0 + (k + 0.5 - shift) * per;
          const xa = Math.max(sx0, x), xb = Math.min(sx0 + sw, x + per / 2);
          if (xb > xa) d.rect(xa, yy, xb - xa, 0.5, { fill: theme.muted, alpha: 0.75 });
        }
        d.rect(sx0, yy, sw, 0.5, { stroke: theme.text, width: 1 });
        T(lbl, sx0, yy + 0.8, { size: 10, align: "left" });
      };
      const frac = ((r.x % 1) + 1) % 1;
      strip(4.6, 0, "ida: a luz passa no centro de um vão");
      strip(2.4, frac, `volta: a roda avançou ${fmt(r.x, 3)} dente`);
      const spot = sx0 + sw / 2;
      d.dot(spot, 4.85, 6, glow);
      const blocked = r.I < 0.5;
      d.dot(spot, 2.65, 6, blocked ? theme.positive : glow);
      d.line(spot, 4.6, spot, 2.9, { color: glow, dash: [3, 3], width: 1 });

      // brilho × f
      const gx = 10.8, gy = 1.0, gw = 4.9, gh = 4.3, fmax = 60;
      d.line(gx, gy, gx + gw, gy, { color: theme.muted, width: 1 });
      d.line(gx, gy, gx, gy + gh, { color: theme.muted, width: 1 });
      d.plot((x) => gy + gh * fizeauI(r.N, ((x - gx) * fmax) / gw, r.L, cOf(p)), gx, gx + gw, { color: theme.series[0], width: 1.5, n: 600 });
      d.line(gx + (gw * r.f) / fmax, gy, gx + (gw * r.f) / fmax, gy + gh, { color: theme.series[1], width: 1.5 });
      d.dot(gx + (gw * r.f) / fmax, gy + gh * r.I, 5, theme.series[1]!);
      T("f (rot/s)", gx + gw, gy - 0.6, { size: 10, color: theme.muted, align: "right" });
      for (const f of [0, 20, 40, 60]) T(String(f), gx + (gw * f) / fmax, gy - 0.3, { size: 9, color: theme.muted });
      T("brilho", gx + 0.1, gy + gh + 0.25, { size: 10, color: theme.muted, align: "left" });
      panelText(10.8, 7.1, [
        [`f = ${fmt(r.f, 4)} rot/s`, theme.series[1], "600"],
        [`Δt = 2L/c = ${fmt((2 * r.L) / cOf(p) * 1e6, 4)} µs`],
        [`4NLf = ${cTxt(r.cCalc)}`],
      ]);
      return;
    }

    // Foucault
    const r = foucaultRun(p);
    const y = 7.6;
    const mx = 4.6;
    d.rect(0.6, y - 0.25, 0.2, 0.5, { fill: glow });
    T("fenda", 0.7, y + 0.5, { size: 10, color: theme.muted });
    d.line(1.8, y - 0.5, 1.8, y + 0.5, { color: theme.text, width: 2 });
    T("lente", 1.8, y + 0.75, { size: 10, color: theme.muted });
    d.line(0.8, y, mx, y, { color: glow, width: 1.5 });
    const vis = (2 * Math.PI * r.fm * s.t) / 400;
    d.line(mx - 0.45 * Math.cos(vis), y - 0.45 * Math.sin(vis), mx + 0.45 * Math.cos(vis), y + 0.45 * Math.sin(vis), { color: theme.text, width: 3 });
    T("espelho giratório", mx, y - 0.85, { size: 10 });
    d.line(mx, y, 14.6, y + 0.9, { color: glow, width: 1.5 });
    const arc: [number, number][] = [];
    for (let i = -10; i <= 10; i++) arc.push([14.6 + 0.3 * (1 - Math.cos(i * 0.08)) * 6, y + 0.9 + i * 0.12]);
    d.polyline(arc, { color: theme.text, width: 3 });
    T(`espelho côncavo (R = ${fmt(r.R)} m)`, 13.3, y + 2.2, { size: 10, align: "center" });
    if (r.lw > 0) {
      const f0 = 0.3, f1 = f0 + 0.65 * Math.min(1, r.lw / r.R);
      const P = (f: number): [number, number] => [mx + (14.6 - mx) * f, y + 0.9 * f];
      const [ax, ay] = P(f0), [bx, by] = P(f1);
      d.polyline([[ax, ay - 0.3], [bx, by - 0.3], [bx, by + 0.3], [ax, ay + 0.3]], { close: true, fill: theme.series[0], alpha: 0.25, color: theme.series[0] });
      T(`água: ${fmt(r.lw)} m`, (ax + bx) / 2, (ay + by) / 2 + 0.55, { size: 10, color: theme.series[0] });
    }
    // feixe de volta (desvio exagerado)
    const back = Math.min(0.25, r.dth * 300);
    d.line(mx, y, 1.8, y - (mx - 1.8) * Math.tan(back), { color: theme.series[1], width: 1.3, dash: [5, 3] });
    T("volta desviada de 2Δθ (exagerado)", 1.0, y - 1.3, { size: 10, color: theme.series[1], align: "left" });

    // retículo
    const gx = 1.0, gy = 1.6, kmm = 3.0, wmm = 2.5;
    d.rect(gx - 0.2, gy - 0.6, wmm * kmm + 0.4, 3.2, { stroke: theme.grid, width: 1 });
    for (let i = 0; i <= wmm * 10; i++) {
      const x = gx + (i / 10) * kmm;
      const big = i % 5 === 0;
      d.line(x, gy, x, gy + (big ? 0.4 : 0.2), { color: theme.text, width: 1 });
      if (big) T(fmt(i / 10, 2), x, gy - 0.3, { size: 9, color: theme.muted });
    }
    T("retículo (mm)", gx + wmm * kmm, gy + 2.35, { size: 10, color: theme.muted, align: "right" });
    d.rect(gx - 0.04, gy + 0.6, 0.08, 1.4, { fill: theme.muted, alpha: 0.5 });
    T("parado", gx, gy + 2.2, { size: 9, color: theme.muted });
    const dm = r.delta * 1e3;
    if (dm <= wmm) {
      d.rect(gx + dm * kmm - 0.05, gy + 0.6, 0.1, 1.4, { fill: glow });
      T(`δ = ${fmt(dm, 3)} mm`, gx + dm * kmm, gy + 2.2, { size: 11, weight: "600", color: glow });
    } else T(`δ = ${fmt(dm, 3)} mm (fora do retículo)`, gx + wmm * kmm, gy + 2.2, { size: 11, color: theme.positive, align: "right" });
    panelText(9.6, 4.6, [
      ["Cálculo", theme.text, "600"],
      [`ω = 2πf = ${fmt(r.w, 4)} rad/s`],
      [`Δθ = ω·2R/c = ${fmt(r.dth * 1e6, 3)} µrad`],
      [`δ = 2Δθ·D = ${fmt(dm, 3)} mm`],
      [`c = 4ωRD/δ = ${cTxt(r.cEst)}`, theme.series[2], "600"],
      [r.lw > 0 ? "com água o desvio cresce: v = c/n" : "Foucault (1862): 2,98×10⁸ m/s", theme.muted],
    ]);
  },
});

export default velocidadeLuz;

/** Utilitário para testes: avança o modo Rømer até um dado dia. */
export const ROMER = { DPS: ROMER_DPS, DAY, JUP_D, JUP_A };
