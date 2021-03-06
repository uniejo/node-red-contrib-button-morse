# node-red-contrib-button-morse
### Read button presses. Convert Morse code into text (dots, letter, word, text, sentence)

#### Takes input from a button
Default assumption: down = 0, up = 1 (aka pull up)


#### Sends the following messages:

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

#### The message/payload may look like this:
```json
{
  "topic": "sentence_end",
  "payload": {
    "dots": "...  ___  ...",
    "text": "sos",
    "sentence": "sos",
    "word": "sos",
    "letter": "s"
  }
}
```

#### Note: You may see the following warnings in the debug log:  
-  "Unknown context store 'objects' specified. Using default store."
-  "Context ... contains circular referece that cannot be persisted"

  The warnings have no effect on the functionality, but you may want to
  update your .node-red/settings.js to have a contextStorage like this:
  ```json
  {
     "contextStorage": {
         "default": { "module": "localfilesystem" },
         "memory":  { "module": "memory" },
         "objects": { "module": "localfilesystem", "config": { "cache": true, "flushInterval": 28800 } }
     }
  }
   ```
#### Passing output on to another node
Only one output line, but a lot of different messages.

I usually pass output on to a Switch, that looks at msg.topic. f.ex.
1) If topic contains 'action_reboot' -> Exec sudo shutdown -r now
2) If topic contains 'action_shutdown' -> Exec sudo shutdown -h now
3) If topic contains 'sentence_end' -> Switch that looks at msg.payload.sentence to find different sentences that it should react to
   
Created by: Erik Johansen, 2021-12-12

