/**
 * Telegram Mini App - Main Logic (app.js)
 */

const tg = window.Telegram.WebApp;
tg.expand();

// Ilova holati (State)
let appState = {
    currentView: 'dashboard',
    questions: [],
    currentQuestionIndex: 0,
    userAnswers: {},
    timer: null,
    timeLeft: 900,
    user: null
};

// DOM elementlari
const views = {
    dashboard: document.getElementById('dashboard-view'),
    quiz: document.getElementById('quiz-view')
};

const elements = {
    startBtn: document.getElementById('start-test-btn'),
    stopBtn: document.getElementById('stop-quiz-btn'),
    timerDisplay: document.getElementById('timer'),
    pagination: document.getElementById('pagination'),
    questionText: document.getElementById('question-text'),
    optionsContainer: document.getElementById('options-container'),
    prevBtn: document.getElementById('prev-btn'),
    nextBtn: document.getElementById('next-btn'),
    leaderboardContainer: document.querySelector('#dashboard-view .space-y-3'),
    testsListContainer: document.getElementById('tests-list-container'),
    userGreeting: document.getElementById('user-greeting'),
    userScore: document.getElementById('user-score'),
    userTests: document.getElementById('user-tests'),
    resultModal: document.getElementById('result-modal'),
    modalScore: document.getElementById('modal-score'),
    modalCorrect: document.getElementById('modal-correct'),
    modalWrong: document.getElementById('modal-wrong'),
    modalUnanswered: document.getElementById('modal-unanswered'),
    resultAdvice: document.getElementById('result-advice'),
    closeModalBtn: document.getElementById('close-modal-btn')
};

/**
 * Ilovani ishga tushirish
 */
async function initApp() {
    // Hodisalarni biriktirish
    elements.prevBtn.addEventListener('click', () => navigate(-1));
    elements.nextBtn.addEventListener('click', () => navigate(1));
    elements.stopBtn.addEventListener('click', () => {
        if (confirm("Testni to'xtatmoqchimisiz?")) switchView('dashboard');
    });
    elements.closeModalBtn.addEventListener('click', () => {
        elements.resultModal.classList.add('hidden');
        switchView('dashboard');
    });

    // Ma'lumotlarni yuklash
    await authUser();
    await loadTests();
    await loadLeaderboard();
}

/**
 * Foydalanuvchini autentifikatsiya qilish
 */
async function authUser() {
    const telegramUser = tg.initDataUnsafe.user;
    if (!telegramUser) {
        appState.user = { id: 12345, first_name: "Mehmon", score: 0, completedTests: 0 };
    } else {
        if (window.firebaseDB) {
            let user = await window.firebaseDB.getUser(telegramUser.id);
            if (!user) {
                user = {
                    id: telegramUser.id,
                    first_name: telegramUser.first_name,
                    username: telegramUser.username || '',
                    score: 0,
                    completedTests: 0,
                    createdAt: new Date().toISOString()
                };
                await window.firebaseDB.saveUser(telegramUser.id, user);
            }
            appState.user = user;
        }
    }
    updateUserUI();
}

/**
 * Reytingni yuklash (Leaderboard)
 */
async function loadLeaderboard() {
    if (!window.firebaseDB || !elements.leaderboardContainer) return;
    try {
        const leaderboardData = await window.firebaseDB.getLeaderboard();
        elements.leaderboardContainer.innerHTML = '';

        leaderboardData.forEach((item, index) => {
            const isMe = item.id === appState.user?.id;
            const rankClass = index === 0 ? 'text-yellow-400' : index === 1 ? 'text-slate-300' : index === 2 ? 'text-orange-400' : 'text-slate-500';

            const itemHtml = `
                <div class="glass p-4 rounded-[1.5rem] flex items-center justify-between transition-all ${isMe ? 'border-accent/30 bg-accent/10 scale-[1.02]' : 'border-transparent'}">
                    <div class="flex items-center space-x-4">
                        <span class="${rankClass} text-base font-black w-5 text-center">${index + 1}</span>
                        <div class="w-10 h-10 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-xs font-bold text-slate-300">
                            ${item.name.charAt(0).toUpperCase()}
                        </div>
                        <span class="font-bold text-sm ${isMe ? 'text-white' : 'text-slate-200'}">${item.name} ${isMe ? '(Siz)' : ''}</span>
                    </div>
                    <div class="text-right">
                        <span class="text-accent font-black text-sm uppercase tracking-tighter">${item.score.toLocaleString()}</span>
                        <p class="text-[8px] text-slate-500 font-bold uppercase tracking-widest">Ball</p>
                    </div>
                </div>
            `;
            elements.leaderboardContainer.insertAdjacentHTML('beforeend', itemHtml);
        });
    } catch (e) { console.error("Leaderboard error:", e); }
}

/**
 * Testlar ro'yxatini yuklash
 */
async function loadTests() {
    if (!window.firebaseDB || !elements.testsListContainer) return;
    try {
        const tests = await window.firebaseDB.getTestsList();
        elements.testsListContainer.innerHTML = '';

        if (tests.length > 0) {
            tests.forEach(test => {
                const testCard = document.createElement('div');
                testCard.className = 'glass p-6 rounded-[2rem] flex flex-col space-y-4 border-transparent border-2 hover:border-accent/20 transition-all active:scale-95 group';
                testCard.innerHTML = `
                    <div class="space-y-1">
                        <h3 class="font-black text-lg text-white group-hover:text-accent transition-colors">${test.title}</h3>
                        <p class="text-slate-400 text-xs">${test.questionsCount} ta savol • ${test.duration} daqiqa</p>
                    </div>
                    <button class="w-full bg-white/5 border border-white/10 text-white text-xs font-bold py-3 rounded-2xl hover:bg-emerald-500 transition-all">Boshlash</button>
                `;
                testCard.querySelector('button').onclick = () => checkPasswordAndStart(test.id);
                elements.testsListContainer.appendChild(testCard);
            });
        }
    } catch (e) { console.error(e); }
}

/**
 * Parolni tekshirish
 */
async function checkPasswordAndStart(testId) {
    const userPass = prompt("Test uchun 5 xonali kodni kiriting:");
    if (!userPass) return;

    try {
        const correctPass = await window.firebaseDB.getQuizPassword(testId);
        if (userPass === correctPass) {
            startQuiz(testId);
        } else {
            alert("Kod noto'g'ri!");
        }
    } catch (e) { alert("Xatolik yuz berdi!"); }
}

/**
 * Testni boshlash
 */
async function startQuiz(testId) {
    try {
        const docRef = window.firebaseDB.doc(window.firebaseDB.db, "quizzes", testId);
        const docSnap = await window.firebaseDB.getDoc(docRef);
        const quizData = docSnap.data();

        appState.questions = quizData.questions;
        appState.timeLeft = quizData.duration * 60;
        appState.currentQuestionIndex = 0;
        appState.userAnswers = {};

        switchView('quiz');
        renderQuestion();
        renderPagination();
        startTimer();
    } catch (e) { console.error(e); }
}

function renderQuestion() {
    const qIndex = appState.currentQuestionIndex;
    const question = appState.questions[qIndex];

    elements.questionText.innerHTML = `${qIndex + 1}. ${question.text}`;
    elements.optionsContainer.innerHTML = '';

    question.options.forEach((option, idx) => {
        const isSelected = appState.userAnswers[qIndex] === idx;
        const btn = document.createElement('button');
        btn.className = `option-btn glass p-4 rounded-2xl text-left flex items-center space-x-4 transition-all ${isSelected ? 'selected border-accent bg-accent/5' : ''}`;
        btn.innerHTML = `
            <span class="w-8 h-8 rounded-lg bg-dark flex items-center justify-center text-accent font-bold">${String.fromCharCode(65 + idx)}</span>
            <div class="option-text flex-1">${option}</div>
        `;
        btn.onclick = () => {
            appState.userAnswers[qIndex] = idx;
            renderQuestion();
            renderPagination();
        };
        elements.optionsContainer.appendChild(btn);
    });

    elements.prevBtn.disabled = qIndex === 0;
    elements.nextBtn.querySelector('span').textContent =
        qIndex === appState.questions.length - 1 ? 'Tugatish' : 'Keyingisi';
}

function renderPagination() {
    elements.pagination.innerHTML = '';
    appState.questions.forEach((_, idx) => {
        const isCurrent = appState.currentQuestionIndex === idx;
        const isAnswered = appState.userAnswers[idx] !== undefined;
        const dot = document.createElement('button');
        dot.className = `min-w-[40px] h-10 rounded-xl font-bold transition-all ${isCurrent ? 'bg-accent text-white scale-110' : isAnswered ? 'bg-accent/20 text-accent' : 'bg-white/5 text-gray-400'}`;
        dot.textContent = idx + 1;
        dot.onclick = () => { appState.currentQuestionIndex = idx; renderQuestion(); renderPagination(); };
        elements.pagination.appendChild(dot);
    });
}

function startTimer() {
    if (appState.timer) clearInterval(appState.timer);
    appState.timer = setInterval(() => {
        appState.timeLeft--;
        const min = Math.floor(appState.timeLeft / 60);
        const sec = appState.timeLeft % 60;
        elements.timerDisplay.textContent = `${String(min).padStart(2, '0')}:${String(sec).padStart(2, '0')}`;
        if (appState.timeLeft <= 0) finishQuiz();
    }, 1000);
}

async function finishQuiz() {
    clearInterval(appState.timer);
    let correct = 0;
    appState.questions.forEach((q, i) => {
        if (appState.userAnswers[i] === q.correct) correct++;
    });

    const totalQuestions = appState.questions.length;
    const score = correct * 2;

    elements.modalScore.textContent = `${score}/${totalQuestions * 2}`;
    elements.modalCorrect.textContent = correct;
    elements.modalWrong.textContent = totalQuestions - correct - (totalQuestions - Object.keys(appState.userAnswers).length);
    elements.modalUnanswered.textContent = totalQuestions - Object.keys(appState.userAnswers).length;

    elements.resultModal.classList.remove('hidden');

    if (appState.user) {
        const updated = {
            ...appState.user,
            score: (appState.user.score || 0) + score,
            completedTests: (appState.user.completedTests || 0) + 1
        };
        await window.firebaseDB.saveUser(appState.user.id, updated);
        appState.user = updated;
        updateUserUI();
        loadLeaderboard();
    }
}

function navigate(dir) {
    const next = appState.currentQuestionIndex + dir;
    if (next >= 0 && next < appState.questions.length) {
        appState.currentQuestionIndex = next;
        renderQuestion();
        renderPagination();
    } else if (next === appState.questions.length) {
        finishQuiz();
    }
}

function switchView(view) {
    views.dashboard.classList.toggle('hidden', view !== 'dashboard');
    views.quiz.classList.toggle('hidden', view !== 'quiz');
    if (view === 'dashboard') clearInterval(appState.timer);
}

function updateUserUI() {
    elements.userGreeting.textContent = `Salom, ${appState.user.first_name}!`;
    elements.userScore.textContent = appState.user.score.toLocaleString();
    elements.userTests.textContent = appState.user.completedTests;
}

initApp();