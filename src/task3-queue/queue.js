class JobQueue {
  constructor(concurrency = 3) {
    this.concurrency = concurrency;
    this.running = 0;
    this.pending = [];
    this.idleWaiters = [];
  }

  // `job` is a function that returns a promise.
  // Returns a promise for the job's result (or its error).
  add(job) {
    return new Promise((resolve, reject) => {
      const task = { job, resolve, reject };

      if (this.running <= this.concurrency) {
        this._run(task);
      } else {
        this.pending.push(task);
      }
    });
  }

  // Resolves when all added jobs are finished.
  onIdle() {
    return new Promise((resolve) => {
      if (this.pending.length === 0) {
        resolve();
      } else {
        this.idleWaiters.push(resolve);
      }
    });
  }

  async _run(task) {
    this.running++;

    try {
      const result = await task.job();
      task.resolve(result);
    } catch (err) {
      task.reject(err);
      return;
    }

    this.running--;

    const next = this.pending.shift();
    if (next) {
      this._run(next);
    } else if (this.running === 0) {
      this.idleWaiters.forEach((resolve) => resolve());
      this.idleWaiters = [];
    }
  }
}

module.exports = JobQueue;
