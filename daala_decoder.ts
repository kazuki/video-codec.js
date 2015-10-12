/// <reference path="api.ts" />
/// <reference path="typings/emscripten.d.ts" />

declare function _daala_info_create(width: number, height: number,
                                    aspect_num: number, aspect_den: number,
                                    timebase_num: number, timebase_den: number,
                                    keyframe_rate: number): number;
declare function _daala_comment_create(): number;
declare function _daala_decode_header_in(di: number, dc: number, ds: number, op: number): number;
declare function _daala_decode_alloc(di: number, ds: number): number;
declare function _daala_decode_packet_in(decoder: number, img: number, op: number): number;
declare function _daala_setup_free(ds: number): void;
declare function _od_img_create(width: number, height: number): number;

class DaalaDecoder {
    worker: Worker;
    decoder: number;
    op: number;
    op_data_ptr: number;
    op_data: Uint8Array;
    img: number;

    constructor(worker: Worker) {
        this.worker = worker;
        this.worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data.packet);
        };
        this.op = Module._malloc(4 * 8);
        this._check_op_data_size(1024 * 16);
        this.img = _od_img_create(0, 0);
    }

    _setup(packet: Packet) {
        var di = _daala_info_create(0, 0, 0, 0, 0, 0, 0);
        var dc = _daala_comment_create();
        var ds = Module._malloc(4);
        Module.setValue(ds, 0, 'i32');

        var view32 = new Uint32Array(packet.data, 0, packet.data.byteLength / 4);
        var view8 = new Uint8Array(packet.data, 4 * (1 + view32[0]));
        var header_ok = false;
        for (var i = 0, off = 0; i < view32[0]; ++i) {
            var bytes = view32[i + 1];
            this._parse_ogg_packet(view8.subarray(off, off + bytes));
            off += bytes;
            var ret = _daala_decode_header_in(di, dc, ds, this.op);
            if (ret > 0)
                continue
            if (ret == 0)
                header_ok = true;
            break;
        }
        if (!header_ok) {
            this.worker.postMessage(<IResult>{status: -1});
            return;
        }

        this.decoder = _daala_decode_alloc(di, Module.getValue(ds, 'i32'));
        _daala_setup_free(Module.getValue(ds, 'i32'));
        Module._free(ds);
        if (this.decoder == 0) {
            this.worker.postMessage(<IResult>{status: -2});
            return;
        }
        this.worker.onmessage = (e: MessageEvent) => {
            this._decode(e.data.data);
        };
        this.worker.postMessage(<IResult>{status: 0});
    }

    _decode(data: ArrayBuffer) {
        this._parse_ogg_packet(new Uint8Array(data));
        if (_daala_decode_packet_in(this.decoder, this.img, this.op) != 0) {
            this.worker.postMessage(<IResult>{status: -1});
            return;
        }
        var frame = this._od_img_to_video_frame();
        this.worker.postMessage(frame, [frame.data]);
    }

    _od_img_to_video_frame(): VideoFrame&IResult {
        var width = Module.getValue(this.img + 4 * 4 * 4 + 4, 'i32');
        var height = Module.getValue(this.img + 4 * 4 * 4 + 8, 'i32');
        var y_stride = Module.getValue(this.img + 12, 'i32');
        var u_stride = Module.getValue(this.img + 4 * 4 + 12, 'i32');
        var v_stride = Module.getValue(this.img + 4 * 8 + 12, 'i32');
        var y = Module.HEAPU8.subarray(Module.getValue(this.img, 'i32'),
                                       Module.getValue(this.img, 'i32') + height * y_stride);
        var u = Module.HEAPU8.subarray(Module.getValue(this.img + 4 * 4, 'i32'),
                                       Module.getValue(this.img + 4 * 4, 'i32') + height / 2 * u_stride);
        var v = Module.HEAPU8.subarray(Module.getValue(this.img + 4 * 8, 'i32'),
                                       Module.getValue(this.img + 4 * 8, 'i32') + height / 2 * v_stride);
        var out = new ArrayBuffer(width * height * 1.5);
        var out_y = new Uint8Array(out, 0, width * height);
        var out_u = new Uint8Array(out, width * height, width * height / 4);
        var out_v = new Uint8Array(out, width * height * 1.25, width * height / 4);
        for (var i = 0; i < height; ++i) {
            out_y.set(y.subarray(i * y_stride, i * y_stride + width), i * width);
        }
        for (var i = 0; i < height / 2; ++i) {
            out_u.set(u.subarray(i * u_stride, i * u_stride + width / 2), i * width / 2);
            out_v.set(v.subarray(i * v_stride, i * v_stride + width / 2), i * width / 2);
        }
        return {
            status: 0,
            timestamp: 0,
            width: width,
            height: height,
            data: out,
            y: new Uint8ClampedArray(out_y.buffer, out_y.byteOffset, out_y.byteLength),
            u: new Uint8ClampedArray(out_u.buffer, out_u.byteOffset, out_u.byteLength),
            v: new Uint8ClampedArray(out_v.buffer, out_v.byteOffset, out_v.byteLength),
            transferable: true,
        };
    }

    _check_op_data_size(new_size: number) {
        if (!this.op_data || this.op_data.length < new_size) {
            new_size = Math.pow(2, Math.ceil(Math.log(new_size) / Math.log(2)));
            if (this.op_data_ptr)
                Module._free(this.op_data_ptr);
            this.op_data_ptr = Module._malloc(new_size);
            this.op_data = Module.HEAPU8.subarray(this.op_data_ptr,
                                                  this.op_data_ptr + new_size);
            Module.setValue(this.op, this.op_data_ptr, 'i32');
        }
    }

    _parse_ogg_packet(view: Uint8Array) {
        var bytes = view.length - 1/*flags*/ - 8/*granulepos*/ - 8/*packetno*/;
        this._check_op_data_size(bytes);
        this.op_data.set(view.subarray(0, bytes));
        Module.setValue(this.op + 4, bytes, 'i32');
        Module.setValue(this.op + 8, view[bytes] & 1, 'i32');
        Module.setValue(this.op + 12, view[bytes] >>> 1, 'i32');
        Module.HEAPU8.subarray(this.op + 16, this.op + 32).set(view.subarray(bytes + 1));
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
new DaalaDecoder(this);
