import Link from 'next/link';
import React from 'react';
import ConcertCount from '../ConcertCount/concertCount';
import HeaderAuth from './HeaderAuth';
import type { Concert } from '../../types/concert';
import './header.scss';

interface HeaderProps {
  siteTitle?: string;
  concerts?: Concert[];
}

const Header: React.FC<HeaderProps> = ({ siteTitle = "", concerts }) => (
  <header className="bg-light shadow-sm">
    <div className="container">
      <h1>
        <Link href="/">{siteTitle}</Link>
      </h1>
      <wbr />
      {concerts && <ConcertCount concerts={{ edges: concerts.map(c => ({ node: c })), totalCount: concerts.length }} />}

      <nav>
        <Link href="/">Home</Link>
        <Link href="/map">Map</Link>
        <HeaderAuth />
      </nav>
    </div>
  </header>
);

export default Header;
