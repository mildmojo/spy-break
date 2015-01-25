/* jshint node:true */
'use strict';

var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

module.exports = SpyBreak;

function SpyBreak(router) {
  this._router = router;
  this._games = {};

  router.on('room_added', this.newGame);
  router.on('room_removed', this.stopGame);

  _.bindAll(this);
}

var $class = SpyBreak.prototype;

$class.newGame = function(room, client) {
  this._games[room] = new GameInstance(room, client);
};

$class.stopGame = function(room) {
  var game = this._games[room.id];
  if (!game) return;
  game.stop();
  this._games = _(this._games).omit(room.id);
};


function GameInstance(room, clientOwner) {
  this.state = 'lobby';
  this.stateMachine = new EventEmitter();

  var transitions = {
    '* => lobby': function() {
      // wait for players to click in
      this.stateMachine.emit('transition', 'start');
    },
    'lobby => start': function() {
      // pick challenge
      // start timer
      // send challenge data
      // transition to challenge
      this.stateMachine.emit('transition', 'challenge');
    },
    'start => challenge': function() {
      // handle challenge comms?
      // when challenge requirements met, transition to next_challenge
      this.stateMachine.emit('transition', 'next_challenge');
    },
    'challenge => next_challenge': function() {
      // if all challenges complete, transition to win state
      // else transition to start
      this.stateMachine.emit('transition', 'start');
    },
    'next_challenge => win': function() {
      // wait for everyone to click in to start again
      this.stateMachine.emit('transition', 'lobby');
    },
    '* => lose': function() {
      // show loss
      // wait for everyone to click in
      this.stateMachine.emit('transition', 'lobby');
    }
  };

  this.stateMachine.on('transition', function(newState) {
    var transition = this.state + ' => ' + newState;
    var wildcardTransition = '* => ' + newState;
    if (transitions[transition]) {
      this.state = newState;
      transitions[transition].call(this);
    }
    if (transitions[wildcardTransition]) {
      this.state = newState;
      transitions[wildcardTransition].call(this);
    }
  }.bind(this));
}
