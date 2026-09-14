import type { Plugin } from "@opencode-ai/plugin"

export default (async ({ project, client }) => {
  return {
    "chat.params": async (
      input: { model?: { id?: string; providerID?: string }; sessionID?: string; agent?: string },
      output: Record<string, unknown>,
    ) => {
      const m = input.model
      if (m?.providerID === "agentrouter-openai" && m?.id === "gpt-6-astra") {
        const opts = (output.options as Record<string, unknown>) ?? {}
        output.options = {
          ...opts,
          "agentrouter-openai": {
            ...((opts["agentrouter-openai"] as Record<string, unknown>) ?? {}),
            reasoning_effort: "none",
          },
        }
      }
    },
  }
}) satisfies Plugin