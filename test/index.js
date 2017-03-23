'use strict';

// Load modules
const Lab    = require('lab');
const Code   = require('code');
const Catbox = require('catbox');
const Disk   = require('..');
const Fs     = require('fs');
const Path   = require('path');
const Tmp    = require('tmp');

// Test shortcuts
const lab      = exports.lab = Lab.script();
const describe = lab.describe;
const it       = lab.it;
const expect   = Code.expect;

// setup general options
const tmpcachepath = Tmp.dirSync({ prefix: 'catbox_disk_tmp_', unsafeCleanup: true, mode: '0777' });
const options = { cachePath: tmpcachepath.name };


describe('Disk', () => {

    lab.after((done) => {

        console.log('removing tmpcachepath:',tmpcachepath.name);
        tmpcachepath.removeCallback();
        return done();
    });


    describe('#constructor', () => {

        it('throws an error if not created with new', (done) => {

            const fn = () => {

                Disk();
            };

            expect(fn).to.throw(Error);
            done();
        });

        it('throws an error with no provided cachePath', (done) => {

            const fn = () => {

                new Catbox.Client(Disk);
            };
            expect(fn).to.throw(Error);
            done();

        });

        it('throws an error with a non-existent cachePath', (done) => {

            const client = new Catbox.Client(Disk, { cachePath: '/does/not/exist/yo/ho/ho' });
            client.start((err) => {

                expect(err).to.exist();
                expect(client.isReady()).to.equal(false);
                done();
            });

        });

        it('throws an error with a non-directory cachePath', (done) => {

            const filepath = Path.join(tmpcachepath.name,'diskCacheTestFile.txt');
            Fs.writeFile(filepath,'ok', (err) => {

                if (err){
                    throw err;
                }
                const client = new Catbox.Client(Disk, { cachePath: filepath });
                client.start((err2) => {

                    expect(err2).to.exist();
                    expect(client.isReady()).to.equal(false);
                    Fs.unlinkSync(filepath);
                    done();
                });
            });
        });

        it('throws an error with a non-integer cleanEvery', (done) => {

            const fn = () => {

                new Catbox.Client(Disk, { cachePath: tmpcachepath.name, cleanEvery: 'notbloodylikely' });
            };
            expect(fn).to.throw(Error);
            done();

        });

        it('errors on a policy with a missing segment name', (done) => {

            const config = {
                expiresIn: 50000
            };

            const fn = () => {

                const client = new Catbox.Client(Disk, options);
                new Catbox.Policy(config, client, '');
            };
            expect(fn).to.throw(Error);
            done();
        });

        it('errors on a policy with a bad segment name', (done) => {

            const config = {
                expiresIn: 50000
            };
            const fn = () => {

                const client = new Catbox.Client(Disk, options);
                new Catbox.Policy(config, client, 'a\0b');
            };
            expect(fn).to.throw(Error);
            done();
        });

    });




    describe('#start', () => {

        it('creates a new connection', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                expect(client.isReady()).to.equal(true);
                done();
            });
        });

        it('closes the connection', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                expect(client.isReady()).to.equal(true);
                client.stop();
                expect(client.isReady()).to.equal(false);
                done();
            });
        });

        it('ignored starting a connection twice on same event', (done) => {

            let x = 2;
            const client = new Catbox.Client(Disk, options);
            const start = () => {

                client.start((err) => {

                    expect(err).to.not.exist();
                    expect(client.isReady()).to.equal(true);
                    --x;
                    if (!x) {
                        done();
                    }
                });
            };

            start();
            start();
        });


        it('ignored starting a connection twice chained', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                expect(client.isReady()).to.equal(true);
                client.start((err2) => {

                    expect(err2).to.not.exist();
                    expect(client.isReady()).to.equal(true);
                    done();
                });
            });
        });

    });





    describe('#get', () => {


        it('returns not found on get when item expired', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'x', segment: 'test' };
                client.set(key, 'x', 1, (err2) => {

                    expect(err2).to.not.exist();
                    setTimeout(() => {

                        client.get(key, (err3, result) => {

                            expect(err3).to.equal(null);
                            expect(result).to.equal(null);
                            done();
                        });
                    }, 1000);
                });
            });
        });

        it('returns not found on get when using null key', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                client.get(null, (err2, result) => {

                    expect(err2).to.equal(null);
                    expect(result).to.equal(null);
                    done();
                });
            });
        });

        it('errors on get when using invalid key', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                client.get({}, (err2) => {

                    expect(err2 instanceof Error).to.equal(true);
                    done();
                });
            });
        });

        it('errors on get when stopped', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.stop();
            const key = { id: 'x', segment: 'test' };
            client.connection.get(key, (err, result) => {

                expect(err).to.exist();
                expect(result).to.not.exist();
                done();
            });
        });

        it('gets an item after setting it', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();

                const key = { id: 'test/id?with special%chars&', segment: 'test' };
                client.set(key, '123', 5000, (err2) => {

                    expect(err2).to.not.exist();
                    client.get(key, (err3, result) => {

                        expect(err3).to.equal(null);
                        expect(result.item).to.equal('123');
                        done();
                    });
                });
            });
        });

        it('throws error on existing unreadable key ', (done) => {

            const disk = new Disk(options);
            disk.start(() => {

                const key = { segment : 'segment', id : 'unreadablekey' };
                const fp  = disk.getStoragePathForKey(key);

                disk.set(key, 'notok', 2000, () => {

                    Fs.chmodSync(fp,'0222'); // make the file unreadable
                    disk.get(key, (err, result) => {

                        expect(err).to.exist();
                        expect(err.code).to.not.equal('ENOENT');
                        expect(result).to.not.exist();
                        Fs.unlinkSync(fp);
                        done();
                    });
                });

            });
        });

        it('throws error on unparseable JSON', (done) => {

            const disk = new Disk(options);
            disk.start(() => {

                const key = { segment : 'segment', id : 'badjson' };
                const fp  = disk.getStoragePathForKey(key);

                disk.set(key, 'notok', 2000, () => {

                    Fs.appendFileSync(fp, 'bad data that kills JSON');
                    disk.get(key, (err, result) => {

                        expect(err).to.exist();
                        expect(err.code).to.not.equal('ENOENT');
                        expect(result).to.not.exist();
                        Fs.unlinkSync(fp);
                        done();
                    });
                });

            });
        });

        it('returns not found on missing key', (done) => {

            const disk = new Disk(options);
            disk.start(() => {

                const key = { segment : 'segment', id : 'missingkey' };

                disk.get(key, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result).to.not.exist();
                    done();
                });


            });
        });

    });






    describe('#set', () => {


        it('errors on set when stopped', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.stop();
            const key = { id: 'x', segment: 'test' };
            client.connection.set(key, 'y', 1, (err) => {

                expect(err).to.exist();
                done();
            });
        });


        it('supports empty keys', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();

                const key = { id: '', segment: 'test' };
                client.set(key, '123', 5000, (err2) => {

                    expect(err2).to.not.exist();
                    client.get(key, (err3, result) => {

                        expect(err3).to.not.exist();
                        expect(result.item).to.equal('123');
                        done();
                    });
                });
            });
        });

        it('errors on set when using null key', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                client.set(null, {}, 1000, (err2) => {

                    expect(err2 instanceof Error).to.equal(true);
                    done();
                });
            });
        });

        it('errors on set when using invalid key', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                client.set({}, {}, 1000, (err2) => {

                    expect(err2 instanceof Error).to.equal(true);
                    done();
                });
            });
        });

        it('ignores set when using non-positive ttl value', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'x', segment: 'test' };
                client.set(key, 'y', 0, (err2) => {

                    expect(err2).to.not.exist();
                    done();
                });
            });
        });

        it('fails setting an item with circular references', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'circular', segment: 'test' };
                const value = { a: 1 };
                value.b = value;

                client.set(key, value, 10, (err2) => {

                    expect(err2).to.exist();
                    // expect(err.message).to.equal('Converting circular structure to JSON');
                    done();
                });
            });
        });

        it('adds an item to the cache object', (done) => {

            const key = { segment: 'test', id: 'test' };
            const disk = new Disk(options);

            disk.start(() => {

                disk.set(key, 'myvalue', 2000, () => {

                    disk.get(key, (err, result) => {

                        expect(err).to.not.exist();
                        expect(result.item).to.equal('myvalue');
                        done();
                    });
                });
            });
        });

    });


    describe('#drop', () => {

        it('does not return an expired item', (done) => {

            const key = { segment: 'test', id: 'test' };
            const disk = new Disk(options);
            disk.start(() => {

                disk.set(key, 'myvalue', 1500, () => {

                    disk.get(key, (err, result) => {

                        expect(err).to.not.exist();
                        expect(result.item).to.equal('myvalue');
                        setTimeout(() => {

                            disk.get(key, (err2, result2) => {

                                expect(err2).to.not.exist();
                                expect(result2).to.not.exist();
                                done();
                            });
                        }, 1800);
                    });
                });
            });
        });

        it('drops an existing item', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'x', segment: 'test' };
                client.set(key, '123', 5000, (err2) => {

                    expect(err2).to.not.exist();
                    client.get(key, (err3, result) => {

                        expect(err3).to.equal(null);
                        expect(result.item).to.equal('123');
                        client.drop(key, (err4) => {

                            expect(err4).to.not.exist();
                            done();
                        });
                    });
                });
            });
        });

        it('drops an item from a missing segment', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'x', segment: 'test' };
                client.drop(key, (err2) => {

                    expect(err2).to.not.exist();
                    done();
                });
            });
        });


        it('drops a missing item', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'x', segment: 'test' };
                client.set(key, '123', 2000, (err2) => {

                    expect(err2).to.not.exist();
                    client.get(key, (err3, result) => {

                        expect(err3).to.equal(null);
                        expect(result.item).to.equal('123');
                        client.drop({ id: 'y', segment: 'test' }, (err4) => {

                            expect(err4).to.not.exist();
                            done();
                        });
                    });
                });
            });
        });


        it('errors on an undroppable file', (done) => {


            const disk = new Disk(options);
            disk.start(() => {

                const key = { segment : 'segment', id : 'undropablekey' };
                const fp  = disk.getStoragePathForKey(key);

                disk.set(key, 'notok', 2000, () => {

                    const dir = Path.dirname(fp);
                    Fs.chmodSync(dir,'0555'); // make the file unreadable
                    disk.drop(key, (err) => {

                        expect(err).to.exist();
                        expect(err.code).to.not.equal('ENOENT');
                        Fs.chmodSync(dir,'0777');
                        Fs.unlinkSync(fp);
                        done();
                    });
                });

            });

        });

        it('errors on drop when using invalid key', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                client.drop({}, (err2) => {

                    expect(err2).to.exist(true);
                    done();
                });
            });
        });


        it('errors on drop when using null key', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                client.drop(null, (err2) => {

                    expect(err2 instanceof Error).to.equal(true);
                    done();
                });
            });
        });


        it('errors on drop when stopped', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.stop();
            const key = { id: 'x', segment: 'test' };
            client.connection.drop(key, (err) => {

                expect(err).to.exist();
                done();
            });
        });


        it('errors when cache item dropped while stopped', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.stop();
            client.drop('a', (err) => {

                expect(err).to.exist();
                done();
            });
        });
    });


    describe('#validateSegmentName', () => {

        it('errors when the name is empty', (done) => {

            const disk = new Disk(options);
            const result = disk.validateSegmentName('');

            expect(result).to.be.instanceOf(Error);
            expect(result.message).to.equal('Empty string');
            done();
        });


        it('errors when the name has a null character', (done) => {

            const disk = new Disk(options);
            const result = disk.validateSegmentName('\0test');

            expect(result).to.be.instanceOf(Error);
            done();
        });


        it('returns null when there are no errors', (done) => {

            const disk = new Disk(options);
            const result = disk.validateSegmentName('valid');

            expect(result).to.not.be.instanceOf(Error);
            expect(result).to.equal(null);
            done();
        });
    });
});
