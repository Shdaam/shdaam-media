/* Add custom JS code below */

// ==========================================================================
// غرفة القياس الذكية — تعمل في صفحات منتجات المشدات فقط
// ==========================================================================

// المنتجات المسجلة هنا + أي منتج جديد يحتوي اسمه على كلمة "مشد"
var FITTING_ALLOWED_PRODUCTS = ['867512566', '2091202541', '1267635373'];

// فحص سريع قبل أي شيء: إذا لم تكن الصفحة صفحة منتج (مثل الرئيسية والتصنيفات)
// يتوقف الكود فوراً بدون تجهيز أي وظائف أو صور
(function (run) {
    var match = decodeURIComponent(window.location.pathname).match(/\/p(\d+)/);
    if (!match) return;
    var productId = match[1];

    function start() {
        if (!document.body.classList.contains('product-single')) return;
        if (FITTING_ALLOWED_PRODUCTS.indexOf(productId) === -1) {
            var title = (document.querySelector('h1') || {}).textContent || document.title || '';
            if (title.indexOf('مشد') === -1) return;
        }
        if (document.getElementById('fittingModalOverlay')) return;
        run(productId);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', start);
    } else {
        start();
    }
})(function (currentProductId) {

    const isTargetProduct = true;

    function getMatchedProductId() {
        return currentProductId;
    }

    // إخفاء دليل المقاسات الافتراضي لسلة لمنع الازدواجية مع الزر الموحد
    function hideOriginalSizeGuide() {
        const guide = document.querySelector('salla-product-size-guide') ||
            document.querySelector('.sicon-pencil-ruler:not(#openCustomSizeGuideBtn i)');
        if (!guide) return;
        const section = guide.closest('section');
        // نخفي القسم كاملاً فقط إذا لم يكن يحتوي خيارات المقاسات أو زر غرفة القياس
        if (section && !section.querySelector('salla-product-options, #fittingAndSizeGuideRow')) {
            section.style.display = 'none';
        } else {
            guide.style.display = 'none';
        }
    }

    // استخراج رابط صورة دليل المقاسات المرفوعة في سلة
    function getSallaSizeGuideImageSrc() {
        const sizeGuideElem = document.querySelector('salla-product-size-guide');
        if (sizeGuideElem) {
            if (sizeGuideElem.hasAttribute('image')) return sizeGuideElem.getAttribute('image');

            const root = sizeGuideElem.shadowRoot || sizeGuideElem;
            const img = root.querySelector('img');
            if (img && img.src) return img.src;
        }

        const anyGuideImg = document.querySelector('img[src*="size"], img[alt*="مقاسات"], img[alt*="المقاسات"]');
        if (anyGuideImg) return anyGuideImg.src;

        return '';
    }

    // التحديد التلقائي للمقاس المقترح في خيارات سلة
    // يحدد المقاس في كل مجموعة مقاسات (مثل عرض 1+1 الذي فيه مقاس للمشد الأول والثاني)
    // ويرجع true إذا تم تحديد مقاس في كل المجموعات
    function autoSelectSallaSize(targetSize) {
        const optionsContainer = document.querySelector('salla-product-options');
        if (!optionsContainer) return false;

        const target = targetSize.trim().toUpperCase();
        const root = optionsContainer.shadowRoot || optionsContainer;

        // أسماء بديلة لنفس المقاس (مثل 2XL و XXL)
        const aliases = {
            '2XL': ['2XL', 'XXL'],
            'XXL': ['XXL', '2XL'],
            '3XL': ['3XL', 'XXXL'],
            'XXXL': ['XXXL', '3XL']
        };
        const primary = aliases[target] || [target];
        // إذا لم يوجد 3XL في خيارات المنتج نختار 2XL كأقرب مقاس
        const fallback = (target === '3XL' || target === 'XXXL') ? ['2XL', 'XXL'] : [];

        // تجميع أزرار المقاسات حسب المجموعة (اسم الحقل options[رقم])
        const groups = {};
        root.querySelectorAll('input[type="radio"][name^="options["]').forEach(input => {
            (groups[input.name] = groups[input.name] || []).push(input);
        });

        function labelText(input) {
            const label = input.closest('label');
            return (label ? label.textContent : '').trim().toUpperCase();
        }

        let allSelected = Object.keys(groups).length > 0;

        Object.values(groups).forEach(inputs => {
            const pick = inputs.find(i => primary.includes(labelText(i))) ||
                inputs.find(i => fallback.includes(labelText(i)));
            if (!pick) {
                allSelected = false;
                return;
            }
            const label = pick.closest('label');
            if (label && !pick.checked) label.click();
            if (!pick.checked) {
                pick.checked = true;
                pick.dispatchEvent(new Event('change', { bubbles: true }));
            }
        });

        return allSelected;
    }

    // إضافة المنتج للسلة بالمقاس المقترح عبر سلة مباشرة
    async function addRecommendedToCart(targetSize) {
        const selected = autoSelectSallaSize(targetSize);
        const form = document.querySelector('salla-product-options')?.closest('form');
        if (!selected || !form || !window.salla || !salla.cart || !salla.cart.addItem) {
            return { ok: false, reason: 'select' };
        }

        // قراءة كل الخيارات المحددة من نموذج المنتج
        const options = {};
        new FormData(form).forEach((value, key) => {
            const m = key.match(/^options\[(\d+)\](\[\])?$/);
            if (m && value !== '') {
                if (m[2]) (options[m[1]] = options[m[1]] || []).push(value);
                else options[m[1]] = value;
            }
        });

        const qtyInput = form.querySelector('input[name="quantity"]');
        const quantity = Math.max(1, parseInt(qtyInput && qtyInput.value, 10) || 1);

        try {
            await salla.cart.addItem({ id: currentProductId, quantity: quantity, options: options });
            return { ok: true };
        } catch (e) {
            return { ok: false, reason: 'api' };
        }
    }

    // إعادة ترتيب عناصر صفحة المنتج وحقن الزر الموحد ونقل وسائل الدفع
    function rearrangeLayoutAndInjectButton(retryCount = 0) {
        if (!isTargetProduct) return;

        const optionsElem = document.querySelector('salla-product-options');
        const descriptionContainer = document.querySelector('.product-single-top-description') ||
            document.querySelector('salla-product-description') ||
            document.querySelector('.product-single__description');

        const paymentsElem = document.querySelector('salla-payments') ||
            document.querySelector('.s-payments-list-wrap');

        let unifiedWrapper = document.getElementById('fittingAndSizeGuideRow');

        // الوصف يُنقل تحت الزر فقط إذا كان معروضاً بجانب الصور (داخل نفس نموذج المنتج)
        // في تنسيقات الثيم التي تعرض الوصف في تبويبات أسفل الصفحة نتركه في مكانه
        const descInsideForm = descriptionContainer && optionsElem &&
            descriptionContainer.closest('form') && descriptionContainer.closest('form') === optionsElem.closest('form')
            ? descriptionContainer : null;

        // الخطوة 1: حقن كبسولة الزر الموحد بعد خيارات المقاسات
        if (optionsElem && !unifiedWrapper) {
            unifiedWrapper = document.createElement('div');
            unifiedWrapper.className = 'fitting-sizeguide-unified-wrapper';
            unifiedWrapper.id = 'fittingAndSizeGuideRow';

            unifiedWrapper.innerHTML = `
                <div class="fitting-sizeguide-unified-btn">
                    <button id="openFittingRoomBtn" type="button" class="unified-btn-part">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" stroke-width="0" stroke-linecap="round" stroke-linejoin="round">
                            <path d="M10.75,6.405 C10.75,6.819 10.414,7.155 10,7.155 C9.586,7.155 9.25,6.819 9.25,6.405 C9.25,4.905 10.516,3.75 12,3.75 C13.484,3.75 14.75,4.905 14.75,6.405 C14.75,7.428 14.154,8.298 13.31,8.739 C13.122,8.838 12.965,8.955 12.865,9.072 C12.768,9.184 12.75,9.261 12.75,9.31 L12.75,10.809 C13.267,10.892 13.758,11.066 14.239,11.337 L20.242,14.713 C21.174,15.237 21.75,16.223 21.75,17.292 C21.75,18.926 20.426,20.25 18.792,20.25 L5.208,20.25 C3.575,20.25 2.25,18.926 2.25,17.292 C2.25,16.223 2.826,15.237 3.758,14.713 L9.761,11.337 C10.242,11.066 10.733,10.892 11.25,10.809 L11.25,9.31 C11.25,8.31 12.076,7.693 12.614,7.411 C13.008,7.204 13.25,6.821 13.25,6.405 C13.25,5.801 12.725,5.25 12,5.25 C11.275,5.25 10.75,5.801 10.75,6.405 Z M12,12.25 C11.453,12.25 10.978,12.373 10.496,12.644 L4.493,16.021 C4.034,16.279 3.75,16.765 3.75,17.292 C3.75,18.097 4.403,18.75 5.208,18.75 L18.792,18.75 C19.597,18.75 20.25,18.097 20.25,17.292 C20.25,16.765 19.966,16.279 19.507,16.021 L13.504,12.644 C13.022,12.373 12.547,12.25 12,12.25 Z" fill="currentColor"></path>
                        </svg>
                        <span>غرفة القياس الذكية</span>
                    </button>
                    <span class="unified-divider"></span>
                    <button id="openCustomSizeGuideBtn" type="button" class="unified-btn-part">
                        <i class="sicon-pencil-ruler"></i>
                        <span>دليل المقاسات</span>
                    </button>
                </div>
            `;

            optionsElem.parentNode.insertBefore(unifiedWrapper, optionsElem.nextSibling);

            hideOriginalSizeGuide();
            bindEvents();
        } else if (!unifiedWrapper) {
            // خيارات المقاسات لم تُحمّل بعد: إعادة المحاولة (بحد أقصى 50 مرة = 10 ثوانٍ)
            if (retryCount < 50) {
                setTimeout(() => rearrangeLayoutAndInjectButton(retryCount + 1), 200);
            }
            return;
        }

        // الخطوة 2: وسائل الدفع تحت الزر الموحد ثم الوصف (فقط إذا كانت في نفس نموذج المنتج)
        const paymentsInsideForm = paymentsElem && paymentsElem.closest('form') === optionsElem.closest('form') ? paymentsElem : null;
        let anchor = unifiedWrapper;

        if (paymentsInsideForm) {
            if (anchor.nextElementSibling !== paymentsInsideForm) {
                anchor.parentNode.insertBefore(paymentsInsideForm, anchor.nextSibling);
            }
            anchor = paymentsInsideForm;
        } else if (!paymentsElem && retryCount < 20) {
            // وسائل الدفع قد تتأخر في التحميل
            setTimeout(() => rearrangeLayoutAndInjectButton(retryCount + 1), 200);
        }

        if (descInsideForm && anchor.nextElementSibling !== descInsideForm) {
            anchor.parentNode.insertBefore(descInsideForm, anchor.nextSibling);
        }
    }

    // ==========================================================================
    // القسم الثاني: وحدة غرفة القياس الذكية (Smart Fitting Room Module)
    // ==========================================================================

    // صور أشكال الخصر (WebP خفيفة) على رابط خارجي: لا تُحمَّل إلا عند فتح غرفة القياس
    const WAIST_IMAGES_BASE = 'https://cdn.jsdelivr.net/gh/Shdaam/shdaam-media@main/fitting/';
    const WAIST_IMAGES = {
        small: WAIST_IMAGES_BASE + 'waist-small.webp',
        medium: WAIST_IMAGES_BASE + 'waist-medium.webp',
        large: WAIST_IMAGES_BASE + 'waist-large.webp'
    };

    // حقن نافذة غرفة القياس (3 خطوات) ونافذة صورة دليل المقاسات
    function injectFittingRoomModals() {
        if (document.getElementById('fittingModalOverlay')) return;

        const modalHTML = `
        <div id="fittingModalOverlay" class="fitting-modal-overlay">
            <div class="fitting-modal-container">
                <div class="modal-top-bar">
                    <span class="modal-main-title">غرفة القياس الذكية</span>
                    <button id="closeFittingModal" type="button" class="close-modal-btn">&times;</button>
                </div>
                <div class="progress-bar-track">
                    <div id="modalProgressBar" class="progress-bar-fill"></div>
                </div>
                <div class="modal-body-content">
                    <!-- الخطوة 1: الطول والوزن -->
                    <div id="fittingStep1" class="fitting-step active">
                        <h2 class="step-title">اعرفي مقاسك المناسب</h2>
                        <p class="step-subtitle">ادخلي طولك ووزنك لحساب مقاسك المثالي</p>
                        <div class="inputs-inline-row">
                            <div class="form-group">
                                <label class="input-label">الطول (سم)</label>
                                <input type="number" id="fitHeight" inputmode="numeric" pattern="[0-9]*" placeholder="160" class="custom-input">
                            </div>
                            <div class="form-group">
                                <label class="input-label">الوزن (كجم)</label>
                                <input type="number" id="fitWeight" inputmode="numeric" pattern="[0-9]*" placeholder="70" class="custom-input">
                            </div>
                        </div>
                        <div id="inputErrorMsg" class="input-error-msg"></div>
                        <div class="actions-row">
                            <button type="button" class="btn-primary btnStep1Next">التالي</button>
                        </div>
                        <p class="bottom-note">نحدد مقاسك بناءً على قياسات الخصر لنرشّح لك الأفضل بدقة</p>
                    </div>

                    <!-- الخطوة 2: شكل الخصر -->
                    <div id="fittingStep2" class="fitting-step">
                        <h2 class="step-title">أي شكل أقرب لخصرك؟</h2>
                        <p class="step-subtitle">يساعدنا نحدد مقاس الخصر بدقة</p>
                        <div class="waist-grid">
                            <div class="waist-option" data-waist="small">
                                <img data-src="${WAIST_IMAGES.small}" alt="خصر عادي">
                                <span>خصر عادي</span>
                            </div>
                            <div class="waist-option active-waist" data-waist="medium">
                                <img data-src="${WAIST_IMAGES.medium}" alt="خصر وسط">
                                <span>خصر وسط</span>
                            </div>
                            <div class="waist-option" data-waist="large">
                                <img data-src="${WAIST_IMAGES.large}" alt="خصر كبير">
                                <span>خصر كبير</span>
                            </div>
                        </div>
                        <div class="actions-row">
                            <button type="button" class="btn-secondary btnStep2Back">الرجوع</button>
                            <button type="button" class="btn-primary btnStep2Next">عرض النتيجة</button>
                        </div>
                    </div>

                    <!-- الخطوة 3: النتيجة والتوصية -->
                    <div id="fittingStep3" class="fitting-step">
                        <h2 class="step-title">مقاسك المناسب</h2>
                        <p class="step-subtitle">توصية مبنية على بياناتك وتجارب عميلاتنا</p>
                        <div id="finalRecommendedSize" class="size-result-badge">M</div>

                        <p class="size-disclaimer-text">
                            ملاحظة: هذا مقاس تقريبي ويجب التأكد من مقاسك الصحيح
                        </p>

                        <div class="actions-row">
                            <button type="button" class="btn-secondary btnStep3Back">الرجوع</button>
                            <button type="button" id="btnCloseAndShop" class="btn-primary" style="display: inline-flex; align-items: center; justify-content: center; gap: 8px; flex-direction: row-reverse;">
                                <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                                    <circle cx="9" cy="21" r="1"></circle>
                                    <circle cx="20" cy="21" r="1"></circle>
                                    <path d="M1 1h4l2.68 13.39a2 2 0 0 0 2 1.61h9.72a2 2 0 0 0 2-1.61L23 6H6"></path>
                                </svg>
                                <span>أضف إلى السلة</span>
                            </button>
                        </div>

                        <div>
                            <p class="match-percentage"><span class="check-icon">✓</span> تطابق يصل إلى 98% بالاعتماد على بياناتك وتجارب العملاء</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>

        <!-- نافذة صورة دليل المقاسات -->
        <div id="sizeGuideImageModal" class="fitting-modal-overlay" style="z-index: 99999;">
            <div class="fitting-modal-container" style="max-width: 650px; padding: 15px; position: relative;">
                <div class="modal-top-bar" style="margin-bottom: 10px;">
                    <span class="modal-main-title">دليل المقاسات</span>
                    <button id="closeSizeGuideImgModal" type="button" class="close-modal-btn">&times;</button>
                </div>
                <div style="text-align: center; overflow: auto; max-height: 80vh; position: relative;">
                    <img id="customSizeGuideImg" src="" alt="دليل المقاسات" style="max-width: 100%; height: auto; transition: transform 0.25s ease; cursor: zoom-in;">
                </div>
            </div>
        </div>`;

        document.body.insertAdjacentHTML('beforeend', modalHTML);
    }

    // تحويل الأرقام العربية والفارسية إلى أرقام إنجليزية
    function convertToEnglishDigits(str) {
        if (str === null || str === undefined) return '';
        return String(str)
            .replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d))
            .replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d))
            .replace(/٫/g, '.');
    }

    // --------------------------------------------------------------------------
    // حساب المقاس الذكي حسب المنتج
    // 1) المنتج "1267635373": حسب الوزن المعدّل بالطول
    //    <=62 S، 63-75 M، 76-88 L، 89-102 XL، أكثر XXL
    // 2) باقي المنتجات: خصر تقديري = 63 + (1.2 × مؤشر كتلة الجسم) ويطابق جدول المقاسات:
    //    أقل من 81.5 XS، حتى 88 S، حتى 94 M، حتى 101 L، حتى 106.5 XL، أكثر XXL
    // شكل الخصر: وسط = يرفع المقاس إذا كان قريباً من حدّه الأعلى، كبير = يرفع المقاس درجة
    // --------------------------------------------------------------------------
    function calculateSmartSize(height, weight, selectedWaist, productId) {
        const activeProductId = String(productId || currentProductId || getMatchedProductId() || '');
        const waistStr = (selectedWaist || '').toString().toLowerCase().trim();
        const isMedium = waistStr === 'medium' || waistStr === 'وسط';
        const isLarge = waistStr === 'large' || waistStr === 'full' || waistStr === 'كبير' || waistStr === 'ممتلئ';

        function bumpUp(size, ladder) {
            const i = ladder.indexOf(size);
            return (i !== -1 && i < ladder.length - 1) ? ladder[i + 1] : size;
        }

        // الخوارزمية الأولى: خاصة بالمنتج "1267635373"
        if (activeProductId === '1267635373') {
            const clampedHeight = Math.min(Math.max(height, 150), 180);
            let adjustedWeight = weight - ((clampedHeight - 165) * 0.5);
            if (isMedium) adjustedWeight += 2;

            let currentSize, maxLimit;
            if (adjustedWeight <= 62) { currentSize = 'S'; maxLimit = 62; }
            else if (adjustedWeight <= 75) { currentSize = 'M'; maxLimit = 75; }
            else if (adjustedWeight <= 88) { currentSize = 'L'; maxLimit = 88; }
            else if (adjustedWeight <= 102) { currentSize = 'XL'; maxLimit = 102; }
            else { currentSize = 'XXL'; maxLimit = Infinity; }

            const sizeLadder = ['S', 'M', 'L', 'XL', 'XXL', '3XL'];
            if (isMedium && (maxLimit - adjustedWeight) <= 2) currentSize = bumpUp(currentSize, sizeLadder);
            else if (isLarge) currentSize = bumpUp(currentSize, sizeLadder);

            return currentSize;
        }

        // الخوارزمية الثانية: باقي المنتجات
        const safeHeight = height > 0 ? height : 160;
        const heightInMeters = safeHeight / 100;
        const bmi = weight / (heightInMeters * heightInMeters);
        const waistScore = 63 + (1.2 * bmi);

        let currentSize, maxLimit;
        if (waistScore < 81.5) { currentSize = 'XS'; maxLimit = 81.5; }
        else if (waistScore <= 88) { currentSize = 'S'; maxLimit = 88; }
        else if (waistScore <= 94) { currentSize = 'M'; maxLimit = 94; }
        else if (waistScore <= 101) { currentSize = 'L'; maxLimit = 101; }
        else if (waistScore <= 106.5) { currentSize = 'XL'; maxLimit = 106.5; }
        else { currentSize = 'XXL'; maxLimit = Infinity; }

        const sizeLadder = ['XS', 'S', 'M', 'L', 'XL', 'XXL', '3XL'];
        if (isMedium && (maxLimit - waistScore) <= 2) currentSize = bumpUp(currentSize, sizeLadder);
        else if (isLarge) currentSize = bumpUp(currentSize, sizeLadder);

        return currentSize;
    }

    // حساب المقاس وعرضه في شارة النتيجة
    function calculateAndShowResult(selectedWaist, productId) {
        const rawH = document.getElementById('fitHeight')?.value;
        const rawW = document.getElementById('fitWeight')?.value;
        const height = parseFloat(convertToEnglishDigits(rawH)) || 160;
        const weight = parseFloat(convertToEnglishDigits(rawW)) || 70;

        const finalSize = calculateSmartSize(height, weight, selectedWaist, productId || currentProductId);

        const finalBadge = document.getElementById('finalRecommendedSize');
        if (finalBadge) finalBadge.innerText = finalSize;
    }

    // ربط الأحداث: فتح وإغلاق النوافذ، التنقل بين الخطوات، التحقق، والإضافة للسلة
    function bindEvents() {
        const modal = document.getElementById('fittingModalOverlay');
        const imgModal = document.getElementById('sizeGuideImageModal');
        const openBtn = document.getElementById('openFittingRoomBtn');
        const openSizeGuideBtn = document.getElementById('openCustomSizeGuideBtn');
        const closeBtn = document.getElementById('closeFittingModal');
        const closeImgBtn = document.getElementById('closeSizeGuideImgModal');
        const guideImgTag = document.getElementById('customSizeGuideImg');
        const progressBar = document.getElementById('modalProgressBar');
        const errorMsg = document.getElementById('inputErrorMsg');

        let selectedWaist = 'medium';

        // فتح نافذة دليل المقاسات
        if (openSizeGuideBtn) {
            openSizeGuideBtn.onclick = function (e) {
                e.preventDefault();
                e.stopPropagation();

                const imgSrc = getSallaSizeGuideImageSrc();
                guideImgTag.src = imgSrc || 'https://cdn.salla.sa/NKVlKv/products/SbEw8OofwfRoFuH0ZWtIhUOmTjZBmINtbIC2jdAZ.jpg';

                imgModal.style.display = 'flex';
                document.body.classList.add('fitting-modal-open');
            };
        }

        // تكبير وتصغير صورة دليل المقاسات بالنقر
        let isZoomed = false;
        if (guideImgTag) {
            guideImgTag.onclick = function () {
                isZoomed = !isZoomed;
                this.style.transform = isZoomed ? 'scale(1.8)' : 'scale(1)';
                this.style.cursor = isZoomed ? 'zoom-out' : 'zoom-in';
            };
        }

        function closeImgModal() {
            imgModal.style.display = 'none';
            document.body.classList.remove('fitting-modal-open');
            if (guideImgTag) {
                guideImgTag.style.transform = 'scale(1)';
                isZoomed = false;
            }
        }

        if (closeImgBtn) closeImgBtn.onclick = closeImgModal;

        function closeModal() {
            modal.style.display = 'none';
            document.body.classList.remove('fitting-modal-open');
        }

        if (openBtn) {
            openBtn.onclick = function (e) {
                e.preventDefault();
                modal.querySelectorAll('img[data-src]').forEach(img => {
                    img.src = img.getAttribute('data-src');
                    img.removeAttribute('data-src');
                });
                modal.style.display = 'flex';
                document.body.classList.add('fitting-modal-open');
                goToStep(1);
            };
        }

        if (closeBtn) closeBtn.onclick = closeModal;

        // إغلاق النوافذ عند النقر على الخلفية المعتمة
        window.addEventListener('click', function (event) {
            if (event.target === modal) closeModal();
            if (event.target === imgModal) closeImgModal();
        });

        function goToStep(stepNumber) {
            document.querySelectorAll('.fitting-step').forEach(el => el.classList.remove('active'));
            document.getElementById('fittingStep' + stepNumber).classList.add('active');
            const progressWidths = { 1: '33.33%', 2: '66.66%', 3: '100%' };
            progressBar.style.width = progressWidths[stepNumber];
        }

        // تحويل الأرقام العربية مباشرة أثناء الكتابة
        ['fitHeight', 'fitWeight'].forEach(id => {
            const inp = document.getElementById(id);
            if (inp) {
                inp.addEventListener('input', function () {
                    const converted = convertToEnglishDigits(this.value);
                    if (converted !== this.value) this.value = converted;
                });
            }
        });

        // الخطوة 1 -> 2: التحقق من الطول والوزن
        const step1Next = document.querySelector('.btnStep1Next');
        if (step1Next) {
            step1Next.onclick = function (e) {
                if (e) e.preventDefault();
                const h = parseFloat(convertToEnglishDigits(document.getElementById('fitHeight')?.value));
                const w = parseFloat(convertToEnglishDigits(document.getElementById('fitWeight')?.value));

                if (!h || !w || isNaN(h) || isNaN(w)) {
                    errorMsg.innerText = 'يرجى إدخال الطول والوزن للمتابعة';
                    errorMsg.style.display = 'block';
                    return;
                }

                if (h < 120 || h > 230) {
                    errorMsg.innerText = 'عذراً، أدخلي طولاً بين 120 و 230 سم';
                    errorMsg.style.display = 'block';
                    return;
                }

                if (w < 30 || w > 200) {
                    errorMsg.innerText = 'عذراً، أدخلي وزناً بين 30 و 200 كجم';
                    errorMsg.style.display = 'block';
                    return;
                }

                errorMsg.style.display = 'none';
                goToStep(2);
            };
        }

        // الخطوة 2: اختيار شكل الخصر
        document.querySelectorAll('.waist-option').forEach(item => {
            item.onclick = function () {
                document.querySelectorAll('.waist-option').forEach(i => i.classList.remove('active-waist'));
                this.classList.add('active-waist');
                selectedWaist = this.getAttribute('data-waist');
            };
        });

        const step2Back = document.querySelector('.btnStep2Back');
        if (step2Back) step2Back.onclick = () => goToStep(1);

        const step2Next = document.querySelector('.btnStep2Next');
        if (step2Next) {
            step2Next.onclick = function (e) {
                if (e) e.preventDefault();
                calculateAndShowResult(selectedWaist, currentProductId);
                goToStep(3);
            };
        }

        const step3Back = document.querySelector('.btnStep3Back');
        if (step3Back) step3Back.onclick = () => goToStep(2);

        // الخطوة 3: إضافة المنتج للسلة بالمقاس المقترح ثم إغلاق النافذة
        const closeAndShop = document.getElementById('btnCloseAndShop');
        if (closeAndShop) {
            closeAndShop.onclick = async function () {
                const recommendedSize = document.getElementById('finalRecommendedSize').innerText.trim();
                closeAndShop.classList.add('is-loading');

                const result = await addRecommendedToCart(recommendedSize);
                closeAndShop.classList.remove('is-loading');

                if (result.ok) {
                    // نجاح: نغلق النافذة ويظهر إشعار سلة المعتاد في المتجر
                    closeModal();
                    return;
                }

                // تعذّرت الإضافة: نغلق النافذة ونوجّه العميلة لخيارات المقاس لتكمل بنفسها
                closeModal();
                setTimeout(() => {
                    const optionsElem = document.querySelector('salla-product-options');
                    if (optionsElem) optionsElem.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }, 100);
            };
        }
    }

    injectFittingRoomModals();
    rearrangeLayoutAndInjectButton();
});


// ==========================================================================
// القسم الثالث: إظهار تقييمات العملاء تلقائياً في صفحة المنتج
// (في بعض تنسيقات الثيم تكون التقييمات مخفية داخل تبويب أو قائمة قابلة للطي)
// ==========================================================================
(function () {
    function showReviews() {
        if (!document.body.classList.contains('product-single')) return true;

        let done = false;

        // 1) قسم التقييمات بمعرّف reviews داخل التبويبات
        const reviews = document.getElementById('reviews');
        if (reviews) {
            reviews.classList.add('is-active');
            reviews.style.display = 'block';
            done = true;
        }

        // 2) قوائم قابلة للطي من نوع details/summary
        document.querySelectorAll('details').forEach(d => {
            const summary = d.querySelector('summary');
            if (summary && summary.textContent.includes('التقييم') && !d.open) {
                d.open = true;
                done = true;
            }
        });

        // 3) أزرار قابلة للطي مكتوب عليها "التقييمات" وما زالت مغلقة
        document.querySelectorAll('[aria-expanded="false"]').forEach(btn => {
            if (btn.textContent.trim().includes('التقييم')) {
                btn.click();
                done = true;
            }
        });

        return done;
    }

    function run(attempt) {
        if (showReviews() || attempt >= 20) return;
        setTimeout(() => run(attempt + 1), 300);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => run(0));
    } else {
        run(0);
    }
})();
