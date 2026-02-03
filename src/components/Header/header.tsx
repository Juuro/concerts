import Link from 'next/link';
import React from 'react';
import ConcertCount from '../ConcertCount/concertCount';
import HeaderAuth from './HeaderAuth';
import './header.scss';

interface HeaderProps {
  siteTitle?: string;
  concertCounts?: {
    past: number;
    future: number;
  };
}

const Header: React.FC<HeaderProps> = ({ siteTitle = "", concertCounts }) => (
  <header className="bg-light shadow-sm">
    <div className="container">
      <h1>
        <Link href="/">{siteTitle}</Link>
      </h1>
      <wbr />
      {concertCounts && <ConcertCount counts={concertCounts} />}

      <nav>
        <Link href="/">Home</Link>
        <Link href="/map">Map</Link>
        <HeaderAuth />
      </nav>
    </div>
  </header>
);

export default Header;
