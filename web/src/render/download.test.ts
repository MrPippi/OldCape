import { fixtureIndex } from "../data/fixture";
import type { CapeEntry } from "../data/types";
import { downloadCape, renderTexture, textureFileName } from "./download";

const idx = fixtureIndex();
const entry: CapeEntry = { id: 4321, colors: 0, blank: false, pos: 9 };

function stubCanvas() {
  const ctx = { imageSmoothingEnabled: true, drawImage: vi.fn() };
  const canvas = {
    width: 0,
    height: 0,
    getContext: vi.fn(() => ctx),
    toBlob: vi.fn((cb: BlobCallback) => cb(new Blob(["png"], { type: "image/png" }))),
  };
  const realCreate = document.createElement.bind(document);
  vi.spyOn(document, "createElement").mockImplementation(((tag: string) =>
    tag === "canvas" ? (canvas as unknown as HTMLCanvasElement) : realCreate(tag)) as typeof document.createElement);
  return { canvas, ctx };
}

afterEach(() => vi.restoreAllMocks());

describe("textureFileName", () => {
  it("names the file after the cape id", () => expect(textureFileName(123)).toBe("oldcape-123.png"));
});

describe("renderTexture", () => {
  it("copies the 22x17 cell onto a transparent 64x32 canvas", async () => {
    const { canvas, ctx } = stubCanvas();
    const img = {} as CanvasImageSource;
    const loadImage = vi.fn(async () => img);
    const blob = await renderTexture(entry, idx, loadImage);
    expect(loadImage).toHaveBeenCalledWith("/data/atlas/atlas-000.png");
    expect([canvas.width, canvas.height]).toEqual([64, 32]);
    expect(ctx.imageSmoothingEnabled).toBe(false);
    expect(ctx.drawImage).toHaveBeenCalledWith(img, 22, 17, 22, 17, 0, 0, 22, 17);
    expect(blob.type).toBe("image/png");
  });

  it("rejects when the canvas cannot encode", async () => {
    const { canvas } = stubCanvas();
    canvas.toBlob.mockImplementation((cb: BlobCallback) => cb(null));
    await expect(renderTexture(entry, idx, async () => ({}) as CanvasImageSource)).rejects.toThrow(
      "download: encode failed",
    );
  });
});

describe("downloadCape", () => {
  it("clicks a temporary link with the cape file name", async () => {
    stubCanvas();
    const clicks: HTMLAnchorElement[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      clicks.push(this);
    });
    URL.createObjectURL = vi.fn(() => "blob:fake");
    URL.revokeObjectURL = vi.fn();
    await downloadCape(entry, idx, async () => ({}) as CanvasImageSource);
    expect(clicks).toHaveLength(1);
    expect(clicks[0].download).toBe("oldcape-4321.png");
    expect(clicks[0].href).toBe("blob:fake");
    expect(clicks[0].isConnected).toBe(false);
  });
});

describe("downloadCape blob lifetime", () => {
  afterEach(() => vi.useRealTimers());

  it("keeps the blob URL alive long enough for iOS Safari's download prompt", async () => {
    stubCanvas();
    let connectedAtClick = false;
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(function (this: HTMLAnchorElement) {
      connectedAtClick = this.isConnected;
    });
    URL.createObjectURL = vi.fn(() => "blob:fake");
    const revoke = vi.fn();
    URL.revokeObjectURL = revoke;
    vi.useFakeTimers();
    await downloadCape(entry, idx, async () => ({}) as CanvasImageSource);
    expect(connectedAtClick).toBe(true);
    vi.advanceTimersByTime(39_000);
    expect(revoke).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1_000);
    expect(revoke).toHaveBeenCalledWith("blob:fake");
  });
});
