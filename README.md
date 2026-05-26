<div align="center">
<img width="1200" height="475" alt="GHBanner" src="https://github.com/user-attachments/assets/0aa67016-6eaf-458a-adb2-6e31a0763ed6" />
</div>

# Apex

Apex is a Vite + React landing page for a video editing studio focused on creators, influencers, and brands. The site highlights portfolio work, testimonials, process, and contact CTA flows for short-form video services.

## Stack 

- React 19
- Vite 6
- TypeScript
- Tailwind CSS 4
- Motion

## Local development

Prerequisite: Node.js 18+

1. Install dependencies:
   `npm install`
2. Start the dev server:
   `npm run dev`
3. Open:
   `http://localhost:3000`

## Scripts

- `npm run dev` - Start the local dev server on port 3000
- `npm run build` - Create a production build
- `npm run preview` - Preview the production build locally
- `npm run lint` - Run TypeScript type-checking

## SEO

The project includes foundational SEO assets for the homepage:

- `index.html` contains title, description, canonical, Open Graph, Twitter, and JSON-LD metadata
- `public/robots.txt` allows crawling and points search engines to the sitemap
- `public/sitemap.xml` publishes the production homepage URL
- `metadata.json` describes the Apex site

The canonical production URL is `https://apex-edit.netlify.app/`.

## Project structure

- `src/App.tsx` - Main single-page experience
- `src/index.css` - Global theme, typography, and animation styles
- `index.html` - Root HTML document and primary SEO metadata
- `public/` - Static crawl assets such as `robots.txt` and `sitemap.xml`

## Deployment notes

Build the site with `npm run build` and deploy the generated `dist/` output with any static hosting provider that supports SPA routing or simple file hosting.
