import type { ReactNode } from 'react';
import '@fontsource/source-sans-3/400.css';
import '@fontsource/source-sans-3/600.css';
import '@fontsource/source-serif-4/500.css';
import '@fontsource/inter/400.css';
import '@fontsource/inter/600.css';
import '@fontsource/manrope/500.css';
import '@fontsource/manrope/600.css';
import './globals.css';

export const metadata = {
  title: 'Physical OS',
  description: 'Local-first control for physical environments.',
};

export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `try{if(localStorage.getItem('pos-theme')==='light')document.documentElement.classList.add('light')}catch(e){}`,
          }}
        />
      </head>
      <body className="min-h-screen antialiased">{children}</body>
    </html>
  );
}
