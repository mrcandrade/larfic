import { num, type Params } from "@fisilab/core";

// ------------------------------------------------------------------ constantes

export const G = 9.81;
export const RHO_AGUA = 1000;
export const C_AGUA = 4186;
export const L_V = 2_256_000;

/** Painel solar: área (m²) e rendimento. */
export const PAINEL = { A: 1.6, eta: 0.2 };
/** Queda d'água: altura (m) e rendimento turbina + gerador. */
export const QUEDA = { h: 5, eta: 0.8 };
/** Ciclista: rendimento muscular (química → mecânica) e do dínamo. */
export const CICLISTA = { etaCorpo: 0.25, etaDinamo: 0.75 };
/** Chaleira: massa de água, rendimento da chama → água e da turbina a vapor + gerador. */
export const CHALEIRA = { m: 0.2, etaChama: 0.7, etaTurbina: 0.12, T0: 20 };
/** Béquer do aquecedor elétrico (usuário). */
export const BEQUER = { m: 0.5, T0: 20 };

export const FONTES = [
  { value: 0, label: "Sol → painel fotovoltaico" },
  { value: 1, label: "Queda d'água → turbina e gerador" },
  { value: 2, label: "Ciclista → dínamo" },
  { value: 3, label: "Chaleira no fogo → turbina a vapor" },
];

/**
 * Usuários: fração da potência elétrica que vira a forma útil e
 * eficácia luminosa (lm por watt elétrico) das lâmpadas.
 */
export const USUARIOS = [
  { value: 0, label: "Lâmpada incandescente", util: 0.05, lmW: 15, forma: "luz" as const },
  { value: 1, label: "Lâmpada LED", util: 0.4, lmW: 100, forma: "luz" as const },
  { value: 2, label: "Ventilador (motor)", util: 0.7, lmW: 0, forma: "mecanica" as const },
  { value: 3, label: "Aquecedor de água", util: 1, lmW: 0, forma: "termica" as const },
];

/** Bulbos no modo de comparação: capacidade térmica (J/K) e condutância para o ar (W/K). */
export const BULBOS = [
  { C: 20, hA: 0.35 },
  { C: 30, hA: 0.25 },
];
export const T_AMB = 20;

export const MATERIAIS = [
  { nome: "Ferro", c: 450, liquido: false },
  { nome: "Tijolo", c: 840, liquido: false },
  { nome: "Água", c: C_AGUA, liquido: true },
  // O óleo não ferve aqui (ponto de fumaça ~230 °C): só a água muda de fase.
  { nome: "Óleo", c: 1970, liquido: true },
];

/** Condutâncias de contato (W/K): sólido mergulhado num líquido, sólido sobre sólido. */
export const G_IMERSO = 20;
export const G_EMPILHADO = 4;
/** Perdas para o ambiente de cada objeto quando ligadas (W/K). */
export const H_PERDA = 0.4;

// ------------------------------------------------------------------ estado

export interface Pacote {
  /** Índice da rota. */
  r: number;
  /** Posição ao longo da rota (0 → 1). */
  u: number;
  /** Forma de energia (índice em FORMAS). */
  k: number;
  /** Sentido: +1 do início ao fim da rota, −1 ao contrário. */
  dir: number;
}

export interface Bloco {
  /** Material (índice em MATERIAIS). */
  mat: number;
  m: number;
  T: number;
  /** Lugar: 0–3 bicos do fogão, 4–5 bancada (isolada). */
  slot: number;
  /** Índice do objeto que o contém ou sobre o qual está (−1: nenhum). */
  host: number;
  /** Posição enquanto é arrastado (NaN: no lugar). */
  dx: number;
  dy: number;
}

export interface FE {
  /** Temperatura (°C) e massa (kg) da água da chaleira. */
  Tk: number;
  mk: number;
  /** Temperatura da água no béquer do aquecedor. */
  Tb: number;
  /** Temperaturas dos bulbos (incandescente, LED). */
  Tl: [number, number];
  /** Energias acumuladas (J): entrada, elétrica, útil, térmica dissipada, armazenada. */
  Ein: number;
  Eel: number;
  Eut: number;
  Eth: number;
  Est: number;
  /** Ângulos de rotação (rodas, turbinas, ventilador). */
  phi: [number, number];
  /** Acumuladores de energia por rota, para emitir pacotes. */
  acc: number[];
  pk: Pacote[];
  blocos: Bloco[];
  /** Calor líquido fornecido pelos bicos (J) e perdido para o ambiente (J). */
  Q: number;
  Qamb: number;
  /** Energia gasta vaporizando água no modo blocos (J). */
  Evap: number;
  arr: number;
}

export const FORMAS = ["luz", "química", "mecânica", "elétrica", "térmica", "potencial"] as const;
export const F = { luz: 0, quimica: 1, mecanica: 2, eletrica: 3, termica: 4, potencial: 5 };

export const modo = (p: Params) => Math.round(num(p, "modo"));
export const fonte = (p: Params) => Math.round(num(p, "fonte"));
export const usuario = (p: Params) => Math.round(num(p, "usuario"));

// ------------------------------------------------------------------ cadeia

export interface Fluxos {
  /** Potência primária da fonte (W) e forma dela. */
  Pin: number;
  formaIn: number;
  /** Perda térmica antes do conversor (corpo do ciclista, chama). */
  PperdaFonte: number;
  /** Potência entregue ao conversor. */
  Pconv: number;
  /** Potência que fica armazenada (água da chaleira esquentando). */
  Parm: number;
  Pel: number;
  PperdaConv: number;
  Put: number;
  PperdaUs: number;
  /** Fluxo luminoso (lm), quando o usuário é lâmpada. */
  lm: number;
}

/** Potências instantâneas da cadeia fonte → conversor → usuário. */
export function fluxos(s: FE, p: Params): Fluxos {
  const f = fonte(p);
  let Pin = 0, formaIn = F.luz, PperdaFonte = 0, Pconv = 0, Parm = 0, Pel = 0;
  if (f === 0) {
    Pin = num(p, "irradiancia", 800) * PAINEL.A;
    formaIn = F.luz;
    Pconv = Pin;
    Pel = PAINEL.eta * Pin;
  } else if (f === 1) {
    Pin = RHO_AGUA * (num(p, "vazao", 10) / 1000) * G * QUEDA.h;
    formaIn = F.potencial;
    Pconv = Pin;
    Pel = QUEDA.eta * Pin;
  } else if (f === 2) {
    const Pmec = num(p, "pedal", 150);
    Pin = Pmec / CICLISTA.etaCorpo;
    formaIn = F.quimica;
    PperdaFonte = Pin - Pmec;
    Pconv = Pmec;
    Pel = CICLISTA.etaDinamo * Pmec;
  } else {
    Pin = num(p, "chama", 2000);
    formaIn = F.quimica;
    const Pagua = CHALEIRA.etaChama * Pin;
    PperdaFonte = Pin - Pagua;
    if (s.mk <= 1e-6) {
      PperdaFonte = Pin; // chaleira seca: tudo vira calor perdido
    } else if (s.Tk < 100) {
      Parm = Pagua; // esquentando a água: energia armazenada
    } else {
      Pconv = Pagua; // vapor movendo a turbina
      Pel = CHALEIRA.etaTurbina * Pagua;
    }
  }
  const PperdaConv = Pconv - Pel;
  const u = USUARIOS[usuario(p)] ?? USUARIOS[0]!;
  const Put = u.util * Pel;
  return { Pin, formaIn, PperdaFonte, Pconv, Parm, Pel, PperdaConv, Put, PperdaUs: Pel - Put, lm: u.lmW * Pel };
}

/** Comparação de lâmpadas: potência elétrica de cada uma (incandescente, LED). */
export function potLampadas(p: Params): [number, number] {
  const P = num(p, "Pel", 60);
  return Math.round(num(p, "comparar")) === 1 ? [P, (P * USUARIOS[0]!.lmW) / USUARIOS[1]!.lmW] : [P, P];
}

/** Temperatura de regime de um bulbo: T_amb + P_calor / hA. */
export const tBulboRegime = (i: number, Pel: number) => T_AMB + ((1 - USUARIOS[i]!.util) * Pel) / BULBOS[i]!.hA;

// ------------------------------------------------------------------ blocos

export const capacidade = (b: Bloco) => b.m * MATERIAIS[b.mat]!.c;

/** Raiz da pilha/recipiente: o objeto que está no bico ou na bancada. */
export function raiz(bs: Bloco[], i: number): number {
  let j = i;
  for (let n = 0; n < 6 && bs[j]!.host >= 0; n++) j = bs[j]!.host;
  return j;
}

export interface Contato {
  i: number;
  j: number;
  G: number;
}

export function contatos(bs: Bloco[]): Contato[] {
  const out: Contato[] = [];
  bs.forEach((b, i) => {
    if (b.host < 0) return;
    const h = bs[b.host]!;
    out.push({ i, j: b.host, G: MATERIAIS[h.mat]!.liquido ? G_IMERSO : G_EMPILHADO });
  });
  return out;
}

/** Potência que cada bico entrega ao objeto apoiado nele (W). O resfriador desliga abaixo de −20 °C. */
export function potBico(b: Bloco, p: Params): number {
  if (b.host >= 0 || b.slot > 3) return 0;
  const P = num(p, "calor", 0);
  if (P < 0 && b.T <= -20) return 0;
  return P;
}

/** Taxas dT/dt (K/s) e fluxos de calor por contato, para o passo e os pacotes. */
export function taxasBlocos(bs: Bloco[], p: Params) {
  const Pnet = bs.map((b) => potBico(b, p));
  const perdas = Math.round(num(p, "perdas")) === 1;
  const Pamb = bs.map((b) => (perdas ? H_PERDA * (b.T - T_AMB) : 0));
  const cs = contatos(bs).map((c) => ({ ...c, q: c.G * (bs[c.j]!.T - bs[c.i]!.T) }));
  for (const c of cs) {
    Pnet[c.i]! += c.q;
    Pnet[c.j]! -= c.q;
  }
  bs.forEach((_, i) => (Pnet[i]! -= Pamb[i]!));
  return { Pnet, Pamb, cs };
}

/** Avança os blocos: Euler com subpassos (energia trocada é antissimétrica, então se conserva exatamente). */
export function passoBlocos(s: FE, p: Params, dt: number): FE {
  const bs = s.blocos.map((b) => ({ ...b }));
  let Q = s.Q, Qamb = s.Qamb, Evap = s.Evap;
  const Cmin = Math.min(...bs.map(capacidade));
  const n = Math.max(1, Math.ceil(dt / (0.1 * Cmin / (G_IMERSO + H_PERDA))));
  const h = dt / n;
  for (let k = 0; k < n; k++) {
    const { Pnet, Pamb } = taxasBlocos(bs, p);
    bs.forEach((b, i) => {
      Q += potBico(b, p) * h;
      Qamb += Pamb[i]! * h;
      let E = Pnet[i]! * h;
      if (b.mat === 2 && b.T >= 100 && E > 0) {
        // água fervendo: o calor vaporiza em vez de esquentar
        const dm = Math.min(E / L_V, b.m - 0.01);
        b.m -= dm;
        Evap += dm * (L_V + C_AGUA * 100); // o vapor leva também o calor sensível
        E -= dm * L_V;
        b.T = 100;
      }
      b.T += E / capacidade(b);
    });
  }
  return { ...s, blocos: bs, Q, Qamb, Evap };
}

/** Energia interna dos blocos (J, referência 0 °C) mais a gasta vaporizando. */
export const energiaBlocos = (s: FE) => s.blocos.reduce((a, b) => a + capacidade(b) * b.T, 0) + s.Evap;

/** Temperatura de equilíbrio de objetos em contato, sem fontes nem perdas. */
export const tEquilibrio = (itens: { m: number; c: number; T: number }[]) =>
  itens.reduce((a, b) => a + b.m * b.c * b.T, 0) / itens.reduce((a, b) => a + b.m * b.c, 0);
