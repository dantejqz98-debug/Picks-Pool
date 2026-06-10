# UFC Bros Picks Pool

GitHub-ready source project for the UFC Bros Picks Pool site.

## Local Preview

```bash
npm install
npm run dev
```

Open:

```text
http://127.0.0.1:8125/index.html
```

## Netlify

Connect this repo to Netlify with:

- Build command: `npm run build`
- Publish directory: `dist`
- Functions directory: `netlify/functions`

Keep these values in Netlify environment variables, not in GitHub:

- `THE_ODDS_API_KEY`
- `RESEND_API_KEY`
- `INVITE_FROM_EMAIL`
- `FIREBASE_SERVICE_ACCOUNT_JSON`

The Firebase web config stays in `index.html` so existing users, logins, pools, picks, and leaderboard data continue using the same Firebase project.

## Project Shape

- `index.html` contains the current app UI and client logic.
- `public/` contains the images and `_headers` file copied into the build output.
- `netlify/functions/` contains backend functions for Firebase Auth cleanup, invite email, and fighter-line refreshes.
- `src/` is reserved for future app modules if the single-file app is split up later.
