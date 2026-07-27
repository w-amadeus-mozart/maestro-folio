import "./globals.css";

export const metadata = {
  title: "Maestro Folio — 3D Sheet Music Library",
  description: "Turn your sheet music into a beautiful interactive book."
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
