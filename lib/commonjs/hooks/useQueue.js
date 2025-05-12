"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.useQueue = useQueue;
var _react = require("react");
var _Queue = _interopRequireDefault(require("../Queue"));
function _interopRequireDefault(e) { return e && e.__esModule ? e : { default: e }; }
// src/hooks/useQueue.tsx

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
function useQueue() {
  const [activeJobs, setActiveJobs] = (0, _react.useState)([]);
  const [lastCompletedJobs, setLastCompletedJobs] = (0, _react.useState)([]);

  // Derive counts from job statuses
  const queuedCount = (0, _react.useMemo)(() => activeJobs.filter(j => j.status === 'idle').length, [activeJobs]);
  const activeCount = (0, _react.useMemo)(() => activeJobs.filter(j => j.status === 'processing').length, [activeJobs]);
  const failedCount = (0, _react.useMemo)(() => activeJobs.filter(j => j.status === 'failed').length, [activeJobs]);
  const completedCount = (0, _react.useMemo)(() => lastCompletedJobs.length, [lastCompletedJobs]);

  // Yığın içindeki işleri güncelle
  const refreshJobs = (0, _react.useCallback)(async () => {
    const all = await _Queue.default.getJobs();
    const allWithDeleted = await _Queue.default.getJobsWithDeleted();
    const completed = allWithDeleted.filter(j => j.isDeleted);
    setLastCompletedJobs(completed);
    setActiveJobs(all);
  }, []);
  (0, _react.useEffect)(() => {
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

    // Subscribe
    _Queue.default.on('jobAdded', onJobAdded);
    _Queue.default.on('jobStarted', onJobStarted);
    _Queue.default.on('jobFailed', onJobFailed);
    _Queue.default.on('jobSucceeded', onJobSucceeded);
    _Queue.default.on('jobDeleted', onJobSucceeded);

    // Cleanup
    return () => {
      _Queue.default.off('jobAdded', onJobAdded);
      _Queue.default.off('jobStarted', onJobStarted);
      _Queue.default.off('jobFailed', onJobFailed);
      _Queue.default.off('jobSucceeded', onJobSucceeded);
      _Queue.default.off('jobDeleted', onJobDeleted);
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