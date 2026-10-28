package main

import (
	"context"
	"flag"
	"fmt"
	"io/fs"
	"log"
	"net/http"
	"os"
	"os/signal"
	"syscall"
	"time"

	assets "diggy.local/app"
	"diggy.local/app/internal/server"
	"diggy.local/app/internal/store"
)

var version = "dev"

func main() {
	showVersion := flag.Bool("version", false, "print the installed version")
	directory := flag.String("data", ".diggy", "database parent directory (database lives in <data>/diggy)")
	port := flag.Int("port", 4180, "preferred local web port (tries higher ports when occupied)")
	name := flag.String("name", "Diggy local", "Dolt commit author name")
	email := flag.String("email", "local@diggy.invalid", "Dolt commit author email")
	flag.Parse()
	if *showVersion {
		fmt.Println(version)
		return
	}
	command := "serve"
	if flag.NArg() > 0 {
		command = flag.Arg(0)
	}
	if command != "serve" && command != "clone" && command != "remote" && command != "push" && command != "pull" {
		log.Fatal("usage: diggy [flags] [serve | clone URL | remote URL | push | pull]")
	}
	if (command == "clone" || command == "remote") && flag.NArg() != 2 {
		log.Fatal("clone and remote require a URL")
	}
	if command != "clone" && command != "remote" && flag.NArg() > 1 {
		log.Fatal("unexpected arguments")
	}
	if *port < 1 || *port > 65535 {
		log.Fatal("port must be between 1 and 65535")
	}
	ctx, stop := signal.NotifyContext(context.Background(), os.Interrupt, syscall.SIGTERM)
	defer stop()
	var db *store.Store
	var err error
	if command == "clone" {
		db, err = store.Clone(ctx, *directory, *name, *email, flag.Arg(1))
	} else {
		db, err = store.Open(ctx, *directory, *name, *email)
	}
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if command != "serve" {
		switch command {
		case "remote":
			err = db.Remote(ctx, flag.Arg(1))
		case "push", "pull":
			err = db.Sync(ctx, command == "push")
		}
		if err != nil {
			log.Printf("%s failed: %v", command, err)
			db.Close()
			os.Exit(1)
		}
		fmt.Printf("%s complete\n", command)
		return
	}
	web, err := fs.Sub(assets.Web, "web")
	if err != nil {
		log.Fatal(err)
	}
	listener, err := listenLocal(*port)
	if err != nil {
		log.Fatal(err)
	}
	host := listener.Addr().String()
	srv := &http.Server{Handler: server.New(db, web, host), ReadHeaderTimeout: 5 * time.Second, ReadTimeout: 30 * time.Second, WriteTimeout: 2 * time.Minute, IdleTimeout: 60 * time.Second}
	shutdownDone := make(chan struct{})
	go func() {
		defer close(shutdownDone)
		<-ctx.Done()
		shutdown, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()
		if err := srv.Shutdown(shutdown); err != nil {
			log.Printf("shutdown: %v", err)
		}
	}()
	fmt.Printf("Diggy: http://%s\nDolt data: %s/diggy\n", host, *directory)
	if err := srv.Serve(listener); err != nil && err != http.ErrServerClosed {
		log.Print(err)
		stop()
	}
	<-shutdownDone
}
