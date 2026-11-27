# Kay Pull Tracker

A small installable web app for tracking pulls toward Kay's 120-pull guarantee in Arknights: Endfield. You log your Oroberyl, HH permits, Origeometry and pulls done each day. It shows how much you still need per day, where your 120 pulls come from, and whether your pace gets you there before the banner ends on 23 Dec 2026.

Fan-made. Not affiliated with GRYPHLINE or Hypergryph.

## Files

| File | What it is |
|---|---|
| `index.html` | The page layout |
| `styles.css` | The dark lime look |
| `app.js` | Data, calculations, charts, saving, backup and install |
| `sw.js` | Lets the app open offline once it has been loaded |
| `manifest.webmanifest`, `icons/` | What makes it installable as an app |

Charts use [d3 v7.9.0](https://d3js.org) from jsDelivr. There is no build step and nothing to install.

## Run it on your computer

Any static file server works. With Python, from inside the `kay-tracker` folder:

```powershell
python -m http.server 8766
```

From anywhere else, give the full path instead, for example `python -m http.server 8766 -d D:\Myth\kay-tracker`. A 404 on every page means the server is pointed at the wrong folder.

Then open http://localhost:8766. Opening `index.html` by double-clicking also works, but the app can't be installed or used offline that way.

## Put it on GitHub and launch it as an app

1. Create an empty repository on github.com, for example `kay-tracker`. Don't add a README there.
2. Push this folder from inside `kay-tracker`:

   ```powershell
   git remote add origin https://github.com/YOUR-NAME/kay-tracker.git
   ```

   ```powershell
   git push -u origin main
   ```

3. On GitHub, go to **Settings → Pages**. Set **Source** to *Deploy from a branch*, branch `main`, folder `/ (root)`, and save.
4. After a minute the app is live at `https://YOUR-NAME.github.io/kay-tracker/`.
5. Open that link in Chrome or Edge and click **Install app** in the log card, or the install icon in the address bar. On a phone, use **Add to Home screen**. It then opens in its own window like any other app and works offline.

## Your data

Entries are saved in the browser you use, on that device only. They are not sent anywhere and aren't in the repository.

- **Export backup** downloads a `.json` file of every entry.
- **Import backup** loads one. Entries with the same date are replaced, others are kept.
- `my-log.json` in this folder holds your entries from the Claude dashboard (26 and 27 Nov). Import it once to carry them over. It's listed in `.gitignore`, so it won't be pushed to GitHub.

The installed app and the browser tab share the same saved entries. A different browser or device starts empty, so use a backup to move them.

## Updating banner facts

Pull cost, the banner end time, Monthly Pass rewards and the other fixed numbers are in the `FACTS` list at the top of `app.js`. For a new banner, change `banner_end`, plus the page text that names Kay and 23 Dec, and push again.
