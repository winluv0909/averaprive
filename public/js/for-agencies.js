/* =========================================================
   Avera Privé — FOR AGENCIES

   Plan prices are displayed directly in for-agencies.html.
   No annual billing rates are advertised on this page.
========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    initializeFaq();
    initializeProcessSteps();
});

/* =========================================================
   FAQ
========================================================= */

function initializeFaq() {
    const faqItems =
        document.querySelectorAll(".faq-item");

    faqItems.forEach((item) => {
        const button =
            item.querySelector("button");

        if (!button) return;

        button.setAttribute(
            "aria-expanded",
            item.classList.contains("open")
                ? "true"
                : "false"
        );

        button.addEventListener("click", () => {
            const willOpen =
                !item.classList.contains("open");

            faqItems.forEach((currentItem) => {
                currentItem.classList.remove("open");

                currentItem
                    .querySelector("button")
                    ?.setAttribute(
                        "aria-expanded",
                        "false"
                    );
            });

            if (willOpen) {
                item.classList.add("open");

                button.setAttribute(
                    "aria-expanded",
                    "true"
                );
            }
        });
    });
}

/* =========================================================
   PROCESS STEPS
========================================================= */

function initializeProcessSteps() {
    const processItems =
        document.querySelectorAll(
            ".agency-process-list article"
        );

    if (!processItems.length) return;

    processItems.forEach((item) => {
        item.addEventListener("mouseenter", () => {
            processItems.forEach(
                (currentItem) => {
                    currentItem.classList.remove(
                        "active"
                    );
                }
            );

            item.classList.add("active");
        });
    });
}