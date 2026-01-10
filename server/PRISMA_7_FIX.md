# Prisma 7 Configuration Fix

Prisma 7 has changed how database connections are configured. The connection URL is no longer in the schema file.

## Updated Files

1. **`prisma/schema.prisma`** - Removed `url` from datasource
2. **`config/database.js`** - Added connection URL to PrismaClient constructor

## Try Running Again

```bash
npm run prisma:generate
```

If you still get errors, try this alternative approach:

### Alternative: Use connection string directly

If the adapter approach doesn't work, you can try passing the connection string as an environment variable that Prisma will pick up automatically, or use:

```javascript
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: config.DATABASE_URL,
    },
  },
});
```

Or simply:

```javascript
// Set DATABASE_URL as environment variable and Prisma will use it
process.env.DATABASE_URL = config.DATABASE_URL;
const prisma = new PrismaClient();
```

