NATIVE_DIR=./native

LIBDE265_DIR=$(NATIVE_DIR)/libde265
LIBDE265_LIB=$(LIBDE265_DIR)/libde265/.libs/libde265.a

THOR_DIR=$(NATIVE_DIR)/thor
THOR_DUMMY_TARGET=$(THOR_DIR)/build/Thorenc

LIBVPX_DIR=$(NATIVE_DIR)/libvpx
LIBVPX_LIB=$(LIBVPX_DIR)/libvpx_g.a

OPENH264_DIR=$(NATIVE_DIR)/openh264
OPENH264_LIB=$(OPENH264_DIR)/libopenh264.a

TARGETS=$(LIBDE265_LIB) $(THOR_DUMMY_TARGET) $(LIBVPX_LIB) $(OPENH264_LIB)

all: apply-patch $(TARGETS)
clean:
	(cd $(LIBDE265_DIR); rm -rf *; git reset --hard); \
	(cd $(THOR_DIR);  rm -rf *; git reset --hard); \
	(cd $(LIBVPX_DIR);  rm -rf *; git reset --hard); \
	(cd $(OPENH264_DIR);  rm -rf *; git reset --hard); \
	rm -f $(TARGETS)

apply-patch:
	cd $(NATIVE_DIR); ./apply-patch.sh

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
