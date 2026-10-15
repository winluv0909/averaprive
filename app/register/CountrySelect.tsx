"use client";

import { useRef, useState } from "react";
import { countries } from "country-flag-icons";
import * as Flags from "country-flag-icons/react/3x2";

const names = new Intl.DisplayNames(["en"], { type: "region" });

const options = countries
  .filter(
  (code) => /^[A-Z]{2}$/.test(code) && !["EU", "UN"].includes(code),
)
  .map((code) => ({
    code,
    name: names.of(code) || code,
  }))
  .sort((a, b) => a.name.localeCompare(b.name, "en"));

type Props = {
  name: string;
  value: string;
  onChange: (value: string) => void;
  label: string;
};

function Flag({ code }: { code: string }) {
  const Icon = Flags[code as keyof typeof Flags];

  return Icon ? (
    <Icon
      aria-hidden="true"
      style={{ width: 24, height: 16, flexShrink: 0 }}
    />
  ) : null;
}

export default function CountrySelect({
  name,
  value,
  onChange,
  label,
}: Props) {
  const [search, setSearch] = useState("");
  const details = useRef<HTMLDetailsElement>(null);
  const selected = options.find((option) => option.name === value);

  const matches = options.filter((option) =>
    `${option.name} ${option.code}`
      .toLowerCase()
      .includes(search.trim().toLowerCase()),
  );

  return (
    <div className="registration-country-select">
      <input type="hidden" name={name} value={value} />

      <details ref={details}>
        <summary aria-label={`${label}: ${value || "Select a country"}`}>
          {selected && <Flag code={selected.code} />}
          <span>{value || "Select a country or territory"}</span>
          <span aria-hidden="true">▾</span>
        </summary>

        <div className="registration-country-menu">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search country…"
            aria-label={`Search ${label.toLowerCase()}`}
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
              if (event.key === "Escape") {
                if (details.current) details.current.open = false;
              }
            }}
          />

          <div className="registration-country-options">
            {matches.map((option) => (
              <button
                key={option.code}
                type="button"
                aria-pressed={value === option.name}
                onClick={() => {
                  onChange(option.name);
                  setSearch("");
                  if (details.current) {
                    details.current.open = false;
                    details.current.querySelector("summary")?.focus();
                  }
                }}
              >
                <Flag code={option.code} />
                <span>{option.name}</span>
                {value === option.name && <span aria-hidden="true">✓</span>}
              </button>
            ))}

            {!matches.length && <p>No matching countries.</p>}
          </div>
        </div>
      </details>
    </div>
  );
}