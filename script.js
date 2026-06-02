const API_BASE_URL = normalizeApiUrl(window.KAUA_LIPPERT_API_URL || 'https://caverna-digital-api.vercel.app/api');

let observer;

function normalizeApiUrl(url) {
  return String(url || '').replace(/\/+$/, '');
}

function setupRevealObserver() {
  if (observer) observer.disconnect();

  const reveals = document.querySelectorAll('.reveal');
  observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      }
    });
  }, { threshold: 0.14, rootMargin: '0px 0px -8% 0px' });

  reveals.forEach((el) => observer.observe(el));
}

function setupTiltCards(root = document) {
  const tiltCards = root.querySelectorAll('.tilt-card:not([data-tilt-ready])');

  tiltCards.forEach((card) => {
    card.dataset.tiltReady = 'true';
    card.addEventListener('mousemove', (event) => {
      const rect = card.getBoundingClientRect();
      const x = event.clientX - rect.left;
      const y = event.clientY - rect.top;
      const rotateX = ((y / rect.height) - 0.5) * -5;
      const rotateY = ((x / rect.width) - 0.5) * 5;
      card.style.transform = `perspective(900px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateY(-8px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = '';
    });
  });
}

function escapeHtml(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function albumHref(album) {
  return `album.html?album=${encodeURIComponent(album.slug || album.id)}`;
}

function formatIndex(index) {
  return String(index + 1).padStart(2, '0');
}

async function requestApi(path) {
  const response = await fetch(`${API_BASE_URL}${path}`);

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return response.json();
}

async function postApi(path) {
  const response = await fetch(`${API_BASE_URL}${path}`, { method: 'POST' });

  if (!response.ok) {
    throw new Error(`API error ${response.status}`);
  }

  return response.json();
}

async function fetchAlbums() {
  const payload = await requestApi('/albums');
  return Array.isArray(payload.data) ? payload.data : [];
}

async function fetchAlbum(identifier) {
  const payload = await requestApi(`/albums/${encodeURIComponent(identifier)}`);
  return payload.data;
}

async function fetchPublicPlans() {
  const payload = await requestApi('/plans/public');
  return Array.isArray(payload.data) ? payload.data : [];
}

function isAlbumVisible(album) {
  return album?.isVisible !== false;
}

function isAlbumFeatured(album) {
  return Boolean(album?.isFeatured ?? album?.featured);
}

function albumDisplayOrder(album, fallback = 0) {
  const order = Number(album?.displayOrder);
  return Number.isFinite(order) ? order : fallback;
}

function sortPublicAlbums(albums) {
  return albums
    .filter((album) => isAlbumVisible(album))
    .map((album, index) => ({ ...album, displayOrder: albumDisplayOrder(album, index) }))
    .sort((a, b) => albumDisplayOrder(a) - albumDisplayOrder(b));
}

function getFeaturedAlbums(albums) {
  return albums
    .filter((album) => isAlbumFeatured(album))
    .sort((a, b) => albumDisplayOrder(a) - albumDisplayOrder(b));
}

async function incrementAlbumView(album) {
  const albumId = album.id;
  if (!albumId) return album;

  const storageKey = `viewed_album_${albumId}`;
  if (sessionStorage.getItem(storageKey)) {
    return album;
  }

  sessionStorage.setItem(storageKey, 'true');

  try {
    const payload = await postApi(`/albums/${encodeURIComponent(albumId)}/views`);
    return payload.data || album;
  } catch (error) {
    sessionStorage.removeItem(storageKey);
    throw error;
  }
}

function formatViews(views = 0) {
  const value = Number(views) || 0;
  return `${value} ${value === 1 ? 'visualização' : 'visualizações'}`;
}

function setContentState(container, message) {
  if (!container) return;
  container.innerHTML = `<div class="content-state">${escapeHtml(message)}</div>`;
}

function formatCurrency(value = 0) {
  return Number(value || 0).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

function formatPlanLimit(value, suffix = '') {
  if (value === null || value === undefined) return 'Ilimitado';
  return `${Number(value).toLocaleString('pt-BR')}${suffix}`;
}

function planBadge(plan) {
  if (plan.commercialBadges?.bestSeller) return 'Mais escolhido';
  if (plan.commercialBadges?.recommended || plan.isFeatured) return 'Melhor custo-benefício';
  if (plan.commercialBadges?.isNew) return 'Novo';
  return '';
}

function renderPublicPlans(plans) {
  const container = document.querySelector('#pricingGrid');
  if (!container) return;

  if (!plans.length) {
    setContentState(container, 'Nenhum plano disponível no momento.');
    return;
  }

  container.innerHTML = plans.map((plan) => {
    const badge = planBadge(plan);
    const features = Array.isArray(plan.featureList) ? plan.featureList : [];

    return `
      <article class="pricing-card reveal reveal-up ${plan.isFeatured ? 'is-featured' : ''}">
        ${badge ? `<span class="pricing-badge">${escapeHtml(badge)}</span>` : ''}
        <h2>${escapeHtml(plan.name)}</h2>
        <p>${escapeHtml(plan.description || '')}</p>
        <strong>${formatCurrency(plan.monthlyPrice || plan.price)}<small>/mês</small></strong>
        ${plan.yearlyPrice ? `<span class="yearly-price">${formatCurrency(plan.yearlyPrice)}/ano</span>` : ''}
        <ul>
          <li>${formatPlanLimit(plan.limits?.albums ?? plan.limits?.albumLimit)} álbuns</li>
          <li>${formatPlanLimit(plan.limits?.images ?? plan.limits?.imageLimit)} imagens</li>
          <li>${formatPlanLimit(plan.limits?.storageGb ?? plan.limits?.storageGbLimit, ' GB')} de armazenamento</li>
          <li>${formatPlanLimit(plan.limits?.monthlyViews ?? plan.limits?.monthlyViewsLimit)} visualizações/mês</li>
        </ul>
        <div class="pricing-features">
          ${features.length ? features.map((feature) => `<span>${escapeHtml(feature)}</span>`).join('') : '<span>Recursos cadastrados no plano</span>'}
        </div>
        <a class="btn btn-light" href="index.html#contato">Escolher plano</a>
      </article>
    `;
  }).join('');

  setupRevealObserver();
}

function renderHomeAlbums(albums) {
  const container = document.querySelector('#homeAlbumGrid');
  if (!container) return;

  const limit = Number(container.dataset.albumLimit || 4);
  const visibleAlbums = albums.slice(0, limit);

  if (!visibleAlbums.length) {
    setContentState(container, 'Nenhum álbum publicado ainda.');
    return;
  }

  container.innerHTML = visibleAlbums.map((album) => `
    <a href="${albumHref(album)}" class="category-card reveal reveal-up tilt-card">
      <img src="${escapeHtml(album.coverUrl)}" alt="${escapeHtml(album.title)}" loading="lazy">
      <div>
        <h3>${escapeHtml(album.title)}</h3>
        <small>${escapeHtml(formatViews(album.views))}</small>
        <span>Ver mais →</span>
      </div>
    </a>
  `).join('');

  setupTiltCards(container);
  setupRevealObserver();
}

function renderLatestStories(albums) {
  const container = document.querySelector('#latestStoriesGrid');
  if (!container) return;

  const visibleAlbums = albums.slice(0, 3);

  if (!visibleAlbums.length) {
    setContentState(container, 'Nenhuma história publicada ainda.');
    return;
  }

  container.innerHTML = visibleAlbums.map((album) => `
    <article class="reveal reveal-up">
      <img src="${escapeHtml(album.coverUrl)}" alt="${escapeHtml(album.title)}" loading="lazy">
      <h3>${escapeHtml(album.title)}</h3>
      <p class="album-views">${escapeHtml(formatViews(album.views))}</p>
      <a href="${albumHref(album)}">Ler mais →</a>
    </article>
  `).join('');

  setupRevealObserver();
}

function renderPortfolioAlbums(albums) {
  const container = document.querySelector('#portfolioAlbumGrid');
  if (!container) return;

  if (!albums.length) {
    setContentState(container, 'Nenhum álbum publicado ainda.');
    return;
  }

  container.innerHTML = albums.map((album, index) => {
    const layoutClass = index === 0 ? ' album-large' : index === 3 ? ' album-wide' : '';

    return `
      <a class="album-card${layoutClass} reveal reveal-up tilt-card" id="${escapeHtml(album.slug || album.id)}" href="${albumHref(album)}">
        <img src="${escapeHtml(album.coverUrl)}" alt="${escapeHtml(album.title)}" loading="lazy">
        <div class="album-content">
          <span>${formatIndex(index)}</span>
          <h2>${escapeHtml(album.title)}</h2>
          <p>${escapeHtml(album.description)}</p>
          <small>${escapeHtml(formatViews(album.views))}</small>
          <strong>Ver álbum →</strong>
        </div>
      </a>
    `;
  }).join('');

  setupTiltCards(container);
  setupRevealObserver();
}

function setAlbumHero(album) {
  const hero = document.querySelector('#albumHero');
  if (!hero) return;
  hero.style.setProperty('--album-cover', `url('${album.coverUrl}')`);
}

function renderPhotoGallery(album) {
  const gallery = document.querySelector('#photoGallery');
  if (!gallery) return;

  const photos = Array.isArray(album.images)
    ? [...album.images].sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
    : [];

  document.title = `${album.title} | Kauã Lippert Fotografia`;
  document.querySelector('#albumEyebrow').textContent = album.category || 'álbum selecionado';
  document.querySelector('#albumTitle').textContent = album.title;
  document.querySelector('#albumDescription').textContent = album.description;
  document.querySelector('#albumCount').textContent = `${photos.length} ${photos.length === 1 ? 'foto' : 'fotos'}`;
  document.querySelector('#albumViews').textContent = formatViews(album.views);
  setAlbumHero(album);

  if (!photos.length) {
    setContentState(gallery, 'Este álbum ainda não tem fotos publicadas.');
    return;
  }

  gallery.innerHTML = photos.map((photo, index) => `
    <button class="photo-card reveal reveal-up" type="button" data-src="${escapeHtml(photo.url)}">
      <img src="${escapeHtml(photo.url)}" alt="${escapeHtml(photo.alt || `${album.title} - foto ${index + 1}`)}" loading="lazy">
    </button>
  `).join('');

  setupRevealObserver();
}

async function initHomePage() {
  const homeGrid = document.querySelector('#homeAlbumGrid');
  const storiesGrid = document.querySelector('#latestStoriesGrid');
  if (!homeGrid && !storiesGrid) return;

  try {
    const albums = sortPublicAlbums(await fetchAlbums());
    const featuredAlbums = getFeaturedAlbums(albums);
    const homeAlbums = featuredAlbums.length ? featuredAlbums : albums;
    renderHomeAlbums(homeAlbums);
    renderLatestStories(homeAlbums);

    const featuredAlbum = featuredAlbums[0] || albums[0];
    if (featuredAlbum?.coverUrl) {
      document.querySelector('.hero')?.style.setProperty(
        'background-image',
        `linear-gradient(90deg, rgba(15,15,13,.92) 0%, rgba(15,15,13,.58) 38%, rgba(15,15,13,.18) 100%), url('${featuredAlbum.coverUrl}')`,
      );
    }
  } catch (error) {
    console.error(error);
    setContentState(homeGrid, 'Não foi possível carregar os álbuns da API.');
    setContentState(storiesGrid, 'Não foi possível carregar as histórias da API.');
  }
}

async function initPortfolioPage() {
  const portfolioGrid = document.querySelector('#portfolioAlbumGrid');
  if (!portfolioGrid) return;

  try {
    const albums = sortPublicAlbums(await fetchAlbums());
    renderPortfolioAlbums(albums);
  } catch (error) {
    console.error(error);
    setContentState(portfolioGrid, 'Não foi possível carregar os álbuns da API.');
  }
}

async function initAlbumPage() {
  const gallery = document.querySelector('#photoGallery');
  if (!gallery) return;

  const params = new URLSearchParams(window.location.search);
  let albumIdentifier = params.get('album');

  try {
    if (!albumIdentifier) {
      const albums = sortPublicAlbums(await fetchAlbums());
      albumIdentifier = albums[0]?.slug || albums[0]?.id;
    }

    if (!albumIdentifier) {
      setContentState(gallery, 'Nenhum álbum publicado ainda.');
      return;
    }

    let album = await fetchAlbum(albumIdentifier);
    if (!isAlbumVisible(album)) {
      throw new Error('Hidden album');
    }
    album = await incrementAlbumView(album);
    renderPhotoGallery(album);
  } catch (error) {
    console.error(error);
    document.querySelector('#albumTitle').textContent = 'Álbum indisponível';
    document.querySelector('#albumDescription').textContent = 'Não foi possível carregar este álbum pela API.';
    document.querySelector('#albumCount').textContent = '0 fotos';
    document.querySelector('#albumViews').textContent = '0 visualizações';
    setContentState(gallery, 'Não foi possível carregar as fotos da API.');
  }
}

async function initPricingPage() {
  const pricingGrid = document.querySelector('#pricingGrid');
  if (!pricingGrid) return;

  try {
    renderPublicPlans(await fetchPublicPlans());
  } catch (error) {
    console.error(error);
    setContentState(pricingGrid, 'Não foi possível carregar os planos da API.');
  }
}

const navbar = document.querySelector('.navbar');
const parallaxItems = document.querySelectorAll('[data-parallax]');
let ticking = false;

function updateMotion() {
  const y = window.scrollY || window.pageYOffset;
  if (navbar) navbar.classList.toggle('is-scrolled', y > 80);

  parallaxItems.forEach((el) => {
    const speed = Number(el.dataset.parallax || 0.12);
    if (el.classList.contains('hero')) {
      el.style.backgroundPosition = `center calc(50% + ${y * speed}px)`;
    } else {
      const rect = el.getBoundingClientRect();
      const offset = (window.innerHeight - rect.top) * speed;
      el.style.transform = `translate3d(0, ${offset * -0.18}px, 0)`;
    }
  });
  ticking = false;
}

window.addEventListener('scroll', () => {
  if (!ticking) {
    window.requestAnimationFrame(updateMotion);
    ticking = true;
  }
}, { passive: true });

function setupLightbox() {
  const gallery = document.querySelector('#photoGallery');
  const lightbox = document.querySelector('#lightbox');
  const lightboxImage = document.querySelector('#lightboxImage');
  const closeLightbox = document.querySelector('#lightboxClose');

  if (!gallery || !lightbox || !lightboxImage || !closeLightbox) return;

  gallery.addEventListener('click', (event) => {
    const card = event.target.closest('.photo-card');
    if (!card) return;
    lightboxImage.src = card.dataset.src;
    lightbox.classList.add('is-open');
    lightbox.setAttribute('aria-hidden', 'false');
  });

  function closeModal() {
    lightbox.classList.remove('is-open');
    lightbox.setAttribute('aria-hidden', 'true');
    lightboxImage.src = '';
  }

  closeLightbox.addEventListener('click', closeModal);
  lightbox.addEventListener('click', (event) => {
    if (event.target === lightbox) closeModal();
  });
  document.addEventListener('keydown', (event) => {
    if (event.key === 'Escape') closeModal();
  });
}

setupRevealObserver();
setupTiltCards();
setupLightbox();
updateMotion();
initHomePage();
initPortfolioPage();
initAlbumPage();
initPricingPage();
