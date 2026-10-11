import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pour le serveur de production (standalone)
  // Pour le mobile, on utilise un script de build séparé avec output: 'export'
  output: process.env.BUILD_MODE === 'mobile' ? 'export' : 'standalone',
  
  // Configuration pour le mode mobile (static export)
  ...(process.env.BUILD_MODE === 'mobile' && {
    trailingSlash: true,
    images: {
      unoptimized: true, // Required for static export
    },
  }),
  
  /* config options here */
  typescript: {
    ignoreBuildErrors: true,
  },
  reactStrictMode: false,

  // firebase-admin contient des requires dynamiques (google-auth-library,
  // grpc-js) : on l'exclut du bundle Turbopack. Traçé dans le standalone
  // via node_modules copiés par Next (output: 'standalone').
  serverExternalPackages: ['firebase-admin'],
  
  // Headers pour CORS (API mobile)
  async headers() {
    return [
      {
        source: '/api/:path*',
        headers: [
          { key: 'Access-Control-Allow-Credentials', value: 'true' },
          { key: 'Access-Control-Allow-Origin', value: '*' },
          { key: 'Access-Control-Allow-Methods', value: 'GET,POST,PATCH,DELETE,OPTIONS' },
          { key: 'Access-Control-Allow-Headers', value: 'Authorization, Content-Type' },
        ],
      },
    ];
  },
};

export default nextConfig;
