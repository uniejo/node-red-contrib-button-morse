'use strict';

const should = require('should');
const helper = require('node-red-node-test-helper');
const buttonMorse = require('../button-morse.js');
const { decode } = buttonMorse;

helper.init(require.resolve('node-red'));

const DOT = 40; // ms - short dot length keeps the tests fast
const wait = ms => new Promise(resolve => setTimeout(resolve, ms));

// Timings relative to DOT: dot press < 0.5, dash press > 1.5, letter gap 3..7
async function press(n1, symbols) {
    for (let i = 0; i < symbols.length; i++) {
        n1.receive({ payload: 0 });
        await wait(symbols[i] === '.' ? DOT * 0.2 : DOT * 2.5);
        n1.receive({ payload: 1 });
        await wait(i < symbols.length - 1 ? DOT * 0.5 : DOT * 4.5);
    }
}

function flowWith(extra) {
    return [
        Object.assign({ id: 'n1', type: 'button-morse', name: 'morse', dotLength: DOT, wires: [['n2']] }, extra),
        { id: 'n2', type: 'helper' },
    ];
}

describe('decode()', function () {
    it('decodes letters separated by thin spaces', function () {
        decode('... ___ ...').should.equal('sos');
    });
    it('decodes SOS without letter spaces', function () {
        decode('...___...').should.equal('SOS');
    });
    it('keeps word spaces', function () {
        decode('... ___ ... ._').should.equal('sos a');
    });
    it('decodes v, u and å correctly', function () {
        decode('..._ .._ .__._').should.equal('vuå');
    });
    it('erases the previous word', function () {
        decode('... ._ ........').should.equal('s');
    });
});

describe('button-morse node', function () {
    this.timeout(5000);

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload().then(() => helper.stopServer(done));
    });

    it('should be loaded', async function () {
        await helper.load(buttonMorse, flowWith());
        const n1 = helper.getNode('n1');
        n1.should.have.property('name', 'morse');
    });

    it('sends button_down and button_up', async function () {
        await helper.load(buttonMorse, flowWith({ sendProgress: false }));
        const n1 = helper.getNode('n1');
        const n2 = helper.getNode('n2');
        const topics = [];
        n2.on('input', msg => topics.push(msg.topic));
        n1.receive({ payload: 0 });
        await wait(5);
        n1.receive({ payload: 1 });
        await wait(5);
        topics.should.eql(['button_down', 'action_short_press', 'button_up']);
    });

    it('decodes "sos" at sentence end', async function () {
        await helper.load(buttonMorse, flowWith());
        const n1 = helper.getNode('n1');
        const n2 = helper.getNode('n2');
        const sentenceEnd = new Promise(resolve => {
            n2.on('input', msg => {
                if (msg.topic === 'sentence_end') resolve(msg);
            });
        });
        await press(n1, '...');
        await press(n1, '___');
        await press(n1, '...');
        const msg = await sentenceEnd;
        msg.payload.should.have.properties({ text: 'sos', word: 'sos', letter: 's', sentence: 'sos' });
    });

    it('decodes two words', async function () {
        await helper.load(buttonMorse, flowWith({ sendProgress: false }));
        const n1 = helper.getNode('n1');
        const n2 = helper.getNode('n2');
        let lastMsg;
        n2.on('input', msg => { lastMsg = msg; });
        await press(n1, '._');            // a
        await wait(DOT * 4);              // extend pause to a word end (> 7 dots)
        await press(n1, '_...');          // b
        n1.receive({ payload: 0 });       // next press finishes the last pause
        lastMsg.payload.text.should.equal('a b');
        lastMsg.payload.word.should.equal('b');
    });

    it('ignores repeated identical states', async function () {
        await helper.load(buttonMorse, flowWith({ sendProgress: false }));
        const n1 = helper.getNode('n1');
        const n2 = helper.getNode('n2');
        const topics = [];
        n2.on('input', msg => topics.push(msg.topic));
        n1.receive({ payload: 0 });
        n1.receive({ payload: 0 });
        await wait(5);
        topics.should.eql(['button_down']);
    });

    it('honours invert', async function () {
        await helper.load(buttonMorse, flowWith({ sendProgress: false, invert: true }));
        const n1 = helper.getNode('n1');
        const n2 = helper.getNode('n2');
        const msg = new Promise(resolve => n2.on('input', resolve));
        n1.receive({ payload: 1 });
        (await msg).topic.should.equal('button_down');
    });

    it('reports an error for invalid payloads', async function () {
        await helper.load(buttonMorse, flowWith());
        const n1 = helper.getNode('n1');
        n1.receive({ payload: 'pressed' });
        await wait(5);
        const logs = helper.log().args.filter(a => a[0].type === 'button-morse' && a[0].level === helper.log().ERROR);
        logs.length.should.equal(1);
    });
});

describe('long presses and feedback', function () {
    this.timeout(5000);

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload().then(() => helper.stopServer(done));
    });

    // Fast long-press steps, in seconds (must be longer than a dash: 1.5 * DOT)
    const holds = [{ time: 0.15, name: 'Wi-Fi' }, { time: 0.3, name: 'reboot' }, { time: 0.45, name: 'cancel' }];

    async function hold(n1, ms) {
        n1.receive({ payload: 0 });
        await wait(ms);
        n1.receive({ payload: 1 });
        await wait(5);
    }

    it('uses personal long-press steps for progress and action topics', async function () {
        await helper.load(buttonMorse, flowWith({ holds }));
        const n1 = helper.getNode('n1');
        const topics = [];
        helper.getNode('n2').on('input', msg => topics.push(msg.topic));
        await hold(n1, 380);
        topics.should.containDeepOrdered(['progress_wi_fi', 'progress_reboot', 'action_reboot']);
        topics.should.not.containEql('progress_cancel');
        topics.should.not.containEql('progress_hold'); // defaults are replaced
    });

    it('sends each long-press action on its own output', async function () {
        const flow = [
            { id: 'n1', type: 'button-morse', dotLength: DOT, holds, actionOutputs: true, wires: [['all'], ['wifi'], ['reboot'], ['cancel']] },
            { id: 'all', type: 'helper' }, { id: 'wifi', type: 'helper' },
            { id: 'reboot', type: 'helper' }, { id: 'cancel', type: 'helper' },
        ];
        await helper.load(buttonMorse, flow);
        const got = { wifi: [], reboot: [], cancel: [] };
        Object.keys(got).forEach(id => helper.getNode(id).on('input', msg => got[id].push(msg.topic)));
        await hold(helper.getNode('n1'), 200);
        got.should.eql({ wifi: ['action_wi_fi'], reboot: [], cancel: [] });
    });

    it('ignores invalid long-press steps', async function () {
        await helper.load(buttonMorse, flowWith({ holds: [{ time: 0.01, name: 'too short' }, { time: 0.2, name: '' }, { time: 0.2, name: 'ok' }] }));
        const topics = [];
        helper.getNode('n2').on('input', msg => topics.push(msg.topic));
        await hold(helper.getNode('n1'), 250);
        topics.should.containEql('action_ok');
        topics.should.not.containEql('progress_too_short');
    });

    it('plays back the keyed letter on the feedback output', async function () {
        const flow = [
            { id: 'n1', type: 'button-morse', dotLength: DOT, feedbackLetters: true, wires: [[], ['fb']] },
            { id: 'fb', type: 'helper' },
        ];
        await helper.load(buttonMorse, flow);
        const fb = [];
        helper.getNode('fb').on('input', msg => fb.push(msg.payload));
        await press(helper.getNode('n1'), '._'); // a: waits past letter end
        await wait(300);                         // playback dot = max(50 ms, DOT / 2): 50+50+150 ms
        fb.should.eql([1, 0, 1, 0]);
    });

    it('blinks when a long-press step is reached, and stops on release', async function () {
        const flow = [
            { id: 'n1', type: 'button-morse', dotLength: DOT, holds, feedbackHolds: true, wires: [[], ['fb']] },
            { id: 'fb', type: 'helper' },
        ];
        await helper.load(buttonMorse, flow);
        const fb = [];
        helper.getNode('fb').on('input', msg => fb.push(msg.payload));
        await hold(helper.getNode('n1'), 160); // release right after the first blink starts
        fb.should.eql([1, 0]);
    });
});

describe('examples/button-morse-test.json', function () {
    this.timeout(5000);
    const core = name => require('@node-red/nodes/core/' + name);
    const coreNodes = [core('common/20-inject.js'), core('common/90-comment.js'), core('function/10-switch.js')];

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload().then(() => helper.stopServer(done));
    });

    it('decodes SOS clicked on the inject nodes', async function () {
        // Put the nodes on a tab (the editor does this on import), swap the
        // debug nodes for helper nodes and shorten the dot length
        const flow = [{ id: 'tab1', type: 'tab' }].concat(require('../examples/button-morse-test.json').map(n =>
            n.type === 'debug' ? { id: n.id, z: 'tab1', type: 'helper' }
                : Object.assign({}, n, { z: 'tab1' }, n.type === 'button-morse' ? { dotLength: DOT } : {})));
        await helper.load(coreNodes.concat(buttonMorse), flow);
        const down = helper.getNode('bm_inject_down');
        const up = helper.getNode('bm_inject_up');
        const sentence = new Promise(resolve => helper.getNode('bm_debug_sentence').on('input', resolve));
        const clicker = { receive: msg => (msg.payload === 0 ? down : up).receive({}) };
        await press(clicker, '...');
        await press(clicker, '___');
        await press(clicker, '...');
        (await sentence).payload.sentence.should.equal('sos');
    });
});

describe('other examples', function () {
    this.timeout(8000);
    const core = name => require('@node-red/nodes/core/' + name);
    const coreNodes = ['common/20-inject.js', 'common/90-comment.js', 'function/10-switch.js',
        'function/15-change.js', 'function/90-exec.js'].map(core);

    // Load an example the way the editor imports it: on a tab, with debug nodes as helpers
    function loadExample(name, morse = {}) {
        const flow = [{ id: 'tab1', type: 'tab' }].concat(require('../examples/' + name + '.json').map(n =>
            n.type === 'debug' ? { id: n.id, z: 'tab1', type: 'helper' }
                : Object.assign({}, n, { z: 'tab1' }, n.type === 'button-morse' ? Object.assign({ dotLength: DOT }, morse) : {})));
        return helper.load(coreNodes.concat(buttonMorse), flow);
    }
    const firstInput = id => new Promise(resolve => helper.getNode(id).once('input', resolve));

    beforeEach(function (done) {
        helper.startServer(done);
    });

    afterEach(function (done) {
        helper.unload().then(() => helper.stopServer(done));
    });

    it('every example wires exactly as many outputs as button-morse has', function () {
        require('fs').readdirSync(__dirname + '/../examples').forEach(file => {
            require('../examples/' + file).filter(n => n.type === 'button-morse').forEach(n => {
                n.wires.length.should.equal(n.outputs || 1, file);
            });
        });
    });

    it('raspberry-pi-gpio: feedback output is wired to a GPIO output', function () {
        const flow = require('../examples/raspberry-pi-gpio.json');
        const morse = flow.find(n => n.type === 'button-morse');
        const led = flow.find(n => n.type === 'rpi-gpio out');
        morse.wires.length.should.equal(morse.outputs);
        morse.wires[1].should.eql([led.id]);
    });

    it('raspberry-pi-gpio: GPIO pull-up input with debounce is wired to button-morse', function () {
        const flow = require('../examples/raspberry-pi-gpio.json');
        const gpio = flow.find(n => n.type === 'rpi-gpio in');
        gpio.should.have.properties({ intype: 'up' });
        Number(gpio.debounce).should.be.above(0);
        const morse = flow.find(n => n.type === 'button-morse');
        gpio.wires[0].should.containEql(morse.id);
    });

    it('long-press-actions: holding to the reboot step runs the (echo only) reboot command', async function () {
        // Same steps as the example, but 50 times faster
        const holds = require('../examples/long-press-actions.json').find(n => n.type === 'button-morse').holds
            .map(h => ({ time: h.time / 50, name: h.name }));
        await loadExample('long-press-actions', { holds });
        const result = firstInput('lp_debug_result');
        const led = [];
        helper.getNode('lp_debug_led').on('input', msg => led.push(msg.payload));
        const n1 = helper.getNode('lp_morse');
        n1.receive({ payload: 0 });
        await wait(250); // past reboot (0.2 s), before shutdown (0.3 s)
        n1.receive({ payload: 1 });
        (await result).payload.should.match(/Would run: sudo shutdown -r now/);
        led.filter(v => v === 1).length.should.equal(2); // one blink per step reached
    });

    it('long-press-actions: commands only echo', function () {
        require('../examples/long-press-actions.json').filter(n => n.type === 'exec')
            .forEach(n => n.command.should.startWith('echo '));
    });

    it('morse-commands: spelling "on" sets the LED to 1', async function () {
        await loadExample('morse-commands');
        const led = firstInput('mc_debug_led');
        const clicker = { receive: msg => helper.getNode(msg.payload === 0 ? 'mc_inject_down' : 'mc_inject_up').receive({}) };
        await press(clicker, '___');
        await press(clicker, '_.');
        (await led).payload.should.equal(1);
    });

    it('morse-commands: "sos" sends an alert', async function () {
        await loadExample('morse-commands');
        const alert = firstInput('mc_debug_alert');
        helper.getNode('mc_switch_topic').receive({ topic: 'sentence_end', payload: { sentence: 'SOS' } });
        (await alert).payload.should.equal('SOS received!');
    });
});
