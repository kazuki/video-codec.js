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
    eof = false;
    video_info: VideoInfo;
    frame_count = 0;
    encoder: Worker;
    encode_start_time: number;

    output: Uint8Array;
    output_filled: number;
    num_payloads = 0;

    constructor(reader: VideoReader, encoder: string) {
        this.reader = reader;
        this.encoder = new Worker(encoder);
        this.output = new Uint8Array (1024 * 1024 * 128);
        this.output_filled = 0;

        this.encoder.onmessage = (ev: MessageEvent) => {
            var data = <Uint8Array>ev.data;
            if (data.length == 1) {
                if (data[0] == 1) {
                    var encode_time = (Date.now() - this.encode_start_time) / 1000.0;
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
            } else {
                this._store_yuv(data);
            }
            this._read_frame();
        };
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
        if (this.eof) return;
        var handler = (sender: any, args: ReadEventArgs) => {
            if (args.is_eof) {
                this.encoder.postMessage(new Uint8Array(0));
                this.eof = true;
                return;
            }
            if (!args.is_success) {
                console.log("Read error");
                return;
            }
            this.frame_count ++;
            var yuv = args.yuv;
            if (!args.yuv_owner) {
                yuv = new Uint8Array(yuv);
            }
            this._encode_frame(yuv);
        };
        this.reader.read(handler);
    }

    _encode_init() {
        var preset = parseInt((<HTMLInputElement>document.getElementById("x264presets")).value);
        this.encoder.postMessage({
            width: this.video_info.width,
            height: this.video_info.height,
            rgb: false,
            fps_num: this.video_info.fps_num,
            fps_den: this.video_info.fps_den,
            x264: {
                ssim: undefined,
                preset: preset
            }
        });
        this.encode_start_time = Date.now();
        this._read_frame();
    }

    _encode_frame(yuv: Uint8Array) {
        this.encoder.postMessage(yuv, [yuv.buffer]);
    }

    _store_yuv (data: Uint8Array) {
        ++this.num_payloads;
        this.output.set(data, this.output_filled);
        this.output_filled += data.length;
    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    var get_file = () => {
        return (<HTMLInputElement>document.getElementById("fileSelector")).files[0];
    };
    document.getElementById("y4mtest").addEventListener("click", function(ev) {
        new ReadTest(new Y4MReader()).run(get_file())
    });
    document.getElementById("h264test").addEventListener("click", function(ev) {
        new ReadTest(new OpenH264Reader()).run(get_file());
    });
    document.getElementById("x264enc").addEventListener("click", function(ev) {
        new EncodeTest(new Y4MReader(), "x264_worker.js").run(get_file());
    });
    document.getElementById("openh264enc").addEventListener("click", function(ev) {
        new EncodeTest(new Y4MReader(), "openh264_encoder.js").run(get_file());
    });
});
