/* =========================================================
   Avera Privé — LOCAL UI TRANSLATIONS

   Elements with data-translate="key" use these strings.

   Only the keys listed here are translated. Other page text
   remains in its original language until translated separately.
========================================================= */

const translations = {
    en: {
        navAgencies: "Agencies",
        navRankings: "Rankings",
        navCompare: "Compare",
        navInsights: "Insights",
        navForAgencies: "For Agencies",
        navLogin: "Log in",
        getDemo: "Get a Demo",
        startTrial: "Create Free Profile"
    },

    tl: {
        navAgencies: "Mga Ahensiya",
        navRankings: "Mga Ranggo",
        navCompare: "Paghambingin",
        navInsights: "Mga Artikulo",
        navForAgencies: "Para sa mga Ahensiya",
        navLogin: "Mag-log in",
        getDemo: "Tingnan ang Demo",
        startTrial: "Gumawa ng Libreng Profile"
    },

    es: {
        navAgencies: "Agencias",
        navRankings: "Clasificaciones",
        navCompare: "Comparar",
        navInsights: "Artículos",
        navForAgencies: "Para agencias",
        navLogin: "Iniciar sesión",
        getDemo: "Ver la demostración",
        startTrial: "Crear perfil gratuito"
    },

    fr: {
        navAgencies: "Agences",
        navRankings: "Classements",
        navCompare: "Comparer",
        navInsights: "Analyses",
        navForAgencies: "Pour les agences",
        navLogin: "Se connecter",
        getDemo: "Voir la démo",
        startTrial: "Créer un profil gratuit"
    },

    de: {
        navAgencies: "Agenturen",
        navRankings: "Ranglisten",
        navCompare: "Vergleichen",
        navInsights: "Einblicke",
        navForAgencies: "Für Agenturen",
        navLogin: "Anmelden",
        getDemo: "Demo ansehen",
        startTrial: "Kostenloses Profil erstellen"
    },

    pt: {
        navAgencies: "Agências",
        navRankings: "Classificações",
        navCompare: "Comparar",
        navInsights: "Conteúdos",
        navForAgencies: "Para agências",
        navLogin: "Entrar",
        getDemo: "Ver demonstração",
        startTrial: "Criar perfil gratuito"
    },

    ja: {
        navAgencies: "エージェンシー",
        navRankings: "ランキング",
        navCompare: "比較",
        navInsights: "インサイト",
        navForAgencies: "エージェンシー向け",
        navLogin: "ログイン",
        getDemo: "デモを見る",
        startTrial: "無料プロフィールを作成"
    },

    zh: {
        navAgencies: "机构目录",
        navRankings: "排名",
        navCompare: "比较",
        navInsights: "行业资讯",
        navForAgencies: "机构服务",
        navLogin: "登录",
        getDemo: "查看演示",
        startTrial: "创建免费资料"
    }
};

/* =========================================================
   SUPPORTED LANGUAGE INFORMATION

   Add a language here only after its strings are also
   available in translations above.
========================================================= */

const languageInformation = {
    en: {
        code: "EN",
        direction: "ltr"
    },

    tl: {
        code: "TL",
        direction: "ltr"
    },

    es: {
        code: "ES",
        direction: "ltr"
    },

    fr: {
        code: "FR",
        direction: "ltr"
    },

    de: {
        code: "DE",
        direction: "ltr"
    },

    pt: {
        code: "PT",
        direction: "ltr"
    },

    ja: {
        code: "JA",
        direction: "ltr"
    },

    zh: {
        code: "ZH",
        direction: "ltr"
    }
};

/* =========================================================
   LANGUAGE HELPERS
========================================================= */

function getSupportedLanguage(languageCode) {
    if (
        typeof languageCode === "string" &&
        Object.prototype.hasOwnProperty.call(
            translations,
            languageCode
        )
    ) {
        return languageCode;
    }

    return "en";
}

function saveLanguagePreference(languageCode) {
    try {
        localStorage.setItem(
            "agencyPriveLanguage",
            languageCode
        );
    } catch {
        // The selector still works if browser storage is blocked.
    }
}

function loadLanguagePreference() {
    try {
        return localStorage.getItem(
            "agencyPriveLanguage"
        );
    } catch {
        return null;
    }
}

/* =========================================================
   SET WEBSITE LANGUAGE
========================================================= */

function setWebsiteLanguage(languageCode) {
    const supportedCode = getSupportedLanguage(
        languageCode
    );

    const selectedStrings = translations[
        supportedCode
    ];

    document.querySelectorAll(
        "[data-translate]"
    ).forEach((element) => {
        const key = element.dataset.translate;

        const translatedValue =
            selectedStrings[key] ??
            translations.en[key];

        if (typeof translatedValue === "string") {
            element.textContent = translatedValue;
        }
    });

    document.documentElement.lang = supportedCode;

    document.documentElement.dir =
        languageInformation[supportedCode]
            .direction;

    updateLanguageCode(supportedCode);
    updateSelectedLanguageOption(supportedCode);
    saveLanguagePreference(supportedCode);
}

/* =========================================================
   UPDATE LANGUAGE BUTTON AND MENU
========================================================= */

function updateLanguageCode(languageCode) {
    const currentLanguage =
        document.getElementById(
            "currentLanguage"
        );

    if (!currentLanguage) return;

    currentLanguage.textContent =
        languageInformation[languageCode]
            ?.code || "EN";
}

function updateSelectedLanguageOption(
    languageCode
) {
    document.querySelectorAll(
        "[data-language]"
    ).forEach((button) => {
        const selected =
            button.dataset.language ===
            languageCode;

        button.classList.toggle(
            "selected",
            selected
        );

        button.setAttribute(
            "aria-selected",
            String(selected)
        );
    });
}

/* =========================================================
   LOAD SAVED LANGUAGE
========================================================= */

document.addEventListener(
    "DOMContentLoaded",
    () => {
        setWebsiteLanguage(
            loadLanguagePreference() || "en"
        );
    }
);

/*
 * main.js can call this function when the user selects
 * another supported language.
 */
window.setWebsiteLanguage =
    setWebsiteLanguage;