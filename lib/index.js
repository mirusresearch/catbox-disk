'use strict';

// Load modules
const Fs     = require('fs');
const Path   = require('path');
const Hoek   = require('hoek');
const Crypto = require('crypto');
const Mkdirp = require('mkdirp');
const Walk   = require('walk');

// Declare internals
const internals = {};


internals.testDiskAccess = function (cachePath,callback) {

    const rando    = Math.floor(Math.random() * (30000 - 500) + 500);
    const filepath = Path.join(cachePath,'testDiskAccess.' + rando + '.txt');
    const body     = 'okey-dokey';

    Fs.writeFile(filepath,body, (err) => {

        Hoek.assert(!err, `Error writing to ${filepath} ${err}`);

        Fs.readFile(filepath, 'utf8', (err2, data) => {

            Hoek.assert(!err2, `Error reading from ${filepath} ${err2}`);
            Hoek.assert(data === body, `Error in value  "${data}" not equaling "${body}"`);

            Fs.unlink(filepath, (err3) => {

                Hoek.assert(!err3, `Error unlinking ${filepath} ${err3}`);
                callback();
            });
        });
    });
};




exports = module.exports = internals.Connection = function DiskCache (options) {

    const defaults = { cleanEvery:3600000 };

    Hoek.assert(this.constructor === internals.Connection, 'Disk cache client must be instantiated using new');
    const settings = Hoek.applyToDefaults(defaults, options);
    Hoek.assert(settings.cachePath, 'Missing cachePath value');
    Hoek.assert(settings.cleanEvery === parseInt(settings.cleanEvery, 10), 'cleanEvery is not an integer');

    this.settings = Hoek.clone(settings);

};


internals.Connection.prototype.getStoragePathForKey = function (key) {

    const hash = Crypto.createHash('md5').update(key.id).digest('hex');

    const sub1        = hash.substring(0,2);
    const sub2        = hash.substring(2,4);
    const destination = Path.join(this.settings.cachePath, key.segment, sub1, sub2, hash + '.json');
    // console.log('destination:',destination);
    return destination;
};



internals.Connection.prototype.start = function (callback) {

    const self = this;
    // callback = Hoek.nextTick(callback);
    // console.log('self.settings.cachePath:',self.settings.cachePath);
    Fs.stat(self.settings.cachePath, (err, stats) => {

        self.isConnected = false;
        if (err) {
            return callback(err);
        }
        if (!stats.isDirectory()) {
            // console.log('Not a directory!:',self.settings.cachePath);
            return callback(new Error(`cachePath "${self.settings.cachePath}" is not a directory!`));
        }

        internals.testDiskAccess(self.settings.cachePath, () => {

            self.isConnected = true;
            self.cacheCleanerInit();
            return callback();
        });
    });
};


internals.Connection.prototype.stop = function () {

    clearTimeout(this.cacheCleanerTimeout);
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

    const filepath = this.getStoragePathForKey(key);
    const value = this.readCacheFile(filepath,callback);
    return value;
};


internals.Connection.prototype.readCacheFile = function (filepath,callback) {

    const self = this;
    Fs.readFile(filepath, 'utf8', (err, data) => {

        if (err){
            if (err.code !== 'ENOENT') {
                return callback(err);
            }
            // console.log('File not found!');
            return callback(null,null);  // cache miss
        }

        let obj;
        try {
            obj = JSON.parse(data);
        } catch (e){
            // console.error('JSON parse error:',filepath);
            // console.error(e);
            // remove the corrupted file to prevent later issues
            return internals.Unlink(filepath, callback);
        }
        // const obj  = JSON.parse(data);
        const now     = new Date().getTime();
        // const stored  = obj.stored;
        const key     = obj.key;
        const ttl     = obj.stored + obj.ttl - now;

        // Cache item has expired
        if (ttl<=0) {
            self.drop(key, () => {}); // clear out the old stuff
            return callback(null, null);
        }
        const result = {
            key,
            ttl,
            item   : obj.item,
            stored : obj.stored,
        };
        // console.log('readCacheFile:',result);
        callback(null, result);
    });
};

internals.Connection.prototype.set = function (key, value, ttl, callback) {

    if (!this.isConnected) {
        return callback(new Error('Connection not started'));
    }

    const filepath = this.getStoragePathForKey(key);
    const dirs     = Path.dirname(filepath);

    const envelope = {
        key,
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

        Fs.writeFile(filepath, body, (err2) => {

            Hoek.assert(!err2,`${err2}`);
            return callback(null);
        });
    });
};

internals.Connection.prototype.drop = function (key, callback) {

    if (!this.isConnected) {
        return callback(new Error('Connection not started'));
    }

    const filepath = this.getStoragePathForKey(key);
    internals.Unlink(filepath,callback);
};


internals.Unlink = function (filepath, callback) {

    Fs.unlink(filepath, (err) => {

        // console.log('dropping:',filepath);
        if (err && err.code !== 'ENOENT'){
            return callback(err);
        }
        callback();
    });
}

internals.Connection.prototype.cacheCleanerInit = function (){
    const self = this;

    // early exit if we don't want automated cleanup
    if (self.settings.cleanEvery === 0){
        return;
    }

    const firstrun = Math.floor(Math.random() * (3000 - 200) + 200);
    const runCleaner = function (){
        // console.log('Cleaner running in',firstrun,'ms');
        const walker  = Walk.walk(self.settings.cachePath, { followLinks: false });
        walker.on('file', (root, fileStat, next) => {
            // only examine files matching the cache naming convention, ignore all others
            if (!fileStat.name.match(/^[a-f0-9]{32}\.json$/i)){
                // console.log('skipping fileStat:',fileStat.name);
                return next();
            }

            const filepath = Path.resolve(root, fileStat.name);
            // console.log('cleaner testing:',filepath);
            self.readCacheFile(filepath, next);

        });

        walker.on('end', () => {

            self.cacheCleanerTimeout = setTimeout(runCleaner,self.settings.cleanEvery);
        });
    };

    self.cacheCleanerTimeout = setTimeout(runCleaner,firstrun);
};
