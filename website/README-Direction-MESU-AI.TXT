Hi Charles, 

The code runs locally.  For your reference, the site is run no Next.js with SQLITE as database.
Please use the following commands to deploy:
1. Install Drizzle ORM with SQLite
>> npm install drizzle-orm better-sqlite3
>> npm install -D drizzle-kit
2. Install Next.js
>> npm install next react react-dom

(NOTE: You might need to add the dependency --legacy-peer-deps at the end of each of the above commands, i.e. npm install drizzle-orm better-sqlite3 --legacy-peer-deps)

3. Generate 
>> npx drizzle-kit generate
4. Create database tables
>> npx tsx lib/db/create-tables.ts 

5. Seed tables
>> npm run db:seed-authors
>> npm run db:seed-books
>> npm run db:seed-thumbhash

6. Run the site:
>> npm run dev

Following the above steps should work. Please let me know if you have any difficulties, or suggestions on how to improve this process.

Best,
Mariya 