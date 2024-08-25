let workDuration = 25 * 60; // Work duration in seconds
let breakDuration = 5 * 60; // Break duration in seconds
let timerInterval = null;
let isRunning = false;
let isWorkTime = true;

const timerElement = document.getElementById('timer-display');
const timerLabel = document.getElementById('timer-label');
const startPauseButton = document.getElementById('start-pause');
const resetButton = document.getElementById('reset');
const applySettingsButton = document.getElementById('apply-settings');
const optionsButton = document.getElementById('options-button');
const settingsPanel = document.getElementById('settings-panel');

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startTimer() {
    isRunning = true;
    timerInterval = setInterval(() => {
        if (isWorkTime) {
            workDuration--;
            if (workDuration <= 0) {
                clearInterval(timerInterval);
                isWorkTime = false;
                startBreak();
            }
        } else {
            breakDuration--;
            if (breakDuration <= 0) {
                clearInterval(timerInterval);
                isWorkTime = true;
                startWork();
            }
        }
        updateTimerDisplay();
    }, 1000);
}

function startBreak() {
    timerLabel.textContent = "Break Time";
    breakDuration = parseInt(document.getElementById('break-duration').value) * 60;
    startTimer();
}

function startWork() {
    timerLabel.textContent = "Work Time";
    workDuration = parseInt(document.getElementById('work-duration').value) * 60;
    startTimer();
}

function pauseTimer() {
    clearInterval(timerInterval);
    isRunning = false;
}

function resetTimer() {
    clearInterval(timerInterval);
    isRunning = false;
    isWorkTime = true;
    workDuration = parseInt(document.getElementById('work-duration').value) * 60;
    breakDuration = parseInt(document.getElementById('break-duration').value) * 60;
    timerLabel.textContent = "Work Time";
    updateTimerDisplay();
}

function updateTimerDisplay() {
    const duration = isWorkTime ? workDuration : breakDuration;
    timerElement.textContent = formatTime(duration);
}

applySettingsButton.addEventListener('click', resetTimer);

startPauseButton.addEventListener('click', () => {
    if (isRunning) {
        pauseTimer();
        startPauseButton.textContent = 'Start';
    } else {
        startWork();
        startPauseButton.textContent = 'Pause';
    }
});

resetButton.addEventListener('click', resetTimer);

optionsButton.addEventListener('click', () => {
    settingsPanel.classList.toggle('open');
});

resetTimer(); // Initialize display
