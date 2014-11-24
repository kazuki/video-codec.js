/// <reference path="asm.d.ts" />
/// <reference path="libopenh264.d.ts" />
importScripts("libopenh264.js");

class OpenH264Worker {
    worker: Worker;
    handle: number;
    decoder: number;

    buffer: Uint8Array;
    buffer_ptr: number;
    dst_data: number;
    sbufferinfo: number;

    msg: Uint8Array;
    frame: Uint8Array;

    frame_counter: number = 0;
    MAX_NALU_SIZE = 1024 * 1024;
    
    constructor(worker: Worker) {
        this.worker = worker;

        this.handle = _malloc(4);
        if (_WelsCreateDecoder(this.handle) != 0)
            throw 'failed: _WelsCreateDecoder';
        this.decoder = getValue(this.handle, 'i32');
        if (_ISVCDecoderInitialize(this.decoder) != 0)
            throw 'failed: ISVCDecoder::Initialize';

        this.buffer_ptr = _malloc(this.MAX_NALU_SIZE);
        this.buffer = HEAPU8.subarray(this.buffer_ptr, this.buffer_ptr + this.MAX_NALU_SIZE);
        this.dst_data = _malloc(4 * 3);
        this.sbufferinfo = _malloc(4 * 6);
        this.msg = new Uint8Array(1);
        this.frame = null;
        
        this.worker.onmessage = (e: MessageEvent) => {
            this._decode(<Uint8Array>e.data);
        };
    }

    _decode(data: Uint8Array): void {
        this.buffer.set(data);
        
        setValue(this.dst_data + 0, 0, 'i32');
        setValue(this.dst_data + 4, 0, 'i32');
        setValue(this.dst_data + 8, 0, 'i32');
        for (var i = 0; i < 6; ++i)
            setValue(this.sbufferinfo + i * 4, 0, 'i32');

        var ret = _ISVCDecoderDecodeFrame(this.decoder,
                                          this.buffer_ptr,
                                          data.length,
                                          this.dst_data,
                                          this.sbufferinfo);
        if (getValue(this.sbufferinfo, 'i32') == 1) {
            this.frame_counter ++;
            var w = getValue(this.sbufferinfo + 4, 'i32');
            var h = getValue(this.sbufferinfo + 8, 'i32');
            var s0 = getValue(this.sbufferinfo + 16, 'i32');
            var s1 = getValue(this.sbufferinfo + 20, 'i32');
            if (!this.frame) {
                this.worker.postMessage({
                    width: w,
                    height: h
                });
                this.frame = new Uint8Array(w * h * 12 / 8); // YUV420
            }
            var p = getValue(this.dst_data + 0, 'i32');
            for (var y = 0; y < h; ++y) {
                this.frame.set(HEAPU8.subarray(p, p + w), y * w);
                p += s0;
            }

            var off = w * h;
            h /= 2;
            w /= 2;
            p = getValue(this.dst_data + 4, 'i32');
            for (var y = 0; y < h; ++y) {
                this.frame.set(HEAPU8.subarray(p, p + w), off + y * w);
                p += s1;
            }
            off += w * h;
            p = getValue(this.dst_data + 8, 'i32');
            for (var y = 0; y < h; ++y) {
                this.frame.set(HEAPU8.subarray(p, p + w), off + y * w);
                p += s1;
            }
            this.worker.postMessage(this.frame);
        } else {
            this.msg[0] = 0;
            this.worker.postMessage(this.msg);
        }
    }
}

new OpenH264Worker(this);
