// Videoanálise: calibração (pixel ↔ metro), rastreamento por cor e por modelo,
// derivadas numéricas e uma cena sintética de lançamento oblíquo.
// Tudo opera sobre arrays puros (compatíveis com ImageData) para poder ser testado sem DOM.

export interface Vec2 {
  x: number;
  y: number;
}

/** Imagem RGBA no mesmo formato do ImageData do navegador. */
export interface RGBAImage {
  width: number;
  height: number;
  data: Uint8ClampedArray;
}

export function createImage(width: number, height: number): RGBAImage {
  return { width, height, data: new Uint8ClampedArray(width * height * 4) };
}

// ───────────────────────────── Calibração ─────────────────────────────

/**
 * Calibração do vídeo. Coordenadas de pixel seguem a imagem (x para a direita, y para baixo);
 * coordenadas do mundo seguem a física (x ao longo do eixo escolhido, y 90° no sentido anti-horário).
 */
export interface Calibration {
  /** Extremidades da régua de referência, em pixels. */
  rulerA: Vec2;
  rulerB: Vec2;
  /** Comprimento real da régua, em metros. */
  rulerLength: number;
  /** Origem dos eixos, em pixels. */
  origin: Vec2;
  /** Ângulo do eixo x em relação à horizontal da tela, em radianos (anti-horário, como visto na tela). */
  angle: number;
}

/** Metros por pixel. */
export function metersPerPixel(c: Calibration): number {
  const d = Math.hypot(c.rulerB.x - c.rulerA.x, c.rulerB.y - c.rulerA.y);
  if (!(d > 0) || !(c.rulerLength > 0)) return NaN;
  return c.rulerLength / d;
}

/** Vetores unitários dos eixos x e y do mundo, escritos em coordenadas de pixel. */
export function axisVectors(angle: number): { ex: Vec2; ey: Vec2 } {
  const ex = { x: Math.cos(angle), y: -Math.sin(angle) };
  return { ex, ey: { x: ex.y, y: -ex.x } };
}

/** Ponto em pixels → metros no sistema de eixos calibrado. */
export function pixelToWorld(c: Calibration, p: Vec2): Vec2 {
  const s = metersPerPixel(c);
  const { ex, ey } = axisVectors(c.angle);
  const dx = p.x - c.origin.x, dy = p.y - c.origin.y;
  return { x: s * (dx * ex.x + dy * ex.y), y: s * (dx * ey.x + dy * ey.y) };
}

/** Metros → pixels (inversa de pixelToWorld). */
export function worldToPixel(c: Calibration, w: Vec2): Vec2 {
  const s = metersPerPixel(c);
  const { ex, ey } = axisVectors(c.angle);
  return { x: c.origin.x + (w.x * ex.x + w.y * ey.x) / s, y: c.origin.y + (w.x * ex.y + w.y * ey.y) / s };
}

/** Ângulo do eixo x a partir da alça arrastada pelo aluno (ponto sobre o semieixo x positivo). */
export function angleFromHandle(origin: Vec2, handle: Vec2): number {
  return Math.atan2(-(handle.y - origin.y), handle.x - origin.x);
}

/** Calibração inicial razoável para uma imagem de tamanho w × h. */
export function defaultCalibration(w: number, h: number): Calibration {
  return {
    rulerA: { x: w * 0.2, y: h * 0.9 },
    rulerB: { x: w * 0.5, y: h * 0.9 },
    rulerLength: 1,
    origin: { x: w * 0.1, y: h * 0.8 },
    angle: 0,
  };
}

// ───────────────────────────── Cor ─────────────────────────────

export type RGB = [number, number, number];

/** Cor média num quadrado de lado 2r+1 em torno de p. */
export function sampleColor(img: RGBAImage, p: Vec2, r = 2): RGB {
  let R = 0, G = 0, B = 0, n = 0;
  const cx = Math.round(p.x), cy = Math.round(p.y);
  for (let y = Math.max(0, cy - r); y <= Math.min(img.height - 1, cy + r); y++)
    for (let x = Math.max(0, cx - r); x <= Math.min(img.width - 1, cx + r); x++) {
      const i = (y * img.width + x) * 4;
      R += img.data[i]!;
      G += img.data[i + 1]!;
      B += img.data[i + 2]!;
      n++;
    }
  return n ? [R / n, G / n, B / n] : [0, 0, 0];
}

export interface CentroidResult extends Vec2 {
  /** Número de pixels que casaram com a cor. */
  count: number;
}

/**
 * Centroide dos pixels com cor próxima de `target` (distância euclidiana em RGB < tolerância)
 * dentro de uma janela quadrada de meia-largura `radius` em torno de `center`.
 * Pixels são pesados pela proximidade da cor, o que dá precisão abaixo de um pixel na borda.
 */
export function colorCentroid(img: RGBAImage, target: RGB, center: Vec2, radius: number, tolerance: number, minCount = 3): CentroidResult | null {
  const x0 = Math.max(0, Math.floor(center.x - radius)), x1 = Math.min(img.width - 1, Math.ceil(center.x + radius));
  const y0 = Math.max(0, Math.floor(center.y - radius)), y1 = Math.min(img.height - 1, Math.ceil(center.y + radius));
  const tol2 = tolerance * tolerance;
  let sx = 0, sy = 0, sw = 0, count = 0;
  for (let y = y0; y <= y1; y++)
    for (let x = x0; x <= x1; x++) {
      const i = (y * img.width + x) * 4;
      const dr = img.data[i]! - target[0], dg = img.data[i + 1]! - target[1], db = img.data[i + 2]! - target[2];
      const d2 = dr * dr + dg * dg + db * db;
      if (d2 >= tol2) continue;
      const w = 1 - d2 / tol2;
      sx += w * x;
      sy += w * y;
      sw += w;
      count++;
    }
  if (count < minCount || sw <= 0) return null;
  return { x: sx / sw, y: sy / sw, count };
}

// ───────────────────────────── Modelo (template) ─────────────────────────────

export interface Template {
  width: number;
  height: number;
  /** RGB em ponto flutuante, sem o canal alfa. */
  data: Float32Array;
}

/** Recorta um modelo (2·half+1)² centrado em p. Pixels fora da imagem repetem a borda. */
export function extractTemplate(img: RGBAImage, p: Vec2, half: number): Template {
  const w = 2 * half + 1;
  const data = new Float32Array(w * w * 3);
  const cx = Math.round(p.x), cy = Math.round(p.y);
  for (let j = 0; j < w; j++)
    for (let i = 0; i < w; i++) {
      const x = clampInt(cx - half + i, 0, img.width - 1), y = clampInt(cy - half + j, 0, img.height - 1);
      const s = (y * img.width + x) * 4, d = (j * w + i) * 3;
      data[d] = img.data[s]!;
      data[d + 1] = img.data[s + 1]!;
      data[d + 2] = img.data[s + 2]!;
    }
  return { width: w, height: w, data };
}

const clampInt = (v: number, lo: number, hi: number) => (v < lo ? lo : v > hi ? hi : v);

/** Soma das diferenças quadradas (média por canal) do modelo centrado no pixel (cx, cy). */
export function ssdAt(img: RGBAImage, tpl: Template, cx: number, cy: number): number {
  const hw = (tpl.width - 1) / 2, hh = (tpl.height - 1) / 2;
  let s = 0;
  for (let j = 0; j < tpl.height; j++) {
    const y = clampInt(cy - hh + j, 0, img.height - 1);
    for (let i = 0; i < tpl.width; i++) {
      const x = clampInt(cx - hw + i, 0, img.width - 1);
      const a = (y * img.width + x) * 4, b = (j * tpl.width + i) * 3;
      const dr = img.data[a]! - tpl.data[b]!, dg = img.data[a + 1]! - tpl.data[b + 1]!, db = img.data[a + 2]! - tpl.data[b + 2]!;
      s += dr * dr + dg * dg + db * db;
    }
  }
  return s / (tpl.width * tpl.height * 3);
}

export interface MatchResult extends Vec2 {
  /** Diferença quadrática média por canal no melhor casamento (0 = idêntico). */
  score: number;
}

/**
 * Casamento de modelo: procura, numa janela de meia-largura `radius` em torno de `center`,
 * a posição que minimiza a soma das diferenças quadradas. Refina com uma parábola em x e em y
 * para obter precisão abaixo de um pixel.
 */
export function matchTemplate(img: RGBAImage, tpl: Template, center: Vec2, radius: number): MatchResult {
  const cx = Math.round(center.x), cy = Math.round(center.y), r = Math.max(1, Math.round(radius));
  let best = Infinity, bx = cx, by = cy;
  for (let y = cy - r; y <= cy + r; y++) {
    if (y < 0 || y >= img.height) continue;
    for (let x = cx - r; x <= cx + r; x++) {
      if (x < 0 || x >= img.width) continue;
      const s = ssdAt(img, tpl, x, y);
      if (s < best) {
        best = s;
        bx = x;
        by = y;
      }
    }
  }
  const sub = (m: number, c: number, p: number) => {
    const den = m - 2 * c + p;
    return den > 0 ? Math.max(-0.5, Math.min(0.5, (0.5 * (m - p)) / den)) : 0;
  };
  const inside = (x: number, y: number) => x >= 0 && y >= 0 && x < img.width && y < img.height;
  const dx = inside(bx - 1, by) && inside(bx + 1, by) ? sub(ssdAt(img, tpl, bx - 1, by), best, ssdAt(img, tpl, bx + 1, by)) : 0;
  const dy = inside(bx, by - 1) && inside(bx, by + 1) ? sub(ssdAt(img, tpl, bx, by - 1), best, ssdAt(img, tpl, bx, by + 1)) : 0;
  return { x: bx + dx, y: by + dy, score: best };
}

// ───────────────────────────── Rastreador ─────────────────────────────

export type TrackMode = "cor" | "modelo";

export interface TrackerOptions {
  mode: TrackMode;
  /** Meia-largura da janela de busca, em pixels. */
  searchRadius: number;
  /** Tolerância de cor (distância RGB). */
  colorTolerance: number;
  /** Meia-largura do modelo, em pixels. */
  templateHalf: number;
  /** Diferença quadrática média acima da qual o objeto é considerado perdido. */
  maxScore: number;
}

export const defaultTrackerOptions: TrackerOptions = { mode: "cor", searchRadius: 30, colorTolerance: 60, templateHalf: 10, maxScore: 2500 };

/**
 * Rastreador quadro a quadro. Prevê a próxima posição por velocidade constante
 * e procura em volta dela (por cor ou por modelo).
 */
export class Tracker {
  readonly opts: TrackerOptions;
  color: RGB = [0, 0, 0];
  template: Template | null = null;
  private last: Vec2 | null = null;
  private prev: Vec2 | null = null;

  constructor(opts: Partial<TrackerOptions> = {}) {
    this.opts = { ...defaultTrackerOptions, ...opts };
  }

  /** Inicia no ponto clicado. Na cor, refina o clique para o centroide da mancha. */
  init(img: RGBAImage, p: Vec2): Vec2 {
    this.prev = null;
    if (this.opts.mode === "cor") {
      this.color = sampleColor(img, p, 2);
      const c = colorCentroid(img, this.color, p, Math.max(6, this.opts.searchRadius / 2), this.opts.colorTolerance);
      this.last = c ? { x: c.x, y: c.y } : { ...p };
    } else {
      this.template = extractTemplate(img, p, this.opts.templateHalf);
      this.last = { ...p };
    }
    return { ...this.last };
  }

  /** Força a posição atual (correção manual do aluno) sem trocar a cor/modelo. */
  set(p: Vec2) {
    this.prev = this.last;
    this.last = { ...p };
  }

  /** Posição prevista para o próximo quadro. */
  predict(): Vec2 | null {
    if (!this.last) return null;
    if (!this.prev) return { ...this.last };
    return { x: 2 * this.last.x - this.prev.x, y: 2 * this.last.y - this.prev.y };
  }

  /** Procura o objeto no próximo quadro; devolve null se perdeu. */
  next(img: RGBAImage): Vec2 | null {
    const c = this.predict();
    if (!c) return null;
    let found: Vec2 | null = null;
    if (this.opts.mode === "cor") {
      const r = colorCentroid(img, this.color, c, this.opts.searchRadius, this.opts.colorTolerance);
      if (r) found = { x: r.x, y: r.y };
    } else if (this.template) {
      const r = matchTemplate(img, this.template, c, this.opts.searchRadius);
      if (r.score <= this.opts.maxScore) found = { x: r.x, y: r.y };
    }
    if (found) {
      this.prev = this.last;
      this.last = found;
    }
    return found;
  }
}

// ───────────────────────────── Cinemática ─────────────────────────────

export interface Sample {
  t: number;
  x: number;
  y: number;
}

export interface KinematicRow extends Sample {
  vx: number;
  vy: number;
  /** Módulo da velocidade. */
  v: number;
}

/**
 * Velocidades por diferença central: vᵢ = (xᵢ₊₁ − xᵢ₋₁)/(tᵢ₊₁ − tᵢ₋₁).
 * Os extremos ficam sem velocidade (NaN), como no Tracker.
 */
export function kinematics(samples: readonly Sample[]): KinematicRow[] {
  const s = [...samples].sort((a, b) => a.t - b.t);
  return s.map((p, i) => {
    const a = s[i - 1], b = s[i + 1];
    let vx = NaN, vy = NaN;
    if (a && b && b.t > a.t) {
      vx = (b.x - a.x) / (b.t - a.t);
      vy = (b.y - a.y) / (b.t - a.t);
    }
    return { ...p, vx, vy, v: Math.hypot(vx, vy) };
  });
}

/** Converte pontos rastreados (quadro → pixel) em amostras (t, x, y) em metros. */
export function trackToSamples(track: ReadonlyMap<number, Vec2> | readonly (readonly [number, Vec2])[], cal: Calibration, fps: number, startFrame = 0): Sample[] {
  const entries = Array.from(track as Iterable<readonly [number, Vec2]>).sort((a, b) => a[0] - b[0]);
  return entries.map(([f, p]) => {
    const w = pixelToWorld(cal, p);
    return { t: (f - startFrame) / fps, x: w.x, y: w.y };
  });
}

// ───────────────────────────── Taxa de quadros ─────────────────────────────

const COMMON_FPS = [24, 25, 30, 48, 50, 60, 90, 120, 240];

/**
 * Estima a taxa de quadros a partir dos instantes de mídia (s) de quadros consecutivos
 * apresentados (requestVideoFrameCallback). Usa o menor intervalo típico (mediana do quartil inferior)
 * para tolerar quadros pulados, e aproxima de taxas comuns (29,97 → 30) quando está a menos de 3%.
 */
export function estimateFps(mediaTimes: readonly number[]): number | null {
  const d: number[] = [];
  for (let i = 1; i < mediaTimes.length; i++) {
    const dt = mediaTimes[i]! - mediaTimes[i - 1]!;
    if (dt > 1e-4) d.push(dt);
  }
  if (d.length < 2) return null;
  d.sort((a, b) => a - b);
  const low = d.slice(0, Math.max(1, Math.ceil(d.length / 2)));
  const dt = low[Math.floor(low.length / 2)]!;
  const fps = 1 / dt;
  for (const c of COMMON_FPS) if (Math.abs(fps - c) / c < 0.03) return c;
  return Math.round(fps * 100) / 100;
}

// ───────────────────────────── Cena sintética ─────────────────────────────

/** Vídeo de exemplo: bola em lançamento oblíquo, com régua de 1 m desenhada no chão. */
export interface ProjectileScene {
  width: number;
  height: number;
  fps: number;
  /** Pixels por metro. */
  ppm: number;
  /** Ponto de lançamento (origem sugerida), em pixels. */
  launch: Vec2;
  v0: number;
  /** Ângulo de lançamento, em graus. */
  angleDeg: number;
  g: number;
  ballRadius: number;
  ballColor: RGB;
  /** Régua desenhada (extremidades em pixels e comprimento real). */
  ruler: { a: Vec2; b: Vec2; length: number };
  /** Número total de quadros. */
  frames: number;
  /** Quadro em que a bola toca o chão. */
  landingFrame: number;
  /** Amplitude do ruído de "sensor" (0 = sem ruído). */
  noise: number;
}

export function projectileScene(o: Partial<Pick<ProjectileScene, "fps" | "v0" | "angleDeg" | "g" | "noise">> = {}): ProjectileScene {
  const fps = o.fps ?? 60, v0 = o.v0 ?? 4.5, angleDeg = o.angleDeg ?? 60, g = o.g ?? 9.8;
  const width = 640, height = 360, ppm = 200;
  const launch = { x: 90, y: 300 };
  const flight = (2 * v0 * Math.sin((angleDeg * Math.PI) / 180)) / g;
  const landingFrame = Math.floor(flight * fps);
  return {
    width,
    height,
    fps,
    ppm,
    launch,
    v0,
    angleDeg,
    g,
    ballRadius: 9,
    ballColor: [235, 96, 30],
    ruler: { a: { x: 90, y: 335 }, b: { x: 90 + ppm, y: 335 }, length: 1 },
    frames: landingFrame + Math.round(0.4 * fps),
    landingFrame,
    noise: o.noise ?? 6,
  };
}

/** Posição exata da bola (pixels) no quadro f. Depois de tocar o chão, fica parada. */
export function sceneBall(s: ProjectileScene, f: number): Vec2 {
  const t = Math.min(f, (2 * s.v0 * Math.sin((s.angleDeg * Math.PI) / 180)) / s.g * s.fps) / s.fps;
  const a = (s.angleDeg * Math.PI) / 180;
  const x = s.v0 * Math.cos(a) * t, y = s.v0 * Math.sin(a) * t - 0.5 * s.g * t * t;
  return { x: s.launch.x + x * s.ppm, y: s.launch.y - Math.max(0, y) * s.ppm };
}

/** Calibração correspondente à régua e à origem desenhadas na cena. */
export function sceneCalibration(s: ProjectileScene): Calibration {
  return { rulerA: s.ruler.a, rulerB: s.ruler.b, rulerLength: s.ruler.length, origin: { ...s.launch }, angle: 0 };
}

function hashNoise(x: number, y: number, f: number): number {
  let h = (x * 374761393 + y * 668265263 + f * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  h ^= h >>> 16;
  return ((h >>> 0) / 4294967296) * 2 - 1;
}

/** Desenha o quadro f da cena num RGBAImage (sem DOM). */
export function renderSceneFrame(s: ProjectileScene, f: number, out?: RGBAImage): RGBAImage {
  const img = out ?? createImage(s.width, s.height);
  const { width: W, height: H, data } = img;
  const groundY = s.launch.y + s.ballRadius;
  for (let y = 0; y < H; y++)
    for (let x = 0; x < W; x++) {
      const i = (y * W + x) * 4;
      let r: number, g: number, b: number;
      if (y < groundY) {
        // parede clara com leve gradiente
        const k = y / groundY;
        r = 214 - 20 * k;
        g = 224 - 16 * k;
        b = 232 - 8 * k;
        // linhas de azulejo a cada 50 px (textura para o casamento de modelo não "escorregar")
        if (x % 50 === 0 || y % 50 === 0) {
          r -= 18;
          g -= 18;
          b -= 18;
        }
      } else {
        r = 120;
        g = 104;
        b = 88;
      }
      if (s.noise) {
        const n = s.noise * hashNoise(x, y, f);
        r += n;
        g += n;
        b += n;
      }
      data[i] = r;
      data[i + 1] = g;
      data[i + 2] = b;
      data[i + 3] = 255;
    }
  // Régua listrada (10 cm por faixa)
  const ra = s.ruler.a, rb = s.ruler.b;
  for (let x = Math.round(ra.x); x <= Math.round(rb.x); x++)
    for (let y = Math.round(ra.y) - 5; y <= Math.round(ra.y) + 5; y++) {
      const stripe = Math.floor(((x - ra.x) / (rb.x - ra.x)) * 10) % 2 === 0;
      const v = stripe ? 245 : 30;
      const i = (y * W + x) * 4;
      data[i] = v;
      data[i + 1] = v;
      data[i + 2] = stripe ? 120 : 30;
    }
  // Plataforma de lançamento
  for (let y = s.launch.y + s.ballRadius; y < s.launch.y + s.ballRadius + 4; y++)
    for (let x = s.launch.x - 30; x < s.launch.x + 12; x++) {
      const i = (y * W + x) * 4;
      data[i] = 60;
      data[i + 1] = 70;
      data[i + 2] = 90;
    }
  // Bola com borda suavizada (supersampling 4×4)
  const c = sceneBall(s, f), R = s.ballRadius;
  for (let y = Math.floor(c.y - R - 1); y <= Math.ceil(c.y + R + 1); y++)
    for (let x = Math.floor(c.x - R - 1); x <= Math.ceil(c.x + R + 1); x++) {
      if (x < 0 || y < 0 || x >= W || y >= H) continue;
      let cov = 0;
      for (let sy = 0; sy < 4; sy++)
        for (let sx = 0; sx < 4; sx++) {
          const px = x + (sx + 0.5) / 4 - 0.5, py = y + (sy + 0.5) / 4 - 0.5;
          if ((px - c.x) ** 2 + (py - c.y) ** 2 <= R * R) cov++;
        }
      if (!cov) continue;
      const a = cov / 16, i = (y * W + x) * 4;
      // leve sombreamento esférico
      const shade = 1 - 0.25 * Math.max(0, ((x - c.x) + (y - c.y)) / (2 * R));
      data[i] = data[i]! * (1 - a) + s.ballColor[0] * shade * a;
      data[i + 1] = data[i + 1]! * (1 - a) + s.ballColor[1] * shade * a;
      data[i + 2] = data[i + 2]! * (1 - a) + s.ballColor[2] * shade * a;
    }
  return img;
}
