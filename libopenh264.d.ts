declare function _WelsGetDecoderCapability(ptr: number): number;
declare function _WelsCreateDecoder(ptr: number): number;
declare function _WelsDestroyDecoder(ptr: number): number;
declare function _ISVCDecoderInitialize(ptr: number): number;
declare function _ISVCDecoderUninitialize(ptr: number): number;
declare function _ISVCDecoderDecodeFrame(ptr: number, src_ptr: number, src_len: number, dst_ptr: number, dst_info_ptr: number): number;

declare function _WelsCreateSVCEncoder(ptr: number): number;
declare function _ISVCEncoderGetDefaultParams(ptr: number, params: number): number;
declare function _ISVCEncoderInitialize(ptr: number, params: number): number;
declare function _ISVCEncoderInitializeExt(ptr: number, params: number): number;
declare function _ISVCEncoderEncodeFrame(ptr: number, pic: number, fbi: number): number;

declare function _SizeOfSEncParamExt(): number;
declare function _SizeOfSFrameBSInfo(): number; 
declare function _SizeOfSSourcePicture(): number;
declare function _SetupSEncParamExt(ptr: number, width: number, height: number,
                                    target_bitrate: number): void;

declare function _rgba_to_yuv420 (width: number, height: number,
                                  rgba: number, y: number, u: number, v: number): void;
declare function _yuv420_to_rgba (width: number, height: number,
                                  y: number, u: number, v: number,
                                  stride_y: number, stride_uv: number,
                                  rgba: number): void;
