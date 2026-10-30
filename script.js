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
  document.querySelectorAll('.hero, #resenas, #beneficios, #contacto').forEach((section) => clearCurrent.observe(section));
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
}

// Cards con anime.js: entrada escalonada y respuesta al cursor.
const { anime } = window;
if (anime && !reducedMotion.matches && 'IntersectionObserver' in window) {
  document.documentElement.classList.add('anime-ready');
  const cardObserver = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (!entry.isIntersecting) return;
      cardObserver.unobserve(entry.target);
      anime({
        targets: entry.target.children,
        opacity: [0, 1],
        translateY: [32, 0],
        scale: [0.96, 1],
        delay: anime.stagger(70),
        duration: 900,
        easing: 'easeOutExpo',
        complete: () => [...entry.target.children].forEach((card) => { card.dataset.ready = ''; }),
      });
    });
  }, { rootMargin: '0px 0px -12% 0px' });
  document.querySelectorAll('.cards').forEach((list) => cardObserver.observe(list));

  document.querySelectorAll('.card').forEach((card) => {
    const icon = card.querySelector('.card-icon');
    card.addEventListener('pointermove', (event) => {
      const bounds = card.getBoundingClientRect();
      card.style.setProperty('--mx', `${event.clientX - bounds.left}px`);
      card.style.setProperty('--my', `${event.clientY - bounds.top}px`);
    });
    card.addEventListener('pointerenter', (event) => {
      if (event.pointerType !== 'mouse' || !('ready' in card.dataset)) return;
      anime.remove(card);
      anime({ targets: card, translateY: -6, duration: 700, easing: 'easeOutElastic(1, .6)' });
      if (!icon) return;
      anime.remove(icon);
      anime({
        targets: icon,
        rotate: [{ value: -12, duration: 160, easing: 'easeOutQuad' }, { value: 0, duration: 800, easing: 'easeOutElastic(1, .4)' }],
        scale: [{ value: 1.15, duration: 160, easing: 'easeOutQuad' }, { value: 1, duration: 800, easing: 'easeOutElastic(1, .4)' }],
      });
    });
    card.addEventListener('pointerleave', () => {
      if (!('ready' in card.dataset)) return;
      anime.remove(card);
      anime({ targets: card, translateY: 0, scale: 1, duration: 500, easing: 'easeOutQuart' });
    });
    card.addEventListener('pointerdown', () => {
      if (!('ready' in card.dataset)) return;
      anime.remove(card);
      anime({
        targets: card,
        scale: [{ value: 0.97, duration: 110, easing: 'easeOutQuad' }, { value: 1, duration: 600, easing: 'easeOutElastic(1, .5)' }],
      });
    });
  });
}

// Preguntas: abrir y cerrar con altura animada; sin anime.js, el details nativo.
document.querySelectorAll('.faq-list details').forEach((details) => {
  const summary = details.querySelector('summary');
  if (details.open) details.classList.add('is-open');
  summary.addEventListener('click', (event) => {
    if (!window.anime || reducedMotion.matches) {
      details.classList.toggle('is-open', !details.open);
      return;
    }
    event.preventDefault();
    const answer = details.querySelector('p');
    const start = details.offsetHeight;
    window.anime.remove([details, answer]);
    const opening = !details.classList.contains('is-open');
    details.classList.toggle('is-open', opening);
    details.open = true;
    const end = opening ? details.offsetHeight : summary.offsetHeight + details.offsetHeight - details.clientHeight;
    window.anime({
      targets: details,
      height: [start, end],
      duration: opening ? 520 : 420,
      easing: 'easeOutCubic',
      complete: () => {
        details.style.height = '';
        if (!opening) details.open = false;
      },
    });
    window.anime({ targets: answer, opacity: opening ? [0, 1] : 0, translateY: opening ? [-8, 0] : -8, duration: opening ? 520 : 260, easing: 'easeOutCubic' });
  });
});

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

// Formulario de contacto: registra al interesado en el panel de Atlas.
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
  submitButton.textContent = 'Enviando…';
  const { name, business, type, email, message } = form.elements;
  fetch('/api/lead', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ nombre: name.value, negocio: business.value, tipo: type.value, correo: email.value, mensaje: message.value }),
  })
    .then((r) => {
      if (!r.ok) throw new Error();
      form.reset();
      status.textContent = '¡Gracias! Te contactaremos muy pronto.';
    })
    .catch(() => { status.textContent = 'No pudimos enviar tus datos. Inténtalo de nuevo en un momento.'; })
    .finally(() => {
      submitButton.disabled = false;
      submitButton.textContent = 'Quiero conocer tak!';
    });
});
