import "./globals.css";

export const metadata = {
  title: "Ledger Grove | ENS Treasury Agent",
  description:
    "ENS-powered treasury agent for role-based operations, Uniswap quotes, and KeeperHub execution handoff.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
