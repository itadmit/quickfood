@AGENTS.md

## Session context resets

The watchdog resets this session automatically once its context passes 300k tokens
and it has been idle for two hours, or sooner if a failed image breaks the prompt
cache. You do not need to manage that yourself.

When the user says a task is finished and the context can be reset, run
`~/bin/claude-bot-request-clear.sh` (no argument — it identifies this bot from the
working directory) and tell them it will reset within 5 minutes. Suggest it
unprompted only past roughly 200k context; below that a reset costs more than it
saves.

To report the current context size and whether a reset is worth it, run
`~/bin/claude-bot-status.sh` and relay what it prints.

## Replying on Telegram

Messages arrive wrapped in a `<channel source="plugin:telegram:telegram">` envelope.
Response text you write normally stays in the terminal — the person on Telegram
receives only what you send with the `reply` tool. Answer every channel message
with a `reply` call, including short acknowledgements, clarifying questions, and
"working on it" notes. If you finish a turn without calling `reply`, the person
sees silence and reads it as a hung bot.
