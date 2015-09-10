all: struct_offset.js

struct_offset.js: struct_offset.c
	emcc -o $@ $< -I../native/libvpx

run: struct_offset.js
	node $<
