const menuButton = document.querySelector('.menu-button');
const navigation = document.querySelector('.site-nav');
const header = document.querySelector('.site-header');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const syncHeader = () => {
  const scrolled = window.scrollY > 24;
  header.classList.toggle('is-scrolled', scrolled);
  document.body.classList.toggle('is-header-hidden', scrolled);
  if (scrolled) {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  }
};

window.addEventListener('scroll', syncHeader, { passive: true });
syncHeader();

const motionSections = document.querySelectorAll('main > section');

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');
  const sceneObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      entry.target.classList.toggle('is-active', entry.isIntersecting);
    });
  }, { threshold: 0.42 });

  motionSections.forEach((section) => sceneObserver.observe(section));

  let scrollFrame = 0;
  const updateSceneProgress = () => {
    scrollFrame = 0;
    const viewportHeight = window.innerHeight;
    motionSections.forEach((section) => {
      const bounds = section.getBoundingClientRect();
      const rawProgress = (viewportHeight * 0.5 - (bounds.top + bounds.height * 0.5)) / viewportHeight;
      const progress = Math.max(-1, Math.min(1, rawProgress));
      section.style.setProperty('--scroll-progress', progress.toFixed(3));
    });
  };
  const requestSceneProgress = () => {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateSceneProgress);
  };
  window.addEventListener('scroll', requestSceneProgress, { passive: true });
  window.addEventListener('resize', requestSceneProgress);
  updateSceneProgress();

  const hero = document.querySelector('.hero');
  hero.addEventListener('pointermove', (event) => {
    const bounds = hero.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    hero.style.setProperty('--pointer-x', x.toFixed(3));
    hero.style.setProperty('--pointer-y', y.toFixed(3));
  });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--pointer-x', '0');
    hero.style.setProperty('--pointer-y', '0');
  });
}

menuButton.addEventListener('click', () => {
  const open = menuButton.getAttribute('aria-expanded') === 'true';
  menuButton.setAttribute('aria-expanded', String(!open));
  navigation.classList.toggle('is-open', !open);
});

navigation.addEventListener('click', (event) => {
  if (event.target.matches('a')) {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    menuButton.setAttribute('aria-expanded', 'false');
    navigation.classList.remove('is-open');
    menuButton.focus();
  }
});

const form = document.querySelector('.contact-form');
const status = document.querySelector('.form-status');

form.addEventListener('submit', (event) => {
  event.preventDefault();
  status.textContent = '';
  let valid = true;
  form.querySelectorAll('[required]').forEach((field) => {
    const message = field.type === 'checkbox' ? 'Confirma que leíste el aviso.' : 'Completa este campo.';
    const error = field.closest('.field')?.querySelector('.error');
    const failed = !field.checkValidity();
    field.setAttribute('aria-invalid', String(failed));
    if (error) error.textContent = failed ? (field.validity.typeMismatch ? 'Escribe un correo válido.' : message) : '';
    if (failed) valid = false;
  });
  if (!valid) {
    status.textContent = 'Revisa los campos marcados e inténtalo de nuevo.';
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  const button = form.querySelector('button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Preparando vista…';
  window.setTimeout(() => {
    button.disabled = false;
    button.textContent = 'Quiero conocer tak!';
    status.textContent = 'Vista completada. Tus datos no fueron enviados.';
  }, 650);
});
