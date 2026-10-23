import { clamp, defineSim, draw, num, texNum, type Draw, type Params, type Theme } from "@fisilab/core";
import { bandName, wavelengthColor } from "./color.ts";
import { fmt, panel } from "./panel.ts";
import {
  BETA_MAX,
  C_M_PER_NS,
  PARTICLES,
  betaFromP,
  classicalLambda,
  dopplerFactor,
  dopplerLambda,
  earthNowForTraveler,
  earthSignalArrival,
  earthTimeAt,
  energy,
  gammaOf,
  kinetic,
  kineticClassical,
  lambdaAtAngle,
  pcFromK,
  properTime,
  signalCounts,
  simultaneityJump,
  totalProperTime,
  travelerSignalArrival,
  travelerX,
  vIn,
  vOut,
  type Trip,
} from "./physics.ts";

export * from "./physics.ts";

export interface RDState {
  /** Modo 0: tempo da Terra (anos). Modo 1: tempo de animação (s). Modo 2: tempo do laboratório (ns). */
  T: number;
  /** Viagem (modo 0), com a virada P e o reencontro arrastáveis. */
  trip: Trip;
  /** 0 = arrastando a virada, 1 = arrastando o reencontro. */
  drag: number;
  /** Modo 2: momento pc (MeV), posições relativística e clássica (c·ns) e tempo próprio da partícula (ns). */
  pc: number;
  xr: number;
  xc: number;
  tauP: number;
}

const mode = (p: Params) => Math.round(num(p, "modo", 0));
const betaP = (p: Params) => clamp(num(p, "beta", 0.8), 0.05, 0.99);
const dist = (p: Params) => num(p, "D", 4);
const lam0 = (p: Params) => num(p, "lambda0", 530);
const particle = (p: Params) => PARTICLES[Math.round(num(p, "particula", 0))] ?? PARTICLES[0]!;
const force = (p: Params) => num(p, "F", 0.1);
/** Duração do modo 2 (ns). */
export const T_LAB = 20;

/** Viagem padrão definida por β e D. */
export const tripOf = (p: Params): Trip => ({ P: { x: dist(p), ct: dist(p) / betaP(p) }, T: (2 * dist(p)) / betaP(p) });
/** Anos da Terra por segundo de animação (a viagem dura cerca de 12 s). */
const rate = (p: Params) => Math.max(0.5, tripOf(p).T / 12);

// ---------- geometria do diagrama de Minkowski (modo 0) ----------
const DB = { x0: 0.9, x1: 11.3, y0: 0.9, y1: 11.4 };
function mapping(p: Params) {
  const tTop = tripOf(p).T * 1.25;
  const k = (DB.y1 - DB.y0) / tTop;
  const ox = DB.x0 + 0.2 * (DB.x1 - DB.x0);
  return {
    k,
    tTop,
    X: (x: number) => ox + k * x,
    Y: (ct: number) => DB.y0 + k * ct,
    x: (wx: number) => (wx - ox) / k,
    ct: (wy: number) => (wy - DB.y0) / k,
    xMin: (DB.x0 - ox) / k,
    xMax: (DB.x1 - ox) / k,
  };
}

function hitTrip(s: RDState, p: Params, wx: number, wy: number): number {
  const m = mapping(p);
  if (Math.hypot(m.X(s.trip.P.x) - wx, m.Y(s.trip.P.ct) - wy) < 0.45) return 0;
  if (Math.hypot(m.X(0) - wx, m.Y(s.trip.T) - wy) < 0.45) return 1;
  return -1;
}

// ---------- Doppler (modo 1): nave indo e voltando ----------
const C_VIS = 3; // velocidade da luz no desenho (unidades por segundo)
const AMP = 6; // meia excursão da nave
const T0_EMIT = 0.3; // período próprio entre frentes de onda desenhadas
const OBS = 9.3; // posição dos observadores (±)
/** Posição e velocidade (com sinal, em unidades de c) da nave no tempo t. */
export function shipMotion(beta: number, t: number): { x: number; v: number } {
  const P = (4 * AMP) / (beta * C_VIS);
  const u = (((t / P + 0.25) % 1) + 1) % 1; // começa no centro indo para a direita
  if (u < 0.5) return { x: -AMP + 4 * AMP * u, v: beta };
  return { x: 3 * AMP - 4 * AMP * u, v: -beta };
}
/** λ recebido agora por um observador em xo: acha a emissão retardada e aplica o Doppler. */
export function observedLambda(beta: number, lambda0: number, xo: number, t: number): number {
  const g = (te: number) => t - te - Math.abs(xo - shipMotion(beta, te).x) / C_VIS;
  let a = t - (2 * OBS + 2 * AMP) / C_VIS;
  let b = t;
  for (let i = 0; i < 60; i++) {
    const m = (a + b) / 2;
    if (g(m) > 0) a = m;
    else b = m;
  }
  const sm = shipMotion(beta, (a + b) / 2);
  const recession = sm.v * Math.sign(sm.x - xo);
  return dopplerLambda(lambda0, recession);
}

export const relatividadeDinamica = defineSim<RDState>({
  id: "relatividade-dinamica",
  title: "Gêmeos, Doppler relativístico e E = mc²",
  course: "FG IV",
  topic: "Relatividade",
  priority: "P2",
  summary:
    "Paradoxo dos gêmeos num diagrama de Minkowski com a linha de mundo arrastável, sinais de luz contados pelos dois irmãos e o salto da simultaneidade na virada; Doppler relativístico com a cor da nave; energia e momento relativísticos comparados com a mecânica clássica.",
  equations: [
    String.raw`\tau = \int \frac{dt}{\gamma} = \frac{t_{\text{ida}}}{\gamma_1} + \frac{t_{\text{volta}}}{\gamma_2},\qquad \gamma = \frac{1}{\sqrt{1-\beta^2}}`,
    String.raw`\frac{f_{\text{rec}}}{f_{\text{em}}} = \sqrt{\frac{1-\beta}{1+\beta}}\ \text{(afastando)},\qquad \lambda = \lambda_0\,\gamma\,(1+\beta) = \gamma\,\lambda_{\text{clássico}}`,
    String.raw`ct - ct_e = \beta\,(x - x_e)\quad\text{(linha de simultaneidade de quem se move com } \beta)`,
    String.raw`E = \gamma mc^2,\quad \vec p = \gamma m\vec v,\quad E^2 = (pc)^2 + (mc^2)^2,\quad K = E - mc^2`,
    String.raw`\frac{d\vec p}{dt} = \vec F \;\Rightarrow\; p = Ft,\quad \frac{v}{c} = \frac{pc}{E} < 1`,
  ],
  liveEquations(s, p) {
    const m = mode(p);
    if (m === 0) {
      const tr = s.trip;
      const b1 = Math.abs(vOut(tr));
      const b2 = Math.abs(vIn(tr));
      const tau = totalProperTime(tr);
      const j = simultaneityJump(tr);
      return [
        String.raw`\beta_{\text{ida}} = ${texNum(b1)},\ \beta_{\text{volta}} = ${texNum(b2)} \Rightarrow \gamma_1 = ${texNum(gammaOf(b1), 4)},\ \gamma_2 = ${texNum(gammaOf(b2), 4)}`,
        String.raw`\tau = \frac{${texNum(tr.P.ct)}}{${texNum(gammaOf(b1), 4)}} + \frac{${texNum(tr.T - tr.P.ct)}}{${texNum(gammaOf(b2), 4)}} = ${texNum(tau)}\ \text{anos}\quad(\text{Terra: } ${texNum(tr.T)}\ \text{anos})`,
        String.raw`\text{salto do “agora” na Terra na virada: } ${texNum(j.before)} \to ${texNum(j.after)}\ \text{anos}`,
      ];
    }
    if (m === 1) {
      const b = betaP(p);
      return [
        String.raw`\lambda_{\text{afastando}} = ${texNum(lam0(p), 4)}\sqrt{\tfrac{1+${texNum(b)}}{1-${texNum(b)}}} = ${texNum(dopplerLambda(lam0(p), b), 4)}\ \text{nm}`,
        String.raw`\lambda_{\text{aproximando}} = ${texNum(lam0(p), 4)}\sqrt{\tfrac{1-${texNum(b)}}{1+${texNum(b)}}} = ${texNum(dopplerLambda(lam0(p), -b), 4)}\ \text{nm}`,
        String.raw`\text{clássico: } ${texNum(classicalLambda(lam0(p), b), 4)}\ \text{e}\ ${texNum(classicalLambda(lam0(p), -b), 4)}\ \text{nm}\quad(\gamma = ${texNum(gammaOf(b), 4)})`,
      ];
    }
    const mc2 = particle(p).mc2;
    const E = energy(s.pc, mc2);
    return [
      String.raw`E = \sqrt{(${texNum(s.pc, 4)})^2 + (${texNum(mc2, 4)})^2} = ${texNum(E, 4)}\ \text{MeV}`,
      String.raw`\gamma = E/mc^2 = ${texNum(E / mc2, 4)},\quad v/c = pc/E = ${texNum(betaFromP(s.pc, mc2), 5)}\quad(\text{clássico: } ${texNum(s.pc / mc2, 4)})`,
      String.raw`K = ${texNum(kinetic(s.pc, mc2), 4)}\ \text{MeV}\quad \text{vs.}\quad \frac{p^2}{2m} = ${texNum(kineticClassical(s.pc, mc2), 4)}\ \text{MeV}`,
    ];
  },

  params: [
    {
      key: "modo",
      label: "Experimento",
      unit: "",
      min: 0,
      max: 2,
      step: 1,
      default: 0,
      options: [
        { value: 0, label: "Paradoxo dos gêmeos (Minkowski)" },
        { value: 1, label: "Doppler relativístico" },
        { value: 2, label: "Energia e momento relativísticos" },
      ],
    },
    { key: "beta", label: "Velocidade da nave β = v/c", unit: "", min: 0.3, max: 0.99, step: 0.01, default: 0.8 },
    { key: "D", label: "Distância até a estrela D", unit: "al", min: 1, max: 10, step: 0.5, default: 4 },
    { key: "lambda0", label: "Cor própria da luz da nave λ₀", unit: "nm", min: 400, max: 700, step: 1, default: 530, live: true },
    {
      key: "particula",
      label: "Partícula acelerada",
      unit: "",
      min: 0,
      max: PARTICLES.length - 1,
      step: 1,
      default: 0,
      options: PARTICLES.map((q, i) => ({ value: i, label: `${q.name} (mc² = ${fmt(q.mc2, 4)} MeV)` })),
    },
    { key: "F", label: "Força F = dp/dt", unit: "MeV/c por ns", min: 0.01, max: 500, step: 0.01, default: 0.1, log: true, live: true },
  ],

  observables: [
    { key: "T", label: "Tempo na Terra t", unit: "anos", value: (s, p) => (mode(p) === 0 ? s.T : 0) },
    { key: "tau", label: "Tempo próprio do viajante τ", unit: "anos", value: (s, p) => (mode(p) === 0 ? properTime(s.trip, s.T) : 0) },
    { key: "agora", label: "“Agora” na Terra segundo o viajante", unit: "anos", value: (s, p) => (mode(p) === 0 ? earthNowForTraveler(s.trip, Math.min(s.T, s.trip.T)) : 0) },
    { key: "recV", label: "Sinais da Terra recebidos pelo viajante", unit: "", value: (s, p) => (mode(p) === 0 ? signalCounts(s.trip, s.T).travelerReceived : 0) },
    { key: "recT", label: "Sinais do viajante recebidos na Terra", unit: "", value: (s, p) => (mode(p) === 0 ? signalCounts(s.trip, s.T).earthReceived : 0) },
    { key: "lamR", label: "λ visto pelo observador da direita", unit: "nm", value: (s, p) => (mode(p) === 1 ? observedLambda(betaP(p), lam0(p), OBS, s.T) : lam0(p)) },
    { key: "lamL", label: "λ visto pelo observador da esquerda", unit: "nm", value: (s, p) => (mode(p) === 1 ? observedLambda(betaP(p), lam0(p), -OBS, s.T) : lam0(p)) },
    { key: "tlab", label: "Tempo do laboratório", unit: "ns", value: (s, p) => (mode(p) === 2 ? s.T : 0) },
    { key: "taup", label: "Tempo próprio da partícula", unit: "ns", value: (s) => s.tauP },
    { key: "pc", label: "Momento pc", unit: "MeV", value: (s) => s.pc },
    { key: "v", label: "v/c relativístico", unit: "", value: (s, p) => betaFromP(s.pc, particle(p).mc2) },
    { key: "vc", label: "v/c clássico (p/m)", unit: "", value: (s, p) => s.pc / particle(p).mc2 },
    { key: "E", label: "Energia total E", unit: "MeV", value: (s, p) => energy(s.pc, particle(p).mc2) },
    { key: "K", label: "Energia cinética K = E − mc²", unit: "MeV", value: (s, p) => kinetic(s.pc, particle(p).mc2) },
    { key: "Kc", label: "Energia cinética clássica p²/2m", unit: "MeV", value: (s, p) => kineticClassical(s.pc, particle(p).mc2) },
    { key: "xr", label: "Posição (relativística)", unit: "m", value: (s) => s.xr * C_M_PER_NS },
    { key: "minv", label: "Massa invariante √(E² − (pc)²)", unit: "MeV", value: (s, p) => Math.sqrt(Math.max(0, energy(s.pc, particle(p).mc2) ** 2 - s.pc ** 2)) },
  ],
  conserved: "minv",
  chart: { x: "T", y: "tau" },

  scenarios: [
    {
      id: "gemeos",
      label: "Paradoxo dos gêmeos",
      params: { modo: 0, beta: 0.8, D: 4 },
      guide: `### Quem envelhece menos?
1. A viajante vai a uma estrela a 4 al com $\\beta = 0{,}8$ e volta. A Terra espera $2D/\\beta = 10$ anos.
2. Rode. Cada irmão envia um pulso de luz por ano do próprio relógio (linhas a 45°). Acompanhe à direita quantos cada um recebe.
3. Na ida, a viajante recebe pulsos com frequência $\\sqrt{(1-\\beta)/(1+\\beta)} = 1/3$ por ano; na volta, 3 por ano. A Terra só passa a receber a taxa alta quando a luz da virada chega, perto do fim.
4. As linhas tracejadas da viajante são suas linhas de simultaneidade. Na virada elas **saltam**: o "agora na Terra" pula de 1,8 para 8,2 anos. É essa assimetria (ela muda de referencial, a Terra não) que desfaz o paradoxo.
5. Confira: $\\tau = 10/\\gamma = 6$ anos.`,
      predict: [
        {
          question: "Ao final, quantos pulsos anuais da Terra a viajante terá recebido?",
          options: ["6, um por ano dela", "10, um por ano da Terra", "3,6", "depende do lado de onde se olha"],
          answer: 1,
          explanation:
            "A Terra emite um pulso por ano durante 10 anos e todos chegam antes ou no reencontro. A viajante recebe 1 na ida (taxa 1/3 por ano, durante 3 anos) e 9 na volta (taxa 3 por ano). Ela envelheceu 6 anos e viu passar 10 anos da Terra.",
        },
      ],
    },
    {
      id: "arrastar",
      label: "Viagem assimétrica (arraste a linha de mundo)",
      params: { modo: 0, beta: 0.6, D: 3 },
      guide: `### Arraste a virada e o reencontro
1. O ponto P (virada) e o ponto R (reencontro, sobre o eixo $ct$) podem ser arrastados. A linha de mundo nunca fica mais inclinada que a luz.
2. Faça uma ida lenta e uma volta rápida. Compare $\\tau = t_1/\\gamma_1 + t_2/\\gamma_2$ com o tempo da Terra.
3. Leve P quase até o cone de luz: o tempo próprio do trecho vai a zero. Uma linha reta (a Terra) sempre tem o **maior** tempo próprio entre dois eventos.
4. Observe o salto da simultaneidade na virada: ele cresce com $\\beta$ e com a distância.`,
      predict: [
        {
          question: "Entre os mesmos eventos de partida e de reencontro, qual linha de mundo marca mais tempo próprio?",
          options: ["a reta (quem fica parado)", "a que vai mais longe", "todas marcam o mesmo tempo"],
          answer: 0,
          explanation:
            "Em Minkowski vale a desigualdade triangular invertida: $\\tau = \\int\\sqrt{dt^2 - dx^2}$ é máximo para a reta. Qualquer desvio reduz o tempo próprio.",
        },
      ],
    },
    {
      id: "doppler",
      label: "Doppler relativístico: a cor da nave",
      params: { modo: 1, beta: 0.3, lambda0: 530 },
      guide: `### Azul na chegada, vermelho na partida
1. A nave emite luz verde ($\\lambda_0 = 530$ nm) e vai e volta entre os dois observadores. As frentes de onda são coloridas com o $\\lambda$ medido em cada direção.
2. O observador para quem a nave se aproxima vê $\\lambda_0\\sqrt{(1-\\beta)/(1+\\beta)}$ (mais azul); o outro, $\\lambda_0\\sqrt{(1+\\beta)/(1-\\beta)}$ (mais vermelho).
3. Repare no atraso: a cor só muda para um observador quando chega a luz emitida depois da virada.
4. O gráfico compara com o Doppler clássico $1 + \\beta$: o relativístico tem um fator $\\gamma$ a mais (dilatação do tempo da fonte).
5. Aumente $\\beta$: com $\\beta \\approx 0{,}3$ a luz da nave já sai do visível para um dos lados?`,
      predict: [
        {
          question: "A nave se afasta a 0,6c emitindo 500 nm. Que λ o observador mede?",
          options: ["800 nm", "1000 nm", "750 nm", "312 nm"],
          answer: 1,
          explanation: "$\\lambda = 500\\sqrt{1{,}6/0{,}4} = 500 \\times 2 = 1000$ nm (infravermelho). O clássico daria $500 \\times 1{,}6 = 800$ nm; a diferença é o fator $\\gamma = 1{,}25$.",
        },
      ],
    },
    {
      id: "energia",
      label: "Nada passa da luz: E = mc²",
      params: { modo: 2, particula: 0, F: 0.1 },
      guide: `### Empurrar sem parar
1. Uma força constante age sobre um elétron: o momento cresce linearmente, $p = Ft$, sem limite.
2. A velocidade relativística $v/c = pc/E$ se aproxima de 1 e nunca passa. A clássica $p/m$ cruza a luz em $t = mc/F$.
3. O triângulo à direita mostra $E^2 = (pc)^2 + (mc^2)^2$: a hipotenusa é a energia total; o cateto vertical, a energia de repouso, não muda.
4. Compare $K = E - mc^2$ com $p^2/2m$: coincidem só enquanto $pc \\ll mc^2$.
5. Troque para o próton e aumente $F$. Quando o próton fica "relativístico"?`,
      predict: [
        {
          question: "Quando pc = mc², a velocidade do elétron vale:",
          options: ["c", "0,5c", "c/√2 ≈ 0,71c", "2c (clássico)"],
          answer: 2,
          explanation: "$v/c = pc/E = mc^2/\\sqrt{2}\\,mc^2 = 1/\\sqrt 2$. A previsão clássica $p/m$ daria exatamente $c$.",
        },
      ],
    },
  ],

  exercises: [
    {
      id: "gemeos",
      prompt:
        "Uma astronauta viaja até uma estrela a {D} anos-luz com velocidade {beta}c e volta imediatamente com a mesma velocidade. Quantos anos ela envelhece durante a viagem?",
      vary: { D: [1, 12, 1], beta: [0.5, 0.98, 2] },
      answer: { label: "τ", unit: "anos", compute: (p) => (2 * num(p, "D")) / num(p, "beta") / gammaOf(num(p, "beta")) },
      hint: "Na Terra passam 2D/v; o relógio de bordo marca esse tempo dividido por γ.",
    },
    {
      id: "doppler",
      prompt: "Uma galáxia se afasta de nós a {beta}c. Uma linha emitida com {l0} nm chega com que comprimento de onda?",
      vary: { beta: [0.05, 0.8, 2], l0: [380, 660, 0] },
      answer: { label: "λ", unit: "nm", compute: (p) => dopplerLambda(num(p, "l0"), num(p, "beta")) },
      hint: "λ = λ₀ √((1 + β)/(1 − β)).",
    },
    {
      id: "momento",
      prompt: "Um próton (mc² = 938,3 MeV) tem energia cinética de {K} MeV. Quanto vale pc, em MeV?",
      vary: { K: [10, 5000, 0] },
      answer: { label: "pc", unit: "MeV", compute: (p) => pcFromK(num(p, "K"), 938.272) },
      hint: "E = K + mc² e (pc)² = E² − (mc²)².",
    },
  ],

  init: (p) => ({ T: 0, trip: tripOf(p), drag: -1, pc: 0, xr: 0, xc: 0, tauP: 0 }),
  step(s, p, _t, dt) {
    const m = mode(p);
    if (m === 0) return { ...s, T: Math.min(s.T + rate(p) * dt, s.trip.T) };
    if (m === 1) return { ...s, T: s.T + dt, tauP: s.tauP + dt / gammaOf(betaP(p)) };
    const mc2 = particle(p).mc2;
    const F = force(p);
    const p0 = s.pc;
    const p1 = p0 + F * dt;
    const E0 = energy(p0, mc2);
    const E1 = energy(p1, mc2);
    // Passo exato para força constante: dx = dE/F, dτ = (mc²/F) d(asinh(pc/mc²)).
    const dx = F > 0 ? (E1 - E0) / F : (p0 / E0) * dt;
    const dtau = F > 0 ? (mc2 / F) * (Math.asinh(p1 / mc2) - Math.asinh(p0 / mc2)) : (mc2 / E0) * dt;
    return { ...s, T: s.T + dt, pc: p1, xr: s.xr + dx, xc: s.xc + ((p0 + p1) / (2 * mc2)) * dt, tauP: s.tauP + dtau };
  },
  dt: 0.02,
  sampleEvery: 3,
  stopWhen: (s, p) => (mode(p) === 0 ? s.trip.T - s.T : mode(p) === 2 ? T_LAB - s.T : 1),

  pointer: {
    down(s, p, pt) {
      if (mode(p) !== 0) return undefined;
      const i = hitTrip(s, p, pt.x, pt.y);
      return i >= 0 ? { ...s, drag: i } : undefined;
    },
    move(s, p, pt, dragging) {
      if (!dragging || s.drag < 0 || mode(p) !== 0) return undefined;
      const m = mapping(p);
      const snap = (v: number) => Math.round(v * 10) / 10;
      const tr = s.trip;
      if (s.drag === 0) {
        let ct = clamp(snap(m.ct(pt.y)), 0.2, tr.T - 0.2);
        let x = clamp(snap(m.x(pt.x)), m.xMin, m.xMax);
        // tipo tempo nos dois trechos
        const lim = BETA_MAX * Math.min(ct, tr.T - ct);
        x = clamp(x, -lim, lim);
        if (Math.abs(x) < 1e-9) x = 0;
        ct = Math.max(ct, 0.2);
        return { ...s, trip: { P: { x, ct }, T: tr.T } };
      }
      const minT = tr.P.ct + Math.abs(tr.P.x) / BETA_MAX + 0.05;
      const T = clamp(snap(m.ct(pt.y)), Math.max(minT, s.T), m.tTop);
      return { ...s, trip: { P: tr.P, T } };
    },
    up: (s) => (s.drag >= 0 ? { ...s, drag: -1 } : undefined),
    cursor: (s, p, pt) => (mode(p) === 0 && hitTrip(s, p, pt.x, pt.y) >= 0 ? "grab" : undefined),
  },
  actions: [{ id: "simetrica", label: "Viagem simétrica (β e D dos controles)", run: (s, p) => ({ ...s, T: 0, trip: tripOf(p) }) }],

  narrowSplit: () => 0.587,
  viewport: () => ({ xMin: 0, xMax: 20, yMin: 0, yMax: 12 }),

  render(ctx, frame) {
    const d = draw(ctx, frame);
    const { state: s, params: p, theme } = frame;
    const m = mode(p);
    if (m === 0) {
      renderMinkowski(d, theme, s, p);
      renderCounts(d, theme, s);
    } else if (m === 1) renderDoppler(d, theme, s, p);
    else renderEnergy(d, theme, s, p);
  },
});

// ---------------- modo 0 ----------------

function renderMinkowski(d: Draw, theme: Theme, s: RDState, p: Params) {
  const m = mapping(p);
  const tr = s.trip;
  const T = Math.min(s.T, tr.T);
  const earthCol = theme.series[0]!;
  const travCol = theme.series[1]!;
  const light = theme.series[5]!;
  const { ctx } = d;
  ctx.save();
  ctx.beginPath();
  ctx.rect(DB.x0, DB.y0, DB.x1 - DB.x0, DB.y1 - DB.y0);
  ctx.clip();
  // grade de 1 ano / 1 al (ou mais espaçada)
  const step = m.tTop > 30 ? 5 : m.tTop > 14 ? 2 : 1;
  for (let x = Math.ceil(m.xMin / step) * step; x <= m.xMax; x += step) d.line(m.X(x), DB.y0, m.X(x), DB.y1, { color: theme.grid, width: 1 });
  for (let c = 0; c <= m.tTop; c += step) d.line(DB.x0, m.Y(c), DB.x1, m.Y(c), { color: theme.grid, width: 1 });
  // cone de luz da partida
  d.line(m.X(0), m.Y(0), m.X(m.tTop), m.Y(m.tTop), { color: light, width: 1, alpha: 0.5, dash: [4, 4] });
  d.line(m.X(0), m.Y(0), m.X(-m.tTop), m.Y(m.tTop), { color: light, width: 1, alpha: 0.5, dash: [4, 4] });

  // linhas de simultaneidade da viajante a cada ano próprio (leque)
  const tauTot = totalProperTime(tr);
  for (let j = 1; j < tauTot; j++) {
    const te = earthTimeAt(tr, j);
    if (te > T) break;
    const xe = travelerX(tr, te);
    d.line(m.X(xe), m.Y(te), m.X(0), m.Y(earthNowForTraveler(tr, te)), { color: travCol, width: 1, alpha: 0.35, dash: [3, 3] });
  }
  // linhas imediatamente antes e depois da virada
  if (T >= tr.P.ct) {
    const j = simultaneityJump(tr);
    d.line(m.X(tr.P.x), m.Y(tr.P.ct), m.X(0), m.Y(j.before), { color: travCol, width: 1.4, dash: [6, 3] });
    d.line(m.X(tr.P.x), m.Y(tr.P.ct), m.X(0), m.Y(j.after), { color: travCol, width: 1.4, dash: [6, 3] });
    d.line(m.X(0) - 0.12, m.Y(j.before), m.X(0) - 0.12, m.Y(j.after), { color: theme.positive, width: 4, alpha: 0.7 });
    d.text(`salto de ${fmt(j.after - j.before, 3)} anos`, m.X(0) - 0.22, m.Y((j.before + j.after) / 2), {
      color: theme.positive,
      size: 10,
      weight: "600",
      align: "right",
    });
  }

  // sinais da Terra (1 por ano)
  for (let k = 1; k <= Math.floor(T + 1e-9); k++) {
    const a = earthSignalArrival(tr, k);
    const sg = tr.P.x < 0 ? -1 : 1;
    const tEnd = Number.isFinite(a) && a <= T ? a : T;
    d.line(m.X(0), m.Y(k), m.X(sg * (tEnd - k)), m.Y(tEnd), { color: earthCol, width: 1, alpha: 0.75 });
    if (Number.isFinite(a) && a <= T) d.dot(m.X(travelerX(tr, a)), m.Y(a), 3, earthCol);
  }
  // sinais da viajante (1 por ano próprio)
  const tauNow = properTime(tr, T);
  for (let j = 1; j <= Math.floor(tauNow + 1e-9); j++) {
    const te = earthTimeAt(tr, j);
    const xe = travelerX(tr, te);
    const arr = travelerSignalArrival(tr, j);
    const tEnd = Math.min(arr, T);
    const xEnd = xe - Math.sign(xe || 1) * (tEnd - te);
    d.line(m.X(xe), m.Y(te), m.X(arr <= T ? 0 : xEnd), m.Y(tEnd), { color: travCol, width: 1, alpha: 0.75 });
    d.dot(m.X(xe), m.Y(te), 2.5, travCol);
    if (arr <= T) d.dot(m.X(0), m.Y(arr), 3, travCol);
  }

  // linhas de mundo
  d.line(m.X(0), m.Y(0), m.X(0), m.Y(m.tTop), { color: earthCol, width: 3 });
  d.polyline(
    [
      [m.X(0), m.Y(0)],
      [m.X(tr.P.x), m.Y(tr.P.ct)],
      [m.X(0), m.Y(tr.T)],
    ],
    { color: travCol, width: 3 },
  );
  // "agora" na Terra e para a viajante
  d.line(DB.x0, m.Y(T), DB.x1, m.Y(T), { color: earthCol, width: 1, dash: [6, 4], alpha: 0.7 });
  if (T < tr.T && Math.abs(T - tr.P.ct) > 1e-6) {
    const xe = travelerX(tr, T);
    const now = earthNowForTraveler(tr, T);
    const v = T < tr.P.ct ? vOut(tr) : vIn(tr);
    // linha de simultaneidade atual, estendida pelo diagrama
    d.line(m.X(m.xMin), m.Y(T + v * (m.xMin - xe)), m.X(m.xMax), m.Y(T + v * (m.xMax - xe)), { color: travCol, width: 1.8, dash: [8, 4] });
    d.dot(m.X(0), m.Y(now), 5, travCol);
  }
  ctx.restore();

  // eventos arrastáveis e corpos
  d.circle(m.X(tr.P.x), m.Y(tr.P.ct), 0.17, { fill: travCol, stroke: theme.text, width: 1.2 });
  d.text("P (virada, arraste)", m.X(tr.P.x) + 0.25, m.Y(tr.P.ct), { color: travCol, size: 10, weight: "600", align: "left" });
  d.circle(m.X(0), m.Y(tr.T), 0.17, { fill: theme.accent, stroke: theme.text, width: 1.2 });
  d.text("R (reencontro, arraste)", m.X(0) + 0.25, m.Y(tr.T) + 0.15, { color: theme.text, size: 10, weight: "600", align: "left" });
  d.dot(m.X(0), m.Y(T), 6, earthCol);
  d.dot(m.X(travelerX(tr, T)), m.Y(T), 6, travCol);

  // eixos e moldura
  d.rect(DB.x0, DB.y0, DB.x1 - DB.x0, DB.y1 - DB.y0, { stroke: theme.muted, width: 1 });
  for (let c = 0; c <= m.tTop; c += step) d.text(fmt(c), DB.x0, m.Y(c), { color: theme.muted, size: 9, align: "right", dx: -4 });
  for (let x = Math.ceil(m.xMin / step) * step; x <= m.xMax; x += step) d.text(fmt(x), m.X(x), DB.y0, { color: theme.muted, size: 9, dy: 9 });
  d.text("x (anos-luz)", DB.x1, DB.y0, { color: theme.muted, size: 11, align: "right", dy: 22 });
  d.text("ct (anos)", DB.x0, DB.y1, { color: theme.muted, size: 11, align: "left", dy: -9 });
  d.text("Terra", m.X(0) - 0.1, DB.y1 - 0.3, { color: earthCol, size: 11, weight: "600", align: "right" });
}

function renderCounts(d: Draw, theme: Theme, s: RDState) {
  const tr = s.trip;
  const T = Math.min(s.T, tr.T);
  const tau = properTime(tr, T);
  const c = signalCounts(tr, T);
  const earthCol = theme.series[0]!;
  const travCol = theme.series[1]!;
  const x0 = 12.2;
  let y = 11.5;
  d.text("Pulsos de luz: 1 por ano de cada relógio", x0, y, { size: 12, weight: "600", align: "left" });
  y -= 0.65;
  d.text(`Terra: t = ${fmt(T, 3)} anos · enviou ${c.earthSent} · recebeu ${c.earthReceived}`, x0, y, { color: earthCol, size: 11, align: "left" });
  y -= 0.5;
  d.text(`Viajante: τ = ${fmt(tau, 3)} anos · enviou ${c.travelerSent} · recebeu ${c.travelerReceived}`, x0, y, { color: travCol, size: 11, align: "left" });

  // linhas do tempo de recepção (no relógio de quem recebe)
  const tauTot = totalProperTime(tr);
  const bar = (yb: number, label: string, total: number, marks: number[], col: string, turn?: number) => {
    const W = 7.2;
    d.text(label, x0, yb + 0.35, { color: col, size: 10, align: "left" });
    d.line(x0, yb, x0 + W, yb, { color: theme.muted, width: 1 });
    for (let k = 0; k <= Math.floor(total); k++) d.line(x0 + (W * k) / total, yb - 0.08, x0 + (W * k) / total, yb + 0.08, { color: theme.muted, width: 1 });
    if (turn !== undefined) d.line(x0 + (W * turn) / total, yb - 0.25, x0 + (W * turn) / total, yb + 0.25, { color: theme.positive, width: 2 });
    for (const v of marks) d.dot(x0 + (W * v) / total, yb, 4, col);
  };
  const recTrav: number[] = [];
  for (let k = 1; k <= Math.floor(tr.T + 1e-9); k++) {
    const a = earthSignalArrival(tr, k);
    if (Number.isFinite(a) && a <= T + 1e-9) recTrav.push(properTime(tr, a));
  }
  const recEarth: number[] = [];
  for (let j = 1; j <= Math.floor(tauTot + 1e-9); j++) {
    const a = travelerSignalArrival(tr, j);
    if (a <= T + 1e-9) recEarth.push(a);
  }
  y -= 1.0;
  bar(y, "chegadas no relógio da viajante (τ); traço vermelho = virada", tauTot, recTrav, earthCol, tr.P.ct / gammaOf(vOut(tr)));
  y -= 1.0;
  const turnSeen = tr.P.ct + Math.abs(tr.P.x);
  bar(y, "chegadas no relógio da Terra (t); traço = luz da virada chega", tr.T, recEarth, travCol, turnSeen);

  y -= 0.85;
  const b1 = Math.abs(vOut(tr));
  const b2 = Math.abs(vIn(tr));
  d.text(`Ida: β = ${fmt(b1, 3)}, γ = ${fmt(gammaOf(b1), 4)}, pulsos chegam com f/f₀ = ${fmt(dopplerFactor(b1), 3)}`, x0, y, { size: 10, align: "left" });
  y -= 0.45;
  d.text(`Volta: β = ${fmt(b2, 3)}, γ = ${fmt(gammaOf(b2), 4)}, f/f₀ = ${fmt(1 / dopplerFactor(b2), 3)}`, x0, y, { size: 10, align: "left" });
  y -= 0.45;
  const j = simultaneityJump(tr);
  d.text(`"Agora na Terra" para a viajante salta de ${fmt(j.before, 3)} para ${fmt(j.after, 3)} anos`, x0, y, { size: 10, align: "left", color: theme.positive });
  y -= 0.7;
  if (s.T >= tr.T - 1e-9) {
    d.text(`Reencontro: Terra ${fmt(tr.T, 4)} anos, viajante ${fmt(tauTot, 4)} anos`, x0, y, { size: 12, weight: "600", align: "left" });
    y -= 0.5;
    d.text(`A viajante está ${fmt(tr.T - tauTot, 3)} anos mais jovem.`, x0, y, { size: 11, align: "left", color: travCol });
  } else {
    d.text("Arraste P e R para mudar a viagem.", x0, y, { size: 10, align: "left", color: theme.muted });
    y -= 0.45;
    d.text("Linhas finas: pulsos; tracejado: simultaneidade da viajante.", x0, y, { size: 10, align: "left", color: theme.muted });
  }
}

// ---------------- modo 1 ----------------

function renderDoppler(d: Draw, theme: Theme, s: RDState, p: Params) {
  const b = betaP(p);
  const l0 = lam0(p);
  const t = s.T;
  const F = { x0: 0.4, x1: 19.6, y0: 5.0, y1: 11.9 };
  const k = 0.95;
  const X = (x: number) => 10 + k * x;
  const Y = (y: number) => 8.45 + k * y;
  const uv = theme.series[4]!;
  const ir = theme.dark ? "#8a2b2b" : "#7a1f1f";
  const colorOf = (l: number) => wavelengthColor(l, l < 380 ? uv : ir);
  d.rect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0, { fill: theme.dark ? "rgba(0,0,0,0.35)" : "rgba(20,30,50,0.9)", stroke: theme.muted, width: 1 });
  const { ctx } = d;
  ctx.save();
  ctx.beginPath();
  ctx.rect(F.x0, F.y0, F.x1 - F.x0, F.y1 - F.y0);
  ctx.clip();
  // frentes de onda emitidas a cada γT₀ (tempo do laboratório), coloridas pelo λ em cada direção
  const Tlab = gammaOf(b) * T0_EMIT;
  const rMax = 22;
  const kMin = Math.ceil((t - rMax / C_VIS) / Tlab);
  for (let n = kMin; n * Tlab <= t; n++) {
    const te = n * Tlab;
    const sm = shipMotion(b, te);
    const r = C_VIS * (t - te);
    if (r <= 0.02) continue;
    const seg = 36;
    for (let i = 0; i < seg; i++) {
      const a0 = (2 * Math.PI * i) / seg;
      const a1 = (2 * Math.PI * (i + 1)) / seg;
      const am = (a0 + a1) / 2;
      // ângulo entre a velocidade e a direção de propagação
      const theta = sm.v > 0 ? am : Math.PI - am;
      const l = lambdaAtAngle(l0, b, theta);
      ctx.strokeStyle = colorOf(l);
      ctx.globalAlpha = Math.max(0.15, 0.9 - r / rMax);
      ctx.lineWidth = 2 * d.px;
      ctx.beginPath();
      ctx.arc(X(sm.x), Y(0), k * r, a0, a1);
      ctx.stroke();
    }
  }
  ctx.globalAlpha = 1;
  ctx.restore();

  // nave (cor própria) e seta de velocidade
  const sm = shipMotion(b, t);
  const dir = Math.sign(sm.v);
  const nx = X(sm.x);
  const ny = Y(0);
  d.polyline(
    [
      [nx + dir * 0.7, ny],
      [nx - dir * 0.5, ny + 0.32],
      [nx - dir * 0.35, ny],
      [nx - dir * 0.5, ny - 0.32],
    ],
    { close: true, fill: colorOf(l0), color: "#ffffff", width: 1 },
  );
  d.arrowPx(nx, ny - 0.6, dir, 0, 20 + 40 * b, { color: "#ffffff", width: 1.5 });
  d.text(`v = ${fmt(b, 2)}c`, nx, ny - 0.95, { color: "#ffffff", size: 10 });

  // observadores: cada um vê a nave com a cor Doppler
  for (const xo of [-OBS, OBS]) {
    const l = observedLambda(b, l0, xo, t);
    const ox = X(xo);
    d.circle(ox, ny, 0.32, { fill: colorOf(l), stroke: "#ffffff", width: 1.5 });
    const approaching = l < l0;
    d.text(`vê λ = ${fmt(l, 4)} nm`, ox, ny + 0.75, { color: "#ffffff", size: 11, weight: "600", align: xo < 0 ? "left" : "right", dx: xo < 0 ? -10 : 10 });
    d.text(approaching ? "aproximando: desvio para o azul" : "afastando: desvio para o vermelho", ox, ny - 0.75, {
      color: "#ffffff",
      size: 10,
      align: xo < 0 ? "left" : "right",
      dx: xo < 0 ? -10 : 10,
    });
  }
  d.text(`Frentes de onda coloridas pelo λ medido em cada direção · cor própria da nave λ₀ = ${fmt(l0, 4)} nm`, F.x0 + 0.2, F.y1 - 0.35, {
    color: "#ffffff",
    size: 10,
    align: "left",
  });

  // gráfico λ/λ₀ × β
  const P = panel(d, { x0: 1.3, y0: 0.8, x1: 9.4, y1: 4.2 }, { min: -0.95, max: 0.95 }, { min: 0, max: 4 });
  P.frame({ xlabel: "β de afastamento", ylabel: "λ/λ₀" });
  P.plot((x) => Math.sqrt((1 + x) / (1 - x)), -0.95, 0.95, { color: theme.accent, width: 2 });
  P.plot((x) => 1 + x, -0.95, 0.95, { color: theme.muted, width: 1.5, dash: [6, 4] });
  for (const xo of [-OBS, OBS]) {
    const l = observedLambda(b, l0, xo, t);
    const rr = Math.log(l / l0);
    const beta = Math.tanh(rr); // inverte λ/λ₀ = e^{rapidez}
    d.dot(P.X(beta), P.Y(l / l0), 5, colorOf(l));
  }
  d.text("relativístico √((1+β)/(1−β))", P.X(-0.9), P.Y(3.6), { color: theme.accent, size: 10, align: "left" });
  d.text("clássico 1 + β", P.X(-0.9), P.Y(3.1), { color: theme.muted, size: 10, align: "left" });

  // espectro visível com as três cores
  const S = { x0: 11.0, x1: 19.4, y0: 2.6, y1: 3.4 };
  const lx = (l: number) => S.x0 + ((l - 300) / (900 - 300)) * (S.x1 - S.x0);
  for (let l = 300; l < 900; l += 5) d.rect(lx(l), S.y0, lx(l + 5) - lx(l), S.y1 - S.y0, { fill: wavelengthColor(l + 2.5, theme.dark ? "#111" : "#333") });
  d.rect(S.x0, S.y0, S.x1 - S.x0, S.y1 - S.y0, { stroke: theme.muted, width: 1 });
  for (const l of [300, 400, 500, 600, 700, 800, 900]) d.text(fmt(l), lx(l), S.y0, { color: theme.muted, size: 9, dy: 9 });
  d.text("λ (nm)", S.x1, S.y0, { color: theme.muted, size: 10, align: "right", dy: 22 });
  const mark = (l: number, lab: string, up: boolean) => {
    const x = lx(clamp(l, 300, 900));
    d.line(x, S.y0 - 0.1, x, S.y1 + 0.1, { color: theme.text, width: 2 });
    d.text(lab, x, up ? S.y1 + 0.35 : S.y0 - 0.65, { size: 10, weight: "600" });
  };
  const lR = dopplerLambda(l0, b);
  const lB = dopplerLambda(l0, -b);
  mark(l0, "λ₀", true);
  mark(lB, `aproxima ${fmt(lB, 3)}`, false);
  mark(lR, `afasta ${fmt(lR, 3)}`, false);
  d.text(`γ = ${fmt(gammaOf(b), 4)} · aproximando: ${bandName(lB)} · afastando: ${bandName(lR)}`, S.x0, 4.3, { size: 11, align: "left" });
  d.text(`tempo próprio da nave: τ = t/γ = ${fmt(s.tauP, 3)} s (t = ${fmt(t, 3)} s)`, S.x0, 3.85, { size: 10, align: "left", color: theme.muted });
}

// ---------------- modo 2 ----------------

function renderEnergy(d: Draw, theme: Theme, s: RDState, p: Params) {
  const q = particle(p);
  const mc2 = q.mc2;
  const F = force(p);
  const E = energy(s.pc, mc2);
  const rel = theme.accent;
  const cla = theme.series[1]!;
  const light = theme.series[5]!;

  // pista: luz, partícula relativística e clássica, com a luz partindo junto
  const L = T_LAB;
  const tx = (x: number) => 1 + (17.6 * x) / L;
  d.line(tx(0), 10.6, tx(L), 10.6, { color: theme.muted, width: 1 });
  for (let x = 0; x <= L; x += 5) d.text(`${fmt(x * C_M_PER_NS, 3)} m`, tx(x), 10.6, { color: theme.muted, size: 9, dy: 10 });
  const lane = (x: number, y: number, col: string, lab: string) => {
    const over = x > L * 1.02;
    const xd = Math.min(x, L * 1.02);
    d.dot(tx(xd), y, 6, col);
    d.text(over ? `${lab} (passou da luz!)` : lab, tx(xd), y, { color: col, size: 10, align: "right", dx: -10 });
  };
  lane(Math.min(s.T, L), 11.6, light, "luz");
  lane(s.xr, 11.25, rel, "relativística");
  lane(s.xc, 10.9, cla, "clássica");

  // E × pc
  const pMax = Math.max(F * T_LAB, 0.5 * mc2) * 1.05;
  const eMax = energy(pMax, mc2) * 1.08;
  const P1 = panel(d, { x0: 1.4, y0: 5.4, x1: 9.4, y1: 9.3 }, { min: 0, max: pMax }, { min: 0, max: eMax });
  P1.frame({ xlabel: "pc (MeV)", ylabel: "E (MeV)" });
  P1.plot((x) => energy(x, mc2), 0, pMax, { color: rel, width: 2 });
  P1.plot((x) => mc2 + kineticClassical(x, mc2), 0, pMax, { color: cla, width: 1.5, dash: [6, 4] });
  P1.plot((x) => x, 0, pMax, { color: light, width: 1, dash: [3, 3] });
  d.dot(P1.X(s.pc), P1.Y(E), 6, rel);
  if (P1.inside(s.pc, mc2 + kineticClassical(s.pc, mc2))) d.dot(P1.X(s.pc), P1.Y(mc2 + kineticClassical(s.pc, mc2)), 5, cla);
  d.text("E = √((pc)² + (mc²)²)", P1.box.x0 + 0.15, P1.box.y1 - 0.3, { color: rel, size: 10, align: "left" });
  d.text("clássico: mc² + p²/2m", P1.box.x0 + 0.15, P1.box.y1 - 0.7, { color: cla, size: 10, align: "left" });
  d.text("E = pc (luz)", P1.box.x0 + 0.15, P1.box.y1 - 1.1, { color: light, size: 10, align: "left" });

  // v/c × t
  const P2 = panel(d, { x0: 1.4, y0: 0.8, x1: 9.4, y1: 4.1 }, { min: 0, max: T_LAB }, { min: 0, max: 1.6 });
  P2.frame({ xlabel: "t (ns)", ylabel: "v/c" });
  P2.line(
    [
      [0, 1],
      [T_LAB, 1],
    ],
    { color: light, width: 1.5, dash: [5, 4] },
  );
  // curvas para a força atual (p = F t a partir do momento atual, como guia)
  P2.plot((t) => betaFromP(F * t, mc2), 0, T_LAB, { color: rel, width: 2, alpha: 0.35 });
  P2.plot((t) => (F * t) / mc2, 0, T_LAB, { color: cla, width: 1.5, dash: [6, 4], alpha: 0.35 });
  d.dot(P2.X(Math.min(s.T, T_LAB)), P2.Y(betaFromP(s.pc, mc2)), 6, rel);
  if (P2.inside(s.T, s.pc / mc2)) d.dot(P2.X(s.T), P2.Y(s.pc / mc2), 5, cla);
  d.text("c", P2.box.x1, P2.Y(1), { color: light, size: 11, weight: "600", align: "left", dx: 4 });

  // triângulo E² = (pc)² + (mc²)²
  const big = Math.max(s.pc, mc2);
  const sc = 3.6 / big;
  const ox = 11.2;
  const oy = 5.6;
  const a = s.pc * sc;
  const h = mc2 * sc;
  d.polyline(
    [
      [ox, oy],
      [ox + a, oy],
      [ox + a, oy + h],
      [ox, oy],
    ],
    { close: true, fill: theme.grid, color: theme.muted, width: 1 },
  );
  d.line(ox, oy, ox + a, oy, { color: theme.series[2]!, width: 3 });
  d.line(ox + a, oy, ox + a, oy + h, { color: theme.series[3]!, width: 3 });
  d.line(ox, oy, ox + a, oy + h, { color: rel, width: 3 });
  d.text(`pc = ${fmt(s.pc, 4)} MeV`, ox + a / 2, oy, { color: theme.series[2]!, size: 10, dy: 10 });
  d.text(`mc² = ${fmt(mc2, 4)} MeV`, ox + a, oy + h / 2, { color: theme.series[3]!, size: 10, align: "left", dx: 6 });
  d.text(`E = ${fmt(E, 4)} MeV`, ox + a / 2, oy + h / 2, { color: rel, size: 10, weight: "600", align: "right", dx: -8, dy: -6 });
  d.text("E² = (pc)² + (mc²)²", 11.2, 9.6, { size: 12, weight: "600", align: "left" });

  // tabela de comparação
  let y = 4.4;
  const row = (label: string, r: string, c: string) => {
    d.text(label, 11.0, y, { size: 10, align: "left" });
    d.text(r, 15.6, y, { size: 10, align: "left", color: rel });
    d.text(c, 18.0, y, { size: 10, align: "left", color: cla });
    y -= 0.45;
  };
  d.text(`${q.name}: t = ${fmt(s.T, 3)} ns, F = ${fmt(F, 3)} MeV/c por ns`, 11.0, 4.95, { size: 11, weight: "600", align: "left" });
  row("", "relativística", "clássica");
  row("v/c", fmt(betaFromP(s.pc, mc2), 5), fmt(s.pc / mc2, 4));
  row("K (MeV)", fmt(kinetic(s.pc, mc2), 4), fmt(kineticClassical(s.pc, mc2), 4));
  row("distância (m)", fmt(s.xr * C_M_PER_NS, 4), fmt(s.xc * C_M_PER_NS, 4));
  row("γ = E/mc²", fmt(E / mc2, 4), "1");
  row("tempo próprio (ns)", fmt(s.tauP, 4), fmt(s.T, 4));
  y -= 0.1;
  d.text(`Trabalho F·x = ${fmt(F * s.xr, 4)} MeV = K (teorema trabalho-energia).`, 11.0, y, { size: 10, align: "left", color: theme.muted });
}

export default relatividadeDinamica;
