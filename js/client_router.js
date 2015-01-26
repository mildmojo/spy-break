/* jshint node:true */
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;

module.exports = ClientRouter;

util.inherits(ClientRouter, EventEmitter);

function ClientRouter(socket, roomName) {
  this.socket = socket;
  this.roomName = roomName;

  this.socket.onopen = this.onConnect.bind(this);
  this.socket.onmessage = this.router.bind(this);
  this.socket.onclose = this.onDisconnect.bind(this);
}

var $class = ClientRouter.prototype;

$class.onConnect = function() {
  if (this.roomName) this.joinRoom(this.roomName);
  this.emit('connect');
};

$class.onDisconnect = function() {
  // TODO: retry reconnect?
  console.log('Socket disconnected.');
};

$class.joinRoom = function(roomName) {
  this.socket.send('/rooms/' + roomName + '|join');
};

$class.router = function(event) {
  var parts = event.data.split(':');
  var command = parts[0];
  var body = parts.slice(1).join(':');

  try {
    body = JSON.parse(body);
  } catch(e) {
    // Ignore JSON parse errors. Body may not be JSON.
  }

  this.emit(command, body);
};
