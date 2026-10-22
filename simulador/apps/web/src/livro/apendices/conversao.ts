/**
 * Apêndice D: fatores de conversão. Cada unidade guarda quanto vale em unidades do SI;
 * a conversão de a para b é valor × a.si / b.si. Temperatura é afim e tem tratamento próprio.
 * Os fatores marcados como exatos o são por definição (polegada, libra, caloria, atm...).
 */
export interface Unidade {
  id: string;
  nome: string;
  simbolo: string;
  /** Valor de 1 unidade em unidades do SI da grandeza. */
  si: number;
  exata?: boolean;
}

export interface Grandeza {
  id: string;
  nome: string;
  /** Símbolo da unidade do SI. */
  unidadeSI: string;
  unidades: Unidade[];
}

const PI = Math.PI;
const LBF = 4.4482216152605; // 0,45359237 kg × 9,80665 m/s²
const ATM = 101325;
const EV = 1.602176634e-19;
const C = 299792458;
const ANO_JULIANO = 365.25 * 86400;

export const grandezas: Grandeza[] = [
  {
    id: "comprimento",
    nome: "Comprimento",
    unidadeSI: "m",
    unidades: [
      { id: "m", nome: "metro", simbolo: "m", si: 1, exata: true },
      { id: "km", nome: "quilômetro", simbolo: "km", si: 1000, exata: true },
      { id: "cm", nome: "centímetro", simbolo: "cm", si: 0.01, exata: true },
      { id: "mm", nome: "milímetro", simbolo: "mm", si: 1e-3, exata: true },
      { id: "um", nome: "micrômetro", simbolo: "µm", si: 1e-6, exata: true },
      { id: "nm", nome: "nanômetro", simbolo: "nm", si: 1e-9, exata: true },
      { id: "A", nome: "ångström", simbolo: "Å", si: 1e-10, exata: true },
      { id: "fm", nome: "fermi (femtômetro)", simbolo: "fm", si: 1e-15, exata: true },
      { id: "in", nome: "polegada", simbolo: "in", si: 0.0254, exata: true },
      { id: "ft", nome: "pé", simbolo: "ft", si: 0.3048, exata: true },
      { id: "yd", nome: "jarda", simbolo: "yd", si: 0.9144, exata: true },
      { id: "mi", nome: "milha terrestre", simbolo: "mi", si: 1609.344, exata: true },
      { id: "nmi", nome: "milha náutica", simbolo: "M", si: 1852, exata: true },
      { id: "ua", nome: "unidade astronômica", simbolo: "ua", si: 1.495978707e11, exata: true },
      { id: "al", nome: "ano-luz", simbolo: "al", si: C * ANO_JULIANO, exata: true },
      { id: "pc", nome: "parsec", simbolo: "pc", si: (1.495978707e11 * 648000) / PI, exata: true },
    ],
  },
  {
    id: "area",
    nome: "Área",
    unidadeSI: "m²",
    unidades: [
      { id: "m2", nome: "metro quadrado", simbolo: "m²", si: 1, exata: true },
      { id: "cm2", nome: "centímetro quadrado", simbolo: "cm²", si: 1e-4, exata: true },
      { id: "km2", nome: "quilômetro quadrado", simbolo: "km²", si: 1e6, exata: true },
      { id: "ha", nome: "hectare", simbolo: "ha", si: 1e4, exata: true },
      { id: "in2", nome: "polegada quadrada", simbolo: "in²", si: 0.0254 ** 2, exata: true },
      { id: "ft2", nome: "pé quadrado", simbolo: "ft²", si: 0.3048 ** 2, exata: true },
      { id: "b", nome: "barn", simbolo: "b", si: 1e-28, exata: true },
    ],
  },
  {
    id: "volume",
    nome: "Volume",
    unidadeSI: "m³",
    unidades: [
      { id: "m3", nome: "metro cúbico", simbolo: "m³", si: 1, exata: true },
      { id: "L", nome: "litro", simbolo: "L", si: 1e-3, exata: true },
      { id: "mL", nome: "mililitro", simbolo: "mL", si: 1e-6, exata: true },
      { id: "cm3", nome: "centímetro cúbico", simbolo: "cm³", si: 1e-6, exata: true },
      { id: "in3", nome: "polegada cúbica", simbolo: "in³", si: 0.0254 ** 3, exata: true },
      { id: "ft3", nome: "pé cúbico", simbolo: "ft³", si: 0.3048 ** 3, exata: true },
      { id: "gal", nome: "galão americano", simbolo: "gal", si: 3.785411784e-3, exata: true },
    ],
  },
  {
    id: "massa",
    nome: "Massa",
    unidadeSI: "kg",
    unidades: [
      { id: "kg", nome: "quilograma", simbolo: "kg", si: 1, exata: true },
      { id: "g", nome: "grama", simbolo: "g", si: 1e-3, exata: true },
      { id: "t", nome: "tonelada", simbolo: "t", si: 1000, exata: true },
      { id: "lb", nome: "libra (massa)", simbolo: "lb", si: 0.45359237, exata: true },
      { id: "oz", nome: "onça", simbolo: "oz", si: 0.45359237 / 16, exata: true },
      { id: "slug", nome: "slug", simbolo: "slug", si: LBF / 0.3048 },
      { id: "u", nome: "unidade de massa atômica", simbolo: "u", si: 1.6605390666e-27 },
    ],
  },
  {
    id: "tempo",
    nome: "Tempo",
    unidadeSI: "s",
    unidades: [
      { id: "s", nome: "segundo", simbolo: "s", si: 1, exata: true },
      { id: "min", nome: "minuto", simbolo: "min", si: 60, exata: true },
      { id: "h", nome: "hora", simbolo: "h", si: 3600, exata: true },
      { id: "d", nome: "dia", simbolo: "d", si: 86400, exata: true },
      { id: "a", nome: "ano (juliano, 365,25 d)", simbolo: "a", si: ANO_JULIANO, exata: true },
    ],
  },
  {
    id: "velocidade",
    nome: "Velocidade",
    unidadeSI: "m/s",
    unidades: [
      { id: "ms", nome: "metro por segundo", simbolo: "m/s", si: 1, exata: true },
      { id: "kmh", nome: "quilômetro por hora", simbolo: "km/h", si: 1 / 3.6, exata: true },
      { id: "mph", nome: "milha por hora", simbolo: "mi/h", si: 0.44704, exata: true },
      { id: "fts", nome: "pé por segundo", simbolo: "ft/s", si: 0.3048, exata: true },
      { id: "no", nome: "nó", simbolo: "nó", si: 1852 / 3600, exata: true },
      { id: "c", nome: "velocidade da luz", simbolo: "c", si: C, exata: true },
    ],
  },
  {
    id: "forca",
    nome: "Força",
    unidadeSI: "N",
    unidades: [
      { id: "N", nome: "newton", simbolo: "N", si: 1, exata: true },
      { id: "dyn", nome: "dina", simbolo: "dyn", si: 1e-5, exata: true },
      { id: "kgf", nome: "quilograma-força", simbolo: "kgf", si: 9.80665, exata: true },
      { id: "lbf", nome: "libra-força", simbolo: "lbf", si: LBF, exata: true },
    ],
  },
  {
    id: "pressao",
    nome: "Pressão",
    unidadeSI: "Pa",
    unidades: [
      { id: "Pa", nome: "pascal", simbolo: "Pa", si: 1, exata: true },
      { id: "kPa", nome: "quilopascal", simbolo: "kPa", si: 1000, exata: true },
      { id: "bar", nome: "bar", simbolo: "bar", si: 1e5, exata: true },
      { id: "atm", nome: "atmosfera", simbolo: "atm", si: ATM, exata: true },
      { id: "torr", nome: "torr", simbolo: "torr", si: ATM / 760, exata: true },
      { id: "mmHg", nome: "milímetro de mercúrio", simbolo: "mmHg", si: 133.322387415, exata: true },
      { id: "psi", nome: "libra-força por polegada quadrada", simbolo: "lbf/in²", si: LBF / 0.0254 ** 2, exata: true },
    ],
  },
  {
    id: "energia",
    nome: "Energia",
    unidadeSI: "J",
    unidades: [
      { id: "J", nome: "joule", simbolo: "J", si: 1, exata: true },
      { id: "kJ", nome: "quilojoule", simbolo: "kJ", si: 1000, exata: true },
      { id: "erg", nome: "erg", simbolo: "erg", si: 1e-7, exata: true },
      { id: "cal", nome: "caloria (termoquímica)", simbolo: "cal", si: 4.184, exata: true },
      { id: "kcal", nome: "quilocaloria", simbolo: "kcal", si: 4184, exata: true },
      { id: "Btu", nome: "Btu (tabela internacional)", simbolo: "Btu", si: 1055.05585262, exata: true },
      { id: "kWh", nome: "quilowatt-hora", simbolo: "kWh", si: 3.6e6, exata: true },
      { id: "eV", nome: "elétron-volt", simbolo: "eV", si: EV, exata: true },
      { id: "MeV", nome: "megaelétron-volt", simbolo: "MeV", si: EV * 1e6, exata: true },
      { id: "ftlbf", nome: "pé-libra", simbolo: "ft·lbf", si: 0.3048 * LBF, exata: true },
    ],
  },
  {
    id: "potencia",
    nome: "Potência",
    unidadeSI: "W",
    unidades: [
      { id: "W", nome: "watt", simbolo: "W", si: 1, exata: true },
      { id: "kW", nome: "quilowatt", simbolo: "kW", si: 1000, exata: true },
      { id: "hp", nome: "horsepower (mecânico)", simbolo: "hp", si: 550 * 0.3048 * LBF, exata: true },
      { id: "cv", nome: "cavalo-vapor", simbolo: "cv", si: 75 * 9.80665, exata: true },
      { id: "Btuh", nome: "Btu por hora", simbolo: "Btu/h", si: 1055.05585262 / 3600, exata: true },
    ],
  },
  {
    id: "angulo",
    nome: "Ângulo",
    unidadeSI: "rad",
    unidades: [
      { id: "rad", nome: "radiano", simbolo: "rad", si: 1, exata: true },
      { id: "grau", nome: "grau", simbolo: "°", si: PI / 180, exata: true },
      { id: "arcmin", nome: "minuto de arco", simbolo: "′", si: PI / 10800, exata: true },
      { id: "arcsec", nome: "segundo de arco", simbolo: "″", si: PI / 648000, exata: true },
      { id: "rev", nome: "revolução", simbolo: "rev", si: 2 * PI, exata: true },
    ],
  },
  {
    id: "campo-magnetico",
    nome: "Campo magnético",
    unidadeSI: "T",
    unidades: [
      { id: "T", nome: "tesla", simbolo: "T", si: 1, exata: true },
      { id: "mT", nome: "militesla", simbolo: "mT", si: 1e-3, exata: true },
      { id: "G", nome: "gauss", simbolo: "G", si: 1e-4, exata: true },
    ],
  },
  {
    id: "temperatura",
    nome: "Temperatura",
    unidadeSI: "K",
    unidades: [
      { id: "K", nome: "kelvin", simbolo: "K", si: 1, exata: true },
      { id: "C", nome: "grau Celsius", simbolo: "°C", si: 1, exata: true },
      { id: "F", nome: "grau Fahrenheit", simbolo: "°F", si: 5 / 9, exata: true },
    ],
  },
];

export const findGrandeza = (id: string) => grandezas.find((g) => g.id === id);

function toKelvin(v: number, u: string): number {
  if (u === "C") return v + 273.15;
  if (u === "F") return ((v - 32) * 5) / 9 + 273.15;
  return v;
}

function fromKelvin(k: number, u: string): number {
  if (u === "C") return k - 273.15;
  if (u === "F") return ((k - 273.15) * 9) / 5 + 32;
  return k;
}

/** Converte `valor` da unidade `de` para a unidade `para` dentro da grandeza. */
export function converter(grandeza: string, valor: number, de: string, para: string): number {
  if (grandeza === "temperatura") return fromKelvin(toKelvin(valor, de), para);
  const g = findGrandeza(grandeza);
  const a = g?.unidades.find((u) => u.id === de);
  const b = g?.unidades.find((u) => u.id === para);
  if (!a || !b) return NaN;
  return (valor * a.si) / b.si;
}

/** Formata com vírgula decimal e notação científica para números muito grandes ou pequenos. */
export function formatarNumero(v: number, sig = 6): string {
  if (!Number.isFinite(v)) return "—";
  if (v === 0) return "0";
  const a = Math.abs(v);
  if (a >= 1e-3 && a < 1e7) {
    return Number(v.toPrecision(sig)).toLocaleString("pt-BR", { maximumFractionDigits: 12, useGrouping: false });
  }
  const exp = Math.floor(Math.log10(a));
  let mant = Number((v / 10 ** exp).toPrecision(sig));
  let e = exp;
  if (Math.abs(mant) >= 10) {
    mant /= 10;
    e += 1;
  }
  return `${mant.toLocaleString("pt-BR", { maximumFractionDigits: sig, useGrouping: false })} × 10^${e}`;
}
