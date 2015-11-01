/// <reference path="api.ts" />

class Renderer implements IRenderer {
    _canvas: HTMLCanvasElement;
    _context: CanvasRenderingContext2D;
    _img: ImageData;
    
    constructor(canvas: HTMLCanvasElement) {
        this._canvas = canvas;
    }

    init(info: VideoInfo) {
        this._canvas.width = info.width;
        this._canvas.height = info.height;
        this._context = this._canvas.getContext('2d');
        var img = this._img = this._context.createImageData(info.width, info.height);
        var rgba = img.data;
        for (var y = 0; y < img.height; y += 2) {
            var p0 = y * img.width;
            var p1 = p0 + img.width;
            for (var x = 0; x < img.width; x += 2) {
                rgba[(p0 + x) * 4 + 3] =
                    rgba[(p0 + x) * 4 + 7] =
                    rgba[(p1 + x) * 4 + 3] =
                    rgba[(p1 + x) * 4 + 7] = 255;
            }
        }
    }

    draw(frame: VideoFrame) {
        var start = Date.now();
        var img = this._img;
        var rgba = img.data;
        for (var y = 0; y < img.height; y += 2) {
            var p0 = y * img.width;
            var p1 = p0 + img.width;
            var p4 = p0 / 4;
            for (var x = 0; x < img.width; x += 2) {
                var y0 = 1.164 * (frame.y[p0 + x] - 16);
                var y1 = 1.164 * (frame.y[p0 + x + 1] - 16);
                var y2 = 1.164 * (frame.y[p1 + x] - 16);
                var y3 = 1.164 * (frame.y[p1 + x + 1] - 16);
                var u = frame.u[p4 + x / 2], v = frame.v[p4 + x / 2];
                var t0 = 1.596 * (v - 128);
                var t1 = - 0.391 * (u - 128) - 0.813 * (v - 128);
                var t2 = 2.018 * (u - 128);
                var p2 = (p0 + x) * 4;
                var p3 = (p1 + x) * 4;
                rgba[p2    ] = y0 + t0;
                rgba[p2 + 1] = y0 + t1;
                rgba[p2 + 2] = y0 + t2;
                rgba[p2 + 4] = y1 + t0;
                rgba[p2 + 5] = y1 + t1;
                rgba[p2 + 6] = y1 + t2;
                rgba[p3    ] = y2 + t0;
                rgba[p3 + 1] = y2 + t1;
                rgba[p3 + 2] = y2 + t2;
                rgba[p3 + 4] = y3 + t0;
                rgba[p3 + 5] = y3 + t1;
                rgba[p3 + 6] = y3 + t2;
            }
        }
        this._context.putImageData(img, 0, 0);
    }
}
