function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
export class JobStoreMock {
  constructor() {
    _defineProperty(this, "jobs", []);
  }
  addJob(job) {
    this.jobs.push(job);
    return new Promise(resolve => resolve());
  }
  getJobs() {
    return new Promise(resolve => resolve(this.jobs));
  }
  getJobsWithDeleted() {
    return new Promise(resolve => resolve(this.jobs));
  }
  getActiveMarkedJobs() {
    const filtered = this.jobs.filter(job => job.active === 1);
    return new Promise(resolve => resolve(filtered));
  }
  getNextJob() {
    // "SELECT * FROM job WHERE active == 0 AND failed == '' ORDER BY priority,datetime(created) LIMIT 1"
    const filtered = this.jobs.filter(job => job.active === 0 && job.failed === '');
    const sorted = this.sortJobs(filtered);
    return new Promise(resolve => resolve(sorted[0] || {}));
  }
  getWorkInProgressJob() {
    // "SELECT * FROM job WHERE active == 0 AND failed == '' ORDER BY priority,datetime(created) LIMIT 1"
    const filtered = this.jobs.filter(job => job.active === 1 && job.status === 'processing');
    const sorted = this.sortJobs(filtered);
    return new Promise(resolve => resolve(sorted[0] || {}));
  }
  getJobsForWorker(name, count) {
    const filtered = this.jobs.filter(job => job.workerName === name);
    const sorted = this.sortJobs(filtered);
    return new Promise(resolve => resolve(sorted.slice(0, count)));
  }
  getJobsForWorkerWithDeleted(name, count) {
    const filtered = this.jobs.filter(job => job.workerName === name);
    const sorted = this.sortJobs(filtered);
    return new Promise(resolve => resolve(sorted.slice(0, count)));
  }
  updateJob(rawJob) {
    this.jobs = this.jobs.map(job => {
      if (rawJob.id === job.id) {
        return rawJob;
      }
      return job;
    });
  }
  removeJob(rawJob) {
    this.jobs = this.jobs.filter(job => job.id !== rawJob.id);
  }
  removeJobPermanently(rawJob) {
    this.jobs = this.jobs.filter(job => job.id !== rawJob.id);
  }
  removeJobsByWorkerName(workerName) {
    this.jobs = this.jobs.filter(job => job.workerName !== workerName);
  }
  deleteAllJobs() {
    this.jobs = [];
    return new Promise(resolve => resolve());
  }
  sortJobs(jobs) {
    // Sort by date ascending
    const sortByDate = jobs.sort((a, b) => {
      if (new Date(a.created).getTime() > new Date(b.created).getTime()) {
        return -1;
      }
      return 1;
    });
    // Then, sort by priority descending
    const sortByPriority = sortByDate.sort((a, b) => {
      if (a.priority > b.priority) {
        return -1;
      }
      return 1;
    });
    return sortByPriority;
  }
}
//# sourceMappingURL=JobQueueMock.js.map