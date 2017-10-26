#!/usr/bin/env node

'use strict';

const fs = require('fs');
const path = require('path');
const program = require('commander');
const puppeteer = require('puppeteer');
const devices = require('puppeteer/DeviceDescriptors');
const compareImages = require('resemblejs/compareImages');

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

function validThreshold(percentage) {
    var n = Number(percentage);
    if (!n || n < 0 || n > 100) {
        return onError(new TypeError(`invalid threshold percentage "${percentage}"`));
    }
    return n;
}

function screenshot(url, filename) {
    console.log(`Screenshot: ${url} to ${program.output}/${filename}.jpg`);
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
                    window.localStorage.clear();
                });
                await page.emulate(devices[program.emulate]);
                await page.goto(url, {
                    waitUntil: 'networkidle',
                });
                await page.screenshot({
                    path: `${program.output}/${filename}.jpg`,
                    fullPage: true,
                    quality: 100,
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
    .usage('[options...] <before url> <after url>')
    .option('-e, --emulate <device>', 'emulate device. defualts to "iPhone 6"', validEmulate, 'iPhone 6')
    .option('-o, --output <path>', 'path to output directory. defualts to "files"', validOutput, `${__dirname}/files`)
    .option('-r, --retry <count>', 'retry count defaults to "0"', validRetry, 0)
    .option('-s, --show', 'show browser window for debug', false)
    .option('-t, --threshold <percentage>', 'diff threshold. defualts to "25"', validThreshold, 25)
    .parse(process.argv)
;

const [beforeUrl, afterUrl] = program.args;
if (!beforeUrl || !afterUrl) {
    onError();
}

async function diffshot(before, after, diff) {
    console.log(`Diff: to ${program.output}/${diff}.jpg`);
    const data = await compareImages(
        fs.readFileSync(`${program.output}/${before}.jpg`),
        fs.readFileSync(`${program.output}/${after}.jpg`),
    );
    fs.writeFileSync(`${program.output}/${diff}.jpg`, data.getBuffer());
    console.log('Complete:', data);
    if (Number(data.misMatchPercentage) > program.threshold) {
        throw new Error(data);
    }
}

const before = 'before';
const after = 'after';
const diff = 'diff';

Promise.all([
    screenshot(beforeUrl, before),
    screenshot(afterUrl, after),
]).then(() => {
    return diffshot(before, after, diff);
}).catch((e) => {
    onError(e);
});
