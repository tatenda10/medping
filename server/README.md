# MediPing Backend Server

Backend API server for MediPing medication reminder app.

## Tech Stack

- **Node.js** + **Express.js** - Server framework
- **MySQL** - Database
- **JWT** - Authentication tokens

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

# CORS
CORS_ORIGIN=http://localhost:19006
```

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

- `POST /user-auth/register` - Register with email + password
- `POST /user-auth/login` - Login with email + password

### User

- `GET /user/me` - Get current user profile (requires authentication)

### Health Check

- `GET /health` - Server health check

## Project Structure

```
server/
├── config/
│   ├── mysql.js         # MySQL connection pool + helpers
│   └── env.js           # Environment variables
├── controllers/
│   └── user_auth/       # Email/password auth controllers
├── middleware/
│   └── auth.js          # JWT authentication middleware
├── routes/
│   ├── userAuth.js      # Auth routes
│   └── user.js          # User routes
├── server.js            # Express app entry point
└── package.json
```

## Database Schema

The backend expects MySQL tables matching the app domain (users, user_profiles, medications, dose_logs, refills, vitals_logs, appointments, caregiver_relationships, notifications, etc.).
4. Update redirect URIs in OAuth provider settings

## Notes

- The OAuth flow uses server-side authentication for security
- JWT tokens are generated server-side and passed to the app via deep links
- Deep link scheme must match in both `app.json` and server `.env`
- For production, use HTTPS and update all redirect URIs

