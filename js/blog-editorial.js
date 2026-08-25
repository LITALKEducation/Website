'use strict';

(function () {
  const $ = (id) => document.getElementById(id);

  function href(post) {
    return `blog-post?slug=${encodeURIComponent(post.slug)}`;
  }

  function category(post) {
    return post.category || 'Article';
  }

  function categoryKey(post) {
    return category(post).trim().toLowerCase();
  }

  function isNewsroom(post) {
    const key = categoryKey(post);
    return key === 'newsroom' || key === 'news' || key === 'announcement' || key === 'update' || key === 'company';
  }

  function isExplore(post) {
    const key = categoryKey(post);
    return [
      'grammar', 'vocabulary', 'pronunciation', 'communication', 'culture',
      'linguistics', 'english', 'english language', 'learning tips'
    ].includes(key);
  }

  function mediaHtml(post, className, eager) {
    const cover = LitalkBlog.coverUrl(post);
    const titleEn = post.title || post.titleTh || '';
    if (!cover) {
      return `<div class="${className} ${className}--placeholder" aria-hidden="true">LITALK</div>`;
    }
    if (LitalkBlog.isVideoCover(post)) {
      return `<div class="${className}"><video src="${cover}" autoplay muted loop playsinline disablepictureinpicture aria-label="${LitalkBlog.escapeHtml(titleEn)}"></video></div>`;
    }
    return `<div class="${className}"><img src="${cover}" alt="${LitalkBlog.escapeHtml(titleEn)}" ${eager ? 'fetchpriority="high"' : 'loading="lazy"'} width="960" height="540"></div>`;
  }

  function dateHtml(post, className) {
    return `<span class="${className}" data-post-date="${LitalkBlog.escapeHtml(post.publishedAt || '')}">${LitalkBlog.fmtDate(post.publishedAt)}</span>`;
  }

  function featuredHtml(post) {
    const title = LitalkBlog.pick(post, 'title');
    const titleEn = post.title || post.titleTh || '';
    const titleTh = post.titleTh || post.title || '';
    const excerpt = LitalkBlog.pick(post, 'excerpt');
    const excerptEn = post.excerpt || post.excerptTh || '';
    const excerptTh = post.excerptTh || post.excerpt || '';
    return `<article class="blog-featured">
      <a href="${href(post)}" aria-label="${LitalkBlog.escapeHtml(title)}">${mediaHtml(post, 'blog-featured__media', true)}</a>
      <div class="blog-featured__content">
        <span class="blog-editorial__category">${LitalkBlog.escapeHtml(category(post))}</span>
        <h2 class="blog-featured__title"><a href="${href(post)}" data-en="${LitalkBlog.escapeHtml(titleEn)}" data-th="${LitalkBlog.escapeHtml(titleTh)}">${LitalkBlog.escapeHtml(title)}</a></h2>
        ${excerpt ? `<p class="blog-featured__excerpt" data-en="${LitalkBlog.escapeHtml(excerptEn)}" data-th="${LitalkBlog.escapeHtml(excerptTh)}">${LitalkBlog.escapeHtml(excerpt)}</p>` : ''}
        ${dateHtml(post, 'blog-editorial__date')}
      </div>
    </article>`;
  }

  function latestHtml(post) {
    const title = LitalkBlog.pick(post, 'title');
    const titleEn = post.title || post.titleTh || '';
    const titleTh = post.titleTh || post.title || '';
    return `<a class="blog-latest-item" href="${href(post)}">
      <span class="blog-latest-item__category">${LitalkBlog.escapeHtml(category(post))}</span>
      <span class="blog-latest-item__title" data-en="${LitalkBlog.escapeHtml(titleEn)}" data-th="${LitalkBlog.escapeHtml(titleTh)}">${LitalkBlog.escapeHtml(title)}</span>
      ${dateHtml(post, 'blog-editorial__date')}
    </a>`;
  }

  function tileHtml(post) {
    const title = LitalkBlog.pick(post, 'title');
    const titleEn = post.title || post.titleTh || '';
    const titleTh = post.titleTh || post.title || '';
    const excerpt = LitalkBlog.pick(post, 'excerpt');
    const excerptEn = post.excerpt || post.excerptTh || '';
    const excerptTh = post.excerptTh || post.excerpt || '';
    return `<article class="blog-tile">
      <a href="${href(post)}" aria-label="${LitalkBlog.escapeHtml(title)}">${mediaHtml(post, 'blog-tile__media', false)}</a>
      <div class="blog-tile__body">
        <span class="blog-editorial__category">${LitalkBlog.escapeHtml(category(post))}</span>
        <h3 class="blog-tile__title"><a href="${href(post)}" data-en="${LitalkBlog.escapeHtml(titleEn)}" data-th="${LitalkBlog.escapeHtml(titleTh)}">${LitalkBlog.escapeHtml(title)}</a></h3>
        ${excerpt ? `<p class="blog-tile__excerpt" data-en="${LitalkBlog.escapeHtml(excerptEn)}" data-th="${LitalkBlog.escapeHtml(excerptTh)}">${LitalkBlog.escapeHtml(excerpt)}</p>` : ''}
        ${dateHtml(post, 'blog-editorial__date')}
      </div>
    </article>`;
  }

  function listHtml(post, kind) {
    const title = LitalkBlog.pick(post, 'title');
    const titleEn = post.title || post.titleTh || '';
    const titleTh = post.titleTh || post.title || '';
    return `<a class="blog-${kind}-item" href="${href(post)}">
      <span class="blog-${kind}-item__type">${LitalkBlog.escapeHtml(category(post))}</span>
      <span class="blog-${kind}-item__title" data-en="${LitalkBlog.escapeHtml(titleEn)}" data-th="${LitalkBlog.escapeHtml(titleTh)}">${LitalkBlog.escapeHtml(title)}</span>
      ${dateHtml(post, `blog-${kind}-item__date`)}
    </a>`;
  }

  function emptyHtml(en, th) {
    return `<p class="blog-editorial__empty" data-en="${LitalkBlog.escapeHtml(en)}" data-th="${LitalkBlog.escapeHtml(th)}">${LitalkBlog.lang() === 'th' ? LitalkBlog.escapeHtml(th) : LitalkBlog.escapeHtml(en)}</p>`;
  }

  function render(posts) {
    if (!posts.length) {
      $('blog-featured').innerHTML = emptyHtml('No articles published yet — check back soon.', 'ยังไม่มีบทความเผยแพร่ — กลับมาดูใหม่เร็ว ๆ นี้');
      $('blog-latest').innerHTML = '';
      $('blog-latest-grid').innerHTML = '';
      $('blog-explore-grid').innerHTML = '';
      $('blog-newsroom-list').innerHTML = '';
      $('blog-more-list').innerHTML = '';
      return;
    }

    const featured = posts[0];
    const remaining = posts.slice(1);
    const latestSide = remaining.slice(0, 3);
    const latestGrid = remaining.slice(3, 6);

    const newsroom = posts.filter(isNewsroom).slice(0, 4);
    const explorePool = posts.filter(p => !isNewsroom(p) && isExplore(p));
    const explore = (explorePool.length ? explorePool : posts.filter(p => !isNewsroom(p))).filter(p => p !== featured).slice(0, 3);

    const used = new Set([featured, ...latestSide, ...latestGrid, ...explore, ...newsroom]);
    const more = posts.filter(p => !used.has(p)).slice(0, 8);

    $('blog-featured').innerHTML = featuredHtml(featured);
    $('blog-latest').innerHTML = latestSide.map(latestHtml).join('');
    $('blog-latest-grid').innerHTML = latestGrid.length
      ? latestGrid.map(tileHtml).join('')
      : emptyHtml('More stories are on the way.', 'เรื่องราวเพิ่มเติมกำลังจะมาเร็ว ๆ นี้');
    $('blog-explore-grid').innerHTML = explore.length
      ? explore.map(tileHtml).join('')
      : emptyHtml('English language stories are on the way.', 'บทความสำรวจภาษาอังกฤษกำลังจะมาเร็ว ๆ นี้');
    $('blog-newsroom-list').innerHTML = newsroom.length
      ? newsroom.map(p => listHtml(p, 'newsroom')).join('')
      : emptyHtml('News and announcements from LITALK will appear here.', 'ข่าวและประกาศจาก LITALK จะแสดงที่นี่');
    $('blog-more-list').innerHTML = more.length
      ? more.map(p => listHtml(p, 'more')).join('')
      : emptyHtml('You are all caught up.', 'คุณอ่านบทความล่าสุดครบแล้ว');
  }

  document.addEventListener('DOMContentLoaded', async () => {
    if (!$('blog-featured')) return;
    try {
      const posts = await LitalkBlog.fetchPosts();
      render(posts);
    } catch (err) {
      console.warn('blog editorial: failed to load posts', err);
      $('blog-featured').innerHTML = emptyHtml('Could not load articles right now — please try again later.', 'ไม่สามารถโหลดบทความได้ในขณะนี้ กรุณาลองใหม่ภายหลัง');
      ['blog-latest', 'blog-latest-grid', 'blog-explore-grid', 'blog-newsroom-list', 'blog-more-list'].forEach(id => { $(id).innerHTML = ''; });
    }
  });
})();
