'use strict';

const Path = require('path');
const Fs = require('fs');
const { promisify } = require('util');
const Mkdirp = require('mkdirp');
const Hoek = require('hoek');

const writeFileAsync = promisify(Fs.writeFile);
const readFileAsync = promisify(Fs.readFile);
const unlinkAsync = promisify(Fs.unlink);
const statAsync = promisify(Fs.stat);
const mkdirpAsync = promisify(Mkdirp);

const ignoreEnoentError = (err) => {

    if (err.code === 'ENOENT') {
        return;
    }
    return Promise.reject(err);
};

const prependErrorMessage = (msg) => {

    return (err) => {

        err.message = `${msg} ${err.message}`;
        return Promise.reject(err);
    };
};

const writeFile = (filePath, contents) => {

    return writeFileAsync(filePath, contents)
        .catch(prependErrorMessage(`Error writing to "${filePath}"`));
};

const readFile = (filePath, encoding) => {

    return readFileAsync(filePath, encoding)
        .catch(prependErrorMessage(`Error reading from "${filePath}"`));
};

const readFileIgnoreEnoent = (filePath, encoding) => {

    return readFile(filePath, encoding)
        .catch(ignoreEnoentError);
};

const unlink = (filePath) => {

    return unlinkAsync(filePath)
        .catch(prependErrorMessage(`Error unlinking "${filePath}"`));
};

const unlinkIgnoreEnoent = (filePath) => {

    return unlink(filePath)
        .catch(ignoreEnoentError);
};

const stat = (pathToStat) => {

    return statAsync(pathToStat)
        .catch(prependErrorMessage(`Error getting statistics for "${pathToStat}"`));
};

const ensureDirectoryExists = (directoryPath) => {

    return stat(directoryPath)
        .then((stats) => {

            if (!stats.isDirectory()) {
                return Promise.reject(new Error(`Error "${directoryPath}" is not a directory!`));
            }
            return stats;
        });
};

const mkdirp = (directoryPath) => {

    return mkdirpAsync(directoryPath)
        .catch(prependErrorMessage(`Error creating directory "${directoryPath}"`));
};

const testDiskAccess = (directoryPath) => {

    const rando = Math.floor(Math.random() * (30000 - 500) + 500);
    const filePath = Path.join(directoryPath, 'testDiskAccess.' + rando + '.txt');
    const body = 'test-body-value';

    return writeFile(filePath, body)
        .then(() => {

            return readFile(filePath, 'utf8');
        })
        .then((data) => {

            return unlink(filePath)
                .then(() => {

                    Hoek.assert(data === body, `Error, value "${data}" does not equal "${body}"`);
                });
        });
};

module.exports = {
    writeFile,
    readFile,
    readFileIgnoreEnoent,
    unlink,
    unlinkIgnoreEnoent,
    stat,
    ensureDirectoryExists,
    mkdirp,
    testDiskAccess
};
