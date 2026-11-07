import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "PG Manager — Your properties, in good hands", template: "%s | PG Manager" },
  description: "A calmer way to run your paying guest accommodation business.",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
