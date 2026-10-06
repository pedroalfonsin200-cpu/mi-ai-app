import type { Metadata } from "next";
import { Geist } from "next/font/google";
import "./globals.css";

const geist = Geist({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Ramoncito — Tu asistente inteligente",
  description: "IA avanzada: chat, generación de imágenes, búsqueda web. Rápido, gratis, inteligente.",
  icons: {
    icon: "/favicon.ico",
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className={`${geist.className} bg-black text-white antialiased`}>
        {children}
      </body>
    </html>
  );
}
