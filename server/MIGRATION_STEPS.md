# Database Migration Steps

## ✅ Step 1: Prisma Client Generated
You've completed this step! Prisma Client is now generated.

## Step 2: Run Database Migration

Now you need to create the database tables. Run:

```bash
npm run prisma:migrate
```

This will:
- Create all tables in your MySQL database
- Apply the schema from `prisma/schema.prisma`
- Create a migration history

**When prompted for a migration name, you can use:**
- `init` or `initial_schema` or just press Enter for the default name

## Step 3: Verify Migration

After migration completes, you can:

1. **Check migration status:**
   ```bash
   npx prisma migrate status
   ```

2. **Open Prisma Studio to view your database:**
   ```bash
   npm run prisma:studio
   ```
   This opens a web interface at `http://localhost:5555`

## Step 4: Start Your Server

Once migrations are complete, start your server:

```bash
npm run dev
```

## Troubleshooting

### If migration fails:

1. **Make sure MySQL is running**
2. **Check your `.env` file has correct `DATABASE_URL`**
3. **Verify database exists:**
   ```sql
   CREATE DATABASE mediping_db;
   ```

### If you need to reset (WARNING: deletes all data):
```bash
npx prisma migrate reset
```

