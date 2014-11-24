declare function _WelsGetDecoderCapability(ptr: number): number;
declare function _WelsCreateDecoder(ptr: number): number;
declare function _WelsDestroyDecoder(ptr: number): number;
declare function _ISVCDecoderInitialize(ptr: number): number;
declare function _ISVCDecoderUninitialize(ptr: number): number;
declare function _ISVCDecoderDecodeFrame(ptr: number, src_ptr: number, src_len: number, dst_ptr: number, dst_info_ptr: number): number;