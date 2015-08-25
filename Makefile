LIBDE265_LIB=libde265/libde265/.libs/libde265.a

THOR_DUMMY_TARGET=thor/build/Thorenc

LIBVPX_LIB=libvpx/libvpx_g.a

OPENH264_LIB=openh264/libopenh264.a

TARGETS=$(LIBDE265_LIB) $(THOR_DUMMY_TARGET) $(LIBVPX_LIB) $(OPENH264_LIB)

all: apply-patch $(TARGETS)
clean:
	(cd libde265; emmake make clean); \
	(cd thor; emmake make clean); \
	(cd libvpx; emmake make clean); \
	(cd openh264; emmake make clean); \
	rm -f $(TARGETS)

apply-patch:
	./apply-patch.sh

$(LIBDE265_LIB): libde265/Makefile
	cd libde265; emmake make

libde265/Makefile: libde265/configure
	cd libde265; emconfigure ./configure --disable-sse --disable-arm --disable-dec265

libde265/configure:
	cd libde265; ./autogen.sh

$(THOR_DUMMY_TARGET):
	cd thor; emmake make

$(LIBVPX_LIB): libvpx/Makefile
	cd libvpx; emmake make libvpx_g.a

libvpx/Makefile: libvpx/configure
	cd libvpx; emconfigure ./configure --disable-multithread --target=generic-gnu --enable-vp10 --disable-examples --disable-docs

$(OPENH264_LIB):
	cd openh264; emmake make
