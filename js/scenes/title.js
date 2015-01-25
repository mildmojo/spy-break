module.exports = TitleScene;

function TitleScene(game, audioDB) {
  if (!(this instanceof TitleScene)) return new TitleScene(game);
  this.name = 'title';
  this.game = game;
  this.audioDB = audioDB;
  this._onFinishFunc = function(){};
}

var $class = TitleScene.prototype;

$class.reset = function() {

};

$class.preload = function() {
  game.load.image('logo', 'images/spybreak_logo.png');
  // LOADING
  // (play witty banter)
};

$class.start = function() {
  console.log('Started Title scene.');
  game.add.sprite(0, 0, 'logo');
  game.time.events.add(Phaser.Timer.SECOND * 4, this._onFinishFunc);
  this._onFinishFunc();
};

$class.update = function() {

};

$class.onFinish = function(func) {
  this._onFinishFunc = func;
};
