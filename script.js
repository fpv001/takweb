const menuButton = document.querySelector('.menu-button');
const menuLabel = menuButton.querySelector('.sr-only');
const navigation = document.querySelector('.site-nav');
const header = document.querySelector('.site-header');
const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

const setMenu = (open) => {
  menuButton.setAttribute('aria-expanded', String(open));
  menuLabel.textContent = open ? 'Cerrar menú' : 'Abrir menú';
  navigation.classList.toggle('is-open', open);
};
const menuOpen = () => menuButton.getAttribute('aria-expanded') === 'true';

// Header: se retira al bajar y regresa en cuanto la persona sube.
let lastY = window.scrollY;
let headerFrame = 0;
const syncHeader = () => {
  headerFrame = 0;
  const y = window.scrollY;
  const delta = y - lastY;
  if (Math.abs(delta) < 6 && y > header.offsetHeight) return;
  const hide = y > header.offsetHeight && delta > 0 && !menuOpen() && !header.contains(document.activeElement);
  header.classList.toggle('is-hidden', hide);
  lastY = y;
};
window.addEventListener('scroll', () => {
  if (!headerFrame) headerFrame = window.requestAnimationFrame(syncHeader);
}, { passive: true });
header.addEventListener('focusin', () => header.classList.remove('is-hidden'));

// Navegación: marca la sección que ocupa el centro de la pantalla.
const navLinks = [...navigation.querySelectorAll('a[href^="#"]:not(.button)')];
const navTargets = navLinks.map((link) => document.querySelector(link.getAttribute('href'))).filter(Boolean);
if ('IntersectionObserver' in window) {
  const navObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      navLinks.forEach((link) => {
        if (link.getAttribute('href') === `#${entry.target.id}`) link.setAttribute('aria-current', 'true');
        else link.removeAttribute('aria-current');
      });
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  navTargets.forEach((target) => navObserver.observe(target));
  const clearCurrent = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) navLinks.forEach((link) => link.removeAttribute('aria-current'));
    });
  }, { rootMargin: '-45% 0px -50% 0px' });
  document.querySelectorAll('.hero, #confianza, #contacto').forEach((section) => clearCurrent.observe(section));
}

const motionSections = [...document.querySelectorAll('main > section')];

if (!reducedMotion.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('motion-ready');

  // Entrada única por escena: no se repite al volver.
  const sceneObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      entry.target.classList.add('is-active');
      sceneObserver.unobserve(entry.target);
    });
  }, { rootMargin: '0px 0px -18% 0px' });
  motionSections.forEach((section) => sceneObserver.observe(section));

  // Profundidad ligada al scroll: sólo se calcula en las escenas visibles.
  const visible = new Set();
  const visibilityObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => (entry.isIntersecting ? visible.add(entry.target) : visible.delete(entry.target)));
    requestSceneProgress();
  });
  motionSections.forEach((section) => visibilityObserver.observe(section));

  let scrollFrame = 0;
  const updateSceneProgress = () => {
    scrollFrame = 0;
    const viewportHeight = window.innerHeight;
    visible.forEach((section) => {
      const bounds = section.getBoundingClientRect();
      const rawProgress = (viewportHeight * 0.5 - (bounds.top + bounds.height * 0.5)) / viewportHeight;
      const progress = Math.max(-1, Math.min(1, rawProgress));
      section.style.setProperty('--scroll-progress', progress.toFixed(3));
    });
  };
  function requestSceneProgress() {
    if (!scrollFrame) scrollFrame = window.requestAnimationFrame(updateSceneProgress);
  }
  window.addEventListener('scroll', requestSceneProgress, { passive: true });
  window.addEventListener('resize', requestSceneProgress);

  const hero = document.querySelector('.hero');
  let pointerFrame = 0;
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse' || pointerFrame) return;
    pointerFrame = window.requestAnimationFrame(() => {
      pointerFrame = 0;
      const bounds = hero.getBoundingClientRect();
      const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
      const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
      hero.style.setProperty('--pointer-x', x.toFixed(3));
      hero.style.setProperty('--pointer-y', y.toFixed(3));
    });
  });
  hero.addEventListener('pointerleave', () => {
    hero.style.setProperty('--pointer-x', '0');
    hero.style.setProperty('--pointer-y', '0');
  });
}

// Menú móvil.
menuButton.addEventListener('click', () => setMenu(!menuOpen()));

navigation.addEventListener('click', (event) => {
  if (event.target.closest('a')) setMenu(false);
});

document.addEventListener('click', (event) => {
  if (menuOpen() && !header.contains(event.target)) setMenu(false);
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && menuOpen()) {
    setMenu(false);
    menuButton.focus();
  }
});

// Documentos legales: diálogo accesible; sin JS, el ancla sigue funcionando.
let dialogOrigin = null;
document.querySelectorAll('[data-dialog]').forEach((trigger) => {
  const dialog = document.getElementById(trigger.dataset.dialog);
  if (!dialog || typeof dialog.showModal !== 'function') return;
  trigger.addEventListener('click', (event) => {
    event.preventDefault();
    dialogOrigin = trigger;
    dialog.showModal();
  });
});
document.querySelectorAll('.legal-dialog').forEach((dialog) => {
  dialog.addEventListener('click', (event) => {
    if (event.target === dialog) dialog.close();
  });
  dialog.addEventListener('close', () => dialogOrigin?.focus());
});

// Formulario de demostración.
const form = document.querySelector('.contact-form');
const status = document.querySelector('.form-status');
const submitButton = form.querySelector('button[type="submit"]');
const requiredFields = [...form.querySelectorAll('[required]')];

const validateField = (field) => {
  const error = field.closest('.field')?.querySelector('.error');
  const failed = !field.checkValidity();
  let message = '';
  if (failed) {
    if (field.type === 'checkbox') message = 'Confirma que leíste el aviso.';
    else if (field.validity.typeMismatch) message = 'Escribe un correo válido.';
    else if (field.tagName === 'SELECT') message = 'Elige un tipo de negocio.';
    else message = 'Completa este campo.';
  }
  field.setAttribute('aria-invalid', String(failed));
  if (error) {
    error.id ||= `${field.name}-error`;
    error.textContent = message;
    field.setAttribute('aria-describedby', error.id);
  }
  return !failed;
};

// Tras un primer error, la corrección se confirma mientras la persona escribe.
requiredFields.forEach((field) => {
  const recheck = () => { if (field.getAttribute('aria-invalid') === 'true') validateField(field); };
  field.addEventListener('input', recheck);
  field.addEventListener('change', recheck);
});

form.addEventListener('submit', (event) => {
  event.preventDefault();
  status.textContent = '';
  const valid = requiredFields.map(validateField).every(Boolean);
  if (!valid) {
    status.textContent = 'Revisa los campos marcados e inténtalo de nuevo.';
    form.querySelector('[aria-invalid="true"]')?.focus();
    return;
  }
  // El campo trampa sólo lo completan bots: se descarta sin procesar.
  if (form.elements.website.value) return;
  submitButton.disabled = true;
  submitButton.textContent = 'Preparando vista…';
  window.setTimeout(() => {
    submitButton.disabled = false;
    submitButton.textContent = 'Quiero conocer tak!';
    status.textContent = 'Vista completada. Tus datos no fueron enviados.';
  }, 650);
});
