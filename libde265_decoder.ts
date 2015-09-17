/// <reference path="api.d.ts" />
/// <reference path="typings/emscripten.d.ts" />
class libde265Decoder {
    worker: Worker;

    constructor(worker: Worker) {
        this.worker = worker;
        this.worker.onmessage = (e: MessageEvent) => {
            this._setup(e.data.packet);
        };
    }

    _setup(packet: Packet) {
        this.worker.onmessage = (e: MessageEvent) => {
            this._decode(e.data);
        };
        this.worker.postMessage(<IResult>{status: 0});
    }

    _decode(packet: Packet) {
        this.worker.postMessage(<VideoFrame&IResult>{
            timestamp: 0, width: null, height: null,
            status: 0, data: null, y: null, u: null, v: null
        });
    }
}
new libde265Decoder(this);
