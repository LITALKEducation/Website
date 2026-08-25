'use strict';

(function initTcasFortune() {
  const API = 'https://istudent.litalkeducation.com';
  const POSITIONS = [
    { id: 'current', th: 'สถานการณ์ปัจจุบัน', en: 'Current situation' },
    { id: 'challenge', th: 'สิ่งที่ต้องระวัง', en: 'Challenge / what to watch' },
    { id: 'guidance', th: 'คำแนะนำที่ควรโฟกัส', en: 'Guidance / what to focus on' },
  ];
  const CARDS = [
    ['fool','The Fool','✦'],['magician','The Magician','✧'],['high-priestess','The High Priestess','☾'],['empress','The Empress','❀'],['emperor','The Emperor','◆'],['hierophant','The Hierophant','⌂'],['lovers','The Lovers','♡'],['chariot','The Chariot','➤'],['strength','Strength','∞'],['hermit','The Hermit','◌'],['wheel','Wheel of Fortune','⊙'],['justice','Justice','⚖'],['hanged-man','The Hanged Man','◇'],['death','Death','△'],['temperance','Temperance','≈'],['devil','The Devil','♢'],['tower','The Tower','ϟ'],['star','The Star','★'],['moon','The Moon','☽'],['sun','The Sun','☀'],['judgement','Judgement','⌁'],['world','The World','◎'],
  ].map(([id,name,symbol]) => ({ id, name, symbol }));
  const QUESTIONS = [
    ['preparation','การเตรียมสอบช่วงนี้เป็นอย่างไร','How is my preparation going?'],['focus','ตอนนี้ควรโฟกัสอะไร','What should I focus on now?'],['watch','สิ่งที่ต้องระวังในการเตรียม TCAS','What should I watch in my TCAS preparation?'],['energy','พลังงานก่อนสอบของฉัน','My energy before the exam'],['faculty','คณะที่กำลังเล็งไว้ — ฉันควรเตรียมตัวยังไง','How should I prepare for my target faculty?'],['exams','TGAT / TPAT / A-Level ช่วงนี้ควรเน้นอะไร','What should I prioritise for TGAT / TPAT / A-Level?'],
  ];
  let lang = localStorage.getItem('litalk_lang') === 'en' ? 'en' : 'th';
  let category = '';
  let selected = [];
  let revealed = 0;

  const byId = (id) => document.getElementById(id);
  const text = (node, value) => { node.textContent = value == null ? '' : String(value); };
  function applyLanguage() {
    document.documentElement.lang = lang;
    document.documentElement.dataset.lang = lang;
    document.querySelectorAll('[data-th][data-en]').forEach((node) => text(node, node.dataset[lang]));
    document.querySelectorAll('[data-placeholder-th]').forEach((node) => { node.placeholder = node.dataset[`placeholder${lang === 'th' ? 'Th' : 'En'}`]; });
    text(byId('fortune-lang'), lang === 'th' ? 'EN' : 'ไทย');
    renderQuestions();
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
    byId(`step-${id}`).focus?.(); window.scrollTo({ top: 0, behavior: 'smooth' });
  }
  function secureSpread() {
    const pool = [...CARDS];
    for (let i = pool.length - 1; i > 0; i -= 1) {
      const max = Math.floor(0x100000000 / (i + 1)) * (i + 1); let value;
      do { value = crypto.getRandomValues(new Uint32Array(1))[0]; } while (value >= max);
      const index = value % (i + 1); [pool[i], pool[index]] = [pool[index], pool[i]];
    }
    return pool.slice(0, 3);
  }
  function renderCards() {
    revealed = 0; byId('read-fortune').hidden = true;
    byId('fortune-cards').replaceChildren(...selected.map((card, index) => {
      const button = document.createElement('button'); button.type = 'button'; button.className = 'fortune-card-button';
      button.setAttribute('aria-label', `${lang === 'th' ? 'เปิดไพ่ตำแหน่ง' : 'Reveal card for'} ${POSITIONS[index][lang]}`);
      const inner = document.createElement('span'); inner.className = 'fortune-card-inner';
      const front = document.createElement('span'); front.className = 'fortune-card-face';
      const mark = document.createElement('span'); mark.className = 'fortune-symbol'; text(mark, '✦');
      const hint = document.createElement('span'); text(hint, lang === 'th' ? 'แตะเพื่อเปิด' : 'Tap to reveal'); front.append(mark, hint);
      const back = document.createElement('span'); back.className = 'fortune-card-face fortune-card-face--back';
      const symbol = document.createElement('span'); symbol.className = 'fortune-symbol'; text(symbol, card.symbol);
      const name = document.createElement('strong'); text(name, card.name);
      const position = document.createElement('span'); position.className = 'fortune-position'; text(position, POSITIONS[index][lang]); back.append(symbol, name, position); inner.append(front, back); button.append(inner);
      button.addEventListener('click', () => { if (button.classList.contains('is-revealed')) return; button.classList.add('is-revealed'); revealed += 1; button.setAttribute('aria-label', `${card.name}, ${POSITIONS[index][lang]}`); if (revealed === 3) byId('read-fortune').hidden = false; });
      return button;
    }));
  }
  function errorCopy(code) {
    const map = {
      region_not_supported: ['ฟีเจอร์นี้เปิดให้ใช้งานในประเทศไทยเท่านั้น 🇹🇭','TCAS Fortune is currently available in Thailand only.'],
      rate_limited: ['วันนี้เปิดไพ่ครบจำนวนแล้ว กลับมาใหม่พรุ่งนี้นะ','You have reached today’s reading limit. Please return tomorrow.'],
      feature_disabled: ['TCAS Fortune ปิดให้บริการชั่วคราว','TCAS Fortune is temporarily disabled.'], maintenance: ['กำลังปรับปรุงประสบการณ์เปิดไพ่ โปรดลองใหม่ภายหลัง','We are polishing the experience. Please try again later.'],
      invalid_question: ['กรุณาตรวจสอบคำถามแล้วลองใหม่','Please check your question and try again.'], invalid_cards: ['ข้อมูลไพ่ไม่ถูกต้อง กรุณาเปิดไพ่ใหม่','The card spread is invalid. Please start again.'],
    };
    return (map[code] || ['ตอนนี้คำแนะนำจาก AI ยังไม่พร้อม ลองใหม่อีกครั้งในอีกสักครู่ ไพ่ของคุณยังอยู่ครบ','AI guidance is temporarily unavailable. Please retry; your cards are still here.'])[lang === 'th' ? 0 : 1];
  }
  async function requestReading() {
    showStep('result'); byId('fortune-loading').hidden = false; byId('fortune-error').hidden = true; byId('fortune-result').hidden = true;
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 30000);
    try {
      const response = await fetch(`${API}/tcas-fortune/readings`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, signal: controller.signal, body: JSON.stringify({ category, question: byId('custom-question').value.trim(), language: lang, cards: selected.map((card, index) => ({ card_id: card.id, card_name: card.name, position: POSITIONS[index].id })) }) });
      const data = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(data.error || 'network'); renderResult(data.reading);
    } catch (error) {
      byId('fortune-loading').hidden = true; byId('fortune-error').hidden = false; text(byId('error-title'), lang === 'th' ? 'ยังอ่านคำแนะนำไม่ได้' : 'Guidance is not available yet'); text(byId('error-copy'), errorCopy(error.message));
    } finally { clearTimeout(timeout); }
  }
  function renderResult(reading) {
    byId('fortune-loading').hidden = true; byId('fortune-result').hidden = false;
    text(byId('result-title'), reading.headline); text(byId('result-overall'), reading.overall_message); text(byId('result-focus'), reading.focus_today); text(byId('result-encouragement'), reading.encouragement); text(byId('result-disclaimer'), reading.disclaimer);
    byId('result-cards').replaceChildren(...selected.map((card, index) => {
      const item = reading.cards?.find((entry) => entry.card_id === card.id) || {}; const article = document.createElement('article'); article.className = 'fortune-result-card';
      const symbol = document.createElement('div'); symbol.className = 'fortune-symbol'; text(symbol, card.symbol); const heading = document.createElement('h3'); text(heading, card.name); const pos = document.createElement('p'); pos.className = 'fortune-position'; text(pos, POSITIONS[index][lang]); const interpretation = document.createElement('p'); text(interpretation, item.tcas_interpretation || item.meaning); const action = document.createElement('p'); action.className = 'fortune-action'; text(action, `${lang === 'th' ? 'ลงมือทำ' : 'Action'}: ${item.action || ''}`); article.append(symbol, heading, pos, interpretation, action); return article;
    }));
    const plan = lang === 'th' ? `ผล TCAS Fortune แนะนำให้โฟกัส: ${reading.focus_today} ช่วยสร้างแผนอ่าน 7 วันที่นำไปทำได้จริงให้หน่อย` : `My TCAS Fortune reflection suggested this focus: ${reading.focus_today}. Please create a practical 7-day study plan.`;
    byId('ask-handoff').href = `../ask?prompt=${encodeURIComponent(plan)}`;
  }
  byId('fortune-lang').addEventListener('click', () => { lang = lang === 'th' ? 'en' : 'th'; localStorage.setItem('litalk_lang', lang); applyLanguage(); });
  document.querySelector('[data-next="question"]').addEventListener('click', () => showStep('question'));
  byId('custom-question').addEventListener('input', (event) => text(byId('question-count'), event.target.value.length));
  byId('choose-cards').addEventListener('click', () => { if (!category) { text(byId('question-error'), lang === 'th' ? 'กรุณาเลือกหัวข้อก่อน' : 'Please choose a topic first.'); return; } selected = secureSpread(); renderCards(); showStep('cards'); });
  byId('read-fortune').addEventListener('click', requestReading); byId('retry-reading').addEventListener('click', requestReading);
  byId('read-again').addEventListener('click', () => { category = ''; selected = []; byId('custom-question').value = ''; renderQuestions(); showStep('question'); });
  byId('share-reading').addEventListener('click', async () => { const data = { title: 'TCAS Fortune · LITALK', text: lang === 'th' ? 'ฉันเปิดไพ่ TCAS กับ LITALK แล้ว ✨' : 'I opened my TCAS Fortune with LITALK ✨', url: 'https://litalkeducation.com/tcas-fortune/' }; if (navigator.share) await navigator.share(data).catch(() => {}); else await navigator.clipboard.writeText(`${data.text} ${data.url}`); });
  applyLanguage();
})();
