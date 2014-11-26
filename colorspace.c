#include <stdint.h>
void rgba_to_yuv420 (int width, int height, int frame_idx, uint8_t *rgba, uint8_t *y, uint8_t *u, uint8_t *v)
{
    frame_idx = frame_idx & 1;
    for (int i = 0; i < height; ++i) {
        for (int j = 0; j < width; ++j) {
            uint8_t r = rgba[j * 4 + 0], g = rgba[j * 4 + 1], b = rgba[j * 4 + 2];
            y[j] = (uint8_t)(0.257f * r + 0.504f * g + 0.098f * b + 16);
        }
        if ((i & 1) == 0) {
            for (int j = 0; j < width / 2; ++j) {
                uint8_t r0 = rgba[j * 4 * 2 + 0], g0 = rgba[j * 4 * 2 + 1], b0 = rgba[j * 4 * 2 + 2];
                uint8_t r1 = rgba[j * 4 * 2 + 4], g1 = rgba[j * 4 * 2 + 5], b1 = rgba[j * 4 * 2 + 6];
                u[j] = (uint8_t)(-0.148f * r0 - 0.291f * g0 + 0.439f * b0 + 128);
                v[j] = (uint8_t)( 0.439f * r1 - 0.368f * g1 - 0.071f * b1 + 128);
            }
            u += width / 2;
            v += width / 2;
        }
        rgba += width * 4;
        y += width;
    }
}
