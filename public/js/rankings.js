/* =========================================================
   Avera Privé — RANKINGS

   Rankings are not published until:
   - Agencies are approved for publication
   - Review and verification data is available
   - Ranking eligibility and scoring are documented

   Paid placement must not determine ranking order.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeRankings();
});

/* =========================================================
   RANKING DATA

   Add eligible, approved OnlyFans management agencies
   after the ranking methodology is finalized.

   No sample agencies or provisional scores are displayed.
========================================================= */

const rankingAgencies = [];

/* =========================================================
   INITIALIZE
========================================================= */

function initializeRankings() {
    const podium =
        document.getElementById("rankingPodium");

    const table =
        document.getElementById("rankingTable");

    if (!podium || !table) return;

    const elements = {
        category:
            document.getElementById("rankingCategory"),

        region:
            document.getElementById("rankingRegion"),

        search:
            document.getElementById("rankingSearch"),

        reset:
            document.getElementById("resetRankings"),

        emptyReset:
            document.getElementById("emptyResetRankings"),

        title:
            document.getElementById("rankingTitle"),

        count:
            document.getElementById("rankingCount"),

        podium,

        table,

        empty:
            document.getElementById("rankingEmpty")
    };

    const update = () => {
        renderRankings(elements);
    };

    elements.category?.addEventListener(
        "change",
        update
    );

    elements.region?.addEventListener(
        "change",
        update
    );

    elements.search?.addEventListener(
        "input",
        update
    );

    elements.reset?.addEventListener(
        "click",
        () => {
            resetRankings(elements);
        }
    );

    elements.emptyReset?.addEventListener(
        "click",
        () => {
            resetRankings(elements);
        }
    );

    renderRankings(elements);
}

/* =========================================================
   FILTER

   This prepares the controls for approved ranking data.
   Agencies must have an explicitly published rank assigned
   under the documented methodology.
========================================================= */

function getRankingResults(elements) {
    const category =
        elements.category?.value || "overall";

    const region =
        elements.region?.value || "";

    const search =
        elements.search?.value
            .trim()
            .toLowerCase() || "";

    return rankingAgencies
        .filter((agency) => {
            const services =
                Array.isArray(agency.services)
                    ? agency.services
                    : [];

            const matchesCategory =
                category === "overall" ||
                services.includes(category);

            const matchesRegion =
                !region ||
                agency.region === region;

            const matchesSearch =
                !search ||
                String(agency.name || "")
                    .toLowerCase()
                    .includes(search);

            return (
                agency.rankingPublished === true &&
                Number.isInteger(agency.rank) &&
                agency.rank > 0 &&
                matchesCategory &&
                matchesRegion &&
                matchesSearch
            );
        })
        .sort((first, second) => {
            return first.rank - second.rank;
        });
}

/* =========================================================
   RENDER
========================================================= */

function renderRankings(elements) {
    const results =
        getRankingResults(elements);

    if (elements.count) {
        elements.count.textContent =
            String(results.length);
    }

    updateRankingTitle(elements);

    const noResults =
        results.length === 0;

    elements.empty.hidden =
        !noResults;

    elements.podium.hidden =
        noResults;

    elements.table.hidden =
        noResults;

    if (noResults) {
        elements.podium.innerHTML = "";
        elements.table.innerHTML = "";

        updateEmptyRankingMessage(elements);

        return;
    }

    elements.podium.innerHTML =
        results
            .slice(0, 3)
            .map((agency) => {
                return createPodiumCard(agency);
            })
            .join("");

    elements.table.innerHTML =
        results
            .map((agency) => {
                return createRankingRow(agency);
            })
            .join("");
    elements.table.querySelectorAll('.ranking-monogram').forEach((logo, index) => {
        window.AveraAgencyLogo.render(logo, results[index]);
    });
    elements.podium.querySelectorAll('.podium-agency-logo').forEach((logo, index) => {
        window.AveraAgencyLogo.render(logo, results[index]);
    });
}

function updateRankingTitle(elements) {
    if (!elements.title) return;

    const category =
        elements.category?.value || "overall";

    const region =
        elements.region?.value || "";

    const subject =
        category === "overall"
            ? "OnlyFans agencies"
            : `${category} agencies`;

    elements.title.textContent =
        region
            ? `${subject} in ${region}`
            : `${subject} worldwide`;
}

function updateEmptyRankingMessage(elements) {
    if (!elements.empty) return;

    const heading =
        elements.empty.querySelector("h2, h3");

    const description =
        elements.empty.querySelector("p");

    const resetButton =
        elements.emptyReset;

    const hasFilters =
        Boolean(
            elements.category?.value !== "overall" ||
            elements.region?.value ||
            elements.search?.value.trim()
        );

    if (heading) {
        heading.textContent =
            hasFilters
                ? "No published rankings match your search"
                : "Rankings are coming soon";
    }

    if (description) {
        description.textContent =
            hasFilters
                ? "Try a different category, region, or agency name."
                : "Eligible OnlyFans management agencies will appear here once the ranking methodology and supporting data are ready.";
    }

    if (resetButton) {
        resetButton.hidden =
            !hasFilters;
    }
}

/* =========================================================
   PODIUM

   Published ranking records supply the position.
   No client ratings or scores are generated here.
========================================================= */

function createPodiumCard(agency) {
    const positions = [
        "position-one",
        "position-two",
        "position-three"
    ];

    const positionClass =
        positions[agency.rank - 1] || "";

    return `
        <article class="podium-card ${positionClass}">

            <span class="podium-position">
                ${String(agency.rank).padStart(2, "0")}
            </span>

            <span class="podium-label">
                PUBLISHED RANKING
            </span>

            <div class="podium-agency">
                <div class="podium-agency-logo"></div>
                <h3>
                    ${escapeRankingHtml(agency.name)}
                </h3>

                <span>
                    ${escapeRankingHtml(agency.location || "")}
                </span>

                <a
                    href="/agencies/${encodeURIComponent(agency.id)}"
                    class="podium-link"
                >
                    View Agency
                    <i class="fa-solid fa-arrow-right"></i>
                </a>
            </div>

        </article>
    `;
}

/* =========================================================
   TABLE ROW
========================================================= */

function createRankingRow(agency) {
    const reviewCount =
        Number.isInteger(agency.reviews) &&
        agency.reviews >= 0
            ? agency.reviews
            : null;

    const years =
        Number.isFinite(agency.years) &&
        agency.years >= 0
            ? agency.years
            : null;

    return `
        <article class="ranking-row">

            <span class="ranking-number">
                ${String(agency.rank).padStart(2, "0")}
            </span>

            <div class="ranking-agency">
                <span class="ranking-monogram">
                    ${escapeRankingHtml(agency.initials || "AP")}
                </span>

                <div>
                    <strong>
                        ${escapeRankingHtml(agency.name)}
                    </strong>

                    <span>
                        ${escapeRankingHtml(agency.location || "")}
                    </span>
                </div>
            </div>

            <div class="ranking-value">
                <strong>
                    ${
                        reviewCount === null
                            ? "—"
                            : reviewCount
                    }
                </strong>

                <span>Published reviews</span>
            </div>

            <div class="ranking-value">
                <strong>
                    ${
                        years === null
                            ? "—"
                            : `${years} years`
                    }
                </strong>

                <span>Experience</span>
            </div>

            <div class="ranking-value">
                <strong>
                    ${
                        agency.verified === true
                            ? "Verified"
                            : "Not verified"
                    }
                </strong>

                <span>Verification status</span>
            </div>

            <strong class="ranking-total">
                ${agency.rank}
            </strong>

            <a href="/agencies/${encodeURIComponent(agency.id)}">
                View
                <i class="fa-solid fa-arrow-right"></i>
            </a>

        </article>
    `;
}

/* =========================================================
   RESET
========================================================= */

function resetRankings(elements) {
    if (elements.category) {
        elements.category.value =
            "overall";
    }

    if (elements.region) {
        elements.region.value = "";
    }

    if (elements.search) {
        elements.search.value = "";
    }

    renderRankings(elements);
}

/* =========================================================
   HTML SAFETY
========================================================= */

function escapeRankingHtml(value) {
    const element =
        document.createElement("div");

    element.textContent =
        String(value);

    return element.innerHTML;
}