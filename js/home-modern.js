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

const recordButton = document.querySelector('.record-button');
recordButton?.addEventListener('click', () => {
  const recording = recordButton.classList.toggle('recording');
  recordButton.querySelector('b').textContent = recording ? (language === 'th' ? 'กำลังฟัง… แตะเพื่อหยุด' : 'Listening… tap to stop') : (language === 'th' ? 'แตะเพื่อพูด' : 'Tap to speak');
  recordButton.setAttribute('aria-label', recording ? 'Stop speaking practice' : 'Start speaking practice');
});

const speeds = ['1×', '1.25×', '1.5×', '.75×'];
document.querySelector('.speed-button')?.addEventListener('click', event => {
  event.currentTarget.textContent = speeds[(speeds.indexOf(event.currentTarget.textContent) + 1) % speeds.length];
});

const audioDetails = {
  transcript: ['Transcript', 'People often think small talk is unimportant. But a simple question can be the beginning of a real connection.'],
  vocabulary: ['Vocabulary', 'small talk · casual conversation  •  connection · a relationship between people  •  natural · relaxed and normal']
};
document.querySelectorAll('[data-audio-panel]').forEach(button => button.addEventListener('click', () => {
  const panel = document.querySelector('#audio-panel');
  const [title, copy] = audioDetails[button.dataset.audioPanel];
  document.querySelector('#audio-panel-title').textContent = title;
  document.querySelector('#audio-panel-copy').textContent = copy;
  panel.hidden = false;
}));
document.querySelector('.audio-panel-head button')?.addEventListener('click', () => {
  document.querySelector('#audio-panel').hidden = true;
});

let language = localStorage.getItem('litalk-lang') || 'en';
const thai = {
  'Learn':'เรียนรู้','Ways to learn':'รูปแบบการเรียน','Courses':'คอร์ส','Practice':'ฝึกฝน','Resources':'แหล่งเรียนรู้','About':'เกี่ยวกับเรา','Log in':'เข้าสู่ระบบ','Start learning':'เริ่มเรียน',
  'English for real life':'ภาษาอังกฤษเพื่อชีวิตจริง','English that':'ภาษาอังกฤษที่','works for you.':'ใช่สำหรับคุณ','Real conversations, focused lessons, and practical activities designed for the life you actually live.':'บทสนทนาจริง บทเรียนที่กระชับ และกิจกรรมที่ใช้ได้ในชีวิตประจำวัน','Start learning free':'เริ่มเรียนฟรี','Explore LITALK':'รู้จัก LITALK','from happy learners':'จากผู้เรียนของเรา',
  'The LITALK method':'วิธีเรียนแบบ LITALK','Learn. Practice.':'เรียน ฝึกฝน','Use it.':'นำไปใช้','One simple system that takes you from knowing the words to confidently saying them.':'ระบบง่าย ๆ ที่พาคุณจากการรู้คำศัพท์ไปสู่การพูดอย่างมั่นใจ','Build your foundation through short, focused lessons that fit your day.':'สร้างพื้นฐานด้วยบทเรียนสั้น กระชับ และเข้ากับวันของคุณ','Turn what you know into communication with instant, helpful feedback.':'เปลี่ยนความรู้เป็นการสื่อสาร พร้อมคำแนะนำทันที','Feel ready for the real moments that matter to you.':'พร้อมใช้ภาษาอังกฤษในทุกช่วงเวลาสำคัญ',
  'Everything in one place':'ครบทุกอย่างในที่เดียว','Everything you need':'ทุกสิ่งที่คุณต้องการ','to get better.':'เพื่อเก่งขึ้น','A complete learning experience that keeps every lesson useful, clear, and enjoyable.':'ประสบการณ์เรียนรู้ที่ชัดเจน ใช้ได้จริง และสนุก','Speak':'พูด','Listen':'ฟัง','Progress':'ความก้าวหน้า','Explore lessons':'ดูบทเรียน',
  'Real LITALK services':'บริการจริงจาก LITALK','Online Learning':'เรียนออนไลน์','1-on-1 English':'เรียนสดตัวต่อตัว','Browse courses':'ดูคอร์ส','Explore LITALK+':'ดู LITALK+','View tutoring plans':'ดูแพ็กเกจเรียนสด','Find something':'ค้นหาสิ่งที่','worth learning.':'คุ้มค่าที่จะเรียน','View all courses':'ดูคอร์สทั้งหมด',
  'Practice until it':'ฝึกจนกระทั่ง','feels natural.':'เป็นธรรมชาติ','Try a challenge':'ลองทำกิจกรรม','Learn English':'เรียนภาษาอังกฤษ','with your ears.':'ผ่านการฟัง','Your progress':'ความก้าวหน้าของคุณ','See yourself':'เห็นตัวเอง','getting better.':'เก่งขึ้นทุกวัน','Made personal':'ออกแบบเพื่อคุณ','Your English.':'ภาษาอังกฤษของคุณ','Your way.':'ในแบบของคุณ','Keep learning.':'เรียนรู้ต่อไป','Explore all resources':'ดูแหล่งเรียนรู้ทั้งหมด','Talk to LITALK':'คุยกับ LITALK','Ready when you are':'พร้อมเมื่อคุณพร้อม','Your English':'ภาษาอังกฤษของคุณ','starts here.':'เริ่มต้นที่นี่','A better way to learn, practice, and actually use English.':'วิธีที่ดีกว่าในการเรียน ฝึกฝน และใช้ภาษาอังกฤษจริง',
  'Send message':'ส่งข้อความ','Your name':'ชื่อของคุณ','Email address':'อีเมล','I’m interested in':'สนใจบริการ','Your learning goal':'เป้าหมายการเรียน','Learn it. Live it.':'เรียนรู้ แล้วนำไปใช้','Blog':'บทความ','English tips':'เคล็ดลับภาษาอังกฤษ','Ask a word':'ถามคำศัพท์','Study guides':'คู่มือการเรียน','Contact':'ติดต่อ','Teacher portal':'ระบบสำหรับครู','Partners':'พาร์ตเนอร์','Privacy':'ความเป็นส่วนตัว','Terms':'ข้อกำหนด','Cookies':'คุกกี้'
};
const translatedNodes = [];
const walker = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
while (walker.nextNode()) {
  const node = walker.currentNode;
  const key = node.nodeValue.trim().replace(/[↗↓→]$/, '').trim();
  if (thai[key]) translatedNodes.push({ node, english: node.nodeValue, key });
}
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
};
document.querySelector('.language-button')?.addEventListener('click', () => applyLanguage(language === 'en' ? 'th' : 'en'));
applyLanguage(language);

const contactForm = document.querySelector('#contact-form');
contactForm?.addEventListener('submit', event => {
  event.preventDefault();
  if (!contactForm.reportValidity()) return;
  const submit = document.querySelector('#contact-submit');
  const status = contactForm.querySelector('.form-status');
  const values = new FormData(contactForm);
  const subject = language === 'th' ? `สอบถามข้อมูลจาก ${values.get('name')}` : `Inquiry from ${values.get('name')}`;
  const body = [`Name: ${values.get('name')}`, `Email: ${values.get('email')}`, `Program: ${values.get('program')}`, '', values.get('message')].join('\n');
  window.location.href = `mailto:support@litalkeducation.com?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  submit.disabled = true;
  status.textContent = language === 'th' ? 'กำลังเปิดโปรแกรมอีเมล…' : 'Opening your email app…';
  setTimeout(() => { submit.disabled = false; status.textContent = ''; }, 3000);
});
