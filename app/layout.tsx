import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "27届秋招筛选站",
  description: "筛选互联网、央国企、金融与银行校招，追踪截止日期、官方入口和核验依据。",
  icons: {
    icon: "/favicon.svg",
    shortcut: "/favicon.svg",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased">{children}</body>
    </html>
  );
}
