/* jshint node:true */
'use strict';

var util = require('util');
var EventEmitter = require('events').EventEmitter;
var _ = require('lodash');

/*
  client messages:
  - clientJoin:<id> - someone joined
  - clientLeave:<id> - someone left
  - reconnectFailed - client wanted to reconnect to room, but room has no record
*/

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
  return client;
};

$class.removeClient = function(client) {
  if (client.room) {
    this.messageRouter(client, '/rooms/' + client.room.id + '|leave');
  }
  this._clients = _(this._clients).without(client).value();
};

$class.addRoom = function(roomName) {
  var room = new Room(roomName);
  this._rooms[room.id] = room;
  return room;
};

$class.removeRoom = function(room) {
  this._rooms = _(this._rooms).omit(room.id).value();
  this.emit('room_removed', room);
};

$class.messageRouter = function(client, data) {
console.log('GOT MESSSAGE: %s', data);
  // message = '/rooms/4AE6|command|body
  var parts = data.split('|');
  var paths = parts[0].split('/').slice(1); // trim empty string from root slash
  var command = parts[1];
  var body = parts[2];

  var clientCommands = {
    create: function(roomName) {
      var room = this.addRoom(roomName);
      room.addClient(client);
      client.joinRoom(room);
      this.emit('room_added', room, client);
    },
    join: function(roomName) {
      if (!roomName || !this._rooms[roomName]) return clientCommands.create.call(this, roomName);
      var room = this._rooms[roomName];
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
        client.emit('reconnectFailed');
        // redirect to front page?
      }
    },
    leave: function(roomName) {
      var room = this._rooms[roomName];
      if (!room) return;
      room.removeClient(client);
      client.leaveRoom();
      if (!room.hasClients()) {
        this.removeRoom(room);
      }
    },
    updateValues: function(roomName, body) {
      var room = this._rooms[roomName];
      if (!room) return;
      var bodyObj;
      try {
        bodyObj = JSON.parse(body);
      } catch(e) {
        console.error("Ignoring bad JSON updateValues command from '%s': %s", client.id, body);
      }
      room.updateValues(client, bodyObj);
    }
  };

  if (paths[0] === 'rooms') {
    var roomName = paths[1];
    clientCommands[command].call(this, roomName, body);
  }
};


/*******************************************************************************
 * CLIENT
 ******************************************************************************/
function Client(socket) {
  if (!(this instanceof Client)) return new Client(socket);
  this.socket = socket;
  this.room = null;
  this.id = this._genID(5);
  this.reconnectToken = this._genID(5);
}

var $classClient = Client.prototype;

$classClient.joinRoom = function(room) {
  // Joining should leave any other room joined.
  this.leaveRoom();
  this.room = room;
};

$classClient.leaveRoom = function() {
  if (this.room) this.room.removeClient(this);
  this.room = null;
};

$classClient.emit = function(message) {
  this.socket.write(message);
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
  // Alphanumerics except visually ambiguous ones (0/O, I/l).
  var chars = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  var result = '';
  for (var i = length; i > 0; --i) {
    result += chars[Math.round(Math.random() * (chars.length - 1))];
  }
  return result;
};


/*******************************************************************************
 * ROOM
 ******************************************************************************/
util.inherits(Room, EventEmitter);

function Room(roomName) {
  this.id = roomName || this._genID(5);
  this.clients = [];
}

var $classRoom = Room.prototype;

$classRoom.getClients = function() {
  return this.clients;
};

$classRoom.addClient = function(newClient) {
  // Tell everyone else in the room there's a new client.
  this.broadcast('clientJoin', newClient.id);
  // Tell the new client about all the existing clients in the room.
  this.clients.forEach(function(existingClient) {
    newClient.emit('clientJoin:' + existingClient.id);
  });
  this.clients.push(newClient);
  // Tell local listeners about the new client.
  this.emit('clientJoin', newClient);
};

$classRoom.removeClient = function(client) {
  this.clients = _(this.clients).without(client).value();
  // Tell remaining clients in this room about the departure.
  this.broadcast('clientLeave', client.id);
  // Tell local listeners about the departure.
  this.emit('clientLeave', client);
};

// Silently replace outdated client object with new client & socket.
$classRoom.spliceClient = function(newClient) {
  this.clients = _(this.clients).without(function(client) {
    return client.id === newClient;
  }).value();
  this.clients.push(newClient);
};

$classRoom.hasClients = function() {
  return !!this.clients.length;
};

$classRoom.updateValues = function(client, bodyObj) {
  this.emit('client:updateValues', client, bodyObj);
};

// Send network message to all clients. Argument can be a string or individual
// args for each field (heading, command, body).
//   this.broadcast('reset');
//   this.broadcast('client', 'leave', '{id: "4853e"}');
$classRoom.broadcast = function(message) {
  var msg = arguments.length > 1 ? this._toMessage.apply(this, arguments) : message;
  this.clients.forEach(function(client) {
    client.emit(msg);
  });
};

$classRoom._toMessage = function() {
  return Array.prototype.slice.call(arguments).join(':');
};

$classRoom._genID = function(length) {
  // Alphanumerics except visually ambiguous ones (0/O, I/l).
  var chars = '123456789abcdefghijkmnopqrstuvwxyzABCDEFGHJKLMNPQRSTUVWXYZ';
  var result = '';
  for (var i = length; i > 0; --i) {
    result += chars[Math.round(Math.random() * (chars.length - 1))];
  }
  return result;
};
