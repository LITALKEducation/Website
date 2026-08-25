'use strict';

(function initTcasFortune() {
  const API = 'https://istudent.litalkeducation.com/api/tcas-fortune';
  const IMAGE_ROOT = '../img/tcas-fortune/';
  const POSITIONS = [
    { id: 'current', th: 'สถานการณ์ปัจจุบัน', en: 'Current' },
    { id: 'challenge', th: 'สิ่งที่ต้องระวัง', en: 'Challenge' },
    { id: 'guidance', th: 'คำแนะนำที่ควรโฟกัส', en: 'Guidance' },
  ];
  const CARD_DATA = [
    ['the-fool', 'The Fool', '0'], ['the-magician', 'The Magician', 'I'], ['the-high-priestess', 'The High Priestess', 'II'],
    ['the-empress', 'The Empress', 'III'], ['the-emperor', 'The Emperor', 'IV'], ['the-hierophant', 'The Hierophant', 'V'],
    ['the-lovers', 'The Lovers', 'VI'], ['the-chariot', 'The Chariot', 'VII'], ['strength', 'Strength', 'VIII'],
    ['the-hermit', 'The Hermit', 'IX'], ['wheel-of-fortune', 'Wheel of Fortune', 'X'], ['justice', 'Justice', 'XI'],
    ['the-hanged-man', 'The Hanged Man', 'XII'], ['death', 'Death', 'XIII'], ['temperance', 'Temperance', 'XIV'],
    ['the-devil', 'The Devil', 'XV'], ['the-tower', 'The Tower', 'XVI'], ['the-star', 'The Star', 'XVII'],
    ['the-moon', 'The Moon', 'XVIII'], ['the-sun', 'The Sun', 'XIX'], ['judgement', 'Judgement', 'XX'], ['the-world', 'The World', 'XXI'],
  ];
  const CARDS = CARD_DATA.map(([id, name, numeral]) => ({ id, name, numeral, image: `${IMAGE_ROOT}${id}.webp` }));
  const QUESTIONS = [
    ['current_preparation', 'การเตรียมสอบช่วงนี้เป็นอย่างไร', 'How is my preparation going?'],
    ['current_focus', 'ตอนนี้ควรโฟกัสอะไร', 'What should I focus on now?'],
    ['challenge', 'สิ่งที่ต้องระวังในการเตรียม TCAS', 'What should I watch in my TCAS preparation?'],
    ['exam_energy', 'พลังงานก่อนสอบของฉัน', 'My energy before the exam'],
    ['faculty_preparation', 'คณะที่กำลังเล็งไว้ — ฉันควรเตรียมตัวยังไง', 'How should I prepare for my target faculty?'],
    ['tgat', 'TGAT ช่วงนี้ควรเน้นอะไร', 'What should I prioritise for TGAT?'],
    ['tpat', 'TPAT ช่วงนี้ควรเน้นอะไร', 'What should I prioritise for TPAT?'],
    ['a_level', 'A-Level ช่วงนี้ควรเน้นอะไร', 'What should I prioritise for A-Level?'],
  ];
  let lang = localStorage.getItem('litalk-lang') === 'en' ? 'en' : 'th';
  let category = '';
  let deck = [];
  let previousOrder = '';
  let selected = [];
  let revealed = new Set();

  const byId = (id) => document.getElementById(id);
  const text = (node, value) => { node.textContent = value == null ? '' : String(value); };
  function applyLanguage() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.querySelectorAll('[data-th][data-en]').forEach((node) => text(node, node.dataset[lang]));
    document.querySelectorAll('[data-placeholder-th]').forEach((node) => { node.placeholder = node.dataset[`placeholder${lang === 'th' ? 'Th' : 'En'}`]; });
    text(byId('fortune-lang'), lang === 'th' ? 'EN' : 'ไทย');
    renderQuestions();
    if (deck.length) renderDeck();
    if (!byId('step-reveal').hidden) renderRevealCards();
  }
  function renderQuestions() {
    const wrap = byId('fortune-questions');
    wrap.replaceChildren(...QUESTIONS.map(([id, th, en]) => {
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'fortune-question'; button.dataset.category = id;
      button.setAttribute('aria-pressed', String(category === id)); text(button, lang === 'th' ? th : en);
      button.addEventListener('click', () => { category = id; renderQuestions(); text(byId('question-error'), ''); });
      return button;
    }));
  }
  function showStep(id) {
    document.querySelectorAll('.fortune-step').forEach((step) => { step.hidden = step.id !== `step-${id}`; step.classList.toggle('is-active', !step.hidden); });
    window.scrollTo({ top: 0, behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    byId(`step-${id}`).querySelector('h1, h2')?.focus({ preventScroll: true });
  }
  function shuffledDeck() {
    const pool = [...CARDS];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const range = i + 1;
      const limit = Math.floor(0x100000000 / range) * range;
      let value;
      do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= limit);
      const index = value % range;
      [pool[i], pool[index]] = [pool[index], pool[i]];
    }
    if (pool.map((card) => card.id).join() === previousOrder) return shuffledDeck();
    previousOrder = pool.map((card) => card.id).join();
    return pool;
  }
  function backImage() {
    const image = document.createElement('img');
    image.src = `${IMAGE_ROOT}card-back.webp`; image.alt = ''; image.width = 600; image.height = 1000; image.loading = 'lazy';
    image.addEventListener('error', () => image.hidden = true, { once: true });
    return image;
  }
  function updateProgress() {
    const count = selected.length;
    const message = lang === 'th' ? (count === 3 ? 'เลือกไพ่ครบ 3 ใบแล้ว' : `เลือกไพ่ ${count + 1} / 3 ใบ`) : (count === 3 ? 'All 3 cards selected' : `Choose card ${count + 1} of 3`);
    text(byId('selection-progress'), message);
    byId('confirm-cards').disabled = count !== 3;
  }
  function toggleCard(card) {
    const index = selected.findIndex((item) => item.id === card.id);
    if (index >= 0) selected.splice(index, 1);
    else if (selected.length < 3) selected.push(card);
    renderDeck();
  }
  function renderDeck() {
    byId('fortune-deck').replaceChildren(...deck.map((card, deckIndex) => {
      const selectionIndex = selected.findIndex((item) => item.id === card.id);
      const button = document.createElement('button');
      button.type = 'button'; button.className = 'fortune-deck-card'; button.setAttribute('aria-pressed', String(selectionIndex >= 0));
      button.setAttribute('aria-label', lang === 'th' ? `ไพ่คว่ำใบที่ ${deckIndex + 1}${selectionIndex >= 0 ? ` เลือกลำดับที่ ${selectionIndex + 1}` : ''}` : `Face-down card ${deckIndex + 1}${selectionIndex >= 0 ? `, selection ${selectionIndex + 1}` : ''}`);
      const art = document.createElement('span'); art.className = 'fortune-deck-art'; art.append(backImage());
      const fallback = document.createElement('span'); fallback.className = 'fortune-back-fallback'; fallback.setAttribute('aria-hidden', 'true'); text(fallback, '✦'); art.append(fallback);
      if (selectionIndex >= 0) { const badge = document.createElement('span'); badge.className = 'fortune-selection-number'; text(badge, selectionIndex + 1); button.append(badge); }
      button.append(art); button.addEventListener('click', () => toggleCard(card)); return button;
    }));
    updateProgress();
  }
  function faceArtwork(card) {
    const wrap = document.createElement('span'); wrap.className = 'fortune-artwork';
    const image = document.createElement('img'); image.src = card.image; image.alt = ''; image.width = 600; image.height = 1000; image.loading = 'lazy';
    image.addEventListener('error', () => { image.hidden = true; wrap.classList.add('is-fallback'); }, { once: true });
    const fallback = document.createElement('span'); fallback.className = 'fortune-face-fallback'; fallback.setAttribute('aria-hidden', 'true');
    const star = document.createElement('span'); text(star, '✦'); const name = document.createElement('strong'); text(name, card.name.toUpperCase()); const numeral = document.createElement('span'); text(numeral, card.numeral); fallback.append(star, name, numeral);
    wrap.append(image, fallback); return wrap;
  }
  function renderRevealCards() {
    byId('fortune-cards').replaceChildren(...selected.map((card, index) => {
      const isRevealed = revealed.has(card.id);
      const button = document.createElement('button'); button.type = 'button'; button.className = `fortune-card-button${isRevealed ? ' is-revealed' : ''}`;
      button.setAttribute('aria-label', isRevealed ? `${card.name} — ${POSITIONS[index][lang]}` : (lang === 'th' ? `เปิดไพ่คว่ำใบที่ ${index + 1} ตำแหน่ง${POSITIONS[index].th}` : `Reveal face-down card ${index + 1}, ${POSITIONS[index].en}`));
      const inner = document.createElement('span'); inner.className = 'fortune-card-inner';
      const front = document.createElement('span'); front.className = 'fortune-card-face fortune-card-face--front'; front.append(backImage());
      const back = document.createElement('span'); back.className = 'fortune-card-face fortune-card-face--back'; back.append(faceArtwork(card));
      const caption = document.createElement('span'); caption.className = 'fortune-card-caption'; const name = document.createElement('strong'); text(name, card.name); const position = document.createElement('span'); text(position, POSITIONS[index][lang]); caption.append(name, position); back.append(caption);
      inner.append(front, back); button.append(inner);
      button.addEventListener('click', () => { if (revealed.has(card.id)) return; revealed.add(card.id); renderRevealCards(); }); return button;
    }));
    byId('read-fortune').hidden = revealed.size !== 3;
  }
  function errorCopy(code) {
    const map = { region_not_supported: ['ฟีเจอร์นี้เปิดให้ใช้งานในประเทศไทยเท่านั้น 🇹🇭', 'TCAS Fortune is currently available in Thailand only.'], rate_limited: ['วันนี้เปิดไพ่ครบจำนวนแล้ว กลับมาใหม่พรุ่งนี้นะ', 'You have reached today’s reading limit. Please return tomorrow.'], feature_disabled: ['TCAS Fortune ปิดให้บริการชั่วคราว', 'TCAS Fortune is temporarily disabled.'], invalid_request: ['ข้อมูลที่ส่งไม่ถูกต้อง กรุณาเลือกหัวข้อและเปิดไพ่ใหม่อีกครั้ง', 'The reading request was invalid. Please choose your topic and cards again.'], invalid_cards: ['ข้อมูลไพ่ไม่ถูกต้อง กรุณาเปิดไพ่ใหม่', 'The card spread is invalid. Please start again.'] };
    return (map[code] || ['ตอนนี้คำแนะนำจาก AI ยังไม่พร้อม ลองใหม่อีกครั้งในอีกสักครู่ ไพ่ของคุณยังอยู่ครบ', 'AI guidance is temporarily unavailable. Please retry; your cards are still here.'])[lang === 'th' ? 0 : 1];
  }
  function isValidReading(data) {
    const isString = (value) => typeof value === 'string';
    const isRenderableCard = (card) => card && typeof card === 'object'
      && isString(card.action)
      && [card.tcas_interpretation, card.meaning, card.interpretation].some(isString);
    return data && typeof data === 'object'
      && isString(data.headline)
      && isString(data.overall_message)
      && Array.isArray(data.cards)
      && data.cards.length === 3
      && data.cards.every(isRenderableCard)
      && isString(data.focus_today)
      && isString(data.encouragement)
      && isString(data.disclaimer);
  }
  async function requestReading() {
    if (selected.length !== 3 || revealed.size !== 3) return;
    showStep('result'); byId('fortune-loading').hidden = false; byId('fortune-error').hidden = true; byId('fortune-result').hidden = true;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const payload = { questionType: category, question: byId('custom-question').value.trim(), language: lang, cards: selected.map((card, index) => ({ id: card.id, position: POSITIONS[index].id })) };
      const response = await fetch(API, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify(payload) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'network');
      if (!isValidReading(data)) throw new Error('invalid_response');
      renderResult(data);
    } catch (error) { byId('fortune-loading').hidden = true; byId('fortune-error').hidden = false; text(byId('error-title'), lang === 'th' ? 'ยังอ่านคำแนะนำไม่ได้' : 'Guidance is not available yet'); text(byId('error-copy'), errorCopy(error.message)); } finally { clearTimeout(timeout); }
  }
  function renderResult(reading) {
    byId('fortune-loading').hidden = true; byId('fortune-result').hidden = false;
    text(byId('result-title'), reading.headline); text(byId('result-overall'), reading.overall_message); text(byId('result-focus'), reading.focus_today); text(byId('result-encouragement'), reading.encouragement); text(byId('result-disclaimer'), reading.disclaimer);
    byId('result-cards').replaceChildren(...selected.map((card, index) => {
      const item = reading.cards?.find((entry) => (entry.id || entry.card_id) === card.id) || reading.cards?.[index] || {};
      const article = document.createElement('article'); article.className = 'fortune-result-card'; const visual = faceArtwork(card); visual.classList.add('fortune-result-artwork');
      const copy = document.createElement('div'); const heading = document.createElement('h3'); text(heading, card.name); const pos = document.createElement('p'); pos.className = 'fortune-position'; text(pos, POSITIONS[index][lang]); const interpretation = document.createElement('p'); text(interpretation, item.tcas_interpretation || item.meaning || item.interpretation); const action = document.createElement('p'); action.className = 'fortune-action'; text(action, `${lang === 'th' ? 'สิ่งที่ทำได้' : 'Action'}: ${item.action || ''}`); copy.append(heading, pos, interpretation, action); article.append(visual, copy); return article;
    }));
    const plan = lang === 'th' ? `ผล TCAS Fortune แนะนำให้โฟกัส: ${reading.focus_today} ช่วยสร้างแผนอ่าน 7 วันที่นำไปทำได้จริงให้หน่อย` : `My TCAS Fortune reflection suggested this focus: ${reading.focus_today}. Please create a practical 7-day study plan.`;
    byId('ask-handoff').href = `../ask?prompt=${encodeURIComponent(plan)}`;
  }
  byId('fortune-lang').addEventListener('click', () => { lang = lang === 'th' ? 'en' : 'th'; localStorage.setItem('litalk-lang', lang); applyLanguage(); });
  document.querySelector('[data-next="question"]').addEventListener('click', () => showStep('question'));
  byId('custom-question').addEventListener('input', (event) => text(byId('question-count'), event.target.value.length));
  byId('choose-cards').addEventListener('click', () => { if (!category) { text(byId('question-error'), lang === 'th' ? 'กรุณาเลือกหัวข้อก่อน' : 'Please choose a topic first.'); return; } selected = []; revealed = new Set(); deck = shuffledDeck(); renderDeck(); showStep('cards'); });
  byId('confirm-cards').addEventListener('click', () => { if (selected.length !== 3) return; revealed = new Set(); renderRevealCards(); showStep('reveal'); });
  byId('read-fortune').addEventListener('click', requestReading); byId('retry-reading').addEventListener('click', requestReading);
  byId('read-again').addEventListener('click', () => { category = ''; selected = []; revealed = new Set(); deck = shuffledDeck(); byId('custom-question').value = ''; text(byId('question-count'), '0'); renderQuestions(); showStep('question'); });
  byId('share-reading').addEventListener('click', async () => { const data = { title: 'TCAS Fortune · LITALK', text: lang === 'th' ? 'ฉันเปิดไพ่ TCAS กับ LITALK แล้ว ✨' : 'I opened my TCAS Fortune with LITALK ✨', url: 'https://litalkeducation.com/tcas-fortune/' }; if (navigator.share) await navigator.share(data).catch(() => {}); else await navigator.clipboard.writeText(`${data.text} ${data.url}`); });
  applyLanguage();
}());
