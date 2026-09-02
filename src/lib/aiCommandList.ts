/**
 * The command vocabulary, kept apart from the engine that answers it.
 *
 * `aiCommands.ts` is client-only, so an Edge route cannot import it — and the
 * route needs this list to tell the model what `/help` should reply with. One
 * definition, two consumers.
 */

export interface CommandDef {
  cmd: string;
  args?: string;
  what: string;
}

export const COMMANDS: CommandDef[] = [
  { cmd: "/help", what: "List every command" },
  { cmd: "/explain last loss", what: "Break down your most recent losing trade" },
  { cmd: "/why", args: "<symbol> moved", what: "Real price, headlines and patterns for an instrument" },
  { cmd: "/my best hour", what: "Your best and worst hour, in Dubai time" },
  { cmd: "/my worst pair", what: "The instrument costing you the most" },
  { cmd: "/my revenge", what: "Whether you size up after losing streaks" },
  { cmd: "/pattern radar", args: "<symbol>", what: "Live patterns for one instrument" },
  { cmd: "/community sentiment", args: "<symbol>", what: "Aggregate positioning (illustrative)" },
  { cmd: "/session", what: "What is open now and how you trade it" },
  { cmd: "/clear", what: "Wipe the conversation" },
];
