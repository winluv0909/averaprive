/* =========================================================
   Avera Privé — AUTHENTICATION

   Frontend validation and interface behavior.
   No accounts, agency profiles, or subscriptions are created yet.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeLoginForm();
    initializeRegistrationForm();
    initializePasswordToggles();
    initializeForgotPassword();
    initializeGoogleLogin();
    loadRememberedEmail();
});

/* =========================================================
   SHARED HELPERS
========================================================= */

function getElement(id) {
    return document.getElementById(id);
}

function isValidEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(value.trim());
}

function isValidWebsite(value) {
    if (!value.trim()) return true;

    try {
        const url = new URL(value.trim());
        return url.protocol === "http:" || url.protocol === "https:";
    } catch {
        return false;
    }
}

function setInputError(input, errorId, message) {
    if (input) {
        input.classList.add("invalid");
        input.setAttribute("aria-invalid", "true");
    }

    const error = getElement(errorId);
    if (error) error.textContent = message;
}

function clearInputError(input, errorId) {
    if (input) {
        input.classList.remove("invalid");
        input.removeAttribute("aria-invalid");
    }

    const error = getElement(errorId);
    if (error) error.textContent = "";
}

function setGroupError(errorId, message) {
    const error = getElement(errorId);
    if (error) error.textContent = message;
}

function showAuthMessage(message, type = "information") {
    const element = getElement("authMessage");
    if (!element) return;

    element.textContent = message;
    element.className = `auth-message show ${type}`;
    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function clearAuthMessage() {
    const element = getElement("authMessage");
    if (!element) return;

    element.textContent = "";
    element.className = "auth-message";
}

/* =========================================================
   PASSWORD VISIBILITY
========================================================= */

function initializePasswordToggles() {
    const pairs = [
        ["passwordToggle", "password"],
        ["registrationPasswordToggle", "registrationPassword"],
        ["confirmPasswordToggle", "confirmPassword"]
    ];

    pairs.forEach(([buttonId, inputId]) => {
        const button = getElement(buttonId);
        const input = getElement(inputId);
        if (!button || !input) return;

        button.addEventListener("click", () => {
            const showing = input.type === "password";
            input.type = showing ? "text" : "password";

            const icon = button.querySelector("i");
            if (icon) {
                icon.className = showing
                    ? "fa-regular fa-eye-slash"
                    : "fa-regular fa-eye";
            }

            button.setAttribute(
                "aria-label",
                showing ? "Hide password" : "Show password"
            );
            button.setAttribute("aria-pressed", String(showing));
        });
    });
}

/* =========================================================
   LOGIN
========================================================= */

function initializeLoginForm() {
    const form = getElement("loginForm");
    if (!form) return;

    const email = getElement("email");
    const password = getElement("password");

    email?.addEventListener("input", () => {
        clearInputError(email, "emailError");
        clearAuthMessage();
    });

    password?.addEventListener("input", () => {
        clearInputError(password, "passwordError");
        clearAuthMessage();
    });

    email?.addEventListener("blur", validateLoginEmail);
    password?.addEventListener("blur", validateLoginPassword);

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearAuthMessage();

        const validEmail = validateLoginEmail();
        const validPassword = validateLoginPassword();

        if (!validEmail || !validPassword) {
            showAuthMessage(
                "Please review the highlighted fields.",
                "error"
            );
            return;
        }

        saveRememberedEmail(
            email,
            getElement("rememberMe")
        );

        showAuthMessage(
            "Login is not available yet. Authentication must be connected before accounts can be accessed.",
            "information"
        );
    });
}

function validateLoginEmail() {
    const input = getElement("email");
    if (!input) return false;

    if (!input.value.trim()) {
        setInputError(
            input,
            "emailError",
            "Email address is required."
        );
        return false;
    }

    if (!isValidEmail(input.value)) {
        setInputError(
            input,
            "emailError",
            "Enter a valid email address."
        );
        return false;
    }

    clearInputError(input, "emailError");
    return true;
}

function validateLoginPassword() {
    const input = getElement("password");
    if (!input) return false;

    if (!input.value) {
        setInputError(
            input,
            "passwordError",
            "Password is required."
        );
        return false;
    }

    clearInputError(input, "passwordError");
    return true;
}

/* =========================================================
   REMEMBER EMAIL

   Only the email address is saved in this browser.
========================================================= */

function saveRememberedEmail(emailInput, checkbox) {
    if (!emailInput || !checkbox) return;

    try {
        if (checkbox.checked) {
            localStorage.setItem(
                "agencyPriveRememberedEmail",
                emailInput.value.trim()
            );
        } else {
            localStorage.removeItem(
                "agencyPriveRememberedEmail"
            );
        }
    } catch {
        // Login validation still works if browser storage is unavailable.
    }
}

function loadRememberedEmail() {
    const email = getElement("email");
    const checkbox = getElement("rememberMe");
    if (!email || !checkbox) return;

    try {
        const remembered = localStorage.getItem(
            "agencyPriveRememberedEmail"
        );

        if (remembered) {
            email.value = remembered;
            checkbox.checked = true;
        }
    } catch {
        // Browser storage may be disabled.
    }
}

/* =========================================================
   PASSWORD RECOVERY AND GOOGLE LOGIN
========================================================= */

function initializeForgotPassword() {
    const link = getElement("forgotPassword");
    const email = getElement("email");
    if (!link || !email) return;

    link.addEventListener("click", (event) => {
        event.preventDefault();
        clearAuthMessage();

        if (!email.value.trim()) {
            showAuthMessage(
                "Enter your account email before requesting password recovery."
            );
            email.focus();
            return;
        }

        if (!isValidEmail(email.value)) {
            setInputError(
                email,
                "emailError",
                "Enter a valid email address."
            );
            showAuthMessage(
                "Enter a valid email before requesting password recovery.",
                "error"
            );
            email.focus();
            return;
        }

        showAuthMessage(
            "Password recovery is not available until authentication is connected."
        );
    });
}

function initializeGoogleLogin() {
    const button = getElement("googleLogin");
    if (!button) return;

    button.addEventListener("click", (event) => {
        event.preventDefault();
        clearAuthMessage();

        showAuthMessage(
            "Google login is not available until authentication is connected."
        );
    });
}

/* =========================================================
   REGISTRATION WIZARD
========================================================= */

function initializeRegistrationForm() {
    const form = getElement("registrationForm");
    if (!form) return;

    const steps = Array.from(
        form.querySelectorAll(".wizard-step")
    );
    const progressItems = Array.from(
        form.querySelectorAll(".wizard-progress-item")
    );
    const totalSteps = 4;

    let currentStep = 1;

    initializeRegistrationPlan();
    initializeConditionalField(
        "otherServiceCheckbox",
        "otherServiceField",
        "otherService",
        "servicesError"
    );
    initializeConditionalField(
        "otherNicheCheckbox",
        "otherNicheField",
        "otherNiche",
        "creatorNichesError"
    );
    initializeSelectionCounters();
    initializeCountrySearch();
    initializeLogoUpload();
    initializeAboutCounter();
    initializeRegistrationFieldClearing();

    function showStep(number) {
        currentStep = number;

        steps.forEach((step) => {
            const active = Number(step.dataset.step) === number;
            step.classList.toggle("active", active);
            step.hidden = !active;
        });

        progressItems.forEach((item) => {
            const stepNumber = Number(item.dataset.stepTarget);
            item.classList.toggle("active", stepNumber === number);
            item.classList.toggle("completed", stepNumber < number);

            if (stepNumber === number) {
                item.setAttribute("aria-current", "step");
            } else {
                item.removeAttribute("aria-current");
            }
        });
    }

    form.querySelectorAll(".wizard-next").forEach((button) => {
        button.addEventListener("click", () => {
            clearAuthMessage();

            if (!validateRegistrationStep(currentStep)) {
                showAuthMessage(
                    "Please complete the required information before continuing.",
                    "error"
                );
                focusFirstInvalidField();
                return;
            }

            if (currentStep < totalSteps) {
                showStep(currentStep + 1);
                scrollRegistrationToTop();
            }
        });
    });

    form.querySelectorAll(".wizard-back").forEach((button) => {
        button.addEventListener("click", () => {
            clearAuthMessage();

            if (currentStep > 1) {
                showStep(currentStep - 1);
                scrollRegistrationToTop();
            }
        });
    });

    progressItems.forEach((item) => {
        item.addEventListener("click", () => {
            const target = Number(item.dataset.stepTarget);

            if (
                target < currentStep &&
                item.classList.contains("completed")
            ) {
                clearAuthMessage();
                showStep(target);
                scrollRegistrationToTop();
            }
        });
    });

    form.addEventListener("submit", (event) => {
        event.preventDefault();
        clearAuthMessage();

        /*
         * Validate every step again. Users can return to earlier
         * steps and change values before submitting.
         */
        for (let step = 1; step <= totalSteps; step += 1) {
            if (!validateRegistrationStep(step)) {
                showStep(step);
                showAuthMessage(
                    "Please review the highlighted fields before submitting.",
                    "error"
                );
                focusFirstInvalidField();
                return;
            }
        }

        const selectedPlan = getSelectedPlanInformation();

        showAuthMessage(
            `${selectedPlan.label} is selected. Registration is a preview: no account, agency profile, trial, or subscription has been created. Connect Supabase before accepting registrations.`,
            "information"
        );
    });

    showStep(currentStep);
}

/* =========================================================
   PLAN SELECTION
========================================================= */

const registrationPlans = {
    free: {
        label: "Free",
        note: "$0/month. Basic agency listing. No payment is taken here."
    },
    prive: {
        label: "Privé",
        note: "$49/month. Plan selection does not start billing."
    },
    select: {
        label: "Privé Select",
        note: "$129/month. Plan selection does not start billing."
    },
    elite: {
        label: "Privé Elite",
        note: "$299/month launch price. Plan selection does not start billing."
    }
};

function initializeRegistrationPlan() {
    const select = getElement("registrationPlan");
    const note = getElement("registrationPlanNote");
    if (!select) return;

    const aliases = {
        free: "free",
        prive: "prive",
        "privé": "prive",
        premium: "prive",
        pro: "prive",
        select: "select",
        "prive-select": "select",
        "privé-select": "select",
        featured: "select",
        elite: "elite",
        "prive-elite": "elite",
        "privé-elite": "elite"
    };

    const requested = new URLSearchParams(
        window.location.search
    ).get("plan")?.trim().toLowerCase();

    const selected = aliases[requested];
    if (selected) select.value = selected;

    function updateNote() {
        if (note) {
            note.textContent =
                registrationPlans[select.value]?.note ||
                "Choose the plan that fits your agency.";
        }
    }

    select.addEventListener("change", () => {
        clearInputError(select, "registrationPlanError");
        clearAuthMessage();
        updateNote();
    });

    updateNote();
}

function getSelectedPlanInformation() {
    const value = getElement("registrationPlan")?.value || "";

    return {
        value,
        label: registrationPlans[value]?.label || "Your plan"
    };
}

/* =========================================================
   CONDITIONAL FIELDS
========================================================= */

function initializeConditionalField(
    checkboxId,
    containerId,
    inputId,
    errorId
) {
    const checkbox = getElement(checkboxId);
    const container = getElement(containerId);
    const input = getElement(inputId);

    if (!checkbox || !container || !input) return;

    function update() {
        container.hidden = !checkbox.checked;
        input.required = checkbox.checked;

        if (!checkbox.checked) {
            input.value = "";
            clearInputError(input, errorId);
        }
    }

    checkbox.addEventListener("change", update);
    input.addEventListener("input", () => {
        input.classList.remove("invalid");
        input.removeAttribute("aria-invalid");
        setGroupError(errorId, "");
        clearAuthMessage();
    });

    update();
}

/* =========================================================
   SERVICE COUNTER AND GROUP ERRORS
========================================================= */

function initializeSelectionCounters() {
    const counter = getElement("servicesSelectedCount");

    function update() {
        if (counter) {
            counter.textContent = document.querySelectorAll(
                'input[name="services"]:checked'
            ).length;
        }

        setGroupError("servicesError", "");
        clearAuthMessage();
    }

    document.querySelectorAll(
        'input[name="services"]'
    ).forEach((input) => {
        input.addEventListener("change", update);
    });

    if (counter) {
        counter.textContent = document.querySelectorAll(
            'input[name="services"]:checked'
        ).length;
    }
}

/* =========================================================
   COUNTRY SEARCH
========================================================= */

function initializeCountrySearch() {
    const search = getElement("countrySearch");
    const options = getElement("countryOptions");

    if (!search || !options) return;

    const cards = Array.from(
        options.querySelectorAll("[data-country]")
    );

    search.addEventListener("input", () => {
        const query = search.value.trim().toLowerCase();

        cards.forEach((card) => {
            card.classList.toggle(
                "filtered-out",
                !card.dataset.country.toLowerCase().includes(query)
            );
        });
    });

    options.addEventListener("change", () => {
        setGroupError("countriesServedError", "");
        clearAuthMessage();
    });
}

/* =========================================================
   LOGO PREVIEW
========================================================= */

function initializeLogoUpload() {
    const input = getElement("agencyLogo");
    const preview = getElement("logoPreview");
    if (!input || !preview) return;

    let previewUrl = null;

    function resetPreview() {
        if (previewUrl) {
            URL.revokeObjectURL(previewUrl);
            previewUrl = null;
        }

        preview.innerHTML =
            '<i class="fa-regular fa-image"></i>';
    }

    input.addEventListener("change", () => {
        clearInputError(input, "agencyLogoError");

        const file = input.files?.[0];
        if (!file) {
            resetPreview();
            return;
        }

        const acceptedTypes = [
            "image/png",
            "image/jpeg",
            "image/webp"
        ];

        if (!acceptedTypes.includes(file.type)) {
            input.value = "";
            resetPreview();
            setInputError(
                input,
                "agencyLogoError",
                "Upload a PNG, JPG, or WEBP image."
            );
            return;
        }

        if (file.size > 5 * 1024 * 1024) {
            input.value = "";
            resetPreview();
            setInputError(
                input,
                "agencyLogoError",
                "The logo must be 5 MB or smaller."
            );
            return;
        }

        resetPreview();
        previewUrl = URL.createObjectURL(file);

        const image = document.createElement("img");
        image.src = previewUrl;
        image.alt = "Agency logo preview";
        preview.appendChild(image);
    });
}

/* =========================================================
   ABOUT COUNTER
========================================================= */

function initializeAboutCounter() {
    const textarea = getElement("agencyAbout");
    const counter = getElement("aboutCharacterCount");
    if (!textarea || !counter) return;

    function update() {
        counter.textContent = textarea.value.length;
    }

    textarea.addEventListener("input", update);
    update();
}

/* =========================================================
   CLEAR ERRORS WHILE EDITING
========================================================= */

function initializeRegistrationFieldClearing() {
    const fields = [
        ["registrationPlan", "registrationPlanError"],
        ["firstName", "firstNameError"],
        ["lastName", "lastNameError"],
        ["registrationEmail", "registrationEmailError"],
        ["registrationPassword", "registrationPasswordError"],
        ["confirmPassword", "confirmPasswordError"],
        ["companyName", "companyNameError"],
        ["country", "countryError"],
        ["companyWebsite", "companyWebsiteError"],
        ["yearsInBusiness", "yearsInBusinessError"],
        ["agencyAbout", "agencyAboutError"],
        ["instagram", "instagramError"],
        ["xProfile", "xProfileError"],
        ["tiktok", "tiktokError"],
        ["linkedin", "linkedinError"]
    ];

    fields.forEach(([id, errorId]) => {
        const input = getElement(id);
        if (!input) return;

        const clear = () => {
            clearInputError(input, errorId);
            clearAuthMessage();
        };

        input.addEventListener("input", clear);
        input.addEventListener("change", clear);
    });

    document.querySelectorAll(
        'input[name="creatorNiches"], input[name="agencySize"]'
    ).forEach((input) => {
        input.addEventListener("change", () => {
            setGroupError(
                input.name === "creatorNiches"
                    ? "creatorNichesError"
                    : "agencySizeError",
                ""
            );
            clearAuthMessage();
        });
    });

    [
        ["authorizedRepresentative", "authorizedRepresentativeError"],
        ["acceptTerms", "acceptTermsError"]
    ].forEach(([id, errorId]) => {
        getElement(id)?.addEventListener("change", () => {
            setGroupError(errorId, "");
            clearAuthMessage();
        });
    });
}

/* =========================================================
   STEP VALIDATION
========================================================= */

function validateRegistrationStep(number) {
    switch (number) {
        case 1:
            return validateAgencyDetailsStep();
        case 2:
            return validateServicesStep();
        case 3:
            return validateExpertiseStep();
        case 4:
            return validateAboutStep();
        default:
            return false;
    }
}

function validateAgencyDetailsStep() {
    const results = [
        validateRequiredSelect(
            "registrationPlan",
            "registrationPlanError",
            "Select a registration plan."
        ),
        validateRequiredText(
            "firstName",
            "firstNameError",
            "First name is required."
        ),
        validateRequiredText(
            "lastName",
            "lastNameError",
            "Last name is required."
        ),
        validateRegistrationEmail(),
        validateRegistrationPassword(),
        validatePasswordConfirmation(),
        validateRequiredText(
            "companyName",
            "companyNameError",
            "Agency name is required."
        ),
        validateRequiredSelect(
            "country",
            "countryError",
            "Select your primary location."
        ),
        validateCompanyWebsite()
    ];

    return results.every(Boolean);
}

function validateServicesStep() {
    const selected = document.querySelectorAll(
        'input[name="services"]:checked'
    );

    const otherCheckbox = getElement("otherServiceCheckbox");
    const otherInput = getElement("otherService");

    if (!selected.length) {
        setGroupError(
            "servicesError",
            "Select at least one OnlyFans service."
        );
        return false;
    }

    if (
        otherCheckbox?.checked &&
        !otherInput?.value.trim()
    ) {
        setInputError(
            otherInput,
            "servicesError",
            "Specify your additional OnlyFans service."
        );
        return false;
    }

    if (otherInput) {
        otherInput.classList.remove("invalid");
        otherInput.removeAttribute("aria-invalid");
    }

    setGroupError("servicesError", "");
    return true;
}

function validateExpertiseStep() {
    const niches = document.querySelectorAll(
        'input[name="creatorNiches"]:checked'
    );
    const countries = document.querySelectorAll(
        'input[name="countriesServed"]:checked'
    );
    const size = document.querySelector(
        'input[name="agencySize"]:checked'
    );

    const otherCheckbox = getElement("otherNicheCheckbox");
    const otherInput = getElement("otherNiche");

    let nichesValid = niches.length > 0;

    setGroupError(
        "creatorNichesError",
        nichesValid
            ? ""
            : "Select at least one OnlyFans creator specialty."
    );

    if (
        otherCheckbox?.checked &&
        !otherInput?.value.trim()
    ) {
        setInputError(
            otherInput,
            "creatorNichesError",
            "Specify the additional OnlyFans creator specialty."
        );
        nichesValid = false;
    } else if (otherInput) {
        otherInput.classList.remove("invalid");
        otherInput.removeAttribute("aria-invalid");
    }

    setGroupError(
        "countriesServedError",
        countries.length
            ? ""
            : "Select at least one country or region."
    );

    setGroupError(
        "agencySizeError",
        size ? "" : "Select your agency size."
    );

    const yearsValid = validateRequiredSelect(
        "yearsInBusiness",
        "yearsInBusinessError",
        "Select how long the agency has operated."
    );

    return (
        nichesValid &&
        countries.length > 0 &&
        Boolean(size) &&
        yearsValid
    );
}

function validateAboutStep() {
    const aboutValid = validateMinimumText(
        "agencyAbout",
        "agencyAboutError",
        80,
        "Write at least 80 characters about your agency."
    );

    const socialResults = [
        ["instagram", "instagramError"],
        ["xProfile", "xProfileError"],
        ["tiktok", "tiktokError"],
        ["linkedin", "linkedinError"]
    ].map(([id, errorId]) => {
        return validateOptionalWebsite(id, errorId);
    });

    const representativeValid = validateRequiredCheckbox(
        "authorizedRepresentative",
        "authorizedRepresentativeError",
        "Confirm that you are authorized to represent this agency."
    );

    const termsValid = validateRequiredCheckbox(
        "acceptTerms",
        "acceptTermsError",
        "Accept the terms before submitting."
    );

    return (
        aboutValid &&
        socialResults.every(Boolean) &&
        representativeValid &&
        termsValid
    );
}

/* =========================================================
   FIELD VALIDATION
========================================================= */

function validateRequiredText(id, errorId, message) {
    const input = getElement(id);
    if (!input) return false;

    if (!input.value.trim()) {
        setInputError(input, errorId, message);
        return false;
    }

    clearInputError(input, errorId);
    return true;
}

function validateMinimumText(
    id,
    errorId,
    minimumLength,
    message
) {
    const input = getElement(id);
    if (!input) return false;

    if (input.value.trim().length < minimumLength) {
        setInputError(input, errorId, message);
        return false;
    }

    clearInputError(input, errorId);
    return true;
}

function validateRequiredSelect(id, errorId, message) {
    const input = getElement(id);
    if (!input) return false;

    if (!input.value) {
        setInputError(input, errorId, message);
        return false;
    }

    clearInputError(input, errorId);
    return true;
}

function validateRequiredCheckbox(id, errorId, message) {
    const checkbox = getElement(id);
    if (!checkbox) return false;

    setGroupError(
        errorId,
        checkbox.checked ? "" : message
    );

    return checkbox.checked;
}

function validateRegistrationEmail() {
    const input = getElement("registrationEmail");
    if (!input) return false;

    if (!input.value.trim()) {
        setInputError(
            input,
            "registrationEmailError",
            "Business email is required."
        );
        return false;
    }

    if (!isValidEmail(input.value)) {
        setInputError(
            input,
            "registrationEmailError",
            "Enter a valid business email."
        );
        return false;
    }

    clearInputError(input, "registrationEmailError");
    return true;
}

function validateCompanyWebsite() {
    const input = getElement("companyWebsite");
    if (!input) return true;

    if (!isValidWebsite(input.value)) {
        setInputError(
            input,
            "companyWebsiteError",
            "Use a complete address beginning with http:// or https://."
        );
        return false;
    }

    clearInputError(input, "companyWebsiteError");
    return true;
}

function validateOptionalWebsite(id, errorId) {
    const input = getElement(id);
    if (!input) return true;

    if (!isValidWebsite(input.value)) {
        setInputError(
            input,
            errorId,
            "Enter a complete URL beginning with http:// or https://."
        );
        return false;
    }

    clearInputError(input, errorId);
    return true;
}

function validateRegistrationPassword() {
    const input = getElement("registrationPassword");
    if (!input) return false;

    if (!input.value) {
        setInputError(
            input,
            "registrationPasswordError",
            "Password is required."
        );
        return false;
    }

    if (input.value.length < 8) {
        setInputError(
            input,
            "registrationPasswordError",
            "Use at least eight characters."
        );
        return false;
    }

    if (
        !/[A-Za-z]/.test(input.value) ||
        !/\d/.test(input.value)
    ) {
        setInputError(
            input,
            "registrationPasswordError",
            "Include at least one letter and one number."
        );
        return false;
    }

    clearInputError(input, "registrationPasswordError");
    return true;
}

function validatePasswordConfirmation() {
    const password = getElement("registrationPassword");
    const confirmation = getElement("confirmPassword");

    if (!password || !confirmation) return false;

    if (!confirmation.value) {
        setInputError(
            confirmation,
            "confirmPasswordError",
            "Confirm your password."
        );
        return false;
    }

    if (password.value !== confirmation.value) {
        setInputError(
            confirmation,
            "confirmPasswordError",
            "Passwords do not match."
        );
        return false;
    }

    clearInputError(confirmation, "confirmPasswordError");
    return true;
}

/* =========================================================
   WIZARD NAVIGATION HELPERS
========================================================= */

function focusFirstInvalidField() {
    const step = document.querySelector(
        ".wizard-step.active"
    );

    const invalid = step?.querySelector(".invalid");

    if (invalid) {
        invalid.focus();
        return;
    }

    /*
     * Group errors do not have an .invalid input.
     * Focus their first related selection instead.
     */
    const groups = [
        ["servicesError", 'input[name="services"]'],
        ["creatorNichesError", 'input[name="creatorNiches"]'],
        ["countriesServedError", 'input[name="countriesServed"]'],
        ["agencySizeError", 'input[name="agencySize"]'],
        ["authorizedRepresentativeError", "#authorizedRepresentative"],
        ["acceptTermsError", "#acceptTerms"]
    ];

    for (const [errorId, selector] of groups) {
        if (getElement(errorId)?.textContent) {
            step?.querySelector(selector)?.focus();
            return;
        }
    }
}

function scrollRegistrationToTop() {
    getElement("registrationForm")?.scrollIntoView({
        behavior: "smooth",
        block: "start"
    });
}
