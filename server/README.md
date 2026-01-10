# MediPing Backend Server

Backend API server for MediPing medication reminder app.

## Tech Stack

- **Node.js** + **Express.js** - Server framework
- **Prisma** - ORM for database access
- **MySQL** - Database
- **JWT** - Authentication tokens
- **OAuth 2.0** - Google & Apple Sign In

## Setup Instructions

### 1. Install Dependencies

```bash
cd server
npm install
```

### 2. Database Setup

1. Create a MySQL database:
```sql
CREATE DATABASE mediping_db;
```

2. Update `.env` file with your database connection:
```env
DATABASE_URL="mysql://username:password@localhost:3306/mediping_db"
```

3. Generate Prisma Client:
```bash
npm run prisma:generate
```

4. Run database migrations:
```bash
npm run prisma:migrate
```

### 3. Environment Variables

Create a `.env` file in the `server` directory:

```env
# Server Configuration
PORT=3000
NODE_ENV=development

# Database (MySQL)
DATABASE_URL="mysql://user:password@localhost:3306/mediping_db"

# JWT
JWT_SECRET=your-super-secret-jwt-key-change-in-production
JWT_EXPIRES_IN=7d

# Google OAuth
GOOGLE_CLIENT_ID=your-google-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-google-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# Apple OAuth
APPLE_CLIENT_ID=com.mediping.app
APPLE_TEAM_ID=your-team-id
APPLE_KEY_ID=your-key-id
APPLE_PRIVATE_KEY=-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----
APPLE_REDIRECT_URI=http://localhost:3000/oauth/callback

# App Deep Link
APP_DEEP_LINK_SCHEME=mediping://oauth/callback

# CORS
CORS_ORIGIN=http://localhost:19006
```

### 4. OAuth Setup

#### Google OAuth

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing
3. Enable Google+ API
4. Create OAuth 2.0 credentials
5. Add authorized redirect URI: `http://localhost:3000/oauth/callback` (for dev)
6. Copy Client ID and Client Secret to `.env`

#### Apple OAuth

1. Go to [Apple Developer Portal](https://developer.apple.com/)
2. Create a Service ID
3. Configure Sign in with Apple
4. Download private key (.p8 file)
5. Copy Team ID, Key ID, and private key to `.env`

### 5. Run the Server

Development mode (with auto-reload):
```bash
npm run dev
```

Production mode:
```bash
npm start
```

Server will run on `http://localhost:3000`

## API Endpoints

### Authentication

- `GET /oauth/google` - Initiate Google OAuth
- `GET /oauth/apple` - Initiate Apple OAuth
- `GET /oauth/callback` - OAuth callback handler
- `POST /oauth/callback` - Apple OAuth callback (POST method)

### User

- `GET /user/me` - Get current user profile (requires authentication)

### Health Check

- `GET /health` - Server health check

## Project Structure

```
server/
├── config/
│   ├── database.js      # Prisma client setup
│   └── env.js           # Environment variables
├── controllers/
│   └── user_auth/
│       ├── googleOAuthInitiate.js
│       ├── googleOAuthCallback.js
│       ├── appleOAuthInitiate.js
│       └── appleOAuthCallback.js
├── middleware/
│   └── auth.js          # JWT authentication middleware
├── routes/
│   ├── userAuth.js      # OAuth routes
│   └── user.js          # User routes
├── prisma/
│   └── schema.prisma    # Database schema
├── server.js            # Express app entry point
└── package.json
```

## Database Schema

The Prisma schema includes:

- **User** - User accounts and profiles
- **UserProfile** - Extended user profile data
- **Dependent** - Children, elderly, pets
- **Medication** - Medication details and schedules
- **DoseLog** - Medication dose history
- **Refill** - Medication refill tracking
- **HealthLog** - Symptoms and vitals tracking
- **CaregiverRelationship** - Caregiver connections
- **Notification** - Push notifications

## Development

### Prisma Commands

```bash
# Generate Prisma Client
npm run prisma:generate

# Create and run migration
npm run prisma:migrate

# Open Prisma Studio (database GUI)
npm run prisma:studio
```

## Testing OAuth Flow

1. Start the server: `npm run dev`
2. For local testing, use a tool like [ngrok](https://ngrok.com/) to create an HTTPS tunnel:
   ```bash
   ngrok http 3000
   ```
3. Update `GOOGLE_REDIRECT_URI` and `APPLE_REDIRECT_URI` in `.env` to use the ngrok URL
4. Update redirect URIs in OAuth provider settings

## Notes

- The OAuth flow uses server-side authentication for security
- JWT tokens are generated server-side and passed to the app via deep links
- Deep link scheme must match in both `app.json` and server `.env`
- For production, use HTTPS and update all redirect URIs

