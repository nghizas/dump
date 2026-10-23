# Dump

A one-tap brain dump for iPhone. Your thoughts float in a cloud above a big circle. Tap the circle, type one thought in big type, hit **Dump** (or Return), and the thought joins the cloud. Newer thoughts render bigger and brighter. Older ones shrink and fade.

**☰ top left** switches between **DUMP** (the default), **DO**, **DEFER** and **DELEGATE**. DUMP is a cloud of every thought and the only place you can add one. Unprocessed thoughts are lavender. Processed ones take their list's colour: green for DO, amber for DEFER, blue for DELEGATE. The other three lists are checklists, oldest first. **⇄** moves a thought to one of the other two lists. **DONE** removes it everywhere, cloud included.

**DEFER is for things to schedule.** Each item has a **📅** button: pick a date, a time and a length (15m–2h or all day), then tap **Google Calendar**. A new tab opens Google Calendar with the event pre-filled; tap Save there, and Google Calendar handles the reminder. DEFER lists unscheduled items first (*Not scheduled*, in amber), then scheduled ones by date. Items whose date has passed stay in DEFER, marked *past*.

**PROCESS** (top right, on DUMP, with the number left to sort) goes through unprocessed thoughts oldest first. Each thought has **DO / DEFER / DELEGATE / DELETE**. The first three move it to that list. DELETE removes it immediately, with no confirmation.

**⚙ top right:**

- **EXPORT LISTS** saves `dump-YYYY-MM-DD.json` through the iOS share sheet. It includes every list that has something in it. Choose *Save to Files* and an iCloud Drive folder.
- **CLEAR DUMP** deletes unprocessed thoughts after you confirm. DO, DEFER and DELEGATE are kept.
- *Restore from a backup file* merges an export back in and skips thoughts that are already there.

## Run locally

```sh
uv run main.py          # or: python3 main.py
```

Open the printed `phone:` URL in Safari on your iPhone (same Wi-Fi). Over plain HTTP the app works, but offline mode needs HTTPS.

## Install on iPhone (HTTPS via GitHub Pages)

1. Push this repo to GitHub. Only the app code is published. Your thoughts never leave the phone.
2. Repo **Settings → Pages → Source: GitHub Actions**. The workflow in `.github/workflows/pages.yml` deploys `web/`.
3. Open `https://<user>.github.io/<repo>/` in Safari → Share → **Add to Home Screen**.

When you change the app, bump `VERSION` in `web/sw.js`.

## Data format

```json
{
  "app": "dump", "schema": 2, "exportedAt": "…",
  "lists": {
    "dump":     [{ "id": "mh3k2x9ab", "text": "call mom", "t": "2026-10-23T19:40:12.000Z" }],
    "do":       [],
    "defer":    [{ "id": "…", "text": "renew passport", "t": "…", "when": { "date": "2026-10-28", "time": "09:00", "mins": 30 } }],
    "delegate": []
  }
}
```

`t` is when the thought was dumped. `when` appears on scheduled DEFER items. An empty `time` means all day. Empty lists are left out of the export. Restore also accepts schema-1 files (`"items": [...]`) and puts them in the dump.
