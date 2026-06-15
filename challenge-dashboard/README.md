# Challenge Progress Dashboard

A fully responsive, offline-ready Progressive Web App for tracking learning challenges, milestone progress, streaks, achievements, settings, and roadmaps.

## Run Locally

Serve the folder with any static server:

```bash
npx serve .
```

Or use another static server from the `outputs/challenge-dashboard` folder. Service workers require `https://` or `localhost`; opening `index.html` directly from the file system will not install the service worker.

## iPhone Installation

1. Host the app over HTTPS.
2. Open the app in Safari on iPhone.
3. Tap Share.
4. Tap Add to Home Screen.
5. Launch it from the Home Screen.

The app includes:

- `manifest.json`
- `sw.js`
- Apple mobile web app meta tags
- `apple-touch-icon.png`
- maskable and standard PNG icons
- safe-area viewport support for iPhone notches and Home indicator

## PWA Behavior

- The service worker precaches the application shell.
- The app can relaunch offline after the first successful load.
- Runtime GET requests are cached opportunistically.
- User data is stored in `localStorage`, not in the service worker cache.

## Local Storage

Keys used:

- `challenge-dashboard:data:v1`: challenges, progress, streaks, achievements, and roadmaps
- `challenge-dashboard:settings:v1`: theme and future user settings

## Structure

```text
challenge-dashboard/
  index.html
  manifest.json
  sw.js
  css/
    styles.css
  js/
    storage.js
    app.js
  icons/
    apple-touch-icon.png
    icon-192.png
    icon-512.png
    maskable-512.png
```

The storage layer is isolated in `js/storage.js` so a future backend or cloud database can replace local persistence without rewriting rendering and interaction logic.
