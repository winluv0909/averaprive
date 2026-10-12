/* Shared agency logos: only use the image URL stored on the agency record. */
window.AveraAgencyLogo = {
  render(container, agency) {
    if (!container) return;
    const name = String(agency.name || 'Agency').trim();
    const initials = String(agency.initials || name.slice(0, 2).toUpperCase());
    const fallback = () => {
      container.classList.remove('has-official-logo');
      container.textContent = initials;
    };
    fallback();
    const value = agency.logoUrl || agency.logo_url;
    if (!value) return;
    let imageUrl;
    try {
      imageUrl = new URL(value, location.origin);
      if (!['https:', 'http:'].includes(imageUrl.protocol)) return;
    } catch { return; }
    const image = document.createElement('img');
    image.alt = name + ' logo';
    image.loading = 'lazy';
    image.decoding = 'async';
    image.addEventListener('error', fallback, { once: true });
    container.classList.add('has-official-logo');
    container.replaceChildren(image);
    image.src = imageUrl.href;
  }
};
