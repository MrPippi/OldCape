import { MAX_BACKOFF_MS, connectChat } from "./chat-socket";
import type { ChatEvent, ConnState } from "./chat-socket";

class FakeSocket {
  static all: FakeSocket[] = [];
  readyState = 0;
  sent: string[] = [];
  closedByClient = false;
  private listeners = new Map<string, Array<(e: unknown) => void>>();
  constructor(readonly url: string) {
    FakeSocket.all.push(this);
  }
  addEventListener(type: string, fn: (e: unknown) => void) {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  send(data: string) {
    this.sent.push(data);
  }
  close() {
    this.closedByClient = true;
    this.readyState = 3;
    this.emit("close", { code: 1000 });
  }
  emit(type: string, e: unknown = {}) {
    for (const fn of this.listeners.get(type) ?? []) fn(e);
  }
  open() {
    this.readyState = 1;
    this.emit("open");
  }
  drop() {
    this.readyState = 3;
    this.emit("close", { code: 1006 });
  }
  receive(event: unknown) {
    this.emit("message", { data: typeof event === "string" ? event : JSON.stringify(event) });
  }
}
const last = () => FakeSocket.all.at(-1)!;

function setup(url = () => "wss://x/api/chat") {
  const events: ChatEvent[] = [];
  const states: ConnState[] = [];
  const socket = connectChat({
    url,
    WebSocketImpl: FakeSocket as unknown as typeof WebSocket,
    onEvent: (e) => events.push(e),
    onState: (s) => states.push(s),
  });
  return { socket, events, states };
}

beforeEach(() => {
  FakeSocket.all = [];
  vi.useFakeTimers();
});
afterEach(() => vi.useRealTimers());

describe("connectChat", () => {
  it("connects, reports state and passes valid events through", () => {
    const { events, states } = setup();
    expect(states).toEqual(["connecting"]);
    last().open();
    expect(states).toEqual(["connecting", "open"]);
    last().receive({ type: "online", count: 3 });
    last().receive("not json");
    last().receive({ type: "nonsense" });
    expect(events).toEqual([{ type: "online", count: 3 }]);
  });

  it("sends JSON only while open", () => {
    const { socket } = setup();
    expect(socket.send({ type: "say", nickname: "a", body: "b", nonce: "n" })).toBe(false);
    last().open();
    expect(socket.send({ type: "say", nickname: "a", body: "b", nonce: "n" })).toBe(true);
    expect(JSON.parse(last().sent[0])).toEqual({ type: "say", nickname: "a", body: "b", nonce: "n" });
  });

  it("reconnects after a drop with growing, capped delays, and resets after success", () => {
    const { states } = setup();
    last().open();
    const delays: number[] = [];
    for (let i = 0; i < 6; i++) {
      const before = FakeSocket.all.length;
      last().drop();
      let waited = 0;
      while (FakeSocket.all.length === before) {
        vi.advanceTimersByTime(100);
        waited += 100;
      }
      delays.push(waited);
    }
    expect(states).toContain("reconnecting");
    expect(delays[1]).toBeGreaterThan(delays[0]);
    expect(Math.max(...delays)).toBeLessThanOrEqual(MAX_BACKOFF_MS);
    last().open();
    last().drop();
    vi.advanceTimersByTime(delays[0]);
    expect(FakeSocket.all.length).toBe(8);
  });

  it("close() stops for good", () => {
    const { socket } = setup();
    last().open();
    socket.close();
    vi.advanceTimersByTime(MAX_BACKOFF_MS * 2);
    expect(FakeSocket.all).toHaveLength(1);
  });
});

describe("reconnect()", () => {
  it("opens the new URL immediately and ignores the old socket's close", () => {
    let query = "";
    const { socket, states } = setup(() => `wss://x/api/chat${query}`);
    last().open();
    query = "?session=abc";
    socket.reconnect();
    expect(FakeSocket.all).toHaveLength(2);
    expect(FakeSocket.all[0].closedByClient).toBe(true);
    expect(last().url).toBe("wss://x/api/chat?session=abc");
    vi.advanceTimersByTime(MAX_BACKOFF_MS);
    expect(FakeSocket.all).toHaveLength(2);
    expect(states.at(-1)).toBe("connecting");
  });
});
