import { useCallback, useEffect, useId, useMemo, useRef, useState, type ReactNode } from "react";
import type { Theme } from "@fisilab/core";
import { formatMeasured } from "@fisilab/analysis";
import { Plot, fmtAxis, useTheme, type PlotSeries } from "@fisilab/ui-kit";
import {
  Tracker,
  angleFromHandle,
  axisVectors,
  defaultCalibration,
  estimateFps,
  fitKinds,
  fitModel,
  kinematics,
  metersPerPixel,
  projectileScene,
  renderSceneFrame,
  sceneCalibration,
  tableToCsv,
  trackToSamples,
  type Calibration,
  type FitKind,
  type FitParam,
  type ProjectileScene,
  type Vec2,
} from "@fisilab/lab";
import "./lab.css";

// ───────────────────────────── utilidades compartilhadas ─────────────────────────────

export function downloadText(name: string, text: string, type = "text/csv;charset=utf-8") {
  downloadBlob(name, new Blob([text], { type }));
}

function downloadBlob(name: string, blob: Blob) {
  const a = document.createElement("a");
  a.href = URL.createObjectURL(blob);
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 2000);
}

/** Número curto com vírgula decimal (tabelas e leituras). */
export function num(v: number, digits = 4): string {
  if (!Number.isFinite(v)) return "—";
  return String(+v.toPrecision(digits)).replace(".", ",");
}

const axisLabel = (name: string, unit: string) => (unit ? `${name} (${unit})` : name);

function fmtParam(p: FitParam): string {
  if (p.sigma > 0 && Number.isFinite(p.sigma)) return formatMeasured(p.value, p.sigma, p.unit);
  return `${fmtAxis(p.value)}${p.unit ? ` ${p.unit}` : ""}`;
}

export interface FitPlotProps {
  title: string;
  xs: readonly number[];
  ys: readonly number[];
  xName: string;
  yName: string;
  xUnit: string;
  yUnit: string;
  theme: Theme;
  defaultFit?: FitKind;
  /** Séries desenhadas por baixo (ex.: todos os dados, quando o ajuste usa só um intervalo). */
  background?: PlotSeries[];
  headerExtra?: ReactNode;
  pointsLabel?: string;
  height?: number;
  hint?: ReactNode;
}

/** Gráfico (Plot do ui-kit) com escolha de ajuste e parâmetros com incerteza. */
export function FitPlot({ title, xs, ys, xName, yName, xUnit, yUnit, theme, defaultFit = "nenhum", background, headerExtra, pointsLabel = "Medidas", height = 240, hint }: FitPlotProps) {
  const [fit, setFit] = useState<FitKind>(defaultFit);
  const id = useId();
  const res = useMemo(() => fitModel(fit, xs, ys, xUnit, yUnit), [fit, xs, ys, xUnit, yUnit]);
  const series = useMemo(() => {
    const pts: [number, number][] = [];
    xs.forEach((x, i) => {
      const y = ys[i]!;
      if (Number.isFinite(x) && Number.isFinite(y)) pts.push([x, y]);
    });
    const out: PlotSeries[] = [...(background ?? []), { label: pointsLabel, kind: "scatter", points: pts, color: theme.series[0] }];
    if (res && pts.length > 1) {
      const lo = Math.min(...pts.map((p) => p[0])), hi = Math.max(...pts.map((p) => p[0]));
      out.push({ label: "Ajuste", kind: "line", color: theme.accent, points: Array.from({ length: 120 }, (_, i) => { const x = lo + ((hi - lo) * i) / 119; return [x, res.fit.f(x)] as [number, number]; }) });
    }
    return out;
  }, [xs, ys, background, pointsLabel, res, theme]);

  return (
    <section className="lab-panel lab-fit" aria-labelledby={id}>
      <div className="lab-fit-head">
        <h3 id={id}>{title}</h3>
        <div className="lab-row">
          {headerExtra}
          <label className="lab-row lab-small">
            Ajuste
            <select value={fit} onChange={(e) => setFit(e.target.value as FitKind)}>
              {fitKinds.map((k) => (
                <option key={k.id} value={k.id}>
                  {k.label}
                </option>
              ))}
            </select>
          </label>
        </div>
      </div>
      <Plot series={series} xLabel={axisLabel(xName, xUnit)} yLabel={axisLabel(yName, yUnit)} theme={theme} height={height} ariaLabel={`${title}: gráfico de ${yName} por ${xName}`} />
      {res ? (
        <ul className="lab-params" aria-live="polite">
          <li className="lab-muted">
            {res.formula} · R² = {num(res.fit.r2, 5)} · {xs.length} pontos
          </li>
          {res.params.map((p) => (
            <li key={p.name}>
              <strong>{p.name}</strong> = {fmtParam(p)}
              {p.note && <span className="lab-muted"> ({p.note})</span>}
            </li>
          ))}
        </ul>
      ) : (
        fit !== "nenhum" && <p className="lab-muted lab-small">Pontos insuficientes (ou modelo inadequado) para este ajuste.</p>
      )}
      {hint && <p className="lab-muted lab-small">{hint}</p>}
    </section>
  );
}

// ───────────────────────────── vídeo ─────────────────────────────

type Source = { kind: "video"; name: string } | { kind: "exemplo"; scene: ProjectileScene };
type Tool = "regua" | "eixos" | "rastrear";
type TrackKind = "manual" | "cor" | "modelo";
type Handle = "rulerA" | "rulerB" | "origin" | "axis";

const MAX_DIM = 960;
const HANDLES: Handle[] = ["rulerA", "rulerB", "origin", "axis"];
const handleNames: Record<Handle, string> = { rulerA: "início da régua", rulerB: "fim da régua", origin: "origem dos eixos", axis: "direção do eixo x" };

type VideoWithRvfc = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: (now: number, meta: { mediaTime: number }) => void) => number;
};

function once(target: EventTarget, ev: string, ms: number): Promise<boolean> {
  return new Promise((resolve) => {
    const done = (ok: boolean) => {
      target.removeEventListener(ev, on);
      clearTimeout(timer);
      resolve(ok);
    };
    const on = () => done(true);
    const timer = setTimeout(() => done(false), ms);
    target.addEventListener(ev, on);
  });
}

/** Leva o vídeo ao instante t e espera o quadro estar pronto para desenhar. */
function seekTo(v: VideoWithRvfc, t: number): Promise<void> {
  return new Promise((resolve) => {
    if (Math.abs(v.currentTime - t) < 1e-4 && v.readyState >= 2) return resolve();
    let done = false;
    const finish = () => {
      if (done) return;
      done = true;
      v.removeEventListener("seeked", onSeeked);
      resolve();
    };
    const onSeeked = () => {
      if (v.requestVideoFrameCallback) {
        v.requestVideoFrameCallback(() => finish());
        setTimeout(finish, 150);
      } else finish();
    };
    v.addEventListener("seeked", onSeeked);
    v.currentTime = t;
    setTimeout(finish, 4000);
  });
}

/** Toca alguns quadros sem som e mede os instantes de mídia (requestVideoFrameCallback). */
async function detectFps(v: VideoWithRvfc): Promise<number | null> {
  if (!v.requestVideoFrameCallback) return null;
  const times: number[] = [];
  await new Promise<void>((resolve) => {
    let n = 0, ended = false;
    const stop = () => {
      if (ended) return;
      ended = true;
      v.pause();
      resolve();
    };
    const cb = (_now: number, meta: { mediaTime: number }) => {
      times.push(meta.mediaTime);
      if (++n >= 24) stop();
      else v.requestVideoFrameCallback!(cb);
    };
    v.requestVideoFrameCallback(cb);
    v.play().catch(stop);
    setTimeout(stop, 1500);
  });
  return estimateFps(times);
}

function pickMime(): string | undefined {
  if (typeof MediaRecorder === "undefined") return undefined;
  return ["video/webm;codecs=vp9", "video/webm;codecs=vp8", "video/webm", "video/mp4"].find((m) => MediaRecorder.isTypeSupported(m));
}

function handlePos(h: Handle, c: Calibration, w: number): Vec2 {
  if (h === "rulerA") return c.rulerA;
  if (h === "rulerB") return c.rulerB;
  if (h === "origin") return c.origin;
  const { ex } = axisVectors(c.angle);
  const L = 0.15 * w;
  return { x: c.origin.x + ex.x * L, y: c.origin.y + ex.y * L };
}

interface OverlayState {
  cal: Calibration;
  track: [number, Vec2][];
  frame: number;
  tool: Tool;
  cursor: Vec2 | null;
  grabbed: Handle | null;
}

function drawOverlay(ctx: CanvasRenderingContext2D, o: OverlayState, w: number, h: number, k: number) {
  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  const line = (a: Vec2, b: Vec2, color: string, width: number) => {
    ctx.strokeStyle = "rgba(0,0,0,0.7)";
    ctx.lineWidth = (width + 2) * k;
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x, b.y);
    ctx.stroke();
    ctx.strokeStyle = color;
    ctx.lineWidth = width * k;
    ctx.stroke();
  };
  const label = (text: string, p: Vec2, color: string) => {
    ctx.font = `${13 * k}px system-ui, sans-serif`;
    const tw = ctx.measureText(text).width;
    ctx.fillStyle = "rgba(0,0,0,0.65)";
    ctx.fillRect(p.x - tw / 2 - 4 * k, p.y - 9 * k, tw + 8 * k, 18 * k);
    ctx.fillStyle = color;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.fillText(text, p.x, p.y);
  };
  const knob = (p: Vec2, color: string, square: boolean, hl: boolean) => {
    const r = 7 * k;
    ctx.beginPath();
    if (square) ctx.rect(p.x - r, p.y - r, 2 * r, 2 * r);
    else ctx.arc(p.x, p.y, r, 0, 2 * Math.PI);
    ctx.fillStyle = color;
    ctx.fill();
    ctx.lineWidth = (hl ? 3 : 1.5) * k;
    ctx.strokeStyle = hl ? "#ffffff" : "#000000";
    ctx.stroke();
  };

  const editing = o.tool !== "rastrear";
  // Eixos (linhas finas atravessando a imagem e setas grossas no sentido positivo)
  ctx.globalAlpha = editing ? 1 : 0.55;
  const { ex, ey } = axisVectors(o.cal.angle);
  const O = o.cal.origin, far = 2 * Math.hypot(w, h), L = 0.15 * w;
  ctx.globalAlpha *= 0.5;
  line({ x: O.x - ex.x * far, y: O.y - ex.y * far }, { x: O.x + ex.x * far, y: O.y + ex.y * far }, "#facc15", 1);
  line({ x: O.x - ey.x * far, y: O.y - ey.y * far }, { x: O.x + ey.x * far, y: O.y + ey.y * far }, "#facc15", 1);
  ctx.globalAlpha = editing ? 1 : 0.55;
  const X = { x: O.x + ex.x * L, y: O.y + ex.y * L }, Y = { x: O.x + ey.x * L * 0.7, y: O.y + ey.y * L * 0.7 };
  line(O, X, "#facc15", 2.5);
  line(O, Y, "#facc15", 2.5);
  label("x", { x: X.x + ex.x * 14 * k, y: X.y + ex.y * 14 * k }, "#facc15");
  label("y", { x: Y.x + ey.x * 14 * k, y: Y.y + ey.y * 14 * k }, "#facc15");
  knob(O, "#facc15", false, o.grabbed === "origin");
  knob(X, "#facc15", true, o.grabbed === "axis");

  // Régua
  const A = o.cal.rulerA, B = o.cal.rulerB;
  line(A, B, "#22d3ee", 2.5);
  const dl = Math.hypot(B.x - A.x, B.y - A.y) || 1;
  const nx = (-(B.y - A.y) / dl) * 8 * k, ny = ((B.x - A.x) / dl) * 8 * k;
  for (const P of [A, B]) line({ x: P.x - nx, y: P.y - ny }, { x: P.x + nx, y: P.y + ny }, "#22d3ee", 2);
  knob(A, "#22d3ee", false, o.grabbed === "rulerA");
  knob(B, "#22d3ee", false, o.grabbed === "rulerB");
  label(`${num(o.cal.rulerLength, 4)} m`, { x: (A.x + B.x) / 2 - nx * 2.2, y: (A.y + B.y) / 2 - ny * 2.2 }, "#22d3ee");

  // Trajetória
  ctx.globalAlpha = 1;
  if (o.track.length) {
    ctx.strokeStyle = "rgba(255,47,208,0.85)";
    ctx.lineWidth = 1.5 * k;
    ctx.beginPath();
    o.track.forEach(([, p], i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y)));
    ctx.stroke();
    for (const [f, p] of o.track) {
      const cur = f === o.frame;
      ctx.beginPath();
      ctx.arc(p.x, p.y, (cur ? 6 : 3.2) * k, 0, 2 * Math.PI);
      ctx.fillStyle = cur ? "#fde047" : "#ff2fd0";
      ctx.fill();
      ctx.lineWidth = 1 * k;
      ctx.strokeStyle = "#000";
      ctx.stroke();
    }
  }

  // Cursor do teclado
  if (o.cursor) {
    const c = o.cursor, r = 12 * k;
    for (const [color, wdt] of [["#000", 3], ["#fff", 1.5]] as const) {
      ctx.strokeStyle = color;
      ctx.lineWidth = wdt * k;
      ctx.beginPath();
      ctx.moveTo(c.x - r, c.y);
      ctx.lineTo(c.x + r, c.y);
      ctx.moveTo(c.x, c.y - r);
      ctx.lineTo(c.x, c.y + r);
      ctx.stroke();
    }
  }
  ctx.restore();
}

/** Videoanálise: abre um vídeo (arquivo, câmera ou exemplo), calibra, rastreia e analisa o movimento. */
export function VideoPage() {
  const theme = useTheme();
  const videoRef = useRef<VideoWithRvfc>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const workRef = useRef<HTMLCanvasElement | null>(null);
  const imgRef = useRef<ImageData | null>(null);
  const urlRef = useRef<string | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const recRef = useRef<MediaRecorder | null>(null);
  const queueRef = useRef<Promise<unknown>>(Promise.resolve());
  const wantRef = useRef(0);
  const dragRef = useRef<Handle | null>(null);
  const cancelRef = useRef(false);

  const [source, setSource] = useState<Source | null>(null);
  const [size, setSize] = useState({ w: 640, h: 360 });
  const [fps, setFps] = useState(30);
  const [detectedFps, setDetectedFps] = useState<number | null>(null);
  const [duration, setDuration] = useState(0);
  const [frame, setFrame] = useState(0);
  const [range, setRange] = useState<[number, number]>([0, 0]);
  const [step, setStep] = useState(1);
  const [cal, setCal] = useState<Calibration>(() => defaultCalibration(640, 360));
  const [tool, setTool] = useState<Tool>("regua");
  const [trackKind, setTrackKind] = useState<TrackKind>("cor");
  const [opts, setOpts] = useState({ searchRadius: 30, colorTolerance: 60, templateHalf: 10 });
  const [track, setTrack] = useState<Record<number, Vec2>>({});
  const [running, setRunning] = useState(false);
  const [status, setStatus] = useState("");
  const [tick, setTick] = useState(0);
  const [cursor, setCursor] = useState<Vec2 | null>(null);
  const [focused, setFocused] = useState(false);
  const [grabbed, setGrabbed] = useState<Handle | null>(null);
  const [camera, setCamera] = useState(false);
  const [recording, setRecording] = useState(false);
  const [velComp, setVelComp] = useState<"vx" | "vy" | "v">("vy");
  const [exporting, setExporting] = useState(false);

  const frameCount = source?.kind === "exemplo" ? source.scene.frames : Math.max(1, Math.floor(duration * fps));
  const lastFrame = frameCount - 1;

  // ── captura de quadros ──
  const grab = useCallback(
    (f: number, lazy = false): Promise<ImageData | null> => {
      const job = queueRef.current.then(async () => {
        if (!source || (lazy && wantRef.current !== f)) return null;
        if (source.kind === "exemplo") {
          const img = new ImageData(source.scene.width, source.scene.height);
          renderSceneFrame(source.scene, f, img);
          return img;
        }
        const v = videoRef.current, work = workRef.current;
        if (!v || !work) return null;
        await seekTo(v, Math.min(Math.max(0, duration - 1e-3), (f + 0.5) / fps));
        const ctx = work.getContext("2d", { willReadFrequently: true })!;
        ctx.drawImage(v, 0, 0, work.width, work.height);
        return ctx.getImageData(0, 0, work.width, work.height);
      });
      queueRef.current = job.catch(() => null);
      return job;
    },
    [source, duration, fps],
  );

  useEffect(() => {
    if (!source || camera) return;
    wantRef.current = frame;
    let alive = true;
    grab(frame, true).then((img) => {
      if (alive && img && wantRef.current === frame) {
        imgRef.current = img;
        setTick((t) => t + 1);
      }
    });
    return () => {
      alive = false;
    };
  }, [frame, grab, source, camera]);

  const trackList = useMemo(
    () => Object.entries(track).map(([f, p]) => [Number(f), p] as [number, Vec2]).sort((a, b) => a[0] - b[0]),
    [track],
  );

  // ── desenho ──
  useEffect(() => {
    const c = canvasRef.current, img = imgRef.current;
    if (!c || !img || camera) return;
    if (c.width !== img.width) c.width = img.width;
    if (c.height !== img.height) c.height = img.height;
    const ctx = c.getContext("2d")!;
    ctx.putImageData(img, 0, 0);
    const k = img.width / Math.max(1, c.clientWidth || img.width);
    drawOverlay(ctx, { cal, track: trackList, frame, tool, cursor: focused ? cursor : null, grabbed }, img.width, img.height, k);
  }, [tick, cal, trackList, frame, tool, cursor, focused, grabbed, camera]);

  // Redesenha ao mudar a largura (as espessuras dependem da escala).
  useEffect(() => {
    const c = canvasRef.current;
    if (!c) return;
    const ro = new ResizeObserver(() => setTick((t) => t + 1));
    ro.observe(c);
    return () => ro.disconnect();
  }, [source]);

  useEffect(
    () => () => {
      cancelRef.current = true;
      streamRef.current?.getTracks().forEach((t) => t.stop());
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    [],
  );

  // ── fontes ──
  const reset = (w: number, h: number, frames: number, f: number) => {
    setSize({ w, h });
    setCal(defaultCalibration(w, h));
    setTrack({});
    setFrame(0);
    setRange([0, Math.max(0, frames - 1)]);
    setTool("regua");
    setFps(f);
    setCursor(null);
    setGrabbed(null);
    imgRef.current = null;
  };

  const stopCamera = () => {
    streamRef.current?.getTracks().forEach((t) => t.stop());
    streamRef.current = null;
    setCamera(false);
    const v = videoRef.current;
    if (v) v.srcObject = null;
  };

  const loadVideo = async (url: string, name: string) => {
    const v = videoRef.current!;
    cancelRef.current = true;
    v.srcObject = null;
    v.muted = true;
    v.playsInline = true;
    v.src = url;
    setStatus("Carregando o vídeo…");
    const ok = await once(v, "loadedmetadata", 15000);
    if (!ok || !v.videoWidth) {
      setStatus("Não foi possível abrir este vídeo. Tente outro formato (MP4/H.264 ou WebM costumam funcionar).");
      return;
    }
    let dur = v.duration;
    if (!Number.isFinite(dur)) {
      // Gravações do MediaRecorder às vezes não trazem a duração: força o navegador a calculá-la.
      v.currentTime = 1e7;
      await once(v, "durationchange", 3000);
      dur = Number.isFinite(v.duration) ? v.duration : v.currentTime;
      v.currentTime = 0;
    }
    const scale = Math.min(1, MAX_DIM / Math.max(v.videoWidth, v.videoHeight));
    const w = Math.round(v.videoWidth * scale), h = Math.round(v.videoHeight * scale);
    const work = document.createElement("canvas");
    work.width = w;
    work.height = h;
    workRef.current = work;
    const det = await detectFps(v);
    setDetectedFps(det);
    const f = det ?? 30;
    setDuration(dur);
    reset(w, h, Math.floor(dur * f), f);
    setSource({ kind: "video", name });
    setStatus(
      `Vídeo "${name}": ${num(dur, 3)} s, ${w}×${h} px. ` +
        (det ? `Taxa de quadros detectada: ${num(det, 4)} quadros/s.` : "Não foi possível detectar a taxa de quadros: confira o valor (30 por padrão).") +
        " Comece pela calibração.",
    );
  };

  const openFile = async (file: File | undefined) => {
    if (!file) return;
    stopCamera();
    if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    urlRef.current = URL.createObjectURL(file);
    await loadVideo(urlRef.current, file.name);
  };

  const openExample = () => {
    stopCamera();
    cancelRef.current = true;
    const scene = projectileScene();
    setDetectedFps(scene.fps);
    setDuration(scene.frames / scene.fps);
    reset(scene.width, scene.height, scene.frames, scene.fps);
    setRange([0, scene.landingFrame]);
    setSource({ kind: "exemplo", scene });
    setStatus(`Vídeo de exemplo: bola lançada a ${num(scene.v0, 2)} m/s e ${scene.angleDeg}°, filmada a ${scene.fps} quadros/s. A régua listrada no chão mede 1,00 m.`);
  };

  const openCamera = async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus("Este navegador não dá acesso à câmera (é preciso HTTPS). No celular, use “Abrir vídeo”: ele oferece gravar com o app da câmera.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: { ideal: "environment" }, frameRate: { ideal: 60 }, width: { ideal: 1280 } },
        audio: false,
      });
      streamRef.current = stream;
      cancelRef.current = true;
      setCamera(true);
      const v = videoRef.current!;
      v.removeAttribute("src");
      v.srcObject = stream;
      v.muted = true;
      v.playsInline = true;
      await v.play().catch(() => undefined);
      setStatus("Câmera aberta. Apoie o celular (sem mexer durante a filmagem), deixe um objeto de tamanho conhecido no plano do movimento e grave.");
    } catch (e) {
      setStatus(`Não foi possível abrir a câmera: ${(e as Error).message}`);
    }
  };

  const startRecording = () => {
    const stream = streamRef.current;
    if (!stream) return;
    if (typeof MediaRecorder === "undefined") {
      setStatus("Este navegador não grava vídeo. Grave com o app da câmera e abra o arquivo.");
      return;
    }
    const mime = pickMime();
    const rec = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    rec.onstop = async () => {
      const blob = new Blob(chunks, { type: rec.mimeType || "video/webm" });
      stopCamera();
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
      urlRef.current = URL.createObjectURL(blob);
      await loadVideo(urlRef.current, "gravação da câmera");
    };
    rec.start();
    recRef.current = rec;
    setRecording(true);
  };

  const stopRecording = () => {
    recRef.current?.stop();
    recRef.current = null;
    setRecording(false);
  };

  const downloadExample = async () => {
    const scene = source?.kind === "exemplo" ? source.scene : projectileScene();
    const c = document.createElement("canvas");
    c.width = scene.width;
    c.height = scene.height;
    if (typeof c.captureStream !== "function" || typeof MediaRecorder === "undefined") {
      setStatus("Este navegador não grava vídeo a partir do canvas; use o exemplo direto nesta página.");
      return;
    }
    setExporting(true);
    const ctx = c.getContext("2d")!;
    const img = new ImageData(scene.width, scene.height);
    renderSceneFrame(scene, 0, img);
    ctx.putImageData(img, 0, 0);
    const mime = pickMime();
    const rec = new MediaRecorder(c.captureStream(scene.fps), mime ? { mimeType: mime } : undefined);
    const chunks: Blob[] = [];
    rec.ondataavailable = (e) => e.data.size && chunks.push(e.data);
    const stopped = new Promise((r) => (rec.onstop = r));
    rec.start();
    const t0 = performance.now();
    for (let f = 0; f < scene.frames; f++) {
      renderSceneFrame(scene, f, img);
      ctx.putImageData(img, 0, 0);
      const wait = t0 + ((f + 1) * 1000) / scene.fps - performance.now();
      await new Promise((r) => setTimeout(r, Math.max(0, wait)));
    }
    rec.stop();
    await stopped;
    setExporting(false);
    downloadBlob(`lancamento-obliquo.${(rec.mimeType || "video/webm").includes("mp4") ? "mp4" : "webm"}`, new Blob(chunks, { type: rec.mimeType || "video/webm" }));
  };

  // ── edição da calibração ──
  const moveHandle = (h: Handle, p: Vec2) => {
    setCal((c) => {
      if (h === "rulerA") return { ...c, rulerA: p };
      if (h === "rulerB") return { ...c, rulerB: p };
      if (h === "origin") return { ...c, origin: p };
      return { ...c, angle: angleFromHandle(c.origin, p) };
    });
  };

  const nearest = (p: Vec2, among: Handle[], maxDist: number): Handle | null => {
    let best: Handle | null = null, bd = maxDist;
    for (const h of among) {
      const q = handlePos(h, cal, size.w);
      const d = Math.hypot(q.x - p.x, q.y - p.y);
      if (d < bd) {
        bd = d;
        best = h;
      }
    }
    return best;
  };

  const toolHandles: Handle[] = tool === "regua" ? ["rulerA", "rulerB"] : tool === "eixos" ? ["origin", "axis"] : [];

  // ── rastreamento ──
  const runAuto = async (from: number, tr: Tracker) => {
    cancelRef.current = false;
    setRunning(true);
    let f = from + step, lost = false;
    const end = range[1];
    while (f <= end && !cancelRef.current) {
      wantRef.current = f;
      const img = await grab(f);
      if (!img || cancelRef.current) break;
      const q = tr.next(img);
      imgRef.current = img;
      setFrame(f);
      if (!q) {
        lost = true;
        break;
      }
      const ff = f;
      setTrack((t) => ({ ...t, [ff]: q }));
      setTick((t) => t + 1);
      f += step;
      await new Promise((r) => requestAnimationFrame(() => r(null)));
    }
    setRunning(false);
    setStatus(
      lost
        ? `Objeto perdido no quadro ${f}. Clique nele neste quadro para continuar (ou aumente o raio de busca/tolerância).`
        : cancelRef.current
          ? "Rastreamento interrompido."
          : "Rastreamento concluído até o fim do intervalo.",
    );
  };

  const mark = (p: Vec2) => {
    const img = imgRef.current;
    if (!img || running) return;
    if (!(metersPerPixel(cal) > 0)) setStatus("Atenção: a régua de calibração tem comprimento zero.");
    if (frame < range[0] || frame > range[1]) setStatus("Este quadro está fora do intervalo de análise: o ponto não entra na tabela.");
    if (trackKind === "manual") {
      setTrack((t) => ({ ...t, [frame]: p }));
      const nf = frame + step;
      if (nf <= Math.min(range[1], lastFrame)) setFrame(nf);
      else setStatus("Último quadro do intervalo marcado.");
      return;
    }
    const tr = new Tracker({ mode: trackKind, ...opts });
    const q = tr.init(img, p);
    setTrack((t) => ({ ...t, [frame]: q }));
    setStatus("Rastreando… (Esc ou “Parar” interrompe)");
    void runAuto(frame, tr);
  };

  // ── ponteiro ──
  const toImg = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const c = e.currentTarget, r = c.getBoundingClientRect();
    return { p: { x: ((e.clientX - r.left) * c.width) / r.width, y: ((e.clientY - r.top) * c.height) / r.height }, k: c.width / r.width };
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!imgRef.current) return;
    const { p, k } = toImg(e);
    if (tool === "rastrear") {
      mark(p);
      return;
    }
    let h = nearest(p, HANDLES, 18 * k);
    if (!h) {
      if (tool === "regua") {
        setCal((c) => ({ ...c, rulerA: p, rulerB: p }));
        h = "rulerB";
      } else {
        moveHandle("origin", p);
        h = "origin";
      }
    }
    dragRef.current = h;
    e.currentTarget.setPointerCapture(e.pointerId);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (dragRef.current) moveHandle(dragRef.current, toImg(e).p);
  };

  const onPointerUp = () => {
    dragRef.current = null;
  };

  const go = (f: number) => setFrame(Math.max(0, Math.min(lastFrame, Math.round(f))));

  const onKeyDown = (e: React.KeyboardEvent<HTMLCanvasElement>) => {
    const c = cursor ?? { x: size.w / 2, y: size.h / 2 };
    const d = e.shiftKey ? 10 : 1;
    const moves: Record<string, [number, number]> = { ArrowLeft: [-d, 0], ArrowRight: [d, 0], ArrowUp: [0, -d], ArrowDown: [0, d] };
    const mv = moves[e.key];
    if (mv) {
      e.preventDefault();
      const n = { x: Math.max(0, Math.min(size.w, c.x + mv[0])), y: Math.max(0, Math.min(size.h, c.y + mv[1])) };
      setCursor(n);
      if (grabbed) moveHandle(grabbed, n);
      return;
    }
    switch (e.key) {
      case "PageDown":
      case ".":
        e.preventDefault();
        go(frame + step);
        break;
      case "PageUp":
      case ",":
        e.preventDefault();
        go(frame - step);
        break;
      case "Home":
        e.preventDefault();
        go(range[0]);
        break;
      case "End":
        e.preventDefault();
        go(range[1]);
        break;
      case "Enter":
      case " ": {
        e.preventDefault();
        if (tool === "rastrear") {
          mark(c);
        } else if (grabbed) {
          setStatus(`${handleNames[grabbed]} posicionado.`);
          setGrabbed(null);
        } else {
          const h = nearest(c, toolHandles, Infinity);
          if (h) {
            setGrabbed(h);
            setCursor(handlePos(h, cal, size.w));
            setStatus(`Movendo ${handleNames[h]}: use as setas (Shift = 10 px) e Enter para soltar.`);
          }
        }
        break;
      }
      case "Escape":
        cancelRef.current = true;
        setGrabbed(null);
        break;
    }
  };

  // ── resultados ──
  const scale = metersPerPixel(cal);
  const rows = useMemo(() => {
    if (!(scale > 0)) return [];
    const inRange = trackList.filter(([f]) => f >= range[0] && f <= range[1]);
    return kinematics(trackToSamples(inRange, cal, fps, range[0]));
  }, [trackList, range, cal, fps, scale]);

  const ts = useMemo(() => rows.map((r) => r.t), [rows]);
  const xsW = useMemo(() => rows.map((r) => r.x), [rows]);
  const ysW = useMemo(() => rows.map((r) => r.y), [rows]);
  const vs = useMemo(() => rows.map((r) => r[velComp]), [rows, velComp]);

  const exportCsv = () =>
    downloadText(
      "videoanalise.csv",
      tableToCsv(
        ["t (s)", "x (m)", "y (m)", "vx (m/s)", "vy (m/s)", "v (m/s)"],
        rows.map((r) => [r.t, r.x, r.y, r.vx, r.vy, r.v]),
      ),
    );

  const removePoint = () =>
    setTrack((t) => {
      const n = { ...t };
      delete n[frame];
      return n;
    });

  const tRel = (frame - range[0]) / fps;
  const angleDeg = (cal.angle * 180) / Math.PI;

  return (
    <div className="lab-page">
      <header className="lab-head">
        <h1>Videoanálise</h1>
        <p>
          Filme um movimento com o celular (ou use o vídeo de exemplo), calibre a escala com um objeto de tamanho conhecido, marque o objeto quadro a quadro e
          obtenha posição, velocidade e o ajuste das curvas — como no Tracker, direto no navegador.
        </p>
      </header>

      <section className="lab-panel" aria-label="Origem do vídeo">
        <div className="lab-row">
          <button className="fl-primary" onClick={() => fileRef.current?.click()}>
            Abrir vídeo
          </button>
          <input ref={fileRef} type="file" accept="video/*" hidden onChange={(e) => void openFile(e.target.files?.[0])} />
          {!camera ? (
            <button onClick={() => void openCamera()}>Usar a câmera</button>
          ) : (
            <>
              {!recording ? (
                <button className="fl-primary" onClick={startRecording}>
                  Gravar
                </button>
              ) : (
                <button className="fl-primary" onClick={stopRecording}>
                  Parar gravação
                </button>
              )}
              <button onClick={stopCamera} disabled={recording}>
                Fechar câmera
              </button>
            </>
          )}
          <button onClick={openExample}>Vídeo de exemplo</button>
          {source?.kind === "exemplo" && (
            <button onClick={() => void downloadExample()} disabled={exporting}>
              {exporting ? "Gerando arquivo…" : "Baixar exemplo (WebM)"}
            </button>
          )}
        </div>
        <p className="lab-muted lab-small" style={{ margin: 0 }}>
          Dicas de filmagem: câmera parada e perpendicular ao plano do movimento, objeto de cor contrastante, boa iluminação (menos borrão) e uma régua ou objeto
          conhecido no mesmo plano. No celular, “Abrir vídeo” também permite gravar com o app da câmera (vídeos em câmera lenta funcionam: informe a taxa real).
        </p>
      </section>

      <div className="lab-grid">
        <section className="lab-panel" aria-label="Vídeo">
          <div className="lab-stage">
            <video ref={videoRef} className={camera ? "lab-live" : "lab-hidden-video"} muted playsInline aria-label="Pré-visualização da câmera" />
            {recording && <span className="lab-rec">● gravando</span>}
            {!camera && source && (
              <canvas
                ref={canvasRef}
                width={size.w}
                height={size.h}
                tabIndex={0}
                role="application"
                aria-roledescription="quadro do vídeo"
                aria-label={`Quadro ${frame} de ${lastFrame}. Ferramenta: ${tool === "regua" ? "régua" : tool === "eixos" ? "eixos" : "rastrear"}. Setas movem o cursor, Enter marca ou pega uma alça, PageUp e PageDown mudam de quadro.`}
                onPointerDown={onPointerDown}
                onPointerMove={onPointerMove}
                onPointerUp={onPointerUp}
                onPointerCancel={onPointerUp}
                onKeyDown={onKeyDown}
                onFocus={() => setFocused(true)}
                onBlur={() => setFocused(false)}
              />
            )}
            {!camera && !source && <p className="lab-empty">Abra um vídeo, use a câmera ou gere o vídeo de exemplo.</p>}
          </div>

          {source && !camera && (
            <div className="lab-frame">
              <div className="lab-row">
                <button onClick={() => go(range[0])} aria-label="Ir para o início do intervalo" disabled={running}>
                  ⏮
                </button>
                <button onClick={() => go(frame - step)} aria-label="Quadro anterior" disabled={running}>
                  ◀
                </button>
                <button onClick={() => go(frame + step)} aria-label="Próximo quadro" disabled={running}>
                  ▶
                </button>
                <button onClick={() => go(range[1])} aria-label="Ir para o fim do intervalo" disabled={running}>
                  ⏭
                </button>
                <span className="lab-clock" aria-live="off">
                  quadro {frame}/{lastFrame} · t = {num(tRel, 4)} s
                </span>
              </div>
              <input type="range" min={0} max={lastFrame} value={frame} onChange={(e) => go(Number(e.target.value))} aria-label="Quadro" disabled={running} />
            </div>
          )}
          <p className="lab-status" role="status" aria-live="polite">
            {status}
          </p>
          {source && !camera && (
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              Teclado: <span className="lab-kbd">Tab</span> até o vídeo, <span className="lab-kbd">setas</span> movem o cursor (
              <span className="lab-kbd">Shift</span> = 10 px), <span className="lab-kbd">Enter</span> marca o ponto ou pega/solta uma alça,{" "}
              <span className="lab-kbd">PageUp</span>/<span className="lab-kbd">PageDown</span> trocam de quadro, <span className="lab-kbd">Esc</span> para o
              rastreamento.
            </p>
          )}
        </section>

        <aside className="lab-stack" aria-label="Ferramentas">
          <section className="lab-panel">
            <h2>1. Ferramenta</h2>
            <div className="lab-tabs" role="group" aria-label="Ferramenta">
              {(
                [
                  ["regua", "Régua"],
                  ["eixos", "Eixos"],
                  ["rastrear", "Rastrear"],
                ] as const
              ).map(([id, label]) => (
                <button key={id} aria-pressed={tool === id} onClick={() => setTool(id)}>
                  {label}
                </button>
              ))}
            </div>
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              {tool === "regua" && "Arraste as pontas da régua (azul) sobre o objeto de referência, ou arraste em área livre para traçar uma nova."}
              {tool === "eixos" && "Arraste a origem (círculo amarelo) e o quadrado na ponta do eixo x para girar os eixos. O eixo y fica 90° no sentido anti-horário."}
              {tool === "rastrear" &&
                (trackKind === "manual"
                  ? "Clique no objeto: o ponto é marcado e o vídeo avança sozinho."
                  : "Clique no objeto uma vez: o rastreador segue sozinho até o fim do intervalo.")}
            </p>
          </section>

          <section className="lab-panel">
            <h2>2. Calibração</h2>
            <div className="lab-fields">
              <label>
                Comprimento da régua (m)
                <input
                  type="number"
                  min={0}
                  step="any"
                  value={cal.rulerLength}
                  onChange={(e) => setCal((c) => ({ ...c, rulerLength: Math.max(0, Number(e.target.value)) }))}
                />
              </label>
              <label>
                Ângulo do eixo x (°)
                <input
                  type="number"
                  step="any"
                  value={+angleDeg.toFixed(2)}
                  onChange={(e) => setCal((c) => ({ ...c, angle: (Number(e.target.value) * Math.PI) / 180 }))}
                />
              </label>
            </div>
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              Escala: {scale > 0 ? `1 px = ${num(scale * 1000, 3)} mm` : "régua sem comprimento"}.
            </p>
            {source?.kind === "exemplo" && (
              <button onClick={() => setCal(sceneCalibration(source.scene))}>Calibrar pela régua do exemplo</button>
            )}
          </section>

          <section className="lab-panel">
            <h2>3. Rastreamento</h2>
            <div className="lab-stack">
              <label>
                Modo
                <select value={trackKind} onChange={(e) => setTrackKind(e.target.value as TrackKind)} disabled={running}>
                  <option value="manual">Manual (clique em cada quadro)</option>
                  <option value="cor">Automático por cor</option>
                  <option value="modelo">Automático por modelo (padrão de imagem)</option>
                </select>
              </label>
            </div>
            {trackKind !== "manual" && (
              <div className="lab-fields">
                <label>
                  Raio de busca (px)
                  <input type="number" min={4} max={200} value={opts.searchRadius} onChange={(e) => setOpts((o) => ({ ...o, searchRadius: Number(e.target.value) || 30 }))} />
                </label>
                {trackKind === "cor" ? (
                  <label>
                    Tolerância de cor
                    <input type="number" min={5} max={250} value={opts.colorTolerance} onChange={(e) => setOpts((o) => ({ ...o, colorTolerance: Number(e.target.value) || 60 }))} />
                  </label>
                ) : (
                  <label>
                    Meia-largura do modelo (px)
                    <input type="number" min={3} max={60} value={opts.templateHalf} onChange={(e) => setOpts((o) => ({ ...o, templateHalf: Number(e.target.value) || 10 }))} />
                  </label>
                )}
              </div>
            )}
            <div className="lab-row">
              {running ? (
                <button className="fl-primary" onClick={() => (cancelRef.current = true)}>
                  Parar
                </button>
              ) : (
                <button onClick={() => setTool("rastrear")} aria-pressed={tool === "rastrear"}>
                  Marcar objeto
                </button>
              )}
              <button onClick={removePoint} disabled={running || !track[frame]}>
                Apagar ponto do quadro
              </button>
              <button onClick={() => setTrack({})} disabled={running || !trackList.length}>
                Apagar trajetória
              </button>
            </div>
          </section>

          <section className="lab-panel">
            <h2>4. Tempo e intervalo</h2>
            <div className="lab-fields">
              <label>
                Quadros por segundo
                <input type="number" min={1} max={2000} step="any" value={fps} onChange={(e) => setFps(Math.max(1, Number(e.target.value) || 30))} disabled={running} />
              </label>
              <label>
                Passo (quadros)
                <input type="number" min={1} max={50} value={step} onChange={(e) => setStep(Math.max(1, Math.round(Number(e.target.value) || 1)))} disabled={running} />
              </label>
              <label>
                Primeiro quadro
                <input type="number" min={0} max={lastFrame} value={range[0]} onChange={(e) => setRange(([, b]) => [Math.max(0, Math.min(b, Math.round(Number(e.target.value)))), b])} disabled={running} />
              </label>
              <label>
                Último quadro
                <input type="number" min={0} max={lastFrame} value={range[1]} onChange={(e) => setRange(([a]) => [a, Math.max(a, Math.min(lastFrame, Math.round(Number(e.target.value))))])} disabled={running} />
              </label>
            </div>
            <div className="lab-row">
              <button onClick={() => setRange(([, b]) => [Math.min(frame, b), b])} disabled={running}>
                Início = quadro atual
              </button>
              <button onClick={() => setRange(([a]) => [a, Math.max(frame, a)])} disabled={running}>
                Fim = quadro atual
              </button>
            </div>
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              {detectedFps ? `Detectado: ${num(detectedFps, 4)} quadros/s. ` : ""}Em câmera lenta, informe a taxa real de captura (ex.: 240). t = 0 no primeiro quadro do
              intervalo.
            </p>
          </section>
        </aside>
      </div>

      {rows.length > 0 && (
        <>
          <section className="lab-panel" aria-labelledby="lab-video-table">
            <div className="lab-fit-head">
              <h2 id="lab-video-table">Tabela ({rows.length} pontos)</h2>
              <button onClick={exportCsv}>Exportar CSV</button>
            </div>
            <div className="lab-table-wrap" tabIndex={0} aria-label="Tabela de posições e velocidades">
              <table className="lab-table">
                <thead>
                  <tr>
                    <th scope="col">t (s)</th>
                    <th scope="col">x (m)</th>
                    <th scope="col">y (m)</th>
                    <th scope="col">vx (m/s)</th>
                    <th scope="col">vy (m/s)</th>
                    <th scope="col">v (m/s)</th>
                  </tr>
                </thead>
                <tbody>
                  {rows.map((r, i) => (
                    <tr key={i}>
                      <td>{num(r.t, 5)}</td>
                      <td>{num(r.x)}</td>
                      <td>{num(r.y)}</td>
                      <td>{num(r.vx)}</td>
                      <td>{num(r.vy)}</td>
                      <td>{num(r.v)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <p className="lab-muted lab-small" style={{ margin: 0 }}>
              Velocidades por diferença central, vᵢ = (xᵢ₊₁ − xᵢ₋₁)/(tᵢ₊₁ − tᵢ₋₁); o primeiro e o último ponto ficam sem velocidade.
            </p>
          </section>

          <div className="lab-plots">
            <FitPlot title="Posição x(t)" xs={ts} ys={xsW} xName="t" yName="x" xUnit="s" yUnit="m" theme={theme} defaultFit="linear" />
            <FitPlot
              title="Posição y(t)"
              xs={ts}
              ys={ysW}
              xName="t"
              yName="y"
              xUnit="s"
              yUnit="m"
              theme={theme}
              defaultFit="quadratico"
              hint="Em queda livre ou lançamento, 2·c₂ é a aceleração vertical: deve dar ≈ −9,8 m/s²."
            />
            <FitPlot
              title="Velocidade v(t)"
              xs={ts}
              ys={vs}
              xName="t"
              yName={velComp}
              xUnit="s"
              yUnit="m/s"
              theme={theme}
              defaultFit="linear"
              headerExtra={
                <label className="lab-row lab-small">
                  Componente
                  <select value={velComp} onChange={(e) => setVelComp(e.target.value as "vx" | "vy" | "v")}>
                    <option value="vx">vx</option>
                    <option value="vy">vy</option>
                    <option value="v">|v|</option>
                  </select>
                </label>
              }
            />
          </div>
        </>
      )}
    </div>
  );
}
