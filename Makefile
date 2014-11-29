TARGETS=libopenh264.js libx264.js input.js test.js renderer.js camera.js openh264_worker.js x264_worker.js openh264_encoder.js
EMCC_OPTS:=-O3 --llvm-lto 1 --memory-init-file 0 -s LIBRARY_DEPS_TO_AUTOEXPORT=[] -s INVOKE_RUN=0
#EMCC_OPTS:=-O1 --llvm-lto 1 --memory-init-file 0 -s LIBRARY_DEPS_TO_AUTOEXPORT=[] -s INVOKE_RUN=0

COLORSPACE_EXPORTS:='_rgba_to_yuv420','_yuv420_to_rgba'

OPENH264_FLAGS:=-Iopenh264/codec/api/svc -s TOTAL_MEMORY=268435456
OPENH264_FILES:=openh264/libopenh264.a openh264_binding.c colorspace.c
OPENH264_EXPORTS:='_WelsCreateDecoder','_WelsDestroyDecoder','_WelsGetDecoderCapability','_ISVCDecoderInitialize','_ISVCDecoderUninitialize','_ISVCDecoderDecodeFrame','_WelsCreateSVCEncoder','_WelsDestroySVCEncoder','_ISVCEncoderInitialize','_ISVCEncoderInitializeExt','_ISVCEncoderGetDefaultParams','_ISVCEncoderUninitialize','_ISVCEncoderEncodeFrame','_ISVCEncoderEncodeParameterSets','_ISVCEncoderForceIntraFrame','_ISVCEncoderSetOption','_ISVCEncoderGetOption','_SizeOfSEncParamExt','_SizeOfSFrameBSInfo','_SizeOfSSourcePicture','_SetupSEncParamExt',${COLORSPACE_EXPORTS}

X264_FLAGS:=-Ix264 -s TOTAL_MEMORY=268435456
X264_FILES:=x264/libx264.a x264_binding.c colorspace.c
X264_EXPORTS:='_x264_encoder_param_create','_x264_encoder_param_free','_x264_encoder_open2','_x264_encoder_encode','_x264_encoder_delayed_frames','_x264_encoder_close','_x264_picture_create','_x264_picture_free','_x264_picture_init','_x264_picture_setup','_x264_param_parse',${COLORSPACE_EXPORTS}

VPX_OBJ=libvpx/libvpx.a

all: $(TARGETS)
clean:
	rm -f $(TARGETS)

libopenh264.js: $(OPENH264_FILES)
	emcc $(EMCC_OPTS) $(OPENH264_FLAGS) -s EXPORTED_FUNCTIONS="[$(OPENH264_EXPORTS)]" $(OPENH264_FILES) -o $@

libx264.js: $(X264_FILES)
	emcc $(EMCC_OPTS) $(X264_FLAGS) -s EXPORTED_FUNCTIONS="[$(X264_EXPORTS)]" $(X264_FILES) -o $@

%.js: %.ts
	tsc $<
