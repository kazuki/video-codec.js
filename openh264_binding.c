#include "codec_api.h"

long ISVCDecoderInitialize(ISVCDecoder *decoder)
{
    SDecodingParam sDecParam = {0};
    sDecParam.eOutputColorFormat = videoFormatI420;
    sDecParam.uiTargetDqLayer = 255; //UCHAR_MAX
    sDecParam.eEcActiveIdc = ERROR_CON_SLICE_COPY;
    sDecParam.sVideoProperty.eVideoBsType = VIDEO_BITSTREAM_SVC;
    return (*decoder)->Initialize(decoder, &sDecParam);
}

long ISVCDecoderUninitialize(ISVCDecoder *decoder)
{
    return (*decoder)->Uninitialize(decoder);
}

DECODING_STATE ISVCDecoderDecodeFrame(ISVCDecoder *decoder, unsigned char *src,
                                      int srcLen, unsigned char **dst, SBufferInfo *pDstInfo)
{
    return (*decoder)->DecodeFrame2(decoder, src, srcLen, dst, pDstInfo);
}

int ISVCEncoderInitialize(ISVCEncoder *encoder, const SEncParamBase* pParam)
{
    return (*encoder)->Initialize(encoder, pParam);
}

int ISVCEncoderInitializeExt(ISVCEncoder *encoder, const SEncParamExt* pParam)
{
    return (*encoder)->InitializeExt(encoder, pParam);
}

int ISVCEncoderGetDefaultParams(ISVCEncoder *encoder, SEncParamExt* pParam)
{
    return (*encoder)->GetDefaultParams(encoder, pParam);
}

int ISVCEncoderUninitialize(ISVCEncoder *encoder)
{
    return (*encoder)->Uninitialize(encoder);
}

int ISVCEncoderEncodeFrame(ISVCEncoder *encoder, const SSourcePicture* kpSrcPic, SFrameBSInfo* pBsInfo)
{
    return (*encoder)->EncodeFrame(encoder, kpSrcPic, pBsInfo);
}

int ISVCEncoderEncodeParameterSets(ISVCEncoder *encoder, SFrameBSInfo* pBsInfo)
{
    return (*encoder)->EncodeParameterSets(encoder, pBsInfo);
}

int ISVCEncoderForceIntraFrame(ISVCEncoder *encoder, bool bIDR)
{
    return (*encoder)->ForceIntraFrame(encoder, bIDR);
}

int ISVCEncoderSetOption(ISVCEncoder *encoder, ENCODER_OPTION eOptionId, void* pOption)
{
    return (*encoder)->SetOption(encoder, eOptionId, pOption);
}

int ISVCEncoderGetOption(ISVCEncoder *encoder, ENCODER_OPTION eOptionId, void* pOption)
{
    return (*encoder)->GetOption(encoder, eOptionId, pOption);
}

int SizeOfSEncParamExt() { return sizeof(SEncParamExt); }
int SizeOfSFrameBSInfo() { return sizeof(SFrameBSInfo); }
int SizeOfSSourcePicture() { return sizeof(SSourcePicture); }

void SetupSEncParamExt (SEncParamExt *param, int width, int height, int target_bitrate)
{
    param->iPicWidth = width;
    param->iPicHeight = height;
    param->iTargetBitrate = target_bitrate;
    param->iMaxBitrate = 1 << 31;
    param->iRCMode = RC_QUALITY_MODE; //RC_BITRATE_MODE;
    param->fMaxFrameRate = 24.0f;

    param->bEnableFrameSkip = 0;
    param->bEnableBackgroundDetection = 1;
    param->bEnableSceneChangeDetect = 1;
    //param->bEnableLongTermReference = 0;
    //param->bEnableDenoise = 0;
    //param->iLtrMarkPeriod = 30;
    //param->uiIntraPeriod = 320;
    param->bEnableSpsPpsIdAddition = 1;
    param->bPrefixNalAddingCtrl = 0;
    param->iComplexityMode = MEDIUM_COMPLEXITY;
    param->iTemporalLayerNum = 1;
    param->iSpatialLayerNum = 1;
    param->sSpatialLayers[0].uiProfileIdc = PRO_BASELINE;
    param->sSpatialLayers[0].iVideoWidth = width;
    param->sSpatialLayers[0].iVideoHeight = height;
    param->sSpatialLayers[0].iSpatialBitrate = target_bitrate;
    param->sSpatialLayers[0].iMaxSpatialBitrate = 1 << 31;
}
