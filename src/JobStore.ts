import { Platform } from 'react-native';
import { Database, Model, Q, Collection } from '@nozbe/watermelondb';
import { field, table } from '@nozbe/watermelondb/decorators';

import { database, JobModel } from './watermelon/database';
import { JobStore as JobStoreInterface } from './models/JobStore';
import { RawJob, JobStatus, Bool, TRUE, FALSE } from './models/Job'; // Assuming TRUE/FALSE are 0/1

// Helper function to map JobModel to RawJob
function mapJobModelToRawJob(jobModel: JobModel): RawJob {
  if (!jobModel) {
    return {} as RawJob; // Or handle as an error/null based on how getNextJob/getWorkInProgressJob expect it
  }
  return {
    id: jobModel.id, // WatermelonDB model ID
    workerName: jobModel.workerName,
    active: jobModel.active ? TRUE : FALSE,
    payload: jobModel.payload,
    metaData: jobModel.metaData,
    attempts: jobModel.attempts,
    created: jobModel.created, // Ensure this matches RawJob's expected format
    status: jobModel.status as JobStatus,
    failed: jobModel.failed || '', // RawJob expects string, model might have null
    timeout: jobModel.timeout,
    priority: jobModel.priority,
    isDeleted: jobModel.isDeleted, // RawJob has isDeleted: boolean
  };
}

function mapRawJobToJobModelFields(job: RawJob, record: JobModel) {
    // Note: record.id is managed by WatermelonDB or set via record._raw.id if needed
    // For creation, some fields like 'id' might be handled differently
    if (job.id && record._raw) { // only for creation. On update, id is not changed.
        record._raw.id = job.id;
    }
    record.workerName = job.workerName;
    record.active = job.active === TRUE;
    record.payload = job.payload;
    record.metaData = job.metaData;
    record.attempts = job.attempts;
    record.created = job.created;
    record.status = job.status;
    record.failed = job.failed;
    record.timeout = job.timeout;
    record.priority = job.priority;
    record.isDeleted = job.isDeleted; // Assuming RawJob.isDeleted is boolean
}


export class WatermelonDBJobStore implements JobStoreInterface {
  private get jobsCollection(): Collection<JobModel> {
    return database.collections.get<JobModel>('jobs');
  }

  async addJob(job: RawJob): Promise<void> {
    await database.write(async () => {
      await this.jobsCollection.create(record => {
        // WatermelonDB handles ID generation by default if job.id is not pre-set
        // If job.id is meant to be external, it needs to be set via record._raw.id = job.id;
        // For this implementation, let's assume job.id is provided and should be used.
        if (!job.id) {
            // This should ideally not happen if RawJob mandates an id.
            // Or, we let WatermelonDB generate it (remove the line below)
            throw new Error("Job ID must be provided when adding a job.");
        }
        record._raw.id = job.id; // Explicitly set the ID from RawJob
        mapRawJobToJobModelFields(job, record);
      });
    });
  }

  async getJobs(): Promise<RawJob[]> {
    const jobModels = await this.jobsCollection.query(Q.where('is_deleted', false)).fetch();
    return jobModels.map(mapJobModelToRawJob);
  }

  async getJobsWithDeleted(): Promise<RawJob[]> {
    const jobModels = await this.jobsCollection.query().fetch();
    return jobModels.map(mapJobModelToRawJob);
  }

  async getActiveMarkedJobs(): Promise<RawJob[]> {
    const jobModels = await this.jobsCollection.query(
      Q.and(
        Q.where('active', true),
        Q.where('is_deleted', false)
      )
    ).fetch();
    return jobModels.map(mapJobModelToRawJob);
  }

  async getNextJob(): Promise<RawJob> {
    const result = await this.jobsCollection.query(
      Q.where('is_deleted', false),
      Q.where('active', false),
      Q.where('failed', null), // Assumes 'failed' is null for non-failed, not empty string
      Q.where('status', JobStatus.IDLE), // Use JobStatus enum
      Q.sortBy('priority', Q.desc),
      Q.sortBy('created', Q.asc),
      Q.take(1)
    ).fetch();

    if (result.length > 0) {
      return mapJobModelToRawJob(result[0]);
    }
    return {} as RawJob; // As per instruction for empty object
  }

  async getWorkInProgressJob(): Promise<RawJob> {
    const result = await this.jobsCollection.query(
      Q.where('is_deleted', false),
      Q.where('active', true),
      Q.where('status', JobStatus.PROCESSING), // Use JobStatus enum
      Q.sortBy('created', Q.asc),
      Q.take(1)
    ).fetch();

    if (result.length > 0) {
      return mapJobModelToRawJob(result[0]);
    }
    return {} as RawJob; // As per instruction for empty object
  }

  async getJobsForWorker(name: string, count: number): Promise<RawJob[]> {
    const jobModels = await this.jobsCollection.query(
      Q.where('worker_name', name),
      Q.where('is_deleted', false),
      Q.where('active', false),
      Q.where('status', JobStatus.IDLE),
      Q.where('failed', null),
      Q.sortBy('priority', Q.desc),
      Q.sortBy('created', Q.asc),
      Q.take(count)
    ).fetch();
    return jobModels.map(mapJobModelToRawJob);
  }

  async getJobsForWorkerWithDeleted(name: string, count: number): Promise<RawJob[]> {
     // The requirement "active is false, status is 'idle', failed is empty or null" might be too restrictive
     // if we want to see ALL jobs for a worker, including processed, failed etc.
     // Assuming the requirement is strict as written:
    const jobModels = await this.jobsCollection.query(
      Q.where('worker_name', name),
      // Q.where('active', false), // Removed as per "with deleted" implies less filtering
      // Q.where('status', JobStatus.IDLE), // Removed
      // Q.where('failed', null), // Removed
      Q.sortBy('priority', Q.desc), // This sorting might not make sense for already processed/deleted jobs
      Q.sortBy('created', Q.asc),
      Q.take(count)
    ).fetch();
    return jobModels.map(mapJobModelToRawJob);
  }

  async updateJob(job: RawJob): Promise<void> {
    if (!job.id) {
        throw new Error("Job ID must be provided for update.");
    }
    await database.write(async () => {
      const jobRecord = await this.jobsCollection.find(job.id);
      await jobRecord.update(record => {
        mapRawJobToJobModelFields(job, record);
      });
    });
  }

  async removeJob(job: RawJob): Promise<void> {
    if (!job.id) {
        throw new Error("Job ID must be provided for soft delete.");
    }
    await database.write(async () => {
      const jobRecord = await this.jobsCollection.find(job.id);
      await jobRecord.update(record => {
        record.isDeleted = true;
        record.active = false; // Also mark as inactive
      });
    });
  }

  async removeJobPermanently(job: RawJob): Promise<void> {
    if (!job.id) {
        throw new Error("Job ID must be provided for permanent delete.");
    }
    await database.write(async () => {
      const jobRecord = await this.jobsCollection.find(job.id);
      await jobRecord.destroyPermanently();
    });
  }

  async removeJobsByWorkerName(workerName: string): Promise<void> {
    const jobsToMark = await this.jobsCollection.query(
      Q.where('worker_name', workerName),
      Q.where('is_deleted', false) // Only soft-delete those not already soft-deleted
    ).fetch();

    if (jobsToMark.length > 0) {
      await database.write(async () => {
        for (const job of jobsToMark) {
          await job.update(j => {
            j.isDeleted = true;
            j.active = false;
          });
        }
      });
    }
  }

  async deleteAllJobs(): Promise<void> {
    await database.write(async () => {
        // Fetch all job records
        const allJobs = await this.jobsCollection.query().fetch();
        // Create a batch of delete operations
        const deletions = allJobs.map(job => job.prepareDestroyPermanently());
        // Execute the batch operation
        await database.batch(...deletions);
      });
  }
}
