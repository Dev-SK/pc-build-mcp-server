import { Limiter } from './limiter';

describe('Limiter', () => {
  it('runs a task and returns the result', async () => {
    const limiter = new Limiter(2);
    const result = await limiter.run(() => Promise.resolve(42));
    expect(result).toBe(42);
  });

  it('propagates rejection', async () => {
    const limiter = new Limiter(2);
    await expect(
      limiter.run(() => Promise.reject(new Error('fail'))),
    ).rejects.toThrow('fail');
  });

  it('limits concurrency to specified max', async () => {
    const limiter = new Limiter(2);
    let running = 0;
    let maxConcurrent = 0;

    const task = () =>
      new Promise<void>((resolve) => {
        running++;
        maxConcurrent = Math.max(maxConcurrent, running);
        setTimeout(() => {
          running--;
          resolve();
        }, 20);
      });

    await Promise.all(Array.from({ length: 6 }, () => limiter.run(task)));

    expect(maxConcurrent).toBeLessThanOrEqual(2);
  });
});
