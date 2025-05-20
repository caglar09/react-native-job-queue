/* eslint-disable no-extra-boolean-cast */
/* eslint-disable @typescript-eslint/no-empty-function */
import { AppState, NativeModules, Platform } from 'react-native';

import { FALSE, Job, RawJob, TRUE } from './models/Job';
import { JobStore } from './models/JobStore';
import { Uuid } from './utils/Uuid';
import { Worker, CANCEL, CancellablePromise } from './Worker';


import EventEmitter from 'eventemitter3';

type QueueErrorType = "cancelled" | "error";

export class QueueError extends Error {
    code: QueueErrorType;
    constructor(message: string, code: QueueErrorType = "error") {
        super(message);
        this.name = 'QueueError';
        this.code = code;
    }
}

/**
 * Events emitted by the Queue.
 */
export interface QueueEvents {
    /**
     * Fired when a worker is added.
     * @param workerName Name of the worker.
     */
    workerAdded: (workerName: string) => void;

    /**
     * Fired when a job is added to the queue.
     * @param job The RawJob that was added.
     */
    jobAdded: (job: RawJob) => void;

    /**
     * Fired when a job starts processing.
     * @param job The RawJob that started.
     */
    jobStarted: (job: RawJob) => void;

    /**
     * Fired when a job completes successfully.
     * @param job The Job with payload that succeeded.
     */
    jobSucceeded: (job: Job<any>) => void;

    /**
     * Fired when a job fails.
     * @param job The RawJob that failed.
     * @param error The error thrown.
     */
    jobFailed: (job: RawJob, error: Error) => void;

    /**
     * Fired when a job fails.
     * @param job The RawJob that failed.
     * @param error The error thrown.
     */
    jobCancelled: (job: RawJob) => void;

    /**
     * Fired when a job completes (regardless of success or failure).
     * @param job The RawJob that finished.
     */
    jobCompleted: (job: RawJob) => void;

    jobDeleted: (job: RawJob) => void
}


/**
 * Options to configure the queue
 */
export interface QueueOptions {
    /**
     * A callback function which is called after the queue has been stopped
     * @parameter executedJobs
     */
    onQueueFinish?: (executedJobs: Array<Job<any>>) => void;
    /**
     * Interval in which the queue checks for new jobs to execute
     */
    updateInterval?: number;
    concurrency?: number;
}
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
export class Queue extends EventEmitter<QueueEvents> {
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
    private static queueInstance: Queue | null;
    private emitter: EventEmitter<QueueEvents> = new EventEmitter<QueueEvents>();

    private jobStore: JobStore;
    private workers: { [key: string]: Worker<any> };
    private isActive: boolean;

    private timeoutId: number;
    private executedJobs: Array<Job<any>>;
    private activeJobCount: number;

    private concurrency: number;
    private updateInterval: number;
    private onQueueFinish: (executedJobs: Array<Job<any>>) => void;

    private queuedJobExecuter: any[] = [];
    private runningJobPromises: { [key: string]: CancellablePromise<any> };

    private constructor() {
        super();
        this.jobStore = NativeModules.JobQueue;
        this.workers = {};
        this.runningJobPromises = {};
        this.isActive = false;

        this.timeoutId = 0;
        this.executedJobs = [];
        this.activeJobCount = 0;

        this.updateInterval = 10;
        this.onQueueFinish = (executedJobs: Array<Job<any>>) => { };
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
    removeJob(job: RawJob) {
        this.jobStore.removeJob(job);
        this.emit("jobDeleted", job)
    }
    removeJobPermanent(job: RawJob) {
        this.jobStore.removeJobPermanently(job);
        this.emit("jobDeleted", job)
    }
    /**
     * @param job the job which should be requeued
     */
    requeueJob(job: RawJob) {
        this.jobStore.updateJob({ ...job, failed: '', status: "idle", active: TRUE });

        if (!this.isActive) {
            // eslint-disable-next-line @typescript-eslint/ban-ts-comment
            // @ts-ignore
            this.start().then(() => {
                console.log("Queue restarted")
            }).catch(() => {
                console.log("Queue could not be restarted")
            });
        }
    }

    configure(options: QueueOptions) {
        const {
            onQueueFinish = (executedJobs: Array<Job<any>>) => { },
            updateInterval = 10,
            concurrency = -1,
        } = options;
        this.onQueueFinish = onQueueFinish;
        this.updateInterval = updateInterval;
        this.concurrency = concurrency;
    }
    /**
     * adds a [[Worker]] to the queue which can execute Jobs
     * @param worker
     */
    addWorker(worker: Worker<any>) {
        if (this.workers[worker.name]) {
            throw new QueueError(`Worker "${worker.name}" already exists.`, "error");
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
    removeWorker(name: string, deleteRelatedJobs = false) {
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
    addJob<P extends object>(
        workerName: string,
        payload: P,
        options = { attempts: 0, timeout: 0, priority: 0 },
        startQueue = true
    ) {
        const { attempts = 0, timeout = 0, priority = 0 } = options;
        const id: string = Uuid.v4();
        const job: RawJob = {
            id,
            payload: JSON.stringify(payload || {}),
            metaData: JSON.stringify({ failedAttempts: 0, errors: [] }),
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
            throw new QueueError(`Missing worker with name ${job.workerName}`);
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
    cancelJob(jobId: string, exception?: Error) {
        const promise = this.runningJobPromises[jobId];
        if (promise !== undefined && typeof promise[CANCEL] === 'function') {
            promise[CANCEL](exception || new QueueError(`job canceled`, "cancelled"));
        } else if (!promise[CANCEL]) {
            console.warn('Worker does not have a cancel method implemented');
        } else {
            throw new QueueError(`Job with id ${jobId} not currently running`, "error");
        }
    }
    async cancelAllActiveJobs() {
        const jobs = await this.jobStore.getJobs()

        jobs.forEach((job) => {
            const newJob = { ...job, ...{ active: FALSE, status: "cancelled" } };
            const isRunning = this.runningJobPromises[job.id];
            // eslint-disable-next-line @typescript-eslint/no-misused-promises
            if (!!Boolean(isRunning)) {
                this.cancelJob(job.id, new QueueError(`Job with id ${job.id} cancelled`, "cancelled"));
            }
            this.jobStore.updateJob(newJob as RawJob);
            this.emit('jobCancelled', newJob as RawJob);
        })
    }
    cancelActiveJob(job: RawJob) {
        const newJob = { ...job, ...{ active: FALSE, status: "cancelled" } };

        const isRunning = this.runningJobPromises[job.id];
        // eslint-disable-next-line @typescript-eslint/no-misused-promises
        if (!!isRunning) {
            this.cancelJob(job.id, new QueueError(`Job with id ${job.id} cancelled`, "cancelled"));
        }

        this.jobStore.updateJob(newJob as RawJob);

        this.emit('jobCancelled', newJob as RawJob);
    }

    private resetActiveJob = (job: RawJob) => {
        this.jobStore.updateJob({ ...job, ...{ active: FALSE } });
    };
    private async resetActiveJobs() {
        const activeMarkedJobs = await this.jobStore.getActiveMarkedJobs();
        const resetTasks = activeMarkedJobs.map(this.resetActiveJob);
        await Promise.all(resetTasks);
    }
    private scheduleQueue() {
        if (AppState.currentState === 'active' && Platform.OS === "ios") {
            this.timeoutId = setTimeout(this.runQueue, this.updateInterval);
        } else {
            this.runQueue();
        }
    }
    private runQueue = async () => {
        if (!this.isActive) {
            this.finishQueue();
            return;
        }
        let nextJob = await this.jobStore.getWorkInProgressJob();
        if (!nextJob) {
            nextJob = await this.jobStore.getNextJob();
        }
        if (this.isJobNotEmpty(nextJob)) {
            const nextJobs = await this.getJobsForWorker(nextJob.workerName);
            const processingJobs = nextJobs.map(async (job) => this.limitExecution(this.excuteJob, job));
            await Promise.all(processingJobs);
        } else if (!this.isExecuting()) {
            this.finishQueue();
            return;
        }
        this.scheduleQueue();
    };

    private isJobNotEmpty(rawJob: RawJob | {}) {
        return Object.keys(rawJob).length > 0;
    }

    private limitExecution = async (executer: (rawJob: RawJob) => Promise<void>, rawJob: RawJob) => {
        return new Promise(async (resolve) => await this.enqueueJobExecuter(executer, resolve, rawJob));
    };

    private enqueueJobExecuter = async (
        executer: (rawJob: RawJob) => Promise<void>,
        resolve: (_: unknown) => void,
        rawJob: RawJob
    ) => {
        if (this.isExecuterAvailable()) {
            await this.runExecuter(executer, resolve, rawJob);
        } else {
            this.queuedJobExecuter.push(this.runExecuter.bind(null, executer, resolve, rawJob));
        }
    };

    private runExecuter = async (
        executer: (rawJob: RawJob) => Promise<void>,
        resolve: (_: unknown) => void,
        rawJob: RawJob
    ) => {
        try {
            await executer(rawJob);
        } finally {
            resolve(true);
            if (this.queuedJobExecuter.length > 0 && this.isExecuterAvailable()) {
                await this.queuedJobExecuter.shift()();
            }
        }
    };
    private isExecuterAvailable() {
        return this.concurrency <= 0 || this.activeJobCount < this.concurrency;
    }
    private isExecuting() {
        return this.activeJobCount > 0;
    }

    private finishQueue() {
        this.onQueueFinish(this.executedJobs);
        this.isActive = false;
        clearTimeout(this.timeoutId);
    }

    async getJobsForWorker(workerName: string) {
        const { isBusy, availableExecuters } = this.workers[workerName];
        if (!isBusy) {
            return await this.jobStore.getJobsForWorker(workerName, availableExecuters);
        } else {
            return await this.getJobsForAlternateWorker();
        }
    }

    async getJobsForWorkerWithDeleted(workerName: string) {
        const { isBusy, availableExecuters } = this.workers[workerName];
        if (!isBusy) {
            return await this.jobStore.getJobsForWorkerWithDeleted(workerName, availableExecuters);
        } else {
            return await this.getJobsForAlternateWorker();
        }
    }

    private async getJobsForAlternateWorker() {
        for (const workerName of Object.keys(this.workers)) {
            const { isBusy, availableExecuters } = this.workers[workerName];
            let nextJobs: RawJob[] = [];
            if (!isBusy) {
                nextJobs = await this.jobStore.getJobsForWorker(workerName, availableExecuters);
            }
            if (nextJobs.length > 0) {
                return nextJobs;
            }
        }
        return [];
    }

    private excuteJob = async (rawJob: RawJob) => {
        const worker = this.workers[rawJob.workerName];
        const payload = JSON.parse(rawJob.payload) as Worker<any>;
        const job = { ...rawJob, ...{ payload } } as Job<any>;

        try {
            job.status = "processing";
            this.jobStore.updateJob({ ...job, payload: JSON.stringify(payload) });
            this.emit('jobStarted', job);

            this.activeJobCount++;
            if (!this.workers[rawJob.workerName]) {
                throw new QueueError(`Missing worker with name ${rawJob.workerName}`, "error");
            }
            const promise = worker.execute(rawJob);

            this.runningJobPromises[rawJob.id] = promise;
            await promise;

            worker.triggerSuccess(job);
            job.status = "finished";
            this.jobStore.updateJob({ ...job, payload: JSON.stringify(payload) });
            this.jobStore.removeJob(rawJob);
            this.emit('jobSucceeded', job);
        } catch (err) {
            const error = err as QueueError;
            const { attempts } = rawJob;
            // eslint-disable-next-line prefer-const
            let { errors, failedAttempts } = JSON.parse(rawJob.metaData) as { errors: string[]; failedAttempts: number };
            failedAttempts++;
            let failed = '';
            if (failedAttempts >= attempts) {
                failed = new Date().toISOString();
            }
            const metaData = JSON.stringify({ errors: [...errors, error], failedAttempts });
            worker.triggerFailure({ ...job, metaData, failed }, error);
            const failedJob = { ...rawJob, ...{ active: FALSE, metaData, failed, status: error.code === "cancelled" ? "cancelled" : "failed" } } as RawJob;
            this.jobStore.updateJob(failedJob);
            this.emit('jobFailed', failedJob, error);
        } finally {
            delete this.runningJobPromises[job.id];
            worker.decreaseExecutionCount();
            worker.triggerCompletion(job);
            this.emit('jobCompleted', { ...job });
            this.executedJobs.push(rawJob);
            this.activeJobCount--;
        }
    };
}
export default Queue.instance;
