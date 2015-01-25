module.exports = GameScene;

function GameScene(game, audioDB) {
  if (!(this instanceof GameScene)) return new GameScene(game);
  this.name = 'title';
  this.game = game;
  this.audioDB = audioDB;
  this._onFinishFunc = function(){};
}

var $class = GameScene.prototype;

$class.reset = function() {

};

$class.preload = function() {
  // LOADING
  // (play witty banter)
};

$class.start = function() {
  console.log('Started Game scene.');
  this._onFinishFunc();
};

$class.update = function() {

};

$class.onFinish = function(func) {
  this._onFinishFunc = func;
};
