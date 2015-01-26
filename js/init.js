var path = require('path');
var Phaser = require('phaser');
var _ = require('lodash');
// var dat = require('dat-gui');
var async = require('async');
var SockJS = require('sockjs-client');

var ClientRouter = require('./client_router.js');
var TitleScene = require('./scenes/title.js');
var MenuScene = require('./scenes/menu.js');
var GameScene = require('./scenes/game.js');
var CreditsScene = require('./scenes/credits.js');

var isDecoded = false;
var statusText = null;
var soundsLoaded = {
  current: 0,
  total: 0
};

var STAGE_BACKGROUND = '#1a1a1a';

var activeScene;

// CREATE GAME
var game = new Phaser.Game(800, 480, Phaser.AUTO, 'content', { preload: preload, update: update });

// DEBUGGING
window.game = game;
// window.gui = new dat.GUI();
// DEBUGGING

/*******************************************************************************
 * WARNING: MUST UPDATE sockjs-client DEP url-parse TO 1.0.0 OR CLIENTS WILL
 * FAIL WITH 'too much recursion' ERROR MESSAGE
 ******************************************************************************/
var url = 'http://localhost:3000/rooms';
var socket = new SockJS(url);
var clientRouter = new ClientRouter(socket);
clientRouter.on('clientJoin', function(id) {
  console.log('Saw client join: ' + id);
});
clientRouter.on('syncState', function(state) {
  console.log('Saw sync: ' + require('util').inspect(state));
});
clientRouter.on('connect', function() {
  clientRouter.joinRoom('test-room');
});

/*******************************************************************************
 * INITIALIZE
 ******************************************************************************/
function preload() {
  initScreen();

  statusText = game.add.text(10,10,'Load started', {fill: '#FFF'});

  game.load.onLoadStart.add(loadStart);
  game.load.onFileComplete.add(fileComplete);
  game.load.onLoadComplete.add(loadComplete);
  game.sound.onSoundDecode.add(soundDecoded);

  preloadScenes();
}

function initScreen() {
  game.stage.backgroundColor = STAGE_BACKGROUND;

  if (game.device.desktop) {
      game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
      game.scale.minWidth = 320;
      game.scale.minHeight = 480;
      game.scale.maxWidth = 1080;
      game.scale.maxHeight = 1920;
      game.scale.pageAlignHorizontally = true;
      game.scale.pageAlignVertically = true;
      game.scale.setScreenSize(true);
  } else {
      game.scale.scaleMode = Phaser.ScaleManager.SHOW_ALL;
      game.scale.minWidth = 277;
      game.scale.minHeight = 416;
      game.scale.maxWidth = 1080;
      game.scale.maxHeight = 1920;
      game.scale.pageAlignHorizontally = true;
      game.scale.pageAlignVertically = true;
      game.scale.forceOrientation(false, true);
      // game.scale.hasResized.add(screenResized, this);
      // game.scale.enterIncorrectOrientation.add(this.enterIncorrectOrientation, this);
      // game.scale.leaveIncorrectOrientation.add(this.leaveIncorrectOrientation, this);
      game.scale.setScreenSize(true);
      game.scale.setShowAll();
      game.scale.refresh();
  }
}

function preloadScenes(db) {
  TitleScene = TitleScene(game);
  MenuScene = MenuScene(game);
  GameScene = GameScene(game);
  CreditsScene = CreditsScene(game);

  TitleScene.preload();
  MenuScene.preload();
  GameScene.preload();
  CreditsScene.preload();

  TitleScene.onFinish(function() {
    _loadScene(MenuScene);
  });

  MenuScene.onGameScene(function(options) {
    _loadScene(GameScene, options);
  });

  MenuScene.onCreditsScene(function() {
    _loadScene(CreditsScene);
  });

  GameScene.onFinish(function() {
    _loadScene(MenuScene);
  });

  CreditsScene.onFinish(function() {
    _loadScene(MenuScene);
  });
}

function loadStart() {

}

function fileComplete() {

}

function loadComplete() {
  statusText.setText('Loading sounds...');
  isLoaded = true;
  create();
}

function soundDecoded() {
  soundsLoaded.current++;
  statusText.setText('Sounds loaded: ' + soundsLoaded.current + '/' + soundsLoaded.total);
  if (soundsLoaded.current === soundsLoaded.total) {
    statusText.setText('All sounds decoded!');
    isDecoded = true;
    create();
  }
}

function screenResized() {
  console.log('Screen resized! ' + [].slice.call(arguments).join(', '));
}

function create() {
  if (!isLoaded || !isDecoded) return;

  statusText.destroy();

  _loadScene(TitleScene);

  game.stage.backgroundColor = STAGE_BACKGROUND;
}

/*******************************************************************************
 * RUN
 ******************************************************************************/
function update() {
  if (!isLoaded || !isDecoded || !activeScene) return;
  activeScene.update();
}

function _loadScene(scene, options) {
  console.log('loading scene: ' + scene.name);
  activeScene = scene;
  activeScene.start(options);
}

var timer = Date.now();
function doTimer() {
  var time = Date.now() - timer;
  timer = Date.now();
  return time;
}
