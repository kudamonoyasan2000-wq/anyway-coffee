
  (() => {
    const dir = sessionStorage.getItem("hysd-nav-direction");
    if (dir) {
      document.documentElement.classList.add(`vt-${dir}`);
      sessionStorage.removeItem("hysd-nav-direction");
    }
  })();


  /* ---------- Product data (CMS差し替えポイント) ---------- */
  /* この配列をCMSのAPIから取得するように差し替えれば、
     管理画面から商品の追加・編集・削除ができる構成。
     画像は `media: { url, alt }` を追加すれば対応可。
     size: s/m/l でカードのサイズ、offset: up/down/null でレイアウトのリズム。 */
  const FALLBACK_PRODUCTS = [
    { id: "p01", name: "Brew No.07", italic: "Ethiopia", category: "coffee", price: 1800, tag: "NEW", isNew: true, color: "#B08650", image: null, hoverImage: null, size: "m", offset: null, href: "product.html", hoverLabel: "静かな朝に" },
    { id: "p02", name: "Daily Blend", italic: null,      category: "coffee", price: 1400, tag: "BLEND", isNew: false, color: "#7a4a1f", image: null, hoverImage: null, size: "m", offset: null, href: "product.html", hoverLabel: "気持ちを整える" },
    { id: "p03", name: "Decaf Slow", italic: null,       category: "coffee", price: 1500, tag: "DECAF", isNew: false, color: "#9b6f3a", image: null, hoverImage: null, size: "m", offset: null, href: "product.html", hoverLabel: "夜をやわらかく" },
    { id: "p04", name: "Mug",         italic: "12oz",    category: "goods",  price: 2400, tag: "GOODS", isNew: false, color: "#001829", image: null, hoverImage: null, size: "m", offset: null, href: "product.html", hoverLabel: "机の景色を変える" },
    { id: "p05", name: "Brew No.06", italic: "Colombia", category: "coffee", price: 1700, tag: "SINGLE", isNew: false, color: "#5a3a1a", image: null, hoverImage: null, size: "m", offset: null, href: "product.html", hoverLabel: "少し前向きに" },
    { id: "p06", name: "Tote",        italic: "everyday", category: "goods", price: 3200, tag: "GOODS", isNew: false, color: "#E6FD28", image: null, hoverImage: null, size: "l", offset: null, href: "product.html", hoverLabel: "ふらっと外へ" },
    { id: "p07", name: "Morning Kit", italic: null,      category: "coffee", price: 3800, tag: "SET",   isNew: true, color: "#c89b6b", image: null, hoverImage: null, size: "s", offset: null, href: "product.html", hoverLabel: "朝を始めるセット" },
    { id: "p08", name: "T-Shirt",     italic: "logo",    category: "goods",  price: 4200, tag: "GOODS", isNew: false, color: "#B2B2B2", image: null, hoverImage: null, size: "m", offset: null, href: "product.html", hoverLabel: "今日は軽くいく" },
  ];

  /* ---------- Render ---------- */
  const grid = document.getElementById("grid");
  const filterButtons = document.querySelectorAll(".filter button");
  const shopIntroText = document.getElementById("shopIntroText");
  const bagButton = document.querySelector(".bag-btn");
  const bagCount = document.querySelector(".bag-btn .count");
  const bagDrawer = document.getElementById("bagDrawer");
  const bagOverlay = document.getElementById("bagOverlay");
  const bagClose = document.getElementById("bagClose");
  const bagItems = document.getElementById("bagItems");
  const bagSubtotal = document.getElementById("bagSubtotal");
  const CART_KEY = "hysd-cart-v1";
  const FILTER_KEY = "hysd-filter-cat";

  const yen = new Intl.NumberFormat("ja-JP", { style: "currency", currency: "JPY", maximumFractionDigits: 0 });
  const FILTER_COPY = {
    all: "毎日に寄り添う一杯。気分に合わせて、選んでください。",
    coffee: "シングルオリジンからデイリーブレンドまで。その日のムードで選べるコーヒーを揃えました。",
    goods: "カップやトートなど、コーヒーの時間を少しだけ気持ちよくする日用品たちです。",
  };
  const HERO_REPLY_POOL = [
    { en: "slow morning", jp: "ゆっくりいこ" },
    { en: "need a reset", jp: "ちょいリセット" },
    { en: "a little brighter", jp: "ちょい明るめで" },
    { en: "take it easy", jp: "力ぬいてこ" },
    { en: "one more breath", jp: "もうひと息" },
    { en: "late start today", jp: "今日はゆっくりで" },
    { en: "something steady", jp: "安定感ほしい" },
    { en: "just a small lift", jp: "ちょい上げたい" },
    { en: "keep it gentle", jp: "やさしめで" },
    { en: "clear my head", jp: "頭すっきりしたい" },
    { en: "back to myself", jp: "自分に戻ろ" },
    { en: "let it soften", jp: "ふわっといこ" },
  ];
  const HERO_REPLY_POSITIONS = [
    { x: "56%", y: "14%" },
    { x: "72%", y: "24%" },
    { x: "50%", y: "34%" },
    { x: "66%", y: "44%" },
    { x: "78%", y: "54%" },
    { x: "58%", y: "62%" },
    { x: "71%", y: "72%" },
    { x: "47%", y: "76%" },
  ];

  function shuffle(array) {
    const copy = [...array];
    for (let i = copy.length - 1; i > 0; i -= 1) {
      const j = Math.floor(Math.random() * (i + 1));
      [copy[i], copy[j]] = [copy[j], copy[i]];
    }
    return copy;
  }

  function setupHeroReplies() {
    const tail = document.querySelector(".hero__tail");
    if (!tail) return;

    const isMobile = window.innerWidth <= 767;
    const replyCount = isMobile ? 5 : 7;
    const replies = shuffle(HERO_REPLY_POOL).slice(0, replyCount);
    const positions = shuffle(HERO_REPLY_POSITIONS).slice(0, replyCount);

    tail.innerHTML = replies.map((reply, index) => {
      const position = positions[index] || HERO_REPLY_POSITIONS[index % HERO_REPLY_POSITIONS.length];
      const steps = Math.max(8, Math.min(18, reply.en.length));
      const delay = 2.76 + index * 0.16;
      return `<span class="hero__reply" tabindex="0" style="--reply-x:${position.x}; --reply-y:${position.y}; --reply-delay:${delay.toFixed(2)}s; --reply-steps:${steps};"><span class="hero__reply-text hero__reply-text--en">${reply.en}</span><span class="hero__reply-text hero__reply-text--jp">${reply.jp}</span></span>`;
    }).join("");
  }

  function loadCart() {
    try {
      return JSON.parse(localStorage.getItem(CART_KEY) || "[]");
    } catch {
      return [];
    }
  }

  function saveCart(cart) {
    localStorage.setItem(CART_KEY, JSON.stringify(cart));
  }

  function resolveCartItemImage(item) {
    if (item.image) return item.image;
    return productsData.find((product) => product.id === item.id)?.image || "";
  }

  function getCartCount(cart = loadCart()) {
    return cart.reduce((sum, item) => sum + item.quantity, 0);
  }

  function getSubtotal(cart = loadCart()) {
    return cart.reduce((sum, item) => sum + item.price * item.quantity, 0);
  }

  function updateBagCount() {
    bagCount.textContent = `(${getCartCount()})`;
  }

  function renderBag() {
    const cart = loadCart();
    let cartChanged = false;
    cart.forEach((item) => {
      if (!item.image) {
        const resolvedImage = resolveCartItemImage(item);
        if (resolvedImage) {
          item.image = resolvedImage;
          cartChanged = true;
        }
      }
    });
    if (cartChanged) saveCart(cart);
    bagSubtotal.textContent = yen.format(getSubtotal(cart));

    if (!cart.length) {
      bagItems.innerHTML = `
        <div class="bag-empty">
          <div>
            <h3>Your bag is empty.</h3>
            <p>Add a coffee and we will keep it here.</p>
          </div>
        </div>
      `;
      const bagBody = bagItems.closest(".bag-drawer__body");
      if (bagBody) bagBody.scrollTop = 0;
      return;
    }

    bagItems.innerHTML = `
      <ul class="bag-list">
        ${cart.map((item, index) => `
          <li class="bag-item">
            <div class="bag-item__media ${item.image ? "has-image" : ""}" style="--ph: ${item.color || "#B08650"}; --bag-img: ${item.image ? `url('${item.image}')` : "none"};" aria-hidden="true"></div>
            <div>
              <div class="bag-item__top">
                <div>
                  <div class="bag-item__name">${item.name}${item.italic ? ` <em>${item.italic}</em>` : ""}</div>
                  <div class="bag-item__meta">${item.variant || item.category || "Coffee"}</div>
                </div>
                <div class="bag-item__price">${yen.format(item.price * item.quantity)}</div>
              </div>
              <div class="bag-item__bottom" style="margin-top: 14px;">
                <div class="bag-item__qty" data-index="${index}">
                  <button type="button" data-action="decrease" aria-label="数量を減らす">−</button>
                  <span>${item.quantity}</span>
                  <button type="button" data-action="increase" aria-label="数量を増やす">＋</button>
                </div>
                <button class="bag-item__remove" type="button" data-remove="${index}">Remove</button>
              </div>
            </div>
          </li>
        `).join("")}
      </ul>
    `;
    const bagBody = bagItems.closest(".bag-drawer__body");
    if (bagBody) bagBody.scrollTop = 0;
  }

  function openBag() {
    renderBag();
    const bagBody = bagItems.closest(".bag-drawer__body");
    if (bagBody) bagBody.scrollTop = 0;
    bagDrawer.classList.add("is-open");
    bagOverlay.classList.add("is-open");
    bagDrawer.setAttribute("aria-hidden", "false");
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => {
      if (bagBody) bagBody.scrollTop = 0;
      requestAnimationFrame(() => {
        if (bagBody) bagBody.scrollTop = 0;
      });
    });
    window.setTimeout(() => {
      if (bagBody) bagBody.scrollTop = 0;
    }, 80);
  }

  function closeBag() {
    bagDrawer.classList.remove("is-open");
    bagOverlay.classList.remove("is-open");
    bagDrawer.setAttribute("aria-hidden", "true");
    document.body.style.overflow = "";
  }

  function updateQuantity(index, delta) {
    const cart = loadCart();
    const item = cart[index];
    if (!item) return;
    item.quantity += delta;
    if (item.quantity <= 0) {
      cart.splice(index, 1);
    }
    saveCart(cart);
    updateBagCount();
    renderBag();
  }

  let productsData = [...FALLBACK_PRODUCTS];

  async function loadProducts() {
    try {
      const res = await fetch("/api/products");
      if (!res.ok) throw new Error(`Failed to load products: ${res.status}`);
      const data = await res.json();
      if (Array.isArray(data.contents) && data.contents.length) {
        productsData = data.contents;
      }
    } catch (error) {
      console.warn("Using fallback products.", error);
      productsData = [...FALLBACK_PRODUCTS];
    }
  }

  function getProductHref(product) {
    const target = product.href || "product.html";
    const separator = target.includes("?") ? "&" : "?";
    return `${target}${separator}id=${encodeURIComponent(product.id)}`;
  }

  function render(category) {
    const list = category === "all" ? productsData : productsData.filter(p => p.category === category);
    if (shopIntroText) {
      shopIntroText.textContent = FILTER_COPY[category] || FILTER_COPY.all;
    }
    grid.innerHTML = list.map((p, index) => {
      const italicHTML = p.italic ? `<em>${p.italic}</em>` : "";
      const sizeClass = `size-${p.size || "m"}`;
      const offsetClass = p.offset ? `offset-${p.offset}` : "";
      const hoverLabel = p.hoverLabel || "ADD TO CART";
      const hoverImageClass = p.hoverImage ? "has-hover-image" : "";
      const imageClass = p.image ? "has-image" : "";
      return `
        <article class="card reveal ${sizeClass} ${offsetClass} ${hoverImageClass} ${imageClass}" role="link" tabindex="0" aria-label="${p.name}の商品詳細を見る" data-href="${getProductHref(p)}" data-cat="${p.category}" style="--ph: ${p.color}; --img: ${p.image ? `url('${p.image}')` : "none"}; --img-hover: ${p.hoverImage ? `url('${p.hoverImage}')` : "none"}; --reveal-index: ${index};">
          <div class="card__media" aria-hidden="true">
            <div class="card__art"></div>
            <div class="card__image"></div>
            <div class="card__image-hover"></div>
            <div class="card__cursor"><span class="label">${hoverLabel}</span><span class="brace">}</span></div>
          </div>
          <div class="card__info">
            <div>
              <div class="card__name"><span class="card__name-main">${p.name}</span>${italicHTML}</div>
            </div>
            <div class="card__price">${yen.format(p.price)}</div>
          </div>
        </article>
      `;
    }).join("");
    observeReveals();
    setupCardCursors();
    setupCardLinks();
  }

  function navigateWithDirection(href, direction) {
    sessionStorage.setItem("hysd-nav-direction", direction);
    window.location.href = href;
  }

  /* ---------- Filter ---------- */
  filterButtons.forEach(btn => {
    btn.addEventListener("click", () => {
      filterButtons.forEach(b => b.classList.remove("active"));
      btn.classList.add("active");
      sessionStorage.setItem(FILTER_KEY, btn.dataset.cat);
      render(btn.dataset.cat);
    });
  });

  /* ---------- Card cursor: マウス追従の "View more" ---------- */
  function setupCardCursors() {
    document.querySelectorAll(".card").forEach((card) => {
      const cursor = card.querySelector(".card__cursor");
      const media = card.querySelector(".card__media");
      if (!cursor || !media) return;

      let targetX = 0, targetY = 0;
      let currentX = 0, currentY = 0;
      let isHovering = false;
      let rafId = null;

      function applyPos() {
        cursor.style.setProperty("--cur-x", `calc(${currentX}px - 50%)`);
        cursor.style.setProperty("--cur-y", `calc(${currentY}px - 50%)`);
      }

      function tick() {
        const ease = 0.28;
        currentX += (targetX - currentX) * ease;
        currentY += (targetY - currentY) * ease;
        applyPos();

        if (Math.abs(targetX - currentX) < 0.1 && Math.abs(targetY - currentY) < 0.1) {
          rafId = null;
          return;
        }
        rafId = requestAnimationFrame(tick);
      }

      function startTick() {
        if (rafId === null) rafId = requestAnimationFrame(tick);
      }

      media.addEventListener("mouseenter", (e) => {
        isHovering = true;
        card.classList.add("is-hovered");
        const rect = media.getBoundingClientRect();
        targetX = e.clientX - rect.left;
        targetY = e.clientY - rect.top;
        // 初期位置を即時セット（カーソルがジャンプしないように）
        currentX = targetX;
        currentY = targetY;
        applyPos();
        startTick();
      });

      media.addEventListener("mousemove", (e) => {
        const rect = media.getBoundingClientRect();
        targetX = e.clientX - rect.left;
        targetY = e.clientY - rect.top;
        startTick();
      });

      media.addEventListener("mouseleave", () => {
        isHovering = false;
        card.classList.remove("is-hovered");
      });
    });
  }

  function setupCardLinks() {
    document.querySelectorAll(".card").forEach((card) => {
      const href = card.dataset.href;
      if (!href) return;
      card.addEventListener("click", () => {
        navigateWithDirection(href, "forward");
      });
      card.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          navigateWithDirection(href, "forward");
        }
      });
    });
  }

  function setupDirectionalLinks() {
    document.querySelectorAll("[data-nav-direction]").forEach((link) => {
      link.addEventListener("click", (e) => {
        const anchor = e.currentTarget;
        if (!(anchor instanceof HTMLAnchorElement)) return;
        const href = anchor.getAttribute("href");
        const direction = anchor.dataset.navDirection;
        if (!href || !direction) return;
        e.preventDefault();
        navigateWithDirection(href, direction);
      });
    });
  }

  function setupScrollGlow() {
    let rafId = null;
    const update = () => {
      const maxScroll = Math.max(document.documentElement.scrollHeight - window.innerHeight, 1);
      const progress = Math.min(window.scrollY / maxScroll, 1);
      document.body.style.setProperty("--scroll-glow", progress.toFixed(3));
      document.body.style.setProperty("--glow-strength", (0.2 + progress * 0.8).toFixed(3));
      rafId = null;
    };
    const requestUpdate = () => {
      if (rafId === null) rafId = requestAnimationFrame(update);
    };
    window.addEventListener("scroll", requestUpdate, { passive: true });
    window.addEventListener("resize", requestUpdate);
    update();
  }

  function setupHeaderContrast() {
    const header = document.querySelector(".header");
    const themeSections = document.querySelectorAll("[data-header-theme='acid']");
    if (!header || !themeSections.length) return;

    const syncHeaderState = (isAcid) => {
      header.classList.toggle("header--hero", isAcid);
    };

    syncHeaderState(false);

    const sectionObserver = new IntersectionObserver((entries) => {
      const hasAcidSection = entries.some((entry) => entry.isIntersecting);
      syncHeaderState(hasAcidSection);
    }, {
      threshold: 0.2,
      rootMargin: "-64px 0px 0px 0px",
    });

    themeSections.forEach((section) => sectionObserver.observe(section));
  }

  /* ---------- Reveal on scroll ---------- */
  let observer;
  function observeReveals() {
    if (observer) observer.disconnect();
    observer = new IntersectionObserver((entries) => {
      entries.forEach(e => {
        if (e.isIntersecting) {
          e.target.classList.add("in");
          observer.unobserve(e.target);
        }
      });
    }, { threshold: 0.1, rootMargin: "0px 0px -10% 0px" });
    document.querySelectorAll(".reveal").forEach(el => observer.observe(el));
  }

  /* ---------- Init ---------- */
  async function initPage() {
    setupHeroReplies();

    const initialCategory = sessionStorage.getItem(FILTER_KEY) || "all";
    const initialButton = document.querySelector(`.filter button[data-cat="${initialCategory}"]`);
    if (initialButton) {
      filterButtons.forEach(b => b.classList.remove("active"));
      initialButton.classList.add("active");
    }

    await loadProducts();
    render(initialCategory);
    updateBagCount();
    renderBag();
    setupHeaderContrast();
    setupDirectionalLinks();
    setupScrollGlow();

    bagButton.addEventListener("click", openBag);
    bagClose.addEventListener("click", closeBag);
    bagOverlay.addEventListener("click", closeBag);
    document.addEventListener("click", (e) => {
      const target = e.target.closest(".bag-btn");
      if (!target) return;
      openBag();
    });
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape") closeBag();
    });
    bagItems.addEventListener("click", (e) => {
    const removeIndex = e.target.closest("[data-remove]")?.dataset.remove;
    if (removeIndex !== undefined) {
      const cart = loadCart();
      cart.splice(Number(removeIndex), 1);
      saveCart(cart);
      updateBagCount();
      renderBag();
      return;
    }

    const qtyControl = e.target.closest(".bag-item__qty");
    const action = e.target.dataset.action;
    if (qtyControl && action) {
      updateQuantity(Number(qtyControl.dataset.index), action === "increase" ? 1 : -1);
    }
    });
  }

  initPage();

  /* ---------- About: マウス追従するCTAボタン ---------- */
  (function setupAboutCta() {
    const section = document.querySelector(".about");
    const cta = document.querySelector(".about__cta");
    if (!section || !cta) return;

    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;
    let centerX = 0;
    let centerY = 0;
    let isHovering = false;
    let rafId = null;

    function calcCenter() {
      const sRect = section.getBoundingClientRect();
      // セクション内座標での中央
      centerX = sRect.width / 2;
      centerY = sRect.height / 2;
      if (!isHovering) {
        targetX = centerX;
        targetY = centerY;
        currentX = centerX;
        currentY = centerY;
        applyPos();
      }
    }

    function applyPos() {
      cta.style.setProperty("--cta-x", currentX + "px");
      cta.style.setProperty("--cta-y", currentY + "px");
    }

    function tick() {
      const ease = isHovering ? 0.18 : 0.08;
      currentX += (targetX - currentX) * ease;
      currentY += (targetY - currentY) * ease;
      applyPos();

      const dx = Math.abs(targetX - currentX);
      const dy = Math.abs(targetY - currentY);
      if (dx < 0.1 && dy < 0.1) {
        currentX = targetX;
        currentY = targetY;
        applyPos();
        rafId = null;
        return;
      }
      rafId = requestAnimationFrame(tick);
    }

    function startTick() {
      if (rafId === null) rafId = requestAnimationFrame(tick);
    }

    section.addEventListener("mousemove", (e) => {
      isHovering = true;
      const rect = section.getBoundingClientRect();
      // ボタン中心 = マウス位置（セクション基準座標）
      targetX = e.clientX - rect.left;
      targetY = e.clientY - rect.top;
      startTick();
    });

    section.addEventListener("mouseleave", () => {
      isHovering = false;
      targetX = centerX;
      targetY = centerY;
      startTick();
    });

    window.addEventListener("resize", calcCenter);
    requestAnimationFrame(() => {
      calcCenter();
      if (document.fonts && document.fonts.ready) {
        document.fonts.ready.then(calcCenter);
      }
    });
  })();
