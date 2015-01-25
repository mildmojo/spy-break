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

  _.bindAll(this);

  server.on('connection', this.addClient);
}

var $class = Router.prototype;

$class.addClient = function(socket) {
  var client = new Client(socket);
  this._clients.push(client);
  socket.on('data', this.messageRouter.bind(this, client));
  socket.on('close', this.removeClient.bind(this, client));
};

$class.removeClient = function(client) {
  if (client.room) {
    this.messageRouter(client, '/rooms/' + client.room.id + '|leave');
  }
  this._clients = _(this._clients).without(client);
};

$class.messageRouter = function(client, data) {
console.log('GOT MESSSAGE: %s', data);
  // message = '/rooms/4AE6|command|body
  var parts = data.split('|');
  var paths = parts[0].split('/').slice(1); // trim empty string from root slash
  var command = parts[1];
  var body = parts[2];
  var commands = {
    create: function(roomName) {
      var room = new Room(roomName);
      this._rooms[room.id] = room;
      room.addClient(client);
      client.joinRoom(room);
      this.emit('room_added', room, client);
    },
    join: function(roomName) {
      var room = this._rooms[roomName];
      if (!roomName || !room) return commands.create.apply(this, arguments);
      room.addClient(client);
      client.joinRoom(room);
    },
    rejoin: function(roomName, reconnectToken) {
      var room = this._rooms[roomName];
      var oldClient = _(this._clients).find(function(client) {
        return client.reconnectToken === reconnectToken;
      });
      if (oldClient) {
        client.fromJSON(oldClient.toJSON());
        room.spliceClient(client);
        this.emit('resync', room, client);
      } else {
        console.log('Bad reconnect');
        // redirect to front page?
      }
    },
    leave: function(roomName) {
      var room = this._rooms[roomName];
      if (!room) return;
      room.removeClient(client);
      client.leaveRoom();
      if (!room.hasClients()) {
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
  this.room = null;
  this.id = this._genID(5);
  this.reconnectToken = this._genID(5);
}

var $classClient = Client.prototype;

$classClient.joinRoom = function(room) {
  this.room = room;
};

$classClient.leaveRoom = function() {
  this.room = null;
};

$classClient.emit = function(message) {
  this.socket.send(message);
};

$classClient.toJSON = function() {
  return JSON.stringify({
    id: this.id,
    reconnectToken: this.reconnectToken
  });
};

$classClient.fromJSON = function(json) {
  var attrs = JSON.parse(json);
  this.id = this.id || attrs.id;
  this.reconnectToken = this.reconnectToken || attrs.reconnectToken;
};

$classClient._genID = function(length) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var result = '';
  for (var i = length; i > 0; --i) {
    result += chars[Math.round(Math.random() * (chars.length - 1))];
  }
  return result;
};


function Room(roomName) {
  this.id = roomName || this._genID(5);
  this.clients = [];
}

var $classRoom = Room.prototype;

$classRoom.addClient = function(client) {
  this.broadcast('client', 'join', client.toJSON());
  this.clients.push(client);
};

$classRoom.removeClient = function(client) {
  this.clients = _(this.clients).without(client);
  this.broadcast('client', 'leave', client.toJSON());
};

// Silently replace outdated client object with new client & socket.
$classRoom.spliceClient = function(newClient) {
  this.clients = _(this.clients).without(function(client) {
    return client.id === newClient;
  });
  this.clients.push(newClient);
};

$classRoom.hasClients = function() {
  return !!this.clients.length;
};

// Send network message to all clients. Argument can be a string or individual
// args for each field (heading, command, body).
//   this.broadcast('reset');
//   this.broadcast('client', 'leave', '{id: "4853e"}');
$classRoom.broadcast = function(message) {
  var msg = arguments.length > 1 ? this._toMessage.apply(this, arguments) : message;
  this.clients.forEach(function(client) {
    client.emit(message);
  });
};

$classRoom._toMessage = function() {
  return Array.prototype.slice.call(arguments).join(':');
};

$classRoom._genID = function(length) {
  var chars = '0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ';
  var result = '';
  for (var i = length; i > 0; --i) {
    result += chars[Math.round(Math.random() * (chars.length - 1))];
  }
  return result;
};
