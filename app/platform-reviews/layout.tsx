import Link from "next/link";
import Image from "next/image";
import "../../public/css/platform-reviews.css";

export default function ReviewsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="pr-site">
      <header className="pr-nav">
        <Link
          className="pr-brand"
          href="/"
          aria-label="Avera Privé homepage"
        >
          <Image
            className="pr-brand-monogram"
            src="/assets/images/avera-prive-monogram-white.png"
            alt=""
            width={52}
            height={52}
            priority
          />

          <span className="pr-brand-name">
            AVERA <span>PRIVÉ</span>
          </span>
        </Link>

        <nav aria-label="Review page navigation">
          <a href="/agencies.html">Agencies</a>

          <Link href="/platform-reviews">
            Platform reviews
          </Link>

          <Link className="pr-nav-home" href="/">
            Go back to Homepage
          </Link>
        </nav>
      </header>

      <main className="pr-main">{children}</main>

      <footer className="pr-footer">
        Reviews collected and moderated by Avera Privé.{" "}
        <a href="/trust.html#reviews">
          Agency review standards
        </a>
        {" · "}
        <a href="/legal.html#privacy">Privacy</a>
      </footer>
    </div>
  );
}