import { SerwistProvider } from "@serwist/turbopack/react";
import type { Metadata, Viewport } from "next";
import { Fraunces, Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const fraunces = Fraunces({
  variable: "--font-fraunces",
  subsets: ["latin"],
  axes: ["opsz"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  applicationName: "Notesflow",
  title: "Notesflow",
  description: "To-do lists and Markdown notes in one fast, private workspace.",
  appleWebApp: { capable: true, statusBarStyle: "default", title: "Notesflow" },
  formatDetection: { telephone: false },
  icons: { apple: "/icons/apple-touch" },
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#f8fafc" },
    { media: "(prefers-color-scheme: dark)", color: "#0e1117" },
  ],
};

// Applies the saved look (written by ThemeSync; older versions kept the theme in the UI store) before first paint to avoid a light/dark flash.
const themeScript = `(function(){try{var a=JSON.parse(localStorage.getItem("notesflow:appearance")||"null");if(!a){var u=JSON.parse(localStorage.getItem("notesflow:ui")||"{}").state;a={theme:u&&u.theme}}var s=a.theme||"system";var d=s==="dark"||(s==="system"&&matchMedia("(prefers-color-scheme: dark)").matches);var r=document.documentElement;r.classList.toggle("dark",d);var v=a.vars||{};for(var k in v)r.style.setProperty(k,v[k])}catch(e){}})()`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      className={`${geistSans.variable} ${geistMono.variable} ${fraunces.variable} h-full antialiased`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeScript }} />
      </head>
      <body className="min-h-full">
        {/* No reload when the connection returns: the app works offline and sync catches up on its own, while a
            reload would throw away whatever is being typed. The offline fallback page reloads itself. */}
        <SerwistProvider
          swUrl="/serwist/sw.js"
          disable={process.env.NODE_ENV === "development"}
          reloadOnOnline={false}
        >
          {children}
        </SerwistProvider>
      </body>
    </html>
  );
}
