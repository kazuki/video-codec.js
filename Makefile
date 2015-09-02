NATIVE_DIR=./native

LIBDE265_DIR=$(NATIVE_DIR)/libde265
LIBDE265_LIB=$(LIBDE265_DIR)/libde265/.libs/libde265.a
LIBDE265_ENCODER=libde265_encoder.js
LIBDE265_DECODER=libde265_decoder.js
LIBDE265_OPTS=-I$(LIBDE265_DIR) -s DEMANGLE_SUPPORT=1 -std=c++11 -s ASSERTIONS=1 -s SAFE_HEAP=1
LIBDE265_DEPS=$(LIBDE265_LIB) $(NATIVE_DIR)/libde265_binding.cc
LIBDE265_ENCODER_EXPORTS='_de265_init','_en265_new_encoder','_en265_start_encoder','_en265_push_image','_en265_push_eof','_en265_encode','_en265_get_packet','_en265_free_packet','_en265_free_encoder','_de265_free','_libde265_image_allocate','_libde265_image_get_plane','_libde265_image_get_stride','_libde265_encoder_hack'
LIBDE265_DECODER_EXPORTS='_de265_new_decoder'

THOR_DIR=$(NATIVE_DIR)/thor
THOR_DUMMY_TARGET=$(THOR_DIR)/build/Thorenc $(THOR_DIR)/build/Thordec

LIBVPX_DIR=$(NATIVE_DIR)/libvpx
LIBVPX_LIB=$(LIBVPX_DIR)/libvpx_g.a
LIBVPX_ENCODER=vpx_encoder.js
LIBVPX_DECODER=vpx_decoder.js
LIBVPX_DEPS=$(LIBVPX_LIB) $(NATIVE_DIR)/libvpx_binding.c
LIBVPX_ENCODER_EXPORTS='_vpx_codec_vp8_cx','_vpx_codec_vp9_cx','_vpx_codec_vp10_cx','_vpx_codec_enc_init2','_vpx_codec_encode','_vpx_codec_get_cx_data','_vpx_img_alloc','_vpx_codec_enc_create_config','_allocate_vpx_codec_ctx','_vpx_codec_error','_vpx_codec_error_detail'
LIBVPX_DECODER_EXPORTS='_vpx_codec_vp8_dx','_vpx_codec_vp9_dx','_vpx_codec_vp10_dx','_vpx_codec_dec_init2','_allocate_vpx_codec_ctx','_vpx_codec_dec_init_ver','_vpx_codec_decode','_vpx_codec_get_frame'

OPENH264_DIR=$(NATIVE_DIR)/openh264
OPENH264_LIB=$(OPENH264_DIR)/libopenh264.a
OPENH264_ENCODER=openh264_encoder.js
OPENH264_ENCODER_DEPS=$(OPENH264_LIB) $(NATIVE_DIR)/openh264_binding.c openh264_encoder.ts
OPENH264_ENCODER_EXPORTS='_WelsCreateSVCEncoder','_WelsSetupSVCEncoder','_SizeOfSFrameBSInfo','_SizeOfSSourcePicture','_SetupSSourcePicture','_WelsSVCEncoderEncodeFrame','_SetSSourcePictureTimestamp'
OPENH264_DECODER=openh264_decoder.js
OPENH264_DECODER_DEPS=$(OPENH264_LIB) $(NATIVE_DIR)/openh264_binding.c openh264_decoder.ts
OPENH264_DECODER_EXPORTS='_WelsCreateDecoder','_WelsInitializeDecoder','_WelsDecoderDecodeFrame','_SizeOfSBufferInfo'

OGG_DIR=$(NATIVE_DIR)/ogg
OGG_LIB=$(OGG_DIR)/src/.libs/libogg.a

DAALA_DIR=$(NATIVE_DIR)/daala
DAALA_LIB=$(DAALA_DIR)/src/.libs/libdaalabase.a $(DAALA_DIR)/src/.libs/libdaalaenc.a $(DAALA_DIR)/src/.libs/libdaaladec.a
DAALA_ENCODER=daala_encoder.js
DAALA_DECODER=daala_decoder.js
DAALA_OPTS=-I$(NATIVE_DIR)/ogg/include
DAALA_ENCODER_DEPS=$(DAALA_LIB) $(NATIVE_DIR)/daala_binding.c
DAALA_DECODER_DEPS=$(DAALA_LIB) $(NATIVE_DIR)/daala_binding.c
DAALA_ENCODER_EXPORTS='_daala_encode_create','_daala_encode_ctl','_daala_encode_flush_header','_daala_encode_img_in','_daala_encode_packet_out','_daala_info_create','_daala_info_init','_daala_comment_create','_od_state_init','_od_img_create','_od_quantizer_to_codedquantizer','_od_apply_prefilter_frame_sbs','_od_apply_qm','_od_ec_tell_frac','_od_hv_intra_pred','_od_raster_to_coding_order','_od_log_matrix_uchar','_EXP_CDF_TABLE'
DAALA_DECODER_EXPORTS='_daala_decode_header_in','_daala_decode_alloc','_daala_decode_packet_in','_daala_setup_free','_daala_info_create','_daala_info_init','_daala_comment_create','_od_img_create','_oggbyte_readcopy','_od_state_init','_od_accounting_init','_od_ec_dec_init','_od_codedquantizer_to_quantizer','_generic_decode_','_od_hv_intra_pred','_od_raster_to_coding_order','_od_qm_get_index','_od_pvq_decode','_od_postfilter_split'

EMCC_OPTS=-O3 --llvm-lto 1 --memory-init-file 0 -s BUILD_AS_WORKER=1 -s TOTAL_MEMORY=67108864

TARGETS=$(LIBDE265_LIB) $(THOR_DUMMY_TARGET) $(LIBVPX_LIB) $(OPENH264_LIB) $(OGG_LIB) $(DAALA_LIB) $(OPENH264_ENCODER) $(OPENH264_DECODER) $(DAALA_ENCODER) $(DAALA_DECODER) $(LIBVPX_ENCODER) $(LIBVPX_DECODER) $(LIBDE265_ENCODER) $(LIBDE265_DECODER) test.js

all: apply-patch $(TARGETS)
clean:
	(cd $(LIBDE265_DIR); rm -rf *; git reset --hard); \
	(cd $(THOR_DIR);  rm -rf *; git reset --hard); \
	(cd $(LIBVPX_DIR);  rm -rf *; git reset --hard); \
	(cd $(OPENH264_DIR);  rm -rf *; git reset --hard); \
	(cd $(DAALA_DIR);  rm -rf *; git reset --hard); \
	rm -f $(TARGETS)

apply-patch:
	cd $(NATIVE_DIR); ./apply-patch.sh

test.js: *.ts
	tsc --out test.js test.ts

$(LIBDE265_LIB): $(LIBDE265_DIR)/Makefile
	cd $(LIBDE265_DIR); emmake make

$(LIBDE265_DIR)/Makefile: $(LIBDE265_DIR)/configure
	cd $(LIBDE265_DIR); emconfigure ./configure --disable-sse --disable-arm --disable-dec265

$(LIBDE265_DIR)/configure:
	cd $(LIBDE265_DIR); ./autogen.sh

$(THOR_DUMMY_TARGET):
	cd $(THOR_DIR); emmake make

$(LIBVPX_LIB): $(LIBVPX_DIR)/Makefile
	cd $(LIBVPX_DIR); emmake make libvpx_g.a

$(LIBVPX_DIR)/Makefile: $(LIBVPX_DIR)/configure
	cd $(LIBVPX_DIR); emconfigure ./configure --disable-multithread --target=generic-gnu --enable-vp10 --disable-examples --disable-docs

$(OPENH264_LIB):
	cd $(OPENH264_DIR); emmake make

$(OGG_LIB): $(OGG_DIR)/Makefile
	cd $(OGG_DIR); emmake make

$(OGG_DIR)/Makefile: $(OGG_DIR)/configure
	cd $(OGG_DIR); emconfigure ./configure

$(OGG_DIR)/configure:
	cd $(OGG_DIR); ./autogen.sh

$(DAALA_LIB): $(DAALA_DIR)/Makefile
	cd $(DAALA_DIR); emmake make

$(DAALA_DIR)/Makefile: $(DAALA_DIR)/configure $(OGG_LIB)
	cd $(DAALA_DIR); OGG_CFLAGS=-I../ogg/include OGG_LIBS=-L../ogg/src/.libs \
    emconfigure ./configure --disable-player --disable-tools --disable-openmp --disable-unit-tests --disable-doc --disable-asm

$(DAALA_DIR)/configure:
	cd $(DAALA_DIR); ./autogen.sh

$(OPENH264_ENCODER): $(OPENH264_ENCODER_DEPS)
	tsc --out .openh264_encoder.js openh264_encoder.ts && \
	emcc -o $@ $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(OPENH264_ENCODER_EXPORTS)]" --post-js .openh264_encoder.js $(OPENH264_LIB) $(NATIVE_DIR)/openh264_binding.c

$(OPENH264_DECODER): $(OPENH264_DECODER_DEPS)
	tsc --out .openh264_decoder.js openh264_decoder.ts && \
	emcc -o $@ $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(OPENH264_DECODER_EXPORTS)]" --post-js .openh264_decoder.js $(OPENH264_LIB) $(NATIVE_DIR)/openh264_binding.c

$(DAALA_ENCODER): $(DAALA_ENCODER_DEPS) daala_encoder.ts
	tsc --out .daala_encoder.js daala_encoder.ts && \
	emcc -o $@ $(EMCC_OPTS) $(DAALA_OPTS) -s EXPORTED_FUNCTIONS="[$(DAALA_ENCODER_EXPORTS)]" --post-js .daala_encoder.js $(DAALA_ENCODER_DEPS)

$(DAALA_DECODER): $(DAALA_DECODER_DEPS) daala_decoder.ts
	tsc --out .daala_decoder.js daala_decoder.ts && \
	emcc -o $@ $(EMCC_OPTS) $(DAALA_OPTS) -s EXPORTED_FUNCTIONS="[$(DAALA_DECODER_EXPORTS)]" --post-js .daala_decoder.js $(DAALA_DECODER_DEPS)

$(LIBVPX_ENCODER): $(LIBVPX_DEPS) vpx_encoder.ts
	tsc --out .vpx_encoder.js vpx_encoder.ts && \
	emcc -o $@ $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(LIBVPX_ENCODER_EXPORTS)]" --post-js .vpx_encoder.js $(LIBVPX_DEPS)

$(LIBVPX_DECODER): $(LIBVPX_DEPS) vpx_decoder.ts
	tsc --out .vpx_decoder.js vpx_decoder.ts && \
	emcc -o $@ $(EMCC_OPTS) -s EXPORTED_FUNCTIONS="[$(LIBVPX_DECODER_EXPORTS)]" --post-js .vpx_decoder.js $(LIBVPX_DEPS)

$(LIBDE265_ENCODER): $(LIBDE265_DEPS) libde265_encoder.ts
	tsc --out .libde265_encoder.js libde265_encoder.ts && \
	emcc -o $@ $(EMCC_OPTS) $(LIBDE265_OPTS) -s EXPORTED_FUNCTIONS="[$(LIBDE265_ENCODER_EXPORTS)]" --post-js .libde265_encoder.js $(LIBDE265_DEPS)

$(LIBDE265_DECODER): $(LIBDE265_DEPS) libde265_decoder.ts
	tsc --out .libde265_decoder.js libde265_decoder.ts && \
	emcc -o $@ $(EMCC_OPTS) $(LIBDE265_OPTS) -s EXPORTED_FUNCTIONS="[$(LIBDE265_DECODER_EXPORTS)]" --post-js .libde265_decoder.js $(LIBDE265_DEPS)
