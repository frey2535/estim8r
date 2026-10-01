import DOMMatrix from "@thednp/dommatrix";
globalThis.DOMMatrix = DOMMatrix;
if (!globalThis.ImageData) {
  globalThis.ImageData = class ImageData {
    constructor(dataOrWidth, widthOrHeight, height) {
      if (typeof dataOrWidth === "number") {
        this.width = dataOrWidth;
        this.height = widthOrHeight;
        this.data = new Uint8ClampedArray(this.width * this.height * 4);
      } else {
        this.data = dataOrWidth;
        this.width = widthOrHeight;
        this.height = height ?? Math.floor(dataOrWidth.length / 4 / widthOrHeight);
      }
    }
  };
}
if (!globalThis.Path2D) globalThis.Path2D = class Path2D {};
