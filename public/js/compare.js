document.addEventListener('DOMContentLoaded', async () => {
  const search = document.getElementById('compareSearch');
  const results = document.getElementById('compareResults');
  const status = document.getElementById('compareStatus');
  const board = document.getElementById('compareBoard');
  const selectedCount = document.getElementById('selectedCount');
  const share = document.getElementById('shareComparison');
  const clear = document.getElementById('clearComparison');
  document.getElementById('compareYear').textContent = new Date().getFullYear();

  let agencies = [];
  let selected = [];
  const format = value => value === null || value === undefined || value === '' ? 'Not provided' : String(value);
  const list = value => Array.isArray(value) ? value.filter(item => typeof item === 'string' && item.trim()) : [];
  const safeId = id => /^[a-z0-9_-]{1,80}$/i.test(String(id || ''));
  const node = (tag, className, value) => {
    const item = document.createElement(tag);
    if (className) item.className = className;
    if (value !== undefined) item.textContent = format(value);
    return item;
  };
  const label = agency => agency.name + (agency.country ? ` Â· ${agency.country}` : '');
  const agencyKey = agency => agency.slug;

  function syncUrl() {
    const url = new URL(location.href);
    if (selected.length) url.searchParams.set('agencies', selected.join(','));
    else url.searchParams.delete('agencies');
    history.replaceState(null, '', url.pathname + url.search + url.hash);
  }
  function message(value) { status.textContent = value; }

  function renderOptions() {
    const term = search.value.trim().toLocaleLowerCase();
    const matches = agencies.filter(agency =>
      [agency.name,agency.country,agency.category].some(value => String(value || '').toLocaleLowerCase().includes(term))
    ).slice(0, 60);
    results.replaceChildren();
    for (const agency of matches) {
      const chosen = selected.includes(agencyKey(agency));
      const button = node('button', 'compare-option');
      const logo = node('span', 'compare-agency-logo');
      window.AveraAgencyLogo.render(logo, agency);
      button.append(logo, node('span', 'compare-option-name', label(agency)));
      button.type = 'button';
      button.disabled = chosen || selected.length === 3;
      button.setAttribute('aria-label', chosen ? `${agency.name} already selected` : `Add ${agency.name} to comparison`);
      button.addEventListener('click', () => {
        if (selected.length >= 3 || selected.includes(agencyKey(agency))) return;
        selected.push(agencyKey(agency));syncUrl();render();
      });
      if (chosen) button.append(node('span','compare-option-chosen','Selected'));
      results.append(button);
    }
    if (!matches.length && agencies.length) results.append(node('p','compare-no-match','No matching approved agencies.'));
  }

  function formatRating(agency) {
    const count = Number(agency.reviewCount);
    const rating = Number(agency.rating);
    return Number.isInteger(count) && count > 0 && rating >= 1 && rating <= 5
      ? `${rating.toFixed(1)} / 5 (${count} published ${count === 1 ? 'review' : 'reviews'})`
      : 'No published reviews';
  }
  function cell(value) {
    const td = node('td','',value);
    return td;
  }
  function renderBoard() {
    board.replaceChildren();
    const chosen = selected.map(id => agencies.find(agency => agencyKey(agency) === id)).filter(Boolean);
    if (!chosen.length) {
      board.append(node('p','compare-placeholder',agencies.length ? 'Select two or three agencies to compare them side by side.' : 'Comparison will be available when approved agencies are published.'));
      return;
    }
    if (chosen.length < 2) board.append(node('p','compare-hint','Select one more agency to see a side-by-side comparison.'));
    const scroll = node('div','compare-scroll');
    scroll.tabIndex = 0;
    scroll.setAttribute('aria-label','Comparison table; scroll horizontally on small screens');
    const table = node('table','compare-table');
    const caption = node('caption','visually-hidden','Published agency information comparison');
    table.append(caption);
    const thead = document.createElement('thead');
    const heading = document.createElement('tr');
    heading.append(node('th','compare-field','Information'));
    for (const agency of chosen) {
      const th = document.createElement('th');th.scope='col';
      const logo = node('div', 'compare-agency-logo compare-heading-logo');
      window.AveraAgencyLogo.render(logo, agency);
      th.append(logo, node('strong','',agency.name));
      const remove = node('button','compare-remove','Remove');remove.type='button';
      remove.setAttribute('aria-label',`Remove ${agency.name}`);
      remove.addEventListener('click',()=>{selected=selected.filter(id=>id!==agencyKey(agency));syncUrl();render();});
      th.append(remove);heading.append(th);
    }
    thead.append(heading);table.append(thead);
    const tbody = document.createElement('tbody');
    const rows = [
      ['Location',a=>a.location || a.country],
      ['Category',a=>a.category],
      ['Positioning',a=>a.positioning],
      ['Verification',a=>a.verified === true ? 'Verified after independent review' : 'Not verified'],
      ['Featured / Sponsored',a=>a.sponsored === true ? 'Paid placement disclosed' : 'No paid placement displayed'],
      ['Services',a=>list(a.services).join(', ')],
      ['Creator niches',a=>list(a.niches).join(', ')],
      ['Countries / regions served',a=>list(a.countriesServed).join(', ')],
      ['Agency size',a=>a.size],
      ['Years in business',a=>Number.isFinite(Number(a.yearsInBusiness)) && Number(a.yearsInBusiness) >= 0 && a.yearsInBusiness !== null && a.yearsInBusiness !== '' ? `${a.yearsInBusiness} years` : 'Not provided'],
      ['Published reviews',formatRating],
      ['Accepting inquiries',a=>a.acceptingInquiries === true ? 'Yes' : a.acceptingInquiries === false ? 'No' : 'Not provided'],
      ['Website',a=>a.website ? 'Available on profile' : 'Not provided']
    ];
    for (const [field,getValue] of rows) {
      const tr=document.createElement('tr');const th=node('th','',field);th.scope='row';tr.append(th);
      for(const agency of chosen) tr.append(cell(getValue(agency)));
      tbody.append(tr);
    }
    const tr = document.createElement('tr');const th=node('th','','Profile');th.scope='row';tr.append(th);
    for(const agency of chosen) {
      const td=document.createElement('td');const anchor=node('a','','View agency profile ↗');
      anchor.href=`agency-profile.html?id=${encodeURIComponent(agency.slug)}`;td.append(anchor);tr.append(td);
    }
    tbody.append(tr);table.append(tbody);scroll.append(table);board.append(scroll);
  }
  function render(){renderOptions();renderBoard();selectedCount.textContent=`${selected.length} of 3 selected`;share.disabled=!selected.length;clear.disabled=!selected.length;}
  search.addEventListener('input', renderOptions);
  clear.addEventListener('click',()=>{selected=[];syncUrl();render();search.focus();});
  share.addEventListener('click',async()=>{
    try { await navigator.clipboard.writeText(location.href);message('Comparison link copied.'); }
    catch { message('Copy the address from your browser to share this comparison.'); }
  });
  window.addEventListener('popstate',()=>{selected=new URL(location.href).searchParams.get('agencies')?.split(',').filter(id=>agencies.some(a=>a.slug===id)).slice(0,3) || [];render();});
  try {
    const response=await fetch('/api/public-agencies',{cache:'no-store'});
    if(!response.ok) throw new Error('Agency directory unavailable');
    const data=await response.json();
    if(!Array.isArray(data)) throw new Error('Invalid agency data');
    const unique=new Set();
    agencies=data.filter(a=>a && a.status==='approved' && a.published===true && safeId(a.slug) && typeof a.name==='string' && a.name.trim() && !unique.has(a.slug) && unique.add(a.slug));
    agencies.sort((a,b)=>a.name.localeCompare(b.name));
    const ids=(new URL(location.href).searchParams.get('agencies') || '').split(',');
    selected=[...new Set(ids)].filter(id=>agencies.some(a=>a.slug===id)).slice(0,3);
    if(selected.join(',') !== ids.filter(Boolean).join(',')) syncUrl();
    message(agencies.length ? `${agencies.length} approved ${agencies.length===1?'agency':'agencies'} available to compare.` : 'No approved agencies yet. Comparison will open when agency profiles pass review and are published.');
    render();
  } catch {
    message('Could not load approved agencies. Please refresh and try again.');
    render();
  }
});
