# Don Wells Lawn Care — Marketing Site

A clean, static marketing site for **Don Wells Lawn Care (DWLC)**, a family-run lawn care and snow removal company in Fond du Lac, Wisconsin. Built as one `index.html` plus a single Vercel serverless function for the contact form (powered by [Resend](https://resend.com)).

## Stack

- Static HTML / inline CSS / vanilla JS — no build step
- `/api/contact.js` — Vercel serverless function (Node.js, ES modules) using the Resend SDK
- Deployed on [Vercel](https://vercel.com)

## File Structure

```
/
├── index.html         # Single-page marketing site
├── api/
│   └── contact.js     # Serverless function for the quote form
├── package.json       # type: module, resend dependency
├── vercel.json        # Minimal config + security headers
└── README.md
```

## Setup

```bash
npm install
```

That's it — no build step. Open `index.html` in a browser for a static preview, or run `vercel dev` to test the API locally.

## Environment Variables

Add these in **Vercel → Project Settings → Environment Variables** (for the Production, Preview, and Development environments):

| Variable             | Description                                                              | Example                                 |
| -------------------- | ------------------------------------------------------------------------ | --------------------------------------- |
| `RESEND_API_KEY`     | API key from your [Resend dashboard](https://resend.com/api-keys)        | `re_XXXXXXXXXXXXXXXXXXXX`               |
| `CONTACT_TO_EMAIL`   | Inbox that should receive quote requests                                 | `don@donwellslawnandsnow.com`           |
| `CONTACT_FROM_EMAIL` | Verified sender address (must match a Resend-verified domain)            | `quotes@donwellslawnandsnow.com`        |

> The `CONTACT_FROM_EMAIL` domain must be verified in Resend before any messages will deliver. Use the domain you control (`donwellslawnandsnow.com`) and add the DNS records Resend gives you.

## Deploy

```bash
vercel --prod
```

Or push to GitHub and import the repo in the Vercel dashboard — Vercel will auto-detect the static site and the serverless function.

## Custom Domain

1. In **Vercel → Project Settings → Domains**, add `donwellslawnandsnow.com` (and `www.donwellslawnandsnow.com`).
2. Vercel will display the DNS records to set at your registrar:
   - `A` record on the apex (`donwellslawnandsnow.com`) pointing to `76.76.21.21`
   - `CNAME` on `www` pointing to `cname.vercel-dns.com`
3. Wait for DNS to propagate (usually minutes; up to 24 hours).
4. Vercel will automatically issue an SSL certificate.

## Replacing Placeholder Content

Search `index.html` for `<!-- PLACEHOLDER:` to find spots that need real content:

| What                       | Where                                                                       |
| -------------------------- | --------------------------------------------------------------------------- |
| Phone number               | Contact card + footer (`tel:+19205550000`)                                  |
| Email address              | Contact card + footer (`info@donwellslawnandsnow.com`)                      |
| Street address             | JSON-LD `LocalBusiness` schema in the `<head>`                              |
| Hero photo                 | `.hero` `background-image` URL — currently an Unsplash placeholder         |
| Hours / service area copy  | Contact card and footer                                                     |

The JSON-LD `LocalBusiness` block in `<head>` also has placeholders for `telephone` and `streetAddress` — update those for SEO.

## How the Contact Form Works

1. User fills out `#quoteForm` in `index.html`.
2. Vanilla JS posts JSON to `/api/contact`.
3. `api/contact.js` validates required fields, checks the honeypot, requires a 10+ character message, then sends a formatted HTML email via Resend.
4. `replyTo` is set to the submitter's email, so hitting "Reply" goes straight to them.
5. Inline success/error state is shown in the form without a page reload.

### Spam Protection

- Honeypot `<input name="website">` hidden off-screen — bots usually fill it, real users don't.
- Server rejects messages shorter than 10 characters.
- Server validates email format.

## Local Dev

```bash
npm install
npx vercel dev
```

Then visit `http://localhost:3000`. The serverless function runs against your local env vars — copy them to `.env.local` if testing email delivery.

## Credit

Site by [Sobojinski Solutions](https://sobojinski.com).
