/* jshint node:true */
'use strict';

var path = require('path');
var SockJS = require('sockjs');
var express = require('express');
require('color');

var Router = require('./router.js');
var SpyBreak = require('./spy_break.js');

var app = express();

setupRoutes(app);

var server = app.listen(3000, function() {
  var host = server.address().host;
  var port = server.address().port;

  console.log('Spy Break server listening on %s:%d', host, port);
});

var sockServer = setupSockJS(server);
var router = new Router(sockServer);
var game = new SpyBreak(router);

function setupRoutes(app) {
  var staticOpts = {index: false, redirect: false};
  app.use('/css', express.static(path.resolve(__dirname, '../css'), staticOpts));
  app.use('/js', express.static(path.resolve(__dirname, '../js'), staticOpts));
  app.use('/images', express.static(path.resolve(__dirname, '../images'), staticOpts));

  app.get('/', staticFile('../index.html'));
  app.get('/bundle.js', staticFile('../bundle.js'));
  app.get('/node_modules/normalize.css/normalize.css',
          staticFile('../node_modules/normalize.css/normalize.css'));
}

function staticFile(filepath) {
  var absPath = path.resolve(__dirname, filepath);
  var root = path.dirname(absPath);
  var file = path.basename(absPath);
  return function(req, res) {
    res.sendFile(file, {root: root});
  };
}

function setupSockJS(server) {
  var sockServer = SockJS.createServer({
    sockjs_url: 'http://cdn.jsdelivr.net/sockjs/0.3.4/sockjs.min.js'
  });
  sockServer.installHandlers(server, {prefix: '/rooms'});
  return sockServer;
}
