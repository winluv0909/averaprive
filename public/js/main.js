/* =========================================================
   Avera Privé — MAIN WEBSITE JAVASCRIPT
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeHeader();
    initializeMobileNavigation();
    initializeLanguageSelector();
    initializeOwnerTabs();
    initializeWorkspaceButtons();
    initializeHomepagePricing();
    initializeHomepageSearch();
    initializeScrollReveal();
    initializeCurrentYear();
});

/* =========================================================
   HEADER
========================================================= */

function initializeHeader() {
    const header =
        document.getElementById("siteHeader");

    if (!header) return;

    function updateHeader() {
        header.classList.toggle(
            "scrolled",
            window.scrollY > 20
        );
    }

    updateHeader();

    window.addEventListener(
        "scroll",
        updateHeader,
        {
            passive: true
        }
    );
}

/* =========================================================
   MOBILE NAVIGATION
========================================================= */

function initializeMobileNavigation() {
    const menuButton =
        document.getElementById(
            "mobileMenuButton"
        );

    const mobileNavigation =
        document.getElementById(
            "mobileNavigation"
        );

    if (!menuButton || !mobileNavigation) {
        return;
    }

    const menuIcon =
        menuButton.querySelector("i");

    function openNavigation() {
        mobileNavigation.classList.add("open");

        document.body.classList.add(
            "navigation-open"
        );

        menuButton.setAttribute(
            "aria-expanded",
            "true"
        );

        menuButton.setAttribute(
            "aria-label",
            "Close navigation"
        );

        if (menuIcon) {
            menuIcon.className =
                "fa-solid fa-xmark";
        }
    }

    function closeNavigation() {
        mobileNavigation.classList.remove("open");

        document.body.classList.remove(
            "navigation-open"
        );

        menuButton.setAttribute(
            "aria-expanded",
            "false"
        );

        menuButton.setAttribute(
            "aria-label",
            "Open navigation"
        );

        if (menuIcon) {
            menuIcon.className =
                "fa-solid fa-bars";
        }
    }

    menuButton.addEventListener(
        "click",
        () => {
            const isOpen =
                mobileNavigation.classList.contains(
                    "open"
                );

            if (isOpen) {
                closeNavigation();
            } else {
                openNavigation();
            }
        }
    );

    mobileNavigation
        .querySelectorAll("a")
        .forEach((link) => {
            link.addEventListener(
                "click",
                closeNavigation
            );
        });

    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape") {
                closeNavigation();
            }
        }
    );

    window.addEventListener(
        "resize",
        () => {
            if (window.innerWidth > 900) {
                closeNavigation();
            }
        }
    );
}

/* =========================================================
   LANGUAGE SELECTOR
========================================================= */

function initializeLanguageSelector() {
    const languageButton =
        document.getElementById(
            "languageButton"
        );

    const languageDropdown =
        document.getElementById(
            "languageDropdown"
        );

    const languageSearch =
        document.getElementById(
            "languageSearch"
        );

    const languageList =
        document.getElementById(
            "languageList"
        );

    const currentLanguage =
        document.getElementById(
            "currentLanguage"
        );

    if (
        !languageButton ||
        !languageDropdown ||
        !languageSearch ||
        !languageList ||
        !currentLanguage
    ) {
        return;
    }

    const languageOptions = Array.from(
        languageList.querySelectorAll(
            "button[data-language]"
        )
    );

    function openLanguageDropdown() {
        languageDropdown.classList.add("open");
        languageButton.classList.add("active");

        languageButton.setAttribute(
            "aria-expanded",
            "true"
        );

        window.setTimeout(() => {
            languageSearch.focus();
        }, 100);
    }

    function closeLanguageDropdown() {
        languageDropdown.classList.remove("open");
        languageButton.classList.remove("active");

        languageButton.setAttribute(
            "aria-expanded",
            "false"
        );

        languageSearch.value = "";
        filterLanguageOptions("");
    }

    function toggleLanguageDropdown() {
        const isOpen =
            languageDropdown.classList.contains(
                "open"
            );

        if (isOpen) {
            closeLanguageDropdown();
        } else {
            openLanguageDropdown();
        }
    }

    function filterLanguageOptions(
        searchValue
    ) {
        const normalizedValue =
            searchValue
                .trim()
                .toLowerCase();

        languageOptions.forEach((option) => {
            const languageName =
                option
                    .querySelector("span")
                    ?.textContent
                    .toLowerCase() || "";

            const languageCode =
                option.dataset.language
                    ?.toLowerCase() || "";

            const matchesSearch =
                languageName.includes(
                    normalizedValue
                ) ||
                languageCode.includes(
                    normalizedValue
                );

            option.style.display =
                matchesSearch
                    ? "flex"
                    : "none";
        });
    }

    function updateSelectedLanguage(
        languageCode
    ) {
        languageOptions.forEach((option) => {
            const isSelected =
                option.dataset.language ===
                languageCode;

            option.classList.toggle(
                "selected",
                isSelected
            );

            if (isSelected) {
                const displayedCode =
                    option
                        .querySelector("small")
                        ?.textContent;

                if (displayedCode) {
                    currentLanguage.textContent =
                        displayedCode;
                }
            }
        });
    }

    languageButton.addEventListener(
        "click",
        (event) => {
            event.stopPropagation();
            toggleLanguageDropdown();
        }
    );

    languageDropdown.addEventListener(
        "click",
        (event) => {
            event.stopPropagation();
        }
    );

    languageSearch.addEventListener(
        "input",
        () => {
            filterLanguageOptions(
                languageSearch.value
            );
        }
    );

    languageOptions.forEach((option) => {
        option.addEventListener(
            "click",
            () => {
                const selectedLanguage =
                    option.dataset.language;

                if (!selectedLanguage) {
                    return;
                }

                localStorage.setItem(
                    "agencyPriveLanguage",
                    selectedLanguage
                );

                updateSelectedLanguage(
                    selectedLanguage
                );

                if (
                    typeof window
                        .setWebsiteLanguage ===
                    "function"
                ) {
                    window.setWebsiteLanguage(
                        selectedLanguage
                    );
                }

                closeLanguageDropdown();
            }
        );
    });

    document.addEventListener(
        "click",
        closeLanguageDropdown
    );

    document.addEventListener(
        "keydown",
        (event) => {
            if (event.key === "Escape") {
                closeLanguageDropdown();
            }
        }
    );

    const savedLanguage =
        localStorage.getItem(
            "agencyPriveLanguage"
        ) || "en";

    updateSelectedLanguage(savedLanguage);
}

/* =========================================================
   OWNER EXPERIENCE TABS
========================================================= */

function initializeOwnerTabs() {
    const ownerTabs =
        document.querySelectorAll(
            ".owner-tab"
        );

    const ownerPanels =
        document.querySelectorAll(
            ".owner-panel"
        );

    if (
        !ownerTabs.length ||
        !ownerPanels.length
    ) {
        return;
    }

    ownerTabs.forEach((tab) => {
        tab.addEventListener(
            "click",
            () => {
                const selectedPanelId =
                    tab.dataset.panel;

                const selectedPanel =
                    document.getElementById(
                        selectedPanelId
                    );

                if (!selectedPanel) return;

                ownerTabs.forEach(
                    (currentTab) => {
                        currentTab.classList.remove(
                            "active"
                        );

                        currentTab.setAttribute(
                            "aria-selected",
                            "false"
                        );
                    }
                );

                ownerPanels.forEach((panel) => {
                    panel.classList.remove(
                        "active"
                    );
                });

                tab.classList.add("active");

                tab.setAttribute(
                    "aria-selected",
                    "true"
                );

                selectedPanel.classList.add(
                    "active"
                );
            }
        );
    });

    ownerTabs.forEach((tab, index) => {
        tab.setAttribute(
            "aria-selected",
            index === 0
                ? "true"
                : "false"
        );
    });
}

/* =========================================================
   WORKSPACE SIDEBAR BUTTONS
========================================================= */

function initializeWorkspaceButtons() {
    const workspaceButtons =
        document.querySelectorAll(
            ".workspace-sidebar " +
            "[data-workspace-target]"
        );

    const workspacePanels =
        document.querySelectorAll(
            ".workspace-panel" +
            "[data-workspace-panel]"
        );

    if (
        !workspaceButtons.length ||
        !workspacePanels.length
    ) {
        return;
    }

    function showWorkspacePanel(panelName) {
        workspaceButtons.forEach((button) => {
            const isSelected =
                button.dataset.workspaceTarget ===
                panelName;

            button.classList.toggle(
                "active",
                isSelected
            );

            button.setAttribute(
                "aria-pressed",
                isSelected
                    ? "true"
                    : "false"
            );
        });

        workspacePanels.forEach((panel) => {
            const isSelected =
                panel.dataset.workspacePanel ===
                panelName;

            panel.hidden = !isSelected;

            panel.classList.toggle(
                "active",
                isSelected
            );
        });
    }

    workspaceButtons.forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                const selectedPanelName =
                    button.dataset
                        .workspaceTarget;

                if (!selectedPanelName) {
                    return;
                }

                showWorkspacePanel(
                    selectedPanelName
                );
            }
        );
    });

    const initiallyActiveButton =
        document.querySelector(
            ".workspace-sidebar " +
            "[data-workspace-target].active"
        );

    const initialPanel =
        initiallyActiveButton
            ?.dataset.workspaceTarget ||
        "overview";

    showWorkspacePanel(initialPanel);
}

/* =========================================================
   HOMEPAGE PRICING TOGGLE
========================================================= */

function initializeHomepagePricing() {
    const billingButtons =
        document.querySelectorAll(
            "[data-home-billing]"
        );

    const priceElements =
        document.querySelectorAll(
            ".pricing-amount"
        );

    const periodElements =
        document.querySelectorAll(
            ".pricing-period"
        );

    if (
        !billingButtons.length ||
        !priceElements.length
    ) {
        return;
    }

    function setBillingPeriod(
        billingPeriod
    ) {
        billingButtons.forEach((button) => {
            const isActive =
                button.dataset.homeBilling ===
                billingPeriod;

            button.classList.toggle(
                "active",
                isActive
            );

            button.setAttribute(
                "aria-pressed",
                String(isActive)
            );
        });

        priceElements.forEach((price) => {
            const newPrice =
                price.dataset[billingPeriod];

            if (newPrice) {
                price.textContent = newPrice;
            }
        });

        periodElements.forEach((period) => {
            const newPeriod =
                period.dataset[billingPeriod];

            if (newPeriod) {
                period.textContent = newPeriod;
            }
        });
    }

    billingButtons.forEach((button) => {
        button.addEventListener(
            "click",
            () => {
                const billingPeriod =
                    button.dataset.homeBilling;

                if (!billingPeriod) return;

                setBillingPeriod(
                    billingPeriod
                );
            }
        );
    });

    setBillingPeriod("monthly");
}

/* =========================================================
   HOMEPAGE SEARCH
========================================================= */

function initializeHomepageSearch() {
    const searchForm =
        document.getElementById(
            "heroSearchForm"
        );

    const agencySearch =
        document.getElementById(
            "agencySearch"
        );

    const agencyLocation =
        document.getElementById(
            "agencyLocation"
        );

    if (
        !searchForm ||
        !agencySearch ||
        !agencyLocation
    ) {
        return;
    }

    searchForm.addEventListener(
        "submit",
        (event) => {
            event.preventDefault();

            const searchQuery =
                agencySearch.value.trim();

            const selectedLocation =
                agencyLocation.value;

            const parameters =
                new URLSearchParams();

            if (searchQuery) {
                parameters.set(
                    "search",
                    searchQuery
                );
            }

            if (selectedLocation) {
                parameters.set(
                    "location",
                    selectedLocation
                );
            }

            const queryString =
                parameters.toString();

            const destination =
                queryString
                    ? `agencies.html?${queryString}`
                    : "agencies.html";

            window.location.href =
                destination;
        }
    );
}

/* =========================================================
   SCROLL REVEAL
========================================================= */

function initializeScrollReveal() {
    const revealElements =
        document.querySelectorAll(
            ".reveal"
        );

    if (!revealElements.length) return;

    if (
        !(
            "IntersectionObserver" in
            window
        )
    ) {
        revealElements.forEach(
            (element) => {
                element.classList.add(
                    "visible"
                );
            }
        );

        return;
    }

    const revealObserver =
        new IntersectionObserver(
            (entries, observer) => {
                entries.forEach((entry) => {
                    if (
                        !entry.isIntersecting
                    ) {
                        return;
                    }

                    entry.target.classList.add(
                        "visible"
                    );

                    observer.unobserve(
                        entry.target
                    );
                });
            },
            {
                threshold: 0.12,
                rootMargin:
                    "0px 0px -45px 0px"
            }
        );

    revealElements.forEach(
        (element, index) => {
            element.style.transitionDelay =
                `${
                    Math.min(
                        index % 4,
                        3
                    ) * 70
                }ms`;

            revealObserver.observe(element);
        }
    );
}

/* =========================================================
   SMOOTH ANCHOR LINKS
========================================================= */

document
    .querySelectorAll('a[href^="#"]')
    .forEach((link) => {
        link.addEventListener(
            "click",
            (event) => {
                const destination =
                    link.getAttribute("href");

                if (
                    !destination ||
                    destination === "#"
                ) {
                    event.preventDefault();
                    return;
                }

                const target =
                    document.querySelector(
                        destination
                    );

                if (!target) return;

                event.preventDefault();

                target.scrollIntoView({
                    behavior: "smooth",
                    block: "start"
                });
            }
        );
    });

/* =========================================================
   CURRENT YEAR
========================================================= */

function initializeCurrentYear() {
    const currentYear =
        document.getElementById(
            "currentYear"
        );

    if (!currentYear) return;

    currentYear.textContent =
        new Date().getFullYear();
}
