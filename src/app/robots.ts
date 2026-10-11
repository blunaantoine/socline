import type { MetadataRoute } from 'next';
import { SITE_URL } from '@/lib/site';

/**
 * robots.txt généré par Next.js (remplace le fichier statique public/robots.txt).
 * - Les API routes ne doivent pas être indexées.
 * - La directive Sitemap accélère l'indexation via Google Search Console.
 * Sert https://socline.oquitogo.com/robots.txt
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: '*',
        allow: '/',
        disallow: ['/api/'],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
  };
}
