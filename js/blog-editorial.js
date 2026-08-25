'use strict';

(function () {
  const $ = (id) => document.getElementById(id);
  let allPosts = [];
  let activeCategory = '';
  let searchTerm = '';

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

  function postSearchText(post) {
    return [
      post.title, post.titleTh, post.excerpt, post.excerptTh, post.category
    ].filter(Boolean).join(' ').toLocaleLowerCase();
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

  function curatedSections() {
    return Array.from(document.querySelectorAll('.blog-editorial__section:not(.blog-discovery-results)'));
  }

  function setupDiscovery(posts) {
    const masthead = document.querySelector('.blog-editorial__masthead');
    if (!masthead || $('blog-discovery')) return;

    const categories = [...new Set(posts.map(category))].sort((a, b) => a.localeCompare(b));
    const shell = document.createElement('section');
    shell.className = 'blog-discovery';
    shell.id = 'blog-discovery';
    shell.setAttribute('aria-label', 'Search and filter articles');
    shell.innerHTML = `<div class="container">
      <div class="blog-discovery__bar">
        <label class="blog-discovery__search" for="blog-search">
          <i class="fas fa-magnifying-glass" aria-hidden="true"></i>
          <span class="sr-only" data-en="Search articles" data-th="ค้นหาบทความ">Search articles</span>
          <input id="blog-search" type="search" autocomplete="off" placeholder="Search articles" aria-label="Search articles">
        </label>
        <button class="blog-discovery__filter-btn" id="blog-filter-toggle" type="button" aria-expanded="false" aria-controls="blog-filter-panel">
          <span data-en="Filter" data-th="ตัวกรอง">Filter</span>
          <i class="fas fa-sliders" aria-hidden="true"></i>
        </button>
      </div>
      <div class="blog-discovery__panel" id="blog-filter-panel" hidden>
        <div class="blog-discovery__panel-head">
          <strong data-en="Filter by category" data-th="กรองตามหมวดหมู่">Filter by category</strong>
          <button type="button" class="blog-discovery__reset" id="blog-filter-reset" data-en="Reset" data-th="รีเซ็ต">Reset</button>
        </div>
        <div class="blog-discovery__chips" id="blog-filter-chips" role="group" aria-label="Article categories">
          <button type="button" class="blog-discovery__chip active" data-category="" data-en="All" data-th="ทั้งหมด">All</button>
          ${categories.map(cat => `<button type="button" class="blog-discovery__chip" data-category="${LitalkBlog.escapeHtml(cat)}">${LitalkBlog.escapeHtml(cat)}</button>`).join('')}
        </div>
      </div>
    </div>`;
    masthead.insertAdjacentElement('afterend', shell);

    const results = document.createElement('section');
    results.className = 'blog-editorial__section blog-discovery-results';
    results.id = 'blog-discovery-results';
    results.hidden = true;
    results.innerHTML = `<div class="container">
      <div class="blog-editorial__section-head">
        <div>
          <h2 class="blog-editorial__section-title" data-en="Articles" data-th="บทความ">Articles</h2>
          <p class="blog-editorial__section-sub" id="blog-results-summary" aria-live="polite"></p>
        </div>
      </div>
      <div class="blog-discovery-results__list" id="blog-results-list"></div>
    </div>`;
    shell.insertAdjacentElement('afterend', results);

    const search = $('blog-search');
    const toggle = $('blog-filter-toggle');
    const panel = $('blog-filter-panel');
    const reset = $('blog-filter-reset');

    toggle.addEventListener('click', () => {
      const opening = panel.hidden;
      panel.hidden = !opening;
      toggle.setAttribute('aria-expanded', String(opening));
    });

    $('blog-filter-chips').addEventListener('click', (event) => {
      const chip = event.target.closest('.blog-discovery__chip');
      if (!chip) return;
      activeCategory = chip.dataset.category || '';
      document.querySelectorAll('.blog-discovery__chip').forEach(el => el.classList.toggle('active', el === chip));
      applyDiscovery();
    });

    search.addEventListener('input', () => {
      searchTerm = search.value.trim().toLocaleLowerCase();
      applyDiscovery();
    });

    reset.addEventListener('click', () => {
      search.value = '';
      searchTerm = '';
      activeCategory = '';
      document.querySelectorAll('.blog-discovery__chip').forEach((el, index) => el.classList.toggle('active', index === 0));
      applyDiscovery();
    });

    document.addEventListener('litalk:langchange', () => {
      search.placeholder = LitalkBlog.lang() === 'th' ? 'ค้นหาบทความ' : 'Search articles';
      applyDiscovery();
    });
  }

  function applyDiscovery() {
    const resultsSection = $('blog-discovery-results');
    if (!resultsSection) return;

    const filtering = Boolean(searchTerm || activeCategory);
    curatedSections().forEach(section => { section.hidden = filtering; });
    resultsSection.hidden = !filtering;
    if (!filtering) return;

    const filtered = allPosts.filter(post => {
      const categoryMatch = !activeCategory || category(post) === activeCategory;
      const searchMatch = !searchTerm || postSearchText(post).includes(searchTerm);
      return categoryMatch && searchMatch;
    });

    const isTh = LitalkBlog.lang() === 'th';
    $('blog-results-summary').textContent = isTh
      ? `พบ ${filtered.length} บทความ${activeCategory ? ` ในหมวด ${activeCategory}` : ''}`
      : `${filtered.length} ${filtered.length === 1 ? 'article' : 'articles'}${activeCategory ? ` in ${activeCategory}` : ''}`;
    $('blog-results-list').innerHTML = filtered.length
      ? filtered.map(post => listHtml(post, 'more')).join('')
      : emptyHtml('No articles match your search.', 'ไม่พบบทความที่ตรงกับการค้นหา');
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
      allPosts = await LitalkBlog.fetchPosts();
      render(allPosts);
      setupDiscovery(allPosts);
    } catch (err) {
      console.warn('blog editorial: failed to load posts', err);
      $('blog-featured').innerHTML = emptyHtml('Could not load articles right now — please try again later.', 'ไม่สามารถโหลดบทความได้ในขณะนี้ กรุณาลองใหม่ภายหลัง');
      ['blog-latest', 'blog-latest-grid', 'blog-explore-grid', 'blog-newsroom-list', 'blog-more-list'].forEach(id => { $(id).innerHTML = ''; });
    }
  });
})();
