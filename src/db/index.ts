import { Database } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'

import { myAppSchema } from './schema' // Assuming schema.ts exports myAppSchema
import Job from './JobModel' // Assuming JobModel.ts exports 'Job' as default

// Create an SQLite adapter
const adapter = new SQLiteAdapter({
  schema: myAppSchema,
  // jsi: true, // JSI is recommended for performance but can be problematic if native setup is incomplete.
              // Let's leave it commented out for now to ensure broader compatibility given
              // the previous issues with `pod install`. It can be enabled later if the native
              // side (especially JSI bindings for SQLite) is confirmed to be correctly set up.
  dbName: 'JobQueueDB', // Name of the database file
  // migrations, // Optional: if you have schema migrations
  // synchronous: true, // Optional: for synchronous mode (careful with performance)
  // onSetUpError: error => {
  //   // Database failed to load -- offer the user to reload the app or log out
  //   console.error("Failed to load database:", error);
  // }
})

// Create a database instance
const database = new Database({
  adapter,
  modelClasses: [Job],
})

export default database
