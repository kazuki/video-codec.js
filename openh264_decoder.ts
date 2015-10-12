/// <reference path="api.ts" />
/// <reference path="typings/emscripten.d.ts" />

declare function _WelsCreateDecoder(ptr: number): number;
declare function _WelsInitializeDecoder(ptr: number): number;
declare function _WelsDecoderDecodeFrame(ptr: number, src: number, srcLen: number,
                                         dst: number, dst_info: number);
declare function _SizeOfSBufferInfo(): number;

class OpenH264Decoder {
    worker: Worker;
    decoder: number;
    
    buf: Uint8Array;
    buf_ptr: number;
    sbi_ptr: number;
    out: Int32Array;
    out_ptr: number;

    MAX_NALU_SIZE = 1024 * 1024;

    constructor(worker: Worker) {
        this.worker = worker;

        var handle = Module._malloc(4);
        var ret = _WelsCreateDecoder(handle);
        this.decoder = <number>Module.getValue(handle, 'i32');
        Module._free(handle);
        if (ret != 0)
            throw 'WelsCreateDecoder failed: ' + ret;
        if (_WelsInitializeDecoder(this.decoder) != 0)
            throw 'WelsInitializeDecoder failed: ' + ret;

        this.buf_ptr = Module._malloc(this.MAX_NALU_SIZE);
        this.buf = Module.HEAPU8.subarray(this.buf_ptr,
                                          this.buf_ptr + this.MAX_NALU_SIZE);
        this.sbi_ptr = Module._malloc(_SizeOfSBufferInfo());
        this.out_ptr = Module._malloc(4 * 3);
        this.out = Module.HEAP32.subarray(this.out_ptr / 4,
                                          this.out_ptr / 4 + 3);
        this.worker.onmessage = (e: MessageEvent) => {
            this._setup();
        };
    }

    _setup() {
        this.worker.onmessage = (e: MessageEvent) => {
            this._decode(e.data.data);
        };
        this.worker.postMessage(<IResult>{status: 0});
    }

    _decode(data: ArrayBuffer) {
        this.buf.set(new Uint8Array(data));
        this.out[0] = this.out[1] = this.out[2] = 0;

        var ret = _WelsDecoderDecodeFrame(this.decoder, this.buf_ptr, data.byteLength,
                                          this.out_ptr, this.sbi_ptr);
        if (ret != 0) {
            this.worker.postMessage(<IResult>{status: ret});
            return;
        }
        var sbi = this._parse_sbuffer_info();
        if (sbi.buffer_status == 0) {
            this.worker.postMessage(<VideoFrame&IResult>{
                status: 0,
                width: 0,
                height: 0,
                data: null,
                y: null,
                u: null,
                v: null,
            });
            return;
        }

        var size = sbi.width * sbi.height;
        var buf = new ArrayBuffer(size * 1.5);
        var in_y = Module.HEAPU8.subarray(this.out[0], this.out[0] + sbi.strides[0] * sbi.height);
        var in_u = Module.HEAPU8.subarray(this.out[1], this.out[1] + sbi.strides[1] * sbi.height / 2);
        var in_v = Module.HEAPU8.subarray(this.out[2], this.out[2] + sbi.strides[1] * sbi.height / 2);
        var out_y = new Uint8Array(buf, 0, size);
        var out_u = new Uint8Array(buf, size, size / 4);
        var out_v = new Uint8Array(buf, size * 1.25, size / 4);
        for (var y = 0; y < sbi.height; ++y) {
            out_y.set(in_y.subarray(y * sbi.strides[0], y * sbi.strides[0] + sbi.width), y * sbi.width);
        }
        for (var y = 0; y < sbi.height / 2; ++y) {
            out_u.set(in_u.subarray(y * sbi.strides[1], y * sbi.strides[1] + sbi.width / 2), y * sbi.width / 2);
            out_v.set(in_v.subarray(y * sbi.strides[1], y * sbi.strides[1] + sbi.width / 2), y * sbi.width / 2);
        }
        this.worker.postMessage(<VideoFrame&IResult>{
            status: 0,
            timestamp: sbi.output_yuv_timestamp,
            width: sbi.width,
            height: sbi.height,
            data: buf,
            y: new Uint8ClampedArray(out_y.buffer, out_y.byteOffset, out_y.byteLength),
            u: new Uint8ClampedArray(out_u.buffer, out_u.byteOffset, out_u.byteLength),
            v: new Uint8ClampedArray(out_v.buffer, out_v.byteOffset, out_v.byteLength),
            transferable: true,
        }, [buf]);
    }

    _parse_sbuffer_info() {
        var sbi = this.sbi_ptr;
        var in_ts_lo = <number>Module.getValue(sbi + 4, 'i32');
        var in_ts_hi = <number>Module.getValue(sbi + 8, 'i32');
        var out_ts_lo = <number>Module.getValue(sbi + 12, 'i32');
        var out_ts_hi = <number>Module.getValue(sbi + 16, 'i32');
        return {
            buffer_status: <number>Module.getValue(sbi, 'i32'),
            input_bs_timestamp: in_ts_lo | (in_ts_hi << 32),
            output_yuv_timestamp: out_ts_lo | (out_ts_hi << 32),
            width: <number>Module.getValue(sbi + 24, 'i32'),
            height: <number>Module.getValue(sbi + 28, 'i32'),
            strides: [
                <number>Module.getValue(sbi + 36, 'i32'),
                <number>Module.getValue(sbi + 40, 'i32'),
            ]
        };
    }
}
new OpenH264Decoder(this);
