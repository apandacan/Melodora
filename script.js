let workDuration = 25 * 60;
let breakDuration = 5 * 60;
let originalWorkDuration = workDuration;
let originalBreakDuration = breakDuration;
let timerInterval = null;
let isRunning = false;
let isWorkTime = true;

const timerElement = document.getElementById('timer');
const timerLabel = document.getElementById('timer-label');
const startPauseButton = document.getElementById('start-pause');
const resetButton = document.getElementById('reset');
const applySettingsButton = document.getElementById('apply-settings');

let workPlayer, breakPlayer;

const beepSound = new Audio('beep.mp3'); // Short beep sound
const finalBeepSound = new Audio('final-beep.mp3'); // Final distinct beeper booper sound 

function formatTime(seconds) {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

function startTimer() {
    isRunning = true;
    if (isWorkTime) {
        breakPlayer.pauseVideo(); // Ensure break video is paused
        loopVideo(workPlayer);
        timerLabel.textContent = "Work Time";
    } else {
        workPlayer.pauseVideo(); // Ensure work video is paused
        loopVideo(breakPlayer);
        timerLabel.textContent = "Break Time";
    }

    timerInterval = setInterval(() => {
        if (isWorkTime) {
            handleBeeping(workDuration);
            workDuration--;
            if (workDuration <= 0) {
                clearInterval(timerInterval);
                isWorkTime = false;
                startBreak();
            }
        } else {
            handleBeeping(breakDuration);
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

function handleBeeping(duration) {
    if (duration === 4) {
        beepSound.play();
    } else if (duration === 3) {
        beepSound.play();
    } else if (duration === 2) {
        beepSound.play();
    } else if (duration === 1) {
        finalBeepSound.play();
    }
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
    workDuration = originalWorkDuration;
    breakDuration = originalBreakDuration;
    updateTimerDisplay();
    timerLabel.textContent = "Work Time";
    pauseTimer();
    startPauseButton.textContent = 'Start';
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
    originalWorkDuration = workDuration;
    originalBreakDuration = breakDuration;
    
    loadVideoPlayers(workVideoUrl, breakVideoUrl);
    updateTimerDisplay();
}

function loadVideoPlayers(workUrl, breakUrl) {
    if (workPlayer) workPlayer.destroy();
    if (breakPlayer) breakPlayer.destroy();

    workPlayer = new YT.Player('work-video', {
        videoId: extractVideoId(workUrl),
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
        }
    });

    breakPlayer = new YT.Player('break-video', {
        videoId: extractVideoId(breakUrl),
        events: {
            'onReady': onPlayerReady,
            'onStateChange': onPlayerStateChange
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

function onPlayerStateChange(event) {
    if (event.data === YT.PlayerState.ENDED) {
        loopVideo(event.target);
    }
}

function loopVideo(player) {
    player.seekTo(0);
    player.playVideo();
}

function startWork() {
    isWorkTime = true;
    workDuration = originalWorkDuration;
    timerLabel.textContent = "Work Time";
    startTimer();
}

function startBreak() {
    isWorkTime = false;
    breakDuration = originalBreakDuration;
    timerLabel.textContent = "Break Time";
    startTimer();
}

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