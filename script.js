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
            training: "Обучение пользователей по работе с Пр"
        }
    },
    LIMITS: [600, 1000, 5000, 10000, 50000, 100000],
    ADDONS: [
        {
            id: 'setup', title: 'Удалённая настройка рабочего места',
            items: [
                { id: 'sw1', label: 'Windows (nalog.ru или ЕСИА)', keyRef: 'setup_win_1' },
                { id: 'sw2', label: 'Windows (nalog.ru и ЕСИА)', keyRef: 'setup_win_2' },
                { id: 'sm1', label: 'MacOS (nalog.ru или ЕСИА)', keyRef: 'setup_mac_1' },
                { id: 'sm2', label: 'MacOS (nalog.ru и ЕСИА)', keyRef: 'setup_mac_2' }
            ]
        },
        {
            id: 'service', title: 'Внедрение и обучение',
            items: [
                { id: 'i1', label: 'Типовая установка', keyRef: 'install_base' },
                { id: 't1', label: 'Обучение (1 группа)', keyRef: 'training' }
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
        mainMode: 'typical',      // typical | project
        subMode: 'standard',      // standard | individual
        docsYearly: 0,
        pricing: [],
        customPrices: {},
        
        // Подписи
        ukepQty: 0,
        ukepPeriod: 12,
        sigType: null,         // basis | kcr | null
        kcrDetails: { egais: 0, univ: 0, basis: 0 },
        
        // МЧД
        mchd: {
            base: { active: false, qty: 0 },
            ext: { active: false, qty: 0 },
            single: { active: false, qty: 0 },
            extra: { active: false, qty: 0 }
        },
        
        // Допы
        addons: {},
    },

    // Инициализация структуры допов
    initAddons() {
        CONSTANTS.ADDONS.forEach(addon => {
            this.data.addons[addon.id] = { enabled: false, values: {} };
        });
    },

    // Геттеры для безопасного доступа к ценам
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
    fmt: (num) => Math.round(num).toLocaleString('ru-RU')
};

/**
 * 4. ЛОГИКА РАСЧЕТА (CALCULATOR)
 */
const Calculator = {
    calculateAll() {
        if (!State.data.pricing.length) return { total: 0, lines: [] };

        let total = 0;
        let lines = [];

        // 1. Тариф
        const tariffRes = this.calcTariff();
        total += tariffRes.cost;
        if (tariffRes.line) lines.push(tariffRes.line);
        
        // 2. Проектное решение
        if (State.data.mainMode === 'project' && State.data.docsYearly > 0) {
            const pPrice = State.data.customPrices['project'] !== undefined 
                ? State.data.customPrices['project'] 
                : State.getPrice(CONSTANTS.KEYS.project);
            total += pPrice;
            lines.push(`Проектное решение: ${Helpers.fmt(pPrice)} ₽`);
        }

        // 3. Подписи
        const sigRes = this.calcSignatures();
        total += sigRes.cost;
        lines.push(...sigRes.lines);

        // 4. МЧД
        const mchdRes = this.calcMCHD();
        total += mchdRes.cost;
        lines.push(...mchdRes.lines);

        // 5. Сервисы
        const addonRes = this.calcAddons();
        total += addonRes.cost;
        lines.push(...addonRes.lines);

        return { total, lines, tariffMeta: tariffRes.meta };
    },

    calcTariff() {
        if (State.data.docsYearly <= 0) return { cost: 0, line: null, meta: null };

        const limits = CONSTANTS.LIMITS;
        let idx = limits.findIndex(l => l >= State.data.docsYearly);
        const finalIdx = idx === -1 ? limits.length - 1 : idx;
        
        const key = CONSTANTS.KEYS.tariffs[finalIdx];
        const limitVal = limits[finalIdx];
        
        const stdBase = State.getPrice(key);
        const stdUnit = State.getUnitPrice(key);
        
        // Логика индивидуальной цены
        const customUnit = State.data.customPrices['unit'];
        const currentUnit = customUnit !== undefined ? customUnit : stdUnit;
        
        const cost = (State.data.subMode === 'standard') 
            ? stdBase 
            : (limitVal * currentUnit);

        const line = State.data.subMode === 'standard'
            ? `Тариф: ${key.replace(/\n/g, ' ')} | ${Helpers.fmt(cost)} ₽`
            : `Тариф: ${key.replace(/\n/g, ' ')} (Индив.) | ${Helpers.fmt(cost)} ₽`;

        return { 
            cost, line, 
            meta: { key, limitVal, basePrice: cost, unitPrice: currentUnit } 
        };
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
                
                // Красивое название
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
                        // ПРОВЕРКА: Если есть кастомная цена для этого ID
                        const customP = State.data.customPrices[item.keyRef];
                        const baseP = State.getPrice(CONSTANTS.KEYS.services[item.keyRef]);
                        
                        const price = (State.data.subMode === 'individual' && customP !== undefined) 
                                      ? customP 
                                      : baseP;

                        const sum = price * qty;
                        cost += sum;
                        lines.push(`${item.label} x ${qty}: ${Helpers.fmt(sum)} ₽`);
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
    els: {}, // Cache elements

    init() {
        this.renderAddonsHTML();
        this.cacheElements();
        this.bindEvents();
    },

    cacheElements() {
        // Кэшируем основные элементы для быстрого доступа
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
            
            // Блок изменения цен (появляется только в индив. режиме)
            const customPriceBlock = isInd ? `
                <details class="card-price-details" style="margin-top: 15px; border-top: 1px solid #eee; padding-top: 10px;">
                    <summary class="custom-price-summary">Изменить стоимость</summary>
                    <div class="custom-price-content">
                        ${addon.items.map(item => {
                            const savedPrice = State.data.customPrices[item.keyRef] || '';
                            const defaultPrice = State.getPrice(CONSTANTS.KEYS.services[item.keyRef]);
                            return `
                            <div class="custom-price-row">
                                <span>${item.label}</span>
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
        const displayUnit = meta.unitPrice.toString().replace('.', ',');
        
        // Инпут для цены
        const unitInputHtml = isInd
            ? `<input type="text" class="inline-edit" value="${displayUnit}" data-action="custom-price" data-type="unit">`
            : `<strong>${displayUnit}</strong>`;
            
        // Инпут для проекта
        let projectHtml = '';
        if (isProject) {
            const pPrice = State.data.customPrices['project'] !== undefined 
                ? State.data.customPrices['project'] 
                : State.getPrice(CONSTANTS.KEYS.project);
                
            const pInput = isInd
                ? `<input type="text" class="inline-edit" value="${pPrice.toString().replace('.', ',')}" data-action="custom-price" data-type="project">`
                : `<strong>${Helpers.fmt(pPrice)}</strong>`;

            projectHtml = `
            <div class="detail-row project-row">
                <span>Проектное решение</span>
                <div class="price-edit-block">${pInput}<span class="unit-text">₽</span></div>
            </div>`;
        }

        container.innerHTML = `
            <div class="tariff-card animated-fade ${isInd ? 'individual-mode' : ''}">
                <div class="tariff-header">
                    <span class="tariff-label">${isInd ? 'Индивидуальные условия' : 'Стандарт'}</span>
                    <h3 class="tariff-title">${meta.key.replace(/\n/g, ' ')}</h3>
                </div>
                <div class="detailing-section">
                    <div class="detail-row">
                        <span>Пакет (${meta.limitVal} шт.)</span>
                        <strong>${Helpers.fmt(meta.basePrice)} ₽</strong>
                    </div>
                    <div class="detail-row highlight">
                        <span>Цена за 1 документ</span>
                        <div class="price-edit-block">${unitInputHtml}<span class="unit-text">₽</span></div>
                    </div>
                    ${projectHtml}
                </div>
            </div>`;
    },

    updateSignaturesUI() {
        const d = State.data;
        const isLocked = d.ukepQty < 6;
        const isInd = State.data.subMode === 'individual';
        
        // Если КЦР заблокировался (кол-во < 6), а он был выбран — сбрасываем выбор
        if (isLocked && d.sigType === 'kcr') {
            State.data.sigType = null;
        }

        this.els['card-kcr'].classList.toggle('locked', isLocked);
        
        // Карточки подсвечиваются только если sigType совпадает
        this.els['card-basis'].classList.toggle('active', d.sigType === 'basis');
        this.els['card-kcr'].classList.toggle('active', d.sigType === 'kcr');
        
        // Показываем поля КЦР внутри карточки
        const kcrOptionsContainer = document.getElementById('kcr-options-container');
        if (kcrOptionsContainer) {
            kcrOptionsContainer.style.display = (d.sigType === 'kcr') ? 'block' : 'none';
        }
        
        // Слайдеры отражают текущее состояние
        this.els['check-basis'].checked = (d.sigType === 'basis');
        this.els['check-kcr'].checked = (d.sigType === 'kcr');

        // Обновляем кнопки периода
        const btn12 = document.querySelector('[data-click="set-ukep-period"][data-val="12"]');
        const btn15 = document.querySelector('[data-click="set-ukep-period"][data-val="15"]');
        if (btn12 && btn15) {
            btn12.classList.toggle('selected', d.ukepPeriod === 12);
            btn15.classList.toggle('selected', d.ukepPeriod === 15);
        }

        // Обновляем блоки с кастомными ценами для каждой карточки
        this.updateBasisPricing(isInd);
        this.updateKCRPricing(isInd);
        this.updateMCHDPricing(isInd);
    },

    updateBasisPricing(isInd) {
        const container = document.getElementById('basis-pricing-container');
        if (!container) return;

        if (!isInd) {
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

        if (!isInd) {
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
        if (!isInd) {
            ['base', 'ext', 'single', 'extra'].forEach(type => {
                const container = document.getElementById(`mchd-${type}-pricing-container`);
                if (container) container.innerHTML = '';
            });
            return;
        }

        // Обновляем каждую карточку МЧД
        const mchdTypes = [
            { id: 'base', key: CONSTANTS.KEYS.mchd.base, name: 'Базовый' },
            { id: 'ext', key: CONSTANTS.KEYS.mchd.ext, name: 'Расширенный' },
            { id: 'single', key: CONSTANTS.KEYS.mchd.single, name: 'Одна МЧД' },
            { id: 'extra', key: CONSTANTS.KEYS.mchd.extra, name: 'Доп. МЧД' }
        ];

        mchdTypes.forEach(type => {
            const container = document.getElementById(`mchd-${type.id}-pricing-container`);
            if (!container) return;

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
        // Делегирование событий
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
            this.els['docs-year'].value = State.data.docsYearly;
            this.update();
        } 
        else if (act === 'docs-year') {
            State.data.docsYearly = parseInt(val)||0;
            this.els['docs-month'].value = Math.round(State.data.docsYearly / 12);
            this.update();
        }
        else if (act === 'ukep-qty') {
            State.data.ukepQty = Math.max(0, parseInt(val)||0);
            this.update();
        }
        else if (act === 'kcr-qty') {
            const field = t.dataset.field; // egais, univ, basis
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
            const floatVal = parseFloat(t.value.replace(',', '.')) || 0;
            State.data.customPrices[type] = floatVal;
            this.update();
        }
        else if (act === 'toggle-sig') {
            const type = t.dataset.val; // basis | kcr
            const checked = t.checked;
            
            // Если включили — устанавливаем этот тип, если выключили — сбрасываем
            if (checked) {
                // Проверяем доступность КЦР
                if (type === 'kcr' && State.data.ukepQty < 6) {
                    t.checked = false;
                    return;
                }
                State.data.sigType = type;
            } else {
                // Выключили — сбрасываем только если это был активный тип
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
            
            // Активация UI
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
            if (State.data.subMode === 'standard') State.data.customPrices = {};
            
            // Перерисовываем допы при смене режима
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

    // Загрузка JSON
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
window.downloadKP = () => {
    alert("Функция генерации PDF");
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