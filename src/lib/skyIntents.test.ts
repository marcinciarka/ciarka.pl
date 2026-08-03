import { beforeEach, describe, expect, it, vi } from "vitest";

describe("skyIntents", () => {
  beforeEach(() => {
    vi.resetModules(); // fresh module-level state per test
  });

  describe("new-aurora intent", () => {
    it("notifies subscribers with a new-aurora intent", async () => {
      const { requestNewAurora, subscribeIntent } = await import(
        "./skyIntents"
      );
      const listener = vi.fn();
      subscribeIntent(listener);
      requestNewAurora();
      expect(listener).toHaveBeenCalledWith({ type: "new-aurora" });
    });

    it("stops notifying after unsubscribe", async () => {
      const { requestNewAurora, subscribeIntent } = await import(
        "./skyIntents"
      );
      const listener = vi.fn();
      const unsubscribe = subscribeIntent(listener);
      unsubscribe();
      requestNewAurora();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("gallery intent", () => {
    it("passes the trigger element through", async () => {
      const { requestGallery, subscribeIntent } = await import(
        "./skyIntents"
      );
      const trigger = {} as HTMLElement;
      const listener = vi.fn();
      subscribeIntent(listener);
      requestGallery(trigger);
      expect(listener).toHaveBeenCalledWith({ type: "gallery", trigger });
      // Identity, not just shape - a stray clone would break focus return.
      expect(listener.mock.calls[0][0].trigger).toBe(trigger);
    });

    it("defaults trigger to null when called with no argument", async () => {
      const { requestGallery, subscribeIntent } = await import(
        "./skyIntents"
      );
      const listener = vi.fn();
      subscribeIntent(listener);
      requestGallery();
      expect(listener).toHaveBeenCalledWith({ type: "gallery", trigger: null });
    });

    it("stops notifying after unsubscribe", async () => {
      const { requestGallery, subscribeIntent } = await import(
        "./skyIntents"
      );
      const listener = vi.fn();
      const unsubscribe = subscribeIntent(listener);
      unsubscribe();
      requestGallery();
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("intent replay", () => {
    it("does not replay a past intent to a listener that subscribes later", async () => {
      const { requestNewAurora, subscribeIntent } = await import(
        "./skyIntents"
      );
      requestNewAurora();
      const listener = vi.fn();
      subscribeIntent(listener);
      expect(listener).not.toHaveBeenCalled();
    });
  });

  describe("multiple listeners", () => {
    it("notifies all subscribers, in subscription order", async () => {
      const { requestNewAurora, subscribeIntent } = await import(
        "./skyIntents"
      );
      const order: string[] = [];
      subscribeIntent(() => order.push("first"));
      subscribeIntent(() => order.push("second"));
      requestNewAurora();
      expect(order).toEqual(["first", "second"]);
    });

    it("unsubscribing one listener leaves the others intact", async () => {
      const { requestNewAurora, subscribeIntent } = await import(
        "./skyIntents"
      );
      const a = vi.fn();
      const b = vi.fn();
      const unsubscribeA = subscribeIntent(a);
      subscribeIntent(b);
      unsubscribeA();
      requestNewAurora();
      expect(a).not.toHaveBeenCalled();
      expect(b).toHaveBeenCalledTimes(1);
    });
  });

  describe("busy state", () => {
    it("starts false", async () => {
      const { isBusy } = await import("./skyIntents");
      expect(isBusy()).toBe(false);
    });

    it("setBusy(true) flips the flag and notifies subscribers", async () => {
      const { isBusy, setBusy, subscribeBusy } = await import("./skyIntents");
      const listener = vi.fn();
      subscribeBusy(listener);
      setBusy(true);
      expect(isBusy()).toBe(true);
      expect(listener).toHaveBeenCalledWith(true);
    });

    it("does not notify when set to the value it already has", async () => {
      const { setBusy, subscribeBusy } = await import("./skyIntents");
      const listener = vi.fn();
      subscribeBusy(listener);
      setBusy(false); // already false
      expect(listener).not.toHaveBeenCalled();
      setBusy(true);
      setBusy(true); // already true
      expect(listener).toHaveBeenCalledTimes(1);
    });

    it("stops notifying after unsubscribe", async () => {
      const { setBusy, subscribeBusy } = await import("./skyIntents");
      const listener = vi.fn();
      const unsubscribe = subscribeBusy(listener);
      unsubscribe();
      setBusy(true);
      expect(listener).not.toHaveBeenCalled();
    });

    it("notifies multiple subscribers on a real transition", async () => {
      const { setBusy, subscribeBusy } = await import("./skyIntents");
      const a = vi.fn();
      const b = vi.fn();
      subscribeBusy(a);
      subscribeBusy(b);
      setBusy(true);
      expect(a).toHaveBeenCalledWith(true);
      expect(b).toHaveBeenCalledWith(true);
    });
  });
});
