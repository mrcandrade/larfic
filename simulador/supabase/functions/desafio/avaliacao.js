//#region packages/core/src/simulation.ts
/** Ajuda a tipar a declaração de uma sim mantendo a inferência do estado. */
function defineSim(sim) {
	return sim;
}
function defaultParams(sim) {
	return Object.fromEntries(sim.params.map((p) => [p.key, p.default]));
}
/** Parâmetros padrão sobrescritos por um preset (por exemplo, `scenario.params`). */
function withOverrides(sim, overrides = {}) {
	const p = defaultParams(sim);
	for (const [k, v] of Object.entries(overrides)) if (v !== void 0) p[k] = v;
	return p;
}
/** Lê um parâmetro numérico com valor padrão (evita `?? 0` espalhado pelas sims). */
function num(p, key, fallback = 0) {
	const v = p[key];
	return v === void 0 || Number.isNaN(v) ? fallback : v;
}
//#endregion
//#region packages/core/src/integrators.ts
function axpy(y, k, h) {
	return y.map((yi, i) => yi + h * (k[i] ?? 0));
}
/** Euler explícito: 1ª ordem, didático; perde energia ou ganha conforme o sistema. */
var euler = (f, y, p, t, dt) => axpy(y, f(y, p, t), dt);
/** Runge-Kutta clássico de 4ª ordem. */
var rk4$1 = (f, y, p, t, dt) => {
	const k1 = f(y, p, t);
	const k2 = f(axpy(y, k1, dt / 2), p, t + dt / 2);
	const k3 = f(axpy(y, k2, dt / 2), p, t + dt / 2);
	const k4 = f(axpy(y, k3, dt), p, t + dt);
	return y.map((yi, i) => yi + dt / 6 * ((k1[i] ?? 0) + 2 * (k2[i] ?? 0) + 2 * (k3[i] ?? 0) + (k4[i] ?? 0)));
};
/**
* Velocity Verlet (simplético). Supõe o estado como [q₁..qₙ, v₁..vₙ] e que
* `f` devolve [v₁..vₙ, a₁..aₙ] com a aceleração dependendo só da posição.
* Conserva energia a longo prazo em sistemas conservativos.
*/
var verlet = (f, y, p, t, dt) => {
	const n = y.length / 2;
	if (!Number.isInteger(n)) throw new Error("verlet: o estado precisa ter a forma [q..., v...]");
	const a0 = f(y, p, t).slice(n);
	const q = y.slice(0, n).map((qi, i) => qi + dt * (y[n + i] ?? 0) + .5 * dt * dt * (a0[i] ?? 0));
	const vHalf = y.slice(n).map((vi, i) => vi + .5 * dt * (a0[i] ?? 0));
	const a1 = f([...q, ...vHalf], p, t + dt).slice(n);
	const v = vHalf.map((vi, i) => vi + .5 * dt * (a1[i] ?? 0));
	return [...q, ...v];
};
var DP_C = [
	0,
	1 / 5,
	3 / 10,
	4 / 5,
	8 / 9,
	1,
	1
];
var DP_A = [
	[],
	[1 / 5],
	[3 / 40, 9 / 40],
	[
		44 / 45,
		-56 / 15,
		32 / 9
	],
	[
		19372 / 6561,
		-25360 / 2187,
		64448 / 6561,
		-212 / 729
	],
	[
		9017 / 3168,
		-355 / 33,
		46732 / 5247,
		49 / 176,
		-5103 / 18656
	],
	[
		35 / 384,
		0,
		500 / 1113,
		125 / 192,
		-2187 / 6784,
		11 / 84
	]
];
var DP_B5 = [
	35 / 384,
	0,
	500 / 1113,
	125 / 192,
	-2187 / 6784,
	11 / 84,
	0
];
var DP_B4 = [
	5179 / 57600,
	0,
	7571 / 16695,
	393 / 640,
	-92097 / 339200,
	187 / 2100,
	1 / 40
];
/**
* Dormand–Prince 5(4) com passo adaptativo: integra de t até t + dt com quantos
* subpassos o controle de erro exigir. Bom para sistemas rígidos ou com
* escalas de tempo muito diferentes (órbitas excêntricas, circuitos RLC).
*/
function makeRk45(opts = {}) {
	const rtol = opts.rtol ?? 1e-9;
	const atol = opts.atol ?? 1e-12;
	const hMin = opts.hMin ?? 1e-12;
	return (f, y0, p, t0, dt) => {
		let y = y0.slice();
		let t = t0;
		const tEnd = t0 + dt;
		let h = dt;
		let guard = 0;
		while (t < tEnd - 1e-15 * Math.max(1, Math.abs(tEnd)) && guard++ < 1e5) {
			h = Math.min(h, tEnd - t);
			const k = [];
			for (let s = 0; s < 7; s++) {
				const a = DP_A[s];
				const ys = y.map((yi, i) => {
					let acc = yi;
					for (let j = 0; j < a.length; j++) acc += h * a[j] * (k[j][i] ?? 0);
					return acc;
				});
				k.push(f(ys, p, t + DP_C[s] * h));
			}
			const y5 = y.map((yi, i) => yi + h * DP_B5.reduce((acc, b, s) => acc + b * (k[s][i] ?? 0), 0));
			const y4 = y.map((yi, i) => yi + h * DP_B4.reduce((acc, b, s) => acc + b * (k[s][i] ?? 0), 0));
			let err = 0;
			for (let i = 0; i < y.length; i++) {
				const sc = atol + rtol * Math.max(Math.abs(y[i]), Math.abs(y5[i]));
				err = Math.max(err, Math.abs(y5[i] - y4[i]) / sc);
			}
			if (err <= 1 || h <= hMin) {
				t += h;
				y = y5;
			}
			const factor = err === 0 ? 5 : Math.min(5, Math.max(.2, .9 * err ** -.2));
			h = Math.max(hMin, h * factor);
		}
		return y;
	};
}
var integrators = {
	euler,
	rk4: rk4$1,
	verlet,
	rk45: makeRk45()
};
//#endregion
//#region packages/core/src/runner.ts
function clone(s) {
	return Array.isArray(s) ? s.slice() : structuredClone(s);
}
/**
* Executa uma simulação com passo de tempo fixo, desacoplado da taxa de
* quadros: a UI chama `advance(segundosReais)` e o runner dá quantos passos
* forem necessários. Guarda um histórico de amostras que serve para os
* gráficos, a exportação CSV e para voltar no tempo.
*/
var Runner = class {
	sim;
	params;
	dt;
	integrator;
	speed = 1;
	t = 0;
	state;
	finished = false;
	samples = [];
	sampleEvery;
	maxSamples;
	stepCount = 0;
	accumulator = 0;
	constructor(sim, params, opts = {}) {
		this.sim = sim;
		this.params = { ...params };
		this.dt = opts.dt ?? sim.dt ?? .001;
		this.integrator = opts.integrator ?? sim.integrator ?? "rk4";
		this.sampleEvery = opts.sampleEvery ?? sim.sampleEvery ?? 10;
		this.maxSamples = opts.maxSamples ?? sim.maxSamples ?? 2e4;
		this.state = sim.init(this.params);
		this.record();
	}
	reset(params = this.params) {
		this.params = { ...params };
		this.t = 0;
		this.state = this.sim.init(this.params);
		this.finished = false;
		this.samples = [];
		this.stepCount = 0;
		this.accumulator = 0;
		this.record();
	}
	/** Troca parâmetros sem reiniciar (para parâmetros marcados como `live`). */
	setLiveParams(params) {
		this.params = { ...params };
	}
	/** Substitui o estado (interação do aluno no palco) e grava uma amostra. */
	setState(state) {
		this.state = state;
		this.finished = false;
		this.record();
	}
	/** Avança `realSeconds` de tempo de parede multiplicado por `speed`. */
	advance(realSeconds) {
		if (this.finished) return;
		this.accumulator += realSeconds * this.speed;
		const maxSteps = 5e3;
		let n = 0;
		while (this.accumulator >= this.dt && !this.finished && n < maxSteps) {
			this.stepOnce();
			this.accumulator -= this.dt;
			n++;
		}
		if (n === maxSteps) this.accumulator = 0;
	}
	/** Dá exatamente um passo de integração. */
	stepOnce() {
		if (this.finished) return;
		const next = this.integrate(this.state, this.t, this.dt);
		const tNext = this.t + this.dt;
		const stop = this.sim.stopWhen;
		if (stop && stop(this.state, this.params, this.t) > 0 && stop(next, this.params, tNext) <= 0) {
			const h = this.locateEvent(this.state, this.t, this.dt);
			this.state = this.integrate(this.state, this.t, h);
			this.t += h;
			this.finished = true;
			this.record();
			return;
		}
		this.state = next;
		this.t = tNext;
		this.stepCount++;
		if (this.sim.tEnd !== void 0 && this.t >= this.sim.tEnd - 1e-12) {
			this.finished = true;
			this.record();
			return;
		}
		if (this.stepCount % this.sampleEvery === 0) this.record();
	}
	/** Avança até o fim (ou `tMax`) sem animação: usado em testes e exercícios. */
	runToEnd(tMax = this.sim.tEnd ?? 60) {
		while (!this.finished && this.t < tMax - 1e-12) this.stepOnce();
		return this;
	}
	/** Volta o estado para a amostra gravada mais próxima de `t` (descarta o futuro). */
	rewindTo(t) {
		let i = this.samples.length - 1;
		while (i > 0 && (this.samples[i]?.t ?? 0) > t) i--;
		const s = this.samples[i];
		if (!s) return;
		this.samples.length = i + 1;
		this.state = clone(s.state);
		this.t = s.t;
		this.finished = false;
		this.accumulator = 0;
		this.stepCount = Math.round(s.t / this.dt);
	}
	observe(state = this.state, t = this.t) {
		return this.sim.observables.map((o) => o.value(state, this.params, t));
	}
	/** Valor atual de um observável pela chave ("t" devolve o tempo). */
	value(key) {
		if (key === "t") return this.t;
		const o = this.sim.observables.find((x) => x.key === key);
		if (!o) throw new Error(`${this.sim.id}: observável desconhecido "${key}"`);
		return o.value(this.state, this.params, this.t);
	}
	integrate(y, t, h) {
		if (this.sim.step) return this.sim.step(y, this.params, t, h);
		const f = this.sim.derivatives;
		if (!f) throw new Error(`${this.sim.id}: implemente derivatives ou step`);
		return integrators[this.integrator](f, y, this.params, t, h);
	}
	/** Bissecção no tamanho do passo até o evento cruzar zero. */
	locateEvent(y, t, dt) {
		const stop = this.sim.stopWhen;
		let lo = 0;
		let hi = dt;
		for (let i = 0; i < 60; i++) {
			const mid = (lo + hi) / 2;
			if (stop(this.integrate(y, t, mid), this.params, t + mid) > 0) lo = mid;
			else hi = mid;
		}
		return hi;
	}
	record() {
		this.samples.push({
			t: this.t,
			state: clone(this.state),
			values: this.observe()
		});
		if (this.samples.length > this.maxSamples) this.samples.splice(0, this.samples.length - this.maxSamples);
	}
};
//#endregion
//#region packages/core/src/draw.ts
/**
* Utilitários de desenho em coordenadas do mundo (y para cima). Espessuras,
* tamanhos de fonte e pontas de seta são dados em pixels de tela, então o
* desenho fica legível em qualquer escala.
*
*     render(ctx, frame) {
*       const d = draw(ctx, frame);
*       d.arrow(x, y, vx, vy, { color: d.theme.accent });
*       d.text("v", x + vx, y + vy, { dy: -8 });
*     }
*/
function draw(ctx, frame) {
	const px = 1 / frame.scale;
	const theme = frame.theme;
	function applyStroke(s = {}) {
		ctx.strokeStyle = s.color ?? theme.text;
		ctx.lineWidth = (s.width ?? 1.5) * px;
		ctx.setLineDash((s.dash ?? []).map((v) => v * px));
		ctx.globalAlpha = s.alpha ?? 1;
	}
	function reset() {
		ctx.setLineDash([]);
		ctx.globalAlpha = 1;
	}
	const api = {
		px,
		theme,
		ctx,
		line(x1, y1, x2, y2, s) {
			applyStroke(s);
			ctx.beginPath();
			ctx.moveTo(x1, y1);
			ctx.lineTo(x2, y2);
			ctx.stroke();
			reset();
		},
		polyline(points, s) {
			if (points.length < 2) return;
			applyStroke(s);
			ctx.beginPath();
			points.forEach(([x, y], i) => i === 0 ? ctx.moveTo(x, y) : ctx.lineTo(x, y));
			if (s?.close) ctx.closePath();
			if (s?.fill) {
				ctx.fillStyle = s.fill;
				ctx.fill();
			}
			if (s?.color !== "none") ctx.stroke();
			reset();
		},
		/** Curva y = f(x) amostrada em `n` pontos. */
		plot(f, x0, x1, s) {
			const n = s?.n ?? 200;
			const pts = [];
			for (let i = 0; i <= n; i++) {
				const x = x0 + (x1 - x0) * i / n;
				const y = f(x);
				if (Number.isFinite(y)) pts.push([x, y]);
			}
			api.polyline(pts, s);
		},
		circle(x, y, r, s = {}) {
			const rr = Math.max(r, (s.minPx ?? 0) * px);
			ctx.beginPath();
			ctx.arc(x, y, rr, 0, 2 * Math.PI);
			ctx.globalAlpha = s.alpha ?? 1;
			if (s.fill) {
				ctx.fillStyle = s.fill;
				ctx.fill();
			}
			if (s.stroke) {
				applyStroke({
					...s,
					color: s.stroke
				});
				ctx.stroke();
			}
			reset();
		},
		/** Disco com raio fixo em pixels (marcadores, partículas). */
		dot(x, y, rPx, fill, alpha = 1) {
			ctx.globalAlpha = alpha;
			ctx.fillStyle = fill;
			ctx.beginPath();
			ctx.arc(x, y, rPx * px, 0, 2 * Math.PI);
			ctx.fill();
			ctx.globalAlpha = 1;
		},
		rect(x, y, w, h, s = {}) {
			ctx.globalAlpha = s.alpha ?? 1;
			if (s.fill) {
				ctx.fillStyle = s.fill;
				ctx.fillRect(x, y, w, h);
			}
			if (s.stroke) {
				applyStroke({
					...s,
					color: s.stroke
				});
				ctx.strokeRect(x, y, w, h);
			}
			reset();
		},
		/** Retângulo girado em torno do centro (blocos em planos inclinados). */
		box(cx, cy, w, h, angle, s = {}) {
			ctx.save();
			ctx.translate(cx, cy);
			ctx.rotate(angle);
			api.rect(-w / 2, -h / 2, w, h, s);
			ctx.restore();
		},
		/**
		* Seta de (x, y) a (x + dx, y + dy), em unidades do mundo. Use
		* `arrowPx` quando o comprimento deve ser fixo em pixels.
		*/
		arrow(x, y, dx, dy, s = {}) {
			const len = Math.hypot(dx, dy);
			if (len < 1e-12) return;
			const ux = dx / len;
			const uy = dy / len;
			const head = Math.min((s.head ?? 9) * px, len * .6);
			const color = s.color ?? theme.text;
			applyStroke({
				...s,
				color,
				width: s.width ?? 2
			});
			ctx.beginPath();
			ctx.moveTo(x, y);
			ctx.lineTo(x + dx - ux * head * .6, y + dy - uy * head * .6);
			ctx.stroke();
			ctx.setLineDash([]);
			ctx.fillStyle = color;
			ctx.beginPath();
			ctx.moveTo(x + dx, y + dy);
			ctx.lineTo(x + dx - head * (ux - .45 * uy), y + dy - head * (uy + .45 * ux));
			ctx.lineTo(x + dx - head * (ux + .45 * uy), y + dy - head * (uy - .45 * ux));
			ctx.closePath();
			ctx.fill();
			reset();
		},
		/** Seta com direção (dx, dy) e comprimento em pixels de tela. */
		arrowPx(x, y, dx, dy, lengthPx, s) {
			const len = Math.hypot(dx, dy);
			if (len < 1e-12 || lengthPx < 1) return;
			api.arrow(x, y, dx / len * lengthPx * px, dy / len * lengthPx * px, s);
		},
		/** Texto sempre de pé, ancorado num ponto do mundo. */
		text(str, x, y, s = {}) {
			ctx.save();
			ctx.translate(x, y);
			ctx.scale(px, -px);
			ctx.fillStyle = s.color ?? theme.text;
			ctx.font = `${s.weight ?? "400"} ${s.size ?? 12}px system-ui, -apple-system, "Segoe UI", sans-serif`;
			ctx.textAlign = s.align ?? "center";
			ctx.textBaseline = s.baseline ?? "middle";
			ctx.fillText(str, s.dx ?? 0, s.dy ?? 0);
			ctx.restore();
		},
		/** Mola em zigue-zague entre dois pontos. */
		spring(x1, y1, x2, y2, s = {}) {
			const dx = x2 - x1;
			const dy = y2 - y1;
			const len = Math.hypot(dx, dy);
			if (len < 1e-12) return;
			const ux = dx / len;
			const uy = dy / len;
			const coils = s.coils ?? 10;
			const amp = (s.amplitudePx ?? 7) * px;
			const lead = Math.min(len * .12, 12 * px);
			const pts = [[x1, y1], [x1 + ux * lead, y1 + uy * lead]];
			const body = len - 2 * lead;
			for (let i = 1; i < coils * 2; i++) {
				const a = lead + body * i / (coils * 2);
				const side = i % 2 === 0 ? -1 : 1;
				pts.push([x1 + ux * a - uy * amp * side, y1 + uy * a + ux * amp * side]);
			}
			pts.push([x2 - ux * lead, y2 - uy * lead], [x2, y2]);
			api.polyline(pts, s);
		},
		/** Hachura de suporte fixo (teto, parede, chão). */
		support(x1, y1, x2, y2, s = {}) {
			api.line(x1, y1, x2, y2, {
				...s,
				width: s.width ?? 2
			});
			const dx = x2 - x1;
			const dy = y2 - y1;
			const len = Math.hypot(dx, dy);
			const n = Math.max(3, Math.floor(len / px / 10));
			const nx = dy / len;
			const ny = -dx / len;
			for (let i = 0; i <= n; i++) {
				const x = x1 + dx * i / n;
				const y = y1 + dy * i / n;
				api.line(x, y, x + (nx - dx / len) * 7 * px, y + (ny - dy / len) * 7 * px, {
					...s,
					width: 1,
					alpha: .6
				});
			}
		},
		/** Grade de fundo com espaçamento em unidades do mundo. */
		grid(xMin, xMax, yMin, yMax, step, s = {}) {
			applyStroke({
				color: theme.grid,
				width: 1,
				...s
			});
			ctx.beginPath();
			for (let x = Math.ceil(xMin / step) * step; x <= xMax; x += step) {
				ctx.moveTo(x, yMin);
				ctx.lineTo(x, yMax);
			}
			for (let y = Math.ceil(yMin / step) * step; y <= yMax; y += step) {
				ctx.moveTo(xMin, y);
				ctx.lineTo(xMax, y);
			}
			ctx.stroke();
			reset();
		}
	};
	return api;
}
//#endregion
//#region packages/core/src/random.ts
/** Gerador pseudoaleatório determinístico (mulberry32): mesma semente, mesma sequência. */
function rng(seed) {
	let a = seed >>> 0;
	return () => {
		a = a + 1831565813 >>> 0;
		let t = a;
		t = Math.imul(t ^ t >>> 15, t | 1);
		t ^= t + Math.imul(t ^ t >>> 7, t | 61);
		return ((t ^ t >>> 14) >>> 0) / 4294967296;
	};
}
/** Amostra normal padrão (Box–Muller) a partir de um gerador uniforme. */
function gaussian(rand) {
	let u = 0;
	while (u === 0) u = rand();
	return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand());
}
//#endregion
//#region packages/core/src/exercises.ts
/** Formata um número no padrão brasileiro, sem zeros supérfluos. */
function formatBR(v, digits = 4) {
	if (!Number.isFinite(v)) return "—";
	if (v === 0) return "0";
	const a = Math.abs(v);
	if (a >= 1e6 || a < .001) {
		const [m, e] = v.toExponential(digits - 1).split("e");
		return `${Number(m).toString().replace(".", ",")} × 10^${Number(e)}`;
	}
	return Number(v.toPrecision(digits)).toString().replace(".", ",");
}
/** Número formatado para KaTeX: vírgula decimal sem espaço extra e potência de dez em notação científica. */
function texNum(v, digits = 3) {
	if (!Number.isFinite(v)) return String.raw`\text{—}`;
	if (v === 0) return "0";
	const a = Math.abs(v);
	if (a >= 1e5 || a < .001) {
		const [m, e] = v.toExponential(digits - 1).split("e");
		return `${m.replace(".", "{,}")} \\times 10^{${Number(e)}}`;
	}
	return Number(v.toPrecision(digits)).toString().replace(".", "{,}");
}
//#endregion
//#region packages/core/src/vec.ts
var clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
//#endregion
//#region packages/core/src/mna.ts
var GMIN = 1e-12;
var VT = .025852;
/** Resolve A x = b por eliminação gaussiana com pivotamento parcial. Retorna null se singular. */
function solveLinear(A, b) {
	const n = b.length;
	const M = A.map((row, i) => [...row, b[i]]);
	for (let c = 0; c < n; c++) {
		let p = c;
		for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
		if (Math.abs(M[p][c]) < 1e-18) return null;
		[M[c], M[p]] = [M[p], M[c]];
		const piv = M[c][c];
		for (let r = c + 1; r < n; r++) {
			const f = M[r][c] / piv;
			if (f === 0) continue;
			for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k];
		}
	}
	const x = new Array(n).fill(0);
	for (let r = n - 1; r >= 0; r--) {
		let s = M[r][n];
		for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k];
		x[r] = s / M[r][r];
	}
	return x;
}
/**
* Resolve o circuito. Sem `dt`, calcula o regime DC (capacitor aberto,
* indutor em curto). Com `dt`, dá um passo transitório pela regra do trapézio.
*/
function solveCircuit(nodeCount, elements, dt) {
	const N = nodeCount - 1;
	const branch = /* @__PURE__ */ new Map();
	elements.forEach((e, k) => {
		if (e.kind === "V" || e.kind === "L" && dt === void 0) branch.set(k, N + branch.size);
	});
	const size = N + branch.size;
	const vGuess = new Array(nodeCount).fill(0);
	const diodes = elements.some((e) => e.kind === "D");
	let converged = !diodes;
	let x = null;
	for (let iter = 0; iter < (diodes ? 200 : 1); iter++) {
		const A = Array.from({ length: size }, () => new Array(size).fill(0));
		const z = new Array(size).fill(0);
		const stampG = (a, b, g) => {
			if (a > 0) A[a - 1][a - 1] += g;
			if (b > 0) A[b - 1][b - 1] += g;
			if (a > 0 && b > 0) {
				A[a - 1][b - 1] -= g;
				A[b - 1][a - 1] -= g;
			}
		};
		const stampI = (a, b, I) => {
			if (a > 0) z[a - 1] -= I;
			if (b > 0) z[b - 1] += I;
		};
		for (let n = 1; n < nodeCount; n++) A[n - 1][n - 1] += GMIN;
		elements.forEach((e, k) => {
			switch (e.kind) {
				case "R":
					stampG(e.a, e.b, 1 / Math.max(e.R, 1e-9));
					break;
				case "I":
					stampI(e.a, e.b, e.I);
					break;
				case "V": {
					const m = branch.get(k);
					if (e.a > 0) {
						A[e.a - 1][m] += 1;
						A[m][e.a - 1] += 1;
					}
					if (e.b > 0) {
						A[e.b - 1][m] -= 1;
						A[m][e.b - 1] -= 1;
					}
					A[m][m] -= e.R ?? 0;
					z[m] = e.V;
					break;
				}
				case "C":
					if (dt === void 0) stampG(e.a, e.b, GMIN);
					else if (e.i0 === void 0) {
						const G = e.C / dt;
						stampG(e.a, e.b, G);
						stampI(e.b, e.a, G * e.v0);
					} else {
						const G = 2 * e.C / dt;
						stampG(e.a, e.b, G);
						stampI(e.b, e.a, G * e.v0 + e.i0);
					}
					break;
				case "L":
					if (dt === void 0) {
						const m = branch.get(k);
						if (e.a > 0) {
							A[e.a - 1][m] += 1;
							A[m][e.a - 1] += 1;
						}
						if (e.b > 0) {
							A[e.b - 1][m] -= 1;
							A[m][e.b - 1] -= 1;
						}
					} else if (e.v0 === void 0) {
						stampG(e.a, e.b, dt / e.L);
						stampI(e.a, e.b, e.i0);
					} else {
						const G = dt / (2 * e.L);
						stampG(e.a, e.b, G);
						stampI(e.a, e.b, e.i0 + G * e.v0);
					}
					break;
				case "D": {
					const Is = e.Is ?? 2.52e-9;
					const nVt = (e.n ?? 1.752) * VT;
					const vd = Math.min((vGuess[e.a] ?? 0) - (vGuess[e.b] ?? 0), 1.2);
					const ex = Math.exp(vd / nVt);
					const id = Is * (ex - 1);
					const gd = Is / nVt * ex + GMIN;
					stampG(e.a, e.b, gd);
					stampI(e.a, e.b, id - gd * vd);
					break;
				}
			}
		});
		x = solveLinear(A, z);
		if (!x) break;
		if (!diodes) break;
		let maxDelta = 0;
		for (let n = 1; n < nodeCount; n++) {
			const delta = x[n - 1] - vGuess[n];
			maxDelta = Math.max(maxDelta, Math.abs(delta));
			vGuess[n] = vGuess[n] + Math.max(-.5, Math.min(.5, delta));
		}
		if (maxDelta < 1e-9) {
			converged = true;
			break;
		}
	}
	if (!x) {
		const zeros = elements.map(() => 0);
		return {
			v: new Array(nodeCount).fill(0),
			i: zeros,
			dv: zeros.slice(),
			converged: false,
			singular: true
		};
	}
	const v = [0, ...x.slice(0, N)];
	const dv = elements.map((e) => v[e.a] - v[e.b]);
	return {
		v,
		i: elements.map((e, k) => {
			switch (e.kind) {
				case "R": return dv[k] / Math.max(e.R, 1e-9);
				case "I": return e.I;
				case "V":
				case "L":
					if (e.kind === "L" && dt !== void 0) {
						if (e.v0 === void 0) return e.i0 + dt / e.L * dv[k];
						const G = dt / (2 * e.L);
						return G * dv[k] + e.i0 + G * e.v0;
					}
					return x[branch.get(k)];
				case "C":
					if (dt === void 0) return 0;
					if (e.i0 === void 0) return e.C / dt * (dv[k] - e.v0);
					return 2 * e.C / dt * (dv[k] - e.v0) - e.i0;
				case "D": {
					const Is = e.Is ?? 2.52e-9;
					const nVt = (e.n ?? 1.752) * VT;
					return Is * (Math.exp(Math.min(dv[k], 1.2) / nVt) - 1);
				}
			}
		}),
		dv,
		converged,
		singular: false
	};
}
/** Atualiza o histórico de capacitores e indutores após um passo transitório. */
function commitHistory(elements, sol) {
	elements.forEach((e, k) => {
		if (e.kind === "C" || e.kind === "L") {
			e.v0 = sol.dv[k];
			e.i0 = sol.i[k];
		}
	});
}
/** Une nós ligados por fios ideais (union-find) e renumera a partir do terra. */
var NodeMap = class {
	parent = /* @__PURE__ */ new Map();
	find(k) {
		let r = k;
		while (this.parent.get(r) !== void 0 && this.parent.get(r) !== r) r = this.parent.get(r);
		this.parent.set(k, r);
		return r;
	}
	add(k) {
		if (!this.parent.has(k)) this.parent.set(k, k);
	}
	union(a, b) {
		this.add(a);
		this.add(b);
		const ra = this.find(a);
		const rb = this.find(b);
		if (ra !== rb) this.parent.set(ra, rb);
	}
	/** Numeração final: `ground` vira 0, os demais grupos 1..n-1. */
	number(ground) {
		const ids = /* @__PURE__ */ new Map();
		if (ground !== void 0) {
			this.add(ground);
			ids.set(this.find(ground), 0);
		}
		let next = ids.size ? 1 : 0;
		for (const k of this.parent.keys()) {
			const r = this.find(k);
			if (!ids.has(r)) ids.set(r, next++);
		}
		return {
			index: (k) => ids.get(this.find(k)) ?? 0,
			count: Math.max(next, 1)
		};
	}
};
//#endregion
//#region sims/braquistocrona/src/index.ts
var modo = (p) => Math.round(num(p, "modo"));
var G$3 = (p) => num(p, "g", 9.8);
var MU$1 = (p) => num(p, "mu", 0);
var N_PTS = 900;
function buildCurve(name, color, pts) {
	const n = pts.length;
	const xs = pts.map((q) => q[0]);
	const ys = pts.map((q) => q[1]);
	const S = [0];
	for (let i = 1; i < n; i++) S.push(S[i - 1] + Math.hypot(xs[i] - xs[i - 1], ys[i] - ys[i - 1]));
	const tx = [];
	const ty = [];
	for (let i = 0; i < n; i++) {
		const a = Math.max(0, i - 1);
		const b = Math.min(n - 1, i + 1);
		const dx = xs[b] - xs[a];
		const dy = ys[b] - ys[a];
		const l = Math.hypot(dx, dy) || 1;
		tx.push(dx / l);
		ty.push(dy / l);
	}
	const kx = [];
	const ky = [];
	for (let i = 0; i < n; i++) {
		const a = Math.max(0, i - 1);
		const b = Math.min(n - 1, i + 1);
		const ds = S[b] - S[a] || 1;
		kx.push((tx[b] - tx[a]) / ds);
		ky.push((ty[b] - ty[a]) / ds);
	}
	return {
		name,
		color,
		xs,
		ys,
		S,
		tx,
		ty,
		kx,
		ky,
		total: S[n - 1]
	};
}
/** Parâmetro θ_B da cicloide que passa por (X, −Y): (θ − sen θ)/(1 − cos θ) = X/Y. */
function cycloidTheta(X, Y) {
	const f = (t) => (t - Math.sin(t)) / (1 - Math.cos(t)) - X / Y;
	let lo = 1e-6;
	let hi = 2 * Math.PI - 1e-6;
	for (let i = 0; i < 100; i++) {
		const m = (lo + hi) / 2;
		if (f(m) < 0) lo = m;
		else hi = m;
	}
	return (lo + hi) / 2;
}
var cycloidR = (X, Y) => Y / (1 - Math.cos(cycloidTheta(X, Y)));
/** Tempos exatos sem atrito. */
var tLine = (X, Y, g = 9.8) => Math.sqrt(2 * (X * X + Y * Y) / (g * Y));
var tCycloid = (X, Y, g = 9.8) => cycloidTheta(X, Y) * Math.sqrt(cycloidR(X, Y) / g);
var sample = (n, f) => Array.from({ length: n + 1 }, (_, i) => f(i / n));
function raceCurves(X, Y, drawn) {
	const th = cycloidTheta(X, Y);
	const R = Y / (1 - Math.cos(th));
	const c = (X * X + Y * Y) / (2 * X);
	let psiB = Math.atan2(-Y, X - c);
	if (psiB < 0) psiB += 2 * Math.PI;
	const out = [
		buildCurve("reta", 0, sample(N_PTS, (u) => [X * u, -Y * u])),
		buildCurve("cicloide", 1, sample(N_PTS, (u) => {
			const t = th * u * u;
			return [R * (t - Math.sin(t)), -R * (1 - Math.cos(t))];
		})),
		buildCurve("arco de círculo", 2, sample(N_PTS, (u) => {
			const q = Math.PI + (psiB - Math.PI) * u;
			return [c + c * Math.cos(q), c * Math.sin(q)];
		})),
		buildCurve("parábola", 3, sample(N_PTS, (u) => [X * u * u, -Y * u]))
	];
	if (drawn.length > 2) out.push(buildCurve("sua curva", 4, drawn));
	return out;
}
function tautoCurves(R) {
	const cyc = buildCurve("cicloide", 1, sample(N_PTS, (u) => {
		const t = 2 * Math.PI * u;
		return [R * (t - Math.sin(t)), -R * (1 - Math.cos(t))];
	}));
	const Rc = 4 * R;
	const am = Math.acos(.5);
	const cx = Math.PI * R;
	const cy = -2.6 * R - 2 * R + Rc;
	return [cyc, buildCurve("círculo (raio 4R)", 2, sample(N_PTS, (u) => {
		const q = -Math.PI / 2 - am + 2 * am * u;
		return [cx + Rc * Math.cos(q), cy + Rc * Math.sin(q)];
	}))];
}
/** Ponto de partida de cada conta na tautocronia: frações da altura 2R. */
var TAUTO_H = [
	1,
	.75,
	.45,
	.15
];
var cache$1 = /* @__PURE__ */ new Map();
function curvesOf(s, p) {
	const key = modo(p) === 1 ? `t|${num(p, "Rc", .5)}` : `r|${s.bx}|${s.by}|${s.gid}`;
	let c = cache$1.get(key);
	if (!c) {
		if (cache$1.size > 30) cache$1.clear();
		c = modo(p) === 1 ? tautoCurves(num(p, "Rc", .5)) : raceCurves(s.bx, -s.by, s.drawn);
		cache$1.set(key, c);
	}
	return c;
}
function locate(c, s) {
	let lo = 0;
	let hi = c.S.length - 1;
	if (s <= 0) return [0, 0];
	if (s >= c.total) return [hi - 1, 1];
	while (hi - lo > 1) {
		const m = lo + hi >> 1;
		if (c.S[m] <= s) lo = m;
		else hi = m;
	}
	const seg = c.S[lo + 1] - c.S[lo];
	return [lo, seg > 0 ? (s - c.S[lo]) / seg : 0];
}
function pointAt(c, s) {
	const [i, f] = locate(c, s);
	return [c.xs[i] + f * (c.xs[i + 1] - c.xs[i]), c.ys[i] + f * (c.ys[i + 1] - c.ys[i])];
}
/** Arco em que a curva atinge a altura y pela primeira vez (descendo). */
function arcAtHeight(c, y) {
	for (let i = 1; i < c.ys.length; i++) if (c.ys[i] <= y) return c.S[i - 1] + (c.ys[i - 1] - y) / (c.ys[i - 1] - c.ys[i]) * (c.S[i] - c.S[i - 1]);
	return 0;
}
/** Aceleração tangencial; NaN sinaliza "parada por atrito estático". */
function accel$1(c, s, v, g, mu) {
	const [i, f] = locate(c, s);
	const lerp = (a) => a[i] + f * (a[i + 1] - a[i]);
	let tx = lerp(c.tx);
	let ty = lerp(c.ty);
	const l = Math.hypot(tx, ty) || 1;
	tx /= l;
	ty /= l;
	const gt = -g * ty;
	if (mu === 0) return gt;
	const gpx = -gt * tx;
	const gpy = -g - gt * ty;
	const N = Math.hypot(v * v * lerp(c.kx) - gpx, v * v * lerp(c.ky) - gpy);
	if (Math.abs(v) < 1e-9) return Math.abs(gt) <= mu * N ? NaN : gt - mu * N * Math.sign(gt);
	return gt - mu * N * Math.sign(v);
}
function stepBead(b, c, g, mu, t, dt) {
	if (b.stuck || b.arr >= 0 && b.goal >= c.total) return b;
	const a0 = accel$1(c, b.s, b.v, g, mu);
	if (Number.isNaN(a0)) return {
		...b,
		v: 0,
		stuck: true
	};
	const f = (s, v) => {
		const a = accel$1(c, s, v, g, mu);
		return [v, Number.isNaN(a) ? 0 : a];
	};
	const [k1s, k1v] = [b.v, a0];
	const [k2s, k2v] = f(b.s + dt / 2 * k1s, b.v + dt / 2 * k1v);
	const [k3s, k3v] = f(b.s + dt / 2 * k2s, b.v + dt / 2 * k2v);
	const [k4s, k4v] = f(b.s + dt * k3s, b.v + dt * k3v);
	let s = b.s + dt / 6 * (k1s + 2 * k2s + 2 * k3s + k4s);
	let v = b.v + dt / 6 * (k1v + 2 * k2v + 2 * k3v + k4v);
	if (mu > 0 && v * b.v < 0) v = 0;
	let arr = b.arr;
	if (arr < 0 && s >= b.goal) {
		arr = t + dt * (b.goal - b.s) / Math.max(1e-12, s - b.s);
		if (b.goal >= c.total) s = c.total;
	}
	if (s < 0) {
		s = 0;
		v = Math.max(0, v);
		if (v === 0 && accel$1(c, 0, 0, g, mu) <= 0) return {
			...b,
			s,
			v,
			arr,
			stuck: true
		};
	}
	if (s > c.total) {
		s = c.total;
		v = 0;
	}
	return {
		...b,
		s,
		v,
		arr
	};
}
function freshBeads(curves, p) {
	if (modo(p) === 1) {
		const R = num(p, "Rc", .5);
		const out = [];
		for (const [ci, c] of curves.entries()) {
			const top = c.ys[0];
			const bottomS = c.total / 2;
			for (const h of TAUTO_H) {
				const s0 = h === 1 ? 0 : arcAtHeight(c, top - (1 - h) * 2 * R);
				out.push({
					c: ci,
					s: s0,
					v: 0,
					goal: bottomS,
					arr: -1,
					stuck: false
				});
			}
		}
		return out;
	}
	return curves.map((c, i) => ({
		c: i,
		s: 0,
		v: 0,
		goal: c.total,
		arr: -1,
		stuck: false
	}));
}
/** Tempo de percurso de uma curva, integrado à parte (previsão numérica). */
function travelTime(c, g, mu, dt = 2e-4, tMax = 30) {
	let b = {
		c: 0,
		s: 0,
		v: 0,
		goal: c.total,
		arr: -1,
		stuck: false
	};
	let t = 0;
	while (b.arr < 0 && !b.stuck && t < tMax) {
		b = stepBead(b, c, g, mu, t, dt);
		t += dt;
	}
	return b.arr >= 0 ? b.arr : Infinity;
}
var predCache = /* @__PURE__ */ new Map();
function predicted(s, p) {
	const key = `${s.bx}|${s.by}|${s.gid}|${G$3(p)}|${MU$1(p)}`;
	let r = predCache.get(key);
	if (!r) {
		if (predCache.size > 30) predCache.clear();
		r = curvesOf(s, p).map((c) => travelTime(c, G$3(p), MU$1(p), .001));
		predCache.set(key, r);
	}
	return r;
}
function smooth(pts, bx, by) {
	const raw = [
		[0, 0],
		...pts.filter((q) => Math.hypot(q[0], q[1]) > .05 && Math.hypot(q[0] - bx, q[1] - by) > .05),
		[bx, by]
	];
	const c = buildCurve("", 0, raw.map((q, i) => {
		if (i === 0 || i === raw.length - 1) return q;
		let sx = 0;
		let sy = 0;
		let n = 0;
		for (let j = Math.max(0, i - 3); j <= Math.min(raw.length - 1, i + 3); j++) {
			sx += raw[j][0];
			sy += raw[j][1];
			n++;
		}
		return [sx / n, sy / n];
	}));
	return sample(400, (u) => pointAt(c, u * c.total));
}
function reset(s, p, extra = {}) {
	const n = {
		...s,
		...extra,
		tt: 0
	};
	n.beads = freshBeads(curvesOf(n, p), p);
	return n;
}
var finishedRace = (s) => s.beads.every((b) => b.arr >= 0 || b.stuck) || s.tt > 30;
var beadTime = (s, i) => {
	const b = s.beads[i];
	if (!b) return 0;
	return b.arr >= 0 ? b.arr : s.tt;
};
var spread = (s, c) => {
	const ts = s.beads.filter((b) => b.c === c && b.arr >= 0).map((b) => b.arr);
	return ts.length > 1 ? Math.max(...ts) - Math.min(...ts) : 0;
};
var braquistocrona = defineSim({
	id: "braquistocrona",
	title: "Braquistócrona: a curva mais rápida",
	course: "FG I",
	topic: "Energia",
	priority: "P2",
	summary: "Corrida de contas entre A e B em uma reta, uma cicloide, um arco de círculo, uma parábola e uma curva desenhada por você, com tempos calculados numericamente, com e sem atrito; e a tautocronia da cicloide.",
	equations: [
		String.raw`\ddot s = -g\,\frac{dy}{ds} - \mu\,\frac{|N|}{m}\,\text{sinal}(\dot s) \qquad \frac{\vec N}{m} = \dot s^2\,\frac{d\hat t}{ds} - \vec g_\perp`,
		String.raw`\text{sem atrito: } v = \sqrt{2 g\,(y_A - y)} \qquad T = \int_A^B \frac{ds}{\sqrt{2g\,(y_A - y)}}`,
		String.raw`\text{cicloide: } x = R(\theta - \text{sen}\,\theta),\; y = -R(1 - \cos\theta) \qquad T_{AB} = \theta_B\sqrt{R/g}`,
		String.raw`\text{reta: } T = \sqrt{\frac{2(X^2+Y^2)}{gY}} \qquad \text{tautocronia: } T_{fundo} = \pi\sqrt{R/g}\ \text{(de qualquer altura)}`
	],
	liveEquations(s, p) {
		const g = G$3(p);
		if (modo(p) === 1) {
			const R = num(p, "Rc", .5);
			return [String.raw`\pi\sqrt{R/g} = \pi\sqrt{${texNum(R)}/${texNum(g)}} = ${texNum(Math.PI * Math.sqrt(R / g))}\ \text{s} \qquad t = ${texNum(s.tt)}\ \text{s}`];
		}
		const X = s.bx;
		const Y = -s.by;
		return [String.raw`\theta_B = ${texNum(cycloidTheta(X, Y))}\ \text{rad},\; R = ${texNum(cycloidR(X, Y))}\ \text{m} \;\Rightarrow\; T_{cic} = ${texNum(tCycloid(X, Y, g))}\ \text{s} \qquad T_{reta} = ${texNum(tLine(X, Y, g))}\ \text{s}\ (\mu = 0)`];
	},
	params: [
		{
			key: "modo",
			label: "Experimento",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Corrida entre A e B (braquistócrona)"
			}, {
				value: 1,
				label: "Tautocronia: cicloide × círculo"
			}]
		},
		{
			key: "X",
			label: "Distância horizontal de A a B",
			unit: "m",
			min: .5,
			max: 5,
			step: .05,
			default: 3
		},
		{
			key: "Y",
			label: "Desnível de A a B",
			unit: "m",
			min: .2,
			max: 3,
			step: .05,
			default: 1.5
		},
		{
			key: "mu",
			label: "Coeficiente de atrito",
			unit: "",
			min: 0,
			max: .5,
			step: .01,
			default: 0
		},
		{
			key: "Rc",
			label: "Tautocronia: raio do círculo gerador R",
			unit: "m",
			min: .2,
			max: 1.5,
			step: .05,
			default: .5
		},
		{
			key: "g",
			label: "Gravidade",
			unit: "m/s²",
			min: 1,
			max: 25,
			step: .1,
			default: 9.8
		}
	],
	observables: [
		{
			key: "t0",
			label: "Tempo na reta",
			unit: "s",
			value: (s) => beadTime(s, 0)
		},
		{
			key: "t1",
			label: "Tempo na cicloide",
			unit: "s",
			value: (s) => beadTime(s, 1)
		},
		{
			key: "t2",
			label: "Tempo no arco de círculo",
			unit: "s",
			value: (s) => beadTime(s, 2)
		},
		{
			key: "t3",
			label: "Tempo na parábola",
			unit: "s",
			value: (s) => beadTime(s, 3)
		},
		{
			key: "t4",
			label: "Tempo na sua curva",
			unit: "s",
			value: (s, p) => modo(p) === 0 && s.beads.length === 5 ? beadTime(s, 4) : 0
		},
		{
			key: "v1",
			label: "Velocidade na cicloide",
			unit: "m/s",
			value: (s, p) => Math.abs(s.beads[modo(p) === 0 ? 1 : 0]?.v ?? 0)
		},
		{
			key: "dc",
			label: "Tautocronia: dispersão dos tempos na cicloide",
			unit: "s",
			value: (s) => spread(s, 0)
		},
		{
			key: "dk",
			label: "Tautocronia: dispersão dos tempos no círculo",
			unit: "s",
			value: (s) => spread(s, 1)
		}
	],
	chart: {
		x: "t",
		y: "v1"
	},
	scenarios: [
		{
			id: "corrida",
			label: "A corrida das curvas",
			params: {
				modo: 0,
				X: 3,
				Y: 1.5,
				mu: 0
			},
			guide: `### Qual chega primeiro?
1. Quatro contas partem juntas de A, do repouso. A reta é o caminho **mais curto**; será o mais rápido?
2. Rode. A cicloide vence, mesmo descendo abaixo de B e subindo de novo: a queda inicial íngreme dá velocidade cedo.
3. Sem atrito, a velocidade em cada altura é a mesma em todas as curvas: $v = \\sqrt{2g\\,\\Delta h}$. O que muda é **quanto tempo** se leva com velocidade baixa.
4. Arraste o ponto **B** e repita. Desenhe a sua própria curva (arraste a partir de A) e tente vencer a cicloide. Ninguém consegue: Johann Bernoulli provou em 1696 que ela é a braquistócrona.`,
			predict: [{
				question: "Entre A e B, sem atrito, qual conta chega primeiro?",
				options: [
					"a da reta (caminho mais curto)",
					"a da cicloide",
					"a do arco de círculo",
					"chegam juntas (mesma energia)"
				],
				answer: 1,
				explanation: "A energia é a mesma, mas a cicloide converte altura em velocidade logo no começo. O tempo é $\\int ds/v$, e a cicloide minimiza essa integral."
			}]
		},
		{
			id: "atrito",
			label: "Com atrito",
			params: {
				modo: 0,
				X: 3,
				Y: 1.5,
				mu: .15
			},
			guide: `### O atrito muda o vencedor?
1. Com $\\mu = 0{,}15$ a força normal depende da curvatura: $N = m(g\\cos\\alpha + v^2/\\rho)$. Nas curvas fechadas, rápidas, o atrito pesa mais.
2. Compare os tempos com os do cenário sem atrito (tabela no palco, que traz também a previsão numérica).
3. Aumente $\\mu$ até alguma conta parar no caminho. Com atrito, a curva mais rápida já não é exatamente a cicloide.`
		},
		{
			id: "tautocronia",
			label: "Tautocronia",
			params: {
				modo: 1,
				Rc: .5,
				mu: 0
			},
			guide: `### Sempre o mesmo tempo
1. Quatro contas partem de alturas diferentes numa cicloide (em cima) e num círculo de raio $4R$ (embaixo), que tem a mesma curvatura no fundo.
2. Na cicloide, todas chegam ao fundo **juntas**, em $\\pi\\sqrt{R/g}$: é a **tautócrona** (Huygens, 1673), usada em relógios de pêndulo.
3. No círculo, a que parte mais alto chega por último: o período do pêndulo comum depende da amplitude.
4. Compare as dispersões dos tempos nos dois arames (observáveis).`,
			predict: [{
				question: "Na cicloide, uma conta solta da borda e outra solta perto do fundo chegam ao ponto mais baixo:",
				options: [
					"a de perto do fundo antes",
					"juntas",
					"a da borda antes"
				],
				answer: 1,
				explanation: "Na cicloide a força tangencial é proporcional ao arco até o fundo ($\\ddot s = -\\frac{g}{4R}s$): é um oscilador harmônico perfeito, com período independente da amplitude."
			}]
		}
	],
	exercises: [{
		id: "reta",
		prompt: "Uma conta desliza sem atrito numa reta de A até B, com B {X} m à frente e {Y} m abaixo de A, partindo do repouso. Quanto tempo leva? (g = 9,8 m/s²)",
		vary: {
			X: [
				.5,
				4,
				2
			],
			Y: [
				.3,
				2.5,
				2
			]
		},
		answer: {
			label: "T",
			unit: "s",
			compute: (p) => tLine(num(p, "X"), num(p, "Y"), 9.8)
		},
		hint: "Na reta a aceleração é g·Y/L constante."
	}, {
		id: "tauto",
		prompt: "Uma cicloide é gerada por um círculo de raio {Rc} m. Quanto tempo uma conta leva, sem atrito, de qualquer ponto até o fundo? (g = 9,8 m/s²)",
		vary: { Rc: [
			.2,
			1.5,
			2
		] },
		fixed: { modo: 1 },
		answer: {
			label: "T",
			unit: "s",
			compute: (p) => Math.PI * Math.sqrt(num(p, "Rc") / 9.8)
		}
	}],
	init(p) {
		return reset({
			bx: num(p, "X", 3),
			by: -num(p, "Y", 1.5),
			drawn: [],
			draft: [],
			drawing: false,
			dragB: false,
			gid: 0,
			beads: [],
			tt: 0
		}, p);
	},
	step(s, p, _t, dt) {
		if (s.drawing || s.dragB) return s;
		const curves = curvesOf(s, p);
		const g = G$3(p);
		const mu = MU$1(p);
		return {
			...s,
			tt: s.tt + dt,
			beads: s.beads.map((b) => stepBead(b, curves[b.c], g, mu, s.tt, dt))
		};
	},
	dt: .001,
	sampleEvery: 20,
	maxSamples: 3e3,
	stopWhen: (s, p) => modo(p) === 0 && !s.drawing && !s.dragB && finishedRace(s) ? 0 : 1,
	tEnd: 60,
	pointer: {
		down(s, p, pt) {
			if (modo(p) !== 0) return void 0;
			if (Math.hypot(pt.x - s.bx, pt.y - s.by) < .25) return {
				...s,
				dragB: true
			};
			return {
				...s,
				drawing: true,
				draft: [[pt.x, pt.y]]
			};
		},
		move(s, p, pt, dragging) {
			if (!dragging || modo(p) !== 0) return void 0;
			if (s.dragB) {
				const bx = clamp(Math.round(pt.x * 20) / 20, .3, 5);
				const by = clamp(Math.round(pt.y * 20) / 20, -3, -.1);
				return bx === s.bx && by === s.by ? void 0 : reset(s, p, {
					bx,
					by,
					drawn: [],
					gid: s.gid + 1
				});
			}
			if (!s.drawing) return void 0;
			const last = s.draft[s.draft.length - 1];
			if (Math.hypot(pt.x - last[0], pt.y - last[1]) < .04) return void 0;
			return {
				...s,
				draft: [...s.draft, [pt.x, pt.y]]
			};
		},
		up(s, p) {
			if (modo(p) !== 0) return void 0;
			if (s.dragB) return reset(s, p, { dragB: false });
			if (!s.drawing) return void 0;
			if (s.draft.length < 4) return {
				...s,
				drawing: false,
				draft: []
			};
			return reset(s, p, {
				drawing: false,
				drawn: smooth(s.draft, s.bx, s.by),
				draft: [],
				gid: s.gid + 1
			});
		},
		cursor: (s, p, pt) => modo(p) !== 0 ? void 0 : Math.hypot(pt.x - s.bx, pt.y - s.by) < .25 ? "move" : "crosshair"
	},
	actions: [{
		id: "apagar",
		label: "Apagar sua curva",
		run: (s) => ({
			...s,
			drawn: [],
			gid: s.gid + 1,
			beads: s.beads.slice(0, 4),
			tt: 0
		})
	}],
	viewport(p) {
		if (modo(p) === 1) {
			const R = num(p, "Rc", .5);
			return {
				xMin: -.6 * R,
				xMax: 2 * Math.PI * R + .6 * R,
				yMin: -4.9 * R,
				yMax: .9 * R,
				unit: "m"
			};
		}
		return {
			xMin: -.5,
			xMax: 5.6,
			yMin: -3.7,
			yMax: 1.1,
			unit: "m"
		};
	},
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: s, params: p, theme: th } = frame;
		const curves = curvesOf(s, p);
		const col = (i) => th.series[i % th.series.length];
		const tau = modo(p) === 1;
		for (const c of curves) {
			const pts = c.xs.map((x, i) => [x, c.ys[i]]);
			d.polyline(pts, {
				color: col(c.color),
				width: 2.5,
				alpha: .85
			});
		}
		for (const b of s.beads) {
			const c = curves[b.c];
			const [x, y] = pointAt(c, b.s);
			d.circle(x, y, 0, {
				fill: col(c.color),
				stroke: th.text,
				width: 1,
				minPx: 7
			});
		}
		if (s.draft.length > 1) d.polyline(s.draft, {
			color: col(4),
			width: 2,
			dash: [5, 4]
		});
		if (tau) {
			const R = num(p, "Rc", .5);
			const T = Math.PI * Math.sqrt(R / G$3(p));
			d.line(Math.PI * R, .2 * R, Math.PI * R, -4.8 * R, {
				color: th.muted,
				dash: [4, 4],
				width: 1
			});
			d.text(`fundo: π√(R/g) = ${formatBR(T, 4)} s`, Math.PI * R + .1 * R, -2.25 * R, {
				align: "left",
				size: 11,
				color: th.muted
			});
			curves.forEach((c, ci) => {
				const ts = s.beads.filter((b) => b.c === ci).map((b) => b.arr >= 0 ? formatBR(b.arr, 4) : "…");
				d.text(`${c.name}: chegadas ${ts.join(" · ")} s`, -.5 * R, (ci === 0 ? .6 : -2.35) * R, {
					align: "left",
					size: 11,
					color: col(c.color),
					weight: "600"
				});
			});
			d.text(`t = ${formatBR(s.tt, 3)} s`, 2 * Math.PI * R + .5 * R, .6 * R, {
				align: "right",
				size: 12,
				weight: "600"
			});
			return;
		}
		d.dot(0, 0, 6, th.text);
		d.text("A", -.15, .12, {
			size: 13,
			weight: "700"
		});
		d.circle(s.bx, s.by, .09, {
			stroke: th.accent,
			width: 2,
			fill: th.accent,
			alpha: .4
		});
		d.text("B (arraste)", s.bx + .14, s.by, {
			size: 12,
			weight: "700",
			align: "left",
			color: th.accent
		});
		const pred = predicted(s, p);
		const order = s.beads.map((b, i) => ({
			i,
			t: b.arr
		})).filter((q) => q.t >= 0).sort((a, b) => a.t - b.t).map((q) => q.i);
		d.text("curva          chegada     previsto", 1.6, .95, {
			size: 11,
			align: "left",
			color: th.muted
		});
		s.beads.forEach((b, i) => {
			const c = curves[b.c];
			const place = order.indexOf(i);
			const tArr = b.arr >= 0 ? `${formatBR(b.arr, 4)} s` : b.stuck ? "parou" : `${formatBR(s.tt, 3)} s…`;
			const pr = Number.isFinite(pred[i]) ? `${formatBR(pred[i], 4)} s` : "não chega";
			d.text(`${place >= 0 ? `${place + 1}º ` : "    "}${c.name}`, 1.6, .78 - i * .16, {
				size: 11,
				align: "left",
				color: col(c.color),
				weight: "600"
			});
			d.text(tArr, 3.5, .78 - i * .16, {
				size: 11,
				align: "left"
			});
			d.text(pr, 4.6, .78 - i * .16, {
				size: 11,
				align: "left",
				color: th.muted
			});
		});
		if (!s.drawn.length && !s.drawing) d.text("arraste a partir de A para desenhar sua curva", .1, -3.55, {
			size: 11,
			align: "left",
			color: th.muted
		});
	}
});
//#endregion
//#region sims/calorimetria/src/physics.ts
/** Propriedades da água (J/kg·K e J/kg). */
var C_ICE = 2100;
var C_WATER = 4186;
var C_STEAM = 2010;
var L_F = 334e3;
var L_V = 2256e3;
/** Corpos que podem ser jogados no calorímetro (calor específico em J/kg·K; 0 = água). */
var BODIES = [
	{
		value: 0,
		label: "Água (gelo, líquida ou vapor conforme T)",
		c: 0
	},
	{
		value: 1,
		label: "Cobre",
		c: 385
	},
	{
		value: 2,
		label: "Alumínio",
		c: 900
	},
	{
		value: 3,
		label: "Ferro",
		c: 450
	},
	{
		value: 4,
		label: "Chumbo",
		c: 128
	}
];
var isWater = (s) => s.c === 0;
/** Entalpia a partir da temperatura; nas temperaturas de patamar, `side` escolhe a fase. */
function enthalpy(s, T, side = "lo") {
	if (!isWater(s)) return (s.m * s.c + s.C) * T;
	const { m, C } = s;
	const H1 = m * L_F;
	const H2 = H1 + (m * C_WATER + C) * 100;
	if (T < 0 || T === 0 && side === "lo") return (m * C_ICE + C) * T;
	if (T < 100 || T === 100 && side === "lo") return H1 + (m * C_WATER + C) * T;
	return H2 + m * L_V + (m * C_STEAM + C) * (T - 100);
}
/** Estado inicial típico: T ≤ 0 gelo, 0 < T < 100 líquida, T ≥ 100 vapor. */
var enthalpyFromT = (s, T) => enthalpy(s, T, T >= 100 ? "hi" : "lo");
/** Temperatura e frações de fase a partir da entalpia. */
function phaseOf(s, H) {
	if (!isWater(s)) return {
		T: H / (s.m * s.c + s.C),
		liquid: 0,
		vapor: 0
	};
	const { m, C } = s;
	const H1 = m * L_F;
	const H2 = H1 + (m * C_WATER + C) * 100;
	const H3 = H2 + m * L_V;
	if (H < 0) return {
		T: H / (m * C_ICE + C),
		liquid: 0,
		vapor: 0
	};
	if (H <= H1) return {
		T: 0,
		liquid: H1 > 0 ? H / H1 : 1,
		vapor: 0
	};
	if (H <= H2) return {
		T: (H - H1) / (m * C_WATER + C),
		liquid: 1,
		vapor: 0
	};
	if (H <= H3) return {
		T: 100,
		liquid: H3 > H2 ? 1 - (H - H2) / (H3 - H2) : 0,
		vapor: H3 > H2 ? (H - H2) / (H3 - H2) : 1
	};
	return {
		T: 100 + (H - H3) / (m * C_STEAM + C),
		liquid: 0,
		vapor: 1
	};
}
/**
* Equilíbrio de vários subsistemas com entalpia total Htot:
* menor T com Σ H_hi(T) ≥ Htot (bissecção), depois os patamares.
*/
function equilibrium(subs, Htot) {
	const tot = (T, side) => subs.reduce((a, s) => a + enthalpy(s, T, side), 0);
	let lo = -273, hi = 2e3;
	for (let i = 0; i < 200; i++) {
		const mid = (lo + hi) / 2;
		if (tot(mid, "hi") >= Htot) hi = mid;
		else lo = mid;
	}
	let T = hi;
	for (const Tp of [0, 100]) if (Math.abs(T - Tp) < 1e-6 && tot(Tp, "lo") <= Htot + 1e-6 && tot(Tp, "hi") >= Htot - 1e-6) T = Tp;
	let iceLeft = 0, steamLeft = 0;
	if (T === 0) iceLeft = Math.max(0, (tot(0, "hi") - Htot) / L_F);
	if (T === 100) steamLeft = Math.max(0, (Htot - tot(100, "lo")) / L_V);
	if (T < 0) iceLeft = subs.filter(isWater).reduce((a, s) => a + s.m, 0);
	return {
		T,
		iceLeft,
		steamLeft
	};
}
var heatingSub = (p) => ({
	m: num(p, "m", .5),
	c: 0,
	C: 0
});
var waterSub = (p) => ({
	m: num(p, "ma", .2),
	c: 0,
	C: num(p, "Ccal", 80)
});
function bodySub(p) {
	const kind = Math.round(num(p, "corpo", 0));
	return {
		m: num(p, "mb", .05),
		c: BODIES.find((b) => b.value === kind)?.c ?? 0,
		C: 0
	};
}
//#endregion
//#region sims/calorimetria/src/index.ts
var H$2 = 0;
var TF$1 = 1;
var HW = 2;
var at$1 = (s, i) => s[i] ?? 0;
var modeOf$1 = (p) => Math.round(num(p, "modo", 0));
var ritmo$1 = (p) => num(p, "ritmo", 20);
var waterInitH = (p) => {
	const s = waterSub(p);
	const Ta = num(p, "Ta", 20);
	return enthalpy(s, Ta, Ta <= 0 ? "hi" : "lo");
};
var bodyInitH = (p) => enthalpyFromT(bodySub(p), num(p, "Tb", -10));
/** Equilíbrio previsto da mistura no calorímetro (sem perdas). */
function mixEquilibrium(p) {
	return equilibrium([bodySub(p), waterSub(p)], bodyInitH(p) + waterInitH(p));
}
function temps(s, p) {
	if (modeOf$1(p) === 0) {
		const ph = phaseOf(heatingSub(p), at$1(s, H$2));
		return {
			T: ph.T,
			ph,
			Tb: ph.T,
			phB: ph
		};
	}
	const w = phaseOf(waterSub(p), at$1(s, HW));
	const b = phaseOf(bodySub(p), at$1(s, H$2));
	return {
		T: w.T,
		ph: w,
		Tb: b.T,
		phB: b
	};
}
var bodyName = (p) => {
	const k = Math.round(num(p, "corpo", 0));
	if (k !== 0) return BODIES.find((b) => b.value === k)?.label ?? "corpo";
	const T = num(p, "Tb", -10);
	return T <= 0 ? "Gelo" : T >= 100 ? "Vapor d'água" : "Água";
};
/** Bolhas e cubos de gelo em posições fixas. */
var BUBBLES = (() => {
	const r = rng(9);
	return Array.from({ length: 24 }, () => ({
		x: r(),
		ph: r(),
		s: .6 + r() * .8
	}));
})();
var calorimetria = defineSim({
	id: "calorimetria",
	title: "Calorimetria e mudanças de fase",
	course: "FG II",
	topic: "Calor e temperatura",
	priority: "P1",
	summary: "Aqueça gelo com potência constante e veja os patamares de fusão e ebulição na curva de aquecimento. Misture corpos num calorímetro com capacidade térmica própria e encontre a temperatura de equilíbrio, inclusive quando sobra gelo.",
	equations: [
		String.raw`Q = m c\,\Delta T \qquad Q = m L \qquad C_{\text{cal}}\ \text{(equivalente do calorímetro)}`,
		String.raw`\sum_i Q_i = 0 \;\Rightarrow\; T_{\text{eq}} = \frac{\sum_i m_i c_i T_i}{\sum_i m_i c_i}\ \text{(sem mudança de fase)}`,
		String.raw`\frac{dQ_{\text{corpo}}}{dt} = k\,(T_{\text{água}} - T_{\text{corpo}}) \qquad L_F = 334\ \text{kJ/kg} \quad L_V = 2256\ \text{kJ/kg}`
	],
	liveEquations(s, p) {
		if (modeOf$1(p) === 0) {
			const sub = heatingSub(p);
			const { ph } = temps(s, p);
			const Q = at$1(s, H$2) - enthalpyFromT(sub, num(p, "T0", -20));
			const stage = ph.T < 0 ? "aquecendo o gelo" : ph.T === 0 ? "fundindo" : ph.T < 100 ? "aquecendo a água" : ph.T === 100 ? "fervendo" : "aquecendo o vapor";
			return [String.raw`Q = P\,t = ${texNum(num(p, "P", 1500))}\ \text{W} \times ${texNum(at$1(s, TF$1))}\ \text{s} = ${texNum(Q / 1e3)}\ \text{kJ} \qquad T = ${texNum(ph.T)}\ ^\circ\text{C}\ \text{(${stage})}`, String.raw`m L_F = ${texNum(sub.m * L_F / 1e3)}\ \text{kJ} \qquad m L_V = ${texNum(sub.m * L_V / 1e3)}\ \text{kJ}`];
		}
		const eq = mixEquilibrium(p);
		const w = waterSub(p), b = bodySub(p);
		const { T, Tb } = temps(s, p);
		const lines = [[
			String.raw`T_{\text{água}} = ${texNum(T)}\ ^\circ\text{C}`,
			String.raw`T_{\text{corpo}} = ${texNum(Tb)}\ ^\circ\text{C}`,
			String.raw`T_{\text{eq}} = ${texNum(eq.T)}\ ^\circ\text{C}`
		].join(String.raw`\qquad `)];
		if (b.c > 0) {
			const Ta = num(p, "Ta", 20), Tb0 = num(p, "Tb", 100);
			lines.push(String.raw`T_{\text{eq}} = \frac{(${texNum(w.m)}\cdot${C_WATER} + ${texNum(w.C)})\cdot${texNum(Ta)} + ${texNum(b.m)}\cdot${b.c}\cdot${texNum(Tb0)}}{${texNum(w.m)}\cdot${C_WATER} + ${texNum(w.C)} + ${texNum(b.m)}\cdot${b.c}}`);
		} else if (eq.iceLeft > 0 && eq.T === 0) lines.push(String.raw`\text{Sobra gelo: } ${texNum(eq.iceLeft * 1e3)}\ \text{g a } 0\ ^\circ\text{C}`);
		return lines;
	},
	params: [
		{
			key: "modo",
			label: "Experimento",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Curva de aquecimento (potência constante)"
			}, {
				value: 1,
				label: "Mistura no calorímetro"
			}]
		},
		{
			key: "ritmo",
			label: "Tempo simulado por segundo",
			unit: "×",
			min: 1,
			max: 200,
			step: 1,
			default: 20,
			live: true,
			options: [
				{
					value: 1,
					label: "1× (tempo real)"
				},
				{
					value: 5,
					label: "5×"
				},
				{
					value: 20,
					label: "20×"
				},
				{
					value: 50,
					label: "50×"
				},
				{
					value: 200,
					label: "200×"
				}
			]
		},
		{
			key: "m",
			label: "Aquecimento: massa de gelo",
			unit: "kg",
			min: .05,
			max: 2,
			step: .05,
			default: .5
		},
		{
			key: "T0",
			label: "Aquecimento: temperatura inicial do gelo",
			unit: "°C",
			min: -40,
			max: 0,
			step: 1,
			default: -20
		},
		{
			key: "P",
			label: "Aquecimento: potência do aquecedor",
			unit: "W",
			min: 100,
			max: 5e3,
			step: 50,
			default: 1500,
			live: true
		},
		{
			key: "ma",
			label: "Calorímetro: massa de água",
			unit: "kg",
			min: .05,
			max: 1,
			step: .01,
			default: .2
		},
		{
			key: "Ta",
			label: "Calorímetro: temperatura da água",
			unit: "°C",
			min: 0,
			max: 95,
			step: 1,
			default: 30
		},
		{
			key: "Ccal",
			label: "Calorímetro: capacidade térmica do recipiente",
			unit: "J/K",
			min: 0,
			max: 500,
			step: 5,
			default: 80
		},
		{
			key: "corpo",
			label: "Corpo adicionado",
			unit: "",
			min: 0,
			max: 4,
			step: 1,
			default: 0,
			options: BODIES.map((b) => ({
				value: b.value,
				label: b.label
			}))
		},
		{
			key: "mb",
			label: "Massa do corpo",
			unit: "kg",
			min: .005,
			max: 1,
			step: .005,
			default: .05
		},
		{
			key: "Tb",
			label: "Temperatura inicial do corpo",
			unit: "°C",
			min: -40,
			max: 300,
			step: 1,
			default: -10
		},
		{
			key: "k",
			label: "Condutância corpo–água",
			unit: "W/K",
			min: 1,
			max: 50,
			step: 1,
			default: 10
		},
		{
			key: "kamb",
			label: "Perdas para o ambiente (25 °C)",
			unit: "W/K",
			min: 0,
			max: 2,
			step: .05,
			default: 0,
			live: true
		}
	],
	observables: [
		{
			key: "T",
			label: "Temperatura (água / substância)",
			unit: "°C",
			value: (s, p) => temps(s, p).T
		},
		{
			key: "Tb",
			label: "Temperatura do corpo",
			unit: "°C",
			value: (s, p) => temps(s, p).Tb
		},
		{
			key: "Q",
			label: "Calor recebido (substância / corpo)",
			unit: "kJ",
			value: (s, p) => (at$1(s, H$2) - (modeOf$1(p) === 0 ? enthalpyFromT(heatingSub(p), num(p, "T0", -20)) : bodyInitH(p))) / 1e3
		},
		{
			key: "fl",
			label: "Fração líquida",
			unit: "",
			value: (s, p) => temps(s, p).phB.liquid
		},
		{
			key: "fv",
			label: "Fração vaporizada",
			unit: "",
			value: (s, p) => temps(s, p).phB.vapor
		},
		{
			key: "tf",
			label: "Tempo físico",
			unit: "s",
			value: (s) => at$1(s, TF$1)
		},
		{
			key: "Htot",
			label: "Energia total no calorímetro",
			unit: "kJ",
			value: (s, p) => modeOf$1(p) === 1 ? (at$1(s, H$2) + at$1(s, HW)) / 1e3 : 0
		}
	],
	conserved: "Htot",
	chart: {
		x: "tf",
		y: "T"
	},
	scenarios: [
		{
			id: "aquecimento",
			label: "Gelo até vapor",
			params: {
				modo: 0,
				m: .5,
				T0: -20,
				P: 1500,
				ritmo: 50
			},
			guide: `### Patamares de mudança de fase
1. Rode e acompanhe o gráfico $T \\times t$ (com potência constante, o eixo do tempo é proporcional ao calor fornecido).
2. Nos **patamares** a temperatura não muda: todo o calor vai para a mudança de fase. Meça a duração do patamar de fusão e confira $m L_F / P$.
3. Compare as inclinações das rampas do gelo, da água e do vapor: $dT/dt = P/(mc)$. Qual fase esquenta mais devagar?
4. Por que o patamar de ebulição é quase 7 vezes mais longo que o de fusão?`,
			predict: [{
				question: "Enquanto o gelo derrete, com o aquecedor ligado, a temperatura da mistura gelo–água:",
				options: [
					"sobe devagar",
					"fica em 0 °C",
					"cai"
				],
				answer: 1,
				explanation: "O calor recebido rompe a estrutura do gelo (calor latente $L_F$) sem aumentar a energia cinética média: $T$ fica em 0 °C até o último pedaço derreter."
			}]
		},
		{
			id: "metal",
			label: "Cobre quente na água",
			params: {
				modo: 1,
				ma: .2,
				Ta: 20,
				Ccal: 80,
				corpo: 1,
				mb: .3,
				Tb: 100,
				k: 10,
				kamb: 0,
				ritmo: 20
			},
			guide: `### Equilíbrio térmico com calorímetro
1. Antes de rodar, calcule $T_{eq}$ com o balanço $\\sum Q = 0$, incluindo o calorímetro ($C = 80$ J/K).
2. Rode: as duas temperaturas convergem para $T_{eq}$ e a energia total fica constante.
3. Zere $C_{\\text{cal}}$ e veja quanto $T_{eq}$ muda: desprezar o recipiente é um erro sistemático.
4. Ligue as perdas para o ambiente: a energia total deixa de se conservar.`,
			predict: [{
				question: "300 g de cobre a 100 °C em 200 g de água a 20 °C. A temperatura final fica:",
				options: [
					"perto de 60 °C (a média)",
					"bem mais perto de 20 °C",
					"bem mais perto de 100 °C"
				],
				answer: 1,
				explanation: "A capacidade térmica do cobre ($0{,}3 \\times 385 \\approx 116$ J/K) é bem menor que a da água ($0{,}2 \\times 4186 \\approx 837$ J/K): quem tem mais capacidade térmica \"puxa\" o equilíbrio."
			}]
		},
		{
			id: "gelo",
			label: "Gelo que não derrete todo",
			params: {
				modo: 1,
				ma: .2,
				Ta: 30,
				Ccal: 80,
				corpo: 0,
				mb: .15,
				Tb: -10,
				k: 10,
				kamb: 0,
				ritmo: 20
			},
			guide: `### Quando sobra gelo
1. Calcule o calor que a água e o calorímetro liberam esfriando até 0 °C e compare com o necessário para aquecer o gelo até 0 °C e derretê-lo todo.
2. Se não for suficiente, o equilíbrio é **0 °C com gelo e água**. Quanto gelo sobra?
3. Rode e confira a fração líquida do corpo no fim. Depois diminua a massa de gelo até derreter tudo.`
		},
		{
			id: "vapor",
			label: "Vapor condensando",
			params: {
				modo: 1,
				ma: .3,
				Ta: 20,
				Ccal: 50,
				corpo: 0,
				mb: .02,
				Tb: 100,
				k: 10,
				kamb: 0,
				ritmo: 20
			},
			guide: `### Queimadura de vapor
Só 20 g de vapor a 100 °C aquecem bastante 300 g de água: ao condensar, cada quilograma libera $L_V = 2256$ kJ, além do calor sensível. Compare com 20 g de água líquida a 100 °C (troque $T_b$ para 99 °C).`
		}
	],
	exercises: [
		{
			id: "metal",
			prompt: "Um bloco de cobre (c = 385 J/kg·K) de {mb} kg a {Tb} °C é colocado em {ma} kg de água a {Ta} °C dentro de um calorímetro de capacidade térmica {Ccal} J/K. Qual é a temperatura de equilíbrio? (c_água = 4186 J/kg·K)",
			vary: {
				mb: [
					.1,
					.5,
					2
				],
				Tb: [
					80,
					200,
					0
				],
				ma: [
					.1,
					.4,
					2
				],
				Ta: [
					15,
					25,
					0
				],
				Ccal: [
					20,
					150,
					0
				]
			},
			fixed: {
				modo: 1,
				corpo: 1
			},
			answer: {
				label: "T_eq",
				unit: "°C",
				compute: (p) => {
					const cw = num(p, "ma") * C_WATER + num(p, "Ccal");
					const cb = num(p, "mb") * 385;
					return (cw * num(p, "Ta") + cb * num(p, "Tb")) / (cw + cb);
				}
			},
			tolerance: .01
		},
		{
			id: "gelo",
			prompt: "Coloca-se {mb} kg de gelo a 0 °C em {ma} kg de água a {Ta} °C, num recipiente isolado de capacidade térmica desprezível. Quantos gramas de gelo derretem? (c_água = 4186 J/kg·K, L_F = 334 kJ/kg)",
			vary: {
				mb: [
					.15,
					.3,
					2
				],
				ma: [
					.1,
					.3,
					2
				],
				Ta: [
					10,
					30,
					0
				]
			},
			fixed: {
				modo: 1,
				corpo: 0,
				Tb: 0,
				Ccal: 0
			},
			answer: {
				label: "m_derretida",
				unit: "g",
				compute: (p) => 1e3 * num(p, "ma") * C_WATER * num(p, "Ta") / L_F
			},
			hint: "Verifique primeiro se o calor da água esfriando até 0 °C basta para derreter todo o gelo."
		},
		{
			id: "curva",
			prompt: "Quanto calor é preciso para transformar {m} kg de gelo a {T0} °C em vapor a 100 °C? (c_gelo = 2100 J/kg·K, c_água = 4186 J/kg·K, L_F = 334 kJ/kg, L_V = 2256 kJ/kg)",
			vary: {
				m: [
					.1,
					2,
					2
				],
				T0: [
					-30,
					-5,
					0
				]
			},
			fixed: { modo: 0 },
			answer: {
				label: "Q",
				unit: "kJ",
				compute: (p) => num(p, "m") * (C_ICE * -num(p, "T0") + L_F + C_WATER * 100 + L_V) / 1e3
			}
		}
	],
	init(p) {
		if (modeOf$1(p) === 0) return [
			enthalpyFromT(heatingSub(p), num(p, "T0", -20)),
			0,
			0
		];
		return [
			bodyInitH(p),
			0,
			waterInitH(p)
		];
	},
	step(s, p, t, dt) {
		const r = ritmo$1(p);
		if (modeOf$1(p) === 0) return [
			at$1(s, H$2) + num(p, "P", 1500) * r * dt,
			at$1(s, TF$1) + r * dt,
			0
		];
		const b = bodySub(p), w = waterSub(p);
		const k = num(p, "k", 10), ka = num(p, "kamb", 0);
		const f = (y) => {
			const Tb = phaseOf(b, at$1(y, 0)).T;
			const Tw = phaseOf(w, at$1(y, 2)).T;
			const q = k * (Tw - Tb);
			return [
				q * r,
				r,
				(-q - ka * (Tw - 25)) * r
			];
		};
		const capMin = (x) => (x.c > 0 ? x.m * x.c : x.m * C_STEAM) + x.C;
		const tau = Math.min(capMin(b), capMin(w)) / (k + ka);
		const n = Math.max(1, Math.ceil(dt * r / (.2 * tau)));
		let y = s;
		for (let i = 0; i < n; i++) y = rk4$1(f, y, p, t + i * dt / n, dt / n);
		return y;
	},
	dt: .01,
	sampleEvery: 5,
	stopWhen: (s, p) => modeOf$1(p) === 0 ? 130 - phaseOf(heatingSub(p), at$1(s, H$2)).T : 1,
	viewport: () => ({
		xMin: 0,
		xMax: 16,
		yMin: 0,
		yMax: 9
	}),
	render(ctx, frame) {
		const d = draw(ctx, frame);
		if (modeOf$1(frame.params) === 0) renderHeating(d, frame.state, frame.params, frame.t);
		else renderMix(d, frame.state, frame.params, frame.t);
	}
});
/** Cor da temperatura: azul (frio) → vermelho (quente). */
function tempColor(T) {
	const u = clamp((T + 20) / 140, 0, 1);
	return `rgb(${Math.round(60 + 190 * u)}, ${Math.round(120 - 50 * u)}, ${Math.round(230 - 180 * u)})`;
}
function thermometer(d, x, y0, y1, T, label, Tmin = -40, Tmax = 140) {
	const { theme } = d;
	d.rect(x - .12, y0, .24, y1 - y0, {
		stroke: theme.text,
		width: 1.5
	});
	const u = clamp((T - Tmin) / (Tmax - Tmin), 0, 1);
	d.rect(x - .07, y0, .14, u * (y1 - y0), { fill: theme.positive });
	d.circle(x, y0 - .12, .2, { fill: theme.positive });
	for (const tt of [0, 100]) {
		const yy = y0 + (tt - Tmin) / (Tmax - Tmin) * (y1 - y0);
		d.line(x + .12, yy, x + .3, yy, { color: theme.muted });
		d.text(`${tt}`, x + .35, yy, {
			align: "left",
			size: 10,
			color: theme.muted
		});
	}
	d.text(`${label} ${formatBR(T, 3)} °C`, x, y1 + .3, {
		size: 12,
		weight: "600"
	});
}
function renderHeating(d, s, p, t) {
	const { theme } = d;
	const sub = heatingSub(p);
	const T0 = num(p, "T0", -20);
	const H0 = enthalpyFromT(sub, T0);
	const ph = phaseOf(sub, at$1(s, H$2));
	const bx0 = 1.2, bx1 = 4.8, by0 = 1.6, by1 = 6.4;
	const ice = Math.max(0, 1 - ph.liquid - ph.vapor) < 1e-9 ? 0 : Math.max(0, 1 - ph.liquid - ph.vapor);
	const liquid = ph.liquid;
	const level = 1.7000000000000002 + 2.4 * (liquid + ice * 1.09);
	if (liquid > 0) d.rect(bx0, by0, 3.5999999999999996, (level - by0) * (liquid / Math.max(1e-9, liquid + ice * 1.09)), {
		fill: theme.series[0],
		alpha: .35
	});
	const nIce = Math.round(9 * ice);
	for (let i = 0; i < nIce; i++) {
		const cx = 1.7999999999999998 + i % 3 * 1.1;
		const cy = 2.0500000000000003 + Math.floor(i / 3) * .75;
		d.box(cx, cy, .62, .62, .15 * (i % 3 - 1), {
			fill: theme.dark ? "#cfe7ff" : "#e4f3ff",
			stroke: theme.accent,
			width: 1.5,
			alpha: .95
		});
	}
	if (ph.T === 100 && ph.vapor < 1) for (const b of BUBBLES) {
		const y = by0 + (b.ph + t * .8 * b.s) % 1 * (level - by0);
		d.circle(1.4 + b.x * 3.1999999999999997, y, .07 * b.s, {
			stroke: theme.text,
			width: 1,
			alpha: .6
		});
	}
	if (ph.vapor > 0) for (let i = 0; i < 6; i++) {
		const x = 1.7 + i * .55;
		const y = 6.6000000000000005 + (t * .7 + i * .37) % 1 * .9;
		d.circle(x, y, .18 + .1 * Math.sin(i + t), {
			fill: theme.muted,
			alpha: .25 * Math.min(1, ph.vapor * 3 + .3)
		});
	}
	d.polyline([
		[bx0, by1],
		[bx0, by0],
		[bx1, by0],
		[bx1, by1]
	], {
		color: theme.text,
		width: 2.5
	});
	d.rect(1, .9, 3.9999999999999996, .5, {
		fill: theme.positive,
		alpha: .85
	});
	d.text(`${formatBR(num(p, "P", 1500), 4)} W`, 3, 1.15, {
		size: 11,
		weight: "600",
		color: "#ffffff"
	});
	for (const x of [
		1.8,
		3,
		4.2
	]) d.arrowPx(x, 1.42, 0, 1, 14, { color: theme.positive });
	thermometer(d, 5.6, 1.8, 6.6, ph.T, "T =");
	const stage = ph.T < 0 ? "Aquecendo o gelo" : ph.T === 0 ? "Fusão (patamar)" : ph.T < 100 ? "Aquecendo a água" : ph.T === 100 ? "Ebulição (patamar)" : "Aquecendo o vapor";
	d.text(stage, 3, 8.6, {
		size: 13,
		weight: "600",
		color: theme.accent
	});
	d.text(`gelo ${formatBR(ice * 100, 3)} %   líquida ${formatBR(liquid * 100, 3)} %   vapor ${formatBR(ph.vapor * 100, 3)} %`, 3, 8.05, {
		size: 11,
		color: theme.muted
	});
	const gx0 = 7.6, gx1 = 15.4, gy0 = 1.2, gy1 = 7.8;
	const Hend = enthalpy(sub, 130, "hi");
	const Tmin = Math.min(-40, T0), Tmax = 140;
	const X = (HH) => gx0 + (HH - H0) / (Hend - H0) * 7.800000000000001;
	const Y = (T) => gy0 + (T - Tmin) / (Tmax - Tmin) * 6.6;
	d.line(gx0, gy0, gx1, gy0, { color: theme.muted });
	d.line(gx0, gy0, gx0, gy1, { color: theme.muted });
	d.text("Q fornecido (kJ) →", gx1, .7999999999999999, {
		align: "right",
		size: 11,
		color: theme.muted
	});
	d.text("T (°C)", gx0, 8.1, {
		align: "left",
		size: 11,
		color: theme.muted
	});
	for (const T of [0, 100]) {
		d.line(gx0, Y(T), gx1, Y(T), { color: theme.grid });
		d.text(`${T}`, 7.5, Y(T), {
			align: "right",
			size: 10,
			color: theme.muted
		});
	}
	d.text(`${formatBR((Hend - H0) / 1e3, 4)}`, gx1, 1.05, {
		align: "right",
		size: 10,
		color: theme.muted,
		baseline: "top"
	});
	const pts = (H1, H2, n = 120) => Array.from({ length: n + 1 }, (_, i) => {
		const HH = H1 + (H2 - H1) * i / n;
		return [X(HH), Y(phaseOf(sub, HH).T)];
	});
	d.polyline(pts(H0, Hend), {
		color: theme.muted,
		dash: [4, 4]
	});
	d.polyline(pts(H0, Math.min(at$1(s, H$2), Hend)), {
		color: theme.accent,
		width: 2.5
	});
	d.dot(X(Math.min(at$1(s, H$2), Hend)), Y(ph.T), 5, theme.positive);
	const Hf0 = enthalpy(sub, 0, "lo"), Hf1 = enthalpy(sub, 0, "hi"), Hv0 = enthalpy(sub, 100, "lo"), Hv1 = enthalpy(sub, 100, "hi");
	d.text(`m L_F = ${formatBR((Hf1 - Hf0) / 1e3, 3)} kJ`, (X(Hf0) + X(Hf1)) / 2, Y(0) + .35, {
		size: 10,
		color: theme.series[0]
	});
	d.text(`m L_V = ${formatBR((Hv1 - Hv0) / 1e3, 4)} kJ`, (X(Hv0) + X(Hv1)) / 2, Y(100) + .35, {
		size: 10,
		color: theme.positive
	});
	d.text(`c_gelo = ${C_ICE}`, X(H0) + .1, Y(T0 / 2), {
		align: "left",
		size: 9,
		color: theme.muted
	});
	d.text(`c_vapor = ${C_STEAM} J/kg·K`, gx1, Y(130) + .35, {
		align: "right",
		size: 9,
		color: theme.muted
	});
}
function renderMix(d, s, p, t) {
	const { theme } = d;
	const w = waterSub(p), b = bodySub(p);
	const { T, Tb, phB } = temps(s, p), cx0 = 1.2, cx1 = 6.2, cy0 = 1;
	d.rect(.85, .65, 5.7, 5.6 + .35, {
		fill: theme.muted,
		alpha: .18,
		stroke: theme.text,
		width: 2
	});
	d.rect(cx0, cy0, 5, 5.6, {
		fill: theme.dark ? "#141a22" : "#ffffff",
		stroke: theme.text,
		width: 1.5
	});
	d.text(`calorímetro: C = ${formatBR(w.C, 3)} J/K`, 7.4 / 2, .35, {
		size: 11,
		color: theme.muted
	});
	const level = 1.3 + 4 * Math.min(1, (w.m + (b.c === 0 ? b.m * phB.liquid : 0)) / 1.1);
	d.rect(cx0, cy0, 5, level - cy0, {
		fill: tempColor(T),
		alpha: .3
	});
	d.line(cx0, level, cx1, level, {
		color: theme.series[0],
		width: 1.5
	});
	const bxc = 4.3;
	if (b.c > 0) {
		const side = .9 + .8 * Math.cbrt(b.m);
		d.rect(bxc - side / 2, 1.1, side, side, {
			fill: tempColor(Tb),
			alpha: .9,
			stroke: theme.text,
			width: 1.5
		});
	} else {
		const ice = 1 - phB.liquid - phB.vapor;
		const n = Math.max(0, Math.round(6 * ice * Math.min(1, b.m / .1 + .3)));
		for (let i = 0; i < n; i++) {
			const x = 2.1 + i % 3 * 1.2 + .2 * Math.sin(t * .5 + i);
			d.box(x, level - .25 - Math.floor(i / 3) * .6, .6, .55, .2 * Math.sin(i), {
				fill: theme.dark ? "#cfe7ff" : "#e4f3ff",
				stroke: theme.accent,
				width: 1.5
			});
		}
		if (phB.vapor > 0) for (let i = 0; i < 8; i++) d.circle(3.3 + i % 4 * .6, 1.4 + (t * .6 + i * .29) % 1 * (level - cy0 - .5), .1, {
			stroke: theme.text,
			alpha: .6,
			width: 1
		});
	}
	const q = num(p, "k", 10) * (T - Tb);
	if (Math.abs(q) > .05) {
		const dir = Math.sign(q);
		d.arrowPx(bxc - dir * 1.2, 2.6, dir, 0, 20 + Math.min(60, Math.abs(q) / 5), {
			color: theme.positive,
			width: 3
		});
		d.text(`${formatBR(Math.abs(q), 3)} W ${dir > 0 ? "água → corpo" : "corpo → água"}`, bxc, 3.15, {
			size: 11,
			color: theme.positive,
			weight: "600"
		});
	}
	thermometer(d, 7.2, 1.6, 6.4, T, "água", -40, 300);
	thermometer(d, 8.9, 1.6, 6.4, Tb, "corpo", -40, 300);
	const eq = mixEquilibrium(p);
	[
		`${bodyName(p)}: ${formatBR(b.m * 1e3, 4)} g a ${formatBR(num(p, "Tb", -10), 4)} °C`,
		`Água: ${formatBR(w.m * 1e3, 4)} g a ${formatBR(num(p, "Ta", 20), 3)} °C`,
		`T_eq prevista (sem perdas): ${formatBR(eq.T, 4)} °C`,
		eq.iceLeft > 0 && eq.T === 0 ? `Sobra gelo: ${formatBR(eq.iceLeft * 1e3, 3)} g` : eq.steamLeft > 0 ? `Sobra vapor: ${formatBR(eq.steamLeft * 1e3, 3)} g` : "Sem mudança de fase pendente",
		b.c === 0 ? `Corpo: ${formatBR(phB.liquid * 100, 3)} % líquido, ${formatBR(phB.vapor * 100, 3)} % vapor` : `c = ${b.c} J/kg·K`,
		`Tempo físico: ${formatBR(at$1(s, TF$1), 4)} s`
	].forEach((tx, i) => d.text(tx, 10.4, 7.6 - i * .6, {
		align: "left",
		size: 11,
		color: i === 2 ? theme.accent : theme.text
	}));
}
//#endregion
//#region sims/circuitos-dc/src/model.ts
var WIRE_R = 1e-4;
var VOLTMETER_R = 1e7;
var DEFAULTS = {
	fio: 0,
	resistor: 100,
	bateria: 9,
	lampada: 12,
	chave: 0,
	amperimetro: 0,
	voltimetro: 0,
	capacitor: .001,
	indutor: 1,
	diodo: 0
};
var key = (p) => `${p[0]},${p[1]}`;
function makeComp(id, kind, a, b, value = DEFAULTS[kind], closed = true) {
	return {
		id,
		kind,
		a,
		b,
		value,
		closed: kind === "chave" ? closed : void 0,
		i: 0,
		v: 0,
		phase: 0,
		fresh: kind === "capacitor" || kind === "indutor" ? true : void 0
	};
}
/** Monta os elementos MNA a partir dos componentes e resolve um passo. */
function solveStep(s, p, dt, commit) {
	const r = Math.max(.001, p.rInterna ?? .1);
	const nodes = new NodeMap();
	for (const c of s.comps) {
		nodes.add(key(c.a));
		nodes.add(key(c.b));
	}
	const battery = s.comps.find((c) => c.kind === "bateria");
	const { index, count } = nodes.number(battery ? key(battery.b) : s.comps[0] ? key(s.comps[0].a) : void 0);
	const els = s.comps.map((c) => {
		const a = index(key(c.a));
		const b = index(key(c.b));
		switch (c.kind) {
			case "fio":
			case "amperimetro": return {
				kind: "R",
				a,
				b,
				R: WIRE_R
			};
			case "chave": return c.closed ? {
				kind: "R",
				a,
				b,
				R: WIRE_R
			} : null;
			case "resistor":
			case "lampada": return {
				kind: "R",
				a,
				b,
				R: c.value
			};
			case "voltimetro": return {
				kind: "R",
				a,
				b,
				R: VOLTMETER_R
			};
			case "bateria": return {
				kind: "V",
				a,
				b,
				V: c.value,
				R: r
			};
			case "capacitor": return {
				kind: "C",
				a,
				b,
				C: c.value,
				v0: c.v,
				i0: c.fresh ? void 0 : c.i
			};
			case "indutor": return {
				kind: "L",
				a,
				b,
				L: c.value,
				i0: c.i,
				v0: c.fresh ? void 0 : c.v
			};
			case "diodo": return {
				kind: "D",
				a,
				b
			};
		}
	});
	const sol = solveCircuit(count, els.filter((e) => e !== null), dt);
	let k = 0;
	const comps = s.comps.map((c, idx) => {
		if (!els[idx]) return {
			...c,
			i: 0,
			v: sol.v[index(key(c.a))] - sol.v[index(key(c.b))]
		};
		const i = sol.i[k];
		const v = sol.dv[k];
		k++;
		const next = {
			...c,
			i,
			v
		};
		if (commit) {
			next.fresh = void 0;
			const speed = Math.sign(i) * Math.min(3, Math.log10(1 + Math.abs(i) * 1e4) * .6);
			next.phase = (c.phase + speed * dt) % 1;
		}
		return next;
	});
	let warning = "";
	if (sol.singular) warning = "Laço de fontes ideais: o circuito não tem solução.";
	else if (comps.some((c) => c.kind === "bateria" && Math.abs(c.i) > 5)) warning = "Curto-circuito! A bateria está fornecendo uma corrente enorme.";
	else if (comps.some((c) => c.kind === "amperimetro" && Math.abs(c.i) > 5)) warning = "O amperímetro foi ligado em paralelo e virou um curto.";
	return {
		...s,
		comps,
		warning
	};
}
/** Distância de um ponto ao segmento de um componente. */
function distToComp(c, x, y) {
	const [ax, ay] = c.a;
	const [bx, by] = c.b;
	const dx = bx - ax;
	const dy = by - ay;
	const L2 = dx * dx + dy * dy || 1;
	const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / L2));
	return Math.hypot(x - (ax + t * dx), y - (ay + t * dy));
}
function sameSegment(c, a, b) {
	const eq = (p, q) => p[0] === q[0] && p[1] === q[1];
	return eq(c.a, a) && eq(c.b, b) || eq(c.a, b) && eq(c.b, a);
}
var E6 = [
	1,
	1.5,
	2.2,
	3.3,
	4.7,
	6.8
];
var BATTERY = [
	1.5,
	3,
	4.5,
	6,
	9,
	12,
	24
];
function stepValue(kind, v, dir) {
	if (kind === "bateria") {
		const i = BATTERY.findIndex((x) => x >= v - 1e-9);
		return BATTERY[Math.max(0, Math.min(BATTERY.length - 1, (i < 0 ? BATTERY.length - 1 : i) + dir))];
	}
	const exp = Math.floor(Math.log10(v) + 1e-9);
	const mant = v / 10 ** exp;
	let idx = E6.findIndex((m) => Math.abs(m - mant) < .05);
	if (idx < 0) idx = 0;
	idx += dir;
	let e = exp;
	if (idx >= E6.length) {
		idx = 0;
		e++;
	}
	if (idx < 0) {
		idx = E6.length - 1;
		e--;
	}
	const next = Number((E6[idx] * 10 ** e).toPrecision(3));
	const [lo, hi] = kind === "capacitor" ? [1e-9, 1] : kind === "indutor" ? [1e-6, 100] : [.1, 1e7];
	return Math.min(hi, Math.max(lo, next));
}
/** Formata com prefixo SI: 4700 Ω → "4,7 kΩ". */
function si$2(v, unit) {
	if (v === 0) return `0 ${unit}`;
	const prefixes = [
		[1e6, "M"],
		[1e3, "k"],
		[1, ""],
		[.001, "m"],
		[1e-6, "µ"],
		[1e-9, "n"]
	];
	const a = Math.abs(v);
	const [f, pre] = prefixes.find(([f]) => a >= f * .999) ?? prefixes[prefixes.length - 1];
	return `${Number((v / f).toPrecision(3)).toString().replace(".", ",")} ${pre}${unit}`;
}
//#endregion
//#region sims/circuitos-dc/src/presets.ts
function build(specs) {
	const comps = specs.map(([kind, a, b, value, closed], i) => makeComp(i + 1, kind, a, b, value, closed));
	return {
		comps,
		tool: "selecionar",
		selected: null,
		drag: null,
		nextId: comps.length + 1,
		warning: ""
	};
}
/** Montagens prontas, escolhidas pelo parâmetro "montagem". */
var PRESETS$3 = [
	{
		label: "Bancada vazia",
		build: () => build([[
			"bateria",
			[2, 5],
			[2, 3]
		]])
	},
	{
		label: "Resistores em série",
		build: () => build([
			[
				"bateria",
				[2, 5],
				[2, 2],
				12
			],
			[
				"fio",
				[2, 5],
				[2, 6]
			],
			[
				"resistor",
				[2, 6],
				[5, 6],
				100
			],
			[
				"resistor",
				[5, 6],
				[8, 6],
				220
			],
			[
				"fio",
				[8, 6],
				[10, 6]
			],
			[
				"resistor",
				[10, 6],
				[10, 2],
				330
			],
			[
				"amperimetro",
				[10, 2],
				[6, 2]
			],
			[
				"fio",
				[6, 2],
				[2, 2]
			],
			[
				"voltimetro",
				[5, 7],
				[8, 7]
			],
			[
				"fio",
				[5, 6],
				[5, 7]
			],
			[
				"fio",
				[8, 6],
				[8, 7]
			]
		])
	},
	{
		label: "Resistores em paralelo",
		build: () => build([
			[
				"bateria",
				[2, 5],
				[2, 2],
				9
			],
			[
				"fio",
				[2, 5],
				[2, 6]
			],
			[
				"amperimetro",
				[2, 6],
				[5, 6]
			],
			[
				"fio",
				[5, 6],
				[8, 6]
			],
			[
				"fio",
				[8, 6],
				[11, 6]
			],
			[
				"resistor",
				[5, 6],
				[5, 2],
				100
			],
			[
				"resistor",
				[8, 6],
				[8, 2],
				220
			],
			[
				"resistor",
				[11, 6],
				[11, 2],
				470
			],
			[
				"fio",
				[11, 2],
				[8, 2]
			],
			[
				"fio",
				[8, 2],
				[5, 2]
			],
			[
				"fio",
				[5, 2],
				[2, 2]
			]
		])
	},
	{
		label: "Lâmpadas: série × paralelo",
		build: () => build([
			[
				"bateria",
				[1, 5],
				[1, 2],
				12
			],
			[
				"fio",
				[1, 5],
				[1, 6]
			],
			[
				"lampada",
				[1, 6],
				[4, 6]
			],
			[
				"lampada",
				[4, 6],
				[7, 6]
			],
			[
				"fio",
				[7, 6],
				[7, 2]
			],
			[
				"fio",
				[7, 2],
				[1, 2]
			],
			[
				"bateria",
				[8, 5],
				[8, 2],
				12
			],
			[
				"fio",
				[8, 5],
				[8, 6]
			],
			[
				"fio",
				[8, 6],
				[10, 6]
			],
			[
				"lampada",
				[10, 6],
				[10, 2]
			],
			[
				"fio",
				[10, 6],
				[12, 6]
			],
			[
				"lampada",
				[12, 6],
				[12, 2]
			],
			[
				"fio",
				[12, 2],
				[10, 2]
			],
			[
				"fio",
				[10, 2],
				[8, 2]
			]
		])
	},
	{
		label: "Ponte de Wheatstone",
		build: () => build([
			[
				"bateria",
				[1, 5],
				[1, 2],
				10
			],
			[
				"fio",
				[1, 5],
				[1, 7]
			],
			[
				"fio",
				[1, 7],
				[6, 7]
			],
			[
				"resistor",
				[6, 7],
				[3, 4],
				100
			],
			[
				"resistor",
				[6, 7],
				[9, 4],
				150
			],
			[
				"resistor",
				[3, 4],
				[6, 1],
				200
			],
			[
				"resistor",
				[9, 4],
				[6, 1],
				330
			],
			[
				"amperimetro",
				[3, 4],
				[9, 4]
			],
			[
				"fio",
				[6, 1],
				[1, 1]
			],
			[
				"fio",
				[1, 1],
				[1, 2]
			]
		])
	},
	{
		label: "Kirchhoff: duas fontes",
		build: () => build([
			[
				"bateria",
				[2, 5],
				[2, 2],
				12
			],
			[
				"fio",
				[2, 5],
				[2, 6]
			],
			[
				"resistor",
				[2, 6],
				[6, 6],
				100
			],
			[
				"amperimetro",
				[6, 6],
				[6, 4]
			],
			[
				"resistor",
				[6, 4],
				[6, 2],
				220
			],
			[
				"resistor",
				[6, 6],
				[10, 6],
				150
			],
			[
				"fio",
				[10, 6],
				[10, 5]
			],
			[
				"bateria",
				[10, 5],
				[10, 2],
				6
			],
			[
				"fio",
				[10, 2],
				[6, 2]
			],
			[
				"fio",
				[6, 2],
				[2, 2]
			]
		])
	},
	{
		label: "Circuito RC com chave",
		build: () => build([
			[
				"bateria",
				[2, 5],
				[2, 2],
				9
			],
			[
				"fio",
				[2, 5],
				[2, 6]
			],
			[
				"chave",
				[2, 6],
				[5, 6],
				0,
				false
			],
			[
				"resistor",
				[5, 6],
				[8, 6],
				1e3
			],
			[
				"fio",
				[8, 6],
				[10, 6]
			],
			[
				"capacitor",
				[10, 6],
				[10, 2],
				.001
			],
			[
				"fio",
				[10, 2],
				[2, 2]
			],
			[
				"voltimetro",
				[11, 6],
				[11, 2]
			],
			[
				"fio",
				[10, 6],
				[11, 6]
			],
			[
				"fio",
				[10, 2],
				[11, 2]
			]
		])
	},
	{
		label: "Diodo e LED",
		build: () => build([
			[
				"bateria",
				[2, 5],
				[2, 2],
				6
			],
			[
				"fio",
				[2, 5],
				[2, 6]
			],
			[
				"resistor",
				[2, 6],
				[6, 6],
				330
			],
			[
				"diodo",
				[6, 6],
				[10, 6]
			],
			[
				"fio",
				[10, 6],
				[10, 2]
			],
			[
				"amperimetro",
				[10, 2],
				[6, 2]
			],
			[
				"fio",
				[6, 2],
				[2, 2]
			]
		])
	}
];
//#endregion
//#region sims/circuitos-dc/src/derivation.ts
/** Modo engenharia: das leis de Kirchhoff ao solver nodal (MNA) usado pelo construtor de circuitos. */
var derivation$3 = String.raw`### 1. Hipóteses (modelo de parâmetros concentrados)
- As dimensões do circuito são muito menores que o comprimento de onda dos sinais: os campos ficam confinados nos componentes, e cada fio é uma região equipotencial (aproximação quase-estática).
- Cada componente é descrito só pela relação entre a tensão $v$ nos seus terminais e a corrente $i$ que o atravessa.
- Fios e amperímetros são resistores de $R_f = 10^{-4}\ \Omega$ (quase ideais); o voltímetro é um resistor de $10\ \text{M}\Omega$; a bateria é uma fonte ideal $\varepsilon$ em série com a resistência interna $r$; a lâmpada é um resistor ôhmico de valor fixo (sem aquecimento do filamento).

### 2. Leis de Kirchhoff
**Lei dos nós** (conservação da carga): em regime quase-estático não há acúmulo de carga num nó, logo
$$\sum_{k\,\in\,\text{nó}} i_k = 0.$$
**Lei das malhas** (campo eletrostático conservativo): como $\oint \vec E\cdot d\vec l = 0$ fora de regiões com fluxo magnético variável, a soma das quedas de tensão em qualquer laço fechado é nula:
$$\sum_{k\,\in\,\text{malha}} \Delta V_k = 0.$$
A lei das malhas é automaticamente satisfeita quando se atribui um potencial $v_n$ a cada nó e se escreve a tensão de cada ramo como diferença de potenciais.

### 3. Relações constitutivas
$$\text{resistor: } i = \frac{v_a - v_b}{R} \qquad \text{fonte: } v_a - v_b - r\,i = \varepsilon$$
$$\text{capacitor: } i = C\,\frac{dv}{dt} \qquad \text{indutor: } v = L\,\frac{di}{dt} \qquad \text{diodo: } i = I_s\left(e^{v/(n V_T)} - 1\right)$$
Para o diodo usa-se o modelo de Shockley com $I_s = 2{,}52\ \text{nA}$, $n = 1{,}75$ e $V_T = k_B T/e \approx 25{,}85\ \text{mV}$ a $300\ \text{K}$.

### 4. Método numérico: análise nodal modificada (MNA)
Escolhe-se um nó de referência (terra, $v_0 = 0$). Para cada outro nó escreve-se a lei dos nós com as correntes expressas pelos potenciais. Um resistor entre os nós $a$ e $b$ contribui com a condutância $G = 1/R$ na matriz:
$$G_{aa} \mathrel{+}= G,\quad G_{bb} \mathrel{+}= G,\quad G_{ab} \mathrel{-}= G,\quad G_{ba} \mathrel{-}= G.$$
Fontes de tensão não têm relação $i(v)$, então sua corrente vira uma incógnita extra e a equação da fonte vira uma linha extra. O sistema fica
$$\begin{pmatrix} G & B \\ B^{T} & -R_{int} \end{pmatrix}\begin{pmatrix} \mathbf v \\ \mathbf i_V \end{pmatrix} = \begin{pmatrix} \mathbf i_s \\ \boldsymbol\varepsilon \end{pmatrix},$$
em que $B$ tem $\pm 1$ nas posições dos terminais de cada fonte. A solução é obtida por eliminação gaussiana com pivotamento parcial. Se a matriz é singular (por exemplo, um laço só de fontes ideais), o app avisa que o circuito não tem solução.

### 5. Capacitores e indutores: modelo companheiro
Discretizando no tempo com passo $h$, a regra do trapézio aplicada a $i = C\,dv/dt$ dá
$$i_n = \frac{2C}{h}\,(v_n - v_{n-1}) - i_{n-1},$$
ou seja, um resistor de condutância $G_C = 2C/h$ em paralelo com uma fonte de corrente $G_C v_{n-1} + i_{n-1}$. Para o indutor, $v = L\,di/dt$ dá
$$i_n = i_{n-1} + \frac{h}{2L}\,(v_n + v_{n-1}),$$
um resistor de condutância $h/(2L)$ em paralelo com uma fonte $i_{n-1} + \frac{h}{2L} v_{n-1}$. A regra do trapézio é A-estável e não introduz amortecimento artificial: num circuito LC ideal a energia $\tfrac12 C v^2 + \tfrac12 L i^2$ se conserva. No primeiro passo depois de inserir um componente (quando $i_{n-1}$ ou $v_{n-1}$ ainda não existem) usa-se Euler implícito ($i_n = \frac{C}{h}(v_n - v_{n-1})$), que só precisa da tensão anterior.

### 6. Diodo: Newton–Raphson
A curva do diodo é linearizada em torno da estimativa $v_d$:
$$i \approx I_d + g_d\,(v - v_d), \qquad g_d = \frac{I_s}{n V_T}\,e^{v_d/(n V_T)},$$
isto é, uma condutância $g_d$ em paralelo com uma fonte $I_d - g_d v_d$. O sistema linear é resolvido, a estimativa é atualizada e o processo se repete até a variação dos potenciais ficar abaixo de $10^{-9}\ \text{V}$. Cada atualização é limitada a $0{,}5\ \text{V}$ para a exponencial não estourar.

### 7. Grandezas mostradas
Corrente e tensão de cada componente vêm da solução; a potência é $P = v\,i$ (para resistores, $P = R i^2$). A tensão nos terminais da bateria cai com a corrente: $V_{terminal} = \varepsilon - r\,i$, e em curto ($R_{ext} \to 0$) a corrente tende a $\varepsilon/r$. O passo de tempo é $h = 1$ ms.`;
//#endregion
//#region sims/circuitos-dc/src/index.ts
var W = 12;
var H$1 = 8;
var TOOLS = [
	{
		tool: "selecionar",
		label: "Selecionar"
	},
	{
		tool: "fio",
		label: "Fio"
	},
	{
		tool: "resistor",
		label: "Resistor"
	},
	{
		tool: "bateria",
		label: "Bateria"
	},
	{
		tool: "lampada",
		label: "Lâmpada"
	},
	{
		tool: "chave",
		label: "Chave"
	},
	{
		tool: "capacitor",
		label: "Capacitor"
	},
	{
		tool: "indutor",
		label: "Indutor"
	},
	{
		tool: "diodo",
		label: "Diodo"
	},
	{
		tool: "amperimetro",
		label: "Amperímetro"
	},
	{
		tool: "voltimetro",
		label: "Voltímetro"
	},
	{
		tool: "apagar",
		label: "Apagar"
	}
];
var UNIT$1 = {
	resistor: "Ω",
	lampada: "Ω",
	bateria: "V",
	capacitor: "F",
	indutor: "H"
};
var snap = (x, y) => [Math.max(0, Math.min(W, Math.round(x))), Math.max(0, Math.min(H$1, Math.round(y)))];
var first = (s, kind) => s.comps.find((c) => c.kind === kind);
/** Altera o componente selecionado e resolve o circuito de novo, para medidas e brilho já valerem com a sim parada. */
function withSelected(s, p, fn) {
	if (s.selected === null) return s;
	return solveStep({
		...s,
		comps: s.comps.map((c) => c.id === s.selected ? fn(c) : c)
	}, p, .001, false);
}
var toolActions = TOOLS.map(({ tool, label }) => ({
	id: `tool-${tool}`,
	label,
	run: (s) => ({
		...s,
		tool,
		drag: null
	}),
	active: (s) => s.tool === tool
}));
var circuitosDc = defineSim({
	id: "circuitos-dc",
	title: "Construtor de circuitos",
	course: "FG III",
	topic: "Circuitos DC",
	priority: "P1",
	summary: "Monte circuitos na bancada com baterias, resistores, lâmpadas, chaves, capacitores, indutores, diodos e instrumentos. Correntes e tensões vêm de um solver nodal (MNA) a cada passo.",
	derivation: derivation$3,
	equations: [
		String.raw`\sum_k I_k = 0 \quad \text{(nós)} \qquad \sum_k \Delta V_k = 0 \quad \text{(malhas)}`,
		String.raw`V = R\,I \qquad P = V I = R I^2`,
		String.raw`V_{\text{terminal}} = \varepsilon - r\,I`
	],
	liveEquations(s) {
		const bat = first(s, "bateria");
		if (!bat) return [];
		const P = s.comps.filter((c) => c.kind === "bateria").reduce((acc, c) => acc - c.v * c.i, 0);
		return [String.raw`I_{\text{bateria}} = \text{${si$2(-bat.i, "A")}} \qquad P_{\text{fornecida}} = \text{${si$2(P, "W")}}`];
	},
	params: [{
		key: "montagem",
		label: "Montagem",
		unit: "",
		min: 0,
		max: PRESETS$3.length - 1,
		step: 1,
		default: 1,
		options: PRESETS$3.map((p, i) => ({
			value: i,
			label: p.label
		}))
	}, {
		key: "rInterna",
		label: "Resistência interna das baterias",
		unit: "Ω",
		min: .001,
		max: 10,
		step: .001,
		default: .1,
		log: true,
		live: true
	}],
	observables: [
		{
			key: "Ibat",
			label: "Corrente da bateria",
			unit: "A",
			value: (s) => -(first(s, "bateria")?.i ?? 0)
		},
		{
			key: "Vbat",
			label: "Tensão terminal da bateria",
			unit: "V",
			value: (s) => first(s, "bateria")?.v ?? 0
		},
		{
			key: "P",
			label: "Potência fornecida",
			unit: "W",
			value: (s) => s.comps.filter((c) => c.kind === "bateria").reduce((acc, c) => acc - c.v * c.i, 0)
		},
		{
			key: "A1",
			label: "Amperímetro",
			unit: "A",
			value: (s) => first(s, "amperimetro")?.i ?? 0
		},
		{
			key: "V1",
			label: "Voltímetro",
			unit: "V",
			value: (s) => first(s, "voltimetro")?.v ?? 0
		},
		{
			key: "Vc",
			label: "Tensão no capacitor",
			unit: "V",
			value: (s) => first(s, "capacitor")?.v ?? 0
		},
		{
			key: "Isel",
			label: "Corrente no selecionado",
			unit: "A",
			value: (s) => Math.abs(s.comps.find((c) => c.id === s.selected)?.i ?? 0)
		},
		{
			key: "Vsel",
			label: "Tensão no selecionado",
			unit: "V",
			value: (s) => Math.abs(s.comps.find((c) => c.id === s.selected)?.v ?? 0)
		}
	],
	chart: {
		x: "t",
		y: "Ibat"
	},
	scenarios: [
		{
			id: "serie",
			label: "Resistores em série",
			params: { montagem: 1 },
			guide: `### Série
1. Compare a leitura do amperímetro com $\\varepsilon/(R_1+R_2+R_3)$.
2. Selecione cada resistor e veja a tensão nele. A soma das tensões dá a da bateria?
3. Aumente a **resistência interna** e observe a tensão terminal cair.`,
			predict: [{
				question: "Se você trocar o resistor de 100 Ω por um de 1 kΩ, a corrente no circuito:",
				options: [
					"aumenta",
					"diminui",
					"não muda"
				],
				answer: 1,
				explanation: "Em série a resistência equivalente é a soma; ela cresce e a corrente $I = \\varepsilon / R_{eq}$ cai."
			}]
		},
		{
			id: "paralelo",
			label: "Resistores em paralelo",
			params: { montagem: 2 },
			guide: `### Paralelo
1. Selecione cada resistor: a tensão é a mesma em todos?
2. Some as correntes dos ramos e compare com o amperímetro (lei dos nós).
3. Apague um ramo. O que acontece com a corrente total?`,
			predict: [{
				question: "Ao acrescentar mais um resistor em paralelo, a corrente que sai da bateria:",
				options: [
					"aumenta",
					"diminui",
					"não muda"
				],
				answer: 0,
				explanation: "Cada ramo novo é um caminho a mais: $1/R_{eq}$ cresce, $R_{eq}$ cai e a corrente total sobe."
			}]
		},
		{
			id: "lampadas",
			label: "Lâmpadas: série × paralelo",
			params: { montagem: 3 },
			guide: `### Qual brilha mais?
As lâmpadas são iguais e as baterias também. O brilho é proporcional à potência $P = RI^2$.
1. Compare o brilho do lado em série com o lado em paralelo.
2. Selecione uma lâmpada de cada lado e compare as correntes.`,
			predict: [{
				question: "Qual par de lâmpadas brilha mais?",
				options: [
					"As em série",
					"As em paralelo",
					"Brilham igual"
				],
				answer: 1,
				explanation: "Em paralelo cada lâmpada recebe a tensão total da bateria; em série dividem a tensão, e $P = V^2/R$ cai a um quarto."
			}]
		},
		{
			id: "wheatstone",
			label: "Ponte de Wheatstone",
			params: { montagem: 4 },
			guide: `### Equilibrar a ponte
A ponte está equilibrada quando o amperímetro do meio marca zero, isto é, quando $R_1/R_2 = R_3/R_4$.
1. Selecione o resistor de 330 Ω e ajuste com os botões de valor até zerar o amperímetro.
2. Use a condição de equilíbrio para prever o valor antes de ajustar.`
		},
		{
			id: "kirchhoff",
			label: "Kirchhoff: duas fontes",
			params: { montagem: 5 },
			guide: `### Leis de Kirchhoff
1. Escreva as equações de malha para este circuito e resolva para as correntes.
2. Compare com o amperímetro e com as correntes de cada resistor (botão Selecionar).
3. Inverta a bateria de 6 V (Selecionar → Inverter) e refaça a previsão.`
		},
		{
			id: "rc",
			label: "Circuito RC com chave",
			params: { montagem: 6 },
			guide: `### Carga do capacitor
1. Clique em **Iniciar**, escolha **Selecionar** e clique na chave para fechá-la.
2. No gráfico, plote **Tensão no capacitor** contra **t**. Em $t = RC$ ela deve valer $63\\%$ da final.
3. Abra a chave e troque a bateria por um fio para ver a descarga.`
		},
		{
			id: "diodo",
			label: "Diodo",
			params: { montagem: 7 },
			guide: `### Diodo
1. Note a queda de cerca de 0,6 V no diodo (Selecionar → diodo).
2. Inverta o diodo: a corrente cai a quase zero.
3. Varie a bateria e observe que a tensão no diodo quase não muda.`
		},
		{
			id: "livre",
			label: "Bancada livre",
			params: { montagem: 0 },
			guide: `### Bancada livre
Escolha uma ferramenta e arraste de um ponto da grade a outro para colocar o componente.
Use **Selecionar** para ver correntes e tensões, fechar chaves e mudar valores.`
		}
	],
	exercises: [
		{
			id: "serie",
			prompt: "Uma bateria ideal de {eps} V alimenta três resistores em série de {r1} Ω, {r2} Ω e {r3} Ω. Qual é a corrente no circuito?",
			vary: {
				eps: [
					3,
					24,
					1
				],
				r1: [
					10,
					500,
					0
				],
				r2: [
					10,
					500,
					0
				],
				r3: [
					10,
					500,
					0
				]
			},
			answer: {
				label: "I",
				unit: "A",
				compute: (p) => (p.eps ?? 0) / ((p.r1 ?? 1) + (p.r2 ?? 0) + (p.r3 ?? 0))
			},
			hint: "Em série, R_eq = R₁ + R₂ + R₃."
		},
		{
			id: "paralelo",
			prompt: "Dois resistores de {r1} Ω e {r2} Ω estão em paralelo com uma bateria ideal de {eps} V. Qual é a corrente total fornecida?",
			vary: {
				eps: [
					3,
					24,
					1
				],
				r1: [
					10,
					1e3,
					0
				],
				r2: [
					10,
					1e3,
					0
				]
			},
			answer: {
				label: "I",
				unit: "A",
				compute: (p) => (p.eps ?? 0) * (1 / (p.r1 ?? 1) + 1 / (p.r2 ?? 1))
			},
			hint: "Em paralelo, 1/R_eq = 1/R₁ + 1/R₂."
		},
		{
			id: "rc",
			prompt: "Um capacitor de {c} mF carrega por um resistor de {r} Ω ligado a uma fonte. Quanto tempo leva para atingir 63% da tensão final?",
			vary: {
				c: [
					.1,
					5,
					1
				],
				r: [
					100,
					5e3,
					0
				]
			},
			answer: {
				label: "τ",
				unit: "s",
				compute: (p) => (p.c ?? 0) / 1e3 * (p.r ?? 0)
			},
			hint: "A constante de tempo é τ = RC."
		}
	],
	init(p) {
		return solveStep((PRESETS$3[Math.round(p.montagem ?? 0)] ?? PRESETS$3[0]).build(), p, .001, false);
	},
	step(s, p, _t, dt) {
		return solveStep(s, p, dt, true);
	},
	dt: .001,
	sampleEvery: 20,
	maxSamples: 3e3,
	viewport: () => ({
		xMin: -.6,
		xMax: 12.6,
		yMin: -.6,
		yMax: 8.6
	}),
	pointer: {
		down(s, p, pt) {
			const g = snap(pt.x, pt.y);
			if (s.tool === "selecionar") {
				const hit = nearest(s, pt.x, pt.y);
				if (!hit) return {
					...s,
					selected: null
				};
				let comps = s.comps;
				if (hit.kind === "chave" && s.selected === hit.id) comps = comps.map((c) => c.id === hit.id ? {
					...c,
					closed: !c.closed
				} : c);
				return solveStep({
					...s,
					comps,
					selected: hit.id
				}, p, .001, false);
			}
			if (s.tool === "apagar") {
				const hit = nearest(s, pt.x, pt.y);
				if (!hit) return void 0;
				return solveStep({
					...s,
					comps: s.comps.filter((c) => c.id !== hit.id),
					selected: null
				}, p, .001, false);
			}
			return {
				...s,
				drag: {
					from: g,
					to: g
				}
			};
		},
		move(s, _p, pt, dragging) {
			if (!dragging || !s.drag) return void 0;
			const [fx, fy] = s.drag.from;
			const g = snap(pt.x, pt.y);
			const to = Math.abs(g[0] - fx) >= Math.abs(g[1] - fy) ? [g[0], fy] : [fx, g[1]];
			if (to[0] === s.drag.to[0] && to[1] === s.drag.to[1]) return void 0;
			return {
				...s,
				drag: {
					from: s.drag.from,
					to
				}
			};
		},
		up(s, p) {
			if (!s.drag) return void 0;
			const { from, to } = s.drag;
			if (from[0] === to[0] && from[1] === to[1]) return {
				...s,
				drag: null
			};
			const kind = s.tool;
			const comps = s.comps.filter((c) => !sameSegment(c, from, to));
			const comp = makeComp(s.nextId, kind, kind === "bateria" ? to : from, kind === "bateria" ? from : to);
			return solveStep({
				...s,
				comps: [...comps, comp],
				drag: null,
				nextId: s.nextId + 1,
				selected: comp.id
			}, p, .001, false);
		},
		cursor(s, _p, pt) {
			if (s.tool === "selecionar" || s.tool === "apagar") return nearest(s, pt.x, pt.y) ? "pointer" : void 0;
			return "crosshair";
		}
	},
	actions: [
		...toolActions,
		{
			id: "mais",
			label: "Valor +",
			run: (s, p) => withSelected(s, p, (c) => UNIT$1[c.kind] ? {
				...c,
				value: stepValue(c.kind, c.value, 1)
			} : c)
		},
		{
			id: "menos",
			label: "Valor −",
			run: (s, p) => withSelected(s, p, (c) => UNIT$1[c.kind] ? {
				...c,
				value: stepValue(c.kind, c.value, -1)
			} : c)
		},
		{
			id: "inverter",
			label: "Inverter",
			run: (s, p) => withSelected(s, p, (c) => ({
				...c,
				a: c.b,
				b: c.a,
				i: -c.i,
				v: -c.v
			}))
		},
		{
			id: "chave",
			label: "Abrir/fechar chave",
			run: (s, p) => withSelected(s, p, (c) => c.kind === "chave" ? {
				...c,
				closed: !c.closed
			} : c)
		},
		{
			id: "limpar",
			label: "Limpar bancada",
			run: (s) => ({
				...s,
				comps: [],
				selected: null,
				drag: null,
				warning: ""
			})
		}
	],
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: s, theme } = frame;
		for (let x = 0; x <= W; x++) for (let y = 0; y <= H$1; y++) d.dot(x, y, 1.6, theme.muted, .45);
		for (const c of s.comps) drawComp(d, theme, c, c.id === s.selected);
		const count = /* @__PURE__ */ new Map();
		for (const c of s.comps) for (const p of [c.a, c.b]) count.set(`${p[0]},${p[1]}`, (count.get(`${p[0]},${p[1]}`) ?? 0) + 1);
		for (const [k, n] of count) {
			const [x, y] = k.split(",").map(Number);
			if (n >= 3) d.dot(x, y, 4, theme.text);
			else d.dot(x, y, 2.5, theme.text, .8);
		}
		if (s.drag) {
			const { from, to } = s.drag;
			d.line(from[0], from[1], to[0], to[1], {
				color: theme.accent,
				width: 3,
				dash: [6, 4]
			});
			d.dot(from[0], from[1], 5, theme.accent);
		}
		if (s.warning) d.text(s.warning, W / 2, 8.25, {
			color: theme.positive,
			weight: "600",
			size: 13
		});
		else d.text(`Ferramenta: ${TOOLS.find((t) => t.tool === s.tool)?.label ?? ""}`, 0, 8.3, {
			color: theme.muted,
			align: "left",
			size: 12
		});
	}
});
function nearest(s, x, y) {
	let best;
	let bd = .3;
	for (const c of s.comps) {
		const dd = distToComp(c, x, y);
		if (dd < bd) {
			bd = dd;
			best = c;
		}
	}
	return best;
}
function drawComp(d, theme, c, selected) {
	const [ax, ay] = c.a;
	const [bx, by] = c.b;
	const len = Math.hypot(bx - ax, by - ay);
	const ux = (bx - ax) / len;
	const uy = (by - ay) / len;
	const nx = -uy;
	const ny = ux;
	const mx = (ax + bx) / 2;
	const my = (ay + by) / 2;
	const color = selected ? theme.accent : theme.text;
	const w = selected ? 3 : 2;
	const half = Math.min(.45, len / 2);
	const P = (t, n = 0) => [mx + ux * t + nx * n, my + uy * t + ny * n];
	const lead = (h) => {
		d.line(ax, ay, ...P(-h), {
			color,
			width: w
		});
		d.line(...P(h), bx, by, {
			color,
			width: w
		});
	};
	switch (c.kind) {
		case "fio":
			d.line(ax, ay, bx, by, {
				color,
				width: w
			});
			break;
		case "resistor": {
			lead(half);
			const pts = [P(-half)];
			for (let k = 1; k < 8; k++) pts.push(P(-half + 2 * half * k / 8, k % 2 ? .14 : -.14));
			pts.push(P(half));
			d.polyline(pts, {
				color,
				width: w
			});
			break;
		}
		case "lampada": {
			const r = .28;
			lead(r);
			const P_ = Math.abs(c.v * c.i);
			const glow = Math.min(1, P_ / 6);
			if (glow > .01) d.circle(mx, my, r * (1 + 1.4 * glow), {
				fill: "#ffd54a",
				alpha: .25 + .5 * glow
			});
			d.circle(mx, my, r, {
				fill: glow > .01 ? `rgba(255, 213, 74, ${.3 + .7 * glow})` : "transparent",
				stroke: color,
				width: w
			});
			const k = r * .7;
			d.line(mx - k, my - k, mx + k, my + k, {
				color,
				width: 1.5
			});
			d.line(mx - k, my + k, mx + k, my - k, {
				color,
				width: 1.5
			});
			break;
		}
		case "bateria":
			lead(.08);
			d.line(...P(-.08, -.32), ...P(-.08, .32), {
				color,
				width: 3
			});
			d.line(...P(.08, -.18), ...P(.08, .18), {
				color,
				width: 5
			});
			d.text("+", ...P(-.3, .32), {
				color: theme.positive,
				weight: "700",
				size: 14
			});
			break;
		case "chave": {
			lead(half);
			d.dot(...P(-half), 3, color);
			d.dot(...P(half), 3, color);
			const end = c.closed ? P(half) : P(half * .8, .45);
			d.line(...P(-half), ...end, {
				color,
				width: w + .5
			});
			break;
		}
		case "capacitor":
			lead(.07);
			d.line(...P(-.07, -.3), ...P(-.07, .3), {
				color,
				width: 3
			});
			d.line(...P(.07, -.3), ...P(.07, .3), {
				color,
				width: 3
			});
			break;
		case "indutor": {
			lead(half);
			const pts = [];
			const loops = 4;
			for (let k = 0; k <= 64; k++) {
				const t = k / 64;
				const ang = Math.PI * loops * t;
				pts.push(P(-half + 2 * half * t, .16 * Math.abs(Math.sin(ang))));
			}
			d.polyline(pts, {
				color,
				width: w
			});
			break;
		}
		case "diodo":
			lead(.18);
			d.polyline([
				P(-.18, -.2),
				P(-.18, .2),
				P(.18, 0)
			], {
				color,
				width: w,
				close: true,
				fill: color
			});
			d.line(...P(.18, -.2), ...P(.18, .2), {
				color,
				width: 3
			});
			break;
		case "amperimetro":
		case "voltimetro": {
			const r = .26;
			lead(r);
			d.circle(mx, my, r, {
				fill: theme.dark ? "#1a2029" : "#ffffff",
				stroke: color,
				width: w
			});
			d.text(c.kind === "amperimetro" ? "A" : "V", mx, my, {
				color,
				weight: "700",
				size: 14
			});
			const reading = c.kind === "amperimetro" ? si$2(c.i, "A") : si$2(c.v, "V");
			d.text(reading, ...P(0, .55), {
				color: theme.accent,
				weight: "600",
				size: 12
			});
			break;
		}
	}
	const unit = UNIT$1[c.kind];
	if (unit) d.text(si$2(c.value, unit), ...P(0, -.42), {
		color: theme.muted,
		size: 11
	});
	if (Math.abs(c.i) > 1e-7) {
		const spacing = .25;
		for (let s = (c.phase % spacing + spacing) % spacing; s < len; s += spacing) d.dot(ax + ux * s, ay + uy * s, 2.4, theme.series[1], .9);
	}
}
//#endregion
//#region sims/foguete/src/index.ts
var G0 = 9.81;
var RHO0 = 1.225;
var HSCALE = 8500;
var nStages = (p) => Math.max(1, Math.min(3, Math.round(num(p, "n", 1))));
function stages(p) {
	const n = nStages(p);
	const M1 = num(p, "M1", 2e4);
	const r = num(p, "r", .3);
	const eps = num(p, "eps", .1);
	const tb = num(p, "tb", 60);
	const out = [];
	for (let j = 0; j < n; j++) {
		const mass = M1 * r ** j;
		const prop = (1 - eps) * mass;
		out.push({
			mass,
			prop,
			dry: eps * mass,
			mdot: prop / tb
		});
	}
	return out;
}
/** Massa na ignição de cada estágio. */
function ignitionMasses(p) {
	const st = stages(p);
	const mpl = num(p, "mpl", 500);
	return st.map((_, j) => mpl + st.slice(j).reduce((a, s) => a + s.mass, 0));
}
/** Δv ideal de Tsiolkovsky somado sobre os estágios. */
function deltaVIdeal(p) {
	const ve = num(p, "ve", 2500);
	const st = stages(p);
	return ignitionMasses(p).reduce((a, m0, j) => a + ve * Math.log(m0 / (m0 - st[j].prop)), 0);
}
/** Δv de um único estágio com a mesma massa total, mesma fração estrutural e mesma carga útil. */
function deltaVSingle(p) {
	const ve = num(p, "ve", 2500);
	const total = stages(p).reduce((a, s) => a + s.mass, 0);
	const mpl = num(p, "mpl", 500);
	const eps = num(p, "eps", .1);
	return ve * Math.log((mpl + total) / (mpl + eps * total));
}
/** Velocidade ideal (Tsiolkovsky, sem gravidade nem arrasto) correspondente ao consumo até o estado s. */
function vIdealNow(s, p) {
	const ve = num(p, "ve", 2500);
	const st = stages(p);
	const mi = ignitionMasses(p);
	const k = s[3];
	let dv = 0;
	for (let j = 0; j < Math.min(k, st.length); j++) dv += ve * Math.log(mi[j] / (mi[j] - st[j].prop));
	if (k < st.length) dv += ve * Math.log(mi[k] / s[2]);
	return dv;
}
var gOn = (p) => Math.round(num(p, "grav", 1)) === 1;
var dragOn = (p) => Math.round(num(p, "arrasto", 0)) === 1;
var rho = (h) => RHO0 * Math.exp(-Math.max(0, h) / HSCALE);
var dragForce = (h, v, p) => dragOn(p) ? .5 * rho(h) * num(p, "CdA", 1) * v * Math.abs(v) : 0;
var thrust = (s, p) => {
	const st = stages(p)[s[3]];
	return st && s[4] > 0 ? st.mdot * num(p, "ve", 2500) : 0;
};
function deriv(y, p, burning, mdot) {
	const [h, v, m] = y;
	const T = burning ? mdot * num(p, "ve", 2500) : 0;
	const g = gOn(p) ? G0 : 0;
	let a = (T - dragForce(h, v, p)) / m - g;
	if (h <= 0 && v <= 0 && a < 0) a = 0;
	return [
		h <= 0 && v <= 0 && a <= 0 ? 0 : v,
		a,
		burning ? -mdot : 0,
		0,
		burning ? -mdot : 0,
		1
	];
}
function rk4seg(y, p, dt) {
	const st = stages(p)[y[3]];
	const burning = !!st && y[4] > 0;
	const md = st ? st.mdot : 0;
	const f = (z) => deriv(z, p, burning, md);
	const add = (a, b, c) => a.map((v, i) => v + c * b[i]);
	const k1 = f(y);
	const k2 = f(add(y, k1, dt / 2));
	const k3 = f(add(y, k2, dt / 2));
	const k4 = f(add(y, k3, dt));
	const out = y.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
	if (out[0] < 0) {
		out[0] = 0;
		if (out[1] < 0) out[1] = 0;
	}
	return out;
}
/** Passo com troca de estágio exata no instante da queima total. */
function advance(y, p, dt) {
	let s = y.slice();
	let left = dt;
	const st = stages(p);
	for (let guard = 0; guard < 8 && left > 1e-15; guard++) {
		const cur = st[s[3]];
		if (cur && s[4] > 0) {
			const tOut = s[4] / cur.mdot;
			if (tOut <= left) {
				s = rk4seg(s, p, tOut);
				s[2] = s[2] - Math.max(0, s[4]) - cur.dry;
				s[3] = s[3] + 1;
				const nxt = st[s[3]];
				s[4] = nxt ? nxt.prop : 0;
				left -= tOut;
				continue;
			}
		}
		s = rk4seg(s, p, left);
		left = 0;
	}
	return s;
}
var fmt$6 = (v, n = 3) => Number.isFinite(v) ? Number(v.toPrecision(n)).toString().replace(".", ",") : "—";
var COL = {
	x0: 3,
	x1: 22,
	y0: 4,
	y1: 57
};
var PV = {
	x0: 32,
	x1: 97,
	y0: 35,
	y1: 57
};
var PM = {
	x0: 32,
	x1: 97,
	y0: 6,
	y1: 27
};
var foguete = defineSim({
	id: "foguete",
	title: "Foguete e massa variável",
	course: "FG I",
	topic: "Sistemas de partículas",
	priority: "P2",
	summary: "Lançamento vertical com empuxo, gravidade e arrasto opcional, em até três estágios: compare v(t) com a equação de Tsiolkovsky e veja quanto se ganha descartando os tanques vazios.",
	equations: [
		String.raw`m\frac{dv}{dt} = v_e\left|\frac{dm}{dt}\right| - mg - \tfrac12 \rho C_D A\, v|v|`,
		String.raw`\text{Tsiolkovsky: } \Delta v = v_e \ln\frac{m_0}{m_f} \qquad \text{com } g \text{ constante: } v(t_q) = v_e\ln\frac{m_0}{m_f} - g\,t_q`,
		String.raw`\text{estágios: } \Delta v = \sum_j v_e \ln\frac{m_{0,j}}{m_{0,j} - m_{p,j}} \qquad \rho(h) = \rho_0\, e^{-h/H}`
	],
	liveEquations(s, p) {
		const ve = num(p, "ve", 2500);
		const vi = vIdealNow(s, p);
		return [
			String.raw`v_{\text{ideal}} = ${texNum(vi)}\ \text{m/s} \qquad v = ${texNum(s[1])}\ \text{m/s} \qquad \text{perdas} = ${texNum(vi - s[1])}\ \text{m/s}`,
			String.raw`\Delta v_{\text{total}} = ${texNum(deltaVIdeal(p))}\ \text{m/s} \quad (1\ \text{estágio de mesma massa: } ${texNum(deltaVSingle(p))}\ \text{m/s}) \quad v_e = ${texNum(ve)}\ \text{m/s}`,
			String.raw`m = ${texNum(s[2])}\ \text{kg} \qquad h = ${texNum(s[0])}\ \text{m}`
		];
	},
	params: [
		{
			key: "n",
			label: "Número de estágios",
			unit: "",
			min: 1,
			max: 3,
			step: 1,
			default: 1,
			options: [
				{
					value: 1,
					label: "1 estágio"
				},
				{
					value: 2,
					label: "2 estágios"
				},
				{
					value: 3,
					label: "3 estágios"
				}
			]
		},
		{
			key: "M1",
			label: "Massa do 1º estágio",
			unit: "kg",
			min: 1e3,
			max: 1e5,
			step: 500,
			default: 2e4
		},
		{
			key: "r",
			label: "Razão de massa entre estágios",
			unit: "",
			min: .1,
			max: 1,
			step: .05,
			default: .3
		},
		{
			key: "eps",
			label: "Fração estrutural de cada estágio",
			unit: "",
			min: .03,
			max: .4,
			step: .01,
			default: .1
		},
		{
			key: "mpl",
			label: "Carga útil",
			unit: "kg",
			min: 10,
			max: 5e3,
			step: 10,
			default: 500
		},
		{
			key: "ve",
			label: "Velocidade de exaustão",
			unit: "m/s",
			min: 500,
			max: 4500,
			step: 50,
			default: 2500
		},
		{
			key: "tb",
			label: "Tempo de queima de cada estágio",
			unit: "s",
			min: 5,
			max: 200,
			step: 1,
			default: 60
		},
		{
			key: "grav",
			label: "Gravidade",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 1,
			options: [{
				value: 1,
				label: "Com gravidade (g = 9,81 m/s²)"
			}, {
				value: 0,
				label: "Sem gravidade (espaço)"
			}]
		},
		{
			key: "arrasto",
			label: "Arrasto do ar",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Sem arrasto"
			}, {
				value: 1,
				label: "Com arrasto (atmosfera exponencial)"
			}]
		},
		{
			key: "CdA",
			label: "Área efetiva de arrasto C_D·A",
			unit: "m²",
			min: .1,
			max: 5,
			step: .1,
			default: 1
		}
	],
	observables: [
		{
			key: "v",
			label: "Velocidade",
			unit: "m/s",
			value: (s) => s[1]
		},
		{
			key: "vid",
			label: "Velocidade ideal (Tsiolkovsky)",
			unit: "m/s",
			value: vIdealNow
		},
		{
			key: "h",
			label: "Altitude",
			unit: "m",
			value: (s) => s[0]
		},
		{
			key: "m",
			label: "Massa",
			unit: "kg",
			value: (s) => s[2]
		},
		{
			key: "T",
			label: "Empuxo",
			unit: "N",
			value: thrust
		},
		{
			key: "D",
			label: "Arrasto",
			unit: "N",
			value: (s, p) => dragForce(s[0], s[1], p)
		},
		{
			key: "perda",
			label: "Perdas (ideal − real)",
			unit: "m/s",
			value: (s, p) => vIdealNow(s, p) - s[1]
		},
		{
			key: "est",
			label: "Estágio em queima",
			unit: "",
			value: (s, p) => Math.min(s[3] + 1, nStages(p) + 1)
		}
	],
	chart: {
		x: "t",
		y: "v"
	},
	scenarios: [
		{
			id: "espaco",
			label: "Tsiolkovsky puro",
			params: {
				n: 1,
				grav: 0,
				arrasto: 0,
				eps: .1,
				ve: 2500,
				tb: 60
			},
			guide: `### A equação do foguete
1. Sem gravidade nem ar, só o empuxo age: $m\\,dv = -v_e\\,dm$, e $v = v_e\\ln(m_0/m)$.
2. Rode: a curva de $v(t)$ coincide com a ideal (tracejada). Ela **acelera cada vez mais**: a mesma vazão empurra uma massa cada vez menor.
3. Dobre a massa do estágio mantendo a carga útil. O $\\Delta v$ dobra?`,
			predict: [{
				question: "Com a mesma fração estrutural, dobrar a quantidade de combustível de um foguete faz o Δv:",
				options: [
					"dobrar",
					"crescer menos que o dobro",
					"crescer mais que o dobro"
				],
				answer: 1,
				explanation: "O Δv depende do logaritmo da razão de massas, e o tanque maior também pesa mais. Por isso não se chega à órbita com um estágio só: o ganho satura em $v_e\\ln(1/\\varepsilon)$."
			}]
		},
		{
			id: "estagios",
			label: "Vários estágios",
			params: {
				n: 3,
				grav: 0,
				arrasto: 0,
				M1: 2e4,
				r: .3,
				eps: .12,
				mpl: 300
			},
			guide: `### Jogar fora o peso morto
1. Com três estágios, cada tanque vazio é descartado: o próximo estágio só acelera o que ainda é útil.
2. Compare no painel o $\\Delta v$ dos estágios com o de **um único estágio de mesma massa total**.
3. Varie a razão entre estágios: há um valor que maximiza o $\\Delta v$?`,
			predict: [{
				question: "Com a mesma massa total, propelente e carga útil, dividir o foguete em 3 estágios dá:",
				options: [
					"o mesmo Δv",
					"Δv maior",
					"Δv menor"
				],
				answer: 1,
				explanation: "Depois que cada estágio queima, sua estrutura vazia é descartada e não precisa mais ser acelerada: as razões de massa de cada estágio se multiplicam."
			}]
		},
		{
			id: "gravidade",
			label: "Perda por gravidade",
			params: {
				n: 1,
				grav: 1,
				arrasto: 0,
				M1: 2e4,
				eps: .1,
				mpl: 500,
				ve: 2500,
				tb: 60
			},
			guide: `### O preço de subir devagar
1. Com gravidade constante, no fim da queima $v = v_e\\ln(m_0/m_f) - g\\,t_q$.
2. Rode e compare a perda com $g\\,t_q$. Diminua o tempo de queima (mais empuxo): a perda cai.
3. Se o empuxo inicial for menor que o peso ($v_e\\dot m < m_0 g$), o foguete espera na plataforma queimando combustível.`
		},
		{
			id: "arrasto",
			label: "Com atmosfera",
			params: {
				n: 2,
				grav: 1,
				arrasto: 1,
				CdA: 1.5,
				M1: 2e4,
				r: .3,
				eps: .1,
				mpl: 300,
				tb: 50
			},
			guide: `### Arrasto na atmosfera
1. O arrasto $\\tfrac12\\rho C_DA v^2$ é grande na baixa atmosfera e some com a altitude ($\\rho$ cai pela metade a cada ~6 km).
2. Compare o gráfico do arrasto com a altitude: ele tem um máximo (pressão dinâmica máxima, o "Max Q").
3. Qual perda é maior aqui, a de gravidade ou a de arrasto?`
		}
	],
	exercises: [{
		id: "tsiolkovsky",
		prompt: "Um foguete de um estágio tem {M1} kg (fração estrutural {eps}) e leva {mpl} kg de carga útil. A velocidade de exaustão é {ve} m/s. Qual o Δv ideal?",
		vary: {
			M1: [
				5e3,
				5e4,
				0
			],
			eps: [
				.05,
				.2,
				2
			],
			mpl: [
				100,
				2e3,
				0
			],
			ve: [
				2e3,
				4e3,
				0
			]
		},
		fixed: {
			n: 1,
			grav: 0,
			arrasto: 0
		},
		answer: {
			label: "Δv",
			unit: "m/s",
			compute: (p) => deltaVIdeal(p)
		},
		hint: "m₀ = carga + estágio; m_f = carga + estrutura."
	}, {
		id: "queima-g",
		prompt: "O mesmo tipo de foguete ({M1} kg, fração estrutural {eps}, carga {mpl} kg, v_e = {ve} m/s) sobe na vertical queimando tudo em {tb} s, com g = 9,81 m/s² constante e sem ar. Qual a velocidade ao fim da queima?",
		vary: {
			M1: [
				5e3,
				5e4,
				0
			],
			eps: [
				.05,
				.2,
				2
			],
			mpl: [
				100,
				2e3,
				0
			],
			ve: [
				2e3,
				4e3,
				0
			],
			tb: [
				20,
				120,
				0
			]
		},
		fixed: {
			n: 1,
			grav: 1,
			arrasto: 0
		},
		answer: {
			label: "v",
			unit: "m/s",
			compute: (p) => deltaVIdeal(p) - G0 * num(p, "tb")
		},
		hint: "O empuxo inicial precisa vencer o peso (confira); então v = v_e ln(m₀/m_f) − g t."
	}],
	init(p) {
		const st = stages(p);
		return [
			0,
			0,
			ignitionMasses(p)[0],
			0,
			st[0].prop,
			0
		];
	},
	step: (s, p, _t, dt) => advance(s, p, dt),
	dt: .05,
	sampleEvery: 4,
	tEnd: 2e3,
	stopWhen(s, p, t) {
		if (s[3] < nStages(p)) return 1;
		if (gOn(p)) return s[1];
		return nStages(p) * num(p, "tb", 60) + 40 - t;
	},
	viewport: () => ({
		xMin: 0,
		xMax: 100,
		yMin: 0,
		yMax: 60,
		unit: ""
	}),
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: s, params: p, theme, trail, t } = frame;
		const st = stages(p);
		const n = st.length;
		const k = s[3];
		const hs = trail.map((x) => x[0]);
		const hTop = Math.max(1e3, ...hs, s[0]) * 1.15;
		const Yh = (h) => COL.y0 + h / hTop * (COL.y1 - COL.y0 - 10);
		d.line(COL.x0, COL.y0, COL.x0, COL.y1 - 10, {
			color: theme.muted,
			width: 1
		});
		for (let i = 0; i <= 4; i++) {
			const hh = hTop * i / 4.6;
			d.line(COL.x0, Yh(hh), COL.x0 + 1, Yh(hh), {
				color: theme.muted,
				width: 1
			});
			d.text(hh >= 1e3 ? `${fmt$6(hh / 1e3, 2)} km` : `${fmt$6(hh, 2)} m`, COL.x0 + 1.5, Yh(hh), {
				align: "left",
				size: 9,
				color: theme.muted
			});
		}
		d.rect(0, COL.y0 - 2, 25, 2, { fill: theme.ground });
		const cx = 15;
		let yb = Yh(s[0]);
		const scaleW = 2.2;
		for (let j = k; j < n; j++) {
			const hgt = 2.2 + 3.6 * (st[j].mass / st[0].mass) ** (1 / 3);
			const w = scaleW * (.6 + .4 * (st[j].mass / st[0].mass) ** (1 / 3));
			const frac = j === k ? s[4] / st[j].prop : 1;
			d.rect(cx - w / 2, yb, w, hgt, {
				fill: theme.series[j],
				alpha: .35,
				stroke: theme.text,
				width: 1
			});
			d.rect(cx - w / 2, yb, w, hgt * frac, {
				fill: theme.series[j],
				alpha: .85
			});
			if (j === k && s[4] > 0) {
				const fl = 2 + 1.5 * Math.abs(Math.sin(t * 40));
				d.polyline([
					[cx - w * .35, yb],
					[cx, yb - fl],
					[cx + w * .35, yb]
				], {
					close: true,
					fill: theme.series[5],
					color: theme.series[1],
					width: 1
				});
			}
			yb += hgt;
		}
		d.polyline([
			[14.1, yb],
			[cx, yb + 2],
			[15.9, yb]
		], {
			close: true,
			fill: theme.muted,
			color: theme.text,
			width: 1
		});
		d.text(k < n ? `Estágio ${k + 1} de ${n}` : "Queima encerrada", cx, COL.y1 - 4, {
			size: 11,
			weight: "600"
		});
		d.text(`h = ${fmt$6(s[0])} m`, cx, COL.y1 - 6.5, { size: 11 });
		const tq = n * num(p, "tb", 60);
		const tMax = Math.max(tq * 1.25, t * 1.05, 1);
		const dvI = deltaVIdeal(p);
		const vMax = Math.max(dvI * 1.1, ...trail.map((x) => x[1]), 1);
		const m0 = ignitionMasses(p)[0];
		const X = (box, tt) => box.x0 + tt / tMax * (box.x1 - box.x0);
		const Yv = (v) => PV.y0 + v / vMax * (PV.y1 - PV.y0);
		const Ym = (m) => PM.y0 + m / m0 * (PM.y1 - PM.y0);
		for (const box of [PV, PM]) {
			d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, {
				stroke: theme.grid,
				width: 1
			});
			for (let j = 1; j <= n; j++) d.line(X(box, j * num(p, "tb", 60)), box.y0, X(box, j * num(p, "tb", 60)), box.y1, {
				color: theme.grid,
				width: 1,
				dash: [3, 3]
			});
		}
		const dtS = num(p, "tb", 60) * n / 400;
		const ideal = [];
		const mi = ignitionMasses(p);
		const ve = num(p, "ve", 2500);
		for (let tt = 0; tt <= tq + 1e-9; tt += dtS) {
			const j = Math.min(n - 1, Math.floor(tt / num(p, "tb", 60)));
			let dv = 0;
			for (let q = 0; q < j; q++) dv += ve * Math.log(mi[q] / (mi[q] - st[q].prop));
			const mNow = mi[j] - st[j].mdot * (tt - j * num(p, "tb", 60));
			dv += ve * Math.log(mi[j] / mNow);
			ideal.push([X(PV, tt), Yv(dv)]);
		}
		ideal.push([X(PV, tMax), Yv(dvI)]);
		d.polyline(ideal, {
			color: theme.muted,
			dash: [6, 4],
			width: 1.5
		});
		const tr = [...trail, s];
		d.polyline(tr.map((x) => [X(PV, x[5] ?? 0), Yv(x[1])]), {
			color: theme.accent,
			width: 2
		});
		d.polyline(tr.map((x) => [X(PM, x[5] ?? 0), Ym(x[2])]), {
			color: theme.series[1],
			width: 2
		});
		d.text("v(t): simulação (azul) e Tsiolkovsky ideal (tracejado)", PV.x0, PV.y1 + 1.5, {
			align: "left",
			size: 11,
			weight: "600"
		});
		d.text("m(t): degraus = estágios descartados", PM.x0, PM.y1 + 1.5, {
			align: "left",
			size: 11,
			weight: "600"
		});
		d.text(`${fmt$6(vMax)} m/s`, PV.x0 - .5, PV.y1, {
			align: "right",
			size: 9,
			color: theme.muted
		});
		d.text("0", PV.x0 - .5, PV.y0, {
			align: "right",
			size: 9,
			color: theme.muted
		});
		d.text(`${fmt$6(m0)} kg`, PM.x0 - .5, PM.y1, {
			align: "right",
			size: 9,
			color: theme.muted
		});
		d.text("0", PM.x0 - .5, PM.y0, {
			align: "right",
			size: 9,
			color: theme.muted
		});
		d.text(`t (s), até ${fmt$6(tMax)} s`, PM.x1, PM.y0 - 1.6, {
			align: "right",
			size: 9,
			color: theme.muted
		});
		const vi = vIdealNow(s, p);
		[
			`Δv ideal (${n} estágio${n > 1 ? "s" : ""}): ${fmt$6(dvI)} m/s`,
			`1 estágio de mesma massa: ${fmt$6(deltaVSingle(p))} m/s`,
			`Agora: v = ${fmt$6(s[1])} m/s, ideal ${fmt$6(vi)} m/s`,
			`Perdas: ${fmt$6(vi - s[1])} m/s${gOn(p) ? ` (g·t = ${fmt$6(G0 * Math.min(t, tq))} m/s)` : ""}`
		].forEach((ln, i) => d.text(ln, PM.x1 - 1, PM.y1 - 1.5 - i * 2, {
			align: "right",
			size: 10,
			weight: i === 0 ? "700" : "400"
		}));
		const T0 = st[0].mdot * ve;
		if (gOn(p) && T0 < m0 * 9.81) d.text("Empuxo inicial menor que o peso: o foguete espera na plataforma", PM.x0 + 1, PM.y0 + 1.5, {
			align: "left",
			size: 10,
			color: theme.negative,
			weight: "700"
		});
	}
});
//#endregion
//#region sims/jogos-fisica/src/physics.ts
var K_E = 89875e5;
var NANO = 1e-9;
/** Campo de jogo (m) e disco. */
var CAMPO = {
	w: 1.6,
	h: 1
};
var DISCO = {
	x0: .15,
	y0: .5,
	m: .001,
	raio: .02
};
/** Raio de amolecimento das cargas (m): evita a singularidade 1/r². */
var R_SUAVE = .03;
var FASES_HOQUEI = [
	{
		gol: {
			x0: 1.45,
			y0: .42,
			x1: 1.56,
			y1: .58
		},
		obst: []
	},
	{
		gol: {
			x0: 1.45,
			y0: .42,
			x1: 1.56,
			y1: .58
		},
		obst: [{
			x0: .75,
			y0: .3,
			x1: .8,
			y1: 1
		}]
	},
	{
		gol: {
			x0: 1.45,
			y0: .42,
			x1: 1.56,
			y1: .58
		},
		obst: [{
			x0: .6,
			y0: 0,
			x1: .65,
			y1: .68
		}, {
			x0: 1.05,
			y0: .32,
			x1: 1.1,
			y1: 1
		}]
	},
	{
		gol: {
			x0: .86,
			y0: .41,
			x1: .94,
			y1: .5
		},
		obst: [
			{
				x0: .8,
				y0: .35,
				x1: .83,
				y1: .62
			},
			{
				x0: .97,
				y0: .35,
				x1: 1,
				y1: .62
			},
			{
				x0: .8,
				y0: .35,
				x1: 1,
				y1: .38
			}
		]
	}
];
/** Força elétrica (N) sobre o disco de carga Q (nC) em (x, y). */
function forcaEletrica(cargas, Q, x, y) {
	let fx = 0, fy = 0;
	for (const c of cargas) {
		const dx = x - c.x, dy = y - c.y;
		const r2 = dx * dx + dy * dy + R_SUAVE * R_SUAVE;
		const f = K_E * c.q * Q * NANO * NANO / (r2 * Math.sqrt(r2));
		fx += f * dx;
		fy += f * dy;
	}
	return [fx, fy];
}
/** Energia potencial elétrica do disco (J), com o mesmo amolecimento. */
var potencial = (cargas, Q, x, y) => cargas.reduce((a, c) => a + K_E * c.q * Q * NANO * NANO / Math.hypot(x - c.x, y - c.y, R_SUAVE), 0);
var dentro = (r, x, y, m = 0) => x >= r.x0 - m && x <= r.x1 + m && y >= r.y0 - m && y <= r.y1 + m;
var PLANETAS = [
	{
		value: 1.62,
		label: "Lua (1,62 m/s²)"
	},
	{
		value: 3.71,
		label: "Marte (3,71 m/s²)"
	},
	{
		value: 9.81,
		label: "Terra (9,81 m/s²)"
	}
];
var MODULO = {
	mSeca: 1e3,
	vEx: 3e3,
	altura: 8,
	largura: 8
};
var MUNDO_L = {
	w: 400,
	h: 260
};
var PISTAS = [
	{
		x0: 160,
		x1: 240
	},
	{
		x0: 300,
		x1: 340
	},
	{
		x0: 88,
		x1: 113
	}
];
/** Limites para um pouso seguro. */
var POUSO = {
	vy: 2,
	vx: 1,
	ang: 10 * Math.PI / 180
};
var relevo = (x) => 40 + 22 * Math.sin(x / 37) + 12 * Math.sin(x / 13 + 1) + 6 * Math.sin(x / 5.3);
/** Altura do solo (m) em x; a pista é plana e lisa. */
function terreno(x, nivel) {
	const pista = PISTAS[nivel] ?? PISTAS[0];
	const yp = relevo((pista.x0 + pista.x1) / 2);
	if (x >= pista.x0 && x <= pista.x1) return yp;
	const dist = x < pista.x0 ? pista.x0 - x : x - pista.x1;
	const u = clamp(dist / 12, 0, 1);
	const montanha = nivel === 2 ? 70 * Math.exp(-(((dist - 25) / 12) ** 2)) : 0;
	return yp + (relevo(x) - yp) * u + montanha;
}
/** Derivadas do módulo: empuxo T (N) na direção do ângulo (0 = para cima, positivo inclina para +x). */
function derivModulo(s, T, g) {
	const empuxo = s.comb > 0 ? T : 0;
	const m = MODULO.mSeca + s.comb;
	return {
		ax: empuxo * Math.sin(s.ang) / m,
		ay: empuxo * Math.cos(s.ang) / m - g,
		dm: -empuxo / MODULO.vEx
	};
}
/** Distância de frenagem com empuxo máximo constante: v²/(2(T/m − g)). */
var distFrenagem = (v, aT, g) => aT > g ? v * v / (2 * (aT - g)) : Infinity;
/** Piloto automático: empuxo e ângulo para levar o módulo à pista com descida controlada. */
function piloto(s, nivel, g, Tmax) {
	const pista = PISTAS[nivel] ?? PISTAS[0];
	const alvo = (pista.x0 + pista.x1) / 2;
	const solo = terreno(alvo, nivel);
	const h = s.y - solo;
	const m = MODULO.mSeca + s.comb;
	const vyDes = Math.abs(alvo - s.x) > (pista.x1 - pista.x0) / 4 ? clamp(.5 * (solo + 90 - s.y), -3, 3) : -(.8 + .25 * Math.sqrt(Math.max(0, h)));
	const ax = .6 * (clamp(.08 * (alvo - s.x), -12, 12) - s.vx);
	const ay = g + 1.2 * (vyDes - s.vy);
	let ang = Math.atan2(ax, Math.max(.1, ay));
	ang = clamp(ang, -.5, .5);
	if (h < 6) ang = clamp(ang, -.08, .08);
	return {
		T: clamp(m * Math.max(0, ay) / Math.cos(ang), 0, Tmax),
		ang
	};
}
var LABIRINTOS = [[
	"##########",
	"#S.......#",
	"#........#",
	"#..####..#",
	"#..#..#..#",
	"#..#G.#..#",
	"#..#..#..#",
	"#..##.#..#",
	"#........#",
	"##########"
], [
	"##########",
	"#S#......#",
	"#.#.####.#",
	"#.#.#..#.#",
	"#...#.##.#",
	"#####.#..#",
	"#.....#.##",
	"#.#####..#",
	"#......#G#",
	"##########"
]];
var RAIO_PART = .22;
/** Célula (coluna, linha) → caractere; y do mundo cresce para cima (linha 0 em cima). */
function celula(nivel, x, y) {
	const lab = LABIRINTOS[nivel] ?? LABIRINTOS[0];
	const col = Math.floor(x);
	return lab[9 - Math.floor(y)]?.[col] ?? "#";
}
function achar(nivel, ch) {
	const lab = LABIRINTOS[nivel] ?? LABIRINTOS[0];
	for (let l = 0; l < lab.length; l++) {
		const c = lab[l].indexOf(ch);
		if (c >= 0) return [c + .5, 9 - l + .5];
	}
	return [1.5, 8.5];
}
/** O disco de raio r em (x, y) toca alguma parede? */
function bateu(nivel, x, y, r = RAIO_PART) {
	for (let cx = Math.floor(x - r); cx <= Math.floor(x + r); cx++) for (let cy = Math.floor(y - r); cy <= Math.floor(y + r); cy++) {
		if (celula(nivel, cx + .5, cy + .5) !== "#") continue;
		const px = clamp(x, cx, cx + 1);
		const py = clamp(y, cy, cy + 1);
		if ((x - px) ** 2 + (y - py) ** 2 < r * r) return true;
	}
	return false;
}
var jogo = (p) => Math.round(num(p, "jogo"));
var nivelDe = (p) => Math.round(num(p, "nivel"));
//#endregion
//#region sims/jogos-fisica/src/index.ts
var fmt$5 = (v, d = 3) => formatBR(v, d);
var faseH = (p) => FASES_HOQUEI[clamp(nivelDe(p), 0, FASES_HOQUEI.length - 1)];
var nivelL = (p) => clamp(nivelDe(p), 0, PISTAS.length - 1);
var nivelM = (p) => clamp(nivelDe(p), 0, LABIRINTOS.length - 1);
var Qdisco = (p) => num(p, "Qdisco", 20);
var gPlaneta = (p) => num(p, "g", 1.62);
var Tmax = (p) => num(p, "Tmax", 5) * 1e3;
var modoLab = (p) => Math.round(num(p, "controle"));
var autopiloto = (p) => Math.round(num(p, "piloto")) === 1;
var VMAX = 3;
var AMAX = 3;
var PAD = {
	cx: 13.4,
	cy: 7.5,
	r: 2.1
};
function moduloInicial(p) {
	return {
		x: num(p, "x0", 60),
		y: 220,
		vx: num(p, "vx0", 6),
		vy: 0,
		ang: 0,
		comb: num(p, "comb", 400)
	};
}
function init$2(p) {
	const [sx, sy] = achar(nivelM(p), "S");
	return {
		status: 0,
		msg: "",
		pontos: 0,
		tj: 0,
		cargas: Math.round(num(p, "exemplo")) === 1 && nivelDe(p) === 0 ? [{
			x: .05,
			y: .5,
			q: num(p, "qPeca", 50)
		}] : [],
		d: [
			DISCO.x0,
			DISCO.y0,
			0,
			0
		],
		lancado: Math.round(num(p, "exemplo")) === 1,
		arr: -1,
		rastro: [],
		L: moduloInicial(p),
		motor: false,
		mira: 0,
		T: 0,
		pos: [sx, sy],
		vel: [0, 0],
		acel: [0, 0],
		ctrl: modoLab(p) === 0 ? [(sx - 5) / 5, (sy - 5) / 5] : [0, 0],
		colisoes: 0,
		hist: []
	};
}
function passoHoquei(s, p, dt) {
	if (!s.lancado || s.status !== 0) return s;
	const Q = Qdisco(p);
	const f = (y) => {
		const [fx, fy] = forcaEletrica(s.cargas, Q, y[0], y[1]);
		return [
			y[2],
			y[3],
			fx / DISCO.m,
			fy / DISCO.m
		];
	};
	const y0 = s.d;
	const k1 = f(y0);
	const k2 = f(y0.map((v, i) => v + .5 * dt * k1[i]));
	const k3 = f(y0.map((v, i) => v + .5 * dt * k2[i]));
	const k4 = f(y0.map((v, i) => v + dt * k3[i]));
	const d = y0.map((v, i) => v + dt / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
	const tj = s.tj + dt;
	const ult = s.rastro[s.rastro.length - 1];
	const rastro = !ult || Math.hypot(d[0] - ult[0], d[1] - ult[1]) > .008 ? [...s.rastro, [d[0], d[1]]].slice(-600) : s.rastro;
	const fase = faseH(p);
	if (dentro(fase.gol, d[0], d[1])) {
		const pontos = Math.max(100, Math.round(1e3 - 100 * s.cargas.length - 20 * tj));
		return {
			...s,
			d,
			tj,
			rastro,
			status: 1,
			pontos,
			msg: `GOL! ${s.cargas.length} carga(s), ${fmt$5(tj, 3)} s`
		};
	}
	if (fase.obst.some((o) => dentro(o, d[0], d[1], DISCO.raio))) return {
		...s,
		d,
		tj,
		rastro,
		status: 2,
		msg: "O disco bateu num obstáculo."
	};
	if (d[0] < 0 || d[0] > CAMPO.w || d[1] < 0 || d[1] > CAMPO.h) return {
		...s,
		d,
		tj,
		rastro,
		status: 2,
		msg: "O disco saiu do campo."
	};
	if (tj > 30) return {
		...s,
		d,
		tj,
		rastro,
		status: 2,
		msg: "Tempo esgotado (30 s)."
	};
	return {
		...s,
		d,
		tj,
		rastro
	};
}
function passoLunar(s, p, dt) {
	if (s.status !== 0) return s;
	const g = gPlaneta(p);
	const nivel = nivelL(p);
	let T = 0;
	let angAlvo = s.L.ang;
	if (autopiloto(p)) {
		const c = piloto(s.L, nivel, g, Tmax(p));
		T = c.T;
		angAlvo = c.ang;
	} else if (s.motor) {
		T = num(p, "acelerador", 100) / 100 * Tmax(p);
		angAlvo = clamp((s.mira - s.L.x) / 80, -.6, .6);
	}
	const ang = s.L.ang + clamp(angAlvo - s.L.ang, -1.2 * dt, 1.2 * dt);
	const L0 = {
		...s.L,
		ang
	};
	if (L0.comb <= 0) T = 0;
	const { ax, ay, dm } = derivModulo(L0, T, g);
	const L = {
		x: L0.x + L0.vx * dt + .5 * ax * dt * dt,
		y: L0.y + L0.vy * dt + .5 * ay * dt * dt,
		vx: L0.vx + ax * dt,
		vy: L0.vy + ay * dt,
		ang,
		comb: Math.max(0, L0.comb + dm * dt)
	};
	const tj = s.tj + dt;
	if (L.x < 0 || L.x > MUNDO_L.w || L.y > MUNDO_L.h + 100) return {
		...s,
		L,
		T,
		tj,
		status: 2,
		msg: "Você saiu da área de pouso."
	};
	const meia = MODULO.largura / 2;
	const solo = Math.max(terreno(L.x - meia, nivel), terreno(L.x, nivel), terreno(L.x + meia, nivel));
	if (L.y <= solo) {
		const pista = PISTAS[nivel];
		const naPista = L.x - meia >= pista.x0 && L.x + meia <= pista.x1;
		const suave = Math.abs(L.vy) <= POUSO.vy && Math.abs(L.vx) <= POUSO.vx && Math.abs(L.ang) <= POUSO.ang;
		const Lp = {
			...L,
			y: solo
		};
		if (naPista && suave) {
			const pontos = Math.round(50 + 50 * L.comb / Math.max(1, num(p, "comb", 400)) + 25 * (1 - Math.abs(L.vy) / POUSO.vy));
			return {
				...s,
				L: Lp,
				T: 0,
				tj,
				status: 1,
				pontos,
				msg: `Pouso perfeito! v = ${fmt$5(Math.abs(L.vy), 2)} m/s`
			};
		}
		const motivo = !naPista ? "fora da pista" : Math.abs(L.vy) > POUSO.vy ? `rápido demais (${fmt$5(Math.abs(L.vy), 2)} m/s)` : Math.abs(L.vx) > POUSO.vx ? "deslizando de lado" : "inclinado demais";
		return {
			...s,
			L: Lp,
			T: 0,
			tj,
			status: 2,
			msg: `Acidente: ${motivo}.`
		};
	}
	return {
		...s,
		L,
		T,
		tj
	};
}
function passoLabirinto(s, p, dt) {
	if (s.status !== 0) return s;
	const nivel = nivelM(p);
	const m = modoLab(p);
	const [cx, cy] = s.ctrl;
	let pos;
	let vel;
	let acel;
	if (m === 2) {
		acel = [AMAX * cx, AMAX * cy];
		vel = [s.vel[0] + acel[0] * dt, s.vel[1] + acel[1] * dt];
		pos = [s.pos[0] + s.vel[0] * dt + .5 * acel[0] * dt * dt, s.pos[1] + s.vel[1] * dt + .5 * acel[1] * dt * dt];
	} else {
		if (m === 1) vel = [VMAX * cx, VMAX * cy];
		else {
			const alvo = [5 + 5 * cx, 5 + 5 * cy];
			const dx = alvo[0] - s.pos[0], dy = alvo[1] - s.pos[1];
			const dist = Math.hypot(dx, dy);
			const v = Math.min(dist / dt, 8);
			vel = dist > 1e-9 ? [dx / dist * v, dy / dist * v] : [0, 0];
		}
		pos = [s.pos[0] + vel[0] * dt, s.pos[1] + vel[1] * dt];
		acel = [(vel[0] - s.vel[0]) / dt, (vel[1] - s.vel[1]) / dt];
	}
	const tj = s.tj + dt;
	let hist = s.hist;
	if (!hist.length || tj - hist[hist.length - 1][0] >= .05) hist = [...hist, [
		tj,
		pos[0],
		pos[1],
		vel[0],
		vel[1],
		acel[0],
		acel[1]
	]].slice(-200);
	if (bateu(nivel, pos[0], pos[1])) {
		const [sx, sy] = achar(nivel, "S");
		return {
			...s,
			pos: [sx, sy],
			vel: [0, 0],
			acel: [0, 0],
			ctrl: m === 0 ? [(sx - 5) / 5, (sy - 5) / 5] : [0, 0],
			colisoes: s.colisoes + 1,
			tj,
			hist,
			msg: "Bateu na parede! De volta ao início."
		};
	}
	if (celula(nivel, pos[0], pos[1]) === "G") {
		const pontos = Math.max(50, Math.round(1e3 - 25 * tj - 100 * s.colisoes));
		return {
			...s,
			pos,
			vel,
			acel,
			tj,
			hist,
			status: 1,
			pontos,
			msg: `Chegou! ${fmt$5(tj, 3)} s, ${s.colisoes} batida(s)`
		};
	}
	return {
		...s,
		pos,
		vel,
		acel,
		tj,
		hist
	};
}
function step$2(s, p, _t, dt) {
	const j = jogo(p);
	if (j === 0) return passoHoquei(s, p, dt);
	if (j === 1) return passoLunar(s, p, dt);
	return passoLabirinto(s, p, dt);
}
function placar(d, s, x, y, size = 13) {
	const cor = s.status === 1 ? d.theme.series[2] ?? d.theme.accent : s.status === 2 ? d.theme.positive : d.theme.text;
	if (s.msg) d.text(s.msg, x, y, {
		size,
		weight: "700",
		color: cor
	});
	if (s.status === 1) d.text(`Pontos: ${s.pontos}`, x, y - size * 1.5 * d.px, {
		size,
		weight: "700",
		color: cor
	});
}
function renderHoquei(d, s, p) {
	const { theme } = d;
	const fase = faseH(p);
	d.rect(0, 0, CAMPO.w, CAMPO.h, {
		fill: theme.dark ? "#1d2633" : "#f4f8fc",
		stroke: theme.text,
		width: 2
	});
	if (Math.round(num(p, "campo")) === 1) for (let x = .05; x < CAMPO.w; x += .1) for (let y = .05; y < CAMPO.h; y += .1) {
		const [fx, fy] = forcaEletrica(s.cargas, Math.sign(Qdisco(p)) || 1, x, y);
		const F = Math.hypot(fx, fy);
		if (F > 0) d.arrowPx(x, y, fx, fy, 14, {
			color: theme.muted,
			width: 1,
			head: 5,
			alpha: clamp(.25 + .15 * Math.log10(F * 0xe8d4a51000 + 1), .25, .9)
		});
	}
	d.rect(fase.gol.x0, fase.gol.y0, fase.gol.x1 - fase.gol.x0, fase.gol.y1 - fase.gol.y0, {
		fill: theme.series[2] ?? theme.accent,
		alpha: .45,
		stroke: theme.series[2] ?? theme.accent,
		width: 2
	});
	d.text("GOL", (fase.gol.x0 + fase.gol.x1) / 2, (fase.gol.y0 + fase.gol.y1) / 2, {
		size: 11,
		weight: "700"
	});
	for (const o of fase.obst) d.rect(o.x0, o.y0, o.x1 - o.x0, o.y1 - o.y0, {
		fill: theme.muted,
		alpha: .8
	});
	if (s.rastro.length > 1) d.polyline(s.rastro, {
		color: theme.accent,
		width: 1.5,
		alpha: .7
	});
	for (const c of s.cargas) {
		d.circle(c.x, c.y, .025, {
			fill: c.q > 0 ? theme.positive : theme.negative,
			stroke: theme.text,
			width: 1
		});
		d.text(c.q > 0 ? "+" : "−", c.x, c.y, {
			size: 14,
			weight: "700",
			color: "#fff"
		});
	}
	const [x, y] = s.d;
	const Q = Qdisco(p);
	d.circle(x, y, DISCO.raio, { fill: theme.dark ? "#e6ebf2" : "#1c2430" });
	d.text(Q > 0 ? "+" : "−", x, y, {
		size: 12,
		weight: "700",
		color: theme.dark ? "#1c2430" : "#fff"
	});
	const [fx, fy] = forcaEletrica(s.cargas, Q, x, y);
	d.arrowPx(x, y, fx, fy, clamp(Math.hypot(fx, fy) * 2e4, 0, 90), {
		color: theme.positive,
		width: 2.5
	});
	d.text("Arraste cargas das caixas para o campo; devolva-as para remover.", 0, -.06, {
		align: "left",
		size: 11,
		color: theme.muted
	});
	for (const [bx, sinal] of [[.25, 1], [.55, -1]]) {
		d.rect(bx - .09, -.24, .18, .12, {
			stroke: theme.text,
			width: 1.5
		});
		d.circle(bx, -.18, .025, { fill: sinal > 0 ? theme.positive : theme.negative });
		d.text(sinal > 0 ? "+" : "−", bx, -.18, {
			size: 14,
			weight: "700",
			color: "#fff"
		});
	}
	d.text(`Fase ${nivelDe(p) + 1} · cargas: ${s.cargas.length} · t = ${fmt$5(s.tj, 3)} s`, 1.6, -.12, {
		align: "right",
		size: 12
	});
	d.text(s.lancado ? "" : "Posicione as cargas e use o botão “Lançar disco”.", 1.6, -.2, {
		align: "right",
		size: 11,
		color: theme.accent
	});
	placar(d, s, .8, .9);
}
function renderLunar(d, s, p) {
	const { theme } = d;
	const nivel = nivelL(p);
	const pts = [[0, -30]];
	for (let x = 0; x <= MUNDO_L.w; x += 2) pts.push([x, terreno(x, nivel)]);
	pts.push([MUNDO_L.w, -30]);
	d.polyline(pts, {
		close: true,
		fill: theme.dark ? "#3b3f47" : "#c9c4ba",
		color: theme.text,
		width: 1
	});
	const pista = PISTAS[nivel];
	const yp = terreno((pista.x0 + pista.x1) / 2, nivel);
	d.line(pista.x0, yp, pista.x1, yp, {
		color: theme.series[2] ?? theme.accent,
		width: 5
	});
	for (const xf of [pista.x0, pista.x1]) {
		d.line(xf, yp, xf, yp + 12, { color: theme.text });
		d.polyline([
			[xf, yp + 12],
			[xf + 6, yp + 10],
			[xf, yp + 8]
		], {
			close: true,
			fill: theme.positive,
			color: "none"
		});
	}
	const L = s.L;
	const h = MODULO.altura, w = MODULO.largura;
	const c = Math.cos(L.ang), sn = Math.sin(L.ang);
	const P = (u, v) => [L.x + u * c + v * sn, L.y - u * sn + v * c];
	d.polyline([
		P(-w / 2, 0),
		P(-w / 3, 3),
		P(w / 3, 3),
		P(w / 2, 0)
	], { width: 2 });
	d.polyline([
		P(-w / 3, 3),
		P(-w / 3, h * .75),
		P(0, h),
		P(w / 3, h * .75),
		P(w / 3, 3)
	], {
		close: true,
		fill: theme.dark ? "#b9c2cc" : "#8a95a3",
		color: theme.text,
		width: 1.5
	});
	if (s.T > 0 && s.status === 0) {
		const fl = 4 + 14 * (s.T / Tmax(p));
		d.polyline([
			P(-1.6, 3),
			P(0, 3 - fl),
			P(1.6, 3)
		], {
			close: true,
			fill: "#ff9a2e",
			color: "#ff5a1a",
			width: 1,
			alpha: .9
		});
	}
	d.arrowPx(L.x, L.y + h / 2, L.vx, L.vy, clamp(Math.hypot(L.vx, L.vy) * 5, 0, 100), {
		color: theme.accent,
		width: 2
	});
	const g = gPlaneta(p);
	const m = MODULO.mSeca + L.comb;
	const solo = terreno(L.x, nivel);
	const aT = Tmax(p) / m;
	[
		`Altitude: ${fmt$5(L.y - solo, 4)} m`,
		`v vertical: ${fmt$5(L.vy, 3)} m/s   v horizontal: ${fmt$5(L.vx, 3)} m/s`,
		`Combustível: ${fmt$5(L.comb, 3)} kg   massa: ${fmt$5(m, 4)} kg`,
		`Empuxo: ${fmt$5(s.T / 1e3, 3)} kN   T_máx/(m g) = ${fmt$5(aT / g, 3)}`,
		`Frenagem a empuxo máximo: ${Number.isFinite(distFrenagem(L.vy, aT, g)) ? fmt$5(distFrenagem(L.vy, aT, g), 3) + " m" : "impossível (T < mg)"}`
	].forEach((l, i) => d.text(l, 5, 250 - 11 * i, {
		align: "left",
		size: 12,
		color: i === 3 && aT < g ? theme.positive : theme.text
	}));
	d.rect(MUNDO_L.w - 60, 205, 50, 8, {
		stroke: theme.text,
		width: 1
	});
	d.rect(MUNDO_L.w - 60, 205, 50 * L.comb / Math.max(1, num(p, "comb", 400)), 8, { fill: theme.series[1] ?? theme.accent });
	d.text("combustível", MUNDO_L.w - 35, 218, {
		size: 10,
		color: theme.muted
	});
	d.text(autopiloto(p) ? "Piloto automático ligado" : "Segure o botão do mouse para ligar o motor; o módulo inclina para o lado do ponteiro.", 200, -18, {
		size: 11,
		color: theme.muted
	});
	placar(d, s, 260, 160, 15);
}
function grafico(d, s, i, y0, nome, unidade) {
	const { theme } = d;
	const x0 = 10.9, x1 = 15.9, H = 1.2;
	d.rect(x0, y0, 5, H, {
		stroke: theme.grid,
		width: 1
	});
	d.line(x0, y0 + H / 2, x1, y0 + H / 2, { color: theme.grid });
	d.text(`${nome} (${unidade})`, 10.950000000000001, y0 + H + .18, {
		align: "left",
		size: 10,
		weight: "600"
	});
	if (s.hist.length < 2) return;
	const t1 = s.hist[s.hist.length - 1][0];
	const vals = s.hist.flatMap((h) => [h[i], h[i + 1]]);
	const esc = Math.max(1e-6, ...vals.map(Math.abs));
	for (const [k, cor] of [[0, theme.series[0] ?? theme.accent], [1, theme.series[1] ?? theme.accent]]) {
		const pts = s.hist.map((h) => [x0 + (h[0] - (t1 - 10)) / 10 * 5, y0 + H / 2 + h[i + k] / esc * H / 2]).filter((q) => q[0] >= x0);
		d.polyline(pts, {
			color: cor,
			width: 1.5
		});
	}
	d.text(`±${fmt$5(esc, 2)}`, x1, y0 + H + .18, {
		align: "right",
		size: 9,
		color: theme.muted
	});
}
function renderLabirinto(d, s, p) {
	const { theme } = d;
	LABIRINTOS[nivelM(p)].forEach((row, l) => [...row].forEach((ch, c) => {
		const y = 9 - l;
		if (ch === "#") d.rect(c, y, 1, 1, {
			fill: theme.muted,
			alpha: .85
		});
		if (ch === "G") d.rect(c, y, 1, 1, {
			fill: theme.series[2] ?? theme.accent,
			alpha: .5
		});
		if (ch === "S") d.rect(c, y, 1, 1, {
			fill: theme.accent,
			alpha: .15
		});
	}));
	const [x, y] = s.pos;
	d.circle(x, y, RAIO_PART, {
		fill: theme.series[1] ?? theme.accent,
		stroke: theme.text,
		width: 1
	});
	d.arrowPx(x, y, s.vel[0], s.vel[1], clamp(Math.hypot(...s.vel) * 18, 0, 70), {
		color: theme.series[0] ?? theme.accent,
		width: 2.5
	});
	d.arrowPx(x, y, s.acel[0], s.acel[1], clamp(Math.hypot(...s.acel) * 12, 0, 70), {
		color: theme.positive,
		width: 2
	});
	const m = modoLab(p);
	const nome = [
		"POSIÇÃO",
		"VELOCIDADE",
		"ACELERAÇÃO"
	][m];
	d.rect(PAD.cx - PAD.r, PAD.cy - PAD.r, 2 * PAD.r, 2 * PAD.r, {
		stroke: theme.text,
		width: 1.5,
		fill: theme.dark ? "#1d2633" : "#f4f8fc"
	});
	d.line(PAD.cx - PAD.r, PAD.cy, PAD.cx + PAD.r, PAD.cy, { color: theme.grid });
	d.line(PAD.cx, PAD.cy - PAD.r, PAD.cx, PAD.cy + PAD.r, { color: theme.grid });
	const cor = m === 0 ? theme.series[1] ?? theme.accent : m === 1 ? theme.series[0] ?? theme.accent : theme.positive;
	if (m === 0) d.dot(PAD.cx + s.ctrl[0] * PAD.r, PAD.cy + s.ctrl[1] * PAD.r, 6, cor);
	else d.arrow(PAD.cx, PAD.cy, s.ctrl[0] * PAD.r, s.ctrl[1] * PAD.r, {
		color: cor,
		width: 3
	});
	d.text(`Você controla a ${nome}`, PAD.cx, PAD.cy + PAD.r + .3, {
		size: 12,
		weight: "700",
		color: cor
	});
	grafico(d, s, 1, 3.6, "posição x, y", "m");
	grafico(d, s, 3, 1.9, "velocidade vx, vy", "m/s");
	grafico(d, s, 5, .2, "aceleração ax, ay", "m/s²");
	d.text(`t = ${fmt$5(s.tj, 3)} s   batidas: ${s.colisoes}`, 5, -.08, {
		size: 11,
		color: theme.muted
	});
	placar(d, s, 5, 5, 14);
}
function cargaEm(s, pt) {
	return s.cargas.findIndex((c) => Math.hypot(c.x - pt.x, c.y - pt.y) < .04);
}
function controlePad(s, pt) {
	if (Math.abs(pt.x - PAD.cx) > PAD.r * 1.15 || Math.abs(pt.y - PAD.cy) > PAD.r * 1.15) return void 0;
	return {
		...s,
		ctrl: [clamp((pt.x - PAD.cx) / PAD.r, -1, 1), clamp((pt.y - PAD.cy) / PAD.r, -1, 1)]
	};
}
var reiniciarDisco = (s) => ({
	...s,
	d: [
		DISCO.x0,
		DISCO.y0,
		0,
		0
	],
	status: 0,
	msg: "",
	tj: 0,
	rastro: [],
	lancado: false
});
var jogosFisica = defineSim({
	id: "jogos-fisica",
	title: "Jogos de física: hóquei elétrico, módulo lunar e labirinto",
	course: "FG I",
	topic: "Jogos",
	priority: "P2",
	summary: "Três jogos com física de verdade e pontuação: posicione cargas para levar o disco ao gol (lei de Coulomb), pouse o módulo na Lua, em Marte ou na Terra controlando empuxo e combustível, e atravesse o labirinto controlando a posição, a velocidade ou a aceleração, com os três gráficos ao vivo.",
	equations: [
		String.raw`\vec F = \sum_i \frac{k\,q_i Q}{r_i^2}\,\hat r_i \qquad \vec a = \vec F/m`,
		String.raw`m\vec a = \vec T + m\vec g \qquad \dot m = -\frac{T}{v_e} \qquad d_\text{frenagem} = \frac{v^2}{2(T/m - g)}`,
		String.raw`\vec v = \frac{d\vec r}{dt} \qquad \vec a = \frac{d\vec v}{dt}`
	],
	liveEquations(s, p) {
		const j = jogo(p);
		if (j === 0) {
			const [fx, fy] = forcaEletrica(s.cargas, Qdisco(p), s.d[0], s.d[1]);
			return [String.raw`|\vec F| = ${texNum(Math.hypot(fx, fy) * 1e3)}\ \text{mN} \qquad |\vec a| = ${texNum(Math.hypot(fx, fy) / DISCO.m)}\ \text{m/s}^2 \qquad |\vec v| = ${texNum(Math.hypot(s.d[2], s.d[3]))}\ \text{m/s}`];
		}
		if (j === 1) {
			const m = MODULO.mSeca + s.L.comb;
			return [String.raw`a_y = \frac{T\cos\theta}{m} - g = \frac{${texNum(s.T)}\cos\theta}{${texNum(m, 4)}} - ${texNum(gPlaneta(p))} = ${texNum(derivModulo(s.L, s.T, gPlaneta(p)).ay)}\ \text{m/s}^2`];
		}
		return [String.raw`\vec r = (${texNum(s.pos[0])}; ${texNum(s.pos[1])})\ \text{m} \quad \vec v = (${texNum(s.vel[0])}; ${texNum(s.vel[1])})\ \text{m/s} \quad \vec a = (${texNum(s.acel[0])}; ${texNum(s.acel[1])})\ \text{m/s}^2`];
	},
	params: [
		{
			key: "jogo",
			label: "Jogo",
			unit: "",
			min: 0,
			max: 2,
			step: 1,
			default: 0,
			options: [
				{
					value: 0,
					label: "Hóquei elétrico"
				},
				{
					value: 1,
					label: "Módulo lunar"
				},
				{
					value: 2,
					label: "Labirinto (r, v ou a)"
				}
			]
		},
		{
			key: "nivel",
			label: "Fase",
			unit: "",
			min: 0,
			max: 3,
			step: 1,
			default: 0,
			options: [
				0,
				1,
				2,
				3
			].map((i) => ({
				value: i,
				label: `Fase ${i + 1}`
			}))
		},
		{
			key: "qPeca",
			label: "Hóquei: carga de cada peça",
			unit: "nC",
			min: 10,
			max: 100,
			step: 5,
			default: 50,
			live: true
		},
		{
			key: "Qdisco",
			label: "Hóquei: carga do disco",
			unit: "nC",
			min: -20,
			max: 20,
			step: 40,
			default: 20,
			options: [{
				value: 20,
				label: "+20 nC"
			}, {
				value: -20,
				label: "−20 nC"
			}]
		},
		{
			key: "campo",
			label: "Hóquei: mostrar o campo",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			live: true,
			options: [{
				value: 0,
				label: "Não"
			}, {
				value: 1,
				label: "Sim"
			}]
		},
		{
			key: "exemplo",
			label: "Hóquei: começar com",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Campo vazio"
			}, {
				value: 1,
				label: "Uma carga empurrando (fase 1)"
			}]
		},
		{
			key: "g",
			label: "Módulo: gravidade",
			unit: "m/s²",
			min: 1.62,
			max: 9.81,
			step: .01,
			default: 1.62,
			options: PLANETAS
		},
		{
			key: "Tmax",
			label: "Módulo: empuxo máximo",
			unit: "kN",
			min: 2,
			max: 30,
			step: .5,
			default: 5
		},
		{
			key: "acelerador",
			label: "Módulo: acelerador",
			unit: "%",
			min: 0,
			max: 100,
			step: 5,
			default: 100,
			live: true
		},
		{
			key: "comb",
			label: "Módulo: combustível inicial",
			unit: "kg",
			min: 50,
			max: 800,
			step: 10,
			default: 400
		},
		{
			key: "x0",
			label: "Módulo: posição inicial",
			unit: "m",
			min: 20,
			max: 380,
			step: 5,
			default: 60
		},
		{
			key: "vx0",
			label: "Módulo: velocidade horizontal inicial",
			unit: "m/s",
			min: -10,
			max: 10,
			step: .5,
			default: 6
		},
		{
			key: "piloto",
			label: "Módulo: pilotagem",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			live: true,
			options: [{
				value: 0,
				label: "Você"
			}, {
				value: 1,
				label: "Piloto automático"
			}]
		},
		{
			key: "controle",
			label: "Labirinto: você controla",
			unit: "",
			min: 0,
			max: 2,
			step: 1,
			default: 1,
			options: [
				{
					value: 0,
					label: "Posição"
				},
				{
					value: 1,
					label: "Velocidade"
				},
				{
					value: 2,
					label: "Aceleração"
				}
			]
		}
	],
	observables: [
		{
			key: "x",
			label: "Posição x",
			unit: "m",
			value: (s, p) => [
				s.d[0],
				s.L.x,
				s.pos[0]
			][jogo(p)] ?? 0
		},
		{
			key: "y",
			label: "Posição y (altura do módulo)",
			unit: "m",
			value: (s, p) => [
				s.d[1],
				s.L.y,
				s.pos[1]
			][jogo(p)] ?? 0
		},
		{
			key: "vx",
			label: "Velocidade vx",
			unit: "m/s",
			value: (s, p) => [
				s.d[2],
				s.L.vx,
				s.vel[0]
			][jogo(p)] ?? 0
		},
		{
			key: "vy",
			label: "Velocidade vy",
			unit: "m/s",
			value: (s, p) => [
				s.d[3],
				s.L.vy,
				s.vel[1]
			][jogo(p)] ?? 0
		},
		{
			key: "a",
			label: "Módulo da aceleração",
			unit: "m/s²",
			value: (s, p) => {
				const j = jogo(p);
				if (j === 0) return Math.hypot(...forcaEletrica(s.cargas, Qdisco(p), s.d[0], s.d[1])) / DISCO.m;
				if (j === 1) {
					const a = derivModulo(s.L, s.T, gPlaneta(p));
					return Math.hypot(a.ax, a.ay);
				}
				return Math.hypot(...s.acel);
			}
		},
		{
			key: "ax",
			label: "Aceleração ax (labirinto)",
			unit: "m/s²",
			value: (s) => s.acel[0]
		},
		{
			key: "ay",
			label: "Aceleração ay (labirinto)",
			unit: "m/s²",
			value: (s) => s.acel[1]
		},
		{
			key: "alt",
			label: "Altitude do módulo",
			unit: "m",
			value: (s, p) => s.L.y - terreno(s.L.x, nivelL(p))
		},
		{
			key: "comb",
			label: "Combustível",
			unit: "kg",
			value: (s) => s.L.comb
		},
		{
			key: "T",
			label: "Empuxo",
			unit: "N",
			value: (s) => s.T
		},
		{
			key: "E",
			label: "Energia do disco (cinética + potencial elétrica)",
			unit: "J",
			value: (s, p) => .5 * DISCO.m * (s.d[2] ** 2 + s.d[3] ** 2) + potencial(s.cargas, Qdisco(p), s.d[0], s.d[1])
		},
		{
			key: "pontos",
			label: "Pontos",
			unit: "",
			value: (s) => s.pontos
		}
	],
	conserved: "E",
	chart: {
		x: "t",
		y: "vy"
	},
	scenarios: [
		{
			id: "hoquei",
			label: "Hóquei elétrico: fase 1",
			params: {
				jogo: 0,
				nivel: 0,
				Qdisco: 20,
				campo: 1
			},
			guide: `### Leve o disco ao gol
1. O disco tem carga **positiva**. Arraste uma carga das caixas para o campo e clique em **Lançar disco**.
2. A força em cada instante é a soma vetorial das forças de Coulomb $kq_iQ/r_i^2$; a seta vermelha no disco mostra essa força.
3. Menos cargas e menos tempo dão mais pontos. Desafio: faça o gol com uma só carga.
4. Ligue "mostrar o campo" e repare que o disco **não** segue as linhas de campo: a força muda a velocidade, não a direção do movimento diretamente.`,
			predict: [{
				question: "O disco (+) está parado à esquerda e o gol à direita. Uma única carga funciona se for:",
				options: [
					"positiva, à esquerda do disco",
					"positiva, à direita do disco",
					"negativa, à esquerda do disco"
				],
				answer: 0,
				explanation: "Cargas de mesmo sinal se repelem: uma carga + atrás do disco o empurra para a direita. Uma carga − à direita também o atrairia, mas o disco passaria por ela."
			}]
		},
		{
			id: "hoquei-4",
			label: "Hóquei elétrico: gol cercado",
			params: {
				jogo: 0,
				nivel: 3,
				Qdisco: 20,
				campo: 1
			},
			guide: `### Entrando pela abertura
O gol está cercado por paredes, com abertura só por cima. Combine cargas para fazer o disco subir, contornar e descer. Use o rastro para ajustar: a trajetória depende das posições e da **velocidade** acumulada.`
		},
		{
			id: "lua",
			label: "Pouso na Lua",
			params: {
				jogo: 1,
				nivel: 0,
				g: 1.62,
				Tmax: 5,
				comb: 400,
				piloto: 0
			},
			guide: `### Pouso suave
1. Segure o botão do mouse sobre o palco para ligar o motor; mova o ponteiro para o lado para inclinar o módulo.
2. Pouse na pista com $|v_y| < 2$ m/s, $|v_x| < 1$ m/s e o módulo quase em pé.
3. Use o painel: a **distância de frenagem** $v^2/2(T/m - g)$ diz a partir de que altitude você precisa ligar o motor.
4. Repare que o módulo fica mais leve à medida que queima combustível: o mesmo empuxo dá mais aceleração.`,
			predict: [{
				question: "Com empuxo máximo de 5 kN e massa de 1400 kg, o módulo consegue pairar (ficar parado no ar) na Terra?",
				options: [
					"sim, sobra empuxo",
					"não: T < mg na Terra",
					"só com metade do combustível"
				],
				answer: 1,
				explanation: "Na Terra $mg = 1400 \\times 9{,}81 \\approx 13{,}7$ kN > 5 kN: o módulo cai mesmo com o motor no máximo. Na Lua $mg \\approx 2{,}3$ kN e sobra empuxo."
			}]
		},
		{
			id: "terra-auto",
			label: "Piloto automático na Terra",
			params: {
				jogo: 1,
				nivel: 0,
				g: 9.81,
				Tmax: 25,
				comb: 800,
				piloto: 1,
				x0: 120,
				vx0: 0
			},
			guide: `### Controle por realimentação
O piloto automático mede altitude e velocidade e ajusta o empuxo para seguir uma velocidade de descida que diminui perto do chão. Plote $v_y(t)$ e o empuxo $T(t)$ e compare com o consumo de combustível na Lua.`
		},
		{
			id: "labirinto-v",
			label: "Labirinto controlando a velocidade",
			params: {
				jogo: 2,
				nivel: 0,
				controle: 1
			},
			guide: `### r, v e a
1. Arraste no quadrado de controle: a seta é a **velocidade** da partícula. Leve-a até o quadrado verde sem bater.
2. Observe os três gráficos: quando a velocidade é constante, a posição é uma reta e a aceleração é zero; mudar a seta de repente gera picos de aceleração.
3. Troque para **aceleração**: agora o controle muda a velocidade aos poucos e é preciso frear antes das curvas!`,
			predict: [{
				question: "Controlando a aceleração, para parar a partícula numa curva você deve:",
				options: [
					"soltar o controle (a = 0)",
					"apontar a aceleração contra a velocidade antes da curva",
					"apontar a aceleração para a curva"
				],
				answer: 1,
				explanation: "Com $a = 0$ a velocidade se mantém (1ª lei de Newton). Para reduzir $v$ é preciso $\\vec a$ oposta a $\\vec v$ durante um tempo $\\Delta t = v/a$."
			}]
		},
		{
			id: "labirinto-a",
			label: "Labirinto controlando a aceleração",
			params: {
				jogo: 2,
				nivel: 1,
				controle: 2
			},
			guide: `### Desafio: só aceleração
Atravesse o labirinto de corredores controlando apenas $\\vec a$. Use os gráficos: a área sob $a(t)$ é a variação de velocidade; a área sob $v(t)$ é o deslocamento.`
		}
	],
	exercises: [
		{
			id: "coulomb",
			prompt: "No hóquei elétrico, o disco tem carga de 20 nC e uma peça de {q} nC está a {r} cm dele. Qual a intensidade da força elétrica no disco? (k = 8,99 × 10^9 N·m²/C²)",
			vary: {
				q: [
					10,
					100,
					0
				],
				r: [
					5,
					30,
					0
				]
			},
			fixed: { jogo: 0 },
			answer: {
				label: "F",
				unit: "mN",
				compute: (p) => 89875e5 * num(p, "q") * 2e-17 / (num(p, "r") / 100) ** 2 * 1e3
			}
		},
		{
			id: "pairar",
			prompt: "Que empuxo é preciso para um módulo de {m} kg pairar parado em Marte (g = 3,71 m/s²)?",
			vary: { m: [
				800,
				2e3,
				0
			] },
			fixed: {
				jogo: 1,
				g: 3.71
			},
			answer: {
				label: "T",
				unit: "N",
				compute: (p) => num(p, "m") * 3.71
			}
		},
		{
			id: "frenagem",
			prompt: "Um módulo desce na Lua (g = 1,62 m/s²) a {v} m/s e seu empuxo máximo dá T/m = {aT} m/s². A que altura mínima ele deve ligar o motor no máximo para chegar ao solo com velocidade zero?",
			vary: {
				v: [
					5,
					30,
					0
				],
				aT: [
					3,
					6,
					1
				]
			},
			fixed: {
				jogo: 1,
				g: 1.62
			},
			answer: {
				label: "h",
				unit: "m",
				compute: (p) => distFrenagem(num(p, "v"), num(p, "aT"), 1.62)
			}
		}
	],
	init: init$2,
	step: step$2,
	dt: .004,
	sampleEvery: 10,
	maxSamples: 5e3,
	pointer: {
		down(s, p, pt) {
			const j = jogo(p);
			if (j === 0) {
				const i = cargaEm(s, pt);
				if (i >= 0) return {
					...s,
					arr: i
				};
				for (const [bx, sinal] of [[.25, 1], [.55, -1]]) if (Math.abs(pt.x - bx) < .09 && pt.y < -.1 && pt.y > -.26) return {
					...s,
					cargas: [...s.cargas, {
						x: pt.x,
						y: pt.y,
						q: sinal * num(p, "qPeca", 50)
					}],
					arr: s.cargas.length
				};
				return;
			}
			if (j === 1) return autopiloto(p) ? void 0 : {
				...s,
				motor: true,
				mira: pt.x
			};
			return controlePad(s, pt);
		},
		move(s, p, pt, dragging) {
			if (!dragging) return void 0;
			const j = jogo(p);
			if (j === 0 && s.arr >= 0) return {
				...s,
				cargas: s.cargas.map((c, i) => i === s.arr ? {
					...c,
					x: clamp(pt.x, 0, CAMPO.w),
					y: clamp(pt.y, -.25, CAMPO.h)
				} : c)
			};
			if (j === 1 && s.motor) return {
				...s,
				mira: pt.x
			};
			if (j === 2) return controlePad(s, pt);
		},
		up(s, p) {
			const j = jogo(p);
			if (j === 0 && s.arr >= 0) return {
				...s,
				cargas: s.cargas.filter((c, i) => i !== s.arr || c.y >= 0),
				arr: -1
			};
			if (j === 1 && s.motor) return {
				...s,
				motor: false
			};
		},
		cursor(s, p, pt) {
			const j = jogo(p);
			if (j === 0) return cargaEm(s, pt) >= 0 || pt.y < -.1 ? "grab" : void 0;
			if (j === 1) return "crosshair";
			return Math.abs(pt.x - PAD.cx) <= PAD.r && Math.abs(pt.y - PAD.cy) <= PAD.r ? "crosshair" : void 0;
		}
	},
	actions: [
		{
			id: "lancar",
			label: "Hóquei: lançar disco",
			run: (s) => ({
				...reiniciarDisco(s),
				lancado: true
			})
		},
		{
			id: "recolocar",
			label: "Hóquei: recolocar disco",
			run: reiniciarDisco
		},
		{
			id: "limpar",
			label: "Hóquei: remover cargas",
			run: (s) => ({
				...reiniciarDisco(s),
				cargas: []
			})
		},
		{
			id: "pouso",
			label: "Módulo: nova tentativa",
			run: (s, p) => ({
				...s,
				L: moduloInicial(p),
				status: 0,
				msg: "",
				tj: 0,
				T: 0,
				motor: false
			})
		},
		{
			id: "zerar",
			label: "Labirinto: recomeçar",
			run: (s, p) => {
				const [sx, sy] = achar(nivelM(p), "S");
				return {
					...s,
					pos: [sx, sy],
					vel: [0, 0],
					acel: [0, 0],
					ctrl: modoLab(p) === 0 ? [(sx - 5) / 5, (sy - 5) / 5] : [0, 0],
					status: 0,
					msg: "",
					tj: 0,
					colisoes: 0,
					hist: []
				};
			}
		}
	],
	viewport(p) {
		const j = jogo(p);
		if (j === 0) return {
			xMin: -.04,
			xMax: 1.64,
			yMin: -.28,
			yMax: 1.04
		};
		if (j === 1) return {
			xMin: 0,
			xMax: MUNDO_L.w,
			yMin: -30,
			yMax: MUNDO_L.h
		};
		return {
			xMin: 0,
			xMax: 16,
			yMin: -.3,
			yMax: 10
		};
	},
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const j = jogo(frame.params);
		if (j === 0) renderHoquei(d, frame.state, frame.params);
		else if (j === 1) renderLunar(d, frame.state, frame.params);
		else renderLabirinto(d, frame.state, frame.params);
	}
});
//#endregion
//#region sims/lentes/src/optics.ts
/**
* Ótica paraxial da bancada: matrizes ABCD com ângulos reduzidos (n·u), de
* modo que det M = 1 em qualquer associação de elementos no ar.
*/
var I2 = [
	1,
	0,
	0,
	1
];
var mul = (m2, m1) => [
	m2[0] * m1[0] + m2[1] * m1[2],
	m2[0] * m1[1] + m2[1] * m1[3],
	m2[2] * m1[0] + m2[3] * m1[2],
	m2[2] * m1[1] + m2[3] * m1[3]
];
var transl = (L) => [
	1,
	L,
	0,
	1
];
var thin = (P) => [
	1,
	0,
	-P,
	1
];
/** Olho reduzido: lente única a 17 mm da retina (no ar), pupila de 4 mm. */
var EYE_DR = .017;
var PUPIL = .004;
/** Distância do ponto próximo de referência para aumento angular. */
var NEAR = .25;
/** Óculos ficam 12 mm à frente do olho. */
var GLASSES_GAP = .012;
var DEG$1 = Math.PI / 180;
/** Parâmetros da lente espessa (raios iguais e opostos: biconvexa simétrica). */
function thickGeom(p) {
	const R = num(p, "Rl", .06);
	return {
		R1: R,
		R2: -R,
		d: num(p, "esp", .03),
		n: num(p, "nL", 1.5)
	};
}
function thickMatrix(p) {
	const { R1, R2, d, n } = thickGeom(p);
	const P1 = (n - 1) / R1;
	return mul(thin((1 - n) / R2), mul(transl(d / n), thin(P1)));
}
var xIn = (e) => e.x;
var xOut = (e, p) => e.kind === "espessa" ? e.x + thickGeom(p).d : e.x;
var relaxedPower = (p) => 1 / EYE_DR - num(p, "rx");
function elMatrix(e, p, eyeP) {
	if (e.kind === "fina") return thin(e.P);
	if (e.kind === "oculos") return thin(num(p, "oculos"));
	if (e.kind === "espessa") return thickMatrix(p);
	return thin(eyeP);
}
var sorted = (els) => [...els].sort((a, b) => a.x - b.x);
/** Matriz do plano xa até a saída dos elementos dados (em ordem). */
function systemMatrix(els, p, xa, eyeP = 0) {
	let M = I2;
	let cur = xa;
	for (const e of els) {
		M = mul(elMatrix(e, p, eyeP), mul(transl(xIn(e) - cur), M));
		cur = xOut(e, p);
	}
	return M;
}
/** Caminho de um raio (y, u) que parte do plano xa: pontos em cada elemento e no plano final xb. */
function rayPath(els, p, xa, y0, u0, xb, eyeP = 0) {
	const pts = [[xa, y0]];
	let y = y0;
	let u = u0;
	let cur = xa;
	for (const e of els) {
		y += (xIn(e) - cur) * u;
		pts.push([xIn(e), y]);
		if (e.kind === "espessa") {
			const { R1, R2, d, n } = thickGeom(p);
			u -= (n - 1) / R1 * y;
			y += d / n * u;
			pts.push([e.x + d, y]);
			u -= (1 - n) / R2 * y;
		} else {
			const P = e.kind === "fina" ? e.P : e.kind === "oculos" ? num(p, "oculos") : eyeP;
			u -= P * y;
		}
		cur = xOut(e, p);
		if (e.kind === "olho") {
			y += EYE_DR * u;
			pts.push([cur + EYE_DR, y]);
			return pts;
		}
	}
	pts.push([xb, y + (xb - cur) * u]);
	return pts;
}
var BIG = 1e6;
function analyzeBench(s, p) {
	const els = sorted(s.els);
	const eye = els.find((e) => e.kind === "olho");
	const optics = els.filter((e) => e.kind !== "olho" && (!eye || e.x < eye.x));
	const alpha = num(p, "alfa", 1) * DEG$1;
	const xRef = s.inf ? optics[0] ? xIn(optics[0]) : eye ? eye.x : 0 : s.ox;
	const out = {
		els,
		optics,
		eye,
		eyeP: 0,
		acc: 0,
		blur: 0,
		qEye: 0,
		images: [],
		q: 0,
		m: 0,
		afocal: false,
		Mang: 0,
		feq: 0
	};
	for (let k = 0; k < optics.length; k++) {
		const M = systemMatrix(optics.slice(0, k + 1), p, xRef);
		const xo = xOut(optics[k], p);
		const [A, B, C, D] = M;
		let q;
		let h;
		let ok = true;
		if (s.inf) {
			if (Math.abs(C) < 1e-9) ok = false;
			q = -A / C;
			h = -alpha / C;
		} else {
			if (Math.abs(D) < 1e-9) ok = false;
			q = -B / D;
			h = s.oh / D;
		}
		const nextX = optics[k + 1] ? xIn(optics[k + 1]) : eye ? eye.x : Infinity;
		if (ok) out.images.push({
			x: xo + q,
			h,
			real: q > 0 && xo + q < nextX,
			k
		});
		if (k === optics.length - 1) {
			out.afocal = !ok;
			out.q = ok ? q : BIG;
			out.m = s.inf || !ok ? 0 : 1 / D;
		}
	}
	const last = eye ? eye.x : optics.length ? xOut(optics[optics.length - 1], p) : xRef;
	const ML = systemMatrix(optics, p, xRef);
	const toLast = mul(transl(last - (optics.length ? xOut(optics[optics.length - 1], p) : xRef)), ML);
	out.Mang = s.inf ? toLast[3] : Math.abs(toLast[1]) < 1e-12 ? BIG : NEAR / toLast[1];
	if (optics.length) {
		const S = systemMatrix(optics, p, xIn(optics[0]));
		out.feq = Math.abs(S[2]) < 1e-9 ? BIG : -1 / S[2];
	}
	if (eye) {
		const pre = mul(transl(eye.x - (optics.length ? xOut(optics[optics.length - 1], p) : xRef)), ML);
		const [A, B, C, D] = pre;
		const P0 = relaxedPower(p);
		const amp = Math.max(0, num(p, "acom", 4));
		const need = s.inf ? C / A + 1 / EYE_DR : D / B + 1 / EYE_DR;
		const P = Math.min(P0 + amp, Math.max(P0, need));
		out.eyeP = P;
		out.acc = P - P0;
		const tot = mul(thin(P), pre);
		if (s.inf) {
			const y0 = PUPIL / 2 / A;
			out.blur = 2 * Math.abs((tot[0] + EYE_DR * tot[2]) * y0);
			out.qEye = Math.abs(tot[2]) < 1e-12 ? BIG : -tot[0] / tot[2];
		} else {
			const u0 = PUPIL / 2 / B;
			out.blur = 2 * Math.abs((tot[1] + EYE_DR * tot[3]) * u0);
			out.qEye = Math.abs(tot[3]) < 1e-12 ? BIG : -tot[1] / tot[3];
		}
	}
	return out;
}
//#endregion
//#region sims/lentes/src/index.ts
var EYE_VP = {
	xMin: -5.3,
	xMax: .5,
	yMin: -1,
	yMax: 2
};
var PRESETS$2 = [
	{
		label: "Lente convergente",
		els: [{
			kind: "fina",
			x: 0,
			P: 10
		}],
		ox: -.25,
		oh: .03,
		inf: false,
		vp: {
			xMin: -.42,
			xMax: .5,
			yMin: -.16,
			yMax: .16
		},
		H: .07
	},
	{
		label: "Lente divergente",
		els: [{
			kind: "fina",
			x: 0,
			P: -10
		}],
		ox: -.2,
		oh: .04,
		inf: false,
		vp: {
			xMin: -.42,
			xMax: .5,
			yMin: -.16,
			yMax: .16
		},
		H: .07
	},
	{
		label: "Associação de duas lentes",
		els: [{
			kind: "fina",
			x: 0,
			P: 10
		}, {
			kind: "fina",
			x: .3,
			P: 8
		}],
		ox: -.18,
		oh: .02,
		inf: false,
		vp: {
			xMin: -.3,
			xMax: .72,
			yMin: -.18,
			yMax: .18
		},
		H: .07
	},
	{
		label: "Microscópio composto",
		els: [{
			kind: "fina",
			x: 0,
			P: 100
		}, {
			kind: "fina",
			x: .195,
			P: 40
		}],
		ox: -1 / (100 - 1 / .17),
		oh: .0015,
		inf: false,
		vp: {
			xMin: -.03,
			xMax: .27,
			yMin: -.055,
			yMax: .055
		},
		H: .02
	},
	{
		label: "Telescópio kepleriano",
		els: [{
			kind: "fina",
			x: 0,
			P: 2
		}, {
			kind: "fina",
			x: .55,
			P: 20
		}],
		ox: -.1,
		oh: .01,
		inf: true,
		vp: {
			xMin: -.15,
			xMax: .8,
			yMin: -.1,
			yMax: .1
		},
		H: .05
	},
	{
		label: "Olho",
		els: [{
			kind: "olho",
			x: 0,
			P: 0
		}],
		ox: -1.5,
		oh: .3,
		inf: false,
		vp: EYE_VP,
		H: .012
	},
	{
		label: "Olho com lente corretiva",
		els: [{
			kind: "oculos",
			x: -GLASSES_GAP,
			P: 0
		}, {
			kind: "olho",
			x: 0,
			P: 0
		}],
		ox: -4,
		oh: .4,
		inf: false,
		vp: EYE_VP,
		H: .012
	},
	{
		label: "Lente espessa",
		els: [{
			kind: "espessa",
			x: 0,
			P: 0
		}],
		ox: -.3,
		oh: .03,
		inf: false,
		vp: {
			xMin: -.42,
			xMax: .5,
			yMin: -.16,
			yMax: .16
		},
		H: .05
	}
];
var preset = (p) => PRESETS$2[Math.max(0, Math.min(PRESETS$2.length - 1, Math.round(num(p, "montagem"))))];
var isEye = (p) => preset(p).vp === EYE_VP;
/** Janela onde o olho aparece ampliado (coordenadas do palco). */
var INSET = {
	xMin: -2.95,
	xMax: .4,
	yMin: .2,
	yMax: 1.9
};
var EYE_LOCAL = {
	xMin: -.021,
	xMax: .021,
	yMin: -.013,
	yMax: .013
};
var cacheKey = "";
var cacheVal = null;
function analyze(s, p) {
	const key = JSON.stringify([
		s.els,
		s.ox,
		s.oh,
		s.inf,
		p
	]);
	if (cacheVal && key === cacheKey) return cacheVal;
	cacheKey = key;
	cacheVal = analyzeBench(s, p);
	return cacheVal;
}
var fin = (v) => Number.isFinite(v) ? v : 1e6;
var fmt$4 = (v, k = 2) => Number.isFinite(v) && Math.abs(v) < 1e5 ? v.toFixed(k).replace(".", ",") : "∞";
var cm = (v) => fmt$4(v * 100, 1);
function elLabel(e, p) {
	if (e.kind === "olho") return "olho";
	if (e.kind === "oculos") return `corretiva ${fmt$4(num(p, "oculos"), 2)} D`;
	if (e.kind === "espessa") return `espessa, f = ${cm(-1 / thickMatrix(p)[2])} cm`;
	return e.P === 0 ? "P = 0" : `f = ${cm(1 / e.P)} cm`;
}
/** Raios a desenhar: lista de (y0, u0) no plano inicial xa. */
function rayStarts(s, p, a, vp) {
	const H = preset(p).H;
	const first = a.els[0];
	const alpha = num(p, "alfa", 1) * DEG$1;
	if (!first) return {
		xa: s.inf ? vp.xMin : s.ox,
		rays: []
	};
	const x1 = xIn(first);
	if (a.eye && !s.inf) {
		const [A, B] = mul(transl(a.eye.x - (a.optics.length ? xOut(a.optics[a.optics.length - 1], p) : s.ox)), systemMatrix(a.optics, p, s.ox));
		const rays = [];
		for (const yt of [
			-PUPIL / 2,
			0,
			PUPIL / 2
		]) {
			rays.push({
				y: 0,
				u: yt / B,
				main: false
			});
			rays.push({
				y: s.oh,
				u: (yt - A * s.oh) / B,
				main: yt === 0
			});
		}
		return {
			xa: s.ox,
			rays
		};
	}
	if (s.inf) {
		const xa = vp.xMin;
		return {
			xa,
			rays: (a.eye && !a.optics.length ? [
				-PUPIL / 2,
				0,
				PUPIL / 2
			] : [
				-.6 * H,
				0,
				.6 * H
			]).map((y) => ({
				y: y - alpha * (x1 - xa),
				u: alpha,
				main: y === 0
			}))
		};
	}
	const rays = [{
		y: s.oh,
		u: 0,
		main: true
	}];
	rays.push({
		y: s.oh,
		u: -s.oh / (x1 - s.ox),
		main: true
	});
	if (first.kind === "fina" && first.P !== 0) {
		const F = x1 - 1 / first.P;
		if (Math.abs(F - s.ox) > 1e-6 && F > s.ox - 10) rays.push({
			y: s.oh,
			u: -s.oh / (F - s.ox),
			main: true
		});
	}
	for (const k of [-.6, .6]) rays.push({
		y: 0,
		u: k * H / (x1 - s.ox),
		main: false
	});
	return {
		xa: s.ox,
		rays
	};
}
var lentes = defineSim({
	id: "lentes",
	title: "Lentes e bancada ótica",
	course: "FG IV",
	topic: "Ótica geométrica",
	priority: "P1",
	summary: "Monte uma bancada ótica: arraste lentes pelo eixo, acrescente ou remova lentes e veja os raios atravessarem a associação, calculada com matrizes ABCD. Inclui microscópio, telescópio, lente espessa e um olho com miopia e lente corretiva.",
	static: true,
	equations: [
		String.raw`\frac{1}{f} = \frac{1}{p} + \frac{1}{p'} \qquad m = -\frac{p'}{p} \qquad P = \frac{1}{f}\ (\text{dioptrias, } \text{m}^{-1})`,
		String.raw`\begin{pmatrix} y' \\ u' \end{pmatrix} = \begin{pmatrix} A & B \\ C & D \end{pmatrix}\begin{pmatrix} y \\ u \end{pmatrix} \qquad T(L) = \begin{pmatrix} 1 & L \\ 0 & 1 \end{pmatrix} \quad L(f) = \begin{pmatrix} 1 & 0 \\ -1/f & 1 \end{pmatrix}`,
		String.raw`\text{imagem: } p' = -\frac{B}{D},\ m = \frac{1}{D} \qquad f_{\text{eq}} = -\frac{1}{C} \qquad M_{\text{ang}} = \frac{25\ \text{cm}}{B}`,
		String.raw`\text{microscópio: } M \approx -\frac{L}{f_{\text{ob}}}\cdot\frac{25\ \text{cm}}{f_{\text{oc}}} \qquad \text{telescópio: } M = -\frac{f_{\text{ob}}}{f_{\text{oc}}}`,
		String.raw`\text{lente espessa: } \frac{1}{f} = (n-1)\left[\frac{1}{R_1} - \frac{1}{R_2} + \frac{(n-1)\,d}{n R_1 R_2}\right] \qquad \text{miopia: } P_{\text{corr}} = -\frac{1}{PR - d_{\text{óculos}}}`
	],
	liveEquations(s, p) {
		const a = analyze(s, p);
		const out = [];
		if (a.eye) {
			const P0 = relaxedPower(p);
			const rx = num(p, "rx");
			out.push(String.raw`P_{\text{olho}} = ${texNum(a.eyeP, 4)}\ \text{D}\ \ (\text{relaxado } ${texNum(P0, 4)}\ \text{D},\ \text{acomodação } ${texNum(a.acc)}\ \text{D}) \qquad \text{borrão} = ${texNum(a.blur * 1e3)}\ \text{mm}`);
			if (rx < 0) out.push(String.raw`PR = \frac{1}{|${texNum(rx)}|} = ${texNum(-1 / rx)}\ \text{m} \qquad P_{\text{óculos}} = -\frac{1}{PR - 0{,}012} = ${texNum(-1 / (-1 / rx - GLASSES_GAP))}\ \text{D} \qquad P_{\text{contato}} = ${texNum(rx)}\ \text{D}`);
			return out;
		}
		if (a.afocal) out.push(String.raw`C = 0:\ \text{sistema afocal, imagem final no infinito}`);
		else if (s.inf) out.push(String.raw`\text{objeto no infinito: imagem a } p' = -A/C = ${texNum(a.q)}\ \text{m do último elemento}`);
		else out.push(String.raw`p' = -\frac{B}{D} = ${texNum(a.q)}\ \text{m} \qquad m = \frac{1}{D} = ${texNum(a.m)}`);
		out.push(String.raw`M_{\text{ang}} = ${texNum(a.Mang)} \qquad f_{\text{eq}} = ${Math.abs(a.feq) >= 1e5 ? "\\infty" : `${texNum(a.feq)}\\ \\text{m}`}`);
		if (a.els.some((e) => e.kind === "espessa")) {
			const S = thickMatrix(p);
			const { d } = thickGeom(p);
			out.push(String.raw`f = ${texNum(-1 / S[2])}\ \text{m} \qquad \overline{V_1H} = ${texNum((S[3] - 1) / S[2] * -1 * 100)}\ \text{cm} \qquad \overline{V_2H'} = ${texNum((1 - S[0]) / S[2] * 100)}\ \text{cm} \qquad d = ${texNum(d * 100)}\ \text{cm}`);
		}
		return out;
	},
	params: [
		{
			key: "montagem",
			label: "Montagem",
			unit: "",
			min: 0,
			max: PRESETS$2.length - 1,
			step: 1,
			default: 0,
			options: PRESETS$2.map((pr, i) => ({
				value: i,
				label: pr.label
			}))
		},
		{
			key: "alfa",
			label: "Ângulo do objeto no infinito",
			unit: "°",
			min: .1,
			max: 5,
			step: .1,
			default: 1,
			live: true
		},
		{
			key: "rx",
			label: "Erro refrativo do olho (negativo = miopia)",
			unit: "D",
			min: -6,
			max: 4,
			step: .25,
			default: 0,
			live: true
		},
		{
			key: "oculos",
			label: "Vergência da lente corretiva",
			unit: "D",
			min: -8,
			max: 6,
			step: .25,
			default: -2,
			live: true
		},
		{
			key: "acom",
			label: "Amplitude de acomodação",
			unit: "D",
			min: 0,
			max: 10,
			step: .5,
			default: 4,
			live: true
		},
		{
			key: "nL",
			label: "Índice da lente espessa",
			unit: "",
			min: 1.3,
			max: 1.9,
			step: .01,
			default: 1.5,
			live: true
		},
		{
			key: "esp",
			label: "Espessura da lente espessa",
			unit: "m",
			min: .005,
			max: .08,
			step: .005,
			default: .03,
			live: true
		},
		{
			key: "Rl",
			label: "Raio das faces da lente espessa",
			unit: "m",
			min: .04,
			max: .2,
			step: .005,
			default: .06,
			live: true
		}
	],
	observables: [
		{
			key: "ox",
			label: "Posição do objeto no banco",
			unit: "m",
			value: (s) => s.ox
		},
		{
			key: "oy",
			label: "Meia altura do objeto",
			unit: "m",
			value: (s) => s.oh / 2
		},
		{
			key: "p",
			label: "Distância objeto–primeiro elemento",
			unit: "m",
			value: (s) => s.els.length ? Math.min(...s.els.map((e) => e.x)) - s.ox : 0
		},
		{
			key: "q",
			label: "Imagem final (a partir do último elemento)",
			unit: "m",
			value: (s, p) => fin(analyze(s, p).q)
		},
		{
			key: "m",
			label: "Aumento lateral",
			unit: "",
			value: (s, p) => fin(analyze(s, p).m)
		},
		{
			key: "Mang",
			label: "Aumento angular (ref. 25 cm)",
			unit: "",
			value: (s, p) => fin(analyze(s, p).Mang)
		},
		{
			key: "feq",
			label: "Distância focal equivalente",
			unit: "m",
			value: (s, p) => fin(analyze(s, p).feq)
		},
		{
			key: "blur",
			label: "Borrão na retina",
			unit: "mm",
			value: (s, p) => analyze(s, p).blur * 1e3
		},
		{
			key: "acc",
			label: "Acomodação usada",
			unit: "D",
			value: (s, p) => analyze(s, p).acc
		}
	],
	chart: {
		x: "p",
		y: "q"
	},
	scenarios: [
		{
			id: "lente",
			label: "Uma lente convergente",
			params: { montagem: 0 },
			guide: `### Lente convergente
1. Arraste o objeto: além de $2f$ a imagem é real, invertida e menor; entre $f$ e $2f$, maior; dentro de $f$, virtual e direita (lupa).
2. Os três raios principais: paralelo (sai pelo foco), pelo centro (não desvia) e pelo foco (sai paralelo).
3. Clique na lente e use os botões para mudar $f$, inverter para divergente ou acrescentar outra lente.
4. Troque a montagem para **Lente espessa**: os planos principais $H$ e $H'$ substituem o plano único da lente fina.`,
			predict: [{
				question: "Se você cobrir a metade de cima de uma lente que projeta uma imagem real, a imagem:",
				options: [
					"perde a metade de cima",
					"perde a metade de baixo",
					"fica inteira, porém mais fraca"
				],
				answer: 2,
				explanation: "Cada ponto do objeto envia raios para toda a lente; qualquer parte dela forma a imagem inteira. Cobrir metade só reduz a luz que chega."
			}]
		},
		{
			id: "microscopio",
			label: "Microscópio composto",
			params: { montagem: 3 },
			guide: `### Objetiva + ocular
1. A objetiva ($f = 1$ cm) forma uma imagem real, invertida e muito ampliada (I₁) no foco da ocular.
2. A ocular ($f = 2{,}5$ cm) funciona como lupa: a imagem final vai ao infinito e o olho vê relaxado.
3. Compare o aumento angular com $M \\approx -\\frac{L}{f_{ob}}\\cdot\\frac{25\\ \\text{cm}}{f_{oc}} = -16 \\times 10 = -160$.
4. Arraste a ocular para perto da objetiva: a imagem final vira virtual e próxima, e o aumento muda.`
		},
		{
			id: "telescopio",
			label: "Telescópio",
			params: {
				montagem: 4,
				alfa: 1
			},
			guide: `### Telescópio kepleriano
O objeto está no infinito (uma estrela): os raios chegam paralelos com ângulo $\\alpha$.
1. A objetiva forma a imagem no seu plano focal; a ocular, com o mesmo foco, devolve raios paralelos.
2. O sistema é **afocal** ($C = 0$) e o aumento angular é $D = -f_{ob}/f_{oc} = -10$.
3. Arraste a ocular e veja o feixe de saída deixar de ser paralelo (foco para míopes ou para projetar o Sol num anteparo).`
		},
		{
			id: "miopia",
			label: "Miopia e lente corretiva",
			params: {
				montagem: 6,
				rx: -2,
				oculos: 0,
				acom: 4
			},
			guide: `### Olho míope
O olho é modelado por uma lente a 17 mm da retina, que acomoda (fica mais convergente) até a amplitude dada. O míope de $-2$ D tem o olho convergente demais: o ponto remoto fica a $PR = 0{,}5$ m.
1. Com a lente corretiva em 0 D, a imagem do objeto distante se forma **antes** da retina: veja o borrão no detalhe ampliado.
2. Aproxime o objeto até 0,5 m: fica nítido sem acomodar.
3. Ponha a lente corretiva em cerca de $-2$ D: ela forma uma imagem virtual do objeto no ponto remoto e o olho volta a focar ao longe.`,
			predict: [{
				question: "Que tipo de lente corrige a miopia?",
				options: [
					"convergente",
					"divergente",
					"cilíndrica, sempre"
				],
				answer: 1,
				explanation: "O olho míope converge demais (ou é longo demais). Uma lente divergente abre o feixe e leva a imagem de objetos distantes para o ponto remoto, de onde o olho consegue focar na retina."
			}]
		}
	],
	exercises: [
		{
			id: "duas",
			prompt: "Duas lentes delgadas convergentes, de distâncias focais {f1} m e {f2} m, estão separadas por {dd} m. Um objeto está a {p0} m da primeira. A que distância da segunda lente se forma a imagem final? (positivo se for real, do outro lado)",
			vary: {
				f1: [
					.05,
					.15,
					2
				],
				f2: [
					.05,
					.2,
					2
				],
				dd: [
					.7,
					1,
					2
				],
				p0: [
					.2,
					.5,
					2
				]
			},
			fixed: { montagem: 2 },
			answer: {
				label: "p'₂",
				unit: "m",
				compute: (p) => {
					const q1 = 1 / (1 / num(p, "f1") - 1 / num(p, "p0"));
					const p2 = num(p, "dd") - q1;
					return 1 / (1 / num(p, "f2") - 1 / p2);
				}
			},
			hint: "A imagem da primeira lente é o objeto da segunda: p₂ = d − p'₁."
		},
		{
			id: "miopia",
			prompt: "O ponto remoto de uma pessoa míope está a {pr} m dos olhos. Qual é a vergência da lente de contato que corrige a visão de longe?",
			vary: { pr: [
				.2,
				2,
				2
			] },
			fixed: { montagem: 6 },
			answer: {
				label: "P",
				unit: "D",
				compute: (p) => -1 / num(p, "pr")
			},
			hint: "A lente deve formar, de um objeto no infinito, uma imagem virtual no ponto remoto: f = −PR."
		},
		{
			id: "telescopio",
			prompt: "Um telescópio kepleriano tem objetiva de {fob} m e ocular de {foc} m de distância focal. Qual é o módulo do aumento angular?",
			vary: {
				fob: [
					.4,
					1.5,
					2
				],
				foc: [
					.01,
					.05,
					3
				]
			},
			fixed: { montagem: 4 },
			answer: {
				label: "|M|",
				unit: "",
				compute: (p) => num(p, "fob") / num(p, "foc")
			}
		}
	],
	init(p) {
		const pr = preset(p);
		return {
			els: pr.els.map((e, i) => ({
				...e,
				id: i + 1
			})),
			ox: pr.ox,
			oh: pr.oh,
			inf: pr.inf,
			sel: null,
			drag: null,
			nextId: pr.els.length + 1
		};
	},
	step: (s) => s,
	sampleEvery: 1e3,
	maxSamples: 400,
	viewport: (p) => ({
		...preset(p).vp,
		unit: "m"
	}),
	pointer: {
		down(s, p, pt) {
			const vp = preset(p).vp;
			const tol = .015 * (vp.xMax - vp.xMin);
			const H = preset(p).H;
			if (!s.inf && Math.abs(pt.x - s.ox) < tol && pt.y > Math.min(0, s.oh) - tol && pt.y < Math.max(0, s.oh) + tol) return {
				...s,
				drag: "obj"
			};
			const hitH = isEye(p) ? .15 : H * 1.1;
			let best = null;
			for (const e of s.els) {
				const xc = e.kind === "espessa" ? e.x + thickGeom(p).d / 2 : e.x;
				if (Math.abs(pt.x - xc) < tol && Math.abs(pt.y) < hitH && (!best || Math.abs(pt.x - xc) < Math.abs(pt.x - best.x))) best = e;
			}
			if (best) return {
				...s,
				sel: best.id,
				drag: best.kind === "olho" ? null : best.id
			};
			return s.sel === null ? void 0 : {
				...s,
				sel: null
			};
		},
		move(s, p, pt, dragging) {
			if (!dragging || s.drag === null) return void 0;
			const vp = preset(p).vp;
			const w = vp.xMax - vp.xMin;
			const firstX = s.els.length ? Math.min(...s.els.map((e) => e.x)) : vp.xMax;
			if (s.drag === "obj") {
				let h = Math.max(vp.yMin * .9, Math.min(vp.yMax * .9, pt.y));
				if (Math.abs(h) < .002 * w) h = h < 0 ? -.002 * w : .002 * w;
				return {
					...s,
					ox: Math.max(vp.xMin + .01 * w, Math.min(firstX - .005 * w, pt.x)),
					oh: h
				};
			}
			const id = s.drag;
			const eye = s.els.find((e) => e.kind === "olho");
			const xmax = eye && id !== eye.id ? eye.x - .004 : vp.xMax - .02 * w;
			const x = Math.max(s.inf ? vp.xMin + .02 * w : s.ox + .005 * w, Math.min(xmax, pt.x));
			return {
				...s,
				els: s.els.map((e) => e.id === id ? {
					...e,
					x
				} : e)
			};
		},
		up: (s) => s.drag !== null ? {
			...s,
			drag: null
		} : void 0,
		cursor(s, p, pt) {
			const vp = preset(p).vp;
			const tol = .015 * (vp.xMax - vp.xMin);
			if (!s.inf && Math.abs(pt.x - s.ox) < tol && pt.y > Math.min(0, s.oh) - tol && pt.y < Math.max(0, s.oh) + tol) return "grab";
			const hitH = isEye(p) ? .15 : preset(p).H * 1.1;
			return s.els.some((e) => e.kind !== "olho" && Math.abs(pt.x - e.x) < tol && Math.abs(pt.y) < hitH) ? "ew-resize" : void 0;
		}
	},
	actions: [
		{
			id: "convergente",
			label: "Adicionar lente convergente",
			run: (s, p) => addLens(s, p, 1)
		},
		{
			id: "divergente",
			label: "Adicionar lente divergente",
			run: (s, p) => addLens(s, p, -1)
		},
		{
			id: "remover",
			label: "Remover lente selecionada",
			run: (s) => ({
				...s,
				els: s.els.filter((e) => e.id !== s.sel || e.kind === "olho"),
				sel: null
			})
		},
		{
			id: "fmenor",
			label: "f mais curta (×0,8)",
			run: (s) => scaleSel(s, 1.25)
		},
		{
			id: "fmaior",
			label: "f mais longa (×1,25)",
			run: (s) => scaleSel(s, .8)
		},
		{
			id: "inverter",
			label: "Inverter convergente/divergente",
			run: (s) => scaleSel(s, -1)
		},
		{
			id: "infinito",
			label: "Objeto no infinito / próximo",
			run: (s) => ({
				...s,
				inf: !s.inf
			}),
			active: (s) => s.inf
		}
	],
	render(ctx, frame) {
		const { state: s, params: p } = frame;
		const d = draw(ctx, frame);
		const vp = preset(p).vp;
		ctx.save();
		ctx.beginPath();
		ctx.rect(vp.xMin, vp.yMin, vp.xMax - vp.xMin, vp.yMax - vp.yMin);
		ctx.clip();
		renderBench(d, s, p, vp);
		ctx.restore();
	}
});
function addLens(s, p, sign) {
	const vp = preset(p).vp;
	const eye = s.els.find((e) => e.kind === "olho");
	const w = vp.xMax - vp.xMin;
	const scale = isEye(p) ? .5 : w / 4;
	let x = eye ? eye.x - .03 : Math.max(...s.els.map((e) => xOut(e, p)), s.inf ? vp.xMin + .2 * w : s.ox + .2 * w) + .25 * w;
	if (!eye && x > vp.xMax - .05 * w) x = (s.inf ? vp.xMin : s.ox) + .5 * (vp.xMax - (s.inf ? vp.xMin : s.ox));
	const P = sign * 1 / scale;
	const e = {
		id: s.nextId,
		kind: "fina",
		x,
		P: Math.round(P * 4) / 4 || sign * .25
	};
	return {
		...s,
		els: [...s.els, e],
		sel: e.id,
		nextId: s.nextId + 1
	};
}
function scaleSel(s, k) {
	return {
		...s,
		els: s.els.map((e) => e.id === s.sel && e.kind === "fina" ? {
			...e,
			P: e.P * k
		} : e)
	};
}
function drawThinLens(d, x, H, P, color, width = 2, yc = 0) {
	d.line(x, yc - H, x, yc + H, {
		color,
		width
	});
	const k = H * .14;
	const sgn = P >= 0 ? 1 : -1;
	for (const e of [-1, 1]) {
		const yt = yc + e * H;
		d.line(x, yt, x - k * .7, yt - e * sgn * k, {
			color,
			width
		});
		d.line(x, yt, x + k * .7, yt - e * sgn * k, {
			color,
			width
		});
	}
}
function renderBench(d, s, p, vp) {
	const { theme } = d;
	const H = preset(p).H;
	const a = analyze(s, p);
	const eyeMode = isEye(p);
	const w = vp.xMax - vp.xMin;
	d.line(vp.xMin, 0, vp.xMax, 0, {
		color: theme.muted,
		width: 1,
		dash: [6, 4]
	});
	for (const e of a.els) {
		const selected = e.id === s.sel;
		const col = selected ? theme.accent : theme.text;
		if (e.kind === "fina" || e.kind === "oculos") {
			const P = e.kind === "fina" ? e.P : num(p, "oculos");
			const h = eyeMode ? .18 : H;
			drawThinLens(d, e.x, h, P, col, selected ? 3 : 2);
			if (!eyeMode && P !== 0) for (const sg of [-1, 1]) {
				const xf = e.x + sg / P;
				d.dot(xf, 0, 3, col, selected ? 1 : .6);
				if (selected) d.text(sg * P > 0 ? "F'" : "F", xf, 0, {
					dy: 11,
					color: col,
					size: 10
				});
			}
			d.text(elLabel(e, p), e.x, h, {
				dy: -10,
				color: col,
				size: 10
			});
		} else if (e.kind === "espessa") {
			const { R1, R2, d: th } = thickGeom(p);
			const Rm = Math.min(Math.abs(R1), Math.abs(R2));
			const sagMax = Math.min(.45 * th, Rm);
			const hh = Math.min(H, .92 * Rm, Math.sqrt(Rm * Rm - (Rm - sagMax) ** 2));
			const pts = [];
			for (let i = 0; i <= 30; i++) {
				const y = -hh + 2 * hh * i / 30;
				pts.push([e.x + (R1 - Math.sign(R1) * Math.sqrt(R1 * R1 - y * y)), y]);
			}
			for (let i = 30; i >= 0; i--) {
				const y = -hh + 2 * hh * i / 30;
				pts.push([e.x + th + (R2 - Math.sign(R2) * Math.sqrt(R2 * R2 - y * y)), y]);
			}
			d.polyline(pts, {
				color: col,
				width: selected ? 2.5 : 1.5,
				close: true,
				fill: theme.dark ? "rgba(91,156,240,0.18)" : "rgba(47,125,225,0.12)"
			});
			const S = thickMatrix(p);
			const f = -1 / S[2];
			const xH = e.x + (S[3] - 1) / S[2];
			const xH2 = e.x + th + (1 - S[0]) / S[2];
			for (const [xx, lab, al] of [[
				xH,
				"H",
				"right"
			], [
				xH2,
				"H'",
				"left"
			]]) {
				d.line(xx, -H * 1.1, xx, H * 1.1, {
					color: theme.positive,
					dash: [4, 3],
					width: 1
				});
				d.text(lab, xx, H * 1.1, {
					dy: -8,
					dx: al === "right" ? -3 : 3,
					align: al,
					color: theme.positive,
					size: 11,
					weight: "600"
				});
			}
			d.dot(xH - f, 0, 3, theme.positive);
			d.text("F", xH - f, 0, {
				dy: 11,
				color: theme.positive,
				size: 10
			});
			d.dot(xH2 + f, 0, 3, theme.positive);
			d.text("F'", xH2 + f, 0, {
				dy: 11,
				color: theme.positive,
				size: 10
			});
			d.text(elLabel(e, p), e.x + th / 2, -H * 1.1, {
				dy: 12,
				color: col,
				size: 10
			});
		} else {
			d.circle(e.x + EYE_DR / 2, 0, 0, {
				minPx: 9,
				fill: theme.dark ? "#2a3140" : "#ffffff",
				stroke: col,
				width: 1.5
			});
			d.dot(e.x + EYE_DR / 2, 0, 3, theme.text);
			d.text("olho", e.x, -.12, {
				dy: 6,
				color: col,
				size: 11
			});
		}
	}
	const { xa, rays } = rayStarts(s, p, a, vp);
	const colors = [
		theme.series[1],
		theme.series[2],
		theme.series[4],
		theme.series[5]
	].map((c) => c ?? theme.accent);
	const paths = [];
	rays.forEach((r, i) => {
		const pts = rayPath(a.els, p, xa, r.y, r.u, vp.xMax + w, a.eyeP);
		paths.push(pts);
		const col = r.main ? colors[i % colors.length] : theme.series[3] ?? theme.muted;
		d.polyline(pts, {
			color: col,
			width: r.main ? 1.6 : 1,
			alpha: r.main ? .95 : .55
		});
		if (!a.eye && !a.afocal && a.q < 0 && a.optics.length) {
			const n = pts.length;
			const [x2, y2] = pts[n - 1];
			const [x1, y1] = pts[n - 2];
			const slope = (y2 - y1) / (x2 - x1);
			const xi = xOut(a.optics[a.optics.length - 1], p) + a.q;
			d.line(x1, y1, xi, y1 + (xi - x1) * slope, {
				color: col,
				width: 1,
				dash: [4, 4],
				alpha: .6
			});
		}
	});
	const objCol = theme.series[0] ?? theme.accent;
	if (!s.inf) {
		d.arrow(s.ox, 0, 0, s.oh, {
			color: objCol,
			width: 3
		});
		d.dot(s.ox, s.oh, 4.5, objCol);
		d.text("objeto", s.ox, 0, {
			dy: s.oh > 0 ? 13 : -13,
			color: objCol,
			size: 11
		});
	} else d.text(`objeto no infinito (α = ${fmt$4(num(p, "alfa", 1), 1)}°)`, vp.xMin + .01 * w, vp.yMin, {
		dy: -12,
		align: "left",
		color: objCol,
		size: 11
	});
	const imgCol = theme.series[3] ?? theme.accent;
	a.images.forEach((im) => {
		const final = im.k === a.optics.length - 1 && !a.eye;
		const el = a.optics[im.k];
		if (el.kind === "oculos" && num(p, "oculos") === 0 || el.kind === "fina" && el.P === 0) return;
		if (im.x < vp.xMin || im.x > vp.xMax || Math.abs(im.h) > 3 * (vp.yMax - vp.yMin)) return;
		const alpha = final ? 1 : .55;
		d.arrow(im.x, 0, 0, im.h, {
			color: imgCol,
			width: final ? 3 : 2,
			dash: im.real ? [] : [5, 4],
			alpha
		});
		const lab = final ? im.real ? "imagem final (real)" : "imagem final (virtual)" : a.eye ? im.real ? "imagem da lente" : "imagem virtual da lente" : `I${im.k + 1}`;
		d.text(lab, im.x, 0, {
			dy: im.h > 0 ? 13 : -13,
			color: imgCol,
			size: 10
		});
	});
	const lines = [];
	if (a.eye) {
		const nitido = a.blur < 2e-5;
		lines.push(`borrão na retina: ${fmt$4(a.blur * 1e3, 3)} mm ${nitido ? "(nítido)" : "(desfocado)"}`);
		lines.push(`acomodação usada: ${fmt$4(a.acc, 2)} D de ${fmt$4(num(p, "acom"), 1)} D · erro refrativo ${fmt$4(num(p, "rx"), 2)} D`);
	} else if (a.optics.length) {
		if (a.afocal) lines.push("imagem final no infinito (sistema afocal)");
		else if (!s.inf) lines.push(`imagem final: p' = ${cm(a.q)} cm do último elemento, m = ${fmt$4(a.m)}`);
		else lines.push(`imagem no plano a ${cm(a.q)} cm do último elemento`);
		const ang = a.afocal || s.inf || a.q < 0 ? `aumento angular: ${fmt$4(a.Mang, 1)}× · ` : "";
		lines.push(`${ang}f equivalente: ${Math.abs(a.feq) >= 1e5 ? "∞" : `${cm(a.feq)} cm`}`);
	}
	lines.push("arraste objeto e lentes · clique numa lente para selecioná-la");
	lines.forEach((t, i) => d.text(t, vp.xMin + .01 * w, vp.yMax, {
		dy: 8 + i * 15,
		align: "left",
		baseline: "top",
		color: i === lines.length - 1 ? theme.muted : theme.text,
		size: 11,
		weight: i === 0 ? "600" : "400"
	}));
	if (a.eye) renderInset(d, s, p, a, paths);
}
function renderInset(d, _s, p, a, paths) {
	const { theme } = d;
	const eye = a.eye;
	const B = INSET;
	const L = EYE_LOCAL;
	const k = Math.min((B.xMax - B.xMin) / (L.xMax - L.xMin), (B.yMax - B.yMin) / (L.yMax - L.yMin));
	const cx = (B.xMin + B.xMax) / 2;
	const cy = (B.yMin + B.yMax) / 2;
	const lx0 = (L.xMin + L.xMax) / 2;
	const T = (x, y) => [cx + (x - eye.x - lx0) * k, cy + y * k];
	d.rect(B.xMin, B.yMin, B.xMax - B.xMin, B.yMax - B.yMin, {
		fill: theme.dark ? "#161b24" : "#fbfcfe",
		stroke: theme.grid,
		width: 1
	});
	d.text("detalhe do olho (ampliado)", B.xMin + .05, B.yMax - .05, {
		align: "left",
		baseline: "top",
		color: theme.muted,
		size: 10
	});
	d.line(eye.x, .05, B.xMax - .1, B.yMin, {
		color: theme.grid,
		width: 1
	});
	const [ecx, ecy] = T(eye.x + EYE_DR / 2 + 5e-4, 0);
	d.circle(ecx, ecy, .0115 * k, {
		stroke: theme.muted,
		width: 1.5
	});
	const ret = [];
	for (let i = -10; i <= 10; i++) {
		const y = i / 10 * .009;
		ret.push(T(eye.x + EYE_DR - y * y / .023, y));
	}
	d.polyline(ret, {
		color: theme.positive,
		width: 3
	});
	const [tx, ty] = T(eye.x + EYE_DR, -.0095);
	d.text("retina", tx, ty, {
		dy: 8,
		color: theme.positive,
		size: 10
	});
	const [l0x, l0y] = T(eye.x, -.0045);
	const [, l1y] = T(eye.x, .0045);
	drawThinLens(d, l0x, (l1y - l0y) / 2, 1, theme.text, 2, (l0y + l1y) / 2);
	const oc = a.els.find((e) => e.kind === "oculos");
	if (oc) {
		const [gx, gy0] = T(oc.x, -.009);
		const [, gy1] = T(oc.x, .009);
		if (gx > B.xMin) drawThinLens(d, gx, (gy1 - gy0) / 2, num(p, "oculos") || 1, theme.accent, 2, (gy0 + gy1) / 2);
	}
	const xStart = eye.x + L.xMin;
	const colors = [theme.series[3] ?? theme.muted, theme.series[1] ?? theme.accent];
	paths.forEach((pts, i) => {
		const seg = [];
		for (let j = 0; j + 1 < pts.length; j++) {
			const [x1, y1] = pts[j];
			const [x2, y2] = pts[j + 1];
			if (x2 < xStart) continue;
			if (x1 < xStart) seg.push(T(xStart, y1 + (xStart - x1) * (y2 - y1) / (x2 - x1)));
			else if (!seg.length) seg.push(T(x1, y1));
			seg.push(T(x2, y2));
		}
		d.polyline(seg, {
			color: colors[i % 2],
			width: 1.3,
			alpha: .9
		});
	});
	if (Math.abs(a.qEye) < .03 && a.qEye > 0) {
		const [fx, fy] = T(eye.x + a.qEye, 0);
		d.dot(fx, fy, 3.5, theme.text);
	}
}
//#endregion
//#region sims/millikan/src/panel.ts
/** Marcas "redondas" (1, 2, 5 × 10^k) entre min e max. */
function niceTicks(min, max, n = 5) {
	const span = max - min;
	if (!(span > 0)) return [min];
	const raw = span / n;
	const mag = 10 ** Math.floor(Math.log10(raw));
	const step = [
		1,
		2,
		5,
		10
	].map((m) => m * mag).find((s) => s >= raw) ?? 10 * mag;
	const out = [];
	for (let v = Math.ceil(min / step - 1e-9) * step; v <= max + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : v);
	return out;
}
var fmt$3 = (v, digits = 3) => formatBR(v, digits);
/**
* Gráfico embutido no palco: converte dados em coordenadas do mundo, desenha
* moldura, grade e rótulos, e recorta as curvas à moldura.
*/
function panel$1(d, box, xr, yr) {
	const tf = (r, v) => r.log ? Math.log10(Math.max(v, 1e-300)) : v;
	const X = (v) => box.x0 + (tf(xr, v) - tf(xr, xr.min)) / (tf(xr, xr.max) - tf(xr, xr.min)) * (box.x1 - box.x0);
	const Y = (v) => box.y0 + (tf(yr, v) - tf(yr, yr.min)) / (tf(yr, yr.max) - tf(yr, yr.min)) * (box.y1 - box.y0);
	const { ctx, theme } = d;
	const logTicks = (r) => {
		const out = [];
		for (let k = Math.ceil(Math.log10(r.min) - 1e-9); k <= Math.log10(r.max) + 1e-9; k++) out.push(10 ** k);
		return out;
	};
	const api = {
		X,
		Y,
		box,
		inside: (x, y) => x >= xr.min && x <= xr.max && y >= yr.min && y <= yr.max,
		/** Moldura, grade, marcas e rótulos dos eixos. */
		frame(opts = {}) {
			const xt = opts.xticks ?? (xr.log ? logTicks(xr) : niceTicks(xr.min, xr.max));
			const yt = opts.yticks ?? (yr.log ? logTicks(yr) : niceTicks(yr.min, yr.max, 4));
			const fx = opts.fx ?? ((v) => fmt$3(v));
			const fy = opts.fy ?? ((v) => fmt$3(v));
			for (const v of xt) {
				if (v < xr.min || v > xr.max) continue;
				d.line(X(v), box.y0, X(v), box.y1, {
					color: theme.grid,
					width: 1
				});
				d.text(fx(v), X(v), box.y0, {
					color: theme.muted,
					size: 10,
					dy: 9
				});
			}
			for (const v of yt) {
				if (v < yr.min || v > yr.max) continue;
				d.line(box.x0, Y(v), box.x1, Y(v), {
					color: theme.grid,
					width: 1
				});
				d.text(fy(v), box.x0, Y(v), {
					color: theme.muted,
					size: 10,
					align: "right",
					dx: -4
				});
			}
			if (opts.zero !== false && !yr.log && yr.min < 0 && yr.max > 0) d.line(box.x0, Y(0), box.x1, Y(0), {
				color: theme.muted,
				width: 1
			});
			if (opts.zero !== false && !xr.log && xr.min < 0 && xr.max > 0) d.line(X(0), box.y0, X(0), box.y1, {
				color: theme.muted,
				width: 1
			});
			d.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0, {
				stroke: theme.muted,
				width: 1
			});
			if (opts.xlabel) d.text(opts.xlabel, box.x1, box.y0, {
				color: theme.muted,
				size: 11,
				align: "right",
				dy: 22
			});
			if (opts.ylabel) d.text(opts.ylabel, box.x0, box.y1, {
				color: theme.muted,
				size: 11,
				align: "left",
				dy: -9
			});
		},
		/** Executa desenhos recortados à moldura. */
		clip(fn) {
			ctx.save();
			ctx.beginPath();
			ctx.rect(box.x0, box.y0, box.x1 - box.x0, box.y1 - box.y0);
			ctx.clip();
			fn();
			ctx.restore();
		},
		/** Polilinha em coordenadas de dados (recortada). */
		line(pts, s = {}) {
			api.clip(() => d.polyline(pts.filter(([, y]) => Number.isFinite(y)).map(([x, y]) => [X(x), Y(y)]), s));
		},
		/** Curva y = f(x) em coordenadas de dados (recortada). */
		plot(f, a, b, s = {}) {
			const n = s.n ?? 200;
			const pts = [];
			for (let i = 0; i <= n; i++) {
				const x = xr.log ? 10 ** (Math.log10(a) + (Math.log10(b) - Math.log10(a)) * i / n) : a + (b - a) * i / n;
				pts.push([x, f(x)]);
			}
			api.line(pts, s);
		}
	};
	return api;
}
//#endregion
//#region sims/millikan/src/physics.ts
/** Gotas de óleo de Millikan: lei de Stokes com correção de Cunningham e movimento browniano. */
var E_CHARGE = 1602176634e-28;
var KB = 1380649e-29;
var G$2 = 9.81;
/** Constante de Cunningham b (Pa·m) e pressão atmosférica (Pa). */
var B_CUNN = .0082;
var P_ATM = 101325;
/** Distância entre as placas (m). */
var GAP = .006;
/** Distância entre as linhas do retículo usadas na cronometragem (m). */
var RETICLE = .001;
/** Viscosidade do ar (Pa·s) pela fórmula de Sutherland, T em °C. */
var viscosity = (Tc) => {
	const T = Tc + 273.15;
	return 18325e-9 * (416.16 / (T + 120)) * (T / 296.16) ** 1.5;
};
/** Fator de Cunningham C = 1 + b/(p r). */
var cunningham = (r) => 1 + B_CUNN / (P_ATM * r);
/** Massa aparente (descontado o empuxo do ar). */
var apparentMass = (r) => 4 / 3 * Math.PI * r ** 3 * 884.8;
/** Velocidade vertical terminal (m/s, positiva para cima) da gota de carga q no campo E. */
function drift(r, q, E, Tc) {
	return (q * E - apparentMass(r) * G$2) * cunningham(r) / (6 * Math.PI * viscosity(Tc) * r);
}
/** Velocidade de queda livre (m/s, positiva). */
var fallSpeed = (r, Tc) => -drift(r, 0, 0, Tc);
/** Coeficiente de difusão D = k_B T C/(6πηr). */
var diffusion = (r, Tc) => KB * (Tc + 273.15) * cunningham(r) / (6 * Math.PI * viscosity(Tc) * r);
/** Tensão que equilibra a gota (V). */
var balanceVoltage = (r, q) => apparentMass(r) * G$2 * GAP / q;
/**
* Raio a partir da velocidade de queda. Sem correção: r = √(9ηv/(2ρ'g)).
* Com correção de Cunningham, resolve r² + (b/p) r − 9ηv/(2ρ'g) = 0.
*/
function radiusFromFall(v, Tc, corr) {
	const a2 = 9 * viscosity(Tc) * v / (1769.6 * G$2);
	if (!corr) return Math.sqrt(a2);
	const h = B_CUNN / (2 * P_ATM);
	return Math.sqrt(h * h + a2) - h;
}
/** Carga pelo método de queda e subida: q = 6πη_ef r (v_q + v_s)/E. */
function chargeFromVelocities(vFall, vRise, V, Tc, corr) {
	const r = radiusFromFall(vFall, Tc, corr);
	const eta = viscosity(Tc) / (corr ? cunningham(r) : 1);
	return 6 * Math.PI * eta * r * (vFall + vRise) / (V / GAP);
}
/** Carga pelo método da tensão de equilíbrio: q = m'g d/V. */
function chargeFromBalance(vFall, V, Tc, corr) {
	return apparentMass(radiusFromFall(vFall, Tc, corr)) * G$2 * GAP / V;
}
/** Melhor carga elementar que explica as cargas medidas como múltiplos inteiros. */
function estimateE(qs) {
	if (!qs.length) return 0;
	let best = 0;
	let bestS = Infinity;
	for (let e = 13e-20; e <= 2e-19; e += 2e-23) {
		let S = 0;
		for (const q of qs) {
			const x = q / e;
			S += (x - Math.round(x)) ** 2;
		}
		if (S < bestS) {
			bestS = S;
			best = e;
		}
	}
	let num = 0;
	let den = 0;
	for (const q of qs) {
		const n = Math.max(1, Math.round(q / best));
		num += q * n;
		den += n * n;
	}
	return num / den;
}
//#endregion
//#region sims/millikan/src/index.ts
/** Centro do campo da luneta (m) e meia abertura (m). */
var YC = GAP / 2;
var FOV = .00125;
var Y_UP = YC + RETICLE / 2;
var Y_LO = YC - RETICLE / 2;
var T$1 = (p) => num(p, "T", 23);
var fieldOn = (p) => Math.round(num(p, "campo", 0)) === 1;
var Vplates = (p) => num(p, "V", 400);
var Efield = (p) => fieldOn(p) ? Vplates(p) / GAP : 0;
var corr = (p) => Math.round(num(p, "cunningham", 1)) === 1;
var metodo = (p) => Math.round(num(p, "metodo", 0));
var selected = (s) => s.drops.find((d) => d.id === s.sel);
var qOf = (d) => d.n * E_CHARGE;
/** Sorteia uma gota nova: raio entre 0,45 e 1,3 µm, carga de 1 a 9 e. */
function newDrop(rand, id, yMin, yMax) {
	const r = (.45 + .85 * rand()) * 1e-6;
	const n = 1 + Math.min(8, Math.floor(-Math.log(1 - rand() * .999) * 2.2));
	return {
		id,
		x: (2 * rand() - 1) * FOV * .8,
		y: yMin + (yMax - yMin) * rand(),
		r,
		n
	};
}
function spray(s, count = 7) {
	const rand = rng(s.seed);
	const drops = s.drops.slice();
	let id = s.nextId;
	for (let i = 0; i < count; i++) drops.push(newDrop(rand, id++, YC - 4e-4, YC + .0012));
	const sel = selected(s) ? s.sel : drops[0]?.id ?? -1;
	return {
		...s,
		drops,
		nextId: id,
		sel,
		seed: Math.floor(rand() * 2 ** 31),
		timer: null
	};
}
/** Tempo para percorrer a distância do retículo com a velocidade dada (0 se não chega). */
var transit = (v) => v > 0 ? RETICLE / v : 0;
/** Carga calculada pelo método escolhido a partir dos tempos de queda e subida. */
function chargeFromTimes(p, tq, ts, V) {
	if (!(tq > 0)) return 0;
	const vq = RETICLE / tq;
	if (metodo(p) === 1) return chargeFromBalance(vq, V, T$1(p), corr(p));
	if (!(ts > 0) || !(V > 0)) return 0;
	return chargeFromVelocities(vq, RETICLE / ts, V, T$1(p), corr(p));
}
/** Mede automaticamente `count` gotas novas, com o ruído browniano na cronometragem. */
function autoMeasure(s, p, count) {
	const rand = rng(s.seed ^ 1540483477);
	const qs = s.qs.slice();
	const Tc = T$1(p);
	let tries = 0;
	while (qs.length < s.qs.length + count && tries++ < count * 20) {
		const d = newDrop(rand, 0, YC, YC);
		const q = qOf(d);
		const D = diffusion(d.r, Tc);
		const noisy = (v) => {
			const t = RETICLE / v;
			return t * (1 + Math.sqrt(2 * D * t) / RETICLE * gaussian(rand));
		};
		const tq = noisy(fallSpeed(d.r, Tc));
		if (metodo(p) === 1) {
			const Veq = balanceVoltage(d.r, q) * (1 + .01 * gaussian(rand));
			if (Veq > 1500) continue;
			qs.push(chargeFromTimes(p, tq, 0, Veq));
		} else {
			const V = Vplates(p);
			const vs = drift(d.r, q, V / GAP, Tc);
			if (vs <= 0 || .001 / vs > 120) continue;
			qs.push(chargeFromTimes(p, tq, noisy(vs), V));
		}
	}
	return {
		...s,
		qs,
		seed: Math.floor(rand() * 2 ** 31)
	};
}
var initState = (semente = 0) => spray({
	drops: [],
	sel: -1,
	seed: 20240917 + 7919 * Math.round(semente),
	nextId: 1,
	timer: null,
	tq: 0,
	ts: 0,
	Vs: 0,
	qs: []
});
var val = (s, f) => {
	const d = selected(s);
	return d ? f(d) : 0;
};
var millikan = defineSim({
	id: "millikan",
	title: "Gota de óleo de Millikan",
	course: "FG IV",
	topic: "Física moderna",
	priority: "P2",
	summary: "Gotas de óleo carregadas entre placas paralelas, vistas pela luneta com retículo. Cronometre a queda livre (lei de Stokes dá raio e massa) e a subida com campo, ou ache a tensão de equilíbrio: o histograma das cargas medidas mostra a quantização q = n·e.",
	equations: [
		String.raw`6\pi\eta_{\text{ef}} r\, v_q = \tfrac43\pi r^3 (\rho_o - \rho_{ar}) g \qquad \eta_{\text{ef}} = \frac{\eta}{1 + b/(pr)}`,
		String.raw`q = \frac{6\pi\eta_{\text{ef}}\, r\,(v_q + v_s)}{E} \qquad E = \frac{V}{d}`,
		String.raw`\text{equilíbrio: } q = \frac{m' g\, d}{V_{eq}} \qquad \langle \Delta y^2\rangle = 2Dt,\ D = \frac{k_BT}{6\pi\eta_{\text{ef}} r}`
	],
	liveEquations(s, p) {
		const d = selected(s);
		const out = [String.raw`E = \frac{V}{d} = \frac{${texNum(fieldOn(p) ? Vplates(p) : 0)}}{${texNum(GAP)}} = ${texNum(Efield(p))}\ \text{V/m} \qquad \eta = ${texNum(eta(p))}\ \text{Pa·s}`];
		if (s.tq > 0) {
			const vq = RETICLE / s.tq;
			const r = radiusFromFall(vq, T$1(p), corr(p));
			out.push(String.raw`v_q = \frac{1\ \text{mm}}{${texNum(s.tq)}\ \text{s}} = ${texNum(vq)}\ \text{m/s} \Rightarrow r = ${texNum(r * 1e6)}\ \mu\text{m}`);
			const q = chargeFromTimes(p, s.tq, s.ts, metodo(p) === 1 ? Vplates(p) : s.Vs);
			if (q > 0) out.push(String.raw`q = ${texNum(q)}\ \text{C} = ${texNum(q / E_CHARGE)}\, e`);
		} else if (d) out.push(String.raw`\text{gota selecionada: cronometre a queda entre as linhas do retículo}`);
		out.push(String.raw`e_{\text{estimado}} = ${texNum(estimateE(s.qs))}\ \text{C} \quad (N = ${s.qs.length})`);
		return out;
	},
	params: [
		{
			key: "metodo",
			label: "Método",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Queda livre e subida com campo"
			}, {
				value: 1,
				label: "Queda livre e tensão de equilíbrio"
			}],
			live: true
		},
		{
			key: "campo",
			label: "Campo entre as placas",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Desligado (queda livre)"
			}, {
				value: 1,
				label: "Ligado"
			}],
			live: true
		},
		{
			key: "V",
			label: "Tensão nas placas V",
			unit: "V",
			min: 0,
			max: 1500,
			step: 1,
			default: 500,
			live: true
		},
		{
			key: "semente",
			label: "Borrifada (sorteio das gotas)",
			unit: "",
			min: 0,
			max: 99,
			step: 1,
			default: 0
		},
		{
			key: "T",
			label: "Temperatura do ar",
			unit: "°C",
			min: 10,
			max: 40,
			step: .5,
			default: 23
		},
		{
			key: "cunningham",
			label: "Correção de Cunningham na análise",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 1,
			options: [{
				value: 1,
				label: "Aplicar"
			}, {
				value: 0,
				label: "Não aplicar (Stokes puro)"
			}],
			live: true
		},
		{
			key: "luneta",
			label: "Imagem da luneta",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Direita"
			}, {
				value: 1,
				label: "Invertida (como na luneta real)"
			}],
			live: true
		}
	],
	observables: [
		{
			key: "y",
			label: "Altura da gota selecionada",
			unit: "mm",
			value: (s) => val(s, (d) => d.y * 1e3)
		},
		{
			key: "r",
			label: "Raio da gota (real)",
			unit: "µm",
			value: (s) => val(s, (d) => d.r * 1e6)
		},
		{
			key: "vq",
			label: "Velocidade de queda livre",
			unit: "mm/s",
			value: (s, p) => val(s, (d) => fallSpeed(d.r, T$1(p)) * 1e3)
		},
		{
			key: "tq",
			label: "Tempo de queda em 1 mm (ideal)",
			unit: "s",
			value: (s, p) => val(s, (d) => transit(fallSpeed(d.r, T$1(p))))
		},
		{
			key: "ts",
			label: "Tempo de subida em 1 mm (ideal)",
			unit: "s",
			value: (s, p) => val(s, (d) => transit(drift(d.r, qOf(d), Vplates(p) / GAP, T$1(p))))
		},
		{
			key: "Veq",
			label: "Tensão de equilíbrio da gota",
			unit: "V",
			value: (s) => val(s, (d) => balanceVoltage(d.r, qOf(d)))
		},
		{
			key: "tqMed",
			label: "Tempo de queda cronometrado",
			unit: "s",
			value: (s) => s.tq
		},
		{
			key: "tsMed",
			label: "Tempo de subida cronometrado",
			unit: "s",
			value: (s) => s.ts
		},
		{
			key: "n",
			label: "Cargas da gota (n)",
			unit: "",
			value: (s) => val(s, (d) => d.n)
		},
		{
			key: "N",
			label: "Gotas registradas",
			unit: "",
			value: (s) => s.qs.length
		},
		{
			key: "e",
			label: "e estimado pelo histograma",
			unit: "C",
			value: (s) => estimateE(s.qs)
		}
	],
	chart: {
		x: "t",
		y: "y"
	},
	scenarios: [
		{
			id: "queda-subida",
			label: "Queda e subida de uma gota",
			params: {
				metodo: 0,
				campo: 0,
				V: 500,
				T: 23,
				cunningham: 1,
				luneta: 0
			},
			guide: `### Cronometrando uma gota
1. A gota selecionada (anel) está caindo sem campo. Quando ela cruza a **linha de cima** do retículo o cronômetro dispara; na **linha de baixo**, para: é o tempo de queda $t_q$ em 1 mm.
2. Ligue o **campo** (500 V): a gota sobe. O cronômetro mede o tempo de subida $t_s$.
3. Clique em **Registrar gota**: $v_q = 1\\ \\text{mm}/t_q$ dá o raio pela lei de Stokes, e $q = 6\\pi\\eta_{ef}r(v_q + v_s)/E$.
4. Repare no tremor da gota: é o **movimento browniano**, que limita a precisão do cronômetro.
5. Clique em outra gota na luneta para selecioná-la e repita.`,
			predict: [{
				question: "Uma gota de raio duas vezes maior cai, sem campo, com velocidade:",
				options: [
					"igual",
					"duas vezes maior",
					"quatro vezes maior",
					"oito vezes maior"
				],
				answer: 2,
				explanation: "Peso ∝ $r^3$ e arrasto de Stokes ∝ $r v$, então $v \\propto r^2$ (a correção de Cunningham muda isso um pouco para gotas muito pequenas)."
			}]
		},
		{
			id: "histograma",
			label: "Quantização: histograma de cargas",
			params: {
				metodo: 0,
				campo: 1,
				V: 600,
				T: 23,
				cunningham: 1,
				luneta: 0
			},
			guide: `### A carga vem em pacotes
1. Clique em **Medir 25 gotas** algumas vezes. Cada medida tem o ruído browniano de uma cronometragem real.
2. No histograma de $q/e$, as cargas se agrupam em torno de inteiros: $q = n e$.
3. O valor de $e$ estimado busca o divisor comum das cargas medidas. Compare com $1{,}602 \\times 10^{-19}\\ \\text{C}$.
4. Mude a análise para **Stokes puro** e meça de novo: os picos escorregam para a direita, porque sem a correção de Cunningham as gotas pequenas parecem ter mais carga.`,
			predict: [{
				question: "Sem a correção de Cunningham (o ar não é contínuo na escala de 1 µm), o valor de e obtido fica:",
				options: [
					"maior que o verdadeiro",
					"menor que o verdadeiro",
					"igual"
				],
				answer: 0,
				explanation: "Gotas pequenas caem mais depressa do que Stokes prevê (escorregam entre as moléculas do ar). Interpretando $v_q$ com Stokes puro, o raio e a carga saem superestimados."
			}]
		},
		{
			id: "equilibrio",
			label: "Tensão de equilíbrio",
			params: {
				metodo: 1,
				campo: 1,
				V: 400,
				T: 23,
				cunningham: 1,
				luneta: 1
			},
			guide: `### Segurar a gota parada
1. A imagem da luneta agora é **invertida**, como na luneta real: a gota que cai parece subir.
2. Ajuste $V$ até a gota selecionada ficar parada (o observável **tensão de equilíbrio** confere a sua leitura).
3. Desligue o campo e cronometre a queda livre para obter o raio.
4. **Registre**: $q = m'g\\,d/V$ usa a tensão atual. Se $V$ não estiver no equilíbrio, a carga sai errada.`
		}
	],
	exercises: [{
		id: "raio",
		prompt: "Uma gota de óleo (ρ = 886 kg/m³) cai 1,00 mm em {t} s entre as placas, no ar a 23 °C (η = 1,83 × 10⁻⁵ Pa·s). Usando a lei de Stokes sem correção, qual é o raio da gota?",
		vary: { t: [
			8,
			40,
			1
		] },
		answer: {
			label: "r",
			unit: "µm",
			compute: (p) => radiusFromFall(RETICLE / num(p, "t"), 23, false) * 1e6
		},
		hint: "r = √(9ηv/(2(ρ − ρ_ar)g)), com v = 1 mm/t."
	}, {
		id: "carga",
		prompt: "Uma gota de raio {r} µm (ρ = 886 kg/m³) fica parada entre placas separadas por 6,0 mm quando a tensão é {V} V. Qual é a carga da gota, em múltiplos de e?",
		vary: {
			r: [
				.5,
				1.2,
				2
			],
			V: [
				150,
				900,
				0
			]
		},
		answer: {
			label: "q/e",
			unit: "",
			compute: (p) => apparentMass(num(p, "r") * 1e-6) * 9.81 * GAP / num(p, "V") / E_CHARGE
		},
		hint: "qV/d = m'g, com m' = (4/3)πr³(ρ − ρ_ar)."
	}],
	init: (p) => initState(num(p, "semente", 0)),
	step(s, p, t, dt) {
		const rand = rng(s.seed);
		const E = Efield(p);
		const Tc = T$1(p);
		const drops = [];
		let { timer, tq, ts, Vs } = s;
		for (const d of s.drops) {
			const D = diffusion(d.r, Tc);
			const sig = Math.sqrt(2 * D * dt);
			const y = d.y + drift(d.r, qOf(d), E, Tc) * dt + sig * gaussian(rand);
			const x = d.x + sig * gaussian(rand);
			if (y <= 0 || y >= .006) continue;
			if (d.id === s.sel) {
				const cross = (line) => (d.y - line) * (y - line) <= 0 && d.y !== y ? t + dt * (d.y - line) / (d.y - y) : NaN;
				const cu = cross(Y_UP);
				const cl = cross(Y_LO);
				if (y < d.y) {
					if (!Number.isNaN(cu)) timer = {
						dir: -1,
						t0: cu
					};
					else if (!Number.isNaN(cl) && timer?.dir === -1) {
						tq = cl - timer.t0;
						timer = null;
					}
				} else if (!Number.isNaN(cl)) timer = {
					dir: 1,
					t0: cl
				};
				else if (!Number.isNaN(cu) && timer?.dir === 1) {
					ts = cu - timer.t0;
					Vs = fieldOn(p) ? Vplates(p) : 0;
					timer = null;
				}
			}
			drops.push({
				...d,
				x,
				y
			});
		}
		const sel = drops.some((d) => d.id === s.sel) ? s.sel : -1;
		if (sel !== s.sel) timer = null;
		return {
			...s,
			drops,
			sel,
			timer,
			tq,
			ts,
			Vs,
			seed: Math.floor(rand() * 2 ** 31)
		};
	},
	dt: .05,
	sampleEvery: 4,
	maxSamples: 6e3,
	actions: [
		{
			id: "borrifar",
			label: "Borrifar óleo",
			run: (s) => spray(s)
		},
		{
			id: "proxima",
			label: "Selecionar outra gota",
			run(s) {
				const vis = s.drops.filter((d) => Math.abs(d.y - YC) < FOV);
				const list = vis.length ? vis : s.drops;
				if (!list.length) return s;
				const i = list.findIndex((d) => d.id === s.sel);
				return {
					...s,
					sel: list[(i + 1) % list.length].id,
					timer: null,
					tq: 0,
					ts: 0,
					Vs: 0
				};
			}
		},
		{
			id: "registrar",
			label: "Registrar gota",
			run(s, p) {
				const q = chargeFromTimes(p, s.tq, s.ts, metodo(p) === 1 ? fieldOn(p) ? Vplates(p) : 0 : s.Vs);
				if (!(q > 0)) return s;
				return {
					...s,
					qs: [...s.qs, q],
					tq: 0,
					ts: 0,
					Vs: 0
				};
			}
		},
		{
			id: "auto",
			label: "Medir 25 gotas",
			run: (s, p) => autoMeasure(s, p, 25)
		},
		{
			id: "limpar",
			label: "Limpar histograma",
			run: (s) => ({
				...s,
				qs: []
			})
		}
	],
	pointer: {
		down(s, p, pt) {
			const best = pickDrop(s, p, pt.x, pt.y);
			return best ? {
				...s,
				sel: best.id,
				timer: null,
				tq: 0,
				ts: 0,
				Vs: 0
			} : void 0;
		},
		cursor: (s, p, pt) => pickDrop(s, p, pt.x, pt.y) ? "pointer" : void 0
	},
	viewport: () => ({
		xMin: 0,
		xMax: 20,
		yMin: 0,
		yMax: 12
	}),
	render(ctx, frame) {
		const d = draw(ctx, frame);
		renderChamber(d, frame.theme, frame.state, frame.params);
		renderScope(d, frame.theme, frame.state, frame.params, frame.t);
		renderHistogram(d, frame.theme, frame.state, frame.params);
	}
});
var eta = (p) => viscosity(T$1(p));
/** Luneta: centro e raio no palco; escala palco/metro. */
var SC = {
	cx: 8.6,
	cy: 6.4,
	R: 4.6
};
var K$2 = SC.R / FOV;
var invert = (p) => Math.round(num(p, "luneta")) === 1 ? -1 : 1;
var toScope = (p, d) => [SC.cx + invert(p) * d.x * K$2, SC.cy + invert(p) * (d.y - YC) * K$2];
function pickDrop(s, p, x, y) {
	let best;
	let bd = .45;
	for (const d of s.drops) {
		const [X, Y] = toScope(p, d);
		const dist = Math.hypot(X - x, Y - y);
		if (dist < bd && Math.hypot(X - SC.cx, Y - SC.cy) < SC.R) {
			bd = dist;
			best = d;
		}
	}
	return best;
}
function renderChamber(d, th, s, p) {
	const x0 = .6;
	const x1 = 3.6;
	const yb = 4.2;
	const yt = 8.6;
	const on = fieldOn(p);
	d.rect(x0, yt, 3, .25, { fill: on ? th.positive : th.muted });
	d.rect(x0, 3.95, 3, .25, { fill: on ? th.negative : th.muted });
	d.text(on ? `+${fmt$3(Vplates(p))} V` : "0 V", 4.2 / 2, 9.2, {
		size: 10,
		color: on ? th.positive : th.muted
	});
	d.text("0 V", 4.2 / 2, 3.6, {
		size: 10,
		color: th.muted
	});
	d.text("d = 6 mm", 3.7, 12.8 / 2, {
		size: 10,
		color: th.muted,
		align: "left"
	});
	d.polyline([
		[1.9, 10.6],
		[2.1, 9.2],
		[2.1, 8.85]
	], {
		color: th.muted,
		width: 1.5
	});
	d.text("atomizador", 2.1, 11, {
		size: 10,
		color: th.muted
	});
	const ky = 4.3999999999999995 / GAP;
	for (const g of s.drops) {
		const X = 4.2 / 2 + g.x * ky;
		const Y = yb + g.y * ky;
		if (X > x0 && X < x1) d.dot(X, Y, g.id === s.sel ? 2.6 : 1.6, g.id === s.sel ? th.accent : th.text, .8);
	}
	d.rect(4.2 / 2 - FOV * ky, yb + (YC - FOV) * ky, 2 * FOV * ky, 2 * FOV * ky, {
		stroke: th.accent,
		width: 1,
		dash: [3, 3]
	});
	if (on) for (let x = 1; x < x1; x += .8) d.arrowPx(x, 8.45, 0, -1, 14, {
		color: th.series[0],
		width: 1
	});
	d.text("luz →", .6, 2.9, {
		size: 10,
		color: th.series[5],
		align: "left"
	});
	d.text("campo da luneta (tracejado)", .6, 2.2, {
		size: 10,
		color: th.muted,
		align: "left"
	});
}
function renderScope(d, th, s, p, t) {
	d.circle(SC.cx, SC.cy, SC.R + .15, {
		fill: "#05070c",
		stroke: th.muted,
		width: 3
	});
	const { ctx } = d;
	ctx.save();
	ctx.beginPath();
	ctx.arc(SC.cx, SC.cy, SC.R, 0, 2 * Math.PI);
	ctx.clip();
	for (let k = -5; k <= 5; k++) {
		const yy = SC.cy + k * 25e-5 * K$2;
		const major = k === -2 || k === 2;
		d.line(SC.cx - SC.R, yy, SC.cx + SC.R, yy, {
			color: major ? "#e8c860" : "rgba(220,220,200,0.35)",
			width: major ? 1.4 : .7
		});
	}
	d.line(SC.cx, SC.cy - SC.R, SC.cx, SC.cy + SC.R, {
		color: "rgba(220,220,200,0.35)",
		width: .7
	});
	for (const g of s.drops) {
		const [X, Y] = toScope(p, g);
		const size = 1.2 + g.r * 26e5;
		d.dot(X, Y, size * 2.2, "#fff6c8", .12);
		d.dot(X, Y, size, "#fff6c8", .95);
		if (g.id === s.sel) d.circle(X, Y, .32, {
			stroke: "#5bd0ff",
			width: 1.6
		});
	}
	ctx.restore();
	d.text("luneta (clique numa gota para selecioná-la)", SC.cx, SC.cy - SC.R - .45, {
		size: 10,
		color: th.muted
	});
	d.text("linhas amarelas: 1,00 mm", SC.cx, SC.cy + SC.R + .45, {
		size: 10,
		color: th.muted
	});
	const run = s.timer ? t - s.timer.t0 : 0;
	[
		s.timer ? `cronômetro: ${fmt$3(run, 3)} s (${s.timer.dir < 0 ? "queda" : "subida"})` : "cronômetro parado",
		`t queda = ${s.tq > 0 ? fmt$3(s.tq, 4) + " s" : "—"}`,
		`t subida = ${s.ts > 0 ? fmt$3(s.ts, 4) + " s" : "—"}`
	].forEach((r, i) => d.text(r, 13.4, 11.6 - i * .55, {
		align: "left",
		size: 12,
		weight: i === 0 ? "600" : "400"
	}));
	const g = selected(s);
	if (g) {
		const Tc = T$1(p);
		d.text(`gota: v = ${fmt$3(drift(g.r, qOf(g), Efield(p), Tc) * 1e3)} mm/s,  C = ${fmt$3(cunningham(g.r))}`, 13.4, 11.6 - 3 * .55, {
			align: "left",
			size: 11,
			color: th.muted
		});
	}
}
function renderHistogram(d, th, s, p) {
	const NB = 90;
	const qmax = 9;
	const counts = new Array(NB).fill(0);
	for (const q of s.qs) {
		const i = Math.floor(q / E_CHARGE / qmax * NB);
		if (i >= 0 && i < NB) counts[i]++;
	}
	const peak = Math.max(4, ...counts);
	const P = panel$1(d, {
		x0: 13.4,
		y0: 1.2,
		x1: 19.6,
		y1: 8.4
	}, {
		min: 0,
		max: qmax
	}, {
		min: 0,
		max: peak * 1.1
	});
	P.frame({
		xlabel: "q / e",
		ylabel: "gotas",
		xticks: [
			0,
			1,
			2,
			3,
			4,
			5,
			6,
			7,
			8,
			9
		]
	});
	for (let n = 1; n <= 8; n++) P.line([[n, 0], [n, peak * 1.1]], {
		color: th.positive,
		dash: [3, 3],
		width: 1,
		alpha: .6
	});
	const w = qmax / NB;
	counts.forEach((c, i) => {
		if (!c) return;
		const xa = P.X(i * w);
		d.rect(xa, P.box.y0, P.X((i + 1) * w) - xa, P.Y(c) - P.box.y0, {
			fill: th.accent,
			alpha: .75
		});
	});
	const e = estimateE(s.qs);
	d.text(`N = ${s.qs.length}   e ≈ ${e > 0 ? fmt$3(e, 4) + " C" : "—"}   (${corr(p) ? "com" : "sem"} Cunningham)`, 13.4, 9.15, {
		align: "left",
		size: 11
	});
}
//#endregion
//#region sims/montanha-russa/src/track.ts
var SUB = 64;
var K_MAX = 40;
var cache = /* @__PURE__ */ new WeakMap();
/** Pista (com cache por referência do vetor de pontos, que é imutável no estado). */
function trackOf(pts) {
	let tr = cache.get(pts);
	if (!tr) {
		tr = buildTrack(pts);
		cache.set(pts, tr);
	}
	return tr;
}
function tangents(pts) {
	const n = pts.length;
	return pts.map((_, i) => {
		const a = pts[Math.max(0, i - 1)];
		const b = pts[Math.min(n - 1, i + 1)];
		if (i === 0 || i === n - 1) return [b[0] - a[0], b[1] - a[1]];
		const c = pts[i];
		const th = Math.abs(Math.atan2((c[0] - a[0]) * (b[1] - c[1]) - (c[1] - a[1]) * (b[0] - c[0]), (c[0] - a[0]) * (b[0] - c[0]) + (c[1] - a[1]) * (b[1] - c[1])));
		const f = th < 1e-6 ? 1 : Math.min(1.7, 4 * Math.tan(th / 4) / Math.sin(Math.min(th, 2)));
		return [(b[0] - a[0]) / 2 * f, (b[1] - a[1]) / 2 * f];
	});
}
/** Posição, primeira e segunda derivadas do segmento de Hermite em u ∈ [0, 1]. */
function hermite(p0, m0, p1, m1, u) {
	const u2 = u * u, u3 = u2 * u;
	const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
	const d00 = 6 * u2 - 6 * u, d10 = 3 * u2 - 4 * u + 1, d01 = -6 * u2 + 6 * u, d11 = 3 * u2 - 2 * u;
	const e00 = 12 * u - 6, e10 = 6 * u - 4, e01 = -12 * u + 6, e11 = 6 * u - 2;
	const comb = (a, b, c, d, k) => a * p0[k] + b * m0[k] + c * p1[k] + d * m1[k];
	return {
		x: comb(h00, h10, h01, h11, 0),
		y: comb(h00, h10, h01, h11, 1),
		dx: comb(d00, d10, d01, d11, 0),
		dy: comb(d00, d10, d01, d11, 1),
		ddx: comb(e00, e10, e01, e11, 0),
		ddy: comb(e00, e10, e01, e11, 1)
	};
}
function buildTrack(pts) {
	const n = pts.length;
	const m = tangents(pts);
	const N = (n - 1) * SUB + 1;
	const s = new Float64Array(N), x = new Float64Array(N), y = new Float64Array(N);
	const cos = new Float64Array(N), sin = new Float64Array(N), k = new Float64Array(N);
	let idx = 0;
	let acc = 0;
	for (let i = 0; i < n - 1; i++) {
		const p0 = pts[i], p1 = pts[i + 1], m0 = m[i], m1 = m[i + 1];
		for (let j = i === 0 ? 0 : 1; j <= SUB; j++) {
			const u = j / SUB;
			if (j > 0) {
				const ua = (j - 1) / SUB, um = (j - .5) / SUB;
				const sp = (q) => {
					const h = hermite(p0, m0, p1, m1, q);
					return Math.hypot(h.dx, h.dy);
				};
				acc += (sp(ua) + 4 * sp(um) + sp(u)) / 6 * (1 / SUB);
			}
			const h = hermite(p0, m0, p1, m1, u);
			const sp = Math.hypot(h.dx, h.dy);
			s[idx] = acc;
			x[idx] = h.x;
			y[idx] = h.y;
			if (sp > 1e-9) {
				cos[idx] = h.dx / sp;
				sin[idx] = h.dy / sp;
				k[idx] = Math.max(-40, Math.min(K_MAX, (h.dx * h.ddy - h.dy * h.ddx) / sp ** 3));
			} else {
				const c = Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) || 1;
				cos[idx] = (p1[0] - p0[0]) / c;
				sin[idx] = (p1[1] - p0[1]) / c;
				k[idx] = 0;
			}
			idx++;
		}
	}
	return {
		L: acc,
		s,
		x,
		y,
		cos,
		sin,
		k
	};
}
/** Índice i com s[i] ≤ s < s[i+1] (busca binária). */
function nodeIndex(tr, s) {
	let lo = 0, hi = tr.s.length - 1;
	if (s <= 0) return 0;
	if (s >= tr.L) return hi - 1;
	while (hi - lo > 1) {
		const mid = lo + hi >> 1;
		if (tr.s[mid] <= s) lo = mid;
		else hi = mid;
	}
	return lo;
}
/** Ponto da pista na coordenada de arco s (fora de [0, L] é preso às pontas). */
function at(tr, sRaw) {
	const s = Math.max(0, Math.min(tr.L, sRaw));
	const i = nodeIndex(tr, s);
	const h = tr.s[i + 1] - tr.s[i];
	if (!(h > 0)) return {
		x: tr.x[i],
		y: tr.y[i],
		cos: tr.cos[i],
		sin: tr.sin[i],
		k: tr.k[i]
	};
	const u = (s - tr.s[i]) / h;
	const u2 = u * u, u3 = u2 * u;
	const h00 = 2 * u3 - 3 * u2 + 1, h10 = u3 - 2 * u2 + u, h01 = -2 * u3 + 3 * u2, h11 = u3 - u2;
	const d00 = (6 * u2 - 6 * u) / h, d10 = 3 * u2 - 4 * u + 1, d01 = (-6 * u2 + 6 * u) / h, d11 = 3 * u2 - 2 * u;
	const c0 = tr.cos[i], c1 = tr.cos[i + 1], s0 = tr.sin[i], s1 = tr.sin[i + 1];
	return {
		x: h00 * tr.x[i] + h10 * h * c0 + h01 * tr.x[i + 1] + h11 * h * c1,
		y: h00 * tr.y[i] + h10 * h * s0 + h01 * tr.y[i + 1] + h11 * h * s1,
		cos: d00 * tr.x[i] + d10 * c0 + d01 * tr.x[i + 1] + d11 * c1,
		sin: d00 * tr.y[i] + d10 * s0 + d01 * tr.y[i + 1] + d11 * s1,
		k: tr.k[i] + u * (tr.k[i + 1] - tr.k[i])
	};
}
/** Coordenada de arco do ponto da pista mais próximo de (px, py) e a distância até ele. */
function closest(tr, px, py) {
	let best = 0, bd = Infinity;
	for (let i = 0; i < tr.s.length; i++) {
		const d = Math.hypot(tr.x[i] - px, tr.y[i] - py);
		if (d < bd) {
			bd = d;
			best = i;
		}
	}
	return {
		s: tr.s[best],
		d: bd
	};
}
/** Primeiro s (a partir do início da pista) em que a altura fica ≤ h. */
function firstAtHeight(tr, h) {
	if (tr.y[0] <= h) return 0;
	for (let i = 1; i < tr.s.length; i++) if (tr.y[i] <= h) {
		const y0 = tr.y[i - 1], y1 = tr.y[i];
		const f = (y0 - h) / (y0 - y1);
		return tr.s[i - 1] + f * (tr.s[i] - tr.s[i - 1]);
	}
	return 0;
}
/**
* Pontos de retorno: os s mais próximos de s0, um de cada lado, onde a altura
* atinge hE = E/(mg). `null` quando a pista não chega a essa altura daquele
* lado (o carrinho alcança o para-choque).
*/
function turningPoints(tr, s0, hE) {
	const i0 = nodeIndex(tr, s0);
	let left = null, right = null;
	for (let i = i0; i >= 0; i--) if (tr.y[i] >= hE) {
		const j = i + 1;
		const y0 = tr.y[i], y1 = tr.y[j];
		left = y0 === y1 ? tr.s[i] : tr.s[i] + (y0 - hE) / (y0 - y1) * (tr.s[j] - tr.s[i]);
		left = Math.min(left, s0);
		break;
	}
	for (let i = i0 + 1; i < tr.s.length; i++) if (tr.y[i] >= hE) {
		const j = i - 1;
		const y0 = tr.y[j], y1 = tr.y[i];
		right = y0 === y1 ? tr.s[i] : tr.s[j] + (hE - y0) / (y1 - y0) * (tr.s[i] - tr.s[j]);
		right = Math.max(right, s0);
		break;
	}
	return [left, right];
}
/** Pistas prontas. */
var PRESETS$1 = [
	[
		[-9.5, 8],
		[-8.6, 5],
		[-7, 2.2],
		[-4.5, .5],
		[0, .2],
		[4.5, .5],
		[7, 2.2],
		[8.6, 5],
		[9.5, 8]
	],
	[
		[-9.6, 8],
		[-8.3, 6],
		[-6, 1.8],
		[-3.2, .4],
		[-.35, .4],
		[1.13, .87],
		[1.6, 2],
		[1.13, 3.13],
		[0, 3.6],
		[-1.13, 3.13],
		[-1.6, 2],
		[-1.13, .87],
		[.35, .4],
		[3.2, .7],
		[5.5, 3.6],
		[7.5, 2.2],
		[9.6, 6.5]
	],
	[
		[-9.5, 8],
		[-8, 4],
		[-6, 1.2],
		[-4, .4],
		[-2, 1.6],
		[0, 3.8],
		[2, 1.6],
		[4, .4],
		[6, 1.2],
		[8, 4],
		[9.5, 8]
	]
];
//#endregion
//#region sims/montanha-russa/src/index.ts
/** Região onde a pista pode ser desenhada (m). */
var AREA = {
	x0: -10,
	x1: 10,
	y0: 0,
	y1: 9
};
/** Painel do gráfico U(s) no palco. */
var GR$1 = {
	x0: -10,
	x1: 10,
	y0: -7.3,
	y1: -2.2
};
/** Barras de energia. */
var BAR = {
	x0: 10.75,
	w: .55,
	gap: .22
};
var GRAB = .45;
var CAR_H = .28;
var G$1 = (p) => num(p, "g", 9.81);
var M = (p) => num(p, "m", 60);
var MU = (p) => num(p, "mu", 0);
/** Dinâmica na pista: m dv/dt = −mg sen φ − μ|N| sinal(v), N = m(g cos φ + v²κ). */
function dynamics(tr, s, v, p) {
	const g = G$1(p), m = M(p), mu = MU(p);
	const q = at(tr, s);
	const n = g * q.cos + v * v * q.k;
	let a;
	if (v !== 0) a = -g * q.sin - mu * Math.abs(n) * Math.sign(v);
	else {
		const drive = -g * q.sin;
		const lim = mu * Math.abs(n);
		a = Math.abs(drive) <= lim ? 0 : drive - Math.sign(drive) * lim;
	}
	return {
		a,
		N: m * n,
		qdot: m * mu * Math.abs(n) * Math.abs(v)
	};
}
var sticks = (tr, s, p) => {
	const q = at(tr, s);
	return Math.abs(q.sin) <= MU(p) * Math.abs(q.cos);
};
function integrate(tr, y, p, t, dt) {
	const f = (z) => {
		const d = dynamics(tr, z[0], z[1], p);
		return [
			z[1],
			d.a,
			d.qdot
		];
	};
	return rk4$1(f, y, p, t, dt);
}
var K$1 = (s, p) => .5 * M(p) * s.v * s.v;
var U = (s, p) => M(p) * G$1(p) * at(trackOf(s.pts), s.s).y;
/** Estado inicial na pista `pts`, partindo do repouso (ou com v0) na altura h0. */
function startOn(pts, p) {
	return {
		pts,
		s: firstAtHeight(trackOf(pts), num(p, "h0", 7)),
		v: num(p, "v0"),
		q: 0,
		drag: null
	};
}
function clampPt(x, y) {
	return [Math.max(AREA.x0, Math.min(AREA.x1, x)), Math.max(AREA.y0 + .1, Math.min(AREA.y1, y))];
}
function nearestPoint(s, x, y) {
	let best = null, bd = GRAB;
	s.pts.forEach(([px, py], i) => {
		const d = Math.hypot(px - x, py - y);
		if (d < bd) {
			bd = d;
			best = i;
		}
	});
	return best;
}
var montanhaRussa = defineSim({
	id: "montanha-russa",
	title: "Pista de skate e montanha-russa: energia",
	course: "FG I",
	topic: "Energia",
	priority: "P1",
	summary: "Um carrinho preso a uma pista que você desenha arrastando os pontos de controle. Acompanhe as barras de energia cinética, potencial e térmica e o gráfico U(s) com os pontos de retorno.",
	equations: [
		String.raw`K + U + E_{\text{térm}} = \text{constante} \qquad K = \tfrac12 m v^2 \qquad U = m g\,y(s)`,
		String.raw`m\frac{dv}{ds}\,v = -m g \sin\varphi - \mu |N|\,\operatorname{sinal}(v)`,
		String.raw`N = m\left(g\cos\varphi + v^2\kappa\right) \qquad \frac{dE_{\text{térm}}}{dt} = \mu |N|\,|v|`,
		String.raw`\text{retorno: } U(s_r) = K + U \;\Rightarrow\; v(s_r) = 0`
	],
	liveEquations(s, p) {
		const k = K$1(s, p), u = U(s, p);
		const tr = trackOf(s.pts);
		const d = dynamics(tr, s.s, s.v, p);
		return [String.raw`K + U + E_{\text{térm}} = ${texNum(k)} + ${texNum(u)} + ${texNum(s.q)} = ${texNum(k + u + s.q)}\ \text{J}`, String.raw`v = ${texNum(s.v)}\ \text{m/s} \qquad y = ${texNum(at(tr, s.s).y)}\ \text{m} \qquad N = ${texNum(d.N)}\ \text{N}`];
	},
	params: [
		{
			key: "pista",
			label: "Pista pronta",
			unit: "",
			min: 0,
			max: 2,
			step: 1,
			default: 0,
			options: [
				{
					value: 0,
					label: "Meia-pipe"
				},
				{
					value: 1,
					label: "Montanha-russa com loop"
				},
				{
					value: 2,
					label: "Rampa dupla (dois vales)"
				}
			]
		},
		{
			key: "h0",
			label: "Altura de partida",
			unit: "m",
			min: .5,
			max: 8,
			step: .1,
			default: 6
		},
		{
			key: "v0",
			label: "Velocidade inicial",
			unit: "m/s",
			min: -10,
			max: 10,
			step: .1,
			default: 0
		},
		{
			key: "m",
			label: "Massa (carrinho + pessoa)",
			unit: "kg",
			min: 10,
			max: 200,
			step: 1,
			default: 60,
			live: true
		},
		{
			key: "mu",
			label: "Coeficiente de atrito μ",
			unit: "",
			min: 0,
			max: .3,
			step: .005,
			default: 0,
			live: true
		},
		{
			key: "g",
			label: "Gravidade",
			unit: "m/s²",
			min: 1.62,
			max: 24.79,
			step: .01,
			default: 9.81,
			live: true,
			options: [
				{
					value: 9.81,
					label: "Terra (9,81 m/s²)"
				},
				{
					value: 1.62,
					label: "Lua (1,62 m/s²)"
				},
				{
					value: 3.71,
					label: "Marte (3,71 m/s²)"
				},
				{
					value: 24.79,
					label: "Júpiter (24,79 m/s²)"
				}
			]
		}
	],
	observables: [
		{
			key: "s",
			label: "Posição ao longo da pista s",
			unit: "m",
			value: (s) => s.s
		},
		{
			key: "y",
			label: "Altura y",
			unit: "m",
			value: (s) => at(trackOf(s.pts), s.s).y
		},
		{
			key: "v",
			label: "Velocidade v",
			unit: "m/s",
			value: (s) => s.v
		},
		{
			key: "K",
			label: "Energia cinética K",
			unit: "J",
			value: K$1
		},
		{
			key: "U",
			label: "Energia potencial U",
			unit: "J",
			value: U
		},
		{
			key: "Q",
			label: "Energia térmica (atrito)",
			unit: "J",
			value: (s) => s.q
		},
		{
			key: "Em",
			label: "Energia mecânica K + U",
			unit: "J",
			value: (s, p) => K$1(s, p) + U(s, p)
		},
		{
			key: "E",
			label: "Energia total K + U + térmica",
			unit: "J",
			value: (s, p) => K$1(s, p) + U(s, p) + s.q
		},
		{
			key: "N",
			label: "Força normal N",
			unit: "N",
			value: (s, p) => dynamics(trackOf(s.pts), s.s, s.v, p).N
		},
		{
			key: "at",
			label: "Aceleração tangencial",
			unit: "m/s²",
			value: (s, p) => dynamics(trackOf(s.pts), s.s, s.v, p).a
		}
	],
	conserved: "E",
	chart: {
		x: "t",
		y: "v"
	},
	scenarios: [
		{
			id: "meia-pipe",
			label: "Meia-pipe sem atrito",
			params: {
				pista: 0,
				h0: 6,
				v0: 0,
				mu: 0
			},
			guide: `### Sobe até a mesma altura
1. Antes de rodar, olhe o gráfico $U(s)$ embaixo: a linha tracejada é a energia mecânica $E = K + U$.
2. Os pontos de retorno estão onde $U(s) = E$: ali $K = 0$ e o carrinho para por um instante.
3. Rode e confira: as barras trocam $K$ por $U$, mas a soma não muda.
4. Arraste um ponto de controle do lado direito e deixe a rampa mais suave ou mais íngreme. A altura máxima muda?`,
			predict: [{
				question: "Solto do repouso a 6 m de altura no lado esquerdo da meia-pipe sem atrito, até que altura o carrinho sobe do lado direito?",
				options: [
					"menos de 6 m, porque perde velocidade na subida",
					"exatamente 6 m",
					"mais de 6 m, porque ganha impulso no fundo"
				],
				answer: 1,
				explanation: "Sem atrito, $K + U$ se conserva. No ponto de retorno $K = 0$, então $U = mgh$ volta ao valor inicial: a mesma altura, qualquer que seja a forma da pista."
			}]
		},
		{
			id: "atrito",
			label: "Meia-pipe com atrito",
			params: {
				pista: 0,
				h0: 7,
				v0: 0,
				mu: .05
			},
			guide: `### Para onde vai a energia?
1. Rode e observe a barra de energia térmica crescer enquanto $K + U$ diminui.
2. No gráfico $U(s)$, a linha de energia desce e os pontos de retorno se aproximam do fundo.
3. Repare que o atrito tira mais energia no fundo: lá a normal é maior, $N = m(g\\cos\\varphi + v^2\\kappa)$.
4. A soma $K + U + E_{\\text{térm}}$ continua constante: é o que o medidor de conservação mostra.`
		},
		{
			id: "loop",
			label: "Loop",
			params: {
				pista: 1,
				h0: 7.5,
				v0: 0,
				mu: 0
			},
			guide: `### A normal no alto do loop
1. Rode e acompanhe a força normal $N$ (seta verde) dentro do loop.
2. No alto, $N = m(v^2/R - g)$. Se $v^2 < gR$, a pista precisaria **puxar** o carrinho: $N < 0$. É por isso que montanhas-russas têm rodas presas por baixo do trilho.
3. Diminua a altura de partida até a normal no alto ficar negativa. Compare com a previsão: o fundo do loop está a $0{,}4$ m e o raio é $R \\approx 1{,}6$ m, então $h_0 \\approx 0{,}4 + 2{,}5R = 4{,}4$ m.`,
			predict: [{
				question: "Um carrinho solto sem atrito de uma altura h acima do fundo de um loop de raio R só completa o loop sem ajuda do trilho se:",
				options: [
					"h ≥ 2R",
					"h ≥ 2,5R",
					"h ≥ 3R"
				],
				answer: 1,
				explanation: "No alto é preciso $v^2 \\ge gR$. Pela conservação, $mg h = mg\\,2R + \\tfrac12 m v^2 \\ge mg\\,2R + \\tfrac12 mgR$, logo $h \\ge 2{,}5R$."
			}]
		},
		{
			id: "dois-vales",
			label: "Barreira de potencial",
			params: {
				pista: 2,
				h0: 3.2,
				v0: 0,
				mu: 0
			},
			guide: `### Preso num vale
1. A lombada no meio é uma **barreira de potencial**. Com $E$ menor que o topo dela, o carrinho fica preso no vale da esquerda.
2. Veja no gráfico $U(s)$ os dois pontos de retorno do mesmo lado da lombada.
3. Aumente a altura de partida até o carrinho passar para o outro vale. Qual é a altura mínima?`,
			predict: [{
				question: "Solto do repouso a 3,2 m de altura, sem atrito, o carrinho passa pela lombada de 3,8 m?",
				options: [
					"sim, se a descida for íngreme o bastante",
					"não, nunca",
					"só se a massa for pequena"
				],
				answer: 1,
				explanation: "Para passar seria preciso $U = mg(3{,}8\\,\\text{m}) \\le E = mg(3{,}2\\,\\text{m})$. Isso não depende da forma da descida nem da massa."
			}]
		}
	],
	exercises: [{
		id: "velocidade",
		prompt: "Um skatista parte do repouso a {h} m de altura numa pista sem atrito. Qual é a sua velocidade quando passa por um ponto a {y} m de altura (g = 9,81 m/s²)?",
		vary: {
			h: [
				3,
				8,
				1
			],
			y: [
				0,
				2.5,
				1
			]
		},
		answer: {
			label: "v",
			unit: "m/s",
			compute: (p) => Math.sqrt(19.62 * (num(p, "h") - num(p, "y")))
		},
		hint: "Iguale a energia mecânica nos dois pontos: mgh = mgy + ½mv²."
	}, {
		id: "termica",
		prompt: "Um carrinho de {m} kg parte do repouso a {h} m de altura e, depois de algumas idas e vindas numa pista com atrito, sobe no máximo até {y} m. Quanta energia virou térmica até esse ponto de retorno (g = 9,81 m/s²)?",
		vary: {
			m: [
				20,
				120,
				0
			],
			h: [
				4,
				8,
				1
			],
			y: [
				1,
				3.5,
				1
			]
		},
		answer: {
			label: "E_térm",
			unit: "J",
			compute: (p) => num(p, "m") * 9.81 * (num(p, "h") - num(p, "y"))
		},
		hint: "No ponto de retorno K = 0: a energia térmica é a perda de energia potencial."
	}],
	init: (p) => startOn(PRESETS$1[Math.round(num(p, "pista"))] ?? PRESETS$1[0], p),
	step(st, p, t, dt) {
		const tr = trackOf(st.pts);
		const y0 = [
			st.s,
			st.v,
			st.q
		];
		let y = integrate(tr, y0, p, t, dt);
		if (y[0] < 0 || y[0] > tr.L) {
			const bound = y[0] < 0 ? 0 : tr.L;
			const tau = Math.max(0, Math.min(dt, dt * (bound - y0[0]) / (y[0] - y0[0])));
			y = integrate(tr, y0, p, t, tau);
			y[0] = bound;
			y[1] = -y[1];
			y = integrate(tr, y, p, t + tau, dt - tau);
			y[0] = Math.max(0, Math.min(tr.L, y[0]));
		}
		if (st.v !== 0 && st.v * y[1] <= 0 && sticks(tr, y[0], p)) y[1] = 0;
		return {
			...st,
			s: y[0],
			v: y[1],
			q: y[2]
		};
	},
	dt: .001,
	sampleEvery: 20,
	maxSamples: 6e3,
	pointer: {
		down(s, _p, pt) {
			const i = nearestPoint(s, pt.x, pt.y);
			if (i !== null) return {
				...s,
				drag: i
			};
			const c = closest(trackOf(s.pts), pt.x, pt.y);
			if (c.d < .5) return {
				...s,
				s: c.s,
				v: 0,
				q: 0
			};
		},
		move(s, _p, pt, dragging) {
			if (!dragging || s.drag === null) return void 0;
			const pts = s.pts.slice();
			pts[s.drag] = clampPt(pt.x, pt.y);
			const L0 = trackOf(s.pts).L;
			const L1 = trackOf(pts).L;
			return {
				...s,
				pts,
				s: L0 > 0 ? s.s / L0 * L1 : 0
			};
		},
		up: (s) => s.drag === null ? void 0 : {
			...s,
			drag: null
		},
		cursor(s, _p, pt) {
			if (nearestPoint(s, pt.x, pt.y) !== null) return "grab";
			return closest(trackOf(s.pts), pt.x, pt.y).d < .5 ? "pointer" : void 0;
		}
	},
	actions: [
		{
			id: "adicionar",
			label: "Adicionar ponto",
			run(s) {
				let best = 0, bl = -1;
				for (let i = 0; i < s.pts.length - 1; i++) {
					const l = Math.hypot(s.pts[i + 1][0] - s.pts[i][0], s.pts[i + 1][1] - s.pts[i][1]);
					if (l > bl) {
						bl = l;
						best = i;
					}
				}
				const a = s.pts[best], b = s.pts[best + 1];
				const pts = [
					...s.pts.slice(0, best + 1),
					clampPt((a[0] + b[0]) / 2, (a[1] + b[1]) / 2),
					...s.pts.slice(best + 1)
				];
				return {
					...s,
					pts,
					s: Math.min(s.s, trackOf(pts).L)
				};
			}
		},
		{
			id: "remover",
			label: "Remover ponto",
			run(s) {
				if (s.pts.length <= 3) return s;
				let best = 1, bd = Infinity;
				for (let i = 1; i < s.pts.length - 1; i++) {
					const a = s.pts[i - 1], b = s.pts[i], c = s.pts[i + 1];
					const d = Math.hypot(b[0] - (a[0] + c[0]) / 2, b[1] - (a[1] + c[1]) / 2);
					if (d < bd) {
						bd = d;
						best = i;
					}
				}
				const pts = s.pts.filter((_, i) => i !== best);
				return {
					...s,
					pts,
					s: Math.min(s.s, trackOf(pts).L)
				};
			}
		},
		{
			id: "soltar",
			label: "Soltar da altura inicial",
			run: (s, p) => ({ ...startOn(s.pts, p) })
		}
	],
	viewport: () => ({
		xMin: -10.4,
		xMax: 13.7,
		yMin: -8,
		yMax: 9.3
	}),
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: st, params: p, theme } = frame;
		const tr = trackOf(st.pts);
		const m = M(p), g = G$1(p);
		const here = at(tr, st.s);
		const dyn = dynamics(tr, st.s, st.v, p);
		const k = K$1(st, p), u = U(st, p);
		const hE = (k + u) / (m * g);
		const [sl, sr] = turningPoints(tr, st.s, hE);
		d.grid(AREA.x0, AREA.x1, AREA.y0, AREA.y1, 1);
		d.rect(AREA.x0, -.45, AREA.x1 - AREA.x0, .45, { fill: theme.ground });
		d.line(AREA.x0, 0, AREA.x1, 0, {
			color: theme.muted,
			width: 1
		});
		for (let yy = 0; yy <= 8; yy += 2) d.text(`${yy}`, AREA.x0 + .05, yy, {
			color: theme.muted,
			size: 10,
			align: "left",
			dy: -6
		});
		d.text("y (m)", AREA.x0 + .05, 8.85, {
			color: theme.muted,
			size: 10,
			align: "left"
		});
		if (hE < AREA.y1) {
			d.line(AREA.x0, hE, AREA.x1, hE, {
				color: theme.accent,
				dash: [6, 5],
				width: 1,
				alpha: .6
			});
			d.text("altura máxima possível E/mg", AREA.x1 - .1, hE, {
				color: theme.accent,
				size: 10,
				align: "right",
				dy: -8
			});
		}
		for (let i = 0; i < tr.s.length; i += 24) if (tr.cos[i] > .4 && tr.k[i] > -2) d.line(tr.x[i], tr.y[i], tr.x[i], 0, {
			color: theme.muted,
			width: 1,
			alpha: .35
		});
		const rail = [];
		for (let i = 0; i < tr.s.length; i++) rail.push([tr.x[i], tr.y[i]]);
		d.polyline(rail, {
			color: theme.text,
			width: 3.5
		});
		for (const sEnd of [0, tr.L]) {
			const e = at(tr, sEnd);
			d.line(e.x + e.sin * .35, e.y - e.cos * .15, e.x - e.sin * .6, e.y + e.cos * .6, {
				color: theme.negative,
				width: 4
			});
		}
		st.pts.forEach(([px, py], i) => {
			d.circle(px, py, 0, {
				minPx: 6,
				fill: theme.accent,
				alpha: st.drag === i ? .9 : .35
			});
			d.circle(px, py, 0, {
				minPx: 6,
				stroke: theme.accent,
				width: 1.5
			});
		});
		for (const sR of [sl, sr]) {
			if (sR === null) continue;
			const r = at(tr, sR);
			d.dot(r.x, r.y, 4, theme.accent);
		}
		const nx = -here.sin, ny = here.cos;
		const cx = here.x + nx * CAR_H, cy = here.y + ny * CAR_H;
		const ang = Math.atan2(here.sin, here.cos);
		d.box(cx, cy, .9, .42, ang, {
			fill: theme.series[4] ?? theme.accent,
			stroke: theme.text,
			width: 1
		});
		for (const w of [-.28, .28]) d.circle(here.x + here.cos * w + nx * .08, here.y + here.sin * w + ny * .08, .09, { fill: theme.text });
		if (Math.abs(st.v) > .001) {
			d.arrowPx(cx, cy, here.cos * st.v, here.sin * st.v, Math.min(120, 8 * Math.abs(st.v)), { color: theme.accent });
			d.text("v", cx + here.cos * Math.sign(st.v) * .9, cy + here.sin * Math.sign(st.v) * .9 + .35, {
				color: theme.accent,
				size: 12,
				weight: "600"
			});
		}
		const fScale = 36 / (m * g);
		d.arrowPx(cx, cy, 0, -1, 36, { color: theme.text });
		d.text("P", cx + .3, cy - 36 * d.px - .1, {
			size: 12,
			weight: "600"
		});
		if (Math.abs(dyn.N) > 1e-6) {
			const lenN = Math.min(160, Math.abs(dyn.N) * fScale);
			const sg = Math.sign(dyn.N);
			d.arrowPx(cx, cy, nx * sg, ny * sg, lenN, { color: theme.series[2] });
			d.text("N", cx + nx * sg * (lenN * d.px + .25), cy + ny * sg * (lenN * d.px + .25), {
				color: theme.series[2],
				size: 12,
				weight: "600"
			});
		}
		if (dyn.N < 0) d.text("N < 0: o trilho precisa puxar o carrinho", 0, 8.75, {
			color: theme.positive,
			size: 12,
			weight: "600"
		});
		const bars = [
			[
				"K",
				k,
				theme.series[0]
			],
			[
				"U",
				u,
				theme.series[2]
			],
			[
				"Q",
				st.q,
				theme.positive
			]
		];
		const toH = (E) => Math.min(8.6, Math.max(0, E / (m * g)));
		bars.forEach(([lab, val, col], i) => {
			const x = BAR.x0 + i * (BAR.w + BAR.gap);
			d.rect(x, 0, BAR.w, toH(val), {
				fill: col,
				alpha: .85
			});
			d.text(lab, x + BAR.w / 2, -.25, {
				color: col,
				size: 12,
				weight: "600"
			});
		});
		const xt = BAR.x0 + 3 * (BAR.w + BAR.gap);
		let acc = 0;
		bars.forEach(([, val, col]) => {
			d.rect(xt, toH(acc), BAR.w, toH(acc + val) - toH(acc), {
				fill: col,
				alpha: .85
			});
			acc += val;
		});
		d.rect(xt, 0, BAR.w, toH(acc), {
			stroke: theme.text,
			width: 1
		});
		d.text("E", xt + BAR.w / 2, -.25, {
			size: 12,
			weight: "600"
		});
		d.text("Energia (J)", BAR.x0 + 1.45, 8.85, {
			color: theme.muted,
			size: 11
		});
		d.text(`E = ${(k + u + st.q).toFixed(0)} J`, BAR.x0 + 1.45, Math.min(8.3, toH(acc) + .35), { size: 11 });
		if (acc / (m * g) > 8.6) d.text("▲ fora da escala", BAR.x0 + 1.45, 7.8, {
			color: theme.muted,
			size: 10
		});
		const Hmax = 9;
		const gx = (s) => GR$1.x0 + s / Math.max(tr.L, 1e-9) * (GR$1.x1 - GR$1.x0);
		const gy = (h) => GR$1.y0 + Math.max(0, Math.min(Hmax, h)) / Hmax * (GR$1.y1 - GR$1.y0);
		d.rect(GR$1.x0, GR$1.y0, GR$1.x1 - GR$1.x0, GR$1.y1 - GR$1.y0, {
			stroke: theme.grid,
			width: 1
		});
		const curve = [];
		for (let i = 0; i < tr.s.length; i += 2) curve.push([gx(tr.s[i]), gy(tr.y[i])]);
		for (let i = 0; i < tr.s.length - 2; i += 2) if (tr.y[i] > hE && hE < Hmax) {
			const x0 = gx(tr.s[i]), x1 = gx(tr.s[Math.min(tr.s.length - 1, i + 2)]);
			d.rect(x0, gy(hE), x1 - x0, gy(tr.y[i]) - gy(hE), {
				fill: theme.muted,
				alpha: .18
			});
		}
		d.polyline(curve, {
			color: theme.series[2],
			width: 2
		});
		if (hE <= Hmax) {
			d.line(GR$1.x0, gy(hE), GR$1.x1, gy(hE), {
				color: theme.accent,
				dash: [6, 4],
				width: 1.5
			});
			d.text("E = K + U", GR$1.x1 + .15, gy(hE), {
				color: theme.accent,
				size: 11,
				align: "left"
			});
		} else d.text("E acima da escala: sem pontos de retorno", GR$1.x1 - .1, GR$1.y1 - .3, {
			color: theme.accent,
			size: 11,
			align: "right"
		});
		for (const sR of [sl, sr]) {
			if (sR === null) continue;
			d.line(gx(sR), GR$1.y0, gx(sR), gy(hE), {
				color: theme.accent,
				dash: [3, 3],
				width: 1
			});
			d.dot(gx(sR), gy(hE), 4.5, theme.accent);
			d.text("retorno", gx(sR), gy(hE), {
				color: theme.accent,
				size: 10,
				dy: -10
			});
		}
		const xc = gx(st.s);
		d.dot(xc, gy(here.y), 5, theme.series[4] ?? theme.accent);
		if (hE <= Hmax && gy(hE) - gy(here.y) > .25) {
			d.arrow(xc, gy(here.y), 0, gy(hE) - gy(here.y), {
				color: theme.series[0],
				width: 1.5,
				head: 6
			});
			d.text("K", xc + .25, (gy(hE) + gy(here.y)) / 2, {
				color: theme.series[0],
				size: 11,
				weight: "600",
				align: "left"
			});
		}
		d.text("U(s) = mg·y(s): energia potencial ao longo da pista", GR$1.x0 + .1, GR$1.y1 + .3, {
			color: theme.muted,
			size: 11,
			align: "left"
		});
		d.text("0", GR$1.x0, GR$1.y0 - .3, {
			color: theme.muted,
			size: 10
		});
		d.text(`s = ${tr.L.toFixed(1).replace(".", ",")} m`, GR$1.x1, GR$1.y0 - .3, {
			color: theme.muted,
			size: 10,
			align: "right"
		});
		d.text("s (m)", (GR$1.x0 + GR$1.x1) / 2, GR$1.y0 - .3, {
			color: theme.muted,
			size: 10
		});
		d.text(`${(m * g * Hmax).toFixed(0)} J`, GR$1.x1 + .15, GR$1.y1 - .1, {
			color: theme.muted,
			size: 10,
			align: "left"
		});
		d.text("0 J", GR$1.x1 + .15, GR$1.y0 + .1, {
			color: theme.muted,
			size: 10,
			align: "left"
		});
		d.text("Arraste os pontos azuis para mudar a pista; clique no trilho para soltar o carrinho ali.", AREA.x0, -.95, {
			color: theme.muted,
			size: 11,
			align: "left"
		});
	}
});
/** Amostras de resistência desconhecida: valor nominal (código de cores) e valor verdadeiro, escondido do aluno. */
var AMOSTRAS = [
	{
		nome: "A",
		nominal: 330,
		real: 327.4
	},
	{
		nome: "B",
		nominal: 1e3,
		real: 1013
	},
	{
		nome: "C",
		nominal: 4700,
		real: 4652
	},
	{
		nome: "D",
		nominal: 47,
		real: 47.83
	},
	{
		nome: "E",
		nominal: 2200,
		real: 2186
	},
	{
		nome: "F",
		nominal: 1e4,
		real: 9890
	}
];
var amostra = (p) => AMOSTRAS[Math.min(AMOSTRAS.length - 1, Math.max(0, Math.round(num(p, "rx"))))];
var Rx = (p) => amostra(p).real;
var kirchhoff = (p) => Math.round(num(p, "modo")) === 1;
var E = (p) => num(p, "E", 6);
var R1 = (p) => num(p, "R1", 1e3);
var R2 = (p) => num(p, "R2", 1e3);
var R3 = (p) => Math.max(1, num(p, "R3", 1e3));
var R4 = (p) => num(p, "R4", 470);
var E2 = (p) => num(p, "E2", 4.5);
/** Resistência interna da fonte da ponte (Ω). */
var R_FONTE = .5;
var I_DIV = 1e-6;
/** Com shunt (Rg/99 em paralelo), só 1 % da corrente passa pela bobina. */
var shunted = (p) => Math.round(num(p, "sens")) === 0;
var galvR = (p) => shunted(p) ? 1 : 100;
/** Corrente no ramo do galvanômetro que dá uma divisão de deflexão. */
var ampsPerDiv = (p) => shunted(p) ? 100 * I_DIV : I_DIV;
/** Ponteiro: frequência natural (rad/s) e amortecimento. */
var W0 = 2 * Math.PI * 1.2;
var ZETA = .65;
function solveBridge(p, keyClosed) {
	const els = [
		{
			kind: "V",
			a: 1,
			b: 0,
			V: E(p),
			R: R_FONTE
		},
		{
			kind: "R",
			a: 1,
			b: 2,
			R: R1(p)
		},
		{
			kind: "R",
			a: 2,
			b: 0,
			R: R2(p)
		},
		{
			kind: "R",
			a: 1,
			b: 3,
			R: R3(p)
		},
		{
			kind: "R",
			a: 3,
			b: 0,
			R: Rx(p)
		}
	];
	if (keyClosed) els.push({
		kind: "R",
		a: 2,
		b: 3,
		R: galvR(p)
	});
	const s = solveCircuit(4, els);
	return {
		Ig: keyClosed ? s.i[5] : 0,
		Va: s.v[1],
		Vb: s.v[2],
		Vd: s.v[3],
		If: -s.i[0],
		i1: s.i[1],
		i2: s.i[2],
		i3: s.i[3],
		ix: s.i[4]
	};
}
function solveKirchhoff(p) {
	const s = solveCircuit(5, [
		{
			kind: "V",
			a: 1,
			b: 0,
			V: E(p)
		},
		{
			kind: "R",
			a: 1,
			b: 2,
			R: R1(p)
		},
		{
			kind: "R",
			a: 2,
			b: 0,
			R: R3(p)
		},
		{
			kind: "R",
			a: 2,
			b: 3,
			R: R4(p)
		},
		{
			kind: "R",
			a: 3,
			b: 4,
			R: R2(p)
		},
		{
			kind: "V",
			a: 4,
			b: 0,
			V: E2(p)
		}
	]);
	const I1 = s.i[1];
	const I3 = s.i[2];
	const I2 = -s.i[3];
	return {
		I1,
		I2,
		I3,
		Vb: s.v[2],
		Vc: s.v[3],
		no: I1 + I2 - I3,
		m1: E(p) - R1(p) * I1 - R3(p) * I3,
		m2: E2(p) - (R2(p) + R4(p)) * I2 - R3(p) * I3
	};
}
var memo = /* @__PURE__ */ new WeakMap();
function bridge(s, p) {
	const key = s[3] > .5;
	const m = memo.get(s);
	if (m && m.p === p && m.key === key) return m.b;
	const b = solveBridge(p, key);
	memo.set(s, {
		p,
		key,
		b
	});
	return b;
}
/** Deflexão de equilíbrio do ponteiro (div), limitada pelos batentes. */
function targetDefl(p, Ig) {
	return Math.max(-32, Math.min(32, Ig / ampsPerDiv(p)));
}
function init$1(p) {
	const s = [
		0,
		0,
		0,
		1
	];
	if (!kirchhoff(p)) s[1] = Math.max(-30, Math.min(30, targetDefl(p, solveBridge(p, true).Ig)));
	return s;
}
function step$1(s, p, dt) {
	const out = s.slice();
	out[0] = s[0] + dt;
	const target = kirchhoff(p) ? 0 : targetDefl(p, bridge(s, p).Ig);
	let th = s[1];
	let om = s[2];
	const n = 8;
	const h = dt / n;
	for (let k = 0; k < n; k++) {
		om += h * (W0 * W0 * (target - th) - 2 * ZETA * W0 * om);
		th += h * om;
		if (Math.abs(th) > 30) {
			th = Math.sign(th) * 30;
			om = 0;
		}
	}
	out[1] = th;
	out[2] = om;
	return out;
}
//#endregion
//#region sims/ponte-wheatstone/src/bancada.ts
/** Formata com prefixo SI e vírgula decimal ("4,7 kΩ", "100 µF"). */
function si$1(v, unit, digits = 3) {
	if (!Number.isFinite(v)) return `— ${unit}`;
	if (v === 0) return `0 ${unit}`;
	const prefixes = [
		[1e9, "G"],
		[1e6, "M"],
		[1e3, "k"],
		[1, ""],
		[.001, "m"],
		[1e-6, "µ"],
		[1e-9, "n"],
		[1e-12, "p"]
	];
	const a = Math.abs(v);
	const [f, pre] = prefixes.find(([f]) => a >= f * .9995) ?? prefixes[prefixes.length - 1];
	return `${Number((v / f).toPrecision(digits)).toString().replace(".", ",")} ${pre}${unit}`;
}
/** Número com vírgula decimal e `digits` algarismos significativos. */
function br(v, digits = 3) {
	if (!Number.isFinite(v)) return "—";
	return Number(v.toPrecision(digits)).toString().replace(".", ",");
}
/** Cores fixas de bancada (cabos, mostradores), ajustadas ao tema. */
function palette(theme) {
	const dark = theme.dark;
	return {
		red: dark ? "#ff5c50" : "#d42a1f",
		black: dark ? "#9aa1ab" : "#26292e",
		yellow: dark ? "#f2cf3d" : "#c99a00",
		blue: dark ? "#53b7ff" : "#1769c4",
		green: dark ? "#58d68d" : "#1e8a4c",
		panel: dark ? "#2a3038" : "#dde1e6",
		panel2: dark ? "#353c46" : "#c9ced6",
		dmmBody: dark ? "#a8861e" : "#e9b824",
		dmmFace: dark ? "#2b2f35" : "#3a3f46",
		lcdBg: dark ? "#3c4a33" : "#c3d1b1",
		lcdSeg: dark ? "#e8f8d6" : "#141a0e",
		ledBg: "#1b0b0b",
		ledSeg: "#ff4b3a",
		screen: "#0d1813",
		screenGrid: "rgba(190, 220, 200, 0.22)",
		screenAxis: "rgba(190, 220, 200, 0.5)",
		ch1: "#f5d742",
		ch2: "#3fd0f0",
		board: dark ? "#c7cbd0" : "#f3f2ec",
		boardHole: dark ? "#8b9097" : "#a9aaa4",
		copper: dark ? "#d9925a" : "#b8692f",
		resistorBody: "#d8b98a"
	};
}
var SEGS = {
	"0": "abcdef",
	"1": "bc",
	"2": "abged",
	"3": "abgcd",
	"4": "fgbc",
	"5": "afgcd",
	"6": "afgedc",
	"7": "abc",
	"8": "abcdefg",
	"9": "abcdfg",
	"-": "g",
	O: "abcdef",
	L: "fed",
	E: "afged",
	r: "eg",
	n: "ceg",
	H: "bcefg",
	A: "abcefg",
	C: "afed",
	d: "bcdeg",
	u: "cde",
	P: "abefg",
	F: "aefg",
	o: "cdeg",
	h: "cefg",
	" ": ""
};
/**
* Escreve `text` em 7 segmentos, alinhado à direita em (xRight, yBase).
* `h` é a altura do dígito em unidades do mundo. Pontos e vírgulas acendem o
* ponto decimal do dígito anterior. Segmentos apagados aparecem bem fracos,
* como num LCD real.
*/
function sevenSeg(d, text, xRight, yBase, h, color, slots) {
	const chars = [];
	for (const ch of text) if ((ch === "." || ch === ",") && chars.length) chars[chars.length - 1].dp = true;
	else chars.push({
		c: ch,
		dp: false
	});
	const n = Math.max(slots ?? chars.length, chars.length);
	while (chars.length < n) chars.unshift({
		c: " ",
		dp: false
	});
	const w = .52 * h;
	const pitch = w * 1.42;
	const th = Math.max(1.2, .12 * h / d.px);
	const sl = .1 * h;
	for (let i = 0; i < n; i++) {
		const { c, dp } = chars[i];
		const x0 = xRight - (n - i) * pitch + .18 * w;
		const on = SEGS[c] ?? "";
		const pts = {
			a: [[x0 + sl, yBase + h], [x0 + w + sl, yBase + h]],
			b: [[x0 + w + sl, yBase + h], [x0 + w + sl / 2, yBase + h / 2]],
			c: [[x0 + w + sl / 2, yBase + h / 2], [x0 + w, yBase]],
			d: [[x0, yBase], [x0 + w, yBase]],
			e: [[x0 + sl / 2, yBase + h / 2], [x0, yBase]],
			f: [[x0 + sl, yBase + h], [x0 + sl / 2, yBase + h / 2]],
			g: [[x0 + sl / 2, yBase + h / 2], [x0 + w + sl / 2, yBase + h / 2]]
		};
		const gap = .07 * h;
		for (const k of "abcdefg") {
			const [p, q] = pts[k];
			const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
			const ux = (q[0] - p[0]) / L;
			const uy = (q[1] - p[1]) / L;
			d.line(p[0] + ux * gap, p[1] + uy * gap, q[0] - ux * gap, q[1] - uy * gap, {
				color,
				width: th,
				alpha: on.includes(k) ? 1 : .07
			});
		}
		d.dot(x0 + w + .22 * w, yBase + .02 * h, .7 * th / 1, color, dp ? 1 : .07);
	}
	return n * pitch;
}
/** Borne (jack) colorido. */
function jack(d, x, y, color, label, labelColor) {
	d.circle(x, y, 7 * d.px, {
		fill: color,
		stroke: "#111",
		width: 1
	});
	d.circle(x, y, 3 * d.px, { fill: "#111" });
	if (label) d.text(label, x, y - 13 * d.px, {
		size: 9,
		color: labelColor ?? color,
		weight: "600"
	});
}
/** Cabo flexível entre dois pontos, com uma barriga para baixo (curva de Bézier quadrática). */
function cable(d, a, b, color, sag = .6, width = 3) {
	const mx = (a[0] + b[0]) / 2;
	const my = Math.min(a[1], b[1]) - sag;
	const pts = [];
	for (let i = 0; i <= 24; i++) {
		const t = i / 24;
		const u = 1 - t;
		pts.push([u * u * a[0] + 2 * u * t * mx + t * t * b[0], u * u * a[1] + 2 * u * t * my + t * t * b[1]]);
	}
	d.polyline(pts, {
		color,
		width
	});
	d.dot(a[0], a[1], width * .9, color);
	d.dot(b[0], b[1], width * .9, color);
}
/** Painel genérico de instrumento (fonte, gerador, osciloscópio). */
function panel(d, theme, x, y, w, h, title) {
	const c = palette(theme);
	d.rect(x, y, w, h, {
		fill: c.panel,
		stroke: theme.muted,
		width: 1.2
	});
	if (title) d.text(title, x + .2, y + h - .28, {
		align: "left",
		size: 10,
		weight: "700",
		color: theme.muted
	});
}
/** Mostrador de LEDs vermelhos (gerador de funções, fonte DC). */
function ledDisplay(d, theme, x, y, w, h, text, unit, slots = 5) {
	const c = palette(theme);
	d.rect(x, y, w, h, {
		fill: c.ledBg,
		stroke: "#000",
		width: 1
	});
	const dh = h * .55;
	sevenSeg(d, text, x + w - .75, y + (h - dh) / 2, dh, c.ledSeg, slots);
	d.text(unit, x + w - .08, y + h / 2, {
		align: "right",
		size: 10,
		weight: "700",
		color: c.ledSeg
	});
}
/** Botão rotativo com marca; `frac` em [0, 1] gira de −135° a +135°. */
function knob(d, theme, x, y, r, frac, label) {
	d.circle(x, y, r, {
		fill: theme.dark ? "#15181c" : "#2c3036",
		stroke: "#000",
		width: 1
	});
	const a = Math.PI / 2 + .75 * Math.PI * (1 - 2 * Math.max(0, Math.min(1, frac)));
	d.line(x, y, x + .8 * r * Math.cos(a), y + .8 * r * Math.sin(a), {
		color: "#f0f0f0",
		width: 2.2
	});
	if (label) d.text(label, x, y - r - .22, {
		size: 9,
		color: theme.text
	});
}
var BAND = [
	"#000000",
	"#7b3f00",
	"#d40000",
	"#ff8c00",
	"#f2d000",
	"#119c2d",
	"#1f4fd8",
	"#7d2fb5",
	"#8a8a8a",
	"#ffffff"
];
/** Faixas do código de cores para um valor nominal (2 algarismos + multiplicador + tolerância dourada). */
function colorBands(R) {
	if (!(R > 0)) return [
		BAND[0],
		BAND[0],
		BAND[0],
		"#c9a227"
	];
	let e = Math.floor(Math.log10(R)) - 1;
	let m = Math.round(R / 10 ** e);
	if (m >= 100) {
		m = Math.round(m / 10);
		e += 1;
	}
	const d1 = Math.floor(m / 10);
	const d2 = m % 10;
	const mult = e < 0 ? "#c9a227" : BAND[Math.min(9, e)];
	return [
		BAND[d1],
		BAND[d2],
		mult,
		"#c9a227"
	];
}
/** Resistor de verdade (corpo bege com faixas), entre dois pontos, com terminais. */
function resistorBody(d, a, b, R, lenPx = 46) {
	const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const ux = (b[0] - a[0]) / L;
	const uy = (b[1] - a[1]) / L;
	const mx = (a[0] + b[0]) / 2;
	const my = (a[1] + b[1]) / 2;
	const half = Math.min(lenPx / 2 * d.px, L * .4);
	d.line(a[0], a[1], mx - ux * half, my - uy * half, {
		color: "#9b9b9b",
		width: 1.8
	});
	d.line(mx + ux * half, my + uy * half, b[0], b[1], {
		color: "#9b9b9b",
		width: 1.8
	});
	d.box(mx, my, 2 * half, 13 * d.px, Math.atan2(uy, ux), {
		fill: "#d8b98a",
		stroke: "#8a6c40",
		width: 1
	});
	colorBands(R).forEach((col, i) => {
		const t = -half * .62 + i * half * .36 + (i === 3 ? half * .18 : 0);
		d.box(mx + ux * t, my + uy * t, 3.5 * d.px, 13 * d.px, Math.atan2(uy, ux), { fill: col });
	});
}
/** Resistor em zigue-zague (símbolo) ocupando o trecho central de meio-comprimento `half`. */
function resistorSym(d, a, b, half, color, width = 2) {
	const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const ux = (b[0] - a[0]) / L;
	const uy = (b[1] - a[1]) / L;
	const nx = -uy;
	const ny = ux;
	const mx = (a[0] + b[0]) / 2;
	const my = (a[1] + b[1]) / 2;
	const p = [mx - ux * half, my - uy * half];
	const q = [mx + ux * half, my + uy * half];
	d.line(a[0], a[1], p[0], p[1], {
		color,
		width
	});
	d.line(q[0], q[1], b[0], b[1], {
		color,
		width
	});
	const pts = [p];
	const amp = 6 * d.px;
	for (let i = 0; i < 6; i++) {
		const t = -half + 2 * half * (i + .5) / 6;
		const s = i % 2 === 0 ? 1 : -1;
		pts.push([mx + ux * t + nx * amp * s, my + uy * t + ny * amp * s]);
	}
	pts.push(q);
	d.polyline(pts, {
		color,
		width
	});
}
/** Bateria/fonte DC: placa longa (+) do lado de b. */
function batterySym(d, a, b, color, label) {
	const L = Math.hypot(b[0] - a[0], b[1] - a[1]) || 1;
	const ux = (b[0] - a[0]) / L;
	const uy = (b[1] - a[1]) / L;
	const nx = -uy;
	const ny = ux;
	const mx = (a[0] + b[0]) / 2;
	const my = (a[1] + b[1]) / 2;
	const g = 4 * d.px;
	d.line(a[0], a[1], mx - ux * g, my - uy * g, {
		color,
		width: 2
	});
	d.line(mx + ux * g, my + uy * g, b[0], b[1], {
		color,
		width: 2
	});
	const s = 7 * d.px;
	const l = 15 * d.px;
	d.line(mx - ux * g - nx * s, my - uy * g - ny * s, mx - ux * g + nx * s, my - uy * g + ny * s, {
		color,
		width: 4
	});
	d.line(mx + ux * g - nx * l, my + uy * g - ny * l, mx + ux * g + nx * l, my + uy * g + ny * l, {
		color,
		width: 2
	});
	d.text("+", mx + ux * (g + 9 * d.px) + nx * l, my + uy * (g + 9 * d.px) + ny * l, {
		color,
		size: 12,
		weight: "700"
	});
	if (label) d.text(label, mx - nx * (l + 8 * d.px), my - ny * (l + 8 * d.px), {
		color,
		size: 12,
		align: nx > 0 ? "right" : "left"
	});
}
/** Seta de corrente de comprimento fixo; o sinal de `i` dá o sentido ao longo de (ux, uy). */
function currentArrow$1(d, x, y, ux, uy, i, color, label, labelSide = 1) {
	if (!Number.isFinite(i) || Math.abs(i) < 1e-15) return;
	const s = Math.sign(i);
	const L = 24;
	d.arrowPx(x - s * ux * L * .5 * d.px, y - s * uy * L * .5 * d.px, s * ux, s * uy, L, {
		color,
		width: 2.4
	});
	if (label) d.text(label, x - uy * 15 * d.px * labelSide, y + ux * 15 * d.px * labelSide, {
		color,
		size: 11,
		weight: "600"
	});
}
/** Ponto de nó (solda). */
function node(d, x, y, color) {
	d.dot(x, y, 3.5, color);
}
//#endregion
//#region sims/ponte-wheatstone/src/index.ts
var K = (_s, p) => kirchhoff(p) ? solveKirchhoff(p) : void 0;
var ponteWheatstone = defineSim({
	id: "ponte-wheatstone",
	title: "Ponte de Wheatstone e leis de Kirchhoff",
	course: "Exp III",
	topic: "Circuitos",
	priority: "P1",
	summary: "Equilibre uma ponte de Wheatstone com uma década de resistores até o galvanômetro zerar e descubra o valor de resistores desconhecidos. No modo Kirchhoff, meça correntes de ramo e tensões num circuito de duas malhas e verifique as leis dos nós e das malhas.",
	equations: [
		String.raw`\text{equilíbrio } (I_g = 0):\quad V_B = V_D \iff \frac{R_1}{R_2} = \frac{R_3}{R_x} \iff R_x = R_3\,\frac{R_2}{R_1}`,
		String.raw`\text{nós: } \sum I_{\text{entram}} = \sum I_{\text{saem}} \qquad \text{malhas: } \sum \mathcal{E} = \sum R I`,
		String.raw`\text{duas malhas: } I_1 + I_2 = I_3,\quad \mathcal{E}_1 = R_1 I_1 + R_3 I_3,\quad \mathcal{E}_2 = (R_2 + R_4) I_2 + R_3 I_3`
	],
	liveEquations(s, p) {
		if (kirchhoff(p)) {
			const k = solveKirchhoff(p);
			return [
				String.raw`I_1 = ${texNum(k.I1)}\ \text{A},\quad I_2 = ${texNum(k.I2)}\ \text{A},\quad I_3 = ${texNum(k.I3)}\ \text{A},\quad V_b = ${texNum(k.Vb)}\ \text{V}`,
				String.raw`I_1 + I_2 - I_3 = ${texNum(k.no)}\ \text{A}`,
				String.raw`\mathcal{E}_1 - R_1 I_1 - R_3 I_3 = ${texNum(k.m1)}\ \text{V}\qquad \mathcal{E}_2 - (R_2+R_4) I_2 - R_3 I_3 = ${texNum(k.m2)}\ \text{V}`
			];
		}
		const b = bridge(s, p);
		return [String.raw`R_3\,\frac{R_2}{R_1} = ${texNum(R3(p), 5)} \times \frac{${texNum(R2(p))}}{${texNum(R1(p))}} = ${texNum(R3(p) * R2(p) / R1(p), 5)}\ \Omega`, String.raw`I_g = ${texNum(b.Ig)}\ \text{A}\qquad V_B - V_D = ${texNum(b.Vb - b.Vd)}\ \text{V}`];
	},
	params: [
		{
			key: "modo",
			label: "Montagem",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Ponte de Wheatstone"
			}, {
				value: 1,
				label: "Circuito de duas malhas (Kirchhoff)"
			}]
		},
		{
			key: "rx",
			label: "Resistor desconhecido Rx",
			unit: "",
			min: 0,
			max: AMOSTRAS.length - 1,
			step: 1,
			default: 0,
			options: AMOSTRAS.map((a, i) => ({
				value: i,
				label: `Amostra ${a.nome}`
			}))
		},
		{
			key: "E",
			label: "Fonte E (E₁ no modo Kirchhoff)",
			unit: "V",
			min: 0,
			max: 12,
			step: .1,
			default: 6,
			live: true
		},
		{
			key: "R1",
			label: "R₁",
			unit: "Ω",
			min: 10,
			max: 1e4,
			step: 1,
			default: 1e3,
			log: true,
			live: true
		},
		{
			key: "R2",
			label: "R₂",
			unit: "Ω",
			min: 10,
			max: 1e4,
			step: 1,
			default: 1e3,
			log: true,
			live: true
		},
		{
			key: "R3",
			label: "R₃ (década de resistores)",
			unit: "Ω",
			min: 0,
			max: 11110,
			step: 1,
			default: 1e3,
			live: true
		},
		{
			key: "sens",
			label: "Galvanômetro",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 1,
			live: true,
			options: [{
				value: 0,
				label: "Com shunt (grosso: 100 µA/div)"
			}, {
				value: 1,
				label: "Sem shunt (fino: 1 µA/div)"
			}]
		},
		{
			key: "E2",
			label: "E₂ (só Kirchhoff)",
			unit: "V",
			min: 0,
			max: 12,
			step: .1,
			default: 4.5,
			live: true
		},
		{
			key: "R4",
			label: "R₄ (só Kirchhoff)",
			unit: "Ω",
			min: 10,
			max: 1e4,
			step: 1,
			default: 470,
			log: true,
			live: true
		}
	],
	observables: [
		{
			key: "Ig",
			label: "Corrente no galvanômetro I_g",
			unit: "A",
			value: (s, p) => kirchhoff(p) ? 0 : bridge(s, p).Ig
		},
		{
			key: "defl",
			label: "Deflexão do ponteiro",
			unit: "div",
			value: (s) => s[1]
		},
		{
			key: "Rxcalc",
			label: "R_x calculado = R₃R₂/R₁",
			unit: "Ω",
			value: (_s, p) => R3(p) * R2(p) / R1(p)
		},
		{
			key: "Vbd",
			label: "V_B − V_D",
			unit: "V",
			value: (s, p) => kirchhoff(p) ? 0 : bridge(s, p).Vb - bridge(s, p).Vd
		},
		{
			key: "If",
			label: "Corrente da fonte",
			unit: "A",
			value: (s, p) => kirchhoff(p) ? solveKirchhoff(p).I1 : bridge(s, p).If
		},
		{
			key: "I1",
			label: "Corrente de ramo I₁",
			unit: "A",
			value: (s, p) => K(s, p)?.I1 ?? 0
		},
		{
			key: "I2",
			label: "Corrente de ramo I₂",
			unit: "A",
			value: (s, p) => K(s, p)?.I2 ?? 0
		},
		{
			key: "I3",
			label: "Corrente de ramo I₃",
			unit: "A",
			value: (s, p) => K(s, p)?.I3 ?? 0
		},
		{
			key: "Vb",
			label: "Tensão no nó b",
			unit: "V",
			value: (s, p) => K(s, p)?.Vb ?? 0
		},
		{
			key: "no",
			label: "Nó b: I₁ + I₂ − I₃",
			unit: "A",
			value: (s, p) => K(s, p)?.no ?? 0
		},
		{
			key: "malha1",
			label: "Malha 1: E₁ − R₁I₁ − R₃I₃",
			unit: "V",
			value: (s, p) => K(s, p)?.m1 ?? 0
		},
		{
			key: "malha2",
			label: "Malha 2: E₂ − (R₂+R₄)I₂ − R₃I₃",
			unit: "V",
			value: (s, p) => K(s, p)?.m2 ?? 0
		}
	],
	chart: {
		x: "t",
		y: "defl"
	},
	scenarios: [
		{
			id: "equilibrar",
			label: "Equilibrar a ponte",
			params: {
				modo: 0,
				rx: 0,
				E: 6,
				R1: 1e3,
				R2: 1e3,
				R3: 500,
				sens: 0
			},
			guide: `### Encontrando Rx
1. Comece com o galvanômetro **com shunt** (pouco sensível): ele protege a bobina enquanto a ponte está longe do equilíbrio.
2. Ajuste a **década R₃** até o ponteiro voltar ao zero. Espere o ponteiro parar antes de ler (cerca de 1 s).
3. Tire o shunt (**sem shunt**, 1 µA/div) e refine R₃ de 1 em 1 Ω.
4. No equilíbrio, $R_x = R_3 R_2/R_1$. Compare com o valor nominal pelo código de cores (tolerância de 5 %).
5. Abra a **chave do galvanômetro** (clique nela): com o ramo aberto, o ponteiro volta a zero mesmo fora do equilíbrio. Zero com a chave fechada é o que vale.`,
			predict: [{
				question: "Depois de equilibrar a ponte, você dobra a tensão da fonte. O ponteiro:",
				options: [
					"continua em zero",
					"desvia para a direita",
					"desvia para a esquerda",
					"oscila sem parar"
				],
				answer: 0,
				explanation: "A condição $R_1/R_2 = R_3/R_x$ não depende de $E$: no equilíbrio $V_B = V_D$ para qualquer tensão. Uma fonte maior só torna o galvanômetro mais sensível fora do equilíbrio."
			}]
		},
		{
			id: "razao",
			label: "Escolha da razão R₁/R₂",
			params: {
				modo: 0,
				rx: 3,
				E: 6,
				R1: 1e3,
				R2: 1e3,
				R3: 48,
				sens: 1
			},
			guide: `### Precisão e razão dos braços
A amostra D tem cerca de 47 Ω. Com $R_1 = R_2$, a década só ajusta R₃ de 1 em 1 Ω: o resultado tem apenas dois algarismos.
1. Equilibre com $R_1/R_2 = 1$ e anote $R_3$.
2. Mude para $R_1 = 1000\\ \\Omega$ e $R_2 = 100\\ \\Omega$ (razão 10): agora $R_3 = 10\\,R_x$ e a década dá um algarismo a mais.
3. Repita com razão 100. Faça o gráfico de $R_3$ contra $R_1/R_2$: é uma reta pela origem com inclinação $R_x$.
4. Perto do equilíbrio, quantos µA o galvanômetro acusa por ohm de desbalanço? Essa é a **sensibilidade** da ponte.`
		},
		{
			id: "kirchhoff",
			label: "Leis de Kirchhoff (duas malhas)",
			params: {
				modo: 1,
				E: 6,
				E2: 4.5,
				R1: 220,
				R2: 330,
				R3: 470,
				R4: 100
			},
			guide: `### Nós e malhas
Três amperímetros medem as correntes de ramo $I_1$, $I_2$ e $I_3$, que chegam e saem do nó b.
1. Verifique a **lei dos nós**: $I_1 + I_2 = I_3$ (o painel mostra a soma).
2. Percorra a malha da esquerda: $\\mathcal{E}_1 - R_1 I_1 - R_3 I_3 = 0$. Faça o mesmo na malha da direita.
3. Diminua $E_2$ até $I_2$ inverter de sentido: o amperímetro passa a indicar valores negativos. As leis continuam valendo com os sinais.
4. **Superposição:** meça $I_3$ com só $E_1$ ($E_2 = 0$), depois com só $E_2$ ($E = 0$). A soma é igual a $I_3$ com as duas fontes.`,
			predict: [{
				question: "Se você zerar E₂, a corrente I₂ no ramo da direita:",
				options: [
					"também zera",
					"inverte de sentido (passa a sair do nó b)",
					"fica igual",
					"dobra"
				],
				answer: 1,
				explanation: "Com $E_2 = 0$, o ramo da direita vira só resistores em paralelo com $R_3$: parte da corrente de $E_1$ desce por ele, saindo do nó b. $I_2$ fica negativo."
			}]
		}
	],
	exercises: [{
		id: "equilibrio",
		prompt: "Uma ponte de Wheatstone fica equilibrada com R₁ = {R1} Ω, R₂ = {R2} Ω e a década em R₃ = {R3} Ω. Quanto vale a resistência desconhecida (no braço oposto a R₁)?",
		vary: {
			R1: [
				100,
				5e3,
				0
			],
			R2: [
				100,
				5e3,
				0
			],
			R3: [
				10,
				9e3,
				0
			]
		},
		fixed: { modo: 0 },
		answer: {
			label: "Rx",
			unit: "Ω",
			compute: (p) => num(p, "R3") * num(p, "R2") / num(p, "R1")
		},
		hint: "No equilíbrio R₁/R₂ = R₃/Rx."
	}, {
		id: "corrente-i3",
		prompt: "No circuito de duas malhas, E₁ = {E} V em série com R₁ = {R1} Ω e E₂ = {E2} V em série com R₂ + R₄ = {R2} Ω + {R4} Ω alimentam o resistor central R₃ = {R3} Ω. Qual a corrente em R₃?",
		vary: {
			E: [
				1,
				12,
				1
			],
			E2: [
				1,
				12,
				1
			],
			R1: [
				100,
				1e3,
				0
			],
			R2: [
				100,
				1e3,
				0
			],
			R3: [
				100,
				1e3,
				0
			],
			R4: [
				10,
				500,
				0
			]
		},
		fixed: { modo: 1 },
		answer: {
			label: "I₃",
			unit: "A",
			compute: (p) => {
				const Rr = num(p, "R2") + num(p, "R4");
				return (num(p, "E") / num(p, "R1") + num(p, "E2") / Rr) / (1 / num(p, "R1") + 1 / num(p, "R3") + 1 / Rr) / num(p, "R3");
			}
		},
		hint: "Escreva a lei dos nós em b com V_b como incógnita: (E₁ − V_b)/R₁ + (E₂ − V_b)/(R₂+R₄) = V_b/R₃."
	}],
	init: init$1,
	step: (s, p, _t, dt) => step$1(s, p, dt),
	dt: .005,
	sampleEvery: 4,
	viewport: () => ({
		xMin: 0,
		xMax: 30,
		yMin: 0,
		yMax: 17,
		unit: ""
	}),
	pointer: {
		down(s, p, pt) {
			if (kirchhoff(p) || Math.hypot(pt.x - KEY_POS[0], pt.y - KEY_POS[1]) > .7) return void 0;
			const out = s.slice();
			out[3] = s[3] > .5 ? 0 : 1;
			return out;
		},
		cursor: (_s, p, pt) => !kirchhoff(p) && Math.hypot(pt.x - KEY_POS[0], pt.y - KEY_POS[1]) < .7 ? "pointer" : void 0
	},
	actions: [{
		id: "chave",
		label: "Abrir / fechar a chave do galvanômetro",
		run: (s) => {
			const out = s.slice();
			out[3] = s[3] > .5 ? 0 : 1;
			return out;
		},
		active: (s) => s[3] > .5
	}],
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: s, params: p, theme } = frame;
		if (kirchhoff(p)) drawKirchhoff(d, theme, p);
		else drawBridge$1(d, theme, s, p);
	}
});
var A = [9, 14.6];
var C$1 = [9, 2.4];
var B = [3.6, 8.5];
var D = [14.4, 8.5];
var G = [9, 8.5];
var KEY_POS = [5.6, 8.5];
function galvanometer(d, theme, x, y, defl, label) {
	d.circle(x, y, 1.7, {
		fill: theme.dark ? "#e9e4d4" : "#fbf8ee",
		stroke: "#444",
		width: 2
	});
	const ang = (v) => Math.PI / 2 - v / 30 * (Math.PI / 3);
	const cy = y - .9;
	const R = 2;
	for (let v = -30; v <= 30; v += 2) {
		const a = ang(v);
		const len = v % 10 === 0 ? .28 : .15;
		d.line(x + R * Math.cos(a), cy + R * Math.sin(a), x + (R - len) * Math.cos(a), cy + (R - len) * Math.sin(a), {
			color: "#222",
			width: v === 0 ? 2 : 1
		});
		if (v % 10 === 0) d.text(String(Math.abs(v)), x + 1.5 * Math.cos(a), cy + 1.5 * Math.sin(a), {
			size: 8,
			color: "#222"
		});
	}
	const a = ang(Math.max(-31.5, Math.min(31.5, defl)));
	d.line(x, cy, x + 2.05 * Math.cos(a), cy + 2.05 * Math.sin(a), {
		color: "#c0261b",
		width: 2
	});
	d.dot(x, cy, 4, "#333");
	d.text("G", x, y - 1.15, {
		size: 12,
		weight: "700",
		color: "#222"
	});
	d.text(label, x, y - 2.05, {
		size: 10,
		color: theme.text
	});
}
function decadeBox(d, theme, x, y, R3v) {
	panel(d, theme, x, y, 11.2, 5.4, "DÉCADA DE RESISTORES  R₃");
	const v = Math.round(Math.min(11110, Math.max(0, R3v)));
	const digits = [
		Math.min(11, Math.floor(v / 1e3)),
		Math.floor(v % 1e3 / 100),
		Math.floor(v % 100 / 10),
		v % 10
	];
	const labels = [
		"×1000 Ω",
		"×100 Ω",
		"×10 Ω",
		"×1 Ω"
	];
	digits.forEach((dg, i) => {
		const kx = x + 1.5 + i * 2.6;
		knob(d, theme, kx, y + 2.3, .8, dg / (i === 0 ? 11 : 10));
		d.text(String(dg), kx, y + 3.55, {
			size: 13,
			weight: "700",
			color: theme.text
		});
		d.text(labels[i], kx, y + 1.1, {
			size: 9,
			color: theme.muted
		});
	});
	const ta = [x + 10.5, y + 3.9];
	const tb = [x + 10.5, y + 2.6];
	jack(d, ta[0], ta[1], "#d42a1f");
	jack(d, tb[0], tb[1], "#1a1a1a");
	d.text(`${v} Ω`, x + 10.4, y + .55, {
		size: 12,
		weight: "700",
		color: theme.text,
		align: "right"
	});
	return {
		a: ta,
		b: tb
	};
}
function drawBridge$1(d, theme, s, p) {
	const c = palette(theme);
	theme.text;
	const b = bridge(s, p);
	const keyOn = s[3] > .5;
	d.rect(.4, 1, 16.6, 15.6, {
		fill: theme.dark ? "#3a2f24" : "#e8d8bf",
		stroke: theme.muted,
		width: 1
	});
	d.text("Ponte de Wheatstone", .7, 16.25, {
		size: 11,
		weight: "700",
		color: theme.dark ? "#e9dcc6" : "#5b4528",
		align: "left"
	});
	resistorBody(d, A, B, R1(p), 60);
	resistorBody(d, B, C$1, R2(p), 60);
	const am = amostra(p);
	resistorBody(d, D, C$1, am.nominal, 60);
	const ta = [11.2, 12];
	const tb = [13, 10.3];
	d.line(A[0], A[1], ta[0], ta[1], {
		color: "#777",
		width: 2.5
	});
	d.line(tb[0], tb[1], D[0], D[1], {
		color: "#777",
		width: 2.5
	});
	jack(d, ta[0], ta[1], "#d42a1f");
	jack(d, tb[0], tb[1], "#1a1a1a");
	const lab = theme.dark ? "#f1e6d2" : "#3d2c14";
	d.text(`R₁ = ${si$1(R1(p), "Ω")}`, (A[0] + B[0]) / 2 - .5, (A[1] + B[1]) / 2 + .6, {
		size: 11,
		color: lab,
		align: "right"
	});
	d.text(`R₂ = ${si$1(R2(p), "Ω")}`, (B[0] + C$1[0]) / 2 - .5, (B[1] + C$1[1]) / 2 - .6, {
		size: 11,
		color: lab,
		align: "right"
	});
	d.text("R₃ (década)", 12.6, 11.4, {
		size: 11,
		color: lab,
		align: "left"
	});
	d.text(`Rx = ? (amostra ${am.nome})`, (D[0] + C$1[0]) / 2 + .6, (D[1] + C$1[1]) / 2 - .5, {
		size: 11,
		color: lab,
		align: "left",
		weight: "600"
	});
	d.line(B[0], B[1], KEY_POS[0] - .45, KEY_POS[1], {
		color: "#777",
		width: 2.5
	});
	if (keyOn) d.line(KEY_POS[0] - .45, KEY_POS[1], KEY_POS[0] + .45, KEY_POS[1], {
		color: "#777",
		width: 2.5
	});
	else d.line(KEY_POS[0] - .45, KEY_POS[1], KEY_POS[0] + .3, KEY_POS[1] + .45, {
		color: "#777",
		width: 2.5
	});
	d.circle(KEY_POS[0], KEY_POS[1] + .05, .62, {
		stroke: theme.accent,
		width: 1,
		dash: [3, 3]
	});
	d.text(keyOn ? "chave fechada" : "chave aberta", KEY_POS[0], KEY_POS[1] - .9, {
		size: 9,
		color: lab
	});
	d.line(KEY_POS[0] + .45, KEY_POS[1], G[0] - 1.7, G[1], {
		color: "#777",
		width: 2.5
	});
	d.line(G[0] + 1.7, G[1], D[0], D[1], {
		color: "#777",
		width: 2.5
	});
	galvanometer(d, theme, G[0], G[1], s[1], shunted(p) ? "com shunt · 100 µA/div" : "sem shunt · 1 µA/div");
	if (keyOn && Math.abs(b.Ig) > 1e-9) currentArrow$1(d, (G[0] + 1.7 + D[0]) / 2, G[1] + .35, 1, 0, b.Ig, theme.series[1], si$1(Math.abs(b.Ig), "A", 2));
	for (const [q, n] of [
		[A, "A"],
		[B, "B"],
		[C$1, "C"],
		[D, "D"]
	]) {
		node(d, q[0], q[1], "#444");
		d.text(n, q[0] + (n === "B" ? -.4 : n === "D" ? .4 : .45), q[1] + (n === "A" ? .35 : n === "C" ? -.35 : .4), {
			size: 12,
			weight: "700",
			color: lab
		});
	}
	panel(d, theme, 18, 1, 11.4, 4.6, "FONTE DC");
	ledDisplay(d, theme, 18.4, 3, 5, 1.5, E(p).toFixed(2), "V", 5);
	const fp = [26, 2.2];
	const fm = [27.6, 2.2];
	jack(d, fp[0], fp[1], "#d42a1f", "+", theme.text);
	jack(d, fm[0], fm[1], "#1a1a1a", "−", theme.text);
	d.text(`I = ${si$1(b.If, "A")}`, 20.9, 1.9, {
		size: 11,
		color: theme.text
	});
	cable(d, fp, A, c.red, -1.5);
	cable(d, fm, C$1, c.black, .6);
	const dec = decadeBox(d, theme, 18, 11.2, R3(p));
	cable(d, dec.a, ta, c.red, .4, 2.5);
	cable(d, dec.b, tb, c.black, .6, 2.5);
	d.rect(18, 6, 11.4, 4.8, {
		stroke: theme.grid,
		width: 1
	});
	d.text("Caderno de laboratório", 18.2, 10.45, {
		size: 10,
		align: "left",
		weight: "600",
		color: theme.muted
	});
	const bal = Math.abs(s[1]) < .5 && keyOn;
	d.text(bal ? "Ponteiro no zero: ponte equilibrada" : "Ajuste R₃ até o ponteiro parar no zero", 18.2, 9.6, {
		size: 11,
		align: "left",
		color: bal ? theme.series[2] : theme.text,
		weight: bal ? "700" : "400"
	});
	d.text(`R₃ · R₂ / R₁ = ${br(R3(p) * R2(p) / R1(p), 5)} Ω`, 18.2, 8.6, {
		size: 12,
		align: "left",
		color: theme.text,
		weight: "600"
	});
	d.text(`Nominal da amostra ${am.nome}: ${si$1(am.nominal, "Ω")} ± 5 %`, 18.2, 7.6, {
		size: 11,
		align: "left",
		color: theme.muted
	});
	d.text(`Galvanômetro: R_g = 100 Ω, ${si$1(ampsPerDiv(p), "A")}/div, ±30 div`, 18.2, 6.6, {
		size: 10,
		align: "left",
		color: theme.muted
	});
}
function miniAmmeter(d, theme, x, y, I, label) {
	const c = palette(theme);
	d.rect(x - 1.25, y - .6, 2.5, 1.2, {
		fill: c.dmmBody,
		stroke: "#6b5410",
		width: 1
	});
	d.rect(x - 1.1, y - .45, 2.2, .9, {
		fill: c.lcdBg,
		stroke: "#111",
		width: .8
	});
	const mA = I * 1e3;
	sevenSeg(d, Math.abs(mA) >= 100 ? mA.toFixed(1) : mA.toFixed(2), x + .55, y - .25, .48, c.lcdSeg, 5);
	d.text("mA", x + 1.05, y - .05, {
		size: 8,
		weight: "700",
		color: c.lcdSeg,
		align: "right"
	});
	d.text(label, x - 1.4, y, {
		size: 12,
		weight: "700",
		color: theme.text,
		align: "right"
	});
}
function drawKirchhoff(d, theme, p) {
	const k = solveKirchhoff(p);
	const col = theme.text;
	const yT = 13.5;
	const yB = 2.5;
	const xL = 2.5;
	const xM = 10.5;
	const xR = 18.5;
	batterySym(d, [xL, yB], [xL, 7.5], col, `E₁ = ${br(E(p), 3)} V`);
	d.line(xL, 7.5, xL, 9.4, {
		color: col,
		width: 2
	});
	miniAmmeter(d, theme, xL, 10, k.I1, "");
	d.line(xL, 10.6, xL, yT, {
		color: col,
		width: 2
	});
	resistorSym(d, [xL, yT], [xM, yT], 1.4, col);
	d.text(`R₁ = ${si$1(R1(p), "Ω")}`, 13 / 2, 14.1, {
		size: 11,
		color: theme.muted
	});
	resistorSym(d, [xM, yT], [xM, 6.6], 1.4, col);
	d.text(`R₃ = ${si$1(R3(p), "Ω")}`, 11, 10.1, {
		size: 11,
		color: theme.muted,
		align: "left"
	});
	d.line(xM, 6.6, xM, 5.6, {
		color: col,
		width: 2
	});
	miniAmmeter(d, theme, xM, 5, k.I3, "");
	d.line(xM, 4.4, xM, yB, {
		color: col,
		width: 2
	});
	resistorSym(d, [xM, yT], [xR, yT], 1.4, col);
	d.text(`R₄ = ${si$1(R4(p), "Ω")}`, 29 / 2, 14.1, {
		size: 11,
		color: theme.muted
	});
	resistorSym(d, [xR, yT], [xR, 9.6], 1, col);
	d.text(`R₂ = ${si$1(R2(p), "Ω")}`, 19, 11.6, {
		size: 11,
		color: theme.muted,
		align: "left"
	});
	d.line(xR, 9.6, xR, 9, {
		color: col,
		width: 2
	});
	miniAmmeter(d, theme, xR, 8.4, -k.I2, "");
	d.line(xR, 7.8, xR, 7, {
		color: col,
		width: 2
	});
	batterySym(d, [xR, yB], [xR, 7], col);
	d.text(`E₂ = ${br(E2(p), 3)} V`, 19.1, 4.75, {
		size: 12,
		color: col,
		align: "left"
	});
	d.line(xL, yB, xR, yB, {
		color: col,
		width: 2
	});
	node(d, xM, yT, col);
	node(d, xM, yB, col);
	d.text("b", xM, 13.95, {
		size: 13,
		weight: "700",
		color: theme.accent
	});
	d.text("A₁", .8999999999999999, 10, {
		size: 11,
		weight: "700",
		color: theme.text
	});
	d.text("A₃", 8.9, 5, {
		size: 11,
		weight: "700",
		color: theme.text
	});
	d.text("A₂", 16.9, 8.4, {
		size: 11,
		weight: "700",
		color: theme.text
	});
	currentArrow$1(d, 13 / 2 - 1.8, yT, 1, 0, k.I1, theme.series[0], `I₁`, 1);
	currentArrow$1(d, 16.3, yT, -1, 0, k.I2, theme.series[1], `I₂`, -1);
	currentArrow$1(d, 10, 8.2, 0, -1, k.I3, theme.series[2], `I₃`, 1);
	const loop = (cx, label, color) => {
		d.circle(cx, 8, 1, {
			stroke: color,
			width: 1.5,
			dash: [4, 3],
			alpha: .7
		});
		d.arrowPx(cx + 1, 8, 0, -1, 12, {
			color,
			width: 1.5
		});
		d.text(label, cx, 8, {
			size: 11,
			color,
			weight: "600"
		});
	};
	loop(13 / 2, "malha 1", theme.muted);
	loop(29 / 2, "malha 2", theme.muted);
	d.text("Leitura positiva no amperímetro = corrente no sentido da seta de referência.", 10.5, .9, {
		size: 10,
		color: theme.muted
	});
	d.text(`(A₂ indica a corrente que sobe pelo ramo da direita: −I₂ quando I₂ entra em b pelo alto)`, 10.5, .35, {
		size: 9,
		color: theme.muted
	});
	const X = 21.3;
	d.rect(21, 2, 9, 13.2, {
		stroke: theme.grid,
		width: 1
	});
	d.text("Verificação das leis", X, 14.7, {
		size: 12,
		weight: "700",
		color: theme.text,
		align: "left"
	});
	[
		[
			"I₁",
			k.I1,
			"A"
		],
		[
			"I₂",
			k.I2,
			"A"
		],
		[
			"I₃",
			k.I3,
			"A"
		],
		[
			"V_b",
			k.Vb,
			"V"
		],
		[
			"Nó b: I₁ + I₂ − I₃",
			k.no,
			"A"
		],
		[
			"Malha 1: E₁ − R₁I₁ − R₃I₃",
			k.m1,
			"V"
		],
		[
			"Malha 2: E₂ − (R₂+R₄)I₂ − R₃I₃",
			k.m2,
			"V"
		]
	].forEach(([l, v, u], i) => {
		const y = 13.6 - i * 1.55;
		d.text(l, X, y, {
			size: 11,
			align: "left",
			color: theme.muted
		});
		const txt = i >= 4 && Math.abs(v) < 1e-9 ? `0 ${u}` : si$1(v, u, 4);
		d.text(txt, 29.5, y - .6, {
			size: 13,
			align: "right",
			color: i >= 4 ? theme.series[2] : theme.text,
			weight: "700"
		});
	});
}
//#endregion
//#region sims/projetil-arrasto/src/derivation.ts
/** Modo engenharia: derivação completa do modelo do projétil com arrasto quadrático. */
var derivation$2 = String.raw`### 1. Hipóteses
- O projétil é uma esfera rígida de massa $m$ e diâmetro $D$, tratada como partícula (sem rotação, portanto sem efeito Magnus).
- Gravidade uniforme $\vec g = -g\,\hat y$ (alcances pequenos frente ao raio da Terra; Terra tratada como referencial inercial).
- Ar parado, com densidade $\rho$ constante ao longo da trajetória (sem vento, sem variação com a altitude).
- Regime de número de Reynolds alto ($Re = \rho v D/\eta \sim 10^4$ a $10^5$ para bolas de esporte), em que o arrasto é dominado pela pressão e cresce com $v^2$; o coeficiente $C_d$ é tomado constante.

### 2. Força de arrasto
A análise dimensional diz que uma força que depende só de $\rho$, $v$ e da área frontal $A$ tem a forma $F \propto \rho v^2 A$. A constante adimensional é o coeficiente de arrasto, definido por
$$F_d = \tfrac12\,\rho\,C_d\,A\,v^2, \qquad A = \pi D^2/4.$$
O termo $\tfrac12\rho v^2$ é a pressão dinâmica (Bernoulli). A força aponta contra a velocidade relativa ao ar:
$$\vec F_d = -k\,|\vec v|\,\vec v, \qquad k = \tfrac12\rho C_d A.$$
Note que $|\vec v|\,\vec v$ tem módulo $v^2$ e direção de $\vec v$; isso acopla as componentes $x$ e $y$, ao contrário do arrasto linear.

### 3. Segunda lei de Newton
$$m\,\frac{d\vec v}{dt} = m\vec g - k\,|\vec v|\,\vec v.$$
Em componentes, com $v = \sqrt{v_x^2 + v_y^2}$:
$$\dot x = v_x, \qquad \dot y = v_y, \qquad \dot v_x = -\frac{k}{m}\,v\,v_x, \qquad \dot v_y = -g - \frac{k}{m}\,v\,v_y.$$
Não há solução fechada geral para esse sistema (o acoplamento por $v$ impede separar as equações), por isso ele é integrado numericamente.

### 4. Velocidade terminal
Na queda vertical o regime estacionário tem $\dot v_y = 0$, logo $m g = k v_t^2$:
$$v_t = \sqrt{\frac{m g}{k}} = \sqrt{\frac{2 m g}{\rho C_d A}}.$$
Na queda a partir do repouso a equação $\dot v = g\,(1 - v^2/v_t^2)$ é separável e dá $v(t) = v_t \tanh(g t / v_t)$, que a simulação deve reproduzir no cenário da peteca.

### 5. Balanço de energia
Multiplicando a equação de movimento escalarmente por $\vec v$:
$$\frac{d}{dt}\left(\tfrac12 m v^2 + m g y\right) = \vec F_d\cdot\vec v = -k\,v^3 \le 0.$$
Definindo a energia dissipada $W_d$ por $\dot W_d = k\,v^3 = |\vec F_d|\,v$, resulta a lei de conservação usada como teste numérico:
$$E_{mec}(t) + W_d(t) = E_{mec}(0).$$

### 6. Limite do vácuo
Com $k = 0$ as equações desacoplam: $x = v_0\cos\theta\,t$ e $y = h_0 + v_0\sin\theta\,t - \tfrac12 g t^2$. Para $h_0 = 0$ o alcance é $R = v_0^2\sin 2\theta/g$, máximo em $\theta = 45^\circ$. Com arrasto, a componente horizontal perde velocidade durante todo o voo e o ângulo ótimo cai abaixo de $45^\circ$.

### 7. Método numérico
- Estado $\mathbf y = (x, y, v_x, v_y, W_d)$, com $\dot W_d = k v^3$ integrado junto com o movimento.
- Integração por Runge–Kutta clássico de 4ª ordem com passo fixo $h = 1$ ms (erro global $O(h^4)$).
- O pouso é um evento: a função $y(t)$ é monitorada e, quando cruza zero descendo, o instante exato é localizado por bissecção dentro do último passo, para que o alcance não dependa de $h$.
- O desvio relativo de $E_{mec} + W_d$ mostrado no painel mede a qualidade da integração: ele deve ficar na casa de $10^{-9}$ ou menor.`;
//#endregion
//#region sims/projetil-arrasto/src/index.ts
/**
* Lançamento oblíquo com arrasto quadrático.
*
* Estado: [x, y, vx, vy, Wd], onde Wd é a energia dissipada pelo arrasto
* (dWd/dt = |F_d|·|v|). Guardar Wd no estado permite verificar que
* E_mec + Wd se conserva, o teste de sanidade numérica da simulação.
*/
var X$1 = 0;
var Y = 1;
var VX = 2;
var VY = 3;
var WD$1 = 4;
/** Coeficiente k em F_d = k·|v|·v, ou seja, k = ½·ρ·Cd·A. */
function dragK(p) {
	const r = (p.diametro ?? 0) / 2;
	return .5 * (p.rho ?? 0) * (p.cd ?? 0) * Math.PI * r * r;
}
function speed(s) {
	return Math.hypot(s[VX] ?? 0, s[VY] ?? 0);
}
/** Alcance e altura máxima no vácuo, usados para enquadrar a cena. */
function vacuumTrajectory(p) {
	const v0 = p.v0 ?? 0, g = p.g ?? 9.81, h0 = p.h0 ?? 0;
	const th = (p.angulo ?? 0) * Math.PI / 180;
	const vx = v0 * Math.cos(th), vy = v0 * Math.sin(th);
	return {
		range: vx * ((vy + Math.sqrt(vy * vy + 2 * g * h0)) / g),
		hmax: h0 + Math.max(0, vy * vy / (2 * g))
	};
}
var projetilArrasto = defineSim({
	id: "projetil-arrasto",
	title: "Projétil com arrasto",
	course: "FG I",
	topic: "Cinemática 2D",
	priority: "P1",
	summary: "Lançamento oblíquo com resistência do ar proporcional a v². Compare com o vácuo, veja a velocidade terminal e acompanhe a energia dissipada.",
	derivation: derivation$2,
	equations: [
		String.raw`m\,\ddot{\vec r} = m\vec g - \tfrac12 \rho\, C_d A\, |\vec v|\,\vec v`,
		String.raw`v_t = \sqrt{\dfrac{2mg}{\rho C_d A}}`,
		String.raw`E_{mec}(t) + W_{arrasto}(t) = E_{mec}(0)`
	],
	params: [
		{
			key: "v0",
			label: "Velocidade inicial",
			unit: "m/s",
			min: 1,
			max: 100,
			step: .5,
			default: 30
		},
		{
			key: "angulo",
			label: "Ângulo de lançamento",
			unit: "°",
			min: 0,
			max: 90,
			step: .5,
			default: 45
		},
		{
			key: "h0",
			label: "Altura inicial",
			unit: "m",
			min: 0,
			max: 50,
			step: .5,
			default: 0
		},
		{
			key: "massa",
			label: "Massa",
			unit: "kg",
			min: .005,
			max: 10,
			step: .005,
			default: .43
		},
		{
			key: "diametro",
			label: "Diâmetro",
			unit: "m",
			min: .01,
			max: 1,
			step: .005,
			default: .22
		},
		{
			key: "cd",
			label: "Coeficiente de arrasto Cd",
			unit: "",
			min: 0,
			max: 2,
			step: .01,
			default: .25
		},
		{
			key: "rho",
			label: "Densidade do ar ρ",
			unit: "kg/m³",
			min: 0,
			max: 2,
			step: .005,
			default: 1.225
		},
		{
			key: "g",
			label: "Gravidade g",
			unit: "m/s²",
			min: .5,
			max: 25,
			step: .01,
			default: 9.81
		}
	],
	observables: [
		{
			key: "x",
			label: "x",
			unit: "m",
			value: (s) => s[X$1] ?? 0
		},
		{
			key: "y",
			label: "y",
			unit: "m",
			value: (s) => s[Y] ?? 0
		},
		{
			key: "vx",
			label: "vₓ",
			unit: "m/s",
			value: (s) => s[VX] ?? 0
		},
		{
			key: "vy",
			label: "v_y",
			unit: "m/s",
			value: (s) => s[VY] ?? 0
		},
		{
			key: "v",
			label: "|v|",
			unit: "m/s",
			value: speed
		},
		{
			key: "K",
			label: "Energia cinética",
			unit: "J",
			value: (s, p) => .5 * (p.massa ?? 0) * speed(s) ** 2
		},
		{
			key: "U",
			label: "Energia potencial",
			unit: "J",
			value: (s, p) => (p.massa ?? 0) * (p.g ?? 0) * (s[Y] ?? 0)
		},
		{
			key: "E",
			label: "Energia mecânica",
			unit: "J",
			value: (s, p) => .5 * (p.massa ?? 0) * speed(s) ** 2 + (p.massa ?? 0) * (p.g ?? 0) * (s[Y] ?? 0)
		},
		{
			key: "wd",
			label: "Energia dissipada",
			unit: "J",
			value: (s) => s[WD$1] ?? 0
		},
		{
			key: "Etot",
			label: "E mecânica + dissipada",
			unit: "J",
			value: (s, p) => .5 * (p.massa ?? 0) * speed(s) ** 2 + (p.massa ?? 0) * (p.g ?? 0) * (s[Y] ?? 0) + (s[WD$1] ?? 0)
		}
	],
	conserved: "Etot",
	chart: {
		x: "x",
		y: "y"
	},
	scenarios: [
		{
			id: "futebol",
			label: "Bola de futebol (chute longo)",
			params: {
				v0: 30,
				angulo: 45,
				h0: 0,
				massa: .43,
				diametro: .22,
				cd: .25,
				rho: 1.225,
				g: 9.81
			},
			guide: `### Chute longo
1. Rode a simulação e anote o alcance.
2. Zere **Cd** (vácuo) e rode de novo. Quanto o ar encurtou o chute, em %?
3. Com arrasto, procure o ângulo de alcance máximo. Ele ainda é 45°? Por quê?`
		},
		{
			id: "vacuo",
			label: "Vácuo (sem arrasto)",
			params: {
				v0: 30,
				angulo: 45,
				h0: 0,
				cd: 0
			},
			guide: `### Referência analítica
Sem arrasto, o alcance é R = v₀² sen(2θ)/g. Compare o valor medido com a fórmula e
confira no gráfico que a **energia mecânica** fica constante.`
		},
		{
			id: "terminal",
			label: "Queda livre até a velocidade terminal",
			params: {
				v0: .001,
				angulo: 90,
				h0: 50,
				massa: .005,
				diametro: .065,
				cd: .6,
				rho: 1.225,
				g: 9.81
			},
			guide: `### Velocidade terminal (peteca)
1. Plote **v_y** e veja o patamar.
2. Calcule v_t = √(2mg/(ρ Cd A)) e compare com o patamar do gráfico.
3. Para onde vai a energia potencial perdida? Olhe a curva de **energia dissipada**.`
		},
		{
			id: "beisebol",
			label: "Bola de beisebol (home run)",
			params: {
				v0: 45,
				angulo: 35,
				h0: 1,
				massa: .145,
				diametro: .074,
				cd: .3,
				rho: 1.225,
				g: 9.81
			},
			guide: `### Home run
Um rebatedor tira a bola a 45 m/s. Ela passa do muro a 120 m?
Repita com ρ = 1,0 kg/m³ (estádio em altitude, como em Denver) e compare.`
		}
	],
	init(p) {
		const th = (p.angulo ?? 0) * Math.PI / 180;
		const v0 = p.v0 ?? 0;
		return [
			0,
			p.h0 ?? 0,
			v0 * Math.cos(th),
			v0 * Math.sin(th),
			0
		];
	},
	derivatives(s, p) {
		const m = p.massa ?? 1;
		const k = dragK(p);
		const v = speed(s);
		const vx = s[VX] ?? 0, vy = s[VY] ?? 0;
		return [
			vx,
			vy,
			-k * v * vx / m,
			-(p.g ?? 0) - k * v * vy / m,
			k * v * v * v
		];
	},
	integrator: "rk4",
	stopWhen: (s) => (s[VY] ?? 0) > 0 ? 1 : s[Y] ?? 0,
	viewport(p) {
		const { range, hmax } = vacuumTrajectory(p);
		const w = Math.max(range, hmax, 5) * 1.1;
		return {
			xMin: 0,
			xMax: w,
			yMin: 0,
			yMax: Math.max(hmax * 1.15, w * .4),
			unit: "m"
		};
	},
	liveEquations(s, p) {
		const v = speed(s);
		const k = dragK(p);
		return [String.raw`|\vec F_d| = \tfrac12 \rho C_d A v^2 = ${texNum(k * v * v)}\ \text{N}`, String.raw`v_t = ${texNum(Math.sqrt(2 * (p.massa ?? 1) * (p.g ?? 9.81) / Math.max(1e-12, 2 * k)))}\ \text{m/s}`];
	},
	exercises: [{
		id: "alcance-vacuo",
		prompt: "Um projétil é lançado do chão com velocidade {v0} m/s a {angulo}° da horizontal, sem resistência do ar (g = 9,81 m/s²). Qual é o alcance horizontal?",
		vary: {
			v0: [
				10,
				40,
				1
			],
			angulo: [
				15,
				75,
				0
			]
		},
		fixed: {
			cd: 0,
			h0: 0,
			g: 9.81
		},
		answer: {
			label: "Alcance",
			unit: "m",
			compute: (p) => vacuumTrajectory(p).range
		},
		hint: "Sem arrasto, R = v₀² sen(2θ)/g."
	}, {
		id: "velocidade-terminal",
		prompt: "Uma esfera de {massa} kg e diâmetro {diametro} m (Cd = {cd}) cai no ar (ρ = 1,225 kg/m³, g = 9,81 m/s²). Qual é a velocidade terminal?",
		vary: {
			massa: [
				.01,
				.5,
				3
			],
			diametro: [
				.03,
				.25,
				3
			],
			cd: [
				.3,
				.6,
				2
			]
		},
		fixed: {
			rho: 1.225,
			g: 9.81
		},
		answer: {
			label: "v_t",
			unit: "m/s",
			compute: (p) => Math.sqrt(2 * (p.massa ?? 0) * (p.g ?? 0) / (2 * dragK(p)))
		},
		hint: "No equilíbrio, mg = ½ρC_dAv²."
	}],
	render(ctx, frame) {
		const { state, params, trail, theme } = frame;
		const d = draw(ctx, frame);
		const x = state[X$1] ?? 0, y = state[Y] ?? 0, vx = state[VX] ?? 0, vy = state[VY] ?? 0;
		d.rect(-1e4, -1e4, 2e4, 1e4, { fill: theme.ground });
		const th = (params.angulo ?? 0) * Math.PI / 180;
		const v0 = params.v0 ?? 0, g = params.g ?? 9.81, h0 = params.h0 ?? 0;
		const { range } = vacuumTrajectory(params);
		const v0x = v0 * Math.cos(th);
		if (range > 0 && v0x > 1e-9) d.plot((xi) => h0 + v0 * Math.sin(th) * (xi / v0x) - .5 * g * (xi / v0x) ** 2, 0, range, {
			color: theme.muted,
			dash: [6, 6],
			alpha: .8
		});
		d.polyline([...trail.map((s) => [s[X$1] ?? 0, s[Y] ?? 0]), [x, y]], {
			color: theme.accent,
			width: 2.5
		});
		const v = Math.hypot(vx, vy);
		if (v > 1e-9) {
			d.arrowPx(x, y, vx, vy, 40, { color: theme.accent });
			const ratio = dragK(params) * v * v / ((params.massa ?? 1) * g);
			d.arrowPx(x, y, -vx, -vy, Math.min(60, ratio * 40), { color: theme.positive });
		}
		d.circle(x, y, (params.diametro ?? 0) / 2, {
			fill: theme.series[1],
			minPx: 6
		});
	}
});
//#endregion
//#region sims/ressonancia/src/derivation.ts
/** Modo engenharia: oscilador forçado, solução particular por fasores, curva de ressonância e potência. */
var derivation$1 = String.raw`### 1. Hipóteses
- Oscilador linear: massa $m$, mola ideal $k$, amortecimento viscoso $b$; força externa senoidal $F(t) = F_0\cos\omega t$ de amplitude e frequência fixas.
- A ponte do cenário é reduzida a um único modo de flexão, que se comporta exatamente como esse oscilador (massa e rigidez modais); o desenho é ilustrativo.

### 2. Equação de movimento
$$m\ddot x + b\dot x + kx = F_0\cos\omega t \;\Leftrightarrow\; \ddot x + 2\gamma\dot x + \omega_0^2 x = \frac{F_0}{m}\cos\omega t,$$
com $\omega_0 = \sqrt{k/m}$ e $\gamma = b/(2m)$. Por ser linear, a solução geral é $x = x_h + x_p$: a solução homogênea (transiente) mais uma solução particular.

### 3. Solução particular por fasores
Escreve-se a força como $\mathrm{Re}\big(F_0 e^{i\omega t}\big)$ e procura-se $x_p = \mathrm{Re}\big(\hat X e^{i\omega t}\big)$. Substituindo, cada derivada vira um fator $i\omega$:
$$\left(\omega_0^2 - \omega^2 + 2i\gamma\omega\right)\hat X = \frac{F_0}{m} \;\Rightarrow\; \hat X = \frac{F_0/m}{\omega_0^2 - \omega^2 + 2i\gamma\omega}.$$
Escrevendo $\hat X = A\,e^{-i\delta}$:
$$A(\omega) = \frac{F_0/m}{\sqrt{(\omega_0^2 - \omega^2)^2 + (2\gamma\omega)^2}}, \qquad \tan\delta = \frac{2\gamma\omega}{\omega_0^2 - \omega^2}, \quad 0 \le \delta \le \pi,$$
e $x_p = A\cos(\omega t - \delta)$. Abaixo da ressonância o bloco acompanha a força ($\delta \to 0$); em $\omega = \omega_0$ o atraso é exatamente $90^\circ$; muito acima, o bloco se move em oposição ($\delta \to 180^\circ$).

### 4. Pico de amplitude
$A$ é máxima onde o denominador $D(\omega) = (\omega_0^2 - \omega^2)^2 + 4\gamma^2\omega^2$ é mínimo. Derivando em relação a $\omega^2$:
$$\frac{dD}{d(\omega^2)} = -2(\omega_0^2 - \omega^2) + 4\gamma^2 = 0 \;\Rightarrow\; \omega_r = \sqrt{\omega_0^2 - 2\gamma^2},$$
que existe só se $\gamma < \omega_0/\sqrt2$. Para amortecimento fraco $\omega_r \approx \omega_0$ e $A_{max} \approx F_0/(2m\gamma\omega_0) = Q\,F_0/k$: a resposta estática $F_0/k$ é amplificada pelo fator $Q$.

### 5. Potência e largura da ressonância
A potência média que a força entrega, igual à dissipada no regime permanente, é
$$\bar P = \overline{F\dot x} = \tfrac12 F_0\,\omega A\sin\delta = \frac{F_0^2}{2m}\,\frac{2\gamma\omega^2}{(\omega_0^2 - \omega^2)^2 + (2\gamma\omega)^2},$$
máxima exatamente em $\omega = \omega_0$. Perto do pico, com $\omega_0^2 - \omega^2 \approx 2\omega_0(\omega_0 - \omega)$, a curva vira uma lorentziana que cai à metade em $|\omega - \omega_0| = \gamma$. A largura a meia potência é $\Delta\omega = 2\gamma$ e
$$Q = \frac{\omega_0}{2\gamma} = \frac{\omega_0}{\Delta\omega} = \frac{\sqrt{mk}}{b}.$$

### 6. Transiente e batimentos
Partindo do repouso, $x_h = C e^{-\gamma t}\cos(\omega_d t + \varphi)$, com $\omega_d = \sqrt{\omega_0^2 - \gamma^2}$ e $C$, $\varphi$ fixados por $x(0) = \dot x(0) = 0$. Enquanto o transiente não morre, a soma de duas oscilações de frequências $\omega$ e $\omega_d$ produz batimentos com frequência angular $|\omega - \omega_d|$; o regime permanente é atingido após alguns múltiplos de $1/\gamma$.

### 7. Método numérico
- Estado: $(x, \dot x, W_{ext}, E_d, \psi)$, com $\dot W_{ext} = F\dot x$ (trabalho da força), $\dot E_d = b\dot x^2$ (energia dissipada) e $\dot\psi = \omega$ (fase da força, para que mudar $\omega$ ao vivo não provoque saltos).
- Runge–Kutta de 4ª ordem com passo $h = 1$ ms. As curvas $A(\omega)$ e $\delta(\omega)$ do palco usam as fórmulas fechadas acima.`;
//#endregion
//#region sims/ressonancia/src/index.ts
var X = 0;
var V = 1;
var WIN = 2;
var WD = 3;
var PSI = 4;
var DEG = Math.PI / 180;
var omega0 = (p) => Math.sqrt(num(p, "k", 25) / num(p, "m", 1));
var gammaOf = (p) => num(p, "b", .5) / (2 * num(p, "m", 1));
var qualityFactor = (p) => omega0(p) / (2 * gammaOf(p));
/** Amplitude em regime permanente A(ω) = (F₀/m) / √((ω₀² − ω²)² + (2γω)²). */
function steadyAmplitude$1(p, w = num(p, "w", 4)) {
	const w0 = omega0(p), g = gammaOf(p);
	return num(p, "F0", 1) / num(p, "m", 1) / Math.hypot(w0 * w0 - w * w, 2 * g * w);
}
/** Atraso de fase δ(ω) ∈ [0, π] do deslocamento em relação à força. */
function phaseLag(p, w = num(p, "w", 4)) {
	const w0 = omega0(p), g = gammaOf(p);
	return Math.atan2(2 * g * w, w0 * w0 - w * w);
}
/** Frequência de ressonância de amplitude ω_r = √(ω₀² − 2γ²) (0 se não houver pico). */
function resonanceOmega(p) {
	return Math.sqrt(Math.max(0, omega0(p) ** 2 - 2 * gammaOf(p) ** 2));
}
var peakAmplitude = (p) => steadyAmplitude$1(p, resonanceOmega(p));
var forceOf = (s, p) => num(p, "F0", 1) * Math.cos(s[PSI]);
var steadyX = (s, p) => steadyAmplitude$1(p) * Math.cos(s[PSI] - phaseLag(p));
function derivatives(s, p) {
	const m = num(p, "m", 1), k = num(p, "k", 25), b = num(p, "b", .5);
	const F = forceOf(s, p);
	const v = s[V];
	return [
		v,
		(F - k * s[X] - b * v) / m,
		F * v,
		b * v * v,
		num(p, "w", 4)
	];
}
var GR = {
	x0: -1.1,
	x1: .55,
	yc: -.5,
	h: .42
};
var RC = {
	x0: .82,
	x1: 2.38,
	y0: .12,
	y1: .86
};
var PH$1 = {
	x0: .82,
	x1: 2.38,
	y0: -.92,
	y1: -.3
};
var fmt$2 = (v, d = 3) => Number.isFinite(v) ? Number(v.toPrecision(d)).toString().replace(".", ",") : "∞";
function drawSpringMass(d, s, p, xd) {
	const { theme } = d;
	const y = .55, h = .2, bw = .2, wall = -1.1, eq = -.3;
	const xb = eq + xd;
	d.line(wall, y - h / 2 - .02, .6, y - h / 2 - .02, {
		color: theme.muted,
		width: 1,
		alpha: .6
	});
	d.support(wall, y - h / 2, wall, .65 + .05, { color: theme.muted });
	d.spring(wall, y, xb - bw / 2, y, {
		color: theme.muted,
		coils: 10,
		width: 1.8
	});
	d.line(eq, y - h / 2 - .06, eq, .68, {
		color: theme.grid,
		dash: [3, 3]
	});
	d.rect(xb - bw / 2, y - h / 2, bw, h, {
		fill: theme.series[1],
		stroke: theme.text,
		width: 1
	});
	const F = forceOf(s, p), F0 = Math.max(1e-9, num(p, "F0", 1));
	d.arrowPx(xb, .72, F, 0, Math.abs(F) / F0 * 60, { color: theme.accent });
	d.text("F(t) = F₀ cos ωt", xb, .81, {
		color: theme.accent,
		size: 11
	});
}
function drawBridge(d, s, p, xd) {
	const { theme } = d;
	const xa = -1, xb = .5, deckY = .45, top = .92;
	const span = 1.5;
	const defl = (u) => xd * .6 * Math.sin(Math.PI * u);
	d.rect(-1.15, .12, 1.75, .08, {
		fill: theme.series[0],
		alpha: .18
	});
	for (const xt of [xa, xb]) d.rect(xt - .025, .2, .05, .72, { fill: theme.muted });
	const deck = [];
	const n = 40;
	for (let i = 0; i <= n; i++) deck.push([xa + span * i / n, deckY + defl(i / n)]);
	d.polyline(deck, {
		color: theme.series[1],
		width: 6
	});
	d.polyline([[-1.15, deckY], [xa, deckY]], {
		color: theme.series[1],
		width: 6
	});
	d.polyline([[xb, deckY], [.6, deckY]], {
		color: theme.series[1],
		width: 6
	});
	const cable = (u) => top - 1.44 * u * (1 - u);
	const cpts = [];
	for (let i = 0; i <= n; i++) cpts.push([xa + span * i / n, cable(i / n)]);
	d.polyline(cpts, {
		color: theme.text,
		width: 1.5
	});
	for (let i = 1; i < 10; i++) {
		const u = i / 10;
		d.line(xa + span * u, cable(u), xa + span * u, deckY + defl(u) + .01, {
			color: theme.muted,
			width: 1
		});
	}
	const F = forceOf(s, p), F0 = Math.max(1e-9, num(p, "F0", 1));
	d.arrowPx(-.25, deckY + defl(.5) - .05, 0, F, Math.abs(F) / F0 * 40, { color: theme.accent });
	d.text("excitação periódica", -.19, .25, {
		color: theme.accent,
		size: 10,
		align: "left"
	});
	d.text("modelo de 1 modo (ilustrativo)", -1.12, .98, {
		color: theme.muted,
		size: 10,
		align: "left"
	});
}
var ressonancia = defineSim({
	id: "ressonancia",
	title: "Oscilador forçado e ressonância",
	course: "FG II",
	topic: "Oscilações",
	priority: "P1",
	summary: "Um oscilador amortecido empurrado por uma força senoidal. Varra a frequência e veja a curva de ressonância, o atraso de fase, o fator Q, o transiente com batimentos e uma ponte de amortecimento baixo.",
	derivation: derivation$1,
	equations: [
		String.raw`m\ddot x + b\dot x + kx = F_0\cos\omega t`,
		String.raw`x_p = A(\omega)\cos(\omega t - \delta) \qquad A(\omega) = \frac{F_0/m}{\sqrt{(\omega_0^2-\omega^2)^2 + (2\gamma\omega)^2}} \qquad \tan\delta = \frac{2\gamma\omega}{\omega_0^2-\omega^2}`,
		String.raw`Q = \frac{\omega_0}{2\gamma} = \frac{\omega_0}{\Delta\omega} \qquad \omega_r = \sqrt{\omega_0^2 - 2\gamma^2} \qquad \bar P = \tfrac12 F_0\,\omega A\sin\delta`,
		String.raw`x = x_p + x_h,\quad x_h \propto e^{-\gamma t}\cos(\omega_d t + \varphi) \;\Rightarrow\; \text{batimento com } |\omega - \omega_d|`
	],
	liveEquations(_s, p) {
		const w = num(p, "w", 4);
		return [String.raw`\omega/\omega_0 = ${texNum(w / omega0(p))} \qquad A = ${texNum(steadyAmplitude$1(p))}\ \text{m} \qquad \delta = ${texNum(phaseLag(p) / DEG)}^\circ \qquad Q = ${texNum(qualityFactor(p))}`, String.raw`\bar P = ${texNum(.5 * num(p, "F0", 1) * w * steadyAmplitude$1(p) * Math.sin(phaseLag(p)))}\ \text{W} \qquad A_{\text{máx}} = ${texNum(peakAmplitude(p))}\ \text{m em } \omega_r = ${texNum(resonanceOmega(p))}\ \text{rad/s}`];
	},
	params: [
		{
			key: "modo",
			label: "Montagem",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			live: true,
			options: [{
				value: 0,
				label: "Massa-mola com força externa"
			}, {
				value: 1,
				label: "Ponte (modelo ilustrativo)"
			}]
		},
		{
			key: "m",
			label: "Massa",
			unit: "kg",
			min: .2,
			max: 5,
			step: .1,
			default: 1
		},
		{
			key: "k",
			label: "Constante da mola k",
			unit: "N/m",
			min: 5,
			max: 200,
			step: 1,
			default: 25
		},
		{
			key: "b",
			label: "Amortecimento b",
			unit: "N·s/m",
			min: .02,
			max: 20,
			step: .01,
			default: .5,
			live: true,
			log: true
		},
		{
			key: "F0",
			label: "Amplitude da força F₀",
			unit: "N",
			min: 0,
			max: 10,
			step: .1,
			default: 1,
			live: true
		},
		{
			key: "w",
			label: "Frequência da força ω",
			unit: "rad/s",
			min: .5,
			max: 15,
			step: .05,
			default: 4,
			live: true
		}
	],
	observables: [
		{
			key: "x",
			label: "Posição x",
			unit: "m",
			value: (s) => s[X]
		},
		{
			key: "v",
			label: "Velocidade v",
			unit: "m/s",
			value: (s) => s[V]
		},
		{
			key: "F",
			label: "Força externa F",
			unit: "N",
			value: (s, p) => forceOf(s, p)
		},
		{
			key: "xp",
			label: "Solução de regime permanente x_p",
			unit: "m",
			value: (s, p) => steadyX(s, p)
		},
		{
			key: "xh",
			label: "Transiente x − x_p",
			unit: "m",
			value: (s, p) => s[X] - steadyX(s, p)
		},
		{
			key: "A",
			label: "Amplitude de regime A(ω)",
			unit: "m",
			value: (_s, p) => steadyAmplitude$1(p)
		},
		{
			key: "delta",
			label: "Atraso de fase δ",
			unit: "°",
			value: (_s, p) => phaseLag(p) / DEG
		},
		{
			key: "Q",
			label: "Fator de qualidade Q",
			unit: "",
			value: (_s, p) => qualityFactor(p)
		},
		{
			key: "Pmed",
			label: "Potência média em regime",
			unit: "W",
			value: (_s, p) => .5 * num(p, "F0", 1) * num(p, "w", 4) * steadyAmplitude$1(p) * Math.sin(phaseLag(p))
		},
		{
			key: "P",
			label: "Potência instantânea da força",
			unit: "W",
			value: (s, p) => forceOf(s, p) * s[V]
		},
		{
			key: "Win",
			label: "Trabalho da força externa",
			unit: "J",
			value: (s) => s[WIN]
		},
		{
			key: "Wd",
			label: "Energia dissipada",
			unit: "J",
			value: (s) => s[WD]
		},
		{
			key: "bal",
			label: "E + E_dissipada − W_força",
			unit: "J",
			value: (s, p) => .5 * num(p, "m", 1) * s[V] ** 2 + .5 * num(p, "k", 25) * s[X] ** 2 + s[WD] - s[WIN]
		}
	],
	conserved: "bal",
	chart: {
		x: "t",
		y: "x"
	},
	scenarios: [
		{
			id: "varredura",
			label: "Varredura de frequência",
			params: {
				modo: 0,
				m: 1,
				k: 25,
				b: .5,
				F0: 1,
				w: 3
			},
			guide: `### Curva de ressonância
1. Espere o transiente morrer e compare a amplitude do bloco com a marca na curva $A(\\omega)$.
2. Aumente $\\omega$ aos poucos até $\\omega_0 = 5$ rad/s. A amplitude cresce e o atraso de fase passa por $90^\\circ$.
3. Acima de $\\omega_0$ o bloco se move **contra** a força ($\\delta \\to 180^\\circ$).
4. A faixa marcada na curva tem largura $\\Delta\\omega = b/m$ (meia potência): confira que $Q = \\omega_0/\\Delta\\omega$.`,
			predict: [{
				question: "Exatamente em ω = ω₀, o deslocamento em relação à força está:",
				options: [
					"em fase (δ = 0)",
					"atrasado 90°",
					"em oposição (δ = 180°)"
				],
				answer: 1,
				explanation: "Em $\\omega = \\omega_0$, $\\tan\\delta \\to \\infty$: $\\delta = 90^\\circ$. A **velocidade** fica em fase com a força e a potência entregue é máxima."
			}]
		},
		{
			id: "batimento",
			label: "Batimentos perto da ressonância",
			params: {
				modo: 0,
				m: 1,
				k: 25,
				b: .05,
				F0: 1,
				w: 4.5
			},
			guide: `### Transiente + regime
1. Partindo do repouso, $x = x_p + x_h$: a resposta forçada (frequência $\\omega$) soma-se à oscilação natural (frequência $\\omega_d \\approx \\omega_0$).
2. Com amortecimento pequeno o transiente demora a sumir e as duas frequências **batem**: a envoltória pulsa com período $2\\pi/|\\omega - \\omega_d| \\approx 12{,}6$ s.
3. Plote **Transiente x − x_p** e veja ele decair como $e^{-\\gamma t}$.
4. Aproxime $\\omega$ de 5 rad/s: o batimento fica mais lento e a amplitude cresce quase linearmente no começo.`,
			predict: [{
				question: "Com ω = 4,5 rad/s e ω₀ = 5 rad/s, de quanto em quanto tempo a amplitude volta a ser máxima no começo?",
				options: [
					"cerca de 1,3 s",
					"cerca de 12,6 s",
					"não há batimento"
				],
				answer: 1,
				explanation: "O batimento tem frequência angular $|\\omega - \\omega_d| \\approx 0{,}5$ rad/s, período $2\\pi/0{,}5 \\approx 12{,}6$ s."
			}]
		},
		{
			id: "ponte",
			label: "Ponte com amortecimento baixo",
			params: {
				modo: 1,
				m: 2,
				k: 50,
				b: .2,
				F0: .5,
				w: 5
			},
			guide: `### Estruturas e ressonância
1. Uma estrutura esbelta tem modos de vibração com amortecimento muito baixo ($Q$ da ordem de 50 a 100). Aqui $Q = 50$.
2. Uma excitação periódica fraca, na frequência do modo, acumula energia ciclo a ciclo: a amplitude cresce até que a potência dissipada $b\\langle v^2\\rangle$ iguale a fornecida.
3. Mude $\\omega$ em 5%: a amplitude final despenca. Dobre $b$: o pico cai à metade.
4. **Cuidado com o mito:** a ponte de Tacoma Narrows (1940) não caiu por ressonância com rajadas periódicas. O colapso foi **flutter aeroelástico**, uma auto-excitação em que o próprio movimento torsional realimenta a força do vento (amortecimento efetivo negativo). Este modelo só ilustra por que o amortecimento baixo é perigoso.`
		}
	],
	exercises: [{
		id: "amplitude",
		prompt: "Um bloco de {m} kg preso a uma mola de {k} N/m, com b = {b} N·s/m, é forçado por F₀ = {F0} N com frequência angular {w} rad/s. Qual é a amplitude em regime permanente?",
		vary: {
			m: [
				.5,
				3,
				1
			],
			k: [
				10,
				100,
				0
			],
			b: [
				.2,
				3,
				1
			],
			F0: [
				.5,
				5,
				1
			],
			w: [
				1,
				12,
				1
			]
		},
		answer: {
			label: "A",
			unit: "m",
			compute: (p) => steadyAmplitude$1(p)
		},
		hint: "A = (F₀/m)/√((ω₀² − ω²)² + (bω/m)²)."
	}, {
		id: "largura",
		prompt: "Um oscilador de {m} kg com mola de {k} N/m tem b = {b} N·s/m. Qual é o fator de qualidade Q?",
		vary: {
			m: [
				.5,
				5,
				1
			],
			k: [
				10,
				200,
				0
			],
			b: [
				.05,
				2,
				2
			]
		},
		answer: {
			label: "Q",
			unit: "",
			compute: (p) => qualityFactor(p)
		},
		hint: "Q = ω₀/(2γ) = √(mk)/b."
	}],
	init: () => [
		0,
		0,
		0,
		0,
		0
	],
	derivatives,
	dt: .001,
	sampleEvery: 10,
	tEnd: 120,
	viewport: () => ({
		xMin: -1.15,
		xMax: 2.45,
		yMin: -1.05,
		yMax: 1.05,
		unit: ""
	}),
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: s, params: p, theme, t, trail } = frame;
		const Apk = Math.max(peakAmplitude(p), 1e-9);
		const A = steadyAmplitude$1(p);
		const w0 = omega0(p), w = num(p, "w", 4);
		const Tw = Math.max(8 * (2 * Math.PI / w0), 25);
		const tStart = Math.max(0, t - Tw);
		const dts = .01;
		let xmax = Math.max(1.6 * A, Math.abs(s[X]), 1e-6);
		for (let i = Math.max(0, Math.floor(tStart / dts)); i < trail.length; i++) xmax = Math.max(xmax, Math.abs(trail[i][X]));
		const sx = .42 / xmax;
		const xd = Math.max(-.6, Math.min(.6, s[X] * sx));
		if (Math.round(num(p, "modo")) === 1) drawBridge(d, s, p, xd);
		else drawSpringMass(d, s, p, xd);
		const gx = (tt) => GR.x0 + (tt - tStart) / Tw * (GR.x1 - GR.x0);
		const gy = (x) => GR.yc + Math.max(-1.2, Math.min(1.2, x / xmax)) * GR.h;
		d.rect(GR.x0, GR.yc - GR.h * 1.25, GR.x1 - GR.x0, GR.h * 2.5, {
			stroke: theme.grid,
			width: 1
		});
		d.line(GR.x0, GR.yc, GR.x1, GR.yc, {
			color: theme.muted,
			width: 1
		});
		for (const sg of [1, -1]) d.line(GR.x0, gy(sg * A), GR.x1, gy(sg * A), {
			color: theme.series[2],
			dash: [5, 4],
			width: 1.2
		});
		const pts = [];
		for (let i = Math.max(0, Math.floor(tStart / dts)); i < trail.length; i++) pts.push([gx(i * dts), gy(trail[i][X])]);
		pts.push([gx(t), gy(s[X])]);
		d.polyline(pts, {
			color: theme.series[1],
			width: 1.8
		});
		d.text("x(t)", GR.x0 + .02, GR.yc + GR.h * 1.25 - .02, {
			color: theme.muted,
			size: 11,
			align: "left",
			baseline: "top"
		});
		d.text("±A(ω) de regime", GR.x1 - .02, GR.yc + GR.h * 1.25 - .02, {
			color: theme.series[2],
			size: 10,
			align: "right",
			baseline: "top"
		});
		d.text(`escala: ±${fmt$2(xmax)} m (pico possível: ${fmt$2(Apk)} m)`, GR.x0 + .02, GR.yc - GR.h * 1.25 + .02, {
			color: theme.muted,
			size: 10,
			align: "left",
			baseline: "bottom"
		});
		const wMax = Math.max(2 * w0, 1.1 * w, 1);
		const rx = (ww) => RC.x0 + ww / wMax * (RC.x1 - RC.x0);
		const ry = (a) => RC.y0 + Math.min(1.05, a / (1.05 * Apk)) * (RC.y1 - RC.y0);
		d.arrow(RC.x0, RC.y0, RC.x1 - RC.x0 + .04, 0, {
			color: theme.muted,
			width: 1.2,
			head: 7
		});
		d.arrow(RC.x0, RC.y0, 0, RC.y1 - RC.y0 + .06, {
			color: theme.muted,
			width: 1.2,
			head: 7
		});
		d.text("A(ω)", RC.x0 + .03, RC.y1 + .06, {
			color: theme.text,
			size: 11,
			align: "left",
			weight: "600"
		});
		d.text("ω", RC.x1 + .05, RC.y0 - .04, {
			color: theme.muted,
			size: 11
		});
		const g = gammaOf(p);
		if (g < .5 * w0) {
			const half = Apk / Math.SQRT2;
			const wm = Math.sqrt(w0 * w0 + g * g) - g, wp = Math.sqrt(w0 * w0 + g * g) + g;
			d.rect(rx(wm), RC.y0, rx(wp) - rx(wm), ry(half) - RC.y0, {
				fill: theme.series[2],
				alpha: .15
			});
			d.line(rx(wm), ry(half), rx(wp), ry(half), {
				color: theme.series[2],
				width: 1.5
			});
			d.text("Δω", rx(wp) + .03, ry(half), {
				color: theme.series[2],
				size: 10,
				align: "left"
			});
		}
		d.line(rx(w0), RC.y0, rx(w0), RC.y1, {
			color: theme.grid,
			dash: [3, 4]
		});
		d.text("ω₀", rx(w0), RC.y0 - .05, {
			color: theme.muted,
			size: 10
		});
		const aPts = [];
		for (let i = 0; i <= 400; i++) {
			const ww = wMax * i / 400;
			aPts.push([rx(ww), ry(steadyAmplitude$1(p, ww))]);
		}
		d.polyline(aPts, {
			color: theme.series[1],
			width: 2
		});
		d.dot(rx(w), ry(A), 6, theme.accent);
		d.line(rx(w), RC.y0, rx(w), ry(A), {
			color: theme.accent,
			width: 1,
			dash: [2, 3]
		});
		d.text(`Q = ${fmt$2(qualityFactor(p))}`, RC.x1, RC.y1, {
			color: theme.text,
			size: 11,
			align: "right"
		});
		const fy = (dl) => PH$1.y0 + dl / Math.PI * (PH$1.y1 - PH$1.y0);
		d.arrow(PH$1.x0, PH$1.y0, PH$1.x1 - PH$1.x0 + .04, 0, {
			color: theme.muted,
			width: 1.2,
			head: 7
		});
		d.arrow(PH$1.x0, PH$1.y0, 0, PH$1.y1 - PH$1.y0 + .06, {
			color: theme.muted,
			width: 1.2,
			head: 7
		});
		d.text("δ(ω)", PH$1.x0 + .03, PH$1.y1 + .06, {
			color: theme.text,
			size: 11,
			align: "left",
			weight: "600"
		});
		for (const [dl, lab] of [[Math.PI / 2, "90°"], [Math.PI, "180°"]]) {
			d.line(PH$1.x0, fy(dl), PH$1.x1, fy(dl), {
				color: theme.grid,
				dash: [3, 4]
			});
			d.text(lab, PH$1.x0 - .02, fy(dl), {
				color: theme.muted,
				size: 10,
				align: "right"
			});
		}
		d.line(rx(w0), PH$1.y0, rx(w0), PH$1.y1, {
			color: theme.grid,
			dash: [3, 4]
		});
		d.text("ω₀", rx(w0), PH$1.y0 - .05, {
			color: theme.muted,
			size: 10
		});
		const phPts = [];
		for (let i = 0; i <= 300; i++) {
			const ww = wMax * i / 300;
			phPts.push([rx(ww), fy(phaseLag(p, ww))]);
		}
		d.polyline(phPts, {
			color: theme.series[4],
			width: 2
		});
		d.dot(rx(w), fy(phaseLag(p)), 6, theme.accent);
		d.text("• frequência atual", PH$1.x1, PH$1.y0 + .08, {
			color: theme.accent,
			size: 10,
			align: "right"
		});
	}
});
//#endregion
//#region sims/rlc-ca/src/model.ts
var cx = (re, im = 0) => [re, im];
var cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
var cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
var cdiv = (a, b) => {
	const d = b[0] * b[0] + b[1] * b[1];
	return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d];
};
var cabs = (a) => Math.hypot(a[0], a[1]);
var carg = (a) => Math.atan2(a[1], a[0]);
/** Valor instantâneo de um fasor X quando a fonte está na fase φ: Im(X e^{jφ}) (fonte = Vp sen φ). */
var inst = (a, phi) => a[0] * Math.sin(phi) + a[1] * Math.cos(phi);
var topo = (p) => Math.round(num(p, "topologia"));
var Vp = (p) => num(p, "Vp", 10);
var freq = (p) => num(p, "f", 1e3);
var R = (p) => num(p, "R", 20);
var L = (p) => num(p, "L", 10) * .001;
var C = (p) => num(p, "C", 1) * 1e-6;
var Rg = (p) => num(p, "Rg", 0);
var saida = (p) => Math.round(num(p, "saida"));
var f0 = (p) => 1 / (2 * Math.PI * Math.sqrt(L(p) * C(p)));
/** Fator de qualidade do circuito carregado pelo gerador. */
function quality(p) {
	if (topo(p) === 0) return Math.sqrt(L(p) / C(p)) / (R(p) + Rg(p));
	return (Rg(p) > 0 ? R(p) * Rg(p) / (R(p) + Rg(p)) : R(p)) * Math.sqrt(C(p) / L(p));
}
/** Regime permanente senoidal pelo método fasorial (análise exata, sem integrar). */
function phasors(p, f = freq(p)) {
	const w = 2 * Math.PI * f;
	const zR = cx(R(p));
	const zL = cx(0, w * L(p));
	const zC = cx(0, -1 / (w * C(p)));
	const Vs = cx(Vp(p));
	const rg = cx(Rg(p));
	if (topo(p) === 0) {
		const Z = cadd(cadd(rg, zR), cadd(zL, zC));
		const I = cdiv(Vs, Z);
		const VR = cmul(I, zR);
		const VL = cmul(I, zL);
		const VC = cmul(I, zC);
		const Vout = [
			VR,
			VC,
			VL
		][saida(p)] ?? VR;
		return {
			Z,
			Vs,
			I,
			Vg: cmul(I, rg),
			VR,
			VL,
			VC,
			IR: I,
			IL: I,
			IC: I,
			Vout,
			H: cdiv(Vout, Vs)
		};
	}
	const Y = cadd(cadd(cdiv(cx(1), zR), cdiv(cx(1), zL)), cdiv(cx(1), zC));
	const Zp = cdiv(cx(1), Y);
	const Z = cadd(rg, Zp);
	const I = cdiv(Vs, Z);
	const Vt = cmul(I, Zp);
	return {
		Z,
		Vs,
		I,
		Vg: cmul(I, rg),
		VR: Vt,
		VL: Vt,
		VC: Vt,
		IR: cdiv(Vt, zR),
		IL: cdiv(Vt, zL),
		IC: cdiv(Vt, zC),
		Vout: Vt,
		H: cdiv(Vt, Vs)
	};
}
/** Ciclos da fonte por segundo de animação (câmera lenta). */
var ritmo = (p) => num(p, "ritmo", .5);
function elements(p, s, vs) {
	const ic = Number.isNaN(s[3]) ? void 0 : s[3];
	const vl = Number.isNaN(s[5]) ? void 0 : s[5];
	const src = {
		kind: "V",
		a: 1,
		b: 0,
		V: vs,
		R: Rg(p)
	};
	if (topo(p) === 0) return [
		src,
		{
			kind: "R",
			a: 1,
			b: 2,
			R: R(p)
		},
		{
			kind: "L",
			a: 2,
			b: 3,
			L: L(p),
			i0: s[4],
			v0: vl
		},
		{
			kind: "C",
			a: 3,
			b: 0,
			C: C(p),
			v0: s[2],
			i0: ic
		}
	];
	return [
		src,
		{
			kind: "R",
			a: 1,
			b: 0,
			R: R(p)
		},
		{
			kind: "L",
			a: 1,
			b: 0,
			L: L(p),
			i0: s[4],
			v0: vl
		},
		{
			kind: "C",
			a: 1,
			b: 0,
			C: C(p),
			v0: s[2],
			i0: ic
		}
	];
}
/** Um passo físico de duração h (s): a fonte avança 2πf·h em fase. */
function stepPhysical(s, p, h) {
	const out = s.slice();
	const phi = s[1] + 2 * Math.PI * freq(p) * h;
	const vs = Vp(p) * Math.sin(phi);
	const els = elements(p, s, vs);
	const sol = solveCircuit(topo(p) === 0 ? 4 : 2, els, h);
	commitHistory(els, sol);
	const eL = els[2];
	const eC = els[3];
	out[0] += h;
	out[1] = phi;
	out[2] = eC.v0;
	out[3] = eC.i0 ?? 0;
	out[4] = eL.i0;
	out[5] = eL.v0 ?? 0;
	out[6] = vs;
	out[7] = -sol.i[0];
	out[8] = sol.dv[1];
	out[9] = sol.i[1];
	return out;
}
/** Passo do runner: dt de animação vira dt·ritmo/f de tempo físico. */
function step(s, p, dt) {
	return stepPhysical(s, p, dt * ritmo(p) / freq(p));
}
function init(p) {
	if (Math.round(num(p, "inicio")) === 1) {
		const ph = phasors(p);
		return [
			0,
			0,
			inst(ph.VC, 0),
			inst(ph.IC, 0),
			inst(ph.IL, 0),
			inst(ph.VL, 0),
			0,
			inst(ph.I, 0),
			inst(ph.VR, 0),
			inst(ph.IR, 0)
		];
	}
	return [
		0,
		0,
		0,
		NaN,
		0,
		NaN,
		0,
		0,
		0,
		0
	];
}
/** Tensão no indutor no estado atual (série: v_L = v_s − Rg i − v_R − v_C). */
var vInd = (s, p) => topo(p) === 0 ? s[6] - Rg(p) * s[7] - s[8] - s[2] : s[2];
var iCap = (s, p) => topo(p) === 0 ? s[7] : s[7] - s[9] - s[4];
function vOut(s, p) {
	if (topo(p) === 1) return s[2];
	return [
		s[8],
		s[2],
		vInd(s, p)
	][saida(p)] ?? s[8];
}
//#endregion
//#region sims/rlc-ca/src/symbols.ts
/** Formata um valor com prefixo SI e vírgula decimal ("4,7 kΩ", "100 µF"). */
function si(v, unit, digits = 3) {
	if (!Number.isFinite(v)) return `— ${unit}`;
	if (v === 0) return `0 ${unit}`;
	const prefixes = [
		[1e6, "M"],
		[1e3, "k"],
		[1, ""],
		[.001, "m"],
		[1e-6, "µ"],
		[1e-9, "n"]
	];
	const a = Math.abs(v);
	const [f, pre] = prefixes.find(([f]) => a >= f * .9995) ?? prefixes[prefixes.length - 1];
	return `${Number((v / f).toPrecision(digits)).toString().replace(".", ",")} ${pre}${unit}`;
}
/** Vetor unitário e normal de um segmento. */
function frame(x1, y1, x2, y2) {
	const len = Math.hypot(x2 - x1, y2 - y1) || 1;
	const ux = (x2 - x1) / len;
	const uy = (y2 - y1) / len;
	return {
		len,
		ux,
		uy,
		nx: -uy,
		ny: ux,
		mx: (x1 + x2) / 2,
		my: (y1 + y2) / 2
	};
}
/** Resistor em zigue-zague ocupando o trecho central (meio-comprimento `half`). */
function resistor(d, x1, y1, x2, y2, half, s) {
	const f = frame(x1, y1, x2, y2);
	const w = s.width ?? 2;
	const a = [f.mx - f.ux * half, f.my - f.uy * half];
	const b = [f.mx + f.ux * half, f.my + f.uy * half];
	d.line(x1, y1, a[0], a[1], {
		color: s.color,
		width: w
	});
	d.line(b[0], b[1], x2, y2, {
		color: s.color,
		width: w
	});
	const pts = [a];
	const n = 6;
	const amp = 7 * d.px;
	for (let i = 0; i < n; i++) {
		const t = -half + 2 * half * (i + .5) / n;
		const side = i % 2 === 0 ? 1 : -1;
		pts.push([f.mx + f.ux * t + f.nx * amp * side, f.my + f.uy * t + f.ny * amp * side]);
	}
	pts.push(b);
	d.polyline(pts, {
		color: s.color,
		width: w
	});
}
/** Capacitor: duas placas perpendiculares ao segmento, separadas por `gapPx`. Devolve os centros das placas. */
function capacitor(d, x1, y1, x2, y2, s) {
	const f = frame(x1, y1, x2, y2);
	const w = s.width ?? 2;
	const g = (s.gapPx ?? 10) / 2 * d.px;
	const pl = (s.platePx ?? 30) / 2 * d.px;
	const pa = [f.mx - f.ux * g, f.my - f.uy * g];
	const pb = [f.mx + f.ux * g, f.my + f.uy * g];
	d.line(x1, y1, pa[0], pa[1], {
		color: s.color,
		width: w
	});
	d.line(pb[0], pb[1], x2, y2, {
		color: s.color,
		width: w
	});
	for (const p of [pa, pb]) d.line(p[0] - f.nx * pl, p[1] - f.ny * pl, p[0] + f.nx * pl, p[1] + f.ny * pl, {
		color: s.color,
		width: w + 1.5
	});
	return {
		pa,
		pb,
		nx: f.nx,
		ny: f.ny,
		ux: f.ux,
		uy: f.uy,
		pl,
		g
	};
}
/** Indutor: `loops` arcos ao longo do trecho central. */
function inductor(d, x1, y1, x2, y2, half, s) {
	const f = frame(x1, y1, x2, y2);
	const w = s.width ?? 2;
	const n = s.loops ?? 4;
	const a = [f.mx - f.ux * half, f.my - f.uy * half];
	const b = [f.mx + f.ux * half, f.my + f.uy * half];
	d.line(x1, y1, a[0], a[1], {
		color: s.color,
		width: w
	});
	d.line(b[0], b[1], x2, y2, {
		color: s.color,
		width: w
	});
	const r = half / n;
	const pts = [];
	for (let k = 0; k < n; k++) {
		const c = -half + r * (2 * k + 1);
		for (let j = 0; j <= 16; j++) {
			const th = Math.PI - Math.PI * j / 16;
			const t = c + r * Math.cos(th);
			const nn = r * 1.1 * Math.sin(th);
			pts.push([f.mx + f.ux * t + f.nx * nn, f.my + f.uy * t + f.ny * nn]);
		}
	}
	d.polyline(pts, {
		color: s.color,
		width: w
	});
}
/** Fonte em círculo (gerador de funções) com um ícone de onda: "seno" ou "quadrada". */
function generator(d, x1, y1, x2, y2, wave, s) {
	const f = frame(x1, y1, x2, y2);
	const w = s.width ?? 2;
	const r = 16 * d.px;
	d.line(x1, y1, f.mx - f.ux * r, f.my - f.uy * r, {
		color: s.color,
		width: w
	});
	d.line(f.mx + f.ux * r, f.my + f.uy * r, x2, y2, {
		color: s.color,
		width: w
	});
	d.circle(f.mx, f.my, r, {
		stroke: s.color,
		width: w
	});
	const a = 9 * d.px;
	if (wave === "seno") d.plot((x) => f.my + .55 * a * Math.sin((x - f.mx) / a * Math.PI), f.mx - a, f.mx + a, {
		color: s.color,
		width: 1.6,
		n: 30
	});
	else d.polyline([
		[f.mx - a, f.my - .5 * a],
		[f.mx - a / 3, f.my - .5 * a],
		[f.mx - a / 3, f.my + .5 * a],
		[f.mx + a / 3, f.my + .5 * a],
		[f.mx + a / 3, f.my - .5 * a],
		[f.mx + a, f.my - .5 * a]
	], {
		color: s.color,
		width: 1.6
	});
}
/** Seta de corrente no meio de um fio, com comprimento fixo em pixels; sinal de `i` define o sentido. */
function currentArrow(d, x, y, ux, uy, i, color, label) {
	if (Math.abs(i) < 1e-12) return;
	const sgn = Math.sign(i);
	const L = 26;
	d.arrowPx(x - sgn * ux * L * .5 * d.px, y - sgn * uy * L * .5 * d.px, sgn * ux, sgn * uy, L, {
		color,
		width: 2.5
	});
	if (label) d.text(label, x - uy * 14 * d.px, y + ux * 14 * d.px, {
		color,
		size: 12,
		weight: "600"
	});
}
//#endregion
//#region sims/rlc-ca/src/derivation.ts
/** Modo engenharia: circuito RLC em corrente alternada, fasores, ressonância e o transiente por MNA. */
var derivation = String.raw`### 1. Hipóteses
- Gerador senoidal $v_s(t) = V_p\sin\omega t$, $\omega = 2\pi f$, com resistência interna $R_g$.
- Resistor, indutor e capacitor ideais e lineares (indutor sem resistência do fio, capacitor sem fuga), parâmetros concentrados.

### 2. Equações no domínio do tempo
**Série**: a mesma corrente $i$ passa por todos; a lei das malhas dá
$$L\,\frac{di}{dt} + (R + R_g)\,i + \frac{1}{C}\int i\,dt = v_s(t).$$
Derivando, obtém-se um oscilador forçado: $L\ddot q + (R + R_g)\dot q + q/C = v_s$, com a carga $q$ no papel da posição, $L$ no da massa, $R$ no do atrito e $1/C$ no da rigidez.

**Paralelo**: a mesma tensão $v$ está sobre R, L e C; a lei dos nós dá $i = v/R + \frac{1}{L}\int v\,dt + C\,\dot v$.

### 3. Fasores
Em regime permanente todas as grandezas oscilam com a frequência da fonte. Representa-se cada uma por um número complexo $\hat X$ tal que $x(t) = \mathrm{Im}\big(\hat X e^{i\omega t}\big)$. Derivar no tempo vira multiplicar por $j\omega$ (usa-se $j$ para não confundir com a corrente), e as relações de cada elemento ficam algébricas:
$$\hat V_R = R\,\hat I, \qquad \hat V_L = j\omega L\,\hat I, \qquad \hat V_C = \frac{\hat I}{j\omega C}.$$
As impedâncias $Z_R = R$, $Z_L = jX_L$ e $Z_C = -jX_C$, com $X_L = \omega L$ e $X_C = 1/(\omega C)$, se combinam como resistências.

**Série**:
$$Z = R + R_g + j\left(\omega L - \frac{1}{\omega C}\right), \qquad |Z| = \sqrt{(R + R_g)^2 + (X_L - X_C)^2}, \qquad \tan\varphi = \frac{X_L - X_C}{R + R_g},$$
$$\hat I = \hat V_s/Z, \qquad I_p = V_p/|Z|.$$
**Paralelo**: $Y = \dfrac{1}{R} + \dfrac{1}{j\omega L} + j\omega C$, $Z = R_g + 1/Y$.

### 4. Ressonância
No série, $|Z|$ é mínima e a corrente é máxima quando $X_L = X_C$:
$$\omega_0 = \frac{1}{\sqrt{LC}}, \qquad f_0 = \frac{1}{2\pi\sqrt{LC}}.$$
Nesse ponto $Z = R + R_g$ é real, a corrente fica em fase com a fonte e as tensões em L e C são iguais e opostas, cada uma $Q$ vezes maior que a da fonte. O fator de qualidade e a banda de meia potência são
$$Q_{serie} = \frac{1}{R + R_g}\sqrt{\frac{L}{C}} = \frac{\omega_0 L}{R + R_g}, \qquad \Delta f = \frac{f_0}{Q}.$$
No paralelo a admitância é mínima em $\omega_0$ (a impedância é máxima) e $Q_{paralelo} = R_{ef}\sqrt{C/L}$, com $R_{ef} = R\parallel R_g$ quando o gerador tem resistência interna.

### 5. Função de transferência e potência
A saída escolhida (tensão em R, L ou C) define $H(f) = \hat V_{saida}/\hat V_s$, mostrada em decibéis, $|H|_{dB} = 20\log_{10}|H|$. Tomando a saída no resistor tem-se um passa-faixa; no capacitor, um passa-baixa; no indutor, um passa-alta. A potência média entregue pela fonte é
$$\bar P = \frac{1}{T}\int_0^T v_s\,i\,dt = \tfrac12 V_p I_p\cos\varphi,$$
toda dissipada nos resistores, pois L e C só trocam energia com a fonte.

### 6. Método numérico: transiente integrado no tempo
Ao ligar a fonte com o circuito descarregado, a resposta é a solução particular (fasorial) mais a solução homogênea, que decai com $e^{-(R + R_g)t/(2L)}$ no série. Para mostrá-la a simulação resolve o circuito no tempo com análise nodal modificada:
- capacitor e indutor viram modelos companheiros da regra do trapézio: $i_n = \frac{2C}{h}(v_n - v_{n-1}) - i_{n-1}$ e $i_n = i_{n-1} + \frac{h}{2L}(v_n + v_{n-1})$;
- o primeiro passo usa Euler implícito, porque ainda não há corrente (ou tensão) anterior;
- a regra do trapézio é de 2ª ordem e A-estável e não dissipa energia artificialmente, de modo que um LC sem resistência oscila sem perder amplitude.

O tempo é mostrado em câmera lenta: cada segundo de animação avança $\text{ritmo}/f$ segundos físicos, isto é, um número fixo de ciclos da fonte, com passo físico $h = \text{ritmo}/(500 f)$. Com a opção já em regime permanente, o estado inicial é tirado dos fasores e não há transiente.`;
//#endregion
//#region sims/rlc-ca/src/index.ts
var FMIN = 10;
var FMAX = 1e5;
var OUT_LABEL = [
	"V_R",
	"V_C",
	"V_L"
];
var deg$1 = (r) => r * 180 / Math.PI;
var rlcCa = defineSim({
	id: "rlc-ca",
	title: "RLC em corrente alternada: ressonância, fasores e filtros",
	course: "FG III",
	topic: "CA",
	priority: "P1",
	summary: "Um gerador senoidal de frequência ajustável alimenta um RLC em série ou em paralelo. Veja os fasores girando, a impedância complexa, a curva de ressonância com o fator Q e o diagrama de Bode dos filtros, enquanto o transiente é integrado passo a passo.",
	derivation,
	equations: [
		String.raw`Z = R + j\left(\omega L - \frac{1}{\omega C}\right) \qquad |Z| = \sqrt{R^2 + (X_L - X_C)^2} \qquad \tan\varphi = \frac{X_L - X_C}{R}`,
		String.raw`\hat I = \frac{\hat V}{Z} \qquad \hat V_R = R\hat I \qquad \hat V_L = j\omega L\,\hat I \qquad \hat V_C = \frac{\hat I}{j\omega C}`,
		String.raw`f_0 = \frac{1}{2\pi\sqrt{LC}} \qquad Q_{\text{série}} = \frac{1}{R}\sqrt{\frac{L}{C}} \qquad \Delta f = \frac{f_0}{Q}`,
		String.raw`H(f) = \frac{\hat V_{\text{saída}}}{\hat V_{\text{fonte}}} \qquad |H|_{\text{dB}} = 20\log_{10}|H| \qquad \bar P = \tfrac12 V_p I_p\cos\varphi`
	],
	liveEquations(_s, p) {
		const ph = phasors(p);
		const w = 2 * Math.PI * freq(p);
		const XL = w * L(p);
		const XC = 1 / (w * C(p));
		const phi = carg(ph.Z);
		return [
			String.raw`X_L = ${texNum(XL)}\,\Omega \quad X_C = ${texNum(XC)}\,\Omega \quad Z = ${texNum(ph.Z[0])} ${ph.Z[1] < 0 ? "-" : "+"} j\,${texNum(Math.abs(ph.Z[1]))}\ \Omega`,
			String.raw`|Z| = ${texNum(cabs(ph.Z))}\ \Omega \quad \varphi = ${texNum(deg$1(phi))}^\circ \quad I_p = ${texNum(cabs(ph.I))}\ \text{A} \quad \bar P = ${texNum(.5 * num(p, "Vp", 10) * cabs(ph.I) * Math.cos(phi))}\ \text{W}`,
			String.raw`f_0 = ${texNum(f0(p))}\ \text{Hz} \quad Q = ${texNum(quality(p))} \quad |H| = ${texNum(20 * Math.log10(cabs(ph.H)))}\ \text{dB} \quad \angle H = ${texNum(deg$1(carg(ph.H)))}^\circ`
		];
	},
	params: [
		{
			key: "topologia",
			label: "Ligação",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "RLC em série"
			}, {
				value: 1,
				label: "RLC em paralelo (tanque)"
			}]
		},
		{
			key: "saida",
			label: "Saída do filtro (série)",
			unit: "",
			min: 0,
			max: 2,
			step: 1,
			default: 0,
			live: true,
			options: [
				{
					value: 0,
					label: "V_R: passa-faixa"
				},
				{
					value: 1,
					label: "V_C: passa-baixas"
				},
				{
					value: 2,
					label: "V_L: passa-altas"
				}
			]
		},
		{
			key: "grafico",
			label: "Gráfico do palco",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			live: true,
			options: [{
				value: 0,
				label: "Diagrama de Bode (|H| e fase)"
			}, {
				value: 1,
				label: "Curva de ressonância I(f)"
			}]
		},
		{
			key: "inicio",
			label: "Início",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			options: [{
				value: 0,
				label: "Ligar a fonte em t = 0 (com transiente)"
			}, {
				value: 1,
				label: "Já em regime permanente"
			}]
		},
		{
			key: "f",
			label: "Frequência da fonte f",
			unit: "Hz",
			min: FMIN,
			max: FMAX,
			step: 1,
			default: 1e3,
			log: true,
			live: true
		},
		{
			key: "Vp",
			label: "Amplitude da fonte V_p",
			unit: "V",
			min: 1,
			max: 20,
			step: .5,
			default: 10,
			live: true
		},
		{
			key: "R",
			label: "Resistência R",
			unit: "Ω",
			min: 1,
			max: 1e4,
			step: 1,
			default: 20,
			log: true,
			live: true
		},
		{
			key: "L",
			label: "Indutância L",
			unit: "mH",
			min: .1,
			max: 1e3,
			step: .1,
			default: 10,
			log: true,
			live: true
		},
		{
			key: "C",
			label: "Capacitância C",
			unit: "µF",
			min: .001,
			max: 100,
			step: .001,
			default: 1,
			log: true,
			live: true
		},
		{
			key: "Rg",
			label: "Resistência interna do gerador",
			unit: "Ω",
			min: 0,
			max: 1e3,
			step: 1,
			default: 0,
			live: true
		},
		{
			key: "ritmo",
			label: "Câmera lenta (ciclos por segundo de animação)",
			unit: "ciclos/s",
			min: .25,
			max: 5,
			step: .25,
			default: .5,
			live: true,
			options: [
				.25,
				.5,
				1,
				2,
				5
			].map((v) => ({
				value: v,
				label: `${String(v).replace(".", ",")} ciclo/s`
			}))
		}
	],
	observables: [
		{
			key: "tf",
			label: "Tempo físico",
			unit: "s",
			value: (s) => s[0]
		},
		{
			key: "vs",
			label: "Tensão da fonte",
			unit: "V",
			value: (s) => s[6]
		},
		{
			key: "i",
			label: "Corrente da fonte i",
			unit: "A",
			value: (s) => s[7]
		},
		{
			key: "vR",
			label: "Tensão no resistor",
			unit: "V",
			value: (s) => s[8]
		},
		{
			key: "vL",
			label: "Tensão no indutor",
			unit: "V",
			value: (s, p) => vInd(s, p)
		},
		{
			key: "vC",
			label: "Tensão no capacitor",
			unit: "V",
			value: (s) => s[2]
		},
		{
			key: "iL",
			label: "Corrente no indutor",
			unit: "A",
			value: (s) => s[4]
		},
		{
			key: "iC",
			label: "Corrente no capacitor",
			unit: "A",
			value: (s, p) => iCap(s, p)
		},
		{
			key: "iR",
			label: "Corrente no resistor",
			unit: "A",
			value: (s) => s[9]
		},
		{
			key: "vout",
			label: "Tensão de saída",
			unit: "V",
			value: (s, p) => vOut(s, p)
		},
		{
			key: "ireg",
			label: "Corrente de regime (fasor)",
			unit: "A",
			value: (s, p) => inst(phasors(p).I, s[1])
		},
		{
			key: "itr",
			label: "Parte transitória da corrente",
			unit: "A",
			value: (s, p) => s[7] - inst(phasors(p).I, s[1])
		},
		{
			key: "Ip",
			label: "Amplitude da corrente (regime)",
			unit: "A",
			value: (_s, p) => cabs(phasors(p).I)
		},
		{
			key: "Z",
			label: "Módulo da impedância |Z|",
			unit: "Ω",
			value: (_s, p) => cabs(phasors(p).Z)
		},
		{
			key: "phi",
			label: "Defasagem φ (tensão − corrente)",
			unit: "°",
			value: (_s, p) => deg$1(carg(phasors(p).Z))
		},
		{
			key: "P",
			label: "Potência média",
			unit: "W",
			value: (_s, p) => .5 * num(p, "Vp", 10) * cabs(phasors(p).I) * Math.cos(carg(phasors(p).Z))
		},
		{
			key: "HdB",
			label: "Ganho |H|",
			unit: "dB",
			value: (_s, p) => 20 * Math.log10(cabs(phasors(p).H))
		},
		{
			key: "f0",
			label: "Frequência de ressonância",
			unit: "Hz",
			value: (_s, p) => f0(p)
		},
		{
			key: "Q",
			label: "Fator de qualidade Q",
			unit: "",
			value: (_s, p) => quality(p)
		}
	],
	chart: {
		x: "tf",
		y: "i"
	},
	scenarios: [
		{
			id: "ressonancia",
			label: "Ressonância em série",
			params: {
				topologia: 0,
				saida: 0,
				grafico: 1,
				inicio: 1,
				f: 500,
				Vp: 10,
				R: 20,
				L: 10,
				C: 1,
				Rg: 0
			},
			guide: `### Procurando a ressonância
O circuito começa em regime permanente com $f = 500$ Hz.
1. Suba **f** devagar e acompanhe o marcador na curva de ressonância: a corrente é máxima em $f_0 = 1/(2\\pi\\sqrt{LC}) \\approx 1{,}59$ kHz.
2. Na ressonância $X_L = X_C$: os fasores $\\hat V_L$ e $\\hat V_C$ se cancelam e $\\hat I$ fica em fase com a fonte ($\\varphi = 0$).
3. Leia as tensões: $|V_L| = |V_C| = Q\\,V_p$, maiores que a da fonte!
4. Aumente **R** e veja a curva alargar: a largura entre os pontos de meia potência é $\\Delta f = f_0/Q$.`,
			predict: [{
				question: "Na ressonância de um RLC série com Q = 5 e fonte de 10 V de pico, a amplitude da tensão no capacitor é:",
				options: [
					"menor que 10 V",
					"exatamente 10 V",
					"cerca de 50 V"
				],
				answer: 2,
				explanation: "Em $f_0$, $I_p = V_p/R$ e $V_C = I_p X_C = V_p\\,\\frac{X_C}{R} = Q V_p$. As tensões de L e C, opostas, se cancelam no laço."
			}]
		},
		{
			id: "fasores",
			label: "Fasores e defasagem",
			params: {
				topologia: 0,
				saida: 0,
				grafico: 0,
				inicio: 0,
				f: 800,
				Vp: 10,
				R: 50,
				L: 10,
				C: 1,
				Rg: 0,
				ritmo: .5
			},
			guide: `### Diagrama fasorial
Os fasores giram com $\\omega t$; a projeção vertical de cada um é o valor instantâneo.
1. Abaixo de $f_0$ o circuito é **capacitivo**: $X_C > X_L$, a corrente fica **adiantada** em relação à fonte ($\\varphi < 0$).
2. Note que $\\hat V_R$ está sempre em fase com $\\hat I$, $\\hat V_L$ adiantado $90^\\circ$ e $\\hat V_C$ atrasado $90^\\circ$.
3. Ligamos a fonte em $t = 0$: no painel de ondas, a corrente demora alguns ciclos para assumir o regime. Plote **Parte transitória da corrente** e veja-a decair com $e^{-Rt/2L}$.
4. Suba **f** acima de $f_0$ e veja o circuito ficar **indutivo**.`,
			predict: [{
				question: "Com f abaixo da frequência de ressonância, a corrente em relação à tensão da fonte está:",
				options: [
					"adiantada",
					"atrasada",
					"em fase"
				],
				answer: 0,
				explanation: "Abaixo de $f_0$, $X_C = 1/\\omega C$ domina: a impedância tem parte imaginária negativa e $\\varphi = \\arg Z < 0$, ou seja, a corrente adianta."
			}]
		},
		{
			id: "filtros",
			label: "Filtros e diagrama de Bode",
			params: {
				topologia: 0,
				saida: 1,
				grafico: 0,
				inicio: 1,
				f: 200,
				Vp: 10,
				R: 100,
				L: 10,
				C: 1,
				Rg: 0,
				ritmo: 1
			},
			guide: `### Três filtros com o mesmo circuito
A saída é a tensão num dos componentes; o Bode mostra $|H|$ em dB e a fase, em escala logarítmica de frequência.
1. **Saída V_C (passa-baixas):** abaixo de $f_0$ $|H| \\approx 0$ dB; acima, cai $40$ dB por década.
2. Troque para **V_L (passa-altas)**: o espelho do anterior.
3. Troque para **V_R (passa-faixa)**: só passa uma faixa em torno de $f_0$, com fase $0^\\circ$ no centro.
4. Diminua **R** e note o pico que aparece em $f_0$ nos filtros de V_C e V_L quando $Q > 1/\\sqrt2$.`,
			predict: [{
				question: "No filtro passa-baixas (saída V_C), muito acima de f0, cada década de frequência reduz o ganho em:",
				options: [
					"20 dB",
					"40 dB",
					"6 dB"
				],
				answer: 1,
				explanation: "Para $f \\gg f_0$, $|H| \\approx (f_0/f)^2$: duas ordens de grandeza a menos por década, ou seja, $-40$ dB/década (segunda ordem)."
			}]
		},
		{
			id: "paralelo",
			label: "Tanque em paralelo (antirressonância)",
			params: {
				topologia: 1,
				grafico: 1,
				inicio: 1,
				f: 1e3,
				Vp: 10,
				R: 1e4,
				L: 10,
				C: 1,
				Rg: 500
			},
			guide: `### RLC em paralelo
Com os três componentes em paralelo, alimentados por um gerador de resistência interna $R_g$:
1. Varra **f**: na curva, a corrente fornecida é **mínima** em $f_0$ (antirressonância). A impedância do tanque é máxima, igual a $R$.
2. Mesmo assim, as correntes em L e em C são grandes e opostas: a energia circula dentro do tanque. Plote **Corrente no indutor** e **Corrente no capacitor**.
3. No Bode, a tensão no tanque forma um passa-faixa, com $Q = (R\\parallel R_g)\\sqrt{C/L}$.`,
			predict: [{
				question: "Na frequência de ressonância, a corrente que o gerador fornece ao tanque LC em paralelo é:",
				options: [
					"máxima",
					"mínima",
					"igual à de qualquer outra frequência"
				],
				answer: 1,
				explanation: "Em $f_0$, as admitâncias de L e C se cancelam ($1/j\\omega L + j\\omega C = 0$) e só resta $1/R$: a impedância é máxima e a corrente, mínima."
			}]
		}
	],
	exercises: [{
		id: "f0",
		prompt: "Um circuito RLC série tem R = {R} Ω, L = {L} mH e C = {C} µF. Qual é a frequência de ressonância?",
		vary: {
			R: [
				5,
				200,
				0
			],
			L: [
				1,
				100,
				1
			],
			C: [
				.1,
				10,
				2
			]
		},
		fixed: {
			topologia: 0,
			Rg: 0
		},
		answer: {
			label: "f₀",
			unit: "Hz",
			compute: (p) => f0(p)
		},
		hint: "f₀ = 1/(2π√(LC)); converta mH e µF para H e F."
	}, {
		id: "corrente",
		prompt: "Uma fonte senoidal de {Vp} V de pico e {f} Hz alimenta um RLC série com R = {R} Ω, L = {L} mH e C = {C} µF. Qual é a amplitude da corrente em regime permanente?",
		vary: {
			Vp: [
				1,
				20,
				1
			],
			f: [
				100,
				5e3,
				0
			],
			R: [
				10,
				500,
				0
			],
			L: [
				1,
				100,
				1
			],
			C: [
				.1,
				10,
				2
			]
		},
		fixed: {
			topologia: 0,
			Rg: 0
		},
		answer: {
			label: "I_p",
			unit: "A",
			compute: (p) => cabs(phasors(p).I)
		},
		hint: "I_p = V_p/|Z|, com |Z| = √(R² + (ωL − 1/ωC)²)."
	}],
	init,
	step: (s, p, _t, dt) => step(s, p, dt),
	dt: 1 / 500,
	sampleEvery: 2,
	maxSamples: 6e3,
	viewport: () => ({
		xMin: 0,
		xMax: 20,
		yMin: -.1,
		yMax: 11.7
	}),
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: s, params: p, theme } = frame;
		const ph = phasors(p);
		drawCircuit(d, theme, s, p);
		drawPhasors(d, theme, s, p, ph);
		drawWaves(d, ctx, theme, frame.trail, s, p);
		if (Math.round(num(p, "grafico")) === 1) drawResonance(d, ctx, theme, p);
		else drawBode(d, ctx, theme, p);
	}
});
function drawCircuit(d, theme, s, p) {
	const col = theme.text;
	const hi = theme.accent;
	const yt = 11;
	const yb = 7.5;
	const xg = .8;
	generator(d, xg, yb, xg, yt, "seno", { color: col });
	d.text(`${si(freq(p), "Hz")}`, 1.35, 18.5 / 2, {
		color: theme.muted,
		size: 11,
		align: "left"
	});
	const rg = Rg(p);
	if (topo(p) === 0) {
		const out = saida(p);
		if (rg > 0) {
			resistor(d, xg, yt, 2.2, yt, .4, {
				color: theme.muted,
				width: 1.5
			});
			d.text("R_g", 1.5, 11.4, {
				color: theme.muted,
				size: 10
			});
		} else d.line(xg, yt, 2.2, yt, {
			color: col,
			width: 2
		});
		resistor(d, 2.2, yt, 4, yt, .6, { color: out === 0 ? hi : col });
		d.text(`R ${si(R(p), "Ω")}`, 3.1, 11.45, {
			color: out === 0 ? hi : theme.muted,
			size: 11
		});
		inductor(d, 4, yt, 6.2, yt, .75, {
			color: out === 2 ? hi : col,
			loops: 4
		});
		d.text(`L ${si(L(p), "H")}`, 5.1, 11.5, {
			color: out === 2 ? hi : theme.muted,
			size: 11
		});
		capacitor(d, 6.2, yt, 6.2, yb, {
			color: out === 1 ? hi : col,
			platePx: 28,
			gapPx: 9
		});
		d.text(`C ${si(C(p), "F")}`, 5.8, 18.5 / 2, {
			color: out === 1 ? hi : theme.muted,
			size: 11,
			align: "right"
		});
		d.line(xg, yb, 6.2, yb, {
			color: col,
			width: 2
		});
		d.text(`saída: ${OUT_LABEL[out] ?? "V_R"}`, 3.6, 8.3, {
			color: hi,
			size: 11,
			weight: "600"
		});
		currentArrow(d, 3, 7.2, 1, 0, -s[7], theme.series[2]);
	} else {
		if (rg > 0) {
			resistor(d, xg, yt, 2.6, yt, .5, {
				color: theme.muted,
				width: 1.5
			});
			d.text("R_g", 1.7, 11.4, {
				color: theme.muted,
				size: 10
			});
		} else d.line(xg, yt, 2.6, yt, {
			color: col,
			width: 2
		});
		d.line(2.6, yt, 6.2, yt, {
			color: col,
			width: 2
		});
		d.line(xg, yb, 6.2, yb, {
			color: col,
			width: 2
		});
		resistor(d, 3.4, yt, 3.4, yb, .8, { color: col });
		inductor(d, 4.8, yt, 4.8, yb, .9, {
			color: col,
			loops: 4
		});
		capacitor(d, 6.2, yt, 6.2, yb, {
			color: col,
			platePx: 28,
			gapPx: 9
		});
		d.text("R", 3.1, 18.5 / 2, {
			color: theme.muted,
			size: 11,
			align: "right"
		});
		d.text("L", 4.45, 10.2, {
			color: theme.muted,
			size: 11,
			align: "right"
		});
		d.text("C", 5.85, 18.5 / 2, {
			color: theme.muted,
			size: 11,
			align: "right"
		});
		d.text("saída: tensão no tanque", 4.8, 7.2, {
			color: hi,
			size: 11,
			weight: "600",
			align: "left"
		});
		currentArrow(d, 1.6, 7.2, 1, 0, -s[7], theme.series[2]);
	}
	const xi = topo(p) === 0 ? 3 : 1.6;
	d.text(`i = ${si(s[7], "A")}`, xi + .45, 7.2, {
		color: theme.series[2],
		size: 11,
		weight: "600",
		align: "left"
	});
}
function drawPhasors(d, theme, s, p, ph) {
	const cxp = 10;
	const cyp = 9.55;
	const rad = 1.8;
	const phi = s[1];
	const c = Math.cos(phi);
	const sn = Math.sin(phi);
	const P = (a) => [a[0] * c - a[1] * sn, a[0] * sn + a[1] * c];
	d.circle(cxp, cyp, rad, {
		stroke: theme.grid,
		width: 1
	});
	d.line(8.2 - .2, cyp, 12, cyp, {
		color: theme.grid,
		width: 1
	});
	d.line(cxp, 7.550000000000001, cxp, 11.55, {
		color: theme.grid,
		width: 1
	});
	d.text("Fasores (girando com ωt)", cxp, 11.8, {
		color: theme.text,
		size: 12,
		weight: "700"
	});
	const serie = topo(p) === 0;
	const chain = serie ? [
		...Rg(p) > 0 ? [{
			v: ph.Vg,
			label: "V_g",
			color: theme.muted
		}] : [],
		{
			v: ph.VR,
			label: "V_R",
			color: theme.series[0]
		},
		{
			v: ph.VL,
			label: "V_L",
			color: theme.series[1]
		},
		{
			v: ph.VC,
			label: "V_C",
			color: theme.series[4]
		}
	] : [
		{
			v: ph.IR,
			label: "I_R",
			color: theme.series[0]
		},
		{
			v: ph.IL,
			label: "I_L",
			color: theme.series[1]
		},
		{
			v: ph.IC,
			label: "I_C",
			color: theme.series[4]
		}
	];
	const total = serie ? ph.Vs : ph.I;
	let acc = [0, 0];
	let maxM = cabs(total);
	for (const c of chain) {
		maxM = Math.max(maxM, cabs(c.v));
		acc = cadd(acc, c.v);
		maxM = Math.max(maxM, cabs(acc));
	}
	const k = rad / Math.max(maxM, 1e-30);
	let x = cxp;
	let y = cyp;
	for (const c of chain) {
		const [dx, dy] = P(c.v);
		if (Math.hypot(dx, dy) * k > .001) {
			d.arrow(x, y, dx * k, dy * k, {
				color: c.color,
				width: 2.2
			});
			const m = Math.hypot(dx, dy);
			d.text(c.label, x + dx * k, y + dy * k, {
				color: c.color,
				size: 11,
				weight: "700",
				dx: dx / m * 14,
				dy: -(dy / m) * 12
			});
		}
		x += dx * k;
		y += dy * k;
	}
	const [tx, ty] = P(total);
	d.arrow(cxp, cyp, tx * k, ty * k, {
		color: theme.accent,
		width: 2.6
	});
	d.text(serie ? "V_fonte" : "I", cxp + tx * k, cyp + ty * k, {
		color: theme.accent,
		size: 11,
		weight: "700",
		dx: 14,
		dy: -10
	});
	const [rx, ry] = P(serie ? ph.I : ph.VR);
	const rm = Math.hypot(rx, ry);
	if (rm > 0) {
		d.arrow(cxp, cyp, rx / rm * rad * .55, ry / rm * rad * .55, {
			color: theme.series[2],
			width: 2,
			dash: [5, 3]
		});
		d.text(serie ? "I" : "V", cxp + rx / rm * rad * .62, cyp + ry / rm * rad * .62, {
			color: theme.series[2],
			size: 11,
			weight: "700",
			dx: -8,
			dy: 8
		});
	}
	d.line(cxp + tx * k, cyp + ty * k, 12.15, cyp + ty * k, {
		color: theme.accent,
		width: 1,
		dash: [3, 3],
		alpha: .7
	});
	d.dot(12.15, cyp + ty * k, 3, theme.accent);
	const phiZ = deg$1(carg(ph.Z));
	const kind = Math.abs(phiZ) < .5 ? "resistivo (ressonância)" : phiZ > 0 ? "indutivo: i atrasada" : "capacitivo: i adiantada";
	d.text(`φ = ${phiZ.toFixed(1).replace(".", ",")}°  ${kind}`, cxp, 7.3500000000000005, {
		color: theme.muted,
		size: 11
	});
}
function drawWaves(d, ctx, theme, trail, s, p) {
	const x0 = 13.1;
	const x1 = 19.8;
	const yc = 9.35;
	const hh = 1.9;
	const span = 2 / freq(p);
	const tNow = s[0];
	d.rect(x0, 7.449999999999999, 6.700000000000001, 2 * hh, {
		stroke: theme.grid,
		width: 1
	});
	d.line(x0, yc, x1, yc, {
		color: theme.grid,
		width: 1
	});
	d.text("Últimos 2 ciclos", 32.9 / 2, 11.7, {
		color: theme.text,
		size: 12,
		weight: "700"
	});
	const pts = [];
	for (let k = trail.length - 1; k >= 0; k--) {
		const st = trail[k];
		if (st[0] < tNow - span - 1e-15) break;
		pts.push(st);
	}
	pts.reverse();
	if (pts.length < 2 || pts[pts.length - 1][0] < tNow - 1e-15) pts.push(s);
	const vmax = Math.max(num(p, "Vp", 10), ...pts.map((q) => Math.abs(vOut(q, p))));
	const imax = Math.max(1e-12, cabs(phasors(p).I), ...pts.map((q) => Math.abs(q[7])));
	const X = (t) => x1 - (tNow - t) / span * 6.700000000000001;
	ctx.save();
	ctx.beginPath();
	ctx.rect(x0, 7.449999999999999, 6.700000000000001, 2 * hh);
	ctx.clip();
	const line = (g, scale, color, width = 2) => d.polyline(pts.map((q) => [X(q[0]), yc + g(q) / scale * hh * .92]), {
		color,
		width
	});
	line((q) => q[6], vmax, theme.accent);
	line((q) => vOut(q, p), vmax, theme.series[1], 1.6);
	line((q) => q[7], imax, theme.series[2]);
	ctx.restore();
	d.text("v_fonte", 13.2, 7.1499999999999995, {
		color: theme.accent,
		size: 10,
		align: "left",
		weight: "600"
	});
	d.text("v_saída", 15.3, 7.1499999999999995, {
		color: theme.series[1],
		size: 10,
		align: "left",
		weight: "600"
	});
	d.text("i (escala própria)", x1, 7.1499999999999995, {
		color: theme.series[2],
		size: 10,
		align: "right",
		weight: "600"
	});
}
var PX0 = 2;
var PX1 = 19.5;
var lx = (f) => PX0 + (Math.log10(f) - Math.log10(FMIN)) / (Math.log10(FMAX) - Math.log10(FMIN)) * 17.5;
function freqAxis(d, theme, y0, y1, labels) {
	for (let e = 1; e <= 5; e++) {
		for (let m = 1; m < 10; m++) {
			const f = m * 10 ** e;
			if (f > FMAX * 1.0001 || f < FMIN) continue;
			d.line(lx(f), y0, lx(f), y1, {
				color: theme.grid,
				width: m === 1 ? 1.2 : .7
			});
		}
		if (labels) d.text(si(10 ** e, "Hz", 2), lx(10 ** e), y0 - .28, {
			color: theme.muted,
			size: 10
		});
	}
	d.rect(PX0, y0, 17.5, y1 - y0, {
		stroke: theme.muted,
		width: 1
	});
}
function markers(d, theme, p, y0, y1) {
	const fr = f0(p);
	if (fr >= FMIN && fr <= FMAX) {
		d.line(lx(fr), y0, lx(fr), y1, {
			color: theme.muted,
			width: 1.2,
			dash: [5, 4]
		});
		d.text("f₀", lx(fr), y1, {
			color: theme.muted,
			size: 10,
			align: "left",
			dx: 4,
			dy: 9
		});
	}
	d.line(lx(freq(p)), y0, lx(freq(p)), y1, {
		color: theme.accent,
		width: 1.5
	});
}
function curve(f, n = 300) {
	const out = [];
	for (let k = 0; k <= n; k++) {
		const fr = FMIN * (FMAX / FMIN) ** (k / n);
		out.push([fr, f(fr)]);
	}
	return out;
}
function drawBode(d, ctx, theme, p) {
	const dbMin = -60;
	const m0 = 3.95;
	const m1 = 6.45;
	const a0 = .55;
	const a1 = 3.05;
	const Ym = (db) => m0 + (clamp(db, -65, 35) - dbMin) / 90 * 2.5;
	const Ya = (dg) => a0 + (dg + 180) / 360 * 2.5;
	freqAxis(d, theme, m0, m1, false);
	freqAxis(d, theme, a0, a1, true);
	for (const db of [
		-60,
		-40,
		-20,
		0,
		20
	]) {
		d.line(PX0, Ym(db), PX1, Ym(db), {
			color: theme.grid,
			width: db === 0 ? 1.4 : .8
		});
		d.text(`${db}`, 1.88, Ym(db), {
			color: theme.muted,
			size: 10,
			align: "right"
		});
	}
	for (const dg of [
		-180,
		-90,
		0,
		90,
		180
	]) {
		d.line(PX0, Ya(dg), PX1, Ya(dg), {
			color: theme.grid,
			width: dg === 0 ? 1.4 : .8
		});
		d.text(`${dg}°`, 1.88, Ya(dg), {
			color: theme.muted,
			size: 10,
			align: "right"
		});
	}
	d.text("|H| (dB)", 1.05, 6.75, {
		color: theme.text,
		size: 11,
		weight: "700",
		align: "left"
	});
	d.text("fase de H", 1.05, 3.3499999999999996, {
		color: theme.text,
		size: 11,
		weight: "700",
		align: "left"
	});
	const label = topo(p) === 0 ? `H = ${OUT_LABEL[saida(p)] ?? "V_R"} / V_fonte` : "H = V_tanque / V_fonte";
	d.text(label, PX1, 6.75, {
		color: theme.series[1],
		size: 11,
		weight: "600",
		align: "right"
	});
	const mag = curve((fr) => 20 * Math.log10(cabs(phasors(p, fr).H)));
	const pha = curve((fr) => deg$1(carg(phasors(p, fr).H)));
	ctx.save();
	ctx.beginPath();
	ctx.rect(PX0, m0, 17.5, 2.5);
	ctx.clip();
	d.polyline(mag.map(([fr, v]) => [lx(fr), Ym(v)]), {
		color: theme.series[1],
		width: 2.4
	});
	ctx.restore();
	ctx.save();
	ctx.beginPath();
	ctx.rect(PX0, a0, 17.5, 2.5);
	ctx.clip();
	d.polyline(pha.map(([fr, v]) => [lx(fr), Ya(v)]), {
		color: theme.series[3],
		width: 2.2
	});
	ctx.restore();
	markers(d, theme, p, m0, m1);
	markers(d, theme, p, a0, a1);
	const H = phasors(p).H;
	const db = 20 * Math.log10(cabs(H));
	d.dot(lx(freq(p)), Ym(db), 5, theme.accent);
	d.dot(lx(freq(p)), Ya(deg$1(carg(H))), 5, theme.accent);
	d.text(`${db.toFixed(1).replace(".", ",")} dB`, lx(freq(p)), Ym(db), {
		color: theme.accent,
		size: 11,
		weight: "700",
		dx: 8,
		dy: -10,
		align: "left"
	});
	d.text(`${deg$1(carg(H)).toFixed(0)}°`, lx(freq(p)), Ya(deg$1(carg(H))), {
		color: theme.accent,
		size: 11,
		weight: "700",
		dx: 8,
		dy: -10,
		align: "left"
	});
}
function drawResonance(d, ctx, theme, p) {
	const y0 = .55;
	const y1 = 6.45;
	const pts = curve((fr) => cabs(phasors(p, fr).I), 500);
	const imax = Math.max(...pts.map((q) => q[1])) * 1.1;
	const Y = (i) => y0 + i / imax * 5.9;
	freqAxis(d, theme, y0, y1, true);
	const raw = imax / 4;
	const p10 = 10 ** Math.floor(Math.log10(raw));
	const stepI = (raw / p10 < 1.5 ? 1 : raw / p10 < 3.5 ? 2 : raw / p10 < 7.5 ? 5 : 10) * p10;
	for (let v = stepI; v < imax; v += stepI) {
		d.line(PX0, Y(v), PX1, Y(v), {
			color: theme.grid,
			width: .8
		});
		d.text(si(v, "A", 2), 1.88, Y(v), {
			color: theme.muted,
			size: 10,
			align: "right"
		});
	}
	d.text("amplitude da corrente da fonte I_p", 1.05, 6.75, {
		color: theme.text,
		size: 11,
		weight: "700",
		align: "left"
	});
	ctx.save();
	ctx.beginPath();
	ctx.rect(PX0, y0, 17.5, 5.9);
	ctx.clip();
	const fr = f0(p);
	const Q = quality(p);
	if (topo(p) === 0 && fr > FMIN && fr < FMAX) {
		const half = cabs(phasors(p, fr).I) / Math.SQRT2;
		const band = pts.filter((q) => q[1] >= half);
		if (band.length > 1) {
			d.rect(lx(band[0][0]), y0, lx(band[band.length - 1][0]) - lx(band[0][0]), 5.9, {
				fill: theme.accent,
				alpha: .1
			});
			d.line(PX0, Y(half), PX1, Y(half), {
				color: theme.accent,
				width: 1,
				dash: [4, 4],
				alpha: .7
			});
		}
	}
	d.polyline(pts.map(([f, v]) => [lx(f), Y(v)]), {
		color: theme.series[2],
		width: 2.4
	});
	ctx.restore();
	markers(d, theme, p, y0, y1);
	const ip = cabs(phasors(p).I);
	d.dot(lx(freq(p)), Y(ip), 5, theme.accent);
	d.text(si(ip, "A"), lx(freq(p)), Y(ip), {
		color: theme.accent,
		size: 11,
		weight: "700",
		dx: 8,
		dy: -10,
		align: "left"
	});
	const info = topo(p) === 0 ? `f₀ = ${si(fr, "Hz")}   Q = ${Q.toFixed(2).replace(".", ",")}   Δf = f₀/Q = ${si(fr / Q, "Hz")} (faixa de meia potência)` : `f₀ = ${si(fr, "Hz")}   Q = ${Q.toFixed(2).replace(".", ",")}   corrente mínima na antirressonância`;
	d.text(info, PX1, 6.75, {
		color: theme.muted,
		size: 11,
		align: "right"
	});
}
//#endregion
//#region sims/sistema-solar/src/astro.ts
/** G em UA³/(M☉·ano²). */
var GU = 4 * Math.PI * Math.PI;
var R_EARTH = 6371e3;
var GM_EARTH = 3986004418e5;
/** Dia sideral (s). */
var SIDEREAL_DAY = 86164.1;
var YEAR_DAYS = 365.256;
var PLANETS = [
	{
		name: "Mercúrio",
		a: .3871,
		e: .20563,
		varpi: 77.456,
		L0: 252.251,
		T: .24085,
		m: 3301e20,
		R: 2439.7,
		rot: 58.646,
		color: "#9a8f86"
	},
	{
		name: "Vênus",
		a: .72333,
		e: .00677,
		varpi: 131.53,
		L0: 181.98,
		T: .6152,
		m: 4867e21,
		R: 6051.8,
		rot: -243.02,
		color: "#d9b26a"
	},
	{
		name: "Terra",
		a: 1,
		e: .01671,
		varpi: 102.94,
		L0: 100.46,
		T: 1.00002,
		m: 5972e21,
		R: 6371,
		rot: .99727,
		color: "#3b7dd8"
	},
	{
		name: "Marte",
		a: 1.52368,
		e: .0934,
		varpi: 336.04,
		L0: 355.45,
		T: 1.88085,
		m: 6417e20,
		R: 3389.5,
		rot: 1.02596,
		color: "#c8553d"
	},
	{
		name: "Júpiter",
		a: 5.2026,
		e: .04849,
		varpi: 14.75,
		L0: 34.4,
		T: 11.862,
		m: 1898e24,
		R: 69911,
		rot: .41354,
		color: "#c99a6b"
	},
	{
		name: "Saturno",
		a: 9.5549,
		e: .05551,
		varpi: 92.43,
		L0: 49.94,
		T: 29.457,
		m: 5683e23,
		R: 58232,
		rot: .44401,
		color: "#d8c38a"
	},
	{
		name: "Urano",
		a: 19.218,
		e: .0463,
		varpi: 170.96,
		L0: 313.23,
		T: 84.011,
		m: 8681e22,
		R: 25362,
		rot: -.71833,
		color: "#7fc4cf"
	},
	{
		name: "Netuno",
		a: 30.11,
		e: .00899,
		varpi: 44.97,
		L0: 304.88,
		T: 164.79,
		m: 1024e23,
		R: 24622,
		rot: .67125,
		color: "#4b6fd1"
	}
];
var R_SUN_KM = 695700;
var rad$1 = (d) => d * Math.PI / 180;
/** Resolve E − e sen E = M (Newton). */
function keplerE(M, e) {
	let E = e < .8 ? M : Math.PI;
	for (let i = 0; i < 30; i++) {
		const dE = (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
		E -= dE;
		if (Math.abs(dE) < 1e-14) break;
	}
	return E;
}
/** Posição heliocêntrica (UA) no plano da eclíptica, t em anos desde J2000. Período pela 3ª lei (T = a^1,5). */
function planetPos(pl, t) {
	const n = 2 * Math.PI / pl.a ** 1.5;
	const E = keplerE(((rad$1(pl.L0 - pl.varpi) + n * t) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI), pl.e);
	const xp = pl.a * (Math.cos(E) - pl.e), yp = pl.a * Math.sqrt(1 - pl.e * pl.e) * Math.sin(E);
	const w = rad$1(pl.varpi);
	return [xp * Math.cos(w) - yp * Math.sin(w), xp * Math.sin(w) + yp * Math.cos(w)];
}
/** Longitude eclíptica geocêntrica do planeta (rad, em [0, 2π)). */
function geoLongitude(pl, t) {
	const [xp, yp] = planetPos(pl, t), [xe, ye] = planetPos(PLANETS[2], t);
	return (Math.atan2(yp - ye, xp - xe) + 2 * Math.PI) % (2 * Math.PI);
}
/** Período sinódico em relação à Terra (anos). */
var synodic = (T) => 1 / Math.abs(1 - 1 / T);
/** Raio de desenho/colisão (UA) a partir da massa (M☉). */
var bodyRadius = (m) => .02 + .06 * Math.cbrt(Math.max(m, 0));
function accel(bs) {
	const out = bs.map(() => [0, 0]);
	const eps2 = 1e-6;
	for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
		const a = bs[i], b = bs[j];
		const dx = b.x - a.x, dy = b.y - a.y;
		const r2 = dx * dx + dy * dy + eps2, inv = GU / (r2 * Math.sqrt(r2));
		out[i][0] += b.m * dx * inv;
		out[i][1] += b.m * dy * inv;
		out[j][0] -= a.m * dx * inv;
		out[j][1] -= a.m * dy * inv;
	}
	return out;
}
/** Tempo dinâmico mínimo entre pares (anos): limita o passo. */
function dynTime(bs) {
	let t = Infinity;
	for (let i = 0; i < bs.length; i++) for (let j = i + 1; j < bs.length; j++) {
		const a = bs[i], b = bs[j];
		const r = Math.hypot(b.x - a.x, b.y - a.y);
		t = Math.min(t, Math.sqrt(r ** 3 / (GU * (a.m + b.m + 1e-12))));
	}
	return t;
}
/** Funde corpos que se tocam (colisão perfeitamente inelástica: conserva massa e momento). */
function merge(bs) {
	const out = bs.map((b) => ({ ...b }));
	for (let i = 0; i < out.length; i++) for (let j = i + 1; j < out.length; j++) {
		const a = out[i], b = out[j];
		if (Math.hypot(b.x - a.x, b.y - a.y) < .5 * (bodyRadius(a.m) + bodyRadius(b.m))) {
			const m = a.m + b.m;
			out[i] = {
				id: a.m >= b.m ? a.id : b.id,
				m,
				x: (a.m * a.x + b.m * b.x) / m,
				y: (a.m * a.y + b.m * b.y) / m,
				vx: (a.m * a.vx + b.m * b.vx) / m,
				vy: (a.m * a.vy + b.m * b.vy) / m
			};
			out.splice(j, 1);
			j = i;
		}
	}
	return out;
}
/** Avança h anos com velocity Verlet (simplético), subdividindo pelo tempo dinâmico. */
function nbodyStep(bs0, h, merging = true) {
	let bs = bs0.map((b) => ({ ...b }));
	if (bs.length < 2) return bs.map((b) => ({
		...b,
		x: b.x + b.vx * h,
		y: b.y + b.vy * h
	}));
	let left = h;
	for (let guard = 0; left > 1e-15 && guard < 400; guard++) {
		const hs = Math.min(left, .01 * dynTime(bs));
		let a = accel(bs);
		bs.forEach((b, i) => {
			b.vx += .5 * hs * a[i][0];
			b.vy += .5 * hs * a[i][1];
			b.x += hs * b.vx;
			b.y += hs * b.vy;
		});
		a = accel(bs);
		bs.forEach((b, i) => {
			b.vx += .5 * hs * a[i][0];
			b.vy += .5 * hs * a[i][1];
		});
		left -= hs;
		if (merging) bs = merge(bs);
	}
	return bs;
}
function nbodyEnergy(bs) {
	let E = 0;
	for (let i = 0; i < bs.length; i++) {
		const a = bs[i];
		E += .5 * a.m * (a.vx * a.vx + a.vy * a.vy);
		for (let j = i + 1; j < bs.length; j++) {
			const b = bs[j];
			E -= GU * a.m * b.m / Math.sqrt((b.x - a.x) ** 2 + (b.y - a.y) ** 2 + 1e-6);
		}
	}
	return E;
}
var momentum = (bs) => bs.reduce((s, b) => [s[0] + b.m * b.vx, s[1] + b.m * b.vy], [0, 0]);
var angularMomentum = (bs) => bs.reduce((s, b) => s + b.m * (b.x * b.vy - b.y * b.vx), 0);
function centerOfMass(bs) {
	const M = bs.reduce((s, b) => s + b.m, 0) || 1;
	return [bs.reduce((s, b) => s + b.m * b.x, 0) / M, bs.reduce((s, b) => s + b.m * b.y, 0) / M];
}
/** Passa para o referencial do centro de massa (momento total nulo). */
function toCM(bs) {
	const M = bs.reduce((s, b) => s + b.m, 0) || 1;
	const [px, py] = momentum(bs), [cx, cy] = centerOfMass(bs);
	return bs.map((b) => ({
		...b,
		x: b.x - cx,
		y: b.y - cy,
		vx: b.vx - px / M,
		vy: b.vy - py / M
	}));
}
var PRESETS = [
	"Sol e Terra",
	"Sol, Terra e Júpiter (×10 massa)",
	"Estrela binária com planeta",
	"Sol, planeta e lua",
	"Quatro corpos (caótico)"
];
/** Corpos iniciais (UA, M☉, UA/ano). */
function presetBodies(k) {
	const circ = (M, r) => Math.sqrt(GU * M / r);
	let bs;
	switch (k) {
		case 1:
			bs = [
				{
					id: 1,
					m: 1,
					x: 0,
					y: 0,
					vx: 0,
					vy: 0
				},
				{
					id: 2,
					m: 3e-6,
					x: 1,
					y: 0,
					vx: 0,
					vy: circ(1, 1)
				},
				{
					id: 3,
					m: .0095,
					x: -2.5,
					y: 0,
					vx: 0,
					vy: -circ(1, 2.5)
				}
			];
			break;
		case 2:
			bs = [
				{
					id: 1,
					m: .6,
					x: -.25,
					y: 0,
					vx: 0,
					vy: -circ(.4, .5) * .6
				},
				{
					id: 2,
					m: .4,
					x: .375,
					y: 0,
					vx: 0,
					vy: circ(.6, .5) * .6
				},
				{
					id: 3,
					m: 1e-5,
					x: 0,
					y: 2.2,
					vx: -circ(1, 2.2),
					vy: 0
				}
			];
			{
				const vrel = circ(1, .625);
				bs[0].vy = -.4 * vrel;
				bs[1].vy = .6 * vrel;
			}
			break;
		case 3:
			bs = [
				{
					id: 1,
					m: 1,
					x: 0,
					y: 0,
					vx: 0,
					vy: 0
				},
				{
					id: 2,
					m: .001,
					x: 1.5,
					y: 0,
					vx: 0,
					vy: circ(1, 1.5)
				},
				{
					id: 3,
					m: 1e-6,
					x: 1.59,
					y: 0,
					vx: 0,
					vy: circ(1, 1.5) + circ(.001, .09)
				}
			];
			break;
		case 4:
			bs = [
				{
					id: 1,
					m: .5,
					x: -1,
					y: 0,
					vx: 0,
					vy: -2.5
				},
				{
					id: 2,
					m: .5,
					x: 1,
					y: 0,
					vx: 0,
					vy: 2.5
				},
				{
					id: 3,
					m: .05,
					x: 0,
					y: 1.6,
					vx: -3,
					vy: 0
				},
				{
					id: 4,
					m: .02,
					x: 0,
					y: -2.2,
					vx: 3.5,
					vy: .4
				}
			];
			break;
		default: bs = [{
			id: 1,
			m: 1,
			x: 0,
			y: 0,
			vx: 0,
			vy: 0
		}, {
			id: 2,
			m: 3e-6,
			x: 1,
			y: 0,
			vx: 0,
			vy: circ(1, 1)
		}];
	}
	return toCM(bs);
}
var MOON_SIDEREAL = 27.32166;
var MOON_SYNODIC = 1 / (1 / MOON_SIDEREAL - 1 / YEAR_DAYS);
var MOON_INCL = 5.145;
var NODE_PERIOD = 6798.38;
/** Geometria Sol–Terra–Lua no dia t (t = 0: lua nova; nodo a `node0` graus do Sol). */
function moonGeo(t, node0Deg) {
	const lamS = 2 * Math.PI * t / YEAR_DAYS;
	const lamM = 2 * Math.PI * t / MOON_SIDEREAL;
	const node = rad$1(node0Deg) - 2 * Math.PI * t / NODE_PERIOD;
	const beta = Math.asin(Math.sin(rad$1(MOON_INCL)) * Math.sin(lamM - node));
	const elong = ((lamM - lamS) % (2 * Math.PI) + 2 * Math.PI) % (2 * Math.PI);
	const sep = Math.acos(Math.cos(beta) * Math.cos(elong));
	return {
		elong,
		beta,
		sep,
		k: (1 - Math.cos(sep)) / 2
	};
}
function phaseName(elong) {
	const d = elong * 180 / Math.PI;
	if (d < 10 || d > 350) return "Lua nova";
	if (d < 80) return "Crescente";
	if (d < 100) return "Quarto crescente";
	if (d < 170) return "Crescente gibosa";
	if (d < 190) return "Lua cheia";
	if (d < 260) return "Minguante gibosa";
	if (d < 280) return "Quarto minguante";
	return "Minguante";
}
/** Eclipse: solar se a separação Lua–Sol < 1,5°; lunar se a Lua está a < 1,0° do ponto antissolar. */
function eclipse(g) {
	const deg = (r) => r * 180 / Math.PI;
	if (deg(g.sep) < 1.5) return "solar";
	if (deg(Math.PI - g.sep) < 1) return "lunar";
	return "";
}
var v1 = (h) => Math.sqrt(GM_EARTH / (R_EARTH + h));
var v2 = (h) => Math.sqrt(2 * GM_EARTH / (R_EARTH + h));
/** Raio da órbita geoestacionária (m): período = dia sideral. */
var rGeo = () => Math.cbrt(GM_EARTH * SIDEREAL_DAY ** 2 / (4 * Math.PI * Math.PI));
var orbitPeriod = (r) => 2 * Math.PI * Math.sqrt(r ** 3 / GM_EARTH);
//#endregion
//#region sims/sistema-solar/src/index.ts
var MODOS = [
	"N corpos (editável)",
	"Sistema solar em escala",
	"Movimento retrógrado (geo × helio)",
	"Fases da Lua e eclipses",
	"Canhão de Newton",
	"Satélite geoestacionário"
];
/** Unidade do tempo físico de cada modo e quanto passa por segundo de tela (× rapidez). */
var UNIT = [
	"ano",
	"ano",
	"dia",
	"dia",
	"s",
	"s"
];
var RATE = [
	.25,
	1,
	30,
	3,
	600,
	3600
];
/** Corpos que podem ser observados no modo retrógrado (índices em PLANETS). */
var RETRO_TARGETS = [
	0,
	1,
	3,
	4,
	5
];
var modeOf = (p) => clamp(Math.round(num(p, "modo")), 0, 5);
var rad = (d) => d * Math.PI / 180;
var deg = (r) => r * 180 / Math.PI;
var fmt$1 = (v, d = 3) => Number.isFinite(v) ? Number(v.toPrecision(d)).toString().replace(".", ",") : "—";
/** Escala de desenho das setas de velocidade no modo n corpos (UA por UA/ano). */
var KV = .12;
var retroPlanet = (p) => PLANETS[RETRO_TARGETS[clamp(Math.round(num(p, "alvo", 2)), 0, RETRO_TARGETS.length - 1)]];
var scalePlanet = (p) => PLANETS[clamp(Math.round(num(p, "planeta", 2)), 0, 7)];
/** Taxa de variação da longitude geocêntrica (°/dia), por diferença central. */
function lambdaRate(p, tDays) {
	const pl = retroPlanet(p), h = .5;
	let d = geoLongitude(pl, (tDays + h) / YEAR_DAYS) - geoLongitude(pl, (tDays - h) / YEAR_DAYS);
	if (d > Math.PI) d -= 2 * Math.PI;
	if (d < -Math.PI) d += 2 * Math.PI;
	return deg(d) / (2 * h);
}
/** Dia (desde J2000) da próxima oposição/conjunção inferior do planeta escolhido a partir de 2025. */
function retroStart(p) {
	const pl = retroPlanet(p);
	let best = 9200, bv = Infinity;
	const span = synodic(pl.a ** 1.5) * YEAR_DAYS;
	for (let t = 9200; t < 9200 + span; t += 2) {
		const v = lambdaRate({ ...p }, t);
		if (v < bv) [bv, best] = [v, t];
	}
	return best - .45 * span * Math.min(1, 300 / span);
}
function cannonInit(p) {
	return [
		0,
		R_EARTH + num(p, "h", 200) * 1e3,
		num(p, "v", 7.8) * 1e3,
		0
	];
}
function cannonRhs(y) {
	const r = Math.hypot(y[0], y[1]), k = -GM_EARTH / r ** 3;
	return [
		y[2],
		y[3],
		k * y[0],
		k * y[1]
	];
}
function rk4(f, y, h) {
	const k1 = f(y), k2 = f(y.map((v, i) => v + h / 2 * k1[i])), k3 = f(y.map((v, i) => v + h / 2 * k2[i])), k4 = f(y.map((v, i) => v + h * k3[i]));
	return y.map((v, i) => v + h / 6 * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
}
/** Elementos da órbita do projétil: energia específica, semieixo e excentricidade. */
function cannonOrbit(y) {
	const r = Math.hypot(y[0], y[1]);
	const eps = (y[2] ** 2 + y[3] ** 2) / 2 - GM_EARTH / r;
	const hz = y[0] * y[3] - y[1] * y[2];
	return {
		r,
		eps,
		a: -GM_EARTH / (2 * eps),
		e: Math.sqrt(Math.max(0, 1 + 2 * eps * hz * hz / GM_EARTH ** 2)),
		hz
	};
}
var geoR = (p) => num(p, "rsat", 42164) * 1e3;
var earthAngle = (tf) => 2 * Math.PI * tf / SIDEREAL_DAY;
/** Longitude do ponto sob o satélite em relação ao solo (°), partindo de 0. */
var subLongitude = (p, tf) => {
	return deg((2 * Math.PI / orbitPeriod(geoR(p)) - 2 * Math.PI / SIDEREAL_DAY) * tf);
};
var sistemaSolar = defineSim({
	id: "sistema-solar",
	title: "Sistema solar: n corpos, fases da Lua, retrogradação e satélites",
	course: "FG I",
	topic: "Gravitação",
	priority: "P2",
	summary: "Monte seu próprio sistema de até 6 corpos (arraste posições e velocidades) com integrador simplético, explore o sistema solar com dados reais, veja o laço retrógrado de Marte lado a lado nos referenciais geocêntrico e heliocêntrico, as fases da Lua com eclipses, o canhão de Newton e o satélite geoestacionário.",
	equations: [
		String.raw`\ddot{\vec r}_i = \sum_{j\ne i} \frac{G m_j (\vec r_j - \vec r_i)}{|\vec r_j - \vec r_i|^3} \qquad G = 4\pi^2\ \text{UA}^3/(M_\odot\,\text{ano}^2)`,
		String.raw`T^2 = a^3\ \text{(anos, UA)} \qquad \frac{1}{T_{\text{sin}}} = \left|\frac{1}{T_\oplus} - \frac{1}{T}\right|`,
		String.raw`v_1 = \sqrt{\frac{GM}{R+h}} \qquad v_2 = \sqrt{\frac{2GM}{R+h}} \qquad r_{\text{geo}} = \sqrt[3]{\frac{GM\,T_{\text{sid}}^2}{4\pi^2}}`,
		String.raw`\text{fração iluminada da Lua} = \frac{1 - \cos\psi}{2}`
	],
	liveEquations(s, p) {
		switch (modeOf(p)) {
			case 0: {
				const [px, py] = momentum(s.bodies);
				return [String.raw`E = ${texNum(nbodyEnergy(s.bodies))}\ M_\odot\text{UA}^2/\text{ano}^2 \quad \vec P = (${texNum(px)};\ ${texNum(py)}) \quad L = ${texNum(angularMomentum(s.bodies))}`];
			}
			case 1: {
				const pl = scalePlanet(p);
				return [String.raw`\text{${pl.name}: } \frac{T^2}{a^3} = \frac{${texNum(pl.T)}^2}{${texNum(pl.a)}^3} = ${texNum(pl.T ** 2 / pl.a ** 3, 4)}\ \text{ano}^2/\text{UA}^3 \quad g = \frac{GM}{R^2} = ${texNum(6674e-14 * pl.m / (pl.R * 1e3) ** 2)}\ \text{m/s}^2`];
			}
			case 2: {
				const pl = retroPlanet(p);
				return [String.raw`T_{\text{sin}} = \frac{1}{|1 - 1/${texNum(pl.T)}|} = ${texNum(synodic(pl.T) * YEAR_DAYS)}\ \text{dias} \quad \dot\lambda = ${texNum(lambdaRate(p, retroT0(p, s)))}^\circ/\text{dia}`];
			}
			case 3: {
				const g = moonGeo(s.tf, num(p, "nodo", 40));
				return [String.raw`\psi = ${texNum(deg(g.sep))}^\circ \quad k = \frac{1-\cos\psi}{2} = ${texNum(g.k * 100)}\% \quad T_{\text{sin}} = \frac{1}{1/${texNum(27.3217)} - 1/${texNum(YEAR_DAYS)}} = ${texNum(MOON_SYNODIC, 4)}\ \text{dias}`];
			}
			case 4: {
				const h = num(p, "h", 200) * 1e3;
				return [String.raw`v_1 = \sqrt{\frac{GM}{R+h}} = ${texNum(v1(h) / 1e3)}\ \text{km/s} \quad v_2 = ${texNum(v2(h) / 1e3)}\ \text{km/s} \quad v_0 = ${texNum(num(p, "v", 7.8))}\ \text{km/s}`];
			}
			default: return [String.raw`T = 2\pi\sqrt{\frac{r^3}{GM}} = ${texNum(orbitPeriod(geoR(p)) / 3600, 4)}\ \text{h} \quad r_{\text{geo}} = ${texNum(rGeo() / 1e3, 5)}\ \text{km} \quad \text{deriva} = ${texNum(subLongitude(p, 86400))}^\circ/\text{dia}`];
		}
	},
	params: [
		{
			key: "modo",
			label: "Experimento",
			unit: "",
			min: 0,
			max: 5,
			step: 1,
			default: 0,
			options: MODOS.map((label, value) => ({
				value,
				label
			}))
		},
		{
			key: "rapidez",
			label: "Rapidez da animação",
			unit: "×",
			min: .05,
			max: 40,
			step: .05,
			default: 1,
			log: true,
			live: true
		},
		{
			key: "preset",
			label: "N corpos: configuração inicial",
			unit: "",
			min: 0,
			max: PRESETS.length - 1,
			step: 1,
			default: 0,
			options: PRESETS.map((label, value) => ({
				value,
				label
			}))
		},
		{
			key: "zoom",
			label: "N corpos: meia largura da vista",
			unit: "UA",
			min: .5,
			max: 10,
			step: .1,
			default: 3,
			live: true
		},
		{
			key: "dist",
			label: "Escala: distâncias",
			unit: "",
			min: 0,
			max: 2,
			step: 1,
			default: 0,
			live: true,
			options: [
				{
					value: 0,
					label: "Planetas internos (até 1,8 UA)"
				},
				{
					value: 1,
					label: "Todos, em escala linear"
				},
				{
					value: 2,
					label: "Todos, distância em escala logarítmica"
				}
			]
		},
		{
			key: "planeta",
			label: "Escala: planeta em destaque",
			unit: "",
			min: 0,
			max: 7,
			step: 1,
			default: 2,
			live: true,
			options: PLANETS.map((pl, value) => ({
				value,
				label: pl.name
			}))
		},
		{
			key: "alvo",
			label: "Retrógrado: planeta observado",
			unit: "",
			min: 0,
			max: RETRO_TARGETS.length - 1,
			step: 1,
			default: 2,
			options: RETRO_TARGETS.map((i, value) => ({
				value,
				label: PLANETS[i].name
			}))
		},
		{
			key: "nodo",
			label: "Lua: ângulo inicial entre a linha dos nodos e o Sol",
			unit: "°",
			min: 0,
			max: 180,
			step: 1,
			default: 40
		},
		{
			key: "hemis",
			label: "Lua: observador no hemisfério",
			unit: "",
			min: 0,
			max: 1,
			step: 1,
			default: 0,
			live: true,
			options: [{
				value: 0,
				label: "Sul (Brasil)"
			}, {
				value: 1,
				label: "Norte"
			}]
		},
		{
			key: "v",
			label: "Canhão: velocidade horizontal v₀",
			unit: "km/s",
			min: 1,
			max: 13,
			step: .05,
			default: 7.8
		},
		{
			key: "h",
			label: "Canhão: altura da montanha",
			unit: "km",
			min: 10,
			max: 2e3,
			step: 10,
			default: 200
		},
		{
			key: "rsat",
			label: "Satélite: raio da órbita",
			unit: "km",
			min: 7e3,
			max: 6e4,
			step: 10,
			default: 42164
		}
	],
	observables: [
		{
			key: "tano",
			label: "Tempo simulado",
			unit: "ano",
			value: (s, p) => toDays(s.tf, p) / YEAR_DAYS
		},
		{
			key: "tdia",
			label: "Tempo simulado",
			unit: "dia",
			value: (s, p) => toDays(s.tf, p)
		},
		{
			key: "E",
			label: "N corpos: energia total",
			unit: "M☉·UA²/ano²",
			value: (s, p) => modeOf(p) === 0 ? nbodyEnergy(s.bodies) : 0
		},
		{
			key: "L",
			label: "N corpos: momento angular total",
			unit: "M☉·UA²/ano",
			value: (s, p) => modeOf(p) === 0 ? angularMomentum(s.bodies) : 0
		},
		{
			key: "nc",
			label: "N corpos: número de corpos",
			unit: "",
			value: (s) => s.bodies.length
		},
		{
			key: "r12",
			label: "N corpos: distância corpo 1 – corpo 2",
			unit: "UA",
			value: (s) => s.bodies.length > 1 ? Math.hypot(s.bodies[1].x - s.bodies[0].x, s.bodies[1].y - s.bodies[0].y) : 0
		},
		{
			key: "rpl",
			label: "Escala: distância do planeta ao Sol",
			unit: "UA",
			value: (s, p) => modeOf(p) === 1 ? Math.hypot(...planetPos(scalePlanet(p), s.tf)) : 0
		},
		{
			key: "lambda",
			label: "Retrógrado: longitude geocêntrica λ",
			unit: "°",
			value: (s, p) => modeOf(p) === 2 ? deg(geoLongitude(retroPlanet(p), retroT0(p, s) / YEAR_DAYS)) : 0
		},
		{
			key: "dlambda",
			label: "Retrógrado: dλ/dt",
			unit: "°/dia",
			value: (s, p) => modeOf(p) === 2 ? lambdaRate(p, retroT0(p, s)) : 0
		},
		{
			key: "fracao",
			label: "Lua: fração iluminada",
			unit: "%",
			value: (s, p) => modeOf(p) === 3 ? moonGeo(s.tf, num(p, "nodo", 40)).k * 100 : 0
		},
		{
			key: "idade",
			label: "Lua: idade desde a lua nova",
			unit: "dia",
			value: (s, p) => modeOf(p) === 3 ? moonGeo(s.tf, num(p, "nodo", 40)).elong / (2 * Math.PI) * MOON_SYNODIC : 0
		},
		{
			key: "betaLua",
			label: "Lua: latitude eclíptica",
			unit: "°",
			value: (s, p) => modeOf(p) === 3 ? deg(moonGeo(s.tf, num(p, "nodo", 40)).beta) : 0
		},
		{
			key: "alt",
			label: "Canhão: altitude",
			unit: "km",
			value: (s, p) => modeOf(p) === 4 ? (Math.hypot(s.y[0], s.y[1]) - R_EARTH) / 1e3 : 0
		},
		{
			key: "vel",
			label: "Canhão: velocidade",
			unit: "km/s",
			value: (s, p) => modeOf(p) === 4 ? Math.hypot(s.y[2], s.y[3]) / 1e3 : 0
		},
		{
			key: "alcance",
			label: "Canhão: arco percorrido sobre a superfície",
			unit: "km",
			value: (s, p) => {
				if (modeOf(p) !== 4) return 0;
				let a = Math.atan2(s.y[0], s.y[1]);
				if (a < 0) a += 2 * Math.PI;
				return a * R_EARTH / 1e3;
			}
		},
		{
			key: "Tsat",
			label: "Satélite: período orbital",
			unit: "h",
			value: (_s, p) => orbitPeriod(geoR(p)) / 3600
		},
		{
			key: "deriva",
			label: "Satélite: longitude sob o satélite (deriva)",
			unit: "°",
			value: (s, p) => modeOf(p) === 5 ? subLongitude(p, s.tf) : 0
		}
	],
	conserved: "E",
	chart: {
		x: "t",
		y: "r12"
	},
	scenarios: [
		{
			id: "ncorpos",
			label: "Monte seu sistema",
			params: {
				modo: 0,
				preset: 1,
				zoom: 3,
				rapidez: 1
			},
			guide: `### Gravitação de n corpos
1. Arraste um corpo para mudar a posição; arraste a **ponta da seta** para mudar a velocidade.
2. Use **Adicionar corpo** (até 6), **Massa ×10 / ÷10** no corpo selecionado e **Ir para o centro de massa**.
3. A energia total e o momento angular ficam constantes (integrador simplético) — até dois corpos colidirem e se fundirem.
4. Na estrela binária, o planeta distante orbita o **centro de massa** (×) das duas estrelas.
5. Compare com a sim *Órbitas e leis de Kepler*, que mede as leis de Kepler em detalhe.`,
			predict: [{
				question: "Se a massa do Sol dobrar de repente, mantendo a velocidade da Terra, a órbita da Terra:",
				options: [
					"continua igual",
					"fica menor e elíptica, com o periélio onde a Terra está",
					"a Terra escapa"
				],
				answer: 1,
				explanation: "A velocidade circular passa a $\\sqrt{2}$ vezes a atual; com velocidade menor que a circular, a Terra está no afélio de uma elipse menor."
			}]
		},
		{
			id: "escala",
			label: "Sistema solar em escala",
			params: {
				modo: 1,
				dist: 2,
				planeta: 4,
				rapidez: 1
			},
			guide: `### Tamanhos, massas e períodos reais
1. Em escala linear, os planetas internos se espremem perto do Sol: use a escala logarítmica para ver todos.
2. Escolha cada planeta e confira $T^2/a^3 \\approx 1$ ano²/UA³ (3ª lei).
3. Na faixa de baixo, os tamanhos estão na mesma escala: Júpiter é ~11 Terras, e o Sol (arco) ~10 Júpiteres.
4. Note as rotações retrógradas de Vênus e Urano (período negativo).`
		},
		{
			id: "retro",
			label: "Movimento retrógrado de Marte",
			params: {
				modo: 2,
				alvo: 2,
				rapidez: 1
			},
			guide: `### Laço retrógrado
1. À esquerda (heliocêntrico), as linhas de visada Terra → Marte. À direita (geocêntrico), Marte visto da Terra desenha laços — os epiciclos de Ptolomeu.
2. Perto da **oposição**, a Terra ultrapassa Marte pela parte de dentro e $\\dot\\lambda < 0$: Marte anda "para trás" no céu.
3. O laço se repete a cada período sinódico (~780 dias). Troque para Júpiter e Vênus.`,
			predict: [{
				question: "Quando Marte faz o movimento retrógrado, ele está:",
				options: [
					"em conjunção com o Sol (atrás dele)",
					"perto da oposição (do lado oposto ao Sol)",
					"em qualquer posição"
				],
				answer: 1,
				explanation: "A retrogradação acontece quando a Terra, mais rápida, ultrapassa Marte; isso ocorre perto da oposição, quando Marte está mais perto e mais brilhante."
			}]
		},
		{
			id: "fases",
			label: "Fases da Lua e eclipses",
			params: {
				modo: 3,
				nodo: 0,
				hemis: 0,
				rapidez: 1
			},
			guide: `### Fases e eclipses
1. Metade da Lua está sempre iluminada pelo Sol; a fase depende de quanto dessa metade vemos da Terra.
2. Mês sinódico (de uma lua nova a outra) = 29,53 dias > mês sideral (27,32 dias), porque a Terra também anda em volta do Sol.
3. A órbita da Lua é inclinada 5,1°: só há **eclipse** quando a lua nova ou cheia acontece perto da linha dos nodos. Com o nodo alinhado ao Sol ($0°$) começa com eclipse solar; mude para 40° e veja os meses sem eclipse.
4. No hemisfério Sul a lua crescente aparece iluminada à **esquerda**.`,
			predict: [{
				question: "Por que não há eclipse solar em toda lua nova?",
				options: [
					"Porque a Lua é pequena demais",
					"Porque a órbita da Lua é inclinada em relação à da Terra",
					"Porque a Terra gira"
				],
				answer: 1,
				explanation: "Com 5,1° de inclinação, na maioria das luas novas a Lua passa acima ou abaixo do Sol no céu; o alinhamento só ocorre perto dos nodos."
			}]
		},
		{
			id: "canhao",
			label: "Canhão de Newton",
			params: {
				modo: 4,
				h: 200,
				v: 7.8,
				rapidez: 1
			},
			guide: `### Velocidades cósmicas
1. Com $v_0$ abaixo de $v_1$ o projétil cai de volta, cada vez mais longe.
2. Em $v_0 = v_1 \\approx 7{,}8$ km/s (para 200 km) a órbita é circular: o projétil "cai" o tempo todo sem tocar o chão.
3. Entre $v_1$ e $v_2$ a órbita é elíptica; a partir de $v_2 \\approx 11{,}0$ km/s ele escapa (parábola/hipérbole).
4. A linha tracejada é a cônica prevista pelas condições iniciais.`,
			predict: [{
				question: "Lançado horizontalmente a 9 km/s de 200 km de altura, o projétil:",
				options: [
					"cai na Terra",
					"fica numa órbita elíptica",
					"escapa da Terra"
				],
				answer: 1,
				explanation: "$v_1 = 7{,}8$ km/s < 9 km/s < $v_2 = 11{,}0$ km/s: energia negativa e velocidade acima da circular — elipse com perigeu no ponto de lançamento."
			}]
		},
		{
			id: "geo",
			label: "Satélite geoestacionário",
			params: {
				modo: 5,
				rsat: 42164,
				rapidez: 1
			},
			guide: `### Parado no céu
1. Com $r = 42\\,164$ km o período é um dia sideral (23 h 56 min): o satélite acompanha a rotação da Terra e a antena em Brasília não precisa se mexer.
2. Diminua o raio: o satélite fica mais rápido que a Terra e deriva para leste. Aumente: deriva para oeste.
3. Compare com a ISS (r ≈ 6 780 km, ~92 min).`
		}
	],
	exercises: [{
		id: "v1",
		prompt: "Qual é a velocidade de uma órbita circular a {h} km de altitude? (GM_Terra = 3,986 × 10^14 m³/s², R = 6 371 km)",
		vary: { h: [
			200,
			2e3,
			0
		] },
		fixed: { modo: 4 },
		answer: {
			label: "v₁",
			unit: "km/s",
			compute: (p) => v1(num(p, "h") * 1e3) / 1e3
		},
		tolerance: .01
	}, {
		id: "periodo-satelite",
		prompt: "Um satélite em órbita circular tem raio {rsat} km. Qual é o seu período? (GM_Terra = 3,986 × 10^14 m³/s²)",
		vary: { rsat: [
			7e3,
			5e4,
			0
		] },
		fixed: { modo: 5 },
		answer: {
			label: "T",
			unit: "h",
			compute: (p) => orbitPeriod(num(p, "rsat") * 1e3) / 3600
		},
		tolerance: .01,
		hint: "T = 2π√(r³/GM)."
	}],
	init(p) {
		const m = modeOf(p);
		const bodies = m === 0 ? presetBodies(Math.round(num(p, "preset"))) : [];
		return {
			tf: m === 1 ? 25 : m === 2 ? 0 : 0,
			bodies,
			nextId: 10,
			sel: bodies[1]?.id ?? 1,
			y: m === 4 ? cannonInit(p) : [
				0,
				0,
				0,
				0
			],
			hit: false,
			drag: null
		};
	},
	step(s, p, _t, dt) {
		const m = modeOf(p);
		const h = RATE[m] * num(p, "rapidez", 1) * dt;
		if (m === 0) {
			if (s.drag) return s;
			return {
				...s,
				tf: s.tf + h,
				bodies: nbodyStep(s.bodies, h)
			};
		}
		if (m === 4) {
			if (s.hit) return s;
			let y = s.y;
			const n = Math.max(1, Math.ceil(h / 2));
			for (let i = 0; i < n; i++) {
				y = rk4(cannonRhs, y, h / n);
				if (Math.hypot(y[0], y[1]) < 6371e3) {
					const r = Math.hypot(y[0], y[1]);
					y = [
						y[0] * R_EARTH / r,
						y[1] * R_EARTH / r,
						0,
						0
					];
					return {
						...s,
						tf: s.tf + h * (i + 1) / n,
						y,
						hit: true
					};
				}
			}
			return {
				...s,
				tf: s.tf + h,
				y
			};
		}
		return {
			...s,
			tf: s.tf + h
		};
	},
	dt: .01,
	sampleEvery: 2,
	maxSamples: 6e3,
	tEnd: 3600,
	viewport(p) {
		switch (modeOf(p)) {
			case 0: {
				const z = num(p, "zoom", 3);
				return {
					xMin: -z,
					xMax: z,
					yMin: -z * .72,
					yMax: z * .72,
					unit: "UA"
				};
			}
			case 1: return {
				xMin: -1.35,
				xMax: 1.35,
				yMin: -1.45,
				yMax: 1.05
			};
			case 2: return {
				xMin: -2.15,
				xMax: 2.15,
				yMin: -1.2,
				yMax: 1.2
			};
			case 3: return {
				xMin: -2.2,
				xMax: 2.2,
				yMin: -1.2,
				yMax: 1.2
			};
			default: return {
				xMin: -2.3,
				xMax: 2.3,
				yMin: -1.5,
				yMax: 1.5
			};
		}
	},
	pointer: {
		down(s, p, pt) {
			if (modeOf(p) !== 0) return void 0;
			for (const b of s.bodies) if (Math.hypot(pt.x - (b.x + KV * b.vx), pt.y - (b.y + KV * b.vy)) < .08 * num(p, "zoom", 3) / 3) return {
				...s,
				drag: {
					kind: "vel",
					id: b.id
				},
				sel: b.id
			};
			for (const b of s.bodies) if (Math.hypot(pt.x - b.x, pt.y - b.y) < Math.max(bodyRadius(b.m), .1 * num(p, "zoom", 3) / 3)) return {
				...s,
				drag: {
					kind: "pos",
					id: b.id
				},
				sel: b.id
			};
		},
		move(s, _p, pt, dragging) {
			if (!dragging || !s.drag) return void 0;
			const { kind, id } = s.drag;
			return {
				...s,
				bodies: s.bodies.map((b) => b.id !== id ? b : kind === "pos" ? {
					...b,
					x: pt.x,
					y: pt.y
				} : {
					...b,
					vx: (pt.x - b.x) / KV,
					vy: (pt.y - b.y) / KV
				})
			};
		},
		up: (s) => s.drag ? {
			...s,
			drag: null
		} : void 0,
		cursor: (s, p) => modeOf(p) === 0 ? s.drag ? "grabbing" : "grab" : void 0
	},
	actions: [
		{
			id: "add",
			label: "N corpos: adicionar corpo",
			run: (s) => {
				if (s.bodies.length >= 6) return s;
				const k = s.bodies.length;
				const r = 1.2 + .5 * k, ang = 1.1 * k;
				const M = s.bodies.reduce((a, b) => a + b.m, 0) || 1;
				const v = Math.sqrt(GU * M / r);
				const b = {
					id: s.nextId,
					m: 3e-6,
					x: r * Math.cos(ang),
					y: r * Math.sin(ang),
					vx: -v * Math.sin(ang),
					vy: v * Math.cos(ang)
				};
				return {
					...s,
					bodies: [...s.bodies, b],
					nextId: s.nextId + 1,
					sel: b.id
				};
			}
		},
		{
			id: "remove",
			label: "N corpos: remover selecionado",
			run: (s) => ({
				...s,
				bodies: s.bodies.filter((b) => b.id !== s.sel)
			})
		},
		{
			id: "mais",
			label: "Massa ×10",
			run: (s) => ({
				...s,
				bodies: s.bodies.map((b) => b.id === s.sel ? {
					...b,
					m: Math.min(b.m * 10, 5)
				} : b)
			})
		},
		{
			id: "menos",
			label: "Massa ÷10",
			run: (s) => ({
				...s,
				bodies: s.bodies.map((b) => b.id === s.sel ? {
					...b,
					m: Math.max(b.m / 10, 1e-9)
				} : b)
			})
		},
		{
			id: "cm",
			label: "Ir para o centro de massa",
			run: (s) => ({
				...s,
				bodies: toCM(s.bodies)
			})
		}
	],
	render(ctx, frame) {
		const d = draw(ctx, frame);
		const { state: s, params: p } = frame;
		switch (modeOf(p)) {
			case 0: return renderNBody(d, s, p, frame.trail);
			case 1: return renderScale(d, s, p);
			case 2: return renderRetro(d, s, p);
			case 3: return renderPhases(d, s, p);
			case 4: return renderCannon(d, s, p, frame.trail);
			default: return renderGeo(d, s, p);
		}
	}
});
function toDays(tf, p) {
	const u = UNIT[modeOf(p)];
	return u === "ano" ? tf * YEAR_DAYS : u === "dia" ? tf : tf / 86400;
}
/** Dia (desde J2000) mostrado no modo retrógrado. */
var retroCache = /* @__PURE__ */ new Map();
function retroT0(p, s) {
	const k = Math.round(num(p, "alvo", 2));
	if (!retroCache.has(k)) retroCache.set(k, retroStart(p));
	return retroCache.get(k) + s.tf;
}
var COLORS = [
	"#f2b632",
	"#3b7dd8",
	"#c8553d",
	"#19a979",
	"#8a63d2",
	"#d64f8a"
];
function renderNBody(d, s, p, trail) {
	const { theme } = d;
	const z = num(p, "zoom", 3);
	d.grid(-z, z, -z, z, z > 4 ? 1 : .5);
	const colorOf = (id) => COLORS[(id - 1) % COLORS.length];
	for (const b of s.bodies) {
		const pts = [];
		for (const q of trail.slice(-1500)) {
			const c = q.bodies.find((x) => x.id === b.id);
			if (c) pts.push([c.x, c.y]);
		}
		d.polyline(pts, {
			color: colorOf(b.id),
			width: 1.2,
			alpha: .55
		});
	}
	const [cx, cy] = centerOfMass(s.bodies);
	d.line(cx - .06, cy - .06, cx + .06, cy + .06, {
		color: theme.text,
		width: 1.5
	});
	d.line(cx - .06, cy + .06, cx + .06, cy - .06, {
		color: theme.text,
		width: 1.5
	});
	for (const b of s.bodies) {
		d.circle(b.x, b.y, bodyRadius(b.m), {
			fill: colorOf(b.id),
			stroke: b.id === s.sel ? theme.text : void 0,
			width: 2,
			minPx: 4
		});
		d.arrow(b.x, b.y, KV * b.vx, KV * b.vy, {
			color: colorOf(b.id),
			width: 1.8
		});
		d.dot(b.x + KV * b.vx, b.y + KV * b.vy, 4, theme.text, .6);
		d.text(`${fmt$1(b.m, 2)} M☉`, b.x, b.y, {
			color: theme.muted,
			size: 10,
			dy: 14
		});
	}
	const E = nbodyEnergy(s.bodies);
	d.text(`E = ${fmt$1(E, 5)}   L = ${fmt$1(angularMomentum(s.bodies), 5)}   × centro de massa`, -z + .05 * z, z * .66, {
		color: theme.text,
		size: 12,
		align: "left"
	});
	d.text("arraste corpos e pontas das setas", -z + .05 * z, -z * .66, {
		color: theme.muted,
		size: 11,
		align: "left"
	});
}
function renderScale(d, s, p) {
	const { theme } = d;
	const mode = Math.round(num(p, "dist"));
	const amax = mode === 0 ? 1.75 : 31;
	const R = 1;
	const map = (x, y) => {
		const r = Math.hypot(x, y);
		if (r === 0) return [0, 0];
		const rr = mode === 2 ? R * Math.log10(1 + r / .3 * 9) / Math.log10(1 + 31 / .3 * 9) : R * r / amax;
		return [x / r * rr, y / r * rr - .15];
	};
	d.dot(0, -.15, 7, "#f2b632");
	const sel = Math.round(num(p, "planeta", 2));
	PLANETS.forEach((pl, i) => {
		if (mode === 0 && pl.a > 1.8) return;
		const orb = [];
		for (let k = 0; k <= 120; k++) orb.push(map(...planetPos(pl, k / 120 * pl.a ** 1.5)));
		d.polyline(orb, {
			color: theme.grid,
			width: i === sel ? 1.8 : 1
		});
		const [x, y] = map(...planetPos(pl, s.tf));
		d.dot(x, y, i === sel ? 6 : 4, pl.color);
		d.text(pl.name, x, y, {
			color: i === sel ? theme.text : theme.muted,
			size: 10,
			dy: -10
		});
	});
	const pl = PLANETS[sel];
	const [xs, ys] = planetPos(pl, s.tf);
	[
		`${pl.name}: a = ${fmt$1(pl.a, 4)} UA · e = ${fmt$1(pl.e, 3)} · T = ${fmt$1(pl.T, 4)} anos`,
		`massa = ${fmt$1(pl.m / 5972e21, 3)} Terras · raio = ${fmt$1(pl.R, 5)} km · dia sideral = ${fmt$1(pl.rot, 4)} dias`,
		`distância ao Sol agora = ${fmt$1(Math.hypot(xs, ys), 4)} UA · ano ${fmt$1(2e3 + s.tf, 5)}`
	].forEach((t, k) => d.text(t, -1.32, 1 - .07 * k, {
		color: k === 0 ? theme.text : theme.muted,
		size: 11,
		align: "left"
	}));
	const y0 = -1.32, k = .13 / 69911;
	d.line(-1.35, -1.4500000000000002, 1.35, -1.4500000000000002, { color: theme.grid });
	d.circle(-1.35 - R_SUN_KM * k + .12, y0, R_SUN_KM * k, {
		fill: "#f2b632",
		alpha: .85
	});
	let x = -1.08;
	for (const q of PLANETS) {
		const r = Math.max(q.R * k, .004);
		x += r + .03;
		d.circle(x, y0, r, { fill: q.color });
		d.text(q.name.slice(0, 3), x, -1.4500000000000002, {
			color: theme.muted,
			size: 9,
			dy: 8
		});
		x += r + .03;
	}
	d.text("tamanhos na mesma escala (Sol à esquerda)", .6, -1.1500000000000001, {
		color: theme.muted,
		size: 10
	});
}
function renderRetro(d, s, p) {
	const { theme } = d;
	const pl = retroPlanet(p), earth = PLANETS[2];
	const t = retroT0(p, s), tY = t / YEAR_DAYS;
	const k = .95 / (Math.max(1.6, pl.a) * 1.05);
	const L = (v) => [-1.08 + k * v[0], k * v[1]];
	d.text("heliocêntrico", -1.08, 1.12, {
		color: theme.text,
		size: 12
	});
	for (const q of [earth, pl]) {
		const orb = [];
		for (let i = 0; i <= 100; i++) orb.push(L(planetPos(q, i / 100 * q.a ** 1.5)));
		d.polyline(orb, { color: theme.grid });
	}
	d.dot(-1.08, 0, 6, "#f2b632");
	const hist = 300;
	for (let i = 0; i <= 10; i++) {
		const tt = (t - hist + hist * i / 10) / YEAR_DAYS;
		const e = L(planetPos(earth, tt)), m = L(planetPos(pl, tt));
		d.line(e[0], e[1], e[0] + (m[0] - e[0]) * 1.6, e[1] + (m[1] - e[1]) * 1.6, {
			color: theme.accent,
			width: 1,
			alpha: .15 + .08 * i
		});
	}
	const E = L(planetPos(earth, tY)), M = L(planetPos(pl, tY));
	d.dot(E[0], E[1], 5, earth.color);
	d.dot(M[0], M[1], 5, pl.color);
	d.line(E[0], E[1], M[0], M[1], {
		color: theme.accent,
		width: 1.5
	});
	const R2 = (v) => [1.08 + k * .5 * v[0], k * .5 * v[1]];
	d.text("geocêntrico (Terra fixa)", 1.08, 1.12, {
		color: theme.text,
		size: 12
	});
	const path = [];
	for (let i = 0; i <= 400; i++) {
		const tt = (t - 800 + 800 * i / 400) / YEAR_DAYS;
		const e = planetPos(earth, tt), m = planetPos(pl, tt);
		path.push(R2([m[0] - e[0], m[1] - e[1]]));
	}
	d.polyline(path, {
		color: pl.color,
		width: 1.5
	});
	const sun = [];
	for (let i = 0; i <= 100; i++) {
		const e = planetPos(earth, (t - 365 + 3.65 * i) / YEAR_DAYS);
		sun.push(R2([-e[0], -e[1]]));
	}
	d.polyline(sun, {
		color: "#f2b632",
		width: 1,
		alpha: .6
	});
	d.dot(1.08, 0, 5, earth.color);
	const e = planetPos(earth, tY), m = planetPos(pl, tY);
	const Mg = R2([m[0] - e[0], m[1] - e[1]]);
	d.dot(Mg[0], Mg[1], 5, pl.color);
	const Sg = R2([-e[0], -e[1]]);
	d.dot(Sg[0], Sg[1], 5, "#f2b632");
	const rate = lambdaRate(p, t);
	const retro = rate < 0;
	d.text(`λ = ${fmt$1(deg(geoLongitude(pl, tY)), 4)}°   dλ/dt = ${fmt$1(rate, 3)} °/dia ${retro ? "· RETRÓGRADO" : "· direto"}`, 0, -1.12, {
		color: retro ? theme.negative : theme.text,
		size: 12,
		weight: retro ? "600" : "400"
	});
}
function renderPhases(d, s, p) {
	const { theme } = d;
	const g = moonGeo(s.tf, num(p, "nodo", 40));
	const lamS = 2 * Math.PI * s.tf / YEAR_DAYS;
	const cx = -.95, R = .75;
	for (let k = -3; k <= 3; k++) d.arrow(.19999999999999996, k * .28, -.25, 0, {
		color: "#f2b632",
		width: 1.2
	});
	d.text("luz do Sol", .050000000000000044, 1.1, {
		color: theme.muted,
		size: 11
	});
	d.circle(cx, 0, R, {
		stroke: theme.grid,
		width: 1
	});
	const node = rad(num(p, "nodo", 40)) - 2 * Math.PI * s.tf / 6798.38 - lamS;
	d.line(cx - R * 1.1 * Math.cos(node), -.75 * 1.1 * Math.sin(node), cx + R * 1.1 * Math.cos(node), R * 1.1 * Math.sin(node), {
		color: theme.muted,
		dash: [4, 4]
	});
	d.text("nodos", cx + R * 1.1 * Math.cos(node), R * 1.1 * Math.sin(node), {
		color: theme.muted,
		size: 10,
		dy: -8
	});
	d.circle(cx, 0, .12, { fill: "#1f3f73" });
	d.ctx.beginPath();
	d.ctx.arc(cx, 0, .12, -Math.PI / 2, Math.PI / 2);
	d.ctx.fillStyle = "#3b7dd8";
	d.ctx.fill();
	const mx = cx + R * Math.cos(g.elong), my = R * Math.sin(g.elong);
	const rm = .07;
	d.circle(mx, my, rm, { fill: "#30343a" });
	d.ctx.beginPath();
	d.ctx.arc(mx, my, rm, -Math.PI / 2, Math.PI / 2);
	d.ctx.fillStyle = "#e9e4d4";
	d.ctx.fill();
	d.text("Lua", mx, my, {
		color: theme.text,
		size: 11,
		dy: -14
	});
	const px = 1.15, pr = .62;
	d.text("vista da Terra", px, 1.1, {
		color: theme.text,
		size: 12
	});
	d.circle(px, .1, pr, { fill: "#30343a" });
	const south = Math.round(num(p, "hemis")) === 0;
	const side = (g.elong < Math.PI ? 1 : -1) * (south ? -1 : 1);
	const tx = pr * Math.cos(g.sep);
	const pts = [];
	for (let i = 0; i <= 60; i++) {
		const a = -Math.PI / 2 + Math.PI * i / 60;
		pts.push([px + side * pr * Math.cos(a), .1 + pr * Math.sin(a)]);
	}
	for (let i = 0; i <= 60; i++) {
		const a = Math.PI / 2 - Math.PI * i / 60;
		pts.push([px + side * tx * Math.cos(a), .1 + pr * Math.sin(a)]);
	}
	d.polyline(pts, {
		fill: "#e9e4d4",
		color: "none",
		close: true
	});
	const ecl = eclipse(g);
	const age = g.elong / (2 * Math.PI) * MOON_SYNODIC;
	d.text(`${phaseName(g.elong)} · ${fmt$1(g.k * 100, 3)}% iluminada · idade ${fmt$1(age, 3)} d`, px, -.68, {
		color: theme.text,
		size: 12
	});
	d.text(`dia ${fmt$1(s.tf, 4)} · latitude da Lua ${fmt$1(deg(g.beta), 2)}° (inclinação ${fmt$1(MOON_INCL, 3)}°)`, px, -.84, {
		color: theme.muted,
		size: 11
	});
	if (ecl) d.text(ecl === "solar" ? "ECLIPSE SOLAR" : "ECLIPSE LUNAR", px, -1.02, {
		color: theme.negative,
		size: 14,
		weight: "700"
	});
}
function renderCannon(d, s, p, trail) {
	const { theme } = d;
	const k = 1 / R_EARTH;
	d.circle(0, 0, 1, {
		fill: theme.dark ? "#1d3a5f" : "#9cc3e6",
		stroke: theme.muted,
		width: 1
	});
	const h = num(p, "h", 200) * 1e3;
	d.polyline([
		[-.08, .99],
		[0, 1 + h * k],
		[.08, .99]
	], {
		fill: theme.ground,
		color: theme.muted,
		close: true
	});
	const o = cannonOrbit(cannonInit(p));
	const pts = [];
	for (let i = 0; i <= 360; i++) {
		const nu = i / 360 * 2 * Math.PI;
		const r = o.hz * o.hz / GM_EARTH / (1 + o.e * Math.cos(nu));
		if (r <= 0 || r * k > 6) continue;
		const sgn = num(p, "v", 7.8) * 1e3 >= v1(h) ? 0 : Math.PI;
		const ang = Math.PI / 2 - (nu + sgn);
		pts.push([r * k * Math.cos(ang), r * k * Math.sin(ang)]);
	}
	d.polyline(pts, {
		color: theme.muted,
		dash: [4, 4],
		width: 1
	});
	const tr = trail.filter((q) => q.y.length === 4 && q.y[1] !== 0).map((q) => [q.y[0] * k, q.y[1] * k]);
	d.polyline(tr, {
		color: theme.accent,
		width: 2
	});
	const x = s.y[0] * k, y = s.y[1] * k;
	d.dot(x, y, 5, theme.negative);
	if (!s.hit) d.arrowPx(x, y, s.y[2], s.y[3], 30, { color: theme.negative });
	const vv = num(p, "v", 7.8) * 1e3;
	const kind = s.hit ? "caiu" : vv >= v2(h) ? "escapa" : vv >= v1(h) * .999 ? "em órbita" : "subórbita";
	d.text(`v₀ = ${fmt$1(vv / 1e3, 3)} km/s · v₁ = ${fmt$1(v1(h) / 1e3, 3)} · v₂ = ${fmt$1(v2(h) / 1e3, 3)} km/s → ${kind}`, 0, 1.38, {
		color: theme.text,
		size: 12
	});
	d.text(`t = ${fmt$1(s.tf / 60, 4)} min · altitude ${fmt$1((Math.hypot(s.y[0], s.y[1]) - R_EARTH) / 1e3, 4)} km`, 0, -1.38, {
		color: theme.muted,
		size: 11
	});
}
function renderGeo(d, s, p) {
	const { theme } = d;
	const r = geoR(p);
	const k = 1.3 / Math.max(rGeo(), r);
	const Re = R_EARTH * k;
	const th = earthAngle(s.tf);
	d.circle(0, 0, Re, {
		fill: theme.dark ? "#1d3a5f" : "#9cc3e6",
		stroke: theme.muted
	});
	for (let i = 0; i < 12; i++) {
		const a = th + i * Math.PI / 6;
		d.line(0, 0, Re * Math.cos(a), Re * Math.sin(a), {
			color: theme.muted,
			width: .8,
			alpha: .6
		});
	}
	const st = [Re * Math.cos(th), Re * Math.sin(th)];
	d.dot(st[0], st[1], 5, theme.series[2]);
	d.text("antena", st[0], st[1], {
		color: theme.series[2],
		size: 10,
		dy: 12
	});
	d.circle(0, 0, rGeo() * k, {
		stroke: theme.grid,
		width: 1,
		dash: [5, 4]
	});
	d.circle(0, 0, r * k, {
		stroke: theme.accent,
		width: 1
	});
	const sa = 2 * Math.PI / orbitPeriod(r) * s.tf;
	const sx = r * k * Math.cos(sa), sy = r * k * Math.sin(sa);
	d.line(st[0], st[1], sx, sy, {
		color: theme.series[2],
		dash: [3, 3]
	});
	d.rect(sx - .03, sy - .03, .06, .06, { fill: theme.negative });
	d.text(`T = ${fmt$1(orbitPeriod(r) / 3600, 4)} h · r_geo = ${fmt$1(rGeo() / 1e3, 5)} km`, 0, 1.4, {
		color: theme.text,
		size: 12
	});
	const drift = ((subLongitude(p, s.tf) + 180) % 360 + 360) % 360 - 180;
	d.text(`tempo ${fmt$1(s.tf / 3600, 4)} h · deriva do satélite em relação à antena ${fmt$1(drift, 3)}°`, 0, -1.4, {
		color: theme.muted,
		size: 11
	});
}
//#endregion
//#region apps/web/src/challenge-core.ts
/** Simulações usadas pelos desafios (só estas entram no pacote do servidor). */
var SIMS = [
	projetilArrasto,
	jogosFisica,
	sistemaSolar,
	ressonancia,
	calorimetria,
	ponteWheatstone,
	rlcCa,
	montanhaRussa,
	lentes,
	braquistocrona,
	foguete,
	circuitosDc,
	millikan
];
var challengeSim = (id) => SIMS.find((s) => s.id === id);
var fmt = (v, d = 3) => formatBR(v, d);
/** 1 sem erro, 0,9 no limite da tolerância, caindo suavemente depois. */
function closeness(err, tol) {
	const e = Math.abs(err);
	if (!Number.isFinite(e)) return 0;
	if (e <= tol) return 1 - .1 * e / tol;
	return .9 * Math.exp(-(e - tol) / (4 * tol));
}
function stars(o) {
	if (!o.ok) return 0;
	if (o.accuracy >= .9 && o.economy >= .9) return 3;
	if (o.accuracy >= .6 && o.economy >= .6) return 2;
	return 1;
}
/** Tempo de referência por nível (s): acima dele a pontuação cai até 70%. */
var PAR_TIME = {
	1: 180,
	2: 360,
	3: 600
};
/**
* Pontos de uma tentativa: precisão (70%) e economia (30%), multiplicados pelo nível;
* cada tentativa extra tira 5% (até metade) e passar do tempo de referência tira até 30%.
*/
function points(level, o, attempts, seconds) {
	if (!o.ok) return 0;
	const base = 700 * clamp(o.accuracy, 0, 1) + 300 * clamp(o.economy, 0, 1);
	const mult = level === 1 ? 1 : level === 2 ? 1.5 : 2;
	const fa = Math.max(.5, 1 - .05 * Math.max(0, attempts - 1));
	const par = PAR_TIME[level];
	const ft = seconds <= par ? 1 : Math.max(.7, 1 - .3 * (seconds - par) / (4 * par));
	return Math.round(base * mult * fa * ft);
}
function simOf(id) {
	const s = challengeSim(id);
	if (!s) throw new Error(`simulação ${id} não encontrada`);
	return s;
}
/** Parâmetros efetivos: padrão ← cenário ← base do desafio ← knobs do aluno (limitados à faixa do controle). */
function paramsFor(ch, values = {}) {
	const sim = simOf(ch.sim);
	const p = withOverrides(sim, {
		...sim.scenarios.find((s) => s.id === ch.scenario)?.params,
		...ch.base
	});
	for (const k of ch.knobs) {
		const v = values[k];
		const spec = sim.params.find((x) => x.key === k);
		if (spec && typeof v === "number" && Number.isFinite(v)) p[k] = clamp(v, spec.min, spec.max);
	}
	return p;
}
function evaluateChallenge(ch, attempt) {
	const p = paramsFor(ch, attempt.params);
	if (ch.build && attempt.build === void 0) return {
		ok: false,
		accuracy: 0,
		economy: 0,
		metrics: [],
		message: `Monte no palco antes de avaliar: ${ch.build.what}`
	};
	try {
		return ch.evaluate(p, attempt.build);
	} catch {
		return {
			ok: false,
			accuracy: 0,
			economy: 0,
			metrics: [],
			message: "Não foi possível avaliar esta montagem."
		};
	}
}
/** Roda a simulação a partir de `params` (e de um estado montado) até `stop` ou `tMax`. */
function run(simId, params, opts) {
	const r = new Runner(simOf(simId), params);
	if (opts.state) r.state = opts.state(r.state, r.params);
	for (let n = 0; n < 5e6 && !r.finished && r.t < opts.tMax - 1e-12; n++) {
		r.stepOnce();
		opts.each?.(r);
		if (opts.stop?.(r)) break;
	}
	return r;
}
var fail = (message, metrics = []) => ({
	ok: false,
	accuracy: 0,
	economy: 0,
	metrics,
	message
});
var finite = (v) => typeof v === "number" && Number.isFinite(v);
/** Alcance e altura ao cruzar x = xw (NaN se não chegar lá). */
function shot(p, xw = NaN) {
	let yAt = NaN;
	let px = 0;
	let py = p.h0 ?? 0;
	return {
		x: run("projetil-arrasto", p, {
			tMax: 60,
			each: (r) => {
				const x = r.value("x");
				const y = r.value("y");
				if (Number.isNaN(yAt) && px < xw && x >= xw) yAt = py + (y - py) * (xw - px) / (x - px || 1);
				px = x;
				py = y;
			}
		}).value("x"),
		yAt
	};
}
var WALL = {
	x: 18,
	h: 7,
	r: .11
};
var WALL_TARGET = 40;
function clearsWall(p) {
	const s = shot(p, WALL.x);
	return {
		...s,
		clears: s.yAt >= WALL.h + WALL.r
	};
}
function captureCargas(state) {
	const s = state;
	if (!Array.isArray(s?.cargas)) return void 0;
	const cs = s.cargas.filter((c) => finite(c?.x) && finite(c?.y) && finite(c?.q) && c.y >= 0).map((c) => ({
		x: c.x,
		y: c.y,
		q: c.q
	}));
	return cs.length ? cs : void 0;
}
function hockey(p, cargas, ideal) {
	if (!cargas?.length) return fail("Ponha pelo menos uma carga no campo (arraste da caixa abaixo do campo).");
	if (cargas.length > 8) return fail("Use no máximo 8 cargas.");
	const qmax = 100;
	const cs = cargas.map((c) => ({
		x: clamp(c.x, 0, 1.6),
		y: clamp(c.y, 0, 1),
		q: clamp(c.q, -100, qmax)
	}));
	const r = run("jogos-fisica", p, {
		tMax: 40,
		state: (s) => ({
			...s,
			cargas: cs,
			lancado: true,
			status: 0,
			tj: 0,
			rastro: []
		}),
		stop: (r) => r.state.status !== 0
	});
	const n = cs.length;
	const metrics = [{
		label: "Cargas usadas",
		value: n,
		digits: 1
	}, {
		label: "Tempo até o gol",
		value: r.state.tj,
		unit: "s"
	}];
	if (r.state.status !== 1) return fail(r.state.msg || "O disco não chegou ao gol.", metrics);
	return {
		ok: true,
		accuracy: 1,
		economy: Math.min(1, (ideal / n) ** .7),
		metrics,
		message: `Gol com ${n} carga(s) em ${fmt(r.state.tj, 3)} s.`
	};
}
/** Arco do trecho do loop (nós 5 a 11 da pista com loop). */
function loopArc(pts) {
	const tr = trackOf(pts);
	const node = (i) => tr.s[Math.round(i * (tr.s.length - 1) / (pts.length - 1))];
	return [node(5), node(11)];
}
function rideLoop(p) {
	let minN = Infinity;
	let passed = false;
	let arc = null;
	run("montanha-russa", p, {
		tMax: 10,
		each: (r) => {
			arc ??= loopArc(r.state.pts);
			const s = r.state.s;
			if (s >= arc[0] && s <= arc[1]) minN = Math.min(minN, r.value("N"));
			if (s > arc[1]) passed = true;
		},
		stop: (r) => passed || r.state.v < 0
	});
	return {
		passed,
		minN
	};
}
var loopOk = (p) => {
	const r = rideLoop(p);
	return r.passed && r.minN >= 0;
};
var loopHmin;
function loopMinHeight(p) {
	if (loopHmin !== void 0) return loopHmin;
	let lo = 5;
	let hi = 80;
	if (!loopOk({
		...p,
		h0: hi / 10
	})) return loopHmin = Infinity;
	while (hi - lo > 1) {
		const m = lo + hi >> 1;
		if (loopOk({
			...p,
			h0: m / 10
		})) hi = m;
		else lo = m;
	}
	return loopHmin = hi / 10;
}
function captureOptics(state) {
	const s = state;
	if (!Array.isArray(s?.els) || !finite(s.ox) || !finite(s.oh)) return void 0;
	const els = s.els.filter((e) => e?.kind === "fina" && finite(e.x) && finite(e.P)).map((e) => ({
		id: e.id,
		kind: e.kind,
		x: e.x,
		P: e.P
	}));
	return els.length ? {
		els,
		ox: s.ox,
		oh: s.oh
	} : void 0;
}
function instrument(p, o, inf, target, tol, name) {
	if (!o) return fail("Monte as lentes no palco.");
	if (o.els.length > 4) return fail("Use no máximo 4 lentes.");
	if (o.els.some((e) => Math.abs(e.P) > 400)) return fail("Há uma lente com distância focal curta demais (abaixo de 2,5 mm).");
	if (!inf && o.els.some((e) => e.x <= o.ox)) return fail("O objeto precisa ficar antes de todas as lentes.");
	const r = run("lentes", p, {
		tMax: 0,
		state: (s) => ({
			...s,
			els: o.els.map((e) => ({ ...e })),
			ox: o.ox,
			oh: o.oh,
			inf,
			sel: null,
			drag: null
		})
	});
	const M = r.value("Mang");
	const q = r.value("q");
	const relaxed = q <= -.25 || Math.abs(q) >= 5;
	const err = Math.abs(Math.abs(M) / target - 1);
	const metrics = [{
		label: "Aumento angular",
		value: M,
		unit: "×"
	}, {
		label: "Imagem final (distância à última lente)",
		value: Math.abs(q) >= 1e5 ? Infinity : q,
		unit: "m"
	}];
	if (!relaxed) return fail(`A imagem final fica a ${fmt(q, 3)} m: o olho não a focaliza. Ajuste para que a imagem vá ao infinito (ou fique além de 25 cm, virtual).`, metrics);
	if (err > .15) return fail(`O ${name} dá ${fmt(Math.abs(M), 3)}×; a meta é ${target}×.`, metrics);
	return {
		ok: true,
		accuracy: closeness(err, tol),
		economy: 1,
		metrics,
		message: `${name[0].toUpperCase()}${name.slice(1)} de ${fmt(Math.abs(M), 3)}× com imagem final que o olho focaliza.`
	};
}
var ROCKET_V = 7800;
var rocketMmin;
/** Menor massa de lançamento (grade dos controles) cujo Δv ideal alcança a meta. */
function rocketMinMass(p) {
	if (rocketMmin !== void 0) return rocketMmin;
	let best = Infinity;
	for (const n of [
		1,
		2,
		3
	]) for (let r = .1; r <= 1.0001; r += .05) {
		let lo = 2;
		let hi = 200;
		const q = {
			...p,
			n,
			r: Math.round(r * 100) / 100
		};
		const ok = (k) => deltaVIdeal({
			...q,
			M1: 500 * k
		}) >= ROCKET_V;
		if (!ok(hi)) continue;
		while (hi - lo > 1) {
			const m = lo + hi >> 1;
			if (ok(m)) hi = m;
			else lo = m;
		}
		best = Math.min(best, ignitionMasses({
			...q,
			M1: 500 * hi
		})[0]);
	}
	return rocketMmin = best;
}
function steadyAmplitude(p) {
	let A = 0;
	run("ressonancia", p, {
		tMax: 25,
		each: (r) => r.t >= 20 && (A = Math.max(A, Math.abs(r.value("x"))))
	});
	return A;
}
var resonanceRef;
/** Maior amplitude de regime medida na simulação, varrendo ω na grade do controle perto do pico. */
function resonancePeak(p) {
	if (resonanceRef !== void 0) return resonanceRef;
	const m = p.m ?? 1;
	const k = p.k ?? 25;
	const b = p.b ?? 2;
	const wr = Math.sqrt(Math.max(.01, k / m - b * b / (2 * m * m)));
	let best = 0;
	for (let i = -2; i <= 2; i++) best = Math.max(best, steadyAmplitude({
		...p,
		w: Math.round(wr / .05 + i) * .05
	}));
	return resonanceRef = best;
}
function settle(simId, p, key, other, tMax) {
	return run(simId, p, {
		tMax,
		stop: (r) => Math.abs(r.value(key) - r.value(other)) < .002
	}).value(key);
}
/** Cicloide de A = (0, 0) até B = (X, −Y), na forma que o palco guarda uma curva desenhada. */
function cycloidPoints(X, Y, n = 400) {
	const th = cycloidTheta(X, Y);
	const R = cycloidR(X, Y);
	return Array.from({ length: n + 1 }, (_, i) => {
		const t = th * (i / n);
		return [R * (t - Math.sin(t)), -R * (1 - Math.cos(t))];
	});
}
var LAMPS = {
	n: 4,
	R: 12,
	Pmin: 1.5
};
/** Valores que os botões da bateria alcançam (série do construtor de circuitos). */
var BATTERY_VALUES = [
	1.5,
	3,
	4.5,
	6,
	9,
	12,
	24
];
var PART_KINDS = [
	"fio",
	"resistor",
	"bateria",
	"lampada",
	"chave",
	"amperimetro",
	"voltimetro"
];
var GRID = {
	w: 12,
	h: 8
};
var isPt = (q) => Array.isArray(q) && q.length === 2 && Number.isInteger(q[0]) && Number.isInteger(q[1]);
function captureCircuit(state) {
	const s = state;
	if (!Array.isArray(s?.comps) || !s.comps.length || s.comps.length > 80) return void 0;
	const parts = s.comps.filter((c) => typeof c?.kind === "string" && isPt(c.a) && isPt(c.b) && finite(c.value));
	return parts.length ? parts.map((c) => ({
		kind: c.kind,
		a: [c.a[0], c.a[1]],
		b: [c.b[0], c.b[1]],
		value: c.value,
		...c.kind === "chave" ? { closed: !!c.closed } : {}
	})) : void 0;
}
/** Monta o circuito como a bancada faria e resolve um passo (correntes e tensões em regime). */
function solveParts(p, parts) {
	return run("circuitos-dc", p, {
		tMax: 0,
		state: (s, q) => {
			const comps = parts.map((c, i) => makeComp(i + 1, c.kind, [c.a[0], c.a[1]], [c.b[0], c.b[1]], c.value, c.closed ?? true));
			return solveStep({
				...s,
				comps,
				selected: null,
				drag: null,
				nextId: comps.length + 1,
				warning: ""
			}, q, .001, false);
		}
	}).state;
}
/** Potência que as baterias entregam ao circuito (W). */
var deliveredPower = (s) => s.comps.filter((c) => c.kind === "bateria").reduce((a, c) => a - c.v * c.i, 0);
var circuitBest;
function circuit(p, parts, ref) {
	if (!parts?.length) return fail("Monte o circuito na bancada.");
	if (parts.length > 80) return fail("Use no máximo 80 peças.");
	if (parts.some((c) => !PART_KINDS.includes(c.kind))) return fail("Use só baterias, fios, lâmpadas, resistores, chaves e medidores.");
	if (parts.some((c) => c.a.concat(c.b).some((v) => !Number.isInteger(v)) || c.a[0] < 0 || c.b[0] < 0 || c.a[1] < 0 || c.b[1] < 0 || c.a[0] > GRID.w || c.b[0] > GRID.w || c.a[1] > GRID.h || c.b[1] > GRID.h)) return fail("Há uma peça fora da bancada.");
	if (parts.some((c) => c.a[0] === c.b[0] === (c.a[1] === c.b[1]))) return fail("Cada peça liga dois pontos diferentes da grade, na horizontal ou na vertical.");
	const lamps = parts.filter((c) => c.kind === "lampada");
	if (lamps.length !== LAMPS.n) return fail(`Use exatamente ${LAMPS.n} lâmpadas (há ${lamps.length}).`);
	if (lamps.some((c) => c.value !== LAMPS.R)) return fail(`As lâmpadas são de ${LAMPS.R} Ω: não troque o valor delas.`);
	const bats = parts.filter((c) => c.kind === "bateria");
	if (!bats.length) return fail("Falta a bateria.");
	if (bats.some((c) => !BATTERY_VALUES.includes(c.value))) return fail("Use baterias dos valores da bancada (1,5 V a 24 V).");
	if (parts.some((c) => c.kind === "resistor" && !(c.value >= .1 && c.value <= 1e7))) return fail("Há um resistor com valor fora da faixa da bancada.");
	const s = solveParts(p, parts);
	const P = deliveredPower(s);
	const lit = s.comps.filter((c) => c.kind === "lampada").map((c) => Math.abs(c.v * c.i));
	const dim = Math.min(...lit);
	circuitBest ??= deliveredPower(solveParts(p, ref));
	const metrics = [{
		label: "Potência fornecida pelas baterias",
		value: P,
		unit: "W"
	}, {
		label: "Lâmpada mais fraca",
		value: dim,
		unit: "W"
	}];
	if (s.warning) return fail(s.warning, metrics);
	if (dim < LAMPS.Pmin) return fail(`A lâmpada mais fraca recebe ${fmt(dim, 3)} W; cada uma precisa de pelo menos ${fmt(LAMPS.Pmin, 2)} W.`, metrics);
	return {
		ok: true,
		accuracy: 1,
		economy: closeness(Math.max(0, P - circuitBest) / circuitBest, .03),
		metrics,
		message: `As ${LAMPS.n} lâmpadas acendem com ${fmt(P, 3)} W fornecidos pelas baterias.`
	};
}
/** Quatro lâmpadas em paralelo numa bateria de 4,5 V (a solução de referência). */
var circuitRef = (V) => {
	const w = (a, b) => ({
		kind: "fio",
		a,
		b,
		value: 0
	});
	const parts = [{
		kind: "bateria",
		a: [2, 5],
		b: [2, 3],
		value: V
	}, w([2, 5], [2, 6])];
	for (let x = 2; x < 10; x += 2) parts.push(w([x, 6], [x + 2, 6]), w([x, 3], [x + 2, 3]));
	for (let x = 4; x <= 10; x += 2) parts.push({
		kind: "lampada",
		a: [x, 6],
		b: [x, 3],
		value: LAMPS.R
	});
	return parts;
};
var DROP_HOLD = 20;
function captureDrop(state) {
	const s = state;
	return Number.isInteger(s?.sel) && s.sel > 0 ? { gota: s.sel } : void 0;
}
function holdDrop(p, b) {
	if (!b || !Number.isInteger(b.gota)) return fail("Clique numa gota na luneta para selecioná-la.");
	const id = b.gota;
	const d0 = run("millikan", p, { tMax: 0 }).state.drops.find((d) => d.id === id);
	if (!d0) return fail("Escolha uma das gotas da borrifada inicial (a avaliação recomeça dela; não borrife de novo).");
	const Tc = p.T ?? 23;
	const vq = fallSpeed(d0.r, Tc);
	const vres = drift(d0.r, d0.n * E_CHARGE, (p.V ?? 0) / GAP, Tc);
	const yc = GAP / 2;
	let out = Math.abs(d0.y - yc) > RETICLE / 2;
	let gone = false;
	if (!out) run("millikan", p, {
		tMax: DROP_HOLD,
		state: (s) => ({
			...s,
			sel: id,
			timer: null
		}),
		each: (r) => {
			const d = r.state.drops.find((x) => x.id === id);
			if (!d) gone = true;
			else if (Math.abs(d.y - yc) > .001 / 2) out = true;
		},
		stop: () => out || gone
	});
	const metrics = [
		{
			label: "Tensão nas placas",
			value: p.V ?? 0,
			unit: "V",
			digits: 4
		},
		{
			label: "Velocidade que sobrou",
			value: vres * 1e6,
			unit: "µm/s"
		},
		{
			label: "Fração da queda livre",
			value: 100 * Math.abs(vres) / vq,
			unit: "%"
		}
	];
	if (Math.abs(d0.y - yc) > .001 / 2) return fail("Esta gota começa fora das linhas do retículo: escolha uma que comece entre elas.", metrics);
	if (d0.n !== 1) return fail(`Esta gota tem ${d0.n} cargas elementares; procure uma com uma só.`, metrics);
	if (out || gone) return fail(`A gota saiu do retículo antes de ${DROP_HOLD} s: ela ainda ${vres > 0 ? "sobe" : "desce"} a ${fmt(Math.abs(vres) * 1e6, 3)} µm/s.`, metrics);
	return {
		ok: true,
		accuracy: closeness(Math.abs(vres) / vq, .01),
		economy: 1,
		metrics,
		message: `A gota de carga e ficou ${DROP_HOLD} s no retículo; equilíbrio em ${fmt(balanceVoltage(d0.r, E_CHARGE), 4)} V.`
	};
}
var RADIO = {
	f: 2e3,
	neighbor: 2400
};
var CAL_TARGET = 30;
var challenges = [
	{
		id: "alvo-com-arrasto",
		title: "Chute no alvo com resistência do ar",
		level: 1,
		sim: "projetil-arrasto",
		scenario: "futebol",
		goal: "Faça a bola de futebol cair exatamente a **42,0 m** do ponto de chute, com a resistência do ar ligada.",
		hint: "Com arrasto, o alcance é menor que $v_0^2 \\sin 2\\theta / g$ e o ângulo de maior alcance fica abaixo de 45°.",
		base: {
			h0: 0,
			massa: .43,
			diametro: .22,
			cd: .25,
			rho: 1.225,
			g: 9.81
		},
		knobs: ["v0", "angulo"],
		evaluate(p) {
			const { x } = shot(p);
			const err = x - 42;
			const metrics = [{
				label: "Alcance",
				value: x,
				unit: "m"
			}, {
				label: "Erro",
				value: err,
				unit: "m"
			}];
			if (Math.abs(err) > 3) return fail(`A bola caiu a ${fmt(x, 3)} m: ${err > 0 ? "passou" : "faltou"} ${fmt(Math.abs(err), 2)} m.`, metrics);
			return {
				ok: true,
				accuracy: closeness(err, .3),
				economy: 1,
				metrics,
				message: `A bola caiu a ${fmt(x, 3)} m do chute.`
			};
		},
		reference: { params: {
			v0: 26,
			angulo: 41
		} },
		bad: { params: {
			v0: 20.5,
			angulo: 45
		} }
	},
	{
		id: "hoquei-uma-carga",
		title: "Hóquei elétrico: gol com uma carga",
		level: 1,
		sim: "jogos-fisica",
		scenario: "hoquei",
		goal: "Leve o disco (+20 nC) ao gol usando **uma única carga** fixa. Arraste a carga da caixa para o campo e avalie (não precisa lançar antes).",
		hint: "Cargas de mesmo sinal se repelem: uma carga positiva atrás do disco o empurra em linha reta para a direita.",
		base: {
			jogo: 0,
			nivel: 0,
			Qdisco: 20,
			campo: 1,
			exemplo: 0
		},
		knobs: ["qPeca"],
		economyLabel: "Economia de cargas",
		build: {
			what: "posicione as cargas no campo",
			capture: captureCargas
		},
		evaluate: (p, b) => hockey(p, b, 1),
		reference: {
			params: { qPeca: 50 },
			build: [{
				x: .05,
				y: .5,
				q: 50
			}]
		},
		bad: {
			params: { qPeca: 50 },
			build: [{
				x: .25,
				y: .5,
				q: -50
			}]
		}
	},
	{
		id: "orbita-geoestacionaria",
		title: "Órbita geoestacionária",
		level: 1,
		sim: "sistema-solar",
		scenario: "geo",
		goal: "Escolha o raio da órbita para o satélite ficar **parado sobre a antena**: período igual a um dia sideral (23 h 56 min 4 s), com erro abaixo de 0,04%.",
		hint: "A Terra gira uma vez em relação às estrelas em 86 164 s, não em 86 400 s. Use $T = 2\\pi\\sqrt{r^3/GM}$.",
		base: {
			modo: 5,
			rapidez: 1
		},
		knobs: ["rsat"],
		evaluate(p) {
			const T = run("sistema-solar", p, { tMax: 0 }).value("Tsat");
			const Tsid = 86164.1 / 3600;
			const err = (T - Tsid) / Tsid;
			const drift = 8640 * (1 / Tsid - 1 / T);
			const metrics = [{
				label: "Período",
				value: T,
				unit: "h",
				digits: 6
			}, {
				label: "Deriva sobre a antena",
				value: drift,
				unit: "°/dia"
			}];
			if (Math.abs(err) > .01) return fail(`Período de ${fmt(T, 5)} h: o satélite deriva ${fmt(Math.abs(drift), 3)}° por dia.`, metrics);
			return {
				ok: true,
				accuracy: closeness(err, 4e-4),
				economy: 1,
				metrics,
				message: `Período de ${fmt(T, 6)} h.`
			};
		},
		reference: { params: { rsat: 42160 } },
		bad: { params: { rsat: 42240 } }
	},
	{
		id: "sintonia-ressonancia",
		title: "Sintonize a ressonância",
		level: 1,
		sim: "ressonancia",
		scenario: "varredura",
		goal: "Ajuste a frequência da força externa para obter a **maior amplitude de regime** possível neste oscilador bem amortecido ($b = 2$ kg/s).",
		hint: "Com amortecimento, o pico de amplitude fica abaixo de $\\omega_0 = \\sqrt{k/m}$: $\\omega_r = \\sqrt{\\omega_0^2 - b^2/2m^2}$.",
		base: {
			modo: 0,
			m: 1,
			k: 25,
			b: 2,
			F0: 1
		},
		knobs: ["w"],
		evaluate(p) {
			const A = steadyAmplitude(p);
			const Amax = resonancePeak(p);
			const short = 1 - A / Amax;
			const metrics = [{
				label: "Amplitude de regime",
				value: A,
				unit: "m"
			}, {
				label: "Fração do máximo",
				value: 100 * A / Amax,
				unit: "%"
			}];
			if (A / Amax < .8) return fail(`Amplitude de ${fmt(A, 3)} m: ainda longe do pico.`, metrics);
			return {
				ok: true,
				accuracy: closeness(Math.max(0, short), .002),
				economy: 1,
				metrics,
				message: `Amplitude de ${fmt(A, 4)} m (${fmt(100 * A / Amax, 4)}% do máximo).`
			};
		},
		reference: { params: { w: 4.8 } },
		bad: { params: { w: 5 } }
	},
	{
		id: "calorimetria-30",
		title: "Equilíbrio em 30 °C",
		level: 1,
		sim: "calorimetria",
		scenario: "metal",
		goal: "Um bloco de cobre de 300 g a 100 °C cai no calorímetro (C = 80 J/K). Escolha a massa e a temperatura inicial da água para o equilíbrio ficar em **30,0 °C** (±0,1 °C).",
		hint: "Calor cedido = calor recebido: $m_b c_{Cu}(100 - T) = (m_a c_a + C)(T - T_a)$.",
		base: {
			modo: 1,
			Ccal: 80,
			corpo: 1,
			mb: .3,
			Tb: 100,
			k: 10,
			kamb: 0,
			ritmo: 200
		},
		knobs: ["ma", "Ta"],
		evaluate(p) {
			const T = settle("calorimetria", p, "T", "Tb", 4e3);
			const err = T - CAL_TARGET;
			const metrics = [{
				label: "Temperatura de equilíbrio",
				value: T,
				unit: "°C",
				digits: 4
			}];
			if (Math.abs(err) > 1) return fail(`O equilíbrio ficou em ${fmt(T, 4)} °C.`, metrics);
			return {
				ok: true,
				accuracy: closeness(err, .1),
				economy: 1,
				metrics,
				message: `Equilíbrio em ${fmt(T, 4)} °C.`
			};
		},
		reference: { params: {
			ma: .3,
			Ta: 24
		} },
		bad: { params: {
			ma: .2,
			Ta: 20
		} }
	},
	{
		id: "pouso-economico",
		title: "Pouso na Terra com pouco combustível",
		level: 2,
		sim: "jogos-fisica",
		scenario: "terra-auto",
		goal: "O piloto automático pousa o módulo na Terra. Escolha o empuxo máximo do motor e o **combustível embarcado** para pousar com segurança sobrando o mínimo (menos de 5% do que embarcou).",
		hint: "Para frear é preciso $T > mg$: combustível demais deixa o módulo pesado; de menos, ele acaba no meio da descida.",
		base: {
			jogo: 1,
			nivel: 0,
			g: 9.81,
			piloto: 1,
			x0: 120,
			vx0: 0
		},
		knobs: ["comb", "Tmax"],
		economyLabel: "Economia de combustível",
		evaluate(p) {
			const r = run("jogos-fisica", p, {
				tMax: 400,
				stop: (r) => r.state.status !== 0
			});
			const loaded = p.comb;
			const left = r.state.L.comb;
			const metrics = [
				{
					label: "Combustível embarcado",
					value: loaded,
					unit: "kg"
				},
				{
					label: "Combustível que sobrou",
					value: left,
					unit: "kg"
				},
				{
					label: "Velocidade no toque",
					value: Math.abs(r.state.L.vy),
					unit: "m/s"
				}
			];
			if (r.state.status !== 1) return fail(r.state.msg || "O módulo não pousou.", metrics);
			return {
				ok: true,
				accuracy: 1 - .05 * Math.abs(r.state.L.vy),
				economy: closeness(left / loaded, .05),
				metrics,
				message: `Pouso seguro; sobraram ${fmt(left, 3)} kg de ${fmt(loaded, 3)} kg.`
			};
		},
		reference: { params: {
			comb: 280,
			Tmax: 25
		} },
		bad: { params: {
			comb: 800,
			Tmax: 30
		} }
	},
	{
		id: "ponte-quatro-algarismos",
		title: "Ponte de Wheatstone: quatro algarismos",
		level: 2,
		sim: "ponte-wheatstone",
		scenario: "equilibrar",
		goal: "Meça a amostra D (cerca de 47 Ω) com erro abaixo de 0,05%: equilibre a ponte com o galvanômetro no modo fino (corrente abaixo de 1 µA).",
		hint: "Com $R_1 = R_2$, a década só dá dois algarismos. Mude a razão: $R_x = R_3\\,R_2/R_1$.",
		base: {
			modo: 0,
			rx: 3,
			E: 6
		},
		knobs: [
			"R1",
			"R2",
			"R3",
			"sens"
		],
		evaluate(p) {
			const Ig = run("ponte-wheatstone", p, {
				tMax: 0,
				state: (s) => s.map((v, i) => i === 3 ? 1 : v)
			}).value("Ig");
			const Rx = p.R3 * p.R2 / p.R1;
			const err = Rx / 47.83 - 1;
			const metrics = [{
				label: "Corrente no galvanômetro",
				value: Ig * 1e6,
				unit: "µA"
			}, {
				label: "Rx = R₃R₂/R₁",
				value: Rx,
				unit: "Ω",
				digits: 5
			}];
			if (Math.abs(Ig) > 1e-6) return fail(`A ponte não está equilibrada: passam ${fmt(Math.abs(Ig) * 1e6, 3)} µA pelo galvanômetro.`, metrics);
			return {
				ok: true,
				accuracy: closeness(err, 5e-4),
				economy: 1,
				metrics,
				message: `Ponte equilibrada: Rx = ${fmt(Rx, 5)} Ω.`
			};
		},
		reference: { params: {
			R1: 1e3,
			R2: 10,
			R3: 4783,
			sens: 1
		} },
		bad: { params: {
			R1: 1e3,
			R2: 1e3,
			R3: 48,
			sens: 1
		} }
	},
	{
		id: "radio-rlc",
		title: "Sintonize a rádio",
		level: 2,
		sim: "rlc-ca",
		scenario: "ressonancia",
		goal: `Com L = 10 mH, escolha C e R para sintonizar a estação de **${RADIO.f} Hz** (erro abaixo de 0,5%) e deixar a vizinha de ${RADIO.neighbor} Hz com no máximo 10% da corrente.`,
		hint: "$f_0 = 1/(2\\pi\\sqrt{LC})$ escolhe a estação; a resistência define a largura do pico: $Q = \\frac{1}{R}\\sqrt{L/C}$.",
		base: {
			topologia: 0,
			saida: 0,
			inicio: 1,
			Vp: 10,
			L: 10,
			Rg: 0,
			f: RADIO.f
		},
		knobs: ["C", "R"],
		explore: ["f", "grafico"],
		economyLabel: "Seletividade",
		evaluate(p) {
			const at = (f) => run("rlc-ca", {
				...p,
				f
			}, { tMax: 0 });
			const r = at(RADIO.f);
			const f0 = r.value("f0");
			const I1 = r.value("Ip");
			const ratio = at(RADIO.neighbor).value("Ip") / I1;
			const err = f0 / RADIO.f - 1;
			const metrics = [{
				label: "Frequência de ressonância",
				value: f0,
				unit: "Hz",
				digits: 5
			}, {
				label: "Corrente na vizinha / na estação",
				value: 100 * ratio,
				unit: "%"
			}];
			if (Math.abs(err) > .05) return fail(`O circuito ressoa em ${fmt(f0, 4)} Hz, longe da estação.`, metrics);
			if (ratio > .5) return fail(`Sintonizado, mas a vizinha passa com ${fmt(100 * ratio, 3)}% da corrente: o pico está largo demais.`, metrics);
			return {
				ok: true,
				accuracy: closeness(err, .005),
				economy: closeness(ratio, .1),
				metrics,
				message: `Ressonância em ${fmt(f0, 5)} Hz; vizinha com ${fmt(100 * ratio, 3)}%.`
			};
		},
		reference: { params: {
			C: .633,
			R: 3
		} },
		bad: { params: {
			C: 1,
			R: 20
		} }
	},
	{
		id: "loop-sem-cair",
		title: "Loop sem cair",
		level: 2,
		sim: "montanha-russa",
		scenario: "loop",
		goal: "Solte o carrinho da **menor altura** que ainda o faça completar o loop com a pista sempre empurrando ($N \\ge 0$), com um pouco de atrito ($\\mu = 0{,}02$).",
		hint: "Sem atrito, no alto do loop $v^2 \\ge gR$ exige $h_0 \\ge h_{fundo} + 2{,}5R$. O atrito pede um pouco mais.",
		base: {
			pista: 1,
			v0: 0,
			mu: .02,
			m: 60,
			g: 9.81
		},
		knobs: ["h0"],
		economyLabel: "Altura mínima",
		evaluate(p) {
			const r = rideLoop(p);
			const hmin = loopMinHeight(p);
			const metrics = [{
				label: "Altura de partida",
				value: p.h0,
				unit: "m"
			}, {
				label: "Menor normal no loop",
				value: Number.isFinite(r.minN) ? r.minN : 0,
				unit: "N"
			}];
			if (!r.passed) return fail("O carrinho não completou o loop.", metrics);
			if (r.minN < 0) return fail(`No alto do loop a normal ficou negativa (${fmt(r.minN, 3)} N): o carrinho cairia.`, metrics);
			return {
				ok: true,
				accuracy: 1,
				economy: closeness((p.h0 - hmin) / hmin, .03),
				metrics,
				message: `Completou o loop saindo de ${fmt(p.h0, 3)} m.`
			};
		},
		reference: { params: { h0: 5.1 } },
		bad: { params: { h0: 7.5 } }
	},
	{
		id: "circuito-economico",
		title: "Quatro lâmpadas, pouca potência",
		level: 2,
		sim: "circuitos-dc",
		scenario: "livre",
		goal: `Monte um circuito que acenda as **${LAMPS.n} lâmpadas** de ${LAMPS.R} Ω com pelo menos **${fmt(LAMPS.Pmin, 2)} W cada** gastando a **menor potência** possível das baterias.`,
		hint: "A lâmpada precisa de $V \\ge \\sqrt{P R}$. Em paralelo todas recebem a tensão da bateria; em série dividem. Escolha a ligação e a menor bateria que dê conta (selecione a bateria e use Valor −).",
		base: {
			montagem: 0,
			rInterna: .1
		},
		knobs: [],
		economyLabel: "Economia de energia",
		build: {
			what: "monte o circuito na bancada",
			capture: captureCircuit
		},
		evaluate: (p, b) => circuit(p, b, circuitRef(4.5)),
		reference: {
			params: {},
			build: circuitRef(4.5)
		},
		bad: {
			params: {},
			build: [
				{
					kind: "bateria",
					a: [2, 5],
					b: [2, 3],
					value: 24
				},
				{
					kind: "fio",
					a: [2, 5],
					b: [2, 6],
					value: 0
				},
				...[
					2,
					4,
					6,
					8
				].map((x) => ({
					kind: "lampada",
					a: [x, 6],
					b: [x + 2, 6],
					value: LAMPS.R
				})),
				{
					kind: "fio",
					a: [10, 6],
					b: [10, 3],
					value: 0
				},
				{
					kind: "fio",
					a: [10, 3],
					b: [2, 3],
					value: 0
				}
			]
		}
	},
	{
		id: "millikan-gota-parada",
		title: "Segure uma gota de carga e",
		level: 2,
		sim: "millikan",
		scenario: "equilibrio",
		goal: `Clique na luneta numa gota que tenha **uma única carga elementar** e que esteja entre as linhas do retículo, e ajuste a tensão para ela ficar **${DROP_HOLD} s parada** ali (velocidade abaixo de 1% da queda livre).`,
		hint: "No equilíbrio $qV/d = m'g$. Para a mesma gota, a tensão de equilíbrio cai pela metade se a carga dobra: compare $V_{eq}$ com o raio (a velocidade de queda) de cada gota.",
		base: {
			metodo: 1,
			campo: 1,
			semente: 7,
			T: 23,
			cunningham: 1,
			luneta: 1
		},
		knobs: ["V"],
		explore: ["luneta"],
		build: {
			what: "selecione a gota",
			capture: captureDrop
		},
		evaluate: holdDrop,
		reference: {
			params: { V: 315 },
			build: { gota: 6 }
		},
		bad: {
			params: { V: 330 },
			build: { gota: 6 }
		}
	},
	{
		id: "telescopio-20x",
		title: "Monte um telescópio de 20×",
		level: 2,
		sim: "lentes",
		scenario: "telescopio",
		goal: "Monte um telescópio kepleriano com **aumento angular de 20×** (±3%) e imagem final que o olho veja relaxado. Selecione uma lente e use os botões de f mais curta/longa; arraste as lentes pelo eixo.",
		hint: "$M = -f_{ob}/f_{oc}$ e, para a imagem ir ao infinito, a distância entre as lentes é $f_{ob} + f_{oc}$.",
		base: {
			montagem: 4,
			alfa: 1
		},
		knobs: [],
		explore: ["alfa"],
		build: {
			what: "arranje as lentes",
			capture: captureOptics
		},
		evaluate: (p, b) => instrument(p, b, true, 20, .03, "telescópio"),
		reference: {
			params: {},
			build: {
				els: [{
					id: 1,
					kind: "fina",
					x: 0,
					P: 2
				}, {
					id: 2,
					kind: "fina",
					x: .5256,
					P: 39.0625
				}],
				ox: -.1,
				oh: .01
			}
		},
		bad: {
			params: {},
			build: {
				els: [{
					id: 1,
					kind: "fina",
					x: 0,
					P: 2
				}, {
					id: 2,
					kind: "fina",
					x: .55,
					P: 20
				}],
				ox: -.1,
				oh: .01
			}
		}
	},
	{
		id: "barreira-com-arrasto",
		title: "Por cima da barreira",
		level: 3,
		sim: "projetil-arrasto",
		scenario: "futebol",
		goal: `Há uma barreira de ${WALL.h} m de altura a ${WALL.x} m. Faça a bola passar por cima e cair a **${WALL_TARGET} m** (±0,5 m) com a **menor velocidade** de chute possível.`,
		hint: "Varra o ângulo: para cada um existe uma velocidade mínima. Ângulos altos passam a barreira, mas o arrasto cobra caro no tempo de voo.",
		base: {
			h0: 0,
			massa: .43,
			diametro: .22,
			cd: .25,
			rho: 1.225,
			g: 9.81
		},
		knobs: ["v0", "angulo"],
		economyLabel: "Economia de velocidade",
		evaluate(p) {
			const s = clearsWall(p);
			const vmin = 25;
			const err = s.x - WALL_TARGET;
			const metrics = [
				{
					label: `Altura em x = ${WALL.x} m`,
					value: s.yAt,
					unit: "m"
				},
				{
					label: "Alcance",
					value: s.x,
					unit: "m"
				},
				{
					label: "Velocidade de chute",
					value: p.v0,
					unit: "m/s"
				}
			];
			if (!s.clears) return fail(Number.isNaN(s.yAt) ? "A bola nem chegou à barreira." : `A bola bateu na barreira (passou a ${fmt(s.yAt, 3)} m de altura).`, metrics);
			if (Math.abs(err) > 3) return fail(`Passou a barreira, mas caiu a ${fmt(s.x, 3)} m.`, metrics);
			return {
				ok: true,
				accuracy: closeness(err, .5),
				economy: closeness((p.v0 - vmin) / vmin, .02),
				metrics,
				message: `Passou a barreira e caiu a ${fmt(s.x, 3)} m com v₀ = ${fmt(p.v0, 3)} m/s.`
			};
		},
		reference: { params: {
			v0: 25,
			angulo: 41.5
		} },
		bad: { params: {
			v0: 40,
			angulo: 60
		} }
	},
	{
		id: "hoquei-parede",
		title: "Hóquei elétrico: contorne a parede",
		level: 3,
		sim: "jogos-fisica",
		scenario: "hoquei",
		goal: "Na fase 2 há uma parede entre o disco e o gol, aberta só embaixo. Faça o gol usando **no máximo duas cargas**.",
		hint: "Cargas negativas atraem o disco positivo: uma perto da abertura da parede puxa o disco para baixo dela.",
		base: {
			jogo: 0,
			nivel: 1,
			Qdisco: 20,
			campo: 1,
			exemplo: 0
		},
		knobs: ["qPeca"],
		economyLabel: "Economia de cargas",
		build: {
			what: "posicione as cargas no campo",
			capture: captureCargas
		},
		evaluate: (p, b) => hockey(p, b, 2),
		reference: {
			params: { qPeca: 50 },
			build: [{
				x: .917,
				y: .047,
				q: -50
			}, {
				x: .881,
				y: .253,
				q: -50
			}]
		},
		bad: {
			params: { qPeca: 50 },
			build: [{
				x: .05,
				y: .5,
				q: 50
			}]
		}
	},
	{
		id: "braquistocrona",
		title: "Desenhe a curva mais rápida",
		level: 3,
		sim: "braquistocrona",
		scenario: "corrida",
		goal: "Desenhe com o mouse (ou o dedo) um arame de A até B em que a conta chegue **no máximo 1% mais devagar que a cicloide**, a curva mais rápida.",
		hint: "A curva ideal desce íngreme no começo para ganhar velocidade cedo, e pode até passar abaixo de B antes de subir até ele.",
		base: {
			modo: 0,
			X: 3,
			Y: 1.5,
			mu: 0,
			g: 9.8
		},
		knobs: [],
		build: {
			what: "desenhe sua curva de A até B",
			capture(state) {
				const d = state?.drawn;
				if (!Array.isArray(d) || d.length < 3 || d.length > 5e3) return void 0;
				return d.every((q) => Array.isArray(q) && finite(q[0]) && finite(q[1])) ? d.map((q) => [q[0], q[1]]) : void 0;
			}
		},
		evaluate(p, drawn) {
			if (!drawn || drawn.length < 3) return fail("Desenhe sua curva de A até B.");
			const B = [p.X, -p.Y];
			const a = drawn[0];
			const z = drawn[drawn.length - 1];
			if (Math.hypot(a[0], a[1]) > .06 || Math.hypot(z[0] - B[0], z[1] - B[1]) > .06) return fail("A curva precisa ligar A ao ponto B original (não mova B).");
			const gid = 1e6 + drawn.length + Math.round(Math.abs(drawn.reduce((acc, q, i) => acc + (i + 1) * (q[0] * 7.1 + q[1] * 3.3), 0)) * 1e3) % 1e6;
			const r = run("braquistocrona", p, {
				tMax: 30,
				state: (s, q) => {
					const st = {
						...s,
						drawn,
						gid,
						tt: 0
					};
					return {
						...st,
						beads: curvesOf(st, q).map((c, i) => ({
							c: i,
							s: 0,
							v: 0,
							goal: c.total,
							arr: -1,
							stuck: false
						}))
					};
				}
			});
			const bead = r.state.beads[4];
			const tc = r.value("t1");
			const tl = r.value("t0");
			const t = bead && bead.arr >= 0 ? bead.arr : Infinity;
			const metrics = [
				{
					label: "Tempo na sua curva",
					value: t,
					unit: "s",
					digits: 4
				},
				{
					label: "Tempo na cicloide",
					value: tc,
					unit: "s",
					digits: 4
				},
				{
					label: "Tempo na reta",
					value: tl,
					unit: "s",
					digits: 4
				}
			];
			if (!Number.isFinite(t)) return fail("A conta não chegou a B pela sua curva (ela sobe acima de A ou para no caminho).", metrics);
			if (t >= tl * .999) return fail("Sua curva não é mais rápida que a reta.", metrics);
			return {
				ok: true,
				accuracy: closeness(t / tc - 1, .01),
				economy: 1,
				metrics,
				message: `Sua curva: ${fmt(t, 4)} s; cicloide: ${fmt(tc, 4)} s.`
			};
		},
		reference: {
			params: {},
			build: cycloidPoints(3, 1.5)
		},
		bad: {
			params: {},
			build: Array.from({ length: 401 }, (_, i) => [3 * i / 400, -1.5 * i / 400])
		}
	},
	{
		id: "microscopio-250x",
		title: "Monte um microscópio de 250×",
		level: 3,
		sim: "lentes",
		scenario: "microscopio",
		goal: "Ajuste o microscópio composto para **250×** (±2%) com imagem final no infinito ou além de 25 cm. Você pode trocar as focais, mover as lentes e o objeto.",
		hint: "$M \\approx -\\frac{L}{f_{ob}}\\cdot\\frac{25\\,\\text{cm}}{f_{oc}}$: aumente o tubo ou encurte a ocular, e reposicione o objeto para focalizar.",
		base: { montagem: 3 },
		knobs: [],
		build: {
			what: "arranje as lentes e o objeto",
			capture: captureOptics
		},
		evaluate: (p, b) => instrument(p, b, false, 250, .02, "microscópio"),
		reference: {
			params: {},
			build: {
				els: [{
					id: 1,
					kind: "fina",
					x: 0,
					P: 100
				}, {
					id: 2,
					kind: "fina",
					x: .23,
					P: 50
				}],
				ox: -1 / (100 - 1 / .21),
				oh: .0015
			}
		},
		bad: {
			params: {},
			build: {
				els: [{
					id: 1,
					kind: "fina",
					x: 0,
					P: 100
				}, {
					id: 2,
					kind: "fina",
					x: .195,
					P: 40
				}],
				ox: -1 / (100 - 1 / .17),
				oh: .0015
			}
		}
	},
	{
		id: "foguete-orbital",
		title: "Foguete orbital mais leve",
		level: 3,
		sim: "foguete",
		scenario: "espaco",
		goal: `Leve 500 kg de carga útil a **${fmt(ROCKET_V, 4)} m/s** (no espaço, sem gravidade nem ar) com a **menor massa de lançamento** possível. Escolha o número de estágios, a massa do 1º e a razão entre estágios.`,
		hint: "Com 10% de estrutura e $v_e = 3000$ m/s, um estágio só nunca passa de $v_e \\ln 10 \\approx 6{,}9$ km/s. Estágios descartam peso morto.",
		base: {
			grav: 0,
			arrasto: 0,
			eps: .1,
			ve: 3e3,
			tb: 60,
			mpl: 500
		},
		knobs: [
			"n",
			"M1",
			"r"
		],
		economyLabel: "Economia de massa",
		evaluate(p) {
			const v = run("foguete", p, { tMax: 400 }).value("v");
			const M0 = ignitionMasses(p)[0];
			const Mmin = rocketMinMass(p);
			const metrics = [{
				label: "Velocidade final",
				value: v,
				unit: "m/s"
			}, {
				label: "Massa de lançamento",
				value: M0,
				unit: "kg"
			}];
			if (v < ROCKET_V) return fail(`O foguete chegou a ${fmt(v, 4)} m/s; faltaram ${fmt(ROCKET_V - v, 3)} m/s.`, metrics);
			return {
				ok: true,
				accuracy: 1,
				economy: closeness((M0 - Mmin) / Mmin, .05),
				metrics,
				message: `Chegou a ${fmt(v, 4)} m/s com ${fmt(M0 / 1e3, 3)} t na plataforma.`
			};
		},
		reference: { params: {
			n: 3,
			M1: 6500,
			r: .45
		} },
		bad: { params: {
			n: 3,
			M1: 1e5,
			r: .5
		} }
	}
];
var findChallenge = (id) => challenges.find((c) => c.id === id);
//#endregion
//#region apps/web/src/challenge-server.ts
var UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
/** Limite do tamanho da montagem (a curva desenhada mais longa tem 5000 pontos). */
var MAX_BUILD_BYTES = 2e5;
var err = (status, error) => ({
	status,
	body: { error }
});
/** Valida a tentativa; devolve a mensagem de erro (e o status) ou a tentativa limpa. */
function parseAttempt(body) {
	if (!body || typeof body !== "object") return { error: err(400, "requisição inválida") };
	const b = body;
	if (typeof b.desafio !== "string" || !/^[a-z0-9-]{1,64}$/.test(b.desafio)) return { error: err(400, "desafio inválido") };
	const ch = findChallenge(b.desafio);
	if (!ch) return { error: err(404, "desafio não encontrado") };
	if (typeof b.turma !== "string" || !UUID.test(b.turma)) return { error: err(400, "turma inválida") };
	if (!b.params || typeof b.params !== "object" || Array.isArray(b.params)) return { error: err(400, "parâmetros inválidos") };
	const sim = challengeSim(ch.sim);
	const params = {};
	for (const [k, v] of Object.entries(b.params)) {
		if (!ch.knobs.includes(k)) return { error: err(422, `o parâmetro ${k} não é liberado neste desafio`) };
		const spec = sim.params.find((p) => p.key === k);
		if (typeof v !== "number" || !Number.isFinite(v) || v < spec.min || v > spec.max) return { error: err(422, `parâmetro fora da faixa: ${k}`) };
		params[k] = v;
	}
	if (ch.build) {
		if (b.build === void 0 || b.build === null) return { error: err(422, "falta a montagem no palco") };
		if (JSON.stringify(b.build).length > 2e5) return { error: err(413, "montagem grande demais") };
	}
	const tentativas = b.tentativas;
	const tempo = b.tempo_s;
	if (typeof tentativas !== "number" || !Number.isInteger(tentativas) || tentativas < 1 || tentativas > 1e5) return { error: err(400, "número de tentativas inválido") };
	if (typeof tempo !== "number" || !Number.isFinite(tempo) || tempo < 0 || tempo > 1e7) return { error: err(400, "tempo inválido") };
	const nome = typeof b.nome === "string" ? b.nome.slice(0, 60) : "";
	return { req: {
		turma: b.turma.toLowerCase(),
		nome,
		desafio: ch.id,
		params,
		build: ch.build ? b.build : void 0,
		tentativas,
		tempo_s: tempo
	} };
}
/**
* Trata uma tentativa: confere o usuário e a matrícula, refaz a avaliação e grava a pontuação.
* O número de tentativas usado na conta é o maior entre o informado e o que o servidor já viu.
*/
async function handleAttempt(body, token, deps) {
	const parsed = parseAttempt(body);
	if ("error" in parsed) return parsed.error;
	const { req } = parsed;
	const aluno = token ? await deps.userFromToken(token) : null;
	if (!aluno) return err(401, "entre com seu e-mail para pontuar na turma");
	if (!await deps.isEnrolled(req.turma, aluno)) return err(403, "você não está matriculado nesta turma");
	const ch = findChallenge(req.desafio);
	const outcome = evaluateChallenge(ch, {
		params: req.params,
		build: req.build
	});
	const tentativas = Math.max(req.tentativas, await deps.priorAttempts(req.turma, aluno, ch.id) + 1);
	const estrelas = stars(outcome);
	const pontos = points(ch.level, outcome, tentativas, req.tempo_s);
	await deps.save({
		turma: req.turma,
		aluno,
		nome: req.nome ?? "",
		desafio: ch.id,
		pontos,
		estrelas,
		tentativas,
		tempo_s: Math.round(req.tempo_s)
	});
	return {
		status: 200,
		body: {
			ok: outcome.ok,
			pontos,
			estrelas,
			tentativas,
			mensagem: outcome.message
		}
	};
}
//#endregion
export { MAX_BUILD_BYTES, handleAttempt, parseAttempt };
