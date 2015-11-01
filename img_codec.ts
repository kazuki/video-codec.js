/// <reference path="api.ts" />
/// <reference path="typings/Canvas.d.ts" />

class MotionImageEncoder implements IEncoder {
    static MIME = ['image/png', 'image/jpeg', 'image/webp'];
    _canvas: HTMLCanvasElement;
    _context: CanvasRenderingContext2D;
    _data: ImageData;
    _type: string;
    _options: number;

    constructor() {
        this._canvas = <HTMLCanvasElement>document.createElement('canvas');
    }

    setup(cfg: EncoderConfig): Promise<Packet> {
        this._canvas.width = cfg.width;
        this._canvas.height = cfg.height;
        this._context = this._canvas.getContext('2d');
        this._data = this._context.createImageData(cfg.width, cfg.height);

        var opt = cfg.params;
        this._type = opt.type || "image/png";
        this._options = 1.0;
        if (opt.quality != undefined)
            this._options = opt.quality;
        return new Promise<Packet>((resolve, reject) => {
            if (MotionImageEncoder.MIME.indexOf(this._type) < 0) {
                reject({status: -1, reason: 'unknown type'});
                return;
            }
            var header = new Uint32Array(3);
            header[0] = MotionImageEncoder.MIME.indexOf(this._type);
            header[1] = cfg.width;
            header[2] = cfg.height;
            resolve({
                data: header.buffer,
                frame_type: FrameType.Unknown
            });
        });
    }

    encode(frame: VideoFrame): Promise<Packet> {
        return new Promise<Packet>((resolve, reject) => {
            this._convert(frame, this._data.width, this._data.height, this._data.data);
            this._context.putImageData(this._data, 0, 0);
            if (this._canvas.toBlob) {
                this._canvas.toBlob((blob: Blob) => {
                    var reader = new FileReader();
                    reader.onload = () => {
                        resolve({
                            data: reader.result,
                            frame_type: FrameType.Key
                        });
                    };
                    reader.readAsArrayBuffer(blob);
                }, this._type, this._options);
            } else {
                var data_url = this._canvas.toDataURL(this._type, this._options);
                var raw = atob(data_url.split(',')[1]);
                var buf = new Uint8Array(raw.length);
                for (var i = 0; i < raw.length; ++i)
                    buf[i] = raw.charCodeAt(i);
                var blob = new Blob([buf.buffer], {type: this._type});
                var reader = new FileReader();
                reader.onload = () => {
                    resolve({
                        data: reader.result,
                        frame_type: FrameType.Key
                    });
                };
                reader.readAsArrayBuffer(blob);
            }
        });
    }

    _convert(frame: VideoFrame, width: number, height: number, rgba: Array<number>) {
        for (var y = 0; y < height; y += 2) {
            var p0 = y * width;
            var p1 = p0 + width;
            for (var x = 0; x < width; x += 2) {
                var y0 = 1.164 * (frame.y[p0 + x] - 16);
                var y1 = 1.164 * (frame.y[p0 + x + 1] - 16);
                var y2 = 1.164 * (frame.y[p1 + x] - 16);
                var y3 = 1.164 * (frame.y[p1 + x + 1] - 16);
                var u = frame.u[p0 / 4 + x / 2], v = frame.v[p0 / 4 + x / 2];
                var t0 = 1.596 * (v - 128);
                var t1 = - 0.391 * (u - 128) - 0.813 * (v - 128);
                var t2 = 2.018 * (u - 128);
                rgba[(p0 + x) * 4    ] = y0 + t0;
                rgba[(p0 + x) * 4 + 1] = y0 + t1;
                rgba[(p0 + x) * 4 + 2] = y0 + t2;
                rgba[(p0 + x) * 4 + 3] = 255;
                rgba[(p0 + x) * 4 + 4] = y1 + t0;
                rgba[(p0 + x) * 4 + 5] = y1 + t1;
                rgba[(p0 + x) * 4 + 6] = y1 + t2;
                rgba[(p0 + x) * 4 + 7] = 255;
                rgba[(p1 + x) * 4    ] = y2 + t0;
                rgba[(p1 + x) * 4 + 1] = y2 + t1;
                rgba[(p1 + x) * 4 + 2] = y2 + t2;
                rgba[(p1 + x) * 4 + 3] = 255;
                rgba[(p1 + x) * 4 + 4] = y3 + t0;
                rgba[(p1 + x) * 4 + 5] = y3 + t1;
                rgba[(p1 + x) * 4 + 6] = y3 + t2;
                rgba[(p1 + x) * 4 + 7] = 255;
            }
        }
    }
}

class MotionImageDecoder implements IDecoder {
    _canvas: HTMLCanvasElement;
    _context: CanvasRenderingContext2D;
    _img: HTMLImageElement;
    _mime: string;
    _w: number;
    _h: number;
    _buf: ArrayBuffer = null;
    _y: Uint8ClampedArray;
    _u: Uint8ClampedArray;
    _v: Uint8ClampedArray;

    constructor() {
        this._canvas = <HTMLCanvasElement>document.createElement('canvas');
        this._img = <HTMLImageElement>document.createElement('img');
    }

    setup(cfg: any, packet: Packet): Promise<any> {
        return new Promise<any>((resolve, reject) => {
            if (packet && packet.data && packet.data.byteLength == 12) {
                var header = new Uint32Array(packet.data);
                this._mime = MotionImageEncoder.MIME[header[0]];
                this._w = header[1];
                this._h = header[2];
            } else {
                reject({status: -1, reason: 'invalid header packet'});
                return;
            }
            this._canvas.width = this._w;
            this._canvas.height = this._h;
            this._img.width = this._w;
            this._img.height = this._h;
            this._buf = new ArrayBuffer(this._w * this._h * 1.5);
            this._y = new Uint8ClampedArray(this._buf, 0, this._w * this._h);
            this._u = new Uint8ClampedArray(this._buf, this._w * this._h, this._w * this._h / 4);
            this._v = new Uint8ClampedArray(this._buf, this._w * this._h * 1.25, this._w * this._h / 4);
            this._context = this._canvas.getContext('2d');
            resolve();
        });
    }

    decode(packet: Packet): Promise<VideoFrame> {
        return new Promise<VideoFrame>((resolve, reject) => {
            var blob = new Blob([packet.data], {'type': this._mime});
            this._img.onload = () => {
                this._context.drawImage(this._img, 0, 0);
                this._convert(this._context.getImageData(0, 0, this._w, this._h));
                resolve({
                    timestamp: 0,
                    width: this._w,
                    height: this._h,
                    data: this._buf,
                    y: this._y,
                    u: this._u,
                    v: this._v,
                    transferable: false,
                });
            };
            this._img.src = URL.createObjectURL(blob);
        });
    }

    _convert(img: ImageData) {
        var rgba = img.data;
        for (var y = 0, j = 0; y < img.height; y += 2) {
            var p = y * img.width;
            for (var x = 0; x < img.width; x += 2, ++j) {
                var pp = p + x
                var pw = pp + img.width;
                var p0 = pp * 4;
                var p1 = pw * 4;
                var r0 = rgba[p0    ], g0 = rgba[p0 + 1], b0 = rgba[p0 + 2];
                var r1 = rgba[p0 + 4], g1 = rgba[p0 + 5], b1 = rgba[p0 + 6];
                var r2 = rgba[p1    ], g2 = rgba[p1 + 1], b2 = rgba[p1 + 2];
                var r3 = rgba[p1 + 4], g3 = rgba[p1 + 5], b3 = rgba[p1 + 6];
                this._y[pp    ] = Math.floor(0.257 * r0 + 0.504 * g0 + 0.098 * b0 + 16);
                this._y[pp + 1] = Math.floor(0.257 * r1 + 0.504 * g1 + 0.098 * b1 + 16);
                this._y[pw    ] = Math.floor(0.257 * r2 + 0.504 * g2 + 0.098 * b2 + 16);
                this._y[pw + 1] = Math.floor(0.257 * r3 + 0.504 * g3 + 0.098 * b3 + 16);
                this._u[j] = Math.floor(-0.148 * r0 - 0.291 * g0 + 0.439 * b0 + 128);
                this._v[j] = Math.floor( 0.439 * r1 - 0.368 * g1 - 0.071 * b1 + 128);
            }
        }
    }
}
