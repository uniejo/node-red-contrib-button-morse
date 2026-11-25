'use strict';

/*
 * button-morse: time button down/up events and decode them as Morse code.
 *
 * See README.md for the messages sent by this node.
 *
 * Created by: Erik Johansen, 2021-12-12
 */

const THIN_SPACE = ' ';
const ERASE_WORD = '⌫';

const DOWN = 'down';
const UP = 'up';

// Ordered longest first, so the regexp alternation prefers the longest match.
const MORSE_CODES = [
    { seq: '______.._._____', key: '%' }, // '0/0'
    { seq: '______' + THIN_SPACE + '.._.' + THIN_SPACE + '_____', key: '%' }, // '0/0'
    // 9
    { seq: '...___...', key: 'SOS' }, // Without letter spaces
    // 8
    { seq: '........', key: ERASE_WORD },
    // 6
    { seq: '._._._', key: '.' }, { seq: '__..__', key: ',' }, { seq: '___...', key: ':' },
    { seq: '..__..', key: '?' }, { seq: '.____.', key: "'" }, { seq: '_...._', key: '-' },
    { seq: '_.__._', key: '(' }, { seq: '._.._.', key: '"' }, { seq: '.__._.', key: '@' },
    { seq: '_._.__', key: '!' },
    // 5
    { seq: '.____', key: '1' }, { seq: '..___', key: '2' }, { seq: '...__', key: '3' },
    { seq: '...._', key: '4' }, { seq: '.....', key: '5' }, { seq: '_....', key: '6' },
    { seq: '__...', key: '7' }, { seq: '___..', key: '8' }, { seq: '____.', key: '9' },
    { seq: '_____', key: '0' },
    { seq: '_.._.', key: '/' }, { seq: '._...', key: '&' }, { seq: '_.__.', key: ')' },
    { seq: '_..._', key: '=' }, { seq: '._._.', key: '+' },
    { seq: '.__._', key: 'å' }, // å/à
    { seq: '_._..', key: 'ć' },
    // 4
    { seq: '_...', key: 'b' }, { seq: '_._.', key: 'c' }, { seq: '.._.', key: 'f' },
    { seq: '....', key: 'h' }, { seq: '.___', key: 'j' }, { seq: '._..', key: 'l' },
    { seq: '.__.', key: 'p' }, { seq: '__._', key: 'q' }, { seq: '..._', key: 'v' },
    { seq: '_.._', key: 'x' }, { seq: '_.__', key: 'y' }, { seq: '__..', key: 'z' },
    { seq: '._._', key: 'æ' }, // æ/ä
    { seq: '___.', key: 'ø' }, // ø/ö
    // 3
    { seq: '_..', key: 'd' }, { seq: '__.', key: 'g' }, { seq: '_._', key: 'k' },
    { seq: '___', key: 'o' }, { seq: '._.', key: 'r' }, { seq: '...', key: 's' },
    { seq: '.._', key: 'u' }, { seq: '.__', key: 'w' },
    // 2
    { seq: '._', key: 'a' }, { seq: '..', key: 'i' }, { seq: '__', key: 'm' }, { seq: '_.', key: 'n' },
    // 1
    { seq: '.', key: 'e' }, { seq: '_', key: 't' },
];

const escapeRegExp = s => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
const MORSE_BY_SEQ = new Map(MORSE_CODES.map(c => [c.seq, c]));
const MORSE_REGEXP = new RegExp(
    '^(' + MORSE_CODES.map(c => escapeRegExp(c.seq)).join('|') + ')' + THIN_SPACE + '?'
);

const slug = name => (name || 'no_name').toLowerCase().replace(/[^a-z0-9_]/g, '_');

/**
 * Decode a string of '.', '_', thin spaces (letter ends) and spaces (word ends) into text.
 */
function decode(dots) {
    let remain = dots;
    let text = '';
    while (remain) {
        const found = remain.match(MORSE_REGEXP);
        if (found) {
            text += MORSE_BY_SEQ.get(found[1]).key;
            remain = remain.slice(found[0].length);
        } else {
            const ch = remain[0];
            if (ch === ' ' && !text.endsWith(' ')) text += ' '; // word separator
            remain = remain.slice(1); // unknown sequence / stray letter space
        }
    }
    // Each erase token removes itself and the word before it
    while (text.includes(ERASE_WORD)) {
        text = text.replace(new RegExp('[^\\s' + ERASE_WORD + ']*\\s*' + ERASE_WORD), '');
    }
    return text.trim();
}

function last(matches) {
    return matches && matches.length ? matches[matches.length - 1] : null;
}

function parsePayload(payload, invert) {
    let value;
    if (payload === 0 || payload === '0' || payload === false) value = 0;
    else if (payload === 1 || payload === '1' || payload === true) value = 1;
    else return null;
    if (invert) value = 1 - value;
    return value === 0 ? DOWN : UP;
}

// Default long-press steps (seconds). Editable per node in the editor.
const DEFAULT_HOLDS = [
    { time: 3, name: 'hold' },
    { time: 7, name: 'todo' },
    { time: 10, name: 'quiet' },
    { time: 12.5, name: 'reboot' },
    { time: 15, name: 'shutdown' },
    { time: 20, name: 'nop' },
];

/**
 * Validate configured long-press steps: [{time (s), name}] -> sorted [{time (ms), name}].
 * Steps not longer than the dash threshold are dropped (they would never be reached).
 */
function parseHolds(holds, minMs) {
    if (!Array.isArray(holds)) holds = DEFAULT_HOLDS;
    return holds
        .map(h => ({ time: Number(h && h.time) * 1000, name: String((h && h.name) || '').trim() }))
        .filter(h => h.time > minMs && h.name)
        .sort((a, b) => a.time - b.time);
}

module.exports = function (RED) {
    function ButtonMorseNode(config) {
        RED.nodes.createNode(this, config);
        const node = this;

        const dotLength = Number(config.dotLength) > 0 ? Number(config.dotLength) : 333;
        const dashLength = dotLength * 3;
        const sendProgress = config.sendProgress !== false;
        const invert = config.invert === true;
        const holds = parseHolds(config.holds, dashLength / 2);
        if (Array.isArray(config.holds) && holds.length !== config.holds.length) {
            node.warn('button-morse: ignored long-press steps without a name or not longer than a dash');
        }

        // Outputs: [events, feedback (optional), one per long-press step (optional)]
        const feedbackLetters = config.feedbackLetters === true;
        const feedbackHolds = config.feedbackHolds === true;
        const feedbackOutput = feedbackLetters || feedbackHolds ? 1 : null;
        const actionOutputs = config.actionOutputs === true;
        const firstActionOutput = 1 + (feedbackOutput ? 1 : 0);
        const outputCount = firstActionOutput + (actionOutputs ? holds.length : 0);
        const feedbackDot = Math.max(50, dotLength / 2);

        const downDelays = [
            { time: dotLength / 2, token: '.', name: 'short press' }, // '.' is the default as soon as key is pressed
            { time: dashLength / 2, token: '_', name: 'long press' }, // After 3/2 dot length it is a dash
            // Long presses end the current letter ('~' is not Morse, so it separates letters)
            ...holds.map((h, i) => ({
                time: h.time,
                token: '~',
                name: h.name,
                holdIndex: i,
                progressAction: () => {
                    if (feedbackHolds) blink();
                },
            })),
        ];

        const upDelays = [
            { token: '', name: 'no_space' },
            {
                time: dashLength,
                token: THIN_SPACE,
                name: 'End of letter',
                progressLabel: 'letter_end',
                progressAction: () => {
                    if (feedbackLetters) playLastLetter();
                },
            },
            { time: dotLength * 7, token: ' ', name: 'End of word', progressLabel: 'word_end' },
            {
                time: dotLength * 12,
                token: '   ',
                name: 'End of sentence',
                progressLabel: 'sentence_end',
                progressAction: () => {
                    history.push(dotInfo().text);
                    dots = [];
                },
            },
            {
                time: dotLength * 50,
                name: 'Clear history',
                progressLabel: 'clear_history',
                progressAction: () => {
                    history = [];
                },
            },
        ];

        const delaysFor = { [DOWN]: downDelays, [UP]: upDelays };

        // Per-node state (kept in memory; timers cannot be persisted)
        let timers = [];
        let dots = [];
        let history = [];
        let state = null; // current button state
        let stateTime = 0;
        let tokenIdx = null;
        let feedbackTimers = [];
        let feedbackOn = false;

        function clearTimers() {
            timers.forEach(t => clearTimeout(t));
            timers = [];
        }

        // Send msg on one output (by index); other outputs get nothing
        function sendTo(send, index, msg) {
            if (outputCount === 1) return send(msg);
            const msgs = new Array(outputCount).fill(null);
            msgs[index] = msg;
            send(msgs);
        }

        // --- Feedback output: 1/0 for an LED or buzzer ---
        function feedback(value) {
            feedbackOn = value === 1;
            sendTo(node.send.bind(node), feedbackOutput, { topic: 'feedback', payload: value });
        }

        function stopFeedback() {
            feedbackTimers.forEach(t => clearTimeout(t));
            feedbackTimers = [];
            if (feedbackOn) feedback(0);
        }

        function playPattern(pattern) {
            stopFeedback();
            let t = 0;
            for (const symbol of pattern) {
                feedbackTimers.push(setTimeout(() => feedback(1), t));
                t += symbol === '_' ? feedbackDot * 3 : feedbackDot;
                feedbackTimers.push(setTimeout(() => feedback(0), t));
                t += feedbackDot;
            }
        }

        function blink() {
            playPattern('.');
        }

        // Play back the symbols of the letter just keyed
        function playLastLetter() {
            const groups = dotInfo().dots.split(/[\s\u2009~]+/);
            const pattern = groups[groups.length - 1];
            if (/^[._]+$/.test(pattern)) playPattern(pattern);
        }

        // The press/pause currently in progress
        function currentDot() {
            if (!state || tokenIdx === null) return null;
            const delay = delaysFor[state][tokenIdx];
            return {
                state,
                start: stateTime,
                time: Date.now() - stateTime,
                idx: tokenIdx,
                token: delay.token || '',
            };
        }

        function dotInfo(dotTemp) {
            const all = dots.slice();
            const dot = dotTemp || currentDot();
            if (dot) all.push(dot);
            const dotString = all.map(d => d.token || '').join('').trim();
            const text = decode(dotString);
            const lastDot = dot || all[all.length - 1];
            return {
                dots: dotString,
                text,
                sentence: last((text.match(/[^.]+/g) || []).map(s => s.trim()).filter(Boolean)),
                word: last(text.match(/[\p{L}\p{N}]+/gu)),
                letter: last(text.match(/[\p{L}\p{N}]/gu)),
                history: history.slice(),
                state: lastDot ? lastDot.state : null,
                token: lastDot ? lastDot.token : null,
                time: lastDot ? lastDot.time : null,
            };
        }

        function sendDotInfo(send, topic, dotTemp) {
            const info = dotInfo(dotTemp);
            sendTo(send, 0, { topic, payload: info });
            return info;
        }

        node.on('input', function (msg, send, done) {
            const newState = parsePayload(msg.payload, invert);
            if (!newState) {
                done(new Error('button-morse: msg.payload must be 0/1 (or true/false), got ' + JSON.stringify(msg.payload)));
                return;
            }
            if (newState === state) {
                done(); // Repeated state (e.g. bounce): ignore
                return;
            }

            clearTimers();
            stopFeedback();

            // Finish the previous press/pause and record it
            const prevDot = currentDot();
            if (prevDot) {
                const prevDelay = delaysFor[state][tokenIdx];
                const topic = prevDelay.actionLabel || 'action_' + slug(prevDelay.name);
                const info = sendDotInfo(send, topic, prevDot);
                if (actionOutputs && prevDelay.holdIndex !== undefined) {
                    sendTo(send, firstActionOutput + prevDelay.holdIndex, { topic, payload: info });
                }
                dots.push(prevDot);
            }

            state = newState;
            stateTime = Date.now();
            tokenIdx = 0;
            sendDotInfo(send, 'button_' + state);

            // Start timers for the new state
            const thisState = state;
            delaysFor[thisState].forEach((delay, i) => {
                if (!delay.time) return;
                timers.push(setTimeout(() => {
                    tokenIdx = i;
                    const info = sendProgress
                        ? sendDotInfo(node.send.bind(node), delay.progressLabel || 'progress_' + slug(delay.name))
                        : null;
                    if (delay.progressAction) delay.progressAction(delay, info);
                }, delay.time));
            });

            done();
        });

        node.on('close', function () {
            clearTimers();
            feedbackTimers.forEach(t => clearTimeout(t));
        });
    }

    RED.nodes.registerType('button-morse', ButtonMorseNode);
};

module.exports.decode = decode;
module.exports.DEFAULT_HOLDS = DEFAULT_HOLDS;
