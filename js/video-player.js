/**
 * LITALK Education — video-player.js
 *
 * A lesson video player that shows as little of YouTube as YouTube allows.
 *
 * What actually suppresses the chrome, and what does not:
 *
 *   controls=0        removes the whole bottom bar, including the YouTube
 *                     wordmark that lives in it. This is the big one, and it
 *                     is why the player below has to supply its own controls.
 *   iv_load_policy=3  no annotations.
 *   fs=0, disablekb=1 no native fullscreen button, no native key handling —
 *                     both are provided here instead.
 *   pointer-events:none on the iframe. The title bar, channel avatar, Share
 *                     and Watch-later only appear in response to pointer
 *                     activity over the player. If the iframe never receives
 *                     any, they never appear. Every interaction goes through
 *                     the overlay below and the official IFrame Player API.
 *   stopping early    the end-screen grid of suggested videos is drawn when a
 *                     video reaches its end, so playback is paused a moment
 *                     before that and a replay button is offered instead.
 *
 *   rel=0             does NOT remove related videos any more; since 2018 it
 *                     only restricts them to the same channel.
 *   modestbranding    deprecated and inert — deliberately not sent, rather
 *                     than kept as decoration that implies it still works.
 *
 * None of this hides the fact that the video is on YouTube, and it cannot:
 * a viewer who opens the network tab, or who goes fullscreen on a phone where
 * the OS player takes over, still sees it. This is presentation.
 *
 * If the IFrame API cannot be reached the player falls back to an ordinary
 * embed WITH native controls — a lesson that plays with YouTube's bar showing
 * beats a lesson that does not play.
 */

'use strict';

window.litalkVideo = (function () {
  const EMBED_HOST = 'https://www.youtube-nocookie.com';
  const API_SRC = 'https://www.youtube.com/iframe_api';
  const API_TIMEOUT_MS = 6000;
  // How far before the end to stop, so the suggested-video grid never draws.
  const END_GUARD_S = 0.4;

  let apiPromise = null;

  function loadApi() {
    if (apiPromise) return apiPromise;
    apiPromise = new Promise((resolve, reject) => {
      if (window.YT && window.YT.Player) {
        resolve(window.YT);
        return;
      }
      const timer = setTimeout(() => reject(new Error('YouTube API timed out')), API_TIMEOUT_MS);
      const settle = (fn) => (value) => { clearTimeout(timer); fn(value); };
      const ok = settle(resolve);
      const fail = settle(reject);

      // The API calls exactly one global hook; chain rather than clobber, in
      // case something else on the page already registered one.
      const prev = window.onYouTubeIframeAPIReady;
      window.onYouTubeIframeAPIReady = function () {
        if (typeof prev === 'function') prev();
        ok(window.YT);
      };

      const s = document.createElement('script');
      s.src = API_SRC;
      s.async = true;
      s.onerror = () => fail(new Error('YouTube API failed to load'));
      document.head.appendChild(s);
    });
    return apiPromise;
  }

  function fmt(sec) {
    if (!isFinite(sec) || sec < 0) sec = 0;
    const s = Math.floor(sec % 60);
    const m = Math.floor(sec / 60) % 60;
    const h = Math.floor(sec / 3600);
    const mm = h ? String(m).padStart(2, '0') : String(m);
    return (h ? h + ':' : '') + mm + ':' + String(s).padStart(2, '0');
  }

  /* ---- the shell, rendered before the API is known to be available ------ */
  function shellHtml(id) {
    return (
      '<div class="lv__frame"><div class="lv__mount"></div></div>' +
      // Covers the strip where YouTube draws its title, channel and "Watch on
      // YouTube" while the player is paused. That overlay is driven by the
      // paused STATE, not by pointer activity, so pointer-events cannot stop
      // it — only something on top of it can. Shown only when not playing, so
      // it never sits over moving picture.
      '<div class="lv__top" aria-hidden="true"></div>' +
      '<img class="lv__wm" src="img/LITALK-White.png" alt="" aria-hidden="true" width="96" height="16">' +
      '<button type="button" class="lv__surface" aria-label="เล่นหรือหยุดวีดีโอ"></button>' +
      '<div class="lv__hint lv__hint--back" aria-hidden="true"><i class="fas fa-backward"></i><span>10</span></div>' +
      '<div class="lv__hint lv__hint--fwd" aria-hidden="true"><i class="fas fa-forward"></i><span>10</span></div>' +
      '<div class="lv__center">' +
        '<button type="button" class="lv__big" aria-label="เล่นวีดีโอ"><i class="fas fa-play"></i></button>' +
      '</div>' +
      '<div class="lv__bar">' +
        '<button type="button" class="lv__btn lv__play" aria-label="เล่น"><i class="fas fa-play"></i></button>' +
        '<div class="lv__seek" role="slider" tabindex="0" aria-label="ตำแหน่งในวีดีโอ" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0">' +
          '<div class="lv__track"><div class="lv__buf"></div><div class="lv__prog"></div><div class="lv__knob"></div></div>' +
        '</div>' +
        '<span class="lv__time">0:00 / 0:00</span>' +
        '<button type="button" class="lv__btn lv__mute" aria-label="ปิดเสียง"><i class="fas fa-volume-high"></i></button>' +
        '<div class="lv__q" hidden>' +
          '<button type="button" class="lv__btn lv__qbtn" aria-haspopup="true" aria-expanded="false" aria-label="ความละเอียด"><i class="fas fa-gear"></i></button>' +
          '<div class="lv__qmenu" role="menu" hidden></div>' +
        '</div>' +
        '<button type="button" class="lv__btn lv__fs" aria-label="เต็มจอ"><i class="fas fa-expand"></i></button>' +
      '</div>' +
      '<noscript><iframe src="' + EMBED_HOST + '/embed/' + id + '" title="วีดีโอการสอน" allowfullscreen></iframe></noscript>'
    );
  }

  // YouTube's own level names, newest first. 'auto' is added separately.
  const Q_LABELS = {
    highres: '4K+', hd2160: '2160p', hd1440: '1440p', hd1080: '1080p',
    hd720: '720p', large: '480p', medium: '360p', small: '240p', tiny: '144p',
  };

  /* ---- the fallback: an ordinary embed, native controls and all --------- */
  function fallback(root, id) {
    root.classList.add('lv--fallback');
    root.innerHTML =
      '<iframe src="' + EMBED_HOST + '/embed/' + id + '?rel=0&iv_load_policy=3&playsinline=1"' +
      ' title="วีดีโอการสอน" loading="lazy"' +
      ' allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"' +
      ' allowfullscreen></iframe>';
  }

  function upgrade(root) {
    const id = root.getAttribute('data-yt');
    if (!id || root.dataset.lvReady === '1') return;
    root.dataset.lvReady = '1';
    root.innerHTML = shellHtml(id);

    const q = (sel) => root.querySelector(sel);
    const mount = q('.lv__mount');
    const surface = q('.lv__surface');
    const big = q('.lv__big');
    const playBtn = q('.lv__play');
    const seek = q('.lv__seek');
    const prog = q('.lv__prog');
    const buf = q('.lv__buf');
    const timeEl = q('.lv__time');
    const muteBtn = q('.lv__mute');
    const fsBtn = q('.lv__fs');
    const qWrap = q('.lv__q');
    const qBtn = q('.lv__qbtn');
    const qMenu = q('.lv__qmenu');
    const hintBack = q('.lv__hint--back');
    const hintFwd = q('.lv__hint--fwd');

    let player = null;
    let duration = 0;
    let ticking = null;
    let ended = false;

    const icon = (btn, name) => {
      const i = btn.querySelector('i');
      if (i) i.className = 'fas fa-' + name;
    };

    function setPlaying(on) {
      root.classList.toggle('is-playing', on);
      icon(playBtn, on ? 'pause' : 'play');
      playBtn.setAttribute('aria-label', on ? 'หยุดชั่วคราว' : 'เล่น');
      surface.setAttribute('aria-label', on ? 'หยุดวีดีโอชั่วคราว' : 'เล่นวีดีโอ');
    }

    // Double-tap seek. Flashes the matching hint so the jump is visible even
    // when the picture barely changes.
    function nudge(delta) {
      if (!player || !duration) return;
      const t = Math.max(0, Math.min(duration, player.getCurrentTime() + delta));
      ended = false;
      root.classList.remove('is-ended');
      player.seekTo(t, true);
      const hint = delta < 0 ? hintBack : hintFwd;
      hint.classList.remove('is-on');
      void hint.offsetWidth;               // restart the animation
      hint.classList.add('is-on');
      setTimeout(() => hint.classList.remove('is-on'), 500);
      paint();
    }

    // Quality is a *request*: YouTube has treated setPlaybackQuality as a hint
    // since it started picking levels from bandwidth and viewport, and it is
    // free to ignore it. So the menu is only built when the API actually
    // reports levels, and it always shows what is really playing rather than
    // what was asked for.
    function buildQuality() {
      if (!player || !player.getAvailableQualityLevels) return;
      const levels = (player.getAvailableQualityLevels() || []).filter((l) => l !== 'auto');
      if (levels.length < 2) return;       // nothing meaningful to choose
      qWrap.hidden = false;
      const current = player.getPlaybackQuality ? player.getPlaybackQuality() : 'auto';
      qMenu.innerHTML =
        ['auto'].concat(levels).map((l) => {
          const label = l === 'auto' ? 'อัตโนมัติ' : (Q_LABELS[l] || l);
          const on = l === current;
          return '<button type="button" role="menuitemradio" aria-checked="' + on + '"' +
                 ' class="lv__qitem' + (on ? ' is-on' : '') + '" data-q="' + l + '">' +
                 label + '</button>';
        }).join('');
      qMenu.querySelectorAll('.lv__qitem').forEach((b) => {
        b.addEventListener('click', () => {
          const level = b.getAttribute('data-q');
          if (player.setPlaybackQuality) player.setPlaybackQuality(level);
          closeQuality();
          // Re-read after the player has had a moment to accept or ignore it,
          // so the tick reflects reality rather than the request.
          setTimeout(buildQuality, 700);
        });
      });
    }

    function closeQuality() {
      qMenu.hidden = true;
      qBtn.setAttribute('aria-expanded', 'false');
    }

    function paint() {
      if (!player || !duration) return;
      const t = player.getCurrentTime ? player.getCurrentTime() : 0;
      const pct = Math.min(100, (t / duration) * 100);
      prog.style.width = pct + '%';
      timeEl.textContent = fmt(t) + ' / ' + fmt(duration);
      seek.setAttribute('aria-valuenow', String(Math.round(pct)));
      seek.setAttribute('aria-valuetext', fmt(t) + ' จาก ' + fmt(duration));
      if (player.getVideoLoadedFraction) buf.style.width = (player.getVideoLoadedFraction() * 100) + '%';

      // Stop just short of the end so YouTube never draws its suggested-video
      // grid over the last frame.
      if (!ended && duration && t >= duration - END_GUARD_S) {
        ended = true;
        player.pauseVideo();
        root.classList.add('is-ended');
        icon(big, 'rotate-right');
        big.setAttribute('aria-label', 'เล่นอีกครั้ง');
      }
    }

    function startTicking() {
      stopTicking();
      ticking = setInterval(paint, 200);
    }
    function stopTicking() {
      if (ticking) clearInterval(ticking);
      ticking = null;
    }

    function toggle() {
      if (!player) return;
      if (ended) {
        ended = false;
        root.classList.remove('is-ended');
        icon(big, 'play');
        big.setAttribute('aria-label', 'เล่นวีดีโอ');
        player.seekTo(0, true);
        player.playVideo();
        return;
      }
      const state = player.getPlayerState ? player.getPlayerState() : -1;
      if (state === 1) player.pauseVideo();
      else player.playVideo();
    }

    function seekToEvent(e) {
      if (!player || !duration) return;
      const r = seek.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      const ratio = Math.max(0, Math.min(1, x / r.width));
      ended = false;
      root.classList.remove('is-ended');
      player.seekTo(ratio * duration, true);
      paint();
    }

    loadApi().then((YT) => {
      player = new YT.Player(mount, {
        host: EMBED_HOST,
        videoId: id,
        playerVars: {
          controls: 0,          // the bottom bar, and the wordmark inside it
          rel: 0,               // related videos limited to this channel
          iv_load_policy: 3,    // no annotations
          playsinline: 1,       // iOS plays inline rather than taking over
          fs: 0,                // no native fullscreen button; ours is below
          disablekb: 1,         // no native key handling; ours is below
          cc_load_policy: 0,
          origin: window.location.origin,
        },
        events: {
          onReady: () => {
            duration = player.getDuration() || 0;
            root.classList.add('is-ready');
            buildQuality();
            paint();
          },
          onStateChange: (e) => {
            // 1 playing, 2 paused, 0 ended, 3 buffering
            if (!duration) duration = player.getDuration() || 0;
            setPlaying(e.data === 1);
            root.classList.toggle('is-buffering', e.data === 3);
            if (e.data === 1) startTicking();
            else stopTicking();
            if (e.data === 0) {
              // Only reachable if the guard above was outrun; treat it the same.
              ended = true;
              root.classList.add('is-ended');
              icon(big, 'rotate-right');
            }
            paint();
          },
          onError: () => fallback(root, id),
        },
      });
    }, () => fallback(root, id));

    /* ---- wiring ---- */
    // A mouse gets an immediate play/pause — waiting to see whether a second
    // click arrives would make every click feel laggy. Touch gets the
    // double-tap-to-seek behaviour people expect from a video, which does mean
    // the single tap has to wait long enough to know it is single.
    const DOUBLE_MS = 280;
    let lastTap = 0;
    let tapTimer = null;

    // A touch produces pointerup AND a click; this flag stops the click
    // handler acting on a tap that pointerup has already dealt with.
    let handledByTouch = false;

    surface.addEventListener('pointerup', (e) => {
      if (e.pointerType !== 'touch') return;      // mouse is handled by click
      handledByTouch = true;
      const now = Date.now();
      const r = surface.getBoundingClientRect();
      const left = (e.clientX - r.left) < r.width / 2;
      if (now - lastTap < DOUBLE_MS) {
        clearTimeout(tapTimer);
        tapTimer = null;
        lastTap = 0;
        nudge(left ? -10 : 10);
        return;
      }
      lastTap = now;
      clearTimeout(tapTimer);
      tapTimer = setTimeout(() => { tapTimer = null; toggle(); }, DOUBLE_MS);
    });

    surface.addEventListener('click', () => {
      if (handledByTouch) { handledByTouch = false; return; }
      // Mouse only, so no waiting to see whether a second click follows —
      // seeking with a mouse is the arrow keys on the scrubber instead.
      toggle();
    });

    big.addEventListener('click', toggle);
    playBtn.addEventListener('click', toggle);

    qBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      const open = qMenu.hidden;
      qMenu.hidden = !open;
      qBtn.setAttribute('aria-expanded', String(open));
      if (open) buildQuality();
    });
    document.addEventListener('click', (e) => {
      if (!qMenu.hidden && !qWrap.contains(e.target)) closeQuality();
    });

    let dragging = false;
    seek.addEventListener('pointerdown', (e) => {
      dragging = true;
      seek.setPointerCapture(e.pointerId);
      seekToEvent(e);
    });
    seek.addEventListener('pointermove', (e) => {
      if (dragging) seekToEvent(e);
    });
    seek.addEventListener('pointerup', (e) => {
      dragging = false;
      try { seek.releasePointerCapture(e.pointerId); } catch (err) { /* already released */ }
    });

    seek.addEventListener('keydown', (e) => {
      if (!player || !duration) return;
      const t = player.getCurrentTime();
      if (e.key === 'ArrowRight') { player.seekTo(Math.min(duration, t + 5), true); e.preventDefault(); }
      else if (e.key === 'ArrowLeft') { player.seekTo(Math.max(0, t - 5), true); e.preventDefault(); }
      else if (e.key === 'Home') { player.seekTo(0, true); e.preventDefault(); }
      paint();
    });

    muteBtn.addEventListener('click', () => {
      if (!player) return;
      const muted = player.isMuted();
      if (muted) player.unMute(); else player.mute();
      icon(muteBtn, muted ? 'volume-high' : 'volume-xmark');
      muteBtn.setAttribute('aria-label', muted ? 'ปิดเสียง' : 'เปิดเสียง');
    });

    fsBtn.addEventListener('click', () => {
      // Fullscreen the wrapper, not the iframe, so our controls come along
      // instead of handing the screen back to YouTube's.
      if (document.fullscreenElement) document.exitFullscreen();
      else if (root.requestFullscreen) root.requestFullscreen();
      else if (root.webkitRequestFullscreen) root.webkitRequestFullscreen();
    });
    document.addEventListener('fullscreenchange', () => {
      const on = document.fullscreenElement === root;
      root.classList.toggle('is-fullscreen', on);
      icon(fsBtn, on ? 'compress' : 'expand');
    });

    // Space and K on the player itself, since native keys are off.
    root.addEventListener('keydown', (e) => {
      if (e.target !== root && e.target !== surface) return;
      if (e.key === ' ' || e.key.toLowerCase() === 'k') {
        e.preventDefault();
        toggle();
      }
    });
  }

  return {
    /** Upgrade every .lv[data-yt] inside `scope` (default: the document). */
    mount(scope) {
      const host = scope || document;
      host.querySelectorAll('.lv[data-yt]').forEach(upgrade);
    },
  };
})();
