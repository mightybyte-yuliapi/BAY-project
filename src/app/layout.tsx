import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Providers } from "./providers";

const jakartaSans = Plus_Jakarta_Sans({
  variable: "--font-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Bay Watch",
  description: "AI voice agent that qualifies inbound leads for AppMakers USA.",
  icons: {
    icon: "/icon.png",
    apple: "/icon.png",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`dark ${jakartaSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="bg-mb-bg text-zinc-100 min-h-full flex flex-col">
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
