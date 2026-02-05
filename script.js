/**
 * 1. КОНФИГУРАЦИЯ
 */
const CONFIG = {
    // Названия пакетов точно как в JSON
    tariffKeys: [
        "1С-ЭПД 600 документов",
        "1С-ЭПД 1 000 документов",
        "1С-ЭПД 5 000 документов",
        "1С-ЭПД \n10 000 документов",
        "1С-ЭПД \n50 000 документов\n",
        "1С-ЭПД \n100 000 документов\n"
    ],
    
    limits: [600, 1000, 5000, 10000, 50000, 100000],

    // Добавляем стоимость за документ прямо в конфиг (как дефолтные значения)
    unitPrices: {
        "1С-ЭПД 600 документов": 6,
        "1С-ЭПД 1 000 документов": 5,
        "1С-ЭПД 5 000 документов": 4.5,
        "1С-ЭПД \n10 000 документов": 4,
        "1С-ЭПД \n50 000 документов\n": 3,
        "1С-ЭПД \n100 000 документов\n": 2.5,
        "postpaid": 7
    },
    
    sections: {
        annual: "Стоимость пакета на 12 месяцев",
        unit: "Стоимость одного документа"
    }
};

/**
 * 2. СОСТОЯНИЕ (STATE)
 */
const STATE = {
    mainMode: 'typical',
    subMode: 'standard',
    docsMonthly: 0,
    docsYearly: 0,
    customUnitPrice: null, // Ручная цена от менеджера
    pricing: {
        annual: {}, 
        unit: {},   
        postpaid: CONFIG.unitPrices.postpaid 
    }
};

document.addEventListener('DOMContentLoaded', async () => {
    setupEventListeners();
    
    try {
        const res = await fetch('Цены для калькулятора ЭПД.json');
        const data = await res.json();

        const annualObj = data.find(item => item && item["Тарифы 1С-ЭПД"] === CONFIG.sections.annual);
        const unitObj = data.find(item => item && item["Тарифы 1С-ЭПД"] === CONFIG.sections.unit);

        if (annualObj) STATE.pricing.annual = annualObj;
        if (unitObj) {
            STATE.pricing.unit = unitObj;
            STATE.pricing.postpaid = unitObj["Постоплатный тариф 1С-ЭПД"] || CONFIG.unitPrices.postpaid;
        }

        console.log("Данные успешно загружены");
        calculate(); 
    } catch (e) {
        console.warn("Файл JSON не найден, используем данные из CONFIG");
        // Если файл не загрузился, используем заглушки
        STATE.pricing.annual = {
            "1С-ЭПД 600 документов": 3600,
            "1С-ЭПД 1 000 документов": 5000,
            "1С-ЭПД 5 000 документов": 22500,
            "1С-ЭПД \n10 000 документов": 40000,
            "1С-ЭПД \n50 000 документов\n": 150000,
            "1С-ЭПД \n100 000 документов\n": 200000
        };
        calculate();
    }
});

function calculate() {
    const container = document.getElementById('dynamic-content');
    const totalDisplay = document.getElementById('total-price');
    let total = 0;
    let html = '';

    const count = STATE.docsYearly;

    if (count <= 0) {
        container.innerHTML = `<div class="placeholder-text">Введите количество документов</div>`;
        if (totalDisplay) totalDisplay.textContent = '0 ₽';
        return;
    }

    // 1. ОПРЕДЕЛЯЕМ ПАКЕТ ПО ОБЪЕМУ
    let tariffIdx = CONFIG.limits.findIndex(limit => limit >= count);
    const isOverflow = tariffIdx === -1;
    const finalIdx = isOverflow ? CONFIG.limits.length - 1 : tariffIdx;
    
    const key = CONFIG.tariffKeys[finalIdx];
    const limitValue = CONFIG.limits[finalIdx]; // Например, 5000
    const limitMonth = Math.floor(limitValue / 12);
    
    // 2. БЕРЕМ СТАНДАРТНУЮ ЦЕНУ ИЗ JSON ИЛИ CONFIG
    const standardUnitPrice = STATE.pricing.unit[key] || CONFIG.unitPrices[key] || 0;

    if (STATE.subMode === 'standard') {
        STATE.customUnitPrice = null; // Сбрасываем кастом при переходе в стандарт
        total = STATE.pricing.annual[key] || (limitValue * standardUnitPrice);

        html = `
            <div class="tariff-card animated-fade">
                <div class="tariff-header">
                    <span class="tariff-label">Стандартные условия</span>
                    <h3 class="tariff-title">${key.replace(/\n/g, ' ')}</h3>
                </div>
                <div class="detailing-section">
                    <div class="detail-row">
                        <div class="detail-info"><strong>Лимит пакета</strong><span>${limitValue.toLocaleString('ru-RU')} шт./год (~${limitMonth} в мес.)</span></div>
                        <div class="detail-price">Включено</div>
                    </div>
                    <div class="detail-row highlight">
                        <div class="detail-info"><strong>Цена за 1 документ</strong><span>Стандартный тариф</span></div>
                        <div class="detail-price">${standardUnitPrice} ₽</div>
                    </div>
                </div>
            </div>`;
    } else {
        // 3. ИНДИВИДУАЛЬНЫЙ РЕЖИМ
        if (STATE.customUnitPrice === null) {
            STATE.customUnitPrice = standardUnitPrice;
        }

        // ИТОГО = Лимит пакета * Кастомная цена
        total = limitValue * STATE.customUnitPrice;

        html = `
            <div class="tariff-card animated-fade" style="border-color: var(--secondary);">
                <div class="tariff-header">
                    <span class="tariff-label" style="background: var(--secondary); color: white;">Индивидуальное предложение</span>
                    <h3 class="tariff-title">${key.replace(/\n/g, ' ')}</h3>
                </div>
                <div class="detailing-section">
                    <div class="detail-row">
                        <div class="detail-info">
                            <strong>Лимит документов</strong>
                            <span>Пакет на ${limitValue.toLocaleString('ru-RU')} шт./год</span>
                        </div>
                        <div class="detail-price">Включено</div>
                    </div>
                    
                    <div class="detail-row highlight" style="background: rgba(197, 128, 242, 0.1);">
                        <div class="detail-info">
                            <strong>Цена за 1 документ (₽)</strong>
                            <span>Укажите персональную цену</span>
                        </div>
                        <div class="detail-price">
                            <input type="number" 
                                   class="inline-edit-input" 
                                   value="${STATE.customUnitPrice}" 
                                   step="0.1" 
                                   oninput="window.updateUnitPrice(this.value)">
                        </div>
                    </div>

                    <div class="detail-row">
                        <div class="detail-info">
                            <strong>Стоимость пакета</strong>
                            <span>С учетом вашей скидки</span>
                        </div>
                        <div class="detail-price" id="row-total">${total.toLocaleString('ru-RU')} ₽</div>
                    </div>
                </div>
            </div>`;
    }

    container.innerHTML = html;
    if (totalDisplay) totalDisplay.textContent = total.toLocaleString('ru-RU') + ' ₽';
}

/**
 * Обновление цены за документ
 */
window.updateUnitPrice = (val) => {
    const newPrice = parseFloat(val) || 0;
    STATE.customUnitPrice = newPrice;
    
    // Пересчет без полной перерисовки для удобства ввода
    const count = STATE.docsYearly;
    let tariffIdx = CONFIG.limits.findIndex(limit => limit >= count);
    const finalIdx = tariffIdx === -1 ? CONFIG.limits.length - 1 : tariffIdx;
    const limitValue = CONFIG.limits[finalIdx];

    const newTotal = limitValue * newPrice;
    
    document.getElementById('total-price').textContent = newTotal.toLocaleString('ru-RU') + ' ₽';
    const rowTotal = document.getElementById('row-total');
    if (rowTotal) rowTotal.textContent = newTotal.toLocaleString('ru-RU') + ' ₽';
};

function setupEventListeners() {
    document.querySelectorAll('.toggle-group .toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            const parent = e.target.closest('.toggle-group');
            parent.querySelectorAll('.toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');

            if (parent.id === 'main-mode-toggle') STATE.mainMode = e.target.dataset.mode;
            if (parent.id === 'sub-mode-toggle') STATE.subMode = e.target.dataset.sub;
            
            updateUI();
            calculate();
        };
    });
}

window.updateDocs = (type, value) => {
    const val = parseInt(value) || 0;
    const monthInput = document.getElementById('docs-month');
    const yearInput = document.getElementById('docs-year');

    if (type === 'month') {
        STATE.docsMonthly = val;
        STATE.docsYearly = val * 12;
        if (yearInput) yearInput.value = STATE.docsYearly;
    } else {
        STATE.docsYearly = val;
        STATE.docsMonthly = Math.round(val / 12);
        if (monthInput) monthInput.value = STATE.docsMonthly;
    }
    calculate();
};

function updateUI() {
    const label = document.getElementById('current-mode-label');
    if (label) {
        const mainText = STATE.mainMode === 'typical' ? 'Типовое решение' : 'Проектное решение';
        const subText = STATE.subMode === 'standard' ? 'Стандартный расчёт' : 'Индивидуальный расчёт';
        label.innerHTML = `${mainText} / ${subText}`;
    }
}

window.downloadKP = () => {
    alert('Формирование коммерческого предложения...');
};

const originalUpdateDocs = window.updateDocs;
window.updateDocs = (type, value) => {
    STATE.customUnitPrice = null; 
    originalUpdateDocs(type, value);
};