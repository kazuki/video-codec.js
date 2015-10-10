/// <reference path="api.d.ts" />
/// <reference path="typings/emscripten.d.ts" />

declare function _WelsCreateSVCEncoder(ptr: number): number;
declare function _CreateEncParamExt(ptr: number, width: number, height: number, max_frame_rate: number): number;
declare function _WelsInitializeSVCEncoder(ptr: number, param: number): number;
declare function _WelsSVCEncoderEncodeFrame(ptr: number, pic: number, bsi: number): number;
declare function _WelsSVCEncoderForceIntraFrame(ptr: number): number;
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
    num_of_frames: number = 0;
    keyframe_interval: number;

    constructor(worker: Worker) {
        this.worker = worker;

        var handle = Module._malloc(4);
        var ret = _WelsCreateSVCEncoder(handle);
        this.encoder = <number>Module.getValue(handle, 'i32');
        Module._free(handle);
        if (ret != 0)
            throw 'WelsCreateSVCEncoder failed: ' + ret;

        worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data, e.data.params);
        };
    }

    _setup(vi: VideoInfo, cfg: any) {
        this.worker.onmessage = () => {};
        this.keyframe_interval = cfg.keyframe_interval || 100;
        var fps = vi.fps_num / vi.fps_den;
        var params = _CreateEncParamExt(this.encoder, vi.width, vi.height, fps);

        var int_configs = {
            'usage': 0,
            'bitrate': 12,
            'rc_mode': 16,
            'complexity': 768,
            'ref_frames': 776,
            'entropy_coding': 792,
            'max_bitrate': 800,
            'max_qp': 804,
            'min_qp': 808,
        };
        var bool_configs = {
            'denoise': 844,
            'background_detection': 845,
            'adaptive_quant': 846,
            'frame_cropping': 847,
            'scene_change_detect': 848
        };
        for (var key in int_configs) {
            if (key in cfg)
                Module.setValue(params + int_configs[key], cfg[key], 'i32');
        }
        for (var key in bool_configs) {
            if (key in cfg)
                Module.setValue(params + bool_configs[key], cfg[key] ? 1 : 0, 'i8');
        }
        // copy target bitrate to spatial-bitrate
        Module.setValue(params + 44, Module.getValue(params + int_configs['bitrate'], 'i32'), 'i32');

        var ret = _WelsInitializeSVCEncoder(this.encoder, params);
        Module._free(params);
        if (ret == 0) {
            this.worker.onmessage = (e: MessageEvent) => {
                this._encode(e.data);
            };
        }
        var size = vi.width * vi.height;
        this.i420 = Module._malloc(size * 1.5);
        this.y = Module.HEAPU8.subarray(this.i420, this.i420 + size);
        this.u = Module.HEAPU8.subarray(this.i420 + size, this.i420 + size * 1.25);
        this.v = Module.HEAPU8.subarray(this.i420 + size * 1.25, this.i420 + size * 1.5);
        this.pic = Module._malloc(_SizeOfSSourcePicture());
        this.bsi = Module._malloc(_SizeOfSFrameBSInfo());
        _SetupSSourcePicture(this.pic, vi.width, vi.height, this.i420);
        this.worker.postMessage(<Packet&IResult>{
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
            this.worker.postMessage(<IResult>{status: ret});
            return;
        }
        ++this.num_of_frames;
        if (this.num_of_frames % this.keyframe_interval == 0) {
            _WelsSVCEncoderForceIntraFrame(this.encoder);
        }

        var size = 0;
        var info = this._parse_bitstream_info();
        for (var i = 0; i < info.layerNum; ++i) {
            size += info.layers[i].bitstream.length;
        }
        if (size == 0) {
            this.worker.postMessage(<Packet&IResult>{
                status: 0,
                data: null,
                frame_type: FrameType.Unknown
            });
        } else {
            var tmp = new Uint8Array(size);
            var off = 0;
            for (var i = 0; i < info.layerNum; ++i) {
                tmp.set(info.layers[i].bitstream, off);
                off += info.layers[i].bitstream.length;
            }
            var ftype = FrameType.Unknown;
            if (info.frameType == 1) {
                ftype = FrameType.IDR;
            } else if (info.frameType == 2) {
                ftype = FrameType.I;
            } else if (info.frameType == 3) {
                ftype = FrameType.P;
            }
            this.worker.postMessage(<Packet&IResult>{
                status: 0,
                data: tmp.buffer,
                frame_type: ftype
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
