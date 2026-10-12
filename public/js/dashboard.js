document.addEventListener('DOMContentLoaded', () => {
  const $ = id => document.getElementById(id);
  const sidebar = $('dashboardSidebar');
  const overlay = $('sidebarOverlay');
  const open = $('sidebarOpen');
  function toggleSidebar(value) {
    sidebar.classList.toggle('open', value);
    overlay.classList.toggle('show', value);
    open.setAttribute('aria-expanded', String(value));
    document.body.style.overflow = value ? 'hidden' : '';
  }
  open.addEventListener('click', () => toggleSidebar(true));
  $('sidebarClose').addEventListener('click', () => toggleSidebar(false));
  overlay.addEventListener('click', () => toggleSidebar(false));
  document.addEventListener('keydown', event => {
    if (event.key === 'Escape' && sidebar.classList.contains('open')) toggleSidebar(false);
  });
  const links = [...document.querySelectorAll('.dashboard-navigation a')];
  links.forEach(link => link.addEventListener('click', () => {
    links.forEach(item => item.classList.toggle('active', item === link));
    if (window.innerWidth <= 820) toggleSidebar(false);
  }));

  const PROFILE_KEY = 'agencyPriveLocalProfileDraftV1';
  const CASE_KEY = 'agencyPriveLocalCaseDraftsV1';
  const profileFields = ['draftName','draftCountry','draftCategory','draftPositioning','draftServices','draftNiches','draftAbout'];
  function read(key, fallback) {
    try { const value = JSON.parse(localStorage.getItem(key)); return value ?? fallback; }
    catch { return fallback; }
  }
  function write(key, value, messageElement) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { messageElement.textContent = 'This browser could not save the draft. Check storage settings or available space.'; return false; }
  }
  function safeText(value) { return typeof value === 'string' ? value : ''; }
  function updateIdentity() {
    const name = $('draftName').value.trim();
    $('sidebarAgencyName').textContent = name || 'Agency workspace';
    $('sidebarInitials').textContent = name ? name.split(/\s+/).slice(0,2).map(word => word[0]).join('').toUpperCase() : 'AP';
  }
  const savedProfile = read(PROFILE_KEY, {});
  if (savedProfile && typeof savedProfile === 'object' && !Array.isArray(savedProfile)) {
    for (const id of profileFields) $(id).value = safeText(savedProfile[id]);
  }
  updateIdentity();
  $('draftName').addEventListener('input', updateIdentity);
  $('profileDraftForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const draft = Object.fromEntries(profileFields.map(id => [id, $(id).value.trim()]));
    if (write(PROFILE_KEY, draft, $('profileDraftMessage'))) {
      $('profileDraftMessage').textContent = 'Saved in this browser only. Your agency has not been submitted or published.';
      updateIdentity();
    }
  });
  $('discardProfile').addEventListener('click', () => {
    if (!window.confirm('Delete the profile draft saved in this browser?')) return;
    try { localStorage.removeItem(PROFILE_KEY); }
    catch { $('profileDraftMessage').textContent = 'Could not remove the local draft.'; return; }
    $('profileDraftForm').reset(); updateIdentity();
    $('profileDraftMessage').textContent = 'Local profile draft removed. No published profile was affected.';
  });

  let cases = read(CASE_KEY, []);
  if (!Array.isArray(cases)) cases = [];
  cases = cases.filter(item => item && typeof item === 'object' && typeof item.id === 'string' && typeof item.title === 'string' && typeof item.summary === 'string');
  function renderCases() {
    const container = $('caseStudyList');
    container.replaceChildren();
    if (!cases.length) {
      const empty = document.createElement('p');
      empty.className = 'workspace-empty';
      empty.textContent = 'No local case studies drafted yet.';
      container.append(empty); return;
    }
    for (const item of cases) {
      const card = document.createElement('article');
      card.className = 'workspace-case';
      const title = document.createElement('h3'); title.textContent = item.title;
      const service = document.createElement('small'); service.textContent = item.service || 'Service not specified';
      const summary = document.createElement('p'); summary.textContent = item.summary;
      const remove = document.createElement('button'); remove.type = 'button'; remove.textContent = 'Remove draft';
      remove.setAttribute('aria-label', `Remove local draft ${item.title}`);
      remove.addEventListener('click', () => {
        const next = cases.filter(entry => entry.id !== item.id);
        if (write(CASE_KEY, next, $('caseStudyMessage'))) {
          cases = next; renderCases(); $('caseStudyMessage').textContent = 'Local case study draft removed.';
        }
      });
      card.append(title, service, summary, remove); container.append(card);
    }
  }
  $('caseStudyForm').addEventListener('submit', event => {
    event.preventDefault();
    if (!event.currentTarget.reportValidity()) return;
    const item = {
      id: window.crypto?.randomUUID?.() || `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      title: $('caseTitleInput').value.trim(),
      service: $('caseService').value.trim(),
      summary: $('caseSummary').value.trim()
    };
    if (!item.title || !item.summary) return;
    const next = [item, ...cases].slice(0, 30);
    if (write(CASE_KEY, next, $('caseStudyMessage'))) {
      cases = next; renderCases(); event.currentTarget.reset();
      $('caseStudyMessage').textContent = 'Case study draft saved in this browser only. It has not been reviewed or published.';
    }
  });
  renderCases();
});
