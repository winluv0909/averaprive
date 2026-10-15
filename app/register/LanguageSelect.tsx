"use client";

import { useState } from "react";

const languageCodes = `
aa ab ae af ak am an ar as av ay az ba be bg bh bi bm bn bo br bs
ca ce ch co cr cs cu cv cy da de dv dz ee el en eo es et eu fa ff
fi fj fo fr fy ga gd gl gn gu gv ha he hi ho hr ht hu hy hz ia id
ie ig ii ik io is it iu ja jv ka kg ki kj kk kl km kn ko kr ks ku
kv kw ky la lb lg li ln lo lt lu lv mg mh mi mk ml mn mr ms mt my
na nb nd ne ng nl nn no nr nv ny oc oj om or os pa pi pl ps pt qu
rm rn ro ru rw sa sc sd se sg si sk sl sm sn so sq sr ss st su sv
sw ta te tg th ti tk tl tn to tr ts tt tw ty ug uk ur uz ve vi vo
wa wo xh yi yo za zh zu
`.trim().split(/\s+/);

const names = new Intl.DisplayNames(["en"], { type: "language" });

const languageOptions = [
  ...new Set([
    ...languageCodes.map((code) => names.of(code) || code),
    "Filipino",
    "Cantonese",
    "American Sign Language",
    "British Sign Language",
    "Filipino Sign Language",
  ]),
].sort((a, b) => a.localeCompare(b, "en"));

type Props = {
  value: string;
  onChange: (value: string) => void;
};

export default function LanguageSelect({ value, onChange }: Props) {
  const [search, setSearch] = useState("");

  const selected = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);

  const matches = languageOptions.filter((language) =>
    language.toLowerCase().includes(search.trim().toLowerCase()),
  );

  function toggle(language: string) {
    const next = selected.includes(language)
      ? selected.filter((item) => item !== language)
      : [...selected, language];

    onChange(next.sort((a, b) => a.localeCompare(b, "en")).join(", "));
  }

  return (
    <div className="registration-language-select">
      <input type="hidden" name="languages" value={value} />

      <details>
        <summary>
          <span>
            {selected.length
              ? `${selected.length} language${selected.length === 1 ? "" : "s"} selected`
              : "Select languages"}
          </span>
          <span aria-hidden="true">▾</span>
        </summary>

        <div className="registration-language-menu">
          <input
            type="search"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search languages…"
            aria-label="Search languages"
            onKeyDown={(event) => {
              if (event.key === "Enter") event.preventDefault();
            }}
          />

          <div className="registration-language-options">
            {matches.map((language) => (
              <label key={language}>
                <input
                  type="checkbox"
                  checked={selected.includes(language)}
                  onChange={() => toggle(language)}
                />
                <span>{language}</span>
              </label>
            ))}

            {!matches.length && <p>No matching languages.</p>}
          </div>
        </div>
      </details>

      {selected.length > 0 && (
        <p className="registration-language-selection">
          {selected.join(", ")}
        </p>
      )}
    </div>
  );
}