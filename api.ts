/// <reference path="typings/es6-promise.d.ts" />

interface VideoInfo {
    width: number;
    height: number;
    fps_num: number;
    fps_den: number;
}

interface EncoderConfig extends VideoInfo {
    params: any;
}

interface VideoFrame {
    timestamp: number;
    width: number;
    height: number;
    data: ArrayBuffer;
    y: Uint8ClampedArray;
    u: Uint8ClampedArray;
    v: Uint8ClampedArray;
    transferable: boolean;
}

enum FrameType {
    Key = 1,
    IDR = 1,
    I = 2,
    P = 3,
    B = 4,
    Unknown = 255
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
    frame_type: FrameType;
}

interface IResult {
    status: number,
    reason?: string,
}

interface IEncoder {
    setup(cfg: EncoderConfig): Promise<Packet>;
    encode(frame: VideoFrame): Promise<Packet>;
}

interface IDecoder {
    setup(cfg: any, packet: Packet): Promise<any>;
    decode(packet: Packet): Promise<VideoFrame>;
}
