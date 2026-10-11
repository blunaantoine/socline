import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Sitemap pour les moteurs de recherche (Google Search Console, Bing…).
 * L'application est une SPA mono-page : la seule URL indexable est la racine.
 * Sert https://socline.oquitogo.com/sitemap.xml
 */
export default function sitemap(): MetadataRoute.Sitemap {
  return [
    {
      url: `${SITE_URL}/`,
      lastModified: new Date(),
      changeFrequency: 'daily',
      priority: 1,
    },
  ];
}
