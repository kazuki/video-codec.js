#include <stdint.h>

void rgba_to_yuv420 (int width, int height, uint8_t *rgba, uint8_t *y, uint8_t *u, uint8_t *v)
{
    for (int i = 0; i < height; ++i) {
        if ((i & 1) == 0) {
            for (int j = 0; j < width / 2; ++j) {
                uint8_t r0 = rgba[j * 4 * 2 + 0], g0 = rgba[j * 4 * 2 + 1], b0 = rgba[j * 4 * 2 + 2];
                uint8_t r1 = rgba[j * 4 * 2 + 4], g1 = rgba[j * 4 * 2 + 5], b1 = rgba[j * 4 * 2 + 6];
                y[j * 2 + 0] = (uint8_t)(0.257f * r0 + 0.504f * g0 + 0.098f * b0 + 16);
                y[j * 2 + 1] = (uint8_t)(0.257f * r1 + 0.504f * g1 + 0.098f * b1 + 16);
                u[j] = (uint8_t)(-0.148f * r0 - 0.291f * g0 + 0.439f * b0 + 128);
                v[j] = (uint8_t)( 0.439f * r1 - 0.368f * g1 - 0.071f * b1 + 128);
            }
            u += width / 2;
            v += width / 2;
        } else {
            for (int j = 0; j < width; ++j) {
                uint8_t r = rgba[j * 4 + 0], g = rgba[j * 4 + 1], b = rgba[j * 4 + 2];
                y[j] = (uint8_t)(0.257f * r + 0.504f * g + 0.098f * b + 16);
            }
        }
        rgba += width * 4;
        y += width;
    }
}

void yuv420_to_rgba (int width, int height, uint8_t *y, uint8_t *u, uint8_t *v, int stride_y, int stride_uv, uint8_t *rgba)
{
    for (int i = 0; i < height; ++i) {
        for (int j = 0; j < width; ++j) {
            int x = 1.164f * ((float)y[j] - 16.f);
            int r = x + 1.596 * ((int)v[j >> 1] - 128);
            int g = x - 0.391 * ((int)u[j >> 1] - 128) - 0.813 * ((int)v[j >> 1] - 128);
            int b = x + 2.018 * ((int)u[j >> 1] - 128);
            rgba[j * 4 + 0] = (uint8_t)(r > 255 ? 255 : r < 0 ? 0 : r);
            rgba[j * 4 + 1] = (uint8_t)(g > 255 ? 255 : g < 0 ? 0 : g);
            rgba[j * 4 + 2] = (uint8_t)(b > 255 ? 255 : b < 0 ? 0 : b);
            rgba[j * 4 + 3] = 255;
        }
        rgba += width * 4;
        y += stride_y;
        if ((i & 1) == 1) {
            u += stride_uv;
            v += stride_uv;
        }
    }
}
