var _ = require('lodash');

module.exports = ShuffleDeck;

// Ported from Unity javascript written for The Bombay Intervention. Woo JS!
function ShuffleDeck(cards) {
  this.lastReshuffle = 0;
  this._cards = cards || [];
  this._nextCard = 0;
  this.reshuffle();
}

var $class = ShuffleDeck.prototype;

$class.count  = function()      { return this._cards.length; };
$class.length = $class.count;
$class.add    = function(item)  { this._cards.push(item); return this; };
$class.remove = function(item)  { this._cards = _(this._cards).without(item); return this; };

$class.sort = function(func) {
  if (func)
    this._cards.sort(func);
  else
    this._cards.sort();

  return this;
};

$class.reshuffle = function() {
  var newDeck = [];
  while (this._cards.length > 0) {
    var idx = Math.floor(Math.random() * this._cards.length);
    newDeck.push(this._cards[idx]);
    this._cards.splice(idx, 1);
  }
  this._cards = newDeck;
  this._nextCard = 0;
  this.lastReshuffle++;
};

$class.draw = function(count) {
  if (!count && count !== 0) count = 1;
  if (count > this._cards.length) count = this._cards.length;
  var hand = [];

  _(count).times(function() {
    hand.push(this._drawOne());
  }.bind(this));

  return hand.length === 1 ? hand[0] : hand;
};

$class._drawOne = function() {
  if (this._cards.length === 0) return null;

  if (this._nextCard >= this._cards.length) {
    this.reshuffle();
  }

  return this._cards[this._nextCard++];
};
