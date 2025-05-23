import { appSchema, tableSchema } from '@nozbe/watermelondb/Schema';

export const myAppSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'jobs',
      columns: [
        { name: 'id', type: 'string', isOptional: false }, // id is the default primary key and should not be indexed here as per WatermelonDB docs for `id`
        { name: 'worker_name', type: 'string', isOptional: false, isIndexed: true },
        { name: 'active', type: 'boolean', isOptional: false },
        { name: 'payload', type: 'string', isOptional: false },
        { name: 'meta_data', type: 'string', isOptional: false },
        { name: 'attempts', type: 'number', isOptional: false },
        { name: 'created', type: 'string', isOptional: false }, // WatermelonDB uses number for dates (timestamps)
        { name: 'status', type: 'string', isOptional: false },
        { name: 'failed', type: 'string', isOptional: true },
        { name: 'timeout', type: 'number', isOptional: false },
        { name: 'priority', type: 'number', isOptional: false },
        { name: 'is_deleted', type: 'boolean', isOptional: false },
      ],
    }),
  ],
});
