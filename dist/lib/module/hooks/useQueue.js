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
    // İlk yüklemede işleri getir
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
    const onJobSucceeded = job => {
      setActiveJobs(prev => prev.filter(j => j.id !== job.id));
      setLastCompletedJobs(prev => [...prev, {
        ...job
      }]);
    };

    // Subscribe
    queue.on('jobAdded', onJobAdded);
    queue.on('jobStarted', onJobStarted);
    queue.on('jobFailed', onJobFailed);
    queue.on('jobSucceeded', onJobSucceeded);

    // Cleanup
    return () => {
      queue.off('jobAdded', onJobAdded);
      queue.off('jobStarted', onJobStarted);
      queue.off('jobFailed', onJobFailed);
      queue.off('jobSucceeded', onJobSucceeded);
    };
  }, [refreshJobs]);
  return {
    queuedCount,
    activeCount,
    failedCount,
    completedCount,
    activeJobs,
    lastCompletedJobs,
    refreshJobs
  };
}
//# sourceMappingURL=useQueue.js.map