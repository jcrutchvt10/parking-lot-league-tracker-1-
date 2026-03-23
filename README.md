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

## Render Dual-URL Hosting

This repo is configured to deploy two Render web services from one blueprint:

- Public league URL: read-only for everyone
- Admin URL: normal login/editing for league admins

### What read-only mode does

- Anyone can open and browse standings, rounds, schedule, history, and dashboard data.
- Login is disabled.
- All write endpoints (add round, kickoff season, schedule updates) are blocked.
- The UI hides write controls and shows a read-only banner.

### Deploy on Render

1. Push this repo to GitHub.
2. Sign in at Render and create a new Blueprint from your repo.
3. Render will detect `render.yaml` and create both services automatically:
   - `parking-lot-league-public` with `PUBLIC_READ_ONLY=true`
   - `parking-lot-league-admin` with `PUBLIC_READ_ONLY=false`
4. Wait for deploys to finish and copy both generated URLs.

### How to use the two URLs

- Share only the `parking-lot-league-public` URL with league members.
- Use the `parking-lot-league-admin` URL for admin updates and score entry.
- Both services auto-update whenever you push to `main`.

## Notes

- In read-only public mode, login and write actions are intentionally rejected.
- The admin service keeps normal login + edit capabilities.
- Free-tier limits can vary by provider account and region.
