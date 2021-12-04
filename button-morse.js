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
// Code added here will be run whenever the node is started.
/* --- */
        });
        /* --- */
        node.on('stop', function(msg) {
/* --- */
// Code added here will be run whenever the node is stopped.
/* --- */
        });
        /* --- */
        node.on('input', function(msg) {
/* --- */
/*
Sends the following messages:
1) progress, type=key_Fwn (on each line, if enabled)
2) progress, type=start_time (on eq line, if enabled)
3) progress, type=end time (on eq line, if enabled)
4) key_up, delay (on eq line)
5) progress, type=cancel, (on other lines, if enabled)
*/
const debug = false
const down = 0
const up = 1
const states = { [up]: 'up', [down]: 'down' }
const send_progress = context.get('send_progress') || true;

const dot_length = context.get('dot_length') || 333
const dash_length = dot_length*3
const letter_pause = dash_length
const word_pause = dot_length*7
const sentence_pause = dot_length*12

const thin_space = "\u2009"

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
        name: 'long press'
    },
    {
        time: 3000,
        token: '~' ,
        name: 'hold'
    },
    {
        time: 7000,
        name: '!!!',
        action: function (t) {
            node.warn('!!!')
    //      send_dot_info('action_xxx', null);
        }
    },
    {
        time: 10000,
        name: 'Quiet',
        progress_action: function (t) {
            if (debug) node.warn(t.name)
            send_dot_info('notice_quiet', null);
        },
        action: function (t) {
            if (debug) node.warn(t.name+'!')
            send_dot_info('action_quiet', null);
        },
    },
    {
        time: 12500,
        name: 'Reboot',
        progress_action: function (t) {
            node.warn(t.name)
            send_dot_info('notice_reboot', null);
        },
        action: function (t) {
            node.warn(t.name+'!')
            send_dot_info('action_reboot', null);
        },
    },
    {
        time: 15000,
        name: 'Shutdown',
        progress_action: function (t) {
            node.warn(t.name)
            send_dot_info('notice_shutdown', null);
        },
        action: function (t) {
            node.warn(t.name+'!')
            send_dot_info('action_shutdown', null);
        },
    },
    {
        time: 20000,
        name: 'NOP',
        action: function (t) {
           node.warn(t.name)
        }
    },
];

const up_delays = [
    {
        token: "",
    },
    {
        time: letter_pause,
        token: thin_space,  // Removed after parsing
        name: 'End of letter',
        progress_action: function(t) {
            const di = send_dot_info('letter_end', get_dot())
            if (debug) node.warn(t.name.ucfirst()+': '+di.letter);
        },  
        action: function() {
            // Does not make mutch sense. Is not fired until button is pressed next.
        }
    },
    {
        time: word_pause,
        token: " ",
        name: 'End of word',
        progress_action: function(t) {
            const di = send_dot_info('word_end', get_dot())
            if (debug) node.warn('End of word: '+di.word);
        },
        action: function () {
            // Does not make mutch sense. Is not fired until button is pressed next.
        }
    },
    {
        time: sentence_pause,
        token: "   ",
        name: 'End of sentence',
        progress_action: function (t) {
            const di = send_dot_info('sentence_end', get_dot())
            if (debug) node.warn('End of sentence: '+di.sentence);

            const history = context.get('history')||[]
            history.push(di.text);
            context.set('history', history)

            context.set('dots', null);
        }
    },
    {
        time: dot_length*50,
        name: 'Clear history',
        progress_action: function (t) {
            const di = send_dot_info('clear_history', get_dot())
            if (debug) node.warn('Clear history');
            context.set('history', null);
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
      // 8
      { seq: '........', action: function () { console.log('(TODO: erase last word)') } },
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
const timers  = context.get('timers') || [];
for (const ct in timers) {
    if (debug) node.warn('clearTimeout '+ct+' : '+timers[ct]);
    clearTimeout(timers[ct]);
}
context.set('timers', []);

// Get button state (previous and current)
const state = states[msg.payload]
const prev_state = context.get('state') || states[1-msg.payload]

// Get data associated with state
const button = button_data[state];
const prev_button = button_data[prev_state]

// Calculate time since last press/release
const last_time  = context.get(prev_state+'_time') || 0;
let now = (new Date()).getTime();
let delta_time = now - last_time;
if (debug) node.warn(prev_state.ucfirst()+' time: '+ delta_time);

// See what token (idx) is selected (shifted by timed events)
const prev_idx = prev_button && context.get(prev_state+'_token_idx')
const prev = prev_idx && prev_button.delays[prev_idx]
const prev_token = prev_button && context.get(prev_state+'_token') || ''

if ( prev && prev.action ) prev.action(prev)

// Add dot (up/down) to list of dots
const dot = { state: prev_state, time: delta_time, idx: prev_idx, token: prev_token };
const dots = (context.get('dots') || []);
if (dot) dots.push(dot);
context.set('dots', dots);
context.set('state', state)
context.set(state+'_time', (new Date()).getTime());
context.set(state+'_token_idx', 0)
context.set(state+'_token', button.delays[0].token)


const di = send_dot_info('button_'+state, null)
// Note that topic may be for button up, but info is about down state/time (or reverse)
if (debug) node.warn('Key '+state+' ('+prev_token+')  Word: '+di.word+' Sentence: '+di.sentence+' Dots: '+di.dots + ' Press list: '+( dots && dots.map(p => p.state+':'+p.time+':'+p.token).join('/'))+' - dot: '+JSON.stringify(dot));


// Start new timers
let new_timers = [];
button.delays.forEach((act, i) => {
    if ( ! act.time ) return;
//  node.warn('Start '+state+' timer '+act.time)
    new_timers.push( setTimeout(function () {
        if (debug) node.warn(state.ucfirst()+' delay '+act.time+' passed ('+(act.name||act.token)+')');
        context.set(state+'_token', act.token)
        context.set(state+'_token_idx', i)
        if ( act.progress_action ) act.progress_action(act)
    }, act.time));
});
context.set('timers', new_timers)

node.done(); // done with msg
return null;


/*
**
*/
function get_dot() {
    const prev_state = context.get('state');
    const prev_button = prev_state && button_data[prev_state]
    if ( !prev_button ) return null;
    const last_time  = prev_button && context.get(prev_state+'_time') || 0;
    let now = (new Date()).getTime();
    let delta_time = now - last_time;
    const prev_idx = prev_button && context.get(prev_state+'_token_idx')
    const prev = prev_idx && prev_button.delays[prev_idx]
    const prev_token = prev_button && context.get(prev_state+'_token') || ''

    const dot = prev && prev_token && { state: prev_state, time: delta_time, idx: prev_idx, token: prev_token };
    return dot;
}
/*
**
*/

function dot_info(dot_temp) {
    const dots_array = (context.get('dots') || []);
    if ( dot_temp ) dots_array.push(dot_temp);
    // Here would be a good place to recalculate dot_length, based on actual short/long intervals in dots_array
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
        
    }
//  node.warn('Processed text: '+text)
    text = text.replace(/\u2009/g, "")
    const smatch = text.match(/([^\.]+)/g)
    const wmatch = text.match(/(\w+)/g)
    const lmatch = text.match(/(\w)/g)
    const dot = dots && dots.length && dots[dots.length - 1]
    const inf = {
        dots:     dots,
        text:     text,
        sentence: smatch && smatch[smatch.length - 1],  // last sentence
        word:     wmatch && wmatch[wmatch.length - 1],
        letter:   lmatch && lmatch[lmatch.length - 1],
        
        state:    dot && dot.state,
        token:    dot && dot.token,
        time:     dot && dot.time,
    };    
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
        /* --- */
    }
    RED.nodes.registerType('button-morse', ButtonMorseNode);
}
