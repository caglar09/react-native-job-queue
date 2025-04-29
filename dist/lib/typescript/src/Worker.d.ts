import { Job, RawJob } from './models/Job';
export declare const CANCEL = "rn_job_queue_cancel";
export interface WorkerOptions<P extends object> {
    onStart?: (job: Job<P>) => void;
    onSuccess?: (job: Job<P>) => void;
    onFailure?: (job: Job<P>, error: Error) => void;
    onCompletion?: (job: Job<P>) => void;
    concurrency?: number;
}
export interface CancellablePromise<T> extends Promise<T> {
    rn_job_queue_cancel?: (error?: Error) => void;
}
export declare class Worker<P extends object> {
    readonly name: string;
    readonly concurrency: number;
    private executionCount;
    private executer;
    private onStart;
    private onSuccess;
    private onFailure;
    private onCompletion;
    constructor(name: string, executer: (payload: P, id: string) => Promise<any>, options?: WorkerOptions<P>);
    get isBusy(): boolean;
    get availableExecuters(): number;
    execute(rawJob: RawJob): CancellablePromise<any>;
    private executeWithTimeout;
    triggerSuccess(job: Job<P>): void;
    triggerFailure(job: Job<P>, error: Error): void;
    triggerCompletion(job: Job<P>): void;
    decreaseExecutionCount(): void;
}
//# sourceMappingURL=Worker.d.ts.map