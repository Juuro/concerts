import React from 'react';
import Header from './Header/header';
import '../styles/layout.scss';

interface LayoutProps {
  children: React.ReactNode;
  concertCounts?: {
    past: number;
    future: number;
  };
}

const Layout: React.FC<LayoutProps> = ({ children, concertCounts }) => {
  return (
    <>
      <Header
        siteTitle="Concerts"
        concertCounts={concertCounts}
      />

      {children}

      <footer>© {new Date().getFullYear()} · Built with ❤️ on 🌍! 🤟🏳️‍🌈</footer>
    </>
  );
};

export default Layout;
