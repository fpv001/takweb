// Demo del panel tak! con datos ficticios. Montos en centavos, como en el panel real.
const demo = document.querySelector('[data-demo]');
if (demo) {
  const panel = demo.querySelector('[data-demo-panel]');
  const toast = demo.querySelector('[data-demo-toast]');
  const tabs = [...demo.querySelectorAll('[data-tab]')];
  const simulate = document.querySelector('[data-demo-simulate]');
  const { anime } = window;
  const animate = anime && !window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // Textos del demo en español e inglés (el idioma lo decide i18n.js).
  const TX = {
    es: {
      puestos: { carlos: 'Recepción', maria: 'Restaurante', ana: 'Concierge', diego: 'Bar de alberca', lucia: 'Housekeeping', jorge: 'Valet' },
      comments: [
        'Nos hizo sentir en casa desde que llegamos.',
        'Súper atenta con los niños, gracias por todo.',
        'Las mejores recomendaciones de la zona.',
        'Rápido y siempre con una sonrisa.',
        'La habitación impecable todos los días.',
        'Cuidó cada detalle de nuestra cena.',
        'Nos resolvió el traslado en minutos.',
        'Increíble servicio, volveremos pronto.',
      ],
      days: ['lun', 'mar', 'mié', 'jue', 'vie', 'sáb', 'dom'],
      ago: (n, unit) => `hace ${n} ${unit}`, min: 'min', h: 'h', d: 'd',
      starsLabel: (n) => `${n} de 5 estrellas`,
      resumenSub: 'Así va tu hotel este mes', live: 'En vivo',
      rating: 'Calificación', reviewsN: (n) => `${n} reseñas`, reviewsMonth: 'Reseñas este mes', fromGuests: 'de tus huéspedes',
      tipsMonth: 'Propinas este mes', withTip: (n) => `${n} con propina`, activeTeam: 'Equipo activo', members: 'colaboradores',
      last7: 'Reseñas de los últimos 7 días', topRated: 'Mejor calificados', latest: 'Últimas reseñas',
      reviewsTitle: 'Reseñas', reviewsSub: 'Lo que dicen tus huéspedes, persona por persona', recent: 'Recientes',
      teamTitle: 'Mi equipo', teamSub: 'Cada wristband, vinculada a una persona y su área', teamAria: 'Equipo',
      colMember: 'Colaborador', colReviews: 'Reseñas', colRating: 'Calificación', colTips: 'Propinas',
      tipsTitle: 'Propinas', tipsSub: 'Opcionales, registradas a nombre de quien las recibió',
      thisMonth: 'Este mes', tipsN: (n) => `${n} propinas`, average: 'Promedio', perTip: 'por propina',
      withReview: 'Con reseña', alsoTip: 'dejan también propina', movements: 'Movimientos recientes', paid: 'Pagada', processing: 'En proceso',
      newReview: (name) => `Nueva reseña para ${name}`,
    },
    en: {
      puestos: { carlos: 'Front desk', maria: 'Restaurant', ana: 'Concierge', diego: 'Pool bar', lucia: 'Housekeeping', jorge: 'Valet' },
      comments: [
        'Made us feel at home from the moment we arrived.',
        'So sweet with the kids, thank you for everything.',
        'The best recommendations in the area.',
        'Fast and always with a smile.',
        'Spotless room every single day.',
        'Took care of every detail of our dinner.',
        'Sorted out our transfer in minutes.',
        'Amazing service, we’ll be back soon.',
      ],
      days: ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'],
      ago: (n, unit) => `${n} ${unit} ago`, min: 'min', h: 'h', d: 'd',
      starsLabel: (n) => `${n} out of 5 stars`,
      resumenSub: 'How your hotel is doing this month', live: 'Live',
      rating: 'Rating', reviewsN: (n) => `${n} reviews`, reviewsMonth: 'Reviews this month', fromGuests: 'from your guests',
      tipsMonth: 'Tips this month', withTip: (n) => `${n} with a tip`, activeTeam: 'Active team', members: 'team members',
      last7: 'Reviews in the last 7 days', topRated: 'Top rated', latest: 'Latest reviews',
      reviewsTitle: 'Reviews', reviewsSub: 'What your guests say, person by person', recent: 'Recent',
      teamTitle: 'My team', teamSub: 'Every wristband, linked to a person and their area', teamAria: 'Team',
      colMember: 'Team member', colReviews: 'Reviews', colRating: 'Rating', colTips: 'Tips',
      tipsTitle: 'Tips', tipsSub: 'Optional, recorded in the name of who received them',
      thisMonth: 'This month', tipsN: (n) => `${n} tips`, average: 'Average', perTip: 'per tip',
      withReview: 'With a review', alsoTip: 'also leave a tip', movements: 'Recent activity', paid: 'Paid', processing: 'Processing',
      newReview: (name) => `New review for ${name}`,
    },
  };
  const tx = () => TX[window.takI18n?.lang === 'en' ? 'en' : 'es'];

  const team = [
    { id: 'carlos', nombre: 'Carlos Méndez' },
    { id: 'maria', nombre: 'María López' },
    { id: 'ana', nombre: 'Ana Ruiz' },
    { id: 'diego', nombre: 'Diego Torres' },
    { id: 'lucia', nombre: 'Lucía Herrera' },
    { id: 'jorge', nombre: 'Jorge Castillo' },
  ];
  const puesto = (member) => tx().puestos[member.id];
  const commentText = (index) => tx().comments[index];
  const COMMENT_COUNT = TX.es.comments.length;
  const hour = 3600000;
  const now = Date.now();
  const reviews = [
    ['carlos', 5, 0, 5000, 0.4], ['maria', 5, 5, 10000, 1.2], ['ana', 5, 2, 0, 2.5], ['diego', 4, 3, 5000, 4],
    ['lucia', 5, 4, 2000, 6], ['jorge', 5, 6, 0, 9], ['maria', 4, 7, 5000, 14], ['carlos', 5, 1, 10000, 20],
    ['ana', 5, 7, 0, 26], ['lucia', 4, 4, 5000, 31], ['diego', 5, 3, 2000, 40], ['maria', 5, 5, 20000, 52],
  ].map(([colaborador, estrellas, comment, propina, hoursAgo], index) => ({
    id: `r${index}`, colaborador, estrellas, comentario: comment, propina, fecha: now - hoursAgo * hour,
  }));
  const base = { resenas: 116, sumaEstrellas: 556, propinasMes: 1752000, conPropina: 81 };
  const week = [14, 19, 16, 22, 18, 25, 21];

  let current = 'resumen';
  let fresh = null;

  const money = (cents) => new Intl.NumberFormat('es-MX', { style: 'currency', currency: 'MXN', maximumFractionDigits: 0 }).format(cents / 100);
  const ago = (time) => {
    const l = tx();
    const minutes = Math.max(1, Math.round((Date.now() - time) / 60000));
    if (minutes < 60) return l.ago(minutes, l.min);
    const hours = Math.round(minutes / 60);
    return hours < 24 ? l.ago(hours, l.h) : l.ago(Math.round(hours / 24), l.d);
  };
  const stars = (n) => `<span class="dash-stars" aria-label="${tx().starsLabel(n)}">${'★'.repeat(n)}<i>${'★'.repeat(5 - n)}</i></span>`;
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
      <div><p class="dash-review__top"><b>${member.nombre}</b><span>${puesto(member)} · ${ago(review.fecha)}</span></p>
      ${stars(review.estrellas)}<p class="dash-review__text">“${commentText(review.comentario)}”</p></div>
      ${review.propina ? `<span class="dash-chip">+ ${money(review.propina)}</span>` : ''}
    </li>`;
  };

  const views = {
    resumen() {
      const t = totals();
      const l = tx();
      const max = Math.max(...week);
      return `
        <header class="dash-header"><div><h3>Hotel Casa Coral</h3><p>${l.resumenSub}</p></div><span class="dash-live">${l.live}</span></header>
        <div class="dash-kpis">
          ${kpi(l.rating, `★ ${t.rating.toFixed(1)}`, l.reviewsN(t.count), true)}
          ${kpi(l.reviewsMonth, t.count, l.fromGuests)}
          ${kpi(l.tipsMonth, money(t.propinas), l.withTip(t.conPropina))}
          ${kpi(l.activeTeam, team.length, l.members)}
        </div>
        <div class="dash-grid">
          <section class="dash-card"><h4>${l.last7}</h4>
            <div class="dash-bars">${week.map((value, index) => `<div><span style="--h:${(value / max) * 100}%" data-bar><b>${value}</b></span><small>${l.days[index]}</small></div>`).join('')}</div>
          </section>
          <section class="dash-card"><h4>${l.topRated}</h4>
            <ol class="dash-rank">${byMember().slice(0, 4).map((member, index) => `<li><span class="dash-rank__n">${index + 1}</span>${avatar(member)}<div><b>${member.nombre}</b><small>${puesto(member)}</small></div><strong>★ ${member.rating.toFixed(1)}</strong></li>`).join('')}</ol>
          </section>
        </div>
        <section class="dash-card"><h4>${l.latest}</h4><ul class="dash-reviews">${reviews.slice(0, 3).map(reviewItem).join('')}</ul></section>`;
    },
    resenas() {
      const t = totals();
      const l = tx();
      const dist = [5, 4, 3, 2, 1].map((n) => ({ n, share: { 5: 0.82, 4: 0.14, 3: 0.03, 2: 0.01, 1: 0 }[n] }));
      return `
        <header class="dash-header"><div><h3>${l.reviewsTitle}</h3><p>${l.reviewsSub}</p></div></header>
        <div class="dash-grid dash-grid--reviews">
          <section class="dash-card dash-score"><strong>${t.rating.toFixed(1)}</strong>${stars(5)}<small>${l.reviewsN(t.count)}</small>
            <ul class="dash-dist">${dist.map(({ n, share }) => `<li><span>${n}★</span><i style="--w:${share * 100}%" data-bar></i><small>${Math.round(share * 100)}%</small></li>`).join('')}</ul>
          </section>
          <section class="dash-card"><h4>${l.recent}</h4><ul class="dash-reviews">${reviews.slice(0, 5).map(reviewItem).join('')}</ul></section>
        </div>`;
    },
    equipo() {
      const l = tx();
      return `
        <header class="dash-header"><div><h3>${l.teamTitle}</h3><p>${l.teamSub}</p></div></header>
        <section class="dash-card"><div class="dash-table" role="table" aria-label="${l.teamAria}">
          <div class="dash-row dash-row--head" role="row"><span role="columnheader">${l.colMember}</span><span role="columnheader">${l.colReviews}</span><span role="columnheader">${l.colRating}</span><span role="columnheader">${l.colTips}</span></div>
          ${byMember().map((member) => `<div class="dash-row" role="row"><span role="cell" class="dash-who">${avatar(member)}<span><b>${member.nombre}</b><small>${puesto(member)}</small></span></span><span role="cell">${member.count}</span><span role="cell" class="dash-rate">★ ${member.rating.toFixed(1)}</span><span role="cell">${money(member.propinas)}</span></div>`).join('')}
        </div></section>`;
    },
    propinas() {
      const t = totals();
      const l = tx();
      const tips = reviews.filter((review) => review.propina);
      return `
        <header class="dash-header"><div><h3>${l.tipsTitle}</h3><p>${l.tipsSub}</p></div></header>
        <div class="dash-kpis dash-kpis--3">
          ${kpi(l.thisMonth, money(t.propinas), l.tipsN(t.conPropina), true)}
          ${kpi(l.average, money(t.propinas / t.conPropina), l.perTip)}
          ${kpi(l.withReview, `${Math.round((t.conPropina / t.count) * 100)}%`, l.alsoTip)}
        </div>
        <section class="dash-card"><h4>${l.movements}</h4>
          <ul class="dash-tips">${tips.slice(0, 6).map((review, index) => {
            const member = person(review.colaborador);
            return `<li class="${review.id === fresh ? 'is-new' : ''}">${avatar(member)}<div><b>${member.nombre}</b><small>${puesto(member)} · ${ago(review.fecha)}</small></div><span class="dash-state${index > 1 ? ' is-paid' : ''}">${index > 1 ? l.paid : l.processing}</span><strong>${money(review.propina)}</strong></li>`;
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
    const review = { id: `n${turn}`, colaborador: member.id, estrellas: 5, comentario: (turn * 3) % COMMENT_COUNT, propina, fecha: Date.now() };
    reviews.unshift(review);
    week[week.length - 1] += 1;
    fresh = review.id;
    if (current === 'equipo') select(tabs[0]); else render();

    toast.innerHTML = `<span class="dash-toast__dot"></span><div><b>${tx().newReview(member.nombre.split(' ')[0])}</b><span>★★★★★${propina ? ` · + ${money(propina)}` : ''}</span></div>`;
    toast.classList.add('is-visible');
    window.clearTimeout(toastTimer);
    toastTimer = window.setTimeout(() => toast.classList.remove('is-visible'), 3200);

    if (!animate) return;
    anime({ targets: toast, translateY: [-16, 0], opacity: [0, 1], duration: 700, easing: 'easeOutElastic(1, .7)' });
    anime({ targets: panel.querySelectorAll('.is-new'), backgroundColor: ['#ffe1dd', '#ffffff'], translateX: [-12, 0], duration: 1600, easing: 'easeOutExpo' });
    anime({ targets: panel.querySelectorAll('.dash-kpi.is-featured, .dash-kpi:nth-child(2)'), scale: [1.04, 1], duration: 900, easing: 'easeOutElastic(1, .5)' });
  });

  render();
  window.takI18n?.onChange(() => render());
}
