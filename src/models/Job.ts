export type JobStatus = "idle" | "processing" | "finished" | "failed" | "cancelled"

/**
 * represents Job model with Generics
 * @typeparam P payload type
 */
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
/**
 * represents native Job model
 */
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

/**
 * used to map booleans to integer since Sqlite doesn't support boolean
 */
export type Bool = TRUE | FALSE;
type FALSE = 0;
type TRUE = 1;
export const FALSE = 0;
export const TRUE = 1;
