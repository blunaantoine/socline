import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ApiAuthProvider } from "@/components/ApiAuthProvider";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";
import { SITE_URL, SITE_NAME, SITE_DESCRIPTION, SITE_OG_IMAGE } from "@/lib/site";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const viewport: Viewport = {
  themeColor: "#FF9800",
  // App mobile-first : largeur réelle de l'appareil, pas de zoom intempestif,
  // et viewport-fit=cover pour gérer les encoches / safe areas iOS & Android.
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
};

export const metadata: Metadata = {
  // Base canonique : toutes les URLs de partage (OG/Twitter) en découlent.
  metadataBase: new URL(SITE_URL),
  title: "Socline - Votre lavage auto, livré à votre porte",
  description: SITE_DESCRIPTION,
  keywords: ["Socline", "lavage auto", "car wash", "Togo", "Lome", "lavage voiture Lomé", "mobile car wash", "lavage à domicile"],
  authors: [{ name: "Socline Team" }],
  // URL canonique : protège contre le contenu dupliqué (www / non-www / http…).
  alternates: {
    canonical: "/",
  },
  icons: {
    icon: [
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    other: [
      { rel: "manifest", url: "/site.webmanifest" },
    ],
  },
  manifest: "/site.webmanifest",
  // PWA sur l'écran d'accueil du téléphone : plein écran, sans barre de navigateur.
  appleWebApp: {
    capable: true,
    statusBarStyle: "black-translucent",
    title: "Socline",
  },
  formatDetection: {
    telephone: false,
  },
  openGraph: {
    title: "Socline - Lavage Auto Mobile",
    description: SITE_DESCRIPTION,
    url: SITE_URL,
    siteName: SITE_NAME,
    locale: "fr_TG",
    type: "website",
    images: [
      {
        url: SITE_OG_IMAGE,
        width: 1344,
        height: 768,
        alt: "Laveur Socline en train de laver une voiture avec mousse à Lomé",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Socline - Lavage Auto Mobile",
    description: SITE_DESCRIPTION,
    images: [SITE_OG_IMAGE],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="fr" suppressHydrationWarning>
      <head>
        <script
          src={`https://maps.googleapis.com/maps/api/js?key=${process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY}&libraries=places&v=weekly&loading=async`}
          async
          defer
        />
      </head>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ApiAuthProvider />
        <RealtimeNotifications />
        {children}
        {/* Toaster UNIQUE instance de l'app (page.tsx n'en monte pas) —
            position bas-centre remontée au-dessus de la barre de navigation :
            les notifications ne chevauchent plus le header/carte en haut
            (safe-area iOS respectée). */}
        <Toaster
          position="bottom-center"
          offset="calc(5rem + env(safe-area-inset-bottom, 0px))"
          visibleToasts={3}
        />
      </body>
    </html>
  );
}
