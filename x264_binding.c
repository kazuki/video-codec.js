#include <stdint.h>
#include <stddef.h>
#include <stdlib.h>
#include "x264.h"

x264_param_t *x264_encoder_param_create (int width, int height, int fps_num, int fps_den,
                                         const char *preset, const char *tune)
{
    x264_param_t *param = (x264_param_t*)malloc(sizeof(x264_param_t));
    x264_param_default (param);
    if (x264_param_default_preset (param, preset, tune) < 0)
        return 0;
    if (x264_param_apply_profile (param, "baseline") < 0)
        return 0;
    param->i_width = width;
    param->i_height = height;
    param->i_fps_num = fps_num;
    param->i_fps_den = fps_den;
    return param;
}

void x264_encoder_param_free (x264_param_t *p)
{
    free (p);
}

x264_t *x264_encoder_open2 (x264_param_t *param)
{
    return x264_encoder_open (param);
}

x264_picture_t *x264_picture_create()
{
    return (x264_picture_t*)malloc(sizeof(x264_picture_t));
}

void x264_picture_free(x264_picture_t *pic)
{
    free(pic);
}

void x264_picture_setup (x264_picture_t *pic, int i_csp, int i_pts, int stride_0, int stride_1, int stride_2,
                         uint8_t *y, uint8_t *u, uint8_t *v)
{
    pic->i_pts = i_pts;
    pic->img.i_csp = i_csp;
    pic->img.i_plane = 3;
    pic->img.i_stride[0] = stride_0;
    pic->img.i_stride[1] = stride_1;
    pic->img.i_stride[2] = stride_2;
    pic->img.plane[0] = y;
    pic->img.plane[1] = u;
    pic->img.plane[2] = v;
    pic->img.plane[3] = 0;
}

int madvise(void *addr, size_t length, int advice) {
    return 0;
}
