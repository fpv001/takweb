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

  // Hero: el producto sigue al mouse con inercia, nunca en seco.
  const hero = document.querySelector('.hero');
  const pointerTarget = { x: 0, y: 0 };
  const pointerCurrent = { x: 0, y: 0 };
  let pointerFrame = 0;
  const easePointer = () => {
    pointerCurrent.x += (pointerTarget.x - pointerCurrent.x) * 0.045;
    pointerCurrent.y += (pointerTarget.y - pointerCurrent.y) * 0.045;
    hero.style.setProperty('--pointer-x', pointerCurrent.x.toFixed(4));
    hero.style.setProperty('--pointer-y', pointerCurrent.y.toFixed(4));
    const settled = Math.abs(pointerTarget.x - pointerCurrent.x) < 0.001 && Math.abs(pointerTarget.y - pointerCurrent.y) < 0.001;
    pointerFrame = settled ? 0 : window.requestAnimationFrame(easePointer);
  };
  const followPointer = () => { if (!pointerFrame) pointerFrame = window.requestAnimationFrame(easePointer); };
  hero.addEventListener('pointermove', (event) => {
    if (event.pointerType !== 'mouse') return;
    const bounds = hero.getBoundingClientRect();
    pointerTarget.x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    pointerTarget.y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;
    followPointer();
  });
  hero.addEventListener('pointerleave', () => {
    pointerTarget.x = 0;
    pointerTarget.y = 0;
    followPointer();
  });
}

// Scroll suavizado con inercia para rueda y trackpad en escritorio.
// En táctil y con reduced motion se conserva el scroll nativo.
const smoothScroll = (() => {
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  if (reducedMotion.matches || !finePointer.matches) return null;
  document.documentElement.classList.add('smooth-scroll');
  let target = window.scrollY;
  let current = target;
  let frame = 0;
  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const clamp = (value) => Math.max(0, Math.min(maxScroll(), value));
  const step = () => {
    current += (target - current) * 0.085;
    if (Math.abs(target - current) < 0.5) current = target;
    window.scrollTo({ top: current, behavior: 'instant' });
    frame = current === target ? 0 : window.requestAnimationFrame(step);
  };
  const run = () => { if (!frame) frame = window.requestAnimationFrame(step); };
  const sync = () => { target = current = window.scrollY; };

  window.addEventListener('wheel', (event) => {
    if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return;
    if (document.querySelector('dialog[open]') || event.target.closest('textarea')) return;
    event.preventDefault();
    if (!frame) sync();
    const unit = event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? window.innerHeight : 1;
    target = clamp(target + event.deltaY * unit);
    run();
  }, { passive: false });
  // Teclado, barra de scroll o búsqueda: el scroll nativo manda y se sincroniza.
  window.addEventListener('scroll', () => { if (!frame) sync(); }, { passive: true });
  window.addEventListener('resize', () => { target = clamp(target); });

  return {
    to(y) {
      if (!frame) sync();
      target = clamp(y);
      run();
    },
  };
})();

// Anclas internas: mismo desplazamiento suave que la rueda.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!smoothScroll || !link || link.matches('[data-dialog], .skip-link')) return;
  const hash = link.getAttribute('href');
  const target = hash === '#inicio' ? null : document.querySelector(hash);
  if (hash !== '#inicio' && !target) return;
  event.preventDefault();
  smoothScroll.to(target ? target.getBoundingClientRect().top + window.scrollY : 0);
  history.pushState(null, '', hash);
});

// Cómo funciona: pestañas "Para clientes / Para hoteles" con teclado (flechas, Inicio, Fin).
const audienceTabs = [...document.querySelectorAll('.audience-tab')];
const journeyTitle = document.getElementById('journey-title');
const selectAudience = (tab, focus = false) => {
  audienceTabs.forEach((item) => {
    const selected = item === tab;
    const panel = document.getElementById(item.getAttribute('aria-controls'));
    item.setAttribute('aria-selected', String(selected));
    item.tabIndex = selected ? 0 : -1;
    panel.hidden = !selected;
    if (selected) {
      panel.classList.remove('is-entering');
      void panel.offsetWidth;
      panel.classList.add('is-entering');
    }
  });
  journeyTitle.textContent = tab.dataset.title;
  if (focus) tab.focus();
};
audienceTabs.forEach((tab, index) => {
  tab.addEventListener('click', () => selectAudience(tab));
  tab.addEventListener('keydown', (event) => {
    const last = audienceTabs.length - 1;
    const next = { ArrowRight: index === last ? 0 : index + 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
    if (next === undefined) return;
    event.preventDefault();
    selectAudience(audienceTabs[next], true);
  });
});

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
