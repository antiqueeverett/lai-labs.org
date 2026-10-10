# Production operations

## Ownership and authority

Repository: `antiqueeverett/lai-labs.org`. Production branch: `nightly`.
The existing environment `github-pages` permits deployment from `nightly`.
The repository owner operates deployments; a deputy and an incident-response time target have
not been designated. Do not invent an availability or recovery-time guarantee.

`deployment.json` owns the intended domain, routes, source baseline and deferred-booking flag.
The workflow owns its actual trigger, job permissions, Node version and retention settings.
GitHub Pages account settings and Spaceship DNS own the domain binding. Repository files do
not override those settings. Administrative settings were explicitly excluded from this task.
PR checks are available, but branch protection/review enforcement is not enabled by this change.

## Deploy a normal release

1. Start with a clean deployment checkout and review `git status`, the diff and the intended
   `everett` source commit. Preserve unrelated edits. Run the README verification commands.
2. Review route assertions and visual baselines. Never regenerate baselines merely to make
   a failing check green. Confirm booking is still disabled and no API/server files enter `dist`.
3. Commit the coherent change and push `nightly` using existing Git authentication. The existing
   [workflow](../.github/workflows/deploy.yml) runs automatically. Pull requests to `nightly`
   run the build checks without publishing.
4. Open [Actions](https://github.com/antiqueeverett/lai-labs.org/actions/workflows/deploy.yml)
   and select the run for the exact commit. All five jobs must succeed: build, visual comparisons, archive,
   deployment/live verification, and acceptance. Do not report a skipped or failed gate as passing.
5. Inspect the public website and its `/release.json`. Locate the corresponding published
   production release and inspect its `acceptance.json`. Its commit and content digest must
   match the manifest and live-check evidence.

The same tested `dist` bytes are uploaded to Pages. The deployment job has Pages/OIDC write
permission; build has read-only contents access. Separate archive/acceptance jobs use the
existing workflow token with contents write permission to retain release assets. No new
credentials, branch, hosting service or deployment mechanism is introduced.

The whole publishing workflow shares the existing `pages` concurrency group. A branch-SHA
check immediately before deployment rejects stale runs. This protects cooperating workflow
runs; it does not prevent an administrator or another credential from bypassing the workflow.

## Release records and evidence

Each generated `release.json` identifies the deployment commit, imported source baseline,
workflow run, Node version, lockfile digest and relevant build flags. Local builds use the
current HEAD and `runId: local`; they are not proof of a committed production release.

The external `release-manifest.json` lists SHA-256 hashes of every artifact file, including
`release.json`. Its content digest hashes that ordered file map; it is not a self-referential
hash embedded in the file being hashed. The tar archive has a separate SHA-256 checksum.

Before publishing, the workflow creates a draft release containing:

- `release-bundle.tar`: exact tested website bytes;
- `release-bundle.sha256`: archive checksum;
- `release-manifest.json`: file hashes and release identity.

Only after live byte/HTTP checks and live browser checks pass does the workflow attach
`acceptance.json` and publish the release. A draft is a candidate, never an accepted recovery
point. Release notes and GitHub's “latest” label are not acceptance evidence.

Release immutability was not changed. These records are integrity checks within the existing
repository trust boundary, not protection against an actor who can replace all release
assets. Keep accepted recovery releases. Do not delete them as routine cleanup.

Actions retains Pages artifacts, manifests and browser/live evidence for 90 days, subject to
GitHub's configured retention cap. Release assets provide recovery beyond that Actions window.
Traces, screenshots and JSON results are available from the relevant run, including failed tests.
There is no independent uptime-monitoring service introduced by this change.

The original full-site launch is commit `ec3f5865ca27716ab8bfdd65548a855d3002d1a3`,
[run 38022492493](https://github.com/antiqueeverett/lai-labs.org/actions/runs/38022492493).
The first archive job preserves that original artifact unchanged as a `production-…-baseline`
release, after comparing its files with the still-live site. That legacy artifact has no
`release.json`; its manifest identifies it and records its original canonical metadata.
The earlier landing page remains in Git history at `f68d831becd1f0001ed0dd2e34daea7d03d8d8e6`.
Neither historical reference should be silently overwritten.

## Verify the website

Automated acceptance covers all seven routes, route-specific visible headings, navigation,
refresh, assets, responsive overflow, browser errors, service/application interactions,
intercepted form success/failure, deferred booking and selected visual baselines.
Chromium desktop/mobile and mobile WebKit are separate projects. Emulation is not proof of
physical-device behavior. Screenshot comparisons cover named surfaces, not every animation frame.

```powershell
$env:SITE_URL = 'https://www.lai-labs.org'
npm run test:e2e
Remove-Item Env:SITE_URL
```

For byte-level live verification, download the accepted release's manifest into the repository
root as `release-manifest.json`, then run `npm run release:live`. A manifest from a different
local build is not an appropriate oracle for production. The check verifies every file hash,
release identity, named routes with/without trailing slashes, canonical origin and a real 404.
It sends no enquiry or booking requests. The workflow retries boundedly for Pages propagation;
persistent mismatch remains a failure.

Visual baselines are platform/project-specific. CI compares the reviewed Windows baselines
on `windows-2022`, using the exact Linux-built Pages artifact without rebuilding it. Linux
Chromium/WebKit run the functional suite before and after deployment; the Windows visual job
is a separate pre-deployment gate. To propose a baseline deliberately:

```powershell
npx playwright test tests/browser/visual.spec.ts --update-snapshots=all
```

Inspect every resulting image against the intended layout and copy, review the Git diff,
then rerun without the update option. CI must never approve or update its own baselines.
Any missing baseline is a failed check. Moving visual comparisons to another operating system
requires separately inspected baselines. Font/network failures must be diagnosed, not hidden
by larger tolerances.

## Recover an application release

Use the existing workflow's **Run workflow** action on branch `nightly`:

1. Identify the last published accepted release. Verify `acceptance.json`, manifest and archive
   checksum. Preserve evidence from the failed run before recovery.
2. Read the currently served `/release.json` and record its exact identity as
   `commit:runId:runAttempt` (full commit, workflow run ID, and attempt, joined by colons).
3. Set `recovery_release` to the accepted release tag and `expected_current` to that live identity.
4. Run the workflow. It downloads the retained tar, checks its checksum, rejects unsafe paths,
   links and special files, and verifies the file inventory before uploading it to Pages.
   This restoration does not install npm dependencies or rebuild application code.
5. The publication guard refuses recovery if the branch advanced or the live version changed,
   including a different run/attempt deploying the same commit.
   Investigate rather than substituting a newer `expected_current` blindly.
6. Require the deployment and live byte/HTTP verification to succeed, then inspect the public
   website. Recovery reuses the archived release's earlier browser acceptance; it does not
   claim a fresh browser suite was executed in the dependency-free recovery path.

A restored legacy baseline has no `/release.json`. After that restoration, use a normal reviewed
release to move forward. The guarded recovery input requires an identifiable current release
and will refuse another recovery from that legacy state; do not weaken the guard ad hoc.

If a build fails, the previous production site remains in place. If deployment succeeds but
live checks or acceptance fail, the site may have changed: label it deployed but unaccepted,
diagnose the failing boundary, and recover if the application artifact caused the failure.
No automatic rollback occurs for a single network timeout. An artifact restore cannot repair
DNS, TLS, GitHub availability or Formspree delivery failures.

If release-asset creation is denied by repository policy, the archive job fails before deployment.
That is an access blocker for this recovery contract, not a reason to request new credentials
or silently remove the preservation gate.

## Domain and DNS reference

Observed October 10, 2026; these are observations, not newly applied settings:

| Item | Observed value |
| --- | --- |
| Requested public address | `https://www.lai-labs.org/` |
| Redirect destination | `https://lai-labs.org/` |
| Nameservers | `launch1.spaceship.net`, `launch2.spaceship.net` |
| Apex A records | `185.199.108.153`, `185.199.109.153`, `185.199.110.153`, `185.199.111.153` |
| `www` CNAME | `antiqueverett.github.io` |
| Repository owner | `antiqueeverett` |

The DNS target and repository owner differ in spelling. Do not “correct” it from this table
without authenticated ownership/configuration evidence. Pages settings, domain-verification
status and HTTPS-enforcement status were not changed or established through an administrative API.
Working HTTPS and a redirect do not prove account ownership verification.

The build's canonical and social URLs use the observed apex destination, while both public
addresses remain usable. `public/CNAME` is retained as historical deployment configuration;
GitHub ignores that file for custom Actions publishing. Changing it does not change the live
custom domain. See [GitHub's authoritative domain documentation](https://docs.github.com/en/pages/configuring-a-custom-domain-for-your-github-pages-site/managing-a-custom-domain-for-your-github-pages-site).

Diagnose separately: DNS resolution → HTTPS → redirects → release identity → application behavior.
Record observed results and timestamps. Do not change DNS/Pages configuration under this task.

## Source imports and maintenance

Read development content from the explicitly selected `everett` Git commit without switching
its working tree. Import only reachable application/resources. Review assets, routes, build
flags, lockfile changes, Pages adaptations and the booking guard. Update the imported baseline
in `deployment.json` when the application source is actually updated. Retain the image notice.

For a new route, update `src/App.tsx`, the policy route list and the independently specified
browser/production expectations. The generator supports literal single-segment routes and
fails when those declarations disagree with the policy; dynamic routes require an explicit
static-hosting design. GitHub Pages cannot execute server handlers.

Pinned action SHAs and the lockfile reduce drift; they do not prove bit-for-bit rebuilds across
all runner images or external font services. Record actual tool versions and restore archived
bytes during recovery. Review dependency/toolchain updates as ordinary tested changes.

## Deferred calendar booking

Booking integration is explicitly outside this release. The existing booking handlers,
date picker and suggested availability remain preserved; the calendar control is disabled
and says scheduling is not yet available. No Formspree call-request workaround is introduced.

Missing dependency: an approved backend serving real calendar free/busy information and
creating events, with Google/Microsoft credentials held server-side. Source availability is
mock data. Source API handlers and `.env.example` remain in the read-only development baseline.

A separate post-launch task must choose the approved backend/calendar, review authorization,
abuse protection, timezone handling and provider permissions, connect real availability/event
creation, handle stale slots and concurrent requests, verify invitations and failure cases
using authorized accounts, and only then enable the control. Never place provider secrets
in Vite variables. Existing enquiry delivery to the team inbox remains unverified by mocks.
