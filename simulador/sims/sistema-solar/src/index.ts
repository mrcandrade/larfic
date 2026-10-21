import { defineSim, draw } from "@fisilab/core";

export const sistemaSolar = defineSim({
  id: "sistema-solar",
  title: "Sistema solar: n corpos, fases da Lua e movimento retrógrado",
  course: "FG I",
  topic: "Gravitação",
  priority: "P1",
  summary: "",
  equations: [],
  params: [{ key: "a", label: "Parâmetro", unit: "", min: 0, max: 1, step: 0.01, default: 0.5 }],
  observables: [{ key: "x", label: "x", unit: "m", value: (s) => s[0] ?? 0 }],
  scenarios: [],
  init: () => [0, 0],
  derivatives: ([, v = 0]) => [v, 0],
  viewport: () => ({ xMin: -1, xMax: 1, yMin: -1, yMax: 1, unit: "m" }),
  render(ctx, frame) {
    const d = draw(ctx, frame);
    d.dot(frame.state[0] ?? 0, 0, 6, frame.theme.accent);
  },
});

export default sistemaSolar;
