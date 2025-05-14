var _Queue;
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
/* eslint-disable @typescript-eslint/no-empty-function */
import { AppState, NativeModules, Platform } from 'react-native';
import { FALSE, TRUE } from './models/Job';
import { Uuid } from './utils/Uuid';
import { CANCEL } from './Worker';
import EventEmitter from 'eventemitter3';

/**
 * Events emitted by the Queue.
 */

/**
 * Options to configure the queue
 */

/**
 * ## Usage
 *
 * ```typescript
 * import queue from 'react-native-job-queue'
 *
 * queue.configure({onQueueFinish:(executedJobs:Job[])=>{
 *      console.log("Queue stopped and executed",executedJobs)
 * }});
 * queue.addWorker(new Worker("testWorker",async(payload, id)=>{
 *      return new Promise((resolve) => {
 *      setTimeout(() => {
 *          console.log('Executing jobId', id, 'with:', payload.text);
 *          resolve();
 *      }, payload.delay);});
 * }))
 * queue.addJob("testWorker",{text:"Job example payload content text",delay:5000})
 * ```
 */
export class Queue extends EventEmitter {
  static get instance() {
    if (this.queueInstance) {
      return this.queueInstance;
    } else {
      this.queueInstance = new Queue();
      return this.queueInstance;
    }
  }
  /**
   * @returns true if the Queue is running and false otherwise
   */
  get isRunning() {
    return this.isActive;
  }
  /**
   * @returns the workers map (readonly)
   */
  get registeredWorkers() {
    return this.workers;
  }
  constructor() {
    super();
    _defineProperty(this, "emitter", new EventEmitter());
    _defineProperty(this, "jobStore", void 0);
    _defineProperty(this, "workers", void 0);
    _defineProperty(this, "isActive", void 0);
    _defineProperty(this, "timeoutId", void 0);
    _defineProperty(this, "executedJobs", void 0);
    _defineProperty(this, "activeJobCount", void 0);
    _defineProperty(this, "concurrency", void 0);
    _defineProperty(this, "updateInterval", void 0);
    _defineProperty(this, "onQueueFinish", void 0);
    _defineProperty(this, "queuedJobExecuter", []);
    _defineProperty(this, "runningJobPromises", void 0);
    _defineProperty(this, "resetActiveJob", job => {
      this.jobStore.updateJob({
        ...job,
        ...{
          active: FALSE
        }
      });
    });
    _defineProperty(this, "runQueue", async () => {
      if (!this.isActive) {
        this.finishQueue();
        return;
      }
      const nextJob = await this.jobStore.getNextJob();
      if (this.isJobNotEmpty(nextJob)) {
        const nextJobs = await this.getJobsForWorker(nextJob.workerName);
        const processingJobs = nextJobs.map(async job => this.limitExecution(this.excuteJob, job));
        await Promise.all(processingJobs);
      } else if (!this.isExecuting()) {
        this.finishQueue();
        return;
      }
      this.scheduleQueue();
    });
    _defineProperty(this, "limitExecution", async (executer, rawJob) => {
      return new Promise(async resolve => await this.enqueueJobExecuter(executer, resolve, rawJob));
    });
    _defineProperty(this, "enqueueJobExecuter", async (executer, resolve, rawJob) => {
      if (this.isExecuterAvailable()) {
        await this.runExecuter(executer, resolve, rawJob);
      } else {
        this.queuedJobExecuter.push(this.runExecuter.bind(null, executer, resolve, rawJob));
      }
    });
    _defineProperty(this, "runExecuter", async (executer, resolve, rawJob) => {
      try {
        await executer(rawJob);
      } finally {
        resolve(true);
        if (this.queuedJobExecuter.length > 0 && this.isExecuterAvailable()) {
          await this.queuedJobExecuter.shift()();
        }
      }
    });
    _defineProperty(this, "excuteJob", async rawJob => {
      const worker = this.workers[rawJob.workerName];
      const payload = JSON.parse(rawJob.payload);
      const job = {
        ...rawJob,
        ...{
          payload
        }
      };
      try {
        job.status = "processing";
        this.jobStore.updateJob({
          ...job,
          payload: JSON.stringify(payload)
        });
        this.emit('jobStarted', job);
        this.activeJobCount++;
        if (!this.workers[rawJob.workerName]) {
          throw new Error(`Missing worker with name ${rawJob.workerName}`);
        }
        const promise = worker.execute(rawJob);
        this.runningJobPromises[rawJob.id] = promise;
        await promise;
        worker.triggerSuccess(job);
        job.status = "finished";
        this.jobStore.updateJob({
          ...job,
          payload: JSON.stringify(payload)
        });
        this.jobStore.removeJob(rawJob);
        this.emit('jobSucceeded', job);
      } catch (err) {
        const error = err;
        const {
          attempts
        } = rawJob;
        // eslint-disable-next-line prefer-const
        let {
          errors,
          failedAttempts
        } = JSON.parse(rawJob.metaData);
        failedAttempts++;
        let failed = '';
        if (failedAttempts >= attempts) {
          failed = new Date().toISOString();
        }
        const metaData = JSON.stringify({
          errors: [...errors, error],
          failedAttempts
        });
        worker.triggerFailure({
          ...job,
          metaData,
          failed
        }, error);
        const failedJob = {
          ...rawJob,
          ...{
            active: FALSE,
            metaData,
            failed,
            status: "failed"
          }
        };
        this.jobStore.updateJob(failedJob);
        this.emit('jobFailed', failedJob, error);
      } finally {
        delete this.runningJobPromises[job.id];
        worker.decreaseExecutionCount();
        worker.triggerCompletion(job);
        this.emit('jobCompleted', {
          ...job
        });
        this.executedJobs.push(rawJob);
        this.activeJobCount--;
      }
    });
    this.jobStore = NativeModules.JobQueue;
    this.workers = {};
    this.runningJobPromises = {};
    this.isActive = false;
    this.timeoutId = 0;
    this.executedJobs = [];
    this.activeJobCount = 0;
    this.updateInterval = 10;
    this.onQueueFinish = executedJobs => {};
    this.concurrency = -1;
  }

  /**
   * @returns a promise that resolves all jobs of jobStore
   */
  async getJobs() {
    return await this.jobStore.getJobs();
  }
  async getJobsWithDeleted() {
    return await this.jobStore.getJobsWithDeleted();
  }
  /**
   * @param job the job to be deleted
   */
  removeJob(job) {
    this.jobStore.removeJob(job);
    this.emit("jobDeleted", job);
  }
  removeJobPermanent(job) {
    this.jobStore.removeJobPermanently(job);
    this.emit("jobDeleted", job);
  }
  /**
   * @param job the job which should be requeued
   */
  requeueJob(job) {
    this.jobStore.updateJob({
      ...job,
      failed: '',
      status: "idle",
      active: TRUE
    });
    if (!this.isActive) {
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      this.start().then(() => {
        console.log("Queue restarted");
      }).catch(() => {
        console.log("Queue could not be restarted");
      });
    }
  }
  configure(options) {
    const {
      onQueueFinish = executedJobs => {},
      updateInterval = 10,
      concurrency = -1
    } = options;
    this.onQueueFinish = onQueueFinish;
    this.updateInterval = updateInterval;
    this.concurrency = concurrency;
  }
  /**
   * adds a [[Worker]] to the queue which can execute Jobs
   * @param worker
   */
  addWorker(worker) {
    if (this.workers[worker.name]) {
      throw new Error(`Worker "${worker.name}" already exists.`);
    }
    this.workers[worker.name] = worker;
    this.emit('workerAdded', worker.name);
  }

  /**
   * removes worker from queue
   *
   * @param name
   * @param [deleteRelatedJobs=false] removes all queued jobs releated to the worker if set to true
   */
  removeWorker(name, deleteRelatedJobs = false) {
    delete this.workers[name];
    if (deleteRelatedJobs) {
      this.jobStore.removeJobsByWorkerName(name);
    }
  }

  /**
   * adds a job to the queue
   * @param workerName name of the worker which should be used to excute the job
   * @param [payload={}] payload which is passed as parameter to the executer
   * @param [options={ attempts: 0, timeout: 0, priority: 0 }] options to set max attempts, a timeout and a priority
   * @param [startQueue=true] if set to false the queue won't start automaticly when adding a job
   * @returns job id
   */
  addJob(workerName, payload, options = {
    attempts: 0,
    timeout: 0,
    priority: 0
  }, startQueue = true) {
    const {
      attempts = 0,
      timeout = 0,
      priority = 0
    } = options;
    const id = Uuid.v4();
    const job = {
      id,
      payload: JSON.stringify(payload || {}),
      metaData: JSON.stringify({
        failedAttempts: 0,
        errors: []
      }),
      active: FALSE,
      created: new Date().toISOString(),
      failed: '',
      workerName,
      attempts,
      timeout,
      priority,
      isDeleted: false,
      status: "idle"
    };
    if (!this.workers[job.workerName]) {
      throw new Error(`Missing worker with name ${job.workerName}`);
    }
    this.jobStore.addJob(job);
    this.emit('jobAdded', job);
    if (startQueue && !this.isActive) {
      this.start();
    }
    return id;
  }
  /**
   * starts the queue to execute queued jobs
   */
  async start() {
    if (!this.isActive) {
      this.isActive = true;
      this.executedJobs = [];
      await this.resetActiveJobs();
      this.scheduleQueue();
    }
  }
  /**
   * stop the queue from executing queued jobs
   */
  stop() {
    this.isActive = false;
  }

  /**
   * cancel running job
   */
  cancelJob(jobId, exception) {
    const promise = this.runningJobPromises[jobId];
    if (promise !== undefined && typeof promise[CANCEL] === 'function') {
      promise[CANCEL](exception || new Error(`canceled`));
    } else if (!promise[CANCEL]) {
      console.warn('Worker does not have a cancel method implemented');
    } else {
      throw new Error(`Job with id ${jobId} not currently running`);
    }
  }
  async cancelAllActiveJobs() {
    const jobs = await this.jobStore.getActiveMarkedJobs();
    jobs.forEach(job => {
      const newJob = {
        ...job,
        ...{
          active: FALSE,
          status: "cancelled"
        }
      };
      this.jobStore.updateJob(newJob);
      this.emit('jobCancelled', newJob);
    });
  }
  cancelActiveJob(job) {
    const newJob = {
      ...job,
      ...{
        active: FALSE,
        status: "cancelled"
      }
    };
    this.jobStore.updateJob(newJob);
    this.emit('jobCancelled', newJob);
  }
  async resetActiveJobs() {
    const activeMarkedJobs = await this.jobStore.getActiveMarkedJobs();
    const resetTasks = activeMarkedJobs.map(this.resetActiveJob);
    await Promise.all(resetTasks);
  }
  scheduleQueue() {
    if (AppState.currentState === 'active' && Platform.OS === "ios") {
      this.timeoutId = setTimeout(this.runQueue, this.updateInterval);
    } else {
      this.runQueue();
    }
  }
  isJobNotEmpty(rawJob) {
    return Object.keys(rawJob).length > 0;
  }
  isExecuterAvailable() {
    return this.concurrency <= 0 || this.activeJobCount < this.concurrency;
  }
  isExecuting() {
    return this.activeJobCount > 0;
  }
  finishQueue() {
    this.onQueueFinish(this.executedJobs);
    this.isActive = false;
    clearTimeout(this.timeoutId);
  }
  async getJobsForWorker(workerName) {
    const {
      isBusy,
      availableExecuters
    } = this.workers[workerName];
    if (!isBusy) {
      return await this.jobStore.getJobsForWorker(workerName, availableExecuters);
    } else {
      return await this.getJobsForAlternateWorker();
    }
  }
  async getJobsForWorkerWithDeleted(workerName) {
    const {
      isBusy,
      availableExecuters
    } = this.workers[workerName];
    if (!isBusy) {
      return await this.jobStore.getJobsForWorkerWithDeleted(workerName, availableExecuters);
    } else {
      return await this.getJobsForAlternateWorker();
    }
  }
  async getJobsForAlternateWorker() {
    for (const workerName of Object.keys(this.workers)) {
      const {
        isBusy,
        availableExecuters
      } = this.workers[workerName];
      let nextJobs = [];
      if (!isBusy) {
        nextJobs = await this.jobStore.getJobsForWorker(workerName, availableExecuters);
      }
      if (nextJobs.length > 0) {
        return nextJobs;
      }
    }
    return [];
  }
}
_Queue = Queue;
_defineProperty(Queue, "queueInstance", void 0);
export default Queue.instance;
//# sourceMappingURL=Queue.js.map