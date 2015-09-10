/// <reference path="api.d.ts" />
/// <reference path="utils.ts" />
/// <reference path="camera.ts" />
/// <reference path="renderer.ts" />

class Test {
    src_renderer: Renderer;
    src_stat: HTMLDivElement;
    src_video_info: VideoInfo;
    dst_renderer: Renderer;

    constructor() {}

    init () {
        this._setup_config_ui();
        this.src_renderer = new Renderer(<HTMLCanvasElement>document.getElementById('source'));
        this.dst_renderer = new Renderer(<HTMLCanvasElement>document.getElementById('decoded'));
        this.src_stat = <HTMLDivElement>document.getElementById('src_info');

        document.getElementById('play').addEventListener('click', () => {
            this._play();
        });
        document.getElementById('encdec').addEventListener('click', () => {
            this._encode_and_decode();
        });
    }

    _setup_config_ui() {
        var changed_codec_type = () => {
            var name = this._getSelectElement('codec_type').value;
            var configs = {
                'daala': document.getElementById('daala_config'),
                'libvpx': document.getElementById('libvpx_config'),
                'openH264': document.getElementById('openh264_config'),
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
                    text += " (low)";
                } else if (i == 63) {
                    text += " (high)"
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
            this._update_src_stat(0, 0);
            var counter = 0;
            var fps = 0;
            var start = Date.now();
            var read_frame= () => {
                reader.read().then((ev) => {
                    ++counter;
                    this.src_renderer.draw(ev);
                    window.setTimeout(() => {
                        read_frame();
                    }, 0);

                    var now = Date.now();
                    if (now - start >= 1000) {
                        fps = counter / ((now - start) / 1000);
                        start = now;
                        counter = 0;
                    }
                    this._update_src_stat(ev.timestamp, fps);
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
            var counter = 0;
            var fps = 0;
            var start = Date.now();
            var encode_frame = () => {
                reader.read().then((ev) => {
                    ++counter;
                    this.src_renderer.draw(ev);
                    encoder.encode(ev).then((packet) => {
                        if (packet.data) {
                            decoder.decode(packet).then((frame) => {
                                if (frame.data)
                                    this.dst_renderer.draw(frame);
                                encode_frame();
                            }, (e) => {
                                console.log('failed: decode', e);
                            });
                        } else {
                            encode_frame();
                        }
                    }, (e) => {
                        console.log('failed: encode', e);
                    });
                    var now = Date.now();
                    if (now - start >= 1000) {
                        fps = counter / ((now - start) / 1000);
                        start = now;
                        counter = 0;
                    }
                    this._update_src_stat(ev.timestamp, fps);
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
                this._update_src_stat(0, 0);
                decoder.setup(decoder_cfg, packet).then(() => {
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
        };
        if (cfg.rc_end_usage == 0 || cfg.rc_end_usage == 1)
            cfg['rc_target_bitrate'] = parseInt((<HTMLInputElement>document.getElementById('libvpx_config_rc_bitrate')).value, 10);
        /*if (cfg.rc_end_usage == 2 || cfg.rc_end_usage == 3) {
            cfg['cq_level'] = parseInt(this._getSelectElement('libvpx_config_rc_quality_level').value, 10);
        }
        cfg['rc_min_quantizer'] = parseInt(this._getSelectElement('libvpx_config_rc_min_quantizer').value, 10);
        cfg['rc_max_quantizer'] = parseInt(this._getSelectElement('libvpx_config_rc_max_quantizer').value, 10);*/
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

    _update_src_stat(timestamp: number, fps: number) {
        var txt = this._timestamp_to_string(timestamp)
            + ' (size:' + this.src_video_info.width + 'x' + this.src_video_info.height
            + ', fps:' + fps.toFixed(2) + ')';
        if (!this.src_stat.firstChild)
            this.src_stat.appendChild(document.createTextNode(''));
        this.src_stat.firstChild.textContent = txt;
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
