/// <reference path="api.d.ts" />
/// <reference path="utils.ts" />
/// <reference path="camera.ts" />
/// <reference path="renderer.ts" />
/// <reference path="img_codec.ts" />

class Test {
    src_renderer: Renderer;
    src_video_info: VideoInfo;
    dst_renderer: Renderer;

    // drop packet emu
    drop_packet = false;

    // stat ui
    stat_cur_fps: HTMLSpanElement;
    stat_avg_fps: HTMLSpanElement;
    stat_in_ts: HTMLSpanElement;
    stat_out_ts: HTMLSpanElement;
    stat_cur_bps: HTMLSpanElement;
    stat_avg_bps: HTMLSpanElement;
    stat_enc_frames: HTMLSpanElement;
    stat_dec_frames: HTMLSpanElement;

    constructor() {}

    init () {
        this._setup_config_ui();
        this.src_renderer = new Renderer(<HTMLCanvasElement>document.getElementById('source'));
        this.dst_renderer = new Renderer(<HTMLCanvasElement>document.getElementById('decoded'));
        this.stat_cur_fps = <HTMLSpanElement>document.getElementById('stat_cur_fps');
        this.stat_avg_fps = <HTMLSpanElement>document.getElementById('stat_avg_fps');
        this.stat_in_ts = <HTMLSpanElement>document.getElementById('stat_in_ts');
        this.stat_out_ts = <HTMLSpanElement>document.getElementById('stat_out_ts');
        this.stat_cur_bps = <HTMLSpanElement>document.getElementById('stat_cur_bitrate');
        this.stat_avg_bps = <HTMLSpanElement>document.getElementById('stat_avg_bitrate');
        this.stat_enc_frames = <HTMLSpanElement>document.getElementById('stat_enc_frames');
        this.stat_dec_frames = <HTMLSpanElement>document.getElementById('stat_dec_frames');

        document.getElementById('play').addEventListener('click', () => {
            this._play();
        });
        document.getElementById('encdec').addEventListener('click', () => {
            this._encode_and_decode();
        });
        document.getElementById('drop_packet').addEventListener('click', () => {
            this.drop_packet = true;
        });
    }

    _setup_config_ui() {
        var changed_codec_type = () => {
            var name = this._getSelectElement('codec_type').value;
            var configs = {
                'daala': document.getElementById('daala_config'),
                'libvpx': document.getElementById('libvpx_config'),
                'openH264': document.getElementById('openh264_config'),
                'image': document.getElementById('image_config'),
            };
            for (var key in configs) {
                configs[key].style.display = 'none';
            }
            if (name == 'libvpx')
                this._changed_libvpx_codec_version();
            configs[name].style.display = 'block';
        };
        document.getElementById('codec_type').addEventListener('change', () => {
            changed_codec_type();
        });
        document.getElementById('libvpx_config_codec').addEventListener('change', () => {
            this._changed_libvpx_codec_version();
        });

        var daala_quant = this._getSelectElement('daala_config_quant');
        for (var i = 0; i <= 511; ++i) {
            var opt = <HTMLOptionElement>document.createElement('option');
            var text = i.toString();
            opt.value = i.toString();
            if (i == 0) {
                text = "0 (lossless)";
            } else if (i == 512) {
                text = "511 (smallest)"
            }
            if (i == 20)
                opt.selected = true;
            opt.appendChild(document.createTextNode(text));
            daala_quant.appendChild(opt);
        }

        var vpx_lag = this._getSelectElement('libvpx_config_lag');
        for (var i = 0; i <= 64; ++i) {
            var opt = <HTMLOptionElement>document.createElement('option');
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
        vpx_q_list.forEach((vpx_q_select, idx) => {
            for (var i = 0; i < 64; ++i) {
                var opt = <HTMLOptionElement>document.createElement('option');
                var text = i.toString();
                opt.value = i.toString();
                if (i == 0) {
                    text += " (high quality)";
                } else if (i == 63) {
                    text += " (low quality)"
                }
                if (idx == 1 && i == 0) {
                    opt.selected = true;
                } else if (idx == 2 && i == 63) {
                    opt.selected = true;
                } else if (idx == 0 && i == 20) {
                    opt.selected = true;
                }
                opt.appendChild(document.createTextNode(text));
                vpx_q_select.appendChild(opt);
            }
        });

        changed_codec_type();
    }

    _changed_libvpx_codec_version() {
        var ver = parseInt(this._getSelectElement('libvpx_config_codec').value, 10);
        var cpuused_range = 8;
        if (ver == 8) {
            cpuused_range = 16;
        }

        var clear_all_children = (element: HTMLElement) => {
            while (element.firstChild)
                element.removeChild(element.firstChild);
        };

        var cpuused_select = this._getSelectElement('libvpx_config_cpuused');
        clear_all_children(cpuused_select);
        for (var i = 0; i <= cpuused_range; ++i) {
            var opt = <HTMLOptionElement>document.createElement('option');
            var txt = i.toString();
            opt.value = txt;
            if (i == 0) {
                txt += " (slow)";
            } else if (i == cpuused_range) {
                txt += " (fast)";
                opt.selected = true;
            }
            opt.appendChild(document.createTextNode(txt));
            cpuused_select.appendChild(opt);
        }
    }

    _play() {
        this._open_reader().then(([reader, video_info]) => {
            this.src_video_info = video_info;
            this.src_renderer.init(video_info);
            this._init_stat();
            var counter = 0, total_frames = 0;
            var cur_fps = 0, avg_fps = 0;
            var start = Date.now();
            var prev = start;
            var read_frame= () => {
                reader.read().then((ev) => {
                    ++counter;
                    ++total_frames;
                    this.src_renderer.draw(ev);
                    window.setTimeout(() => {
                        read_frame();
                    }, 0);

                    var now = Date.now();
                    if (now - prev >= 1000) {
                        cur_fps = counter / ((now - prev) / 1000);
                        avg_fps = total_frames / ((now - start) / 1000);
                        prev = now;
                        counter = 0;
                    }
                    this._update_src_stat(ev.timestamp, cur_fps, avg_fps);
                }, (err) => {
                    console.log('read failed:', err);
                });
            };
            read_frame();
        }, (e) => {
            alert('failed:' + e);
        });
    }

    _encode_and_decode() {
        var [encoder, decoder, encoder_cfg, decoder_cfg] = this._get_encoder_and_decoder();
        this._open_reader().then(([reader, video_info]) => {
            this.src_video_info = video_info;
            this.src_renderer.init(video_info);
            this.dst_renderer.init(video_info);
            var counter = 0, total_frames = 0, decoded_frames = 0;
            var bytes = 0, total_bytes = 0;
            var cur_fps = 0, avg_fps = 0;
            var cur_bps = 0, cur_bpf = 0, avg_bps = 0, avg_bpf = 0;
            var start = Date.now();
            var prev = start;
            var encode_frame = () => {
                reader.read().then((ev) => {
                    ++counter;
                    ++total_frames;
                    this.src_renderer.draw(ev);
                    encoder.encode(ev).then((packet) => {
                        if (this.drop_packet) {
                            this.drop_packet = false;
                            packet.data = null;
                        }
                        if (packet.data) {
                            bytes += packet.data.byteLength;
                            total_bytes += packet.data.byteLength;
                            decoder.decode(packet).then((frame) => {
                                if (frame.data) {
                                    ++decoded_frames;
                                    this._update_dec_stat(frame.timestamp);
                                    this.dst_renderer.draw(frame);
                                }
                                encode_frame();
                            }, (e) => {
                                console.log('failed: decode', e);
                                encode_frame();
                            });
                        } else {
                            encode_frame();
                        }
                    }, (e) => {
                        console.log('failed: encode', e);
                    });
                    var now = Date.now();
                    if (now - prev >= 1000) {
                        cur_fps = counter / ((now - prev) / 1000);
                        avg_fps = total_frames / ((now - start) / 1000);
                        cur_bps = bytes * 8 / ((now - prev) / 1000);
                        avg_bps = total_bytes * 8 / ((now - start) / 1000);
                        cur_bpf = bytes * 8 / counter;
                        avg_bpf = total_bytes * 8 / total_frames;
                        prev = now;
                        counter = 0;
                        bytes = 0;
                    }
                    this._update_src_stat(ev.timestamp, cur_fps, avg_fps,
                                          total_frames, decoded_frames,
                                          cur_bps, cur_bpf, avg_bps, avg_bpf);
                }, (err) => {
                    console.log('read failed:', err);
                });
            };
            encoder.setup({
                width: video_info.width,
                height: video_info.height,
                fps_num: video_info.fps_num,
                fps_den: video_info.fps_den,
                params: encoder_cfg
            }).then((packet) => {
                decoder.setup(decoder_cfg, packet).then(() => {
                    this._init_stat();
                    encode_frame();
                }, (e) => {
                    console.log('failed: decoder init', e);
                });
            }, (e) => {
                console.log('failed: encoder init', e);
            });
        }, (e) => {
            alert('failed:' + e);
        });
    }

    _get_encoder_and_decoder(): [IEncoder, IDecoder, any, any] {
        var libname = this._getSelectElement('codec_type').value;
        if (libname == 'daala') {
            return [
                new Encoder('daala_encoder.js'),
                new Decoder('daala_decoder.js'),
                {
                    'keyframe_rate': parseInt(this._getSelectElement('daala_config_kf').value, 10),
                    'quant': parseInt(this._getSelectElement('daala_config_quant').value, 10),
                    'complexity': parseInt(this._getSelectElement('daala_config_complexity').value, 10),
                    'use_activity_masking': (<HTMLInputElement>document.getElementById('daala_config_activity_masking')).checked ? 1 : 0,
                    'qm': parseInt(this._getSelectElement('daala_config_qm').value, 10),
                    'mc_use_chroma': (<HTMLInputElement>document.getElementById('daala_config_mc_use_chroma')).checked ? 1 : 0,
                    'mv_res_min': parseInt(this._getSelectElement('daala_config_mv_res_min').value, 10),
                    'mv_level_min': parseInt(this._getSelectElement('daala_config_mv_level_min').value, 10),
                    'mv_level_max': parseInt(this._getSelectElement('daala_config_mv_level_max').value, 10),
                    'mc_use_satd': (<HTMLInputElement>document.getElementById('daala_config_mc_use_chroma')).checked ? 1 : 0,
                },
                {}
            ];
        } else if (libname == 'libvpx') {
            var ver = parseInt(this._getSelectElement('libvpx_config_codec').value, 10);
            return [
                new Encoder('vpx_encoder.js'),
                new Decoder('vpx_decoder.js'),
                this._build_libvpx_encoder_config(ver),
                {
                    'version': ver,
                }
            ];
        } else if (libname == 'openH264') {
            return [
                new Encoder('openh264_encoder.js'),
                new Decoder('openh264_decoder.js'),
                {
                    'usage': parseInt(this._getSelectElement('openh264_config_usage').value, 10),
                    'rc_mode': parseInt(this._getSelectElement('openh264_config_rc_mode').value, 10),
                    'bitrate': parseInt((<HTMLInputElement>document.getElementById('openh264_config_bitrate')).value, 10),
                    'ref_frames': parseInt((<HTMLInputElement>document.getElementById('openh264_config_ref_frames')).value, 10),
                    'complexity': parseInt(this._getSelectElement('openh264_config_complexity').value, 10),
                    'entropy_coding': parseInt(this._getSelectElement('openh264_config_entropy').value, 10),
                    'denoise': (<HTMLInputElement>document.getElementById('openh264_config_denoise')).checked,
                    'background_detection': (<HTMLInputElement>document.getElementById('openh264_config_bg_detect')).checked,
                    'adaptive_quant': (<HTMLInputElement>document.getElementById('openh264_config_adaptive_quant')).checked,
                    'scene_change_detect': (<HTMLInputElement>document.getElementById('openh264_config_scene_detect')).checked,
                    'keyframe_interval': parseInt((<HTMLInputElement>document.getElementById('openh264_config_kf')).value, 10),
                },
                {}
            ];
        } else if (libname == 'libde265') {
            return [
                new Encoder('libde265_encoder.js'),
                new Decoder('libde265_decoder.js'),
                {},
                {}
            ];
        } else if (libname == 'image') {
            return [
                new MotionImageEncoder(),
                new MotionImageDecoder(),
                {
                    'type': (<HTMLInputElement>document.getElementById('image_config_type')).value,
                    'quality': parseFloat((<HTMLInputElement>document.getElementById('image_config_quality')).value),
                },
                {}
            ];
        } else {
            return [null, null, null, null];
        }
    }

    _build_libvpx_encoder_config(ver: number): any {
        var cfg = {
            'version': ver,
            'cpuused': parseInt(this._getSelectElement('libvpx_config_cpuused').value, 10),
            'rc_end_usage': parseInt(this._getSelectElement('libvpx_config_rc_mode').value, 10),
            'lag_in_frames': parseInt(this._getSelectElement('libvpx_config_lag').value, 10),
            'kf_mode': 0,
            'kf_min_dist': 1,
            'kf_max_dist': parseInt((<HTMLInputElement>document.getElementById('libvpx_config_kf_max')).value, 10),
        };
        if (cfg.rc_end_usage <= 2)
            cfg['rc_target_bitrate'] = parseInt((<HTMLInputElement>document.getElementById('libvpx_config_rc_bitrate')).value, 10);
        if (cfg.rc_end_usage == 2 || cfg.rc_end_usage == 3) {
            cfg['cq_level'] = parseInt(this._getSelectElement('libvpx_config_rc_quality_level').value, 10);
        }
        cfg['rc_min_quantizer'] = parseInt(this._getSelectElement('libvpx_config_rc_min_quantizer').value, 10);
        cfg['rc_max_quantizer'] = parseInt(this._getSelectElement('libvpx_config_rc_max_quantizer').value, 10);
        return cfg;
    }

    _open_reader(): Promise<[IReader, VideoInfo]> {
        var resolution = this._getSelectElement('camera-resolution').value.split('x');
        var width = parseInt(resolution[0]), height = parseInt(resolution[1]);
        return new Promise((resolve, reject) => {
            var reader = new Camera();
            reader.open({
                width: width,
                height: height,
                fps: parseInt(this._getSelectElement('camera-framerate').value, 10)
            }).then((video_info) => {
                resolve([reader, video_info]);
            }, reject);
        });
    }

    _init_stat() {
        document.getElementById('stat_frame_size').textContent =
            this.src_video_info.width.toString() + 'x' +
            this.src_video_info.height.toString();
        this._update_src_stat(0, 0, 0);
    }

    _update_src_stat(timestamp: number, cur_fps: number, avg_fps: number,
                     encoded_frames?: number, decoded_frames?: number,
                     cur_bps?: number, cur_bpf?: number, avg_bps?: number, avg_bpf?: number) {
        this.stat_in_ts.textContent = this._timestamp_to_string(timestamp);
        this.stat_cur_fps.textContent = cur_fps.toFixed(2);
        this.stat_avg_fps.textContent = avg_fps.toFixed(2);
        if (encoded_frames && decoded_frames) {
            this.stat_enc_frames.textContent = encoded_frames.toString();
            this.stat_dec_frames.textContent = decoded_frames.toString();
        }
        if (cur_bps && cur_bpf && avg_bps && avg_bpf) {
            this.stat_cur_bps.textContent =
                (cur_bps / 1000).toFixed(0) + ' [kbps] / ' +
                (cur_bpf / 1000).toFixed(0) + ' [kbits/frame]';
            this.stat_avg_bps.textContent =
                (avg_bps / 1000).toFixed(0) + ' [kbps] / ' +
                (avg_bpf / 1000).toFixed(0) + ' [kbits/frame]';
        }
    }

    _update_dec_stat(timestamp: number) {
        this.stat_out_ts.textContent = this._timestamp_to_string(timestamp);
    }

    _timestamp_to_string(timestamp: number) {
        var m = Math.floor(timestamp / 60);
        var s = ('0' + (Math.floor(timestamp) % 60)).substr(-2);
        var ms = ('00' + (timestamp * 1000).toFixed(0)).substr(-3);
        return m + ':' + s + '.' + ms;
    }

    _getSelectElement(id: string): HTMLSelectElement {
        return <HTMLSelectElement>document.getElementById(id);
    }
}

document.addEventListener('DOMContentLoaded', () => {
    var main = new Test();
    main.init();
});
