import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Navbar from "@/components/Navbar";
import "./globals.css";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "medicoessentials old book POS",
  description: "Point of Sale and Seller Manager for Used Medical Textbooks — DH KUSMS Medico Essentials",
  manifest: "/manifest.json",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Adwait's Book POS" },
  formatDetection: { telephone: false },
  other: { "mobile-web-app-capable": "yes" },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  minimumScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1e293b",
  viewportFit: "cover",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}>
      <head>
        <link rel="apple-touch-icon" href="/logo.png" />
        <link rel="manifest" href="/manifest.json" />
        <meta name="apple-mobile-web-app-capable" content="yes" />
        <meta name="apple-mobile-web-app-status-bar-style" content="default" />
        <meta name="apple-mobile-web-app-title" content="Adwait's Book POS" />
        <meta name="theme-color" content="#1e293b" />
      </head>
      <body className="min-h-full flex flex-col bg-gray-50 text-gray-900">
        <Navbar />
        <div className="flex-1 flex flex-col">{children}</div>
      </body>
    </html>
  );
}
