import { Model } from '@nozbe/watermelondb'
import { field, text } from '@nozbe/watermelondb/decorators'

export default class Job extends Model {
  static table = 'jobs' // Corresponds to the table name in schema.ts

  @text('worker_name') workerName!: string
  @field('active') active!: boolean
  @text('payload') payload?: string
  @text('meta_data') metaData?: string
  @field('attempts') attempts!: number
  @field('created_at') createdAt!: number
  @field('failed_at') failedAt?: number
  @field('timeout') timeout!: number
  @field('priority') priority!: number
  @field('is_deleted') isDeleted!: boolean
  @text('status') status?: string

  // Associations and custom actions can be added here in the future
}
