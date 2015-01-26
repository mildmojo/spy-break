/* jshint node:true */
'use strict';

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var challenges = require('./challenges.js');

/*
  client messages:
  - shutdown: server is shutting down
  - syncState: payload = {show: {title: '', desc: ''},
                          tell: {type,initialValues,labels,labelsOn,labelsOff,lockedStates...},
                          roundRemaining: 0}
*/

module.exports = SpyBreak;

function SpyBreak(router) {
  this._router = router;
  this._games = {};

  _.bindAll(this);

  router.on('room_added', this.newGame);
  router.on('room_removed', this.stopGame);
  router.on('resync', this.resyncRoom);
}

var $class = SpyBreak.prototype;

$class.newGame = function(room, client) {
  var game = new GameInstance(room, client);
  this._games[room.id] = game;
  game.start();
};

$class.stopGame = function(room) {
  var game = this._games[room.id];
  if (!game) return;
  this._games = _(this._games).omit(room.id);
  game.stop();
};

$class.resyncRoom = function(room, client) {
  var game = this._games[room.id];
  if (!game) return;
  game.sync(client);
};


function GameInstance(room, clientOwner) {
  var MAX_ROUND_TIME = 30 * 1000;
  var WIN_COUNT = 4;
  this.room = room;
  this.clientOwner = clientOwner;
  this.state = 'lobby';
  this.stateMachine = new EventEmitter();
  this.currentChallenge = null;
  this.challengeCount = 0;
  this.roundTime = MAX_ROUND_TIME;
  this.roundStartedAt = 0;
  this._intervals = [];
  this._timeouts = [];

  var transitions = {
    '* => lobby': function() {
      this._clearTimers();

      // wait for players to click in
      var challenge = this.startChallenge(this.room, challenges.Lobby);
      room.on('clientJoin', function(client) {
        challenge.init(room);
        this.sync(client);
      }.bind(this));
      challenge.on('solved', function() {
        // Start round timer. If it expires before a win, players lose.
        this.roundStartedAt = Date.now();
        this._timeouts.push(setTimeout(function() {
          this.stateMachine.emit('transition', 'lose');
        }, this.roundTime));

        this.stateMachine.emit('transition', 'start');
      }.bind(this));


      // this.currentChallenge = challenge;
      // // TEMP: lose in 10 seconds
      // this._timeouts.push(setTimeout(function() {
      //   this.stateMachine.emit('transition', 'lose');
      // }.bind(this), 10000));

      // this._timeouts.push(setTimeout(function() { //testing
      //   this.stateMachine.emit('transition', 'start');
      // }.bind(this), 1000)); //testing
    },
    '* => start': function() {
      // pick challenge
      // start timer
      // send challenge data
      // transition to challenge
      var challenge = challenges.deck.drawOne();
      this.startChallenge(this.room, challenge);
      this.stateMachine.emit('transition', 'challenge');
    },
    'start => challenge': function() {
      // handle challenge comms?
      // when challenge requirements met, transition to next_challenge
      this.currentChallenge.on('solved', function() {
        this.stateMachine.emit('transition', 'next_challenge');
      });
    },
    'challenge => next_challenge': function() {
      // if all challenges complete, transition to win state
      // else transition to start
      if (++this.challengeCount >= WIN_COUNT) {
        this.stateMachine.emit('transition', 'win');
      } else {
        this.stateMachine.emit('transition', 'start');
      }
    },
    'next_challenge => win': function() {
      this._clearTimers();
      // wait for everyone to click in to start again
      var challenge = this.startChallenge(this.room, challenges.WinLobby);

      challenge.on('solved', function() {
        this.stateMachine.emit('transition', 'lobby');
      }.bind(this));
    },
    '* => lose': function() {
      this._clearTimers();
      // wait for players to click in
      var challenge = this.startChallenge(this.room, challenges.FailLobby);

      challenge.on('solved', function() {
        this.stateMachine.emit('transition', 'lobby');
      }.bind(this));
    },
    '* => dying': function() {
      this._clearTimers();
      // game is shutting down
      console.log('Game shutting down.');
      this.room.broadcast('shutdown');
    }
  };

  this.stateMachine.on('transition', function(newState) {
    var transition = this.state + ' => ' + newState;
    var wildcardTransition = '* => ' + newState;
    var isTransitioned = false;
console.log(transition);
    if (transitions[transition]) {
      this.state = newState;
      transitions[transition].call(this);
      isTransitioned = true;
    }
    if (transitions[wildcardTransition]) {
      this.state = newState;
      transitions[wildcardTransition].call(this);
      isTransitioned = true;
    }
    // if (isTransitioned) {
    //   this.sync();
    // }
  }.bind(this));

  this.start = function() {
    this.stateMachine.emit('transition', 'lobby');
  };

  this.stop = function() {
    this.stateMachine.emit('transition', 'dying');
  };

  this.startChallenge = function(room, challengeClass) {
    var challenge = new challengeClass();
    var clients = room.getClients();
    room.on('client:updateValues', function update(client, newValues) {
      challenge.updateValues(client, newValues);
      challenge.checkResults();
    });
    challenge.on('solved', function() {
      room.removeListener('client:updateValues', update);
    });
    challenge.init(room);
    this.currentChallenge = challenge;

    // Sync clients to new challenge state.
    clients.forEach(this.sync.bind(this));

    return challenge;
  };

  this.sync = function(client) {
    // retransmit complete game state to clients
    // must be idempotent on clients
    var tell = this.currentChallenge.tells[client.id];
    var show = this.currentChallenge.shows[client.id];
// var util = require('util');
// console.log(util.inspect(this.currentChallenge.tells));
// console.log(util.inspect(this.currentChallenge.shows));
    var clientState = {
      tell: tell,
      show: show,
      roundRemaining: this.roundTime - (Date.now() - this.roundStartedAt)
    };
console.log('Sync for client %s: %s', client.id, JSON.stringify(clientState));
    client.emit('syncState:' + JSON.stringify(clientState));
  };

  this._clearTimers = function() {
    this._intervals.forEach(function(intervalID) {
      clearInterval(intervalID);
    });

    this._timeouts.forEach(function(timeoutID) {
      clearTimeout(timeoutID);
    });
  };
}
