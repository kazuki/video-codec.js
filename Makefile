NATIVE_DIR=./native

LIBDE265_DIR=$(NATIVE_DIR)/libde265
LIBDE265_LIB=$(LIBDE265_DIR)/libde265/.libs/libde265.a

THOR_DIR=$(NATIVE_DIR)/thor
THOR_DUMMY_TARGET=$(THOR_DIR)/build/Thorenc $(THOR_DIR)/build/Thordec

LIBVPX_DIR=$(NATIVE_DIR)/libvpx
LIBVPX_LIB=$(LIBVPX_DIR)/libvpx_g.a

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
DAALA_LIB=$(DAALA_DIR)/src/.libs/libdaalaenc.a $(DAALA_DIR)/src/.libs/libdaaladec.a

EMCC_OPTS=-O3 --llvm-lto 1 --memory-init-file 0 -s BUILD_AS_WORKER=1 -s TOTAL_MEMORY=67108864

TARGETS=$(LIBDE265_LIB) $(THOR_DUMMY_TARGET) $(LIBVPX_LIB) $(OPENH264_LIB) $(OGG_LIB) $(DAALA_LIB) $(OPENH264_ENCODER) $(OPENH264_DECODER) test.js

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
