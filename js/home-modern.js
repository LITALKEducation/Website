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
document.querySelectorAll('.product-tabs button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.product-tabs button').forEach(item => item.setAttribute('aria-selected', String(item === button)));
  const stage = document.querySelector('.product-stage');
  const data = showcaseContent[button.dataset.tab];
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

const goalCopy = { Travel: 'Feel at home, wherever you go.', Study: 'Learn, contribute, and achieve in English.', Work: 'Communicate your ideas with confidence.', Conversation: 'Turn everyday moments into easy conversations.' };
document.querySelectorAll('.goal-options button').forEach(button => button.addEventListener('click', () => {
  document.querySelectorAll('.goal-options button').forEach(item => item.setAttribute('aria-selected', String(item === button)));
  document.querySelector('#goal-name').textContent = button.dataset.goal;
  document.querySelector('#goal-copy').textContent = goalCopy[button.dataset.goal];
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
  document.querySelector('.language-button')?.setAttribute('aria-pressed', String(lang === 'th'));
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
