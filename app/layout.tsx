import type { Metadata } from "next";
import "./globals.css";
import { fontVariables } from "./fonts";
import { ThemeProvider } from "@/components/theme-provider";
import { ConvexClientProvider } from "@/components/convex-client-provider";
import { Toaster } from "@/components/ui/sonner";
import { Analytics } from "@vercel/analytics/react";

export const metadata: Metadata = {
  metadataBase: new URL('https://nba2kapi.com'),
  title: {
    default: 'NBA 2K API - Free REST API for Player Ratings & Stats',
    template: '%s | NBA 2K API',
  },
  description: 'The only free NBA 2K API. Access player ratings, team rosters, attributes, and badges via REST API. Developer-friendly documentation and playground.',
  keywords: ['NBA 2K API', 'NBA 2K27 API', 'NBA 2K ratings API', 'NBA 2K player stats', '2K API', 'basketball API', 'NBA 2K player ratings'],
  authors: [{ name: 'Wilson Overfield', url: 'https://github.com/wkoverfield' }],
  creator: 'Wilson Overfield',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nba2kapi.com',
    siteName: 'NBA 2K API',
    title: 'NBA 2K API - Free REST API for Player Ratings',
    description: 'The only free NBA 2K API. Access player ratings, team rosters, and detailed attributes via REST API.',
    images: [
      {
        url: '/og-image.png',
        width: 1200,
        height: 630,
        alt: 'NBA 2K API',
      },
    ],
  },
  twitter: {
    card: 'summary_large_image',
    title: 'NBA 2K API - Free REST API for Player Ratings',
    description: 'The only free NBA 2K API for developers. Access player ratings, team rosters, and stats.',
    images: ['/og-image.png'],
  },
  icons: {
    icon: "/icon",
    apple: "/apple-icon",
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${fontVariables} antialiased`}
        suppressHydrationWarning
      >
        <ConvexClientProvider>
          <ThemeProvider
            attribute="class"
            defaultTheme="system"
            enableSystem
            disableTransitionOnChange
          >
            <div className="flex min-h-screen flex-col">
              <main className="flex-1">{children}</main>
            </div>
            <Toaster />
            <Analytics />
          </ThemeProvider>
        </ConvexClientProvider>
      </body>
    </html>
  );
}
