/// <reference path="api.d.ts" />
/// <reference path="typings/emscripten.d.ts" />

declare function _daala_encode_create(info: number): number;
declare function _daala_encode_ctl(encoder: number, req: number, buf: number, size: number): number;
declare function _daala_info_create(width: number, height: number,
                                    aspect_num: number, aspect_den: number,
                                    timebase_num: number, timebase_den: number): number;
declare function _daala_comment_create(): number;
declare function _daala_encode_flush_header(encoder: number, daala_comment: number, ogg_packet: number): number;
declare function _daala_encode_img_in(encoder: number, img: number, duration: number): number;
declare function _daala_encode_packet_out(encoder: number, last: number, ogg_packet: number): number;
declare function _od_img_create(width: number, height: number): number;

class DaalaEncoder {
    worker: Worker;
    encoder: number;
    op: number;
    img_ptr: number;
    y: Uint8Array;
    u: Uint8Array;
    v: Uint8Array;

    constructor(worker: Worker) {
        this.worker = worker;
        this.worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data);
        };
    }

    _setup(cfg: any) {
        this.worker.onmessage = () => {};
        this.op = Module._malloc(4 * 8);

        if (!cfg.fps_num || !cfg.fps_den) {
            cfg.fps_num = 30;
            cfg.fps_den = 1;
        }
        var di = _daala_info_create(cfg.width, cfg.height, 1, 1,
                                    cfg.fps_num, cfg.fps_den);
        var dc = _daala_comment_create();
        this.img_ptr = _od_img_create(cfg.width, cfg.height);
        this.y = Module.HEAPU8.subarray(Module.getValue(this.img_ptr, 'i32'),
                                        Module.getValue(this.img_ptr, 'i32') + cfg.width * cfg.height);
        this.u = Module.HEAPU8.subarray(Module.getValue(this.img_ptr + 4 * 4, 'i32'),
                                        Module.getValue(this.img_ptr + 4 * 4, 'i32') + cfg.width * cfg.height / 4);
        this.v = Module.HEAPU8.subarray(Module.getValue(this.img_ptr + 4 * 8, 'i32'),
                                        Module.getValue(this.img_ptr + 4 * 8, 'i32') + cfg.width * cfg.height / 4);
        this.encoder = _daala_encode_create(di);
        if (this.encoder == 0) {
            this.worker.postMessage({status: -1});
            return;
        }
        var value = Module._malloc(4);
        Module.setValue(value, 1, 'i32');
        _daala_encode_ctl(this.encoder, 4002/*OD_SET_COMPLEXITY*/, value, 4);
        Module.setValue(value, 10, 'i32');
        _daala_encode_ctl(this.encoder, 4000/*OD_SET_QUANT*/, value, 4);
        Module._free(value);

        var packets = [];
        var bytes = 0;
        if (_daala_encode_flush_header(this.encoder, dc, this.op) <= 0) {
            this.worker.postMessage({status: -1});
            return;
        }
        packets.push(this._ogg_packet_to_arraybuffer(this.op));
        bytes += packets[0].byteLength;
        while (1) {
            var ret = _daala_encode_flush_header(this.encoder, dc, this.op);
            if (ret == 0)
                break;
            if (ret < 0) {
                this.worker.postMessage({status: -1});
                return;
            }
            packets.push(this._ogg_packet_to_arraybuffer(this.op));
            bytes += packets[packets.length - 1].byteLength;
        }
        this.worker.onmessage = (e: MessageEvent) => {
            this._encode(e.data);
        };
        var data = new ArrayBuffer(4 * (1 + packets.length) + bytes);
        var view32 = new Uint32Array(data, 0, 1 + packets.length);
        var view8 = new Uint8Array(data, (1 + packets.length) * 4);
        view32[0] = packets.length;
        for (var i = 0, off=0; i < packets.length; ++i) {
            view32[i + 1] = packets[i].byteLength;
            view8.set(new Uint8Array(packets[i]), off);
            off += packets[i].byteLength;
        }
        this.worker.postMessage({
            status: 0,
            data: data
        }, [data]);
    }

    _encode(frame: VideoFrame) {
        this.y.set(new Uint8Array(frame.y.buffer, frame.y.byteOffset, frame.y.byteLength), 0);
        this.u.set(new Uint8Array(frame.u.buffer, frame.u.byteOffset, frame.u.byteLength), 0);
        this.v.set(new Uint8Array(frame.v.buffer, frame.v.byteOffset, frame.v.byteLength), 0);
        var ret = _daala_encode_img_in(this.encoder, this.img_ptr, 0);
        if (ret != 0) {
            this.worker.postMessage({status: -1});
            return;
        }
        var ret = _daala_encode_packet_out(this.encoder, 0, this.op);
        if (ret < 0) {
            this.worker.postMessage({status: -1});
            return;
        }
        if (ret > 0) {
            var pkt = this._ogg_packet_to_arraybuffer(this.op);
            if (_daala_encode_packet_out(this.encoder, 0, this.op) != 0) {
                // not supported
                this.worker.postMessage({status: -2});
                return;
            }
            this.worker.postMessage({
                status: 0,
                data: pkt
            }, [pkt]);
        } else {
            // このルートを通る可能性ってある？
            this.worker.postMessage({status: 0});
        }
    }

    _ogg_packet_to_arraybuffer(op: number): ArrayBuffer {
        var ptr = <number>Module.getValue(op, 'i32');
        var bytes = <number>Module.getValue(op + 4, 'i32');
        var b_o_s = <number>Module.getValue(op + 8, 'i32');
        var e_o_s = <number>Module.getValue(op + 12, 'i32');
        var buf = new ArrayBuffer(bytes + 1/*flags*/ + 8/*granulepos*/ + 8/*packetno*/);
        var view = new Uint8Array(buf);
        view.set(Module.HEAPU8.subarray(ptr, ptr + bytes), 0);
        view[bytes] = (b_o_s ? 1 : 0) | ((e_o_s ? 1 : 0) << 1);
        view.set(Module.HEAPU8.subarray(op + 16, op + 32), bytes + 1);
        return buf;
    }
}
new DaalaEncoder(this);
