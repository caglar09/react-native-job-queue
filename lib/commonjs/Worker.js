"use strict";

Object.defineProperty(exports, "__esModule", {
  value: true
});
exports.Worker = exports.CANCEL = void 0;
var _reactNative = require("react-native");
function _defineProperty(e, r, t) { return (r = _toPropertyKey(r)) in e ? Object.defineProperty(e, r, { value: t, enumerable: !0, configurable: !0, writable: !0 }) : e[r] = t, e; }
function _toPropertyKey(t) { var i = _toPrimitive(t, "string"); return "symbol" == typeof i ? i : i + ""; }
function _toPrimitive(t, r) { if ("object" != typeof t || !t) return t; var e = t[Symbol.toPrimitive]; if (void 0 !== e) { var i = e.call(t, r || "default"); if ("object" != typeof i) return i; throw new TypeError("@@toPrimitive must return a primitive value."); } return ("string" === r ? String : Number)(t); }
const CANCEL = exports.CANCEL = 'rn_job_queue_cancel';
/**
 * @typeparam P specifies the Type of the Job-Payload.
 */
class Worker {
  /**
   *
   * @typeparam P specifies the type of the job-payload.
   * @param name of worker
   * @param executer function to run jobs
   * @param options to configure worker
   */
  constructor(name, executer, options = {}) {
    _defineProperty(this, "name", void 0);
    _defineProperty(this, "concurrency", void 0);
    _defineProperty(this, "executionCount", void 0);
    _defineProperty(this, "executer", void 0);
    _defineProperty(this, "onStart", void 0);
    _defineProperty(this, "onSuccess", void 0);
    _defineProperty(this, "onFailure", void 0);
    _defineProperty(this, "onCompletion", void 0);
    const {
      onStart = job => {},
      onSuccess = job => {},
      onFailure = (job, error) => {},
      onCompletion = job => {},
      concurrency = 5
    } = options;
    this.name = name;
    this.concurrency = concurrency;
    this.executionCount = 0;
    this.executer = executer;
    this.onStart = onStart;
    this.onSuccess = onSuccess;
    this.onFailure = onFailure;
    this.onCompletion = onCompletion;
  }

  /**
   * @returns true if worker runs max concurrent amout of jobs
   */
  get isBusy() {
    return this.executionCount === this.concurrency;
  }
  /**
   * @returns amount of available Executers for current worker
   */
  get availableExecuters() {
    return this.concurrency - this.executionCount;
  }
  /**
   * This method should not be invoked manually and is used by the queue to execute jobs
   * @param job to be executed
   */
  execute(rawJob) {
    const {
      timeout
    } = rawJob;
    const payload = JSON.parse(rawJob.payload);
    const job = {
      ...rawJob,
      ...{
        payload
      }
    };
    this.executionCount++;
    this.onStart(job);
    if (timeout > 0 && _reactNative.AppState.currentState === 'active') {
      return this.executeWithTimeout(job, timeout);
    } else {
      return this.executer(payload, job.id);
    }
  }
  executeWithTimeout(job, timeout) {
    let cancel;
    const promise = new Promise(async (resolve, reject) => {
      const timeoutPromise = new Promise((resolve, reject) => {
        setTimeout(() => {
          reject(new Error(`Job ${job.id} timed out`));
        }, timeout);
      });
      const executerPromise = this.executer(job.payload, job.id);
      if (executerPromise) {
        cancel = executerPromise[CANCEL];
        try {
          await Promise.race([timeoutPromise, executerPromise]);
          resolve(true);
        } catch (error) {
          // cancel task if has cancel method
          if (executerPromise[CANCEL] && typeof executerPromise[CANCEL] === 'function') {
            executerPromise[CANCEL]();
          }
          reject(error);
        }
      }
    });
    promise[CANCEL] = cancel;
    return promise;
  }
  triggerSuccess(job) {
    this.onSuccess(job);
  }
  triggerFailure(job, error) {
    this.onFailure(job, error);
  }
  triggerCompletion(job) {
    this.onCompletion(job);
  }
  decreaseExecutionCount() {
    this.executionCount--;
  }
}
exports.Worker = Worker;
//# sourceMappingURL=Worker.js.map