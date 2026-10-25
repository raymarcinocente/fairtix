"use client";

import Image from "next/image";
import Link from "next/link";
import { useEffect, useRef, useState, type CSSProperties } from "react";
import {
  concerts,
  concertPrice,
  concertUrl,
  type Concert,
} from "@/lib/concerts";
import { toggleSaved, useShowcase } from "@/lib/showcase-store";
import { useSeating } from "@/lib/seating-store";
import { configuredPrices } from "@/lib/seating-data";
import { accountAction, useAuth } from "@/lib/auth-client";
import { useRouter } from "next/navigation";

function displayPrice(
  concert: Concert,
  snapshot: ReturnType<typeof useSeating>,
) {
  if (concert.id === "event-1") return concertPrice(concert);
  const event = snapshot.events.find((event) => event.eventId === concert.id);
  const venue = snapshot.venues.find((venue) => venue.id === event?.venueId);
  const prices = event && venue ? configuredPrices(event, venue) : [];
  return prices.length
    ? `${Math.min(...prices).toFixed(2)} USDC`
    : "Not on sale";
}

export function CinemaIcon({
  name,
  size = 20,
}: {
  name: string;
  size?: number;
}) {
  const shapes: Record<string, React.ReactNode> = {
    search: (
      <>
        <circle cx="10.5" cy="10.5" r="6.5" />
        <path d="m16 16 5 5" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 21v-3a7 7 0 0 1 14 0v3" />
      </>
    ),
    arrow: <path d="M4 12h16m-6-6 6 6-6 6" />,
    left: <path d="m15 5-7 7 7 7" />,
    right: <path d="m9 5 7 7-7 7" />,
    heart: (
      <path d="M20.5 5.5c-3-3-6.5-1-8.5 1-2-2-5.5-4-8.5-1S2 12 5 15l7 6 7-6c3-3 4.5-6.5 1.5-9.5Z" />
    ),
    home: (
      <>
        <path d="m3 10 9-7 9 7v11h-7v-7h-4v7H3Z" />
      </>
    ),
    ticket: (
      <>
        <path d="M3 5h18v5a2 2 0 0 0 0 4v5H3v-5a2 2 0 0 0 0-4Z" />
        <path d="M15 5v3m0 3v2m0 3v3" />
      </>
    ),
    pin: (
      <>
        <path d="M19 10c0 5-7 11-7 11S5 15 5 10a7 7 0 0 1 14 0Z" />
        <circle cx="12" cy="10" r="2" />
      </>
    ),
    calendar: (
      <>
        <rect x="3" y="5" width="18" height="16" rx="3" />
        <path d="M7 3v5m10-5v5M3 11h18" />
      </>
    ),
    close: <path d="m6 6 12 12M6 18 18 6" />,
    check: <path d="m5 12 4 4L19 6" />,
    music: (
      <>
        <path d="M9 18V5l11-2v13M9 8l11-2" />
        <ellipse cx="6" cy="18" rx="3" ry="3" />
        <ellipse cx="17" cy="16" rx="3" ry="3" />
      </>
    ),
    grid: (
      <>
        <rect x="3" y="3" width="7" height="7" rx="1" />
        <rect x="14" y="3" width="7" height="7" rx="1" />
        <rect x="3" y="14" width="7" height="7" rx="1" />
        <rect x="14" y="14" width="7" height="7" rx="1" />
      </>
    ),
  };
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      {shapes[name] || shapes.ticket}
    </svg>
  );
}
export function CinemaHeader({
  view,
}: {
  view: string;
  walletName?: string;
  onWallet: () => void;
}) {
  const [searchOpen, setSearchOpen] = useState(false);
  const { user, ready } = useAuth();
  const router = useRouter();
  const [signingOut, setSigningOut] = useState(false);
  const [authError, setAuthError] = useState("");
  return (
    <>
      <header className={`cinema-header ${view === "home" ? "over-hero" : ""}`}>
        <Link href="/" className="cinema-logo" aria-label="FairTix home">
          <CinemaIcon name="ticket" size={26} />
          fair<span>tix</span>
          <span className="logo-dot" />
        </Link>
        <nav className="floating-nav" aria-label="Main navigation">
          {[
            ["Home", "/", "home"],
            ["Concerts", "/concerts", "concerts"],
            ["Upcoming", "/upcoming", "upcoming"],
            ["Presale", "/presale", "presale"],
            ["Venues", "/venues", "venues"],
            ["My Tickets", "/tickets", "tickets"],
          ].map(([label, href, key]) => (
            <Link
              key={href}
              href={href}
              aria-current={
                view === key || (key === "concerts" && view === "event")
                  ? "page"
                  : undefined
              }
            >
              {label}
            </Link>
          ))}
        </nav>
        <div className="cinema-header-actions">
          <button
            className="cinema-icon-button"
            aria-label="Search concerts"
            onClick={() => setSearchOpen(true)}
          >
            <CinemaIcon name="search" />
          </button>
          {ready &&
            (user ? (
              <details className="account-menu">
                <summary aria-label="Account menu">
                  <CinemaIcon name="user" size={18} />
                </summary>
                <div className="account-menu-items">
                  {[
                    ["My Account", "/account"],
                    ["My Tickets", "/tickets"],
                    ["Transactions", "/account/transactions"],
                    ["My Wallet", "/account/wallet"],
                    ["Saved Concerts", "/saved"],
                  ].map(([label, path]) => (
                    <Link href={path} key={path}>
                      {label}
                    </Link>
                  ))}
                  <button
                    disabled={signingOut}
                    onClick={async () => {
                      setSigningOut(true);
                      setAuthError("");
                      try {
                        await accountAction("logout");
                        router.replace("/login");
                        router.refresh();
                      } catch (e) {
                        setAuthError((e as Error).message);
                      } finally {
                        setSigningOut(false);
                      }
                    }}
                  >
                    {signingOut ? "Signing out…" : "Sign Out"}
                  </button>
                  {authError && <p role="alert">{authError}</p>}
                </div>
              </details>
            ) : (
              <details className="account-menu">
                <summary aria-label="Account menu">
                  <CinemaIcon name="user" size={18} />
                </summary>
                <div className="account-menu-items">
                  <Link className="auth-nav-link" href="/login">
                    Sign In
                  </Link>
                  <Link
                    className="auth-nav-link auth-nav-register"
                    href="/register"
                  >
                    Register
                  </Link>
                  <Link href="/saved">Saved Concerts</Link>
                </div>
              </details>
            ))}
        </div>
      </header>
      {searchOpen && <SearchDialog onClose={() => setSearchOpen(false)} />}
    </>
  );
}
function SearchDialog({ onClose }: { onClose: () => void }) {
  const pricing = useSeating();
  const dialog = useRef<HTMLDialogElement>(null);
  const [query, setQuery] = useState("");
  useEffect(() => {
    const el = dialog.current;
    el?.showModal();
    return () => el?.close();
  }, []);
  const filtered = concerts.filter((c) =>
    `${c.artist} ${c.title} ${c.city} ${c.venue} ${c.genre}`
      .toLowerCase()
      .includes(query.toLowerCase()),
  );
  return (
    <dialog
      ref={dialog}
      className="search-dialog"
      aria-label="Search concerts"
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div className="search-input-wrap">
        <CinemaIcon name="search" size={24} />
        <input
          aria-label="Search by concert, genre or city"
          placeholder="Artists, concerts, cities…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          autoFocus
        />
        <button
          className="cinema-icon-button"
          onClick={onClose}
          aria-label="Close search"
        >
          <CinemaIcon name="close" />
        </button>
      </div>
      <div className="search-results">
        <span className="eyebrow">
          {query ? `${filtered.length} RESULTS` : "Search Concerts"}
        </span>
        {filtered.length ? (
          filtered.map((c) => (
            <Link href={concertUrl(c)} key={c.id} onClick={onClose}>
              <Image
                src={`/images/${c.image}.webp`}
                alt=""
                width={60}
                height={75}
              />
              <div>
                <strong>
                  {c.artist} {c.title}
                </strong>
                <span>
                  {c.genre} · {c.city} · From {displayPrice(c, pricing)}
                </span>
              </div>
              <CinemaIcon name="arrow" size={18} />
            </Link>
          ))
        ) : (
          <p>No concerts match “{query}”. Try a city or genre instead.</p>
        )}
      </div>
    </dialog>
  );
}

export function ConcertPoster({
  concert,
  index = 0,
  ranked = false,
}: {
  concert: Concert;
  index?: number;
  ranked?: boolean;
}) {
  const showcase = useShowcase();
  const pricing = useSeating();
  const saved = showcase.saved.includes(concert.id);
  return (
    <article
      className={`concert-card ${ranked ? "ranked" : ""}`}
      style={{ "--poster-accent": concert.accent } as CSSProperties}
    >
      {ranked && (
        <span className="poster-rank" aria-hidden="true">
          {index + 1}
        </span>
      )}
      <div className="poster-wrap">
        <Link
          href={concertUrl(concert)}
          className={`concert-poster poster-${concert.image}`}
          aria-label={`${concert.artist} ${concert.title}, ${concert.city}, from ${displayPrice(concert, pricing)}`}
        >
          <Image
            src={`/images/${concert.image}.webp`}
            alt={`${concert.genre} concert atmosphere`}
            fill
            sizes="(max-width: 560px) 43vw, (max-width: 1000px) 25vw, 220px"
          />
          <div className="poster-shade" />
          <span className="poster-top">
            {concert.id === "event-1" ? "Demo event" : "Demo event"}
          </span>
          <div className="poster-lettering">
            <span>{concert.artist}</span>
            <strong>{concert.title}</strong>
            <small>{concert.genre.toUpperCase()} · LIVE</small>
          </div>
          <span className="poster-bottom">
            {concert.city.toUpperCase()}
            <span>2026 / 27</span>
          </span>
        </Link>
        <button
          className={`save-concert ${saved ? "is-saved" : ""}`}
          aria-label={`${saved ? "Unsave" : "Save"} ${concert.artist} ${concert.title}`}
          aria-pressed={saved}
          onClick={() => toggleSaved(concert.id)}
        >
          <CinemaIcon name="heart" size={16} />
        </button>
        <div className="poster-hover">
          <p>{concert.date}</p>
          <p>
            {concert.venue} · {concert.city}
          </p>
          <Link href={concertUrl(concert)} className="poster-buy">
            {concert.status === "upcoming"
              ? "View details"
              : concert.status === "presale"
                ? "View presale"
                : "Buy tickets"}
            <span>
              From {displayPrice(concert, pricing)}{" "}
              <CinemaIcon name="arrow" size={14} />
            </span>
          </Link>
        </div>
      </div>
      <div className="concert-caption">
        <Link href={concertUrl(concert)}>
          {concert.artist === "THE"
            ? "The Golden Hour"
            : `${concert.artist} ${concert.title}`}
        </Link>
        <p>
          {concert.city}
          <span>·</span>
          {concert.genre}
        </p>
      </div>
    </article>
  );
}
export function PosterShelf({
  title,
  subtitle,
  items,
  ranked = false,
  id,
}: {
  title: string;
  subtitle?: string;
  items: Concert[];
  ranked?: boolean;
  id?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [scroll, setScroll] = useState({ left: false, right: true });
  function updateScroll() {
    const rail = ref.current;
    if (rail)
      setScroll({
        left: rail.scrollLeft > 2,
        right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
      });
  }
  useEffect(() => {
    const rail = ref.current;
    if (!rail) return;
    const observer = new ResizeObserver(() => {
      setScroll({
        left: rail.scrollLeft > 2,
        right: rail.scrollLeft + rail.clientWidth < rail.scrollWidth - 2,
      });
    });
    observer.observe(rail);
    return () => observer.disconnect();
  }, [items.length]);
  return (
    <section className={`poster-shelf ${ranked ? "ranked-shelf" : ""}`} id={id}>
      <div className="shelf-heading">
        <div>
          <h2>
            {title}
            <span className="yellow-period">.</span>
          </h2>
          {subtitle && <p>{subtitle}</p>}
        </div>
        <div className="shelf-controls">
          <button
            aria-label={`Previous ${title} concerts`}
            disabled={!scroll.left}
            onClick={() =>
              ref.current?.scrollBy({
                left: -(ref.current.clientWidth * 0.8),
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            <CinemaIcon name="left" size={16} />
          </button>
          <button
            aria-label={`Next ${title} concerts`}
            disabled={!scroll.right}
            onClick={() =>
              ref.current?.scrollBy({
                left: ref.current.clientWidth * 0.8,
                behavior: window.matchMedia("(prefers-reduced-motion: reduce)")
                  .matches
                  ? "instant"
                  : "smooth",
              })
            }
          >
            <CinemaIcon name="right" size={16} />
          </button>
        </div>
      </div>
      <div className="poster-rail" ref={ref} onScroll={updateScroll}>
        {items.map((c, i) => (
          <ConcertPoster key={c.id} concert={c} index={i} ranked={ranked} />
        ))}
      </div>
    </section>
  );
}
export function CinemaHome() {
  const pricing = useSeating();
  const [active, setActive] = useState(0);
  const [spotlight, setSpotlight] = useState(1);
  const [genre, setGenre] = useState("For you");
  const featured = [concerts[0], concerts[1], concerts[5]];
  const current = featured[active];
  useEffect(() => {
    const timer = setInterval(() => {
      if (!document.hidden) setActive((index) => (index + 1) % featured.length);
    }, 5000);
    return () => clearInterval(timer);
  }, [active, featured.length]);
  const list =
    genre === "For you"
      ? concerts
      : concerts.filter((c) =>
          genre === "Festivals"
            ? c.genre === "Festival"
            : genre === "Indie & rock"
              ? ["Indie rock", "Alternative"].includes(c.genre)
              : c.genre === genre,
        );
  return (
    <div className="cinema-home">
      <section className="cinematic-hero" aria-label="Featured concerts">
        <div className="hero-image-stack">
          {featured.map((c, i) => (
            <Image
              key={c.id}
              src={`/images/${c.image}.webp`}
              alt=""
              fill
              priority={i === 0}
              sizes="100vw"
              className={i === active ? "active" : ""}
            />
          ))}
        </div>
        <div className="hero-cinematic-shade" />
        <div className="cinematic-hero-content" key={current.id}>
          <div className="featured-eyebrow">
            <span /> <span className="featured-divider" />{" "}
          </div>
          <h1>
            <span>{current.artist}</span>
            <strong>{current.title}</strong>
          </h1>
          <p className="hero-tagline">{current.subtitle}</p>
          <p className="hero-concert-meta">
            <span>
              <CinemaIcon name="calendar" size={15} />
              {current.id === "event-1"
                ? "Date to be announced"
                : current.date.split(" · ")[0]}
            </span>
            <span>
              <CinemaIcon name="pin" size={15} />
              {current.city}
            </span>
          </p>
          <div className="cinematic-hero-buttons">
            <Link href={concertUrl(current)} className="button primary">
              Buy Tickets <CinemaIcon name="ticket" size={17} />
            </Link>
            <Link href={concertUrl(current)} className="button glass">
              View Details <CinemaIcon name="arrow" size={17} />
            </Link>
            <span className="hero-start-price">
              Starting from<strong>{displayPrice(current, pricing)}</strong>
            </span>
          </div>
          <span className="hero-demo-label">
            {current.id === "event-1"
              ? "Demo event · No real payments"
              : "Demo event · No real payments"}
          </span>
        </div>
        <div className="hero-bottom-line">
          <span className="hero-edition"></span>
          <div
            className="hero-pagination"
            aria-label="Featured concert pagination"
          >
            {featured.map((c, i) => (
              <button
                key={c.id}
                aria-label={`Feature ${c.artist} ${c.title}`}
                aria-pressed={i === active}
                onClick={() => setActive(i)}
              >
                <span />
              </button>
            ))}
          </div>
          <div className="hero-arrow-controls">
            <button
              onClick={() => setActive((active + 2) % 3)}
              aria-label="Previous featured concert"
            >
              <CinemaIcon name="left" size={17} />
            </button>
            <button
              onClick={() => setActive((active + 1) % 3)}
              aria-label="Next featured concert"
            >
              <CinemaIcon name="right" size={17} />
            </button>
          </div>
        </div>
      </section>
      <div className="discovery-body">
        <div className="discovery-topline">
          <div className="genre-tabs" aria-label="Filter concerts by genre">
            {[
              "For you",
              "Pop",
              "Indie & rock",
              "Electronic",
              "Acoustic",
              "Festivals",
            ].map((g) => (
              <button
                key={g}
                className={genre === g ? "active" : ""}
                onClick={() => setGenre(g)}
              >
                {g}
              </button>
            ))}
          </div>
          <Link href="/venues" className="location-selector">
            <CinemaIcon name="pin" size={14} /> All locations{" "}
            <CinemaIcon name="right" size={12} />
          </Link>
        </div>
        <PosterShelf
          title={genre === "For you" ? "Trending Now" : `${genre} live`}
          subtitle=""
          items={list}
        />
        {genre === "For you" && (
          <>
            <PosterShelf
              title="Upcoming Concerts"
              items={[
                concerts[4],
                concerts[6],
                concerts[2],
                concerts[5],
                concerts[3],
                concerts[1],
              ]}
            />
            <section className="spotlight-section">
              <div className="spotlight-copy">
                <span className="cinema-kicker"></span>
                <h2>
                  Featured
                  <br />
                  <em>Concerts</em>
                </h2>
                <p>
                  <br />
                </p>
                <Link
                  href={concertUrl(concerts[spotlight])}
                  className="button secondary"
                >
                  View Details <CinemaIcon name="arrow" size={17} />
                </Link>
                <div className="spotlight-controls">
                  <button
                    aria-label="Previous spotlight poster"
                    onClick={() =>
                      setSpotlight(
                        (spotlight + concerts.length - 1) % concerts.length,
                      )
                    }
                  >
                    <CinemaIcon name="left" size={17} />
                  </button>
                  <span>
                    0{spotlight + 1} <i>/ 07</i>
                  </span>
                  <button
                    aria-label="Next spotlight poster"
                    onClick={() =>
                      setSpotlight((spotlight + 1) % concerts.length)
                    }
                  >
                    <CinemaIcon name="right" size={17} />
                  </button>
                </div>
              </div>
              <div
                className="floating-poster-stage"
                aria-label="Featured concert posters"
              >
                {[-2, -1, 0, 1, 2].map((offset) => {
                  const c =
                    concerts[
                      (spotlight + offset + concerts.length) % concerts.length
                    ];
                  return (
                    <div
                      className={`stage-poster offset-${offset + 2}`}
                      key={`${c.id}-${offset}`}
                    >
                      <ConcertPoster concert={c} />
                    </div>
                  );
                })}
              </div>
            </section>
            <PosterShelf
              title="On Sale Now"
              items={concerts.filter((c) => c.status === "on-sale")}
            />
            <PosterShelf
              title="Presale Tickets"
              subtitle=""
              items={concerts.filter((c) => c.status === "presale")}
            />
            <PosterShelf
              title="Popular Events"
              items={[
                concerts[1],
                concerts[0],
                concerts[3],
                concerts[6],
                concerts[5],
                concerts[4],
              ]}
              ranked
            />
            <div className="community-banner">
              <span className="community-orbit" />
              <div>
                <span className="cinema-kicker"></span>
                <h2>
                  Ticketing
                  <br />
                  Information
                </h2>
                <p>Read the purchase, resale, and entry instructions.</p>
                <Link href="/guide" className="text-link">
                  How It Works <CinemaIcon name="arrow" size={17} />
                </Link>
              </div>
              <div className="banner-frequency" aria-hidden="true">
                {Array.from({ length: 32 }, (_, i) => (
                  <span
                    key={i}
                    style={{
                      height: `${Math.round(20 + Math.sin(i * 1.7) * 15 + (i % 7) * 10)}%`,
                    }}
                  />
                ))}
              </div>
            </div>
            <PosterShelf
              title="Concerts in Iloilo City"
              items={concerts.filter((c) => c.city === "Iloilo City")}
            />
            <PosterShelf
              title="Festivals & Live Events"
              items={[concerts[5], concerts[4], concerts[0], concerts[1]]}
            />
          </>
        )}
      </div>
      <div className="cinema-ending">
        <CinemaIcon name="music" size={25} />
        <h2></h2>
        <p></p>
        <span>Demo events · No real payments</span>
      </div>
    </div>
  );
}

export function CinemaBrowse({ view }: { view: string }) {
  const showcase = useShowcase();
  const [query, setQuery] = useState("");
  const [city, setCity] = useState("All locations");
  const saved = view === "saved";
  const venueView = view === "venues";
  const titles: Record<string, string> = {
    concerts: "Concerts & Events",
    upcoming: "Upcoming Concerts",
    presale: "Presale Tickets",
    saved: "Saved Concerts",
    venues: "Venues",
  };
  const items = concerts.filter(
    (c) =>
      (!saved || showcase.saved.includes(c.id)) &&
      (view !== "presale" || c.status === "presale") &&
      (view !== "upcoming" || c.status !== "on-sale") &&
      (city === "All locations" || c.city === city) &&
      `${c.artist} ${c.title} ${c.genre} ${c.venue}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );
  return (
    <section className="catalog-page cinema-page">
      <span className="cinema-kicker">{saved ? "" : venueView ? "" : ""}</span>
      <h1>
        {titles[view]}
        <span className="yellow-period">.</span>
      </h1>
      <p>{saved ? "" : "Concerts shown are fictional demo events."}</p>
      <div className="catalog-filters">
        <div>
          <CinemaIcon name="search" size={18} />
          <input
            aria-label="Filter concerts"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search concerts, genres, venues…"
          />
        </div>
        <select
          aria-label="Filter by city"
          value={city}
          onChange={(e) => setCity(e.target.value)}
        >
          {["All locations", "Iloilo City", "Manila", "Cebu"].map((c) => (
            <option key={c}>{c}</option>
          ))}
        </select>
      </div>
      {venueView ? (
        <div className="venue-grid">
          {[...new Set(items.map((c) => c.venue))].map((venue) => {
            const related = items.filter((c) => c.venue === venue);
            return (
              <article className="venue-card" key={venue}>
                <div className="venue-photo">
                  <Image
                    src={`/images/${related[0].image}.webp`}
                    alt="Concert atmosphere"
                    fill
                    sizes="(max-width:700px) 100vw, 400px"
                  />
                </div>
                <span className="cinema-kicker">{related[0].city}</span>
                <h2>{venue}</h2>
                <p>
                  {related.length} demo{" "}
                  {related.length === 1 ? "show" : "shows"}
                </p>
                {related.map((c) => (
                  <Link key={c.id} href={concertUrl(c)}>
                    {c.artist} {c.title}
                    <CinemaIcon name="arrow" size={16} />
                  </Link>
                ))}
              </article>
            );
          })}
        </div>
      ) : (
        <>
          <div className="catalog-count">
            {items.length} {saved ? "saved shows" : "concerts to discover"}
          </div>
          {items.length ? (
            <div className="catalog-grid">
              {items.map((c) => (
                <ConcertPoster concert={c} key={c.id} />
              ))}
            </div>
          ) : (
            <div className="cinema-empty">
              <CinemaIcon name={saved ? "heart" : "search"} size={40} />
              <h2>{saved ? "No saved concerts" : "No concerts found"}</h2>
              <p>
                {saved
                  ? "Tap the heart on a concert poster to save it here."
                  : "Try a different city or search term."}
              </p>
              <Link className="button primary" href="/concerts">
                Browse Concerts <CinemaIcon name="arrow" size={16} />
              </Link>
            </div>
          )}
        </>
      )}
    </section>
  );
}
