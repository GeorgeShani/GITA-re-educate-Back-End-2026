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

## Frontend milestone

The Next.js application must independently allow the chosen hostname:

- Add the CloudFront hostname to `images.remotePatterns` in `next.config.ts` before using `next/image`.
- Add that HTTPS origin to the frontend Content Security Policy `img-src` directive.
- Keep the origin configurable; do not hard-code a development or production distribution hostname.

Email clients do not execute the frontend configuration. MJML renders an accessible image with explicit width and alt
text when `ASSETS_BASE_URL` is configured, and falls back to the text wordmark when it is absent.
