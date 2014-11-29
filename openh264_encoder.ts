/// <reference path="asm.d.ts" />
/// <reference path="libopenh264.d.ts" />
importScripts("libopenh264.js");

class OpenH264Encoder {
    worker: Worker;
    encoder: number;
    msg: Uint8Array;
    pic: number;
    pic_yuv_buf: number;
    fbi: number;
    width: number;
    height: number;
    frame_count = 0;
    rgb_buf = 0;
    
    constructor(worker: Worker) {
        this.worker = worker;
        this.msg = new Uint8Array(1);

        var handle = _malloc(4);
        var ret = _WelsCreateSVCEncoder(handle);
        this.encoder = getValue(handle, 'i32');
        _free(handle);
        if (ret != 0)
            throw "WelsCreateSVCEncoder failed: " + ret;

        this.worker.onmessage = (e: MessageEvent) => {
            this.init(e.data);
        };
        console.log('ok: constructor');
    }

    init(cfg: any) {
        this.worker.onmessage = (e: MessageEvent) => {};

        var width = this.width = <number>cfg.width || 0;
        var height = this.height = <number>cfg.height || 0;
        var rgb_mode = <boolean>cfg.rgb || false;
        cfg = cfg.openh264 || {};

        var param = _malloc(_SizeOfSEncParamExt());
        this.fbi = _malloc(_SizeOfSFrameBSInfo());
        this.pic = _malloc(_SizeOfSSourcePicture());
        this.pic_yuv_buf = _malloc(width * height * 1.5);
        if (param == 0 || this.fbi == 0 || this.pic == 0 || this.pic_yuv_buf == 0)
            throw "memory allocation error"
        var ret = _ISVCEncoderGetDefaultParams (this.encoder, param);
        if (ret != 0)
            throw "ISVCEncoderGetDefaultParams failed: " + ret;
        _SetupSEncParamExt(param, width, height, (cfg["bitrate"]||1000) * 1000);

        ret = _ISVCEncoderInitializeExt(this.encoder, param);
        if (ret != 0)
            throw "ISVCEncoderInitializeExt failed: " + ret;

        setValue(this.pic, 23, 'i32'); // YUV420
        setValue(this.pic + 4, width, 'i32'); // stride(y)
        setValue(this.pic + 8, width / 2, 'i32'); // stride(u)
        setValue(this.pic + 12, width / 2, 'i32'); // stride(v)
        setValue(this.pic + 20, this.pic_yuv_buf, 'i32'); // data(y)
        setValue(this.pic + 24, this.pic_yuv_buf + width * height, 'i32'); // data(u)
        setValue(this.pic + 28, this.pic_yuv_buf + width * height * 1.25, 'i32'); // data(v)
        setValue(this.pic + 36, width, 'i32');
        setValue(this.pic + 40, height, 'i32');
        setValue(this.pic + 44, 0, 'i32');
        setValue(this.pic + 48, 0, 'i32');

        if (rgb_mode) {
            this.rgb_buf = _malloc(width * height * 4);
            this.worker.onmessage = (ev: MessageEvent) => {
                var view:any = <any>ev.data;
                if (view.byteLength == 0) {
                    this.encode_flush();
                } else {
                    this.encode_frame_rgb(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
                }
            };
        } else {
            this.worker.onmessage = (ev: MessageEvent) => {
                var view:any = <any>ev.data;
                if (view.byteLength == 0) {
                    this.encode_flush();
                } else {
                    this.encode_frame_yuv(new Uint8Array(view.buffer, view.byteOffset, view.byteLength));
                }
            };
        }
    }

    encode_frame(): void {
        setValue(this.pic + 44, (this.frame_count++ * (1000 / 30.0))|0, 'i32');

        var ret = _ISVCEncoderEncodeFrame (this.encoder, this.pic, this.fbi);
        if (ret != 0)
            throw "ISVCEncoderEncodeFrame failed: " + ret;

        var size = 0;
        var info = this.parse_frame_bitstream_info();
        for (var i = 0; i < info.layerNum; ++i) {
            var l = info.layers[i];
            var bs = l.bitstream;
            /*console.log('[' + (i+1) + '/' + info.layerNum + '] nal-count: ' + l.nalCount
                        + ', nal-bytes: ' + bs.length + '. header=['
                        + bs[0] + ',' + bs[1] + ',' + bs[2] + ',' + bs[3] + ']');*/
            size += bs.length;
        }
        if (size > 0) {
            var tmp = new Uint8Array(size);
            var off = 0;
            for (var i = 0; i < info.layerNum; ++i) {
                tmp.set(info.layers[i].bitstream, off);
                off += info.layers[i].bitstream.length;
            }
            this.worker.postMessage(tmp, [tmp.buffer]);
        } else {
            this.msg[0] = 0;
            this.worker.postMessage(this.msg);
        }
    }

    encode_flush(): void {
        // TODO
        this.msg[0] = 1;
        this.worker.postMessage(this.msg);
    }

    encode_frame_rgb(rgb: Uint8Array): void {
        HEAPU8.set(rgb, this.rgb_buf);
        _rgba_to_yuv420 (this.width, this.height, this.rgb_buf,
                         getValue(this.pic + 20, 'i32'),
                         getValue(this.pic + 24, 'i32'),
                         getValue(this.pic + 28, 'i32'));
        this.encode_frame();
    }

    encode_frame_yuv(yuv: Uint8Array): void {
        HEAPU8.set(yuv.subarray(0, this.width * this.height), getValue(this.pic + 20, 'i32'));
        HEAPU8.set(yuv.subarray(this.width * this.height, this.width * this.height * 1.25),
                   getValue(this.pic + 24, 'i32'));
        HEAPU8.set(yuv.subarray(this.width * this.height * 1.25, this.width * this.height * 1.5),
                   getValue(this.pic + 28, 'i32'));
        this.encode_frame();
    }

    parse_frame_bitstream_info() : any
    {
        var ret = {
            temporalId: getValue(this.fbi + 0, 'i32'),
            subSeqId: getValue(this.fbi + 4, 'i32'),
            layerNum: getValue(this.fbi + 8, 'i32'),
            layers: [],
            frameType: undefined,
            timeStamp: undefined
        };
        var p = this.fbi + 12;
        for (var i = 0; i < ret.layerNum; ++i, p += 16) {
            var layer = {
                temporalId: HEAPU8[p],
                spatialId: HEAPU8[p + 1],
                qualityId: HEAPU8[p + 2],
                layerType: HEAPU8[p + 3],
                nalCount: getValue(p + 4, 'i32'),
                nalLengthList: undefined,
                bitstream: undefined
            };
            layer.nalLengthList = HEAP32.subarray(getValue(p + 8, 'i32') >> 2,
                                                  (getValue(p + 8, 'i32') >> 2) + layer.nalCount);
            var size = 0;
            for (var j = 0; j < layer.nalCount; ++j)
                size += layer.nalLengthList[j];
            layer.bitstream = HEAPU8.subarray(getValue(p + 12, 'i32'), getValue(p + 12, 'i32') + size);
            ret.layers.push(layer);
        }
        p = this.fbi + 12 + 16 * 128;
        ret.frameType = getValue(p, 'i32');
        ret.timeStamp = getValue(p + 4, 'i32') | (getValue(p + 8, 'i32') << 32);
        return ret;
    }
}

new OpenH264Encoder(this);
