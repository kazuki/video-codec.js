/// <reference path="typings/es6-promise.d.ts" />

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
