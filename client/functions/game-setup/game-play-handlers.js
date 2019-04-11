const blueScoreValue = document.querySelector("#blue-score-number");
const redScoreValue  = document.querySelector("#red-score-number");

const blueWaitingMessage = document.querySelector("#blue-waiting");
const redWaitingMessage  = document.querySelector("#red-waiting");
const blueGuessMessage   = document.querySelector("#blue-guess");
const redGuessMessage    = document.querySelector("#red-guess");
const resetMessage       = document.querySelector("#reset-message");
const hintInput          = document.querySelector("#hint-input-container");

const hideShowHandlers = require('../update/hide-show-handlers');
let HIDE_ELEMENTS = hideShowHandlers.hideElements;
let SHOW_ELEMENTS = hideShowHandlers.showElements;

function updateScores({ numBlueCards, numRedCards }){
	blueScoreValue.innerHTML = numBlueCards;
	redScoreValue.innerHTML = numRedCards;
}

function showWaitingMessage({ gameOver }, waitingTeam) {
    if(!gameOver){
        let waitingMessage = waitingTeam === 'red' ? blueWaitingMessage : redWaitingMessage;
        let guessMessage = waitingTeam === 'red' ? blueGuessMessage : redGuessMessage;

		HIDE_ELEMENTS(
			waitingMessage,
			guessMessage, 
			resetMessage, 
			document.querySelector("#hint-message"), 
			document.querySelector("#message")
		);
		SHOW_ELEMENTS(waitingTeam === 'blue' ? blueWaitingMessage : redWaitingMessage);
	}
}

// runs when hint submission button is clicked
function startGuess(socket){
	socket.emit('guessMessage');

	const hintData = {
		word: '',
		number: 0,
		isBlueTurn: false,
		isRedTurn: false
	};

	hintData.word = document.querySelector("#input-hint").value;
	hintData.number = document.querySelector("select").value;
	socket.emit('hintSubmitted', hintData);

	HIDE_ELEMENTS(hintInput);

	let select = document.querySelector("select");
	select.parentNode.removeChild(select);

	socket.emit('readyToGuess');
}

function showGuessMessage({ isBlueTurn }){
	HIDE_ELEMENTS(resetMessage);
	if(isBlueTurn) {
		HIDE_ELEMENTS(blueWaitingMessage);
		SHOW_ELEMENTS(blueGuessMessage);
	} else {
		HIDE_ELEMENTS(redWaitingMessage);
		SHOW_ELEMENTS(redGuessMessage);
	}
}

function revealHint(hintData) {
	SHOW_ELEMENTS(document.querySelector("#hint-message"));
	document.querySelector("#hint-word").innerHTML = hintData.word;
	document.querySelector("#hint-number").innerHTML = hintData.number;

	if(hintData.isBlueTurn){
		document.querySelector("#hint-word").style.color = "#1c64ff";
		document.querySelector("#hint-number").style.color = "#1c64ff";
	} else {
		document.querySelector("#hint-word").style.color = "#db3328";
		document.querySelector("#hint-number").style.color = "#db3328";
	}
}

// boolean controlled by the server (will only run for clients when it is their turn to guess)
function clientCanGuess(client){
	client.canGuess = true;
}


module.exports = {
    updateScores: updateScores,
    showWaitingMessage: showWaitingMessage,
    startGuess: startGuess,
    showGuessMessage: showGuessMessage,
    revealHint: revealHint,
    clientCanGuess: clientCanGuess
}
