<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Parking Lot League Tracker

This app is a React frontend served by an Express API.

## Local Run

Prerequisites: Node.js 20+

1. Install dependencies:
   `npm install`
2. Start the app:
   `npm run dev`
3. Open:
   `http://localhost:3000`

## Public Read-Only Hosting (Free)

This repo is now configured for a free Render web service with a public, view-only URL.

### What read-only mode does

- Anyone can open and browse standings, rounds, schedule, history, and dashboard data.
- Login is disabled.
- All write endpoints (add round, kickoff season, schedule updates) are blocked.
- The UI hides write controls and shows a read-only banner.

### Deploy on Render

1. Push this repo to GitHub.
2. Sign in at Render and create a new Web Service from your repo.
3. Render will detect `render.yaml` and apply these settings automatically:
   - Build: `npm install; npm run build`
   - Start: `npm run start`
   - Env:
     - `NODE_ENV=production`
     - `PUBLIC_READ_ONLY=true`
4. Wait for deploy to finish, then copy the generated Render URL.

## Notes

- In read-only public mode, database writes are intentionally rejected.
- If you want private admin editing later, create a separate non-public deployment with `PUBLIC_READ_ONLY=false`.
