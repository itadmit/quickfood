"use client";

import { useEffect, useState } from "react";
import { THEMES, type ThemeId } from "@/lib/themes";
import styles from "../page.module.css";

type Client = {
  slug: string;
  name: string;
  logoUrl: string | null;
  logoLetter: string;
  themeId: ThemeId;
};

function pickSix(list: Client[]): Client[] {
  const a = [...list];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a.slice(0, 6);
}

function displayName(name: string): string {
  return name.split(/[\n|]/)[0].trim() || name;
}

export default function RecentClientsRow({ clients }: { clients: Client[] }) {
  const [shown, setShown] = useState<Client[]>(() => clients.slice(0, 6));

  useEffect(() => {
    setShown(pickSix(clients));
  }, [clients]);

  return (
    <div className={styles.recentClientsRow}>
      {shown.map((c) => {
        const label = displayName(c.name);
        return (
          <a
            key={c.slug}
            href={`/s/${c.slug}`}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.recentClientTile}
            title={label}
          >
            {c.logoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={c.logoUrl}
                alt={label}
                loading="lazy"
                className={styles.recentClientLogo}
              />
            ) : (
              <span
                className={styles.recentClientLetter}
                style={{ background: (THEMES[c.themeId] ?? THEMES.fresh).primary }}
              >
                {c.logoLetter}
              </span>
            )}
            <span className={styles.recentClientName}>{label}</span>
          </a>
        );
      })}
    </div>
  );
}
