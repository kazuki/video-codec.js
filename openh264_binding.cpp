#include "codec_api.h"

extern "C" {

long ISVCDecoderInitialize(ISVCDecoder *decoder)
{
    SDecodingParam sDecParam = {0};
    sDecParam.eOutputColorFormat = videoFormatI420;
    sDecParam.uiTargetDqLayer = 255; //UCHAR_MAX
    sDecParam.eEcActiveIdc = ERROR_CON_SLICE_COPY;
    sDecParam.sVideoProperty.eVideoBsType = VIDEO_BITSTREAM_AVC;
    return decoder->Initialize(&sDecParam);
}

long ISVCDecoderUninitialize(ISVCDecoder *decoder)
{
    return decoder->Uninitialize();
}

DECODING_STATE ISVCDecoderDecodeFrame(ISVCDecoder *decoder, unsigned char *src,
                                      int srcLen, unsigned char **dst, SBufferInfo *pDstInfo)
{
    return decoder->DecodeFrame2(src, srcLen, dst, pDstInfo);
}

}

#if 0
DecoderWrapper::DecoderWrapper()
{
    WelsCreateDecoder(&(this->_handle));
}

DecoderWrapper::~DecoderWrapper()
{
    WelsDestroyDecoder(this->_handle);
}

long DecoderWrapper::Initialize()
{
    SDecodingParam sDecParam = {0};
    sDecParam.sVideoProperty.eVideoBsType = VIDEO_BITSTREAM_AVC;
    return this->_handle->Initialize(&sDecParam);
}

long DecoderWrapper::Uninitialize()
{
    return this->_handle->Uninitialize();
}
#endif
