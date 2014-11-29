declare function _x264_encoder_param_create(width: number, height: number,
                                            fps_num: number, fps_den: number,
                                            preset: number, tune: number): number;
declare function _x264_encoder_param_free(handle: number): void;
declare function _x264_encoder_open2(ptr: number): number;
declare function _x264_encoder_encode(ptr: number, pp_nal: number, pi_nal: number,
                                      pic_in: number, pic_out: number): number;
declare function _x264_encoder_delayed_frames(ptr: number): number;
declare function _x264_encoder_close(ptr: number): number;
declare function _x264_picture_create (): number;
declare function _x264_picture_free (ptr: number): void;
declare function _x264_picture_init (ptr: number): number;
declare function _x264_picture_setup (ptr: number, i_csp: number, i_pts: number,
                                      stride0: number, stride1: number, stride2: number,
                                      y: number, u: number, v: number): void;
declare function _x264_param_parse (ptr: number, name: number, value: number): number;
declare function _rgba_to_yuv420 (width: number, height: number,
                                  rgba: number, y: number, u: number, v: number): void;
