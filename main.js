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
  timerInterval: null
};

// --- Difficulty Configurations ---
const DIFFICULTIES = {
  easy: { rows: 9, cols: 9, mines: 10 },
  medium: { rows: 16, cols: 16, mines: 40 },
  hard: { rows: 16, cols: 30, mines: 99 }
};

// --- DOM Elements ---
const els = {
  myCode: document.getElementById('my-code'),
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
  raceTrackContainer: document.getElementById('race-track-container'),
  myRacer: document.getElementById('my-racer'),
  oppRacer: document.getElementById('opp-racer'),
  modals: {
    invite: document.getElementById('invite-modal'),
    result: document.getElementById('result-modal')
  },
  inviteFromCode: document.getElementById('invite-from-code'),
  inviteDifficulty: document.getElementById('invite-difficulty'),
  btnAcceptInvite: document.getElementById('btn-accept-invite'),
  btnRejectInvite: document.getElementById('btn-reject-invite'),
  resultTitle: document.getElementById('result-title'),
  resultMessage: document.getElementById('result-message'),
  btnCloseResult: document.getElementById('btn-close-result')
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

// --- Navigation ---
function showSection(secName) {
  Object.values(els.sections).forEach(sec => sec.classList.remove('active-section'));
  Object.values(els.sections).forEach(sec => sec.classList.add('hidden-section'));
  els.sections[secName].classList.remove('hidden-section');
  els.sections[secName].classList.add('active-section');
  state.mode = secName;
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

  if (e.button === 0) {
    // Left click
    if (!cellData.isFlagged && !cellData.isRevealed) {
      revealCell(r, c);
      checkWinCondition();
    }
  } else if (e.button === 2) {
    // Right click
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
initPeer();
