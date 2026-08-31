// Hardcoded behavioral rule: never assert confidence in unverified
// assumptions. Injected directly into the system prompt on EVERY prompt
// build via experimental.chat.system.transform, so the harness loads it
// structurally every turn (stronger than an advisory markdown file).
// This is a prompt-level enforcement of a reasoning rule; it is the
// strongest mechanism opencode provides short of deterministic tool
// permissions (which cannot express reasoning constraints).
export default async function hardenedRulesPlugin() {
  return {
    'experimental.chat.system.transform': async (input, output) => {
      output.system.push(
        `[HARD RULE - Ground truth over assumption. Treat this as binding:\n` +
        `1. Never state confidence in an assumption you have not verified. Do not say\n` +
        `   "I know", "it is", "you should", "the answer is", "this is the case", or\n` +
        `   otherwise assert something as factual unless you can back it with observed\n` +
        `   evidence from THIS session: tool output, file contents, command exit codes,\n` +
        `   or documented environment facts you directly confirmed.\n` +
        `2. If a claim depends on an unverified assumption (e.g. which environment a\n` +
        `   command runs in, what a variable holds, where a process launches), VERIFY it\n` +
        `   first with a command/read before stating it. When you cannot verify, say\n` +
        `   explicitly that you are uncertain, and what you checked or could not check.\n` +
        `3. Prefer the phrase "I have not verified X" over a confident but wrong\n` +
        `   assertion. Stating uncertainty is correct behavior, not a weakness.\n` +
        `4. If the user's direct observation contradicts your earlier claim, cede to the\n` +
        `   observation immediately and update your model; do not re-assert the old claim.\n` +
        `5. Generalize nothing from a single environment (e.g. Termux vs proot) to another\n` +
        `   without confirming which environment the subject actually runs in.]`
      )
    },
  }
}
