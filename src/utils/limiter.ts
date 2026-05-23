/**
 * Lightweight concurrency limiter.
 * Limits the number of simultaneously-running async tasks to `concurrency`.
 */
export class Limiter {
  private readonly queue: Array<() => void> = [];
  private active = 0;

  constructor(private readonly concurrency: number) {}

  run<T>(task: () => Promise<T>): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const execute = () => {
        this.active++;
        task()
          .then(resolve)
          .catch(reject)
          .finally(() => {
            this.active--;
            if (this.queue.length > 0) {
              (this.queue.shift() as () => void)();
            }
          });
      };

      if (this.active < this.concurrency) {
        execute();
      } else {
        this.queue.push(execute);
      }
    });
  }
}
