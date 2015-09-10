all: struct_offset.js

struct_offset.js: struct_offset.cc
	em++ -o $@ $<

run: struct_offset.js
	node $<
