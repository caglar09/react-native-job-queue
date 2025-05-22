import { JobStore } from './JobStore'
import { RawJob, Bool, TRUE, FALSE } from './Job' // Assuming Job.ts is in the same directory
import database from '../db' // Assuming db/index.ts exports the database instance
import JobModel from '../db/JobModel' // Alias JobModel to avoid confusion if RawJob was named Job
import { Q } from '@nozbe/watermelondb/QueryDescription'
// writer and reader decorators are typically used within Model classes,
// for a JobStore, direct database.write/read is more appropriate.

// Helper function to convert RawJob to an object suitable for WatermelonDB JobModel creation/update
function rawJobToModelPreparedObject(rawJob: RawJob): any {
  const modelObject: any = {
    // WatermelonDB ID is not set here, it's either auto-generated or found by query
    workerName: rawJob.workerName,
    active: rawJob.active === TRUE,
    payload: rawJob.payload,
    metaData: rawJob.metaData,
    attempts: rawJob.attempts,
    createdAt: new Date(rawJob.created).getTime(),
    failedAt: rawJob.failed ? new Date(rawJob.failed).getTime() : undefined,
    timeout: rawJob.timeout,
    priority: rawJob.priority,
    isDeleted: rawJob.isDeleted,
    status: rawJob.status,
    // If rawJob.id needs to be stored, and it's different from WDB's id,
    // a field like 'originalJobId' should be in the schema and model.
    // For now, we assume rawJob.id might be used to find existing records for update/delete,
    // but not as the primary key for creation if WDB auto-generates IDs.
  };
  // WatermelonDB expects 'id' to be undefined for creation if it's auto-generated.
  // If rawJob.id IS meant to be the WDB id, this is more complex and needs adapter setup.
  // For now, let's assume WDB generates its own ID.
  return modelObject;
}

// Helper function to convert JobModel instance to RawJob
function modelToRawJob(jobModel: JobModel): RawJob {
  return {
    id: jobModel.id, // This is WatermelonDB's ID.
    workerName: jobModel.workerName,
    active: jobModel.active ? TRUE : FALSE,
    payload: jobModel.payload || '', // Ensure payload is string, not undefined
    metaData: jobModel.metaData || '', // Ensure metaData is string, not undefined
    attempts: jobModel.attempts,
    created: new Date(jobModel.createdAt).toISOString(),
    failed: jobModel.failedAt ? new Date(jobModel.failedAt).toISOString() : '',
    timeout: jobModel.timeout,
    priority: jobModel.priority,
    isDeleted: jobModel.isDeleted,
    status: jobModel.status || '', // Ensure status is string, not undefined
  };
}

export class WatermelonDBJobStore implements JobStore {
  public async addJob(job: RawJob): Promise<void> {
    try {
      await database.write(async () => {
        const jobsCollection = database.collections.get<JobModel>('jobs');
        const preparedObject = rawJobToModelPreparedObject(job);
        // Note: We are not setting `id` here, allowing WatermelonDB to generate it.
        // If job.id from RawJob needs to be used as the primary key, this is a different setup.
        await jobsCollection.create(newJob => {
          Object.assign(newJob, preparedObject);
          // If job.id from RawJob needs to be stored as a separate field:
          // (newJob as any).originalJobId = job.id; // Requires schema/model update
        });
      });
    } catch (error) {
      console.error('Error adding job to WatermelonDB:', error);
      // The interface returns void, so we can't propagate Promise.reject easily.
      // Consider if error handling strategy needs to change (e.g., custom Error, or interface returns Promise<Result>)
    }
  }

  public async getJobs(): Promise<RawJob[]> {
    try {
      const jobModels = await database.read(async () => {
        return database.collections.get<JobModel>('jobs')
          .query(
            Q.where('is_deleted', false),
            Q.sortBy('priority', Q.desc),
            Q.sortBy('created_at', Q.asc)
          ).fetch();
      });
      return jobModels.map(modelToRawJob);
    } catch (error) {
      console.error('Error getting jobs from WatermelonDB:', error);
      return []; // Return empty array on error as per common practice, though interface might imply error throw
    }
  }

  public async getJobsWithDeleted(): Promise<RawJob[]> {
    try {
      const jobModels = await database.read(async () => {
        return database.collections.get<JobModel>('jobs')
          .query(
            Q.sortBy('priority', Q.desc),
            Q.sortBy('created_at', Q.asc)
          ).fetch();
      });
      return jobModels.map(modelToRawJob);
    } catch (error) {
      console.error('Error getting jobs (with deleted) from WatermelonDB:', error);
      return [];
    }
  }

  public async getActiveMarkedJobs(): Promise<RawJob[]> {
    try {
      const jobModels = await database.read(async () => {
        return database.collections.get<JobModel>('jobs')
          .query(
            Q.where('active', true),
            Q.where('is_deleted', false)
          ).fetch();
      });
      return jobModels.map(modelToRawJob);
    } catch (error)
      console.error('Error getting active marked jobs from WatermelonDB:', error);
      return [];
    }
  }

  public async getNextJob(): Promise<RawJob> {
    try {
      const results = await database.read(async () => {
        return database.collections.get<JobModel>('jobs')
          .query(
            Q.where('active', false),
            Q.where('status', Q.notEq('failed')),
            Q.where('status', Q.notEq('cancelled')),
            Q.where('is_deleted', false),
            Q.sortBy('priority', Q.desc),
            Q.sortBy('created_at', Q.asc),
            Q.take(1)
          ).fetch();
      });
      if (results.length > 0) {
        return modelToRawJob(results[0]);
      }
      // The interface expects RawJob, not RawJob | null.
      // This will be an issue if no job is found.
      // Returning an empty/default RawJob or throwing an error are options.
      // For now, I'll throw, as returning a "null" RawJob is tricky.
      throw new Error('No next job found');
    } catch (error) {
      console.error('Error getting next job from WatermelonDB:', error);
      // Propagate error or handle as per chosen strategy for "no job found"
      throw error;
    }
  }

  public async getWorkInProgressJob(): Promise<RawJob> {
    try {
      const results = await database.read(async () => {
        return database.collections.get<JobModel>('jobs')
          .query(
            Q.where('active', false), // Original logic might be: active IS true if it's WIP
                                      // but current query says active IS false AND status is 'processing'
                                      // This seems contradictory. Assuming 'active' means "currently being processed by a worker".
                                      // If 'active' means "eligible to be picked up", then status 'processing' implies it's active.
                                      // Let's stick to the provided query for now: active = false, status = 'processing'
            Q.where('status', 'processing'),
            Q.where('is_deleted', false),
            Q.sortBy('priority', Q.desc),
            Q.sortBy('created_at', Q.asc),
            Q.take(1)
          ).fetch();
      });
      if (results.length > 0) {
        return modelToRawJob(results[0]);
      }
      throw new Error('No work in progress job found');
    } catch (error) {
      console.error('Error getting work in progress job from WatermelonDB:', error);
      throw error;
    }
  }

  public async getJobsForWorker(name: string, count: number): Promise<RawJob[]> {
    let jobModels: JobModel[] = [];
    try {
      await database.write(async transaction => { // Use transaction for read-then-write
        const rawJobModels = await database.collections.get<JobModel>('jobs')
          .query(
            Q.where('worker_name', name),
            Q.where('active', false),
            Q.where('status', Q.notEq('failed')),
            Q.where('status', Q.notEq('cancelled')),
            Q.where('is_deleted', false),
            Q.sortBy('priority', Q.desc),
            Q.sortBy('created_at', Q.asc),
            Q.take(count)
          ).fetch();

        // Mark fetched jobs as active
        for (const model of rawJobModels) {
          // Using .prepareUpdate() and then batching might be more performant
          // but direct update within the transaction is also fine.
          await model.update(jobToUpdate => {
            jobToUpdate.active = true;
          });
        }
        jobModels = rawJobModels; // Assign to outer scope variable
      });
      return jobModels.map(modelToRawJob);
    } catch (error) {
      console.error('Error getting jobs for worker from WatermelonDB:', error);
      return [];
    }
  }

  public async getJobsForWorkerWithDeleted(name:string, count: number): Promise<RawJob[]> {
    let jobModels: JobModel[] = [];
    try {
      await database.write(async transaction => {
        const rawJobModels = await database.collections.get<JobModel>('jobs')
          .query(
            Q.where('worker_name', name),
            Q.where('active', false), // Original native code also had this 'active = false' condition
            Q.sortBy('priority', Q.desc),
            Q.sortBy('created_at', Q.asc),
            Q.take(count)
          ).fetch();

        for (const model of rawJobModels) {
          await model.update(jobToUpdate => {
            jobToUpdate.active = true;
          });
        }
        jobModels = rawJobModels;
      });
      return jobModels.map(modelToRawJob);
    } catch (error) {
      console.error('Error getting jobs for worker (with deleted) from WatermelonDB:', error);
      return [];
    }
  }

  // For updateJob, removeJob, removeJobPermanently, and removeJobsByWorkerName,
  // the crucial part is how to find the JobModel using RawJob.id.
  // Assuming RawJob.id IS the WatermelonDB ID for these operations.
  // If not, these methods will fail or act on wrong records.

  public async updateJob(job: RawJob): Promise<void> { // Interface returns void, but this is async
    try {
      await database.write(async () => {
        const jobsCollection = database.collections.get<JobModel>('jobs');
        // This assumes job.id is the WatermelonDB record ID.
        const jobToUpdate = await jobsCollection.find(job.id); 
        const preparedChanges = rawJobToModelPreparedObject(job);
        delete preparedChanges.createdAt; // Should not update createdAt on existing job usually
                                        // also WDB manages its own 'updated_at'

        await jobToUpdate.update(record => {
          Object.assign(record, preparedChanges);
        });
      });
    } catch (error) {
      console.error(`Error updating job ${job.id} in WatermelonDB:`, error);
      // throw error; // Or handle as per error strategy
    }
  }

  public async removeJob(job: RawJob): Promise<void> { // Soft delete
    try {
      await database.write(async () => {
        const jobsCollection = database.collections.get<JobModel>('jobs');
        const jobToRemove = await jobsCollection.find(job.id); // Assumes job.id is WDB ID
        await jobToRemove.update(record => {
          record.isDeleted = true;
        });
      });
    } catch (error) {
      console.error(`Error soft-deleting job ${job.id} in WatermelonDB:`, error);
      // throw error;
    }
  }

  public async removeJobPermanently(job: RawJob): Promise<void> {
    try {
      await database.write(async () => {
        const jobsCollection = database.collections.get<JobModel>('jobs');
        const jobToDestroy = await jobsCollection.find(job.id); // Assumes job.id is WDB ID
        await jobToDestroy.destroyPermanently();
      });
    } catch (error) {
      console.error(`Error permanently deleting job ${job.id} in WatermelonDB:`, error);
      // throw error;
    }
  }

  public async removeJobsByWorkerName(workerName: string): Promise<void> { // Soft delete
    try {
      await database.write(async () => {
        const jobsCollection = database.collections.get<JobModel>('jobs');
        const jobsToRemove = await jobsCollection.query(Q.where('worker_name', workerName)).fetch();
        
        const updates = jobsToRemove.map(job => 
          job.prepareUpdate(record => {
            record.isDeleted = true;
          })
        );
        await database.batch(...updates);
      });
    } catch (error) {
      console.error(`Error soft-deleting jobs for worker ${workerName} in WatermelonDB:`, error);
      // throw error;
    }
  }

  public async deleteAllJobs(): Promise<void> { // Hard delete all
    try {
      await database.write(async () => {
        const jobsCollection = database.collections.get<JobModel>('jobs');
        const allJobs = await jobsCollection.query().fetch();
        
        const deletions = allJobs.map(job => job.prepareDestroyPermanently());
        await database.batch(...deletions);
      });
    } catch (error) {
      console.error('Error deleting all jobs from WatermelonDB:', error);
      // throw error;
    }
  }
}
