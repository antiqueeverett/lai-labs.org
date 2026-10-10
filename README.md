# LAI Labs website

Production website for Label AI (PVT) LTD at **https://www.lai-labs.org/**.
React, TypeScript, and Vite; deployed exclusively through the existing GitHub Pages workflow.

The production source was imported from `lai-labs-dev` branch `everett`, commit
`e7629f5741ba7a9d21b6a1ea34dc22c71a6da6b7`. The development repository remains separate and read-only during deployment updates.

## Local execution

Use Node.js **22.12 or newer** and npm. CI uses Node.js 22.

```powershell
npm ci
npm run dev
```

Open the URL Vite prints (normally http://127.0.0.1:5173/).
The enquiry form attempts to use the source Formspree endpoint in development; use the automated tests to exercise submissions without sending messages.

## Production build and verification

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npx playwright install chromium
npm run test:e2e
```

On Linux, install browser system dependencies with `npx playwright install --with-deps chromium`.
`npm ci` installs exactly the committed lockfile. Build output and installed dependencies are ignored by Git.

`npm run preview` serves the build for visual inspection at http://127.0.0.1:4173/.
The browser suite starts `node scripts/serve.mjs` itself on the same port; stop preview before running it.
This test server serves physical files and a real 404, so Vite's SPA fallback cannot hide missing route entries.

Tests cover built HTML and assets, domain files,
seven routes, refresh, desktop/mobile layouts, navigation/history, application selectors,
service tabs, segmentation controls, disabled booking, and intercepted email form success/failure responses.
Screenshots and failure traces are written to ignored `test-results/`.
No test sends real enquiries; Formspree delivery to the team inbox is not proven by intercepted tests.

To run the same browser checks against production:

```powershell
$env:SITE_URL = 'https://www.lai-labs.org'
npm run test:e2e
Remove-Item Env:SITE_URL
```

## GitHub Pages deployment

The existing deployment branch is **`nightly`**. Push a reviewed commit there.
`.github/workflows/deploy.yml` installs with `npm ci`, checks types/lint, builds,
runs automated and browser checks, uploads **`dist/`**, and deploys using the
existing `github-pages` environment. The existing `main` trigger and manual
workflow dispatch remain supported; no additional deployment branch is needed.

GitHub Pages must retain GitHub Actions as its publishing source.
After pushing, check the run for that commit under Actions, then inspect the live
home page and direct links such as `/solutions/`, `/industries/`, and `/contact/`.

`vite.config.ts` uses the domain root (`base: '/'`). `scripts/pages.mjs` reads
route declarations from `src/App.tsx` and emits an `index.html` for each named
route. This preserves BrowserRouter URLs and supports direct requests and reloads
without server rewrites. `404.html` loads the application for unknown URLs while
retaining the host's HTTP 404 status. Keep route declarations literal, or update
this generator and the route tests when introducing dynamic routes.

`public/CNAME` retains `www.lai-labs.org`; `public/.nojekyll` is retained. Vite copies
both into the deployment artifact. Canonical and social preview URLs use the
production domain. Keep the existing DNS and Pages custom-domain settings.

## Contact and deferred calendar booking

The existing email enquiry flow is preserved, including the source Formspree
form `xeebypqv`. No new form endpoint, call-request workaround, or service is added.
Production network failures stay visible; automated tests intercept requests and
verify both success and failure without sending messages. Actual provider delivery
to the team inbox remains outside those checks.

**Post-launch TODO: connect and verify calendar booking.** Booking integration is
explicitly deferred. The calendar control is disabled and the interface says
"Call scheduling is not yet available. Please continue by email."
The existing booking handlers, date picker, and suggested-availability module are
preserved for later integration. The source API files and environment example remain
unchanged in `lai-labs-dev` at the baseline commit above; they are excluded from this
static artifact because GitHub Pages cannot execute them.

Missing dependency: an approved, configured server backend for real calendar
availability and event creation, with the host calendar's Google or Microsoft
credentials held server-side. Current source availability is mock data.

Next steps, in a separately authorized post-launch task:

1. Choose and configure the backend and host calendar; review the source `api/`
   handlers and `.env.example`, including authentication, abuse protection, timezone
   handling, provider permissions, and safe error responses.
2. Connect the UI to real free/busy data and event creation; prevent stale-slot and
   concurrent booking conflicts. Never expose OAuth credentials in Vite variables.
3. Verify provider failures, genuine availability, timezone boundaries, event
   creation, and invitation delivery with authorized test accounts.
4. Enable the calendar control only after those checks pass and update this README.

This integration is not a launch acceptance requirement. The minimal UI disablement
can be reversed once its backend is ready; it does not create a second deployment mechanism.

## Maintenance and scope

- `src/` contains the reachable application, animation utilities, and styles.
- `public/` contains referenced assets, robots policy, domain files, and the
  preserved [image provenance notice](public/img/NOTICE.md). Its historical
  provenance limitations remain recorded; importing an image does not establish new rights.
- `VITE_SHOW_LEADERSHIP_PROFILES=true` opts into leadership profiles at build time;
  the source default remains off. Rebuild after changing it.
- `scripts/`, `tests/`, and Playwright configuration support production routing
  and repeatable release verification; they are not shipped as application files.
- Development hooks, knowledge files, Vercel configuration/API code, mock tooling,
  unused assets, generated output, and the previous landing page are excluded.

For later source updates, review the intended `everett` commit and bring over only
required application changes. Preserve the Pages adaptations, domain settings,
and the deferred-booking guard. Update dependencies and the lockfile together, then rerun
the checks above before committing and pushing.

The pre-migration landing page remains recoverable at
`f68d831becd1f0001ed0dd2e34daea7d03d8d8e6`. Roll back a deployment through a new
reviewed revert commit on `nightly`; do not force-push or rewrite deployment history.
