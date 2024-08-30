let workDuration = 25 * 60;
let breakDuration = 5 * 60;
let timerInterval = null;
let isRunning = false;
let isWorkTime = true;

const timerElement = document.getElementById('timer');
const timerLabel = document.getElementById('timer-label');
const startPauseButton = document.getElementById('start-pause');
const resetButton = document.getElementById('reset');
const applySettingsButton = document.getElementById('apply-settings');
const settingsButton = document.getElementById('settings-button');
const settingsPanel = document.getElementById('settings-panel');

let workPlayer, breakPlayer;

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startTimer() {
    isRunning = true;
    if (isWorkTime) {
        breakPlayer.pauseVideo(); // Ensure break video is paused
        workPlayer.playVideo();
        timerLabel.textContent = "Work Time";
    } else {
        workPlayer.pauseVideo(); // Ensure work video is paused
        breakPlayer.playVideo();
        timerLabel.textContent = "Break Time";
    }

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

function pauseTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    if (isWorkTime) {
        workPlayer.pauseVideo();
    } else {
        breakPlayer.pauseVideo();
    }
}

function resetTimer() {
    isRunning = false;
    clearInterval(timerInterval);
    isWorkTime = true;
    workDuration = parseInt(document.getElementById('work-duration').value) * 60;
    breakDuration = parseInt(document.getElementById('break-duration').value) * 60;
    updateTimerDisplay();
    timerLabel.textContent = "Work Time";
    pauseTimer();
}

function updateTimerDisplay() {
    const duration = isWorkTime ? workDuration : breakDuration;
    timerElement.textContent = formatTime(duration);
}

function applySettings() {
    const workVideoUrl = document.getElementById('work-video').value;
    const breakVideoUrl = document.getElementById('break-video').value;
    workDuration = parseInt(document.getElementById('work-duration').value) * 60;
    breakDuration = parseInt(document.getElementById('break-duration').value) * 60;
    
    loadVideoPlayers(workVideoUrl, breakVideoUrl);
    updateTimerDisplay();
}

function loadVideoPlayers(workUrl, breakUrl) {
    if (workPlayer) workPlayer.destroy();
    if (breakPlayer) breakPlayer.destroy();

    workPlayer = new YT.Player('work-video', {
        videoId: extractVideoId(workUrl),
        height: '150',
        width: '300',
        events: {
            'onReady': onPlayerReady
        }
    });

    breakPlayer = new YT.Player('break-video', {
        videoId: extractVideoId(breakUrl),
        height: '150',
        width: '300',
        events: {
            'onReady': onPlayerReady
        }
    });
}

function extractVideoId(url) {
    const urlParams = new URLSearchParams(new URL(url).search);
    return urlParams.get('v');
}

function onPlayerReady(event) {
    updateTimerDisplay();
}

function startWork() {
    isWorkTime = true;
    workDuration = parseInt(document.getElementById('work-duration').value) * 60;
    timerLabel.textContent = "Work Time";
    startTimer();
}

function startBreak() {
    isWorkTime = false;
    breakDuration = parseInt(document.getElementById('break-duration').value) * 60;
    timerLabel.textContent = "Break Time";
    startTimer();
}

settingsButton.addEventListener('click', () => {
    if (settingsPanel.classList.contains('open')) {
        settingsPanel.classList.remove('open');
    } else {
        settingsPanel.classList.add('open');
    }
});

startPauseButton.addEventListener('click', () => {
    if (isRunning) {
        pauseTimer();
        startPauseButton.textContent = 'Start';
    } else {
        startTimer();
        startPauseButton.textContent = 'Pause';
    }
});

resetButton.addEventListener('click', resetTimer);
applySettingsButton.addEventListener('click', applySettings);

window.onYouTubeIframeAPIReady = function() {
    applySettings();
};

timerElement.textContent = formatTime(workDuration);
