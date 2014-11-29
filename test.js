/// <reference path="input.ts" />
/// <reference path="renderer.ts" />
/// <reference path="asm.d.ts" />
/// <reference path="libx264.d.ts" />
var ReadTest = (function () {
    function ReadTest(reader) {
        this.renderer_initialized = false;
        this.frame_count = 0;
        this.reader = reader;
        switch (document.getElementById("renderer").value) {
            case "webgl":
                this.renderer = new WebGLRenderer();
                console.log("WebGL Renderer (YUV420->RGB conversion in shader)");
                break;
            default:
                this.renderer = new RGBRenderer();
                console.log("Canvas.putImageData Renderer (YUV420->RGB conversion in asm.js)");
                break;
        }
        this.renderer = new WebGLRenderer();
    }
    ReadTest.prototype.get_playback_scale = function () {
        return parseFloat(document.getElementById('playback_scale').value);
    };
    ReadTest.prototype.run = function (file) {
        var _this = this;
        console.time('read-test');
        this.reader.open(file, function (sender, args) {
            if (!args.is_success) {
                console.log("format error");
                return;
            }
            _this.video_info = args;
            if (args.width > 0)
                _this._init_renderer();
            _this.read_frame();
        });
    };
    ReadTest.prototype._init_renderer = function () {
        this.renderer_initialized = true;
        var div = document.getElementById("drawArea");
        if (div.firstChild)
            div.removeChild(div.firstChild);
        var canvas = document.createElement("canvas");
        var w = this.video_info.width, h = this.video_info.height;
        var scale = this.get_playback_scale();
        if (this.video_info.sar_width != this.video_info.sar_height) {
            if (this.video_info.sar_width > this.video_info.sar_height) {
                w = w * this.video_info.sar_width / this.video_info.sar_height;
            }
            else {
                h = h * this.video_info.sar_height / this.video_info.sar_width;
            }
        }
        var x = 0, y = 0;
        canvas.width = w * scale / window.devicePixelRatio;
        canvas.height = h * scale / window.devicePixelRatio;
        if (canvas.width < window.innerWidth)
            x = (window.innerWidth - canvas.width) / 2;
        if (canvas.height < window.innerHeight)
            y = (window.innerHeight - canvas.height) / 2;
        canvas.setAttribute('style', 'position:absolute;top:' + y + 'px;left:' + x + 'px');
        div.appendChild(canvas);
        this.renderer.init(canvas, this.video_info.width, this.video_info.height);
        this.buf = new Uint8Array(this.video_info.width * this.video_info.height * 12 / 8); /* YUV420 */
    };
    ReadTest.prototype.read_frame = function () {
        var _this = this;
        var handler = function (sender, args) {
            if (args.is_eof) {
                console.timeEnd('read-test');
                console.log("EOF: " + _this.frame_count + " frames");
                return;
            }
            if (!args.is_success) {
                console.log("Read error");
                return;
            }
            _this.frame_count++;
            if (!_this.renderer_initialized) {
                _this.video_info = _this.reader.get_video_info();
                _this._init_renderer();
            }
            _this.renderer.render(args.y, args.u, args.v);
            window.requestAnimationFrame(function () {
                _this.read_frame();
            });
        };
        this.reader.read(handler);
    };
    return ReadTest;
})();
var EncodeTest = (function () {
    function EncodeTest(reader, encoder) {
        var _this = this;
        this.eof = false;
        this.frame_count = 0;
        this.num_payloads = 0;
        this.reader = reader;
        this.encoder = new Worker(encoder);
        this.output = new Uint8Array(1024 * 1024 * 128);
        this.output_filled = 0;
        this.encoder.onmessage = function (ev) {
            var data = ev.data;
            if (data.length == 1) {
                if (data[0] == 1) {
                    var encode_time = (Date.now() - _this.encode_start_time) / 1000.0;
                    console.timeEnd('encode-test');
                    console.log("EOF: " + _this.frame_count + " frames");
                    console.log("size: " + (_this.output_filled / 1024) + " KB");
                    console.log("encode speed = " + (_this.frame_count / encode_time) + "fps");
                    document.getElementById("encstatus").innerHTML = (_this.frame_count / encode_time).toFixed(2) + "fps, size=" + (_this.output_filled / 1024).toFixed(0) + " KB";
                    var url = URL.createObjectURL(new Blob([new DataView(_this.output.buffer, _this.output.byteOffset, _this.output_filled)], { "type": " application/octet-stream" }));
                    window.location.assign(url);
                    return;
                }
            }
            else {
                _this._store_yuv(data);
            }
            _this._read_frame();
        };
    }
    EncodeTest.prototype.run = function (file) {
        var _this = this;
        console.time('encode-test');
        this.reader.open(file, function (sender, args) {
            if (!args.is_success) {
                console.log("format error");
                return;
            }
            _this.video_info = args;
            _this._encode_init();
        });
    };
    EncodeTest.prototype._read_frame = function () {
        var _this = this;
        if (this.eof)
            return;
        var handler = function (sender, args) {
            if (args.is_eof) {
                _this.encoder.postMessage(new Uint8Array(0));
                _this.eof = true;
                return;
            }
            if (!args.is_success) {
                console.log("Read error");
                return;
            }
            _this.frame_count++;
            var yuv = args.yuv;
            if (!args.yuv_owner) {
                yuv = new Uint8Array(yuv);
            }
            _this._encode_frame(yuv);
        };
        this.reader.read(handler);
    };
    EncodeTest.prototype._encode_init = function () {
        var preset = parseInt(document.getElementById("x264presets").value);
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
    };
    EncodeTest.prototype._encode_frame = function (yuv) {
        this.encoder.postMessage(yuv, [yuv.buffer]);
    };
    EncodeTest.prototype._store_yuv = function (data) {
        ++this.num_payloads;
        this.output.set(data, this.output_filled);
        this.output_filled += data.length;
    };
    return EncodeTest;
})();
document.addEventListener("DOMContentLoaded", function (event) {
    var get_file = function () {
        return document.getElementById("fileSelector").files[0];
    };
    document.getElementById("y4mtest").addEventListener("click", function (ev) {
        new ReadTest(new Y4MReader()).run(get_file());
    });
    document.getElementById("h264test").addEventListener("click", function (ev) {
        new ReadTest(new OpenH264Reader()).run(get_file());
    });
    document.getElementById("x264enc").addEventListener("click", function (ev) {
        new EncodeTest(new Y4MReader(), "x264_worker.js").run(get_file());
    });
    document.getElementById("openh264enc").addEventListener("click", function (ev) {
        new EncodeTest(new Y4MReader(), "openh264_encoder.js").run(get_file());
    });
});
