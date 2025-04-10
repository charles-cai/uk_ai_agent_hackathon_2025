# mesu-ai

Book catalogue for Fan Fiction - UI/UX by Mariya


The code runs locally.  For your reference, the site is run no Next.js with SQLITE as database.
Please use the following commands to deploy:

1. Install Drizzle ORM with SQLite
```shell
npm install drizzle-orm better-sqlite3
npm install -D drizzle-kit
```
2. Install Next.js
```shell
npm install next react react-dom
```

(NOTE: You might need to add the dependency --legacy-peer-deps at the end of each of the above commands, i.e. npm install drizzle-orm better-sqlite3 --legacy-peer-deps)

3. Generate 
```shell
npx drizzle-kit generate
```
4. Create database tables
```shell
npx tsx lib/db/create-tables.ts 
```

5. Seed tables
```shell
npm run db:seed-authors
npm run db:seed-books
npm run db:seed-thumbhash
```

6. Run the site:
```shell
npm run dev
```
