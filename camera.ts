/// <reference path="renderer.ts" />

class CameraTest {
    video: HTMLVideoElement;
    canvas_src: HTMLCanvasElement;
    canvas_src_ctx: any;
    canvas_dst: HTMLCanvasElement;
    renderer: IRenderer = undefined;
    status: HTMLDivElement;

    encoder: Worker;
    decoder: Worker;

    target_interval = 0; //(1.0 / 30.0 * 1000).toFixed(0);
    prev_video_time = 0;

    queued_frames = 0;
    max_queued_frames = 0;

    encode_start_time: number;
    encode_period_time: number;
    encoded_frames = 0;
    encoded_frames_period = 0;
    encoded_bytes = 0;
    encoded_bytes_period = 0;

    decoder_queue = 0;
    decoder_width: number;
    decoder_height: number;

    constructor() {
        this.video = <HTMLVideoElement>document.getElementById("video");
        this.canvas_src = <HTMLCanvasElement>document.getElementById("canvas_src");
        this.canvas_src_ctx = this.canvas_src.getContext("2d");
        this.canvas_dst = <HTMLCanvasElement>document.getElementById("canvas_dst");
        this.status = <HTMLDivElement>document.getElementById("status");
        switch((<HTMLSelectElement>document.getElementById("encoder")).value) {
        case "x264":
            this.encoder = new Worker("x264_worker.js");
            break;
        case "openh264":
            this.encoder = new Worker("openh264_encoder.js");
            break;
        default:
            throw "unknown encoder";
        }
        this.decoder = new Worker("openh264_worker.js");
        this.encoder.onmessage = (ev: MessageEvent) => {
            this.encoded_frames ++;
            if (ev.data.length > 1) {
                this.encoded_bytes += ev.data.length;
                this.decoder.postMessage(ev.data, [ev.data.buffer]);
            }

            var avg = this.encoded_frames / (Date.now() - this.encode_start_time) * 1000;
            var avg_bps = this.encoded_bytes * 8 / (Date.now() - this.encode_start_time) * 1000;
            if (Date.now() - this.encode_period_time >= 1000) {
                var frames = this.encoded_frames - this.encoded_frames_period;
                var bytes = this.encoded_bytes - this.encoded_bytes_period;
                var period_time = Date.now() - this.encode_period_time;
                var avg_period = frames / period_time * 1000;
                var avg_bps_period = bytes * 8 / period_time * 1000;
                this.encoded_frames_period = this.encoded_frames;
                this.encoded_bytes_period = this.encoded_bytes;
                this.encode_period_time = Date.now();
                this.status.innerHTML = avg_period.toFixed(2) + 'fps ' +
                    (avg_bps_period / 1000).toFixed(0) + 'kbps ' +
                    (bytes * 8 / 1000 / frames).toFixed(0) + 'kbps/frame. ' +
                    '(Avg: ' + avg.toFixed(2) + 'fps ' +
                    (avg_bps / 1000).toFixed(0) + 'kbps ' +
                    (this.encoded_bytes * 8 / 1000 / this.encoded_frames).toFixed(0) + 'kbps/frame)';
            }

            this.queued_frames--;
            if (this.queued_frames <= this.max_queued_frames)
                this._wait_next_frame();
        };
        this.decoder.onmessage = (ev: MessageEvent) => {
            if (!this.renderer) {
                if (ev.data instanceof Uint8Array)
                    return;
                var width = this.decoder_width = ev.data.width;
                var height = this.decoder_height = ev.data.height;
                this.canvas_dst.width = width;
                this.canvas_dst.height = height;
                this.renderer = new WebGLRenderer();
                this.renderer.init(this.canvas_dst, width, height);
                return;
            }
            
            -- this.decoder_queue;
            if (ev.data.length == 1)
                return;

            var yuv = <Uint8Array>ev.data;
            var s = this.decoder_width * this.decoder_height;
            var y = yuv.subarray(0, s);
            var u = yuv.subarray(s, s * 1.25);
            var v = yuv.subarray(s * 1.25, s * 1.5);
            this.renderer.render(y, u, v);
        };
    }
    
    run(): void {
        (<any>navigator).getUserMedia = ((<any>navigator).getUserMedia ||
                                         (<any>navigator).webkitGetUserMedia ||
                                         (<any>navigator).mozGetUserMedia ||
                                         (<any>navigator).msGetUserMedia);
        (<any>navigator).getUserMedia({video:true, audio:false}, (strm: any) => {
            var video = this.video;
            video.src = URL.createObjectURL(strm);
            video.play();
            this._wait_video_init();
        }, (err: string) => {
            console.log("failed(navigator.getUserMedia): " + err);
        });
    }

    _wait_video_init() {
        window.setTimeout(() => {
            if (this.video.videoHeight == 0) {
                this._wait_video_init();
            } else {
                var scale = parseFloat((<HTMLSelectElement>document.getElementById("capture_scale")).value);
                this.canvas_src.width = this.video.videoWidth * scale;
                this.canvas_src.height = this.video.videoHeight * scale;
                this.encoder.postMessage({
                    width: this.canvas_src.width,
                    height: this.canvas_src.height,
                    rgb: true,
                    x264: {
                        preset: parseInt((<HTMLSelectElement>document.getElementById("x264presets")).value)
                    }
                });
                this.encode_start_time = this.encode_period_time = Date.now();
                this._wait_next_frame();
            }
        }, 0);
    }

    _wait_next_frame() {
        if (this.queued_frames > this.max_queued_frames)
            return;
        window.setTimeout(() => {
            if (this.prev_video_time != this.video.currentTime) {
                this.prev_video_time = this.video.currentTime;
                this._frame_updated();
            } else {
                this._wait_next_frame();
            }
        }, this.target_interval);
    }

    _frame_updated() {
        if (this.queued_frames <= this.max_queued_frames) {
            this.canvas_src_ctx.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight,
                                          0, 0, this.canvas_src.width, this.canvas_src.height);
            var img = this.canvas_src_ctx.getImageData(0, 0, this.canvas_src.width, this.canvas_src.height);
            this.encoder.postMessage(img.data, [img.data.buffer]);
            this.queued_frames ++;
        }
        this._wait_next_frame();
    }
}

document.addEventListener("DOMContentLoaded", function(event) {
    var encoder_changed = () => {
        var names = ["x264", "openh264"];
        var cfgs = [
            document.getElementById("x264cfg"),
            undefined
        ];
        var selected_name = (<HTMLSelectElement>document.getElementById("encoder")).value;
        for (var i = 0; i < names.length; ++i) {
            var value = (names[i] == selected_name ? "inline" : "none");
            if (cfgs[i])
                cfgs[i].style.display = value;
        }
    };
    document.getElementById("encoder").addEventListener("change", () => {
        encoder_changed();
    });
    document.getElementById("start").addEventListener("click", () => {
        new CameraTest().run();
    });

    encoder_changed();
});
