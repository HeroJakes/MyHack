# PoyoLink

PoyoLink is a React + Vite + Firebase app for building campaigns, inviting ecosystem participants, and managing AI-powered relationship linkages.

## Tech Stack

- React 19 + TypeScript
- Vite
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Functions
- Firebase Local Emulator Suite
- Google Gemini API for AI recommendations

## Prerequisites

Install these before pulling and running the project:

- Node.js 20 LTS or newer
- npm
- Git
- Firebase CLI
- Java JDK 17 or newer, required for the Firebase emulators

Install Firebase CLI globally if you do not have it:

```bash
npm install -g firebase-tools
```

Then log in to Firebase:

```bash
firebase login
```

You also need access to the Firebase project configured in `.firebaserc`:

```txt
myhack-c753f
```

If Firebase commands fail with a permission error, ask a project owner to add your Google account to the Firebase project.

## First-Time Setup

From the project root:

```bash
git clone <repo-url>
cd MyHack
npm install
cd functions
npm install
cd ..
```

## Environment Variables

The frontend reads Firebase config from `.env`.

A working `.env` should look like this:

```env
VITE_FIREBASE_API_KEY=your_firebase_web_api_key
VITE_FIREBASE_AUTH_DOMAIN=your_project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your_project_id
VITE_FIREBASE_STORAGE_BUCKET=your_project.firebasestorage.app
VITE_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
VITE_FIREBASE_APP_ID=your_app_id
VITE_FIREBASE_MEASUREMENT_ID=your_measurement_id
VITE_USE_EMULATORS=false
```

Use `VITE_USE_EMULATORS=false` when connecting to the real Firebase project.

Use `VITE_USE_EMULATORS=true` when running against local Firebase emulators. Restart the Vite dev server after changing this value.

## Run With Live Firebase

This is the quickest way to run the app if you have access to the Firebase project.

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```txt
http://localhost:5173
```

The app will use the live Firebase services when `VITE_USE_EMULATORS=false`.

## Run With Firebase Emulators

Use this when you want local Auth, Firestore, and Functions.

1. Set this in `.env`:

```env
VITE_USE_EMULATORS=true
```

2. Start the Firebase emulators in one terminal:

```bash
npm run emulators
```

3. Start the Vite app in another terminal:

```bash
npm run dev
```

Useful emulator URLs:

```txt
App:         http://localhost:5173
Emulator UI: http://localhost:4000
Auth:        http://127.0.0.1:9099
Firestore:   http://127.0.0.1:8080
Functions:   http://127.0.0.1:5001
```

## Gemini API Key For AI Functions

Some Cloud Functions require `GEMINI_API_KEY`.

For local emulators, create this file:

```txt
functions/.secret.local
```

Add:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do not commit `functions/.secret.local`.

For deployed Firebase Functions, set the secret with:

```bash
firebase functions:secrets:set GEMINI_API_KEY
```

Then deploy functions when needed:

```bash
firebase deploy --only functions
```

## Common Commands

```bash
npm run dev
```

Start the frontend dev server.

```bash
npm run build
```

Build the frontend for production.

```bash
npm run typecheck
```

Run TypeScript checks.

```bash
npm run emulators
```

Build functions and start the Firebase Emulator Suite.

```bash
npm --prefix functions run build
```

Build only Firebase Functions.

```bash
firebase deploy
```

Deploy Firebase config, rules, indexes, hosting/functions if configured.

## Recommended First Pull Checklist

After pulling the repo for the first time, run this sequence:

```bash
npm install
npm --prefix functions install
npm run typecheck
npm run build
```

Then choose one runtime path:

```bash
npm run dev
```

Or, for emulators:

```bash
npm run emulators
npm run dev
```

Run `npm run emulators` and `npm run dev` in separate terminals.

## Troubleshooting

If `firebase` is not recognized:

```bash
npm install -g firebase-tools
```

If Firebase says you are not logged in:

```bash
firebase login
```

If emulators fail to start, check that Java is installed:

```bash
java -version
```

If the app keeps using live Firebase after switching to emulators, restart `npm run dev` because Vite only reads `.env` when the dev server starts.

If AI features fail locally with a missing `GEMINI_API_KEY`, create `functions/.secret.local` and restart the emulators.

If `npm run lint` reports errors inside `functions/lib`, those are generated build files. The current repository lint config does not exclude that generated folder yet.
