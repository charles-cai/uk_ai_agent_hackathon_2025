import type { Config } from 'drizzle-kit';

export default {
  schema: './lib/db/schema.ts', // Path to your database schema
  out: './lib/db/migrations', // Directory for generated migrations
  dialect: 'sqlite', // Correct dialect for SQLite
  dbCredentials: {
    url: './data.db', // Path to your SQLite database file
  },
} satisfies Config;