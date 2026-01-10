# Prisma Setup Guide

## Prerequisites

1. MySQL database must be running
2. Database must be created
3. `.env` file must be configured with `DATABASE_URL`

## Setup Steps

### 1. Configure Database URL in `.env`

Make sure your `server/.env` file has:

```env
DATABASE_URL="mysql://username:password@localhost:3306/mediping_db"
```

Replace:
- `username` with your MySQL username
- `password` with your MySQL password
- `localhost:3306` with your MySQL host and port (if different)
- `mediping_db` with your database name

### 2. Generate Prisma Client

```bash
cd server
npm run prisma:generate
```

This generates the Prisma Client based on your schema.

### 3. Run Database Migrations

```bash
npm run prisma:migrate
```

This will:
- Create all tables in your database
- Apply the schema from `prisma/schema.prisma`
- Create a migration history

**Note:** If you're asked for a migration name, you can use something like `init` or `initial_schema`

### 4. (Optional) Open Prisma Studio

To view and manage your database visually:

```bash
npm run prisma:studio
```

This opens a web interface at `http://localhost:5555` where you can view/edit your database.

## Common Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and apply migration
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio

# Reset database (WARNING: deletes all data)
npx prisma migrate reset

# View migration status
npx prisma migrate status
```

## Troubleshooting

### Error: Can't reach database server

- Make sure MySQL is running
- Check your `DATABASE_URL` in `.env`
- Verify database credentials

### Error: Database doesn't exist

Create the database first:
```sql
CREATE DATABASE mediping_db CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
```

### Error: Migration conflicts

If you have migration conflicts:
```bash
npx prisma migrate reset  # WARNING: This deletes all data
npm run prisma:migrate
```

## After Setup

Once migrations are complete, you can:
1. Start the server: `npm run dev`
2. Test the API endpoints
3. Use Prisma Studio to view your data

