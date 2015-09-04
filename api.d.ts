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
    setup(cfg: VideoInfo): Promise<Packet>;
    encode(frame: VideoFrame): Promise<Packet>;
}

interface IDecoder {
    setup(cfg: any, packet: Packet): Promise<any>;
    decode(packet: Packet): Promise<VideoFrame>;
}
