/* jshint node:true */
'use strict';

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

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
  game.sync();
};


function GameInstance(room, clientOwner) {
  this.state = 'lobby';
  this.stateMachine = new EventEmitter();
  this._intervals = [];
  this._timeouts = [];

  var transitions = {
    '* => lobby': function() {
      this._clearTimers();

      // wait for players to click in

      // TEMP: lose in 10 seconds
      this._timeouts.push(setTimeout(function() {
        this.stateMachine.emit('transition', 'lose');
      }.bind(this), 10000));

      this._timeouts.push(setTimeout(function() { //testing
        this.stateMachine.emit('transition', 'start');
      }.bind(this), 1000)); //testing
    },
    '* => start': function() {
      // pick challenge
      // start timer
      // send challenge data
      // transition to challenge
      this._timeouts.push(setTimeout(function() { //testing
        this.stateMachine.emit('transition', 'challenge');
      }.bind(this), 1000)); //testing
    },
    'start => challenge': function() {
      // handle challenge comms?
      // when challenge requirements met, transition to next_challenge
      this._timeouts.push(setTimeout(function() { //testing
        this.stateMachine.emit('transition', 'next_challenge');
      }.bind(this), 1000)); //testing
    },
    'challenge => next_challenge': function() {
      // if all challenges complete, transition to win state
      // else transition to start
      this._timeouts.push(setTimeout(function() { //testing
        var choice = Math.random() * 2;
        if (choice > 1) {
          this.stateMachine.emit('transition', 'start');
        } else {
          this.stateMachine.emit('transition', 'win');
        }
      }.bind(this), 1000)); //testing
    },
    'next_challenge => win': function() {
      this._clearTimers();
      // wait for everyone to click in to start again
      this._timeouts.push(setTimeout(function() { //testing
        this.stateMachine.emit('transition', 'lobby');
      }.bind(this), 1000)); //testing
    },
    '* => lose': function() {
      this._clearTimers();
      // show loss
      // wait for everyone to click in
      this._timeouts.push(setTimeout(function() { //testing
        this.stateMachine.emit('transition', 'lobby');
      }.bind(this), 1000)); //testing
    },
    '* => dying': function() {
      this._clearTimers();
      // game is shutting down
      console.log('Game shutting down.');
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
    if (isTransitioned) {
      this.sync();
    }
  }.bind(this));

  this.start = function() {
    this.stateMachine.emit('transition', 'lobby');
  };

  this.stop = function() {
    this.stateMachine.emit('transition', 'dying');
  };

  this.sync = function() {
    // retransmit complete game state to clients
    // must be idempotent on clients
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
