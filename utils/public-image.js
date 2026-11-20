// Server-only helper (use inside getStaticProps). Finds an uploaded photo in /public by
// base name so a new upload appears on the next deploy without code changes.
import fs from 'node:fs';
import path from 'node:path';

const EXTENSIONS = ['.jpg', '.jpeg', '.png', '.webp', '.JPG', '.JPEG', '.PNG', '.WEBP'];

export function findPublicImage(folder, baseName) {
  const dir = path.join(process.cwd(), 'public', folder);
  for (const ext of EXTENSIONS) {
    if (fs.existsSync(path.join(dir, `${baseName}${ext}`))) return `/${folder}/${baseName}${ext}`;
  }
  return null;
}

export function resolvePhotos(folder, photos) {
  return Object.fromEntries(
    Object.entries(photos).map(([key, photo]) => [key, { ...photo, src: findPublicImage(folder, photo.name) }]),
  );
}
