# LAI Labs website

A clean Vite foundation for the LAI Labs website.

The current page is intentionally small: one beautiful launch page, no framework lock-in, no backend, no paid hosting requirement.

## Requirements

- Node.js 22 or newer
- npm 11 or newer recommended
- Git

## Local setup

From a clean repository root:

```powershell
npm install
npm run dev
```

Open the local URL printed by Vite, usually:

```text
http://127.0.0.1:5173/
```

## Production check before pushing

```powershell
npm run build
npm run preview
```

Open the preview URL printed by Vite and verify the page before pushing.

## Deploy to GitHub Pages

In the GitHub repository:

1. Open `Settings`.
2. Open `Pages`.
3. Under `Build and deployment`, set `Source` to `GitHub Actions`.
4. Push to `main` or `nightly`.

The workflow at `.github/workflows/deploy.yml` builds the Vite project and deploys the generated `dist/` folder.

## Custom domain

The project includes:

```text
public/CNAME
```

with:

```text
www.lai-labs.org
```

Vite copies this into `dist/CNAME` during production builds.

## Spaceship DNS

Use these records in Spaceship Advanced DNS:

```text
A      @      185.199.108.153
A      @      185.199.109.153
A      @      185.199.110.153
A      @      185.199.111.153
CNAME  www    antiqueverett.github.io
```

Keep the TTL at 1 minute while testing. Increase it after the site is stable if desired.

## Repository hygiene

Commit source files and the generated `package-lock.json` after your first successful local `npm install`.

Do not commit:

```text
node_modules/
dist/
.env
```

## If npm tries to use a wrong registry

This project includes `.npmrc` to force the public npm registry.

If your machine still uses a stale registry or a half-created install, run:

```powershell
taskkill /f /im node.exe 2>$null
Remove-Item -Recurse -Force .\node_modules -ErrorAction SilentlyContinue
Remove-Item -Force .\package-lock.json -ErrorAction SilentlyContinue
npm cache clean --force
npm install
```
