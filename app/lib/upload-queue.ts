export function createQueue(concurrency: number) {
  const queue: Array<() => Promise<void>> = [];
  let running = 0;

  async function run(): Promise<void> {
    while (running < concurrency && queue.length > 0) {
      const task = queue.shift();
      if (task) {
        running++;
        try {
          await task();
        } finally {
          running--;
          void run();
        }
      }
    }
  }

  return {
    enqueue<T>(task: () => Promise<T>): Promise<T> {
      return new Promise<T>((resolve, reject) => {
        const taskWrapper = async (): Promise<void> => {
          try {
            resolve(await task());
          } catch (error) {
            reject(error);
          }
        };
        queue.push(taskWrapper);
        void run();
      });
    },
  };
}

export const uploadQueue = createQueue(2);
