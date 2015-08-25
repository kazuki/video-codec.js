#!/bin/sh
function try_patch() {
    if patch -p1 -N --dry-run < $1 > /dev/null; then
        patch -p1 -N < $1
    else
        exit 0
    fi
}
(cd thor; try_patch ../thor.patch)
(cd libvpx; try_patch ../libvpx.patch)
(cd openh264; try_patch ../openh264.patch)
(cd ogg; try_patch ../ogg.patch)
