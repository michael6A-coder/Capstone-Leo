  function switchTab(tabId) {
    // Stop gallery previews when the visitor leaves the Gallery tab.
    if (tabId !== 'gallery-tab') {
      document.querySelectorAll('#gallery-tab video').forEach(video => {
        video.pause();
        video.currentTime = 0;
      });
    }

    document.querySelectorAll('.app-page').forEach(page => {
      page.classList.remove('active-page');
    });

    document.querySelectorAll('.nav-tab-link').forEach(link => {
      link.classList.remove('active-tab');
    });

    const activePage = document.getElementById(tabId);
    if(activePage) {
      activePage.classList.add('active-page');
    }

    const targetNav = document.getElementById('nav-' + tabId);
    if(targetNav) {
      targetNav.classList.add('active-tab');
    }

    window.scrollTo({ top: 0, behavior: 'smooth' });
  }

  const menuBtn = document.getElementById('menuBtn');
  const mobileNav = document.getElementById('mobileNav');
  function setMobileNav(open){
    if (!mobileNav || !menuBtn) return;
    mobileNav.classList.toggle('hidden', !open);
    mobileNav.classList.toggle('flex', open);
    menuBtn.setAttribute('aria-expanded', String(open));
    document.body.style.overflow = open ? 'hidden' : '';
  }
  if (menuBtn && mobileNav) {
    menuBtn.addEventListener('click', () => setMobileNav(mobileNav.classList.contains('hidden')));
  }

  /* If the phone is rotated (or the window widened) while the menu is open,
     the menu is hidden by the stylesheet but the page would stay locked,
     so it is closed properly here. */
  window.addEventListener('resize', () => {
    if (window.innerWidth >= 1024 && mobileNav && !mobileNav.classList.contains('hidden')) {
      setMobileNav(false);
    }
  });

  window.addEventListener('scroll', () => {
    const winScroll = document.body.scrollTop || document.documentElement.scrollTop;
    const height = Math.max(1, document.documentElement.scrollHeight - document.documentElement.clientHeight);
    const progressBar = document.getElementById('scroll-progress-bar');
    if (progressBar) progressBar.style.width = Math.min(100, Math.max(0, (winScroll / height) * 100)) + '%';
    document.getElementById('siteHeader').classList.toggle('scrolled', window.scrollY > 12);
  });

  const searchBtn = document.getElementById('searchBtn');
  const searchOverlay = document.getElementById('searchOverlay');
  const closeSearch = document.getElementById('closeSearch');
  const searchBox = document.getElementById('searchBox');
  const searchInput = document.getElementById('searchInput');
  const searchResults = document.getElementById('searchResults');

  const PRODUCT_CATEGORIES = [
    'Hair Care', 'Hair Color & Chemical', 'Hair Treatment', 'Nail Care', 'Nail Art',
    'Lash', 'Brow', 'Makeup', 'Skin Care', 'Facial Care',
    'Waxing', 'Salon Consumables', 'Cleaning & Sanitization'
  ];

  const PRODUCT_SUGGESTIONS = {
    'Hair Care': ['Shampoo', 'Conditioner', 'Hair Serum', 'Hair Spray'],
    'Hair Color & Chemical': ['Hair Dye', 'Bleach Powder', 'Developer', 'Rebonding Cream'],
    'Hair Treatment': ['Keratin Treatment', 'Hair Mask', 'Hot Oil Treatment'],
    'Nail Care': ['Nail Polish', 'Base Coat', 'Top Coat', 'Cuticle Oil'],
    'Nail Art': ['Nail Gems', 'Glitter', 'Stickers', 'Acrylic Powder'],
    'Lash': ['False Eyelashes', 'Lash Glue', 'Lash Serum'],
    'Brow': ['Eyebrow Pencil', 'Brow Gel', 'Brow Tint'],
    'Makeup': ['Foundation', 'Lipstick', 'Blush', 'Setting Spray'],
    'Skin Care': ['Facial Cleanser', 'Moisturizer', 'Sunscreen'],
    'Facial Care': ['Facial Mask', 'Toner', 'Facial Scrub'],
    'Waxing': ['Hot Wax', 'Cold Wax Strips', 'Soothing Gel'],
    'Salon Consumables': ['Cotton Balls', 'Gloves', 'Tissues', 'Shower Caps'],
    'Cleaning & Sanitization': ['Alcohol', 'Disinfectant Spray', 'Tool Sanitizer']
  };

  const PRODUCT_DATA = Object.entries(PRODUCT_SUGGESTIONS).flatMap(([cat, products]) =>
    products.map(name => ({ name, cat, img: '' }))
  );

  let activeProdCat = 'all';

  function renderProducts() {
    const catBox = document.getElementById('prodCats');
    const grid = document.getElementById('prodGrid');
    const empty = document.getElementById('prodEmpty');
    if (!catBox || !grid) return;

    catBox.innerHTML = PRODUCT_CATEGORIES.map(c => {
      const on = activeProdCat === c;
      const stateClass = on ? 'border-copper bg-copper/12 text-copper-dark' : 'border-bronze/30 bg-sand-100 text-ink hover:border-plum';
      const labelClass = on ? 'text-copper-dark/70' : 'text-ink/35';
      return '<button onclick="setProdCat(\'' + c.replace(/'/g, "\\'") + '\')" class="rounded-2xl p-3 text-left border transition ' +
        stateClass + '">' +
        '<span class="block text-xs font-bold leading-snug">' + c + '</span>' +
        '<span class="block text-[10px] font-bold uppercase tracking-widest mt-1 ' + labelClass + '">' +
        'In stock at branch</span></button>';
    }).join('');

    const list = activeProdCat === 'all' ? PRODUCT_DATA : PRODUCT_DATA.filter(p => p.cat === activeProdCat);
    grid.innerHTML = list.map(p => {
      const visual = p.img
        ? '<img src="' + p.img + '" class="w-3/4 max-h-full object-contain" alt="' + p.name + '">'
        : '<div class="w-20 h-20 rounded-full bg-copper/10 text-copper-dark flex items-center justify-center font-display text-3xl" aria-hidden="true">' + p.name.charAt(0) + '</div>';
      return '<div class="group text-center" data-product="' + p.name + '">' +
        '<div class="bg-sand-100 rounded-3xl p-6 aspect-square flex items-center justify-center border border-bronze/30 shadow-sm mb-4 group-hover:-translate-y-2 transition-all duration-300">' +
          visual +
        '</div>' +
        '<span class="text-[10px] font-bold uppercase tracking-widest text-copper">' + p.cat + '</span>' +
        '<h4 class="font-bold text-sm text-ink mt-1">' + p.name + '</h4>' +
      '</div>';
    }).join('');

    const isEmpty = list.length === 0;
    grid.classList.toggle('hidden', isEmpty);
    empty.classList.toggle('hidden', !isEmpty);
    if (isEmpty) {
      document.getElementById('prodEmptyLead').textContent = activeProdCat === 'all'
        ? 'Our retail line-up is being updated.'
        : 'No items listed under ' + activeProdCat + ' yet.';
    }
  }

  function setProdCat(c) {
    // Tapping the active category again clears the filter and shows every product.
    activeProdCat = (activeProdCat === c) ? 'all' : c;
    renderProducts();
  }


  /* Site-wide search index -------------------------------------------------
     Built from the same data the rest of the app renders from (services,
     staff, branches, products, gallery, home-service categories) instead of
     a short hand-picked list, so the search bar can actually find anything
     on the site. Built lazily on first use — by then every data const below
     (SERVICE_DATA, STAFF_DATA, branchMap, PRODUCT_DATA, ...) has already
     been declared further down this same script. Cached after the first
     build since none of that source data changes at runtime. */
  let searchIndexCache = null;

  function scrollToSearchHit(el, fallbackEl) {
    const target = el || fallbackEl;
    if (!target) return;
    setTimeout(() => {
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
      if (el) {
        el.classList.add('search-hit-flash');
        setTimeout(() => el.classList.remove('search-hit-flash'), 1500);
      }
    }, 150);
  }

  function buildSearchIndex() {
    const idx = [];
    const seenSvc = new Set();
    const seenContent = new Set();

    Object.keys(branchMap).forEach(key => {
      const b = branchMap[key];
      idx.push({
        name: b.name, tag: 'Branch · ' + b.tag, keywords: b.addr,
        action: () => {
          switchTab('branches-tab');
          document.querySelector(`.branch-tab-btn[data-b="${key}"]`)?.click();
        }
      });
    });

    // Services — every branch, every category, every item on the price list
    // Only entries added after this point belong to the three searchable areas.
    const includedStart = idx.length;
    Object.keys(SERVICE_DATA).forEach(branchKey => {
      const branchLabel = BRANCH_LABEL[branchKey] || branchKey;
      SERVICE_DATA[branchKey].menus.forEach(menu => {
        menu.cats.forEach(cat => {
          cat.items.forEach(item => {
            const [name, price] = item;
            const dedupeKey = branchKey + '|' + name + '|' + price;
            if (seenSvc.has(dedupeKey)) return;
            seenSvc.add(dedupeKey);
            idx.push({
              name: name,
              tag: 'Service · ' + branchLabel + ' · ₱' + price,
              keywords: cat.name,
              action: () => {
                switchTab('services-tab');
                document.querySelector(`.svc-tab-btn[data-s="${branchKey}"]`)?.click();
                activeSvcGroup = 'all';
                const filter = document.getElementById('svcFilter');
                if (filter) filter.value = name;
                renderServices();
                const row = Array.from(document.querySelectorAll('.svc-row')).find(r => r.dataset.svc === name);
                scrollToSearchHit(row, document.getElementById('svcMenus'));
              }
            });
          });
        });
      });
    });

    // Stylists & other staff, every branch
    Object.keys(STAFF_DATA).forEach(branchKey => {
      const branchLabel = BRANCH_LABEL[branchKey] || branchKey;
      STAFF_DATA[branchKey].roles.forEach(role => {
        role.staff.forEach(s => {
          const nameOnly = s.split(' — ')[0];
          idx.push({
            name: nameOnly, tag: role.title + ' · ' + branchLabel, keywords: '',
            action: () => {
              switchTab('stylists-tab');
              document.querySelector(`.staff-tab-btn[data-t="${branchKey}"]`)?.click();
              const card = Array.from(document.querySelectorAll('#staffRoster span'))
                .find(el => el.textContent.trim() === nameOnly)?.parentElement;
              scrollToSearchHit(card, document.getElementById('staffRoster'));
            }
          });
        });
      });
    });

    PRODUCT_DATA.forEach(p => {
      idx.push({
        name: p.name, tag: 'Product · ' + p.cat, keywords: '',
        action: () => {
          switchTab('products-tab');
          activeProdCat = p.cat;
          renderProducts();
          const card = Array.from(document.querySelectorAll('#prodGrid [data-product]'))
            .find(el => el.dataset.product === p.name);
          scrollToSearchHit(card, document.getElementById('prodGrid'));
        }
      });
    });
    idx.push({ name: 'Retail Products', tag: 'Products', keywords: PRODUCT_CATEGORIES.join(' '), action: () => switchTab('products-tab') });

    // Search is intentionally limited to Services, Stylists, and Products.
    return idx.slice(includedStart);

    idx.push({ name: 'Weddings & Debuts — Home Service', tag: 'Home & Events', keywords: 'bride debutante wedding', action: () => hsPreset('Wedding') });
    idx.push({ name: 'Graduations & Galas — Home Service', tag: 'Home & Events', keywords: 'graduation gala', action: () => hsPreset('Graduation') });
    idx.push({ name: 'Personal Events — Home Service', tag: 'Home & Events', keywords: 'birthday celebration', action: () => hsPreset('Personal Event') });
    idx.push({ name: 'Request Home Service', tag: 'Home & Events', keywords: 'mobile off-site event styling', action: () => hsJump('hsRequest') });
    idx.push({ name: 'Track My Home Service Request', tag: 'Home & Events', keywords: '', action: () => hsJump('hsTrack') });

    // Gallery — read straight from the DOM so it never drifts from the actual photos
    document.querySelectorAll('#gallery-tab img[alt]').forEach(img => {
      idx.push({
        name: img.alt + ' — Gallery Photo', tag: 'Gallery', keywords: '',
        action: () => { switchTab('gallery-tab'); openLightbox(img.src); }
      });
    });

    // Page-level & quick-action landmarks
    idx.push({ name: 'Home', tag: 'Page', keywords: '', action: () => switchTab('home-tab') });
    idx.push({ name: 'Book an Appointment', tag: 'Action', keywords: 'reserve schedule slot', action: () => openBookingModal() });
    idx.push({ name: 'Track My Booking', tag: 'Action', keywords: 'reference status', action: () => openTrackModal() });
    idx.push({ name: 'Portal Login', tag: 'Account', keywords: 'customer staff cashier admin sign in', action: () => goToPortalLogin() });

    // Index the rest of the public portal directly from its HTML. This covers
    // headings, descriptions, links, labels, and actions that are not backed by
    // one of the structured data collections above.
    document.querySelectorAll('.app-page').forEach(page => {
      const pageName = page.id.replace(/-tab$/, '').replace(/-/g, ' ')
        .replace(/\b\w/g, letter => letter.toUpperCase());

      page.querySelectorAll('h1, h2, h3, h4, h5, h6, p, a, button, label, summary').forEach(el => {
        if (el.closest('#searchOverlay, [aria-hidden="true"]')) return;
        const text = el.textContent.replace(/\s+/g, ' ').trim();
        if (text.length < 2 || text.length > 180) return;

        const key = page.id + '|' + text.toLowerCase();
        if (seenContent.has(key)) return;
        seenContent.add(key);

        idx.push({
          name: text,
          tag: pageName,
          keywords: (el.closest('article, section, li, form, [class*="card"]') || el.parentElement || el)
            .textContent.replace(/\s+/g, ' ').trim().slice(0, 500),
          action: () => {
            switchTab(page.id);
            scrollToSearchHit(el, page);
          }
        });
      });
    });

    return idx;
  }

  function normalizeSearchText(value) {
    return String(value || '')
      .toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .replace(/[^a-z0-9\s]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim();
  }

  /* Opened by the magnifier in the desktop header and by the Search row in
     the mobile menu, so it lives in its own function. */
  function openSearchOverlay() {
    searchOverlay.classList.remove('opacity-0', 'pointer-events-none');
    searchBox.classList.remove('translate-y-8');
    searchInput.value = '';
    searchResults.innerHTML = '';
    setTimeout(() => searchInput.focus(), 100);
  }
  searchBtn?.addEventListener('click', openSearchOverlay);

  function closeSearchModal() {
    searchOverlay.classList.add('opacity-0', 'pointer-events-none');
    searchBox.classList.add('translate-y-8');
  }
  closeSearch?.addEventListener('click', closeSearchModal);

  function renderSearchResult(m) {
    const b = document.createElement('button');
    b.className = 'flex items-center justify-between gap-3 p-3 bg-sand-100 hover:bg-bronze/30 rounded-xl w-full text-left transition border border-bronze/10';
    b.innerHTML = `<span class="font-bold text-sm text-ink truncate">${escAttr(m.name)}</span><span class="shrink-0 text-[9px] font-bold uppercase tracking-widest text-plum border border-plum/20 px-2 py-1 rounded bg-plum/5">${escAttr(m.tag)}</span>`;
    b.onclick = () => { closeSearchModal(); m.action(); };
    return b;
  }

  searchInput?.addEventListener('input', (e) => {
    const query = normalizeSearchText(e.target.value);
    searchResults.innerHTML = '';
    if (!query) return;
    if (!searchIndexCache) searchIndexCache = buildSearchIndex();
    const queryWords = query.split(' ');
    const matches = searchIndexCache
      .map(item => {
        const name = normalizeSearchText(item.name);
        const tag = normalizeSearchText(item.tag);
        const searchable = name + ' ' + tag + ' ' + normalizeSearchText(item.keywords);
        if (!queryWords.every(word => searchable.includes(word))) return null;
        const score = name === query ? 0 : name.startsWith(query) ? 1 : name.includes(query) ? 2 : tag.includes(query) ? 3 : 4;
        return { item, score };
      })
      .filter(Boolean)
      .sort((a, b) => a.score - b.score || a.item.name.localeCompare(b.item.name))
      .map(match => match.item)
      .slice(0, 60);
    if (!matches.length) {
      searchResults.innerHTML = `<p class="text-sm text-ink/40 text-center py-4">No matches for "${escAttr(e.target.value)}"</p>`;
      return;
    }
    matches.forEach(m => searchResults.appendChild(renderSearchResult(m)));
  });

  searchInput?.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter') return;
    const first = searchResults.querySelector('button');
    first?.click();
  });

  function showToast(msg) {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('opacity-0');
    toast.classList.add('opacity-100');
    setTimeout(() => {
      toast.classList.remove('opacity-100');
      toast.classList.add('opacity-0');
    }, 2500);
  }

  const bookingModalOverlay = document.getElementById('bookingModalOverlay');
  const bookingModalBox = document.getElementById('bookingModalBox');
  const closeBooking = document.getElementById('closeBooking');
  const bookingModalForm = document.getElementById('bookingModalForm');

  function openBookingModal() {
    bookingModalOverlay.classList.remove('opacity-0', 'pointer-events-none');
    bookingModalBox.classList.remove('scale-95');
    bookingModalBox.scrollTop = 0;
    document.getElementById('bookingAccessPanel').classList.remove('hidden');
    document.getElementById('bookingFormPanel').classList.add('hidden');
    document.getElementById('bookingOtpPanel').classList.add('hidden');
    document.getElementById('bookingConfirmPanel').classList.add('hidden');
    document.getElementById('bookingReviewPanel').classList.add('hidden');
    if (typeof resetSlotGrid === 'function') resetSlotGrid();
    if (typeof resetStaffList === 'function') resetStaffList();
    if (typeof resetServiceList === 'function') resetServiceList();
    if (typeof resetBookOtpInputs === 'function') resetBookOtpInputs();
    clearInterval(bookOtpCooldownTimer);
    bookOtpCooldownTimer = null;
    pendingBooking = null;
    const banner = document.getElementById('bookingService');
    if (banner) { banner.classList.add('hidden'); banner.classList.remove('flex'); }
    currentBooking = { service: '', price: '' };
    document.getElementById('bookBranchSelect').value = '';
    bookDepositLocked = false;
    bookDepositInfo = { amount: 0, method: '', reference: '' };
    document.getElementById('bookDepositForm').classList.remove('hidden');
    document.getElementById('bookDepositLocked').classList.add('hidden');
    document.getElementById('bookDepositLocked').classList.remove('flex');
    document.getElementById('bookDepositMethod').value = '';
    document.getElementById('bookDepositRef').value = '';
    document.getElementById('bookDepositRefWrap').classList.add('hidden');
    document.getElementById('bookDepositCashNote').classList.add('hidden');
    document.getElementById('bookDepositRequired').textContent = '—';
    bookReservationQuote = null;
    bookQuoteRequest++;
    document.getElementById('bookDepositGate').classList.add('hidden');
    document.getElementById('bookScheduleSection').classList.remove('hidden');
    const dateEl = document.getElementById('bookDate');
    dateEl.value = '';
    if (dateEl && !dateEl.min) {
      const now = new Date();
      const localToday = [now.getFullYear(), String(now.getMonth() + 1).padStart(2, '0'), String(now.getDate()).padStart(2, '0')].join('-');
      dateEl.min = localToday;
    }
  }

  function continueAsGuestBooking() {
    if (bookingModalOverlay.classList.contains('opacity-0')) openBookingModal();
    document.getElementById('bookingAccessPanel').classList.add('hidden');
    document.getElementById('bookingFormPanel').classList.remove('hidden');
    document.getElementById('bookingModeText').textContent = 'Guest booking — just your name and mobile number are required.';
    document.getElementById('bookingModeBadge').textContent = 'Guest';
    document.getElementById('bookingModeBadge').className = 'shrink-0 rounded-full bg-copper/10 border border-copper/25 px-3 py-1 text-[10px] font-bold uppercase tracking-widest text-copper-dark';
    document.getElementById('bookingModalBox').scrollTop = 0;
  }

  function closeBookingModal() {
    bookingModalOverlay.classList.add('opacity-0', 'pointer-events-none');
    bookingModalBox.classList.add('scale-95');
  }
  closeBooking?.addEventListener('click', closeBookingModal);

  function bookService(name, price, branch) {
    openBookingModal();
    const banner = document.getElementById('bookingService');
    if (name) {
      currentBooking = { service: name, price: price || '' };
      document.getElementById('bookingServiceName').textContent = name;
      document.getElementById('bookingServicePrice').textContent = price || '';
      banner.classList.remove('hidden');
      banner.classList.add('flex');
    }
    if (branch) {
      const id = (typeof BRANCH_ID_BY_KEY !== 'undefined' && BRANCH_ID_BY_KEY[branch]) || '';
      const select = document.getElementById('bookBranchSelect');
      select.value = id;
      select.dispatchEvent(new Event('change'));
    }
  }

  // Wedding Packages — rendered from backend/public/getWeddingPackages.php
  // so admins can edit/add packages from the admin panel.
  const WEDDING_PACKAGE_STYLES = {
    Plain: {
      figure: 'bg-panel rounded-3xl p-7 flex flex-col border border-bronze/20 shadow-sm',
      label: 'text-[10px] font-bold uppercase tracking-widest text-ink/40',
      price: 'font-display text-3xl text-ink mt-2 mb-5',
      list: 'text-[13px] text-ink/65 leading-relaxed flex-1 space-y-3',
      dot: 'shrink-0 w-1.5 h-1.5 rounded-full bg-copper mt-1.75',
      badge: 'mt-5 inline-flex self-start items-center gap-2 rounded-full bg-copper/12 text-copper-dark text-[11px] font-bold uppercase tracking-widest px-3.5 py-1.5',
      button: 'mt-6 rounded-full border border-ink/15 text-[12px] font-bold uppercase tracking-widest py-3 hover:border-plum hover:text-plum transition'
    },
    Highlight: {
      figure: 'bg-copper/12 rounded-3xl p-7 flex flex-col border border-copper/30 shadow-sm relative',
      label: 'text-[10px] font-bold uppercase tracking-widest text-copper-dark',
      price: 'font-display text-3xl text-ink mt-2 mb-5',
      list: 'text-[13px] text-ink/65 leading-relaxed flex-1 space-y-3',
      dot: 'shrink-0 w-1.5 h-1.5 rounded-full bg-copper mt-1.75',
      badge: 'mt-5 inline-flex self-start items-center gap-2 rounded-full bg-copper/12 text-copper-dark text-[11px] font-bold uppercase tracking-widest px-3.5 py-1.5',
      button: 'mt-6 rounded-full bg-copper text-white text-[12px] font-bold uppercase tracking-widest py-3 hover:brightness-110 transition'
    },
    Premium: {
      figure: 'bg-plum text-white rounded-3xl p-7 flex flex-col shadow-sm',
      label: 'text-[10px] font-bold uppercase tracking-widest text-copper',
      price: 'font-display text-3xl mt-2 mb-5',
      list: 'text-[13px] text-white/75 leading-relaxed flex-1 space-y-3',
      dot: 'shrink-0 w-1.5 h-1.5 rounded-full bg-copper mt-1.75',
      badge: 'mt-5 inline-flex self-start items-center gap-2 rounded-full bg-white/15 text-white text-[11px] font-bold uppercase tracking-widest px-3.5 py-1.5',
      button: 'mt-6 rounded-full bg-white text-plum text-[12px] font-bold uppercase tracking-widest py-3 hover:bg-sand-100 transition'
    }
  };

  function buildWeddingPackageCard(pkg) {
    const styles = WEDDING_PACKAGE_STYLES[pkg.style] || WEDDING_PACKAGE_STYLES.Plain;
    const priceLabel = '₱' + Number(pkg.price).toLocaleString();

    const figure = document.createElement('figure');
    figure.className = styles.figure;

    const label = document.createElement('span');
    label.className = styles.label;
    label.textContent = pkg.packageName;
    figure.appendChild(label);

    const price = document.createElement('div');
    price.className = styles.price;
    price.textContent = priceLabel;
    figure.appendChild(price);

    const list = document.createElement('ul');
    list.className = styles.list;
    (pkg.features || []).forEach(feature => {
      const li = document.createElement('li');
      li.className = 'flex gap-2.5';
      const dot = document.createElement('span');
      dot.className = styles.dot;
      const span = document.createElement('span');
      span.style.textAlign = 'justify';
      span.textContent = feature.replace(/\s+—\s+/g, ' ');
      li.appendChild(dot);
      li.appendChild(span);
      list.appendChild(li);
    });
    figure.appendChild(list);

    if (pkg.reservationFee) {
      const badge = document.createElement('span');
      badge.className = styles.badge;
      badge.textContent = '₱' + Number(pkg.reservationFee).toLocaleString() + ' reservation fee';
      figure.appendChild(badge);
    }

    const button = document.createElement('button');
    button.className = styles.button;
    button.textContent = 'Inquire';
    button.addEventListener('click', () => bookService('Wedding ' + pkg.packageName, priceLabel));
    figure.appendChild(button);

    return figure;
  }

  function renderWeddingPackages() {
    const grid = document.getElementById('weddingPackagesGrid');
    const empty = document.getElementById('weddingPackagesEmpty');
    if (!grid) return;
    fetch('backend/public/getWeddingPackages.php')
      .then(r => r.json())
      .then(res => {
        const packages = (res.success && res.packages) ? res.packages : [];
        grid.innerHTML = '';
        if (packages.length === 0) {
          empty?.classList.remove('hidden');
          return;
        }
        empty?.classList.add('hidden');
        packages.forEach(pkg => grid.appendChild(buildWeddingPackageCard(pkg)));
      })
      .catch(() => { empty?.classList.remove('hidden'); });
  }

  function openLightbox(src) {
    const img = document.getElementById('lightboxImg');
    const overlay = document.getElementById('lightboxOverlay');
    img.src = src;
    overlay.classList.remove('opacity-0', 'pointer-events-none');
    setTimeout(() => img.classList.remove('scale-95'), 50);
  }
  
  const closeLightboxBtn = document.getElementById('closeLightboxBtn');
  const lightboxOverlayElement = document.getElementById('lightboxOverlay');
  
  function closeLightbox() {
    const img = document.getElementById('lightboxImg');
    const overlay = document.getElementById('lightboxOverlay');
    overlay.classList.add('opacity-0', 'pointer-events-none');
    img.classList.add('scale-95');
  }

  if (closeLightboxBtn) closeLightboxBtn.addEventListener('click', closeLightbox);
  if (lightboxOverlayElement) {
    lightboxOverlayElement.addEventListener('click', (e) => {
      if (e.target === lightboxOverlayElement) closeLightbox();
    });
  }

  // Keep gallery previews short and consistent without altering the source files.
  document.querySelectorAll('#gallery-tab video[data-preview-duration]').forEach(video => {
    const previewDuration = Number(video.dataset.previewDuration) || 10;
    video.muted = true;
    const toggle = video.closest('.gallery-video-card')?.querySelector('.gallery-video-toggle');
    const icon = toggle?.querySelector('span');

    const showPlayButton = () => {
      if (!toggle || !icon) return;
      icon.innerHTML = '&#9654;';
      toggle.classList.remove('opacity-0', 'pointer-events-none');
    };

    if (toggle) {
      toggle.addEventListener('click', () => {
        if (video.paused) {
          document.querySelectorAll('#gallery-tab video').forEach(otherVideo => {
            if (otherVideo !== video) otherVideo.pause();
          });
          video.play();
        } else {
          video.pause();
        }
      });
    }

    video.addEventListener('play', () => {
      if (!toggle || !icon) return;
      toggle.classList.add('opacity-0', 'pointer-events-none');
    });

    video.addEventListener('pause', showPlayButton);

    video.addEventListener('timeupdate', () => {
      if (video.currentTime >= previewDuration) {
        video.pause();
        video.currentTime = 0;
      }
    });

    video.addEventListener('seeking', () => {
      if (video.currentTime > previewDuration) video.currentTime = previewDuration;
    });
  });

  // Allow closing lightbox with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && lightboxOverlayElement && !lightboxOverlayElement.classList.contains('opacity-0')) {
      closeLightbox();
    }
  });

  // Source price list synchronized from ser.docx (15-page service/pricing list).
  // Only services and prices supported by the supplied source are included.
  const SERVICE_DATA = {
    daraga: {
      promo: 'Haircut with blowdry ₱30 · Organic rebond, any length ₱999 · Manicure/pedicure ₱49',
      menus: [
        {
          title: 'Promo Deals & Best Sellers', sub: 'Daraga Main',
          cats: [
            { name: 'Promo Deals', g: 'deals', items: [['Haircut with Blow Dry','30','Promo'], ['Organic Rebonding (any length)','999','Promo'], ['Manicure / Pedicure','49','Promo']] },
            { name: 'Forever Promo & Best Sellers', g: 'deals', items: [['Haircut w/ Blowdry (men & women)','30'], ['Organic Rebond','999'], ['Hair Color','499'], ['Keratin Treatment','499'], ['Basic Facial','499'], ['Eyelash Extensions','599'], ['Hair & Make-up','700'], ['Gel Polish','399'], ['Foot Spa','149'], ['Manicure / Pedicure','49']] }
          ]
        },
        {
          title: 'Salon Services', sub: 'In-salon Daraga Main',
          cats: [
            { name: 'Hair Services', g: 'hair', items: [['Haircut','30','Promo'], ['Blow Dry','50'], ['Hair Ironing', '199'], ['Hair Setting', '250'], ['Curl Setting', '350'], ['Organic Rebonding (any length)', '999', 'Promo']] },
            { name: 'Hair & Scalp Treatment', g: 'hair', items: [['Hot Oil', '199'], ['Hair Spa', '299'], ['Hair Cellophane','399'], ['Hair Color','499'], ['Keratin Treatment','499'], ['Brazilian Treatment','899'], ['Amazon Flowers', '3,500']] },
            { name: 'Hair & Make-Up', g: 'hair', items: [['Hair & Make-up Wedding, Debut, Birthday, Graduation','700']] },
            { name: 'Nails & Spa Services', g: 'nails', items: [['Manicure','49','Promo'], ['Pedicure','49','Promo'], ['Foot Spa','149'], ['Hand Spa', '399'], ['Semi-Gel Polish', '199'], ['Gel Polish','399'], ['Soft Gel Extensions','1,500']] },
            { name: 'Lash & Brows Special', g: 'lash', items: [['Eyebrow Threading','50'], ['Brow Lamination', '399'], ['Eyelash Lift','399'], ['Eyelash Lift w/ Tint', '599'], ['Eyelash Extensions','599'], ['Microblading','2,500']] },
            { name: 'Face & Body Treatment', g: 'skin', items: [['Underarm Wax', '100'], ['Underarm Whitening', '300'], ['Basic Facial', '499'], ['Diamond Peel', '599'], ['Whole Body Massage', '499'], ['Body Scrub', '999'], ['Warts Removal', '1,500']] }
          ]
        },
        {
          title: 'Skin Care Center', sub: 'Daraga Main',
          cats: [
            { name: 'Facial', g: 'skin', items: [['Basic Facial / Whitening', '350'], ['Acne Clear Facial', '499'], ['Add-on Dr. Mask', '299']] },
            { name: 'Foot Spa & Waxing', g: 'nails', items: [['Regular Foot Spa', '89'], ['Whitening mask', '149'], ['Special Foot Spa', '399'], ['Waxing', '99']] },
            { name: 'Nail Care', g: 'nails', items: [['Regular Polish', '49'], ['Weekly Polish', '199'], ['Gel Polish', '399']] },
            { name: 'Lashes & Body', g: 'lash', items: [['Eyelash Extension', '599'], ['Eyelash Perming', '199'], ['Eyelash Remover', '299'], ['Body Scrub', '999']] }
          ]
        },
        {
          title: 'Aesthetics by Nurse Jemar', sub: 'Clinic room, same address',
          cats: [
            { name: 'Featured Promo', g: 'deals', items: [['Threading', '49'], ['Underarm Waxing', '99'], ['Signature Facial', '499'], ['Whitening Drip', '888']] },
            { name: 'Aesthetics Promo', g: 'deals', items: [['Microblading', '999','Promo'], ['Eyeliner', '999','Promo'], ['Lip Pigmentation', '999','Promo']] },
            { name: 'Facial Services', g: 'skin', items: [['Collagen Facial', '599'], ['Black Doll Facial', '699'], ['Diamond Peel', '799'], ['Hydra Facial', '899'], ['Picu Rejuvination', '999'], ['Head Spa w/ Signature Facial', '1,499'], ['Stem Cell Facial', '1,499'], ['Platelet Rich Plasma', '1,999'], ['CO2 Fractional Facial', '1,999'], ['Ultraformer HIFU', '2,999']] },
            { name: 'Permanent Make-Up', g: 'lash', items: [['BB Blush', '999'], ['BB Glow', '999'], ['Lip Pigmentation', '1,499'], ['Eyeliner', '1,499'], ['Microblading', '2,499']] },
            { name: 'Lash Services', g: 'lash', items: [['Eyelash Perm', '399'], ['Eyelash Perm w/ Tint', '599'], ['Classic Eyelash', '599'], ['Volume Eyelash', '699'], ['Cat Eye Eyelash', '699'], ['Mega Volume Eyelash', '799'], ['Hybrid Eyelash', '799']] },
            { name: 'Laser Treatment', g: 'skin', items: [['Diode Laser Treatment', '799'], ['IPL Underarm', '799'], ['IPL Bikini', '799'], ['IPL Legs', '999'], ['Tattoo Removal (per session)', '1,499']] },
            { name: 'Skin Whitening Drips', g: 'skin', items: [['Celebrity Drip', '888'], ['Luminous Drip', '999'], ['Mystical Drip', '1,399'], ['Cindella Drip', '1,499'], ['Snow White Drip', '1,499'], ['Glutax Drip', '1,799'], ['Pro Drip', '1,999']] },
            { name: 'Whitening Push', g: 'skin', items: [['Lush Glow Push', '888'], ['Radiant Push', '999'], ['Super Radiant Push', '1,499']] },
            { name: 'Facial & Gluta Add-Ons', g: 'skin', items: [['Vitamin C', '199'], ['L-Carnitine', '499'], ['Collagen', '599'], ['PDT & Other Facial Mask', '299']] },
            { name: 'Waxing', g: 'skin', items: [['Underarm Wax (cold)', '99'], ['Underarm Wax (hot)', '150'], ['Leg Wax – Half (cold)', '399'], ['Leg Wax – Half (hot)', '499'], ['Leg Wax – Full (cold)', '599'], ['Leg Wax – Full (hot)', '699'], ['Brazilian Wax', '599']] },
            { name: 'Meso Lipo (per session)', g: 'skin', items: [['Lipo – Face', '1,999'], ['Lipo – Plus', '1,499'], ['Face RF', '599'], ['Body RF', '699']] },
            { name: 'Other', g: 'skin', items: [['Warts Removal (per area)', '1,500'], ['Warts Removal (per piece)', '500'], ['Botox (per area)', '4,999']] }
          ]
        },
        {
          title: 'Mobile / Home Service Salon', sub: 'We come to you',
          cats: [
            { name: 'Home Hair', g: 'hair', items: [['Haircut', '150'], ['Blow Dry', '100'], ['Hair Ironing', '399'], ['Curl Setting', '500'], ['Hot Oil', '299'], ['Rebond', '1,999'], ['Amazon', '4,500'], ['Cellophane', '599'], ['Keratin Treatment', '999'], ['Brazilian Blow Out', '1,499'], ['Hair Color', '999'], ['Hair & Make-up', '999']] },
            { name: 'Home Nails, Lash & Spa', g: 'nails', items: [['Eyelash Extensions', '899'], ['Foot Spa', '300'], ['Manicure', '100'], ['Pedicure', '100'], ['Gel Polish', '599'], ['Hand Spa', '499']] }
          ]
        }
      ]
    },
    yashano: {
      promo: 'Haircut with blowdry ₱49 · Manicure or pedicure ₱49',
      menus: [
        {
          title: 'Promos & Best Sellers', sub: 'Skin Brows · Yashano Mall',
          cats: [
            { name: 'Forever Promo', g: 'deals', items: [['Haircut w/ Blowdry (men/women)','49','Promo'], ['Manicure / Pedicure','49','Promo']] },
            { name: 'Promo Deals', g: 'deals', items: [['Microblading','2,499','Promo'], ['Organic Rebond + Free Hair Treatment','999','Promo'], ['Black Doll Facial','699','Promo'], ['Hair Color','499','Promo'], ['Foot Spa','149','Promo']] }
          ]
        },
        {
          title: 'Skin Brows Services', sub: 'Yashano Mall',
          cats: [
            { name: 'Hair Services', g: 'hair', items: [['Haircut', '49'], ['Blowdry', '49'], ['Hair Spa Treatment', '299'], ['Hair Setting / Curl', '299'], ['Hair Ironing', '299'], ['Cellophane Treatment', '399'], ['Keratin Treatment', '499'], ['Organic Hair Color', '899'], ['Brazilian Treatment', '899'], ['L’Oréal Treatment', '999'], ['Stem Cell Treatment', '1,499'], ['Brazilian Blowout Treatment', '1,499'], ['Luxury Treatment', '1,499'], ['Amazon Flowers', '3,499']] },
            { name: 'Nails & Spa Services', g: 'nails', items: [['Manicure', '49'], ['Pedicure', '49'], ['Semi Gel', '199'], ['Foot Spa', '149'], ['Special Foot Spa', '399'], ['Hand Spa', '399'], ['Organic Gel Polish', '499'], ['Soft Gel Extensions', '799']] },
            { name: 'Facial Services', g: 'skin', items: [['Basic Organic Facial','499'], ['Diamond Peel','699'], ['Acne Clear Facial','699'], ['Hydra Facial','799'], ['Red Cell Facial', '1,499'], ['PRP Facial (Vampire Facial)','1,999']] },
            { name: 'Skin Brows Specials', g: 'lash', items: [['Threading', '49'], ['BB Glow', '999'], ['BB Blush', '999'], ['Warts Removal (unlimited)', '1,499'], ['Permanent Eyeliner', '1,999'], ['Lip Pigmentation', '1,999'], ['Microblading', '2,499']] },
            { name: 'Lash Special Services', g: 'lash', items: [['Eyelash Lift', '399'], ['Eyelash Lift w/ Tint', '599'], ['Classic Lash Extensions', '599'], ['Volume Lash Extensions', '699'], ['Cat Eye Lash Extensions', '799'], ['Mega Volume Lash Extensions', '799']] },
            { name: 'Laser & Underarm Treatments', g: 'skin', items: [['Underarm Waxing (cold wax)', '149'], ['Underarm Waxing (hot wax)', '199'], ['IPL Underarm Laser (per session)', '499'], ['Diode Laser Treatment', '699'], ['Underarm Bleaching', '999']] },
            { name: 'Whitening Drips (per session)', g: 'skin', items: [['Celebrity Drip', '888'], ['Luminous Drip', '999'], ['Mystical Drip', '1,399'], ['Cindella Drip', '1,499'], ['Snow White Drip', '1,499'], ['Glutax Drip', '1,799'], ['Pro Drip', '1,999']] },
            { name: 'Whitening Push (per session)', g: 'skin', items: [['Lush Glow Push', '888'], ['Radiant Push', '999'], ['Super Radiant Push', '1,399']] },
            { name: 'Other Services', g: 'skin', items: [['Leg Wax – Half (cold wax)', '399'], ['Leg Wax – Half (hot wax)', '499'], ['Leg Wax – Full (cold wax)', '599'], ['Leg Wax – Full (hot wax)', '699'], ['Brazilian Wax', '599'], ['Mesolipo (per session)', '1,499'], ['Botox (per session)', '4,999'], ['Revok 50 (per session)', '14,999']] }
          ]
        }
      ]
    },
    cabangan: {
      promo: 'Organic rebond, any length ₱999 · Manicure or pedicure ₱49',
      menus: [
        {
          title: 'Best Sellers & Packages', sub: 'Cabangan Hub',
          cats: [
            { name: 'Best Sellers', g: 'deals', items: [['Organic Rebond (any length)','999','Promo'], ['Eyelash Extensions','599','Promo'], ['Hair Color w/ Keratin (any length)','998','Promo'], ['Special Foot Spa','399','Promo'], ['Organic Hair Color (any length)','899','Promo'], ['Basic Facial','499','Promo']] },
            { name: 'Best Selling Hair Packages', g: 'deals', items: [['Rebond + Hair Color + Brazilian Botox (any length)', '2,397'], ['Hair Color + Highlights + Brazilian Botox (any length)', '2,397'], ['Hair Color + Brazilian Botox (any length)', '1,398']] }
          ]
        },
        {
          title: 'Complete Salon Services', sub: 'Also available at Cabangan Hub',
          cats: [
            { name: 'Hair Services', g: 'hair', items: [['Haircut','30'], ['Blow Dry','50'], ['Hair Ironing','199'], ['Hair Setting','250'], ['Curl Setting','350'], ['Organic Rebonding (any length)','999']] },
            { name: 'Hair & Scalp Treatment', g: 'hair', items: [['Hot Oil','199'], ['Hair Spa','299'], ['Hair Cellophane','399'], ['Keratin Treatment','499'], ['Brazilian Treatment','899'], ['Hair Color','499'], ['Amazon Flowers','3,500']] },
            { name: 'Hair & Make-Up Services', g: 'hair', items: [['Hair & Make-up — Wedding','700'], ['Hair & Make-up — Debut','700'], ['Hair & Make-up — Birthday','700'], ['Hair & Make-up — Graduation','700']] },
            { name: 'Nails & Spa Services', g: 'nails', items: [['Manicure','49'], ['Pedicure','49'], ['Hand Spa','399'], ['Semi-Gel Polish','199'], ['Gel Polish','399'], ['Soft Gel Extensions','1,500']] },
            { name: 'Lash & Brows Special', g: 'lash', items: [['Eyebrow Threading','50'], ['Brow Lamination','399'], ['Eyelash Lift','399'], ['Eyelash Lift w/ Tint','599'], ['Eyelash Extensions','599'], ['Microblading','2,500']] },
            { name: 'Face & Body Treatment', g: 'skin', items: [['Underarm Wax','100'], ['Underarm Whitening','300'], ['Basic Facial','499'], ['Diamond Peel','599'], ['Whole Body Massage','499'], ['Body Scrub','999'], ['Warts Removal','1,500']] }
          ]
        },
        {
          title: 'Lash & Brow Studio', sub: 'Cabangan Hub',
          cats: [
            { name: 'Hair', g: 'hair', items: [['Organic Rebond (any length)','999','Promo'], ['Organic Hair Color (any length)', '899'], ['Hair Color w/ Keratin (any length)','998']] },
            { name: 'Nails & Spa', g: 'nails', items: [['Manicure', '49'], ['Pedicure', '49'], ['Foot Spa', '149'], ['Hand Spa', '399'], ['Special Foot Spa', '399'], ['Gel Polish', '499'], ['Softgel Extension', '1,499']] },
            { name: 'Facial', g: 'skin', items: [['Basic Facial', '499'], ['Acne Clear Facial', '599'], ['Carbon Laser Peel', '699'], ['Timeless Anti-Aging', '799'], ['Firm Bright Facial (w/ Diamond Peel)', '899'], ['Aqua Facial', '999'], ['Meso Lipo', '999']] },
            { name: 'Facial Promo Board', g: 'skin', items: [['Basic Facial', '499'], ['Diamond Peel Facial', '599'], ['Acne Clear Facial', '699'], ['Carbon Laser / Black Doll', '699'], ['Skin Planing Facial', '999'], ['Platelet Rich Plasma Facial', '2,499']] },
            { name: 'Waxing / Threading', g: 'skin', items: [['Eyebrows', '49'], ['Upper Lips', '49'], ['Underarms', '50'], ['Lower Legs', '149'], ['Brazilian', '499'], ['Warts Removal', '1,500']] },
            { name: 'Lash & Brows Specials', g: 'lash', items: [['Lash Removal', '299'], ['Korean Lash Lift','399'], ['Korean Lash Lift w/ Tint', '599'], ['Classic Lash','599'], ['Mega Volume Lash','699'], ['Microblading','2,500']] },
            { name: 'IPL Permanent Hair Removal', g: 'skin', items: [['Underarm (per session)', '499'], ['Bikini (per session)', '799']] },
            { name: 'Massage Services', g: 'skin', items: [['Swedish Massage', '499'], ['Shiatsu Massage', '499'], ['Signature Massage', '499'], ['Foot Massage', '349']] }
          ]
        },
        {
          title: 'Aesthetics Menu', sub: 'Gluta · Facial · Botox',
          cats: [
            { name: 'Beauty Drip (per session)', g: 'skin', items: [['Tationil', '999'], ['TAD', '999'], ['Luminous', '999'], ['Mystical', '1,299'], ['Cindella', '1,499'], ['Snow White', '1,499'], ['Glutax', '1,999']] },
            { name: 'Beauty Push (per session)', g: 'skin', items: [['Radiant Glow', '999'], ['Luminous', '999'], ['Super Radiant', '1,399']] },
            { name: 'Drip & Push Packages (5+1)', g: 'deals', items: [['Luminous Glow Drip', '4,999'], ['Snow White Drip', '7,499'], ['Radiant Gluta Push', '4,999'], ['Super Radiant Glow Push', '6,995'], ['Pro Drip', '9,995']] },
            { name: 'Drip & Push Packages (10+2)', g: 'deals', items: [['Luminous Glow Drip', '9,999'], ['Snow White Drip', '14,999'], ['Radiant Gluta Push', '9,999'], ['Super Radiant Glow Push', '13,990'], ['Pro Drip', '19,990']] },
            { name: 'Aesthetics Facial (per session)', g: 'skin', items: [['Basic Facial', '499'], ['Diamond Peel', '599'], ['Acne Clear Facial', '599'], ['Timeless Anti-Aging', '799'], ['Firm Bright Facial', '899'], ['Black Doll', '999'], ['Vampire Facial', '1,999'], ['Special PRP', '2,499']] },
            { name: 'Skin Boosters (per session)', g: 'skin', items: [['Acne Clear Healer', '1,999'], ['Red Cell / Stem Cell', '1,999'], ['Lucia / Anti-Melasma', '1,999']] },
            { name: 'Add-Ons (per session)', g: 'skin', items: [['Vitamin C', '199'], ['Collagen', '499'], ['L-Carnitine', '599']] },
            { name: 'Meso Lipo (per session)', g: 'skin', items: [['Lipo – Face', '1,999'], ['Lipo – Plus', '1,499'], ['Face RF', '499'], ['Body RF', '599']] },
            { name: 'IPL Laser (per session)', g: 'skin', items: [['Underarm Whitening', '499'], ['Bikini Whitening', '799']] },
            { name: 'Other', g: 'skin', items: [['Warts Removal (per piece)', '500'], ['BB Blush (per session)', '1,499'], ['Warts Removal (per area)', '1,500'], ['BB Glow (per session)', '1,999'], ['Botox (per area)', '4,999']] }
          ]
        }
      ]
    }
  };

  // Section 5 of the price list — "GROUP-WIDE PROMOS & PACKAGES", valid at all three branches.
  const GROUP_WIDE_MENU = {
    title: 'Group-Wide Promos & Packages', sub: 'Valid at all three branches',
    cats: [
      { name: 'SALE! Permanent Make-Up', g: 'deals', items: [['6D Eyebrow Microblading', '999', 'Best Seller'], ['Top Eyeliner', '999', 'Best Seller'], ['Derma Pen', '999', 'Best Seller'], ['Korean BB Glow', '999', 'Promo'], ['Combo Brows', '999', 'Best Seller'], ['Lip Pigmentation', '999', 'Promo'], ['Package: Lips 6D & Eyeliner (free aftercare kit)', '1,499'], ['Package: Lip Pigmentation & Combo Brows (free aftercare kit)', '1,499']] },
      { name: 'Eyelash Extensions', g: 'lash', items: [['Classic Lash', '599'], ['Volume Lash', '699'], ['Cat Eye Lash', '699'], ['Doll Eye Lash', '799'], ['Hybrid Lash', '799'], ['Mega Volume Lash', '899']] },
      { name: 'Gift Certificates', g: 'deals', items: [['Gift Certificate (₱500 denomination)', '500'], ['Gift Certificate (₱1,000 denomination)', '1,000']] }
    ]
  };

  // Append the group-wide menu to every branch.
  ['daraga', 'yashano', 'cabangan'].forEach(b => SERVICE_DATA[b].menus.push(GROUP_WIDE_MENU));

  const SERVICE_GROUPS = [
    { k:'deals', label:'Deals' },
    { k:'hair', label:'Hair' },
    { k:'nails', label:'Nails' },
    { k:'lash', label:'Lash & Brows' },
    { k:'skin', label:'Skin' }
  ];

  let currentSvcBranch = 'daraga';
  let activeSvcGroup = 'all';
  let svcAllOpen = true;

  function renderServices() {
    const svcMenus = document.getElementById('svcMenus');
    const svcGroups = document.getElementById('svcGroups');
    const svcPromo = document.getElementById('svcPromo');
    const svcPromoText = document.getElementById('svcPromoText');
    const svcEmpty = document.getElementById('svcEmpty');
    const svcCount = document.getElementById('svcCount');
    if (!svcMenus) return;

    const bData = SERVICE_DATA[currentSvcBranch];
    if (!bData) return;
    const branchLabel = BRANCH_LABEL[currentSvcBranch] || currentSvcBranch;

    // Tell the customer which branch the prices below belong to
    const svcBranchNow = document.getElementById('svcBranchNow');
    if (svcBranchNow) svcBranchNow.textContent = branchLabel;
    const svcPromoBranch = document.getElementById('svcPromoBranch');
    if (svcPromoBranch) svcPromoBranch.textContent = branchLabel;

    if (bData.promo) {
      svcPromo.classList.remove('hidden');
      svcPromoText.textContent = bData.promo;
    } else {
      svcPromo.classList.add('hidden');
    }

    svcGroups.innerHTML = SERVICE_GROUPS.map(g =>
      `<button onclick="setSvcGroup('${g.k}')" class="svc-grp ${activeSvcGroup === g.k ? 'on' : ''} rounded-2xl p-3 text-left">
         <span class="block text-xs font-bold">${g.label}</span>
       </button>`).join('');

    const q = (document.getElementById('svcFilter')?.value || '').trim().toLowerCase();
    document.getElementById('svcFilterClear')?.classList.toggle('hidden', !q);

    let html = '';
    let shown = 0;

    bData.menus.forEach(m => {
      m.cats.forEach(c => {
        if (activeSvcGroup !== 'all' && c.g !== activeSvcGroup) return;
        const items = q ? c.items.filter(i => i[0].toLowerCase().includes(q)) : c.items;
        if (!items.length) return;
        shown += items.length;

        const rows = items.map(i => {
          const name = i[0], price = i[1], tag = i[2];
          return `
            <button type="button" class="svc-row w-full flex items-center py-2.5 text-left border-b border-bronze/10 last:border-0"
                    data-svc="${escAttr(name)}" data-price="${escAttr(price)}">
              <span class="text-xs font-semibold text-ink">${name}</span>
              ${tag ? `<span class="ml-2 text-[9px] font-bold uppercase tracking-widest text-copper-dark bg-copper/15 rounded-full px-2 py-0.5 shrink-0">${tag}</span>` : ''}
              <span class="svc-lead"></span>
              <span class="svc-book mr-2">Book</span>
              <span class="text-xs font-bold text-ink whitespace-nowrap">₱${price}</span>
            </button>`;
        }).join('');

        html += `
          <div class="svc-acc bg-panel rounded-2xl mb-3 ${svcAllOpen || q ? 'open' : ''} border border-bronze/20">
            <button type="button" class="svc-acc-head w-full px-5 py-3.5 flex justify-between items-center gap-3 text-left">
              <span class="font-bold text-xs uppercase tracking-widest text-plum">${c.name}</span>
              <span class="flex items-center gap-3 shrink-0">
                <span class="text-[10px] font-semibold text-ink/35">${items.length} item${items.length > 1 ? 's' : ''}</span>
                <svg class="svc-chev text-ink/40" width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4"><path d="M6 9l6 6 6-6"/></svg>
              </span>
            </button>
            <div class="svc-acc-panel">
              <div class="px-5 pb-2 border-t border-bronze/10">${rows}</div>
            </div>
          </div>`;
      });
    });

    svcMenus.innerHTML = html;
    if (svcEmpty) svcEmpty.classList.toggle('hidden', shown > 0);
    if (svcCount) svcCount.textContent = shown
      ? `${shown} service${shown > 1 ? 's' : ''} · ${branchLabel}`
      : '';
    const expandBtn = document.getElementById('svcExpandAll');
    if (expandBtn) expandBtn.textContent = svcAllOpen ? 'Close all' : 'Open all';
  }

  /* Services menu interactions — delegated so they survive re-renders. */
  (function () {
    const svcMenus = document.getElementById('svcMenus');
    if (!svcMenus) return;

    svcMenus.addEventListener('click', e => {
      const head = e.target.closest('.svc-acc-head');
      if (head) { head.parentElement.classList.toggle('open'); return; }
      const row = e.target.closest('.svc-row');
      if (row) bookService(row.dataset.svc, '₱' + row.dataset.price, currentSvcBranch);
    });

    const filter = document.getElementById('svcFilter');
    let t = null;
    filter?.addEventListener('input', () => {
      clearTimeout(t);
      t = setTimeout(renderServices, 140);
    });

    document.getElementById('svcFilterClear')?.addEventListener('click', () => {
      filter.value = '';
      renderServices();
      filter.focus();
    });

    document.getElementById('svcExpandAll')?.addEventListener('click', () => {
      svcAllOpen = !svcAllOpen;
      renderServices();
    });
  })();

  function setSvcGroup(g) {
    // Tapping the active category again clears the filter and shows every service.
    activeSvcGroup = (activeSvcGroup === g) ? 'all' : g;
    renderServices();
  }

  /* Branch rate cards. Only one branch can be selected at a time, so the
     'on' class is cleared from all of them before it is added to the one
     that was clicked. */
  document.querySelectorAll('.svc-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentSvcBranch = btn.dataset.s;
      highlightSvcBranch();
      renderServices();
    });
  });

  function highlightSvcBranch() {
    document.querySelectorAll('.svc-tab-btn').forEach(b => {
      b.classList.toggle('on', b.dataset.s === currentSvcBranch);
    });
  }

  const STAFF_DATA = {
    daraga: {
      name: 'Leo Mejillano Salon & Make Up Studio',
      roles: [
        { title: 'Hair', bookable: true, staff: ['Victoricia Romero', 'Marichu Lobrino', 'Jeffrey Ascutia', 'Jayson Mangampo', 'Albert Bernaldez', 'Eugene Smith', 'Sherwan Velamo'] },
        { title: 'Nails', bookable: true, staff: ['Jessica Tafalla Mata', 'Cathy Landeres Alcantara', 'Maricel Baloso', 'Glady Buen', 'Analiza Ebron', 'Donna Maravillas', 'Sherlyn Reyes'] },
        { title: 'Aesthetics', bookable: true, staff: ['Sallymaria Gamboa'] },
        { title: 'Front Desk', bookable: false, staff: ['Analyn Antonio — Cashier', 'Abegail Mendoza — Stock Clerk'] }
      ]
    },
    yashano: {
      name: 'Skin Brows by Leo Mejillano',
      roles: [
        { title: 'Hair', bookable: true, staff: ['Christian Albo', 'Jennifer Luna', 'Rogelyn Zata', 'Jessie Barcelon', 'Roger Canedo', 'Arnold Go-as'] },
        { title: 'Nails', bookable: true, staff: ['April Guadonia', 'Mary Anne Bolictar', 'Amelia Lozono', 'Alma Mo', 'Nicole Llaguno', 'Eva Mejillano', 'Judith Bolictar', 'Ojie Beloso', 'Gina Rabulan', 'Sandra Dayson'] },
        { title: 'Aesthetics', bookable: true, staff: ['Sherry Anne Naje'] },
        { title: 'Front Desk', bookable: false, staff: ['Maricel Anonuevo — Cashier', 'Rosalie Mendoza — Stock Clerk'] }
      ]
    },
    cabangan: {
      name: 'Lash & Brows by Leo Mejillano',
      roles: [
        { title: 'Hair', bookable: true, staff: ['Nikko Espinas', 'Kim Miller', 'Patricia Velasco', 'Albert Restoles', 'Rose Ann Noleal', 'Lorens Crespo', 'Lea Acosta', 'Jairo Penilla'] },
        { title: 'Nails', bookable: true, staff: ['Shiela Luna', 'Bella Etnama', 'Jenny Balbalosa', 'Cielo Ayala', 'Chinten Ani', 'Jeniviev Ebuenga', 'Mary Rose Yona', 'Marie Martillana', 'Precious Orelina', 'Roseth Ortega'] },
        { title: 'Aesthetics', bookable: true, staff: ['Angelica Moral'] },
        { title: 'Front Desk', bookable: false, staff: ['Sheryl Mejillano — Cashier', 'Melodi Atoli — Stock Clerk'] }
      ]
    }
  };

  let currentStaffBranch = 'daraga';

  function renderStaff() {
    const roster = document.getElementById('staffRoster');
    if(!roster) return;
    const data = STAFF_DATA[currentStaffBranch];
    document.getElementById('staffStudioName').textContent = data.name;
    
    let totalStaff = 0;
    data.roles.forEach(r => totalStaff += r.staff.length);
    document.getElementById('staffStudioCount').textContent = `${totalStaff} Team Members`;

    const getInitials = (name) => {
      const parts = name.split(' ');
      if (parts.length > 1 && !parts[1].includes('—')) {
        return (parts[0][0] + parts[1][0]).toUpperCase();
      }
      return (parts[0][0] + (parts[0][1] || '')).toUpperCase();
    };

    let html = '';
    data.roles.forEach(role => {
      html += `
        <div class="mb-10">
          <div class="flex items-center gap-4 mb-5">
            <h4 class="text-[11px] font-bold uppercase tracking-widest text-copper-dark whitespace-nowrap">${role.title}</h4>
            <span class="text-[11px] font-semibold text-ink/30 tabular-nums">${role.staff.length}</span>
            <span class="flex-1 h-px bg-bronze/30"></span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
      `;

      role.staff.forEach(s => {
        let nameOnly = s.split(' — ')[0];
        let title = s.split(' — ')[1] || (role.title === 'Hair' ? 'Stylist' : role.title === 'Nails' ? 'Nail Tech' : 'Aesthetician');
        
        if (role.bookable) {
          html += `
            <button onclick="bookService('Appointment with ${nameOnly}', '', '${currentStaffBranch}')" class="bg-panel p-4 rounded-2xl border border-bronze/20 shadow-sm text-left hover:-translate-y-1 hover:shadow-md hover:border-plum/30 transition duration-300 group">
              <div class="w-10 h-10 rounded-full bg-plum text-white font-bold flex items-center justify-center text-xs mb-3 group-hover:bg-copper transition">${getInitials(nameOnly)}</div>
              <span class="block font-bold text-[13px] text-ink leading-tight">${nameOnly}</span>
              <span class="block text-[10px] text-plum font-bold mt-1 uppercase tracking-wider">Book ${title}</span>
            </button>
          `;
        } else {
          html += `
            <div class="bg-panel/60 p-4 rounded-2xl border border-bronze/10 text-left opacity-80 cursor-default">
              <div class="w-10 h-10 rounded-full bg-sand-200 text-copper-dark font-bold flex items-center justify-center text-xs mb-3">${getInitials(nameOnly)}</div>
              <span class="block font-bold text-[13px] text-ink leading-tight">${nameOnly}</span>
              <span class="block text-[10px] text-ink/50 font-bold mt-1 uppercase tracking-wider">${title}</span>
            </div>
          `;
        }
      });

      html += `
          </div>
        </div>
      `;
    });
    roster.innerHTML = html;
  }

  document.querySelectorAll('.staff-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      currentStaffBranch = btn.dataset.t;
      document.querySelectorAll('.staff-tab-btn').forEach(b => b.classList.remove('bg-plum', 'text-white'));
      btn.classList.add('bg-plum', 'text-white');
      renderStaff();
    });
  });

  const branchMap = {
    daraga: {
      tag: 'Flagship Hub',
      name: 'Leo Mejillano Salon & Make-Up Studio',
      addr: '2nd Floor, Luna Building, Regidor Street, Daraga, Albay',
      spec: "Step into the Leo Mejillano beauty experience at our flagship Daraga branch, where professional beauty services, personalized care, and expertise come together. From hair, nails, skin, brows, and make-up to academy training, our team is dedicated to making every visit comfortable, memorable, and uniquely yours. Whether you're refreshing your look, preparing for a special occasion, or simply taking time for yourself, we're ready to help you look and feel your best.",
      hours: '8:00 AM – 8:00 PM', hoursNote: 'Open Daily',
      phone: '0918 536 8016', tel: '+639185368016', email: 'leomejillano88@yahoo.com',
      phone2: '0907 869 6035', tel2: '+639078696035', phone2Label: 'Aesthetics line — Nurse Jemar',
      img: 'assets/image/Daraga.png'
    },
    yashano: {
      tag: 'Mall Studio',
      name: 'Skin Brows by Leo Mejillano',
      addr: '2nd Floor, Yashano Mall, Legazpi City, Albay',
      landmark: "Beside Angel's Pizza",
      spec: "Discover a beauty experience designed to help you feel confident, refreshed, and beautifully cared for at Skin Brows by Leo Mejillano. Conveniently located on the 2nd Floor of Yashano Mall beside Angel's Pizza, our branch provides a comfortable and professional space where you can take time for yourself and enjoy personalized beauty care. From skin and brow enhancement to other beauty treatments, our team is committed to giving every client attentive service and an experience tailored to their individual needs. Whether you're preparing for a special occasion, maintaining your beauty routine, or simply treating yourself to some well-deserved self-care, we're here to help you look and feel your best.",
      hours: '9:30 AM – 8:00 PM', hoursNote: 'Open Daily',
      phone: '0918 536 8016', tel: '+639185368016', email: '',
      phone2: '0907 869 6035', tel2: '+639078696035', phone2Label: 'Aesthetics line — Nurse Jemar',
      img: 'assets/image/Yashano.jpg'
    },
    cabangan: {
      tag: 'Lash & Brow Hub',
      name: 'Lash & Brows by Leo Mejillano',
      addr: 'Brgy. 18, Rizal Street, Cabangan, Legazpi City, Albay',
      spec: "Discover personalized beauty care at Lash & Brows by Leo Mejillano in Cabangan, where professional service and attention to detail come together to create a beauty experience made for you. From fresh haircuts and hair treatments to rebonding, hair color, lash, and brow services, our team is dedicated to helping you achieve a look that feels confident, beautiful, and uniquely yours. Whether you're looking for a simple refresh, a complete hair transformation, or beauty enhancements for a special occasion, take a moment to relax, enjoy professional care, and let our team bring your desired look to life.",
      hours: '8:00 AM – 8:00 PM', hoursNote: 'Open Daily',
      phone: '0918 536 8016', tel: '+639185368016', email: 'mejillanoleo@gmail.com',
      img: 'assets/image/Cabangan.jpg'
    }
  };

  document.querySelectorAll('.branch-tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.branch-tab-btn').forEach(b => b.classList.remove('bg-white/10'));
      btn.classList.add('bg-white/10');
      const b = branchMap[btn.dataset.b];
      document.getElementById('bTag').textContent = b.tag;
      document.getElementById('bName').textContent = b.name;
      document.getElementById('bAddr').textContent = b.addr;
      const lm = document.getElementById('bLandmark');
      lm.textContent = b.landmark || '';
      lm.classList.toggle('hidden', !b.landmark);
      document.getElementById('bSpec').textContent = b.spec;
      document.getElementById('bHours').textContent = b.hours;
      document.getElementById('bHoursNote').textContent = b.hoursNote;
      document.getElementById('bPhoneText').textContent = b.phone;
      document.getElementById('bPhone').href = 'tel:' + b.tel;
      const em = document.getElementById('bEmail');
      em.classList.toggle('hidden', !b.email);
      em.classList.toggle('flex', !!b.email);
      document.getElementById('bEmailText').textContent = b.email || '';
      em.href = b.email ? 'mailto:' + b.email : '#';
      const p2 = document.getElementById('bPhone2');
      p2.classList.toggle('hidden', !b.phone2);
      p2.classList.toggle('flex', !!b.phone2);
      if (b.phone2) {
        document.getElementById('bPhone2Text').textContent = b.phone2;
        document.getElementById('bPhone2Label').textContent = b.phone2Label || '';
        p2.href = 'tel:' + b.tel2;
      }
      document.getElementById('bImg').src = b.img;
    });
  });

  // Status vocabulary matches the `home_service_requests.status` ENUM in
  // the database exactly (see trackBooking.php) — 'Cancelled' is a
  // terminal state handled separately, not a step in this progression.
  const HS_STATUSES = ['Pending Review', 'Confirmed', 'Completed'];
  // Customer-facing labels -- the database enum ('Pending Review', etc.) is
  // internal; guests should see the friendlier wording everywhere it's shown.
  const HS_STATUS_LABELS = { 'Pending Review': 'Under Review' };
  function hsStatusLabel(status) { return HS_STATUS_LABELS[status] || status; }
  let hsSelectedServices = [];
  let hsSelectedWeddingPackage = null;
  let hsWeddingMode = false;
  const HS_WEDDING_PACKAGES = [
    {
      name: 'Package A', price: 5000, reservationFee: null,
      short: 'Traditional bridal makeup, two bridal looks, groom grooming, and styling for 2 heads.',
      inclusions: [
        'Hairstyle and Traditional Makeup for the Bride',
        'Prep Look and Ceremony Look',
        'Unlimited touch-up until the Bride leaves the hotel for the ceremony',
        'Groom Grooming, only if the Groom is at the same preparation venue',
        'Hairstyle and Traditional Makeup for 2 heads'
      ]
    },
    {
      name: 'Package B', price: 8000, reservationFee: null,
      short: 'Airbrush bridal makeup, two bridal looks, groom grooming, and styling for 2 heads.',
      inclusions: [
        'Hairstyle and Airbrush Makeup for the Bride',
        'Prep Look and Ceremony Look',
        'Unlimited touch-up until the Bride leaves the hotel for the ceremony',
        'Groom Grooming, only if the Groom is at the same preparation venue',
        'Hairstyle and Traditional Makeup for 2 heads'
      ]
    },
    {
      name: 'Package C', price: 10000, reservationFee: null,
      short: 'Airbrush bridal makeup, prep, ceremony and reception looks, plus styling for 2 heads.',
      inclusions: [
        'Hairstyle and Airbrush Makeup for the Bride',
        'Prep Look and Ceremony Look',
        'Unlimited touch-up until the Bride leaves the hotel for the ceremony',
        'Reception Look / Change Look for the Bride',
        'Groom Grooming, only if the Groom is at the same preparation venue',
        'Hairstyle and Traditional Makeup for 2 heads'
      ]
    },
    {
      name: 'Package D', price: 12000, reservationFee: 2000,
      short: 'Complete airbrush bridal coverage with reception look and styling for 7 heads.',
      inclusions: [
        'Hairstyle and Airbrush Makeup for the Bride',
        'Prep Look and Ceremony Look',
        'Unlimited touch-up until the Bride leaves the hotel for the ceremony',
        'Reception Look / Change Look for the Bride',
        'Groom Grooming, only if the Groom is at the same preparation venue',
        'Hairstyle and Traditional Makeup for 7 heads'
      ]
    }
  ];
  let hsFeedbackRef = '';
  let hsFeedbackPhone = '';
  const hsRatings = { service: 0, staff: 0 };
  function hsJump(id) {
    switchTab('homeservice-tab');
    setTimeout(() => document.getElementById(id)?.scrollIntoView({ behavior:'smooth', block:'start' }), 120);
  }

  function hsPreset(type) {
    const sel = document.getElementById('hsEventType');
    if (sel) {
      sel.value = type;
      hsSyncWeddingPackages();
    }
    hsJump('hsRequest');
  }

  function hsPeso(amount) {
    return '₱' + Number(amount).toLocaleString('en-PH');
  }

  function hsRenderWeddingPackages() {
    const grid = document.getElementById('hsWeddingPackageGrid');
    if (!grid || grid.children.length) return;
    grid.innerHTML = HS_WEDDING_PACKAGES.map((pkg, index) => `
      <article class="hs-wedding-card rounded-2xl border border-bronze/30 bg-sand-100 p-5 transition" data-package-index="${index}">
        <div class="flex items-start justify-between gap-3">
          <div>
            <span class="text-[10px] font-bold uppercase tracking-widest text-copper">Wedding Package</span>
            <h5 class="font-display text-xl mt-1">${pkg.name}</h5>
          </div>
          <b class="text-plum text-lg">${hsPeso(pkg.price)}</b>
        </div>
        <p class="text-[12px] text-ink/60 mt-3 leading-relaxed">${pkg.short}</p>
        <p class="text-[12px] font-semibold mt-3 ${pkg.reservationFee === null ? 'text-ink/55' : 'text-copper-dark'}">Reservation Fee: ${pkg.reservationFee === null ? 'To be confirmed after review.' : hsPeso(pkg.reservationFee)}</p>
        <button type="button" onclick="hsToggleWeddingDetails(${index}, this)" class="mt-4 text-[11px] font-bold uppercase tracking-widest text-plum hover:underline">View Full Details</button>
        <div class="hidden mt-3 pt-3 border-t border-bronze/25" data-package-details>
          <p class="text-[10px] font-bold uppercase tracking-widest text-copper mb-2">Includes</p>
          <ul class="space-y-2 text-[12px] text-ink/65 leading-relaxed">${pkg.inclusions.map(item => `<li class="flex gap-2"><span class="text-copper">•</span><span>${item}</span></li>`).join('')}</ul>
        </div>
        <button type="button" onclick="hsSelectWeddingPackage(${index})" class="mt-5 w-full rounded-full border border-plum text-plum text-[11px] font-bold uppercase tracking-widest py-3 hover:bg-plum hover:text-white transition" data-package-select>Select Package</button>
      </article>
    `).join('');
  }

  function hsToggleWeddingDetails(index, button) {
    const card = document.querySelector(`.hs-wedding-card[data-package-index="${index}"]`);
    const details = card?.querySelector('[data-package-details]');
    if (!details) return;
    const expanding = details.classList.contains('hidden');
    details.classList.toggle('hidden', !expanding);
    button.textContent = expanding ? 'Hide Full Details' : 'View Full Details';
  }

  function hsFillWeddingSummary(selector) {
    if (!hsSelectedWeddingPackage) return;
    const pkg = hsSelectedWeddingPackage;
    const values = {
      name: pkg.name,
      price: hsPeso(pkg.price),
      fee: pkg.reservationFee === null ? 'To be confirmed after review.' : hsPeso(pkg.reservationFee),
      balance: pkg.reservationFee === null ? 'To be confirmed after review.' : hsPeso(pkg.price - pkg.reservationFee),
      venue: document.getElementById('hsVenue').value.trim() || '—',
      date: hsFmtDate(document.getElementById('hsDate').value),
      time: hsFmtTime(document.getElementById('hsTime').value)
    };
    document.querySelectorAll(selector).forEach(el => { el.textContent = values[el.dataset.weddingSummary || el.dataset.reviewWedding]; });
  }

  function hsSelectWeddingPackage(index) {
    hsSelectedWeddingPackage = HS_WEDDING_PACKAGES[index];
    hsSelectedServices = [`Wedding ${hsSelectedWeddingPackage.name}`];
    document.querySelectorAll('.hs-wedding-card').forEach((card, cardIndex) => {
      const selected = cardIndex === index;
      card.classList.toggle('border-copper', selected);
      card.classList.toggle('bg-copper/10', selected);
      card.classList.toggle('ring-1', selected);
      card.classList.toggle('ring-copper/40', selected);
      card.classList.toggle('border-bronze/30', !selected);
      card.classList.toggle('bg-sand-100', !selected);
      const button = card.querySelector('[data-package-select]');
      button.textContent = selected ? 'Selected' : 'Select Package';
      button.classList.toggle('bg-plum', selected);
      button.classList.toggle('text-white', selected);
    });
    document.getElementById('hsWeddingLiveSummary')?.classList.remove('hidden');
    hsFillWeddingSummary('[data-wedding-summary]');
  }

  function hsSyncWeddingPackages() {
    document.getElementById('hsOtherEventRow')?.classList.toggle('hidden', document.getElementById('hsEventType').value !== 'Other');
    const isWedding = document.getElementById('hsEventType')?.value === 'Wedding';
    const wasWedding = hsWeddingMode;
    hsWeddingMode = isWedding;
    document.getElementById('hsWeddingPackages')?.classList.toggle('hidden', !isWedding);
    document.getElementById('hsServiceCards')?.classList.toggle('hidden', isWedding);
    document.getElementById('hsNonWeddingPricingNote')?.classList.toggle('hidden', isWedding);
    const heading = document.getElementById('hsServicesHeading');
    const intro = document.getElementById('hsServicesIntro');
    if (heading) heading.textContent = isWedding ? 'Select Wedding Package' : 'What Services Do You Need?';
    if (intro) intro.textContent = isWedding ? 'Choose the package that best fits your wedding day.' : 'Select all that apply.';
    if (isWedding) {
      hsSelectedServices = hsSelectedWeddingPackage ? [`Wedding ${hsSelectedWeddingPackage.name}`] : [];
      hsRenderWeddingPackages();
    } else {
      hsSelectedWeddingPackage = null;
      if (wasWedding) hsSelectedServices = Array.from(document.querySelectorAll('.hs-svc.border-copper')).map(button => button.dataset.svc);
      document.getElementById('hsWeddingLiveSummary')?.classList.add('hidden');
    }
  }

  function hsGo(step, noScroll) {
    document.querySelectorAll('.hs-step').forEach(el => {
      el.classList.toggle('hidden', Number(el.dataset.step) !== step);
    });
    document.querySelectorAll('.hs-prog').forEach(el => {
      const p = Number(el.dataset.p);
      const bar = el.querySelector('span');
      const lbl = el.querySelectorAll('span')[1];
      const done = p <= step || step === 5;
      bar.className = 'block h-1 rounded-full ' + (done ? 'bg-copper' : 'bg-bronze/30');
      lbl.className = 'block text-[10px] font-bold uppercase tracking-widest mt-2 ' + (done ? 'text-copper-dark' : 'text-ink/40');
    });
    if (!noScroll) document.getElementById('hsRequest')?.scrollIntoView({ behavior:'smooth', block:'start' });
  }

  function hsNext(from) {
    if (from === 1) {
      const name = document.getElementById('hsName').value.trim();
      const phone = document.getElementById('hsPhone').value.trim();
      if (!name) { showToast('Please enter your full name'); return; }
      if (!/^09\d{9}$/.test(phone)) { showToast('Please enter a valid 11-digit mobile number'); return; }

      hsGo(2);
    } else if (from === 2) {
      if (!document.getElementById('hsEventType').value) { showToast('Please choose your event type'); return; }
      if (!document.getElementById('hsDate').value) { showToast('Please select a preferred date'); return; }
      if (!document.getElementById('hsTime').value) { showToast('Please select a preferred time'); return; }
      if (!document.getElementById('hsClients').value) { showToast('Please enter the number of clients'); return; }
      if (!document.getElementById('hsVenue').value.trim()) { showToast('Please enter the venue or address'); return; }
      if (!hsValidateSchedule()) return;
      if (document.getElementById('hsEventType').value === 'Other' && !document.getElementById('hsOtherEvent').value.trim()) { showToast('Please specify the event type.'); return; }
      hsGo(3);
    } else if (from === 3) {
      if (document.getElementById('hsEventType').value === 'Wedding' && !hsSelectedWeddingPackage) { showToast('Please select a wedding package'); return; }
      if (!hsSelectedServices.length) { showToast('Please select at least one service'); return; }
      hsBuildReview();
      hsGo(4);
    }
  }

  function hsToggleSvc(btn) {
    const svc = btn.dataset.svc;
    const on = hsSelectedServices.includes(svc);
    if (on) {
      hsSelectedServices = hsSelectedServices.filter(s => s !== svc);
      btn.classList.remove('border-copper', 'bg-copper/10', 'ring-1', 'ring-copper/40');
      btn.classList.add('border-bronze/30', 'bg-sand-100');
    } else {
      hsSelectedServices.push(svc);
      btn.classList.add('border-copper', 'bg-copper/10', 'ring-1', 'ring-copper/40');
      btn.classList.remove('border-bronze/30', 'bg-sand-100');
    }
  }

  function hsFmtDate(d) {
    if (!d) return '—';
    const dt = new Date(d + 'T00:00:00');
    return isNaN(dt) ? d : dt.toLocaleDateString('en-US', { month:'long', day:'numeric', year:'numeric' });
  }

  function hsFmtTime(t) {
    if (!t) return '—';
    const [h, m] = t.split(':').map(Number);
    const ap = h >= 12 ? 'PM' : 'AM';
    const hr = h % 12 === 0 ? 12 : h % 12;
    return hr + ':' + String(m).padStart(2, '0') + ' ' + ap;
  }

  function hsValidateSchedule() {
    const date = document.getElementById('hsDate').value;
    const time = document.getElementById('hsTime').value;
    if (!date || !time || new Date(date + 'T' + time + ':00+08:00').getTime() <= Date.now()) {
      showToast('Please choose a future date and time.');
      return false;
    }
    return true;
  }

  ['hsDate','hsTime'].forEach(id => {
    document.getElementById(id)?.addEventListener('change', () => {
      if (hsSelectedWeddingPackage) hsFillWeddingSummary('[data-wedding-summary]');
    });
  });
  document.getElementById('hsEventType')?.addEventListener('change', hsSyncWeddingPackages);

  function hsBuildReview() {
    const email = document.getElementById('hsEmail').value.trim();
    document.getElementById('rvName').textContent = document.getElementById('hsName').value.trim();
    document.getElementById('rvPhone').textContent = document.getElementById('hsPhone').value.trim();
    document.getElementById('rvEmail').textContent = email || '—';
    document.getElementById('rvEmailRow').classList.toggle('hidden', !email);
    document.getElementById('rvEvent').textContent = document.getElementById('hsEventType').value === 'Other' ? document.getElementById('hsOtherEvent').value.trim() : document.getElementById('hsEventType').value;
    document.getElementById('rvDate').textContent = hsFmtDate(document.getElementById('hsDate').value);
    document.getElementById('rvTime').textContent = hsFmtTime(document.getElementById('hsTime').value);
    document.getElementById('rvClients').textContent = document.getElementById('hsClients').value;
    document.getElementById('rvVenue').textContent = document.getElementById('hsVenue').value.trim();
    const vd = document.getElementById('hsVenueDetails').value.trim();
    document.getElementById('rvVenueDetails').textContent = vd;
    document.getElementById('rvServices').innerHTML = hsSelectedServices
      .map(s => '<li class="flex gap-2.5"><span class="shrink-0 w-1.5 h-1.5 rounded-full bg-copper mt-1.75"></span><span>' + s + '</span></li>').join('');
    const isWedding = document.getElementById('hsEventType').value === 'Wedding';
    document.getElementById('rvStandardServicesCard').classList.toggle('hidden', isWedding);
    document.getElementById('rvWeddingPackageCard').classList.toggle('hidden', !isWedding);
    if (isWedding) hsFillWeddingSummary('[data-review-wedding]');
    document.getElementById('rvNotes').textContent = document.getElementById('hsNotes').value.trim() || '—';
  }

  function hsSubmit() {
    if (!hsValidateSchedule()) return;
    const name = document.getElementById('hsName').value.trim();
    const phone = document.getElementById('hsPhone').value.trim();
    const email = document.getElementById('hsEmail').value.trim();
    const venue = document.getElementById('hsVenue').value.trim();
    const venueDetails = document.getElementById('hsVenueDetails').value.trim();
    const eventType = document.getElementById('hsEventType').value === 'Other' ? document.getElementById('hsOtherEvent').value.trim() : document.getElementById('hsEventType').value;
    const date = document.getElementById('hsDate').value;
    const time = document.getElementById('hsTime').value;
    const clients = document.getElementById('hsClients').value;
    const notes = document.getElementById('hsNotes').value.trim();

    if (!document.getElementById('hsAgreeTerms')?.checked) { showToast('Please agree to the Terms & Conditions'); return; }

    const btn = document.getElementById('hsSubmitBtn');
    if (btn) { btn.disabled = true; btn.textContent = 'Submitting…'; }

    const formData = new FormData();
    formData.append('fullname', name);
    formData.append('contact', phone);
    formData.append('email', email);
    formData.append('address', venue);
    formData.append('venueDetails', venueDetails);
    formData.append('eventType', eventType);
    if (document.getElementById('hsEventType').value === 'Wedding') {
      if (!hsSelectedWeddingPackage) { if (btn) btn.disabled = false; showToast('Please choose a wedding package.'); return; }
      formData.append('weddingPackage', hsSelectedWeddingPackage.name.slice(-1));
    }
    formData.append('date', date);
    formData.append('time', time);
    formData.append('clients', clients);
    hsSelectedServices.forEach(s => formData.append('services[]', s));
    formData.append('requests', notes);
    formData.append('agreedToTerms', '1');

    fetch('backend/public/submitGuestHomeService.php', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(res => {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Home Service Request'; }
        if (!res.success) { showToast(res.message); return; }

        const ref = res.reference;
        document.getElementById('hsRef').textContent = ref;
        const submittedSummary = eventType === 'Wedding' && hsSelectedWeddingPackage ? [
          ['Wedding Package', hsSelectedWeddingPackage.name],
          ['Package Price', hsPeso(hsSelectedWeddingPackage.price)],
          ['Reservation Fee', hsSelectedWeddingPackage.reservationFee === null ? 'To be confirmed after review.' : hsPeso(hsSelectedWeddingPackage.reservationFee)],
          ['Remaining Balance', hsSelectedWeddingPackage.reservationFee === null ? 'To be confirmed after review.' : hsPeso(hsSelectedWeddingPackage.price - hsSelectedWeddingPackage.reservationFee)],
          ['Venue Address', venue], ['Preferred Date', hsFmtDate(date)], ['Preferred Time', hsFmtTime(time)],
          ['Status', 'Under Review']
        ] : [
          ['Event Type', eventType], ['Date', hsFmtDate(date)], ['Time', hsFmtTime(time)],
          ['Clients', clients], ['Location', venue], ['Status', 'Under Review']
        ];
        document.getElementById('hsSummary').innerHTML = submittedSummary
          .map(r => '<p><span class="text-ink/50">' + r[0] + ':</span> <b>' + escAttr(r[1]) + '</b></p>').join('');
        document.getElementById('trkRef').value = ref;
        document.getElementById('trkPhone').value = phone;
        hsGo(5);
      })
      .catch(() => {
        if (btn) { btn.disabled = false; btn.textContent = 'Submit Home Service Request'; }
        showToast('A network error occurred. Please try again.');
      });
  }

  function hsReset() {
    ['hsName','hsPhone','hsEmail','hsClients','hsDate','hsTime','hsVenue','hsVenueDetails','hsNotes','hsOtherEvent'].forEach(id => {
      const el = document.getElementById(id); if (el) el.value = '';
    });
    document.getElementById('hsEventType').value = '';
    const agreeBox = document.getElementById('hsAgreeTerms');
    if (agreeBox) agreeBox.checked = false;
    hsSelectedServices = [];
    hsSelectedWeddingPackage = null;
    document.querySelectorAll('.hs-svc').forEach(b => {
      b.classList.remove('border-copper', 'bg-copper/10', 'ring-1', 'ring-copper/40');
      b.classList.add('border-bronze/30', 'bg-sand-100');
    });
    document.getElementById('hsAvailResult').classList.add('hidden');
    document.getElementById('hsWeddingLiveSummary')?.classList.add('hidden');
    hsSyncWeddingPackages();
    hsGo(1);
  }

  function hsTrack() {
    const ref = document.getElementById('trkRef').value.trim().toUpperCase();
    const phone = document.getElementById('trkPhone').value.trim();
    const box = document.getElementById('trkResult');
    const fb = document.getElementById('hsFeedback');
    box.classList.remove('hidden');

    if (!ref || !phone) {
      box.innerHTML = '<div class="rounded-xl bg-copper/12 border border-copper/30 text-copper-dark p-4 text-[13px]">Enter both your reference number and mobile number.</div>';
      fb.classList.add('hidden');
      return;
    }

    box.innerHTML = '<div class="text-[13px] text-ink/50">Looking up your request…</div>';
    fb.classList.add('hidden');

    fetch('backend/public/trackBooking.php?reference=' + encodeURIComponent(ref) + '&phone=' + encodeURIComponent(phone))
      .then(r => r.json())
      .then(res => {
        if (!res.success) {
          box.innerHTML = '<div class="rounded-xl bg-copper/12 border border-copper/30 text-copper-dark p-4 text-[13px]">' + escAttr(res.message) + '</div>';
          return;
        }
        box.innerHTML = renderTrackingResult(res);

        if (res.canReview) {
          hsFeedbackRef = res.reference;
          hsFeedbackPhone = phone;
          hsRatings.service = 0; hsRatings.staff = 0;
          document.querySelectorAll('#hsFeedback .fb-star').forEach(s => { s.className = 'fb-star text-bronze/40 hover:text-copper transition'; });
          document.getElementById('fbFor').textContent = 'For booking ' + res.reference + ' — ' + (res.event || res.services || '') + '.';
          fb.classList.remove('hidden');
        } else {
          fb.classList.add('hidden');
        }
      })
      .catch(() => {
        box.innerHTML = '<div class="rounded-xl bg-copper/12 border border-copper/30 text-copper-dark p-4 text-[13px]">A network error occurred. Please try again.</div>';
      });
  }

  function hsStar(btn, value) {
    const group = btn.closest('[data-stars]');
    const key = group.dataset.stars;
    hsRatings[key] = value;
    group.querySelectorAll('.fb-star').forEach((s, i) => {
      s.className = 'fb-star transition ' + (i < value ? 'text-copper' : 'text-bronze/40 hover:text-copper');
    });
  }

  function hsSubmitFeedback() {
    if (!hsRatings.service) { showToast('Please rate your experience first'); return; }
    if (!hsFeedbackRef || !hsFeedbackPhone) { showToast('Please look up your request again.'); return; }

    const formData = new FormData();
    formData.append('reference', hsFeedbackRef);
    formData.append('phone', hsFeedbackPhone);
    formData.append('rating', hsRatings.service);
    if (hsRatings.staff) formData.append('staff_rating', hsRatings.staff);
    formData.append('comment', document.getElementById('fbText').value.trim());

    fetch('backend/public/submitGuestFeedback.php', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(res => {
        showToast(res.message);
        if (!res.success) return;
        document.getElementById('fbText').value = '';
        hsRatings.service = 0; hsRatings.staff = 0;
        document.querySelectorAll('#hsFeedback .fb-star').forEach(s => { s.className = 'fb-star text-bronze/40 hover:text-copper transition'; });
        document.getElementById('hsFeedback').classList.add('hidden');
      })
      .catch(() => showToast('A network error occurred. Please try again.'));
  }



  const BRANCH_LABEL = { daraga: 'Daraga Main', yashano: 'Yashano Mall', cabangan: 'Cabangan' };
  // Real branch_id values from the `branches` table — the booking select's
  // <option> values are these IDs, not the labels above.
  const BRANCH_ID_BY_KEY = { daraga: 1, yashano: 2, cabangan: 3 };
  const BRANCH_LABEL_BY_ID = Object.fromEntries(
    Object.entries(BRANCH_ID_BY_KEY).map(([key, id]) => [id, BRANCH_LABEL[key]])
  );
  const BRANCH_HOURS = {
    daraga:   { open: 8 * 60,      close: 20 * 60 },
    yashano:  { open: 9 * 60 + 30, close: 20 * 60 },
    cabangan: { open: 8 * 60,      close: 20 * 60 }
  };

  function refreshLiveStatus() {
    const now = new Date();
    const mins = now.getHours() * 60 + now.getMinutes();
    Object.keys(BRANCH_HOURS).forEach(key => {
      const h = BRANCH_HOURS[key];
      const isOpen = mins >= h.open && mins < h.close;
      const fmt = m => {
        const hr = Math.floor(m / 60), mn = m % 60;
        const ampm = hr >= 12 ? 'PM' : 'AM';
        const h12 = hr % 12 === 0 ? 12 : hr % 12;
        return mn ? `${h12}:${String(mn).padStart(2, '0')} ${ampm}` : `${h12} ${ampm}`;
      };
      document.querySelectorAll(`.live-dot[data-live="${key}"]`)
        .forEach(d => d.classList.toggle('closed', !isOpen));
      document.querySelectorAll(`[data-live-label="${key}"]`)
        .forEach(l => l.textContent = isOpen ? `Open now until ${fmt(h.close)}` : `Opens ${fmt(h.open)}`);
    });
  }

  function goBranchMenu(key) {
    switchTab('services-tab');
    const btn = document.querySelector(`#svcTabs [data-s="${key}"]`);
    if (btn) btn.click();
  }

  (function () {
    const els = document.querySelectorAll('.sr');
    if (!('IntersectionObserver' in window)) { els.forEach(e => e.classList.add('in')); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { en.target.classList.add('in'); io.unobserve(en.target); } });
    }, { threshold: 0.12, rootMargin: '0px 0px -8% 0px' });
    els.forEach(e => io.observe(e));
  })();

  (function () {
    const stats = document.querySelectorAll('.hero-stat b[data-count]');
    if (!stats.length) return;
    const run = el => {
      const target = parseInt(el.dataset.count, 10);
      const pre = el.dataset.prefix || '';
      const suf = el.dataset.suffix || '';
      if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
        el.textContent = pre + target + suf; return;
      }
      const dur = 1100, t0 = performance.now();
      const tick = now => {
        const p = Math.min((now - t0) / dur, 1);
        const eased = 1 - Math.pow(1 - p, 3);
        el.textContent = pre + Math.round(target * eased) + suf;
        if (p < 1) requestAnimationFrame(tick);
      };
      requestAnimationFrame(tick);
    };
    if (!('IntersectionObserver' in window)) { stats.forEach(run); return; }
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => { if (en.isIntersecting) { run(en.target); io.unobserve(en.target); } });
    }, { threshold: 0.6 });
    stats.forEach(s => io.observe(s));
  })();

  const BA_LOOKS = [
    { kicker: 'Hair', title: 'Organic Rebonding', price: '₱999', where: 'Daraga Main · Cabangan',
      blurb: 'Any length, one sitting. Straightened without the harsh chemical smell and sealed with keratin, so it grows out soft instead of snapping at the line.',
      before: 'assets/image/Before rebond.jpg',
      after:  'assets/image/after rebond.jpg' },
    { kicker: 'Brows', title: 'Premium Microblading', price: '₱2,500', where: 'Daraga Main · Yashano Mall',
      blurb: 'Hair-stroke brows mapped to your face, not to a stencil. Healed shape lasts through the year with one touch-up.',
      before: 'assets/image/latestenhancebeforeMicrobladding.jpg',
      after:  'assets/image/ehance after mricobladding.jpg' },
    { kicker: 'Skin', title: 'Basic Facial', price: '₱499', where: 'All three branches',
      blurb: 'Deep clean, extraction, and a calming mask. The one to book before an event, or every few weeks to keep congestion down.',
      before: 'assets/image/basic facial before.jpg',
      after:  'assets/image/basic facial after.jpg' }
  ];

  (function () {
    const reveal = document.getElementById('baReveal');
    const knob = document.getElementById('baKnob');
    if (!reveal || !knob) return;

    let pos = 50, active = 0;

    const setPos = v => {
      pos = Math.max(0, Math.min(100, v));
      reveal.style.setProperty('--pos', pos + '%');
      knob.setAttribute('aria-valuenow', Math.round(pos));
    };
    const fromEvent = e => {
      const r = reveal.getBoundingClientRect();
      const x = (e.touches ? e.touches[0].clientX : e.clientX) - r.left;
      setPos((x / r.width) * 100);
    };

    let dragging = false;
    const start = e => { dragging = true; fromEvent(e); };
    const move = e => { if (!dragging) return; if (e.cancelable) e.preventDefault(); fromEvent(e); };
    const end = () => { dragging = false; };

    reveal.addEventListener('mousedown', start);
    window.addEventListener('mousemove', move);
    window.addEventListener('mouseup', end);
    reveal.addEventListener('touchstart', start, { passive: true });
    window.addEventListener('touchmove', move, { passive: false });
    window.addEventListener('touchend', end);

    knob.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { setPos(pos - 4); e.preventDefault(); }
      if (e.key === 'ArrowRight') { setPos(pos + 4); e.preventDefault(); }
      if (e.key === 'Home') { setPos(0); e.preventDefault(); }
      if (e.key === 'End') { setPos(100); e.preventDefault(); }
    });

    const applyLook = i => {
      active = i;
      const L = BA_LOOKS[i];
      document.getElementById('baAfter').src = L.before;
      document.getElementById('baBefore').src = L.after;
      document.getElementById('baKicker').textContent = L.kicker;
      document.getElementById('baTitle').textContent = L.title;
      document.getElementById('baBlurb').textContent = L.blurb;
      document.getElementById('baPrice').textContent = L.price;
      document.getElementById('baWhere').textContent = L.where;
      setPos(50);
    };

    document.querySelectorAll('.ba-tab').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.ba-tab').forEach(b => b.classList.remove('on'));
        btn.classList.add('on');
        applyLook(parseInt(btn.dataset.ba, 10));
      });
    });

    document.getElementById('baBook')?.addEventListener('click', () => {
      const L = BA_LOOKS[active];
      bookService(L.title, L.price);
    });

    applyLook(0);
  })();


  (function () {
    const rail = document.getElementById('trkFill');
    if (!rail) return;
    const nodes = document.querySelectorAll('.trk-node');
    const msg = document.getElementById('trkMsg');
    const COPY = [
      'Request received. The Daraga front desk is checking the slot.',
      'Confirmed for 20 December, 8:00 AM. A reminder text goes out the day before.',
      'Your stylist has started. Sit back this is the good part.',
      'All done. A short rating form is waiting for you it takes about twenty seconds.'
    ];
    let i = 0, started = false;

    const paint = () => {
      nodes.forEach((n, k) => {
        n.classList.toggle('on', k <= i);
        n.classList.toggle('now', k === i);
      });
      rail.style.width = (i / (nodes.length - 1) * 100) + '%';
      msg.textContent = COPY[i];
    };

    const advance = () => { i = (i + 1) % nodes.length; paint(); };

    const begin = () => {
      if (started) return;
      started = true;
      paint();
      setInterval(advance, 2600);
    };

    if ('IntersectionObserver' in window) {
      const io = new IntersectionObserver(entries => {
        entries.forEach(en => { if (en.isIntersecting) { begin(); io.disconnect(); } });
      }, { threshold: 0.4 });
      io.observe(rail.closest('.trk-rail'));
    } else { begin(); }
  })();

  (function () {
    const slides = document.querySelectorAll('.testi-slide');
    const dots = document.querySelectorAll('.testi-dot');
    const box = document.getElementById('testiBox');
    if (!slides.length) return;
    let i = 0, timer = null;

    const go = n => {
      i = (n + slides.length) % slides.length;
      slides.forEach((s, k) => s.classList.toggle('on', k === i));
      dots.forEach((d, k) => d.classList.toggle('on', k === i));
    };
    const play = () => { timer = setInterval(() => go(i + 1), 6000); };
    const stop = () => { clearInterval(timer); };

    dots.forEach(d => d.addEventListener('click', () => { stop(); go(parseInt(d.dataset.i, 10)); play(); }));
    box?.addEventListener('mouseenter', stop);
    box?.addEventListener('mouseleave', play);
    play();
  })();


  /* ============================================================
     APPOINTMENT BOOKING ENGINE
     Implements the Customer/Guest storyboard: branch selection →
     real-time slot + service loading → email OTP verification →
     booking reference → status tracking → post-service feedback.
     ============================================================ */

  // Matches the `appointments.status` ENUM in the database (see
  // trackBooking.php) — 'Cancelled', 'No-Show', and 'Reviewed' are
  // terminal/derived states handled separately, not steps here.
  const APPT_STATUSES = ['Pending', 'Confirmed', 'In Progress', 'Completed'];

  // Current selection carried from the menu / lookbook / look finder into the modal.
  let currentBooking = { service: '', price: '' };
  let bookNotifyChoice = 'SMS';
  let selectedSlotLabel = '';
  let selectedStaffId = '';
  let selectedStaffName = '';
  let pendingBooking = null;
  let bookDepositLocked = false;
  let bookDepositInfo = { amount: 0, method: '', reference: '' };

  let bookReservationQuote = null;
  let bookQuoteRequest = 0;
  const formatReservationMoney = value => '₱' + Number(value).toLocaleString('en-PH', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  function computeSelectedServicesSubtotal() {
    return bookReservationQuote?.serviceTotal ?? 0;
  }
  let lastBookingPhone = '';
  let bookOtpCooldownTimer = null;

  function fmtApptDate(d) {
    if (!d) return '';
    return new Date(d + 'T00:00:00').toLocaleDateString('en-PH', { weekday: 'short', month: 'long', day: 'numeric', year: 'numeric' });
  }
  function escAttr(s) {
    return String(s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  function renderTrackingResult(res) {
    const isHome = res.type === 'home_service';
    const statuses = isHome ? HS_STATUSES : APPT_STATUSES;
    const terminal = res.status === 'Cancelled' || res.status === 'No-Show';
    const effectiveStatus = res.status === 'Reviewed' ? 'Completed' : res.status;
    const current = statuses.indexOf(effectiveStatus);

    let statusBlock;
    if (terminal) {
      const label = res.status === 'No-Show' ? 'marked as a no-show' : 'cancelled';
      statusBlock = '<div class="rounded-xl bg-copper/12 border border-copper/30 text-copper-dark p-4 text-[13px]">This booking was ' + label + '.</div>';
    } else {
      const nodes = statuses.map((st, i) => {
        const done = i <= current;
        const label = isHome ? hsStatusLabel(st) : st;
        return '<li class="flex items-center gap-3">' +
          '<span class="w-6 h-6 rounded-full flex items-center justify-center text-[11px] font-bold shrink-0 ' +
          (done ? 'bg-plum text-white' : 'border border-bronze/40 text-ink/30') + '">' + (done ? '✓' : (i + 1)) + '</span>' +
          '<span class="text-sm ' + (done ? 'font-bold text-ink' : 'text-ink/40') + '">' + escAttr(label) + '</span></li>';
      }).join('<li class="ml-3 h-4 border-l border-bronze/30"></li>');
      statusBlock = '<span class="text-[10px] font-bold uppercase tracking-widest text-copper">Booking status</span><ul class="mt-4 space-y-0">' + nodes + '</ul>';
    }

    const detail = isHome
      ? [['Type', 'Home &amp; event service'], ['Event', escAttr(res.event)], ['Date', hsFmtDate(res.date)],
         ['Location', escAttr(res.venue)], ['Details', escAttr(res.requests || '—').replace(/\n/g, '<br>')]]
      : [['Type', 'In-salon appointment'], ['Branch', escAttr(res.branch || '—')],
         ['Service', escAttr(res.services) + (res.price ? ' · ₱' + Number(res.price).toFixed(0) : '')],
         ['Date', fmtApptDate(res.date) + ' · ' + escAttr(res.time)]];

    return '<div class="flex flex-wrap items-center justify-between gap-3 mb-6">' +
        '<div><span class="text-[10px] font-bold uppercase tracking-widest text-ink/45">Reference</span>' +
        '<div class="font-display text-xl">' + escAttr(res.reference) + '</div></div>' +
        '<span class="rounded-full bg-plum/10 text-plum text-[11px] font-bold uppercase tracking-widest px-4 py-2">' + escAttr(isHome ? hsStatusLabel(res.status) : res.status) + '</span>' +
      '</div>' +
      statusBlock +
      '<div class="mt-6 pt-5 border-t border-bronze/25 text-sm space-y-1.5">' +
        detail.map(r => '<p><span class="text-ink/50">' + r[0] + ':</span> <b>' + r[1] + '</b></p>').join('') +
      '</div>';
  }

  function resetServiceList(message) {
    branchServicesRequestId++;
    const box = document.getElementById('bookServiceList');
    box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3 text-[13px] text-ink/50';
    box.innerHTML = message || 'Choose a branch to see its services.';
  }

  let branchServicesRequestId = 0;
  function loadBranchServices(branchId) {
    const box = document.getElementById('bookServiceList');
    box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3 text-[13px] text-ink/50';
    box.innerHTML = 'Loading services…';

    const requestId = ++branchServicesRequestId;
    fetch('backend/public/getBranchServices.php?branch=' + encodeURIComponent(branchId))
      .then(r => r.json())
      .then(res => {
        if (requestId !== branchServicesRequestId) return; // a newer branch selection superseded this response
        if (!res.success || !res.services.length) {
          box.innerHTML = '<span class="text-copper-dark">No services available for this branch right now.</span>';
          return;
        }
        box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3 max-h-40 overflow-y-auto';
        let lastServiceCategory = null;
        box.innerHTML = '<p class="text-xs text-ink/60 mb-2">' + res.services.length + ' menu options. Select one or more services. Scroll to see all categories.</p>' + res.services.map(s => {
          const heading = s.category !== lastServiceCategory
            ? '<p class="font-bold text-sm text-plum mt-3 mb-2">' + escAttr(s.category || 'Services') + '</p>' : '';
          lastServiceCategory = s.category;
          return heading +
          '<label class="flex items-center justify-between gap-3 py-1.5 cursor-pointer">' +
            '<span class="flex items-center gap-2 text-ink text-sm">' +
              '<input type="checkbox" class="book-service-check accent-plum" value="' + s.id + '" data-name="' + escAttr(s.name) + '" data-price="' + Number(s.price) + '"> ' +
              escAttr(s.name) + ' <small>' + escAttr(s.duration || (s.durationMinutes ? s.durationMinutes + ' min' : '')) + '</small>' +
            '</span>' +
            '<span class="text-ink/50 whitespace-nowrap text-sm">₱' + Number(s.price).toFixed(0) + '</span>' +
          '</label>';
        }).join('');
        let preselectedService = false;
        const menuPrice = Number(String(currentBooking.price || '').replace(/[^0-9.]/g, ''));
        box.querySelectorAll('.book-service-check').forEach(input => {
          input.checked = !preselectedService && input.dataset.name.toLowerCase() === currentBooking.service.toLowerCase()
            && (!menuPrice || Number(input.dataset.price) === menuPrice);
          if (input.checked) preselectedService = true;
        });
        updateDepositRequiredDisplay();
        refreshSlotGridIfReady();
      })
      .catch(() => { if (requestId === branchServicesRequestId) box.innerHTML = '<span class="text-copper-dark">Couldn\'t load services — please try again.</span>'; });
  }

  function resetStaffList(message) {
    document.getElementById('bookDepositGate').classList.add('hidden');
    staffListRequestId++;
    selectedStaffId = '';
    selectedStaffName = '';
    const section = document.getElementById('bookStaffSection');
    if (section) section.classList.add('hidden');
    const box = document.getElementById('bookStaffList');
    box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3 text-[13px] text-ink/50';
    box.innerHTML = message || 'Choose your branch, services, date, and time to see available staff.';
  }

  let staffListRequestId = 0;
  function loadStaffList(branchId, serviceIds, date, time) {
    document.getElementById('bookDepositGate').classList.add('hidden');
    selectedStaffId = '';
    selectedStaffName = '';
    document.getElementById('bookStaffSection').classList.remove('hidden');
    const box = document.getElementById('bookStaffList');
    box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3 text-[13px] text-ink/50';
    box.innerHTML = 'Loading available staff…';

    const requestId = ++staffListRequestId;
    const params = new URLSearchParams({ branch: branchId, date, time });
    serviceIds.forEach(id => params.append('services[]', id));
    fetch('backend/public/getAvailableStaff.php?' + params)
      .then(r => r.json())
      .then(res => {
        if (requestId !== staffListRequestId) return; // a newer selection superseded this response
        if (!res.success || !res.staff.length) {
          box.innerHTML = '<span class="text-copper-dark">No staff are available for this schedule. Please choose another time.</span>';
          return;
        }
        box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3';
        box.innerHTML = '<div class="grid grid-cols-2 sm:grid-cols-3 gap-2">' +
          res.staff.map(s => '<button type="button" data-staff="' + escAttr(s.id) + '" data-name="' + escAttr(s.name) + '"' +
            ' class="staff-btn rounded-lg border border-bronze/40 text-ink text-[12px] py-2 px-2 text-center hover:border-plum hover:text-plum transition">' +
            escAttr(s.name) + (s.role ? '<br><span class="text-[10px] text-ink/45">' + escAttr(s.role) + '</span>' : '') +
            '</button>').join('') +
        '</div>';
        box.querySelectorAll('.staff-btn').forEach(btn => {
          btn.addEventListener('click', () => {
            box.querySelectorAll('.staff-btn').forEach(b => b.classList.remove('bg-plum', 'text-white', 'border-plum'));
            btn.classList.add('bg-plum', 'text-white', 'border-plum');
            selectedStaffId = btn.dataset.staff;
            selectedStaffName = btn.dataset.name;
            document.getElementById('bookDepositGate').classList.remove('hidden');
          });
        });
      })
      .catch(() => { if (requestId === staffListRequestId) box.innerHTML = '<span class="text-copper-dark">Couldn\'t load staff — please try again.</span>'; });
  }

  function refreshStaffListIfReady() {
    const branchId = document.getElementById('bookBranchSelect').value;
    const date = document.getElementById('bookDate').value;
    const time = selectedSlotLabel;
    const serviceIds = Array.from(document.querySelectorAll('.book-service-check:checked')).map(c => c.value);
    if (branchId && date && time && serviceIds.length) loadStaffList(branchId, serviceIds, date, time);
    else resetStaffList();
  }

  function resetSlotGrid(message) {
    document.getElementById('bookDepositGate').classList.add('hidden');
    slotGridRequestId++;
    selectedSlotLabel = '';
    resetStaffList();
    const box = document.getElementById('bookSlotGrid');
    box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3 text-[13px] text-ink/50';
    box.innerHTML = message || 'Choose a branch and date to see open times.';
  }

  let slotGridRequestId = 0;
  function loadSlotGrid(branchId, date) {
    document.getElementById('bookDepositGate').classList.add('hidden');
    selectedSlotLabel = '';
    resetStaffList();
    const box = document.getElementById('bookSlotGrid');
    box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3 text-[13px] text-ink/50';
    box.innerHTML = 'Loading available times…';

    const requestId = ++slotGridRequestId;
    const serviceIds = Array.from(document.querySelectorAll('.book-service-check:checked')).map(c => c.value);
    const serviceQuery = serviceIds.map(id => '&services[]=' + encodeURIComponent(id)).join('');
    fetch('backend/public/getAvailableSlots.php?branch=' + encodeURIComponent(branchId) + '&date=' + encodeURIComponent(date) + serviceQuery)
      .then(r => r.json())
      .then(res => {
        if (requestId !== slotGridRequestId) return; // a newer branch/date selection superseded this response
        if (!res.success || !res.slots.length) {
          box.innerHTML = '<span class="text-copper-dark">No time slots configured for that date.</span>';
          return;
        }
        box.className = 'rounded-xl border border-bronze/50 bg-sand-100 p-3';
        box.innerHTML = '<div class="grid grid-cols-3 sm:grid-cols-4 gap-2">' +
          res.slots.map(s => {
            const slotClass = s.available ? 'border-bronze/40 text-ink hover:border-plum hover:text-plum' : 'border-bronze/20 text-ink/25 line-through cursor-not-allowed';
            return '<button type="button" data-slot="' + escAttr(s.time) + '"' + (s.available ? '' : ' disabled') +
              ' class="slot-btn rounded-lg border text-[12px] py-2 px-1 transition ' +
              slotClass +
              '">' + s.time + '</button>';
          }).join('') +
        '</div>';
        box.querySelectorAll('.slot-btn:not([disabled])').forEach(btn => {
          btn.addEventListener('click', () => {
            box.querySelectorAll('.slot-btn').forEach(b => b.classList.remove('bg-plum', 'text-white', 'border-plum'));
            btn.classList.add('bg-plum', 'text-white', 'border-plum');
            selectedSlotLabel = btn.dataset.slot;
            refreshStaffListIfReady();
          });
        });
      })
      .catch(() => { if (requestId === slotGridRequestId) box.innerHTML = '<span class="text-copper-dark">Couldn\'t load time slots — please try again.</span>'; });
  }

  function refreshSlotGridIfReady() {
    const branchId = document.getElementById('bookBranchSelect').value;
    const date = document.getElementById('bookDate').value;
    if (branchId && date) loadSlotGrid(branchId, date);
    else resetSlotGrid();
  }

  document.getElementById('bookBranchSelect')?.addEventListener('change', e => {
    const branchId = e.target.value;
    unlockDepositGate();
    resetServiceList();
    updateDepositRequiredDisplay();
    if (branchId) loadBranchServices(branchId); else resetServiceList();
    refreshSlotGridIfReady();
  });
  document.getElementById('bookDate')?.addEventListener('change', refreshSlotGridIfReady);
  // Service checkboxes are re-rendered per branch by loadBranchServices(), so
  // listen via delegation on their container instead of binding per-checkbox.
  // A longer treatment occupies more of the schedule, so the slot grid must
  // reflect the currently-checked services' total duration.
  document.getElementById('bookServiceList')?.addEventListener('change', e => {
    if (e.target.classList.contains('book-service-check')) {
      refreshSlotGridIfReady();
      updateDepositRequiredDisplay();
      // Services changed after the deposit was already locked in -- the
      // required amount may no longer match what was submitted, so make
      // them resubmit rather than silently keep a stale deposit.
      if (bookDepositLocked) {
        showToast('Services changed — please update your deposit details.');
        unlockDepositGate();
      }
    }
  });

  async function updateDepositRequiredDisplay() {
    const request = ++bookQuoteRequest;
    bookReservationQuote = null;
    const button = document.getElementById('bookDepositLockBtn');
    button.disabled = true;
    ['bookPaymentServices', 'bookPaymentTotal', 'bookPaymentRequirement', 'bookDepositRequired', 'bookPaymentBalance'].forEach(id => document.getElementById(id).textContent = '—');
    const params = new URLSearchParams({ branch: document.getElementById('bookBranchSelect').value });
    const selected = document.querySelectorAll('.book-service-check:checked');
    if (!selected.length) { document.getElementById('bookQuoteError').textContent = 'Select a service to see Pay Now.'; return null; }
    selected.forEach(c => params.append('serviceIds[]', c.value));
    document.getElementById('bookQuoteError').textContent = 'Calculating reservation payment…';
    try {
      const response = await fetch('backend/public/getReservationQuote.php?' + params);
      const body = await response.json();
      if (request !== bookQuoteRequest) return null;
      if (!body.success) throw new Error(body.message || 'Unable to calculate Pay Now.');
      bookReservationQuote = body.quote;
      document.getElementById('bookPaymentServices').textContent = body.quote.items.map(s => s.name).join(', ');
      document.getElementById('bookPaymentTotal').textContent = formatReservationMoney(body.quote.serviceTotal);
      document.getElementById('bookPaymentRequirement').textContent = body.quote.reservationRequirement;
      document.getElementById('bookDepositRequired').textContent = formatReservationMoney(body.quote.amountDue);
      document.getElementById('bookPaymentBalance').textContent = formatReservationMoney(body.quote.remainingBalance);
      document.getElementById('bookQuoteError').textContent = '';

      // A service configured 'No Online Reservation' (see Service Menu &
      // Promos -> Reservation Payment Rule) skips the deposit step entirely
      // -- the booking is submitted with no payment and confirmed after
      // admin review, instead of requiring a Cash/GCash/Maya choice for a
      // ₱0 amount. The backend still records method 'Cash' (already
      // validated, requires no reference) since amountDue is 0.
      if (body.quote.reservationRequirement === 'No Online Reservation') {
        bookDepositInfo = { amount: 0, method: 'Cash', reference: '' };
        bookDepositLocked = true;
        document.getElementById('bookDepositForm').classList.add('hidden');
        const locked = document.getElementById('bookDepositLocked');
        locked.classList.remove('hidden');
        locked.classList.add('flex');
        document.getElementById('bookDepositLockedSummary').textContent = 'No online reservation payment required — confirmed after review.';
      } else {
        document.getElementById('bookDepositForm').classList.remove('hidden');
        document.getElementById('bookDepositLocked').classList.add('hidden');
        bookDepositLocked = false;
      }
      return body.quote.amountDue;
    } catch (error) {
      if (request === bookQuoteRequest) document.getElementById('bookQuoteError').textContent = error.message || 'Unable to calculate Pay Now. Please select your services again.';
      return null;
    } finally {
      if (request === bookQuoteRequest) button.disabled = false;
    }
  }

  function unlockDepositGate() {
    bookDepositLocked = false;
    bookDepositInfo = { amount: 0, method: '', reference: '' };
    document.getElementById('bookDepositForm').classList.remove('hidden');
    const locked = document.getElementById('bookDepositLocked');
    locked.classList.add('hidden');
    locked.classList.remove('flex');
    document.getElementById('bookScheduleSection').classList.remove('hidden');
  }

  document.getElementById('bookDepositMethod')?.addEventListener('change', e => {
    const method = e.target.value;
    document.getElementById('bookDepositRefWrap').classList.toggle('hidden', method !== 'GCash' && method !== 'Maya');
    document.getElementById('bookDepositCashNote').classList.toggle('hidden', method !== 'Cash');
  });

  document.getElementById('bookDepositLockBtn')?.addEventListener('click', async () => {
    if (!selectedSlotLabel) { showToast('Please choose an available schedule first'); return; }
    if (!document.querySelectorAll('.book-service-check:checked').length) {
      showToast('Please choose at least one service first');
      return;
    }
    if (!selectedStaffId) { showToast('Please select a staff member first'); return; }
    const method = document.getElementById('bookDepositMethod').value;
    const reference = document.getElementById('bookDepositRef').value.trim();
    if (!method) { showToast('Please choose a payment method for your deposit'); return; }
    if ((method === 'GCash' || method === 'Maya') && !reference) {
      showToast('Please enter your ' + method + ' reference number');
      return;
    }

    const amount = await updateDepositRequiredDisplay();
    if (amount === null) return;
    bookDepositInfo = { amount, method, reference: method === 'Cash' ? '' : reference };
    bookDepositLocked = true;

    document.getElementById('bookDepositForm').classList.add('hidden');
    const locked = document.getElementById('bookDepositLocked');
    locked.classList.remove('hidden');
    locked.classList.add('flex');
    document.getElementById('bookDepositLockedSummary').textContent =
      formatReservationMoney(amount) + ' via ' + method + (bookDepositInfo.reference ? ' (Ref: ' + bookDepositInfo.reference + ')' : ' — pay in person');

    document.getElementById('bookScheduleSection').classList.remove('hidden');
    document.getElementById('bookName').focus();
  });

  document.getElementById('bookDepositChangeBtn')?.addEventListener('click', unlockDepositGate);

  document.querySelectorAll('#bookNotify .notify-opt').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#bookNotify .notify-opt').forEach(b => b.classList.remove('on'));
      btn.classList.add('on');
      bookNotifyChoice = btn.dataset.notify;
    });
  });

  document.getElementById('bookingModalForm')?.addEventListener('submit', e => {
    e.preventDefault();

    const branchId = document.getElementById('bookBranchSelect').value;
    const date = document.getElementById('bookDate').value;
    const name = document.getElementById('bookName').value.trim();
    const phone = document.getElementById('bookPhone').value.trim();
    const email = document.getElementById('bookEmail').value.trim();
    const serviceIds = Array.from(document.querySelectorAll('.book-service-check:checked')).map(c => c.value);
    const serviceNames = Array.from(document.querySelectorAll('.book-service-check:checked')).map(c => c.dataset.name);

    if (!branchId) { showToast('Please choose a branch'); return; }
    if (!serviceIds.length) { showToast('Please choose at least one service'); return; }
    if (!bookDepositLocked) { showToast('Please save your deposit details before reviewing your booking'); return; }
    if (!date) { showToast('Please select a date'); return; }
    if (!selectedSlotLabel) { showToast('Please choose an available time'); return; }
    if (!selectedStaffId) { showToast('Please select a staff member for your appointment'); return; }
    if (!name) { showToast('Please enter your full name'); return; }
    if (!/^09\d{9}$/.test(phone)) { showToast('Please enter a valid 11-digit mobile number'); return; }
    if (email && !/^\S+@\S+\.\S+$/.test(email)) { showToast('Please enter a valid email address, or leave it blank'); return; }
    if (!document.getElementById('bookAgreeTerms')?.checked) { showToast('Please agree to the Terms & Conditions'); return; }

    pendingBooking = {
      branchId, date, time: selectedSlotLabel, name, phone, email,
      staffId: selectedStaffId, staffName: selectedStaffName,
      depositAmount: bookDepositInfo.amount, depositMethod: bookDepositInfo.method, depositReference: bookDepositInfo.reference,
      serviceIds, serviceNames, notify: bookNotifyChoice, quoteToken: bookReservationQuote.quoteToken
    };

    const total = computeSelectedServicesSubtotal();
    document.getElementById('bookingReviewSummary').innerHTML = [
      ['Branch', BRANCH_LABEL_BY_ID[branchId] || branchId],
      ['Services', serviceNames.join(', ')],
      ['Date', fmtApptDate(date)], ['Time', selectedSlotLabel],
      ['Staff', selectedStaffName],
      ['Name', name], ['Mobile', phone],
      ...(email ? [['Email', email]] : []),
      ['Service Total', formatReservationMoney(total)],
      ['Reservation Requirement', bookReservationQuote.reservationRequirement],
      ['Pay Now', formatReservationMoney(bookDepositInfo.amount) + ' via ' + bookDepositInfo.method],
      ['Deposit reference', bookDepositInfo.reference || 'Pay cash at the branch'],
      ['Balance to Pay Later', formatReservationMoney(bookReservationQuote.remainingBalance)]
    ].map(([label, value]) => '<p><span class="text-ink/50">' + label + ':</span> <b>' + escAttr(value) + '</b></p>').join('');
    document.getElementById('bookingFormPanel').classList.add('hidden');
    document.getElementById('bookingReviewPanel').classList.remove('hidden');
    bookingModalBox.scrollTop = 0;
    document.getElementById('bookingReviewHeading').focus();

    // No email means nothing to OTP-verify -- the confirm button submits
    // straight to the backend instead of first requesting an email code.
    document.getElementById('bookReviewConfirm').textContent = email ? 'Continue to email verification' : 'Confirm booking';
    document.getElementById('bookReviewNextNote').textContent = email
      ? 'Next, verify your email. Your request will remain pending until the branch confirms your appointment and deposit.'
      : 'Your request will remain pending until the branch confirms your appointment and deposit.';
  });

  document.getElementById('bookReviewEdit').addEventListener('click', () => {
    document.getElementById('bookingReviewPanel').classList.add('hidden');
    document.getElementById('bookingFormPanel').classList.remove('hidden');
    pendingBooking = null;
    bookingModalBox.scrollTop = 0;
  });

  document.getElementById('bookReviewConfirm').addEventListener('click', () => {
    if (!pendingBooking) return;
    const email = pendingBooking.email;
    const reviewedBooking = pendingBooking;

    const submitBtn = document.getElementById('bookReviewConfirm');
    if (submitBtn.disabled) return;

    // No email was given, so there's nothing to OTP-verify -- submit the
    // booking directly with the same backend endpoint and payment rules
    // used for the email-verified path.
    if (!email) {
      submitBtn.disabled = true;
      document.getElementById('bookReviewEdit').disabled = true;
      submitBtn.textContent = 'Booking…';
      finalizeGuestBooking(pendingBooking, '', submitBtn, 'Confirm booking')
        .finally(() => { document.getElementById('bookReviewEdit').disabled = false; });
      return;
    }

    submitBtn.disabled = true;
    document.getElementById('bookReviewEdit').disabled = true;
    submitBtn.textContent = 'Sending code…';

    const formData = new FormData();
    formData.append('email', email);

    fetch('backend/public/sendBookingOtp.php', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(res => {
        submitBtn.disabled = false;
        document.getElementById('bookReviewEdit').disabled = false;
        submitBtn.textContent = 'Continue to email verification';
        if (pendingBooking !== reviewedBooking) return;
        if (!res.success) { showToast(res.message); return; }

        document.getElementById('bookOtpEmailLabel').textContent = email;
        document.getElementById('bookingFormPanel').classList.add('hidden');
        document.getElementById('bookingReviewPanel').classList.add('hidden');
        document.getElementById('bookingOtpPanel').classList.remove('hidden');
        document.getElementById('bookingModalBox').scrollTop = 0;
        resetBookOtpInputs();
        startBookOtpCooldown(60);
        document.querySelector('.book-otp-digit')?.focus();
      })
      .catch(() => {
        submitBtn.disabled = false;
        document.getElementById('bookReviewEdit').disabled = false;
        submitBtn.textContent = 'Continue to email verification';
        showToast('A network error occurred. Please try again.');
      });
  });

  const bookOtpDigits = Array.from(document.querySelectorAll('.book-otp-digit'));
  bookOtpDigits.forEach((input, index) => {
    input.addEventListener('input', () => {
      input.value = input.value.replace(/[^0-9]/g, '').slice(0, 1);
      if (input.value && index < bookOtpDigits.length - 1) bookOtpDigits[index + 1].focus();
    });
    input.addEventListener('keydown', e => {
      if (e.key === 'Backspace' && !input.value && index > 0) bookOtpDigits[index - 1].focus();
    });
    input.addEventListener('paste', e => {
      e.preventDefault();
      const pasted = (e.clipboardData || window.clipboardData).getData('text').replace(/[^0-9]/g, '');
      if (!pasted) return;
      bookOtpDigits.forEach((box, i) => { box.value = pasted[i] || ''; });
      const nextEmpty = bookOtpDigits.find(box => !box.value);
      (nextEmpty || bookOtpDigits[bookOtpDigits.length - 1]).focus();
    });
  });

  function resetBookOtpInputs() {
    bookOtpDigits.forEach(d => d.value = '');
  }

  function startBookOtpCooldown(seconds) {
    let cooldown = seconds;
    const btn = document.getElementById('bookOtpResendBtn');
    const baseLabel = 'Resend code';
    btn.disabled = true;
    btn.textContent = 'Resend code (' + cooldown + 's)';
    clearInterval(bookOtpCooldownTimer);
    bookOtpCooldownTimer = setInterval(() => {
      cooldown -= 1;
      if (cooldown <= 0) {
        clearInterval(bookOtpCooldownTimer);
        bookOtpCooldownTimer = null;
        btn.disabled = false;
        btn.textContent = baseLabel;
      } else {
        btn.textContent = 'Resend code (' + cooldown + 's)';
      }
    }, 1000);
  }

  document.getElementById('bookOtpResendBtn')?.addEventListener('click', () => {
    if (!pendingBooking) return;
    const btn = document.getElementById('bookOtpResendBtn');
    btn.disabled = true;

    const formData = new FormData();
    formData.append('email', pendingBooking.email);

    fetch('backend/public/sendBookingOtp.php', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(res => {
        showToast(res.message);
        resetBookOtpInputs();
        startBookOtpCooldown(60);
      })
      .catch(() => {
        showToast('A network error occurred. Please try again.');
        btn.disabled = false;
      });
  });

  document.getElementById('bookOtpEditBtn')?.addEventListener('click', () => {
    document.getElementById('bookingOtpPanel').classList.add('hidden');
    document.getElementById('bookingFormPanel').classList.remove('hidden');
    document.getElementById('bookingModalBox').scrollTop = 0;
  });

  // Shared by both guest-booking completion paths: with an email (after the
  // OTP form) and without one (straight from the review step, since there's
  // nothing to verify). Same backend endpoint, same booking system, same
  // payment rules either way -- only whether otpCode is populated differs.
  function finalizeGuestBooking(booking, otpCode, submitBtn, idleLabel) {
    const formData = new FormData();
    formData.append('fullname', booking.name);
    formData.append('contact', booking.phone);
    formData.append('branch', booking.branchId);
    formData.append('appointment_date', booking.date);
    formData.append('time_slot', booking.time);
    formData.append('staff_id', booking.staffId);
    booking.serviceIds.forEach(id => formData.append('services[]', id));
    formData.append('email', booking.email);
    formData.append('otp_code', otpCode);
    formData.append('payment_method', booking.depositMethod);
    formData.append('quoteToken', booking.quoteToken);
    formData.append('deposit_reference', booking.depositReference);
    formData.append('agreedToTerms', '1');

    return fetch('backend/public/submitGuestBooking.php', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(res => {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = idleLabel; }

        if (!res.success) {
          showToast(res.message);
          if (res.quoteChanged) {
            unlockDepositGate();
            updateDepositRequiredDisplay();
            document.getElementById('bookingOtpPanel').classList.add('hidden');
            document.getElementById('bookingReviewPanel').classList.add('hidden');
            document.getElementById('bookingFormPanel').classList.remove('hidden');
          }
          return false;
        }

        const branchLabel = BRANCH_LABEL_BY_ID[booking.branchId] || '';

        document.getElementById('bookRef').textContent = res.reference;
        document.getElementById('bookSummary').innerHTML = [
          ['Branch', branchLabel],
          ['Services', booking.serviceNames.join(', ')],
          ['Date', fmtApptDate(booking.date)],
          ['Time', booking.time],
          ['Staff', booking.staffName],
          ['Booked for', booking.name + ' · ' + booking.phone],
          ['Service Total', formatReservationMoney(res.payment.serviceTotal)],
          ['Reservation Requirement', res.payment.reservationRequirement],
          ['Pay Now', formatReservationMoney(res.payment.amountDue) + ' via ' + booking.depositMethod],
          ['Balance to Pay Later', formatReservationMoney(res.payment.remainingBalance)]
        ].map(r => '<p><span class="text-ink/50">' + r[0] + ':</span> <b>' + escAttr(r[1]) + '</b></p>').join('');

        document.getElementById('bookNotifyNote').textContent =
          'Your request is pending confirmation by ' + branchLabel + '. Keep your reference and use Track this booking to check for updates.';

        lastBookingPhone = booking.phone;
        pendingBooking = null;
        document.getElementById('bookingOtpPanel').classList.add('hidden');
        document.getElementById('bookingReviewPanel').classList.add('hidden');
        document.getElementById('bookingConfirmPanel').classList.remove('hidden');
        document.getElementById('bookingModalBox').scrollTop = 0;
        return true;
      })
      .catch(() => {
        if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = idleLabel; }
        showToast('A network error occurred. Please try again.');
        return false;
      });
  }

  document.getElementById('bookingOtpForm')?.addEventListener('submit', e => {
    e.preventDefault();
    if (!pendingBooking) return;

    const code = bookOtpDigits.map(d => d.value).join('');
    if (code.length !== bookOtpDigits.length) { showToast('Please enter the full 6-digit code.'); return; }

    const submitBtn = document.getElementById('bookOtpSubmitBtn');
    submitBtn.disabled = true;
    submitBtn.textContent = 'Booking…';

    finalizeGuestBooking(pendingBooking, code, submitBtn, 'Verify & submit request')
      .then(succeeded => {
        if (!succeeded) { resetBookOtpInputs(); bookOtpDigits[0].focus(); }
      });
  });

  const trackModalOverlay = document.getElementById('trackModalOverlay');
  const trackModalBox = document.getElementById('trackModalBox');
  let apptFbRef = null;
  let apptFbPhone = null;
  let apptRatings = { service: 0, staff: 0 };

  function openTrackModal(prefillRef, prefillPhone) {
    closeBookingModal();
    trackModalOverlay.classList.remove('opacity-0', 'pointer-events-none');
    trackModalBox.classList.remove('scale-95');
    if (prefillRef && prefillRef !== '—') {
      document.getElementById('apptTrkRef').value = prefillRef;
    }
    if (prefillPhone) {
      document.getElementById('apptTrkPhone').value = prefillPhone;
    }
  }
  function closeTrackModal() {
    trackModalOverlay.classList.add('opacity-0', 'pointer-events-none');
    trackModalBox.classList.add('scale-95');
  }
  document.getElementById('closeTrack')?.addEventListener('click', closeTrackModal);
  trackModalOverlay?.addEventListener('click', e => { if (e.target === trackModalOverlay) closeTrackModal(); });

  function apptTrack() {
    const ref = document.getElementById('apptTrkRef').value.trim().toUpperCase();
    const phone = document.getElementById('apptTrkPhone').value.trim();
    const box = document.getElementById('apptTrkResult');
    const fb = document.getElementById('apptTrkFeedback');
    box.classList.remove('hidden');

    if (!ref || !phone) {
      box.innerHTML = '<div class="rounded-xl bg-copper/12 border border-copper/30 text-copper-dark p-4 text-[13px]">Enter both the booking reference and the mobile number used for it.</div>';
      fb.classList.add('hidden');
      return;
    }

    box.innerHTML = '<div class="text-[13px] text-ink/50">Looking up your booking…</div>';
    fb.classList.add('hidden');

    fetch('backend/public/trackBooking.php?reference=' + encodeURIComponent(ref) + '&phone=' + encodeURIComponent(phone))
      .then(r => r.json())
      .then(res => {
        if (!res.success) {
          box.innerHTML = '<div class="rounded-xl bg-copper/12 border border-copper/30 text-copper-dark p-4 text-[13px]">' + escAttr(res.message) + ' Or call 0918 536 8016.</div>';
          return;
        }
        box.innerHTML = renderTrackingResult(res);

        // Feedback is offered only once the service is finished and hasn't been rated yet.
        if (res.canReview) {
          apptFbRef = res.reference;
          apptFbPhone = phone;
          apptRatings = { service: 0, staff: 0 };
          document.querySelectorAll('.appt-star').forEach(s => s.classList.remove('on'));
          document.getElementById('apptFbFor').textContent =
            'For booking ' + res.reference + ' — ' + (res.type === 'home_service' ? res.event : res.services) + '.';
          fb.classList.remove('hidden');
        } else {
          fb.classList.add('hidden');
        }
      })
      .catch(() => {
        box.innerHTML = '<div class="rounded-xl bg-copper/12 border border-copper/30 text-copper-dark p-4 text-[13px]">A network error occurred. Please try again.</div>';
      });
  }

  function apptStar(which, value) {
    apptRatings[which] = value;
    const wrap = document.getElementById(which === 'service' ? 'apptFbService' : 'apptFbStaff');
    wrap.querySelectorAll('.appt-star').forEach((s, i) => s.classList.toggle('on', i < value));
  }

  function apptSubmitFeedback() {
    if (!apptRatings.service) { showToast('Please rate the service first'); return; }
    if (!apptFbRef || !apptFbPhone) { showToast('Please look up your booking again.'); return; }

    const formData = new FormData();
    formData.append('reference', apptFbRef);
    formData.append('phone', apptFbPhone);
    formData.append('rating', apptRatings.service);
    if (apptRatings.staff) formData.append('staff_rating', apptRatings.staff);
    formData.append('comment', document.getElementById('apptFbText').value.trim());

    fetch('backend/public/submitGuestFeedback.php', { method: 'POST', body: formData })
      .then(r => r.json())
      .then(res => {
        showToast(res.message);
        if (!res.success) return;
        document.getElementById('apptFbText').value = '';
        apptRatings = { service: 0, staff: 0 };
        document.querySelectorAll('.appt-star').forEach(s => s.classList.remove('on'));
        document.getElementById('apptTrkFeedback').classList.add('hidden');
      })
      .catch(() => showToast('A network error occurred. Please try again.'));
  }

  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    if (!trackModalOverlay.classList.contains('pointer-events-none')) closeTrackModal();
    if (!bookingModalOverlay.classList.contains('pointer-events-none')) closeBookingModal();
  });


  function applyTheme(mode) {
    const dark = mode === 'dark';
    document.documentElement.classList.toggle('dark', dark);
    const btn = document.getElementById('themeToggle');
    if (btn) {
      btn.querySelector('.theme-moon').classList.toggle('hidden', dark);
      btn.querySelector('.theme-sun').classList.toggle('hidden', !dark);
      btn.setAttribute('aria-pressed', String(dark));
      btn.setAttribute('aria-label', dark ? 'Switch to light mode' : 'Switch to dark mode');
    }
    const ml = document.getElementById('themeLabelMobile');
    if (ml) ml.textContent = dark ? 'Light mode' : 'Dark mode';
    try { localStorage.setItem('lm-theme', mode); } catch (e) { /* storage unavailable */ }
  }

  function toggleTheme() {
    applyTheme(document.documentElement.classList.contains('dark') ? 'light' : 'dark');
  }

  function initTheme() {
    let saved = null;
    try { saved = localStorage.getItem('lm-theme'); } catch (e) { /* storage unavailable */ }
    if (!saved) {
      saved = window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
    }
    applyTheme(saved);
  }

  /* ---- Portal login ----------------------------------------------------
     The staff / front desk / owner side of the system is a separate
     application (the admin panel). The Portal Login button in the header
     just sends the user there.

     >>> CHANGE THIS LINE if your login page is saved somewhere else. <<<   */
  const PORTAL_LOGIN_URL = 'pages/portal-login/index.html?mode=team-email';

  function goToPortalLogin() {
    window.location.href = PORTAL_LOGIN_URL;
  }

  function allowNumbersOnly() {
    const fields = document.querySelectorAll('.numbers-only');
    for (let i = 0; i < fields.length; i++) {
      fields[i].addEventListener('keypress', function (e) {
        if (e.key.length === 1 && (e.key < '0' || e.key > '9')) {
          e.preventDefault();
        }
      });
      fields[i].addEventListener('input', function () {
        this.value = this.value.replace(/[^0-9]/g, '');
      });
    }
  }

  window.addEventListener('DOMContentLoaded', () => {
    initTheme();
    allowNumbersOnly();
    switchTab('home-tab');
    if (new URLSearchParams(window.location.search).get('track') === 'booking') {
      openTrackModal();
      document.getElementById('apptTrkRef').focus();
    }
    refreshLiveStatus();
    setInterval(refreshLiveStatus, 60000);
    highlightSvcBranch();
    renderServices();
    renderStaff();
    renderProducts();
    renderWeddingPackages();
    const homeDate = document.getElementById('hsDate');
    if (homeDate) homeDate.min = new Intl.DateTimeFormat('en-CA', { timeZone: 'Asia/Manila', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date());
    hsGo(1, true);
  });
