/* The Privé Edit. Publish only reviewed articles in this array or a trusted CMS feed. */
let publishedArticles = [];

document.addEventListener('DOMContentLoaded', async () => {
  const categories = {
    all: ['THE PRIVÉ EDIT','No published articles yet.','Our first edition will appear after reporting, fact checking and editorial review are complete.'],
    'creator-economy': ['CREATOR ECONOMY','No Creator Economy articles yet.','Reporting on platforms, monetization and creator businesses is being prepared.'],
    agencies: ['AGENCIES','No agency articles yet.','Agency reporting will appear after sources and claims have been reviewed.'],
    business: ['BUSINESS','No Business articles yet.','Commercial analysis will include sources, context and material limitations.'],
    influence: ['INFLUENCE','No Influence articles yet.','Coverage of audiences, brands and influence is being prepared.'],
    entertainment: ['ENTERTAINMENT','No Entertainment articles yet.','Reporting on talent, media and production is being prepared.'],
    culture: ['CULTURE','No Culture articles yet.','Coverage of communities, ideas and behavior is being prepared.'],
    'adult-industry': ['ADULT INDUSTRY','No Adult Industry articles yet.','Sensitive reporting will be published only after consent, privacy and factual safeguards are applied.'],
    interviews: ['INTERVIEWS','No interviews yet.','Only real, on-record interviews will be published here.'],
    'market-insights': ['MARKET INSIGHTS','No Market Insights yet.','Analysis will be published with its sources, coverage period and limitations.']
  };
  const navigation = document.getElementById('categoryNavigation');
  const links = [...navigation.querySelectorAll('[data-category]')];
  const grid = document.getElementById('articleGrid');
  const empty = document.getElementById('articleEmptyState');
  const label = document.getElementById('emptyCategoryLabel');
  const title = document.getElementById('emptyCategoryTitle');
  const copy = document.getElementById('emptyCategoryCopy');
  const safeUrl = value => {
    try { const parsed = new URL(value, location.href); return ['http:','https:'].includes(parsed.protocol) ? parsed.href : ''; }
    catch { return ''; }
  };
  const text = (tag, className, value) => { const item=document.createElement(tag);if(className)item.className=className;item.textContent=String(value ?? '');return item; };
  try { const response=await fetch('/api/editorial',{cache:'no-store'});if(!response.ok)throw new Error('Editorial feed unavailable');const data=await response.json();if(Array.isArray(data))publishedArticles=data; } catch(error) { console.error(error); }
  function currentCategory() {
    const pathValue = location.pathname.startsWith('/insights/') ? location.pathname.split('/').filter(Boolean)[1] : '';
    const value = new URLSearchParams(location.search).get('category') || pathValue || location.hash.slice(1);
    return Object.hasOwn(categories, value) ? value : 'all';
  }
  function renderArticle(article) {
    const card=text('article','edit-article-card','');
    if(article.coverImageUrl){const image=document.createElement('img');image.src=article.coverImageUrl;image.alt=article.coverImageAlt||'';image.loading='lazy';card.append(image);}
    card.append(text('span','edit-article-category',categories[article.category]?.[0] || 'THE PRIVÉ EDIT'),text('h3','',article.title),text('p','',article.summary));
    const meta=text('small','',`${article.author} · ${article.publishedDate}`);card.append(meta);
    const href=safeUrl(article.url);if(href){const link=text('a','','Read article →');link.href=href;card.append(link);}
    return card;
  }
  function render() {
    const category=currentCategory();
    links.forEach(link=>link.setAttribute('aria-current',link.dataset.category===category?'page':'false'));
    const articles=publishedArticles.filter(article=>article && article.status==='published' && (category==='all'||article.category===category) && article.title && article.summary && article.author && article.publishedDate);
    grid.replaceChildren(...articles.map(renderArticle));
    grid.hidden=articles.length===0;empty.hidden=articles.length!==0;
    [label.textContent,title.textContent,copy.textContent]=categories[category];
  }
  navigation.addEventListener('click',event=>{
    const link=event.target.closest('[data-category]');if(!link)return;
    event.preventDefault();history.pushState(null,'',link.getAttribute('href'));render();
    document.getElementById('latest').scrollIntoView({behavior:'smooth',block:'start'});
  });
  window.addEventListener('popstate',render);
  document.getElementById('editYear').textContent=new Date().getFullYear();
  render();
});
