#!/bin/sh
set -eu
diggy_root=$(CDPATH= cd -- "$(dirname "$0")/.." && pwd)
diggy_output=$1
diggy_version=$2
diggy_stage=$(mktemp -d)
trap 'rm -rf "$diggy_stage"' EXIT HUP INT TERM
case "$(uname -s)" in
  Darwin)
    diggy_icu=$(brew --prefix icu4c)
    diggy_icu_lib="$diggy_icu/lib"
    export CGO_CPPFLAGS="${CGO_CPPFLAGS:-} -I$diggy_icu/include"
    ;;
  Linux)
    diggy_icu_lib=$(pkg-config --variable=libdir icu-i18n)
    export CGO_CPPFLAGS="${CGO_CPPFLAGS:-} $(pkg-config --cflags icu-i18n)"
    ;;
  *) echo "Portable release builds support macOS and Linux." >&2; exit 1 ;;
esac
# The linker must see ONLY static ICU archives in its first search directory.
# Never copy or bundle Homebrew's dylibs / Linux's version-specific ICU .so files.
for diggy_lib in libicui18n.a libicuuc.a libicudata.a; do
  cp "$diggy_icu_lib/$diggy_lib" "$diggy_stage/$diggy_lib"
done
export CGO_ENABLED=1
export CGO_LDFLAGS="-L$diggy_stage ${CGO_LDFLAGS:-}"
cd "$diggy_root/local"
go build -tags icu_static -trimpath -ldflags "-s -w -X main.version=$diggy_version" -o "$diggy_output" ./cmd/diggy
case "$(uname -s)" in
  Darwin)
    if otool -L "$diggy_output" | tail -n +2 | grep -E '/(opt/homebrew|usr/local|.*icu)|libicu'; then
      echo "Release binary still references non-system libraries." >&2; exit 1
    fi
    ;;
  Linux)
    if ldd "$diggy_output" | grep -i icu; then
      echo "Release binary still references system ICU." >&2; exit 1
    fi
    ;;
esac
"$diggy_output" --version
