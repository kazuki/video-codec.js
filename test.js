/// <reference path="api.d.ts" />
var Encoder = (function () {
    function Encoder(worker_script_path) {
        this.worker = new Worker(worker_script_path);
    }
    Encoder.prototype.setup = function (cfg) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                }
                else {
                    reject(ev.data);
                }
            };
            _this.worker.postMessage(cfg);
        });
    };
    Encoder.prototype.encode = function (frame) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                }
                else {
                    reject(ev.data);
                }
            };
            if (frame.transferable) {
                _this.worker.postMessage(frame, [frame.data]);
            }
            else {
                _this.worker.postMessage(frame);
            }
        });
    };
    return Encoder;
})();
var Decoder = (function () {
    function Decoder(worker_script_path) {
        this.worker = new Worker(worker_script_path);
    }
    Decoder.prototype.setup = function (cfg, packet) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                }
                else {
                    reject(ev.data);
                }
            };
            _this.worker.postMessage({
                params: cfg,
                packet: packet
            });
        });
    };
    Decoder.prototype.decode = function (packet) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            _this.worker.onmessage = function (ev) {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                }
                else {
                    reject(ev.data);
                }
            };
            _this.worker.postMessage(packet, [packet.data]);
        });
    };
    return Decoder;
})();
/// <reference path="api.d.ts" />
/// <reference path="typings/MediaStream.d.ts" />
var Camera = (function () {
    function Camera() {
        this._video = null;
        this._cvs = null;
        this._buf = null;
    }
    Camera.prototype.open = function (args) {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var video_constraints = true;
            var callback = function (strm) {
                _this._fps = args['fps'] || 5;
                _this._sec_per_frame = 1 / _this._fps;
                _this._first_timestamp = _this._prev_frame_index = -1;
                _this._video = document.createElement('video');
                _this._video.src = URL.createObjectURL(strm);
                _this._video.play();
                _this._video.addEventListener('loadedmetadata', function (e) {
                    var w = _this._width = _this._video.videoWidth;
                    var h = _this._height = _this._video.videoHeight;
                    _this._cvs = document.createElement('canvas');
                    _this._cvs.width = w;
                    _this._cvs.height = h;
                    _this._buf = new ArrayBuffer(w * h * 1.5);
                    _this._y = new Uint8ClampedArray(_this._buf, 0, w * h);
                    _this._u = new Uint8ClampedArray(_this._buf, w * h, w * h / 4);
                    _this._v = new Uint8ClampedArray(_this._buf, w * h * 1.25, w * h / 4);
                    resolve({
                        width: w,
                        height: h,
                        fps_num: _this._fps,
                        fps_den: 1
                    });
                });
            };
            if (navigator.mediaDevices && navigator.mediaDevices.getUserMedia) {
                if (args['width'] && args['height']) {
                    video_constraints = {
                        width: args['width'],
                        height: args['height']
                    };
                }
                navigator.mediaDevices.getUserMedia({
                    audio: false,
                    video: video_constraints
                }).then(callback, reject);
            }
            else {
                navigator.getUserMedia = (navigator.getUserMedia ||
                    navigator.webkitGetUserMedia ||
                    navigator.mozGetUserMedia ||
                    navigator.msGetUserMedia);
                if (args['width'] && args['height']) {
                    video_constraints = {
                        mandatory: {
                            minWidth: args['width'],
                            minHeight: args['height'],
                            maxWidth: args['width'],
                            maxHeight: args['height']
                        }
                    };
                }
                navigator.getUserMedia({
                    audio: false,
                    video: video_constraints
                }, callback, reject);
            }
        });
    };
    Camera.prototype.read = function () {
        var _this = this;
        return new Promise(function (resolve, reject) {
            var ctx = _this._cvs.getContext('2d');
            var timestamp = _this._video.currentTime;
            if (_this._first_timestamp == -1) {
                _this._first_timestamp = timestamp;
                _this._next_timestamp = timestamp;
            }
            if (timestamp < _this._next_timestamp) {
                window.setTimeout(function () {
                    _this.read().then(resolve, reject);
                }, (_this._next_timestamp - timestamp) * 1000);
                return;
            }
            var logic_frame_idx = Math.round((timestamp - _this._first_timestamp) / _this._sec_per_frame);
            if (logic_frame_idx <= _this._prev_frame_index)
                logic_frame_idx = _this._prev_frame_index + 1;
            _this._prev_frame_index = logic_frame_idx;
            _this._next_timestamp = (logic_frame_idx + 1) * _this._sec_per_frame;
            ctx.drawImage(_this._video, 0, 0, _this._width, _this._height, 0, 0, _this._width, _this._height);
            var img = ctx.getImageData(0, 0, _this._width, _this._height);
            var rgba = img.data;
            for (var y = 0, j = 0; y < img.height; y += 2) {
                var p = y * img.width;
                for (var x = 0; x < img.width; x += 2, ++j) {
                    var pp = p + x;
                    var pw = pp + img.width;
                    var p0 = pp * 4;
                    var p1 = pw * 4;
                    var r0 = rgba[p0], g0 = rgba[p0 + 1], b0 = rgba[p0 + 2];
                    var r1 = rgba[p0 + 4], g1 = rgba[p0 + 5], b1 = rgba[p0 + 6];
                    var r2 = rgba[p1], g2 = rgba[p1 + 1], b2 = rgba[p1 + 2];
                    var r3 = rgba[p1 + 4], g3 = rgba[p1 + 5], b3 = rgba[p1 + 6];
                    _this._y[pp] = Math.floor(0.257 * r0 + 0.504 * g0 + 0.098 * b0 + 16);
                    _this._y[pp + 1] = Math.floor(0.257 * r1 + 0.504 * g1 + 0.098 * b1 + 16);
                    _this._y[pw] = Math.floor(0.257 * r2 + 0.504 * g2 + 0.098 * b2 + 16);
                    _this._y[pw + 1] = Math.floor(0.257 * r3 + 0.504 * g3 + 0.098 * b3 + 16);
                    _this._u[j] = Math.floor(-0.148 * r0 - 0.291 * g0 + 0.439 * b0 + 128);
                    _this._v[j] = Math.floor(0.439 * r1 - 0.368 * g1 - 0.071 * b1 + 128);
                }
            }
            resolve({
                timestamp: timestamp,
                ended: false,
                data: _this._buf,
                y: _this._y,
                u: _this._u,
                v: _this._v,
                transferable: false
            });
        });
    };
    Camera.prototype.close = function () {
    };
    return Camera;
})();
/// <reference path="api.d.ts" />
var Renderer = (function () {
    function Renderer(canvas) {
        this._canvas = canvas;
    }
    Renderer.prototype.init = function (info) {
        this._canvas.width = info.width;
        this._canvas.height = info.height;
    };
    Renderer.prototype.draw = function (frame) {
        var ctx = this._canvas.getContext('2d');
        var img = ctx.getImageData(0, 0, this._canvas.width, this._canvas.height);
        var rgba = img.data;
        for (var y = 0; y < img.height; y += 2) {
            var p0 = y * img.width;
            var p1 = p0 + img.width;
            for (var x = 0; x < img.width; x += 2) {
                var y0 = 1.164 * (frame.y[p0 + x] - 16);
                var y1 = 1.164 * (frame.y[p0 + x + 1] - 16);
                var y2 = 1.164 * (frame.y[p1 + x] - 16);
                var y3 = 1.164 * (frame.y[p1 + x + 1] - 16);
                var u = frame.u[p0 / 4 + x / 2], v = frame.v[p0 / 4 + x / 2];
                var t0 = 1.596 * (v - 128);
                var t1 = -0.391 * (u - 128) - 0.813 * (v - 128);
                var t2 = 2.018 * (u - 128);
                rgba[(p0 + x) * 4] = y0 + t0;
                rgba[(p0 + x) * 4 + 1] = y0 + t1;
                rgba[(p0 + x) * 4 + 2] = y0 + t2;
                rgba[(p0 + x) * 4 + 3] = 255;
                rgba[(p0 + x) * 4 + 4] = y1 + t0;
                rgba[(p0 + x) * 4 + 5] = y1 + t1;
                rgba[(p0 + x) * 4 + 6] = y1 + t2;
                rgba[(p0 + x) * 4 + 7] = 255;
                rgba[(p1 + x) * 4] = y2 + t0;
                rgba[(p1 + x) * 4 + 1] = y2 + t1;
                rgba[(p1 + x) * 4 + 2] = y2 + t2;
                rgba[(p1 + x) * 4 + 3] = 255;
                rgba[(p1 + x) * 4 + 4] = y3 + t0;
                rgba[(p1 + x) * 4 + 5] = y3 + t1;
                rgba[(p1 + x) * 4 + 6] = y3 + t2;
                rgba[(p1 + x) * 4 + 7] = 255;
            }
        }
        ctx.putImageData(img, 0, 0);
    };
    return Renderer;
})();
/// <reference path="api.d.ts" />
/// <reference path="utils.ts" />
/// <reference path="camera.ts" />
/// <reference path="renderer.ts" />
var Test = (function () {
    function Test() {
    }
    Test.prototype.init = function () {
        var _this = this;
        this._setup_config_ui();
        this.src_renderer = new Renderer(document.getElementById('source'));
        this.dst_renderer = new Renderer(document.getElementById('decoded'));
        this.src_stat = document.getElementById('src_info');
        document.getElementById('play').addEventListener('click', function () {
            _this._play();
        });
        document.getElementById('encdec').addEventListener('click', function () {
            _this._encode_and_decode();
        });
    };
    Test.prototype._setup_config_ui = function () {
        var _this = this;
        var changed_codec_type = function () {
            var name = _this._getSelectElement('codec_type').value;
            var configs = {
                'daala': document.getElementById('daala_config'),
                'libvpx': document.getElementById('libvpx_config'),
                'openH264': document.getElementById('openh264_config')
            };
            for (var key in configs) {
                configs[key].style.display = 'none';
            }
            if (name == 'libvpx')
                _this._changed_libvpx_codec_version();
            configs[name].style.display = 'block';
        };
        document.getElementById('codec_type').addEventListener('change', function () {
            changed_codec_type();
        });
        document.getElementById('libvpx_config_codec').addEventListener('change', function () {
            _this._changed_libvpx_codec_version();
        });
        var daala_quant = this._getSelectElement('daala_config_quant');
        for (var i = 0; i <= 511; ++i) {
            var opt = document.createElement('option');
            var text = i.toString();
            opt.value = i.toString();
            if (i == 0) {
                text = "0 (lossless)";
            }
            else if (i == 512) {
                text = "511 (smallest)";
            }
            if (i == 20)
                opt.selected = true;
            opt.appendChild(document.createTextNode(text));
            daala_quant.appendChild(opt);
        }
        var vpx_lag = this._getSelectElement('libvpx_config_lag');
        for (var i = 0; i <= 64; ++i) {
            var opt = document.createElement('option');
            var text = i.toString();
            opt.value = i.toString();
            if (i == 0) {
                text = "0 (disable)";
            }
            if (i == 0)
                opt.selected = true;
            opt.appendChild(document.createTextNode(text));
            vpx_lag.appendChild(opt);
        }
        var vpx_q_list = [
            this._getSelectElement('libvpx_config_rc_quality_level'),
            this._getSelectElement('libvpx_config_rc_min_quantizer'),
            this._getSelectElement('libvpx_config_rc_max_quantizer')
        ];
        vpx_q_list.forEach(function (vpx_q_select, idx) {
            for (var i = 0; i < 64; ++i) {
                var opt = document.createElement('option');
                var text = i.toString();
                opt.value = i.toString();
                if (i == 0) {
                    text += " (low)";
                }
                else if (i == 63) {
                    text += " (high)";
                }
                if (idx == 1 && i == 0) {
                    opt.selected = true;
                }
                else if (idx == 2 && i == 63) {
                    opt.selected = true;
                }
                else if (idx == 0 && i == 20) {
                    opt.selected = true;
                }
                opt.appendChild(document.createTextNode(text));
                vpx_q_select.appendChild(opt);
            }
        });
        changed_codec_type();
    };
    Test.prototype._changed_libvpx_codec_version = function () {
        var ver = parseInt(this._getSelectElement('libvpx_config_codec').value, 10);
        var cpuused_range = 8;
        if (ver == 8) {
            cpuused_range = 16;
        }
        var clear_all_children = function (element) {
            while (element.firstChild)
                element.removeChild(element.firstChild);
        };
        var cpuused_select = this._getSelectElement('libvpx_config_cpuused');
        clear_all_children(cpuused_select);
        for (var i = 0; i <= cpuused_range; ++i) {
            var opt = document.createElement('option');
            var txt = i.toString();
            opt.value = txt;
            if (i == 0) {
                txt += " (slow)";
            }
            else if (i == cpuused_range) {
                txt += " (fast)";
                opt.selected = true;
            }
            opt.appendChild(document.createTextNode(txt));
            cpuused_select.appendChild(opt);
        }
    };
    Test.prototype._play = function () {
        var _this = this;
        this._open_reader().then(function (_a) {
            var reader = _a[0], video_info = _a[1];
            _this.src_video_info = video_info;
            _this.src_renderer.init(video_info);
            _this._update_src_stat(0, 0);
            var counter = 0;
            var fps = 0;
            var start = Date.now();
            var read_frame = function () {
                reader.read().then(function (ev) {
                    ++counter;
                    _this.src_renderer.draw(ev);
                    window.setTimeout(function () {
                        read_frame();
                    }, 0);
                    var now = Date.now();
                    if (now - start >= 1000) {
                        fps = counter / ((now - start) / 1000);
                        start = now;
                        counter = 0;
                    }
                    _this._update_src_stat(ev.timestamp, fps);
                }, function (err) {
                    console.log('read failed:', err);
                });
            };
            read_frame();
        }, function (e) {
            alert('failed:' + e);
        });
    };
    Test.prototype._encode_and_decode = function () {
        var _this = this;
        var _a = this._get_encoder_and_decoder(), encoder = _a[0], decoder = _a[1], encoder_cfg = _a[2], decoder_cfg = _a[3];
        this._open_reader().then(function (_a) {
            var reader = _a[0], video_info = _a[1];
            _this.src_video_info = video_info;
            _this.src_renderer.init(video_info);
            _this.dst_renderer.init(video_info);
            var counter = 0;
            var fps = 0;
            var start = Date.now();
            var encode_frame = function () {
                reader.read().then(function (ev) {
                    ++counter;
                    _this.src_renderer.draw(ev);
                    encoder.encode(ev).then(function (packet) {
                        if (packet.data) {
                            decoder.decode(packet).then(function (frame) {
                                if (frame.data)
                                    _this.dst_renderer.draw(frame);
                                encode_frame();
                            }, function (e) {
                                console.log('failed: decode', e);
                            });
                        }
                        else {
                            encode_frame();
                        }
                    }, function (e) {
                        console.log('failed: encode', e);
                    });
                    var now = Date.now();
                    if (now - start >= 1000) {
                        fps = counter / ((now - start) / 1000);
                        start = now;
                        counter = 0;
                    }
                    _this._update_src_stat(ev.timestamp, fps);
                }, function (err) {
                    console.log('read failed:', err);
                });
            };
            encoder.setup({
                width: video_info.width,
                height: video_info.height,
                fps_num: video_info.fps_num,
                fps_den: video_info.fps_den,
                params: encoder_cfg
            }).then(function (packet) {
                _this._update_src_stat(0, 0);
                decoder.setup(decoder_cfg, packet).then(function () {
                    encode_frame();
                }, function (e) {
                    console.log('failed: decoder init', e);
                });
            }, function (e) {
                console.log('failed: encoder init', e);
            });
        }, function (e) {
            alert('failed:' + e);
        });
    };
    Test.prototype._get_encoder_and_decoder = function () {
        var libname = this._getSelectElement('codec_type').value;
        if (libname == 'daala') {
            return [
                new Encoder('daala_encoder.js'),
                new Decoder('daala_decoder.js'),
                {
                    'quant': parseInt(this._getSelectElement('daala_config_quant').value, 10),
                    'complexity': parseInt(this._getSelectElement('daala_config_complexity').value, 10),
                    'use_activity_masking': document.getElementById('daala_config_activity_masking').checked ? 1 : 0,
                    'qm': parseInt(this._getSelectElement('daala_config_qm').value, 10),
                    'mc_use_chroma': document.getElementById('daala_config_mc_use_chroma').checked ? 1 : 0,
                    'mv_res_min': parseInt(this._getSelectElement('daala_config_mv_res_min').value, 10),
                    'mv_level_min': parseInt(this._getSelectElement('daala_config_mv_level_min').value, 10),
                    'mv_level_max': parseInt(this._getSelectElement('daala_config_mv_level_max').value, 10),
                    'mc_use_satd': document.getElementById('daala_config_mc_use_chroma').checked ? 1 : 0
                },
                {}
            ];
        }
        else if (libname == 'libvpx') {
            var ver = parseInt(this._getSelectElement('libvpx_config_codec').value, 10);
            return [
                new Encoder('vpx_encoder.js'),
                new Decoder('vpx_decoder.js'),
                this._build_libvpx_encoder_config(ver),
                {
                    'version': ver
                }
            ];
        }
        else if (libname == 'openH264') {
            return [
                new Encoder('openh264_encoder.js'),
                new Decoder('openh264_decoder.js'),
                {
                    'usage': parseInt(this._getSelectElement('openh264_config_usage').value, 10),
                    'rc_mode': parseInt(this._getSelectElement('openh264_config_rc_mode').value, 10),
                    'bitrate': parseInt(document.getElementById('openh264_config_bitrate').value, 10),
                    'ref_frames': parseInt(document.getElementById('openh264_config_ref_frames').value, 10),
                    'complexity': parseInt(this._getSelectElement('openh264_config_complexity').value, 10),
                    'entropy_coding': parseInt(this._getSelectElement('openh264_config_entropy').value, 10),
                    'denoise': document.getElementById('openh264_config_denoise').checked,
                    'background_detection': document.getElementById('openh264_config_bg_detect').checked,
                    'adaptive_quant': document.getElementById('openh264_config_adaptive_quant').checked,
                    'scene_change_detect': document.getElementById('openh264_config_scene_detect').checked
                },
                {}
            ];
        }
        else if (libname == 'libde265') {
            return [
                new Encoder('libde265_encoder.js'),
                new Decoder('libde265_decoder.js'),
                {},
                {}
            ];
        }
        else {
            return [null, null, null, null];
        }
    };
    Test.prototype._build_libvpx_encoder_config = function (ver) {
        var cfg = {
            'version': ver,
            'cpuused': parseInt(this._getSelectElement('libvpx_config_cpuused').value, 10),
            'rc_end_usage': parseInt(this._getSelectElement('libvpx_config_rc_mode').value, 10),
            'lag_in_frames': parseInt(this._getSelectElement('libvpx_config_lag').value, 10)
        };
        if (cfg.rc_end_usage == 0 || cfg.rc_end_usage == 1)
            cfg['rc_target_bitrate'] = parseInt(document.getElementById('libvpx_config_rc_bitrate').value, 10);
        /*if (cfg.rc_end_usage == 2 || cfg.rc_end_usage == 3) {
            cfg['cq_level'] = parseInt(this._getSelectElement('libvpx_config_rc_quality_level').value, 10);
        }
        cfg['rc_min_quantizer'] = parseInt(this._getSelectElement('libvpx_config_rc_min_quantizer').value, 10);
        cfg['rc_max_quantizer'] = parseInt(this._getSelectElement('libvpx_config_rc_max_quantizer').value, 10);*/
        return cfg;
    };
    Test.prototype._open_reader = function () {
        var _this = this;
        var resolution = this._getSelectElement('camera-resolution').value.split('x');
        var width = parseInt(resolution[0]), height = parseInt(resolution[1]);
        return new Promise(function (resolve, reject) {
            var reader = new Camera();
            reader.open({
                width: width,
                height: height,
                fps: parseInt(_this._getSelectElement('camera-framerate').value, 10)
            }).then(function (video_info) {
                resolve([reader, video_info]);
            }, reject);
        });
    };
    Test.prototype._update_src_stat = function (timestamp, fps) {
        var txt = this._timestamp_to_string(timestamp)
            + ' (size:' + this.src_video_info.width + 'x' + this.src_video_info.height
            + ', fps:' + fps.toFixed(2) + ')';
        if (!this.src_stat.firstChild)
            this.src_stat.appendChild(document.createTextNode(''));
        this.src_stat.firstChild.textContent = txt;
    };
    Test.prototype._timestamp_to_string = function (timestamp) {
        var m = Math.floor(timestamp / 60);
        var s = ('0' + (Math.floor(timestamp) % 60)).substr(-2);
        var ms = ('00' + (timestamp * 1000).toFixed(0)).substr(-3);
        return m + ':' + s + '.' + ms;
    };
    Test.prototype._getSelectElement = function (id) {
        return document.getElementById(id);
    };
    return Test;
})();
document.addEventListener('DOMContentLoaded', function () {
    var main = new Test();
    main.init();
});
