# Standing rules for this repo

- Commit and push every change directly to the `main` branch. Never open a pull request or leave work on a separate branch.
- Netlify builds the live app (cabbooks.allblacktaxis.co.uk) automatically from `main`.
- Matt does not commit, push, approve or upload anything, and doesn't keep the app's files on his Mac. Handle all of that yourself.
- Never ask Matt for screenshots.
- Explain things in plain English, one step at a time.
- Group changes into batches rather than going live after every small change, because each Netlify build uses credits.
- Voice dictation often hears "Cab Books" as "CAD Books". They mean the same thing: this app.
- TODO.md is the shared to-do list. Read it at the start, tick off what you finish, add anything new Matt asks for. Before adding an item, check the code and git log so nothing already done is listed.

## Keeping the live app in step with the code (after the 17 Nov 2026 roll-back)

- Start every session with `git pull` on `main`, and pull again right before you push. Never work from an old copy.
- Never force-push `main`, never reset it to an older commit, and never revert someone else's work to "tidy up".
- The live app is only ever published by Netlify building `main`. Never use Netlify drag-and-drop, the Netlify CLI, "Publish deploy" on an older build, a rollback, or "Stop auto publishing".
- If Matt asks to wait before going live, keep the work on the `claude/...` branch for this session and move it onto `main` only when he says "deploy". Don't leave it unpushed.
- The `ignore` line in `netlify.toml` skips a build only when nothing but `.md` files changed. Don't loosen it.
- After going live, check the version: Settings shows "Version <commit>" at the bottom, and the Admin card says whether the live app matches the newest code on GitHub. If it says the live app is older, tell Matt the exact Netlify steps it shows.
