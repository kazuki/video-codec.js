/// <reference path="asm.d.ts" />
var __extends = this.__extends || function (d, b) {
    for (var p in b) if (b.hasOwnProperty(p)) d[p] = b[p];
    function __() { this.constructor = d; }
    __.prototype = b.prototype;
    d.prototype = new __();
};
var VideoInfo = (function () {
    function VideoInfo() {
    }
    return VideoInfo;
})();
var OpenEventArgs = (function (_super) {
    __extends(OpenEventArgs, _super);
    function OpenEventArgs() {
        _super.apply(this, arguments);
    }
    return OpenEventArgs;
})(VideoInfo);
var ReadEventArgs = (function () {
    function ReadEventArgs() {
    }
    return ReadEventArgs;
})();
var Y4MReader = (function () {
    function Y4MReader() {
        this.read_offset = -1;
        this.MAX_Y4M_HEADER_SIZE = 128;
        this.reader = new FileReader();
    }
    Y4MReader.prototype.open = function (file, callback) {
        var _this = this;
        this.file = file;
        this.reader.onloadend = function (ev) {
            var args = new OpenEventArgs();
            var err_handler = function () {
                args.is_success = false;
                callback(_this, args);
            };
            if (_this.reader.readyState != _this.reader.DONE) {
                err_handler();
                return;
            }
            var view = new Uint8Array(_this.reader.result);
            if (String.fromCharCode.apply(null, view.subarray(0, 9)) != "YUV4MPEG2") {
                err_handler();
                return;
            }
            view = view.subarray(9 + 1);
            var header = null;
            for (var i = 0; i < view.length; ++i) {
                if (view[i] == 10) {
                    header = String.fromCharCode.apply(null, view.subarray(0, i));
                    _this.read_offset = 10 + i + 1;
                    break;
                }
            }
            if (header == null) {
                err_handler();
                return;
            }
            header.split(' ').forEach(function (value) {
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
            _this.header = args;
            callback(_this, args);
        };
        this.reader.readAsArrayBuffer(this.file.slice(0, this.MAX_Y4M_HEADER_SIZE));
    };
    Y4MReader.prototype.read = function (callback) {
        var _this = this;
        var byte_size = 6 + (this.header.width * this.header.height * 12 / 8);
        this.reader.onloadend = function (ev) {
            var args = new ReadEventArgs();
            args.is_success = false;
            args.is_eof = false;
            if (_this.reader.readyState != _this.reader.DONE) {
                callback(_this, args);
                return;
            }
            var view = new Uint8Array(_this.reader.result);
            if (view.length != byte_size) {
                if (view.length == 0) {
                    args.is_eof = true;
                }
                callback(_this, args);
                return;
            }
            if (String.fromCharCode.apply(null, view.subarray(0, 6)) != "FRAME\n") {
                console.log("unknown frame header: " + String.fromCharCode.apply(null, view.subarray(0, 6)));
                callback(_this, args);
                return;
            }
            view = view.subarray(6);
            args.is_success = true;
            args.y = view.subarray(0, _this.header.width * _this.header.height);
            args.u = view.subarray(args.y.length, args.y.length + _this.header.width * _this.header.height / 4);
            args.v = view.subarray(args.y.length + args.u.length, args.y.length + args.u.length * 2);
            callback(_this, args);
        };
        this.reader.readAsArrayBuffer(this.file.slice(this.read_offset, this.read_offset + byte_size));
        this.read_offset += byte_size;
    };
    Y4MReader.prototype.close = function () {
    };
    Y4MReader.prototype.get_video_info = function () {
        return this.header;
    };
    return Y4MReader;
})();
var OpenH264Reader = (function () {
    function OpenH264Reader() {
        this.io_size = 1024 * 512;
        this.buffer = new Uint8Array(this.io_size * 2);
        this.worker = new Worker('openh264_worker.js');
        this.decoded_frames = new Array();
        this.video_info = null;
    }
    OpenH264Reader.prototype.open = function (file, callback) {
        var _this = this;
        this.file = file;
        this.io_offset = 0;
        this.io_inflight = false;
        this.buffer_off = this.buffer_filled = 0;
        this.callback = this.callback_io = null;
        this.slice_idx = 0;
        this.reader = new FileReader();
        this.reader.onloadend = function (ev) {
            _this.io_inflight = false;
            if (_this.reader.readyState != _this.reader.DONE) {
                console.log('I/O Error');
                throw 'I/O Error';
            }
            var view = new Uint8Array(_this.reader.result);
            _this.buffer.set(view, _this.buffer_filled);
            _this.buffer_filled += view.length;
            if (_this.callback_io) {
                var tmp = _this.callback_io;
                _this.callback_io = null;
                _this.read(tmp);
            }
        };
        this.worker.onmessage = function (e) {
            if (e.data instanceof Uint8Array) {
                _this.read(_this.callback);
                return;
            }
            _this._recv_video_info(e.data);
        };
        this._read_next();
        var args = new OpenEventArgs();
        args.is_success = true;
        callback(this, args);
    };
    OpenH264Reader.prototype._recv_video_info = function (data) {
        var _this = this;
        this.video_info = new VideoInfo();
        this.video_info.sar_width = this.video_info.sar_height = this.video_info.fps_num = this.video_info.fps_den = 1;
        this.video_info.width = data.width;
        this.video_info.height = data.height;
        if (this.video_info.width == 1440 && this.video_info.height == 1080) {
            this.video_info.sar_width = 4;
            this.video_info.sar_height = 3;
        }
        this.worker.onmessage = function (e) {
            _this._recv_frame(e.data);
        };
    };
    OpenH264Reader.prototype._recv_frame = function (data) {
        if (this.callback) {
            if (data.length == 1) {
                if (data[0] == 0) {
                    this.read(this.callback);
                }
                return;
            }
            var tmp = this.callback;
            this.callback = null;
            tmp(this, this._setup_frame(data));
        }
        else {
            this.decoded_frames.push(data);
        }
    };
    OpenH264Reader.prototype._setup_frame = function (raw) {
        var args = new ReadEventArgs();
        var w = this.video_info.width, h = this.video_info.height;
        args.is_success = true;
        args.y = raw.subarray(0, w * h);
        args.u = raw.subarray(w * h, w * h * 1.25);
        args.v = raw.subarray(w * h * 1.25, w * h * 1.5);
        return args;
    };
    OpenH264Reader.prototype.read = function (callback) {
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
    };
    OpenH264Reader.prototype.close = function () {
    };
    OpenH264Reader.prototype.get_video_info = function () {
        return this.video_info;
    };
    OpenH264Reader.prototype._read_next = function () {
        if (this.io_inflight || this.io_size < this.buffer_filled || this.file.size <= this.io_offset)
            return;
        this.io_inflight = true;
        var off = this.io_offset;
        this.io_offset += this.io_size;
        this.reader.readAsArrayBuffer(this.file.slice(off, off + this.io_size));
    };
    return OpenH264Reader;
})();
