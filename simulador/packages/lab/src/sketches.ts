// Sketches de Arduino prontos para copiar. Todos imprimem num formato que o DataParser entende.

/** Coeficientes de Steinhart–Hart típicos de um NTC de 10 kΩ (β ≈ 3950). */
export const NTC_COEFFS = { A: 1.009249522e-3, B: 2.378405444e-4, C: 2.019202697e-7 };

/** Temperatura absoluta (K) de um NTC pela equação de Steinhart–Hart: 1/T = A + B ln R + C (ln R)³. */
export function steinhartHart(R: number, k = NTC_COEFFS): number {
  const L = Math.log(R);
  return 1 / (k.A + k.B * L + k.C * L ** 3);
}

export interface Sketch {
  id: string;
  title: string;
  materials: string[];
  wiring: string;
  /** Explicação das conversões feitas no código (parágrafos). */
  conversions: string[];
  format: string;
  code: string;
  /** Exemplo do que aparece no Monitor Serial. */
  sampleOutput: string;
}

export const sketches: Sketch[] = [
  {
    id: "hcsr04",
    title: "Distância com ultrassônico HC-SR04",
    materials: ["Arduino Uno ou Nano", "sensor HC-SR04", "4 jumpers"],
    wiring: "VCC → 5V, GND → GND, TRIG → pino 9, ECHO → pino 10.",
    conversions: [
      "O sensor emite um pulso de ultrassom e o pino ECHO fica em nível alto pelo tempo de ida e volta do som; pulseIn mede esse tempo em microssegundos.",
      "Distância = v_som · Δt / 2. Com v_som ≈ 343 m/s (ar a 20 °C) = 0,0343 cm/µs, d (cm) = Δt (µs) · 0,0343 / 2 ≈ Δt / 58,3.",
      "A velocidade do som depende da temperatura: v ≈ 331,3 + 0,606·T (°C) m/s. Em dias quentes, corrija a constante para reduzir o erro sistemático.",
      "O tempo é registrado com millis() no instante do disparo, e a amostragem é fixa (50 ms) para a derivada numérica ficar limpa.",
    ],
    format: "CSV com cabeçalho: t_ms,dist_cm",
    code: String.raw`// FisiLab: distância com HC-SR04 (formato CSV: t_ms,dist_cm)
const int TRIG = 9;
const int ECHO = 10;
const unsigned long PERIODO_MS = 50;   // 20 amostras por segundo
const float CM_POR_US = 0.0343;        // velocidade do som a 20 °C, em cm/µs

void setup() {
  Serial.begin(115200);
  pinMode(TRIG, OUTPUT);
  pinMode(ECHO, INPUT);
  Serial.println("t_ms,dist_cm");      // cabeçalho
}

void loop() {
  static unsigned long ultimo = 0;
  if (millis() - ultimo < PERIODO_MS) return;
  ultimo += PERIODO_MS;

  unsigned long t = millis();
  digitalWrite(TRIG, LOW);
  delayMicroseconds(2);
  digitalWrite(TRIG, HIGH);            // pulso de 10 µs dispara a medida
  delayMicroseconds(10);
  digitalWrite(TRIG, LOW);

  // tempo de ida e volta do eco; 0 se nada voltar em 30 ms (> ~5 m)
  unsigned long ida_volta_us = pulseIn(ECHO, HIGH, 30000UL);
  if (ida_volta_us == 0) return;

  float dist_cm = ida_volta_us * CM_POR_US / 2.0;
  Serial.print(t);
  Serial.print(',');
  Serial.println(dist_cm, 2);
}
`,
    sampleOutput: "t_ms,dist_cm\n1000,20.03\n1050,20.11\n1100,20.42\n1150,20.98\n",
  },
  {
    id: "ntc",
    title: "Temperatura com termistor NTC (Steinhart–Hart)",
    materials: ["Arduino Uno ou Nano", "termistor NTC 10 kΩ", "resistor 10 kΩ", "jumpers"],
    wiring: "5V → resistor de 10 kΩ → A0 → NTC → GND (o NTC fica entre A0 e o GND).",
    conversions: [
      "O divisor de tensão dá V_A0 = 5 V · R_NTC / (R_NTC + 10 kΩ). Como o conversor tem 10 bits, adc = 1023 · V_A0 / 5 V, logo R_NTC = 10 kΩ · adc / (1023 − adc).",
      "A equação de Steinhart–Hart relaciona resistência e temperatura absoluta: 1/T = A + B·ln R + C·(ln R)³. Os coeficientes A, B e C do código valem para NTCs comuns de 10 kΩ; para mais exatidão, calibre com três temperaturas conhecidas (gelo fundente, ambiente e água fervente) e resolva o sistema.",
      "A média de 8 leituras do ADC reduz o ruído. A resolução em temperatura perto de 25 °C é de cerca de 0,1 °C por passo do ADC.",
    ],
    format: "chave: valor — t (s), R (ohm), T (°C)",
    code: String.raw`// FisiLab: temperatura com NTC 10k (formato "chave: valor")
// Ligação: 5V — resistor 10k — A0 — NTC — GND
const float R_FIXO = 10000.0;
const float A = 1.009249522e-3;  // coeficientes de Steinhart–Hart
const float B = 2.378405444e-4;
const float C = 2.019202697e-7;

void setup() {
  Serial.begin(115200);
  Serial.println("Termistor NTC 10k - Steinhart-Hart");
}

void loop() {
  long soma = 0;
  for (int i = 0; i < 8; i++) soma += analogRead(A0);   // média de 8 leituras
  float adc = soma / 8.0;
  if (adc < 1 || adc > 1022) return;                  // fio solto ou curto

  float R = R_FIXO * adc / (1023.0 - adc);            // resistência do NTC (ohm)
  float L = log(R);
  float T_K = 1.0 / (A + B * L + C * L * L * L);      // Steinhart–Hart, em kelvin

  Serial.print("t: ");
  Serial.print(millis() / 1000.0, 2);
  Serial.print(" s, R: ");
  Serial.print(R, 0);
  Serial.print(" ohm, T: ");
  Serial.print(T_K - 273.15, 2);
  Serial.println(" C");
  delay(200);
}
`,
    sampleOutput: "Termistor NTC 10k - Steinhart-Hart\nt: 0.20 s, R: 2918 ohm, T: 53.61 C\nt: 0.40 s, R: 2925 ohm, T: 53.55 C\n",
  },
  {
    id: "ldr",
    title: "Luminosidade com LDR",
    materials: ["Arduino Uno ou Nano", "LDR (fotorresistor)", "resistor 10 kΩ", "jumpers"],
    wiring: "5V → LDR → A0 → resistor de 10 kΩ → GND.",
    conversions: [
      "Com o LDR em cima, V_A0 = 5 V · 10 kΩ / (10 kΩ + R_LDR); com mais luz, R_LDR cai e a leitura sobe. Invertendo: R_LDR = 10 kΩ · (1023 − adc) / adc.",
      "A resistência de um LDR segue aproximadamente R ∝ E^(−γ), com γ entre 0,6 e 0,9 (E = iluminância). Converter para lux exige calibrar com um luxímetro; para medir tempos (passagem de uma sombra, período de um pêndulo), o valor bruto basta.",
      "A amostragem rápida (20 ms) permite ver a passagem do pêndulo: o período é o tempo entre uma sombra e a segunda seguinte.",
    ],
    format: "TSV (tabulação) com cabeçalho: t_ms, adc, R_kohm",
    code: String.raw`// FisiLab: LDR em divisor de tensão (formato TSV: t_ms  adc  R_kohm)
// Ligação: 5V — LDR — A0 — resistor 10k — GND
const unsigned long PERIODO_MS = 20;   // 50 amostras por segundo

void setup() {
  Serial.begin(115200);
  Serial.println("t_ms\tadc\tR_kohm");
}

void loop() {
  static unsigned long ultimo = 0;
  if (millis() - ultimo < PERIODO_MS) return;
  ultimo += PERIODO_MS;

  int adc = analogRead(A0);
  float R_kohm = adc > 0 ? 10.0 * (1023 - adc) / adc : -1;   // -1: escuro total

  Serial.print(ultimo);
  Serial.print('\t');
  Serial.print(adc);
  Serial.print('\t');
  Serial.println(R_kohm, 2);
}
`,
    sampleOutput: "t_ms\tadc\tR_kohm\n20\t818\t2.51\n40\t821\t2.46\n60\t640\t5.98\n",
  },
  {
    id: "rc",
    title: "Carga e descarga de capacitor (circuito RC)",
    materials: ["Arduino Uno ou Nano", "resistor 100 kΩ", "capacitor eletrolítico 10 µF", "jumpers"],
    wiring: "Pino 7 → resistor de 100 kΩ → A0 e terminal + do capacitor; terminal − do capacitor → GND.",
    conversions: [
      "O pino 7 alterna entre 0 V (1 s, descarga) e 5 V (5 s, carga). A tensão no capacitor é lida em A0: Vc = adc · 5 V / 1023.",
      "Na carga, Vc(t) = 5 V · (1 − e^(−t/τ)); na descarga, Vc(t) = V₀ · e^(−t/τ), com τ = R·C = 100 kΩ · 10 µF = 1,0 s.",
      "Use o ajuste \"exponencial com assíntota\" num trecho de carga ou de descarga para obter τ e compare com R·C (lembre da tolerância de ±20% dos eletrolíticos).",
    ],
    format: "CSV com cabeçalho: t_ms,Vc",
    code: String.raw`// FisiLab: carga e descarga de capacitor (formato CSV: t_ms,Vc)
// Ligação: pino 7 — R 100k — A0 e (+) do capacitor 10 µF; (−) no GND
const int PINO_CARGA = 7;
const unsigned long PERIODO_MS = 50;

void setup() {
  Serial.begin(115200);
  pinMode(PINO_CARGA, OUTPUT);
  digitalWrite(PINO_CARGA, LOW);
  delay(2000);                         // começa descarregado
  Serial.println("t_ms,Vc");
}

void loop() {
  static unsigned long t0 = millis();
  static unsigned long ultimo = 0;
  unsigned long t = millis() - t0;

  // ciclo de 6 s: 1 s descarregando (0 V), 5 s carregando (5 V)
  digitalWrite(PINO_CARGA, (t % 6000) < 1000 ? LOW : HIGH);

  if (t - ultimo < PERIODO_MS) return;
  ultimo = t;
  float Vc = analogRead(A0) * 5.0 / 1023.0;
  Serial.print(t);
  Serial.print(',');
  Serial.println(Vc, 3);
}
`,
    sampleOutput: "t_ms,Vc\n0,0.034\n50,0.029\n1050,0.244\n1100,0.479\n",
  },
];
