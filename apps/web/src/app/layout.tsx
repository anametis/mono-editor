import type { Metadata } from "next";
import type { ReactNode } from "react";
import "@kara/tokens/styles.css";
export const metadata: Metadata = {
  metadataBase: new URL(process.env.WEB_URL ?? "http://localhost:3000"),
  title: { default: "Kara journal", template: "%s | Kara" },
  description: "Stories selected with care, reviewed before publication.",
};
export default function Layout({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <body>
        <a className="skip" href="#main">
          Skip to content
        </a>
        <header className="masthead">
          <a className="brand" href="/">
            Kara journal
          </a>
          <nav>
            <a href="/account">Your account</a>
          </nav>
        </header>
        <main id="main">{children}</main>
        <footer>Kara journal. Considered stories, carefully published.</footer>
      </body>
    </html>
  );
}
