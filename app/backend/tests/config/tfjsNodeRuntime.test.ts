const runWithLinuxNativeBinding = process.platform === 'linux' ? it : it.skip;

runWithLinuxNativeBinding(
  'should execute the patched TensorFlow TopK kernel on Node 24',
  async () => {
    const tf = await import('@tensorflow/tfjs-node');
    const input = tf.tensor1d([1, 3, 2]);
    const result = tf.topk(input, 1);

    try {
      await expect(result.values.array()).resolves.toEqual([3]);
      await expect(result.indices.array()).resolves.toEqual([1]);
    } finally {
      input.dispose();
      result.values.dispose();
      result.indices.dispose();
    }
  },
);
