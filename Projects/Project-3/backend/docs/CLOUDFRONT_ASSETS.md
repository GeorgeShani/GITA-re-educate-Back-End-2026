# CloudFront brand assets

Gridline email and frontend branding may use a public CloudFront URL such as
`https://assets.gridline.example.com`. This distribution serves **public, versioned brand assets only**.
Customer spreadsheet files remain private and continue to use short-lived signed download URLs.

## AWS topology

Create the AWS resources outside this repository:

1. A dedicated private S3 bucket for public brand source objects. Block all public S3 access.
2. A CloudFront distribution whose origin is that bucket.
3. CloudFront Origin Access Control (OAC), with a bucket policy that permits reads only from that distribution.
4. HTTPS with an ACM certificate when using a custom assets hostname.
5. Long-lived immutable caching for versioned keys such as `/brand/v1/logo.png`.

Do **not** reuse `AWS_S3_BUCKET`, the private spreadsheet bucket, or expose that bucket through this distribution.
The spreadsheet bucket contains tenant data and must remain reachable only through Gridline's storage driver and
short-lived presigned URLs.

This repository does not provision AWS resources. Set `ASSETS_BASE_URL` to the CloudFront origin after the separate
infrastructure exists. Production refuses to boot without an HTTPS value; development may omit it. Gridline removes
trailing slashes and appends the versioned brand path itself.

## In the web app

Today the web app does not load brand images from this distribution: it draws its own logo from the repository
(`frontend/src/app/icon.svg`) and does not use `next/image`. Only **emails** use `ASSETS_BASE_URL`. If the site ever loads an image
from the CDN, it must independently allow the hostname:

- Add the CloudFront hostname to `images.remotePatterns` in `next.config.ts` before using `next/image`.
- Add that HTTPS origin to a Content Security Policy `img-src`. (The site sets no CSP of its own today: Caddy adds the other
  security headers, and the API sets its own through helmet.)
- Keep the origin configurable; do not hard-code a development or production distribution hostname.

Email clients do not execute the frontend configuration. MJML renders an accessible image with explicit width and alt
text when `ASSETS_BASE_URL` is configured, and falls back to the text wordmark when it is absent.

## Checking it

`npm run verify:integrations` (see [`OPERATIONS.md`](./OPERATIONS.md)) fetches `${ASSETS_BASE_URL}/brand/v1/logo.png` and fails unless it
answers 200 with an image content type. The path is versioned: a new logo is a new `/brand/v2/` object and a one-line change in
`src/core/mail/brand.ts`, never an overwrite of `v1`.
