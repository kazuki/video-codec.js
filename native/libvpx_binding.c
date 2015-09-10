#include <stdlib.h>
#include "libvpx/vpx/vp8cx.h"
#include "libvpx/vpx/vpx_encoder.h"
#include "libvpx/vpx/vpx_decoder.h"

vpx_codec_enc_cfg_t *vpx_codec_enc_create_config(vpx_codec_iface_t *iface,
                                                 unsigned int width, unsigned height,
                                                 unsigned int timebase_num, unsigned int timebase_den)
{
    vpx_codec_enc_cfg_t *cfg = (vpx_codec_enc_cfg_t*)malloc(sizeof(vpx_codec_enc_cfg_t));
    if (vpx_codec_enc_config_default(iface, cfg, 0)) {
        free(cfg);
        return NULL;
    }
    cfg->g_w = width;
    cfg->g_h = height;
    cfg->g_pass = VPX_RC_ONE_PASS;
    cfg->g_threads = 1;
    cfg->g_timebase.num = timebase_num;
    cfg->g_timebase.den = timebase_den;
    return cfg;
}

vpx_codec_ctx_t *allocate_vpx_codec_ctx()
{
    return (vpx_codec_ctx_t*)malloc(sizeof(vpx_codec_ctx_t));
}

vpx_codec_err_t vpx_codec_enc_init2(vpx_codec_ctx_t *  ctx,
                                    vpx_codec_iface_t *  iface,
                                    const vpx_codec_enc_cfg_t *  cfg,
                                    vpx_codec_flags_t  flags)
{
    return vpx_codec_enc_init(ctx, iface, cfg, flags);
}

vpx_codec_err_t vpx_codec_dec_init2(vpx_codec_ctx_t *  ctx,
                                    vpx_codec_iface_t *  iface,
                                    const vpx_codec_dec_cfg_t *  cfg,
                                    vpx_codec_flags_t  flags)
{
    return vpx_codec_dec_init(ctx, iface, cfg, flags);
}
