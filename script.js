/**
 * 1. КОНФИГУРАЦИЯ И КОНСТАНТЫ
 */
const CONSTANTS = {
    KEYS: {
        tariffs: [
            "1С-ЭПД 600 документов", "1С-ЭПД 1 000 документов", 
            "1С-ЭПД 5 000 документов", "1С-ЭПД \n10 000 документов", 
            "1С-ЭПД \n50 000 документов\n", "1С-ЭПД \n100 000 документов\n"
        ],
        project: "1С-ЭПД Проектное решение",
        ukep12: "УКЭП Базис 12 месяцев", 
        ukep15: "УКЭП Базис 15 месяцев",
        kcr: "КЦР ", 
        kepEgais: "КЭП ЕГАИС",
        kepUniv: "КЭП Универсальный",
        kepBasis: "КЭП Базис",
        mchd: {
            base: "МЧД Базовый на 1 год(5 мчд)",
            ext: "МЧД Расширенный на 1 год",
            single: "Одна МЧД",
            extra: "Дополнительные МЧД "
        },
        services: {
            setup_win_1: "OC Windows\nnalog.ru или ЕСИА",
            setup_win_2: "OC Windows\nnalog.ru и ЕСИА",
            setup_mac_1: "OC MacOS nalog.ru или ЕСИА",
            setup_mac_2: "OC MacOS nalog.ru и ЕСИА",
            install_base: "Типовая Установка пр",
            training: "Обучение пользователей по работе с Пр",
            goslog_win: "Регистрация на платформе «ГосЛог»\nOC Windows",
            goslog_mac: "Регистрация на платформе «ГосЛог»\nOC MacOS",
            project_survey: "Проектное обследование"
        }
    },
    LIMITS: [600, 1000, 5000, 10000, 50000, 100000],
    ADDONS: [
        {
            id: 'setup', title: 'Удалённая настройка рабочего места',
            items: [
                { id: 'sw1', label: 'Windows (nalog.ru <b>или</b> ЕСИА)', keyRef: 'setup_win_1' },
                { id: 'sw2', label: 'Windows (nalog.ru <b>и</b> ЕСИА)', keyRef: 'setup_win_2' },
                { id: 'sm1', label: 'MacOS (nalog.ru <b>или</b> ЕСИА)', keyRef: 'setup_mac_1' },
                { id: 'sm2', label: 'MacOS (nalog.ru <b>и</b> ЕСИА)', keyRef: 'setup_mac_2' }
            ]
        },
        {
            id: 'goslog', title: 'Регистрация на платформе «ГосЛог»',
            items: [
                { id: 'gw1', label: 'Регистрация на платформе «ГосЛог» для OC Windows', keyRef: 'goslog_win' },
                { id: 'gm1', label: 'Регистрация на платформе «ГосЛог» для OC MacOS', keyRef: 'goslog_mac' }
            ]
        },
        {
            id: 'service', title: 'Внедрение и обучение',
            items: [
                { id: 'i1', label: 'Типовая установка', keyRef: 'install_base' },
                { id: 't1', label: 'Обучение (1 группа)', keyRef: 'training' },
                { id: 'ps1', label: 'Проектное обследование (1 час)', keyRef: 'project_survey' }
            ]
        }
    ],
    MCHD_TYPES: ['base', 'ext', 'single', 'extra']
};

/**
 * 2. СОСТОЯНИЕ (STATE)
 */
const State = {
    data: {
        mainMode: 'typical',
        subMode: 'standard',
        docsYearly: 0,
        customDocsCount: null,
        pricing: [],
        customPrices: {},
        ukepQty: 0,
        ukepPeriod: 12,
        sigType: null,
        kcrDetails: { egais: 0, univ: 0, basis: 0 },
        mchd: {
            base: { active: false, qty: 0 },
            ext: { active: false, qty: 0 },
            single: { active: false, qty: 0 },
            extra: { active: false, qty: 0 }
        },
        addons: {},
    },

    initAddons() {
        CONSTANTS.ADDONS.forEach(addon => {
            this.data.addons[addon.id] = { enabled: false, values: {} };
        });
    },

    getPrice(key) {
        if (!this.data.pricing.length || !key) return 0;
        return Helpers.parseNum(this.data.pricing[0][key]);
    },
    
    getUnitPrice(key) {
        if (!this.data.pricing.length || !key) return 0;
        return Helpers.parseNum(this.data.pricing[1][key]);
    }
};

/**
 * 3. ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
 */
const Helpers = {
    parseNum: (val) => {
        if (val === undefined || val === null) return 0;
        let cleaned = val.toString().replace(/\u00A0/g, '').replace(/\s/g, '').replace(',', '.');
        return parseFloat(cleaned) || 0;
    },
    fmt: (num) => Math.round(num).toLocaleString('ru-RU'),
    fmtDecimal: (num) => {
        // Форматирует число с двумя знаками после запятой если есть дробная часть
        if (num % 1 === 0) return Math.round(num).toLocaleString('ru-RU');
        return num.toFixed(2).replace('.', ',').replace(/\B(?=(\d{3})+(?!\d))/g, '\u00A0');
    }
};

/**
 * 4. ЛОГИКА РАСЧЕТА (CALCULATOR)
 */
const Calculator = {
    getOptimalTariff(targetDocs) {
        if (targetDocs <= 0) {
            return { cost: 0, packages: [], totalDocs: 0, displayKey: '' };
        }

        const tariffKeys = CONSTANTS.KEYS.tariffs;
        const pkgs = tariffKeys.map((key, i) => ({
            key: key,
            displayName: key.replace(/\n/g, ' ').replace(/ +/g, ' ').trim(),
            docs: CONSTANTS.LIMITS[i],
            price: State.getPrice(key)
        }));

        const MAX = Math.max(targetDocs + 100000, 200000);
        let dp = new Array(MAX + 1).fill(Infinity);
        dp[0] = 0;
        let prev = new Array(MAX + 1).fill(null);

        for (let p = 0; p < pkgs.length; p++) {
            const pkg = pkgs[p];
            for (let j = pkg.docs; j <= MAX; j++) {
                if (dp[j - pkg.docs] !== Infinity) {
                    const newCost = dp[j - pkg.docs] + pkg.price;
                    if (newCost < dp[j]) {
                        dp[j] = newCost;
                        prev[j] = { pkgIdx: p, prevDocs: j - pkg.docs };
                    }
                }
            }
        }

        let minCost = Infinity;
        let bestJ = targetDocs;
        for (let j = targetDocs; j <= MAX; j++) {
            if (dp[j] < minCost) {
                minCost = dp[j];
                bestJ = j;
            }
        }

        let used = new Array(pkgs.length).fill(0);
        let curr = bestJ;
        while (curr > 0 && prev[curr]) {
            const pr = prev[curr];
            used[pr.pkgIdx]++;
            curr = pr.prevDocs;
        }

        let packages = [];
        let totalD = 0;
        for (let i = 0; i < pkgs.length; i++) {
            if (used[i] > 0) {
                const pkg = pkgs[i];
                const subPrice = pkg.price * used[i];
                packages.push({
                    name: pkg.displayName,
                    qty: used[i],
                    unitPrice: pkg.price,
                    price: subPrice
                });
                totalD += pkg.docs * used[i];
            }
        }

        const displayKey = (packages.length === 1 && packages[0].qty === 1)
            ? packages[0].name
            : `Комбинация пакетов (${Helpers.fmt(totalD)} док.)`;

        return {
            cost: minCost,
            packages: packages,
            totalDocs: totalD,
            displayKey: displayKey
        };
    },

    calculateAll() {
        if (!State.data.pricing.length) return { total: 0, lines: [] };

        let total = 0;
        let lines = [];

        const tariffRes = this.calcTariff();
        total += tariffRes.cost;
        // Для стандартного режима добавляем все строки пакетов
        if (tariffRes.lines && tariffRes.lines.length) {
            lines.push(...tariffRes.lines);
        } else if (tariffRes.line) {
            lines.push(tariffRes.line);
        }
        
        if (State.data.mainMode === 'project' && State.data.docsYearly > 0) {
            const pPrice = State.data.customPrices['project'] !== undefined 
                ? State.data.customPrices['project'] 
                : State.getPrice(CONSTANTS.KEYS.project);
            total += pPrice;
            lines.push(`Проектное решение: ${Helpers.fmt(pPrice)} ₽`);
        }

        const sigRes = this.calcSignatures();
        total += sigRes.cost;
        lines.push(...sigRes.lines);

        const mchdRes = this.calcMCHD();
        total += mchdRes.cost;
        lines.push(...mchdRes.lines);

        const addonRes = this.calcAddons();
        total += addonRes.cost;
        lines.push(...addonRes.lines);

        return { total, lines, tariffMeta: tariffRes.meta, tariffPackages: (tariffRes.meta && tariffRes.meta.packages) ? tariffRes.meta.packages : null };
    },

    calcTariff() {
        if (State.data.docsYearly <= 0) return { cost: 0, line: null, lines: [], meta: null };

        if (State.data.subMode === 'individual') {
            const limits = CONSTANTS.LIMITS;
            let idx = limits.findIndex(l => l >= State.data.docsYearly);
            const finalIdx = idx === -1 ? limits.length - 1 : idx;
            
            const key = CONSTANTS.KEYS.tariffs[finalIdx];
            const limitVal = limits[finalIdx];
            
            const stdUnit = State.getUnitPrice(key);
            const customUnit = State.data.customPrices['unit'];
            const currentUnit = customUnit !== undefined ? customUnit : stdUnit;

            const effectiveDocs = State.data.customDocsCount !== null ? State.data.customDocsCount : limitVal;
            const cost = effectiveDocs * currentUnit;

            const displayDocs = State.data.customDocsCount !== null ? State.data.customDocsCount : limitVal;
            const displayKey = State.data.customDocsCount !== null
                ? `1С-ЭПД ${Helpers.fmt(displayDocs)} документов`
                : key.replace(/\n/g, ' ');

            const line = `Тариф: ${displayKey} | ${Helpers.fmt(cost)} ₽`;

            return { 
                cost, line, lines: [line],
                meta: { key, limitVal, basePrice: cost, unitPrice: currentUnit, effectiveDocs, displayKey } 
            };
        } else {
            // Стандартный режим — оптимальная комбинация
            const opt = this.getOptimalTariff(State.data.docsYearly);
            const cost = opt.cost;

            // Цена за документ с точностью до xx.xx
            let pricePerDoc = 0;
            if (opt.totalDocs > 0) {
                pricePerDoc = Math.round((cost / opt.totalDocs) * 100) / 100;
            }

            // Строки детализации — каждый пакет отдельно
            const lines = opt.packages.map(pkg =>
                `Тариф: ${pkg.name} × ${pkg.qty} = ${Helpers.fmt(pkg.price)} ₽`
            );

            return { 
                cost, 
                line: lines[0] || `Тариф: ${opt.displayKey} | ${Helpers.fmt(cost)} ₽`,
                lines,
                meta: { 
                    basePrice: cost, 
                    totalDocs: opt.totalDocs,
                    packages: opt.packages,
                    pricePerDoc: pricePerDoc,
                    displayKey: opt.displayKey,
                } 
            };
        }
    },

    calcSignatures() {
        const d = State.data;
        let cost = 0;
        let lines = [];

        if (d.ukepQty > 0 && d.sigType) {
            if (d.sigType === 'basis') {
                const key = d.ukepPeriod === 15 ? CONSTANTS.KEYS.ukep15 : CONSTANTS.KEYS.ukep12;
                const customPrice = State.data.customPrices[key];
                const price = (State.data.subMode === 'individual' && customPrice !== undefined) 
                    ? customPrice 
                    : State.getPrice(key);
                const sum = d.ukepQty * price;
                cost += sum;
                lines.push(`УКЭП Базис (${d.ukepPeriod} мес.) x ${d.ukepQty}: ${Helpers.fmt(sum)} ₽`);
            } else if (d.sigType === 'kcr') {
                const customKcrPrice = State.data.customPrices[CONSTANTS.KEYS.kcr];
                const kcrBase = (State.data.subMode === 'individual' && customKcrPrice !== undefined)
                    ? customKcrPrice
                    : State.getPrice(CONSTANTS.KEYS.kcr);
                cost += kcrBase;
                lines.push(`КЦР: ${Helpers.fmt(kcrBase)} ₽`);

                const map = [
                    { qty: d.kcrDetails.egais, key: CONSTANTS.KEYS.kepEgais, name: 'КЭП ЕГАИС' },
                    { qty: d.kcrDetails.univ, key: CONSTANTS.KEYS.kepUniv, name: 'КЭП Универсальный' },
                    { qty: d.kcrDetails.basis, key: CONSTANTS.KEYS.kepBasis, name: 'КЭП Базис' }
                ];

                map.forEach(item => {
                    if (item.qty > 0) {
                        const customP = State.data.customPrices[item.key];
                        const price = (State.data.subMode === 'individual' && customP !== undefined)
                            ? customP
                            : State.getPrice(item.key);
                        const sum = item.qty * price;
                        cost += sum;
                        lines.push(`${item.name} x ${item.qty}: ${Helpers.fmt(sum)} ₽`);
                    }
                });
            }
        }
        return { cost, lines };
    },

    calcMCHD() {
        let cost = 0;
        let lines = [];
        
        CONSTANTS.MCHD_TYPES.forEach(type => {
            const item = State.data.mchd[type];
            if (item.active && item.qty > 0) {
                const key = CONSTANTS.KEYS.mchd[type];
                const customPrice = State.data.customPrices[key];
                const price = (State.data.subMode === 'individual' && customPrice !== undefined)
                    ? customPrice
                    : State.getPrice(key);
                const sum = item.qty * price;
                cost += sum;
                
                const name = (type === 'base') ? 'МЧД Базовый' : 
                             (type === 'ext') ? 'МЧД Расширенный' :
                             (type === 'single') ? 'Одна МЧД' : 'Доп. МЧД';
                             
                lines.push(`${name} x ${item.qty}: ${Helpers.fmt(sum)} ₽`);
            }
        });
        return { cost, lines };
    },

    calcAddons() {
        let cost = 0;
        let lines = [];

        CONSTANTS.ADDONS.forEach(addon => {
            const addonState = State.data.addons[addon.id];
            if (addonState.enabled) {
                addon.items.forEach(item => {
                    const qty = addonState.values[item.id] || 0;
                    if (qty > 0) {
                        const customP = State.data.customPrices[item.keyRef];
                        const baseP = State.getPrice(CONSTANTS.KEYS.services[item.keyRef]);
                        
                        const price = (State.data.subMode === 'individual' && customP !== undefined) 
                                      ? customP 
                                      : baseP;

                        const sum = price * qty;
                        cost += sum;
                        const labelText = item.label.replace(/<[^>]*>/g, '');
                        lines.push(`${labelText} x ${qty}: ${Helpers.fmt(sum)} ₽`);
                    }
                });
            }
        });
        return { cost, lines };
    }
};

/**
 * 5. ОТРИСОВКА (UI)
 */
const UI = {
    els: {},

    init() {
        this.renderAddonsHTML();
        this.cacheElements();
        this.bindEvents();
    },

    cacheElements() {
        const ids = ['dynamic-content', 'total-price', 'details-content', 'docs-month', 'docs-year', 
                     'card-basis', 'card-kcr', 'check-basis', 'check-kcr', 'ukep-qty'];
        ids.forEach(id => this.els[id] = document.getElementById(id));
    },

    renderAddonsHTML() {
        const container = document.getElementById('addons-container');
        if(!container) return;
        
        const isInd = State.data.subMode === 'individual';

        container.innerHTML = `<h3 class="section-title">Сервисные услуги</h3>` + CONSTANTS.ADDONS.map(addon => {
            const addonState = State.data.addons[addon.id];
            
            const customPriceBlock = isInd ? `
                <details class="card-price-details" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    <summary class="custom-price-summary">Изменить стоимость</summary>
                    <div class="custom-price-content">
                        ${addon.items.map(item => {
                            const savedPrice = State.data.customPrices[item.keyRef] || '';
                            const defaultPrice = State.getPrice(CONSTANTS.KEYS.services[item.keyRef]);
                            const labelText = item.label.replace(/<[^>]*>/g, '');
                            return `
                            <div class="custom-price-row">
                                <span>${labelText}</span>
                                <input type="number" min="0" value="${savedPrice}" placeholder="${defaultPrice}" 
                                    class="custom-price-input"
                                    onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();" 
                                    oninput="window.updateServicePrice('${item.keyRef}', this.value)">
                            </div>`;
                        }).join('')}
                    </div>
                </details>` : '';

            return `
                <div class="addon-card ${addonState.enabled ? 'active' : ''}" id="addon-card-${addon.id}">
                    <div class="addon-header">
                        <span class="addon-title">${addon.title}</span>
                        <label class="custom-switch">
                            <input type="checkbox" data-action="toggle-addon" data-id="${addon.id}" ${addonState.enabled ? 'checked' : ''}>
                            <span class="slider round"></span>
                        </label>
                    </div>
                    <div id="addon-items-${addon.id}" style="display:${addonState.enabled ? 'block' : 'none'}; margin-top:10px;">
                        ${addon.items.map(item => `
                            <div class="variant-row">
                                <span class="v-label">${item.label}</span>
                                <div class="v-controls">
                                    <input type="number" class="qty-input" min="0" 
                                        value="${addonState.values[item.id] || ''}"
                                        placeholder="0" 
                                        data-action="update-addon" data-addon="${addon.id}" data-item="${item.id}">
                                    <span class="unit-text">шт.</span>
                                </div>
                            </div>`).join('')}
                        ${customPriceBlock}
                    </div>
                </div>`;
        }).join('');
    },

    update() {
        const result = Calculator.calculateAll();
        
        this.els['total-price'].textContent = Helpers.fmt(result.total) + ' ₽';
        this.els['details-content'].innerHTML = result.lines.join('<br>');
        this.renderTariffCard(result.tariffMeta);
        this.updateSignaturesUI();
    },
        
    renderTariffCard(meta) {
        const container = this.els['dynamic-content'];
        if (!meta) {
            container.innerHTML = `<div class="placeholder-text">Введите количество документов</div>`;
            return;
        }

        const isInd = State.data.subMode === 'individual';
        const isProject = State.data.mainMode === 'project';

        let tariffHTML = '';

        if (isInd) {
            const displayUnit = meta.unitPrice.toString().replace('.', ',');
            const unitInputHtml = `<input type="text" class="tariff-field-input" value="${displayUnit}" data-action="custom-price" data-type="unit">`;
            const customDocsVal = State.data.customDocsCount !== null ? State.data.customDocsCount : meta.limitVal;
            const docsInputHtml = `<input type="number" class="tariff-field-input" min="1" value="${customDocsVal}" data-action="custom-price" data-type="docs-count">`;

            tariffHTML = `
                <div class="detail-row">
                    <span>Пакет (документов)</span>
                    <div class="price-edit-block">${docsInputHtml}<span class="unit-text">шт.</span></div>
                </div>
                <div class="detail-row">
                    <span>Стоимость пакета</span>
                    <div class="price-edit-block"><strong>${Helpers.fmt(meta.basePrice)}</strong><span class="unit-text">₽</span></div>
                </div>
                <div class="detail-row highlight">
                    <span>Цена за 1 документ</span>
                    <div class="price-edit-block">${unitInputHtml}<span class="unit-text">₽</span></div>
                </div>`;
        } else {
            // Стандартный режим — показываем каждый пакет отдельно
            let packagesRows = meta.packages.map(p => `
                <div class="detail-row">
                    <span>${p.qty > 1 ? p.qty + ' × ' : ''}${p.name}</span>
                    <div class="price-edit-block"><strong>${Helpers.fmt(p.price)}</strong><span class="unit-text">₽</span></div>
                </div>
            `).join('');

            // Цена за документ с xx.xx форматом
            let pricePerDocRow = '';
            if (meta.pricePerDoc > 0) {
                pricePerDocRow = `
                    <div class="detail-row highlight">
                        <span>Стоимость за 1 документ</span>
                        <div class="price-edit-block"><strong>${Helpers.fmtDecimal(meta.pricePerDoc)}</strong><span class="unit-text">₽</span></div>
                    </div>`;
            }

            tariffHTML = packagesRows + `
                <div class="detail-row highlight">
                    <span>Всего документов</span>
                    <div class="price-edit-block"><strong>${Helpers.fmt(meta.totalDocs)}</strong><span class="unit-text">шт.</span></div>
                </div>
                <div class="detail-row highlight">
                    <span>Стоимость тарифа</span>
                    <div class="price-edit-block"><strong>${Helpers.fmt(meta.basePrice)}</strong><span class="unit-text">₽</span></div>
                </div>
                ${pricePerDocRow}`;
        }

        let projectHtml = '';
        if (isProject) {
            const pPrice = State.data.customPrices['project'] !== undefined 
                ? State.data.customPrices['project'] 
                : State.getPrice(CONSTANTS.KEYS.project);
            const pInput = isInd
                ? `<input type="text" class="tariff-field-input" value="${pPrice.toString().replace('.', ',')}" data-action="custom-price" data-type="project">`
                : `<strong>${Helpers.fmt(pPrice)}</strong>`;

            projectHtml = `
                <div class="detail-row project-row">
                    <span>Проектное решение</span>
                    <div class="price-edit-block">${pInput}<span class="unit-text">₽</span></div>
                </div>`;
        }

        const labelText = isInd 
            ? 'Индивидуальные условия' 
            : (meta.packages.length > 1 || (meta.packages.length === 1 && meta.packages[0].qty > 1) 
                ? 'Оптимальная комбинация' 
                : 'Стандартный тариф');

        container.innerHTML = `
            <div class="tariff-card animated-fade ${isInd ? 'individual-mode' : ''}">
                <div class="tariff-header">
                    <span class="tariff-label">${labelText}</span>
                    <h3 class="tariff-title">${meta.displayKey}</h3>
                </div>
                <div class="detailing-section">
                    ${tariffHTML}
                    ${projectHtml}
                </div>
            </div>`;
    },

    updateSignaturesUI() {
        const d = State.data;
        const isLocked = d.ukepQty < 6;
        const isInd = State.data.subMode === 'individual';
        
        if (isLocked && d.sigType === 'kcr') {
            State.data.sigType = null;
        }

        this.els['card-kcr'].classList.toggle('locked', isLocked);
        this.els['card-basis'].classList.toggle('active', d.sigType === 'basis');
        this.els['card-kcr'].classList.toggle('active', d.sigType === 'kcr');
        
        const kcrOptionsContainer = document.getElementById('kcr-options-container');
        if (kcrOptionsContainer) {
            kcrOptionsContainer.style.display = (d.sigType === 'kcr') ? 'block' : 'none';
        }
        
        this.els['check-basis'].checked = (d.sigType === 'basis');
        this.els['check-kcr'].checked = (d.sigType === 'kcr');

        const btn12 = document.querySelector('[data-click="set-ukep-period"][data-val="12"]');
        const btn15 = document.querySelector('[data-click="set-ukep-period"][data-val="15"]');
        if (btn12 && btn15) {
            btn12.classList.toggle('selected', d.ukepPeriod === 12);
            btn15.classList.toggle('selected', d.ukepPeriod === 15);
        }

        this.updateBasisPricing(isInd);
        this.updateKCRPricing(isInd);
        this.updateMCHDPricing(isInd);
    },

    updateBasisPricing(isInd) {
        const container = document.getElementById('basis-pricing-container');
        if (!container) return;

        // Показываем только если индивидуальный режим И выбран тип подписи "basis"
        if (!isInd || State.data.sigType !== 'basis') {
            container.innerHTML = '';
            return;
        }

        const ukep12Price = State.data.customPrices[CONSTANTS.KEYS.ukep12] || '';
        const ukep15Price = State.data.customPrices[CONSTANTS.KEYS.ukep15] || '';

        container.innerHTML = `
            <details class="card-price-details" style="margin-top: 10px;">
                <summary class="custom-price-summary">Изменить стоимость</summary>
                <div class="custom-price-content">
                    <div class="custom-price-row">
                        <span>12 месяцев</span>
                        <input type="number" min="0" placeholder="${State.getPrice(CONSTANTS.KEYS.ukep12)}" 
                            value="${ukep12Price}" class="custom-price-input"
                            onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                            oninput="window.updateCustomPrice('${CONSTANTS.KEYS.ukep12}', this.value)">
                    </div>
                    <div class="custom-price-row">
                        <span>15 месяцев</span>
                        <input type="number" min="0" placeholder="${State.getPrice(CONSTANTS.KEYS.ukep15)}" 
                            value="${ukep15Price}" class="custom-price-input"
                            onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                            oninput="window.updateCustomPrice('${CONSTANTS.KEYS.ukep15}', this.value)">
                    </div>
                </div>
            </details>
        `;
    },

    updateKCRPricing(isInd) {
        const container = document.getElementById('kcr-pricing-container');
        if (!container) return;

        // Показываем только если индивидуальный режим И выбран тип подписи "kcr"
        if (!isInd || State.data.sigType !== 'kcr') {
            container.innerHTML = '';
            return;
        }

        const kcrPrice = State.data.customPrices[CONSTANTS.KEYS.kcr] || '';
        const kepEgaisPrice = State.data.customPrices[CONSTANTS.KEYS.kepEgais] || '';
        const kepUnivPrice = State.data.customPrices[CONSTANTS.KEYS.kepUniv] || '';
        const kepBasisPrice = State.data.customPrices[CONSTANTS.KEYS.kepBasis] || '';

        container.innerHTML = `
            <details class="card-price-details" style="margin-top: 10px;">
                <summary class="custom-price-summary">Изменить стоимость</summary>
                <div class="custom-price-content">
                    <div class="custom-price-row">
                        <span>КЦР (базовая)</span>
                        <input type="number" min="0" placeholder="${State.getPrice(CONSTANTS.KEYS.kcr)}" 
                            value="${kcrPrice}" class="custom-price-input"
                            onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                            oninput="window.updateCustomPrice('${CONSTANTS.KEYS.kcr}', this.value)">
                    </div>
                    <div class="custom-price-row">
                        <span>КЭП ЕГАИС</span>
                        <input type="number" min="0" placeholder="${State.getPrice(CONSTANTS.KEYS.kepEgais)}" 
                            value="${kepEgaisPrice}" class="custom-price-input"
                            onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                            oninput="window.updateCustomPrice('${CONSTANTS.KEYS.kepEgais}', this.value)">
                    </div>
                    <div class="custom-price-row">
                        <span>КЭП Универс.</span>
                        <input type="number" min="0" placeholder="${State.getPrice(CONSTANTS.KEYS.kepUniv)}" 
                            value="${kepUnivPrice}" class="custom-price-input"
                            onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                            oninput="window.updateCustomPrice('${CONSTANTS.KEYS.kepUniv}', this.value)">
                    </div>
                    <div class="custom-price-row">
                        <span>КЭП Базис</span>
                        <input type="number" min="0" placeholder="${State.getPrice(CONSTANTS.KEYS.kepBasis)}" 
                            value="${kepBasisPrice}" class="custom-price-input"
                            onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                            oninput="window.updateCustomPrice('${CONSTANTS.KEYS.kepBasis}', this.value)">
                    </div>
                </div>
            </details>
        `;
    },

    updateMCHDPricing(isInd) {
        const mchdTypes = [
            { id: 'base', key: CONSTANTS.KEYS.mchd.base, name: 'Базовый' },
            { id: 'ext', key: CONSTANTS.KEYS.mchd.ext, name: 'Расширенный' },
            { id: 'single', key: CONSTANTS.KEYS.mchd.single, name: 'Одна МЧД' },
            { id: 'extra', key: CONSTANTS.KEYS.mchd.extra, name: 'Доп. МЧД' }
        ];

        mchdTypes.forEach(type => {
            const container = document.getElementById(`mchd-${type.id}-pricing-container`);
            if (!container) return;

            // Показываем только если индивидуальный режим И карточка активирована
            if (!isInd || !State.data.mchd[type.id].active) {
                container.innerHTML = '';
                return;
            }

            const customPrice = State.data.customPrices[type.key] || '';

            container.innerHTML = `
                <details class="card-price-details" style="margin-top: 10px;">
                    <summary class="custom-price-summary">Изменить стоимость</summary>
                    <div class="custom-price-content">
                        <div class="custom-price-row">
                            <span>Стоимость</span>
                            <input type="number" min="0" placeholder="${State.getPrice(type.key)}" 
                                value="${customPrice}" class="custom-price-input"
                                onkeydown="if(['-', 'e', 'E', ',', '.'].includes(event.key)) event.preventDefault();"
                                oninput="window.updateCustomPrice('${type.key}', this.value)">
                        </div>
                    </div>
                </details>
            `;
        });
    },

    bindEvents() {
        document.body.addEventListener('input', (e) => this.handleInput(e));
        document.body.addEventListener('change', (e) => this.handleChange(e));
        document.body.addEventListener('click', (e) => this.handleClick(e));
    },

    handleInput(e) {
        const t = e.target;
        const act = t.dataset.action;
        const val = t.value;

        if (act === 'docs-month') {
            State.data.docsYearly = (parseInt(val)||0) * 12;
            State.data.customDocsCount = null;
            this.els['docs-year'].value = State.data.docsYearly;
            this.update();
        } 
        else if (act === 'docs-year') {
            State.data.docsYearly = parseInt(val)||0;
            State.data.customDocsCount = null;
            this.els['docs-month'].value = Math.round(State.data.docsYearly / 12);
            this.update();
        }
        else if (act === 'ukep-qty') {
            State.data.ukepQty = Math.max(0, parseInt(val)||0);
            this.update();
        }
        else if (act === 'kcr-qty') {
            const field = t.dataset.field;
            State.data.kcrDetails[field] = Math.max(0, parseInt(val)||0);
            this.update();
        }
        else if (act === 'mchd-qty') {
            const type = t.dataset.type;
            State.data.mchd[type].qty = Math.max(0, parseInt(val)||0);
            this.update();
        }
        else if (act === 'update-addon') {
            const { addon, item } = t.dataset;
            State.data.addons[addon].values[item] = Math.max(0, parseInt(val)||0);
            this.update();
        }
    },

    handleChange(e) {
        const t = e.target;
        const act = t.dataset.action;

        if (act === 'custom-price') {
            const type = t.dataset.type;
            if (type === 'docs-count') {
                const num = parseInt(t.value) || null;
                State.data.customDocsCount = num && num > 0 ? num : null;
                this.update();
            } else {
                const floatVal = parseFloat(t.value.replace(',', '.')) || 0;
                State.data.customPrices[type] = floatVal;
                this.update();
            }
        }
        else if (act === 'toggle-sig') {
            const type = t.dataset.val;
            const checked = t.checked;
            
            if (checked) {
                if (type === 'kcr' && State.data.ukepQty < 6) {
                    t.checked = false;
                    return;
                }
                State.data.sigType = type;
            } else {
                if (State.data.sigType === type) {
                    State.data.sigType = null;
                }
            }
            
            this.update();
        }
        else if (act === 'toggle-mchd') {
            const type = t.dataset.type;
            const checked = t.checked;
            State.data.mchd[type].active = checked;
            
            document.getElementById(`card-mchd-${type}`).classList.toggle('active', checked);
            if (checked && State.data.mchd[type].qty === 0) {
                State.data.mchd[type].qty = 1;
                document.getElementById(`input-mchd-${type}`).value = 1;
            }
            this.update();
        }
        else if (act === 'toggle-addon') {
            const id = t.dataset.id;
            State.data.addons[id].enabled = t.checked;
            document.getElementById(`addon-items-${id}`).style.display = t.checked ? 'block' : 'none';
            document.getElementById(`addon-card-${id}`).classList.toggle('active', t.checked);
            this.update();
        }
    },

    handleClick(e) {
        const t = e.target.closest('[data-click]');
        if (!t) return;
        
        const act = t.dataset.click;
        
        if (act === 'set-mode') {
            const group = t.closest('.toggle-group');
            group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selected'));
            t.classList.add('selected');
            
            State.data.mainMode = t.dataset.val;
            this.update();
        }
        else if (act === 'set-submode') {
            const group = t.closest('.toggle-group');
            group.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selected'));
            t.classList.add('selected');
            
            State.data.subMode = t.dataset.val;
            if (State.data.subMode === 'standard') {
                State.data.customPrices = {};
                State.data.customDocsCount = null;
            }
            
            this.renderAddonsHTML();
            this.update();
        }
        else if (act === 'set-ukep-period') {
            e.stopPropagation();
            State.data.ukepPeriod = parseInt(t.dataset.val);
            this.update();
        }
    }
};

/**
 * 6. ИНИЦИАЛИЗАЦИЯ
 */
document.addEventListener('DOMContentLoaded', async () => {
    State.initAddons();
    UI.init();
    
    const contactFields = ['partner-name', 'partner-phone', 'partner-email', 'client-name'];
    contactFields.forEach(fieldId => {
        const saved = localStorage.getItem(`epd-${fieldId}`);
        const element = document.getElementById(fieldId);
        if (saved && element) {
            element.value = saved;
        }
        if (element) {
            element.addEventListener('input', (e) => {
                localStorage.setItem(`epd-${fieldId}`, e.target.value);
            });
        }
    });

    try {
        const res = await fetch('Цены для калькулятора ЭПД.json');
        const text = await res.text();
        try {
            State.data.pricing = JSON.parse(text);
        } catch(e) {
            State.data.pricing = JSON.parse("[" + text.replace(/}\s*{/g, "},{") + "]");
        }
        UI.update(); 
    } catch (e) { 
        console.error("Ошибка загрузки цен", e); 
    }
});

// Глобальные функции
window.downloadKP = async () => {
    const result = Calculator.calculateAll();
    if (result.total === 0) {
        alert('Сначала сделайте расчет!');
        return;
    }

    const partnerName  = document.getElementById('partner-name')?.value.trim()  || '';
    const clientName   = document.getElementById('client-name')?.value.trim()   || 'Клиент';
    const partnerPhone = document.getElementById('partner-phone')?.value.trim() || '';
    const partnerEmail = document.getElementById('partner-email')?.value.trim() || '';

    const isTypical = State.data.mainMode === 'typical';
    const prefix    = isTypical ? 'pdf-base' : 'pdf-project';

    async function toBase64(url) {
        try {
            const res = await fetch(url);
            if (!res.ok) return '';
            const blob = await res.blob();
            return new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload  = () => resolve(reader.result);
                reader.onerror = reject;
                reader.readAsDataURL(blob);
            });
        } catch (e) { return ''; }
    }

    const [b64Header, b64Middle, b64Low] = await Promise.all([
        toBase64(`${prefix}-header.jpg`),
        toBase64(`${prefix}-middle.jpg`),
        toBase64(`${prefix}-low.jpg`),
    ]);

    const lines = result.lines
        .map(l => l.replace(/<[^>]*>?/gm, '').trim())
        .filter(Boolean);

    // Парсинг строк тарифных пакетов: "Тариф: 1С-ЭПД 600 документов × 2 = 7 200 ₽"
    // Использует tariffPackages из результата расчёта для получения unitPrice из JSON
    function parseTariffPackageLine(line, packages) {
        const m = line.match(/^Тариф:\s*(.+?)\s*=\s*([\d\s]+)\s*₽\s*$/);
        if (m) {
            const nameAndQty = m[1].trim();
            const totalPriceStr = m[2].trim() + ' ₽';
            const crossIdx = nameAndQty.lastIndexOf('×');
            if (crossIdx !== -1) {
                const pkgName = nameAndQty.slice(0, crossIdx).trim();
                const qty = nameAndQty.slice(crossIdx + 1).trim();
                // Ищем unitPrice из packages (из JSON)
                let unitPriceFmt = '';
                if (packages) {
                    const found = packages.find(p => p.name === pkgName);
                    if (found && found.unitPrice) {
                        unitPriceFmt = Helpers.fmt(found.unitPrice) + ' ₽';
                    }
                }
                return {
                    title: `${pkgName}${unitPriceFmt ? ' (' + unitPriceFmt + ')' : ''} × ${qty}`,
                    price: totalPriceStr
                };
            }
            return { title: nameAndQty, price: totalPriceStr };
        }
        return null;
    }

    const PRICE_RE = /(\d[\d\s]*[\d])\s*[РрPp₽руб\.]+\s*$/i;

    function parseLine(line) {
        // Сначала проверяем формат тарифного пакета
        const tariffParsed = parseTariffPackageLine(line, result.tariffPackages);
        if (tariffParsed) return tariffParsed;

        if (line.includes('|')) {
            const parts = line.split('|');
            return {
                title: parts.slice(0, -1).join('|').trim(),
                price: parts[parts.length - 1].trim()
            };
        }
        const colonIdx = line.lastIndexOf(':');
        if (colonIdx !== -1) {
            const after = line.slice(colonIdx + 1).trim();
            if (PRICE_RE.test(after)) {
                return {
                    title: line.slice(0, colonIdx).trim(),
                    price: after
                };
            }
        }
        const m = line.match(/^(.+?)\s{2,}(\d[\d\s]*[\d]\s*[РрPp₽руб\.]+)\s*$/i);
        if (m) {
            return { title: m[1].trim(), price: m[2].trim() };
        }
        return { title: line, price: null };
    }

    function buildRows(arr) {
        return arr.map(line => {
            const { title, price } = parseLine(line);
            if (price) {
                return `<tr>
                    <td style="padding:6px 8px 6px 0;font-size:9.5pt;color:#1a1a2e;border-bottom:1px solid #ede8ff;word-break:break-word;max-width:360px;line-height:1.4;">${title}</td>
                    <td style="padding:6px 0 6px 8px;text-align:right;font-weight:700;color:#7c3aed;font-size:9.5pt;white-space:nowrap;border-bottom:1px solid #ede8ff;vertical-align:top;">${price}</td>
                </tr>`;
            }
            return `<tr>
                <td colspan="2" style="padding:6px 0;font-size:9.5pt;color:#1a1a2e;border-bottom:1px solid #ede8ff;word-break:break-word;line-height:1.4;">${title}</td>
            </tr>`;
        }).join('');
    }

    const summaryBlock = `
        <div style="background:#f3f0ff;border-radius:10px;padding:16px 28px;margin-top:14px;text-align:center;">
            <div style="font-size:9.5pt;color:#6d28d9;margin-bottom:6px;">
                Стоимость для ${clientName}:
            </div>
            <div style="font-size:20pt;font-weight:800;color:#7c3aed;letter-spacing:-0.5px;">
                ${Helpers.fmt(result.total)} ₽
            </div>
        </div>`;

    const helpUrl = isTypical 
        ? 'https://astral.ru/help/1s-epd/1s-epd-tipovoe-reshenie/obshchaya-informatsiya/nachalo-raboty-s-1s-epd/'
        : 'https://astral.ru/help/1s-epd/1s-epd-proektnoe-reshenie/';

    const contactBlock = `
        <div style="border:1px solid #ede8ff;border-radius:10px;padding:14px 20px;margin-top:12px;display:flex;justify-content:space-between;align-items:center;">
            <div>
                <div style="font-size:11pt;font-weight:700;margin-bottom:4px;">
                    <a href="${helpUrl}" style="color:#7c3aed;text-decoration:underline;" target="_blank">Как подключиться</a>
                </div>
                <div style="font-size:8.5pt;color:#888;">Свяжитесь с нами, чтобы подключить сервис</div>
            </div>
            <div style="text-align:right;font-size:9pt;color:#1a1a2e;line-height:1.7;">
                ${partnerName  ? `<div style="font-weight:600;">${partnerName}</div>`  : ''}
                ${partnerPhone ? `<div>${partnerPhone}</div>` : ''}
                ${partnerEmail ? `<div>${partnerEmail}</div>` : ''}
            </div>
        </div>`;

    const page1HTML = `
        <div style="width:794px;background:#fff;box-sizing:border-box;">
            ${b64Header ? `<img src="${b64Header}" style="width:794px;display:block;">` : ''}
            <div style="padding:18px 44px 30px;">
                <div style="font-size:12pt;font-weight:800;color:#7c3aed;margin-bottom:10px;">Стоимость подключения:</div>
                <table style="width:100%;border-collapse:collapse;table-layout:fixed;">
                    <colgroup>
                        <col style="width:70%">
                        <col style="width:30%">
                    </colgroup>
                    <tbody>${buildRows(lines)}</tbody>
                </table>
                ${summaryBlock}
                ${contactBlock}
            </div>
        </div>`;

    const page2HTML = `
        <div style="width:794px;background:#fff;box-sizing:border-box;">
            ${b64Middle ? `<img src="${b64Middle}" style="width:794px;display:block;">` : ''}
        </div>`;

    const page3HTML = `
        <div style="width:794px;background:#fff;box-sizing:border-box;">
            ${b64Low ? `<img src="${b64Low}" style="width:794px;display:block;">` : ''}
        </div>`;

    const PDF_W = 595.28;
    const PDF_H = 841.89;
    
    let linkCoordinates = null;

    async function renderPageToCanvas(htmlContent, pageIndex) {
        const div = document.createElement('div');
        div.style.cssText = 'position:absolute;top:0;left:0;width:794px;background:#fff;z-index:99999;';
        div.innerHTML = htmlContent;
        document.body.appendChild(div);

        await new Promise(r => requestAnimationFrame(() => requestAnimationFrame(r)));

        if (pageIndex === 0) {
            const linkElement = div.querySelector('a[href*="astral.ru"]');
            if (linkElement) {
                const rect = linkElement.getBoundingClientRect();
                const divRect = div.getBoundingClientRect();
                
                const relativeX = rect.left - divRect.left;
                const relativeY = rect.top - divRect.top;
                
                const scaleX = PDF_W / 794;
                const scaleY = PDF_W / 794;
                
                const pad = 4;
                linkCoordinates = {
                    x: relativeX * scaleX - pad,
                    y: relativeY * scaleY - pad,
                    width: rect.width * scaleX + pad * 2,
                    height: rect.height * scaleY + pad * 2
                };
            }
        }

        const canvas = await html2canvas(div, {
            scale:           3,
            useCORS:         true,
            allowTaint:      false,
            backgroundColor: '#ffffff',
            width:           794,
            height:          div.scrollHeight,
            windowWidth:     794
        });

        document.body.removeChild(div);
        return canvas;
    }

    const overlay = document.createElement('div');
    overlay.style.cssText = 'position:fixed;inset:0;background:rgba(30,0,60,0.5);z-index:99998;display:flex;align-items:center;justify-content:center;';
    overlay.innerHTML = `
        <div style="background:#fff;padding:28px 40px;border-radius:14px;text-align:center;font-family:Arial,sans-serif;">
            <div style="font-size:26px;margin-bottom:10px;">📄</div>
            <div style="font-size:14px;font-weight:600;color:#6d28d9;">Создаём PDF...</div>
        </div>`;
    document.body.appendChild(overlay);

    try {
        const { jsPDF } = window.jspdf;
        const doc = new jsPDF({ unit: 'pt', format: 'a4', orientation: 'portrait' });

        const pages = [page1HTML, page2HTML, page3HTML];

        for (let i = 0; i < pages.length; i++) {
            const canvas  = await renderPageToCanvas(pages[i], i);
            const imgData = canvas.toDataURL('image/jpeg', 1.0);
            const imgH    = (canvas.height / canvas.width) * PDF_W;

            if (i > 0) doc.addPage();
            doc.addImage(imgData, 'JPEG', 0, 0, PDF_W, Math.min(imgH, PDF_H));
            
            if (i === 0 && linkCoordinates) {
                doc.link(
                    linkCoordinates.x, 
                    linkCoordinates.y, 
                    linkCoordinates.width, 
                    linkCoordinates.height, 
                    { url: helpUrl }
                );
            }
        }

        doc.save(`КП Астрал.ЭПД для ${clientName}.pdf`);

    } catch (err) {
        console.error('Ошибка PDF:', err);
        alert(`Ошибка создания PDF: ${err.message}`);
    } finally {
        document.body.removeChild(overlay);
    }
};

window.updateServicePrice = (keyRef, value) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
        State.data.customPrices[keyRef] = num;
    } else {
        delete State.data.customPrices[keyRef];
    }
    
    const result = Calculator.calculateAll();
    document.getElementById('total-price').textContent = Helpers.fmt(result.total) + ' ₽';
    document.getElementById('details-content').innerHTML = result.lines.join('<br>');
};

window.updateCustomPrice = (key, value) => {
    const num = parseFloat(value);
    if (!isNaN(num) && num >= 0) {
        State.data.customPrices[key] = num;
    } else {
        delete State.data.customPrices[key];
    }
    
    const result = Calculator.calculateAll();
    document.getElementById('total-price').textContent = Helpers.fmt(result.total) + ' ₽';
    document.getElementById('details-content').innerHTML = result.lines.join('<br>');
};