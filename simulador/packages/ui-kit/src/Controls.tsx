import type { ParamSpec, Params } from "@fisilab/core";

interface Props {
  specs: ParamSpec[];
  values: Params;
  onChange(key: string, value: number): void;
  /** Parâmetros travados pelo professor: aparecem, mas não podem ser alterados. */
  locked?: string[];
}

export function Controls({ specs, values, onChange, locked = [] }: Props) {
  return (
    <div className="fl-controls">
      {specs.map((p) => {
        const v = values[p.key] ?? p.default;
        const id = `param-${p.key}`;
        const disabled = locked.includes(p.key);
        if (p.options) {
          return (
            <div className="fl-control" key={p.key}>
              <label htmlFor={id}>{p.label}</label>
              <select id={id} value={v} disabled={disabled} onChange={(e) => onChange(p.key, Number(e.target.value))}>
                {p.options.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>
          );
        }
        // Slider logarítmico: a posição do slider é log10 do valor.
        const toSlider = (x: number) => (p.log ? Math.log10(Math.max(x, 1e-300)) : x);
        const fromSlider = (x: number) => (p.log ? Number((10 ** x).toPrecision(3)) : x);
        return (
          <div className="fl-control" key={p.key}>
            <label htmlFor={id}>
              <span>{p.label}</span>
              <span className="fl-value">
                <input
                  type="number"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={v}
                  disabled={disabled}
                  aria-label={`${p.label} (valor)`}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (e.target.value !== "" && Number.isFinite(n)) onChange(p.key, Math.min(p.max, Math.max(p.min, n)));
                  }}
                />
                <span className="fl-unit">{p.unit}</span>
              </span>
            </label>
            <input
              id={id}
              type="range"
              min={toSlider(p.min)}
              max={toSlider(p.max)}
              step={p.log ? 0.01 : p.step}
              value={toSlider(v)}
              disabled={disabled}
              aria-valuetext={`${String(v).replace(".", ",")}${p.unit ? ` ${p.unit}` : ""}`}
              onChange={(e) => onChange(p.key, fromSlider(Number(e.target.value)))}
            />
          </div>
        );
      })}
    </div>
  );
}
