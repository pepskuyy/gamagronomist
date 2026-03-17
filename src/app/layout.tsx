import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Gamagronomist - Tracking Stok & Demo Plot",
  description: "Sistem internal tracking stok produk pertanian dan aktivitas demo plot untuk tim agronomis",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="id">
      <head>
        <meta name="viewport" content="width=device-width, initial-scale=1, maximum-scale=1" />
      </head>
      <body>{children}</body>
    </html>
  );
}
