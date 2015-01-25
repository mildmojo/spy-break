module.exports = CreditsScene;

function CreditsScene(game, audioDB) {
  if (!(this instanceof CreditsScene)) return new CreditsScene(game);
  this.name = 'title';
  this.game = game;
  this.audioDB = audioDB;
  this._onFinishFunc = function(){};
}

var $class = CreditsScene.prototype;

$class.reset = function() {

};

$class.preload = function() {
  // LOADING
  // (play witty banter)
};

$class.start = function() {
  console.log('Started Credits scene.');
  this._onFinishFunc();
};

$class.update = function() {

};

$class.onFinish = function(func) {
  this._onFinishFunc = func;
};
