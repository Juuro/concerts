import React from 'react';
import Header from './Header/header';
import type { Concert } from '../types/concert';
import '../styles/layout.scss';

interface LayoutProps {
  children: React.ReactNode;
  concerts?: Concert[];
}

const Layout: React.FC<LayoutProps> = ({ children, concerts }) => {
  return (
    <>
      <Header
        siteTitle="Concerts"
        concerts={concerts}
      />

      {children}

      <footer>© {new Date().getFullYear()} · Built with ❤️ on 🌍! 🤟🏳️‍🌈</footer>
    </>
  );
};

export default Layout;
