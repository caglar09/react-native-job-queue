import { RawJob } from '../models/Job';
export interface UseQueueState {
    queuedCount: number;
    activeCount: number;
    failedCount: number;
    cancelledCount: number;
    completedCount: number;
    activeJobs: RawJob[];
    lastCompletedJobs: RawJob[];
    refreshJobs: () => Promise<void>;
}
export declare function useQueue(): UseQueueState;
//# sourceMappingURL=useQueue.d.ts.map