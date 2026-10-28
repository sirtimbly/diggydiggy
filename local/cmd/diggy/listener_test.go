package main

import (
	"fmt"
	"net"
	"strings"
	"testing"
)

func TestListenLocalSkipsOccupiedPorts(t *testing.T) {
	// Hold two neighboring ports, then verify that the returned listener has
	// actually bound a higher loopback port instead of just probing one.
	first, err := net.Listen("tcp4", "127.0.0.1:0")
	if err != nil {
		t.Fatal(err)
	}
	defer first.Close()
	port := first.Addr().(*net.TCPAddr).Port
	if port >= 65534 {
		t.Skip("ephemeral port too close to upper bound")
	}
	second, err := net.Listen("tcp4", fmt.Sprintf("127.0.0.1:%d", port+1))
	if err == nil {
		defer second.Close()
	}
	listener, err := listenLocal(port)
	if err != nil {
		t.Fatal(err)
	}
	defer listener.Close()
	address := listener.Addr().(*net.TCPAddr)
	if !address.IP.Equal(net.IPv4(127, 0, 0, 1)) || address.Port < port+2 {
		t.Fatalf("expected higher loopback port, got %s", address)
	}
	connection, err := net.Dial("tcp4", address.String())
	if err != nil {
		t.Fatalf("selected port is not listening: %v", err)
	}
	connection.Close()
}

func TestListenLocalStopsAtPortLimit(t *testing.T) {
	occupied, err := net.Listen("tcp4", "127.0.0.1:65535")
	if err == nil {
		defer occupied.Close()
	}
	listener, err := listenLocal(65535)
	if listener != nil {
		listener.Close()
		t.Fatal("occupied final port was reused")
	}
	if err == nil || !strings.Contains(err.Error(), "no available local port") {
		t.Fatalf("unexpected exhaustion error: %v", err)
	}
}
