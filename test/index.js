'use strict';

const Fs = require('fs');
const Path = require('path');
const { promisify } = require('util');
const Code = require('code');
const Lab = require('lab');
const Catbox = require('catbox');
const Tmp = require('tmp');
const Disk = require('..');

const writeFileAsync = promisify(Fs.writeFile);
const unlinkAsync = promisify(Fs.unlink);
const chmodAsync = promisify(Fs.chmod);
const appendFileAsync = promisify(Fs.appendFile);
const statAsync = promisify(Fs.stat);

const lab = exports.lab = Lab.script();
const expect = Code.expect;
const { describe, test: it, before, after } = lab;

const fileExists = (filePath) => {

    return statAsync(filePath)
        .then(() => true)
        .catch((err) => {

            if (err.code === 'ENOENT') {
                return false;
            }
            return Promise.reject(err);
        });
};

describe('Disk', () => {

    let tmpCachePath = null;
    let options = null;

    before(async () => {

        tmpCachePath = await new Promise((resolve, reject) => {

            return Tmp.dir({
                prefix: 'catbox_disk_tmp_',
                unsafeCleanup: true,
                mode: '0777'
            }, (err, name, removeCallback) => {

                if (err) {
                    return reject(err);
                }
                return resolve({ name, removeCallback: promisify(removeCallback) });
            });
        });

        options = {
            cachePath: tmpCachePath.name,
            cleanEvery: 0
        };
    });

    after(async () => {


        console.log(`removing tmpCachePath: ${tmpCachePath.name}`);
        await tmpCachePath.removeCallback();
    });

    describe('#constructor', () => {

        it('throws an error if not created with new', () => {

            const fn = () => Disk();
            expect(fn).to.throw(Error);
        });

        it('throws an error with no provided cachePath', () => {

            const fn = () => new Catbox.Client(Disk);
            expect(fn).to.throw(Error);
        });

        it('throws an error with a non-existent cachePath', async () => {


            const client = new Catbox.Client(Disk, {
                cachePath: '/does/not/exist/yo/ho/ho'
            });
            await client.start()
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                    expect(client.isReady()).to.equal(false);
                });
        });

        it('throws an error with a non-directory cachePath', async () => {


            const filepath = Path.join(tmpCachePath.name, 'diskCacheTestFile.txt');
            await writeFileAsync(filepath, 'ok');

            const client = new Catbox.Client(Disk, {
                cachePath: filepath
            });
            await client.start()
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                    expect(client.isReady()).to.equal(false);
                    return unlinkAsync(filepath);
                });
        });

        it('throws an error with a non-integer cleanEvery', () => {

            const fn = () => {

                return new Catbox.Client(Disk, {
                    cachePath: tmpCachePath.name,
                    cleanEvery: 'notbloodylikely'
                });
            };
            expect(fn).to.throw(Error);
        });

        it('errors on a policy with a missing segment name', () => {

            const config = {
                expiresIn: 50000
            };

            const fn = () => {

                const client = new Catbox.Client(Disk, options);
                new Catbox.Policy(config, client, '');
            };
            expect(fn).to.throw(Error);
        });

        it('errors on a policy with a bad segment name', () => {

            const config = {
                expiresIn: 50000
            };

            const fn = () => {

                const client = new Catbox.Client(Disk, options);
                new Catbox.Policy(config, client, 'a\0b');
            };
            expect(fn).to.throw(Error);
        });
    });

    describe('#start', () => {


        it('creates a new connection', async () => {


            const client = new Catbox.Client(Disk, options);

            await client.start();
            expect(client.isReady()).to.equal(true);
        });

        it('closes the connection', async () => {


            const client = new Catbox.Client(Disk, options);

            await client.start();
            expect(client.isReady()).to.equal(true);

            await client.stop();
            expect(client.isReady()).to.equal(false);
        });

        it('ignored starting a connection twice on same event', async () => {


            const client = new Catbox.Client(Disk, options);

            const start = () => {

                return client.start()
                    .then(() => {

                        expect(client.isReady()).to.equal(true);
                    });
            };

            await Promise.all([start(), start()]);
        });

        it('ignored starting a connection twice chained', async () => {


            const client = new Catbox.Client(Disk, options);

            await client.start();
            expect(client.isReady()).to.equal(true);

            await client.start();
            expect(client.isReady()).to.equal(true);
        });

    });

    describe('#get', () => {


        it('returns not found on get when item expired', async () => {


            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'x', segment: 'test' };
            await client.set(key, 'x', 1);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            const result = await client.get(key);
            expect(result).to.equal(null);
        });

        it('returns not found on get when using null key', async () => {


            const client = new Catbox.Client(Disk, options);
            await client.start();

            const result = await client.get(null);
            expect(result).to.equal(null);
        });

        it('errors on get when using invalid key', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            await client.get({})
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('errors on get when stopped', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.stop();

            const key = { id: 'x', segment: 'test' };
            client.connection.get(key)
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('gets an item after setting it', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'test/id?with special%chars&', segment: 'test' };
            await client.set(key, '123', 5000);

            const result = await client.get(key);
            expect(result.item).to.equal('123');
        });

        it('gets a ttl back on a valid key', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'test/id?with special%chars&', segment: 'test' };
            await client.set(key, { foo: 'bar' }, 5000);

            await new Promise((resolve) => setTimeout(resolve, 1000));

            const result = await client.get(key);
            expect(result.item.foo).to.equal('bar');
            expect(result.ttl).to.be.a.number();
        });

        it('throws error on existing unreadable key ', async () => {

            const client = new Disk(options);
            await client.start();

            const key = { segment: 'segment', id: 'unreadablekey' };
            const fp = client.getStoragePathForKey(key);

            await client.set(key, 'notok', 2000);
            await chmodAsync(fp, '0222'); // make the file unreadable

            await client.get(key)
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                    expect(err.code).to.not.equal('ENOENT');

                    return unlinkAsync(fp);
                });
        });

        it('returns not found on unparseable JSON and removes file', async () => {

            const client = new Disk(options);
            await client.start();

            const key = { segment: 'segment', id: 'badjson' };
            const fp = client.getStoragePathForKey(key);

            await client.set(key, 'notok', 2000);
            await appendFileAsync(fp, 'bad data that kills JSON');

            await client.get(key)
                .catch((err) => {

                    expect(err).to.not.exist();
                })
                .then((result) => {

                    expect(result).to.not.exist();
                    return fileExists(fp);
                })
                .then((exists) => {

                    expect(exists).to.equal(false);
                });
        });

        it('returns not found on missing key', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { segment: 'segment', id: 'missingkey' };
            const result = await client.get(key);

            expect(result).to.not.exist();
        });

    });

    describe('#set', () => {

        it('errors on set when stopped', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.stop();

            const key = { id: 'x', segment: 'test' };
            await client.connection.set(key, 'y', 1)
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('supports empty keys', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: '', segment: 'test' };
            await client.set(key, '123', 5000);

            const result = await client.get(key);
            expect(result.item).to.equal('123');
        });

        it('errors on set when using null key', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            await client.set(null, {}, 1000)
                .catch((err) => {

                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('errors on set when using invalid key', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            await client.set({}, {}, 1000)
                .catch((err) => {

                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('ignores set when using non-positive ttl value', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'x', segment: 'test' };
            await client.set(key, 'y', 0);
        });

        it('fails setting an item with circular references', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'circular', segment: 'test' };
            const value = { a: 1 };
            value.b = value;

            await client.set(key, value, 10)
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('adds an item to the cache object', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { segment: 'test', id: 'test' };
            await client.set(key, 'myvalue', 2000);
            const result = await client.get(key);
            expect(result.item).to.equal('myvalue');
        });

    });

    describe('#drop', () => {

        it('does not return an expired item', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { segment: 'test', id: 'test' };
            await client.set(key, 'myvalue', 2000);

            const result = await client.get(key);
            expect(result.item).to.equal('myvalue');

            await new Promise((resolve) => setTimeout(resolve, 1800));

            const result2 = await client.get(key);
            expect(result2).to.not.exist();
        });

        it('drops an existing item', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'x', segment: 'test' };
            await client.set(key, '123', 5000);

            const result = await client.get(key);
            expect(result.item).to.equal('123');

            await client.drop(key);

            const result2 = await client.get(key);
            expect(result2).to.not.exist();
        });

        it('drops an item from a missing segment', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'x', segment: 'test' };
            await client.drop(key);
        });

        it('drops a missing item', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            const key = { id: 'x', segment: 'test' };
            await client.set(key, '123', 2000);

            const result = await client.get(key);
            expect(result.item).to.equal('123');

            await client.drop({ id: 'y', segment: 'test' });
        });

        it('errors on an undroppable file', async () => {

            const client = new Disk(options);
            await client.start();

            const key = { segment: 'segment', id: 'undropablekey' };
            const fp = client.getStoragePathForKey(key);

            await client.set(key, 'notok', 2000);

            const dir = Path.dirname(fp);
            await chmodAsync(dir, '0555'); // make the file unreadable

            await client.drop(key)
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                    expect(err.code).to.not.equal('ENOENT');
                })
                .then(() => chmodAsync(dir, '0777'))
                .then(() => unlinkAsync(fp));
        });

        it('errors on drop when using invalid key', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            await client.drop({})
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('errors on drop when using null key', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.start();

            await client.drop(null)
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('errors on drop when stopped', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.stop();

            const key = { id: 'x', segment: 'test' };
            await client.connection.drop(key)
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });

        it('errors when cache item dropped while stopped', async () => {

            const client = new Catbox.Client(Disk, options);
            await client.stop();

            await client.drop('a')
                .catch((err) => {

                    expect(err).to.exist();
                    expect(err).to.be.instanceOf(Error);
                });
        });
    });

    describe('#validateSegmentName', () => {

        it('errors when the name is empty', () => {

            const client = new Catbox.Client(Disk, options);
            const result = client.validateSegmentName('');

            expect(result).to.be.instanceOf(Error);
            expect(result.message).to.equal('Empty string');
        });

        it('errors when the name has a null character', () => {

            const client = new Catbox.Client(Disk, options);
            const result = client.validateSegmentName('\0test');

            expect(result).to.be.instanceOf(Error);
            expect(result.message).to.equal('Includes null character');
        });

        it('returns null when there are no errors', () => {

            const client = new Catbox.Client(Disk, options);
            const result = client.validateSegmentName('valid');

            expect(result).to.not.be.instanceOf(Error);
            expect(result).to.equal(null);
        });
    });

    describe('#cacheCleanerInit', () => {

        it('ignores filenames not matching the cache naming scheme', { timeout: 8000 }, async () => {

            const cachePath = tmpCachePath.name;
            const client = new Disk({ cachePath });

            const keepFp = Path.join(cachePath, 'test.keep');
            await writeFileAsync(keepFp, 'ok', 'utf8');

            const key = { segment: 'segment', id: 'removablekey' };
            const removeFp = client.getStoragePathForKey(key).split('/').slice(-1)[0];

            await writeFileAsync(Path.join(cachePath, removeFp), '{}', 'utf8');

            client.cacheCleanerInit();

            await new Promise((resolve) => setTimeout(resolve, 4000));

            const keepFpExists = await fileExists(keepFp);
            expect(keepFpExists).to.be.equal(true);

            const removeFpExists = await fileExists(removeFp);
            expect(removeFpExists).to.be.equal(false);
        });

    });

});
