# Clerk Migration Guide

## Overview
This document outlines the migration from custom JWT authentication to Clerk authentication.

## Client-Side Changes

### 1. Environment Variables
Add to `client/.env`:
```
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
```

### 2. App.js
- Wrapped with `ClerkProvider`
- Uses `ClerkAuthProvider` instead of `AuthProvider`

### 3. Auth Context
- `client/src/context/ClerkAuthContext.js` - New Clerk-based auth context
- Provides compatibility layer with old `AuthContext` interface
- Automatically sets up axios token interceptor

### 4. Login/SignUp Screens
- Updated to use Clerk's `useSignIn` and `useSignUp` hooks
- OAuth flows handled by Clerk (Google, Apple)
- Email/password handled by Clerk

### 5. Navigation
- `AppNavigator.js` updated to use Clerk auth state
- Logout uses Clerk's `signOut()` method

### 6. API Calls
- Use `clerkAxios` from `client/src/utils/clerkAxios.js` for authenticated requests
- Automatically includes Clerk token in Authorization header

## Server-Side Changes

### 1. Install Clerk Backend SDK
```bash
cd server
npm install @clerk/clerk-sdk-node
```

### 2. Environment Variables
Add to `server/.env`:
```
CLERK_SECRET_KEY=sk_test_...
```

### 3. Update Authentication Middleware
- Replace JWT verification with Clerk token verification
- Use `clerkClient.verifyToken()` to verify tokens

### 4. Database Schema
- Add `clerk_user_id` column to `users` table
- Link Clerk users to existing user records

### 5. User Creation/Lookup
- On first Clerk sign-in, create/update user record with Clerk ID
- Use Clerk `userId` to look up users in database

## Migration Steps

1. **Install Packages** (User will do this manually)
   - Client: `@clerk/clerk-expo`
   - Server: `@clerk/clerk-sdk-node`

2. **Set Up Clerk Account**
   - Create Clerk account
   - Create application
   - Get publishable key and secret key
   - Configure OAuth providers (Google, Apple)

3. **Update Environment Variables**
   - Add `EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY` to client `.env`
   - Add `CLERK_SECRET_KEY` to server `.env`

4. **Database Migration**
   - Add `clerk_user_id` column to users table
   - Create migration script to link existing users (if needed)

5. **Test Authentication**
   - Test email/password login
   - Test Google OAuth
   - Test Apple OAuth
   - Test logout

## Guest Mode
- Guest mode remains local-only (no server sync)
- Guest data is separate from Clerk authentication
- Guest data is cleared on logout

## Notes
- Old auth service files can be removed after migration is complete
- Old auth routes on server can be removed
- All API calls should use `clerkAxios` instead of regular `axios` with manual token headers

