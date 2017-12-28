'use strict';

const Path = require('path');
const Crypto = require('crypto');
const Hoek = require('hoek');
const Walk = require('walk');

const {
    ensureDirectoryExists, testDiskAccess, readFileIgnoreEnoent, unlink, unlinkIgnoreEnoent, mkdirp,
    writeFile
} = require('./disk-utils');

const internals = {};

internals.defaults = { cleanEvery: 3600000 };

exports = module.exports = internals.Connection = function Disk(options) {

    Hoek.assert(
        this.constructor === internals.Connection,
        'Disk cache client must be instantiated using new'
    );

    const settings = Hoek.applyToDefaults(internals.defaults, options);

    Hoek.assert(settings.cachePath, 'Missing cachePath value');
    Hoek.assert(
        settings.cleanEvery === parseInt(settings.cleanEvery, 10),
        'cleanEvery is not an integer'
    );

    this.settings = Object.assign({}, internals.defaults, options);
    this.isConnected = false;
    this.cacheCleanerTimeout = null;
    return this;
};

internals.Connection.prototype.getStoragePathForKey = function ({ id, segment }) {

    const { cachePath } = this.settings;
    const hash = Crypto.createHash('md5').update(id).digest('hex');

    const sub1 = hash.substring(0, 2);
    const sub2 = hash.substring(2, 4);
    const destination = Path.join(cachePath, segment, sub1, sub2, `${hash}.json`);
    return destination;
};

// Async
internals.Connection.prototype.start = function () {

    const { cachePath } = this.settings;

    return ensureDirectoryExists(cachePath)
        .then(() => testDiskAccess(cachePath))
        .then(() => {

            this.isConnected = true;
            return this.cacheCleanerInit();
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

    if (name.indexOf('\u0000') !== -1) {
        return new Error('Includes null character');
    }

    return null;
};

// Async
internals.Connection.prototype.get = function (key) {

    if (!this.isConnected) {
        return Promise.reject(new Error('Connection not started'));
    }

    const filePath = this.getStoragePathForKey(key);
    return this.readCacheFile(filePath);
};

// Async
internals.Connection.prototype.readCacheFile = function (filePath) {

    return readFileIgnoreEnoent(filePath, 'utf8')
        .then((data) => {

            // cache miss
            if (!data) {
                return null;
            }

            let obj;
            try {
                obj = JSON.parse(data);
            }
            catch (e) {
                // remove the corrupted file to prevent later issues
                return unlink(filePath);
            }

            const key = obj.key;
            const ttl = obj.stored + obj.ttl - Date.now();

            // Cache item has expired
            if (ttl <= 0) {
                return this.drop(key); // clear out the old stuff
            }

            const result = {
                key,
                ttl,
                item: obj.item,
                stored: obj.stored
            };
            return result;
        });
};

// Async
internals.Connection.prototype.set = function (key, value, ttl) {

    if (!this.isConnected) {
        return Promise.reject(new Error('Connection not started'));
    }

    const filePath = this.getStoragePathForKey(key);
    const directoryPath = Path.dirname(filePath);

    const envelope = {
        key,
        ttl,
        item: value,
        stored: Date.now(),
        expires: new Date((new Date()).getTime() + ttl)
    };

    let body = null;
    try {
        body = JSON.stringify(envelope);
    }
    catch (err) {
        return Promise.reject(err);
    }

    return mkdirp(directoryPath)
        .then(() => {

            return writeFile(filePath, body);
        });
};

// Async
internals.Connection.prototype.drop = function (key) {

    if (!this.isConnected) {
        return Promise.reject(new Error('Connection not started'));
    }

    const filePath = this.getStoragePathForKey(key);
    return unlinkIgnoreEnoent(filePath);
};

internals.Connection.prototype.cacheCleanerInit = function () {

    const { cleanEvery, cachePath } = this.settings;

    // early exit if we don't want automated cleanup
    if (cleanEvery === 0) {
        return;
    }

    const firstRun = Math.floor(Math.random() * (3000 - 200) + 200);

    const runCleaner = () => {

        const walker = Walk.walk(cachePath, { followLinks: false });

        walker.on('file', (root, fileStat, next) => {
            // only examine files matching the cache naming convention, ignore all others
            if (!fileStat.name.match(/^[a-f0-9]{32}\.json$/i)) {
                return next();
            }

            const filePath = Path.resolve(root, fileStat.name);
            return this.readCacheFile(filePath)
                .then(next)
                .catch(next);
        });

        walker.on('end', () => {

            this.cacheCleanerTimeout = setTimeout(runCleaner, cleanEvery);
        });
    };

    this.cacheCleanerTimeout = setTimeout(runCleaner, firstRun);
};
