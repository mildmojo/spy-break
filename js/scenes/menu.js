module.exports = MenuScene;

function MenuScene(game, audioDB) {
  if (!(this instanceof MenuScene)) return new MenuScene(game);
  this.name = 'title';
  this.game = game;
  this.audioDB = audioDB;
  this._onFinishFunc = function(){};
}

var $class = MenuScene.prototype;

$class.reset = function() {

};

$class.preload = function() {
  // LOADING
  // (play witty banter)
};

$class.start = function() {
  console.log('Started Menu scene.');
  this._onFinishFunc();
};

$class.update = function() {

};

$class.onFinish = function(func) {
  this._onFinishFunc = func;
};

$class.onGameScene = function(func) {
  this._onGameSceneFunc = func;
};

$class.onCreditsScene = function(func) {
  this._onCreditsSceneFunc = func;
};
