var extend = require('extend'),
    LRU = require('lru-cache'),
    loadTile = require('./load-tile'),
    ImagicoElevationDownloader = require('./imagico'),
    _latLng = require('./latlng'),
    tileKey = require('./tile-key');

function TileSet(tileDir, options) {
    this.options = extend({}, {
        loadTile: loadTile,
        downloader: new ImagicoElevationDownloader(tileDir)
    }, options);
    if (options && options.downloader === undefined) {
        this.options.downloader = undefined;
    }
    this._tileDir = tileDir;
    this._tileCache = LRU({
        max: 1000,
        dispose: function (key, n) {
            if(n) {
                n.destroy();
            }
        }
    });
    this._loadingTiles = {};
}

TileSet.prototype.destroy = function() {
    this._tileCache.reset();
    delete this._tileCache;
};

TileSet.prototype.getElevation = function(latLng, cb) {
    var getTileElevation = function(tile, ll) {
            cb(undefined, tile.getElevation(ll));
        },
        ll = _latLng(latLng),
        key = tileKey(ll),
        tile = this._tileCache.get(key);
    // if (tile === undefined) console.log('no tile in tile cache')
    if (tile === 'failed') {
        cb({message: 'tile loading failed, couldnt get from cache'});
    }
    else if (tile) {
        setImmediate(function() {
            getTileElevation(tile, ll);
        });
    } else {
        // console.log('loading tile', key)
        this._loadTile(key, ll, function(err, tile) {
            // console.log('_loadTile callback. Error:', err)
            if (!err) {
                getTileElevation(tile, ll);
            } else {
                cb(err);
            }
        });
    }
};

TileSet.prototype._loadTile = function(tileKey, latLng, cb) {
    var loadQueue = this._loadingTiles[tileKey];
    // console.log(loadQueue)

    if (!loadQueue) {
        loadQueue = [];
        this._loadingTiles[tileKey] = loadQueue;
        this.options.loadTile.call(this, this._tileDir, latLng, function(err, tile) {
            var q = this._loadingTiles[tileKey];
            if(!err) {
                this._tileCache.set(tileKey, tile);
            } else {
                this._tileCache.set(tileKey, 'failed');
            }
            q.forEach(function(cb) {
                if (err) {
                    // console.log(err)
                    cb(err);
                } else {
                    cb(undefined, tile);
                }
            });
            delete this._loadingTiles[tileKey];
        }.bind(this));
    }

    loadQueue.push(cb);
};

module.exports = TileSet;