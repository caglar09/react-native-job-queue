import { Job, RawJob } from './models/Job';
import { Worker } from './Worker';
import EventEmitter from 'eventemitter3';
type QueueErrorType = "cancelled" | "error";
export declare class QueueError extends Error {
    code: QueueErrorType;
    constructor(message: string, code?: QueueErrorType);
}
export interface QueueEvents {
    workerAdded: (workerName: string) => void;
    jobAdded: (job: RawJob) => void;
    jobStarted: (job: RawJob) => void;
    jobSucceeded: (job: Job<any>) => void;
    jobFailed: (job: RawJob, error: Error) => void;
    jobCancelled: (job: RawJob) => void;
    jobCompleted: (job: RawJob) => void;
    jobDeleted: (job: RawJob) => void;
    jobRequeued: (job: RawJob) => void;
}
export interface QueueOptions {
    onQueueFinish?: (executedJobs: Array<Job<any>>) => void;
    updateInterval?: number;
    concurrency?: number;
}
export declare class Queue extends EventEmitter<QueueEvents> {
    static get instance(): Queue;
    get isRunning(): boolean;
    get registeredWorkers(): {
        [key: string]: Worker<any>;
    };
    private static queueInstance;
    private emitter;
    private jobStore;
    private workers;
    private isActive;
    private timeoutId;
    private executedJobs;
    private activeJobCount;
    private concurrency;
    private updateInterval;
    private onQueueFinish;
    private queuedJobExecuter;
    private runningJobPromises;
    private constructor();
    getJobs(): Promise<RawJob[]>;
    getJobsWithDeleted(): Promise<RawJob[]>;
    removeJob(job: RawJob): void;
    removeJobPermanent(job: RawJob): void;
    requeueJob(job: RawJob): void;
    configure(options: QueueOptions): void;
    addWorker(worker: Worker<any>): void;
    removeWorker(name: string, deleteRelatedJobs?: boolean): void;
    addJob<P extends object>(workerName: string, payload: P, options?: {
        attempts: number;
        timeout: number;
        priority: number;
    }, startQueue?: boolean): string;
    start(): Promise<void>;
    stop(): void;
    cancelJob(jobId: string, exception?: Error): void;
    cancelAllActiveJobs(): Promise<void>;
    cancelActiveJob(job: RawJob): void;
    private resetActiveJob;
    private resetActiveJobs;
    private scheduleQueue;
    private runQueue;
    private isJobNotEmpty;
    private limitExecution;
    private enqueueJobExecuter;
    private runExecuter;
    private isExecuterAvailable;
    private isExecuting;
    private finishQueue;
    getJobsForWorker(workerName: string): Promise<RawJob[]>;
    getJobsForWorkerWithDeleted(workerName: string): Promise<RawJob[]>;
    private getJobsForAlternateWorker;
    private excuteJob;
}
declare const _default: Queue;
export default _default;
//# sourceMappingURL=Queue.d.ts.map