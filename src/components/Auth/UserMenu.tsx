"use client";

import { useState, useRef, useEffect } from "react";
import Link from "next/link";
import { signOut, useSession } from "@/lib/auth-client";
import "./userMenu.scss";

export default function UserMenu() {
  const { data: session } = useSession();
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSignOut = async () => {
    await signOut();
    setIsOpen(false);
  };

  if (!session?.user) return null;

  return (
    <div className="user-menu" ref={menuRef}>
      <button
        className="user-menu__trigger"
        onClick={() => setIsOpen(!isOpen)}
        aria-expanded={isOpen}
        aria-haspopup="true"
      >
        {session.user.image ? (
          <img
            src={session.user.image}
            alt={session.user.name || "User"}
            className="user-menu__avatar"
          />
        ) : (
          <span className="user-menu__avatar user-menu__avatar--placeholder">
            {(session.user.name || session.user.email || "U")[0].toUpperCase()}
          </span>
        )}
      </button>

      {isOpen && (
        <div className="user-menu__dropdown">
          <div className="user-menu__info">
            <span className="user-menu__name">{session.user.name || "User"}</span>
            <span className="user-menu__email">{session.user.email}</span>
          </div>
          <hr className="user-menu__divider" />
          <Link href="/dashboard" className="user-menu__item" onClick={() => setIsOpen(false)}>
            My Concerts
          </Link>
          <Link href="/settings" className="user-menu__item" onClick={() => setIsOpen(false)}>
            Settings
          </Link>
          <hr className="user-menu__divider" />
          <button className="user-menu__item user-menu__item--danger" onClick={handleSignOut}>
            Sign Out
          </button>
        </div>
      )}
    </div>
  );
}
