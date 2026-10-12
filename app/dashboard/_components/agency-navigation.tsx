"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function AgencyNavigation() {
  const pathname = usePathname();

const isCreate =
  pathname === "/agency/dashboard/agencies/new";

const isOverview =
  pathname === "/agency/dashboard" ||
  (
    /^\/agency\/dashboard\/agencies\/[^/]+$/.test(pathname) &&
    !isCreate
  );

const isReview =
  pathname.startsWith("/agency/dashboard/reviews");

const isSupport =
  pathname.startsWith("/agency/dashboard/support");

  return (
    <nav>
      <p>WORKSPACE</p>

      <Link
        className={isOverview ? "active" : ""}
        href="/agency/dashboard"
      >
        <span>⌂</span>
        Overview
      </Link>

      <Link
        className={isCreate ? "active" : ""}
        href="/agency/dashboard/agencies/new"
      >
        <span>＋</span>
        Create agency profile
      </Link>

      <Link
        className={isReview ? "active" : ""}
        href="/agency/dashboard/reviews/new"
      >
        <span>☆</span>
        Submit a review
      </Link>

      <p>HELP &amp; SUPPORT</p>

      <Link
        className={isSupport ? "active" : ""}
        href="/agency/dashboard/support"
      >
        <span>?</span>
        Support
      </Link>

      <p>DISCOVER</p>

      <Link
        href="/agencies.html"
        target="_blank"
      >
        <span>◎</span>
        Public directory
      </Link>

      <Link href="/" target="_blank">
        <span>↗</span>
        View website
      </Link>
    </nav>
  );
}