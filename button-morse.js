module.exports = function(RED) {
    function ButtonMorseNode(config) {
        RED.nodes.createNode(this, config);
        var node = this;
        /* --- */
        node.on('setup', function(msg) {
/* --- */
// Code added here will run during setup
/* --- */
        });
        /* --- */
        node.on('start', function(msg) {
/* --- */
// Code added here will be run whenever the node receives input.
/*
Sends the following messages:

1) When button is pressed and released:
   topic: "button_down", "button_up"
   Notitce that debounce should be handled by input, before passing message to this node.

2) While button is pressed, and time passses, a progress message is sent,
   every time it passes into a new timer action.
   f.ex.:
   topic: "progress_short_press", "progress_long_press", "progress_hold", "progress_todo", "progress_quiet", "progress_reboot", "progresss_shutdown", "progress_nop"

3) When key is released, the last progress message is sent as an action.
   f.ex:
   topic: "action_short_press", action_quiet", "action_restart", "asction_reboot", "action_nop"

4) After button is released, progress messages are sent as timer intervals pass.
   f.ex.:
   topic: "letter_end", "word_end", "sentence_end", "clear_history"

5) Next time the button is pressed, the last up message may indicate a token (space) to insert, if history has not been cleared.
   f.ex.:
   topic: "action_no_space", action_end_of_character", "action_end_of_word", "action_end_of_sentence"

The payload may look like this:
{
  "dots": "...  ___  ...",     // Notice the use of UTF-8 thin space (\u2009) between morse letters
  "text": "sos",
  "sentence": "sos",
  "word": "sos",
  "letter": "s"
}

Note: You may see the following warnings in the debug log:
    "Unknown context store 'objects' specified. Using default store."
    "Context ... contains circular referece that cannot be persisted"
  The warnings have no effect on the functionality, but you may want to
  update your .node-red/settings.js to have a contextStorage like this:
     contextStorage: {
         default: { module:"localfilesystem" },
         memory: { module:"memory" },
         objects: { module:"localfilesystem", config: { cache: true, flushInterval: 28800 } }
     },

Created by: Erik Johansen, 2021-12-12

*/
const debug = false //
const down = 0
const up = 1
const states = { [up]: 'up', [down]: 'down' }
const send_progress = context.get('send_progress', 'memory') || true;

const dot_length = context.get('dot_length', 'memory') || 333
const dash_length = dot_length*3

const thin_space = "\u2009"
const erase_word = "\u232B"

String.prototype.ucfirst = function() {
    return this.charAt(0).toUpperCase() + this.slice(1);
};

const down_delays  = [
    {
        time: dot_length/2,    // Notice that '.' is default as soon as key is pressed
        token: '.',
        name: 'short press'
    },
    {
        time: dash_length/2,   // After 3/2 dot length we accept it as a dash
        token: '_',
        name: 'long press',
    },
    {
        time: 3000,
        token: '~' ,
        name: 'hold',

    },
    {
        time: 7000,
        name: 'todo',
        progress_action: function (t) {
        },
        action: function (t) {
        }
    },
    {
        time: 10000,
        name: 'Quiet',
        progress_action: function (t) {
        },
        action: function (t) {
        },
    },
    {
        time: 12500,
        name: 'Reboot',
        progress_action: function (t) {
        },
        action: function (t) {
        },
    },
    {
        time: 15000,
        name: 'Shutdown',
        progress_action: function (t) {
        },
        action: function (t) {
        },
    },
    {
        time: 20000,
        name: 'NOP',
    },
];

const up_delays = [
    {
        token: "",
        name: 'no_space'
    },
    {
        time: dash_length,  // Pause between letters
        token: thin_space,  // Removed after parsing
        name: 'End of letter',
        progress_label: 'letter_end',
/*
        progress_action: function(t) {
        },
*/
    },
    {
        time: dot_length*7,  // Word pause
        token: " ",
        name: 'End of word',
        progress_label: 'word_end',
/*
        progress_action: function(t) {
        },
        action: function () {
            // Does not make much sense. Is not fired until button is pressed next time.
        }
*/
    },
    {
        time: dot_length*12, // Sentence pause
        token: "   ",
        name: 'End of sentence',
        progress_label: 'sentence_end',
        progress_action: function (t) {
            const history = [].concat(context.get('history', 'memory')||[])
            history.push(dot_info().text);
            context.set('history', history, 'memory')

            context.set('dots', null, 'memory');
        }
    },
    {
        time: dot_length*50,
        name: 'Clear history',
        progress_label: 'clear_history',
        progress_action: function (t) {
            context.set('history', null, 'memory');
        }
    },

];

const button_data = {
    down: {
        name: 'down',
        delays: down_delays,
    },
    up: {
        name: 'up',
        delays: up_delays,
    },
}


const morse_codes = [
      // 9
      { seq: '...___...', key: 'SOS' }, // Without letter spaces
      // 8
      { seq: '........', key: erase_word },
      // 6
      { seq: '._._._', key: '.' }, { seq: '__..__', key: ', ' }, { seq: '___...', key: ':' },
      { seq: '..__..', key: '?' }, { seq: '.____.', key: "'"  }, { seq: '_...._', key: '-' },
      { seq: '_.__._', key: '(' }, { seq: '._.._.', key: '"'  },
      // 5
      { seq: '_.._.', key: '/' },
      { seq: '.____', key: '1' }, { seq: '..___', key: '2' }, { seq: '...__', key: '3' },
      { seq: '...._', key: '4' }, { seq: '.....', key: '5' }, { seq: '_....', key: '6' },
      { seq: '__...', key: '7' }, { seq: '___..', key: '8' }, { seq: '____.', key: '9' },
      { seq: '_____', key: '0' },
      // 4
      { seq: '_...', key: 'b' }, { seq: '_._.', key: 'c' }, { seq: '.._.', key: 'f' },
      { seq: '....', key: 'h' }, { seq: '.___', key: 'j' }, { seq: '._..', key: 'l' },
      { seq: '.__.', key: 'p' }, { seq: '__._', key: 'q' }, { seq: '_.._', key: 'x' },
      { seq: '_.__', key: 'y' }, { seq: '__..', key: 'z' },
      // 3
      { seq: '_..', key: 'd' }, { seq: '__.', key: 'g' }, { seq: '_._', key: 'k' },
      { seq: '___', key: 'o' }, { seq: '._.', key: 'r' }, { seq: '...', key: 's' },
      { seq: '.._', key: 'u' }, { seq: '.._', key: 'v' }, { seq: '.__', key: 'w' },
      // 2
      { seq: '._', key: 'a' }, { seq: '..', key: 'i' }, { seq: '__', key: 'm' }, { seq: '_.', key: 'n' },
      // 1
      { seq: '.', key: 'e' }, { seq: '_', key: 't' },
    ]


// Clear pending timers
const timers  = context.get('timers', 'objects') || [];
for (const ct in timers) {
//  if (debug) node.warn('clearTimeout '+ct+' : '+timers[ct]);
    clearTimeout(timers[ct]);
}
context.set('timers', [], 'objects');

// Get button state (previous and current)
const state = states[msg.payload]
const prev_state = context.get('state', 'memory') || states[1-msg.payload]

// Get data associated with state
const button = button_data[state];
const prev_button = button_data[prev_state]

// See what token (idx) is selected (shifted by timed events)
const prev_idx = prev_button && context.get(prev_state+'_token_idx', 'memory')
const prev_dly = prev_idx!==null && prev_button.delays[prev_idx]
const prev_dot = get_dot();

// Add dot (up/down) to list of dots
const dots = (context.get('dots', 'memory') || []);
if (prev_dot) {
    if (debug) node.warn(prev_dly.name+'!')
    const di = send_dot_info(prev_dly.action_label || ('action_'+(prev_dly.name||'no_name').toLowerCase().replace(/[^a-z0-9_]/g, '_')), prev_dot);
    if (debug) node.warn('Key '+prev_state+' ('+(di.token||'')+')  Word: '+di.word+' Sentence: '+di.sentence+' Dots: '+di.dots + ' Press list: '+JSON.stringify(dots));
    dots.push(prev_dot);
}
if ( prev_dly && prev_dly.action ) prev_dly.action(prev_dly)
context.set('dots', dots, 'memory');
context.set('state', state, 'memory')
context.set(state+'_time', (new Date()).getTime(), 'memory');
context.set(state+'_token_idx', 0, 'memory')
context.set(state+'_token', button.delays[0].token || null, 'memory')

const di = send_dot_info('button_'+state)
if (debug) node.warn('Key '+state+' ('+(di.token||'')+')  Word: '+di.word+' Sentence: '+di.sentence+' Dots: '+di.dots + ' Press list: '+( dots && dots.map(p => p.state+':'+p.time+':'+p.token).join('/'))+' - dot: '+JSON.stringify(dots[dots.length-1]));
// Note that topic may be for button up, but info is about previous down state/time (or reverse)


// Start new timers
let new_timers = [];
button.delays.forEach((act, i) => {
    if ( ! act.time ) return;
//  node.warn('Start '+state+' timer '+act.time)
    const t = setTimeout(function () {
        if (debug) node.warn(state.ucfirst()+' delay '+act.time+' passed ('+(act.name||act.token)+')');
        context.set(state+'_token', act.token || null, 'memory')
        context.set(state+'_token_idx', i, 'memory')
        if (debug) node.warn(act.name)
        const di = send_progress && send_dot_info(act.progress_label || ('progress_'+act.name.toLowerCase().replace(/[^a-z0-9_]/g, '_')));
        if ( act.progress_action ) act.progress_action(act, di)
    }, act.time);
    new_timers.push( t );
});
context.set('timers', new_timers, 'objects')

node.done(); // done with msg
return null;


/*
**
*/
function get_dot() {
    const state = context.get('state', 'memory') || states[1-msg.payload];
    const button = state && button_data[state]
    const idx        = context.get(state+'_token_idx', 'memory')
    if ( ! ( button && idx!=null && button.delays[idx] ) ) return null;
    const start_time = context.get(state+'_time', 'memory') || 0;
    const token      = context.get(state+'_token', 'memory') || ''
    let now = (new Date()).getTime();
    let delta_time = now - start_time;
    if (debug) node.warn(state.ucfirst()+' time: '+ delta_time+' Token: ('+token+')');

    const dot = { state: state, start: start_time, time: delta_time, idx: idx, token: token };
    return dot;
}
/*
**
*/

function dot_info(dot_temp) {
    const dots_array = [].concat(context.get('dots', 'memory') || []);
    if ( !dot_temp ) dot_temp=get_dot();
    if ( dot_temp ) dots_array.push(dot_temp);
    //
    // Here would be a good place to recalculate context('dot_length'),
    // based on actual short/long intervals in dots_array.
    //
    // Join dots into a string
    let dots = dots_array.map(d => d.token || '').join("").replace(/^\s+|\s+$/g, '')
    let match_a = [];
    let match_h = {}
    morse_codes.forEach( v => {
        // escape '.' that would otherwise match everything in regexp
        match_a.push(v.seq.replace(/\./g, "\\."));
        match_h[v.seq]=v;
    })
    let match_r = new RegExp("^("+match_a.join('|')+")\u2009?")
//  node.warn('Match using regexp:  '+match_r)

    let remain = dots
    let text = ''
    while ( remain && remain != '' ) {
//      node.warn('About to match: '+remain+' => '+text)
        let found = remain.match(match_r);
        if ( !found ) found = [remain.slice(0,1), remain.slice(0,1)]
        // found[0] is total match (including possible thin space), found[1] is actual match (if any)
//      node.warn('<<'+found[0]+'>> / <<'+found[1]+'>>')
        remain = remain.slice(found[0].length); // Remove first char
        let op=match_h[found[1]]
        if ( op && op.key ) text += op.key;
//      if ( op && op.action ) text = op.action(text)  // Notice that action runs every time this sequence is sent
    }
//  node.warn('Processed text: '+text)
    text = text.replace(/\u2009/g, "").replace(/\w*\u232B/g, "")
    const smatch = text.match(/([^\.]+)/g)
    const wmatch = text.match(/(\w+)/g)
    const lmatch = text.match(/(\w)/g)
    const dot = dot_temp || (dots_array && dots_array.length && dots_array[dots_array.length - 1])

    const inf = {
        dots:     dots,
        text:     text,
        sentence: smatch && smatch[smatch.length - 1],  // last sentence
        word:     wmatch && wmatch[wmatch.length - 1],
        letter:   lmatch && lmatch[lmatch.length - 1],

        state:    dot ? dot.state : null,
        token:    dot ? dot.token : null,
        time:     dot ? dot.time  : null,
    };
    if (debug) node.warn('dot_info from dot: '+JSON.stringify(dot)+'  => '+JSON.stringify(inf));

    return inf;
}

function send_dot_info(topic, dot_temp) {
    const di = dot_info(dot_temp)
    const msg = { topic: topic, payload: di };
    node.send(msg)
    return di;
}

/* --- */
    });
    RED.nodes.registerType('button-morse', ButtonMorseNode);
}
