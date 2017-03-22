'use strict';

// Load modules
const Fs     = require('fs');
const Path   = require('path');
const Hoek   = require('hoek');
const Crypto = require('crypto');
const Mkdirp = require('mkdirp');

// Declare internals
const internals = {};



internals.testDiskAccess = function (callback) {

    const rando    = Math.floor(Math.random() * (99999999999 - 11111111111) + 11111111111);
    const filepath = Path.join(internals.settings.cachepath,'testDiskAccess.' + rando + '.txt');
    const body     = 'okey-dokey';

    Fs.writeFile(filepath,body, (err) => {

        Hoek.assert(!err, `Error writing to ${filepath} ${err}`);

        Fs.readFile(filepath, 'utf8', (err, data) => {

            Hoek.assert(!err, `Error reading from ${filepath} ${err}`);
            Hoek.assert(data === body, `Error in value  "${data}" not equaling "${body}"`);

            Fs.unlink(filepath, (err) => {

                Hoek.assert(!err, `Error unlinking ${filepath} ${err}`);
                callback();
            });
        });
    });
};


exports = module.exports = internals.Connection = function DiskCache(options) {

    Hoek.assert(this.constructor === internals.Connection, 'Disk cache client must be instantiated using new');
    Hoek.assert(options.cachepath, 'Missing cachepath value');

    this.settings = Hoek.clone(options);
    internals.settings = Hoek.clone(this.settings);
};


internals.Connection.prototype.getStoragePathForKey = function (key) {

    // console.log('getStoragePathForKey:',internals.settings);
    const hash = Crypto.createHash('md5').update(key.id).digest('hex');

    const sub1        = hash.substring(0,2);
    const sub2        = hash.substring(2,4);
    const destination = Path.join(this.settings.cachepath, key.segment, sub1, sub2, hash + '.json');
    // console.log('destination:',destination);
    return destination;
};



internals.Connection.prototype.start = function (callback) {

    const self = this;
    // callback = Hoek.nextTick(callback);

    Fs.stat(self.settings.cachepath, (err, stats) => {

        self.isConnected = false;
        if (err) {
            return callback(err);
        }
        if (!stats.isDirectory()) {
            // console.log('Not a directory!:',self.settings.cachepath);
            return callback(new Error(`cachepath "${self.settings.cachepath}" is not a directory!`));
        }

        internals.testDiskAccess(() => {

            self.isConnected = true;
            return callback();
        });
    });
};


internals.Connection.prototype.stop = function () {

    this.isConnected = false;
};


internals.Connection.prototype.isReady = function () {

    return this.isConnected;
};


internals.Connection.prototype.validateSegmentName = function (name) {

    if (!name) {
        return new Error('Empty string');
    }

    if (name.indexOf('\0') !== -1) {
        return new Error('Includes null character');
    }

    return null;
};


internals.Connection.prototype.get = function (key, callback) {

    if (!this.isConnected) {
        return callback(new Error('Connection not started'));
    }
    const self = this;
    const filepath = this.getStoragePathForKey(key);
    // console.log('filepath:',filepath);
    Fs.readFile(filepath, 'utf8', (err, data) => {

        if (err){
            if (err.code !== 'ENOENT') {
                return callback(err);
            }
            // console.log('File not found!');
            return callback(null,null);  // cache miss
        }

        const obj    = JSON.parse(data);
        const now    = new Date().getTime();
        const stored = new Date(obj.stored);
        let ttl      = Number(obj.ttl);
        ttl          = (stored.getTime() + ttl) - now;

        // Cache item has expired
        if (ttl <= 0) {
            self.drop(key, () => {}); // clear out the old stuff
            return callback(null, null);
        }

        const result = {
            item   : obj.item,
            stored,
            ttl
        };
        callback(null, result);
    });
};


internals.Connection.prototype.set = function (key, value, ttl, callback) {

    if (!this.isConnected) {
        return callback(new Error('Connection not started'));
    }

    if (ttl > 2147483647) {  // Math.pow(2, 31)
        return callback(new Error('Invalid ttl (greater than 2147483647)'));
    }

    const filepath = this.getStoragePathForKey(key);
    const dirs     = Path.dirname(filepath);

    const envelope = {
        ttl,
        item    : value,
        stored  : Date.now(),
        expires : new Date((new Date()).getTime() + ttl)
    };

    let body = null;
    try {
        body = JSON.stringify(envelope);
    }
    catch (err) {
        return callback(err);
    }


    Mkdirp(dirs, (err) => {

        Hoek.assert(!err,`${err}`);

        Fs.writeFile(filepath, body, (err) => {

            Hoek.assert(!err,`${err}`);
            return callback(null);
        });
    });
};


internals.Connection.prototype.drop = function (key, callback) {

    if (!this.isConnected) {
        return callback(new Error('Connection not started'));
    }

    const filepath = this.getStoragePathForKey(key);

    Fs.unlink(filepath, (err) => {

        if (err && err.code !== 'ENOENT'){
            return callback(err);
        }
        callback();
    });
};
