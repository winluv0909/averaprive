/* Avera Privé launch plan preview. Pricing follows the approved business model. */
document.addEventListener("DOMContentLoaded", () => {
    const section = document.getElementById("planPreview");
    if (!section) return;

    const input = document.getElementById("planPreviewAgencyName");
    const name = document.getElementById("planPreviewName");
    const monogram = document.getElementById("planPreviewMonogram");
    const tier = document.getElementById("planPreviewTier");
    const placement = document.getElementById("planPreviewPlacement");
    const description = document.getElementById("planPreviewDescription");
    const features = document.getElementById("planPreviewFeatures");
    const price = document.getElementById("planPreviewPrice");
    const link = document.getElementById("planPreviewLink");

    const buttons = Array.from(
        section.querySelectorAll("[data-plan-preview]")
    );

    const plans = {
        free: {
            title: "FREE",
            price: "$0 · forever",
            description:
                "Establish your agency presence and give creators the information they need to evaluate fit.",
            features: [
                "Profile, logo, services, locations, and links",
                "Portfolio, reviews, and basic statistics",
                "Claim-profile and verification application access"
            ],
            href: "/agency/register?plan=free",
            action: "Create Free Profile",
            featured: false
        },

        prive: {
            title: "PRIVÉ",
            price: "$49 / month",
            description:
                "Build a more professional presence with stronger presentation, useful profile tools, and inquiry features.",
            features: [
                "Enhanced profile and unlimited case studies",
                "Featured media, contact CTA, and lead notifications",
                "Analytics, SEO backlink, custom sections, and priority support"
            ],
            href: "/agency/register?plan=prive",
            action: "Choose Privé",
            featured: false
        },

        select: {
            title: "PRIVÉ SELECT",
            price: "$129 / month",
            description:
                "Increase visibility and acquisition with labelled exposure opportunities and deeper performance insight.",
            features: [
                "Priority directory, category, and country placement",
                "Featured and homepage exposure opportunities",
                "Lead tools, source tracking, advanced analytics, and monthly reporting"
            ],
            href: "/agency/register?plan=select",
            action: "Choose Privé Select",
            featured: true
        },

        elite: {
            title: "PRIVÉ ELITE",
            price: "$299 / month · launch",
            description:
                "Premium exposure, editorial opportunities, advanced lead tools, and higher-touch support for established agencies.",
            features: [
                "Premium homepage and category placement",
                "Editorial feature and advanced lead tools",
                "Profile customization, priority support, and quarterly performance review"
            ],
            href: "demo.html?plan=elite",
            action: "Discuss Elite",
            featured: true
        }
    };

    function updateAgencyName() {
        const agencyName = input.value.trim() || "Your Agency";

        name.textContent = agencyName;

        const initials = agencyName
            .split(/\s+/)
            .slice(0, 2)
            .map((word) => word[0] || "")
            .join("")
            .toUpperCase();

        monogram.textContent = initials || "YA";
    }

    function setPlan(key) {
        const plan = plans[key];
        if (!plan) return;

        buttons.forEach((button) => {
            button.setAttribute(
                "aria-pressed",
                String(button.dataset.planPreview === key)
            );
        });

        tier.textContent = plan.title;
        price.textContent = plan.price;
        description.textContent = plan.description;
        placement.hidden = !plan.featured;

        features.replaceChildren(
            ...plan.features.map((feature) => {
                const item = document.createElement("li");
                item.textContent = feature;
                return item;
            })
        );

        link.href = plan.href;
        link.replaceChildren(
            document.createTextNode(`${plan.action} `)
        );

        const icon = document.createElement("i");
        icon.className = "fa-solid fa-arrow-right";
        icon.setAttribute("aria-hidden", "true");
        link.appendChild(icon);
    }

    input.addEventListener("input", updateAgencyName);

    buttons.forEach((button) => {
        button.addEventListener("click", () => {
            setPlan(button.dataset.planPreview);
        });
    });

    updateAgencyName();
    setPlan("free");
});