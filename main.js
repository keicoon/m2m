import { Peer } from "peerjs";

// --- Seeded Random Number Generator ---
function mulberry32(a) {
    return function() {
      var t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
}

// --- Translations ---
const translations = {
  en: {
    welcome: "Welcome to Premium Minesweeper",
    howToPlayTitle: "📖 How to Play",
    howToPlayDesc: "Minesweeper is a classic logic puzzle game. Your goal is to uncover all the safe squares without detonating any hidden mines.",
    rule1: "<strong>Left-Click:</strong> Reveal a square. If it's a mine, you lose!",
    rule2: "<strong>Right-Click (or Flag Mode):</strong> Place a flag 🚩 on squares you suspect are mines.",
    rule3: "<strong>Numbers:</strong> A number shows how many mines are hidden in the adjacent 8 squares. Use logic to figure out the safe spots!",
    multiModeTitle: "⚔️ Multiplayer (P2P) Mode",
    multiModeDesc: "Challenge a friend in real-time! In P2P mode, you both receive the exact same board. The first player to clear all safe squares wins. If you hit a mine, your opponent instantly wins!",
    multiModeNote: "* No server is used. You connect directly using a generated Connection ID.",
    startPlaying: "Start Playing",
    selectMode: "Select Game Mode",
    singlePlayer: "Single Player",
    multiPlayer: "Multiplayer (P2P)",
    selectDiff: "Select Difficulty",
    diffEasy: "Easy (9x9, 10 Mines)",
    diffMedium: "Medium (16x16, 40 Mines)",
    diffHard: "Hard (30x16, 99 Mines)",
    back: "Back",
    multiLobby: "Multiplayer Lobby",
    inviteDesc: "Invite an opponent via their ID (IP).",
    inviteBtn: "Invite",
    waiting: "Waiting...",
    waitingDesc: "Waiting for opponent to accept.",
    cancel: "Cancel",
    mines: "Mines",
    time: "Time",
    digMode: "Dig Mode",
    flagMode: "Flag Mode",
    quitGame: "Quit Game",
    inviteTitle: "Game Invitation",
    playerText: "Player",
    invitedYou: "has invited you to a game!",
    difficultyText: "Difficulty:",
    accept: "Accept",
    reject: "Reject",
    close: "Close",
    settings: "Settings",
    yourId: "Your ID (IP):"
  },
  ko: {
    welcome: "프리미엄 지뢰찾기에 오신 것을 환영합니다",
    howToPlayTitle: "📖 게임 방법",
    howToPlayDesc: "지뢰찾기는 클래식 논리 퍼즐 게임입니다. 숨겨진 지뢰를 건드리지 않고 모든 안전한 칸을 찾아내세요.",
    rule1: "<strong>좌클릭 (터치):</strong> 칸을 엽니다. 지뢰가 나오면 패배합니다!",
    rule2: "<strong>우클릭 (또는 깃발 모드):</strong> 지뢰로 의심되는 칸에 깃발 🚩을 꽂습니다.",
    rule3: "<strong>숫자 힌트:</strong> 주변 8칸에 숨겨진 지뢰의 개수를 알려줍니다. 논리를 발휘해보세요!",
    multiModeTitle: "⚔️ 대전 (P2P) 모드",
    multiModeDesc: "실시간으로 친구와 대전하세요! 완전히 동일한 보드로 대결합니다. 모든 안전한 칸을 먼저 열거나, 상대방이 지뢰를 밟으면 승리합니다!",
    multiModeNote: "* 서버를 거치지 않고 발급된 Connection ID를 통해 직접 연결됩니다.",
    startPlaying: "게임 시작",
    selectMode: "게임 모드 선택",
    singlePlayer: "싱글 플레이",
    multiPlayer: "대전 모드 (P2P)",
    selectDiff: "난이도 선택",
    diffEasy: "초급 (9x9, 지뢰 10개)",
    diffMedium: "중급 (16x16, 지뢰 40개)",
    diffHard: "고급 (30x16, 지뢰 99개)",
    back: "뒤로가기",
    multiLobby: "대전 로비",
    inviteDesc: "상대방의 ID (IP)를 입력하여 초대하세요.",
    inviteBtn: "초대하기",
    waiting: "대기 중...",
    waitingDesc: "상대방의 수락을 기다리고 있습니다.",
    cancel: "취소",
    mines: "지뢰",
    time: "시간",
    digMode: "파내기 모드",
    flagMode: "깃발 모드",
    quitGame: "게임 종료",
    inviteTitle: "게임 초대",
    playerText: "플레이어",
    invitedYou: "님이 대전을 요청했습니다!",
    difficultyText: "난이도:",
    accept: "수락",
    reject: "거절",
    close: "닫기",
    settings: "설정",
    yourId: "내 ID (IP):"
  }
};

// --- App State ---
const state = {
  mode: 'guide', 
  difficulty: null,
  isMultiplayer: false,
  
  // PeerJS
  peer: null,
  myId: null,
  connection: null, // Active P2P connection
  targetCode: null,
  
  seed: Math.floor(Math.random() * 1000000),
  gameStatus: 'idle', 
  opponentStatus: 'Playing', 
  
  // Board state
  board: [],
  rows: 9,
  cols: 9,
  mines: 10,
  minesLeft: 10,
  revealedCount: 0,
  timer: 0,
  timerInterval: null,
  
  // Settings & Mobile
  language: 'en',
  isMobileFlagMode: false
};

// --- Difficulty Configurations ---
const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 }
};

// --- DOM Elements ---
const els = {
  userInfoContainer: document.getElementById('user-info-container'),
  myCode: document.getElementById('my-code'),
  btnSettings: document.getElementById('btn-settings'),
  sections: {
    guide: document.getElementById('guide-section'),
    menu: document.getElementById('menu-section'),
    difficulty: document.getElementById('difficulty-section'),
    lobby: document.getElementById('lobby-section'),
    waiting: document.getElementById('waiting-section'),
    game: document.getElementById('game-section'),
  },
  btnEnterMenu: document.getElementById('btn-enter-menu'),
  btnSingle: document.getElementById('btn-single'),
  btnMulti: document.getElementById('btn-multi'),
  btnBackMenu: document.getElementById('btn-back-menu'),
  btnBackMulti: document.getElementById('btn-back-multi'),
  btnInvite: document.getElementById('btn-invite'),
  btnCancelInvite: document.getElementById('btn-cancel-invite'),
  inviteCodeInput: document.getElementById('invite-code-input'),
  btnLeaveGame: document.getElementById('btn-leave-game'),
  
  board: document.getElementById('board'),
  mineCount: document.getElementById('mine-count'),
  timer: document.getElementById('timer'),
  faceBtn: document.getElementById('face-btn'),
  btnMobileFlag: document.getElementById('btn-mobile-flag'),
  raceTrackContainer: document.getElementById('race-track-container'),
  myRacer: document.getElementById('my-racer'),
  oppRacer: document.getElementById('opp-racer'),
  modals: {
    invite: document.getElementById('invite-modal'),
    result: document.getElementById('result-modal'),
    settings: document.getElementById('settings-modal')
  },
  inviteFromCode: document.getElementById('invite-from-code'),
  inviteDifficulty: document.getElementById('invite-difficulty'),
  btnAcceptInvite: document.getElementById('btn-accept-invite'),
  btnRejectInvite: document.getElementById('btn-reject-invite'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  btnCloseResult: document.getElementById('btn-close-result'),
  btnCloseSettings: document.getElementById('btn-close-settings'),
  languageSelect: document.getElementById('language-select')
};

// --- PeerJS Connection ---
function initPeer() {
  // We use the default PeerJS free cloud server for signaling
  state.peer = new Peer();

  state.peer.on('open', (id) => {
    state.myId = id;
    els.myCode.textContent = id;
  });

  state.peer.on('error', (err) => {
    console.error(err);
    alert('P2P Connection Error: ' + err.type);
    showSection('menu');
  });

  // Handle incoming connections (When someone invites you)
  state.peer.on('connection', (conn) => {
    // If we are already in a game or waiting, we reject quietly or handle it
    if (state.mode !== 'menu' && state.mode !== 'lobby') {
       conn.on('open', () => {
         conn.send({ type: 'invite_rejected', reason: 'busy' });
         setTimeout(() => conn.close(), 500);
       });
       return;
    }

    state.connection = conn;
    setupConnectionHandlers(conn, false);
  });
}

function setupConnectionHandlers(conn, isHost) {
  conn.on('open', () => {
    if (isHost) {
      // Send invite
      conn.send({
        type: 'invite',
        from: state.myId,
        difficulty: state.difficulty
      });
    }
  });

  conn.on('data', (data) => {
    switch (data.type) {
      case 'invite':
        // Received invite (We are guest)
        state.difficulty = data.difficulty;
        els.inviteFromCode.textContent = data.from;
        els.inviteDifficulty.textContent = data.difficulty.toUpperCase();
        els.modals.invite.classList.remove('hidden');
        break;

      case 'invite_cancelled':
        els.modals.invite.classList.add('hidden');
        alert("The invitation was cancelled.");
        state.connection.close();
        state.connection = null;
        break;

      case 'invite_rejected':
        alert(data.reason === 'busy' ? "User is busy." : "Your invitation was rejected.");
        state.connection.close();
        state.connection = null;
        showSection('lobby');
        break;

      case 'invite_accepted':
        // Host receives acceptance
        if (isHost && state.mode === 'waiting') {
          state.seed = Math.floor(Math.random() * 1000000);
          state.isMultiplayer = true;
          // Start game locally and notify opponent
          conn.send({ type: 'game_start', seed: state.seed });
          startGame(state.difficulty, state.seed);
        }
        break;

      case 'game_start':
        // Guest receives game start
        els.modals.invite.classList.add('hidden');
        state.seed = data.seed;
        state.isMultiplayer = true;
        startGame(state.difficulty, state.seed);
        break;

      case 'progress':
        if (state.gameStatus === 'playing') {
          const totalSafe = (state.rows * state.cols) - state.mines;
          const pct = Math.min((data.count / totalSafe) * 100, 100);
          els.oppRacer.style.width = pct + '%';
        }
        break;

      case 'game_event':
        // Received opponent game progress
        if (data.status === 'win') {
          els.oppRacer.style.width = '100%';
          if (state.gameStatus === 'playing') {
            endGame(false, "Opponent finished first!");
          }
        } else if (data.status === 'lose') {
          if (state.gameStatus === 'playing') {
            endGame(true, "Opponent hit a mine! You Win!");
          }
        }
        break;
      
      case 'leave_game':
        if (state.gameStatus === 'playing') {
          endGame(true, "Opponent disconnected or left. You Win!");
        }
        break;
    }
  });

  conn.on('close', () => {
    if (state.gameStatus === 'playing') {
      endGame(true, "Opponent disconnected. You Win!");
    }
    state.connection = null;
  });
}

// --- UI Updates & i18n ---
function updateLanguage() {
  const dict = translations[state.language];
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    if (dict[key]) {
      el.innerHTML = dict[key];
    }
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    const key = el.getAttribute('data-i18n-placeholder');
    // Using simple text mapping for placeholders if they exist in dictionary,
    // actually we didn't add opponentId to dict, let's just do it inline
    if (key === 'opponentId') {
      el.placeholder = state.language === 'en' ? "Opponent's ID" : "상대방의 ID";
    }
  });
  
  // Update mobile flag button text
  if (state.isMobileFlagMode) {
    els.btnMobileFlag.innerHTML = `🚩 <span data-i18n="flagMode">${dict.flagMode}</span>`;
  } else {
    els.btnMobileFlag.innerHTML = `👆 ⛏️ <span data-i18n="digMode">${dict.digMode}</span>`;
  }
}

// --- Navigation ---
function showSection(secName) {
  Object.values(els.sections).forEach(sec => sec.classList.remove('active-section'));
  Object.values(els.sections).forEach(sec => sec.classList.add('hidden-section'));
  els.sections[secName].classList.remove('hidden-section');
  els.sections[secName].classList.add('active-section');
  state.mode = secName;

  // Toggle user-info visibility
  if (secName === 'lobby' || secName === 'waiting' || (secName === 'game' && state.isMultiplayer)) {
    els.userInfoContainer.classList.remove('hidden-element');
  } else {
    els.userInfoContainer.classList.add('hidden-element');
  }
}

// --- Event Listeners ---
els.btnEnterMenu.addEventListener('click', () => {
  showSection('menu');
});

els.btnSingle.addEventListener('click', () => {
  state.isMultiplayer = false;
  showSection('difficulty');
});

els.btnMulti.addEventListener('click', () => {
  state.isMultiplayer = true;
  showSection('lobby');
});

els.btnBackMenu.addEventListener('click', () => showSection('menu'));
els.btnBackMulti.addEventListener('click', () => showSection('menu'));

els.btnInvite.addEventListener('click', () => {
  const code = els.inviteCodeInput.value.trim();
  if (code.length > 0) {
    state.targetCode = code;
    showSection('difficulty');
  } else {
    alert("Please enter a valid IP / ID.");
  }
});

document.querySelectorAll('.btn-diff').forEach(btn => {
  btn.addEventListener('click', (e) => {
    const diff = e.target.dataset.diff;
    if (state.mode === 'difficulty' && state.isMultiplayer) {
      // Host selected difficulty, now establish P2P
      state.difficulty = diff;
      showSection('waiting');
      state.connection = state.peer.connect(state.targetCode);
      setupConnectionHandlers(state.connection, true);
    } else {
      // Single player
      state.isMultiplayer = false;
      state.seed = Math.floor(Math.random() * 1000000);
      startGame(diff, state.seed);
    }
  });
});

els.btnCancelInvite.addEventListener('click', () => {
  if (state.connection) {
    state.connection.send({ type: 'invite_cancelled' });
    setTimeout(() => {
      state.connection.close();
      state.connection = null;
    }, 100);
  }
  showSection('lobby');
});

els.btnAcceptInvite.addEventListener('click', () => {
  if (state.connection) {
    state.connection.send({ type: 'invite_accepted' });
    els.modals.invite.classList.add('hidden');
  }
});

els.btnRejectInvite.addEventListener('click', () => {
  if (state.connection) {
    state.connection.send({ type: 'invite_rejected', reason: 'declined' });
    setTimeout(() => {
      state.connection.close();
      state.connection = null;
    }, 100);
  }
  els.modals.invite.classList.add('hidden');
});

els.btnCloseResult.addEventListener('click', () => {
  els.modals.result.classList.add('hidden');
  if (state.connection) {
    state.connection.close();
    state.connection = null;
  }
  showSection('menu');
});

els.btnLeaveGame.addEventListener('click', () => {
  if (state.isMultiplayer && state.connection) {
    state.connection.send({ type: 'leave_game' });
    setTimeout(() => {
      state.connection.close();
      state.connection = null;
    }, 100);
  }
  stopTimer();
  showSection('menu');
});

els.faceBtn.addEventListener('click', () => {
  if (state.gameStatus !== 'idle') {
    if (state.isMultiplayer) {
      alert("In multiplayer, you cannot restart the same game. Please quit and invite again.");
      if (state.connection) {
        state.connection.send({ type: 'leave_game' });
        setTimeout(() => state.connection.close(), 100);
        state.connection = null;
      }
      showSection('menu');
    } else {
      startGame(state.difficulty, Math.floor(Math.random() * 1000000));
    }
  }
});

els.btnSettings.addEventListener('click', () => {
  els.modals.settings.classList.remove('hidden');
});

els.btnCloseSettings.addEventListener('click', () => {
  els.modals.settings.classList.add('hidden');
});

els.languageSelect.addEventListener('change', (e) => {
  state.language = e.target.value;
  updateLanguage();
});

els.btnMobileFlag.addEventListener('click', () => {
  state.isMobileFlagMode = !state.isMobileFlagMode;
  els.btnMobileFlag.classList.toggle('flag-mode', state.isMobileFlagMode);
  updateLanguage(); // to refresh the text inside the button
});

// --- Game Logic ---
function startGame(difficulty, seed) {
  const config = DIFFICULTIES[difficulty];
  state.difficulty = difficulty;
  state.rows = config.rows;
  state.cols = config.cols;
  state.mines = config.mines;
  state.minesLeft = config.mines;
  state.revealedCount = 0;
  state.gameStatus = 'playing';
  state.timer = 0;
  
  els.mineCount.textContent = state.minesLeft;
  els.timer.textContent = state.timer;
  els.faceBtn.textContent = '😊';
  els.board.style.gridTemplateColumns = `repeat(${state.cols}, 32px)`;
  
  els.myRacer.style.width = '0%';
  els.oppRacer.style.width = '0%';
  
  if (state.isMultiplayer) {
    els.raceTrackContainer.classList.remove('hidden');
  } else {
    els.raceTrackContainer.classList.add('hidden');
  }

  showSection('game');
  generateBoard(seed);
  startTimer();
}

function generateBoard(seed) {
  const rng = mulberry32(seed);
  state.board = [];
  els.board.innerHTML = '';
  
  // Create empty cells
  for (let r = 0; r < state.rows; r++) {
    const row = [];
    for (let c = 0; c < state.cols; c++) {
      row.push({
        r, c,
        isMine: false,
        isRevealed: false,
        isFlagged: false,
        neighborMines: 0,
        element: null
      });
    }
    state.board.push(row);
  }

  // Place mines
  let minesPlaced = 0;
  while (minesPlaced < state.mines) {
    const r = Math.floor(rng() * state.rows);
    const c = Math.floor(rng() * state.cols);
    if (!state.board[r][c].isMine) {
      state.board[r][c].isMine = true;
      minesPlaced++;
    }
  }

  // Calculate neighbors
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      if (!state.board[r][c].isMine) {
        let count = 0;
        for (let dr = -1; dr <= 1; dr++) {
          for (let dc = -1; dc <= 1; dc++) {
            const nr = r + dr;
            const nc = c + dc;
            if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
              if (state.board[nr][nc].isMine) count++;
            }
          }
        }
        state.board[r][c].neighborMines = count;
      }
    }
  }

  // Render DOM
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = document.createElement('div');
      cell.classList.add('cell');
      cell.dataset.r = r;
      cell.dataset.c = c;
      
      cell.addEventListener('mousedown', handleCellClick);
      cell.addEventListener('contextmenu', (e) => e.preventDefault());
      
      state.board[r][c].element = cell;
      els.board.appendChild(cell);
    }
  }
}

function handleCellClick(e) {
  if (state.gameStatus !== 'playing') return;
  const r = parseInt(e.target.dataset.r);
  const c = parseInt(e.target.dataset.c);
  const cellData = state.board[r][c];

  if (e.button === 0 && !state.isMobileFlagMode) {
    // Left click or mobile tap in Dig Mode
    if (!cellData.isFlagged && !cellData.isRevealed) {
      revealCell(r, c);
      checkWinCondition();
    }
  } else if (e.button === 2 || state.isMobileFlagMode) {
    // Right click or mobile tap in Flag Mode
    e.preventDefault();
    if (!cellData.isRevealed) {
      toggleFlag(r, c);
    }
  }
}

function revealCell(r, c) {
  const cellData = state.board[r][c];
  if (cellData.isRevealed || cellData.isFlagged) return;

  cellData.isRevealed = true;
  cellData.element.classList.add('revealed');
  state.revealedCount++;

  if (state.isMultiplayer && state.connection && state.connection.open) {
    state.connection.send({ type: 'progress', count: state.revealedCount });
  }

  // Update own progress bar
  if (state.isMultiplayer) {
    const totalSafe = (state.rows * state.cols) - state.mines;
    const pct = Math.min((state.revealedCount / totalSafe) * 100, 100);
    els.myRacer.style.width = pct + '%';
  }

  if (cellData.isMine) {
    // Game Over
    cellData.element.classList.add('mine-hit');
    cellData.element.textContent = '💣';
    endGame(false, "You hit a mine!");
    revealAllMines();
    return;
  }

  if (cellData.neighborMines > 0) {
    cellData.element.textContent = cellData.neighborMines;
    cellData.element.classList.add(`n${cellData.neighborMines}`);
  } else {
    // Cascade
    for (let dr = -1; dr <= 1; dr++) {
      for (let dc = -1; dc <= 1; dc++) {
        const nr = r + dr;
        const nc = c + dc;
        if (nr >= 0 && nr < state.rows && nc >= 0 && nc < state.cols) {
          revealCell(nr, nc);
        }
      }
    }
  }
}

function toggleFlag(r, c) {
  const cellData = state.board[r][c];
  if (cellData.isFlagged) {
    cellData.isFlagged = false;
    cellData.element.textContent = '';
    state.minesLeft++;
  } else {
    if (state.minesLeft > 0) {
      cellData.isFlagged = true;
      cellData.element.textContent = '🚩';
      state.minesLeft--;
    }
  }
  els.mineCount.textContent = state.minesLeft;
}

function revealAllMines() {
  for (let r = 0; r < state.rows; r++) {
    for (let c = 0; c < state.cols; c++) {
      const cell = state.board[r][c];
      if (cell.isMine && !cell.isFlagged) {
        cell.element.classList.add('revealed', 'mine');
        cell.element.textContent = '💣';
      } else if (!cell.isMine && cell.isFlagged) {
        cell.element.textContent = '❌'; 
      }
    }
  }
}

function checkWinCondition() {
  const nonMines = (state.rows * state.cols) - state.mines;
  if (state.revealedCount === nonMines) {
    endGame(true, "You cleared the board!");
  }
}

function endGame(isWin, message) {
  state.gameStatus = isWin ? 'won' : 'lost';
  stopTimer();
  els.faceBtn.textContent = isWin ? '😎' : '😵';

  if (state.isMultiplayer && state.connection && state.connection.open) {
    state.connection.send({ type: 'game_event', status: isWin ? 'win' : 'lose' });
  }

  setTimeout(() => {
    els.resultTitle.textContent = isWin ? "Victory!" : "Defeat!";
    els.resultTitle.style.color = isWin ? "#34d399" : "#f87171";
    els.resultMessage.textContent = message;
    els.modals.result.classList.remove('hidden');
  }, 1000);
}

// --- Timer ---
function startTimer() {
  stopTimer();
  state.timerInterval = setInterval(() => {
    state.timer++;
    els.timer.textContent = state.timer;
  }, 1000);
}

function stopTimer() {
  if (state.timerInterval) {
    clearInterval(state.timerInterval);
    state.timerInterval = null;
  }
}

// --- Init ---
updateLanguage();
initPeer();
