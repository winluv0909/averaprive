/* Avera Privé: replace the empty array with reviewed, published backend records. */
let approvedAgencyProfiles = [];
document.addEventListener('DOMContentLoaded', async () => {
 const byId = id => document.getElementById(id);
 const str = x => String(x ?? '').trim();
 const set = (id,x) => { if(byId(id)) byId(id).textContent = str(x); };
 const array = x => Array.isArray(x) ? x : [];
 const url = x => { try { const parsed = new URL(x); return ['https:','http:'].includes(parsed.protocol) ? parsed.href : ''; } catch { return ''; } };
 const add = (parent, tag, cls, text) => { const el=document.createElement(tag);el.className=cls;el.textContent=str(text);parent.append(el);return el; };
 const notice = (id,msg) => add(byId(id),'p','profile-no-data',msg);
 const marketplaceSession = () => { try { let value=sessionStorage.getItem('ap_marketplace_session');if(!value){value=crypto.randomUUID().replaceAll('-','_');sessionStorage.setItem('ap_marketplace_session',value);}return value; } catch { return crypto.randomUUID().replaceAll('-','_'); } };
 const eventSource = agency => agency?.sponsored===true?'sponsored':'organic';
 const recordEvent = (agency,eventType) => { if(!agency?.agencyId || agency.demoProfile===true || !window.apPrivacy?.analyticsAllowed())return;fetch('/api/marketplace/event',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agencyId:agency.agencyId,eventType,sessionId:marketplaceSession(),page:location.pathname,source:eventSource(agency),analyticsConsent:true})}).catch(()=>{}); };
 try {
  const response = await fetch('/api/public-agencies', {cache:'no-store'});
  if (!response.ok) throw new Error('Agency data unavailable');
  const data = await response.json();
  if (!Array.isArray(data)) throw new Error('Invalid agency data');
  approvedAgencyProfiles = data.filter(x => x && x.status === 'approved' && x.published === true && /^[a-z0-9_-]{1,80}$/i.test(String(x.slug || '')))
   .map(x => ({...x,id:x.slug,verificationStatus:x.verified === true ? 'verified' : 'unverified',
    positioningStatement:x.positioning || x.positioningStatement, reviews:Array.isArray(x.reviews) ? x.reviews : [],
    countries:Array.isArray(x.countriesServed) ? x.countriesServed : [], socials:x.socials || x.social_links || {}, socialLinks:x.socials || x.social_links || {}}));
 } catch (error) {
  console.error('Could not load public agency profile:', error);
  return;
 }
 const key=(new URLSearchParams(location.search).get('id') || (location.pathname.startsWith('/agencies/') ? decodeURIComponent(location.pathname.split('/')[2] || '') : ''));
 const agency=approvedAgencyProfiles.find(x => (str(x.id)===key || str(x.slug)===key) && x.status==='approved' && x.published===true);
 if(!agency)return;
 recordEvent(agency,'profile_view');
 byId('profileUnavailable').hidden=true;byId('profilePublished').hidden=false;
 const claimButton=byId('claimAgencyButton');if(claimButton){claimButton.href='/agency/claim/'+encodeURIComponent(agency.slug);claimButton.hidden=agency.demoProfile===true;}
 document.title=str(agency.name)+' | Avera Privé';
 if(!document.querySelector('link[rel="canonical"]')){const canonical=document.createElement('link');canonical.rel='canonical';canonical.href=new URL('/agencies/'+encodeURIComponent(agency.slug),location.origin).href;document.head.append(canonical);}
 set('agencyName',agency.name);set('breadcrumbAgencyName',agency.name);
 set('agencyTagline',agency.positioningStatement || agency.tagline || 'Positioning statement not provided.');
 set('agencyLocation',agency.location || agency.country || 'Location not provided');
 set('agencyExperience',agency.yearsInBusiness ? agency.yearsInBusiness+' years in business' : 'Experience not provided');
 set('agencySize',agency.size || 'Size not provided');
 set('agencyDescription',agency.about || agency.description || 'About information has not been published.');
 const details=agency.directoryInformation || agency.directory_information || {};
 const info=byId('directoryInformation');
 const value=x=>Array.isArray(x)?x.join(', '):str(x);
 if(info){
  const fields=[['Legal entity',details.legal_name],['Company registration / tax identifier',details.registration_number],['Registered address (not headquarters)',details.registered_address],['Public email',details.public_email],['Email purpose',details.email_purpose],['Public phone',details.public_phone],['Other contact',details.contact_channel],['Year established',details.founded_year],['Team size',details.team_size],['Languages',details.languages],['Markets served',details.markets_served],['Operating locations',details.operating_locations],['Research notes',details.note],['Last researched',details.checked_on]];
  for(const [label,datum] of fields){add(info,'dt','',label);add(info,'dd','',value(datum)||'Not yet confirmed');}
  const sources = byId('directorySources');
  if (sources) {
    sources.replaceChildren();
    const seen = new Set();
    for (const target of [...array(details.sources), details.owner_reviewed_source].filter(Boolean)) {
      const safe = url(target);
      if (!safe) continue;
      const parsed = new URL(safe);
      parsed.hash = '';
      if (seen.has(parsed.href)) continue;
      seen.add(parsed.href);
      const path = parsed.pathname.replace(/\/+$/, '') || '/';
      let label = 'Source page: ' + path;
      if (path === '/') label = 'Agency website';
      else if (/contact/i.test(path)) label = 'Contact information';
      else if (/about/i.test(path)) label = 'About the agency';
      else if (/services/i.test(path)) label = 'Services';
      else if (/privacy/i.test(path)) label = 'Privacy policy';
      const link = add(sources, 'a', '', label + ' · ' + parsed.hostname);
      link.href = safe;
      link.target = '_blank';
      link.rel = 'noopener noreferrer';
      link.title = safe;
    }
  }
 }
 set('sidebarHeadquarters',agency.location || agency.country || 'Not provided');set('sidebarSize',agency.size || 'Not provided');set('sidebarYears',agency.yearsInBusiness ?? 'Not provided');
 const cover=url(agency.coverImageUrl);if(cover){byId('profileCover').style.backgroundImage='url("'+cover.replace(/"/g,'%22')+'")';byId('profileCover').setAttribute('aria-label','Cover image for '+str(agency.name));}
 window.AveraAgencyLogo.render(byId('agencyLogo'), agency);
 const verified=agency.verificationStatus==='verified';byId('verificationBadge').hidden=!verified;
 const demo=agency.demoProfile===true;byId('profileDemoNotice').hidden=!demo;byId('profileDemoLabel').hidden=!demo;
 set('verificationDescription',demo?'Demonstration profiles cannot receive Avera Privé verification.':verified?'Business identity and authorized representative reviewed.':'This agency is not currently verified.');
 byId('topRatedBadge').hidden=agency.topRated!==true;
 const sponsored=agency.sponsored===true;byId('sponsoredBadge').hidden=!sponsored;byId('placementDisclosure').hidden=!sponsored;
 const website=demo?'':url(agency.website);if(website){byId('agencyWebsite').href=website;byId('agencyWebsite').hidden=false;byId('agencyWebsite').addEventListener('click',()=>recordEvent(agency,'website_click'));}
 const contact=!demo && agency.acceptingInquiries===true;byId('contactAgencyButton').hidden=!contact;
 set('contactAvailability',demo?'Demonstration only — inquiries disabled':contact?'Accepting inquiries':'Inquiry availability not confirmed');
 const services=byId('servicesGrid');if(!array(agency.services).length)notice('servicesGrid','No services published.');
 array(agency.services).forEach(service=>{const card=add(services,'article','service-card','');add(card,'h3','',typeof service==='string'?service:service.name);if(service?.description)add(card,'p','',service.description);});
 function tags(id,items,empty){if(!array(items).length)notice(id,empty);else array(items).forEach(item=>add(byId(id),'span','',item));}
 tags('expertiseTags',agency.niches || agency.expertise,'No creator niches published.');
 const regions=agency.countriesServed || agency.countries;if(!array(regions).length)notice('locationList','No additional regions published.');else array(regions).forEach(item=>add(byId('locationList'),'div','',item));
 function entries(id,items,empty,kind){const published=array(items).filter(x=>x?.status==='published' && (kind!=='result' || (x.metric && x.timeframe && x.evidenceStatus==='reviewed')));if(!published.length)return notice(id,empty);
 published.forEach(item=>{const card=add(byId(id),'article','profile-entry-card','');if(kind==='portfolio' && url(item.imageUrl)){const img=document.createElement('img');img.src=url(item.imageUrl);img.alt=str(item.imageAlt || item.title);img.loading='lazy';card.append(img);}add(card,'h3','',item.title);add(card,'p','',item.summary || item.description);if(kind==='result'){add(card,'strong','',item.metric);add(card,'small','', 'Timeframe: '+item.timeframe+' · Evidence reviewed');}});}
 entries('portfolioGrid',agency.portfolio,'No portfolio work published.','portfolio');entries('caseStudyGrid',agency.caseStudies,'No case studies published.','case');entries('resultsGrid',agency.results,'No substantiated results published.','result');
 set('reviewSummary','Loading published reviews…');
 async function loadPublicReviews(){
   try{
     const response=await fetch('/api/public-agency-reviews?slug='+encodeURIComponent(agency.slug || agency.id),{cache:'no-store',signal:AbortSignal.timeout(10000)});
     if(!response.ok)throw new Error('Reviews unavailable');
     const result=await response.json();
     if(!Array.isArray(result.reviews) || !Number.isInteger(result.totalReviews) || result.totalReviews<0)throw new Error('Invalid review response');
     const reviews=result.reviews.filter(item=>item?.status==='published' && Number(item.rating)>=1 && Number(item.rating)<=5);
     byId('reviewsGrid').replaceChildren();
     set('reviewSummary',result.totalReviews===0?'No published reviews yet.':result.totalReviews>reviews.length?'Showing the latest '+reviews.length+' of '+result.totalReviews+' published reviews.':result.totalReviews+' published review'+(result.totalReviews===1?'':'s'));
     reviews.forEach(review=>{
       const card=add(byId('reviewsGrid'),'article','profile-entry-card','');
       add(card,'strong','',Number(review.rating).toFixed(1)+' / 5');
       add(card,'p','',review.text);
       if(review.responseStatus==='published' && review.agencyResponse)add(card,'p','','Agency response: '+review.agencyResponse);
     });
   }catch{
     set('reviewSummary','Published reviews are temporarily unavailable. Refresh this page to try again.');
   }
 }
 const socials=byId('profileSocials');for(const [label,target] of Object.entries(agency.socials || {})){const safe=url(target);if(!safe)continue;const link=add(socials,'a','',label);link.href=safe;link.target='_blank';link.rel='noopener noreferrer';}if(!socials.children.length)notice('profileSocials','No social links published.');
 const related=approvedAgencyProfiles.filter(x=>x!==agency && x.status==='approved' && x.published===true && x.category===agency.category).slice(0,3);if(!related.length)notice('relatedAgencyGrid','No related agencies published yet.');
 related.forEach(item=>{const card=add(byId('relatedAgencyGrid'),'article','related-agency-card','');add(card,'h3','',item.name);add(card,'p','',item.positioningStatement || item.location || '');const link=add(card,'a','','View profile →');link.href='/agencies/'+encodeURIComponent(item.slug || item.id);});
 const reportLink=byId('reportProfileButton');
 const reportUrl=new URL('/agency-profile.html',location.href);
 reportUrl.searchParams.set('id',agency.slug || agency.id);
 reportLink.href='mailto:averaprivemain@gmail.com?subject='+encodeURIComponent('Agency profile concern: '+agency.name)+'&body='+encodeURIComponent('Agency: '+agency.name+'\nProfile: '+reportUrl.href+'\n\nConcern:\n\nSupporting information:\n');
 const modal=byId('contactModal'),opener=byId('contactAgencyButton');
 const dialog=modal.querySelector('[role="dialog"]');
 let backgroundState=[];
 modal.hidden=true;
 dialog.tabIndex=-1;
 function close(){
   backgroundState.forEach(([element,wasInert])=>{element.inert=wasInert;});
   backgroundState=[];
   opener.focus();
   modal.classList.remove('open');
   modal.hidden=true;
   modal.setAttribute('aria-hidden','true');
   document.body.classList.remove('profile-modal-open');
 }
 opener.addEventListener('click',()=>{
   if(modal.classList.contains('open'))return;
   recordEvent(agency,'contact_open');
   backgroundState=Array.from(document.body.children)
     .filter(element=>element instanceof HTMLElement && element!==modal && !element.contains(modal) && !['SCRIPT','STYLE','LINK'].includes(element.tagName))
     .map(element=>[element,element.inert]);
   backgroundState.forEach(([element])=>{element.inert=true;});
   modal.hidden=false;
   modal.classList.add('open');
   modal.setAttribute('aria-hidden','false');
   document.body.classList.add('profile-modal-open');
   byId('contactName').focus();
 });
 byId('closeContactModal').addEventListener('click',close);
 modal.addEventListener('click',event=>{if(event.target===modal)close();});
 document.addEventListener('keydown',event=>{
   if(!modal.classList.contains('open'))return;
   if(event.key==='Escape'){event.preventDefault();event.stopPropagation();close();return;}
   if(event.key!=='Tab')return;
   const controls=Array.from(dialog.querySelectorAll('a[href],button,input,select,textarea,[tabindex]'))
     .filter(element=>!element.disabled && element.tabIndex>=0 && element.getClientRects().length);
   if(!controls.length){event.preventDefault();dialog.focus();return;}
   const first=controls[0],last=controls[controls.length-1];
   if(event.shiftKey && (document.activeElement===first || !controls.includes(document.activeElement))){event.preventDefault();last.focus();}
   else if(!event.shiftKey && (document.activeElement===last || !controls.includes(document.activeElement))){event.preventDefault();first.focus();}
 },true);
 byId('agencyContactForm').addEventListener('submit',async event=>{event.preventDefault();const form=event.currentTarget;const button=form.querySelector('button[type="submit"]');if(button.disabled)return;if(!form.checkValidity() || byId('contactMessage').value.trim().length<20){set('contactFormMessage','Complete every field, provide at least 20 characters, and accept the consent statement.');form.reportValidity();return;}button.disabled=true;button.textContent='Sending…';set('contactFormMessage','');try{const response=await fetch('/api/marketplace/inquiry',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({agencyId:agency.agencyId,sessionId:marketplaceSession(),name:byId('contactName').value,email:byId('contactEmail').value,message:byId('contactMessage').value,website:byId('contactWebsite').value,consent:byId('contactConsent').checked,source:eventSource(agency)})});const result=await response.json();if(!response.ok)throw new Error(result.error||'Inquiry could not be sent.');form.reset();set('contactFormMessage','Inquiry received securely. The agency can now review your request.');button.textContent='Inquiry sent';}catch(error){set('contactFormMessage',error.message||'Inquiry could not be sent. Please try again.');button.disabled=false;button.textContent='Send inquiry';}});
 void loadPublicReviews();
});
