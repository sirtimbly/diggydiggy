package assets

import "embed"

// Built by npm run build:local before compiling Go.
//
//go:embed all:web
var Web embed.FS
