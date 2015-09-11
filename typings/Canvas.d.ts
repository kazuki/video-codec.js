interface HTMLCanvasElement {
    toBlob(callback: HTMLCanvasElementToBlobCallback, type?: string, ...args: any[]): void;
}
interface HTMLCanvasElementToBlobCallback {
    (blob: Blob): void
}
