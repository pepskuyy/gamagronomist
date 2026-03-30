import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Agrolens - Tracking Stok & Demo Plot",
  description: "Portal agronomi untuk pelacakan barang, permintaan, dan aktivitas",
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
