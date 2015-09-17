/// <reference path="api.d.ts" />
/// <reference path="typings/emscripten.d.ts" />
declare function _de265_init(): number;
declare function _de265_free(): number;
declare function _en265_new_encoder(): number;
declare function _en265_start_encoder(ctx: number, threads: number): number;
declare function _en265_push_image(ctx: number, img: number): number;
declare function _en265_push_eof(ctx: number): number;
declare function _en265_encode(ctx: number): number;
declare function _en265_get_packet(ctx: number, timeout: number): number;
declare function _en265_free_packet(ctx: number, packet: number): void;
declare function _en265_free_encoder(ctx: number): number;
declare function _libde265_image_allocate(ctx: number, w: number, h: number): number;
declare function _libde265_image_get_plane(img: number, idx: number): number;
declare function _libde265_image_get_stride(img: number, idx: number): number;
declare function _libde265_encoder_hack(ctx: number, w: number, h: number): void;

class libde265Encoder {
    worker: Worker;
    ctx: number;
    width: number;
    height: number;

    constructor(worker: Worker) {
        this.worker = worker;
        this.worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data);
        };
    }

    _setup(cfg: VideoInfo) {
        this.width = cfg.width;
        this.height = cfg.height;
        if (_de265_init() != 0) {
            this.worker.postMessage(<IResult>{status: -1});
            return;
        }
        this.ctx = _en265_new_encoder();
        if (this.ctx == 0) {
            this.worker.postMessage(<IResult>{status: -1});
            return;
        }
        _libde265_encoder_hack(this.ctx, this.width, this.height);
        if (_en265_start_encoder(this.ctx, 0) != 0) {
            this.worker.postMessage(<IResult>{status: -1});
            return;
        }
        this.worker.onmessage = (e: MessageEvent) => {
            this._encode(e.data);
        };
        this.worker.postMessage(<Packet&IResult>{status: 0, data: null});
    }

    _encode(frame: VideoFrame) {
        var [img, img_y, img_u, img_v] = this._alloc_image();
        img_y.set(new Uint8Array(frame.y.buffer, frame.y.byteOffset, frame.y.byteLength));
        img_u.set(new Uint8Array(frame.u.buffer, frame.u.byteOffset, frame.u.byteLength));
        img_v.set(new Uint8Array(frame.v.buffer, frame.v.byteOffset, frame.v.byteLength));
        console.log("push_image:", _en265_push_image(this.ctx, img));
        console.log("encode:", _en265_encode(this.ctx));
        while (1) {
            var pkt = _en265_get_packet(this.ctx, 0);
            if (pkt == 0)
                break;
            console.log("get_packet:", pkt);
            _en265_free_packet(this.ctx, pkt);
        }
        this.worker.postMessage(<Packet&IResult>{
            status: 0,
            data: null,
        });
    }

    _alloc_image(): [number, Uint8Array, Uint8Array, Uint8Array] {
        var img = _libde265_image_allocate(this.ctx, this.width, this.height);
        var img_y_ptr = _libde265_image_get_plane(img, 0);
        var img_u_ptr = _libde265_image_get_plane(img, 1);
        var img_v_ptr = _libde265_image_get_plane(img, 2);
        var img_y_stride = _libde265_image_get_stride(img, 0);
        var img_u_stride = _libde265_image_get_stride(img, 1);
        var img_v_stride = _libde265_image_get_stride(img, 2);
        var img_y = Module.HEAPU8.subarray(img_y_ptr, img_y_ptr + img_y_stride * this.height);
        var img_u = Module.HEAPU8.subarray(img_u_ptr, img_u_ptr + img_u_stride * this.height / 2);
        var img_v = Module.HEAPU8.subarray(img_v_ptr, img_v_ptr + img_v_stride * this.height / 2);
        return [img, img_y, img_u, img_v];
    }
}
new libde265Encoder(this);
