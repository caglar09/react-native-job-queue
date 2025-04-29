import { RawJob } from '../models/Job';
import { JobStore } from '../models/JobStore';
export declare class JobStoreMock implements JobStore {
    jobs: RawJob[];
    constructor();
    addJob(job: RawJob): Promise<void>;
    getJobs(): Promise<RawJob[]>;
    getJobsWithDeleted(): Promise<RawJob[]>;
    getActiveMarkedJobs(): Promise<RawJob[]>;
    getNextJob(): Promise<RawJob>;
    getJobsForWorker(name: string, count: number): Promise<RawJob[]>;
    getJobsForWorkerWithDeleted(name: string, count: number): Promise<RawJob[]>;
    updateJob(rawJob: RawJob): void;
    removeJob(rawJob: RawJob): void;
    removeJobPermanently(rawJob: RawJob): void;
    removeJobsByWorkerName(workerName: string): void;
    deleteAllJobs(): Promise<void>;
    private sortJobs;
}
//# sourceMappingURL=JobQueueMock.d.ts.map