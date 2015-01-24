var path = require('path');
var Phaser = require('phaser');
var _ = require('lodash');
var dat = require('dat-gui');
var async = require('async');
// var Filer = require('filer');

var audioAssets = require('../../radio_assets/assets.js');
var Playlist = require('./playlist.js');
var AudioClip = require('./audio_clip.js');
var AudioDB = require('./audio_db.js');

var TitleScene = require('./scenes/title.js');
var MenuScene = require('./scenes/menu.js');
var GameScene = require('./scenes/game.js');
var CreditsScene = require('./scenes/credits.js');

// DEBUGGING
window.game = game;
window.gui = new dat.GUI();
// DEBUGGING

var STATION_NAMES = [
  'pop',
  'electronic',
  'acoustic',
  'talk',
];
var STATION_COUNT = _.size(STATION_NAMES);
var STATION_PATHS = _(STATION_NAMES).reduce(function(sum, name) {
  sum[name] = '../radio_assets/stations/' + name;
  return sum;
}, {});

var STAGE_BACKGROUND = '#3f261c';

var stationAssetKeys = {};
var statusText;
var isLoaded = false;
var isDecoded = false;
var soundsLoaded = {current: 0, total: 0};
var stations;
var activeScene;

// CREATE GAME
var game = new Phaser.Game(960, 480, Phaser.AUTO, 'content', { preload: preload, update: update });
window.game = game;

// var fs = new Filer.FileSystem({
//   name:     'disc-jockey-jockey-audio',
//   flags:    ['FORMAT'],
//   provider: new Filer.FileSystem.providers.IndexedDB()
// });

var db = {};

/*******************************************************************************
 * INITIALIZE
 ******************************************************************************/
function preload() {
  game.load.onLoadStart.add(loadStart);
  game.load.onFileComplete.add(fileComplete);
  game.load.onLoadComplete.add(loadComplete);
  // game.sound.onSoundDecode.add(soundDecoded);

  db = new AudioDB('disc-jockey-jockey-audio', game.sound.context);

  preloadAudio(db);
  preloadScenes(db);
}

function preloadAudio(db) {
  var audioAssetPaths = {};
  for (var station in audioAssets) {
    for (var kind in audioAssets[station]) {
      stationAssetKeys[kind] = stationAssetKeys[kind] || {};
      stationAssetKeys[kind][station] = [];
      var filenames = Object.keys(audioAssets[station][kind]);
      for (var key in audioAssets[station][kind]) {
        soundsLoaded.total++;
        stationAssetKeys[kind][station].push(key);
        var audioPath = path.join('../radio_assets', audioAssets[station][kind][key]);
        if (key in audioAssetPaths) console.error('Duplicates: ' + audioPath + ' & ' + audioAssetPaths[key]);
        audioAssetPaths[key] = audioPath;
        // game.load.audio(key, audioPath);
      }
    }
  }

  var preloadStartedAt = Date.now();

  var keys = Object.keys(audioAssetPaths);
console.log('soundsLoaded.total: ' + soundsLoaded.total + ', keys.length: ' + keys.length);
console.log(keys);
  db.open(function() {
    async.eachLimit(keys, 6,
      function each(key, nextKey) {
  doTimer();
        var audioPath = audioAssetPaths[key];
        // Load DB last modified
        // If no hit, load XHR
        // if hit, check XHR last modified
        // If mismatched, load XHR
        async.waterfall([
          function checkDBLastModified(next) {
            db.pluck(key, 'lastModifiedAt', function(err, dbLastModifiedAt) {
              next(err, dbLastModifiedAt);
            });
          },
          function checkXHRLastModified(dbLastModifiedAt, next) {
            if (!dbLastModifiedAt) return next(null, true);
            xhrLastModifiedAt(audioPath, function(err, netLastModifiedAt) {
              // On XHR error checking modified date, if we already have the
              // file in the DB, use it rather than risking a failed XHR fetch.
              if (err) return next(null, false);
              // Fetch if DB is out of date.
              next(null, +dbLastModifiedAt !== +netLastModifiedAt);
            });
          },
          function fetchFile(shouldFetch, next) {
console.log((shouldFetch ? 'FETCH' : 'NO FETCH') + ' ' + key);
            if (!shouldFetch) {
              soundLoaded();
              return next();
            }
            xhrLoadArrayBuffer(audioPath, function(err, data, lastModifiedAt) {
      console.log(audioPath + ' loaded ' + doTimer());
              if (err) return next(err);
              db.storeFile(key, data, lastModifiedAt, function(err) {
                if (err) return next(err);
    console.log(key + ' written to indexedDB ' + doTimer());
                soundLoaded();
                next();
              });
            });
          }
        ], function fetchComplete(err, _lastResult) {
          nextKey(err);
        });
      },
      function allComplete(err) {
        // var key = keys[0];
  console.log('ALL COMPLETE ' + (Date.now() - preloadStartedAt));
        if (err) return console.error(err);

      });
  });
}

function preloadScenes(db) {
  TitleScene = TitleScene(game, db);
  MenuScene = MenuScene(game, db);
  GameScene = GameScene(game, db);
  CreditsScene = CreditsScene(game, db);

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
  // game.add.text(10,10,'Load started', {fill: '#FFF'});
}

function fileComplete(progress, cacheKey, success, totalLoaded, totalFiles) {
  var msg = progress + '% complete, ' + cacheKey + ' loaded';

  if (!statusText) {
    statusText = game.add.text(10, 30, msg, {fill: '#FFF'});
  } else {
    statusText.setText(msg);
  }
}

function loadComplete() {
  statusText.setText('Loading sounds...');
  isLoaded = true;
  create();
}

function soundLoaded() {
  soundsLoaded.current++;
  // statusText.setText('Sound load progress: ' + Math.floor(100 * soundsLoaded.current / soundsLoaded.total) + '%');
  statusText.setText('Sounds loaded: ' + soundsLoaded.current + '/' + soundsLoaded.total);
  if (soundsLoaded.current === soundsLoaded.total) {
    statusText.setText('All sounds decoded!');
    isDecoded = true;
    create();
  }
}

function create() {
  // game.sound.context is the WebAudio context
  // var text = "- phaser -\n with a sprinkle of \n pixi dust.";
  // var style = { font: "65px Arial", fill: "#ff0044", align: "center" };
  // var t = game.add.text(game.world.centerX-300, 0, text, style);
  if (!isLoaded || !isDecoded) return;

  // statusText.visible = false;
  statusText.destroy();

  STATION_NAMES.forEach(function(name) {
    var playlist = _createStationPlaylist(name, stationAssetKeys);
    GameScene.addStation(name, playlist);
  });

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

function _createStationPlaylist(name, assets) {
//   function getBuffer(key) {
//     var buffer = game.cache.getSoundData(key);
//     buffer.soundKey = key;
//     return buffer;
//   }
//   function getBackAnnounceBuffer(sum, key) {
//     var baKey = key + '_BA';
//     if (!game.cache.checkSoundKey(baKey)) return null;
//     var buffer = game.cache.getSoundData(baKey);
//     buffer.soundKey = baKey;
// console.log('soundkey: %s, duration: %s', key, buffer.duration);
//     sum[key] = buffer;
//     return sum;
//   }
  return new Playlist(game.sound.context,
                      db,
                      name,
                      assets.songs[name],
                      assets.talks[name],
                      assets.stationIDs[name],
                      assets.preChatters[name],
                      assets.postChatters[name],
                      assets.songs[name]);
}

function _loadScene(scene, options) {
  console.log('loading scene: ' + scene.name);
  activeScene = scene;
  activeScene.start(options);
}

// Callback signature: cb(err, arraybuffer, lastModifiedAt)
function xhrLoadArrayBuffer(path, callback) {
  var request = new XMLHttpRequest();
  request.open('GET', path, true);
  request.responseType = 'arraybuffer';
  request.addEventListener('progress', onprogress.bind(this));
  request.addEventListener('load', onload);
  request.addEventListener('error', onerror);
  request.addEventListener('abort', onabort);

  function onprogress(e) {
    if (e.lengthComputable) {
      var percentComplete = e.loaded / e.total;
      // ...
    } else {
      // Unable to compute progress information since the total size is unknown
    }
  }

  function onload() {
    if (this.status >= 200 && this.status < 400){
      var lastModifiedAt = new Date(this.getResponseHeader('Last-Modified'));
      if (!isFinite(lastModifiedAt.getTime())) lastModifiedAt = new Date();
      callback(null, this.response, lastModifiedAt);
    } else {
      // We reached our target server, but it returned an error
      callback(new Error('Failed to load ' + path + ': ' + this.statusText));
    }
  }

  function onerror(err) { callback(err); }
  function onabort() { callback(new Error('Aborted loading ' + path)); }

  request.send();
}

function xhrLastModifiedAt(path, callback) {
  var request = new XMLHttpRequest();
  request.open('HEAD', path, true);
  request.addEventListener('load', onload);
  request.addEventListener('error', onerror);
  request.addEventListener('abort', onabort);

  function onload() {
    if (this.status >= 200 && this.status < 400){
      var lastModifiedAt = new Date(this.getResponseHeader('Last-Modified'));
      if (!isFinite(lastModifiedAt.getTime())) lastModifiedAt = new Date();
      callback(null, lastModifiedAt);
    } else {
      // We reached our target server, but it returned an error
      callback(new Error('Failed to load ' + path + ': ' + this.statusText));
    }
  }

  function onerror(err) { callback(err); }
  function onabort() { callback(new Error('Aborted loading ' + path)); }

  request.send();
}

var timer = Date.now();
function doTimer() {
  var time = Date.now() - timer;
  timer = Date.now();
  return time;
}
