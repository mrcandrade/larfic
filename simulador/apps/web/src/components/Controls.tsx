import type { ParamSpec, Params } from "@fisilab/core";

export function Controls({
  specs,
  values,
  onChange,
}: {
  specs: ParamSpec[];
  values: Params;
  onChange: (key: string, value: number) => void;
}) {
  return (
    <div className="controls">
      {specs.map((p) => {
        const v = values[p.key] ?? p.default;
        const id = `param-${p.key}`;
        return (
          <div className="control" key={p.key}>
            <label htmlFor={id}>
              {p.label}
              <span className="value">
                <input
                  type="number"
                  min={p.min}
                  max={p.max}
                  step={p.step}
                  value={v}
                  aria-label={`${p.label} (valor)`}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (Number.isFinite(n)) onChange(p.key, Math.min(p.max, Math.max(p.min, n)));
                  }}
                />
                <span className="unit">{p.unit}</span>
              </span>
            </label>
            <input
              id={id}
              type="range"
              min={p.min}
              max={p.max}
              step={p.step}
              value={v}
              onChange={(e) => onChange(p.key, Number(e.target.value))}
            />
          </div>
        );
      })}
    </div>
  );
}
