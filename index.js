// Глобальные переменные
let score = 0;
let currentProblem = {};
let difficulty = 'easy';
let timer;
let timeLeft;
let maxTime;
let isPracticeMode = false;
let currentTheme = '';
let correctAnswers = 0;
let wrongAnswers = 0;
let currentStreak = 0;
let maxStreak = 0;
let currentGameMode = null;
let gameModeData = {
    sprint: { problemsTotal: 10, problemsSolved: 0, timePerProblem: 0 },
    marathon: { level: 1, maxLevel: 0 },
    accuracy: { streak: 0, penaltyCount: 0 },
    exam: { problemsTotal: 20, problemsSolved: 0, correctAnswers: 0 }
};
let gameActive = false;

// Уровни
const levels = [
    { minScore: 0, name: "Новичок", operations: ['+', '-'], maxNumber: 10, time: 30, points: 1 },
    { minScore: 50, name: "Ученик", operations: ['+', '-', '*'], maxNumber: 20, time: 25, points: 2 },
    { minScore: 100, name: "Знаток", operations: ['+', '-', '*', '/'], maxNumber: 50, time: 20, points: 3 },
    { minScore: 200, name: "Эксперт", operations: ['+', '-', '*', '/', '**', '***'], maxNumber: 100, time: 18, points: 4 },
    { minScore: 350, name: "Мастер", operations: ['+', '-', '*', '/', '**','***', '√'], maxNumber: 150, time: 15, points: 5 },
    { minScore: 500, name: "Гений", operations: ['+', '-', '*', '/', '**', '√','***', '%', 'quadratic'], maxNumber: 200, time: 12, points: 6 }
];

let currentLevelIndex = 0;

// === ФУНКЦИИ УРОВНЕЙ ===
function updateLevelDisplay() {
    const levelElement = document.getElementById('level');
    const levelNameElement = document.getElementById('level-name');
    const progressBar = document.getElementById('level-progress-bar');
    
    const currentLevel = levels[currentLevelIndex];
    const nextLevel = levels[currentLevelIndex + 1];
    
    levelElement.textContent = currentLevelIndex + 1;
    levelNameElement.textContent = currentLevel.name;
    
    levelElement.classList.add('level-up');
    setTimeout(() => levelElement.classList.remove('level-up'), 500);
    
    if (nextLevel) {
        const progress = ((score - currentLevel.minScore) / (nextLevel.minScore - currentLevel.minScore)) * 100;
        progressBar.style.width = Math.min(progress, 100) + '%';
    } else {
        progressBar.style.width = '100%';
    }
}

function getCurrentLevel() {
    const newLevelIndex = levels.findIndex((level, index) => {
        return score >= level.minScore && (index === levels.length - 1 || score < levels[index + 1].minScore);
    });
    
    if (newLevelIndex !== -1 && newLevelIndex !== currentLevelIndex) {
        currentLevelIndex = newLevelIndex;
        updateLevelDisplay();
        
        if (currentLevelIndex > 0) {
            const resultElement = document.getElementById('result');
            resultElement.textContent = `🎉 Новый уровень: ${levels[currentLevelIndex].name}!`;
            resultElement.className = 'result correct';
            setTimeout(() => resultElement.textContent = '', 3000);
        }
    }
    
    return levels[currentLevelIndex];
}

// === ФУНКЦИИ ТАЙМЕРА ===
function startTimer() {
    clearInterval(timer);
    timer = setInterval(() => {
        timeLeft--;
        updateTimer();
        
        if (timeLeft <= 0) {
            clearInterval(timer);
            timeUp();
        }
    }, 1000);
}

function updateTimer() {
    const timerText = document.getElementById('timer-text');
    const timerProgress = document.querySelector('.timer-progress');
    
    timerText.textContent = timeLeft;
    
    const circumference = 2 * Math.PI * 45;
    const offset = circumference - (timeLeft / maxTime) * circumference;
    timerProgress.style.strokeDashoffset = offset;
    
    timerProgress.classList.remove('timer-warning', 'timer-critical');
    if (timeLeft <= 10 && timeLeft > 5) {
        timerProgress.classList.add('timer-warning');
    } else if (timeLeft <= 5) {
        timerProgress.classList.add('timer-critical');
    }
}

function timeUp() {
    const resultElement = document.getElementById('result');
    const userAnswerInput = document.getElementById('answer');
    
    resultElement.textContent = '⏰ Время вышло! Правильный ответ: ' + currentProblem.answer;
    resultElement.className = 'result incorrect';
    
    // Обработка для игровых режимов
    if (currentGameMode && gameActive) {
        handleGameModeAnswer(false);
        
        // Для экзамена и марафона заканчиваем игру при истечении времени
        if (currentGameMode === 'exam' || currentGameMode === 'marathon') {
            setTimeout(() => {
                endGameMode();
            }, 2000);
            return;
        }
    }
    
    setTimeout(() => {
        if ((currentGameMode && gameActive) || !currentGameMode) {
            generateProblem();
            userAnswerInput.value = '';
            resultElement.textContent = '';
            
            // Для экзамена не сбрасываем таймер!
            if (currentGameMode === 'exam') {
                startTimer(); // Просто продолжаем отсчет
            } else {
                resetTimer();
                startTimer();
            }
            
            if (currentGameMode) {
                updateGameUI();
            }
        }
    }, 2000);
}

function resetTimer() {
    if (currentGameMode && gameActive) {
        // Для игровых режимов используем специальные настройки времени
        switch(currentGameMode) {
            case 'sprint':
                maxTime = 5; // 5 секунд на задачу в спринте
                break;
            case 'marathon':
                maxTime = 30; // 30 секунд на задачу в марафоне
                break;
            case 'accuracy':
                maxTime = 25; // 25 секунд на задачу в режиме точности
                break;
            case 'exam':
                maxTime = 600; // 600 секунд на ВЕСЬ экзамен (только при старте)
                // Не сбрасываем timeLeft при каждом вопросе!
                if (timeLeft === undefined || timeLeft > maxTime) {
                    timeLeft = maxTime; // Устанавливаем только при первом запуске
                }
                updateTimer();
                return; // Выходим, чтобы не сбрасывать время
        }
    } else {
        // Обычный режим или практика
        const level = getCurrentLevel();
        maxTime = level.time;
    }
    
    timeLeft = maxTime;
    updateTimer();
}

// === ФУНКЦИИ ГЕНЕРАЦИИ ВОПРОСОВ ===
function generateProblem() {
    const level = getCurrentLevel();
    let a, b, c, operator, answer;
    let questionText = '';
    let isEquation = false;
    let root1, root2; 
    
    const maxNum = level.maxNumber;
    
    if (isPracticeMode && currentTheme) {
        // Режим тематической практики
        switch(currentTheme) {
            case 'addition':
                operator = Math.random() > 0.5 ? '+' : '-';
                break;
            case 'multiplication':
                operator = Math.random() > 0.5 ? '*' : '/';
                break;
            case 'percent':
                operator = '%';
                break;
            case 'fractions':
                operator = '/';
                break;
            case 'powers':
                operator = Math.random() > 0.5 ? '**' : '√';
                break;
            case 'equations':
                const eqOperators = ['+', '-', '*', '/', 'quadratic'];
                operator = eqOperators[Math.floor(Math.random() * eqOperators.length)];
                isEquation = true;
                break;
        }
    } else {
        // Обычный режим
        operator = level.operations[Math.floor(Math.random() * level.operations.length)];
    }
    
    switch(operator) {
        case '+':
            if(currentTheme === "equations" || Math.random() < 0.3) {
                // Уравнение вида a + x = b
                a = Math.floor(Math.random() * maxNum) + 1;
                b = Math.floor(Math.random() * maxNum) + 1;
                if (b < a) [b, a] = [a, b];
                answer = b - a;
                questionText = `${a} + x = ${b}`;
                isEquation = true;
                break;
            }
            a = Math.floor(Math.random() * maxNum) + 1;
            b = Math.floor(Math.random() * maxNum) + 1;
            answer = a + b;
            questionText = `${a} + ${b} = ?`;
            break;
            
        case '-':
            if(currentTheme === "equations" || Math.random() < 0.3) {
                // Уравнение вида a - x = b
                a = Math.floor(Math.random() * maxNum) + 1;
                b = Math.floor(Math.random() * maxNum) + 1;
                if (a < b) [a, b] = [b, a];
                answer = a - b;
                questionText = `${a} - x = ${b}`;
                isEquation = true;
                break;
            }
            a = Math.floor(Math.random() * maxNum) + 1;
            b = Math.floor(Math.random() * maxNum) + 1;
            if (a < b) [a, b] = [b, a];
            answer = a - b;
            questionText = `${a} - ${b} = ?`;
            break;
            
        case '*':
            if(currentTheme === "equations" || (Math.random() < 0.3 && currentLevelIndex >= 2)) {
                // Уравнение вида a * x = b
                a = Math.floor(Math.random() * Math.min(10, maxNum/2)) + 2;
                b = Math.floor(Math.random() * Math.min(15, maxNum/a)) + 1;
                answer = b;
                b = a * b;
                questionText = `${a} × x = ${b}`;
                isEquation = true;
                break;
            }
            a = Math.floor(Math.random() * Math.min(20, maxNum)) + 1;
            b = Math.floor(Math.random() * Math.min(10, maxNum/2)) + 1;
            answer = a * b;
            questionText = `${a} × ${b} = ?`;
            break;
            
        case '/':
            if(currentTheme === "equations" || (Math.random() < 0.3 && currentLevelIndex >= 2)) {
                // Уравнение вида x / a = b
                a = Math.floor(Math.random() * 10) + 2;
                b = Math.floor(Math.random() * Math.min(15, maxNum/a)) + 1;
                answer = a * b;
                questionText = `x ÷ ${a} = ${b}`;
                isEquation = true;
                break;
            }
            b = Math.floor(Math.random() * 10) + 2;
            answer = Math.floor(Math.random() * Math.min(15, maxNum/b)) + 1;
            a = answer * b;
            questionText = `${a} ÷ ${b} = ?`;
            break;
            
        case '**':
            a = Math.floor(Math.random() * 12) + 2;
            answer = a * a;
            questionText = `${a}² = ?`;
            break;

        case '***': 
            a = Math.floor(Math.random()*6) + 2;
            answer = a * a * a;
            questionText = `${a}³ = ?`;
            break;
            
        case '√':
            answer = Math.floor(Math.random() * 12) + 2;
            a = answer * answer;
            questionText = `√${a} = ?`;
            break;
            
        case '%':
            a = Math.floor(Math.random() * 20) * 5 + 5;
            b = Math.floor(Math.random() * 90) + 10;
            answer = Math.round((a / 100) * b);
            questionText = `${a}% от ${b} = ?`;
            break;
            
        case 'quadratic':
            // Простые квадратные уравнения вида x² + bx + c = 0
            // Генерируем корни, затем коэффициенты
            root1 = Math.floor(Math.random() * 10) - 5; // от -5 до 4
            root2 = Math.floor(Math.random() * 10) - 5;
            
            // Коэффициенты: a=1, b=-(root1+root2), c=root1*root2
            b = -(root1 + root2);
            c = root1 * root2;
            
            // Формируем уравнение
            let equationText = 'x²';
            if (b !== 0) {
                equationText += b > 0 ? ` + ${b}x` : ` - ${Math.abs(b)}x`;
            }
            if (c !== 0) {
                equationText += c > 0 ? ` + ${c}` : ` - ${Math.abs(c)}`;
            }
            equationText += ' = 0';
            
            questionText = equationText;
            // Для квадратных уравнений ответ - это меньший корень
            answer = Math.min(root1, root2);
            isEquation = true;
            break;
    }

    currentProblem = { 
        a, 
        b, 
        c, 
        operator, 
        answer, 
        questionText, 
        isEquation,
        roots: operator === 'quadratic' ? [Math.min(root1, root2), Math.max(root1, root2)] : null
    };
    document.getElementById('question').textContent = questionText;
    document.getElementById('answer').focus();
}

// === ФУНКЦИИ ПРОВЕРКИ ОТВЕТОВ ===

function checkAnswer() {
    const userAnswerInput = document.getElementById('answer');
    const userAnswer = parseFloat(userAnswerInput.value);
    const resultElement = document.getElementById('result');
    
    if (isNaN(userAnswer)) {
        resultElement.textContent = 'Пожалуйста, введите число!';
        resultElement.className = 'result incorrect';
        return;
    }
    
    let isCorrect = false;
    
    switch(currentProblem.operator) {
        case '%':
            isCorrect = Math.abs(userAnswer - currentProblem.answer) <= 1;
            break;
        case 'quadratic':
            // Для квадратных уравнений принимаем любой из двух корней
            isCorrect = Math.abs(userAnswer - currentProblem.roots[0]) < 0.1 || 
                       Math.abs(userAnswer - currentProblem.roots[1]) < 0.1;
            break;
        default:
            isCorrect = Math.abs(userAnswer - currentProblem.answer) < 0.1;
    }
    
    // Обновляем статистику практики
    if (isPracticeMode) {
        if (isCorrect) {
            correctAnswers++;
            currentStreak++;
            maxStreak = Math.max(maxStreak, currentStreak);
        } else {
            wrongAnswers++;
            currentStreak = 0;
        }
        updatePracticeStats();
    }
    
    // Обработка игровых режимов
    if (currentGameMode && gameActive) {
        handleGameModeAnswer(isCorrect);
    }
    
    const setTime = function(time) {
        clearInterval(timer);
        setTimeout(() => {
            // Продолжаем только если игра активна (не завершена в игровом режиме)
            if ((currentGameMode && gameActive) || !currentGameMode) {
                generateProblem();
                userAnswerInput.value = '';
                resultElement.textContent = '';
                resetTimer();
                startTimer();
                
                // Обновляем UI для игровых режимов
                if (currentGameMode) {
                    updateGameUI();
                }
            }
        }, time);
    };
    
    if (isCorrect) {
        const level = getCurrentLevel();
        const points = level.points;
        
        // Базовые очки
        let pointsEarned = points * 10;
        let resultMessage = '✅ Правильно! +' + pointsEarned;
        
        // Бонус за скорость (только в обычном режиме)
        if (timeLeft > maxTime * 0.7 && !currentGameMode) {
            const bonus = Math.floor(points * 0.5);
            pointsEarned += bonus;
            resultMessage += ` +${bonus} за скорость!`;
        }
        
        score += pointsEarned;
        document.getElementById('score').textContent = score;
        resultElement.textContent = resultMessage;
        resultElement.className = 'result correct';
        
        getCurrentLevel();
        updateLevelDisplay();
        
        let delayTime = 2000;
        
        // Увеличиваем задержку для сложных объяснений
        const needExplanation = ['**','***', '/', '√', '%', '*', '+', '-', 'quadratic'].includes(currentProblem.operator);
        if (currentLevelIndex >= 2 && needExplanation) {
            delayTime = 3000;
        }
        
        // Для спринта уменьшаем задержку
        if (currentGameMode === 'sprint') {
            delayTime = 1000;
        }
        
        // ОСОБАЯ ЛОГИКА ДЛЯ ЭКЗАМЕНА - не сбрасываем таймер!
        if (currentGameMode === 'exam') {
            clearInterval(timer);
            setTimeout(() => {
                if (gameActive) {
                    generateProblem();
                    userAnswerInput.value = '';
                    resultElement.textContent = '';
                    // НЕ вызываем resetTimer() для экзамена!
                    startTimer(); // Просто продолжаем отсчет
                    updateGameUI();
                }
            }, 500);
        } else {
            // Стандартная логика для других режимов
            setTime(delayTime);
        }
        
    } else {
        const needExplanation = ['**','***', '/', '√', '%', '*', '+', '-', 'quadratic'].includes(currentProblem.operator);
        let explanation = '';
        
        if (needExplanation) {
            switch(currentProblem.operator) {
                case '**':
                    explanation = `\nОбъяснение: ${currentProblem.a} × ${currentProblem.a} = ${currentProblem.answer}`;
                    break;
                case '***':
                    explanation = `\nОбъяснение: ${currentProblem.a} × ${currentProblem.a} × ${currentProblem.a} = ${currentProblem.answer}`;
                    break;
                case '√':
                    explanation = `\nОбъяснение: ${currentProblem.answer} × ${currentProblem.answer} = ${currentProblem.a}`;
                    break;
                case '%':
                    explanation = `\nОбъяснение: ${currentProblem.a}% × ${currentProblem.b} ÷ 100 = ${currentProblem.answer}`;
                    break;
                case '/':
                    if (currentProblem.isEquation) {
                        explanation = `\nОбъяснение: x = ${currentProblem.b} × ${currentProblem.a} = ${currentProblem.answer}`;
                    } else {
                        explanation = `\nОбъяснение: ${currentProblem.a} ÷ ${currentProblem.b} = ${currentProblem.answer}`;
                    }
                    break;
                case '*':
                    if (currentProblem.isEquation) {
                        explanation = `\nОбъяснение: x = ${currentProblem.b} ÷ ${currentProblem.a} = ${currentProblem.answer}`;
                    } else {
                        explanation = `\nОбъяснение: ${currentProblem.a} × ${currentProblem.b} = ${currentProblem.answer}`;
                    }
                    break;
                case '+':
                    if (currentProblem.isEquation) {
                        explanation = `\nОбъяснение: x = ${currentProblem.b} - ${currentProblem.a} = ${currentProblem.answer}`;
                    } else {
                        explanation = `\nОбъяснение: ${currentProblem.a} + ${currentProblem.b} = ${currentProblem.answer}`;
                    }
                    break;
                case '-':
                    if (currentProblem.isEquation) {
                        explanation = `\nОбъяснение: x = ${currentProblem.a} - ${currentProblem.b} = ${currentProblem.answer}`;
                    } else {
                        explanation = `\nОбъяснение: ${currentProblem.a} - ${currentProblem.b} = ${currentProblem.answer}`;
                    }
                    break;
                case 'quadratic':
                    explanation = `\nОбъяснение: Корни уравнения: ${currentProblem.roots[0]} и ${currentProblem.roots[1]}\n` +
                                 `Формула: x = [-b ± √(b²-4ac)]/2a`;
                    break;
            }
        }
        
        // Сообщение об ошибке с учетом режима точности
        let errorMessage = `❌ Неправильно. Правильный ответ: ${currentProblem.answer}`;
        
        if (currentGameMode === 'accuracy') {
            errorMessage += ` (-10 очков)`;
        }
        
        errorMessage += explanation;
        
        resultElement.textContent = errorMessage;
        resultElement.className = 'result incorrect';

        let delayTime = 2000;
        
        if (currentLevelIndex >= 2 && needExplanation) {
            delayTime = 5000;
        }
        
        // Для спринта уменьшаем задержку
        if (currentGameMode === 'sprint') {
            delayTime = 1500;
        }
        
        // ОСОБАЯ ЛОГИКА ДЛЯ ЭКЗАМЕНА - не сбрасываем таймер!
        if (currentGameMode === 'exam') {
            clearInterval(timer);
            setTimeout(() => {
                if (gameActive) {
                    generateProblem();
                    userAnswerInput.value = '';
                    resultElement.textContent = '';
                    // НЕ вызываем resetTimer() для экзамена!
                    startTimer(); // Просто продолжаем отсчет
                    updateGameUI();
                }
            }, delayTime);
        } else {
            // Стандартная логика для других режимов
            setTime(delayTime);
        }
    }
}

// === ФУНКЦИИ ТЕМАТИЧЕСКОЙ ПРАКТИКИ ===
function updatePracticeStats() {
    document.getElementById('correctAnswers').textContent = correctAnswers;
    document.getElementById('wrongAnswers').textContent = wrongAnswers;
    
    const total = correctAnswers + wrongAnswers;
    const accuracy = total > 0 ? Math.round((correctAnswers / total) * 100) : 0;
    document.getElementById('accuracy').textContent = accuracy + '%';
    
    document.getElementById('streak').textContent = maxStreak;
    
    if (accuracy >= 90 && total >= 10) {
        document.getElementById('masteryMessage').style.display = 'block';
    } else {
        document.getElementById('masteryMessage').style.display = 'none';
    }
}

function selectTheme(theme) {
    currentTheme = theme;
    isPracticeMode = true;
    correctAnswers = 0;
    wrongAnswers = 0;
    currentStreak = 0;
    maxStreak = 0;
    
    closeAllModals();
    
    document.getElementById('practiceStats').style.display = 'block';
    updatePracticeStats();
    
    document.querySelector('button[onclick="newGame()"]').style.display = 'none';
    document.getElementById('stopPracticeBtn').style.display = 'block';
    
    resetTimer();
    startTimer();
    generateProblem();
}

function stopPractice() {
    isPracticeMode = false;
    document.querySelector('button[onclick="newGame()"]').style.display = 'block';
    document.getElementById('stopPracticeBtn').style.display = 'none';
    document.getElementById('practiceStats').style.display = 'none';
    document.getElementById('thematicModal').style.display = 'flex';
}

// === ОСНОВНЫЕ ФУНКЦИИ ИГРЫ ===
function newGame() {
    score = 0;
    currentLevelIndex = 0;
    currentGameMode = null; // Сбрасываем игровой режим
    gameActive = false;
    
    document.getElementById('score').textContent = '0';
    document.getElementById('result').textContent = '';
    document.getElementById('answer').value = '';
    
    isPracticeMode = false;
    document.getElementById('practiceStats').style.display = 'none';
    document.querySelector('button[onclick="newGame()"]').style.display = 'block';
    document.getElementById('stopPracticeBtn').style.display = 'none';
    
    updateLevelDisplay();
    
    const level = getCurrentLevel();
    maxTime = level.time;
    timeLeft = maxTime;
    updateTimer();
    startTimer();
    generateProblem();
}

function setDifficulty(level) {
    difficulty = level;
    document.querySelectorAll('.difficulty-btn').forEach(btn => {
        btn.classList.remove('active');
    });
    event.target.classList.add('active');
    newGame();
}

// === ФУНКЦИИ МОДАЛЬНЫХ ОКОН ===
function openLearningModal() {
    document.getElementById('learningModal').style.display = 'flex';
}

function openGameModesModal() {
    document.getElementById('gameModesModal').style.display = 'flex';
}

function openShopModal() {
    document.getElementById('shopMainModal').style.display = 'flex';
}

function openThematicPractice() {
    document.getElementById('thematicModal').style.display = 'flex';
    document.getElementById('learningModal').style.display = 'none';
}

function openTheoryMode() {
    alert('Режим теории будет реализован позже!');
    closeAllModals();
}

function openRandomPractice() {
    alert('Случайная практика будет реализована позже!');
    closeAllModals();
}

function showModal(modalId) {
    closeAllModals();
    document.getElementById(modalId).style.display = 'flex';
}

function closeModal(modalId) {
    document.getElementById(modalId).style.display = 'none';
}

function closeAllModals() {
    document.querySelectorAll('.modal-overlay').forEach(modal => {
        modal.style.display = 'none';
    });
}

// Функции магазина
function openBoostersModal() {
    document.getElementById('boostersModal').style.display = 'flex';
    document.getElementById('shopMainModal').style.display = 'none';
}

function openVisualModal() {
    document.getElementById('visualModal').style.display = 'flex';
    document.getElementById('shopMainModal').style.display = 'none';
}

function openPremiumModal() {
    document.getElementById('premiumModal').style.display = 'flex';
    document.getElementById('shopMainModal').style.display = 'none';
}

function openPremiumStatusModal() {
    document.getElementById('premiumStatusModal').style.display = 'flex';
    document.getElementById('premiumModal').style.display = 'none';
}

function openStarterPacksModal() {
    document.getElementById('starterPacksModal').style.display = 'flex';
    document.getElementById('premiumModal').style.display = 'none';
}

function openTimeBoostersModal() {
    document.getElementById('timeBoostersModal').style.display = 'flex';
    document.getElementById('boostersModal').style.display = 'none';
}

function openPointsBoostersModal() {
    document.getElementById('pointsBoostersModal').style.display = 'flex';
    document.getElementById('boostersModal').style.display = 'none';
}

function openHintsBoostersModal() {
    document.getElementById('hintsBoostersModal').style.display = 'flex';
    document.getElementById('boostersModal').style.display = 'none';
}

function openThemesModal() {
    document.getElementById('themesModal').style.display = 'flex';
    document.getElementById('visualModal').style.display = 'none';
}

function openSoundsModal() {
    document.getElementById('soundsModal').style.display = 'flex';
    document.getElementById('visualModal').style.display = 'none';
}

function buyItem(item) {
    alert('Покупка ' + item + ' будет реализована позже!');
}

// === ОБРАБОТЧИКИ СОБЫТИЙ ===
document.querySelectorAll('.modal-overlay').forEach(overlay => {
    overlay.addEventListener('click', function(e) {
        if (e.target === overlay) {
            closeAllModals();
        }
    });
});

document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape') {
        closeAllModals();
    }
});

document.getElementById('answer').addEventListener('keypress', function(e) {
    if (e.key === 'Enter') {
        checkAnswer();
    }
});




// === ФУНКЦИИ ИГРОВЫХ РЕЖИМОВ ===

function selectGameMode(mode) {
    currentGameMode = mode;
    closeAllModals();
    resetGameMode();
    startGameMode();
}

function resetGameMode() {
    // Сброс данных для всех режимов
    gameModeData = {
        sprint: { problemsTotal: 10, problemsSolved: 0, timePerProblem: 0 },
        marathon: { level: 1, maxLevel: 0, problemsSolved: 0 },
        accuracy: { streak: 0, penaltyCount: 0, problemsSolved: 0, correctAnswers: 0 },
        exam: { problemsTotal: 20, problemsSolved: 0, correctAnswers: 0 }
    };
    gameActive = true;
    
    // Скрываем статистику практики
    document.getElementById('practiceStats').style.display = 'none';
    document.getElementById('stopPracticeBtn').style.display = 'none';
}

function startGameMode() {
    score = 0;
    document.getElementById('score').textContent = '0';
    document.getElementById('result').textContent = '';
    document.getElementById('answer').value = '';
    
    // Особые настройки для экзамена
    if (currentGameMode === 'exam') {
        // Сбрасываем данные экзамена
        gameModeData.exam.problemsSolved = 0;
        gameModeData.exam.correctAnswers = 0;
        maxTime = 600; // 10 минут на весь экзамен
        timeLeft = maxTime; // Устанавливаем полное время
    }
    
    gameActive = true;
    
    resetTimer();
    startTimer();
    generateProblem();
    updateGameUI();
}
function updateGameUI() {
    // Обновляем интерфейс в зависимости от режима
    const timerCircle = document.querySelector('.timer-circle');
    
    switch(currentGameMode) {
        case 'sprint':
            document.querySelector('.timer-background').style.display = 'none';
            document.querySelector('.timer-container').style.setProperty('--timer-color', '#e74c3c');
            break;
        case 'exam':
            document.querySelector('.timer-background').style.display = 'none';
            document.querySelector('.timer-container').style.setProperty('--timer-color', '#9b59b6');
            // Показываем прогресс экзамена
            const progress = Math.round((gameModeData.exam.problemsSolved / gameModeData.exam.problemsTotal) * 100);
            document.getElementById('question').innerHTML = `
                <div>Вопрос ${gameModeData.exam.problemsSolved + 1}/${gameModeData.exam.problemsTotal}</div>
                <div>${currentProblem.questionText}</div>
                <div style="margin-top: 10px; font-size: 0.8rem; color: #7f8c8d;">
                    Прогресс: ${progress}%
                </div>
            `;
            break;
        default:
            // Для других режимов восстанавливаем стандартные настройки
            document.querySelector('.timer-background').style.display = 'block';
            document.querySelector('.timer-container').style.setProperty('--timer-color', '#3498db');
    }
}

function handleGameModeAnswer(isCorrect) {
    if (!gameActive) return;
    
    switch(currentGameMode) {
        case 'sprint':
            gameModeData.sprint.problemsSolved++;
            if (gameModeData.sprint.problemsSolved >= gameModeData.sprint.problemsTotal) {
                endGameMode();
            }
            break;
            
        case 'marathon':
            if (isCorrect) {
                gameModeData.marathon.problemsSolved++;
                // Повышаем уровень каждые 5 правильных ответов
                if (gameModeData.marathon.problemsSolved % 5 === 0) {
                    gameModeData.marathon.level++;
                    if (currentLevelIndex < levels.length - 1) {
                        currentLevelIndex = Math.min(currentLevelIndex + 1, levels.length - 1);
                    }
                    // Увеличиваем сложность
                    levels[currentLevelIndex].maxNumber += 10;
                }
                gameModeData.marathon.maxLevel = Math.max(gameModeData.marathon.maxLevel, gameModeData.marathon.level);
            } else {
                endGameMode();
            }
            break;
            
        case 'accuracy':
            gameModeData.accuracy.problemsSolved++;
            if (isCorrect) {
                gameModeData.accuracy.correctAnswers++;
                gameModeData.accuracy.streak++;
                // Бонус за серию из 5 правильных ответов
                if (gameModeData.accuracy.streak % 5 === 0) {
                    score += 5;
                    document.getElementById('score').textContent = score;
                    document.getElementById('result').textContent += ' +5 за серию!';
                }
            } else {
                score = Math.max(0, score - 10); // Штраф -10 очков
                document.getElementById('score').textContent = score;
                gameModeData.accuracy.penaltyCount++;
                gameModeData.accuracy.streak = 0;
            }
            break;
            
        case 'exam':
            gameModeData.exam.problemsSolved++;
            if (isCorrect) {
                gameModeData.exam.correctAnswers++;
            }
            if (gameModeData.exam.problemsSolved >= gameModeData.exam.problemsTotal) {
                endGameMode();
            }
            break;
    }
}

function endGameMode() {
    gameActive = false;
    clearInterval(timer);
    
    // Показываем результаты
    showGameResults();
}

function showGameResults() {
    const resultsTitle = document.getElementById('gameResultsTitle');
    const resultsStats = document.getElementById('gameResultsStats');
    const specialMessage = document.getElementById('gameSpecialMessage');
    
    resultsStats.innerHTML = '';
    specialMessage.style.display = 'none';
    
    switch(currentGameMode) {
        case 'sprint':
            resultsTitle.textContent = '⚡ Результаты Спринта';
            const sprintTime = (gameModeData.sprint.timePerProblem * gameModeData.sprint.problemsTotal).toFixed(1);
            const averageTime = (sprintTime / gameModeData.sprint.problemsSolved).toFixed(1);
            
            resultsStats.innerHTML = `
                <div class="stat-item">
                    <div class="stat-value">${gameModeData.sprint.problemsSolved}/${gameModeData.sprint.problemsTotal}</div>
                    <div class="stat-label">Решено задач</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${score}</div>
                    <div class="stat-label">Очки</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${averageTime}с</div>
                    <div class="stat-label">Среднее время</div>
                </div>
            `;
            break;
            
        case 'marathon':
            resultsTitle.textContent = '🏃‍♂️ Результаты Марафона';
            resultsStats.innerHTML = `
                <div class="stat-item">
                    <div class="stat-value">${gameModeData.marathon.maxLevel}</div>
                    <div class="stat-label">Достигнутый уровень</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${gameModeData.marathon.problemsSolved}</div>
                    <div class="stat-label">Решено задач</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${score}</div>
                    <div class="stat-label">Очки</div>
                </div>
            `;
            
            // Специальное сообщение в зависимости от результата
            if (gameModeData.marathon.maxLevel >= 10) {
                specialMessage.style.display = 'block';
                specialMessage.style.background = 'linear-gradient(135deg, #f39c12, #e67e22)';
                specialMessage.innerHTML = '🏆 Невероятно! Вы настоящий марафонец!';
            }
            break;
            
        case 'accuracy':
            resultsTitle.textContent = '🎯 Результаты Точности';
            const accuracy = gameModeData.accuracy.problemsSolved > 0 
                ? Math.round((gameModeData.accuracy.correctAnswers / gameModeData.accuracy.problemsSolved) * 100) 
                : 0;
            
            resultsStats.innerHTML = `
                <div class="stat-item">
                    <div class="stat-value">${accuracy}%</div>
                    <div class="stat-label">Точность</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${gameModeData.accuracy.streak}</div>
                    <div class="stat-label">Лучшая серия</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${gameModeData.accuracy.penaltyCount}</div>
                    <div class="stat-label">Штрафы</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${score}</div>
                    <div class="stat-label">Очки</div>
                </div>
            `;
            
            if (accuracy >= 95) {
                specialMessage.style.display = 'block';
                specialMessage.style.background = 'linear-gradient(135deg, #2ecc71, #27ae60)';
                specialMessage.innerHTML = '🎯 Идеальная точность! Вы - снайпер!';
            }
            break;
            
        case 'exam':
            resultsTitle.textContent = '📝 Результаты Экзамена';
            const examAccuracy = Math.round((gameModeData.exam.correctAnswers / gameModeData.exam.problemsTotal) * 100);
            const grade = examAccuracy >= 90 ? '5' : examAccuracy >= 75 ? '4' : examAccuracy >= 60 ? '3' : '2';
            
            resultsStats.innerHTML = `
                <div class="stat-item">
                    <div class="stat-value">${grade}</div>
                    <div class="stat-label">Оценка</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${examAccuracy}%</div>
                    <div class="stat-label">Правильных ответов</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${gameModeData.exam.correctAnswers}/${gameModeData.exam.problemsTotal}</div>
                    <div class="stat-label">Верно/Всего</div>
                </div>
                <div class="stat-item">
                    <div class="stat-value">${score}</div>
                    <div class="stat-label">Очки</div>
                </div>
            `;
            
            if (grade === '5') {
                specialMessage.style.display = 'block';
                specialMessage.style.background = 'linear-gradient(135deg, #3498db, #2980b9)';
                specialMessage.innerHTML = '🎓 Вы сдали экзамен на отлично!';
            }
            break;
    }
    
    document.getElementById('gameResultsModal').style.display = 'flex';
}
function backToMainMenu() {
        // ↓↓↓ ВСТАВЬ ССЫЛКУ НА ГЛАВНОЕ МЕНЮ ЗДЕСЬ ↓↓↓
        window.location.href = 'index.html';
        // ↑↑↑ ВСТАВЬ ССЫЛКУ НА ГЛАВНОЕ МЕНЮ ЗДЕСЬ ↑↑↑
        }
// Запускаем игру при загрузке
window.onload = newGame;