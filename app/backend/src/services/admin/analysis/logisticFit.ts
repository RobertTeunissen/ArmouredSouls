/**
 * Weighted logistic regression without intercept, with a small ridge penalty
 * on chosen features, fitted by Newton's method. Standard errors are
 * cluster-robust (sandwich, clustered by battle), because the pairs of one
 * King of the Hill or Grand Melee battle are not independent.
 *
 * Pure TypeScript, no dependency. The fit is async and yields to the event
 * loop between row chunks so a large analysis never blocks the API server for
 * long.
 */

/** Rows in a flat design matrix: row i is `x[i*d .. i*d+d)`. Rows of one cluster must be contiguous. */
export interface DesignMatrix {
  rows: number;
  features: number;
  x: Float64Array;
  /** 1 = side A won, 0 = side B won. */
  y: Float64Array;
  /** Comparison weight (KotH/GM pairs share their battle's weight). */
  w: Float64Array;
  /** Cluster id (battle id) per row. */
  cluster: Int32Array;
}

export interface FitOptions {
  /** Features that get the ridge penalty (true = penalised). */
  penalised: readonly boolean[];
  /** Penalty relative to the average curvature of the penalised features. */
  ridge?: number;
  maxIterations?: number;
}

export interface FitResult {
  beta: Float64Array;
  /** Cluster-robust covariance, d×d row-major. */
  covariance: Float64Array;
  converged: boolean;
  iterations: number;
  /** Weighted mean log-loss on the fitted rows. */
  logLoss: number;
  clusters: number;
}

const CHUNK = 20_000;
const yieldToEventLoop = (): Promise<void> => new Promise((resolve) => setImmediate(resolve));

export function sigmoid(z: number): number {
  if (z >= 0) return 1 / (1 + Math.exp(-z));
  const e = Math.exp(z);
  return e / (1 + e);
}

function dot(x: Float64Array, offset: number, beta: Float64Array): number {
  let s = 0;
  for (let j = 0; j < beta.length; j++) s += x[offset + j] * beta[j];
  return s;
}

/** Cholesky factor L (lower, row-major) of a symmetric positive-definite matrix, or null. */
export function cholesky(a: Float64Array, d: number): Float64Array | null {
  const l = new Float64Array(d * d);
  for (let i = 0; i < d; i++) {
    for (let j = 0; j <= i; j++) {
      let s = a[i * d + j];
      for (let k = 0; k < j; k++) s -= l[i * d + k] * l[j * d + k];
      if (i === j) {
        if (!(s > 0)) return null;
        l[i * d + i] = Math.sqrt(s);
      } else {
        l[i * d + j] = s / l[j * d + j];
      }
    }
  }
  return l;
}

/** Solve A x = b with A = L Lᵀ. */
export function choleskySolve(l: Float64Array, d: number, b: Float64Array): Float64Array {
  const z = new Float64Array(d);
  for (let i = 0; i < d; i++) {
    let s = b[i];
    for (let k = 0; k < i; k++) s -= l[i * d + k] * z[k];
    z[i] = s / l[i * d + i];
  }
  const x = new Float64Array(d);
  for (let i = d - 1; i >= 0; i--) {
    let s = z[i];
    for (let k = i + 1; k < d; k++) s -= l[k * d + i] * x[k];
    x[i] = s / l[i * d + i];
  }
  return x;
}

function inverseFromCholesky(l: Float64Array, d: number): Float64Array {
  const inv = new Float64Array(d * d);
  const e = new Float64Array(d);
  for (let c = 0; c < d; c++) {
    e.fill(0);
    e[c] = 1;
    const col = choleskySolve(l, d, e);
    for (let r = 0; r < d; r++) inv[r * d + c] = col[r];
  }
  return inv;
}

function ridgeDiagonal(m: DesignMatrix, options: FitOptions): Float64Array {
  const { rows, features: d, x, w } = m;
  const curvature = new Float64Array(d);
  for (let i = 0; i < rows; i++) {
    const o = i * d;
    for (let j = 0; j < d; j++) curvature[j] += 0.25 * w[i] * x[o + j] * x[o + j];
  }
  let sum = 0;
  let count = 0;
  for (let j = 0; j < d; j++) {
    if (options.penalised[j]) {
      sum += curvature[j];
      count++;
    }
  }
  const lambda = (options.ridge ?? 1e-3) * (count > 0 ? sum / count : 0) + 1e-9;
  const diag = new Float64Array(d);
  for (let j = 0; j < d; j++) diag[j] = options.penalised[j] ? lambda : 1e-9;
  return diag;
}

/** Gradient and Hessian of the penalised log-likelihood at `beta`. */
async function derivatives(
  m: DesignMatrix,
  beta: Float64Array,
  lambda: Float64Array,
): Promise<{ gradient: Float64Array; hessian: Float64Array; logLoss: number }> {
  const { rows, features: d, x, y, w } = m;
  const gradient = new Float64Array(d);
  const hessian = new Float64Array(d * d);
  let loss = 0;
  let weight = 0;
  for (let i = 0; i < rows; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const o = i * d;
    const p = sigmoid(dot(x, o, beta));
    const wi = w[i];
    const r = wi * (y[i] - p);
    const v = wi * p * (1 - p);
    for (let j = 0; j < d; j++) {
      const xj = x[o + j];
      gradient[j] += r * xj;
      const vx = v * xj;
      for (let k = 0; k <= j; k++) hessian[j * d + k] += vx * x[o + k];
    }
    const pc = Math.min(Math.max(p, 1e-12), 1 - 1e-12);
    loss -= wi * (y[i] * Math.log(pc) + (1 - y[i]) * Math.log(1 - pc));
    weight += wi;
  }
  for (let j = 0; j < d; j++) {
    gradient[j] -= lambda[j] * beta[j];
    hessian[j * d + j] += lambda[j];
    for (let k = 0; k < j; k++) hessian[k * d + j] = hessian[j * d + k];
  }
  return { gradient, hessian, logLoss: weight > 0 ? loss / weight : 0 };
}

/** Sandwich meat Σ_c s_c s_cᵀ with s_c the cluster's score sum, times G/(G−1). */
async function clusterMeat(m: DesignMatrix, beta: Float64Array): Promise<{ meat: Float64Array; clusters: number }> {
  const { rows, features: d, x, y, w, cluster } = m;
  const meat = new Float64Array(d * d);
  const score = new Float64Array(d);
  let clusters = 0;
  const flush = (): void => {
    for (let j = 0; j < d; j++) {
      const sj = score[j];
      if (sj === 0) continue;
      for (let k = 0; k < d; k++) meat[j * d + k] += sj * score[k];
    }
    score.fill(0);
    clusters++;
  };
  for (let i = 0; i < rows; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    if (i > 0 && cluster[i] !== cluster[i - 1]) flush();
    const o = i * d;
    const r = w[i] * (y[i] - sigmoid(dot(x, o, beta)));
    for (let j = 0; j < d; j++) score[j] += r * x[o + j];
  }
  if (rows > 0) flush();
  const correction = clusters > 1 ? clusters / (clusters - 1) : 1;
  for (let i = 0; i < meat.length; i++) meat[i] *= correction;
  return { meat, clusters };
}

function multiply(a: Float64Array, b: Float64Array, d: number): Float64Array {
  const out = new Float64Array(d * d);
  for (let i = 0; i < d; i++) {
    for (let k = 0; k < d; k++) {
      const aik = a[i * d + k];
      if (aik === 0) continue;
      for (let j = 0; j < d; j++) out[i * d + j] += aik * b[k * d + j];
    }
  }
  return out;
}

/** Fit; null when there are no rows or the system is singular. */
export async function fitLogistic(m: DesignMatrix, options: FitOptions): Promise<FitResult | null> {
  const d = m.features;
  if (m.rows === 0) return null;
  const lambda = ridgeDiagonal(m, options);
  let beta = new Float64Array(d);
  let converged = false;
  let iterations = 0;
  let last = await derivatives(m, beta, lambda);
  const maxIterations = options.maxIterations ?? 25;
  while (iterations < maxIterations) {
    iterations++;
    const l = cholesky(last.hessian, d);
    if (!l) return null;
    const step = choleskySolve(l, d, last.gradient);
    let biggest = 0;
    const next = new Float64Array(d);
    for (let j = 0; j < d; j++) {
      next[j] = beta[j] + step[j];
      biggest = Math.max(biggest, Math.abs(step[j]));
    }
    beta = next;
    last = await derivatives(m, beta, lambda);
    if (biggest < 1e-7) {
      converged = true;
      break;
    }
  }
  const l = cholesky(last.hessian, d);
  if (!l) return null;
  const bread = inverseFromCholesky(l, d);
  const { meat, clusters } = await clusterMeat(m, beta);
  const covariance = multiply(multiply(bread, meat, d), bread, d);
  return { beta, covariance, converged, iterations, logLoss: last.logLoss, clusters };
}

/** Weighted log-loss and accuracy of a fitted model on other rows. */
export async function evaluate(m: DesignMatrix, beta: Float64Array): Promise<{ logLoss: number; accuracy: number }> {
  const { rows, features: d, x, y, w } = m;
  let loss = 0;
  let correct = 0;
  let weight = 0;
  for (let i = 0; i < rows; i++) {
    if (i > 0 && i % CHUNK === 0) await yieldToEventLoop();
    const p = Math.min(Math.max(sigmoid(dot(x, i * d, beta)), 1e-12), 1 - 1e-12);
    loss -= w[i] * (y[i] * Math.log(p) + (1 - y[i]) * Math.log(1 - p));
    if ((p > 0.5 ? 1 : 0) === y[i]) correct += w[i];
    else if (p === 0.5) correct += w[i] / 2;
    weight += w[i];
  }
  return weight > 0 ? { logLoss: loss / weight, accuracy: correct / weight } : { logLoss: Math.LN2, accuracy: 0.5 };
}

/**
 * Variance of a linear combination cᵀβ.
 */
export function combinationVariance(covariance: Float64Array, d: number, c: Float64Array): number {
  let v = 0;
  for (let i = 0; i < d; i++) {
    if (c[i] === 0) continue;
    for (let j = 0; j < d; j++) v += c[i] * covariance[i * d + j] * c[j];
  }
  return Math.max(v, 0);
}
