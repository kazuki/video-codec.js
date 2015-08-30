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
        var [encoder, decoder, encoder_cfg] = this._get_encoder_and_decoder();
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
            }).then((packet) => {
                this._update_src_stat(0, 0);
                decoder.setup(packet).then(() => {
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

    _get_encoder_and_decoder(): [IEncoder, IDecoder, any] {
        var libname = (<HTMLSelectElement>document.getElementById('codec_type')).value;
        if (libname == 'daala') {
            return [
                new Encoder('daala_encoder.js'),
                new Decoder('daala_decoder.js'),
                {}
            ];
        } else if (libname == 'libvpx') {
            return [
                new Encoder('vpx_encoder.js'),
                new Decoder('vpx_decoder.js'),
                {}
            ];
        } else if (libname == 'openH264') {
            return [
                new Encoder('openh264_encoder.js'),
                new Decoder('openh264_decoder.js'),
                {}
            ];
        } else {
            return [null, null, null];
        }
    }

    _open_reader(): Promise<[IReader, VideoInfo]> {
        var resolution = (<HTMLSelectElement>document.getElementById('camera-resolution')).value.split('x');
        var width = parseInt(resolution[0]), height = parseInt(resolution[1]);
        return new Promise((resolve, reject) => {
            var reader = new Camera();
            reader.open({
                width: width,
                height: height
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
}

document.addEventListener('DOMContentLoaded', () => {
    var main = new Test();
    main.init();
});
