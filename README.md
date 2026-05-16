# PoyoLink

PoyoLink is an AI-powered ecosystem relationship platform built for hackathon teams, programme organisers, startup communities, and innovation partners.

Instead of treating events and programmes as simple attendee lists, PoyoLink helps organisers understand who should meet whom, why the connection matters, and whether the relationship produced a useful outcome.

## Problem

Startup ecosystems often have strong people but weak visibility.

Organisers know founders, mentors, investors, government partners, and service providers, but the matching process is usually manual, scattered across spreadsheets, chat groups, and memory. This makes it hard to:

- identify the right people for each programme or event
- explain why a participant is a strong match
- track invites, acceptances, and declined opportunities
- convert introductions into measurable ecosystem relationships
- reuse past outcomes to improve future recommendations

## Solution

PoyoLink turns ecosystem coordination into a structured workflow:

1. Create a context such as an event, programme, cohort, initiative, or country expansion.
2. Define relationship needs for mentors, partners, startups, service providers, and programme admins.
3. Use AI-assisted recommendations to suggest relevant participants.
4. Send and track invites.
5. Convert confirmed invites into ecosystem links.
6. Review analytics, relationship quality, and outcome feedback.

The result is a living relationship graph that helps organisers make better decisions for future programmes.

## Key Features

- **AI participant recommendations** based on profile signals, context needs, role fit, and historical outcome data.
- **Context management** for events, programmes, initiatives, cohorts, and expansion campaigns.
- **Invite tracking** with pending, confirmed, and declined states.
- **Ecosystem link management** for active, completed, suggested, and archived relationships.
- **Relationship graph** powered by D3 to visualise how people and organisations connect.
- **Analytics dashboard** for invite conversion, match confidence, top contexts, and relationship breakdowns.
- **Profile intelligence** with inferred sector, expertise, stage, contribution signals, and completeness.
- **Firebase-backed real-time updates** across dashboard, profiles, invites, contexts, and links.

## Demo Story

For a hackathon presentation, PoyoLink can be demonstrated as a platform used by an ecosystem organiser to run multiple startup programmes in Malaysia.

Suggested flow:

1. Sign in with the presenter account.
2. Open the dashboard to show live activity: contexts, invites, links, and AI match score.
3. View **My Contexts** to show programmes and events owned by the organiser.
4. Open a context to review relationship needs, participant suggestions, invites, links, and activity.
5. Open **My Invites** to show how participants respond to ecosystem opportunities.
6. Open **Ecosystem Links** or **Relationship Graph** to show confirmed relationships.
7. Open **Analytics** to explain impact and conversion metrics.

## Tech Stack

- React 19
- TypeScript
- Vite
- Tailwind CSS
- Firebase Authentication
- Cloud Firestore
- Firebase Cloud Functions
- Firebase Local Emulator Suite
- Google Gemini API
- D3.js
- Zustand

## Architecture Overview

```txt
React + Vite frontend
        |
        | Firebase SDK
        v
Firebase Authentication ---- Cloud Firestore
        |                         |
        |                         v
        |                  users, contexts,
        |                  events, invites,
        |                  ecosystemLinks,
        |                  suggestions
        |
        v
Firebase Cloud Functions
        |
        v
Google Gemini API
```

## Repository Structure

```txt
src/
  components/      Reusable UI components
  contexts/        React context providers, including auth
  hooks/           Firebase and Cloud Function hooks
  lib/             Firebase setup and shared helpers
  pages/           Main application routes
  stores/          Client-side state stores

functions/
  src/             Firebase Cloud Functions

scripts/
  seed.ts          Presentation/demo data seeding script

docs/
  ai-implementation.txt
```

## Prerequisites

Install these before running the project:

- Node.js 20 LTS or newer
- npm
- Git
- Firebase CLI
- Java JDK 17 or newer, required for Firebase emulators

Install Firebase CLI globally if needed:

```bash
npm install -g firebase-tools
```

Log in to Firebase:

```bash
firebase login
```

The project is configured for:

```txt
myhack-c753f
```

If Firebase commands fail because of permissions, ask a Firebase project owner to add your Google account.

## Setup

From the project root:

```bash
npm install
npm --prefix functions install
```

## Environment Variables

The frontend reads Firebase config from `.env`.

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

Use `VITE_USE_EMULATORS=false` for the live Firebase project.

Use `VITE_USE_EMULATORS=true` for local Firebase emulators. Restart the Vite dev server after changing this value.

## Run The App

For live Firebase:

```bash
npm run dev
```

Open the local URL printed by Vite, usually:

```txt
http://localhost:5173
```

## Run With Firebase Emulators

Set this in `.env`:

```env
VITE_USE_EMULATORS=true
```

Start Firebase emulators:

```bash
npm run emulators
```

In a second terminal, start the frontend:

```bash
npm run dev
```

Useful local URLs:

```txt
App:         http://localhost:5173
Emulator UI: http://localhost:4000
Auth:        http://127.0.0.1:9099
Firestore:   http://127.0.0.1:8080
Functions:   http://127.0.0.1:5001
```

## AI Configuration

Some Cloud Functions require `GEMINI_API_KEY`.

For local emulators, create:

```txt
functions/.secret.local
```

Add:

```env
GEMINI_API_KEY=your_gemini_api_key
```

Do not commit `functions/.secret.local`.

For deployed Firebase Functions:

```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase deploy --only functions
```

## Demo Data

The project includes a seed script for presentation data:

```bash
npm run seed
```

The seed script is designed to rebuild demo Firestore collections and attach the main presentation data to the configured presenter account. It intentionally clears application data collections before writing the demo dataset, so use it only when you are preparing a demo environment.

Seeded demo content includes users, events, ecosystem contexts, invites, relationship links, participant suggestions, and feedback records.

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
npm run lint
```

Run ESLint.

```bash
npm run emulators
```

Build functions and start the Firebase Emulator Suite.

```bash
npm --prefix functions run build
```

Build Firebase Functions only.

```bash
firebase deploy
```

Deploy Firebase configuration, rules, indexes, hosting, and functions if configured.

## Validation Checklist

Before submitting or presenting:

```bash
npm run typecheck
npm run build
```

Recommended presentation check:

- confirm the presenter account can sign in
- verify the dashboard has contexts, invites, links, and analytics
- open at least one context detail page
- open the relationship graph
- check that AI-related actions have graceful loading and error states

## Troubleshooting

If `firebase` is not recognized:

```bash
npm install -g firebase-tools
```

If Firebase says you are not logged in:

```bash
firebase login
```

If emulators fail to start, check Java:

```bash
java -version
```

If the app keeps using live Firebase after switching to emulators, restart `npm run dev`.

If AI features fail locally with a missing `GEMINI_API_KEY`, create `functions/.secret.local` and restart the emulators.

## Project Status

PoyoLink is a hackathon-ready prototype. The current build focuses on validating the core workflow: context creation, AI-assisted matching, invite tracking, relationship link management, and ecosystem analytics.
