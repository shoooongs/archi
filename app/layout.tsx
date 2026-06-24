import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Archi",
  description: "생각을 그냥 흘려보내지 말고",
  appleWebApp: {
    capable: true,
    title: "Archi",
    // 상태 바를 반투명하게 해서 콘텐츠가 노치 영역까지 확장되도록
    statusBarStyle: "black-translucent",
  },
};

// viewport와 themeColor는 metadata가 아닌 별도 export로 분리 (Next.js 요구 사항)
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  // iPhone 노치·Dynamic Island 영역까지 콘텐츠를 확장
  viewportFit: "cover",
  themeColor: "#000000",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="en"
      className={`${geistSans.variable} ${geistMono.variable} antialiased`}
    >
      <head>
        {/* Explicit viewport — insurance alongside Next.js viewport export */}
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover"
        />
        {/* Nanum Myeongjo — Korean serif web font */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          href="https://fonts.googleapis.com/css2?family=Nanum+Myeongjo:wght@400;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="flex flex-col overflow-hidden">{children}</body>
    </html>
  );
}
