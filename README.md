# Prayer Points

A phone app (PWA) to keep track of prayer points.
A PWA is a web app that you add to the iPhone Home Screen.
It works offline. Your data stays on your phone.

**Open the app:** https://nrb-digital-tools.github.io/prayer-list-app/

## How the daily list works
Each point has a priority and a target gap (for example, every 7 days).
When you start a session, the app gives each point a score:

    score = (time since prayed / target gap) x priority weight + urgent boost

- The top points by score fill most cards.
- A few "neglect" cards ignore priority. They pick the points that are most overdue.
- A hard limit (default 60 days) forces any very old point into the session.
- "Later" does not reset the score. The point comes back.
- "Prayed" resets the score to 0.

You can change the points per day, neglect slots, hard limit, and weights in Settings.

## Other features
- **List points.** Give a point a list (one item per line, for example a list of communities).
  Each time you pray for the point, the next item shows. After the last item, it starts again.
- **Theme.** Light, Dark, or Match phone (Settings > Appearance).
- **Guaranteed daily.** Mark a point "Guaranteed daily". It shows every day, outside the rotation. It does not use up your points per day.
- **Keep praying.** When the session is done, tap "Keep praying" to get one more point at a time.
- **Stats and streak.** Minutes per day, week, and month, and a daily streak. Minutes count while a card is open (up to 15 min per card).
- **Updates.** Add dated notes to one point, so you do not need a new point each time.

## Run it on your computer
1. Install Node.js 20 or newer.
2. Run `npm install`.
3. Run `npm run dev`. Open the address it prints.
4. Run `npm test` to run the tests.

## Put it on your iPhone
1. On your iPhone, open https://nrb-digital-tools.github.io/prayer-list-app/ in Safari.
2. Tap Share, then "Add to Home Screen".
3. Open the app from the Home Screen icon. **Enter your real points in this app, not in Safari.**
   Safari and the Home Screen app keep separate data.

## Deploy
Each push to `main` builds the app and publishes it to GitHub Pages (`.github/workflows/deploy.yml`).
It takes about 2 minutes. The repo setting Settings > Pages > Source must be "GitHub Actions".

## Keep your data safe
- Your data is only on your phone. Deleting the Home Screen icon can erase it.
- The app reminds you to back up when your last backup is over 7 days old.
- Tap "Back up now". Choose "Save to Files" (iCloud Drive is a good place).
- To restore, use "Restore from backup" on the Today screen (when empty) or in Settings.
