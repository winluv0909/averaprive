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
    const menuButton = document.getElementById("mobileMenuButton");
    const mobileNavigation = document.getElementById("mobileNavigation");
    if (!menuButton || !mobileNavigation) return;
    const menuIcon = menuButton.querySelector("i");
    menuButton.setAttribute("aria-controls", mobileNavigation.id);
    mobileNavigation.setAttribute("aria-label", "Mobile navigation");
    mobileNavigation.setAttribute("role", "navigation");

    function closeNavigation(restoreFocus = false) {
        if (restoreFocus && menuButton.getClientRects().length) menuButton.focus();
        mobileNavigation.classList.remove("open");
        mobileNavigation.inert = true;
        mobileNavigation.setAttribute("aria-hidden", "true");
        document.body.classList.remove("navigation-open");
        menuButton.setAttribute("aria-expanded", "false");
        menuButton.setAttribute("aria-label", "Open navigation");
        if (menuIcon) menuIcon.className = "fa-solid fa-bars";
    }
    function openNavigation() {
        mobileNavigation.inert = false;
        mobileNavigation.setAttribute("aria-hidden", "false");
        mobileNavigation.classList.add("open");
        document.body.classList.add("navigation-open");
        menuButton.setAttribute("aria-expanded", "true");
        menuButton.setAttribute("aria-label", "Close navigation");
        if (menuIcon) menuIcon.className = "fa-solid fa-xmark";
        const firstLink = Array.from(mobileNavigation.querySelectorAll("a[href],button,input,select,[tabindex]"))
            .find(element => !element.disabled && element.tabIndex >= 0 && element.getClientRects().length);
        firstLink?.focus();
    }
    closeNavigation();
    menuButton.addEventListener("click", () => {
        if (mobileNavigation.classList.contains("open")) closeNavigation(true);
        else openNavigation();
    });
    mobileNavigation.querySelectorAll("a").forEach(link => {
        link.addEventListener("click", () => closeNavigation());
    });
    document.addEventListener("keydown", event => {
        if (event.key === "Escape" && mobileNavigation.classList.contains("open")) {
            event.preventDefault();
            closeNavigation(true);
        }
    });
    document.addEventListener("click", event => {
        if (mobileNavigation.classList.contains("open")
            && !mobileNavigation.contains(event.target) && !menuButton.contains(event.target)) {
            closeNavigation();
        }
    });
    document.addEventListener("focusin", event => {
        if (mobileNavigation.classList.contains("open")
            && !mobileNavigation.contains(event.target) && !menuButton.contains(event.target)) {
            closeNavigation();
        }
    });
    window.addEventListener("resize", () => {
        if (window.innerWidth > 900) closeNavigation();
    });
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

/* Optional first-party analytics: off until the visitor chooses to allow it. */
(() => {
  const key='ap_privacy_v1';
  const read=()=>{try{return localStorage.getItem(key);}catch{return null;}};
  let choice=read();
  if(!['essential','analytics'].includes(choice))choice=null;
  let panel;
  window.apPrivacy={analyticsAllowed:()=>choice==='analytics',open:()=>{if(panel){panel.hidden=false;panel.querySelector('button')?.focus();}}};
  const set=value=>{
    choice=value;
    try{localStorage.setItem(key,value);if(value!=='analytics')sessionStorage.removeItem('ap_marketplace_session');}catch{/* Storage restrictions do not prevent using the site. */}
    panel.hidden=true;
    window.dispatchEvent(new Event('ap:privacychange'));
  };
  document.addEventListener('DOMContentLoaded',()=>{
    panel=document.createElement('aside');panel.className='ap-privacy-choices';panel.setAttribute('aria-label','Privacy choices');panel.hidden=Boolean(choice);
    const title=document.createElement('h2');title.textContent='Your privacy choices';
    const text=document.createElement('p');text.textContent='Essential account and security storage supports the service. Optional directory analytics stay off unless you allow them. You can change this choice through Cookie Settings.';
    const actions=document.createElement('div');
    for(const [label,value] of [['Essential only','essential'],['Allow directory analytics','analytics']]){const button=document.createElement('button');button.type='button';button.textContent=label;button.addEventListener('click',()=>set(value));actions.append(button);}
    const link=document.createElement('a');link.href='/legal.html#cookies';link.textContent='Privacy information';actions.append(link);panel.append(title,text,actions);document.body.append(panel);
    document.querySelectorAll('a[href$="legal.html#cookies"]').forEach(link=>{if(panel.contains(link))return;link.addEventListener('click',event=>{event.preventDefault();window.apPrivacy.open();});});
    if(location.pathname.endsWith('/legal.html')&&location.hash==='#cookies')panel.hidden=false;
  });
})();
