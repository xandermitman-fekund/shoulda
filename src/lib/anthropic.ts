import Anthropic from "@anthropic-ai/sdk";

// Reads ANTHROPIC_API_KEY from the environment (.env, loaded by Next.js).
export const anthropic = new Anthropic();

// The AI Mediator model. Defaults to Opus 4.8 for the highest-quality, most
// emotionally-intelligent facilitation. Set MEDIATOR_MODEL=claude-sonnet-4-6
// in .env to trade some quality for lower cost / faster responses while testing.
export const MEDIATOR_MODEL = process.env.MEDIATOR_MODEL ?? "claude-opus-4-8";
