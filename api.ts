/// <reference path="typings/es6-promise.d.ts" />
/// <reference path="typings/es6-Uint8ClampedArray.d.ts" />

interface VideoInfo {
    width: number;
    height: number;
    fps_num: number;
    fps_den: number;
}

interface VideoFrame {
    timestamp: number;
    data: ArrayBuffer;
    y: Uint8ClampedArray;
    u: Uint8ClampedArray;
    v: Uint8ClampedArray;
    transferable: boolean;
}

interface ReadEventArgs extends VideoFrame {
    ended: boolean;
}

interface IReader {
    open(args: any): Promise<VideoInfo>;
    read(): Promise<ReadEventArgs>;
    close(): void;
}

interface IRenderer {
    init(info: VideoInfo): void;
    draw(frame: VideoFrame): void;
}

interface Packet {
    data: ArrayBuffer;
}

interface IEncoder {
    setup(cfg: VideoInfo): Promise<any>;
    encode(frame: VideoFrame): Promise<Packet>;
}

interface IDecoder {
    decode(packet: Packet): Promise<VideoFrame>;
}

class Encoder implements IEncoder {
    worker: Worker;

    constructor(worker_script_path: string) {
        this.worker = new Worker(worker_script_path);
    }

    setup(cfg: VideoInfo): Promise<any> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (ev) => {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                } else {
                    reject(ev.data);
                }
            };
            this.worker.postMessage(cfg);
        });
    }

    encode(frame: VideoFrame): Promise<Packet> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (ev) => {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                } else {
                    reject(ev.data);
                }
            };
            if (frame.transferable) {
                this.worker.postMessage(frame, [frame.data]);
            } else {
                this.worker.postMessage(frame);
            }
        });
    }
}

class Decoder implements IDecoder {
    worker: Worker;

    constructor(worker_script_path: string) {
        this.worker = new Worker(worker_script_path);
    }

    decode(packet: Packet): Promise<VideoFrame> {
        return new Promise((resolve, reject) => {
            this.worker.onmessage = (ev) => {
                if (ev.data.status == 0) {
                    resolve(ev.data);
                } else {
                    reject(ev.data);
                }
            };
            this.worker.postMessage(packet, [packet.data]);
        });
    }
}
