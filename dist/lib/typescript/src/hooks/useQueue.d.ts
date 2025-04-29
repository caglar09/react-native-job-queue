import { RawJob } from '../models/Job';
export interface UseQueueState {
    queuedCount: number;
    activeCount: number;
    failedCount: number;
    completedCount: number;
    activeJobs: RawJob[];
    lastCompletedJobs: RawJob[];
    refreshJobs: () => void;
}
export declare function useQueue(): UseQueueState;
//# sourceMappingURL=useQueue.d.ts.map