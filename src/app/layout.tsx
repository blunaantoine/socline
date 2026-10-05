import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ApiAuthProvider } from "@/components/ApiAuthProvider";
import { RealtimeNotifications } from "@/components/RealtimeNotifications";

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
  title: "Socline - Votre lavage auto, livré à votre porte",
  description: "Réservez un lavage professionnel en quelques clics. Nos laveurs certifiés viennent à vous, où que vous soyez.",
  keywords: ["Socline", "lavage auto", "car wash", "Togo", "Lome", "mobile car wash"],
  authors: [{ name: "Socline Team" }],
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
    description: "Votre lavage auto, livré à votre porte",
    url: "https://socline.tg",
    siteName: "Socline",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Socline - Lavage Auto Mobile",
    description: "Votre lavage auto, livré à votre porte",
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
        <Toaster />
      </body>
    </html>
  );
}
