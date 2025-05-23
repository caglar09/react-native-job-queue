import { Job } from '../models/Job';
import queue from '../Queue';
import { Worker, CANCEL, CancellablePromise } from '../Worker';

export interface Payload {
    test: string;
}

describe('Queue Basics', () => {
    beforeEach(() => {
        queue.removeWorker('testWorker', true);
        queue.configure({});
    });
    it('add Workers', () => {
        queue.addWorker(new Worker<Payload>('testWorker', async (payload: Payload) => {}));
        const workers = queue.registeredWorkers;
        const workerNames = Object.keys(workers);
        expect(workerNames.length).toEqual(1);
        expect(workerNames[0]).toEqual('testWorker');
    });
    it('add Job for invalid Worker', () => {
        queue.addWorker(new Worker<Payload>('testWorker', async (payload: Payload) => {}));
        expect(() => queue.addJob('wrongWorker', {})).toThrowError('Missing worker with name wrongWorker');
    });

    it('run queue', (done) => {
        const executer = async (payload: Payload) => {
            done();
        };
        queue.addWorker(new Worker<Payload>('testWorker', executer));
        queue.addJob('testWorker', {});
    });

    /**
     * This test will add two jobs to the queue in the order "1", "priority_id" and won't
     * start the queue automatically.
     * The job with "priority_id" has a priority of 100, while the other has one of 0.
     * It is expected that the queue executes the job with the highest priority first when the queue is started,
     * so that the oder of the executed jobs is "priority_id", "1".
     */
    it('handle priority correctly', (done) => {
        const calledOrder: string[] = [];
        const expectedCallOrder = ['priority_id', '1'];

        function evaluateTest() {
            expect(calledOrder).toEqual(expectedCallOrder);
            done();
        }

        const executer = async (payload: Payload) => {
            calledOrder.push(payload.test);

            // evaluate test when both jobs have been executed
            if (calledOrder.length >= 2) {
                // used setTimeout as a workaround
                setTimeout(evaluateTest, 0);
            }
        };
        queue.addWorker(new Worker<Payload>('testWorker', executer, { concurrency: 1 }));
        queue.addJob('testWorker', { test: '1' }, { attempts: 0, timeout: 0, priority: 0 }, false);
        queue.addJob('testWorker', { test: 'priority_id' }, { priority: 100, attempts: 0, timeout: 0 }, false);
        queue.start();
    });
    it('handle job canceling', (done) => {
        const calledOrder: string[] = [];
        const expectedCallOrder = ['failed', 'completed'];

        queue.addWorker(
            new Worker<Payload>(
                'testWorker',
                (payload) => {
                    let cancel;
                    const promise: CancellablePromise<any> = new Promise((resolve, reject) => {
                        const timeout = setTimeout(() => {
                            resolve(true);
                        }, 100);

                        cancel = () => {
                            clearTimeout(timeout);
                            reject({ message: 'canceled' });
                        };
                    });

                    promise[CANCEL] = cancel;
                    return promise;
                },
                {
                    onStart: ({ id }) => {
                        /* cancel the job after 1sec */
                        setTimeout(() => {
                            queue.cancelJob(id, new Error('canceled'));
                        }, 50);
                    },
                    onFailure: (_, error) => {
                        calledOrder.push('failed');
                        expect(error).toHaveProperty('message', 'canceled');
                        done();
                    },
                    onCompletion: () => {
                        calledOrder.push('completed');
                        expect(calledOrder).toEqual(expectedCallOrder);
                        done();
                    },
                }
            )
        );
        queue.addJob('testWorker', { test: '1' }, { attempts: 0, timeout: 0, priority: 0 });
        queue.start();
    });
    it('handle attempts correctly', (done) => {
        const onQueueFinish = () => {
            expect(executer).toBeCalledTimes(5);
            done();
        };
        const executer = jest.fn(() => {
            throw new Error();
        });
        queue.configure({ onQueueFinish: onQueueFinish });
        queue.addWorker(new Worker<Payload>('testWorker', executer, { concurrency: 1 }));
        queue.addJob('testWorker', { test: '1' }, { attempts: 5, timeout: 0, priority: 0 }, false);
        queue.start();
    });
    it('handle timeouts correctly', (done) => {
        const onQueueFinish = () => {
            expect(executer).toBeCalledTimes(1);
        };
        const onError = (job: Job<Payload>, error: Error) => {
            expect(error).toEqual(new Error(`Job ${job.id} timed out`));
            done();
        };
        const executer = jest.fn(
            () =>
                new Promise((resolve, reject) => {
                    setTimeout(() => {
                        resolve(true);
                    }, 100);
                })
        );
        queue.configure({ onQueueFinish: onQueueFinish });
        queue.addWorker(new Worker<Payload>('testWorker', executer, { concurrency: 1, onFailure: onError }));
        queue.addJob('testWorker', { test: '1' }, { attempts: 0, timeout: 5, priority: 0 }, false);
        queue.start();
    });
    it('trigger onFailure', (done) => {
        const executer = async () => {
            throw new Error('This is an error');
        };
        const onFailure = (job: Job<Payload>, _: Error) => {
            try {
                expect(job.failed).not.toEqual('');
                done();
            } catch (error) {
                done(error);
            }
        };
        queue.addWorker(new Worker<Payload>('testWorker', executer, { concurrency: 1, onFailure }));
        queue.addJob('testWorker', { test: '1' }, { attempts: 0, timeout: 5, priority: 0 }, false);
        queue.start();
    });
});

describe('Queue Logging', () => {
    let consoleLogSpy: jest.SpyInstance;

    beforeEach(() => {
        // Mock console.log before each test
        consoleLogSpy = jest.spyOn(console, 'log').mockImplementation(() => {});
        // Ensure a clean state for the queue's workers and configuration for each test
        // Note: This assumes 'queue' is a singleton and its state persists.
        // We might need a more robust way to reset the queue or use a fresh instance if tests interfere.
        // For now, removing workers and re-configuring is a common pattern in this file.
        Object.keys(queue.registeredWorkers).forEach(workerName => {
            queue.removeWorker(workerName, true); // true to delete related jobs
        });
        queue.configure({}); // Reset to default configuration
    });

    afterEach(() => {
        // Restore console.log after each test
        consoleLogSpy.mockRestore();
    });

    it('should log when a job is added and debug is true', () => {
        queue.configure({ debug: true });
        queue.addWorker(new Worker('logTestWorker', async () => {}));
        const jobId = queue.addJob('logTestWorker', { test: 'payload' });
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Job added: ${jobId}`));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`workerName: logTestWorker`));
    });

    it('should NOT log when a job is added and debug is false', () => {
        queue.configure({ debug: false });
        queue.addWorker(new Worker('logTestWorkerNoDebug', async () => {}));
        queue.addJob('logTestWorkerNoDebug', { test: 'payload' });
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should NOT log when a job is added and debug is not set (default)', () => {
        // queue.configure({}); // Default configuration done in beforeEach
        queue.addWorker(new Worker('logTestWorkerDefault', async () => {}));
        queue.addJob('logTestWorkerDefault', { test: 'payload' });
        expect(consoleLogSpy).not.toHaveBeenCalled();
    });

    it('should log when a worker is added and debug is true', () => {
        queue.configure({ debug: true });
        queue.addWorker(new Worker('logTestWorkerAdd', async () => {}));
        expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Worker added: logTestWorkerAdd'));
    });

    it('should log when queue is started and debug is true', () => {
        queue.configure({ debug: true });
        queue.start();
        expect(consoleLogSpy).toHaveBeenCalledWith('Queue started.');
    });

    it('should log when queue is stopped and debug is true', () => {
        queue.configure({ debug: true });
        queue.start(); // Start first, then stop
        consoleLogSpy.mockClear(); // Clear logs from start
        queue.stop();
        expect(consoleLogSpy).toHaveBeenCalledWith('Queue stopped.');
    });

    it('should log job lifecycle events when debug is true', (done) => {
        queue.configure({ debug: true });
        const workerName = 'logLifecycleWorker';
        const jobPayload = { message: 'run job' };
        let jobId: string;

        queue.addWorker(new Worker(workerName, async (payload) => {
            // Simulate work
            return new Promise(resolve => setTimeout(() => resolve(payload), 10));
        }));

        // Listen for job success to perform assertions
        queue.on('jobSucceeded', (job) => {
            if (job.id === jobId) {
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Job started: ${jobId}`));
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`workerName: ${workerName}`));
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Job succeeded: ${jobId}`));
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Job completed: ${jobId}`));
                done();
            }
        });
        
        jobId = queue.addJob(workerName, jobPayload);
        // Logs from addJob and addWorker will also be present, which is fine.
    });

    it('should log job failure events when debug is true', (done) => {
        queue.configure({ debug: true });
        const workerName = 'logFailedJobWorker';
        const jobPayload = { message: 'fail this job' };
        let jobId: string;

        queue.addWorker(new Worker(workerName, async (payload) => {
            throw new Error('Simulated job failure');
        }, {
            // Suppress ExitWithCode:1 error in console by handling failure via event
            onFailure: () => {} 
        }));
        
        queue.on('jobFailed', (job, error) => {
            if (job.id === jobId) {
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Job started: ${jobId}`));
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Job failed: ${jobId}`));
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining('Simulated job failure'));
                expect(consoleLogSpy).toHaveBeenCalledWith(expect.stringContaining(`Job completed: ${jobId}`));
                done();
            }
        });

        jobId = queue.addJob(workerName, jobPayload, { attempts: 1 }); // Ensure it fails definitively
    });
});
