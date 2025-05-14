export type JobStatus = "idle" | "processing" | "finished" | "failed" | "cancelled";
export interface Job<P extends object> {
    id: string;
    workerName: string;
    active: Bool;
    payload: P;
    metaData: string;
    attempts: number;
    created: string;
    status: JobStatus;
    failed: string;
    timeout: number;
    priority: number;
    isDeleted: boolean;
}
export interface RawJob {
    id: string;
    workerName: string;
    active: Bool;
    payload: string;
    metaData: string;
    attempts: number;
    created: string;
    status: JobStatus;
    failed: string;
    timeout: number;
    priority: number;
    isDeleted: boolean;
}
export type Bool = TRUE | FALSE;
type FALSE = 0;
type TRUE = 1;
export declare const FALSE = 0;
export declare const TRUE = 1;
export {};
//# sourceMappingURL=Job.d.ts.map