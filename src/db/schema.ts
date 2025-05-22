import { appSchema, tableSchema } from '@nozbe/watermelondb'

export const myAppSchema = appSchema({
  version: 1, // Database version
  tables: [
    tableSchema({
      name: 'jobs',
      columns: [
        { name: 'worker_name', type: 'string' },
        { name: 'active', type: 'boolean' },
        { name: 'payload', type: 'string', isOptional: true },
        { name: 'meta_data', type: 'string', isOptional: true },
        { name: 'attempts', type: 'number' },
        { name: 'created_at', type: 'number' }, // Corresponds to 'created' field
        { name: 'failed_at', type: 'number', isOptional: true }, // Corresponds to 'failed' field
        { name: 'timeout', type: 'number' },
        { name: 'priority', type: 'number' },
        { name: 'is_deleted', type: 'boolean' },
        { name: 'status', type: 'string', isOptional: true },
        // WatermelonDB automatically adds 'id' (string, primary key)
        // WatermelonDB automatically adds 'updated_at' (number, timestamp) if not defined
      ]
    }),
    // Define other tables here if needed in the future
  ]
})
