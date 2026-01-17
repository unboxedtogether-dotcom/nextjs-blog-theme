# Unboxed Together

A clean, professional website for Unboxed.Together Ltd to verify the organisation in Google Play Console and capture early testers for our food additives barcode-scanning app.

## Tech Stack

- [Next.js](https://github.com/vercel/next.js) v16 (Pages Router)
- [Tailwind CSS](https://tailwindcss.com/) v4
- Netlify Forms for email capture
- Static site generation for fast performance

## Site Structure

- **/** - Home page with hero, features, and email signup form
- **/story** - My Story page (placeholder content ready for personal journey)
- **/book** - Buy the Book + Reviews page
- **/brainz** - Brainz Magazine publications page
- **/socials** - Social media links page

## Configuration

All site content is centralized in `utils/site-config.js` for easy editing:

- Company information
- Social media links
- Book purchase links
- Brainz Magazine articles
- Customer reviews
- SEO metadata

## Local Development

```bash
npm install
npm run dev
```

Open http://localhost:3000 to view the site.

## Build

```bash
npm run build
```

## Deployment

The site is configured to deploy on Netlify. Push to the main branch to trigger a deployment.

## Contact

- Email: support@unboxedtogether.com
- Instagram: @unboxed.together
- Facebook: /unboxed.together
