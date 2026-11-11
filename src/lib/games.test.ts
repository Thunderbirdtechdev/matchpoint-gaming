import { describe, expect, it } from "bun:test";
import { SUPPORTED_GAMES, GAME_LABELS } from "./fees";

describe("supported competition games", () => {
  it("offers Rocket League for challenges and tournaments", () => {
    expect(SUPPORTED_GAMES.includes("rocketleague")).toBe(true);
    expect(GAME_LABELS.rocketleague).toBe("Rocket League");
  });
});