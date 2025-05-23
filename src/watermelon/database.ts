import { Platform } from 'react-native';
import { Database, Model } from '@nozbe/watermelondb';
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite';
import { field, table } from '@nozbe/watermelondb/decorators';

import { myAppSchema } from './schema';

// Define the JobModel
@table('jobs')
export class JobModel extends Model {
  static table = 'jobs'; // WatermelonDB static table name

  @field('worker_name') workerName!: string;
  @field('active') active!: boolean;
  @field('payload') payload!: string;
  @field('meta_data') metaData!: string;
  @field('attempts') attempts!: number;
  @field('created') created!: string; // Consider number for actual timestamp storage
  @field('status') status!: string;
  @field('failed') failed?: string | null; // Optional field
  @field('timeout') timeout!: number;
  @field('priority') priority!: number;
  @field('is_deleted') isDeleted!: boolean;
}

// Configure the adapter
const adapter = new SQLiteAdapter({
  schema: myAppSchema,
  jsi: Platform.OS === 'ios', // JSI is only available on iOS in some RN versions, might need to check compatibility or use false for broader compatibility initially
  dbName: 'JobQueue',
  onSetUpError: error => {
    // It's crucial to handle database setup errors
    // For example, log to a monitoring service or display an alert
    console.error("Failed to set up WatermelonDB:", error);
    // Depending on the app, you might want to throw the error,
    // or attempt a recovery/reset, or inform the user.
  },
});

// Create and export the database instance
export const database = new Database({
  adapter,
  modelClasses: [
    JobModel,
    // Add other models here if you have more
  ],
});
