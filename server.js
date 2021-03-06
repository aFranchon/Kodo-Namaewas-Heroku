/* Express setup
**********************************/
const express = require('express');
const app = express();
const server = require('http').Server(app);
const port = process.env.PORT || 3000;  //heroku port or default port 3000

app.use(express.static('client'));

// routes
app.get('/', (req,res) => {
	res.sendFile(__dirname + '/client/index.html');
});

server.listen(port, () => {
	console.log('Server is running!');
});

// io is an object that is created by the socket function
const io = require('socket.io')(server);

const playerList = [];
const playerData = {
	chatter: '',
	chatterTeamColor: '',
	chatMessage: '',
	isTeamMessage: false,
	spectators: [],
	bluePlayers: [],
	blueIDs: [],
	redPlayers: [],
	redIDs: [],
	blueSpyExists: false,
	redSpyExists: false,
	blueSpyMaster:'',
	redSpyMaster:'',
	blueSpyID:0,
	redSpyID:0
};

const gameData = {	
	currentBoardColors: ['lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey'],
	gameBoardColors: [],
	gameWords: [],	
	turnCounter: 0,
	isBlueTurn: false,
	isRedTurn: false,
	gameHasStarted: false,
	numBlueCards: 0,
	numRedCards: 0,
	numYellowCards: 7,
	numBlackCards: 1,
	numCardsToGuess: 0,
	numCardsPicked: 0,
	playerWhoGuessed: '',
	cardSelected: 0,
	turnIsOver: false,
	clientCallCounter: 0,
	runOnce: true,
	runOnce2: true,
	runOnce3: true,
	gameOver: false
};

/*socket.io setup
********************************************/
io.sockets.on('connection', (socket) => {
	console.log('socket connection: '+ socket.id);
	playerList.push({ socketID: socket.id, username: null });
		
	// update a new player on the overall game state
	let currentPlayers = {
		spectators: playerData.spectators,
		bluePlayers: playerData.bluePlayers,
		redPlayers: playerData.redPlayers
	}
	socket.emit('update players for new connection', currentPlayers);

	if(gameData.gameHasStarted) {
		socket.emit('updateBoard', gameData);
		socket.emit('updateGameWords', gameData);
		socket.emit('showScores', gameData);
	}

	if(playerData.blueSpyExists) {
		console.log('updating client on spy');
		socket.emit('update blue spymaster for new connection', playerData);
	}
	if(playerData.redSpyExists) {
		socket.emit('update red spymaster for new connection', playerData);
	}
	
	// handling the server data and client DOM elements on disconnect
	socket.on('disconnect', () => {
		const { bluePlayers, redPlayers, spectators, blueSpyID, redSpyID } = playerData;
		const leavingPlayerIndex = playerList.map(player => player.socketID).indexOf(socket.id);
		const leavingPlayerName = playerList[leavingPlayerIndex].username;
		playerList.splice(leavingPlayerIndex, 1);	

		// check if user has entered a username yet (aka is a spectator)
		if(leavingPlayerName) {
			if(bluePlayers.includes(leavingPlayerName)) {
				bluePlayers.splice(bluePlayers.indexOf(leavingPlayerName), 1);
				io.sockets.emit('bluePlayerLeft', leavingPlayerName);
			} 
			else if(redPlayers.includes(leavingPlayerName)) {
				redPlayers.splice(redPlayers.indexOf(leavingPlayerName), 1);
				io.sockets.emit('redPlayerLeft', leavingPlayerName);
			}
			else {
				spectators.splice(spectators.indexOf(leavingPlayerName), 1);
				io.sockets.emit('spectatorLeft', leavingPlayerName);
			}	
		}

		// check if leaving player is a spymaster
		if(socket.id == blueSpyID){
			playerData.blueSpyExists = false;
			io.sockets.emit('blueSpyLeft');
		}
		else if(socket.id == redSpyID){
			playerData.redSpyExists = false;
			io.sockets.emit('redSpyLeft');
		}
		console.log("This player has left: " + leavingPlayerName);
		console.log(`${socket.id} disconnected`);
		console.log(playerData.spectators);
		//console.log(playerList);
	}); 

	// team setup
	/****************************************/
	socket.on('newPlayerJoined', (name) => {
		const { spectators } = playerData;

		const playerIndex = playerList.map(player => player.socketID).indexOf(socket.id);
		playerList[playerIndex].username = name;
		spectators.push(name);
		console.log("spectators after entering: " + spectators);
		console.log(playerList);
		io.sockets.emit('add new player', name);
	});

	socket.on('someoneChatted', ({ chatter, chatMessage }) => {
		playerData.chatter = chatter;
		playerData.chatMessage = chatMessage;
		io.sockets.emit('displayChatMessage', playerData);
	});

	socket.on('teamChat', ({ teamChatter, teamChatMessage, chatterTeamColor }) => {
		playerData.chatter = teamChatter;
		playerData.chatMessage = teamChatMessage;
		playerData.chatterTeamColor = chatterTeamColor;
		playerData.isTeamMessage = true;

		if(chatterTeamColor == 'blue'){
			for(let i = 0; i < playerData.blueIDs.length; i++)
				io.to(playerData.blueIDs[i]).emit('displayTeamChat', playerData);
		}
		else if(chatterTeamColor == 'red'){
			for(let i = 0; i < playerData.redIDs.length; i++)
				io.to(playerData.redIDs[i]).emit('displayTeamChat', playerData);
		}
		playerData.isTeamMessage = false;
	});

	socket.on('chatterSpan', () => {
		socket.emit('showClientChatter');
	});

	socket.on('playerJoinedBlue', (clientName) => {
		console.log("Player: " + clientName + " has joined blue team");
		const { bluePlayers, blueIDs, spectators } = playerData;

		bluePlayers.push(clientName);
		blueIDs.push(socket.id);
		io.sockets.emit('add blue player', clientName);
		spectators.splice(spectators.indexOf(clientName), 1);
		io.sockets.emit('removeSpectator', clientName);
	});

	socket.on('removeFromBlue', (bluePlayerToBeRemoved) => {
		const { bluePlayers, blueIDs } = playerData;
		console.log("current blue players: " + bluePlayers);

		bluePlayers.splice(bluePlayers.indexOf(bluePlayerToBeRemoved), 1);
		blueIDs.splice(blueIDs.indexOf(socket.id), 1);
		console.log("Blue players after removal: " + bluePlayers);
		io.sockets.emit('bluePlayerLeft', bluePlayerToBeRemoved);
	});

	socket.on('playerJoinedRed', (clientName) => {
		console.log("Player: " + clientName + " has joined red team");
		const { redPlayers, redIDs, spectators } = playerData;

		redPlayers.push(clientName);
		redIDs.push(socket.id);
		io.sockets.emit('add red player', clientName);
		spectators.splice(spectators.indexOf(clientName), 1);
		io.sockets.emit('removeSpectator', clientName);
	});

	socket.on('removeFromRed', (redPlayerToBeRemoved) => {
		const { redPlayers, redIDs } = playerData;
		console.log("current red players: " + redPlayers);

		redPlayers.splice(redPlayers.indexOf(redPlayerToBeRemoved), 1);
		redIDs.splice(redIDs.indexOf(socket.id), 1);
		console.log("Red players after removal: " + redPlayers);
		io.sockets.emit('redPlayerLeft', redPlayerToBeRemoved);
	});

	socket.on('blueSpySelected', (nameOfSpyMaster) => {		
		playerData.blueSpyExists = true;
		playerData.blueSpyMaster = nameOfSpyMaster;
		playerData.blueSpyID = socket.id;
		io.sockets.emit('someoneBecameBlueSpy', playerData, 'blue');
		
		if(playerData.blueSpyExists && playerData.redSpyExists) {
			io.sockets.emit('bothSpiesExist', true);
		} else {
			io.sockets.emit('bothSpiesExist', false);
		}
	});

	socket.on('highlightBlueSpy', () => {
		io.sockets.emit('highlightBlueSpy', playerData.blueSpyMaster);
	});

	socket.on('blueSpyChangedTeam', () => {
		playerData.blueSpyExists = false;
		io.sockets.emit('blueSpyChangedTeam');
	});
	
	socket.on('redSpySelected', (nameOfSpyMaster) => {
		playerData.redSpyExists = true;
		playerData.redSpyMaster = nameOfSpyMaster;
		playerData.redSpyID = socket.id;
		io.sockets.emit('someoneBecameRedSpy', playerData, 'red');

		if(playerData.blueSpyExists && playerData.redSpyExists) {
			io.sockets.emit('bothSpiesExist', true);
		} else {
			io.sockets.emit('bothSpiesExist', false);
		}
	});

	socket.on('highlightRedSpy', (nameOfRedSpy) => {
		io.sockets.emit('highlightRedSpy', playerData.redSpyMaster);
	});

	socket.on('redSpyChangedTeam', () => {
		playerData.redSpyExists = false;
		io.sockets.emit('redSpyChangedTeam');
	});


	// game has started
	/***********************************/
	socket.on('gameHasStarted', () => {
		gameData.gameHasStarted = true;
		io.sockets.emit('gameHasStarted');
	});

	socket.on('setUpGameWords', (boardWords) => {
		io.sockets.emit('setUpGameWords', boardWords);
		for(let i = 0; i < boardWords.length; i++){
			gameData.gameWords.push(boardWords[i]);
		}
	});

	socket.on('setUpBoardforSpies', (boardObject) => {
		const { randomIndices, divColors } = boardObject;

		for(let i = 0; i < randomIndices.length; i++){
			let randomIndex = randomIndices[i];
			gameData.gameBoardColors.push(divColors[randomIndex]);
		}
		io.to(playerData.blueSpyID).emit('youCanSeeTheBoard', boardObject);
		io.to(playerData.redSpyID).emit('youCanSeeTheBoard', boardObject);
	});

	socket.on('blueTeamStarts', () => {
		gameData.isBlueTurn = true;
		gameData.isRedTurn = false;
		gameData.numBlueCards = 9;
		gameData.numRedCards = 8;
		gameData.turnCounter++;

		io.to(playerData.blueSpyID).emit('createHintBox', gameData);
		io.sockets.emit('waitingForBlueSpy', gameData);
		io.sockets.emit('showScores', gameData);
		console.log("blue team starts");
	});

	socket.on('redTeamStarts', () => {
		gameData.isRedTurn = true;
		gameData.isBlueTurn = false;
		gameData.numBlueCards = 8;
		gameData.numRedCards = 9;
		gameData.turnCounter++;

		io.to(playerData.redSpyID).emit('createHintBox', gameData);
		io.sockets.emit('waitingForRedSpy', gameData);
		io.sockets.emit('showScores', gameData);
		console.log("red team starts");
	});

	socket.on('guessMessage', () => {
		io.sockets.emit('guessMessage', gameData);
	});

	socket.on('hintSubmitted', (hintData) => {
		gameData.numCardsToGuess = hintData.number;
		hintData.isBlueTurn = gameData.isBlueTurn;
		hintData.isRedTurn = gameData.isRedTurn;

		gameData.numCardsPicked = 0;
		gameData.turnIsOver = false;
		gameData.runOnce = true;
		gameData.runOnce2 = true;
		io.sockets.emit('revealHint', hintData);
	});

	socket.on('readyToGuess', () => {
		// tell only blue players to take their turn
		if(gameData.isBlueTurn){
			for(let i = 0; i < playerData.blueIDs.length; i++)
				io.to(playerData.blueIDs[i]).emit('start guessing phase');
		}
		// otherwise tell red players to
		else{
			for(let i = 0; i < playerData.redIDs.length; i++)
				io.to(playerData.redIDs[i]).emit('start guessing phase');
		}
	});

	socket.on('cardWasPicked', (cardCounter) => {
		//gameData.clientCallCounter = 0;
		gameData.clientCallCounter++;
		gameData.numCardsPicked++;
		gameData.cardSelected = cardCounter;
		gameData.runOnce2 = true;

		io.to(playerData.blueSpyID).emit('guessHasBeenMade', gameData);
		io.to(playerData.redSpyID).emit('guessHasBeenMade', gameData);
		io.sockets.emit('revealCardColor', gameData);
	});

	socket.on('showGuesser', (playerName) => {
		gameData.playerWhoGuessed = playerName;
		io.sockets.emit('showGuesser', gameData);
	});

	socket.on('updateCardCount', (colorOfCard) => {
		gameData.clientCallCounter = 0;

		if(gameData.runOnce2){
			gameData.runOnce2 = false;
			gameData.currentBoardColors[gameData.cardSelected] = colorOfCard;

			if(colorOfCard == 'blue')
				gameData.numBlueCards--;
			else if(colorOfCard == 'red')
				gameData.numRedCards--;
			else if(colorOfCard == 'yellow')
				gameData.numYellowCards--;
		
			io.sockets.emit('updateScore', gameData);
			console.log("blue: " + gameData.numBlueCards + "red: " + gameData.numRedCards + "yellow: " + gameData.numYellowCards);
		
			if(gameData.numBlueCards == 0){
				gameData.gameOver = true;
				io.sockets.emit('blueWins');
			}
			else if(gameData.numRedCards == 0){
				gameData.gameOver = true;
				io.sockets.emit('redWins');
			}
		}
	});

	socket.on('blackCard', () => {
		if(gameData.runOnce3){
			gameData.runOnce3 = false;
			if(gameData.isBlueTurn)
				io.sockets.emit('redWins');
			else
				io.sockets.emit('blueWins');
		}
	});

	socket.on('endTurn', () => {
		gameData.clientCallCounter++;
		gameData.turnIsOver = true;
		console.log("call counter: " +gameData.clientCallCounter);
		if(gameData.runOnce){
			gameData.runOnce = false;
			gameData.turnCounter++;
			if(gameData.isBlueTurn){
				// switch to red team's turn
				console.log("it is now red turn");
				gameData.isBlueTurn = false;
				gameData.isRedTurn = true;
				io.to(playerData.redSpyID).emit('createHintBox', gameData);
				io.sockets.emit('waitingForRedSpy', gameData);
				io.sockets.emit('end guessing phase');
			}
			else if(gameData.isRedTurn){
				// switch to blue team's turn
				console.log("it is now blue turn");
				gameData.isBlueTurn = true;
				gameData.isRedTurn = false;
				io.to(playerData.blueSpyID).emit('createHintBox', gameData);
				io.sockets.emit('waitingForBlueSpy', gameData);
				io.sockets.emit('end guessing phase');
			}
		}
	});

	socket.on('restartGame', () => {		
		io.to(playerData.blueSpyID).emit('removeSpyInputs');
		io.to(playerData.redSpyID).emit('removeSpyInputs');
		io.sockets.emit('restartingGame', playerList);
		io.sockets.emit('resetTheChat');

		for(let i = 0; i < playerList.length; i++) {
			playerList[i].username = null;
		}

		playerData.spectators = [];
		playerData.bluePlayers = [];
		playerData.blueIDs = [];
		playerData.redPlayers = [];
		playerData.redIDs = [];
		playerData.blueSpyMaster = '';
		playerData.redSpyMaster = '';
		playerData.blueSpyExists = false;
		playerData.redSpyExists = false;
		playerData.blueSpyID = 0;
		playerData.redSpyID = 0;

		gameData.currentBoardColors = ['lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey', 'lightgrey'];
		gameData.gameBoardColors = [];	
		gameData.gameWords = [],
		gameData.turnCounter = 0;
		gameData.isBlueTurn = false;
		gameData.isRedTurn = false;
		gameData.gameHasStarted = false;
		gameData.numBlueCards = 0;
		gameData.numRedCards = 0;
		gameData.numYellowCards = 7;
		gameData.numBlackCards = 1;
		gameData.numCardsToGuess = 0;
		gameData.numCardsPicked = 0;
		gameData.cardSelected = 0;
		gameData.turnIsOver = false;
		gameData.clientCallCounter = 0;
		gameData.runOnce = true;
		gameData.runOnce2 = true;
		gameData.runOnce3 = true;
		gameData.gameOver = false; 

		io.sockets.emit('newBoard', gameData);
		console.log("telling clients to restart");
	});
});
