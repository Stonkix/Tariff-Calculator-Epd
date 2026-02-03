/**
 * СОСТОЯНИЕ (STATE)
 */
const STATE = {
    mainMode: 'typical', // typical (Типовое) | project (Проектное)
    subMode: 'standard'  // standard (Стандартный) | individual (Индивидуальный)
};

/**
 * ИНИЦИАЛИЗАЦИЯ
 */
document.addEventListener('DOMContentLoaded', () => {
    setupEventListeners();
    updateUI();
});

/**
 * НАСТРОЙКА СОБЫТИЙ
 */
function setupEventListeners() {
    // Переключение основного режима
    document.querySelectorAll('#main-mode-toggle .toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#main-mode-toggle .toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            STATE.mainMode = e.target.dataset.mode;
            updateUI();
        };
    });

    // Переключение подрежима
    document.querySelectorAll('#sub-mode-toggle .toggle-btn').forEach(btn => {
        btn.onclick = (e) => {
            document.querySelectorAll('#sub-mode-toggle .toggle-btn').forEach(b => b.classList.remove('selected'));
            e.target.classList.add('selected');
            STATE.subMode = e.target.dataset.sub;
            updateUI();
        };
    });
}

/**
 * ОБНОВЛЕНИЕ ИНТЕРФЕЙСА
 */
function updateUI() {
    const label = document.getElementById('current-mode-label');
    
    const mainText = STATE.mainMode === 'typical' ? 'Типовое решение' : 'Проектное решение';
    const subText = STATE.subMode === 'standard' ? 'Стандартный расчёт' : 'Индивидуальный расчёт';
    
    if (label) {
        label.innerHTML = `${mainText} / ${subText}`;
    }
    
    console.log(`Текущий режим: ${STATE.mainMode}, подрежим: ${STATE.subMode}`);
    // Здесь будет вызываться функция отрисовки полей, когда вы дадите ТЗ на наполнение
}