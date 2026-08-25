'use strict';

(function initTcasFortune() {
  const API = 'https://istudent.litalkeducation.com/api/tcas-fortune';
  const IMAGE_ROOT = '../img/tcas-fortune/';
  const CARD_BACK = `${IMAGE_ROOT}card-back.webp`;
  const POSITIONS = [
    { id: 'current', th: 'สถานการณ์ปัจจุบัน', en: 'Current situation' },
    { id: 'challenge', th: 'สิ่งที่ต้องระวัง', en: 'Challenge / what to watch' },
    { id: 'guidance', th: 'คำแนะนำที่ควรโฟกัส', en: 'Guidance / what to focus on' },
  ];
  const CARD_DEFINITIONS = [
    ['the-fool', 'The Fool', '0'], ['the-magician', 'The Magician', 'I'],
    ['the-high-priestess', 'The High Priestess', 'II'], ['the-empress', 'The Empress', 'III'],
    ['the-emperor', 'The Emperor', 'IV'], ['the-hierophant', 'The Hierophant', 'V'],
    ['the-lovers', 'The Lovers', 'VI'], ['the-chariot', 'The Chariot', 'VII'],
    ['strength', 'Strength', 'VIII'], ['the-hermit', 'The Hermit', 'IX'],
    ['wheel-of-fortune', 'Wheel of Fortune', 'X'], ['justice', 'Justice', 'XI'],
    ['the-hanged-man', 'The Hanged Man', 'XII'], ['death', 'Death', 'XIII'],
    ['temperance', 'Temperance', 'XIV'], ['the-devil', 'The Devil', 'XV'],
    ['the-tower', 'The Tower', 'XVI'], ['the-star', 'The Star', 'XVII'],
    ['the-moon', 'The Moon', 'XVIII'], ['the-sun', 'The Sun', 'XIX'],
    ['judgement', 'Judgement', 'XX'], ['the-world', 'The World', 'XXI'],
  ];
  const CARDS = CARD_DEFINITIONS.map(([id, name, numeral]) => ({
    id, name, numeral, image: `${IMAGE_ROOT}${id}.webp`,
  }));
  const QUESTIONS = [
    ['preparation', 'การเตรียมสอบช่วงนี้เป็นอย่างไร', 'How is my preparation going?'],
    ['focus', 'ตอนนี้ควรโฟกัสอะไร', 'What should I focus on now?'],
    ['watch', 'สิ่งที่ต้องระวังในการเตรียม TCAS', 'What should I watch in my TCAS preparation?'],
    ['energy', 'พลังงานก่อนสอบของฉัน', 'My energy before the exam'],
    ['faculty', 'คณะที่กำลังเล็งไว้ — ฉันควรเตรียมตัวยังไง', 'How should I prepare for my target faculty?'],
    ['exams', 'TGAT / TPAT / A-Level ช่วงนี้ควรเน้นอะไร', 'What should I prioritise for TGAT / TPAT / A-Level?'],
  ];

  let lang = localStorage.getItem('litalk-lang') === 'en' ? 'en' : 'th';
  let category = '';
  let deck = [];
  let previousDeckOrder = '';
  let selected = [];
  let revealed = new Set();

  const byId = (id) => document.getElementById(id);
  const text = (node, value) => { node.textContent = value == null ? '' : String(value); };

  function applyLanguage() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.querySelectorAll('[data-th][data-en]').forEach((node) => text(node, node.dataset[lang]));
    document.querySelectorAll('[data-placeholder-th]').forEach((node) => {
      node.placeholder = node.dataset[`placeholder${lang === 'th' ? 'Th' : 'En'}`];
    });
    text(byId('fortune-lang'), lang === 'th' ? 'EN' : 'ไทย');
    renderQuestions();
    if (!byId('step-cards').hidden) renderDeck();
    if (!byId('step-reveal').hidden) renderRevealCards();
  }

  function renderQuestions() {
    const wrap = byId('fortune-questions');
    wrap.replaceChildren(...QUESTIONS.map(([id, th, en]) => {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'fortune-question';
      button.setAttribute('aria-pressed', String(category === id));
      text(button, lang === 'th' ? th : en);
      button.addEventListener('click', () => {
        category = id;
        renderQuestions();
        text(byId('question-error'), '');
      });
      return button;
    }));
  }

  function showStep(id) {
    document.querySelectorAll('.fortune-step').forEach((step) => {
      step.hidden = step.id !== `step-${id}`;
      step.classList.toggle('is-active', !step.hidden);
    });
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  function secureShuffle(cards) {
    const shuffled = [...cards];
    for (let i = shuffled.length - 1; i > 0; i -= 1) {
      const ceiling = Math.floor(0x100000000 / (i + 1)) * (i + 1);
      let value;
      do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= ceiling);
      const index = value % (i + 1);
      [shuffled[i], shuffled[index]] = [shuffled[index], shuffled[i]];
    }
    return shuffled;
  }

  function shuffleDeck() {
    let next;
    let order;
    do {
      next = secureShuffle(CARDS);
      order = next.map((card) => card.id).join(',');
    } while (order === previousDeckOrder);
    previousDeckOrder = order;
    deck = next;
  }

  function selectionProgress() {
    if (selected.length === 3) return lang === 'th' ? 'เลือกไพ่ครบ 3 ใบแล้ว' : 'All 3 cards selected';
    return lang === 'th' ? `เลือกไพ่ ${selected.length + 1} / 3 ใบ` : `Choose card ${selected.length + 1} of 3`;
  }

  function cardBackImage() {
    const image = document.createElement('img');
    image.src = CARD_BACK;
    image.alt = '';
    image.width = 600;
    image.height = 1000;
    image.className = 'fortune-card-art';
    image.addEventListener('error', () => image.closest('.fortune-card-visual')?.classList.add('is-image-missing'));
    return image;
  }

  function renderDeck() {
    text(byId('selection-progress'), selectionProgress());
    byId('confirm-cards').disabled = selected.length !== 3;
    byId('fortune-deck').replaceChildren(...deck.map((card, deckIndex) => {
      const selectedIndex = selected.findIndex((item) => item.id === card.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `fortune-deck-card${selectedIndex >= 0 ? ' is-selected' : ''}`;
      button.dataset.deckIndex = String(deckIndex);
      button.setAttribute('aria-pressed', String(selectedIndex >= 0));
      button.setAttribute('aria-label', lang === 'th'
        ? `ไพ่คว่ำใบที่ ${deckIndex + 1}${selectedIndex >= 0 ? ` เลือกเป็นใบที่ ${selectedIndex + 1}` : ''}`
        : `Face-down card ${deckIndex + 1}${selectedIndex >= 0 ? `, selected ${selectedIndex + 1}` : ''}`);
      const visual = document.createElement('span');
      visual.className = 'fortune-card-visual';
      visual.append(cardBackImage());
      const fallback = document.createElement('span');
      fallback.className = 'fortune-card-back-fallback';
      fallback.setAttribute('aria-hidden', 'true');
      ['✦', 'LITALK', 'TCAS'].forEach((label) => { const line = document.createElement('span'); text(line, label); fallback.append(line); });
      visual.append(fallback);
      if (selectedIndex >= 0) {
        const badge = document.createElement('span');
        badge.className = 'fortune-selection-badge';
        badge.setAttribute('aria-hidden', 'true');
        text(badge, selectedIndex + 1);
        visual.append(badge);
      }
      button.append(visual);
      button.addEventListener('click', () => toggleCard(card, deckIndex));
      return button;
    }));
  }

  function toggleCard(card, deckIndex) {
    const index = selected.findIndex((item) => item.id === card.id);
    if (index >= 0) selected.splice(index, 1);
    else if (selected.length < 3) selected.push(card);
    renderDeck();
    byId('fortune-deck').querySelector(`[data-deck-index="${deckIndex}"]`)?.focus();
  }

  function faceArtwork(card, initiallyHidden = false) {
    const visual = document.createElement('span');
    visual.className = 'fortune-face-art';
    const image = document.createElement('img');
    image.src = card.image;
    image.alt = initiallyHidden ? '' : card.name;
    image.width = 600;
    image.height = 1000;
    image.loading = 'lazy';
    image.className = 'fortune-card-art';
    image.addEventListener('error', () => visual.classList.add('is-image-missing'));
    const fallback = document.createElement('span');
    fallback.className = 'fortune-face-fallback';
    fallback.setAttribute('aria-hidden', 'true');
    const star = document.createElement('span');
    const name = document.createElement('strong');
    const numeral = document.createElement('span');
    text(star, '✦'); text(name, card.name.toUpperCase()); text(numeral, card.numeral);
    fallback.append(star, name, numeral);
    visual.append(image, fallback);
    return visual;
  }

  function renderRevealCards() {
    byId('read-fortune').hidden = revealed.size !== 3;
    byId('fortune-cards').replaceChildren(...selected.map((card, index) => {
      const isRevealed = revealed.has(card.id);
      const button = document.createElement('button');
      button.type = 'button';
      button.className = `fortune-card-button${isRevealed ? ' is-revealed' : ''}`;
      button.setAttribute('aria-label', isRevealed
        ? `${card.name} — ${POSITIONS[index][lang]}`
        : (lang === 'th' ? `เปิดไพ่ตำแหน่ง ${POSITIONS[index].th}` : `Reveal card for ${POSITIONS[index].en}`));
      button.disabled = isRevealed;
      const inner = document.createElement('span');
      inner.className = 'fortune-card-inner';
      const front = document.createElement('span');
      front.className = 'fortune-card-face fortune-card-face--front fortune-card-visual';
      front.setAttribute('aria-hidden', String(isRevealed));
      front.append(cardBackImage());
      const backFallback = document.createElement('span');
      backFallback.className = 'fortune-card-back-fallback';
      backFallback.setAttribute('aria-hidden', 'true');
      ['✦', 'LITALK', 'TCAS'].forEach((label) => { const line = document.createElement('span'); text(line, label); backFallback.append(line); });
      front.append(backFallback);
      const back = document.createElement('span');
      back.className = 'fortune-card-face fortune-card-face--back';
      back.setAttribute('aria-hidden', String(!isRevealed));
      back.append(faceArtwork(card, !isRevealed));
      const name = document.createElement('strong');
      const position = document.createElement('span');
      position.className = 'fortune-position';
      text(name, card.name); text(position, POSITIONS[index][lang]);
      back.append(name, position);
      inner.append(front, back);
      button.append(inner);
      button.addEventListener('click', () => {
        revealed.add(card.id);
        renderRevealCards();
      });
      return button;
    }));
  }

  function errorCopy(code) {
    const messages = {
      region_not_supported: ['ฟีเจอร์นี้เปิดให้ใช้งานในประเทศไทยเท่านั้น 🇹🇭', 'TCAS Fortune is currently available in Thailand only.'],
      rate_limited: ['วันนี้เปิดไพ่ครบจำนวนแล้ว กลับมาใหม่พรุ่งนี้นะ', 'You have reached today’s reading limit. Please return tomorrow.'],
      feature_disabled: ['TCAS Fortune ปิดให้บริการชั่วคราว', 'TCAS Fortune is temporarily disabled.'],
      maintenance: ['กำลังปรับปรุงประสบการณ์เปิดไพ่ โปรดลองใหม่ภายหลัง', 'We are polishing the experience. Please try again later.'],
      invalid_question: ['กรุณาตรวจสอบคำถามแล้วลองใหม่', 'Please check your question and try again.'],
      invalid_cards: ['ข้อมูลไพ่ไม่ถูกต้อง กรุณาเปิดไพ่ใหม่', 'The card spread is invalid. Please start again.'],
    };
    return (messages[code] || ['ตอนนี้คำแนะนำจาก AI ยังไม่พร้อม ลองใหม่อีกครั้งในอีกสักครู่ ไพ่ของคุณยังอยู่ครบ', 'AI guidance is temporarily unavailable. Please retry; your cards are still here.'])[lang === 'th' ? 0 : 1];
  }

  async function requestReading() {
    showStep('result');
    byId('fortune-loading').hidden = false;
    byId('fortune-error').hidden = true;
    byId('fortune-result').hidden = true;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(API, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        signal: controller.signal,
        body: JSON.stringify({
          questionType: category,
          question: byId('custom-question').value.trim(),
          language: lang,
          cards: selected.map((card, index) => ({ id: card.id, position: POSITIONS[index].id })),
        }),
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'network');
      renderResult(data);
    } catch (error) {
      byId('fortune-loading').hidden = true;
      byId('fortune-error').hidden = false;
      text(byId('error-title'), lang === 'th' ? 'ยังอ่านคำแนะนำไม่ได้' : 'Guidance is not available yet');
      text(byId('error-copy'), errorCopy(error instanceof Error ? error.message : 'network'));
    } finally { clearTimeout(timeout); }
  }

  function renderResult(reading) {
    byId('fortune-loading').hidden = true;
    byId('fortune-result').hidden = false;
    text(byId('result-title'), reading.headline);
    text(byId('result-overall'), reading.overall_message);
    text(byId('result-focus'), reading.focus_today);
    text(byId('result-encouragement'), reading.encouragement);
    text(byId('result-disclaimer'), reading.disclaimer);
    byId('result-cards').replaceChildren(...selected.map((card, index) => {
      const item = reading.cards?.find((entry) => (entry.card_id || entry.id) === card.id) || {};
      const article = document.createElement('article');
      article.className = 'fortune-result-card';
      const art = faceArtwork(card);
      art.classList.add('fortune-result-art');
      const copy = document.createElement('div');
      copy.className = 'fortune-result-copy';
      const heading = document.createElement('h3');
      const position = document.createElement('p');
      position.className = 'fortune-position';
      const interpretation = document.createElement('p');
      const action = document.createElement('p');
      action.className = 'fortune-action';
      text(heading, card.name);
      text(position, POSITIONS[index][lang]);
      text(interpretation, item.tcas_interpretation || item.meaning || '');
      text(action, `${lang === 'th' ? 'สิ่งที่ทำได้' : 'Action'}: ${item.action || ''}`);
      copy.append(heading, position, interpretation, action);
      article.append(art, copy);
      return article;
    }));
    const plan = lang === 'th'
      ? `ผล TCAS Fortune แนะนำให้โฟกัส: ${reading.focus_today} ช่วยสร้างแผนอ่าน 7 วันที่นำไปทำได้จริงให้หน่อย`
      : `My TCAS Fortune reflection suggested this focus: ${reading.focus_today}. Please create a practical 7-day study plan.`;
    byId('ask-handoff').href = `../ask?prompt=${encodeURIComponent(plan)}`;
  }

  function startSelection() {
    selected = [];
    revealed = new Set();
    shuffleDeck();
    renderDeck();
    showStep('cards');
  }

  byId('fortune-lang').addEventListener('click', () => {
    lang = lang === 'th' ? 'en' : 'th';
    localStorage.setItem('litalk-lang', lang);
    applyLanguage();
  });
  document.querySelector('[data-next="question"]').addEventListener('click', () => showStep('question'));
  byId('custom-question').addEventListener('input', (event) => text(byId('question-count'), event.target.value.length));
  byId('choose-cards').addEventListener('click', () => {
    if (!category) {
      text(byId('question-error'), lang === 'th' ? 'กรุณาเลือกหัวข้อก่อน' : 'Please choose a topic first.');
      return;
    }
    startSelection();
  });
  byId('confirm-cards').addEventListener('click', () => {
    if (selected.length !== 3) return;
    revealed = new Set();
    renderRevealCards();
    showStep('reveal');
  });
  byId('read-fortune').addEventListener('click', requestReading);
  byId('retry-reading').addEventListener('click', requestReading);
  byId('read-again').addEventListener('click', () => {
    category = '';
    byId('custom-question').value = '';
    text(byId('question-count'), '0');
    selected = [];
    revealed = new Set();
    renderQuestions();
    showStep('question');
  });
  byId('share-reading').addEventListener('click', async () => {
    const share = { title: 'TCAS Fortune · LITALK', text: lang === 'th' ? 'ฉันเปิดไพ่ TCAS กับ LITALK แล้ว ✨' : 'I opened my TCAS Fortune with LITALK ✨', url: 'https://litalkeducation.com/tcas-fortune/' };
    if (navigator.share) await navigator.share(share).catch(() => {});
    else await navigator.clipboard.writeText(`${share.text} ${share.url}`);
  });

  applyLanguage();
})();
