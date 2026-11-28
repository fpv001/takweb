// Idiomas de la landing: español (el HTML) e inglés (este diccionario).
// - data-i18n="clave": reemplaza el contenido del elemento.
// - data-i18n-attr="atributo:clave;atributo:clave": reemplaza atributos (placeholder, alt, aria-label).
// El español se toma del propio HTML al cargar, así que solo se escribe aquí el inglés.
// Si agregas texto a index.html, ponle data-i18n y su traducción en EN.
(() => {
  const STORE = 'tak:lang';

  const EN = {
    skip: 'Skip to content',
    'brand.aria': 'tak! — thanks are kind!, home',
    'lang.group': 'Language',
    'menu.open': 'Open menu',
    'nav.aria': 'Main navigation',
    'nav.products': 'Products',
    'nav.how': 'How it works',
    'nav.pricing': 'Pricing',
    'nav.demo': 'Demo',
    'nav.faq': 'FAQ',
    'nav.login': 'Sign in',
    'nav.waitlist': 'Waiting list',

    'soon.label': 'Coming soon',
    'soon.text': 'Official launch on the way',
    'soon.footer': 'Coming soon',
    'cta.join': 'Join our waiting list',

    'hero.title': 'A thank-you<br />that <em>gets there.</em>',
    'hero.text': 'Your customers leave a review for the person who served them with a tap on their wristband. And if they want, they add a tip. No cash, no app.',
    'hero.how': 'See how it works',
    'hero.p1': 'No app',
    'hero.p2': 'Any phone',
    'hero.p3': 'Optional tip',
    'hero.img': 'Hand holding a phone near a coral silicone tak! NFC wristband',
    'hero.f1': 'New review for Carlos',
    'hero.f1q': '“He made us feel at home.”',
    'hero.f2': 'Front desk',
    'hero.f3': '$50 tip',
    'hero.f3s': 'Optional',

    'prod.title': 'Two ways to receive <em>a thank-you.</em>',
    'prod.lead': 'Wristbands to recognize every person on your team. Docks so your customers can rate the place right from the table. Everything lands in the same dashboard.',
    'prod.band.img': 'Three silicone tak! NFC wristbands',
    'prod.band.tag': 'For your team',
    'prod.band.text': 'A silicone NFC wristband for each team member. Customers tap it with their phone and leave a review straight to that person.',
    'prod.band.t1': 'Review in the name of who served you',
    'prod.band.t2': 'Optional tip, no cash',
    'prod.band.t3': 'Linked to the person and their area',
    'prod.band.t4': 'Ideal for hotels, valet, spas and events',
    'prod.dock.img': 'Coral tak! dock holding a restaurant review card in its slot',
    'prod.dock.tag': 'For your restaurant',
    'prod.dock.text': 'An NFC stand for tables, bars or front desks. Customers tap it and rate their experience at the place, without downloading anything.',
    'prod.dock.t1': 'Venue reviews by table or location',
    'prod.dock.t2': 'Pick what you ate by photo and rate each dish',
    'prod.dock.t3': 'Takes customers to leave their Google review',
    'prod.dock.t4': 'Link with your business name and image',
    'prod.panel.title': 'tak! dashboard included',
    'prod.panel.text': 'Reviews, tips, dishes and locations in one place. Access for managers and for every team member, on the web or as an app on your phone.',
    'prod.panel.cta': 'See demo',

    'steps.title': 'Tap. Review. <em>Thank.</em>',
    'steps.1t': 'Tap your phone',
    'steps.1p': 'Tap the tak! wristband of the person who served you.',
    'steps.2t': 'Leave your review',
    'steps.2p': 'Rate them and share what they did well. If you want, add a tip.',
    'steps.3t': 'Confirm',
    'steps.3p': 'Check who it goes to before sending. Done.',

    'biz.title': 'Wherever there’s good service, there’s room for <em>a thank-you.</em>',
    'biz.lead': 'tak! fits any business where someone makes you feel well taken care of.',
    'biz.1t': 'Hotels', 'biz.1p': 'Front desk, bar, pool',
    'biz.2t': 'Restaurants', 'biz.2p': 'Servers and kitchen',
    'biz.3t': 'Bars and clubs', 'biz.3p': 'Bar and service',
    'biz.4t': 'Valet parking', 'biz.4p': 'First and last impression',
    'biz.5t': 'Gas stations', 'biz.5p': 'Attendants',
    'biz.6t': 'Cruises', 'biz.6p': 'Crew on board',
    'biz.7t': 'Spas and fitness', 'biz.7p': 'Therapists and coaches',
    'biz.8t': 'Events', 'biz.8p': 'Staff and production',

    'rev.title': 'Every thank-you <em>tells you something.</em>',
    'rev.text': 'Reviews reach both the person and the business. Your team knows what they do well, and you know what to repeat.',
    'rev.t1': 'Reviews by team member and area',
    'rev.t2': 'Real feedback, in the moment',
    'rev.t3': 'Tips, always optional',
    'rev.quote': '“She served us with incredible warmth. She made the whole trip worth it.”',
    'rev.for': '<strong>For María</strong> · Restaurant',
    'rev.week': 'This week’s reviews',
    'rev.a1': 'Front desk', 'rev.a2': 'Restaurant', 'rev.a3': 'Pool',
    'rev.note': 'Illustrative examples',

    'ben.title': 'More recognition for your team, <em>less friction</em> for your customers.',
    'ben.1t': 'Better reputation', 'ben.1p': 'Reviews show you your customers’ real experience, person by person.',
    'ben.2t': 'Motivated team', 'ben.2p': 'Direct, fair recognition that builds pride in belonging.',
    'ben.3t': 'Everything on record', 'ben.3p': 'Every review and every tip is saved with its person, date and context.',

    'price.title': 'A plan for every <em>team size.</em>',
    'price.lead': 'Monthly prices in Mexican pesos. Plans will be available at launch: join our waiting list and we’ll let you know first.',
    'price.b1': 'Starter', 'price.b2': 'Recommended',
    'price.month': 'MXN/month',
    'price.from': 'From',
    'price.1for': 'For hostels, salons, valet parking and small businesses.',
    'price.1l1': 'Dashboard with total tips and number of transactions.',
    'price.1l2': 'Basic analytics by employee and period.',
    'price.1l3': 'tak!-branded reports.',
    'price.1l4': '1 tak! dock included.',
    'price.2for': 'For mid-size hotels and businesses with several teams.',
    'price.2l1': 'Up to 100 active employees per month.',
    'price.2l2': 'Advanced analytics and tip trends.',
    'price.2l3': 'Comparisons by area, shift and employee.',
    'price.2l4': 'Customization with your venue’s logo and colors.',
    'price.2l5': 'Report exports and multiple administrators.',
    'price.nfc': 'NFC wristbands and docks quoted to your needs.',
    'price.3for': 'For large hotels, resorts and hotel groups.',
    'price.3l1': 'Up to 300 active employees per month.',
    'price.3l2': 'Advanced analytics and executive dashboard.',
    'price.3l3': 'White label: experience and reports with your brand.',
    'price.3l4': 'Multiple properties and permissions by location.',
    'price.3l5': 'Consolidated reports and priority support.',
    'price.3l6': 'Integrations and enterprise setup quoted by scope.',
    'price.sales': 'Talk to sales',
    'price.addon.t': 'Extra docks on Essential',
    'price.addon.p': 'More tables, bars or locations? Add the docks you need. On Business and Enterprise we quote them with your plan.',
    'price.addon.install': 'Installation',
    'price.addon.installv': '<strong>$160</strong> MXN per dock',
    'price.addon.use': 'System usage',
    'price.addon.usev': '<strong>$40</strong> MXN/month per dock',

    'demo.title': 'This is <em>your dashboard.</em>',
    'demo.lead': 'Explore the tak! dashboard with sample data. Simulate a review and watch it arrive live.',
    'demo.simulate': 'Simulate a review',
    'demo.tabs': 'Dashboard sections',
    'demo.tab1': 'Overview', 'demo.tab2': 'Reviews', 'demo.tab3': 'My team', 'demo.tab4': 'Tips',
    'demo.note': 'Demo with fictional data. Your real dashboard shows your business’s information.',

    'wl.pill': 'Launching soon',
    'wl.title': 'Join our <em>waiting list.</em>',
    'wl.text': 'tak! is about to officially launch. Leave us your email and you’ll be among the first to know the date, the news and how to get early access.',
    'wl.t1': 'Official launch announcement',
    'wl.t2': 'Early access for businesses',
    'wl.t3': 'No spam: only what matters',
    'wl.email': 'Email',
    'wl.emailph': 'you@email.com',
    'wl.name': 'Name',
    'wl.optional': '(optional)',
    'wl.profile': 'I’m interested because…',
    'wl.p1': 'I own or manage a business',
    'wl.p2': 'I work serving customers',
    'wl.p3': 'I want to say thanks as a customer',
    'wl.p4': 'Other reason',
    'wl.consent': 'I agree to receive emails from tak! and have read the <a href="#privacidad" data-dialog="privacidad">Privacy Notice</a>.',

    'faq.title': 'Frequently asked questions',
    'faq.0q': 'When does tak! launch?',
    'faq.0a': 'Very soon. <a href="#lista-espera">Join our waiting list</a> and we’ll email you as soon as the official launch happens.',
    'faq.1q': 'Do my customers need an app?',
    'faq.1a': 'No. They hold their phone near the wristband or dock and everything opens in the browser.',
    'faq.2q': 'What’s the difference between a wristband and a dock?',
    'faq.2a': 'Each team member wears a wristband: the review and tip go to that person. The dock sits on the table, bar or front desk: customers rate the place and their dishes, and can leave a Google review.',
    'faq.3q': 'How much is an extra dock?',
    'faq.3a': 'The Essential plan includes one dock. Each extra dock has a $160 MXN installation fee and $40 MXN per month for usage. On Business and Enterprise, docks and wristbands are quoted to your business’s needs.',
    'faq.4q': 'I already have tak!, how do I get to my dashboard?',
    'faq.4a': 'With the <a href="/admin">Sign in</a> button at the top, using the email and password we set up for you.',
    'faq.5q': 'How does the review reach my team?',
    'faq.5a': 'Each wristband is linked to a person and their area. The review is saved in their name and you see it in your dashboard.',
    'faq.6q': 'Is the tip mandatory?',
    'faq.6a': 'No. Your customers can leave just a review, just a tip, or both. It’s up to them.',
    'faq.7q': 'What records do I get?',
    'faq.7a': 'Reviews and tips by team member, area and date, so you know what’s working.',
    'faq.8q': 'Does it work with international tourists?',
    'faq.8a': 'Yes. The experience is designed so any guest can say thanks from their phone, wherever they’re from.',
    'faq.9q': 'How much does it cost?',
    'faq.9a': 'There are three monthly plans: Essential from $699, Business from $1,999 and Enterprise from $4,999 MXN per month. <a href="#precios">See plans</a>.',
    'faq.10q': 'How do I get started?',
    'faq.10a': 'Join our waiting list to hear about the launch. If you have a business and want to talk sooner, write to us using the contact form.',

    'ct.title': 'Have a business? Let’s talk.',
    'ct.lead': 'If you want tak! in your business from launch day, tell us about it and we’ll get in touch.',
    'ct.name': 'Name',
    'ct.business': 'Business',
    'ct.type': 'Business type',
    'ct.o1': 'Hotel', 'ct.o2': 'Restaurant', 'ct.o3': 'Bar or club', 'ct.o4': 'Valet parking', 'ct.o5': 'Gas station',
    'ct.o6': 'Cruise', 'ct.o7': 'Spa or fitness', 'ct.o8': 'Events', 'ct.o9': 'Other',
    'ct.email': 'Email',
    'ct.message': 'Message',
    'ct.messageph': 'Tell us about your business and your team.',
    'ct.privacy': 'I have read the <a href="#privacidad" data-dialog="privacidad">Privacy Notice</a>.',
    'ct.submit': 'I want to know tak!',

    'foot.aria': 'Footer links',
    'foot.contact': 'Contact',
    'foot.terms': 'Terms of use',
    'foot.privacy': 'Privacy',

    'legal.privacy': 'Privacy Notice',
    'legal.terms': 'Terms of use',
    'legal.prep': 'Document in preparation.',
    'legal.privacyText': 'The information you share in our forms (name, business, email and message) is used only to answer your request and, if you joined the waiting list, to tell you about the launch and send you information about tak!. You can ask us to remove you from the list by replying to any of our emails. We will publish the full Privacy Notice soon.',
    'legal.termsText': 'tak!’s Terms of use will be published with the commercial launch. If you have questions, write to us from the contact section.',
    'legal.ok': 'Got it',
  };

  // Textos que arman script.js y demo.js.
  const STRINGS = {
    es: {
      metaTitle: 'tak! — thanks are kind!',
      metaDescription: 'tak! — thanks are kind! Reseñas y propinas para quien te atendió, con un toque. Sin efectivo, sin app. Muy pronto.',
      menuOpen: 'Abrir menú', menuClose: 'Cerrar menú',
      errConsent: 'Confirma que leíste el aviso.',
      errConsentWl: 'Acepta recibir correos para unirte.',
      errEmail: 'Escribe un correo válido.',
      errType: 'Elige un tipo de negocio.',
      errProfile: 'Elige una opción.',
      errRequired: 'Completa este campo.',
      formCheck: 'Revisa los campos marcados e inténtalo de nuevo.',
      sending: 'Enviando…',
      contactOk: '¡Gracias! Te contactaremos muy pronto.',
      contactFail: 'No pudimos enviar tus datos. Inténtalo de nuevo en un momento.',
      contactSubmit: 'Quiero conocer tak!',
      planMessage: (plan) => `Me interesa el plan tak! ${plan}.`,
      wlSubmit: 'Únete a la lista de espera',
      wlOk: '¡Listo! Ya estás en la lista de espera. Te escribiremos en cuanto lancemos.',
      wlFail: 'No pudimos registrarte. Inténtalo de nuevo en un momento.',
      wlPlan: (plan) => `Te avisaremos del plan ${plan} en el lanzamiento.`,
    },
    en: {
      metaTitle: 'tak! — thanks are kind!',
      metaDescription: 'tak! — thanks are kind! Reviews and tips for the person who served you, with a tap. No cash, no app. Coming soon.',
      menuOpen: 'Open menu', menuClose: 'Close menu',
      errConsent: 'Please confirm you read the notice.',
      errConsentWl: 'Please agree to receive emails to join.',
      errEmail: 'Enter a valid email.',
      errType: 'Choose a business type.',
      errProfile: 'Choose an option.',
      errRequired: 'Please fill in this field.',
      formCheck: 'Check the highlighted fields and try again.',
      sending: 'Sending…',
      contactOk: 'Thank you! We’ll be in touch very soon.',
      contactFail: 'We couldn’t send your details. Please try again in a moment.',
      contactSubmit: 'I want to know tak!',
      planMessage: (plan) => `I’m interested in the tak! ${plan} plan.`,
      wlSubmit: 'Join our waiting list',
      wlOk: 'You’re in! You’re on the waiting list. We’ll email you as soon as we launch.',
      wlFail: 'We couldn’t sign you up. Please try again in a moment.',
      wlPlan: (plan) => `We’ll tell you about the ${plan} plan at launch.`,
    },
  };

  const textNodes = [...document.querySelectorAll('[data-i18n]')];
  const attrNodes = [...document.querySelectorAll('[data-i18n-attr]')];
  const ES = {};
  textNodes.forEach((node) => { ES[node.dataset.i18n] ??= node.innerHTML; });
  const parseAttrs = (node) => node.dataset.i18nAttr.split(';').map((pair) => pair.split(':').map((s) => s.trim()));
  attrNodes.forEach((node) => parseAttrs(node).forEach(([attr, key]) => { ES[key] ??= node.getAttribute(attr) ?? ''; }));

  const listeners = new Set();
  let lang = window.__takLang === 'en' ? 'en' : 'es';

  const apply = () => {
    const dict = lang === 'en' ? EN : ES;
    textNodes.forEach((node) => {
      const html = dict[node.dataset.i18n] ?? ES[node.dataset.i18n];
      if (html !== undefined && node.innerHTML !== html) node.innerHTML = html;
    });
    attrNodes.forEach((node) => parseAttrs(node).forEach(([attr, key]) => {
      const value = dict[key] ?? ES[key];
      if (value !== undefined) node.setAttribute(attr, value);
    }));
    const s = STRINGS[lang];
    document.documentElement.lang = lang;
    document.title = s.metaTitle;
    document.querySelector('meta[name="description"]')?.setAttribute('content', s.metaDescription);
    document.querySelectorAll('[data-lang]').forEach((button) => button.setAttribute('aria-pressed', String(button.dataset.lang === lang)));
    document.documentElement.classList.remove('i18n-pending');
  };

  const set = (next) => {
    if (next !== 'es' && next !== 'en') return;
    try { localStorage.setItem(STORE, next); } catch { /* modo privado */ }
    if (next === lang) return;
    lang = next;
    apply();
    listeners.forEach((fn) => fn(lang));
  };

  document.querySelectorAll('[data-lang]').forEach((button) => button.addEventListener('click', () => set(button.dataset.lang)));

  window.takI18n = {
    get lang() { return lang; },
    t: (key, ...args) => {
      const value = STRINGS[lang][key] ?? STRINGS.es[key];
      return typeof value === 'function' ? value(...args) : value;
    },
    set,
    onChange: (fn) => listeners.add(fn),
  };

  apply();
})();
