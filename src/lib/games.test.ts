import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { SUPPORTED_GAMES, GAME_LABELS } from "./fees";

describe("supported competition games", () => {
  it("offers Rocket League for challenges and tournaments", () => {
    assert.equal(SUPPORTED_GAMES.includes("rocketleague"), true);
    assert.equal(GAME_LABELS.rocketleague, "Rocket League");
  });
});