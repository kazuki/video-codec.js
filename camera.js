/// <reference path="renderer.ts" />
var CameraTest = (function () {
    function CameraTest() {
        var _this = this;
        this.renderer = undefined;
        this.target_interval = 1000 / 24 - 10;
        this.prev_video_time = 0;
        this.timer_cleared = true;
        this.queued_frames = 0;
        this.max_queued_frames = 0;
        this.encoded_frames = 0;
        this.encoded_frames_period = 0;
        this.encoded_bytes = 0;
        this.encoded_bytes_period = 0;
        this.decoder_queue = 0;
        this.video = document.getElementById("video");
        this.canvas_src = document.getElementById("canvas_src");
        this.canvas_src_ctx = this.canvas_src.getContext("2d");
        this.canvas_dst = document.getElementById("canvas_dst");
        this.status = document.getElementById("status");
        switch (document.getElementById("encoder").value) {
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
        this.encoder.onmessage = function (ev) {
            _this.encoded_frames++;
            if (ev.data.length > 1) {
                _this.encoded_bytes += ev.data.length;
                _this.decoder.postMessage(ev.data, [ev.data.buffer]);
            }
            var avg = _this.encoded_frames / (Date.now() - _this.encode_start_time) * 1000;
            var avg_bps = _this.encoded_bytes * 8 / (Date.now() - _this.encode_start_time) * 1000;
            if (Date.now() - _this.encode_period_time >= 1000) {
                var frames = _this.encoded_frames - _this.encoded_frames_period;
                var bytes = _this.encoded_bytes - _this.encoded_bytes_period;
                var period_time = Date.now() - _this.encode_period_time;
                var avg_period = frames / period_time * 1000;
                var avg_bps_period = bytes * 8 / period_time * 1000;
                _this.encoded_frames_period = _this.encoded_frames;
                _this.encoded_bytes_period = _this.encoded_bytes;
                _this.encode_period_time = Date.now();
                _this.status.innerHTML = avg_period.toFixed(2) + 'fps ' + (avg_bps_period / 1000).toFixed(0) + 'kbps ' + (bytes * 8 / 1000 / frames).toFixed(0) + 'kbps/frame. ' + '(Avg: ' + avg.toFixed(2) + 'fps ' + (avg_bps / 1000).toFixed(0) + 'kbps ' + (_this.encoded_bytes * 8 / 1000 / _this.encoded_frames).toFixed(0) + 'kbps/frame)';
            }
            _this.queued_frames--;
            if (_this.queued_frames <= _this.max_queued_frames) {
                if (_this.timer_cleared) {
                    var delta = _this.video.currentTime - _this.prev_video_time;
                    if (_this.target_interval <= delta) {
                        _this._frame_updated();
                        _this._wait_next_frame();
                    }
                    else {
                        _this._wait_next_frame(_this.target_interval - delta);
                    }
                }
            }
        };
        this.decoder.onmessage = function (ev) {
            if (!_this.renderer) {
                if (ev.data instanceof Uint8Array)
                    return;
                var width = _this.decoder_width = ev.data.width;
                var height = _this.decoder_height = ev.data.height;
                _this.canvas_dst.width = width;
                _this.canvas_dst.height = height;
                _this.renderer = new WebGLRenderer();
                _this.renderer.init(_this.canvas_dst, width, height);
                return;
            }
            --_this.decoder_queue;
            if (ev.data.length == 1)
                return;
            var yuv = ev.data;
            var s = _this.decoder_width * _this.decoder_height;
            var y = yuv.subarray(0, s);
            var u = yuv.subarray(s, s * 1.25);
            var v = yuv.subarray(s * 1.25, s * 1.5);
            _this.renderer.render(y, u, v);
        };
    }
    CameraTest.prototype.run = function () {
        var _this = this;
        navigator.getUserMedia = (navigator.getUserMedia || navigator.webkitGetUserMedia || navigator.mozGetUserMedia || navigator.msGetUserMedia);
        navigator.getUserMedia({ video: true, audio: false }, function (strm) {
            var video = _this.video;
            video.src = URL.createObjectURL(strm);
            video.play();
            _this._wait_video_init();
        }, function (err) {
            console.log("failed(navigator.getUserMedia): " + err);
        });
    };
    CameraTest.prototype._wait_video_init = function () {
        var _this = this;
        window.setTimeout(function () {
            if (_this.video.videoHeight == 0) {
                _this._wait_video_init();
            }
            else {
                var scale = parseFloat(document.getElementById("capture_scale").value);
                _this.canvas_src.width = _this.video.videoWidth * scale;
                _this.canvas_src.height = _this.video.videoHeight * scale;
                _this.encoder.postMessage({
                    width: _this.canvas_src.width,
                    height: _this.canvas_src.height,
                    rgb: true,
                    x264: _this._get_x264_cfg()
                });
                _this.encode_start_time = _this.encode_period_time = Date.now();
                _this._wait_next_frame();
            }
        }, 0);
    };
    CameraTest.prototype._wait_next_frame = function (interval) {
        var _this = this;
        if (interval === void 0) { interval = undefined; }
        if (!this.timer_cleared) {
            return;
        }
        if (this.queued_frames > this.max_queued_frames) {
            this.timer_cleared = true;
            return;
        }
        this.timer_cleared = false;
        if (!interval)
            interval = this.target_interval;
        window.setTimeout(function () {
            if (_this.prev_video_time != _this.video.currentTime) {
                _this.prev_video_time = _this.video.currentTime;
                _this._frame_updated();
            }
            _this.timer_cleared = true;
            _this._wait_next_frame();
        }, interval);
    };
    CameraTest.prototype._frame_updated = function () {
        if (this.queued_frames <= this.max_queued_frames) {
            this.canvas_src_ctx.drawImage(this.video, 0, 0, this.video.videoWidth, this.video.videoHeight, 0, 0, this.canvas_src.width, this.canvas_src.height);
            var img = this.canvas_src_ctx.getImageData(0, 0, this.canvas_src.width, this.canvas_src.height);
            this.encoder.postMessage(img.data, [img.data.buffer]);
            this.queued_frames++;
        }
    };
    CameraTest.prototype._get_x264_cfg = function () {
        var ret = {};
        ret["preset"] = document.getElementById("x264presets").value;
        ret["tune"] = document.getElementById("x264tune").value;
        switch (document.getElementById("x264rcmode").value) {
            case "quality":
                ret["crf"] = document.getElementById("x264quality").value;
                break;
            case "bitrate":
                ret["bitrate"] = document.getElementById("x264bitrate").value;
                break;
        }
        return ret;
    };
    return CameraTest;
})();
document.addEventListener("DOMContentLoaded", function (event) {
    var encoder_changed = function () {
        var names = ["x264", "openh264"];
        var cfgs = [
            document.getElementById("x264cfg"),
            undefined
        ];
        var selected_name = document.getElementById("encoder").value;
        for (var i = 0; i < names.length; ++i) {
            var value = (names[i] == selected_name ? "inline" : "none");
            if (cfgs[i])
                cfgs[i].style.display = value;
        }
    };
    var x264_mode_changed = function () {
        var modes = ["quality", "bitrate"];
        var cfgs = [
            document.getElementById("x264quality"),
            document.getElementById("x264bitrate")
        ];
        var selected_mode = document.getElementById("x264rcmode").value;
        for (var i = 0; i < modes.length; ++i) {
            var value = (modes[i] == selected_mode ? "inline" : "none");
            cfgs[i].style.display = value;
        }
    };
    document.getElementById("encoder").addEventListener("change", encoder_changed);
    document.getElementById("x264rcmode").addEventListener("change", x264_mode_changed);
    document.getElementById("start").addEventListener("click", function () {
        new CameraTest().run();
    });
    encoder_changed();
    x264_mode_changed();
});
