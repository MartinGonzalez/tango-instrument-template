import {
  defineBackend,
  type InstrumentBackendContext,
} from "tango-api/backend";

async function onStart(ctx: InstrumentBackendContext): Promise<void> {
  ctx.logger.info("Backend started");
}

async function onStop(): Promise<void> {
  // Clean up resources here
}

export default defineBackend({
  kind: "tango.instrument.backend.v2",
  onStart,
  onStop,
  actions: {
    hello: {
      input: {
        type: "object",
        properties: {
          name: { type: "string" },
        },
      },
      output: {
        type: "object",
        properties: {
          greeting: { type: "string" },
        },
        required: ["greeting"],
      },
      handler: async (
        _ctx: InstrumentBackendContext,
        input?: { name?: string },
      ) => {
        return { greeting: `Hello, ${input?.name ?? "world"}!` };
      },
    },
  },
});
