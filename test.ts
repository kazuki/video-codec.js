/// <reference path="input.ts" />
/// <reference path="renderer.ts" />

/// <reference path="asm.d.ts" />
/// <reference path="libx264.d.ts" />

class ReadTest {
    reader: VideoReader;
    video_info: VideoInfo;
    buf: Uint8Array;
    renderer: IRenderer;
    frame_count = 0;

    constructor(reader: VideoReader) {
        this.reader = reader;
    }

    get_playback_scale(): number {
        return parseFloat((<HTMLSelectElement>document.getElementById('playback_scale')).value);
    }
    
    run(file: File): void {
        console.time('read-test');
        this.reader.open(file, (sender:any, args: OpenEventArgs) => {
            if (!args.is_success) {
                console.log("format error");
                return;
            }
            this.video_info = args;
            if (args.width > 0)
                this._init_renderer();
            this.read_frame();
        });
    }

    _init_renderer() {
        this.renderer = new WebGLRenderer();
        var div = document.getElementById("drawArea");
        if (div.firstChild) div.removeChild(div.firstChild);
        var canvas = <HTMLCanvasElement>document.createElement("canvas");
        var w = this.video_info.width, h = this.video_info.height;
        var scale = this.get_playback_scale();
        if (this.video_info.sar_width != this.video_info.sar_height) {
            if (this.video_info.sar_width > this.video_info.sar_height) {
                w = w * this.video_info.sar_width / this.video_info.sar_height;
            } else {
                h = h * this.video_info.sar_height / this.video_info.sar_width;
            }
        }

        var x = 0, y = 0;
        canvas.width = w * scale / window.devicePixelRatio;
        canvas.height = h * scale / window.devicePixelRatio;
        if (canvas.width < window.innerWidth) x = (window.innerWidth - canvas.width) / 2;
        if (canvas.height < window.innerHeight) y = (window.innerHeight - canvas.height) / 2;
        canvas.setAttribute('style', 'position:absolute;top:'+y+'px;left:'+x+'px');
        div.appendChild(canvas);
        this.renderer.init(canvas, this.video_info.width, this.video_info.height);
        this.buf = new Uint8Array(this.video_info.width * this.video_info.height * 12 / 8); /* YUV420 */
    }

    read_frame(): void {
        var handler = (sender: any, args: ReadEventArgs) => {
            if (args.is_eof) {
                console.timeEnd('read-test');
                console.log("EOF: " + this.frame_count + " frames");
                return;
            }
            if (!args.is_success) {
                console.log("Read error");
                return;
            }
            this.frame_count ++;
            if (!this.renderer) {
                this.video_info = this.reader.get_video_info();
                this._init_renderer();
            }
            this.renderer.render(args.y, args.u, args.v);
            window.requestAnimationFrame(() => {
                this.read_frame();
            });
        };
        this.reader.read(handler);
    }
}

class EncodeTest {
    reader: VideoReader;
    video_info: VideoInfo;
    frame_count = 0;

    encode_start_time: number;

    x264_handle: number;
    x264_pic: number;
    x264_pic_out: number;
    x264_pic_y: number;
    x264_pic_u: number;
    x264_pic_v: number;
    x264_nal: number;
    x264_nal_cnt: number;

    output: Uint8Array;
    output_filled: number;
    num_payloads = 0;

    constructor(reader: VideoReader) {
        this.reader = reader;
        this.output = new Uint8Array (1024 * 1024 * 128);
        this.output_filled = 0;
    }

    run(file: File): void {
        console.time('encode-test');
        this.reader.open(file, (sender:any, args: OpenEventArgs) => {
            if (!args.is_success) {
                console.log("format error");
                return;
            }
            this.video_info = args;
            this._encode_init();
        });
    }

    _read_frame() {
        var handler = (sender: any, args: ReadEventArgs) => {
            if (args.is_eof) {
                this._encode_flush();
                var encode_time = (Date.now() - this.encode_start_time) / 1000.0;
                _x264_encoder_close (this.x264_handle);
                console.timeEnd('encode-test');
                console.log("EOF: " + this.frame_count + " frames");
                console.log("size: " + (this.output_filled / 1024) + " KB");
                console.log("encode speed = " + (this.frame_count / encode_time) + "fps");
                document.getElementById("encstatus").innerHTML =
                    (this.frame_count / encode_time).toFixed(2)
                    + "fps, size=" + (this.output_filled / 1024).toFixed(0) + " KB";
                var url = URL.createObjectURL(new Blob(
                    [new DataView(this.output.buffer, this.output.byteOffset, this.output_filled)],
                    {"type": " application/octet-stream"}));
                window.location.assign(url);
                return;
            }
            if (!args.is_success) {
                console.log("Read error");
                return;
            }
            this.frame_count ++;
            this._encode_frame(args.y, args.u, args.v);
            this._read_frame();
        };
        this.reader.read(handler);
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

    _encode_init() {
        var preset = parseInt((<HTMLInputElement>document.getElementById("x264presets")).value);
        var param = _x264_encoder_param_create(this.video_info.width,
                                               this.video_info.height,
                                               this.video_info.fps_num,
                                               this.video_info.fps_den,
                                               preset);
        if (!this.x264_param_parse (param, "ssim", undefined)) {
            console.log("x264_param_parse: failed (ssim)");
            throw 'failed';
        }
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
        this.x264_pic_y = _malloc(this.video_info.width * this.video_info.height);
        this.x264_pic_u = _malloc(this.video_info.width * this.video_info.height / 4);
        this.x264_pic_v = _malloc(this.video_info.width * this.video_info.height / 4);
        if (this.x264_pic_y == 0 || this.x264_pic_u == 0 || this.x264_pic_v == 0) {
            console.log("_malloc: failed");
            throw 'failed';
        }

        this.x264_nal = _malloc(8);
        this.x264_nal_cnt = _malloc(8);

        this.encode_start_time = Date.now();
        this._read_frame();
    }

    _encode_frame(y: Uint8Array, u: Uint8Array, v: Uint8Array) {
        HEAPU8.set (y, this.x264_pic_y);
        HEAPU8.set (u, this.x264_pic_u);
        HEAPU8.set (v, this.x264_pic_v);
        _x264_picture_init (this.x264_pic);
        _x264_picture_setup (this.x264_pic, 0x0001/*X264_CSP_I420*/, this.frame_count,
                             this.video_info.width, this.video_info.width / 2, this.video_info.width / 2,
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
        if (ret > 0)
            this._store_yuv(ret);
    }

    _encode_flush() {
        console.log('delayed frames: ' + _x264_encoder_delayed_frames (this.x264_handle));
        while (_x264_encoder_delayed_frames (this.x264_handle) > 0) {
            setValue (this.x264_nal_cnt, 0, 'i32');
            var ret = _x264_encoder_encode(this.x264_handle,
                                           this.x264_nal,
                                           this.x264_nal_cnt,
                                           0,
                                           this.x264_pic_out);
            if (ret < 0) break;
            if (ret > 0)
                this._store_yuv(ret);
        }
    }

    _store_yuv (size: number) {
        var nal = <number>getValue(this.x264_nal, 'i32');
        var p_payload = <number>getValue (nal + 24, 'i32');
        ++this.num_payloads;
        //console.log(this.num_payloads + ': payload_size=' + size);
        this.output.set(HEAPU8.subarray(p_payload, p_payload + size), this.output_filled);
        this.output_filled += size;
    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    document.getElementById("y4mtest").addEventListener("click", function(ev) {
        new ReadTest(new Y4MReader()).run((<HTMLInputElement>document.getElementById("fileSelector")).files[0]);
    });
    document.getElementById("h264test").addEventListener("click", function(ev) {
        new ReadTest(new OpenH264Reader()).run((<HTMLInputElement>document.getElementById("fileSelector")).files[0]);
    });
    document.getElementById("h264enc").addEventListener("click", function(ev) {
        new EncodeTest(new Y4MReader()).run((<HTMLInputElement>document.getElementById("fileSelector")).files[0]);
    });
});
