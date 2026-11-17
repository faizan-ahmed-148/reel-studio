import "./globals.css";
import type { ReactNode } from "react";
import { Shell } from "./components/Shell";

export const metadata = { title: "Reel Studio", description: "AI software reels — generate, voice, render and auto-post" };

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <Shell>{children}</Shell>
      </body>
    </html>
  );
}
