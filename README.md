# LAI Labs website

Production: **https://www.lai-labs.org/** (currently redirects to **https://lai-labs.org/**).

| Deployment information | Authoritative location |
| --- | --- |
| Publishing branch | `nightly` |
| Build, deployment and live acceptance | [Deploy GitHub Pages workflow](.github/workflows/deploy.yml) · [run history](https://github.com/antiqueeverett/lai-labs.org/actions/workflows/deploy.yml) |
| Version currently serving | [`release.json`](https://lai-labs.org/release.json) |
| Accepted artifacts and recovery bundles | [Production releases](https://github.com/antiqueeverett/lai-labs.org/releases) — require `acceptance.json`; do not select by the “latest” label |
| Deploy, verify, recover, maintain DNS | [Operations runbook](docs/operations.md) |
| Intended static-hosting contract | [deployment.json](deployment.json) |

A green build alone is not release acceptance. The workflow builds once, tests that output,
archives it, deploys it through the existing `github-pages` environment, verifies the public
website, and publishes an acceptance record. Failed browser checks prevent deployment.
Failed live checks leave the candidate unaccepted and require diagnosis/recovery.

## Run locally

Use **Node.js 24.11.1** (the CI version) and its bundled npm. From this directory:

```powershell
npm ci
npm run dev
```

Vite prints the development URL. Development form submissions use the existing Formspree
endpoint; automated tests intercept them and never send enquiries.

## Build and verify

```powershell
npm run typecheck
npm run lint
npm run build
npm test
npm run release:verify
npx playwright install chromium webkit
npm run test:e2e
```

Linux also needs browser system dependencies: `npx playwright install --with-deps chromium webkit`.
The browser suite starts its own static server on port 4173; stop `npm run preview` first.
See the runbook for visual-baseline review and live checks. Generated output, dependencies,
release manifests, traces and local reports are ignored by Git.

## Maintenance boundaries

- This is the production repository. Import reviewed application changes from `lai-labs-dev`
  branch `everett`; never switch or modify that repository during deployment work.
  The imported baseline is recorded in `deployment.json`.
- Preserve the Pages adaptations and test every named route on direct request and reload.
- Calendar booking is **deferred**. Its UI remains disabled; backend integration is a
  [separate post-launch task](docs/operations.md#deferred-calendar-booking).
- The existing Formspree enquiry flow is preserved. Intercepted tests do **not** prove inbox delivery.
- `VITE_SHOW_LEADERSHIP_PROFILES=true` enables profiles at build time; the default remains off.
- Preserve the [image provenance notice](public/img/NOTICE.md); importing an image does not establish rights.
- GitHub administrative settings are unchanged. Required-review enforcement, domain verification
  status and release immutability must not be inferred from repository files.
