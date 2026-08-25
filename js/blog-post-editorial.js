'use strict';

(function(){
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const slug=params.get('slug');
  function setText(id,text){const el=$(id);if(el)el.textContent=text||'';}
  function canonicalUrl(){return `${location.origin}/blog/post?slug=${encodeURIComponent(slug||'')}`;}
  function readingMinutes(markdown){const words=String(markdown||'').trim().split(/\s+/).filter(Boolean).length;return Math.max(1,Math.round(words/210));}
  function media(post,cls){const cover=LitalkBlog.coverUrl(post);if(!cover)return '';const title=post.title||post.titleTh||'';return LitalkBlog.isVideoCover(post)?`<div class="${cls}"><video src="${cover}" autoplay muted loop playsinline disablepictureinpicture aria-label="${LitalkBlog.escapeHtml(title)}"></video></div>`:`<div class="${cls}"><img src="${cover}" alt="${LitalkBlog.escapeHtml(title)}" width="1200" height="675"></div>`;}
  function buildToc(){const content=$('post-content'),toc=$('post-toc');if(!content||!toc)return;const heads=[...content.querySelectorAll('h2')];if(!heads.length){$('post-rail').hidden=true;return;}toc.innerHTML=heads.map((h,i)=>{if(!h.id)h.id=`section-${i+1}`;return `<a href="#${h.id}">${LitalkBlog.escapeHtml(h.textContent)}</a>`;}).join('');}
  function recommendCard(post){const title=LitalkBlog.pick(post,'title');const cover=LitalkBlog.coverUrl(post);const m=cover?(LitalkBlog.isVideoCover(post)?`<video src="${cover}" muted playsinline preload="metadata"></video>`:`<img src="${cover}" alt="${LitalkBlog.escapeHtml(title)}" loading="lazy" width="480" height="300">`):'';return `<a class="post-editorial__more-card" href="post?slug=${encodeURIComponent(post.slug)}"><div class="post-editorial__more-media">${m}</div><span class="post-editorial__more-cat">${LitalkBlog.escapeHtml(post.category||'Article')}</span><h3>${LitalkBlog.escapeHtml(title)}</h3></a>`;}
  async function load(){
    if(!slug){location.replace('../articles');return;}
    try{
      const post=await LitalkBlog.fetchPost(slug);if(!post){$('post-content').innerHTML='<p>Article not found.</p>';return;}
      const title=LitalkBlog.pick(post,'title'),excerpt=LitalkBlog.pick(post,'excerpt'),body=LitalkBlog.pick(post,'content')||post.content||post.contentTh||'';
      document.title=`${title} — LITALK Education`;setText('post-title',title);setText('post-category',post.category||'Article');setText('post-excerpt',excerpt);setText('post-date',LitalkBlog.fmtDate(post.publishedAt));
      const author=post.authorName||post.author||'';setText('post-author',author);if(author)$('post-author').hidden=false;
      if(excerpt)$('post-excerpt').hidden=false;
      $('post-cover-wrap').innerHTML=media(post,'post-editorial__cover');if(!$('post-cover-wrap').innerHTML)$('post-cover-wrap').hidden=true;
      $('post-content').innerHTML=LitalkBlog.mdToHtml(body);setText('reading-time',`${readingMinutes(body)} min read`);buildToc();
      const url=canonicalUrl();const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=url;
      const copy=$('copy-link'),share=$('native-share');copy.addEventListener('click',async()=>{await navigator.clipboard.writeText(url);copy.setAttribute('aria-label','Link copied');copy.innerHTML='<i class="fas fa-check"></i>';setTimeout(()=>copy.innerHTML='<i class="fas fa-link"></i>',1500);});
      if(navigator.share){share.hidden=false;share.addEventListener('click',()=>navigator.share({title,text:excerpt,url}));}
      const posts=await LitalkBlog.fetchPosts();const more=posts.filter(p=>p.slug!==slug).slice(0,3);$('post-more-grid').innerHTML=more.map(recommendCard).join('');$('post-more').hidden=!more.length;
    }catch(err){console.warn('post: failed to load',err);$('post-content').innerHTML='<p>Could not load this article right now. Please try again later.</p>';}
  }
  document.addEventListener('DOMContentLoaded',load);
})();