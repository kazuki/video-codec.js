/// <reference path="asm.d.ts" />
/// <reference path="libx264.d.ts" />
importScripts("libx264.js");

class X264Worker {
    worker: Worker;
    width: number;
    height: number;
    frame_idx = 0;

    msg: Uint8Array;

    x264_handle: number;
    x264_rgb: number;
    x264_pic: number;
    x264_pic_out: number;
    x264_pic_y: number;
    x264_pic_u: number;
    x264_pic_v: number;
    x264_nal: number;
    x264_nal_cnt: number;
    
    constructor(worker) {
        this.worker = worker;
        this.worker.onmessage = (ev: MessageEvent) => {
            this.init(<any>ev.data);
        };
        this.msg = new Uint8Array(1);
    }

    x264_param_parse (param: number, name: string, value: string): boolean {
        var p_name = allocate(intArrayFromString(name), 'i8', ALLOC_NORMAL);
        var p_value = 0;
        if (value)
            p_value = allocate(intArrayFromString(value), 'i8', ALLOC_NORMAL);
        var ret = _x264_param_parse (param, p_name, p_value);
        _free (p_name);
        if (p_value > 0)
            _free (p_value);
        return ret == 0;
    }

    init(cfg:any) {
        var width = <number>cfg.width || 0;
        var height = <number>cfg.height || 0;
        var rgb_mode = <boolean>cfg.rgb || false;
        var x264_cfg = cfg.x264 || {};
        var preset = <number>x264_cfg.preset || 0;
        this.width = width;
        this.height = height;
        console.log("x264 init: " + width + "x" + height + ", preset=" + preset + ", rgb_mode=" + rgb_mode);
        var param = _x264_encoder_param_create(width, height, 60, 1, preset);
        this.x264_handle = _x264_encoder_open2 (param);
        if (this.x264_handle == 0) {
            console.log("x264_encoder_open: failed");
            throw 'failed';
        }
        this.x264_pic = _x264_picture_create ();
        this.x264_pic_out = _x264_picture_create ();
        if (this.x264_pic == 0 || this.x264_pic_out == 0) {
            console.log("x264_picture_create: failed");
            throw 'failed';
        }
        this.x264_pic_y = _malloc(width * height);
        this.x264_pic_u = _malloc(width * height / 4);
        this.x264_pic_v = _malloc(width * height / 4);
        if (this.x264_pic_y == 0 || this.x264_pic_u == 0 || this.x264_pic_v == 0) {
            console.log("_malloc: failed");
            throw 'failed';
        }
        this.x264_nal = _malloc(8);
        this.x264_nal_cnt = _malloc(8);

        if (rgb_mode) {
            this.x264_rgb = _malloc(width * height * 4);
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

    encode_frame() {
        this.frame_idx ++;
        _x264_picture_init (this.x264_pic);
        _x264_picture_setup (this.x264_pic, 0x0001, this.frame_idx,
                             this.width, this.width / 2, this.width / 2,
                             this.x264_pic_y, this.x264_pic_u, this.x264_pic_v);
        setValue (this.x264_nal_cnt, 0, 'i32');

        var ret = _x264_encoder_encode(this.x264_handle,
                                       this.x264_nal,
                                       this.x264_nal_cnt,
                                       this.x264_pic,
                                       this.x264_pic_out);
        if (ret < 0) {
            console.log('x264_encoder_encode failed: ' + ret);
            throw 'failed';
        }
        if (ret > 0) {
            var nal = <number>getValue(this.x264_nal, 'i32');
            var p_payload = <number>getValue (nal + 24, 'i32');
            var view = HEAPU8.subarray(p_payload, p_payload + ret);
            var clone = new Uint8Array(view);
            this.worker.postMessage(clone, [clone.buffer]);
        } else {
            this.msg[0] = 0;
            this.worker.postMessage(this.msg);
        }
    }

    encode_flush() {
        console.log('delayed frames: ' + _x264_encoder_delayed_frames (this.x264_handle));
        while (_x264_encoder_delayed_frames (this.x264_handle) > 0) {
            setValue (this.x264_nal_cnt, 0, 'i32');
            var ret = _x264_encoder_encode(this.x264_handle,
                                           this.x264_nal,
                                           this.x264_nal_cnt,
                                           0,
                                           this.x264_pic_out);
            if (ret < 0) break;
            if (ret > 0) {
                var nal = <number>getValue(this.x264_nal, 'i32');
                var p_payload = <number>getValue (nal + 24, 'i32');
                var view = HEAPU8.subarray(p_payload, p_payload + ret);
                var clone = new Uint8Array(view);
                this.worker.postMessage(clone, [clone.buffer]);
            }
        }
        this.msg[0] = 1;
        this.worker.postMessage(this.msg);
    }

    encode_frame_yuv(yuv: Uint8Array) {
        HEAPU8.set(yuv.subarray(0, this.width * this.height), this.x264_pic_y);
        HEAPU8.set(yuv.subarray(this.width * this.height, this.width * this.height * 1.25), this.x264_pic_u);
        HEAPU8.set(yuv.subarray(this.width * this.height * 1.25, this.width * this.height * 1.5), this.x264_pic_v);
        this.encode_frame();
    }

    encode_frame_rgb(rgb: Uint8Array) {
        HEAPU8.set(rgb, this.x264_rgb);
        _rgba_to_yuv420 (this.width, this.height, this.frame_idx, this.x264_rgb,
                         this.x264_pic_y, this.x264_pic_u, this.x264_pic_v);
        this.encode_frame();
    }
}

new X264Worker(this);
