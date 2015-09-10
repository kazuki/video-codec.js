#include <stdio.h>
#include <stddef.h>
#include <vpx/vp8cx.h>

int main() {
    printf("pointer-size: %d\n", sizeof(void*));
    printf("VP8E_SET_CQ_LEVEL: %d\n", VP8E_SET_CQ_LEVEL);
    printf("vpx_codec_enc_cfg_t::lag_in_frames: %d\n", offsetof(vpx_codec_enc_cfg_t, g_lag_in_frames));
    printf("vpx_codec_enc_cfg_t::rc_end_usage: %d\n", offsetof(vpx_codec_enc_cfg_t, rc_end_usage));
    printf("vpx_codec_enc_cfg_t::rc_target_bitrate: %d\n", offsetof(vpx_codec_enc_cfg_t, rc_target_bitrate));
    printf("vpx_codec_enc_cfg_t::rc_buf_optimal_sz: %d\n", offsetof(vpx_codec_enc_cfg_t, rc_buf_optimal_sz));
    printf("vpx_codec_enc_cfg_t::kf_mode: %d\n", offsetof(vpx_codec_enc_cfg_t, kf_mode));
}
