var path = require('path');
var Phaser = require('phaser');
var _ = require('lodash');
var dat = require('dat-gui');
var async = require('async');

var isDecoded = false;
var statusText = null;
var soundsLoaded = {
  current: 0,
  total: 0
};

// DEBUGGING
window.game = game;
window.gui = new dat.GUI();
// DEBUGGING

var STAGE_BACKGROUND = '#3f261c';

var activeScene;

// CREATE GAME
var game = new Phaser.Game(800, 480, Phaser.AUTO, 'content', { preload: preload, update: update });
window.game = game;

/*******************************************************************************
 * INITIALIZE
 ******************************************************************************/
function preload() {
  statusText = game.add.text(10,10,'Load started', {fill: '#FFF'});

  game.load.onLoadStart.add(loadStart);
  game.load.onFileComplete.add(fileComplete);
  game.load.onLoadComplete.add(loadComplete);
  game.sound.onSoundDecode.add(soundDecoded);

  preloadScenes();
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
