'use strict';

const menu = document.querySelector('.menu-button');
const navLinks = document.querySelector('.nav-links');
menu?.addEventListener('click', () => {
  const open = menu.getAttribute('aria-expanded') !== 'true';
  menu.setAttribute('aria-expanded', String(open));
  navLinks.classList.toggle('open', open);
  document.body.classList.toggle('menu-open', open);
});
navLinks?.querySelectorAll('a').forEach(link => link.addEventListener('click', () => {
  menu?.setAttribute('aria-expanded', 'false');
  navLinks.classList.remove('open');
  document.body.classList.remove('menu-open');
}));

const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
if (!reducedMotion && 'IntersectionObserver' in window) {
  const observer = new IntersectionObserver(entries => entries.forEach(entry => {
    if (entry.isIntersecting) {
      entry.target.classList.add('visible');
      observer.unobserve(entry.target);
    }
  }), { threshold: .12, rootMargin: '0px 0px -40px' });
  document.querySelectorAll('.reveal').forEach(item => observer.observe(item));
} else {
  document.querySelectorAll('.reveal').forEach(item => item.classList.add('visible'));
}

const showcaseContent = {
  learn: ['01 / 05', 'Lessons made to stick.', 'Clear explanations, useful examples, and just enough challenge to keep you moving.', 'EVERYDAY ENGLISH · A2', 'Making plans<br>with friends'],
  speak: ['02 / 05', 'Speak without the pressure.', 'Practice out loud and get friendly feedback on clarity, rhythm, and pronunciation.', 'SPEAKING PRACTICE · B1', 'Sound clear<br>and confident'],
  listen: ['03 / 05', 'Tune into real English.', 'Short stories and conversations train your ears for the way people actually speak.', 'LISTENING · A2', 'Catch every<br>important word'],
  practice: ['04 / 05', 'Make practice feel like play.', 'Quick challenges help new words and grammar become second nature.', 'QUICK CHALLENGE · B1', 'Choose the most<br>natural phrase'],
  progress: ['05 / 05', 'Progress you can feel.', 'See every minute, word, and conversation add up to real confidence.', 'YOUR WEEK · ON TRACK', 'A little better<br>every day']
};
const showcaseContentTh = {
  learn: ['01 / 05', 'บทเรียนที่จำได้จริง', 'คำอธิบายชัดเจน ตัวอย่างใช้ได้จริง และความท้าทายที่พอดี', 'ภาษาอังกฤษในชีวิตประจำวัน · A2', 'นัดหมาย<br>กับเพื่อน'],
  speak: ['02 / 05', 'พูดได้โดยไม่กดดัน', 'ฝึกพูดออกเสียง พร้อมคำแนะนำเรื่องความชัดเจน จังหวะ และการออกเสียง', 'ฝึกพูด · B1', 'พูดชัด<br>และมั่นใจ'],
  listen: ['03 / 05', 'ฟังภาษาอังกฤษจริง', 'เรื่องสั้นและบทสนทนาช่วยให้คุ้นเคยกับภาษาที่ผู้คนใช้จริง', 'ฝึกฟัง · A2', 'ฟังคำสำคัญ<br>ได้ครบ'],
  practice: ['04 / 05', 'ฝึกให้สนุกเหมือนเล่น', 'กิจกรรมสั้น ๆ ช่วยให้คำศัพท์และไวยากรณ์เป็นธรรมชาติ', 'กิจกรรมสั้น · B1', 'เลือกประโยค<br>ที่เป็นธรรมชาติ'],
  progress: ['05 / 05', 'เห็นความก้าวหน้าชัดเจน', 'ทุกนาที ทุกคำ และทุกบทสนทนารวมกันเป็นความมั่นใจ', 'สัปดาห์นี้ · ตามเป้าหมาย', 'เก่งขึ้น<br>ทุกวัน']
};
document.querySelectorAll('.product-tabs button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.product-tabs button').forEach(item => item.setAttribute('aria-selected', String(item === button)));
  const stage = document.querySelector('.product-stage');
  const data = (language === 'th' ? showcaseContentTh : showcaseContent)[button.dataset.tab];
  stage.classList.add('switching');
  setTimeout(() => {
    stage.querySelector('.stage-number').textContent = data[0];
    stage.querySelector('.stage-copy h3').textContent = data[1];
    stage.querySelector('.stage-copy p').textContent = data[2];
    stage.querySelector('.app-main small').textContent = data[3];
    stage.querySelector('.app-main h4').innerHTML = data[4];
    stage.classList.remove('switching');
  }, reducedMotion ? 0 : 160);
}));

const goalCopy = { Travel: ['Feel at home, wherever you go.', 'เดินทางอย่างมั่นใจไม่ว่าจะไปที่ไหน'], Study: ['Learn, contribute, and achieve in English.', 'เรียน แสดงความเห็น และประสบความสำเร็จด้วยภาษาอังกฤษ'], Work: ['Communicate your ideas with confidence.', 'สื่อสารความคิดของคุณอย่างมั่นใจ'], Conversation: ['Turn everyday moments into easy conversations.', 'เปลี่ยนทุกช่วงเวลาให้เป็นบทสนทนาที่ง่ายขึ้น'] };
document.querySelectorAll('.goal-options button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.goal-options button').forEach(item => item.setAttribute('aria-selected', String(item === button)));
  document.querySelector('#goal-name').textContent = button.dataset.goal;
  document.querySelector('#goal-copy').textContent = goalCopy[button.dataset.goal][language === 'th' ? 1 : 0];
}));

document.querySelector('.play')?.addEventListener('click', event => {
  const playing = event.currentTarget.classList.toggle('playing');
  event.currentTarget.textContent = playing ? 'Ⅱ' : '▶';
  event.currentTarget.setAttribute('aria-label', playing ? 'Pause episode' : 'Play episode');
});

let language = localStorage.getItem('litalk-lang') || 'en';
const applyLanguage = lang => {
  language = lang;
  document.documentElement.lang = lang === 'th' ? 'th' : 'en';
  localStorage.setItem('litalk-lang', lang);
  document.querySelectorAll('[data-en][data-th]').forEach(element => {
    element.textContent = element.dataset[lang];
  });
  translatedNodes.forEach(({ node, english, key }) => {
    node.nodeValue = lang === 'th' ? english.replace(key, thai[key]) : english;
  });
  const languageButton = document.querySelector('.language-button');
  languageButton?.setAttribute('aria-pressed', String(lang === 'th'));
  if (languageButton) languageButton.textContent = lang === 'th' ? 'ไทย / EN' : 'EN / ไทย';
  document.querySelector('.product-tabs [aria-selected="true"]')?.click();
  const activeGoal = document.querySelector('.goal-options [aria-selected="true"]');
  if (activeGoal) document.querySelector('#goal-copy').textContent = goalCopy[activeGoal.dataset.goal][lang === 'th' ? 1 : 0];
  const placeholders = lang === 'th'
    ? ['ชื่อของคุณ', 'you@email.com', 'บอกเราเกี่ยวกับเป้าหมายของคุณ...']
    : ['Nattaporn S.', 'you@email.com', 'Tell us what you want to achieve...'];
  ['#form-name', '#form-email', '#form-message'].forEach((selector, index) => {
    const field = document.querySelector(selector);
    if (field) field.placeholder = placeholders[index];
  });
  document.dispatchEvent(new CustomEvent('litalk:langchange', { detail: { lang } }));
};
window.litalkGetLang = () => language;
document.querySelector('.language-button')?.addEventListener('click', () => applyLanguage(language === 'en' ? 'th' : 'en'));
applyLanguage(language);
