# LAI Labs Coming Soon

A minimal Vite one-page landing site for `www.lai-labs.org`.

## Local development

```bash
npm install
npm run dev
```

## Production check

```bash
npm run build
npm run preview
```

## GitHub Pages

1. Push this project to the website repository.
2. Go to repository Settings → Pages.
3. Set Source to GitHub Actions.
4. Push to `main`.
5. Set the custom domain to `www.lai-labs.org`.
6. Configure DNS at Spaceship:
   - `A` records for `@` to GitHub Pages IP addresses.
   - `CNAME` record for `www` to `<github-owner>.github.io`.
