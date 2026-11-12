# node-red-contrib-button-morse

A Node-RED node that times button presses and decodes them as Morse code (dots, letter, word, sentence, text).
Long presses can also be used as actions (e.g. reboot or shutdown on a Raspberry Pi).

## Install

From your Node-RED user directory (usually `~/.node-red`):

```sh
npm install node-red-contrib-button-morse
```

Requires Node-RED 3.0 or newer and Node.js 18 or newer.

## Input

`msg.payload`: `0` = button down, `1` = button up (pull-up wiring). `true`/`false` and `"0"`/`"1"` also work.
Tick **Invert** if your button reports down as `1`.

Debounce the input before it reaches this node. Repeated identical states are ignored.

## Configuration

| Setting  | Default | Meaning |
|----------|---------|---------|
| Dot length | 333 ms | Base timing unit. A press longer than 1.5 dots is a dash. A pause of 3 dots ends a letter, 7 ends a word, 12 ends a sentence, 50 clears the history. |
| Progress | on | Send `progress_*` / `*_end` messages as timers pass. |
| Invert | off | Treat `1` as down and `0` as up. |
| Feedback | off | *Play back each letter* and/or *Blink when a long-press step is reached*, as `1`/`0` on an extra output. |
| Long press | hold 3 s, todo 7 s, quiet 10 s, reboot 12.5 s, shutdown 15 s, nop 20 s | Your own list of long-press steps (seconds + name). |
| Outputs | off | One extra output per long-press step, carrying its `action_<name>` message. |

### Personalizing long presses

Open the node and edit the **Long press** list: each step has a time in seconds and a name.
While the button is held, each step sends `progress_<name>` as it is reached. When the button is
released, `action_<name>` is sent for the last step reached. Names are turned into topics by
lower-casing and replacing other characters with `_`, so `Wi-Fi` becomes `action_wi_fi`.
The dialog shows the topic next to each step.

- Tick **Outputs** to get one output per step, and wire e.g. *reboot* straight to an Exec node.
- Tick **Blink when a long-press step is reached** so the user can count blinks to know when to release.
- Make the last step harmless (e.g. `cancel`) so that holding longer cancels.
- **Defaults** restores the built-in list.

### Feedback output

With a Feedback option ticked, output 2 sends `msg.payload` `1`/`0`. Wire it to a GPIO output with an LED
or buzzer. Each letter you key is played back after the letter pause, and each long-press step
gives a short blink. Feedback stops as soon as the button is pressed again.

## Output messages

Output 1 carries all events, and `msg.topic` tells you what happened:

1. **Button pressed/released**: `button_down`, `button_up`.
2. **While the button is held**, a progress message is sent each time a new timer is reached:
   `progress_short_press`, `progress_long_press`, then `progress_<name>` for each long-press step
   (by default `progress_hold` (3 s), `progress_todo` (7 s), `progress_quiet` (10 s),
   `progress_reboot` (12.5 s), `progress_shutdown` (15 s), `progress_nop` (20 s)).
3. **When the button is released**, the last reached timer is sent as an action:
   `action_short_press`, `action_long_press` or `action_<name>` (e.g. `action_reboot`).
4. **While the button is released**, progress messages are sent as pauses pass:
   `letter_end`, `word_end`, `sentence_end`, `clear_history`.
5. **On the next press**, the finished pause is sent as an action:
   `action_no_space`, `action_end_of_letter`, `action_end_of_word`, `action_end_of_sentence`, `action_clear_history`.

Example message:

```json
{
  "topic": "sentence_end",
  "payload": {
    "dots": "... ___ ...",
    "text": "sos",
    "sentence": "sos",
    "word": "sos",
    "letter": "s",
    "history": [],
    "state": "up",
    "token": "   ",
    "time": 3996
  }
}
```

In `dots`, letters are separated by a thin space (` `) and words by a normal space.
`history` holds the text of earlier sentences until `clear_history`.
Eight dots (`........`) erase the previous word.

## Using the output

Send the output to a **Switch** node on `msg.topic`, for example:

1. `action_reboot` → Exec `sudo shutdown -r now`
2. `action_shutdown` → Exec `sudo shutdown -h now`
3. `sentence_end` → another Switch on `msg.payload.sentence` to react to specific words

## Trying it without a Raspberry Pi

The node only reads `msg.payload`, so it runs on any Node-RED install.
Import **Menu → Import → Examples → node-red-contrib-button-morse → button-morse-test**.
It has two Inject nodes, *down* and *up*: click *down* then *up* for one button press.
Dot length is set to 1000 ms so you can click comfortably. The decoded text is shown in the
Debug sidebar and under the Debug nodes.

On a Raspberry Pi, replace the two Inject nodes with a GPIO input node.

## Examples

Import them from **Menu → Import → Examples → node-red-contrib-button-morse**:

| Example | Shows |
|---------|-------|
| `button-morse-test` | Try the node on any computer: click Inject nodes *down* / *up* as the button. |
| `raspberry-pi-gpio` | A real button on GPIO17 (physical pin 11) with the internal pull-up and debounce, and a feedback LED on GPIO18 (pin 12). |
| `long-press-actions` | Personal long-press steps (quiet / reboot / shutdown / cancel), one output each, a blink per step. The Exec nodes only `echo` until you change them. |
| `morse-commands` | Spell `on`, `off` or `sos` to switch an LED or send an alert, with letter playback on output 2. |

## Upgrading from 1.x

- The node now works as a real Node-RED node; 1.x was a Function-node body and did not run.
- No custom `contextStorage` setup is needed any more.
- Dot length is set in the node's edit dialog (`dotLength`), not in context.
- Words in `text` are now separated by spaces, and `payload.history` was added.
- Long-press steps are configurable. Default topics are lower-case as before (`action_quiet`, ...).
  A long press now shows as `~` in `dots` and ends the current letter.

## Development

```sh
npm install
npm test
```

## License

ISC. Created by Erik Johansen, 2021.
