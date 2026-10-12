(() => {
  const section = document.getElementById('platformReviews');
  if (!section) return;

  const summary = section.querySelector('[data-review-summary]');
  const cards = section.querySelector('[data-review-cards]');
  const feedback = section.querySelector('[data-review-feedback]');
  let loading = false;

  function element(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined) node.textContent = text;
    return node;
  }

  async function refresh() {
    if (loading || document.hidden) return;
    loading = true;

    try {
      const response = await fetch('/api/platform-reviews', {
        cache: 'no-store',
      });

      if (!response.ok) throw new Error('Unavailable');

      const data = await response.json();

      summary.replaceChildren();
      cards.replaceChildren();

      feedback.hidden = data.count > 0;
      summary.hidden = data.count === 0;
      cards.hidden = data.count === 0;

      feedback.textContent =
        'No platform reviews have been published yet. Be the first to share your experience.';

      if (data.count > 0) {
        summary.append(
          element(
            'strong',
            '',
            `${Number(data.average).toFixed(1)} / 5`,
          ),
          element(
            'span',
            '',
            `${data.count} published ${
              data.count === 1 ? 'review' : 'reviews'
            }`,
          ),
        );

        data.reviews.forEach(review => {
          const article = element('article', 'pr-card');
          const header = element('header');

          const avatar = element(
            'span',
            'pr-avatar',
            review.display_name.slice(0, 1).toUpperCase(),
          );

          avatar.setAttribute('aria-hidden', 'true');

          const identity = element('div');

          identity.append(
            element('strong', '', review.display_name),
            element(
              'small',
              '',
              `${
                review.audience === 'business'
                  ? 'Business user'
                  : 'Creator / viewer'
              } · Self-described`,
            ),
          );

          header.append(avatar, identity);

          const rating = Math.max(
            1,
            Math.min(5, Number(review.rating)),
          );

          const stars = element(
            'p',
            'pr-stars',
            '★'.repeat(rating) + '☆'.repeat(5 - rating),
          );

          stars.setAttribute(
            'aria-label',
            `${rating} out of 5 stars`,
          );

          const date = element(
            'time',
            '',
            new Date(review.published_at).toLocaleDateString(
              'en-US',
              {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
                timeZone: 'UTC',
              },
            ),
          );

          date.dateTime = review.published_at;

          article.append(
            header,
            stars,
            element('h3', '', review.title),
            element('p', 'pr-body', review.body),
            date,
          );

          cards.append(article);
        });
      }
    } catch {
      // Hide outdated scores if refreshing fails.
      summary.hidden = true;
      cards.hidden = true;
      feedback.hidden = false;

      feedback.textContent =
        'Reviews are temporarily unavailable. Please try again later.';
    } finally {
      loading = false;
    }
  }

  refresh();
  window.setInterval(refresh, 60000);

  document.addEventListener('visibilitychange', () => {
    if (!document.hidden) refresh();
  });
})();