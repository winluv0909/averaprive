/* =========================================================
   Avera Privé — DEMO FORM PREVIEW

   Frontend validation only.
   No request is submitted, emailed, or saved.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeDemoForm();
    initializeDemoCharacterCounter();
    preselectRequestedPlan();
});

/* =========================================================
   HELPERS
========================================================= */

function getDemoElement(id) {
    return document.getElementById(id);
}

function isValidDemoEmail(value) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(
        value.trim()
    );
}

function isValidDemoWebsite(value) {
    if (!value.trim()) return true;

    try {
        const url = new URL(value.trim());

        return (
            url.protocol === "http:" ||
            url.protocol === "https:"
        );
    } catch {
        return false;
    }
}

/* =========================================================
   FORM MESSAGE
========================================================= */

function showDemoMessage(
    message,
    type = "information"
) {
    const element = getDemoElement("demoMessage");
    if (!element) return;

    element.textContent = message;
    element.className =
        `demo-message show ${type}`;

    element.scrollIntoView({
        behavior: "smooth",
        block: "nearest"
    });
}

function clearDemoMessage() {
    const element = getDemoElement("demoMessage");
    if (!element) return;

    element.textContent = "";
    element.className = "demo-message";
}

/* =========================================================
   FIELD ERRORS
========================================================= */

function setDemoFieldError(
    input,
    errorId,
    message
) {
    if (input) {
        input.classList.add("invalid");
        input.setAttribute(
            "aria-invalid",
            "true"
        );
    }

    const error = getDemoElement(errorId);
    if (error) error.textContent = message;
}

function clearDemoFieldError(input, errorId) {
    if (input) {
        input.classList.remove("invalid");
        input.removeAttribute("aria-invalid");
    }

    const error = getDemoElement(errorId);
    if (error) error.textContent = "";
}

/* =========================================================
   INITIALIZE FORM
========================================================= */

function initializeDemoForm() {
    const form = getDemoElement("demoForm");
    if (!form) return;

    const fields = [
        ["demoFirstName", "demoFirstNameError"],
        ["demoLastName", "demoLastNameError"],
        ["demoEmail", "demoEmailError"],
        ["demoAgencyName", "demoAgencyNameError"],
        ["demoAgencySize", "demoAgencySizeError"],
        ["demoPlan", "demoPlanError"],
        ["demoWebsite", "demoWebsiteError"],
        ["demoGoals", "demoGoalsError"]
    ];

    fields.forEach(([inputId, errorId]) => {
        const input = getDemoElement(inputId);
        if (!input) return;

        const clear = () => {
            clearDemoFieldError(input, errorId);
            clearDemoMessage();
        };

        input.addEventListener("input", clear);
        input.addEventListener("change", clear);
    });

    const consent = getDemoElement("demoConsent");

    consent?.addEventListener("change", () => {
        clearDemoFieldError(
            consent,
            "demoConsentError"
        );
        clearDemoMessage();
    });

    let pendingSubmission = null;
    let submitting = false;
    form.addEventListener("submit", async (event) => {
        if (submitting) { event.preventDefault(); return; }
        event.preventDefault();
        clearDemoMessage();

        if (!validateDemoForm()) {
            showDemoMessage(
                "Please complete the highlighted fields.",
                "error"
            );

            focusFirstDemoError();
            return;
        }

        const values = Object.fromEntries(new FormData(form).entries());
        values.consent = consent?.checked === true;
        const signature = JSON.stringify(values);
        if (!pendingSubmission || pendingSubmission.signature !== signature) {
            pendingSubmission = { signature, requestId: crypto.randomUUID() };
        }
        const button = getDemoElement("demoSubmitButton");
        submitting = true;
        if (button) button.disabled = true;
        form.setAttribute("aria-busy", "true");
        showDemoMessage("Saving your demo request…", "information");
        try {
            const response = await fetch("/api/demo-requests", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ ...values, requestId: pendingSubmission.requestId }),
                signal: AbortSignal.timeout(25000)
            });
            const result = await response.json();
            if (!response.ok || !result.requestId) {
                throw new Error(result.error || "Your request could not be saved. Please try again.");
            }
            showDemoMessage(`${result.message} Reference: ${result.requestId}`, "information");
            form.reset();
            pendingSubmission = null;
            const counter = getDemoElement("demoCharacterCount");
            if (counter) counter.textContent = "0";
        } catch (error) {
            showDemoMessage(error.name === "TimeoutError"
                ? "We could not confirm your request. Please retry without changing the form details."
                : error.message || "We could not confirm your request. Please try again.", "error");
        } finally {
            submitting = false;
            if (button) button.disabled = false;
            form.removeAttribute("aria-busy");
        }
    });
}

/* =========================================================
   COMPLETE FORM VALIDATION
========================================================= */

function validateDemoForm() {
    const results = [
        validateDemoRequiredText(
            "demoFirstName",
            "demoFirstNameError",
            "First name is required."
        ),

        validateDemoRequiredText(
            "demoLastName",
            "demoLastNameError",
            "Last name is required."
        ),

        validateDemoEmail(),

        validateDemoRequiredText(
            "demoAgencyName",
            "demoAgencyNameError",
            "OnlyFans agency name is required."
        ),

        validateDemoRequiredSelect(
            "demoAgencySize",
            "demoAgencySizeError",
            "Select your agency size."
        ),

        validateDemoRequiredSelect(
            "demoPlan",
            "demoPlanError",
            "Select the plan you would like to explore."
        ),

        validateDemoWebsite(),

        validateDemoGoals(),

        validateDemoConsent()
    ];

    return results.every(Boolean);
}

/* =========================================================
   REQUIRED TEXT AND SELECT
========================================================= */

function validateDemoRequiredText(
    inputId,
    errorId,
    message
) {
    const input = getDemoElement(inputId);
    if (!input) return false;

    if (!input.value.trim()) {
        setDemoFieldError(
            input,
            errorId,
            message
        );
        return false;
    }

    clearDemoFieldError(input, errorId);
    return true;
}

function validateDemoRequiredSelect(
    selectId,
    errorId,
    message
) {
    const select = getDemoElement(selectId);
    if (!select) return false;

    if (!select.value) {
        setDemoFieldError(
            select,
            errorId,
            message
        );
        return false;
    }

    clearDemoFieldError(select, errorId);
    return true;
}

/* =========================================================
   EMAIL
========================================================= */

function validateDemoEmail() {
    const input = getDemoElement("demoEmail");
    if (!input) return false;

    if (!input.value.trim()) {
        setDemoFieldError(
            input,
            "demoEmailError",
            "Business email is required."
        );
        return false;
    }

    if (!isValidDemoEmail(input.value)) {
        setDemoFieldError(
            input,
            "demoEmailError",
            "Enter a valid business email address."
        );
        return false;
    }

    clearDemoFieldError(
        input,
        "demoEmailError"
    );
    return true;
}

/* =========================================================
   WEBSITE
========================================================= */

function validateDemoWebsite() {
    const input = getDemoElement("demoWebsite");
    if (!input) return true;

    if (!isValidDemoWebsite(input.value)) {
        setDemoFieldError(
            input,
            "demoWebsiteError",
            "Enter a complete URL beginning with http:// or https://."
        );
        return false;
    }

    clearDemoFieldError(
        input,
        "demoWebsiteError"
    );
    return true;
}

/* =========================================================
   GOALS
========================================================= */

function validateDemoGoals() {
    const input = getDemoElement("demoGoals");
    if (!input) return false;

    const value = input.value.trim();

    if (!value) {
        setDemoFieldError(
            input,
            "demoGoalsError",
            "Tell us what you would like to explore."
        );
        return false;
    }

    if (value.length < 20) {
        setDemoFieldError(
            input,
            "demoGoalsError",
            "Please provide at least 20 characters."
        );
        return false;
    }

    clearDemoFieldError(
        input,
        "demoGoalsError"
    );
    return true;
}

/* =========================================================
   CONSENT
========================================================= */

function validateDemoConsent() {
    const input = getDemoElement("demoConsent");
    if (!input) return false;

    if (!input.checked) {
        setDemoFieldError(
            input,
            "demoConsentError",
            "Confirm your contact preference to continue."
        );
        return false;
    }

    clearDemoFieldError(
        input,
        "demoConsentError"
    );
    return true;
}

/* =========================================================
   CHARACTER COUNTER
========================================================= */

function initializeDemoCharacterCounter() {
    const input = getDemoElement("demoGoals");
    const counter = getDemoElement(
        "demoCharacterCount"
    );

    if (!input || !counter) return;

    const update = () => {
        counter.textContent = input.value.length;
    };

    input.addEventListener("input", update);
    update();
}

/* =========================================================
   PRESELECT PLAN FROM URL
========================================================= */

function preselectRequestedPlan() {
    const select = getDemoElement("demoPlan");
    if (!select) return;

    const requested = new URLSearchParams(
        window.location.search
    ).get("plan")?.trim().toLowerCase();

    const supportedPlans = new Set([
        "free",
        "prive",
        "select",
        "elite",
        "not-sure"
    ]);

    if (supportedPlans.has(requested)) {
        select.value = requested;
    }
}

/* =========================================================
   FOCUS FIRST ERROR
========================================================= */

function focusFirstDemoError() {
    document
        .querySelector("#demoForm .invalid")
        ?.focus();
}