---
name: ecograph-ai
description: Use this skill for any task related to the EcoGraph AI project — a Firebase + Gemini powered ecosystem linkage platform built for the Build With AI 2026 KL MyHack hackathon. Triggers include: writing or editing Cloud Functions, Firestore schema, Gemini prompt engineering, React UI components, Firebase security rules, seed data, match engine logic, linkage manager, actor registry, outcome feedback loop, programme dashboard, or any code, config, or architecture decision for this specific codebase. Also use when the user asks about how Gemini and Vertex AI integrate, how the match pipeline works, or how to deploy the app.
---

# EcoGraph AI — Project Skill

## Project Identity

EcoGraph AI is an AI-powered ecosystem linkage engine built for Cradle Fund's innovation programmes. It treats mentor-company-partner relationships as first-class, versioned, reusable data entities — not ad-hoc assignments. Gemini 1.5 Flash handles match reasoning. Firebase handles everything else.

**Hackathon:** Build With AI 2026 KL — MyHack (16-17 May 2026)
**Problem statement:** Automating Ecosystem Linkages Instead of Manual Coordination
**Contact:** faiz.hassan@cradle.com.my

---

## Current File System State

The repo root is `MyHack/`. The project started from a plain `npm create vite@latest` scaffold. Firebase has NOT been initialized yet — no `functions/`, no `firestore.rules`, no `firebase.json` exist. These must all be created.

### What exists right now

```
MyHack/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   ├── hero.png
│   │   ├── react.svg
│   │   └── vite.svg
│   ├── lib/                    # exists but empty — firebase.ts goes here
│   ├── App.css
│   ├── App.jsx                 # rename/replace with App.tsx
│   ├── index.css
│   └── main.jsx                # rename/replace with main.tsx
├── .env                        # rename to .env.local, never commit
├── .gitignore
├── eslint.config.js
├── index.html
├── package-lock.json
├── package.json
├── README.md
└── vite.config.js              # rename/replace with vite.config.ts
```

**Note:** `src/lib/` already exists. Place `firebase.ts` directly inside it — do not recreate the folder.

### What must be created (target structure)

```
MyHack/
├── public/
│   ├── favicon.svg
│   └── icons.svg
├── src/
│   ├── assets/
│   │   └── hero.png            # keep, others can be removed
│   ├── lib/
│   │   └── firebase.ts         # Firebase app, db, auth, functions exports
│   ├── contexts/
│   │   └── AuthContext.tsx     # useAuth() hook, LinkedIn sign-in
│   ├── hooks/
│   │   ├── useGenerateMatches.ts
│   │   ├── useApproveLinkage.ts
│   │   ├── useRejectCandidate.ts
│   │   └── useActors.ts        # onSnapshot actor registry hook
│   ├── pages/
│   │   ├── Login.tsx
│   │   ├── Onboarding.tsx      # 3-step: role → bio input → confirm profile
│   │   ├── ActorRegistry.tsx   # list + filter all actors
│   │   ├── LinkageManager.tsx  # match generation + approval workflow
│   │   ├── Dashboard.tsx       # programme overview + graph + copilot
│   │   └── OutcomeRecorder.tsx # rate completed linkages
│   ├── components/
│   │   ├── MatchCard.tsx       # single AI match suggestion card
│   │   ├── LinkageDrawer.tsx   # detail slide-in (no position:fixed)
│   │   ├── ActorCard.tsx
│   │   ├── EcosystemGraph.tsx  # D3 force graph
│   │   └── CopilotBar.tsx      # natural language query bar
│   ├── App.tsx                 # replaces App.jsx
│   ├── App.css
│   ├── index.css
│   └── main.tsx                # replaces main.jsx
├── functions/                  # created by: firebase init functions
│   ├── src/
│   │   ├── types.ts            # Actor, Linkage, Suggestion, Programme interfaces
│   │   ├── filterCandidates.ts # rule-based pre-filter (runs before Gemini)
│   │   ├── buildMatchPrompt.ts # Gemini prompt builder
│   │   ├── callGemini.ts       # Gemini SDK wrapper with retry + JSON validation
│   │   ├── getOutcomeHistory.ts# fetches past linkage outcomes for prompt injection
│   │   ├── generateMatches.ts  # main match engine Cloud Function (onCall)
│   │   ├── approveLinkage.ts   # approve a match, writes linkage doc (onCall)
│   │   ├── rejectCandidate.ts  # reject a match, stores reason (onCall)
│   │   ├── extractProfile.ts   # Gemini profile extraction from bio (onCall)
│   │   └── recordOutcome.ts    # record linkage outcome + feed back to prompts (onCall)
│   ├── package.json            # separate from root package.json
│   └── tsconfig.json
├── scripts/
│   └── seed.ts                 # idempotent seed — 5 mentors, 5 companies, 2 programmes
├── firestore.rules             # created by: firebase init firestore
├── firestore.indexes.json      # created by: firebase init firestore
├── firebase.json               # created by: firebase init
├── .firebaserc                 # created by: firebase init
├── .env.local                  # renamed from .env — never commit
├── .gitignore
├── eslint.config.js
├── index.html
├── package.json
├── README.md
└── vite.config.ts              # renamed from vite.config.js
```

---

## Bootstrap Commands (run once, in order)

```bash
# 1. Install Firebase CLI globally if not present
npm install -g firebase-tools
firebase login

# 2. From the MyHack/ root, initialize Firebase
firebase init
# Select: Firestore, Functions, Hosting, Emulators
# Functions language: TypeScript
# Hosting public dir: dist
# Single-page app: yes
# Region: asia-southeast1

# 3. Store secrets (never hardcode)
firebase functions:secrets:set GEMINI_API_KEY

# 4. Install frontend dependencies
npm install firebase zustand d3 @types/d3

# 5. Install functions dependencies (separate package.json)
cd functions && npm install @google/generative-ai firebase-admin firebase-functions
cd ..

# 6. Rename .jsx files to .tsx (or delete and recreate as .tsx)
mv src/App.jsx src/App.tsx
mv src/main.jsx src/main.tsx
mv vite.config.js vite.config.ts

# 7. Rename .env to .env.local
mv .env .env.local

# 8. Start emulators
firebase emulators:start

# 9. Run seed script against emulator
cd functions && npm run build
ts-node scripts/seed.ts
```

---

## Tech Stack (do not deviate)

| Layer | Choice | Notes |
|---|---|---|
| AI reasoning | Gemini 1.5 Flash via `@google/generative-ai` | AI Studio API key, free tier |
| Embeddings | Vertex AI `textembedding-gecko@003` | Semantic pre-filter before Gemini |
| Database | Firebase Firestore | Real-time listeners, batch writes |
| Auth | Firebase Auth + LinkedIn OAuth | Sign-in only — name, email, photo, headline |
| Backend | Firebase Cloud Functions (Node 20, region: `asia-southeast1`) | All AI calls run here |
| Frontend | React + Vite + TypeScript + Tailwind CSS | Vite scaffold already in place |
| State | Zustand | Lightweight, no Redux |
| Hosting | Firebase Hosting | `firebase deploy`, public dir: `dist` |
| Graph vis | D3.js force graph | Ecosystem relationship map |

**Never introduce:** Express servers, Next.js SSR, Redux, non-Firebase databases, or any AI provider other than Gemini/Vertex AI without explicit approval.

---

## Firestore Collections & Schemas

### `actors/{actorId}`
```typescript
interface Actor {
  id: string;
  role: 'startup' | 'mentor' | 'partner' | 'service_provider' | 'admin';
  name: string;
  email: string;
  photoURL: string;
  headline: string;             // from LinkedIn OAuth
  sector: string[];             // ['FinTech', 'HealthTech']
  stage: 'pre-seed' | 'seed' | 'series-a' | 'growth' | 'established';
  expertise: string[];          // mentor field — what they offer
  needs: string[];              // company field — what they seek
  websiteUrl?: string;
  githubUrl?: string;
  availabilityScore: number;    // 0-100
  profileCompleteness: number;  // 0-100, computed on write
  linkedinId: string;
  createdAt: Timestamp;
  updatedAt: Timestamp;
  embeddingVector?: number[];   // 768-dim, written by Vertex AI embeddings
}
```

### `programmes/{programmeId}`
```typescript
interface Programme {
  id: string;
  name: string;
  cohort: string;               // e.g. '2026-Q2'
  geography: string;            // e.g. 'Malaysia'
  adminIds: string[];           // Firebase Auth UIDs
  companyIds: string[];
  mentorIds: string[];
  status: 'active' | 'completed' | 'archived';
  cloneTemplate?: string;       // id of programme this was cloned from
  matchingCriteria: {
    requireSectorMatch: boolean;
    minAvailabilityScore: number;
    minProfileCompleteness: number;
  };
  createdAt: Timestamp;
}
```

### `linkages/{linkageId}`
```typescript
interface Linkage {
  id: string;
  type: 'mentor-to-company' | 'company-to-programme' | 'partner-to-initiative';
  fromId: string;               // actor id
  toId: string;                 // actor id
  programmeId: string;
  reason: string;               // Gemini plain-English justification
  confidenceScore: number;      // 0-100, from Gemini
  riskFlags: string[];          // Gemini-identified risks
  status: 'active' | 'paused' | 'completed' | 'archived';
  createdBy: 'ai-admin-approval';
  createdAt: Timestamp;
  completedAt?: Timestamp;
  outcomeRating?: 'successful' | 'partially-useful' | 'not-suitable';
  outcomeNote?: string;
  clonedFrom?: string;          // linkageId if cloned from another cohort
  reusable: boolean;
}
```

### `suggestions/{suggestionId}`
```typescript
interface LinkageSuggestion {
  type: 'mentor-to-company' | 'company-to-programme' | 'partner-to-initiative';
  fromId: string;
  toId: string;
  programmeId: string;
  status: 'pending' | 'partially-approved' | 'fully-approved' | 'dismissed';
  candidates: MatchCandidate[];
  generatedAt: Timestamp;
}

interface MatchCandidate {
  actorId: string;
  rank: number;
  reason: string;
  confidence: number;           // 0-100
  risks: string[];
  approvedAt?: Timestamp;
  rejectedAt?: Timestamp;
  rejectionReason?: string;
}
```

---

## Firestore Rules (reference)

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Actors: read all authenticated, write own only (or Admin SDK)
    match /actors/{actorId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == actorId;
    }

    // Programmes: admins read/write, others read-only
    match /programmes/{programmeId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null
        && request.auth.uid in resource.data.adminIds;
    }

    // Linkages + Suggestions: Admin SDK only for writes
    match /linkages/{linkageId} {
      allow read: if request.auth != null
        && request.auth.uid in get(/databases/$(database)/documents/
           programmes/$(resource.data.programmeId)).data.adminIds;
      allow write: if false;
    }

    match /suggestions/{suggestionId} {
      allow read: if request.auth != null
        && request.auth.uid in get(/databases/$(database)/documents/
           programmes/$(resource.data.programmeId)).data.adminIds;
      allow write: if false;
    }
  }
}
```

---

## Gemini Integration Rules

### Always use these settings for the match engine
```typescript
const model = genAI.getGenerativeModel({
  model: 'gemini-1.5-flash',
  generationConfig: {
    temperature: 0,                        // deterministic for ranking
    responseMimeType: 'application/json',  // constrained decoding mode
  },
});
```

### Always strip JSON fences before parsing
```typescript
const raw = result.response.text();
const clean = raw.replace(/```json?\n?/g, '').replace(/```/g, '').trim();
const parsed = JSON.parse(clean);
```

### Always validate the response shape before using it
```typescript
if (!parsed.rankings || !Array.isArray(parsed.rankings)) {
  throw new Error('Invalid Gemini response shape');
}
```

### Always retry once on malformed output
```typescript
} catch (err) {
  if (retries > 0) {
    return callGeminiMatch(prompt + '\nIMPORTANT: return only raw JSON, no markdown.', 0);
  }
  throw err;
}
```

### Profile extraction uses temperature 0 + explicit JSON schema in prompt
```typescript
const extractionPrompt = `
Extract structured profile data from this text.
Return ONLY valid JSON matching this exact schema:
{
  "sector": ["string"],
  "stage": "pre-seed|seed|series-a|growth|established",
  "expertise": ["string"],
  "needs": ["string"],
  "tags": ["string"],
  "actorType": "startup|mentor|partner|service_provider"
}
Text: ${bio}
`;
```

### Outcome history injection pattern (the learning loop)
```typescript
// Inject into every match prompt — this is the cross-cohort memory
const historyBlock = pastOutcomes.length > 0
  ? `PAST LINKAGE OUTCOMES (use to inform ranking):\n${pastOutcomes.join('\n')}`
  : 'No past outcome history yet for this programme.';
```

### Gemini API vs Vertex AI — how they work together

| | Gemini API (AI Studio) | Vertex AI |
|---|---|---|
| Endpoint | `generativelanguage.googleapis.com` | `{region}-aiplatform.googleapis.com` |
| Auth | `x-goog-api-key` header (AI Studio key) | GCP service account + IAM |
| SDK | `@google/generative-ai` | `@google-cloud/vertexai` |
| Used for | Profile extraction, match ranking, copilot Q&A | Embeddings only (`textembedding-gecko@003`) |
| Cost | Free tier (15 RPM, 1M tokens/day) | Billed per 1K chars |

**Pipeline:** Actor onboarding -> Vertex AI generates 768-dim embedding -> stored on actor doc -> Match request fetches embeddings -> cosine similarity narrows to top 12 -> Gemini ranks and explains the shortlist.

---

## Match Engine Pipeline

The pipeline always runs in this exact order. Never skip or reorder steps.

```
1. Receive { companyId, programmeId } from client
2. Parallel fetch: company actor + all mentor actors (Promise.all)
3. Rule-based filterCandidates() -> max 12 candidates
   - Hard filters: sector overlap, stage compatibility, availability > 20, completeness >= 50
   - Soft score: expertise/needs overlap x 10 + availability x 0.3 + completeness x 0.2
   - Sort by soft score, slice top 12
4. getOutcomeHistory(programmeId) -> last 10 completed linkages as string
5. buildMatchPrompt(company, candidates, history) -> prompt string
6. callGeminiMatch(prompt) -> MatchCandidate[] (with retry + validation)
7. Persist suggestion document to Firestore (Admin SDK)
8. Return { suggestionId, rankings } to client
```

**Why pre-filter before Gemini:** Gemini reasoning over 100+ candidates is slow (5-10s), expensive, and degrades reasoning quality. The rule filter brings candidates to 8-15. Gemini then does qualitative ranking and explanation, which is its actual strength.

---

## Cloud Functions Conventions

All Cloud Functions live in `functions/src/`. Each file is one exported `onCall` function.

```typescript
// 1. Always check auth first
if (!request.auth) throw new HttpsError('unauthenticated', 'Sign in required');

// 2. Validate required inputs immediately
if (!companyId || !programmeId) {
  throw new HttpsError('invalid-argument', 'companyId and programmeId required');
}

// 3. Use Firestore batch writes for multi-document atomic operations
const batch = db.batch();
batch.set(linkageRef, linkageData);
batch.update(suggestionRef, { status: 'partially-approved' });
await batch.commit(); // one network round trip, atomic

// 4. Fetch independent documents in parallel
const [companySnap, mentorSnap] = await Promise.all([
  db.collection('actors').doc(companyId).get(),
  db.collection('actors').where('role', '==', 'mentor').get(),
]);

// 5. Always set region
export const myFunction = onCall({ region: 'asia-southeast1' }, async (req) => { ... });

// 6. Secret access — never hardcode keys
export const myFunction = onCall({ secrets: ['GEMINI_API_KEY'], region: 'asia-southeast1' }, ...);
```

---

## React Frontend Conventions

### Firebase client setup
File: `src/lib/firebase.ts` (the `lib/` folder already exists in the scaffold)

```typescript
import { initializeApp } from 'firebase/app';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const app = initializeApp({
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
});

export const db = getFirestore(app);
export const auth = getAuth(app);
export const functions = getFunctions(app, 'asia-southeast1');

if (import.meta.env.VITE_USE_EMULATOR === 'true') {
  connectFirestoreEmulator(db, 'localhost', 8080);
  connectAuthEmulator(auth, 'http://localhost:9099');
  connectFunctionsEmulator(functions, 'localhost', 5001);
}
```

### Hook pattern — all Cloud Function calls follow this shape
```typescript
// src/hooks/useGenerateMatches.ts
import { httpsCallable } from 'firebase/functions';
import { functions } from '../lib/firebase';
import { useState } from 'react';

export function useGenerateMatches() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fn = httpsCallable(functions, 'generateMatches');

  const generate = async (companyId: string, programmeId: string) => {
    setLoading(true);
    setError(null);
    try {
      const result = await fn({ companyId, programmeId });
      return result.data as { suggestionId: string; rankings: MatchCandidate[] };
    } catch (e: any) {
      setError(e.message ?? 'Something went wrong');
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, error };
}
```

### Real-time Firestore listeners — always clean up
```typescript
useEffect(() => {
  const unsub = onSnapshot(
    query(collection(db, 'actors'), where('role', '==', 'mentor')),
    (snap) => setMentors(snap.docs.map(d => ({ id: d.id, ...d.data() } as Actor)))
  );
  return () => unsub(); // critical — prevents listener accumulation
}, []);
```

### UI state requirements for every async action
Every button that triggers a Cloud Function must handle all four states:

| State | UI behaviour |
|---|---|
| Idle | Button enabled, default label |
| Loading | Button disabled, skeleton or spinner, descriptive label ("Gemini is reasoning...") |
| Error | Error message visible, retry button present |
| Success | Result displayed, button re-enabled or replaced with next action |

Never show a bare spinner. Always include a descriptive label.

### Drawer components — never use `position: fixed`
The React app renders inside a sandboxed iframe in some contexts. `position: fixed` contributes zero height to the document, collapsing the container.

Use CSS transform instead:
```css
.drawer {
  position: absolute;         /* relative to a positioned parent */
  right: 0;
  top: 0;
  height: 100%;
  transform: translateX(100%);
  transition: transform 0.25s ease;
}
.drawer.open {
  transform: translateX(0);
}
```

### Confidence score colour coding
```typescript
// Used in MatchCard.tsx and anywhere a confidence score is displayed
export function confidenceVariant(score: number): 'success' | 'warning' | 'danger' {
  if (score >= 80) return 'success';
  if (score >= 60) return 'warning';
  return 'danger';
}
```

---

## Seed Data Specification

File: `scripts/seed.ts` — run against emulator first, never against production.
The script must be idempotent — running it twice produces no duplicates. Use `set()` with fixed document IDs, not `add()`.

### Mentor seeds (5 required)
| ID | Name | Sector | Expertise | Stage fit |
|---|---|---|---|---|
| `mentor-001` | Sarah Lim | FinTech | Fundraising, Series A, Angel Networks | seed, series-a |
| `mentor-002` | Ahmad Razif | HealthTech | Regulatory, Medical Devices, MOH | pre-seed, seed |
| `mentor-003` | Priya Nair | AgriTech | Supply Chain, B2B Sales | seed, growth |
| `mentor-004` | Jason Wong | SaaS | Product-led Growth, Enterprise Sales | series-a, growth |
| `mentor-005` | Nurul Ain | EdTech | Curriculum Design, B2G | pre-seed, seed |

### Company seeds (5 required)
| ID | Name | Sector | Stage | Needs |
|---|---|---|---|---|
| `company-001` | GreenPay | FinTech | seed | Fundraising, Investor Intros |
| `company-002` | MediTrack | HealthTech | pre-seed | Regulatory Guidance, MOH |
| `company-003` | FarmLink | AgriTech | seed | B2B Sales, Distribution |
| `company-004` | CloudDesk | SaaS | series-a | Enterprise Sales, Scaling |
| `company-005` | LearnPath | EdTech | pre-seed | Product Validation, Pilots |

### Programme seeds (2 required)
| ID | Name | Cohort | Companies | Mentors |
|---|---|---|---|---|
| `programme-001` | Cradle CIP Accelerate 2026 | 2026-Q2 | company-001, company-002, company-003 | mentor-001, mentor-002, mentor-003 |
| `programme-002` | Cradle DeepTech 2026 | 2026-Q2 | company-004, company-005 | mentor-004, mentor-005 |

---

## Firestore Indexes (deploy early — takes up to 5 minutes)

```json
{
  "indexes": [
    {
      "collectionGroup": "linkages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "programmeId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" }
      ]
    },
    {
      "collectionGroup": "linkages",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "programmeId", "order": "ASCENDING" },
        { "fieldPath": "status", "order": "ASCENDING" },
        { "fieldPath": "completedAt", "order": "DESCENDING" }
      ]
    },
    {
      "collectionGroup": "actors",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "role", "order": "ASCENDING" },
        { "fieldPath": "sector", "arrayConfig": "CONTAINS" }
      ]
    },
    {
      "collectionGroup": "suggestions",
      "queryScope": "COLLECTION",
      "fields": [
        { "fieldPath": "programmeId", "order": "ASCENDING" },
        { "fieldPath": "generatedAt", "order": "DESCENDING" }
      ]
    }
  ]
}
```

Deploy: `firebase deploy --only firestore:indexes` — run this early, indexes take up to 5 minutes to build.

---

## Environment Variables

### Frontend — `.env.local` (renamed from `.env`, never commit)
```
VITE_FIREBASE_API_KEY=
VITE_FIREBASE_AUTH_DOMAIN=
VITE_FIREBASE_PROJECT_ID=ecograph-ai
VITE_FIREBASE_STORAGE_BUCKET=
VITE_FIREBASE_MESSAGING_SENDER_ID=
VITE_FIREBASE_APP_ID=
VITE_USE_EMULATOR=true          # set to false for production deploy
```

### Functions — Firebase secrets (set via CLI, never in code)
```bash
firebase functions:secrets:set GEMINI_API_KEY
firebase functions:secrets:set LINKEDIN_CLIENT_SECRET  # if needed
```

---

## Billing and Cost Guard Rails

- Gemini 1.5 Flash via AI Studio: free tier — 15 RPM, 1M tokens/day. Sufficient for the hackathon. Does NOT draw from the $25 GCP credit.
- Vertex AI Embeddings `textembedding-gecko@003`: billed per 1,000 characters. Embeddings are generated once per actor profile, not per request. Hackathon cost estimate: < $0.10.
- Firestore: 50K reads / 20K writes / 1GB storage free per day. Hackathon will not exceed this.
- Cloud Functions: 2M invocations free/month. Will not exceed.
- Firebase Hosting: 10GB storage / 360MB/day transfer free.
- **Set a $5 budget alert in GCP console before any load testing.**
- Firebase Blaze plan is required — Cloud Functions do not run on the Spark (free) plan.

---

## Key Decisions (do not re-debate)

1. LinkedIn OAuth for sign-in only — Community Tier blocks work experience, skills, education. Fighting the API wastes hours.
2. Gemini via AI Studio (not Vertex AI) for generation — free tier, simpler auth, sufficient for hackathon scale.
3. Vertex AI only for embeddings — needed for semantic pre-filter, billed per use.
4. Rule-based pre-filter before Gemini — performance + cost + reasoning quality.
5. Firebase Blaze plan required — Cloud Functions do not run on Spark.
6. Firestore batch writes for approval — atomic, no partial state corruption.
7. No Next.js SSR — pure client-side React + Firebase SDK is faster to build and deploy in 24 hours.
8. Region: `asia-southeast1` — lower latency from Malaysia for demo.
9. `src/lib/` already exists in scaffold — do not recreate, just add `firebase.ts` inside it.
10. `.jsx` files must be renamed to `.tsx`. `App.jsx` and `main.jsx` are the only two affected.

---

## Demo Script (under 90 seconds)

1. Sign in with LinkedIn (or email fallback against emulator)
2. Paste a mentor bio -> click "Auto-fill with AI" -> confirm tags -> complete profile
3. Open Actor Registry -> show mentor card appeared
4. Open Linkage Manager -> select GreenPay + Cradle CIP Accelerate 2026
5. Click "Generate AI matches" -> Gemini is reasoning... (1-2s)
6. Show ranked match cards with confidence scores and reasons
7. Click "Approve" on the top match -> linkage object created
8. Show linkage appears in the active linkages list
9. Open linkage detail drawer -> show full Gemini reasoning and risk flags

**Never demo against live Gemini during a presentation.** Use the emulator with a pre-recorded suggestion document as a fallback. Have seed data loaded and verified before stepping in front of judges.

---

## Common Errors and Fixes

| Error | Cause | Fix |
|---|---|---|
| `JSON.parse` fails on Gemini response | Gemini wrapped output in markdown fences | Strip with `.replace(/```json?\n?/g, '').replace(/```/g, '')` |
| Firestore query missing index | Composite index not deployed yet | `firebase deploy --only firestore:indexes` — wait 5 min |
| Cloud Function times out | Gemini + Firestore fetches in sequence | Use `Promise.all` for parallel fetches |
| Emulator not reflecting rule changes | Old rules cached | Restart emulators after rule edits |
| LinkedIn OAuth fails | Redirect URI not whitelisted | Add Firebase OAuth redirect URI to LinkedIn app settings |
| `position: fixed` drawer collapses iframe | iframe height = document in-flow height | Use `transform: translateX()` instead |
| onSnapshot listener leak | Missing cleanup in useEffect | Always return `() => unsub()` from useEffect |
| Vertex AI 403 | Embeddings API not enabled | Enable `aiplatform.googleapis.com` in GCP console |
| Cannot find module `../lib/firebase` | Path wrong from hooks/ or pages/ | Use `../../lib/firebase` from two levels deep |
| Vite can't process `.jsx` files with TypeScript | File extension mismatch | Rename `App.jsx` -> `App.tsx`, `main.jsx` -> `main.tsx` |
| `firebase: command not found` | Firebase CLI not installed | `npm install -g firebase-tools` |
| Functions not deploying | Blaze plan not enabled | Upgrade to Blaze in Firebase console before `firebase deploy` |

---

## Build Phase Summary

| Phase | Hours | Milestone |
|---|---|---|
| 0 — Scaffold conversion + Firebase init | 0-1 | `.jsx` renamed to `.tsx`, `firebase init` complete, emulator running |
| 1 — Schema + seed data | 1-2 | Seed data verified in emulator, indexes deployed |
| 2 — Actor Registry + Gemini profile extraction | 2-5 | Onboarding flow works end to end |
| 3 — Gemini match engine Cloud Function | 5-9 | Match rankings generated and stored |
| 4 — Linkage Manager + admin approval | 9-13 | **Minimum demo complete** |
| 5 — Programme Dashboard + outcome loop | 13-17 | Learning loop active |
| 6 — Outcome recording + programme clone | 17-20 | Full product feature set |
| 7 — Polish + error states + demo data | 20-22 | Judge-ready |
| 8 — Deploy + rehearse | 22-24 | Live on Firebase Hosting |

**If time runs short:** phases 0-4 alone answer the problem statement directly and are sufficient for a compelling demo.

**Phase 0 is new** — the original skill assumed Firebase was already initialized. It is not. Scaffold conversion and `firebase init` must happen first.
