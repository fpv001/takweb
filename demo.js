// Demo del panel tak! con datos ficticios. Montos en centavos, como en el panel real.
const demo = document.querySelector('[data-demo]');
if (demo) {
  const panel = demo.querySelector('[data-demo-panel]');
  const toast = demo.querySelector('[data-demo-toast]');
  const tabs = [...demo.querySelectorAll('[data-tab]')];
  const simulate = document.querySelector('[data-demo-simulate]');
  const { anime } = window;
  const animate = anime && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const team = [
    { id: 'carlos', nombre: 'Carlos Méndez', puesto: 'Recepción' },
    { id: 'maria', nombre: 'María López', puesto: 'Restaurante' },
    { id: 'ana', nombre: 'Ana Ruiz', puesto: 'Concierge' },
    { id: 'diego', nombre: 'Diego Torres', puesto: 'Bar de alberca' },
    { id: 'lucia', nombre: 'Lucía Herrera', puesto: 'Housekeeping' },
    { id: 'jorge', nombre: 'Jorge Castillo', puesto: 'Valet' },
  ];
  const comments = [
    'Nos hizo sentir en casa desde que llegamos.',
    'Súper atenta con los niños, gracias por todo.',
    'Las mejores recomendaciones de la zona.',
    'Rápido y siempre con una sonrisa.',
    'La habitación impecable todos los días.',
    'Cuidó cada detalle de nuestra cena.',
    'Nos resolvió el traslado en minutos.',
    'Increíble servicio, volveremos pronto.',
  ];
  const hour = 3600000;
  const now = Date.now();
  const reviews = [
    ['carlos', 5, 0, 5000, 0.4], ['maria', 5, 5, 10000, 1.2], ['ana', 5, 2, 0, 2.5], ['diego', 4, 3, 5000, 4],
    ['lucia', 5, 4, 2000, 6], ['jorge', 5, 6, 0, 9], ['maria', 4, 7, 5000, 14], ['carlos', 5, 1, 10000, 20],
    ['ana', 5, 7, 0, 26], ['lucia', 4, 4, 5000, 31], ['diego', 5, 3, 2000, 40], ['maria', 5, 5, 20000, 52],
  ].map(([colaborador, estrellas, comment, propina, hoursAgo], index) => ({
    id: `r${index}`, colaborador, estrellas, comentario: comments[comment], propina, fecha: now - hoursAgo * hour,
  }));
  const base = { resenas: 116, sumaEstrellas: 556, propinasMes: 1752000, conPropina: 81 };
  const week = [14, 19, 16, 22, 18, 25, 21];

  let current = 'resumen';
  let fresh = null;

  const money = (cents) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cents / 100);
  const ago = (time) => {
    const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
    if (minutes < 60) return `hace ${minutes} min`;
    const hours = Math.round(minutes / 60);
    return hours < 24 ? `hace ${hours} h` : `hace ${Math.round(hours / 24)} d`;
  };
  const stars = (n) => `<span class="dash-stars" aria-label="${n} de 5 estrellas">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
  const person = (id) => team.find((member) => member.id === id);
  const initials = (name) => name.split(' ').map((part) => part[0]).join('').slice(0, 2);
  const avatar = (member) => `<span class="dash-avatar" aria-hidden="true">${initials(member.nombre)}</span>`;

  const totals = () => {
    const sumaEstrellas = base.sumaEstrellas + reviews.reduce((sum, review) => sum + review.estrellas, 0);
    const count = base.resenas + reviews.length;
    const tips = reviews.filter((review) => review.propina);
    return {
      count,
      rating: sumaEstrellas / count,
      propinas: base.propinasMes + tips.reduce((sum, review) => sum + review.propina, 0),
      conPropina: base.conPropina + tips.length,
    };
  };
  const byMember = () => team.map((member) => {
    const own = reviews.filter((review) => review.colaborador === member.id);
    const rating = own.length ? own.reduce((sum, review) => sum + review.estrellas, 0) / own.length : 0;
    return { ...member, count: own.length, rating, propinas: own.reduce((sum, review) => sum + review.propina, 0) };
  }).sort((a, b) => b.rating - a.rating || b.count - a.count);

  const kpi = (label, value, sub, featured = false) => `
    <div class="dash-kpi${featured ? ' is-featured' : ''}"><span>${label}</span><strong data-kpi>${value}</strong><small>${sub}</small></div>`;

  const reviewItem = (review) => {
    const member = person(review.colaborador);
    return `<li class="dash-review${review.id === fresh ? ' is-new' : ''}">
      ${avatar(member)}
      <div><p class="dash-review__top"><b>${member.nombre}</b><span>${member.puesto} · ${ago(review.fecha)}</span></p>
      ${stars(review.estrellas)}<p class="dash-review__text">“${review.comentario}”</p></div>
      ${review.propina ? `<span class="dash-chip">+ ${money(review.propina)}</span>` : ''}
    </li>`;
  };

  const views = {
    resumen() {
      const t = totals();
      const max = Math.max(...week);
      const days = ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'];
      return `
        <header class="dash-header"><div><h3>Hotel Casa Coral</h3><p>Así va tu hotel este mes</p></div><span class="dash-live">En vivo</span></header>
        <div class="dash-kpis">
          ${kpi('Calificación', `★ ${t.rating.toFixed(1)}`, `${t.count} reseñas`, true)}
          ${kpi('Reseñas este mes', t.count, 'de tus huéspedes')}
          ${kpi('Propinas este mes', money(t.propinas), `${t.conPropina} con propina`)}
          ${kpi('Equipo activo', team.length, 'colaboradores')}
        </div>
        <div class="dash-grid">
          <section class="dash-card"><h4>Reseñas de los últimos 7 días</h4>
            <div class="dash-bars">${week.map((value, index) => `<div><span style="--h:${(value / max) * 100}%" data-bar><b>${value}</b></span><small>${days[index]}</small></div>`).join('')}</div>
          </section>
          <section class="dash-card"><h4>Mejor calificados</h4>
            <ol class="dash-rank">${byMember().slice(0, 4).map((member, index) => `<li><span class="dash-rank__n">${index + 1}</span>${avatar(member)}<div><b>${member.nombre}</b><small>${member.puesto}</small></div><strong>★ ${member.rating.toFixed(1)}</strong></li>`).join('')}</ol>
          </section>
        </div>
        <section class="dash-card"><h4>Últimas reseñas</h4><ul class="dash-reviews">${reviews.slice(0, 3).map(reviewItem).join('')}</ul></section>`;
    },
    resenas() {
      const t = totals();
      const dist = [5, 4, 3, 2, 1].map((n) => ({ n, share: { 5: 0.82, 4: 0.14, 3: 0.03, 2: 0.01, 1: 0 }[n] }));
      return `
        <header class="dash-header"><div><h3>Reseñas</h3><p>Lo que dicen tus huéspedes, persona por persona</p></div></header>
        <div class="dash-grid dash-grid--reviews">
          <section class="dash-card dash-score"><strong>${t.rating.toFixed(1)}</strong>${stars(5)}<small>${t.count} reseñas</small>
            <ul class="dash-dist">${dist.map(({ n, share }) => `<li><span>${n}★</span><i style="--w:${share * 100}%" data-bar></i><small>${Math.round(share * 100)}%</small></li>`).join('')}</ul>
          </section>
          <section class="dash-card"><h4>Recientes</h4><ul class="dash-reviews">${reviews.slice(0, 5).map(reviewItem).join('')}</ul></section>
        </div>`;
    },
    equipo() {
      return `
        <header class="dash-header"><div><h3>Mi equipo</h3><p>Cada wristband, vinculada a una persona y su área</p></div></header>
        <section class="dash-card"><div class="dash-table" role="table" aria-label="Equipo">
          <div class="dash-row dash-row--head" role="row"><span role="columnheader">Colaborador</span><span role="columnheader">Reseñas</span><span role="columnheader">Calificación</span><span role="columnheader">Propinas</span></div>
          ${byMember().map((member) => `<div class="dash-row" role="row"><span role="cell" class="dash-who">${avatar(member)}<span><b>${member.nombre}</b><small>${member.puesto}</small></span></span><span role="cell">${member.count}</span><span role="cell" class="dash-rate">★ ${member.rating.toFixed(1)}</span><span role="cell">${money(member.propinas)}</span></div>`).join('')}
        </div></section>`;
    },
    propinas() {
      const t = totals();
      const tips = reviews.filter((review) => review.propina);
      return `
        <header class="dash-header"><div><h3>Propinas</h3><p>Opcionales, registradas a nombre de quien las recibió</p></div></header>
        <div class="dash-kpis dash-kpis--3">
          ${kpi('Este mes', money(t.propinas), `${t.conPropina} propinas`, true)}
          ${kpi('Promedio', money(t.propinas / t.conPropina), 'por propina')}
          ${kpi('Con reseña', `${Math.round((t.conPropina / t.count) * 100)}%`, 'dejan también propina')}
        </div>
        <section class="dash-card"><h4>Movimientos recientes</h4>
          <ul class="dash-tips">${tips.slice(0, 6).map((review, index) => {
            const member = person(review.colaborador);
            return `<li class="${review.id === fresh ? 'is-new' : ''}">${avatar(member)}<div><b>${member.nombre}</b><small>${member.puesto} · ${ago(review.fecha)}</small></div><span class="dash-state${index > 1 ? ' is-paid' : ''}">${index > 1 ? 'Pagada' : 'En proceso'}</span><strong>${money(review.propina)}</strong></li>`;
          }).join('')}</ul>
        </section>`;
    },
  };

  const render = (enter = false) => {
    panel.innerHTML = views[current]();
    if (!animate) return;
    if (enter) anime({ targets: panel.children, opacity: [0, 1], translateY: [14, 0], delay: anime.stagger(60), duration: 600, easing: 'easeOutCubic' });
    anime({ targets: panel.querySelectorAll('[data-bar]'), scaleY: [0, 1], scaleX: [0, 1], delay: anime.stagger(50), duration: 800, easing: 'easeOutExpo' });
  };

  const select = (tab, focus = false) => {
    current = tab.dataset.tab;
    tabs.forEach((item) => {
      const selected = item === tab;
      item.setAttribute('aria-selected', String(selected));
      item.tabIndex = selected ? 0 : -1;
    });
    if (focus) tab.focus();
    render(true);
  };
  tabs.forEach((tab, index) => {
    tab.addEventListener('click', () => select(tab));
    tab.addEventListener('keydown', (event) => {
      const last = tabs.length - 1;
      const next = { ArrowDown: index === last ? 0 : index + 1, ArrowRight: index === last ? 0 : index + 1, ArrowUp: index === 0 ? last : index - 1, ArrowLeft: index === 0 ? last : index - 1, Home: 0, End: last }[event.key];
      if (next === undefined) return;
      event.preventDefault();
      select(tabs[next], true);
    });
  });

  let toastTimer = 0;
  let turn = 0;
  simulate?.addEventListener('click', () => {
    const member = team[turn % team.length];
    const propina = [5000, 0, 10000, 2000][turn % 4];
    turn += 1;
    const review = { id: `n${turn}`, colaborador: member.id, estrellas: 5, comentario: comments[(turn * 3) % comments.length], propina, fecha: Date.now() };
    reviews.unshift(review);
    week[week.length - 1] += 1;
    fresh = review.id;
    if (current === 'equipo') select(tabs[0]); else render();

    toast.innerHTML = `<span class="dash-toast__dot"></span><div><b>Nueva reseña para ${member.nombre.split(' ')[0]}</b><span>★★★★★${propina ? ` · + ${money(propina)}` : ''}</span></div>`;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);

    if (!animate) return;
    anime({ targets: toast, translateY: [-16, 0], opacity: [0, 1], duration: 700, easing: 'easeOutElastic(1, .7)' });
    anime({ targets: panel.querySelectorAll('.is-new'), backgroundColor: ['#ffe1dd', '#ffffff'], translateX: [-12, 0], duration: 1600, easing: 'easeOutExpo' });
    anime({ targets: panel.querySelectorAll('.dash-kpi.is-featured, .dash-kpi:nth-child(2)'), scale: [1.04, 1], duration: 900, easing: 'easeOutElastic(1, .5)' });
  });

  render();
}
