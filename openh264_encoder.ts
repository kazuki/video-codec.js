/// <reference path="api.d.ts" />
/// <reference path="typings/emscripten.d.ts" />

declare function _WelsCreateSVCEncoder(ptr: number): number;
declare function _WelsSetupSVCEncoder(ptr: number, width: number, height: number,
                                      max_frame_rate: number, targetBitrate: number): number;
declare function _WelsSVCEncoderEncodeFrame(ptr: number, pic: number, bsi: number): number;
declare function _SizeOfSFrameBSInfo(): number;
declare function _SizeOfSSourcePicture(): number;
declare function _SetupSSourcePicture(pic: number, width: number, height: number, data: number);
declare function _SetSSourcePictureTimestamp(pic: number, timestamp_in_sec: number);

class OpenH264Encoder {
    worker: Worker;
    encoder: number;
    i420: number;
    y: Uint8Array;
    u: Uint8Array;
    v: Uint8Array;
    pic: number;
    bsi: number;

    constructor(worker: Worker) {
        this.worker = worker;

        var handle = Module._malloc(4);
        var ret = _WelsCreateSVCEncoder(handle);
        this.encoder = <number>Module.getValue(handle, 'i32');
        Module._free(handle);
        if (ret != 0)
            throw 'WelsCreateSVCEncoder failed: ' + ret;

        worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data);
        };
    }

    _setup(cfg: any) {
        this.worker.onmessage = () => {};
        var fps = cfg.fps_num / cfg.fps_den;
        var ret = _WelsSetupSVCEncoder(this.encoder, cfg.width, cfg.height, fps, 5000000);
        if (ret == 0) {
            this.worker.onmessage = (e: MessageEvent) => {
                this._encode(e.data);
            };
        }
        var size = cfg.width * cfg.height;
        this.i420 = Module._malloc(size * 1.5);
        this.y = Module.HEAPU8.subarray(this.i420, this.i420 + size);
        this.u = Module.HEAPU8.subarray(this.i420 + size, this.i420 + size * 1.25);
        this.v = Module.HEAPU8.subarray(this.i420 + size * 1.25, this.i420 + size * 1.5);
        this.pic = Module._malloc(_SizeOfSSourcePicture());
        this.bsi = Module._malloc(_SizeOfSFrameBSInfo());
        _SetupSSourcePicture(this.pic, cfg.width, cfg.height, this.i420);
        this.worker.postMessage({
            status: ret,
            data: null,
        });
    }

    _encode(frame: VideoFrame) {
        this.y.set(new Uint8Array(frame.y.buffer, frame.y.byteOffset, frame.y.byteLength));
        this.u.set(new Uint8Array(frame.u.buffer, frame.u.byteOffset, frame.u.byteLength));
        this.v.set(new Uint8Array(frame.v.buffer, frame.v.byteOffset, frame.v.byteLength));
        if (frame.timestamp) {
            _SetSSourcePictureTimestamp(this.pic, frame.timestamp);
        }
        var ret = _WelsSVCEncoderEncodeFrame(this.encoder, this.pic, this.bsi);
        if (ret != 0) {
            this.worker.postMessage({
                status: ret
            });
            return;
        }

        var size = 0;
        var info = this._parse_bitstream_info();
        for (var i = 0; i < info.layerNum; ++i) {
            size += info.layers[i].bitstream.length;
        }
        if (size == 0) {
            this.worker.postMessage({
                status: 0,
                data: null,
            });
        } else {
            var tmp = new Uint8Array(size);
            var off = 0;
            for (var i = 0; i < info.layerNum; ++i) {
                tmp.set(info.layers[i].bitstream, off);
                off += info.layers[i].bitstream.length;
            }
            this.worker.postMessage({
                status: 0,
                data: tmp.buffer,
            }, [tmp.buffer]);
        }
    }

    _parse_bitstream_info() : any
    {
        var bsi = this.bsi;
        var ret = {
            temporalId: <number>Module.getValue(bsi + 0, 'i32'),
            subSeqId: <number>Module.getValue(bsi + 4, 'i32'),
            layerNum: <number>Module.getValue(bsi + 8, 'i32'),
            layers: [],
            frameType: undefined,
            timeStamp: undefined
        };
        var p = bsi + 12;
        for (var i = 0; i < ret.layerNum; ++i, p += 16) {
            var layer = {
                temporalId: Module.HEAPU8[p],
                spatialId: Module.HEAPU8[p + 1],
                qualityId: Module.HEAPU8[p + 2],
                layerType: Module.HEAPU8[p + 3],
                nalCount: Module.getValue(p + 4, 'i32'),
                nalLengthList: undefined,
                bitstream: undefined
            };
            layer.nalLengthList = Module.HEAP32.subarray(
                Module.getValue(p + 8, 'i32') >> 2,
                (Module.getValue(p + 8, 'i32') >> 2) + layer.nalCount);
            var size = 0;
            for (var j = 0; j < layer.nalCount; ++j)
                size += layer.nalLengthList[j];
            layer.bitstream = Module.HEAPU8.subarray(
                Module.getValue(p + 12, 'i32'),
                Module.getValue(p + 12, 'i32') + size);
            ret.layers.push(layer);
        }
        p = bsi + 12 + 16 * 128;
        ret.frameType = Module.getValue(p, 'i32');
        ret.timeStamp = Module.getValue(p + 4, 'i32') | (Module.getValue(p + 8, 'i32') << 32);
        return ret;
    }
}
new OpenH264Encoder(this);
