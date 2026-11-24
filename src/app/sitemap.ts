import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * Sitemap pour les moteurs de recherche (Google Search Console, Bing…).
 * L'application est une SPA : racine, page partenaire et confidentialité.
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
    {
      url: `${SITE_URL}/partenaire`,
      lastModified: new Date('2026-11-24'),
      changeFrequency: 'monthly',
      priority: 0.8,
    },
    {
      url: `${SITE_URL}/confidentialite`,
      lastModified: new Date('2026-11-24'),
      changeFrequency: 'yearly',
      priority: 0.3,
    },
  ];
}
