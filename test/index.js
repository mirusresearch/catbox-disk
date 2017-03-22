'use strict';

// Load modules
const Lab    = require('lab');
const Code   = require('code');
const Catbox = require('catbox');
const Disk   = require('..');
const Os     = require('os');
const Fs     = require('fs');
const Path   = require('path');

// Test shortcuts
const lab      = exports.lab = Lab.script();
const describe = lab.describe;
const it       = lab.it;
const expect   = Code.expect;

const options = { cachepath: Os.tmpdir() };


describe('Disk', () => {

    it('throws an error if not created with new', (done) => {

        const fn = () => {

            Disk();
        };

        expect(fn).to.throw(Error);
        done();
    });

    it('throws an error with no provided cachepath', (done) => {

        const fn = () => {

            new Catbox.Client(Disk);
        };
        expect(fn).to.throw(Error);
        done();

    });

    it('throws an error with a non-existent cachepath', (done) => {

        const client = new Catbox.Client(Disk, { cachepath: '/does/not/exist/yo/ho/ho' });
        client.start((err) => {

            expect(err).to.exist();
            expect(client.isReady()).to.equal(false);
            done();
        });

    });

    it('throws an error with a non-directory cachepath', (done) => {

        const filepath = Path.join(Os.tmpdir(),'diskCacheTestFile.txt');
        Fs.writeFile(filepath,'ok', (err) => {

            if (err){
                throw err;
            }
            const client = new Catbox.Client(Disk, { cachepath: filepath });
            client.start((err) => {

                expect(err).to.exist();
                expect(client.isReady()).to.equal(false);
                done();
            });
        });
    });

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


    it('gets an item after setting it', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'test/id?with special%chars&', segment: 'test' };
            client.set(key, '123', 5000, (err) => {

                expect(err).to.not.exist();
                client.get(key, (err, result) => {

                    expect(err).to.equal(null);
                    expect(result.item).to.equal('123');
                    done();
                });
            });
        });
    });



    it('fails setting an item circular references', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'circular', segment: 'test' };
            const value = { a: 1 };
            value.b = value;

            client.set(key, value, 10, (err) => {

                expect(err).to.exist();
                // expect(err.message).to.equal('Converting circular structure to JSON');
                done();
            });
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
            client.start((err) => {

                expect(err).to.not.exist();
                expect(client.isReady()).to.equal(true);
                done();
            });
        });
    });


    it('returns not found on get when using null key', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            client.get(null, (err, result) => {

                expect(err).to.equal(null);
                expect(result).to.equal(null);
                done();
            });
        });
    });


    it('returns not found on get when item expired', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'x', segment: 'test' };
            client.set(key, 'x', 1, (err) => {

                expect(err).to.not.exist();
                setTimeout(() => {

                    client.get(key, (err, result) => {

                        expect(err).to.equal(null);
                        expect(result).to.equal(null);
                        done();
                    });
                }, 1000);
            });
        });
    });


    it('errors on set when using null key', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            client.set(null, {}, 1000, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });


    it('errors on get when using invalid key', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            client.get({}, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });


    it('errors on set when using invalid key', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            client.set({}, {}, 1000, (err) => {

                expect(err instanceof Error).to.equal(true);
                done();
            });
        });
    });


    it('ignores set when using non-positive ttl value', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();
            const key = { id: 'x', segment: 'test' };
            client.set(key, 'y', 0, (err) => {

                expect(err).to.not.exist();
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


    it('errors on set when stopped', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.stop();
        const key = { id: 'x', segment: 'test' };
        client.connection.set(key, 'y', 1, (err) => {

            expect(err).to.exist();
            done();
        });
    });


    it('errors on missing segment name', (done) => {

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


    it('errors on bad segment name', (done) => {

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


    it('supports empty keys', (done) => {

        const client = new Catbox.Client(Disk, options);
        client.start((err) => {

            expect(err).to.not.exist();

            const key = { id: '', segment: 'test' };
            client.set(key, '123', 5000, (err) => {

                expect(err).to.not.exist();
                client.get(key, (err, result) => {

                    expect(err).to.not.exist();
                    expect(result.item).to.equal('123');
                    done();
                });
            });
        });
    });



    describe('#get', () => {

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


        it('adds an item to the cache object with excessive ttl', (done) => {

            const key = { segment: 'test', id: 'test' };
            const disk = new Disk(options);

            disk.start(() => {

                disk.set(key, 'myvalue', 2147483648, (err) => {

                    expect(err).to.exist();
                    expect(err.message).to.equal('Invalid ttl (greater than 2147483647)');
                    done();
                });
            });
        });



        it('removes an item from the cache object when it expires', (done) => {

            const key = { segment: 'test', id: 'test' };
            const disk = new Disk(options);
            disk.start(() => {

                disk.set(key, 'myvalue', 1500, () => {

                    disk.get(key, (err, result) => {

                        expect(err).to.not.exist();
                        expect(result.item).to.equal('myvalue');
                        setTimeout(() => {

                            disk.get(key, (err, result2) => {

                                expect(err).to.not.exist();
                                expect(result2).to.not.exist();
                                done();
                            });
                        }, 1800);
                    });
                });
            });
        });
    });


    describe('#drop', () => {

        it('drops an existing item', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'x', segment: 'test' };
                client.set(key, '123', 5000, (err) => {

                    expect(err).to.not.exist();
                    client.get(key, (err, result) => {

                        expect(err).to.equal(null);
                        expect(result.item).to.equal('123');
                        client.drop(key, (err) => {

                            expect(err).to.not.exist();
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
                client.drop(key, (err) => {

                    expect(err).to.not.exist();
                    done();
                });
            });
        });


        it('drops a missing item', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                const key = { id: 'x', segment: 'test' };
                client.set(key, '123', 2000, (err) => {

                    expect(err).to.not.exist();
                    client.get(key, (err, result) => {

                        expect(err).to.equal(null);
                        expect(result.item).to.equal('123');
                        client.drop({ id: 'y', segment: 'test' }, (err) => {

                            expect(err).to.not.exist();
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
                client.drop({}, (err) => {

                    expect(err).to.exist(true);
                    done();
                });
            });
        });


        it('errors on drop when using null key', (done) => {

            const client = new Catbox.Client(Disk, options);
            client.start((err) => {

                expect(err).to.not.exist();
                client.drop(null, (err) => {

                    expect(err instanceof Error).to.equal(true);
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
