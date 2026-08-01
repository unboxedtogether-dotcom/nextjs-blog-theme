# Unboxed Together

A clean, professional website for Unboxed.Together Ltd to verify the organisation in Google Play Console and capture early testers for our food additives barcode-scanning app.

## Tech Stack

- [Next.js](https://github.com/vercel/next.js) v16 (Pages Router)
- [Tailwind CSS](https://tailwindcss.com/) v4
- Netlify Forms for email capture
- Netlify Database for the searchable additive library
- Static site generation for fast performance

## Site Structure

- **/** - Home page with hero, features, and email signup form
- **/additives** - Search approved additive profiles by E number or name
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

## Additive Library

The additive workbook is imported into Netlify Database through migrations in `netlify/database/migrations/`. Public searches use `/api/additives` and return only the fields used by the additive card. Research status, evidence strength, source URLs, review dates, and evidence notes remain private database fields.

Rows marked `Source list imported - detail pending` are imported for future review but are not published in search results.

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
