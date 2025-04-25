// src/hooks/useQueue.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import queue from '../Queue';
import { RawJob } from '../models/Job';

export interface UseQueueState {
    queuedCount: number;
    activeCount: number;
    failedCount: number;
    completedCount: number;
    activeJobs: RawJob[];
    lastCompletedJobs: RawJob[];
}

/**
 * useQueue hook
 *
 * Tracks the queue state:
 * - queuedCount: number of jobs waiting to start (status === 'idle')
 * - activeCount: number of jobs currently processing
 * - failedCount: number of jobs that have failed
 * - completedCount: number of jobs that have completed successfully
 * - activeJobs: list of current non-deleted jobs
 * - lastCompletedJobs: list of jobs marked as deleted (completed)
 */
export function useQueue(): UseQueueState {
    const [activeJobs, setActiveJobs] = useState<RawJob[]>([]);
    const [lastCompletedJobs, setLastCompletedJobs] = useState<RawJob[]>([]);

    // Derive counts from job statuses
    const queuedCount = useMemo(() => activeJobs.filter((j) => j.status === 'idle').length, [activeJobs]);
    const activeCount = useMemo(() => activeJobs.filter((j) => j.status === 'processing').length, [activeJobs]);
    const failedCount = useMemo(() => activeJobs.filter((j) => j.status === 'failed').length, [activeJobs]);
    const completedCount = useMemo(() => lastCompletedJobs.length, [lastCompletedJobs]);

    // Yığın içindeki işleri güncelle
    const refreshJobs = useCallback(async () => {
        const all = await queue.getJobs();
        const allWithDeleted = await queue.getJobsWithDeleted();
        const completed = allWithDeleted.filter((j) => j.isDeleted);
        setLastCompletedJobs(completed);

        setActiveJobs(all);
    }, []);

    useEffect(() => {
        // İlk yüklemede işleri getir
        refreshJobs();

        // Event listener tanımları
        const onJobAdded = (job: RawJob) => {
            setActiveJobs((prev) => [...prev, job]);
        };
        const onJobStarted = (job: RawJob) => {
            setActiveJobs((prev) => prev.map((j) => (j.id === job.id ? { ...j, status: 'processing' } : j)));
        };
        const onJobCompleted = (job: RawJob) => {
            setActiveJobs((prev) => prev.filter((j) => j.id !== job.id));
            setLastCompletedJobs((prev) => [...prev, { ...job, status: 'finished' }]);
        };
        const onJobFailed = (job: RawJob) => {
            setActiveJobs((prev) =>
                prev.map((j) =>
                    j.id === job.id ? { ...j, status: 'failed', metaData: job.metaData, failed: job.failed } : j
                )
            );
        };

        // Subscribe
        queue.on('jobAdded', onJobAdded);
        queue.on('jobStarted', onJobStarted);
        queue.on('jobCompleted', onJobCompleted);
        queue.on('jobFailed', onJobFailed);

        // Cleanup
        return () => {
            queue.off('jobAdded', onJobAdded);
            queue.off('jobStarted', onJobStarted);
            queue.off('jobCompleted', onJobCompleted);
            queue.off('jobFailed', onJobFailed);
        };
    }, [refreshJobs]);

    return {
        queuedCount,
        activeCount,
        failedCount,
        completedCount,
        activeJobs,
        lastCompletedJobs,
    };
}
