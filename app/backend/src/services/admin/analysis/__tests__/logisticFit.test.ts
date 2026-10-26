import { cholesky, choleskySolve, combinationVariance, evaluate, fitLogistic, sigmoid, type DesignMatrix } from '../logisticFit';

/** Deterministic PRNG for synthetic data. */
function random(seed: number): () => number {
  let t = seed >>> 0;
  return () => {
    t = (t + 0x6d2b79f5) >>> 0;
    let r = Math.imul(t ^ (t >>> 15), 1 | t);
    r = (r + Math.imul(r ^ (r >>> 7), 61 | r)) ^ r;
    return ((r ^ (r >>> 14)) >>> 0) / 4294967296;
  };
}

function synthetic(beta: number[], rows: number, seed: number, copiesPerCluster = 1): DesignMatrix {
  const d = beta.length;
  const next = random(seed);
  const n = rows * copiesPerCluster;
  const m: DesignMatrix = {
    rows: n,
    features: d,
    x: new Float64Array(n * d),
    y: new Float64Array(n),
    w: new Float64Array(n).fill(1),
    cluster: new Int32Array(n),
  };
  for (let i = 0; i < rows; i++) {
    const x = Array.from({ length: d }, () => next() * 2 - 1);
    const p = sigmoid(x.reduce((s, v, j) => s + v * beta[j], 0));
    const y = next() < p ? 1 : 0;
    for (let c = 0; c < copiesPerCluster; c++) {
      const r = i * copiesPerCluster + c;
      x.forEach((v, j) => { m.x[r * d + j] = v; });
      m.y[r] = y;
      m.cluster[r] = i + 1;
    }
  }
  return m;
}

const se = (cov: Float64Array, d: number, j: number): number => Math.sqrt(cov[j * d + j]);

describe('logisticFit', () => {
  it('solves symmetric positive-definite systems', () => {
    const a = new Float64Array([4, 2, 2, 3]);
    const l = cholesky(a, 2);
    expect(l).not.toBeNull();
    const x = choleskySolve(l as Float64Array, 2, new Float64Array([2, 1]));
    expect(4 * x[0] + 2 * x[1]).toBeCloseTo(2, 10);
    expect(2 * x[0] + 3 * x[1]).toBeCloseTo(1, 10);
    expect(cholesky(new Float64Array([1, 2, 2, 1]), 2)).toBeNull();
  });

  it('recovers known coefficients within their standard errors', async () => {
    const beta = [1.2, -2, 0.5];
    const m = synthetic(beta, 20_000, 7);
    const fit = await fitLogistic(m, { penalised: [false, false, false] });
    expect(fit).not.toBeNull();
    const f = fit!;
    expect(f.converged).toBe(true);
    beta.forEach((b, j) => {
      expect(Math.abs(f.beta[j] - b)).toBeLessThan(4 * se(f.covariance, 3, j));
      expect(se(f.covariance, 3, j)).toBeLessThan(0.1);
    });
    expect(f.clusters).toBe(20_000);
  });

  it('does not shrink standard errors when a cluster repeats the same evidence', async () => {
    const beta = [0.8, -0.6];
    const single = await fitLogistic(synthetic(beta, 5_000, 11), { penalised: [false, false] });
    const repeated = await fitLogistic(synthetic(beta, 5_000, 11, 4), { penalised: [false, false] });
    expect(single && repeated).toBeTruthy();
    for (let j = 0; j < 2; j++) {
      expect(repeated!.beta[j]).toBeCloseTo(single!.beta[j], 6);
      const ratio = se(repeated!.covariance, 2, j) / se(single!.covariance, 2, j);
      expect(ratio).toBeGreaterThan(0.95);
      expect(ratio).toBeLessThan(1.05);
    }
  });

  it('identifies a sum-to-zero block through the ridge penalty', async () => {
    // Features 1..3 always sum to zero (like share differences); only contrasts are identified.
    const next = random(3);
    const n = 8_000;
    const m: DesignMatrix = { rows: n, features: 4, x: new Float64Array(n * 4), y: new Float64Array(n), w: new Float64Array(n).fill(1), cluster: new Int32Array(n) };
    const truth = [0.5, 3, -1, -2];
    for (let i = 0; i < n; i++) {
      const a = next() - 0.5;
      const b = next() - 0.5;
      const row = [next() - 0.5, a, b, -a - b];
      row.forEach((v, j) => { m.x[i * 4 + j] = v; });
      m.y[i] = next() < sigmoid(row.reduce((s, v, j) => s + v * truth[j], 0)) ? 1 : 0;
      m.cluster[i] = i;
    }
    const fit = await fitLogistic(m, { penalised: [false, true, true, true] });
    expect(fit).not.toBeNull();
    // Truth is already centred (3 − 1 − 2 = 0), so the minimum-norm solution should match it.
    expect(fit!.beta[1] + fit!.beta[2] + fit!.beta[3]).toBeCloseTo(0, 3);
    const contrast = new Float64Array([0, 1, -0.5, -0.5]);
    const value = fit!.beta[1] - 0.5 * fit!.beta[2] - 0.5 * fit!.beta[3];
    const spread = Math.sqrt(combinationVariance(fit!.covariance, 4, contrast));
    expect(Math.abs(value - 4.5)).toBeLessThan(4 * spread);
  });

  it('scores held-out rows better than a coin flip when there is signal', async () => {
    const beta = [2, -1];
    const fit = await fitLogistic(synthetic(beta, 6_000, 21), { penalised: [false, false] });
    const scored = await evaluate(synthetic(beta, 3_000, 22), fit!.beta);
    expect(scored.logLoss).toBeLessThan(Math.LN2);
    expect(scored.accuracy).toBeGreaterThan(0.6);
  });

  it('returns null without rows', async () => {
    const empty: DesignMatrix = { rows: 0, features: 2, x: new Float64Array(0), y: new Float64Array(0), w: new Float64Array(0), cluster: new Int32Array(0) };
    await expect(fitLogistic(empty, { penalised: [false, false] })).resolves.toBeNull();
  });
});
