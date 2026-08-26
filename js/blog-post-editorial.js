'use strict';
(function loadUnifiedNav(){if(document.querySelector('script[data-litalk-site-nav]'))return;const s=document.createElement('script');s.src='/js/site-nav.js?v=20260826e';s.dataset.litalkSiteNav='1';document.head.appendChild(s);}());

(function(){
  const $=id=>document.getElementById(id);
  const params=new URLSearchParams(location.search);
  const slug=params.get('slug');
  let currentPost=null;
  let relatedPosts=[];
  let shareBound=false;

  function setText(id,text){const el=$(id);if(el)el.textContent=text||'';}
  function canonicalUrl(){return `${location.origin}/blog/post?slug=${encodeURIComponent(slug||'')}`;}

  function readingMinutes(markdown){
    const source=String(markdown||'').trim();
    if(!source)return 1;
    const locale=LitalkBlog.lang()==='th'?'th':'en';
    let words=0;
    if(typeof Intl!=='undefined'&&Intl.Segmenter){
      try{const segmenter=new Intl.Segmenter(locale,{granularity:'word'});words=[...segmenter.segment(source)].filter(part=>part.isWordLike).length;}catch(_err){words=0;}
    }
    if(!words){words=locale==='th'?Math.max(1,Math.round(source.replace(/\s+/g,'').length/5)):source.split(/\s+/).filter(Boolean).length;}
    return Math.max(1,Math.round(words/(locale==='th'?250:210)));
  }

  async function copyText(value){
    if(navigator.clipboard&&window.isSecureContext){try{await navigator.clipboard.writeText(value);return true;}catch(_err){}}
    const area=document.createElement('textarea');area.value=value;area.setAttribute('readonly','');area.style.position='fixed';area.style.opacity='0';document.body.appendChild(area);area.select();let ok=false;try{ok=document.execCommand('copy');}catch(_err){ok=false;}area.remove();return ok;
  }

  function media(post,cls){const cover=LitalkBlog.coverUrl(post);if(!cover)return '';const title=post.title||post.titleTh||'';return LitalkBlog.isVideoCover(post)?`<div class="${cls}"><video src="${cover}" autoplay muted loop playsinline disablepictureinpicture aria-label="${LitalkBlog.escapeHtml(title)}"></video></div>`:`<div class="${cls}"><img src="${cover}" alt="${LitalkBlog.escapeHtml(title)}" width="1200" height="675"></div>`;}

  function buildToc(){const content=$('post-content'),toc=$('post-toc'),rail=$('post-rail');if(!content||!toc)return;const heads=[...content.querySelectorAll('h2')];if(!heads.length){if(rail)rail.hidden=true;toc.innerHTML='';return;}if(rail)rail.hidden=false;toc.innerHTML=heads.map((h,i)=>{if(!h.id)h.id=`section-${i+1}`;return `<a href="#${h.id}">${LitalkBlog.escapeHtml(h.textContent)}</a>`;}).join('');}

  function recommendCard(post){const title=LitalkBlog.pick(post,'title');const cover=LitalkBlog.coverUrl(post);const m=cover?(LitalkBlog.isVideoCover(post)?`<video src="${cover}" muted playsinline preload="metadata"></video>`:`<img src="${cover}" alt="${LitalkBlog.escapeHtml(title)}" loading="lazy" width="480" height="300">`):'';return `<a class="post-editorial__more-card" href="/blog/post?slug=${encodeURIComponent(post.slug)}"><div class="post-editorial__more-media">${m}</div><span class="post-editorial__more-cat">${LitalkBlog.escapeHtml(post.category||'Article')}</span><h3>${LitalkBlog.escapeHtml(title)}</h3></a>`;}

  function renderCurrentPost(){
    if(!currentPost)return;
    const post=currentPost,title=LitalkBlog.pick(post,'title'),excerpt=LitalkBlog.pick(post,'excerpt'),body=LitalkBlog.pick(post,'content')||post.content||post.contentTh||'';
    document.title=`${title} — LITALK Education`;setText('post-title',title);setText('post-category',post.category||'Article');setText('post-excerpt',excerpt);setText('post-date',LitalkBlog.fmtDate(post.publishedAt));
    const author=post.authorName||post.author||'';setText('post-author',author);if($('post-author'))$('post-author').hidden=!author;if($('post-excerpt'))$('post-excerpt').hidden=!excerpt;
    $('post-cover-wrap').innerHTML=media(post,'post-editorial__cover');$('post-cover-wrap').hidden=!$('post-cover-wrap').innerHTML;$('post-content').innerHTML=LitalkBlog.mdToHtml(body);
    const minutes=readingMinutes(body);setText('reading-time',LitalkBlog.lang()==='th'?`อ่านประมาณ ${minutes} นาที`:`${minutes} min read`);buildToc();
    if($('post-more-grid'))$('post-more-grid').innerHTML=relatedPosts.map(recommendCard).join('');if($('post-more'))$('post-more').hidden=!relatedPosts.length;
  }

  function bindShare(){
    if(shareBound)return;shareBound=true;const url=canonicalUrl(),copy=$('copy-link'),share=$('native-share');
    if(copy)copy.addEventListener('click',async()=>{const ok=await copyText(url);copy.setAttribute('aria-label',ok?(LitalkBlog.lang()==='th'?'คัดลอกลิงก์แล้ว':'Link copied'):(LitalkBlog.lang()==='th'?'คัดลอกลิงก์ไม่สำเร็จ':'Could not copy link'));if(ok){copy.innerHTML='<i class="fas fa-check"></i>';setTimeout(()=>copy.innerHTML='<i class="fas fa-link"></i>',1500);}});
    if(share&&navigator.share){share.hidden=false;share.addEventListener('click',()=>{if(!currentPost)return;navigator.share({title:LitalkBlog.pick(currentPost,'title'),text:LitalkBlog.pick(currentPost,'excerpt'),url}).catch(()=>{});});}
  }

  async function load(){
    if(!slug){location.replace('/blog/articles');return;}
    try{const post=await LitalkBlog.fetchPost(slug);if(!post){$('post-content').innerHTML='<p>Article not found.</p>';return;}currentPost=post;const url=canonicalUrl();const canonical=document.querySelector('link[rel="canonical"]');if(canonical)canonical.href=url;const posts=await LitalkBlog.fetchPosts();relatedPosts=posts.filter(p=>p.slug!==slug).slice(0,3);renderCurrentPost();bindShare();}
    catch(err){console.warn('post: failed to load',err);$('post-content').innerHTML='<p>Could not load this article right now. Please try again later.</p>';}
  }

  document.addEventListener('litalk:langchange',renderCurrentPost);document.addEventListener('DOMContentLoaded',load);
})();