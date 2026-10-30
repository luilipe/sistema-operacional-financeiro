import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Controle Operacional Financeiro | Ouro Fino",
  description: "Importação, conferência e rastreabilidade de documentos fiscais e lançamentos financeiros.",
  icons: { icon: "/favicon.svg", shortcut: "/favicon.svg" },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return <html lang="pt-BR"><body>{children}</body></html>;
}
