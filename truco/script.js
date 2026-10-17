/* =========================================================
   ESTADO Y VARIABLES PRINCIPALES (CON SOPORTE DE IMÁGENES)
========================================================= */

let mode = "cpu";

const suits = [
  { id: "espada", name: "canidos", symbol: "🐶" },
  { id: "basto", name: "felinos", symbol: "🐱" },
  { id: "oro", name: "aves", symbol: "🦅" },
  { id: "copa", name: "peces", symbol: "🐠" }
];

const ranks = [1, 2, 3, 4, 5, 6, 7, 10, 11, 12];

const animalNames = {
  espada: {
    1: "Rottweiler", 2: "Coyote", 3: "Lobo Ártico", 4: "Perro Salchicha", 5: "Murciélago", 6: "Zorro", 7: "Dogo", 10: "Poodle", 11: "Tanuki", 12: "Zorro Gris",
    "muestra_12": "Lobo Africano", "muestra_11": "Lobo Rojizo", "muestra_5": "Cuón", "muestra_4": "Licaón", "muestra_2": "Lobo Gris"
  },
  basto: {
    1: "Leopardo", 2: "Yaguareté", 3: "Puma", 4: "Gato Pallas", 5: "Gato Montés", 6: "Ocelote", 7: "Serval", 10: "Margay", 11: "Caracal", 12: "Lince Ibérico",
    "muestra_12": "León Blanco", "muestra_11": "Jaguar", "muestra_5": "Guepardo", "muestra_4": "Tigre", "muestra_2": "León Africano"
  },
  oro: {
    1: "Gaviota", 2: "Búho Nival", 3: "Pingüino", 4: "Quebrantahuesos", 5: "Ñandú", 6: "Cerceta", 7: "Águila Real", 10: "Cuervo", 11: "Harpía", 12: "Halcón",
    "muestra_12": "Ave del Paraíso", "muestra_11": "Avestruz", "muestra_5": "Cóndor", "muestra_4": "Albatros", "muestra_2": "Águila Calva"
  },
  copa: {
    1: "Barracuda", 2: "Atún", 3: "Caballito Mar", 4: "Pez Payaso", 5: "Morena", 6: "Boga", 7: "Piraña", 10: "Pez Napoleón", 11: "Anguila Eléc.", 12: "Pez Martillo",
    "muestra_12": "Raya Gigante", "muestra_11": "Mero Gigante", "muestra_5": "Pez León", "muestra_4": "Salmón", "muestra_2": "Gran Tiburón"
  }
};

let deck = [];
let hands = [[], []];
let initialHands = [[], []];
let scores = [0, 0];
let muestraCard = null;

let currentPlayer = 0;
let mano = 0;

let trick = [];
let tricksWon = [0, 0];
let trickWinners = [];

let trucoLevel = 1;
let lastTrucoCaller = null;
let pendingTruco = null;

let envidoState = "available";
let envidoChain = [];
let pendingEnvido = null;

let declaredEnvido = [null, null];
let envidoWinner = null;
let envidoPointsStaked = 0;
let envidoPointsAwarded = 0;
let envidoAwardedTo = null;

let florState = "none";
let florInHand = [false, false];
let florCalled = [false, false];
let envidoCancelledByFlor = false;

let roundActive = false;
let gameOver = false;
let logLines = [];

let turnTimer = null;
let timeLeft = 30;
const TURN_DURATION = 30;
let timerPlayer = null;

let isProcessingCard = false;
let cpuDelayForNextTurn = 600;
let reclamoTimer = null;

/* =========================================================
   AUDIO
========================================================= */

let audioContext = null;

function sound(type) {
  try {
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioContext.state === "suspended") audioContext.resume();

    const osc = audioContext.createOscillator();
    const gain = audioContext.createGain();

    osc.connect(gain);
    gain.connect(audioContext.destination);

    let freq = 440;
    if (type === "card") freq = 520;
    if (type === "truco") freq = 190;
    if (type === "win") freq = 760;
    if (type === "lose") freq = 180;
    if (type === "envido" || type === "flor") freq = 350;

    osc.frequency.value = freq;
    osc.type = "sine";

    gain.gain.setValueAtTime(0.0001, audioContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.12, audioContext.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, audioContext.currentTime + 0.18);

    osc.start();
    osc.stop(audioContext.currentTime + 0.2);
  } catch (e) {}
}

/* =========================================================
   MAZO Y LÓGICA DE PIEZAS
========================================================= */

function createDeck() {
  deck = [];
  for (const suit of suits) {
    for (const rank of ranks) {
      deck.push({
        rank,
        suit: suit.id,
        suitName: suit.name,
        symbol: suit.symbol
      });
    }
  }
  shuffle(deck);
}

function shuffle(a) {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
}

function getPiezaInfo(card) {
  if (!muestraCard || card.suit !== muestraCard.suit) return null;

  let effectiveRank = card.rank;
  const targetRanks = [2, 4, 5, 11, 10];

  if (targetRanks.includes(muestraCard.rank)) {
    if (card.rank === 12) {
      effectiveRank = muestraCard.rank;
    } else if (card.rank === muestraCard.rank) {
      return null;
    }
  }

  if (effectiveRank === 2) return { name: "2 de la Muestra", envidoVal: 30, power: 20 };
  if (effectiveRank === 4) return { name: "4 de la Muestra", envidoVal: 29, power: 19 };
  if (effectiveRank === 5) return { name: "5 de la Muestra", envidoVal: 28, power: 18 };
  if (effectiveRank === 11) return { name: "11 de la Muestra", envidoVal: 27, power: 17 };
  if (effectiveRank === 10) return { name: "10 de la Muestra", envidoVal: 27, power: 16 };

  return null;
}

function getCardDisplayName(card) {
  const pieza = getPiezaInfo(card);
  if (pieza) {
    let effectiveRank = card.rank === 12 ? muestraCard.rank : card.rank;
    const key = `muestra_${effectiveRank}`;
    if (animalNames[card.suit] && animalNames[card.suit][key]) {
      return animalNames[card.suit][key];
    }
  }
  return (animalNames[card.suit] && animalNames[card.suit][card.rank]) || `${card.rank}`;
}

function getCardImagePath(card) {
  const pieza = getPiezaInfo(card);
  let baseName = `${card.suit}_${card.rank}`;
  if (pieza) {
    let effectiveRank = card.rank === 12 ? muestraCard.rank : card.rank;
    baseName = `${card.suit}_muestra_${effectiveRank}`;
  }
  // Buscará el archivo png en la carpeta assets/ (ej: assets/espada_1.png)
  return `assets/${baseName}.png`;
}

function power(card) {
  const pieza = getPiezaInfo(card);
  if (pieza) return pieza.power;

  if (card.rank === 1 && card.suit === "espada") return 14;
  if (card.rank === 1 && card.suit === "basto") return 13;
  if (card.rank === 7 && card.suit === "espada") return 12;
  if (card.rank === 7 && card.suit === "oro") return 11;
  if (card.rank === 3) return 10;
  if (card.rank === 2) return 9;
  if (card.rank === 1) return 8;
  if (card.rank === 12) return 7;
  if (card.rank === 11) return 6;
  if (card.rank === 10) return 5;
  if (card.rank === 7) return 4;
  if (card.rank === 6) return 3;
  if (card.rank === 5) return 2;
  if (card.rank === 4) return 1;
  return 0;
}

function envidoValue(card) {
  return card.rank >= 10 ? 0 : card.rank;
}

function envido(playerIndex) {
  const hand = initialHands[playerIndex];
  if (!hand || hand.length === 0) return 0;

  const piezasInHand = [];
  const normalCards = [];

  hand.forEach(card => {
    const p = getPiezaInfo(card);
    if (p) piezasInHand.push({ card, pieza: p });
    else normalCards.push(card);
  });

  if (piezasInHand.length >= 2) {
    piezasInHand.sort((a, b) => b.pieza.envidoVal - a.pieza.envidoVal);
    return piezasInHand[0].pieza.envidoVal + envidoValue(piezasInHand[1].card);
  }

  if (piezasInHand.length === 1) {
    let maxNormal = 0;
    normalCards.forEach(c => {
      maxNormal = Math.max(maxNormal, envidoValue(c));
    });
    return piezasInHand[0].pieza.envidoVal + maxNormal;
  }

  let best = 0;
  for (let i = 0; i < hand.length; i++) {
    for (let j = i + 1; j < hand.length; j++) {
      if (hand[i].suit === hand[j].suit) {
        best = Math.max(best, 20 + envidoValue(hand[i]) + envidoValue(hand[j]));
      }
    }
  }
  for (const card of hand) {
    best = Math.max(best, envidoValue(card));
  }
  return best;
}

function hasFlor(playerIndex) {
  const hand = initialHands[playerIndex];
  if (!hand || hand.length < 3) return false;
  return hand[0].suit === hand[1].suit && hand[1].suit === hand[2].suit;
}

function florValue(playerIndex) {
  if (!hasFlor(playerIndex)) return 0;
  const hand = initialHands[playerIndex];
  return 20 + envidoValue(hand[0]) + envidoValue(hand[1]) + envidoValue(hand[2]);
}

/* =========================================================
   TEMPORIZADOR POR TURNO
========================================================= */

function startTurnTimer() {
  if (!roundActive || pendingTruco !== null || pendingEnvido !== null || gameOver) {
    stopTurnTimer();
    return;
  }

  if (mode === "cpu" && currentPlayer === 1) {
    stopTurnTimer();
    return;
  }

  if (turnTimer !== null && timerPlayer === currentPlayer) {
    return;
  }

  stopTurnTimer();
  timerPlayer = currentPlayer;
  timeLeft = TURN_DURATION;
  updateTimerUI(true);

  turnTimer = setInterval(() => {
    timeLeft--;
    updateTimerUI(true);

    if (timeLeft <= 0) {
      stopTurnTimer();
      handleTimeOut();
    }
  }, 1000);
}

function stopTurnTimer() {
  if (turnTimer) {
    clearInterval(turnTimer);
    turnTimer = null;
  }
  timerPlayer = null;
  updateTimerUI(false);
}

function updateTimerUI(visible) {
  const timerBox = document.getElementById("timerBox");
  const timerVal = document.getElementById("timerValue");
  if (!timerBox || !timerVal) return;

  if (!visible) {
    timerBox.style.display = "none";
    return;
  }

  timerBox.style.display = "inline-flex";
  timerVal.textContent = timeLeft;

  if (timeLeft <= 5) {
    timerBox.classList.add("warning");
  } else {
    timerBox.classList.remove("warning");
  }
}

function handleTimeOut() {
  if (!roundActive) return;
  log(`⏰ ¡Tiempo agotado para ${playerName(currentPlayer)}! Juego automático.`);
  
  const hand = hands[currentPlayer];
  if (hand && hand.length > 0) {
    playCard(hand[0]);
  }
}

/* =========================================================
   RENDERIZADO CON SOPORTE DE IMÁGENES Y FALLBACK DE EMOJI
========================================================= */

function setSafeText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function cardElement(card, clickable = false) {
  const isPieza = getPiezaInfo(card) !== null;
  const suitClass = card.suit;
  const animalName = getCardDisplayName(card);
  const icon = card.symbol;
  const imagePath = getCardImagePath(card);

  const div = document.createElement("div");
  div.className = `card ${suitClass}` + (clickable ? " clickable" : "") + (isPieza ? " isPieza" : "");
  
  div.innerHTML = `
    <div class="card-corner top-left">
      <span>${card.rank}</span>
      <span class="suit-icon">${icon}</span>
    </div>
    <div class="card-center">
      <div class="card-illustration">
        <img src="${imagePath}" alt="${animalName}" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';">
        <span class="card-fallback-emoji" style="display:none;">${icon}</span>
      </div>
      <div class="card-name">${animalName}</div>
    </div>
    <div class="card-corner bottom-right">
      <span>${card.rank}</span>
      <span class="suit-icon">${icon}</span>
    </div>
  `;

  if (clickable) {
    div.onclick = (e) => {
      e.stopPropagation();
      playCard(card);
    };
  }
  return div;
}

function backElement() {
  const d = document.createElement("div");
  d.className = "card back";
  return d;
}

function renderForPlayer(viewPlayer) {
  render(viewPlayer);
}

function render(viewPlayer = currentPlayer) {
  const top = document.getElementById("topHand");
  const bottom = document.getElementById("bottomHand");
  const muestraArea = document.getElementById("muestraArea");

  if (top) top.innerHTML = "";
  if (bottom) bottom.innerHTML = "";
  if (muestraArea) muestraArea.innerHTML = "";

  if (muestraCard && muestraArea) {
    muestraArea.appendChild(cardElement(muestraCard));
  }

  const isBlocked = pendingTruco !== null || pendingEnvido !== null || isProcessingCard;

  if (mode === "cpu") {
    setSafeText("topTitle", "🤖 COMPUTADORA");
    setSafeText("bottomTitle", "👤 VOS");

    if (top) hands[1].forEach(() => top.appendChild(backElement()));
    if (bottom) {
      hands[0].forEach(card => {
        bottom.appendChild(cardElement(card, roundActive && viewPlayer === 0 && !isBlocked));
      });
    }

    setSafeText("leftName", "COMPUTADORA");
    setSafeText("rightName", "VOS");
    setSafeText("leftScore", scores[1]);
    setSafeText("rightScore", scores[0]);
  } else {
    setSafeText("topTitle", viewPlayer === 1 ? "👤 JUGADOR 2 (TU TURNO)" : "👤 JUGADOR 2");
    setSafeText("bottomTitle", viewPlayer === 0 ? "👤 JUGADOR 1 (TU TURNO)" : "👤 JUGADOR 1");

    if (top) {
      hands[1].forEach(card => {
        if (viewPlayer === 1) {
          top.appendChild(cardElement(card, roundActive && !isBlocked));
        } else {
          top.appendChild(backElement());
        }
      });
    }

    if (bottom) {
      hands[0].forEach(card => {
        if (viewPlayer === 0) {
          bottom.appendChild(cardElement(card, roundActive && !isBlocked));
        } else {
          bottom.appendChild(backElement());
        }
      });
    }

    setSafeText("leftName", "JUGADOR 2");
    setSafeText("rightName", "JUGADOR 1");
    setSafeText("leftScore", scores[1]);
    setSafeText("rightScore", scores[0]);
  }

  renderTrick();
  renderActions();
  startTurnTimer();

  const trucoText = trucoLevel === 1 ? "Simple" : trucoLevel === 2 ? "Truco" : trucoLevel === 3 ? "Retruco" : "Vale 4";
  setSafeText("handInfo", `Mano: ${mano + 1} | Truco: ${trucoText}`);
}

function renderTrick() {
  const area = document.getElementById("trickArea");
  if (!area) return;
  area.innerHTML = "";

  trick.forEach(item => {
    const wrapper = document.createElement("div");
    wrapper.className = "played";

    const name = document.createElement("div");
    name.className = "playedBy";
    name.textContent = mode === "cpu" ? (item.player === 0 ? "Vos" : "Computadora") : (item.player === 0 ? "Jugador 1" : "Jugador 2");

    wrapper.appendChild(name);
    wrapper.appendChild(cardElement(item.card));
    area.appendChild(wrapper);
  });
}

function renderActions() {
  const actions = document.getElementById("actions");
  if (!actions) return;
  
  const btnFlor = document.getElementById("btnFlorOmitida");
  const btnPuntos = document.getElementById("btnVerPuntos");
  const btnVerFlor = document.getElementById("btnVerFlor");

  actions.innerHTML = "";
  if (btnFlor) actions.appendChild(btnFlor);
  if (btnPuntos) actions.appendChild(btnPuntos);
  if (btnVerFlor) actions.appendChild(btnVerFlor);

  if (!roundActive || gameOver) return;

  if (pendingTruco !== null || pendingEnvido !== null) {
    const text = document.createElement("span");
    text.textContent = "Esperando respuesta...";
    actions.appendChild(text);
    return;
  }

  if (mode === "cpu" && currentPlayer === 1) {
    const text = document.createElement("span");
    text.textContent = "La computadora está pensando...";
    actions.appendChild(text);
    return;
  }

  const p = currentPlayer;

  if (envidoState === "available" && trickWinners.length === 0 && !envidoCancelledByFlor) {
    addButton(actions, "Envido", "gold", () => callEnvido("Envido", p));
    addButton(actions, "Real Envido", "gold", () => callEnvido("Real Envido", p));
    addButton(actions, "Falta Envido", "gold", () => callEnvido("Falta Envido", p));
  }

  if (florState === "none" && hasFlor(p) && !florCalled[p] && envidoState !== "blocked" && trickWinners.length === 0) {
    addButton(actions, "🌸 Flor", "purple", () => callFlor(false));
  }

  if (trucoLevel === 1) {
    addButton(actions, "Truco", "red", () => callTruco(p));
  } else if (trucoLevel === 2 && lastTrucoCaller !== p) {
    addButton(actions, "Retruco", "red", () => callTruco(p));
  } else if (trucoLevel === 3 && lastTrucoCaller !== p) {
    addButton(actions, "Vale 4", "red", () => callTruco(p));
  }

  if (trucoLevel > 1) {
    addButton(actions, "Irse al mazo", "gray", () => giveUpTruco());
  }
}

function addButton(container, text, cls, fn) {
  const b = document.createElement("button");
  b.textContent = text;
  b.className = cls;
  b.onclick = fn;
  container.appendChild(b);
}

/* =========================================================
   LOG Y MENSAJES
========================================================= */

function log(text) {
  logLines.unshift(text);
  if (logLines.length > 30) logLines.pop();
  const logEl = document.getElementById("log");
  if (logEl) logEl.innerHTML = logLines.map(x => `<div>${x}</div>`).join("");
}

function playerName(p) {
  if (mode === "cpu") return p === 0 ? "Vos" : "Computadora";
  return p === 0 ? "Jugador 1" : "Jugador 2";
}

function setMessage(text) {
  setSafeText("message", text);
  setSafeText("turnIndicator", text);
}

/* =========================================================
   INICIO Y FIN DE MANO / PARTIDA
========================================================= */

function selectMode(selected) {
  mode = selected;
  const modeBox = document.getElementById("modeBox");
  if (modeBox) modeBox.style.display = "none";

  scores = [0, 0];
  mano = Math.random() < 0.5 ? 0 : 1;
  startRound();
}

function newGame() {
  if (!confirm("¿Empezar una nueva partida?")) return;
  stopTurnTimer();
  finalizarTiempoReclamo();
  scores = [0, 0];
  mano = Math.random() < 0.5 ? 0 : 1;
  logLines = [];
  log("Nueva partida.");
  startRound();
}

function startRound() {
  stopTurnTimer();
  finalizarTiempoReclamo();

  isProcessingCard = false;
  cpuDelayForNextTurn = 600;

  createDeck();

  muestraCard = deck.pop();

  hands = [
    [deck.pop(), deck.pop(), deck.pop()],
    [deck.pop(), deck.pop(), deck.pop()]
  ];

  initialHands = [
    [...hands[0]],
    [...hands[1]]
  ];

  trick = [];
  tricksWon = [0, 0];
  trickWinners = [];

  trucoLevel = 1;
  lastTrucoCaller = null;
  pendingTruco = null;

  envidoState = "available";
  envidoChain = [];
  pendingEnvido = null;

  declaredEnvido = [null, null];
  envidoWinner = null;
  envidoPointsStaked = 0;
  envidoPointsAwarded = 0;
  envidoAwardedTo = null;

  florState = "none";
  florInHand = [hasFlor(0), hasFlor(1)];
  florCalled = [false, false];
  envidoCancelledByFlor = false;

  currentPlayer = mano;
  roundActive = true;
  gameOver = false;

  sound("card");

  log(`Muestra: ${getCardDisplayName(muestraCard)} (${muestraCard.suitName}). Sale ${playerName(currentPlayer)}.`);
  setMessage(`Sale ${playerName(currentPlayer)}.`);

  if (mode === "cpu") {
    render();
    if (currentPlayer === 1) {
      setTimeout(cpuTurn, 800);
    }
  } else {
    showDecision(
      `INICIO DE MANO`,
      `Muestra: ${getCardDisplayName(muestraCard)}. Le toca salir a ${playerName(currentPlayer)}. Pasá el dispositivo.`,
      [
        {
          text: `Ver mis cartas (${playerName(currentPlayer)})`,
          cls: "green",
          action: () => {
            closeModal();
            setMessage(`Turno de ${playerName(currentPlayer)}.`);
            render();
          }
        }
      ]
    );
  }
}

function checkGameOver() {
  const MAX_POINTS = 30;
  
  if (scores[0] >= MAX_POINTS || scores[1] >= MAX_POINTS) {
    stopTurnTimer();
    roundActive = false;
    gameOver = true;
    const winner = scores[0] >= MAX_POINTS ? 0 : 1;

    showDecision(
      winner === 0 ? "🏆 ¡GANASTE LA PARTIDA!" : "🏆 PARTIDA TERMINADA",
      `${playerName(winner)} llegó a ${scores[winner]} puntos.`,
      [
        {
          text: "Nueva partida",
          cls: "green",
          action: () => {
            closeModal();
            finalizarTiempoReclamo();
            scores = [0, 0];
            mano = Math.random() < 0.5 ? 0 : 1;
            startRound();
          }
        }
      ]
    );
    return true;
  }
  return false;
}

function resumeGameAfterModal() {
  if (!roundActive) return;

  if (pendingTruco !== null) {
    const caller = pendingTruco.caller;
    const respondent = 1 - caller;

    if (mode === "cpu") {
      if (respondent === 1) {
        setTimeout(cpuRespondTruco, 600);
      } else {
        promptHumanTrucoResponse();
      }
    } else {
      showDecision(
        "CONTINUAR RESPUESTA DE TRUCO",
        `Pasá el dispositivo a ${playerName(respondent)} para responder al Truco pendiente de ${playerName(caller)}.`,
        [
          {
            text: `Responder Truco (${playerName(respondent)})`,
            cls: "green",
            action: () => {
              closeModal();
              promptHumanTrucoResponse();
            }
          }
        ]
      );
    }
    return;
  }

  render();
  if (mode === "cpu" && currentPlayer === 1 && pendingTruco === null && pendingEnvido === null) {
    const delay = cpuDelayForNextTurn;
    cpuDelayForNextTurn = 600;
    setTimeout(cpuTurn, delay);
  }
}

/* =========================================================
   VERIFICACIÓN DE CONDICIONES DE RECLAMO Y VER FLOR
========================================================= */

function puedeReclamarVerPuntos(playerIndex) {
  if (envidoWinner === null || envidoPointsStaked === 0) return false;
  const opponent = 1 - playerIndex;
  return envidoWinner === opponent;
}

function puedeReclamarFlorOmitida(playerIndex) {
  const opponent = 1 - playerIndex;
  if (!florInHand[opponent] || florCalled[opponent]) return false;

  const oppPlayed = initialHands[opponent].filter(c => !hands[opponent].includes(c));

  const cond2BazasMismoPalo = (
    trickWinners.length === 2 &&
    oppPlayed.length >= 2 &&
    oppPlayed[0].suit === oppPlayed[1].suit
  );

  const cond3BazasMismoPalo = (
    trickWinners.length === 3 &&
    oppPlayed.length === 3 &&
    oppPlayed[0].suit === oppPlayed[1].suit &&
    oppPlayed[1].suit === oppPlayed[2].suit
  );

  return cond2BazasMismoPalo || cond3BazasMismoPalo;
}

function puedeReclamarVerFlor(playerIndex) {
  const opponent = 1 - playerIndex;
  return florCalled[opponent] === true;
}

/* =========================================================
   LÓGICA DE EJECUCIÓN DE RECLAMOS Y RESULTADOS
========================================================= */

function ejecutarReclamoFlorOmitida(claimer) {
  const opponent = 1 - claimer;
  let msg = "";

  if (puedeReclamarFlorOmitida(claimer)) {
    florCalled[opponent] = true;
    scores[claimer] += 3;
    const cardsText = initialHands[opponent].map(c => `${getCardDisplayName(c)}`).join(", ");
    msg = `🚨 ¡FLOR OMITIDA CONFIRMADA! ${playerName(opponent)} tenía Flor (${cardsText}) y no la cantó. +3 pts para ${playerName(claimer)}.`;
    log(msg);
    setMessage(msg);
    sound("win");
    checkGameOver();
  } else {
    msg = `❌ RECLAMO FALLIDO: ${playerName(opponent)} no omitió Flor o no correspondía el reclamo.`;
    log(msg);
    setMessage(msg);
  }
  finalizarTiempoReclamo();
  render();
  return msg;
}

function ejecutarReclamoVerPuntos(claimer) {
  if (envidoWinner === null) {
    const msg = "No se jugó Envido en esta mano.";
    setMessage(msg);
    return msg;
  }

  const winner = envidoWinner;
  const opponent = 1 - winner;
  const declared = declaredEnvido[winner];
  const real = envido(winner);

  let msg = "";
  if (declared > real) {
    scores[winner] -= envidoPointsStaked;
    scores[opponent] += envidoPointsStaked;
    msg = `🚨 ¡MENTIRA DESCUBIERTA! ${playerName(winner)} declaró ${declared} pts pero tenía ${real} pts. +${envidoPointsStaked} pts para ${playerName(opponent)}.`;
    log(msg);
    setMessage(msg);
    sound("win");
    checkGameOver();
  } else {
    msg = `✅ RECLAMO DE PUNTOS: ${playerName(winner)} dijo la verdad (tenía ${real} pts reales).`;
    log(msg);
    setMessage(msg);
  }
  finalizarTiempoReclamo();
  render();
  return msg;
}

function ejecutarReclamoVerFlor(claimer) {
  const opponent = 1 - claimer;
  if (!florCalled[opponent]) {
    return "El rival no cantó Flor en esta mano.";
  }

  const oppHand = initialHands[opponent];
  const cardsText = oppHand.map(c => `${getCardDisplayName(c)}`).join(", ");
  const oppHasFlor = hasFlor(opponent);
  const pts = oppHasFlor ? florValue(opponent) : 0;

  let msg = "";
  if (oppHasFlor) {
    msg = `🌸 CARTAS DE FLOR DE ${playerName(opponent).toUpperCase()}: ${cardsText} (${pts} pts). La Flor era válida.`;
    log(msg);
    setMessage(msg);
  } else {
    scores[opponent] -= 3;
    scores[claimer] += 3;
    msg = `🚨 ¡FLOR FALSA! ${playerName(opponent)} cantó Flor pero sus animales eran (${cardsText}). +3 pts para ${playerName(claimer)}.`;
    log(msg);
    setMessage(msg);
    sound("win");
    checkGameOver();
  }
  finalizarTiempoReclamo();
  render();
  return msg;
}

function reclamarFlorOmitida(claimer = 0) {
  const resultMsg = ejecutarReclamoFlorOmitida(claimer);
  mostrarResultadoReclamoModal(resultMsg);
}

function reclamarVerPuntos(claimer = 0) {
  const resultMsg = ejecutarReclamoVerPuntos(claimer);
  mostrarResultadoReclamoModal(resultMsg);
}

function reclamarVerFlor(claimer = 0) {
  const resultMsg = ejecutarReclamoVerFlor(claimer);
  mostrarResultadoReclamoModal(resultMsg);
}

function mostrarResultadoReclamoModal(resultMsg) {
  if (gameOver) return;

  showDecision(
    "RESULTADO DEL RECLAMO",
    `<p style="font-size: 15px; line-height: 1.4;">${resultMsg}</p>`,
    [
      {
        text: "Continuar / Repartir siguiente mano",
        cls: "green",
        action: () => {
          closeModal();
          startRound();
        }
      }
    ]
  );
}

/* =========================================================
   TEMPORIZADOR Y FIN DE MANO
========================================================= */

function activarBotonesFinDeMano() {
  const btnFlor = document.getElementById("btnFlorOmitida");
  const btnPuntos = document.getElementById("btnVerPuntos");
  const btnVerFlor = document.getElementById("btnVerFlor");

  const humanCanFlor = puedeReclamarFlorOmitida(0);
  const humanCanPuntos = puedeReclamarVerPuntos(0);
  const humanCanVerFlor = puedeReclamarVerFlor(0);

  if (btnFlor) btnFlor.style.display = humanCanFlor ? "inline-block" : "none";
  if (btnPuntos) btnPuntos.style.display = humanCanPuntos ? "inline-block" : "none";
  if (btnVerFlor) btnVerFlor.style.display = humanCanVerFlor ? "inline-block" : "none";

  let tiempoRestante = 10;
  setMessage(`Mano finalizada. Tiempo de reclamo: ${tiempoRestante}s`);

  if (reclamoTimer) clearInterval(reclamoTimer);
  reclamoTimer = setInterval(() => {
    tiempoRestante--;
    if (tiempoRestante > 0) {
      setMessage(`Mano finalizada. Tiempo de reclamo: ${tiempoRestante}s`);
    } else {
      finalizarTiempoReclamo();
    }
  }, 1000);
}

function finalizarTiempoReclamo() {
  if (reclamoTimer) {
    clearInterval(reclamoTimer);
    reclamoTimer = null;
  }

  const btnFlor = document.getElementById("btnFlorOmitida");
  const btnPuntos = document.getElementById("btnVerPuntos");
  const btnVerFlor = document.getElementById("btnVerFlor");

  if (btnFlor) btnFlor.style.display = "none";
  if (btnPuntos) btnPuntos.style.display = "none";
  if (btnVerFlor) btnVerFlor.style.display = "none";
}

function finishHand(message, pointsAwarded = false, winnerPlayer = null) {
  stopTurnTimer();
  roundActive = false;

  let winner = winnerPlayer;
  let pts = trucoLevel;

  if (!pointsAwarded) {
    winner = getHandWinner();
    scores[winner] += pts;
    log(`${playerName(winner)} gana la mano y suma ${pts} punto${pts > 1 ? "s" : ""} de Truco.`);
  }

  const finalMsg = message || `${playerName(winner)} gana la mano (+${pts} pts).`;
  setMessage(finalMsg);
  render();

  activarBotonesFinDeMano();

  if (checkGameOver()) return;

  mano = 1 - mano;

  let cpuClaimMsg = "";
  if (mode === "cpu") {
    if (puedeReclamarFlorOmitida(1)) {
      cpuClaimMsg = ejecutarReclamoFlorOmitida(1);
    } else if (puedeReclamarVerPuntos(1)) {
      cpuClaimMsg = ejecutarReclamoVerPuntos(1);
    }
  }

  if (checkGameOver()) return;

  mostrarModalFinDeMano(finalMsg, cpuClaimMsg);
}

function mostrarModalFinDeMano(handResultMsg, cpuClaimMsg = "") {
  const modalButtons = [];

  if (mode === "cpu") {
    if (puedeReclamarFlorOmitida(0)) {
      modalButtons.push({
        text: "🌸 Reclamar Flor Omitida",
        cls: "purple",
        action: () => reclamarFlorOmitida(0)
      });
    }
    if (puedeReclamarVerPuntos(0)) {
      modalButtons.push({
        text: "👁️ Reclamar Ver Puntos",
        cls: "gold",
        action: () => reclamarVerPuntos(0)
      });
    }
    if (puedeReclamarVerFlor(0)) {
      modalButtons.push({
        text: "👁️ Ver Flor del Rival",
        cls: "purple",
        action: () => reclamarVerFlor(0)
      });
    }
  } else {
    [0, 1].forEach(p => {
      if (puedeReclamarFlorOmitida(p)) {
        modalButtons.push({
          text: `🌸 Reclamar Flor Omitida (${playerName(p)})`,
          cls: "purple",
          action: () => reclamarFlorOmitida(p)
        });
      }
      if (puedeReclamarVerPuntos(p)) {
        modalButtons.push({
          text: `👁️ Reclamar Ver Puntos (${playerName(p)})`,
          cls: "gold",
          action: () => reclamarVerPuntos(p)
        });
      }
      if (puedeReclamarVerFlor(p)) {
        modalButtons.push({
          text: `👁️ Ver Flor (${playerName(p)})`,
          cls: "purple",
          action: () => reclamarVerFlor(p)
        });
      }
    });
  }

  modalButtons.push({
    text: "Continuar / Repartir siguiente mano",
    cls: "green",
    action: () => {
      closeModal();
      startRound();
    }
  });

  let htmlContent = `<p><strong>${handResultMsg}</strong></p>`;
  if (cpuClaimMsg) {
    htmlContent += `<p style="color:#d97706; font-weight:bold; background:rgba(0,0,0,0.2); padding:8px; border-radius:8px;">${cpuClaimMsg}</p>`;
  }

  if (modalButtons.length > 1) {
    htmlContent += `<p style="margin-top:10px;"><small>Si deseás verificar puntos o pedir ver la Flor cantada, podés presionar el botón correspondiente.</small></p>`;
  }

  showDecision("FIN DE LA MANO", htmlContent, modalButtons);
}

/* =========================================================
   REGLAS DE BAZAS
========================================================= */

function getHandWinner() {
  const t1 = trickWinners[0];
  const t2 = trickWinners[1];
  const t3 = trickWinners[2];

  if (t1 === null) {
    if (t2 !== null && t2 !== undefined) return t2;
    if (t3 !== null && t3 !== undefined) return t3;
    return mano;
  } else {
    if (t2 === null) return t1;
    if (t1 === t2) return t1;
    if (t3 === null) return t1;
    if (t3 !== null && t3 !== undefined) return t3;
    return t1;
  }
}

function isHandFinished() {
  if (tricksWon[0] >= 2 || tricksWon[1] >= 2) return true;

  if (trickWinners.length === 2) {
    const t1 = trickWinners[0];
    const t2 = trickWinners[1];
    if (t1 === null && t2 !== null) return true;
    if (t1 !== null && t2 === null) return true;
  }

  if (trickWinners.length === 3) return true;

  return false;
}

/* =========================================================
   JUGAR CARTAS Y RESOLUCIÓN
========================================================= */

function playCard(card) {
  if (!roundActive || pendingTruco !== null || pendingEnvido !== null) return;
  if (isProcessingCard) return;

  if (mode === "cpu" && currentPlayer === 1) return;
  if (trick.some(t => t.player === currentPlayer)) return;

  stopTurnTimer();

  const hand = hands[currentPlayer];
  const index = hand.indexOf(card);
  if (index === -1) return;

  isProcessingCard = true;

  hand.splice(index, 1);
  trick.push({ player: currentPlayer, card });

  sound("card");
  log(`${playerName(currentPlayer)} juega ${getCardDisplayName(card)} (${card.suitName}).`);

  if (trick.length === 2) {
    envidoState = "resolved";
    render();
    setTimeout(() => {
      resolveTrick();
      isProcessingCard = false;
    }, 650);
  } else {
    currentPlayer = 1 - currentPlayer;
    isProcessingCard = false;

    if (mode === "cpu") {
      render();
      if (currentPlayer === 1) {
        const delay = cpuDelayForNextTurn;
        cpuDelayForNextTurn = 600;
        setTimeout(cpuTurn, delay);
      } else {
        setMessage(`Turno de ${playerName(currentPlayer)}.`);
      }
    } else {
      showDecision(
        "CAMBIO DE TURNO",
        `Pasá el dispositivo a ${playerName(currentPlayer)}.`,
        [
          {
            text: "Continuar",
            cls: "green",
            action: () => {
              closeModal();
              setMessage(`Turno de ${playerName(currentPlayer)}.`);
              render();
            }
          }
        ]
      );
    }
  }
}

function resolveTrick() {
  const a = trick[0];
  const b = trick[1];

  const pa = power(a.card);
  const pb = power(b.card);

  let winner;
  if (pa > pb) winner = a.player;
  else if (pb > pa) winner = b.player;
  else winner = null;

  if (winner === null) {
    trickWinners.push(null);
    setMessage(trickWinners.length === 1 ? "¡Parda! Se define en la segunda baza." : "¡Parda!");
    log("Baza parda.");
  } else {
    tricksWon[winner]++;
    trickWinners.push(winner);
    sound(winner === 0 ? "win" : "lose");
    setMessage(`Gana la baza ${playerName(winner)}.`);
    log(`Baza para ${playerName(winner)}.`);
  }

  setTimeout(() => {
    trick = [];
    envidoState = "resolved";

    if (isHandFinished() || (hands[0].length === 0 && hands[1].length === 0)) {
      finishHand();
      return;
    }

    if (winner !== null) currentPlayer = winner;
    else currentPlayer = mano;

    if (mode === "cpu") {
      render();
      setMessage(`Sale ${playerName(currentPlayer)}.`);
      if (currentPlayer === 1) {
        const delay = cpuDelayForNextTurn;
        cpuDelayForNextTurn = 600;
        setTimeout(cpuTurn, delay);
      }
    } else {
      showDecision(
        "NUEVA BAZA",
        `Le toca salir a ${playerName(currentPlayer)}. Pasá el dispositivo.`,
        [
          {
            text: "Continuar",
            cls: "green",
            action: () => {
              closeModal();
              setMessage(`Sale ${playerName(currentPlayer)}.`);
              render();
            }
          }
        ]
      );
    }
  }, 2000);
}

/* =========================================================
   IA (COMPUTADORA)
========================================================= */

function cpuTurn() {
  if (!roundActive || mode !== "cpu" || currentPlayer !== 1 || pendingTruco !== null || pendingEnvido !== null) return;
  if (isProcessingCard) return;

  const hand = hands[1];
  if (!hand || hand.length === 0) return;

  if (hasFlor(1) && !florCalled[1] && florState === "none" && envidoState !== "blocked" && trickWinners.length === 0 && Math.random() < 0.8) {
    callFlor(true);
    return;
  }

  if (envidoState === "available" && trickWinners.length === 0 && !envidoCancelledByFlor) {
    const eVal = envido(1);
    if (eVal >= 33 && Math.random() < 0.4) {
      callEnvido("Real Envido", 1);
      return;
    } else if (eVal >= 28 && Math.random() < 0.6) {
      callEnvido("Envido", 1);
      return;
    }
  }

  const canCallTruco =
    (trucoLevel === 1) ||
    (trucoLevel === 2 && lastTrucoCaller !== 1) ||
    (trucoLevel === 3 && lastTrucoCaller !== 1);

  if (canCallTruco && strongHand(hand) && Math.random() < 0.35) {
    callTruco(1);
    return;
  }

  const handCopy = [...hand];
  let chosen;

  if (trickWinners.length === 1 && trickWinners[0] === null) {
    handCopy.sort((a, b) => power(b) - power(a));
    chosen = handCopy[0];
  } else if (trick.length === 1) {
    const opponentCard = trick[0].card;
    const winningCards = handCopy.filter(c => power(c) > power(opponentCard));

    if (winningCards.length > 0) {
      winningCards.sort((a, b) => power(a) - power(b));
      chosen = winningCards[0];
    } else {
      handCopy.sort((a, b) => power(a) - power(b));
      chosen = handCopy[0];
    }
  } else {
    handCopy.sort((a, b) => power(b) - power(a));
    chosen = handCopy[0];
  }

  const cardIndex = hands[1].indexOf(chosen);
  if (cardIndex !== -1) {
    isProcessingCard = true;
    hands[1].splice(cardIndex, 1);
    trick.push({ player: 1, card: chosen });
    sound("card");
    log(`Computadora juega ${getCardDisplayName(chosen)} (${chosen.suitName}).`);

    if (trick.length === 2) {
      envidoState = "resolved";
      render();
      setTimeout(() => {
        resolveTrick();
        isProcessingCard = false;
      }, 650);
    } else {
      currentPlayer = 0;
      isProcessingCard = false;
      setMessage("Turno de Vos.");
      render();
    }
  }
}

function strongHand(hand) {
  const powers = hand.map(power).sort((a, b) => b - a);
  return powers[0] >= 16 || (powers[0] >= 12 && powers[1] >= 10);
}

/* =========================================================
   ENVIDO
========================================================= */

function getEnvidoValues(chain) {
  const faltaValue = 30 - Math.max(scores[0], scores[1]);
  const key = chain.join(" > ");

  switch(key) {
    case "Envido": return { value: 2, reject: 1 };
    case "Envido > Envido": return { value: 4, reject: 2 };
    case "Real Envido": return { value: 3, reject: 1 };
    case "Envido > Real Envido": return { value: 5, reject: 2 };
    case "Envido > Envido > Real Envido": return { value: 7, reject: 4 };
    case "Falta Envido": return { value: faltaValue, reject: 1 };
    case "Envido > Falta Envido": return { value: faltaValue, reject: 2 };
    case "Envido > Envido > Falta Envido": return { value: faltaValue, reject: 4 };
    case "Real Envido > Falta Envido": return { value: faltaValue, reject: 3 };
    case "Envido > Real Envido > Falta Envido": return { value: faltaValue, reject: 5 };
    case "Envido > Envido > Real Envido > Falta Envido": return { value: faltaValue, reject: 7 };
    default: return { value: 2, reject: 1 };
  }
}

function callEnvido(callType, callerPlayer = currentPlayer) {
  stopTurnTimer();

  if (envidoCancelledByFlor || envidoState === "blocked") {
    setMessage("El Envido ya no está disponible.");
    return;
  }

  const caller = callerPlayer;
  envidoState = "pending";
  sound("envido");

  if (!pendingEnvido) {
    envidoChain = [callType];
  } else {
    envidoChain.push(callType);
  }

  pendingEnvido = { caller, chain: envidoChain };
  log(`${playerName(caller)} canta ${callType}.`);

  if (mode === "cpu") {
    render();
    if (caller === 0) {
      setTimeout(cpuRespondEnvido, 800);
    } else {
      promptHumanEnvidoResponse();
    }
  } else {
    const respondent = 1 - caller;
    showDecision(
      `CANTARON ${callType.toUpperCase()}`,
      `${playerName(caller)} cantó ${callType}. Pasá el dispositivo a ${playerName(respondent)} para responder.`,
      [
        {
          text: `Ver mis cartas y responder (${playerName(respondent)})`,
          cls: "green",
          action: () => {
            closeModal();
            renderForPlayer(respondent);
            promptHumanEnvidoResponse();
          }
        }
      ]
    );
  }
}

function promptHumanEnvidoResponse() {
  const caller = pendingEnvido.caller;
  const respondent = 1 - caller;

  renderForPlayer(respondent);

  const lastCall = pendingEnvido.chain[pendingEnvido.chain.length - 1];
  const { value, reject } = getEnvidoValues(pendingEnvido.chain);
  const respondentScore = envido(respondent);

  const buttons = [
    {
      text: "Quiero",
      cls: "green",
      action: () => {
        closeModal();
        startEnvidoDeclaration(value);
      }
    },
    {
      text: "No quiero",
      cls: "gray",
      action: () => {
        closeModal();
        scores[caller] += reject;
        envidoPointsAwarded = reject;
        envidoAwardedTo = caller;
        envidoState = "resolved";
        pendingEnvido = null;
        log(`${playerName(respondent)} no quiso el Envido. ${playerName(caller)} gana ${reject} pt(s).`);

        if (caller === 1) {
          cpuDelayForNextTurn = 5000;
        }

        if (!checkGameOver()) resumeGameAfterModal();
      }
    }
  ];

  if (lastCall === "Envido") {
    if (pendingEnvido.chain.length === 1) {
      buttons.push({ text: "Envido", cls: "gold", action: () => { closeModal(); callEnvido("Envido", respondent); } });
    }
    buttons.push({ text: "Real Envido", cls: "gold", action: () => { closeModal(); callEnvido("Real Envido", respondent); } });
    buttons.push({ text: "Falta Envido", cls: "red", action: () => { closeModal(); callEnvido("Falta Envido", respondent); } });
  } else if (lastCall === "Real Envido") {
    buttons.push({ text: "Falta Envido", cls: "red", action: () => { closeModal(); callEnvido("Falta Envido", respondent); } });
  }

  const scoreInfo = mode === "2p" ? `<p style="margin-top:10px;">📊 <strong>Tus puntos (${playerName(respondent)}):</strong> <span class="score-badge">${respondentScore} pts</span></p>` : "";

  const content = `
    <p><strong>${playerName(caller)}</strong> cantó <strong>${pendingEnvido.chain.join(" - ")}</strong>.</p>
    ${scoreInfo}
  `;

  showDecision("ENVIDO", content, buttons);
}

function cpuRespondEnvido() {
  const pts = envido(1);
  const lastCall = pendingEnvido.chain[pendingEnvido.chain.length - 1];
  const { value, reject } = getEnvidoValues(pendingEnvido.chain);

  if (lastCall === "Falta Envido") {
    if (pts >= 32) {
      log("La computadora acepta la Falta Envido.");
      startEnvidoDeclaration(value);
    } else {
      scores[0] += reject;
      envidoPointsAwarded = reject;
      envidoAwardedTo = 0;
      envidoState = "resolved";
      pendingEnvido = null;
      log("La computadora no quiso la Falta Envido.");
      setMessage(`La computadora no quiso (+${reject} pt).`);
      if (!checkGameOver()) resumeGameAfterModal();
    }
  } else if (lastCall === "Real Envido") {
    if (pts >= 33 && pendingEnvido.chain.length < 3) {
      callEnvido("Falta Envido", 1);
    } else if (pts >= 29) {
      log("La computadora acepta el Real Envido.");
      startEnvidoDeclaration(value);
    } else {
      scores[0] += reject;
      envidoPointsAwarded = reject;
      envidoAwardedTo = 0;
      envidoState = "resolved";
      pendingEnvido = null;
      log("La computadora no quiso el Real Envido.");
      setMessage(`La computadora no quiso (+${reject} pt).`);
      if (!checkGameOver()) resumeGameAfterModal();
    }
  } else if (lastCall === "Envido") {
    if (pts >= 33 && pendingEnvido.chain.length === 1 && Math.random() < 0.5) {
      callEnvido("Envido", 1);
    } else if (pts >= 30 && Math.random() < 0.5) {
      callEnvido("Real Envido", 1);
    } else if (pts >= 27) {
      log("La computadora acepta el Envido.");
      startEnvidoDeclaration(value);
    } else {
      scores[0] += reject;
      envidoPointsAwarded = reject;
      envidoAwardedTo = 0;
      envidoState = "resolved";
      pendingEnvido = null;
      log("La computadora no quiso el Envido.");
      setMessage(`La computadora no quiso (+${reject} pt).`);
      if (!checkGameOver()) resumeGameAfterModal();
    }
  }
}

function startEnvidoDeclaration(ptsAtStake) {
  envidoPointsStaked = ptsAtStake;
  
  if (mode === "cpu") {
    promptDeclareEnvido(0, (ptsPlayer) => {
      declaredEnvido[0] = ptsPlayer;
      let cpuReal = envido(1);
      
      let cpuDeclared = cpuReal;
      if (cpuReal < 25 && Math.random() < 0.3) {
        cpuDeclared = cpuReal + Math.floor(Math.random() * 5) + 2;
      }
      declaredEnvido[1] = cpuDeclared;

      log(`Vos cantás ${declaredEnvido[0]} pts. Computadora canta ${declaredEnvido[1]} pts.`);
      finalizeEnvidoDeclaration();
    });
  } else {
    promptDeclareEnvido(0, (ptsP0) => {
      declaredEnvido[0] = ptsP0;
      promptDeclareEnvido(1, (ptsP1) => {
        declaredEnvido[1] = ptsP1;
        log(`Jugador 1 canta ${declaredEnvido[0]} pts. Jugador 2 canta ${declaredEnvido[1]} pts.`);
        finalizeEnvidoDeclaration();
      });
    });
  }
}

function promptDeclareEnvido(playerIndex, callback) {
  const realPts = envido(playerIndex);
  
  const content = `
    <p>Tus puntos reales son: <strong>${realPts}</strong></p>
    <p>¿Cuántos puntos querés cantar?</p>
    <div style="margin-top: 10px;">
      <input type="number" id="envidoCustomVal" value="${realPts}" min="0" max="39" style="font-size:18px; width:80px; text-align:center; padding:5px; border-radius:6px; border:1px solid #ccc;" />
    </div>
  `;

  showDecision(
    `CANTAR ENVIDO (${playerName(playerIndex)})`,
    content,
    [
      {
        text: `Cantar puntos reales (${realPts})`,
        cls: "green",
        action: () => {
          closeModal();
          callback(realPts);
        }
      },
      {
        text: "Cantar valor ingresado / Mentir",
        cls: "gold",
        action: () => {
          const inputEl = document.getElementById("envidoCustomVal");
          const customVal = inputEl ? parseInt(inputEl.value, 10) : realPts;
          closeModal();
          callback(isNaN(customVal) ? realPts : customVal);
        }
      }
    ]
  );
}

function finalizeEnvidoDeclaration() {
  const d0 = declaredEnvido[0];
  const d1 = declaredEnvido[1];

  let winner;
  if (d0 > d1) winner = 0;
  else if (d1 > d0) winner = 1;
  else winner = mano;

  envidoWinner = winner;
  scores[winner] += envidoPointsStaked;
  envidoPointsAwarded = envidoPointsStaked;
  envidoAwardedTo = winner;

  envidoState = "resolved";
  pendingEnvido = null;

  if (winner === 1 && mode === "cpu") {
    cpuDelayForNextTurn = 5000;
  }

  sound(winner === 0 ? "win" : "lose");
  const resultMsg = `Envido cantado: ${playerName(0)} (${d0}) vs ${playerName(1)} (${d1}). Gana ${playerName(winner)} (+${envidoPointsStaked} pts).`;
  log(resultMsg);

  setMessage(resultMsg);

  if (mode === "2p") {
    showDecision(
      "RESULTADO ENVIDO",
      `${playerName(0)} cantó ${d0} pts | ${playerName(1)} cantó ${d1} pts.<br>Gana <strong>${playerName(winner)}</strong> (+${envidoPointsStaked} pts).`,
      [
        {
          text: "Continuar",
          cls: "green",
          action: () => {
            closeModal();
            if (!checkGameOver()) resumeGameAfterModal();
          }
        }
      ]
    );
  } else {
    if (!checkGameOver()) resumeGameAfterModal();
  }
}

/* =========================================================
   TRUCO
========================================================= */

function check4Penalty(caller) {
  const opponent = 1 - caller;
  const opponentCardPlayed = trick.find(t => t.player === opponent);

  if (opponentCardPlayed) {
    const card = opponentCardPlayed.card;
    const isPieza = getPiezaInfo(card) !== null;
    if (card.rank === 4 && !isPieza) {
      return true;
    }
  }
  return false;
}

function callTruco(callerPlayer = currentPlayer) {
  if (!roundActive) return;
  stopTurnTimer();

  const caller = callerPlayer;
  const opponent = 1 - caller;

  if (check4Penalty(caller)) {
    scores[opponent] = 30;
    log(`¡PENALIZACIÓN DEL 4! ${playerName(caller)} le cantó Truco a un 4 común y pierde la partida.`);
    sound(opponent === 0 ? "win" : "lose");

    showDecision(
      "¡PENALIZACIÓN DEL 4!",
      `${playerName(caller)} le cantó Truco a un 4 común. Pierde automáticamente la partida.`,
      [
        {
          text: "Ver final",
          cls: "red",
          action: () => {
            closeModal();
            checkGameOver();
          }
        }
      ]
    );
    return;
  }

  if (caller !== mano && trickWinners.length === 0 && envidoState === "available") {
    envidoState = "blocked";
    log("El Pie cantó Truco primero: ya no se puede cantar Envido ni Flor.");
  }

  const targetLevel = trucoLevel + 1;
  const name = targetLevel === 2 ? "Truco" : targetLevel === 3 ? "Retruco" : "Vale 4";

  pendingTruco = { caller, targetLevel };
  sound("truco");
  log(`${playerName(caller)} canta ${name}.`);

  if (mode === "cpu") {
    render();
    if (caller === 0) {
      setTimeout(cpuRespondTruco, 800);
    } else {
      promptHumanTrucoResponse();
    }
  } else {
    showDecision(
      `CANTARON ${name.toUpperCase()}`,
      `${playerName(caller)} canta ${name}. Pasá el dispositivo a ${playerName(opponent)} para responder.`,
      [
        {
          text: `Ver mis cartas y responder (${playerName(opponent)})`,
          cls: "green",
          action: () => {
            closeModal();
            renderForPlayer(opponent);
            promptHumanTrucoResponse();
          }
        }
      ]
    );
  }
}

function cpuRespondTruco() {
  if (!pendingTruco) return;
  const caller = pendingTruco.caller;
  const targetLevel = pendingTruco.targetLevel;
  const name = targetLevel === 2 ? "Truco" : targetLevel === 3 ? "Retruco" : "Vale 4";

  if (caller === mano && trickWinners.length === 0 && envidoState === "available" && !envidoCancelledByFlor) {
    if (hasFlor(1) && !florCalled[1] && florState === "none") {
      callFlor(true);
      return;
    }
    const eVal = envido(1);
    if (eVal >= 28 && Math.random() < 0.7) {
      callEnvido("Envido", 1);
      return;
    }
  }

  const cpuValue = Math.max(...hands[1].map(power));
  const accept = cpuValue >= 10 || Math.random() < 0.5;

  if (accept) {
    if (cpuValue >= 16 && targetLevel < 4 && Math.random() < 0.4) {
      trucoLevel = targetLevel;
      lastTrucoCaller = 0;
      pendingTruco = null;
      log(`La computadora retruca.`);
      callTruco(1);
      return;
    }

    trucoLevel = targetLevel;
    lastTrucoCaller = caller;
    pendingTruco = null;
    envidoState = "resolved";
    log(`La computadora acepta ${name}.`);
    setMessage(`La computadora acepta ${name}.`);
    resumeGameAfterModal();
  } else {
    const pts = trucoLevel;
    scores[0] += pts;
    pendingTruco = null;
    finishHand(`La computadora no quiso ${name}. Sumás ${pts} pt(s).`, true, 0);
  }
}

function promptHumanTrucoResponse() {
  if (!pendingTruco) return;
  const caller = pendingTruco.caller;
  const targetLevel = pendingTruco.targetLevel;
  const name = targetLevel === 2 ? "Truco" : targetLevel === 3 ? "Retruco" : "Vale 4";
  const respondent = 1 - caller;

  renderForPlayer(respondent);

  const buttons = [
    {
      text: "Quiero",
      cls: "green",
      action: () => {
        closeModal();
        trucoLevel = targetLevel;
        lastTrucoCaller = caller;
        pendingTruco = null;
        envidoState = "resolved";
        log(`${playerName(respondent)} acepta ${name}.`);
        setMessage(`${playerName(respondent)} acepta ${name}.`);
        resumeGameAfterModal();
      }
    },
    {
      text: "No quiero",
      cls: "gray",
      action: () => {
        closeModal();
        const pts = trucoLevel;
        scores[caller] += pts;
        pendingTruco = null;
        finishHand(`${playerName(respondent)} no quiso ${name}. ${playerName(caller)} gana ${pts} pt(s).`, true, caller);
      }
    }
  ];

  if (targetLevel < 4) {
    const nextName = targetLevel === 2 ? "Retruco" : "Vale 4";
    buttons.push({
      text: nextName,
      cls: "red",
      action: () => {
        closeModal();
        trucoLevel = targetLevel;
        lastTrucoCaller = respondent;
        pendingTruco = null;
        callTruco(respondent);
      }
    });
  }

  if (caller === mano && trickWinners.length === 0 && envidoState === "available" && !envidoCancelledByFlor) {
    buttons.push({
      text: "Envido",
      cls: "gold",
      action: () => {
        closeModal();
        callEnvido("Envido", respondent);
      }
    });
    buttons.push({
      text: "Real Envido",
      cls: "gold",
      action: () => {
        closeModal();
        callEnvido("Real Envido", respondent);
      }
    });
    buttons.push({
      text: "Falta Envido",
      cls: "red",
      action: () => {
        closeModal();
        callEnvido("Falta Envido", respondent);
      }
    });

    if (hasFlor(respondent) && florState === "none") {
      buttons.push({
        text: "🌸 Flor",
        cls: "purple",
        action: () => {
          closeModal();
          callFlor(false);
        }
      });
    }
  }

  showDecision(
    name.toUpperCase(),
    `${playerName(caller)} canta ${name}. ${playerName(respondent)}, ¿qué hacés?`,
    buttons
  );
}

function giveUpTruco() {
  stopTurnTimer();
  const winner = 1 - currentPlayer;
  const pts = trucoLevel;
  scores[winner] += pts;
  finishHand(`${playerName(currentPlayer)} se fue al mazo. ${playerName(winner)} gana ${pts} pt(s).`, true, winner);
}

/* =========================================================
   FLOR
========================================================= */

function callFlor(fromCPU = false) {
  stopTurnTimer();
  const caller = fromCPU ? 1 : currentPlayer;
  const opponent = 1 - caller;

  if (trickWinners.length > 0 || florState !== "none" || !hasFlor(caller) || envidoState === "blocked") return;

  florCalled[caller] = true;
  florState = "called";
  sound("flor");

  if (pendingEnvido !== null) {
    pendingEnvido = null;
    log("Flor anula el canto de Envido pendiente.");
  }

  if (envidoPointsAwarded > 0 && envidoAwardedTo !== null) {
    scores[envidoAwardedTo] -= envidoPointsAwarded;
    log(`🌸 ¡Flor cantada! Se anulan los ${envidoPointsAwarded} pt(s) otorgados por el Envido a ${playerName(envidoAwardedTo)}.`);
    envidoPointsAwarded = 0;
    envidoAwardedTo = null;
    envidoWinner = null;
    envidoPointsStaked = 0;
  }

  envidoCancelledByFlor = true;
  envidoState = "resolved";

  log(`${playerName(caller)} canta Flor.`);

  const resolveFlorLogic = () => {
    if (hasFlor(opponent)) {
      florCalled[opponent] = true;
      const fCaller = florValue(caller);
      const fOpponent = florValue(opponent);

      let winner;
      if (fCaller > fOpponent) winner = caller;
      else if (fOpponent > fCaller) winner = opponent;
      else winner = mano;

      scores[winner] += 3;
      florState = "resolved";

      if (winner === 1) {
        cpuDelayForNextTurn = 5000;
      }

      if (mode === "2p") {
        showDecision(
          "🌸 FLOR CONTRA FLOR",
          `<p>¡Ambos tienen Flor!</p>
           <p><strong>${playerName(caller)}:</strong> ${fCaller} pts | <strong>${playerName(opponent)}:</strong> ${fOpponent} pts</p>
           <p>🏆 Gana <strong>${playerName(winner)}</strong> (+3 pts). El Envido queda anulado.</p>`,
          [
            {
              text: "Continuar",
              cls: "green",
              action: () => {
                closeModal();
                if (!checkGameOver()) resumeGameAfterModal();
              }
            }
          ]
        );
      } else {
        setMessage(`Flor vs Flor: Gana ${playerName(winner)} (+3 pts). Envido anulado.`);
        if (!checkGameOver()) resumeGameAfterModal();
      }
    } else {
      scores[caller] += 3;
      florState = "resolved";
      const pts = florValue(caller);

      if (caller === 1) {
        cpuDelayForNextTurn = 5000;
      }

      log(`${playerName(caller)} tiene Flor (${pts} pts) y suma 3 puntos. El Envido queda anulado.`);

      if (mode === "2p") {
        showDecision(
          "🌸 FLOR",
          `<p>¡<strong>${playerName(caller)}</strong> canta Flor! (${pts} pts).</p>
           <p>${playerName(opponent)} no tiene Flor.</p>
           <p><strong>${playerName(caller)}</strong> suma +3 puntos. El Envido queda anulado.</p>`,
          [
            {
              text: "Continuar",
              cls: "green",
              action: () => {
                closeModal();
                if (!checkGameOver()) resumeGameAfterModal();
              }
            }
          ]
        );
      } else {
        setMessage(`${playerName(caller)} canta Flor (+3 pts). El Envido queda anulado.`);
        if (!checkGameOver()) resumeGameAfterModal();
      }
    }
  };

  if (mode === "cpu") {
    render();
    resolveFlorLogic();
  } else {
    showDecision(
      "🌸 CANTARON FLOR",
      `${playerName(caller)} cantó Flor. Pasá el dispositivo a ${playerName(opponent)} para continuar.`,
      [
        {
          text: `Continuar (${playerName(opponent)})`,
          cls: "green",
          action: () => {
            closeModal();
            renderForPlayer(opponent);
            resolveFlorLogic();
          }
        }
      ]
    );
  }
}

/* =========================================================
   MODAL CONTROLES Y EVENT LISTENERS
========================================================= */

function showDecision(title, content, buttons) {
  setSafeText("modalTitle", title);

  const textEl = document.getElementById("modalText");
  if (textEl) {
    if (typeof content === "string" && content.includes("<")) {
      textEl.innerHTML = content;
    } else {
      textEl.textContent = content;
    }
  }

  const container = document.getElementById("modalButtons");
  if (container) {
    container.innerHTML = "";
    buttons.forEach(item => {
      const b = document.createElement("button");
      b.textContent = item.text;
      b.className = item.cls || "";
      b.onclick = item.action;
      container.appendChild(b);
    });
  }

  const modalEl = document.getElementById("modal");
  if (modalEl) modalEl.classList.add("show");
}

function closeModal() {
  const modalEl = document.getElementById("modal");
  if (modalEl) modalEl.classList.remove("show");
}

document.addEventListener("keydown", e => {
  if (e.key === "Escape") closeModal();
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("btnFlorOmitida")?.addEventListener("click", () => reclamarFlorOmitida(0));
  document.getElementById("btnVerPuntos")?.addEventListener("click", () => reclamarVerPuntos(0));
  document.getElementById("btnVerFlor")?.addEventListener("click", () => reclamarVerFlor(0));
});