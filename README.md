# node-red-contrib-button-morse
### Read button presses. Convert Morse code into text (dots, letter, word, text, sentence)

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

#### The payload may look like this:
```json
{
  "dots": "...  ___  ...",
  "text": "sos",
  "sentence": "sos",
  "word": "sos",
  "letter": "s"
}
```

#### Note: You may see the following warnings in the debug log:  
-  "Unknown context store 'objects' specified. Using default store."
-  "Context ... contains circular referece that cannot be persisted"

  The warnings have no effect on the functionality, but you may want to
  update your .node-red/settings.js to have a contextStorage like this:
  ```json
  {
     contextStorage: {
         default: { module:"localfilesystem" },
         memory: { module:"memory" },
         objects: { module:"localfilesystem", config: { cache: true, flushInterval: 28800 } }
     }
  }
   ```
Created by: Erik Johansen, 2021-12-12

