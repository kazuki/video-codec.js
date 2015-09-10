#include <cstdio>
#include <cstddef>

#include "../native/libvpx/vpx/vp8cx.h"
#include "../native/openh264/codec/api/svc/codec_app_def.h"

int main() {
    printf("std types\n");
    printf("  sizeof(void*): %d\n", sizeof(void*));
    printf("  sizeof(char): %d\n", sizeof(char));
    printf("  sizeof(short): %d\n", sizeof(short));
    printf("  sizeof(int): %d\n", sizeof(int));
    printf("  sizeof(long): %d\n", sizeof(long));
    printf("  sizeof(long long): %d\n", sizeof(long long));
    printf("  sizeof(bool): %d\n", sizeof(bool));
    printf("  sizeof(float): %d\n", sizeof(float));
    printf("  sizeof(double): %d\n", sizeof(double));
    printf("libvpx\n");
    printf("  VP8E_SET_CQ_LEVEL: %d\n", VP8E_SET_CQ_LEVEL);
    printf("  vpx_codec_enc_cfg_t::lag_in_frames: %d\n", offsetof(vpx_codec_enc_cfg_t, g_lag_in_frames));
    printf("  vpx_codec_enc_cfg_t::rc_end_usage: %d\n", offsetof(vpx_codec_enc_cfg_t, rc_end_usage));
    printf("  vpx_codec_enc_cfg_t::rc_target_bitrate: %d\n", offsetof(vpx_codec_enc_cfg_t, rc_target_bitrate));
    printf("  vpx_codec_enc_cfg_t::rc_buf_optimal_sz: %d\n", offsetof(vpx_codec_enc_cfg_t, rc_buf_optimal_sz));
    printf("  vpx_codec_enc_cfg_t::kf_mode: %d\n", offsetof(vpx_codec_enc_cfg_t, kf_mode));
    printf("openh264\n");
    printf("  SEncParamExt::iComplexityMode: %d\n", offsetof(SEncParamExt, iComplexityMode));
    printf("  SEncParamExt::iEntropyCodingModeFlag: %d\n", offsetof(SEncParamExt, iEntropyCodingModeFlag));
    printf("  SEncParamExt::iMaxBitrate: %d\n", offsetof(SEncParamExt, iMaxBitrate));
    printf("  SEncParamExt::bEnableDenoise: %d\n", offsetof(SEncParamExt, bEnableDenoise));
    printf("  SEncParamExt::bEnableBackgroundDetection: %d\n", offsetof(SEncParamExt, bEnableBackgroundDetection));
    printf("  SEncParamExt::sSpatialLayers[0].iSpatialBitrate: %d\n", offsetof(SEncParamExt, sSpatialLayers[0].iSpatialBitrate));
}
