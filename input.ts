/// <reference path="asm.d.ts" />

class VideoInfo {
    width: number;
    height: number;
    fps_num: number;
    fps_den: number;
    sar_width: number;
    sar_height: number;
}

class OpenEventArgs extends VideoInfo {
    is_success: boolean;
}

class ReadEventArgs {
    is_success: boolean;
    is_eof: boolean;
    y: Uint8Array;
    u: Uint8Array;
    v: Uint8Array;
}

interface VideoReader {
    open(file: File, callback: (any, OpenEventArgs)=>void): void;
    read(callback: (any, ReadEventArgs)=>void): void;
    close(): void;

    get_video_info(): VideoInfo;
}

class Y4MReader implements VideoReader {
    file: File;
    reader: FileReader;
    header: VideoInfo;
    read_offset = -1;
    MAX_Y4M_HEADER_SIZE = 128;
    
    constructor() {
        this.reader = new FileReader();
    }
    
    open(file: File, callback: (any, OpenEventArgs)=>void): void {
        this.file = file;
        this.reader.onloadend = (ev) => {
            var args = new OpenEventArgs();
            var err_handler = () => {
                args.is_success = false;
                callback (this, args);
            };
            if (this.reader.readyState != this.reader.DONE) {
                err_handler();
                return;
            }
            var view = new Uint8Array(this.reader.result);
            if (String.fromCharCode.apply(null, view.subarray(0, 9)) != "YUV4MPEG2") {
                err_handler();
                return;
            }
            view = view.subarray(9 + 1);

            var header = null;
            for (var i = 0; i < view.length; ++i) {
                if (view[i] == 10) {
                    header = String.fromCharCode.apply(null, view.subarray(0, i));
                    this.read_offset = 10 + i + 1;
                    break;
                }
            }
            if (header == null) {
                err_handler();
                return;
            }

            header.split(' ').forEach(value => {
                switch (value[0]) {
                case 'W':
                    args.width = parseInt(value.substr(1));
                    break;
                case 'H':
                    args.height = parseInt(value.substr(1));
                    break;
                case 'C':
                    if (value.length < 4 || value.substr(1, 3) != "420") {
                        // YUV420 only
                        err_handler();
                        return;
                    }
                    break;
                case 'I':
                    if (value[1] == "t" || value[1] == "b" || value[1] == "m") {
                        // interlace not supported
                        err_handler();
                        return;
                    }
                    break;
                case 'F':
                    var items = value.substr(1).split(':');
                    args.fps_num = parseInt(items[0]);
                    args.fps_den = parseInt(items[1]);
                    break;
                case 'A':
                    var items = value.substr(1).split(':');
                    args.sar_width = parseInt(items[0]);
                    args.sar_height = parseInt(items[1]);
                    break;
                }
            });


            args.is_success = true;
            this.header = args;
            callback(this, args);
        };
        this.reader.readAsArrayBuffer(this.file.slice(0, this.MAX_Y4M_HEADER_SIZE));
    }
    
    read(callback: (any, ReadEventArgs)=>void): void {
        var byte_size = 6 + (this.header.width * this.header.height * 12 / 8);
        
        this.reader.onloadend = (ev) => {
            var args = new ReadEventArgs();
            args.is_success = false;
            args.is_eof = false;
            
            if (this.reader.readyState != this.reader.DONE) {
                callback (this, args);
                return;
            }
            var view = new Uint8Array(this.reader.result);
            if (view.length != byte_size) {
                if (view.length == 0) {
                    args.is_eof = true;
                }
                callback (this, args);
                return;
            }
            if (String.fromCharCode.apply(null, view.subarray(0, 6)) != "FRAME\n") {
                console.log("unknown frame header: " + 
                            String.fromCharCode.apply(null, view.subarray(0, 6)));
                callback (this, args);
                return;
            }
            view = view.subarray(6);

            args.is_success = true;
            args.y = view.subarray(0, this.header.width * this.header.height);
            args.u = view.subarray(args.y.length, args.y.length + this.header.width * this.header.height / 4);
            args.v = view.subarray(args.y.length + args.u.length, args.y.length + args.u.length * 2);
            callback (this, args);
        }
        
        this.reader.readAsArrayBuffer(this.file.slice(this.read_offset,
                                                      this.read_offset + byte_size));
        this.read_offset += byte_size;
    }
    
    close(): void {
    }

    get_video_info(): VideoInfo {
        return this.header;
    }
}

class OpenH264Reader implements VideoReader {
    file: File;
    reader: FileReader;
    worker: Worker;
    video_info: VideoInfo;

    io_size = 1024 * 512;
    io_offset: number;
    io_inflight: boolean;
    buffer: Uint8Array;
    buffer_off: number;
    buffer_filled: number;

    callback: (any, ReadEventArgs)=>void;
    callback_io: (any, ReadEventArgs)=>void;
    slice_idx: number;
    decoded_frames: Array<Uint8Array>;

    constructor() {
        this.buffer = new Uint8Array(this.io_size * 2);
        this.worker = new Worker('openh264_worker.js');
        this.decoded_frames = new Array<any>();
        this.video_info = null;
    }

    open(file: File, callback: (any, OpenEventArgs)=>void): void {
        this.file = file;
        this.io_offset = 0;
        this.io_inflight = false;
        this.buffer_off = this.buffer_filled = 0;
        this.callback = this.callback_io = null;
        this.slice_idx = 0;
        this.reader = new FileReader();
        this.reader.onloadend = (ev) => {
            this.io_inflight = false;
            if (this.reader.readyState != this.reader.DONE) {
                console.log('I/O Error');
                throw 'I/O Error';
            }
            var view = new Uint8Array(this.reader.result);
            this.buffer.set(view, this.buffer_filled);
            this.buffer_filled += view.length;
            if (this.callback_io) {
                var tmp = this.callback_io;
                this.callback_io = null;
                this.read(tmp);
            }
        };
        this.worker.onmessage = (e: MessageEvent) => {
            if (e.data instanceof Uint8Array) {
                this.read(this.callback);
                return;
            }
            this._recv_video_info (e.data);
        }
        this._read_next();

        var args = new OpenEventArgs();
        args.is_success = true;
        callback(this, args);
    }

    _recv_video_info (data: any) {
        this.video_info = new VideoInfo();
        this.video_info.sar_width = this.video_info.sar_height =
            this.video_info.fps_num = this.video_info.fps_den = 1;
        this.video_info.width = data.width;
        this.video_info.height = data.height;
        if (this.video_info.width == 1440 && this.video_info.height == 1080) {
            this.video_info.sar_width = 4;
            this.video_info.sar_height = 3;
        }
        this.worker.onmessage = (e: MessageEvent) => {
            this._recv_frame(<Uint8Array>e.data);
        };
    }

    _recv_frame(data: Uint8Array) : void {
        if (this.callback) {
            if (data.length == 1) {
                if (data[0] == 0) {
                    this.read(this.callback);
                }
                return;
            }
            var tmp = this.callback;
            this.callback = null;
            tmp (this, this._setup_frame(data));
        } else {
            this.decoded_frames.push(data);
        }
    }

    _setup_frame(raw: Uint8Array) : ReadEventArgs {
        var args = new ReadEventArgs();
        var w = this.video_info.width, h = this.video_info.height;
        args.is_success = true;
        args.y = raw.subarray(0, w * h);
        args.u = raw.subarray(w * h, w * h * 1.25);
        args.v = raw.subarray(w * h * 1.25, w * h * 1.5);
        return args;
    }
    
    read(callback: (any, ReadEventArgs)=>void): void {
        if (this.decoded_frames.length > 0) {
            var args = this._setup_frame(this.decoded_frames[0]);
            this.decoded_frames.shift();
            callback(this, args);
            if (this.decoded_frames.length > 2)
                return;
        }

        if (this.buffer_off == this.buffer_filled && this.io_offset >= this.file.size) {
            var args = new ReadEventArgs();
            args.is_success = true;
            args.is_eof = true;
            callback(this, args);
            return;
        }

        var nalu_end = -1;
        for (var i = this.buffer_off + 3; i < this.buffer_filled; ++i) {
            if (this.buffer[i] != 0 || this.buffer[i + 1] != 0)
                continue;
            if (this.buffer[i + 2] == 1 || (this.buffer[i + 2] == 0 && this.buffer[i + 3] == 1)) {
                nalu_end = i;
                break;
            }
        }
        if (nalu_end < 0) {
            if (this.io_inflight) {
                this.callback_io = callback;
                return;
            }
            nalu_end = this.buffer_filled;
        }

        this.callback = callback;
        this.worker.postMessage(this.buffer.subarray(this.buffer_off, nalu_end));

        this.buffer_off = nalu_end;
        ++this.slice_idx;
        if ((this.buffer_filled - this.buffer_off) <= this.io_size && this.io_offset < this.file.size) {
            this.buffer.set(this.buffer.subarray(this.buffer_off));
            this.buffer_filled -= this.buffer_off;
            this.buffer_off = 0;
            this._read_next();
        }
    }
    
    close(): void {
    }

    get_video_info(): VideoInfo {
        return this.video_info;
    }

    _read_next() {
        if (this.io_inflight || this.io_size < this.buffer_filled || this.file.size <= this.io_offset) return;
        this.io_inflight = true;
        var off = this.io_offset;
        this.io_offset += this.io_size;
        this.reader.readAsArrayBuffer(this.file.slice(off, off + this.io_size));
    }
}
