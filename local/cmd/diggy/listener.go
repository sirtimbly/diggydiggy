package main

import (
	"errors"
	"fmt"
	"net"
	"syscall"
)

// Bind each candidate directly so the chosen port is already reserved when we
// start serving. Only an occupied address is a reason to try the next port.
func listenLocal(firstPort int) (net.Listener, error) {
	if firstPort < 1 || firstPort > 65535 {
		return nil, fmt.Errorf("port must be between 1 and 65535")
	}
	var lastError error
	for port := firstPort; port <= 65535; port++ {
		listener, err := net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", port))
		if err == nil {
			return listener, nil
		}
		if !errors.Is(err, syscall.EADDRINUSE) {
			return nil, err
		}
		lastError = err
	}
	return nil, fmt.Errorf("no available local port between %d and 65535: %w", firstPort, lastError)
}
