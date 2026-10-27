import { describe, expect, it } from "vitest";
import {
  Tracker,
  angleFromHandle,
  colorCentroid,
  createImage,
  estimateFps,
  extractTemplate,
  fitModel,
  kinematics,
  matchTemplate,
  metersPerPixel,
  pixelToWorld,
  projectileScene,
  renderSceneFrame,
  sceneBall,
  sceneCalibration,
  trackToSamples,
  worldToPixel,
  type Calibration,
  type RGBAImage,
  type Vec2,
} from "../src/index.ts";

const cal = (over: Partial<Calibration> = {}): Calibration => ({
  rulerA: { x: 10, y: 10 },
  rulerB: { x: 110, y: 10 },
  rulerLength: 0.5,
  origin: { x: 50, y: 200 },
  angle: 0,
  ...over,
});

describe("calibração", () => {
  it("escala pela régua (inclusive inclinada)", () => {
    expect(metersPerPixel(cal())).toBeCloseTo(0.005);
    expect(metersPerPixel(cal({ rulerB: { x: 70, y: 90 } }))).toBeCloseTo(0.5 / 100);
    expect(metersPerPixel(cal({ rulerB: { x: 10, y: 10 } }))).toBeNaN();
  });

  it("y do mundo aponta para cima na tela", () => {
    const c = cal();
    const w = pixelToWorld(c, { x: 150, y: 100 });
    expect(w.x).toBeCloseTo(0.5);
    expect(w.y).toBeCloseTo(0.5);
    const o = pixelToWorld(c, c.origin);
    expect(Math.abs(o.x) + Math.abs(o.y)).toBe(0);
  });

  it("eixos girados: 90° leva o eixo x para cima da tela", () => {
    const c = cal({ angle: Math.PI / 2 });
    const w = pixelToWorld(c, { x: 50, y: 100 });
    expect(w.x).toBeCloseTo(0.5);
    expect(w.y).toBeCloseTo(0);
    const w2 = pixelToWorld(c, { x: 0, y: 200 });
    expect(w2.y).toBeCloseTo(0.25);
  });

  it("ida e volta pixel → metro → pixel", () => {
    const c = cal({ angle: 0.37, origin: { x: 123.4, y: 77.7 }, rulerB: { x: 300, y: 50 } });
    for (const p of [{ x: 0, y: 0 }, { x: 500, y: 20 }, { x: 33.3, y: 444.4 }]) {
      const q = worldToPixel(c, pixelToWorld(c, p));
      expect(q.x).toBeCloseTo(p.x, 9);
      expect(q.y).toBeCloseTo(p.y, 9);
    }
  });

  it("ângulo pela alça do eixo", () => {
    expect(angleFromHandle({ x: 0, y: 0 }, { x: 10, y: 0 })).toBeCloseTo(0);
    expect(angleFromHandle({ x: 0, y: 0 }, { x: 0, y: -10 })).toBeCloseTo(Math.PI / 2);
    expect(angleFromHandle({ x: 0, y: 0 }, { x: 10, y: -10 })).toBeCloseTo(Math.PI / 4);
  });
});

function blobImage(w: number, h: number, c: Vec2, r: number, color: [number, number, number]): RGBAImage {
  const img = createImage(w, h);
  for (let y = 0; y < h; y++)
    for (let x = 0; x < w; x++) {
      const i = (y * w + x) * 4;
      const inside = (x - c.x) ** 2 + (y - c.y) ** 2 <= r * r;
      // fundo com textura para o casamento de modelo
      const bg = 100 + 40 * Math.sin(x * 0.7) * Math.cos(y * 0.5);
      img.data[i] = inside ? color[0] : bg;
      img.data[i + 1] = inside ? color[1] : bg;
      img.data[i + 2] = inside ? color[2] : bg;
      img.data[i + 3] = 255;
    }
  return img;
}

describe("rastreamento", () => {
  it("centroide de cor encontra o disco", () => {
    const img = blobImage(80, 60, { x: 40, y: 25 }, 5, [250, 30, 30]);
    const r = colorCentroid(img, [250, 30, 30], { x: 35, y: 30 }, 15, 50)!;
    expect(r.x).toBeCloseTo(40, 5);
    expect(r.y).toBeCloseTo(25, 5);
    expect(r.count).toBeGreaterThan(60);
    expect(colorCentroid(img, [0, 255, 0], { x: 35, y: 30 }, 15, 50)).toBeNull();
  });

  it("casamento de modelo recupera deslocamentos inteiros", () => {
    const a = blobImage(100, 80, { x: 30, y: 30 }, 6, [20, 200, 40]);
    const tpl = extractTemplate(a, { x: 30, y: 30 }, 8);
    const b = blobImage(100, 80, { x: 37, y: 26 }, 6, [20, 200, 40]);
    // O fundo não se move, então o modelo inclui fundo; ainda assim o mínimo deve cair no disco.
    const m = matchTemplate(b, tpl, { x: 30, y: 30 }, 12);
    expect(Math.abs(m.x - 37)).toBeLessThan(1);
    expect(Math.abs(m.y - 26)).toBeLessThan(1);
    expect(matchTemplate(a, tpl, { x: 33, y: 28 }, 6).score).toBe(0);
  });

  it("Tracker segue a bola da cena sintética por cor e por modelo", () => {
    const s = projectileScene();
    for (const mode of ["cor", "modelo"] as const) {
      const tr = new Tracker({ mode, searchRadius: 25 });
      tr.init(renderSceneFrame(s, 0), sceneBall(s, 0));
      let worst = 0;
      for (let f = 1; f <= s.landingFrame; f++) {
        const p = tr.next(renderSceneFrame(s, f));
        expect(p, `${mode} perdeu no quadro ${f}`).not.toBeNull();
        const b = sceneBall(s, f);
        worst = Math.max(worst, Math.hypot(p!.x - b.x, p!.y - b.y));
      }
      expect(worst).toBeLessThan(2.5);
    }
  });
});

describe("cinemática", () => {
  it("diferença central é exata para trajetória quadrática com passo uniforme", () => {
    const pts = Array.from({ length: 10 }, (_, i) => {
      const t = i * 0.1;
      return { t, x: 2 * t, y: 1 + 3 * t - 4.9 * t * t };
    });
    const k = kinematics(pts);
    expect(k[0]!.vx).toBeNaN();
    expect(k[9]!.vy).toBeNaN();
    for (let i = 1; i < 9; i++) {
      expect(k[i]!.vx).toBeCloseTo(2, 10);
      expect(k[i]!.vy).toBeCloseTo(3 - 9.8 * pts[i]!.t, 10);
      expect(k[i]!.v).toBeCloseTo(Math.hypot(k[i]!.vx, k[i]!.vy), 12);
    }
  });

  it("aceita quadros faltando (usa os tempos reais) e ordena", () => {
    const k = kinematics([
      { t: 0.3, x: 3, y: 0 },
      { t: 0, x: 0, y: 0 },
      { t: 0.1, x: 1, y: 0 },
    ]);
    expect(k.map((r) => r.t)).toEqual([0, 0.1, 0.3]);
    expect(k[1]!.vx).toBeCloseTo(10);
  });

  it("taxa de quadros a partir dos instantes de mídia", () => {
    expect(estimateFps(Array.from({ length: 12 }, (_, i) => i / 29.97))).toBe(30);
    // um quadro pulado no meio não altera a estimativa
    expect(estimateFps([0, 1 / 60, 2 / 60, 4 / 60, 5 / 60, 6 / 60])).toBe(60);
    expect(estimateFps([0, 1 / 37, 2 / 37, 3 / 37])).toBeCloseTo(37, 0);
    expect(estimateFps([0])).toBeNull();
  });
});

describe("vídeo de exemplo (sem DOM)", () => {
  it("o ajuste quadrático de y(t) devolve g ≈ 9,8 m/s²", () => {
    const s = projectileScene();
    const c = sceneCalibration(s);
    const tr = new Tracker({ mode: "cor" });
    const track = new Map<number, Vec2>();
    track.set(0, tr.init(renderSceneFrame(s, 0), sceneBall(s, 0)));
    for (let f = 1; f <= s.landingFrame; f++) {
      const p = tr.next(renderSceneFrame(s, f));
      if (p) track.set(f, p);
    }
    expect(track.size).toBe(s.landingFrame + 1);
    const samples = trackToSamples(track, c, s.fps);
    const res = fitModel("quadratico", samples.map((p) => p.t), samples.map((p) => p.y), "s", "m")!;
    const g = -res.params.find((p) => p.name === "2·c₂")!.value;
    expect(g).toBeGreaterThan(9.6);
    expect(g).toBeLessThan(10.0);
    // e a componente horizontal é uniforme: v₀ cos θ
    const lin = fitModel("linear", samples.map((p) => p.t), samples.map((p) => p.x), "s", "m")!;
    expect(lin.params[1]!.value).toBeCloseTo(4.5 * Math.cos(Math.PI / 3), 1);
    // velocidade vertical inicial ≈ v₀ sen θ
    const k = kinematics(samples);
    expect(k[1]!.vy).toBeCloseTo(4.5 * Math.sin(Math.PI / 3) - 9.8 / s.fps, 0);
  });

  it("a régua desenhada tem 1 m e a bola parte da origem", () => {
    const s = projectileScene();
    const c = sceneCalibration(s);
    expect(metersPerPixel(c)).toBeCloseTo(1 / s.ppm);
    const w = pixelToWorld(c, sceneBall(s, 0));
    expect(w.x).toBeCloseTo(0);
    expect(w.y).toBeCloseTo(0);
    const img = renderSceneFrame(s, 0);
    expect(img.data.length).toBe(s.width * s.height * 4);
  });
});
