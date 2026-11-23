# Prayer Points

A phone app (PWA) to keep track of prayer points.
A PWA is a web app that you add to the iPhone Home Screen.
It works offline. Your data stays on your phone.

**Open the app:** https://nrb-digital-tools.github.io/prayer-list-app/

## How the daily list works
Today has a **time target** (default 30 minutes a day). Cards keep coming until you reach it.

The order of the cards:
1. **Guaranteed daily** points.
2. **Wild cards** (default 2): due points that you prayed for longest ago.
3. Points not prayed for 60 days or more (the hard limit).
4. Then one card at a time:
   - due, overdue, and urgent points, by score;
   - points you tapped **Later**, once each;
   - points that are not due yet, soonest first.
5. When every point has had a turn, a new round starts. Guaranteed daily points do not come back the same day.

The score of a point:

    score = (time since prayed / target gap) + urgent boost

**Prayer time.** Tap **▶ Start** when you begin to pray and **❚❚ Pause** when you stop.
The timer uses the clock, so it keeps counting when the phone locks.
Only time on cards you mark **Prayed** counts, at most 30 minutes per card.

When you reach the target, you can tap **Keep praying**. It goes on with the same order and never runs out.
You can change the target, wild cards, and hard limit in Settings.

## Other features
- **List points.** Give a point a list (one item per line, for example a list of communities).
  Each time you pray for the point, the next item shows. After the last item, it starts again.
- **Theme.** Light, Dark, or Match phone (Settings > Appearance).
- **Guaranteed daily.** Mark a point "Guaranteed daily". It shows first, once every day, outside the rotation.
- **Keep praying.** When the session is done, tap "Keep praying" to get one more point at a time.
- **Stats and streak.** Minutes per day, week, and month, and a daily streak. Minutes count while a card is open (up to 15 min per card).
- **Updates.** Add dated notes to one point, so you do not need a new point each time.
  All updates stay on the card until you remove them. Remove asks: "Answered" (kept, and listed on the Answered tab) or "Delete".
- **Urgent.** Tap "Urgent" on a card or on the point page. Choose how long: 7 days (default), 3 days, 2 weeks, 1 month,
  another number of days, or "Until I remove it". An urgent point comes up every day until it ends.

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

## Scripture
Today shows one verse about prayer each day (`src/lib/verses.ts`). To add a verse, add a line to the list.

Scripture quotations are from the ESV® Bible (The Holy Bible, English Standard Version®), © 2001 by Crossway, a publishing ministry of Good News Publishers. Used by permission. All rights reserved.
