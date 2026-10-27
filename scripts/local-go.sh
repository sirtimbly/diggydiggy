#!/bin/sh
set -eu
cd "$(dirname "$0")/../local"
# Homebrew's ICU headers/libraries are not on the default compiler search path.
if [ "$(uname -s)" = Darwin ] && command -v brew >/dev/null 2>&1; then
  diggy_icu_prefix=$(brew --prefix icu4c)
  export CGO_CPPFLAGS="${CGO_CPPFLAGS:-} -I$diggy_icu_prefix/include"
  export CGO_LDFLAGS="${CGO_LDFLAGS:-} -L$diggy_icu_prefix/lib"
fi
exec go "$@"
