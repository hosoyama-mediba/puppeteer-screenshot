#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const program = require('commander');
const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const moment = require('moment');

function onError(message) {
    if (message) {
        console.error(message);
    } else {
        program.outputHelp();
    }
    process.exit(1);
}

function validOutput(dir) {
    const dirpath = path.resolve(dir);
    try {
        fs.accessSync(dirpath, fs.constants.R_OK | fs.constants.W_OK);
    } catch (e) {
        return onError(e);
    }
    return dirpath;
}

function validEmulate(device) {
    const foundDevice = Object.keys(devices).find(key => key === device);
    if (!foundDevice) {
        return onError(new TypeError(`no such device name "${device}"`));
    }
    return foundDevice;
}

function validRetry(count) {
    var n = Number(count);
    if (!n || 10 < n) {
        return onError(new TypeError(`invalid retry counts "${count}"`));
    }
    return n;
}

function screenshot(url) {
    return new Promise(async (resolve, reject) => {
        let browser;
        const transaction = async (n) => {
            try {
                browser = await puppeteer.launch({
                    ignoreHTTPSErrors: true,
                    headless: !program.show,
                });
                const page = await browser.newPage();

                // disable inline script by document.write of top frame
                await page.evaluateOnNewDocument(() => {
                    Document.prototype._write = Document.prototype.write;
                    Document.prototype.write = function (string) {
                        if (window === window.top) {
                            return;
                        }
                        this._write(string);
                    };
                });
                await page.emulate(devices[program.emulate]);
                await page.goto(url, {
                    waitUntil: 'networkidle',
                });
                await page.screenshot({
                    path: `${program.output}/${moment().format('YYYYMMDD_HHmmss')}.jpg`,
                    fullPage: true,
                    quality: 50,
                });
                resolve();
            } catch(e) {
                if (n > 0) {
                    setTimeout(() => {
                        transaction(n - 1);
                    }, 1000);
                } else {
                    reject(e);
                }
            } finally {
                if (browser) {
                    browser.close();
                    browser = null;
                }
            }
        };
        transaction(program.retry);
    });
}

program
    .version('0.0.1')
    .usage('[options...] <url>')
    .option('-e, --emulate <device>', 'emulate device. defualts to "iPhone 6"', validEmulate, 'iPhone 6')
    .option('-o, --output <path>', 'path to output directory. defualts to "files"', validOutput, `${__dirname}/files`)
    .option('-r, --retry <count>', 'retry count defaults to "0"', validRetry, 0)
    .option('-s, --show', 'show browser window for debug', false)
    .parse(process.argv)
;

const url = program.args[0];
if (!url) {
    onError();
}

(async () => {
    try {
        await screenshot(url);
    } catch (e) {
        onError(e);
    }
})();
