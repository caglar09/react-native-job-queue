// src/hooks/useQueue.tsx
import { useState, useEffect, useCallback, useMemo } from 'react';
import queue from '../Queue';
/**
 * useQueue hook
 *
 * Tracks the queue state:
 * - queuedCount: number of jobs waiting to start (status === 'idle')
 * - activeCount: number of jobs currently processing
 * - failedCount: number of jobs that have failed
 * - cancelledCount: number of jobs that have been cancelled
 * - completedCount: number of jobs that have completed successfully
 * - activeJobs: list of current non-deleted jobs
 * - lastCompletedJobs: list of jobs marked as deleted (completed)
 */
export function useQueue() {
  const [activeJobs, setActiveJobs] = useState([]);
  const [lastCompletedJobs, setLastCompletedJobs] = useState([]);

  // Derive counts from job statuses
  const queuedCount = useMemo(() => activeJobs.filter(j => j.status === 'idle').length, [activeJobs]);
  const activeCount = useMemo(() => activeJobs.filter(j => j.status === 'processing').length, [activeJobs]);
  const failedCount = useMemo(() => activeJobs.filter(j => j.status === 'failed').length, [activeJobs]);
  const cancelledCount = useMemo(() => activeJobs.filter(j => j.status === 'cancelled').length, [activeJobs]);
  const completedCount = useMemo(() => lastCompletedJobs.length, [lastCompletedJobs]);

  // Yığın içindeki işleri güncelle
  const refreshJobs = useCallback(async () => {
    const all = await queue.getJobs();
    const allWithDeleted = await queue.getJobsWithDeleted();
    const completed = allWithDeleted.filter(j => j.isDeleted);
    setLastCompletedJobs(completed);
    setActiveJobs(all);
  }, []);
  useEffect(() => {
    // eslint-disable-next-line @typescript-eslint/no-floating-promises
    refreshJobs();

    // Event listener tanımları
    const onJobAdded = job => {
      setActiveJobs(prev => [...prev, job]);
    };
    const onJobStarted = job => {
      setActiveJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        ...job
      } : j));
    };
    const onJobFailed = job => {
      setActiveJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        ...job
      } : j));
    };
    const onJobCancelled = job => {
      setActiveJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        ...job
      } : j));
    };
    const onJobSucceeded = job => {
      setActiveJobs(prev => prev.filter(j => j.id !== job.id));
      setLastCompletedJobs(prev => [...prev, {
        ...job
      }]);
    };
    const onJobDeleted = job => {
      setActiveJobs(prev => prev.filter(j => j.id !== job.id));
      setLastCompletedJobs(prev => prev.filter(j => j.id !== job.id));
    };
    const onJobRequeued = job => {
      setActiveJobs(prev => prev.map(j => j.id === job.id ? {
        ...j,
        ...job
      } : j));
    };

    // Subscribe
    queue.addListener('jobAdded', onJobAdded);
    queue.addListener('jobStarted', onJobStarted);
    queue.addListener('jobFailed', onJobFailed);
    queue.addListener('jobSucceeded', onJobSucceeded);
    queue.addListener('jobDeleted', onJobDeleted);
    queue.addListener('jobCancelled', onJobCancelled);
    queue.addListener('jobRequeued', onJobRequeued);

    // Cleanup
    return () => {
      queue.removeListener('jobAdded', onJobAdded);
      queue.removeListener('jobStarted', onJobStarted);
      queue.removeListener('jobFailed', onJobFailed);
      queue.removeListener('jobSucceeded', onJobSucceeded);
      queue.removeListener('jobDeleted', onJobDeleted);
      queue.removeListener('jobCancelled', onJobCancelled);
      queue.removeListener('jobRequeued', onJobRequeued);
    };
  }, [refreshJobs]);
  return {
    queuedCount,
    activeCount,
    failedCount,
    completedCount,
    cancelledCount,
    activeJobs,
    lastCompletedJobs,
    refreshJobs
  };
}
//# sourceMappingURL=useQueue.js.map