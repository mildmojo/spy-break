/* jshint node:true */
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

module.exports = Router;

util.inherits(Router, EventEmitter);

function Router(server) {
  if (!(this instanceof Router)) return new Router(server);
  this._clients = [];
  this._rooms = {};

  server.on('connection', this.addClient);

  _.bindAll(this);
}

var $class = Router.prototype;

$class.addClient = function(socket) {
  var client = new Client(socket);
  this._clients.push(client);
  socket.on('data', this.messageRouter.bind(this, client));
  socket.on('close', this.removeClient.bind(this, client));
};

$class.removeClient = function(client) {
  client.rooms.forEach(function(room) {
    room.removeClient(client);
  });
  this._clients = _(this._clients).without(client);

};

$class.messageRouter = function(client, data) {
  // message = '/rooms/4AE6|command|body
  var parts = data.split('|');
  var paths = parts[0].split('/').slice(1); // trim empty string from root slash
  var command = parts[1];
  var body = parts[2];

  var commands = {
    join: function(roomName) {
      var room = this._rooms[roomName];
      if (!room) {
        room = new Room(roomName);
        this._rooms[roomName] = room;
        this.emit('room_added', room, client);
      }
      room.addClient(client);
      client.joinRoom(room);
    },
    leave: function(roomName) {
      var room = this._rooms[roomName];
      if (!room) return;
      room.removeClient(client);
      if (!room.hasClients) {
        this._rooms = _(this._rooms).omit(roomName);
        this.emit('room_removed', room);
      }
    }
  };

  if (paths[0] === 'rooms') {
    var roomName = paths[1];
    commands[command].call(this, roomName, body);
  }
};


function Client(socket) {
  if (!(this instanceof Client)) return new Client(socket);
  this.socket = socket;
  this.rooms = [];
  this.id = this._genID(5);

  this.joinRoom = function(room) {
    this.rooms.push(room);
  };

  this.emit = function(message) {
    this.socket.send(message);
  };

  this.toJSON = function() {
    return JSON.stringify({
      id: this.id
    });
  };

  this._genID = function(length) {
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = '';
    for (var i = length; i > 0; --i) {
      result += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return result;
  };
}

function Room(roomName) {
  this.id = this._genID(5);
  this.clients = [];

  this.addClient = function(client) {
    this.broadcast('client', 'join', client.toJSON());
    this.clients.push(client);
  };

  this.removeClient = function(client) {
    this.clients = _(this.clients).without(client);
    this.broadcast('client', 'leave', client.toJSON());
  };

  this.broadcast = function(message) {
    var msg = arguments.length > 1 ? this.toMessage.apply(this, arguments) : message;
    this.clients.forEach(function(client) {
      client.emit(message);
    });
  };

  this._toMessage = function() {
    return Array.prototype.slice.call(arguments).join(':');
  };

  this._genID = function(length) {
    var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
    var result = '';
    for (var i = length; i > 0; --i) {
      result += chars[Math.round(Math.random() * (chars.length - 1))];
    }
    return result;
  };
}
