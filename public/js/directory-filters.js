/* Shared, data-derived directory filters. Stored agency records are never modified. */
(() => {
    const text = value => typeof value === 'string' ? value.trim().replace(/\s+/g, ' ') : '';
    const normalize = value => text(value).normalize('NFKC').toLowerCase().replace(/[–—−]/g, '-');
    const key = (value, field) => field === 'niches' && normalize(value) === 'adult creators' ? 'adult' : normalize(value);
    const values = (agency, field) => {
        const value = field === 'location' ? [agency.country, agency.region] : agency[field];
        return (Array.isArray(value) ? value : [value]).filter(value => text(value));
    };
    function options(records, field) {
        const unique = new Map();
        for (const agency of records) for (const value of values(agency, field)) {
            const normalized = key(value, field);
            let label = text(value);
            if (field === 'niches' && normalized === 'adult') label = 'Adult';
            if (field === 'size') label = label.replace(/^(\d+)\s*[-–—−]\s*(\d+)$/, '$1–$2');
            // Pick a stable display label regardless of the API row order.
            if (!unique.has(normalized) || label.localeCompare(unique.get(normalized), 'en') < 0) unique.set(normalized, label);
        }
        return [...unique].map(([value, label]) => ({ value, label })).sort((a, b) => {
            if (field === 'size') {
                const start = value => /^\d/.test(value) ? Number.parseInt(value, 10) : Infinity;
                const difference = start(a.value) - start(b.value);
                if (Number.isFinite(difference) && difference !== 0) return difference;
                if (Number.isFinite(start(a.value)) !== Number.isFinite(start(b.value))) return Number.isFinite(start(a.value)) ? -1 : 1;
            }
            return a.label.localeCompare(b.label, 'en', { numeric: true });
        });
    }
    function matches(agency, field, selected) {
        return !selected || values(agency, field).some(value => key(value, field) === key(selected, field));
    }
    function newestFirst(a, b) {
        const timestamp = agency => {
            const parsed = Date.parse(agency.published_at || agency.publishedAt || '');
            return Number.isFinite(parsed) ? parsed : 0;
        };
        return timestamp(b) - timestamp(a) || String(a.name || '').localeCompare(String(b.name || ''), 'en');
    }
    globalThis.AveraDirectoryFilters = { normalize, options, matches, newestFirst };
})();
