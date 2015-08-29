#include "openh264/codec/api/svc/codec_api.h"

int WelsSetupSVCEncoder(ISVCEncoder *encoder, int width, int height, float maxFrameRate, int targetBitrate)
{
    SEncParamExt param;
    (*encoder)->GetDefaultParams (encoder, &param);
    param.iUsageType = CAMERA_VIDEO_REAL_TIME;
    param.fMaxFrameRate = maxFrameRate;
    param.iPicWidth = width;
    param.iPicHeight = height;
    param.iTargetBitrate = targetBitrate;
    param.iSpatialLayerNum = 1;
    param.sSpatialLayers[0].iVideoWidth = param.iPicWidth;
    param.sSpatialLayers[0].iVideoHeight = param.iPicHeight;
    param.sSpatialLayers[0].fFrameRate = param.fMaxFrameRate;
    param.sSpatialLayers[0].iSpatialBitrate = param.iTargetBitrate;
    param.sSpatialLayers[0].uiProfileIdc = PRO_BASELINE;
    return (*encoder)->InitializeExt (encoder, &param);
}

int SizeOfSFrameBSInfo()
{
    return sizeof(SFrameBSInfo);
}
int SizeOfSSourcePicture()
{
    return sizeof(SSourcePicture);
}
int SizeOfSBufferInfo()
{
    return sizeof(SBufferInfo);
}

void SetupSSourcePicture(SSourcePicture *pic, int width, int height, void *data)
{
    pic->iPicWidth = width;
    pic->iPicHeight = height;
    pic->iColorFormat = videoFormatI420;
    pic->iStride[0] = pic->iPicWidth;
    pic->iStride[1] = pic->iStride[2] = pic->iPicWidth >> 1;
    pic->pData[0] = (unsigned char*)data;
    pic->pData[1] = pic->pData[0] + width * height;
    pic->pData[2] = pic->pData[1] + (width * height >> 2);
}

void SetSSourcePictureTimestamp(SSourcePicture *pic, float timestamp_in_sec)
{
    pic->uiTimeStamp = (long long)(timestamp_in_sec * 1000.0f);
}

int WelsSVCEncoderEncodeFrame(ISVCEncoder *encoder, const SSourcePicture* kpSrcPic, SFrameBSInfo* pBsInfo)
{
    return (*encoder)->EncodeFrame(encoder, kpSrcPic, pBsInfo);
}

int WelsInitializeDecoder(ISVCDecoder *decoder)
{
    SDecodingParam sDecParam = {0};
    sDecParam.eOutputColorFormat = videoFormatI420;
    sDecParam.sVideoProperty.eVideoBsType = VIDEO_BITSTREAM_AVC;
    return (*decoder)->Initialize(decoder, &sDecParam);
}

DECODING_STATE WelsDecoderDecodeFrame(ISVCDecoder *decoder, unsigned char *src,
                                      int srcLen, unsigned char **dst, SBufferInfo *pDstInfo)
{
    return (*decoder)->DecodeFrameNoDelay(decoder, src, srcLen, dst, pDstInfo);
}
