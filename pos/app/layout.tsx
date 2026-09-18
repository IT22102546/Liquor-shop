import "./globals.css";
import type { Metadata } from "next";
import { ThemeProvider } from "./components/ThemeProvider";

export const metadata: Metadata = {
  title: "Bar Shop POS",
  description: "Point-of-sale and inventory control for bar shop operations",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/* Inline script runs synchronously before first paint — eliminates dark-mode flash */}
      <body>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{var t=localStorage.getItem('pos_theme');if(t==='dark'||t==='light')document.documentElement.dataset.theme=t;}catch(e){}`,
          }}
        />
        <ThemeProvider>{children}</ThemeProvider>
      </body>
    </html>
  );
}
