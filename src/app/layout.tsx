import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "WashGo - Votre lavage auto, livré à votre porte",
  description: "Réservez un lavage professionnel en quelques clics. Nos laveurs certifiés viennent à vous, où que vous soyez.",
  keywords: ["WashGo", "lavage auto", "car wash", "Togo", "Lome", "mobile car wash"],
  authors: [{ name: "WashGo Team" }],
  icons: {
    icon: "/logo.svg",
  },
  openGraph: {
    title: "WashGo - Lavage Auto Mobile",
    description: "Votre lavage auto, livré à votre porte",
    url: "https://washgo.tg",
    siteName: "WashGo",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "WashGo - Lavage Auto Mobile",
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
        {children}
        <Toaster />
      </body>
    </html>
  );
}
