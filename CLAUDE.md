# TMS Driver (TMS_Android_iPhone)

The drivers' phone app for TMS Truck: an installable web app (React 19 + Vite), published as a static site on Render (driver.nectrucking.com). All data comes from the TMS server (TMS repository).

## Rules

* **Version every change that goes live.** `npm version X.Y.Z --no-git-tag-version`, add a `CHANGELOG.md` entry, and start the commit message and PR title with `vX.Y.Z:`. See "Versions" in README.md.
* Never put model names or secrets in commits, code or docs.
* All times are shown in New York time.

## Build and test

```bash
npm ci
npm test
npm run build
```
