/* Avera Privé directory. Only approved, published records belong here. */
let agencies = [];

function marketplaceSession() {
    let value; try { value = sessionStorage.getItem('ap_marketplace_session'); } catch { return crypto.randomUUID().replaceAll('-', '_'); }
    if (!value) { value = crypto.randomUUID().replaceAll('-', '_'); try { sessionStorage.setItem('ap_marketplace_session', value); } catch { /* Per-request ID if storage is unavailable. */ } }
    return value;
}

function recordMarketplaceEvent(agency, eventType) {
    if (!agency?.agencyId || agency.demoProfile === true || !window.apPrivacy?.analyticsAllowed()) return;
    fetch('/api/marketplace/event', {method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agencyId:agency.agencyId,eventType,sessionId:marketplaceSession(),page:location.pathname,source:agency.sponsored===true?'sponsored':'organic',analyticsConsent:true})}).catch(()=>{});
}

document.addEventListener('DOMContentLoaded', async () => {
    const form = document.getElementById('agencySearchForm');
    const grid = document.getElementById('agencyCardGrid');
    if (!form || !grid) return;
    const ids = ['agencySearch','categoryFilter','locationFilter','serviceFilter','nicheFilter',
        'verifiedFilter','featuredFilter','reviewsFilter','contactFilter','experienceFilter','sortFilter'];
    const fields = Object.fromEntries(ids.map(id => [id, document.getElementById(id)]));
    const empty = document.getElementById('directoryEmptyState');
    const count = document.getElementById('resultCount');
    const pagination = document.getElementById('directoryPagination');
    const filters = document.getElementById('directoryFilters');
    const overlay = document.getElementById('filterOverlay');
    let page = 1;
    const pageSize = 6;
    const params = new URLSearchParams(location.search);
    const filterData = window.AveraDirectoryFilters;
    fields.agencySearch.value = params.get('search') || '';
    const getSize = () => document.querySelector('input[name="agencySize"]:checked')?.value || '';
    const normalize = value => String(value ?? '').toLocaleLowerCase().trim();
    const list = value => Array.isArray(value) ? value : [];
    const years = agency => Number(agency.yearsInBusiness ?? agency.years) || 0;
    const reviewCount = agency => Number(agency.reviewCount ?? agency.reviews) || 0;
    const rating = agency => reviewCount(agency) ? Number(agency.rating) || 0 : -1;
    const compareName = (a,b) => String(a.name).localeCompare(String(b.name));
    const hasFilter = () => Boolean(fields.agencySearch?.value.trim() || fields.categoryFilter?.value || fields.locationFilter?.value || fields.serviceFilter?.value || fields.nicheFilter?.value || fields.verifiedFilter?.checked || fields.featuredFilter?.checked || fields.reviewsFilter?.checked || fields.contactFilter?.checked || getSize() || Number(fields.experienceFilter?.value));
    function render() {
        const search = normalize(fields.agencySearch?.value);
        const results = agencies.filter(agency => agency.status === 'approved' && agency.published === true).filter(agency => {
            const searchable = [agency.name,agency.description,agency.location,agency.country,agency.region,agency.category,...list(agency.services),...list(agency.niches)].map(normalize).join(' ');
            return (!search || searchable.includes(search)) &&
                filterData.matches(agency, 'category', fields.categoryFilter?.value) &&
                filterData.matches(agency, 'location', fields.locationFilter?.value) &&
                filterData.matches(agency, 'services', fields.serviceFilter?.value) &&
                filterData.matches(agency, 'niches', fields.nicheFilter?.value) &&
                (!fields.verifiedFilter?.checked || agency.verificationStatus === 'verified') &&
                (!fields.featuredFilter?.checked || agency.sponsored === true) &&
                (!fields.reviewsFilter?.checked || reviewCount(agency) > 0) &&
                (!fields.contactFilter?.checked || agency.acceptingInquiries === true) &&
                filterData.matches(agency, 'size', getSize()) &&
                years(agency) >= Number(fields.experienceFilter?.value || 0);
        });
        const sort = fields.sortFilter?.value || 'name';
        results.sort((a,b) => {
            if (sort === 'rating') return rating(b)-rating(a) || reviewCount(b)-reviewCount(a) || compareName(a,b);
            if (sort === 'experience') return years(b)-years(a) || compareName(a,b);
            if (sort === 'newest') return filterData.newestFirst(a,b);
            return compareName(a,b);
        });
        count.textContent = String(results.length);
        const pages = Math.ceil(results.length / pageSize);
        page = Math.max(1, Math.min(page,pages || 1));
        const visible = results.slice((page-1)*pageSize,page*pageSize);
        grid.replaceChildren(...visible.map(card));
        visible.forEach(agency => recordMarketplaceEvent(agency, 'directory_impression'));
        grid.hidden = results.length === 0;
        empty.hidden = results.length !== 0;
        empty.querySelector('h2').textContent = hasFilter() ? 'No matching agencies' : 'No approved agencies yet';
        empty.querySelector('p').textContent = hasFilter() ? 'Try adjusting your filters or clearing your search.' : 'Agency profiles will appear after independent review and publication.';
        document.getElementById('emptyClearFilters').hidden = !hasFilter();
        pagination.replaceChildren();
        if (pages > 1) for (let n=1;n<=pages;n++) {
            const button = document.createElement('button'); button.type='button'; button.textContent=String(n);
            button.setAttribute('aria-label',`Page ${n}`); if (n===page) button.setAttribute('aria-current','page');
            button.addEventListener('click',()=>{page=n;render();document.querySelector('.agency-directory-section')?.scrollIntoView();});
            pagination.append(button);
        }
    }
    function node(tag, className, value) { const item=document.createElement(tag); if(className)item.className=className;item.textContent=String(value ?? '');return item; }
    function card(agency) {
        const article=node('article','agency-card','');
        const top=node('div','agency-card-top','');
        const identity=node('div','agency-identity','');
        const logoBox = node('div', 'agency-monogram', '');
        window.AveraAgencyLogo.render(logoBox, agency);
        identity.append(logoBox);
        const heading=document.createElement('div');heading.append(node('h2','agency-name',agency.name),node('span','agency-location',agency.location || agency.country || 'Location not listed'));identity.append(heading);top.append(identity);
        const badges=node('div','agency-badges','');
        if(agency.demoProfile===true) badges.append(node('span','badge badge-demo','Demo OFM Profile'));
        if(agency.verificationStatus==='verified') badges.append(node('span','badge badge-verified','Verified'));
        if(agency.topRated===true) badges.append(node('span','badge badge-top-rated','Top Rated'));
        if(agency.sponsored===true) badges.append(node('span','badge badge-select','Featured / Sponsored'));
        top.append(badges);article.append(top,node('p','agency-description',agency.description || ''));
        const tags=node('div','agency-services','');list(agency.services).slice(0,3).forEach(service=>tags.append(node('span','',service)));article.append(tags);
        const meta=node('div','agency-card-meta','');
        const demoExternalStatus=agency.externalRatingStatus;
        const reputationValue=agency.demoProfile===true?(demoExternalStatus==='active'?`${Number(agency.externalRating).toFixed(1)} · ${Number(agency.externalReviewCount||0)}`:demoExternalStatus==='unavailable'?'Unavailable':'No profile found'):(reviewCount(agency) ? `${rating(agency).toFixed(1)} · ${reviewCount(agency)}` : 'No reviews');
        const reputationLabel=agency.demoProfile===true?'Simulated external rating':'Published reviews';
        for (const [value,label] of [[reputationValue,reputationLabel],[years(agency)||'—','Years in business'],[agency.size||'—','Agency size']]) {const part=document.createElement('div');part.append(node('strong','',value),node('span','',label));meta.append(part);} article.append(meta);
        if(agency.demoProfile===true) article.append(node('p','agency-demo-disclosure','Fictional OFM profile for platform demonstration. External rating data is simulated—not a live Trustpilot score. Not verified, ranked, or available for inquiries.'));
        if(agency.acceptingInquiries===true) article.append(node('p','agency-availability','Accepting inquiries'));
        const link=node('a','agency-card-link','View Agency Profile →');
        const key=String(agency.id || agency.slug || '');
        if (/^[a-zA-Z0-9_-]+$/.test(key)) link.href=`agency-profile.html?id=${encodeURIComponent(key)}`;
        else {link.removeAttribute('href');link.setAttribute('aria-disabled','true');}
        article.append(link);return article;
    }
    function closeFilters(){filters?.classList.remove('open');overlay?.classList.remove('open');document.body.classList.remove('navigation-open');document.getElementById('mobileFilterButton')?.setAttribute('aria-expanded','false');}
    function clear(){form.reset();document.getElementById('directoryFilters')?.querySelectorAll('input,select').forEach(input=>{if(input.type==='checkbox')input.checked=false;else if(input.type==='radio')input.checked=input.value==='';else input.selectedIndex=0;});fields.sortFilter.value='name';history.replaceState(null,'',location.pathname);page=1;closeFilters();render();}
    form.addEventListener('submit',event=>{event.preventDefault();page=1;render();});
    [...form.querySelectorAll('input,select'),...filters.querySelectorAll('input,select'),fields.sortFilter].forEach(input=>input?.addEventListener(input.type==='search'?'input':'change',()=>{page=1;render();}));
    document.getElementById('clearFilters')?.addEventListener('click',clear);
    document.getElementById('emptyClearFilters')?.addEventListener('click',clear);
    const mobile=document.getElementById('mobileFilterButton');mobile?.setAttribute('aria-expanded','false');
    mobile?.addEventListener('click',()=>{filters?.classList.add('open');overlay?.classList.add('open');document.body.classList.add('navigation-open');mobile.setAttribute('aria-expanded','true');});
    overlay?.addEventListener('click',closeFilters);
    document.addEventListener('keydown',event=>{if(event.key==='Escape')closeFilters();});
    try {
        const response = await fetch('/api/public-agencies', {cache:'no-store'});
        if (!response.ok) throw new Error('Agency data unavailable');
        const data = await response.json();
        if (!Array.isArray(data)) throw new Error('Invalid agency data');
        agencies = data.filter(a => a && a.status === 'approved' && a.published === true && a.demoProfile !== true && /^[a-z0-9_-]{1,80}$/i.test(String(a.slug || '')))
            .map(a => ({...a,id:a.slug,verificationStatus:a.verified === true ? 'verified' : 'unverified',
                description:a.about || a.positioning || '',reviews:a.reviewCount,location:a.location || a.country}));
    } catch (error) {
        console.error('Could not load public agencies:', error);
        empty.querySelector('h2').textContent = 'Directory unavailable';
        empty.querySelector('p').textContent = 'We could not load approved agency information. Please try again later.';
        grid.hidden = true;empty.hidden = false;return;
    }
    // Build choices from the same published records being filtered, including custom services
    // and historical size ranges. Do not guess how an old headcount range maps to a new one.
    for (const [id, field, queryKey, label] of [
        ['locationFilter','location','location','Worldwide'],
        ['categoryFilter','category','category','All categories'],
        ['serviceFilter','services','service','All services'],
        ['nicheFilter','niches','niche','All niches'],
    ]) {
        const select = fields[id];
        const choices = filterData.options(agencies, field);
        select.replaceChildren(new Option(label, ''), ...choices.map(choice => new Option(choice.label, choice.value)));
        const requested = params.get(queryKey);
        const matching = choices.find(choice => filterData.matches({[field]: [requested]}, field, choice.value));
        // Location uses separate country/region fields in the helper.
        const selected = field === 'location' ? choices.find(choice => choice.value === filterData.normalize(requested)) : matching;
        if (selected) select.value = selected.value;
    }
    const sizes = document.getElementById('agencySizeChoices');
    sizes.replaceChildren();
    for (const choice of [{ value: '', label: 'All sizes' }, ...filterData.options(agencies, 'size')]) {
        const label = document.createElement('label');
        const input = document.createElement('input');
        input.type = 'radio'; input.name = 'agencySize'; input.value = choice.value; input.checked = choice.value === '';
        input.defaultChecked = input.checked;
        input.addEventListener('change', () => { page = 1; render(); });
        label.append(input, node('span', '', choice.label)); sizes.append(label);
    }
    render();
});
