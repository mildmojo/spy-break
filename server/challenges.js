/* jshint node:true */
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');
var ShuffleDeck = require('./shuffle_deck.js');

var challenges = [
  CipherAttack
];

module.exports = {
  list: challenges,
  deck: new ShuffleDeck(challenges),
  Lobby: createClickThru({
    title: 'Lobby',
    desc: 'Sign into agency VPN to begin.',
    labelsOff: 'Connect',
    labelsOn: 'CONNECTED'
  }),
  WinLobby: createClickThru({
    title: 'Apprehended',
    desc: 'Suspect apprehended. Good work, people.',
    labelsOff: 'Return to HQ',
    labelsOn: 'Readying Jet...'
  }),
  FailLobby: createClickThru({
    title: '',
    desc: 'Not your finest hour. Watch your backs and lay low for a while.',
    labelsOff: 'Gather Passports',
    labelsOn: 'Returning Home...'
  })
};

// Returns an object with client IDs as keys and `value` as values.
function forEveryID(clients, value) {
  return clients.reduce(function(values, client) {
    values[client.id] = value;
    return values;
  }, {});
}

// Copy `oldObj` and set any `newIDs` not in `oldObj` set to `value`.
function forEveryNewID(oldObj, clients, value) {
  var oldIDs = Object.keys(oldObj);
  var diffIDs = _(clients).pluck('id');
  _(diffIDs).pull(oldIDs);
  var values = _(oldObj).clone();
  diffIDs.forEach(function(id) {
    values[id] = value;
  });
  return values;
}

function createClickThru(attrs) {
  util.inherits(ClickThruClass, EventEmitter);
  return ClickThruClass;

  function ClickThruClass() {
    this.constructor.super_.call(this);
    this.currentValues = {};
    this.tells = {};
    this.shows = {};

    this.init = function(room) {
      var clients = room.getClients();
      this.createTells(clients);
      this.createShows(clients);
    };

    this.createTells = function(clients) {
      this.tells = forEveryID(clients, {
        title: attrs.title,
        desc: attrs.desc
      });
      return this.tells;
    };

    this.createShows = function(clients) {
      this.currentValues = [false];
      this.shows = forEveryID(clients, {
        type:           'checkboxes',
        initialValues:  this.currentValues,
        labelsOff:      [attrs.labelsOff],
        labelsOn:       [attrs.labelsOn]
      });
      return this.shows;
    };

    this.updateValues = function(client, newValues) {
      this.currentValues[client.id] = newValues;
    };

    this.checkResults = function() {
      var isSolved = _(this.currentValues).all(function(values) {
        return values[0];
      });
      if (isSolved) {
        this.emit('solved');
      }
    };
  }
}

function CipherAttack() {
  var HAND_SIZE = 4;
  var caps = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ'.split('');
  this.symbolSet = caps.map(function(x) {
    var secondIdx = Math.floor(Math.random() * caps.length);
    return x + caps[secondIdx];
  });
  this.symbolDeck = new ShuffleDeck(this.symbolSet);
  this.commonSymbol = this.symbolDeck.drawOne();
  this.symbolDeck.remove(this.commonSymbol);
  this.currentValues = {};

  this.init = function(room) {
    var clients = room.getClients();
    this.createTells(clients);
    this.createShows(clients);
  };

  this.createTells = function(clients) {
    this.tells = clients.reduce(function(tells, client) {
      var tell = {
        title: 'Cipher Attack',
        desc: 'Only one symbol is found in every ciphertext. Compare notes with' +
              ' fellow agents.'
      };
      tells[client.id] = tell;
      return tells;
    }, {});
    return this.tells;
  };

  this.createShows = function(clients) {
    var self = this;
    var clientIDs = _(clients).pluck('id');

    this.shows = clientIDs.reduce(function(shows, id) {
      // Build hands of symbols.
      var symbolHand = self._buildHand();
      // Initialize all radio buttons to false.
      var initialValues = _.range(HAND_SIZE).map(function() { return false; });

      shows[id] = {
        // widgets type: radio_buttons, checkboxes, compass_widget
        type: 'radio_buttons',
        // object: client ID => array of initial states for widgets values
        initialValues: initialValues,
        // obj: client ID => array of labels for widgets
        labels: symbolHand
        // obj: client ID => array of labels for widgets when "on" or "selected"
        // labelsOn: [],
        // obj: client ID => array of labels for widgets when "off" or "unselected"
        // labelsOff: [],
        // obj: client ID => array of locked widgets which can't be affected by the user
        // lockedStates: [],
      };
      return shows;
    }, {}, this);

    return this.shows;
  };

  this.updateValues = function(client, newValues) {
    this.currentValues[client.id] = newValues;
  };

  this.checkResults = function() {
    var commonSymbol = this.commonSymbol;
    var isSolved = _(this.currentValues).all(function(values) {
      return values[0] === commonSymbol;
    });
    if (isSolved) {
      this.emit('solved');
    }
  };

  this._buildHand = function(mustHaveSymbol) {
    var hand = this.symbolDeck.draw(HAND_SIZE);
    hand = _.uniq(hand);
    if (!_(hand).contains(mustHaveSymbol)) {
      hand[Math.floor(Math.random() * hand.length)] = mustHaveSymbol;
    }
    while (hand.length < HAND_SIZE) {
      hand.push(this.symbolDeck.drawOne());
      hand = _.uniq(hand);
    }
    return hand;
  };
}
