/// <reference path="api.ts" />
/// <reference path="typings/emscripten.d.ts" />

declare function _vpx_codec_vp8_dx(): number;
declare function _vpx_codec_vp9_dx(): number;
declare function _vpx_codec_vp10_dx(): number;
declare function _vpx_codec_dec_init2(ctx: number, iface: number, cfg: number, flags: number): number;
declare function _allocate_vpx_codec_ctx(): number;
declare function _vpx_codec_decode(ctx: number, data: number, data_sz: number, user_priv: number, deadline: number): number;
declare function _vpx_codec_get_frame(ctx: number, iter: number): number;

class VPXDecoder {
    worker: Worker;
    iface: number;
    ctx: number;
    buf_ptr: number;
    buf: Uint8Array;
    iter: number;

    constructor(worker: Worker) {
        this.worker = worker;
        this.worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data.params, e.data.packet);
        };
        this._check_buf_size(1024 * 16);
        this.iter = Module._malloc(4);
    }

    _setup(cfg: any, packet: Packet) {
        if (cfg.version == 10) {
            this.iface = _vpx_codec_vp10_dx();
        } else if (cfg.version == 9) {
            this.iface = _vpx_codec_vp9_dx();
        } else {
            this.iface = _vpx_codec_vp8_dx();
        }

        this.ctx = _allocate_vpx_codec_ctx();
        if (_vpx_codec_dec_init2(this.ctx, this.iface, 0, 0)) {
            this.worker.postMessage(<IResult>{status: -1});
            return;
        }

        this.worker.onmessage = (e: MessageEvent) => {
            this._decode(e.data);
        };
        this.worker.postMessage(<IResult>{status: 0});
    }

    _decode(packet: Packet) {
        this._check_buf_size(packet.data.byteLength);
        this.buf.set(new Uint8Array(packet.data));
        var ret = _vpx_codec_decode(this.ctx, this.buf_ptr, packet.data.byteLength, 0, 0);
        if (ret) {
            this.worker.postMessage(<IResult>{status: -1});
            return;
        }
        Module.setValue(this.iter, 0, 'i32');
        var img = 0;
        var frame = null;
        while ((img = _vpx_codec_get_frame(this.ctx, this.iter)) != 0) {
            frame = this._vpx_img_to_video_frame(img);
        }
        if (frame) {
            this.worker.postMessage(<VideoFrame&IResult>{
                status: 0,
                timestamp: 0,
                width: frame.width,
                height: frame.height,
                data: frame.data,
                y: frame.y,
                u: frame.u,
                v: frame.v,
                transferable: true,
            });
        } else {
            this.worker.postMessage(<VideoFrame&IResult>{
                status: 0, timestamp: null, width: null, height: null,
                data: null, y: null, u: null, v: null
            });
        }
    }

    _vpx_img_to_video_frame(img: number): VideoFrame {
        var w = Module.getValue(img + 4 * 2, 'i32');
        var h = Module.getValue(img + 4 * 3, 'i32');
        var d_w = Module.getValue(img + 4 * 5, 'i32');
        var d_h = Module.getValue(img + 4 * 6, 'i32');
        var in_y = Module.getValue(img + 4 * 9, 'i32');
        var in_u = Module.getValue(img + 4 * 10, 'i32');
        var in_v = Module.getValue(img + 4 * 11, 'i32');
        var stride_y = Module.getValue(img + 4 * 13, 'i32');
        var stride_u = Module.getValue(img + 4 * 14, 'i32');
        var stride_v = Module.getValue(img + 4 * 15, 'i32');
        var buf = new ArrayBuffer(d_w * d_h * 1.5);
        var out_y = new Uint8Array(buf, 0, d_w * d_h);
        var out_u = new Uint8Array(buf, d_w * d_h, d_w * d_h / 4);
        var out_v = new Uint8Array(buf, d_w * d_h * 1.25, d_w * d_h / 4);
        for (var i = 0; i < d_h; ++i) {
            out_y.set(Module.HEAPU8.subarray(in_y + i * stride_y,
                                             in_y + i * stride_y + d_w),
                      i * d_w);
        }
        for (var i = 0; i < d_h / 2; ++i) {
            out_u.set(Module.HEAPU8.subarray(in_u + i * stride_u,
                                             in_u + i * stride_u + d_w / 2),
                      i * d_w / 2);
            out_v.set(Module.HEAPU8.subarray(in_v + i * stride_v,
                                             in_v + i * stride_v + d_w / 2),
                      i * d_w / 2);
        }
        return {
            timestamp: 0,
            width: d_w,
            height: d_h,
            data: buf,
            y: new Uint8ClampedArray(buf, out_y.byteOffset, out_y.byteLength),
            u: new Uint8ClampedArray(buf, out_u.byteOffset, out_u.byteLength),
            v: new Uint8ClampedArray(buf, out_v.byteOffset, out_v.byteLength),
            transferable: true,
        };
    }

    _check_buf_size(new_size: number) {
        if (this.buf && this.buf.byteLength >= new_size)
            return;
        new_size = Math.pow(2, Math.ceil(Math.log(new_size) / Math.log(2)));
        if (this.buf_ptr)
            Module._free(this.buf_ptr);
        this.buf_ptr = Module._malloc(new_size);
        this.buf = Module.HEAPU8.subarray(this.buf_ptr,
                                          this.buf_ptr + new_size);
    }
}
new VPXDecoder(this);
