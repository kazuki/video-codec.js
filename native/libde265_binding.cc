#include "libde265/image.h"
#include "libde265/encoder/encoder-context.h"

extern "C" {

void libde265_encoder_hack(encoder_context *ctx, int w, int h)
{
    ctx->sps.set_defaults();
    ctx->sps.set_resolution(w, h);
    ctx->sps.compute_derived_values();
}

de265_image *libde265_image_allocate(encoder_context *ctx, int w, int h)
{
    de265_image *img = new de265_image;
    img->alloc_image(w, h, de265_chroma_420, &ctx->sps, false,
                     NULL, ctx, 0, NULL, false);
    return img;
}

uint8_t *libde265_image_get_plane(de265_image *img, int idx)
{
    return img->get_image_plane(idx);
}

int libde265_image_get_stride(de265_image *img, int idx)
{
    return img->get_image_stride(idx);
}

}
