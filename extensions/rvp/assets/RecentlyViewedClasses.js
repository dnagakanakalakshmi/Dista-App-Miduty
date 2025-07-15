  // Product Card Renderer
  class ProductCardRendererRVP {
    constructor(settings, widgetSettings) {
      this.settings = settings;
      this.widgetSettings = widgetSettings;
      this.template = document.getElementById('product-card-template');
    }

    createCard(product) {
      const templateContent = this.template.content.cloneNode(true);
      const cardEl = templateContent.querySelector('.recently-viewed-card');
      const presentmentPrice = product.variants[0].presentmentPrice;
      const presentmentCompareAtPrice = product.variants[0].presentmentCompareAtPrice;
      const count = product.ratingCount;

      this.setupCardLayout(cardEl);
      this.setupProductData(cardEl, product);
      this.setupPriceElements(cardEl, presentmentPrice, presentmentCompareAtPrice);
      this.setupRatingElements(cardEl, product.rating, count);
      this.setupVariantInput(cardEl, product);
      this.setupButtonHandlers(cardEl, product);

      return templateContent;
    }

    setupCardLayout(cardEl) {
      if (cardEl) {
        cardEl.setAttribute('data-card-layout', this.settings.cardLayout);
        if (this.settings.cardLayout === 'horizontal') {
          cardEl.classList.add('recently-viewed-card--horizontal');
        } else {
          cardEl.classList.remove('recently-viewed-card--horizontal');
        }
        cardEl.style.setProperty('--show-add-to-cart', this.settings.showAddToCart ? 'block' : 'none');
        cardEl.style.setProperty('--show-buy-now', this.settings.showBuyNow ? 'block' : 'none');
      }
    }

    setupProductData(cardEl, product) {
      const imageLink = cardEl.querySelector('.recently-viewed-image-link');
      const titleLink = cardEl.querySelector('.recently-viewed-title');
      const imageEl = cardEl.querySelector('.recently-viewed-image');
      const reviewsLink = cardEl.querySelector('.recently-viewed-reviews-link');

      if (imageLink) imageLink.href = product.url;
      if (titleLink) titleLink.href = product.url;
      if (imageEl) imageEl.src = product.image || '';
      if (titleLink) titleLink.textContent = product.title || '';
      if (reviewsLink) reviewsLink.href = product.url;

      const atcBtn = cardEl.querySelector('.recently-viewed-atc-button');
      if (atcBtn) {
        const numericID = window.RecentlyViewedUtils.extractNumericId(product.id);
        atcBtn.setAttribute('data-product-card-swatch-id', numericID);
        atcBtn.href = product.url;
      }

      const buyNowBtn = cardEl.querySelector('.recently-viewed-buy-now-button');
      if (buyNowBtn) {
        const numericID = window.RecentlyViewedUtils.extractNumericId(product.id);
        buyNowBtn.setAttribute('data-product-card-swatch-id', numericID);
        buyNowBtn.href = product.url;
      }

      // Setup quick view buttons
      const quickViewButtons = cardEl.querySelectorAll('.quick-view-btn');
      const hasRealVariants =
        product.variants && product.variants.length > 1
        || (product.variants && product.variants.length === 1 && product.variants[0].title !== 'Default Title');

      quickViewButtons.forEach(btn => {
        btn.setAttribute('data-product', JSON.stringify(product));
        btn.setAttribute('data-title', encodeURIComponent(product.title));
        btn.setAttribute('data-has-variants', hasRealVariants ? 'true' : 'false');
      });

      // Check if all variants are unavailable
      const allVariantsUnavailable = !product.variants?.some((v) => v.availableForSale);

      // Disable Add to Cart and Buy Now buttons if all variants are unavailable
      if (allVariantsUnavailable) {
        const atcBtn = cardEl.querySelector('.recently-viewed-atc-button');
        const buyNowBtn = cardEl.querySelector('.recently-viewed-buy-now-button');
        if (atcBtn) {
          const atcBtnTxt = atcBtn.querySelector('.recently-viewed-atc-button-text');
          if (atcBtnTxt) {
            atcBtnTxt.textContent = 'Sold Out';
          }
          atcBtn.disabled = true;
          atcBtn.style.opacity = '0.5';
          atcBtn.style.pointerEvents = 'none';
        }
        if (buyNowBtn) {
          const buyNowBtnTxt = atcBtn.querySelector('.recently-viewed-buy-now-button-text');
          if (buyNowBtnTxt) {
            buyNowBtnTxt.textContent = 'Sold Out';
          }
          buyNowBtn.disabled = true;
          buyNowBtn.style.opacity = '0.5';
          buyNowBtn.style.pointerEvents = 'none';
        }
      }
    }

    setupPriceElements(cardEl, price, comparePrice) {
      const priceEl = cardEl.querySelector('.recently-viewed-price');
      const comparePriceEl = cardEl.querySelector('.recently-viewed-compare-price');
      const saveBadgeEl = cardEl.querySelector('.recently-viewed-badge');

      if (priceEl) {
        const formattedPrice = parseFloat(price).toFixed(2);
        const stringCurrency = String(formattedPrice);
        priceEl.textContent = window.CurrencyUtils.formatMoneyCurrency(stringCurrency, window.money_format);
      }

      if (comparePriceEl) {
        const compareAtPrice = parseFloat(comparePrice || 0);
        const currentPrice = parseFloat(price || 0);

        if (compareAtPrice > currentPrice) {
          const formattedPrice = parseFloat(comparePrice).toFixed(2);
          const stringCurrency = String(formattedPrice);
          comparePriceEl.textContent = window.CurrencyUtils.formatMoneyCurrency(stringCurrency, window.money_format);
          comparePriceEl.style.display = 'inline';
        } else {
          comparePriceEl.style.display = 'none';
        }
      }

      if (saveBadgeEl) {
        const compareAtPrice = parseFloat(comparePrice);
        const currentPrice = parseFloat(price);
        const discount = Math.round(((compareAtPrice - currentPrice) / compareAtPrice) * 100);

        if (!isNaN(discount) && discount > 0) {
          // Use custom save text from widget settings and wrap discount (and % if present) in a div, preserving whitespace
          const saveText = this.widgetSettings.saveText || 'Save {percent}%';
          const parts = saveText.split('{percent}');
          let after = parts[1] || '';
          let symbol = '';
          if (after.startsWith('%')) {
            symbol = '%';
            after = after.slice(1);
          }
          saveBadgeEl.innerHTML = `${parts[0]}<div class="recently-viewed-discount-value">${discount}${symbol}</div>${after}`;
          saveBadgeEl.style.display = 'flex';
          saveBadgeEl.style.flexDirection = 'row';
          saveBadgeEl.style.whiteSpace = 'pre';
        } else {
          saveBadgeEl.style.display = 'none';
        }
      }
    }

    setupRatingElements(cardEl, rating, count) {
      const ratingStars = cardEl.querySelector('.recently-viewed-stars');
      const ratingCount = cardEl.querySelector('.recently-viewed-review-count');

      if (ratingStars && rating > 0) {
        ratingStars.style.setProperty('--rating', rating);
        ratingStars.parentElement.classList.add('visible');
        ratingStars.parentElement.style.visibility = 'visible';

        // Use custom stars text from widget settings
        const starsText = this.widgetSettings.starsText || '{count} review/reviews';
        const formattedStarsText = starsText.replace('{count}', count);
        
        if (ratingCount) {
          ratingCount.textContent = formattedStarsText;
        }
      } else if (ratingStars) {
        ratingStars.parentElement.style.visibility = 'hidden';
        ratingStars.parentElement.classList.remove('visible');
      }
    }

    setupVariantInput(cardEl, product) {
      const variantInput = cardEl.querySelector('.product-variant-id');
      const formEl = cardEl.querySelector('.recently-viewed-form');
      const buyNowFormEl = cardEl.querySelector('.recently-viewed-buy-now-form');

      if (variantInput) {
        if (product.variants?.length > 0 && product.variants[0].id) {
          const variantId = product.variants[0].id.split('/').pop();
          variantInput.value = variantId;

          if (formEl) {
            formEl.setAttribute('data-product-title', product.title);
            formEl.setAttribute('data-variant-id', variantId);
          }
          if (buyNowFormEl) {
            const variantInput = buyNowFormEl.querySelector('.product-variant-id');
            variantInput.value = variantId;
            buyNowFormEl.setAttribute('data-product-title', product.title);
            buyNowFormEl.setAttribute('data-variant-id', variantId);
          }
        } else {
          this.disableUnavailableButtons(formEl, buyNowFormEl);
        }
      }
    }

    disableUnavailableButtons(formEl, buyNowFormEl) {
      if (formEl) {
        formEl.style.opacity = '0.5';
        formEl.style.pointerEvents = 'none';
        const button = formEl.querySelector('button');
        if (button) {
          button.disabled = true;
          button.textContent = 'Unavailable';
        }
      }
      if (buyNowFormEl) {
        buyNowFormEl.style.opacity = '0.5';
        buyNowFormEl.style.pointerEvents = 'none';
        const buyNowButton = buyNowFormEl.querySelector('button');
        if (buyNowButton) {
          buyNowButton.disabled = true;
          buyNowButton.textContent = 'Unavailable';
        }
      }
    }

    setupButtonHandlers(cardEl, product) {
      const formEl = cardEl.querySelector('.recently-viewed-form');
      const buyNowFormEl = cardEl.querySelector('.recently-viewed-buy-now-form');
    }
  }

  // Carousel Controller
  class CarouselControllerRVP {
    constructor(carousel, prevBtn, nextBtn, cardLayout) {
      this.carousel = carousel;
      this.prevBtn = prevBtn;
      this.nextBtn = nextBtn;
      this.cardLayout = cardLayout;
      this.currentIndex = 0;
      this.cards = [];
      this.gap = 20; // fallback
      this.resizeObserver = new ResizeObserver(() => this.handleResize());
    }

    init() {
      this.cards = Array.from(this.carousel.querySelectorAll('.recently-viewed-card'));
      if (this.cards.length === 0) return;

      // Use getBoundingClientRect for accurate width
      this.cardWidth = this.cards[0].getBoundingClientRect().width;
      this.containerWidth = this.carousel.parentElement.getBoundingClientRect().width;
      // Get the real gap from computed style
      const computedGap = window.getComputedStyle(this.carousel).gap;
      this.gap = computedGap ? parseFloat(computedGap) : 20;
      this.maxIndex = this.calculateMaxIndex();

      this.prevBtn.addEventListener('click', this.prevHandler = () => this.navigate(-1));
      this.nextBtn.addEventListener('click', this.nextHandler = () => this.navigate(1));
      this.resizeObserver.observe(this.carousel.parentElement);

      this.updateCarousel();
    }

    calculateMaxIndex() {
      // Calculate the number of visible cards (fully visible)
      const totalWidth = this.cardWidth + this.gap;
      const visibleCards = Math.max(1, Math.floor((this.containerWidth + this.gap - 1) / totalWidth));
      // maxIndex is the last index where the last visible card is the last card
      return Math.max(0, this.cards.length - visibleCards);
    }

    navigate(direction) {
      this.currentIndex = Math.max(0, Math.min(this.currentIndex + direction, this.maxIndex));
      this.updateCarousel();
    }

    updateCarousel() {
      this.currentIndex = Math.max(0, Math.min(this.currentIndex, this.maxIndex));
      const offset = -this.currentIndex * (this.cardWidth + this.gap);
      this.carousel.style.transform = `translateX(${offset}px)`;

      this.nextBtn.style.display = this.currentIndex >= this.maxIndex ? 'none' : 'flex';
      this.prevBtn.style.display = this.currentIndex <= 0 ? 'none' : 'flex';
    }

    handleResize() {
      this.cardWidth = this.cards[0]?.getBoundingClientRect().width || this.cardWidth;
      this.containerWidth = this.carousel.parentElement.getBoundingClientRect().width;
      const computedGap = window.getComputedStyle(this.carousel).gap;
      this.gap = computedGap ? parseFloat(computedGap) : this.gap;
      this.maxIndex = this.calculateMaxIndex();
      this.currentIndex = Math.min(this.currentIndex, this.maxIndex);
      this.updateCarousel();
    }

    destroy() {
      this.resizeObserver.disconnect();
      this.prevBtn.removeEventListener('click', this.prevHandler);
      this.nextBtn.removeEventListener('click', this.nextHandler);
    }
  }